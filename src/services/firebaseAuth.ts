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

const adminGoogleProvider = new GoogleAuthProvider();
adminGoogleProvider.setCustomParameters({
  prompt: 'select_account',
});

export const initAuth = (
  onAuthSuccess?: (user: User) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user);
    } else {
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

export const logoutGoogle = async () => {
  await signOut(auth);
};
