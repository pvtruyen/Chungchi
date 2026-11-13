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

async function fetchAppsScriptJson(url: string, timeoutMs: number = 45000): Promise<AppsScriptResponse> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

  try {
    // Không gửi custom headers để giữ CORS Simple Request, tương thích mọi trình duyệt và redirect 302 của Google
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      ...(controller ? { signal: controller.signal } : {}),
    });

    if (!res.ok) {
      throw new Error(`Google Apps Script trả về lỗi HTTP ${res.status}: ${res.statusText}`);
    }

    const text = await res.text();
    try {
      return JSON.parse(text) as AppsScriptResponse;
    } catch {
      const looksLikeGoogleLogin =
        text.includes('accounts.google.com') || text.includes('ServiceLogin') || text.includes('<html');
      throw new Error(
        looksLikeGoogleLogin
          ? 'Google Apps Script yêu cầu đăng nhập Google. Vui lòng Deploy lại Web App với mục "Who has access" là "Anyone (Bất kỳ ai)" để máy khác tra cứu được.'
          : 'Google Apps Script không trả về JSON hợp lệ. Hãy kiểm tra lại quyền Deploy Web App (Anyone) và URL kết thúc bằng /exec.'
      );
    }
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const msg = isAbort
      ? 'Kết nối tới Google Apps Script bị quá thời gian chờ (Timeout).'
      : err instanceof Error
      ? err.message
      : 'Lỗi kết nối tới Google Apps Script';
    return {
      success: false,
      found: false,
      error: msg,
    };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Kiểm tra kết nối tới Google Apps Script & liệt kê các file Excel/Sheets trong thư mục Drive
 */
export async function pingAppsScript(webAppUrl: string): Promise<AppsScriptResponse> {
  const cleanUrl = webAppUrl.trim();
  const separator = cleanUrl.includes('?') ? '&' : '?';
  return fetchAppsScriptJson(`${cleanUrl}${separator}action=ping`, 45000);
}

/**
 * Nạp toàn bộ dữ liệu chứng chỉ từ Google Drive thông qua Google Apps Script vào bộ nhớ tra cứu nhanh
 */
export async function syncAllFromAppsScript(webAppUrl: string): Promise<AppsScriptResponse> {
  const cleanUrl = webAppUrl.trim();
  const separator = cleanUrl.includes('?') ? '&' : '?';
  return fetchAppsScriptJson(`${cleanUrl}${separator}action=sync`, 120000);
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

  return fetchAppsScriptJson(queryUrl, 60000);
}
