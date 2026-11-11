import React, { useEffect, useRef, useState } from 'react';
import { zCoreBridge } from '../../services/zCoreBridge';
import {
  computeGhostSearchWindowRect,
  resolveGhostSearchResponsiveSpec,
  GHOST_SEARCH_STAGE_LABELS,
  DEFAULT_WORK_AREA,
  type GhostSearchStage,
  type GhostSearchWindowMode,
} from '../../services/ghostSearchWindowGeometry';
import { SUMMON_HOLD_MS } from '../../services/ghostDojoEngine';
import { playBabyGhostChime } from '../OnboardingModal';
import { GhostSuperpowerDojo } from './GhostSuperpowerDojo';
import { Stage1MinimalSearchPreview } from '../Stage1MinimalPreview';
import { useSaySeeStore } from '../../store/useSaySeeStore';

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
  { id: 'summon', label: '① 빈 곳에서 Ctrl + 0 소환 (작게·슬림)' },
  { id: 'medium', label: '② 검색량에 따라 자율 확장 체험' },
  { id: 'large', label: '③ [⤢ 크게(갤러리)] 전환' },
];

function loadGame(): Partial<Record<GameStepId, boolean>> {
  try {
    return JSON.parse(localStorage.getItem(GAME_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

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
    badge: '🎬 자동 시연 1/4 · 바탕화면 우클릭 꾹~ (Ctrl+0)',
    desc: '가상 모니터 빈 곳에서 우클릭 꾹~(0.35초) 또는 Ctrl+0을 누르면 마우스 위치에 슬림한 귀신검색창이 소환됩니다.',
  },
  {
    phase: 1,
    stage: 'small',
    cursorPct: { x: 58, y: 34 },
    clicking: false,
    badge: '🎬 자동 시연 2/4 · [작게 모드 · 자율 슬림 520px] 시야 방해 없는 빠른 검색!',
    desc: '소환 직후나 단답 결과(1~3건)일 때는 시야를 가리지 않는 슬림한 크기를 스스로 유지합니다.',
  },
  {
    phase: 2,
    stage: 'medium',
    cursorPct: { x: 56, y: 28 },
    clicking: false,
    badge: '🎬 자동 시연 3/4 · [작게 모드 · 자율 확장 960×640] 검색 결과·사진에 맞춰 알아서 스르륵!',
    desc: '수동 버튼 없이도 검색 결과가 많아지거나 사진·문서 미리보기(OCR)가 잡히면 창이 알아서 쾌적하게 넓어집니다.',
  },
  {
    phase: 3,
    stage: 'large',
    cursorPct: { x: 82, y: 12 },
    clicking: true,
    badge: '🎬 자동 시연 4/4 · [⤢ 크게(갤러리) 1440×900] 일반 창처럼 크게/작게 단 2가지 모드!',
    desc: '수동 버튼은 우측 상단 [⤢ 크게(갤러리) ↔ ⤡ 작게] 단 1개뿐! 한눈에 크게 볼 때만 눌러주세요.',
  },
];

const VirtualMonitorSimulator: React.FC<{
  onStep: (id: GameStepId) => void;
  initialQuery?: string;
}> = ({
  onStep,
  initialQuery = '',
}) => {
  const {
    hasExecutedUserSearch,
    activeQuery,
    searchResults,
    matchedLocalDocs,
    matchedVaultPhotos,
    matchedVideoScenes,
  } = useSaySeeStore();
  const monitorRef = useRef<HTMLDivElement | null>(null);
  const [monitorW, setMonitorW] = useState(960);
  const [windowMode, setWindowMode] = useState<GhostSearchWindowMode>('compact');
  const [stage, setStage] = useState<GhostSearchStage | null>(initialQuery ? 'medium' : 'small');
  const [customSlimHeight, setCustomSlimHeight] = useState<number | undefined>(initialQuery ? undefined : 340);
  const [anchor, setAnchor] = useState({ x: 1300, y: 600 });
  const [holdProgress, setHoldProgress] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(!initialQuery);
  const [autoPhase, setAutoPhase] = useState<number>(initialQuery ? 2 : 1);
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

  // 자동 변신 시연 루프: 소환 -> 자율 슬림(520) -> 검색량 반응형 자율 확장(960) -> [⤢ 크게(갤러리)]
  useEffect(() => {
    if (!isAutoPlaying) return;
    const stepInfo = AUTO_MORPH_SCRIPT[autoPhase] || AUTO_MORPH_SCRIPT[1];
    setStage(stepInfo.stage);
    setWindowMode(stepInfo.stage === 'large' ? 'large' : 'compact');
    setCustomSlimHeight(stepInfo.stage === 'small' ? 340 : undefined);
    if (stepInfo.stage === 'small') {
      onStep('summon');
    } else if (stepInfo.stage === 'medium') {
      onStep('summon');
      onStep('medium');
    } else if (stepInfo.stage === 'large') {
      onStep('summon');
      onStep('medium');
      onStep('large');
    }
    const duration = stepInfo.stage === null ? 1600 : 2900;
    const timer = window.setTimeout(() => {
      setAutoPhase((prev) => (prev + 1) % AUTO_MORPH_SCRIPT.length);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [isAutoPlaying, autoPhase]);

  // 직접 조작 중 & '작게(compact)' 모드일 때: 창 안 검색어의 검색량·미리보기에 따라 소(520) ↔ 중(960) 자동 반응형 조절!
  useEffect(() => {
    if (isAutoPlaying || !stage || windowMode === 'large') return;
    const timer = window.setTimeout(() => {
      const cleanQ =
        hasExecutedUserSearch &&
        activeQuery &&
        !activeQuery.startsWith('전체 갤러리 사진') &&
        !activeQuery.startsWith('동영상 ') &&
        !activeQuery.startsWith('최근 서류 ')
          ? activeQuery.trim()
          : '';
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
      if (spec.stage === 'medium') {
        onStep('summon');
        onStep('medium');
      }
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
    onStep('summon');
    if (nextMode === 'large') {
      setStage('large');
      setCustomSlimHeight(undefined);
      setAutoPhase(3);
      onStep('medium');
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
      if (spec.stage === 'medium') onStep('medium');
    }
  };

  const summon = (x?: number, y?: number) => {
    setManualMode(
      'compact',
      typeof x === 'number' && typeof y === 'number' ? { x, y } : undefined,
    );
  };

  // 페이지 안에서 Ctrl+0 → 가상 귀신검색창 소환 (로컬 리얼 창은 띄우지 않고 가상 모니터 안에서만 깔끔하게 동작)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault();
        summon();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const scale = monitorW / DEFAULT_WORK_AREA.right;
  const rect = stage ? computeGhostSearchWindowRect(stage, anchor.x, anchor.y, DEFAULT_WORK_AREA, 20, customSlimHeight) : null;
  const currentScript = AUTO_MORPH_SCRIPT[autoPhase] || AUTO_MORPH_SCRIPT[1];

  const toVirtual = (e: React.MouseEvent) => {
    const box = monitorRef.current?.getBoundingClientRect();
    if (!box) return { x: 1300, y: 600 };
    return { x: Math.round((e.clientX - box.left) / scale), y: Math.round((e.clientY - box.top) / scale) };
  };

  return (
    <div className="flex flex-col items-center w-full select-none">
      {/* ─── 실제 모니터 베젤 (상단 카메라 + 메탈 프레임 + 하단 모니터 턱) ─── */}
      <div
        data-keep-dark="true"
        className="w-full rounded-[22px] p-3 sm:p-4 shadow-2xl border-2 border-zinc-600/80"
        style={{
          background: 'linear-gradient(180deg, #27272a 0%, #18181b 50%, #09090b 100%)',
          boxShadow: '0 22px 50px -12px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
        }}
      >
        {/* 모니터 상단 베젤 (웹캠 렌즈 + 움짤/직접조작 상태 컨트롤 바) */}
        <div
          data-keep-dark="true"
          className="flex flex-wrap items-center justify-between gap-2 px-3 pb-2.5 text-[11.5px] text-zinc-300"
        >
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/50 text-[#5EEAD4] font-extrabold">
              🖥️ 가상 모니터 시뮬레이터
            </span>
            <span className="text-zinc-400 hidden sm:inline">
              {isAutoPlaying
                ? '자동 변신 움짤 시연 중 · 변신하는 도중에도 안쪽 버튼을 직접 마우스로 눌러보세요!'
                : '👆 직접 조작 체험 중 · 모니터 안의 버튼과 검색창을 자유롭게 눌러보세요!'}
            </span>
          </div>

          {/* 중앙 웹캠 렌즈 & 센서 LED */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-black/50 border border-white/10">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-800 border border-zinc-500 shadow-inner" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-zinc-400 font-bold tracking-wider">CAM</span>
          </div>

          {/* 우측 2모드(작게/크게) 토글 & 자동 시연 재생/일시정지 컨트롤 */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setManualMode(stage === 'large' ? 'compact' : 'large')}
              className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold cursor-pointer transition-all ${
                stage === 'large'
                  ? 'bg-[#2DD4BF] text-zinc-950 shadow-sm'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-[#5EEAD4] border border-[#2DD4BF]/40'
              }`}
            >
              {stage === 'large' ? '⤡ 작게 (자율 모드)' : '⤢ 크게 (갤러리)'}
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
              className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold cursor-pointer transition-all border ${
                isAutoPlaying
                  ? 'bg-amber-400/20 border-amber-300/60 text-amber-200 hover:bg-amber-400/30'
                  : 'bg-emerald-400/20 border-emerald-300/60 text-emerald-200 hover:bg-emerald-400/30'
              }`}
            >
              {isAutoPlaying ? '⏸ 시연 일시정지' : '▶ 자동 시연 다시 재생'}
            </button>
          </div>
        </div>

        {/* ─── 모니터 실제 LCD 화면 영역 (라이트모드 탈색 원천 차단) ─── */}
        <div
          ref={monitorRef}
          data-keep-dark="true"
          onContextMenu={(e) => e.preventDefault()}
          onMouseDown={(e) => {
            if (e.button !== 2) return;
            const pos = toVirtual(e);
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
          className="relative w-full overflow-hidden rounded-xl border-2 border-black shadow-inner"
          style={{
            aspectRatio: `${DEFAULT_WORK_AREA.right} / ${DEFAULT_WORK_AREA.bottom}`,
            background: 'linear-gradient(135deg, #0c192c 0%, #172554 42%, #1e1b4b 74%, #09090b 100%)',
          }}
        >
          {/* 가상 모니터 배경 데스크톱 월페이퍼 은은한 그리드 & 광원 */}
          <div
            data-keep-dark="true"
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              backgroundImage:
                'radial-gradient(circle at 75% 25%, rgba(45, 212, 191, 0.35), transparent 45%), radial-gradient(circle at 25% 75%, rgba(99, 102, 241, 0.3), transparent 50%)',
            }}
          />

          {/* 가짜 바탕화면 아이콘 (좌측 정렬) */}
          <div data-keep-dark="true" className="absolute top-3.5 left-3.5 flex flex-col gap-3 text-[11px] text-white font-semibold drop-shadow">
            {[
              { icon: '📁', name: '카톡 받은 파일' },
              { icon: '📁', name: '다운로드' },
              { icon: '📊', name: '2026_견적서.xlsx' },
              { icon: '🖼️', name: '가족여행_바다.jpg' },
            ].map((item) => (
              <div
                key={item.name}
                onClick={() => setManualMode(windowMode)}
                className="flex flex-col items-center gap-0.5 w-20 p-1.5 rounded-lg bg-black/25 hover:bg-white/15 border border-white/10 cursor-pointer transition-colors text-center"
              >
                <span className="text-[18px] leading-none">{item.icon}</span>
                <span className="truncate w-full text-[10px] text-white/90">{item.name}</span>
              </div>
            ))}
          </div>

          {/* 상단 현재 변신 단계 캡션 배너 (시연 설명 + 직접 클릭 안내) */}
          <div
            data-keep-dark="true"
            className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-0.5 px-3.5 py-1.5 rounded-full bg-black/75 border border-[#2DD4BF]/50 text-white shadow-lg backdrop-blur-sm max-w-[92%]"
          >
            <span className="text-[11.5px] font-extrabold text-[#5EEAD4] truncate">
              {isAutoPlaying
                ? currentScript.badge
                : `👆 직접 조작 중 · 현재 [${stage ? GHOST_SEARCH_STAGE_LABELS[stage] : '바탕화면 대기'}] 상태입니다`}
            </span>
            <span className="text-[10.5px] text-zinc-200 truncate hidden sm:inline">
              {isAutoPlaying
                ? currentScript.desc
                : '검색어를 입력하면 결과 양에 맞춰 소↔중 크기가 자동 조절되며, 수동 버튼은 [⤢ 크게(갤러리) / ⤡ 작게] 딱 하나입니다!'}
            </span>
          </div>

          {/* 소환 대기 상태 안내 (창이 닫혀 있을 때) */}
          {!stage && (
            <div data-keep-dark="true" className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                onClick={() => summon(1300, 600)}
                className="px-4 py-2.5 rounded-full bg-black/70 hover:bg-black/85 border-2 border-[#2DD4BF] text-white text-[13px] font-extrabold shadow-xl cursor-pointer transition-all flex items-center gap-2"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#2DD4BF] animate-ping" />
                {holdProgress > 0
                  ? `우클릭 꾹… ${Math.round(holdProgress * 100)}%`
                  : '🖱️ 여기를 클릭하거나 우클릭 꾹~ / Ctrl+0으로 귀신검색창 소환하기'}
              </button>
            </div>
          )}

          {/* ─── 자율 반응형(소↔중) + 크게/작게 2모드 가상 귀신검색창 ─── */}
          {rect && (
            <div
              data-keep-dark="true"
              onMouseDown={() => {
                if (isAutoPlaying) setIsAutoPlaying(false);
              }}
              className="absolute rounded-xl overflow-hidden shadow-2xl border-2 border-[#2DD4BF] bg-zinc-950 transition-all duration-500 ease-out z-20"
              style={{
                left: rect.x * scale,
                top: rect.y * scale,
                width: rect.width * scale,
                height: rect.height * scale,
                boxShadow: '0 20px 45px rgba(0,0,0,0.75), 0 0 0 1px rgba(45,212,191,0.35)',
              }}
            >
              <div
                className="origin-top-left"
                style={{ width: rect.width, height: rect.height, transform: `scale(${scale})` }}
              >
                <div
                  data-keep-dark="true"
                  className="h-9 px-3 flex items-center justify-between bg-zinc-900 border-b border-zinc-800 text-white text-[12px] font-bold"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[#2DD4BF] font-extrabold">
                      👻 귀신검색창{' '}
                      {rect.framelessAppMode
                        ? '· 크게 (스마트 갤러리 1440×900)'
                        : stage === 'medium'
                          ? '· 작게 (검색량 반응형 확장 · 960×640)'
                          : '· 작게 (자율 슬림 · 520px)'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-teal-500/20 text-[#5EEAD4] text-[10.5px] font-extrabold">
                      {rect.framelessAppMode ? '🖼️ 전체 갤러리' : '✨ 크기 자율 호흡 중'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => setManualMode(stage === 'large' ? 'compact' : 'large')}
                      className={`px-2.5 py-0.5 rounded font-extrabold cursor-pointer transition-all ${
                        stage === 'large'
                          ? 'bg-[#2DD4BF] text-zinc-950 shadow-sm ring-2 ring-[#5EEAD4]/60'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-[#5EEAD4] border border-[#2DD4BF]/40'
                      }`}
                    >
                      {stage === 'large' ? '⤡ 작게' : '⤢ 크게(갤러리)'}
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => setManualMode(null)}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-rose-600 text-zinc-200 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div
                  className="h-[calc(100%-2.25rem)] overflow-y-auto bg-zinc-950"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (isAutoPlaying) setIsAutoPlaying(false);
                  }}
                >
                  <Stage1MinimalSearchPreview initialQuery={initialQuery} />
                </div>
              </div>
            </div>
          )}

          {/* 자동 시연 모드일 때 움직이는 가상 마우스 커서 & 클릭 파동 이펙트 */}
          {isAutoPlaying && (
            <div
              data-keep-dark="true"
              className="absolute z-30 pointer-events-none transition-all duration-700 ease-in-out flex items-center gap-1.5"
              style={{
                left: `${currentScript.cursorPct.x}%`,
                top: `${currentScript.cursorPct.y}%`,
              }}
            >
              <div className="relative flex items-center justify-center">
                {currentScript.clicking && (
                  <span className="absolute -inset-3 rounded-full border-2 border-[#2DD4BF] bg-[#2DD4BF]/25 animate-ping" />
                )}
                <span className="text-[22px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">🖱️</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-black/85 border border-[#2DD4BF] text-[#5EEAD4] text-[10.5px] font-extrabold whitespace-nowrap shadow-lg">
                {autoPhase === 0
                  ? '우클릭 꾹~ 소환!'
                  : autoPhase === 1
                    ? '작게 모드 · 자율 슬림(520px)'
                    : autoPhase === 2
                      ? '검색 결과↑ → 알아서 960×640 확장!'
                      : '[⤢ 크게(갤러리)] 클릭 전환!'}
              </span>
            </div>
          )}

          {/* 가상 윈도우 작업표시줄 (Taskbar) */}
          <div
            data-keep-dark="true"
            className="absolute bottom-0 inset-x-0 h-7 px-3 bg-black/80 backdrop-blur-md border-t border-white/10 flex items-center justify-between text-[10.5px] text-zinc-300 z-10 pointer-events-none"
          >
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-white/10 text-white font-bold">🪟 시작</span>
              <span className="px-2 py-0.5 rounded bg-[#2DD4BF]/20 text-[#5EEAD4] font-bold">
                👻 귀신같이 트레이 상주 중 (Ctrl+0)
              </span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400 font-semibold">
              <span>KOR</span>
              <span>🔊</span>
              <span>오후 2:05</span>
            </div>
          </div>
        </div>

        {/* 모니터 하단 턱 (Chin Bezel: 브랜드 로고 + 전원 LED) */}
        <div
          data-keep-dark="true"
          className="pt-2.5 px-4 flex items-center justify-between text-[11px] text-zinc-400"
        >
          <span className="text-[10.5px] text-zinc-400">
            💡 팁: 변신 움짤이 돌아가는 중에도 창 안의 버튼을 직접 클릭하면 즉시 <strong>직접 조작 모드</strong>로 전환됩니다.
          </span>
          <span className="font-black tracking-[0.2em] text-zinc-300 text-[11px] hidden sm:inline">
            GHOSTI STUDIO DISPLAY
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-400">POWER</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          </div>
        </div>
      </div>

      {/* ─── 실제 모니터 목(Neck) & 받침대(Stand Base) ─── */}
      <div
        data-keep-dark="true"
        className="w-24 h-6 border-x border-zinc-600/60 shadow-inner"
        style={{ background: 'linear-gradient(180deg, #18181b 0%, #3f3f46 50%, #27272a 100%)' }}
      />
      <div
        data-keep-dark="true"
        className="w-64 sm:w-80 h-3.5 rounded-t-2xl border-t border-zinc-500/60 shadow-lg"
        style={{ background: 'linear-gradient(90deg, #18181b 0%, #52525b 50%, #18181b 100%)' }}
      />
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

      {realPopupToast && (
        <div className="px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-emerald-700 dark:text-emerald-200 text-[13px] font-extrabold">
          {realPopupToast}
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-extrabold text-zinc-900 dark:text-white">STEP 1 · 소환술 3단 수련</h2>
        <GhostSuperpowerDojo variant="basics" />
      </section>

      <section ref={monitorSectionRef} className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-extrabold text-zinc-900 dark:text-white">
            STEP 2 · 귀신검색 도장깨기 (🖥️ 자율 반응형 크기 조절 &amp; [크게 / 작게] 2모드 체험)
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

        <div className="px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-400/40 text-zinc-800 dark:text-amber-100 text-[12.5px] leading-relaxed flex flex-wrap items-center justify-between gap-2">
          <span>
            💡 <strong>안내:</strong> 현재는 <strong>개발 중인 상태의 검색창 UI를 반영해 자동 변신 움짤(시뮬레이션)</strong>로 제작되어 있으며,{' '}
            <strong>향후 검색창 UI가 최종 완성되면 그때 다시 움짤을 새로 만들 예정</strong>입니다.{' '}
            <span className="text-teal-700 dark:text-[#5EEAD4] font-extrabold">
              (움짤이 변신하는 도중에도 모니터 안의 버튼들을 직접 마우스로 눌러보실 수 있습니다!)
            </span>
          </span>
        </div>

        <VirtualMonitorSimulator
          onStep={markStep}
          initialQuery={pendingQuery}
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
            onClick={() => void triggerRealGhostSearchWindow(pendingQuery ? 'medium' : 'small', pendingQuery)}
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
