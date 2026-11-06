import React, { useState, useRef } from 'react';
import { 
  X, 
  FolderSync, 
  Upload, 
  Link, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  Sparkles, 
  LogIn, 
  LogOut, 
  ExternalLink,
  RefreshCw,
  FolderOpen,
  Lock,
  KeyRound,
  ShieldCheck
} from 'lucide-react';
import { SyncStatus, DataSourceType, CertificateRecord } from '../types/certificate';
import { googleSignIn, logoutGoogle } from '../services/firebaseAuth';
import { findGdqpFolder, scanDriveFolderForCertificates } from '../services/googleDriveService';
import { parseExcelFile } from '../services/excelParser';
import { saveRecords, saveAppsScriptUrl, getSavedAppsScriptUrl, resetToDemo } from '../services/storageService';
import { queryAppsScript } from '../services/appsScriptConnector';
import { updateAdminPassword, revokeAdminSession } from '../services/adminAuthService';
import { saveRecordsToCloud } from '../services/firestoreService';

interface DataSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SyncStatus;
  onDataUpdated: () => void;
  isLoggedInGoogle: boolean;
  userEmail: string | null;
  onLoginSuccess: (email: string, token: string) => void;
  onLogoutSuccess: () => void;
}

export const DataSourceModal: React.FC<DataSourceModalProps> = ({
  isOpen,
  onClose,
  syncStatus,
  onDataUpdated,
  isLoggedInGoogle,
  userEmail,
  onLoginSuccess,
  onLogoutSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'drive' | 'appsscript' | 'upload' | 'demo'>('drive');
  const [appsScriptUrlInput, setAppsScriptUrlInput] = useState(getSavedAppsScriptUrl());
  const [isScanningDrive, setIsScanningDrive] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ message: string; percent: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isTestingAppsScript, setIsTestingAppsScript] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleLockAdminSession = () => {
    revokeAdminSession();
    onClose();
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      setErrorMsg('Mật khẩu mới phải có ít nhất 4 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp.');
      return;
    }

    const ok = updateAdminPassword(newPassword);
    if (ok) {
      setSuccessMsg('Đã đổi mật khẩu quản trị viên thành công!');
      setShowPasswordChange(false);
      setNewPassword('');
      setConfirmPassword('');
      setErrorMsg(null);
    } else {
      setErrorMsg('Không thể đổi mật khẩu. Vui lòng thử lại.');
    }
  };

  // Handle Google Drive OAuth login
  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await googleSignIn();
      if (res) {
        onLoginSuccess(res.user.email || 'Google User', res.accessToken);
        setSuccessMsg(`Đăng nhập thành công: ${res.user.email}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi đăng nhập Google';
      setErrorMsg(`Đăng nhập thất bại: ${msg}`);
    }
  };

  // Handle Google Sign Out
  const handleGoogleLogout = async () => {
    await logoutGoogle();
    onLogoutSuccess();
    setSuccessMsg('Đã đăng xuất Google.');
  };

  // Handle scanning Google Drive folder: My Drive\GDQP\Số hóa chứng chỉ
  const handleScanDriveFolder = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsScanningDrive(true);
    setScanProgress({ message: 'Đang kết nối Google Drive API...', percent: 5 });

    try {
      // Need active access token
      const res = await googleSignIn();
      if (!res?.accessToken) {
        throw new Error('Chưa có quyền truy cập Google Drive. Vui lòng đăng nhập.');
      }

      setScanProgress({ message: 'Đang tìm thư mục "GDQP / Số hóa chứng chỉ"...', percent: 15 });
      const folder = await findGdqpFolder(res.accessToken);

      if (!folder) {
        throw new Error(
          'Không tìm thấy thư mục "GDQP" hoặc "Số hóa chứng chỉ" trong My Drive của tài khoản Google này. Vui lòng kiểm tra lại cấu trúc thư mục trên Google Drive hoặc tải file Excel trực tiếp.'
        );
      }

      setScanProgress({ message: `Đã tìm thấy: ${folder.folderPath}. Đang quét file...`, percent: 25 });
      const scanResult = await scanDriveFolderForCertificates(
        res.accessToken,
        folder.folderId,
        (msg, pct) => setScanProgress({ message: msg, percent: pct })
      );

      if (scanResult.records.length === 0) {
        throw new Error(`Thư mục "${folder.folderPath}" hiện chưa có file Excel hoặc chưa có dữ liệu hợp lệ.`);
      }

      // Save records to high-speed index
      saveRecords(scanResult.records, 'drive_oauth', scanResult.filesScanned);
      onDataUpdated();

      // Automatically sync to Cloud Firestore so all other devices & IPs have this data
      setScanProgress({ message: 'Đang lưu trữ lên máy chủ Đám mây (Cloud Firestore)...', percent: 85 });
      await saveRecordsToCloud(
        scanResult.records,
        'drive_oauth',
        scanResult.filesScanned,
        (msg, pct) => setScanProgress({ message: msg, percent: pct })
      );

      setSuccessMsg(`Đồng bộ thành công ${scanResult.records.length} chứng chỉ từ Google Drive và đã lưu lên Đám mây (Cloud Firestore)! Tất cả các máy tính/điện thoại khác đều tra cứu được ngay.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi quét thư mục Google Drive';
      setErrorMsg(msg);
    } finally {
      setIsScanningDrive(false);
      setScanProgress(null);
    }
  };

  // Handle Direct Excel Upload (.xlsx)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsScanningDrive(true);
    setScanProgress({ message: 'Đang đọc và phân tích file Excel...', percent: 10 });

    try {
      const allRecords: CertificateRecord[] = [];
      const loadedFileNames: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const buffer = await file.arrayBuffer();
        const records = parseExcelFile(buffer, file.name);
        allRecords.push(...records);
        loadedFileNames.push(file.name);
      }

      if (allRecords.length === 0) {
        throw new Error('Không tìm thấy bản ghi chứng chỉ hợp lệ nào trong file Excel được tải lên. Hãy đảm bảo file có cột STT, Mã người học (MSSV), Họ tên, Số hiệu.');
      }

      // Save locally
      saveRecords(allRecords, 'local_excel', loadedFileNames);
      onDataUpdated();

      // Save to Cloud Firestore so all other devices, IPs, and browsers have the exact data!
      setScanProgress({ message: 'Đang lưu trữ lên đám mây Cloud Firestore cho toàn hệ thống...', percent: 25 });
      await saveRecordsToCloud(
        allRecords,
        'local_excel',
        loadedFileNames,
        (msg, pct) => setScanProgress({ message: msg, percent: pct })
      );

      setSuccessMsg(`Đã nạp và lưu trữ vĩnh viễn ${allRecords.length} chứng chỉ lên Đám mây (Cloud Firestore)! Bất kỳ ai từ mọi thiết bị, điện thoại hoặc IP khác giờ đây đều có thể tra cứu ngay.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi đọc file Excel';
      setErrorMsg(msg);
    } finally {
      setIsScanningDrive(false);
      setScanProgress(null);
    }
  };

  // Handle Testing & Saving Apps Script URL
  const handleSaveAppsScriptUrl = async () => {
    const url = appsScriptUrlInput.trim();
    if (!url) {
      setErrorMsg('Vui lòng nhập đường link Google Apps Script Web App');
      return;
    }

    setIsTestingAppsScript(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const test = await queryAppsScript(url, 'TEST_PING');
      // If we got any response (even not found, it proves script is responding)
      if (test.error && !test.error.includes('Không tìm thấy')) {
        throw new Error(test.error);
      }

      saveAppsScriptUrl(url);
      saveRecords([], 'apps_script', ['Google Apps Script Live Endpoint']);
      onDataUpdated();
      setSuccessMsg('Đã kết nối thành công tới Google Apps Script Web App!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể kết nối tới Google Apps Script';
      setErrorMsg(`Kiểm tra thất bại: ${msg}. Đảm bảo bạn đã Deploy Web App ở chế độ "Anyone" (Bất kỳ ai).`);
    } finally {
      setIsTestingAppsScript(false);
    }
  };

  // Handle Reset to Demo
  const handleResetDemo = () => {
    resetToDemo();
    onDataUpdated();
    setSuccessMsg('Đã khôi phục dữ liệu mẫu chuẩn (20+ chứng chỉ GDQP). Bạn có thể thử tra cứu ngay MSSV B2101234.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-slate-900 text-white">
          <div className="flex items-center space-x-2.5">
            <Database className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold">Cấu Hình Nguồn Dữ Liệu Chứng Chỉ</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Database Status Banner */}
        <div className="bg-emerald-50/70 border-b border-emerald-100 px-6 py-3 flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>Đang sử dụng:</span>
            <strong className="font-semibold">
              {syncStatus.source === 'drive_oauth'
                ? 'Google Drive trực tiếp'
                : syncStatus.source === 'apps_script'
                ? 'Google Apps Script API'
                : syncStatus.source === 'local_excel'
                ? 'File Excel tải lên'
                : 'Dữ liệu mẫu thử nghiệm'}
            </strong>
          </div>
          <div className="font-mono font-bold text-emerald-800">
            {syncStatus.totalRecords} chứng chỉ đã nạp
          </div>
        </div>

        {/* Admin Session Security Bar */}
        <div className="bg-slate-800 text-slate-300 px-6 py-2.5 flex items-center justify-between text-xs border-b border-slate-700">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-300 font-semibold">Quyền Cán bộ Quản lý</span>
            <span className="text-slate-500 hidden sm:inline">• Được phép cập nhật dữ liệu</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPasswordChange(!showPasswordChange)}
              className="text-xs text-amber-300 hover:text-amber-200 hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{showPasswordChange ? 'Đóng đổi MK' : 'Đổi mật khẩu'}</span>
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={handleLockAdminSession}
              className="text-xs text-rose-300 hover:text-rose-200 hover:underline flex items-center gap-1 cursor-pointer font-medium"
              title="Khóa lại quyền quản trị khi rời máy tính"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Khóa quản trị</span>
            </button>
          </div>
        </div>

        {/* Password Change Drawer (if opened) */}
        {showPasswordChange && (
          <form
            onSubmit={handleChangePasswordSubmit}
            className="bg-amber-50/90 border-b border-amber-200 px-6 py-3.5 text-xs text-amber-950 space-y-2.5 animate-in fade-in"
          >
            <div className="font-bold flex items-center gap-1.5 text-amber-900">
              <KeyRound className="w-4 h-4 text-amber-700" />
              Đổi Mật Khẩu Quản Trị Viên Mới:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới (tối thiểu 4 ký tự)..."
                className="p-2 rounded-lg border border-amber-300 bg-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Xác nhận lại mật khẩu mới..."
                className="p-2 rounded-lg border border-amber-300 bg-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPasswordChange(false)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 font-medium cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-sm cursor-pointer"
              >
                Lưu Mật Khẩu Mới
              </button>
            </div>
          </form>
        )}

        {/* Feedback messages */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 pt-3 bg-slate-50 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('drive')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'drive'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderSync className="w-4 h-4" />
            <span>1. Google Drive (Khuyên Dùng)</span>
          </button>

          <button
            onClick={() => setActiveTab('appsscript')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'appsscript'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Link className="w-4 h-4" />
            <span>2. Apps Script Web API</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'upload'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>3. Tải File Excel</span>
          </button>

          <button
            onClick={() => setActiveTab('demo')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'demo'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>4. Dữ Liệu Mẫu</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-slate-700 text-sm flex-1">
          {/* TAB 1: GOOGLE DRIVE DIRECT */}
          {activeTab === 'drive' && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-emerald-600" />
                  Đường dẫn thư mục mục tiêu:
                </h4>
                <div className="font-mono text-xs text-emerald-800 bg-white p-2 rounded-lg border border-slate-200 font-bold">
                  My Drive \ GDQP \ Số hóa chứng chỉ
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Hệ thống tự động quét toàn bộ các file Excel (<code>.xlsx</code>, <code>.xls</code>) và Google Sheets trong thư mục này, lọc dữ liệu từ dòng số 4 theo cấu trúc phôi mẫu chuẩn.
                </p>
              </div>

              {/* Google Sign In status */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200">
                <div className="text-xs">
                  <div className="text-slate-500">Tài khoản Google kết nối:</div>
                  <div className="font-bold text-slate-800 text-sm">
                    {userEmail || (isLoggedInGoogle ? 'Đã liên kết' : 'Chưa đăng nhập')}
                  </div>
                </div>

                {!isLoggedInGoogle ? (
                  <button
                    onClick={handleGoogleLogin}
                    className="flex items-center justify-center space-x-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                    </svg>
                    <span>Đăng nhập Google Drive</span>
                  </button>
                ) : (
                  <button
                    onClick={handleGoogleLogout}
                    className="flex items-center justify-center space-x-1.5 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-xl transition-all font-semibold cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Đăng xuất</span>
                  </button>
                )}
              </div>

              {/* Scan Button with Progress */}
              <div className="pt-2">
                <button
                  onClick={handleScanDriveFolder}
                  disabled={isScanningDrive}
                  className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.99] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <FolderSync className={`w-5 h-5 ${isScanningDrive ? 'animate-spin' : ''}`} />
                  <span>{isScanningDrive ? 'Đang quét và số hóa dữ liệu...' : 'Quét Thư Mục "GDQP / Số hóa chứng chỉ"'}</span>
                </button>

                {scanProgress && (
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{scanProgress.message}</span>
                      <span className="font-mono font-bold text-emerald-600">{scanProgress.percent}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${scanProgress.percent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: GOOGLE APPS SCRIPT API */}
          {activeTab === 'appsscript' && (
            <div className="space-y-4">
              <div className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                <strong className="block font-bold text-amber-950 mb-1">
                  💡 Vì sao nên dùng Google Apps Script Web App?
                </strong>
                Khi triển khai thực tế cho hàng nghìn sinh viên tra cứu trên điện thoại, sinh viên không cần đăng nhập Google mà vẫn tra cứu được dữ liệu từ thư mục GDQP của cán bộ quản lý với tốc độ &lt; 0.5 giây!
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Đường dẫn Web App URL:
                </label>
                <input
                  type="url"
                  value={appsScriptUrlInput}
                  onChange={(e) => setAppsScriptUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                  className="w-full text-xs font-mono p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Lấy từ bước "Triển khai" (Deploy Web App) trên Google Apps Script (xem tab Hướng dẫn).
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveAppsScriptUrl}
                  disabled={isTestingAppsScript || !appsScriptUrlInput.trim()}
                  className="flex-1 flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl shadow transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isTestingAppsScript ? 'animate-spin' : ''}`} />
                  <span>{isTestingAppsScript ? 'Đang kiểm tra...' : 'Kiểm tra & Lưu kết nối'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: UPLOAD LOCAL EXCEL FILE */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-emerald-500/50 hover:border-emerald-600 rounded-2xl p-8 text-center bg-emerald-50/20 hover:bg-emerald-50/40 transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
                <h4 className="font-bold text-slate-800 text-base mb-1">
                  Kéo thả hoặc Nhấp để chọn file Excel (.xlsx, .xls)
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Hỗ trợ tải lên nhiều file cùng lúc (các đợt cấp phát K46, K47, K48). Dữ liệu được lưu trong bộ nhớ máy cực nhanh.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Tự động lưu trữ Đám mây (Cloud Firestore):</strong> Dữ liệu từ file Excel tải lên sẽ được lưu trữ vĩnh viễn trên máy chủ đám mây, giúp <strong>mọi thiết bị, điện thoại và địa chỉ IP khác</strong> đều có thể tra cứu ngay mà không cần tải lại file.
                </div>
              </div>

              {scanProgress && (
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex justify-between text-xs text-slate-700 font-medium">
                    <span>{scanProgress.message}</span>
                    <span className="font-mono font-bold text-emerald-600">{scanProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${scanProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="text-xs text-slate-500 space-y-1">
                <div>• Tự động bỏ qua các dòng tiêu đề trên cùng (đọc dòng 4 trở đi).</div>
                <div>• Nhận diện tự động cột STT, Mã người học (MSSV), Họ tên, Số hiệu, Số vào sổ gốc, Ngày cấp.</div>
              </div>
            </div>
          )}

          {/* TAB 4: DEMO DATASET */}
          {activeTab === 'demo' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Khôi phục lại dữ liệu mẫu với các MSSV thực tế để kiểm tra giao diện và tốc độ phản hồi:
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="text-slate-400 text-[10px]">MSSV:</div>
                  <strong className="text-slate-800">B2101234</strong>
                  <div className="text-emerald-700 text-[11px] mt-0.5">STT: 142 • 15/10/2025</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="text-slate-400 text-[10px]">MSSV:</div>
                  <strong className="text-slate-800">B2105678</strong>
                  <div className="text-emerald-700 text-[11px] mt-0.5">STT: 143 • 15/10/2025</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="text-slate-400 text-[10px]">MSSV:</div>
                  <strong className="text-slate-800">B2209999</strong>
                  <div className="text-emerald-700 text-[11px] mt-0.5">STT: 215 • 22/10/2025</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="text-slate-400 text-[10px]">MSSV:</div>
                  <strong className="text-slate-800">B2012001</strong>
                  <div className="text-emerald-700 text-[11px] mt-0.5">STT: 58 • 10/09/2025</div>
                </div>
              </div>

              <button
                onClick={handleResetDemo}
                className="w-full flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Nạp lại Dữ Liệu Mẫu Chuẩn</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Tốc độ truy vấn: <span className="font-mono font-bold text-emerald-700">&lt; 1 mili-giây</span>
          </div>
          <button
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-5 py-2 rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
