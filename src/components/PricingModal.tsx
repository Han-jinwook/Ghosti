import React, { useEffect, useRef } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { GpuHelperTierId, PricingPlanId } from '../types/saysee';
import { LoungeModeSwitcherBar } from './LoungeView';

const PLAN_LABELS: Record<PricingPlanId, string> = {
  free_trial: '✨ 무료체험 모드 이용 중',
  personal_single_2900: '👤 개인 라운지 • 단품 클리어 (2,900원)',
  personal_sub_3900: '👤 개인 라운지 • 정기 구독 (월 3,900원)',
  personal_year_35000: '👤 개인 라운지 • 연간 구독 (연 35,000원)',
  family_home_5900: '🏠 패밀리 라운지 • 우리집 단독 (월 5,900원)',
  family_home_year_59000: '🏠 패밀리 라운지 • 우리집 단독 (연 59,000원)',
  family_three_8900: '👨‍👩‍👧‍👦 패밀리 라운지 • 양가 통합권 3방 (월 8,900원)',
  family_three_year_89000: '👨‍👩‍👧‍👦 패밀리 라운지 • 양가 통합권 3방 (연 89,000원)',
  club_small_4900: '⛳ 클럽 라운지 • 소형 클럽 20명 (월 4,900원)',
  club_small_year_49000: '⛳ 클럽 라운지 • 소형 클럽 20명 (연 49,000원)',
  club_medium_7900: '⛳ 클럽 라운지 • 중형 클럽 100명 (월 7,900원)',
  club_medium_year_79000: '⛳ 클럽 라운지 • 중형 클럽 100명 (연 79,000원)',
  club_large_14900: '⛳ 클럽 라운지 • 대형 클럽 무제한 (월 14,900원)',
  club_large_year_149000: '⛳ 클럽 라운지 • 대형 클럽 무제한 (연 149,000원)',
  student_sub_900: '🎒 스쿨 라운지 (초·중·고 반/동아리 특가 월 900원)',
  student_year_9000: '🎒 스쿨 라운지 (초·중·고 반/동아리 특가 연 9,000원)',
};

/**
 * 상단 4대 라운지 스위처 바 (특판 문구 0%)
 */
export const FoundingMemberFomoBar: React.FC = () => {
  return <LoungeModeSwitcherBar />;
};

/**
 * [4대 라운지 초심플 기본 요금제 + ⚡ 24시간 GPU 클라우드 서버 도우미] 모달
 * - 주의: 특판(평생권/10년권) 언급 완전 배제, 순수 요금 구조만 깔끔하게 표시
 */
export const PricingModal: React.FC = () => {
  const {
    showProModal,
    setShowProModal,
    activePricingPlan,
    activatePricingPlan,
    studentOcrVerified,
    verifyStudentOcr,
    gpuHelper24hActive,
    gpuHelperActiveTier,
    activateGpuHelper24h,
    setDesktopTab,
  } = useSaySeeStore();

  if (!showProModal) return null;

  const GPU_HELPER_TIERS: Array<{
    id: GpuHelperTierId;
    title: string;
    targetDesc: string;
    priceText: string;
  }> = [
    {
      id: 'standard_1000',
      title: '개인 / 패밀리 / 스쿨 라운지',
      targetDesc: '방장 PC OFF 시 24시간 대행',
      priceText: '24시간 당 1,000원',
    },
    {
      id: 'club_small_1000',
      title: '소형 클럽 (~20명)',
      targetDesc: '소형 클럽 라운지 24시간 대행',
      priceText: '24시간 당 1,000원',
    },
    {
      id: 'club_medium_2000',
      title: '중형 클럽 (~100명)',
      targetDesc: '중형 클럽 라운지 24시간 대행',
      priceText: '24시간 당 2,000원',
    },
    {
      id: 'club_large_3000',
      title: '대형 클럽 (무제한)',
      targetDesc: '대형 클럽 라운지 24시간 대행',
      priceText: '24시간 당 3,000원',
    },
  ];

  return (
    <div
      onClick={() => setShowProModal(false)}
      className="fixed inset-0 z-[105] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl rounded-3xl bg-[#121215] border border-white/15 p-6 md:p-8 shadow-2xl flex flex-col gap-6 my-auto"
      >
        {/* 모달 헤더 */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold">
                마스터 1인 결제 ➔ 초대 멤버 전원 무료
              </span>
              <span className="px-3 py-1 rounded-full bg-zinc-900 border border-white/10 text-zinc-300 font-label-mono text-[11px] font-bold">
                현재 상태: {PLAN_LABELS[activePricingPlan]}
              </span>
              {activePricingPlan !== 'free_trial' && (
                <button
                  type="button"
                  onClick={() => {
                    activatePricingPlan('free_trial');
                    setDesktopTab('trial');
                  }}
                  className="px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-zinc-200 font-label-sm text-[11px] font-bold"
                >
                  ✨ 무료체험 모드로 전환
                </button>
              )}
            </div>
            <h2 className="font-headline-lg text-[22px] md:text-[26px] text-white font-black tracking-tight mt-1">
              🔒 4대 시크릿 라운지 초심플 기본 요금제 &amp; 24시간 서버 도우미
            </h2>
            <p className="font-body-sm text-[13px] text-zinc-400">
              방장(마스터) 1명만 결제하면 초대받은 가족·모임·동아리 멤버 전원은 100% 무료로 참여합니다. 정식 구독 활성화 시 상단 서브메뉴의 [✨ 무료체험] 탭은 자동으로 숨김(Auto-Hide) 처리됩니다.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowProModal(false)}
            className="w-9 h-9 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-200 shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* 1. 4대 라운지 초심플 기본 요금제 (마스터 1인 결제 ➔ 멤버 전원 무료) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ① 👤 개인 라운지 */}
          <div className="p-5 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[11.5px] font-bold">
                  1. 개인 전용
                </span>
                <span className="font-label-mono text-[11px] text-zinc-400">
                  나 혼자 쓰는 No-클라우드 금고
                </span>
              </div>
              <h3 className="font-headline-sm text-[19px] text-white font-extrabold">
                👤 개인 라운지
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div className="p-3.5 rounded-xl bg-zinc-950/90 border border-white/10 flex flex-col justify-between gap-2">
                  <div>
                    <span className="font-label-sm text-[11px] text-zinc-400 font-semibold">
                      단품 클리어 (1회 대청소)
                    </span>
                    <div className="font-headline-md text-[20px] text-white font-black mt-0.5">
                      2,900원
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('personal_single_2900')}
                    className="w-full py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-white font-label-sm text-[12px] font-bold"
                  >
                    단품 2,900원 결제
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900 border border-primary-container/40 flex flex-col justify-between gap-2">
                  <div>
                    <span className="font-label-sm text-[11px] text-primary-container font-bold">
                      정기 구독 (상시 색인·싱크)
                    </span>
                    <div className="font-headline-md text-[20px] text-white font-black mt-0.5">
                      월 3,900원
                    </div>
                    <span className="font-label-mono text-[11.5px] text-primary-container font-bold">
                      (연 35,000원)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('personal_sub_3900')}
                      className="py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold"
                    >
                      월 3,900원
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('personal_year_35000')}
                      className="py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[11.5px] font-bold"
                    >
                      연 35,000원
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ② 👨‍👩‍👧‍👦 패밀리 라운지 (최대 인원수 제한 문구 삭제) */}
          <div className="p-5 rounded-2xl bg-[#18181B] border border-primary-container/45 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-primary-container/15 border border-primary-container/40 text-primary-container font-label-sm text-[11.5px] font-bold">
                  2. 가족 공유 • 마스터 1인 결제 ➔ 가족 전원 무료
                </span>
              </div>
              <h3 className="font-headline-sm text-[19px] text-white font-extrabold">
                👨‍👩‍👧‍👦 패밀리 라운지
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {/* 🏠 우리집 단독 */}
                <div className="p-3.5 rounded-xl bg-zinc-950/90 border border-white/10 flex flex-col justify-between gap-2">
                  <div>
                    <span className="font-label-sm text-[11.5px] text-zinc-200 font-bold">
                      🏠 우리집 단독 (방 1개)
                    </span>
                    <div className="font-headline-md text-[20px] text-white font-black mt-0.5">
                      월 5,900원
                    </div>
                    <span className="font-label-mono text-[11.5px] text-zinc-300 font-bold">
                      (연 59,000원)
                    </span>
                    <p className="font-body-sm text-[11px] text-zinc-400 mt-1">
                      우리집 전용 시크릿 라운지 (방 1개)
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('family_home_5900')}
                      className="py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-white font-label-sm text-[11.5px] font-bold"
                    >
                      월 5,900원
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('family_home_year_59000')}
                      className="py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[11.5px] font-bold"
                    >
                      연 59,000원
                    </button>
                  </div>
                </div>

                {/* 👨‍👩‍👧‍👦 양가 통합권 */}
                <div className="p-3.5 rounded-xl bg-zinc-900 border border-primary-container/50 flex flex-col justify-between gap-2">
                  <div>
                    <span className="font-label-sm text-[11.5px] text-primary-container font-bold">
                      👨‍👩‍👧‍👦 양가 통합권 (3개 방 분리)
                    </span>
                    <div className="font-headline-md text-[20px] text-white font-black mt-0.5">
                      월 8,900원
                    </div>
                    <span className="font-label-mono text-[11.5px] text-primary-container font-bold">
                      (연 89,000원)
                    </span>
                    <p className="font-body-sm text-[11px] text-zinc-300 mt-1">
                      우리집 + 본가(친가) + 처가(친정) 3개 방 분리 제공
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('family_three_8900')}
                      className="py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold"
                    >
                      월 8,900원
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('family_three_year_89000')}
                      className="py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[11.5px] font-bold"
                    >
                      연 89,000원
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ③ ⛳ 클럽 라운지 (소 / 중 / 대 3단계 — 방 1개 기준) */}
          <div className="p-5 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[11.5px] font-bold">
                  3. 동호회·모임 • 소 / 중 / 대 3단계 (방 1개 기준)
                </span>
              </div>
              <h3 className="font-headline-sm text-[19px] text-white font-extrabold">
                ⛳ 클럽 라운지
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                {/* 소형 클럽 */}
                <div className="p-3 rounded-xl bg-zinc-950/90 border border-white/10 flex flex-col justify-between gap-2">
                  <div>
                    <span className="font-label-sm text-[11px] text-zinc-300 font-bold">
                      소형 클럽 (20명 기준)
                    </span>
                    <div className="font-headline-sm text-[17px] text-white font-black mt-0.5">
                      월 4,900원
                    </div>
                    <span className="font-label-mono text-[11px] text-zinc-400">
                      (연 49,000원)
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('club_small_4900')}
                      className="w-full py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-label-sm text-[11px] font-bold"
                    >
                      월 4,900원
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('club_small_year_49000')}
                      className="w-full py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 font-label-sm text-[10.5px]"
                    >
                      연 49,000원
                    </button>
                  </div>
                </div>

                {/* 중형 클럽 */}
                <div className="p-3 rounded-xl bg-zinc-900 border border-primary-container/40 flex flex-col justify-between gap-2">
                  <div>
                    <span className="font-label-sm text-[11px] text-primary-container font-bold">
                      중형 클럽 (100명 기준)
                    </span>
                    <div className="font-headline-sm text-[17px] text-white font-black mt-0.5">
                      월 7,900원
                    </div>
                    <span className="font-label-mono text-[11px] text-primary-container font-bold">
                      (연 79,000원)
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('club_medium_7900')}
                      className="w-full py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold"
                    >
                      월 7,900원
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('club_medium_year_79000')}
                      className="w-full py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[10.5px]"
                    >
                      연 79,000원
                    </button>
                  </div>
                </div>

                {/* 대형 클럽 */}
                <div className="p-3 rounded-xl bg-zinc-950/90 border border-white/10 flex flex-col justify-between gap-2">
                  <div>
                    <span className="font-label-sm text-[11px] text-zinc-300 font-bold">
                      대형 클럽 (인원 무제한)
                    </span>
                    <div className="font-headline-sm text-[17px] text-white font-black mt-0.5">
                      월 14,900원
                    </div>
                    <span className="font-label-mono text-[11px] text-zinc-400">
                      (연 149,000원)
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('club_large_14900')}
                      className="w-full py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-label-sm text-[11px] font-bold"
                    >
                      월 14,900원
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('club_large_year_149000')}
                      className="w-full py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 font-label-sm text-[10.5px]"
                    >
                      연 149,000원
                    </button>
                  </div>
                </div>
              </div>

              <p className="font-body-sm text-[11.5px] text-zinc-400 pt-1">
                ※ 안내 규칙: 각 클럽권은 방 1개 기준이며, 소모임/파트별 방 분리를 원할 경우 소형 클럽 등을 별도 추가 구매.
              </p>
            </div>
          </div>

          {/* ④ 🎒 스쿨 라운지 (초·중·고 반/동아리 특가 월 900원) */}
          <div className="p-5 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-bold">
                  4. 초·중·고 반/동아리 특가 • 인원 무제한 단일가!
                </span>
                <span className="font-label-mono text-[11px] text-zinc-400">
                  학생증 로컬 OCR 0.1초 인증
                </span>
              </div>
              <h3 className="font-headline-sm text-[19px] text-white font-extrabold">
                🎒 스쿨 라운지 (초·중·고 반/동아리 특가 월 900원)
              </h3>

              <div className="p-4 rounded-xl bg-zinc-900 border border-primary-container/40 flex flex-col justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-headline-md text-[24px] text-white font-black">
                      월 900원
                    </span>
                    <span className="font-label-mono text-[13px] text-primary-container font-bold">
                      (연 9,000원) 단일 요금
                    </span>
                  </div>
                  <p className="font-body-sm text-[12px] text-zinc-300 leading-relaxed">
                    초·중·고 반/동아리 인원수 상관없이 라운지 1개 개설 시 무조건 월 900원 (연 9,000원) 단일 요금 (학생증 로컬 OCR 0.1초 인증).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={verifyStudentOcr}
                    className={`px-3 py-2 rounded-lg font-label-sm text-[11.5px] font-bold border ${
                      studentOcrVerified
                        ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                        : 'bg-zinc-950 hover:bg-zinc-800 border-white/15 text-zinc-200'
                    }`}
                  >
                    {studentOcrVerified ? '✓ 학생증 OCR 0.1초 인증됨' : '🪪 학생증 로컬 OCR 0.1초 인증'}
                  </button>
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('student_sub_900')}
                    className="px-4 py-2 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold"
                  >
                    월 900원 결제
                  </button>
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('student_year_9000')}
                    className="px-4 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[12px] font-bold"
                  >
                    연 9,000원 결제
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. [🛠️ 설정도우미] 내 '⚡ 24시간 GPU 클라우드 서버 도우미' 초특가 요금 반영 */}
        <div className="p-5 rounded-2xl bg-[#18181B] border border-primary-container/40 flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold">
                🛠️ 설정도우미 핵심 옵션
              </span>
              <h3 className="font-headline-sm text-[17px] text-white font-extrabold">
                ⚡ 24시간 GPU 클라우드 서버 도우미 (방장 PC OFF 시 원터치 일일 대여)
              </h3>
            </div>
            {gpuHelper24hActive && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-label-mono text-[11px] font-bold">
                🟢 현재 24시간 GPU 도우미 가동 중
              </span>
            )}
          </div>

          <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed bg-zinc-950/80 p-3.5 rounded-xl border border-white/10">
            내 PC가 꺼져 있을 때 단돈 1,000원(중·대형 클럽 2,000~3,000원)으로 24시간 동안 초고속 GPU 클라우드 도우미를 즉시 가동합니다. 멤버들이 올린 사진·영상의 Gemma 2 인덱싱과 캐시 배포를 실시간 대행하며, 추후 내 PC가 켜지면 원본을 내 PC로 안전하게 이관한 뒤 클라우드에서는 100% 자동 소각됩니다.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {GPU_HELPER_TIERS.map((tier) => {
              const isSelected = gpuHelper24hActive && gpuHelperActiveTier === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => {
                    activateGpuHelper24h(tier.id);
                    setShowProModal(false);
                  }}
                  className={`p-3.5 rounded-xl text-left transition-all flex flex-col justify-between gap-1.5 border ${
                    isSelected
                      ? 'bg-zinc-900 border-primary-container'
                      : 'bg-zinc-950/90 hover:bg-zinc-900 border-white/10'
                  }`}
                >
                  <span className="font-label-sm text-[11.5px] text-zinc-200 font-bold">
                    {tier.title}
                  </span>
                  <span className="font-headline-sm text-[16px] text-primary-container font-black">
                    {tier.priceText}
                  </span>
                  <span className="font-body-sm text-[11px] text-zinc-400">
                    {tier.targetDesc} · 즉시 가동 →
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * [스펙 1] 스마트 서류함 내 로컬 PDF/TXT/DOCX 문서 상세 열람 모달
 */
export const LocalDocPreviewModal: React.FC = () => {
  const { selectedDocModal, setSelectedDocModal, openLocalFolder } = useSaySeeStore();
  if (!selectedDocModal) return null;

  return (
    <div
      onClick={() => setSelectedDocModal(null)}
      className="fixed inset-0 z-[105] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-3xl bg-surface-container-low border border-primary-container/50 p-6 md:p-7 shadow-2xl flex flex-col gap-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-on-primary-container font-label-mono text-[11px] font-black">
                {selectedDocModal.ext} 문서 자산
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container-highest text-primary font-label-sm text-[11px] font-bold">
                {selectedDocModal.categoryBadge}
              </span>
              <span className="font-label-mono text-[11px] text-on-surface-variant">
                • {selectedDocModal.deviceSource}
              </span>
            </div>
            <h3 className="font-headline-sm text-[19px] text-on-surface font-extrabold mt-1">
              {selectedDocModal.title}
            </h3>
            <p className="font-label-mono text-[11.5px] text-on-surface-variant">
              파일명: {selectedDocModal.fileName} • 날짜: {selectedDocModal.date} • 크기:{' '}
              {(selectedDocModal.sizeKB / 1024).toFixed(2)} MB
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSelectedDocModal(null)}
            className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-2">
          <span className="font-label-mono text-[11px] text-primary-container font-bold">
            🔍 자체 로컬 서버 휘발성 텍스트/OCR 색인 본문 미리보기 (하드디스크 저장 0건 • RAM 연산 후 0.1초 내 즉시 자동 소각)
          </span>
          <p className="font-body-md text-[14px] text-on-surface leading-relaxed">
            {selectedDocModal.extractedText}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-2">
            {selectedDocModal.keywords.map((kw) => (
              <span
                key={kw}
                className="px-2.5 py-0.5 rounded-full bg-primary-container/15 text-primary-container font-label-sm text-[11px] font-bold"
              >
                #{kw}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => void openLocalFolder('docs')}
            className="px-4 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-label-md text-[13px] font-extrabold flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">folder_open</span>
            <span>로컬 서류함 폴더(test_docs) 열기</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedDocModal(null)}
            className="px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-label-md text-[13px] font-bold"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * [체험판 타겟 ②] 동영상 3개 전 구간(Full-Timeline) 해부 & 타임라인 점프 재생 모달
 */
export const VideoScenePreviewModal: React.FC = () => {
  const { selectedVideoModal, setSelectedVideoModal, openLocalFolder } = useSaySeeStore();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!selectedVideoModal) return;
    const vidEl = videoRef.current;
    if (!vidEl) return;

    const targetSec = selectedVideoModal.matchedSeekSec ?? 0;
    const applySeek = () => {
      try {
        vidEl.currentTime = targetSec;
        void vidEl.play().catch(() => {
          // 자동재생 정책 제한 시 일시정지 상태로 해당 초(Sec) 프레임 표시
        });
      } catch {
        // ignore
      }
    };

    if (vidEl.readyState >= 1) {
      applySeek();
    } else {
      vidEl.addEventListener('loadedmetadata', applySeek, { once: true });
      return () => vidEl.removeEventListener('loadedmetadata', applySeek);
    }
  }, [selectedVideoModal?.id, selectedVideoModal?.matchedSeekSec]);

  if (!selectedVideoModal) return null;

  const handleJumpToSecond = (sec: number) => {
    setSelectedVideoModal(selectedVideoModal, sec);
    if (videoRef.current) {
      try {
        videoRef.current.currentTime = sec;
        void videoRef.current.play().catch(() => {});
      } catch {
        // ignore
      }
    }
  };

  return (
    <div
      onClick={() => setSelectedVideoModal(null)}
      className="fixed inset-0 z-[105] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl rounded-3xl bg-surface-container-low border-2 border-primary-container/60 p-5 md:p-7 shadow-[0_0_64px_rgba(0,229,255,0.25)] flex flex-col gap-4 my-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-on-primary-container font-label-mono text-[11px] font-black">
                🎬 타임라인 점프 포착 ({selectedVideoModal.matchedTimestamp})
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-label-mono text-[11px] font-bold">
                {selectedVideoModal.resolution} • 전체 길이 {selectedVideoModal.durationText} (총 {selectedVideoModal.timelineFrames.length}개 구간 해부)
              </span>
              <span className="font-label-mono text-[11px] text-on-surface-variant">
                • 📍 {selectedVideoModal.locationKo}
              </span>
            </div>
            <h3 className="font-headline-sm text-[18px] md:text-[20px] text-white font-extrabold mt-1">
              {selectedVideoModal.title}
            </h3>
            <p className="font-label-mono text-[11.5px] text-on-surface-variant">
              원본 파일: {selectedVideoModal.videoFileName} • 촬영일시: {selectedVideoModal.date} • 용량:{' '}
              {selectedVideoModal.sizeMB} MB
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSelectedVideoModal(null)}
            className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* 동영상 플레이어 (실제 test_photos 내 MP4 Byte-Range 스트리밍 + 포착된 초(Sec)로 즉시 점프 재생) */}
        <div className="relative rounded-2xl overflow-hidden bg-black border border-primary-container/40 aspect-video flex items-center justify-center">
          <video
            ref={videoRef}
            src={selectedVideoModal.videoUrl}
            poster={selectedVideoModal.thumbUrl}
            controls
            playsInline
            className="w-full h-full object-contain"
          />
          <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/85 border border-primary-container/70 text-primary-container font-label-mono text-[11.5px] font-black pointer-events-none shadow-lg">
            {selectedVideoModal.matchedTimestamp} 즉시 점프 재생 중
          </div>
        </div>

        {/* 현재 포착된 구간 상세 설명 */}
        <div className="p-3.5 rounded-2xl bg-primary-container/10 border border-primary-container/45 flex flex-col gap-1">
          <span className="font-label-mono text-[11px] text-primary-container font-black">
            🎯 현재 포착된 타임라인 프레임 해설:
          </span>
          <p className="font-body-md text-[13.5px] text-white font-bold leading-relaxed">
            {selectedVideoModal.matchedFrameCaption}
          </p>
        </div>

        {/* 전 구간(Full-Timeline) 1~3초 단위 완전 해부 인터랙티브 타임라인 */}
        <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/35 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-headline-sm text-[13px] text-emerald-300 font-extrabold">
              ⚡ 00:00 ~ {selectedVideoModal.durationText} 전 구간(Full-Timeline) 1~3초 단위 해부 내역 — 클릭 시 해당 초로 즉시 점프합니다:
            </span>
            <span className="font-label-mono text-[10.5px] text-on-surface-variant">
              총 {selectedVideoModal.timelineFrames.length}개 구간 색인됨
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
            {selectedVideoModal.timelineFrames.map((frame) => {
              const isSelectedFrame = selectedVideoModal.matchedSeekSec === frame.timeSec;
              return (
                <button
                  key={frame.timeSec}
                  type="button"
                  onClick={() => handleJumpToSecond(frame.timeSec)}
                  className={`p-2.5 rounded-xl text-left transition-all border flex flex-col gap-1 ${
                    isSelectedFrame
                      ? 'bg-primary-container/20 border-primary-container shadow-[0_0_16px_rgba(0,229,255,0.28)]'
                      : 'bg-surface-container/90 hover:bg-surface-bright border-outline-variant/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded font-label-mono text-[11px] font-black ${
                        isSelectedFrame
                          ? 'bg-primary-container text-on-primary-container'
                          : 'bg-black/60 text-primary-container'
                      }`}
                    >
                      ▶ {frame.timestampText} ({frame.phaseLabel})
                    </span>
                    {isSelectedFrame && (
                      <span className="font-label-mono text-[10px] text-emerald-300 font-black">
                        🎯 현재 포착 구간
                      </span>
                    )}
                  </div>
                  <p className="font-body-sm text-[11.5px] text-on-surface leading-snug line-clamp-2">
                    {frame.sceneCaption}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => void openLocalFolder('photos')}
            className="px-4 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-label-md text-[13px] font-extrabold flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">folder_open</span>
            <span>원본 동영상 폴더(test_photos) 열기</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedVideoModal(null)}
            className="px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-label-md text-[13px] font-bold"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
