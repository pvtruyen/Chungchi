import * as XLSX from 'xlsx';
import { CertificateRecord } from '../types/certificate';

/**
 * Remove Vietnamese accents and punctuation for robust header/field matching
 */
export function normalizeHeader(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove all accent diacritics (including đ/đệm/đêm -> d/dem)
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Format Excel date (serial number, Date object, or text) to dd/mm/yyyy
 */
export function formatExcelDate(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '';

  if (typeof raw === 'number') {
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
 * Checks if a string looks like a student's first name (e.g. "An", "Bình", "Thảo", "Huy")
 */
function isLikelyFirstName(val: string): boolean {
  if (!val) return false;
  const s = val.trim();
  if (s.length < 1 || s.length > 25) return false;
  if (/\d/.test(s)) return false; // no digits

  const lower = s.toLowerCase();
  const nonNames = ['nam', 'nu', 'nữ', 'dat', 'đạt', 'gioi', 'giỏi', 'kha', 'khá', 'tb', 'khong', 'không'];
  if (nonNames.includes(lower)) return false;

  // Must contain alphabetic characters
  return /[a-zA-ZàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ]/i.test(s);
}

/**
 * Intelligently find a student's name in a row if header mapping missed it
 */
function findStudentNameInRow(
  row: unknown[],
  cleanMssv: string,
  colMap: Record<string, number>
): string {
  const ignoredCols = new Set<number>();
  if (colMap.mssv !== undefined) ignoredCols.add(colMap.mssv);
  if (colMap.stt !== undefined) ignoredCols.add(colMap.stt);
  if (colMap.ngaySinh !== undefined) ignoredCols.add(colMap.ngaySinh);
  if (colMap.ngayCap !== undefined) ignoredCols.add(colMap.ngayCap);
  if (colMap.soHieu !== undefined) ignoredCols.add(colMap.soHieu);
  if (colMap.soVaoSo !== undefined) ignoredCols.add(colMap.soVaoSo);
  if (colMap.gioiTinh !== undefined) ignoredCols.add(colMap.gioiTinh);

  // First pass: look for two adjacent columns that form "Họ và chữ đệm" + "Tên"
  for (let c = 0; c < row.length - 1; c++) {
    if (ignoredCols.has(c) || ignoredCols.has(c + 1)) continue;
    const val1 = String(row[c] || '').trim();
    const val2 = String(row[c + 1] || '').trim();

    if (
      val1.length >= 2 &&
      val2.length >= 1 &&
      !/\d/.test(val1) &&
      !/\d/.test(val2) &&
      isLikelyFirstName(val2) &&
      val1.toUpperCase() !== cleanMssv &&
      val2.toUpperCase() !== cleanMssv
    ) {
      return `${val1} ${val2}`.trim();
    }
  }

  // Second pass: look for a single column with full name (at least 2 words)
  for (let c = 0; c < row.length; c++) {
    if (ignoredCols.has(c)) continue;
    const val = String(row[c] || '').trim();
    if (!val || /\d/.test(val)) continue;
    if (val.toUpperCase() === cleanMssv) continue;

    const words = val.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && isLikelyFirstName(words[words.length - 1])) {
      return val;
    }
  }

  return '';
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

    // Detect header across first 12 rows (supporting merged / multi-row headers)
    const colMap: Record<string, number> = {};
    let detectedHeaderRow = -1;

    for (let r = 0; r < Math.min(12, rows.length); r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;

      let rowMatches = 0;

      row.forEach((cell, colIdx) => {
        const norm = normalizeHeader(cell);
        if (!norm) return;

        // 1. STT
        if (norm === 'stt' || norm === 'so thu tu' || norm === 'tt' || norm === 'no' || norm.startsWith('stt')) {
          if (colMap.stt === undefined) { colMap.stt = colIdx; rowMatches++; }
        }
        // 2. MSSV (Mã người học / Mã sinh viên)
        else if (
          norm === 'mssv' ||
          norm === 'ma so sinh vien' ||
          norm === 'ma sinh vien' ||
          norm === 'ma nguoi hoc' ||
          norm === 'ma hoc vien' ||
          norm === 'ma sv' ||
          norm.includes('mssv') ||
          (norm.includes('ma') && (norm.includes('sinh vien') || norm.includes('nguoi hoc') || norm.includes('hoc vien') || norm.includes('sv')))
        ) {
          if (colMap.mssv === undefined) { colMap.mssv = colIdx; rowMatches++; }
        }
        // 3. Họ và tên đầy đủ trong 1 cột (e.g. "Họ, chữ đệm và tên", "Họ, chữ đêm va tên", "Họ và tên", "Họ tên")
        else if (
          norm === 'ho chu dem va ten' ||
          norm === 'ho chu dem ten' ||
          norm === 'ho va ten' ||
          norm === 'ho ten' ||
          norm === 'ho va ten nguoi hoc' ||
          norm === 'ho ten nguoi hoc' ||
          norm === 'ho ten sinh vien' ||
          norm === 'ho va ten sinh vien' ||
          norm === 'ten nguoi hoc' ||
          norm === 'ho va chu dem va ten' ||
          (norm.includes('ho') && norm.includes('ten')) ||
          (norm.includes('chu dem') && norm.includes('ten')) ||
          (norm.includes('ho') && norm.includes('dem') && norm.includes('ten'))
        ) {
          if (colMap.hoVaTen === undefined) { colMap.hoVaTen = colIdx; rowMatches++; }
        }
        // 4. Họ và chữ đệm (tách 2 cột)
        else if (
          norm === 'ho chu dem' ||
          norm === 'ho va chu dem' ||
          norm === 'ho dem' ||
          norm === 'ho lot' ||
          norm === 'ho' ||
          norm.startsWith('ho chu dem') ||
          norm.startsWith('ho va chu dem') ||
          norm.startsWith('ho dem') ||
          (norm.includes('chu dem') && !norm.includes('ten')) ||
          (norm.includes('ho') && !norm.includes('ten') && !norm.includes('ngay sinh') && !norm.includes('so'))
        ) {
          if (colMap.hoDem === undefined) { colMap.hoDem = colIdx; rowMatches++; }
        }
        // 5. Tên sinh viên (tách 2 cột)
        else if (
          norm === 'ten' ||
          norm === 'ten sinh vien' ||
          norm === 'ten nguoi hoc' ||
          norm === 'ten hoc vien' ||
          norm === 'ten sv'
        ) {
          if (colMap.ten === undefined) { colMap.ten = colIdx; rowMatches++; }
        }
        // 6. Số hiệu chứng chỉ / Số văn bằng
        else if (norm.includes('so hieu') || norm.includes('so van bang') || norm.includes('so vb')) {
          if (colMap.soHieu === undefined) { colMap.soHieu = colIdx; rowMatches++; }
        }
        // 7. Số vào sổ gốc / Số quản lý
        else if (norm.includes('so vao so') || norm.includes('so quan ly') || norm.includes('so goc')) {
          if (colMap.soVaoSo === undefined) { colMap.soVaoSo = colIdx; rowMatches++; }
        }
        // 8. Ngày sinh
        else if (norm.includes('ngay sinh') || norm.includes('nam sinh') || norm === 'ns') {
          if (colMap.ngaySinh === undefined) { colMap.ngaySinh = colIdx; rowMatches++; }
        }
        // 9. Giới tính
        else if (norm.includes('gioi tinh') || norm === 'phai' || norm === 'gt') {
          if (colMap.gioiTinh === undefined) { colMap.gioiTinh = colIdx; rowMatches++; }
        }
        // 10. Ngày cấp chứng chỉ / ngày tháng cấp văn bằng
        else if (
          norm.includes('ngay cap') ||
          norm.includes('ngay thang cap') ||
          norm.includes('ngay ban hanh') ||
          norm.includes('ngay ky') ||
          norm.includes('ngay vb') ||
          norm.includes('ngay cap van bang') ||
          norm.includes('ngay cap chung chi')
        ) {
          if (colMap.ngayCap === undefined) { colMap.ngayCap = colIdx; rowMatches++; }
        }
        // 11. Đợt học / Đợt cấp / Khóa học
        else if (
          norm.includes('dot hoc') ||
          norm.includes('dot cap') ||
          norm.includes('dot thi') ||
          norm.includes('dot') ||
          norm.includes('khoa hoc') ||
          norm.includes('hoc ky')
        ) {
          if (colMap.dotHoc === undefined) { colMap.dotHoc = colIdx; rowMatches++; }
        }
        // 12. Tên chứng chỉ
        else if (norm.includes('ten chung chi') || norm.includes('loai chung chi') || norm.includes('ten van bang')) {
          if (colMap.tenChungChi === undefined) { colMap.tenChungChi = colIdx; rowMatches++; }
        }
        // 13. Đơn vị cấp
        else if (norm.includes('don vi cap') || norm.includes('co so dao tao') || norm.includes('truong')) {
          if (colMap.donViCap === undefined) { colMap.donViCap = colIdx; rowMatches++; }
        }
      });

      if (rowMatches >= 2) {
        detectedHeaderRow = Math.max(detectedHeaderRow, r);
      }
    }

    // Determine actual data start row
    let dataStartRow = detectedHeaderRow !== -1 ? detectedHeaderRow + 1 : 3;

    // Scan forward to ensure dataStartRow skips any sub-header numbers like (1), (2), (3)
    for (let r = dataStartRow; r < Math.min(dataStartRow + 4, rows.length); r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      // If row only has parenthesized numbers or is empty, advance
      const firstCell = String(row[0] || '').trim();
      if (/^\(\d+\)$/.test(firstCell) || /^col/i.test(firstCell)) {
        dataStartRow = r + 1;
      }
    }

    const getVal = (row: unknown[], key: string, fallbackIdx: number): string => {
      const idx = colMap[key] !== undefined ? colMap[key] : fallbackIdx;
      if (idx !== undefined && idx >= 0 && row[idx] !== undefined && row[idx] !== null) {
        return String(row[idx]).trim();
      }
      return '';
    };

    const getDateVal = (row: unknown[], key: string, fallbackIdx: number): string => {
      const idx = colMap[key] !== undefined ? colMap[key] : fallbackIdx;
      if (idx !== undefined && idx >= 0 && row[idx] !== undefined && row[idx] !== null) {
        return formatExcelDate(row[idx]);
      }
      return '';
    };

    for (let r = dataStartRow; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      // 1. Extract MSSV
      let mssv = getVal(row, 'mssv', -1);
      // If not mapped or empty, scan row for student code pattern (e.g. B2101234, 2110291, etc.)
      if (!mssv) {
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c] || '').trim();
          if (/^[a-zA-Z]{1,3}\d{6,8}$/i.test(val) || (/^\d{7,10}$/.test(val) && c !== colMap.stt)) {
            mssv = val;
            if (colMap.mssv === undefined) colMap.mssv = c;
            break;
          }
        }
      }

      if (!mssv) continue; // Skip non-student rows

      const cleanMssv = mssv.trim().toUpperCase();

      // 2. STT
      const sttRaw = getVal(row, 'stt', 0);
      const stt = sttRaw ? (isNaN(Number(sttRaw)) ? sttRaw : Number(sttRaw)) : r - dataStartRow + 1;

      // 3. Resolve Student Full Name (Họ, chữ đệm và tên)
      let hoVaTen = '';

      // Mode A: Split columns: Họ và chữ đệm + Tên
      if (colMap.hoDem !== undefined && colMap.ten !== undefined) {
        const hoDem = getVal(row, 'hoDem', -1);
        const ten = getVal(row, 'ten', -1);
        if (hoDem || ten) {
          hoVaTen = `${hoDem} ${ten}`.trim();
        }
      }

      // Mode B: Single column "Họ, chữ đệm và tên" / "Họ, chữ đêm va tên" / "Họ và tên"
      if (!hoVaTen && colMap.hoVaTen !== undefined) {
        const nameVal = getVal(row, 'hoVaTen', -1);
        if (nameVal) {
          // Check if adjacent column is the first name (e.g. table had merged header spanning 2 cols)
          const nextColIdx = colMap.hoVaTen + 1;
          if (nextColIdx < row.length && colMap.ten === undefined) {
            const nextVal = String(row[nextColIdx] || '').trim();
            if (isLikelyFirstName(nextVal)) {
              hoVaTen = `${nameVal} ${nextVal}`.trim();
            } else {
              hoVaTen = nameVal;
            }
          } else {
            hoVaTen = nameVal;
          }
        }
      }

      // Mode C: Deep Row Inspection (scans row for student name text, combining split cells if needed)
      if (!hoVaTen) {
        hoVaTen = findStudentNameInRow(row, cleanMssv, colMap);
      }

      // Mode D: Final fallback to cleanMssv label instead of generic placeholder
      if (!hoVaTen || hoVaTen.trim() === '') {
        hoVaTen = `Sinh viên ${cleanMssv}`;
      }

      // 4. Số hiệu & Số vào sổ
      const soHieu = getVal(row, 'soHieu', 6) || `QP-${cleanMssv}`;
      const soVaoSo = getVal(row, 'soVaoSo', 7) || `${stt}/GDQP`;
      const ngaySinh = getDateVal(row, 'ngaySinh', 2);
      const gioiTinh = getVal(row, 'gioiTinh', 3) || 'Nam';

      // 5. Ngày cấp chứng chỉ: lấy cột ngày tháng cấp văn bằng, nếu không có thì lấy đợt học
      let ngayCap = getDateVal(row, 'ngayCap', 8);
      if (!ngayCap || ngayCap.trim() === '') {
        const dotHoc = getVal(row, 'dotHoc', 10);
        const khoaHoc = getVal(row, 'khoaHoc', 10);
        ngayCap = dotHoc || khoaHoc || '15/10/2025';
      }

      const tenChungChi = getVal(row, 'tenChungChi', 4) || 'Chứng chỉ Giáo dục Quốc phòng và An ninh';
      const donViCap = getVal(row, 'donViCap', 9) || 'Trung tâm GDQP&AN - Đại học Cần Thơ';
      const khoaHoc = getVal(row, 'khoaHoc', 10) || getVal(row, 'dotHoc', 10) || '';
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
