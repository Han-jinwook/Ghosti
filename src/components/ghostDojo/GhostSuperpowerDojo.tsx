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
    {done ? '✓' : ''}
  </span>
);

const panelCls = 'p-4 rounded-2xl bg-zinc-900 border border-white/10 flex flex-col gap-3';
const boxCls = 'px-3 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-[13px] text-zinc-100';
const summonKeyBadgeCls =
  'inline-flex items-center px-2 py-0.5 mx-0.5 rounded-md bg-[#EEF2FF] text-[#1E3A8A] border border-[#4F46E5]/35 font-extrabold text-[12px] shadow-2xs';
const highlightTextCls = 'text-[#1E3A8A] font-extrabold';
const highlightPillCls =
  'bg-[#EEF2FF] text-[#1E3A8A] border border-[#4F46E5]/35';

/* ─────────────────────────────────────────────────────────────
 * 1단계: 애기귀신 귀신검색창 소환술 기본기 3단 수련 (B1~B3)
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
            <span className="text-[12px] font-extrabold text-amber-600">
              👆 칸이 선택되었어요! 이제 일반 좌클릭 대신 키보드 Ctrl + 0 (또는 마우스 Ctrl + 우클릭)을 눌러 소환해 보세요!
            </span>
          )}
        </div>
      </div>
      {summoned && (
        <div className={`${boxCls} border-[#2DD4BF]/60 flex flex-col gap-1.5`}>
          <div className={`text-[12px] ${highlightTextCls}`}>
            👻 귀신검색창 소환 완료! (파일을 열지 않고 본문·사진·동영상 내용 1초 검색 · 평생 무료)
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11.5px] text-[#1E3A8A] font-bold">
            <span className={`px-2 py-0.5 rounded ${highlightPillCls}`}>[⤡ 작게 · ⤢ 크게(갤러리)]</span>
            <span className={`px-2 py-0.5 rounded ${highlightPillCls}`}>[📄 문서 본문 직독]</span>
            <span className={`px-2 py-0.5 rounded ${highlightPillCls}`}>[🎬 동영상 장면 1초 점프]</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-zinc-200">
            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/15">[📝 사진·표 OCR 창🔒]</span>
            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/15">[🏷️ 귀신 라벨러🔒]</span>
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
      <div className="px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-400/30 text-[12px] text-slate-700 leading-relaxed">
        💡 <strong>상황 예시:</strong> 카톡 중 거래처에서 <em>&ldquo;작년 납품 단가가 얼마였죠?&rdquo;</em> 물어봤을 때, 바탕화면 엑셀 파일을 찾아 열 필요 없이 쓰던 입력창 위에서 바로{' '}
        <kbd className={summonKeyBadgeCls}>Ctrl + 0</kbd> 또는 <kbd className={summonKeyBadgeCls}>Ctrl + 우클릭</kbd>을 누르면 파일 안의 숫자를 1초 만에 찾아 꽂아줍니다!
      </div>
      <div
        {...handlers}
        className={`${boxCls} select-none flex flex-wrap items-center gap-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/60`}
      >
        <span className="text-zinc-500 text-[12px] shrink-0">💬 카톡 입력창</span>
        <span className="flex-1 font-bold">
          {value === BASIC2_QUERY ? '단가? (여기서 Ctrl + 0 또는 Ctrl + 우클릭!)' : `납품 단가: ${value}`}
        </span>
        <HoldRing progress={progress} size={30} />
      </div>
      {leftClickGuide && !open && (
        <div className="text-[12px] font-extrabold text-amber-600 px-1">
          👆 입력창이 선택되었어요! 이제 키보드 Ctrl + 0 또는 마우스 Ctrl + 우클릭을 눌러 파일 속 단가를 불러보세요!
        </div>
      )}
      {open && value === BASIC2_QUERY && (
        <div className={`${boxCls} border-[#2DD4BF]/60 flex flex-col gap-1.5`}>
          <div className={`text-[12px] ${highlightTextCls}`}>
            👻 귀신검색창 — 엑셀 파일을 열지 않고도 본문 속 &ldquo;단가&rdquo;를 즉시 찾았습니다! 아래 결과를 클릭해 보세요:
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
            <span className="font-semibold">📄 {BASIC2_RESULT.file} (파일 안 열고 본문 추출)</span>
            <span className="font-extrabold text-[#1E3A8A] bg-amber-200/80 px-2.5 py-0.5 rounded-md">
              👆 단가 {BASIC2_RESULT.value} 카톡창에 바로 넣기 ↵
            </span>
          </button>
        </div>
      )}
      {value !== BASIC2_QUERY && (
        <div className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-[12.5px] font-extrabold text-emerald-700">
          ✓ 완료! 엑셀 프로그램을 실행하지 않고도 카톡 입력창에 단가({value})가 1초 만에 입력되었습니다!
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
        {/* 좌측: 실제 종이 영수증 촬영 사진 UI */}
        <div className="md:col-span-5 p-3 rounded-xl bg-slate-200/80 border border-slate-300 flex flex-col items-center justify-center">
          <div className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1">
            <span>📸 방금 찍은 샘플 영수증 사진 (사진 속 번호를 직접 눌러보세요!)</span>
          </div>
          <div
            className="w-full max-w-[270px] bg-[#FFFDF8] text-slate-900 rounded-md shadow-md border border-stone-300 px-3.5 py-3 font-mono text-[11.5px] flex flex-col gap-1.5 relative"
            style={{ boxShadow: '0 6px 16px rgba(15, 23, 42, 0.14)' }}
          >
            <div className="text-center border-b border-dashed border-stone-400 pb-1.5">
              <div className="font-extrabold text-[13px] tracking-tight text-slate-900">🧾 [영수증] 썬드림카페</div>
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
                {injected ? '✓ 추출됨' : '👆 콕!'}
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
              📱 영수증 사진에서 자동 추출된 단어칩 (왼쪽 영수증 사진의 번호나 아래 칩을 클릭!)
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
                    {isTarget ? `🎯 ${chip}` : chip}
                  </button>
                );
              })}
            </div>
            {wrong && (
              <div className="text-[11.5px] text-rose-600 font-bold">
                💡 미션 목표는 영수증의 [사업자번호: 123-45-67890]이에요! 왼쪽 영수증 사진이나 🎯 칩을 눌러보세요.
              </div>
            )}
          </div>

          <div className={`${boxCls} flex items-center justify-between gap-2`}>
            <div>
              <span className="text-zinc-500">세금계산서 사업자번호 입력칸: </span>
              <span className="font-extrabold text-[14px]">{injected || '＿＿＿＿＿＿＿＿＿＿'}</span>
            </div>
            {injected && (
              <span className="text-[11.5px] font-extrabold text-emerald-600 shrink-0">
                ✓ 0.1초 자동 입력 &amp; 복사 완료!
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
    <div className="flex flex-col gap-4">
      <section className={panelCls}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-extrabold text-white">🥋 1단계 · 애기귀신 소환술 3단 수련</h3>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-zinc-400">{basicsDone}/3 완료</span>
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
                className="px-2.5 py-0.5 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-zinc-200 text-[11px] font-bold cursor-pointer"
              >
                🔄 3단 수련 초기화
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
};

export default GhostSuperpowerDojo;
