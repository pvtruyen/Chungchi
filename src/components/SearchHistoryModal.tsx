import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  Search,
  CheckCircle2,
  CircleDashed,
  Trash2,
  FileSpreadsheet,
  Filter,
  AlertCircle,
} from 'lucide-react';
import { SearchHistoryItem } from '../types/certificate';
import {
  subscribeSearchHistory,
  toggleHistoryDaPhat,
  deleteHistoryItem,
  clearAllSearchHistory,
  isQuotaExceededError,
  QUOTA_EXCEEDED_VI_MESSAGE,
  getLocalSearchHistory,
  hasFirestoreWriteQuotaExceeded,
  onFirestoreQuotaStatusChange,
  FIRESTORE_PRICING_URL,
} from '../services/firestoreService';
import { ConfirmModal } from './ConfirmModal';
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(() =>
    hasFirestoreWriteQuotaExceeded()
  );

  // Confirm modal state (replaces window.confirm)
  const [confirmState, setConfirmState] = useState<{
    type: 'single' | 'all';
    id?: string;
    mssv?: string;
  } | null>(null);

  useEffect(() => {
    const unsubQuota = onFirestoreQuotaStatusChange((exhausted) => {
      setIsQuotaExceeded(exhausted);
    });
    return () => unsubQuota();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setIsQuotaExceeded(hasFirestoreWriteQuotaExceeded());

    const localItems = getLocalSearchHistory();
    setHistoryItems(localItems);

    const unsubscribe = subscribeSearchHistory(
      (cloudItems) => {
        const currentLocal = getLocalSearchHistory();
        const mergedMap = new Map<string, SearchHistoryItem>();
        for (const item of currentLocal) mergedMap.set(item.id, item);
        for (const item of cloudItems) mergedMap.set(item.id, item);
        const merged = Array.from(mergedMap.values()).sort((a, b) =>
          (b.timestamp || '').localeCompare(a.timestamp || '')
        );
        setHistoryItems(merged);
      },
      150,
      () => {
        setHistoryItems(getLocalSearchHistory());
        setErrorMsg(
          'Không thể tải lịch sử từ Cloud Firestore (đang hiển thị lịch sử tra cứu cục bộ trên máy này). Vui lòng kiểm tra Firestore Rules đã được Deploy mới nhất.'
        );
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleDaPhat = async (item: SearchHistoryItem) => {
    setIsUpdatingId(item.id);
    setErrorMsg(null);
    const nextStatus = !item.daPhat;
    const now =
      new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
      ' ' +
      new Date().toLocaleDateString('vi-VN');

    // Optimistic UI update
    setHistoryItems((prev) =>
      prev.map((x) =>
        x.id === item.id ? { ...x, daPhat: nextStatus, ngayPhat: nextStatus ? now : undefined } : x
      )
    );

    try {
      await toggleHistoryDaPhat(item.id, item.daPhat);
      setFeedbackMsg(
        item.daPhat
          ? `Đã hủy đánh dấu đã phát cho MSSV ${item.mssv}`
          : `Đã xác nhận phát chứng chỉ cho sinh viên ${item.hoVaTen} (${item.mssv})!`
      );
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err: unknown) {
      // Revert optimistic update on failure
      setHistoryItems((prev) =>
        prev.map((x) =>
          x.id === item.id ? { ...x, daPhat: item.daPhat, ngayPhat: item.ngayPhat } : x
        )
      );
      if (isQuotaExceededError(err)) {
        setErrorMsg(QUOTA_EXCEEDED_VI_MESSAGE);
      } else {
        const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
        setErrorMsg(`Không thể cập nhật trạng thái phát bằng lên Cloud: ${msg}`);
      }
    } finally {
      setIsUpdatingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmState) return;
    setIsClearing(true);
    setErrorMsg(null);
    try {
      if (confirmState.type === 'single' && confirmState.id) {
        await deleteHistoryItem(confirmState.id);
        setHistoryItems((prev) => prev.filter((x) => x.id !== confirmState.id));
        setFeedbackMsg(`Đã xóa mục lịch sử của MSSV ${confirmState.mssv}.`);
      } else if (confirmState.type === 'all') {
        await clearAllSearchHistory();
        setHistoryItems([]);
        setFeedbackMsg('Đã làm trống toàn bộ lịch sử tra cứu.');
      }
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err: unknown) {
      if (isQuotaExceededError(err)) {
        setErrorMsg(QUOTA_EXCEEDED_VI_MESSAGE);
      } else {
        setHistoryItems(getLocalSearchHistory());
        setErrorMsg(
          'Xóa nhật ký trên Cloud Firestore cần tài khoản Firebase Admin (lịch sử cục bộ trên máy này đã được cập nhật).'
        );
      }
    } finally {
      setIsClearing(false);
      setConfirmState(null);
    }
  };

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
      SoHieuVanBang: item.soHieuChungChi,
      SoLuuVaoSoGoc: item.soVaoSoGoc,
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

  const filteredItems = historyItems.filter((item) => {
    const cleanFilter = filterText.trim().toLowerCase();
    const matchText =
      !cleanFilter ||
      item.mssv.toLowerCase().includes(cleanFilter) ||
      item.hoVaTen.toLowerCase().includes(cleanFilter) ||
      String(item.stt).includes(cleanFilter) ||
      item.soHieuChungChi.toLowerCase().includes(cleanFilter) ||
      item.soVaoSoGoc.toLowerCase().includes(cleanFilter);

    if (!matchText) return false;

    if (statusFilter === 'pending') return !item.daPhat && item.status === 'found';
    if (statusFilter === 'issued') return item.daPhat;
    return true;
  });

  const totalLookups = historyItems.length;
  const issuedCount = historyItems.filter((i) => i.daPhat).length;
  const pendingCount = historyItems.filter((i) => !i.daPhat && i.status === 'found').length;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-blue-400/20 bg-[#002855] text-white">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-sky-400/20 text-sky-300 flex items-center justify-center border border-sky-400/30">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-400/15 px-2 py-0.5 rounded uppercase tracking-wider border border-amber-300/25">
                    CÁN BỘ PHÁT BẰNG — ĐẠI HỌC CẦN THƠ
                  </span>
                  <span className="flex items-center space-x-1 text-[11px] text-sky-300 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Trực tiếp thời gian thực (PIN Quản trị)</span>
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Lịch Sử Sinh Viên Tra Cứu Chứng Chỉ GDQP&amp;AN
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
                <span className="text-[#004B8D]">Đã phát bằng:</span>
                <strong className="font-mono text-[#003B73] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-bold">
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

            <div className="flex items-center space-x-2">
              <button
                onClick={handleExportExcel}
                disabled={historyItems.length === 0}
                className="flex items-center space-x-1.5 bg-white hover:bg-slate-100 text-[#004B8D] font-semibold px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs transition-all cursor-pointer disabled:opacity-40"
                title="Xuất danh sách sinh viên tra cứu ra file Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Xuất Excel (.xlsx)</span>
              </button>

              <button
                onClick={() => setConfirmState({ type: 'all' })}
                disabled={isClearing || historyItems.length === 0}
                className="flex items-center space-x-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200 transition-all text-[11px] font-semibold cursor-pointer disabled:opacity-40"
                title="Làm trống toàn bộ lịch sử tra cứu"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa tất cả</span>
              </button>
            </div>
          </div>

          {isQuotaExceeded && (
            <div className="mx-6 mt-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div>
                  <strong>Cảnh báo hạn mức ghi Firestore (Quota exceeded):</strong> Dự án Firestore mặc định đã hết lượt ghi miễn phí trong ngày và sẽ tự động đặt lại vào ngày mai. Lượt tra cứu mới vẫn được lưu cục bộ trên trình duyệt này.
                </div>
                <a
                  href={FIRESTORE_PRICING_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block font-semibold text-[#004B8D] underline hover:text-[#002855]"
                >
                  Xem thông tin hạn mức Spark plan (Enterprise edition) →
                </a>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="mx-6 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {feedbackMsg && (
            <div className="mx-6 mt-3 p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-[#003B73] text-xs flex items-center space-x-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-[#00529C] shrink-0" />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {/* Filter & Search Bar */}
          <div className="px-6 py-3 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Lọc nhanh theo MSSV, Họ tên, Số hiệu, Số lưu sổ gốc..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00529C]"
              />
            </div>

            <div className="flex items-center space-x-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-[#002855] text-white font-bold'
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
                    ? 'bg-[#004B8D] text-white font-bold'
                    : 'bg-blue-50 text-[#004B8D] hover:bg-blue-100'
                }`}
              >
                Đã phát ({issuedCount})
              </button>
            </div>
          </div>

          {/* History Table */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {filteredItems.length === 0 ? (
              <div className="text-center py-16 text-slate-400 space-y-2">
                <Clock className="w-12 h-12 text-slate-300 mx-auto" />
                <div className="font-semibold text-slate-700 text-sm">
                  {filterText ? 'Không tìm thấy kết quả phù hợp với bộ lọc' : 'Chưa có lượt tra cứu nào'}
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Khi sinh viên tra cứu MSSV tại bàn phát bằng, thông tin chi tiết sẽ tự động hiển thị tại đây theo thời gian thực.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#002855] text-white font-bold">
                      <th className="p-3 border-b border-blue-900 w-20">STT</th>
                      <th className="p-3 border-b border-blue-900">SINH VIÊN &amp; NƠI SINH</th>
                      <th className="p-3 border-b border-blue-900">KHÓA, NGÀNH &amp; XẾP LOẠI</th>
                      <th className="p-3 border-b border-blue-900">SỐ LƯU SỔ GỐC / SỐ HIỆU</th>
                      <th className="p-3 border-b border-blue-900">THỜI GIAN</th>
                      <th className="p-3 border-b border-blue-900 text-center">TRẠNG THÁI</th>
                      <th className="p-3 border-b border-blue-900 text-right w-12">XÓA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredItems.map((item) => (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          item.daPhat
                            ? 'bg-blue-50/40 hover:bg-blue-50/70'
                            : item.status === 'not_found'
                            ? 'bg-rose-50/30 hover:bg-rose-50/50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="p-3 align-middle">
                          {item.status === 'found' ? (
                            <div className="bg-amber-400 text-[#001F3F] font-mono font-black text-base px-2.5 py-1 rounded-xl shadow-2xs text-center border border-amber-500">
                              {item.stt}
                            </div>
                          ) : (
                            <div className="text-slate-400 text-center font-mono">-</div>
                          )}
                        </td>

                        <td className="p-3 align-middle">
                          <div className="font-bold text-slate-900 text-sm">{item.hoVaTen}</div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="font-mono font-bold text-[#003B73] bg-blue-50 px-1.5 py-0.5 rounded text-[11px] border border-blue-200">
                              {item.mssv}
                            </span>
                            {item.gioiTinh && (
                              <span className="text-[11px] text-slate-500">• {item.gioiTinh}</span>
                            )}
                            {item.danToc && (
                              <span className="text-[11px] text-slate-500">• DT: {item.danToc}</span>
                            )}
                            {item.ngaySinh && (
                              <span className="text-[11px] text-slate-500">• NS: {item.ngaySinh}</span>
                            )}
                            {item.noiSinh && (
                              <span className="text-[11px] text-slate-500">• {item.noiSinh}</span>
                            )}
                          </div>
                        </td>

                        <td className="p-3 align-middle">
                          <div className="font-semibold text-slate-800 text-xs">
                            {item.nganhDaoTao || 'Đại học Cần Thơ'}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                            {item.khoaHoc && <span>{item.khoaHoc}</span>}
                            {item.xepLoai && (
                              <span className="font-semibold text-[#004B8D] bg-blue-50 px-1 rounded border border-blue-200">
                                {item.xepLoai}
                              </span>
                            )}
                            {item.ngayCap && (
                              <span className="font-mono text-slate-600">• {item.ngayCap}</span>
                            )}
                          </div>
                        </td>

                        <td className="p-3 align-middle font-mono text-[11px]">
                          <div className="text-amber-800 font-bold">
                            Sổ gốc: {item.soVaoSoGoc}
                          </div>
                          <div className="text-[#004B8D] font-semibold">
                            Số hiệu: {item.soHieuChungChi}
                          </div>
                        </td>

                        <td className="p-3 align-middle text-slate-500 text-[11px] whitespace-nowrap">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{item.timeFormatted}</span>
                          </div>
                        </td>

                        <td className="p-3 align-middle text-center">
                          {item.status === 'found' ? (
                            <button
                              onClick={() => handleToggleDaPhat(item)}
                              disabled={isUpdatingId === item.id}
                              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                                item.daPhat
                                  ? 'bg-[#004B8D] text-white hover:bg-[#003B73]'
                                  : 'bg-slate-100 text-slate-700 hover:bg-amber-100 hover:text-amber-900 border border-slate-300'
                              }`}
                            >
                              {item.daPhat ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 text-sky-300" />
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
                              Không tìm thấy
                            </span>
                          )}
                        </td>

                        <td className="p-3 align-middle text-right">
                          <button
                            onClick={() =>
                              setConfirmState({ type: 'single', id: item.id, mssv: item.mssv })
                            }
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
              * Cán bộ phát bằng nhấn <strong className="text-slate-700">"Chờ Phát Bằng"</strong> để chuyển sang{' '}
              <strong className="text-[#004B8D]">"Đã Phát Bằng"</strong> (không cần tài khoản Firebase Admin).
            </div>
            <button
              onClick={onClose}
              className="bg-[#002855] hover:bg-[#003B73] text-white font-semibold px-5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmState !== null}
        title={confirmState?.type === 'all' ? 'Xác nhận xóa toàn bộ lịch sử' : 'Xác nhận xóa dòng lịch sử'}
        message={
          confirmState?.type === 'all'
            ? 'Bạn có chắc chắn muốn xóa TOÀN BỘ lịch sử tra cứu trên máy chủ Cloud Firestore? Thao tác này không thể hoàn tác.'
            : `Bạn có chắc chắn muốn xóa mục lịch sử tra cứu của sinh viên ${confirmState?.mssv || ''}?`
        }
        confirmLabel="Xác nhận xóa"
        isProcessing={isClearing}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmState(null)}
      />
    </>
  );
};
