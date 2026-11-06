import React, { useState } from 'react';
import { Lock, KeyRound, Eye, EyeOff, AlertCircle, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { verifyAdminPassword, grantAdminSession, DEFAULT_ADMIN_PASSWORD } from '../services/adminAuthService';

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
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMsg('Vui lòng nhập mật khẩu quản trị.');
      return;
    }

    if (verifyAdminPassword(password)) {
      grantAdminSession();
      setErrorMsg(null);
      setPassword('');
      onSuccess();
    } else {
      setErrorMsg('Mật khẩu không chính xác! Vui lòng thử lại.');
    }
  };

  const handleUseDefault = () => {
    setPassword(DEFAULT_ADMIN_PASSWORD);
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 text-white">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Xác Thực Cán Bộ Quản Trị</h3>
              <p className="text-[11px] text-slate-400">Bảo vệ quyền chọn nguồn dữ liệu</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-xs text-slate-600 leading-relaxed">
            Khu vực đồng bộ Google Drive và cập nhật file Excel dành riêng cho Cán bộ quản lý GDQP. Vui lòng nhập mật khẩu quản trị để tiếp tục.
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Mật khẩu quản trị viên:
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
                placeholder="Nhập mật khẩu quản trị..."
                autoFocus
                className="w-full text-sm py-2.5 pl-9 pr-10 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
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

          {/* Quick Default Helper */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
            <span>
              Mật khẩu mặc định: <strong className="font-mono text-slate-700">{DEFAULT_ADMIN_PASSWORD}</strong>
            </span>
            <button
              type="button"
              onClick={handleUseDefault}
              className="text-emerald-700 hover:text-emerald-800 font-bold underline cursor-pointer"
            >
              Điền nhanh
            </button>
          </div>

          {/* Buttons */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] rounded-xl shadow transition-all cursor-pointer"
            >
              Mở Cấu Hình &rarr;
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
