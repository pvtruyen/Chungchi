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

function hasWord(norm: string, word: string): boolean {
  if (!norm) return false;
  return new RegExp(`(^| )${word}( |$)`).test(norm);
}

/**
 * Format Excel date (serial number, Date object, ISO string, or text) to dd/mm/yyyy
 */
export function formatExcelDate(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '';

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    // 4-digit year alone (e.g. 2003)
    if (raw >= 1940 && raw <= 2030 && Number.isInteger(raw)) {
      return String(raw);
    }
    const dateObj = XLSX.SSF.parse_date_code(raw);
    if (dateObj && dateObj.y >= 1900) {
      const day = String(dateObj.d).padStart(2, '0');
      const month = String(dateObj.m).padStart(2, '0');
      const year = dateObj.y;
      return `${day}/${month}/${year}`;
    }
  }

  if (raw instanceof Date && !isNaN(raw.getTime())) {
    // Compensate SheetJS ~1900 epoch millisecond drift (e.g. 23:59:xx previous day)
    const adjusted =
      raw.getHours() === 23 && raw.getMinutes() >= 50
        ? new Date(raw.getTime() + 3600_000)
        : raw;
    const day = String(adjusted.getDate()).padStart(2, '0');
    const month = String(adjusted.getMonth() + 1).padStart(2, '0');
    const year = adjusted.getFullYear();
    return `${day}/${month}/${year}`;
  }

  const str = String(raw).trim();
  if (!str) return '';

  // ISO datetime or YYYY-MM-DD (e.g. 2003-05-14 or 2003-05-14T00:00:00.000Z)
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) {
    return `${isoMatch[3].padStart(2, '0')}/${isoMatch[2].padStart(2, '0')}/${isoMatch[1]}`;
  }

  // dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[1].padStart(2, '0')}/${dmyMatch[2].padStart(2, '0')}/${dmyMatch[3]}`;
  }

  // dd/mm/yy (2-digit year)
  const dmyShortMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (dmyShortMatch) {
    const yy = Number(dmyShortMatch[3]);
    const fullYear = yy <= 30 ? 2000 + yy : 1900 + yy;
    return `${dmyShortMatch[1].padStart(2, '0')}/${dmyShortMatch[2].padStart(2, '0')}/${fullYear}`;
  }

  return str;
}

/**
 * Checks if a string looks like a Vietnamese student's first name (e.g. "An", "Bình", "Thảo", "Huy")
 */
function isLikelyFirstName(val: string): boolean {
  if (!val) return false;
  const s = val.trim();
  if (s.length < 1 || s.length > 25) return false;
  if (/\d/.test(s)) return false;

  const lower = normalizeHeader(s);
  const nonNames = ['nam', 'nu', 'dat', 'gioi', 'kha', 'tb', 'trung binh', 'xuat sac', 'khong', 'kinh', 'khmer', 'hoa'];
  if (nonNames.includes(lower)) return false;

  return /[a-zA-ZàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ]/i.test(s);
}

function isLikelyMssvCell(val: unknown): boolean {
  const s = String(val || '').trim();
  if (!s) return false;
  return /^[a-zA-Z]{1,3}\d{6,8}$/.test(s) || /^\d{7,10}$/.test(s);
}

function isLikelyBirthDateCell(val: unknown): boolean {
  if (val === null || val === undefined || val === '') return false;
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    return y >= 1955 && y <= 2016;
  }
  if (typeof val === 'number') {
    if (val >= 1960 && val <= 2015 && Number.isInteger(val)) return true;
    const d = XLSX.SSF.parse_date_code(val);
    return Boolean(d && d.y >= 1955 && d.y <= 2016);
  }
  const s = String(val).trim();
  const formatted = formatExcelDate(s);
  const m = formatted.match(/^\d{2}\/\d{2}\/(\d{4})$/);
  if (m) {
    const y = Number(m[1]);
    return y >= 1955 && y <= 2016;
  }
  return /^\d{4}$/.test(s) && Number(s) >= 1960 && Number(s) <= 2015;
}

type ColumnKey =
  | 'stt'
  | 'mssv'
  | 'hoVaTen'
  | 'hoDem'
  | 'ten'
  | 'soHieu'
  | 'soVaoSo'
  | 'ngaySinh'
  | 'noiSinh'
  | 'gioiTinh'
  | 'danToc'
  | 'khoaHoc'
  | 'nganhDaoTao'
  | 'xepLoai'
  | 'diemThi'
  | 'ngayCap'
  | 'dotHoc'
  | 'tenChungChi'
  | 'donViCap';

function classifyHeaderCell(norm: string): ColumnKey | null {
  if (!norm) return null;

  // 1. STT
  if (
    norm === 'stt' ||
    norm === 'so thu tu' ||
    norm === 'tt' ||
    norm === 'no' ||
    hasWord(norm, 'stt')
  ) {
    return 'stt';
  }

  // 2. MSSV (Mã số sinh viên / Mã người học)
  if (
    norm === 'mssv' ||
    norm === 'ma sv' ||
    norm === 'ma hv' ||
    norm === 'ma so sv' ||
    norm === 'ma sinh vien' ||
    norm === 'ma so sinh vien' ||
    norm === 'ma nguoi hoc' ||
    norm === 'ma hoc vien' ||
    norm.includes('mssv') ||
    (hasWord(norm, 'ma') &&
      (norm.includes('sinh vien') ||
        norm.includes('nguoi hoc') ||
        norm.includes('hoc vien') ||
        hasWord(norm, 'sv') ||
        hasWord(norm, 'hv')))
  ) {
    return 'mssv';
  }

  // 3. Ngày tháng năm sinh / Ngày sinh (checked early so words like "sinh" don't collide)
  if (
    norm.includes('ngay thang nam sinh') ||
    norm.includes('ngay sinh') ||
    norm.includes('ng sinh') ||
    norm.includes('ngay thang sinh') ||
    norm.includes('nam sinh') ||
    norm.includes('sinh ngay') ||
    norm === 'ntns' ||
    norm === 'dob' ||
    norm === 'date of birth' ||
    norm === 'birth date' ||
    hasWord(norm, 'ns')
  ) {
    return 'ngaySinh';
  }

  // 4. Nơi sinh
  if (
    norm === 'noi sinh' ||
    norm.includes('noi sinh') ||
    norm === 'que quan' ||
    norm === 'nguyen quan' ||
    norm.includes('noi khai sinh')
  ) {
    return 'noiSinh';
  }

  // 5. Giới tính
  if (
    norm.includes('gioi tinh') ||
    hasWord(norm, 'phai') ||
    norm === 'gt' ||
    norm === 'nam nu' ||
    norm === 'sex' ||
    norm === 'gender'
  ) {
    return 'gioiTinh';
  }

  // 6. Dân tộc
  if (norm === 'dan toc' || norm.includes('dan toc') || norm === 'dt') {
    return 'danToc';
  }

  // 7. Số vào sổ gốc cấp chứng chỉ (checked BEFORE ngày cấp & số hiệu so "cap chung chi" stays here)
  if (
    norm.includes('so vao so') ||
    norm.includes('luu vao so') ||
    norm.includes('so luu') ||
    norm.includes('sovao so') ||
    norm.includes('so vaoso') ||
    norm.includes('sovaoso') ||
    norm.includes('so quan ly') ||
    norm.includes('so goc') ||
    norm.includes('vao so')
  ) {
    return 'soVaoSo';
  }

  // 8. Số hiệu chứng chỉ / Số văn bằng
  if (
    norm.includes('so hieu') ||
    norm.includes('so van bang') ||
    norm === 'so vb' ||
    norm === 'so cc' ||
    norm === 'so chung chi'
  ) {
    return 'soHieu';
  }

  // 9. Xếp loại / Điểm thi
  if (
    norm.includes('xep loai') ||
    norm.includes('ket qua') ||
    norm === 'kq' ||
    norm === 'xep hang'
  ) {
    return 'xepLoai';
  }
  if (
    norm.includes('diem thi') ||
    norm === 'diem' ||
    norm === 'diem tb' ||
    norm.includes('diem trung binh') ||
    norm.includes('diem tong ket')
  ) {
    return 'diemThi';
  }

  // 10. Khóa / Khóa học (use hasWord so "ho" in "hoc" is never confused with Họ!)
  if (
    norm === 'khoa' ||
    norm === 'khoa hoc' ||
    norm.includes('khoa hoc') ||
    norm.includes('khoa dao tao') ||
    norm.includes('nien khoa') ||
    norm.startsWith('khoa ')
  ) {
    return 'khoaHoc';
  }

  // 11. Ngành / Ngành đào tạo
  if (
    norm === 'nganh' ||
    norm === 'nganh dao tao' ||
    norm.includes('nganh dao tao') ||
    norm.includes('ten nganh') ||
    norm.includes('chuyen nganh') ||
    norm.includes('nganh hoc') ||
    (hasWord(norm, 'nganh') && !norm.includes('ngay'))
  ) {
    return 'nganhDaoTao';
  }

  // 12. Họ và tên đầy đủ trong 1 cột (Họ và tên người học, Họ và tên, Họ tên, Họ lót và tên, Họ, chữ đệm và tên...)
  if (
    norm === 'ho va ten nguoi hoc' ||
    norm === 'ho ten nguoi hoc' ||
    norm === 'ho va ten sinh vien' ||
    norm === 'ho ten sinh vien' ||
    norm === 'ho va ten hoc vien' ||
    norm === 'ho ten hoc vien' ||
    norm === 'ho va ten sv' ||
    norm === 'ho ten sv' ||
    norm === 'ho chu dem va ten' ||
    norm === 'ho va chu dem va ten' ||
    norm === 'ho chu dem ten' ||
    norm === 'ho lot va ten' ||
    norm === 'ho lot ten' ||
    norm === 'ho va ten' ||
    norm === 'ho ten' ||
    norm === 'full name' ||
    norm === 'ho ten nguoi duoc cap' ||
    (hasWord(norm, 'ho') && hasWord(norm, 'ten')) ||
    (norm.includes('chu dem') && hasWord(norm, 'ten')) ||
    (hasWord(norm, 'ho') && hasWord(norm, 'lot') && hasWord(norm, 'ten'))
  ) {
    return 'hoVaTen';
  }

  // 13. Họ và chữ đệm / Họ lót (tách 2 cột - dùng hasWord tránh đụng "nguoi hoc", "khoa hoc")
  if (
    norm === 'ho' ||
    norm === 'ho lot' ||
    norm === 'ho dem' ||
    norm === 'ho chu dem' ||
    norm === 'ho va chu dem' ||
    norm === 'ho va ten dem' ||
    norm === 'ho ten dem' ||
    norm.startsWith('ho chu dem') ||
    norm.startsWith('ho va chu dem') ||
    norm.startsWith('ho dem') ||
    norm.startsWith('ho lot')
  ) {
    return 'hoDem';
  }

  // 14. Tên (tách 2 cột hoặc "Tên người học" — sẽ được chuẩn hóa lại sau khi xem cả hàng tiêu đề)
  if (
    norm === 'ten' ||
    norm === 'ten sv' ||
    norm === 'ten hv' ||
    norm === 'ten sinh vien' ||
    norm === 'ten nguoi hoc' ||
    norm === 'ten hoc vien' ||
    norm === 'ten goi'
  ) {
    return 'ten';
  }

  // 15. Ngày cấp chứng chỉ
  if (
    norm.includes('ngay cap') ||
    norm.includes('ngay thang cap') ||
    norm.includes('ngay ban hanh') ||
    norm.includes('ngay ky') ||
    norm.includes('ngay vb') ||
    norm.includes('ngay quet')
  ) {
    return 'ngayCap';
  }

  // 16. Đợt học / Đợt cấp
  if (
    norm.includes('dot hoc') ||
    norm.includes('dot cap') ||
    norm.includes('dot thi') ||
    hasWord(norm, 'dot') ||
    norm.includes('hoc ky')
  ) {
    return 'dotHoc';
  }

  // 17. Tên chứng chỉ
  if (norm.includes('ten chung chi') || norm.includes('loai chung chi') || norm.includes('ten van bang')) {
    return 'tenChungChi';
  }

  // 18. Đơn vị cấp
  if (norm.includes('don vi cap') || norm.includes('co so dao tao') || hasWord(norm, 'truong')) {
    return 'donViCap';
  }

  return null;
}

const KEY_WEIGHTS: Partial<Record<ColumnKey, number>> = {
  mssv: 4,
  hoVaTen: 4,
  hoDem: 2,
  ten: 2,
  ngaySinh: 3,
  soHieu: 3,
  soVaoSo: 3,
  noiSinh: 2,
  gioiTinh: 2,
  danToc: 2,
  khoaHoc: 2,
  nganhDaoTao: 2,
  xepLoai: 2,
  diemThi: 2,
  stt: 1,
  ngayCap: 1,
};

/**
 * Intelligently find a student's name in a row if header mapping missed it
 */
function findStudentNameInRow(
  row: unknown[],
  cleanMssv: string,
  colMap: Record<string, number>
): string {
  const ignoredCols = new Set<number>(Object.values(colMap).filter((v) => typeof v === 'number'));

  // First pass: look for two adjacent unmapped columns that form "Họ và chữ đệm" + "Tên"
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
      return `${val1} ${val2}`.replace(/\s+/g, ' ').trim();
    }
  }

  // Second pass: look for a single unmapped column with full name (at least 2 words)
  for (let c = 0; c < row.length; c++) {
    if (ignoredCols.has(c)) continue;
    const val = String(row[c] || '').trim();
    if (!val || /\d/.test(val)) continue;
    if (val.toUpperCase() === cleanMssv) continue;

    const words = val.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && isLikelyFirstName(words[words.length - 1])) {
      return val.replace(/\s+/g, ' ').trim();
    }
  }

  return '';
}

/**
 * Parse an Excel file (ArrayBuffer / Uint8Array) into normalized Certificate records.
 * Automatically identifies the true table header row (without title-row pollution) and supports merged sub-headers.
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

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    if (rows.length === 0) continue;

    // 1. Score the first 15 rows independently to pick the TRUE table header row
    let detectedHeaderRow = -1;
    let bestScore = -1;
    let bestMap: Record<string, number> = {};

    const scanLimit = Math.min(15, rows.length);
    for (let r = 0; r < scanLimit; r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;

      // Do not mistake an actual student data row for a header row
      let dataLikeCells = 0;
      row.forEach((cell) => {
        if (isLikelyMssvCell(cell)) dataLikeCells++;
      });
      if (dataLikeCells > 0) continue;

      const currentMap: Record<string, number> = {};
      let rowScore = 0;
      let matchCount = 0;

      row.forEach((cell, colIdx) => {
        const key = classifyHeaderCell(normalizeHeader(cell));
        if (key && currentMap[key] === undefined) {
          currentMap[key] = colIdx;
          matchCount++;
          rowScore += KEY_WEIGHTS[key] || 1;
        }
      });

      if (matchCount >= 2 && rowScore > bestScore) {
        bestScore = rowScore;
        detectedHeaderRow = r;
        bestMap = currentMap;
      }
    }

    const colMap: Record<string, number> = { ...bestMap };
    let dataStartRow = detectedHeaderRow !== -1 ? detectedHeaderRow + 1 : 1;

    // 2. Check optional sub-header row right below detectedHeaderRow (for merged "Họ và tên" -> "Họ lót | Tên")
    if (detectedHeaderRow !== -1 && detectedHeaderRow + 1 < rows.length) {
      const subRow = rows[detectedHeaderRow + 1];
      if (Array.isArray(subRow)) {
        const hasMssvValue = subRow.some((cell) => isLikelyMssvCell(cell));
        if (!hasMssvValue) {
          let subMatches = 0;
          const subMap: Record<string, number> = {};
          subRow.forEach((cell, colIdx) => {
            const key = classifyHeaderCell(normalizeHeader(cell));
            if (key && subMap[key] === undefined) {
              subMap[key] = colIdx;
              subMatches++;
            }
          });
          if (subMatches >= 1 && (subMap.hoDem !== undefined || subMap.ten !== undefined || subMatches >= 2)) {
            if (subMap.hoDem !== undefined && subMap.ten !== undefined) {
              delete colMap.hoVaTen;
            }
            Object.entries(subMap).forEach(([k, v]) => {
              if (colMap[k] === undefined || k === 'hoDem' || k === 'ten') {
                colMap[k] = v;
              }
            });
            dataStartRow = detectedHeaderRow + 2;
          }
        }
      }
    }

    // 3. Disambiguate "ten" vs "hoVaTen":
    // If "ten" (e.g. "Tên người học") exists WITHOUT "hoDem", check whether its cells hold full names (2+ words)
    if (colMap.ten !== undefined && colMap.hoDem === undefined && colMap.hoVaTen === undefined) {
      // Check if preceding column might be unlabelled "Họ lót"
      const prevCol = colMap.ten - 1;
      const mappedSet = new Set(Object.values(colMap));
      let prevLooksLikeHoLot = false;
      if (prevCol >= 0 && !mappedSet.has(prevCol)) {
        for (let r = dataStartRow; r < Math.min(rows.length, dataStartRow + 5); r++) {
          const v = String(rows[r]?.[prevCol] || '').trim();
          const t = String(rows[r]?.[colMap.ten] || '').trim();
          if (v && !/\d/.test(v) && t && t.split(/\s+/).length === 1 && isLikelyFirstName(t)) {
            prevLooksLikeHoLot = true;
            break;
          }
        }
      }
      if (prevLooksLikeHoLot) {
        colMap.hoDem = prevCol;
      } else {
        colMap.hoVaTen = colMap.ten;
        delete colMap.ten;
      }
    }

    // Skip numeric guide row like (1) (2) (3) ...
    if (dataStartRow < rows.length) {
      const firstRow = rows[dataStartRow];
      if (Array.isArray(firstRow)) {
        const joined = firstRow.map((c) => String(c || '').trim()).join('');
        if (/^\(\d+\)+$/.test(joined) || joined.length === 0) {
          dataStartRow += 1;
        }
      }
    }

    // 4. Content-based fallback if "ngaySinh" header was not recognized
    if (colMap.ngaySinh === undefined && rows.length > dataStartRow) {
      const mappedCols = new Set(Object.values(colMap));
      const maxCols = Math.max(...rows.slice(dataStartRow, dataStartRow + 10).map((r) => (Array.isArray(r) ? r.length : 0)), 0);
      let bestDateCol = -1;
      let bestDateHits = 0;
      const sampleEnd = Math.min(rows.length, dataStartRow + 10);
      for (let c = 0; c < maxCols; c++) {
        if (mappedCols.has(c)) continue;
        let hits = 0;
        for (let r = dataStartRow; r < sampleEnd; r++) {
          if (isLikelyBirthDateCell(rows[r]?.[c])) hits++;
        }
        if (hits >= 2 && hits > bestDateHits) {
          bestDateHits = hits;
          bestDateCol = c;
        }
      }
      if (bestDateCol !== -1) {
        colMap.ngaySinh = bestDateCol;
      }
    }

    const mappedColsFinal = new Set(Object.values(colMap));

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
      if (!mssv) {
        for (let c = 0; c < row.length; c++) {
          if (c === colMap.stt || c === colMap.soHieu || c === colMap.soVaoSo) continue;
          const val = String(row[c] || '').trim();
          if (/^[a-zA-Z]{1,3}\d{6,8}$/i.test(val) || (/^\d{7,10}$/.test(val) && !mappedColsFinal.has(c))) {
            mssv = val;
            if (colMap.mssv === undefined) colMap.mssv = c;
            break;
          }
        }
      }

      if (!mssv) continue;
      const cleanMssv = mssv.trim().toUpperCase();

      // 2. STT
      const sttRaw = getVal(row, 'stt');
      const stt = sttRaw ? (isNaN(Number(sttRaw)) ? sttRaw : Number(sttRaw)) : r - dataStartRow + 1;

      // 3. Dynamic Student Name extraction (Họ và tên người học)
      let hoVaTen = '';

      // Mode A: Split columns (Họ lót / Họ và chữ đệm + Tên)
      if (colMap.hoDem !== undefined && colMap.ten !== undefined) {
        const hoDem = getVal(row, 'hoDem');
        const ten = getVal(row, 'ten');
        if (hoDem || ten) {
          hoVaTen = `${hoDem} ${ten}`.replace(/\s+/g, ' ').trim();
        }
      }

      // Mode B: Single column "Họ và tên người học" / "Họ và tên"
      if (!hoVaTen && colMap.hoVaTen !== undefined) {
        const nameVal = getVal(row, 'hoVaTen');
        if (nameVal) {
          const nextColIdx = colMap.hoVaTen + 1;
          if (
            nextColIdx < row.length &&
            colMap.ten === undefined &&
            !mappedColsFinal.has(nextColIdx)
          ) {
            const nextVal = String(row[nextColIdx] || '').trim();
            if (isLikelyFirstName(nextVal) && nextVal.split(/\s+/).length === 1) {
              hoVaTen = `${nameVal} ${nextVal}`.replace(/\s+/g, ' ').trim();
            } else {
              hoVaTen = nameVal.replace(/\s+/g, ' ').trim();
            }
          } else {
            hoVaTen = nameVal.replace(/\s+/g, ' ').trim();
          }
        }
      }

      // Mode C: Automatic Row Scanning across unmapped cells
      if (!hoVaTen) {
        hoVaTen = findStudentNameInRow(row, cleanMssv, colMap);
      }

      if (!hoVaTen || hoVaTen.trim() === '') {
        hoVaTen = `Sinh viên ${cleanMssv}`;
      }

      // 4. Số hiệu chứng chỉ
      let soHieu = getVal(row, 'soHieu');
      if (!soHieu) {
        for (let c = 0; c < row.length; c++) {
          if (mappedColsFinal.has(c)) continue;
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

      // 5. Số vào sổ gốc cấp chứng chỉ
      let soVaoSo = getVal(row, 'soVaoSo');
      if (!soVaoSo) {
        for (let c = 0; c < row.length; c++) {
          if (mappedColsFinal.has(c)) continue;
          const val = String(row[c] || '').trim();
          if ((/\d+\/\d+/.test(val) || /\d+\/[a-zA-Z]+/.test(val)) && !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(val)) {
            soVaoSo = val;
            break;
          }
        }
      }
      if (!soVaoSo) {
        soVaoSo = `${stt}/GDQP`;
      }

      // 6. Ngày tháng năm sinh, Nơi sinh, Giới tính, Dân tộc
      const ngaySinh = getDateVal(row, 'ngaySinh');
      const noiSinh = getVal(row, 'noiSinh');
      const gioiTinh = getVal(row, 'gioiTinh') || 'Nam';
      const danToc = getVal(row, 'danToc') || 'Kinh';

      // 7. Khóa, Ngành, Xếp loại / Điểm thi
      const khoaHoc = getVal(row, 'khoaHoc') || getVal(row, 'dotHoc') || '';
      const nganhDaoTao = getVal(row, 'nganhDaoTao') || '';
      const xepLoaiVal = getVal(row, 'xepLoai');
      const diemThiVal = getVal(row, 'diemThi');
      let xepLoai = '';
      if (xepLoaiVal && diemThiVal) {
        xepLoai = xepLoaiVal.includes(diemThiVal) ? xepLoaiVal : `${xepLoaiVal} (${diemThiVal})`;
      } else {
        xepLoai = xepLoaiVal || diemThiVal || '';
      }

      // 8. Ngày cấp
      let ngayCap = getDateVal(row, 'ngayCap');
      if (!ngayCap || ngayCap.trim() === '') {
        ngayCap = getVal(row, 'dotHoc') || '';
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
