import React, { useEffect, useState } from 'react';
import { useSaySeeStore } from './store/useSaySeeStore';
import { playAppEnterGiggleSound } from './services/babyGhostSound';
import { DesktopDashboard } from './components/DesktopDashboard';
import { GhostiLoadingSplash } from './components/GhostiLoadingSplash';
import { GhostiHubRootProvider } from './components/GhostiHubInfraBridge';
import { GhostiShowroomLanding, OFFICIAL_LAUNCH_LIVE } from './components/GhostiShowroomLanding';
import { MobileAppView } from './components/MobileAppView';
import { OnboardingModal } from './components/OnboardingModal';
import { PhotoDetailModal } from './components/PhotoDetailModal';
import {
  LocalDocPreviewModal,
  MobileMasterPcIntroModal,
  PricingModal,
  VideoScenePreviewModal,
} from './components/PricingModal';
import {
  FaceMemberRegistryModal,
  PassportDoorplateStyleModal,
} from './components/FaceMemberRegistryModal';
import {
  SetupFloatingOverlayGuide,
  SetupMonsterModal,
} from './components/SetupMonsterModal';
import { GhostCastAndLiveGlobalOverlay } from './components/GhostCastAndLiveSystem';

export const App: React.FC = () => {
  const {
    layout,
    initApp,
    lastQuarantineToast,
    dismissQuarantineToast,
    lastUndoBatch,
    undoLastQuarantine,
    dismissUndoBatch,
    selectedPhoto,
    setSelectedPhoto,
    selectedVideoModal,
    setSelectedVideoModal,
    selectedDocModal,
    setSelectedDocModal,
    showProModal,
    setShowProModal,
    showSetupMonsterModal,
    setShowSetupMonsterModal,
    showOnboarding,
    setShowOnboarding,
    showFaceRegistryModal,
    setShowFaceRegistryModal,
    doorplatePickerClusterId,
    setDoorplatePickerClusterId,
  } = useSaySeeStore();

  // 모바일 뒤로가기(Hardware Back Button / History PopState) 시 앱 자체가 꺼지지 않고 열려 있는 상세보기 모달만 닫히도록 방어
  const hasAnyModalOpen = Boolean(
    selectedPhoto ||
      selectedVideoModal ||
      selectedDocModal ||
      showProModal ||
      showSetupMonsterModal ||
      showOnboarding ||
      showFaceRegistryModal ||
      doorplatePickerClusterId
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !hasAnyModalOpen) return;
    let pushedByEffect = false;
    try {
      if (!window.history.state?.ghostiModalOpen) {
        window.history.pushState({ ...(window.history.state || {}), ghostiModalOpen: true }, '');
        pushedByEffect = true;
      }
    } catch {
      // ignore
    }

    const handlePopState = () => {
      const st = useSaySeeStore.getState();
      if (st.selectedPhoto) st.setSelectedPhoto(null);
      if (st.selectedVideoModal) st.setSelectedVideoModal(null);
      if (st.selectedDocModal) st.setSelectedDocModal(null);
      if (st.showProModal) st.setShowProModal(false);
      if (st.showSetupMonsterModal) st.setShowSetupMonsterModal(false);
      if (st.showOnboarding) st.setShowOnboarding(false);
      if (st.showFaceRegistryModal) st.setShowFaceRegistryModal(false);
      if (st.doorplatePickerClusterId) st.setDoorplatePickerClusterId(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (pushedByEffect && window.history.state?.ghostiModalOpen) {
        try {
          window.history.replaceState(
            { ...(window.history.state || {}), ghostiModalOpen: false },
            ''
          );
        } catch {
          // ignore
        }
      }
    };
  }, [hasAnyModalOpen]);

  // 오직 현재 URL 뒤에 `?dev=true`가 붙어 있거나 로컬호스트일 때만 개발자/QA 전용 내부 워크스페이스 권한 부여
  // https://ghosti.sundreamer.app/ 처럼 `?dev=true` 없이 접속하면 무조건 온보딩 대문(showroom)만 노출합니다.
  const [isDevAuthorized] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('dev') === 'true') {
        return true;
      }
      if (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
      ) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  // [라우팅 잠금 철칙]:
  // 1) `https://ghosti.sundreamer.app/` (일반 루트 접속) ➔ 무조건 온보딩 대문('showroom')만 노출
  // 2) `https://ghosti.sundreamer.app/?dev=true` 또는 로컬 개발 환경 ➔ 내부 워크스페이스('workspace') 진입
  const [viewMode, setViewMode] = useState<'showroom' | 'workspace'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('dev') === 'true') {
        return 'workspace';
      }
      if (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
      ) {
        return 'workspace';
      }
      if (!OFFICIAL_LAUNCH_LIVE) {
        return 'showroom';
      }
      const hasActiveSession = Boolean(localStorage.getItem('merlin_session_token'));
      if (hasActiveSession) {
        return 'workspace';
      }
    } catch {
      // ignore
    }
    return 'showroom';
  });

  const handleEnterWorkspace = (forceAllow = false) => {
    if (!OFFICIAL_LAUNCH_LIVE && !isDevAuthorized && !forceAllow) {
      return;
    }
    try {
      localStorage.setItem('ghosti_onboarding_completed', 'true');
      localStorage.setItem('ghosti_view_mode', 'workspace');
    } catch {}
    setViewMode('workspace');
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };

  // 워크스페이스 내부 상단 헤더의 [🏠 공식 쇼룸 대문] 버튼을 명시적으로 눌렀을 때만 해당 세션에서 대문 열람
  // (단, ghosti_onboarding_completed는 유지되므로 다음 날 앱에 재접속할 때는 다시 자동으로 워크스페이스로 직행)
  const handleEnterShowroom = () => {
    setViewMode('showroom');
  };

  useEffect(() => {
    const onGoShowroom = () => handleEnterShowroom();
    const onGoWorkspace = () => handleEnterWorkspace();
    const onMerlinLoggedIn = () => {
      try {
        localStorage.setItem('ghosti_onboarding_completed', 'true');
      } catch {}
      // 정식 출시 상태이거나 개발자 권한이 있을 때 온보딩에서 로그인을 완료하면 즉시 본진 워크스페이스로 자동 진입
      if (OFFICIAL_LAUNCH_LIVE || isDevAuthorized) {
        setViewMode('workspace');
      }
    };
    window.addEventListener('ghosti_navigate_showroom', onGoShowroom);
    window.addEventListener('ghosti_navigate_workspace', onGoWorkspace);
    window.addEventListener('merlinLoggedIn', onMerlinLoggedIn);
    return () => {
      window.removeEventListener('ghosti_navigate_showroom', onGoShowroom);
      window.removeEventListener('ghosti_navigate_workspace', onGoWorkspace);
      window.removeEventListener('merlinLoggedIn', onMerlinLoggedIn);
    };
  }, [isDevAuthorized]);

  useEffect(() => {
    playAppEnterGiggleSound();
    void initApp();
    const handleZCoreConnected = () => {
      useSaySeeStore.setState({
        lastQuarantineToast: '🎉 멀린 Z-코어(Port 5199) 연결 완료! 내 컴퓨터 실물 파일이 연동되었습니다.',
      });
      void initApp(true);
    };
    window.addEventListener('zCoreConnected', handleZCoreConnected);
    return () => window.removeEventListener('zCoreConnected', handleZCoreConnected);
  }, [initApp]);

  // 모바일 및 데스크톱 전 페이지 공통 '맨 위로 가기 (Scroll to Top)' 플로팅 버튼 노출 상태
  const [showScrollTopBtn, setShowScrollTopBtn] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleScroll = () => {
      const y =
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;
      setShowScrollTopBtn(y > 160);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleScrollToTop = () => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  useEffect(() => {
    if (!lastQuarantineToast) return;
    const t = window.setTimeout(() => dismissQuarantineToast(), 4500);
    return () => clearTimeout(t);
  }, [lastQuarantineToast, dismissQuarantineToast]);

  return (
    <GhostiHubRootProvider>
      {/* 앱 진입 시 0.5초 가벼운 로딩 스플래시 */}
      <GhostiLoadingSplash />

      {/* 공식 쇼룸 & 하이브리드 온보딩 대문 vs 내부 개발 워크스페이스 분기 */}
      {viewMode === 'showroom' ? (
        <GhostiShowroomLanding
          onEnterWorkspace={handleEnterWorkspace}
          isDevAuthorized={isDevAuthorized}
        />
      ) : (
        <>
          {layout === 'desktop' ? <DesktopDashboard /> : <MobileAppView />}

          {/* 체험판 1분 고속 스캔 & 검진 구역 직접 허용 모달 (온보딩 대문 페이지와 중복이므로 팝업 주석 처리) */}
          {/* 체험판 1분 고속 스캔 & 검진 구역 직접 허용 모달 (인포데스크 온보딩 3탭 가이드 모달) */}
          <OnboardingModal />

          {/* 사진 상세 & 연사 비교 Pick & 2차 연관 꼬리물기 탐색 모달 */}
          <PhotoDetailModal />

          {/* [스펙 4] 카페 런칭용 심플 과금 퍼널 & 스토어 클린 모드 데스크톱 기기 연동 모달 */}
          <PricingModal />

          {/* [안전장치 2] /?master=pc 모바일 접속 시 결제/요금 안내 없는 순수 'PC 데스크톱 엔진 기능 소개 화면' 이중 방어 모달 */}
          <MobileMasterPcIntroModal />

          {/* [스펙 1] 스마트 서류함 내 로컬 PDF/TXT/DOCX 문서 상세 열람 모달 */}
          <LocalDocPreviewModal />

          {/* [체험판 타겟 ②] 동영상 장면 검색 상세 & 원본 MP4 재생 모달 */}
          <VideoScenePreviewModal />

          {/* [라운지 마스터 스펙] 자율 얼굴 추출(Face Crop) & 당해 연도 대표 멤버 등록 & 초대 레이더 시드 모달 */}
          <FaceMemberRegistryModal />

          {/* [귀신같이 여권 연동] 최신 연도 정면 얼굴 자동 문패(Slot 1 Anchor) & 5대 스타일 슬롯 원터치 변경 팝업 */}
          <PassportDoorplateStyleModal />

          {/* [🛠️ 설정몬스터] 독립 모달 & 타사 앱/프로그램 최상단 투명 유리판 손가락 화살표 가이드(👆) */}
          <SetupMonsterModal />
          <SetupFloatingOverlayGuide />

          {/* [고스트 캐스트 & 라이브 3대 핵심 무기] ① PC/노트북 모니터 풀스크린 클린 뷰어 + 무선 리모컨, ② 방 전용 프라이빗 라이브 생중계 & 라이브 포토 싱크, ③ 원격 모니터링 셔터(선별/즉시 공유 선택) */}
          <GhostCastAndLiveGlobalOverlay />

          {/* [스펙 2] 글로벌 플로팅 3중 타임머신 안전망 (즉시 되돌리기 Undo 바) */}
          {lastUndoBatch && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[115] w-[94%] max-w-2xl px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/95 via-[#072b35]/95 to-surface-container-highest/95 backdrop-blur-2xl border-2 border-emerald-400 text-white shadow-[0_0_40px_rgba(16,185,129,0.45)] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="material-symbols-outlined text-emerald-300 text-[22px] shrink-0">
                  history
                </span>
                <span className="font-label-md text-[13px] md:text-[13.5px] font-bold truncate">
                  🗑️ 방금 정리한 {lastUndoBatch.count}장이 OS 기본 [휴지통]으로 이동되었습니다.
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void undoLastQuarantine()}
                  className="px-4 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-surface-container-lowest font-label-sm text-[12.5px] font-black shadow-md transition-all"
                >
                  ↩️ 1초 실행 취소 (원래대로 되돌리기)
                </button>
                <button
                  type="button"
                  onClick={dismissUndoBatch}
                  className="text-white/70 hover:text-white p-1"
                  title="닫기"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            </div>
          )}

          {/* 글로벌 액션 피드백 토스트 (라이트/다크 테마 적응형 고명도 스타일) */}
          {lastQuarantineToast && (
            <div
              className={`fixed ${
                lastUndoBatch ? 'bottom-24' : 'bottom-16'
              } left-1/2 -translate-x-1/2 z-[110] px-5 py-3 rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-teal-500/40 text-slate-800 dark:text-zinc-100 font-label-md text-[13px] font-bold shadow-[0_10px_30px_rgba(13,148,136,0.25)] flex items-center gap-2.5 max-w-[92vw]`}
            >
              <span className="truncate">{lastQuarantineToast}</span>
              <button
                onClick={dismissQuarantineToast}
                className="text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white shrink-0 cursor-pointer"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
          )}
        </>
      )}

      {/* 모든 페이지(쇼룸 대문, 모바일, 데스크톱 전 메뉴) 공통 맨 위로 가기 플로팅 버튼 */}
      {showScrollTopBtn && (
        <button
          type="button"
          onClick={handleScrollToTop}
          aria-label="맨 위로 가기"
          title="맨 위로 가기"
          className="fixed bottom-6 right-5 z-[120] w-11 h-11 rounded-full bg-white hover:bg-slate-50 active:scale-95 text-slate-700 border border-slate-200/80 shadow-[0_6px_20px_rgba(15,23,42,0.16)] flex items-center justify-center transition-all cursor-pointer"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
      )}
    </GhostiHubRootProvider>
  );
};

export default App;
