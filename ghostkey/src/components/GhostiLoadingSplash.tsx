import React, { useEffect, useState } from 'react';
import { playAppEnterGiggleSound } from '@shared/services/babyGhostSound';

/**
 * 『귀신Key (GhostKey)』 웹 첫 실행 시 초경량 웜라이트 로딩 스플래시 화면
 * - 0.3초(300ms) 노출 후 초고속 페이드아웃, 화면 클릭 시 즉시 닫힘
 */
export const GhostiLoadingSplash: React.FC = () => {
  const shouldSkipSplash = (() => {
    if (typeof window === 'undefined') return false;
    try {
      if (window.sessionStorage.getItem('ghostkey_splash_shown_v1') === '1') {
        return true;
      }
      window.sessionStorage.setItem('ghostkey_splash_shown_v1', '1');
    } catch {
      // ignore storage errors
    }
    return false;
  })();
  const [dismissed, setDismissed] = useState(shouldSkipSplash);
  const [unmounted, setUnmounted] = useState(shouldSkipSplash);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDismissed(true);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!dismissed) return;
    playAppEnterGiggleSound();
    const t = window.setTimeout(() => {
      setUnmounted(true);
    }, 150);
    return () => clearTimeout(t);
  }, [dismissed]);

  if (unmounted) return null;

  return (
    <div
      role="status"
      aria-label="귀신Key 로딩 스플래시 화면"
      onClick={() => {
        playAppEnterGiggleSound();
        setDismissed(true);
      }}
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center px-4 select-none cursor-pointer transition-opacity duration-150 ease-out bg-[#FAF9F5] ${
        dismissed ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-4">
        <img
          src="/ghostkey_app_icon_512.png"
          alt="귀신Key 아이콘"
          className="w-24 h-24 rounded-3xl shadow-xl border border-teal-500/20 object-cover"
          draggable={false}
        />
        <img
          src="/ghostkey_3d_wordmark_dark.png"
          alt="귀신Key (GhostKey)"
          className="h-11 w-auto object-contain"
          draggable={false}
        />
      </div>
    </div>
  );
};
