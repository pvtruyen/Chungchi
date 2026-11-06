import React from 'react';
import { Shield, Database, BookOpen, Sparkles, FolderSync, CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { SyncStatus } from '../types/certificate';

interface NavbarProps {
  syncStatus: SyncStatus;
  onOpenDataSourceModal: () => void;
  onOpenDeployGuideModal: () => void;
  isLoggedInGoogle: boolean;
  userEmail: string | null;
  isAdmin: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  syncStatus,
  onOpenDataSourceModal,
  onOpenDeployGuideModal,
  isLoggedInGoogle,
  userEmail,
  isAdmin,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-emerald-800/40 text-white shadow-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-white p-1 shadow-md shadow-emerald-950/50 border border-amber-300/40 shrink-0">
            <img
              src="https://www.ctu.edu.vn/images/branding/logo/CTU_logo.png"
              alt="Logo Trường Đại học Cần Thơ (CTU)"
              className="w-full h-full object-contain"
              onError={(e) => {
                // Graceful fallback if offline or blocked
                const target = e.currentTarget;
                target.style.display = 'none';
                if (target.nextElementSibling) {
                  (target.nextElementSibling as HTMLElement).style.display = 'flex';
                }
              }}
            />
            <div className="hidden items-center justify-center w-full h-full text-emerald-800">
              <Shield className="w-6 h-6 text-emerald-700" />
            </div>
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-slate-900" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] sm:text-xs font-bold tracking-widest uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-400/20">
                ĐẠI HỌC CẦN THƠ
              </span>
              <span className="text-[11px] text-slate-300 hidden md:inline">
                TRUNG TÂM GDQP &amp; AN
              </span>
            </div>
            <h1 className="text-sm sm:text-base md:text-lg font-black tracking-tight text-white leading-tight">
              Tra Cứu Chứng Chỉ Giáo Dục Quốc Phòng
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Status Badge */}
          <button
            onClick={onOpenDataSourceModal}
            className={`flex items-center space-x-2 text-xs border px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              isAdmin
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200 hover:bg-emerald-950'
                : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white'
            }`}
            title={isAdmin ? 'Quyền quản trị đang mở - Bấm để quản lý dữ liệu' : 'Bấm để mở cấu hình (yêu cầu mật khẩu)'}
          >
            {isAdmin ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="hidden sm:inline">Nguồn:</span>
            <span className="font-semibold text-emerald-300">
              {syncStatus.source === 'drive_oauth'
                ? 'Google Drive'
                : syncStatus.source === 'apps_script'
                ? 'Apps Script API'
                : syncStatus.source === 'local_excel'
                ? 'File Excel'
                : 'Dữ liệu mẫu'}
            </span>
            <span className="bg-emerald-950 text-emerald-300 text-[10px] font-mono px-1.5 py-0.2 rounded border border-emerald-800">
              {syncStatus.totalRecords}
            </span>
          </button>

          {/* Guide / Deploy Button */}
          <button
            onClick={onOpenDeployGuideModal}
            className="hidden sm:flex items-center space-x-1.5 text-xs bg-gradient-to-r from-amber-600/30 to-amber-700/30 hover:from-amber-600/40 hover:to-amber-700/40 text-amber-200 border border-amber-500/30 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-300" />
            <span>Hướng dẫn &amp; Script</span>
          </button>

          {/* Admin / Sync Button */}
          <button
            onClick={onOpenDataSourceModal}
            className="flex items-center space-x-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg shadow-sm shadow-emerald-900 transition-all cursor-pointer"
            title={isAdmin ? 'Quản lý nguồn dữ liệu' : 'Khu vực quản trị (cần mật khẩu)'}
          >
            {isAdmin ? <FolderSync className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-amber-300" />}
            <span>{isAdmin ? 'Quản trị' : 'Đồng bộ'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
