import React from 'react';

export interface ZEyeBrandLogoProps {
  /** 'desktop' (기본: 36x36px 아이콘) | 'mobile' (32x32px 아이콘) | 'modal' (모달 상단용) */
  size?: 'desktop' | 'mobile' | 'modal';
  /** 'light' | 'dark' 테마 (미지정 시 테마 자동 적응) */
  themeMode?: 'light' | 'dark';
  /** 호환성 유지용 (새 디자인에서는 알약 배지를 일체형 서브타이틀로 자동 통합) */
  showBadge?: boolean;
  /** 호환성 유지용 배지 텍스트 */
  badgeText?: string;
  /** 서브 타이틀 문구 (기본: '1초 AI 파일·영상 내용검색') */
  subtitle?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * 제트아이(Z-Eye) 공식 마스터 브랜드 로고 컴포넌트
 * - 좌측: 36x36px (w-9 h-9) 스쿼클 3D 민트·블루 Z 렌즈 심볼 (`/logo-symbol.png`), rounded-xl, shadow-md
 * - 우측 텍스트 블록: flex flex-col justify-center
 *   - 1단 (메인 브랜드명): Z-Eye (두께감 있는 text-[22px] font-black tracking-tighter leading-none, Z는 선명한 text-teal-600 또는 네온 그라데이션)
 *   - 2단 (마이크로 서브 슬로건): 1초 AI 파일·영상 내용검색 (text-[11px] font-bold tracking-tight text-teal-600/90 leading-none mt-1)
 * - 전체 높이와 36px 심볼이 하나의 그래픽 로고처럼 일체화
 */
export const ZEyeBrandLogo: React.FC<ZEyeBrandLogoProps> = ({
  size = 'desktop',
  themeMode,
  showBadge: _showBadge,
  badgeText: _badgeText,
  subtitle = '1초 AI 파일·영상 내용검색',
  onClick,
  className = '',
}) => {
  const isMobile = size === 'mobile';
  const symbolSizeClass = isMobile ? 'w-8 h-8' : 'w-9 h-9';
  const wordmarkSizeClass = isMobile ? 'text-[19px]' : 'text-[22px]';
  const subtitleSizeClass = isMobile ? 'text-[10px]' : 'text-[11px]';

  const eyeColorClass =
    themeMode === 'light'
      ? 'text-slate-900'
      : themeMode === 'dark'
      ? 'text-white'
      : 'text-slate-900 dark:text-white';

  const subColorClass =
    themeMode === 'light'
      ? 'text-teal-600/95'
      : themeMode === 'dark'
      ? 'text-teal-400/95'
      : 'text-teal-600/95 dark:text-teal-400/95';

  return (
    <div
      onClick={onClick}
      title="제트아이 (Z-Eye) — 1초 AI 파일·영상 내용검색"
      className={`inline-flex items-center gap-3 select-none ${
        onClick ? 'cursor-pointer group' : ''
      } ${className}`}
    >
      <img
        src="/logo-symbol.png"
        alt="Z-Eye (제트아이)"
        className={`${symbolSizeClass} rounded-xl shadow-md border border-teal-500/20 object-cover shrink-0 transition-transform ${
          onClick ? 'group-hover:scale-[1.03]' : ''
        }`}
      />

      <div className="flex flex-col justify-center min-w-0">
        <div className="flex items-center leading-none">
          <span
            className={`font-black tracking-tighter ${wordmarkSizeClass} leading-none whitespace-nowrap`}
          >
            <span className="text-teal-500 dark:text-teal-400">
              Z
            </span>
            <span className={eyeColorClass}>-Eye</span>
          </span>
        </div>

        {subtitle && (
          <span
            className={`${subtitleSizeClass} font-bold tracking-tight ${subColorClass} leading-none mt-1 whitespace-nowrap truncate`}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};
