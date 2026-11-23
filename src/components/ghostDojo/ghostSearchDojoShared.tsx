import React, { useEffect, useState } from 'react';
import { copyTextSafeToClipboard } from '../../services/proFeatureGate';

export const GHOST_DOJO_STORAGE_KEY = 'ghosti_search_game_v1';
export const GHOST_DOJO_EVENT_NAME = 'ghosti_dojo_progress_updated';

export type GhostDojoStepId = 'summon' | 'medium' | 'large' | 'ocr' | 'labeler';

export interface GhostDojoStepDef {
  id: 'summon' | 'large' | 'ocr' | 'labeler';
  shortTitle: string;
  actionLabel: string;
  doneLabel: string;
  description: string;
}

export const GHOST_DOJO_STEPS: GhostDojoStepDef[] = [
  {
    id: 'summon',
    shortTitle: '1. 작게 모드',
    actionLabel: '⤡ 작게 모드 눌러보기',
    doneLabel: '⤡ 작게 모드 완료',
    description: '바탕화면에서 Ctrl+0으로 가볍게 검색하고 첫 번째 결과를 바로 확인합니다.',
  },
  {
    id: 'large',
    shortTitle: '2. 크게(갤러리)',
    actionLabel: '⤢ 크게(갤러리) 눌러보기',
    doneLabel: '⤢ 크게(갤러리) 완료',
    description: '사진·동영상·문서를 넓은 갤러리 화면에서 한눈에 탐색합니다.',
  },
  {
    id: 'ocr',
    shortTitle: '3. 사진·표 OCR',
    actionLabel: '사진·표 OCR 체험하기',
    doneLabel: '사진·표 OCR 완료',
    description: '영수증·서류 사진 속 글자와 표를 추출해 문서·엑셀에 바로 붙여넣습니다.',
  },
  {
    id: 'labeler',
    shortTitle: '4. 귀신라벨링',
    actionLabel: '귀신라벨링 체험하기',
    doneLabel: '귀신라벨링 완료',
    description: 'IMG_4821.jpg 같은 이름을 261123_영수증_점심식사.jpg 한글 파일명으로 바로 복사합니다.',
  },
];

export type GhostDojoProgress = Partial<Record<GhostDojoStepId, boolean>>;

export function loadGhostDojoProgress(): GhostDojoProgress {
  try {
    if (typeof localStorage === 'undefined') return {};
    return JSON.parse(localStorage.getItem(GHOST_DOJO_STORAGE_KEY) || '{}') as GhostDojoProgress;
  } catch {
    return {};
  }
}

export function markGhostDojoStep(id: GhostDojoStepId): GhostDojoProgress {
  const prev = loadGhostDojoProgress();
  if (prev[id]) return prev;
  const next: GhostDojoProgress = { ...prev, [id]: true };
  try {
    localStorage.setItem(GHOST_DOJO_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(GHOST_DOJO_EVENT_NAME, { detail: { stepId: id } }));
    }
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('ghosti_search_window_singleton_v1');
      bc.postMessage({ type: 'DOJO_STEP_DONE', stepId: id, ts: Date.now() });
      bc.close();
    }
  } catch {
    /* ignore */
  }
  return next;
}

export function resetGhostDojoProgress(): void {
  try {
    localStorage.removeItem(GHOST_DOJO_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(GHOST_DOJO_EVENT_NAME, { detail: { reset: true } }));
    }
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('ghosti_search_window_singleton_v1');
      bc.postMessage({ type: 'DOJO_RESET', ts: Date.now() });
      bc.close();
    }
  } catch {
    /* ignore */
  }
}

interface GhostSearchDojoStampBoardProps {
  variant?: 'full' | 'compact';
  onRequestStagePreview?: (stage: 'small' | 'large') => void;
  onJumpToSearchTab?: () => void;
}

export const GhostSearchDojoStampBoard: React.FC<GhostSearchDojoStampBoardProps> = ({
  variant = 'full',
  onRequestStagePreview,
  onJumpToSearchTab,
}) => {
  const [progress, setProgress] = useState<GhostDojoProgress>(() => loadGhostDojoProgress());
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setProgress(loadGhostDojoProgress());
    const onStorage = (e: StorageEvent) => {
      if (e.key === GHOST_DOJO_STORAGE_KEY || e.key === null) sync();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(GHOST_DOJO_EVENT_NAME, sync);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('ghosti_search_window_singleton_v1');
        bc.onmessage = (ev: MessageEvent) => {
          const msg = ev.data as { type?: string; stepId?: GhostDojoStepId } | null;
          if (!msg || typeof msg !== 'object') return;
          if (msg.type === 'DOJO_STEP_DONE' && msg.stepId) {
            const prev = loadGhostDojoProgress();
            if (!prev[msg.stepId]) {
              const next = { ...prev, [msg.stepId]: true };
              try {
                localStorage.setItem(GHOST_DOJO_STORAGE_KEY, JSON.stringify(next));
              } catch {
                /* ignore */
              }
              setProgress(next);
            } else {
              sync();
            }
          } else if (msg.type === 'DOJO_RESET') {
            sync();
          }
        };
      }
    } catch {
      /* ignore */
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(GHOST_DOJO_EVENT_NAME, sync);
      try {
        bc?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const completedCount = GHOST_DOJO_STEPS.filter((s) => Boolean(progress[s.id])).length;
  const hasAnyCompleted = completedCount > 0;

  const handleStepClick = async (step: GhostDojoStepDef) => {
    if (step.id === 'summon' || step.id === 'large') {
      const targetStage = step.id === 'summon' ? 'small' : 'large';
      const next = markGhostDojoStep(step.id);
      setProgress(next);
      if (onRequestStagePreview) {
        onRequestStagePreview(targetStage);
      } else if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('ghosti_focus_virtual_monitor_window', {
            detail: { stage: targetStage },
          })
        );
      }
      setDemoNotice(
        step.id === 'summon'
          ? '작게 모드 체험 완료! 바탕화면에서 Ctrl+0으로 언제든 이 크기로 바로 열 수 있습니다.'
          : '크게(갤러리) 모드 체험 완료! 많은 사진·동영상·문서를 한눈에 비교할 수 있습니다.'
      );
      return;
    }

    if (step.id === 'ocr') {
      const sampleOcr = '상호: 썬드림카페 | 날짜: 2026-11-23 | 품목: 아메리카노 2잔 | 합계: 9,000원';
      await copyTextSafeToClipboard(sampleOcr);
      const next = markGhostDojoStep('ocr');
      setProgress(next);
      setDemoNotice(
        `사진·표 OCR 체험 완료! 예시 영수증 글자를 클립보드에 복사했습니다: "${sampleOcr}"`
      );
      return;
    }

    if (step.id === 'labeler') {
      const sampleLabel = '261123_영수증_점심식사.jpg';
      await copyTextSafeToClipboard(sampleLabel);
      const next = markGhostDojoStep('labeler');
      setProgress(next);
      setDemoNotice(
        `귀신라벨링 체험 완료! "IMG_4821.jpg" ➔ "${sampleLabel}" 한글 파일명을 클립보드에 복사했습니다. (메모장에 Ctrl+V로 확인해 보세요)`
      );
    }
  };

  return (
    <div className="flex flex-col gap-2.5 px-4 py-3.5 rounded-xl bg-white border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={
                variant === 'compact'
                  ? 'text-[13.5px] font-bold text-slate-900'
                  : 'text-[14.5px] font-bold text-slate-900'
              }
            >
              {variant === 'compact'
                ? '핵심 기능 4단계 도장깨기 (체험판 · 온보딩 공용)'
                : '2단계 · 귀신검색 & 귀신라벨링 4단계 도장깨기'}
            </h2>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                completedCount === GHOST_DOJO_STEPS.length
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-teal-50 text-teal-700 border border-teal-200'
              }`}
            >
              {completedCount} / {GHOST_DOJO_STEPS.length} 완료
            </span>
          </div>
          <span className="text-[12px] text-slate-500">
            버튼을 눌러 바로 체험하거나 실제 귀신검색창에서 사용하면 도장이 자동으로 찍힙니다.
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onJumpToSearchTab && (
            <button
              type="button"
              onClick={onJumpToSearchTab}
              className="px-2.5 py-1 rounded-md text-[11.5px] font-semibold bg-teal-600 hover:bg-teal-700 text-white cursor-pointer transition-colors"
            >
              귀신검색 체험판 열기
            </button>
          )}
          {hasAnyCompleted && (
            <button
              type="button"
              onClick={() => {
                resetGhostDojoProgress();
                setProgress({});
                setDemoNotice(null);
              }}
              className="px-2.5 py-1 rounded-md text-[11.5px] font-medium bg-white hover:bg-slate-50 text-slate-500 border border-slate-200 cursor-pointer"
            >
              도장 초기화
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {GHOST_DOJO_STEPS.map((s) => {
          const done = Boolean(progress[s.id]);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => void handleStepClick(s)}
              className={`text-left px-3 py-2.5 rounded-lg border transition-colors cursor-pointer flex flex-col gap-1 ${
                done
                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                  : 'border-slate-200 bg-slate-50/70 hover:bg-teal-50/50 hover:border-teal-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[12px] font-bold">
                  {done ? `✓ ${s.doneLabel}` : s.actionLabel}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 leading-snug">{s.description}</span>
            </button>
          );
        })}
      </div>

      {demoNotice && (
        <div className="px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 text-[12px] font-medium flex items-center justify-between gap-2">
          <span>{demoNotice}</span>
          <button
            type="button"
            onClick={() => setDemoNotice(null)}
            className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold shrink-0 cursor-pointer"
          >
            닫기
          </button>
        </div>
      )}
    </div>
  );
};
