import {
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
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import {
  db,
  auth,
  getCurrentDbQuotaKey,
  resetFirestoreWriteStream,
  isUsingCustomFirebaseConfig,
} from './firebaseConfig';
import { CertificateRecord, SyncStatus, DataSourceType, SearchHistoryItem } from '../types/certificate';
import { INITIAL_DEMO_RECORDS } from './mockData';

const COLLECTION_CERTIFICATES = 'gdqp_certificates';
const COLLECTION_META = 'gdqp_meta';
const COLLECTION_HISTORY = 'gdqp_search_history';
const DOC_STATUS = 'status';
const LOCAL_HISTORY_STORAGE_KEY = 'gdqp_local_search_history_v1';

export const FIRESTORE_QUOTA_CONSOLE_URL =
  'https://console.firebase.google.com/project/gen-lang-client-0366484892/firestore/databases/ai-studio-tracuchngchgdqpa-66e93f04-989f-486c-ac2f-e76374fe18b0/data?openUpgradeDialog=true';

export const FIRESTORE_PRICING_URL = 'https://firebase.google.com/pricing#cloud-firestore';

const quotaListeners = new Set<(exhausted: boolean) => void>();

export function isQuotaExceededError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const code = (error as { code?: string } | null)?.code?.toLowerCase() || '';
  return (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('quota limit exceeded') ||
    msg.includes('free daily write units') ||
    msg.includes('__write_backoff_stalled__')
  );
}

export function hasFirestoreWriteQuotaExceeded(): boolean {
  try {
    return localStorage.getItem(getCurrentDbQuotaKey()) === '1';
  } catch {
    return false;
  }
}

export function markFirestoreWriteQuotaExceeded(): void {
  try {
    localStorage.setItem(getCurrentDbQuotaKey(), '1');
  } catch {
    // ignore
  }
  quotaListeners.forEach((cb) => cb(true));
}

export function resetFirestoreWriteQuotaFlag(): void {
  try {
    localStorage.removeItem(getCurrentDbQuotaKey());
  } catch {
    // ignore
  }
  quotaListeners.forEach((cb) => cb(false));
}

export function onFirestoreQuotaStatusChange(cb: (exhausted: boolean) => void): () => void {
  quotaListeners.add(cb);
  return () => {
    quotaListeners.delete(cb);
  };
}

export const QUOTA_EXCEEDED_VI_MESSAGE =
  'Đã vượt giới hạn lượt ghi miễn phí trong ngày (Free daily write units — Quota exceeded) của cơ sở dữ liệu Firestore mặc định. Hạn mức sẽ tự động đặt lại vào ngày mai. Bạn vẫn có thể tra cứu dữ liệu hiện có, chuyển sang Chế độ 2 (Google Drive), hoặc dán firebaseConfig của dự án cá nhân trong Cài đặt.';

/**
 * Chạy thao tác ghi Firestore với cơ chế phát hiện nhanh lỗi Quota / WriteStream backoff
 * và ngắt WriteStream kịp thời để không bị treo hoặc lặp log lỗi liên tục.
 */
async function runWriteWithQuotaGuard<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 8000
): Promise<T> {
  if (hasFirestoreWriteQuotaExceeded()) {
    throw new Error(QUOTA_EXCEEDED_VI_MESSAGE);
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error('__WRITE_BACKOFF_STALLED__'));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([operation(), timeoutPromise]);
    return result;
  } catch (err: unknown) {
    const isStalled =
      err instanceof Error && err.message.includes('__WRITE_BACKOFF_STALLED__');
    if (isStalled || isQuotaExceededError(err)) {
      markFirestoreWriteQuotaExceeded();
      await resetFirestoreWriteStream();
      throw new Error(QUOTA_EXCEEDED_VI_MESSAGE);
    }
    throw err;
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

export function getLocalSearchHistory(): SearchHistoryItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SearchHistoryItem[]) : [];
  } catch {
    return [];
  }
}

function saveLocalSearchHistoryItem(item: SearchHistoryItem): void {
  try {
    const current = getLocalSearchHistory().filter((x) => x.id !== item.id);
    const updated = [item, ...current].slice(0, 200);
    localStorage.setItem(LOCAL_HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage quota
  }
}

export function clearLocalSearchHistory(): void {
  try {
    localStorage.removeItem(LOCAL_HISTORY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Chuẩn hóa đối tượng chứng chỉ trước khi ghi lên Firestore (loại bỏ undefined, khớp 100% Firestore Rules)
 */
function normalizeRecordForFirestore(record: CertificateRecord): Record<string, unknown> {
  const cleanMssv = record.mssv.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  return {
    id: String(record.id || cleanMssv).slice(0, 128),
    stt: record.stt !== undefined && record.stt !== null ? record.stt : '',
    soHieuChungChi: String(record.soHieuChungChi || '').trim().slice(0, 100),
    soVaoSoGoc: String(record.soVaoSoGoc || '').trim().slice(0, 100),
    tenChungChi: String(record.tenChungChi || 'Chứng chỉ Giáo dục Quốc phòng và An ninh').slice(0, 200),
    hoVaTen: String(record.hoVaTen || '').trim().slice(0, 150),
    mssv: cleanMssv.slice(0, 64),
    ngaySinh: String(record.ngaySinh || '').trim().slice(0, 50),
    noiSinh: String(record.noiSinh || '').trim().slice(0, 150),
    gioiTinh: String(record.gioiTinh || '').trim().slice(0, 30),
    danToc: String(record.danToc || '').trim().slice(0, 50),
    khoaHoc: String(record.khoaHoc || '').trim().slice(0, 100),
    nganhDaoTao: String(record.nganhDaoTao || '').trim().slice(0, 150),
    xepLoai: String(record.xepLoai || '').trim().slice(0, 60),
    ngayCap: String(record.ngayCap || '').trim().slice(0, 60),
    donViCap: String(record.donViCap || 'Trung tâm GDQP&AN - Đại học Cần Thơ').slice(0, 200),
    fileName: String(record.fileName || '').slice(0, 255),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Tra cứu 1 chứng chỉ từ Cloud Firestore theo MSSV (Khách / Sinh viên dùng công khai)
 */
export async function fetchRecordFromCloud(mssv: string): Promise<CertificateRecord | null> {
  if (!mssv) return null;
  const cleanMssv = mssv.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!cleanMssv) return null;

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
 * Đọc siêu dữ liệu đồng bộ từ Cloud Firestore
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
 * Lưu cấu hình chế độ & Link Apps Script lên Firestore (gdqp_meta/status)
 * để mọi máy tính / trình duyệt khác tự động nhận cấu hình khi truy cập.
 */
export async function saveCloudSyncStatus(
  status: SyncStatus
): Promise<{ success: boolean; needsAuth?: boolean; error?: string }> {
  if (!auth.currentUser) {
    return {
      success: false,
      needsAuth: true,
      error: 'Cần đăng nhập Google Admin (Firebase Auth) để đồng bộ cấu hình sang các máy khác.',
    };
  }

  const payload: Record<string, unknown> = {
    source: String(status.source || 'local_excel').slice(0, 50),
    totalRecords: Number(status.totalRecords || 0),
    lastUpdated: String(status.lastUpdated || new Date().toLocaleString('vi-VN')).slice(0, 64),
    fileCount: Number(status.fileCount || 0),
    fileNames: Array.isArray(status.fileNames)
      ? status.fileNames.slice(0, 500).map((fn) => String(fn).slice(0, 255))
      : [],
    driveFolderFound: Boolean(status.driveFolderFound),
  };

  if (status.appsScriptUrl && status.appsScriptUrl.trim()) {
    payload.appsScriptUrl = status.appsScriptUrl.trim().slice(0, 500);
  }

  try {
    await runWriteWithQuotaGuard(
      () => setDoc(doc(db, COLLECTION_META, DOC_STATUS), payload, { merge: true }),
      8000
    );
    return { success: true };
  } catch (err: unknown) {
    if (isQuotaExceededError(err)) {
      markFirestoreWriteQuotaExceeded();
      return { success: false, error: QUOTA_EXCEEDED_VI_MESSAGE };
    }
    const rawMsg = err instanceof Error ? err.message : String(err);
    const isPermError = rawMsg.toLowerCase().includes('permission') || rawMsg.toLowerCase().includes('insufficient');
    return {
      success: false,
      needsAuth: isPermError,
      error: isPermError
        ? 'Tài khoản hiện tại chưa được cấp quyền ghi cấu hình lên Firestore (kiểm tra email Admin hoặc Firestore Rules).'
        : rawMsg,
    };
  }
}

/**
 * Lấy danh sách chứng chỉ trên Cloud Firestore phục vụ Cán bộ quản lý & xóa từng dòng
 */
export async function fetchCertificatesForAdmin(
  limitCount: number = 50,
  mssvPrefix: string = ''
): Promise<CertificateRecord[]> {
  try {
    const cleanPrefix = mssvPrefix.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const colRef = collection(db, COLLECTION_CERTIFICATES);

    const q = cleanPrefix
      ? query(
          colRef,
          where('mssv', '>=', cleanPrefix),
          where('mssv', '<=', cleanPrefix + '\uf8ff'),
          orderBy('mssv'),
          limit(limitCount)
        )
      : query(
          colRef,
          where('mssv', '>=', ''),
          where('mssv', '<=', '\uf8ff'),
          orderBy('mssv'),
          limit(limitCount)
        );

    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as CertificateRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_CERTIFICATES);
  }
}

/**
 * Đếm tổng số chứng chỉ hiện có trên Cloud bằng aggregation server (cực nhanh)
 */
async function countCertificatesOnCloud(): Promise<number> {
  const q = query(
    collection(db, COLLECTION_CERTIFICATES),
    where('mssv', '>=', ''),
    where('mssv', '<=', '\uf8ff')
  );
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

/**
 * Ghi song song nhiều lô Batch (tối đa 450 bản ghi/lô, chạy 4 lô cùng lúc)
 */
async function commitBatchesWithConcurrency(
  records: CertificateRecord[],
  prefixMessage: string,
  onProgress?: (message: string, percent: number) => void
): Promise<number> {
  const BATCH_SIZE = 450;
  const CONCURRENCY = 4;

  // Khử trùng MSSV ngay trong tập dữ liệu đầu vào trước khi gửi batch
  const dedupMap = new Map<string, CertificateRecord>();
  for (const r of records) {
    if (!r.mssv) continue;
    const clean = r.mssv.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (clean) {
      dedupMap.set(clean, { ...r, mssv: clean });
    }
  }
  const uniqueRecords = Array.from(dedupMap.values());
  const total = uniqueRecords.length;
  if (total === 0) return 0;

  const batches: { batch: ReturnType<typeof writeBatch>; count: number }[] = [];
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const chunk = uniqueRecords.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const record of chunk) {
      const normalized = normalizeRecordForFirestore(record);
      const docRef = doc(db, COLLECTION_CERTIFICATES, normalized.mssv as string);
      batch.set(docRef, normalized, { merge: true });
    }
    batches.push({ batch, count: chunk.length });
  }

  if (hasFirestoreWriteQuotaExceeded()) {
    throw new Error(QUOTA_EXCEEDED_VI_MESSAGE);
  }

  let uploaded = 0;
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const group = batches.slice(i, i + CONCURRENCY);
    await runWriteWithQuotaGuard(
      () => Promise.all(group.map((g) => g.batch.commit())),
      15000
    );
    uploaded += group.reduce((sum, g) => sum + g.count, 0);

    const pct = Math.min(95, Math.round((uploaded / total) * 90));
    if (onProgress) {
      onProgress(
        `${prefixMessage}: ${uploaded.toLocaleString('vi-VN')}/${total.toLocaleString('vi-VN')} chứng chỉ...`,
        pct
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return uploaded;
}

/**
 * Lưu mảng chứng chỉ lên Cloud Firestore
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
    const uploaded = await commitBatchesWithConcurrency(records, 'Đang lưu lên đám mây', onProgress);

    let totalInCloud = uploaded;
    try {
      totalInCloud = await countCertificatesOnCloud();
    } catch {
      totalInCloud = uploaded;
    }

    const statusData: SyncStatus = {
      source,
      totalRecords: totalInCloud,
      lastUpdated: new Date().toLocaleString('vi-VN'),
      fileCount: fileNames.length,
      fileNames: fileNames.slice(0, 500),
    };

    await runWriteWithQuotaGuard(
      () => setDoc(doc(db, COLLECTION_META, DOC_STATUS), statusData, { merge: true }),
      8000
    );

    if (onProgress) {
      onProgress(`Đã lưu trữ vĩnh viễn ${uploaded.toLocaleString('vi-VN')} chứng chỉ lên đám mây!`, 100);
    }

    return { success: true, totalUploaded: uploaded };
  } catch (err: unknown) {
    if (isQuotaExceededError(err)) {
      markFirestoreWriteQuotaExceeded();
      return { success: false, totalUploaded: 0, error: QUOTA_EXCEEDED_VI_MESSAGE };
    }
    try {
      handleFirestoreError(err, OperationType.WRITE, COLLECTION_CERTIFICATES);
    } catch (formattedErr: unknown) {
      const msg = formattedErr instanceof Error ? formattedErr.message : 'Lỗi không xác định khi lưu Firestore';
      return { success: false, totalUploaded: 0, error: msg };
    }
  }
}

/**
 * Cộng dồn (Append) dữ liệu từ file Excel mới vào Cloud Firestore mà không ghi đè dữ liệu cũ.
 * Thống kê chính xác số lượng bản ghi thêm mới vs cập nhật trùng MSSV.
 */
export async function appendRecordsToCloud(
  records: CertificateRecord[],
  source: DataSourceType,
  fileName: string,
  onProgress?: (message: string, percent: number) => void
): Promise<{
  success: boolean;
  totalUploaded: number;
  newlyAddedCount: number;
  updatedDuplicateCount: number;
  totalInCloud: number;
  error?: string;
}> {
  if (!records || records.length === 0) {
    return {
      success: false,
      totalUploaded: 0,
      newlyAddedCount: 0,
      updatedDuplicateCount: 0,
      totalInCloud: 0,
      error: 'Không có dữ liệu chứng chỉ để lưu.',
    };
  }

  try {
    let countBefore = 0;
    try {
      countBefore = await countCertificatesOnCloud();
    } catch {
      const meta = await fetchCloudSyncStatus();
      countBefore = meta?.totalRecords || 0;
    }

    const uploaded = await commitBatchesWithConcurrency(
      records,
      `Đang nạp file [${fileName}]`,
      onProgress
    );

    const existingMeta = await fetchCloudSyncStatus();
    const existingFiles =
      existingMeta && Array.isArray(existingMeta.fileNames) ? existingMeta.fileNames : [];
    const updatedFiles = (existingFiles.includes(fileName)
      ? existingFiles
      : [...existingFiles, fileName]
    ).slice(0, 500);

    let totalInCloud = countBefore + uploaded;
    try {
      totalInCloud = await countCertificatesOnCloud();
    } catch {
      totalInCloud = countBefore + uploaded;
    }

    const newlyAddedCount = Math.max(0, totalInCloud - countBefore);
    const updatedDuplicateCount = Math.max(0, uploaded - newlyAddedCount);

    const statusData: SyncStatus = {
      source,
      totalRecords: totalInCloud,
      lastUpdated: new Date().toLocaleString('vi-VN'),
      fileCount: updatedFiles.length,
      fileNames: updatedFiles,
    };

    await runWriteWithQuotaGuard(
      () => setDoc(doc(db, COLLECTION_META, DOC_STATUS), statusData, { merge: true }),
      8000
    );

    if (onProgress) {
      onProgress(
        `Đã nạp ${uploaded.toLocaleString('vi-VN')} chứng chỉ từ [${fileName}] (Thêm mới: ${newlyAddedCount}, Cập nhật trùng: ${updatedDuplicateCount})!`,
        100
      );
    }

    return {
      success: true,
      totalUploaded: uploaded,
      newlyAddedCount,
      updatedDuplicateCount,
      totalInCloud,
    };
  } catch (err: unknown) {
    if (isQuotaExceededError(err)) {
      markFirestoreWriteQuotaExceeded();
      return {
        success: false,
        totalUploaded: 0,
        newlyAddedCount: 0,
        updatedDuplicateCount: 0,
        totalInCloud: 0,
        error: QUOTA_EXCEEDED_VI_MESSAGE,
      };
    }
    const rawMsg = err instanceof Error ? err.message : String(err);
    const isPermError = rawMsg.toLowerCase().includes('permission') || rawMsg.toLowerCase().includes('insufficient');
    const friendlyError = isPermError
      ? 'Chưa đủ quyền ghi lên Firestore. Vui lòng đăng nhập tài khoản Cán bộ Quản trị (Firebase Auth) để thực hiện thao tác này.'
      : rawMsg;
    console.error('Lỗi nạp file vào Firestore:', err);
    return {
      success: false,
      totalUploaded: 0,
      newlyAddedCount: 0,
      updatedDuplicateCount: 0,
      totalInCloud: 0,
      error: friendlyError,
    };
  }
}

/**
 * Xóa 01 dòng chứng chỉ cụ thể trên Cloud Firestore (Yêu cầu quyền Cán bộ Admin)
 */
export async function deleteRecordFromCloud(mssv: string): Promise<{ success: boolean; totalInCloud: number; error?: string }> {
  const cleanMssv = mssv.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!cleanMssv) {
    return { success: false, totalInCloud: 0, error: 'MSSV không hợp lệ.' };
  }

  try {
    await runWriteWithQuotaGuard(
      () => deleteDoc(doc(db, COLLECTION_CERTIFICATES, cleanMssv)),
      8000
    );

    const existingMeta = await fetchCloudSyncStatus();
    let totalInCloud = Math.max(0, (existingMeta?.totalRecords || 1) - 1);
    try {
      totalInCloud = await countCertificatesOnCloud();
    } catch {
      // keep fallback count
    }

    const updatedStatus: SyncStatus = {
      source: existingMeta?.source || 'local_excel',
      totalRecords: totalInCloud,
      lastUpdated: new Date().toLocaleString('vi-VN'),
      fileCount: existingMeta?.fileCount || 0,
      fileNames: existingMeta?.fileNames || [],
    };
    await runWriteWithQuotaGuard(
      () => setDoc(doc(db, COLLECTION_META, DOC_STATUS), updatedStatus, { merge: true }),
      8000
    );

    return { success: true, totalInCloud };
  } catch (err: unknown) {
    if (isQuotaExceededError(err)) {
      markFirestoreWriteQuotaExceeded();
      return { success: false, totalInCloud: 0, error: QUOTA_EXCEEDED_VI_MESSAGE };
    }
    const rawMsg = err instanceof Error ? err.message : String(err);
    const isPermError = rawMsg.toLowerCase().includes('permission') || rawMsg.toLowerCase().includes('insufficient');
    return {
      success: false,
      totalInCloud: 0,
      error: isPermError
        ? 'Bạn cần đăng nhập tài khoản Cán bộ Quản trị (Firebase Auth) để xóa dữ liệu trên Cloud.'
        : rawMsg,
    };
  }
}

/**
 * Xóa toàn bộ dữ liệu chứng chỉ đang lưu trên Cloud Firestore (Yêu cầu quyền Cán bộ Admin)
 */
export async function clearAllCertificatesFromCloud(
  onProgress?: (message: string, percent: number) => void
): Promise<{ success: boolean; error?: string }> {
  if (hasFirestoreWriteQuotaExceeded()) {
    return { success: false, error: QUOTA_EXCEEDED_VI_MESSAGE };
  }
  try {
    if (onProgress) onProgress('Đang tải danh sách tài liệu cần xóa trên Cloud...', 10);
    const snap = await getDocs(
      query(
        collection(db, COLLECTION_CERTIFICATES),
        where('mssv', '>=', ''),
        where('mssv', '<=', '\uf8ff')
      )
    );
    const total = snap.docs.length;

    if (total > 0) {
      const BATCH_SIZE = 450;
      const CONCURRENCY = 4;
      const batches: { batch: ReturnType<typeof writeBatch>; count: number }[] = [];

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const chunk = snap.docs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        for (const docSnap of chunk) {
          batch.delete(docSnap.ref);
        }
        batches.push({ batch, count: chunk.length });
      }

      let deleted = 0;
      for (let i = 0; i < batches.length; i += CONCURRENCY) {
        const group = batches.slice(i, i + CONCURRENCY);
        await runWriteWithQuotaGuard(
          () => Promise.all(group.map((g) => g.batch.commit())),
          15000
        );
        deleted += group.reduce((sum, g) => sum + g.count, 0);

        const pct = Math.min(95, Math.round((deleted / total) * 90));
        if (onProgress) {
          onProgress(`Đang xóa tài liệu đám mây: ${deleted.toLocaleString('vi-VN')}/${total.toLocaleString('vi-VN')}...`, pct);
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const emptyStatus: SyncStatus = {
      source: 'local_excel',
      totalRecords: 0,
      lastUpdated: new Date().toLocaleString('vi-VN'),
      fileCount: 0,
      fileNames: [],
    };
    await runWriteWithQuotaGuard(
      () => setDoc(doc(db, COLLECTION_META, DOC_STATUS), emptyStatus),
      8000
    );

    if (onProgress) onProgress('Đã xóa sạch toàn bộ danh sách chứng chỉ trên Cloud Firebase!', 100);
    return { success: true };
  } catch (err: unknown) {
    if (isQuotaExceededError(err)) {
      markFirestoreWriteQuotaExceeded();
      return { success: false, error: QUOTA_EXCEEDED_VI_MESSAGE };
    }
    const rawMsg = err instanceof Error ? err.message : String(err);
    const isPermError = rawMsg.toLowerCase().includes('permission') || rawMsg.toLowerCase().includes('insufficient');
    console.error('Lỗi xóa Firestore:', err);
    return {
      success: false,
      error: isPermError
        ? 'Không đủ quyền xóa dữ liệu. Vui lòng đăng nhập tài khoản Cán bộ Quản trị (Firebase Auth).'
        : rawMsg,
    };
  }
}

/**
 * Khởi tạo dữ liệu mẫu lên Cloud (chỉ gọi khi Cán bộ Admin yêu cầu hoặc collection rỗng)
 */
export async function seedCloudIfEmpty(): Promise<boolean> {
  if (!auth.currentUser || hasFirestoreWriteQuotaExceeded()) return false;
  try {
    const q = query(
      collection(db, COLLECTION_CERTIFICATES),
      where('mssv', '>=', ''),
      where('mssv', '<=', '\uf8ff'),
      limit(1)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
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
 * Ghi nhận lượt tra cứu sinh viên vào bộ nhớ trình duyệt + đồng bộ Firestore khi còn hạn mức ghi
 */
export async function recordSearchEvent(
  record: CertificateRecord | null,
  searchedMssv: string
): Promise<void> {
  const cleanMssv = searchedMssv.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') || 'UNKNOWN';
  const now = new Date();
  const id = `hist_${Date.now()}_${cleanMssv}`.slice(0, 128);

  const timeFormatted =
    now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
    ' - ' +
    now.toLocaleDateString('vi-VN');

  const historyItem: SearchHistoryItem = record
    ? {
        id,
        mssv: String(record.mssv || cleanMssv).slice(0, 64),
        hoVaTen: String(record.hoVaTen || '').slice(0, 150),
        stt: record.stt ?? '',
        ngayCap: String(record.ngayCap || '').slice(0, 60),
        soHieuChungChi: String(record.soHieuChungChi || '').slice(0, 100),
        soVaoSoGoc: String(record.soVaoSoGoc || '').slice(0, 100),
        tenChungChi: String(record.tenChungChi || '').slice(0, 200),
        donViCap: String(record.donViCap || '').slice(0, 200),
        khoaHoc: String(record.khoaHoc || '').slice(0, 100),
        nganhDaoTao: String(record.nganhDaoTao || '').slice(0, 150),
        ngaySinh: String(record.ngaySinh || '').slice(0, 50),
        noiSinh: String(record.noiSinh || '').slice(0, 150),
        gioiTinh: String(record.gioiTinh || '').slice(0, 30),
        danToc: String(record.danToc || '').slice(0, 50),
        xepLoai: String(record.xepLoai || '').slice(0, 60),
        fileName: String(record.fileName || '').slice(0, 255),
        timestamp: now.toISOString(),
        timeFormatted,
        daPhat: false,
        status: 'found',
      }
    : {
        id,
        mssv: cleanMssv.slice(0, 64),
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

  // Luôn lưu cục bộ để đảm bảo tra cứu lịch sử tức thì mà không phụ thuộc hạn mức ghi Cloud
  saveLocalSearchHistoryItem(historyItem);

  // Chỉ ghi lên Cloud Firestore nếu còn hạn mức VÀ (cán bộ đã đăng nhập hoặc đang dùng Firebase Project riêng)
  const shouldSyncHistoryToCloud =
    !hasFirestoreWriteQuotaExceeded() &&
    (Boolean(auth.currentUser) || isUsingCustomFirebaseConfig());

  if (!shouldSyncHistoryToCloud) {
    return;
  }

  try {
    await runWriteWithQuotaGuard(
      () => setDoc(doc(db, COLLECTION_HISTORY, id), historyItem),
      5000
    );
  } catch (err) {
    if (isQuotaExceededError(err)) {
      console.warn('Đã đạt giới hạn ghi Firestore trong ngày; lịch sử tra cứu tiếp tục được lưu cục bộ.');
      return;
    }
    console.warn('Lỗi lưu lịch sử tra cứu lên Firestore:', err);
  }
}

/**
 * Lắng nghe lịch sử tra cứu trực tiếp theo thời gian thực (Dành cho Cán bộ phát bằng)
 */
export function subscribeSearchHistory(
  callback: (items: SearchHistoryItem[]) => void,
  limitCount: number = 80,
  onError?: (err: Error) => void
): () => void {
  try {
    const q = query(
      collection(db, COLLECTION_HISTORY),
      where('mssv', '>=', ''),
      where('mssv', '<=', '\uf8ff'),
      orderBy('mssv'),
      limit(limitCount)
    );

    // Note: Sắp xếp thời gian mới nhất ở phía client để tránh lỗi thiếu composite index trên Firestore
    return onSnapshot(
      q,
      (snapshot) => {
        const items: SearchHistoryItem[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as SearchHistoryItem);
        });
        items.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        callback(items);
      },
      (error) => {
        console.warn('Lỗi lắng nghe lịch sử tra cứu Firestore:', error);
        if (onError) onError(error);
      }
    );
  } catch (e) {
    console.warn('Lỗi khởi tạo listener lịch sử tra cứu:', e);
    return () => {};
  }
}

/**
 * Chuyển đổi trạng thái "Đã phát chứng chỉ"
 */
export async function toggleHistoryDaPhat(historyId: string, currentStatus: boolean): Promise<void> {
  if (hasFirestoreWriteQuotaExceeded()) {
    throw new Error(QUOTA_EXCEEDED_VI_MESSAGE);
  }
  try {
    const docRef = doc(db, COLLECTION_HISTORY, historyId);
    const now =
      new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
      ' ' +
      new Date().toLocaleDateString('vi-VN');
    await runWriteWithQuotaGuard(
      () =>
        updateDoc(docRef, {
          daPhat: !currentStatus,
          ngayPhat: !currentStatus ? now : null,
        }),
      6000
    );
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markFirestoreWriteQuotaExceeded();
      throw new Error(QUOTA_EXCEEDED_VI_MESSAGE);
    }
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_HISTORY}/${historyId}`);
  }
}

/**
 * Xóa 1 dòng lịch sử tra cứu
 */
export async function deleteHistoryItem(historyId: string): Promise<void> {
  if (hasFirestoreWriteQuotaExceeded()) {
    throw new Error(QUOTA_EXCEEDED_VI_MESSAGE);
  }
  try {
    await runWriteWithQuotaGuard(
      () => deleteDoc(doc(db, COLLECTION_HISTORY, historyId)),
      6000
    );
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markFirestoreWriteQuotaExceeded();
      throw new Error(QUOTA_EXCEEDED_VI_MESSAGE);
    }
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTION_HISTORY}/${historyId}`);
  }
}

/**
 * Xóa toàn bộ lịch sử tra cứu
 */
export async function clearAllSearchHistory(): Promise<void> {
  clearLocalSearchHistory();
  if (hasFirestoreWriteQuotaExceeded()) {
    throw new Error(QUOTA_EXCEEDED_VI_MESSAGE);
  }
  try {
    const snap = await getDocs(
      query(
        collection(db, COLLECTION_HISTORY),
        where('mssv', '>=', ''),
        where('mssv', '<=', '\uf8ff')
      )
    );
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await runWriteWithQuotaGuard(() => batch.commit(), 10000);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markFirestoreWriteQuotaExceeded();
      throw new Error(QUOTA_EXCEEDED_VI_MESSAGE);
    }
    handleFirestoreError(err, OperationType.DELETE, COLLECTION_HISTORY);
  }
}
