/**
 * [온디바이스 얼굴 여권 엔진 (PC · 모바일 · 웹 공통)]
 * - YuNet(232KB) 전용 Web Worker로 실사진에서 얼굴 좌표·정면도를 자동 검출
 * - 검출된 얼굴을 128x128 여권 아바타로 크롭하고, 조명정규화 구조+색감+그래디언트 벡터로
 *   동일 인물 클러스터링 및 연도별 베스트 컷(yearlyBestCuts)을 자동 구성합니다.
 * - 스캔 완료 즉시 워커를 종료해 백그라운드 RAM 점유를 0으로 유지합니다.
 */
import type { FaceMemberCluster, PhotoItem, YearlyFaceBestCut } from '../../types/saysee';
import type { WorkerDetectedFace } from './facePassportWorker';

const ONDEVICE_FACE_CACHE_KEY = 'ghosti_ondevice_face_clusters_v5';
const MAX_SCAN_PHOTOS = 180;
const MAX_CLUSTERS = 10;
const MAX_CUTS_PER_CLUSTER = 6;
/** OpenCV SFace 공식 동일인 코사인 유사도 임계치(0.363) 기반 + 타인/이질 이미지 체이닝 방지(0.39) */
const SIMILARITY_THRESHOLD = 0.39;
const SCREENSHOT_NAME_RX = /(screenshot|스크린샷|캡처|capture|화면\s*캡처|영수증|receipt|memo|메모)/i;
/** AI 생성·스톡·웹 다운로드 이미지 판별 (실제 스마트폰/카메라 촬영 사진을 여권 스캔 시 최우선 배치하고 AI 이미지는 배제) */
const AI_OR_STOCK_IMAGE_NAME_RX =
  /(gemini_generated|chatgpt|midjourney|dall[-_]?e|stable[-_]?diffusion|comfyui|flux[-_]|stock_photo|unsplash|pexels|pixabay|freepik|shutterstock|gettyimages|ai_generated|generated_image|^image-\d{4,})/i;
/** 스마트폰·디지털카메라 표준 촬영 파일명 패턴 (예: 20240720_182301.jpg, IMG_1234.jpg, DSC_0001.jpg, PXL_..., KakaoTalk_...) */
const REAL_CAMERA_PHOTO_NAME_RX =
  /^(?:(?:19|20)\d{6}[_-]\d{4,6}|IMG[_-]|DSC[_N0-9]|DCIM|PXL[_-]|SAM[_-]|GOPR|DJI[_-]|KakaoTalk_\d{8}|Photo_\d|사진|\d{8}_\d{6})/i;
/** 코드 레포지토리·샘플 코퍼스·웹 번들 더미 사진이 실제 유저 PC 사진보다 앞서는 것을 원천 차단 */
const REPO_OR_SYNTHETIC_SAMPLE_PATH_RX =
  /(?:[\\/](?:ghosti|ghosti_test_corpus|sample_photos_301|test_photos|node_modules|public)[\\/]|^(?:IMG_2025|PET_2025|TRV_2025|DOC_2025|MEMO_2025|Screenshot_2025|BLUR_2025))/i;
/** 실제 사람 피부톤 최소 비율 (카툰·초록/파란 캐릭터·인형·풍경 오탐 차단) */
const MIN_HUMAN_SKIN_RATIO = 0.14;

interface CachedFaceStore {
  fingerprint: string;
  updatedAt: number;
  latestCorpusYear: number;
  clusters: FaceMemberCluster[];
}

interface ExtractedFaceSample {
  photo: PhotoItem;
  year: number;
  dateStr: string;
  score: number;
  frontalScore: number;
  sharpness: number;
  boundingBox: [number, number, number, number];
  avatarDataUrl: string;
  embedding: Float32Array;
}

let activeScanPromise: Promise<FaceMemberCluster[]> | null = null;
let lastScannedFingerprint = '';

function buildPhotosFingerprint(photos: PhotoItem[]): string {
  const real = photos
    .filter(
      (p) =>
        p &&
        !p.quarantined &&
        !REPO_OR_SYNTHETIC_SAMPLE_PATH_RX.test(p.fullPath || '') &&
        !REPO_OR_SYNTHETIC_SAMPLE_PATH_RX.test(p.name || '') &&
        !AI_OR_STOCK_IMAGE_NAME_RX.test(p.name || '')
    )
    .slice(0, 60);
  if (real.length === 0) return '';
  const head = real.slice(0, 8).map((p) => p.name).join('|');
  const tail = real.slice(-4).map((p) => p.name).join('|');
  return `v5:${real.length}:${head}:${tail}`;
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
  const dateRaw = String(photo.date || '').trim();
  const dm = dateRaw.match(/(19\d{2}|20\d{2})[-./]?(\d{2})?[-./]?(\d{2})?/);
  if (dm) {
    const y = Math.min(nowYear, Math.max(1980, Number(dm[1])));
    const m = dm[2] || '01';
    const d = dm[3] || '01';
    return { year: y, dateStr: `${y}-${m}-${d}` };
  }
  const nm = String(photo.name || '').match(/(19\d{2}|20\d{2})(\d{2})(\d{2})/);
  if (nm) {
    const y = Math.min(nowYear, Math.max(1980, Number(nm[1])));
    return { year: y, dateStr: `${y}-${nm[2]}-${nm[3]}` };
  }
  if (photo.mtimeMs && photo.mtimeMs > 946684800000) {
    const dt = new Date(photo.mtimeMs);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return { year: y, dateStr: `${y}-${m}-${d}` };
  }
  return { year: nowYear, dateStr: `${nowYear}-01-01` };
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

function prepareYuNetInput(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): { bgr: Float32Array; origW: number; origH: number; scale: number } {
  const origW = img.naturalWidth;
  const origH = img.naturalHeight;
  const scale = Math.min(640 / origW, 640 / origH);
  const nw = Math.max(1, Math.round(origW * scale));
  const nh = Math.max(1, Math.round(origH * scale));

  canvas.width = 640;
  canvas.height = 640;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 640, 640);
  ctx.drawImage(img, 0, 0, nw, nh);

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
  img: HTMLImageElement,
  face: WorkerDetectedFace,
  cropCanvas: HTMLCanvasElement,
  cropCtx: CanvasRenderingContext2D,
  sfaceCanvas: HTMLCanvasElement,
  sfaceCtx: CanvasRenderingContext2D
): { avatarDataUrl: string; faceBgr112: Float32Array; sharpness: number; isRealHumanFace: boolean } {
  const ow = img.naturalWidth;
  const oh = img.naturalHeight;
  const fx1 = face.x1 * ow;
  const fy1 = face.y1 * oh;
  const fw = Math.max(8, (face.x2 - face.x1) * ow);
  const fh = Math.max(8, (face.y2 - face.y1) * oh);

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
  cropCtx.drawImage(img, sx, sy, sw, sh, 0, 0, 128, 128);
  const avatarDataUrl = cropCanvas.toDataURL('image/jpeg', 0.72);

  // SFace int8 112x112 입력용 타이트 얼굴 정사각형 크롭 (약간 15% 여유)
  const sSide = Math.max(fw, fh) * 1.15;
  const ssx = Math.max(0, Math.min(ow - 1, cx - sSide * 0.5));
  const ssy = Math.max(0, Math.min(oh - 1, cy - sSide * 0.5));
  const ssw = Math.max(8, Math.min(ow - ssx, sSide));
  const ssh = Math.max(8, Math.min(oh - ssy, sSide));

  sfaceCanvas.width = 112;
  sfaceCanvas.height = 112;
  sfaceCtx.clearRect(0, 0, 112, 112);
  sfaceCtx.drawImage(img, ssx, ssy, ssw, ssh, 0, 0, 112, 112);
  const rgba = sfaceCtx.getImageData(0, 0, 112, 112).data;

  const plane = 112 * 112;
  const faceBgr112 = new Float32Array(3 * plane);
  let gradSum = 0;
  let coreTotal = 0;
  let skinPixels = 0;
  let nonHumanColorPixels = 0;

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

    // 얼굴 중심 영역(볼·코·입 주변 60% 코어) 피부색 vs 초록/파랑/원색 캐릭터 검증
    const row = Math.floor(i / 112);
    const col = i - row * 112;
    if (row >= 22 && row <= 92 && col >= 22 && col <= 90) {
      coreTotal++;
      // YCbCr 변환 (ITU-R BT.601)
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      // 자연 조명·실내외·선글라스·역광을 포괄하는 실제 사람 피부색 범위 (R >= G >= B 계열 + Cr > Cb)
      const isNaturalSkin =
        r > 55 &&
        g > 32 &&
        b > 15 &&
        r >= g - 6 &&
        r > b + 8 &&
        cr >= 131 &&
        cr <= 178 &&
        cb >= 74 &&
        cb <= 132;
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
  const isRealHumanFace = skinRatio >= MIN_HUMAN_SKIN_RATIO && nonHumanRatio < 0.28 && skinRatio > nonHumanRatio;
  const sharpness = Math.min(99, Math.max(55, Math.round(55 + (gradSum / 35000) * 44)));
  return { avatarDataUrl, faceBgr112, sharpness, isRealHumanFace };
}

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) s += a[i] * b[i];
  return s;
}

function clusterExtractedFaces(
  samples: ExtractedFaceSample[],
  existingClusters: FaceMemberCluster[]
): { clusters: FaceMemberCluster[]; latestCorpusYear: number } {
  interface WorkingCluster {
    centroid: Float32Array;
    members: ExtractedFaceSample[];
  }
  const working: WorkingCluster[] = [];

  for (const s of samples) {
    let bestIdx = -1;
    let bestSim = SIMILARITY_THRESHOLD;
    for (let i = 0; i < working.length; i++) {
      const sim = dot(s.embedding, working[i].centroid);
      // 클러스터 대표(첫 번째) 샘플과의 최소 유사도도 함께 검증해 점진적 평균 이동(drift)에 의한 엉뚱한 인물 합류 차단
      const seedSim = dot(s.embedding, working[i].members[0].embedding);
      if (sim > bestSim && seedSim >= SIMILARITY_THRESHOLD - 0.03) {
        bestSim = sim;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      const wc = working[bestIdx];
      wc.members.push(s);
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
      });
    }
  }

  working.sort((a, b) => b.members.length - a.members.length);
  const topWorking = working.slice(0, MAX_CLUSTERS);
  const existingByPhoto = new Map<string, FaceMemberCluster>();
  for (const ec of existingClusters) {
    if (ec.representativePhoto) existingByPhoto.set(ec.representativePhoto, ec);
    for (const f of ec.matchedPhotoFiles || []) {
      if (!existingByPhoto.has(f)) existingByPhoto.set(f, ec);
    }
  }

  let latestCorpusYear = new Date().getFullYear();
  const allYears = samples.map((s) => s.year).filter((y) => y >= 1980);
  if (allYears.length > 0) latestCorpusYear = Math.max(...allYears);

  const clusters: FaceMemberCluster[] = topWorking.map((wc, idx) => {
    // 같은 사진 및 동명 파일(다른 폴더의 복사본) 중복 제거 후 정면·선명도 순 정렬
    const byPhoto = new Map<string, ExtractedFaceSample>();
    for (const m of wc.members) {
      const baseKey = String(m.photo.name || '')
        .replace(/__[0-9A-Za-z가-힣_-]{1,18}_[0-9a-f]{6}(?=\.[^.]+$)/i, '')
        .toLowerCase();
      const prev = byPhoto.get(baseKey);
      if (!prev || m.frontalScore > prev.frontalScore) {
        byPhoto.set(baseKey, m);
      }
    }
    const uniqueSamples = Array.from(byPhoto.values()).sort(
      (a, b) => b.frontalScore * 100 + b.sharpness - (a.frontalScore * 100 + a.sharpness)
    );
    const rep = uniqueSamples[0];

    // 연도별 베스트 컷 (연도당 최대 2장, 전체 최대 6장)
    const cutsByYear = new Map<number, ExtractedFaceSample[]>();
    for (const u of uniqueSamples) {
      const arr = cutsByYear.get(u.year) || [];
      if (arr.length < 2) {
        arr.push(u);
        cutsByYear.set(u.year, arr);
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

    // 기존 등록 정보 보존
    const matchedExisting =
      existingByPhoto.get(rep.photo.name) ||
      uniqueSamples.map((u) => existingByPhoto.get(u.photo.name)).find(Boolean);

    const matchedPhotoFiles = uniqueSamples.map((u) => u.photo.name);
    const seedDates = Array.from(new Set(uniqueSamples.map((u) => u.dateStr))).slice(0, 8);
    // 새로고침(F5) 후 재스캔되어도 동일 인물 사진 묶음이 항상 동일한 clusterId를 유지하도록 결정론적 키 부여
    const stablePhotoKey = matchedPhotoFiles
      .slice()
      .sort()[0]
      .replace(/[^0-9A-Za-z가-힣_-]/g, '')
      .slice(0, 24);
    const clusterId = matchedExisting?.clusterId || `ondevice_face_${stablePhotoKey}`;

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
  forceRescan = false
): Promise<{ clusters: FaceMemberCluster[]; latestCorpusYear: number }> {
  if (typeof window === 'undefined' || typeof Worker === 'undefined' || photos.length === 0) {
    return { clusters: existingClusters, latestCorpusYear: new Date().getFullYear() };
  }

  const fp = buildPhotosFingerprint(photos);
  if (!forceRescan && fp && fp === lastScannedFingerprint && existingClusters.length > 0) {
    return { clusters: existingClusters, latestCorpusYear: new Date().getFullYear() };
  }

  const cached = loadCachedOnDeviceFaceClusters();
  if (!forceRescan && cached.clusters.length > 0 && cached.fingerprint === fp) {
    lastScannedFingerprint = fp;
    return { clusters: cached.clusters, latestCorpusYear: cached.latestCorpusYear };
  }

  if (activeScanPromise) {
    const res = await activeScanPromise;
    return { clusters: res, latestCorpusYear: new Date().getFullYear() };
  }

  // 비격리 + 비스크린샷 + 비영수증 + 비흐림 + 비샘플레포 + 비AI생성 실사진 우선 선별
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
      !REPO_OR_SYNTHETIC_SAMPLE_PATH_RX.test(p.fullPath || '') &&
      !REPO_OR_SYNTHETIC_SAMPLE_PATH_RX.test(p.name || '') &&
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
  const candidates = basePool
    .sort((a, b) => {
      // 1순위: 스마트폰·카메라 표준 촬영 파일(20240720_..., IMG_..., KakaoTalk_...)
      const aCam = REAL_CAMERA_PHOTO_NAME_RX.test(a.name) && /\.jpe?g$/i.test(a.name) ? 0 : 1;
      const bCam = REAL_CAMERA_PHOTO_NAME_RX.test(b.name) && /\.jpe?g$/i.test(b.name) ? 0 : 1;
      if (aCam !== bCam) return aCam - bCam;
      // 2순위: 일반 JPEG vs PNG/스크린샷
      const aScreen = SCREENSHOT_NAME_RX.test(a.name) || /\.png$/i.test(a.name) ? 1 : 0;
      const bScreen = SCREENSHOT_NAME_RX.test(b.name) || /\.png$/i.test(b.name) ? 1 : 0;
      if (aScreen !== bScreen) return aScreen - bScreen;
      return (b.mtimeMs || 0) - (a.mtimeMs || 0);
    })
    .slice(0, MAX_SCAN_PHOTOS);

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
      scale: number
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
          { id, type: 'detect', bgrBuffer: bgr.buffer, origW, origH, scale, scoreThreshold: 0.62 },
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
    const cropCanvas = document.createElement('canvas');
    const cropCtx = cropCanvas.getContext('2d');
    const featCanvas = document.createElement('canvas');
    const featCtx = featCanvas.getContext('2d', { willReadFrequently: true });

    const extracted: ExtractedFaceSample[] = [];
    try {
      if (!inputCtx || !cropCtx || !featCtx) return existingClusters;

      for (let i = 0; i < candidates.length; i++) {
        // 백그라운드 탭에서는 잠시 양보 (Chrome 느림 경고 0%)
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          await new Promise<void>((r) => window.setTimeout(r, 400));
          if (document.visibilityState === 'hidden') break;
        }

        const photo = candidates[i];
        const img = await loadImageForFaceScan(photo.thumbUrl);
        if (!img) continue;

        const { bgr, origW, origH, scale } = prepareYuNetInput(img, inputCanvas, inputCtx);
        const faces = await detectInWorker(bgr, origW, origH, scale);
        if (faces.length === 0) continue;

        const { year, dateStr } = parsePhotoYearAndDate(photo);
        for (const f of faces) {
          const { avatarDataUrl, faceBgr112, sharpness, isRealHumanFace } = prepareFaceCropAndBgr112(
            img,
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
            year,
            dateStr,
            score: f.score,
            frontalScore: f.frontalScore,
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
