import React, { useEffect, useRef, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { GpuHelperTierId, PricingPlanId } from '../types/saysee';
import { LoungeModeSwitcherBar } from './LoungeView';
import { GhostiBrandLogo } from './GhostiBrandLogo';

const PLAN_LABELS: Record<PricingPlanId, string> = {
  free_trial: '🆓 개인 (기본) : 언제나 0원 (혼자 쓰는 개인 공간은 기간 제한 없이 언제나 0원입니다)',
  personal_single_2900: '🆓 개인 (기본) : 언제나 0원 • 🩺 귀신같이 클린몬스터',
  personal_sub_3900: '💻 업무 입문 • 1인 멀티PC (월 1,900원)',
  personal_year_35000: '💻 업무 입문 • 1인 멀티PC (19,000원 · 선착순 100명 10년 마스터권)',
  family_home_5900: '🏠 패밀리 공유 • 우리집 단독 (월 5,900원)',
  family_home_year_59000: '🏠 패밀리 공유 • 우리집 단독 (59,000원 · 선착순 100명 10년 마스터권)',
  family_three_8900: '👨‍👩‍👧‍👦 패밀리 공유 • 양가 통합권 3방 (월 8,900원)',
  family_three_year_89000: '👨‍👩‍👧‍👦 패밀리 공유 • 양가 통합권 3방 (89,000원 · 선착순 100명 10년 마스터권)',
  club_small_4900: '⛳ 동호회 · 🎓 동창회 (인원 무제한 단일가 월 4,900원)',
  club_small_year_49000: '⛳ 동호회 · 🎓 동창회 (49,000원 · 선착순 100명 10년 마스터권)',
  club_medium_7900: '⛳ 동호회 · 🎓 동창회 (인원 무제한 단일가 월 4,900원)',
  club_medium_year_79000: '⛳ 동호회 · 🎓 동창회 (49,000원 · 선착순 100명 10년 마스터권)',
  club_large_14900: '⛳ 동호회 · 🎓 동창회 (인원 무제한 단일가 월 4,900원)',
  club_large_year_149000: '⛳ 동호회 · 🎓 동창회 (49,000원 · 선착순 100명 10년 마스터권)',
  student_sub_900: '📸 사진 공유 (동호회·동창회 통합)',
  student_year_9000: '📸 사진 공유 (동호회·동창회 통합)',
  work_soho_9900: '💼 업무 공유 • 소호(SOHO) ~5인 (월 9,900원)',
  work_soho_year_99000: '💼 업무 공유 • 소호(SOHO) ~5인 (99,000원 · 선착순 100명 10년 마스터권)',
  work_biz_19900: '💼 업무 공유 • 소기업 ~20인 (월 19,000원) / 중소기업 ~50인 (월 29,000원)',
  work_biz_year_199000: '💼 업무 공유 • 소기업 ~20인 (190,000원) / 중소기업 ~50인 (290,000원 · 10년 마스터권)',
};

/**
 * 5단계 방장 마스터권 자동 전환 스케줄 (월 구독료 × 10개월 치 고정)
 * - 1차 100명(10년) ➔ 2차 500명(7년) ➔ 3차 1,500명(5년) ➔ 4차 3,000명(3년) ➔ 5차 10,000명(2년)
 * - 화면에는 현재 진행 중인 차수 문구 한 줄만 깔끔하게 노출하며, 수량 소진 시 다음 차수로 자동 전환됩니다.
 */
export const MASTER_PASS_AUTO_SWITCH_TIERS = [
  {
    stage: 1,
    limitCount: 100,
    years: 10,
    bannerHeadline: '선착순 100명, 10년 방장 마스터권 (월 구독료 10개월 치로 10년 보장)',
  },
  {
    stage: 2,
    limitCount: 500,
    years: 7,
    bannerHeadline: '선착순 500명, 7년 방장 마스터권 (월 구독료 10개월 치로 7년 보장)',
  },
  {
    stage: 3,
    limitCount: 1500,
    years: 5,
    bannerHeadline: '선착순 1,500명, 5년 방장 마스터권 (월 구독료 10개월 치로 5년 보장)',
  },
  {
    stage: 4,
    limitCount: 3000,
    years: 3,
    bannerHeadline: '선착순 3,000명, 3년 방장 마스터권 (월 구독료 10개월 치로 3년 보장)',
  },
  {
    stage: 5,
    limitCount: 10000,
    years: 2,
    bannerHeadline: '선착순 10,000명, 2년 방장 마스터권 (월 구독료 10개월 치로 2년 보장)',
  },
] as const;

/**
 * 상단 5대 라운지 스위처 바
 */
export const FoundingMemberFomoBar: React.FC = () => {
  return <LoungeModeSwitcherBar />;
};

/**
 * [안전장치 1 & 3] 모바일 ➔ PC 전환 시 스토어 규정(Anti-steering)을 100% 준수하는 ‘데스크톱 기기 연동 & 대화면 작업 이어가기’ 패널
 * - '주소 / URL / 웹사이트 / 결제 / 구매' 단어 완전 배제
 * - 메인 버튼(카톡 1순위): [💬 카톡(나에게)으로 ‘내 PC 연동 시작 가이드’ 보내두기] (navigator.share / Kakao SDK 무료 연동)
 * - 보조 버튼(이메일 2순위): [📩 가입 이메일로 PC 연동 안내서 발송]
 * - 원격 토글(enablePcGuideShareButton)로 심사 기간 중 버튼 노출 여부까지 1초 만에 제어
 */
export const PcMasterQuickSendPanel: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const {
    merlinAuth,
    sendPcMasterUrlToEmail,
    sharePcMasterUrlToKakao,
    lastSentPcLinkChannel,
    enablePcGuideShareButton,
  } = useSaySeeStore();

  return (
    <div
      className={`rounded-2xl bg-[#18181B] border border-primary-container/45 flex flex-col gap-3 ${
        compact ? 'p-4' : 'p-5 md:p-6'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <GhostiBrandLogo size="mobile" themeMode="dark" showBadge={true} />
          <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold">
            💻 데스크톱(PC) 기기 연동 안내
          </span>
          <span className="font-headline-sm text-[15px] md:text-[16.5px] text-white font-extrabold">
            💻 대용량 미디어 정리 및 마스터 설정은 데스크톱(PC) 환경에서 작동합니다
          </span>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 border border-white/10 text-zinc-300 font-label-mono text-[11px]">
          🛂 연동 계정: <strong className="text-primary-container">{merlinAuth.email}</strong>
        </span>
      </div>

      <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
        수만 장의 원본 사진·영상 고속 인덱싱과 라운지 마스터 관리는 PC 엔진 연결이 필요합니다. 나중에 PC에서 바로 이어서 작업하실 수 있도록 연동 가이드를 보내드릴까요?
      </p>

      {enablePcGuideShareButton ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
          {/* 메인 버튼 (카톡 1순위): 스마트폰 기본 공유창(navigator.share) / 카카오 무료 SDK로 나에게 0.1초 전송 */}
          <button
            type="button"
            onClick={() => void sharePcMasterUrlToKakao()}
            className="px-4 py-3 rounded-xl bg-[#FEE500] hover:bg-[#FDD800] text-[#191919] font-label-md text-[13px] font-black flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-[0.98]"
          >
            <span>💬 카톡(나에게)으로 ‘내 PC 연동 시작 가이드’ 보내두기</span>
          </button>

          {/* 보조 버튼 (이메일 2순위): 가입된 귀신같이 여권 이메일로 PC 연동 안내서 발송 */}
          <button
            type="button"
            onClick={() => void sendPcMasterUrlToEmail()}
            className="px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-primary-container/50 text-primary-container font-label-md text-[13px] font-black flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-[0.98]"
          >
            <span>📩 가입 이메일로 PC 연동 안내서 발송</span>
          </button>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-zinc-900/90 border border-white/10 text-zinc-300 font-body-sm text-[12px]">
          💡 데스크톱(Windows / Mac) 환경에서 귀신같이(Ghosti) 마스터 엔진을 실행한 뒤 동일한 여권 계정({merlinAuth.email})으로 로그인하시면 즉시 연동됩니다.
        </div>
      )}

      {enablePcGuideShareButton && lastSentPcLinkChannel && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 font-body-sm text-[12px] flex items-center justify-between gap-2">
          <span>
            {lastSentPcLinkChannel === 'kakao'
              ? '✓ 카톡(나에게)으로 ‘내 PC 연동 시작 가이드’가 준비되었습니다! 데스크톱(PC) 카카오톡에서 열어 작업을 바로 이어가세요.'
              : `✓ 가입 이메일(${merlinAuth.email})로 ‘내 PC 연동 안내서’가 발송되었습니다! 데스크톱(PC)에서 확인해 주세요.`}
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * [안전장치 2] 전송된 링크(/?master=pc)의 ‘모바일 vs PC’ 접속 환경 이중 방어 화면
 * - 스토어 심사관이 모바일 기기(iOS/Android)에서 공유된 링크(/?master=pc)를 직접 열어보더라도
 *   가격표나 결제창이 절대 보이지 않고 순수 ‘PC 데스크톱 엔진 기능 소개 화면’만 렌더링됩니다.
 */
export const MobileMasterPcIntroModal: React.FC = () => {
  const { showMobileMasterPcIntroModal, setShowMobileMasterPcIntroModal } = useSaySeeStore();

  if (!showMobileMasterPcIntroModal) return null;

  return (
    <div
      onClick={() => setShowMobileMasterPcIntroModal(false)}
      className="fixed inset-0 z-[108] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-3xl bg-[#121215] border border-primary-container/40 p-6 md:p-8 shadow-2xl flex flex-col gap-5 my-auto"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <GhostiBrandLogo size="desktop" themeMode="dark" showBadge={true} />
              <span className="px-3 py-1 rounded-full bg-amber-400 text-zinc-950 font-label-sm text-[11.5px] font-extrabold w-fit">
                💻 이 페이지는 PC 화면 전용 마스터 세팅 페이지입니다
              </span>
            </div>
            <h2 className="font-headline-lg text-[20px] md:text-[22px] text-white font-black tracking-tight mt-1">
              💻 대용량 미디어 정리 및 마스터 설정은 데스크톱(PC) 환경에서 작동합니다
            </h2>
            <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
              현재 모바일 기기(iOS/Android)로 접속하셨습니다. 수만 장의 원본 사진·영상 고속 인덱싱과 라운지 마스터 볼트 관리는 Windows / Mac 데스크톱 환경에서 연결됩니다.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowMobileMasterPcIntroModal(false)}
            className="w-9 h-9 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-200 shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* 결제/요금 안내가 전혀 없는 순수 'PC 데스크톱 엔진 기능 소개 화면' 3대 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-zinc-950/90 border border-white/10 flex flex-col gap-1.5">
            <span className="font-label-sm text-[11px] text-primary-container font-extrabold">
              엔진 아키텍처 01
            </span>
            <h3 className="font-headline-sm text-[14.5px] text-white font-bold">
              🧠 데스크톱 로컬 AI 고속 인덱싱
            </h3>
            <p className="font-body-sm text-[12px] text-zinc-400 leading-relaxed">
              내 PC 그래픽카드(GPU)와 로컬 비전 엔진(Gemma 2 768차원)을 활용해 수만 장의 원본 사진·영상을 외부 클라우드 업로드 없이 1초 검색 인덱스로 변환합니다.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950/90 border border-white/10 flex flex-col gap-1.5">
            <span className="font-label-sm text-[11px] text-primary-container font-extrabold">
              엔진 아키텍처 02
            </span>
            <h3 className="font-headline-sm text-[14.5px] text-white font-bold">
              👻 13KB 초경량 섀도우 동기화
            </h3>
            <p className="font-body-sm text-[12px] text-zinc-400 leading-relaxed">
              무거운 원본 파일은 데스크톱 마스터 볼트에 안전하게 보관하고, 스마트폰에는 장당 13KB 초경량 썸네일+벡터 캐시만 동기화해 폰 저장공간을 99.4% 절약합니다.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950/90 border border-white/10 flex flex-col gap-1.5">
            <span className="font-label-sm text-[11px] text-primary-container font-extrabold">
              엔진 아키텍처 03
            </span>
            <h3 className="font-headline-sm text-[14.5px] text-white font-bold">
              🔒 프라이빗 라운지 기기 연결
            </h3>
            <p className="font-body-sm text-[12px] text-zinc-400 leading-relaxed">
              데스크톱(Windows / Mac)에서 카카오톡이나 이메일로 보내두신 시작 가이드를 열면 내 스마트폰 라운지와 1초 만에 연동됩니다.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => setShowMobileMasterPcIntroModal(false)}
            className="px-5 py-2.5 rounded-xl bg-primary-container text-zinc-950 font-label-md text-[13px] font-black cursor-pointer"
          >
            📱 모바일 라운지 뷰어로 계속 둘러보기
          </button>
        </div>
      </div>
    </div>
  );
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
      '[귀신같이 라운지 초대장] 혼자 쓸 땐 언제나 0원, 함께 쓸 땐 방장 한 분만! 초대받은 가족·회원·직원은 언제나 무료입니다. https://ghosti.sundreamer.app';
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
      '귀신같이(Ghosti) | 사진·영상·서류 속 내용까지 1초 만에 꿰뚫어 찾는 1초 AI 내용검색 — 내 폰·PC 속 내용검색·Z몬스터는 언제나 0원, 가족·모임·업무 공유는 방장 한 분만 https://ghosti.sundreamer.app';
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
                <GhostiBrandLogo size="desktop" themeMode="dark" showBadge={true} />
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
      className="fixed inset-0 z-[105] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl rounded-3xl bg-[#121215] border border-white/15 p-6 md:p-8 shadow-2xl flex flex-col gap-6 my-auto"
      >
        {/* 모달 헤더 */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <GhostiBrandLogo size="desktop" themeMode="dark" showBadge={true} />
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
                  ✨ 개인 (기본) : 언제나 0원 모드로 전환
                </button>
              )}
            </div>
            <h2 className="font-headline-lg text-[22px] md:text-[26px] text-white font-black tracking-tight mt-1">
              혼자 쓸 땐 언제나 0원, 함께 쓸 땐 방장 한 분만
            </h2>
            <p className="font-body-sm text-[13px] text-zinc-300 font-medium">
              *신용카드 등록도, 광고도 없습니다. 초대받은 가족·회원·직원은 전원 무료입니다.
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

        {/* 📢 1차 혜택 1줄 안내띠 (대표 슬로건은 위 제목에서 1회만 노출) */}
        <div
          data-keep-dark="true"
          className="px-4 py-3 md:px-5 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-teal-950/85 to-zinc-950 border border-emerald-400/50 flex flex-wrap items-center justify-between gap-2"
        >
          <p className="font-body-sm text-[13px] md:text-[13.5px] text-amber-200 font-extrabold leading-relaxed">
            🎁 <strong className="underline decoration-amber-300 text-amber-300">{activeMasterTier.bannerHeadline}</strong>
          </p>
          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/25 border border-rose-400/50 text-amber-200 font-label-mono text-[11px] font-extrabold">
            🔥 1차 100명 중 87석 완료 (잔여 13석)
          </span>
        </div>

        {/* 모바일 접속자 편의: 검색 없이 내 이메일/카톡으로 PC 마스터 접속 주소 보내기 */}
        <PcMasterQuickSendPanel compact />

        {/* 1. 3대 메뉴 초심플 기본 요금제 (마스터 1인 결제 ➔ 멤버 전원 무료) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ① 🆓 내 기기 (개인 기본 : 언제나 0원) */}
          <div className="p-5 rounded-2xl bg-[#18181B] border border-emerald-400/40 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11.5px] font-bold">
                  1. 🆓 내 기기 (혼자 쓰기)
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-400 text-zinc-950 font-label-sm text-[10.5px] font-extrabold">
                  비용 없이 제한 없이
                </span>
              </div>
              <h3 className="font-headline-sm text-[19px] text-white font-extrabold">
                🆓 내 기기 (내용검색 · 클린 · 설정몬스터)
              </h3>

              <div className="p-4 rounded-xl bg-zinc-950/90 border border-emerald-400/35 flex flex-col justify-between gap-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-headline-md text-[22px] text-emerald-300 font-black">
                    개인 (기본) : 언제나 0원
                  </span>
                  <span className="font-label-mono text-[11.5px] text-zinc-300 font-bold">
                    카드 등록 NO · 광고 NO
                  </span>
                </div>
                <p className="font-body-sm text-[12px] text-emerald-200/95 font-bold">
                  &ldquo;내 폰·PC 속 클린·설정몬스터와 1초 AI 내용검색 — 기간 제한 없이 언제나 0원&rdquo;
                </p>
                <p className="font-body-sm text-[12px] text-zinc-300 leading-relaxed">
                  • 👁️ <strong>귀신같이 내용찾기</strong> (내 사진·영상·서류 1초 검색 · 언제나 0원)<br />
                  • 🩺 <strong>귀신같이 클린몬스터</strong> (중복·스크린샷·바탕화면 정리 · 언제나 0원)<br />
                  • 🛠️ <strong>Ghosti 설정몬스터</strong> (원클릭 수리 &amp; 1초 원상복구 · 비용 없이 제한 없이)
                </p>
                <div className="pt-1 border-t border-white/10 text-[11px] text-zinc-400">
                  ※ 기기 3대째(집 PC + 회사 PC 등 PC 2대 연결)부터는 아래 <strong>[💼 업무 공유 — 1인 멀티PC (월 1,900원)]</strong>으로 전환됩니다.
                </div>
              </div>
            </div>
          </div>

          {/* ② 👨‍👩‍👧‍👦 패밀리 공유 (우리집 5,900원 / 양가 3방 8,900원) */}
          <div className="p-5 rounded-2xl bg-[#18181B] border border-primary-container/45 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-primary-container/15 border border-primary-container/40 text-primary-container font-label-sm text-[11.5px] font-bold">
                  2. 📸 사진 공유 (가족) • 방장 1인 결제 ➔ 가족 전원 무료
                </span>
              </div>
              <h3 className="font-headline-sm text-[19px] text-white font-extrabold">
                👨‍👩‍👧‍👦 패밀리 공유 (사진·동영상 전용 · 🛂 여권 발동)
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
                    <span className="font-label-mono text-[11.5px] text-amber-300 font-bold">
                      (10년 마스터권 59,000원)
                    </span>
                    <p className="font-body-sm text-[11px] text-zinc-400 mt-1">
                      우리집 전용 사진·영상 라운지 (가족 인원 무제한)
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
                      className="py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11px] font-extrabold"
                    >
                      10년권 59,000원
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
                    <span className="font-label-mono text-[11.5px] text-amber-300 font-bold">
                      (10년 마스터권 89,000원)
                    </span>
                    <p className="font-body-sm text-[11px] text-zinc-300 mt-1">
                      우리집 + 본가(친가) + 처가(친정) 3방 분리 &amp; 호칭 자동 전환
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
                      className="py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11px] font-extrabold"
                    >
                      10년권 89,000원
                    </button>
                  </div>
                </div>
              </div>

              {/* 가족 라운지 연구독 특전: 모임 라운지 3개월 무료 구독권 1장 */}
              <div className="p-3 rounded-xl bg-primary-container/10 border border-primary-container/35 flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1">
                <span className="text-[11.5px] text-emerald-200">
                  🎁 <strong>[가족방 연 구독 특전]</strong> 패밀리 연 구독(마스터권) 결제 시 <strong>[모임(동호회·동창회) 라운지 3개월 무료 구독권 1장]</strong>을 증정합니다!
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopyFamilyTrojanBrag()}
                  className={`py-1.5 px-3 rounded-lg font-label-sm text-[11px] font-extrabold shrink-0 transition-all cursor-pointer ${
                    familyTrojanCopied
                      ? 'bg-emerald-400 text-zinc-950'
                      : 'bg-primary-container hover:opacity-95 text-zinc-950'
                  }`}
                >
                  {familyTrojanCopied
                    ? '✓ 모임 3개월권 선물 문구 복사됨!'
                    : '💌 모임 3개월 무료권 선물 카피'}
                </button>
              </div>
            </div>
          </div>

          {/* ③ ⛳ 동호회 · 🎓 동창회 공유 (인원수 무제한 월 4,900원 단일가 통일!) */}
          <div className="p-5 rounded-2xl bg-[#18181B] border border-amber-400/40 md:col-span-2 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/40 text-amber-300 font-label-sm text-[11.5px] font-extrabold">
                  3. 📸 사진 공유 (동호회 · 동창회) • 인원수 무제한 4,900원 쿨 단일가!
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-label-sm text-[10.5px] font-extrabold">
                  🏅 총무 명예의 전당 배지 + 🎁 가족 라운지 1개월 무료 구독권 3장 증정
                </span>
              </div>
              <h3 className="font-headline-sm text-[19px] text-white font-extrabold">
                ⛳ 동호회 · 🎓 동창회 공유 — &ldquo;인원수 계산 없이 무조건 월 4,900원 (10년 마스터권 49,000원) 단일가!&rdquo;
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* 동호회·소모임 단일 플랜 */}
                <div className="p-4 rounded-xl bg-zinc-950/90 border border-white/10 flex flex-col justify-between gap-2.5">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-label-sm text-[12px] text-primary-container font-extrabold">
                        ⛳ 동호회 · 소모임 (모임 이름 문패)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[10.5px] font-bold">
                        인원 무제한 · 회원 전원 무료
                      </span>
                    </div>
                    <div className="font-headline-md text-[22px] text-white font-black mt-1">
                      월 4,900원{' '}
                      <span className="font-label-mono text-[12px] text-amber-300 font-bold">
                        (10년 마스터권 49,000원 · 월 408원 꼴)
                      </span>
                    </div>
                    <p className="font-body-sm text-[11.5px] text-zinc-300 mt-1">
                      골프·산악회·독서·조기축구 등 모임 인원이 10명이든 500명이든 추가 요금 0원! (사진·동영상 전용 / 🛂 얼굴 여권 발동)
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('club_small_4900')}
                      className="py-2 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold"
                    >
                      월 4,900원 개설
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('club_small_year_49000')}
                      className="py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[12px] font-extrabold"
                    >
                      10년 마스터권 49,000원
                    </button>
                  </div>
                </div>

                {/* 동창회·반창회 단일 플랜 */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-amber-400/40 flex flex-col justify-between gap-2.5">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-label-sm text-[12px] text-amber-300 font-extrabold">
                        🎓 동창회 · 반창회 (학교/학년/반 문패)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[10.5px] font-bold">
                        인원 무제한 · 동창 전원 무료
                      </span>
                    </div>
                    <div className="font-headline-md text-[22px] text-white font-black mt-1">
                      월 4,900원{' '}
                      <span className="font-label-mono text-[12px] text-amber-300 font-bold">
                        (10년 마스터권 49,000원 · 월 408원 꼴)
                      </span>
                    </div>
                    <p className="font-body-sm text-[11.5px] text-zinc-300 mt-1">
                      일 년에 한두 번 모이는 동창회도 부담 없이! 졸업앨범 아날로그 복원 + 학창시절 내 얼굴 1초 찾기 (사진·동영상 전용)
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('club_small_4900')}
                      className="py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-white font-label-sm text-[12px] font-bold"
                    >
                      월 4,900원 개설
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('club_small_year_49000')}
                      className="py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[12px] font-extrabold"
                    >
                      10년 마스터권 49,000원
                    </button>
                  </div>
                </div>
              </div>

              {/* 모임 연 구독 특전: 가족 라운지 1개월 무료 구독권 3장 */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/35 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[11.5px] text-amber-200">
                  🎁 <strong>[모임방 연 구독 특전]</strong> 동호회·동창회 연 구독(마스터권 49,000원) 결제 시 총무님께 <strong>[가족 라운지 1개월 무료 구독권 3장]</strong>을 즉시 증정합니다!
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopyTrojanBrag()}
                  className={`py-1.5 px-3 rounded-lg font-label-sm text-[11.5px] font-extrabold shrink-0 transition-all cursor-pointer ${
                    trojanCouponCopied
                      ? 'bg-emerald-400 text-zinc-950'
                      : 'bg-amber-400 hover:bg-amber-300 text-zinc-950'
                  }`}
                >
                  {trojanCouponCopied
                    ? '✓ 가족방 1개월권 3장 문구 복사됨!'
                    : '💌 가족방 1개월권 3장 선물 카피'}
                </button>
              </div>
            </div>
          </div>

          {/* ④ 💼 업무 공유 (S: 드라이브 1대 + 다중 백업 PC 미러링 + 1인 멀티PC / 소호 ~5인 / 소기업 ~20인 / 중소기업 ~50인) */}
          <div className="p-5 rounded-2xl bg-[#18181B] border-2 border-cyan-400/45 md:col-span-2 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-cyan-400 text-zinc-950 font-label-sm text-[11.5px] font-extrabold">
                  4. 💼 업무 공유 • 윈도우 탐색기(S:) 원본 작업 + 🛡️ 다중 백업 PC 자동 미러링
                </span>
                <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11px] font-extrabold">
                  💽 공용 업무 PC(S:) 1대 + 백업 PC 여러 대 무제한 지정 · 📸 현장사진 분석 · 🛂 인물 여권 미발동
                </span>
              </div>
              <h3 className="font-headline-sm text-[19px] text-white font-extrabold">
                💼 업무 공유 — &ldquo;탐색기(S:)에서 원본 서류를 직접 편집하고, 여러 대의 백업 PC에 실시간 복제해 클라우드 불안감을 0%로 없앱니다&rdquo;
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                {/* 입문: 1인 멀티PC */}
                <div className="p-3.5 rounded-xl bg-zinc-950/90 border border-white/15 flex flex-col justify-between gap-2.5">
                  <div>
                    <span className="font-label-sm text-[11px] text-zinc-300 font-extrabold">
                      💻 1인 멀티PC (기기 3대째~)
                    </span>
                    <div className="font-headline-md text-[20px] text-white font-black mt-0.5">
                      월 1,900원
                    </div>
                    <span className="font-label-mono text-[11px] text-amber-300 font-bold">
                      (10년 마스터권 19,000원)
                    </span>
                    <p className="font-body-sm text-[11px] text-zinc-400 mt-1">
                      집 PC + 회사 PC (PC 2대 연결) S: 드라이브 직결 &amp; 양방향 자동 백업
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('personal_sub_3900')}
                      className="py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-label-sm text-[11px] font-bold"
                    >
                      월 1,900원
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('personal_year_35000')}
                      className="py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[10.5px] font-extrabold"
                    >
                      10년권 1.9만
                    </button>
                  </div>
                </div>

                {/* 소호(SOHO) ~5인 */}
                <div className="p-3.5 rounded-xl bg-zinc-950/90 border border-cyan-400/40 flex flex-col justify-between gap-2.5">
                  <div>
                    <span className="font-label-sm text-[11px] text-cyan-300 font-extrabold">
                      🏢 소호(SOHO) 팀 (~5인)
                    </span>
                    <div className="font-headline-md text-[20px] text-white font-black mt-0.5">
                      월 9,900원
                    </div>
                    <span className="font-label-mono text-[11px] text-amber-300 font-bold">
                      (10년 마스터권 99,000원)
                    </span>
                    <p className="font-body-sm text-[11px] text-zinc-300 mt-1">
                      5인 이하 사무실 · S: 드라이브 + 다중 백업 PC 미러링 + File Lock
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('work_soho_9900')}
                      className="py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-label-sm text-[11px] font-extrabold"
                    >
                      월 9,900원
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('work_soho_year_99000')}
                      className="py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[10.5px] font-extrabold"
                    >
                      10년권 9.9만
                    </button>
                  </div>
                </div>

                {/* 소기업 ~20인 (월 19,000원) */}
                <div className="p-3.5 rounded-xl bg-zinc-900 border border-cyan-400/50 flex flex-col justify-between gap-2.5">
                  <div>
                    <span className="font-label-sm text-[11px] text-cyan-200 font-extrabold">
                      🏢 소기업 플랜 (~20인)
                    </span>
                    <div className="font-headline-md text-[20px] text-white font-black mt-0.5">
                      월 19,000원
                    </div>
                    <span className="font-label-mono text-[11px] text-amber-300 font-bold">
                      (10년 마스터권 190,000원)
                    </span>
                    <p className="font-body-sm text-[11px] text-zinc-300 mt-1">
                      20인 이하 기업 · 부서별 S: 폴더 권한 + 다중 백업 PC 실시간 미러링
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('work_biz_19900')}
                      className="py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-label-sm text-[11px] font-extrabold"
                    >
                      월 19,000원
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('work_biz_year_199000')}
                      className="py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[10.5px] font-extrabold"
                    >
                      10년권 19만
                    </button>
                  </div>
                </div>

                {/* 중소기업 ~50인 (월 29,000원 / 50인 초과 별도 협의) */}
                <div className="p-3.5 rounded-xl bg-zinc-900 border border-amber-400/45 flex flex-col justify-between gap-2.5">
                  <div>
                    <span className="font-label-sm text-[11px] text-amber-300 font-extrabold">
                      🏛️ 중소기업 (~50인)
                    </span>
                    <div className="font-headline-md text-[20px] text-white font-black mt-0.5">
                      월 29,000원
                    </div>
                    <span className="font-label-mono text-[11px] text-amber-300 font-bold">
                      (10년 마스터권 290,000원)
                    </span>
                    <p className="font-body-sm text-[11px] text-zinc-300 mt-1">
                      50인 이하 전사 문서·도면 통합 금고 (※ 50인 이상은 별도 협의)
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('work_biz_19900')}
                      className="py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-white font-label-sm text-[11px] font-bold"
                    >
                      월 29,000원
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('work_biz_year_199000')}
                      className="py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[10.5px] font-extrabold"
                    >
                      10년권 29만
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
              <GhostiBrandLogo size="mobile" themeMode="dark" showBadge={true} />
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
              💡 모임 연구독 총무님께는 <strong>[가족 라운지 1개월 무료 구독권 3장]</strong>, 가족방 연구독 방장님께는 <strong>[모임 라운지 3개월 무료 구독권 1장]</strong> 교차 특전이 제공됩니다.
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

        {/* 4. 마이페이지 / 지갑 기본 편의 기능: 멀린 코인 잔액 & 코인 선물하기 (조용한 기본 기능) */}
        <div className="px-4 py-3 rounded-xl bg-zinc-950/90 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-[12px]">
          <div className="flex flex-wrap items-center gap-2 text-zinc-300">
            <span className="font-bold text-amber-300">
              🪙 내 멀린 코인 지갑: {(merlinAuth.coinBalance ?? 5200).toLocaleString()} 코인
            </span>
            <span className="text-zinc-500">|</span>
            <span className="text-zinc-400">
              MerlinFamilyOS 패밀리 앱 공통 기축 통화 (충전 및 가족·총무 코인 선물 지원)
            </span>
          </div>
          <button
            type="button"
            onClick={handleSimulateP2pCoinGift}
            className={`px-3 py-1.5 rounded-lg font-label-sm text-[11.5px] font-bold border transition-all cursor-pointer ${
              p2pGiftSent
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                : 'bg-zinc-900 hover:bg-zinc-800 border-white/15 text-zinc-300'
            }`}
          >
            {p2pGiftSent ? '✓ 코인 선물 전송 완료' : '🎁 코인 선물하기'}
          </button>
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
