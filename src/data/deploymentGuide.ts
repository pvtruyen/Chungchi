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
          const row = rows[r], mssv = String(row[map.mssv] || "").trim().toUpperCase();
          const hoTen = map.hoTen >= 0 ? String(row[map.hoTen] || "").trim() : "";
          if (!mssv && !hoTen) continue;
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
  return {
    id: (mssv || "ROW") + "_" + r, mssv: mssv, hoVaTen: hoTen || ("Sinh viên " + mssv),
    stt: map.stt >= 0 ? row[map.stt] : (r - map.startRow + 1),
    ngaySinh: map.ngaySinh >= 0 ? fmtDate(row[map.ngaySinh]) : "",
    noiSinh: map.noiSinh >= 0 ? String(row[map.noiSinh] || "") : "",
    gioiTinh: map.gioiTinh >= 0 ? String(row[map.gioiTinh] || "") : "",
    danToc: map.danToc >= 0 ? String(row[map.danToc] || "") : "",
    khoaHoc: map.khoaHoc >= 0 ? String(row[map.khoaHoc] || "") : "",
    nganhDaoTao: map.nganh >= 0 ? String(row[map.nganh] || "") : "",
    xepLoai: map.xepLoai >= 0 ? String(row[map.xepLoai] || "") : "",
    soHieuChungChi: map.soHieu >= 0 ? String(row[map.soHieu] || "") : "",
    soVaoSoGoc: map.soSo >= 0 ? String(row[map.soSo] || "") : "",
    ngayCap: map.ngayCap >= 0 ? fmtDate(row[map.ngayCap]) : "",
    tenChungChi: "Chứng chỉ Giáo dục Quốc phòng và An ninh",
    donViCap: "Đại học Cần Thơ", fileName: fileName
  };
}

function detectCols(rows) {
  const m = { startRow: 1, stt: -1, mssv: 0, hoTen: 1, ngaySinh: -1, noiSinh: -1, gioiTinh: -1, danToc: -1, khoaHoc: -1, nganh: -1, xepLoai: -1, soHieu: -1, soSo: -1, ngayCap: -1 };
  for (let r = 0; r < Math.min(6, rows.length); r++) {
    let matched = false;
    rows[r].forEach(function (v, c) {
      const h = norm(v);
      if (!h) return;
      if (h === "stt") { m.stt = c; matched = true; }
      else if (h.includes("mssv") || h.includes("ma nguoi hoc") || h.includes("ma sv") || h.includes("ma so") || h.includes("ma hv")) { m.mssv = c; matched = true; }
      else if ((h.includes("ho") && h.includes("ten")) || h === "ho ten") { m.hoTen = c; matched = true; }
      else if (h.includes("ngay sinh")) m.ngaySinh = c;
      else if (h.includes("noi sinh")) m.noiSinh = c;
      else if (h.includes("gioi tinh") || h === "phai") m.gioiTinh = c;
      else if (h.includes("dan toc")) m.danToc = c;
      else if (h.includes("khoa")) m.khoaHoc = c;
      else if (h.includes("nganh")) m.nganh = c;
      else if (h.includes("xep loai")) m.xepLoai = c;
      else if (h.includes("so hieu") || h.includes("van bang")) m.soHieu = c;
      else if (h.includes("vao so") || h.includes("so goc") || h.includes("so luu")) m.soSo = c;
      else if (h.includes("ngay cap")) m.ngayCap = c;
    });
    if (matched) { m.startRow = r + 1; break; }
  }
  return m;
}

function safeGetFolder(id) { try { return DriveApp.getFolderById(id); } catch (_) { return null; } }
function findFolder(name) { const it = DriveApp.getFoldersByName(name); return it.hasNext() ? it.next() : null; }
function norm(s) { return String(s || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/đ/g, "d").toLowerCase().replace(/\\s+/g, " ").trim(); }
function fmtDate(v) { return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), "dd/MM/yyyy") : String(v || ""); }
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
