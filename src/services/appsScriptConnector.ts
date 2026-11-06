import { CertificateRecord } from '../types/certificate';

export interface AppsScriptResponse {
  success: boolean;
  found: boolean;
  data?: CertificateRecord;
  error?: string;
  sourceFile?: string;
  executionTimeMs?: number;
}

/**
 * Query a deployed Google Apps Script Web App endpoint by MSSV
 */
export async function queryAppsScript(
  webAppUrl: string,
  mssv: string
): Promise<AppsScriptResponse> {
  const cleanMssv = mssv.trim().toUpperCase();
  const separator = webAppUrl.includes('?') ? '&' : '?';
  const queryUrl = `${webAppUrl}${separator}mssv=${encodeURIComponent(cleanMssv)}`;

  try {
    const res = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Google Apps Script trả về lỗi HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    return json;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi kết nối tới Google Apps Script';
    return {
      success: false,
      found: false,
      error: msg,
    };
  }
}
