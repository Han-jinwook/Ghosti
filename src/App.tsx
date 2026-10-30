import React, { useEffect, useState } from 'react';
import { useSaySeeStore } from './store/useSaySeeStore';
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

export const App: React.FC = () => {
  const {
    layout,
    initApp,
    lastQuarantineToast,
    dismissQuarantineToast,
    lastUndoBatch,
    undoLastQuarantine,
    dismissUndoBatch,
  } = useSaySeeStore();

  // 개발자 / QA 테스터 시크릿 권한 판별:
  // 일반 외부 방문자(유튜브·네이버·구글 검색 유입)에게는 개발 중인 본진 워크스페이스 및 QA 버튼을 100% 비노출 잠금합니다.
  const [isDevAuthorized, setIsDevAuthorized] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('visitor') === 'true' || params.get('lock') === 'true') {
        localStorage.removeItem('ghosti_dev_qa_unlocked');
        localStorage.removeItem('ghosti_view_mode');
        return false;
      }
      if (
        params.get('dev') === 'true' ||
        params.get('qa') === 'true' ||
        params.get('app') === 'true' ||
        params.get('workspace') === 'true' ||
        params.get('mode') === 'app'
      ) {
        localStorage.setItem('ghosti_dev_qa_unlocked', 'true');
        return true;
      }
      if (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
      ) {
        return true;
      }
      return localStorage.getItem('ghosti_dev_qa_unlocked') === 'true';
    } catch {
      return false;
    }
  });

  // 검색어(SEO) 빌드업 & 하이브리드 온보딩 대문('showroom') vs 본진 앱 워크스페이스('workspace') 뷰 모드
  const [viewMode, setViewMode] = useState<'showroom' | 'workspace'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (
        params.get('showroom') === 'true' ||
        params.get('mode') === 'showroom' ||
        params.get('visitor') === 'true' ||
        params.get('lock') === 'true'
      ) {
        return 'showroom';
      }
      const hasDevParam =
        params.get('app') === 'true' ||
        params.get('mode') === 'app' ||
        params.get('workspace') === 'true' ||
        params.get('qa') === 'true' ||
        params.get('dev') === 'true';
      if (hasDevParam) {
        return 'workspace';
      }
      // 정식 출시 전(!OFFICIAL_LAUNCH_LIVE)에는 일반 방문자가 워크스페이스로 절대 진입할 수 없도록 원천 잠금
      const unlocked =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        localStorage.getItem('ghosti_dev_qa_unlocked') === 'true';
      if (!OFFICIAL_LAUNCH_LIVE && !unlocked) {
        return 'showroom';
      }
      const saved = localStorage.getItem('ghosti_view_mode');
      if (saved === 'workspace') return 'workspace';
    } catch {
      // ignore
    }
    return 'showroom';
  });

  const handleUnlockDevMode = () => {
    try {
      localStorage.setItem('ghosti_dev_qa_unlocked', 'true');
    } catch {}
    setIsDevAuthorized(true);
  };

  const handleEnterWorkspace = (forceAllow = false) => {
    if (!OFFICIAL_LAUNCH_LIVE && !isDevAuthorized && !forceAllow) {
      return;
    }
    try {
      localStorage.setItem('ghosti_view_mode', 'workspace');
    } catch {}
    setViewMode('workspace');
  };

  const handleEnterShowroom = () => {
    try {
      localStorage.setItem('ghosti_view_mode', 'showroom');
    } catch {}
    setViewMode('showroom');
  };

  useEffect(() => {
    const onGoShowroom = () => handleEnterShowroom();
    const onGoWorkspace = () => handleEnterWorkspace();
    window.addEventListener('ghosti_navigate_showroom', onGoShowroom);
    window.addEventListener('ghosti_navigate_workspace', onGoWorkspace);
    return () => {
      window.removeEventListener('ghosti_navigate_showroom', onGoShowroom);
      window.removeEventListener('ghosti_navigate_workspace', onGoWorkspace);
    };
  }, [isDevAuthorized]);

  useEffect(() => {
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

  useEffect(() => {
    if (!lastQuarantineToast) return;
    const t = window.setTimeout(() => dismissQuarantineToast(), 4500);
    return () => clearTimeout(t);
  }, [lastQuarantineToast, dismissQuarantineToast]);

  return (
    <GhostiHubRootProvider>
      {/* 앱/웹 첫 실행 시 『귀신같이』 마스터 로딩 스플래시 화면 */}
      <GhostiLoadingSplash />

      {/* 공식 쇼룸 & 하이브리드 온보딩 대문 vs 내부 개발 워크스페이스 분기 */}
      {viewMode === 'showroom' ? (
        <GhostiShowroomLanding
          onEnterWorkspace={handleEnterWorkspace}
          isDevAuthorized={isDevAuthorized}
          onUnlockDevMode={handleUnlockDevMode}
        />
      ) : (
        <>
          {layout === 'desktop' ? <DesktopDashboard /> : <MobileAppView />}

          {/* 체험판 1분 고속 스캔 & 검진 구역 직접 허용 모달 */}
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
    </GhostiHubRootProvider>
  );
};

export default App;
