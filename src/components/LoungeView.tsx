import React from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { ClubSizeTier, FamilyRoomId, LoungeType, PricingPlanId } from '../types/saysee';
import { FaceMemberInlineBar } from './FaceMemberRegistryModal';

const LOUNGE_TABS: Array<{
  id: LoungeType;
  icon: string;
  label: string;
  shortPrice: string;
  desc: string;
}> = [
  {
    id: 'personal',
    icon: '👤',
    label: '개인 라운지',
    shortPrice: '단품 2,900원 · 월 3,900원',
    desc: '나 혼자 쓰는 No-클라우드 개인 사진·영상·서류 금고',
  },
  {
    id: 'family',
    icon: '👨‍👩‍👧‍👦',
    label: '패밀리 라운지',
    shortPrice: '우리집 월 5,900원 · 양가 3방 월 8,900원',
    desc: '마스터 1인 결제 ➔ 가족 전원 무료 (우리집 단독 / 양가 3방 분리)',
  },
  {
    id: 'club',
    icon: '⛳',
    label: '클럽 라운지',
    shortPrice: '소 4,900원 · 중 7,900원 · 대 14,900원',
    desc: '동호회·모임 마스터 1인 결제 ➔ 회원 전원 무료 (방 1개 기준)',
  },
  {
    id: 'student',
    icon: '🎒',
    label: '10대 학생 라운지',
    shortPrice: '인원 무제한 단일가 월 900원 (연 9,000원)',
    desc: '학급·동아리·친구 모임 구분·인원 제한 없이 단일가 끝 (학생증 로컬 OCR 0.1초 인증)',
  },
];

const PLAN_BADGE_LABELS: Record<PricingPlanId, string> = {
  free_trial: '✨ 무료체험 중',
  personal_single_2900: '👤 개인 단품 클리어 (2,900원)',
  personal_sub_3900: '👤 개인 정기구독 (월 3,900원)',
  personal_year_35000: '👤 개인 연간구독 (연 35,000원)',
  family_home_5900: '🏠 패밀리 우리집 단독 (월 5,900원)',
  family_home_year_59000: '🏠 패밀리 우리집 연간 (연 59,000원)',
  family_three_8900: '👨‍👩‍👧‍👦 패밀리 양가 통합 3방 (월 8,900원)',
  family_three_year_89000: '👨‍👩‍👧‍👦 패밀리 양가 통합 연간 (연 89,000원)',
  club_small_4900: '⛳ 소형 클럽 20명 (월 4,900원)',
  club_small_year_49000: '⛳ 소형 클럽 연간 (연 49,000원)',
  club_medium_7900: '⛳ 중형 클럽 100명 (월 7,900원)',
  club_medium_year_79000: '⛳ 중형 클럽 연간 (연 79,000원)',
  club_large_14900: '⛳ 대형 클럽 무제한 (월 14,900원)',
  club_large_year_149000: '⛳ 대형 클럽 연간 (연 149,000원)',
  student_sub_900: '🎒 10대 학생 단일가 (월 900원)',
  student_year_9000: '🎒 10대 학생 연간 단일가 (연 9,000원)',
};

/**
 * 상단 4대 라운지 스위처 바 (특판 문구 없이 깔끔한 4대 라운지 전환 & 요금제 모달 진입)
 */
export const LoungeModeSwitcherBar: React.FC = () => {
  const {
    activeLoungeType,
    setActiveLoungeType,
    activePricingPlan,
    activatePricingPlan,
    setShowProModal,
    gpuHelper24hActive,
    setDesktopTab,
  } = useSaySeeStore();

  const isPaidActive = activePricingPlan !== 'free_trial';

  return (
    <div className="w-full bg-[#111114] border-b border-white/10 px-4 py-1.5 flex items-center justify-between gap-3 z-50 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="font-label-sm text-[11px] text-zinc-400 font-semibold mr-1 hidden sm:inline">
          라운지 선택:
        </span>
        {LOUNGE_TABS.map((tab) => {
          const active = activeLoungeType === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveLoungeType(tab.id)}
              className={`px-2.5 py-1 rounded-lg font-label-sm text-[11.5px] font-bold flex items-center gap-1 transition-all shrink-0 ${
                active
                  ? 'bg-primary-container/15 border border-primary-container/50 text-primary-container'
                  : 'bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 text-zinc-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {gpuHelper24hActive && (
          <button
            type="button"
            onClick={() => setDesktopTab('sync')}
            className="px-2.5 py-0.5 rounded-full bg-primary-container/15 border border-primary-container/40 text-primary-container font-label-mono text-[10.5px] font-bold"
          >
            ⚡ 24시간 GPU 서버 도우미 가동 중
          </button>
        )}

        <span
          className={`px-2.5 py-0.5 rounded-md font-label-sm text-[11px] font-bold border ${
            isPaidActive
              ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
              : 'bg-zinc-900 border-white/10 text-zinc-300'
          }`}
        >
          {PLAN_BADGE_LABELS[activePricingPlan]}
        </span>

        {isPaidActive && (
          <button
            type="button"
            onClick={() => {
              activatePricingPlan('free_trial');
              setDesktopTab('trial');
            }}
            title="무료체험 모드로 되돌려 서브메뉴 1번 자리 [✨ 무료체험] 탭 다시 표시"
            className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-zinc-200 font-label-sm text-[10.5px]"
          >
            무료체험 탭 복원
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowProModal(true)}
          className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-primary-container font-label-sm text-[11px] font-bold transition-colors"
        >
          💎 4대 라운지 요금표 →
        </button>
      </div>
    </div>
  );
};

/**
 * 서브메뉴 1번 자리 `[✨ 무료체험]` 워크스페이스 (정식 구독 활성화 시 메뉴에서 Auto-Hide)
 */
export const LoungeView: React.FC = () => {
  const {
    activeLoungeType,
    setActiveLoungeType,
    activeFamilyRoom,
    setActiveFamilyRoom,
    clubSizeTier,
    setClubSizeTier,
    studentOcrVerified,
    verifyStudentOcr,
    faceClusters,
    activatePricingPlan,
    setDesktopTab,
    setSearchSpace,
    runTextQuery,
    setShowFaceRegistryModal,
  } = useSaySeeStore();

  const activeClusters = faceClusters.filter((c) => !c.excludedAsPasserby);
  const namedClusters = activeClusters.filter((c) => Boolean(c.registeredName));

  const FAMILY_ROOMS: FamilyRoomId[] = ['우리집', '본가(친가)', '처가(친정)'];
  const CLUB_TIERS: Array<{
    id: ClubSizeTier;
    title: string;
    capacity: string;
    monthly: string;
    yearly: string;
    gpuDaily: string;
    monthlyPlanId: PricingPlanId;
    yearlyPlanId: PricingPlanId;
  }> = [
    {
      id: 'small',
      title: '소형 클럽',
      capacity: '20명 기준 (방 1개)',
      monthly: '월 4,900원',
      yearly: '연 49,000원',
      gpuDaily: '24시간 서버 도우미 일 1,000원',
      monthlyPlanId: 'club_small_4900',
      yearlyPlanId: 'club_small_year_49000',
    },
    {
      id: 'medium',
      title: '중형 클럽',
      capacity: '100명 기준 (방 1개)',
      monthly: '월 7,900원',
      yearly: '연 79,000원',
      gpuDaily: '24시간 서버 도우미 일 2,000원',
      monthlyPlanId: 'club_medium_7900',
      yearlyPlanId: 'club_medium_year_79000',
    },
    {
      id: 'large',
      title: '대형 클럽',
      capacity: '인원 제한 없음 (방 1개)',
      monthly: '월 14,900원',
      yearly: '연 149,000원',
      gpuDaily: '24시간 서버 도우미 일 3,000원',
      monthlyPlanId: 'club_large_14900',
      yearlyPlanId: 'club_large_year_149000',
    },
  ];

  return (
    <main className="flex-1 w-full max-w-[1360px] mx-auto px-5 md:px-8 py-6 flex flex-col gap-5">
      {/* 1. 상단 4대 라운지 무료체험 헤더 & 라운지 탭 선택 */}
      <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold">
                ✨ 무료체험 · Taste Test Step 1~3
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[11px]">
                마스터 1인 결제 ➔ 초대 멤버 전원 무료 · 정식 구독 시 [✨ 무료체험] 탭 자동 숨김(Auto-Hide)
              </span>
            </div>
            <h1 className="font-headline-md text-[20px] md:text-[22px] text-white font-bold mt-1">
              🔒 나·가족·모임만의 No-클라우드 시크릿 라운지 무료체험
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setDesktopTab('dashboard')}
            className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-primary-container font-label-sm text-[12px] font-bold"
          >
            🔍 파워 검색 작업대로 이동 →
          </button>
        </div>

        {/* 4대 라운지 카드형 탭 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {LOUNGE_TABS.map((item) => {
            const isSelected = activeLoungeType === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveLoungeType(item.id)}
                className={`p-4 rounded-xl text-left transition-all flex flex-col justify-between gap-2 border ${
                  isSelected
                    ? 'bg-zinc-900 border-primary-container shadow-[0_0_20px_rgba(32,247,219,0.12)]'
                    : 'bg-zinc-950/70 hover:bg-zinc-900/60 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-headline-sm text-[15px] text-white font-bold flex items-center gap-1.5">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                  {isSelected && (
                    <span className="px-2 py-0.5 rounded bg-primary-container text-zinc-950 font-label-mono text-[10px] font-extrabold">
                      선택됨
                    </span>
                  )}
                </div>
                <p className="font-body-sm text-[11.5px] text-zinc-400 leading-snug">
                  {item.desc}
                </p>
                <span className="font-label-mono text-[11px] text-primary-container font-bold pt-1 border-t border-white/10">
                  {item.shortPrice}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. 선택된 라운지별 전용 공간 구성 & 초심플 기본 요금제 (마스터 1인 결제 ➔ 멤버 전원 무료) */}
      <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
        {activeLoungeType === 'personal' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-headline-sm text-[18px] text-white font-bold">
                  👤 개인 라운지 — 나 혼자 쓰는 No-클라우드 프라이빗 금고
                </h2>
                <p className="font-body-sm text-[12.5px] text-zinc-400 mt-0.5">
                  외부 클라우드 업로드 없이 내 PC와 스마트폰을 직접 연결하여 사진·동영상 전 구간·PDF 서류함을 0.04초 만에 통합 검색하고 정리합니다.
                </p>
              </div>
              <span className="px-3 py-1 rounded-lg bg-zinc-900 border border-white/10 text-zinc-300 font-label-mono text-[11.5px] font-bold">
                ⚡ 24시간 GPU 서버 도우미: 일 1,000원
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="font-label-sm text-[11.5px] text-zinc-400 font-bold">
                    1회 대청소 &amp; 초기 세팅
                  </span>
                  <div className="font-headline-md text-[24px] text-white font-black">
                    단품 클리어 2,900원
                  </div>
                  <p className="font-body-sm text-[12px] text-zinc-400">
                    연사·중복·흐린 사진 주치의 대청소 및 최초 1회 로컬 색인·일치화 제공
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => activatePricingPlan('personal_single_2900')}
                  className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-white font-label-md text-[12.5px] font-bold transition-colors"
                >
                  개인 단품 클리어 2,900원 시작
                </button>
              </div>

              <div className="p-5 rounded-xl bg-zinc-900 border border-primary-container/50 flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="font-label-sm text-[11.5px] text-primary-container font-bold">
                    상시 자동 색인 &amp; 프라이빗 싱크 무제한
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-headline-md text-[24px] text-white font-black">
                      정기 구독 월 3,900원
                    </span>
                    <span className="font-label-mono text-[13px] text-primary-container font-bold">
                      (연 35,000원)
                    </span>
                  </div>
                  <p className="font-body-sm text-[12px] text-zinc-300">
                    동영상 전 구간 타임라인 해부 + 스마트 서류함(PDF/신분증) + 13KB 섀도우 캐시 무제한
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('personal_sub_3900')}
                    className="py-2.5 rounded-xl bg-primary-container text-zinc-950 font-label-md text-[12.5px] font-extrabold"
                  >
                    월 3,900원 구독
                  </button>
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('personal_year_35000')}
                    className="py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-primary-container/40 text-primary-container font-label-md text-[12.5px] font-bold"
                  >
                    연 35,000원 구독
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeLoungeType === 'family' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-headline-sm text-[18px] text-white font-bold">
                  👨‍👩‍👧‍👦 패밀리 라운지 — 마스터 1인 결제 ➔ 가족 전원 무료
                </h2>
                <p className="font-body-sm text-[12.5px] text-zinc-400 mt-0.5">
                  인원수 제한 없이 우리집 단독 라운지(방 1개) 또는 우리집 + 본가(친가) + 처가(친정) 3개 독립 방 분리 구성 중 선택할 수 있습니다.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {FAMILY_ROOMS.map((room) => (
                  <button
                    key={room}
                    type="button"
                    onClick={() => setActiveFamilyRoom(room)}
                    className={`px-3 py-1 rounded-lg font-label-sm text-[11.5px] font-bold border transition-all ${
                      activeFamilyRoom === room
                        ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                        : 'bg-zinc-900 text-zinc-300 border-white/10 hover:bg-zinc-800'
                    }`}
                  >
                    {room === '우리집' ? '🏠 우리집' : room === '본가(친가)' ? '🏡 본가(친가)' : '🌸 처가(친정)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 🏠 우리집 단독 */}
              <div className="p-5 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="font-label-sm text-[11.5px] text-zinc-300 font-bold">
                    🏠 우리집 단독 — 우리집 전용 시크릿 라운지 (방 1개)
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-headline-md text-[24px] text-white font-black">
                      월 5,900원
                    </span>
                    <span className="font-label-mono text-[13px] text-zinc-300 font-bold">
                      (연 59,000원)
                    </span>
                  </div>
                  <p className="font-body-sm text-[12px] text-zinc-400">
                    부부·자녀가 찍은 모든 사진·영상을 방장 PC로 안전하게 모으고 가족 전원 스마트폰에서 0.04초 실명 검색 (최대 인원수 제한 없음)
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('family_home_5900')}
                    className="py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-white font-label-md text-[12.5px] font-bold"
                  >
                    월 5,900원 시작
                  </button>
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('family_home_year_59000')}
                    className="py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-md text-[12.5px] font-bold"
                  >
                    연 59,000원 시작
                  </button>
                </div>
              </div>

              {/* 👨‍👩‍👧‍👦 양가 통합권 */}
              <div className="p-5 rounded-xl bg-zinc-900 border border-primary-container/50 flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="font-label-sm text-[11.5px] text-primary-container font-bold">
                    👨‍👩‍👧‍👦 양가 통합권 — 우리집 + 본가(친가) + 처가(친정) 3개 방 분리 제공
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-headline-md text-[24px] text-white font-black">
                      월 8,900원
                    </span>
                    <span className="font-label-mono text-[13px] text-primary-container font-bold">
                      (연 89,000원)
                    </span>
                  </div>
                  <p className="font-body-sm text-[12px] text-zinc-300">
                    사생활 혼선 없이 [우리집] · [본가(친가)] · [처가(친정)] 3개 방을 완벽히 분리 제공하며 손주·가족 사진을 원하는 방에만 자동 배포합니다.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('family_three_8900')}
                    className="py-2.5 rounded-xl bg-primary-container text-zinc-950 font-label-md text-[12.5px] font-extrabold"
                  >
                    양가 3방 월 8,900원
                  </button>
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('family_three_year_89000')}
                    className="py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-primary-container/40 text-primary-container font-label-md text-[12.5px] font-bold"
                  >
                    연 89,000원 시작
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeLoungeType === 'club' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-headline-sm text-[18px] text-white font-bold">
                  ⛳ 클럽 라운지 (소 / 중 / 대 3단계 — 방 1개 기준)
                </h2>
                <p className="font-body-sm text-[12.5px] text-zinc-400 mt-0.5">
                  골프·등산·런닝·동호회 총무(마스터) 1인 결제로 회원 전원 무료! 각 클럽권은 방 1개 기준이며, 소모임/파트별 방 분리를 원할 경우 소형 클럽 등을 별도 추가 구매하실 수 있습니다.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {CLUB_TIERS.map((tier) => {
                const isSelected = clubSizeTier === tier.id;
                return (
                  <div
                    key={tier.id}
                    onClick={() => setClubSizeTier(tier.id)}
                    className={`p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between gap-3 border ${
                      isSelected
                        ? 'bg-zinc-900 border-primary-container'
                        : 'bg-zinc-950/80 border-white/10 hover:bg-zinc-900/60'
                    }`}
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-headline-sm text-[15px] text-white font-bold">
                          {tier.title}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-zinc-800 border border-white/10 text-zinc-300 font-label-mono text-[10.5px]">
                          {tier.capacity}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="font-headline-md text-[22px] text-white font-black">
                          {tier.monthly}
                        </span>
                        <span className="font-label-mono text-[12px] text-primary-container font-bold">
                          ({tier.yearly})
                        </span>
                      </div>
                      <span className="font-label-mono text-[11px] text-zinc-400">
                        ⚡ {tier.gpuDaily}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          activatePricingPlan(tier.monthlyPlanId);
                        }}
                        className="py-2 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold"
                      >
                        {tier.monthly}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          activatePricingPlan(tier.yearlyPlanId);
                        }}
                        className="py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[11.5px] font-bold"
                      >
                        {tier.yearly}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeLoungeType === 'student' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-headline-sm text-[18px] text-white font-bold">
                  🎒 10대 학생 라운지 — 구분·인원 제한 없이 단일가 끝!
                </h2>
                <p className="font-body-sm text-[12.5px] text-zinc-400 mt-0.5">
                  학급·동아리·수련회·체육대회 인원수 상관없이 라운지 1개 개설 시 무조건 <strong className="text-white">월 900원 (연 9,000원)</strong> 단일 요금으로 제공됩니다.
                </p>
              </div>
              <span className="px-3 py-1 rounded-lg bg-zinc-900 border border-white/10 text-zinc-300 font-label-mono text-[11.5px] font-bold">
                ⚡ 24시간 GPU 서버 도우미: 일 1,000원
              </span>
            </div>

            <div className="p-5 rounded-xl bg-zinc-900 border border-primary-container/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold">
                    인원 무제한 단일가
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded font-label-mono text-[11px] font-bold border ${
                      studentOcrVerified
                        ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                        : 'bg-zinc-950 border-white/10 text-zinc-300'
                    }`}
                  >
                    {studentOcrVerified
                      ? '✓ 학생증 로컬 OCR 0.1초 인증 완료 (외부 전송 0 Byte)'
                      : '🔒 학생증 로컬 OCR 0.1초 인증 대기'}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-headline-md text-[26px] text-white font-black">
                    월 900원
                  </span>
                  <span className="font-label-mono text-[14px] text-primary-container font-bold">
                    (연 9,000원 · 인원 제한 없음)
                  </span>
                </div>
                <p className="font-body-sm text-[12px] text-zinc-300">
                  학생증 사진 1장을 로컬 RAM에서 0.1초 OCR 판독 후 즉시 폐기하여 개인정보 유출 걱정이 없습니다.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {!studentOcrVerified && (
                  <button
                    type="button"
                    onClick={verifyStudentOcr}
                    className="px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-primary-container/50 text-primary-container font-label-md text-[12.5px] font-bold"
                  >
                    🪪 학생증 로컬 OCR 0.1초 인증
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => activatePricingPlan('student_sub_900')}
                  className="px-4 py-2.5 rounded-xl bg-primary-container text-zinc-950 font-label-md text-[12.5px] font-extrabold"
                >
                  월 900원 개설
                </button>
                <button
                  type="button"
                  onClick={() => activatePricingPlan('student_year_9000')}
                  className="px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-md text-[12.5px] font-bold"
                >
                  연 9,000원 개설
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3. Taste Test Step 1~3: 자율 얼굴 검출(Face Crop) & 당해 연도 대표 얼굴 멤버 등록 + 실명 검색 & 초대 멤버 레이더 매칭 */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <span className="font-headline-sm text-[16px] text-white font-bold">
              👤 Step 1. 자율 얼굴 검출 크롭 &amp; 당해 연도 대표 얼굴 멤버 등록 (실명 검색 즉시 연동)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowFaceRegistryModal(true)}
            className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-bold"
          >
            전체 인물 관리 &amp; 사진 추가 검출 모달 열기 →
          </button>
        </div>

        {/* 실제 Canvas 얼굴 크롭 & 인터랙티브 이름 등록 인라인 바 */}
        <FaceMemberInlineBar
          onRunRealNameQuery={(query, targetSpace) => {
            setDesktopTab('dashboard');
            setSearchSpace(targetSpace);
            void runTextQuery(query);
          }}
        />

        {/* Step 2~3 초대 멤버 레이더 매칭 시드 & 원터치 실명 검색 체험 */}
        <div className="p-4 rounded-2xl bg-[#18181B] border border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="font-label-md text-[12.5px] text-white font-bold">
              📡 Step 2~3. 초대 멤버 스마트폰 ‘얼굴 레이더 매칭’ 시드(Seed) 자동 생성 현황
            </span>
            <p className="font-body-sm text-[12px] text-zinc-400">
              방장이 등록한 얼굴 아바타({namedClusters.length}명 등록됨 / 전체 {activeClusters.length}명)의 768차원 특징량과 촬영 날짜가 초대 링크 시드로 결합되어, 멤버 폰에서 함께 찍힌 사진만 0.1초 만에 자동 골라냅니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {namedClusters.map((c) => (
              <button
                key={c.clusterId}
                type="button"
                onClick={() => {
                  setDesktopTab('dashboard');
                  setSearchSpace('gallery');
                  void runTextQuery(`${c.registeredName} 바다`);
                }}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-primary-container/40 text-primary-container font-label-sm text-[11.5px] font-bold"
              >
                🔍 “{c.registeredName} 바다” 실명 검색 테스트 →
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};
