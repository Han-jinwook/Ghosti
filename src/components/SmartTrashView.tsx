import React, { useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { PhotoItem, TrashCategory } from '../types/saysee';

const TRASH_TABS: {
  key: 'duplicate' | 'memo' | 'screenshot' | 'blurry';
  stepNum: string;
  title: string;
  shortBadge: string;
  cleanTag: string;
  subtitle: string;
  icon: string;
  badgeColor: string;
}[] = [
  {
    key: 'duplicate',
    stepNum: '①',
    title: '동일한 복사본 · 연사',
    shortBadge: '복사본·연사',
    cleanTag: '#중복·연사사본',
    subtitle: '64-bit Perceptual dHash & 연사 클러스터 • 베스트 컷 1장만 클릭(Pick)하면 나머지가 즉시 격리됩니다',
    icon: 'burst_mode',
    badgeColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-400/35',
  },
  {
    key: 'memo',
    stepNum: '②',
    title: '주차장 · 영수증 · 일회성 메모',
    shortBadge: '주차·사물·일회성메모',
    cleanTag: '#주차·부품·일회성메모',
    subtitle:
      '주차장 기둥(K13) · 케이블/부품 사물 접사 · 단기 택배/현수막 메모 (※ 신분증·조립설명서는 [📁 스마트 서류함]에 영구 보호됨)',
    icon: 'description',
    badgeColor: 'text-[#FFAB00] bg-[#FFAB00]/15 border-[#FFAB00]/35',
  },
  {
    key: 'screenshot',
    stepNum: '③',
    title: '스크린샷',
    shortBadge: '스크린샷 캡처',
    cleanTag: '#스크린샷 캡처',
    subtitle: '스마트폰 문자 메시지 캡처 · 모바일 홈 화면 · 일회성 앱 알림 화면 캡처',
    icon: 'screenshot_mobile',
    badgeColor: 'text-primary-container bg-primary-container/15 border-primary-container/35',
  },
  {
    key: 'blurry',
    stepNum: '④',
    title: '심한 흔들림 · 오촬영',
    shortBadge: '흔들림·오촬영',
    cleanTag: '#초점이탈·오촬영',
    subtitle: '8방향 라플라시안 선명도 붕괴 • 보행 중 바닥 오촬영 및 심한 모션 블러',
    icon: 'blur_on',
    badgeColor: 'text-secondary bg-secondary-container/30 border-secondary/35',
  },
];

const fmtMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function matchesTrashTab(photo: PhotoItem, tabKey: string): boolean {
  if (!photo.trashCategory || photo.quarantined) return false;
  if (tabKey === 'all') return true;
  if (tabKey === 'memo') {
    return (
      photo.trashCategory === 'memo' ||
      photo.trashCategory === 'object' ||
      photo.trashCategory === 'document' ||
      photo.trashCategory === 'receipt'
    );
  }
  return photo.trashCategory === tabKey;
}

export const AmberDietBanner: React.FC<{ onNavigateToTrash?: () => void }> = ({
  onNavigateToTrash,
}) => {
  const { photos, duplicateGroups, moveAllTrashToQuarantine, quarantineMoving, openLocalFolder } =
    useSaySeeStore();

  const activeTrash = photos.filter((p) => p.trashCategory && !p.quarantined);
  const quarantinedTrash = photos.filter((p) => p.quarantined);
  const totalTrashBytes = activeTrash.reduce((a, p) => a + p.size, 0);

  const dupCount = activeTrash.filter((p) => matchesTrashTab(p, 'duplicate')).length;
  const memoCount = activeTrash.filter((p) => matchesTrashTab(p, 'memo')).length;
  const screenshotCount = activeTrash.filter((p) => matchesTrashTab(p, 'screenshot')).length;
  const blurryCount = activeTrash.filter((p) => matchesTrashTab(p, 'blurry')).length;

  return (
    <div className="w-full transition-all duration-300">
      <div className="p-5 md:p-6 rounded-2xl bg-surface-container/95 backdrop-blur-2xl border border-[#FFAB00]/45 shadow-[0_0_36px_rgba(255,171,0,0.22)] relative overflow-hidden flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="absolute left-0 top-0 bottom-0 w-2 bg-[#FFAB00] shadow-[0_0_16px_#FFAB00]" />

        <div className="flex items-start md:items-center gap-4 pl-2 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-[#FFAB00]/15 border border-[#FFAB00]/40 flex items-center justify-center shrink-0 shadow-[0_0_16px_rgba(255,171,0,0.3)]">
            <span className="material-symbols-outlined text-[#FFAB00] text-[28px]">
              cleaning_services
            </span>
          </div>

          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#FFAB00] text-surface-container-lowest font-label-mono text-[10px] font-extrabold uppercase">
                CLEARMONSTER LITE • 기기 자체 dHash 초고속 진단
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11px] font-extrabold">
                🛡️ 연사·중복 {duplicateGroups.length}개 클러스터 [원본 1장 안전하게 보존됨]
              </span>
              {quarantinedTrash.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-primary-container/20 text-primary-container font-label-mono text-[10px] font-bold">
                  현재 정리대기함 {quarantinedTrash.length}장 격리됨
                </span>
              )}
            </div>

            <h3 className="font-headline-sm text-[16px] md:text-[18px] text-on-surface font-extrabold tracking-tight">
              {activeTrash.length > 0
                ? `💡 ${activeTrash.length}장의 사진을 정리하여 저장 공간(${fmtMB(totalTrashBytes)})을 즉시 확보할 수 있습니다`
                : `✨ 모든 추천 정리 대상 사진(${quarantinedTrash.length}장)이 [세이씨_정리대기함]으로 안전하게 격리되었습니다!`}
            </h3>

            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {activeTrash.length > 0
                ? `① 동일한 복사본·연사 ${dupCount}장(원본 1장씩 완벽 보존), ② 주차장·사물·일회성 메모 ${memoCount}장, ③ 스크린샷 ${screenshotCount}장, ④ 심한 흔들림·오촬영 ${blurryCount}장을 선별했습니다.`
                : `윈도우 탐색기에서 [세이씨_정리대기함] 폴더를 열어 확인한 뒤 비우거나 언제든 복원할 수 있습니다.`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-end lg:self-auto pl-2 lg:pl-0">
          {onNavigateToTrash && (
            <button
              onClick={onNavigateToTrash}
              className="px-4 py-2.5 rounded-full bg-surface-container-highest hover:bg-surface-bright text-on-surface font-label-lg text-label-lg font-semibold transition-colors border border-outline-variant/40"
            >
              주치의 정리 열기
            </button>
          )}

          <button
            onClick={() => void openLocalFolder('quarantine')}
            className="px-4 py-2.5 rounded-full bg-surface-container-high hover:bg-surface-bright text-[#FFAB00] font-label-lg text-label-lg font-bold border border-[#FFAB00]/30 flex items-center gap-1.5 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">folder_open</span>
            <span>폴더 열기</span>
          </button>

          {activeTrash.length > 0 && (
            <button
              disabled={quarantineMoving}
              onClick={() => void moveAllTrashToQuarantine()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FFAB00] hover:bg-[#FFB724] text-surface-container-lowest font-label-lg text-label-lg font-black shadow-[0_0_24px_rgba(255,171,0,0.5)] active:scale-95 transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">drive_file_move</span>
              <span>{quarantineMoving ? '이동 중...' : '원본 남기고 한 번에 격리'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const SmartTrashView: React.FC = () => {
  const {
    photos,
    duplicateGroups,
    selectedTrashIds,
    activeTrashCategoryFilter,
    setActiveTrashCategoryFilter,
    toggleTrashSelection,
    selectAllTrashInFilter,
    clearTrashSelection,
    pickBestInDuplicateGroup,
    moveSelectedToQuarantine,
    moveAllTrashToQuarantine,
    restoreFromQuarantine,
    openLocalFolder,
    quarantineMoving,
    setSelectedPhoto,
    lastUndoBatch,
    undoLastQuarantine,
    dismissUndoBatch,
    freeTrialUsed,
    activePricingPlan,
    setShowProModal,
    setDesktopTab,
    setSearchSpace,
  } = useSaySeeStore();

  const [gridColumns, setGridColumns] = useState<3 | 4>(4);

  const activeTrash = photos.filter((p) => p.trashCategory && !p.quarantined);
  const quarantinedPhotos = photos.filter((p) => p.quarantined);
  const totalTrashBytes = activeTrash.reduce((a, p) => a + p.size, 0);

  const dupCount = activeTrash.filter((p) => matchesTrashTab(p, 'duplicate')).length;
  const memoCount = activeTrash.filter((p) => matchesTrashTab(p, 'memo')).length;
  const screenshotCount = activeTrash.filter((p) => matchesTrashTab(p, 'screenshot')).length;
  const blurryCount = activeTrash.filter((p) => matchesTrashTab(p, 'blurry')).length;
  const memoAndScreenCount = memoCount + screenshotCount;

  // 처치 완료 시 예상 반응 속도 향상률(%) 계산 (낭비 항목 대비 가속 지표)
  const expectedSpeedBoostPct = Math.max(14, Math.min(38, Math.round(12 + activeTrash.length * 0.72)));
  const currentHealthScore = Math.max(68, 98 - activeTrash.length);

  const currentTab =
    activeTrashCategoryFilter === 'object' ||
    activeTrashCategoryFilter === 'document' ||
    activeTrashCategoryFilter === 'receipt'
      ? 'memo'
      : activeTrashCategoryFilter;

  const filteredCandidates = activeTrash.filter((p) => matchesTrashTab(p, currentTab));

  const selectedBytes = activeTrash
    .filter((p) => selectedTrashIds.has(p.id))
    .reduce((a, p) => a + p.size, 0);

  const photoById = new Map(photos.map((p) => [p.id, p]));

  // 아직 격리되지 않은 사본이 남아 있는 중복/연사 클러스터만 바둑판 비교 뷰에 표시
  const activeDuplicateGroups = duplicateGroups.filter((g) =>
    g.photoIds.some((id) => {
      const ph = photoById.get(id);
      return ph && !ph.quarantined && id !== g.bestPhotoId;
    })
  );

  const showDuplicatePickSection =
    (currentTab === 'duplicate' || currentTab === 'all') && activeDuplicateGroups.length > 0;

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 md:px-10 py-6 flex flex-col gap-6 pb-24">
      {/* ─────────────── [스펙 2 핵심] 🩺 주치의 종합 진단 리포트 배너 (정리 탭 최상단) & 3중 안전망 안심 문구 ─────────────── */}
      <div className="p-6 md:p-7 rounded-3xl bg-gradient-to-br from-surface-container-low via-surface-container to-[#0d252e] border border-[#00E5FF]/40 shadow-[0_0_40px_rgba(0,229,255,0.14)] flex flex-col gap-5">
        {/* 상단 배지 & 30일 안전 격리 / 블랙박스 보호 안심 문구 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-outline-variant/25">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-primary-container text-on-primary-container font-label-sm text-[12px] font-black flex items-center gap-1 shadow-[0_0_16px_rgba(0,229,255,0.35)]">
              <span>🩺 디지털 주치의 무료 종합 진단서</span>
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-label-sm text-[12px] font-black flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">verified_user</span>
              <span>원본 1장 안전하게 보존됨</span>
            </span>
            {activePricingPlan === 'free_trial' && (
              <button
                type="button"
                onClick={() => setShowProModal(true)}
                className="px-3 py-1 rounded-full bg-[#FFAB00]/20 hover:bg-[#FFAB00]/30 border border-[#FFAB00]/50 text-[#FFAB00] font-label-sm text-[11.5px] font-extrabold transition-all"
              >
                {freeTrialUsed
                  ? '⚡ 무료 1묶음 체험 완료 • 1,900원 단품 / 10년 특전 열기 →'
                  : '🎁 입문 무료 혜택: 전체 정밀 진단서 + 연사 바둑판 Pick 1묶음 무료 체험 가능!'}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchSpace('vault');
              setDesktopTab('dashboard');
            }}
            className="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-bright text-[#FFAB00] font-label-sm text-[11.5px] font-bold border border-[#FFAB00]/35 flex items-center gap-1.5"
          >
            <span>📁 신분증·조립설명서는 [스마트 서류함]에 안전 분리됨 →</span>
          </button>
        </div>

        {/* 주치의 종합 진단 메인 문구 & 시각적 속도 향상 게이지 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 flex flex-col gap-2.5">
            <h1 className="font-headline-lg text-[19px] md:text-[23px] text-white font-extrabold leading-snug tracking-tight">
              {activeTrash.length > 0 ? (
                <>
                  🩺 진단 결과: 중복·연사(파일명 다른 카톡 사본 포함){' '}
                  <span className="text-emerald-300 underline">{dupCount}장</span>, 흔들린 사진{' '}
                  <span className="text-secondary underline">{blurryCount}장</span>, 일회성 메모·캡처{' '}
                  <span className="text-[#FFAB00] underline">{memoAndScreenCount}장</span> (총{' '}
                  <span className="text-[#FFAB00]">{fmtMB(totalTrashBytes)}</span> 낭비 중)
                  <br />
                  <span className="text-primary-container">
                    ➔ 처치 완료 시 기기 탐색 및 인덱싱 반응 속도 약 +{expectedSpeedBoostPct}% 향상 예상!
                  </span>
                </>
              ) : (
                <span className="text-emerald-300">
                  ✨ 주치의 처치 완료! 모든 중복·흔들림·일회성 메모({quarantinedPhotos.length}장)가 격리되어 탐색 반응 속도가 최적(98점) 상태입니다.
                </span>
              )}
            </h1>

            {/* 🛡️ 3중 안전망 안심 명시 문구 */}
            <div className="p-3.5 rounded-2xl bg-black/45 border border-emerald-400/35 flex items-start sm:items-center gap-2.5">
              <span className="material-symbols-outlined text-emerald-400 text-[20px] shrink-0">
                shield_lock
              </span>
              <p className="font-body-sm text-[12.5px] md:text-[13px] text-emerald-200 font-semibold leading-relaxed">
                🛡️ <strong>3중 타임머신 안전망:</strong> 모든 정리 파일은 영구 삭제되지 않고{' '}
                <code className="text-[#FFAB00] font-bold">[세이씨_정리대기함]</code>에서{' '}
                <strong>30일간 안전하게 보호</strong>되며, 실수 시 하단{' '}
                <strong>[↩️ 1초 즉시 되돌리기(Undo)]</strong>가 가능하고 PC 연결 시{' '}
                <strong>원본 블랙박스 보관</strong>이 가능합니다.
              </p>
            </div>
          </div>

          {/* 우측 시각적 게이지 & 일괄 처치 액션 */}
          <div className="lg:col-span-4 p-4 rounded-2xl bg-surface-container-lowest/90 border border-primary-container/30 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-[12px] text-on-surface-variant font-bold">
                기기 탐색·인덱싱 반응 속도 게이지
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-primary-container/20 text-primary-container font-label-mono text-[12px] font-black">
                {activeTrash.length > 0 ? `+${expectedSpeedBoostPct}% 향상 예상` : '최적 가속 완료'}
              </span>
            </div>

            {/* 시각적 2단 속도 향상 게이지 바 */}
            <div className="w-full h-4 rounded-full bg-surface-container-high overflow-hidden flex p-0.5 border border-outline-variant/30">
              <div
                style={{ width: `${currentHealthScore}%` }}
                className="h-full rounded-l-full bg-gradient-to-r from-secondary-container to-primary-container transition-all duration-500"
              />
              {activeTrash.length > 0 && (
                <div
                  style={{ width: `${100 - currentHealthScore}%` }}
                  className="h-full rounded-r-full bg-gradient-to-r from-[#FFAB00] to-emerald-400 animate-pulse"
                />
              )}
            </div>

            <div className="flex items-center justify-between font-label-mono text-[11px] text-on-surface-variant">
              <span>현재 상태: {currentHealthScore}점</span>
              <span className="text-emerald-300 font-bold">처치 후: 98점 (쾌적)</span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => void openLocalFolder('quarantine')}
                className="px-3 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface border border-outline-variant/40 font-label-sm text-[12px] font-bold flex items-center gap-1 shrink-0"
              >
                <span className="material-symbols-outlined text-[#FFAB00] text-[16px]">
                  folder_special
                </span>
                <span>대기함 열기</span>
              </button>

              <button
                type="button"
                disabled={activeTrash.length === 0 || quarantineMoving}
                onClick={() => void moveAllTrashToQuarantine()}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#FFAB00] hover:bg-[#FFB724] text-surface-container-lowest font-label-md text-[13px] font-black shadow-[0_0_20px_rgba(255,171,0,0.45)] flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]">bolt</span>
                <span>원본 남기고 {activeTrash.length}장 일괄 처치</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────── [스펙 2 핵심] 🛡️ 3중 타임머신 안전망: 즉시 되돌리기(Undo) 플로팅/인라인 바 ─────────────── */}
      {lastUndoBatch && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/95 via-[#072b35] to-surface-container-high border-2 border-emerald-400 shadow-[0_0_32px_rgba(16,185,129,0.35)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shrink-0">
              <span className="material-symbols-outlined text-[22px]">history</span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-[15px] text-white font-extrabold">
                🛡️ [3중 타임머신 안전망 작동 중] 방금 정리한 {lastUndoBatch.count}장 ({fmtMB(lastUndoBatch.savedBytes)})이 정리대기함으로 안전 격리되었습니다.
              </span>
              <span className="font-body-sm text-[12px] text-emerald-200">
                실수로 눌렀더라도 걱정하지 마세요! 오른쪽 버튼을 누르면 1초 만에 원래 갤러리 위치로 즉시 되돌아갑니다.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void undoLastQuarantine()}
              className="px-4 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-surface-container-lowest font-label-md text-[13px] font-black shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center gap-1.5 transition-all"
            >
              <span>↩️ 방금 정리한 항목 원래대로 되돌리기 (Undo)</span>
            </button>
            <button
              type="button"
              onClick={dismissUndoBatch}
              className="p-2 rounded-lg text-on-surface-variant hover:text-white"
              title="닫기"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      )}

      {/* ─────────────── [지침 #4] 스마트 정리 4대 탭 네비게이션 카드 ─────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {TRASH_TABS.map((tab) => {
          const items = activeTrash.filter((p) => matchesTrashTab(p, tab.key));
          const bytes = items.reduce((a, p) => a + p.size, 0);
          const isSelected = currentTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTrashCategoryFilter(tab.key as TrashCategory)}
              className={`group text-left cursor-pointer rounded-2xl p-4 transition-all flex flex-col justify-between gap-3.5 border ${
                isSelected
                  ? tab.key === 'duplicate'
                    ? 'bg-surface-container-high border-emerald-400 ring-2 ring-emerald-400/30 shadow-[0_0_28px_rgba(16,185,129,0.22)]'
                    : 'bg-surface-container-high border-[#FFAB00] ring-2 ring-[#FFAB00]/30 shadow-[0_0_28px_rgba(255,171,0,0.2)]'
                  : 'bg-surface-container/75 hover:bg-surface-container-high/70 border-outline-variant/25'
              }`}
            >
              <div className="flex items-start justify-between gap-2 w-full">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-headline-sm text-[15px] text-primary-container font-black">
                      {tab.stepNum}
                    </span>
                    <span className="font-headline-sm text-[15.5px] text-on-surface font-extrabold">
                      {tab.title}
                    </span>
                  </div>
                  <span className="font-body-sm text-[11.5px] text-on-surface-variant leading-snug">
                    {tab.subtitle}
                  </span>
                </div>
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tab.badgeColor}`}
                >
                  <span className="material-symbols-outlined text-[19px]">{tab.icon}</span>
                </div>
              </div>

              {/* 미니 썸네일 스트립 */}
              <div className="flex items-center gap-1.5 h-12">
                {items.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    className="w-11 h-11 rounded-lg overflow-hidden bg-surface-container-lowest border border-outline-variant/30 shrink-0"
                  >
                    <img src={p.thumbUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                {items.length > 4 && (
                  <span className="font-label-mono text-[11px] text-on-surface-variant pl-1">
                    +{items.length - 4}
                  </span>
                )}
                {items.length === 0 && (
                  <span className="font-label-mono text-[11px] text-outline">
                    격리 완료 (0장 남음)
                  </span>
                )}
              </div>

              <div className="flex items-baseline justify-between pt-2 border-t border-outline-variant/20 w-full">
                <div className="flex items-baseline gap-1">
                  <span className="font-headline-md text-[20px] text-on-surface font-extrabold">
                    {items.length}
                  </span>
                  <span className="font-label-sm text-[12px] text-on-surface-variant">장</span>
                  {tab.key === 'duplicate' && activeDuplicateGroups.length > 0 && (
                    <span className="ml-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-label-sm text-[10px] font-bold">
                      원본 {activeDuplicateGroups.length}장 보존됨
                    </span>
                  )}
                </div>
                <span className="font-label-mono text-[11px] text-[#FFAB00] font-bold">
                  {fmtMB(bytes)}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ─────────────── [지침 #4 핵심] ① 동일한 복사본·연사 탭: PC 3x3 / 4x4 바둑판(Grid) 원클릭 Pick UI ─────────────── */}
      {showDuplicatePickSection && (
        <div className="p-5 md:p-6 rounded-3xl bg-surface-container/90 border border-emerald-400/40 shadow-[0_0_32px_rgba(16,185,129,0.12)] flex flex-col gap-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-outline-variant/25 pb-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-500 text-surface-container-lowest font-label-sm text-[12px] font-black flex items-center gap-1 shadow-[0_0_16px_rgba(16,185,129,0.4)]">
                  <span className="material-symbols-outlined text-[15px]">verified_user</span>
                  <span>원본 1장 안전하게 보존됨</span>
                </span>
                <span className="font-label-mono text-[11px] text-emerald-300 font-bold">
                  ① 동일한 복사본·연사 ({activeDuplicateGroups.length}개 묶음) • PC 바둑판(Grid) 베스트 컷 Pick
                </span>
              </div>
              <h2 className="font-headline-sm text-[18px] text-on-surface font-extrabold">
                연사 · 중복 사진을 바둑판으로 넓게 비교하고, 마음에 드는 베스트 컷 1장만 클릭(Pick)하세요!
              </h2>
              <p className="font-body-sm text-[13px] text-on-surface-variant">
                초록색 테두리의 <strong>[원본 1장 안전하게 보존됨]</strong> 사진은 절대 지워지지 않으며,
                바둑판에서 가장 표정·구도가 좋은 <strong>1장을 클릭(Pick)하면 그 1장만 남기고 나머지 연사 사본이 즉시 정리대기함으로 격리</strong>됩니다.
              </p>
            </div>

            {/* PC 3x3 / 4x4 바둑판 배열 전환 토글 */}
            <div className="flex items-center gap-1.5 bg-surface-container-lowest/90 p-1.5 rounded-2xl border border-emerald-400/30 self-start md:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setGridColumns(3)}
                className={`px-3.5 py-2 rounded-xl font-label-md text-[12px] font-extrabold transition-all flex items-center gap-1.5 ${
                  gridColumns === 3
                    ? 'bg-emerald-500 text-surface-container-lowest shadow'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">grid_on</span>
                <span>3×3 바둑판 배열</span>
              </button>
              <button
                type="button"
                onClick={() => setGridColumns(4)}
                className={`px-3.5 py-2 rounded-xl font-label-md text-[12px] font-extrabold transition-all flex items-center gap-1.5 ${
                  gridColumns === 4
                    ? 'bg-emerald-500 text-surface-container-lowest shadow'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">apps</span>
                <span>4×4 바둑판 배열</span>
              </button>
            </div>
          </div>

          {/* 각 연사/중복 묶음별로 시원하게 펼쳐지는 3x3 / 4x4 바둑판(Grid) */}
          <div className="flex flex-col gap-5">
            {activeDuplicateGroups.map((group, gIdx) => {
              const groupPhotos = group.photoIds
                .map((id) => photoById.get(id))
                .filter((p): p is NonNullable<typeof p> => Boolean(p && !p.quarantined));

              const redundantCount = groupPhotos.filter((p) => p.id !== group.bestPhotoId).length;
              const repPhoto = groupPhotos[0];
              const sceneLabel = repPhoto?.tags.find((t) => !t.includes('연사') && !t.includes('원본')) || '#연사클러스터';

              return (
                <div
                  key={group.groupId}
                  className="p-4 md:p-5 rounded-2xl bg-surface-container-low/95 border border-outline-variant/35 flex flex-col gap-4 shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-3 py-1 rounded-lg bg-emerald-500 text-surface-container-lowest font-label-sm text-[12px] font-black flex items-center gap-1 shadow-sm">
                        <span className="material-symbols-outlined text-[14px]">verified_user</span>
                        <span>원본 1장 안전하게 보존됨</span>
                      </span>
                      <span className="font-headline-sm text-[15px] text-on-surface font-extrabold">
                        연사·중복 묶음 #{gIdx + 1} ({groupPhotos.length}장 연사)
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-primary-container/15 text-primary-container font-label-sm text-[12px] font-bold">
                        {sceneLabel}
                      </span>
                      {repPhoto?.locationKo && (
                        <span className="font-body-sm text-[12px] text-on-surface-variant">
                          📍 {repPhoto.locationKo} • {repPhoto.date.split(' ')[0]}
                        </span>
                      )}
                    </div>

                    <button
                      disabled={quarantineMoving}
                      onClick={() =>
                        void pickBestInDuplicateGroup(group.groupId, group.bestPhotoId, true)
                      }
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-surface-container-lowest font-label-md text-[12.5px] font-black transition-all shadow-[0_0_16px_rgba(16,185,129,0.3)] flex items-center gap-1.5 shrink-0"
                    >
                      <span className="material-symbols-outlined text-[17px]">check_circle</span>
                      <span>현재 베스트 1장만 남기고 나머지 {redundantCount}장 즉시 격리</span>
                    </button>
                  </div>

                  {/* 연사 장수에 맞춰 시원하게 펼쳐지는 PC 3x3 / 4x4 바둑판(Grid) */}
                  <div
                    className={`grid grid-cols-2 ${
                      gridColumns === 3
                        ? 'sm:grid-cols-3 lg:grid-cols-3'
                        : 'sm:grid-cols-3 lg:grid-cols-4'
                    } gap-3.5`}
                  >
                    {groupPhotos.map((ph, idx) => {
                      const isBestOriginal = ph.id === group.bestPhotoId;
                      return (
                        <div
                          key={ph.id}
                          onClick={() =>
                            void pickBestInDuplicateGroup(group.groupId, ph.id, true)
                          }
                          className={`group/card relative aspect-[4/5] rounded-2xl overflow-hidden cursor-pointer transition-all ${
                            isBestOriginal
                              ? 'ring-3 ring-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.4)]'
                              : 'border border-outline-variant/40 opacity-90 hover:opacity-100 hover:ring-3 hover:ring-emerald-400'
                          }`}
                        >
                          <img
                            src={ph.thumbUrl}
                            alt=""
                            loading="lazy"
                            className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
                          />

                          {/* 상단 배지 */}
                          {isBestOriginal ? (
                            <div className="absolute top-2.5 left-2.5 right-2.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/95 text-surface-container-lowest font-label-sm text-[11.5px] font-black flex items-center justify-center gap-1 shadow-md">
                              <span className="material-symbols-outlined text-[15px]">
                                verified_user
                              </span>
                              <span>원본 1장 안전하게 보존됨 (Best)</span>
                            </div>
                          ) : (
                            <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-[#FFAB00]/50 text-[#FFAB00] font-label-sm text-[11px] font-extrabold">
                              연사 #{idx + 1} • 사본 정리 대상
                            </div>
                          )}

                          {/* 크게 보기 버튼 */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPhoto(ph, groupPhotos);
                            }}
                            title="크게 비교 보기"
                            className="absolute bottom-11 right-2.5 w-8 h-8 rounded-full bg-black/75 hover:bg-primary-container text-white hover:text-on-primary flex items-center justify-center transition-colors z-10"
                          >
                            <span className="material-symbols-outlined text-[17px]">zoom_in</span>
                          </button>

                          {/* 하단 15% 블랙 그라데이션 & 원클릭 Pick 안내 바 */}
                          <div
                            className={`absolute inset-x-0 bottom-0 pt-6 pb-2.5 px-3 text-center font-label-sm text-[12px] font-extrabold transition-all bg-gradient-to-t ${
                              isBestOriginal
                                ? 'from-emerald-950/95 via-emerald-950/80 to-transparent text-emerald-300'
                                : 'from-black/95 via-black/75 to-transparent text-white group-hover/card:from-emerald-600 group-hover/card:via-emerald-600/90 group-hover/card:text-surface-container-lowest'
                            }`}
                          >
                            {isBestOriginal
                              ? '✓ 보존 중인 베스트 컷 (클릭 시 사본 즉시 격리)'
                              : '👆 이 1장을 베스트 컷으로 Pick (나머지 즉시 격리)'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────── 탭 ②·③·④ 및 개별 선택 툴바 ─────────────── */}
      {currentTab !== 'duplicate' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex flex-wrap items-center gap-2">
              {TRASH_TABS.map((t) => {
                const count = activeTrash.filter((p) => matchesTrashTab(p, t.key)).length;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTrashCategoryFilter(t.key as TrashCategory)}
                    className={`px-3.5 py-1.5 rounded-full font-label-sm text-[12.5px] transition-all ${
                      currentTab === t.key
                        ? 'bg-[#FFAB00] text-surface-container-lowest font-extrabold'
                        : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {t.stepNum} {t.title} ({count})
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setActiveTrashCategoryFilter('all')}
                className={`px-3.5 py-1.5 rounded-full font-label-sm text-[12.5px] transition-all ${
                  currentTab === 'all'
                    ? 'bg-[#FFAB00] text-surface-container-lowest font-extrabold'
                    : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
              >
                전체 보기 ({activeTrash.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllTrashInFilter}
                className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-primary font-label-sm text-[12px] font-bold"
              >
                현재 탭 전체 선택
              </button>
              <button
                type="button"
                onClick={clearTrashSelection}
                className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface-variant font-label-sm text-[12px]"
              >
                선택 해제
              </button>
              <button
                type="button"
                disabled={selectedTrashIds.size === 0 || quarantineMoving}
                onClick={() => void moveSelectedToQuarantine()}
                className="px-4 py-1.5 rounded-lg bg-[#FFAB00] hover:bg-[#FFB724] text-surface-container-lowest font-label-sm text-[12px] font-extrabold disabled:opacity-40"
              >
                선택된 {selectedTrashIds.size}장 ({fmtMB(selectedBytes)}) 격리
              </button>
            </div>
          </div>

          {filteredCandidates.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {filteredCandidates.map((photo) => {
                const isChecked = selectedTrashIds.has(photo.id);
                const tabMeta =
                  TRASH_TABS.find((t) => matchesTrashTab(photo, t.key)) || TRASH_TABS[1];
                const isDuplicateCopy = photo.trashCategory === 'duplicate';

                return (
                  <div
                    key={photo.id}
                    onClick={() => toggleTrashSelection(photo.id)}
                    className={`group relative rounded-2xl overflow-hidden bg-surface-container transition-all cursor-pointer border ${
                      isChecked
                        ? 'border-[#FFAB00] ring-2 ring-[#FFAB00]/40 shadow-[0_0_20px_rgba(255,171,0,0.2)]'
                        : 'border-outline-variant/25 opacity-85 hover:opacity-100'
                    }`}
                  >
                    <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-container-highest">
                      <img
                        src={photo.thumbUrl}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {isDuplicateCopy ? (
                        <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-emerald-500/95 text-surface-container-lowest flex items-center gap-1 shadow-md">
                          <span className="material-symbols-outlined text-[14px]">
                            verified_user
                          </span>
                          <span className="font-label-sm text-[11px] font-black">
                            원본 1장 안전하게 보존됨
                          </span>
                        </div>
                      ) : (
                        <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md flex items-center gap-1.5 border border-[#FFAB00]/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FFAB00]" />
                          <span className="font-label-sm text-[11px] font-extrabold text-[#FFAB00]">
                            {tabMeta.shortBadge}
                          </span>
                        </div>
                      )}

                      <div
                        className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-[#FFAB00] text-surface-container-lowest font-bold shadow'
                            : 'bg-black/60 border border-outline text-transparent'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPhoto(photo);
                        }}
                        title="크게 보기"
                        className="absolute bottom-11 right-2.5 w-7 h-7 rounded-full bg-black/75 hover:bg-primary-container text-white hover:text-on-primary flex items-center justify-center transition-colors"
                      >
                        <span className="material-symbols-outlined text-[15px]">zoom_in</span>
                      </button>

                      {/* 썸네일 하단 15% 블랙 그라데이션 */}
                      <div className="absolute inset-x-0 bottom-0 pt-6 pb-2.5 px-3 bg-gradient-to-t from-black/90 via-black/55 to-transparent flex items-center justify-between">
                        <span
                          className={`font-label-sm text-[12px] font-extrabold truncate ${
                            isDuplicateCopy ? 'text-emerald-300' : 'text-primary-container'
                          }`}
                        >
                          {photo.tags[0] || tabMeta.cleanTag}
                        </span>
                        <span className="font-label-sm text-[11px] text-white/85 font-semibold shrink-0 ml-1">
                          {photo.date.split(' ')[0]}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-surface-container/50 border border-outline-variant/25 text-center flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-[#FFAB00] text-[36px]">
                verified
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                이 탭의 추천 정리 대상 사진이 모두 격리되었습니다!
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                아래 [세이씨_정리대기함 격리 보관소]에서 언제든 확인하거나 원본 폴더로 복원할 수 있습니다.
              </span>
            </div>
          )}
        </>
      )}

      {/* 물리 격리 보관소 ([세이씨_정리대기함]) */}
      <div className="mt-2 p-6 rounded-2xl bg-surface-container-lowest/90 border border-outline-variant/30 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-container text-[20px]">
                inventory_2
              </span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                [세이씨_정리대기함] 물리 격리 보관소 ({quarantinedPhotos.length}장)
              </h3>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              실제 <code className="text-primary">D:\SaySee\세이씨_정리대기함</code> 폴더로 이동된 파일입니다.
              클릭 한 번으로 언제든 원래 폴더(<code className="text-primary">test_photos</code>)로 복원할 수 있습니다.
            </p>
          </div>

          {quarantinedPhotos.length > 0 && (
            <button
              type="button"
              disabled={quarantineMoving}
              onClick={() =>
                void restoreFromQuarantine(quarantinedPhotos.map((p) => p.name))
              }
              className="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-bright text-primary font-label-md text-label-md font-bold border border-primary/30 flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span className="material-symbols-outlined text-[18px]">restore_from_trash</span>
              <span>전체 원본 폴더로 복원 ({quarantinedPhotos.length}장)</span>
            </button>
          )}
        </div>

        {quarantinedPhotos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
            {quarantinedPhotos.map((p) => (
              <div
                key={p.id}
                className="group relative rounded-xl overflow-hidden bg-surface-container border border-outline-variant/30"
              >
                <div className="aspect-square w-full overflow-hidden">
                  <img src={p.thumbUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="p-2 flex flex-col gap-1 bg-surface-container-low">
                  <span className="font-label-sm text-[11px] text-on-surface font-bold truncate">
                    {p.tags[0] || '#격리보관중'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void restoreFromQuarantine([p.name])}
                    className="w-full py-1 rounded bg-primary/15 hover:bg-primary/25 text-primary font-label-sm text-[10px] font-bold"
                  >
                    원본 복원
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center font-body-sm text-body-sm text-outline">
            현재 <code className="text-on-surface-variant">세이씨_정리대기함</code> 폴더가 비어 있습니다. 위에서 베스트 컷을 Pick하거나 정리 대상을 격리 이동해 보세요.
          </div>
        )}
      </div>
    </div>
  );
};
