export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ============================================================================
 * GOOGLE APPS SCRIPT: TRA CỨU CHỨNG CHỈ GDQP&AN TỪ MY DRIVE
 * Thư mục nguồn: "My Drive / GDQP / Số hóa chứng chỉ"
 * ============================================================================
 * 
 * Hướng dẫn cài đặt nhanh:
 * 1. Truy cập https://script.google.com/home -> Bấm "New project" (Dự án mới)
 * 2. Đặt tên: "GDQP_Certificate_Lookup_API"
 * 3. Xóa code cũ, dán toàn bộ mã nguồn bên dưới vào file Code.gs
 * 4. Bấm "Deploy" (Triển khai) -> "New deployment" (Triển khai mới)
 *    - Type: "Web app" (Ứng dụng web)
 *    - Description: "GDQP API v1"
 *    - Execute as: "Me" (Tôi - email quản lý sở hữu folder)
 *    - Who has access: "Anyone" (Bất kỳ ai - cho phép sinh viên tra cứu công khai không cần đăng nhập)
 * 5. Bấm Deploy, cấp quyền truy cập Drive -> Sao chép URL Web App thu được (dạng: https://script.google.com/macros/s/.../exec)
 * 6. Dán URL vào mục Cấu hình trên Web App này!
 */

const FOLDER_PATH = ['GDQP', 'Số hóa chứng chỉ'];

/**
 * Xử lý yêu cầu HTTP GET tra cứu từ Web App
 */
function doGet(e) {
  const startTime = new Date().getTime();
  const mssv = (e && e.parameter && e.parameter.mssv ? e.parameter.mssv : '').trim().toUpperCase();
  const action = e && e.parameter && e.parameter.action ? e.parameter.action : '';

  // Header phản hồi JSON & CORS
  if (!mssv && action !== 'ping') {
    return createJsonResponse({
      success: false,
      found: false,
      error: 'Thiếu tham số mssv. Ví dụ: ?mssv=B2101234'
    });
  }

  if (action === 'ping') {
    return createJsonResponse({ success: true, message: 'GDQP API đang hoạt động bình thường' });
  }

  // 1. Kiểm tra Cache trước để đạt tốc độ < 100ms
  const cache = CacheService.getScriptCache();
  const cachedData = cache.get("MSSV_" + mssv);
  if (cachedData) {
    const elapsed = new Date().getTime() - startTime;
    return createJsonResponse({
      success: true,
      found: true,
      data: JSON.parse(cachedData),
      cached: true,
      executionTimeMs: elapsed
    });
  }

  try {
    // 2. Tìm thư mục Google Drive: GDQP -> Số hóa chứng chỉ
    const folder = getFolderByPath(FOLDER_PATH);
    if (!folder) {
      return createJsonResponse({
        success: false,
        found: false,
        error: 'Không tìm thấy thư mục Google Drive: "My Drive/GDQP/Số hóa chứng chỉ"'
      });
    }

    // 3. Quét các file trong thư mục
    const files = folder.getFiles();
    let foundRecord = null;
    let checkedFiles = 0;

    while (files.hasNext() && !foundRecord) {
      const file = files.next();
      const mime = file.getMimeType();
      const name = file.getName();
      checkedFiles++;

      // Nếu là Google Sheets
      if (mime === MimeType.GOOGLE_SHEETS) {
        foundRecord = searchInGoogleSheet(file.getId(), mssv, name);
      } 
      // Nếu là file Excel (.xlsx)
      else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        foundRecord = searchInExcelFile(file, mssv);
      }
    }

    const elapsed = new Date().getTime() - startTime;

    if (foundRecord) {
      // Lưu vào cache 6 tiếng (21600 giây)
      cache.put("MSSV_" + mssv, JSON.stringify(foundRecord), 21600);

      return createJsonResponse({
        success: true,
        found: true,
        data: foundRecord,
        checkedFiles: checkedFiles,
        executionTimeMs: elapsed
      });
    } else {
      return createJsonResponse({
        success: true,
        found: false,
        message: 'Không tìm thấy dữ liệu chứng chỉ cho MSSV ' + mssv,
        checkedFiles: checkedFiles,
        executionTimeMs: elapsed
      });
    }

  } catch (err) {
    return createJsonResponse({
      success: false,
      found: false,
      error: 'Lỗi hệ thống: ' + err.toString()
    });
  }
}

/**
 * Tìm folder theo mảng đường dẫn ['GDQP', 'Số hóa chứng chỉ']
 */
function getFolderByPath(pathArray) {
  let currentFolder = DriveApp.getRootFolder();
  for (let i = 0; i < pathArray.length; i++) {
    const name = pathArray[i];
    const subFolders = currentFolder.getFoldersByName(name);
    if (subFolders.hasNext()) {
      currentFolder = subFolders.next();
    } else {
      // Tìm kiếm toàn cục nếu thư mục không nằm trực tiếp tại gốc
      const search = DriveApp.getFoldersByName(name);
      if (search.hasNext()) {
        currentFolder = search.next();
      } else {
        return null;
      }
    }
  }
  return currentFolder;
}

/**
 * Tra cứu trong file Google Sheet
 */
function searchInGoogleSheet(sheetId, targetMssv, fileName) {
  const ss = SpreadsheetApp.openById(sheetId);
  const sheets = ss.getSheets();

  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    const data = sheet.getDataRange().getValues();
    if (data.length < 4) continue;

    // Tìm cột tiêu đề trong 5 dòng đầu
    let colMssv = -1;
    let colStt = 0;
    let colHoTen = 1;
    let colNgaySinh = 2;
    let colGioiTinh = 3;
    let colSoHieu = 5;
    let colSoSo = 6;
    let colNgayCap = 7;
    let dataStartRow = 3; // Dòng 4 (index 3)

    let colHoDem = -1;
    let colTen = -1;

    for (let r = 0; r < Math.min(8, data.length); r++) {
      for (let c = 0; c < data[r].length; c++) {
        const val = String(data[r][c] || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/Đ/g, 'D')
          .toLowerCase()
          .trim();

        if (val.includes('ma nguoi hoc') || val.includes('mssv') || val.includes('ma sinh vien')) {
          colMssv = c;
          dataStartRow = r + 1;
        } else if (val === 'stt' || val.includes('thu tu')) {
          colStt = c;
        } else if (val.includes('ho chu dem va ten') || val.includes('ho va ten') || val.includes('ho ten') || (val.includes('ho') && val.includes('ten'))) {
          colHoTen = c;
        } else if (val.includes('ho chu dem') || val.includes('ho va chu dem') || (val.includes('ho') && !val.includes('ten') && !val.includes('ngay'))) {
          colHoDem = c;
        } else if (val === 'ten' || val.includes('ten sinh vien') || val.includes('ten nguoi hoc')) {
          colTen = c;
        } else if (val.includes('so hieu') || val.includes('so van bang')) {
          colSoHieu = c;
        } else if (val.includes('so vao so') || val.includes('so quan ly')) {
          colSoSo = c;
        } else if (val.includes('ngay cap') || val.includes('ngay thang cap') || val.includes('ngay ky')) {
          colNgayCap = c;
        }
      }
      if (colMssv !== -1 && (colHoTen !== -1 || (colHoDem !== -1 && colTen !== -1))) break;
    }

    // Quét từng dòng dữ liệu từ dataStartRow
    for (let r = dataStartRow; r < data.length; r++) {
      const row = data[r];
      let rowMssv = colMssv !== -1 ? String(row[colMssv] || '').trim().toUpperCase() : '';
      
      // Fallback quét tất cả các cột nếu chưa map được
      if (!rowMssv) {
        for (let c = 0; c < row.length; c++) {
          if (String(row[c] || '').trim().toUpperCase() === targetMssv) {
            rowMssv = targetMssv;
            break;
          }
        }
      }

      if (rowMssv === targetMssv) {
        let fullName = '';
        if (colHoDem !== -1 && colTen !== -1) {
          fullName = (String(row[colHoDem] || '') + ' ' + String(row[colTen] || '')).trim();
        }
        if (!fullName && colHoTen !== -1) {
          fullName = String(row[colHoTen] || '').trim();
          if (colHoTen + 1 < row.length && !row[colHoTen + 1].toString().match(/\d/)) {
            const nextPart = String(row[colHoTen + 1] || '').trim();
            if (nextPart && nextPart.length <= 15) {
              fullName = (fullName + ' ' + nextPart).trim();
            }
          }
        }
        if (!fullName) {
          fullName = 'Sinh viên ' + targetMssv;
        }

        return {
          id: targetMssv + '_' + r,
          stt: row[colStt] || (r - dataStartRow + 1),
          soHieuChungChi: String(row[colSoHieu] || 'QP-' + targetMssv),
          soVaoSoGoc: String(row[colSoSo] || (r - dataStartRow + 1) + '/GDQP'),
          tenChungChi: 'Chứng chỉ Giáo dục Quốc phòng và An ninh',
          hoVaTen: fullName,
          mssv: targetMssv,
          ngaySinh: formatDate(row[colNgaySinh]),
          gioiTinh: String(row[colGioiTinh] || 'Nam'),
          ngayCap: formatDate(row[colNgayCap]) || '15/10/2025',
          donViCap: 'Trung tâm GDQP&AN - Đại học Cần Thơ',
          fileName: fileName
        };
      }
    }
  }
  return null;
}

/**
 * Tra cứu trong file Excel .xlsx bằng cách tạm convert hoặc parse
 */
function searchInExcelFile(file, targetMssv) {
  try {
    // Drive API v2/v3 convert tạm thời sang Google Sheet để đọc bằng SpreadsheetApp
    const tempFile = Drive.Files.copy({
      title: 'TEMP_READ_' + file.getName(),
      parents: [{ id: file.getParents().next().getId() }]
    }, file.getId(), { convert: true });

    const result = searchInGoogleSheet(tempFile.id, targetMssv, file.getName());

    // Xóa file tạm ngay sau khi tra cứu
    DriveApp.getFileById(tempFile.id).setTrashed(true);
    return result;
  } catch (e) {
    // Nếu Drive API nâng cao chưa bật, log lỗi
    Logger.log('Không thể convert xlsx: ' + e.toString());
    return null;
  }
}

function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    const d = ('0' + val.getDate()).slice(-2);
    const m = ('0' + (val.getMonth() + 1)).slice(-2);
    const y = val.getFullYear();
    return d + '/' + m + '/' + y;
  }
  return String(val);
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

export const DEPLOYMENT_STEPS = [
  {
    step: 1,
    title: 'Triển khai Google Apps Script Web App (Khuyên dùng)',
    description:
      'Chạy backend API miễn phí trực tiếp từ Google Drive của bạn. Sinh viên tra cứu cực nhanh mà không cần tài khoản hay quyền xem file gốc.',
    instructions: [
      'Mở https://script.google.com/home và bấm "Dự án mới" (New Project).',
      'Sao chép toàn bộ mã nguồn script bên dưới và dán thay thế trong file Code.gs.',
      'Bấm "Triển khai" (Deploy) -> "Triển khai mới" (New deployment).',
      'Chọn loại: "Ứng dụng web" (Web app).',
      'Thực thi dưới dạng: "Tôi" (Execute as Me).',
      'Ai có quyền truy cập: "Bất kỳ ai" (Anyone - để sinh viên tra cứu công khai).',
      'Bấm Triển khai, chấp nhận cấp quyền đọc Google Drive, sau đó copy Web App URL.',
      'Dán URL vào nút "Cấu hình nguồn dữ liệu" trên trang web này.',
    ],
  },
  {
    step: 2,
    title: 'Triển khai Frontend lên Vercel',
    description: 'Chỉ mất 2 phút để đưa giao diện tra cứu lên tên miền riêng hoặc .vercel.app miễn phí.',
    instructions: [
      'Đẩy mã nguồn dự án lên GitHub repository cá nhân.',
      'Truy cập https://vercel.com, đăng nhập và bấm "Add New..." -> "Project".',
      'Chọn repo vừa tải lên, Framework Preset: Vite.',
      'Bấm "Deploy" để hệ thống tự động build và cấp domain HTTPS miễn phí.',
      'Chia sẻ đường link cho sinh viên để tra cứu trên điện thoại.',
    ],
  },
  {
    step: 3,
    title: 'Triển khai lên Netlify',
    description: 'Kéo thả thư mục bản build dist/ hoặc kết nối GitHub.',
    instructions: [
      'Chạy lệnh `npm run build` để xuất thư mục `dist`.',
      'Truy cập https://app.netlify.com/drop và kéo thả thư mục `dist` vào trình duyệt.',
      'Netlify cấp ngay đường link hoạt động 100% không cần cấu hình thêm.',
    ],
  },
];
