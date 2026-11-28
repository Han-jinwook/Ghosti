import React from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';

export const MASTER_PASS_AUTO_SWITCH_TIERS = [
  {
    stage: 1,
    limitCount: 100,
    years: 1,
    months: 12,
    bannerHeadline: '연간 결제 시 2개월 할인 (10개월 요금으로 12개월 이용)',
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
      reason: '사진방 이름을 입력해 주세요 (예: 우리집, 산들산악회, 한빛고 32기).',
    };
  }
  if (/주식회사|\(주\)|법인|회사|본사|지사|사무실|영업팀|개발팀|연구소|세무|회계|법무|프로젝트팀|사업부/i.test(s)) {
    return {
      valid: false,
      blockedCategory: 'WORK',
      reason:
        '기업·부서 명칭은 무료 사진 공유방 이름으로 사용할 수 없습니다. 업무 문서 공유 및 S: 드라이브는 [업무 공유] 메뉴를 이용해 주세요.',
    };
  }
  return { valid: true };
}

export const FoundingMemberFomoBar: React.FC = () => {
  return null;
};

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
      className={`rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-3 ${
        compact ? 'p-3.5' : 'p-4 md:p-5'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[14px] text-slate-900 font-semibold">
          데스크톱(PC) 연결 안내
        </span>
        {merlinAuth.email && (
          <span className="text-[12px] text-slate-500">
            계정: <strong className="text-slate-800">{merlinAuth.email}</strong>
          </span>
        )}
      </div>

      <p className="text-[12.5px] text-slate-600 leading-relaxed">
        대용량 원본 사진 정리와 폴더 관리는 PC 환경에서 이용할 수 있습니다. PC에서 바로 열 수 있도록 연결 주소를 보내둘까요?
      </p>

      {enablePcGuideShareButton ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => void sharePcMasterUrlToKakao()}
            className="px-4 py-2.5 rounded-lg bg-[#FEE500] hover:bg-[#FDD800] text-[#191919] text-[12.5px] font-semibold flex items-center justify-center cursor-pointer transition-colors"
          >
            카카오톡(나에게)으로 보내기
          </button>

          <button
            type="button"
            onClick={() => void sendPcMasterUrlToEmail()}
            className="px-4 py-2.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-[12.5px] font-semibold flex items-center justify-center cursor-pointer transition-colors"
          >
            PC 연결 주소 복사
          </button>
        </div>
      ) : (
        <div className="p-3 rounded-lg bg-white border border-slate-200 text-slate-600 text-[12px]">
          PC에서 귀신같이 엔진을 실행한 뒤 같은 계정({merlinAuth.email || '로그인 계정'})으로 로그인하면 연결됩니다.
        </div>
      )}

      {enablePcGuideShareButton && lastSentPcLinkChannel && (
        <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-[12px]">
          {lastSentPcLinkChannel === 'kakao'
            ? '카카오톡으로 안내 링크가 준비되었습니다. PC에서 열어 이어서 진행하세요.'
            : 'PC 연결 주소가 복사되었습니다. PC 브라우저 주소창에 붙여넣어 주세요.'}
        </div>
      )}
    </div>
  );
};

export const MobileMasterPcIntroModal: React.FC = () => {
  const { showMobileMasterPcIntroModal, setShowMobileMasterPcIntroModal } = useSaySeeStore();

  if (!showMobileMasterPcIntroModal) return null;

  return (
    <div
      onClick={() => setShowMobileMasterPcIntroModal(false)}
      className="fixed inset-0 z-[108] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-xl flex flex-col gap-4 my-auto text-slate-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <span className="text-[12px] text-slate-500 font-medium">데스크톱 전용 설정</span>
            <h2 className="text-[18px] text-slate-900 font-bold tracking-tight mt-0.5">
              PC 환경에서 이어서 진행해 주세요
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setShowMobileMasterPcIntroModal(false)}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <p className="text-[13px] text-slate-600 leading-relaxed">
          현재 모바일 기기로 접속하셨습니다. 대용량 원본 폴더 연결과 공유방 기본 설정은 Windows PC에서 완료할 수 있으며, 연결 후 스마트폰에서 동일하게 검색하고 열람할 수 있습니다.
        </p>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowMobileMasterPcIntroModal(false)}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12.5px] font-semibold cursor-pointer"
          >
            모바일 화면으로 계속 보기
          </button>
        </div>
      </div>
    </div>
  );
};
