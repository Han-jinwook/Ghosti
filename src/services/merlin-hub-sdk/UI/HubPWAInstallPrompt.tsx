/**
 * Version: v3.1.0
 * Last Updated: 2026-10-30
 * Merlin Hub SDK — PWA 바로가기 수동 추가 시스템 & 아이폰 카페/사파리/카톡 1:1 맞춤 그래픽 가이드 카드
 * - [v3.1.0] 페이지 진입 시 화면을 가로막던 0.8초 강제 자동 팝업 완전 폐지 (이미 바탕화면에 설치한 회원에게도 반복 노출되던 불편 원천 근절)
 * - [v3.1.0] 기설치자(standalone 구동 이력 / getInstalledRelatedApps / appinstalled) localStorage 영구 감지 및 수동 설치 버튼(triggerPWAInstall) 전용화
 */
'use client';

import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// 모바일 기기 감지 유틸리티
const checkIsMobile = () => {
  if (typeof window === 'undefined') return false;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isMobileScreen = window.innerWidth <= 768;
  return isMobileUA && isMobileScreen;
};

// 독립 PWA 구동 여부 감지 (아이콘으로 실행 중인지)
const checkIsStandalone = () => {
  if (typeof window === 'undefined') return false;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  if (isStandalone) {
    try {
      localStorage.setItem('pwa-installed', 'true');
    } catch {}
  }
  return isStandalone;
};

// 전역 PWA 설치 이벤트 캐시
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
  });
}

/**
 * 1. [상시 설치 진입로] 모바일 브라우저 전용 심플 버튼 (마이페이지/메뉴 내부 배치용)
 */
export function HubPWAInstallButton({ className = '' }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsMobile(checkIsMobile());
    setIsStandalone(checkIsStandalone());
  }, []);

  if (!mounted || !isMobile || isStandalone) {
    return null; // PC 환경이거나 이미 앱(standalone)으로 실행 중이면 숨김
  }

  const handleManualInstall = () => {
    window.dispatchEvent(new Event('triggerPWAInstall'));
  };

  return (
    <button
      type="button"
      onClick={handleManualInstall}
      className={`w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-indigo-50/70 dark:bg-slate-800/70 border border-indigo-200/80 dark:border-slate-700 hover:bg-indigo-100/70 transition-all group cursor-pointer text-left ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-primary text-white flex items-center justify-center font-black shadow-xs shrink-0">
          📱
        </div>
        <div>
          <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
            홈 화면에 바로가기 추가
          </p>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
            스마트폰 홈 화면에서 터치 한 번으로 바로 열기
          </p>
        </div>
      </div>
      <span className="text-[11px] sm:text-xs font-bold text-brand-primary bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-slate-700 shadow-2xs shrink-0">
        추가 ⚡
      </span>
    </button>
  );
}

/**
 * 2. [PWA 수동 설치 유도 시스템]
 * - 카페 공지 링크 등으로 웹 진입 시 화면을 가로막는 자동 팝업을 띄우지 않음 (수동 버튼 클릭 시에만 작동)
 * - 안드로이드: 네이티브 즉시 추가 또는 하단 설치 안내 배너
 * - 아이폰: 화면 상단 슬림 가이드 카드 (카페/사파리/카톡 1:1 맞춤 그래픽)
 */
export function HubPWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isIosGuideOpen, setIsIosGuideOpen] = useState(false);
  const [inAppType, setInAppType] = useState<'naver' | 'kakao' | 'safari' | 'generic'>('generic');

  useEffect(() => {
    const search = window.location.search;
    const isExplicitGuideMode = search.includes('install=1') || search.includes('guide=');

    if (checkIsStandalone()) {
      setIsInstalled(true);
      return;
    }

    if (!isExplicitGuideMode && !checkIsMobile()) {
      return;
    }

    // 기설치 이력 및 Related Apps 비동기 확인
    try {
      if (localStorage.getItem('pwa-installed') === 'true') {
        setIsInstalled(true);
      }
      if (typeof navigator !== 'undefined' && 'getInstalledRelatedApps' in navigator) {
        (navigator as any)
          .getInstalledRelatedApps()
          .then((apps: any[]) => {
            if (Array.isArray(apps) && apps.length > 0) {
              localStorage.setItem('pwa-installed', 'true');
              setIsInstalled(true);
              setShowInstallPrompt(false);
            }
          })
          .catch(() => {});
      }
    } catch {}

    const ua = navigator.userAgent || '';
    const isAppleIOS = (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) || search.includes('ios');
    setIsIOS(isAppleIOS);

    // 네이버 카페 / 네이버 앱 / 카카오톡 등 인앱 브라우저 정밀 감지
    const isNaverCafe = /naver.*cafe|navercafe/i.test(ua);
    const isNaver = /NAVER/i.test(ua);
    const isKakao = /KAKAOTALK|kakaowork/i.test(ua);
    const inApp = isNaverCafe || isNaver || isKakao || /Instagram|FB_IAB|Line/i.test(ua);
    setIsInAppBrowser(inApp);

    // 환경별 1:1 맞춤 그래픽 분기 (네이버 카페 1순위)
    if (search.includes('inapp=naver') || search.includes('guide=cafe') || isNaverCafe || isNaver) {
      setInAppType('naver');
    } else if (search.includes('inapp=kakao') || search.includes('guide=kakao') || isKakao) {
      setInAppType('kakao');
    } else if (search.includes('inapp=safari') || search.includes('guide=safari') || (!inApp && isAppleIOS)) {
      setInAppType('safari');
    } else {
      setInAppType('generic');
    }

    // 명시적 가이드 URL 파라미터(?install=1 등)로 진입한 경우에만 오픈 (일반 링크 진입 시 자동 팝업 없음)
    if (isExplicitGuideMode) {
      if (isAppleIOS) {
        setIsIosGuideOpen(true);
      } else {
        setShowInstallPrompt(true);
      }
    }

    // 안드로이드 네이티브 PWA 설치 이벤트 캐시 (수동 버튼 클릭 시 즉시 활용)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      globalDeferredPrompt = e as BeforeInstallPromptEvent;
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setIsIosGuideOpen(false);
      setDeferredPrompt(null);
      globalDeferredPrompt = null;
      try {
        localStorage.setItem('pwa-installed', 'true');
        localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
      } catch {}
    };

    // 상시 설치 버튼(HubPWAInstallButton) 등 사용자의 명시적 수동 트리거 수신
    const handleExternalTrigger = () => {
      if (isAppleIOS) {
        setIsIosGuideOpen(true);
      } else {
        setShowInstallPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('triggerPWAInstall', handleExternalTrigger);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('triggerPWAInstall', handleExternalTrigger);
    };
  }, []);

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    setIsIosGuideOpen(false);
    try {
      sessionStorage.setItem('pwa-prompt-dismissed', '1');
      localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
    } catch {}
  };

  const handleAndroidInstallClick = async () => {
    if (isInAppBrowser) {
      // 안드로이드 인앱브라우저: 기설치 PWA 또는 기본 브라우저로 즉시 외부 연결
      const cleanHost = window.location.host;
      const cleanPath = window.location.pathname + window.location.search + window.location.hash;
      const fallbackUrl = encodeURIComponent(window.location.href);
      window.location.href = `intent://${cleanHost}${cleanPath}#Intent;scheme=https;S.browser_fallback_url=${fallbackUrl};end`;
      setShowInstallPrompt(false);
      return;
    }

    const activePrompt = deferredPrompt || globalDeferredPrompt;
    if (activePrompt) {
      activePrompt.prompt();
      const choice = await activePrompt.userChoice;
      if (choice.outcome === 'accepted') {
        try {
          localStorage.setItem('pwa-installed', 'true');
        } catch {}
      }
      setDeferredPrompt(null);
      globalDeferredPrompt = null;
      setShowInstallPrompt(false);
      try {
        localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
      } catch {}
      return;
    }

    alert('홈 화면에 아이콘을 추가하려면:\n\n우측 상단 메뉴(⋮) 터치 ➔ [홈 화면에 추가 / 앱 설치]를 선택해 주세요!');
    setShowInstallPrompt(false);
    try {
      localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
    } catch {}
  };

  // 접속 환경별 최적 맞춤 가이드 이미지 선택 (네이버 카페 최우선)
  const getIosGuideSrc = () => {
    if (inAppType === 'naver') {
      return '/images/cafe_ios_guide.jpg';
    }
    if (inAppType === 'safari') {
      return '/images/safari_ios_guide.jpg';
    }
    if (inAppType === 'kakao') {
      return '/images/kakao_ios_guide.jpg';
    }
    return '/images/safari_ios_guide.jpg';
  };

  return (
    <>
      {/* 1. 🍎 [아이폰 전용] 화면 맨 위 상단 슬림 가이드 카드 */}
      {isIOS && isIosGuideOpen && (
        <div className="fixed top-2.5 left-2.5 right-2.5 z-[9999] mx-auto max-w-md animate-in slide-in-from-top-4">
          <div className="bg-slate-900/98 text-white rounded-2xl border-2 border-amber-400/80 shadow-[0_12px_36px_rgba(0,0,0,0.6)] backdrop-blur-xl overflow-hidden p-2.5 sm:p-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/80">
              <h4 className="text-sm sm:text-base font-extrabold text-amber-300 tracking-tight flex items-center gap-1.5">
                <span>아이폰 홈 화면 추가 순서</span>
                {inAppType === 'naver' && (
                  <span className="text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    카페 전용
                  </span>
                )}
                {inAppType === 'kakao' && (
                  <span className="text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    카톡 전용
                  </span>
                )}
                {inAppType === 'safari' && (
                  <span className="text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    Safari
                  </span>
                )}
              </h4>
              <button
                type="button"
                onClick={handleDismiss}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <div className="pt-2">
              <div className="rounded-xl overflow-hidden border border-slate-700/80 shadow-inner bg-slate-950">
                <img 
                  src={getIosGuideSrc()} 
                  alt="아이폰 홈화면 추가 순서 안내" 
                  className="w-full h-auto object-contain block"
                  loading="eager"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. 🤖 [안드로이드 전용] 수동 요청 시에만 열리는 하단 PWA 설치 배너 */}
      {!isIOS && showInstallPrompt && (
        <div className="fixed bottom-4 left-4 right-4 z-[9999] mx-auto max-w-sm">
          <div className="bg-gradient-to-b from-[#0b192c]/98 via-[#0d223a]/98 to-[#081220]/98 backdrop-blur-xl border border-sky-500/35 rounded-2xl shadow-[0_16px_40px_rgba(0,10,25,0.5)] p-4 animate-in slide-in-from-bottom-5">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-sky-500/20 border border-sky-400/30 rounded-xl flex items-center justify-center text-sky-300 shadow-inner text-lg">
                  📱
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-white tracking-tight flex items-center gap-1.5">
                  <span>{isInAppBrowser ? '기본 브라우저 탈출 & 바로가기' : '홈 화면에 바로가기 추가'}</span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                </p>
                <p className="text-xs text-sky-100/85 font-medium mt-0.5 leading-snug">
                  스마트폰 앱처럼 홈 화면에서 터치 한 번으로 바로 열 수 있어요!
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                aria-label="닫기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-3.5 flex space-x-2">
              <button
                onClick={handleAndroidInstallClick}
                className="flex-1 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs sm:text-sm font-black py-2.5 px-3 rounded-xl shadow-lg shadow-sky-950/60 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                홈 화면에 추가하기 ⚡
              </button>
              <button
                onClick={handleDismiss}
                className="flex-1 bg-white/10 hover:bg-white/15 text-slate-300 text-xs sm:text-sm font-bold py-2.5 px-3 rounded-xl border border-white/10 active:scale-[0.98] transition-all cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
