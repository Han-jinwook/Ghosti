import React, { useEffect } from 'react';
import { useSaySeeStore } from './store/useSaySeeStore';
import { DesktopDashboard } from './components/DesktopDashboard';
import { MobileAppView } from './components/MobileAppView';
import { OnboardingModal } from './components/OnboardingModal';
import { PhotoDetailModal } from './components/PhotoDetailModal';

export const App: React.FC = () => {
  const {
    layout,
    initApp,
    lastQuarantineToast,
    dismissQuarantineToast,
  } = useSaySeeStore();

  useEffect(() => {
    void initApp();
  }, [initApp]);

  useEffect(() => {
    if (!lastQuarantineToast) return;
    const t = window.setTimeout(() => dismissQuarantineToast(), 4000);
    return () => clearTimeout(t);
  }, [lastQuarantineToast, dismissQuarantineToast]);

  return (
    <>
      {layout === 'desktop' ? <DesktopDashboard /> : <MobileAppView />}

      {/* 지침 #1: 온보딩 13분 UX 방어 3D 파형/벡터 변환 모달 */}
      <OnboardingModal />

      {/* 3.2절: 사진 상세 & 2차 연관 꼬리물기 탐색 모달 */}
      <PhotoDetailModal />

      {/* 글로벌 액션 피드백 토스트 */}
      {lastQuarantineToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] px-5 py-3 rounded-full bg-surface-container-highest/95 backdrop-blur-xl border border-primary-container/40 text-on-surface font-label-md text-label-md font-bold shadow-[0_0_32px_rgba(0,229,255,0.3)] flex items-center gap-2">
          <span>{lastQuarantineToast}</span>
          <button
            onClick={dismissQuarantineToast}
            className="text-on-surface-variant hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}
    </>
  );
};

export default App;
