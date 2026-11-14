export interface CertificateRecord {
  id: string;
  stt: number | string;
  soHieuChungChi: string;      // Số Hiệu (Số văn bằng - VD: C123456 / QPAN-2025-0812)
  soVaoSoGoc: string;          // Số vào sổ / Số vào sổ gốc (VD: 142/2025/GDQP)
  tenChungChi: string;         // Tên chứng chỉ (Mặc định: Chứng chỉ Giáo dục Quốc phòng và An ninh)
  hoVaTen: string;             // Họ và tên người học
  mssv: string;                // Mã người học (MSSV)
  ngaySinh: string;            // Ngày Sinh (dd/mm/yyyy)
  noiSinh?: string;            // Nơi sinh (VD: Cần Thơ, Hậu Giang, An Giang...)
  gioiTinh: string;            // Giới tính (Nam / Nữ)
  danToc?: string;             // Dân tộc (Kinh, Khmer, Hoa...)
  khoaHoc?: string;            // Khóa / Khóa học (K47, K48, Khóa 2022-2026...)
  nganhDaoTao?: string;        // Ngành / Ngành đào tạo (CNTT, Kế toán, Luật...)
  xepLoai?: string;            // Xếp loại (Giỏi, Khá, Trung bình, Đạt...)
  ngayCap: string;             // Ngày cấp (dd/mm/yyyy - có thể không có hoặc lấy theo đợt)
  donViCap?: string;           // Trung tâm GDQP&AN / Đại học Cần Thơ
  fileName?: string;           // Tên file Excel nguồn
}

export interface SearchState {
  query: string;
  isSearching: boolean;
  result: CertificateRecord | null;
  hasSearched: boolean;
  notFoundMssv: string | null;
  error: string | null;
}

export type DataSourceType = 'local_excel' | 'demo_data';

export interface SyncStatus {
  source: DataSourceType;
  totalRecords: number;
  lastUpdated: string;
  fileCount: number;
  fileNames: string[];
}

export interface SearchHistoryItem {
  id: string;
  mssv: string;
  hoVaTen: string;
  stt: number | string;
  ngayCap: string;
  soHieuChungChi: string;
  soVaoSoGoc: string;
  tenChungChi?: string;
  donViCap?: string;
  khoaHoc?: string;
  nganhDaoTao?: string;
  ngaySinh?: string;
  noiSinh?: string;
  gioiTinh?: string;
  danToc?: string;
  xepLoai?: string;
  fileName?: string;
  timestamp: string;
  timeFormatted: string;
  daPhat: boolean;
  ngayPhat?: string;
  status: 'found' | 'not_found';
}
