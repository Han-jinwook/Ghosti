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
  variant = 'search-bar',
  className = '',
}) => {
  const [snap, setSnap] = useState<SilentIndexingBrakeSnapshot>(() =>
    silentIndexingBrake.getSnapshot()
  );
  const [showHardwareDetail, setShowHardwareDetail] = useState(false);

  useEffect(() => {
    return silentIndexingBrake.subscribe(setSnap);
  }, []);

  const isTurbo = snap.speedMode === 'turbo';
  const guard = snap.hardwareGuard;
  const recentCountFormatted = snap.recent3MonthsCount.toLocaleString('ko-KR');
  const archiveTotalFormatted = snap.archiveTotalCount.toLocaleString('ko-KR');

  const showPriorityJumpToast =
    snap.lastPriorityJump && Date.now() - snap.lastPriorityJump.timestamp < 25000;

  return (
    <div
      className={`w-full rounded-xl border transition-all ${
        isTurbo
          ? 'bg-amber-500/10 border-amber-400/35 text-zinc-100'
          : 'bg-zinc-900/85 dark:bg-zinc-900/90 border-emerald-500/25 text-zinc-200'
      } px-3.5 py-2.5 flex flex-col gap-2 ${className}`}
    >
      {/* 1단: 핵심 안심 상태 메시지 2줄 + 진행률 바 + 우측 [⚡ 지금 전체 고속 정리] ⇄ [🍃 무소음 모드로 전환] 양방향 버튼 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-3 gap-y-1 text-[12px] leading-snug">
          <span className="inline-flex items-center gap-1.5 font-extrabold text-emerald-300 whitespace-nowrap">
            <span>⚡ 최근 3개월 파일 검색 준비 완료 ({recentCountFormatted}개)</span>
            <span className="text-[11px] font-semibold text-zinc-400">
              · 전체 파일명·연도 1초 검색 개방됨
            </span>
          </span>

          <span className="hidden sm:inline text-zinc-600">|</span>

          {guard.thermalOrBatteryPaused && guard.pauseReason ? (
            <span className="text-amber-300 font-semibold">
              🌡️ {guard.pauseReason} ({snap.archiveProgressPercent}%)
            </span>
          ) : isTurbo ? (
            <span className="text-amber-200 font-semibold">
              ⚡ 이전 파일({archiveTotalFormatted}개) 고속 정리 중 — 하드웨어 보호 안전망(코어 50%·RAM 500MB 상한) 적용 ({snap.archiveProgressPercent}%)
            </span>
          ) : (
            <span className="text-zinc-300">
              🍃 기기 발열과 배터리를 위해 이전 파일({archiveTotalFormatted}개)은 PC가 쉴 때 조용히 정리 중입니다 (
              <strong className="text-emerald-300 font-extrabold">
                {snap.archiveProgressPercent}%
              </strong>
              )
            </span>
          )}
        </div>

        {/* 우측: 진행률 미니 게이지 + 하드웨어 안전망 토글 + [⚡ 지금 전체 고속 정리] 버튼 */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            className="w-20 h-1.5 rounded-full bg-zinc-800 overflow-hidden hidden xl:block"
            title={`과거 파일 정리 진행률 ${snap.archiveProgressPercent}%`}
          >
            <div
              className={`h-full transition-all duration-500 ${
                isTurbo ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${snap.archiveProgressPercent}%` }}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowHardwareDetail((prev) => !prev)}
            className="px-2 py-1 rounded-lg bg-zinc-950/80 hover:bg-zinc-800 border border-white/10 text-[11px] font-semibold text-zinc-300 cursor-pointer whitespace-nowrap transition-colors"
            title="밑바닥 하드웨어 보호 4대 기본 알고리즘 작동 상태 보기"
          >
            🛡️ CPU {guard.currentCpuPercent}% · RAM {guard.currentRamMB}MB
          </button>

          <button
            type="button"
            onClick={() => silentIndexingBrake.toggleSpeedMode()}
            className={`px-2.5 py-1 rounded-lg text-[11.5px] font-extrabold cursor-pointer whitespace-nowrap transition-all ${
              isTurbo
                ? 'bg-emerald-400/20 hover:bg-emerald-400/30 border border-emerald-400/50 text-emerald-200'
                : 'bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/45 text-amber-300'
            }`}
          >
            {isTurbo ? '🍃 무소음 모드로 전환' : '⚡ 지금 전체 고속 정리'}
          </button>
        </div>
      </div>

      {/* [레드팀 보완 1] 유저가 옛날 연도/키워드 검색 시 즉시 새치기(Priority Jump) 안내 */}
      {showPriorityJumpToast && snap.lastPriorityJump && (
        <div className="px-2.5 py-1 rounded-lg bg-primary-container/15 border border-primary-container/35 text-[11.5px] text-primary-container flex items-center justify-between gap-2">
          <span>
            🎯 방금 검색하신 <strong>&ldquo;{snap.lastPriorityJump.query}&rdquo;</strong> 관련 과거 파일(
            {snap.lastPriorityJump.jumpedCount}개)은 대기열 맨 앞으로 새치기하여 즉시 검색 결과에 반영했습니다.
          </span>
        </div>
      )}

      {/* 밑바닥 하드웨어 보호 4대 안전망 상세 브리핑 (클릭 시 펼침) */}
      {showHardwareDetail && (
        <div className="pt-2 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px] text-zinc-300">
          <div className="px-2.5 py-1.5 rounded-lg bg-zinc-950/90 border border-white/10 flex flex-col gap-0.5">
            <span className="text-emerald-300 font-bold">
              ① 스레드 우선순위 최하위 고정
            </span>
            <span className="text-zinc-400">
              <code>THREAD_PRIORITY_BELOW_NORMAL</code> 강제 (마우스·크롬·유튜브 지연 0%)
            </span>
          </div>

          <div className="px-2.5 py-1.5 rounded-lg bg-zinc-950/90 border border-white/10 flex flex-col gap-0.5">
            <span className="text-emerald-300 font-bold">
              ② CPU 코어 50% 상한 캡
            </span>
            <span className="text-zinc-400">
              전체 {guard.totalLogicalCores}코어 중 최대 {guard.allowedIndexingCores}코어만 사용 (현재 {guard.currentCpuPercent}%)
            </span>
          </div>

          <div className="px-2.5 py-1.5 rounded-lg bg-zinc-950/90 border border-white/10 flex flex-col gap-0.5">
            <span className="text-emerald-300 font-bold">
              ③ 메모리 500MB 상한 &amp; 20개 단위 GC
            </span>
            <span className="text-zinc-400">
              현재 {guard.currentRamMB}MB / 500MB 상한 (누적 GC 릴리즈 {guard.gcReleaseCount}회)
            </span>
          </div>

          <div className="px-2.5 py-1.5 rounded-lg bg-zinc-950/90 border border-white/10 flex flex-col gap-0.5">
            <span className="text-emerald-300 font-bold">
              ④ 모바일 40℃ · 배터리 20% 쿨다운
            </span>
            <span className="text-zinc-400">
              기기 {guard.estimatedTempCelsius.toFixed(1)}℃ · 배터리 {guard.batteryPercent}% (40℃ 도달 시 자동 일시정지)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
