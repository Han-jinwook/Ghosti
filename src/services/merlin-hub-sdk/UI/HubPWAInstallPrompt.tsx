/**
 * Version: v2.7.0
 * Last Updated: 2026-10-18
 * Merlin Hub SDK — PWA 바로가기 추가 유도 배너 & 아이폰 카페/사파리/카톡 1:1 맞춤 그래픽 가이드 카드
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
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
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
 * 1. [상시 설치 진입로] 모바일 브라우저 전용 심플 버튼
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
 * 2. [PWA 설치 유도 시스템]
 * - 안드로이드: 하단 설치 바닥 배너 & 네이티브 즉시 추가
 * - 아이폰: 하단을 가리지 않는 화면 상단 고정 슬림 가이드 카드 (카페/사파리/카톡 1:1 맞춤 그래픽)
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
    const isTestMode = window.location.search.includes('t=') || window.location.search.includes('test=') || window.location.search.includes('debug=') || window.location.search.includes('install=');

    if (!isTestMode && (!checkIsMobile() || checkIsStandalone())) {
      return;
    }

    const ua = navigator.userAgent || '';
    const search = window.location.search;
    let isAppleIOS = (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) || search.includes('ios');
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

    // 닫기 상태 확인 (이번 세션 동안만 닫힘 기억, 브라우저 닫고 다시 오면 다시 뜸)
    const sessionDismissed = sessionStorage.getItem('pwa-prompt-dismissed');
    let canShow = !sessionDismissed || isTestMode;

    let promptTimer: NodeJS.Timeout | null = null;
    if (canShow) {
      promptTimer = setTimeout(() => {
        if (isAppleIOS) {
          // 🍎 아이폰: 첫 화면 상단에 방해 없는 슬림 가이드 카드 표출
          setIsIosGuideOpen(true);
        } else {
          // 안드로이드: 하단 설치 배너 노출
          setShowInstallPrompt(true);
        }
      }, 800);
    }

    // 안드로이드 네이티브 PWA 설치 이벤트 수신
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      globalDeferredPrompt = e as BeforeInstallPromptEvent;
      if (canShow && !isAppleIOS) {
        setShowInstallPrompt(true);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setIsIosGuideOpen(false);
      setDeferredPrompt(null);
      globalDeferredPrompt = null;
      localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
    };

    // 상시 설치 버튼 등 외부 트리거 수신
    const handleExternalTrigger = () => {
      if (isAppleIOS) {
        setIsIosGuideOpen(true);
      } else {
        handleAndroidInstallClick();
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('triggerPWAInstall', handleExternalTrigger);

    return () => {
      if (promptTimer) clearTimeout(promptTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('triggerPWAInstall', handleExternalTrigger);
    };
  }, []);

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    setIsIosGuideOpen(false);
    sessionStorage.setItem('pwa-prompt-dismissed', '1');
  };

  const handleAndroidInstallClick = async () => {
    if (isInAppBrowser) {
      // 안드로이드 인앱브라우저: 크롬으로 0.1초 즉시 외부 탈출
      const cleanHost = window.location.host;
      const cleanPath = window.location.pathname + window.location.search;
      window.location.href = `intent://${cleanHost}${cleanPath}#Intent;scheme=https;package=com.android.chrome;end`;
      setShowInstallPrompt(false);
      return;
    }

    const activePrompt = deferredPrompt || globalDeferredPrompt;
    if (activePrompt) {
      activePrompt.prompt();
      await activePrompt.userChoice;
      setDeferredPrompt(null);
      globalDeferredPrompt = null;
      setShowInstallPrompt(false);
      localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
      return;
    }

    alert('홈 화면에 아이콘을 추가하려면:\n\n우측 상단 메뉴(⋮) 터치 ➔ [홈 화면에 추가 / 앱 설치]를 선택해 주세요!');
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
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
      {/* 1. 🍎 [아이폰 전용] 화면 맨 위 상단 슬림 가이드 카드 (하단 공유/메뉴 터치 영역 100% 방해 안 함) */}
      {isIOS && isIosGuideOpen && !isInstalled && (
        <div className="fixed top-2.5 left-2.5 right-2.5 z-[9999] mx-auto max-w-md animate-in slide-in-from-top-4">
          <div className="bg-slate-900/98 text-white rounded-2xl border-2 border-amber-400/80 shadow-[0_12px_36px_rgba(0,0,0,0.6)] backdrop-blur-xl overflow-hidden p-2.5 sm:p-3">
            {/* 헤더: 간소화된 제목과 닫기 버튼 */}
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

            {/* 실물 아이콘 순서 가이드 그래픽 이미지 (카페/사파리/카톡 1:1 맞춤 분기) */}
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

      {/* 2. 🤖 [안드로이드 전용] 바닥 PWA 설치 배너 */}
      {!isIOS && !isInstalled && showInstallPrompt && (
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
                나중에
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

