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
      className={`w-full rounded-xl border transition-all ${
        isTurbo
          ? 'bg-amber-500/10 border-amber-400/30 text-zinc-100'
          : 'bg-zinc-900/70 border-white/10 text-zinc-300'
      } px-3 py-1.5 flex flex-col gap-1.5 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
          <span className="font-bold text-emerald-300">
            ⚡ 최근 3개월 준비 완료 ({recentCountFormatted}개)
          </span>
          <span className="text-zinc-600">·</span>
          {guard.thermalOrBatteryPaused && guard.pauseReason ? (
            <span className="text-amber-300 font-semibold">
              🌡️ {guard.pauseReason} ({snap.archiveProgressPercent}%)
            </span>
          ) : (
            <span className="text-zinc-400">
              {isTurbo ? '⚡ 고속 정리 중' : '🍃 백그라운드 정리 중'} ({snap.archiveProgressPercent}%)
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => silentIndexingBrake.toggleSpeedMode()}
          className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold cursor-pointer whitespace-nowrap transition-all ${
            isTurbo
              ? 'bg-emerald-400/20 hover:bg-emerald-400/30 border border-emerald-400/40 text-emerald-200'
              : 'bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-200'
          }`}
        >
          {isTurbo ? '🍃 무소음 전환' : '⚡ 고속 정리'}
        </button>
      </div>

      {showPriorityJumpToast && snap.lastPriorityJump && (
        <div className="px-2 py-0.5 rounded bg-primary-container/15 text-[11px] text-primary-container">
          🎯 &ldquo;{snap.lastPriorityJump.query}&rdquo; 과거 파일({snap.lastPriorityJump.jumpedCount}개) 우선 검색 반영됨
        </div>
      )}
    </div>
  );
};
