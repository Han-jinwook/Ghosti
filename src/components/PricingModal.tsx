import React, { useEffect, useRef, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { GpuHelperTierId, PricingPlanId } from '../types/saysee';
import { LoungeModeSwitcherBar } from './LoungeView';
import { GhostiBrandLogo } from './GhostiBrandLogo';
import { executeRealOsAction } from '../services/setupMonsterEngine';

const PLAN_LABELS: Record<PricingPlanId, string> = {
  free_trial: '🆓 내 기기 1대 (기본) : 언제나 0원 (혼자 쓰는 내 기기 1대는 기간 제한 없이 언제나 0원입니다)',
  personal_single_2900: '🆓 내 기기 1대 (기본) : 언제나 0원 • 🪄 손보기 & 🎯 1초 찾기',
  personal_sub_3900: '👑 내 기기 통합 • 폰+집PC+회사PC 대수 무제한 (월 3,900원)',
  personal_year_35000: '👑 내 기기 통합 • 폰+집PC+회사PC 무제한 (39,000원 · 1차 선착순 100명 5년 마스터권)',
  family_home_5900: '🏠 패밀리 공유 • 우리집 단독 (월 5,900원)',
  family_home_year_59000: '🏠 패밀리 공유 • 우리집 단독 (59,000원 · 1차 선착순 100명 5년 마스터권)',
  family_three_8900: '👨‍👩‍👧‍👦 패밀리 공유 • 양가 통합권 3방 (월 8,900원)',
  family_three_year_89000: '👨‍👩‍👧‍👦 패밀리 공유 • 양가 통합권 3방 (89,000원 · 1차 선착순 100명 5년 마스터권)',
  club_mini_free_300: '🥂 9인 이하 일상 소모임 (친구·계모임·취미) • 누적 300개 이하 평생 0원(무료)',
  club_mini_2900: '🥂 9인 이하 일상 소모임 • 누적 300개 초과 시 방장만 월 2,900원 (월 구독 전용)',
  club_small_4900: '⛳ 10인 이상 동호회 · 🎓 동창회 (인원 무제한 단일가 월 4,900원)',
  club_small_year_49000: '⛳ 동호회 · 🎓 동창회 (49,000원 · 1차 선착순 100명 5년 마스터권)',
  club_medium_7900: '⛳ 동호회 · 🎓 동창회 (인원 무제한 단일가 월 4,900원)',
  club_medium_year_79000: '⛳ 동호회 · 🎓 동창회 (49,000원 · 1차 선착순 100명 5년 마스터권)',
  club_large_14900: '⛳ 동호회 · 🎓 동창회 (인원 무제한 단일가 월 4,900원)',
  club_large_year_149000: '⛳ 동호회 · 🎓 동창회 (49,000원 · 1차 선착순 100명 5년 마스터권)',
  student_sub_900: '📸 사진 공유 (동호회·동창회 통합)',
  student_year_9000: '📸 사진 공유 (동호회·동창회 통합)',
  work_soho_9900: '💼 업무 공유 • 소호(SOHO) ~5인 (월 9,900원)',
  work_soho_year_99000: '💼 업무 공유 • 소호(SOHO) ~5인 (99,000원 · 1차 선착순 100명 5년 마스터권)',
  work_biz_19900: '💼 업무 공유 • 소기업 ~20인 (월 19,000원) / 중소기업 ~50인 (월 29,000원)',
  work_biz_year_199000: '💼 업무 공유 • 소기업 ~20인 (190,000원) / 중소기업 ~50인 (290,000원 · 5년 마스터권)',
};

/**
 * 3단계 특판(마스터권) 자동 전환 스케줄 (월 구독료 × 10개월 치 일시불 고정)
 * - 1차 100명(5년 · 60개월 보장) ➔ 2차 1,000명(3년 · 36개월 보장) ➔ 3차 10,000명(2년 · 24개월 보장)
 * - 얼리버드 카운터 룰: 초반에는 [🔥 1차 얼리버드 한정 오픈 — 10개월 치 결제로 5년(60개월) 보장]만 노출하며,
 *   실제 잔여 수량이 30석 이하로 내려갔을 때만 [마감 임박: 잔여 N석] 실시간 카운터를 점등합니다.
 */
export const MASTER_PASS_AUTO_SWITCH_TIERS = [
  {
    stage: 1,
    limitCount: 100,
    years: 5,
    months: 60,
    bannerHeadline: '🔥 1차 얼리버드 한정 오픈 — 월 구독료 10개월 치 결제로 5년(60개월) 보장 (선착순 100명)',
  },
  {
    stage: 2,
    limitCount: 1000,
    years: 3,
    months: 36,
    bannerHeadline: '⚡ 2차 특판 오픈 — 월 구독료 10개월 치 결제로 3년(36개월) 보장 (선착순 1,000명)',
  },
  {
    stage: 3,
    limitCount: 10000,
    years: 2,
    months: 24,
    bannerHeadline: '🎁 3차 특판 오픈 — 월 구독료 10개월 치 결제로 2년(24개월) 보장 (선착순 10,000명)',
  },
] as const;

export function validateClubSignboardName(rawName: string): {
  valid: boolean;
  blockedCategory?: 'FAMILY' | 'WORK';
  reason?: string;
} {
  const s = rawName.trim();
  if (!s) {
    return { valid: false, reason: '동호회 또는 동창회 문패 이름을 입력해 주세요 (예: 산들산악회, 한빛고 32기 동창회).' };
  }
  if (/우리집|가족|가정|엄마|아빠|할머니|할아버지|친가|처가|본가|친정|남편|아내|부부|아이들/i.test(s)) {
    return {
      valid: false,
      blockedCategory: 'FAMILY',
      reason: '🚫 [AI 문패 필터] 가족/가정 명칭은 동호회·동창회(4,900원) 문패로 사용할 수 없습니다. 매일 함께 쓰는 가족 사진방은 [👨‍👩‍👧‍👦 패밀리 공유 (월 5,900원)]를 이용해 주세요.',
    };
  }
  if (/주식회사|\(주\)|법인|회사|본사|지사|사무실|영업팀|개발팀|연구소|세무|회계|법무|프로젝트팀|사업부/i.test(s)) {
    return {
      valid: false,
      blockedCategory: 'WORK',
      reason: '🚫 [AI 문패 필터] 기업/부서/업무 명칭은 동호회·동창회 사진방 문패로 사용할 수 없습니다. 서류 검색 및 S: 드라이브가 지원되는 [💼 업무 공유 (월 9,900원~)]를 이용해 주세요.',
    };
  }
  return { valid: true };
}

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
          <GhostiBrandLogo size="mobile" showBadge={true} />
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
              <GhostiBrandLogo size="desktop" showBadge={true} />
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
                  ✨ 개인 (기본) : 언제나 0원 모드로 전환
                </button>
              )}
            </div>
            <h2 className="font-headline-lg text-[21px] md:text-[25px] text-white font-black tracking-tight mt-1">
              방장 1명만 구독하면 초대받은 가족·모임원·팀원은 평생 0원(무료)
            </h2>
            <p className="font-body-sm text-[13px] text-zinc-200 font-medium">
              • 혼자 쓸 땐 언제나 0원, 함께 쓸 땐 방장 한 분만! 신용카드 등록도, 광고도 없으며 초대받은 멤버는 전원 평생 무료입니다.
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

        {/* 📢 3단계 특판(1차 5년 100명 ➔ 2차 3년 1,000명 ➔ 3차 2년 10,000명) 안내띠 & 얼리버드 카운터 룰(30석 이하 시에만 잔여석 점등) */}
        <div
          data-keep-dark="true"
          className="px-4 py-3 md:px-5 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-teal-950/85 to-zinc-950 border border-emerald-400/50 flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex flex-col gap-0.5">
            <p className="font-body-sm text-[13px] md:text-[13.5px] text-amber-200 font-extrabold leading-relaxed">
              🎁 <strong className="underline decoration-amber-300 text-amber-300">{activeMasterTier.bannerHeadline}</strong>
            </p>
            <span className="text-[11px] text-zinc-300">
              자동 전환 스케줄: <strong>1차 5년(100명)</strong> ➔ <strong>2차 3년(1,000명)</strong> ➔ <strong>3차 2년(10,000명)</strong> (모두 월 구독료 10개월 치 일시불)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* [1차 기준]: earlyBirdRemainingSeats <= 30 일 때 점등하되, 분위기 봐서 괜찮다 싶으면 FORCE_SHOW_LIVE_SEAT_BOARD = true 로 언제든 상시 실시간 현황판 노출 가능 */}
            {FORCE_SHOW_LIVE_SEAT_BOARD || earlyBirdRemainingSeats <= 30 ? (
              <span className="px-2.5 py-1 rounded-full bg-rose-500/25 border border-rose-400/60 text-amber-200 font-label-mono text-[11px] font-extrabold animate-pulse">
                🔥 마감 임박 현황판: {100 - earlyBirdRemainingSeats}석 소진 / 잔여 {earlyBirdRemainingSeats}석
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 font-label-mono text-[11px] font-extrabold">
                ✨ 1차 선착순 100명 얼리버드 오픈 중
              </span>
            )}
            <button
              type="button"
              onClick={() => setEarlyBirdRemainingSeats((s) => (s > 30 ? 18 : 72))}
              className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-[10px] text-zinc-400 hover:text-white cursor-pointer"
              title="잔여 30석 이하 마감 임박 카운터 점등 시뮬레이션"
            >
              {earlyBirdRemainingSeats <= 30 ? '여유 상태 보기' : '30석 이하 보기'}
            </button>
          </div>
        </div>

        {/* 모바일 접속자 편의: 검색 없이 내 이메일/카톡으로 PC 마스터 접속 주소 보내기 */}
        <PcMasterQuickSendPanel compact />

        {/* 1. 4단계 가치 사다리 요금제 (0원 내 기기 1대 ➔ 3,900원 내 기기 통합 ➔ 4,900원 동호회·동창회 ➔ 5,900/8,900원 패밀리 ➔ 9,900원~ 업무) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ① 🆓 내 기기 1대 (언제나 0원) */}
          <div className="p-5 rounded-2xl bg-[#18181B] border border-emerald-400/40 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11.5px] font-bold">
                  1. 🆓 내 기기 1대 (혼자 쓰기)
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-400 text-zinc-950 font-label-sm text-[10.5px] font-extrabold">
                  평생 무료 · 카드 등록 NO
                </span>
              </div>
              <h3 className="font-headline-sm text-[19px] text-white font-extrabold">
                🆓 내 기기 1대 (🎯 찾기 · 🪄 손보기 · 7일 초능력 체험)
              </h3>

              <div className="p-4 rounded-xl bg-zinc-950/90 border border-emerald-400/35 flex flex-col justify-between gap-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-headline-md text-[22px] text-emerald-300 font-black">
                    내 기기 1대 : 언제나 0원
                  </span>
                  <span className="font-label-mono text-[11.5px] text-zinc-300 font-bold">
                    광고 NO · 외부 전송 0 Byte
                  </span>
                </div>
                <p className="font-body-sm text-[12px] text-emerald-200/95 font-bold">
                  &ldquo;혼자 쓰는 내 PC 1대 · 내 폰 1대의 1초 AI 내용검색과 치우기·고치기는 평생 0원&rdquo;
                </p>
                <p className="font-body-sm text-[12px] text-zinc-300 leading-relaxed">
                  • 🎯 <strong>귀신같이 찾기</strong> (내 기기 1대 사진·영상·서류 1초 내용검색 · 평생 0원)<br />
                  • 🪄 <strong>귀신같이 손보기</strong> (치우기·고치기·사양진단·빨간 손가락 <code>👆</code> · 평생 0원)<br />
                  • 👻 <strong>귀신 초능력 팩(Ctrl + 0)</strong> (기기당 1주일 전 기능 무료체험)
                </p>
              </div>
            </div>
          </div>

          {/* ② 👑 주력 대표 상품: 내 기기 통합 (월 3,900원 / 1차 5년 특판 39,000원) */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/75 via-[#18181B] to-[#18181B] border-2 border-emerald-400 shadow-[0_0_28px_rgba(16,185,129,0.22)] flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-400 text-zinc-950 font-label-sm text-[11.5px] font-black">
                  2. 👑 대표 주력 • 내 기기 통합 (폰 + 집PC + 회사PC 무제한)
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/50 text-amber-300 font-label-sm text-[10.5px] font-extrabold">
                  📧 이메일 하나로 모든 기기 자동 연결
                </span>
              </div>
              <h3 className="font-headline-sm text-[19px] text-white font-extrabold">
                👑 내 기기 통합 — &ldquo;내가 손댄 모든 기기가 하나가 되어 내 손아귀에!&rdquo;
              </h3>

              <div className="p-4 rounded-xl bg-zinc-950/90 border border-emerald-400/50 flex flex-col justify-between gap-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-headline-md text-[23px] text-white font-black">
                      월 3,900원
                    </span>
                    <span className="font-label-mono text-[12px] text-amber-300 font-extrabold">
                      (1차 5년 특판 39,000원 · 월 650원 꼴)
                    </span>
                  </div>
                  <span className="font-label-mono text-[11px] text-emerald-300 font-bold">
                    기기 대수 제한 없음
                  </span>
                </div>
                <p className="font-body-sm text-[12px] text-zinc-200 leading-relaxed">
                  • 🥇 <strong>카톡 ‘나에게 보내기’ &amp; 클라우드 월세 종식</strong> (폰⇄집PC⇄회사PC 원본 직결)<br />
                  • 🥈 <strong>무버튼 양방향 클립보드 ‘암호화 우체통(E2EE)’</strong> (꺼져 있던 집 PC 부팅 즉시 회사·폰에서 복사한 텍스트 100개·스샷 10장 <code>Ctrl+0 [복사검색]</code> 자동 장전)<br />
                  • 🥉 <strong>귀신 초능력 팩(Ctrl+0) 전 기기 평생 무제한 해금 + <code>F1~F10</code> 10개 상용구 동기화</strong><br />
                  • 💻 <strong>집 PC ⇄ 회사 PC 탐색기(S:) 양방향 자동 백업</strong>
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('personal_sub_3900')}
                    className="py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-label-sm text-[12px] font-black cursor-pointer"
                  >
                    월 3,900원 시작
                  </button>
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('personal_year_35000')}
                    className="py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[12px] font-black cursor-pointer"
                  >
                    🔥 5년 특판 39,000원
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ③ 📸 사진 공유: 🥂 9인 이하 일상 소모임 (300개 무료 / 초과 시 월 2,900원) + ⛳ 10인 이상 동호회 · 🎓 동창회 (월 4,900원) */}
          <div className="p-5 rounded-2xl bg-[#18181B] border border-amber-400/40 md:col-span-2 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/40 text-amber-300 font-label-sm text-[11.5px] font-extrabold">
                  3. 📸 사진 공유 • 🥂 9인 이하 소모임(300개 0원 / 초과 시 월 2,900원) &amp; ⛳ 10인 이상 동호·동창회(월 4,900원)
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-label-sm text-[10.5px] font-extrabold">
                  💬 카톡 인앱 무가입 1초 프리뷰 + 🏅 총무 명예의 전당 배지 + 🎁 가족방 1개월권 3장 증정
                </span>
              </div>
              <h3 className="font-headline-sm text-[19px] text-white font-extrabold">
                🥂 9인 이하 일상 소모임(300개 무료 · 초과 시 월 2,900원) &amp; ⛳·🎓 10인 이상 동호회·동창회(월 4,900원 단일가)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                {/* ① 🥂 9인 이하 일상 소모임 (300장 무료 마중물 + 초과 시 월 2,900원 · 월 구독 전용) */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/60 via-zinc-950 to-zinc-950 border border-emerald-400/50 flex flex-col justify-between gap-2.5">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-label-sm text-[12px] text-emerald-300 font-extrabold">
                        🥂 9인 이하 일상 소모임 (친구·계모임·취미)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 text-[10px] font-bold shrink-0">
                        방장 포함 9인 이하
                      </span>
                    </div>
                    <div className="font-headline-md text-[20px] text-white font-black mt-1">
                      300개까지 0원{' '}
                      <span className="font-label-mono text-[12px] text-emerald-300 font-extrabold block sm:inline">
                        (300개 초과 시 방장만 월 2,900원)
                      </span>
                    </div>
                    <p className="font-body-sm text-[11.5px] text-zinc-300 mt-1">
                      맛집·여행·계모임 단톡방 친구들(한 자릿수, 최대 9명)끼리 방 개설 즉시 <strong className="text-emerald-300">누적 300개까지 평생 0원</strong>! 301번째부터 방장만 커피 한 잔 값 <strong className="text-white">월 2,900원</strong> (월 구독 전용 · 카톡 무가입 1초 프리뷰 지원)
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('club_mini_free_300')}
                      className="py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
                    >
                      🥂 300개 0원 개설
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('club_mini_2900')}
                      className="py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-emerald-400/40 text-emerald-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
                    >
                      300개 초과 월 2,900원
                    </button>
                  </div>
                </div>

                {/* ② ⛳ 10인 이상 동호회 단일 플랜 */}
                <div className="p-4 rounded-xl bg-zinc-950/90 border border-white/10 flex flex-col justify-between gap-2.5">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-label-sm text-[12px] text-primary-container font-extrabold">
                        ⛳ 10인 이상 동호회 ([⛳ OO산악회] 문패)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[10px] font-bold shrink-0">
                        10인~무제한 · 회원 0원
                      </span>
                    </div>
                    <div className="font-headline-md text-[20px] text-white font-black mt-1">
                      월 4,900원{' '}
                      <span className="font-label-mono text-[11.5px] text-amber-300 font-bold block sm:inline">
                        (1차 5년 특판 49,000원)
                      </span>
                    </div>
                    <p className="font-body-sm text-[11.5px] text-zinc-300 mt-1">
                      골프·산악회·조기축구 등 10명 이상~수백 명 모임도 인원수 추가 요금 없이 무조건 월 4,900원 단일가! (사진·영상 무제한 + 각 방 실명·별명 그대로 표시)
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('club_small_4900')}
                      className="py-2 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
                    >
                      월 4,900원 개설
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('club_small_year_49000')}
                      className="py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
                    >
                      🔥 5년 특판 49,000원
                    </button>
                  </div>
                </div>

                {/* ③ 🎓 10인 이상 동창회·반창회 단일 플랜 */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-amber-400/40 flex flex-col justify-between gap-2.5">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-label-sm text-[12px] text-amber-300 font-extrabold">
                        🎓 10인 이상 동창회 ([🎓 OO고 동창회] 문패)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[10px] font-bold shrink-0">
                        10인~무제한 · 동창 0원
                      </span>
                    </div>
                    <div className="font-headline-md text-[20px] text-white font-black mt-1">
                      월 4,900원{' '}
                      <span className="font-label-mono text-[11.5px] text-amber-300 font-bold block sm:inline">
                        (1차 5년 특판 49,000원)
                      </span>
                    </div>
                    <p className="font-body-sm text-[11.5px] text-zinc-300 mt-1">
                      연례 체육대회·기수별 동창회도 부담 없이! 졸업앨범 아날로그 복원 + 학창시절 내 얼굴 1초 찾기 + 카톡 단톡방 무가입 1초 프리뷰 지원
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('club_small_4900')}
                      className="py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-white font-label-sm text-[11.5px] font-bold cursor-pointer"
                    >
                      월 4,900원 개설
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('club_small_year_49000')}
                      className="py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
                    >
                      🔥 5년 특판 49,000원
                    </button>
                  </div>
                </div>
              </div>

              {/* 🛡️ 동호회·동창회 상단 문패 강제 각인 & AI 문패 이름 필터 검증기 */}
              <div className="p-3 rounded-xl bg-zinc-950/90 border border-white/10 flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
                  <span className="font-extrabold text-amber-300">
                    🛡️ [모임 문패 AI 필터] 상단 [⛳ OO산악회 / 🎓 OO동창회] 문패 자동 각인 (가족·회사 명칭 우회 개설 자동 차단)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={clubSignboardName}
                      onChange={(e) => setClubSignboardName(e.target.value)}
                      placeholder="모임 문패 이름 입력 (예: 산들산악회)"
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/15 text-[11.5px] text-white outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const res = validateClubSignboardName(clubSignboardName);
                        if (res.valid) {
                          setClubSignboardFeedback(`✅ [⛳ ${clubSignboardName.trim()}] 모임 문패 검증 통과! 모든 멤버 화면 상단에 문패가 고정됩니다.`);
                        } else {
                          setClubSignboardFeedback(res.reason || '사용할 수 없는 문패 이름입니다.');
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-400 text-zinc-950 text-[11px] font-black cursor-pointer"
                    >
                      문패 검증
                    </button>
                  </div>
                </div>
                {clubSignboardFeedback && (
                  <div
                    className={`text-[11px] font-bold ${
                      clubSignboardFeedback.startsWith('✅') ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {clubSignboardFeedback}
                  </div>
                )}
              </div>

              {/* 모임 연 구독 특전: 가족 라운지 1개월 무료 구독권 3장 */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/35 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[11.5px] text-amber-200">
                  🎁 <strong>[모임방 마스터권 특전]</strong> 동호회·동창회 마스터권(49,000원) 결제 시 총무님께 <strong>[가족 라운지 1개월 무료 구독권 3장]</strong>을 즉시 증정합니다!
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

          {/* ④ 👨‍👩‍👧‍👦 패밀리 공유 (우리집 5,900원 / 양가 3방 8,900원) */}
          <div className="p-5 rounded-2xl bg-[#18181B] border border-primary-container/45 md:col-span-2 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-primary-container/15 border border-primary-container/40 text-primary-container font-label-sm text-[11.5px] font-bold">
                  4. 👨‍👩‍👧‍👦 패밀리 공유 (365일 평생 사진·영상 역사관) • 방장 1인 결제 ➔ 가족 전원 0원
                </span>
                <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-zinc-300 text-[10.5px] font-bold">
                  🛂 가족 얼굴 여권 · 각 방에서 입력한 실명·별명 그대로 표시 · F1~F10 가족 공용 상용구 공유
                </span>
              </div>
              <h3 className="font-headline-sm text-[19px] text-white font-extrabold">
                👨‍👩‍👧‍👦 패밀리 공유 — &ldquo;우리집 단독(월 5,900원) &amp; 양가 3방 통합(월 8,900원)&rdquo;
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* 🏠 우리집 단독 */}
                <div className="p-4 rounded-xl bg-zinc-950/90 border border-white/10 flex flex-col justify-between gap-2">
                  <div>
                    <span className="font-label-sm text-[12px] text-zinc-200 font-bold">
                      🏠 우리집 단독 (방 1개 · 가족 인원 무제한)
                    </span>
                    <div className="font-headline-md text-[22px] text-white font-black mt-0.5">
                      월 5,900원{' '}
                      <span className="font-label-mono text-[12px] text-amber-300 font-bold">
                        (1차 5년 특판 59,000원)
                      </span>
                    </div>
                    <p className="font-body-sm text-[11.5px] text-zinc-400 mt-1">
                      매일 찍는 아이·반려동물·가족 여행 원본 사진·영상 무제한 금고 + 가족 공용 상용구(와이파이·현관비번) 공유
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('family_home_5900')}
                      className="py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-white font-label-sm text-[12px] font-bold cursor-pointer"
                    >
                      월 5,900원
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('family_home_year_59000')}
                      className="py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[12px] font-extrabold cursor-pointer"
                    >
                      🔥 5년 특판 59,000원
                    </button>
                  </div>
                </div>

                {/* 👨‍👩‍👧‍👦 양가 통합권 */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-primary-container/50 flex flex-col justify-between gap-2">
                  <div>
                    <span className="font-label-sm text-[12px] text-primary-container font-bold">
                      👨‍👩‍👧‍👦 양가 통합권 (우리집 + 친가 + 처가 3개 방 완벽 분리)
                    </span>
                    <div className="font-headline-md text-[22px] text-white font-black mt-0.5">
                      월 8,900원{' '}
                      <span className="font-label-mono text-[12px] text-amber-300 font-bold">
                        (1차 5년 특판 89,000원)
                      </span>
                    </div>
                    <p className="font-body-sm text-[11.5px] text-zinc-300 mt-1">
                      프라이버시는 3개 방으로 완벽히 분리하면서 손주 사진은 양가 부모님 방으로 1초 동시 전송 (각 방 실명·별명 그대로 표시)
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('family_three_8900')}
                      className="py-2 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold cursor-pointer"
                    >
                      월 8,900원
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('family_three_year_89000')}
                      className="py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[12px] font-extrabold cursor-pointer"
                    >
                      🔥 5년 특판 89,000원
                    </button>
                  </div>
                </div>
              </div>

              {/* 가족 라운지 연구독 특전: 모임 라운지 3개월 무료 구독권 1장 */}
              <div className="p-3 rounded-xl bg-primary-container/10 border border-primary-container/35 flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1">
                <span className="text-[11.5px] text-emerald-200">
                  🎁 <strong>[가족방 마스터권 특전]</strong> 패밀리 마스터권 결제 시 <strong>[모임(동호회·동창회) 라운지 3개월 무료 구독권 1장]</strong>을 증정합니다!
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

          {/* ⑤ 💼 업무 공유 (소호 ~5인 9,900원 / 소기업 ~20인 19,000원 / 중소기업 ~50인 29,000원) */}
          <div className="p-5 rounded-2xl bg-[#18181B] border-2 border-cyan-400/45 md:col-span-2 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-cyan-400 text-zinc-950 font-label-sm text-[11.5px] font-extrabold">
                  5. 💼 업무 공유 • 윈도우 탐색기(S:) 원본 작업 + 🛡️ 다중 백업 PC 자동 미러링
                </span>
                <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11px] font-extrabold">
                  💽 공용 업무 PC(S:) 1대 + 백업 PC 무제한 지정 · 📄 전 문서 본문 검색 · 🛂 인물 여권 미발동
                </span>
              </div>
              <h3 className="font-headline-sm text-[19px] text-white font-extrabold">
                💼 업무 공유 — &ldquo;탐색기(S:)에서 원본 서류를 직접 편집하고, 여러 대의 백업 PC에 실시간 복제해 클라우드 불안감을 0%로 없앱니다&rdquo;
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                {/* 소호(SOHO) ~5인 */}
                <div className="p-4 rounded-xl bg-zinc-950/90 border border-cyan-400/40 flex flex-col justify-between gap-2.5">
                  <div>
                    <span className="font-label-sm text-[11.5px] text-cyan-300 font-extrabold">
                      🏢 소호(SOHO) 팀 (~5인)
                    </span>
                    <div className="font-headline-md text-[21px] text-white font-black mt-0.5">
                      월 9,900원
                    </div>
                    <span className="font-label-mono text-[11px] text-amber-300 font-bold">
                      (1차 5년 특판 99,000원)
                    </span>
                    <p className="font-body-sm text-[11.5px] text-zinc-300 mt-1">
                      5인 이하 사무실 · S: 드라이브 + 다중 백업 PC 미러링 + File Lock
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
                      🔥 5년권 9.9만
                    </button>
                  </div>
                </div>

                {/* 소기업 ~20인 (월 19,000원) */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-cyan-400/50 flex flex-col justify-between gap-2.5">
                  <div>
                    <span className="font-label-sm text-[11.5px] text-cyan-200 font-extrabold">
                      🏢 소기업 플랜 (~20인)
                    </span>
                    <div className="font-headline-md text-[21px] text-white font-black mt-0.5">
                      월 19,000원
                    </div>
                    <span className="font-label-mono text-[11px] text-amber-300 font-bold">
                      (1차 5년 특판 190,000원)
                    </span>
                    <p className="font-body-sm text-[11.5px] text-zinc-300 mt-1">
                      20인 이하 기업 · 부서별 S: 폴더 권한 + 다중 백업 PC 실시간 미러링
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('work_biz_19900')}
                      className="py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
                    >
                      월 19,000원
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('work_biz_year_199000')}
                      className="py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11px] font-extrabold cursor-pointer"
                    >
                      🔥 5년권 19만
                    </button>
                  </div>
                </div>

                {/* 중소기업 ~50인 (월 29,000원 / 50인 초과 별도 협의) */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-amber-400/45 flex flex-col justify-between gap-2.5">
                  <div>
                    <span className="font-label-sm text-[11.5px] text-amber-300 font-extrabold">
                      🏛️ 중소기업 (~50인)
                    </span>
                    <div className="font-headline-md text-[21px] text-white font-black mt-0.5">
                      월 29,000원
                    </div>
                    <span className="font-label-mono text-[11px] text-amber-300 font-bold">
                      (1차 5년 특판 290,000원)
                    </span>
                    <p className="font-body-sm text-[11.5px] text-zinc-300 mt-1">
                      50인 이하 전사 문서·도면 통합 금고 (※ 50인 이상은 별도 협의)
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('work_biz_19900')}
                      className="py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-white font-label-sm text-[11.5px] font-bold cursor-pointer"
                    >
                      월 29,000원
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('work_biz_year_199000')}
                      className="py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11px] font-extrabold cursor-pointer"
                    >
                      🔥 5년권 29만
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

export function renderHighlightedDocText(
  text: string,
  query: string,
  fallbackKeywords: string[] = []
): React.ReactNode {
  if (!text) return text;
  const rawQ = (query || '').trim();
  const stopSet = new Set([
    '찾아줘',
    '보여줘',
    '사진',
    '문서',
    '파일',
    '서류함',
    '최근',
    '서류',
    '내역',
    '전체',
  ]);
  const queryTokens = rawQ
    .replace(/[.,!?'"“”‘’()[\]{}]/g, ' ')
    .split(/\s+/)
    .map((t) =>
      t.replace(/(에서|으로|이랑|하고|부터|까지|있는|하는|찍는|들을|들|의|을|를|은|는|에|와|과|도)$/, '')
    )
    .filter((t) => t.length >= 2 && !stopSet.has(t));

  const activeTokens =
    queryTokens.length > 0
      ? queryTokens
      : fallbackKeywords.filter((k) => k && k.trim().length >= 2).slice(0, 4);

  if (activeTokens.length === 0) return text;

  const escaped = Array.from(new Set(activeTokens))
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (escaped.length === 0) return text;

  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);
  const lowerSet = new Set(activeTokens.map((t) => t.toLowerCase()));

  return parts.map((part, idx) =>
    lowerSet.has(part.toLowerCase()) ? (
      <mark
        key={idx}
        className="bg-amber-300 text-zinc-950 font-extrabold px-1 py-0.5 rounded shadow-sm"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    )
  );
}

const videoBlobUrlCache = new Map<string, string>();

/**
 * [스펙 1] 스마트 서류함 내 로컬 PDF/TXT/DOCX 문서 상세 열람 모달
 */
export const LocalDocPreviewModal: React.FC = () => {
  const {
    selectedDocModal,
    setSelectedDocModal,
    openLocalFolder,
    activeQuery,
    hasExecutedUserSearch,
  } = useSaySeeStore();
  if (!selectedDocModal) return null;

  const effectiveQuery = hasExecutedUserSearch ? activeQuery : '';

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
              {renderHighlightedDocText(
                selectedDocModal.title,
                effectiveQuery,
                selectedDocModal.keywords.slice(0, 3)
              )}
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
          <div className="flex items-center justify-between gap-2">
            <span className="font-label-mono text-[11px] text-primary-container font-bold">
              🔍 로컬 문서 본문 미리보기 (검색어 노란색 하이라이트 • 별표 *** 가림 없이 1초 복사 지원)
            </span>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(selectedDocModal.extractedText);
                useSaySeeStore.setState({
                  lastQuarantineToast: `📋 복사 완료! [${selectedDocModal.title}] 본문 내용이 별표(***) 가림 없이 클립보드에 복사되었습니다.`,
                });
              }}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-300 font-label-sm text-[11.5px] font-extrabold shrink-0 cursor-pointer"
            >
              📋 복사
            </button>
          </div>
          <p className="font-body-md text-[14px] text-on-surface leading-relaxed">
            {renderHighlightedDocText(
              selectedDocModal.extractedText,
              effectiveQuery,
              selectedDocModal.keywords.slice(0, 4)
            )}
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

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(selectedDocModal.extractedText);
              useSaySeeStore.setState({
                lastQuarantineToast: `📋 복사 완료! [${selectedDocModal.title}] 본문 내용이 클립보드에 즉시 복사되었습니다.`,
              });
            }}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 font-label-md text-[13px] font-black flex items-center gap-1.5 shadow-md hover:bg-emerald-400 transition-colors cursor-pointer"
          >
            <span>📋 복사</span>
          </button>
          <button
            type="button"
            onClick={() => {
              void executeRealOsAction(
                'open_file_search',
                selectedDocModal.path || selectedDocModal.fileName
              ).then((res) => {
                useSaySeeStore.setState({
                  lastQuarantineToast:
                    res.summaryKo ||
                    `📂 탐색기에서 [${selectedDocModal.fileName}] 파일을 바로 띄웠습니다.`,
                });
              });
            }}
            className="px-4 py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-label-md text-[13px] font-black flex items-center gap-1.5 shadow-md hover:bg-amber-400 transition-colors cursor-pointer"
          >
            <span>🔍 탐색기에서 이 파일 바로 띄우기</span>
          </button>
          <button
            type="button"
            onClick={() => void openLocalFolder('docs')}
            className="px-4 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-label-md text-[13px] font-extrabold flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">folder_open</span>
            <span>로컬 서류함 폴더 열기</span>
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
  const pendingSeekSecRef = useRef<number | null>(null);
  const [resolvedVideoSrc, setResolvedVideoSrc] = useState<string>('');

  useEffect(() => {
    if (!selectedVideoModal) {
      setResolvedVideoSrc('');
      return;
    }
    const rawUrl = selectedVideoModal.videoUrl;
    pendingSeekSecRef.current = selectedVideoModal.matchedSeekSec ?? 0;

    const cachedBlob = videoBlobUrlCache.get(rawUrl);
    if (cachedBlob) {
      setResolvedVideoSrc(cachedBlob);
      return;
    }

    let cancelled = false;
    setResolvedVideoSrc(rawUrl);
    fetch(rawUrl)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error('blob fetch failed'))))
      .then((blob) => {
        if (blob.size > 0) {
          const objUrl = URL.createObjectURL(blob);
          videoBlobUrlCache.set(rawUrl, objUrl);
          if (!cancelled) {
            pendingSeekSecRef.current = selectedVideoModal.matchedSeekSec ?? 0;
            setResolvedVideoSrc(objUrl);
          }
        }
      })
      .catch(() => {
        // fallback to rawUrl
      });

    return () => {
      cancelled = true;
    };
  }, [selectedVideoModal?.id, selectedVideoModal?.videoUrl]);

  useEffect(() => {
    if (!selectedVideoModal) return;
    const targetSec = selectedVideoModal.matchedSeekSec ?? 0;
    pendingSeekSecRef.current = targetSec;
    const vidEl = videoRef.current;
    if (!vidEl) return;

    if (vidEl.readyState >= 1) {
      try {
        vidEl.currentTime = targetSec;
        void vidEl.play().catch(() => {});
      } catch {
        // ignore
      }
    }
  }, [selectedVideoModal?.id, selectedVideoModal?.matchedSeekSec, resolvedVideoSrc]);

  if (!selectedVideoModal) return null;

  const applyPendingSeek = (vidEl: HTMLVideoElement) => {
    const targetSec = pendingSeekSecRef.current ?? selectedVideoModal.matchedSeekSec ?? 0;
    try {
      if (Math.abs(vidEl.currentTime - targetSec) > 0.4) {
        vidEl.currentTime = targetSec;
      }
      void vidEl.play().catch(() => {});
    } catch {
      // ignore
    }
  };

  const handleJumpToSecond = (sec: number) => {
    pendingSeekSecRef.current = sec;
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

        {/* 동영상 플레이어 (인메모리 Blob Byte-Range 지원으로 중반부/후반부 어느 초(Sec)든 0.01초 즉시 점프 재생) */}
        <div className="relative rounded-2xl overflow-hidden bg-black border border-primary-container/40 aspect-video flex items-center justify-center">
          <video
            ref={videoRef}
            src={resolvedVideoSrc || selectedVideoModal.videoUrl}
            poster={selectedVideoModal.thumbUrl}
            controls
            playsInline
            onLoadedMetadata={(e) => applyPendingSeek(e.currentTarget)}
            onCanPlay={(e) => {
              if (pendingSeekSecRef.current !== null) {
                const target = pendingSeekSecRef.current;
                pendingSeekSecRef.current = null;
                try {
                  if (Math.abs(e.currentTarget.currentTime - target) > 0.4) {
                    e.currentTarget.currentTime = target;
                  }
                  void e.currentTarget.play().catch(() => {});
                } catch {
                  // ignore
                }
              }
            }}
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
