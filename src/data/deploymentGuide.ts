export const DEPLOYMENT_STEPS = [
  {
    step: 1,
    title: 'Kết nối Cloud Firestore & Nạp Excel cộng dồn',
    description:
      'Ứng dụng tự động kết nối sẵn cơ sở dữ liệu Cloud Firestore và cho phép thay cấu hình dự án riêng ngay trên giao diện Admin.',
    instructions: [
      'Đăng nhập mục "Cài đặt Kết nối (Admin)" trên thanh tiêu đề bằng tài khoản Firebase Admin hoặc mã PIN quản trị.',
      'Mở tab "1. Cài đặt Firebase" nếu cần dán nguyên đoạn mã firebaseConfig của dự án cá nhân và bấm "Kết nối & Lưu".',
      'Chuyển sang tab "2. Nạp Excel (Cộng dồn)" để kéo thả các file .xlsx/.xls — dữ liệu tự động nối tiếp lên Cloud Firestore.',
    ],
  },
  {
    step: 2,
    title: 'Theo dõi Lịch sử Phát bằng bằng Mã PIN Quản trị',
    description:
      'Cán bộ tại bàn phát bằng chỉ cần nhập mã PIN quản trị (không cần đăng nhập tài khoản Firebase Admin) để xem lịch sử tra cứu và đánh dấu Đã phát bằng.',
    instructions: [
      'Nhấn nút "Lịch sử phát bằng" trên thanh tiêu đề và nhập mã PIN quản trị.',
      'Theo dõi danh sách sinh viên tra cứu theo thời gian thực và nhấn nút "Chờ Phát Bằng" để xác nhận "Đã Phát Bằng".',
      'Có thể xuất file Excel (.xlsx) báo cáo tình hình cấp phát chứng chỉ bất cứ lúc nào.',
    ],
  },
];
