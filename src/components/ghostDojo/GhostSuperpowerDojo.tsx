import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { playBabyGhostChime } from '../OnboardingModal';
import { getZCoreUrl, zCoreBridge } from '../../services/zCoreBridge';
import {
  BASIC_STEPS,
  BASIC2_QUERY,
  BASIC2_RESULT,
  BASIC3_CHIPS,
  BASIC3_TARGET_CHIP,
  loadDojoProgress,
  saveDojoProgress,
  countBasicsDone,
  type BasicStepId,
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

const StampBadge: React.FC<{ done: boolean; active?: boolean; index: number }> = ({
  done,
  active = false,
  index,
}) => (
  <span
    className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
      done
        ? 'bg-emerald-500 text-white shadow-2xs'
        : active
          ? 'bg-teal-400 text-slate-950'
          : 'bg-slate-100 border border-slate-300 text-slate-600 group-hover:border-teal-500 group-hover:bg-teal-100 group-hover:text-teal-900'
    }`}
    aria-label={done ? '완료' : '대기'}
  >
    {done ? '✓' : index}
  </span>
);

const panelCls =
  'p-5 rounded-2xl bg-white border border-slate-300 shadow-sm flex flex-col gap-3.5';
const boxCls =
  'px-3.5 py-2.5 rounded-lg bg-slate-100/80 text-[13px] text-slate-800 cursor-default';
const summonKeyBadgeCls =
  'inline-flex items-center px-2 py-0.5 mx-0.5 rounded bg-white text-slate-900 border border-slate-300 border-b-2 border-b-slate-400 font-mono font-semibold text-[11.5px] shadow-2xs select-none';

interface SamplePopupState {
  seq: number;
  method: 'keyboard' | 'mouse';
  x?: number;
  y?: number;
}

const Basic1: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [keyboardCount, setKeyboardCount] = useState(0);
  const [mouseCount, setMouseCount] = useState(0);
  const [pressingSide, setPressingSide] = useState<'keyboard' | 'mouse' | null>(null);
  const [selectedSide, setSelectedSide] = useState<'keyboard' | 'mouse' | null>(null);
  const [samplePopup, setSamplePopup] = useState<SamplePopupState | null>(null);
  const popupCardRef = useRef<HTMLDivElement | null>(null);
  const pressTimerRef = useRef<number | null>(null);

  const { leftClickGuide, setLeftClickGuide, handlers } = useInstantSummonTrigger((meta) => {
    playBabyGhostChime('summon');
    setSelectedSide(meta.method);
    setPressingSide(meta.method);
    if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
    pressTimerRef.current = window.setTimeout(() => setPressingSide(null), 260);

    if (meta.method === 'keyboard') {
      setKeyboardCount((c) => c + 1);
    } else {
      setMouseCount((c) => c + 1);
    }
    setSamplePopup((prev) => ({
      seq: (prev?.seq || 0) + 1,
      method: meta.method,
      x: meta.clientX,
      y: meta.clientY,
    }));
    onDone();
  }, true);

  useEffect(() => {
    return () => {
      if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!samplePopup) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSamplePopup(null);
      }
    };
    const onPointerDown = (e: MouseEvent) => {
      // Ctrl+우클릭 호출 시에는 닫지 않고 즉시 새 위치에 재호출되도록 통과
      if (e.ctrlKey && e.button === 2) return;
      if (popupCardRef.current && popupCardRef.current.contains(e.target as Node)) return;
      setSamplePopup(null);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [samplePopup]);

  const computePopupStyle = (): React.CSSProperties => {
    if (
      samplePopup?.method === 'mouse' &&
      typeof samplePopup.x === 'number' &&
      typeof samplePopup.y === 'number' &&
      typeof window !== 'undefined'
    ) {
      const cardW = Math.min(460, window.innerWidth - 32);
      const cardH = 250;
      const clampedLeft = Math.max(16, Math.min(samplePopup.x - Math.round(cardW * 0.35), window.innerWidth - cardW - 16));
      const clampedTop = Math.max(16, Math.min(samplePopup.y + 14, window.innerHeight - cardH - 16));
      return {
        position: 'fixed',
        left: `${clampedLeft}px`,
        top: `${clampedTop}px`,
        width: `${cardW}px`,
      };
    }
    return {
      position: 'fixed',
      left: '50%',
      top: '38%',
      transform: 'translate(-50%, -50%)',
      width: 'min(460px, calc(100vw - 32px))',
    };
  };

  return (
    <div className="flex flex-col gap-2.5">
      <style>{`
        @keyframes ghostSampleSummonPop {
          0% { opacity: 0; scale: 0.9; }
          65% { opacity: 1; scale: 1.02; }
          100% { opacity: 1; scale: 1; }
        }
        @keyframes ghostCaretBlink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        {/* 좌측: 키보드 Ctrl + 0 리얼 키캡 크기 체험 존 */}
        <div
          {...handlers}
          onClick={(e) => {
            setSelectedSide('keyboard');
            setLeftClickGuide(true);
            e.currentTarget.focus();
          }}
          className={`group relative select-none px-5 py-5 rounded-xl border-2 border-dashed flex flex-col items-center justify-between gap-3 text-[13px] text-slate-700 cursor-pointer transition-all duration-150 focus:outline-none ${
            pressingSide === 'keyboard'
              ? 'border-teal-500 bg-teal-50 ring-4 ring-teal-400/30 shadow-md'
              : leftClickGuide && selectedSide === 'keyboard'
                ? 'border-teal-600 bg-teal-50/50 ring-2 ring-teal-500/20'
                : keyboardCount > 0
                  ? 'border-emerald-400 bg-emerald-50/25 hover:border-teal-500 hover:bg-teal-50/40'
                  : 'border-slate-300 bg-slate-50/90 hover:border-teal-500 hover:bg-teal-50/40'
          }`}
        >
          <div className="w-full flex items-center justify-between gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-200/80 text-slate-700 text-[12px] font-bold tracking-tight">
              방법 1 · 키보드 호출
            </span>
            {keyboardCount > 0 ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold shadow-2xs">
                ✓ {keyboardCount}회 성공
              </span>
            ) : (
              <span className="text-[11.5px] font-medium text-slate-400">여러 번 가능</span>
            )}
          </div>
          <div className="py-1 flex items-center justify-center">
            <img
              src="/ghostkey_ctrl_zero.png"
              alt="Ctrl + 0"
              className={`h-[108px] sm:h-[124px] w-auto object-contain select-none pointer-events-none transition-transform duration-150 ${
                pressingSide === 'keyboard'
                  ? 'scale-[0.93] translate-y-1.5'
                  : 'group-hover:scale-[1.03]'
              }`}
            />
          </div>
          <div className="text-center leading-relaxed">
            <span>
              이 영역에서 <kbd className={summonKeyBadgeCls}>Ctrl + 0</kbd> (숫자패드 0 포함) 입력
            </span>
            {leftClickGuide && selectedSide === 'keyboard' && (
              <div className="mt-1 text-[12px] font-bold text-teal-800">
                선택됨 · 지금 키보드 Ctrl + 0을 눌러보세요!
              </div>
            )}
          </div>
        </div>

        {/* 우측: 마우스 Ctrl + 우클릭 리얼 단추 크기 체험 존 */}
        <div
          {...handlers}
          onClick={(e) => {
            setSelectedSide('mouse');
            setLeftClickGuide(true);
            e.currentTarget.focus();
          }}
          className={`group relative select-none px-5 py-5 rounded-xl border-2 border-dashed flex flex-col items-center justify-between gap-3 text-[13px] text-slate-700 cursor-pointer transition-all duration-150 focus:outline-none ${
            pressingSide === 'mouse'
              ? 'border-teal-500 bg-teal-50 ring-4 ring-teal-400/30 shadow-md'
              : leftClickGuide && selectedSide === 'mouse'
                ? 'border-teal-600 bg-teal-50/50 ring-2 ring-teal-500/20'
                : mouseCount > 0
                  ? 'border-emerald-400 bg-emerald-50/25 hover:border-teal-500 hover:bg-teal-50/40'
                  : 'border-slate-300 bg-slate-50/90 hover:border-teal-500 hover:bg-teal-50/40'
          }`}
        >
          <div className="w-full flex items-center justify-between gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-200/80 text-slate-700 text-[12px] font-bold tracking-tight">
              방법 2 · 마우스 호출
            </span>
            {mouseCount > 0 ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold shadow-2xs">
                ✓ {mouseCount}회 성공
              </span>
            ) : (
              <span className="text-[11.5px] font-medium text-slate-400">여러 번 가능</span>
            )}
          </div>
          <div className="py-1 flex items-center justify-center">
            <img
              src="/ghostkey_ctrl_rightclick.png"
              alt="Ctrl + 마우스 우클릭"
              className={`h-[108px] sm:h-[124px] w-auto object-contain select-none pointer-events-none transition-transform duration-150 ${
                pressingSide === 'mouse'
                  ? 'scale-[0.93] translate-y-1.5'
                  : 'group-hover:scale-[1.03]'
              }`}
            />
          </div>
          <div className="text-center leading-relaxed">
            <span>
              이 영역에서 <kbd className={summonKeyBadgeCls}>Ctrl</kbd> 누른 채{' '}
              <kbd className={summonKeyBadgeCls}>마우스 우클릭</kbd>
            </span>
            {leftClickGuide && selectedSide === 'mouse' && (
              <div className="mt-1 text-[12px] font-bold text-teal-800">
                선택됨 · 지금 Ctrl을 누른 채 마우스 우클릭해 보세요!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 실제 바탕화면 소환 감각을 전달하는 플로팅 샘플 귀신검색창 */}
      {samplePopup &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[140] pointer-events-none">
            <div
              key={samplePopup.seq}
              ref={popupCardRef}
              style={{
                ...computePopupStyle(),
                animation: 'ghostSampleSummonPop 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
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
                  <span className="px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/40 text-teal-300 text-[11px] font-bold whitespace-nowrap">
                    {samplePopup.method === 'keyboard'
                      ? '키보드 Ctrl + 0 소환!'
                      : '마우스 Ctrl + 우클릭 소환!'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSamplePopup(null)}
                    aria-label="샘플 창 닫기"
                    className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white text-[12px] flex items-center justify-center cursor-pointer transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* 검색 입력바 모형 (기능 없는 시각 연출 전용) */}
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

                {/* 샘플 모양 암시 2줄 */}
                <div className="flex flex-col gap-1.5 opacity-85">
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

              {/* 하단 안내 바 */}
              <div className="px-3.5 py-2 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-2 text-[11.5px] text-slate-600">
                <span>
                  반대쪽 단축키(키보드 ↔ 마우스)도 번갈아 눌러보세요!
                </span>
                <button
                  type="button"
                  onClick={() => setSamplePopup(null)}
                  className="px-2.5 py-0.5 rounded bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-semibold cursor-pointer transition-colors shrink-0"
                >
                  닫기 (ESC)
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

const Basic2: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(BASIC2_QUERY);
  const { leftClickGuide, handlers } = useInstantSummonTrigger(() => {
    playBabyGhostChime('summon');
    setOpen(true);
    setValue(BASIC2_RESULT.value);
    onDone();
  }, true);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12.5px] text-slate-600 leading-relaxed pl-0.5 cursor-default">
        작업 중인 입력창에서 파일을 따로 열지 않고 <kbd className={summonKeyBadgeCls}>Ctrl + 0</kbd> 또는 <kbd className={summonKeyBadgeCls}>Ctrl + 우클릭</kbd>을 눌러 문서 속 수치를 바로 찾아 넣을 수 있습니다.
      </p>
      <div
        {...handlers}
        className="px-3.5 py-3 rounded-xl bg-white border-2 border-dashed border-slate-300 hover:border-teal-500 hover:bg-teal-50/30 select-none flex flex-wrap items-center justify-between gap-3 cursor-pointer transition-all duration-150 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20"
      >
        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11.5px] font-semibold shrink-0">
          메시지 입력창 체험
        </span>
        <span className="flex-1 font-semibold text-[13px] text-slate-900">
          {value === BASIC2_QUERY ? '단가 확인 (이 칸을 클릭 후 Ctrl + 0 또는 Ctrl + 우클릭)' : `납품 단가: ${value}`}
        </span>
      </div>
      {leftClickGuide && !open && (
        <div className="text-[12px] font-semibold text-teal-800 px-1">
          입력창이 선택되었습니다. Ctrl + 0 또는 Ctrl + 우클릭을 눌러 단가를 찾아보세요.
        </div>
      )}
      {open && (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
          <div className="text-[12px] font-semibold text-slate-700 cursor-default">
            문서 본문에서 &ldquo;단가&rdquo; 항목을 찾아 입력창에 반영했습니다.
          </div>
          <button
            type="button"
            onClick={() => {
              setValue(BASIC2_RESULT.value);
              playBabyGhostChime('typo');
              onDone();
            }}
            className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-white hover:bg-teal-50/60 border border-slate-300 border-b-2 hover:border-teal-500 shadow-2xs hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 cursor-pointer transition-all duration-150 text-[12.5px]"
          >
            <span className="font-medium text-slate-800">{BASIC2_RESULT.file}</span>
            <span className="font-bold text-teal-700">
              단가 {BASIC2_RESULT.value} 입력 완료 ✓
            </span>
          </button>
        </div>
      )}
      {value !== BASIC2_QUERY && (
        <div className="px-3.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[12.5px] font-semibold text-emerald-900 cursor-default">
          ✓ 입력창에 단가({value})가 입력되었습니다.
        </div>
      )}
    </div>
  );
};

const Basic3: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [injected, setInjected] = useState('');
  const [wrong, setWrong] = useState('');

  const handlePickBizNumber = () => {
    setInjected('123-45-67890');
    setWrong('');
    void navigator.clipboard?.writeText('123-45-67890').catch(() => {});
    playBabyGhostChime('typo');
    onDone();
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
        <div className="md:col-span-5 p-3.5 rounded-xl bg-slate-100/80 flex flex-col items-center justify-center">
          <div className="text-[11.5px] font-semibold text-slate-600 mb-2 cursor-default">
            샘플 영수증 사진 (사업자번호 버튼 클릭)
          </div>
          <div className="w-full max-w-[260px] bg-white text-slate-900 rounded-lg border border-slate-300 px-3.5 py-3 font-mono text-[11.5px] flex flex-col gap-1.5 shadow-xs">
            <div className="text-center border-b border-dashed border-slate-300 pb-1.5 cursor-default">
              <div className="font-bold text-[12.5px] text-slate-900">썬드림카페</div>
              <div className="text-[10.5px] text-slate-500">서울 강남구 테헤란로 123 · 대표 백은숙</div>
            </div>

            <button
              type="button"
              onClick={handlePickBizNumber}
              title="영수증 사진 속 사업자번호 영역 클릭"
              className={`w-full text-left px-2.5 py-1.5 rounded-md border transition-all duration-150 cursor-pointer flex items-center justify-between gap-1 ${
                injected
                  ? 'bg-slate-900 border-slate-900 text-white font-semibold shadow-xs'
                  : 'bg-teal-50/80 hover:bg-teal-100/80 border-teal-500 border-b-2 text-teal-950 font-bold shadow-2xs hover:-translate-y-0.5 active:translate-y-0'
              }`}
            >
              <span>사업자번호: 123-45-67890</span>
              <span className="text-[10.5px] font-sans shrink-0">
                {injected ? '✓ 추출됨' : '클릭 ›'}
              </span>
            </button>

            <div className="border-y border-dashed border-slate-200 py-1 text-[10.5px] text-slate-600 flex flex-col gap-0.5 cursor-default">
              <div className="flex justify-between">
                <span>아메리카노 외 3건</span>
                <span>48,000원</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900">
                <span>합계 금액</span>
                <span>48,000원</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 cursor-default">
              <span>2026-11-07 14:22</span>
              <span>||| |||| |||</span>
            </div>
          </div>
        </div>

        <div className="md:col-span-7 flex flex-col justify-between gap-2">
          <div className="p-3.5 rounded-xl bg-slate-100/80 flex-1 flex flex-col justify-center gap-2">
            <div className="text-[12px] font-bold text-slate-700 cursor-default">
              추출된 텍스트 항목 (클릭하여 선택)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BASIC3_CHIPS.map((chip) => {
                const isTarget = chip === BASIC3_TARGET_CHIP;
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      if (isTarget) {
                        handlePickBizNumber();
                      } else {
                        setWrong(chip);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer border border-b-2 transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 ${
                      isTarget && injected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : isTarget
                          ? 'border-teal-500 bg-white hover:bg-teal-50 text-teal-950 shadow-2xs hover:shadow-sm'
                          : wrong === chip
                            ? 'border-rose-400 bg-rose-50 text-rose-700'
                            : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50 text-slate-700 shadow-2xs'
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
            {wrong && (
              <div className="text-[11.5px] font-medium text-rose-600 cursor-default">
                [사업자번호: 123-45-67890] 버튼을 눌러주세요.
              </div>
            )}
          </div>

          <div className={`${boxCls} flex items-center justify-between gap-2`}>
            <div>
              <span className="text-slate-500">사업자번호 입력칸: </span>
              <span className="font-bold text-[13.5px] text-slate-900">{injected || '—'}</span>
            </div>
            {injected && (
              <span className="text-[11.5px] font-bold text-emerald-700 shrink-0">
                ✓ 복사 완료
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const BASIC_SANDBOXES: Record<BasicStepId, React.FC<{ onDone: () => void }>> = {
  b1: Basic1,
  b2: Basic2,
  b3: Basic3,
};

export interface GhostSuperpowerDojoProps {
  variant?: 'basics';
}

export const GhostSuperpowerDojo: React.FC<GhostSuperpowerDojoProps> = () => {
  const [progress, setProgress] = useState<DojoProgress>(() => loadDojoProgress());
  const [activeBasic, setActiveBasic] = useState<BasicStepId>(() => {
    const p = loadDojoProgress();
    return BASIC_STEPS.find((s) => !p.basics[s.id])?.id ?? 'b1';
  });
  const [sandboxKey, setSandboxKey] = useState(0);

  useEffect(() => {
    const sync = () => setProgress(loadDojoProgress());
    window.addEventListener('ghosti_dojo_progress_updated', sync);
    return () => {
      window.removeEventListener('ghosti_dojo_progress_updated', sync);
    };
  }, []);

  const markBasic = (id: BasicStepId) => {
    setProgress((prev) => {
      const next: DojoProgress = { ...prev, basics: { ...prev.basics, [id]: true } };
      saveDojoProgress(next);
      return next;
    });
  };

  const basicsDone = countBasicsDone(progress);
  const BasicSandbox = BASIC_SANDBOXES[activeBasic];

  return (
    <div className="flex flex-col gap-3">
      <section className={panelCls}>
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-900 text-white text-[11px] font-bold tracking-tight select-none cursor-default">
              1단계
            </span>
            <h3 className="text-[15.5px] font-extrabold text-slate-900 tracking-tight">
              단축키 호출 연습
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-slate-500 select-none cursor-default">
              진행 {basicsDone}/3 완료
            </span>
            {basicsDone > 0 && (
              <button
                type="button"
                onClick={() => {
                  const resetNext: DojoProgress = { basics: {} };
                  setProgress(resetNext);
                  saveDojoProgress(resetNext);
                  setActiveBasic('b1');
                  setSandboxKey((k) => k + 1);
                }}
                className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-300 hover:border-slate-400 text-slate-700 text-[11.5px] font-semibold shadow-2xs active:scale-95 transition-all cursor-pointer"
              >
                초기화
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {BASIC_STEPS.map((s, idx) => {
            const isActive = activeBasic === s.id;
            const isDone = Boolean(progress.basics[s.id]);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setActiveBasic(s.id);
                  setSandboxKey((k) => k + 1);
                }}
                className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] cursor-pointer transition-all duration-150 ${
                  isActive
                    ? 'bg-slate-900 text-white border-2 border-slate-900 font-bold shadow-md'
                    : 'bg-white text-slate-700 font-semibold border border-slate-300 border-b-[3px] border-b-slate-300 shadow-2xs hover:-translate-y-0.5 hover:shadow-md hover:border-teal-500 hover:border-b-teal-600 hover:bg-teal-50/70 hover:text-teal-950 active:translate-y-0 active:scale-[0.98]'
                }`}
              >
                <StampBadge done={isDone} active={isActive} index={idx + 1} />
                <span>{s.title}</span>
                {!isActive && (
                  <span
                    aria-hidden="true"
                    className="text-[14px] leading-none text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all ml-0.5"
                  >
                    ›
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[13px] text-slate-600 leading-relaxed pl-0.5 cursor-default">
          {BASIC_STEPS.find((s) => s.id === activeBasic)?.mission}
        </p>
        <BasicSandbox key={`${activeBasic}_${sandboxKey}`} onDone={() => markBasic(activeBasic)} />
      </section>
    </div>
  );
};

export default GhostSuperpowerDojo;
