/**
 * [온디바이스 얼굴 여권 엔진 (PC · 모바일 · 웹 공통)]
 * - YuNet(232KB) 전용 Web Worker로 실사진에서 얼굴 좌표·정면도를 자동 검출
 * - 검출된 얼굴을 128x128 여권 아바타로 크롭하고, 조명정규화 구조+색감+그래디언트 벡터로
 *   동일 인물 클러스터링 및 연도별 베스트 컷(yearlyBestCuts)을 자동 구성합니다.
 * - 스캔 완료 즉시 워커를 종료해 백그라운드 RAM 점유를 0으로 유지합니다.
 */
import type { FaceMemberCluster, PhotoItem, YearlyFaceBestCut } from '../../types/saysee';
import type { WorkerDetectedFace } from './facePassportWorker';

const ONDEVICE_FACE_CACHE_KEY = 'ghosti_ondevice_face_clusters_v1';
const MAX_SCAN_PHOTOS = 100;
const MAX_CLUSTERS = 10;
const MAX_CUTS_PER_CLUSTER = 6;
const SIMILARITY_THRESHOLD = 0.78;

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
  const real = photos.filter((p) => p && !p.quarantined).slice(0, 60);
  if (real.length === 0) return '';
  const head = real.slice(0, 8).map((p) => p.name).join('|');
  const tail = real.slice(-4).map((p) => p.name).join('|');
  return `${photos.length}:${head}:${tail}`;
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

function extractCropAndEmbedding(
  img: HTMLImageElement,
  face: WorkerDetectedFace,
  cropCanvas: HTMLCanvasElement,
  cropCtx: CanvasRenderingContext2D,
  featCanvas: HTMLCanvasElement,
  featCtx: CanvasRenderingContext2D
): { avatarDataUrl: string; embedding: Float32Array; sharpness: number } {
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

  // 특징 벡터용 타이트 얼굴 영역 (16x16)
  featCanvas.width = 16;
  featCanvas.height = 16;
  featCtx.clearRect(0, 0, 16, 16);
  featCtx.drawImage(img, fx1, fy1, fw, fh, 0, 0, 16, 16);
  const data = featCtx.getImageData(0, 0, 16, 16).data;

  // 1) 12x12 중앙 그레이스케일 조명정규화 (144 dims)
  const gray16 = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    gray16[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  const vec = new Float32Array(144 + 48 + 16);
  let mean = 0;
  let k = 0;
  for (let y = 2; y < 14; y++) {
    for (let x = 2; x < 14; x++) {
      const v = gray16[y * 16 + x];
      vec[k++] = v;
      mean += v;
    }
  }
  mean /= 144;
  let std = 0;
  for (let i = 0; i < 144; i++) {
    const d = vec[i] - mean;
    std += d * d;
  }
  std = Math.sqrt(std / 144) + 1e-4;
  for (let i = 0; i < 144; i++) {
    vec[i] = ((vec[i] - mean) / std) * 0.85;
  }

  // 2) 4x4 블록별 RGB 상대색감 (48 dims) + Laplacian 선명도
  let sharpSum = 0;
  let off = 144;
  for (let by = 0; by < 4; by++) {
    for (let bx = 0; bx < 4; bx++) {
      let rS = 0;
      let gS = 0;
      let bS = 0;
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 4; dx++) {
          const idx = ((by * 4 + dy) * 16 + (bx * 4 + dx)) * 4;
          rS += data[idx];
          gS += data[idx + 1];
          bS += data[idx + 2];
        }
      }
      const tot = rS + gS + bS + 1e-3;
      vec[off++] = (rS / tot - 0.333) * 3.0;
      vec[off++] = (gS / tot - 0.333) * 3.0;
      vec[off++] = (bS / tot - 0.333) * 3.0;
    }
  }

  // 3) 4x4 그래디언트 강도 (16 dims)
  for (let by = 0; by < 4; by++) {
    for (let bx = 0; bx < 4; bx++) {
      let gMag = 0;
      for (let dy = 1; dy < 3; dy++) {
        for (let dx = 1; dx < 3; dx++) {
          const y = by * 4 + dy;
          const x = bx * 4 + dx;
          const gx = gray16[y * 16 + Math.min(15, x + 1)] - gray16[y * 16 + Math.max(0, x - 1)];
          const gy = gray16[Math.min(15, y + 1) * 16 + x] - gray16[Math.max(0, y - 1) * 16 + x];
          gMag += Math.sqrt(gx * gx + gy * gy);
        }
      }
      sharpSum += gMag;
      vec[off++] = (gMag / 400) * 0.7;
    }
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) + 1e-6;
  for (let i = 0; i < vec.length; i++) vec[i] /= norm;

  const sharpness = Math.min(99, Math.max(55, Math.round(55 + (sharpSum / 1800) * 44)));
  return { avatarDataUrl, embedding: vec, sharpness };
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
      if (sim > bestSim) {
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
    // 같은 사진 중복 제거 후 정면·선명도 순 정렬
    const byPhoto = new Map<string, ExtractedFaceSample>();
    for (const m of wc.members) {
      const prev = byPhoto.get(m.photo.name);
      if (!prev || m.frontalScore > prev.frontalScore) {
        byPhoto.set(m.photo.name, m);
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

    const clusterId = matchedExisting?.clusterId || `ondevice_face_${idx + 1}_${rep.photo.name.slice(0, 18)}`;
    const matchedPhotoFiles = uniqueSamples.map((u) => u.photo.name);
    const seedDates = Array.from(new Set(uniqueSamples.map((u) => u.dateStr))).slice(0, 8);

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

  // 비격리 + 비스크린샷 + 비영수증 + 비흐림 실사진 우선 선별
  const candidates = photos
    .filter(
      (p) =>
        p &&
        !p.quarantined &&
        p.thumbUrl &&
        p.trashCategory !== 'memo' &&
        p.trashCategory !== 'receipt' &&
        p.trashCategory !== 'document' &&
        p.trashCategory !== 'blurry' &&
        !p.isVaultDocument
    )
    .sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0))
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
      { resolve: (faces: WorkerDetectedFace[]) => void; timer: number }
    >();

    worker.onmessage = (ev: MessageEvent<{ id: number; ok: boolean; faces?: WorkerDetectedFace[] }>) => {
      const msg = ev.data;
      if (!msg || typeof msg.id !== 'number') return;
      const entry = pending.get(msg.id);
      if (!entry) return;
      window.clearTimeout(entry.timer);
      pending.delete(msg.id);
      entry.resolve(Array.isArray(msg.faces) ? msg.faces : []);
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
        pending.set(id, { resolve, timer });
        worker.postMessage(
          { id, type: 'detect', bgrBuffer: bgr.buffer, origW, origH, scale, scoreThreshold: 0.72 },
          [bgr.buffer]
        );
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
          const { avatarDataUrl, embedding, sharpness } = extractCropAndEmbedding(
            img,
            f,
            cropCanvas,
            cropCtx,
            featCanvas,
            featCtx
          );
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
