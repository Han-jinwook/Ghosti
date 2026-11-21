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
    icon: '💻',
    label: '내 기기',
    shortPrice: '이메일 로그인 즉시 사용',
    desc: '내 폰·PC 속 손보기 진단과 1초 AI 내용검색',
  },
  {
    id: 'family',
    icon: '👨‍👩‍👧‍👦',
    label: '가족 사진 공유',
    shortPrice: '평생 0원 (인원 무제한 · 사진/동영상 전용)',
    desc: '우리집·본가·처가 사진·동영상 무제한 무료 공유 & 얼굴 여권 1초 찾기 (업무 문서·S: 드라이브 제외)',
  },
  {
    id: 'club',
    icon: '⛰️',
    label: '동호회 · 동창회 사진 공유',
    shortPrice: '평생 0원 (인원 무제한 · 사진/동영상 전용)',
    desc: '동호회·소모임·동창회 사진·동영상 무제한 무료 공유 (카톡 무가입 1초 프리뷰 지원 · 업무 문서 제외)',
  },
  {
    id: 'work',
    icon: '💼',
    label: '업무 공유 (S:)',
    shortPrice: '🎁 30일 무제한 무료체험 (만료 시 유료 잠금🔒 · 로컬 파일 영구 보존) · 월 9,900원 / 연간 결제 2개월 무료',
    desc: '윈도우 탐색기(S:) 직접 마운트 · 엑셀/한글/PDF/워드 계약서 1초 본문 검색 (🛂 인물 여권 미발동)',
  },
];

export const PLAN_BADGE_LABELS: Record<PricingPlanId, string> = {
  free_trial: '✨ 1~4번 무료 (내 기기 + 사진 공유 평생 0원)',
  personal_single_2900: '🩺 내 기기 (찾기·손보기 : 언제나 0원)',
  personal_sub_3900: '👑 5번 내 기기 통합 (🎁 30일 무료체험 / 월 3,900원)',
  personal_year_35000: '👑 5번 내 기기 통합 (연간 결제 39,000원 · 월 3,250원꼴)',
  personal_year_39000: '👑 5번 내 기기 통합 (연간 결제 39,000원 · 월 3,250원꼴)',
  family_home_5900: '👨‍👩‍👧‍👦 4번 사진 공유 (가족 · 우리집 : 평생 0원)',
  family_home_year_59000: '👨‍👩‍👧‍👦 4번 사진 공유 (가족 · 우리집 : 평생 0원)',
  family_three_8900: '👨‍👩‍👧‍👦 4번 사진 공유 (가족 · 양가 3방 : 평생 0원)',
  family_three_year_89000: '👨‍👩‍👧‍👦 4번 사진 공유 (가족 · 양가 3방 : 평생 0원)',
  club_mini_free_300: '⛰️ 4번 사진 공유 (동호회 · 소모임 : 평생 0원)',
  club_mini_2900: '⛰️ 4번 사진 공유 (동호회 · 소모임 : 평생 0원)',
  club_small_4900: '⛰️ 4번 사진 공유 (동호회 · 🎓 동창회 : 평생 0원)',
  club_small_year_49000: '⛰️ 4번 사진 공유 (동호회 · 🎓 동창회 : 평생 0원)',
  club_medium_7900: '⛰️ 4번 사진 공유 (동호회 · 🎓 동창회 : 평생 0원)',
  club_medium_year_79000: '⛰️ 4번 사진 공유 (동호회 · 🎓 동창회 : 평생 0원)',
  club_large_14900: '⛰️ 4번 사진 공유 (동호회 · 🎓 동창회 : 평생 0원)',
  club_large_year_149000: '⛰️ 4번 사진 공유 (동호회 · 🎓 동창회 : 평생 0원)',
  student_sub_900: '🎓 4번 사진 공유 (동창회 · 학급 : 평생 0원)',
  student_year_9000: '🎓 4번 사진 공유 (동창회 · 학급 : 평생 0원)',
  work_soho_9900: '💼 6번 업무 공유 SOHO ~5인 (🎁 30일 무료체험 / 월 9,900원)',
  work_soho_year_99000: '💼 6번 업무 공유 SOHO ~5인 (연 99,000원 · 월 8,250원꼴)',
  work_biz_19000: '💼 6번 업무 공유 소기업 ~20인 (월 19,000원)',
  work_biz_year_190000: '💼 6번 업무 공유 소기업 ~20인 (연 190,000원 · 2개월 무료)',
  work_biz_19900: '💼 6번 업무 공유 소기업 ~20인 (월 19,000원)',
  work_biz_year_199000: '💼 6번 업무 공유 소기업 ~20인 (연 190,000원)',
  work_pro_29000: '💼 6번 업무 공유 중소기업 ~50인 (월 29,000원)',
  work_pro_year_290000: '💼 6번 업무 공유 중소기업 ~50인 (연 290,000원 · 2개월 무료)',
};

export function formatLoungeBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, idx)).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}


export { LoungeModeSwitcherBar, HostThreeBodyControlPanel } from './LoungeSharedComponents';
