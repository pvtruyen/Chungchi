import React, { useState } from 'react';
import { Volume2, VolumeX, Copy, Check, Sparkles, Megaphone, Calendar, Hash, Award } from 'lucide-react';
import { CertificateRecord } from '../types/certificate';

interface HighlightedResultCardProps {
  record: CertificateRecord;
}

export const HighlightedResultCard: React.FC<HighlightedResultCardProps> = ({ record }) => {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleCopy = () => {
    const textToCopy = `STT: ${record.stt} - Ngày cấp: ${record.ngayCap} - MSSV: ${record.mssv} (${record.hoVaTen})`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) {
      alert('Trình duyệt của bạn không hỗ trợ đọc âm thanh (Speech Synthesis).');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Prepare speech text in Vietnamese
    const speechText = `Số thứ tự ${record.stt}. Ngày cấp ${record.ngayCap.replace(/\//g, ' tháng ').replace(/ tháng (\d{4})$/, ' năm $1')}. Sinh viên ${record.hoVaTen}.`;
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = 'vi-VN';
    utterance.rate = 0.9; // clear, steady pace

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-950 p-1 shadow-2xl border-2 border-emerald-500/50">
      {/* Decorative military gold & emerald glow elements */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative bg-slate-900/90 rounded-[22px] p-5 sm:p-7 md:p-8">
        {/* Top Action & Instructions Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-800/40 pb-4 mb-6">
          <div className="flex items-center space-x-2.5">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
            </span>
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <Megaphone className="w-4 h-4 text-amber-400" />
              THÔNG TIN CẤP PHÁT (ĐỌC CHO CÁN BỘ PHÁT BẰNG)
            </span>
          </div>

          {/* Audio & Copy Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSpeak}
              className={`flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                isSpeaking
                  ? 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-amber-300 border-amber-500/30'
              }`}
              title="Nhấn để đọc to số thứ tự và ngày cấp cho cán bộ nghe"
            >
              {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{isSpeaking ? 'Đang đọc...' : 'Đọc to 🔊'}</span>
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center space-x-1.5 text-xs font-semibold bg-slate-800/80 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              title="Sao chép nhanh STT và Ngày cấp"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
            </button>
          </div>
        </div>

        {/* EXTRA LARGE HIGHLIGHT CARDS: STT AND NGÀY CẤP */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6">
          {/* SỐ THỨ TỰ (STT) - DOMINANT CARD */}
          <div className="md:col-span-7 relative overflow-hidden bg-gradient-to-br from-amber-500/15 via-amber-600/5 to-slate-900 rounded-2xl p-5 sm:p-6 border-2 border-amber-400/50 shadow-inner group">
            <div className="flex items-center justify-between text-amber-300/80 mb-2">
              <span className="flex items-center space-x-1.5 text-xs sm:text-sm font-bold uppercase tracking-wider">
                <Hash className="w-4 h-4 text-amber-400" />
                <span>SỐ THỨ TỰ (STT)</span>
              </span>
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 rounded-full uppercase">
                Ưu tiên số 1
              </span>
            </div>

            <div className="flex items-baseline space-x-3 my-1">
              <span className="font-mono text-6xl sm:text-7xl md:text-8xl font-black text-amber-300 tracking-tight drop-shadow-md">
                {record.stt}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 mt-2 font-medium">
              Vị trí sắp xếp phôi bằng trong hồ sơ lưu trữ
            </p>
          </div>

          {/* NGÀY CẤP - COMPLEMENTARY HIGHLIGHT CARD */}
          <div className="md:col-span-5 relative overflow-hidden bg-gradient-to-br from-emerald-500/15 via-emerald-600/5 to-slate-900 rounded-2xl p-5 sm:p-6 border-2 border-emerald-400/50 shadow-inner">
            <div className="flex items-center justify-between text-emerald-300/80 mb-2">
              <span className="flex items-center space-x-1.5 text-xs sm:text-sm font-bold uppercase tracking-wider">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>NGÀY CẤP</span>
              </span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/15 border border-emerald-400/30 px-2 py-0.5 rounded-full uppercase">
                Đợt cấp
              </span>
            </div>

            <div className="my-1">
              <span className="font-mono text-3xl sm:text-4xl md:text-5xl font-black text-emerald-300 tracking-tight drop-shadow-md block">
                {record.ngayCap}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 mt-2 font-medium">
              Ngày ký ban hành và đóng dấu chứng chỉ
            </p>
          </div>
        </div>

        {/* Quick Identity Footnote */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-slate-300">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Người học:</span>
            <strong className="text-white font-bold text-base">{record.hoVaTen}</strong>
            <span className="text-amber-400 font-mono font-bold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
              {record.mssv}
            </span>
          </div>

          <div className="flex items-center space-x-2 text-slate-400">
            <span>Số vào sổ gốc:</span>
            <strong className="text-emerald-300 font-mono font-bold">{record.soVaoSoGoc}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
