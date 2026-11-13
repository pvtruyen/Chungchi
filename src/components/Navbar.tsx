import React from 'react';
import { BookOpen, Settings, Lock, Clock } from 'lucide-react';
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
              title={isOfficerAuthorized ? 'Đã xác thực cán bộ quản trị' : 'Chế độ tra cứu công khai'}
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
              Tra Cứu Văn Bằng &amp; Chứng Chỉ GDQP&amp;AN
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Active Mode Badge (Only visible to authenticated Admin) */}
          {isOfficerAuthorized && (
            <>
              <button
                type="button"
                onClick={onOpenDataSourceModal}
                className="hidden sm:flex items-center space-x-2 text-xs bg-blue-900/80 border border-sky-400/40 text-sky-100 hover:bg-blue-800 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                title={userEmail ? `Cán bộ: ${userEmail}` : 'Chuyển đổi nguồn dữ liệu'}
              >
                <span className="font-semibold text-white">
                  {syncStatus.source === 'apps_script'
                    ? 'Google Drive ("Số hóa chứng chỉ")'
                    : syncStatus.source === 'drive_oauth'
                    ? 'Drive + Firebase'
                    : syncStatus.source === 'local_excel'
                    ? 'Firebase Cloud'
                    : 'Dữ liệu mẫu'}
                </span>
                <span className="bg-[#001833] text-amber-300 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-blue-400/30">
                  {syncStatus.totalRecords.toLocaleString('vi-VN')}
                </span>
              </button>

              <button
                type="button"
                onClick={onOpenHistoryModal}
                className="flex items-center space-x-1.5 text-xs bg-[#003B73] hover:bg-[#004B8D] text-amber-200 border border-amber-400/40 px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer shadow-sm"
                title="Xem lịch sử sinh viên tra cứu (Dành cho Cán bộ phát bằng)"
              >
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden md:inline">Lịch sử phát bằng</span>
                <span className="md:hidden">Lịch sử</span>
              </button>

              <button
                type="button"
                onClick={onOpenDeployGuideModal}
                className="hidden lg:flex items-center space-x-1.5 text-xs bg-white/10 hover:bg-white/20 text-blue-50 border border-blue-300/25 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-sky-300" />
                <span>Hướng dẫn &amp; Rules</span>
              </button>
            </>
          )}

          {/* Admin Settings Button (Always visible, protected by Admin Auth) */}
          <button
            type="button"
            onClick={onOpenDataSourceModal}
            className="flex items-center space-x-1.5 text-xs bg-[#0066B3] hover:bg-[#0077CC] text-white font-bold px-3 py-1.5 rounded-lg shadow-sm border border-sky-300/30 transition-all cursor-pointer"
            title="Mở bảng Cài đặt Kết nối & Quản trị (Yêu cầu quyền Cán bộ)"
          >
            {isOfficerAuthorized ? (
              <Settings className="w-3.5 h-3.5 text-sky-200" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>{isOfficerAuthorized ? 'Cài đặt Hệ thống' : 'Cài đặt Kết nối (Admin)'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
