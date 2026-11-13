import React, { useState } from 'react';
import { Lock, KeyRound, Eye, EyeOff, AlertCircle, X, Mail, ShieldCheck, LogIn } from 'lucide-react';
import { verifyAdminPassword, grantAdminSession, DEFAULT_ADMIN_PASSWORD } from '../services/adminAuthService';
import { googleSignInAdmin, emailSignInAdmin } from '../services/firebaseAuth';

interface AdminPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminPasswordModal: React.FC<AdminPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [authMode, setAuthMode] = useState<'firebase' | 'pin'>('firebase');
  const [email, setEmail] = useState('');
  const [emailPwd, setEmailPwd] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleAdminLogin = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await googleSignInAdmin();
      grantAdminSession();
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi đăng nhập Google Firebase';
      setErrorMsg(`Đăng nhập Google thất bại: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !emailPwd) {
      setErrorMsg('Vui lòng nhập đầy đủ Email và Mật khẩu tài khoản cán bộ.');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);
    try {
      await emailSignInAdmin(email, emailPwd);
      grantAdminSession();
      setEmailPwd('');
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sai thông tin đăng nhập';
      setErrorMsg(`Đăng nhập thất bại: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMsg('Vui lòng nhập mã PIN quản trị.');
      return;
    }

    if (verifyAdminPassword(password)) {
      grantAdminSession();
      setErrorMsg(null);
      setPassword('');
      onSuccess();
    } else {
      setErrorMsg('Mã PIN quản trị không chính xác! Vui lòng thử lại.');
    }
  };

  const handleUseDefault = () => {
    setPassword(DEFAULT_ADMIN_PASSWORD);
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-400/20 bg-[#002855] text-white">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center border border-amber-300/30">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Xác Thực Cán Bộ Quản Trị</h3>
              <p className="text-[11px] text-blue-200">Đại học Cần Thơ — Phân quyền Cloud Firestore</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setAuthMode('firebase');
              setErrorMsg(null);
            }}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              authMode === 'firebase'
                ? 'border-[#004B8D] text-[#003B73]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Tài khoản Firebase (Khuyên dùng)
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('pin');
              setErrorMsg(null);
            }}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              authMode === 'pin'
                ? 'border-[#004B8D] text-[#003B73]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Mã PIN Quản Trị
          </button>
        </div>

        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {authMode === 'firebase' ? (
            <div className="space-y-4">
              <div className="text-xs text-slate-600 leading-relaxed bg-blue-50/70 p-3 rounded-xl border border-blue-200">
                <strong className="text-[#003B73] flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-4 h-4 text-[#00529C]" />
                  Bảo vệ dữ liệu bằng Firebase Security Rules:
                </strong>
                Đăng nhập tài khoản Cán bộ Quản trị để được cấp quyền tải lên file Excel và xóa dữ liệu trên máy chủ Cloud Firestore.
              </div>

              {/* 1-Click Google Sign-In */}
              <button
                type="button"
                onClick={handleGoogleAdminLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center space-x-2.5 bg-white hover:bg-slate-50 border-2 border-slate-300 hover:border-[#00529C] text-slate-800 font-bold py-2.5 px-4 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-60 text-xs sm:text-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z" />
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                </svg>
                <span>{isLoading ? 'Đang xác thực...' : 'Đăng nhập nhanh bằng Google Cán bộ'}</span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200" />
                <span className="flex-shrink mx-3 text-[11px] text-slate-400 uppercase font-semibold">
                  Hoặc Email / Mật khẩu Firebase
                </span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              <form onSubmit={handleEmailLogin} className="space-y-3">
                <div>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email cán bộ (VD: canbo@ctu.edu.vn)"
                      className="w-full text-xs sm:text-sm py-2.5 pl-9 pr-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00529C]"
                    />
                  </div>
                </div>
                <div>
                  <div className="relative flex items-center">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={emailPwd}
                      onChange={(e) => setEmailPwd(e.target.value)}
                      placeholder="Mật khẩu tài khoản Firebase..."
                      className="w-full text-xs sm:text-sm py-2.5 pl-9 pr-10 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00529C]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-1.5 py-2.5 px-4 text-xs font-bold text-white bg-[#004B8D] hover:bg-[#00529C] rounded-xl shadow transition-all cursor-pointer disabled:opacity-50"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isLoading ? 'Đang đăng nhập...' : 'Đăng Nhập Bằng Email'}</span>
                </button>
              </form>
            </div>
          ) : (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div className="text-xs text-slate-600 leading-relaxed">
                Nhập mã PIN quản trị để mở khóa giao diện cấu hình (Lưu ý: các thao tác ghi/xóa trên máy chủ Firebase vẫn yêu cầu đăng nhập tài khoản Firebase hợp lệ).
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mã PIN quản trị viên:
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-slate-400 pointer-events-none">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Nhập mã PIN quản trị..."
                    autoFocus
                    className="w-full text-sm py-2.5 pl-9 pr-10 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00529C] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                <span>
                  Mã PIN mặc định: <strong className="font-mono text-slate-700">{DEFAULT_ADMIN_PASSWORD}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleUseDefault}
                  className="text-[#004B8D] hover:text-[#003B73] font-bold underline cursor-pointer"
                >
                  Điền nhanh
                </button>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-[#004B8D] hover:bg-[#00529C] active:scale-[0.98] rounded-xl shadow transition-all cursor-pointer"
                >
                  Mở Quản Trị &rarr;
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
