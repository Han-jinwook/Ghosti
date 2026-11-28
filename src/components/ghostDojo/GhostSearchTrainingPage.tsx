import React, { useEffect, useRef, useState } from 'react';
import { getZCoreUrl, zCoreBridge } from '../../services/zCoreBridge';
import {
  computeGhostSearchWindowRect,
  GHOST_SEARCH_STAGE_LABELS,
  DEFAULT_WORK_AREA,
  type GhostSearchStage,
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
  jumpToGhostSecretary,
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

interface DesktopIconItem {
  id: string;
  label: string;
  kind: 'folder' | 'pdf' | 'xlsx' | 'photo' | 'video';
  thumbSrc?: string;
}

const VIRTUAL_DESKTOP_ICONS: DesktopIconItem[] = [
  {
    id: 'desk_folder',
    label: '내 문서',
    kind: 'folder',
  },
  {
    id: 'desk_pdf',
    label: '계약서.pdf',
    kind: 'pdf',
  },
  {
    id: 'desk_xlsx',
    label: '견적서.xlsx',
    kind: 'xlsx',
  },
  {
    id: 'desk_photo_family',
    label: '가족여행.jpg',
    kind: 'photo',
    thumbSrc: '/sample_photos_301/IMG_20250510_1001.jpg',
  },
];

const DesktopIconVisual: React.FC<{ item: DesktopIconItem }> = ({ item }) => {
  if (item.kind === 'folder') {
    return (
      <svg viewBox="0 0 48 48" className="w-7 h-7 drop-shadow-sm">
        <path
          d="M6 11a4 4 0 0 1 4-4h10l4 4h14a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V11z"
          fill="#F59E0B"
        />
        <path
          d="M6 16h36v21a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V16z"
          fill="#FBBF24"
        />
      </svg>
    );
  }
  if (item.kind === 'pdf') {
    return (
      <div className="w-6 h-7 rounded-xs bg-white border border-slate-300 shadow-sm flex flex-col justify-between overflow-hidden">
        <div className="px-1 pt-1 flex flex-col gap-0.5">
          <span className="h-0.5 w-3 bg-slate-300 rounded-full" />
          <span className="h-0.5 w-4 bg-slate-300 rounded-full" />
        </div>
        <div className="bg-rose-600 text-white text-[7px] font-extrabold text-center py-px tracking-tighter">
          PDF
        </div>
      </div>
    );
  }
  if (item.kind === 'xlsx') {
    return (
      <div className="w-6 h-7 rounded-xs bg-white border border-slate-300 shadow-sm flex flex-col justify-between overflow-hidden">
        <div className="px-0.5 pt-1 grid grid-cols-2 gap-0.5">
          <span className="h-0.5 bg-emerald-200" />
          <span className="h-0.5 bg-slate-200" />
          <span className="h-0.5 bg-emerald-200" />
          <span className="h-0.5 bg-slate-200" />
        </div>
        <div className="bg-emerald-600 text-white text-[6.5px] font-extrabold text-center py-px tracking-tighter">
          XLSX
        </div>
      </div>
    );
  }
  if (item.kind === 'photo' && item.thumbSrc) {
    return (
      <div className="w-7 h-6 rounded-xs bg-zinc-900 border border-white/75 shadow-sm overflow-hidden">
        <img src={item.thumbSrc} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }
  return null;
};

const VirtualMonitorSimulator: React.FC<{
  onStep: (id: GameStepId) => void;
  initialQuery?: string;
}> = ({
  onStep: _onStep,
  initialQuery = '',
}) => {
  void _onStep;
  const {
    searchSpace,
    setSelectedPhoto,
    setSelectedDocModal,
    setSelectedVideoModal,
  } = useSaySeeStore();
  const monitorRef = useRef<HTMLDivElement | null>(null);
  const [monitorW, setMonitorW] = useState(960);
  const [stage, setStage] = useState<GhostSearchStage | null>('medium');
  const [anchor, setAnchor] = useState({ x: 1300, y: 600 });
  const [sampleQueryText, setSampleQueryText] = useState<string>(initialQuery);

  useEffect(() => {
    const el = monitorRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setMonitorW(el.clientWidth));
    ro.observe(el);
    setMonitorW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onFocusMonitorWin = (e: Event) => {
      const detail = (e as CustomEvent<{ stage?: GhostSearchStage }>).detail;
      const nextStage: GhostSearchStage = detail?.stage === 'large' ? 'large' : 'medium';
      setStage(nextStage);
    };
    const onDojoPreviewSearch = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          space?: 'gallery' | 'video' | 'vault';
          query?: string;
          reset?: boolean;
        }>
      ).detail;
      if (!detail) return;
      if (!stage) setStage('medium');
      setSampleQueryText(detail.reset ? '' : detail.query || '');
    };
    const onSampleActiveQuery = (e: Event) => {
      const detail = (e as CustomEvent<{ query?: string }>).detail;
      setSampleQueryText(detail?.query ?? '');
    };

    window.addEventListener('ghosti_focus_virtual_monitor_window', onFocusMonitorWin as EventListener);
    window.addEventListener('ghosti_dojo_preview_search', onDojoPreviewSearch as EventListener);
    window.addEventListener('ghosti_dojo_sample_active_query', onSampleActiveQuery as EventListener);
    return () => {
      window.removeEventListener('ghosti_focus_virtual_monitor_window', onFocusMonitorWin as EventListener);
      window.removeEventListener('ghosti_dojo_preview_search', onDojoPreviewSearch as EventListener);
      window.removeEventListener('ghosti_dojo_sample_active_query', onSampleActiveQuery as EventListener);
    };
  }, [stage]);

  const summon = (x?: number, y?: number) => {
    if (typeof x === 'number' && typeof y === 'number') {
      setAnchor({ x, y });
    }
    playBabyGhostChime('summon');
    setStage((prev) => prev ?? 'medium');
  };

  const toggleWindowMaximize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStage((prev) => (prev === 'large' ? 'medium' : 'large'));
  };

  const scale = monitorW / SIMULATOR_WORK_AREA.right;
  const rect = stage
    ? computeGhostSearchWindowRect(stage, anchor.x, anchor.y, SIMULATOR_WORK_AREA)
    : null;

  const toVirtual = (e: React.MouseEvent) => {
    const box = monitorRef.current?.getBoundingClientRect();
    if (!box) return { x: 560, y: 330 };
    return { x: Math.round((e.clientX - box.left) / scale), y: Math.round((e.clientY - box.top) / scale) };
  };

  const qLower = sampleQueryText.trim().toLowerCase();
  const qTokens = qLower.split(/\s+/).filter(Boolean);

  const resolveTopPhoto = () => {
    if (searchSpace !== 'gallery') return undefined;
    if (qTokens.length === 0) return DEMO_SEARCH_SAMPLE_PHOTOS_2[0];
    const matched = DEMO_SEARCH_SAMPLE_PHOTOS_2.filter((p) => {
      const hay = [p.name, p.captionKo || '', ...(p.tags || []), ...(p.keywordsKo || [])]
        .join(' ')
        .toLowerCase();
      return qTokens.some((t) => hay.includes(t));
    }).sort((a, b) => {
      const hayA = [a.name, a.captionKo || '', ...(a.tags || []), ...(a.keywordsKo || [])].join(' ').toLowerCase();
      const hayB = [b.name, b.captionKo || '', ...(b.tags || []), ...(b.keywordsKo || [])].join(' ').toLowerCase();
      return qTokens.filter((t) => hayB.includes(t)).length - qTokens.filter((t) => hayA.includes(t)).length;
    });
    return matched[0] || DEMO_SEARCH_SAMPLE_PHOTOS_2[0];
  };

  const resolveTopVideo = () => {
    if (searchSpace !== 'video') return undefined;
    if (qTokens.length === 0) return DEMO_SEARCH_SAMPLE_VIDEOS_2[0];
    return (
      DEMO_SEARCH_SAMPLE_VIDEOS_2.find((v) => {
        const hay = [v.title, v.sceneDescription || '', v.ocrFullText || '', ...(v.keywords || [])]
          .join(' ')
          .toLowerCase();
        return qTokens.some((t) => hay.includes(t));
      }) || DEMO_SEARCH_SAMPLE_VIDEOS_2[0]
    );
  };

  const resolveTopDoc = () => {
    if (searchSpace !== 'vault') return undefined;
    if (qTokens.length === 0) return DEMO_SEARCH_SAMPLE_DOCS_2[0];
    return (
      DEMO_SEARCH_SAMPLE_DOCS_2.find((d) => {
        const hay = [d.title, d.fileName, d.extractedText, ...(d.keywords || [])]
          .join(' ')
          .toLowerCase();
        return qTokens.some((t) => hay.includes(t));
      }) || DEMO_SEARCH_SAMPLE_DOCS_2[0]
    );
  };

  return (
    <div className="flex flex-col items-center w-full select-none">
      {/* 실제 모니터 베젤 (상단 카메라 + 메탈 프레임 + 하단 모니터 턱) */}
      <div
        data-keep-dark="true"
        className="w-full rounded-[22px] p-3 sm:p-3.5 shadow-2xl border-2 border-zinc-600/80"
        style={{
          background: 'linear-gradient(180deg, #27272a 0%, #18181b 50%, #09090b 100%)',
          boxShadow: '0 22px 50px -12px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
        }}
      >
        {/* 모니터 상단 슬림 카메라 베젤 */}
        <div
          data-keep-dark="true"
          className="flex items-center justify-center pb-2"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-black/55 border border-white/10">
            <span className="w-2 h-2 rounded-full bg-zinc-800 border border-zinc-500 shadow-inner" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
        </div>

        {/* 모니터 실제 LCD 바탕화면 영역 */}
        <div
          ref={monitorRef}
          data-keep-dark="true"
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
          className="relative w-full overflow-hidden rounded-xl border-2 border-black shadow-inner"
          style={{
            aspectRatio: `${SIMULATOR_WORK_AREA.right} / ${SIMULATOR_WORK_AREA.bottom}`,
            background: 'linear-gradient(135deg, #0c192c 0%, #172554 45%, #1e1b4b 78%, #09090b 100%)',
          }}
        >
          {/* 윈도우 데스크톱 배경 은은한 광원 */}
          <div
            data-keep-dark="true"
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              backgroundImage:
                'radial-gradient(circle at 75% 25%, rgba(45, 212, 191, 0.35), transparent 45%), radial-gradient(circle at 22% 72%, rgba(56, 189, 248, 0.3), transparent 50%)',
            }}
          />

          {/* 조그맣고 은은한 순수 바탕화면 데코레이션 아이콘 (비클릭 배경 소품) */}
          <div
            data-keep-dark="true"
            aria-hidden="true"
            className="absolute top-3 left-3 z-0 flex flex-col gap-2.5 opacity-80 pointer-events-none select-none"
          >
            {VIRTUAL_DESKTOP_ICONS.map((item) => (
              <div
                key={item.id}
                className="w-[64px] flex flex-col items-center gap-0.5 text-center"
              >
                <DesktopIconVisual item={item} />
                <span className="w-full text-[9.5px] leading-tight font-normal text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] truncate">
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {!stage && (
            <div data-keep-dark="true" className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  summon(1300, 600);
                }}
                className="pointer-events-auto px-4 py-2.5 rounded-xl bg-white text-slate-900 text-[13px] font-bold shadow-xl cursor-pointer hover:bg-teal-50 hover:-translate-y-0.5 transition-all"
              >
                귀신검색창 다시 열기 (Ctrl + 0)
              </button>
            </div>
          )}

          {rect && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute rounded-xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.55)] border border-slate-300 bg-white transition-all duration-300 ease-out z-20"
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
                {/* 실제 귀신검색창 순정 타이틀 바 (크기 설명 문구 없음 · 순수 창 아이콘만 배치) */}
                <div className="h-9 px-3.5 flex items-center justify-between gap-2 bg-slate-900 text-white text-[12px] font-semibold">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src="/gwisinkachi_app_icon_512.png"
                      alt="귀신같이"
                      className="w-4 h-4 rounded-xs object-cover shrink-0"
                    />
                    <span className="font-bold text-white whitespace-nowrap">
                      귀신검색창
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={toggleWindowMaximize}
                      title={stage === 'large' ? '기본 창 크기로 복원' : '넓은 화면으로 펼치기'}
                      aria-label={stage === 'large' ? '기본 창 크기로 복원' : '넓은 화면으로 펼치기'}
                      className="w-6 h-6 rounded hover:bg-white/15 text-slate-200 hover:text-white text-[12px] flex items-center justify-center transition-colors cursor-pointer"
                    >
                      {stage === 'large' ? '⤡' : '⤢'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStage(null);
                      }}
                      title="창 닫기"
                      aria-label="창 닫기"
                      className="w-6 h-6 rounded hover:bg-rose-500 text-slate-300 hover:text-white text-[12px] flex items-center justify-center transition-colors cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="h-[calc(100%-2.25rem)] flex overflow-hidden bg-white">
                  <div className="flex-1 min-w-0 h-full overflow-y-auto">
                    <Stage1MinimalSearchPreview initialQuery={initialQuery} forceSampleOnly={true} />
                  </div>
                  {stage === 'medium' && (() => {
                    const topPhoto = resolveTopPhoto();
                    const topVideo = resolveTopVideo();
                    const topDoc = resolveTopDoc();
                    return (
                      <aside className="w-[310px] shrink-0 h-full border-l border-slate-200 bg-slate-50 p-3.5 flex flex-col gap-2.5 overflow-y-auto">
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
                            <div className="text-[11.5px] text-slate-700 leading-relaxed line-clamp-8 whitespace-pre-line bg-amber-50/70 p-2.5 rounded-lg border border-amber-200">
                              {maskSensitiveDocText(topDoc.extractedText) || '문서 미리보기'}
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedDocModal(topDoc)}
                              className="mt-auto w-full py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[12px] font-bold cursor-pointer transition-colors"
                            >
                              문서 본문 열기
                            </button>
                          </>
                        ) : topVideo ? (
                          <>
                            <div data-keep-dark="true" className="w-full h-[175px] rounded-lg overflow-hidden bg-black border border-slate-200 flex items-center justify-center relative">
                              {resolveVideoCardThumbUrl(topVideo) ? (
                                <img
                                  src={resolveVideoCardThumbUrl(topVideo)}
                                  alt={topVideo.videoFileName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-[12px] text-slate-400">{topVideo.videoFileName}</span>
                              )}
                              <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-teal-300 text-[10.5px] font-bold">
                                {cleanVideoTimestampLabel(topVideo.matchedTimestamp)} 구간
                              </span>
                            </div>
                            <div className="text-[12px] font-bold text-slate-900 truncate">
                              {topVideo.title}
                            </div>
                            <div className="text-[11.5px] text-slate-700 bg-amber-50/70 border border-amber-200 rounded-lg p-2 line-clamp-3">
                              {topVideo.ocrFullText || topVideo.matchedFrameCaption || topVideo.sceneDescription}
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedVideoModal(topVideo)}
                              className="mt-auto w-full py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[12px] font-bold cursor-pointer transition-colors"
                            >
                              해당 장면 재생
                            </button>
                          </>
                        ) : topPhoto ? (
                          <>
                            <div data-keep-dark="true" className="w-full h-[195px] rounded-lg overflow-hidden bg-black border border-slate-200 flex items-center justify-center">
                              <img
                                src={topPhoto.thumbUrl}
                                alt={topPhoto.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="text-[12px] font-bold text-slate-900 truncate">
                              {topPhoto.name}
                            </div>
                            <div className="text-[11.5px] text-slate-600 line-clamp-3">
                              {topPhoto.captionKo || topPhoto.tags.join(' · ')}
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedPhoto(topPhoto, null)}
                              className="mt-auto w-full py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[12px] font-bold cursor-pointer transition-colors"
                            >
                              사진 크게 보기
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

          {/* 가상 윈도우 작업표시줄 */}
          <div
            data-keep-dark="true"
            className="absolute bottom-0 inset-x-0 h-8 px-3 bg-black/80 backdrop-blur-md border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-300 z-10"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 text-white font-semibold cursor-default">
                <span className="grid grid-cols-2 gap-0.5 w-2.5 h-2.5">
                  <span className="bg-sky-400 rounded-[0.5px]" />
                  <span className="bg-sky-400 rounded-[0.5px]" />
                  <span className="bg-sky-400 rounded-[0.5px]" />
                  <span className="bg-sky-400 rounded-[0.5px]" />
                </span>
                <span>시작</span>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  summon(1300, 600);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/30 text-teal-300 font-semibold cursor-pointer transition-colors"
              >
                <img
                  src="/gwisinkachi_app_icon_512.png"
                  alt=""
                  className="w-3.5 h-3.5 rounded-xs object-cover"
                />
                <span>귀신같이 실행 중 (Ctrl + 0)</span>
              </button>
            </div>
            <div className="flex items-center gap-2.5 text-zinc-400 font-medium cursor-default">
              <span>한</span>
              <span>오후 2:05</span>
            </div>
          </div>
        </div>

        {/* 모니터 하단 턱 (Chin Bezel: 브랜드 마크 + 전원 LED) */}
        <div
          data-keep-dark="true"
          className="pt-2.5 px-4 flex items-center justify-between text-[11px] text-zinc-400"
        >
          <span className="w-16" />
          <span className="font-black tracking-[0.22em] text-zinc-400 text-[10.5px]">
            GHOSTI DISPLAY
          </span>
          <div className="flex items-center justify-end gap-1.5 w-16">
            <span className="text-[9.5px] text-zinc-500 font-semibold">POWER</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          </div>
        </div>
      </div>

      {/* 실제 모니터 다리 (목 Neck & 스탠드 받침대 Stand Base) */}
      <div
        data-keep-dark="true"
        className="w-24 h-7 border-x border-zinc-600/70 shadow-inner"
        style={{ background: 'linear-gradient(180deg, #18181b 0%, #3f3f46 50%, #27272a 100%)' }}
      />
      <div
        data-keep-dark="true"
        className="w-64 sm:w-80 h-3.5 rounded-t-2xl border-t border-zinc-500/70 shadow-lg"
        style={{ background: 'linear-gradient(90deg, #18181b 0%, #52525b 50%, #18181b 100%)' }}
      />
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
    <div className="flex-1 w-full min-h-full bg-[#D8E1EC]">
      <div className="w-full max-w-[1160px] mx-auto px-4 sm:px-6 md:px-8 py-6 flex flex-col gap-5 pb-20">
        {/* 1단: 귀신검색 정체성 슬로건 + '귀신검색창' 호출 안내 */}
        <div className="flex flex-wrap items-center justify-between gap-3 cursor-default">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[22px] sm:text-[25px] font-extrabold tracking-tight text-slate-900">
              귀신검색
            </h1>
            <p className="text-[15px] sm:text-[16px] font-bold text-slate-800 leading-snug">
              파일 이름 몰라도 열지 않고 1초 소환 — 계약서 속 문장, 사진 속 글자, 동영상 속 찾던 장면까지 찾아줍니다.
            </p>
            <p className="text-[13.5px] text-slate-600 leading-relaxed">
              바탕화면이나 작업 화면 어디서든 단축키 하나로 <strong className="font-bold text-slate-800">귀신검색창</strong>을 바로 열 수 있습니다.
            </p>
          </div>
          {connected && (
            <button
              type="button"
              aria-busy={isLaunchingRealWindow}
              onClick={() => void triggerRealGhostSearchWindow('medium', pendingQuery)}
              className="group inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white text-[13px] font-bold border-b-2 border-teal-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] cursor-pointer shrink-0 transition-all duration-150"
            >
              <span>{isLaunchingRealWindow ? '귀신검색창 여는 중...' : '귀신검색창 열기'}</span>
              <span className="transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true">
                ↗
              </span>
            </button>
          )}
        </div>

        {realPopupToast && (
          <div className="px-4 py-2.5 rounded-lg bg-white border border-slate-300 shadow-xs text-slate-800 text-[13px] font-medium cursor-default">
            {realPopupToast}
          </div>
        )}

        {/* 2단: 1단계 · 단축키 호출 연습 (미연결 시에도 100% 자유 체험) */}
        <section className="flex flex-col gap-2">
          <GhostSuperpowerDojo variant="basics" />
        </section>

        {/* 3단: 2단계 · 4가지 핵심 기능 × 귀신검색창 미리보기 일체형 체험 스테이지 */}
        <section
          ref={monitorSectionRef}
          className="p-5 rounded-2xl bg-white border border-slate-300 shadow-sm flex flex-col gap-4"
        >
          <GhostSearchDojoStampBoard variant="full" embeddedInCard={true} />

          <VirtualMonitorSimulator
            onStep={markStep}
            initialQuery={pendingQuery}
          />
        </section>

        {/* 4단: 최하단 마무리 배너 — 샘플 체험 후 내 컴퓨터 실전 연결 유도 */}
        {!connected ? (
          <section
            role="status"
            className="px-5 py-4 rounded-2xl bg-amber-50/95 border border-amber-300 border-l-[5px] border-l-amber-500 shadow-sm flex flex-wrap items-center justify-between gap-4 cursor-default"
          >
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-500/20 text-amber-900 text-[11px] font-bold tracking-tight">
                  샘플 체험 모드
                </span>
                <span className="text-[14.5px] font-extrabold text-amber-950">
                  체험해 보셨나요? 이제 내 컴퓨터를 연결해 진짜 내 문서·사진·영상을 1초 만에 찾아보세요!
                </span>
              </div>
              <span className="text-[13px] text-amber-900/85 leading-relaxed">
                위 화면은 체험용 샘플 미리보기입니다. 귀신비서에서 내 컴퓨터를 연결하면 바탕화면 어디서든 Ctrl + 0으로 내 실제 파일을 바로 찾습니다.
              </span>
            </div>
            <button
              type="button"
              data-allow-secretary-jump="true"
              onClick={jumpToGhostSecretary}
              className="group inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white text-[13px] font-bold border-b-2 border-teal-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-150 cursor-pointer shrink-0"
            >
              <span>귀신비서에서 내 컴퓨터 연결하기</span>
              <span className="transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true">
                →
              </span>
            </button>
          </section>
        ) : (
          <section className="px-5 py-4 rounded-2xl bg-white border border-slate-300 border-l-[5px] border-l-teal-600 shadow-sm flex flex-wrap items-center justify-between gap-4 cursor-default">
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-teal-500/15 text-teal-900 text-[11px] font-bold tracking-tight">
                  내 컴퓨터 연결됨
                </span>
                <span className="text-[14.5px] font-extrabold text-slate-900">
                  내 컴퓨터 연결이 완료되었습니다! 지금 바로 실제 귀신검색창을 열어 내 파일을 찾아보세요.
                </span>
              </div>
              <span className="text-[13px] text-slate-600 leading-relaxed">
                바탕화면에서 Ctrl + 0 (또는 Ctrl + 우클릭)을 누르거나 오른쪽 버튼을 누르면 실제 내 파일이 담긴 귀신검색창이 열립니다.
              </span>
            </div>
            <button
              type="button"
              aria-busy={isLaunchingRealWindow}
              onClick={() => void triggerRealGhostSearchWindow('medium', pendingQuery)}
              className="group inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white text-[13px] font-bold border-b-2 border-teal-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] cursor-pointer shrink-0 transition-all duration-150"
            >
              <span>{isLaunchingRealWindow ? '귀신검색창 여는 중...' : '실제 귀신검색창 열기'}</span>
              <span className="transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true">
                ↗
              </span>
            </button>
          </section>
        )}
      </div>
    </div>
  );
};

export default GhostSearchTrainingPage;
