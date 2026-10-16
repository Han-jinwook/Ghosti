import React from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { PricingPlanId } from '../types/saysee';

const PLAN_LABELS: Record<PricingPlanId, string> = {
  free_trial: '입문 무료 체험 중',
  pass_24h_990: '⚡ 24시간 자유 패스 (990원)',
  single_mobile_1900: '📱 모바일 1회 대청소권',
  single_bundle_3800: '💻📱 PC+모바일 1회 완치권',
  sub_mobile_1100: '👑 모바일 주치의 (10년 특전)',
  sub_bundle_2900: '👑 PC+모바일 통합 주치의 (10년 특전)',
};

/**
 * [스펙 4] 상단 헤더 창립 멤버 선착순 기간 뻥튀기 배너 (FOMO 유발)
 */
export const FoundingMemberFomoBar: React.FC = () => {
  const {
    foundingMemberRemainingSeats,
    activePricingPlan,
    freeTrialUsed,
    setShowProModal,
  } = useSaySeeStore();

  return (
    <div
      onClick={() => setShowProModal(true)}
      className="w-full bg-gradient-to-r from-[#2b0b12] via-[#3d1308] to-[#112432] border-b border-[#FFAB00]/40 px-4 py-2 cursor-pointer hover:brightness-110 transition-all z-40"
    >
      <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="px-2.5 py-0.5 rounded-full bg-[#FF3D00] text-white font-label-mono text-[10px] font-black uppercase tracking-wider animate-pulse shrink-0">
            FOUNDING MEMBER FOMO
          </span>
          <p className="font-headline-sm text-[12px] md:text-[13.5px] text-white font-extrabold truncate">
            🔥 창립 멤버 특전: 1년 요금 결제 시 ➔ 최초 100명{' '}
            <span className="text-[#FFD740] underline">‘평생권’</span> / ~500명{' '}
            <span className="text-[#00E5FF] underline">‘10년권’</span> / ~1,000명{' '}
            <span className="text-emerald-300">‘5년권’</span> 자동 승격!{' '}
            <span className="text-[#FFAB00] font-black">
              (현재 10년 특전 잔여: {foundingMemberRemainingSeats}석)
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full bg-black/50 border border-outline-variant/40 text-[11px] font-bold text-primary-container">
            현재 상태: {PLAN_LABELS[activePricingPlan]}
            {activePricingPlan === 'free_trial' &&
              (freeTrialUsed ? ' (1묶음 무료체험 완료)' : ' (1묶음 무료체험 가능)')}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowProModal(true);
            }}
            className="px-3 py-1 rounded-full bg-[#FFAB00] hover:bg-[#FFC400] text-surface-container-lowest font-label-sm text-[11.5px] font-black shadow-[0_0_14px_rgba(255,171,0,0.45)] transition-all"
          >
            990원 패스 / 10년 특전 보기 →
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * [스펙 4] 카페 런칭용 심플 과금 퍼널 & 선착순 기간 뻥튀기 모달
 */
export const PricingModal: React.FC = () => {
  const {
    showProModal,
    setShowProModal,
    activePricingPlan,
    freeTrialUsed,
    foundingMemberRemainingSeats,
    activatePricingPlan,
  } = useSaySeeStore();

  if (!showProModal) return null;

  return (
    <div
      onClick={() => setShowProModal(false)}
      className="fixed inset-0 z-[105] bg-black/85 backdrop-blur-2xl flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl rounded-3xl bg-surface-container-low border border-[#FFAB00]/50 shadow-[0_0_80px_rgba(255,171,0,0.22)] p-5 md:p-8 flex flex-col gap-6 my-auto"
      >
        {/* 1) 최상단 창립 멤버 선착순 기간 뻥튀기 FOMO 배너 */}
        <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-r from-[#3a0d12] via-[#4a1c06] to-[#0f2c3f] border border-[#FFAB00]/60 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#FF3D00] text-white font-label-mono text-[11px] font-black">
                🚨 카페 런칭 기념 선착순 특전
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-black/50 border border-[#FFD740]/50 text-[#FFD740] font-label-mono text-[11px] font-extrabold">
                100명 평생권 마감 완료 • 현재 ~500명 10년권 구간 진행 중!
              </span>
            </div>
            <h2 className="font-headline-md text-[18px] md:text-[21px] text-white font-extrabold tracking-tight mt-0.5">
              🔥 창립 멤버 특전: 1년 요금 결제 시 ➔ 최초 100명 ‘평생권’ / ~500명 ‘10년권’ / ~1,000명 ‘5년권’ 자동 승격!
            </h2>
            <p className="font-body-sm text-[13px] text-white/85">
              매달 빠져나가는 구글·네이버 클라우드 월정액에서 해방되세요. 지금 연간 멤버십을 시작하면 추가 비용 없이{' '}
              <strong className="text-[#FFD740]">10년 동안 주치의 파워 검색·서류함·프라이빗 싱크</strong>가 보장됩니다.
            </p>
          </div>

          <div className="px-4 py-3 rounded-2xl bg-black/65 border border-[#FFAB00] text-center shrink-0 self-stretch md:self-auto flex flex-col justify-center">
            <span className="font-label-sm text-[11px] text-[#FFAB00] font-bold">
              현재 10년 특전 잔여 좌석
            </span>
            <span className="font-headline-lg text-[28px] text-white font-black tracking-tight leading-none mt-1">
              {foundingMemberRemainingSeats}석
            </span>
            <span className="font-label-mono text-[10px] text-emerald-300 mt-1">
              422 / 500명 등록 완료
            </span>
          </div>
        </div>

        {/* 2) 모달 타이틀 & 닫기 */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-headline-md text-[20px] text-on-surface font-extrabold">
              🩺 세이씨 &amp; 클리어몬스터 심플 요금제 퍼널
            </h3>
            <p className="font-body-sm text-[13px] text-on-surface-variant">
              무료 정밀 진단 ➔ 990원 24시간 자유 해결 패스 ➔ 1,900원/3,800원 1회 완치 단품 ➔ 월 1,100원/2,900원 정기 주치의 구독
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowProModal(false)}
            className="w-9 h-9 rounded-full bg-surface-container-highest hover:bg-surface-bright flex items-center justify-center text-on-surface"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* 3) 상단 2열: [입문 무료 체험 (0원)] & [🔥 24시간 자유 해결 패스 (990원)] */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 입문 무료 체험 (0원) */}
          <div className="p-5 rounded-2xl bg-surface-container border border-outline-variant/35 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-label-sm text-[11px] font-extrabold">
                  STEP 1 • 입문 무료 검진
                </span>
                <span className="font-headline-md text-[22px] text-on-surface font-black">
                  0원
                </span>
              </div>
              <h4 className="font-headline-sm text-[17px] text-on-surface font-extrabold">
                🎁 입문 무료 체험 (진단서 + 1묶음 무료 정리)
              </h4>
              <ul className="font-body-sm text-[12.5px] text-on-surface-variant space-y-1.5 pt-1">
                <li>✓ 내 기기 전체 사진·서류 **주치의 종합 정밀 진단서** 무료 확인</li>
                <li>✓ 연사·중복 바둑판(Grid) **베스트 컷 Pick 1묶음 무료 정리 체험**</li>
                <li>✓ 3중 타임머신 안전망 (1초 즉시 되돌리기 Undo &amp; 30일 정리대기함 보호)</li>
              </ul>
            </div>

            <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between">
              <span className="font-label-sm text-[12px] text-emerald-300 font-bold">
                {freeTrialUsed
                  ? '✓ 1묶음 무료 정리 체험 완료됨'
                  : '● 현재 1묶음 무료 정리 체험 가능'}
              </span>
              <button
                type="button"
                onClick={() => activatePricingPlan('free_trial')}
                className="px-4 py-2 rounded-xl bg-surface-container-highest hover:bg-surface-bright text-on-surface font-label-sm text-[12px] font-bold"
              >
                무료 체험 계속하기
              </button>
            </div>
          </div>

          {/* 🔥 단기 유입용 [⚡ 24시간 자유 해결 패스] (990원) */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#003642] via-surface-container-high to-surface-container border-2 border-primary-container shadow-[0_0_28px_rgba(0,229,255,0.22)] flex flex-col justify-between gap-4 relative">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="px-3 py-0.5 rounded-full bg-primary-container text-on-primary-container font-label-sm text-[11px] font-black">
                  🔥 커피 반값 단기 유입 히트 상품
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="font-headline-lg text-[26px] text-primary-container font-black">
                    990원
                  </span>
                  <span className="font-label-sm text-[11px] text-on-surface-variant">/ 24시간</span>
                </div>
              </div>
              <h4 className="font-headline-sm text-[18px] text-white font-extrabold">
                ⚡ 24시간 자유 해결 패스 (오늘 하루 무제한)
              </h4>
              <ul className="font-body-sm text-[12.5px] text-on-surface-variant space-y-1.5 pt-1">
                <li>✓ **월 구독 부담 Zero!** 자동 결제 없이 오늘 하루(24시간) 동안 모든 기능 무제한</li>
                <li>✓ 중복·연사 바둑판 Pick, 흔들린 사진, 일회성 메모 **무제한 일괄 격리**</li>
                <li>✓ **[갤러리 + 스마트 서류함(PDF/신분증/영수증)]** 자연어 문장 검색 무제한</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => activatePricingPlan('pass_24h_990')}
              className="w-full py-2.5 rounded-xl bg-primary-container hover:opacity-95 text-on-primary-container font-label-lg text-[14px] font-black shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-all"
            >
              {activePricingPlan === 'pass_24h_990'
                ? '✓ 현재 24시간 자유 패스 이용 중'
                : '⚡ 990원으로 24시간 무제한 패스 즉시 시작'}
            </button>
          </div>
        </div>

        {/* 4) 중단: 1회 완치 단품 (1,900원 / 3,800원) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-surface-container border border-outline-variant/35 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-label-sm text-[11px] font-bold">
                1회 완치 단품 A • 모바일 단독
              </span>
              <span className="font-headline-md text-[22px] text-on-surface font-black">
                1,900원 <span className="text-[11px] font-normal text-on-surface-variant">/ 1회</span>
              </span>
            </div>
            <div>
              <h4 className="font-headline-sm text-[16px] text-on-surface font-extrabold">
                📱 모바일 단독 1회 대청소권
              </h4>
              <p className="font-body-sm text-[12.5px] text-on-surface-variant mt-1">
                스마트폰에 쌓인 수천 장의 중복·연사·스크린샷·흔들린 사진을 1회 완전 처치하여 기기 용량과 속도를 즉시 회복합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => activatePricingPlan('single_mobile_1900')}
              className="w-full py-2 rounded-xl bg-surface-container-highest hover:bg-surface-bright text-on-surface font-label-md text-[13px] font-extrabold border border-outline-variant/40 transition-all"
            >
              1,900원 모바일 1회 대청소 선택
            </button>
          </div>

          <div className="p-5 rounded-2xl bg-surface-container border border-outline-variant/35 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container-highest text-primary-container font-label-sm text-[11px] font-bold">
                1회 완치 단품 B • PC + 모바일 양쪽
              </span>
              <span className="font-headline-md text-[22px] text-primary-container font-black">
                3,800원 <span className="text-[11px] font-normal text-on-surface-variant">/ 1회</span>
              </span>
            </div>
            <div>
              <h4 className="font-headline-sm text-[16px] text-on-surface font-extrabold">
                💻📱 PC+모바일 양쪽 대청소 및 최초 1회 일치화권
              </h4>
              <p className="font-body-sm text-[12.5px] text-on-surface-variant mt-1">
                폰과 PC 양쪽의 중복·쓰레기를 모두 대청소한 뒤, 프라이빗 싱크(원본 미러링 또는 13KB 섀도우 캐시)로 최초 1회 완전 일치화합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => activatePricingPlan('single_bundle_3800')}
              className="w-full py-2 rounded-xl bg-surface-container-highest hover:bg-surface-bright text-primary-container font-label-md text-[13px] font-extrabold border border-primary-container/40 transition-all"
            >
              3,800원 PC+모바일 1회 완치 선택
            </button>
          </div>
        </div>

        {/* 5) 하단: 👑 정기 주치의 멤버십 (주력 구독 — 선착순 기간 뻥튀기 적용!) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 모바일 단독 플랜: 월 1,100원 (연 11,000원 -> 10년권 승격) */}
          <div className="p-6 rounded-3xl bg-surface-container-high border border-[#FFAB00]/50 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="px-3 py-1 rounded-full bg-[#FFAB00]/20 border border-[#FFAB00]/50 text-[#FFAB00] font-label-sm text-[11px] font-extrabold">
                  👑 정기 주치의 멤버십 • 모바일 단독
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-label-mono text-[11px] font-bold">
                  연 결제 시 10년권 자동 승격!
                </span>
              </div>

              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-headline-lg text-[26px] text-white font-black">
                  월 1,100원
                </span>
                <span className="font-body-sm text-[13px] text-[#FFD740] font-bold">
                  (연 11,000원 결제 시 ➔ 10년 내내 무료!)
                </span>
              </div>

              <ul className="font-body-sm text-[13px] text-on-surface-variant space-y-1.5 pt-2">
                <li>✓ **상시 파워 검색 무제한:** `[🖼️ 갤러리]` + `[📁 스마트 서류함(PDF/신분증/설명서)]`</li>
                <li>✓ **월 1회 정기 주치의 진단 &amp; 청소 리포트** 자동 발행</li>
                <li>✓ 3중 타임머신 안전망 (1초 Undo + 30일 정리대기함 보호) 상시 가동</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => activatePricingPlan('sub_mobile_1100')}
              className="w-full py-3 rounded-2xl bg-[#FFAB00] hover:bg-[#FFC400] text-surface-container-lowest font-label-lg text-[14px] font-black shadow-[0_0_20px_rgba(255,171,0,0.35)] transition-all"
            >
              👑 모바일 주치의 시작 (연 11,000원 ➔ 10년 특전 승격)
            </button>
          </div>

          {/* PC+모바일 통합 플랜: 월 2,900원 (연 29,000원 -> 10년권 승격) */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-[#332200] via-surface-container-high to-[#082c38] border-2 border-[#FFD740] shadow-[0_0_36px_rgba(255,215,64,0.25)] flex flex-col justify-between gap-4 relative">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="px-3 py-1 rounded-full bg-[#FFD740] text-surface-container-lowest font-label-sm text-[11px] font-black">
                  👑 BEST 주력 구독 • PC + 모바일 통합 플랜
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#FF3D00] text-white font-label-mono text-[11px] font-black">
                  잔여 {foundingMemberRemainingSeats}석 • 10년권 승격!
                </span>
              </div>

              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-headline-lg text-[28px] text-[#FFD740] font-black">
                  월 2,900원
                </span>
                <span className="font-body-sm text-[13px] text-white font-bold">
                  (연 29,000원 결제 시 ➔ 10년권 자동 승격!)
                </span>
              </div>

              <ul className="font-body-sm text-[13px] text-white/90 space-y-1.5 pt-2">
                <li>✓ **PC + 모바일 양쪽 모든 파워 검색·스마트 서류함·주치의 대청소 무제한**</li>
                <li>
                  ✓ **클라우드 대체 상시 프라이빗 싱크:** `[🔄 100% 원본 미러링]` &amp; `[👻 13KB 섀도우 캐시]`
                </li>
                <li>
                  ✓ **PC 원격 투시 검색:** 집 PC 전원이 꺼져 있어도 밖에서 내 폰으로 PC 속 10년 치 사진·PDF 서류 0.04초 열람!
                </li>
                <li className="text-[#00E5FF] font-bold">
                  ✓ 패밀리/멀티기기 특전: 동일 계정 내 기기 추가 시 1대당 50% 반값 (월 1,450원)
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => activatePricingPlan('sub_bundle_2900')}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#FFD740] via-[#FFAB00] to-[#00E5FF] hover:brightness-105 text-surface-container-lowest font-label-lg text-[14.5px] font-black shadow-[0_0_28px_rgba(255,215,64,0.5)] transition-all"
            >
              👑 PC+모바일 통합 주치의 시작 (연 29,000원 ➔ 10년권 승격!)
            </button>
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
            🔍 온디바이스 텍스트/OCR 색인 본문 미리보기
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
