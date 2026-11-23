import React, { useEffect, useState } from 'react';
import { playAppEnterGiggleSound } from '../services/babyGhostSound';

/**
 * 🌟 『귀신같이』 앱/웹 첫 실행 시 로딩 스플래시 화면
 * - 마스터 아트워크(/gwisinkachi_splash_master.jpg)를 딥 네이비(#070424 ~ #13254b) 배경과 무경계로 일체화
 * - 멀린님 지침: 순식간에 스쳐 지나가는 귀신처럼 0.3초(300ms) 노출 후 초고속 페이드아웃
 * - 화면 아무 곳이나 클릭 시 즉시 닫힘
 */
export const GhostiLoadingSplash: React.FC = () => {
  const shouldSkipSplash = (() => {
    if (typeof window === 'undefined') return false;
    if (
      window.location.search.includes('ghostSearchWindow=') ||
      window.location.search.includes('tab=search_dojo')
    ) {
      return true;
    }
    try {
      // 위로 당겨서 새로고침(Pull-to-refresh) 또는 세션 내 재로드 시에는 전체화면 로고 이미지가 다시 뜨지 않도록 차단
      if (window.sessionStorage.getItem('ghosti_splash_shown_v1') === '1') {
        return true;
      }
      window.sessionStorage.setItem('ghosti_splash_shown_v1', '1');
    } catch {
      // ignore storage errors
    }
    return false;
  })();
  const [dismissed, setDismissed] = useState(shouldSkipSplash);
  const [unmounted, setUnmounted] = useState(shouldSkipSplash);

  useEffect(() => {
    // 0.3초(300ms) 후 순식간에 페이드아웃 진입 + 어떠한 예외 상황에서도 1.2초 내 강제 언마운트 보장
    const timer = window.setTimeout(() => {
      setDismissed(true);
    }, 300);
    const hardUnmountTimer = window.setTimeout(() => {
      setDismissed(true);
      setUnmounted(true);
    }, 1200);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(hardUnmountTimer);
    };
  }, []);

  useEffect(() => {
    if (!dismissed) return;
    try {
      playAppEnterGiggleSound();
    } catch {
      /* ignore audio autoplay/WebView errors so splash always unmounts */
    }
    const t = window.setTimeout(() => {
      setUnmounted(true);
    }, 150);
    return () => window.clearTimeout(t);
  }, [dismissed]);

  if (unmounted) return null;

  return (
    <div
      role="status"
      aria-label="귀신같이 로딩 스플래시 화면"
      onClick={() => { playAppEnterGiggleSound(); setDismissed(true); }}
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center px-4 select-none cursor-pointer transition-opacity duration-150 ease-out ${
        dismissed ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        background:
          'radial-gradient(circle at 50% 46%, #13254b 0%, #0b1331 52%, #070424 100%)',
      }}
    >
      {/* 메인 스플래시 일러스트 & 3D 『귀신같이』 로고 */}
      <div className="relative w-full max-w-[680px] flex flex-col items-center">
        <div className="relative w-full overflow-hidden rounded-3xl shadow-[0_0_80px_rgba(45,212,191,0.18)]">
          <img
            src="/gwisinkachi_splash_master.jpg"
            alt="귀신같이 — 1초 AI 파일·영상 찾기 및 용량청소"
            className="w-full h-auto object-contain block mx-auto"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
};
