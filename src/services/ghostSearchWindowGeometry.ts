/**
 * 👻 귀신검색창 반응형 자율 호흡(소↔중 자동) & 2모드(작게/크게) 기하 계산 (웹 시뮬레이터 ↔ Z-코어 데몬 공통 규격)
 *
 * 데몬 정본: universal_z_core/seq_paste_daemon.py :: compute_ghost_search_window_3stage_rect / resolve_ghost_search_auto_stage
 * 이 파일은 동일 규칙의 TS 포팅본이며, 수치·클램핑 규칙을 바꿀 때는 데몬과 반드시 함께 바꾼다.
 *  - 작게(Compact 자율 호흡 모드): 검색량·항목 성격에 따라 소형 520×(220~380) ↔ 중형 960×640 자율 변환
 *  - 크게(갤러리 최대화 모드): 대형 1440×900 (프레임리스 갤러리, 화면 중앙 정렬)
 *  - 모니터 작업 영역(WorkArea) 안쪽 -20px 마진으로 자석 클램핑, 상단 입력창(Top-Left 앵커) 고정
 */

export type GhostSearchStage = 'small' | 'medium' | 'large';
export type GhostSearchWindowMode = 'compact' | 'large';

export const GHOST_SEARCH_WINDOW_STAGE_SIZES: Record<GhostSearchStage, { width: number; height: number }> = {
  small: { width: 520, height: 380 },
  medium: { width: 960, height: 640 },
  large: { width: 1440, height: 900 },
};

export const GHOST_SEARCH_STAGE_LABELS: Record<GhostSearchStage, string> = {
  small: '작게 (자율 소형)',
  medium: '작게 (자율 중형)',
  large: '⤢ 크게 (갤러리)',
};

export interface WorkArea {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface GhostSearchWindowRect {
  stage: GhostSearchStage;
  x: number;
  y: number;
  width: number;
  height: number;
  framelessAppMode: boolean;
}

export const DEFAULT_WORK_AREA: WorkArea = { left: 0, top: 0, right: 1920, bottom: 1040 };

/**
 * [자율 호흡 판별기]: 사용자가 '크게(large)'를 누르지 않은 평소('작게' 모드)일 때,
 * 검색어 유무 · 매칭 건수 · 사진/문서 미리보기 필요 여부에 따라 소형(520) ↔ 중형(960×640) 및 슬림 높이를 자율 결정합니다.
 */
export function resolveGhostSearchResponsiveSpec(params: {
  mode: GhostSearchWindowMode;
  hasQuery: boolean;
  resultCount: number;
  hasRichPreview?: boolean;
}): { stage: GhostSearchStage; customHeight?: number } {
  if (params.mode === 'large') {
    return { stage: 'large' };
  }
  const { hasQuery, resultCount, hasRichPreview = false } = params;
  // 검색어가 있고 결과가 4건 이상이거나 사진·문서 미리보기(OCR 등)가 매칭된 경우 자동으로 중형(960×640)으로 확장
  if (hasQuery && (resultCount >= 4 || (resultCount >= 1 && hasRichPreview))) {
    return { stage: 'medium' };
  }
  // 소형(520) 내에서도 항목 수에 맞춰 높이를 슬림하게 반응형 밀착 (240px ~ 380px)
  const clampedCount = Math.max(1, Math.min(5, resultCount || (hasQuery ? 1 : 4)));
  const slimHeight = hasQuery
    ? Math.min(380, Math.max(240, 148 + clampedCount * 46))
    : 340;
  return { stage: 'small', customHeight: slimHeight };
}

export function computeGhostSearchWindowRect(
  stage: string,
  anchorX: number,
  anchorY: number,
  workArea: WorkArea = DEFAULT_WORK_AREA,
  marginPx = 20,
  customHeight?: number
): GhostSearchWindowRect {
  const norm: GhostSearchStage = stage === 'medium' || stage === 'large' ? stage : 'small';
  const req = GHOST_SEARCH_WINDOW_STAGE_SIZES[norm];
  const targetH = norm === 'small' && typeof customHeight === 'number' ? customHeight : req.height;
  const availW = Math.max(320, workArea.right - workArea.left - marginPx * 2);
  const availH = Math.max(220, workArea.bottom - workArea.top - marginPx * 2);
  const width = Math.min(req.width, availW);
  const height = Math.min(targetH, availH);

  let x: number;
  let y: number;
  if (norm === 'large') {
    x = workArea.left + Math.floor((workArea.right - workArea.left - width) / 2);
    y = workArea.top + Math.floor((workArea.bottom - workArea.top - height) / 2);
  } else {
    x = Math.max(workArea.left + marginPx, Math.min(anchorX, workArea.right - marginPx - width));
    y = Math.max(workArea.top + marginPx, Math.min(anchorY, workArea.bottom - marginPx - height));
  }
  return { stage: norm, x, y, width, height, framelessAppMode: norm === 'large' };
}
