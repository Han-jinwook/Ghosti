import type { PricingPlanId } from '../types/saysee';

export interface SubscriptionPlanSpec {
  id: PricingPlanId;
  canonicalId: PricingPlanId;
  category: 'personal' | 'work';
  badge: string;
  title: string;
  subtitle: string;
  priceCoins: number;
  priceKrwLabel: string;
  durationDays: number;
  durationLabel: string;
  discountNote?: string;
  benefits: string[];
  switchPairPlanId?: PricingPlanId;
  switchPairLabel?: string;
}

export const PENDING_SUB_CHECKOUT_STORAGE_KEY = 'ghosti_pending_sub_checkout_v1';

const PERSONAL_BENEFITS: string[] = [
  '내 스마트폰 · 집 PC · 회사 PC 대수 무제한 통합 연결 & 밖에서 내 PC 사진·문서 1초 검색',
  '무버튼 양방향 암호화 클립보드(E2EE) + F1~F6 내 상용구 전 기기 동기화',
  '귀신검색(사진·표 OCR 창 · 라벨러) + 귀신창(스샷·PDF 변환 · 다중합본 · 창고정) 전 기기 무제한 해금',
];

const WORK_SOHO_BENEFITS: string[] = [
  '5인 이하 팀원 전원 무료 · 대표 1인 정액제로 윈도우 탐색기 S: 공용 드라이브 직결',
  '엑셀·한글·PDF·워드·도면 1초 본문 시맨틱 검색 + 동시 편집 잠금(File Lock)',
  '공용 PC(S:) 1대 + 백업 PC 1·2호 실시간 원본 미러링 & 랜섬웨어 격리 방어',
];

const WORK_BIZ_BENEFITS: string[] = [
  '20인 이하 팀원 전원 무료 · 부서별 S: 드라이브 폴더 권한 관리 & 팀 상용구 배포',
  '계약서·단가표·도면·현장사진 1초 시맨틱 검색 + 다중 백업 PC 실시간 복제',
  '외부 클라우드 월세 0원 · 사내 PC 직결 E2EE 암호화 금고',
];

const WORK_PRO_BENEFITS: string[] = [
  '50인 이하 전사 팀원 전원 무료 · 전사 문서·도면·현장사진 통합 금고(S: 드라이브)',
  '다중 백업 PC 실시간 미러링 + 랜섬웨어 0.01초 서킷 브레이커 자동 방어',
  '대표 1인 정액제 · 인당 추가 과금 0원',
];

export const SUBSCRIPTION_PLAN_CATALOG: Record<string, SubscriptionPlanSpec> = {
  personal_sub_3900: {
    id: 'personal_sub_3900',
    canonicalId: 'personal_sub_3900',
    category: 'personal',
    badge: '5번 내 기기 통합 · 월간 이용권',
    title: '내 기기 통합 (30일 이용권)',
    subtitle: 'PC + 폰 + 서브 PC 대수 무제한 · 귀신창·OCR 유료 확장 포함',
    priceCoins: 3900,
    priceKrwLabel: '3,900원',
    durationDays: 30,
    durationLabel: '30일',
    benefits: PERSONAL_BENEFITS,
    switchPairPlanId: 'personal_year_39000',
    switchPairLabel: '연간 39,000원 (2개월 무료)로 변경',
  },
  personal_year_39000: {
    id: 'personal_year_39000',
    canonicalId: 'personal_year_39000',
    category: 'personal',
    badge: '5번 내 기기 통합 · 연간 이용권 (2개월 무료)',
    title: '내 기기 통합 (365일 연간 이용권)',
    subtitle: '월 3,250원꼴 · 1년간 PC·폰 무제한 통합 + 귀신창 유료 확장',
    priceCoins: 39000,
    priceKrwLabel: '39,000원',
    durationDays: 365,
    durationLabel: '365일 (1년)',
    discountNote: '정가 대비 7,800원 절약 (2개월 무료)',
    benefits: PERSONAL_BENEFITS,
    switchPairPlanId: 'personal_sub_3900',
    switchPairLabel: '월간 3,900원 (30일)로 변경',
  },
  personal_year_35000: {
    id: 'personal_year_35000',
    canonicalId: 'personal_year_39000',
    category: 'personal',
    badge: '5번 내 기기 통합 · 연간 이용권 (2개월 무료)',
    title: '내 기기 통합 (365일 연간 이용권)',
    subtitle: '월 3,250원꼴 · 1년간 PC·폰 무제한 통합 + 귀신창 유료 확장',
    priceCoins: 39000,
    priceKrwLabel: '39,000원',
    durationDays: 365,
    durationLabel: '365일 (1년)',
    discountNote: '정가 대비 7,800원 절약 (2개월 무료)',
    benefits: PERSONAL_BENEFITS,
    switchPairPlanId: 'personal_sub_3900',
    switchPairLabel: '월간 3,900원 (30일)로 변경',
  },
  work_soho_9900: {
    id: 'work_soho_9900',
    canonicalId: 'work_soho_9900',
    category: 'work',
    badge: '6번 업무 공유 · 소호(~5인) 월간',
    title: '업무 공유 소호 팀 (30일 이용권)',
    subtitle: '활동 인원 ~5인 · 대표 1인 정액제 (팀원 전원 무료)',
    priceCoins: 9900,
    priceKrwLabel: '9,900원',
    durationDays: 30,
    durationLabel: '30일',
    benefits: WORK_SOHO_BENEFITS,
    switchPairPlanId: 'work_soho_year_99000',
    switchPairLabel: '연간 99,000원 (2개월 무료)로 변경',
  },
  work_soho_year_99000: {
    id: 'work_soho_year_99000',
    canonicalId: 'work_soho_year_99000',
    category: 'work',
    badge: '6번 업무 공유 · 소호(~5인) 연간',
    title: '업무 공유 소호 팀 (365일 연간 이용권)',
    subtitle: '월 8,250원꼴 · 활동 인원 ~5인 · 팀원 전원 무료',
    priceCoins: 99000,
    priceKrwLabel: '99,000원',
    durationDays: 365,
    durationLabel: '365일 (1년)',
    discountNote: '정가 대비 19,800원 절약 (2개월 무료)',
    benefits: WORK_SOHO_BENEFITS,
    switchPairPlanId: 'work_soho_9900',
    switchPairLabel: '월간 9,900원 (30일)로 변경',
  },
  work_biz_19000: {
    id: 'work_biz_19000',
    canonicalId: 'work_biz_19000',
    category: 'work',
    badge: '6번 업무 공유 · 소기업(~20인) 월간',
    title: '업무 공유 소기업 (30일 이용권)',
    subtitle: '활동 인원 ~20인 · 대표 1인 정액제 (팀원 전원 무료)',
    priceCoins: 19000,
    priceKrwLabel: '19,000원',
    durationDays: 30,
    durationLabel: '30일',
    benefits: WORK_BIZ_BENEFITS,
    switchPairPlanId: 'work_biz_year_190000',
    switchPairLabel: '연간 190,000원 (2개월 무료)로 변경',
  },
  work_biz_year_190000: {
    id: 'work_biz_year_190000',
    canonicalId: 'work_biz_year_190000',
    category: 'work',
    badge: '6번 업무 공유 · 소기업(~20인) 연간',
    title: '업무 공유 소기업 (365일 연간 이용권)',
    subtitle: '월 15,833원꼴 · 활동 인원 ~20인 · 팀원 전원 무료',
    priceCoins: 190000,
    priceKrwLabel: '190,000원',
    durationDays: 365,
    durationLabel: '365일 (1년)',
    discountNote: '정가 대비 38,000원 절약 (2개월 무료)',
    benefits: WORK_BIZ_BENEFITS,
    switchPairPlanId: 'work_biz_19000',
    switchPairLabel: '월간 19,000원 (30일)로 변경',
  },
  work_biz_19900: {
    id: 'work_biz_19900',
    canonicalId: 'work_biz_19000',
    category: 'work',
    badge: '6번 업무 공유 · 소기업(~20인) 월간',
    title: '업무 공유 소기업 (30일 이용권)',
    subtitle: '활동 인원 ~20인 · 대표 1인 정액제 (팀원 전원 무료)',
    priceCoins: 19000,
    priceKrwLabel: '19,000원',
    durationDays: 30,
    durationLabel: '30일',
    benefits: WORK_BIZ_BENEFITS,
    switchPairPlanId: 'work_biz_year_190000',
    switchPairLabel: '연간 190,000원 (2개월 무료)로 변경',
  },
  work_biz_year_199000: {
    id: 'work_biz_year_199000',
    canonicalId: 'work_biz_year_190000',
    category: 'work',
    badge: '6번 업무 공유 · 소기업(~20인) 연간',
    title: '업무 공유 소기업 (365일 연간 이용권)',
    subtitle: '월 15,833원꼴 · 활동 인원 ~20인 · 팀원 전원 무료',
    priceCoins: 190000,
    priceKrwLabel: '190,000원',
    durationDays: 365,
    durationLabel: '365일 (1년)',
    discountNote: '정가 대비 38,000원 절약 (2개월 무료)',
    benefits: WORK_BIZ_BENEFITS,
    switchPairPlanId: 'work_biz_19000',
    switchPairLabel: '월간 19,000원 (30일)로 변경',
  },
  work_pro_29000: {
    id: 'work_pro_29000',
    canonicalId: 'work_pro_29000',
    category: 'work',
    badge: '6번 업무 공유 · 중소기업(~50인) 월간',
    title: '업무 공유 중소기업 (30일 이용권)',
    subtitle: '활동 인원 ~50인 · 대표 1인 정액제 (팀원 전원 무료)',
    priceCoins: 29000,
    priceKrwLabel: '29,000원',
    durationDays: 30,
    durationLabel: '30일',
    benefits: WORK_PRO_BENEFITS,
    switchPairPlanId: 'work_pro_year_290000',
    switchPairLabel: '연간 290,000원 (2개월 무료)로 변경',
  },
  work_pro_year_290000: {
    id: 'work_pro_year_290000',
    canonicalId: 'work_pro_year_290000',
    category: 'work',
    badge: '6번 업무 공유 · 중소기업(~50인) 연간',
    title: '업무 공유 중소기업 (365일 연간 이용권)',
    subtitle: '월 24,166원꼴 · 활동 인원 ~50인 · 팀원 전원 무료',
    priceCoins: 290000,
    priceKrwLabel: '290,000원',
    durationDays: 365,
    durationLabel: '365일 (1년)',
    discountNote: '정가 대비 58,000원 절약 (2개월 무료)',
    benefits: WORK_PRO_BENEFITS,
    switchPairPlanId: 'work_pro_29000',
    switchPairLabel: '월간 29,000원 (30일)로 변경',
  },
};

export function getSubscriptionPlanSpec(planId?: string | null): SubscriptionPlanSpec | null {
  if (!planId) return null;
  return SUBSCRIPTION_PLAN_CATALOG[planId] || null;
}

export function isPaidSubscriptionPlanId(planId?: string | null): boolean {
  return Boolean(getSubscriptionPlanSpec(planId));
}

export function formatKoreaDateShort(isoOrMs: string | number | null | undefined): string {
  if (!isoOrMs) return '';
  const ts = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs);
  if (!Number.isFinite(ts) || ts <= 0) return '';
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}
