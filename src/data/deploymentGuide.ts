/**
 * Tạo đoạn mã Google Apps Script ngắn gọn, tự động đọc toàn bộ file Excel/Sheets/CSV
 * trong thư mục Google Drive "Số hóa chứng chỉ" và trả về danh sách file + số dòng đã kết nối.
 */
export function buildShortAppsScriptCode(folderId?: string): string {
  const targetFolderId = (folderId || '').trim();
  return `// Dán đoạn mã này vào script.google.com -> Deploy -> Web App (Anyone)
const FOLDER_ID = "${targetFolderId}"; // Tùy chọn: để trống sẽ tự tìm thư mục "Số hóa chứng chỉ"
const FOLDER_NAME = "Số hóa chứng chỉ";

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = String(params.action || "").trim().toLowerCase();
  const q = String(params.mssv || params.q || "").trim();

  const folder = FOLDER_ID ? safeGetFolder(FOLDER_ID) : findFolder(FOLDER_NAME);
  if (!folder) {
    return json({
      success: false, found: false, files: [], records: [],
      error: "Không tìm thấy thư mục Google Drive (" + (FOLDER_ID || FOLDER_NAME) + "). Kiểm tra lại quyền hoặc Folder ID."
    });
  }

  if (action === "ping") {
    const info = inspectFolder(folder, false);
    return json({
      success: true, folderName: folder.getName(), folderId: folder.getId(),
      files: info.files, totalFiles: info.files.length, totalRecords: info.totalRecords
    });
  }

  if (action === "sync") {
    const info = inspectFolder(folder, true);
    return json({
      success: true, folderName: folder.getName(), folderId: folder.getId(),
      files: info.files, totalFiles: info.files.length, totalRecords: info.records.length,
      records: info.records
    });
  }

  if (!q) return json({ success: false, found: false, error: "Thiếu từ khóa MSSV hoặc Họ tên" });

  const info = inspectFolder(folder, true, norm(q));
  return json({
    success: true, found: info.matches.length > 0,
    data: info.matches[0] || null, matches: info.matches.slice(0, 20),
    folderName: folder.getName(), files: info.files
  });
}

function inspectFolder(folder, parseRows, normQ) {
  const files = [], records = [], matches = [];
  let totalRecords = 0;
  const isMssvQuery = Boolean(normQ && normQ.indexOf(" ") === -1 && /^[a-z0-9_-]{4,20}$/.test(normQ));
  const it = folder.getFiles();
  while (it.hasNext()) {
    const f = it.next(), name = f.getName(), mime = f.getMimeType();
    const isSheet = mime === MimeType.GOOGLE_SHEETS;
    const isExcel = /\\.xlsx?$/i.test(name) || mime.indexOf("spreadsheetml") !== -1 || mime.indexOf("ms-excel") !== -1;
    const isCsv = /\\.csv$/i.test(name) || mime === MimeType.CSV;
    if (!isSheet && !isExcel && !isCsv) continue;

    let tempId = null;
    try {
      let rowsList = [];
      if (isCsv) {
        rowsList.push(Utilities.parseCsv(f.getBlob().getDataAsString("UTF-8")));
      } else {
        let ssId = isSheet ? f.getId() : null;
        if (!ssId && isExcel) {
          tempId = convertExcelToSheet(f.getId(), name);
          ssId = tempId;
        }
        const sheets = SpreadsheetApp.openById(ssId).getSheets();
        for (let s = 0; s < sheets.length; s++) rowsList.push(sheets[s].getDataRange().getValues());
      }

      let fileCount = 0;
      for (let i = 0; i < rowsList.length; i++) {
        const rows = rowsList[i];
        if (!rows || rows.length < 2) continue;
        const map = detectCols(rows);
        for (let r = map.startRow; r < rows.length; r++) {
          const row = rows[r];
          const mssv = map.mssv >= 0 ? String(row[map.mssv] || "").trim().toUpperCase() : "";
          let hoTen = "";
          if (map.hoDem >= 0 && map.ten >= 0) {
            hoTen = (String(row[map.hoDem] || "").trim() + " " + String(row[map.ten] || "").trim()).replace(/\\s+/g, " ").trim();
          } else if (map.hoTen >= 0) {
            hoTen = String(row[map.hoTen] || "").replace(/\\s+/g, " ").trim();
          }
          if (!mssv) continue;
          fileCount++;
          if (!parseRows) continue;
          if (!normQ || norm(mssv) === normQ || (hoTen && norm(hoTen).indexOf(normQ) !== -1)) {
            const rec = buildRecord(row, map, r, name, mssv, hoTen);
            if (normQ) matches.push(rec);
            else records.push(rec);
          }
        }
      }
      totalRecords += fileCount;
      files.push({ name: name, mimeType: mime, rowCount: fileCount, status: fileCount > 0 ? "connected" : "empty" });
      if (isMssvQuery && matches.length > 0) break;
    } catch (err) {
      files.push({ name: name, mimeType: mime, rowCount: 0, status: "error", error: String(err && err.message || err) });
    } finally {
      if (tempId) try { DriveApp.getFileById(tempId).setTrashed(true); } catch (_) {}
    }
  }
  return { files: files, records: records, matches: matches, totalRecords: totalRecords };
}

function convertExcelToSheet(fileId, name) {
  if (typeof Drive === "undefined" || !Drive.Files || !Drive.Files.copy) {
    throw new Error("Cần bật Service 'Drive API' trong Apps Script (+ Services -> Drive API) để đọc file .xlsx/.xls");
  }
  try {
    return Drive.Files.copy({ name: "TMP_" + name, mimeType: MimeType.GOOGLE_SHEETS }, fileId).id;
  } catch (v3Err) {
    return Drive.Files.copy({ title: "TMP_" + name }, fileId, { convert: true }).id;
  }
}

function buildRecord(row, map, r, fileName, mssv, hoTen) {
  const xl = map.xepLoai >= 0 ? String(row[map.xepLoai] || "").trim() : "";
  const dt = map.diemThi >= 0 ? String(row[map.diemThi] || "").trim() : "";
  const xepLoaiOut = (xl && dt) ? (xl.indexOf(dt) !== -1 ? xl : xl + " (" + dt + ")") : (xl || dt || "");
  return {
    id: (mssv || "ROW") + "_" + r, mssv: mssv, hoVaTen: hoTen || ("Sinh viên " + mssv),
    stt: map.stt >= 0 ? row[map.stt] : (r - map.startRow + 1),
    ngaySinh: map.ngaySinh >= 0 ? fmtDate(row[map.ngaySinh]) : "",
    noiSinh: map.noiSinh >= 0 ? String(row[map.noiSinh] || "").trim() : "",
    gioiTinh: map.gioiTinh >= 0 ? String(row[map.gioiTinh] || "").trim() : "",
    danToc: map.danToc >= 0 ? String(row[map.danToc] || "").trim() : "",
    khoaHoc: map.khoaHoc >= 0 ? String(row[map.khoaHoc] || "").trim() : "",
    nganhDaoTao: map.nganh >= 0 ? String(row[map.nganh] || "").trim() : "",
    xepLoai: xepLoaiOut,
    soHieuChungChi: map.soHieu >= 0 ? String(row[map.soHieu] || "").trim() : "",
    soVaoSoGoc: map.soSo >= 0 ? String(row[map.soSo] || "").trim() : "",
    ngayCap: map.ngayCap >= 0 ? fmtDate(row[map.ngayCap]) : "",
    tenChungChi: "Chứng chỉ Giáo dục Quốc phòng và An ninh",
    donViCap: "Đại học Cần Thơ", fileName: fileName
  };
}

function hasWord(h, w) {
  return new RegExp("(^| )" + w + "( |$)").test(h);
}

function classifyCol(h) {
  if (!h) return null;
  if (h === "stt" || h === "so thu tu" || hasWord(h, "stt")) return "stt";
  if (h === "mssv" || h.indexOf("mssv") !== -1 || h.indexOf("ma nguoi hoc") !== -1 || h.indexOf("ma sinh vien") !== -1 || h.indexOf("ma so sinh vien") !== -1 || h === "ma sv" || h === "ma hv") return "mssv";
  if (h.indexOf("ngay thang nam sinh") !== -1 || h.indexOf("ngay sinh") !== -1 || h.indexOf("ng sinh") !== -1 || h.indexOf("nam sinh") !== -1 || h.indexOf("sinh ngay") !== -1 || h === "ntns" || h === "dob" || hasWord(h, "ns")) return "ngaySinh";
  if (h.indexOf("noi sinh") !== -1 || h === "que quan" || h === "nguyen quan") return "noiSinh";
  if (h.indexOf("gioi tinh") !== -1 || hasWord(h, "phai") || h === "gt") return "gioiTinh";
  if (h.indexOf("dan toc") !== -1 || h === "dt") return "danToc";
  if (h.indexOf("vao so") !== -1 || h.indexOf("so goc") !== -1 || h.indexOf("so luu") !== -1) return "soSo";
  if (h.indexOf("so hieu") !== -1 || h.indexOf("van bang") !== -1 || h === "so cc" || h === "so vb") return "soHieu";
  if (h.indexOf("xep loai") !== -1 || h.indexOf("ket qua") !== -1) return "xepLoai";
  if (h.indexOf("diem thi") !== -1 || h === "diem" || h.indexOf("diem trung binh") !== -1) return "diemThi";
  if (h === "khoa" || h.indexOf("khoa hoc") !== -1 || h.indexOf("nien khoa") !== -1 || h.indexOf("khoa dao tao") !== -1) return "khoaHoc";
  if (h === "nganh" || h.indexOf("nganh") !== -1 && h.indexOf("ngay") === -1) return "nganh";
  if ((hasWord(h, "ho") && hasWord(h, "ten")) || (h.indexOf("chu dem") !== -1 && hasWord(h, "ten")) || h === "ho ten" || h === "ho va ten nguoi hoc" || h === "ho ten nguoi hoc") return "hoTen";
  if (h === "ho" || h === "ho lot" || h === "ho dem" || h === "ho chu dem" || h.indexOf("ho lot") === 0 || h.indexOf("ho dem") === 0 || h.indexOf("ho chu dem") === 0) return "hoDem";
  if (h === "ten" || h === "ten sv" || h === "ten hv" || h === "ten nguoi hoc" || h === "ten sinh vien") return "ten";
  if (h.indexOf("ngay cap") !== -1) return "ngayCap";
  return null;
}

function detectCols(rows) {
  let bestRow = -1, bestScore = -1, bestMap = {};
  for (let r = 0; r < Math.min(15, rows.length); r++) {
    const row = rows[r];
    let hasMssvData = false;
    for (let c = 0; c < row.length; c++) {
      if (/^[a-zA-Z]{1,3}\\d{6,8}$/.test(String(row[c] || "").trim())) { hasMssvData = true; break; }
    }
    if (hasMssvData) continue;
    const cm = {};
    let score = 0, count = 0;
    row.forEach(function (v, c) {
      const k = classifyCol(norm(v));
      if (k && cm[k] === undefined) {
        cm[k] = c;
        count++;
        score += (k === "mssv" || k === "hoTen") ? 4 : (k === "ngaySinh" || k === "soHieu" || k === "soSo") ? 3 : 2;
      }
    });
    if (count >= 2 && score > bestScore) {
      bestScore = score;
      bestRow = r;
      bestMap = cm;
    }
  }
  const m = {
    startRow: bestRow >= 0 ? bestRow + 1 : 1,
    stt: bestMap.stt !== undefined ? bestMap.stt : -1,
    mssv: bestMap.mssv !== undefined ? bestMap.mssv : 0,
    hoTen: bestMap.hoTen !== undefined ? bestMap.hoTen : -1,
    hoDem: bestMap.hoDem !== undefined ? bestMap.hoDem : -1,
    ten: bestMap.ten !== undefined ? bestMap.ten : -1,
    ngaySinh: bestMap.ngaySinh !== undefined ? bestMap.ngaySinh : -1,
    noiSinh: bestMap.noiSinh !== undefined ? bestMap.noiSinh : -1,
    gioiTinh: bestMap.gioiTinh !== undefined ? bestMap.gioiTinh : -1,
    danToc: bestMap.danToc !== undefined ? bestMap.danToc : -1,
    khoaHoc: bestMap.khoaHoc !== undefined ? bestMap.khoaHoc : -1,
    nganh: bestMap.nganh !== undefined ? bestMap.nganh : -1,
    xepLoai: bestMap.xepLoai !== undefined ? bestMap.xepLoai : -1,
    diemThi: bestMap.diemThi !== undefined ? bestMap.diemThi : -1,
    soHieu: bestMap.soHieu !== undefined ? bestMap.soHieu : -1,
    soSo: bestMap.soSo !== undefined ? bestMap.soSo : -1,
    ngayCap: bestMap.ngayCap !== undefined ? bestMap.ngayCap : -1
  };
  if (bestRow >= 0 && bestRow + 1 < rows.length) {
    const sub = rows[bestRow + 1];
    let hasMssvData = false;
    for (let c = 0; c < sub.length; c++) {
      if (/^[a-zA-Z]{1,3}\\d{6,8}$/.test(String(sub[c] || "").trim())) { hasMssvData = true; break; }
    }
    if (!hasMssvData) {
      let subHoDem = -1, subTen = -1;
      sub.forEach(function (v, c) {
        const k = classifyCol(norm(v));
        if (k === "hoDem") subHoDem = c;
        else if (k === "ten") subTen = c;
        else if (k && m[k] === -1) m[k] = c;
      });
      if (subHoDem >= 0 && subTen >= 0) {
        m.hoDem = subHoDem;
        m.ten = subTen;
        m.hoTen = -1;
        m.startRow = bestRow + 2;
      }
    }
  }
  if (m.ten >= 0 && m.hoDem === -1 && m.hoTen === -1) {
    m.hoTen = m.ten;
    m.ten = -1;
  }
  if (m.hoTen === -1 && m.hoDem === -1) m.hoTen = 1;
  return m;
}

function safeGetFolder(id) { try { return DriveApp.getFolderById(id); } catch (_) { return null; } }
function findFolder(name) { const it = DriveApp.getFoldersByName(name); return it.hasNext() ? it.next() : null; }
function norm(s) { return String(s || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\\s+/g, " ").trim(); }
function fmtDate(v) { return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), "dd/MM/yyyy") : String(v || "").trim(); }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }`;
}

export const GOOGLE_APPS_SCRIPT_CODE = buildShortAppsScriptCode();

export const DEPLOYMENT_STEPS = [
  {
    step: 1,
    title: 'Kích hoạt Chế độ 2: Thư mục Google Drive ("Số hóa chứng chỉ")',
    description:
      'Quét trực tiếp toàn bộ file Excel (.xlsx, .xls, .csv) và Google Sheets trong thư mục Drive bằng 1 cú nhấp chuột hoặc qua Google Apps Script.',
    instructions: [
      'Cách nhanh cho Cán bộ: Mở Cài đặt -> tab "2. Google Drive", dán link thư mục Google Drive và bấm "Quét & Tải Excel từ Google Drive (1-Click)" để đọc trực tiếp toàn bộ file Excel lên bộ nhớ tra cứu.',
      'Cách tra cứu công khai cho Sinh viên từ xa: Mở script.google.com -> dán đoạn Script bên trên (bấm dấu + ở mục Services bên trái thêm "Drive API" nếu có file .xlsx/.xls).',
      'Bấm Triển khai (Deploy) -> Ứng dụng web (Execute as: Tôi, Who has access: Bất kỳ ai) -> Copy đường link .../exec dán vào tab "2. Google Drive" và bấm "Kiểm tra & Nạp dữ liệu".',
    ],
  },
  {
    step: 2,
    title: 'Kích hoạt Chế độ 1: Firebase Cloud & Upload Excel cộng dồn',
    description: 'Cài đặt không chạm code bằng cách dán thẳng đoạn mã firebaseConfig vào giao diện Admin.',
    instructions: [
      'Đăng nhập mục "Cài đặt Kết nối (Admin)" trên thanh tiêu đề.',
      'Mở tab "1. Cài đặt Firebase", dán nguyên đoạn mã firebaseConfig lấy từ Firebase Console và bấm "Kết nối & Lưu".',
      'Chuyển sang tab "3. Nạp Excel (Cộng dồn)" để kéo thả các file .xlsx/.xls — dữ liệu tự động nối tiếp lên Cloud Firestore.',
    ],
  },
];
