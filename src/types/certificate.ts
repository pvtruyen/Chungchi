export interface CertificateRecord {
  id: string;
  stt: number | string;
  soHieuChungChi: string;      // Số văn bằng (VD: C123456 / QPAN-2025-0812)
  soVaoSoGoc: string;          // Số vào sổ gốc / Số quản lý (VD: 142/2025/GDQP)
  tenChungChi: string;         // Tên chứng chỉ (Mặc định: Chứng chỉ Giáo dục Quốc phòng và An ninh)
  hoVaTen: string;             // Họ chữ đệm và tên
  mssv: string;                // Mã người học (MSSV)
  ngaySinh: string;            // Ngày tháng năm sinh (dd/mm/yyyy)
  gioiTinh: string;            // Nam / Nữ
  ngayCap: string;             // Ngày cấp (dd/mm/yyyy)
  donViCap?: string;           // Trung tâm GDQP&AN / Đại học
  khoaHoc?: string;            // K48, Khóa 2023-2027, etc.
  fileName?: string;           // Tên file Excel nguồn
  xepLoai?: string;            // Giỏi / Khá / Trung bình (nếu có)
}

export interface SearchState {
  query: string;
  isSearching: boolean;
  result: CertificateRecord | null;
  hasSearched: boolean;
  notFoundMssv: string | null;
  error: string | null;
}

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
}

export type DataSourceType = 'drive_oauth' | 'apps_script' | 'local_excel' | 'demo_data';

export interface SyncStatus {
  source: DataSourceType;
  totalRecords: number;
  lastUpdated: string;
  fileCount: number;
  fileNames: string[];
  appsScriptUrl?: string;
  driveFolderFound?: boolean;
}
