import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  FolderSync,
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
  Copy,
  Check,
  RotateCcw,
  HardDrive,
} from 'lucide-react';
import { SyncStatus, CertificateRecord } from '../types/certificate';
import { googleSignIn, googleSignInAdmin, logoutGoogle, auth } from '../services/firebaseAuth';
import { findGdqpFolder, scanDriveFolderForCertificates } from '../services/googleDriveService';
import { parseExcelFile } from '../services/excelParser';
import {
  saveRecords,
  appendRecords,
  clearAllLocalRecords,
  removeLocalRecord,
  saveAppsScriptUrl,
  getSavedAppsScriptUrl,
  saveDriveFolderUrl,
  getSavedDriveFolderUrl,
  extractDriveFolderId,
  switchDataSourceMode,
  resetToDemo,
  getSyncStatus,
} from '../services/storageService';
import {
  pingAppsScript,
  syncAllFromAppsScript,
} from '../services/appsScriptConnector';
import { updateAdminPassword, revokeAdminSession } from '../services/adminAuthService';
import {
  saveRecordsToCloud,
  appendRecordsToCloud,
  clearAllCertificatesFromCloud,
  fetchCertificatesForAdmin,
  deleteRecordFromCloud,
  seedCloudIfEmpty,
  saveCloudSyncStatus,
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
import { buildShortAppsScriptCode } from '../data/deploymentGuide';
import { ConfirmModal } from './ConfirmModal';

export type DataSourceModalTab = 'firebase_config' | 'drive_config' | 'upload' | 'manage' | 'demo';

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
  const [driveLinkInput, setDriveLinkInput] = useState(
    () => getSavedAppsScriptUrl() || getSavedDriveFolderUrl()
  );
  const [savedDriveFolderId, setSavedDriveFolderId] = useState(() =>
    extractDriveFolderId(getSavedDriveFolderUrl())
  );
  const [copiedScript, setCopiedScript] = useState(false);
  const [isScanningDrive, setIsScanningDrive] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ message: string; percent: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isTestingAppsScript, setIsTestingAppsScript] = useState(false);
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
  const [pendingCloudSyncStatus, setPendingCloudSyncStatus] = useState<SyncStatus | null>(null);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
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
      const syncedUrl = getSavedAppsScriptUrl() || syncStatus.appsScriptUrl || getSavedDriveFolderUrl();
      if (syncedUrl && !driveLinkInput) {
        setDriveLinkInput(syncedUrl);
      }
    }
  }, [isOpen, initialTab, syncStatus.appsScriptUrl, driveLinkInput]);

  useEffect(() => {
    if (isOpen && activeTab === 'manage' && auth.currentUser) {
      loadCloudRecordsList(manageSearchMssv);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTab, isLoggedInGoogle]);

  if (!isOpen) return null;

  const currentMode: 'firebase' | 'drive' =
    syncStatus.source === 'apps_script' || syncStatus.source === 'drive_oauth' ? 'drive' : 'firebase';

  const handleSwitchMode = async (mode: 'firebase' | 'drive') => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (mode === 'drive' && !getSavedAppsScriptUrl() && syncStatus.source !== 'drive_oauth') {
      setActiveTab('drive_config');
      setErrorMsg('Chưa có Link Google Apps Script Web App. Vui lòng dán link ở bên dưới và bấm "Kiểm tra & Nạp dữ liệu".');
      return;
    }
    const updated = switchDataSourceMode(mode);
    onDataUpdated();
    if (auth.currentUser) {
      const cloudRes = await saveCloudSyncStatus(updated);
      if (!cloudRes.success && cloudRes.needsAuth) {
        setPendingCloudSyncStatus(updated);
      }
    } else if (mode === 'drive' && updated.appsScriptUrl) {
      setPendingCloudSyncStatus(updated);
    }
    setSuccessMsg(
      mode === 'drive'
        ? 'Đã chuyển sang Chế độ 2: Thư mục Google Drive ("Số hóa chứng chỉ").'
        : 'Đã chuyển sang Chế độ 1: Dữ liệu Firebase Cloud.'
    );
  };

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
      switchDataSourceMode('firebase');
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

  const handleSaveDriveConnection = async () => {
    const raw = driveLinkInput.trim();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!raw) {
      setErrorMsg('Vui lòng dán Link thư mục Google Drive hoặc Link Google Apps Script Web App.');
      return;
    }

    // Case 1: Google Apps Script Web App URL
    if (raw.includes('script.google.com/macros/')) {
      setIsTestingAppsScript(true);
      setIsScanningDrive(true);
      setScanProgress({ message: 'Đang kiểm tra kết nối thư mục Google Drive qua Apps Script...', percent: 25 });
      try {
        const ping = await pingAppsScript(raw);
        if (!ping.success) {
          throw new Error(ping.error || 'Không thể kết nối tới Google Apps Script.');
        }

        const pingFiles = ping.files || [];
        const fileNames = pingFiles.map((f) => f.name);
        saveAppsScriptUrl(raw);

        setScanProgress({
          message: `Tìm thấy ${pingFiles.length} file trong "${ping.folderName || 'Số hóa chứng chỉ'}". Đang tải dữ liệu vào bộ nhớ tra cứu...`,
          percent: 60,
        });

        const synced = await syncAllFromAppsScript(raw);
        const loadedRecords = synced.records || [];
        const finalFiles = synced.files || pingFiles;

        if (loadedRecords.length > 0) {
          saveRecords(loadedRecords, 'apps_script', finalFiles.map((f) => f.name), {
            driveFolderFound: true,
            driveFolderName: synced.folderName || ping.folderName || 'Số hóa chứng chỉ',
            driveFolderId: synced.folderId || ping.folderId,
            driveFiles: finalFiles,
          });
        } else {
          saveRecords([], 'apps_script', fileNames, {
            driveFolderFound: true,
            driveFolderName: ping.folderName || 'Số hóa chứng chỉ',
            driveFolderId: ping.folderId,
            driveFiles: finalFiles,
          });
        }

        const latestStatus = getSyncStatus();
        const cloudSyncRes = await saveCloudSyncStatus({
          ...latestStatus,
          source: 'apps_script',
          appsScriptUrl: raw,
          driveFolderFound: true,
        });

        onDataUpdated();

        const errorFiles = finalFiles.filter((f) => f.status === 'error');
        if (errorFiles.length > 0) {
          setErrorMsg(
            `Đã kết nối thư mục "${synced.folderName || ping.folderName || 'Số hóa chứng chỉ'}" nhưng có ${errorFiles.length} file lỗi đọc dữ liệu: ${errorFiles.map((f) => `${f.name} (${f.error})`).join('; ')}`
          );
        } else if (finalFiles.length === 0) {
          setErrorMsg(
            `Đã kết nối tới thư mục "${ping.folderName || 'Số hóa chứng chỉ'}" nhưng thư mục chưa có file Excel (.xlsx, .xls, .csv) hoặc Google Sheets nào.`
          );
        } else if (!cloudSyncRes.success) {
          setPendingCloudSyncStatus({
            ...latestStatus,
            source: 'apps_script',
            appsScriptUrl: raw,
            driveFolderFound: true,
          });
          setSuccessMsg(
            `Đã nạp ${loadedRecords.length.toLocaleString('vi-VN')} chứng chỉ từ ${finalFiles.length} file trên máy này! Lưu ý: ${cloudSyncRes.error}`
          );
        } else {
          setPendingCloudSyncStatus(null);
          setSuccessMsg(
            `Đã kết nối ${finalFiles.length} file (${loadedRecords.length.toLocaleString('vi-VN')} chứng chỉ) VÀ đã đồng bộ Link Apps Script lên Cloud! Mọi máy khác mở web đều có thể tìm kiếm ngay.`
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Không thể kết nối tới Google Apps Script';
        setErrorMsg(
          `Kiểm tra thất bại: ${msg}. Hãy đảm bảo bạn đã Deploy Web App với quyền truy cập "Anyone" (Bất kỳ ai).`
        );
      } finally {
        setIsTestingAppsScript(false);
        setIsScanningDrive(false);
        setScanProgress(null);
      }
      return;
    }

    // Case 2: Google Drive Folder Share Link (or Folder ID)
    const folderId = extractDriveFolderId(raw);
    if (folderId) {
      saveDriveFolderUrl(raw);
      setSavedDriveFolderId(folderId);
      setSuccessMsg(
        `Đã lưu Folder ID (${folderId})! Bạn có thể bấm nút "Quét & Tải Excel bằng Google (1-Click)" ngay bên dưới để đọc trực tiếp các file Excel trong thư mục này, HOẶC Copy Script để dùng link Web App công khai.`
      );
      return;
    }

    setErrorMsg(
      'Đường link không đúng định dạng. Vui lòng dán Link chia sẻ thư mục Google Drive (drive.google.com/drive/folders/...) hoặc Link Web App Apps Script (script.google.com/macros/...).'
    );
  };

  const handleCopyShortScript = () => {
    navigator.clipboard.writeText(buildShortAppsScriptCode(savedDriveFolderId));
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
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
      if (pendingCloudSyncStatus) {
        const cloudRes = await saveCloudSyncStatus(pendingCloudSyncStatus);
        if (cloudRes.success) {
          setPendingCloudSyncStatus(null);
          setSuccessMsg(
            `Đã đăng nhập (${res.user.email}) và đồng bộ cấu hình Google Drive lên Cloud thành công! Các máy khác mở web sẽ tìm kiếm được ngay.`
          );
          return;
        }
      }
      setSuccessMsg(`Đã xác thực Firebase Admin thành công: ${res.user.email}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi đăng nhập Google Firebase';
      setErrorMsg(`Đăng nhập thất bại: ${msg}`);
    }
  };

  const handleCopyShareAppsScriptLink = () => {
    const scriptUrl = getSavedAppsScriptUrl() || syncStatus.appsScriptUrl || driveLinkInput.trim();
    if (!scriptUrl || !scriptUrl.includes('script.google.com/macros/')) return;
    const base = `${window.location.origin}${window.location.pathname}`;
    const fullShareUrl = `${base}?appsScript=${encodeURIComponent(scriptUrl)}`;
    navigator.clipboard.writeText(fullShareUrl);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2500);
  };

  const handleGoogleLogout = async () => {
    await logoutGoogle();
    onLogoutSuccess();
    setCloudRecords([]);
    setSuccessMsg('Đã đăng xuất tài khoản Firebase.');
  };

  const handleScanDriveFolder = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsScanningDrive(true);
    setScanProgress({ message: 'Đang xác thực quyền đọc Google Drive...', percent: 5 });

    try {
      const res = await googleSignIn();
      if (!res?.accessToken) {
        throw new Error('Chưa có quyền truy cập Google Drive. Vui lòng đăng nhập.');
      }

      const inlineFolderId = extractDriveFolderId(driveLinkInput);
      let folderIdToScan = inlineFolderId || savedDriveFolderId;
      let folderDisplayName = 'Số hóa chứng chỉ';

      if (inlineFolderId) {
        saveDriveFolderUrl(driveLinkInput.trim());
        setSavedDriveFolderId(inlineFolderId);
        folderDisplayName = `Thư mục Drive (${inlineFolderId.slice(0, 10)}...)`;
      } else if (!folderIdToScan) {
        setScanProgress({ message: 'Đang tìm thư mục "GDQP / Số hóa chứng chỉ"...', percent: 15 });
        const folder = await findGdqpFolder(res.accessToken);
        if (!folder) {
          throw new Error(
            'Không tìm thấy thư mục "GDQP" hoặc "Số hóa chứng chỉ" trong Google Drive của bạn. Hãy dán trực tiếp Link chia sẻ thư mục Drive vào ô phía trên rồi bấm quét lại.'
          );
        }
        folderIdToScan = folder.folderId;
        folderDisplayName = folder.folderPath;
      }

      setScanProgress({ message: `Đang quét các file Excel trong "${folderDisplayName}"...`, percent: 25 });
      const scanResult = await scanDriveFolderForCertificates(
        res.accessToken,
        folderIdToScan,
        (msg, pct) => setScanProgress({ message: msg, percent: pct })
      );

      saveRecords(scanResult.records, 'drive_oauth', scanResult.filesScanned, {
        driveFolderFound: true,
        driveFolderName: folderDisplayName,
        driveFolderId: folderIdToScan,
        driveFiles: scanResult.fileDiagnostics,
      });
      onDataUpdated();

      if (scanResult.records.length === 0) {
        throw new Error(
          scanResult.fileDiagnostics.length === 0
            ? `Thư mục "${folderDisplayName}" không có file Excel (.xlsx, .xls, .csv) hoặc Google Sheets nào.`
            : `Đã thấy ${scanResult.fileDiagnostics.length} file trong "${folderDisplayName}" nhưng chưa đọc được dữ liệu MSSV/Họ tên. Vui lòng kiểm tra tên cột trong bảng chi tiết bên dưới.`
        );
      }

      // Đồng bộ tùy chọn lên Cloud Firestore nếu còn hạn mức ghi (không làm lỗi Chế độ 2 nếu Firestore hết hạn mức)
      let cloudSyncNote = '';
      if (!hasFirestoreWriteQuotaExceeded() && auth.currentUser) {
        setScanProgress({ message: 'Đang lưu bản sao lên Cloud Firestore...', percent: 90 });
        const cloudRes = await saveRecordsToCloud(
          scanResult.records,
          'drive_oauth',
          scanResult.filesScanned,
          (msg, pct) => setScanProgress({ message: msg, percent: pct })
        );
        if (!cloudRes.success) {
          cloudSyncNote = ' (Chưa đồng bộ bản sao lên Firestore do hạn mức ghi, nhưng Chế độ 2 trên trình duyệt đã sẵn sàng tra cứu 100%).';
        } else {
          cloudSyncNote = ' Đã đồng bộ thêm bản sao lên Cloud Firestore.';
        }
      }

      setSuccessMsg(
        `Đã kết nối & tải thành công ${scanResult.records.length.toLocaleString('vi-VN')} chứng chỉ từ ${scanResult.filesScanned.length} file trên Google Drive!${cloudSyncNote}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi quét thư mục Google Drive';
      setErrorMsg(msg);
    } finally {
      setIsScanningDrive(false);
      setScanProgress(null);
    }
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
    setIsScanningDrive(true);

    try {
      let totalAddedAllFiles = 0;
      let totalNewlyAdded = 0;
      let totalUpdatedDuplicates = 0;
      let lastUploadedCount = 0;
      const successFileNames: string[] = [];

      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        const basePct = Math.round((i / filesArray.length) * 100);

        setScanProgress({
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
            setScanProgress({
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
      setIsScanningDrive(false);
      setScanProgress(null);
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
        setIsScanningDrive(true);
        setScanProgress({ message: 'Đang xóa toàn bộ dữ liệu trên Cloud Firestore...', percent: 20 });
        const res = await clearAllCertificatesFromCloud((msg, pct) => {
          setScanProgress({ message: msg, percent: pct });
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
      setIsScanningDrive(false);
      setScanProgress(null);
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
                  Cài Đặt Hệ Thống &amp; Nguồn Dữ Liệu (Không Chạm Code)
                </h3>
                <p className="text-[11px] text-blue-200">
                  Đại học Cần Thơ — Tự động cấu hình Firebase &amp; Google Drive trên trình duyệt
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

          {/* Quick Mode Switcher Banner (Mode 1 vs Mode 2) */}
          <div className="bg-blue-50/90 border-b border-blue-200 px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[#002855]">Chế độ tra cứu:</span>
              <button
                type="button"
                onClick={() => handleSwitchMode('firebase')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  currentMode === 'firebase'
                    ? 'bg-[#004B8D] text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-amber-300" />
                <span>Chế độ 1: Firebase Cloud</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode('drive')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  currentMode === 'drive'
                    ? 'bg-[#004B8D] text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5 text-sky-300" />
                <span>Chế độ 2: Google Drive</span>
              </button>
            </div>
            <div className="font-mono font-extrabold text-[#002855] bg-white px-2.5 py-1 rounded-lg border border-blue-200 self-start sm:self-auto">
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
                  Chưa đăng nhập Google Admin (cần để ghi/xóa trên Cloud)
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
                Đổi Mã PIN Mở Khóa Giao Diện Quản Trị:
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
                  Hạn mức sẽ tự động đặt lại vào ngày mai. Dữ liệu đã lưu vẫn <strong>tra cứu bình thường</strong>. Để tiếp tục nạp mới ngay hôm nay, bạn có thể dán <code className="bg-white px-1 rounded border border-amber-200">firebaseConfig</code> của dự án cá nhân ở Tab 1 hoặc dùng <strong>Chế độ 2: Google Drive</strong> ở Tab 2.
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
                  onClick={() => setActiveTab('drive_config')}
                  className="bg-white hover:bg-amber-100 text-amber-900 font-bold px-2.5 py-1 rounded-lg border border-amber-300 cursor-pointer"
                >
                  Chuyển Google Drive
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
              onClick={() => setActiveTab('drive_config')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'drive_config'
                  ? 'border-[#004B8D] text-[#003B73]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <HardDrive className="w-4 h-4 text-[#004B8D]" />
              <span>2. Google Drive</span>
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
              <span>3. Nạp Excel (Cộng dồn)</span>
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
              <span>4. Quản lý &amp; Xóa</span>
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
              <span>5. Mẫu thử</span>
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

            {/* TAB 2: NO-CODE GOOGLE DRIVE ("Số hóa chứng chỉ") */}
            {activeTab === 'drive_config' && (
              <div className="space-y-4">
                {/* Live Mode 2 Connection Status & File List */}
                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 space-y-3 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-[#002855] text-sm flex items-center gap-1.5">
                        <HardDrive className="w-4 h-4 text-[#004B8D]" />
                        <span>
                          Trạng thái kết nối Chế độ 2: {syncStatus.driveFolderName || 'Thư mục "Số hóa chứng chỉ"'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {(syncStatus.source === 'drive_oauth' || syncStatus.source === 'apps_script') && syncStatus.totalRecords > 0
                          ? `Đã nạp ${syncStatus.totalRecords.toLocaleString('vi-VN')} hồ sơ từ ${syncStatus.fileCount} file vào bộ nhớ tra cứu tức thì (cập nhật: ${syncStatus.lastUpdated}).`
                          : 'Chưa tải dữ liệu từ file Excel trên Google Drive. Hãy chọn 1 trong 2 cách kết nối bên dưới.'}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] shrink-0 self-start sm:self-auto border ${
                        (syncStatus.source === 'drive_oauth' || syncStatus.source === 'apps_script') && syncStatus.totalRecords > 0
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {(syncStatus.source === 'drive_oauth' || syncStatus.source === 'apps_script') && syncStatus.totalRecords > 0
                        ? `Đang kết nối (${syncStatus.fileCount} file)`
                        : 'Chưa tải file Excel'}
                    </span>
                  </div>

                  {/* Per-file table when Drive files were inspected/loaded */}
                  {syncStatus.driveFiles && syncStatus.driveFiles.length > 0 && (
                    <div className="bg-white rounded-xl border border-blue-200/80 overflow-hidden">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead className="bg-[#002855] text-white">
                          <tr>
                            <th className="py-2 px-3 font-bold">Tên file Excel / Sheets trong Drive</th>
                            <th className="py-2 px-3 font-bold text-right">Số dòng đọc được</th>
                            <th className="py-2 px-3 font-bold text-right">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {syncStatus.driveFiles.map((df, i) => (
                            <tr key={`${df.name}_${i}`} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-semibold text-slate-800">
                                {df.name}
                                {df.error && (
                                  <div className="text-[10px] font-sans text-rose-600 mt-0.5">{df.error}</div>
                                )}
                              </td>
                              <td className="py-2 px-3 font-mono text-right font-bold text-[#004B8D]">
                                {df.rowCount.toLocaleString('vi-VN')}
                              </td>
                              <td className="py-2 px-3 text-right">
                                {df.status === 'connected' ? (
                                  <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                                    Đã kết nối
                                  </span>
                                ) : df.status === 'empty' ? (
                                  <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                                    Không có dòng
                                  </span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                                    Lỗi đọc file
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Progress bar during Drive scan or Apps Script sync */}
                {scanProgress && (
                  <div className="space-y-1.5 p-3.5 rounded-xl bg-blue-50/70 border border-blue-200">
                    <div className="flex justify-between text-xs text-[#003B73] font-semibold">
                      <span>{scanProgress.message}</span>
                      <span className="font-mono font-bold text-[#004B8D]">{scanProgress.percent}%</span>
                    </div>
                    <div className="w-full bg-blue-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-[#004B8D] h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${scanProgress.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Link Input + 2 Clear Actions */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Dán Link thư mục Google Drive hoặc Link Google Apps Script Web App:
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={driveLinkInput}
                      onChange={(e) => setDriveLinkInput(e.target.value)}
                      placeholder="https://drive.google.com/drive/folders/...  HOẶC  https://script.google.com/macros/s/.../exec"
                      className="flex-1 text-xs font-mono p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00529C]"
                    />
                    <button
                      type="button"
                      onClick={handleSaveDriveConnection}
                      disabled={isTestingAppsScript || isScanningDrive || !driveLinkInput.trim()}
                      className="shrink-0 flex items-center justify-center gap-1.5 bg-[#004B8D] hover:bg-[#00529C] text-white font-bold px-5 py-3 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${isTestingAppsScript ? 'animate-spin' : ''}`} />
                      <span>{isTestingAppsScript ? 'Đang tải...' : 'Kiểm tra & Nạp dữ liệu'}</span>
                    </button>
                  </div>

                  {/* Cross-Machine Sync Notice & Shareable Link */}
                  {(pendingCloudSyncStatus || !isFirebaseAuthenticated) &&
                    (getSavedAppsScriptUrl() || syncStatus.appsScriptUrl) && (
                      <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <strong className="block text-amber-900">
                              Đồng bộ sang máy khác: Cần đăng nhập Google Admin
                            </strong>
                            <span>
                              Link Apps Script hiện mới lưu trên máy này. Hãy bấm nút bên phải để đăng nhập Google Admin và đẩy cấu hình lên Cloud cho tất cả máy khác cùng tra cứu.
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleQuickFirebaseAdminLogin}
                          className="shrink-0 bg-[#004B8D] hover:bg-[#00529C] text-white font-bold px-3.5 py-2 rounded-xl cursor-pointer"
                        >
                          Đăng nhập &amp; Đồng bộ Cloud
                        </button>
                      </div>
                    )}

                  {(getSavedAppsScriptUrl() || syncStatus.appsScriptUrl) && (
                    <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <strong className="text-emerald-900">Link chia sẻ cấu hình nhanh cho máy khác:</strong>{' '}
                        <span className="text-[11px] text-emerald-800">
                          (Gửi link này cho máy khác hoặc sinh viên để mở web là tự kết nối ngay Chế độ 2, kể cả khi Firebase hết hạn mức)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyShareAppsScriptLink}
                        className="shrink-0 inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                      >
                        {copiedShareLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedShareLink ? 'Đã chép Link chia sẻ!' : 'Chép Link cho máy khác'}</span>
                      </button>
                    </div>
                  )}

                  {/* Direct 1-Click OAuth Drive Reader (No Apps Script Needed) */}
                  <div className="p-3.5 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="font-bold text-xs text-amber-300 flex items-center gap-1.5">
                        <FolderSync className="w-4 h-4" />
                        <span>Cách nhanh nhất cho Cán bộ (Không cần cài Apps Script):</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Dán link thư mục Drive ở ô trên (hoặc để trống tự tìm "Số hóa chứng chỉ"), rồi bấm nút bên phải để đọc trực tiếp toàn bộ file <code className="text-sky-300">.xlsx/.xls/Sheets</code> vào bộ nhớ tra cứu.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleScanDriveFolder}
                      disabled={isScanningDrive}
                      className="shrink-0 inline-flex items-center justify-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50 shadow-sm"
                    >
                      <FolderSync className={`w-4 h-4 ${isScanningDrive ? 'animate-spin' : ''}`} />
                      <span>{isScanningDrive ? 'Đang đọc Drive...' : 'Quét & Tải Excel (1-Click)'}</span>
                    </button>
                  </div>
                </div>

                {/* Short Copyable Google Apps Script + 3-Step Guide */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">
                        Cách dùng cho Sinh viên tra cứu từ xa: Google Apps Script Web App
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {savedDriveFolderId
                          ? `Đã tự động điền Folder ID: ${savedDriveFolderId}`
                          : 'Tự động tìm thư mục "Số hóa chứng chỉ" hoặc điền ID thư mục nếu bạn dán link Drive'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyShortScript}
                      className="inline-flex items-center gap-1.5 bg-[#002855] hover:bg-[#003B73] text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-2xs cursor-pointer shrink-0"
                    >
                      {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedScript ? 'Đã sao chép Script!' : 'Copy Script'}</span>
                    </button>
                  </div>

                  <pre className="p-3.5 rounded-xl bg-slate-950 text-sky-300 font-mono text-[11px] overflow-x-auto max-h-48 leading-relaxed border border-slate-800">
                    <code>{buildShortAppsScriptCode(savedDriveFolderId)}</code>
                  </pre>

                  <ol className="text-[11px] text-slate-600 list-decimal pl-4 space-y-1">
                    <li>
                      Mở <strong>script.google.com</strong> &rarr; Tạo dự án mới &rarr; Dán đoạn code trên (nếu trong thư mục có file <code>.xlsx/.xls</code>, bấm dấu <strong>+</strong> ở mục <em>Services</em> bên trái &rarr; thêm <strong>Drive API</strong>).
                    </li>
                    <li>
                      Bấm <strong>Deploy &rarr; New deployment &rarr; Web app</strong> (Execute as: <strong>Me</strong>, Who has access: <strong>Anyone</strong>).
                    </li>
                    <li>
                      Copy đường link <code>.../exec</code> dán vào ô phía trên và bấm <strong>"Kiểm tra &amp; Nạp dữ liệu"</strong>.
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {/* TAB 3: UPLOAD EXCEL / CSV & APPEND */}
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

                {scanProgress && (
                  <div className="space-y-1.5 p-3.5 rounded-xl bg-blue-50/60 border border-blue-200">
                    <div className="flex justify-between text-xs text-[#003B73] font-semibold">
                      <span>{scanProgress.message}</span>
                      <span className="font-mono font-bold text-[#004B8D]">{scanProgress.percent}%</span>
                    </div>
                    <div className="w-full bg-blue-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-[#004B8D] h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${scanProgress.percent}%` }}
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
                      Xóa từng dòng ở tab <strong>4. Quản lý &amp; Xóa</strong> hoặc xóa toàn bộ khi cần làm mới.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmAction({ type: 'clear_all' })}
                    disabled={isScanningDrive}
                    className="shrink-0 flex items-center justify-center space-x-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-3.5 rounded-xl shadow-xs text-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa toàn bộ Cloud</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: MANAGE & DELETE */}
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
                    disabled={isScanningDrive || !isFirebaseAuthenticated}
                    className="shrink-0 flex items-center justify-center space-x-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-xs text-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa toàn bộ dữ liệu</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 5: DEMO DATASET */}
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
                {currentMode === 'drive' ? 'Chế độ 2: Google Drive' : 'Chế độ 1: Firebase Cloud'}
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
