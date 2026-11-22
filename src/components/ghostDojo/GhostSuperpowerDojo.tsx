import React, { useCallback, useEffect, useState } from 'react';
import { playBabyGhostChime } from '../OnboardingModal';
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

  const triggerNow = useCallback(() => {
    setLeftClickGuide(false);
    setProgress(1);
    onComplete();
    window.setTimeout(() => {
      setProgress(0);
    }, 500);
  }, [onComplete]);

  useEffect(() => {
    if (!listenWindowShortcut) return;
    const onWinKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault();
        triggerNow();
      }
    };
    window.addEventListener('keydown', onWinKeyDown);
    return () => window.removeEventListener('keydown', onWinKeyDown);
  }, [triggerNow, listenWindowShortcut]);

  const handlers = {
    tabIndex: 0,
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.focus();
      setLeftClickGuide(true);
    },
    onMouseDown: (e: React.MouseEvent) => {
      if (e.button === 2 && e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        triggerNow();
      }
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.ctrlKey && (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
        e.preventDefault();
        e.stopPropagation();
        triggerNow();
      }
    },
    onContextMenu: (e: React.MouseEvent) => {
      if (e.ctrlKey) e.preventDefault();
    },
  };
  return { progress, leftClickGuide, handlers };
}

const StampBadge: React.FC<{ done: boolean }> = ({ done }) => (
  <span
    className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold border ${
      done ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-300 text-slate-400'
    }`}
    aria-label={done ? '완료' : '대기'}
  >
    {done ? '✓' : ''}
  </span>
);

const panelCls = 'p-4 rounded-xl bg-white border border-slate-200 flex flex-col gap-3';
const boxCls = 'px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[13px] text-slate-800';
const summonKeyBadgeCls =
  'inline-flex items-center px-2 py-0.5 mx-0.5 rounded bg-white text-slate-900 border border-slate-300 font-mono font-semibold text-[11.5px]';

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
        className="select-none min-h-22 px-4 py-3.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center gap-2 text-[13px] text-slate-600 cursor-pointer focus:outline-none focus:border-slate-900"
      >
        <img
          src="/ghostkey_shortcut_badge.png"
          alt="Ctrl+0 / Ctrl+우클릭"
          className="h-7 sm:h-8 w-auto object-contain select-none pointer-events-none"
        />
        <span>
          이 영역 위에서 <kbd className={summonKeyBadgeCls}>Ctrl + 0</kbd> 또는{' '}
          <kbd className={summonKeyBadgeCls}>Ctrl + 우클릭</kbd>을 눌러보세요.
        </span>
        {leftClickGuide && !summoned && (
          <span className="text-[12px] font-medium text-slate-800">
            선택되었습니다. 이제 Ctrl + 0 또는 Ctrl + 우클릭을 눌러 호출해 보세요.
          </span>
        )}
      </div>
      {summoned && (
        <div className="px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-300 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-slate-800">
          <span className="font-semibold text-slate-900">
            귀신검색창 호출 완료
          </span>
          <span className="text-slate-500">문서 본문 · 사진 · 동영상 구간 즉시 검색</span>
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
  }, !open);
  return (
    <div className="flex flex-col gap-2">
      <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[12px] text-slate-600 leading-relaxed">
        작업 중인 입력창에서 파일을 따로 열지 않고 <kbd className={summonKeyBadgeCls}>Ctrl + 0</kbd>을 눌러 문서 속 수치를 바로 찾아 넣을 수 있습니다.
      </div>
      <div
        {...handlers}
        className={`${boxCls} select-none flex flex-wrap items-center justify-between gap-3 cursor-pointer focus:outline-none focus:border-slate-900`}
      >
        <span className="text-slate-400 text-[12px] shrink-0">메시지 입력창</span>
        <span className="flex-1 font-medium text-slate-900">
          {value === BASIC2_QUERY ? '단가 확인 (여기서 Ctrl + 0 또는 Ctrl + 우클릭)' : `납품 단가: ${value}`}
        </span>
      </div>
      {leftClickGuide && !open && (
        <div className="text-[12px] font-medium text-slate-700 px-1">
          입력창이 선택되었습니다. Ctrl + 0 또는 Ctrl + 우클릭을 눌러 단가를 찾아보세요.
        </div>
      )}
      {open && value === BASIC2_QUERY && (
        <div className="p-3 rounded-lg bg-white border border-slate-300 flex flex-col gap-2">
          <div className="text-[12px] font-semibold text-slate-700">
            문서 본문에서 &ldquo;단가&rdquo; 항목을 찾았습니다. 클릭하여 입력창에 넣으세요.
          </div>
          <button
            type="button"
            onClick={() => {
              setValue(BASIC2_RESULT.value);
              playBabyGhostChime('typo');
              onDone();
            }}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors text-[12.5px]"
          >
            <span className="font-medium text-slate-800">{BASIC2_RESULT.file}</span>
            <span className="font-semibold text-slate-900">
              단가 {BASIC2_RESULT.value} 입력하기 →
            </span>
          </button>
        </div>
      )}
      {value !== BASIC2_QUERY && (
        <div className="px-3 py-2 rounded-lg bg-slate-100 border border-slate-200 text-[12.5px] font-medium text-slate-800">
          입력창에 단가({value})가 입력되었습니다.
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
        <div className="md:col-span-5 p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col items-center justify-center">
          <div className="text-[11px] font-medium text-slate-500 mb-2">
            샘플 영수증 사진 (사업자번호 영역 클릭)
          </div>
          <div className="w-full max-w-[260px] bg-white text-slate-900 rounded-md border border-slate-200 px-3.5 py-3 font-mono text-[11.5px] flex flex-col gap-1.5 shadow-2xs">
            <div className="text-center border-b border-dashed border-slate-300 pb-1.5">
              <div className="font-bold text-[12.5px] text-slate-900">썬드림카페</div>
              <div className="text-[10.5px] text-slate-500">서울 강남구 테헤란로 123 · 대표 백은숙</div>
            </div>

            <button
              type="button"
              onClick={handlePickBizNumber}
              title="영수증 사진 속 사업자번호 영역 클릭"
              className={`w-full text-left px-2 py-1.5 rounded border transition-colors cursor-pointer flex items-center justify-between gap-1 ${
                injected
                  ? 'bg-slate-900 border-slate-900 text-white font-semibold'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-400 text-slate-900 font-semibold'
              }`}
            >
              <span>사업자번호: 123-45-67890</span>
              <span className="text-[10px] font-sans shrink-0">
                {injected ? '추출됨' : '선택'}
              </span>
            </button>

            <div className="border-y border-dashed border-slate-200 py-1 text-[10.5px] text-slate-600 flex flex-col gap-0.5">
              <div className="flex justify-between">
                <span>아메리카노 외 3건</span>
                <span>48,000원</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900">
                <span>합계 금액</span>
                <span>48,000원</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>2026-11-07 14:22</span>
              <span>||| |||| |||</span>
            </div>
          </div>
        </div>

        <div className="md:col-span-7 flex flex-col justify-between gap-2">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex-1 flex flex-col justify-center gap-2">
            <div className="text-[12px] font-semibold text-slate-700">
              추출된 텍스트 항목
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
                    className={`px-2.5 py-1 rounded-md text-[12px] font-medium cursor-pointer border transition-colors ${
                      isTarget && injected
                        ? 'border-slate-900 bg-slate-900 text-white font-semibold'
                        : isTarget
                          ? 'border-slate-400 bg-white hover:bg-slate-100 text-slate-900 font-semibold'
                          : wrong === chip
                            ? 'border-rose-300 bg-rose-50 text-rose-700'
                            : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
            {wrong && (
              <div className="text-[11.5px] text-rose-600">
                [사업자번호: 123-45-67890] 항목을 선택해 주세요.
              </div>
            )}
          </div>

          <div className={`${boxCls} flex items-center justify-between gap-2`}>
            <div>
              <span className="text-slate-500">사업자번호 입력칸: </span>
              <span className="font-semibold text-[13.5px] text-slate-900">{injected || '—'}</span>
            </div>
            {injected && (
              <span className="text-[11.5px] font-medium text-teal-700 shrink-0">
                복사 완료
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
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[14px] font-bold text-slate-900">1단계 · 단축키 호출 연습</h3>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-slate-500">{basicsDone}/3 완료</span>
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
                className="px-2.5 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-medium cursor-pointer"
              >
                초기화
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {BASIC_STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setActiveBasic(s.id);
                setSandboxKey((k) => k + 1);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium border cursor-pointer transition-colors ${
                activeBasic === s.id
                  ? 'border-slate-900 bg-slate-50 text-slate-900 font-semibold'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <StampBadge done={Boolean(progress.basics[s.id])} />
              <span>{i + 1}. {s.title}</span>
            </button>
          ))}
        </div>
        <div className="text-[12.5px] text-slate-500">{BASIC_STEPS.find((s) => s.id === activeBasic)?.mission}</div>
        <BasicSandbox key={`${activeBasic}_${sandboxKey}`} onDone={() => markBasic(activeBasic)} />
      </section>
    </div>
  );
};

export default GhostSuperpowerDojo;
