import React from 'react';
import { AlertTriangle, HelpCircle, Search } from 'lucide-react';

interface NotFoundStateProps {
  searchedMssv: string;
  onRetry: () => void;
  sampleMssvs: string[];
  onSelectSample: (mssv: string) => void;
  diagnosticMessage?: string | null;
}

export const NotFoundState: React.FC<NotFoundStateProps> = ({
  searchedMssv,
  sampleMssvs,
  onSelectSample,
  diagnosticMessage,
}) => {
  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-lg border border-rose-200 text-center max-w-2xl mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
        <AlertTriangle className="w-8 h-8 text-rose-600" />
      </div>

      <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-2">
        Không tìm thấy dữ liệu chứng chỉ cho:{' '}
        <span className="font-mono text-rose-600 underline decoration-rose-300 decoration-2">
          {searchedMssv}
        </span>
      </h3>

      {diagnosticMessage ? (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs sm:text-sm text-left leading-relaxed">
          <strong className="block text-amber-900 mb-1">Chẩn đoán nguồn dữ liệu (Chế độ 2 - Google Drive):</strong>
          <span>{diagnosticMessage}</span>
        </div>
      ) : (
        <p className="text-sm sm:text-base text-slate-600 mb-6 leading-relaxed">
          Vui lòng kiểm tra lại chính xác Mã số sinh viên hoặc Họ và tên, hoặc liên hệ Trung tâm Giáo dục Quốc phòng và An ninh — Đại học Cần Thơ để được hỗ trợ kiểm tra sổ gốc.
        </p>
      )}

      <div className="text-left bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/80 mb-6">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-[#00529C]" />
          Gợi ý kiểm tra:
        </div>
        <ul className="space-y-2 text-xs sm:text-sm text-slate-600">
          <li className="flex items-start gap-2">
            <span className="text-[#00529C] font-bold">•</span>
            <span>
              Đảm bảo MSSV đúng định dạng của Đại học Cần Thơ (ví dụ: <strong className="font-mono text-slate-800">B2101234</strong>, tránh nhầm chữ O và số 0).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#00529C] font-bold">•</span>
            <span>
              Nếu bạn thuộc đợt học bù hoặc xét cấp bổ sung, danh sách có thể đang được cán bộ cập nhật lên hệ thống.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#00529C] font-bold">•</span>
            <span>
              Vui lòng mang theo Thẻ sinh viên hoặc CCCD đến bàn tiếp nhận của Cán bộ GDQP&amp;AN để kiểm tra trực tiếp trên sổ gốc.
            </span>
          </li>
        </ul>
      </div>

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
              className="text-xs font-mono font-bold bg-slate-100 hover:bg-blue-50 hover:text-[#004B8D] hover:border-blue-300 border border-slate-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
            >
              {sample}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
