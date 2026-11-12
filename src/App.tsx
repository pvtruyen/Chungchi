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
import { CertificateRecord, SyncStatus } from './types/certificate';
import { 
  initStorage, 
  lookupByMssv, 
  cacheRecord, 
  getSyncStatus, 
  saveSyncStatus, 
  getSavedAppsScriptUrl 
} from './services/storageService';
import { initAuth } from './services/firebaseAuth';
import { queryAppsScript } from './services/appsScriptConnector';
import { isAdminSessionActive } from './services/adminAuthService';
import { 
  fetchRecordFromCloud, 
  fetchCloudSyncStatus, 
  seedCloudIfEmpty,
  recordSearchEvent
} from './services/firestoreService';
import { 
  Shield, 
  HelpCircle, 
  Lock, 
  Sparkles, 
  Zap, 
  Clock, 
  FileCheck, 
  CheckCircle2, 
  BookOpen, 
  Users 
} from 'lucide-react';

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

  // Initialize Auth & Storage and sync with Cloud Firestore across all devices
  useEffect(() => {
    initStorage();
    setSyncStatus(getSyncStatus());
    setIsAdminAuthenticated(isAdminSessionActive());

    // Connect and synchronize with Cloud Firestore (so any IP/device has latest data)
    const initCloud = async () => {
      try {
        const cloudMeta = await fetchCloudSyncStatus();
        if (cloudMeta && cloudMeta.totalRecords > 0) {
          setSyncStatus(cloudMeta);
          saveSyncStatus(cloudMeta);
        } else {
          // If cloud has no records yet, seed initial demo records
          await seedCloudIfEmpty();
        }
      } catch (err) {
        console.warn('Đang sử dụng chế độ bộ nhớ cục bộ:', err);
      }
    };
    initCloud();

    // Initialize Firebase Auth listener
    initAuth(
      (user) => {
        setIsLoggedInGoogle(true);
        setUserEmail(user.email);
      },
      () => {
        setIsLoggedInGoogle(false);
        setUserEmail(null);
      }
    );
  }, []);

  const handleRequestOpenDataSourceModal = () => {
    setAdminActionTarget('data_source');
    if (isAdminSessionActive()) {
      setIsAdminAuthenticated(true);
      setIsDataSourceModalOpen(true);
    } else {
      setIsAdminPasswordModalOpen(true);
    }
  };

  const handleOpenHistoryModal = () => {
    setAdminActionTarget('history');
    if (isAdminSessionActive()) {
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
    setIsAdminAuthenticated(isAdminSessionActive());
  };

  // Execute Search
  const handleSearch = async (rawMssv: string) => {
    const cleanMssv = rawMssv.trim().toUpperCase();
    if (!cleanMssv) return;

    setIsSearching(true);
    setHasSearched(true);
    setResult(null);
    setNotFoundMssv(null);

    // If source is configured to live Google Apps Script endpoint
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
        // Fallback to local index
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

    // 1. Fast in-memory index check (< 1ms)
    let match = lookupByMssv(cleanMssv);

    // 2. If not found in local browser cache (e.g. visiting from another device / IP), query Cloud Firestore
    if (!match) {
      try {
        match = await fetchRecordFromCloud(cleanMssv);
        if (match) {
          cacheRecord(match);
        }
      } catch (e) {
        console.warn('Lỗi tìm kiếm Firestore:', e);
      }
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
    // If user had searched, re-verify search
    if (notFoundMssv) {
      handleSearch(notFoundMssv);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col antialiased selection:bg-emerald-500 selection:text-white">
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
            {/* Top Priority Highlight: STT & Ngày Cấp */}
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
            {/* 3-Step Pickup Instruction Cards */}
            <div className="text-center max-w-2xl mx-auto">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Quy Trình Nhận Chứng Chỉ GDQP&amp;AN Trực Tiếp
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Thực hiện theo 3 bước sau để rút ngắn thời gian xếp hàng tại bàn phát bằng:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {/* Step 1 */}
              <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-emerald-500/50 transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-600/5 rounded-bl-full pointer-events-none" />
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black text-lg flex items-center justify-center mb-4">
                  1
                </div>
                <h4 className="font-bold text-white text-base mb-1.5">
                  Tra cứu MSSV
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Nhập Mã số sinh viên vào ô tìm kiếm ở trên để hệ thống quét dữ liệu từ các tệp Excel số hóa của phòng GDQP.
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-amber-500/50 transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none" />
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black text-lg flex items-center justify-center mb-4">
                  2
                </div>
                <h4 className="font-bold text-white text-base mb-1.5">
                  Lưu Số vào sổ gốc &amp; Số hiệu
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Màn hình sẽ hiện 02 thẻ nổi bật chứa <strong className="text-amber-300">SỐ VÀO SỔ GỐC</strong> và <strong className="text-emerald-300">SỐ HIỆU CHỨNG CHỈ</strong>. Hãy chụp màn hình hoặc giữ nguyên trang.
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-emerald-500/50 transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-600/5 rounded-bl-full pointer-events-none" />
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black text-lg flex items-center justify-center mb-4">
                  3
                </div>
                <h4 className="font-bold text-white text-base mb-1.5">
                  Đọc cho Cán bộ phát
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Khi đến lượt tại bàn, đọc to <strong className="text-amber-300">Số vào sổ gốc</strong> và <strong className="text-emerald-300">Số hiệu chứng chỉ</strong> để cán bộ rút chứng chỉ chính xác trong vài giây.
                </p>
              </div>
            </div>

            {/* Performance & Security Trust Banner */}
            <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 p-5 border border-emerald-800/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-300">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm">
                    Bảo mật thông tin sinh viên 100%
                  </div>
                  <div className="text-slate-400 text-xs">
                    Hệ thống chỉ hiển thị đúng thông tin của MSSV được tra cứu, không cho phép duyệt danh sách toàn trường.
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <span className="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-950/80 px-3 py-1.5 rounded-lg border border-emerald-800">
                  <Zap className="w-3.5 h-3.5" />
                  Truy vấn &lt; 1 giây
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-400 text-xs py-8 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3 text-center md:text-left">
            <div className="w-7 h-7 rounded-lg bg-white p-0.5 shadow-sm shrink-0 flex items-center justify-center">
              <img
                src="https://www.ctu.edu.vn/images/branding/logo/CTU_logo.png"
                alt="CTU"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="font-bold text-slate-200">
                Đại học Cần Thơ (CTU) — Trung tâm Giáo dục Quốc phòng và An ninh
              </div>
              <div className="text-[11px] text-slate-500">
                Hệ thống Tra cứu &amp; Cấp phát Chứng chỉ Giáo dục Quốc phòng và An ninh
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsDeployGuideModalOpen(true)}
              className="text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Hướng dẫn triển khai</span>
            </button>
            <span className="text-slate-700">•</span>
            <button
              onClick={handleRequestOpenDataSourceModal}
              className="text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
            >
              Nguồn dữ liệu
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
