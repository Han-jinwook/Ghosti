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

export type BasicStepId = 'b1' | 'b2' | 'b3';

export const BASIC_STEPS: Array<{ id: BasicStepId; title: string; mission: string }> = [
  {
    id: 'b1',
    title: 'Ctrl+0 / Ctrl+우클릭 소환',
    mission: '아래 체험 칸 위에서 키보드 Ctrl + 0 또는 마우스 Ctrl + 우클릭을 눌러 귀신검색창을 불러보세요!',
  },
  {
    id: 'b2',
    title: '파일 안 열고 "단가" 바로 찾기',
    mission:
      '엑셀·한글 견적서를 일일이 열지 않아도 됩니다! 아래 카톡 입력창 위에서 Ctrl + 0 (또는 Ctrl + 우클릭)을 눌러 파일 속 "단가(145,000원)"를 1초 만에 꽂아 넣어보세요.',
  },
  {
    id: 'b3',
    title: '영수증 사진 속 글자 콕 찍기',
    mission:
      '아래 실제 영수증 사진 위에서 반짝이는 [사업자번호 123-45-67890] 영역(또는 우측 추출 단어칩)을 마우스로 콕 찍어 입력칸에 바로 넣어보세요!',
  },
];

/** 기본기 ② 샘플 */
export const BASIC2_QUERY = '샘플 견적서?';
export const BASIC2_RESULT = { file: '샘플_견적서.xlsx', value: '145,000원' };

/** 기본기 ③ 샘플 (영수증 OCR 단어칩) */
export const BASIC3_TARGET_CHIP = '사업자번호: 123-45-67890';
export const BASIC3_CHIPS = ['상호: 썬드림카페', BASIC3_TARGET_CHIP, '합계: 48,000원', '2026-11-07 14:22'];

// ─────────────────────────────────────────────────────────────
// 진행도 (도장) 저장 — 현재 세션(탭 전환) 동안은 유지하고, 페이지 새로고침(F5) 시 깔끔하게 초기화
// ─────────────────────────────────────────────────────────────

export const DOJO_PROGRESS_STORAGE_KEY = 'ghosti_dojo_progress_v1';

export interface DojoProgress {
  basics: Partial<Record<BasicStepId, boolean>>;
}

export const EMPTY_DOJO_PROGRESS: DojoProgress = { basics: {} };

let sessionDojoProgress: DojoProgress = { basics: {} };

try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(DOJO_PROGRESS_STORAGE_KEY);
  }
} catch {
  /* ignore */
}

export function loadDojoProgress(): DojoProgress {
  return {
    basics: { ...sessionDojoProgress.basics },
  };
}

export function saveDojoProgress(p: DojoProgress): void {
  sessionDojoProgress = {
    basics: { ...(p.basics || {}) },
  };
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ghosti_dojo_progress_updated', { detail: loadDojoProgress() }));
    }
  } catch {
    /* ignore */
  }
}

export function resetDojoProgress(): DojoProgress {
  sessionDojoProgress = { basics: {} };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(DOJO_PROGRESS_STORAGE_KEY);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ghosti_dojo_progress_updated', { detail: loadDojoProgress() }));
    }
  } catch {
    /* ignore */
  }
  return loadDojoProgress();
}

export function countBasicsDone(p: DojoProgress): number {
  return BASIC_STEPS.filter((s) => p.basics[s.id]).length;
}
