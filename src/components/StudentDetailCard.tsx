import React from 'react';
import { 
  User, 
  Calendar, 
  FileText, 
  Bookmark, 
  GraduationCap, 
  Building2, 
  CheckCircle2, 
  Shield, 
  Info, 
  Tag, 
  MapPin, 
  Users, 
  BookOpen, 
  Briefcase, 
  Award,
  Layers
} from 'lucide-react';
import { CertificateRecord } from '../types/certificate';

interface StudentDetailCardProps {
  record: CertificateRecord;
}

export const StudentDetailCard: React.FC<StudentDetailCardProps> = ({ record }) => {
  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/80">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 mb-6 gap-2">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              THÔNG TIN CHI TIẾT SINH VIÊN &amp; CHỨNG CHỈ
            </h3>
            <p className="text-xs text-slate-500">
              Dữ liệu đối soát đầy đủ 11 trường thông tin theo hồ sơ sổ gốc cấp phát văn bằng GDQP&amp;AN
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Đã kiểm chứng hồ sơ
        </span>
      </div>

      {/* Grid of 11 Student & Certificate Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* 1. Họ và tên người học */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 hover:bg-slate-50 transition-colors">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <User className="w-4 h-4 text-emerald-600" />
            Họ và tên người học
          </div>
          <div className="text-lg font-bold text-slate-900 tracking-tight">
            {record.hoVaTen}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <span>Giới tính: <strong className="text-slate-700">{record.gioiTinh || 'Nam'}</strong></span>
            {record.danToc && (
              <span>• Dân tộc: <strong className="text-slate-700">{record.danToc}</strong></span>
            )}
          </div>
        </div>

        {/* 2. Mã người học (MSSV) */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 hover:bg-slate-50 transition-colors">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-emerald-600" />
            Mã người học (MSSV)
          </div>
          <div className="text-xl font-mono font-black text-emerald-800 tracking-wider">
            {record.mssv}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Khóa: <span className="font-semibold text-slate-700">{record.khoaHoc || 'Đào tạo chính quy'}</span>
          </div>
        </div>

        {/* 3. Ngày sinh */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 hover:bg-slate-50 transition-colors">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-600" />
            Ngày Sinh
          </div>
          <div className="text-lg font-mono font-bold text-slate-900">
            {record.ngaySinh || 'Chưa cập nhật'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Khớp với CCCD / giấy khai sinh
          </div>
        </div>

        {/* 4. Nơi sinh */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 hover:bg-slate-50 transition-colors">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-emerald-600" />
            Nơi sinh
          </div>
          <div className="text-lg font-bold text-slate-900">
            {record.noiSinh || 'Theo hồ sơ nhập học'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Tỉnh / Thành phố nơi sinh
          </div>
        </div>

        {/* 5. Giới tính & 6. Dân tộc */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 hover:bg-slate-50 transition-colors">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-emerald-600" />
            Giới tính &amp; Dân tộc
          </div>
          <div className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>{record.gioiTinh || 'Nam'}</span>
            <span className="text-slate-300">/</span>
            <span className="text-emerald-700">{record.danToc || 'Kinh'}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Nhân thân người học
          </div>
        </div>

        {/* 7. Khóa đào tạo */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 hover:bg-slate-50 transition-colors">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-emerald-600" />
            Khóa đào tạo
          </div>
          <div className="text-lg font-bold text-slate-900">
            {record.khoaHoc || 'Khóa chính quy'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Niên khóa sinh viên theo học
          </div>
        </div>

        {/* 8. Ngành đào tạo */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 hover:bg-slate-50 transition-colors">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Briefcase className="w-4 h-4 text-emerald-600" />
            Ngành đào tạo
          </div>
          <div className="text-base font-bold text-slate-900 leading-snug">
            {record.nganhDaoTao || 'Đại học Cần Thơ'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Chuyên ngành bậc đại học
          </div>
        </div>

        {/* 9. Xếp loại kết quả */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 hover:bg-slate-50 transition-colors">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-emerald-600" />
            Xếp loại / Điểm thi
          </div>
          <div className="text-lg font-bold text-emerald-700">
            {record.xepLoai || 'Đạt yêu cầu'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Kết quả học tập GDQP&amp;AN
          </div>
        </div>

        {/* 10. Số hiệu chứng chỉ (Số VB) */}
        <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-200/70 hover:bg-amber-50 transition-colors">
          <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-amber-600" />
            Số hiệu chứng chỉ (Số VB)
          </div>
          <div className="text-lg font-mono font-black text-amber-900 tracking-wider">
            {record.soHieuChungChi}
          </div>
          <div className="text-xs text-amber-700 mt-1">
            Số phôi in trực tiếp trên chứng chỉ
          </div>
        </div>

        {/* 11. Số vào sổ gốc (Số quản lý) */}
        <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-200/70 hover:bg-emerald-50 transition-colors">
          <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Bookmark className="w-4 h-4 text-emerald-600" />
            Số vào sổ gốc (Số quản lý)
          </div>
          <div className="text-lg font-mono font-black text-emerald-900 tracking-wider">
            {record.soVaoSoGoc}
          </div>
          <div className="text-xs text-emerald-700 mt-1">
            Lưu tại sổ bộ GDQP trường / trung tâm
          </div>
        </div>

        {/* Ngày cấp & STT */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 hover:bg-slate-50 transition-colors">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-600" />
            Ngày cấp / STT rút bằng
          </div>
          <div className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>STT: <strong className="font-mono text-amber-600">{record.stt}</strong></span>
            {record.ngayCap && (
              <>
                <span className="text-slate-300">•</span>
                <span className="font-mono text-emerald-700">{record.ngayCap}</span>
              </>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Thời điểm ban hành văn bằng
          </div>
        </div>
      </div>

      {/* Footer: Certificate Name, Issuing Unit & Excel Source */}
      <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-slate-600 bg-slate-50/50 -mx-6 -mb-6 p-6 rounded-b-3xl">
        <div className="flex items-start space-x-2">
          <Building2 className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-slate-800">
              {record.tenChungChi || 'Chứng chỉ Giáo dục Quốc phòng và An ninh'}
            </div>
            <div className="text-slate-500">
              Đơn vị cấp: <span className="text-slate-700">{record.donViCap || 'Trung tâm Giáo dục Quốc phòng và An ninh - Đại học Cần Thơ'}</span>
            </div>
          </div>
        </div>

        {record.fileName && (
          <div className="flex items-center space-x-1.5 text-slate-500 text-[11px] bg-white px-3 py-1.5 rounded-lg border border-slate-200">
            <Info className="w-3.5 h-3.5 text-emerald-600" />
            <span>Nguồn file:</span>
            <span className="font-mono text-slate-700 font-medium">{record.fileName}</span>
          </div>
        )}
      </div>
    </div>
  );
};
