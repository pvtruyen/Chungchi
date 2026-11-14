import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Database,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Sparkles,
  LogOut,
  RefreshCw,
  Lock,
  KeyRound,
  ShieldCheck,
  Trash2,
  Search,
  TableProperties,
  AlertTriangle,
  Flame,
  RotateCcw,
} from 'lucide-react';
import { SyncStatus, CertificateRecord } from '../types/certificate';
import { googleSignInAdmin, logoutGoogle, auth } from '../services/firebaseAuth';
import { parseExcelFile } from '../services/excelParser';
import {
  appendRecords,
  clearAllLocalRecords,
  removeLocalRecord,
  resetToDemo,
  saveSyncStatus,
  getSyncStatus,
} from '../services/storageService';
import { updateAdminPassword, revokeAdminSession } from '../services/adminAuthService';
import {
  appendRecordsToCloud,
  clearAllCertificatesFromCloud,
  fetchCertificatesForAdmin,
  deleteRecordFromCloud,
  seedCloudIfEmpty,
  hasFirestoreWriteQuotaExceeded,
  onFirestoreQuotaStatusChange,
  resetFirestoreWriteQuotaFlag,
  FIRESTORE_PRICING_URL,
} from '../services/firestoreService';
import {
  firebaseConfig,
  parseFirebaseConfigText,
  saveAndReconnectFirebase,
  resetToDefaultFirebaseConfig,
  isUsingCustomFirebaseConfig,
  testFirestoreConnection,
} from '../services/firebaseConfig';
import { ConfirmModal } from './ConfirmModal';

export type DataSourceModalTab = 'firebase_config' | 'upload' | 'manage' | 'demo';

interface DataSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SyncStatus;
  onDataUpdated: () => void;
  onFirebaseConfigChanged?: () => void;
  initialTab?: DataSourceModalTab;
  isLoggedInGoogle: boolean;
  userEmail: string | null;
  onLoginSuccess: (email: string, token: string) => void;
  onLogoutSuccess: () => void;
}

type ConfirmActionState =
  | { type: 'delete_one'; record: CertificateRecord }
  | { type: 'clear_all' }
  | null;

export const DataSourceModal: React.FC<DataSourceModalProps> = ({
  isOpen,
  onClose,
  syncStatus,
  onDataUpdated,
  onFirebaseConfigChanged,
  initialTab = 'firebase_config',
  isLoggedInGoogle,
  userEmail,
  onLoginSuccess,
  onLogoutSuccess,
}) => {
  // CRITICAL: All hooks declared unconditionally before any early return
  const [activeTab, setActiveTab] = useState<DataSourceModalTab>(initialTab);
  const [firebaseSnippetInput, setFirebaseSnippetInput] = useState('');
  const [isTestingFirebase, setIsTestingFirebase] = useState(false);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ message: string; percent: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [manageSearchMssv, setManageSearchMssv] = useState('');
  const [cloudRecords, setCloudRecords] = useState<CertificateRecord[]>([]);
  const [isLoadingCloudList, setIsLoadingCloudList] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState>(null);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);
  const [isQuotaExhausted, setIsQuotaExhausted] = useState<boolean>(() =>
    hasFirestoreWriteQuotaExceeded()
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFirebaseAuthenticated = isLoggedInGoogle || Boolean(auth.currentUser);
  const activeAuthEmail = userEmail || auth.currentUser?.email || null;
  const parsedFirebasePreview = parseFirebaseConfigText(firebaseSnippetInput);
  const isCustomFirebaseActive = isUsingCustomFirebaseConfig();

  const loadCloudRecordsList = async (prefix: string = manageSearchMssv) => {
    if (!auth.currentUser) {
      setCloudRecords([]);
      return;
    }
    setIsLoadingCloudList(true);
    setErrorMsg(null);
    try {
      const list = await fetchCertificatesForAdmin(50, prefix);
      setCloudRecords(list);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.toLowerCase().includes('permission') || raw.toLowerCase().includes('insufficient')) {
        setErrorMsg(
          'Tài khoản Firebase hiện tại chưa có quyền duyệt danh sách trên Firestore Rules. Vui lòng đăng nhập bằng tài khoản Cán bộ Quản trị được cấp phép.'
        );
      } else {
        setErrorMsg(`Không thể tải danh sách từ Firestore: ${raw}`);
      }
    } finally {
      setIsLoadingCloudList(false);
    }
  };

  useEffect(() => {
    const unsubQuota = onFirestoreQuotaStatusChange((exhausted) => {
      setIsQuotaExhausted(exhausted);
    });
    return () => unsubQuota();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setIsQuotaExhausted(hasFirestoreWriteQuotaExceeded());
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (isOpen && activeTab === 'manage' && auth.currentUser) {
      loadCloudRecordsList(manageSearchMssv);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTab, isLoggedInGoogle]);

  if (!isOpen) return null;

  const handleSaveFirebaseSnippet = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const parsed = parseFirebaseConfigText(firebaseSnippetInput);
    if (!parsed) {
      setErrorMsg(
        'Không nhận diện được apiKey và projectId hợp lệ. Vui lòng dán nguyên đoạn const firebaseConfig = { ... }; lấy từ Firebase Console.'
      );
      return;
    }

    setIsTestingFirebase(true);
    try {
      const ok = saveAndReconnectFirebase(parsed);
      if (!ok) {
        throw new Error('Cấu hình Firebase không hợp lệ.');
      }
      resetFirestoreWriteQuotaFlag();
      await testFirestoreConnection();
      onFirebaseConfigChanged?.();
      const current = getSyncStatus();
      saveSyncStatus({
        ...current,
        source: 'local_excel',
        lastUpdated: new Date().toLocaleString('vi-VN'),
      });
      onDataUpdated();
      setSuccessMsg(
        `Đã bóc tách và kết nối thành công tới dự án Firebase [${parsed.projectId}]! Cấu hình đã được lưu tự động.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối Firebase mới';
      setErrorMsg(msg);
    } finally {
      setIsTestingFirebase(false);
    }
  };

  const handleResetDefaultFirebase = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    resetToDefaultFirebaseConfig();
    setIsQuotaExhausted(hasFirestoreWriteQuotaExceeded());
    await testFirestoreConnection();
    onFirebaseConfigChanged?.();
    onDataUpdated();
    setFirebaseSnippetInput('');
    setSuccessMsg('Đã khôi phục kết nối về cơ sở dữ liệu Firebase mặc định của ứng dụng.');
  };

  const handleLockAdminSession = () => {
    revokeAdminSession();
    onClose();
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      setErrorMsg('Mã PIN mới phải có ít nhất 4 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Mã PIN xác nhận không khớp.');
      return;
    }

    const ok = updateAdminPassword(newPassword);
    if (ok) {
      setSuccessMsg('Đã đổi mã PIN quản trị viên thành công!');
      setShowPasswordChange(false);
      setNewPassword('');
      setConfirmPassword('');
      setErrorMsg(null);
    } else {
      setErrorMsg('Không thể đổi mã PIN. Vui lòng thử lại.');
    }
  };

  const handleQuickFirebaseAdminLogin = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await googleSignInAdmin();
      onLoginSuccess(res.user.email || 'Cán bộ Quản trị', '');
      setSuccessMsg(`Đã xác thực Firebase Admin thành công: ${res.user.email}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi đăng nhập Google Firebase';
      setErrorMsg(`Đăng nhập thất bại: ${msg}`);
    }
  };

  const handleGoogleLogout = async () => {
    await logoutGoogle();
    onLogoutSuccess();
    setCloudRecords([]);
    setSuccessMsg('Đã đăng xuất tài khoản Firebase.');
  };

  const processFilesSequentially = async (files: FileList | File[]) => {
    const filesArray = Array.from(files).filter((f) => {
      const lower = f.name.toLowerCase();
      return (
        lower.endsWith('.xlsx') ||
        lower.endsWith('.xls') ||
        lower.endsWith('.csv') ||
        f.type.includes('spreadsheet') ||
        f.type.includes('excel') ||
        f.type === 'text/csv'
      );
    });

    if (filesArray.length === 0) {
      setErrorMsg('Vui lòng chọn file bảng tính hợp lệ (.xlsx, .xls, .csv).');
      return;
    }

    if (!auth.currentUser) {
      setErrorMsg(
        'Bạn cần đăng nhập tài khoản Firebase Cán bộ (nút "Đăng nhập Google Admin" ở thanh trên) trước khi ghi dữ liệu lên Cloud Firestore.'
      );
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsProcessingUpload(true);

    try {
      let totalAddedAllFiles = 0;
      let totalNewlyAdded = 0;
      let totalUpdatedDuplicates = 0;
      let lastUploadedCount = 0;
      const successFileNames: string[] = [];

      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        const basePct = Math.round((i / filesArray.length) * 100);

        setUploadProgress({
          message: `Đang đọc file ${i + 1}/${filesArray.length}: [${file.name}]...`,
          percent: basePct + 2,
        });

        const buffer = await file.arrayBuffer();
        const records = parseExcelFile(buffer, file.name);

        if (records.length === 0) {
          console.warn(`File ${file.name} không tìm thấy bản ghi chứng chỉ nào.`);
          continue;
        }

        appendRecords(records, 'local_excel', file.name);

        const cloudRes = await appendRecordsToCloud(
          records,
          'local_excel',
          file.name,
          (msg, stepPct) => {
            const scaledPct = Math.round(basePct + (stepPct / 100) * (100 / filesArray.length));
            setUploadProgress({
              message: `(${i + 1}/${filesArray.length}) [${file.name}]: ${msg}`,
              percent: Math.min(98, scaledPct),
            });
          }
        );

        if (!cloudRes.success) {
          throw new Error(cloudRes.error || `Lỗi lưu trữ file ${file.name} lên Cloud Firestore`);
        }

        totalAddedAllFiles += cloudRes.totalUploaded;
        totalNewlyAdded += cloudRes.newlyAddedCount;
        totalUpdatedDuplicates += cloudRes.updatedDuplicateCount;
        lastUploadedCount = cloudRes.totalInCloud;
        successFileNames.push(file.name);
      }

      onDataUpdated();

      if (totalAddedAllFiles === 0) {
        throw new Error(
          'Không tìm thấy bản ghi chứng chỉ hợp lệ nào trong các file được tải lên. Hãy kiểm tra cột MSSV, Họ tên, Số hiệu, Số vào sổ.'
        );
      }

      setSuccessMsg(
        `Đã nạp cộng dồn thành công ${totalAddedAllFiles.toLocaleString('vi-VN')} bản ghi từ ${successFileNames.length} file lên Cloud Firestore (Thêm mới: ${totalNewlyAdded.toLocaleString('vi-VN')}, Cập nhật trùng MSSV: ${totalUpdatedDuplicates.toLocaleString('vi-VN')}). Tổng toàn hệ thống: ${lastUploadedCount.toLocaleString('vi-VN')} chứng chỉ!`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi đọc và lưu file Excel';
      setErrorMsg(msg);
    } finally {
      setIsProcessingUpload(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFilesSequentially(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFilesSequentially(e.dataTransfer.files);
    }
  };

  const handleExecuteConfirmAction = async () => {
    if (!confirmAction) return;
    setIsProcessingDelete(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (confirmAction.type === 'delete_one') {
        const target = confirmAction.record;
        const res = await deleteRecordFromCloud(target.mssv);
        if (!res.success) {
          throw new Error(res.error || 'Không thể xóa chứng chỉ trên Cloud Firestore.');
        }
        removeLocalRecord(target.mssv, res.totalInCloud);
        setCloudRecords((prev) => prev.filter((item) => item.mssv !== target.mssv));
        onDataUpdated();
        setSuccessMsg(
          `Đã xóa chứng chỉ của sinh viên ${target.hoVaTen} (${target.mssv}) khỏi Cloud Firestore.`
        );
      } else if (confirmAction.type === 'clear_all') {
        setIsProcessingUpload(true);
        setUploadProgress({ message: 'Đang xóa toàn bộ dữ liệu trên Cloud Firestore...', percent: 20 });
        const res = await clearAllCertificatesFromCloud((msg, pct) => {
          setUploadProgress({ message: msg, percent: pct });
        });
        if (!res.success) {
          throw new Error(res.error || 'Lỗi khi xóa toàn bộ dữ liệu trên Cloud Firestore.');
        }
        clearAllLocalRecords();
        setCloudRecords([]);
        onDataUpdated();
        setSuccessMsg('Đã xóa sạch toàn bộ danh sách chứng chỉ trên Cloud Firestore thành công!');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi xóa dữ liệu';
      setErrorMsg(msg);
    } finally {
      setIsProcessingDelete(false);
      setIsProcessingUpload(false);
      setUploadProgress(null);
      setConfirmAction(null);
    }
  };

  const handleResetDemo = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    resetToDemo();
    if (auth.currentUser) {
      await seedCloudIfEmpty();
    }
    onDataUpdated();
    setSuccessMsg('Đã khôi phục dữ liệu mẫu chuẩn. Bạn có thể thử tra cứu ngay MSSV B2101234 hoặc B2105678.');
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-blue-400/20 bg-[#002855] text-white">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-blue-300/25 flex items-center justify-center">
                <Database className="w-5 h-5 text-sky-300" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Cài Đặt Hệ Thống &amp; Quản Lý Dữ Liệu Cloud
                </h3>
                <p className="text-[11px] text-blue-200">
                  Đại học Cần Thơ — Lưu trữ Cloud Firestore &amp; Nạp Excel cộng dồn
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cloud Status Bar */}
          <div className="bg-blue-50/90 border-b border-blue-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <span className="font-bold text-[#002855]">
                Nguồn dữ liệu đang hoạt động:
              </span>
              <span className="font-semibold text-[#004B8D]">
                {syncStatus.source === 'demo_data' ? 'Dữ liệu mẫu thử' : 'Firebase Cloud Firestore'}
              </span>
            </div>
            <div className="font-mono font-extrabold text-[#002855] bg-white px-2.5 py-1 rounded-lg border border-blue-200">
              {syncStatus.totalRecords.toLocaleString('vi-VN')} chứng chỉ
            </div>
          </div>

          {/* Firebase Auth & Admin Security Bar */}
          <div className="bg-[#001E3C] text-blue-100 px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs border-b border-blue-900">
            <div className="flex items-center space-x-2">
              <ShieldCheck
                className={`w-4 h-4 shrink-0 ${
                  isFirebaseAuthenticated ? 'text-emerald-400' : 'text-amber-400'
                }`}
              />
              {isFirebaseAuthenticated ? (
                <span>
                  Firebase Admin:{' '}
                  <strong className="text-white font-semibold">{activeAuthEmail || 'Đã xác thực'}</strong>
                </span>
              ) : (
                <span className="text-amber-200 font-medium">
                  Chưa đăng nhập Google Admin (cần để nạp Excel / xóa trên Cloud)
                </span>
              )}
            </div>

            <div className="flex items-center flex-wrap gap-2.5">
              {!isFirebaseAuthenticated ? (
                <button
                  type="button"
                  onClick={handleQuickFirebaseAdminLogin}
                  className="bg-white text-[#002855] hover:bg-blue-50 font-bold px-2.5 py-1 rounded-lg text-[11px] shadow-xs cursor-pointer transition-colors"
                >
                  Đăng nhập Google Admin
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleLogout}
                  className="text-[11px] text-sky-200 hover:text-white hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Đăng xuất Firebase</span>
                </button>
              )}
              <span className="text-blue-700">|</span>
              <button
                type="button"
                onClick={() => setShowPasswordChange(!showPasswordChange)}
                className="text-xs text-amber-300 hover:text-amber-200 hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{showPasswordChange ? 'Đóng đổi PIN' : 'Đổi mã PIN'}</span>
              </button>
              <span className="text-blue-700">|</span>
              <button
                type="button"
                onClick={handleLockAdminSession}
                className="text-xs text-rose-300 hover:text-rose-200 hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Khóa phiên</span>
              </button>
            </div>
          </div>

          {/* PIN Change Drawer */}
          {showPasswordChange && (
            <form
              onSubmit={handleChangePasswordSubmit}
              className="bg-amber-50/90 border-b border-amber-200 px-6 py-3.5 text-xs text-amber-950 space-y-2.5 animate-in fade-in"
            >
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <KeyRound className="w-4 h-4 text-amber-700" />
                Đổi Mã PIN Mở Khóa Giao Diện Quản Trị &amp; Lịch Sử Phát Bằng:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mã PIN mới (tối thiểu 4 ký tự)..."
                  className="p-2 rounded-lg border border-amber-300 bg-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Xác nhận lại mã PIN mới..."
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
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  Lưu Mã PIN Mới
                </button>
              </div>
            </form>
          )}

          {/* Firestore Daily Quota Notice */}
          {isQuotaExhausted && (
            <div className="mx-6 mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Cơ sở dữ liệu Firestore [{firebaseConfig.projectId}] đã đạt giới hạn ghi miễn phí trong ngày (Quota exceeded).</strong>{' '}
                  Hạn mức sẽ tự động đặt lại vào ngày mai. Dữ liệu đã lưu vẫn <strong>tra cứu bình thường</strong>. Để tiếp tục nạp mới ngay hôm nay, bạn có thể dán <code className="bg-white px-1 rounded border border-amber-200">firebaseConfig</code> của dự án cá nhân ở Tab 1.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('firebase_config')}
                  className="bg-[#004B8D] hover:bg-[#00529C] text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                >
                  Đổi Project Firebase
                </button>
                <button
                  type="button"
                  onClick={() => resetFirestoreWriteQuotaFlag()}
                  className="text-[#004B8D] hover:underline font-semibold cursor-pointer"
                >
                  Đặt lại trạng thái kiểm tra
                </button>
                <a
                  href={FIRESTORE_PRICING_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-600 hover:underline font-medium ml-auto"
                >
                  Xem Spark plan →
                </a>
              </div>
            </div>
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
              type="button"
              onClick={() => setActiveTab('firebase_config')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'firebase_config'
                  ? 'border-[#004B8D] text-[#003B73]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Flame className="w-4 h-4 text-amber-500" />
              <span>1. Cài đặt Firebase</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'upload'
                  ? 'border-[#004B8D] text-[#003B73]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>2. Nạp Excel (Cộng dồn)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('manage')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'manage'
                  ? 'border-[#004B8D] text-[#003B73]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <TableProperties className="w-4 h-4" />
              <span>3. Quản lý &amp; Xóa</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('demo')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'demo'
                  ? 'border-[#004B8D] text-[#003B73]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>4. Mẫu thử</span>
            </button>
          </div>

          {/* Tab Content Body */}
          <div className="p-6 overflow-y-auto space-y-4 text-slate-700 text-sm flex-1">
            {/* TAB 1: NO-CODE FIREBASE SETTINGS */}
            {activeTab === 'firebase_config' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        {isCustomFirebaseActive
                          ? 'Đang kết nối bằng cấu hình Firebase tùy chỉnh của bạn'
                          : 'Đã tự động kết nối sẵn Firebase Cloud của hệ thống'}
                      </span>
                    </div>
                    <div className="text-[11px] text-emerald-800 mt-0.5 font-mono">
                      Project ID: <strong>{firebaseConfig.projectId}</strong>
                    </div>
                  </div>
                  {isCustomFirebaseActive && (
                    <button
                      type="button"
                      onClick={handleResetDefaultFirebase}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#004B8D] bg-white hover:bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 cursor-pointer shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Khôi phục mặc định</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Dán nguyên đoạn <code className="text-[#004B8D]">firebaseConfig</code> từ Firebase Console (nếu muốn đổi sang dự án riêng):
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Không cần tách từng dòng! Chỉ cần sao chép toàn bộ đoạn <code>const firebaseConfig = &#123; ... &#125;;</code> và dán vào ô bên dưới, hệ thống sẽ tự động bóc tách.
                  </p>
                  <textarea
                    rows={7}
                    value={firebaseSnippetInput}
                    onChange={(e) => setFirebaseSnippetInput(e.target.value)}
                    placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "du-an-cua-ban.firebaseapp.com",\n  projectId: "du-an-cua-ban",\n  storageBucket: "du-an-cua-ban.firebasestorage.app",\n  messagingSenderId: "123456789",\n  appId: "1:123456789:web:abcdef"\n};`}
                    className="w-full p-3.5 rounded-2xl border border-slate-300 bg-slate-50 focus:bg-white font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00529C]"
                  />
                </div>

                {/* Live Parsed Preview */}
                {firebaseSnippetInput.trim() && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs ${
                      parsedFirebasePreview
                        ? 'bg-blue-50 border-blue-200 text-[#002855]'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    {parsedFirebasePreview ? (
                      <div className="space-y-1">
                        <div className="font-bold text-[#004B8D]">
                          Đã nhận diện tự động thông số Firebase:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 font-mono text-[11px]">
                          <div>projectId: <strong>{parsedFirebasePreview.projectId}</strong></div>
                          <div>authDomain: <strong>{parsedFirebasePreview.authDomain}</strong></div>
                          <div>apiKey: <strong>{parsedFirebasePreview.apiKey.slice(0, 10)}...</strong></div>
                          <div>appId: <strong>{parsedFirebasePreview.appId || '(tự động)'}</strong></div>
                        </div>
                      </div>
                    ) : (
                      <span>Chưa tìm thấy đầy đủ apiKey và projectId trong đoạn mã vừa dán.</span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={handleSaveFirebaseSnippet}
                    disabled={isTestingFirebase || !parsedFirebasePreview}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#004B8D] hover:bg-[#00529C] text-white font-bold py-3 px-4 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isTestingFirebase ? 'Đang kết nối...' : 'Kết nối & Lưu'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: UPLOAD EXCEL / CSV & APPEND */}
            {activeTab === 'upload' && (
              <div className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer group ${
                    isDragging
                      ? 'border-[#00529C] bg-blue-100/60 scale-[1.01] shadow-lg'
                      : 'border-[#00529C]/40 hover:border-[#004B8D] bg-blue-50/30 hover:bg-blue-50/60'
                  }`}
                >
                  <FileSpreadsheet className="w-12 h-12 text-[#004B8D] mx-auto mb-3 group-hover:scale-110 transition-transform" />
                  <h4 className="font-bold text-slate-900 text-base mb-1">
                    {isDragging
                      ? 'Thả các file vào đây để nạp lên Cloud'
                      : 'Chọn hoặc Kéo thả file Excel / CSV (.xlsx, .xls, .csv)'}
                  </h4>
                  <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
                    Hỗ trợ chọn <strong>nhiều file cùng lúc</strong>. Hệ thống nạp tuần tự từng file, giữ nguyên dữ liệu cũ và <strong>cộng dồn (Append)</strong> lên Cloud Firestore.
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-white font-bold bg-[#004B8D] hover:bg-[#00529C] px-4 py-2 rounded-xl shadow-xs transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Chọn file Excel từ máy tính</span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {uploadProgress && (
                  <div className="space-y-1.5 p-3.5 rounded-xl bg-blue-50/60 border border-blue-200">
                    <div className="flex justify-between text-xs text-[#003B73] font-semibold">
                      <span>{uploadProgress.message}</span>
                      <span className="font-mono font-bold text-[#004B8D]">{uploadProgress.percent}%</span>
                    </div>
                    <div className="w-full bg-blue-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-[#004B8D] h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                {syncStatus.fileNames && syncStatus.fileNames.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Các đợt file đã nạp cộng dồn:</span>
                      <span className="font-mono font-bold text-[#004B8D]">
                        {syncStatus.fileNames.length} file
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {syncStatus.fileNames.map((fn, idx) => (
                        <span
                          key={idx}
                          className="bg-white text-slate-700 text-[11px] font-mono px-2 py-0.5 rounded border border-slate-200"
                        >
                          {fn}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-1.5 text-rose-800 font-bold text-xs">
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>Xóa dữ liệu trên Cloud Firebase</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Xóa từng dòng ở tab <strong>3. Quản lý &amp; Xóa</strong> hoặc xóa toàn bộ khi cần làm mới.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmAction({ type: 'clear_all' })}
                    disabled={isProcessingUpload}
                    className="shrink-0 flex items-center justify-center space-x-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-3.5 rounded-xl shadow-xs text-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa toàn bộ Cloud</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: MANAGE & DELETE */}
            {activeTab === 'manage' && (
              <div className="space-y-4">
                {!isFirebaseAuthenticated && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold block">Yêu cầu đăng nhập Google Admin</strong>
                        <span>
                          Để bảo vệ dữ liệu theo Security Rules, chỉ Cán bộ Quản trị đã đăng nhập Firebase mới được xem danh sách và xóa bản ghi trên Cloud.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleQuickFirebaseAdminLogin}
                      className="shrink-0 bg-[#004B8D] hover:bg-[#00529C] text-white font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer"
                    >
                      Đăng nhập Google Admin
                    </button>
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    loadCloudRecordsList(manageSearchMssv);
                  }}
                  className="flex flex-col sm:flex-row gap-2"
                >
                  <div className="relative flex-1 flex items-center">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      value={manageSearchMssv}
                      onChange={(e) => setManageSearchMssv(e.target.value)}
                      placeholder="Lọc theo đầu MSSV (VD: B210... hoặc để trống xem 50 hồ sơ đầu)"
                      className="w-full text-xs py-2.5 pl-9 pr-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#00529C] font-mono uppercase"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoadingCloudList || !isFirebaseAuthenticated}
                    className="flex items-center justify-center space-x-1.5 bg-[#004B8D] hover:bg-[#00529C] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCloudList ? 'animate-spin' : ''}`} />
                    <span>{isLoadingCloudList ? 'Đang tải...' : 'Tải danh sách'}</span>
                  </button>
                </form>

                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#002855] text-white sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3 font-bold">MSSV</th>
                          <th className="py-2.5 px-3 font-bold">Họ và tên</th>
                          <th className="py-2.5 px-3 font-bold">Số lưu vào sổ gốc</th>
                          <th className="py-2.5 px-3 font-bold">Số hiệu văn bằng</th>
                          <th className="py-2.5 px-3 font-bold text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {isLoadingCloudList ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">
                              Đang tải dữ liệu từ Cloud Firestore...
                            </td>
                          </tr>
                        ) : cloudRecords.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">
                              {isFirebaseAuthenticated
                                ? 'Không có bản ghi phù hợp hoặc dữ liệu trên Cloud đang trống.'
                                : 'Vui lòng đăng nhập Google Admin để xem danh sách.'}
                            </td>
                          </tr>
                        ) : (
                          cloudRecords.map((rec) => (
                            <tr key={rec.mssv} className="hover:bg-blue-50/50 transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-[#003B73]">
                                {rec.mssv}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                {rec.hoVaTen}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-amber-700">
                                {rec.soVaoSoGoc || '—'}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-semibold text-[#004B8D]">
                                {rec.soHieuChungChi || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => setConfirmAction({ type: 'delete_one', record: rec })}
                                  className="inline-flex items-center space-x-1 text-rose-600 hover:text-white hover:bg-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Xóa</span>
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-1.5 text-rose-800 font-bold text-xs">
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>Xóa toàn bộ dữ liệu chứng chỉ trên Cloud Firebase</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Dọn sạch toàn bộ bản ghi trên Cloud Firestore để nhập lại từ đầu.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmAction({ type: 'clear_all' })}
                    disabled={isProcessingUpload || !isFirebaseAuthenticated}
                    className="shrink-0 flex items-center justify-center space-x-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-xs text-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa toàn bộ dữ liệu</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: DEMO DATASET */}
            {activeTab === 'demo' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Khôi phục lại dữ liệu mẫu chuẩn của Đại học Cần Thơ để kiểm tra giao diện tra cứu:
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <div className="text-slate-400 text-[10px]">MSSV:</div>
                    <strong className="text-slate-800">B2101234</strong>
                    <div className="text-[#004B8D] text-[11px] mt-0.5">Sổ gốc: 890/2025/GDQP</div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <div className="text-slate-400 text-[10px]">MSSV:</div>
                    <strong className="text-slate-800">B2105678</strong>
                    <div className="text-[#004B8D] text-[11px] mt-0.5">Sổ gốc: 891/2025/GDQP</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetDemo}
                  className="w-full flex items-center justify-center space-x-1.5 bg-[#002855] hover:bg-[#003B73] text-amber-300 font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer"
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
              Đại học Cần Thơ —{' '}
              <span className="font-mono font-bold text-[#004B8D]">
                Firebase Cloud Firestore
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="bg-[#002855] hover:bg-[#003B73] text-white font-semibold text-xs px-5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmAction !== null}
        title={
          confirmAction?.type === 'delete_one'
            ? `Xóa chứng chỉ MSSV ${confirmAction.record.mssv}`
            : 'Xác nhận xóa toàn bộ dữ liệu Cloud'
        }
        message={
          confirmAction?.type === 'delete_one'
            ? `Bạn có chắc chắn muốn xóa vĩnh viễn chứng chỉ của sinh viên "${confirmAction.record.hoVaTen}" (MSSV: ${confirmAction.record.mssv}) khỏi Cloud Firestore?`
            : 'CẢNH BÁO: Thao tác này sẽ xóa vĩnh viễn TOÀN BỘ danh sách chứng chỉ đang lưu trên Cloud Firestore. Không thể hoàn tác!'
        }
        confirmLabel={confirmAction?.type === 'delete_one' ? 'Xóa bản ghi này' : 'Xóa toàn bộ dữ liệu'}
        variant="danger"
        isProcessing={isProcessingDelete}
        onConfirm={handleExecuteConfirmAction}
        onCancel={() => {
          if (!isProcessingDelete) setConfirmAction(null);
        }}
      />
    </>
  );
};
