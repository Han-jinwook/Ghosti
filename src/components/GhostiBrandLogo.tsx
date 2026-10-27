import React from 'react';

export interface GhostiBrandLogoProps {
  /** 'desktop' (기본: 36x36px 아이콘) | 'mobile' (32x32px 아이콘) | 'modal' (모달 상단용) */
  size?: 'desktop' | 'mobile' | 'modal';
  /** 'light' | 'dark' 테마 (미지정 시 테마 자동 적응) */
  themeMode?: 'light' | 'dark';
  /** 호환성 유지용 배지 */
  showBadge?: boolean;
  /** 호환성 유지용 배지 텍스트 */
  badgeText?: string;
  /** 서브 타이틀 문구 (기본: '1초 AI 파일·영상 내용찾기') */
  subtitle?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * 『귀신같이』 공식 마스터 브랜드 로고 컴포넌트
 * - 심볼: 검정 갓+구슬 갓끈 아기귀신 앱 아이콘 (`/gwisinkachi_app_icon_512.png`), rounded-xl, shadow-md
 * - 1단 (메인 간판): 『귀신같이』 먹물 연기 붓글씨 캘리그라피 워드마크
 *   - 라이트 모드: `/gwisinkachi_smoke_wordmark_dark.png`
 *   - 다크 모드: `/gwisinkachi_smoke_wordmark_light.png`
 * - 2단 (서브 슬로건): 1초 AI 파일·영상 내용찾기 (text-[11px] font-bold tracking-tight text-teal-600/95 dark:text-teal-400/95)
 */
export const GhostiBrandLogo: React.FC<GhostiBrandLogoProps> = ({
  size = 'desktop',
  themeMode,
  showBadge: _showBadge,
  badgeText: _badgeText,
  subtitle = '1초 AI 파일·영상 내용찾기',
  onClick,
  className = '',
}) => {
  const isMobile = size === 'mobile';
  const symbolSizeClass = isMobile ? 'w-8 h-8' : 'w-9 h-9';
  const wordmarkHeightClass = isMobile ? 'h-[22px]' : 'h-[26px]';
  const subtitleSizeClass = isMobile ? 'text-[10px]' : 'text-[11px]';

  const subColorClass =
    themeMode === 'light'
      ? 'text-teal-600/95'
      : themeMode === 'dark'
      ? 'text-teal-400/95'
      : 'text-teal-600/95 dark:text-teal-400/95';

  return (
    <div
      onClick={onClick}
      title="귀신같이 — 1초 AI 파일·영상 내용찾기"
      className={`inline-flex items-center gap-2.5 select-none ${
        onClick ? 'cursor-pointer group' : ''
      } ${className}`}
    >
      <img
        src="/gwisinkachi_app_icon_512.png"
        alt="귀신같이"
        className={`${symbolSizeClass} rounded-xl shadow-md border border-teal-500/20 object-cover shrink-0 transition-transform ${
          onClick ? 'group-hover:scale-[1.04]' : ''
        }`}
      />

      <div className="flex flex-col justify-center min-w-0">
        <div className="flex items-center leading-none">
          {themeMode === 'light' ? (
            <img
              src="/gwisinkachi_smoke_wordmark_dark.png"
              alt="귀신같이"
              className={`${wordmarkHeightClass} w-auto object-contain`}
            />
          ) : themeMode === 'dark' ? (
            <img
              src="/gwisinkachi_smoke_wordmark_light.png"
              alt="귀신같이"
              className={`${wordmarkHeightClass} w-auto object-contain`}
            />
          ) : (
            <>
              {/* 시스템/테마 자동 적응: 라이트/다크 분기 */}
              <img
                src="/gwisinkachi_smoke_wordmark_dark.png"
                alt="귀신같이"
                className={`${wordmarkHeightClass} w-auto object-contain block dark:hidden`}
              />
              <img
                src="/gwisinkachi_smoke_wordmark_light.png"
                alt="귀신같이"
                className={`${wordmarkHeightClass} w-auto object-contain hidden dark:block`}
              />
            </>
          )}
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
