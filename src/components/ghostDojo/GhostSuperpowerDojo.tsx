import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { playBabyGhostChime } from '../OnboardingModal';
import { getZCoreUrl, zCoreBridge } from '../../services/zCoreBridge';
import {
  BASIC_STEPS,
  loadDojoProgress,
  resetDojoProgress,
  saveDojoProgress,
  type DojoProgress,
} from '../../services/ghostDojoEngine';

interface SummonTriggerMeta {
  method: 'keyboard' | 'mouse';
  clientX?: number;
  clientY?: number;
}

function useInstantSummonTrigger(
  onComplete: (meta: SummonTriggerMeta) => void,
  listenWindowShortcut = true,
) {
  const [progress, setProgress] = useState(0);
  const [leftClickGuide, setLeftClickGuide] = useState(false);
  const lastTriggerTsRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const ctrlHeldRef = useRef(false);
  const ctrlDownTsRef = useRef(0);
  const otherActionWhileCtrlRef = useRef(false);

  const triggerNow = useCallback((meta: SummonTriggerMeta) => {
    const now = Date.now();
    // 단일 우클릭에서 mousedown + contextmenu 이중 발생만 방지하고 무제한 반복 호출 허용
    if (now - lastTriggerTsRef.current < 180) return;
    lastTriggerTsRef.current = now;
    setLeftClickGuide(false);
    setProgress(1);
    onCompleteRef.current(meta);
    window.setTimeout(() => {
      setProgress(0);
    }, 320);
  }, []);

  useEffect(() => {
    if (!listenWindowShortcut) return;

    const isZeroKey = (e: KeyboardEvent) =>
      e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0' || e.keyCode === 48 || e.keyCode === 96;

    const onWinKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
        if (!ctrlHeldRef.current) {
          ctrlHeldRef.current = true;
          ctrlDownTsRef.current = Date.now();
          otherActionWhileCtrlRef.current = false;
        }
        return;
      }
      if (e.ctrlKey && !e.altKey && !e.shiftKey && isZeroKey(e)) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault();
        triggerNow({ method: 'keyboard' });
        return;
      }
      if (e.ctrlKey || ctrlHeldRef.current) {
        otherActionWhileCtrlRef.current = true;
      }
    };

    const onWinKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
        ctrlHeldRef.current = false;
        void checkDaemonTelemetry();
      }
    };

    const onWinMouseDown = (e: MouseEvent) => {
      if (e.button === 2 && e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        triggerNow({ method: 'mouse', clientX: e.clientX, clientY: e.clientY });
        return;
      }
      if (e.button === 0) {
        otherActionWhileCtrlRef.current = true;
      }
    };

    const onWinContextMenu = (e: MouseEvent) => {
      if (e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        triggerNow({ method: 'mouse', clientX: e.clientX, clientY: e.clientY });
      }
    };

    const onWinBlur = () => {
      const now = Date.now();
      if (
        (ctrlHeldRef.current || now - ctrlDownTsRef.current < 750) &&
        !otherActionWhileCtrlRef.current
      ) {
        ctrlHeldRef.current = false;
        triggerNow({ method: 'keyboard' });
        return;
      }
      void checkDaemonTelemetry();
    };

    const onDaemonSummonEvent = () => {
      triggerNow({ method: 'keyboard' });
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ghosti_dojo_last_summon_ts' && e.newValue) {
        triggerNow({ method: 'keyboard' });
      }
    };

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('ghosti_search_window_singleton_v1');
        bc.onmessage = (ev: MessageEvent) => {
          const msg = ev.data as { type?: string } | null;
          if (msg && (msg.type === 'DOJO_SUMMON_OBSERVED' || msg.type === 'FOCUS_AND_QUERY')) {
            triggerNow({ method: 'keyboard' });
          }
        };
      }
    } catch {
      /* ignore */
    }

    let telemetryBaseline: Record<string, number> | null = null;
    const sumSummonCounts = (tot: Record<string, number>) =>
      (tot.ctrl0_summon_bar || 0) +
      (tot.ghost_search_window_small || 0) +
      (tot.ghost_search_window_medium || 0);

    const checkDaemonTelemetry = async () => {
      if (!zCoreBridge.isConnected) return;
      try {
        const res = await fetch(getZCoreUrl('/api/superpower/telemetry'), {
          signal: AbortSignal.timeout(1000),
        });
        if (!res.ok) return;
        const data = await res.json();
        const total = (data?.total || {}) as Record<string, number>;
        if (!telemetryBaseline) {
          telemetryBaseline = { ...total };
          return;
        }
        if (sumSummonCounts(total) > sumSummonCounts(telemetryBaseline)) {
          telemetryBaseline = { ...total };
          triggerNow({ method: 'keyboard' });
        } else {
          telemetryBaseline = { ...total };
        }
      } catch {
        /* ignore */
      }
    };

    void checkDaemonTelemetry();
    const pollTimer = window.setInterval(() => void checkDaemonTelemetry(), 300);

    window.addEventListener('keydown', onWinKeyDown, true);
    window.addEventListener('keyup', onWinKeyUp, true);
    window.addEventListener('mousedown', onWinMouseDown, true);
    window.addEventListener('contextmenu', onWinContextMenu, true);
    window.addEventListener('blur', onWinBlur);
    window.addEventListener('ghosti_daemon_ctrl0_summon', onDaemonSummonEvent);
    window.addEventListener('storage', onStorage);

    return () => {
      window.clearInterval(pollTimer);
      window.removeEventListener('keydown', onWinKeyDown, true);
      window.removeEventListener('keyup', onWinKeyUp, true);
      window.removeEventListener('mousedown', onWinMouseDown, true);
      window.removeEventListener('contextmenu', onWinContextMenu, true);
      window.removeEventListener('blur', onWinBlur);
      window.removeEventListener('ghosti_daemon_ctrl0_summon', onDaemonSummonEvent);
      window.removeEventListener('storage', onStorage);
      try {
        bc?.close();
      } catch {
        /* ignore */
      }
    };
  }, [triggerNow, listenWindowShortcut]);

  const handlers = {
    tabIndex: 0,
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      if (e.ctrlKey) return;
      e.currentTarget.focus();
      setLeftClickGuide(true);
    },
    onMouseDown: (e: React.MouseEvent) => {
      if (e.button === 2 && e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        triggerNow({ method: 'mouse', clientX: e.clientX, clientY: e.clientY });
      }
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (
        e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey &&
        (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerNow({ method: 'keyboard' });
      }
    },
    onContextMenu: (e: React.MouseEvent) => {
      if (e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        triggerNow({ method: 'mouse', clientX: e.clientX, clientY: e.clientY });
      }
    },
  };
  return { progress, leftClickGuide, setLeftClickGuide, handlers };
}

const panelCls =
  'p-5 rounded-2xl bg-white border border-slate-300 shadow-sm flex flex-col gap-3.5';

interface SamplePopupState {
  seq: number;
  method: 'keyboard' | 'mouse';
  x?: number;
  y?: number;
}

const TARGET_REPS = 3;

const LiquidWaveFill: React.FC<{ count: number; target: number }> = ({ count, target }) => {
  const clamped = Math.min(target, count);
  const done = count >= target;
  const bodyPct =
    clamped === 0 ? 0 : done ? 105 : Math.round((clamped / target) * 100);

  if (clamped === 0) return null;

  const frontFill = done ? 'rgba(110, 231, 183, 0.62)' : 'rgba(153, 246, 228, 0.72)';
  const backFill = done ? 'rgba(52, 211, 153, 0.35)' : 'rgba(45, 212, 191, 0.38)';

  return (
    <div
      style={{ height: `${bodyPct}%` }}
      className="absolute inset-x-0 bottom-0 z-0 pointer-events-none transition-[height] duration-500 ease-out"
    >
      {/* 찰랑찰랑 2중 물결 상단 표면 (완료 전 1/3, 2/3 구간에서 물결 연출) */}
      {!done && (
        <div className="absolute inset-x-0 -top-[20px] h-[22px] overflow-hidden">
          {/* 뒤쪽 잔물결 */}
          <svg
            viewBox="0 0 1200 28"
            preserveAspectRatio="none"
            style={{ animation: 'ghostWaveReverse 4.2s linear infinite' }}
            className="absolute left-0 top-0 w-[200%] h-full"
          >
            <path
              d="M 0 14 Q 150 26 300 14 T 600 14 T 900 14 T 1200 14 V 28 H 0 Z"
              fill={backFill}
            />
          </svg>
          {/* 앞쪽 주물결 (하단 액체 색상과 무봉제 일체화) */}
          <svg
            viewBox="0 0 1200 28"
            preserveAspectRatio="none"
            style={{ animation: 'ghostWaveForward 2.8s linear infinite' }}
            className="absolute left-0 top-[2px] w-[200%] h-full"
          >
            <path
              d="M 0 14 Q 150 2 300 14 T 600 14 T 900 14 T 1200 14 V 28 H 0 Z"
              fill={frontFill}
            />
          </svg>
        </div>
      )}

      {/* 물결 아래 차오른 액체 본체 */}
      <div
        style={{
          background: done
            ? 'linear-gradient(to top, rgba(52, 211, 153, 0.52), rgba(110, 231, 183, 0.62))'
            : 'linear-gradient(to top, rgba(94, 234, 212, 0.78), rgba(153, 246, 228, 0.72))',
        }}
        className="w-full h-full transition-colors duration-500"
      />
    </div>
  );
};

const Basic1: React.FC<{ onDone: () => void; isStep1Done: boolean }> = ({ onDone, isStep1Done }) => {
  const initialCounts = loadDojoProgress().b1Counts ?? { keyboard: 0, mouse: 0 };
  const [keyboardCount, setKeyboardCount] = useState(initialCounts.keyboard);
  const [mouseCount, setMouseCount] = useState(initialCounts.mouse);
  const kbCountRef = useRef(initialCounts.keyboard);
  const msCountRef = useRef(initialCounts.mouse);

  const [pressingSide, setPressingSide] = useState<'keyboard' | 'mouse' | null>(null);
  const [samplePopup, setSamplePopup] = useState<SamplePopupState | null>(null);
  const podsWrapRef = useRef<HTMLDivElement | null>(null);
  const popupCardRef = useRef<HTMLDivElement | null>(null);
  const pressTimerRef = useRef<number | null>(null);

  const { handlers } = useInstantSummonTrigger((meta) => {
    if (kbCountRef.current >= TARGET_REPS && msCountRef.current >= TARGET_REPS) {
      return;
    }
    playBabyGhostChime('summon');
    setPressingSide(meta.method);
    if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
    pressTimerRef.current = window.setTimeout(() => setPressingSide(null), 240);

    if (meta.method === 'keyboard') {
      kbCountRef.current += 1;
      setKeyboardCount(kbCountRef.current);
    } else {
      msCountRef.current += 1;
      setMouseCount(msCountRef.current);
    }

    const curProg = loadDojoProgress();
    const bothCompleted = kbCountRef.current >= TARGET_REPS && msCountRef.current >= TARGET_REPS;
    saveDojoProgress({
      ...curProg,
      basics: bothCompleted ? { ...curProg.basics, b1: true } : curProg.basics,
      b1Counts: { keyboard: kbCountRef.current, mouse: msCountRef.current },
    });

    setSamplePopup((prev) => ({
      seq: (prev?.seq || 0) + 1,
      method: meta.method,
      x: meta.clientX,
      y: meta.clientY,
    }));

    if (bothCompleted) {
      onDone();
    }
  }, !isStep1Done);

  useEffect(() => {
    return () => {
      if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
    };
  }, []);

  // 2초 후 자동 소멸 + ESC/외부 좌클릭 즉시 닫기
  useEffect(() => {
    if (!samplePopup) return;
    const currentSeq = samplePopup.seq;
    const autoCloseTimer = window.setTimeout(() => {
      setSamplePopup((cur) => (cur && cur.seq === currentSeq ? null : cur));
    }, 2000);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSamplePopup(null);
      }
    };
    const onPointerDown = (e: MouseEvent) => {
      if (e.ctrlKey && e.button === 2) return;
      if (popupCardRef.current && popupCardRef.current.contains(e.target as Node)) return;
      setSamplePopup(null);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.clearTimeout(autoCloseTimer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [samplePopup]);

  // 충전 박스를 절대 가리지 않도록 항상 박스 바깥쪽(하단 외곽)에 배치
  const computePopupStyle = (): React.CSSProperties => {
    if (typeof window === 'undefined') {
      return { position: 'fixed', left: '50%', top: '62%', transform: 'translateX(-50%)', width: '460px' };
    }
    const cardW = Math.min(460, window.innerWidth - 32);
    const cardH = 235;
    const boxRect = podsWrapRef.current?.getBoundingClientRect();

    if (boxRect) {
      // 기본: 두 충전 박스 바로 아래 바깥쪽(박스 가림 0%)
      const desiredLeft =
        samplePopup?.method === 'mouse'
          ? boxRect.right - cardW
          : boxRect.left;
      const clampedLeft = Math.max(16, Math.min(desiredLeft, window.innerWidth - cardW - 16));

      const belowTop = boxRect.bottom + 22;
      if (belowTop + cardH <= window.innerHeight - 12) {
        return {
          position: 'fixed',
          left: `${clampedLeft}px`,
          top: `${belowTop}px`,
          width: `${cardW}px`,
        };
      }
      // 만약 화면 아래 여백이 좁으면 박스 위쪽 바깥(상단 외곽) 또는 우측 외곽에 배치해 박스 가림 방지
      const aboveTop = boxRect.top - cardH - 18;
      if (aboveTop >= 12) {
        return {
          position: 'fixed',
          left: `${clampedLeft}px`,
          top: `${aboveTop}px`,
          width: `${cardW}px`,
        };
      }
      return {
        position: 'fixed',
        left: `${clampedLeft}px`,
        top: `${Math.max(16, window.innerHeight - cardH - 16)}px`,
        width: `${cardW}px`,
      };
    }

    return {
      position: 'fixed',
      left: '50%',
      top: '65%',
      transform: 'translateX(-50%)',
      width: `${cardW}px`,
    };
  };

  const kbClamped = Math.min(TARGET_REPS, keyboardCount);
  const msClamped = Math.min(TARGET_REPS, mouseCount);
  const kbDone = keyboardCount >= TARGET_REPS;
  const msDone = mouseCount >= TARGET_REPS;

  return (
    <div className="py-1">
      <style>{`
        @keyframes ghostSampleSummonPop {
          0% { opacity: 0; scale: 0.92; }
          65% { opacity: 1; scale: 1.02; }
          100% { opacity: 1; scale: 1; }
        }
        @keyframes ghostCaretBlink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes ghostPopupTimerShrink {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes ghostWaveForward {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes ghostWaveReverse {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
      `}</style>

      {/* 여백 조절로 보기 좋게 좁힌 중앙 2열 찰랑 물결 충전 카드 */}
      <div
        ref={podsWrapRef}
        className="w-full max-w-[680px] mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 items-stretch"
      >
        {/* 좌측: 키보드 Ctrl + 0 (아래→위 찰랑 물결 충전) */}
        <div
          onMouseDown={isStep1Done ? undefined : handlers.onMouseDown}
          onContextMenu={isStep1Done ? undefined : handlers.onContextMenu}
          className={`relative overflow-hidden select-none px-5 py-4 rounded-2xl border-2 flex flex-col items-center justify-between gap-2 transition-all duration-300 cursor-default ${
            pressingSide === 'keyboard'
              ? 'border-teal-500 ring-4 ring-teal-400/30 shadow-md bg-slate-50'
              : kbDone
                ? 'border-emerald-500 shadow-sm ring-2 ring-emerald-500/20 bg-white'
                : keyboardCount > 0
                  ? 'border-teal-400 shadow-2xs bg-slate-50/70'
                  : 'border-dashed border-slate-300 bg-slate-50/85'
          }`}
        >
          <LiquidWaveFill count={keyboardCount} target={TARGET_REPS} />

          <div className="relative z-10 w-full flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-extrabold text-slate-800 tracking-tight">
              키보드 호출
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-extrabold tabular-nums transition-colors ${
                kbDone
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : keyboardCount > 0
                    ? 'bg-teal-600 text-white shadow-2xs'
                    : 'bg-white/90 border border-slate-200 text-slate-500'
              }`}
            >
              {kbDone ? '✓ 3 / 3 완료' : `${kbClamped} / ${TARGET_REPS}`}
            </span>
          </div>

          <div className="relative z-10 py-2 flex items-center justify-center">
            <img
              src="/ghostkey_ctrl_zero.png"
              alt="Ctrl + 0"
              className={`h-[108px] sm:h-[120px] w-auto object-contain select-none pointer-events-none transition-transform duration-150 ${
                pressingSide === 'keyboard' ? 'scale-[0.92] translate-y-1.5' : ''
              }`}
            />
          </div>
        </div>

        {/* 우측: 마우스 Ctrl + 우클릭 (아래→위 찰랑 물결 충전) */}
        <div
          onMouseDown={isStep1Done ? undefined : handlers.onMouseDown}
          onContextMenu={isStep1Done ? undefined : handlers.onContextMenu}
          className={`relative overflow-hidden select-none px-5 py-4 rounded-2xl border-2 flex flex-col items-center justify-between gap-2 transition-all duration-300 cursor-default ${
            pressingSide === 'mouse'
              ? 'border-teal-500 ring-4 ring-teal-400/30 shadow-md bg-slate-50'
              : msDone
                ? 'border-emerald-500 shadow-sm ring-2 ring-emerald-500/20 bg-white'
                : mouseCount > 0
                  ? 'border-teal-400 shadow-2xs bg-slate-50/70'
                  : 'border-dashed border-slate-300 bg-slate-50/85'
          }`}
        >
          <LiquidWaveFill count={mouseCount} target={TARGET_REPS} />

          <div className="relative z-10 w-full flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-extrabold text-slate-800 tracking-tight">
              마우스 호출
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-extrabold tabular-nums transition-colors ${
                msDone
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : mouseCount > 0
                    ? 'bg-teal-600 text-white shadow-2xs'
                    : 'bg-white/90 border border-slate-200 text-slate-500'
              }`}
            >
              {msDone ? '✓ 3 / 3 완료' : `${msClamped} / ${TARGET_REPS}`}
            </span>
          </div>

          <div className="relative z-10 py-2 flex items-center justify-center">
            <img
              src="/ghostkey_ctrl_rightclick.png"
              alt="Ctrl + 마우스 우클릭"
              className={`h-[108px] sm:h-[120px] w-auto object-contain select-none pointer-events-none transition-transform duration-150 ${
                pressingSide === 'mouse' ? 'scale-[0.92] translate-y-1.5' : ''
              }`}
            />
          </div>
        </div>
      </div>

      {/* 충전 박스 바깥쪽에 뜨고 2초 후 자동 퇴장하는 리얼 샘플 귀신검색창 */}
      {samplePopup &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[140] pointer-events-none">
            <div
              key={samplePopup.seq}
              ref={popupCardRef}
              style={{
                ...computePopupStyle(),
                animation: 'ghostSampleSummonPop 170ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
              }}
              onContextMenu={(e) => {
                if (e.ctrlKey) e.preventDefault();
              }}
              className="pointer-events-auto rounded-2xl overflow-hidden bg-white border-2 border-slate-800 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.45)] ring-4 ring-teal-500/25 select-none"
            >
              {/* 상단 타이틀 바 */}
              <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src="/gwisinkachi_app_icon_512.png"
                    alt="귀신같이"
                    className="w-5 h-5 rounded object-cover shrink-0"
                  />
                  <span className="text-[13.5px] font-extrabold tracking-tight whitespace-nowrap">
                    귀신검색창
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10.5px] font-extrabold whitespace-nowrap">
                    호출 연습용 샘플
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 rounded-full bg-teal-500/25 border border-teal-400/50 text-teal-200 text-[11px] font-bold whitespace-nowrap">
                    {samplePopup.method === 'keyboard'
                      ? '키보드 Ctrl + 0 소환!'
                      : '마우스 Ctrl + 우클릭 소환!'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSamplePopup(null)}
                    aria-label="샘플 창 닫기"
                    className="w-6 h-6 rounded-md bg-white/15 hover:bg-white/25 text-white text-[12px] flex items-center justify-center cursor-pointer transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* 2초 자동 소멸 타이머 바 */}
              <div className="w-full h-1 bg-slate-800 overflow-hidden">
                <div
                  style={{ animation: 'ghostPopupTimerShrink 2000ms linear forwards' }}
                  className="h-full bg-teal-400"
                />
              </div>

              {/* 이전 버전의 완성도 높은 검색창 + 샘플 결과 2줄 모형 복원 */}
              <div className="p-3.5 bg-white flex flex-col gap-2.5">
                <div className="h-11 px-3.5 rounded-xl bg-slate-50 border-2 border-teal-500 flex items-center gap-2.5 shadow-inner">
                  <span className="material-symbols-outlined text-[19px] text-teal-600">
                    search
                  </span>
                  <span
                    style={{ animation: 'ghostCaretBlink 1s infinite' }}
                    className="w-0.5 h-5 bg-teal-600 rounded-full shrink-0"
                  />
                  <span className="text-[13px] text-slate-400 truncate">
                    실제 연결 시 여기서 문서·사진·영상을 바로 검색합니다...
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 opacity-90">
                  <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/90 flex items-center justify-between gap-2 text-[12px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold shrink-0">
                        PDF
                      </span>
                      <span className="font-semibold text-slate-700 truncate">
                        2026_표준_임대차계약서.pdf
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">샘플 모양</span>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/90 flex items-center justify-between gap-2 text-[12px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 text-[10px] font-bold shrink-0">
                        사진
                      </span>
                      <span className="font-semibold text-slate-700 truncate">
                        배달주문_영수증_38500원.jpg
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">샘플 모양</span>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export interface GhostSuperpowerDojoProps {
  variant?: 'basics';
}

export const GhostSuperpowerDojo: React.FC<GhostSuperpowerDojoProps> = () => {
  const [progress, setProgress] = useState<DojoProgress>(() => loadDojoProgress());
  const [sandboxKey, setSandboxKey] = useState(0);

  useEffect(() => {
    const sync = () => setProgress(loadDojoProgress());
    window.addEventListener('ghosti_dojo_progress_updated', sync);
    return () => {
      window.removeEventListener('ghosti_dojo_progress_updated', sync);
    };
  }, []);

  const markB1Done = () => {
    setProgress((prev) => {
      const cur = loadDojoProgress();
      const next: DojoProgress = {
        ...cur,
        basics: { ...prev.basics, b1: true },
      };
      saveDojoProgress(next);
      return next;
    });
  };

  const isDone = Boolean(progress.basics.b1);
  const kbCount = progress.b1Counts?.keyboard ?? 0;
  const msCount = progress.b1Counts?.mouse ?? 0;
  const hasAnyProgress = isDone || kbCount > 0 || msCount > 0;

  return (
    <div className="flex flex-col gap-3">
      <section className={panelCls}>
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-900 text-white text-[11px] font-bold tracking-tight select-none cursor-default">
                1단계
              </span>
              <h3 className="text-[15.5px] font-extrabold text-slate-900 tracking-tight">
                단축키 호출 연습
              </h3>
            </div>
            <p className="text-[13px] text-slate-600 leading-relaxed cursor-default">
              {BASIC_STEPS[0]?.mission}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[12px] font-bold select-none cursor-default ${
                isDone ? 'text-emerald-700' : 'text-slate-500'
              }`}
            >
              {isDone ? '✓ 양쪽 3회 완료!' : '양쪽 3회씩 충전'}
            </span>
            {hasAnyProgress && (
              <button
                type="button"
                onClick={() => {
                  const resetNext = resetDojoProgress();
                  setProgress(resetNext);
                  setSandboxKey((k) => k + 1);
                }}
                className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-300 hover:border-slate-400 text-slate-700 text-[11.5px] font-semibold shadow-2xs active:scale-95 transition-all cursor-pointer"
              >
                초기화
              </button>
            )}
          </div>
        </div>
        <Basic1 key={`b1_${sandboxKey}`} onDone={markB1Done} isStep1Done={isDone} />
      </section>
    </div>
  );
};

export default GhostSuperpowerDojo;
