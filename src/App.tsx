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
  lookupByMssv,
  lookupByMssvOrName,
  cacheRecord,
  getSyncStatus,
  saveSyncStatus,
  getSavedAppsScriptUrl,
  switchDataSourceMode,
} from './services/storageService';
import { initAuth } from './services/firebaseAuth';
import { testFirestoreConnection } from './services/firebaseConfig';
import { queryAppsScript } from './services/appsScriptConnector';
import { isAdminSessionActive, grantAdminSession } from './services/adminAuthService';
import {
  fetchRecordFromCloud,
  fetchCloudSyncStatus,
  fetchCertificatesForAdmin,
  recordSearchEvent,
} from './services/firestoreService';
import {
  Lock,
  Zap,
  BookOpen,
  ShieldCheck,
  Flame,
  HardDrive,
  Upload,
  Settings,
  Trash2,
  Users,
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

  const sampleMssvs = ['B2101234', 'B2105678', 'B2209999', 'B2012001', 'B2201010'];
  const isOfficerAuthorized = isAdminAuthenticated || isLoggedInGoogle;
  const activeMode: 'firebase' | 'drive' = syncStatus.source === 'apps_script' ? 'drive' : 'firebase';

  const refreshCloudMeta = useCallback(async () => {
    try {
      await testFirestoreConnection();
      const cloudMeta = await fetchCloudSyncStatus();
      if (cloudMeta && cloudMeta.totalRecords >= 0) {
        const current = getSyncStatus();
        // Keep user's selected mode if they switched to Apps Script Drive mode
        const merged: SyncStatus =
          current.source === 'apps_script'
            ? { ...cloudMeta, source: 'apps_script', appsScriptUrl: getSavedAppsScriptUrl() }
            : cloudMeta;
        setSyncStatus(merged);
        saveSyncStatus(merged);
      }
    } catch (err) {
      console.warn('Đang sử dụng bộ nhớ đệm cục bộ:', err);
    }
  }, []);

  useEffect(() => {
    initStorage();
    setSyncStatus(getSyncStatus());
    setIsAdminAuthenticated(isAdminSessionActive());
    refreshCloudMeta();

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

  const handleQuickSwitchMode = (mode: 'firebase' | 'drive') => {
    if (mode === 'drive' && !getSavedAppsScriptUrl()) {
      openModalWithTab('drive_config');
      return;
    }
    const updated = switchDataSourceMode(mode);
    setSyncStatus(updated);
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

    const appsScriptUrl = getSavedAppsScriptUrl();
    if (syncStatus.source === 'apps_script' && appsScriptUrl) {
      try {
        const response = await queryAppsScript(appsScriptUrl, trimmed);
        if (response.success && response.found && response.data) {
          setResult(response.data);
          setNotFoundMssv(null);
          recordSearchEvent(response.data, response.data.mssv || cleanUpper).catch(console.warn);
        } else {
          const localMatches = lookupByMssvOrName(trimmed);
          if (localMatches.length === 1) {
            setResult(localMatches[0]);
            recordSearchEvent(localMatches[0], localMatches[0].mssv).catch(console.warn);
          } else if (localMatches.length > 1) {
            setMatchingList(localMatches);
          } else {
            setNotFoundMssv(trimmed);
            recordSearchEvent(null, cleanUpper).catch(console.warn);
          }
        }
      } catch (err) {
        console.error('Lỗi tra cứu Google Drive Apps Script:', err);
        const localMatches = lookupByMssvOrName(trimmed);
        if (localMatches.length === 1) {
          setResult(localMatches[0]);
        } else if (localMatches.length > 1) {
          setMatchingList(localMatches);
        } else {
          setNotFoundMssv(trimmed);
        }
      } finally {
        setIsSearching(false);
      }
      return;
    }

    // Mode 1: Firebase Cloud + High-speed Index
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
      if (!match && syncStatus.source === 'demo_data') {
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
      />

      {/* Hero & Search Form */}
      <SearchHero
        onSearch={handleSearch}
        isSearching={isSearching}
        sampleMssvs={sampleMssvs}
      />

      {/* Admin Quick-Switch Bar (ONLY visible after Admin authentication) */}
      {isOfficerAuthorized && (
        <div className="bg-white border-b border-blue-200 shadow-2xs">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center flex-wrap gap-2">
              <span className="font-extrabold text-[#002855] uppercase tracking-wider text-[11px] flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-[#00529C]" />
                Nguồn tra cứu:
              </span>
              <button
                type="button"
                onClick={() => handleQuickSwitchMode('firebase')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  activeMode === 'firebase'
                    ? 'bg-[#004B8D] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-amber-300" />
                <span>Chế độ 1: Firebase Cloud</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickSwitchMode('drive')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  activeMode === 'drive'
                    ? 'bg-[#004B8D] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5 text-sky-300" />
                <span>Chế độ 2: Google Drive ("Số hóa chứng chỉ")</span>
              </button>
            </div>

            <div className="flex items-center flex-wrap gap-2">
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
                  Nhập Mã số sinh viên (hoặc Họ tên) để hệ thống tìm kiếm tức thì trên Cloud Firestore hoặc thư mục Google Drive.
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
                    Sinh viên tra cứu công khai nhanh chóng; mọi thao tác nạp Excel, chuyển nguồn và xóa dữ liệu được bảo vệ bằng quyền Quản trị viên.
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
