import { CertificateRecord, SyncStatus, DataSourceType } from '../types/certificate';
import { INITIAL_DEMO_RECORDS } from './mockData';

const STORAGE_KEY_RECORDS = 'gdqp_certificate_records_v1';
const STORAGE_KEY_STATUS = 'gdqp_sync_status_v1';
const STORAGE_KEY_APPS_SCRIPT_URL = 'gdqp_apps_script_url_v1';

// In-memory index: normalized MSSV -> CertificateRecord
const recordsIndex = new Map<string, CertificateRecord>();

export function getSavedAppsScriptUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_APPS_SCRIPT_URL) || '';
  } catch {
    return '';
  }
}

export function saveAppsScriptUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_APPS_SCRIPT_URL, url.trim());
  } catch (e) {
    console.error('Không thể lưu Apps Script URL:', e);
  }
}

export function getSyncStatus(): SyncStatus {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STATUS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Lỗi đọc sync status:', e);
  }

  // Default fallback status with demo data
  return {
    source: 'demo_data',
    totalRecords: INITIAL_DEMO_RECORDS.length,
    lastUpdated: new Date().toLocaleDateString('vi-VN'),
    fileCount: 3,
    fileNames: ['So_hoa_GDQP_K47_Dot1.xlsx', 'So_hoa_GDQP_K48_Dot2.xlsx', 'So_hoa_GDQP_K46_Dot_Vet.xlsx'],
    appsScriptUrl: getSavedAppsScriptUrl(),
  };
}

export function saveSyncStatus(status: SyncStatus): void {
  try {
    localStorage.setItem(STORAGE_KEY_STATUS, JSON.stringify(status));
  } catch (e) {
    console.error('Lỗi lưu sync status:', e);
  }
}

export function initStorage(): CertificateRecord[] {
  recordsIndex.clear();
  let loadedRecords: CertificateRecord[] = [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECORDS);
    if (raw) {
      loadedRecords = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Lỗi parse records từ LocalStorage:', e);
  }

  // If empty, seed with authentic demo records
  if (!loadedRecords || loadedRecords.length === 0) {
    loadedRecords = [...INITIAL_DEMO_RECORDS];
    saveRecords(loadedRecords, 'demo_data', ['So_hoa_GDQP_K47_Dot1.xlsx', 'So_hoa_GDQP_K48_Dot2.xlsx']);
  }

  // Build high-speed Map
  for (const record of loadedRecords) {
    if (record.mssv) {
      recordsIndex.set(record.mssv.trim().toUpperCase(), record);
    }
  }

  return loadedRecords;
}

export function saveRecords(
  records: CertificateRecord[],
  source: DataSourceType,
  fileNames: string[]
): void {
  recordsIndex.clear();
  for (const r of records) {
    if (r.mssv) {
      recordsIndex.set(r.mssv.trim().toUpperCase(), r);
    }
  }

  // Only store up to 1,500 records in LocalStorage as lightweight offline cache
  // Prevents browser thread freeze when handling 50,000 - 100,000 records
  try {
    const cacheSubset = records.slice(0, 1500);
    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(cacheSubset));
  } catch {
    // Graceful fallback: Cloud Firestore is the persistent source of truth
  }

  saveSyncStatus({
    source,
    totalRecords: records.length,
    lastUpdated: new Date().toLocaleString('vi-VN'),
    fileCount: fileNames.length,
    fileNames,
    appsScriptUrl: getSavedAppsScriptUrl(),
  });
}

/**
 * Get all loaded records as array
 */
export function getAllLoadedRecords(): CertificateRecord[] {
  return Array.from(recordsIndex.values());
}

/**
 * Append or update new records into local storage and index
 */
export function appendRecords(
  newRecords: CertificateRecord[],
  source: DataSourceType,
  fileName: string
): { total: number; added: number } {
  let added = 0;
  for (const r of newRecords) {
    if (r.mssv) {
      const clean = r.mssv.trim().toUpperCase();
      if (!recordsIndex.has(clean)) {
        added++;
      }
      recordsIndex.set(clean, r);
    }
  }

  // Safely update lightweight LocalStorage cache without freezing UI
  try {
    if (recordsIndex.size <= 1500) {
      const allRecords = Array.from(recordsIndex.values());
      localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(allRecords));
    } else {
      const recentSubset = Array.from(recordsIndex.values()).slice(-1500);
      localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(recentSubset));
    }
  } catch {
    // Quota reached, safe to ignore since Cloud Firestore holds the 100k database
  }

  const currentStatus = getSyncStatus();
  const existingFiles = Array.isArray(currentStatus.fileNames) ? currentStatus.fileNames : [];
  const updatedFiles = existingFiles.includes(fileName) ? existingFiles : [...existingFiles, fileName];

  saveSyncStatus({
    source,
    totalRecords: recordsIndex.size,
    lastUpdated: new Date().toLocaleString('vi-VN'),
    fileCount: updatedFiles.length,
    fileNames: updatedFiles,
    appsScriptUrl: getSavedAppsScriptUrl(),
  });

  return { total: recordsIndex.size, added };
}

/**
 * Clear all locally stored records
 */
export function clearAllLocalRecords(): void {
  recordsIndex.clear();
  try {
    localStorage.removeItem(STORAGE_KEY_RECORDS);
  } catch (e) {
    console.error('Lỗi xóa LocalStorage records:', e);
  }

  saveSyncStatus({
    source: 'demo_data',
    totalRecords: 0,
    lastUpdated: new Date().toLocaleString('vi-VN'),
    fileCount: 0,
    fileNames: [],
    appsScriptUrl: getSavedAppsScriptUrl(),
  });
}

/**
 * Cache an individual record into memory index
 */
export function cacheRecord(record: CertificateRecord): void {
  if (record && record.mssv) {
    recordsIndex.set(record.mssv.trim().toUpperCase(), record);
  }
}

/**
 * 100% Exact match lookup by MSSV (< 1ms)
 * Automatically trims whitespace and capitalizes query
 */
export function lookupByMssv(mssv: string): CertificateRecord | null {
  if (!mssv) return null;
  const cleanMssv = mssv.trim().toUpperCase();
  return recordsIndex.get(cleanMssv) || null;
}

/**
 * Get all loaded records count
 */
export function getLoadedCount(): number {
  return recordsIndex.size;
}

/**
 * Reset back to initial demo dataset
 */
export function resetToDemo(): CertificateRecord[] {
  saveRecords(
    INITIAL_DEMO_RECORDS,
    'demo_data',
    ['So_hoa_GDQP_K47_Dot1.xlsx', 'So_hoa_GDQP_K48_Dot2.xlsx', 'So_hoa_GDQP_K46_Dot_Vet.xlsx']
  );
  return INITIAL_DEMO_RECORDS;
}
