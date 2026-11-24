/**
 * [온디바이스 얼굴 여권 엔진 (PC · 모바일 · 웹 공통)]
 * - YuNet(232KB) 전용 Web Worker로 실사진에서 얼굴 좌표·정면도를 자동 검출
 * - 검출된 얼굴을 128x128 여권 아바타로 크롭하고, 조명정규화 구조+색감+그래디언트 벡터로
 *   동일 인물 클러스터링 및 연도별 베스트 컷(yearlyBestCuts)을 자동 구성합니다.
 * - 스캔 완료 즉시 워커를 종료해 백그라운드 RAM 점유를 0으로 유지합니다.
 */
import type { FaceMemberCluster, PhotoItem, YearlyFaceBestCut } from '../../types/saysee';
import type { WorkerDetectedFace } from './facePassportWorker';

const ONDEVICE_FACE_CACHE_KEY = 'ghosti_ondevice_face_clusters_v11';
const MAX_SCAN_PHOTOS = 260;
const MAX_CLUSTERS = 18;
const MAX_CUTS_PER_CLUSTER = 6;
/** OpenCV SFace 공식 5점 정렬(ArcFace 112x112) 기준 초기 고순도 시드 결합 임계치 */
const SIMILARITY_THRESHOLD = 0.44;
/** 동일인 다각도·선글라스·연도별 서브클러스터 중심 벡터 재병합 임계치 (동일 사진 동반 등장 Cannot-Link + 상위 3쌍 검증 결합) */
const MERGE_CENTROID_THRESHOLD = 0.42;
const MERGE_TOP3_PAIR_THRESHOLD = 0.45;
/** 여권사진 정체성 변별 및 4~10인 가족 단체사진(280px 썸네일 내 자녀·어르신 얼굴 19~25px) 동시 포착 최소 기준 — 18px 이하 원경 노이즈 차단 */
const MIN_PASSPORT_FACE_PX = 19;
const MIN_PASSPORT_EYE_SPAN_PX = 5.8;
/** ArcFace / OpenCV SFace 112x112 공식 5점 기준 랜드마크 (우안, 좌안, 코, 우입꼬리, 좌입꼬리) */
const ARCFACE_REF_112: ReadonlyArray<readonly [number, number]> = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];
const SCREENSHOT_NAME_RX = /(screenshot|스크린샷|캡처|캡쳐|capture|화면\s*캡처|영수증|receipt|memo|메모|오류|배너|로고|favicon|포스터|워터마크)/i;
/** AI 생성·스톡·웹 작업 이미지 판별 */
const AI_OR_STOCK_IMAGE_NAME_RX =
  /(gemini_generated|chatgpt|midjourney|dall[-_]?e|stable[-_]?diffusion|comfyui|flux[-_]|stock_photo|unsplash|pexels|pixabay|freepik|shutterstock|gettyimages|ai_generated|generated_image|_remix_|^image-\d{4,}|^image(\s*\(\d+\))?\.png$)/i;
/** 시스템 임시폴더·앱 리소스·유튜브/AI/전자책/마케팅/음식전용 폴더 (실제 내 일상·가족 인물 사진이 아닌 폴더 배제) */
const NON_PORTRAIT_WORK_OR_TEMP_PATH_RX =
  /(?:[\\/](?:appdata[\\/]local[\\/]temp|tmp|jetski_recording_[^\\/]*|merlin_vid_fullocr_[^\\/]*|merlin_pdf_ppocr_[^\\/]*|crisp_thumbs|accountpictures|google ai studio|g_youtube|ai캐릭터|오일요법|캘리버 서재|calibre|의료기라벨|amd-catalyst|merlintools[\\/]assets|[^\\/]+_files|brandmark|ocam|급식앱\(캡쳐\)|급식|식판|앱오류|뭐먹지 로고|증빙서류|node_modules|03_맛집_음식_고기_카페_디저트|맛집_음식)[\\/]|^(?:IMG_2025|PET_2025|TRV_2025|DOC_2025|MEMO_2025|Screenshot_2025|BLUR_2025|귀신같이_캡처_))/i;
/** 스마트폰·디지털카메라·클라우드 앨범 표준 촬영 파일명 패턴 (예: 20240720_182301.jpg, 제주대가족여행_20200622_..., 1721441387443.jpg, IMG_1234.jpg, KakaoTalk_...) */
const REAL_CAMERA_PHOTO_NAME_RX =
  /(?:(?:^|_)(?:19|20)\d{6}[_-]\d{4,6}|^1[5-8]\d{11}(?:\(\d+\))?\.jpe?g$|^(?:IMG[_-]|DSC[_N0-9]|DCIM|PXL[_-]|SAM[_-]|GOPR|DJI[_-]|KakaoTalk_\d{8}|사진))/i;
/** 가족·인물·여행 폴더/파일명 우선 가중치 힌트 */
const PORTRAIT_FOLDER_OR_NAME_HINT_RX =
  /(가족|인물|커플|모임|스냅|여행|제주|스키|생일|돌잔치|결혼|휴가|아이|아들|딸|부모|엄마|아빠|할머니|할아버지)/i;
/** 실제 사람 피부톤 최소 비율 (카툰·초록/파란 캐릭터·음식·국그릇 오탐 차단, 그늘·역광·실내 인물 사진은 100% 통과) */
const MIN_HUMAN_SKIN_RATIO = 0.12;

interface CachedFaceStore {
  fingerprint: string;
  updatedAt: number;
  latestCorpusYear: number;
  clusters: FaceMemberCluster[];
}

interface ExtractedFaceSample {
  photo: PhotoItem;
  baseKey: string;
  year: number;
  dateStr: string;
  score: number;
  frontalScore: number;
  facePxW: number;
  sharpness: number;
  boundingBox: [number, number, number, number];
  avatarDataUrl: string;
  embedding: Float32Array;
}

function normalizePhotoBaseKey(photoName: string): string {
  return String(photoName || '')
    .replace(/__[0-9A-Za-z가-힣_-]{1,18}_[0-9a-f]{6}(?=\.[^.]+$)/i, '')
    .toLowerCase();
}

let activeScanPromise: Promise<FaceMemberCluster[]> | null = null;
let lastScannedFingerprint = '';

export function isOnDeviceFaceScanRunning(): boolean {
  return activeScanPromise !== null;
}

function buildPhotosFingerprint(photos: PhotoItem[]): string {
  const real = photos.filter(
    (p) =>
      p &&
      !p.quarantined &&
      !NON_PORTRAIT_WORK_OR_TEMP_PATH_RX.test(p.fullPath || '') &&
      !NON_PORTRAIT_WORK_OR_TEMP_PATH_RX.test(p.name || '') &&
      !AI_OR_STOCK_IMAGE_NAME_RX.test(p.name || '')
  );
  if (real.length === 0) return '';
  const head = real.slice(0, 8).map((p) => p.name).join('|');
  const tail = real.slice(-4).map((p) => p.name).join('|');
  return `v11:${real.length}:${head}:${tail}`;
}

export function loadCachedOnDeviceFaceClusters(): {
  latestCorpusYear: number;
  clusters: FaceMemberCluster[];
  fingerprint: string;
} {
  try {
    const raw = localStorage.getItem(ONDEVICE_FACE_CACHE_KEY);
    if (!raw) return { latestCorpusYear: new Date().getFullYear(), clusters: [], fingerprint: '' };
    const parsed = JSON.parse(raw) as CachedFaceStore;
    if (!parsed || !Array.isArray(parsed.clusters)) {
      return { latestCorpusYear: new Date().getFullYear(), clusters: [], fingerprint: '' };
    }
    // 중복 clusterId 오염 캐시 방어 검증
    const seenIds = new Set<string>();
    for (const c of parsed.clusters) {
      if (!c?.clusterId || seenIds.has(c.clusterId)) {
        return { latestCorpusYear: new Date().getFullYear(), clusters: [], fingerprint: '' };
      }
      seenIds.add(c.clusterId);
    }
    return {
      latestCorpusYear: Number(parsed.latestCorpusYear) || new Date().getFullYear(),
      clusters: parsed.clusters,
      fingerprint: String(parsed.fingerprint || ''),
    };
  } catch {
    return { latestCorpusYear: new Date().getFullYear(), clusters: [], fingerprint: '' };
  }
}

export function saveCachedOnDeviceFaceClusters(
  clusters: FaceMemberCluster[],
  latestCorpusYear: number,
  fingerprint?: string
): void {
  try {
    const prev = loadCachedOnDeviceFaceClusters();
    const payload: CachedFaceStore = {
      fingerprint: fingerprint ?? prev.fingerprint,
      updatedAt: Date.now(),
      latestCorpusYear,
      clusters: clusters.slice(0, MAX_CLUSTERS),
    };
    localStorage.setItem(ONDEVICE_FACE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota errors */
  }
}

function parsePhotoYearAndDate(photo: PhotoItem): { year: number; dateStr: string } {
  const nowYear = new Date().getFullYear();
  const cleanName = normalizePhotoBaseKey(photo.name || '');

  // 1순위: 파일명에 명시된 실제 촬영일자(예: 제주대가족여행_20200622_..., 20240720_182301.jpg) — 폴더 복사일(st_mtime=2026) 오염 방지
  const nm = cleanName.match(/(?:^|\D)(19[89]\d|20[0-3]\d)[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])(?:\D|$)/);
  if (nm) {
    const y = Math.min(nowYear, Math.max(1980, Number(nm[1])));
    return { year: y, dateStr: `${y}-${nm[2]}-${nm[3]}` };
  }

  // 2순위: 13자리 밀리초 타임스탬프 파일명(예: 1721441387443.jpg)
  const epochMatch = cleanName.match(/^(1[4-9]\d{11})(?:\(\d+\))?\.[a-z0-9]+$/i);
  if (epochMatch) {
    const dt = new Date(Number(epochMatch[1]));
    const y = dt.getFullYear();
    if (y >= 2014 && y <= nowYear) {
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return { year: y, dateStr: `${y}-${m}-${d}` };
    }
  }

  // 3순위: EXIF / 메타데이터 촬영일(photo.date)
  const dateRaw = String(photo.date || '').trim();
  const dm = dateRaw.match(/(19\d{2}|20\d{2})[-./]?(\d{2})?[-./]?(\d{2})?/);
  if (dm) {
    const y = Math.min(nowYear, Math.max(1980, Number(dm[1])));
    const m = dm[2] || '01';
    const d = dm[3] || '01';
    return { year: y, dateStr: `${y}-${m}-${d}` };
  }

  if (photo.mtimeMs && photo.mtimeMs > 946684800000) {
    const dt = new Date(photo.mtimeMs);
    const y = Math.min(nowYear, Math.max(1980, dt.getFullYear()));
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return { year: y, dateStr: `${y}-${m}-${d}` };
  }
  return { year: nowYear, dateStr: `${nowYear}-01-01` };
}

/**
 * 연도별 균등 층화 표집(Stratified Multi-Year Portrait-First Sampling)
 * - 최신 특정 연도(예: 2024 커플 여행 170장)가 스캔 쿼터를 독점해 과거 가족 여행 폴더(2017~2020 자녀·부모님 사진)가
 *   통째로 누락되는 현상을 원천 차단합니다.
 * - 동명 중복 사본을 먼저 걸러낸 뒤 촬영 연도별로 버킷을 나누고, 각 연도 안에서는 가족·인물·여행 폴더 및 카메라 원본 JPEG를
 *   우선 정렬하여 모든 연도에서 라운드로빈으로 고르게 추출합니다.
 */
function selectStratifiedFaceScanCandidates(basePool: PhotoItem[], maxCount: number): PhotoItem[] {
  const byBaseKey = new Map<string, PhotoItem>();
  for (const p of basePool) {
    const key = normalizePhotoBaseKey(p.name);
    const prev = byBaseKey.get(key);
    if (!prev) {
      byBaseKey.set(key, p);
    } else {
      const prevHasHashSuffix = /__[0-9A-Za-z가-힣_-]{1,18}_[0-9a-f]{6}(?=\.[^.]+$)/i.test(prev.name);
      const curHasHashSuffix = /__[0-9A-Za-z가-힣_-]{1,18}_[0-9a-f]{6}(?=\.[^.]+$)/i.test(p.name);
      if (prevHasHashSuffix && !curHasHashSuffix) {
        byBaseKey.set(key, p);
      }
    }
  }

  const deduped = Array.from(byBaseKey.values());
  const byYear = new Map<number, PhotoItem[]>();
  for (const p of deduped) {
    const { year } = parsePhotoYearAndDate(p);
    const list = byYear.get(year);
    if (list) list.push(p);
    else byYear.set(year, [p]);
  }

  const scoreCandidatePriority = (p: PhotoItem): number => {
    const pathAndName = `${p.fullPath || ''} ${p.name || ''}`;
    let rank = 0;
    if (!PORTRAIT_FOLDER_OR_NAME_HINT_RX.test(pathAndName)) rank += 10;
    if (!(REAL_CAMERA_PHOTO_NAME_RX.test(p.name) && /\.jpe?g$/i.test(p.name))) rank += 4;
    if (SCREENSHOT_NAME_RX.test(p.name) || /\.png$/i.test(p.name)) rank += 20;
    return rank;
  };

  const yearsDesc = Array.from(byYear.keys()).sort((a, b) => b - a);
  for (const y of yearsDesc) {
    const arr = byYear.get(y)!;
    arr.sort((a, b) => {
      const pa = scoreCandidatePriority(a);
      const pb = scoreCandidatePriority(b);
      if (pa !== pb) return pa - pb;
      return (b.mtimeMs || 0) - (a.mtimeMs || 0);
    });
  }

  const selected: PhotoItem[] = [];
  const cursors = new Map<number, number>(yearsDesc.map((y) => [y, 0]));
  while (selected.length < maxCount) {
    let pickedInRound = false;
    for (const y of yearsDesc) {
      const arr = byYear.get(y)!;
      const idx = cursors.get(y) || 0;
      if (idx < arr.length) {
        selected.push(arr[idx]);
        cursors.set(y, idx + 1);
        pickedInRound = true;
        if (selected.length >= maxCount) break;
      }
    }
    if (!pickedInRound) break;
  }
  return selected;
}

function loadImageForFaceScan(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      resolve(null);
    }, 4500);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img.naturalWidth > 16 && img.naturalHeight > 16 ? img : null);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

type ScanImageSource = HTMLImageElement | HTMLCanvasElement;

function getSourceSize(src: ScanImageSource): { ow: number; oh: number } {
  if (src instanceof HTMLCanvasElement) {
    return { ow: src.width, oh: src.height };
  }
  return { ow: src.naturalWidth, oh: src.naturalHeight };
}

/**
 * 무EXIF 상하반전(180°)·측면회전(90°/270°) 촬영 사진을 정방향(0°) 캔버스로 복원
 * - degCw = 90(시계 90°), 180(상하반전), 270(반시계 90°)
 */
function drawRotatedSource(
  img: HTMLImageElement,
  degCw: 90 | 180 | 270,
  rotCanvas: HTMLCanvasElement,
  rotCtx: CanvasRenderingContext2D
): HTMLCanvasElement {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  rotCtx.setTransform(1, 0, 0, 1, 0, 0);
  if (degCw === 180) {
    rotCanvas.width = iw;
    rotCanvas.height = ih;
    rotCtx.clearRect(0, 0, iw, ih);
    rotCtx.translate(iw, ih);
    rotCtx.rotate(Math.PI);
    rotCtx.drawImage(img, 0, 0);
  } else if (degCw === 90) {
    rotCanvas.width = ih;
    rotCanvas.height = iw;
    rotCtx.clearRect(0, 0, ih, iw);
    rotCtx.translate(ih, 0);
    rotCtx.rotate(Math.PI / 2);
    rotCtx.drawImage(img, 0, 0);
  } else {
    rotCanvas.width = ih;
    rotCanvas.height = iw;
    rotCtx.clearRect(0, 0, ih, iw);
    rotCtx.translate(0, iw);
    rotCtx.rotate(-Math.PI / 2);
    rotCtx.drawImage(img, 0, 0);
  }
  rotCtx.setTransform(1, 0, 0, 1, 0, 0);
  return rotCanvas;
}

function prepareYuNetInput(
  src: ScanImageSource,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): { bgr: Float32Array; origW: number; origH: number; scale: number } {
  const { ow: origW, oh: origH } = getSourceSize(src);
  const scale = Math.min(640 / origW, 640 / origH);
  const nw = Math.max(1, Math.round(origW * scale));
  const nh = Math.max(1, Math.round(origH * scale));

  canvas.width = 640;
  canvas.height = 640;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 640, 640);
  ctx.drawImage(src, 0, 0, nw, nh);

  const rgba = ctx.getImageData(0, 0, 640, 640).data;
  const planeSize = 640 * 640;
  const bgr = new Float32Array(3 * planeSize);
  for (let i = 0, p = 0; i < planeSize; i++, p += 4) {
    bgr[i] = rgba[p + 2]; // B
    bgr[planeSize + i] = rgba[p + 1]; // G
    bgr[2 * planeSize + i] = rgba[p]; // R
  }
  return { bgr, origW, origH, scale };
}

function prepareFaceCropAndBgr112(
  src: ScanImageSource,
  face: WorkerDetectedFace,
  cropCanvas: HTMLCanvasElement,
  cropCtx: CanvasRenderingContext2D,
  sfaceCanvas: HTMLCanvasElement,
  sfaceCtx: CanvasRenderingContext2D
): {
  avatarDataUrl: string;
  faceBgr112: Float32Array;
  sharpness: number;
  facePxW: number;
  isRealHumanFace: boolean;
} {
  const { ow, oh } = getSourceSize(src);
  const fx1 = face.x1 * ow;
  const fy1 = face.y1 * oh;
  const fw = Math.max(8, (face.x2 - face.x1) * ow);
  const fh = Math.max(8, (face.y2 - face.y1) * oh);
  const eyeSpanPx =
    face.landmarks && face.landmarks.length === 10
      ? Math.hypot((face.landmarks[2] - face.landmarks[0]) * ow, (face.landmarks[3] - face.landmarks[1]) * oh)
      : fw * 0.35;

  // 초소형 원경 배경 얼굴(26px 미만 또는 양안 간격 8px 미만)은 112x112 확대 시 이목구비가 뭉개져 타인과 오병합되므로 여권 후보에서 배제
  if (Math.min(fw, fh) < MIN_PASSPORT_FACE_PX || eyeSpanPx < MIN_PASSPORT_EYE_SPAN_PX) {
    return { avatarDataUrl: '', faceBgr112: new Float32Array(0), sharpness: 0, facePxW: fw, isRealHumanFace: false };
  }

  // 여권 아바타용 정사각형 크롭 (상하좌우 28% 여백)
  const side = Math.max(fw, fh) * 1.56;
  const cx = fx1 + fw * 0.5;
  const cy = fy1 + fh * 0.46;
  const sx = Math.max(0, Math.min(ow - 1, cx - side * 0.5));
  const sy = Math.max(0, Math.min(oh - 1, cy - side * 0.5));
  const sw = Math.max(8, Math.min(ow - sx, side));
  const sh = Math.max(8, Math.min(oh - sy, side));

  cropCanvas.width = 128;
  cropCanvas.height = 128;
  cropCtx.clearRect(0, 0, 128, 128);
  cropCtx.drawImage(src, sx, sy, sw, sh, 0, 0, 128, 128);
  const avatarDataUrl = cropCanvas.toDataURL('image/jpeg', 0.72);

  // SFace int8 112x112 공식 5점 랜드마크 2D 유사변환(ArcFace alignCrop)
  // (비정렬 단순 크롭 시 고개 기울기·크기 차이로 동일인이 여러 칸에 분리되거나 타인이 섞이는 문제를 근본 해결)
  sfaceCanvas.width = 112;
  sfaceCanvas.height = 112;
  sfaceCtx.setTransform(1, 0, 0, 1, 0, 0);
  sfaceCtx.clearRect(0, 0, 112, 112);

  let alignedOk = false;
  if (face.landmarks && face.landmarks.length === 10) {
    let meanSx = 0;
    let meanSy = 0;
    let meanDx = 0;
    let meanDy = 0;
    const pts: Array<[number, number]> = [];
    for (let k = 0; k < 5; k++) {
      const sxPt = face.landmarks[k * 2] * ow;
      const syPt = face.landmarks[k * 2 + 1] * oh;
      pts.push([sxPt, syPt]);
      meanSx += sxPt;
      meanSy += syPt;
      meanDx += ARCFACE_REF_112[k][0];
      meanDy += ARCFACE_REF_112[k][1];
    }
    meanSx /= 5;
    meanSy /= 5;
    meanDx /= 5;
    meanDy /= 5;

    let denom = 0;
    let numA = 0;
    let numB = 0;
    for (let k = 0; k < 5; k++) {
      const dsx = pts[k][0] - meanSx;
      const dsy = pts[k][1] - meanSy;
      const ddx = ARCFACE_REF_112[k][0] - meanDx;
      const ddy = ARCFACE_REF_112[k][1] - meanDy;
      denom += dsx * dsx + dsy * dsy;
      numA += dsx * ddx + dsy * ddy;
      numB += dsx * ddy - dsy * ddx;
    }
    if (denom > 16) {
      const a = numA / denom;
      const b = numB / denom;
      const sc = Math.hypot(a, b);
      if (sc > 0.05 && sc < 20) {
        const tx = meanDx - (a * meanSx - b * meanSy);
        const ty = meanDy - (b * meanSx + a * meanSy);
        sfaceCtx.setTransform(a, b, -b, a, tx, ty);
        sfaceCtx.drawImage(src, 0, 0);
        sfaceCtx.setTransform(1, 0, 0, 1, 0, 0);
        alignedOk = true;
      }
    }
  }
  if (!alignedOk) {
    const sSide = Math.max(fw, fh) * 1.15;
    const ssx = Math.max(0, Math.min(ow - 1, cx - sSide * 0.5));
    const ssy = Math.max(0, Math.min(oh - 1, cy - sSide * 0.5));
    const ssw = Math.max(8, Math.min(ow - ssx, sSide));
    const ssh = Math.max(8, Math.min(oh - ssy, sSide));
    sfaceCtx.drawImage(src, ssx, ssy, ssw, ssh, 0, 0, 112, 112);
  }
  const rgba = sfaceCtx.getImageData(0, 0, 112, 112).data;

  const plane = 112 * 112;
  const faceBgr112 = new Float32Array(3 * plane);
  let gradSum = 0;
  let coreTotal = 0;
  let skinPixels = 0;
  let nonHumanColorPixels = 0;
  let foodSatPixels = 0;

  for (let i = 0, p = 0; i < plane; i++, p += 4) {
    const r = rgba[p];
    const g = rgba[p + 1];
    const b = rgba[p + 2];
    faceBgr112[i] = b; // B
    faceBgr112[plane + i] = g; // G
    faceBgr112[2 * plane + i] = r; // R
    if (i > 112 && (i & 3) === 0) {
      const gCur = g;
      const gLeft = rgba[p - 3];
      const gUp = rgba[p - 112 * 4 + 1];
      gradSum += Math.abs(gCur - gLeft) + Math.abs(gCur - gUp);
    }

    // 얼굴 중심 영역(볼·코·입 주변 60% 코어) 피부색 vs 캐릭터·음식(국/찌개/식판) 색감 검증
    const row = Math.floor(i / 112);
    const col = i - row * 112;
    if (row >= 22 && row <= 92 && col >= 22 && col <= 90) {
      coreTotal++;
      // YCbCr 변환 (ITU-R BT.601)
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      // 고채도 주황·노랑·빨강 국물/찌개/음식 색감 판별 (실제 사람 피부에는 나타나지 않는 극단 채도)
      const isHighSatFoodOrSauce =
        (r > 135 && g > 65 && b < 48 && r - b > 95) ||
        (cr > 172 && cb < 86);
      if (isHighSatFoodOrSauce) {
        foodSatPixels++;
      }
      // 자연 조명·실내외·선글라스·역광·그늘을 포괄하는 표준 사람 피부색 범위 (Chai & Ngan YCbCr)
      const isNaturalSkin =
        !isHighSatFoodOrSauce &&
        r > 42 &&
        g > 26 &&
        b > 14 &&
        r >= g - 8 &&
        r > b + 6 &&
        cr >= 131 &&
        cr <= 170 &&
        cb >= 78 &&
        cb <= 130;
      if (isNaturalSkin) {
        skinPixels++;
      } else if (
        // 초록/연두/파랑/보라/원색 노랑 등 사람 얼굴 중심부에 나타날 수 없는 캐릭터·사물 색상
        (g > r + 12 && g > b + 15) ||
        (b > r + 18 && b > g + 10) ||
        (r > 150 && g > 155 && b < 75 && cr < 134)
      ) {
        nonHumanColorPixels++;
      }
    }
  }

  const skinRatio = coreTotal > 0 ? skinPixels / coreTotal : 0;
  const nonHumanRatio = coreTotal > 0 ? nonHumanColorPixels / coreTotal : 0;
  const foodSatRatio = coreTotal > 0 ? foodSatPixels / coreTotal : 0;
  const isRealHumanFace =
    skinRatio >= MIN_HUMAN_SKIN_RATIO &&
    nonHumanRatio < 0.25 &&
    foodSatRatio < 0.22 &&
    skinRatio > nonHumanRatio;
  const sharpness = Math.min(99, Math.max(55, Math.round(55 + (gradSum / 35000) * 44)));
  return { avatarDataUrl, faceBgr112, sharpness, facePxW: fw, isRealHumanFace };
}

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) s += a[i] * b[i];
  return s;
}

function hasPhotoOverlap(aKeys: Set<string>, bKeys: Set<string>): boolean {
  const [smaller, larger] = aKeys.size <= bKeys.size ? [aKeys, bKeys] : [bKeys, aKeys];
  for (const k of smaller) {
    if (larger.has(k)) return true;
  }
  return false;
}

function computeTop3CrossPairMean(a: ExtractedFaceSample[], b: ExtractedFaceSample[]): number {
  let t1 = -1;
  let t2 = -1;
  let t3 = -1;
  let count = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      const s = dot(a[i].embedding, b[j].embedding);
      count++;
      if (s > t1) {
        t3 = t2;
        t2 = t1;
        t1 = s;
      } else if (s > t2) {
        t3 = t2;
        t2 = s;
      } else if (s > t3) {
        t3 = s;
      }
    }
  }
  if (count === 0) return -1;
  if (count === 1) return t1;
  if (count === 2) return (t1 + t2) / 2;
  return (t1 + t2 + t3) / 3;
}

function clusterExtractedFaces(
  samples: ExtractedFaceSample[],
  existingClusters: FaceMemberCluster[]
): { clusters: FaceMemberCluster[]; latestCorpusYear: number } {
  interface WorkingCluster {
    centroid: Float32Array;
    members: ExtractedFaceSample[];
    photoKeys: Set<string>;
  }
  const working: WorkingCluster[] = [];

  // 가장 크고 정면인 선명한 얼굴이 각 인물 클러스터의 기준 시드(members[0])가 되도록 품질순 정렬
  const orderedSamples = samples
    .slice()
    .sort((a, b) => b.frontalScore * Math.min(80, b.facePxW) - a.frontalScore * Math.min(80, a.facePxW));

  for (const s of orderedSamples) {
    let bestIdx = -1;
    let bestSim = SIMILARITY_THRESHOLD;
    for (let i = 0; i < working.length; i++) {
      // [동일 사진 동반 등장 분리(Cannot-Link)]: 한 사진에서 동시에 검출된 두 얼굴은 서로 다른 인물이므로 절대 같은 칸에 넣지 않음
      if (working[i].photoKeys.has(s.baseKey)) continue;
      const sim = dot(s.embedding, working[i].centroid);
      // 클러스터 대표(첫 번째) 샘플과의 최소 유사도도 함께 검증해 점진적 평균 이동(drift)에 의한 타인 합류 원천 차단
      const seedSim = dot(s.embedding, working[i].members[0].embedding);
      if (sim > bestSim && seedSim >= SIMILARITY_THRESHOLD - 0.04) {
        bestSim = sim;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      const wc = working[bestIdx];
      wc.members.push(s);
      wc.photoKeys.add(s.baseKey);
      const n = wc.members.length;
      const next = new Float32Array(wc.centroid.length);
      let norm = 0;
      for (let d = 0; d < next.length; d++) {
        next[d] = (wc.centroid[d] * (n - 1) + s.embedding[d]) / n;
        norm += next[d] * next[d];
      }
      norm = Math.sqrt(norm) + 1e-6;
      for (let d = 0; d < next.length; d++) next[d] /= norm;
      wc.centroid = next;
    } else {
      working.push({
        centroid: new Float32Array(s.embedding),
        members: [s],
        photoKeys: new Set([s.baseKey]),
      });
    }
  }

  // 동일인이 선글라스·맨얼굴·연도 차이로 2~3개 칸에 나뉜 경우 재병합
  // 단, 같은 커플/단체 사진에 동반 등장한 인물(photoKeys 교집합 존재)은 100% 타인이므로 절대 병합하지 않고,
  // 중심 유사도(0.42)와 상위 3쌍 평균 유사도(0.45)를 동시에 만족할 때만 병합합니다.
  let mergedAny = true;
  while (mergedAny && working.length > 1) {
    mergedAny = false;
    let bestI = -1;
    let bestJ = -1;
    let bestPairSim = MERGE_CENTROID_THRESHOLD;
    for (let i = 0; i < working.length; i++) {
      for (let j = i + 1; j < working.length; j++) {
        if (hasPhotoOverlap(working[i].photoKeys, working[j].photoKeys)) continue;
        const pairSim = dot(working[i].centroid, working[j].centroid);
        if (pairSim <= bestPairSim) continue;
        const top3Mean = computeTop3CrossPairMean(working[i].members, working[j].members);
        if (top3Mean >= MERGE_TOP3_PAIR_THRESHOLD) {
          bestPairSim = pairSim;
          bestI = i;
          bestJ = j;
        }
      }
    }
    if (bestI >= 0 && bestJ >= 0) {
      const a = working[bestI];
      const b = working[bestJ];
      const combinedMembers = [...a.members, ...b.members];
      const next = new Float32Array(a.centroid.length);
      let norm = 0;
      for (let d = 0; d < next.length; d++) {
        next[d] = (a.centroid[d] * a.members.length + b.centroid[d] * b.members.length) / combinedMembers.length;
        norm += next[d] * next[d];
      }
      norm = Math.sqrt(norm) + 1e-6;
      for (let d = 0; d < next.length; d++) next[d] /= norm;
      a.members = combinedMembers;
      for (const k of b.photoKeys) a.photoKeys.add(k);
      a.centroid = next;
      working.splice(bestJ, 1);
      mergedAny = true;
    }
  }

  working.sort((a, b) => b.members.length - a.members.length);
  const topWorking = working.slice(0, MAX_CLUSTERS);
  const usedClusterIds = new Set<string>();

  let latestCorpusYear = new Date().getFullYear();
  const allYears = samples.map((s) => s.year).filter((y) => y >= 1980);
  if (allYears.length > 0) latestCorpusYear = Math.max(...allYears);

  const clusters: FaceMemberCluster[] = topWorking.map((wc, idx) => {
    // 같은 사진 및 동명 파일(다른 폴더의 복사본) 중복 제거 후 정면·선명도 순 정렬
    const byPhoto = new Map<string, ExtractedFaceSample>();
    for (const m of wc.members) {
      const prev = byPhoto.get(m.baseKey);
      if (!prev || m.frontalScore > prev.frontalScore) {
        byPhoto.set(m.baseKey, m);
      }
    }
    const uniqueSamples = Array.from(byPhoto.values()).sort(
      (a, b) => b.frontalScore * 100 + b.sharpness - (a.frontalScore * 100 + a.sharpness)
    );
    const rep = uniqueSamples[0];

    // 연도별 베스트 컷 (1차: 서로 다른 촬영 연도별로 대표 1장씩 우선 배분 ➔ 2차: 남는 슬롯에 연도당 최대 2장까지 추가, 시각 중복 dot > 0.86 배제)
    const cutsByYear = new Map<number, ExtractedFaceSample[]>();
    const selectedCutSamples: ExtractedFaceSample[] = [];
    for (const u of uniqueSamples) {
      if (selectedCutSamples.length >= MAX_CUTS_PER_CLUSTER) break;
      if (cutsByYear.has(u.year)) continue;
      if (selectedCutSamples.some((prev) => dot(u.embedding, prev.embedding) > 0.86)) continue;
      cutsByYear.set(u.year, [u]);
      selectedCutSamples.push(u);
    }
    if (selectedCutSamples.length < MAX_CUTS_PER_CLUSTER) {
      for (const u of uniqueSamples) {
        if (selectedCutSamples.length >= MAX_CUTS_PER_CLUSTER) break;
        if (selectedCutSamples.includes(u)) continue;
        if (selectedCutSamples.some((prev) => dot(u.embedding, prev.embedding) > 0.86)) continue;
        const arr = cutsByYear.get(u.year) || [];
        if (arr.length < 2) {
          arr.push(u);
          cutsByYear.set(u.year, arr);
          selectedCutSamples.push(u);
        }
      }
    }
    const yearlyBestCuts: YearlyFaceBestCut[] = Array.from(cutsByYear.entries())
      .sort((a, b) => b[0] - a[0])
      .flatMap(([, arr]) => arr)
      .slice(0, MAX_CUTS_PER_CLUSTER)
      .map((u, cutIdx) => ({
        year: u.year,
        representativePhoto: u.photo.name,
        representativeDate: u.dateStr,
        frontalScore: u.frontalScore,
        opticalSharpness: u.sharpness,
        avatarUrl: u.avatarDataUrl,
        cropUrl: u.avatarDataUrl,
        boundingBox: u.boundingBox,
        conditionTag: cutIdx === 0 ? '정면·선명' : '측면·미소',
        conditionShortKo: cutIdx === 0 ? '정면' : '자연',
      }));

    // 기존 등록 정보 보존 (같은 단체 사진에 찍힌 다른 가족과 절대 섞이지 않도록 대표 사진 + 얼굴 중심 좌표까지 일치할 때만 승계)
    const matchedExisting = existingClusters.find((ec) => {
      if (!ec?.clusterId || usedClusterIds.has(ec.clusterId)) return false;
      if (!ec.representativePhoto || !ec.boundingBox) return false;
      const ecCy = (ec.boundingBox[0] + ec.boundingBox[2]) * 0.5;
      const ecCx = (ec.boundingBox[1] + ec.boundingBox[3]) * 0.5;
      return uniqueSamples.some((u) => {
        if (u.photo.name !== ec.representativePhoto) return false;
        const uCy = (u.boundingBox[0] + u.boundingBox[2]) * 0.5;
        const uCx = (u.boundingBox[1] + u.boundingBox[3]) * 0.5;
        return Math.abs(uCx - ecCx) < 120 && Math.abs(uCy - ecCy) < 120;
      });
    });

    const matchedPhotoFiles = uniqueSamples.map((u) => u.photo.name);
    const seedDates = Array.from(new Set(uniqueSamples.map((u) => u.dateStr))).slice(0, 8);
    // 부부·가족이 같은 사진에 함께 찍혀 있어도 100% 서로 다른 고유 clusterId를 갖도록 대표 사진 + 대표 얼굴 좌표 조합 및 중복 방지 보장
    const repPhotoClean = String(rep.photo.name || `face${idx}`)
      .replace(/[^0-9A-Za-z가-힣_-]/g, '')
      .slice(0, 20);
    const repBy = Math.round((rep.boundingBox[0] + rep.boundingBox[2]) / 40);
    const repBx = Math.round((rep.boundingBox[1] + rep.boundingBox[3]) / 40);
    let candidateId = matchedExisting?.clusterId || `ondevice_face_${repPhotoClean}_b${repBy}_${repBx}`;
    if (usedClusterIds.has(candidateId)) {
      candidateId = `ondevice_face_${repPhotoClean}_b${repBy}_${repBx}_p${idx + 1}`;
    }
    usedClusterIds.add(candidateId);
    const clusterId = candidateId;

    return {
      clusterId,
      personKey: matchedExisting?.personKey || `person_${idx + 1}`,
      registeredName: matchedExisting?.registeredName || '',
      relationshipTag: matchedExisting?.relationshipTag || '',
      suggestedChip: idx === 0 ? '나' : `인물 ${idx + 1}`,
      roleHintKo: idx === 0 ? '가장 많이 등장한 얼굴' : `함께 자주 등장한 얼굴 ${idx + 1}`,
      appearanceLabelKo: `${matchedPhotoFiles.length}장 등장`,
      isPasserbyCandidate: matchedPhotoFiles.length === 1 && idx >= 4,
      excludedAsPasserby: Boolean(matchedExisting?.excludedAsPasserby),
      representativePhoto: rep.photo.name,
      representativeYear: rep.year,
      representativeDate: rep.dateStr,
      frontalScore: rep.frontalScore,
      opticalSharpness: rep.sharpness,
      avatarUrl: rep.avatarDataUrl,
      cropUrl: rep.avatarDataUrl,
      boundingBox: rep.boundingBox,
      yearlyBestCuts,
      detectedSampleCount: wc.members.length,
      matchedPhotoCount: matchedPhotoFiles.length,
      matchedPhotoFiles,
      matchedVideoSegmentCount: 0,
      matchedVideoSegments: [],
      seedDates,
      seedVecPreview: Array.from(wc.centroid.slice(0, 8)).map((v) => +v.toFixed(4)),
    };
  });

  return { clusters, latestCorpusYear };
}

/**
 * 실사진 배열에서 온디바이스 YuNet(232KB) Web Worker로 얼굴을 추출·클러스터링합니다.
 */
export async function runOnDeviceFacePassportScan(
  photos: PhotoItem[],
  existingClusters: FaceMemberCluster[] = [],
  forceRescan = false,
  onInterimClusters?: (clusters: FaceMemberCluster[], latestCorpusYear: number) => void
): Promise<{ clusters: FaceMemberCluster[]; latestCorpusYear: number }> {
  if (typeof window === 'undefined' || typeof Worker === 'undefined' || photos.length === 0) {
    return { clusters: existingClusters, latestCorpusYear: new Date().getFullYear() };
  }

  const fp = buildPhotosFingerprint(photos);
  if (!forceRescan && fp && fp === lastScannedFingerprint && existingClusters.length > 0) {
    return { clusters: existingClusters, latestCorpusYear: new Date().getFullYear() };
  }

  const cached = loadCachedOnDeviceFaceClusters();
  const hasQualifiedCache = cached.clusters.some((c) => !c.excludedAsPasserby && (c.matchedPhotoCount || 0) >= 3);
  if (!forceRescan && hasQualifiedCache && cached.fingerprint === fp) {
    lastScannedFingerprint = fp;
    return { clusters: cached.clusters, latestCorpusYear: cached.latestCorpusYear };
  }

  if (activeScanPromise) {
    const res = await activeScanPromise;
    return { clusters: res, latestCorpusYear: new Date().getFullYear() };
  }

  // 비격리 + 비스크린샷 + 비영수증 + 비흐림 + 비시스템임시/AI작업 실사진 우선 선별
  const realUserPhotos = photos.filter(
    (p) =>
      p &&
      !p.quarantined &&
      p.thumbUrl &&
      p.trashCategory !== 'memo' &&
      p.trashCategory !== 'receipt' &&
      p.trashCategory !== 'document' &&
      p.trashCategory !== 'blurry' &&
      p.trashCategory !== 'screenshot' &&
      !p.isVaultDocument &&
      !NON_PORTRAIT_WORK_OR_TEMP_PATH_RX.test(p.fullPath || '') &&
      !NON_PORTRAIT_WORK_OR_TEMP_PATH_RX.test(p.name || '') &&
      !AI_OR_STOCK_IMAGE_NAME_RX.test(p.name || '') &&
      !SCREENSHOT_NAME_RX.test(p.name || '')
  );
  const basePool =
    realUserPhotos.length > 0
      ? realUserPhotos
      : photos.filter(
          (p) =>
            p &&
            !p.quarantined &&
            p.thumbUrl &&
            p.trashCategory !== 'memo' &&
            p.trashCategory !== 'receipt' &&
            p.trashCategory !== 'document' &&
            p.trashCategory !== 'blurry' &&
            !p.isVaultDocument &&
            !AI_OR_STOCK_IMAGE_NAME_RX.test(p.name || '')
        );
  const candidates = selectStratifiedFaceScanCandidates(basePool, MAX_SCAN_PHOTOS);

  if (candidates.length === 0) {
    return { clusters: existingClusters, latestCorpusYear: new Date().getFullYear() };
  }

  let latestYearOut = new Date().getFullYear();

  activeScanPromise = (async () => {
    const worker = new Worker(new URL('./facePassportWorker.ts', import.meta.url), {
      type: 'module',
    });
    let reqSeq = 1;
    const pending = new Map<
      number,
      { resolve: (payload: { faces?: WorkerDetectedFace[]; embeddingBuffer?: ArrayBuffer; ok: boolean }) => void; timer: number }
    >();

    worker.onmessage = (
      ev: MessageEvent<{ id: number; ok: boolean; faces?: WorkerDetectedFace[]; embeddingBuffer?: ArrayBuffer; error?: string }>
    ) => {
      const msg = ev.data;
      if (!msg || typeof msg.id !== 'number') return;
      if (!msg.ok && msg.error) {
        console.warn('[GhostiFacePassport] worker error:', msg.error);
      }
      const entry = pending.get(msg.id);
      if (!entry) return;
      window.clearTimeout(entry.timer);
      pending.delete(msg.id);
      entry.resolve(msg);
    };

    const detectInWorker = (
      bgr: Float32Array,
      origW: number,
      origH: number,
      scale: number,
      scoreThreshold = 0.82
    ): Promise<WorkerDetectedFace[]> =>
      new Promise((resolve) => {
        const id = reqSeq++;
        const timer = window.setTimeout(() => {
          pending.delete(id);
          resolve([]);
        }, 12000);
        pending.set(id, {
          resolve: (res) => resolve(Array.isArray(res.faces) ? res.faces : []),
          timer,
        });
        worker.postMessage(
          { id, type: 'detect', bgrBuffer: bgr.buffer, origW, origH, scale, scoreThreshold },
          [bgr.buffer]
        );
      });

    const embedInWorker = (faceBgr112: Float32Array): Promise<Float32Array | null> =>
      new Promise((resolve) => {
        const id = reqSeq++;
        const timer = window.setTimeout(() => {
          pending.delete(id);
          resolve(null);
        }, 12000);
        pending.set(id, {
          resolve: (res) =>
            resolve(res.ok && res.embeddingBuffer ? new Float32Array(res.embeddingBuffer) : null),
          timer,
        });
        worker.postMessage({ id, type: 'embed', faceBgrBuffer: faceBgr112.buffer }, [faceBgr112.buffer]);
      });

    const inputCanvas = document.createElement('canvas');
    const inputCtx = inputCanvas.getContext('2d', { willReadFrequently: true });
    const rotCanvas = document.createElement('canvas');
    const rotCtx = rotCanvas.getContext('2d');
    const cropCanvas = document.createElement('canvas');
    const cropCtx = cropCanvas.getContext('2d');
    const featCanvas = document.createElement('canvas');
    const featCtx = featCanvas.getContext('2d', { willReadFrequently: true });

    const extracted: ExtractedFaceSample[] = [];
    try {
      if (!inputCtx || !rotCtx || !cropCtx || !featCtx) return existingClusters;

      for (let i = 0; i < candidates.length; i++) {
        // 백그라운드 탭에서도 스캔이 중단되지 않고 저부하로 끝까지 완주되도록 짧은 슬립만 부여
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          await new Promise<void>((r) => window.setTimeout(r, 40));
        }

        const photo = candidates[i];
        const img = await loadImageForFaceScan(photo.thumbUrl);
        if (!img) continue;

        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        // 세로로 극단적으로 긴 스마트폰 화면 캡처(9:19 비율 등) 배제
        if (Math.min(iw, ih) / Math.max(1, Math.max(iw, ih)) < 0.52) {
          continue;
        }

        let activeSource: ScanImageSource = img;
        const in0 = prepareYuNetInput(img, inputCanvas, inputCtx);
        let faces = await detectInWorker(in0.bgr, in0.origW, in0.origH, in0.scale, 0.80);
        const maxScore0 = faces.length > 0 ? faces[0].score : 0;

        // [무EXIF 회전 사진 정방향(0°) 자동 복원]:
        // 1) 상하반전(180°) 촬영본은 0°에서 미검출되거나 뒤집힌 얼굴로 저신뢰(<0.935) 오검출되어 타인끼리 한 줄에 뒤섞이므로 180° 정방향을 검증
        if (faces.length === 0 || maxScore0 < 0.935) {
          const src180 = drawRotatedSource(img, 180, rotCanvas, rotCtx);
          const in180 = prepareYuNetInput(src180, inputCanvas, inputCtx);
          const faces180 = await detectInWorker(in180.bgr, in180.origW, in180.origH, in180.scale, 0.84);
          const maxScore180 = faces180.length > 0 ? faces180[0].score : 0;
          if (maxScore180 >= 0.87 && maxScore180 > maxScore0 + 0.015) {
            activeSource = src180;
            faces = faces180;
          }
        }

        // 2) 0°와 180° 모두 얼굴이 없을 때만 시계 90° / 반시계 90°(270°) 측면 회전 촬영본을 정방향 복원
        if (faces.length === 0) {
          const src90 = drawRotatedSource(img, 90, rotCanvas, rotCtx);
          const in90 = prepareYuNetInput(src90, inputCanvas, inputCtx);
          const faces90 = await detectInWorker(in90.bgr, in90.origW, in90.origH, in90.scale, 0.86);
          const maxScore90 = faces90.length > 0 ? faces90[0].score : 0;

          const src270 = drawRotatedSource(img, 270, rotCanvas, rotCtx);
          const in270 = prepareYuNetInput(src270, inputCanvas, inputCtx);
          const faces270 = await detectInWorker(in270.bgr, in270.origW, in270.origH, in270.scale, 0.86);
          const maxScore270 = faces270.length > 0 ? faces270[0].score : 0;

          if (maxScore90 >= 0.88 && maxScore90 >= maxScore270) {
            activeSource = drawRotatedSource(img, 90, rotCanvas, rotCtx);
            faces = faces90;
          } else if (maxScore270 >= 0.88) {
            activeSource = src270;
            faces = faces270;
          }
        }

        if (faces.length === 0) continue;

        const { year, dateStr } = parsePhotoYearAndDate(photo);
        const baseKey = normalizePhotoBaseKey(photo.name);
        for (const f of faces) {
          const { avatarDataUrl, faceBgr112, sharpness, facePxW, isRealHumanFace } = prepareFaceCropAndBgr112(
            activeSource,
            f,
            cropCanvas,
            cropCtx,
            featCanvas,
            featCtx
          );
          if (!isRealHumanFace) continue;
          const embedding = await embedInWorker(faceBgr112);
          if (!embedding) continue;
          extracted.push({
            photo,
            baseKey,
            year,
            dateStr,
            score: f.score,
            frontalScore: f.frontalScore,
            facePxW,
            sharpness,
            boundingBox: [
              Math.round(f.y1 * 1000),
              Math.round(f.x1 * 1000),
              Math.round(f.y2 * 1000),
              Math.round(f.x2 * 1000),
            ],
            avatarDataUrl,
            embedding,
          });
        }

        // UI 반응성을 위해 매 4장마다 1프레임 양보
        if (i % 4 === 3) {
          await new Promise<void>((r) => window.setTimeout(r, 8));
        }

        // 중간 스트리밍 반영: 초기 20~40장 부분 결과로 여권 패널이 성급히 열려 가족 일부만 노출되는 레이스를 막기 위해
        // 충분한 다년도 표본(180장 이상)이 누적되었을 때만 1회 선반영
        if (onInterimClusters && i === 179 && candidates.length > 200 && extracted.length >= 6) {
          const interim = clusterExtractedFaces(extracted, existingClusters);
          if (interim.clusters.some((c) => (c.matchedPhotoCount || 0) >= 3)) {
            onInterimClusters(interim.clusters, interim.latestCorpusYear);
          }
        }
      }

      if (extracted.length === 0) {
        return existingClusters;
      }

      const { clusters, latestCorpusYear } = clusterExtractedFaces(extracted, existingClusters);
      latestYearOut = latestCorpusYear;
      lastScannedFingerprint = fp;
      saveCachedOnDeviceFaceClusters(clusters, latestCorpusYear, fp);
      return clusters;
    } finally {
      try {
        worker.postMessage({ id: reqSeq++, type: 'dispose' });
      } catch {
        /* ignore */
      }
      window.setTimeout(() => {
        try {
          worker.terminate();
        } catch {
          /* ignore */
        }
      }, 150);
    }
  })().finally(() => {
    activeScanPromise = null;
  });

  const clusters = await activeScanPromise;
  return { clusters, latestCorpusYear: latestYearOut };
}
