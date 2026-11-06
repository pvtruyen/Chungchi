import React from 'react';
import { AlertTriangle, HelpCircle, PhoneCall, RefreshCw, CheckCircle, Search } from 'lucide-react';

interface NotFoundStateProps {
  searchedMssv: string;
  onRetry: () => void;
  sampleMssvs: string[];
  onSelectSample: (mssv: string) => void;
}

export const NotFoundState: React.FC<NotFoundStateProps> = ({
  searchedMssv,
  onRetry,
  sampleMssvs,
  onSelectSample,
}) => {
  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-rose-200 text-center max-w-2xl mx-auto">
      {/* Alert Icon */}
      <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
        <AlertTriangle className="w-8 h-8 text-rose-600" />
      </div>

      <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-2">
        Không tìm thấy dữ liệu chứng chỉ cho MSSV:{' '}
        <span className="font-mono text-rose-600 underline decoration-rose-300 decoration-2">
          {searchedMssv}
        </span>
      </h3>

      <p className="text-sm sm:text-base text-slate-600 mb-6 leading-relaxed">
        Vui lòng kiểm tra lại chính xác Mã số sinh viên hoặc liên hệ trực tiếp Bộ phận quản lý cấp phát chứng chỉ Giáo dục Quốc phòng &amp; An ninh để được hỗ trợ kiểm tra sổ gốc.
      </p>

      {/* Helpful Checks */}
      <div className="text-left bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/80 mb-6">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-emerald-600" />
          Gợi ý kiểm tra:
        </div>
        <ul className="space-y-2 text-xs sm:text-sm text-slate-600">
          <li className="flex items-start gap-2">
            <span className="text-emerald-600 font-bold">•</span>
            <span>
              Đảm bảo MSSV đúng định dạng của trường (ví dụ: <strong className="font-mono text-slate-800">B2101234</strong> thay vì gõ nhầm chữ O và số 0).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-600 font-bold">•</span>
            <span>
              Nếu bạn thuộc đợt học bù hoặc xét tốt nghiệp đợt muộn, danh sách có thể nằm ở file đợt bổ sung.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-600 font-bold">•</span>
            <span>
              Hãy đến bàn tiếp nhận của Cán bộ GDQP mang theo Thẻ sinh viên hoặc CCCD để tra cứu thủ công trên hệ thống máy chủ.
            </span>
          </li>
        </ul>
      </div>

      {/* Sample Quick Try */}
      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span>Thử tra cứu MSSV mẫu:</span>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {sampleMssvs.slice(0, 3).map((sample) => (
            <button
              key={sample}
              onClick={() => onSelectSample(sample)}
              className="text-xs font-mono font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
            >
              {sample}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
