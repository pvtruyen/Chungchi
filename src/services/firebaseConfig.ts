import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDocFromServer, terminate } from 'firebase/firestore';
import appletFirebaseConfig from '../../firebase-applet-config.json';

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
}

const CUSTOM_FIREBASE_CONFIG_KEY = 'gdqp_custom_firebase_config_v1';

/**
 * Mẫu cấu hình trống để tham khảo khi triển khai lên dự án Firebase khác
 */
export const TEMPLATE_FIREBASE_CONFIG = `// Cấu hình Firebase Web SDK v9+ (Modular)
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};`;

/**
 * Đọc cấu hình Firebase tùy chỉnh đã lưu trong trình duyệt (nếu quản trị viên đã dán vào bảng Cài đặt No-Code)
 */
export function getCustomFirebaseConfig(): FirebaseWebConfig | null {
  try {
    const raw = localStorage.getItem(CUSTOM_FIREBASE_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FirebaseWebConfig;
    if (parsed && parsed.apiKey && parsed.projectId) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function isUsingCustomFirebaseConfig(): boolean {
  return getCustomFirebaseConfig() !== null;
}

/**
 * Tự động bóc tách các thông số từ đoạn mã firebaseConfig được dán trực tiếp từ Firebase Console
 * Hỗ trợ cả JS object (`const firebaseConfig = { apiKey: '...' }`), JSON, hoặc có comment.
 */
export function parseFirebaseConfigText(rawText: string): FirebaseWebConfig | null {
  if (!rawText || !rawText.trim()) return null;

  const extractField = (key: string): string => {
    const regex = new RegExp(`["']?${key}["']?\\s*:\\s*["'\`]([^"'\`]+)["'\`]`, 'i');
    const match = rawText.match(regex);
    return match ? match[1].trim() : '';
  };

  const apiKey = extractField('apiKey');
  const projectId = extractField('projectId');
  const authDomain = extractField('authDomain') || (projectId ? `${projectId}.firebaseapp.com` : '');
  const storageBucket = extractField('storageBucket') || (projectId ? `${projectId}.firebasestorage.app` : '');
  const messagingSenderId = extractField('messagingSenderId');
  const appId = extractField('appId');
  const firestoreDatabaseId = extractField('firestoreDatabaseId');

  if (!apiKey || !projectId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    ...(firestoreDatabaseId ? { firestoreDatabaseId } : {}),
  };
}

function resolveInitialConfig(): FirebaseWebConfig {
  const custom = getCustomFirebaseConfig();
  if (custom) return custom;

  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletFirebaseConfig.apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletFirebaseConfig.authDomain,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletFirebaseConfig.projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletFirebaseConfig.storageBucket,
    messagingSenderId:
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletFirebaseConfig.messagingSenderId,
    appId: import.meta.env.VITE_FIREBASE_APP_ID || appletFirebaseConfig.appId,
    firestoreDatabaseId:
      import.meta.env.VITE_FIREBASE_DATABASE_ID || appletFirebaseConfig.firestoreDatabaseId,
  };
}

export let firebaseConfig: FirebaseWebConfig = resolveInitialConfig();
export let app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export let auth: Auth = getAuth(app);
export let db: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export function getCurrentDbQuotaKey(): string {
  const todayUtc = new Date().toISOString().slice(0, 10);
  return `gdqp_quota_write_exhausted_${firebaseConfig.projectId}_${firebaseConfig.firestoreDatabaseId || 'default'}_${todayUtc}`;
}

/**
 * Chấm dứt WriteStream đang bị kẹt vòng lặp backoff (khi gặp lỗi quota) nhưng vẫn giữ nguyên Auth
 * và tạo lại instance Firestore sạch để tiếp tục đọc dữ liệu.
 */
export async function resetFirestoreWriteStream(): Promise<void> {
  try {
    await terminate(db);
  } catch (err) {
    console.warn('Không thể terminate Firestore instance cũ:', err);
  }
  db = firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
}

/**
 * Lưu cấu hình Firebase mới từ giao diện No-Code và khởi tạo lại kết nối ngay lập tức
 */
export function saveAndReconnectFirebase(config: FirebaseWebConfig): boolean {
  try {
    localStorage.setItem(CUSTOM_FIREBASE_CONFIG_KEY, JSON.stringify(config));
    firebaseConfig = config;
    const customAppName = `ctu_custom_${Date.now()}`;
    app = initializeApp(config, customAppName);
    auth = getAuth(app);
    db = config.firestoreDatabaseId
      ? getFirestore(app, config.firestoreDatabaseId)
      : getFirestore(app);
    return true;
  } catch (err) {
    console.error('Lỗi khởi tạo Firebase từ cấu hình mới:', err);
    return false;
  }
}

/**
 * Khôi phục về cấu hình Firebase mặc định đã cấp sẵn cho ứng dụng
 */
export function resetToDefaultFirebaseConfig(): void {
  try {
    localStorage.removeItem(CUSTOM_FIREBASE_CONFIG_KEY);
  } catch {
    // ignore
  }
  firebaseConfig = resolveInitialConfig();
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
}

/**
 * Kiểm tra kết nối trực tiếp tới máy chủ Cloud Firestore khi khởi động ứng dụng
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'gdqp_meta', 'status'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Không thể kết nối máy chủ Cloud Firestore. Vui lòng kiểm tra cấu hình mạng và Firebase.');
    }
    return false;
  }
}
