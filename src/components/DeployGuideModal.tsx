import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Code2,
  Cloud,
  FileSpreadsheet,
  Github,
  AlertTriangle,
  FolderArchive,
  Download,
  ShieldCheck,
  Flame,
} from 'lucide-react';
import { GOOGLE_APPS_SCRIPT_CODE, DEPLOYMENT_STEPS } from '../data/deploymentGuide';
import { TEMPLATE_FIREBASE_CONFIG } from '../services/firebaseConfig';

interface DeployGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FIRESTORE_RULES_SNIPPET = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Mặc định từ chối tất cả truy cập không hợp lệ
    match /{document=**} {
      allow read, write: if false;
    }

    function isValidId(id) {
      return id is string && id.size() > 0 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\\\-]+$');
    }

    function isSignedIn() {
      return request.auth != null;
    }

    function isBootstrappedAdmin() {
      return isSignedIn()
        && request.auth.token.email_verified == true
        && request.auth.token.email.lower() == 'pvtruyen@ctu.edu.vn'; // Thay bằng Email Cán bộ Admin của bạn
    }

    function isAdmin() {
      return isBootstrappedAdmin()
        || (isSignedIn() && request.auth.token.email_verified == true
            && exists(/databases/$(database)/documents/admins/$(request.auth.uid)));
    }

    // 1. Chứng chỉ: Khách chỉ được get từng MSSV; Admin được list, create, update, delete
    match /gdqp_certificates/{mssv} {
      allow get: if isValidId(mssv);
      allow list: if isBootstrappedAdmin() && resource.data.mssv >= '';
      allow create, update: if isAdmin() && isValidId(mssv);
      allow delete: if isAdmin() && isValidId(mssv);
    }

    // 2. Siêu dữ liệu đồng bộ
    match /gdqp_meta/{metaId} {
      allow get: if isValidId(metaId);
      allow list: if isBootstrappedAdmin() && resource.data.source >= '';
      allow create, update, delete: if isAdmin() && isValidId(metaId);
    }

    // 3. Lịch sử tra cứu: Khách được tạo log tra cứu; chỉ Admin xem, cập nhật đã phát & xóa
    match /gdqp_search_history/{historyId} {
      allow get: if isAdmin() && isValidId(historyId);
      allow list: if isBootstrappedAdmin() && resource.data.mssv >= '';
      allow create: if isValidId(historyId) && request.resource.data.daPhat == false;
      allow update: if isAdmin() && isValidId(historyId)
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['daPhat', 'ngayPhat']);
      allow delete: if isAdmin() && isValidId(historyId);
    }

    // 4. Danh sách tài khoản Cán bộ Quản trị
    match /admins/{uid} {
      allow get: if isSignedIn() && request.auth.uid == uid;
      allow list: if false;
      allow create, update, delete: if isBootstrappedAdmin() && isValidId(uid);
    }
  }
}`;

export const DeployGuideModal: React.FC<DeployGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<
    'firebase_setup' | 'empty_github' | 'vercel' | 'appsscript' | 'excel_schema'
  >('firebase_setup');
  const [copiedRules, setCopiedRules] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedGitCmd, setCopiedGitCmd] = useState(false);
  const [copiedVercelCliCmd, setCopiedVercelCliCmd] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');

  if (!isOpen) return null;

  const handleCopyRules = () => {
    navigator.clipboard.writeText(FIRESTORE_RULES_SNIPPET);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 2500);
  };

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(TEMPLATE_FIREBASE_CONFIG);
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2500);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const gitCommands = `# Bước 1: Mở Terminal/Command Prompt trong thư mục dự án đã tải về
cd du-an-gdqp-ctu

# Bước 2: Khởi tạo Git
git init
git branch -M main

# Bước 3: Thêm toàn bộ mã nguồn và tạo commit
git add .
git commit -m "Khoi tao he thong tra cuu chung chi GDQP Dai hoc Can Tho"

# Bước 4: Liên kết tới GitHub repository của bạn
git remote add origin ${githubUrl.trim() || 'https://github.com/<USERNAME>/<TEN_REPO_CUA_BAN>.git'}

# Bước 5: Đẩy mã nguồn lên GitHub
git push -u origin main`;

  const handleCopyGitCmd = () => {
    navigator.clipboard.writeText(gitCommands);
    setCopiedGitCmd(true);
    setTimeout(() => setCopiedGitCmd(false), 2500);
  };

  const handleCopyVercelCli = () => {
    navigator.clipboard.writeText('npx vercel --prod');
    setCopiedVercelCliCmd(true);
    setTimeout(() => setCopiedVercelCliCmd(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-400/20 bg-[#002855] text-white">
          <div className="flex items-center space-x-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-300" />
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Hướng Dẫn Firebase, Security Rules &amp; Triển Khai Vercel
              </h3>
              <p className="text-[11px] text-blue-200">
                Đại học Cần Thơ — Kiến trúc Static Web kết nối Cloud Firestore
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

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 px-6 pt-3 bg-slate-50 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('firebase_setup')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'firebase_setup'
                ? 'border-[#004B8D] text-[#003B73]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-500" />
            <span>1. Firebase &amp; Security Rules</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('empty_github')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'empty_github'
                ? 'border-[#004B8D] text-[#003B73]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Github className="w-4 h-4 text-[#004B8D]" />
            <span>2. Đẩy GitHub &amp; Vercel</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vercel')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'vercel'
                ? 'border-[#004B8D] text-[#003B73]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Cloud className="w-4 h-4 text-[#004B8D]" />
            <span>3. Vercel CLI</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appsscript')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'appsscript'
                ? 'border-[#004B8D] text-[#003B73]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code2 className="w-4 h-4 text-[#004B8D]" />
            <span>4. Apps Script (Code.gs)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('excel_schema')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'excel_schema'
                ? 'border-[#004B8D] text-[#003B73]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-[#004B8D]" />
            <span>5. Cấu trúc File Excel</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-sm flex-1">
          {/* TAB 1: FIREBASE SETUP & SECURITY RULES */}
          {activeTab === 'firebase_setup' && (
            <div className="space-y-5">
              <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-950 space-y-1.5 leading-relaxed">
                <strong className="font-bold text-emerald-900 text-sm flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  Đã tự động tạo &amp; kết nối sẵn Cloud Firestore trên ứng dụng này!
                </strong>
                <p>
                  Ứng dụng hiện tại đã được kết nối tự động tới cơ sở dữ liệu Cloud Firestore qua tệp{' '}
                  <code>firebase-applet-config.json</code>. Bạn có thể tra cứu, nạp Excel và xem lịch sử ngay lập tức mà{' '}
                  <strong>không cần điền thêm cấu hình</strong>.
                </p>
              </div>

              <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 text-xs text-[#002855] space-y-2 leading-relaxed">
                <strong className="font-bold text-[#003B73] text-sm block">
                  Chỉ cần thay thế 3 thông tin sau NẾU bạn tự deploy lên dự án Firebase riêng của đơn vị:
                </strong>
                <ol className="list-decimal pl-5 space-y-1.5">
                  <li>
                    <strong>Thông số kết nối <code>firebaseConfig</code>:</strong> Tạo dự án tại{' '}
                    <a
                      href="https://console.firebase.google.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#004B8D] font-bold underline inline-flex items-center gap-0.5"
                    >
                      Firebase Console <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    &rarr; Bật <strong>Firestore Database</strong> &amp; <strong>Authentication</strong> (Google, Email/Password) &rarr; Điền 6 giá trị (<code>apiKey</code>, <code>authDomain</code>, <code>projectId</code>, <code>storageBucket</code>, <code>messagingSenderId</code>, <code>appId</code>) vào biến môi trường <code>VITE_FIREBASE_*</code> trên Vercel hoặc thay trực tiếp trong <code>firebase-applet-config.json</code>.
                  </li>
                  <li>
                    <strong>Email Cán bộ Quản trị trong <code>firestore.rules</code>:</strong> Mở tab{' '}
                    <strong>Firestore Database &rarr; Rules</strong>, thay dòng{' '}
                    <code>pvtruyen@ctu.edu.vn</code> thành Email Google chính thức của cán bộ phụ trách và nhấn <strong>Publish</strong>.
                  </li>
                  <li>
                    <strong>Tên miền được phép đăng nhập (Authorized domains):</strong> Trong{' '}
                    <strong>Authentication &rarr; Settings &rarr; Authorized domains</strong>, bấm <strong>Add domain</strong> và thêm tên miền Vercel / GitHub Pages của bạn (VD: <code>gdqp-ctu.vercel.app</code>).
                  </li>
                </ol>
              </div>

              {/* Template firebaseConfig */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    A. Mẫu cấu hình firebaseConfig (trong src/services/firebaseConfig.ts)
                  </h4>
                  <button
                    type="button"
                    onClick={handleCopyConfig}
                    className="flex items-center space-x-1 text-xs bg-[#004B8D] hover:bg-[#00529C] text-white font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                  >
                    {copiedConfig ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedConfig ? 'Đã sao chép' : 'Sao chép firebaseConfig'}</span>
                  </button>
                </div>
                <pre className="p-4 rounded-2xl bg-slate-950 text-sky-300 text-[11px] font-mono overflow-x-auto leading-relaxed border border-slate-800">
                  <code>{TEMPLATE_FIREBASE_CONFIG}</code>
                </pre>
              </div>

              {/* Firestore Security Rules */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    B. Bộ Firebase Firestore Security Rules chuẩn (Chống đọc trộm &amp; xóa trái phép)
                  </h4>
                  <button
                    type="button"
                    onClick={handleCopyRules}
                    className="flex items-center space-x-1 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                  >
                    {copiedRules ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedRules ? 'Đã sao chép Rules!' : 'Sao chép Security Rules'}</span>
                  </button>
                </div>
                <pre className="p-4 rounded-2xl bg-slate-950 text-emerald-300 text-[11px] font-mono overflow-x-auto max-h-80 leading-relaxed border border-slate-800">
                  <code>{FIRESTORE_RULES_SNIPPET}</code>
                </pre>
              </div>
            </div>
          )}

          {/* TAB 2: EMPTY GITHUB REPO SOLUTION */}
          {activeTab === 'empty_github' && (
            <div className="space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3 text-amber-950 text-xs leading-relaxed">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold text-amber-900 block mb-1">
                    Hướng dẫn đẩy mã nguồn lên GitHub &amp; Deploy lên Vercel miễn phí:
                  </strong>
                  Mã nguồn là ứng dụng Web tĩnh (Vite + React + Firebase Modular SDK), triển khai cực nhanh trên Vercel hoặc GitHub Pages mà không cần server backend riêng.
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  <span className="w-5 h-5 rounded-full bg-[#004B8D] text-white flex items-center justify-center text-[11px]">
                    1
                  </span>
                  <span>Tải gói mã nguồn dự án về máy tính</span>
                </div>
                <p className="text-xs text-slate-600 mb-3">
                  Gói đã bao gồm toàn bộ mã nguồn React, Tailwind CSS, Logo Đại học Cần Thơ, SheetJS, Firebase SDK và Firestore Rules:
                </p>

                <div className="flex flex-wrap gap-3">
                  <a
                    href="/gdqp-ctu-source.tar.gz"
                    download="gdqp-ctu-source.tar.gz"
                    className="inline-flex items-center space-x-2 bg-[#004B8D] hover:bg-[#00529C] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải Mã Nguồn Đầy Đủ (gdqp-ctu-source.tar.gz)</span>
                  </a>

                  <a
                    href="/dist-build.tar.gz"
                    download="dist-build.tar.gz"
                    className="inline-flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    <FolderArchive className="w-4 h-4" />
                    <span>Tải Bản Build Sẵn (dist-build.tar.gz)</span>
                  </a>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  <span className="w-5 h-5 rounded-full bg-[#004B8D] text-white flex items-center justify-center text-[11px]">
                    2
                  </span>
                  <span>Đẩy mã nguồn lên GitHub</span>
                </div>

                <div className="mb-3">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    (Tùy chọn) Dán URL repository GitHub của bạn để tự động điền vào lệnh:
                  </label>
                  <input
                    type="text"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="VD: https://github.com/canbo/gdqp-ctu-lookup.git"
                    className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#00529C]"
                  />
                </div>

                <div className="relative rounded-2xl overflow-hidden bg-slate-950 text-slate-200 text-xs font-mono border border-slate-800">
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-slate-400">
                    <span className="text-[11px] font-sans">Terminal / PowerShell / Git Bash</span>
                    <button
                      type="button"
                      onClick={handleCopyGitCmd}
                      className="flex items-center space-x-1 text-xs text-amber-300 hover:text-white cursor-pointer font-sans"
                    >
                      {copiedGitCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedGitCmd ? 'Đã sao chép' : 'Sao chép lệnh'}</span>
                    </button>
                  </div>
                  <pre className="p-4 overflow-x-auto text-[11px] leading-relaxed text-sky-300">
                    <code>{gitCommands}</code>
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VERCEL CLI */}
          {activeTab === 'vercel' && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 text-base">
                  Triển khai trực tiếp lên Vercel bằng CLI
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Giải nén gói mã nguồn, cấu hình Firebase trong <code>src/services/firebaseConfig.ts</code> (hoặc biến môi trường Vercel), rồi chạy lệnh:
                </p>
                <div className="flex items-center justify-between bg-slate-950 text-sky-300 font-mono text-xs p-3 rounded-xl">
                  <span>npx vercel --prod</span>
                  <button
                    type="button"
                    onClick={handleCopyVercelCli}
                    className="text-slate-300 hover:text-white flex items-center space-x-1 cursor-pointer font-sans text-xs"
                  >
                    {copiedVercelCliCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedVercelCliCmd ? 'Đã chép' : 'Chép'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SCRIPT CODE */}
          {activeTab === 'appsscript' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50 p-4 rounded-2xl border border-amber-200">
                <div>
                  <h4 className="font-bold text-amber-950 text-sm">
                    Mã nguồn Google Apps Script (Tùy chọn dự phòng từ Google Drive)
                  </h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Quét folder My Drive\GDQP\Số hóa chứng chỉ nếu không dùng Cloud Firestore trực tiếp.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
                >
                  {copiedScript ? <Check className="w-4 h-4 text-slate-950" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedScript ? 'Đã sao chép!' : 'Sao chép Code.gs'}</span>
                </button>
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-slate-950 text-slate-200 text-xs font-mono border border-slate-800">
                <pre className="p-4 overflow-x-auto max-h-80 leading-relaxed">
                  <code>{GOOGLE_APPS_SCRIPT_CODE}</code>
                </pre>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">
                  Quy trình triển khai Google Apps Script:
                </h5>
                <ol className="space-y-2 text-xs text-slate-600 list-decimal list-inside">
                  {DEPLOYMENT_STEPS[0].instructions.map((ins, idx) => (
                    <li key={idx} className="leading-relaxed">
                      <span className="text-slate-800">{ins}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {/* TAB 5: EXCEL SCHEMA */}
          {activeTab === 'excel_schema' && (
            <div className="space-y-4">
              <div className="bg-blue-50/80 rounded-2xl p-4 border border-blue-200 text-xs text-[#002855]">
                <strong className="block font-bold text-[#003B73] mb-1">
                  Nhận diện linh hoạt nhiều mẫu file Excel (.xlsx, .xls, .csv):
                </strong>
                Hệ thống tự động phát hiện dòng tiêu đề cột, <strong>chỉ bỏ qua 01 dòng tiêu đề</strong> và đọc dữ liệu ngay từ dòng kế tiếp. Không bắt buộc thứ tự cột cố định.
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#002855] text-white font-bold">
                      <th className="p-3">Trường dữ liệu</th>
                      <th className="p-3">Tên cột nhận diện tự động</th>
                      <th className="p-3">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    <tr className="bg-amber-50/40">
                      <td className="p-3 font-bold text-amber-900">Số lưu vào sổ gốc</td>
                      <td className="p-3 font-mono text-[11px]">Số vào sổ gốc, Số vào sổ, Số lưu sổ gốc</td>
                      <td className="p-3 font-semibold text-amber-800">Hiển thị nổi bật cỡ lớn cho Cán bộ</td>
                    </tr>
                    <tr className="bg-blue-50/40">
                      <td className="p-3 font-bold text-[#003B73]">Số hiệu văn bằng</td>
                      <td className="p-3 font-mono text-[11px]">Số hiệu chứng chỉ, Số hiệu, Số văn bằng</td>
                      <td className="p-3 font-semibold text-[#004B8D]">Hiển thị nổi bật cỡ lớn cho Cán bộ</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold">Mã số sinh viên (MSSV)</td>
                      <td className="p-3 font-mono text-[11px]">MSSV, Mã người học, Mã sinh viên</td>
                      <td className="p-3 text-slate-500">Khóa chính tra cứu &amp; khử trùng lặp</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold">Họ và tên người học</td>
                      <td className="p-3 font-mono text-[11px]">Họ và tên người học, Họ tên, Họ lót + Tên</td>
                      <td className="p-3 text-slate-500">Tự ghép cột Họ đệm &amp; Tên nếu tách cột</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold">Thông tin bổ sung khác</td>
                      <td className="p-3 font-mono text-[11px]">
                        Ngày sinh, Nơi sinh, Giới tính, Dân tộc, Khóa học, Ngành đào tạo, Xếp loại, Ngày cấp
                      </td>
                      <td className="p-3 text-slate-500">Hiển thị đầy đủ trong phiếu đối chiếu</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Đại học Cần Thơ — Hệ thống Tra cứu Chứng chỉ GDQP&amp;AN
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
  );
};
