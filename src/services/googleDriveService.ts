import { parseExcelFile } from './excelParser';
import { CertificateRecord, DriveFileDiagnostic, DriveFileInfo } from '../types/certificate';

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
 * List all Excel (.xlsx, .xls, .csv) and Google Sheets files inside the given folder
 */
export async function listFolderFiles(accessToken: string, folderId: string): Promise<DriveFileInfo[]> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const query = `'${folderId}' in parents and trashed = false and (mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType = 'application/vnd.ms-excel' or mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'text/csv' or name contains '.xlsx' or name contains '.xls' or name contains '.csv')`;

  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name,mimeType,size,modifiedTime)&pageSize=100`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Không thể đọc danh sách file từ thư mục Drive (${res.status}): ${res.statusText}`);
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
    throw new Error(`Lỗi tải file từ Google Drive (${res.status}): ${res.statusText}`);
  }

  return await res.arrayBuffer();
}

/**
 * Scan all files in the GDQP folder and extract certificate records with per-file diagnostics
 */
export async function scanDriveFolderForCertificates(
  accessToken: string,
  folderId: string,
  onProgress?: ScanProgressCallback
): Promise<{
  records: CertificateRecord[];
  filesScanned: string[];
  fileDiagnostics: DriveFileDiagnostic[];
}> {
  if (onProgress) onProgress('Đang quét danh sách file Excel trong thư mục Google Drive...', 10);

  const files = await listFolderFiles(accessToken, folderId);
  if (files.length === 0) {
    return { records: [], filesScanned: [], fileDiagnostics: [] };
  }

  const allRecords: CertificateRecord[] = [];
  const filesScanned: string[] = [];
  const fileDiagnostics: DriveFileDiagnostic[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const progress = Math.round(15 + ((i + 1) / files.length) * 80);
    if (onProgress) {
      onProgress(`Đang tải & phân tích: ${file.name} (${i + 1}/${files.length})...`, progress);
    }

    try {
      const buffer = await downloadDriveFile(accessToken, file.id, file.mimeType);
      const fileRecords = parseExcelFile(buffer, file.name);
      allRecords.push(...fileRecords);
      filesScanned.push(file.name);
      fileDiagnostics.push({
        name: file.name,
        mimeType: file.mimeType,
        rowCount: fileRecords.length,
        status: fileRecords.length > 0 ? 'connected' : 'empty',
        ...(fileRecords.length === 0
          ? { error: 'Không nhận diện được cột MSSV / Họ tên trong file này.' }
          : {}),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi đọc file';
      console.warn(`Lỗi đọc file ${file.name}:`, err);
      fileDiagnostics.push({
        name: file.name,
        mimeType: file.mimeType,
        rowCount: 0,
        status: 'error',
        error: msg,
      });
    }
  }

  if (onProgress) {
    onProgress(`Hoàn tất tải ${allRecords.length.toLocaleString('vi-VN')} chứng chỉ từ ${filesScanned.length} file!`, 100);
  }

  return { records: allRecords, filesScanned, fileDiagnostics };
}
