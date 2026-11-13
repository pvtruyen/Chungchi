import * as XLSX from 'xlsx';
import { CertificateRecord } from '../types/certificate';

/**
 * Remove Vietnamese accents and punctuation for robust header/field matching
 */
export function normalizeHeader(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove all accent diacritics
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
  if (colMap.noiSinh !== undefined) ignoredCols.add(colMap.noiSinh);
  if (colMap.danToc !== undefined) ignoredCols.add(colMap.danToc);
  if (colMap.khoaHoc !== undefined) ignoredCols.add(colMap.khoaHoc);
  if (colMap.nganhDaoTao !== undefined) ignoredCols.add(colMap.nganhDaoTao);
  if (colMap.xepLoai !== undefined) ignoredCols.add(colMap.xepLoai);
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
 * Automatically identifies columns dynamically without relying on fixed column positions.
 * Only skips 1 header line (never skips 4 lines arbitrarily).
 */
export function parseExcelFile(
  data: ArrayBuffer | Uint8Array,
  fileName: string = 'GDQP_Data.xlsx'
): CertificateRecord[] {
  const isCsv = fileName.toLowerCase().endsWith('.csv');
  const workbook = isCsv
    ? XLSX.read(new TextDecoder('utf-8').decode(data instanceof Uint8Array ? data : new Uint8Array(data)), {
        type: 'string',
        cellDates: true,
      })
    : XLSX.read(data, {
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

    // Detect header across first 8 rows (find row with highest match count)
    const colMap: Record<string, number> = {};
    let detectedHeaderRow = -1;
    let maxMatchesInHeader = 0;

    for (let r = 0; r < Math.min(8, rows.length); r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;

      let rowMatches = 0;
      const currentMap: Record<string, number> = {};

      row.forEach((cell, colIdx) => {
        const norm = normalizeHeader(cell);
        if (!norm) return;

        // 1. STT
        if (norm === 'stt' || norm === 'so thu tu' || norm === 'tt' || norm === 'no' || norm.startsWith('stt')) {
          if (currentMap.stt === undefined) { currentMap.stt = colIdx; rowMatches++; }
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
          if (currentMap.mssv === undefined) { currentMap.mssv = colIdx; rowMatches++; }
        }
        // 3. Họ và tên đầy đủ trong 1 cột (Họ và tên người học, Họ tên, Họ lót và tên, Họ, chữ đệm và tên...)
        else if (
          norm === 'ho chu dem va ten' ||
          norm === 'ho chu dem ten' ||
          norm === 'ho va ten' ||
          norm === 'ho ten' ||
          norm === 'ho lot va ten' ||
          norm === 'ho lot ten' ||
          norm === 'ho va ten nguoi hoc' ||
          norm === 'ho ten nguoi hoc' ||
          norm === 'ho ten sinh vien' ||
          norm === 'ho va ten sinh vien' ||
          norm === 'ten nguoi hoc' ||
          norm === 'ho va chu dem va ten' ||
          (norm.includes('ho') && norm.includes('ten')) ||
          (norm.includes('chu dem') && norm.includes('ten')) ||
          (norm.includes('ho') && norm.includes('lot') && norm.includes('ten'))
        ) {
          if (currentMap.hoVaTen === undefined) { currentMap.hoVaTen = colIdx; rowMatches++; }
        }
        // 4. Họ và chữ đệm / Họ lót (tách 2 cột)
        else if (
          norm === 'ho chu dem' ||
          norm === 'ho va chu dem' ||
          norm === 'ho dem' ||
          norm === 'ho lot' ||
          norm === 'ho' ||
          norm.startsWith('ho chu dem') ||
          norm.startsWith('ho va chu dem') ||
          norm.startsWith('ho dem') ||
          norm.startsWith('ho lot') ||
          (norm.includes('chu dem') && !norm.includes('ten')) ||
          ((norm.includes('ho') || norm.includes('lot')) && !norm.includes('ten') && !norm.includes('ngay sinh') && !norm.includes('so'))
        ) {
          if (currentMap.hoDem === undefined) { currentMap.hoDem = colIdx; rowMatches++; }
        }
        // 5. Tên sinh viên (tách 2 cột)
        else if (
          norm === 'ten' ||
          norm === 'ten sinh vien' ||
          norm === 'ten nguoi hoc' ||
          norm === 'ten hoc vien' ||
          norm === 'ten sv'
        ) {
          if (currentMap.ten === undefined) { currentMap.ten = colIdx; rowMatches++; }
        }
        // 6. Số hiệu chứng chỉ / Số văn bằng
        else if (norm.includes('so hieu') || norm.includes('so van bang') || norm.includes('so vb')) {
          if (currentMap.soHieu === undefined) { currentMap.soHieu = colIdx; rowMatches++; }
        }
        // 7. Số vào sổ gốc / Số quản lý (hỗ trợ "Số vào sổ gốc cấp chứng chỉ", "Sốvào sổ", "Số vào sổ")
        else if (
          norm.includes('so vao so') ||
          norm.includes('sovao so') ||
          norm.includes('so vaoso') ||
          norm.includes('sovaoso') ||
          norm.includes('so quan ly') ||
          norm.includes('so goc') ||
          norm.includes('vao so')
        ) {
          if (currentMap.soVaoSo === undefined) { currentMap.soVaoSo = colIdx; rowMatches++; }
        }
        // 8. Ngày sinh / Ngày tháng năm sinh
        else if (
          norm.includes('ngay sinh') ||
          norm.includes('ngay thang nam sinh') ||
          norm.includes('nam sinh') ||
          norm === 'ns'
        ) {
          if (currentMap.ngaySinh === undefined) { currentMap.ngaySinh = colIdx; rowMatches++; }
        }
        // 9. Nơi sinh
        else if (
          norm === 'noi sinh' ||
          norm.includes('noi sinh') ||
          norm === 'que quan' ||
          norm === 'nguyen quan'
        ) {
          if (currentMap.noiSinh === undefined) { currentMap.noiSinh = colIdx; rowMatches++; }
        }
        // 10. Giới tính
        else if (norm.includes('gioi tinh') || norm === 'phai' || norm === 'gt') {
          if (currentMap.gioiTinh === undefined) { currentMap.gioiTinh = colIdx; rowMatches++; }
        }
        // 11. Dân tộc
        else if (norm === 'dan toc' || norm.includes('dan toc') || norm === 'dt') {
          if (currentMap.danToc === undefined) { currentMap.danToc = colIdx; rowMatches++; }
        }
        // 12. Khóa / Khóa học
        else if (
          norm === 'khoa hoc' ||
          norm === 'khoa' ||
          norm.includes('khoa hoc') ||
          norm.startsWith('khoa ') ||
          norm.includes('nien khoa')
        ) {
          if (currentMap.khoaHoc === undefined) { currentMap.khoaHoc = colIdx; rowMatches++; }
        }
        // 13. Ngành / Ngành đào tạo
        else if (
          norm === 'nganh dao tao' ||
          norm === 'nganh' ||
          norm.includes('nganh dao tao') ||
          norm.includes('chuyen nganh') ||
          (norm.includes('nganh') && !norm.includes('ngay'))
        ) {
          if (currentMap.nganhDaoTao === undefined) { currentMap.nganhDaoTao = colIdx; rowMatches++; }
        }
        // 14. Xếp loại / Điểm thi (nếu có)
        else if (
          norm.includes('xep loai') ||
          norm.includes('ket qua') ||
          norm.includes('diem thi') ||
          norm.includes('xep loai diem thi')
        ) {
          if (currentMap.xepLoai === undefined) { currentMap.xepLoai = colIdx; rowMatches++; }
        }
        // 15. Ngày cấp chứng chỉ (có thể có hoặc không)
        else if (
          norm.includes('ngay cap') ||
          norm.includes('ngay thang cap') ||
          norm.includes('ngay ban hanh') ||
          norm.includes('ngay ky') ||
          norm.includes('ngay vb') ||
          norm.includes('ngay cap van bang') ||
          norm.includes('ngay cap chung chi')
        ) {
          if (currentMap.ngayCap === undefined) { currentMap.ngayCap = colIdx; rowMatches++; }
        }
        // 16. Đợt học / Đợt cấp
        else if (
          norm.includes('dot hoc') ||
          norm.includes('dot cap') ||
          norm.includes('dot thi') ||
          norm.includes('dot') ||
          norm.includes('hoc ky')
        ) {
          if (currentMap.dotHoc === undefined) { currentMap.dotHoc = colIdx; rowMatches++; }
        }
        // 17. Tên chứng chỉ
        else if (norm.includes('ten chung chi') || norm.includes('loai chung chi') || norm.includes('ten van bang')) {
          if (currentMap.tenChungChi === undefined) { currentMap.tenChungChi = colIdx; rowMatches++; }
        }
        // 18. Đơn vị cấp
        else if (norm.includes('don vi cap') || norm.includes('co so dao tao') || norm.includes('truong')) {
          if (currentMap.donViCap === undefined) { currentMap.donViCap = colIdx; rowMatches++; }
        }
      });

      // Merge into master colMap
      Object.entries(currentMap).forEach(([k, v]) => {
        if (colMap[k] === undefined) {
          colMap[k] = v;
        }
      });

      if (rowMatches > maxMatchesInHeader) {
        maxMatchesInHeader = rowMatches;
        detectedHeaderRow = r;
      }
    }

    // Determine dataStartRow:
    // Only skips 1 header line! If detected at row r, start at r + 1. If not detected, start at row 1 (skip row 0 only).
    let dataStartRow = detectedHeaderRow !== -1 ? detectedHeaderRow + 1 : 1;

    // Safety: if the row at dataStartRow contains no real data or only column indexes (1), (2), advance by 1
    if (dataStartRow < rows.length) {
      const firstRow = rows[dataStartRow];
      if (Array.isArray(firstRow)) {
        const joined = firstRow.map(c => String(c || '').trim()).join('');
        if (/^\(\d+\)+$/.test(joined) || joined.length === 0) {
          dataStartRow += 1;
        }
      }
    }

    const getVal = (row: unknown[], key: string): string => {
      const idx = colMap[key];
      if (idx !== undefined && idx >= 0 && row[idx] !== undefined && row[idx] !== null) {
        return String(row[idx]).trim();
      }
      return '';
    };

    const getDateVal = (row: unknown[], key: string): string => {
      const idx = colMap[key];
      if (idx !== undefined && idx >= 0 && row[idx] !== undefined && row[idx] !== null) {
        return formatExcelDate(row[idx]);
      }
      return '';
    };

    for (let r = dataStartRow; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      // 1. Dynamic MSSV extraction
      let mssv = getVal(row, 'mssv');
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

      // If still no MSSV, check if any cell contains an alphanumeric ID
      if (!mssv) continue; // Skip non-student row

      const cleanMssv = mssv.trim().toUpperCase();

      // 2. STT (if file has no STT column, use sequential number)
      const sttRaw = getVal(row, 'stt');
      const stt = sttRaw ? (isNaN(Number(sttRaw)) ? sttRaw : Number(sttRaw)) : (r - dataStartRow + 1);

      // 3. Dynamic Student Name extraction (Họ và tên / Họ lót và tên)
      let hoVaTen = '';

      // Mode A: Split columns (Họ và chữ đệm + Tên)
      if (colMap.hoDem !== undefined && colMap.ten !== undefined) {
        const hoDem = getVal(row, 'hoDem');
        const ten = getVal(row, 'ten');
        if (hoDem || ten) {
          hoVaTen = `${hoDem} ${ten}`.trim();
        }
      }

      // Mode B: Single column "Họ và tên người học" / "Họ và tên" / "Họ lót và tên"
      if (!hoVaTen && colMap.hoVaTen !== undefined) {
        const nameVal = getVal(row, 'hoVaTen');
        if (nameVal) {
          // If table had merged column or next column is first name
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

      // Mode C: Automatic Row Scanning for student name
      if (!hoVaTen) {
        hoVaTen = findStudentNameInRow(row, cleanMssv, colMap);
      }

      if (!hoVaTen || hoVaTen.trim() === '') {
        hoVaTen = `Sinh viên ${cleanMssv}`;
      }

      // 4. Dynamic Số hiệu chứng chỉ
      let soHieu = getVal(row, 'soHieu');
      if (!soHieu) {
        // Look for cell matching certificate code pattern (e.g. C123456 or QPAN-...)
        for (let c = 0; c < row.length; c++) {
          if (c === colMap.mssv || c === colMap.stt || c === colMap.hoVaTen) continue;
          const val = String(row[c] || '').trim();
          if (/^[a-zA-Z]{1,2}\d{5,8}$/i.test(val) && val.toUpperCase() !== cleanMssv) {
            soHieu = val;
            break;
          }
        }
      }
      if (!soHieu) {
        soHieu = `QP-${cleanMssv}`;
      }

      // 5. Dynamic Số vào sổ gốc
      let soVaoSo = getVal(row, 'soVaoSo');
      if (!soVaoSo) {
        // Look for cell matching so vao so pattern (e.g. 142/2025/GDQP or 142/GDQP or number)
        for (let c = 0; c < row.length; c++) {
          if (c === colMap.mssv || c === colMap.stt || c === colMap.hoVaTen || c === colMap.soHieu) continue;
          const val = String(row[c] || '').trim();
          if (/\d+\/\d+/.test(val) || /\d+\/[a-zA-Z]+/.test(val)) {
            soVaoSo = val;
            break;
          }
        }
      }
      if (!soVaoSo) {
        soVaoSo = `${stt}/GDQP`;
      }

      // 6. Dynamic Ngày sinh, Nơi sinh, Giới tính, Dân tộc
      const ngaySinh = getDateVal(row, 'ngaySinh');
      const noiSinh = getVal(row, 'noiSinh');
      const gioiTinh = getVal(row, 'gioiTinh') || 'Nam';
      const danToc = getVal(row, 'danToc') || 'Kinh';

      // 7. Dynamic Khóa học, Ngành đào tạo, Xếp loại
      const khoaHoc = getVal(row, 'khoaHoc') || getVal(row, 'dotHoc') || '';
      const nganhDaoTao = getVal(row, 'nganhDaoTao') || '';
      const xepLoai = getVal(row, 'xepLoai') || '';

      // 8. Dynamic Ngày cấp (có thể không có hoặc lấy theo đợt)
      let ngayCap = getDateVal(row, 'ngayCap');
      if (!ngayCap || ngayCap.trim() === '') {
        const dotHoc = getVal(row, 'dotHoc');
        ngayCap = dotHoc || '';
      }

      const tenChungChi = getVal(row, 'tenChungChi') || 'Chứng chỉ Giáo dục Quốc phòng và An ninh';
      const donViCap = getVal(row, 'donViCap') || 'Trung tâm GDQP&AN - Đại học Cần Thơ';

      records.push({
        id: `${cleanMssv}_${soHieu}_${r}`,
        stt,
        soHieuChungChi: soHieu,
        soVaoSoGoc: soVaoSo,
        tenChungChi,
        hoVaTen,
        mssv: cleanMssv,
        ngaySinh,
        noiSinh,
        gioiTinh,
        danToc,
        khoaHoc,
        nganhDaoTao,
        xepLoai,
        ngayCap,
        donViCap,
        fileName,
      });
    }
  }

  return records;
}
