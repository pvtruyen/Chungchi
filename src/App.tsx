/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { SearchHero } from './components/SearchHero';
import { HighlightedResultCard } from './components/HighlightedResultCard';
import { StudentDetailCard } from './components/StudentDetailCard';
import { NotFoundState } from './components/NotFoundState';
import { DataSourceModal } from './components/DataSourceModal';
import { DeployGuideModal } from './components/DeployGuideModal';
import { AdminPasswordModal } from './components/AdminPasswordModal';
import { SearchHistoryModal } from './components/SearchHistoryModal';
import { CtuLogo } from './components/CtuLogo';
import { CertificateRecord, SyncStatus } from './types/certificate';
import {
  initStorage,
  lookupByMssv,
  cacheRecord,
  getSyncStatus,
  saveSyncStatus,
  getSavedAppsScriptUrl,
} from './services/storageService';
import { initAuth } from './services/firebaseAuth';
import { testFirestoreConnection } from './services/firebaseConfig';
import { queryAppsScript } from './services/appsScriptConnector';
import { isAdminSessionActive, grantAdminSession } from './services/adminAuthService';
import {
  fetchRecordFromCloud,
  fetchCloudSyncStatus,
  recordSearchEvent,
} from './services/firestoreService';
import { Lock, Zap, BookOpen, ShieldCheck } from 'lucide-react';

export default function App() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [result, setResult] = useState<CertificateRecord | null>(null);
  const [notFoundMssv, setNotFoundMssv] = useState<string | null>(null);
  const [isLoggedInGoogle, setIsLoggedInGoogle] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isDataSourceModalOpen, setIsDataSourceModalOpen] = useState(false);
  const [isDeployGuideModalOpen, setIsDeployGuideModalOpen] = useState(false);
  const [isAdminPasswordModalOpen, setIsAdminPasswordModalOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [adminActionTarget, setAdminActionTarget] = useState<'data_source' | 'history' | null>(null);

  const sampleMssvs = ['B2101234', 'B2105678', 'B2209999', 'B2012001', 'B2201010'];

  useEffect(() => {
    initStorage();
    setSyncStatus(getSyncStatus());
    setIsAdminAuthenticated(isAdminSessionActive());

    const initCloud = async () => {
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
    };
    initCloud();

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
  }, []);

  const handleRequestOpenDataSourceModal = () => {
    setAdminActionTarget('data_source');
    if (isAdminSessionActive() || isLoggedInGoogle) {
      setIsAdminAuthenticated(true);
      setIsDataSourceModalOpen(true);
    } else {
      setIsAdminPasswordModalOpen(true);
    }
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

  const handleSearch = async (rawMssv: string) => {
    const cleanMssv = rawMssv.trim().toUpperCase();
    if (!cleanMssv) return;

    setIsSearching(true);
    setHasSearched(true);
    setResult(null);
    setNotFoundMssv(null);

    const appsScriptUrl = getSavedAppsScriptUrl();
    if (syncStatus.source === 'apps_script' && appsScriptUrl) {
      try {
        const response = await queryAppsScript(appsScriptUrl, cleanMssv);
        if (response.success && response.found && response.data) {
          setResult(response.data);
          setNotFoundMssv(null);
          recordSearchEvent(response.data, cleanMssv).catch(console.warn);
        } else {
          setResult(null);
          setNotFoundMssv(cleanMssv);
          recordSearchEvent(null, cleanMssv).catch(console.warn);
        }
      } catch (err) {
        console.error('Lỗi tra cứu Apps Script:', err);
        const local = lookupByMssv(cleanMssv);
        if (local) {
          setResult(local);
          recordSearchEvent(local, cleanMssv).catch(console.warn);
        } else {
          setNotFoundMssv(cleanMssv);
          recordSearchEvent(null, cleanMssv).catch(console.warn);
        }
      } finally {
        setIsSearching(false);
      }
      return;
    }

    // 1. Check Cloud Firestore first when connected so deletions/updates reflect immediately across devices
    let match: CertificateRecord | null = null;
    try {
      match = await fetchRecordFromCloud(cleanMssv);
      if (match) {
        cacheRecord(match);
      }
    } catch (e) {
      console.warn('Lỗi tìm kiếm Cloud Firestore:', e);
    }

    // 2. Fallback to local index when offline or using local/demo dataset
    if (!match && syncStatus.source === 'demo_data') {
      match = lookupByMssv(cleanMssv);
    }

    if (match) {
      setResult(match);
      setNotFoundMssv(null);
      recordSearchEvent(match, cleanMssv).catch(console.warn);
    } else {
      setResult(null);
      setNotFoundMssv(cleanMssv);
      recordSearchEvent(null, cleanMssv).catch(console.warn);
    }
    setIsSearching(false);
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

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        {/* State 1: Search Result Found */}
        {hasSearched && result && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Top Priority Highlight: Số lưu vào sổ gốc & Số hiệu văn bằng */}
            <HighlightedResultCard record={result} />

            {/* Detailed Student & Certificate Information */}
            <StudentDetailCard record={result} />
          </div>
        )}

        {/* State 2: Search Result Not Found */}
        {hasSearched && !result && notFoundMssv && (
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
                Quy Trình Tra Cứu &amp; Nhận Chứng Chỉ GDQP&amp;AN
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Thực hiện 3 bước sau để tra cứu chính xác và đối chiếu nhanh tại bàn phát văn bằng Đại học Cần Thơ:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {/* Step 1 */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-[#00529C]/60 hover:shadow-md transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full pointer-events-none" />
                <div className="w-10 h-10 rounded-xl bg-[#004B8D] text-white font-black text-lg flex items-center justify-center mb-4 shadow-xs">
                  1
                </div>
                <h4 className="font-bold text-slate-900 text-base mb-1.5">
                  Nhập MSSV Tra Cứu
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Nhập chính xác Mã số sinh viên để hệ thống truy vấn trực tiếp dữ liệu chứng chỉ từ máy chủ đám mây Cloud Firestore.
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-amber-400 hover:shadow-md transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full pointer-events-none" />
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 font-black text-lg flex items-center justify-center mb-4 shadow-xs">
                  2
                </div>
                <h4 className="font-bold text-slate-900 text-base mb-1.5">
                  Đối Chiếu 02 Số Trọng Tâm
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Hệ thống làm nổi bật <strong className="text-amber-700">SỐ LƯU VÀO SỔ GỐC</strong> và{' '}
                  <strong className="text-[#004B8D]">SỐ HIỆU VĂN BẰNG</strong> cùng đầy đủ thông tin cá nhân của người học.
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-[#00529C]/60 hover:shadow-md transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full pointer-events-none" />
                <div className="w-10 h-10 rounded-xl bg-[#002855] text-amber-300 font-black text-lg flex items-center justify-center mb-4 shadow-xs">
                  3
                </div>
                <h4 className="font-bold text-slate-900 text-base mb-1.5">
                  Đọc Cho Cán Bộ Phát Bằng
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Cung cấp <strong className="text-amber-700">Số lưu vào sổ gốc</strong> và{' '}
                  <strong className="text-[#004B8D]">Số hiệu văn bằng</strong> để cán bộ đối chiếu, rút phôi và bàn giao chứng chỉ nhanh chóng.
                </p>
              </div>
            </div>

            {/* Performance & Security Trust Banner */}
            <div className="rounded-2xl bg-gradient-to-r from-[#002855] via-[#003D7A] to-[#004B8D] p-5 border border-blue-800/60 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-blue-100">
              <div className="flex items-center space-x-3.5">
                <div className="p-2.5 rounded-xl bg-white/10 text-amber-300 border border-blue-300/30 shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm flex items-center gap-1.5">
                    <span>Đồng Bộ Đám Mây &amp; Bảo Mật Phân Quyền (RBAC)</span>
                  </div>
                  <div className="text-blue-200 text-xs mt-0.5">
                    Sinh viên chỉ tra cứu đúng MSSV của mình; chỉ Cán bộ Quản trị đã xác thực Firebase mới có quyền tải Excel và xóa dữ liệu.
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <span className="flex items-center gap-1.5 text-amber-300 font-bold bg-[#001833]/80 px-3.5 py-2 rounded-xl border border-blue-400/30">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Cloud Firestore Realtime</span>
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
                Hệ thống Tra cứu &amp; Quản lý Chứng chỉ Giáo dục Quốc phòng và An ninh
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
              <span>Cấu hình Firebase &amp; Rules</span>
            </button>
            <span className="text-blue-700">•</span>
            <button
              type="button"
              onClick={handleRequestOpenDataSourceModal}
              className="text-sky-300 hover:text-white transition-colors flex items-center gap-1 font-semibold cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Quản trị dữ liệu</span>
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
