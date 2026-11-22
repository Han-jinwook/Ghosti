import React from 'react';
import { silencePendingEnterGiggleOnLogoClick } from '../services/babyGhostSound';

export interface GhostiBrandLogoProps {
  size?: 'desktop' | 'mobile' | 'modal';
  showBadge?: boolean;
  badgeText?: string;
  subtitle?: string;
  sloganText?: string;
  autoCycle?: boolean;
  cycleIntervalMs?: number;
  onClick?: () => void;
  className?: string;
}

export const GhostiBrandLogo: React.FC<GhostiBrandLogoProps> = ({
  size = 'desktop',
  onClick,
  className = '',
}) => {
  const isMobile = size === 'mobile';
  const symbolSizeClass = isMobile ? 'w-7 h-7 sm:w-8 sm:h-8' : 'w-8 h-8';
  const wordmarkHeightClass = isMobile ? 'h-[19px] sm:h-[22px]' : 'h-[26px]';

  return (
    <div
      data-ghosti-brand-logo="true"
      onClick={() => {
        silencePendingEnterGiggleOnLogoClick();
        onClick?.();
      }}
      title="귀신같이"
      className={`inline-flex items-center ${isMobile ? 'gap-1.5' : 'gap-2'} shrink-0 select-none ${
        onClick ? 'cursor-pointer group' : ''
      } ${className}`}
    >
      <img
        src="/gwisinkachi_app_icon_512.png"
        alt="귀신같이"
        className={`${symbolSizeClass} rounded-lg border border-black/10 object-cover shrink-0`}
      />
      <div className="flex items-center leading-none shrink-0">
        <img
          src="/gwisinkachi_3d_wordmark_dark.png"
          alt="귀신같이"
          className={`${wordmarkHeightClass} w-auto object-contain`}
        />
      </div>
    </div>
  );
};
