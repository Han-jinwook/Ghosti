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
  if (isStoreAppMode || isWorkUnlocked) return null;

  const isExpired = isWorkTrialExpired || remoteRoomLockReason === 'WORK_TRIAL_EXPIRED';

  return (
    <div
      data-testid="work-share-subscription-lock-banner"
      className="p-5 rounded-xl bg-white border border-slate-200 flex flex-col gap-3.5"
    >
      <div className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-slate-500">
          {isExpired ? '무료체험 종료 · PC 원본 파일은 그대로 유지됩니다' : '30일 무료체험 · 팀원 추가 비용 없음'}
        </span>
        <h3 className="text-[16.5px] sm:text-[17.5px] text-slate-900 font-bold">
          {isExpired
            ? '업무 공유(S:) 무료체험이 종료되었습니다'
            : '업무 공유 공용 폴더 (S: 드라이브)'}
        </h3>
        <p className="text-[13px] text-slate-600 leading-relaxed break-keep">
          {isExpired
            ? 'PC 업무 폴더의 원본 문서는 그대로 보존되어 있습니다. 이용권을 선택하면 탐색기 S: 드라이브와 팀원 연결이 다시 활성화됩니다.'
            : '사내 메인 PC의 폴더를 팀 공용 드라이브(S:)로 연결하여 계약서·견적서·도면 본문을 함께 검색하고 공유합니다.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        {!hasUsedWorkTrial && !hasWorkInvite && (
          <button
            type="button"
            disabled={startingWorkTrial}
            onClick={() => void handleStart30DayWorkTrial()}
            data-testid="start-work-30d-trial-btn"
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12.5px] font-semibold cursor-pointer disabled:opacity-50"
          >
            {startingWorkTrial ? '시작하는 중...' : '30일 무료체험 시작'}
          </button>
        )}
        <button
          type="button"
          onClick={() => activatePricingPlan('work_soho_9900')}
          data-testid="open-work-soho-checkout-btn"
          className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-900 text-[12.5px] font-semibold cursor-pointer"
        >
          소호 (~5인 · 월 9,900원)
        </button>
        <button
          type="button"
          onClick={() => activatePricingPlan('work_biz_19000')}
          className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12.5px] font-medium cursor-pointer"
        >
          소기업 (~20인 · 월 19,000원)
        </button>
        <button
          type="button"
          onClick={() => activatePricingPlan('work_pro_29000')}
          className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12.5px] font-medium cursor-pointer"
        >
          중소기업 (~50인 · 월 29,000원)
        </button>
      </div>
    </div>
  );
};
