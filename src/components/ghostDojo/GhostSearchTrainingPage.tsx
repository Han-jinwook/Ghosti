import React, { useEffect, useRef, useState } from 'react';
import { zCoreBridge } from '../../services/zCoreBridge';
import {
  computeGhostSearchWindowRect,
  GHOST_SEARCH_STAGE_LABELS,
  DEFAULT_WORK_AREA,
  type GhostSearchStage,
} from '../../services/ghostSearchWindowGeometry';
import { SUMMON_HOLD_MS } from '../../services/ghostDojoEngine';
import { playBabyGhostChime } from '../OnboardingModal';
import { GhostSuperpowerDojo } from './GhostSuperpowerDojo';
import { Stage1MinimalSearchPreview } from '../Stage1MinimalPreview';

/** 로컬 귀신검색창이 여는 주소와 동일 (기존 웹 「찾기」 화면 100% 승계 전용 모드) */
export function ghostSearchWindowUrl(stage: GhostSearchStage, query?: string): string {
  const q = query && query.trim() ? `&q=${encodeURIComponent(query.trim())}` : '';
  return `/?dev=true&preview=legacy&ghostSearchWindow=${stage}${q}`;
}

/**
 * 로컬 엔진(127.0.0.1:5199 / 51988)이 연결되어 있을 때 가짜 웹 시뮬레이터 대신
 * 실제 모니터 위에 프레임리스 로컬 『👻 귀신검색창』 독립 팝업을 즉시 띄웁니다.
 */
export async function openRealGhostSearchWindowViaDaemon(
  stage: GhostSearchStage = 'medium',
  query?: string,
): Promise<boolean> {
  const daemonStage = stage === 'large' ? 'gallery' : stage;
  const q = (query || '').trim();
  try {
    const res = await fetch('http://127.0.0.1:5199/api/superpower/open_search_window', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: daemonStage, query: q }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data && data.ok !== false) return true;
    }
  } catch {
    // 5199 POST 실패 시 GET 또는 51988 폴백 시도
  }
  const qs = `stage=${encodeURIComponent(daemonStage)}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  for (const base of ['http://127.0.0.1:5199', 'http://127.0.0.1:51988']) {
    try {
      const res = await fetch(`${base}/__merlin/open-ghost-search?${qs}`);
      if (res.ok) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

/** 귀신비서 채팅이 넘겨준 검색어 (1회 소비) */
function consumePendingGhostSearchQuery(): string {
  try {
    const q = sessionStorage.getItem('ghosti_pending_ghost_search_query') || '';
    if (q) sessionStorage.removeItem('ghosti_pending_ghost_search_query');
    return q;
  } catch {
    return '';
  }
}

/**
 * 👻 2관문 『귀신검색』 웹 메뉴 (v1.3 — 웹 검색 입력창 폐지)
 *  - STEP 1 소환술 3단 수련 → STEP 2 귀신검색 도장깨기(가상 모니터 시뮬레이터) → 마지막 미션(바탕화면에서 Ctrl+0)
 *  - 가상 모니터 안의 귀신검색창 = 기존 웹 「찾기」 화면(구 ?preview=legacy) 100% 그대로 승계 — 실제 창과 같은 주소를 실제 픽셀 크기로 띄워 반응형 그대로 적용
 *  - 크기·위치는 데몬 compute_ghost_search_window_3stage_rect 와 동일 규칙(ghostSearchWindowGeometry.ts)
 */

const GAME_STORAGE_KEY = 'ghosti_search_game_v1';
type GameStepId = 'summon' | 'medium' | 'large';
const GAME_STEPS: Array<{ id: GameStepId; label: string }> = [
  { id: 'summon', label: '빈 곳에서 Ctrl + 0 (우클릭 꾹~)' },
  { id: 'medium', label: '중형으로 키워 사진·OCR 보기' },
  { id: 'large', label: '🖼️ 갤러리로 펼쳐보기' },
];

function loadGame(): Partial<Record<GameStepId, boolean>> {
  try {
    return JSON.parse(localStorage.getItem(GAME_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

const VirtualMonitorSimulator: React.FC<{
  onStep: (id: GameStepId) => void;
  initialQuery?: string;
  connected?: boolean;
  onOpenRealWindow?: (stage: GhostSearchStage, query?: string) => void;
}> = ({
  onStep,
  initialQuery = '',
  connected = false,
  onOpenRealWindow,
}) => {
  const monitorRef = useRef<HTMLDivElement | null>(null);
  const [monitorW, setMonitorW] = useState(960);
  // 귀신비서가 검색어를 넘겨준 경우 바로 중형 귀신검색창으로 결과를 펼쳐 보여줌
  const [stage, setStage] = useState<GhostSearchStage | null>(initialQuery ? 'medium' : null);
  const [anchor, setAnchor] = useState({ x: 1300, y: 600 });
  const [holdProgress, setHoldProgress] = useState(0);
  const holdRaf = useRef(0);
  const holdStart = useRef(0);

  useEffect(() => {
    const el = monitorRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setMonitorW(el.clientWidth));
    ro.observe(el);
    setMonitorW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const summon = (x?: number, y?: number) => {
    if (typeof x === 'number' && typeof y === 'number') setAnchor({ x, y });
    const nextStage: GhostSearchStage = initialQuery ? 'medium' : 'small';
    setStage(nextStage);
    playBabyGhostChime('summon');
    onStep('summon');
    if (nextStage === 'medium') onStep('medium');
    if (connected && onOpenRealWindow && initialQuery) {
      onOpenRealWindow(nextStage, initialQuery);
    }
  };

  // 페이지 안에서 Ctrl+0 → 가상 귀신검색창 소환 (브라우저 확대 초기화 단축키는 이 화면에서만 가로챔)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault();
        summon();
      }
      // 가상 모니터 시뮬레이터가 열려 있는 동안에는 글로벌 Escape가 창을 꺼버리지 않도록 보호 (닫기는 우상단 ✕ 버튼 전용)
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const scale = monitorW / DEFAULT_WORK_AREA.right;
  const rect = stage ? computeGhostSearchWindowRect(stage, anchor.x, anchor.y) : null;

  const toVirtual = (e: React.MouseEvent) => {
    const box = monitorRef.current?.getBoundingClientRect();
    if (!box) return { x: 1300, y: 600 };
    return { x: Math.round((e.clientX - box.left) / scale), y: Math.round((e.clientY - box.top) / scale) };
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={monitorRef}
        onContextMenu={(e) => e.preventDefault()}
        onMouseDown={(e) => {
          if (e.button !== 2 || stage) return;
          const pos = toVirtual(e);
          // Ctrl + 우클릭 시 홀드 대기 없이 즉시(0.01초) 귀신검색창 소환!
          if (e.ctrlKey && !e.altKey && !e.shiftKey) {
            cancelAnimationFrame(holdRaf.current);
            setHoldProgress(0);
            summon(pos.x, pos.y);
            return;
          }
          holdStart.current = performance.now();
          const tick = () => {
            const r = Math.min(1, (performance.now() - holdStart.current) / SUMMON_HOLD_MS);
            setHoldProgress(r);
            if (r >= 1) {
              setHoldProgress(0);
              summon(pos.x, pos.y);
              return;
            }
            holdRaf.current = requestAnimationFrame(tick);
          };
          holdRaf.current = requestAnimationFrame(tick);
        }}
        onMouseUp={() => {
          cancelAnimationFrame(holdRaf.current);
          setHoldProgress(0);
        }}
        className="relative w-full overflow-hidden rounded-xl border-4 border-zinc-700 bg-gradient-to-br from-sky-900 via-indigo-900 to-zinc-900 select-none"
        style={{ aspectRatio: `${DEFAULT_WORK_AREA.right} / ${DEFAULT_WORK_AREA.bottom}` }}
      >
        {/* 가짜 바탕화면 아이콘 */}
        <div className="absolute top-3 left-3 flex flex-col gap-3 text-[11px] text-white/80">
          {['📁 카톡 받은 파일', '📁 다운로드', '📄 견적서.xlsx'].map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
        {!stage && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="px-3 py-1.5 rounded-full bg-black/50 text-white text-[13px] font-extrabold">
              {holdProgress > 0 ? `우클릭 꾹… ${Math.round(holdProgress * 100)}%` : '빈 곳에서 Ctrl + 0 (우클릭 꾹~ / Ctrl+우클릭)'}
            </span>
          </div>
        )}
        {rect && (
          <div
            className="absolute rounded-lg overflow-hidden shadow-2xl border border-[#2DD4BF] bg-white dark:bg-zinc-950"
            style={{ left: rect.x * scale, top: rect.y * scale, width: rect.width * scale, height: rect.height * scale }}
          >
            <div
              className="origin-top-left"
              style={{ width: rect.width, height: rect.height, transform: `scale(${scale})` }}
            >
              <div className="h-8 px-2 flex items-center justify-between bg-zinc-900 text-white text-[12px] font-bold">
                <span>👻 귀신검색창 {rect.framelessAppMode ? '· 프레임리스 갤러리' : ''}</span>
                <div className="flex items-center gap-1">
                  {(['small', 'medium', 'large'] as GhostSearchStage[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        setStage(s);
                        onStep('summon');
                        if (s === 'medium') onStep('medium');
                        if (s === 'large') {
                          onStep('medium');
                          onStep('large');
                        }
                      }}
                      className={`px-2 py-0.5 rounded ${stage === s ? 'bg-[#2DD4BF] text-zinc-950' : 'bg-zinc-800'}`}
                    >
                      {GHOST_SEARCH_STAGE_LABELS[s]}
                    </button>
                  ))}
                  <button type="button" onClick={() => setStage(null)} className="px-2 py-0.5 rounded bg-zinc-800">
                    ✕
                  </button>
                </div>
              </div>
              <div
                className="h-[calc(100%-2rem)] overflow-y-auto bg-zinc-950"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Stage1MinimalSearchPreview initialQuery={initialQuery} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const GhostSearchTrainingPage: React.FC = () => {
  const [game, setGame] = useState(() => loadGame());
  const [connected, setConnected] = useState(zCoreBridge.isConnected);
  const [pendingQuery] = useState(() => consumePendingGhostSearchQuery());
  const [realPopupToast, setRealPopupToast] = useState<string | null>(null);
  const monitorSectionRef = useRef<HTMLElement | null>(null);

  const markStep = (id: GameStepId) => {
    setGame((prev) => {
      if (prev[id]) return prev;
      const next = { ...prev, [id]: true };
      try {
        localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const triggerRealGhostSearchWindow = async (stage: GhostSearchStage = 'medium', query?: string) => {
    playBabyGhostChime('summon');
    markStep('summon');
    if (stage === 'medium') markStep('medium');
    if (stage === 'large') {
      markStep('medium');
      markStep('large');
    }
    const ok = await openRealGhostSearchWindowViaDaemon(stage, query ?? pendingQuery);
    if (ok) {
      setRealPopupToast(
        `👻 내 진짜 PC 파일·사진·여권이 연동된 리얼 귀신검색창(${GHOST_SEARCH_STAGE_LABELS[stage]})을 모니터에 바로 띄웠습니다!`,
      );
      setTimeout(() => setRealPopupToast(null), 5000);
    }
  };

  useEffect(() => {
    if (pendingQuery) {
      monitorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (zCoreBridge.isConnected) {
        void triggerRealGhostSearchWindow('medium', pendingQuery);
      }
    }
  }, [pendingQuery]);

  useEffect(() => zCoreBridge.subscribe((c: boolean) => setConnected(c)), []);

  // 로컬 OS 귀신검색창(Tkinter / --app 독립창)에서 소환·중형·갤러리를 클릭했을 때도 위쪽 3대 미션 도장(✓)이 실시간 자동 각인되도록 동기화
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === GAME_STORAGE_KEY) {
        setGame(loadGame());
      }
    };
    window.addEventListener('storage', onStorage);

    let baseline: Record<string, number> | null = null;
    const pollTelemetry = async () => {
      try {
        const res = await fetch('http://127.0.0.1:5199/api/superpower/telemetry');
        if (!res.ok) return;
        const data = await res.json();
        const total = (data?.total || {}) as Record<string, number>;
        if (!baseline) {
          baseline = { ...total };
          return;
        }
        if (
          (total.ctrl0_summon_bar || 0) > (baseline.ctrl0_summon_bar || 0) ||
          (total.ghost_search_window_small || 0) > (baseline.ghost_search_window_small || 0)
        ) {
          markStep('summon');
        }
        if ((total.ghost_search_window_medium || 0) > (baseline.ghost_search_window_medium || 0)) {
          markStep('summon');
          markStep('medium');
        }
        if (
          (total.ghost_search_window_large || 0) > (baseline.ghost_search_window_large || 0) ||
          (total.ghost_search_window_gallery || 0) > (baseline.ghost_search_window_gallery || 0)
        ) {
          markStep('summon');
          markStep('medium');
          markStep('large');
        }
      } catch {
        /* ignore */
      }
    };
    void pollTelemetry();
    const timer = window.setInterval(() => void pollTelemetry(), 1200);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(timer);
    };
  }, []);

  const gameDone = GAME_STEPS.every((s) => game[s.id]);

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 md:px-8 py-6 flex flex-col gap-5 pb-24">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-extrabold text-zinc-900 dark:text-white">👻 귀신검색</h1>
        <p className="text-[13.5px] text-zinc-500 dark:text-zinc-400">
          검색은 일하던 그 자리에서 — <strong className="text-zinc-800 dark:text-zinc-100">Ctrl + 0</strong> (우클릭 꾹~ / Ctrl+우클릭)
        </p>
      </div>

      {connected && (
        <div className="p-4 rounded-2xl border-2 border-[#2DD4BF] bg-gradient-to-r from-[#2DD4BF]/15 via-teal-500/10 to-indigo-500/10 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              ⚡ 로컬 Z-코어 연결됨 · 가짜 시뮬레이터 대신 『내 진짜 PC 파일 리얼 귀신검색창』이 바로 뜹니다!
            </span>
            <span className="text-[12.5px] text-zinc-600 dark:text-zinc-300">
              지금 키보드에서 <strong>Ctrl + 0</strong>을 누르거나 아래 버튼을 누르면 방금 인덱싱된 내 진짜 사진·엑셀·여권이 담긴 실제 귀신검색창이 모니터에 팝업됩니다.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void triggerRealGhostSearchWindow('medium', pendingQuery)}
              className="px-4 py-2.5 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 text-[13px] font-extrabold shadow-md cursor-pointer transition-all"
            >
              👻 내 진짜 파일로 리얼 귀신검색창 바로 띄우기
            </button>
            <button
              type="button"
              onClick={() => void triggerRealGhostSearchWindow('large', pendingQuery)}
              className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white/10 dark:hover:bg-white/20 text-[12.5px] font-bold cursor-pointer transition-all"
            >
              🖼️ 갤러리(1440×900)로 바로 띄우기
            </button>
          </div>
        </div>
      )}

      {realPopupToast && (
        <div className="px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-emerald-700 dark:text-emerald-200 text-[13px] font-extrabold">
          {realPopupToast}
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-extrabold text-zinc-900 dark:text-white">STEP 1 · 소환술 3단 수련</h2>
        <GhostSuperpowerDojo variant="basics" />
      </section>

      <section ref={monitorSectionRef} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-extrabold text-zinc-900 dark:text-white">
            STEP 2 · 귀신검색 도장깨기 {connected ? '(Ctrl+0 입력 시 실제 로컬 귀신검색창 동시 팝업)' : '(엔진 미연결 시 웹 가상 모니터 체험)'}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {GAME_STEPS.map((s) => (
              <span
                key={s.id}
                className={`px-2.5 py-1 rounded-full text-[11.5px] font-bold border ${
                  game[s.id]
                    ? 'border-emerald-400 text-emerald-600 dark:text-emerald-300 bg-emerald-500/10'
                    : 'border-zinc-300 dark:border-white/15 text-zinc-500'
                }`}
              >
                {game[s.id] ? '✓ ' : ''}
                {s.label}
              </span>
            ))}
          </div>
        </div>
        <VirtualMonitorSimulator
          onStep={markStep}
          initialQuery={pendingQuery}
          connected={connected}
          onOpenRealWindow={(st, q) => void triggerRealGhostSearchWindow(st, q)}
        />
      </section>

      <section
        className={`p-5 rounded-2xl border-2 flex flex-wrap items-center justify-between gap-3 ${
          gameDone ? 'border-amber-400 bg-amber-500/10' : 'border-zinc-200 dark:border-white/10'
        }`}
      >
        <span className="text-[14.5px] font-extrabold text-zinc-900 dark:text-white">
          🏁 마지막 미션 · 바탕화면으로 나가서 Ctrl + 0 (또는 우클릭 꾹~)을 눌러 내 진짜 파일을 불러보세요!
        </span>
        {connected ? (
          <button
            type="button"
            onClick={() => void triggerRealGhostSearchWindow('medium', pendingQuery)}
            className="px-4 py-2.5 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 text-[13px] font-extrabold cursor-pointer"
          >
            👻 내 진짜 파일로 리얼 귀신검색창 바로 띄우기
          </button>
        ) : (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('openZCoreGuideModal'))}
            className="px-4 py-2.5 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 text-[13px] font-extrabold cursor-pointer"
          >
            ⚡ 10초 엔진 연결
          </button>
        )}
      </section>
    </div>
  );
};

export default GhostSearchTrainingPage;
