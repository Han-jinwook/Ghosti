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

/** 로컬 귀신검색창이 여는 주소와 동일 (기존 웹 「찾기」 화면 100% 승계 전용 모드) */
export function ghostSearchWindowUrl(stage: GhostSearchStage, query?: string): string {
  const q = query && query.trim() ? `&q=${encodeURIComponent(query.trim())}` : '';
  return `/?preview=legacy&ghostSearchWindow=${stage}${q}`;
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

const VirtualMonitorSimulator: React.FC<{ onStep: (id: GameStepId) => void; initialQuery?: string }> = ({
  onStep,
  initialQuery = '',
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
    setStage('small');
    playBabyGhostChime('summon');
    onStep('summon');
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
      if (e.key === 'Escape') setStage(null);
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
              {holdProgress > 0 ? `우클릭 꾹… ${Math.round(holdProgress * 100)}%` : '빈 곳에서 Ctrl + 0 (우클릭 꾹~)'}
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
                        if (s !== 'small') onStep(s);
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
              <div className="h-[calc(100%-2rem)]" onMouseDown={(e) => e.stopPropagation()}>
                <iframe
                  key={rect.stage}
                  title="귀신검색창"
                  src={ghostSearchWindowUrl(rect.stage, initialQuery)}
                  className="w-full h-full border-0 bg-white"
                />
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
  const monitorSectionRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (pendingQuery) monitorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [pendingQuery]);

  useEffect(() => zCoreBridge.subscribe((c: boolean) => setConnected(c)), []);

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

  const gameDone = GAME_STEPS.every((s) => game[s.id]);

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 md:px-8 py-6 flex flex-col gap-5 pb-24">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-extrabold text-zinc-900 dark:text-white">👻 귀신검색</h1>
        <p className="text-[13.5px] text-zinc-500 dark:text-zinc-400">
          검색은 일하던 그 자리에서 — <strong className="text-zinc-800 dark:text-zinc-100">Ctrl + 0</strong> (우클릭 꾹~ / Ctrl+우클릭)
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-extrabold text-zinc-900 dark:text-white">STEP 1 · 소환술 3단 수련</h2>
        <GhostSuperpowerDojo variant="basics" />
      </section>

      <section ref={monitorSectionRef} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-extrabold text-zinc-900 dark:text-white">STEP 2 · 귀신검색 도장깨기</h2>
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
        <VirtualMonitorSimulator onStep={markStep} initialQuery={pendingQuery} />
      </section>

      <section
        className={`p-5 rounded-2xl border-2 flex flex-wrap items-center justify-between gap-3 ${
          gameDone ? 'border-amber-400 bg-amber-500/10' : 'border-zinc-200 dark:border-white/10'
        }`}
      >
        <span className="text-[14.5px] font-extrabold text-zinc-900 dark:text-white">
          🏁 마지막 미션 · 바탕화면으로 나가서 Ctrl + 0 (또는 우클릭 꾹~)을 눌러 내 진짜 파일을 불러보세요!
        </span>
        {!connected && (
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
