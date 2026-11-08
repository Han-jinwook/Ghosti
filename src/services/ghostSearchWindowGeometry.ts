/**
 * 👻 귀신검색창 3단 크기 변신 기하 계산 (웹 시뮬레이터 ↔ Z-코어 데몬 공통 규격)
 *
 * 데몬 정본: universal_z_core/seq_paste_daemon.py :: compute_ghost_search_window_3stage_rect
 * 이 파일은 동일 규칙의 TS 포팅본이며, 수치·클램핑 규칙을 바꿀 때는 데몬과 반드시 함께 바꾼다.
 *  - 소형 520×380 (미니 탐색기) / 중형 960×640 (사진+OCR 황금 사이즈) / 대형 1440×900 (프레임리스 갤러리)
 *  - 모니터 작업 영역(WorkArea) 안쪽 -20px 마진으로 자석 클램핑, 대형은 화면 중앙 정렬
 */

export type GhostSearchStage = 'small' | 'medium' | 'large';

export const GHOST_SEARCH_WINDOW_STAGE_SIZES: Record<GhostSearchStage, { width: number; height: number }> = {
  small: { width: 520, height: 380 },
  medium: { width: 960, height: 640 },
  large: { width: 1440, height: 900 },
};

export const GHOST_SEARCH_STAGE_LABELS: Record<GhostSearchStage, string> = {
  small: '소형',
  medium: '중형',
  large: '🖼️ 갤러리로 펼쳐보기',
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

export function computeGhostSearchWindowRect(
  stage: string,
  anchorX: number,
  anchorY: number,
  workArea: WorkArea = DEFAULT_WORK_AREA,
  marginPx = 20
): GhostSearchWindowRect {
  const norm: GhostSearchStage = stage === 'medium' || stage === 'large' ? stage : 'small';
  const req = GHOST_SEARCH_WINDOW_STAGE_SIZES[norm];
  const availW = Math.max(320, workArea.right - workArea.left - marginPx * 2);
  const availH = Math.max(240, workArea.bottom - workArea.top - marginPx * 2);
  const width = Math.min(req.width, availW);
  const height = Math.min(req.height, availH);

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
