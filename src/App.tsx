import React, { useEffect } from 'react';
import { useSaySeeStore } from './store/useSaySeeStore';
import { DesktopDashboard } from './components/DesktopDashboard';
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

  useEffect(() => {
    void initApp();
  }, [initApp]);

  useEffect(() => {
    if (!lastQuarantineToast) return;
    const t = window.setTimeout(() => dismissQuarantineToast(), 4500);
    return () => clearTimeout(t);
  }, [lastQuarantineToast, dismissQuarantineToast]);

  return (
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

      {/* [Z-Eye 여권 연동] 최신 연도 정면 얼굴 자동 문패(Slot 1 Anchor) & 5대 스타일 슬롯 원터치 변경 팝업 */}
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

      {/* 글로벌 액션 피드백 토스트 */}
      {lastQuarantineToast && (
        <div
          className={`fixed ${
            lastUndoBatch ? 'bottom-24' : 'bottom-16'
          } left-1/2 -translate-x-1/2 z-[110] px-5 py-3 rounded-full bg-surface-container-highest/95 backdrop-blur-xl border border-primary-container/40 text-on-surface font-label-md text-label-md font-bold shadow-[0_0_32px_rgba(0,229,255,0.3)] flex items-center gap-2 max-w-[92vw]`}
        >
          <span className="truncate">{lastQuarantineToast}</span>
          <button
            onClick={dismissQuarantineToast}
            className="text-on-surface-variant hover:text-on-surface shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}
    </>
  );
};

export default App;
