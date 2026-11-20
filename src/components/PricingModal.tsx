import React, { useEffect, useRef, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { GpuHelperTierId, PricingPlanId } from '../types/saysee';
import { LoungeModeSwitcherBar } from './LoungeView';
import { GhostiBrandLogo } from './GhostiBrandLogo';
import { executeRealOsAction } from '../services/setupMonsterEngine';
import {
  stopSetupMonsterTts,
  getIsTtsSpeaking,
  replayLastSetupMonsterTts,
  subscribeGhostiVoicePrefs,
  getPreferredVoiceGender,
  isMobileVoiceEnvironment,
} from '../services/setupMonsterTts';
import { VoiceActorControlPill } from './VoiceActorControlPill';
import { triggerUserFavoriteAiLiveVoiceBatonTouch } from '../services/voiceSearchAndAiBatonEngine';
import { resolveNativeMobileVideoPlaybackUrl } from '../services/ghostiMobileCareBridge';
import { saveCachedMobileGalleryIndex } from '../services/mobilePhotoPicker';
import {
  cleanVideoTimestampLabel,
  extractVideoScreenTextOnDemand,
  resolveVideoCardThumbUrl,
  setVideoPlaybackActive,
  stripKoSearchParticle,
  type VideoOcrLineItem,
} from '../services/aiEngine';

const PLAN_LABELS: Record<PricingPlanId, string> = {
  free_trial: '🆓 1~4번 무료 코어 (귀신비서 · 귀신검색 · 귀신창 · 사진 공유) : 평생 0원 (5·6번 유료 확장 🎁 30일 무료체험 포함)',
  personal_single_2900: '🆓 1~3번 내 기기 (PC·폰) : 언제나 0원 • 👻 귀신비서 · 🎯 귀신검색 · ⚡ 귀신창',
  personal_sub_3900: '👑 5번 내 기기 통합 (PC+폰+PC+) • 🎁 30일 무료체험 (이후 월 3,900원)',
  personal_year_35000: '👑 5번 내 기기 통합 (PC+폰+PC+) • 연간 결제 39,000원 (월 3,250원꼴 · 2개월 무료 할인)',
  family_home_5900: '👨‍👩‍👧‍👦 4번 사진 공유 (가족 · 우리집) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  family_home_year_59000: '👨‍👩‍👧‍👦 4번 사진 공유 (가족 · 우리집) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  family_three_8900: '👨‍👩‍👧‍👦 4번 사진 공유 (가족 · 양가 3방) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  family_three_year_89000: '👨‍👩‍👧‍👦 4번 사진 공유 (가족 · 양가 3방) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  club_mini_free_300: '⛰️ 4번 사진 공유 (동호회 · 소모임) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  club_mini_2900: '⛰️ 4번 사진 공유 (동호회 · 소모임) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  club_small_4900: '⛰️ 4번 사진 공유 (동호회 · 🎓 동창회) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  club_small_year_49000: '⛰️ 4번 사진 공유 (동호회 · 🎓 동창회) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  club_medium_7900: '⛰️ 4번 사진 공유 (동호회 · 🎓 동창회) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  club_medium_year_79000: '⛰️ 4번 사진 공유 (동호회 · 🎓 동창회) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  club_large_14900: '⛰️ 4번 사진 공유 (동호회 · 🎓 동창회) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  club_large_year_149000: '⛰️ 4번 사진 공유 (동호회 · 🎓 동창회) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  student_sub_900: '🎓 4번 사진 공유 (동창회 · 학급) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  student_year_9000: '🎓 4번 사진 공유 (동창회 · 학급) • 인원 무제한 평생 0원 (사진·동영상 전용)',
  work_soho_9900: '💼 6번 업무 공유 (S: 드라이브 · 소호 ~5인 월 9,900원 · 30일 무료체험)',
  work_soho_year_99000: '💼 6번 업무 공유 (S: 드라이브 · 소호 ~5인 연간 결제 99,000원 · 월 8,250원꼴)',
  work_biz_19900: '💼 6번 업무 공유 • 소기업 ~20인 (월 19,000원) / 중소기업 ~50인 (월 29,000원)',
  work_biz_year_199000: '💼 6번 업무 공유 • 소기업 ~20인 (연 190,000원) / 중소기업 ~50인 (연 290,000원)',
};

/**
 * 연간 구독 할인 안내 (월 구독료 × 10개월 치 결제로 1년 12개월 이용 · 2개월 무료 혜택)
 */
export const MASTER_PASS_AUTO_SWITCH_TIERS = [
  {
    stage: 1,
    limitCount: 100,
    years: 1,
    months: 12,
    bannerHeadline: '✨ 연간 결제 시 2개월 무료 할인 (10개월 치 요금으로 12개월 이용)',
  },
] as const;

export function validateClubSignboardName(rawName: string): {
  valid: boolean;
  blockedCategory?: 'FAMILY' | 'WORK';
  reason?: string;
} {
  const s = rawName.trim();
  if (!s) {
    return { valid: false, reason: '가족·동호회·동창회 사진방 문패 이름을 입력해 주세요 (예: 우리집, 산들산악회, 한빛고 32기 동창회).' };
  }
  if (/주식회사|\(주\)|법인|회사|본사|지사|사무실|영업팀|개발팀|연구소|세무|회계|법무|프로젝트팀|사업부/i.test(s)) {
    return {
      valid: false,
      blockedCategory: 'WORK',
      reason: '🚫 [AI 문패 필터] 기업/부서/업무 명칭은 무료 사진 공유방 문패로 사용할 수 없습니다. 엑셀·한글·PDF·워드 업무 서류 검색 및 윈도우 탐색기 S: 드라이브는 [💼 6번 업무 공유 (월 9,900원~ · 30일 무료체험)]를 이용해 주세요.',
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
                  ✨ 1~4번 무료 모드 (내 기기 + 사진 공유 0원)로 전환
                </button>
              )}
            </div>
            <h2 className="font-headline-lg text-[21px] md:text-[25px] text-white font-black tracking-tight mt-1">
              1~4번(귀신비서 · 귀신검색 · 귀신창 · 사진 공유)은 평생 0원! 5·6번(내 기기 통합 · 업무 공유)은 🎁 30일 무료체험 후 결정하세요
            </h2>
            <p className="font-body-sm text-[13px] text-zinc-200 font-medium">
              • 내 기기(귀신비서·귀신검색·귀신창)와 4번 사진 공유(👨‍👩‍👧‍👦가족 · ⛰️동호회 · 🎓동창회)는 내 PC 하드 직결로 클라우드 서버비가 안 들기 때문에 인원 무제한 평생 0원입니다. (단, 4번 사진 공유는 오직 사진·동영상 전용이며, 업무 서류·S: 드라이브는 6번 업무 공유 전용입니다.)
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
              🎁 <strong className="underline decoration-amber-300 text-amber-300">유료 확장(5번 내 기기 통합 · 6번 업무 공유) 신용카드 등록 없이 30일 무료체험 제공 + {activeMasterTier.bannerHeadline}</strong>
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

        {/* 1. 좌측 사이드바 메뉴와 100% 일치하는 요금 체계 (평생 무료 4코어 / 선택형 유료 확장 2종) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ① [평생 무료] 내 기기 (PC·폰): 👻 귀신비서 · 🎯 귀신검색 · ⚡ 귀신창 */}
          <div className="p-5 rounded-2xl bg-[#18181B] border border-emerald-400/40 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11.5px] font-bold">
                  1~3번 [평생 무료] 내 기기 (PC·폰)
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-400 text-zinc-950 font-label-sm text-[10.5px] font-extrabold">
                  평생 0원 · 신용카드 등록 없음
                </span>
              </div>
              <h3 className="font-headline-sm text-[19px] text-white font-extrabold">
                🆓 내 기기 (PC·폰) — 🔍 찾기 &amp; ✋ 손보기
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
                  &ldquo;혼자 쓰는 내 PC · 내 폰의 1초 AI 내용검색(찾기)과 PC 속도·용량 주치의(손보기)는 평생 0원&rdquo;
                </p>
                <p className="font-body-sm text-[12px] text-zinc-300 leading-relaxed">
                  • 🔍 <strong>찾기</strong> (내 기기 사진·영상·서류 1초 내용검색 · 바탕화면·다운로드·최근 100개 우선 개통 · 평생 0원)<br />
                  • ✋ <strong>손보기</strong> (PC 속도 랙 처치 · 수요일 오후 1시 주간 건강검진 · 중복 사진 정리 · 빨간 손가락 <code>👆</code> 수리 · 평생 0원)
                </p>
              </div>
            </div>
          </div>

          {/* ② [4번 — 평생 무료] 사진 공유: 👨‍👩‍👧‍👦 가족 / ⛰️ 동호회 / 🎓 동창회 (오직 사진·동영상 전용) */}
          <div className="p-5 rounded-2xl bg-[#18181B] border-2 border-emerald-400/60 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-400 text-zinc-950 font-label-sm text-[11.5px] font-black">
                  4번 [평생 무료] 사진 공유 (👨‍👩‍👧‍👦 가족 · ⛰️ 동호회 · 🎓 동창회)
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
                  • ⚠️ <strong className="text-amber-300">오직 사진 · 동영상 공유만 작동</strong>합니다. (엑셀·한글·PDF·워드 등 업무 문서 공유 및 윈도우 탐색기 <code>S: 드라이브</code> 마운트는 <strong>6번 업무 공유(월 9,900원~ · 30일 무료체험)</strong> 전용입니다.)
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

          {/* ── 무료(1~4번) / 유료 확장(5·6번 — 30일 무료체험) 경계선 ── */}
          <div className="md:col-span-2 flex items-center gap-2 sm:gap-3 py-1">
            <div className="hidden sm:block flex-1 border-t border-dashed border-amber-400/40" />
            <span className="w-full sm:w-auto text-center break-keep px-3 py-1.5 rounded-2xl sm:rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 font-label-mono text-[11px] sm:text-[11.5px] font-extrabold">
              🎁 5·6번 유료 확장 기능 (신용카드 등록 없이 30일 무료체험 · 연간 결제 2개월 무료)
            </span>
            <div className="hidden sm:block flex-1 border-t border-dashed border-amber-400/40" />
          </div>

          {/* ③ [5번 — 30일 무료체험 / 유료] 내 기기 통합 (PC+폰+PC+): 🔗 내 기기 연결 (PC↔폰) + ⚡ 귀신창 확장 */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/75 via-[#18181B] to-[#18181B] border-2 border-emerald-400 shadow-[0_0_28px_rgba(16,185,129,0.22)] md:col-span-2 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-400 text-zinc-950 font-label-sm text-[11.5px] font-black">
                  5번 [🎁 30일 무료체험 / 유료] 내 기기 통합 (PC+폰+PC+)
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/50 text-amber-300 font-label-sm text-[10.5px] font-extrabold">
                  🔗 내 기기 연결 (PC↔폰) · ⚡ 귀신창 확장 (Ctrl+0) · 대수 무제한
                </span>
              </div>
              <h3 className="font-headline-sm text-[19px] text-white font-extrabold">
                👑 내 기기 통합 — &ldquo;카톡 ‘나에게 보내기’ 끝, 내 모든 기기를 하나로&rdquo;
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
                  • ⚡ <strong>귀신창·귀신검색 유료 확장</strong>: 사진·표 OCR 창, 귀신 라벨러, 스샷·PDF 변환, 다중합본, 창고정 전 기기 무제한 해금
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('personal_sub_3900')}
                    className="py-2.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-label-sm text-[12.5px] font-black cursor-pointer"
                  >
                    🎁 30일 무료체험 후 월 3,900원 시작
                  </button>
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('personal_year_35000')}
                    className="py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[12.5px] font-black cursor-pointer"
                  >
                    ✨ 연간 결제 39,000원 (월 3,250원꼴 · 2개월 무료)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ④ [6번 — 30일 무료체험 / 유료] 업무 공유 (소호 ~5인 9,900원 / 소기업 ~20인 19,000원 / 중소기업 ~50인 29,000원) */}
          <div className="p-5 rounded-2xl bg-[#18181B] border-2 border-cyan-400/45 md:col-span-2 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-cyan-400 text-zinc-950 font-label-sm text-[11.5px] font-extrabold">
                  6번 [🎁 30일 무료체험 · 월 9,900원~] 업무 공유 • 공용 폴더(S: 드라이브) · 문서/계약서 공유
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
                      5인 이하 사무실 · S: 드라이브 + 문서/계약서 1초 본문 검색 + 다중 백업 PC 미러링
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
                      (연간 결제 시 190,000원 · 월 15,830원꼴)
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
                      (연간 결제 시 290,000원 · 월 24,160원꼴)
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

const DOC_SNIPPET_STOP_WORDS = new Set([
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
  '통합',
  '로컬',
]);

function escapeRegExpChars(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractDocHighlightTokens(query: string, fallbackKeywords: string[] = []): string[] {
  const rawQ = (query || '').trim();
  const rawWords = rawQ
    .replace(/[.,!?'"“”‘’()[\]{}]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1 && !DOC_SNIPPET_STOP_WORDS.has(t));
  const isSingleWord = rawWords.length === 1;

  const out: string[] = [];
  for (const w of rawWords) {
    const stem = stripKoSearchParticle(w, isSingleWord);
    if (stem && !DOC_SNIPPET_STOP_WORDS.has(stem) && (stem.length >= 2 || isSingleWord)) {
      out.push(stem);
      // '비타민D'처럼 한글+영문/숫자 결합어는 본문 '비타민 D' 띄어쓰기에도 매칭되도록 한글 어근도 보조 등록
      const koPart = stem.match(/^[가-힣]{2,}(?=[a-zA-Z0-9]+)/)?.[0];
      if (koPart && koPart.length >= 2) {
        out.push(koPart);
      }
    }
  }

  for (const fk of fallbackKeywords) {
    const cleanFk = (fk || '').trim();
    if (cleanFk.length >= 2 && !DOC_SNIPPET_STOP_WORDS.has(cleanFk)) {
      out.push(cleanFk);
    }
  }

  return Array.from(new Set(out));
}

function findBestKeywordMatchRange(
  cleanText: string,
  tokens: string[]
): { startIdx: number; endIdx: number } | null {
  if (!cleanText || tokens.length === 0) return null;
  const lowClean = cleanText.toLowerCase();

  // 1순위: 공백 없는 정확 부분일치 (가장 긴 토큰 우선)
  const sorted = [...tokens].sort((a, b) => b.length - a.length);
  for (const tk of sorted) {
    const idx = lowClean.indexOf(tk.toLowerCase());
    if (idx >= 0) {
      return { startIdx: idx, endIdx: idx + tk.length };
    }
  }

  // 2순위: PDF/DOCX 추출 시 글자 사이 공백('비 타민' 등)이 끼어 있는 경우 공백 허용 탐색
  for (const tk of sorted) {
    if (tk.length < 2) continue;
    const spacedPattern = Array.from(tk)
      .map((ch) => escapeRegExpChars(ch))
      .join('\\s*');
    const m = new RegExp(spacedPattern, 'i').exec(cleanText);
    if (m && m.index >= 0) {
      return { startIdx: m.index, endIdx: m.index + m[0].length };
    }
  }

  return null;
}

export function resolveDocExtBadge(doc: { fileName?: string; ext?: string }): string {
  const fname = (doc.fileName || '').trim();
  const dot = fname.lastIndexOf('.');
  if (dot > 0 && dot < fname.length - 1) {
    return fname.slice(dot + 1).toUpperCase();
  }
  return (doc.ext || 'DOC').toUpperCase();
}

export function formatVideoCardOcrSummary(
  ocrLines?: Array<{ text: string }>
): string {
  if (!Array.isArray(ocrLines) || ocrLines.length === 0) return '';
  const cleaned = ocrLines
    .map((l) => (l?.text || '').trim())
    .filter(Boolean);
  if (cleaned.length === 0) return '';
  // 카드 2줄 요약에서는 키보드 F11·F12 같은 영문 키캡보다 실제 한글 문장([가-힣]{2,})이 포함된 구간을 앞에 배치
  const koFirst = [
    ...cleaned.filter((t) => /[가-힣]{2,}/.test(t)),
    ...cleaned.filter((t) => !/[가-힣]{2,}/.test(t)),
  ];
  return koFirst.join(' · ');
}

export function buildDocPreviewSnippet(
  text: string,
  query: string,
  maxLen = 180,
  fallbackKeywords: string[] = []
): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';

  const tokens = extractDocHighlightTokens(query, fallbackKeywords);
  const hitRange = findBestKeywordMatchRange(clean, tokens);

  if (hitRange && hitRange.startIdx > 16) {
    // 좁은 3열 카드(줄당 약 18~20자)에서도 검색어 노란 하이라이트가 항상 1번째 줄(또는 2번째 줄 앞머리)에
    // 잘림 없이 바로 보이도록 앞문맥을 14자 내외로 유지하고 어절 경계에 맞춥니다.
    let start = Math.max(0, hitRange.startIdx - 14);
    if (start > 0) {
      const nextSpace = clean.indexOf(' ', start);
      if (nextSpace > start && nextSpace <= hitRange.startIdx - 4) {
        start = nextSpace + 1;
      }
    }
    const end = Math.min(clean.length, Math.max(hitRange.endIdx + 60, start + maxLen));
    return `${start > 0 ? '…' : ''}${clean.slice(start, end).trim()}${end < clean.length ? '…' : ''}`;
  }

  return clean.length > maxLen ? `${clean.slice(0, maxLen).trim()}…` : clean;
}

export function renderHighlightedDocText(
  text: string,
  query: string,
  fallbackKeywords: string[] = []
): React.ReactNode {
  if (!text) return text;
  const activeTokens = extractDocHighlightTokens(query, fallbackKeywords);
  if (activeTokens.length === 0) return text;

  const patterns = Array.from(new Set(activeTokens))
    .sort((a, b) => b.length - a.length)
    .map((t) =>
      t.length >= 2
        ? Array.from(t)
            .map((ch) => escapeRegExpChars(ch))
            .join('\\s*')
        : escapeRegExpChars(t)
    );
  if (patterns.length === 0) return text;

  const captureRx = new RegExp(`(${patterns.join('|')})`, 'gi');
  const exactCheckRx = new RegExp(`^(?:${patterns.join('|')})$`, 'i');
  const parts = text.split(captureRx);

  return parts.map((part, idx) =>
    part && exactCheckRx.test(part) ? (
      <mark
        key={idx}
        className="bg-amber-300 text-zinc-950 font-extrabold px-1 py-0 rounded"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    )
  );
}

/**
 * [멀린님 확정 정책 — 내 PC 로컬 문서·사진·여권 원본 즉시 표시 (마스킹 미적용)]:
 * - 내 PC 안의 내 파일(계좌번호·주민등록번호·비밀번호 등)을 본인이 빠르게 확인·복사하기 위해 검색하는 것이므로,
 *   화면과 미리보기에서 별표(••••) 마스킹으로 가리지 않고 원본 그대로 즉시 표시합니다.
 */
export function maskSensitiveDocText(text: string, _forVoice = false): string {
  return text || '';
}

export function hasSensitiveDocInfo(_text: string): boolean {
  return false;
}

import { formatQuickKoreanLabelCore } from '../services/ai/aiSharedRuntime';

export function formatQuickKoreanLabelForFile(
  fileName: string,
  dateStr?: string,
  tagsOrTitle?: string | string[]
): string {
  return formatQuickKoreanLabelCore(fileName, dateStr, tagsOrTitle);
}

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
  const [, setVoiceTick] = useState(0);

  useEffect(() => {
    return subscribeGhostiVoicePrefs(() => {
      setVoiceTick((t) => t + 1);
    });
  }, []);

  if (!selectedDocModal) return null;

  const effectiveQuery = hasExecutedUserSearch ? activeQuery : '';
  const isSpeakingNow = getIsTtsSpeaking();
  const fallbackDocVoiceText = `${selectedDocModal.title}. ${selectedDocModal.extractedText}`;

  const handleCloseModal = () => {
    stopSetupMonsterTts();
    setSelectedDocModal(null);
  };

  const handleToggleModalVoice = async () => {
    if (getIsTtsSpeaking()) {
      stopSetupMonsterTts();
      useSaySeeStore.setState({
        lastQuarantineToast: '🔇 음성 안내를 중단했습니다. (다시 클릭하시면 음성이 다시 재생됩니다)',
      });
    } else {
      await replayLastSetupMonsterTts(fallbackDocVoiceText);
      const actorName = getPreferredVoiceGender() === 'female' ? '여성 성우(선희)' : '남성 성우(현수)';
      useSaySeeStore.setState({
        lastQuarantineToast: `🔊 [${actorName}] 문서 음성 안내를 다시 재생합니다.`,
      });
    }
  };

  return (
    <div
      onClick={handleCloseModal}
      className="fixed inset-0 z-[105] bg-black/80 backdrop-blur-xl flex items-center justify-center px-3 sm:px-4 pt-safe pb-safe"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-full sm:max-h-[88dvh] overflow-hidden rounded-3xl bg-surface-container-low border border-primary-container/50 p-4 sm:p-6 md:p-7 shadow-2xl flex flex-col gap-3 sm:gap-4"
      >
        <div className="flex items-start justify-between gap-3 shrink-0 pb-2 border-b border-outline-variant/20">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-md bg-primary-container text-on-primary-container font-label-mono text-[10.5px] font-black">
                {resolveDocExtBadge(selectedDocModal)} 문서 자산
              </span>
              <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-primary font-label-sm text-[10.5px] font-bold">
                {selectedDocModal.categoryBadge}
              </span>
              <span className="font-label-mono text-[10.5px] text-on-surface-variant">
                • {selectedDocModal.deviceSource}
              </span>
            </div>
            <h3 className="font-headline-sm text-[16.5px] sm:text-[19px] text-on-surface font-extrabold mt-0.5 break-words">
              {renderHighlightedDocText(
                selectedDocModal.title,
                effectiveQuery,
                selectedDocModal.keywords.slice(0, 3)
              )}
            </h3>
            <p className="font-label-mono text-[11px] text-on-surface-variant truncate">
              파일명: {selectedDocModal.fileName} • 날짜: {selectedDocModal.date} • 크기:{' '}
              {(selectedDocModal.sizeKB / 1024).toFixed(2)} MB
            </p>
          </div>

          <button
            type="button"
            onClick={handleCloseModal}
            aria-label="닫기"
            className="w-10 h-10 rounded-full bg-surface-container-highest hover:bg-surface-bright border border-outline-variant/40 flex items-center justify-center text-on-surface shrink-0 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pr-0.5">
          {selectedDocModal.matchType === 'SIMILAR' && (
            <div className="px-3.5 py-2.5 rounded-2xl bg-amber-500/15 border border-amber-400/50 text-amber-200 font-label-md text-[12.5px] sm:text-[13px] font-extrabold flex items-center gap-2 shrink-0">
              <span>
                {selectedDocModal.similarityNoticeKo ||
                  '💡 검색어와 100% 일치하는 문서가 없어 유사한 문서를 찾았습니다!'}
              </span>
            </div>
          )}

          <div className="p-3.5 sm:p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-label-mono text-[11px] text-primary-container font-bold">
                🔍 로컬 문서 본문 미리보기 (검색어 노란색 하이라이트 • 1초 복사 지원)
              </span>
            </div>
            <p className="font-body-md text-[13.5px] sm:text-[14px] text-on-surface leading-relaxed whitespace-pre-wrap break-words">
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
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-outline-variant/20 shrink-0 bg-surface-container-low">
          {isMobileVoiceEnvironment() && (
            <div className="flex flex-wrap items-center gap-1.5">
              <VoiceActorControlPill fallbackReplayText={fallbackDocVoiceText} compact />
              <button
                type="button"
                onClick={() => void handleToggleModalVoice()}
                className={`px-3 py-2 rounded-xl font-label-md text-[12px] font-extrabold flex items-center gap-1 cursor-pointer transition-all ${
                  isSpeakingNow
                    ? 'bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/50 text-rose-200'
                    : 'bg-teal-500/20 hover:bg-teal-500/35 border border-teal-400/50 text-teal-200'
                }`}
              >
                <span>{isSpeakingNow ? '🔇 음성 중단' : '🔊 다시 듣기'}</span>
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
            {!/(비밀번호|패스워드|password|계정\s*정리|아이디.*비번|암호\s*목록)/i.test(
              selectedDocModal.title || ''
            ) ? (
              <button
                type="button"
                onClick={async () => {
                  const res = await triggerUserFavoriteAiLiveVoiceBatonTouch({
                    docTitle: selectedDocModal.title,
                    docText: selectedDocModal.extractedText,
                    userQuestion:
                      activeQuery && hasExecutedUserSearch
                        ? activeQuery
                        : '이 문서에서 나에게 불리한 독소조항이나 핵심 주의사항을 쉽게 설명해 줘.',
                  });
                  useSaySeeStore.setState({
                    lastQuarantineToast: `🤝 [${res.detectedAiLabel} 바톤터치] ${res.ttsBriefingKo}`,
                  });
                }}
                className="px-3 py-2 rounded-xl bg-fuchsia-600 text-white font-label-md text-[12px] font-black flex items-center gap-1 shadow-md hover:bg-fuchsia-500 transition-colors cursor-pointer"
              >
                <span>🤝 AI 상담</span>
              </button>
            ) : (
              <span className="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-emerald-500/40 text-emerald-300 font-label-sm text-[11px] font-bold">
                🔒 민감 계정 외부 전송 차단됨
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(selectedDocModal.extractedText);
                useSaySeeStore.setState({
                  lastQuarantineToast: `📋 복사 완료! [${selectedDocModal.title}] 본문 내용이 클립보드에 즉시 복사되었습니다.`,
                });
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 text-zinc-950 font-label-md text-[12.5px] font-black flex items-center gap-1 shadow-md hover:bg-emerald-400 transition-colors cursor-pointer"
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
              className="hidden sm:flex px-3.5 py-2 rounded-xl bg-amber-500 text-zinc-950 font-label-md text-[12.5px] font-black items-center gap-1 shadow-md hover:bg-amber-400 transition-colors cursor-pointer"
            >
              <span>🔍 파일 띄우기</span>
            </button>
            <button
              type="button"
              onClick={() => void openLocalFolder('docs')}
              className="hidden sm:flex px-3.5 py-2 rounded-xl bg-primary-container text-on-primary-container font-label-md text-[12.5px] font-extrabold items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">folder_open</span>
              <span>서류함 폴더</span>
            </button>
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 rounded-xl bg-surface-container-high text-on-surface font-label-md text-[12.5px] font-extrabold cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const VideoScenePreviewModal: React.FC = () => {
  const {
    selectedVideoModal,
    setSelectedVideoModal,
    videoSceneItems,
    matchedVideoScenes,
    syncRealVideoDuration,
    openLocalFolder,
    showToast,
    activeQuery,
    hasExecutedUserSearch,
  } = useSaySeeStore();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pendingSeekSecRef = useRef<number | null>(null);
  const pipeBaseSecRef = useRef<number>(0);
  const seekHudTimerRef = useRef<number>(0);
  const triedTranscodeFallbackRef = useRef<boolean>(false);
  const [resolvedVideoSrc, setResolvedVideoSrc] = useState<string>('');
  const [isResolvingVideo, setIsResolvingVideo] = useState<boolean>(false);
  const [videoPlaybackError, setVideoPlaybackError] = useState<boolean>(false);
  const [isPortraitVideo, setIsPortraitVideo] = useState<boolean>(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [seekHudText, setSeekHudText] = useState<string>('');
  const [isOcrExtracting, setIsOcrExtracting] = useState<boolean>(false);
  const [ocrLines, setOcrLines] = useState<VideoOcrLineItem[]>([]);
  const [ocrFullText, setOcrFullText] = useState<string>('');
  const [ocrCopied, setOcrCopied] = useState<boolean>(false);

  const videoNavList = React.useMemo(() => {
    if (!selectedVideoModal) return [];
    if (
      matchedVideoScenes.length > 0 &&
      matchedVideoScenes.some((v) => v.id === selectedVideoModal.id)
    ) {
      return matchedVideoScenes;
    }
    if (
      videoSceneItems.length > 0 &&
      videoSceneItems.some((v) => v.id === selectedVideoModal.id)
    ) {
      return videoSceneItems;
    }
    return [selectedVideoModal];
  }, [selectedVideoModal, matchedVideoScenes, videoSceneItems]);

  const currentVideoIdx = React.useMemo(() => {
    if (!selectedVideoModal || videoNavList.length === 0) return -1;
    return videoNavList.findIndex((v) => v.id === selectedVideoModal.id);
  }, [selectedVideoModal, videoNavList]);

  const navigateAdjacentVideo = React.useCallback(
    (delta: -1 | 1) => {
      if (videoNavList.length < 2 || currentVideoIdx < 0) return;
      const nextIdx = (currentVideoIdx + delta + videoNavList.length) % videoNavList.length;
      const nextVid = videoNavList[nextIdx];
      if (!nextVid) return;
      setSelectedVideoModal(
        nextVid,
        hasExecutedUserSearch && activeQuery ? nextVid.matchedSeekSec : undefined
      );
    },
    [videoNavList, currentVideoIdx, setSelectedVideoModal, hasExecutedUserSearch, activeQuery]
  );

  const buildInstantPreindexedOcr = (
    targetVid: NonNullable<typeof selectedVideoModal>
  ): { lines: VideoOcrLineItem[]; fullText: string } => {
    const formatTs = (sec: number) => {
      const s = Math.max(0, Math.floor(sec || 0));
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      return `${mm}:${ss}`;
    };

    if (Array.isArray(targetVid.ocrLines) && targetVid.ocrLines.length > 0) {
      const lines = targetVid.ocrLines;
      const fullText =
        targetVid.ocrFullText ||
        lines.map((l) => `[${l.timestamp}] ${l.text}`).join('\n');
      return { lines, fullText };
    }

    const lines: VideoOcrLineItem[] = [];
    const seen = new Set<string>();
    if (targetVid.ocrFullText) {
      for (const rawLine of targetVid.ocrFullText.split('\n')) {
        const trimmed = rawLine.trim();
        if (!trimmed || seen.has(trimmed)) continue;
        seen.add(trimmed);
        const m = trimmed.match(/^\[(\d{2}):(\d{2})\]\s*(.+)$/);
        if (m) {
          const sec = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
          lines.push({ timeSec: sec, timestamp: `${m[1]}:${m[2]}`, text: m[3] });
        } else {
          lines.push({ timeSec: 0, timestamp: '00:00', text: trimmed });
        }
      }
    }

    const isMobileNativeItem = String(targetVid.id || '').startsWith('mobile_vid_');
    if (!isMobileNativeItem && lines.length === 0 && Array.isArray(targetVid.timelineFrames)) {
      for (const f of targetVid.timelineFrames) {
        const cap = String(f.sceneCaption || '').trim();
        if (
          !cap ||
          /\s장면\s*\(\d{2}:\d{2}\)$/.test(cap) ||
          /시작\s*장면$/.test(cap) ||
          /구간\s*\(\d{2}:\d{2}\s*\/\s*총\s*\d{2}:\d{2}\)$/.test(cap) ||
          seen.has(cap)
        ) {
          continue;
        }
        seen.add(cap);
        lines.push({
          timeSec: f.timeSec || 0,
          timestamp: f.timestampText || formatTs(f.timeSec || 0),
          text: cap,
        });
      }
    }

    const fullText = lines.map((l) => `[${l.timestamp}] ${l.text}`).join('\n');
    return { lines, fullText };
  };

  useEffect(() => {
    if (!selectedVideoModal) return;
    setVideoPlaybackActive(true);
    return () => {
      setVideoPlaybackActive(false);
    };
  }, [Boolean(selectedVideoModal)]);

  useEffect(() => {
    if (!selectedVideoModal) {
      setResolvedVideoSrc('');
      setIsResolvingVideo(false);
      setVideoPlaybackError(false);
      setIsPortraitVideo(false);
      setIsVideoPlaying(false);
      setSeekHudText('');
      setIsOcrExtracting(false);
      setOcrLines([]);
      setOcrFullText('');
      setOcrCopied(false);
      pipeBaseSecRef.current = 0;
      triedTranscodeFallbackRef.current = false;
      return;
    }
    const resMatch = String(selectedVideoModal.resolution || '').match(/(\d+)\s*[xX×]\s*(\d+)/);
    setIsPortraitVideo(Boolean(resMatch && Number(resMatch[2]) > Number(resMatch[1])));
    setIsVideoPlaying(false);
    setSeekHudText('');
    setOcrCopied(false);

    // 1) 클릭 즉시 0.00초 무로딩으로 기인덱싱된 OCR 텍스트를 하단에 바로 표시
    const instant = buildInstantPreindexedOcr(selectedVideoModal);
    setOcrLines(instant.lines);
    setOcrFullText(instant.fullText);

    // 2) 이미 OCR이 있거나 글자 없음(hasScreenOcrText === false)으로 판정된 영상은 중복 호출을 생략하고,
    //    미인덱싱 영상만 첫 프레임 재생(700ms) 이후 백그라운드에서 조용히 보강하여 초기 재생 버퍼링 경합을 0%로 차단!
    let ocrCancelled = false;
    let ocrDeferTimer = 0;
    const needsBgOcr =
      instant.lines.length === 0 && selectedVideoModal.hasScreenOcrText !== false;
    setIsOcrExtracting(needsBgOcr);
    if (needsBgOcr) {
      ocrDeferTimer = window.setTimeout(() => {
        void (async () => {
          try {
            const res = await extractVideoScreenTextOnDemand(selectedVideoModal);
            if (ocrCancelled) return;
            if (res.ocrLines && res.ocrLines.length > 0) {
              setOcrLines(res.ocrLines);
              setOcrFullText(res.fullText || '');
              const extraTokens = String(res.fullText || '')
                .replace(/\[\d{2}:\d{2}\]/g, ' ')
                .split(/\s+/)
                .map((t) => t.trim())
                .filter((t) => t.length >= 2)
                .slice(0, 40);
              useSaySeeStore.setState((st) => ({
                videoSceneItems: st.videoSceneItems.map((v) =>
                  v.id === selectedVideoModal.id
                    ? {
                        ...v,
                        hasScreenOcrText: true,
                        ocrLineCount: res.ocrLines.length,
                        ocrLines: res.ocrLines,
                        ocrFullText: res.fullText,
                        keywords: Array.from(new Set([...(v.keywords || []), ...extraTokens])),
                      }
                    : v
                ),
                matchedVideoScenes: st.matchedVideoScenes.map((v) =>
                  v.id === selectedVideoModal.id
                    ? {
                        ...v,
                        hasScreenOcrText: true,
                        ocrLineCount: res.ocrLines.length,
                        ocrLines: res.ocrLines,
                        ocrFullText: res.fullText,
                        keywords: Array.from(new Set([...(v.keywords || []), ...extraTokens])),
                      }
                    : v
                ),
              }));
              if (String(selectedVideoModal.id || '').startsWith('mobile_vid_')) {
                const stAfter = useSaySeeStore.getState();
                void saveCachedMobileGalleryIndex(stAfter.photos, stAfter.videoSceneItems);
              }
            }
          } catch {
            /* ignore background OCR hydrate error */
          } finally {
            if (!ocrCancelled) {
              setIsOcrExtracting(false);
            }
          }
        })();
      }, 700);
    }

    const rawUrl = selectedVideoModal.videoUrl || '';
    const baseStreamUrl = rawUrl.replace(/[&?]t=[^&]*/g, '');
    const targetSec = selectedVideoModal.matchedSeekSec ?? 0;
    const seekTarget = hasExecutedUserSearch && activeQuery ? targetSec : 0;
    setVideoPlaybackError(false);
    triedTranscodeFallbackRef.current = false;
    pipeBaseSecRef.current = 0;
    pendingSeekSecRef.current = seekTarget;

    // [근본 해결]: 전체 파일(최대 55MB)을 fetch().blob()으로 끝까지 다 받을 때까지 <video> 마운트를 막던 병목을 전면 제거하고,
    // PC 로컬 영상(127.0.0.1:5199 HTTP 206 Range 스트림)은 0.00초 즉시 <video src>에 직결하여 첫 프레임을 바로 재생합니다!
    if (String(selectedVideoModal.id || '').startsWith('mobile_vid_') && !baseStreamUrl.startsWith('blob:')) {
      setResolvedVideoSrc('');
      setIsResolvingVideo(true);
      void resolveNativeMobileVideoPlaybackUrl(selectedVideoModal.id, {
        sizeMB: selectedVideoModal.sizeMB,
      })
        .then((nativeUrl) => {
          if (ocrCancelled) return;
          setIsResolvingVideo(false);
          if (!nativeUrl) {
            setVideoPlaybackError(true);
            return;
          }
          setResolvedVideoSrc(nativeUrl);
        })
        .catch(() => {
          if (!ocrCancelled) {
            setIsResolvingVideo(false);
            setVideoPlaybackError(true);
          }
        });
    } else {
      setIsResolvingVideo(false);
      setResolvedVideoSrc(baseStreamUrl);
    }

    return () => {
      ocrCancelled = true;
      window.clearTimeout(ocrDeferTimer);
    };
  }, [selectedVideoModal?.id, selectedVideoModal?.videoUrl, selectedVideoModal?.matchedSeekSec, hasExecutedUserSearch, activeQuery]);

  const seekVideoBySeconds = React.useCallback(
    (deltaSec: number) => {
      const el = videoRef.current;
      if (!el || !selectedVideoModal) return;
      const fmtSec = (secVal: number) => {
        const s = Math.max(0, Math.floor(secVal || 0));
        const mm = String(Math.floor(s / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        return `${mm}:${ss}`;
      };
      const showHud = (msg: string) => {
        setSeekHudText(msg);
        window.clearTimeout(seekHudTimerRef.current);
        seekHudTimerRef.current = window.setTimeout(() => setSeekHudText(''), 950);
      };

      if (Number.isFinite(el.duration) && el.duration > 0) {
        const nextT = Math.max(0, Math.min(Math.max(0, el.duration - 0.1), (el.currentTime || 0) + deltaSec));
        el.currentTime = nextT;
        showHud(`${deltaSec < 0 ? `⏪ ${Math.abs(deltaSec)}초 뒤로` : `⏩ ${deltaSec}초 앞으로`} · ${fmtSec(nextT)}`);
        return;
      }

      // 미캐싱 대용량 HEVC 실시간 파이프 스트림(duration === Infinity)에서도 서버 -ss 재시크 지원
      const rawUrl = resolvedVideoSrc || el.currentSrc || selectedVideoModal.videoUrl || '';
      const baseStreamUrl = rawUrl.replace(/[&?]t=[^&]*/g, '');
      if (baseStreamUrl.includes('/__videos/stream')) {
        const maxDur = Math.max(1, selectedVideoModal.durationSec || 3600);
        const curLogical = pipeBaseSecRef.current + (el.currentTime || 0);
        const nextLogical = Math.max(0, Math.min(maxDur - 0.5, curLogical + deltaSec));
        pipeBaseSecRef.current = nextLogical;
        const sep = baseStreamUrl.includes('?') ? '&' : '?';
        setResolvedVideoSrc(`${baseStreamUrl}${sep}t=${nextLogical.toFixed(1)}`);
        showHud(`${deltaSec < 0 ? `⏪ ${Math.abs(deltaSec)}초 뒤로` : `⏩ ${deltaSec}초 앞으로`} · ${fmtSec(nextLogical)}`);
      }
    },
    [selectedVideoModal, resolvedVideoSrc]
  );

  useEffect(() => {
    if (!selectedVideoModal) return;
    const releaseFullscreenControlFocus = () => {
      const el = videoRef.current;
      if (!el || typeof document === 'undefined') return;
      if (document.fullscreenElement === el || document.activeElement === el) {
        el.blur();
        window.setTimeout(() => {
          if (videoRef.current && document.activeElement === videoRef.current) {
            videoRef.current.blur();
          }
        }, 30);
      }
    };
    document.addEventListener('fullscreenchange', releaseFullscreenControlFocus);
    document.addEventListener('webkitfullscreenchange', releaseFullscreenControlFocus as EventListener);
    const onKeyDown = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      const tag = tgt?.tagName?.toLowerCase() || '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || tgt?.isContentEditable) {
        return;
      }
      if (e.key === 'Escape') {
        if (typeof document !== 'undefined' && document.fullscreenElement) {
          return;
        }
        e.preventDefault();
        setSelectedVideoModal(null);
        return;
      }
      if (e.key === 'ArrowLeft' && !e.altKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          navigateAdjacentVideo(-1);
        } else {
          seekVideoBySeconds(-5);
        }
        return;
      }
      if (e.key === 'ArrowRight' && !e.altKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          navigateAdjacentVideo(1);
        } else {
          seekVideoBySeconds(5);
        }
        return;
      }
      if (e.key === ' ' && tag !== 'button' && tag !== 'a') {
        const el = videoRef.current;
        if (el) {
          e.preventDefault();
          e.stopPropagation();
          if (el.paused) {
            void el.play().catch(() => {});
          } else {
            el.pause();
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      document.removeEventListener('fullscreenchange', releaseFullscreenControlFocus);
      document.removeEventListener('webkitfullscreenchange', releaseFullscreenControlFocus as EventListener);
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.clearTimeout(seekHudTimerRef.current);
    };
  }, [selectedVideoModal, seekVideoBySeconds, navigateAdjacentVideo, setSelectedVideoModal]);

  if (!selectedVideoModal) return null;

  const effectiveQuery = hasExecutedUserSearch ? activeQuery : '';
  const isWholeClipMatch = (selectedVideoModal.matchedSeekSec ?? 0) <= 0;
  const cleanTs = cleanVideoTimestampLabel(selectedVideoModal.matchedTimestamp);
  const currentFrameObj =
    selectedVideoModal.timelineFrames.find((f) => f.timeSec === selectedVideoModal.matchedSeekSec) ||
    selectedVideoModal.timelineFrames[0];
  const currentFrameThumbUrl =
    currentFrameObj?.thumbUrl || resolveVideoCardThumbUrl(selectedVideoModal);

  const trySwitchToTranscodeStream = (): boolean => {
    if (triedTranscodeFallbackRef.current) return false;
    const modalId = String(selectedVideoModal.id || '');
    if (modalId.startsWith('mobile_vid_')) {
      triedTranscodeFallbackRef.current = true;
      const seekTarget = hasExecutedUserSearch && activeQuery ? (selectedVideoModal.matchedSeekSec ?? 0) : 0;
      pendingSeekSecRef.current = seekTarget;
      setVideoPlaybackError(false);
      setIsResolvingVideo(true);
      setResolvedVideoSrc('');
      void resolveNativeMobileVideoPlaybackUrl(modalId, {
        forceTranscode: true,
        sizeMB: selectedVideoModal.sizeMB,
      })
        .then((h264Url) => {
          setIsResolvingVideo(false);
          if (h264Url) {
            setResolvedVideoSrc(h264Url);
          } else {
            setVideoPlaybackError(true);
          }
        })
        .catch(() => {
          setIsResolvingVideo(false);
          setVideoPlaybackError(true);
        });
      return true;
    }
    const rawUrl = selectedVideoModal.videoUrl || '';
    if (!rawUrl.includes('127.0.0.1:5199') || !selectedVideoModal.videoFileName) return false;
    triedTranscodeFallbackRef.current = true;
    const seekTarget = hasExecutedUserSearch && activeQuery ? (selectedVideoModal.matchedSeekSec ?? 0) : 0;
    pendingSeekSecRef.current = seekTarget;
    setVideoPlaybackError(false);
    setResolvedVideoSrc(
      `http://127.0.0.1:5199/__videos/stream?p=${encodeURIComponent(selectedVideoModal.videoFileName)}`
    );
    return true;
  };

  const applyPendingSeekOnce = (vidEl: HTMLVideoElement) => {
    const targetSec = pendingSeekSecRef.current;
    pendingSeekSecRef.current = null;
    try {
      // 전체 길이가 유한(Number.isFinite)한 일반/Faststart 캐시 영상일 때만 클라이언트 탐색 수행
      // (장편 실시간 파이프 스트림은 vidEl.duration === Infinity이며 서버가 이미 -ss 지점부터 송출함)
      if (
        targetSec !== null &&
        targetSec > 0 &&
        Number.isFinite(vidEl.duration) &&
        vidEl.duration > 1 &&
        Math.abs(vidEl.currentTime - targetSec) > 0.4
      ) {
        vidEl.currentTime = Math.min(targetSec, Math.max(0, vidEl.duration - 0.5));
      }
      void vidEl.play().catch(() => {});
    } catch {
      // ignore
    }
  };

  return (
    <div
      onClick={() => setSelectedVideoModal(null)}
      className="fixed inset-0 z-[105] bg-black/85 backdrop-blur-xl flex items-center justify-center px-3 sm:px-4 pt-safe pb-safe"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-full sm:max-h-[90dvh] overflow-hidden rounded-3xl bg-surface-container-low border-2 border-primary-container/60 p-3.5 sm:p-5 md:p-6 shadow-[0_0_64px_rgba(0,229,255,0.25)] flex flex-col gap-3"
      >
        <div className="flex items-start justify-between gap-2.5 shrink-0 pb-2 border-b border-outline-variant/20">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {hasExecutedUserSearch && activeQuery && (
                <span className="px-2 py-0.5 rounded-md bg-primary-container text-on-primary-container font-label-mono text-[10.5px] font-black">
                  {isWholeClipMatch ? '🎯 전 구간 일치 (00:00~)' : `🎯 ${cleanTs} 장면 포착`}
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-label-mono text-[10.5px] font-bold">
                전체 길이 {selectedVideoModal.durationText}
              </span>
              {videoNavList.length >= 2 && currentVideoIdx >= 0 && (
                <span
                  data-keep-dark="true"
                  style={{ backgroundColor: '#1E293B', color: '#FFFFFF', borderColor: '#475569' }}
                  className="px-2.5 py-0.5 rounded-full font-label-mono text-[11px] font-extrabold border shadow-2xs"
                >
                  {currentVideoIdx + 1} / {videoNavList.length}
                </span>
              )}
              <span className="font-label-mono text-[10.5px] text-on-surface-variant truncate">
                • 📍 {selectedVideoModal.locationKo}
              </span>
            </div>
            <h3 className="font-headline-sm text-[16px] sm:text-[19px] text-white font-extrabold mt-0.5 leading-snug line-clamp-2">
              {renderHighlightedDocText(
                selectedVideoModal.title,
                effectiveQuery,
                selectedVideoModal.keywords.slice(0, 4)
              )}
            </h3>
            <p className="font-label-mono text-[11px] text-on-surface-variant truncate">
              원본: {selectedVideoModal.videoFileName} • {selectedVideoModal.date} •{' '}
              {selectedVideoModal.sizeMB} MB
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSelectedVideoModal(null)}
            aria-label="닫기"
            className="w-10 h-10 rounded-full bg-surface-container-highest hover:bg-surface-bright border border-outline-variant/40 flex items-center justify-center text-on-surface shrink-0 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pr-0.5">
          <div
            data-keep-dark="true"
            className={`relative w-full shrink-0 rounded-2xl overflow-hidden bg-black border border-primary-container/40 flex items-center justify-center ${
              isPortraitVideo
                ? 'h-[44dvh] min-h-[260px] max-h-[440px] sm:h-[50dvh]'
                : 'aspect-video min-h-[210px] sm:min-h-[340px]'
            }`}
          >
            {resolvedVideoSrc && !videoPlaybackError ? (
              <>
                <video
                  ref={videoRef}
                  src={resolvedVideoSrc}
                  poster={currentFrameThumbUrl}
                  controls
                  playsInline
                  autoPlay
                  preload="auto"
                  onPlay={(e) => {
                    setIsVideoPlaying(true);
                    if (typeof document !== 'undefined' && document.fullscreenElement === e.currentTarget) {
                      e.currentTarget.blur();
                    }
                  }}
                  onPause={(e) => {
                    setIsVideoPlaying(false);
                    if (typeof document !== 'undefined' && document.fullscreenElement === e.currentTarget) {
                      e.currentTarget.blur();
                    }
                  }}
                  onVolumeChange={(e) => {
                    if (typeof document !== 'undefined' && document.fullscreenElement === e.currentTarget) {
                      e.currentTarget.blur();
                    }
                  }}
                  onMouseUp={(e) => {
                    if (typeof document !== 'undefined' && document.fullscreenElement === e.currentTarget) {
                      const targetEl = e.currentTarget;
                      window.setTimeout(() => targetEl.blur(), 20);
                    }
                  }}
                  onEnded={() => setIsVideoPlaying(false)}
                  onError={() => {
                    if (!trySwitchToTranscodeStream()) {
                      setVideoPlaybackError(true);
                    }
                  }}
                  onLoadedMetadata={(e) => {
                    const el = e.currentTarget;
                    // Windows 브라우저에서 HEVC(hvc1) 코덱 미지원으로 소리만 나고 화면(videoWidth===0)이 멈추는 현상 즉시 자동 전환!
                    if (el.videoWidth === 0 && trySwitchToTranscodeStream()) {
                      return;
                    }
                    if (el.videoWidth > 0 && el.videoHeight > 0) {
                      setIsPortraitVideo(el.videoHeight > el.videoWidth);
                    }
                    const realDur = Math.floor(el.duration);
                    if (
                      realDur > 0 &&
                      Number.isFinite(realDur) &&
                      (!resolvedVideoSrc.includes('/__videos/stream') || !resolvedVideoSrc.includes('&t='))
                    ) {
                      syncRealVideoDuration(selectedVideoModal.id, realDur);
                    }
                    applyPendingSeekOnce(el);
                  }}
                  className="w-full h-full object-contain"
                />
                {!isVideoPlaying && (
                  <button
                    type="button"
                    aria-label="영상 재생"
                    onClick={() => {
                      if (videoRef.current) {
                        void videoRef.current.play().catch(() => {});
                      }
                    }}
                    className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/75 hover:bg-black/85 border-2 border-white/85 text-white flex items-center justify-center shadow-2xl cursor-pointer transition-transform active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[34px]">play_arrow</span>
                  </button>
                )}
                {seekHudText && (
                  <div
                    data-keep-dark="true"
                    style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.92)',
                      color: '#FFFFFF',
                      borderColor: 'rgba(255, 255, 255, 0.48)',
                    }}
                    className="absolute top-3 right-3 z-20 px-3.5 py-1 rounded-full border text-[12.5px] font-extrabold pointer-events-none shadow-xl"
                  >
                    {seekHudText}
                  </div>
                )}
              </>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center">
                {currentFrameThumbUrl ? (
                  <img
                    src={currentFrameThumbUrl}
                    alt={selectedVideoModal.title}
                    onLoad={(e) => {
                      const el = e.currentTarget;
                      if (el.naturalWidth > 0 && el.naturalHeight > 0) {
                        setIsPortraitVideo(el.naturalHeight > el.naturalWidth);
                      }
                    }}
                    className="w-full h-full object-contain"
                  />
                ) : null}
                <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center gap-2 px-4 text-center">
                  <span className="px-3.5 py-1.5 rounded-full bg-black/85 border border-white/25 text-white text-[12.5px] font-extrabold shadow-lg">
                    {videoPlaybackError
                      ? '⚠️ 이 영상 형식을 재생할 수 없습니다'
                      : isResolvingVideo
                      ? '🎬 스마트폰 원본 동영상을 불러오는 중...'
                      : '🎬 동영상을 불러오는 중...'}
                  </span>
                </div>
              </div>
            )}
            {videoNavList.length >= 2 && (
              <>
                <button
                  type="button"
                  aria-label="이전 동영상"
                  title="이전 동영상 (Shift + ←)"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateAdjacentVideo(-1);
                  }}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-900/40 hover:bg-zinc-800/80 border border-zinc-300/25 hover:border-zinc-200/55 text-zinc-300/75 hover:text-zinc-100 backdrop-blur-xs flex items-center justify-center transition-all cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[22px]">chevron_left</span>
                </button>
                <button
                  type="button"
                  aria-label="다음 동영상"
                  title="다음 동영상 (Shift + →)"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateAdjacentVideo(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-900/40 hover:bg-zinc-800/80 border border-zinc-300/25 hover:border-zinc-200/55 text-zinc-300/75 hover:text-zinc-100 backdrop-blur-xs flex items-center justify-center transition-all cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[22px]">chevron_right</span>
                </button>
              </>
            )}
            {hasExecutedUserSearch && activeQuery && !isVideoPlaying && (
              <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/80 border border-primary-container/65 text-primary-container font-label-mono text-[11px] font-black pointer-events-none shadow-md">
                {isWholeClipMatch ? '🎯 처음부터 바로 재생' : `🎯 ${cleanTs} 장면부터 재생`}
              </div>
            )}
          </div>

          {selectedVideoModal.fullPath ? (
            <p className="font-label-mono text-[11px] text-teal-400/90 break-all px-0.5">
              📁 실제 PC 위치: {selectedVideoModal.fullPath}
            </p>
          ) : !String(selectedVideoModal.id || '').startsWith('mobile_vid_') &&
            !String(selectedVideoModal.videoUrl || '').startsWith('blob:') &&
            !String(selectedVideoModal.videoUrl || '').includes('127.0.0.1:5199') ? (
            <p className="font-body-sm text-[11.5px] text-amber-400/90 px-0.5">
              ℹ️ 체험용 샘플 영상입니다 (PC 엔진 연결 또는 모바일 스토어 정식 앱 자동 인덱싱 후 내 실제 영상을 재생·추출할 수 있습니다)
            </p>
          ) : null}

          {hasExecutedUserSearch && activeQuery && (
            <div className="p-3 rounded-2xl bg-primary-container/10 border border-primary-container/45 flex flex-col gap-1 shrink-0">
              <span className="font-label-mono text-[11px] text-primary-container font-black">
                {isWholeClipMatch
                  ? '🎯 포착 구간 기준 (00:00 처음부터 · 전 구간 일치):'
                  : `🎯 찾으신 장면 (${cleanTs} 구간 포착):`}
              </span>
              <p className="font-body-md text-[13px] sm:text-[13.5px] text-white font-bold leading-relaxed">
                {renderHighlightedDocText(
                  selectedVideoModal.matchedFrameCaption,
                  effectiveQuery,
                  currentFrameObj?.keywords?.slice(0, 4) ?? []
                )}
              </p>
            </div>
          )}

          {ocrLines.length === 0 && isOcrExtracting && (
            <div className="px-3.5 py-2.5 rounded-2xl bg-zinc-950/90 border border-teal-400/35 text-teal-200 font-body-sm text-[12px] font-bold shrink-0">
              🔍 영상 화면 속 한글 문장을 읽고 있습니다...
            </div>
          )}

          {ocrLines.length === 0 && !isOcrExtracting && String(selectedVideoModal.id || '').startsWith('mobile_vid_') && (
            <div className="px-3.5 py-2.5 rounded-2xl bg-zinc-950/80 border border-white/15 text-zinc-400 font-body-sm text-[12px] shrink-0">
              ℹ️ 이 영상에서는 화면 속 글자가 감지되지 않았습니다.
            </div>
          )}

          {ocrLines.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-zinc-950/95 border border-teal-400/50 flex flex-col gap-2.5 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/40 text-teal-300 font-label-mono text-[11px] font-black">
                    📝 영상 속 추출된 글자 ({ocrLines.length}구간)
                  </span>
                  {ocrCopied && (
                    <span className="text-[12px] text-emerald-300 font-bold">
                      📋 클립보드 복사 완료!
                    </span>
                  )}
                </div>
                {ocrFullText && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard?.writeText(ocrFullText);
                          setOcrCopied(true);
                        } catch {
                          /* ignore */
                        }
                      }}
                      className="px-3 py-1 rounded-lg bg-teal-400 hover:bg-teal-300 text-zinc-950 font-label-sm text-[11.5px] font-black cursor-pointer"
                    >
                      {ocrCopied ? '✅ 전체 복사됨' : '📋 전체 텍스트 복사'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([ocrFullText], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${selectedVideoModal.title || 'video'}_화면글자추출.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-zinc-200 font-label-sm text-[11.5px] font-bold cursor-pointer"
                    >
                      💾 .txt 저장
                    </button>
                  </div>
                )}
              </div>

              <div
                data-keep-dark="true"
                className="max-h-48 overflow-y-auto rounded-xl bg-black/75 border border-white/15 p-2.5 flex flex-col gap-1.5"
              >
                {ocrLines.map((ln, idx) => (
                  <button
                    key={`${ln.timestamp}_${idx}`}
                    type="button"
                    onClick={() => {
                      if (videoRef.current && Number.isFinite(videoRef.current.duration)) {
                        videoRef.current.currentTime = Math.min(
                          ln.timeSec,
                          Math.max(0, videoRef.current.duration - 0.3)
                        );
                        void videoRef.current.play().catch(() => {});
                      }
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-start gap-2 transition cursor-pointer"
                  >
                    <span className="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 font-label-mono text-[11px] font-bold shrink-0">
                      ▶ {ln.timestamp}
                    </span>
                    <span className="text-[12.5px] text-zinc-100 font-medium leading-snug break-all">
                      {ln.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-outline-variant/20 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (selectedVideoModal.fullPath) {
                void openLocalFolder('videos', selectedVideoModal.fullPath);
                return;
              }
              if (!String(selectedVideoModal.videoUrl || '').includes('127.0.0.1:5199')) {
                showToast(
                  'ℹ️ 이 영상은 체험용 샘플이라 내 PC 폴더에는 저장되어 있지 않습니다. 내 PC 연결 시 실제 동영상 위치를 바로 열어드립니다.'
                );
                return;
              }
              void openLocalFolder('videos');
            }}
            title={selectedVideoModal.fullPath || '원본 동영상이 있는 내 PC 폴더를 엽니다'}
            className="hidden sm:flex px-4 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-label-md text-[13px] font-extrabold items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">folder_open</span>
            <span>원본 동영상 폴더 열기</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedVideoModal(null)}
            className="px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-label-md text-[12.5px] sm:text-[13px] font-bold cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
