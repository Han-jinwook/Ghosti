import React, { useEffect } from 'react';
import { launchRealOsTopmostOverlay } from '../services/setupMonsterEngine';
import { dispatchAndroidOverlayArrowViaBridge } from '../services/p2pHybridBridge';
import { useSaySeeStore } from '../store/useSaySeeStore';

/**
 * 외부 프로그램·설정 창 위에 단계별 클릭 위치를 안내하는 화면 오버레이 가이드 (`👆` 포인터 유지)
 */
export const SetupFloatingOverlayGuide: React.FC = () => {
  const {
    activeOverlayPlan,
    activeOverlayStepIndex,
    activeOverlayBacktrackCount,
    recordOverlayBacktrack,
    advanceSetupOverlayStep,
    closeSetupOverlayGuide,
  } = useSaySeeStore();

  const steps = activeOverlayPlan?.overlaySteps ?? [];
  const currentStep = steps[activeOverlayStepIndex] ?? steps[0];

  useEffect(() => {
    if (!activeOverlayPlan || !currentStep || activeOverlayPlan.platform !== 'pc') return;
    const [lx, ly] = currentStep.rawLogicalRect ?? [420, 160, 120, 56];
    void launchRealOsTopmostOverlay({
      x: lx,
      y: ly,
      text: currentStep.bubbleMessage,
      durationSec: 10,
    });
  }, [activeOverlayPlan, activeOverlayStepIndex, currentStep]);

  if (!activeOverlayPlan || !activeOverlayPlan.overlaySteps?.length) return null;

  const [leftPct, topPct] = currentStep.fingerCoordPct;
  dispatchAndroidOverlayArrowViaBridge({
    rawLogicalRect: currentStep.rawLogicalRect ?? [leftPct * 10, topPct * 20, 120, 56],
    instructionKo: currentStep.bubbleMessage,
  });

  return (
    <div className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col text-slate-900">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-bold text-slate-900">
              화면 위치 안내 ({currentStep.step}/{steps.length}단계)
            </span>
          </div>
          <button
            type="button"
            onClick={closeSetupOverlayGuide}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-[12px] font-medium cursor-pointer"
          >
            닫기
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div
            data-keep-dark="true"
            className="relative h-60 rounded-xl bg-slate-900 border border-slate-200 overflow-hidden p-4"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
              <span className="text-[12.5px] text-white font-semibold">
                {currentStep.screenTitle}
              </span>
              <span className="text-[11px] text-slate-400">
                대상: {currentStep.targetLabel}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 opacity-75">
              {currentStep.scrapedElements.map((el, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-lg bg-white/10 border border-white/10"
                >
                  <span className="text-[12px] text-white font-medium">
                    {el.text}
                  </span>
                </div>
              ))}
            </div>

            <div
              style={{
                left: `${Math.min(78, Math.max(12, leftPct))}%`,
                top: `${Math.min(68, Math.max(24, topPct))}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 z-20"
            >
              <button
                type="button"
                onClick={advanceSetupOverlayStep}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[12.5px] font-semibold shadow-lg border border-white/80 flex items-center gap-1.5 cursor-pointer"
              >
                <span className="text-[16px]">👆</span>
                <span>{currentStep.bubbleMessage.replace(/^👆\s*/, '')}</span>
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-3">
            <p className="text-[13px] text-slate-700 leading-relaxed">
              {currentStep.voiceGuideText}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={recordOverlayBacktrack}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-[12px] font-medium cursor-pointer"
              >
                다른 화면이 보임 {activeOverlayBacktrackCount > 0 ? `(${activeOverlayBacktrackCount})` : ''}
              </button>
              <button
                type="button"
                onClick={advanceSetupOverlayStep}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12.5px] font-semibold shrink-0 cursor-pointer"
              >
                {activeOverlayStepIndex + 1 < steps.length ? '다음 단계' : '안내 종료'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SetupMonsterModal: React.FC = () => null;
