import React, { useState, useEffect } from 'react';
import { 
  X, 
  Clock, 
  Search, 
  CheckCircle2, 
  CircleDashed, 
  Download, 
  Trash2, 
  User, 
  Calendar, 
  Hash, 
  FileSpreadsheet, 
  RefreshCw, 
  ShieldCheck, 
  AlertCircle,
  ExternalLink,
  Filter
} from 'lucide-react';
import { SearchHistoryItem } from '../types/certificate';
import { 
  subscribeSearchHistory, 
  toggleHistoryDaPhat, 
  deleteHistoryItem, 
  clearAllSearchHistory 
} from '../services/firestoreService';
import * as XLSX from 'xlsx';

interface SearchHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchHistoryModal: React.FC<SearchHistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [historyItems, setHistoryItems] = useState<SearchHistoryItem[]>([]);
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'issued'>('all');
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Subscribe to real-time search history when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = subscribeSearchHistory((items) => {
      setHistoryItems(items);
    }, 150);

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Toggle "Đã phát chứng chỉ"
  const handleToggleDaPhat = async (item: SearchHistoryItem) => {
    setIsUpdatingId(item.id);
    try {
      await toggleHistoryDaPhat(item.id, item.daPhat);
      setFeedbackMsg(
        item.daPhat
          ? `Đã hủy đánh dấu đã phát cho MSSV ${item.mssv}`
          : `Đã xác nhận phát chứng chỉ cho sinh viên ${item.hoVaTen} (${item.mssv})!`
      );
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdatingId(null);
    }
  };

  // Delete single history item
  const handleDelete = async (id: string, mssv: string) => {
    if (!confirm(`Xóa mục lịch sử của sinh viên ${mssv}?`)) return;
    try {
      await deleteHistoryItem(id);
    } catch (e) {
      console.error(e);
    }
  };

  // Clear all history
  const handleClearAll = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa TOÀN BỘ lịch sử tra cứu trên máy chủ? Thao tác này không thể hoàn tác.')) return;
    setIsClearing(true);
    try {
      await clearAllSearchHistory();
      setFeedbackMsg('Đã làm trống toàn bộ lịch sử tra cứu.');
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsClearing(false);
    }
  };

  // Export history list to Excel (.xlsx)
  const handleExportExcel = () => {
    if (historyItems.length === 0) return;

    const exportRows = historyItems.map((item) => ({
      STT_CapPhat: item.stt,
      MSSV: item.mssv,
      HoVaTen: item.hoVaTen,
      NgaySinh: item.ngaySinh || '',
      NoiSinh: item.noiSinh || '',
      GioiTinh: item.gioiTinh || '',
      DanToc: item.danToc || '',
      Khoa: item.khoaHoc || '',
      NganhDaoTao: item.nganhDaoTao || '',
      XepLoai: item.xepLoai || '',
      SoHieuChungChi: item.soHieuChungChi,
      SoVaoSoGoc: item.soVaoSoGoc,
      NgayCap_DotHoc: item.ngayCap,
      TenChungChi: item.tenChungChi || 'Chứng chỉ Giáo dục Quốc phòng và An ninh',
      DonViCap: item.donViCap || 'Trung tâm GDQP&AN - Đại học Cần Thơ',
      ThoiGianTraCuu: item.timeFormatted,
      TrangThaiPhat: item.daPhat ? `ĐÃ PHÁT (${item.ngayPhat || ''})` : 'CHƯA PHÁT',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'LichSuCapPhat');
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Lich_Su_Cap_Phat_GDQP_${today}.xlsx`);
  };

  // Filtered items
  const filteredItems = historyItems.filter((item) => {
    const cleanFilter = filterText.trim().toLowerCase();
    const matchText = 
      !cleanFilter || 
      item.mssv.toLowerCase().includes(cleanFilter) || 
      item.hoVaTen.toLowerCase().includes(cleanFilter) ||
      String(item.stt).includes(cleanFilter) ||
      item.soHieuChungChi.toLowerCase().includes(cleanFilter);

    if (!matchText) return false;

    if (statusFilter === 'pending') return !item.daPhat && item.status === 'found';
    if (statusFilter === 'issued') return item.daPhat;
    return true;
  });

  const totalLookups = historyItems.length;
  const issuedCount = historyItems.filter((i) => i.daPhat).length;
  const pendingCount = historyItems.filter((i) => !i.daPhat && i.status === 'found').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold text-amber-400 bg-amber-400/15 px-2 py-0.5 rounded uppercase tracking-wider border border-amber-400/20">
                  CÁN BỘ PHÁT BẰNG
                </span>
                <span className="flex items-center space-x-1 text-[11px] text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Trực tiếp thời gian thực</span>
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Lịch Sử Sinh Viên Tra Cứu Chứng Chỉ GDQP&amp;AN
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Counter Summary Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500">Tổng lượt tra cứu:</span>
              <strong className="font-mono text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 font-bold">
                {totalLookups}
              </strong>
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="text-emerald-700">Đã phát bằng:</span>
              <strong className="font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                {issuedCount}
              </strong>
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="text-amber-700">Chờ nhận:</span>
              <strong className="font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold">
                {pendingCount}
              </strong>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportExcel}
              disabled={historyItems.length === 0}
              className="flex items-center space-x-1.5 bg-white hover:bg-slate-100 text-emerald-700 font-semibold px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm transition-all cursor-pointer disabled:opacity-40"
              title="Xuất danh sách sinh viên tra cứu ra file Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Xuất Excel (.xlsx)</span>
            </button>

            <button
              onClick={handleClearAll}
              disabled={isClearing || historyItems.length === 0}
              className="flex items-center space-x-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200 transition-all text-[11px] font-semibold cursor-pointer disabled:opacity-40"
              title="Làm trống toàn bộ lịch sử tra cứu"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa tất cả</span>
            </button>
          </div>
        </div>

        {/* Feedback message banner */}
        {feedbackMsg && (
          <div className="mx-6 mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Filter and Search Input Bar */}
        <div className="px-6 py-3 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Lọc nhanh theo MSSV, Họ tên, STT, Số hiệu..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center space-x-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả ({historyItems.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              Chờ phát ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('issued')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === 'issued'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Đã phát ({issuedCount})
            </button>
          </div>
        </div>

        {/* History Table Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {filteredItems.length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-2">
              <Clock className="w-12 h-12 text-slate-300 mx-auto" />
              <div className="font-semibold text-slate-700 text-sm">
                {filterText ? 'Không tìm thấy kết quả phù hợp với bộ lọc' : 'Chưa có lượt tra cứu nào'}
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Khi sinh viên gõ MSSV và tra cứu trên điện thoại tại bàn phát bằng, thông tin sẽ tự động hiển thị ở đây ngay lập tức theo thời gian thực.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold">
                    <th className="p-3 border-b border-slate-800 w-24">STT RÚT BẰNG</th>
                    <th className="p-3 border-b border-slate-800">SINH VIÊN &amp; NƠI SINH</th>
                    <th className="p-3 border-b border-slate-800">KHÓA, NGÀNH &amp; XẾP LOẠI</th>
                    <th className="p-3 border-b border-slate-800">SỐ HIỆU / SỐ SỔ GỐC</th>
                    <th className="p-3 border-b border-slate-800">THỜI GIAN TRA CỨU</th>
                    <th className="p-3 border-b border-slate-800 text-center">TRẠNG THÁI PHÁT BẰNG</th>
                    <th className="p-3 border-b border-slate-800 text-right w-12">XÓA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        item.daPhat
                          ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
                          : item.status === 'not_found'
                          ? 'bg-rose-50/30 hover:bg-rose-50/50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* STT RÚT BẰNG - EXTRA PROMINENT */}
                      <td className="p-3 align-middle">
                        {item.status === 'found' ? (
                          <div className="bg-amber-400 text-slate-950 font-mono font-black text-lg px-2.5 py-1 rounded-xl shadow-sm text-center border border-amber-500">
                            {item.stt}
                          </div>
                        ) : (
                          <div className="text-slate-400 text-center font-mono">-</div>
                        )}
                      </td>

                      {/* SINH VIÊN */}
                      <td className="p-3 align-middle">
                        <div className="font-bold text-slate-900 text-sm">
                          {item.hoVaTen}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px] border border-emerald-200">
                            {item.mssv}
                          </span>
                          {item.gioiTinh && (
                            <span className="text-[11px] text-slate-500">
                              • {item.gioiTinh}
                            </span>
                          )}
                          {item.danToc && (
                            <span className="text-[11px] text-slate-500">
                              • DT: {item.danToc}
                            </span>
                          )}
                          {item.ngaySinh && (
                            <span className="text-[11px] text-slate-500">
                              • NS: {item.ngaySinh}
                            </span>
                          )}
                          {item.noiSinh && (
                            <span className="text-[11px] text-slate-500">
                              • {item.noiSinh}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* KHÓA, NGÀNH & XẾP LOẠI */}
                      <td className="p-3 align-middle">
                        <div className="font-semibold text-slate-800 text-xs">
                          {item.nganhDaoTao || 'Đại học Cần Thơ'}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                          {item.khoaHoc && <span>{item.khoaHoc}</span>}
                          {item.xepLoai && (
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200">
                              {item.xepLoai}
                            </span>
                          )}
                          {item.ngayCap && (
                            <span className="font-mono text-slate-600">
                              • {item.ngayCap}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* SỐ HIỆU & SỐ SỔ GỐC */}
                      <td className="p-3 align-middle font-mono text-[11px]">
                        <div className="text-slate-800">
                          VB: <strong>{item.soHieuChungChi}</strong>
                        </div>
                        <div className="text-slate-500">
                          Sổ: {item.soVaoSoGoc}
                        </div>
                      </td>

                      {/* THỜI GIAN TRA CỨU */}
                      <td className="p-3 align-middle text-slate-500 text-[11px] whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{item.timeFormatted}</span>
                        </div>
                      </td>

                      {/* TRẠNG THÁI & NÚT ĐÁNH DẤU */}
                      <td className="p-3 align-middle text-center">
                        {item.status === 'found' ? (
                          <button
                            onClick={() => handleToggleDaPhat(item)}
                            disabled={isUpdatingId === item.id}
                            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                              item.daPhat
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-slate-100 text-slate-700 hover:bg-amber-100 hover:text-amber-900 border border-slate-300'
                            }`}
                            title="Bấm để chuyển đổi trạng thái đã phát hay chưa"
                          >
                            {item.daPhat ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-white" />
                                <span>Đã Phát Bằng</span>
                              </>
                            ) : (
                              <>
                                <CircleDashed className="w-4 h-4 text-slate-500" />
                                <span>Chờ Phát Bằng</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-[11px] text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            Không tìm thấy MSSV
                          </span>
                        )}
                      </td>

                      {/* NÚT XÓA */}
                      <td className="p-3 align-middle text-right">
                        <button
                          onClick={() => handleDelete(item.id, item.mssv)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa dòng này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div>
            * Cán bộ phát bằng có thể nhấn nút <strong className="text-slate-700">"Chờ Phát Bằng"</strong> để đổi thành <strong className="text-emerald-700">"Đã Phát Bằng"</strong> giúp kiểm soát sinh viên đã nhận.
          </div>
          <button
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-5 py-2 rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
