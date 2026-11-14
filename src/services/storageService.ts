import { CertificateRecord, SyncStatus, DataSourceType } from '../types/certificate';
import { INITIAL_DEMO_RECORDS } from './mockData';
import {
  saveRecordsToIndexedDb,
  loadRecordsFromIndexedDb,
  clearIndexedDbRecords,
} from './indexedDbCache';

const STORAGE_KEY_RECORDS = 'gdqp_certificate_records_v1';
const STORAGE_KEY_STATUS = 'gdqp_sync_status_v1';

// In-memory index: normalized MSSV -> CertificateRecord
const recordsIndex = new Map<string, CertificateRecord>();

function normalizeSearchText(str: string): string {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function getSyncStatus(): SyncStatus {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STATUS);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SyncStatus> & { source?: string };
      const normalizedSource: DataSourceType =
        parsed.source === 'demo_data' ? 'demo_data' : 'local_excel';
      return {
        source: normalizedSource,
        totalRecords: Number(parsed.totalRecords || 0),
        lastUpdated: String(parsed.lastUpdated || new Date().toLocaleDateString('vi-VN')),
        fileCount: Number(parsed.fileCount || 0),
        fileNames: Array.isArray(parsed.fileNames) ? parsed.fileNames : [],
      };
    }
  } catch (e) {
    console.error('Lỗi đọc sync status:', e);
  }

  return {
    source: 'demo_data',
    totalRecords: INITIAL_DEMO_RECORDS.length,
    lastUpdated: new Date().toLocaleDateString('vi-VN'),
    fileCount: 3,
    fileNames: ['So_hoa_GDQP_K47_Dot1.xlsx', 'So_hoa_GDQP_K48_Dot2.xlsx', 'So_hoa_GDQP_K46_Dot_Vet.xlsx'],
  };
}

export function saveSyncStatus(status: SyncStatus): void {
  try {
    const clean: SyncStatus = {
      source: status.source === 'demo_data' ? 'demo_data' : 'local_excel',
      totalRecords: Number(status.totalRecords || 0),
      lastUpdated: String(status.lastUpdated || new Date().toLocaleString('vi-VN')),
      fileCount: Number(status.fileCount || 0),
      fileNames: Array.isArray(status.fileNames) ? status.fileNames : [],
    };
    localStorage.setItem(STORAGE_KEY_STATUS, JSON.stringify(clean));
  } catch (e) {
    console.error('Lỗi lưu sync status:', e);
  }
}

export function initStorage(): CertificateRecord[] {
  recordsIndex.clear();
  let loadedRecords: CertificateRecord[] = [];
  const currentStatus = getSyncStatus();

  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECORDS);
    if (raw) {
      loadedRecords = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Lỗi parse records từ LocalStorage:', e);
  }

  if ((!loadedRecords || loadedRecords.length === 0) && currentStatus.source === 'demo_data') {
    loadedRecords = [...INITIAL_DEMO_RECORDS];
    saveRecords(loadedRecords, 'demo_data', ['So_hoa_GDQP_K47_Dot1.xlsx', 'So_hoa_GDQP_K48_Dot2.xlsx']);
  }

  for (const record of loadedRecords) {
    if (record.mssv) {
      recordsIndex.set(record.mssv.trim().toUpperCase(), record);
    }
  }

  return loadedRecords;
}

/**
 * Nạp toàn bộ bản ghi từ IndexedDB vào RAM (không bị giới hạn 1.500 dòng như localStorage)
 */
export async function hydrateFromIndexedDb(): Promise<number> {
  const cached = await loadRecordsFromIndexedDb();
  if (cached && cached.length > 0) {
    for (const r of cached) {
      if (r.mssv) {
        recordsIndex.set(r.mssv.trim().toUpperCase(), r);
      }
    }
  }
  return recordsIndex.size;
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

  try {
    const cacheSubset = records.slice(0, 1500);
    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(cacheSubset));
  } catch {
    // Graceful fallback
  }

  // Persist full dataset (up to 100k+ records) in IndexedDB
  saveRecordsToIndexedDb(records).catch(console.warn);

  saveSyncStatus({
    source,
    totalRecords: records.length,
    lastUpdated: new Date().toLocaleString('vi-VN'),
    fileCount: fileNames.length,
    fileNames,
  });
}

export function getAllLoadedRecords(): CertificateRecord[] {
  return Array.from(recordsIndex.values());
}

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

  const allRecords = Array.from(recordsIndex.values());
  try {
    if (allRecords.length <= 1500) {
      localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(allRecords));
    } else {
      localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(allRecords.slice(-1500)));
    }
  } catch {
    // Quota reached
  }

  saveRecordsToIndexedDb(allRecords).catch(console.warn);

  const currentStatus = getSyncStatus();
  const existingFiles = Array.isArray(currentStatus.fileNames) ? currentStatus.fileNames : [];
  const updatedFiles = existingFiles.includes(fileName) ? existingFiles : [...existingFiles, fileName];

  saveSyncStatus({
    source,
    totalRecords: recordsIndex.size,
    lastUpdated: new Date().toLocaleString('vi-VN'),
    fileCount: updatedFiles.length,
    fileNames: updatedFiles,
  });

  return { total: recordsIndex.size, added };
}

export function clearAllLocalRecords(): void {
  recordsIndex.clear();
  try {
    localStorage.removeItem(STORAGE_KEY_RECORDS);
  } catch (e) {
    console.error('Lỗi xóa LocalStorage records:', e);
  }
  clearIndexedDbRecords().catch(console.warn);

  saveSyncStatus({
    source: 'local_excel',
    totalRecords: 0,
    lastUpdated: new Date().toLocaleString('vi-VN'),
    fileCount: 0,
    fileNames: [],
  });
}

export function cacheRecord(record: CertificateRecord): void {
  if (record && record.mssv) {
    recordsIndex.set(record.mssv.trim().toUpperCase(), record);
  }
}

export function removeLocalRecord(mssv: string, newCloudTotal?: number): void {
  if (!mssv) return;
  const cleanMssv = mssv.trim().toUpperCase();
  recordsIndex.delete(cleanMssv);

  try {
    const subset = Array.from(recordsIndex.values()).slice(-1500);
    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(subset));
  } catch {
    // ignore
  }

  const currentStatus = getSyncStatus();
  saveSyncStatus({
    ...currentStatus,
    totalRecords: typeof newCloudTotal === 'number' ? newCloudTotal : recordsIndex.size,
    lastUpdated: new Date().toLocaleString('vi-VN'),
  });
}

/**
 * 100% Exact match lookup by MSSV (< 1ms)
 */
export function lookupByMssv(mssv: string): CertificateRecord | null {
  if (!mssv) return null;
  const cleanMssv = mssv.trim().toUpperCase();
  return recordsIndex.get(cleanMssv) || null;
}

/**
 * Tìm kiếm theo MSSV hoặc Họ và tên (không phân biệt dấu)
 */
export function lookupByMssvOrName(queryText: string): CertificateRecord[] {
  const raw = queryText.trim();
  if (!raw) return [];

  const exactMssv = recordsIndex.get(raw.toUpperCase());
  if (exactMssv) return [exactMssv];

  const normQuery = normalizeSearchText(raw);
  const matches: CertificateRecord[] = [];
  for (const rec of recordsIndex.values()) {
    const normName = normalizeSearchText(rec.hoVaTen || '');
    const normMssv = normalizeSearchText(rec.mssv || '');
    if (normMssv === normQuery || normName.includes(normQuery)) {
      matches.push(rec);
    }
    if (matches.length >= 20) break;
  }
  return matches;
}

export function getLoadedCount(): number {
  return recordsIndex.size;
}

export function resetToDemo(): CertificateRecord[] {
  saveRecords(
    INITIAL_DEMO_RECORDS,
    'demo_data',
    ['So_hoa_GDQP_K47_Dot1.xlsx', 'So_hoa_GDQP_K48_Dot2.xlsx', 'So_hoa_GDQP_K46_Dot_Vet.xlsx']
  );
  return INITIAL_DEMO_RECORDS;
}
