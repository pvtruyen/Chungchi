import React, { useState } from 'react';
import { Search, X, Sparkles, ArrowRight, CornerDownLeft, ShieldCheck } from 'lucide-react';

interface SearchHeroProps {
  onSearch: (mssv: string) => void;
  isSearching: boolean;
  sampleMssvs: string[];
}

export const SearchHero: React.FC<SearchHeroProps> = ({
  onSearch,
  isSearching,
  sampleMssvs,
}) => {
  const [inputVal, setInputVal] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputVal.trim();
    if (clean) {
      onSearch(clean);
    }
  };

  const handleSelectSample = (sample: string) => {
    setInputVal(sample);
    onSearch(sample);
  };

  const handleClear = () => {
    setInputVal('');
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white pt-8 pb-10 px-4 sm:px-6 lg:px-8 border-b border-slate-700/60 shadow-lg">
      {/* Background Military Grid Accent Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#059669_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none" />
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-3xl mx-auto relative z-10 text-center">
        {/* Banner Tag */}
        <div className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-3.5 py-1.5 rounded-full mb-4">
          <img
            src="https://www.ctu.edu.vn/images/branding/logo/CTU_logo.png"
            alt="CTU"
            className="w-4 h-4 object-contain rounded-full bg-white/90 p-0.5 inline-block"
          />
          <span className="font-semibold tracking-wide">
            Đại học Cần Thơ — Cổng tra cứu phục vụ cấp phát chứng chỉ
          </span>
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
          Tra Cứu Thông Tin Cấp Phát Chứng Chỉ GDQP&amp;AN
        </h2>
        <p className="text-slate-300 text-xs sm:text-sm md:text-base max-w-2xl mx-auto mb-6 leading-relaxed">
          Nhập <strong className="text-amber-300 font-bold">Mã số sinh viên (MSSV)</strong> để nhận ngay <strong className="text-emerald-300 font-bold">Số thứ tự (STT)</strong> và <strong className="text-emerald-300 font-bold">Số vào sổ gốc</strong> để đọc cho cán bộ quản lý rút bằng nhanh chóng.
        </p>

        {/* Search Input Box */}
        <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto">
          <div className="relative flex items-center bg-white rounded-2xl p-2 shadow-2xl shadow-black/40 border-2 border-emerald-500/40 focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-500/20 transition-all">
            <div className="pl-3 pr-2 text-slate-400">
              <Search className="w-6 h-6 text-emerald-600" />
            </div>

            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Nhập Mã số sinh viên (VD: B2101234, B2209999)..."
              autoFocus
              className="w-full py-2.5 px-2 text-slate-900 placeholder:text-slate-400 font-semibold sm:text-lg focus:outline-none uppercase tracking-wider"
            />

            {inputVal && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors mr-1 cursor-pointer"
                title="Xóa nội dung"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <button
              type="submit"
              disabled={isSearching || !inputVal.trim()}
              className="flex items-center space-x-1.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.98] text-white px-5 sm:px-7 py-3 rounded-xl font-bold sm:text-base shadow-md shadow-emerald-950/40 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
            >
              {isSearching ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Tra cứu</span>
                  <ArrowRight className="w-4 h-4 hidden sm:inline" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Sample Pills for Quick Testing */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="text-slate-400 flex items-center space-x-1 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>MSSV thử nghiệm:</span>
          </span>
          {sampleMssvs.map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => handleSelectSample(sample)}
              className="bg-slate-800/90 hover:bg-slate-700 hover:text-amber-300 border border-slate-600 text-slate-200 font-mono font-bold px-2.5 py-1 rounded-md transition-colors cursor-pointer"
            >
              {sample}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
