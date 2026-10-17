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
}[] = [
  {
    key: 'duplicate',
    stepNum: '①',
    title: '동일한 복사본 · 연사',
    shortBadge: '복사본·연사',
    cleanTag: '#중복·연사사본',
    subtitle: '베스트 컷 1장만 클릭(Pick)하면 나머지 연사 사본이 즉시 격리됩니다',
    icon: 'burst_mode',
  },
  {
    key: 'memo',
    stepNum: '②',
    title: '주차장 · 영수증 · 일회성 메모',
    shortBadge: '주차·사물·일회성메모',
    cleanTag: '#주차·부품·일회성메모',
    subtitle: '주차장 기둥(K13) · 케이블/부품 접사 · 단기 택배/현수막 메모',
    icon: 'description',
  },
  {
    key: 'screenshot',
    stepNum: '③',
    title: '스크린샷',
    shortBadge: '스크린샷 캡처',
    cleanTag: '#스크린샷 캡처',
    subtitle: '문자 메시지 캡처 · 모바일 홈 화면 · 일회성 앱 알림 화면 캡처',
    icon: 'screenshot_mobile',
  },
  {
    key: 'blurry',
    stepNum: '④',
    title: '심한 흔들림 · 오촬영',
    shortBadge: '흔들림·오촬영',
    cleanTag: '#초점이탈·오촬영',
    subtitle: '8방향 라플라시안 선명도 붕괴 · 보행 중 바닥 오촬영 및 모션 블러',
    icon: 'blur_on',
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

export const SmartTrashView: React.FC = () => {
  const {
    layout,
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
    setDesktopTab,
    setMobileTab,
    setSearchSpace,
  } = useSaySeeStore();

  const [gridColumns, setGridColumns] = useState<3 | 4>(3);

  const activeTrash = photos.filter((p) => p.trashCategory && !p.quarantined);
  const quarantinedPhotos = photos.filter((p) => p.quarantined);
  const totalTrashBytes = activeTrash.reduce((a, p) => a + p.size, 0);

  const dupCount = activeTrash.filter((p) => matchesTrashTab(p, 'duplicate')).length;
  const memoCount = activeTrash.filter((p) => matchesTrashTab(p, 'memo')).length;
  const screenshotCount = activeTrash.filter((p) => matchesTrashTab(p, 'screenshot')).length;
  const blurryCount = activeTrash.filter((p) => matchesTrashTab(p, 'blurry')).length;
  const memoAndScreenCount = memoCount + screenshotCount;

  // 처치 완료 시 예상 반응 속도 향상률(%) 계산
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
    <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 py-6 flex flex-col gap-5 pb-24">
      {/* ─────────────── [처방 2] 차분하고 정돈된 주치의 종합 진단 박스 (상단 알록달록 3대 배지 삭제 & 1줄 안심 문구로 축소) ─────────────── */}
      <div className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* 좌측 진단 요약 및 1줄 안심 가이드 */}
          <div className="lg:col-span-8 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-label-mono text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
                DIGITAL DOCTOR REPORT · 기기 자체 정밀 진단
              </span>

              {/* 우측: 스마트 서류함 분리 안내만 심플한 무채색 링크로 유지 */}
              <button
                type="button"
                onClick={() => {
                  setSearchSpace('vault');
                  if (layout === 'mobile') setMobileTab('search');
                  else setDesktopTab('dashboard');
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-zinc-200 font-label-sm text-[11.5px] font-medium transition-colors"
              >
                📁 신분증·조립설명서는 [스마트 서류함]에 안전 분리됨 →
              </button>
            </div>

            <h1 className="font-headline-md text-[18px] md:text-[21px] text-white font-bold leading-snug tracking-tight">
              {activeTrash.length > 0 ? (
                <>
                  🩺 진단 결과: 중복·연사 사본 <span className="text-primary-container">{dupCount}장</span>, 흔들린 사진{' '}
                  <span className="text-white">{blurryCount}장</span>, 일회성 메모·캡처{' '}
                  <span className="text-white">{memoAndScreenCount}장</span>{' '}
                  <span className="text-zinc-400 font-normal text-[16px]">
                    (총 {fmtMB(totalTrashBytes)} 낭비 중)
                  </span>
                  <span className="block text-[14.5px] md:text-[15.5px] text-primary-container font-semibold mt-1">
                    ➔ 처치 완료 시 기기 탐색 및 인덱싱 반응 속도 약 +{expectedSpeedBoostPct}% 향상 예상
                  </span>
                </>
              ) : (
                <span className="text-primary-container">
                  ✨ 주치의 처치 완료! 모든 중복·흔들림·일회성 메모({quarantinedPhotos.length}장)가 안전하게 정리되어 최적(98점) 상태입니다.
                </span>
              )}
            </h1>

            {/* 3중 안전망 장문 박스 축소 ➔ 차분한 1줄 보조 텍스트 */}
            <p className="font-body-sm text-[12.5px] text-zinc-400 pt-0.5">
              🛡️ 정리된 파일은 영구 삭제되지 않으며 <strong className="text-zinc-200">[30일 대기함]</strong> 및 하단{' '}
              <strong className="text-zinc-200">[1초 되돌리기(Undo)]</strong>로 언제든 즉시 복구됩니다.
            </p>
          </div>

          {/* 우측 반응 속도 게이지 & 일괄 처치 액션 (다크 슬레이트 톤) */}
          <div className="lg:col-span-4 p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-[12px] text-zinc-400 font-medium">
                기기 탐색·인덱싱 반응 속도
              </span>
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-primary-container font-label-mono text-[11px] font-bold">
                {activeTrash.length > 0 ? `+${expectedSpeedBoostPct}% 향상 예상` : '최적 가속 완료'}
              </span>
            </div>

            <div className="w-full h-2.5 rounded-full bg-zinc-900 overflow-hidden flex border border-white/10">
              <div
                style={{ width: `${currentHealthScore}%` }}
                className="h-full bg-primary-container transition-all duration-500"
              />
              {activeTrash.length > 0 && (
                <div
                  style={{ width: `${100 - currentHealthScore}%` }}
                  className="h-full bg-zinc-700"
                />
              )}
            </div>

            <div className="flex items-center justify-between font-label-mono text-[11px] text-zinc-400">
              <span>현재 상태: {currentHealthScore}점</span>
              <span className="text-zinc-200 font-semibold">처치 후: 98점 (쾌적)</span>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => void openLocalFolder('quarantine')}
                className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 font-label-sm text-[12px] font-medium shrink-0"
              >
                📂 대기함 열기
              </button>

              <button
                type="button"
                disabled={activeTrash.length === 0 || quarantineMoving}
                onClick={() => void moveAllTrashToQuarantine()}
                className="flex-1 py-2 px-3 rounded-lg bg-primary-container hover:opacity-95 text-zinc-950 font-label-md text-[12.5px] font-extrabold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
              >
                <span>⚡ 원본 남기고 {activeTrash.length}장 일괄 처치</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────── 인라인 1초 되돌리기(Undo) 바 ─────────────── */}
      {lastUndoBatch && (
        <div className="p-3.5 rounded-xl bg-zinc-900 border border-primary-container/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary-container text-[20px]">
              history
            </span>
            <span className="font-label-md text-[13px] text-zinc-100 font-semibold">
              방금 정리한 {lastUndoBatch.count}장 ({fmtMB(lastUndoBatch.savedBytes)})이 [30일 대기함]으로 안전 격리되었습니다.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void undoLastQuarantine()}
              className="px-3.5 py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold transition-all"
            >
              ↩️ 1초 즉시 되돌리기 (Undo)
            </button>
            <button
              type="button"
              onClick={dismissUndoBatch}
              className="p-1 text-zinc-400 hover:text-white"
              title="닫기"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>
      )}

      {/* ─────────────── 스마트 정리 4대 탭 네비게이션 카드 (다크 슬레이트 톤 + 활성 탭 단일 포인트) ─────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {TRASH_TABS.map((tab) => {
          const items = activeTrash.filter((p) => matchesTrashTab(p, tab.key));
          const bytes = items.reduce((a, p) => a + p.size, 0);
          const isSelected = currentTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTrashCategoryFilter(tab.key as TrashCategory)}
              className={`group text-left cursor-pointer rounded-2xl p-4 transition-all flex flex-col justify-between gap-3 border ${
                isSelected
                  ? 'bg-zinc-900 border-primary-container'
                  : 'bg-[#18181B] hover:bg-zinc-900/70 border-white/10'
              }`}
            >
              <div className="flex items-start justify-between gap-2 w-full">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-headline-sm text-[14.5px] text-primary-container font-bold">
                      {tab.stepNum}
                    </span>
                    <span className="font-headline-sm text-[15px] text-white font-bold">
                      {tab.title}
                    </span>
                  </div>
                  <span className="font-body-sm text-[11.5px] text-zinc-400 leading-snug">
                    {tab.subtitle}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-white/10 flex items-center justify-center shrink-0 text-zinc-300">
                  <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                </div>
              </div>

              {/* 미니 썸네일 스트립 */}
              <div className="flex items-center gap-1.5 h-11">
                {items.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-950 border border-white/10 shrink-0"
                  >
                    <img src={p.thumbUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                {items.length > 4 && (
                  <span className="font-label-mono text-[11px] text-zinc-400 pl-1">
                    +{items.length - 4}
                  </span>
                )}
                {items.length === 0 && (
                  <span className="font-label-mono text-[11px] text-zinc-500">
                    격리 완료 (0장 남음)
                  </span>
                )}
              </div>

              <div className="flex items-baseline justify-between pt-2 border-t border-white/10 w-full">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-headline-md text-[19px] text-white font-bold">
                    {items.length}
                  </span>
                  <span className="font-label-sm text-[12px] text-zinc-400">장</span>
                  {tab.key === 'duplicate' && activeDuplicateGroups.length > 0 && (
                    <span className="ml-1 text-[11px] text-zinc-400 font-medium">
                      · {activeDuplicateGroups.length}개 묶음
                    </span>
                  )}
                </div>
                <span className="font-label-mono text-[11px] text-zinc-400 font-semibold">
                  {fmtMB(bytes)}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ─────────────── ① 동일한 복사본·연사 탭: PC 3×3 / 4×4 바둑판(Grid) 원클릭 Pick UI (중복 초록 배지 제거 & 다크 슬레이트 통일) ─────────────── */}
      {showDuplicatePickSection && (
        <div className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-bold">
                ① 동일한 복사본 · 연사 바둑판 비교 ({activeDuplicateGroups.length}개 묶음)
              </h2>
              <p className="font-body-sm text-[12.5px] text-zinc-400">
                가장 표정·구도가 좋은 <strong className="text-zinc-200">베스트 컷 1장을 클릭(Pick)</strong>하면 그 1장은 안전하게 보존되고 나머지 연사 사본만 대기함으로 정리됩니다.
              </p>
            </div>

            {/* PC 3x3 / 4x4 바둑판 배열 전환 토글 */}
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-white/10 self-start md:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setGridColumns(3)}
                className={`px-3 py-1.5 rounded-lg font-label-sm text-[12px] font-bold transition-all flex items-center gap-1.5 ${
                  gridColumns === 3
                    ? 'bg-primary-container text-zinc-950 font-extrabold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">grid_on</span>
                <span>3×3 배열</span>
              </button>
              <button
                type="button"
                onClick={() => setGridColumns(4)}
                className={`px-3 py-1.5 rounded-lg font-label-sm text-[12px] font-bold transition-all flex items-center gap-1.5 ${
                  gridColumns === 4
                    ? 'bg-primary-container text-zinc-950 font-extrabold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">apps</span>
                <span>4×4 배열</span>
              </button>
            </div>
          </div>

          {/* 각 연사/중복 묶음별 바둑판(Grid) — 군더더기 중복 배지 제거 후 깔끔한 제목만 노출 */}
          <div className="flex flex-col gap-4">
            {activeDuplicateGroups.map((group, gIdx) => {
              const groupPhotos = group.photoIds
                .map((id) => photoById.get(id))
                .filter((p): p is NonNullable<typeof p> => Boolean(p && !p.quarantined));

              const redundantCount = groupPhotos.filter((p) => p.id !== group.bestPhotoId).length;
              const repPhoto = groupPhotos[0];
              const sceneLabel =
                repPhoto?.tags.find((t) => !t.includes('연사') && !t.includes('원본')) || '#연사묶음';

              return (
                <div
                  key={group.groupId}
                  className="p-4 md:p-5 rounded-xl bg-zinc-950/70 border border-white/10 flex flex-col gap-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-headline-sm text-[15px] text-white font-bold">
                        연사·중복 묶음 #{gIdx + 1} ({groupPhotos.length}장 연사)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[11.5px] font-medium">
                        {sceneLabel}
                      </span>
                      {repPhoto?.locationKo && (
                        <span className="font-body-sm text-[12px] text-zinc-400">
                          📍 {repPhoto.locationKo} · {repPhoto.date.split(' ')[0]}
                        </span>
                      )}
                    </div>

                    <button
                      disabled={quarantineMoving}
                      onClick={() =>
                        void pickBestInDuplicateGroup(group.groupId, group.bestPhotoId, true)
                      }
                      className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-primary-container text-zinc-100 hover:text-zinc-950 border border-white/10 font-label-sm text-[12px] font-bold transition-all flex items-center gap-1.5 shrink-0"
                    >
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      <span>베스트 1장만 남기고 사본 {redundantCount}장 정리</span>
                    </button>
                  </div>

                  {/* 연사 장수에 맞춰 펼쳐지는 바둑판(Grid) */}
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
                          className={`group/card relative aspect-[4/5] rounded-xl overflow-hidden cursor-pointer transition-all ${
                            isBestOriginal
                              ? 'ring-2 ring-primary-container border border-primary-container'
                              : 'border border-white/10 opacity-90 hover:opacity-100 hover:border-white/30'
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
                            <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-zinc-950/90 backdrop-blur-md border border-primary-container text-primary-container font-label-sm text-[11px] font-bold flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">
                                verified_user
                              </span>
                              <span>보존할 베스트 컷 (Best)</span>
                            </div>
                          ) : (
                            <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-zinc-950/80 backdrop-blur-md border border-white/15 text-zinc-300 font-label-sm text-[11px] font-medium">
                              연사 #{idx + 1} · 사본 정리 후보
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
                            className="absolute bottom-10 right-2.5 w-7 h-7 rounded-full bg-black/75 hover:bg-primary-container text-white hover:text-zinc-950 flex items-center justify-center transition-colors z-10"
                          >
                            <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                          </button>

                          {/* 하단 안내 바 */}
                          <div
                            className={`absolute inset-x-0 bottom-0 pt-5 pb-2 px-3 text-center font-label-sm text-[11.5px] font-semibold transition-all bg-gradient-to-t ${
                              isBestOriginal
                                ? 'from-black/95 via-black/75 to-transparent text-primary-container'
                                : 'from-black/95 via-black/75 to-transparent text-zinc-300 group-hover/card:text-white'
                            }`}
                          >
                            {isBestOriginal
                              ? '✓ 현재 보존 중인 베스트 컷 (클릭 시 사본 격리)'
                              : '👆 클릭 시 이 사진을 베스트 컷으로 변경'}
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
          <div className="flex flex-wrap items-center justify-between gap-3 px-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {TRASH_TABS.map((t) => {
                const count = activeTrash.filter((p) => matchesTrashTab(p, t.key)).length;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTrashCategoryFilter(t.key as TrashCategory)}
                    className={`px-3 py-1.5 rounded-lg font-label-sm text-[12px] border transition-all ${
                      currentTab === t.key
                        ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                        : 'bg-[#18181B] text-zinc-400 hover:text-white border-white/10'
                    }`}
                  >
                    {t.stepNum} {t.title} ({count})
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setActiveTrashCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-label-sm text-[12px] border transition-all ${
                  currentTab === 'all'
                    ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                    : 'bg-[#18181B] text-zinc-400 hover:text-white border-white/10'
                }`}
              >
                전체 보기 ({activeTrash.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllTrashInFilter}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[12px] font-medium"
              >
                전체 선택
              </button>
              <button
                type="button"
                onClick={clearTrashSelection}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 font-label-sm text-[12px]"
              >
                선택 해제
              </button>
              <button
                type="button"
                disabled={selectedTrashIds.size === 0 || quarantineMoving}
                onClick={() => void moveSelectedToQuarantine()}
                className="px-3.5 py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold disabled:opacity-40"
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

                return (
                  <div
                    key={photo.id}
                    onClick={() => toggleTrashSelection(photo.id)}
                    className={`group relative rounded-xl overflow-hidden bg-[#18181B] transition-all cursor-pointer border ${
                      isChecked
                        ? 'border-primary-container ring-1 ring-primary-container'
                        : 'border-white/10 opacity-90 hover:opacity-100'
                    }`}
                  >
                    <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-950">
                      <img
                        src={photo.thumbUrl}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-zinc-950/85 backdrop-blur-md border border-white/15">
                        <span className="font-label-sm text-[10.5px] font-semibold text-zinc-200">
                          {tabMeta.shortBadge}
                        </span>
                      </div>

                      <div
                        className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-primary-container text-zinc-950 font-bold'
                            : 'bg-black/60 border border-white/20 text-transparent'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">check</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPhoto(photo);
                        }}
                        title="크게 보기"
                        className="absolute bottom-10 right-2.5 w-7 h-7 rounded-full bg-black/75 hover:bg-primary-container text-white hover:text-zinc-950 flex items-center justify-center transition-colors"
                      >
                        <span className="material-symbols-outlined text-[15px]">zoom_in</span>
                      </button>

                      <div className="absolute inset-x-0 bottom-0 pt-5 pb-2 px-3 bg-gradient-to-t from-black/90 via-black/55 to-transparent flex items-center justify-between">
                        <span className="font-label-sm text-[11.5px] font-semibold truncate text-zinc-200">
                          {photo.tags[0] || tabMeta.cleanTag}
                        </span>
                        <span className="font-label-sm text-[11px] text-zinc-400 shrink-0 ml-1">
                          {photo.date.split(' ')[0]}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-[#18181B] border border-white/10 text-center flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-primary-container text-[32px]">
                verified
              </span>
              <span className="font-headline-sm text-[15px] text-white font-bold">
                이 탭의 추천 정리 대상 사진이 모두 격리되었습니다!
              </span>
              <span className="font-body-sm text-[12.5px] text-zinc-400">
                아래 [세이씨_정리대기함 격리 보관소]에서 언제든 확인하거나 원본 폴더로 복원할 수 있습니다.
              </span>
            </div>
          )}
        </>
      )}

      {/* 물리 격리 보관소 ([세이씨_정리대기함]) */}
      <div className="mt-1 p-5 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-zinc-400 text-[19px]">
                inventory_2
              </span>
              <h3 className="font-headline-sm text-[15.5px] text-white font-bold">
                [세이씨_정리대기함] 30일 안전 보관소 ({quarantinedPhotos.length}장)
              </h3>
            </div>
            <p className="font-body-sm text-[12px] text-zinc-400">
              실제 <code className="text-zinc-200">D:\SaySee\세이씨_정리대기함</code> 폴더로 이동된 파일입니다. 클릭 한 번으로 언제든 원래 폴더로 복원할 수 있습니다.
            </p>
          </div>

          {quarantinedPhotos.length > 0 && (
            <button
              type="button"
              disabled={quarantineMoving}
              onClick={() =>
                void restoreFromQuarantine(quarantinedPhotos.map((p) => p.name))
              }
              className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-primary-container font-label-sm text-[12px] font-bold border border-white/10 flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span className="material-symbols-outlined text-[16px]">restore_from_trash</span>
              <span>전체 원본 폴더로 복원 ({quarantinedPhotos.length}장)</span>
            </button>
          )}
        </div>

        {quarantinedPhotos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
            {quarantinedPhotos.map((p) => (
              <div
                key={p.id}
                className="group relative rounded-xl overflow-hidden bg-zinc-950 border border-white/10"
              >
                <div className="aspect-square w-full overflow-hidden">
                  <img src={p.thumbUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="p-2 flex flex-col gap-1 bg-zinc-900">
                  <span className="font-label-sm text-[11px] text-zinc-200 font-semibold truncate">
                    {p.tags[0] || '#격리보관중'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void restoreFromQuarantine([p.name])}
                    className="w-full py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-primary-container font-label-sm text-[10px] font-bold"
                  >
                    원본 복원
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-5 text-center font-body-sm text-[12.5px] text-zinc-500">
            현재 <code className="text-zinc-400">세이씨_정리대기함</code> 폴더가 비어 있습니다.
          </div>
        )}
      </div>
    </div>
  );
};
