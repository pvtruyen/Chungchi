import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  deleteDoc,
  writeBatch, 
  collection, 
  getDocs,
  getCountFromServer,
  limit,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';
import { CertificateRecord, SyncStatus, DataSourceType, SearchHistoryItem } from '../types/certificate';
import { INITIAL_DEMO_RECORDS } from './mockData';

// Get or initialize singleton app
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with specific databaseId if provided
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

const COLLECTION_CERTIFICATES = 'gdqp_certificates';
const COLLECTION_META = 'gdqp_meta';
const COLLECTION_HISTORY = 'gdqp_search_history';
const DOC_STATUS = 'status';

/**
 * Fetch a single certificate record from Cloud Firestore by MSSV
 * Works from ANY IP, ANY device, ANY browser without needing local upload!
 */
export async function fetchRecordFromCloud(mssv: string): Promise<CertificateRecord | null> {
  if (!mssv) return null;
  const cleanMssv = mssv.trim().toUpperCase();

  try {
    const docRef = doc(db, COLLECTION_CERTIFICATES, cleanMssv);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      return snap.data() as CertificateRecord;
    }
    return null;
  } catch (error) {
    console.warn(`Lỗi truy vấn Firestore cho MSSV ${cleanMssv}:`, error);
    return null;
  }
}

/**
 * Fetch the global sync metadata from Cloud Firestore
 */
export async function fetchCloudSyncStatus(): Promise<SyncStatus | null> {
  try {
    const docRef = doc(db, COLLECTION_META, DOC_STATUS);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as SyncStatus;
    }
    return null;
  } catch (error) {
    console.warn('Lỗi đọc siêu dữ liệu từ Firestore:', error);
    return null;
  }
}

/**
 * Efficiently commit multiple Firestore batches in parallel with a concurrency pool.
 * Yields execution to the browser thread between batches so the UI stays responsive and never freezes.
 */
async function commitBatchesWithConcurrency(
  records: CertificateRecord[],
  prefixMessage: string,
  onProgress?: (message: string, percent: number) => void
): Promise<number> {
  const BATCH_SIZE = 450;
  const CONCURRENCY = 4; // Commit 4 batches simultaneously for 4x speedup
  const total = records.length;

  const batches: { batch: ReturnType<typeof writeBatch>; count: number }[] = [];
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const record of chunk) {
      if (!record.mssv) continue;
      const cleanMssv = record.mssv.trim().toUpperCase();
      const docRef = doc(db, COLLECTION_CERTIFICATES, cleanMssv);
      batch.set(docRef, {
        ...record,
        mssv: cleanMssv,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }
    batches.push({ batch, count: chunk.length });
  }

  let uploaded = 0;
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const group = batches.slice(i, i + CONCURRENCY);
    await Promise.all(group.map(g => g.batch.commit()));
    uploaded += group.reduce((sum, g) => sum + g.count, 0);

    const pct = Math.min(95, Math.round((uploaded / total) * 90));
    if (onProgress) {
      onProgress(`${prefixMessage}: ${uploaded.toLocaleString('vi-VN')}/${total.toLocaleString('vi-VN')} chứng chỉ...`, pct);
    }
    // Yield to browser event loop to keep UI smooth and prevent freeze
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return uploaded;
}

/**
 * Save an array of certificate records to Cloud Firestore
 * Uses parallel batch writes (4 batches at a time) to efficiently store large datasets
 */
export async function saveRecordsToCloud(
  records: CertificateRecord[],
  source: DataSourceType,
  fileNames: string[],
  onProgress?: (message: string, percent: number) => void
): Promise<{ success: boolean; totalUploaded: number; error?: string }> {
  if (!records || records.length === 0) {
    return { success: false, totalUploaded: 0, error: 'Không có dữ liệu chứng chỉ để lưu.' };
  }

  try {
    const total = records.length;
    const uploaded = await commitBatchesWithConcurrency(
      records,
      'Đang lưu lên đám mây',
      onProgress
    );

    // Save global sync status metadata to Firestore
    const statusData: SyncStatus = {
      source,
      totalRecords: total,
      lastUpdated: new Date().toLocaleString('vi-VN'),
      fileCount: fileNames.length,
      fileNames,
    };

    await setDoc(doc(db, COLLECTION_META, DOC_STATUS), statusData, { merge: true });

    if (onProgress) {
      onProgress(`Đã lưu trữ vĩnh viễn ${uploaded.toLocaleString('vi-VN')} chứng chỉ lên đám mây!`, 100);
    }

    return { success: true, totalUploaded: uploaded };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi không xác định khi lưu Firestore';
    console.error('Lỗi lưu trữ dữ liệu lên Firestore:', err);
    return { success: false, totalUploaded: 0, error: msg };
  }
}

/**
 * Append records from an individual Excel file to Cloud Firestore without wiping existing ones.
 * Updates the global file list and total count.
 */
export async function appendRecordsToCloud(
  records: CertificateRecord[],
  source: DataSourceType,
  fileName: string,
  onProgress?: (message: string, percent: number) => void
): Promise<{ success: boolean; totalUploaded: number; totalInCloud: number; error?: string }> {
  if (!records || records.length === 0) {
    return { success: false, totalUploaded: 0, totalInCloud: 0, error: 'Không có dữ liệu chứng chỉ để lưu.' };
  }

  try {
    const uploaded = await commitBatchesWithConcurrency(
      records,
      `Đang nạp file [${fileName}]`,
      onProgress
    );

    // Fetch existing metadata to append file name and update count
    const existingMeta = await fetchCloudSyncStatus();
    const existingFiles = existingMeta && Array.isArray(existingMeta.fileNames) ? existingMeta.fileNames : [];
    const updatedFiles = existingFiles.includes(fileName) ? existingFiles : [...existingFiles, fileName];

    // Ultra-fast server aggregation count without downloading document payloads
    let totalInCloud = 0;
    try {
      const countSnap = await getCountFromServer(collection(db, COLLECTION_CERTIFICATES));
      totalInCloud = countSnap.data().count;
    } catch {
      totalInCloud = (existingMeta?.totalRecords || 0) + uploaded;
    }

    const statusData: SyncStatus = {
      source,
      totalRecords: totalInCloud,
      lastUpdated: new Date().toLocaleString('vi-VN'),
      fileCount: updatedFiles.length,
      fileNames: updatedFiles,
    };

    await setDoc(doc(db, COLLECTION_META, DOC_STATUS), statusData, { merge: true });

    if (onProgress) {
      onProgress(`Đã nạp thành công ${uploaded} chứng chỉ từ file ${fileName} (Tổng hệ thống: ${totalInCloud})!`, 100);
    }

    return { success: true, totalUploaded: uploaded, totalInCloud };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi không xác định khi lưu Firestore';
    console.error('Lỗi nạp file vào Firestore:', err);
    return { success: false, totalUploaded: 0, totalInCloud: 0, error: msg };
  }
}

/**
 * Delete all certificate records stored on Cloud Firestore
 */
export async function clearAllCertificatesFromCloud(
  onProgress?: (message: string, percent: number) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    if (onProgress) onProgress('Đang tải danh sách tài liệu cần xóa trên Cloud...', 10);
    const snap = await getDocs(collection(db, COLLECTION_CERTIFICATES));
    const total = snap.docs.length;

    if (total > 0) {
      const BATCH_SIZE = 450;
      let deleted = 0;

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const chunk = snap.docs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const docSnap of chunk) {
          batch.delete(docSnap.ref);
        }

        await batch.commit();
        deleted += chunk.length;

        const pct = Math.min(95, Math.round((deleted / total) * 90));
        if (onProgress) {
          onProgress(`Đang xóa tài liệu đám mây: ${deleted}/${total}...`, pct);
        }
      }
    }

    // Reset meta status document
    const emptyStatus: SyncStatus = {
      source: 'demo_data',
      totalRecords: 0,
      lastUpdated: new Date().toLocaleString('vi-VN'),
      fileCount: 0,
      fileNames: [],
    };
    await setDoc(doc(db, COLLECTION_META, DOC_STATUS), emptyStatus);

    if (onProgress) onProgress('Đã xóa sạch toàn bộ danh sách chứng chỉ trên Cloud Firebase!', 100);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi khi xóa tài liệu Firestore';
    console.error('Lỗi xóa Firestore:', err);
    return { success: false, error: msg };
  }
}

/**
 * Seed initial sample data to cloud if collection is empty
 */
export async function seedCloudIfEmpty(): Promise<boolean> {
  try {
    const q = query(collection(db, COLLECTION_CERTIFICATES), limit(1));
    const snap = await getDocs(q);

    if (snap.empty) {
      console.log('Khởi tạo dữ liệu mẫu lần đầu lên Cloud Firestore...');
      await saveRecordsToCloud(
        INITIAL_DEMO_RECORDS,
        'demo_data',
        ['So_hoa_GDQP_K47_Dot1.xlsx', 'So_hoa_GDQP_K48_Dot2.xlsx']
      );
      return true;
    }
    return false;
  } catch (e) {
    console.warn('Lỗi kiểm tra seed Firestore:', e);
    return false;
  }
}

/**
 * Record a search event to Cloud Firestore history
 * Allows issuance officers to see live student lookups
 */
export async function recordSearchEvent(
  record: CertificateRecord | null,
  searchedMssv: string
): Promise<void> {
  const cleanMssv = searchedMssv.trim().toUpperCase();
  const now = new Date();
  const id = `hist_${Date.now()}_${cleanMssv}`;

  const timeFormatted = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + 
    ' - ' + now.toLocaleDateString('vi-VN');

  const historyItem: SearchHistoryItem = record
    ? {
        id,
        mssv: record.mssv,
        hoVaTen: record.hoVaTen,
        stt: record.stt,
        ngayCap: record.ngayCap,
        soHieuChungChi: record.soHieuChungChi,
        soVaoSoGoc: record.soVaoSoGoc,
        tenChungChi: record.tenChungChi,
        donViCap: record.donViCap,
        khoaHoc: record.khoaHoc,
        nganhDaoTao: record.nganhDaoTao,
        ngaySinh: record.ngaySinh,
        noiSinh: record.noiSinh,
        gioiTinh: record.gioiTinh,
        danToc: record.danToc,
        xepLoai: record.xepLoai,
        fileName: record.fileName,
        timestamp: now.toISOString(),
        timeFormatted,
        daPhat: false,
        status: 'found',
      }
    : {
        id,
        mssv: cleanMssv,
        hoVaTen: 'Không tìm thấy hồ sơ',
        stt: '-',
        ngayCap: '-',
        soHieuChungChi: '-',
        soVaoSoGoc: '-',
        timestamp: now.toISOString(),
        timeFormatted,
        daPhat: false,
        status: 'not_found',
      };

  try {
    await setDoc(doc(db, COLLECTION_HISTORY, id), historyItem);
  } catch (err) {
    console.warn('Lỗi lưu lịch sử tra cứu lên Firestore:', err);
  }
}

/**
 * Subscribe to real-time search history for the issuance officer
 */
export function subscribeSearchHistory(
  callback: (items: SearchHistoryItem[]) => void,
  limitCount: number = 80
): () => void {
  try {
    const q = query(
      collection(db, COLLECTION_HISTORY),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const items: SearchHistoryItem[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as SearchHistoryItem);
        });
        callback(items);
      },
      (error) => {
        console.warn('Lỗi lắng nghe lịch sử tra cứu Firestore:', error);
      }
    );
  } catch (e) {
    console.warn('Lỗi khởi tạo listener lịch sử tra cứu:', e);
    return () => {};
  }
}

/**
 * Toggle "Đã phát chứng chỉ" status for an issuance officer
 */
export async function toggleHistoryDaPhat(
  historyId: string,
  currentStatus: boolean
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_HISTORY, historyId);
    const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN');
    await updateDoc(docRef, {
      daPhat: !currentStatus,
      ngayPhat: !currentStatus ? now : null,
    });
  } catch (err) {
    console.error('Lỗi cập nhật trạng thái đã phát bằng:', err);
    throw err;
  }
}

/**
 * Delete a single search history item
 */
export async function deleteHistoryItem(historyId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTION_HISTORY, historyId));
  } catch (err) {
    console.error('Lỗi xóa mục lịch sử:', err);
    throw err;
  }
}

/**
 * Clear all search history items
 */
export async function clearAllSearchHistory(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, COLLECTION_HISTORY));
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (err) {
    console.error('Lỗi xóa toàn bộ lịch sử:', err);
    throw err;
  }
}
