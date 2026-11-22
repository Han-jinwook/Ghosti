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
  '스마트폰 · 집 PC · 회사 PC 대수 제한 없이 통합 연결 및 원격 검색',
  '기기 간 실시간 클립보드 공유',
  '사진·표 OCR 창 및 귀신 라벨러 무제한 이용',
];

const WORK_SOHO_BENEFITS: string[] = [
  '5인 이하 팀원 무료 · 윈도우 탐색기 S: 공용 드라이브 연결',
  '엑셀·한글·PDF·워드 본문 검색 및 열람 중 표시',
  '예비 백업 서버 연결 및 퇴근 시간 절전 모드 지원',
];

const WORK_BIZ_BENEFITS: string[] = [
  '20인 이하 팀원 무료 · 부서별 S: 드라이브 폴더 권한 관리',
  '계약서·견적서·도면·현장사진 본문 검색 및 예비 서버 이중화',
  '외부 클라우드 업로드 없이 사내 PC 간 직접 공유',
];

const WORK_PRO_BENEFITS: string[] = [
  '50인 이하 팀원 무료 · 전사 문서·도면·현장사진 통합 관리 (S:)',
  '예비 백업 서버 이중화 및 절전 대기 모드 지원',
  '팀 대표 1인 정액 요금 (인당 추가 비용 없음)',
];

export const SUBSCRIPTION_PLAN_CATALOG: Record<string, SubscriptionPlanSpec> = {
  personal_sub_3900: {
    id: 'personal_sub_3900',
    canonicalId: 'personal_sub_3900',
    category: 'personal',
    badge: '내 기기 통합 · 월간',
    title: '내 기기 통합 Pro (30일)',
    subtitle: 'PC · 모바일 대수 무제한 · 사진·표 OCR · 귀신 라벨러 포함',
    priceCoins: 3900,
    priceKrwLabel: '3,900원',
    durationDays: 30,
    durationLabel: '30일',
    benefits: PERSONAL_BENEFITS,
    switchPairPlanId: 'personal_year_39000',
    switchPairLabel: '연간 39,000원 (2개월 할인)으로 변경',
  },
  personal_year_39000: {
    id: 'personal_year_39000',
    canonicalId: 'personal_year_39000',
    category: 'personal',
    badge: '내 기기 통합 · 연간',
    title: '내 기기 통합 Pro (1년)',
    subtitle: '월 3,250원꼴 · PC·모바일 무제한 통합 + 사진·표 OCR · 라벨러',
    priceCoins: 39000,
    priceKrwLabel: '39,000원',
    durationDays: 365,
    durationLabel: '365일',
    discountNote: '연간 결제 2개월 할인 (7,800원 절약)',
    benefits: PERSONAL_BENEFITS,
    switchPairPlanId: 'personal_sub_3900',
    switchPairLabel: '월간 3,900원으로 변경',
  },
  personal_year_35000: {
    id: 'personal_year_35000',
    canonicalId: 'personal_year_39000',
    category: 'personal',
    badge: '내 기기 통합 · 연간',
    title: '내 기기 통합 Pro (1년)',
    subtitle: '월 3,250원꼴 · PC·모바일 무제한 통합 + 사진·표 OCR · 라벨러',
    priceCoins: 39000,
    priceKrwLabel: '39,000원',
    durationDays: 365,
    durationLabel: '365일',
    discountNote: '연간 결제 2개월 할인 (7,800원 절약)',
    benefits: PERSONAL_BENEFITS,
    switchPairPlanId: 'personal_sub_3900',
    switchPairLabel: '월간 3,900원으로 변경',
  },
  work_soho_9900: {
    id: 'work_soho_9900',
    canonicalId: 'work_soho_9900',
    category: 'work',
    badge: '업무 공유 · 소호(~5인) 월간',
    title: '업무 공유 소호 팀 (30일)',
    subtitle: '5인 이하 · 팀원 추가 비용 없음',
    priceCoins: 9900,
    priceKrwLabel: '9,900원',
    durationDays: 30,
    durationLabel: '30일',
    benefits: WORK_SOHO_BENEFITS,
    switchPairPlanId: 'work_soho_year_99000',
    switchPairLabel: '연간 99,000원 (2개월 할인)으로 변경',
  },
  work_soho_year_99000: {
    id: 'work_soho_year_99000',
    canonicalId: 'work_soho_year_99000',
    category: 'work',
    badge: '업무 공유 · 소호(~5인) 연간',
    title: '업무 공유 소호 팀 (1년)',
    subtitle: '월 8,250원꼴 · 5인 이하 · 팀원 추가 비용 없음',
    priceCoins: 99000,
    priceKrwLabel: '99,000원',
    durationDays: 365,
    durationLabel: '365일',
    discountNote: '연간 결제 2개월 할인 (19,800원 절약)',
    benefits: WORK_SOHO_BENEFITS,
    switchPairPlanId: 'work_soho_9900',
    switchPairLabel: '월간 9,900원으로 변경',
  },
  work_biz_19000: {
    id: 'work_biz_19000',
    canonicalId: 'work_biz_19000',
    category: 'work',
    badge: '업무 공유 · 소기업(~20인) 월간',
    title: '업무 공유 소기업 (30일)',
    subtitle: '20인 이하 · 팀원 추가 비용 없음',
    priceCoins: 19000,
    priceKrwLabel: '19,000원',
    durationDays: 30,
    durationLabel: '30일',
    benefits: WORK_BIZ_BENEFITS,
    switchPairPlanId: 'work_biz_year_190000',
    switchPairLabel: '연간 190,000원 (2개월 할인)으로 변경',
  },
  work_biz_year_190000: {
    id: 'work_biz_year_190000',
    canonicalId: 'work_biz_year_190000',
    category: 'work',
    badge: '업무 공유 · 소기업(~20인) 연간',
    title: '업무 공유 소기업 (1년)',
    subtitle: '월 15,833원꼴 · 20인 이하 · 팀원 추가 비용 없음',
    priceCoins: 190000,
    priceKrwLabel: '190,000원',
    durationDays: 365,
    durationLabel: '365일',
    discountNote: '연간 결제 2개월 할인 (38,000원 절약)',
    benefits: WORK_BIZ_BENEFITS,
    switchPairPlanId: 'work_biz_19000',
    switchPairLabel: '월간 19,000원으로 변경',
  },
  work_biz_19900: {
    id: 'work_biz_19900',
    canonicalId: 'work_biz_19000',
    category: 'work',
    badge: '업무 공유 · 소기업(~20인) 월간',
    title: '업무 공유 소기업 (30일)',
    subtitle: '20인 이하 · 팀원 추가 비용 없음',
    priceCoins: 19000,
    priceKrwLabel: '19,000원',
    durationDays: 30,
    durationLabel: '30일',
    benefits: WORK_BIZ_BENEFITS,
    switchPairPlanId: 'work_biz_year_190000',
    switchPairLabel: '연간 190,000원 (2개월 할인)으로 변경',
  },
  work_biz_year_199000: {
    id: 'work_biz_year_199000',
    canonicalId: 'work_biz_year_190000',
    category: 'work',
    badge: '업무 공유 · 소기업(~20인) 연간',
    title: '업무 공유 소기업 (1년)',
    subtitle: '월 15,833원꼴 · 20인 이하 · 팀원 추가 비용 없음',
    priceCoins: 190000,
    priceKrwLabel: '190,000원',
    durationDays: 365,
    durationLabel: '365일',
    discountNote: '연간 결제 2개월 할인 (38,000원 절약)',
    benefits: WORK_BIZ_BENEFITS,
    switchPairPlanId: 'work_biz_19000',
    switchPairLabel: '월간 19,000원으로 변경',
  },
  work_pro_29000: {
    id: 'work_pro_29000',
    canonicalId: 'work_pro_29000',
    category: 'work',
    badge: '업무 공유 · 중소기업(~50인) 월간',
    title: '업무 공유 중소기업 (30일)',
    subtitle: '50인 이하 · 팀원 추가 비용 없음',
    priceCoins: 29000,
    priceKrwLabel: '29,000원',
    durationDays: 30,
    durationLabel: '30일',
    benefits: WORK_PRO_BENEFITS,
    switchPairPlanId: 'work_pro_year_290000',
    switchPairLabel: '연간 290,000원 (2개월 할인)으로 변경',
  },
  work_pro_year_290000: {
    id: 'work_pro_year_290000',
    canonicalId: 'work_pro_year_290000',
    category: 'work',
    badge: '업무 공유 · 중소기업(~50인) 연간',
    title: '업무 공유 중소기업 (1년)',
    subtitle: '월 24,166원꼴 · 50인 이하 · 팀원 추가 비용 없음',
    priceCoins: 290000,
    priceKrwLabel: '290,000원',
    durationDays: 365,
    durationLabel: '365일',
    discountNote: '연간 결제 2개월 할인 (58,000원 절약)',
    benefits: WORK_PRO_BENEFITS,
    switchPairPlanId: 'work_pro_29000',
    switchPairLabel: '월간 29,000원으로 변경',
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
