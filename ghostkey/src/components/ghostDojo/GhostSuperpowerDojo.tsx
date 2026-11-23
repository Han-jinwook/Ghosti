import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { getZCoreUrl, hasActiveGhostiLoginSession, zCoreBridge } from '@shared/services/zCoreBridge';
import {
  playBabyGhostChime,
  simulateSuperpowerLocal,
  startSuperpowerTrialAction,
  fetchSuperpowerStatus,
  type SuperpowerTrialStatus,
} from '../../services/superpowerService';
import {
  DOJO_ROI_BANNER_TEXT,
  BASIC_STEPS,
  DOJO_ITEMS,
  DOJO1_TYPO_SAMPLE,
  DOJO2_BROKEN_PARAGRAPH,
  DOJO3_SEQUENCE,
  DOJO4_DIRTY_TEXT,
  DOJO5_SNIPPETS,
  DOJO6_CLIPBOARD_HISTORY,
  DOJO6_TARGET_QUERY,
  DOJO7_TABLE,
  DOJO8_LABELER_SAMPLES,
  DOJO9_HOVER_FILE,
  DOJO9_SUMMARY_LINES,
  DOJO9_HOVER_DELAY_MS,
  BASIC2_QUERY,
  BASIC2_RESULT,
  BASIC3_CHIPS,
  BASIC3_TARGET_CHIP,
  DOJO_TRIAL_CHOICE_STORAGE_KEY,
  ironLineBreaks,
  launderNewsText,
  searchClipboardHistory,
  tableToTsv,
  loadDojoProgress,
  saveDojoProgress,
  resetDojoProgress,
  countBasicsDone,
  countDojoDone,
  isAllDojoDone,
  type BasicStepId,
  type DojoItemId,
  type DojoProgress,
} from '../../services/ghostDojoEngine';

/* ─────────────────────────────────────────────────────────────
 * 공용: 실제 Ctrl + 0 / Ctrl + 우클릭 전용 소환 훅 (단순 마우스 좌클릭 오완료 원천 차단)
 * ───────────────────────────────────────────────────────────── */
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

const HoldRing: React.FC<{ progress: number; size?: number }> = ({ progress, size = 44 }) => {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.12)" strokeWidth={4} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="#2DD4BF"
        strokeWidth={4}
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - progress)}
        strokeLinecap="round"
      />
    </svg>
  );
};

const StampBadge: React.FC<{ done: boolean }> = ({ done }) => (
  <span
    className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-extrabold border ${
      done ? 'bg-emerald-500 border-emerald-300 text-zinc-950' : 'border-white/20 text-zinc-500'
    }`}
    aria-label={done ? '도장 완료' : '도장 전'}
  >
    {done ? '' : ''}
  </span>
);

const panelCls = 'p-4 rounded-2xl bg-zinc-900 border border-white/10 flex flex-col gap-3';
const boxCls = 'px-3 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-[13px] text-zinc-100';
const btnCls =
  'px-3 py-2 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 text-[12.5px] font-extrabold transition cursor-pointer disabled:opacity-40';
const summonKeyBadgeCls =
  'inline-flex items-center px-2 py-0.5 mx-0.5 rounded-md bg-[#EEF2FF] text-[#1E3A8A] border border-[#4F46E5]/35 dark:bg-indigo-500/25 dark:text-indigo-100 dark:border-indigo-300/45 font-extrabold text-[12px] shadow-2xs';
const highlightTextCls = 'text-[#1E3A8A] dark:text-indigo-200 font-extrabold';
const highlightPillCls =
  'bg-[#EEF2FF] text-[#1E3A8A] border border-[#4F46E5]/35 dark:bg-indigo-500/25 dark:text-indigo-100 dark:border-indigo-300/45';

/* ─────────────────────────────────────────────────────────────
 * 1단계: 애기귀신 소환술 기본기 3단 수련 (B1~B3)
 * ───────────────────────────────────────────────────────────── */
const Basic1: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [summoned, setSummoned] = useState(false);
  const { progress, leftClickGuide, handlers } = useInstantSummonTrigger(() => {
    playBabyGhostChime('summon');
    setSummoned(true);
    onDone();
  }, !summoned);
  return (
    <div className="flex flex-col gap-2">
      <div
        {...handlers}
        className="select-none min-h-24 px-4 py-3 rounded-xl border-2 border-dashed border-[#2DD4BF]/50 bg-zinc-950 flex flex-col sm:flex-row items-center justify-center gap-3 text-[13px] text-zinc-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/60"
      >
        <HoldRing progress={progress} />
        <div className="flex flex-col items-center sm:items-start gap-1 text-center sm:text-left">
          <span>
            이 칸 위에서 키보드 <kbd className={summonKeyBadgeCls}>Ctrl + 0</kbd> 또는 마우스{' '}
            <kbd className={summonKeyBadgeCls}>Ctrl + 우클릭</kbd>을 눌러보세요!
          </span>
          {leftClickGuide && !summoned && (
            <span className="text-[12px] font-extrabold text-amber-600 dark:text-amber-300">
              칸이 선택되었어요! 이제 일반 좌클릭 대신 키보드 Ctrl + 0 (또는 마우스 Ctrl + 우클릭)을 눌러 소환해 보세요!
            </span>
          )}
        </div>
      </div>
      {summoned && (
        <div className={`${boxCls} border-[#2DD4BF]/60 flex flex-col gap-1.5`}>
          <div className={`text-[12px] ${highlightTextCls}`}>기본 귀신Key 소환 완료! (한영·띄어쓰기 자동 성형 · 평소 복붙 원문 보존)</div>
          <div className="flex flex-wrap gap-1.5 text-[11.5px] text-[#1E3A8A] dark:text-indigo-100 font-bold">
            <span className={`px-2 py-0.5 rounded ${highlightPillCls}`}>[Ctrl+V] 순차붙여넣기</span>
            <span className={`px-2 py-0.5 rounded ${highlightPillCls}`}>[1] 서식·줄바꿈 다림질</span>
            <span className={`px-2 py-0.5 rounded ${highlightPillCls}`}>[2] 스샷·PDF변환</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11.5px] text-zinc-200">
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/15">[3] 다중합본</span>
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/15">[4] 번호·일정</span>
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/15">[5] 창고정</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-300/50 text-amber-200 font-bold">[⌨상용구▾]</span>
              <span className={`px-2 py-0.5 rounded ${highlightPillCls} font-bold`}>[꿀팁·기타▾]</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Basic2: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(BASIC2_QUERY);
  const { progress, leftClickGuide, handlers } = useInstantSummonTrigger(() => {
    playBabyGhostChime('summon');
    setOpen(true);
  }, !open);
  return (
    <div className="flex flex-col gap-2">
      <div className="px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-400/30 text-[12px] text-slate-700 dark:text-zinc-200 leading-relaxed">
        <strong>상황 예시:</strong> 카톡 중 거래처에서 <em>&ldquo;작년 납품 단가가 얼마였죠?&rdquo;</em> 물어봤을 때, 바탕화면 엑셀 파일을 찾아 열 필요 없이 쓰던 입력창 위에서 바로{' '}
        <kbd className={summonKeyBadgeCls}>Ctrl + 0</kbd> 또는 <kbd className={summonKeyBadgeCls}>Ctrl + 우클릭</kbd>을 누르면 파일 안의 숫자를 1초 만에 찾아 꽂아줍니다!
      </div>
      <div
        {...handlers}
        className={`${boxCls} select-none flex flex-wrap items-center gap-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/60`}
      >
        <span className="text-zinc-500 text-[12px] shrink-0">카톡 입력창</span>
        <span className="flex-1 font-bold">
          {value === BASIC2_QUERY ? '단가? (여기서 Ctrl + 0 또는 Ctrl + 우클릭!)' : `납품 단가: ${value}`}
        </span>
        <HoldRing progress={progress} size={30} />
      </div>
      {leftClickGuide && !open && (
        <div className="text-[12px] font-extrabold text-amber-600 dark:text-amber-300 px-1">
          입력창이 선택되었어요! 이제 키보드 Ctrl + 0 또는 마우스 Ctrl + 우클릭을 눌러 파일 속 단가를 불러보세요!
        </div>
      )}
      {open && value === BASIC2_QUERY && (
        <div className={`${boxCls} border-[#2DD4BF]/60 flex flex-col gap-1.5`}>
          <div className={`text-[12px] ${highlightTextCls}`}>
            귀신검색창 — 엑셀 파일을 열지 않고도 본문 속 &ldquo;단가&rdquo;를 즉시 찾았습니다! 아래 결과를 클릭해 보세요:
          </div>
          <button
            type="button"
            onClick={() => {
              setValue(BASIC2_RESULT.value);
              playBabyGhostChime('typo');
              onDone();
            }}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-[#2DD4BF]/40 cursor-pointer transition-colors"
          >
            <span className="font-semibold">{BASIC2_RESULT.file} (파일 안 열고 본문 추출)</span>
            <span className="font-extrabold text-[#1E3A8A] dark:text-amber-300 bg-amber-200/80 dark:bg-amber-400/20 px-2.5 py-0.5 rounded-md">
              단가 {BASIC2_RESULT.value} 카톡창에 바로 넣기 ↵
            </span>
          </button>
        </div>
      )}
      {value !== BASIC2_QUERY && (
        <div className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-[12.5px] font-extrabold text-emerald-700 dark:text-emerald-300">
          완료! 엑셀 프로그램을 실행하지 않고도 카톡 입력창에 단가({value})가 1초 만에 입력되었습니다!
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
        {/* 좌측: 실제 종이 영수증 촬영 사진 UI (영수증 이미지 위에서 사업자번호 직접 클릭 가능!) */}
        <div className="md:col-span-5 p-3 rounded-xl bg-slate-200/80 dark:bg-zinc-950 border border-slate-300 dark:border-white/15 flex flex-col items-center justify-center">
          <div className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1">
            <span>방금 찍은 샘플 영수증 사진 (사진 속 번호를 직접 눌러보세요!)</span>
          </div>
          <div
            className="w-full max-w-[270px] bg-[#FFFDF8] text-slate-900 rounded-md shadow-md border border-stone-300 px-3.5 py-3 font-mono text-[11.5px] flex flex-col gap-1.5 relative"
            style={{ boxShadow: '0 6px 16px rgba(15, 23, 42, 0.14)' }}
          >
            <div className="text-center border-b border-dashed border-stone-400 pb-1.5">
              <div className="font-extrabold text-[13px] tracking-tight text-slate-900">[영수증] 썬드림카페</div>
              <div className="text-[10.5px] text-slate-500">서울 강남구 테헤란로 123 · 대표 백은숙</div>
            </div>

            <button
              type="button"
              onClick={handlePickBizNumber}
              title="영수증 사진 속 사업자번호 영역 클릭"
              className={`w-full text-left px-2 py-1.5 rounded-md border-2 transition-all cursor-pointer flex items-center justify-between gap-1 ${
                injected
                  ? 'bg-emerald-100 border-emerald-600 text-emerald-950 font-extrabold'
                  : 'bg-amber-100/90 hover:bg-amber-200 border-[#1E3A8A] text-[#1E3A8A] font-extrabold animate-pulse'
              }`}
            >
              <span>사업자번호: 123-45-67890</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1E3A8A] text-white font-sans shrink-0">
                {injected ? '추출됨' : '콕!'}
              </span>
            </button>

            <div className="border-y border-dashed border-stone-300 py-1 text-[10.5px] text-slate-700 flex flex-col gap-0.5">
              <div className="flex justify-between">
                <span>아메리카노 외 3건</span>
                <span>48,000원</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900">
                <span>합계 금액 (카드결제)</span>
                <span>48,000원</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>거래일시: 2026-11-07 14:22</span>
              <span className="tracking-widest font-bold text-slate-400">||| |||| |||</span>
            </div>
          </div>
        </div>

        {/* 우측: 영수증 사진에서 자동 추출된 단어칩 & 입력 결과 */}
        <div className="md:col-span-7 flex flex-col justify-between gap-2">
          <div className={`${boxCls} border-[#2DD4BF]/60 flex-1 flex flex-col justify-center gap-2`}>
            <div className={`text-[12px] ${highlightTextCls}`}>
              영수증 사진에서 자동 추출된 단어칩 (왼쪽 영수증 사진의 번호나 아래 칩을 클릭!)
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
                    className={`px-2.5 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer border transition-all ${
                      isTarget && injected
                        ? 'border-emerald-500 bg-emerald-500/20 font-extrabold'
                        : isTarget
                          ? 'border-[#1E3A8A] bg-indigo-500/15 hover:bg-indigo-500/25 font-extrabold'
                          : wrong === chip
                            ? 'border-rose-400 bg-rose-500/10'
                            : 'border-white/10 bg-zinc-800 hover:bg-zinc-700'
                    }`}
                  >
                    {isTarget ? `${chip}` : chip}
                  </button>
                );
              })}
            </div>
            {wrong && (
              <div className="text-[11.5px] text-rose-600 dark:text-rose-300 font-bold">
                미션 목표는 영수증의 [사업자번호: 123-45-67890]이에요! 왼쪽 영수증 사진이나 칩을 눌러보세요.
              </div>
            )}
          </div>

          <div className={`${boxCls} flex items-center justify-between gap-2`}>
            <div>
              <span className="text-zinc-500">세금계산서 사업자번호 입력칸: </span>
              <span className="font-extrabold text-[14px]">{injected || '＿＿＿＿＿＿＿＿＿＿'}</span>
            </div>
            {injected && (
              <span className="text-[11.5px] font-extrabold text-emerald-600 dark:text-emerald-400 shrink-0">
                0.1초 자동 입력 &amp; 복사 완료!
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
 * 2단계: 초능력 9종 도장깨기 샌드박스 (B4)
 * ───────────────────────────────────────────────────────────── */
const DOJO_SANDBOX_TITLE_MARKER = '\u2063';

const Dojo1: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [text, setText] = useState('');
  const idleTimerRef = useRef<number>(0);
  const dotRollbackRef = useRef<{ rawFull: string; convertedFull: string } | null>(null);

  const setSandboxTitleGuard = useCallback((focused: boolean) => {
    if (typeof document === 'undefined') return;
    const base = document.title.replaceAll(DOJO_SANDBOX_TITLE_MARKER, '');
    document.title = focused ? `${base}${DOJO_SANDBOX_TITLE_MARKER}` : base;
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(idleTimerRef.current);
      setSandboxTitleGuard(false);
    };
  }, [setSandboxTitleGuard]);

  const applyTypoMorph = useCallback(
    (rawVal: string, appendSuffix = '') => {
      const leadSpace = rawVal.match(/^\s*/)?.[0] ?? '';
      const trailSpace = rawVal.match(/\s*$/)?.[0] ?? '';
      const core = rawVal.trim();
      if (!core || !/[A-Za-z]{2,}/.test(core)) return false;
      const convertedCore = simulateSuperpowerLocal('typo', core);
      if (convertedCore !== core && /[가-힣]/.test(convertedCore)) {
        const nextVal = `${leadSpace}${convertedCore}${appendSuffix || trailSpace}`;
        if (rawVal.endsWith('.') && !appendSuffix) {
          dotRollbackRef.current = { rawFull: rawVal, convertedFull: nextVal };
        } else {
          dotRollbackRef.current = null;
        }
        setText(nextVal);
        playBabyGhostChime('typo');
        onDone();
        return true;
      }
      return false;
    },
    [onDone],
  );

  useEffect(() => {
    window.clearTimeout(idleTimerRef.current);
    const trimmed = text.trim();
    if (!trimmed || !/[A-Za-z]{2,}/.test(trimmed)) return;
    const endsWithSentencePunct = /[A-Za-z]{2,}[.,~]$/.test(trimmed);
    if (!endsWithSentencePunct && !/[A-Za-z]{4,}/.test(trimmed)) return;
    const delayMs = endsWithSentencePunct ? 380 : 850;
    idleTimerRef.current = window.setTimeout(() => {
      applyTypoMorph(text, '');
    }, delayMs);
    return () => window.clearTimeout(idleTimerRef.current);
  }, [text, applyTypoMorph]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={text}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          onFocus={() => setSandboxTitleGuard(true)}
          onBlur={() => setSandboxTitleGuard(false)}
          onChange={(e) => {
            const nextVal = e.target.value;
            const rb = dotRollbackRef.current;
            if (
              rb &&
              nextVal.length === rb.convertedFull.length + 1 &&
              nextVal.startsWith(rb.convertedFull) &&
              /[A-Za-z]/.test(nextVal[nextVal.length - 1])
            ) {
              dotRollbackRef.current = null;
              setText(rb.rawFull + nextVal[nextVal.length - 1]);
              return;
            }
            dotRollbackRef.current = null;
            setText(nextVal);
          }}
          onKeyDown={(e) => {
            if ((e.key === ' ' || e.key === 'Enter') && /[A-Za-z]{2,}/.test(text)) {
              if (applyTypoMorph(text, e.key === ' ' ? ' ' : '')) {
                e.preventDefault();
              }
              return;
            }
            if ((e.key === '?' || e.key === '!') && /[A-Za-z]{2,}$/.test(text)) {
              const lastTok = text.trim().split(/\s+/).pop() || '';
              if (!lastTok.includes('@') && !lastTok.includes('://') && !/^www\./i.test(lastTok)) {
                if (applyTypoMorph(text, e.key)) {
                  e.preventDefault();
                }
              }
            }
          }}
          placeholder={DOJO1_TYPO_SAMPLE}
          className={`${boxCls} flex-1 focus:outline-none focus:border-[#2DD4BF]`}
        />
        <button type="button" className={btnCls} onClick={() => setText(DOJO1_TYPO_SAMPLE)}>
          예제 넣기
        </button>
      </div>
      <div className="text-[11.5px] text-zinc-400">
        실전 안내: <strong className="text-zinc-200">메모장·카카오톡·엑셀 셀 편집·크롬/엣지/웨일 웹 글쓰기</strong>에서는 스페이스바·문장부호(. ? !) 또는 1초 정지 시 실시간 자동변환(원복은 <strong className={highlightTextCls}>Ctrl+Z</strong> 또는 5초 내 <strong className={highlightTextCls}>Ctrl+0</strong>)되며, 이메일·주소·비밀번호처럼 영문이어야 하는 글자는 그대로 지켜지고 <strong className="text-zinc-200">한글(HWP)·MS Word</strong>는 자체 한영 교정에 양보합니다. <strong className={highlightTextCls}>Ctrl+0 [1]</strong>은 복사해 온 글의 서식·줄바꿈 다림질을 전담합니다.
      </div>
    </div>
  );
};

const Dojo2: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [text, setText] = useState(DOJO2_BROKEN_PARAGRAPH);
  const done = text !== DOJO2_BROKEN_PARAGRAPH;
  return (
    <div className="flex flex-col gap-2">
      <div className={`${boxCls} whitespace-pre-line leading-relaxed`}>{text}</div>
      <button
        type="button"
        disabled={done}
        className={btnCls}
        onClick={() => {
          setText(ironLineBreaks(DOJO2_BROKEN_PARAGRAPH));
          playBabyGhostChime('typo');
          onDone();
        }}
      >
        1초 다림질
      </button>
    </div>
  );
};

const Dojo3: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [loaded, setLoaded] = useState(false);
  const [fields, setFields] = useState<string[]>(['', '', '']);
  const boxRefs = useRef<Array<HTMLDivElement | null>>([null, null, null]);
  const next = fields.findIndex((f) => !f);

  const fireNextPaste = useCallback(
    (targetIdx?: number) => {
      if (!loaded || next < 0) return;
      if (targetIdx !== undefined && targetIdx !== next) return;
      const updated = [...fields];
      updated[next] = DOJO3_SEQUENCE[next];
      setFields(updated);
      if (updated.every(Boolean)) {
        playBabyGhostChime('typo');
        onDone();
      } else {
        const nextEmpty = updated.findIndex((f) => !f);
        if (nextEmpty >= 0) {
          window.setTimeout(() => boxRefs.current[nextEmpty]?.focus(), 20);
        }
      }
    },
    [loaded, next, fields, onDone],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {DOJO3_SEQUENCE.map((v, i) => (
          <span key={v} className="px-2 py-1 rounded-lg bg-zinc-800 text-[12px]">
            {i + 1}. {v}
          </span>
        ))}
        <button
          type="button"
          className={btnCls}
          disabled={loaded}
          onClick={() => {
            setLoaded(true);
            window.setTimeout(() => boxRefs.current[0]?.focus(), 30);
          }}
        >
          3개 연속 복사
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['이름', '전화', '주소'].map((label, i) => (
          <div
            key={label}
            ref={(el) => {
              boxRefs.current[i] = el;
            }}
            tabIndex={0}
            onClick={() => fireNextPaste(i)}
            onContextMenu={(e) => {
              e.preventDefault();
              fireNextPaste(i);
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'v' || e.code === 'KeyV')) {
                e.preventDefault();
                fireNextPaste();
              }
            }}
            onPaste={(e) => {
              e.preventDefault();
              fireNextPaste();
            }}
            className={`${boxCls} select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/60 ${
              loaded && i === next ? 'border-[#2DD4BF] animate-pulse' : ''
            }`}
          >
            <div className="text-[11px] text-zinc-500">{label} {loaded && i === next ? '(Ctrl+V 또는 클릭)' : ''}</div>
            <div className="font-bold min-h-[18px]">{fields[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Dojo4: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [clean, setClean] = useState('');
  return (
    <div className="flex flex-col gap-2">
      <div className="px-3 py-2.5 rounded-xl bg-black text-zinc-400 text-[12.5px] whitespace-pre-line border border-white/5">
        {DOJO4_DIRTY_TEXT}
      </div>
      <button
        type="button"
        disabled={Boolean(clean)}
        className={btnCls}
        onClick={() => {
          setClean(launderNewsText(DOJO4_DIRTY_TEXT));
          playBabyGhostChime('typo');
          onDone();
        }}
      >
        서식 세탁
      </button>
      {clean && <div className="px-3 py-2.5 rounded-xl bg-white text-zinc-900 text-[13px]">{clean}</div>}
    </div>
  );
};

const Dojo5: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [value, setValue] = useState('');
  const [used, setUsed] = useState<{ F1?: boolean; F7?: boolean }>({});
  const inject = (key: 'F1' | 'F7') => {
    const nextUsed = { ...used, [key]: true };
    setUsed(nextUsed);
    setValue(DOJO5_SNIPPETS[key].text);
    playBabyGhostChime('typo');
    if (nextUsed.F1 && nextUsed.F7) onDone();
  };
  return (
    <div className="flex flex-col gap-2">
      <input
        readOnly
        value={value}
        onKeyDown={(e) => {
          if (e.key === 'F1' || e.key === 'F7') {
            e.preventDefault();
            inject(e.key);
          }
        }}
        placeholder="여기를 누르고 F1 → F7"
        className={`${boxCls} focus:outline-none focus:border-[#2DD4BF]`}
      />
      <div className="flex gap-1.5">
        {(['F1', 'F7'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => inject(k)}
            className={`px-2.5 py-1 rounded-lg text-[12px] border cursor-pointer ${
              used[k] ? 'border-emerald-400 text-emerald-300' : 'border-white/10 bg-zinc-800'
            }`}
          >
            {DOJO5_SNIPPETS[k].label}
          </button>
        ))}
      </div>
    </div>
  );
};

const Dojo6: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState('');
  const hits = useMemo(() => searchClipboardHistory(DOJO6_CLIPBOARD_HISTORY, q), [q]);
  return (
    <div className="flex flex-col gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`클립보드 검색 (예: ${DOJO6_TARGET_QUERY})`}
        className={`${boxCls} focus:outline-none focus:border-[#2DD4BF]`}
      />
      <div className="flex flex-col gap-1">
        {hits.map((h) => (
          <button
            key={h.text}
            type="button"
            onClick={() => {
              setPicked(h.text);
              if (h.text.includes('우리은행')) {
                playBabyGhostChime('typo');
                onDone();
              }
            }}
            className={`flex justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-[12.5px] cursor-pointer ${
              picked === h.text ? 'bg-emerald-500/15 border border-emerald-400/50' : 'bg-zinc-950 hover:bg-zinc-800'
            }`}
          >
            <span className="truncate">{h.text}</span>
            <span className="text-zinc-500 shrink-0">{h.when}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const Dojo7: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [extracted, setExtracted] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="relative select-none rounded-xl overflow-hidden border border-white/10">
        <div className="absolute top-1.5 right-2 text-[10.5px] text-zinc-500">이미지 (드래그 불가)</div>
        <div className="grid grid-cols-4 bg-zinc-200 text-zinc-700 text-[12px] blur-[0.3px]" style={{ fontFamily: 'serif' }}>
          {DOJO7_TABLE.flat().map((cell, i) => (
            <div key={i} className="px-2 py-1.5 border border-zinc-300">
              {cell}
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        disabled={extracted}
        className={btnCls}
        onClick={() => {
          void navigator.clipboard?.writeText(tableToTsv(DOJO7_TABLE)).catch(() => {});
          setExtracted(true);
          playBabyGhostChime('typo');
          onDone();
        }}
      >
        엑셀 표로 추출
      </button>
      {extracted && (
        <div className="rounded-xl overflow-hidden border border-emerald-400/50">
          <div className="grid grid-cols-4 bg-white text-zinc-900 text-[12px]">
            {DOJO7_TABLE.flat().map((cell, i) => (
              <div key={i} className={`px-2 py-1.5 border border-emerald-200 ${i < 4 ? 'font-bold bg-emerald-50' : ''}`}>
                {cell}
              </div>
            ))}
          </div>
          <div className="px-2.5 py-1.5 text-[11.5px] text-emerald-300 bg-zinc-950">복사됨 — 엑셀에서 Ctrl+V</div>
        </div>
      )}
    </div>
  );
};

const Dojo8: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [renamed, setRenamed] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className={`text-[11.5px] ${highlightTextCls}`}>
        실제 사용법: 『귀신검색창』 유료 티어 기능 — 검색창에서 사진·카톡사진·문서를 골라 <span className="underline text-amber-300">[귀신 라벨러]</span> 클릭!
      </div>
      <div className="flex flex-col gap-1">
        {DOJO8_LABELER_SAMPLES.map((s) => (
          <div key={s.before} className={`${boxCls} flex items-center justify-between gap-2`}>
            <span className={`truncate font-mono text-[12.5px] ${renamed ? 'text-emerald-300 font-bold' : ''}`}>
              {renamed ? s.after : s.before}
            </span>
            {renamed && <span className="text-[11px] text-zinc-500 shrink-0">{s.dateRule}</span>}
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={renamed}
        className={btnCls}
        onClick={() => {
          setRenamed(true);
          playBabyGhostChime('typo');
          onDone();
        }}
      >
        귀신 라벨러 (날짜·내용 파일명 자동 정리) 실행 체험
      </button>
    </div>
  );
};

const Dojo9: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [show, setShow] = useState(false);
  const timer = useRef<number>(0);
  const firedRef = useRef(false);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <div className="relative flex items-start gap-4 py-2">
      <div
        onMouseEnter={() => {
          timer.current = window.setTimeout(() => {
            setShow(true);
            if (!firedRef.current) {
              firedRef.current = true;
              playBabyGhostChime('typo');
              onDone();
            }
          }, DOJO9_HOVER_DELAY_MS);
        }}
        onMouseLeave={() => {
          window.clearTimeout(timer.current);
          setShow(false);
        }}
        className="w-24 flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-zinc-800 cursor-default"
      >
        <span className="text-[34px]"></span>
        <span className="text-[11.5px] text-zinc-300 text-center break-all">{DOJO9_HOVER_FILE}</span>
      </div>
      {show && (
        <div className="px-3 py-2 rounded-xl bg-amber-100 text-zinc-900 text-[12.5px] font-bold shadow-lg leading-relaxed">
          {DOJO9_SUMMARY_LINES.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
};

const Dojo10: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [converted, setConverted] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className={boxCls}>
        클립보드 화면 캡처 3장 (세금계산서_1.png · 영수증_2.png · 견적서_3.png)
      </div>
      <button
        type="button"
        disabled={converted}
        className={btnCls}
        onClick={() => {
          setConverted(true);
          playBabyGhostChime('typo');
          onDone();
        }}
      >
        [2] 스샷 실물 PNG &amp; 300DPI PDF 변환
      </button>
      {converted && (
        <div className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-[12.5px] font-extrabold text-emerald-300">
          [귀신스샷_합본_3장_300DPI.pdf] 생성 및 클립보드 파일 장전 완료! (카톡·메일에서 Ctrl+V로 즉시 첨부)
        </div>
      )}
    </div>
  );
};

const Dojo11: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [merged, setMerged] = useState(false);
  const sampleParts = ['1. 계약 개요: 역삼빌딩 6층 임대차', '2. 단가 조건: 보증금 5,000만 / 월 220만', '3. 특약 사항: 기본 칸막이 원상복구 면제'];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {sampleParts.map((p) => (
          <span key={p} className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-[12px] text-zinc-200">
            {p}
          </span>
        ))}
      </div>
      <button
        type="button"
        disabled={merged}
        className={btnCls}
        onClick={() => {
          setMerged(true);
          playBabyGhostChime('typo');
          onDone();
        }}
      >
        [3] 다중 복사 1초 통짜 합본
      </button>
      {merged && (
        <div className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-[12.5px] font-bold text-emerald-200 whitespace-pre-line">
          {sampleParts.join('\n')}
        </div>
      )}
    </div>
  );
};

const Dojo12: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [formatted, setFormatted] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className={`${boxCls} font-mono`}>
        {formatted
          ? '연락처: 010-1234-5678 / 사업자: 214-88-12345 / 계약일: 2026-11-20'
          : '연락처: 01012345678 / 사업자: 2148812345 / 계약일: 20261120'}
      </div>
      <button
        type="button"
        disabled={formatted}
        className={btnCls}
        onClick={() => {
          setFormatted(true);
          playBabyGhostChime('typo');
          onDone();
        }}
      >
        [4] 번호·일정 하이픈 1초 성형
      </button>
    </div>
  );
};

const Dojo13: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [pinned, setPinned] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className={`${boxCls} flex items-center justify-between`}>
        <span>참고 중인 엑셀 문서 창 (261105_업무정리.xlsx)</span>
        <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold ${pinned ? 'bg-amber-400 text-zinc-950' : 'bg-zinc-800 text-zinc-400'}`}>
          {pinned ? '항상 위 고정됨 (Always on Top)' : '일반 창'}
        </span>
      </div>
      <button
        type="button"
        disabled={pinned}
        className={btnCls}
        onClick={() => {
          setPinned(true);
          playBabyGhostChime('typo');
          onDone();
        }}
      >
        [5] 현재 작업창 화면 최상단 고정
      </button>
    </div>
  );
};

const DOJO_SANDBOXES: Record<DojoItemId, React.FC<{ onDone: () => void }>> = {
  1: Dojo1,
  2: Dojo2,
  3: Dojo3,
  4: Dojo4,
  5: Dojo5,
  6: Dojo6,
  7: Dojo7,
  8: Dojo8,
  9: Dojo9,
  10: Dojo10,
  11: Dojo11,
  12: Dojo12,
  13: Dojo13,
};

const BASIC_SANDBOXES: Record<BasicStepId, React.FC<{ onDone: () => void }>> = {
  b1: Basic1,
  b2: Basic2,
  b3: Basic3,
};

/* ─────────────────────────────────────────────────────────────
 * 최종 보상: 30일 무제한 체험권 수여식 (Opt-in) (B5)
 * ───────────────────────────────────────────────────────────── */
const TrialRewardCard: React.FC = () => {
  const { merlinAuth, activePricingPlan, subscribedLounges } = useSaySeeStore();
  const accountId = merlinAuth?.email || merlinAuth?.userId || 'local_user';
  const isSubscribed = activePricingPlan !== 'free_trial' || Object.values(subscribedLounges).some(Boolean);
  const [status, setStatus] = useState<SuperpowerTrialStatus | null>(null);
  const [choice, setChoice] = useState<'none' | 'trial' | 'later' | 'expired'>(() => {
    try {
      const saved = localStorage.getItem(DOJO_TRIAL_CHOICE_STORAGE_KEY);
      if (saved === 'trial' || saved === 'later') return saved;
    } catch {
      /* ignore */
    }
    return 'none';
  });

  const lastBackendSigRef = useRef<string>('');

  useEffect(() => {
    const syncFromBackend = async () => {
      const st = await fetchSuperpowerStatus(accountId, isSubscribed);
      const sig = `${st.trial_status}|${st.trial_opt_in_status || ''}|${st.trial_days_left}|${st.is_subscribed}`;
      if (sig === lastBackendSigRef.current) return;
      lastBackendSigRef.current = sig;
      setStatus(st);
      const nextChoice =
        st.trial_status === 'ACTIVE_30D' || st.trial_status === 'SUBSCRIBED'
          ? 'trial'
          : st.trial_status === 'EXPIRED_LOCKED' || st.trial_status === 'EXPIRED'
            ? 'expired'
            : st.trial_opt_in_status === 'DEFERRED'
              ? 'later'
              : 'none';
      setChoice(nextChoice);
      if (nextChoice !== 'expired') {
        try {
          if (localStorage.getItem(DOJO_TRIAL_CHOICE_STORAGE_KEY) !== nextChoice) {
            localStorage.setItem(DOJO_TRIAL_CHOICE_STORAGE_KEY, nextChoice);
            window.dispatchEvent(new CustomEvent('ghosti_dojo_trial_choice_updated'));
          }
        } catch {
          /* ignore */
        }
      }
    };
    void syncFromBackend();
    const pollId = window.setInterval(() => {
      if (zCoreBridge.isConnected) void syncFromBackend();
    }, 10000);
    const unsub = zCoreBridge.subscribe((connected) => {
      if (connected) void syncFromBackend();
    });
    const syncChoice = () => {
      try {
        const saved = localStorage.getItem(DOJO_TRIAL_CHOICE_STORAGE_KEY);
        if (saved === 'trial' || saved === 'later' || saved === 'none') setChoice(saved);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('ghosti_dojo_trial_choice_updated', syncChoice);
    return () => {
      window.clearInterval(pollId);
      unsub();
      window.removeEventListener('ghosti_dojo_trial_choice_updated', syncChoice);
    };
  }, [accountId, isSubscribed]);

  const daysLeftBadge =
    status?.trial_status === 'SUBSCRIBED'
      ? '평생 무제한 구독중'
      : status?.trial_days_left && status.trial_days_left < 9999
        ? `잔여 D-${status.trial_days_left}`
        : '30일간 무제한';

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/15 to-emerald-500/10 border-2 border-amber-400/60 flex flex-col gap-2.5">
      <div className="text-[15px] font-extrabold text-white">
        축하합니다! &apos;애기귀신 소환술&apos;을 마스터하여 연간 209시간(27일)의 복붙 노가다에서 해방되셨습니다!
      </div>
      <div className="text-[13px] text-zinc-200 leading-relaxed">
        매일 쓰는 기본 습관기(자동 한영·띄어쓰기 · Ctrl+0→Ctrl+V 순차붙여넣기 · [1] 서식·줄바꿈 · F1~F6)는 언제나 평생 무제한 무료이며, 체험 완료 보상으로 모든 확장 기능을 아우르는{' '}
        <strong className="text-amber-300">『모든 귀신 초능력 30일 무제한 무료체험권』</strong>이 도착했습니다! 지금 바로 열어드릴까요?
      </div>
      <div className="text-[11.5px] text-zinc-400">
        (※ 카드 등록 없음 · 자동 결제 절대 없음 · 30일 만료 시 유료 기능만 깔끔하게 잠기며, 이미 내 PC 로컬 폴더에 복사된 사진·파일은 영구 보존됩니다!)
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          disabled={choice === 'expired'}
          className={`px-4 py-2.5 rounded-xl text-[13px] font-extrabold cursor-pointer transition-all disabled:opacity-50 ${
            choice === 'trial'
              ? 'bg-emerald-400 text-zinc-950 ring-2 ring-emerald-300 shadow-md'
              : 'bg-amber-400 hover:bg-amber-300 text-zinc-950'
          }`}
          onClick={async () => {
            setChoice('trial');
            try {
              localStorage.setItem(DOJO_TRIAL_CHOICE_STORAGE_KEY, 'trial');
              window.dispatchEvent(new CustomEvent('ghosti_dojo_trial_choice_updated'));
            } catch {
              /* ignore */
            }
            playBabyGhostChime('summon');
            const st = await startSuperpowerTrialAction(accountId, isSubscribed, true);
            setStatus(st);
          }}
        >
          {choice === 'trial'
            ? `30일 무제한 초능력 체험 중 (${daysLeftBadge})`
            : choice === 'expired'
              ? '30일 무료체험 종료됨 (무료 기본기는 평생 0원)'
              : '네! 오늘부터 30일 무제한 초능력 체험 시작하기'}
        </button>
        {choice !== 'expired' && (
          <button
            type="button"
            className={`px-4 py-2.5 rounded-xl border text-[13px] font-bold cursor-pointer transition-all ${
              choice === 'later'
                ? `${highlightPillCls} ring-1 ring-[#4F46E5]/45`
                : 'border-white/20 text-zinc-300 hover:bg-white/5'
            }`}
            onClick={async () => {
              setChoice('later');
              try {
                localStorage.setItem(DOJO_TRIAL_CHOICE_STORAGE_KEY, 'later');
                window.dispatchEvent(new CustomEvent('ghosti_dojo_trial_choice_updated'));
              } catch {
                /* ignore */
              }
              playBabyGhostChime('typo');
              const st = await startSuperpowerTrialAction(accountId, false, false);
              setStatus(st);
            }}
          >
            {choice === 'later'
              ? '평생 무료 기본기부터 쓰는 중 (언제든 왼쪽 버튼으로 30일 체험 시작 가능)'
              : choice === 'trial'
                ? '나중에 시작할게요 (30일 체험 미시작 상태로 전환)'
                : '나중에 필요할 때 시작할게요 (평생 무료 기본기부터 쓰기)'}
          </button>
        )}
      </div>
      {choice === 'trial' && (
        <div className="px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-[12.5px] font-extrabold text-emerald-300">
          체험중 ({daysLeftBadge}) — 내 PC 귀신Key(Ctrl+0)과 웹에서 모든 유료 티어 초능력을 횟수 제한 없이 무제한으로 사용하실 수 있습니다!
        </div>
      )}
      {choice === 'later' && (
        <div className={`px-3.5 py-2 rounded-xl ${highlightPillCls} text-[12.5px] font-extrabold`}>
          평생 무료 기본기 모드가 적용되었습니다. (30일 무제한 무료체험권은 몰래 차감되지 않고 아껴두었으며 언제든 왼쪽 버튼이나 귀신Key 도구를 눌러 시작하실 수 있습니다!)
        </div>
      )}
      {choice === 'expired' && (
        <div className="px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-400/50 text-[12.5px] font-extrabold text-amber-200">
          30일 무제한 무료체험이 종료되어 유료 도구만 잠겼습니다. 평생 무료 기본기(자동 한영·순차복붙·[1]다림질·F1~F6)는 앞으로도 영구 0원으로 작동합니다!
        </div>
      )}
    </div>
  );
};

const PERSONAL_SNIPPETS_STORAGE_KEY = 'ghosti_personal_snippets_v1';
const LEGACY_ONBOARDING_SNIPPETS_KEY = 'ghosti_superpower_snippets_v27';

interface PersonalSnippetSlot {
  slot: 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6';
  title: string;
  value: string;
}

const DEFAULT_PERSONAL_SNIPPETS: PersonalSnippetSlot[] = [
  { slot: 'F1', title: '내 주거래 계좌', value: '국민은행 012-3456-7890-11 (예금주: 홍길동)' },
  { slot: 'F2', title: '집·배송지 주소', value: '서울특별시 강남구 테헤란로 123, 101동 1204호' },
  { slot: 'F3', title: '개인 이메일', value: 'myid@naver.com' },
  { slot: 'F4', title: '휴대폰 번호', value: '010-1234-5678' },
  { slot: 'F5', title: '빠른 감사 인사', value: '보내주신 내용 잘 확인했습니다. 빠르게 검토 후 연락드리겠습니다!' },
  { slot: 'F6', title: '현금영수증·사업자번호', value: '지출증빙 010-1234-5678' },
];

const PersonalSnippetsRegistryPanel: React.FC = () => {
  const [slots, setSlots] = useState<PersonalSnippetSlot[]>(() => {
    try {
      const raw = localStorage.getItem(PERSONAL_SNIPPETS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersonalSnippetSlot[];
        if (Array.isArray(parsed) && parsed.length === 6) return parsed;
      }
      const legacyRaw = localStorage.getItem(LEGACY_ONBOARDING_SNIPPETS_KEY);
      if (legacyRaw) {
        const legMap = JSON.parse(legacyRaw) as Record<string, string>;
        if (legMap && typeof legMap === 'object') {
          return DEFAULT_PERSONAL_SNIPPETS.map((s) => ({
            ...s,
            value: typeof legMap[s.slot] === 'string' ? legMap[s.slot] : s.value,
          }));
        }
      }
    } catch {
      /* ignore */
    }
    return DEFAULT_PERSONAL_SNIPPETS;
  });
  const [savedNoticeSlot, setSavedNoticeSlot] = useState<string | null>(null);
  const [savedSlotConfirm, setSavedSlotConfirm] = useState<string | null>(null);
  const [zCoreSynced, setZCoreSynced] = useState<boolean>(false);
  const syncTimerRef = useRef<number>(0);
  const slotsRef = useRef<PersonalSnippetSlot[]>(slots);
  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  const pushSnippetsToZCore = useCallback(async (targetSlots: PersonalSnippetSlot[], confirmKey?: string) => {
    const snippetMap: Record<string, string> = {};
    targetSlots.forEach((s) => {
      snippetMap[s.slot] = s.value;
    });
    try {
      localStorage.setItem(PERSONAL_SNIPPETS_STORAGE_KEY, JSON.stringify(targetSlots));
      localStorage.setItem(LEGACY_ONBOARDING_SNIPPETS_KEY, JSON.stringify(snippetMap));
    } catch {
      /* ignore */
    }
    if (confirmKey) {
      setSavedSlotConfirm(confirmKey);
      playBabyGhostChime('typo');
      window.setTimeout(() => setSavedSlotConfirm((prev) => (prev === confirmKey ? null : prev)), 1800);
    }
    if (!zCoreBridge.isConnected) return;
    try {
      const res = await fetch(getZCoreUrl('/api/superpower/snippets'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snippets: snippetMap }),
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        setZCoreSynced(true);
      }
    } catch {
      /* offline fallback */
    }
  }, []);

  useEffect(() => {
    const hydrateFromZCore = async () => {
      if (!zCoreBridge.isConnected) return;
      const hadCustomLocal = Boolean(localStorage.getItem(PERSONAL_SNIPPETS_STORAGE_KEY));
      try {
        const res = await fetch(getZCoreUrl('/api/superpower/snippets'), {
          signal: AbortSignal.timeout(1500),
        });
        if (!res.ok) return;
        const data = await res.json();
        const remote = (data?.snippets || {}) as Record<string, string>;
        if (hadCustomLocal) {
          // 로컬에서 먼저 적어둔 최신 상용구가 있으면 Z-코어로 즉시 밀어넣어 100% 일치시킴
          void pushSnippetsToZCore(slotsRef.current);
          return;
        }
        setSlots((prev) => {
          const next = prev.map((item) => ({
            ...item,
            value: typeof remote[item.slot] === 'string' ? remote[item.slot] : item.value,
          }));
          try {
            localStorage.setItem(PERSONAL_SNIPPETS_STORAGE_KEY, JSON.stringify(next));
          } catch {
            /* ignore */
          }
          return next;
        });
        setZCoreSynced(true);
      } catch {
        /* ignore */
      }
    };
    if (zCoreBridge.isConnected) void hydrateFromZCore();
    const unsub = zCoreBridge.subscribe((connected) => {
      if (connected) void hydrateFromZCore();
      else setZCoreSynced(false);
    });
    return () => {
      unsub();
      window.clearTimeout(syncTimerRef.current);
    };
  }, [pushSnippetsToZCore]);

  const updateSlot = (idx: number, field: 'title' | 'value', nextVal: string) => {
    const updated = slots.map((item, i) => (i === idx ? { ...item, [field]: nextVal } : item));
    slotsRef.current = updated;
    setSlots(updated);
    try {
      localStorage.setItem(PERSONAL_SNIPPETS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      /* ignore */
    }
    window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      void pushSnippetsToZCore(updated);
    }, 320);
  };

  const { isStoreAppMode, setActiveLoungeType, setDesktopTab } = useSaySeeStore();
  const [clipPqlToastVisible, setClipPqlToastVisible] = useState(false);

  const triggerOneTimeClipPqlToast = () => {
    if (isStoreAppMode) return;
    try {
      if (sessionStorage.getItem('ghosti_pql_clip_toast_shown') === '1') return;
      sessionStorage.setItem('ghosti_pql_clip_toast_shown', '1');
    } catch {
      /* ignore */
    }
    setClipPqlToastVisible(true);
  };

  const handleQuickCopy = (slotName: string, val: string) => {
    void navigator.clipboard?.writeText(val).catch(() => {});
    playBabyGhostChime('typo');
    setSavedNoticeSlot(slotName);
    triggerOneTimeClipPqlToast();
    window.setTimeout(() => setSavedNoticeSlot(null), 1500);
  };

  return (
    <section className={panelCls}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-extrabold text-white">
            ⌨ 내 개인 상용구 등록창 (F1 ~ F6 · 평생 무료)
          </h3>
          <p className="text-[12px] text-zinc-400 mt-0.5">
            자주 쓰는 계좌번호·주소·인사말을 적어 저장하면 어느 창에서든 귀신Key(<kbd className={summonKeyBadgeCls}>Ctrl + 0</kbd>) 소환 후 F1~F6 키 한 번으로 0.1초 자동 입력됩니다 (평소 브라우저·앱의 F1~F6 단축키와 충돌 0%).
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void pushSnippetsToZCore(slots, 'ALL')}
            className="px-3 py-1.5 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 text-[12px] font-extrabold cursor-pointer transition shadow-sm"
          >
            {savedSlotConfirm === 'ALL' ? '전체 상용구 저장 완료!' : '전체 상용구 저장'}
          </button>
          <span className={`px-2.5 py-1 rounded-full ${highlightPillCls} text-[11px] font-black shrink-0`}>
            {zCoreSynced ? '내 PC 귀신Key(F1~F6) 실시간 연동됨' : '내 PC 자동 저장 · 평생 0원'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {slots.map((item, idx) => (
          <div
            key={item.slot}
            className="p-3 rounded-xl bg-zinc-950 border border-white/10 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className={`px-2 py-0.5 rounded-lg ${highlightPillCls} font-mono text-[11.5px] font-black shrink-0`}>
                  {item.slot}
                </span>
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => updateSlot(idx, 'title', e.target.value)}
                  aria-label={`${item.slot} 상용구 제목`}
                  className="min-w-0 flex-1 bg-transparent text-[12.5px] font-extrabold text-white focus:outline-none border-b border-transparent focus:border-[#2DD4BF]"
                />
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => void pushSnippetsToZCore(slots, item.slot)}
                  className="px-2.5 py-1 rounded-lg bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 text-[11px] font-extrabold cursor-pointer"
                >
                  {savedSlotConfirm === item.slot ? '저장됨' : '저장'}
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickCopy(item.slot, item.value)}
                  className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-bold text-[#1E3A8A] dark:text-indigo-200 cursor-pointer"
                >
                  {savedNoticeSlot === item.slot ? '복사됨' : '복사 테스트'}
                </button>
              </div>
            </div>
            <input
              type="text"
              value={item.value}
              onChange={(e) => updateSlot(idx, 'value', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void pushSnippetsToZCore(slots, item.slot);
                }
              }}
              aria-label={`${item.slot} 상용구 내용`}
              placeholder="자주 입력하는 문구를 적어두세요 (비워두고 저장하면 빈 상태 유지)"
              className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/10 focus:border-[#2DD4BF] text-[12.5px] text-zinc-200 outline-none"
            />
          </div>
        ))}
      </div>

      {clipPqlToastVisible && !isStoreAppMode && (
        <div className={`px-3.5 py-2.5 rounded-xl ${highlightPillCls} flex flex-wrap items-center justify-between gap-2 text-[12px]`}>
          <span className="font-bold">
            방금 복사한 내용, 내 스마트폰에서도 바로 붙여넣을 수 있어요 (<strong className={highlightTextCls}>내 기기 통합</strong> 30일 무료체험)
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveLoungeType('personal');
                setDesktopTab('sync');
              }}
              className="px-2.5 py-1 rounded-lg bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 font-extrabold text-[11px] cursor-pointer"
            >
              30일 무료체험 보기 </button>
            <button
              type="button"
              onClick={() => setClipPqlToastVisible(false)}
              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold cursor-pointer"
              aria-label="닫기"
            >
              </button>
          </div>
        </div>
      )}
    </section>
  );
};

/* ─────────────────────────────────────────────────────────────
 * 메인: 수련장 + 도장깨기 체험관
 * - 'basics' = 귀신검색 수련용 1단계 소환술 3단
 * - 'full'   = [v2.1 감산] 3. 귀신Key 전면 압축 (무료 핵심 3종 즉시 체험 + F1~F6 등록창 / 유료 도구는 하단 <details> 접힘)
 * ───────────────────────────────────────────────────────────── */
export interface GhostSuperpowerDojoProps {
  variant?: 'full' | 'basics';
}

export const GhostSuperpowerDojo: React.FC<GhostSuperpowerDojoProps> = ({ variant = 'full' }) => {
  const { merlinAuth, activePricingPlan, subscribedLounges } = useSaySeeStore();
  const accountId = merlinAuth?.email || merlinAuth?.userId || 'local_user';
  const isSubscribed = activePricingPlan !== 'free_trial' || Object.values(subscribedLounges).some(Boolean);
  const [progress, setProgress] = useState<DojoProgress>(() => loadDojoProgress());
  const [activeBasic, setActiveBasic] = useState<BasicStepId>(() => {
    const p = loadDojoProgress();
    return BASIC_STEPS.find((s) => !p.basics[s.id])?.id ?? 'b1';
  });
  const [activeFreeCore, setActiveFreeCore] = useState<'typo' | 'seq' | 'iron'>('typo');
  const [trialStarted, setTrialStarted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DOJO_TRIAL_CHOICE_STORAGE_KEY) === 'trial';
    } catch {
      return false;
    }
  });
  const [activeDojo, setActiveDojo] = useState<DojoItemId | null>(() => {
    try {
      return localStorage.getItem(DOJO_TRIAL_CHOICE_STORAGE_KEY) === 'trial' ? 5 : null;
    } catch {
      return null;
    }
  });
  const [pendingOptInDojoId, setPendingOptInDojoId] = useState<DojoItemId | null>(null);
  const [sandboxKey, setSandboxKey] = useState(0);

  useEffect(() => {
    const sync = () => setProgress(loadDojoProgress());
    const syncTrial = () => {
      try {
        const started = localStorage.getItem(DOJO_TRIAL_CHOICE_STORAGE_KEY) === 'trial';
        setTrialStarted(started);
        if (!started) setActiveDojo(null);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('ghosti_dojo_progress_updated', sync);
    window.addEventListener('ghosti_dojo_trial_choice_updated', syncTrial);
    return () => {
      window.removeEventListener('ghosti_dojo_progress_updated', sync);
      window.removeEventListener('ghosti_dojo_trial_choice_updated', syncTrial);
    };
  }, []);

  const markBasic = (id: BasicStepId) => {
    setProgress((prev) => {
      const next: DojoProgress = { ...prev, basics: { ...prev.basics, [id]: true } };
      saveDojoProgress(next);
      return next;
    });
  };
  const markDojo = (id: DojoItemId) => {
    setProgress((prev) => {
      const next: DojoProgress = { ...prev, dojo: { ...prev.dojo, [id]: true } };
      saveDojoProgress(next);
      return next;
    });
  };

  const basicsDone = countBasicsDone(progress);
  const BasicSandbox = BASIC_SANDBOXES[activeBasic];
  const paidDojoItems = useMemo(
    () =>
      DOJO_ITEMS.filter(
        (d) => d.id === 5 || d.id === 6 || d.id === 7 || d.id === 8 || d.id === 10 || d.id === 11 || d.id === 12 || d.id === 13
      ),
    []
  );
  const ActiveDojoSandbox = activeDojo ? DOJO_SANDBOXES[activeDojo] : null;
  const activeDojoMeta = activeDojo ? paidDojoItems.find((d) => d.id === activeDojo) ?? null : null;
  const pendingOptInMeta = pendingOptInDojoId
    ? paidDojoItems.find((d) => d.id === pendingOptInDojoId) ?? null
    : null;

  if (variant === 'basics') {
    return (
      <div className="flex flex-col gap-4">
        <section className={panelCls}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-extrabold text-white">1단계 · 애기귀신 소환술 3단 수련</h3>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-zinc-400">{basicsDone}/3 완료</span>
              {basicsDone > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const resetNext: DojoProgress = { ...progress, basics: {} };
                    setProgress(resetNext);
                    saveDojoProgress(resetNext);
                    setActiveBasic('b1');
                    setSandboxKey((k) => k + 1);
                  }}
                  className="px-2.5 py-0.5 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-zinc-200 text-[11px] font-bold cursor-pointer"
                >
                  3단 수련 초기화
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
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12.5px] font-bold border cursor-pointer ${
                  activeBasic === s.id ? 'border-[#2DD4BF] bg-[#2DD4BF]/10 text-white' : 'border-white/10 text-zinc-300'
                }`}
              >
                <StampBadge done={Boolean(progress.basics[s.id])} />
                기본기 {i + 1} · {s.title}
              </button>
            ))}
          </div>
          <div className="text-[12.5px] text-zinc-400">{BASIC_STEPS.find((s) => s.id === activeBasic)?.mission}</div>
          <BasicSandbox key={`${activeBasic}_${sandboxKey}`} onDone={() => markBasic(activeBasic)} />
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 상단 1: 평생 무료 핵심 3종 즉시 체험 */}
      <section className={panelCls}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[16px] font-extrabold text-white">
              하던 일 멈추지 마세요, 쓰던 자리에서 1초면 끝 (평생 무료 핵심 3종)
            </h3>
            <p className="text-[12.5px] text-zinc-400 mt-1 leading-relaxed">
              어느 창에서든 <kbd className={summonKeyBadgeCls}>Ctrl + 0</kbd> (보조:{' '}
              <kbd className={summonKeyBadgeCls}>Ctrl + 우클릭</kbd>) 하나로 부르면 일하던 커서 위에서 바로 작동합니다.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {Boolean(progress.dojo[1] || progress.dojo[2] || progress.dojo[3] || progress.dojo[4]) && (
              <button
                type="button"
                onClick={() => {
                  setProgress(resetDojoProgress());
                  setSandboxKey((k) => k + 1);
                }}
                className="px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-zinc-200 text-[11.5px] font-bold cursor-pointer transition"
              >
                ↺ 도장 초기화
              </button>
            )}
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[11.5px] font-black shrink-0">
              평생 0원 무제한
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            {
              key: 'typo' as const,
              done: Boolean(progress.dojo[1]),
              title: '① 무버튼 한영 오타 변환',
              sub: '영타 치고 스페이스바만 누르면 한글로!',
            },
            {
              key: 'seq' as const,
              done: Boolean(progress.dojo[3]),
              title: '② Ctrl+V 순차·칸맞춤 복붙',
              sub: '연속 복사 후 빈칸마다 차례대로 입력',
            },
            {
              key: 'iron' as const,
              done: Boolean(progress.dojo[2] || progress.dojo[4]),
              title: '③ [1] 서식·줄바꿈 다림질',
              sub: '평소 복붙은 원문 보존, 원할 때만 1초 정리',
            },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveFreeCore(tab.key);
                setSandboxKey((k) => k + 1);
              }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                activeFreeCore === tab.key
                  ? 'border-[#2DD4BF] bg-[#2DD4BF]/12 text-white shadow-sm'
                  : 'border-white/10 bg-zinc-950/80 text-zinc-300 hover:border-white/25'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-extrabold">{tab.title}</span>
                <StampBadge done={tab.done} />
              </div>
              <span className="text-[11.5px] text-zinc-400">{tab.sub}</span>
            </button>
          ))}
        </div>

        <div className="pt-2 border-t border-white/10 flex flex-col gap-2.5">
          {activeFreeCore === 'typo' && (
            <>
              <div className="text-[12.5px] text-[#1E3A8A] dark:text-indigo-200 font-bold">
                ⌨ 영문으로 잘못 친 뒤 스페이스바를 누르거나 1초만 기다려보세요! (이메일·URL·영문 ID는 자동 보호)
              </div>
              <Dojo1 key={`free_typo_${sandboxKey}`} onDone={() => markDojo(1)} />
            </>
          )}
          {activeFreeCore === 'seq' && (
            <>
              <div className="text-[12.5px] text-[#1E3A8A] dark:text-indigo-200 font-bold">
                [3개 연속 복사]를 누른 뒤 이름·전화·주소 칸에서 Ctrl+V를 연타하거나 클릭해 차례대로 꽂아보세요!
              </div>
              <Dojo3 key={`free_seq_${sandboxKey}`} onDone={() => markDojo(3)} />
            </>
          )}
          {activeFreeCore === 'iron' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <div className="text-[12px] text-[#1E3A8A] dark:text-indigo-200 font-bold">
                  PDF 끊어진 줄바꿈 1초 이어붙이기 ([1]번 수동 작동)
                </div>
                <Dojo2 key={`free_iron_${sandboxKey}`} onDone={() => markDojo(2)} />
              </div>
              <div className="flex flex-col gap-2">
                <div className="text-[12px] text-[#1E3A8A] dark:text-indigo-200 font-bold">
                  뉴스 광고·기자 꼬리말 순수 본문 세탁
                </div>
                <Dojo4 key={`free_launder_${sandboxKey}`} onDone={() => markDojo(4)} />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 상단 2: 내 개인 상용구 F1~F6 등록창 */}
      <PersonalSnippetsRegistryPanel />

      {/* 하단 3: 귀신Key (내 PC) 추가 도구 체험 */}
      <details className="rounded-2xl bg-zinc-900/80 border border-white/10 p-4">
        <summary className="cursor-pointer select-none text-[13.5px] font-extrabold text-amber-300 hover:text-amber-200 flex items-center justify-between gap-2">
          <span>귀신Key (내 PC) 추가 도구 체험하기 (7일 클립보드 검색 · 스샷·PDF변환 · 다중합본 · 번호·일정 · 창고정) ▾</span>
          <span className="text-[11.5px] text-zinc-400 font-semibold shrink-0">30일 카드없는 무료체험</span>
        </summary>
        <div className="pt-4 mt-3 border-t border-white/10 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
            {paidDojoItems.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  if (!trialStarted && !isSubscribed) {
                    setPendingOptInDojoId(d.id);
                    return;
                  }
                  setActiveDojo(d.id);
                  setSandboxKey((k) => k + 1);
                }}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-[12px] font-bold border cursor-pointer ${
                  (trialStarted || isSubscribed) && activeDojoMeta?.id === d.id
                    ? 'border-amber-400 bg-amber-400/10 text-white'
                    : 'border-white/10 text-zinc-300 hover:bg-white/5'
                }`}
              >
                <StampBadge done={Boolean(progress.dojo[d.id])} />
                <span className="shrink-0">{d.icon}</span>
                <span className="truncate">{d.title}</span>
              </button>
            ))}
          </div>
          {pendingOptInMeta && (
            <div className="p-4 rounded-2xl bg-zinc-950 border-2 border-amber-400 shadow-2xl flex flex-col gap-3">
              <div className="text-[14.5px] font-extrabold text-amber-300 flex items-center gap-2">
                <span>[{pendingOptInMeta.title}] — 30일 무료체험을 지금 시작할까요?</span>
              </div>
              <p className="text-[12.5px] text-zinc-200 leading-relaxed">
                유료 티어() 도구는 몰래 차감되지 않으며, 동의하실 때만 오늘부터 <strong>30일 무제한 무료체험(D-30)</strong>이 시작됩니다. (카드 등록 0% · 만료 후에도 무료 기본기는 평생 0원)
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const targetId = pendingOptInDojoId;
                    setPendingOptInDojoId(null);
                    setTrialStarted(true);
                    try {
                      localStorage.setItem(DOJO_TRIAL_CHOICE_STORAGE_KEY, 'trial');
                      window.dispatchEvent(new CustomEvent('ghosti_dojo_trial_choice_updated'));
                    } catch {
                      /* ignore */
                    }
                    playBabyGhostChime('summon');
                    await startSuperpowerTrialAction(accountId, isSubscribed, true);
                    if (targetId) {
                      setActiveDojo(targetId);
                      setSandboxKey((k) => k + 1);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[12.5px] font-black cursor-pointer shadow-sm"
                >
                  예, 지금 30일 무료체험 시작하기
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setPendingOptInDojoId(null);
                    setTrialStarted(false);
                    setActiveDojo(null);
                    try {
                      localStorage.setItem(DOJO_TRIAL_CHOICE_STORAGE_KEY, 'later');
                      window.dispatchEvent(new CustomEvent('ghosti_dojo_trial_choice_updated'));
                    } catch {
                      /* ignore */
                    }
                    await startSuperpowerTrialAction(accountId, false, false);
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/20 text-zinc-200 text-[12.5px] font-bold cursor-pointer"
                >
                  아니오 (미시작 상태 유지)
                </button>
              </div>
            </div>
          )}
          {(trialStarted || isSubscribed) && ActiveDojoSandbox && activeDojoMeta && (
            <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-zinc-950/80 border border-white/10">
              <div className="text-[12.5px] text-zinc-300 font-bold">
                {activeDojoMeta.icon} {activeDojoMeta.mission}
              </div>
              <ActiveDojoSandbox key={`${activeDojoMeta.id}_${sandboxKey}`} onDone={() => markDojo(activeDojoMeta.id)} />
            </div>
          )}
          <TrialRewardCard />
        </div>
      </details>
    </div>
  );
};

export default GhostSuperpowerDojo;
