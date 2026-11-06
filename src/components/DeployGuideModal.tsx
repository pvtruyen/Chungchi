import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Terminal, 
  ExternalLink, 
  Code2, 
  Cloud, 
  Sparkles, 
  FileSpreadsheet, 
  ChevronRight, 
  Download, 
  Github, 
  AlertTriangle,
  FolderArchive,
  ArrowRight
} from 'lucide-react';
import { GOOGLE_APPS_SCRIPT_CODE, DEPLOYMENT_STEPS } from '../data/deploymentGuide';

interface DeployGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeployGuideModal: React.FC<DeployGuideModalProps> = ({ isOpen, onClose }) => {
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedGitCmd, setCopiedGitCmd] = useState(false);
  const [copiedVercelCliCmd, setCopiedVercelCliCmd] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'empty_github' | 'vercel' | 'netlify' | 'appsscript' | 'excel_schema'>('empty_github');

  if (!isOpen) return null;

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
git commit -m "Khoi tao he thong tra cuu chung chi GDQP CTU"

# Bước 4: Liên kết tới GitHub repository rỗng của bạn
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-slate-900 text-white">
          <div className="flex items-center space-x-2.5">
            <Github className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold">
              Hướng Dẫn Đẩy Lên GitHub &amp; Triển Khai Vercel
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 px-6 pt-3 bg-slate-50 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('empty_github')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'empty_github'
                ? 'border-amber-600 text-amber-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Github className="w-4 h-4 text-amber-600" />
            <span>Xử Lý GitHub Rỗng &rarr; Vercel</span>
          </button>

          <button
            onClick={() => setActiveTab('vercel')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'vercel'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Cloud className="w-4 h-4 text-emerald-600" />
            <span>Deploy Vercel CLI (Không cần Git)</span>
          </button>

          <button
            onClick={() => setActiveTab('netlify')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'netlify'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Cloud className="w-4 h-4 text-emerald-600" />
            <span>Netlify Drop (10 giây)</span>
          </button>

          <button
            onClick={() => setActiveTab('appsscript')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'appsscript'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code2 className="w-4 h-4 text-emerald-600" />
            <span>Google Apps Script (Code.gs)</span>
          </button>

          <button
            onClick={() => setActiveTab('excel_schema')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'excel_schema'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Phôi File Excel GDQP</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-sm flex-1">
          {/* TAB 1: EMPTY GITHUB REPO SOLUTION */}
          {activeTab === 'empty_github' && (
            <div className="space-y-5">
              {/* Alert explanation */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3 text-amber-950 text-xs leading-relaxed">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold text-amber-900 block mb-1">
                    Nguyên nhân Vercel báo lỗi "GitHub repo rỗng":
                  </strong>
                  Khi tạo mới repository trên GitHub, repo ban đầu chưa có nhánh hoặc commit nào (`main` rỗng), nên Vercel không tìm thấy file `package.json` và mã nguồn để build.
                  <br />
                  Chỉ cần làm theo 2 bước đơn giản bên dưới là hoàn thành ngay:
                </div>
              </div>

              {/* Step 1: Download code archive */}
              <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px]">
                    1
                  </span>
                  <span>Tải gói mã nguồn dự án về máy tính</span>
                </div>
                <p className="text-xs text-slate-600 mb-3">
                  Gói đã bao gồm toàn bộ mã nguồn React, Tailwind CSS, logo CTU, cấu hình Vite và tài liệu hướng dẫn:
                </p>

                <div className="flex flex-wrap gap-3">
                  <a
                    href="/gdqp-ctu-source.tar.gz"
                    download="gdqp-ctu-source.tar.gz"
                    className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải Mã Nguồn Đầy Đủ (gdqp-ctu-source.tar.gz - 369 KB)</span>
                  </a>

                  <a
                    href="/dist-build.tar.gz"
                    download="dist-build.tar.gz"
                    className="inline-flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    <FolderArchive className="w-4 h-4" />
                    <span>Tải Bản Build Sẵn (dist-build.tar.gz - 299 KB)</span>
                  </a>
                </div>
              </div>

              {/* Step 2: Push to GitHub */}
              <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px]">
                    2
                  </span>
                  <span>Đẩy mã nguồn lên GitHub (5 câu lệnh)</span>
                </div>

                <div className="mb-3">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    (Tùy chọn) Dán URL repository GitHub của bạn vào đây để tự động điền lệnh:
                  </label>
                  <input
                    type="text"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="VD: https://github.com/pvtruyen/gdqp-lookup.git"
                    className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="relative rounded-2xl overflow-hidden bg-slate-950 text-slate-200 text-xs font-mono border border-slate-800">
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-slate-400">
                    <span className="text-[11px] font-sans">Terminal / PowerShell / Git Bash</span>
                    <button
                      onClick={handleCopyGitCmd}
                      className="flex items-center space-x-1 text-xs text-amber-300 hover:text-white cursor-pointer font-sans"
                    >
                      {copiedGitCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedGitCmd ? 'Đã sao chép' : 'Sao chép lệnh'}</span>
                    </button>
                  </div>
                  <pre className="p-4 overflow-x-auto text-[11px] leading-relaxed text-emerald-300">
                    <code>{gitCommands}</code>
                  </pre>
                </div>
              </div>

              {/* Step 3: Return to Vercel */}
              <div className="bg-emerald-50/70 rounded-2xl p-4 border border-emerald-200 text-xs text-emerald-950 flex items-start space-x-3">
                <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold block mb-0.5">
                    Bước cuối cùng trên Vercel:
                  </strong>
                  Sau khi chạy lệnh `git push` ở trên thành công, bạn quay lại trang Vercel &gt; Bấm tải lại danh sách repo hoặc bấm **Deploy**. Vercel sẽ tự động build xong trong khoảng 45 giây và cấp link truy cập công khai!
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VERCEL CLI */}
          {activeTab === 'vercel' && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <h4 className="font-bold text-slate-900 text-base mb-2">
                  Triển khai trực tiếp lên Vercel bằng CLI (Không cần đẩy lên GitHub)
                </h4>
                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  Nếu bạn không muốn quản lý qua GitHub, Vercel cung cấp công cụ dòng lệnh `vercel` cho phép đưa thẳng dự án lên server:
                </p>

                <div className="space-y-3">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <div className="font-bold text-xs text-slate-800 mb-1">
                      1. Tải và giải nén gói mã nguồn về thư mục máy tính
                    </div>
                    <a
                      href="/gdqp-ctu-source.tar.gz"
                      download="gdqp-ctu-source.tar.gz"
                      className="inline-flex items-center space-x-1.5 text-xs text-emerald-700 font-bold hover:underline mt-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải file nén gdqp-ctu-source.tar.gz</span>
                    </a>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <div className="font-bold text-xs text-slate-800 mb-1">
                      2. Mở Terminal trong thư mục vừa giải nén và chạy lệnh:
                    </div>
                    <div className="flex items-center justify-between bg-slate-950 text-emerald-300 font-mono text-xs p-3 rounded-lg mt-2">
                      <span>npx vercel --prod</span>
                      <button
                        onClick={handleCopyVercelCli}
                        className="text-slate-400 hover:text-white flex items-center space-x-1 cursor-pointer font-sans text-xs"
                      >
                        {copiedVercelCliCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedVercelCliCmd ? 'Đã chép' : 'Chép'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600">
                    <strong className="font-semibold text-slate-800 block mb-1">
                      3. Trả lời các câu hỏi mặc định của Vercel:
                    </strong>
                    Nhấn phím <kbd className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">Enter</kbd> để chấp nhận toàn bộ thiết lập mặc định (Vite). Vercel sẽ trả về URL chính thức trong 30 giây!
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: NETLIFY DROP */}
          {activeTab === 'netlify' && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <h4 className="font-bold text-slate-900 text-base mb-2">
                  Triển khai lên Netlify Drop (Cực nhanh - Kéo thả)
                </h4>
                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  Netlify Drop cho phép kéo thả trực tiếp thư mục `dist` đã được đóng gói sẵn để chạy web ngay lập tức mà không cần tài khoản GitHub hay gõ lệnh:
                </p>

                <div className="space-y-3">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <div className="font-bold text-xs text-slate-800 mb-1">
                      Bước 1: Tải thư mục bản build sản phẩm đã biên dịch sẵn
                    </div>
                    <a
                      href="/dist-build.tar.gz"
                      download="dist-build.tar.gz"
                      className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-lg mt-2 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải dist-build.tar.gz (299 KB)</span>
                    </a>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700">
                    <div className="font-bold text-xs text-slate-800 mb-1">
                      Bước 2: Giải nén file để lấy thư mục <code>dist</code>
                    </div>
                    Thư mục <code>dist</code> chứa sẵn file <code>index.html</code>, CSS, Javascript và logo CTU đã được tối ưu hóa.
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700">
                    <div className="font-bold text-xs text-slate-800 mb-1">
                      Bước 3: Mở Netlify Drop và kéo thả thư mục <code>dist</code>
                    </div>
                    Truy cập{' '}
                    <a
                      href="https://app.netlify.com/drop"
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-600 font-bold underline inline-flex items-center gap-1"
                    >
                      app.netlify.com/drop <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    và kéo thả thư mục <code>dist</code> vào ô tròn trên màn hình. Netlify sẽ tạo ngay trang web hoạt động 100%!
                  </div>
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
                    Mã nguồn Google Apps Script (Quét folder My Drive\GDQP\Số hóa chứng chỉ)
                  </h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Tự động tìm kiếm theo MSSV, tích hợp Cache 6 giờ, tốc độ phản hồi &lt; 200ms.
                  </p>
                </div>
                <button
                  onClick={handleCopyScript}
                  className="flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl shadow transition-all cursor-pointer shrink-0"
                >
                  {copiedScript ? <Check className="w-4 h-4 text-slate-950" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedScript ? 'Đã sao chép vào bộ nhớ tạm!' : 'Sao chép mã nguồn Code.gs'}</span>
                </button>
              </div>

              {/* Code block */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 text-slate-200 text-xs font-mono border border-slate-800">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-slate-400">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 text-[11px] font-sans">Code.gs</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Google Apps Script</span>
                </div>
                <pre className="p-4 overflow-x-auto max-h-96 leading-relaxed">
                  <code>{GOOGLE_APPS_SCRIPT_CODE}</code>
                </pre>
              </div>

              {/* Detailed steps list */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">
                  Quy trình 6 bước triển khai Google Apps Script:
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
              <div className="bg-emerald-50/70 rounded-2xl p-4 border border-emerald-200 text-xs text-emerald-950">
                <strong className="block font-bold mb-1">
                  Cấu trúc phôi mẫu chuẩn hóa của Phòng GDQP:
                </strong>
                Hệ thống tự động bỏ qua các dòng tiêu đề trên cùng (dòng 1: Tên cơ sở đào tạo, dòng 2: Báo cáo cấp phát, dòng 3: Tiêu đề cột) và bắt đầu đọc dữ liệu thực tế từ dòng số 4.
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold">
                      <th className="p-3 border-b border-slate-800">Cột</th>
                      <th className="p-3 border-b border-slate-800">Tên trường dữ liệu</th>
                      <th className="p-3 border-b border-slate-800">Ví dụ dữ liệu</th>
                      <th className="p-3 border-b border-slate-800">Ý nghĩa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-emerald-700">A (1)</td>
                      <td className="p-3 font-semibold">STT</td>
                      <td className="p-3 font-mono">142</td>
                      <td className="p-3 text-slate-500">Số thứ tự lưu phôi (đọc cho cán bộ)</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-emerald-700">B (2)</td>
                      <td className="p-3 font-semibold">Họ chữ đệm và tên</td>
                      <td className="p-3">Nguyễn Văn A</td>
                      <td className="p-3 text-slate-500">Họ và tên người học</td>
                    </tr>
                    <tr className="hover:bg-slate-50 bg-amber-50/30">
                      <td className="p-3 font-mono font-bold text-amber-700">C (3)</td>
                      <td className="p-3 font-bold text-amber-900">Mã người học (MSSV)</td>
                      <td className="p-3 font-mono font-bold text-amber-800">B2101234</td>
                      <td className="p-3 text-amber-800">Khóa tra cứu chính (100% Exact match)</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-emerald-700">D (4)</td>
                      <td className="p-3 font-semibold">Ngày tháng năm sinh</td>
                      <td className="p-3 font-mono">20/05/2003</td>
                      <td className="p-3 text-slate-500">Ngày sinh của sinh viên</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-emerald-700">E (5)</td>
                      <td className="p-3 font-semibold">Giới tính</td>
                      <td className="p-3">Nam</td>
                      <td className="p-3 text-slate-500">Nam / Nữ</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-emerald-700">F (6)</td>
                      <td className="p-3 font-semibold">Số hiệu chứng chỉ (Số VB)</td>
                      <td className="p-3 font-mono">C123456</td>
                      <td className="p-3 text-slate-500">Số seri in trên chứng chỉ</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-emerald-700">G (7)</td>
                      <td className="p-3 font-semibold">Số vào sổ gốc cấp chứng chỉ</td>
                      <td className="p-3 font-mono">890/2025/GDQP</td>
                      <td className="p-3 text-slate-500">Số quản lý sổ bộ</td>
                    </tr>
                    <tr className="hover:bg-slate-50 bg-emerald-50/40">
                      <td className="p-3 font-mono font-bold text-emerald-700">H (8)</td>
                      <td className="p-3 font-bold text-emerald-900">Ngày cấp</td>
                      <td className="p-3 font-mono font-bold text-emerald-800">15/10/2025</td>
                      <td className="p-3 text-emerald-800">Ngày ký và trao chứng chỉ</td>
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
            Hỗ trợ cấu trúc Excel theo Thông tư của Bộ GD&amp;ĐT
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
