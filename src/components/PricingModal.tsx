import React, { useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { GpuHelperTierId, PricingPlanId } from '../types/saysee';
import { GhostiBrandLogo } from './GhostiBrandLogo';
import {
  MASTER_PASS_AUTO_SWITCH_TIERS,
  PcMasterQuickSendPanel,
} from './pricing/PricingAuxiliaryPanels';

export {
  MASTER_PASS_AUTO_SWITCH_TIERS,
  validateClubSignboardName,
  FoundingMemberFomoBar,
  PcMasterQuickSendPanel,
  MobileMasterPcIntroModal,
} from './pricing/PricingAuxiliaryPanels';
export {
  resolveDocExtBadge,
  formatVideoCardOcrSummary,
  buildDocPreviewSnippet,
  renderHighlightedDocText,
  maskSensitiveDocText,
  hasSensitiveDocInfo,
  formatQuickKoreanLabelForFile,
} from './searchModals/docAndVideoFormatUtils';
export { LocalDocPreviewModal } from './searchModals/LocalDocPreviewModal';
export { VideoScenePreviewModal } from './searchModals/VideoScenePreviewModal';

const PLAN_LABELS: Record<PricingPlanId, string> = {
  free_trial: '🆓 1~3번 무료 코어 (귀신비서 · 귀신검색 · 사진 공유) : 평생 0원 (4·5번 유료 확장 🎁 30일 무료체험 포함)',
  personal_single_2900: '🆓 1~2번 내 기기 (PC·폰) : 언제나 0원 • 👻 귀신비서 · 👻 귀신검색',
  personal_sub_3900: '👑 4번 내 기기 통합 Pro (PC+폰+PC+) • 🎁 30일 무료체험 (이후 월 3,900원)',
  personal_year_35000: '👑 4번 내 기기 통합 Pro (PC+폰+PC+) • 연간 결제 39,000원 (월 3,250원꼴 · 2개월 무료 할인)',
  personal_year_39000: '👑 4번 내 기기 통합 Pro (PC+폰+PC+) • 연간 결제 39,000원 (월 3,250원꼴 · 2개월 무료 할인)',
  family_home_5900: '👨‍👩‍👧‍👦 3번 사진 공유 (가족 · 우리집) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  family_home_year_59000: '👨‍👩‍👧‍👦 3번 사진 공유 (가족 · 우리집) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  family_three_8900: '👨‍👩‍👧‍👦 3번 사진 공유 (가족 · 양가 3방) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  family_three_year_89000: '👨‍👩‍👧‍👦 3번 사진 공유 (가족 · 양가 3방) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  club_mini_free_300: '⛰️ 3번 사진 공유 (동호회 · 소모임) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  club_mini_2900: '⛰️ 3번 사진 공유 (동호회 · 소모임) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  club_small_4900: '⛰️ 3번 사진 공유 (동호회 · 🎓 동창회) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  club_small_year_49000: '⛰️ 3번 사진 공유 (동호회 · 🎓 동창회) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  club_medium_7900: '⛰️ 3번 사진 공유 (동호회 · 🎓 동창회) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  club_medium_year_79000: '⛰️ 3번 사진 공유 (동호회 · 🎓 동창회) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  club_large_14900: '⛰️ 3번 사진 공유 (동호회 · 🎓 동창회) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  club_large_year_149000: '⛰️ 3번 사진 공유 (동호회 · 🎓 동창회) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  student_sub_900: '🎓 3번 사진 공유 (동창회 · 학급) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  student_year_9000: '🎓 3번 사진 공유 (동창회 · 학급) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  work_soho_9900: '💼 5번 업무 공유 (S: 드라이브 · 소호 ~5인 월 9,900원 · 30일 무료체험)',
  work_soho_year_99000: '💼 5번 업무 공유 (S: 드라이브 · 소호 ~5인 연간 결제 99,000원 · 월 8,250원꼴)',
  work_biz_19000: '💼 5번 업무 공유 • 소기업 ~20인 (월 19,000원)',
  work_biz_year_190000: '💼 5번 업무 공유 • 소기업 ~20인 (연 190,000원 · 2개월 무료)',
  work_biz_19900: '💼 5번 업무 공유 • 소기업 ~20인 (월 19,000원)',
  work_biz_year_199000: '💼 5번 업무 공유 • 소기업 ~20인 (연 190,000원)',
  work_pro_29000: '💼 5번 업무 공유 • 중소기업 ~50인 (월 29,000원)',
  work_pro_year_290000: '💼 5번 업무 공유 • 중소기업 ~50인 (연 290,000원 · 2개월 무료)',
};

/**
 * [4대 라운지 초심플 기본 요금제 + ⚡ 24시간 GPU 클라우드 서버 도우미] 모달
 * - isStoreAppMode === true 일 때는 요금표를 100% 숨기고 '데스크톱 기기 연동 & 대화면 작업 이어가기' 전용 클린 모달로 작동
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
    isStoreAppMode,
    merlinAuth,
  } = useSaySeeStore();

  const [trojanCouponCopied, setTrojanCouponCopied] = useState(false);
  const [familyTrojanCopied, setFamilyTrojanCopied] = useState(false);
  const [inviteCardCopied, setInviteCardCopied] = useState(false);
  const [appShareCopied, setAppShareCopied] = useState(false);
  const [p2pGiftSent, setP2pGiftSent] = useState(false);
  const [hostRetainsHidePermission, setHostRetainsHidePermission] = useState(true);
  /**
   * [멀린님 지침 주석 — 얼리버드 실시간 현황판 노출 정책]:
   * - '실제 잔여 좌석이 30석 이하(<= 30)일 때만 [🔥 마감 임박: 잔여 N석]을 띄운다'는 규칙은 1차 기준입니다.
   * - 출시 후 현장 분위기를 봐서 괜찮다 싶으면 언제든 상시 실시간 현황판(전체 잔여석/소진율 현황판)을
   *   바로 띄울 수 있도록 FORCE_SHOW_LIVE_SEAT_BOARD 스위치 및 현황판 블록을 주석/토글로 보존해 둡니다.
   */
  const FORCE_SHOW_LIVE_SEAT_BOARD = false; // 분위기 봐서 언제든 상시 현황판을 띄울 때 true로 전환
  const [earlyBirdRemainingSeats, setEarlyBirdRemainingSeats] = useState<number>(72); // 1차 기준: <= 30일 때 [마감 임박: 잔여 N석] 점등
  const [clubSignboardName, setClubSignboardName] = useState('산들산악회');
  const [clubSignboardFeedback, setClubSignboardFeedback] = useState<string | null>(null);

  if (!showProModal) return null;

  const activeMasterTier = MASTER_PASS_AUTO_SWITCH_TIERS[0];

  const handleCopyTrojanBrag = async () => {
    const bragCopy =
      '내가 동호회·동창회 연구독(마스터권) 끊어서 [가족 라운지 1개월 무료 구독권 3장] 받았는데, 선착순 3명에게 줄 테니 가족방 쓸 사람?';
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(bragCopy);
      }
    } catch {
      // ignore clipboard fallback
    }
    setTrojanCouponCopied(true);
    window.setTimeout(() => setTrojanCouponCopied(false), 2600);
  };

  const handleCopyFamilyTrojanBrag = async () => {
    const bragCopy =
      '내가 가족 라운지 연구독(마스터권) 끊어서 [동호회·동창회 모임 라운지 3개월 무료 구독권 1장] 받았는데, 우리 모임 총무님께 선물할게요!';
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(bragCopy);
      }
    } catch {
      // ignore clipboard fallback
    }
    setFamilyTrojanCopied(true);
    window.setTimeout(() => setFamilyTrojanCopied(false), 2600);
  };

  const handleCopyInviteCard = async () => {
    const inviteCopy =
      '[귀신같이 라운지 초대장] 내 PC와 모바일에 1초 초능력을! 가족·모임 원본 사진은 만료 없이 평생 0원이며, 초대받은 가족·회원·직원은 언제나 무료입니다. https://ghosti.sundreamer.app';
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(inviteCopy);
      }
    } catch {
      // ignore clipboard fallback
    }
    setInviteCardCopied(true);
    window.setTimeout(() => setInviteCardCopied(false), 2600);
  };

  const handleShareApp = async () => {
    const shareText =
      '귀신같이(Ghosti) | 사진·영상·서류 속 내용까지 1초 만에 꿰뚫어 찾는 1초 AI 내용검색 — 내 폰·PC 속 내용검색·손보기는 언제나 0원, 가족·모임·업무 공유는 방장 한 분만 https://ghosti.sundreamer.app';
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: '귀신같이 (Ghosti)',
          text: shareText,
          url: 'https://ghosti.sundreamer.app',
        });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
      }
    } catch {
      // ignore share fallback
    }
    setAppShareCopied(true);
    window.setTimeout(() => setAppShareCopied(false), 2600);
  };

  const handleSimulateP2pCoinGift = () => {
    setP2pGiftSent(true);
    window.setTimeout(() => setP2pGiftSent(false), 3000);
  };

  // [스토어 1차 심사용 모바일 클린 모드(isStoreAppMode === true)]:
  // 인앱결제(IAP) 수수료 및 외부 결제 유도 금지 규정(Anti-steering) 원천 방어를 위해
  // '주소/URL/결제' 단어를 배제하고 순수 데스크톱 기기 연동 모달만 노출
  if (isStoreAppMode) {
    return (
      <div
        onClick={() => setShowProModal(false)}
        className="fixed inset-0 z-[105] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl rounded-3xl bg-[#121215] border border-white/15 p-6 md:p-8 shadow-2xl flex flex-col gap-5 my-auto"
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <GhostiBrandLogo size="desktop" showBadge={true} />
                <span className="px-3 py-1 rounded-full bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold w-fit">
                  📱 모바일 뷰어 ➔ 💻 데스크톱(PC) 대화면 작업 이어가기
                </span>
              </div>
              <h2 className="font-headline-lg text-[19px] md:text-[22px] text-white font-black tracking-tight mt-1">
                💻 대용량 미디어 정리 및 마스터 설정은 데스크톱(PC) 환경에서 작동합니다
              </h2>
              <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                수만 장의 원본 사진·영상 고속 인덱싱과 라운지 마스터 관리는 PC 엔진 연결이 필요합니다. 나중에 PC에서 바로 이어서 작업하실 수 있도록 연동 가이드를 보내드릴까요?
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowProModal(false)}
              className="w-9 h-9 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-200 shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <PcMasterQuickSendPanel />
        </div>
      </div>
    );
  }

  const GPU_HELPER_TIERS: Array<{
    id: GpuHelperTierId;
    title: string;
    targetDesc: string;
    priceText: string;
  }> = [
    {
      id: 'standard_1000',
      title: '사진 공유 (패밀리 / 동호회·동창회)',
      targetDesc: '방장 PC OFF 시 24시간 대행',
      priceText: '24시간 당 1,000원',
    },
    {
      id: 'club_small_1000',
      title: '소형 동호·동창회 (~20명)',
      targetDesc: '소형 동호·동창회 공유방 24시간 대행',
      priceText: '24시간 당 1,000원',
    },
    {
      id: 'club_medium_2000',
      title: '중형 동호·동창회 (~100명)',
      targetDesc: '중형 동호·동창회 공유방 24시간 대행',
      priceText: '24시간 당 2,000원',
    },
    {
      id: 'club_large_3000',
      title: '대형 동호·동창회 (무제한)',
      targetDesc: '대형 동호·동창회 공유방 24시간 대행',
      priceText: '24시간 당 3,000원',
    },
  ];

  return (
    <div
      onClick={() => setShowProModal(false)}
      className="fixed inset-0 z-[105] bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 pt-safe pb-safe overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl max-h-[90dvh] overflow-y-auto rounded-3xl bg-[#121215] border border-white/15 p-4 sm:p-6 md:p-8 shadow-2xl flex flex-col gap-5 sm:gap-6 my-auto"
      >
        {/* 모달 헤더 */}
        <div className="flex items-start justify-between gap-3 sm:gap-4 border-b border-white/10 pb-4">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <GhostiBrandLogo size="desktop" showBadge={true} />
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
                  ✨ 1~3번 무료 모드 (내 기기 + 사진 공유 0원)로 전환
                </button>
              )}
            </div>
            <h2 className="font-headline-lg text-[21px] md:text-[25px] text-white font-black tracking-tight mt-1">
              1~3번(귀신비서 · 귀신검색 · 사진 공유)은 평생 0원! 4·5번(내 기기 통합 · 업무 공유)은 🎁 30일 무료체험 후 결정하세요
            </h2>
            <p className="font-body-sm text-[13px] text-zinc-200 font-medium">
              • 내 기기(귀신비서·귀신검색)와 3번 사진 공유(👨‍👩‍👧‍👦가족 · ⛰️동호회 · 🎓동창회)는 내 PC 하드 직결로 클라우드 서버비가 안 들기 때문에 인원 무제한 평생 0원입니다. (단, 3번 사진 공유는 오직 사진·동영상 전용이며, 업무 서류·S: 드라이브는 5번 업무 공유 전용입니다.)
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

        {/* 📢 30일 무료체험 + 연간 결제 2개월 무료 할인 안내띠 */}
        <div
          data-keep-dark="true"
          className="px-4 py-3 md:px-5 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-teal-950/85 to-zinc-950 border border-emerald-400/50 flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex flex-col gap-0.5">
            <p className="font-body-sm text-[13px] md:text-[13.5px] text-amber-200 font-extrabold leading-relaxed">
              🎁 <strong className="underline decoration-amber-300 text-amber-300">유료 확장(4번 내 기기 통합 · 5번 업무 공유) 신용카드 등록 없이 30일 무료체험 제공 + {activeMasterTier.bannerHeadline}</strong>
            </p>
            <span className="text-[11px] text-zinc-300">
              연간 결제 혜택: <strong>10개월 치 요금으로 12개월 이용 (2개월 무료 할인)</strong> · 사진 공유(패밀리·동호회·동창회)는 인원·장수 제한 없이 <strong>평생 100% 무제한 무료</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 font-label-mono text-[11px] font-extrabold">
              ✨ 신용카드 등록 없음 · 자동 결제 0%
            </span>
          </div>
        </div>

        {/* 모바일 접속자 편의: 검색 없이 내 이메일/카톡으로 PC 마스터 접속 주소 보내기 */}
        <PcMasterQuickSendPanel compact />

        {/* 1. 좌측 사이드바 메뉴와 100% 일치하는 요금 체계 (평생 무료 3코어 / 선택형 유료 확장 2종) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ① [평생 무료] 내 기기 (PC·폰): 👻 귀신비서 · 👻 귀신검색 */}
          <div className="p-5 rounded-2xl bg-[#18181B] border border-emerald-400/40 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11.5px] font-bold">
                  1~2번 [평생 무료] 내 기기 (PC·폰)
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-400 text-zinc-950 font-label-sm text-[10.5px] font-extrabold">
                  평생 0원 · 신용카드 등록 없음
                </span>
              </div>
              <h3 className="font-headline-sm text-[19px] text-white font-extrabold">
                🆓 내 기기 (PC·폰) — 👻 귀신비서 · 👻 귀신검색
              </h3>

              <div className="p-4 rounded-xl bg-zinc-950/90 border border-emerald-400/35 flex flex-col justify-between gap-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-headline-md text-[22px] text-emerald-300 font-black">
                    평생 0원 (무료)
                  </span>
                  <span className="font-label-mono text-[11.5px] text-zinc-300 font-bold">
                    광고 NO · 외부 전송 0 Byte
                  </span>
                </div>
                <p className="font-body-sm text-[12px] text-emerald-200/95 font-bold">
                  &ldquo;혼자 쓰는 내 PC · 내 폰의 1초 AI 내용검색(귀신검색 · Ctrl+0)과 PC 속도·용량·보안 주치의(귀신비서)는 평생 0원&rdquo;
                </p>
                <p className="font-body-sm text-[12px] text-zinc-300 leading-relaxed">
                  • 🎯 <strong>귀신검색 (Ctrl+0)</strong> (내 기기 사진·영상·서류 1초 내용검색 · 바탕화면·다운로드·최근 100개 우선 개통 · 평생 0원)<br />
                  • 👻 <strong>귀신비서</strong> (알약·고클린 대체 보안·속도·용량 케어 · 수요일 오후 1시 주간 점검 · 중복 사진 정리 · 빨간 손가락 <code>👆</code> 수리 · 평생 0원)
                </p>
              </div>
            </div>
          </div>

          {/* ② [3번 — 평생 무료] 사진 공유: 👨‍👩‍👧‍👦 가족 / ⛰️ 동호회 / 🎓 동창회 (오직 사진·동영상 전용) */}
          <div className="p-5 rounded-2xl bg-[#18181B] border-2 border-emerald-400/60 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-400 text-zinc-950 font-label-sm text-[11.5px] font-black">
                  3번 [평생 무료] 사진 공유 (👨‍👩‍👧‍👦 가족 · ⛰️ 동호회 · 🎓 동창회)
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 font-label-sm text-[10.5px] font-extrabold">
                  📸 사진·동영상 전용 · 인원 무제한 평생 0원
                </span>
              </div>
              <h3 className="font-headline-sm text-[19px] text-white font-extrabold">
                📸 사진 공유 (가족 · 동호회 · 동창회) — 인원 무제한 평생 0원!
              </h3>

              <div className="p-4 rounded-xl bg-zinc-950/90 border border-emerald-400/45 flex flex-col justify-between gap-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-headline-md text-[22px] text-emerald-300 font-black">
                    방장도 멤버도 평생 0원
                  </span>
                  <span className="font-label-mono text-[11px] text-amber-300 font-extrabold">
                    내 PC 하드 직결 · 클라우드 서버비 0원
                  </span>
                </div>
                <p className="font-body-sm text-[12px] text-zinc-200 leading-relaxed">
                  • 👨‍👩‍👧‍👦 <strong>가족</strong> (우리집 · 친가 · 처가) / ⛰️ <strong>동호회</strong> (산악회 · 골프 · 소모임) / 🎓 <strong>동창회</strong> 모두 <strong>인원수·장수 제한 없이 100% 평생 무료</strong>!<br />
                  • 💬 <strong>카톡 단톡방 인앱 무가입 1초 프리뷰</strong> + 🛂 <strong>각 방 인물 얼굴 1초 찾기</strong> 기본 제공<br />
                  • ⚠️ <strong className="text-amber-300">오직 사진 · 동영상 공유만 작동</strong>합니다. (엑셀·한글·PDF·워드 등 업무 문서 공유 및 윈도우 탐색기 <code>S: 드라이브</code> 마운트는 <strong>5번 업무 공유(월 9,900원~ · 30일 무료체험)</strong> 전용입니다.)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('family_home_5900')}
                    className="py-2 px-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-label-sm text-[11.5px] font-black cursor-pointer"
                  >
                    👨‍👩‍👧‍👦 가족방 0원 시작
                  </button>
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('club_small_4900')}
                    className="py-2 px-2 rounded-lg bg-emerald-400/90 hover:bg-emerald-300 text-zinc-950 font-label-sm text-[11.5px] font-black cursor-pointer"
                  >
                    ⛰️ 동호회방 0원 시작
                  </button>
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('student_sub_900')}
                    className="py-2 px-2 rounded-lg bg-emerald-400/80 hover:bg-emerald-300 text-zinc-950 font-label-sm text-[11.5px] font-black cursor-pointer"
                  >
                    🎓 동창회방 0원 시작
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── 무료(1~3번) / 유료 확장(4·5번 — 30일 무료체험) 경계선 ── */}
          <div className="md:col-span-2 flex items-center gap-2 sm:gap-3 py-1">
            <div className="hidden sm:block flex-1 border-t border-dashed border-amber-400/40" />
            <span className="w-full sm:w-auto text-center break-keep px-3 py-1.5 rounded-2xl sm:rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 font-label-mono text-[11px] sm:text-[11.5px] font-extrabold">
              🎁 4·5번 유료 확장 기능 (신용카드 등록 없이 30일 무료체험 · 연간 결제 2개월 무료)
            </span>
            <div className="hidden sm:block flex-1 border-t border-dashed border-amber-400/40" />
          </div>

          {/* ③ [4번 — 30일 무료체험 / 유료] 내 기기 통합 Pro (PC+폰+PC+): 🔗 내 기기 연결 (PC↔폰) + 📝 사진·표 OCR · 🏷️ 귀신 라벨러 */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/75 via-[#18181B] to-[#18181B] border-2 border-emerald-400 shadow-[0_0_28px_rgba(16,185,129,0.22)] md:col-span-2 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-400 text-zinc-950 font-label-sm text-[11.5px] font-black">
                  4번 [🎁 30일 무료체험 / 유료] 내 기기 통합 Pro (PC+폰+PC+)
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/50 text-amber-300 font-label-sm text-[10.5px] font-extrabold">
                  🔗 내 기기 연결 (PC↔폰) · 📝 사진·표 OCR · 🏷️ 귀신 라벨러 · 대수 무제한
                </span>
              </div>
              <h3 className="font-headline-sm text-[19px] text-white font-extrabold">
                👑 내 기기 통합 Pro — &ldquo;카톡 ‘나에게 보내기’ 끝, 내 모든 기기를 하나로&rdquo;
              </h3>

              <div className="p-4 rounded-xl bg-zinc-950/90 border border-emerald-400/50 flex flex-col justify-between gap-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-label-mono text-[12px] font-extrabold">
                      🎁 첫 30일 무제한 무료체험
                    </span>
                    <span className="font-headline-md text-[23px] text-white font-black">
                      월 3,900원
                    </span>
                    <span className="font-label-mono text-[12px] text-amber-300 font-extrabold">
                      (연간 결제 시 39,000원 · 월 3,250원꼴 · 2개월 무료)
                    </span>
                  </div>
                  <span className="font-label-mono text-[11px] text-emerald-300 font-bold">
                    연결 기기 대수 무제한
                  </span>
                </div>
                <p className="font-body-sm text-[12px] text-zinc-200 leading-relaxed">
                  • 🔗 <strong>내 기기 연결 (PC↔폰)</strong>: 카톡 ‘나에게 보내기’ &amp; 클라우드 월세 종식 (내 폰 ⇄ 집 PC ⇄ 회사 PC ⇄ 노트북 원본 직결 통합 검색)<br />
                  • 📋 <strong>무버튼 양방향 클립보드 ‘암호화 우체통(E2EE)’</strong>: 꺼져 있던 집 PC 부팅 즉시 회사·폰에서 복사한 텍스트 100개·스샷 10장 자동 장전<br />
                  • 📝 <strong>귀신검색 Pro 유료 확장</strong>: 사진·표 OCR 창(이미지 속 글자·엑셀 표 1초 추출·이동), 귀신 라벨러(AI 자동 파일명 정리) 전 기기 무제한 해금
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('personal_sub_3900')}
                    className="py-2.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-label-sm text-[12.5px] font-black cursor-pointer"
                  >
                    💳 월 3,900원 구독 결제 (30일 무료체험 선택 가능)
                  </button>
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('personal_year_39000')}
                    className="py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[12.5px] font-black cursor-pointer"
                  >
                    ✨ 연간 결제 39,000원 (월 3,250원꼴 · 2개월 무료)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ④ [5번 — 30일 무료체험 / 유료] 업무 공유 (소호 ~5인 9,900원 / 소기업 ~20인 19,000원 / 중소기업 ~50인 29,000원) */}
          <div className="p-5 rounded-2xl bg-[#18181B] border-2 border-cyan-400/45 md:col-span-2 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-cyan-400 text-zinc-950 font-label-sm text-[11.5px] font-extrabold">
                  5번 [🎁 30일 무료체험 · 월 9,900원~] 업무 공유 • 공용 폴더(S: 드라이브) · 문서/계약서 공유
                </span>
                <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11px] font-extrabold">
                  💽 공용 폴더(S: 드라이브) 종단간 암호화(E2EE) · 🛡️ 랜섬웨어 격리 · 🧾 세금계산서 발행
                </span>
              </div>
              <h3 className="font-headline-sm text-[19px] text-white font-extrabold">
                💼 업무 공유 — &ldquo;NAS·클라우드 월세 0원, 우리 팀 PC를 공용 폴더(S: 드라이브) 하나로&rdquo;
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                {/* 소호(SOHO) ~5인 */}
                <div className="p-4 rounded-xl bg-zinc-950/90 border border-cyan-400/40 flex flex-col justify-between gap-2.5">
                  <div>
                    <span className="font-label-sm text-[11.5px] text-cyan-300 font-extrabold">
                      🏢 소호(SOHO) 팀 (~5인) · 🎁 30일 무료체험
                    </span>
                    <div className="font-headline-md text-[21px] text-white font-black mt-0.5">
                      월 9,900원
                    </div>
                    <span className="font-label-mono text-[11px] text-amber-300 font-bold">
                      (연간 결제 시 99,000원 · 월 8,250원꼴)
                    </span>
                    <p className="font-body-sm text-[11.5px] text-zinc-300 mt-1">
                      5인 이하 사무실 · S: 드라이브 + 문서/계약서 1초 본문 검색 + 🛡️ 백업 PC(예비 서버)
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('work_soho_9900')}
                      className="py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
                    >
                      월 9,900원
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('work_soho_year_99000')}
                      className="py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11px] font-extrabold cursor-pointer"
                    >
                      연 9.9만 (2개월 무료)
                    </button>
                  </div>
                </div>

                {/* 소기업 ~20인 (월 19,000원) */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-cyan-400/50 flex flex-col justify-between gap-2.5">
                  <div>
                    <span className="font-label-sm text-[11.5px] text-cyan-200 font-extrabold">
                      🏢 소기업 플랜 (~20인) · 🎁 30일 무료체험
                    </span>
                    <div className="font-headline-md text-[21px] text-white font-black mt-0.5">
                      월 19,000원
                    </div>
                    <span className="font-label-mono text-[11px] text-amber-300 font-bold">
                      (연간 결제 시 190,000원 · 월 15,833원꼴)
                    </span>
                    <p className="font-body-sm text-[11.5px] text-zinc-300 mt-1">
                      20인 이하 기업 · 부서별 S: 폴더 권한 + 🛡️ 백업 PC(예비 서버 1·2호)
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('work_biz_19000')}
                      className="py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
                    >
                      월 19,000원
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('work_biz_year_190000')}
                      className="py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11px] font-extrabold cursor-pointer"
                    >
                      연 19만 (2개월 무료)
                    </button>
                  </div>
                </div>

                {/* 중소기업 ~50인 (월 29,000원 / 50인 초과 별도 협의) */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-amber-400/45 flex flex-col justify-between gap-2.5">
                  <div>
                    <span className="font-label-sm text-[11.5px] text-amber-300 font-extrabold">
                      🏛️ 중소기업 (~50인) · 🎁 30일 무료체험
                    </span>
                    <div className="font-headline-md text-[21px] text-white font-black mt-0.5">
                      월 29,000원
                    </div>
                    <span className="font-label-mono text-[11px] text-amber-300 font-bold">
                      (연간 결제 시 290,000원 · 월 24,166원꼴)
                    </span>
                    <p className="font-body-sm text-[11.5px] text-zinc-300 mt-1">
                      50인 이하 전사 문서·도면 통합 금고 (※ 50인 이상은 별도 협의)
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('work_pro_29000')}
                      className="py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-white font-label-sm text-[11.5px] font-bold cursor-pointer"
                    >
                      월 29,000원
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('work_pro_year_290000')}
                      className="py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11px] font-extrabold cursor-pointer"
                    >
                      연 29만 (2개월 무료)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. [🛡️ 사진방 '방 개설 설정 옵션 + PC 원본 동기화' vs 업무방 '백업 PC 1·2호 + 퇴근 초절전 모드(월 1,800원)' & 무삭제 헌법] */}
        <div className="p-5 rounded-2xl bg-[#18181B] border border-emerald-400/45 flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-400 text-zinc-950 font-label-sm text-[11.5px] font-extrabold">
                🛡️ 방 개설 설정 옵션 · 내 기기 원본 동기화 · 탈퇴/강퇴 기준
              </span>
              <h3 className="font-headline-sm text-[17px] text-white font-extrabold">
                사진방 ‘내 기기 원본 동기화 자체 해결’ &amp; 업무방 ‘🌙 퇴근 초절전 모드(월 1,800원)’
              </h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-label-mono text-[11px] font-bold">
              ✓ OS 기본 [휴지통] 일원화 · 랜섬웨어 서킷 브레이커
            </span>
          </div>

          {/* 🛠️ 방 개설 시 설정 옵션 (24시간 내 본인 삭제 + 방장 상시 숨기기 권한 보유 여부 선택 & 탈퇴 시 안내) */}
          <div className="p-3.5 rounded-xl bg-zinc-950/90 border border-primary-container/35 flex flex-col gap-2.5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-label-sm text-[12px] text-primary-container font-extrabold">
                  🛠️ [방 개설 설정 옵션] 사진 공유방 삭제 · 방장 상시 숨기기 권한 선택
                </span>
                <span className="font-body-sm text-[11.5px] text-zinc-300">
                  올린 원본 주인은 <strong>업로드 후 24시간 내에 직접 삭제 가능</strong>하며, 멤버가 잘못된 걸 올릴 때를 대비해 <strong>방장이 올라오는 처음부터 상시 [숨기기] 권한을 가질지</strong> 방 개설 시 선택합니다.
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setHostRetainsHidePermission(true)}
                  className={`px-3 py-1.5 rounded-lg font-label-sm text-[11px] font-extrabold border cursor-pointer ${
                    hostRetainsHidePermission
                      ? 'bg-primary-container text-zinc-950 border-primary-container'
                      : 'bg-zinc-900 text-zinc-300 border-white/15'
                  }`}
                >
                  👑 방장 상시 숨기기 권한 보유 — 올라오는 처음부터 가능 (권장)
                </button>
                <button
                  type="button"
                  onClick={() => setHostRetainsHidePermission(false)}
                  className={`px-3 py-1.5 rounded-lg font-label-sm text-[11px] font-extrabold border cursor-pointer ${
                    !hostRetainsHidePermission
                      ? 'bg-primary-container text-zinc-950 border-primary-container'
                      : 'bg-zinc-900 text-zinc-300 border-white/15'
                  }`}
                >
                  🤝 방장 숨기기 없음 (24시간 내 본인 삭제만)
                </button>
              </div>
            </div>
            <div className="pt-2 border-t border-white/10 text-[11px] text-zinc-400">
              🚪 <strong className="text-zinc-200">탈퇴(자퇴 · 강퇴 동일) 시 데이터 처리 안내 (약관 명시):</strong> 탈퇴/강퇴 즉시 해당 방 계정 아웃 처리되며, 숨김 영역에 보관된 <strong>그 공유방의 썸네일 DB · 공유방 검색 인덱스 · 해당 방 내부 타 멤버 여권 목록만 즉시 자동 삭제</strong>됩니다. (※ 유저가 자기 PC에 인덱싱한 <strong>‘나 자신의 귀신같이 여권’과 ‘내 기기 개인 인덱스’는 절대 삭제되지 않고 100% 보존</strong>되며, 이미 받아둔 공유방 원본 폴더도 반납 없이 각자 자율 관리합니다.)
            </div>
          </div>

          <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed bg-zinc-950/80 p-3.5 rounded-xl border border-white/10">
            <strong>① 📸 사진 공유방(가족·동호회·동창회):</strong> 이미 올라간 중복 사진(<code>64-bit dHash</code>)은 자동 제외하되 <strong>EXIF 원본 메타데이터가 살아있고 실제 해상도가 더 큰 진짜 원본일 때만 자동으로 교체(댓글·좋아요 유지)</strong>합니다! 평소엔 보이지 않는 곳에 13KB 썸네일 DB만 두고, <strong>[🔄 원본 동기화]</strong>를 켜면 지정한 내 폴더에 원본이 복제되어 방장 PC 호출 없이 내 기기에서 100% 자체 해결합니다.<br />
            <strong>② 💼 업무 공유방(S: 드라이브):</strong> 기존 구글 드라이브·네이버 MYBOX 폴더 위에 그대로 중첩 지정해도 충돌 없는 <code>Zero-Footprint</code> 구조! 윈도우 탐색기(<code>S:</code>)에서 열 때는 엑셀·오피스 기본 읽기 전용 규칙대로 작동하며, 웹/앱 검색에서 사용 중인 문서를 열 때는 <strong>&ldquo;🔒 현재 [OOO]님이 사용 중입니다. 읽기 모드로 열립니다.&rdquo;</strong> 안내만 깔끔하게 제공합니다.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div className="p-3.5 rounded-xl bg-zinc-950/90 border border-emerald-400/30 flex flex-col gap-1">
              <span className="font-label-sm text-[11.5px] text-emerald-300 font-extrabold">
                ① 📸 사진방: 진짜 원본 승격 · 24시간 본인 삭제
              </span>
              <span className="font-headline-sm text-[14.5px] text-white font-black">
                ✨ EXIF 원본 검증 &amp; [🔄 원본 동기화]
              </span>
              <span className="font-body-sm text-[11px] text-zinc-400">
                Wi-Fi 및 여유 공간이 넉넉할 때 지정한 내 폴더로 원본을 자동 동기화해 자체 해결하며, 탈퇴/강퇴 시 숨김 썸네일 DB는 즉시 자동 삭제됩니다.
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-950/90 border border-cyan-400/30 flex flex-col gap-1">
              <span className="font-label-sm text-[11.5px] text-cyan-300 font-extrabold">
                ② 💼 업무방: 클라우드 중첩 호환 + 읽기모드 안내
              </span>
              <span className="font-headline-sm text-[14.5px] text-white font-black">
                🔒 &ldquo;OOO님 사용 중 · 읽기 모드로 열림&rdquo;
              </span>
              <span className="font-body-sm text-[11px] text-zinc-400">
                탐색기(S:)에서는 오피스 기본 규칙대로 열리고 웹/앱 검색 열람 시에는 읽기 모드로 열림을 안내하며, 퇴근 시 초절전 모드(월 1,800원)로 대기합니다.
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-950/90 border border-amber-400/30 flex flex-col gap-1">
              <span className="font-label-sm text-[11.5px] text-amber-300 font-extrabold">
                ③ 🛡️ OS 기본 [휴지통] &amp; 랜섬웨어 방어
              </span>
              <span className="font-headline-sm text-[14.5px] text-white font-black">
                OS 기본 [휴지통] 직행 + ↩️ 1초 실행 취소
              </span>
              <span className="font-body-sm text-[11px] text-zinc-400">
                복잡한 30일 보관함 없이 익숙한 OS 기본 [휴지통](마스터 PC 휴지통)으로 직행하며, 1분 30개 대량 삭제·변조 시 백업 PC 1·2호 미러링을 즉시 차단해 랜섬웨어를 방어합니다.
              </span>
            </div>
          </div>
        </div>

        {/* 3. 💌 라운지 초대장 보내기 카드 (문패 포함) & 앱 공유하기 (순수 초대 문구) */}
        <div className="p-5 rounded-2xl bg-[#18181B] border border-primary-container/35 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <GhostiBrandLogo size="mobile" showBadge={true} />
              <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold">
                💌 라운지 초대장 카드 &amp; 앱 공유
              </span>
              <h3 className="font-headline-sm text-[16.5px] text-white font-extrabold">
                &ldquo;초대받은 가족·회원·직원은 언제나 무료입니다&rdquo;
              </h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[11px] font-bold">
              🛂 방별 문패 자동 표시 · 무수락 원터치 합류
            </span>
          </div>

          <p className="font-body-sm text-[12px] text-zinc-300 leading-relaxed">
            방장이 단톡방에 <strong>[초대장 보내기 카드]</strong>를 공유하면, 초대받은 가족·동호회·동창회·업무 팀원은 신용카드 등록이나 광고 없이 언제나 무료로 함께 이용합니다.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="font-body-sm text-[11.5px] text-zinc-400">
              💡 <strong>4번 사진 공유(가족·동호회·동창회)</strong>는 방장도 멤버도 인원·장수 제한 없이 <strong>평생 0원 무료</strong>입니다.
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopyInviteCard()}
                className={`px-3.5 py-2 rounded-xl font-label-sm text-[12px] font-extrabold transition-all cursor-pointer ${
                  inviteCardCopied
                    ? 'bg-emerald-400 text-zinc-950'
                    : 'bg-primary-container hover:opacity-95 text-zinc-950'
                }`}
              >
                {inviteCardCopied
                  ? '✓ 라운지 초대장 카드 문구 복사됨!'
                  : '💌 단톡방 [초대장 보내기 카드] 복사'}
              </button>

              <button
                type="button"
                onClick={() => void handleShareApp()}
                className={`px-3.5 py-2 rounded-xl font-label-sm text-[12px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  appShareCopied
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-white/15 text-zinc-200'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">share</span>
                <span>{appShareCopied ? '✓ 앱 공유 링크 준비 완료!' : '지인에게 앱 공유하기'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4. 내 귀신코인 지갑 (실제 허브 잔액 · 충전소 · 선물함 직결) */}
        <div className="px-4 py-3 rounded-xl bg-zinc-950/90 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-[12px]">
          <div className="flex flex-wrap items-center gap-2 text-zinc-300">
            <span className="font-bold text-amber-300">
              🪙 내 귀신코인 지갑:{' '}
              {merlinAuth?.userId && merlinAuth.userId !== 'guest'
                ? `${(merlinAuth.coinBalance ?? 0).toLocaleString()} C`
                : '로그인 후 잔액 확인'}
            </span>
            <span className="text-zinc-500">|</span>
            <span className="text-zinc-400">
              3몬스터 패밀리 앱 공통 코인 (구독 결제 · 충전소 · 지인 선물 지원)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (!merlinAuth?.userId || merlinAuth.userId === 'guest') {
                  window.dispatchEvent(new CustomEvent('openLoginModal'));
                  return;
                }
                window.dispatchEvent(new CustomEvent('openPurchaseModal'));
              }}
              className="px-3 py-1.5 rounded-lg font-label-sm text-[11.5px] font-extrabold bg-amber-400 hover:bg-amber-300 text-zinc-950 cursor-pointer"
            >
              ⚡ 코인 충전소
            </button>
            <button
              type="button"
              onClick={() => {
                if (!merlinAuth?.userId || merlinAuth.userId === 'guest') {
                  window.dispatchEvent(new CustomEvent('openLoginModal'));
                  return;
                }
                window.dispatchEvent(new CustomEvent('openGiftBoxModal'));
              }}
              className="px-3 py-1.5 rounded-lg font-label-sm text-[11.5px] font-bold border bg-zinc-900 hover:bg-zinc-800 border-white/15 text-zinc-200 cursor-pointer"
            >
              🎁 선물함 열기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
