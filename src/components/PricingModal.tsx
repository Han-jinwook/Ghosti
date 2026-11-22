import React from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { PricingPlanId } from '../types/saysee';
import { GhostiBrandLogo } from './GhostiBrandLogo';
import { PcMasterQuickSendPanel } from './pricing/PricingAuxiliaryPanels';

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
  free_trial: '무료 기본 (귀신비서 · 귀신검색 · 사진 공유)',
  personal_single_2900: '무료 기본 (내 기기)',
  personal_sub_3900: '내 기기 통합 Pro (월 3,900원)',
  personal_year_35000: '내 기기 통합 Pro (연 39,000원)',
  personal_year_39000: '내 기기 통합 Pro (연 39,000원)',
  family_home_5900: '사진 공유 · 가족 (무료)',
  family_home_year_59000: '사진 공유 · 가족 (무료)',
  family_three_8900: '사진 공유 · 가족 (무료)',
  family_three_year_89000: '사진 공유 · 가족 (무료)',
  club_mini_free_300: '사진 공유 · 동호회 (무료)',
  club_mini_2900: '사진 공유 · 동호회 (무료)',
  club_small_4900: '사진 공유 · 동호회·동창회 (무료)',
  club_small_year_49000: '사진 공유 · 동호회·동창회 (무료)',
  club_medium_7900: '사진 공유 · 동호회·동창회 (무료)',
  club_medium_year_79000: '사진 공유 · 동호회·동창회 (무료)',
  club_large_14900: '사진 공유 · 동호회·동창회 (무료)',
  club_large_year_149000: '사진 공유 · 동호회·동창회 (무료)',
  student_sub_900: '사진 공유 · 동창회 (무료)',
  student_year_9000: '사진 공유 · 동창회 (무료)',
  work_soho_9900: '업무 공유 · 소호 ~5인 (월 9,900원)',
  work_soho_year_99000: '업무 공유 · 소호 ~5인 (연 99,000원)',
  work_biz_19000: '업무 공유 · 소기업 ~20인 (월 19,000원)',
  work_biz_year_190000: '업무 공유 · 소기업 ~20인 (연 190,000원)',
  work_biz_19900: '업무 공유 · 소기업 ~20인 (월 19,000원)',
  work_biz_year_199000: '업무 공유 · 소기업 ~20인 (연 190,000원)',
  work_pro_29000: '업무 공유 · 중소기업 ~50인 (월 29,000원)',
  work_pro_year_290000: '업무 공유 · 중소기업 ~50인 (연 290,000원)',
};

export const PricingModal: React.FC = () => {
  const {
    showProModal,
    setShowProModal,
    activePricingPlan,
    activatePricingPlan,
    setDesktopTab,
    isStoreAppMode,
    merlinAuth,
  } = useSaySeeStore();

  if (!showProModal) return null;

  if (isStoreAppMode) {
    return (
      <div
        onClick={() => setShowProModal(false)}
        className="fixed inset-0 z-[105] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 p-6 shadow-xl flex flex-col gap-4 my-auto text-slate-900"
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-[18px] text-slate-900 font-bold tracking-tight">
                데스크톱(PC) 연결 안내
              </h2>
              <p className="text-[12.5px] text-slate-500 mt-0.5">
                대용량 원본 사진 정리와 폴더 관리는 PC 환경에서 설정할 수 있습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowProModal(false)}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <PcMasterQuickSendPanel />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setShowProModal(false)}
      className="fixed inset-0 z-[105] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 pt-safe pb-safe overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-white border border-slate-200 p-5 sm:p-7 shadow-2xl flex flex-col gap-6 my-auto text-slate-900"
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <GhostiBrandLogo size="desktop" />
              <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11.5px] font-medium">
                현재 이용 중: {PLAN_LABELS[activePricingPlan]}
              </span>
              {activePricingPlan !== 'free_trial' && (
                <button
                  type="button"
                  onClick={() => {
                    activatePricingPlan('free_trial');
                    setDesktopTab('trial');
                  }}
                  className="text-[12px] text-slate-500 hover:text-slate-900 underline cursor-pointer"
                >
                  무료 기본 모드로 전환
                </button>
              )}
            </div>
            <h2 className="text-[20px] md:text-[22px] text-slate-900 font-bold tracking-tight mt-1">
              요금제 안내
            </h2>
            <p className="text-[13px] text-slate-500">
              내 기기 검색·정리와 사진 공유는 무료이며, 다중 기기 연동과 업무용 공용 드라이브(S:)는 30일 무료체험 후 선택할 수 있습니다.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowProModal(false)}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 1. 기본 무료 플랜 요약 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col justify-between gap-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[14.5px] font-bold text-slate-900">내 기기 (귀신비서 · 귀신검색)</span>
                <span className="text-[14px] font-bold text-slate-900">무료</span>
              </div>
              <ul className="text-[12.5px] text-slate-600 space-y-1.5 leading-relaxed pt-1">
                <li>• 문서 본문 · 사진 · 동영상 장면 내용 검색 (Ctrl+0)</li>
                <li>• PC 속도·용량 점검, 중복 사진 정리 및 복원 기록</li>
              </ul>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col justify-between gap-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[14.5px] font-bold text-slate-900">사진 공유 (가족 · 동호회 · 동창회)</span>
                <span className="text-[14px] font-bold text-slate-900">무료</span>
              </div>
              <p className="text-[12.5px] text-slate-600 leading-relaxed pt-1">
                인원·장수 제한 없이 원본 화질 그대로 앨범을 공유합니다. (개인 사진·영상 전용 / 업무 문서 공유는 업무 공유 플랜 전용)
              </p>
            </div>
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => activatePricingPlan('family_home_5900')}
                className="py-1.5 px-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer"
              >
                가족방
              </button>
              <button
                type="button"
                onClick={() => activatePricingPlan('club_small_4900')}
                className="py-1.5 px-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer"
              >
                동호회방
              </button>
              <button
                type="button"
                onClick={() => activatePricingPlan('student_sub_900')}
                className="py-1.5 px-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer"
              >
                동창회방
              </button>
            </div>
          </div>
        </div>

        {/* 2. 개인 유료 확장: 내 기기 통합 Pro */}
        <div className="p-5 rounded-xl bg-white border border-slate-300 flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[16.5px] text-slate-900 font-bold">내 기기 통합 Pro</h3>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium">
                  30일 무료체험
                </span>
              </div>
              <p className="text-[12.5px] text-slate-500 mt-0.5">
                내 스마트폰과 여러 대의 PC를 연결하고 고급 검색 도구를 제한 없이 사용합니다.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[20px] font-bold text-slate-900">월 3,900원</span>
              <span className="text-[12px] text-slate-500 ml-1.5">(연 39,000원 · 2개월 할인)</span>
            </div>
          </div>

          <ul className="text-[13px] text-slate-600 space-y-1.5 leading-relaxed border-t border-slate-100 pt-3">
            <li>• 기기 대수 제한 없이 내 스마트폰 · 집 PC · 회사 PC 통합 검색 및 사진 백업</li>
            <li>• 기기 간 실시간 클립보드 공유</li>
            <li>• 사진·표 OCR 창(글자·표 추출) 및 귀신 라벨러(파일명 자동 정리) 무제한 이용</li>
          </ul>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => activatePricingPlan('personal_sub_3900')}
              className="py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-semibold cursor-pointer transition-colors"
            >
              월간 이용권 선택 (3,900원)
            </button>
            <button
              type="button"
              onClick={() => activatePricingPlan('personal_year_39000')}
              className="py-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-900 text-[13px] font-semibold cursor-pointer transition-colors"
            >
              연간 이용권 선택 (39,000원 · 2개월 할인)
            </button>
          </div>
        </div>

        {/* 3. 팀·기업 유료 확장: 업무 공유 (S:) */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[16.5px] text-slate-900 font-bold">업무 공유 (공용 폴더 S:)</h3>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium">
                30일 무료체험 · 팀원 무료
              </span>
            </div>
            <p className="text-[12.5px] text-slate-500 mt-0.5">
              사내 문서·계약서·현장 사진을 윈도우 탐색기 공용 드라이브(S:)로 연결하고 본문 검색을 지원합니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col justify-between gap-3">
              <div>
                <span className="text-[12px] text-slate-600 font-semibold">소호 팀 (~5인)</span>
                <div className="text-[19px] text-slate-900 font-bold mt-0.5">월 9,900원</div>
                <span className="text-[11.5px] text-slate-500">연 99,000원 (월 8,250원꼴)</span>
                <p className="text-[12px] text-slate-600 mt-2">
                  5인 이하 팀 · S: 드라이브 · 문서 본문 검색 · 예비 서버 지원
                </p>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => activatePricingPlan('work_soho_9900')}
                  className="py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-semibold cursor-pointer"
                >
                  월 9,900원
                </button>
                <button
                  type="button"
                  onClick={() => activatePricingPlan('work_soho_year_99000')}
                  className="py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-[11.5px] font-medium cursor-pointer"
                >
                  연 99,000원
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col justify-between gap-3">
              <div>
                <span className="text-[12px] text-slate-600 font-semibold">소기업 (~20인)</span>
                <div className="text-[19px] text-slate-900 font-bold mt-0.5">월 19,000원</div>
                <span className="text-[11.5px] text-slate-500">연 190,000원 (월 15,833원꼴)</span>
                <p className="text-[12px] text-slate-600 mt-2">
                  20인 이하 기업 · 부서별 권한 관리 · 예비 서버 이중화
                </p>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => activatePricingPlan('work_biz_19000')}
                  className="py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-semibold cursor-pointer"
                >
                  월 19,000원
                </button>
                <button
                  type="button"
                  onClick={() => activatePricingPlan('work_biz_year_190000')}
                  className="py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-[11.5px] font-medium cursor-pointer"
                >
                  연 190,000원
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col justify-between gap-3">
              <div>
                <span className="text-[12px] text-slate-600 font-semibold">중소기업 (~50인)</span>
                <div className="text-[19px] text-slate-900 font-bold mt-0.5">월 29,000원</div>
                <span className="text-[11.5px] text-slate-500">연 290,000원 (월 24,166원꼴)</span>
                <p className="text-[12px] text-slate-600 mt-2">
                  50인 이하 전사 문서·도면 통합 관리 (50인 초과 별도 문의)
                </p>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => activatePricingPlan('work_pro_29000')}
                  className="py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-semibold cursor-pointer"
                >
                  월 29,000원
                </button>
                <button
                  type="button"
                  onClick={() => activatePricingPlan('work_pro_year_290000')}
                  className="py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-[11.5px] font-medium cursor-pointer"
                >
                  연 290,000원
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 4. 하단 코인 지갑 요약 */}
        <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
          <div className="flex flex-wrap items-center gap-2 text-slate-600">
            <span className="font-semibold text-slate-900">
              보유 코인:{' '}
              {merlinAuth?.userId && merlinAuth.userId !== 'guest'
                ? `${(merlinAuth.coinBalance ?? 0).toLocaleString()} C`
                : '로그인 후 확인'}
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">패밀리 앱 공통 결제 코인</span>
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
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
            >
              코인 충전
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
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium border bg-white hover:bg-slate-100 border-slate-200 text-slate-700 cursor-pointer"
            >
              선물함
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
