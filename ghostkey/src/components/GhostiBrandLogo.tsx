import React, { useState, useEffect } from 'react';
import { silencePendingEnterGiggleOnLogoClick } from '@shared/services/babyGhostSound';

export interface GhostiBrandLogoProps {
  size?: 'desktop' | 'mobile' | 'modal';
  themeMode?: 'light' | 'dark';
  showBadge?: boolean;
  badgeText?: string;
  subtitle?: string;
  sloganText?: string;
  autoCycle?: boolean;
  cycleIntervalMs?: number;
  onClick?: () => void;
  className?: string;
}

/**
 * 『귀신Key (GhostKey)』 공식 마스터 브랜드 로고 컴포넌트
 * - '귀신' 한글 타이포 + 민트 입체 키캡 '[Key]' 포인트 디자인
 */
export const GhostiBrandLogo: React.FC<GhostiBrandLogoProps> = ({
  size = 'desktop',
  themeMode,
  subtitle,
  sloganText = '한영오타 · 순차복붙 · 상용구',
  autoCycle = true,
  cycleIntervalMs = 10000,
  onClick,
  className = '',
}) => {
  const activeSlogan = subtitle !== undefined ? subtitle : sloganText;
  const shouldCycle = autoCycle && Boolean(activeSlogan);

  const [showSlogan, setShowSlogan] = useState(false);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (!shouldCycle) return;
    const timer = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setShowSlogan((prev) => !prev);
        setIsFading(false);
      }, 300);
    }, cycleIntervalMs);
    return () => clearInterval(timer);
  }, [shouldCycle, cycleIntervalMs]);

  const isMobile = size === 'mobile';
  const symbolSizeClass = isMobile ? 'w-7 h-7 sm:w-9 sm:h-9' : 'w-[42px] h-[42px]';
  const slotWidthClass = shouldCycle
    ? isMobile
      ? 'min-w-[118px] sm:min-w-[126px]'
      : 'min-w-[138px]'
    : 'w-auto';

  const sloganColorClass = 'text-teal-700';

  return (
    <div
      data-ghosti-brand-logo="true"
      onClick={() => {
        silencePendingEnterGiggleOnLogoClick();
        onClick?.();
      }}
      title="귀신Key (GhostKey) — Ctrl+0 1초 복붙·오타 치트키"
      className={`inline-flex items-center ${isMobile ? 'gap-1.5 sm:gap-2' : 'gap-2.5'} shrink-0 select-none ${
        onClick ? 'cursor-pointer group' : ''
      } ${className}`}
    >
      <img
        src="/ghostkey_app_icon_512.png"
        alt="귀신Key"
        className={`${symbolSizeClass} rounded-xl shadow-md border border-teal-500/25 object-cover shrink-0 transition-transform ${
          onClick ? 'group-hover:scale-[1.05]' : ''
        }`}
      />

      <div
        className={`relative flex items-center ${
          isMobile ? 'min-h-[30px] sm:min-h-[38px]' : 'min-h-[42px]'
        } ${slotWidthClass} shrink-0`}
      >
        <div
          className={`w-full flex items-center transition-all duration-300 ease-in-out ${
            isFading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
        >
          {showSlogan && activeSlogan ? (
            <div className="w-full flex flex-col justify-center gap-0.5 leading-tight">
              <div className="flex items-center gap-1">
                <span className="text-[9.5px] font-extrabold px-1 py-0.2 rounded bg-teal-500/15 text-teal-600 dark:text-teal-400 shrink-0">
                  Ctrl+0
                </span>
                <span className={`text-[11px] font-extrabold tracking-tight ${sloganColorClass} whitespace-nowrap`}>
                  1초 복붙 치트키
                </span>
              </div>
              <span className={`text-[10px] font-bold tracking-tight opacity-85 ${sloganColorClass} whitespace-nowrap pl-0.5`}>
                {activeSlogan}
              </span>
            </div>
          ) : (
            <img
              src="/ghostkey_3d_wordmark_dark.png"
              alt="귀신Key"
              className={`${isMobile ? 'h-[28px] sm:h-[36px]' : 'h-[40px]'} w-auto object-contain shrink-0`}
            />
          )}
        </div>
      </div>
    </div>
  );
};
