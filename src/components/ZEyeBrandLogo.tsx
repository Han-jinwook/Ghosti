import React from 'react';

export interface ZEyeBrandLogoProps {
  /** 'desktop' (기본: w-8 h-8, text-xl) | 'mobile' (w-7 h-7, text-lg) | 'modal' (모달 상단용 컴팩트/강조) */
  size?: 'desktop' | 'mobile' | 'modal';
  /** 'light' | 'dark' 테마 (미지정 시 다크모드/라이트모드 클래스 자동 대응) */
  themeMode?: 'light' | 'dark';
  /** 우측 시그니처 캡슐 배지 ([👁️ AI 투시검색]) 표시 여부 (기본 true) */
  showBadge?: boolean;
  /** 배지 커스텀 문구 (기본 '👁️ AI 투시검색') */
  badgeText?: string;
  /** 모바일 등에서 하단 서브 캡션 노출 여부 */
  subtitle?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * 제트아이(Z-Eye) 공식 ‘스타일 A (글로벌 테크 정석)’ 마스터 브랜드 로고 컴포넌트
 * - 좌측 끝: 다크 네이비 스쿼클 안의 3D 민트·블루 글래스모피즘 Z + 조리개 렌즈 심볼 (`/logo-symbol.png`)
 * - 중앙: 영문 워드마크 **Z-Eye** (앞글자 Z는 네온 민트·블루 그라데이션, 뒤의 -Eye는 차콜/화이트 마감)
 * - 우측: 시그니처 캡슐 배지 (`👁️ AI 투시검색`, 툴팁 `제트아이 (Z-Eye) — AI 투시검색`)
 */
export const ZEyeBrandLogo: React.FC<ZEyeBrandLogoProps> = ({
  size = 'desktop',
  themeMode,
  showBadge = true,
  badgeText = '👁️ AI 투시검색',
  subtitle,
  onClick,
  className = '',
}) => {
  const isMobile = size === 'mobile';
  const symbolSizeClass = isMobile ? 'w-7 h-7' : 'w-8 h-8';
  const wordmarkSizeClass = isMobile ? 'text-lg' : 'text-xl';

  const eyeColorClass =
    themeMode === 'light'
      ? 'text-slate-900'
      : themeMode === 'dark'
      ? 'text-white'
      : 'text-slate-900 dark:text-white';

  return (
    <div
      onClick={onClick}
      title="제트아이 (Z-Eye) — AI 투시검색 & No-클라우드 라운지"
      className={`inline-flex items-center gap-2 select-none ${
        onClick ? 'cursor-pointer group' : ''
      } ${className}`}
    >
      <img
        src="/logo-symbol.png"
        alt="Z-Eye (제트아이)"
        className={`${symbolSizeClass} rounded-xl shadow-sm border border-slate-200/20 object-cover shrink-0 transition-transform ${
          onClick ? 'group-hover:scale-[1.03]' : ''
        }`}
      />

      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`font-extrabold tracking-tight ${wordmarkSizeClass} leading-none whitespace-nowrap`}
          >
            <span className="bg-gradient-to-r from-teal-500 to-blue-600 bg-clip-text text-transparent">
              Z
            </span>
            <span className={eyeColorClass}>-Eye</span>
          </span>

          {showBadge && (
            <span
              title="제트아이 (Z-Eye) — AI 투시검색"
              className="bg-teal-50 text-teal-700 border border-teal-200/80 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap leading-tight shadow-2xs"
            >
              {badgeText}
            </span>
          )}
        </div>

        {subtitle && (
          <span
            className={`text-[9.5px] leading-tight mt-0.5 truncate ${
              themeMode === 'light' ? 'text-slate-500' : 'text-zinc-400'
            }`}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};
