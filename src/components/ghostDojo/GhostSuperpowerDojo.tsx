import React, { useCallback, useEffect, useRef, useState } from 'react';
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

function useInstantSummonTrigger(onComplete: () => void, listenWindowShortcut = true) {
  const [progress, setProgress] = useState(0);
  const [leftClickGuide, setLeftClickGuide] = useState(false);
  const triggeredRef = useRef(false);
  const ctrlHeldRef = useRef(false);
  const ctrlDownTsRef = useRef(0);
  const otherActionWhileCtrlRef = useRef(false);

  const triggerNow = useCallback(() => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    setLeftClickGuide(false);
    setProgress(1);
    onComplete();
    window.setTimeout(() => {
      setProgress(0);
    }, 500);
  }, [onComplete]);

  useEffect(() => {
    if (!listenWindowShortcut) return;
    triggeredRef.current = false;

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
        triggerNow();
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
        triggerNow();
        return;
      }
      if (e.button === 0) {
        otherActionWhileCtrlRef.current = true;
      }
    };

    const onWinContextMenu = (e: MouseEvent) => {
      if (e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        triggerNow();
      }
    };

    const onWinBlur = () => {
      const now = Date.now();
      if (
        (ctrlHeldRef.current || now - ctrlDownTsRef.current < 750) &&
        !otherActionWhileCtrlRef.current
      ) {
        ctrlHeldRef.current = false;
        triggerNow();
        return;
      }
      void checkDaemonTelemetry();
    };

    const onDaemonSummonEvent = () => {
      triggerNow();
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ghosti_dojo_last_summon_ts' && e.newValue) {
        triggerNow();
      }
    };

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('ghosti_search_window_singleton_v1');
        bc.onmessage = (ev: MessageEvent) => {
          const msg = ev.data as { type?: string } | null;
          if (msg && (msg.type === 'DOJO_SUMMON_OBSERVED' || msg.type === 'FOCUS_AND_QUERY')) {
            triggerNow();
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
      if (triggeredRef.current || !zCoreBridge.isConnected) return;
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
          triggerNow();
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
        triggerNow();
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
        triggerNow();
      }
    },
    onContextMenu: (e: React.MouseEvent) => {
      if (e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        triggerNow();
      }
    },
  };
  return { progress, leftClickGuide, handlers };
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

const Basic1: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [summoned, setSummoned] = useState(false);
  const { leftClickGuide, handlers } = useInstantSummonTrigger(() => {
    playBabyGhostChime('summon');
    setSummoned(true);
    onDone();
  }, !summoned);
  return (
    <div className="flex flex-col gap-2">
      <div
        {...handlers}
        className="group select-none min-h-24 px-4 py-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/90 hover:border-teal-500 hover:bg-teal-50/40 flex flex-col items-center justify-center gap-2 text-[13px] text-slate-700 cursor-pointer transition-all duration-150 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20"
      >
        <img
          src="/ghostkey_shortcut_badge.png"
          alt="Ctrl+0 / Ctrl+우클릭"
          className="h-7 sm:h-8 w-auto object-contain select-none pointer-events-none transition-transform duration-150 group-hover:scale-105"
        />
        <span>
          이 영역 위에서 <kbd className={summonKeyBadgeCls}>Ctrl + 0</kbd> 또는{' '}
          <kbd className={summonKeyBadgeCls}>Ctrl + 우클릭</kbd>을 눌러보세요.
        </span>
        {leftClickGuide && !summoned && (
          <span className="text-[12px] font-semibold text-teal-800">
            선택되었습니다. 이제 Ctrl + 0 또는 Ctrl + 우클릭을 눌러 호출해 보세요.
          </span>
        )}
      </div>
      {summoned && (
        <div className="px-3.5 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-emerald-950 cursor-default">
          <span className="font-bold">
            ✓ 귀신검색창 호출 완료
          </span>
          <span className="text-emerald-800">문서 본문 · 사진 · 동영상 구간 즉시 검색</span>
        </div>
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
  }, !open);
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
