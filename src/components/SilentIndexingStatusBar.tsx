import React, { useEffect, useMemo, useState } from 'react';
import {
  silentIndexingBrake,
  type SilentIndexingBrakeSnapshot,
} from '../services/silentIndexingBrake';
import { useSaySeeStore } from '../store/useSaySeeStore';

interface SilentIndexingStatusBarProps {
  variant?: 'search-bar' | 'lounge-top';
  className?: string;
}

/**
 * 🛡️ 무박스 1줄 안심 상태바 + 설치 직후 실시간 찾아낸 내 파일명 인라인 브리핑 (클릭 시 즉시 검색)
 * - 별도의 복잡한 프리뷰 카드 그리드나 팝업 박스를 늘리지 않고,
 *   기존 1줄 상태바 안에서 방금 준비된 내 PC 최근 문서·사진 파일명 1~2개를 바로 보여주며 클릭 시 즉시 검색 실행
 */
export const SilentIndexingStatusBar: React.FC<SilentIndexingStatusBarProps> = ({
  className = '',
}) => {
  const [snap, setSnap] = useState<SilentIndexingBrakeSnapshot>(() =>
    silentIndexingBrake.getSnapshot()
  );
  const { localDocuments, photos, videoSceneItems, runTextQuery } = useSaySeeStore();

  useEffect(() => {
    return silentIndexingBrake.subscribe(setSnap);
  }, []);

  const isTurbo = snap.speedMode === 'turbo';
  const guard = snap.hardwareGuard;

  const activePhotos = useMemo(() => photos.filter((p) => !p.quarantined), [photos]);
  const gallerySceneCount = useMemo(
    () =>
      activePhotos.filter(
        (p) =>
          !p.isVaultDocument &&
          p.trashCategory !== 'blurry' &&
          p.trashCategory !== 'screenshot' &&
          p.trashCategory !== 'memo' &&
          p.trashCategory !== 'duplicate'
      ).length,
    [activePhotos]
  );
  const vaultPhotoCount = useMemo(
    () => activePhotos.filter((p) => p.isVaultDocument).length,
    [activePhotos]
  );
  const totalIndexedDocs = localDocuments.length + vaultPhotoCount;
  const totalVideoCount = videoSceneItems.length;
  const totalReadyCount = gallerySceneCount + totalVideoCount + totalIndexedDocs;

  // 내 PC에서 방금 선행 분석된 최근 문서 1개 + 최근 사진 1개 추출 (무박스 1줄 인라인 브리핑용)
  const recentInlineFiles = useMemo(() => {
    const items: { label: string; query: string; icon: string }[] = [];
    if (localDocuments.length > 0) {
      const topDoc = localDocuments[0];
      const cleanName = topDoc.fileName || topDoc.title;
      const shortQuery = cleanName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      items.push({
        label: cleanName,
        query: shortQuery || cleanName,
        icon: '📄',
      });
    }
    const activePhotos = photos.filter((p) => !p.quarantined);
    if (activePhotos.length > 0) {
      const topPhoto = activePhotos[0];
      const tagKeyword = topPhoto.tags?.[0]?.replace(/^#/, '') || topPhoto.name.replace(/\.[^.]+$/, '');
      items.push({
        label: topPhoto.name,
        query: tagKeyword,
        icon: '🖼️',
      });
    }
    return items.slice(0, 2);
  }, [localDocuments, photos]);

  const showPriorityJumpToast =
    snap.lastPriorityJump && Date.now() - snap.lastPriorityJump.timestamp < 25000;

  return (
    <div
      className={`w-full rounded-xl border transition-all overflow-hidden ${
        isTurbo
          ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-400/30 text-slate-900 dark:text-zinc-100 shadow-xs'
          : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-800 dark:text-zinc-200 shadow-xs'
      } px-3.5 py-2 flex flex-col gap-1.5 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 w-full">
        <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] min-w-0">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('openZCoreGuideModal'))}
            title="내 PC 연결 상태 및 전체 인덱싱 상세 보기"
            className="font-extrabold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer shrink-0"
          >
            🟢 방금 내 PC에서
          </button>

          {recentInlineFiles.map((f, idx) => (
            <React.Fragment key={f.label}>
              <button
                type="button"
                onClick={() => void runTextQuery(f.query)}
                title={`클릭 시 "${f.query}" 즉시 검색`}
                className="px-2 py-0.5 rounded-md bg-teal-500/15 hover:bg-teal-400 hover:text-zinc-950 border border-teal-400/40 text-teal-800 dark:text-teal-200 font-mono text-[11.5px] font-extrabold transition-all cursor-pointer truncate max-w-[210px]"
              >
                {f.icon} {f.label}
              </button>
              {idx < recentInlineFiles.length - 1 && (
                <span className="text-slate-400 dark:text-zinc-500">·</span>
              )}
            </React.Fragment>
          ))}

          <span className="font-extrabold text-slate-700 dark:text-zinc-200">
            포함 보유 파일 총 {totalReadyCount.toLocaleString('ko-KR')}개(사진 {gallerySceneCount.toLocaleString('ko-KR')} · 동영상 {totalVideoCount.toLocaleString('ko-KR')} · 문서 {totalIndexedDocs.toLocaleString('ko-KR')}) 준비 완료! 지금 바로 찾아보세요
          </span>

          <span className="text-slate-400 dark:text-zinc-600">·</span>
          {guard.thermalOrBatteryPaused && guard.pauseReason ? (
            <span className="text-amber-700 dark:text-amber-300 font-bold">
              🌡️ {guard.pauseReason} ({snap.archiveProgressPercent}%)
            </span>
          ) : (
            <span className="text-slate-500 dark:text-zinc-400 font-semibold text-[12px]">
              {isTurbo ? '⚡ 고속 인덱싱 가드 가동 중' : '🍃 무소음 하드웨어 보호 가동 중'}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => silentIndexingBrake.toggleSpeedMode()}
          className={`px-3 py-1 rounded-lg text-[12px] font-extrabold cursor-pointer whitespace-nowrap shrink-0 transition-all ${
            isTurbo
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-slate-300 dark:border-white/15 text-slate-800 dark:text-zinc-100'
          }`}
        >
          {isTurbo ? '🍃 무소음 전환' : '⚡ 고속 정리'}
        </button>
      </div>

      {showPriorityJumpToast && snap.lastPriorityJump && (
        <div className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-primary-container/15 border border-teal-200 dark:border-primary-container/30 text-[12.5px] font-bold text-teal-800 dark:text-primary-container">
          🎯 &ldquo;{snap.lastPriorityJump.query}&rdquo; 과거 파일({snap.lastPriorityJump.jumpedCount}개) 우선 검색 반영됨
        </div>
      )}
    </div>
  );
};
