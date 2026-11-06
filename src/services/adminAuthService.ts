const STORAGE_KEY_ADMIN_PWD = 'gdqp_admin_pwd_v1';
const SESSION_KEY_ADMIN_AUTH = 'gdqp_admin_session_auth_v1';
export const DEFAULT_ADMIN_PASSWORD = 'ctu@gdqp';

/**
 * Get the current configured admin password (defaults to 'ctu@gdqp')
 */
export function getAdminPassword(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_ADMIN_PWD) || DEFAULT_ADMIN_PASSWORD;
  } catch {
    return DEFAULT_ADMIN_PASSWORD;
  }
}

/**
 * Verify given password against stored password
 */
export function verifyAdminPassword(password: string): boolean {
  const current = getAdminPassword();
  return password.trim() === current.trim();
}

/**
 * Update the admin master password
 */
export function updateAdminPassword(newPassword: string): boolean {
  if (!newPassword || newPassword.trim().length < 4) {
    return false;
  }
  try {
    localStorage.setItem(STORAGE_KEY_ADMIN_PWD, newPassword.trim());
    return true;
  } catch (e) {
    console.error('Lỗi lưu mật khẩu quản trị:', e);
    return false;
  }
}

/**
 * Reset password back to default 'ctu@gdqp'
 */
export function resetAdminPassword(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_ADMIN_PWD);
  } catch (e) {
    console.error('Lỗi reset mật khẩu:', e);
  }
}

/**
 * Check if the current browser session has unlocked admin privileges
 */
export function isAdminSessionActive(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY_ADMIN_AUTH) === 'true';
  } catch {
    return false;
  }
}

/**
 * Grant admin session
 */
export function grantAdminSession(): void {
  try {
    sessionStorage.setItem(SESSION_KEY_ADMIN_AUTH, 'true');
  } catch (e) {
    console.error('Lỗi set admin session:', e);
  }
}

/**
 * Revoke admin session
 */
export function revokeAdminSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY_ADMIN_AUTH);
  } catch (e) {
    console.error('Lỗi revoke admin session:', e);
  }
}
