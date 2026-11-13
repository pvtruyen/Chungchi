import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import appletFirebaseConfig from '../../firebase-applet-config.json';

/**
 * Cấu hình Firebase cho Ứng dụng Tra cứu Chứng chỉ GDQP&AN - Đại học Cần Thơ.
 * - Mặc định tự động sử dụng cấu hình từ `firebase-applet-config.json` hoặc biến môi trường `VITE_FIREBASE_*`.
 * - Khi triển khai lên dự án Firebase cá nhân khác, bạn có thể điền trực tiếp các biến VITE_FIREBASE_* vào Vercel Environment Variables.
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletFirebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletFirebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletFirebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletFirebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletFirebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletFirebaseConfig.appId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || appletFirebaseConfig.firestoreDatabaseId,
};

/**
 * Mẫu cấu hình trống để người dùng tự điền khi triển khai trên dự án Firebase mới
 */
export const TEMPLATE_FIREBASE_CONFIG = `// Cấu hình Firebase Web SDK v9+ (Modular)
export const firebaseConfig = {
  apiKey: "",            // Điền API Key từ Firebase Console -> Project Settings
  authDomain: "",        // VD: ten-du-an.firebaseapp.com
  projectId: "",         // VD: ten-du-an
  storageBucket: "",     // VD: ten-du-an.firebasestorage.app
  messagingSenderId: "", // Điền Sender ID
  appId: "",             // Điền App ID
};`;

export const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth: Auth = getAuth(app);
export const db: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

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
