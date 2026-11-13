import React, { useState } from 'react';
import { Search, X, Sparkles, ArrowRight } from 'lucide-react';
import { CtuLogo } from './CtuLogo';

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
    <div className="relative overflow-hidden bg-gradient-to-b from-[#002855] via-[#003D7A] to-[#00529C] text-white pt-8 pb-11 px-4 sm:px-6 lg:px-8 border-b-4 border-amber-400 shadow-lg">
      {/* Subtle Academic Grid Background */}
      <div className="absolute inset-0 bg-[radial-gradient(#93C5FD_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-sky-400/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-3xl mx-auto relative z-10 text-center">
        {/* Banner Tag */}
        <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-xs border border-sky-300/30 text-sky-100 text-xs px-3.5 py-1.5 rounded-full mb-4 shadow-xs">
          <CtuLogo sizeClass="w-5 h-5 rounded-full p-0.5 border-0" alt="Đại học Cần Thơ" />
          <span className="font-semibold tracking-wide">
            Đại học Cần Thơ — Hệ thống tra cứu &amp; đối chiếu cấp phát văn bằng
          </span>
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2.5 drop-shadow-xs">
          Tra Cứu Thông Tin Chứng Chỉ GDQP&amp;AN
        </h2>
        <p className="text-blue-100 text-xs sm:text-sm md:text-base max-w-2xl mx-auto mb-6 leading-relaxed">
          Nhập <strong className="text-amber-300 font-bold">Mã số sinh viên (MSSV)</strong> hoặc{' '}
          <strong className="text-amber-300 font-bold">Họ và tên</strong> để nhận ngay{' '}
          <strong className="text-amber-300 font-bold">Số lưu vào sổ gốc</strong> và{' '}
          <strong className="text-sky-200 font-bold">Số hiệu văn bằng</strong> đối chiếu cấp phát.
        </p>

        {/* Search Input Box */}
        <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto">
          <div className="relative flex items-center bg-white rounded-2xl p-2 shadow-2xl shadow-[#001833]/50 border-2 border-sky-300/50 focus-within:border-amber-400 focus-within:ring-4 focus-within:ring-amber-400/25 transition-all">
            <div className="pl-3 pr-2 text-slate-400">
              <Search className="w-6 h-6 text-[#00529C]" />
            </div>

            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Nhập MSSV (VD: B2101234) hoặc Họ và tên sinh viên..."
              autoFocus
              className="w-full py-2.5 px-2 text-slate-900 placeholder:text-slate-400 font-semibold sm:text-lg focus:outline-none tracking-wide"
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
              className="flex items-center space-x-1.5 bg-gradient-to-r from-[#004B8D] to-[#0066B3] hover:from-[#00529C] hover:to-[#0077CC] active:scale-[0.98] text-white px-5 sm:px-7 py-3 rounded-xl font-bold sm:text-base shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
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

        {/* Quick Sample MSSVs */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="text-blue-200 flex items-center space-x-1 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>MSSV mẫu:</span>
          </span>
          {sampleMssvs.map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => handleSelectSample(sample)}
              className="bg-white/10 hover:bg-white/20 hover:text-amber-300 border border-blue-300/30 text-white font-mono font-bold px-2.5 py-1 rounded-md transition-colors cursor-pointer"
            >
              {sample}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
