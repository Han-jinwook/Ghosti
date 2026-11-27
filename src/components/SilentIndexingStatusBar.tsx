import React, { useEffect, useMemo, useState } from 'react';
import {
  silentIndexingBrake,
  type SilentIndexingBrakeSnapshot,
} from '../services/silentIndexingBrake';
import { useSaySeeStore } from '../store/useSaySeeStore';
import {
  isSharedPhotoLounge,
  resolveLoungePhotoCorpus,
} from '../store/slices/storeSharedRefs';
import {
  PASSPORT_REG_STATE_EVENT,
  markPassportPrompted,
  openPassportRegistration,
  passportPromptForActivity,
  summarizePassportPending,
  type PassportRegMode,
} from '../services/passportRegistrationFlow';
import { jumpToGhostSecretary } from './GhostSecretaryFirstGuard';

interface SilentIndexingStatusBarProps {
  variant?: 'search-bar' | 'lounge-top';
  className?: string;
}

export const SilentIndexingStatusBar: React.FC<SilentIndexingStatusBarProps> = ({
  variant = 'search-bar',
  className = '',
}) => {
  const [snap, setSnap] = useState<SilentIndexingBrakeSnapshot>(() =>
    silentIndexingBrake.getSnapshot()
  );
  const [passportChipMode, setPassportChipMode] = useState<PassportRegMode | null>(null);
  useEffect(() => {
    if (variant !== 'search-bar') return;
    const check = () => {
      if (isSharedPhotoLounge(useSaySeeStore.getState().activeLoungeType)) return;
      const mode = passportPromptForActivity();
      if (!mode) return;
      markPassportPrompted();
      setPassportChipMode(mode);
    };
    check();
    window.addEventListener(PASSPORT_REG_STATE_EVENT, check);
    return () => window.removeEventListener(PASSPORT_REG_STATE_EVENT, check);
  }, [variant]);

  const {
    activeLoungeType,
    activeFamilyRoom,
    localDocuments,
    photos,
    sharedRoomHostPhotos,
    sharedRoomAddedPhotos,
    videoSceneItems,
    searchSpace,
  } = useSaySeeStore();

  useEffect(() => {
    return silentIndexingBrake.subscribe(setSnap);
  }, []);

  const isTurbo = snap.speedMode === 'turbo';
  const guard = snap.hardwareGuard;
  const sharedMode = isSharedPhotoLounge(activeLoungeType);

  const activePhotos = useMemo(() => {
    const sourcePhotos = resolveLoungePhotoCorpus({
      activeLoungeType,
      activeFamilyRoom,
      photos,
      sharedRoomHostPhotos,
      sharedRoomAddedPhotos,
    });
    return sourcePhotos.filter((p) => !p.quarantined);
  }, [activeLoungeType, activeFamilyRoom, photos, sharedRoomAddedPhotos, sharedRoomHostPhotos]);

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
    () => (sharedMode ? 0 : activePhotos.filter((p) => p.isVaultDocument).length),
    [sharedMode, activePhotos]
  );
  const totalIndexedDocs = (sharedMode ? 0 : localDocuments.length) + vaultPhotoCount;
  const totalVideoCount = sharedMode ? 0 : videoSceneItems.length;
  const totalReadyCount = gallerySceneCount + totalVideoCount + totalIndexedDocs;

  const showPriorityJumpToast =
    searchSpace !== 'video' &&
    snap.lastPriorityJump &&
    Date.now() - snap.lastPriorityJump.timestamp < 8000;

  return (
    <div
      className={`w-full rounded-lg border border-slate-200 bg-white text-slate-700 px-3.5 py-2 flex flex-col gap-1.5 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 w-full">
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] min-w-0">
          <span
            title="내 PC 연결 상태"
            className="inline-flex items-center gap-1.5 font-semibold text-slate-800 shrink-0"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>내 PC 연결됨</span>
          </span>

          <span className="text-slate-300">·</span>
          <span className="text-slate-600">
            전체 {totalReadyCount.toLocaleString('ko-KR')}개 (사진 {gallerySceneCount.toLocaleString('ko-KR')} · 동영상 {totalVideoCount.toLocaleString('ko-KR')} · 문서 {totalIndexedDocs.toLocaleString('ko-KR')})
          </span>

          <span className="text-slate-300">·</span>
          {guard.thermalOrBatteryPaused && guard.pauseReason ? (
            <span className="text-amber-700 font-medium">
              {guard.pauseReason} ({snap.archiveProgressPercent}%)
            </span>
          ) : (
            <span className="text-slate-600">
              <span className="font-medium text-slate-700">
                {isTurbo ? '빠른 정리 중' : '조용한 정리 중'}
              </span>
              <span className="text-slate-400 ml-1">
                {isTurbo
                  ? '(여유 자원을 더 써서 빠르게 정리 · 과열 방지)'
                  : '(다른 작업 방해·소음 없이 천천히 정리)'}
              </span>
            </span>
          )}
        </div>

        <div
          role="group"
          aria-label="정리 속도 선택"
          className="inline-flex items-center rounded-md bg-slate-100 border border-slate-200 p-0.5 shrink-0"
        >
          <button
            type="button"
            aria-pressed={!isTurbo}
            title="조용한 정리: 다른 작업 중 버벅임·팬 소음 없이 천천히 정리합니다 (기본 · CPU 15% 이하)"
            onClick={() => silentIndexingBrake.setSpeedMode('silent')}
            className={`px-2 py-0.5 rounded text-[11.5px] font-medium cursor-pointer whitespace-nowrap transition-colors ${
              !isTurbo
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            조용한 정리
          </button>
          <button
            type="button"
            aria-pressed={isTurbo}
            title="빠른 정리: 컴퓨터 여유 자원을 더 사용해 빠르게 정리합니다 (과열·버벅임 보호 최대 50% 유지)"
            onClick={() => silentIndexingBrake.setSpeedMode('turbo')}
            className={`px-2 py-0.5 rounded text-[11.5px] font-medium cursor-pointer whitespace-nowrap transition-colors ${
              isTurbo
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            빠른 정리
          </button>
        </div>
      </div>

      {showPriorityJumpToast && snap.lastPriorityJump && (
        <div className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-[12px] font-medium text-slate-700">
          &ldquo;{snap.lastPriorityJump.query}&rdquo; 관련 파일 {snap.lastPriorityJump.jumpedCount}건을 먼저 반영했습니다.
        </div>
      )}

      {passportChipMode && !sharedMode && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const mode = passportChipMode;
              setPassportChipMode(null);
              openPassportRegistration(mode);
              jumpToGhostSecretary();
            }}
            className="px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-[12px] font-medium cursor-pointer transition-colors"
          >
            시기별 여권사진 등록
            {(() => {
              const s = summarizePassportPending();
              const n = passportChipMode === 'self' ? s.selfPendingCount : s.familyPendingCount;
              return n > 0 ? ` · ${n}장` : '';
            })()}
          </button>
          <button
            type="button"
            onClick={() => setPassportChipMode(null)}
            aria-label="닫기"
            className="w-6 h-6 rounded-md text-[11px] text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
