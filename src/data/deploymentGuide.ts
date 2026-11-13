/**
 * Tạo đoạn mã Google Apps Script ngắn gọn, dễ sao chép để đọc toàn bộ file Excel/Sheets
 * trong thư mục Google Drive "Số hóa chứng chỉ" mà không bị lỗi CORS.
 */
export function buildShortAppsScriptCode(folderId?: string): string {
  const targetFolderId = (folderId || '').trim();
  return `// Dán đoạn mã này vào script.google.com -> Deploy -> Web App (Anyone)
const FOLDER_ID = "${targetFolderId}"; // Tùy chọn: để trống sẽ tự tìm thư mục "Số hóa chứng chỉ"
const FOLDER_NAME = "Số hóa chứng chỉ";

function doGet(e) {
  const q = String((e && e.parameter && (e.parameter.mssv || e.parameter.q)) || "").trim();
  if (e && e.parameter && e.parameter.action === "ping") return json({ success: true, message: "OK" });
  if (!q) return json({ success: false, found: false, error: "Thiếu từ khóa MSSV hoặc Họ tên" });

  const folder = FOLDER_ID ? DriveApp.getFolderById(FOLDER_ID) : findFolder(FOLDER_NAME);
  if (!folder) return json({ success: false, found: false, error: "Không tìm thấy thư mục: " + FOLDER_NAME });

  const normQ = norm(q), files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next(), name = f.getName(), mime = f.getMimeType();
    let ssId = mime === MimeType.GOOGLE_SHEETS ? f.getId() : null, tempId = null;
    if (!ssId && /\\.xlsx?$/i.test(name)) {
      tempId = Drive.Files.copy({ title: "TMP_" + name }, f.getId(), { convert: true }).id;
      ssId = tempId;
    }
    if (!ssId) continue;
    const hit = scanSpreadsheet(ssId, normQ, name);
    if (tempId) DriveApp.getFileById(tempId).setTrashed(true);
    if (hit) return json({ success: true, found: true, data: hit });
  }
  return json({ success: true, found: false });
}

function scanSpreadsheet(id, normQ, fileName) {
  const sheets = SpreadsheetApp.openById(id).getSheets();
  for (let s = 0; s < sheets.length; s++) {
    const rows = sheets[s].getDataRange().getValues();
    if (rows.length < 2) continue;
    const map = detectCols(rows);
    for (let r = map.startRow; r < rows.length; r++) {
      const row = rows[r], mssv = String(row[map.mssv] || "").trim().toUpperCase();
      const hoTen = map.hoTen >= 0 ? String(row[map.hoTen] || "").trim() : "";
      if (!mssv && !hoTen) continue;
      if (norm(mssv) === normQ || (hoTen && norm(hoTen).indexOf(normQ) !== -1)) {
        return {
          id: mssv + "_" + r, mssv: mssv, hoVaTen: hoTen || ("Sinh viên " + mssv),
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
    }
  }
  return null;
}

function detectCols(rows) {
  const m = { startRow: 1, stt: -1, mssv: 0, hoTen: 1, ngaySinh: -1, noiSinh: -1, gioiTinh: -1, danToc: -1, khoaHoc: -1, nganh: -1, xepLoai: -1, soHieu: -1, soSo: -1, ngayCap: -1 };
  for (let r = 0; r < Math.min(6, rows.length); r++) {
    let matched = false;
    rows[r].forEach(function (v, c) {
      const h = norm(v);
      if (!h) return;
      if (h === "stt") { m.stt = c; matched = true; }
      else if (h.includes("mssv") || h.includes("ma nguoi hoc") || h.includes("ma sv") || h.includes("ma so")) { m.mssv = c; matched = true; }
      else if (h.includes("ho") && h.includes("ten")) { m.hoTen = c; matched = true; }
      else if (h.includes("ngay sinh")) m.ngaySinh = c;
      else if (h.includes("noi sinh")) m.noiSinh = c;
      else if (h.includes("gioi tinh")) m.gioiTinh = c;
      else if (h.includes("dan toc")) m.danToc = c;
      else if (h.includes("khoa")) m.khoaHoc = c;
      else if (h.includes("nganh")) m.nganh = c;
      else if (h.includes("xep loai")) m.xepLoai = c;
      else if (h.includes("so hieu") || h.includes("van bang")) m.soHieu = c;
      else if (h.includes("vao so") || h.includes("so goc")) m.soSo = c;
      else if (h.includes("ngay cap")) m.ngayCap = c;
    });
    if (matched) { m.startRow = r + 1; break; }
  }
  return m;
}

function findFolder(name) { const it = DriveApp.getFoldersByName(name); return it.hasNext() ? it.next() : null; }
function norm(s) { return String(s || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/đ/g, "d").toLowerCase().trim(); }
function fmtDate(v) { return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), "dd/MM/yyyy") : String(v || ""); }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }`;
}

export const GOOGLE_APPS_SCRIPT_CODE = buildShortAppsScriptCode();

export const DEPLOYMENT_STEPS = [
  {
    step: 1,
    title: 'Kích hoạt Chế độ 2: Thư mục Google Drive ("Số hóa chứng chỉ")',
    description:
      'Quét tự động toàn bộ file Excel (.xlsx, .xls) và Google Sheets trong thư mục Drive mà không cần cấu hình Google Cloud API phức tạp.',
    instructions: [
      'Mở Google Drive -> vào thư mục "Số hóa chứng chỉ" -> bấm Mới -> Ứng dụng khác -> Google Apps Script (hoặc vào script.google.com).',
      'Xóa mã mặc định, bấm nút "Copy Script" bên trên và dán vào trình soạn thảo (nếu đọc file .xlsx, bấm dấu + ở mục Services bên trái và thêm "Drive API").',
      'Bấm Triển khai (Deploy) -> Tùy chọn triển khai mới -> Loại: Ứng dụng web (Execute as: Tôi, Who has access: Bất kỳ ai) -> Copy đường link Web App dán vào ô Cài đặt trên Web.',
    ],
  },
  {
    step: 2,
    title: 'Kích hoạt Chế độ 1: Firebase Cloud & Upload Excel cộng dồn',
    description: 'Cài đặt không chạm code bằng cách dán thẳng đoạn mã firebaseConfig vào giao diện Admin.',
    instructions: [
      'Đăng nhập mục "Cài đặt (Admin)" trên thanh tiêu đề.',
      'Mở tab "Cài đặt Firebase", dán nguyên đoạn mã firebaseConfig lấy từ Firebase Console và bấm "Kết nối & Lưu".',
      'Chuyển sang tab "Nạp Excel (Cộng dồn)" để kéo thả các file .xlsx/.xls — dữ liệu tự động nối tiếp lên Cloud Firestore.',
    ],
  },
];
