import type { LoungeType, PricingPlanId } from '../../types/saysee';

export const LOUNGE_TABS: Array<{
  id: LoungeType;
  icon: string;
  label: string;
  shortPrice: string;
  desc: string;
}> = [
  {
    id: 'personal',
    icon: '',
    label: '내 기기',
    shortPrice: '무료',
    desc: '내 PC·모바일 정리와 사진·문서·동영상 내용 검색',
  },
  {
    id: 'family',
    icon: '',
    label: '가족 사진 공유',
    shortPrice: '무료 (개인 사진·영상 전용)',
    desc: '우리집·본가·처가 사진·동영상 원본 공유',
  },
  {
    id: 'club',
    icon: '',
    label: '동호회 · 동창회 사진 공유',
    shortPrice: '무료 (개인 사진·영상 전용)',
    desc: '동호회·모임·동창회 사진·동영상 원본 공유',
  },
  {
    id: 'work',
    icon: '',
    label: '업무 공유 (S:)',
    shortPrice: '30일 무료체험 · 월 9,900원~',
    desc: '윈도우 탐색기 공용 드라이브(S:) 및 사내 문서 본문 검색',
  },
];

export const PLAN_BADGE_LABELS: Record<PricingPlanId, string> = {
  free_trial: '무료 기본',
  personal_single_2900: '내 기기 (무료)',
  personal_sub_3900: '내 기기 통합 Pro (월 3,900원)',
  personal_year_35000: '내 기기 통합 Pro (연 39,000원)',
  personal_year_39000: '내 기기 통합 Pro (연 39,000원)',
  family_home_5900: '가족 사진 공유 (무료)',
  family_home_year_59000: '가족 사진 공유 (무료)',
  family_three_8900: '가족 사진 공유 (무료)',
  family_three_year_89000: '가족 사진 공유 (무료)',
  club_mini_free_300: '동호회 사진 공유 (무료)',
  club_mini_2900: '동호회 사진 공유 (무료)',
  club_small_4900: '동호회·동창회 사진 공유 (무료)',
  club_small_year_49000: '동호회·동창회 사진 공유 (무료)',
  club_medium_7900: '동호회·동창회 사진 공유 (무료)',
  club_medium_year_79000: '동호회·동창회 사진 공유 (무료)',
  club_large_14900: '동호회·동창회 사진 공유 (무료)',
  club_large_year_149000: '동호회·동창회 사진 공유 (무료)',
  student_sub_900: '동창회 사진 공유 (무료)',
  student_year_9000: '동창회 사진 공유 (무료)',
  work_soho_9900: '업무 공유 · 소호 ~5인 (월 9,900원)',
  work_soho_year_99000: '업무 공유 · 소호 ~5인 (연 99,000원)',
  work_biz_19000: '업무 공유 · 소기업 ~20인 (월 19,000원)',
  work_biz_year_190000: '업무 공유 · 소기업 ~20인 (연 190,000원)',
  work_biz_19900: '업무 공유 · 소기업 ~20인 (월 19,000원)',
  work_biz_year_199000: '업무 공유 · 소기업 ~20인 (연 190,000원)',
  work_pro_29000: '업무 공유 · 중소기업 ~50인 (월 29,000원)',
  work_pro_year_290000: '업무 공유 · 중소기업 ~50인 (연 290,000원)',
};

export function formatLoungeBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, idx)).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export { LoungeModeSwitcherBar, HostThreeBodyControlPanel } from './LoungeSharedComponents';
