import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import {
  playBabyGhostChime,
  simulateSuperpowerLocal,
  startSuperpowerTrialAction,
  fetchSuperpowerStatus,
  type SuperpowerTrialStatus,
} from '../OnboardingModal';
import {
  SUMMON_HOLD_MS,
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
  countBasicsDone,
  countDojoDone,
  isAllDojoDone,
  type BasicStepId,
  type DojoItemId,
  type DojoProgress,
} from '../../services/ghostDojoEngine';

/* ─────────────────────────────────────────────────────────────
 * 공용: 우클릭 0.35초 꾹 판정 훅 + 원형 게이지 링
 * ───────────────────────────────────────────────────────────── */
function useRightClickHold(onComplete: () => void) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const doneRef = useRef(false);

  const cancel = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (!doneRef.current) setProgress(0);
  }, []);

  const tick = useCallback(() => {
    const ratio = Math.min(1, (performance.now() - startRef.current) / SUMMON_HOLD_MS);
    setProgress(ratio);
    if (ratio >= 1) {
      doneRef.current = true;
      onComplete();
      window.setTimeout(() => {
        doneRef.current = false;
        setProgress(0);
      }, 600);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onComplete]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const handlers = {
    onMouseDown: (e: React.MouseEvent) => {
      if (e.button !== 2) return;
      e.preventDefault();
      cancelAnimationFrame(rafRef.current);
      // Ctrl + 우클릭 시 0.35초 홀드 대기 없이 즉시(0.01초) 소환!
      if (e.ctrlKey && !e.altKey && !e.shiftKey) {
        doneRef.current = true;
        setProgress(1);
        onComplete();
        window.setTimeout(() => {
          doneRef.current = false;
          setProgress(0);
        }, 600);
        return;
      }
      doneRef.current = false;
      startRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    },
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
  return { progress, handlers };
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
    {done ? '✓' : ''}
  </span>
);

const panelCls = 'p-4 rounded-2xl bg-zinc-900 border border-white/10 flex flex-col gap-3';
const boxCls = 'px-3 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-[13px] text-zinc-100';
const btnCls =
  'px-3 py-2 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 text-[12.5px] font-extrabold transition cursor-pointer disabled:opacity-40';

/* ─────────────────────────────────────────────────────────────
 * 1단계: 애기귀신 소환술 기본기 3단 수련 (B1~B3)
 * ───────────────────────────────────────────────────────────── */
const Basic1: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [summoned, setSummoned] = useState(false);
  const { progress, handlers } = useRightClickHold(() => {
    playBabyGhostChime('summon');
    setSummoned(true);
    onDone();
  });
  return (
    <div className="flex flex-col gap-2">
      <div
        {...handlers}
        className="select-none h-24 rounded-xl border-2 border-dashed border-[#2DD4BF]/50 bg-zinc-950 flex items-center justify-center gap-3 text-[13px] text-zinc-300 cursor-context-menu"
      >
        <HoldRing progress={progress} />
        <span>여기서 우클릭 꾹~ (또는 Ctrl + 우클릭 즉시 소환!)</span>
      </div>
      {summoned && (
        <div className={`${boxCls} border-[#2DD4BF]/60 flex flex-col gap-1.5`}>
          <div className="text-[12px] font-extrabold text-[#2DD4BF]">👻 기본 귀신창 (1~8번 영구 번호 &amp; 우측 분리)</div>
          <div className="flex flex-wrap gap-1.5 text-[11.5px] text-[#5EEAD4] font-bold">
            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-[#5EEAD4]/40">[Ctrl+V] 순차·칸맞춤</span>
            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-[#5EEAD4]/40">[1] 한영성형</span>
            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-[#5EEAD4]/40">[2] 줄바꿈정리</span>
            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-[#5EEAD4]/40">[3] 서식세탁</span>
            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-[#5EEAD4]/40">[4] 파일·PDF변환🔒</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11.5px] text-[#E2E8F0]">
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/15">[5] 글자·표OCR🔒</span>
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/15">[6] 합본🔒</span>
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/15">[7] 번호·일정🔒</span>
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/15">[8] 창고정🔒</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-300/50 text-amber-200 font-bold">[⌨️상용구▾]</span>
              <span className="px-2 py-0.5 rounded bg-teal-400/20 border border-teal-300/50 text-teal-200 font-bold">[💡꿀팁·추가▾]</span>
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
  const { progress, handlers } = useRightClickHold(() => {
    playBabyGhostChime('summon');
    setOpen(true);
  });
  return (
    <div className="flex flex-col gap-2">
      <div {...handlers} className={`${boxCls} select-none flex items-center gap-3 cursor-context-menu`}>
        <span className="text-zinc-500 text-[12px] shrink-0">💬 카톡 입력창</span>
        <span className="flex-1 font-bold">{value}</span>
        <HoldRing progress={progress} size={30} />
      </div>
      {open && value === BASIC2_QUERY && (
        <div className={`${boxCls} border-[#2DD4BF]/60`}>
          <div className="text-[12px] font-extrabold text-[#2DD4BF] mb-1.5">👻 귀신검색창</div>
          <button
            type="button"
            onClick={() => {
              setValue(BASIC2_RESULT.value);
              playBabyGhostChime('typo');
              onDone();
            }}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 cursor-pointer"
          >
            <span>📄 {BASIC2_RESULT.file}</span>
            <span className="font-extrabold text-amber-300">단가 {BASIC2_RESULT.value} ↵</span>
          </button>
        </div>
      )}
    </div>
  );
};

const Basic3: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [injected, setInjected] = useState('');
  const [wrong, setWrong] = useState('');
  return (
    <div className="flex flex-col gap-2">
      <div className={`${boxCls} border-[#2DD4BF]/60`}>
        <div className="text-[12px] font-extrabold text-[#2DD4BF] mb-1.5">📱 방금 찍은 영수증 → 단어칩</div>
        <div className="flex flex-wrap gap-1.5">
          {BASIC3_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => {
                if (chip === BASIC3_TARGET_CHIP) {
                  setInjected(chip.replace(/^사업자번호:\s*/, ''));
                  setWrong('');
                  playBabyGhostChime('typo');
                  onDone();
                } else {
                  setWrong(chip);
                }
              }}
              className={`px-2 py-1 rounded-lg text-[12px] cursor-pointer border ${
                wrong === chip ? 'border-rose-400 bg-rose-500/10' : 'border-white/10 bg-zinc-800 hover:bg-zinc-700'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
      <div className={boxCls}>
        <span className="text-zinc-500">사업자번호: </span>
        <span className="font-bold">{injected || '＿＿＿＿＿＿'}</span>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
 * 2단계: 초능력 9종 도장깨기 샌드박스 (B4)
 * ───────────────────────────────────────────────────────────── */
const Dojo1: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [text, setText] = useState('');
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === ' ' && /[A-Za-z]/.test(text)) {
              const converted = simulateSuperpowerLocal('typo', text.trim());
              if (converted !== text.trim() && /[가-힣]/.test(converted)) {
                e.preventDefault();
                setText(`${converted} `);
                playBabyGhostChime('typo');
                onDone();
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
        👻 1초 다림질
      </button>
    </div>
  );
};

const Dojo3: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [loaded, setLoaded] = useState(false);
  const [fields, setFields] = useState<string[]>(['', '', '']);
  const next = fields.findIndex((f) => !f);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {DOJO3_SEQUENCE.map((v, i) => (
          <span key={v} className="px-2 py-1 rounded-lg bg-zinc-800 text-[12px]">
            {i + 1}. {v}
          </span>
        ))}
        <button type="button" className={btnCls} disabled={loaded} onClick={() => setLoaded(true)}>
          📋 3개 연속 복사
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['이름', '전화', '주소'].map((label, i) => (
          <div
            key={label}
            onContextMenu={(e) => {
              e.preventDefault();
              if (!loaded || i !== next) return;
              const updated = [...fields];
              updated[i] = DOJO3_SEQUENCE[i];
              setFields(updated);
              if (updated.every(Boolean)) {
                playBabyGhostChime('typo');
                onDone();
              }
            }}
            className={`${boxCls} select-none cursor-context-menu ${
              loaded && i === next ? 'border-[#2DD4BF] animate-pulse' : ''
            }`}
          >
            <div className="text-[11px] text-zinc-500">{label}</div>
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
        👻 서식 세탁
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
        placeholder={`📋🔍 클립보드 검색 (예: ${DOJO6_TARGET_QUERY})`}
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
        <div className="absolute top-1.5 right-2 text-[10.5px] text-zinc-500">🖼️ 이미지 (드래그 불가)</div>
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
        👻 엑셀 표로 추출
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
          <div className="px-2.5 py-1.5 text-[11.5px] text-emerald-300 bg-zinc-950">✅ 복사됨 — 엑셀에서 Ctrl+V</div>
        </div>
      )}
    </div>
  );
};

const Dojo8: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [renamed, setRenamed] = useState(false);
  return (
    <div className="flex flex-col gap-2">
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
        🏷️ 라벨러 실행
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
        <span className="text-[34px]">📄</span>
        <span className="text-[11.5px] text-zinc-300 text-center break-all">{DOJO9_HOVER_FILE}</span>
      </div>
      {show && (
        <div className="px-3 py-2 rounded-xl bg-amber-100 text-zinc-900 text-[12.5px] font-bold shadow-lg leading-relaxed">
          💬 {DOJO9_SUMMARY_LINES.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
      )}
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
  const [, setStatus] = useState<SuperpowerTrialStatus | null>(null);
  const [choice, setChoice] = useState<'none' | 'trial' | 'daily3'>(() => {
    try {
      const saved = localStorage.getItem(DOJO_TRIAL_CHOICE_STORAGE_KEY);
      if (saved === 'trial' || saved === 'daily3') return saved;
    } catch {
      /* ignore */
    }
    return 'none';
  });

  useEffect(() => {
    void fetchSuperpowerStatus(accountId, isSubscribed).then(setStatus);
    const syncChoice = () => {
      try {
        const saved = localStorage.getItem(DOJO_TRIAL_CHOICE_STORAGE_KEY);
        if (saved === 'trial' || saved === 'daily3') setChoice(saved);
        else setChoice('none');
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('ghosti_dojo_trial_choice_updated', syncChoice);
    return () => window.removeEventListener('ghosti_dojo_trial_choice_updated', syncChoice);
  }, [accountId, isSubscribed]);

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/15 to-emerald-500/10 border-2 border-amber-400/60 flex flex-col gap-2.5">
      <div className="text-[15px] font-extrabold text-white">
        🎉 축하합니다! '애기귀신 소환술'을 마스터하여 연간 209시간(27일)의 복붙 노가다에서 해방되셨습니다!
      </div>
      <div className="text-[13px] text-zinc-200 leading-relaxed">
        수련 완료 보상으로 원래 하루 3회 무료(무제한은 월 3,900원 / 10년 3.9만 원)인{' '}
        <strong className="text-amber-300">『모든 귀신 초능력 30일 무제한 무료체험권』</strong>이 도착했습니다! 지금 바로 열어드릴까요?
      </div>
      <div className="text-[11.5px] text-zinc-400">(※ 카드 등록 없음 · 자동 결제 절대 없음 · 30일 후에도 매일 3회씩은 평생 무료!)</div>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          className={`px-4 py-2.5 rounded-xl text-[13px] font-extrabold cursor-pointer transition-all ${
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
            const st = await startSuperpowerTrialAction(accountId, isSubscribed);
            setStatus(st);
          }}
        >
          {choice === 'trial'
            ? '✓ 🚀 오늘부터 30일 무제한 초능력 체험 중!'
            : '🚀 네! 오늘부터 30일 무제한 초능력 체험 시작하기'}
        </button>
        <button
          type="button"
          className={`px-4 py-2.5 rounded-xl border text-[13px] font-bold cursor-pointer transition-all ${
            choice === 'daily3'
              ? 'border-teal-400 bg-teal-500/20 text-teal-200 ring-1 ring-teal-400'
              : 'border-white/20 text-zinc-300 hover:bg-white/5'
          }`}
          onClick={() => {
            setChoice('daily3');
            try {
              localStorage.setItem(DOJO_TRIAL_CHOICE_STORAGE_KEY, 'daily3');
              window.dispatchEvent(new CustomEvent('ghosti_dojo_trial_choice_updated'));
            } catch {
              /* ignore */
            }
            playBabyGhostChime('typo');
          }}
        >
          {choice === 'daily3' ? '✓ 하루 3회씩 쓰는 중 (언제든 왼쪽 버튼으로 시작 가능)' : '그냥 하루 3회씩만 쓸게요'}
        </button>
      </div>
      {choice === 'trial' && (
        <div className="px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-[12.5px] font-extrabold text-emerald-300">
          ✨ 체험중 — 오늘부터 30일간 모든 귀신 초능력을 횟수 제한 없이 무제한으로 사용하실 수 있습니다!
        </div>
      )}
      {choice === 'daily3' && (
        <div className="px-3.5 py-2 rounded-xl bg-teal-500/15 border border-teal-400/50 text-[12.5px] font-extrabold text-teal-200">
          📌 하루 3회 무료 모드가 적용되었습니다. (30일 무제한 무료체험권은 아껴두었으며 언제든 왼쪽 버튼을 눌러 시작할 수 있습니다!)
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
 * 메인: 수련장 + 도장깨기 체험관 (상시 입장 · 종목 골라 재연습)
 * ───────────────────────────────────────────────────────────── */
export interface GhostSuperpowerDojoProps {
  /** 'full' = ROI배너 + 1단계 + 2단계 9종 + 보상 / 'basics' = 1단계 소환술 3단만 (귀신검색 수련용) */
  variant?: 'full' | 'basics';
}

export const GhostSuperpowerDojo: React.FC<GhostSuperpowerDojoProps> = ({ variant = 'full' }) => {
  const [progress, setProgress] = useState<DojoProgress>(() => loadDojoProgress());
  const [activeBasic, setActiveBasic] = useState<BasicStepId>(() => {
    const p = loadDojoProgress();
    return BASIC_STEPS.find((s) => !p.basics[s.id])?.id ?? 'b1';
  });
  const [activeDojo, setActiveDojo] = useState<DojoItemId | null>(null);
  const [sandboxKey, setSandboxKey] = useState(0);

  useEffect(() => {
    const sync = () => setProgress(loadDojoProgress());
    window.addEventListener('ghosti_dojo_progress_updated', sync);
    return () => window.removeEventListener('ghosti_dojo_progress_updated', sync);
  }, []);

  const markBasic = (id: BasicStepId) => {
    const next: DojoProgress = { ...progress, basics: { ...progress.basics, [id]: true } };
    setProgress(next);
    saveDojoProgress(next);
  };
  const markDojo = (id: DojoItemId) => {
    const next: DojoProgress = { ...progress, dojo: { ...progress.dojo, [id]: true } };
    setProgress(next);
    saveDojoProgress(next);
  };

  const basicsDone = countBasicsDone(progress);
  const dojoDone = countDojoDone(progress);
  const BasicSandbox = BASIC_SANDBOXES[activeBasic];
  const ActiveDojoSandbox = activeDojo ? DOJO_SANDBOXES[activeDojo] : null;
  const activeDojoMeta = DOJO_ITEMS.find((d) => d.id === activeDojo);

  return (
    <div className="flex flex-col gap-4">
      {variant === 'full' && (
        <div className="px-5 py-4 rounded-2xl bg-zinc-900 border-2 border-amber-400/70 text-center text-[16px] md:text-[18px] font-extrabold text-amber-200 leading-snug">
          {DOJO_ROI_BANNER_TEXT}
        </div>
      )}

      {/* 1단계 */}
      <section className={panelCls}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-extrabold text-white">🥋 1단계 · 애기귀신 소환술 3단 수련</h3>
          <span className="text-[12px] font-bold text-zinc-400">{basicsDone}/3</span>
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

      {/* 2단계 */}
      {variant === 'full' && (
        <section className={panelCls}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-extrabold text-white">⚡ 2단계 · 초능력 도장깨기 체험관</h3>
            <span className="text-[12px] font-bold text-zinc-400">{dojoDone}/9</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            {DOJO_ITEMS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setActiveDojo(d.id);
                  setSandboxKey((k) => k + 1);
                }}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-[12.5px] font-bold border cursor-pointer ${
                  activeDojo === d.id ? 'border-[#2DD4BF] bg-[#2DD4BF]/10 text-white' : 'border-white/10 text-zinc-300 hover:bg-white/5'
                }`}
              >
                <StampBadge done={Boolean(progress.dojo[d.id])} />
                <span className="shrink-0">{d.icon}</span>
                <span className="truncate">{d.title}</span>
              </button>
            ))}
          </div>
          {ActiveDojoSandbox && activeDojoMeta && (
            <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
              <div className="text-[12.5px] text-zinc-400">
                {activeDojoMeta.icon} {activeDojoMeta.mission}
              </div>
              <ActiveDojoSandbox key={`${activeDojo}_${sandboxKey}`} onDone={() => markDojo(activeDojoMeta.id)} />
            </div>
          )}
        </section>
      )}

      {variant === 'full' && isAllDojoDone(progress) && <TrialRewardCard />}
    </div>
  );
};

export default GhostSuperpowerDojo;
