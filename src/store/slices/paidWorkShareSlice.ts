import type { StateCreator } from 'zustand';
import type { SaySeeStore } from '../useSaySeeStore';

export interface PaidWorkShareSlice {
  // [창 3 전담: 업무 공유 S: 네트워크 드라이브 & 팀 상용구 B2B 워크스페이스 슬롯]
  workSDriveMounted: boolean;
  workSDriveMountLetter: string;
  workTeamSnippetsSyncedAt: string | null;
  setWorkSDriveMounted: (mounted: boolean, letter?: string) => void;
  activateWorkSharePlanShortcut: (planId: 'work_soho_9900' | 'work_biz_19900') => void;
}

export const createPaidWorkShareSlice: StateCreator<SaySeeStore, [], [], PaidWorkShareSlice> = (set, get) => ({
  workSDriveMounted: false,
  workSDriveMountLetter: 'S:',
  workTeamSnippetsSyncedAt: null,
  setWorkSDriveMounted: (workSDriveMounted, letter = 'S:') =>
    set({
      workSDriveMounted,
      workSDriveMountLetter: letter,
      workTeamSnippetsSyncedAt: workSDriveMounted ? new Date().toISOString() : null,
    }),
  activateWorkSharePlanShortcut: (planId) => {
    get().activatePricingPlan(planId);
  },
});
