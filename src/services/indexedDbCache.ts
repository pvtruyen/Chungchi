import { CertificateRecord } from '../types/certificate';

const DB_NAME = 'gdqp_ctu_records_cache_v1';
const DB_VERSION = 1;
const STORE_NAME = 'certificates';
const CACHE_KEY = 'active_dataset';

function openCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB không khả dụng trên trình duyệt này'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Lỗi mở IndexedDB'));
  });
}

export async function saveRecordsToIndexedDb(records: CertificateRecord[]): Promise<void> {
  try {
    const db = await openCacheDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(records, CACHE_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('Không thể lưu bộ nhớ đệm IndexedDB:', err);
  }
}

export async function loadRecordsFromIndexedDb(): Promise<CertificateRecord[]> {
  try {
    const db = await openCacheDb();
    return await new Promise<CertificateRecord[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(CACHE_KEY);
      req.onsuccess = () => {
        db.close();
        const data = req.result;
        resolve(Array.isArray(data) ? (data as CertificateRecord[]) : []);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

export async function clearIndexedDbRecords(): Promise<void> {
  try {
    const db = await openCacheDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(CACHE_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // ignore
  }
}
