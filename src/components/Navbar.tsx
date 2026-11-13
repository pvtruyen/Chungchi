import React from 'react';
import { BookOpen, FolderSync, Lock, ShieldCheck, Clock } from 'lucide-react';
import { SyncStatus } from '../types/certificate';
import { CtuLogo } from './CtuLogo';

interface NavbarProps {
  syncStatus: SyncStatus;
  onOpenDataSourceModal: () => void;
  onOpenDeployGuideModal: () => void;
  onOpenHistoryModal: () => void;
  isLoggedInGoogle: boolean;
  userEmail: string | null;
  isAdmin: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  syncStatus,
  onOpenDataSourceModal,
  onOpenDeployGuideModal,
  onOpenHistoryModal,
  isLoggedInGoogle,
  userEmail,
  isAdmin,
}) => {
  const isOfficerAuthorized = isAdmin || isLoggedInGoogle;

  return (
    <header className="sticky top-0 z-40 bg-[#002855]/95 backdrop-blur-md border-b border-blue-400/25 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-2">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3 sm:space-x-3.5 min-w-0">
          <div className="relative shrink-0">
            <CtuLogo sizeClass="w-11 h-11 sm:w-12 sm:h-12" alt="Logo Đại học Cần Thơ" />
            <div
              className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#002855] ${
                isOfficerAuthorized ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
              title={isOfficerAuthorized ? 'Đã xác thực cán bộ' : 'Chế độ tra cứu công khai'}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] sm:text-xs font-extrabold tracking-widest uppercase text-amber-300 bg-amber-400/15 px-2 py-0.5 rounded border border-amber-300/30 truncate">
                ĐẠI HỌC CẦN THƠ
              </span>
              <span className="text-[11px] text-blue-100/80 hidden lg:inline font-medium">
                TRUNG TÂM GIÁO DỤC QUỐC PHÒNG VÀ AN NINH
              </span>
            </div>
            <h1 className="text-sm sm:text-base md:text-lg font-extrabold tracking-tight text-white leading-tight truncate mt-0.5">
              Tra Cứu &amp; Quản Lý Chứng Chỉ GDQP&amp;AN
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Status Badge */}
          <button
            onClick={onOpenDataSourceModal}
            className={`hidden sm:flex items-center space-x-2 text-xs border px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              isOfficerAuthorized
                ? 'bg-blue-900/80 border-sky-400/40 text-sky-100 hover:bg-blue-800'
                : 'bg-[#001E3C]/80 hover:bg-[#003366] border-blue-400/25 text-blue-100 hover:text-white'
            }`}
            title={
              userEmail
                ? `Cán bộ: ${userEmail} — Bấm để quản lý dữ liệu`
                : 'Bấm để mở cấu hình nguồn dữ liệu (yêu cầu quyền Cán bộ)'
            }
          >
            {isOfficerAuthorized ? (
              <ShieldCheck className="w-3.5 h-3.5 text-sky-300" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span className="hidden md:inline text-blue-200">Dữ liệu:</span>
            <span className="font-semibold text-white">
              {syncStatus.source === 'drive_oauth'
                ? 'Google Drive'
                : syncStatus.source === 'apps_script'
                ? 'Apps Script'
                : syncStatus.source === 'local_excel'
                ? 'Cloud Firestore'
                : 'Dữ liệu mẫu'}
            </span>
            <span className="bg-[#001833] text-amber-300 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-blue-400/30">
              {syncStatus.totalRecords.toLocaleString('vi-VN')}
            </span>
          </button>

          {/* Lịch sử tra cứu Button */}
          <button
            onClick={onOpenHistoryModal}
            className="flex items-center space-x-1.5 text-xs bg-[#003B73] hover:bg-[#004B8D] text-amber-200 border border-amber-400/40 px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer shadow-sm"
            title="Xem lịch sử sinh viên tra cứu (Dành cho Cán bộ phát bằng)"
          >
            <Clock className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden md:inline">Lịch sử phát bằng</span>
            <span className="md:hidden">Lịch sử</span>
          </button>

          {/* Guide / Firebase Setup Button */}
          <button
            onClick={onOpenDeployGuideModal}
            className="hidden lg:flex items-center space-x-1.5 text-xs bg-white/10 hover:bg-white/20 text-blue-50 border border-blue-300/25 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-sky-300" />
            <span>Hướng dẫn &amp; Rules</span>
          </button>

          {/* Admin / Sync Button */}
          <button
            onClick={onOpenDataSourceModal}
            className="flex items-center space-x-1.5 text-xs bg-[#0066B3] hover:bg-[#0077CC] text-white font-bold px-3 py-1.5 rounded-lg shadow-sm border border-sky-300/30 transition-all cursor-pointer"
            title={isOfficerAuthorized ? 'Quản lý dữ liệu & Upload Excel' : 'Đăng nhập Cán bộ Quản trị'}
          >
            {isOfficerAuthorized ? (
              <FolderSync className="w-3.5 h-3.5 text-sky-200" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>{isOfficerAuthorized ? 'Quản trị' : 'Cán bộ'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
