import React, { useState, useEffect } from 'react';

export interface GhostiBrandLogoProps {
  /** 'desktop' (기본: 36x36px 아이콘) | 'mobile' (32x32px 아이콘) | 'modal' (모달 상단용) */
  size?: 'desktop' | 'mobile' | 'modal';
  /** 'light' | 'dark' 테마 (미지정 시 테마 자동 적응) */
  themeMode?: 'light' | 'dark';
  /** 호환성 유지용 배지 */
  showBadge?: boolean;
  /** 호환성 유지용 배지 텍스트 */
  badgeText?: string;
  /** 하위 호환성용 subtitle 프로퍼티 (전달 시 sloganText로 사용) */
  subtitle?: string;
  /** 서브 슬로건 문구 (10초 교체 타이머 시 표출할 문구, 기본: '혼자 쓸 땐 귀신같이 찾고 치우고 고치고! 가족·팀과 함께 쓸 땐 귀신같이 공유하고!') */
  sloganText?: string;
  /** 슬로건 자동 롤링 활성화 여부 (기본 true) */
  autoCycle?: boolean;
  /** 슬로건 전환 주기 (밀리초, 기본: 10000ms = 10초) */
  cycleIntervalMs?: number;
  onClick?: () => void;
  className?: string;
}

/**
 * 『귀신같이』 공식 마스터 브랜드 로고 컴포넌트
 * - 심볼: 검정 갓+구슬 갓끈 아기귀신 앱 아이콘 (`/gwisinkachi_app_icon_512.png`), rounded-xl, shadow-md
 * - 메인 배치: 로고 심볼과 『귀신같이』 워드마크를 1단으로 시원하고 임팩트 있게 정렬
 * - 인터랙션: 10초 후 부드러운 페이드(Fade) 효과와 함께 '1초 AI 파일·영상 내용찾기' 슬로건으로 교체 표출
 */
export const GhostiBrandLogo: React.FC<GhostiBrandLogoProps> = ({
  size = 'desktop',
  themeMode,
  showBadge: _showBadge,
  badgeText: _badgeText,
  subtitle,
  sloganText = '1초 AI 파일·영상 내용찾기',
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

    // 10초마다 워드마크 ↔ 슬로건 교체 토글 (부드러운 크로스페이드 300ms)
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
  const symbolSizeClass = isMobile ? 'w-8 h-8' : 'w-9 h-9';
  const wordmarkHeightClass = isMobile ? 'h-[22px]' : 'h-[28px]';
  const sloganTextClass = isMobile ? 'text-[11px]' : 'text-[13px]';

  const sloganColorClass =
    themeMode === 'light'
      ? 'text-teal-700'
      : themeMode === 'dark'
      ? 'text-teal-300'
      : 'text-teal-700 dark:text-teal-300';

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
        className={`${symbolSizeClass} rounded-xl shadow-md border border-teal-500/25 object-cover shrink-0 transition-transform ${
          onClick ? 'group-hover:scale-[1.05]' : ''
        }`}
      />

      <div className="flex items-center h-9 min-w-0">
        <div
          className={`flex items-center transition-all duration-300 ease-in-out ${
            isFading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
        >
          {showSlogan && activeSlogan ? (
            <div className="flex items-center gap-1.5 py-0.5">
              <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-600 dark:text-teal-400 shrink-0">
                내용검색
              </span>
              <span
                className={`${sloganTextClass} font-extrabold tracking-tight ${sloganColorClass} whitespace-nowrap leading-none`}
              >
                {activeSlogan}
              </span>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
};
