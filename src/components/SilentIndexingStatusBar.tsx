import React, { useEffect, useState } from 'react';
import {
  silentIndexingBrake,
  type SilentIndexingBrakeSnapshot,
} from '../services/silentIndexingBrake';

interface SilentIndexingStatusBarProps {
  variant?: 'search-bar' | 'lounge-top';
  className?: string;
}

export const SilentIndexingStatusBar: React.FC<SilentIndexingStatusBarProps> = ({
  className = '',
}) => {
  const [snap, setSnap] = useState<SilentIndexingBrakeSnapshot>(() =>
    silentIndexingBrake.getSnapshot()
  );

  useEffect(() => {
    return silentIndexingBrake.subscribe(setSnap);
  }, []);

  const isTurbo = snap.speedMode === 'turbo';
  const guard = snap.hardwareGuard;
  const recentCountFormatted = snap.recent3MonthsCount.toLocaleString('ko-KR');

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
        <div className="flex flex-wrap items-center gap-2 text-[13px] min-w-0">
          <span className="font-extrabold text-emerald-700 dark:text-emerald-300">
            ⚡ 최근 3개월 준비 완료 ({recentCountFormatted}개)
          </span>
          <span className="text-slate-400 dark:text-zinc-600">·</span>
          {guard.thermalOrBatteryPaused && guard.pauseReason ? (
            <span className="text-amber-700 dark:text-amber-300 font-bold">
              🌡️ {guard.pauseReason} ({snap.archiveProgressPercent}%)
            </span>
          ) : (
            <span className="text-slate-600 dark:text-zinc-300 font-semibold">
              {isTurbo ? '⚡ 고속 정리 중' : '🍃 백그라운드 정리 중'} ({snap.archiveProgressPercent}%)
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => silentIndexingBrake.toggleSpeedMode()}
          className={`px-3 py-1 rounded-lg text-[12.5px] font-extrabold cursor-pointer whitespace-nowrap shrink-0 transition-all ${
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
