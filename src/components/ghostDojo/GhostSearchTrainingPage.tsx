import React, { useEffect, useRef, useState } from 'react';
import { getZCoreUrl, zCoreBridge } from '../../services/zCoreBridge';
import {
  computeGhostSearchWindowRect,
  resolveGhostSearchResponsiveSpec,
  GHOST_SEARCH_STAGE_LABELS,
  DEFAULT_WORK_AREA,
  type GhostSearchStage,
  type GhostSearchWindowMode,
} from '../../services/ghostSearchWindowGeometry';
import { playBabyGhostChime } from '../OnboardingModal';
import { GhostSuperpowerDojo } from './GhostSuperpowerDojo';
import {
  GhostSearchDojoStampBoard,
  markGhostDojoStep,
  type GhostDojoStepId,
} from './ghostSearchDojoShared';
import {
  DEMO_SEARCH_SAMPLE_DOCS_2,
  DEMO_SEARCH_SAMPLE_PHOTOS_2,
  DEMO_SEARCH_SAMPLE_VIDEOS_2,
  Stage1MinimalSearchPreview,
} from '../Stage1MinimalPreview';
import { maskSensitiveDocText } from '../PricingModal';
import { cleanVideoTimestampLabel, resolveVideoCardThumbUrl } from '../../services/aiEngine';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import {
  GhostSecretaryFirstGuard,
  jumpToGhostSecretary,
  openGhostSecretaryFirstModal,
} from '../GhostSecretaryFirstGuard';

export function ghostSearchWindowUrl(stage: GhostSearchStage, query?: string): string {
  const q = query && query.trim() ? `&q=${encodeURIComponent(query.trim())}` : '';
  return `/?dev=true&preview=legacy&ghostSearchWindow=${stage}${q}`;
}

let _activeRealGhostSearchPopup: Window | null = null;
let _openGhostSearchInflight = false;
let _lastOpenGhostSearchTs = 0;
let _lastGhostSearchWasReused = false;

declare const __GHOSTI_BUILD_ID__: string | undefined;
const CURRENT_WEB_BUILD_ID = typeof __GHOSTI_BUILD_ID__ !== 'undefined' ? __GHOSTI_BUILD_ID__ : '';

function broadcastFocusToOpenGhostSearchWindow(query?: string): void {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('ghosti_search_window_singleton_v1');
      bc.postMessage({
        type: 'FOCUS_AND_QUERY',
        query: (query || '').trim(),
        buildId: CURRENT_WEB_BUILD_ID,
      });
      bc.close();
    }
  } catch {
    /* ignore */
  }
}

export function bringRealGhostSearchPopupToFront(
  stage: GhostSearchStage = 'medium',
  query?: string,
): void {
  broadcastFocusToOpenGhostSearchWindow(query);
  try {
    if (_activeRealGhostSearchPopup && !_activeRealGhostSearchPopup.closed) {
      _activeRealGhostSearchPopup.focus();
    }
  } catch {
    /* ignore */
  }
  if (zCoreBridge.isConnected) {
    const targetStage: GhostSearchStage = stage === 'large' ? 'large' : 'medium';
    const daemonStage = targetStage === 'large' ? 'gallery' : targetStage;
    const q = (query || '').trim();
    void fetch(getZCoreUrl('/api/superpower/open_search_window'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: daemonStage, query: q, ui_mode: 'web_monitor', focus_only: true }),
      signal: AbortSignal.timeout(1500),
    }).catch(() => {});
  }
}

function probeOpenGhostSearchWindowAlive(timeoutMs = 150): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof BroadcastChannel === 'undefined') {
      resolve(false);
      return;
    }
    let settled = false;
    let bc: BroadcastChannel | null = null;
    const finish = (alive: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try {
        bc?.close();
      } catch {
        /* ignore */
      }
      resolve(alive);
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    try {
      bc = new BroadcastChannel('ghosti_search_window_singleton_v1');
      bc.onmessage = (ev: MessageEvent) => {
        const msg = ev.data as { type?: string } | null;
        if (msg && msg.type === 'EXISTING_ALIVE') {
          finish(true);
        }
      };
      // 현재 시각 + 큰 오프셋으로 PROBE_EXISTING 전송 시 살아있는 기존 귀신검색창이 즉시 EXISTING_ALIVE 응답
      bc.postMessage({ type: 'PROBE_EXISTING', bornAt: Date.now() + 999999 });
    } catch {
      finish(false);
    }
  });
}

const GHOST_SEARCH_HB_KEY = 'ghosti_search_win_hb_v1';

function hasFreshGhostSearchLocalHeartbeat(maxAgeMs = 3500): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem(GHOST_SEARCH_HB_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { ts?: number } | null;
    return typeof parsed?.ts === 'number' && Date.now() - parsed.ts < maxAgeMs;
  } catch {
    return false;
  }
}

export async function openRealGhostSearchWindowViaDaemon(
  stage: GhostSearchStage = 'medium',
  query?: string,
): Promise<boolean> {
  const now = Date.now();
  broadcastFocusToOpenGhostSearchWindow(query);
  // 1차 철벽 싱글톤 방어: 이미 열려 있는 귀신검색창의 1초 하트비트가 살아있거나 직전 3.5초 내 기동 중이면 절대 중복 실행 금지
  if (
    _openGhostSearchInflight ||
    now - _lastOpenGhostSearchTs < 3500 ||
    hasFreshGhostSearchLocalHeartbeat(3500)
  ) {
    _lastGhostSearchWasReused = true;
    bringRealGhostSearchPopupToFront(stage, query);
    return true;
  }
  _openGhostSearchInflight = true;
  _lastGhostSearchWasReused = false;

  try {
    // 2차 싱글톤 방어: 이미 열려 있는 귀신검색창이 BroadcastChannel 응답을 주면 중복 실행하지 않고 전면 포커스만 수행
    const alreadyOpenInBrowser = await probeOpenGhostSearchWindowAlive(260);
    if (alreadyOpenInBrowser) {
      _lastOpenGhostSearchTs = Date.now();
      _lastGhostSearchWasReused = true;
      bringRealGhostSearchPopupToFront(stage, query);
      return true;
    }
    const targetStage: GhostSearchStage = stage === 'large' ? 'large' : 'medium';
    const daemonStage = targetStage === 'large' ? 'gallery' : targetStage;
    const q = (query || '').trim();
    const wasZCoreConnected = zCoreBridge.isConnected;

    try {
      const res = await fetch(getZCoreUrl('/api/superpower/open_search_window'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: daemonStage, query: q, ui_mode: 'web_monitor' }),
        signal: AbortSignal.timeout(wasZCoreConnected ? 4500 : 1800),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data && data.ok !== false && data.launched !== false) {
          _lastOpenGhostSearchTs = Date.now();
          _lastGhostSearchWasReused = Boolean(data.reused || data.deduped);
          return true;
        }
      } else if (res.status === 404 || res.status === 405) {
        const qs = `stage=${encodeURIComponent(daemonStage)}&ui_mode=web_monitor${q ? `&q=${encodeURIComponent(q)}` : ''}`;
        const resGet = await fetch(getZCoreUrl(`/__merlin/open-ghost-search?${qs}`), {
          signal: AbortSignal.timeout(wasZCoreConnected ? 4500 : 1800),
        });
        if (resGet.ok) {
          const dataGet = await resGet.json().catch(() => ({}));
          if (dataGet?.ok !== false && dataGet?.launched !== false) {
            _lastOpenGhostSearchTs = Date.now();
            _lastGhostSearchWasReused = Boolean(dataGet.reused || dataGet.deduped);
            return true;
          }
        }
      }
    } catch (err) {
      const errName = (err as { name?: string } | null)?.name || '';
      if (wasZCoreConnected && (errName === 'TimeoutError' || errName === 'AbortError')) {
        const openedAfterTimeout = await probeOpenGhostSearchWindowAlive(320);
        if (openedAfterTimeout) {
          _lastOpenGhostSearchTs = Date.now();
          return true;
        }
      }
    }

    const targetUrl = ghostSearchWindowUrl(targetStage, query);
    if (typeof window !== 'undefined') {
      try {
        const availW = window.screen?.availWidth || DEFAULT_WORK_AREA.right;
        const availH = window.screen?.availHeight || DEFAULT_WORK_AREA.bottom;
        const anchorX = Math.max(40, Math.round((availW - 960) / 2));
        const anchorY = Math.max(40, Math.round((availH - 640) / 2));
        const rect = computeGhostSearchWindowRect(
          targetStage,
          anchorX,
          anchorY,
          { left: 0, top: 0, right: availW, bottom: availH },
          20,
        );
        const features = `popup=yes,width=${rect.width},height=${rect.height},left=${rect.x},top=${rect.y},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`;
        if (_activeRealGhostSearchPopup && !_activeRealGhostSearchPopup.closed) {
          _lastOpenGhostSearchTs = Date.now();
          _lastGhostSearchWasReused = true;
          if (q) {
            _activeRealGhostSearchPopup.location.href = targetUrl;
          }
          _activeRealGhostSearchPopup.focus();
          return true;
        }
        const win = window.open(targetUrl, 'ghosti_real_search_window', features);
        if (win) {
          _lastOpenGhostSearchTs = Date.now();
          _activeRealGhostSearchPopup = win;
          win.focus();
          return true;
        }
      } catch {
        /* ignore */
      }
    }
    return false;
  } finally {
    _openGhostSearchInflight = false;
  }
}

function consumePendingGhostSearchQuery(): string {
  try {
    const q = sessionStorage.getItem('ghosti_pending_ghost_search_query') || '';
    if (q) sessionStorage.removeItem('ghosti_pending_ghost_search_query');
    return q;
  } catch {
    return '';
  }
}

const SIMULATOR_WORK_AREA = { left: 0, top: 0, right: 1120, bottom: 660 };
type GameStepId = GhostDojoStepId;

const AUTO_MORPH_SCRIPT: Array<{
  phase: number;
  stage: GhostSearchStage | null;
  cursorPct: { x: number; y: number };
  clicking: boolean;
  badge: string;
  desc: string;
}> = [
  {
    phase: 0,
    stage: null,
    cursorPct: { x: 62, y: 54 },
    clicking: true,
    badge: '단축키 호출 · 바탕화면에서 Ctrl + 0 또는 Ctrl + 우클릭',
    desc: '바탕화면에서 단축키를 누르면 마우스 위치에 검색창이 열립니다.',
  },
  {
    phase: 1,
    stage: 'small',
    cursorPct: { x: 56, y: 32 },
    clicking: false,
    badge: '작게 보기 · 빠른 검색과 첫 번째 결과 요약',
    desc: '사진·동영상·문서 검색 결과와 첫 번째 항목 미리보기를 바로 확인합니다.',
  },
  {
    phase: 2,
    stage: 'large',
    cursorPct: { x: 82, y: 12 },
    clicking: true,
    badge: '크게 보기 · 전체 갤러리 화면',
    desc: '많은 사진과 문서를 넓은 화면에서 한눈에 살펴볼 수 있습니다.',
  },
];

const VirtualMonitorSimulator: React.FC<{
  onStep: (id: GameStepId) => void;
  initialQuery?: string;
  connected?: boolean;
}> = ({
  onStep,
  initialQuery = '',
  connected = true,
}) => {
  const {
    searchSpace,
    hasExecutedUserSearch,
    activeQuery,
    searchResults,
    matchedLocalDocs,
    matchedVaultPhotos,
    matchedVideoScenes,
    setSelectedPhoto,
    setSelectedDocModal,
    setSelectedVideoModal,
  } = useSaySeeStore();
  const monitorRef = useRef<HTMLDivElement | null>(null);
  const [monitorW, setMonitorW] = useState(960);
  const [windowMode, setWindowMode] = useState<GhostSearchWindowMode>('compact');
  const [stage, setStage] = useState<GhostSearchStage | null>(initialQuery ? 'medium' : 'small');
  const [customSlimHeight, setCustomSlimHeight] = useState<number | undefined>(initialQuery ? undefined : 340);
  const [anchor, setAnchor] = useState({ x: 1300, y: 600 });
  const [isAutoPlaying, setIsAutoPlaying] = useState(!initialQuery);
  const [autoPhase, setAutoPhase] = useState<number>(initialQuery ? 2 : 1);

  useEffect(() => {
    const el = monitorRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setMonitorW(el.clientWidth));
    ro.observe(el);
    setMonitorW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const stepInfo = AUTO_MORPH_SCRIPT[autoPhase] || AUTO_MORPH_SCRIPT[1];
    setStage(stepInfo.stage);
    setWindowMode(stepInfo.stage === 'large' ? 'large' : 'compact');
    setCustomSlimHeight(stepInfo.stage === 'small' ? 340 : undefined);
    const duration = stepInfo.stage === null ? 1600 : 2900;
    const timer = window.setTimeout(() => {
      setAutoPhase((prev) => (prev + 1) % AUTO_MORPH_SCRIPT.length);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [isAutoPlaying, autoPhase]);

  useEffect(() => {
    if (isAutoPlaying || !stage || windowMode === 'large') return;
    const cleanQ =
      hasExecutedUserSearch &&
      activeQuery &&
      !activeQuery.startsWith('전체 갤러리 사진') &&
      !activeQuery.startsWith('동영상 ') &&
      !activeQuery.startsWith('최근 서류 ')
        ? activeQuery.trim()
        : '';
    if (!cleanQ && stage === 'medium') return;
    const timer = window.setTimeout(() => {
      const totalMatched =
        searchResults.length + matchedLocalDocs.length + matchedVaultPhotos.length + matchedVideoScenes.length;
      const spec = resolveGhostSearchResponsiveSpec({
        mode: 'compact',
        hasQuery: Boolean(cleanQ),
        resultCount: totalMatched,
        hasRichPreview: searchResults.length > 0 || matchedVaultPhotos.length > 0 || matchedLocalDocs.length > 0,
      });
      setStage(spec.stage);
      setCustomSlimHeight(spec.customHeight);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [
    isAutoPlaying,
    stage,
    windowMode,
    hasExecutedUserSearch,
    activeQuery,
    searchResults.length,
    matchedLocalDocs.length,
    matchedVaultPhotos.length,
    matchedVideoScenes.length,
  ]);

  useEffect(() => {
    const onFocusMonitorWin = (e: Event) => {
      const detail = (e as CustomEvent<{ stage?: GhostSearchStage }>).detail;
      const nextStage: GhostSearchStage = detail?.stage || 'medium';
      setIsAutoPlaying(false);
      setWindowMode(nextStage === 'large' ? 'large' : 'compact');
      setStage(nextStage);
      setCustomSlimHeight(nextStage === 'small' ? 340 : undefined);
      setAutoPhase(nextStage === 'large' ? 3 : nextStage === 'medium' ? 2 : 1);
    };
    window.addEventListener('ghosti_focus_virtual_monitor_window', onFocusMonitorWin as EventListener);
    return () => window.removeEventListener('ghosti_focus_virtual_monitor_window', onFocusMonitorWin as EventListener);
  }, []);

  const setManualMode = (nextMode: GhostSearchWindowMode | null, customAnchor?: { x: number; y: number }) => {
    setIsAutoPlaying(false);
    if (customAnchor) setAnchor(customAnchor);
    if (nextMode === null) {
      setStage(null);
      setAutoPhase(0);
      return;
    }
    setWindowMode(nextMode);
    playBabyGhostChime('summon');
    if (nextMode === 'large') {
      setStage('large');
      setCustomSlimHeight(undefined);
      setAutoPhase(3);
      onStep('large');
    } else {
      const cleanQ =
        hasExecutedUserSearch &&
        activeQuery &&
        !activeQuery.startsWith('전체 갤러리 사진') &&
        !activeQuery.startsWith('동영상 ') &&
        !activeQuery.startsWith('최근 서류 ')
          ? activeQuery.trim()
          : initialQuery.trim();
      const totalMatched =
        searchResults.length + matchedLocalDocs.length + matchedVaultPhotos.length + matchedVideoScenes.length;
      const spec = resolveGhostSearchResponsiveSpec({
        mode: 'compact',
        hasQuery: Boolean(cleanQ),
        resultCount: totalMatched,
        hasRichPreview: searchResults.length > 0 || matchedVaultPhotos.length > 0 || matchedLocalDocs.length > 0,
      });
      setStage(spec.stage);
      setCustomSlimHeight(spec.customHeight);
      setAutoPhase(spec.stage === 'medium' ? 2 : 1);
      if (spec.stage === 'small') onStep('summon');
      if (spec.stage === 'medium') onStep('medium');
    }
  };

  const selectExplicitStage = (targetStage: GhostSearchStage) => {
    setIsAutoPlaying(false);
    playBabyGhostChime('summon');
    if (targetStage === 'small') {
      setWindowMode('compact');
      setStage('small');
      setCustomSlimHeight(330);
      setAutoPhase(1);
      onStep('summon');
    } else if (targetStage === 'medium') {
      setWindowMode('compact');
      setStage('medium');
      setCustomSlimHeight(undefined);
      setAutoPhase(2);
      onStep('medium');
    } else {
      setWindowMode('large');
      setStage('large');
      setCustomSlimHeight(undefined);
      setAutoPhase(3);
      onStep('large');
    }
  };

  const summon = (x?: number, y?: number) => {
    setManualMode(
      'compact',
      typeof x === 'number' && typeof y === 'number' ? { x, y } : undefined,
    );
  };

  const scale = monitorW / SIMULATOR_WORK_AREA.right;
  const rect = stage
    ? computeGhostSearchWindowRect(
        stage,
        anchor.x,
        anchor.y,
        SIMULATOR_WORK_AREA,
        stage === 'small' ? customSlimHeight : undefined
      )
    : null;
  const currentScript = AUTO_MORPH_SCRIPT[autoPhase] || AUTO_MORPH_SCRIPT[1];

  const toVirtual = (e: React.MouseEvent) => {
    const box = monitorRef.current?.getBoundingClientRect();
    if (!box) return { x: 560, y: 330 };
    return { x: Math.round((e.clientX - box.left) / scale), y: Math.round((e.clientY - box.top) / scale) };
  };

  return (
    <div className="flex flex-col items-center w-full select-none">
      <div className="w-full rounded-xl overflow-hidden border border-slate-300 bg-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-white border-b border-slate-200 text-[12px] text-slate-600">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-slate-900">검색창 미리보기</span>
            <span className="text-slate-400 hidden sm:inline">·</span>
            <span className="text-slate-500 hidden sm:inline truncate">
              {isAutoPlaying
                ? currentScript.badge
                : `직접 조작 중 (${stage ? GHOST_SEARCH_STAGE_LABELS[stage] : '바탕화면 대기'})`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5" data-allow-secretary-jump="true">
            <button
              type="button"
              onClick={() => selectExplicitStage('small')}
              className={`px-2.5 py-1 rounded-md text-[11.5px] font-semibold transition-colors cursor-pointer ${
                stage === 'small' || stage === 'medium'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              ⤡ 작게
            </button>
            <button
              type="button"
              onClick={() => selectExplicitStage('large')}
              className={`px-2.5 py-1 rounded-md text-[11.5px] font-semibold transition-colors cursor-pointer ${
                stage === 'large'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              ⤢ 크게(갤러리)
            </button>
            <button
              type="button"
              onClick={() => {
                if (isAutoPlaying) {
                  setIsAutoPlaying(false);
                } else {
                  setIsAutoPlaying(true);
                  setAutoPhase((prev) => (prev + 1) % AUTO_MORPH_SCRIPT.length);
                }
              }}
              className="px-2.5 py-1 rounded-md text-[11.5px] font-medium cursor-pointer border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
            >
              {isAutoPlaying ? '일시정지' : '자동 시연'}
            </button>
          </div>
        </div>

        <div
          ref={monitorRef}
          data-keep-dark="true"
          data-guard-interactive="true"
          onContextMenu={(e) => {
            if (e.ctrlKey) e.preventDefault();
          }}
          onMouseDown={(e) => {
            if (e.button === 2 && e.ctrlKey && !e.altKey && !e.shiftKey) {
              e.preventDefault();
              const pos = toVirtual(e);
              summon(pos.x, pos.y);
            }
          }}
          className="relative w-full overflow-hidden"
          style={{
            aspectRatio: `${SIMULATOR_WORK_AREA.right} / ${SIMULATOR_WORK_AREA.bottom}`,
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          }}
        >
          <div data-keep-dark="true" className="absolute top-3.5 left-3.5 flex flex-col gap-2.5 text-[11px] text-white font-medium">
            {[
              '받은 파일',
              '다운로드',
              '2026_견적서.xlsx',
              '가족여행_바다.jpg',
            ].map((name) => (
              <div
                key={name}
                onClick={() => setManualMode(windowMode)}
                className="flex flex-col items-center gap-1 w-20 p-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 cursor-pointer transition-colors text-center"
              >
                <span className="material-symbols-outlined text-[18px] text-slate-200">
                  {name.includes('.') ? 'description' : 'folder'}
                </span>
                <span className="truncate w-full text-[10px] text-slate-200">{name}</span>
              </div>
            ))}
          </div>

          {!stage && (
            <div data-keep-dark="true" className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                onClick={() => summon(1300, 600)}
                className="px-4 py-2.5 rounded-lg bg-white text-slate-900 text-[13px] font-semibold shadow-lg cursor-pointer hover:bg-slate-50 transition-colors"
              >
                클릭하거나 Ctrl + 0으로 검색창 열기
              </button>
            </div>
          )}

          {rect && (
            <div
              onMouseDown={() => {
                if (isAutoPlaying) setIsAutoPlaying(false);
              }}
              className="absolute rounded-xl overflow-hidden shadow-2xl border border-slate-300 bg-white transition-all duration-500 ease-out z-20"
              style={{
                left: rect.x * scale,
                top: rect.y * scale,
                width: rect.width * scale,
                height: rect.height * scale,
              }}
            >
              <div
                className="origin-top-left bg-white text-slate-900"
                style={{ width: rect.width, height: rect.height, transform: `scale(${scale})` }}
              >
                <div className="h-9 px-3.5 flex items-center justify-between gap-2 bg-slate-50 border-b border-slate-200 text-slate-800 text-[12px] font-semibold">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-900 whitespace-nowrap">
                      귀신검색창
                    </span>
                    <span className="text-slate-400 text-[11px] truncate">
                      {rect.framelessAppMode ? '전체 갤러리 보기' : '결과 수에 맞춰 크기 자동 조절'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectExplicitStage('small');
                      }}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                        stage !== 'large'
                          ? 'bg-slate-900 text-white'
                          : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      ⤡ 작게
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectExplicitStage('large');
                      }}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                        stage === 'large'
                          ? 'bg-slate-900 text-white'
                          : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      ⤢ 크게(갤러리)
                    </button>
                  </div>
                </div>
                <div
                  className="h-[calc(100%-2.25rem)] flex overflow-hidden bg-white"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (isAutoPlaying) setIsAutoPlaying(false);
                  }}
                >
                  <div className="flex-1 min-w-0 h-full overflow-y-auto">
                    <Stage1MinimalSearchPreview initialQuery={initialQuery} forceSampleOnly={true} />
                  </div>
                  {(stage === 'small' || stage === 'medium') && (() => {
                    const topPhoto =
                      searchSpace === 'gallery' ? DEMO_SEARCH_SAMPLE_PHOTOS_2[0] : undefined;
                    const topVideo =
                      searchSpace === 'video' ? DEMO_SEARCH_SAMPLE_VIDEOS_2[0] : undefined;
                    const topDoc =
                      searchSpace === 'vault' ? DEMO_SEARCH_SAMPLE_DOCS_2[0] : undefined;
                    return (
                      <aside className="w-[320px] shrink-0 h-full border-l border-slate-200 bg-slate-50 p-3.5 flex flex-col gap-2.5 overflow-y-auto">
                        <div className="text-[12px] font-bold text-slate-800">
                          첫 번째 결과 미리보기
                        </div>
                        {topDoc ? (
                          <>
                            <div className="w-full p-3 rounded-lg bg-white border border-slate-200 flex flex-col gap-1">
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                                  {topDoc.ext?.toUpperCase() || 'DOC'}
                                </span>
                                <span className="text-[10.5px] text-slate-500 truncate">
                                  {topDoc.categoryBadge || '문서'}
                                </span>
                              </div>
                              <div className="text-[12px] font-semibold text-slate-900 break-all">
                                {topDoc.fileName}
                              </div>
                            </div>
                            <div className="text-[11px] text-slate-600 leading-relaxed line-clamp-8 whitespace-pre-line bg-white p-2.5 rounded-lg border border-slate-200">
                              {maskSensitiveDocText(topDoc.extractedText) || '문서 미리보기'}
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedDocModal(topDoc)}
                              className="mt-auto w-full py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer transition-colors"
                            >
                              문서 본문 열기
                            </button>
                          </>
                        ) : topVideo ? (
                          <>
                            <div data-keep-dark="true" className="w-full h-[180px] rounded-lg overflow-hidden bg-black border border-slate-200 flex items-center justify-center relative">
                              {resolveVideoCardThumbUrl(topVideo) ? (
                                <img
                                  src={resolveVideoCardThumbUrl(topVideo)}
                                  alt={topVideo.videoFileName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-[12px] text-slate-400">{topVideo.videoFileName}</span>
                              )}
                              <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-white text-[10.5px] font-semibold">
                                {cleanVideoTimestampLabel(topVideo.matchedTimestamp)}
                              </span>
                            </div>
                            <div className="text-[12px] font-semibold text-slate-900 truncate">
                              {topVideo.videoFileName}
                            </div>
                            <div className="text-[11px] text-slate-600 line-clamp-3">
                              {topVideo.matchedFrameCaption || topVideo.sceneDescription}
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedVideoModal(topVideo)}
                              className="mt-auto w-full py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer transition-colors"
                            >
                              해당 장면 재생
                            </button>
                          </>
                        ) : topPhoto ? (
                          <>
                            <div data-keep-dark="true" className="w-full h-[200px] rounded-lg overflow-hidden bg-black border border-slate-200 flex items-center justify-center">
                              <img
                                src={topPhoto.thumbUrl}
                                alt={topPhoto.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="text-[12px] font-semibold text-slate-900 truncate">
                              {topPhoto.name}
                            </div>
                            <div className="text-[11px] text-slate-600 line-clamp-3">
                              {topPhoto.captionKo || topPhoto.tags.join(' · ')}
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedPhoto(topPhoto, null)}
                              className="mt-auto w-full py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer transition-colors"
                            >
                              상세 보기 · 글자 추출
                            </button>
                          </>
                        ) : (
                          <div className="text-[11.5px] text-slate-500">
                            첫 번째 검색 결과 요약이 표시됩니다.
                          </div>
                        )}
                      </aside>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          <div
            data-keep-dark="true"
            className="absolute bottom-0 inset-x-0 h-7 px-3 bg-black/75 border-t border-white/10 flex items-center justify-between text-[10.5px] text-zinc-300 z-10 pointer-events-none"
          >
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-white/10 text-white font-medium">시작</span>
              <span className="text-zinc-300">귀신같이 실행 중 (Ctrl + 0)</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <span>KOR</span>
              <span>오후 2:05</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const GhostSearchTrainingPage: React.FC = () => {
  const [connected, setConnected] = useState(zCoreBridge.isConnected);
  const [pendingQuery] = useState(() => consumePendingGhostSearchQuery());
  const [realPopupToast, setRealPopupToast] = useState<string | null>(null);
  const [isLaunchingRealWindow, setIsLaunchingRealWindow] = useState(false);
  const monitorSectionRef = useRef<HTMLElement | null>(null);
  const isLaunchingRef = useRef(false);

  const markStep = (id: GameStepId) => {
    markGhostDojoStep(id);
  };

  const triggerRealGhostSearchWindow = async (stage: GhostSearchStage = 'medium', query?: string) => {
    if (isLaunchingRef.current || isLaunchingRealWindow) {
      bringRealGhostSearchPopupToFront(stage, query ?? pendingQuery);
      return;
    }
    isLaunchingRef.current = true;
    setIsLaunchingRealWindow(true);
    window.setTimeout(() => {
      isLaunchingRef.current = false;
      setIsLaunchingRealWindow(false);
    }, 600);
    // [귀신검색창 열기] 단순 창 호출만으로는 '작게 모드'·'크게(갤러리)' 체험 도장을 오표시하지 않습니다.
    // 실제 도장은 도장판 버튼 클릭 또는 검색창 내 [⤡ 작게]·[⤢ 크게(갤러리)] 명시 전환 시에만 기록됩니다.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ghosti_focus_virtual_monitor_window', { detail: { stage } }),
      );
    }
    const ok = await openRealGhostSearchWindowViaDaemon(stage, query ?? pendingQuery);
    if (ok) {
      if (!_lastGhostSearchWasReused) {
        playBabyGhostChime('summon');
      }
      setRealPopupToast(
        _lastGhostSearchWasReused
          ? '열려 있는 귀신검색창을 화면 앞으로 불러왔습니다.'
          : `귀신검색창(${GHOST_SEARCH_STAGE_LABELS[stage]})을 열었습니다.`,
      );
      setTimeout(() => setRealPopupToast(null), 4000);
    } else {
      monitorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  useEffect(() => {
    if (pendingQuery) {
      monitorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [pendingQuery]);

  useEffect(() => {
    setConnected(zCoreBridge.isConnected);
    const unsub = zCoreBridge.subscribe((c: boolean) => setConnected(c));
    if (!zCoreBridge.isConnected) {
      void zCoreBridge.checkHealth(true).then((ok) => {
        if (ok) setConnected(true);
      });
    }
    return unsub;
  }, []);

  useEffect(() => {
    let baseline: Record<string, number> | null = null;
    const pollTelemetry = async () => {
      if (!zCoreBridge.isConnected) return;
      try {
        const res = await fetch(getZCoreUrl('/api/superpower/telemetry'));
        if (!res.ok) return;
        const data = await res.json();
        const total = (data?.total || {}) as Record<string, number>;
        if (!baseline) {
          baseline = { ...total };
          return;
        }
        const prevBase = baseline;
        baseline = { ...total };
        if (
          (total.ctrl0_summon_bar || 0) > (prevBase.ctrl0_summon_bar || 0) ||
          (total.ghost_search_window_small || 0) > (prevBase.ghost_search_window_small || 0) ||
          (total.ghost_search_window_medium || 0) > (prevBase.ghost_search_window_medium || 0)
        ) {
          window.dispatchEvent(new CustomEvent('ghosti_daemon_ctrl0_summon'));
        }
        if (
          (total.ghost_search_window_large || 0) > (prevBase.ghost_search_window_large || 0) ||
          (total.ghost_search_window_gallery || 0) > (prevBase.ghost_search_window_gallery || 0)
        ) {
          markStep('large');
        }
      } catch {
        /* ignore */
      }
    };
    void pollTelemetry();
    const timer = window.setInterval(() => void pollTelemetry(), 1200);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="w-full max-w-[1160px] mx-auto px-4 sm:px-6 md:px-8 py-6 flex flex-col gap-5 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[20px] sm:text-[22px] font-bold text-slate-900">귀신검색</h1>
            <div className="inline-flex flex-wrap items-center gap-2.5 px-3 py-1 rounded-xl bg-white border border-slate-200">
              <span className="text-[12px] font-semibold text-slate-600 tracking-tight">
                귀신검색 호출 단축키
              </span>
              <span className="h-3.5 w-px bg-slate-200" />
              <img
                src="/ghostkey_shortcut_badge.png"
                alt="Ctrl+0 / Ctrl+우클릭"
                className="h-6 sm:h-7 w-auto object-contain select-none"
              />
            </div>
          </div>
          <p className="text-[13.5px] text-slate-500">
            바탕화면이나 작업 화면에서 언제든 검색창을 바로 열 수 있습니다.
          </p>
        </div>
        {connected && (
          <button
            type="button"
            aria-busy={isLaunchingRealWindow}
            onClick={() => void triggerRealGhostSearchWindow('medium', pendingQuery)}
            className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[13px] font-semibold cursor-pointer shrink-0 transition-colors"
          >
            {isLaunchingRealWindow ? '검색창 여는 중...' : '귀신검색창 열기'}
          </button>
        )}
      </div>

      {!connected && (
        <div className="px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[13.5px] font-semibold text-slate-900">
              현재 샘플 미리보기 화면입니다
            </span>
            <span className="text-[12.5px] text-slate-500">
              내 컴퓨터의 실제 사진·영상·문서를 찾으려면 먼저 귀신비서에서 내 컴퓨터를 연결해 주세요.
            </span>
          </div>
          <button
            type="button"
            data-allow-secretary-jump="true"
            onClick={jumpToGhostSecretary}
            className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12.5px] font-semibold transition-colors cursor-pointer shrink-0"
          >
            귀신비서로 이동
          </button>
        </div>
      )}

      {realPopupToast && (
        <div className="px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-[13px] font-medium">
          {realPopupToast}
        </div>
      )}

      <GhostSecretaryFirstGuard>
        <section className="flex flex-col gap-2">
          <GhostSuperpowerDojo variant="basics" />
        </section>

        <section ref={monitorSectionRef} className="flex flex-col gap-2.5">
          <GhostSearchDojoStampBoard variant="full" />

          <VirtualMonitorSimulator
            onStep={markStep}
            initialQuery={pendingQuery}
            connected={connected}
          />
        </section>
      </GhostSecretaryFirstGuard>

      <section className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13.5px] font-medium text-slate-700">
          {connected
            ? '바탕화면에서 Ctrl + 0 (또는 Ctrl + 우클릭)을 누르면 실제 내 파일을 검색할 수 있습니다.'
            : '내 컴퓨터의 실제 사진과 문서를 검색하려면 귀신비서에서 내 컴퓨터를 연결해 주세요.'}
        </span>
        {connected ? (
          <button
            type="button"
            aria-busy={isLaunchingRealWindow}
            onClick={() => void triggerRealGhostSearchWindow('medium', pendingQuery)}
            className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12.5px] font-semibold cursor-pointer shrink-0"
          >
            {isLaunchingRealWindow ? '여는 중...' : '귀신검색창 열기'}
          </button>
        ) : (
          <button
            type="button"
            data-allow-secretary-jump="true"
            onClick={jumpToGhostSecretary}
            className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12.5px] font-semibold cursor-pointer shrink-0"
          >
            귀신비서로 이동
          </button>
        )}
      </section>
    </div>
  );
};

export default GhostSearchTrainingPage;
