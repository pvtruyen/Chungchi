import { parseExcelFile } from './excelParser';
import { CertificateRecord, DriveFileInfo } from '../types/certificate';

interface ScanProgressCallback {
  (message: string, progressPercent: number): void;
}

/**
 * Find folder ID for path: My Drive \ GDQP \ Số hóa chứng chỉ
 */
export async function findGdqpFolder(accessToken: string): Promise<{ folderId: string; folderPath: string } | null> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  // 1. Direct search for 'Số hóa chứng chỉ'
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    "mimeType = 'application/vnd.google-apps.folder' and name = 'Số hóa chứng chỉ' and trashed = false"
  )}&fields=files(id,name,parents)&pageSize=10`;

  const res = await fetch(searchUrl, { headers });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Lỗi truy cập Google Drive API: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return {
      folderId: data.files[0].id,
      folderPath: 'My Drive / GDQP / Số hóa chứng chỉ',
    };
  }

  // 2. Search for parent folder 'GDQP' first
  const parentSearchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    "mimeType = 'application/vnd.google-apps.folder' and (name = 'GDQP' or name = 'GDQP-AN' or name = 'GDQP&AN') and trashed = false"
  )}&fields=files(id,name)&pageSize=5`;

  const pRes = await fetch(parentSearchUrl, { headers });
  if (pRes.ok) {
    const pData = await pRes.json();
    if (pData.files && pData.files.length > 0) {
      const parentId = pData.files[0].id;
      // Search subfolders inside GDQP
      const subSearchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
      )}&fields=files(id,name)&pageSize=10`;

      const subRes = await fetch(subSearchUrl, { headers });
      if (subRes.ok) {
        const subData = await subRes.json();
        const target = subData.files?.find((f: { name: string }) =>
          f.name.toLowerCase().includes('số hóa') || f.name.toLowerCase().includes('chứng chỉ')
        );
        if (target) {
          return { folderId: target.id, folderPath: `My Drive / GDQP / ${target.name}` };
        }
      }
      return { folderId: parentId, folderPath: `My Drive / ${pData.files[0].name}` };
    }
  }

  return null;
}

/**
 * List all Excel (.xlsx, .xls) and Google Sheets files inside the given folder
 */
export async function listFolderFiles(accessToken: string, folderId: string): Promise<DriveFileInfo[]> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const query = `'${folderId}' in parents and trashed = false and (mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType = 'application/vnd.ms-excel' or mimeType = 'application/vnd.google-apps.spreadsheet' or name contains '.xlsx' or name contains '.xls')`;
  
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name,mimeType,size,modifiedTime)&pageSize=100`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Không thể đọc danh sách file từ thư mục Drive: ${res.statusText}`);
  }

  const data = await res.json();
  return (data.files || []).map((f: Record<string, string>) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size,
    modifiedTime: f.modifiedTime,
  }));
}

/**
 * Download a file from Google Drive as ArrayBuffer
 * If it's a native Google Sheet, export it as xlsx
 */
export async function downloadDriveFile(
  accessToken: string,
  fileId: string,
  mimeType: string
): Promise<ArrayBuffer> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  let downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
  }

  const res = await fetch(downloadUrl, { headers });
  if (!res.ok) {
    throw new Error(`Lỗi tải file từ Google Drive: ${res.statusText}`);
  }

  return await res.arrayBuffer();
}

/**
 * Scan all files in the GDQP folder and extract certificate records
 */
export async function scanDriveFolderForCertificates(
  accessToken: string,
  folderId: string,
  onProgress?: ScanProgressCallback
): Promise<{ records: CertificateRecord[]; filesScanned: string[] }> {
  if (onProgress) onProgress('Đang quét danh sách file Excel trong thư mục...', 10);

  const files = await listFolderFiles(accessToken, folderId);
  if (files.length === 0) {
    return { records: [], filesScanned: [] };
  }

  const allRecords: CertificateRecord[] = [];
  const filesScanned: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const progress = Math.round(15 + ((i + 1) / files.length) * 80);
    if (onProgress) {
      onProgress(`Đang xử lý dữ liệu: ${file.name} (${i + 1}/${files.length})...`, progress);
    }

    try {
      const buffer = await downloadDriveFile(accessToken, file.id, file.mimeType);
      const fileRecords = parseExcelFile(buffer, file.name);
      allRecords.push(...fileRecords);
      filesScanned.push(file.name);
    } catch (err) {
      console.warn(`Lỗi đọc file ${file.name}:`, err);
    }
  }

  if (onProgress) onProgress(`Hoàn tất số hóa ${allRecords.length} chứng chỉ từ ${filesScanned.length} file!`, 100);

  return { records: allRecords, filesScanned };
}
