import { CertificateRecord, DriveFileDiagnostic } from '../types/certificate';

export interface AppsScriptResponse {
  success: boolean;
  found: boolean;
  data?: CertificateRecord | null;
  matches?: CertificateRecord[];
  records?: CertificateRecord[];
  files?: DriveFileDiagnostic[];
  folderName?: string;
  folderId?: string;
  totalFiles?: number;
  totalRecords?: number;
  error?: string;
  sourceFile?: string;
  executionTimeMs?: number;
}

async function fetchAppsScriptJson(url: string): Promise<AppsScriptResponse> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Google Apps Script trả về lỗi HTTP ${res.status}: ${res.statusText}`);
    }

    const text = await res.text();
    try {
      return JSON.parse(text) as AppsScriptResponse;
    } catch {
      throw new Error(
        'Google Apps Script không trả về JSON hợp lệ. Hãy kiểm tra lại quyền Deploy Web App (Anyone / Bất kỳ ai) và URL kết thúc bằng /exec.'
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi kết nối tới Google Apps Script';
    return {
      success: false,
      found: false,
      error: msg,
    };
  }
}

/**
 * Kiểm tra kết nối tới Google Apps Script & liệt kê các file Excel/Sheets trong thư mục Drive
 */
export async function pingAppsScript(webAppUrl: string): Promise<AppsScriptResponse> {
  const cleanUrl = webAppUrl.trim();
  const separator = cleanUrl.includes('?') ? '&' : '?';
  return fetchAppsScriptJson(`${cleanUrl}${separator}action=ping`);
}

/**
 * Nạp toàn bộ dữ liệu chứng chỉ từ Google Drive thông qua Google Apps Script vào bộ nhớ tra cứu nhanh
 */
export async function syncAllFromAppsScript(webAppUrl: string): Promise<AppsScriptResponse> {
  const cleanUrl = webAppUrl.trim();
  const separator = cleanUrl.includes('?') ? '&' : '?';
  return fetchAppsScriptJson(`${cleanUrl}${separator}action=sync`);
}

/**
 * Tra cứu trực tiếp theo MSSV hoặc Họ tên qua Google Apps Script Web App
 */
export async function queryAppsScript(
  webAppUrl: string,
  searchQuery: string
): Promise<AppsScriptResponse> {
  const cleanUrl = webAppUrl.trim();
  const cleanQuery = searchQuery.trim();
  const separator = cleanUrl.includes('?') ? '&' : '?';
  const queryUrl =
    cleanQuery === 'TEST_PING'
      ? `${cleanUrl}${separator}action=ping`
      : `${cleanUrl}${separator}mssv=${encodeURIComponent(cleanQuery)}&q=${encodeURIComponent(cleanQuery)}`;

  return fetchAppsScriptJson(queryUrl);
}
