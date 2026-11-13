import React, { useState } from 'react';
import { Volume2, VolumeX, Copy, Check, Megaphone, Award, Shield } from 'lucide-react';
import { CertificateRecord } from '../types/certificate';

interface HighlightedResultCardProps {
  record: CertificateRecord;
}

export const HighlightedResultCard: React.FC<HighlightedResultCardProps> = ({ record }) => {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);

  const handleCopy = () => {
    const textToCopy = `Số lưu vào sổ gốc: ${record.soVaoSoGoc} | Số hiệu văn bằng: ${record.soHieuChungChi} | Họ tên: ${record.hoVaTen} | MSSV: ${record.mssv} | STT: ${record.stt}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) {
      setSpeechNotice('Trình duyệt hiện tại không hỗ trợ đọc âm thanh.');
      setTimeout(() => setSpeechNotice(null), 3500);
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const speechText = `Số lưu vào sổ gốc ${record.soVaoSoGoc}. Số hiệu văn bằng ${record.soHieuChungChi}. Sinh viên ${record.hoVaTen}. Số thứ tự ${record.stt}.`;
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = 'vi-VN';
    utterance.rate = 0.9;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#003B73] via-[#004B8D] to-[#002855] p-1 shadow-2xl border-2 border-blue-400/50">
      {/* Decorative CTU Blue & Gold glow elements */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-400/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-sky-400/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative bg-[#001F3F]/95 rounded-[22px] p-5 sm:p-7 md:p-8">
        {/* Top Action & Instructions Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-400/25 pb-4 mb-6">
          <div className="flex items-center space-x-2.5">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400" />
            </span>
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <Megaphone className="w-4 h-4 text-amber-400" />
              THÔNG TIN ĐỐI CHIẾU CẤP PHÁT (ĐỌC CHO CÁN BỘ PHÁT BẰNG)
            </span>
          </div>

          {/* Audio & Copy Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSpeak}
              className={`flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                isSpeaking
                  ? 'bg-amber-400 text-[#001F3F] border-amber-300 animate-pulse'
                  : 'bg-blue-950/90 hover:bg-blue-900 text-amber-300 border-amber-400/40'
              }`}
              title="Nhấn để đọc to Số lưu vào sổ gốc và Số hiệu văn bằng"
            >
              {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{isSpeaking ? 'Đang đọc...' : 'Đọc to'}</span>
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center space-x-1.5 text-xs font-semibold bg-blue-950/90 hover:bg-blue-900 text-sky-200 border border-sky-400/40 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              title="Sao chép nhanh Số lưu vào sổ gốc và Số hiệu văn bằng"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
            </button>
          </div>
        </div>

        {speechNotice && (
          <div className="mb-4 text-xs text-amber-200 bg-amber-500/15 border border-amber-400/30 px-3 py-2 rounded-lg">
            {speechNotice}
          </div>
        )}

        {/* 02 EXTRA LARGE HIGHLIGHT CARDS: SỐ LƯU VÀO SỔ GỐC & SỐ HIỆU VĂN BẰNG */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* CARD 1: SỐ LƯU VÀO SỔ GỐC */}
          <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/15 via-amber-600/5 to-[#001933] rounded-2xl p-5 sm:p-6 border-2 border-amber-400/60 shadow-inner">
            <div className="flex items-center justify-between text-amber-300 mb-2">
              <span className="flex items-center space-x-1.5 text-xs sm:text-sm font-bold uppercase tracking-wider">
                <Award className="w-4 h-4 text-amber-400" />
                <span>SỐ LƯU VÀO SỔ GỐC</span>
              </span>
              <span className="text-[10px] font-bold text-amber-300 bg-amber-400/15 border border-amber-400/30 px-2.5 py-0.5 rounded-full uppercase">
                Ưu tiên số 1
              </span>
            </div>

            <div className="my-2">
              <span className="font-mono text-3xl sm:text-4xl md:text-5xl font-black text-amber-300 tracking-tight drop-shadow-md block break-all leading-tight">
                {record.soVaoSoGoc}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-blue-100/80 mt-2 font-medium">
              Số vào sổ gốc cấp chứng chỉ GDQP&amp;AN — Đại học Cần Thơ
            </p>
          </div>

          {/* CARD 2: SỐ HIỆU VĂN BẰNG */}
          <div className="relative overflow-hidden bg-gradient-to-br from-sky-500/15 via-blue-600/10 to-[#001933] rounded-2xl p-5 sm:p-6 border-2 border-sky-400/60 shadow-inner">
            <div className="flex items-center justify-between text-sky-200 mb-2">
              <span className="flex items-center space-x-1.5 text-xs sm:text-sm font-bold uppercase tracking-wider">
                <Shield className="w-4 h-4 text-sky-300" />
                <span>SỐ HIỆU VĂN BẰNG</span>
              </span>
              <span className="text-[10px] font-bold text-sky-200 bg-sky-400/15 border border-sky-400/30 px-2.5 py-0.5 rounded-full uppercase">
                Số hiệu chứng chỉ
              </span>
            </div>

            <div className="my-2">
              <span className="font-mono text-3xl sm:text-4xl md:text-5xl font-black text-sky-300 tracking-tight drop-shadow-md block break-all leading-tight">
                {record.soHieuChungChi}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-blue-100/80 mt-2 font-medium">
              Số hiệu phôi văn bằng in trực tiếp trên chứng chỉ
            </p>
          </div>
        </div>

        {/* Quick Identity Footnote */}
        <div className="mt-5 pt-4 border-t border-blue-400/20 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-blue-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-blue-200/80">Người học:</span>
            <strong className="text-white font-bold text-base">{record.hoVaTen}</strong>
            <span className="text-amber-300 font-mono font-bold bg-amber-400/15 px-2 py-0.5 rounded border border-amber-400/30">
              {record.mssv}
            </span>
            {record.khoaHoc && (
              <span className="text-blue-100 text-xs bg-blue-900/70 px-2 py-0.5 rounded border border-blue-400/25">
                {record.khoaHoc}
              </span>
            )}
            {record.nganhDaoTao && (
              <span className="text-sky-200 text-xs bg-sky-900/50 px-2 py-0.5 rounded border border-sky-400/25">
                {record.nganhDaoTao}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3 text-blue-200 text-xs">
            {record.stt && (
              <div>
                <span>STT:</span> <strong className="text-amber-300 font-mono font-bold">{record.stt}</strong>
              </div>
            )}
            {record.xepLoai && (
              <div>
                <span>• Xếp loại:</span> <strong className="text-sky-300 font-bold">{record.xepLoai}</strong>
              </div>
            )}
            {record.ngayCap && (
              <div>
                <span>• Ngày cấp:</span> <strong className="text-sky-300 font-mono font-bold">{record.ngayCap}</strong>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
