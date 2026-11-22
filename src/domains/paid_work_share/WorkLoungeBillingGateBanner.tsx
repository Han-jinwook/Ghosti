import React from 'react';
import type { PricingPlanId } from '../../types/saysee';

export interface WorkLoungeBillingGateBannerProps {
  isStoreAppMode: boolean;
  isWorkUnlocked: boolean;
  isWorkTrialExpired: boolean;
  remoteRoomLockReason: string | null;
  hasUsedWorkTrial: boolean;
  hasWorkInvite: boolean;
  startingWorkTrial: boolean;
  onStart30DayWorkTrial: () => Promise<void>;
  onActivatePricingPlan: (planId: PricingPlanId) => void;
}

export const WorkLoungeBillingGateBanner: React.FC<WorkLoungeBillingGateBannerProps> = ({
  isStoreAppMode,
  isWorkUnlocked,
  isWorkTrialExpired,
  remoteRoomLockReason,
  hasUsedWorkTrial,
  hasWorkInvite,
  startingWorkTrial,
  onStart30DayWorkTrial: handleStart30DayWorkTrial,
  onActivatePricingPlan: activatePricingPlan,
}) => {
  const inviteMeta = { hasWorkInvite };
  return (
    <>
      {/* 🔒 과금·30일 무료체험 Opt-in·만료 잠금 배너 (3중 권한 게이트 — 만료 시 S: 자동 해제 & 원본 100% 보존) */}
      {!isStoreAppMode && !isWorkUnlocked && (
        <div
          data-testid="work-share-subscription-lock-banner"
          className={`p-4 sm:p-5 rounded-2xl border flex flex-col gap-3 shadow-lg ${
            isWorkTrialExpired || remoteRoomLockReason === 'WORK_TRIAL_EXPIRED'
              ? 'bg-gradient-to-r from-rose-950/90 via-zinc-950 to-amber-950/80 border-rose-400/50'
              : 'bg-gradient-to-r from-cyan-950/90 via-zinc-950 to-emerald-950/80 border-cyan-400/50'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/45 text-amber-200 text-[11px] font-extrabold w-fit">
                {isWorkTrialExpired || remoteRoomLockReason === 'WORK_TRIAL_EXPIRED'
                  ? '🔒 30일 무료체험 종료 — 대장 PC 업무 폴더 원본 100% 보존됨'
                  : '🎁 대표 1인만 구독하면 팀원은 평생 0원 · 30일 무료체험 제공'}
              </span>
              <h3 className="font-headline-sm text-[17px] sm:text-[18px] text-white font-black">
                {isWorkTrialExpired || remoteRoomLockReason === 'WORK_TRIAL_EXPIRED'
                  ? '업무 공유(S: 드라이브) 무료체험이 종료되어 탐색기 S: 연결이 해제되었습니다'
                  : '업무 공유 공용 폴더(S: 드라이브) — 30일 무료체험 또는 이용권 구독으로 시작하세요'}
              </h3>
              <p className="text-[12.5px] text-zinc-200 break-keep">
                {isWorkTrialExpired || remoteRoomLockReason === 'WORK_TRIAL_EXPIRED'
                  ? '내 PC 업무 폴더 안의 계약서·견적서·도면 원본 파일은 단 1개도 삭제되지 않고 그대로 보존되어 있습니다. 아래 이용권을 구독하시면 즉시 탐색기 S: 드라이브와 팀원 24시간 직통 연결이 다시 열립니다.'
                  : '24시간 켜두는 사내 대장 PC의 S: 드라이브에 전국 어디서나(집·현장·LTE) 방화벽 막힘 없이 0초 직결되며, 우리 서버에는 회사 파일이 1 Byte도 저장되지 않습니다(Zero-Cloud).'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {!hasUsedWorkTrial && !inviteMeta.hasWorkInvite && (
              <button
                type="button"
                disabled={startingWorkTrial}
                onClick={() => void handleStart30DayWorkTrial()}
                data-testid="start-work-30d-trial-btn"
                className="px-4 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-label-sm text-[12.5px] font-black cursor-pointer shadow-md disabled:opacity-50"
              >
                {startingWorkTrial
                  ? '⏳ 30일 무료체험 개통 중...'
                  : '🎁 0원으로 30일 먼저 무료체험 시작 (소호 ~5인)'}
              </button>
            )}
            <button
              type="button"
              onClick={() => activatePricingPlan('work_soho_9900')}
              data-testid="open-work-soho-checkout-btn"
              className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-label-sm text-[12.5px] font-black cursor-pointer shadow-md"
            >
              💳 소호(~5인) 월 9,900원 구독으로 연결
            </button>
            <button
              type="button"
              onClick={() => activatePricingPlan('work_biz_19000')}
              className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-cyan-400/45 text-cyan-200 font-label-sm text-[12px] font-extrabold cursor-pointer"
            >
              🏢 소기업(~20인) 월 19,000원
            </button>
            <button
              type="button"
              onClick={() => activatePricingPlan('work_pro_29000')}
              className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-400/45 text-amber-200 font-label-sm text-[12px] font-extrabold cursor-pointer"
            >
              🏛️ 중소기업(~50인) 월 29,000원
            </button>
          </div>
        </div>
      )}
    </>
  );
};
