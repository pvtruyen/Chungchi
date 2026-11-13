import React, { useState } from 'react';
import { GraduationCap } from 'lucide-react';

interface CtuLogoProps {
  className?: string;
  sizeClass?: string;
  alt?: string;
}

export const CTU_LOGO_URL = 'https://www.ctu.edu.vn/images/branding/logo/CTU_logo.png';

export const CtuLogo: React.FC<CtuLogoProps> = ({
  className = '',
  sizeClass = 'w-11 h-11',
  alt = 'Logo Đại học Cần Thơ',
}) => {
  const [hasError, setHasError] = useState(false);

  return (
    <div
      className={`relative flex items-center justify-center rounded-xl bg-white p-1 shadow-sm border border-blue-200/80 shrink-0 overflow-hidden ${sizeClass} ${className}`}
    >
      {!hasError ? (
        <img
          src={CTU_LOGO_URL}
          alt={alt}
          className="w-full h-full object-contain"
          loading="eager"
          decoding="async"
          onError={() => setHasError(true)}
        />
      ) : (
        <div
          className="w-full h-full rounded-lg bg-[#003B73] text-white flex flex-col items-center justify-center"
          aria-label={alt}
        >
          <GraduationCap className="w-5 h-5 text-amber-300" />
          <span className="text-[8px] font-black tracking-tighter leading-none mt-0.5">CTU</span>
        </div>
      )}
    </div>
  );
};
