/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { SearchHero } from './components/SearchHero';
import { HighlightedResultCard } from './components/HighlightedResultCard';
import { StudentDetailCard } from './components/StudentDetailCard';
import { NotFoundState } from './components/NotFoundState';
import { DataSourceModal, DataSourceModalTab } from './components/DataSourceModal';
import { DeployGuideModal } from './components/DeployGuideModal';
import { AdminPasswordModal } from './components/AdminPasswordModal';
import { SearchHistoryModal } from './components/SearchHistoryModal';
import { CtuLogo } from './components/CtuLogo';
import { CertificateRecord, SyncStatus } from './types/certificate';
import {
  initStorage,
  hydrateFromIndexedDb,
  lookupByMssv,
  lookupByMssvOrName,
  cacheRecord,
  getSyncStatus,
  saveSyncStatus,
} from './services/storageService';
import { initAuth } from './services/firebaseAuth';
import { testFirestoreConnection } from './services/firebaseConfig';
import { isAdminSessionActive, grantAdminSession } from './services/adminAuthService';
import {
  fetchRecordFromCloud,
  fetchCloudSyncStatus,
  fetchCertificatesForAdmin,
  recordSearchEvent,
  hasFirestoreWriteQuotaExceeded,
  onFirestoreQuotaStatusChange,
  resetFirestoreWriteQuotaFlag,
  FIRESTORE_PRICING_URL,
} from './services/firestoreService';
import {
  Lock,
  Zap,
  BookOpen,
  ShieldCheck,
  Flame,
  Upload,
  Settings,
  Trash2,
  Users,
  AlertTriangle,
  Clock,
} from 'lucide-react';

export default function App() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [result, setResult] = useState<CertificateRecord | null>(null);
  const [matchingList, setMatchingList] = useState<CertificateRecord[]>([]);
  const [notFoundMssv, setNotFoundMssv] = useState<string | null>(null);
  const [isLoggedInGoogle, setIsLoggedInGoogle] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isDataSourceModalOpen, setIsDataSourceModalOpen] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState<DataSourceModalTab>('firebase_config');
  const [isDeployGuideModalOpen, setIsDeployGuideModalOpen] = useState(false);
  const [isAdminPasswordModalOpen, setIsAdminPasswordModalOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [adminActionTarget, setAdminActionTarget] = useState<'data_source' | 'history' | null>(null);
  const [firebaseRefreshTick, setFirebaseRefreshTick] = useState(0);
  const [isWriteQuotaExhausted, setIsWriteQuotaExhausted] = useState(() =>
    hasFirestoreWriteQuotaExceeded()
  );
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('gdqp_theme_mode_v1');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      if (typeof navigator !== 'undefined' && /Windows NT 5\.[12]/i.test(navigator.userAgent)) {
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('theme-dark-legacy', isDarkMode);
    }
    try {
      localStorage.setItem('gdqp_theme_mode_v1', isDarkMode ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [isDarkMode]);

  const sampleMssvs = ['B2101234', 'B2105678', 'B2209999', 'B2012001', 'B2201010'];
  const isOfficerAuthorized = isAdminAuthenticated || isLoggedInGoogle;

  const refreshCloudMeta = useCallback(async () => {
    try {
      await testFirestoreConnection();
      const cloudMeta = await fetchCloudSyncStatus();
      if (cloudMeta && cloudMeta.totalRecords >= 0) {
        setSyncStatus(cloudMeta);
        saveSyncStatus(cloudMeta);
      }
    } catch (err) {
      console.warn('Đang sử dụng bộ nhớ đệm cục bộ:', err);
    }
  }, []);

  useEffect(() => {
    initStorage();
    setSyncStatus(getSyncStatus());
    setIsAdminAuthenticated(isAdminSessionActive());

    hydrateFromIndexedDb().then((loadedTotal) => {
      const st = getSyncStatus();
      if (loadedTotal > 0 && st.source !== 'demo_data' && st.totalRecords !== loadedTotal) {
        const updated = { ...st, totalRecords: loadedTotal };
        saveSyncStatus(updated);
        setSyncStatus(updated);
      }
      refreshCloudMeta();
    });

    setIsWriteQuotaExhausted(hasFirestoreWriteQuotaExceeded());
    const unsubscribeQuota = onFirestoreQuotaStatusChange((exhausted) => {
      setIsWriteQuotaExhausted(exhausted);
    });

    const unsubscribeAuth = initAuth(
      (user) => {
        setIsLoggedInGoogle(true);
        setUserEmail(user.email);
        grantAdminSession();
        setIsAdminAuthenticated(true);
      },
      () => {
        setIsLoggedInGoogle(false);
        setUserEmail(null);
        setIsAdminAuthenticated(isAdminSessionActive());
      }
    );

    return () => {
      unsubscribeAuth();
      unsubscribeQuota();
    };
  }, [firebaseRefreshTick, refreshCloudMeta]);

  const openModalWithTab = (tab: DataSourceModalTab) => {
    setModalInitialTab(tab);
    setAdminActionTarget('data_source');
    if (isAdminSessionActive() || isLoggedInGoogle) {
      setIsAdminAuthenticated(true);
      setIsDataSourceModalOpen(true);
    } else {
      setIsAdminPasswordModalOpen(true);
    }
  };

  const handleRequestOpenDataSourceModal = () => {
    openModalWithTab('firebase_config');
  };

  const handleOpenHistoryModal = () => {
    setAdminActionTarget('history');
    if (isAdminSessionActive() || isLoggedInGoogle) {
      setIsAdminAuthenticated(true);
      setIsHistoryModalOpen(true);
    } else {
      setIsAdminPasswordModalOpen(true);
    }
  };

  const handleAdminPasswordSuccess = () => {
    setIsAdminAuthenticated(true);
    setIsAdminPasswordModalOpen(false);
    if (adminActionTarget === 'history') {
      setIsHistoryModalOpen(true);
    } else {
      setIsDataSourceModalOpen(true);
    }
    setAdminActionTarget(null);
  };

  const handleDataSourceModalClose = () => {
    setIsDataSourceModalOpen(false);
    setIsAdminAuthenticated(isAdminSessionActive() || isLoggedInGoogle);
  };

  const handleSearch = async (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (!trimmed) return;
    const cleanUpper = trimmed.toUpperCase();
    const looksLikeMssv = /^[A-Z0-9_-]+$/.test(cleanUpper) && !trimmed.includes(' ');

    setIsSearching(true);
    setHasSearched(true);
    setResult(null);
    setMatchingList([]);
    setNotFoundMssv(null);

    // Firebase Cloud Firestore + High-speed IndexedDB / RAM Index
    let match: CertificateRecord | null = null;

    if (looksLikeMssv) {
      try {
        match = await fetchRecordFromCloud(cleanUpper);
        if (match) {
          cacheRecord(match);
        }
      } catch (e) {
        console.warn('Lỗi tìm kiếm Cloud Firestore:', e);
      }
      if (!match) {
        match = lookupByMssv(cleanUpper);
      }
    }

    if (match) {
      setResult(match);
      setNotFoundMssv(null);
      recordSearchEvent(match, match.mssv).catch(console.warn);
      setIsSearching(false);
      return;
    }

    // Name / Partial search in loaded index
    let nameMatches = lookupByMssvOrName(trimmed);

    // If Admin is signed in and searching by name, also inspect cloud list if local index missed
    if (nameMatches.length === 0 && !looksLikeMssv && isLoggedInGoogle) {
      try {
        const cloudSample = await fetchCertificatesForAdmin(200, '');
        cloudSample.forEach(cacheRecord);
        nameMatches = lookupByMssvOrName(trimmed);
      } catch {
        // ignore
      }
    }

    if (nameMatches.length === 1) {
      setResult(nameMatches[0]);
      setNotFoundMssv(null);
      recordSearchEvent(nameMatches[0], nameMatches[0].mssv).catch(console.warn);
    } else if (nameMatches.length > 1) {
      setMatchingList(nameMatches);
      setNotFoundMssv(null);
    } else {
      setResult(null);
      setNotFoundMssv(trimmed);
      recordSearchEvent(null, cleanUpper).catch(console.warn);
    }
    setIsSearching(false);
  };

  const handleSelectMatchingRecord = (record: CertificateRecord) => {
    setResult(record);
    setMatchingList([]);
    recordSearchEvent(record, record.mssv).catch(console.warn);
  };

  const handleDataUpdated = () => {
    setSyncStatus(getSyncStatus());
    if (hasSearched && result) {
      handleSearch(result.mssv);
    } else if (notFoundMssv) {
      handleSearch(notFoundMssv);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col antialiased selection:bg-[#004B8D] selection:text-white">
      {/* Navigation Bar */}
      <Navbar
        syncStatus={syncStatus}
        onOpenDataSourceModal={handleRequestOpenDataSourceModal}
        onOpenDeployGuideModal={() => setIsDeployGuideModalOpen(true)}
        onOpenHistoryModal={handleOpenHistoryModal}
        isLoggedInGoogle={isLoggedInGoogle}
        userEmail={userEmail}
        isAdmin={isAdminAuthenticated}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
      />

      {/* Hero & Search Form */}
      <SearchHero
        onSearch={handleSearch}
        isSearching={isSearching}
        sampleMssvs={sampleMssvs}
      />

      {/* Officer Quick-Action Bar (visible after PIN or Firebase Admin authentication) */}
      {isOfficerAuthorized && (
        <div className="bg-white border-b border-blue-200 shadow-2xs">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center flex-wrap gap-2">
              <span className="font-extrabold text-[#002855] uppercase tracking-wider text-[11px] flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-[#00529C]" />
                Hệ thống lưu trữ:
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold bg-[#004B8D] text-white shadow-xs">
                <Flame className="w-3.5 h-3.5 text-amber-300" />
                <span>
                  Firebase Cloud ({syncStatus.totalRecords.toLocaleString('vi-VN')} chứng chỉ)
                </span>
              </span>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <button
                type="button"
                onClick={handleOpenHistoryModal}
                className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold px-3 py-1.5 rounded-xl border border-amber-300 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                <span>Lịch sử phát bằng</span>
              </button>
              <button
                type="button"
                onClick={() => openModalWithTab('upload')}
                className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-[#003B73] font-bold px-3 py-1.5 rounded-xl border border-blue-200 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Nạp Excel</span>
              </button>
              <button
                type="button"
                onClick={() => openModalWithTab('manage')}
                className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-3 py-1.5 rounded-xl border border-rose-200 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa Dữ liệu</span>
              </button>
              <button
                type="button"
                onClick={() => openModalWithTab('firebase_config')}
                className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-1.5 rounded-xl cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-amber-300" />
                <span>Cài đặt Kết nối</span>
              </button>
            </div>
          </div>

          {isWriteQuotaExhausted && (
            <div className="bg-amber-50 border-t border-amber-200 px-4 sm:px-6 lg:px-8 py-2.5 text-xs text-amber-950">
              <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Đã hết hạn mức ghi Firestore miễn phí hôm nay (Quota exceeded):</strong> Hạn mức sẽ đặt lại vào ngày mai (chi tiết gói Spark Enterprise xem tại{' '}
                    <a
                      href={FIRESTORE_PRICING_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="underline font-semibold text-[#004B8D]"
                    >
                      firebase.google.com/pricing
                    </a>
                    ). Tra cứu vẫn chạy bình thường; để ghi thêm dữ liệu ngay, hãy dán Firebase Config riêng trong Cài đặt.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 pl-6 sm:pl-0">
                  <button
                    type="button"
                    onClick={() => openModalWithTab('firebase_config')}
                    className="bg-[#004B8D] hover:bg-[#00529C] text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                  >
                    Đổi Firebase
                  </button>
                  <button
                    type="button"
                    onClick={() => resetFirestoreWriteQuotaFlag()}
                    className="bg-white hover:bg-amber-100 text-amber-900 font-semibold px-2.5 py-1 rounded-lg border border-amber-300 cursor-pointer"
                  >
                    Thử lại
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        {/* State 1A: Multiple Matches Found by Name */}
        {hasSearched && !result && matchingList.length > 0 && (
          <div className="bg-white rounded-2xl border border-blue-200 shadow-md overflow-hidden animate-in fade-in duration-200">
            <div className="bg-[#002855] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Users className="w-4 h-4 text-amber-300" />
                <span>Tìm thấy {matchingList.length} hồ sơ phù hợp — Chọn sinh viên cần xem:</span>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {matchingList.map((rec) => (
                <button
                  key={rec.mssv}
                  type="button"
                  onClick={() => handleSelectMatchingRecord(rec)}
                  className="w-full text-left px-5 py-3.5 hover:bg-blue-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer"
                >
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{rec.hoVaTen}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      MSSV: <strong className="text-[#004B8D]">{rec.mssv}</strong>
                      {rec.ngaySinh ? ` • NS: ${rec.ngaySinh}` : ''}
                      {rec.nganhDaoTao ? ` • ${rec.nganhDaoTao}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono shrink-0">
                    <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg font-bold">
                      Sổ gốc: {rec.soVaoSoGoc || '—'}
                    </span>
                    <span className="bg-blue-50 text-[#004B8D] border border-blue-200 px-2.5 py-1 rounded-lg font-bold">
                      Số hiệu: {rec.soHieuChungChi || '—'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* State 1B: Search Result Found */}
        {hasSearched && result && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <HighlightedResultCard record={result} />
            <StudentDetailCard record={result} />
          </div>
        )}

        {/* State 2: Search Result Not Found */}
        {hasSearched && !result && matchingList.length === 0 && notFoundMssv && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <NotFoundState
              searchedMssv={notFoundMssv}
              onRetry={() => handleSearch(notFoundMssv)}
              sampleMssvs={sampleMssvs}
              onSelectSample={handleSearch}
            />
          </div>
        )}

        {/* State 3: Initial Empty State (Guidance Cards) */}
        {!hasSearched && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="text-center max-w-2xl mx-auto">
              <h3 className="text-lg sm:text-xl font-extrabold text-[#002855] tracking-tight">
                Quy Trình Tra Cứu &amp; Đối Chiếu Văn Bằng GDQP&amp;AN
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Thực hiện 3 bước sau để tra cứu nhanh chóng và đối chiếu chính xác tại Đại học Cần Thơ:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-[#00529C]/60 hover:shadow-md transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full pointer-events-none" />
                <div className="w-10 h-10 rounded-xl bg-[#004B8D] text-white font-black text-lg flex items-center justify-center mb-4 shadow-xs">
                  1
                </div>
                <h4 className="font-bold text-slate-900 text-base mb-1.5">
                  Nhập MSSV hoặc Họ Tên
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Nhập Mã số sinh viên (hoặc Họ tên) để hệ thống tìm kiếm tức thì trên cơ sở dữ liệu đám mây Cloud Firestore.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-amber-400 hover:shadow-md transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full pointer-events-none" />
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 font-black text-lg flex items-center justify-center mb-4 shadow-xs">
                  2
                </div>
                <h4 className="font-bold text-slate-900 text-base mb-1.5">
                  Đối Chiếu 02 Số Pháp Lý
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Màn hình làm nổi bật <strong className="text-amber-700">SỐ LƯU VÀO SỔ GỐC</strong> và{' '}
                  <strong className="text-[#004B8D]">SỐ HIỆU VĂN BẰNG</strong> cùng đầy đủ thông tin chứng chỉ của người học.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-[#00529C]/60 hover:shadow-md transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full pointer-events-none" />
                <div className="w-10 h-10 rounded-xl bg-[#002855] text-amber-300 font-black text-lg flex items-center justify-center mb-4 shadow-xs">
                  3
                </div>
                <h4 className="font-bold text-slate-900 text-base mb-1.5">
                  Cấp Phát Chính Xác
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Đọc <strong className="text-amber-700">Số lưu vào sổ gốc</strong> và{' '}
                  <strong className="text-[#004B8D]">Số hiệu văn bằng</strong> cho cán bộ đối chiếu và bàn giao chứng chỉ trong vài giây.
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-gradient-to-r from-[#002855] via-[#003D7A] to-[#004B8D] p-5 border border-blue-800/60 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-blue-100">
              <div className="flex items-center space-x-3.5">
                <div className="p-2.5 rounded-xl bg-white/10 text-amber-300 border border-blue-300/30 shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm">
                    Bảo Mật &amp; Phân Quyền Dữ Liệu — Đại học Cần Thơ
                  </div>
                  <div className="text-blue-200 text-xs mt-0.5">
                    Sinh viên tra cứu công khai nhanh chóng; cán bộ dùng mã PIN quản trị để theo dõi lịch sử phát bằng và tài khoản Quản trị để nạp/xóa dữ liệu.
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <span className="flex items-center gap-1.5 text-amber-300 font-bold bg-[#001833]/80 px-3.5 py-2 rounded-xl border border-blue-400/30">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Tra cứu tức thì</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-blue-900 bg-[#001E3C] text-blue-100 text-xs py-7 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3 text-center md:text-left">
            <CtuLogo sizeClass="w-9 h-9" alt="Logo Đại học Cần Thơ" />
            <div>
              <div className="font-bold text-white">
                Đại học Cần Thơ — Trung tâm Giáo dục Quốc phòng và An ninh
              </div>
              <div className="text-[11px] text-blue-300">
                Hệ thống Tra cứu &amp; Quản lý Văn bằng, Chứng chỉ Giáo dục Quốc phòng và An ninh
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => setIsDeployGuideModalOpen(true)}
              className="text-amber-300 hover:text-amber-200 transition-colors flex items-center gap-1.5 font-semibold cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Hướng dẫn &amp; Rules</span>
            </button>
            <span className="text-blue-700">•</span>
            <button
              type="button"
              onClick={handleRequestOpenDataSourceModal}
              className="text-sky-300 hover:text-white transition-colors flex items-center gap-1 font-semibold cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Cài đặt Kết nối (Admin)</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <DataSourceModal
        isOpen={isDataSourceModalOpen}
        onClose={handleDataSourceModalClose}
        syncStatus={syncStatus}
        onDataUpdated={handleDataUpdated}
        onFirebaseConfigChanged={() => setFirebaseRefreshTick((t) => t + 1)}
        initialTab={modalInitialTab}
        isLoggedInGoogle={isLoggedInGoogle}
        userEmail={userEmail}
        onLoginSuccess={(email) => {
          setIsLoggedInGoogle(true);
          setUserEmail(email);
          grantAdminSession();
          setIsAdminAuthenticated(true);
        }}
        onLogoutSuccess={() => {
          setIsLoggedInGoogle(false);
          setUserEmail(null);
        }}
      />

      <AdminPasswordModal
        isOpen={isAdminPasswordModalOpen}
        onClose={() => setIsAdminPasswordModalOpen(false)}
        onSuccess={handleAdminPasswordSuccess}
        defaultMode={adminActionTarget === 'history' ? 'pin' : 'firebase'}
      />

      <DeployGuideModal
        isOpen={isDeployGuideModalOpen}
        onClose={() => setIsDeployGuideModalOpen(false)}
      />

      <SearchHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />
    </div>
  );
}
