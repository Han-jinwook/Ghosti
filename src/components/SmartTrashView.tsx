import React, { useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { TrashCategory } from '../types/saysee';

const TRASH_CATEGORY_META: {
  key: TrashCategory;
  title: string;
  shortBadge: string;
  cleanTag: string;
  subtitle: string;
  icon: string;
  badgeColor: string;
}[] = [
  {
    key: 'duplicate',
    title: '중복 사본 · 연사 (원본 보존)',
    shortBadge: '중복·연사 사본',
    cleanTag: '#중복·연사사본',
    subtitle: '64-bit Perceptual dHash 쌍둥이 검출 • 가장 선명한 원본 1장은 100% 자동 보존',
    icon: 'burst_mode',
    badgeColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-400/35',
  },
  {
    key: 'object',
    title: '주차기둥 · 부품 · 사물 접사',
    shortBadge: '임시메모·사물',
    cleanTag: '#주차·부품메모',
    subtitle: 'Bes2 사물 정책: 주차장 기둥(K13) · 케이블 단자 · 볼트 · 배선 확인용 기록샷',
    icon: 'precision_manufacturing',
    badgeColor: 'text-[#FFAB00] bg-[#FFAB00]/15 border-[#FFAB00]/35',
  },
  {
    key: 'document',
    title: '서류 · 조립설명서 · 스펙표',
    shortBadge: '문서·설명서',
    cleanTag: '#문서·설명서',
    subtitle: '글씨가 빽빽한 인쇄 문서 · 의자 조립 도면 · 여권 사본 · 제품 성분표',
    icon: 'description',
    badgeColor: 'text-tertiary-fixed-dim bg-tertiary-container/20 border-tertiary-container/35',
  },
  {
    key: 'screenshot',
    title: '스마트폰 화면 캡처',
    shortBadge: '화면 캡처',
    cleanTag: '#스크린샷 캡처',
    subtitle: '일회성 앱 화면 · 문자 메시지 캡처 · 모바일 홈 화면',
    icon: 'screenshot_mobile',
    badgeColor: 'text-primary-container bg-primary-container/15 border-primary-container/35',
  },
  {
    key: 'blurry',
    title: '심하게 흔들린 오촬영',
    shortBadge: '흔들린 오촬영',
    cleanTag: '#초점이탈·오촬영',
    subtitle: '보행 중 아스팔트 바닥 물웅덩이 오촬영 · 심한 모션 블러 (인물 사진 100% 보호)',
    icon: 'blur_on',
    badgeColor: 'text-secondary bg-secondary-container/30 border-secondary/35',
  },
];

const fmtMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * 지침 #3 & A3: 대시보드 하단 앰버(#FFAB00) 색상 강조 배너
 * "N장의 사진을 정리하여 구글포토 용량을 확보할 수 있습니다"
 */
export const AmberDietBanner: React.FC<{ onNavigateToTrash?: () => void }> = ({
  onNavigateToTrash,
}) => {
  const { photos, duplicateGroups, moveAllTrashToQuarantine, quarantineMoving, openLocalFolder } =
    useSaySeeStore();

  const activeTrash = photos.filter((p) => p.trashCategory && !p.quarantined);
  const quarantinedTrash = photos.filter((p) => p.quarantined);
  const totalTrashBytes = activeTrash.reduce((a, p) => a + p.size, 0);

  const dupCount = activeTrash.filter((p) => p.trashCategory === 'duplicate').length;
  const objectCount = activeTrash.filter(
    (p) => p.trashCategory === 'object' || p.trashCategory === 'receipt'
  ).length;
  const docCount = activeTrash.filter((p) => p.trashCategory === 'document').length;
  const screenshotCount = activeTrash.filter((p) => p.trashCategory === 'screenshot').length;
  const blurryCount = activeTrash.filter((p) => p.trashCategory === 'blurry').length;

  return (
    <div className="w-full transition-all duration-300">
      <div className="p-5 md:p-6 rounded-2xl bg-surface-container/95 backdrop-blur-2xl border border-[#FFAB00]/45 shadow-[0_0_36px_rgba(255,171,0,0.22)] relative overflow-hidden flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Left Amber (#FFAB00) Neon Glow Bar */}
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
                CLEARMONSTER LITE • ZERO-CLOUD DIET
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
                ? `💡 ${activeTrash.length}장의 사진을 정리하여 구글포토 용량을 확보할 수 있습니다 (${fmtMB(
                    totalTrashBytes
                  )})`
                : `✨ 모든 추천 정리 대상 사진(${quarantinedTrash.length}장)이 [세이씨_정리대기함]으로 안전하게 격리되었습니다!`}
            </h3>

            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {activeTrash.length > 0
                ? `Perceptual dHash & 광학 엔진이 중복·연사 사본 ${dupCount}장(원본 1장씩 완벽 보존), 주차기둥·부품메모 ${objectCount}장, 서류·설명서 ${docCount}장, 스크린샷 ${screenshotCount}장, 흔들린 오촬영 ${blurryCount}장을 정밀 선별했습니다.`
                : `윈도우 탐색기에서 [세이씨_정리대기함] 폴더를 열어 확인한 뒤 통째로 비우거나 언제든 복원할 수 있습니다.`}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-end lg:self-auto pl-2 lg:pl-0">
          {onNavigateToTrash && (
            <button
              onClick={onNavigateToTrash}
              className="px-4 py-2.5 rounded-full bg-surface-container-highest hover:bg-surface-bright text-on-surface font-label-lg text-label-lg font-semibold transition-colors border border-outline-variant/40"
            >
              클리어몬스터 Lite 열기
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

/**
 * [Phase 1-C / 지침 A3]
 * 클리어몬스터 Lite:
 * 1) Bes2 쓰레기 정의 반영 (중복·연사 / 주차기둥·부품 사물접사 / 문서·설명서 / 스크린샷 / 흔들린 오촬영)
 * 2) PC 바둑판(3x3 / 4x4 Grid) Pick UI: [원본 1장 안전하게 보존됨] 초록 배지 + 원클릭 Pick & 나머지 즉시 격리
 * 3) 모바일 심플 카드 뷰 (정보량 다이어트): 파일명/날짜/KB/퍼센트 등 개발자용 텍스트 전면 제거
 */
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
    restoreFromQuarantine,
    openLocalFolder,
    quarantineMoving,
    setSelectedPhoto,
  } = useSaySeeStore();

  const [gridColumns, setGridColumns] = useState<3 | 4>(3);

  const activeTrash = photos.filter((p) => p.trashCategory && !p.quarantined);
  const quarantinedPhotos = photos.filter((p) => p.quarantined);

  const filteredCandidates = activeTrash.filter((p) => {
    if (activeTrashCategoryFilter === 'all') return true;
    if (activeTrashCategoryFilter === 'object') {
      return p.trashCategory === 'object' || p.trashCategory === 'receipt';
    }
    return p.trashCategory === activeTrashCategoryFilter;
  });

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
    (activeTrashCategoryFilter === 'all' || activeTrashCategoryFilter === 'duplicate') &&
    activeDuplicateGroups.length > 0;

  return (
    <div className="flex flex-col gap-6 w-full pb-12">
      {/* Top Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-surface-container-low/80 backdrop-blur-xl border border-[#FFAB00]/30 shadow-lg">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFAB00]/15 border border-[#FFAB00]/30 w-fit">
              <span className="w-2 h-2 rounded-full bg-[#FFAB00] animate-ping" />
              <span className="font-label-mono text-[11px] text-[#FFAB00] font-bold uppercase">
                CLEARMONSTER LITE • D:\SaySee\세이씨_정리대기함
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-label-sm text-[12px] font-extrabold">
              <span className="material-symbols-outlined text-[15px]">verified_user</span>
              <span>[원본 1장 안전하게 보존됨] 자동 보호 중</span>
            </div>
          </div>

          <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight mt-0.5">
            클리어몬스터 Lite • [세이씨_정리대기함]
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            연사·중복 사진은 가장 선명한 <strong>[원본 1장]을 안전하게 남기고</strong> 나머지 사본만 격리하며,
            주차기둥·부품메모·서류·스크린샷·오촬영을 전용 폴더(
            <code className="text-[#FFAB00] font-label-mono">세이씨_정리대기함</code>)로 이동합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => void openLocalFolder('quarantine')}
            className="px-4 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface border border-outline-variant/40 font-label-md text-label-md font-semibold flex items-center gap-2 transition-colors"
          >
            <span className="material-symbols-outlined text-[#FFAB00] text-[18px]">
              folder_special
            </span>
            <span>탐색기에서 정리대기함 열기</span>
          </button>

          <button
            disabled={selectedTrashIds.size === 0 || quarantineMoving}
            onClick={() => void moveSelectedToQuarantine()}
            className="px-5 py-2.5 rounded-xl bg-[#FFAB00] hover:bg-[#FFB724] text-surface-container-lowest font-label-lg text-label-lg font-extrabold shadow-[0_0_24px_rgba(255,171,0,0.45)] flex items-center gap-2 transition-all disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[20px]">drive_file_move</span>
            <span>
              선택된 {selectedTrashIds.size}장 ({fmtMB(selectedBytes)}) 격리 이동
            </span>
          </button>
        </div>
      </div>

      {/* Bento Grid: 5 ClearMonster Lite Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {TRASH_CATEGORY_META.map((cat) => {
          const items = activeTrash.filter((p) =>
            cat.key === 'object'
              ? p.trashCategory === 'object' || p.trashCategory === 'receipt'
              : p.trashCategory === cat.key
          );
          const bytes = items.reduce((a, p) => a + p.size, 0);
          const isSelectedFilter = activeTrashCategoryFilter === cat.key;

          return (
            <div
              key={cat.key}
              onClick={() =>
                setActiveTrashCategoryFilter(isSelectedFilter ? 'all' : cat.key)
              }
              className={`group cursor-pointer rounded-2xl p-4 transition-all flex flex-col justify-between gap-3.5 border ${
                isSelectedFilter
                  ? 'bg-surface-container-high border-[#FFAB00] shadow-[0_0_28px_rgba(255,171,0,0.2)]'
                  : 'bg-surface-container/75 hover:bg-surface-container-high/70 border-outline-variant/25'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-headline-sm text-[15px] text-on-surface font-bold">
                    {cat.title}
                  </span>
                  <span className="font-body-sm text-[11px] text-on-surface-variant leading-snug">
                    {cat.subtitle}
                  </span>
                </div>
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${cat.badgeColor}`}
                >
                  <span className="material-symbols-outlined text-[19px]">{cat.icon}</span>
                </div>
              </div>

              {/* Mini Preview Strip */}
              <div className="flex items-center gap-1.5 h-12">
                {items.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    className="w-11 h-11 rounded-lg overflow-hidden bg-surface-container-lowest border border-outline-variant/30 shrink-0"
                  >
                    <img src={p.thumbUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                {items.length === 0 && (
                  <span className="font-label-mono text-[11px] text-outline">
                    격리 완료 (0장 남음)
                  </span>
                )}
              </div>

              <div className="flex items-baseline justify-between pt-2 border-t border-outline-variant/20">
                <div className="flex items-baseline gap-1">
                  <span className="font-headline-md text-[20px] text-on-surface font-extrabold">
                    {items.length}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">장</span>
                </div>
                <span className="font-label-mono text-[11px] text-[#FFAB00] font-bold">
                  {fmtMB(bytes)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─────────────── [지침 A3] PC 바둑판(3x3 / 4x4 Grid) 중복·연사 원클릭 Pick UI ─────────────── */}
      {showDuplicatePickSection && (
        <div className="p-5 md:p-6 rounded-2xl bg-surface-container/90 border border-emerald-400/35 shadow-[0_0_32px_rgba(16,185,129,0.12)] flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-surface-container-lowest font-label-sm text-[11px] font-black">
                  🛡️ 원본 1장 안전하게 보존됨
                </span>
                <span className="font-label-mono text-[11px] text-emerald-300 font-bold">
                  64-bit Perceptual dHash • 바둑판(Grid) 원클릭 베스트샷 Pick
                </span>
              </div>
              <h2 className="font-headline-sm text-[17px] text-on-surface font-extrabold">
                중복 · 연사 쌍둥이 비교함 ({activeDuplicateGroups.length}개 그룹) — 마음에 드는 1장만 클릭(Pick)하세요!
              </h2>
              <p className="font-body-sm text-[12px] text-on-surface-variant">
                멀쩡한 가족·인물 사진이 왜 정리함에 있냐고요? 똑같은 복사본이 여러 장이기 때문입니다.
                초록색 테두리의 <strong>[원본 1장 안전하게 보존됨]</strong> 사진은 절대 지워지지 않으며, 원하는 사진 1장을 클릭하면 그 사진만 남기고 나머지를 즉시 정리대기함으로 격리합니다.
              </p>
            </div>

            {/* PC 3x3 / 4x4 바둑판 배열 전환 토글 */}
            <div className="flex items-center gap-1.5 bg-surface-container-lowest/80 p-1 rounded-xl border border-outline-variant/30 self-start md:self-auto shrink-0">
              <button
                onClick={() => setGridColumns(3)}
                className={`px-3 py-1.5 rounded-lg font-label-mono text-[11px] font-bold transition-all ${
                  gridColumns === 3
                    ? 'bg-emerald-500 text-surface-container-lowest'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                3×3 바둑판 보기
              </button>
              <button
                onClick={() => setGridColumns(4)}
                className={`px-3 py-1.5 rounded-lg font-label-mono text-[11px] font-bold transition-all ${
                  gridColumns === 4
                    ? 'bg-emerald-500 text-surface-container-lowest'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                4×4 바둑판 보기
              </button>
            </div>
          </div>

          <div
            className={`grid grid-cols-1 ${
              gridColumns === 3 ? 'lg:grid-cols-3' : 'md:grid-cols-2 xl:grid-cols-4'
            } gap-4`}
          >
            {activeDuplicateGroups.map((group, gIdx) => {
              const groupPhotos = group.photoIds
                .map((id) => photoById.get(id))
                .filter((p): p is NonNullable<typeof p> => Boolean(p && !p.quarantined));

              const redundantCount = groupPhotos.filter((p) => p.id !== group.bestPhotoId).length;

              return (
                <div
                  key={group.groupId}
                  className="p-3.5 rounded-2xl bg-surface-container-low/90 border border-outline-variant/30 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-label-mono text-[11px] font-extrabold border border-emerald-400/30">
                        연사·쌍둥이 #{gIdx + 1} ({groupPhotos.length}장)
                      </span>
                      <span className="font-label-sm text-[11px] text-on-surface-variant">
                        원본 1장 보존 • 사본 {redundantCount}장 정리
                      </span>
                    </div>

                    <button
                      disabled={quarantineMoving}
                      onClick={() =>
                        void pickBestInDuplicateGroup(group.groupId, group.bestPhotoId, true)
                      }
                      className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-surface-container-lowest font-label-sm text-[11px] font-extrabold transition-all shadow-sm shrink-0"
                    >
                      나머지 {redundantCount}장 즉시 격리
                    </button>
                  </div>

                  {/* 그룹 내 쌍둥이 사진 나란히 비교 그리드 */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {groupPhotos.map((ph) => {
                      const isBestOriginal = ph.id === group.bestPhotoId;
                      return (
                        <div
                          key={ph.id}
                          onClick={() =>
                            void pickBestInDuplicateGroup(group.groupId, ph.id, true)
                          }
                          className={`group/card relative aspect-[4/5] rounded-xl overflow-hidden cursor-pointer transition-all ${
                            isBestOriginal
                              ? 'ring-2 ring-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                              : 'border border-[#FFAB00]/50 opacity-85 hover:opacity-100 hover:ring-2 hover:ring-emerald-400'
                          }`}
                        >
                          <img
                            src={ph.thumbUrl}
                            alt=""
                            loading="lazy"
                            className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
                          />

                          {/* 상단 직관적 배지 (파일명/용량/날짜 등 지저분한 텍스트 일절 없음) */}
                          {isBestOriginal ? (
                            <div className="absolute top-2 left-2 right-2 px-2 py-1 rounded-lg bg-emerald-500/95 text-surface-container-lowest font-label-sm text-[11px] font-black flex items-center justify-center gap-1 shadow-md">
                              <span className="material-symbols-outlined text-[14px]">
                                verified_user
                              </span>
                              <span>원본 1장 안전하게 보존됨</span>
                            </div>
                          ) : (
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-surface-container-lowest/90 border border-[#FFAB00]/50 text-[#FFAB00] font-label-sm text-[11px] font-extrabold">
                              #중복·연사 사본
                            </div>
                          )}

                          {/* 크게 보기 버튼 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPhoto(ph);
                            }}
                            title="크게 보기"
                            className="absolute bottom-9 right-2 w-7 h-7 rounded-full bg-surface-container-lowest/80 hover:bg-primary-container text-on-surface hover:text-on-primary flex items-center justify-center transition-colors"
                          >
                            <span className="material-symbols-outlined text-[15px]">zoom_in</span>
                          </button>

                          {/* 하단 원클릭 Pick 안내 바 */}
                          <div
                            className={`absolute inset-x-0 bottom-0 px-2 py-1.5 text-center font-label-sm text-[11px] font-bold transition-colors ${
                              isBestOriginal
                                ? 'bg-emerald-950/90 text-emerald-300'
                                : 'bg-surface-container-lowest/90 text-on-surface group-hover/card:bg-emerald-500 group-hover/card:text-surface-container-lowest'
                            }`}
                          >
                            {isBestOriginal
                              ? '✓ 현재 보존 원본 (클릭 시 사본 즉시 격리)'
                              : '👆 클릭 시 이 1장만 남기고 나머지 격리'}
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

      {/* Filter & Selection Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTrashCategoryFilter('all')}
            className={`px-3.5 py-1.5 rounded-full font-label-sm text-label-sm transition-all ${
              activeTrashCategoryFilter === 'all'
                ? 'bg-[#FFAB00] text-surface-container-lowest font-bold'
                : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            전체 정리 대상 ({activeTrash.length})
          </button>
          {TRASH_CATEGORY_META.map((c) => {
            const count = activeTrash.filter((p) =>
              c.key === 'object'
                ? p.trashCategory === 'object' || p.trashCategory === 'receipt'
                : p.trashCategory === c.key
            ).length;
            return (
              <button
                key={c.key}
                onClick={() => setActiveTrashCategoryFilter(c.key)}
                className={`px-3.5 py-1.5 rounded-full font-label-sm text-label-sm transition-all ${
                  activeTrashCategoryFilter === c.key
                    ? 'bg-[#FFAB00] text-surface-container-lowest font-bold'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {c.shortBadge} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={selectAllTrashInFilter}
            className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-primary font-label-sm text-label-sm"
          >
            현재 목록 전체 선택
          </button>
          <button
            onClick={clearTrashSelection}
            className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface-variant font-label-sm text-label-sm"
          >
            선택 해제
          </button>
        </div>
      </div>

      {/* ─────────────── [지침 A3] 모바일 심플 카드 뷰 (정보량 다이어트: 파일명/날짜/용량/퍼센트 전면 제거) ─────────────── */}
      {filteredCandidates.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {filteredCandidates.map((photo) => {
            const isChecked = selectedTrashIds.has(photo.id);
            const catMeta =
              TRASH_CATEGORY_META.find((c) =>
                c.key === 'object' && photo.trashCategory === 'receipt'
                  ? true
                  : c.key === photo.trashCategory
              ) || TRASH_CATEGORY_META[0];
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

                  {/* Top-Left Intuitive Badge (중복 사진일 때는 [원본 1장 안전하게 보존됨] 초록 배지를 최상단에 크게 표시!) */}
                  {isDuplicateCopy ? (
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-emerald-500/95 text-surface-container-lowest flex items-center gap-1 shadow-md">
                      <span className="material-symbols-outlined text-[14px]">verified_user</span>
                      <span className="font-label-sm text-[11px] font-black">
                        원본 1장 안전하게 보존됨
                      </span>
                    </div>
                  ) : (
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-surface-container-lowest/90 backdrop-blur-md flex items-center gap-1.5 border border-[#FFAB00]/35">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FFAB00]" />
                      <span className="font-label-sm text-[11px] font-extrabold text-[#FFAB00]">
                        {catMeta.shortBadge}
                      </span>
                    </div>
                  )}

                  {/* Top-Right Checkbox */}
                  <div
                    className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                      isChecked
                        ? 'bg-[#FFAB00] text-surface-container-lowest font-bold shadow'
                        : 'bg-surface-container-lowest/70 border border-outline text-transparent'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  </div>

                  {/* Zoom Preview Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPhoto(photo);
                    }}
                    title="크게 보기"
                    className="absolute bottom-11 right-2.5 w-7 h-7 rounded-full bg-surface-container-lowest/80 hover:bg-primary-container text-on-surface hover:text-on-primary flex items-center justify-center transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px]">zoom_in</span>
                  </button>

                  {/* Bottom Clean Badge Scrim (복잡한 파일명, 날짜, KB 용량, 퍼센트 수치 전면 제거!) */}
                  <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-surface/95 via-surface/75 to-transparent flex items-center justify-between">
                    <span
                      className={`font-label-sm text-[12px] font-extrabold truncate ${
                        isDuplicateCopy ? 'text-emerald-300' : 'text-primary-container'
                      }`}
                    >
                      {photo.tags[0] || catMeta.cleanTag}
                    </span>
                    <span className="font-label-sm text-[11px] text-on-surface-variant font-semibold">
                      {isDuplicateCopy ? '사본 격리' : '정리 추천'}
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
            이 카테고리의 추천 정리 대상 사진이 모두 격리되었습니다!
          </span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            아래 [세이씨_정리대기함 격리 보관소]에서 언제든 확인하거나 원본 폴더로 복원할 수 있습니다.
          </span>
        </div>
      )}

      {/* Quarantined Files Vault Section (물리 이동 완료된 파일 확인 및 원클릭 복원) */}
      <div className="mt-4 p-6 rounded-2xl bg-surface-container-lowest/90 border border-outline-variant/30 flex flex-col gap-4">
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
            현재 <code className="text-on-surface-variant">세이씨_정리대기함</code> 폴더가 비어 있습니다. 위에서 사진을 선택해 격리 이동해 보세요.
          </div>
        )}
      </div>
    </div>
  );
};
