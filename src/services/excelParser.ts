import * as XLSX from 'xlsx';
import { CertificateRecord } from '../types/certificate';

/**
 * Format Excel date (serial number, Date object, or text) to dd/mm/yyyy
 */
export function formatExcelDate(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '';

  if (typeof raw === 'number') {
    // Excel serial date to JavaScript Date
    const dateObj = XLSX.SSF.parse_date_code(raw);
    if (dateObj) {
      const day = String(dateObj.d).padStart(2, '0');
      const month = String(dateObj.m).padStart(2, '0');
      const year = dateObj.y;
      return `${day}/${month}/${year}`;
    }
  }

  if (raw instanceof Date) {
    const day = String(raw.getDate()).padStart(2, '0');
    const month = String(raw.getMonth() + 1).padStart(2, '0');
    const year = raw.getFullYear();
    return `${day}/${month}/${year}`;
  }

  const str = String(raw).trim();
  // Check if string is already dd/mm/yyyy or yyyy-mm-dd
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(str)) {
    const parts = str.split(/[\/\-\.]/);
    return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
  }

  return str;
}

/**
 * Parse an Excel file (ArrayBuffer / Uint8Array) into normalized Certificate records.
 * Automatically skips header/instruction lines (starts actual data from row 4 or header inspection).
 */
export function parseExcelFile(
  data: ArrayBuffer | Uint8Array,
  fileName: string = 'GDQP_Data.xlsx'
): CertificateRecord[] {
  const workbook = XLSX.read(data, {
    type: 'array',
    cellDates: true,
  });

  const records: CertificateRecord[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Convert sheet to 2D array of rows
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    if (rows.length === 0) continue;

    // Detect header row: search in first 10 rows for columns containing "Mã người học", "MSSV", "STT", "Số hiệu", etc.
    let headerRowIdx = -1;
    let colMap: Record<string, number> = {};

    for (let r = 0; r < Math.min(10, rows.length); r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;

      const map: Record<string, number> = {};
      let matchedCols = 0;

      row.forEach((cell, colIdx) => {
        const text = String(cell || '').trim().toLowerCase();
        if (/^(stt|số\s*thứ\s*tự|no\.?|tt)$/i.test(text)) {
          map.stt = colIdx;
          matchedCols++;
        } else if (
          /(mã\s*(người\s*học|sinh\s*viên|sv|học\s*viên)|mssv)/i.test(text)
        ) {
          map.mssv = colIdx;
          matchedCols++;
        } else if (
          /(họ\s*(chữ\s*đệm\s*)?và\s*tên|họ\s*tên|tên\s*người\s*học)/i.test(text)
        ) {
          map.hoVaTen = colIdx;
          matchedCols++;
        } else if (
          /(số\s*hiệu(\s*chứng\s*chỉ|\s*văn\s*bằng)?|số\s*văn\s*bằng)/i.test(text)
        ) {
          map.soHieu = colIdx;
          matchedCols++;
        } else if (
          /(số\s*vào\s*sổ(\s*gốc)?(\s*cấp\s*chứng\s*chỉ)?|số\s*quản\s*lý)/i.test(text)
        ) {
          map.soVaoSo = colIdx;
          matchedCols++;
        } else if (
          /(ngày(\s*tháng\s*năm)?\s*sinh|năm\s*sinh|ns)/i.test(text)
        ) {
          map.ngaySinh = colIdx;
          matchedCols++;
        } else if (/(ngày\s*cấp|ngày\s*ký|ngày\s*ban\s*hành)/i.test(text)) {
          map.ngayCap = colIdx;
          matchedCols++;
        } else if (/(giới\s*tính|phái)/i.test(text)) {
          map.gioiTinh = colIdx;
          matchedCols++;
        } else if (/(tên\s*chứng\s*chỉ|loại\s*chứng\s*chỉ|tên\s*văn\s*bằng)/i.test(text)) {
          map.tenChungChi = colIdx;
          matchedCols++;
        } else if (/(đơn\s*vị\s*cấp|trường|cơ\s*sở\s*đào\s*tạo)/i.test(text)) {
          map.donViCap = colIdx;
          matchedCols++;
        } else if (/(khóa(\s*học)?|k\d+)/i.test(text)) {
          map.khoaHoc = colIdx;
          matchedCols++;
        } else if (/(xếp\s*loại|kết\s*quả)/i.test(text)) {
          map.xepLoai = colIdx;
          matchedCols++;
        }
      });

      // If this row contains at least MSSV or (Họ tên and STT), consider it the header row
      if (map.mssv !== undefined || (map.hoVaTen !== undefined && map.stt !== undefined)) {
        headerRowIdx = r;
        colMap = map;
        break;
      }
    }

    // Default fallback: If standard standard format row 4 is data (Row 1-3 are title/headings)
    const dataStartRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 3; // Index 3 is row 4

    // If no header found, apply standard GDQP template column positions:
    // Col 0: STT, Col 1: Họ và tên (hoặc Họ đệm/Tên), Col 2: MSSV, Col 3: Ngày sinh, Col 4: Giới tính, Col 5: Số hiệu, Col 6: Số vào sổ, Col 7: Ngày cấp
    const getVal = (row: unknown[], key: string, fallbackIdx: number): string => {
      const idx = colMap[key] !== undefined ? colMap[key] : fallbackIdx;
      if (idx !== undefined && row[idx] !== undefined && row[idx] !== null) {
        return String(row[idx]).trim();
      }
      return '';
    };

    const getDateVal = (row: unknown[], key: string, fallbackIdx: number): string => {
      const idx = colMap[key] !== undefined ? colMap[key] : fallbackIdx;
      if (idx !== undefined && row[idx] !== undefined && row[idx] !== null) {
        return formatExcelDate(row[idx]);
      }
      return '';
    };

    for (let r = dataStartRow; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      // Extract MSSV
      let mssv = getVal(row, 'mssv', 5); // Often col 2 or 5 depending on template
      // If empty at detected col, check if any cell looks like a student ID (e.g. B2101234, 2110291, etc.)
      if (!mssv) {
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c] || '').trim();
          if (/^[a-zA-Z]{1,3}\d{6,8}$/i.test(val) || (/^\d{7,10}$/.test(val) && c !== colMap.stt)) {
            mssv = val;
            break;
          }
        }
      }

      if (!mssv) continue; // Skip lines without MSSV

      // Normalize MSSV
      const cleanMssv = mssv.trim().toUpperCase();

      const sttRaw = getVal(row, 'stt', 0);
      const stt = sttRaw ? (isNaN(Number(sttRaw)) ? sttRaw : Number(sttRaw)) : r - dataStartRow + 1;

      const hoVaTen = getVal(row, 'hoVaTen', 1) || 'Sinh viên GDQP';
      const soHieu = getVal(row, 'soHieu', 6) || `QP-${cleanMssv}`;
      const soVaoSo = getVal(row, 'soVaoSo', 7) || `${stt}/GDQP`;
      const ngaySinh = getDateVal(row, 'ngaySinh', 2);
      const gioiTinh = getVal(row, 'gioiTinh', 3) || 'Nam';
      const ngayCap = getDateVal(row, 'ngayCap', 8) || '15/10/2025';
      const tenChungChi = getVal(row, 'tenChungChi', 4) || 'Chứng chỉ Giáo dục Quốc phòng và An ninh';
      const donViCap = getVal(row, 'donViCap', 9) || 'Trung tâm Giáo dục Quốc phòng và An ninh';
      const khoaHoc = getVal(row, 'khoaHoc', 10) || '';
      const xepLoai = getVal(row, 'xepLoai', 11) || '';

      records.push({
        id: `${cleanMssv}_${soHieu}_${r}`,
        stt,
        soHieuChungChi: soHieu,
        soVaoSoGoc: soVaoSo,
        tenChungChi,
        hoVaTen,
        mssv: cleanMssv,
        ngaySinh,
        gioiTinh,
        ngayCap,
        donViCap,
        khoaHoc,
        fileName,
        xepLoai,
      });
    }
  }

  return records;
}
