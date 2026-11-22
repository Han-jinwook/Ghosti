import React from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { LoungeModeSwitcherBar } from '../LoungeView';
import { GhostiBrandLogo } from '../GhostiBrandLogo';

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
    return {
      valid: false,
      reason: '가족·동호회·동창회 사진방 문패 이름을 입력해 주세요 (예: 우리집, 산들산악회, 한빛고 32기 동창회).',
    };
  }
  if (/주식회사|\(주\)|법인|회사|본사|지사|사무실|영업팀|개발팀|연구소|세무|회계|법무|프로젝트팀|사업부/i.test(s)) {
    return {
      valid: false,
      blockedCategory: 'WORK',
      reason:
        '🚫 [AI 문패 필터] 기업/부서/업무 명칭은 무료 사진 공유방 문패로 사용할 수 없습니다. 엑셀·한글·PDF·워드 업무 서류 검색 및 윈도우 탐색기 S: 드라이브는 [💼 6번 업무 공유 (월 9,900원~ · 30일 무료체험)]를 이용해 주세요.',
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
          <button
            type="button"
            onClick={() => void sharePcMasterUrlToKakao()}
            className="px-4 py-3 rounded-xl bg-[#FEE500] hover:bg-[#FDD800] text-[#191919] font-label-md text-[13px] font-black flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-[0.98]"
          >
            <span>💬 카톡(나에게)으로 ‘내 PC 연동 시작 가이드’ 보내두기</span>
          </button>

          <button
            type="button"
            onClick={() => void sendPcMasterUrlToEmail()}
            className="px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-primary-container/50 text-primary-container font-label-md text-[13px] font-black flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-[0.98]"
          >
            <span>📋 내 PC 연결 주소 복사 (PC 브라우저에 붙여넣기)</span>
          </button>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-zinc-900/90 border border-white/10 text-zinc-300 font-body-sm text-[12px]">
          💡 데스크톱(Windows / Mac) 환경에서 귀신같이(Ghosti) 마스터 엔진을 실행한 뒤 동일한 여권 계정({merlinAuth.email || '로그인 계정'})으로 로그인하시면 즉시 연동됩니다.
        </div>
      )}

      {enablePcGuideShareButton && lastSentPcLinkChannel && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 font-body-sm text-[12px] flex items-center justify-between gap-2">
          <span>
            {lastSentPcLinkChannel === 'kakao'
              ? '✓ 카톡(나에게)으로 ‘내 PC 연동 시작 가이드’가 준비되었습니다! 데스크톱(PC) 카카오톡에서 열어 작업을 바로 이어가세요.'
              : '✓ 내 PC 연결 주소가 클립보드에 복사되었습니다! PC 브라우저 주소창에 붙여넣고 같은 이메일로 로그인하세요.'}
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * [안전장치 2] 전송된 링크(/?master=pc)의 ‘모바일 vs PC’ 접속 환경 이중 방어 화면
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
