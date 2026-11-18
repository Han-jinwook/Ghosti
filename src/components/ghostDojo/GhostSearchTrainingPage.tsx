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
import { GHOST_SECRETARY_AVATAR_SRC } from '../../services/ghostSecretaryEngine';

/** 로컬 귀신검색창이 여는 주소와 동일 (기존 웹 「찾기」 화면 100% 승계 전용 모드) */
export function ghostSearchWindowUrl(stage: GhostSearchStage, query?: string): string {
  const q = query && query.trim() ? `&q=${encodeURIComponent(query.trim())}` : '';
  return `/?dev=true&preview=legacy&ghostSearchWindow=${stage}${q}`;
}

/**
 * 로컬 엔진(127.0.0.1:5199 / 51988)이 연결되어 있을 때
 * 가상 모니터 안의 창(`/?dev=true&preview=legacy&ghostSearchWindow=...`)과 100% 동일한
 * 실제 모니터 위 독립 귀신검색창 팝업을 즉시 띄웁니다.
 */
let _activeRealGhostSearchPopup: Window | null = null;
let _openGhostSearchInflight = false;
let _lastOpenGhostSearchTs = 0;

export async function openRealGhostSearchWindowViaDaemon(
  stage: GhostSearchStage = 'medium',
  query?: string,
): Promise<boolean> {
  const now = Date.now();
  if (_openGhostSearchInflight || now - _lastOpenGhostSearchTs < 1800) {
    return true;
  }
  _openGhostSearchInflight = true;
  _lastOpenGhostSearchTs = now;

  try {
    const targetStage: GhostSearchStage = stage === 'large' ? 'large' : 'medium';
    const daemonStage = targetStage === 'large' ? 'gallery' : targetStage;
    const q = (query || '').trim();
    const wasZCoreConnected = zCoreBridge.isConnected;
    const reqStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

    // 1순위: 로컬 제트코어 연결 시 주소창·설치아이콘 없는 깔끔한 독립 앱 창(--app) 단일 오픈!
    // ⚠️ 기존 700ms 짧은 타임아웃으로 인해 Z-코어가 이미 chrome.exe --app 창(1번 창)을 띄우는 도중
    // 브라우저 fetch가 타임아웃되어 아래 window.open 폴백(2번 창)까지 중복 실행되던 레이스 버그를 원천 차단합니다.
    try {
      const res = await fetch(getZCoreUrl('/api/superpower/open_search_window'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: daemonStage, query: q, ui_mode: 'web_monitor' }),
        signal: AbortSignal.timeout(wasZCoreConnected ? 4500 : 650),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data && data.ok !== false && data.launched !== false) return true;
      } else if (res.status === 404 || res.status === 405) {
        const qs = `stage=${encodeURIComponent(daemonStage)}&ui_mode=web_monitor${q ? `&q=${encodeURIComponent(q)}` : ''}`;
        const resGet = await fetch(getZCoreUrl(`/__merlin/open-ghost-search?${qs}`), {
          signal: AbortSignal.timeout(wasZCoreConnected ? 4500 : 650),
        });
        if (resGet.ok) {
          const dataGet = await resGet.json().catch(() => ({}));
          if (dataGet?.ok !== false && dataGet?.launched !== false) return true;
        }
      }
    } catch (err) {
      const elapsed =
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - reqStartedAt;
      const errName = (err as { name?: string } | null)?.name || '';
      // Z-코어가 연결된 상태에서 타임아웃/지연이 발생한 경우 서버는 이미 요청을 수신해 --app 창을 기동 중이므로
      // 절대 window.open 2차 팝업을 추가로 띄우지 않습니다! (즉각적인 TCP 연결 거부 < 350ms 일 때만 폴백 허용)
      if (
        wasZCoreConnected &&
        (errName === 'TimeoutError' || errName === 'AbortError' || elapsed >= 350)
      ) {
        return true;
      }
    }

    // 2순위 폴백: 제트코어 미실행 웹 환경에서만 단일 브라우저 팝업으로 오픈
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
          _activeRealGhostSearchPopup.location.href = targetUrl;
          _activeRealGhostSearchPopup.resizeTo(rect.width, rect.height);
          _activeRealGhostSearchPopup.moveTo(rect.x, rect.y);
          _activeRealGhostSearchPopup.focus();
          return true;
        }
        const win = window.open(targetUrl, 'ghosti_real_search_window', features);
        if (win) {
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
  { id: 'summon', label: '① [작게] 모드 소환 (Ctrl + 0)' },
  { id: 'large', label: '② [⤢ 크게(갤러리)] 모드 전환' },
];

const SIMULATOR_WORK_AREA = { left: 0, top: 0, right: 1120, bottom: 660 };

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
    badge: '🎬 자동 시연 1/3 · 바탕화면 Ctrl + 0 / Ctrl + 우클릭 1초 소환',
    desc: '가상 모니터 빈 곳에서 Ctrl + 0 또는 Ctrl + 우클릭을 누르면 마우스 위치에 귀신검색창이 즉시 소환됩니다.',
  },
  {
    phase: 1,
    stage: 'small',
    cursorPct: { x: 56, y: 32 },
    clicking: false,
    badge: '🎬 자동 시연 2/3 · [작게 모드] 빠른 검색 & 결과 요약 미리보기!',
    desc: '작게 모드에서도 사진·동영상·문서 검색 결과와 첫 번째 요약 미리보기가 한눈에 또렷하게 보입니다.',
  },
  {
    phase: 2,
    stage: 'large',
    cursorPct: { x: 82, y: 12 },
    clicking: true,
    badge: '🎬 자동 시연 3/3 · [⤢ 크게(갤러리)] 넓게 펼쳐 보는 전체 갤러리 모드!',
    desc: '보기 모드는 [작게] / [크게(갤러리)] 단 2가지! 실제 창이 띄워지면 테두리를 잡고 자유롭게 크기 조절도 가능합니다.',
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
    photos,
    searchSpace,
    hasExecutedUserSearch,
    activeQuery,
    searchResults,
    matchedLocalDocs,
    matchedVaultPhotos,
    videoSceneItems,
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

  // 자동 변신 시연 루프: 소환 -> 자율 슬림(520) -> 검색량 반응형 자율 확장(960) -> [⤢ 크게(갤러리)]
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

  // 직접 조작 중 & '작게(compact)' 모드일 때: 창 안 검색어의 검색량·미리보기에 따라 소(520) ↔ 중(960) 자동 반응형 조절!
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
    // 사용자가 검색어를 직접 입력하지 않은 상태에서 이미 중형(960×640) 창이 열려 있다면 임의로 소형(520)으로 축소하지 않음
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
      if (nextStage === 'large') {
        onStep('large');
      } else {
        onStep('summon');
        if (nextStage === 'medium') onStep('medium');
      }
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
      onStep('summon');
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
      onStep('summon');
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

  // 페이지 안에서 Ctrl+0 → 가상 귀신검색창 소환 (엔진 미연결 시에는 귀여운 '귀신비서 먼저 대화' 안내창 노출)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault();
        if (!connected) {
          openGhostSecretaryFirstModal({ context: 'default' });
          return;
        }
        summon();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const scale = monitorW / SIMULATOR_WORK_AREA.right;
  const rect = stage
    ? stage === 'large'
      ? {
          stage: 'large' as const,
          x: 16,
          y: 36,
          width: 1088,
          height: 590,
          framelessAppMode: true,
        }
      : {
          stage: 'small' as const,
          x: 100,
          y: 52,
          width: 920,
          height: 540,
          framelessAppMode: false,
        }
    : null;
  const currentScript = AUTO_MORPH_SCRIPT[autoPhase] || AUTO_MORPH_SCRIPT[1];

  const toVirtual = (e: React.MouseEvent) => {
    const box = monitorRef.current?.getBoundingClientRect();
    if (!box) return { x: 560, y: 330 };
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
              🖥️ 체험판 검색창 (웹 미리보기)
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

          {/* 우측 [작게·크게] 2가지 보기 모드 버튼 & 자동 시연 재생/일시정지 컨트롤 */}
          <div className="flex flex-wrap items-center gap-1.5" data-allow-secretary-jump="true">
            {([
              { id: 'small' as const, label: '작게' },
              { id: 'large' as const, label: '크게(갤러리)' },
            ]).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => selectExplicitStage(btn.id)}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold cursor-pointer transition-all ${
                  (btn.id === 'large' ? stage === 'large' : stage === 'small' || stage === 'medium')
                    ? 'bg-[#2DD4BF] text-zinc-950 shadow-sm'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-[#5EEAD4] border border-[#2DD4BF]/40'
                }`}
              >
                [{btn.label}]
              </button>
            ))}
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
          className="relative w-full overflow-hidden rounded-xl border-2 border-black shadow-inner"
          style={{
            aspectRatio: `${SIMULATOR_WORK_AREA.right} / ${SIMULATOR_WORK_AREA.bottom}`,
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
                {'🖱️ 여기를 클릭하거나 Ctrl + 0 / Ctrl + 우클릭으로 체험판 검색창 열어보기'}
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
                      👻 체험판 검색창
                    </span>
                    <span className="px-2 py-0.5 rounded bg-teal-500/20 text-[#5EEAD4] text-[10.5px] font-extrabold">
                      {rect.framelessAppMode ? '🖼️ 전체 갤러리 뷰' : '✨ 검색 결과에 맞춰 자동 크기 조절'}
                    </span>
                  </div>
                </div>
                <div
                  className="h-[calc(100%-2.25rem)] flex overflow-hidden bg-zinc-950"
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
                      <aside className="w-[330px] shrink-0 h-full border-l border-[#2DD4BF]/40 bg-[#0F172A] p-3.5 flex flex-col gap-2.5 overflow-y-auto">
                        <div className="text-[12.5px] font-extrabold text-[#5EEAD4] flex items-center gap-1.5">
                          <span>👻 첫 번째 결과 요약 미리보기</span>
                        </div>
                        {topDoc ? (
                          <>
                            <div className="w-full p-3 rounded-lg bg-slate-900/90 border border-slate-700 flex flex-col gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded bg-teal-500/20 text-[#5EEAD4] text-[10px] font-extrabold">
                                  {topDoc.ext?.toUpperCase() || 'DOC'}
                                </span>
                                <span className="text-[10.5px] text-slate-400 truncate">
                                  {topDoc.categoryBadge || '내 PC 문서'}
                                </span>
                              </div>
                              <div className="text-[12px] font-bold text-slate-100 break-all">
                                📄 {topDoc.fileName}
                              </div>
                            </div>
                            <div className="text-[11px] text-slate-300 leading-relaxed line-clamp-8 whitespace-pre-line bg-black/30 p-2.5 rounded-lg border border-white/5">
                              {maskSensitiveDocText(topDoc.extractedText) || '문서 본문 미리보기 준비 완료'}
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedDocModal(topDoc)}
                              className="mt-auto w-full py-2 rounded-lg bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 text-[12px] font-extrabold cursor-pointer transition-colors"
                            >
                              📄 문서 내용 상세 보기
                            </button>
                          </>
                        ) : topVideo ? (
                          <>
                            <div className="w-full h-[180px] rounded-lg overflow-hidden bg-black border border-slate-700 flex items-center justify-center relative">
                              {resolveVideoCardThumbUrl(topVideo) ? (
                                <img
                                  src={resolveVideoCardThumbUrl(topVideo)}
                                  alt={topVideo.videoFileName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-[12px] text-slate-400 font-bold">🎬 {topVideo.videoFileName}</span>
                              )}
                              <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-[#5EEAD4] text-[10.5px] font-extrabold">
                                🎯 {cleanVideoTimestampLabel(topVideo.matchedTimestamp)}
                              </span>
                            </div>
                            <div className="text-[11.5px] font-bold text-slate-200 truncate">
                              🎬 {topVideo.videoFileName}
                            </div>
                            <div className="text-[11px] text-slate-400 line-clamp-3">
                              {topVideo.matchedFrameCaption || topVideo.sceneDescription}
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedVideoModal(topVideo)}
                              className="mt-auto w-full py-2 rounded-lg bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 text-[12px] font-extrabold cursor-pointer transition-colors"
                            >
                              ▶ 해당 장면 바로 재생하기
                            </button>
                          </>
                        ) : topPhoto ? (
                          <>
                            <div className="w-full h-[200px] rounded-lg overflow-hidden bg-black border border-slate-700 flex items-center justify-center">
                              <img
                                src={topPhoto.thumbUrl}
                                alt={topPhoto.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="text-[11.5px] font-bold text-slate-200 truncate">
                              🖼️ {topPhoto.name}
                            </div>
                            <div className="text-[11px] text-slate-400 line-clamp-3">
                              {topPhoto.captionKo || topPhoto.tags.join(' · ')}
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedPhoto(topPhoto, null)}
                              className="mt-auto w-full py-2 rounded-lg bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 text-[12px] font-extrabold cursor-pointer transition-colors"
                            >
                              🔍 상세 크게 보기 / 사진·OCR 열기
                            </button>
                          </>
                        ) : (
                          <div className="text-[11.5px] text-slate-400">
                            현재 탭의 첫 번째 검색 결과 요약이 이곳에 자동으로 표시됩니다.
                          </div>
                        )}
                      </aside>
                    );
                  })()}
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
                  ? 'Ctrl + 0 / Ctrl + 우클릭 소환!'
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
  const [isLaunchingRealWindow, setIsLaunchingRealWindow] = useState(false);
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
    if (isLaunchingRealWindow) return;
    setIsLaunchingRealWindow(true);
    window.setTimeout(() => setIsLaunchingRealWindow(false), 1600);
    playBabyGhostChime('summon');
    if (stage === 'large') {
      markStep('large');
    } else {
      markStep('summon');
      if (stage === 'medium') markStep('medium');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ghosti_focus_virtual_monitor_window', { detail: { stage } }),
      );
    }
    const ok = await openRealGhostSearchWindowViaDaemon(stage, query ?? pendingQuery);
    if (ok) {
      setRealPopupToast(
        `👻 내 진짜 PC 파일·사진·여권이 연동된 귀신검색창(${GHOST_SEARCH_STAGE_LABELS[stage]})을 모니터에 바로 띄웠습니다!`,
      );
      setTimeout(() => setRealPopupToast(null), 5000);
    } else {
      monitorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  useEffect(() => {
    if (pendingQuery) {
      monitorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [pendingQuery]);

  useEffect(() => zCoreBridge.subscribe((c: boolean) => setConnected(c)), []);

  // 로컬 OS 귀신검색창(Tkinter / --app 독립창)에서 소환·중형·갤러리를 클릭했을 때도 위쪽 도장(✓)이 개별 단계별로만 정확히 각인되도록 동기화
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === GAME_STORAGE_KEY) {
        setGame(loadGame());
      }
    };
    window.addEventListener('storage', onStorage);

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
          (total.ghost_search_window_small || 0) > (prevBase.ghost_search_window_small || 0)
        ) {
          markStep('summon');
        }
        if ((total.ghost_search_window_medium || 0) > (prevBase.ghost_search_window_medium || 0)) {
          markStep('summon');
          markStep('medium');
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
          파일 이름 몰라도, 열지 않고 1초 소환 — <strong className="text-zinc-800 dark:text-zinc-100">Ctrl + 0</strong> / <strong className="text-zinc-800 dark:text-zinc-100">Ctrl + 우클릭</strong>
        </p>
      </div>

      {!connected && (
        <div className="px-4 py-3.5 rounded-2xl bg-gradient-to-r from-teal-500/15 via-emerald-500/10 to-zinc-900/40 border-2 border-[#2DD4BF]/50 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={GHOST_SECRETARY_AVATAR_SRC}
              alt="귀신비서"
              className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-[#2DD4BF]/50 p-1 object-contain shrink-0"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-[13.5px] font-black text-zinc-900 dark:text-white">
                👀 지금은 눈으로 편하게 구경 중이에요! (스크롤·화면 구경 자유)
              </span>
              <span className="text-[12px] text-zinc-600 dark:text-zinc-300 font-semibold">
                버튼을 눌러 직접 소환하거나 <strong>내 진짜 사진·문서로 리얼 테스트</strong>를 해보시려면, 먼저 첫 번째 메뉴인 <strong>『👻 귀신비서』</strong>와 대화를 나누고 오세요! 헤헤 👻
              </span>
            </div>
          </div>
          <button
            type="button"
            data-allow-secretary-jump="true"
            onClick={jumpToGhostSecretary}
            className="px-4 py-2.5 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 text-[12.5px] font-black shadow-md transition-all cursor-pointer shrink-0"
          >
            👻 &apos;귀신비서&apos;와 먼저 대화하러 가기 ➔
          </button>
        </div>
      )}

      {realPopupToast && (
        <div className="px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-emerald-700 dark:text-emerald-200 text-[13px] font-extrabold">
          {realPopupToast}
        </div>
      )}

      <GhostSecretaryFirstGuard>
        <section className="flex flex-col gap-2">
          <h2 className="text-[15px] font-extrabold text-zinc-900 dark:text-white">STEP 1 · 소환술 3단 수련</h2>
          <GhostSuperpowerDojo variant="basics" />
        </section>

        <section ref={monitorSectionRef} className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-zinc-900/80 border border-teal-400/40">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-[15px] font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
                <span>STEP 2 · 귀신검색 2단계 도장판 (🖥️ [작게 · 크게] 실시간 완료 도장)</span>
              </h2>
              <span className="text-[11.5px] text-zinc-400">
                아래 체험판 검색창 상단 또는 바탕화면 Ctrl+0 귀신검색창 상단의 <strong className="text-teal-300">[작게] · [크게(갤러리)]</strong> 버튼을 누르면 우측 도장판에 <strong className="text-emerald-300">✓ 완료 도장</strong>이 즉시 찍힙니다.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 text-[11px] font-extrabold">
                🎯 도장판:
              </span>
              {GAME_STEPS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    const targetStage: GhostSearchStage = s.id === 'summon' ? 'small' : s.id;
                    markStep(s.id);
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(
                        new CustomEvent('ghosti_focus_virtual_monitor_window', {
                          detail: { stage: targetStage },
                        }),
                      );
                    }
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11.5px] font-bold border cursor-pointer transition-all ${
                    game[s.id]
                      ? 'border-emerald-400 text-emerald-600 dark:text-emerald-300 bg-emerald-500/15 shadow-sm'
                      : 'border-zinc-300 dark:border-white/20 text-zinc-400 hover:border-teal-400/50'
                  }`}
                >
                  {game[s.id] ? '✓ 완료 · ' : '○ 대기 · '}
                  {s.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setGame({});
                  try {
                    localStorage.removeItem(GAME_STORAGE_KEY);
                  } catch {
                    /* ignore */
                  }
                }}
                className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/15 cursor-pointer"
                title="완료 도장을 초기화하고 [작게·중간·크게] 버튼을 눌러 실시간으로 도장이 찍히는 것을 다시 확인합니다"
              >
                🔄 도장 초기화
              </button>
            </div>
          </div>

          <div className="px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-400/40 text-zinc-800 dark:text-amber-100 text-[12.5px] leading-relaxed flex flex-wrap items-center justify-between gap-2">
            <span>
              💡 <strong>안내:</strong> 현재는 <strong>개발 중인 상태의 검색창 UI를 반영해 자동 변신 움짤(시뮬레이션)</strong>로 제작되어 있으며,{' '}
              <strong>향후 검색창 UI가 최종 완성되면 그때 다시 움짤을 새로 만들 예정</strong>입니다.{' '}
              <span className="text-teal-700 dark:text-[#5EEAD4] font-extrabold">
                (움짤이 변신하는 도중에도 모니터 안의 버튼을 직접 마우스로 눌러보실 수 있습니다!)
              </span>
            </span>
          </div>

          <VirtualMonitorSimulator
            onStep={markStep}
            initialQuery={pendingQuery}
            connected={connected}
          />
        </section>
      </GhostSecretaryFirstGuard>

      <section
        className={`p-5 rounded-2xl border-2 flex flex-wrap items-center justify-between gap-3 ${
          gameDone ? 'border-amber-400 bg-amber-500/10' : 'border-zinc-200 dark:border-white/10'
        }`}
      >
        <span className="text-[14.5px] font-extrabold text-zinc-900 dark:text-white">
          {connected
            ? '🏁 마지막 미션 · 바탕화면으로 나가서 Ctrl + 0 (또는 Ctrl + 우클릭)을 눌러 내 진짜 파일을 불러보세요!'
            : "👻 구경은 재밌으셨나요? 내 진짜 사진·문서로 직접 찾아보려면 먼저 『귀신비서』와 인사를 나누고 오세요!"}
        </span>
        {connected ? (
          <button
            type="button"
            disabled={isLaunchingRealWindow}
            onClick={() => void triggerRealGhostSearchWindow('medium', pendingQuery)}
            className="px-4 py-2.5 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] disabled:opacity-60 text-zinc-950 text-[13px] font-extrabold cursor-pointer"
          >
            {isLaunchingRealWindow
              ? '⏳ 귀신검색창 띄우는 중...'
              : '👻 내 진짜 파일로 귀신검색창 바로 띄우기'}
          </button>
        ) : (
          <button
            type="button"
            data-allow-secretary-jump="true"
            onClick={jumpToGhostSecretary}
            className="px-4 py-2.5 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 text-[13px] font-extrabold cursor-pointer"
          >
            👻 먼저 &apos;귀신비서&apos;와 대화하러 가기 ➔
          </button>
        )}
      </section>

      {/* [메뉴 2 · 👻 귀신검색 하단 고정 소속 설명란] 유료 티어(🔒) 및 부가 기능 안내 */}
      <section
        aria-label="귀신검색 유료 티어 및 부가 기능 안내"
        className="p-4 sm:p-5 rounded-2xl bg-zinc-950/90 border border-white/10 flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13.5px] font-extrabold text-teal-300">
            🔒 귀신검색 유료 티어 안내 (명시적 동의 시 30일 무제한 무료체험 · 만료 시 자동 결제 없이 깔끔 잠금🔒)
          </span>
          <span className="text-[11.5px] text-zinc-400 font-semibold">
            내 PC 문서·사진·영상 소환 &amp; 동영상 [📝 글자 뽑기]는 평생 무제한 무료
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[12px] text-zinc-200">
          <div className="p-3 rounded-xl bg-zinc-900/80 border border-white/10 flex flex-col gap-1">
            <span className="font-extrabold text-white">① 📱 내 기기 통합 소환🔒</span>
            <span className="text-zinc-400 leading-snug">
              동일 이메일 연결 시 핸드폰 사진·타 PC 파일 검색창 통합 노출 &amp; 폰 촬영 직후 <strong className="text-teal-300">1초 공간이동 (촬영 후 1분간 자동팝업 대기)</strong> · 30일 만료 시 원격 노출만 OFF되며 이미 대장 PC 로컬 폴더에 복사된 원본 파일은 영구 보존
            </span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-900/80 border border-white/10 flex flex-col gap-1">
            <span className="font-extrabold text-white">② 📝 사진·표 OCR 창🔒 (창 UI ③ 별도 독립 창)</span>
            <span className="text-zinc-400 leading-snug">
              귀신검색창 안에는 사진 목록만 깔끔하게 보이고, 사진에서 <strong className="text-teal-300">[📝 OCR]</strong>을 누르면 별도 독립 <strong className="text-white">사진·OCR 창</strong>이 열려 글자·표·단어칩을 추출
            </span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-900/80 border border-white/10 flex flex-col gap-1">
            <span className="font-extrabold text-white">③ 🏷️ 귀신 라벨러🔒</span>
            <span className="text-zinc-400 leading-snug">
              암호 같은 사진·카톡·문서 파일명을 촬영일·내용 규칙(YYMMDD_내용)으로 일괄 자동 작명
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default GhostSearchTrainingPage;
