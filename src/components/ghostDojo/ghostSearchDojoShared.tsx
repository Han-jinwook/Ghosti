import React, { useEffect, useState } from 'react';
import { copyTextSafeToClipboard } from '../../services/proFeatureGate';

export const GHOST_DOJO_STORAGE_KEY = 'ghosti_search_game_v2';
export const GHOST_DOJO_EVENT_NAME = 'ghosti_dojo_progress_updated';

export type GhostDojoStepId =
  | 'doc_search'
  | 'photo_natural'
  | 'photo_text'
  | 'video_text'
  | 'summon'
  | 'medium'
  | 'large'
  | 'ocr'
  | 'labeler';

export interface GhostDojoStepDef {
  id: 'doc_search' | 'photo_natural' | 'photo_text' | 'video_text';
  shortTitle: string;
  sampleQuery: string;
  targetSpace: 'vault' | 'gallery' | 'video';
  description: string;
}

export const GHOST_DOJO_STEPS: GhostDojoStepDef[] = [
  {
    id: 'doc_search',
    shortTitle: '문서 속 문장 검색',
    sampleQuery: '공급단가',
    targetSpace: 'vault',
    description: '엑셀·PDF 파일을 열지 않고 "공급단가", "보증금" 같은 안쪽 문장을 바로 찾습니다.',
  },
  {
    id: 'photo_natural',
    shortTitle: '사진 자연어·인물 검색',
    sampleQuery: '해변 가족 산책',
    targetSpace: 'gallery',
    description: '파일명을 몰라도 "해변 가족 산책"처럼 상황과 인물을 말하듯 쳐서 찾습니다.',
  },
  {
    id: 'photo_text',
    shortTitle: '사진 속 글자 검색',
    sampleQuery: '38,500원',
    targetSpace: 'gallery',
    description: '사진첩에 묻힌 영수증·메모 캡처도 사진 안의 글자("38,500원")로 1초 만에 찾습니다.',
  },
  {
    id: 'video_text',
    shortTitle: '동영상 속 텍스트 검색',
    sampleQuery: '매출 35억',
    targetSpace: 'video',
    description: '긴 영상을 다 돌려보지 않아도 화면 속 글자("매출 35억")가 나온 장면(00:08)을 바로 찾습니다.',
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
  embeddedInCard?: boolean;
  onRequestStagePreview?: (stage: 'small' | 'large') => void;
  onJumpToSearchTab?: () => void;
}

export const GhostSearchDojoStampBoard: React.FC<GhostSearchDojoStampBoardProps> = ({
  variant = 'full',
  embeddedInCard = false,
  onJumpToSearchTab,
}) => {
  const [progress, setProgress] = useState<GhostDojoProgress>(() => loadGhostDojoProgress());
  const [activeStepId, setActiveStepId] = useState<GhostDojoStepDef['id'] | null>(null);
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
    setActiveStepId(step.id);
    const next = markGhostDojoStep(step.id);
    setProgress(next);

    if (variant === 'full' && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ghosti_dojo_preview_search', {
          detail: {
            space: step.targetSpace,
            query: step.sampleQuery,
          },
        })
      );
      if (step.id === 'doc_search') {
        setDemoNotice('아래 모니터 속 귀신검색창에서 엑셀 파일을 열지 않고 "공급단가(145,000원)" 문장을 즉시 찾아냈습니다.');
      } else if (step.id === 'photo_natural') {
        setDemoNotice('아래 모니터 속 귀신검색창에서 파일명 없이 "해변 가족 산책" 설명만으로 사진을 찾아냈습니다.');
      } else if (step.id === 'photo_text') {
        setDemoNotice('아래 모니터 속 귀신검색창에서 영수증 캡처 속 "38,500원" 글자를 읽어 해당 사진을 찾아냈습니다.');
      } else if (step.id === 'video_text') {
        setDemoNotice('아래 모니터 속 귀신검색창에서 회의 영상 화면 속 "매출 35억" 글자가 나오는 00:08 장면을 찾아냈습니다.');
      }
      return;
    }

    await copyTextSafeToClipboard(step.sampleQuery);
    setDemoNotice(`"${step.sampleQuery}" 검색 예시를 체험했습니다. [귀신검색 열기]에서 직접 확인해 보세요!`);
  };

  const containerCls = embeddedInCard
    ? 'flex flex-col gap-3'
    : 'flex flex-col gap-3 p-5 rounded-2xl bg-white border border-slate-300 shadow-sm';

  return (
    <div className={containerCls}>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            {variant !== 'compact' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-900 text-white text-[11px] font-bold tracking-tight select-none cursor-default">
                2단계
              </span>
            )}
            <h2
              className={
                variant === 'compact'
                  ? 'text-[14px] font-extrabold text-slate-900'
                  : 'text-[15.5px] font-extrabold text-slate-900 tracking-tight'
              }
            >
              {variant === 'compact'
                ? '귀신검색창 핵심 기능 4단계 체험'
                : '귀신검색창 핵심 기능 4가지 직접 써보기'}
            </h2>
          </div>
          {variant === 'compact' && (
            <span className="text-[12.5px] text-slate-600 cursor-default">
              버튼을 눌러 각 기능을 바로 체험해 보세요.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[12px] font-semibold text-slate-500 select-none cursor-default">
            진행 {completedCount}/4 완료
          </span>
          {onJumpToSearchTab && (
            <button
              type="button"
              onClick={onJumpToSearchTab}
              className="px-3 py-1.5 rounded-lg text-[12px] font-bold bg-teal-600 hover:bg-teal-500 text-white border-b-2 border-teal-800 shadow-2xs hover:-translate-y-0.5 active:translate-y-0 cursor-pointer transition-all"
            >
              귀신검색 열기 →
            </button>
          )}
          {hasAnyCompleted && (
            <button
              type="button"
              onClick={() => {
                resetGhostDojoProgress();
                setProgress({});
                setActiveStepId(null);
                setDemoNotice(null);
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(
                    new CustomEvent('ghosti_dojo_preview_search', {
                      detail: { space: 'gallery', query: '', reset: true },
                    })
                  );
                }
              }}
              className="px-2.5 py-1 rounded-md text-[11.5px] font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 hover:border-slate-400 shadow-2xs active:scale-95 transition-all cursor-pointer"
            >
              초기화
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {GHOST_DOJO_STEPS.map((s, idx) => {
          const done = Boolean(progress[s.id]);
          const isActive = activeStepId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => void handleStepClick(s)}
              className={`group text-left px-3.5 py-3 rounded-xl cursor-pointer transition-all duration-150 flex flex-col justify-between gap-1.5 ${
                isActive
                  ? 'bg-slate-900 text-white border-2 border-slate-900 shadow-md'
                  : 'bg-white text-slate-800 border border-slate-300 border-b-[3px] border-b-slate-300 shadow-2xs hover:-translate-y-0.5 hover:shadow-md hover:border-teal-500 hover:border-b-teal-600 hover:bg-teal-50/70 active:translate-y-0 active:scale-[0.98]'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5 w-full">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                      done
                        ? 'bg-emerald-500 text-white shadow-2xs'
                        : isActive
                          ? 'bg-teal-400 text-slate-950'
                          : 'bg-slate-100 border border-slate-300 text-slate-600 group-hover:border-teal-500 group-hover:bg-teal-100 group-hover:text-teal-900'
                    }`}
                  >
                    {done ? '✓' : idx + 1}
                  </span>
                  <span className="text-[13px] font-bold truncate">{s.shortTitle}</span>
                </div>
                {!isActive && (
                  <span
                    aria-hidden="true"
                    className="text-[14px] leading-none text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all shrink-0"
                  >
                    ›
                  </span>
                )}
              </div>
              <span
                className={`text-[11.5px] leading-snug ${
                  isActive ? 'text-slate-300' : 'text-slate-500 group-hover:text-slate-700'
                }`}
              >
                {s.description}
              </span>
            </button>
          );
        })}
      </div>

      {demoNotice && (
        <div className="px-3.5 py-2.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-950 text-[12.5px] font-semibold flex items-center justify-between gap-2 cursor-default">
          <span>✓ {demoNotice}</span>
          <button
            type="button"
            onClick={() => setDemoNotice(null)}
            className="px-2 py-0.5 rounded bg-white/80 hover:bg-white border border-teal-200 text-[11px] text-teal-800 font-bold shrink-0 cursor-pointer"
          >
            닫기
          </button>
        </div>
      )}
    </div>
  );
};
