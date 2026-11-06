import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  writeBatch, 
  collection, 
  getDocs,
  limit,
  query
} from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';
import { CertificateRecord, SyncStatus, DataSourceType } from '../types/certificate';
import { INITIAL_DEMO_RECORDS } from './mockData';

// Get or initialize singleton app
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with specific databaseId if provided
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

const COLLECTION_CERTIFICATES = 'gdqp_certificates';
const COLLECTION_META = 'gdqp_meta';
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
 * Save an array of certificate records to Cloud Firestore
 * Uses batch writes (450 items per batch) to efficiently store large Excel sheets
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
    const BATCH_SIZE = 450;
    let uploaded = 0;

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

      await batch.commit();
      uploaded += chunk.length;

      const pct = Math.min(95, Math.round((uploaded / total) * 90));
      if (onProgress) {
        onProgress(`Đang lưu lên đám mây: ${uploaded}/${total} chứng chỉ...`, pct);
      }
    }

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
      onProgress(`Đã lưu trữ vĩnh viễn ${uploaded} chứng chỉ lên đám mây!`, 100);
    }

    return { success: true, totalUploaded: uploaded };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi không xác định khi lưu Firestore';
    console.error('Lỗi lưu trữ dữ liệu lên Firestore:', err);
    return { success: false, totalUploaded: 0, error: msg };
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
