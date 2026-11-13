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
  Briefcase,
  Layers,
} from 'lucide-react';
import { CertificateRecord } from '../types/certificate';

interface StudentDetailCardProps {
  record: CertificateRecord;
}

export const StudentDetailCard: React.FC<StudentDetailCardProps> = ({ record }) => {
  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-lg border border-slate-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 mb-6 gap-2">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-[#004B8D] flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              HỒ SƠ CHI TIẾT NGƯỜI HỌC &amp; VĂN BẰNG
            </h3>
            <p className="text-xs text-slate-500">
              Dữ liệu đối chiếu chuẩn theo sổ gốc cấp phát chứng chỉ GDQP&amp;AN — Đại học Cần Thơ
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#004B8D] bg-blue-50 px-3 py-1 rounded-full border border-blue-200 self-start sm:self-auto">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#0066B3]" />
          Đã kiểm chứng hồ sơ
        </span>
      </div>

      {/* Grid of Student & Certificate Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* 1. Họ và tên người học */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 hover:bg-blue-50/30 transition-colors">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <User className="w-4 h-4 text-[#00529C]" />
            Họ và tên người học
          </div>
          <div className="text-lg font-bold text-slate-900 tracking-tight">
            {record.hoVaTen}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <span>
              Giới tính: <strong className="text-slate-700">{record.gioiTinh || 'Nam'}</strong>
            </span>
            {record.danToc && (
              <span>
                • Dân tộc: <strong className="text-slate-700">{record.danToc}</strong>
              </span>
            )}
          </div>
        </div>

        {/* 2. Mã người học (MSSV) */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 hover:bg-blue-50/30 transition-colors">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-[#00529C]" />
            Mã số sinh viên (MSSV)
          </div>
          <div className="text-xl font-mono font-black text-[#003B73] tracking-wider">
            {record.mssv}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Khóa: <span className="font-semibold text-slate-700">{record.khoaHoc || 'Đào tạo chính quy'}</span>
          </div>
        </div>

        {/* 3. Ngày sinh */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 hover:bg-blue-50/30 transition-colors">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-[#00529C]" />
            Ngày tháng năm sinh
          </div>
          <div className="text-lg font-mono font-bold text-slate-900">
            {record.ngaySinh || 'Chưa cập nhật'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Khớp với CCCD / hồ sơ gốc
          </div>
        </div>

        {/* 4. Nơi sinh */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 hover:bg-blue-50/30 transition-colors">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[#00529C]" />
            Nơi sinh
          </div>
          <div className="text-lg font-bold text-slate-900">
            {record.noiSinh || 'Theo hồ sơ nhập học'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Tỉnh / Thành phố nơi sinh
          </div>
        </div>

        {/* 5. Giới tính & Dân tộc */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 hover:bg-blue-50/30 transition-colors">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#00529C]" />
            Giới tính &amp; Dân tộc
          </div>
          <div className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>{record.gioiTinh || 'Nam'}</span>
            <span className="text-slate-300">/</span>
            <span className="text-[#004B8D]">{record.danToc || 'Kinh'}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Thông tin nhân thân người học
          </div>
        </div>

        {/* 6. Khóa đào tạo */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 hover:bg-blue-50/30 transition-colors">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#00529C]" />
            Khóa đào tạo
          </div>
          <div className="text-lg font-bold text-slate-900">
            {record.khoaHoc || 'Khóa chính quy'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Niên khóa sinh viên theo học
          </div>
        </div>

        {/* 7. Ngành đào tạo */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 hover:bg-blue-50/30 transition-colors">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Briefcase className="w-4 h-4 text-[#00529C]" />
            Ngành đào tạo
          </div>
          <div className="text-base font-bold text-slate-900 leading-snug">
            {record.nganhDaoTao || 'Đại học Cần Thơ'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Chuyên ngành bậc đại học
          </div>
        </div>

        {/* 8. Xếp loại kết quả */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 hover:bg-blue-50/30 transition-colors">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-[#00529C]" />
            Xếp loại / Kết quả
          </div>
          <div className="text-lg font-bold text-[#004B8D]">
            {record.xepLoai || 'Đạt yêu cầu'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Kết quả học tập GDQP&amp;AN
          </div>
        </div>

        {/* 9. Số hiệu văn bằng */}
        <div className="bg-blue-50/80 rounded-2xl p-4 border border-blue-200 hover:bg-blue-50 transition-colors">
          <div className="text-xs font-semibold text-[#003B73] uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-[#00529C]" />
            Số hiệu văn bằng
          </div>
          <div className="text-lg font-mono font-black text-[#002855] tracking-wider">
            {record.soHieuChungChi}
          </div>
          <div className="text-xs text-[#00529C] mt-1">
            Số phôi in trực tiếp trên chứng chỉ
          </div>
        </div>

        {/* 10. Số lưu vào sổ gốc */}
        <div className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200 hover:bg-amber-50 transition-colors">
          <div className="text-xs font-semibold text-amber-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Bookmark className="w-4 h-4 text-amber-600" />
            Số lưu vào sổ gốc
          </div>
          <div className="text-lg font-mono font-black text-amber-950 tracking-wider">
            {record.soVaoSoGoc}
          </div>
          <div className="text-xs text-amber-800 mt-1">
            Lưu giữ tại sổ gốc cấp chứng chỉ
          </div>
        </div>

        {/* 11. Ngày cấp & STT */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 hover:bg-blue-50/30 transition-colors">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-[#00529C]" />
            Ngày cấp / STT rút bằng
          </div>
          <div className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>
              STT: <strong className="font-mono text-amber-600">{record.stt}</strong>
            </span>
            {record.ngayCap && (
              <>
                <span className="text-slate-300">•</span>
                <span className="font-mono text-[#004B8D]">{record.ngayCap}</span>
              </>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Thời điểm / đợt ban hành chứng chỉ
          </div>
        </div>
      </div>

      {/* Footer: Certificate Name, Issuing Unit & Excel Source */}
      <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-slate-600 bg-slate-50 -mx-6 -mb-6 p-6 rounded-b-3xl">
        <div className="flex items-start space-x-2">
          <Building2 className="w-4 h-4 text-[#00529C] shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-slate-800">
              {record.tenChungChi || 'Chứng chỉ Giáo dục Quốc phòng và An ninh'}
            </div>
            <div className="text-slate-500">
              Đơn vị cấp:{' '}
              <span className="text-slate-700 font-medium">
                {record.donViCap || 'Trung tâm Giáo dục Quốc phòng và An ninh - Đại học Cần Thơ'}
              </span>
            </div>
          </div>
        </div>

        {record.fileName && (
          <div className="flex items-center space-x-1.5 text-slate-500 text-[11px] bg-white px-3 py-1.5 rounded-lg border border-slate-200">
            <Info className="w-3.5 h-3.5 text-[#00529C]" />
            <span>Nguồn file:</span>
            <span className="font-mono text-slate-700 font-medium">{record.fileName}</span>
          </div>
        )}
      </div>
    </div>
  );
};
