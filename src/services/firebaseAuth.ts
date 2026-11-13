import {
  signInWithPopup,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import { auth } from './firebaseConfig';

export { auth };

const driveProvider = new GoogleAuthProvider();
driveProvider.addScope('https://www.googleapis.com/auth/drive.readonly');
driveProvider.setCustomParameters({
  prompt: 'select_account',
});

const adminGoogleProvider = new GoogleAuthProvider();
adminGoogleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Token Google Drive được lưu tạm trong RAM (không ghi ra localStorage)
let cachedDriveAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, driveToken: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedDriveAccessToken);
    } else {
      cachedDriveAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Đăng nhập Google cho Cán bộ Quản trị (Firebase Auth)
 */
export const googleSignInAdmin = async (): Promise<{ user: User }> => {
  const result = await signInWithPopup(auth, adminGoogleProvider);
  return { user: result.user };
};

/**
 * Đăng nhập Google kèm quyền đọc Google Drive (để quét thư mục Drive)
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    const result = await signInWithPopup(auth, driveProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Không thể lấy Access Token Google Drive từ Firebase Auth');
    }

    cachedDriveAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedDriveAccessToken };
  } catch (error: unknown) {
    console.error('Lỗi đăng nhập Google Workspace:', error);
    throw error;
  }
};

/**
 * Đăng nhập bằng Email và Mật khẩu qua Firebase Authentication
 */
export const emailSignInAdmin = async (
  email: string,
  password: string
): Promise<{ user: User }> => {
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  return { user: result.user };
};

export const getCurrentFirebaseUser = (): User | null => {
  return auth.currentUser;
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedDriveAccessToken;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedDriveAccessToken = null;
};
