/**
 * 👻 귀신검색 소환술 3단 수련 엔진 (순수 로직 — UI 비의존)
 *
 *  - 1단계: 애기귀신 귀신검색창 소환술 기본기 3단 수련 (Ctrl+0 / Ctrl+우클릭 즉시 소환)
 *    - b1: Ctrl+0 / Ctrl+우클릭으로 귀신검색창 소환
 *    - b2: 파일 안 열고 본문 속 "단가" 1초 찾기
 *    - b3: 영수증 사진 속 사업자번호 단어칩 1초 추출
 */

/** 소환 즉시 반응 판정 시간 (ms) — Ctrl+0 / Ctrl+우클릭 즉시 소환 규격 */
export const SUMMON_HOLD_MS = 0;

export type BasicStepId = 'b1';

export const BASIC_STEPS: Array<{ id: BasicStepId; title: string; mission: string }> = [
  {
    id: 'b1',
    title: 'Ctrl+0 / Ctrl+우클릭 소환',
    mission: '키보드(Ctrl + 0)와 마우스(Ctrl + 우클릭)를 각각 3번씩 눌러 게이지를 채워보세요!',
  },
];

/** 기본기 ② 샘플 */
export const BASIC2_QUERY = '샘플 견적서?';
export const BASIC2_RESULT = { file: '샘플_견적서.xlsx', value: '145,000원' };

/** 기본기 ③ 샘플 (영수증 OCR 단어칩) */
export const BASIC3_TARGET_CHIP = '사업자번호: 123-45-67890';
export const BASIC3_CHIPS = ['상호: 썬드림카페', BASIC3_TARGET_CHIP, '합계: 48,000원', '2026-11-07 14:22'];

// ─────────────────────────────────────────────────────────────
// 진행도 저장 — 새로고침 시에도 1단계·2단계 상태가 어긋나지 않도록 localStorage 동기화
// ─────────────────────────────────────────────────────────────

export const DOJO_PROGRESS_STORAGE_KEY = 'ghosti_dojo_progress_v2';
const STEP2_GAME_STORAGE_KEY = 'ghosti_search_game_v2';

export interface DojoProgress {
  basics: Partial<Record<BasicStepId, boolean>>;
  b1Counts?: { keyboard: number; mouse: number };
}

export const EMPTY_DOJO_PROGRESS: DojoProgress = { basics: {}, b1Counts: { keyboard: 0, mouse: 0 } };

function readStoredDojoProgress(): DojoProgress {
  try {
    if (typeof localStorage === 'undefined') {
      return { basics: {}, b1Counts: { keyboard: 0, mouse: 0 } };
    }
    localStorage.removeItem('ghosti_dojo_progress_v1');
    const raw = localStorage.getItem(DOJO_PROGRESS_STORAGE_KEY);
    if (!raw) {
      // 1단계가 미완료인데 2단계 완료 기록만 남아있는 불일치 상태 원천 차단
      localStorage.removeItem(STEP2_GAME_STORAGE_KEY);
      return { basics: {}, b1Counts: { keyboard: 0, mouse: 0 } };
    }
    const parsed = JSON.parse(raw) as DojoProgress | null;
    const kb = Number(parsed?.b1Counts?.keyboard ?? 0) || 0;
    const ms = Number(parsed?.b1Counts?.mouse ?? 0) || 0;
    const b1Done = Boolean(parsed?.basics?.b1) || (kb >= 3 && ms >= 3);
    if (!b1Done) {
      localStorage.removeItem(STEP2_GAME_STORAGE_KEY);
    }
    return {
      basics: b1Done ? { b1: true } : {},
      b1Counts: { keyboard: kb, mouse: ms },
    };
  } catch {
    return { basics: {}, b1Counts: { keyboard: 0, mouse: 0 } };
  }
}

let sessionDojoProgress: DojoProgress = readStoredDojoProgress();

export function loadDojoProgress(): DojoProgress {
  sessionDojoProgress = readStoredDojoProgress();
  return {
    basics: { ...sessionDojoProgress.basics },
    b1Counts: {
      keyboard: sessionDojoProgress.b1Counts?.keyboard ?? 0,
      mouse: sessionDojoProgress.b1Counts?.mouse ?? 0,
    },
  };
}

export function saveDojoProgress(p: DojoProgress): void {
  const kb = p.b1Counts?.keyboard ?? sessionDojoProgress.b1Counts?.keyboard ?? 0;
  const ms = p.b1Counts?.mouse ?? sessionDojoProgress.b1Counts?.mouse ?? 0;
  const b1Done = Boolean(p.basics?.b1) || (kb >= 3 && ms >= 3);
  sessionDojoProgress = {
    basics: b1Done ? { b1: true } : {},
    b1Counts: { keyboard: kb, mouse: ms },
  };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DOJO_PROGRESS_STORAGE_KEY, JSON.stringify(sessionDojoProgress));
      if (!b1Done) {
        localStorage.removeItem(STEP2_GAME_STORAGE_KEY);
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ghosti_dojo_progress_updated', { detail: sessionDojoProgress }));
    }
  } catch {
    /* ignore */
  }
}

export function resetDojoProgress(): DojoProgress {
  sessionDojoProgress = { basics: {}, b1Counts: { keyboard: 0, mouse: 0 } };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(DOJO_PROGRESS_STORAGE_KEY);
      localStorage.removeItem(STEP2_GAME_STORAGE_KEY);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ghosti_dojo_progress_updated', { detail: { reset: true } }));
      window.dispatchEvent(
        new CustomEvent('ghosti_dojo_preview_search', {
          detail: { space: 'gallery', query: '', reset: true },
        }),
      );
    }
  } catch {
    /* ignore */
  }
  return loadDojoProgress();
}

export function countBasicsDone(p: DojoProgress): number {
  return BASIC_STEPS.filter((s) => p.basics[s.id]).length;
}
