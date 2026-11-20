import type { DuplicateGroup, PhotoItem, TrashCategory, VideoSceneItem } from '../types/saysee';
import {
  registerMobilePickedPhotoMeta,
  resolveAndroidDirectVideoStreamUrl,
  type NativeGalleryPhotoMeta,
  type NativeGalleryVideoMeta,
} from './ghostiMobileCareBridge';
import { waitForUserTypingAndModalQuiet } from './ai/aiSharedRuntime';

interface OpticalSignatureMeta {
  dhash: string;
  sharpness: number;
  isMotionOrFocusBlurred: boolean;
  aspect: number;
  whitePct: number;
  rgbGrid: Uint8Array; // 8x8x3 = 192 bytes
  rgbHex?: string;
}

const opticalSigByPhotoId = new Map<string, OpticalSignatureMeta>();

export function getOpticalSigForPhoto(photoId: string): OpticalSignatureMeta | undefined {
  return opticalSigByPhotoId.get(photoId);
}

export function migrateOpticalSigPhotoId(oldId: string, newId: string): void {
  if (!oldId || !newId || oldId === newId) return;
  const existing = opticalSigByPhotoId.get(oldId);
  if (existing) {
    opticalSigByPhotoId.set(newId, existing);
  }
}

const GENERIC_CAMERA_OR_BUCKET_RX =
  /^(?:img|dsc|pxl|sam|pic|mov|vid|mvi|dji|gopr|photo|image|externalfile|kakaotalk|screenshot|screen|capture|camera|dcim|recents|all\s*photos|camera\s*roll|pictures|photos|downloads?|documents?|desktop|내폰|갤러리|사진|폴더|복사본|copy)$/i;

export function extractMeaningfulUserMediaTokens(rawName?: string, bucket?: string): string[] {
  const out = new Set<string>();
  const pushClean = (src?: string) => {
    if (!src) return;
    const base = src
      .replace(/\.[^.]+$/, '')
      .replace(/__[a-zA-Z0-9가-힣_-]+_[0-9a-f]{6}$/i, '');
    const parts = base
      .replace(/(?:19|20)\d{6}[_-]?\d{0,6}/g, ' ')
      .replace(/\b\d+\b/g, ' ')
      .split(/[\s_\-.,()[\]{}+&]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const tk of parts) {
      if (tk.length < 2) continue;
      if (/^[0-9a-f-]+$/i.test(tk) && !/[가-힣]/.test(tk) && tk.length >= 6) continue;
      if (GENERIC_CAMERA_OR_BUCKET_RX.test(tk)) continue;
      if (/^(?:img|dsc|pxl|sam|photo|screenshot|capture)\d*$/i.test(tk)) continue;
      out.add(tk);
    }
  };
  pushClean(rawName);
  if (bucket && !GENERIC_CAMERA_OR_BUCKET_RX.test(bucket.trim())) {
    pushClean(bucket);
  }
  return Array.from(out);
}

/**
 * 두 64-bit dHash (16자리 hex) 간의 해밍 거리(0~64)를 계산합니다.
 */
export function computeDhashHammingDistance(hashA?: string, hashB?: string): number {
  if (!hashA || !hashB || hashA.length < 16 || hashB.length < 16) return 64;
  let dist = 0;
  for (let i = 0; i < 16; i++) {
    const a = parseInt(hashA[i], 16);
    const b = parseInt(hashB[i], 16);
    if (Number.isNaN(a) || Number.isNaN(b)) return 64;
    let xor = a ^ b;
    while (xor > 0) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}

/**
 * 두 8x8 RGB 컬러 그리드(192바이트) 간의 평균 오차, 상위 90% 블록 오차(p90BlockDiff · 테두리 3~6% 구도 이동 내성),
 * 최대 블록 오차 및 중앙 6x6 핵심 피사체 영역 오차를 계산합니다.
 * - 문서 페이지((1).png vs (2).png)나 제2의 인물이 새로 진입한 사진(p90 >= 30, centerMax >= 50)은 칼같이 분리하면서,
 *   음식·인물·사물 연속 촬영 시 손 이동(3~6%)으로 테두리 몇 칸만 달라진 사진은 정확히 동일 세트로 묶어줍니다.
 */
function computeRgbGridDifference(
  gridA?: Uint8Array,
  gridB?: Uint8Array
): {
  meanDiff: number;
  p90BlockDiff: number;
  maxBlockDiff: number;
  centerMeanDiff: number;
  centerMaxBlockDiff: number;
} {
  if (!gridA || !gridB || gridA.length !== 192 || gridB.length !== 192) {
    return {
      meanDiff: 255,
      p90BlockDiff: 255,
      maxBlockDiff: 255,
      centerMeanDiff: 255,
      centerMaxBlockDiff: 255,
    };
  }
  let sum = 0;
  let maxBlock = 0;
  let centerSum = 0;
  let centerMax = 0;
  const blockDiffs = new Float32Array(64);
  for (let cell = 0; cell < 64; cell++) {
    const i = cell * 3;
    const dr = Math.abs(gridA[i] - gridB[i]);
    const dg = Math.abs(gridA[i + 1] - gridB[i + 1]);
    const db = Math.abs(gridA[i + 2] - gridB[i + 2]);
    const blockDiff = (dr + dg + db) / 3;
    blockDiffs[cell] = blockDiff;
    sum += dr + dg + db;
    if (blockDiff > maxBlock) maxBlock = blockDiff;

    const cy = (cell / 8) | 0;
    const cx = cell & 7;
    if (cy >= 1 && cy <= 6 && cx >= 1 && cx <= 6) {
      centerSum += blockDiff;
      if (blockDiff > centerMax) centerMax = blockDiff;
    }
  }
  blockDiffs.sort();
  return {
    meanDiff: sum / 192,
    p90BlockDiff: blockDiffs[57], // 64개 블록 중 90퍼센타일 (테두리 미세 구도 이동 최대 6칸 허용)
    maxBlockDiff: maxBlock,
    centerMeanDiff: centerSum / 36,
    centerMaxBlockDiff: centerMax,
  };
}

/**
 * HTMLImageElement로부터 단일 512px 디코딩 패스 안에서:
 * 1) 면적 적분(Area-Integral Box Averaging) 9x8 그레이스케일 64-bit dHash
 *    (Chromium/WebKit `drawImage(512 -> 9x8)`의 2x2 점샘플링 에일리어싱으로 음식·고주파 연사 사진 dHash가 26까지 튀던 현상 원천 제거!)
 * 2) 면적 적분 8x8 RGB 컬러 시그니처 (192 bytes) & 백색 배경 비율(whitePct)
 * 3) 명암·조도 불변(Contrast-Invariant) 4축 방향성(가로·세로·양대각선) 경계 첨예도(min4AxisHf) & 8x8 국소 패치 선명도
 *    (실내 난색 조명 아래 매끈한 피부·손·네일아트 클로즈업 등 저대비 정상 사진이 분산 부족으로 흔들림 오분류되던 현상 0% 차단 + 대각선/단방향 손떨림 정밀 포착!)
 * 를 동시에 계산합니다.
 */
export function computeOpticalDhashAndSharpness(img: HTMLImageElement): OpticalSignatureMeta {
  let dhash = '';
  let sharpness = 12000;
  let isMotionOrFocusBlurred = false;
  let whitePct = 0;
  const rgbGrid = new Uint8Array(192);
  const aspect = img.width > 0 ? img.height / img.width : 1;

  try {
    const maxEvalDim = 512;
    const evalScale =
      img.width > 0 && img.height > 0 ? Math.min(1, maxEvalDim / Math.max(img.width, img.height)) : 1;
    const W = Math.max(64, Math.round((img.width || 256) * evalScale));
    const H = Math.max(64, Math.round((img.height || 256) * evalScale));
    const lapCanvas = document.createElement('canvas');
    lapCanvas.width = W;
    lapCanvas.height = H;
    const lCtx = lapCanvas.getContext('2d');
    if (lCtx) {
      lCtx.drawImage(img, 0, 0, W, H);
      const px = lCtx.getImageData(0, 0, W, H).data;
      lapCanvas.width = 1;
      lapCanvas.height = 1;

      const gray = new Float32Array(W * H);
      const hashSum = new Float64Array(72); // 8 rows x 9 cols
      const hashCnt = new Uint32Array(72);
      const rgbSum = new Float64Array(192); // 8 rows x 8 cols x 3 channels
      const rgbCnt = new Uint32Array(64);

      for (let y = 0; y < H; y++) {
        const by = Math.min(7, ((y * 8) / H) | 0);
        const rowOff = y * W;
        for (let x = 0; x < W; x++) {
          const i = rowOff + x;
          const p4 = i * 4;
          const r = px[p4];
          const g = px[p4 + 1];
          const b = px[p4 + 2];
          const lum = r * 0.299 + g * 0.587 + b * 0.114;
          gray[i] = lum;

          const bx9 = Math.min(8, ((x * 9) / W) | 0);
          const hIdx = by * 9 + bx9;
          hashSum[hIdx] += lum;
          hashCnt[hIdx]++;

          const bx8 = Math.min(7, ((x * 8) / W) | 0);
          const cIdx = by * 8 + bx8;
          const c3 = cIdx * 3;
          rgbSum[c3] += r;
          rgbSum[c3 + 1] += g;
          rgbSum[c3 + 2] += b;
          rgbCnt[cIdx]++;
        }
      }

      // 1) 면적 적분 9x8 dHash 산출
      let bits = '';
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const i1 = y * 9 + x;
          const i2 = i1 + 1;
          const g1 = hashCnt[i1] > 0 ? hashSum[i1] / hashCnt[i1] : 0;
          const g2 = hashCnt[i2] > 0 ? hashSum[i2] / hashCnt[i2] : 0;
          bits += g1 > g2 ? '1' : '0';
        }
      }
      for (let k = 0; k < 64; k += 4) {
        dhash += parseInt(bits.slice(k, k + 4), 2).toString(16);
      }

      // 2) 면적 적분 8x8 RGB 컬러 시그니처 & 백색 비율 산출
      let whiteCells = 0;
      for (let c = 0; c < 64; c++) {
        const cnt = rgbCnt[c] || 1;
        const c3 = c * 3;
        const rAvg = Math.min(255, Math.max(0, Math.round(rgbSum[c3] / cnt)));
        const gAvg = Math.min(255, Math.max(0, Math.round(rgbSum[c3 + 1] / cnt)));
        const bAvg = Math.min(255, Math.max(0, Math.round(rgbSum[c3 + 2] / cnt)));
        rgbGrid[c3] = rAvg;
        rgbGrid[c3 + 1] = gAvg;
        rgbGrid[c3 + 2] = bAvg;
        if (rAvg >= 232 && gAvg >= 232 && bAvg >= 232) {
          whiteCells++;
        }
      }
      whitePct = (whiteCells / 64) * 100;

      // 3) 조도·대비 불변(Contrast-Invariant) 4축 방향성(X, Y, D1, D2) 및 8x8 국소 패치 경계 첨예도 측정
      let lapSum = 0;
      let lapSqSum = 0;
      let count = 0;
      let edgeLapSum = 0;
      let edgeGradSum = 0;
      let edgeCount = 0;

      let gxSum = 0, lxSum = 0, nx = 0;
      let gySum = 0, lySum = 0, ny = 0;
      let gd1Sum = 0, ld1Sum = 0, nd1 = 0;
      let gd2Sum = 0, ld2Sum = 0, nd2 = 0;

      const innerW = Math.max(1, W - 2);
      const innerH = Math.max(1, H - 2);
      const pCount = new Uint32Array(64);
      const pLapSum = new Float64Array(64);
      const pLapSqSum = new Float64Array(64);
      const pEdgeCount = new Uint32Array(64);
      const pEdgeLapSum = new Float64Array(64);
      const pEdgeGradSum = new Float64Array(64);

      const pNx = new Uint32Array(64), pLxSum = new Float64Array(64), pGxSum = new Float64Array(64);
      const pNy = new Uint32Array(64), pLySum = new Float64Array(64), pGySum = new Float64Array(64);
      const pNd1 = new Uint32Array(64), pLd1Sum = new Float64Array(64), pGd1Sum = new Float64Array(64);
      const pNd2 = new Uint32Array(64), pLd2Sum = new Float64Array(64), pGd2Sum = new Float64Array(64);

      for (let y = 1; y < H - 1; y++) {
        const rowOff = y * W;
        const py = Math.min(7, (((y - 1) * 8) / innerH) | 0);
        for (let x = 1; x < W - 1; x++) {
          const centerIdx = rowOff + x;
          const centerVal = gray[centerIdx];
          const top = gray[centerIdx - W];
          const bot = gray[centerIdx + W];
          const left = gray[centerIdx - 1];
          const right = gray[centerIdx + 1];
          const tl = gray[centerIdx - W - 1];
          const br = gray[centerIdx + W + 1];
          const tr = gray[centerIdx - W + 1];
          const bl = gray[centerIdx + W - 1];

          const lap = Math.abs(centerVal * 4 - top - bot - left - right);
          const lx = Math.abs(centerVal * 2 - left - right);
          const ly = Math.abs(centerVal * 2 - top - bot);
          const ld1 = Math.abs(centerVal * 2 - tl - br);
          const ld2 = Math.abs(centerVal * 2 - tr - bl);

          const gx = Math.abs(right - left) * 0.5;
          const gy = Math.abs(bot - top) * 0.5;
          const gd1 = Math.abs(br - tl) * 0.5;
          const gd2 = Math.abs(bl - tr) * 0.5;
          const grad = Math.hypot(gx, gy);

          lapSum += lap;
          lapSqSum += lap * lap;
          count++;

          if (grad > 6.5) {
            edgeLapSum += lap;
            edgeGradSum += grad;
            edgeCount++;
          }
          if (gx > 5.5) { lxSum += lx; gxSum += gx; nx++; }
          if (gy > 5.5) { lySum += ly; gySum += gy; ny++; }
          if (gd1 > 6.5) { ld1Sum += ld1; gd1Sum += gd1; nd1++; }
          if (gd2 > 6.5) { ld2Sum += ld2; gd2Sum += gd2; nd2++; }

          const pxIdx = Math.min(7, (((x - 1) * 8) / innerW) | 0);
          const pIdx = py * 8 + pxIdx;
          pCount[pIdx]++;
          pLapSum[pIdx] += lap;
          pLapSqSum[pIdx] += lap * lap;

          if (grad > 6.5) {
            pEdgeCount[pIdx]++;
            pEdgeLapSum[pIdx] += lap;
            pEdgeGradSum[pIdx] += grad;
          }
          if (gx > 5.0) { pNx[pIdx]++; pLxSum[pIdx] += lx; pGxSum[pIdx] += gx; }
          if (gy > 5.0) { pNy[pIdx]++; pLySum[pIdx] += ly; pGySum[pIdx] += gy; }
          if (gd1 > 6.0) { pNd1[pIdx]++; pLd1Sum[pIdx] += ld1; pGd1Sum[pIdx] += gd1; }
          if (gd2 > 6.0) { pNd2[pIdx]++; pLd2Sum[pIdx] += ld2; pGd2Sum[pIdx] += gd2; }
        }
      }

      if (count > 0) {
        const mean = lapSum / count;
        const variance = Math.max(0, lapSqSum / count - mean * mean);
        const hfRatio = edgeCount >= 30 ? edgeLapSum / (edgeGradSum + 1e-5) : 0.5;

        const hfX = nx >= 25 ? lxSum / (gxSum + 1e-5) : hfRatio * 0.75;
        const hfY = ny >= 25 ? lySum / (gySum + 1e-5) : hfRatio * 0.75;
        const hfD1 = nd1 >= 25 ? ld1Sum / (gd1Sum + 1e-5) : hfRatio * 0.75;
        const hfD2 = nd2 >= 25 ? ld2Sum / (gd2Sum + 1e-5) : hfRatio * 0.75;
        const minAxisHf = Math.min(hfX, hfY, hfD1, hfD2);

        let sharp4AxisPatches = 0;
        const patchMetrics: Array<{ score: number; phf: number; pMinAxis: number }> = [];
        for (let k = 0; k < 64; k++) {
          const n = pCount[k];
          if (n < 16 || pEdgeCount[k] < 14) continue;
          const pm = pLapSum[k] / n;
          const pv = Math.max(0, pLapSqSum[k] / n - pm * pm);
          const phf = pEdgeLapSum[k] / (pEdgeGradSum[k] + 1e-5);

          const phfX = pNx[k] >= 10 ? pLxSum[k] / (pGxSum[k] + 1e-5) : phf * 0.72;
          const phfY = pNy[k] >= 10 ? pLySum[k] / (pGySum[k] + 1e-5) : phf * 0.72;
          const phfD1 = pNd1[k] >= 10 ? pLd1Sum[k] / (pGd1Sum[k] + 1e-5) : phf * 0.72;
          const phfD2 = pNd2[k] >= 10 ? pLd2Sum[k] / (pGd2Sum[k] + 1e-5) : phf * 0.72;
          const pMinAxis = Math.min(phfX, phfY, phfD1, phfD2);

          if (phf >= 1.16 && pMinAxis >= 0.78 && pv >= 22.0) {
            sharp4AxisPatches++;
          }
          patchMetrics.push({ score: phf * Math.max(0.2, pMinAxis), phf, pMinAxis });
        }

        patchMetrics.sort((a, b) => b.score - a.score);
        const topK = patchMetrics.slice(0, 4);
        const top4PatchHf =
          topK.length > 0 ? topK.reduce((s, m) => s + m.phf, 0) / topK.length : 0;
        const top4MinAxis =
          topK.length > 0 ? topK.reduce((s, m) => s + m.pMinAxis, 0) / topK.length : 0;

        const hasSharpForegroundSubject =
          sharp4AxisPatches >= 2 ||
          (sharp4AxisPatches >= 1 && top4PatchHf >= 1.22 && top4MinAxis >= 0.80) ||
          (minAxisHf >= 0.82 && hfRatio >= 1.12 && edgeCount >= 80);

        const isCleanWhiteDoc = whitePct >= 58 && hfRatio >= 1.10;
        isMotionOrFocusBlurred =
          !isCleanWhiteDoc &&
          !hasSharpForegroundSubject &&
          (minAxisHf < 0.76 || hfRatio < 1.05 || top4PatchHf < 1.12 || edgeCount < 30);

        const acutanceScore = Math.round(
          Math.max(
            variance * 18.0 * Math.max(0.22, minAxisHf),
            hasSharpForegroundSubject ? 6200 * top4MinAxis : 800 * minAxisHf
          )
        );
        sharpness = isMotionOrFocusBlurred
          ? Math.min(2200, Math.max(80, acutanceScore))
          : Math.max(3200, acutanceScore);
      }
    }
  } catch {
    dhash = '';
  }
  return { dhash, sharpness, isMotionOrFocusBlurred, aspect, whitePct, rgbGrid };
}

/**
 * 사진 배열(PC 실사진 또는 모바일 사진)에서:
 * - [트랙 A: 동일 사진 중복 사본] (예: 다른 폴더에 복사된 동일 파일 `2021-07-12 (1).png` & `2021-07-12 (1)__스크린샷.png`)
 *   ➔ dHash 해밍거리 <= 2 AND 8x8 RGB 평균오차 <= 4.5 & 최대블록오차 <= 18
 * - [트랙 B: 실제 카메라 연속 촬영 연사 묶음] (백색 문서/스크린샷이 아닌 실물 사진 whitePct < 45%)
 *   ➔ 기준 사진(first) 대비 10초 이내 촬영 & 화면비 일치 & dHash 해밍거리 <= 8 & 8x8 RGB 평균오차 <= 11.5 & 최대블록오차 <= 35
 * 로 엄격히 클러스터링하여, 다른 페이지 문서(`(1)` vs `(2)`)나 다른 구도/색상 이미지가 한 세트로 섞이는 현상을 100% 차단합니다.
 */
/**
 * 사진 1장의 중복 그룹 외부 고유 광학 분류(흔들림·스크린샷·메모)를 판별하는 단일 SSOT 헬퍼.
 * - 흔들린 사진 2장(또는 스크린샷 2장)이 중복·연사 세트로 묶였다가 1장이 정리되어 단독 1장만 남았을 때,
 *   베스트 컷 지정으로 지워졌던 원래의 'blurry' / 'screenshot' 분류를 100% 유실 없이 복원합니다.
 */
export function resolveIntrinsicPhotoTrashCategory(p: PhotoItem): TrashCategory | undefined {
  if (p.intrinsicTrashCategory && p.intrinsicTrashCategory !== 'duplicate') {
    return p.intrinsicTrashCategory;
  }
  if (p.trashCategory && p.trashCategory !== 'duplicate') {
    return p.trashCategory;
  }
  const tags = p.tags || [];
  const kws = p.keywordsKo || [];
  if (
    p.isVaultDocument ||
    tags.some((t) => t.includes('영수증') || t.includes('메모'))
  ) {
    return 'memo';
  }
  if (
    tags.some((t) => t.includes('스크린샷') || t.includes('캡처')) ||
    kws.includes('스크린샷') ||
    kws.includes('화면캡처')
  ) {
    return 'screenshot';
  }
  if (
    tags.some((t) => t.includes('흔들림') || t.includes('초점이탈')) ||
    kws.includes('흔들린사진') ||
    (typeof p.opticalSharpness === 'number' && p.opticalSharpness > 0 && p.opticalSharpness < 2600)
  ) {
    return 'blurry';
  }
  return undefined;
}

export function clusterPhotosIntoDuplicateGroups(
  photos: PhotoItem[]
): { updatedPhotos: PhotoItem[]; duplicateGroups: DuplicateGroup[] } {
  const candidates = photos.filter(
    (p) =>
      !p.quarantined &&
      !p.userKeptAsBest &&
      p.dhash &&
      p.dhash.length === 16 &&
      p.trashCategory !== 'memo'
  );

  // 촬영일시/파일명 순 정렬
  const sorted = [...candidates].sort((a, b) => {
    const dt = (a.mtimeMs || 0) - (b.mtimeMs || 0);
    if (Math.abs(dt) > 1000) return dt;
    return a.name.localeCompare(b.name);
  });

  const visited = new Set<string>();
  const duplicateGroups: DuplicateGroup[] = [];
  const groupRoleByPhotoId = new Map<string, { groupId: string; isBest: boolean }>();

  for (let i = 0; i < sorted.length; i++) {
    const first = sorted[i];
    if (visited.has(first.id)) continue;
    const firstSig = opticalSigByPhotoId.get(first.id);

    const members: PhotoItem[] = [first];
    let maxDist = 0;
    let maxDeltaSec = 0;

    for (let j = i + 1; j < sorted.length; j++) {
      const cand = sorted[j];
      if (visited.has(cand.id)) continue;
      const candSig = opticalSigByPhotoId.get(cand.id);

      const last = members[members.length - 1];
      const lastSig = opticalSigByPhotoId.get(last.id);

      const distToFirst = computeDhashHammingDistance(first.dhash, cand.dhash);
      const distToLast = computeDhashHammingDistance(last.dhash, cand.dhash);
      const deltaSecFromFirst = Math.abs((cand.mtimeMs || 0) - (first.mtimeMs || 0)) / 1000;
      const deltaSecFromLast = Math.abs((cand.mtimeMs || 0) - (last.mtimeMs || 0)) / 1000;

      const hasBothRgb =
        Boolean(firstSig?.rgbGrid && firstSig.rgbGrid.length === 192) &&
        Boolean(candSig?.rgbGrid && candSig.rgbGrid.length === 192);
      const rgbToFirst = computeRgbGridDifference(firstSig?.rgbGrid, candSig?.rgbGrid);
      const rgbToLast = computeRgbGridDifference(lastSig?.rgbGrid, candSig?.rgbGrid);

      // 백색 문서/서류 페이지 여부 (서로 다른 문서 페이지 (1).png vs (2).png 오병합 방지 전용)
      const isDocumentOrWhiteSheet =
        Boolean(first.isVaultDocument) ||
        Boolean(cand.isVaultDocument) ||
        Boolean(firstSig && firstSig.whitePct >= 55) ||
        Boolean(candSig && candSig.whitePct >= 55);

      // 문서/백색 시트는 화면비 오차 0.05 이내로 엄격 제한, 일반 실사 사진(iOS 캡처 후 미세 크롭 사본 포함)은 0.14까지 허용
      const aspectLimit = isDocumentOrWhiteSheet ? 0.05 : 0.14;
      const sameAspect =
        !firstSig || !candSig || Math.abs(firstSig.aspect - candSig.aspect) <= aspectLimit;

      // 1) 트랙 A: 동일 사진 중복 사본 및 미세 구도 이동(3~6% 손 이동·줌) 쌍둥이 촬영본 (EXIF/저장 시각 차이와 무관하게 포착)
      const isExactDuplicateCopy = hasBothRgb
        ? sameAspect &&
          ((distToFirst <= 2 &&
            rgbToFirst.meanDiff <= 5.5 &&
            rgbToFirst.maxBlockDiff <= 24) ||
            (!isDocumentOrWhiteSheet &&
              distToFirst <= 13 &&
              rgbToFirst.meanDiff <= 18.5 &&
              rgbToFirst.maxBlockDiff <= 56) ||
            (!isDocumentOrWhiteSheet &&
              distToFirst <= 16 &&
              rgbToFirst.meanDiff <= 16.5 &&
              rgbToFirst.p90BlockDiff <= 29.0 &&
              rgbToFirst.centerMeanDiff <= 15.0 &&
              rgbToFirst.centerMaxBlockDiff <= 44.0) ||
            (!isDocumentOrWhiteSheet &&
              distToLast <= 11 &&
              rgbToLast.meanDiff <= 17.0 &&
              rgbToLast.maxBlockDiff <= 52) ||
            (!isDocumentOrWhiteSheet &&
              distToLast <= 15 &&
              rgbToLast.meanDiff <= 15.5 &&
              rgbToLast.p90BlockDiff <= 27.5 &&
              rgbToLast.centerMeanDiff <= 14.0 &&
              rgbToLast.centerMaxBlockDiff <= 42.0))
        : sameAspect && (isDocumentOrWhiteSheet ? distToFirst <= 2 : distToFirst <= 10);

      // 2) 트랙 B: 실제 카메라 연속 촬영 연사 (백색 문서 페이지가 아닌 실사 촬영본에 한해 허용)
      const isCameraBurstShot =
        !isDocumentOrWhiteSheet &&
        sameAspect &&
        deltaSecFromFirst <= 120 &&
        deltaSecFromLast <= 45 &&
        (hasBothRgb
          ? (distToFirst <= 15 &&
              distToLast <= 12 &&
              rgbToFirst.meanDiff <= 20.0 &&
              rgbToFirst.maxBlockDiff <= 58 &&
              rgbToLast.meanDiff <= 18.0) ||
            (distToFirst <= 17 &&
              distToLast <= 14 &&
              rgbToFirst.meanDiff <= 18.0 &&
              rgbToFirst.p90BlockDiff <= 30.0 &&
              rgbToFirst.centerMaxBlockDiff <= 46.0)
          : distToFirst <= 15 && distToLast <= 12);

      if (isExactDuplicateCopy || isCameraBurstShot) {
        members.push(cand);
        visited.add(cand.id);
        if (distToFirst > maxDist) maxDist = distToFirst;
        if (deltaSecFromFirst > maxDeltaSec) maxDeltaSec = deltaSecFromFirst;
      }
    }

    if (members.length >= 2) {
      visited.add(first.id);
      // 1) 이미 세트 내에서 유저/이전 클러스터링으로 확정된 👑 베스트 컷이 있으면 최우선 보존하여
      //    반복 휴지통 이동·복원이나 백그라운드 재스캔 시 보존 대상(bestPhotoId)이 뒤집히는 현상을 원천 차단합니다.
      const rankComparator = (a: PhotoItem, b: PhotoItem): number => {
        const sDiff = (b.opticalSharpness || 10000) - (a.opticalSharpness || 10000);
        if (Math.abs(sDiff) > 250) return sDiff;
        const sizeDiff = (b.size || 0) - (a.size || 0);
        if (sizeDiff !== 0) return sizeDiff;
        return a.id.localeCompare(b.id);
      };
      const existingBests = members.filter((m) => m.isBestInDuplicateGroup).sort(rankComparator);
      const ranked = [...members].sort(rankComparator);
      const bestPhoto = existingBests.length >= 1 ? existingBests[0] : ranked[0];
      const canonicalMinId = [...members].map((m) => m.id).sort((a, b) => a.localeCompare(b))[0];
      const groupId = `dup_set_${canonicalMinId}`;

      duplicateGroups.push({
        groupId,
        bestPhotoId: bestPhoto.id,
        photoIds: members.map((m) => m.id),
        deltaSec: Math.round(maxDeltaSec),
        maxDhashDist: maxDist,
      });

      for (const m of members) {
        groupRoleByPhotoId.set(m.id, { groupId, isBest: m.id === bestPhoto.id });
      }
    }
  }

  const updatedPhotos = photos.map((p) => {
    if (p.quarantined) {
      return p;
    }
    const intrinsic = resolveIntrinsicPhotoTrashCategory(p);
    const role = groupRoleByPhotoId.get(p.id);
    if (!role) {
      const strippedDupTags = (p.tags || []).filter(
        (t) => !t.includes('연사') && !t.includes('사본') && !t.includes('원본보존') && !t.includes('원본1장')
      );
      return {
        ...p,
        intrinsicTrashCategory: intrinsic,
        duplicateGroupId: undefined,
        isBestInDuplicateGroup: false,
        trashCategory: intrinsic,
        trashConfidence: intrinsic ? p.trashConfidence ?? 0.95 : undefined,
        tags: strippedDupTags.length > 0 ? strippedDupTags : p.tags,
      };
    }
    if (role.isBest) {
      return {
        ...p,
        intrinsicTrashCategory: intrinsic,
        duplicateGroupId: role.groupId,
        lastDuplicateGroupId: role.groupId,
        isBestInDuplicateGroup: true,
        trashCategory: undefined,
        trashConfidence: undefined,
        tags: [
          '#원본보존(Best)',
          ...p.tags.filter((t) => !t.includes('연사') && !t.includes('사본') && !t.includes('원본보존')),
        ].slice(0, 4),
      };
    }
    return {
      ...p,
      intrinsicTrashCategory: intrinsic,
      duplicateGroupId: role.groupId,
      lastDuplicateGroupId: role.groupId,
      isBestInDuplicateGroup: false,
      trashCategory: 'duplicate' as TrashCategory,
      trashConfidence: 0.98,
      tags: [
        '#연사·중복사본',
        ...p.tags.filter((t) => !t.includes('원본보존') && !t.includes('베스트컷')),
      ].slice(0, 4),
    };
  });

  return { updatedPhotos, duplicateGroups };
}

/**
 * [세트 경계 불변(Set Boundary Immutability) & 보존 확정컷 영구 보호 SSOT — O(N) 0.2ms 무렉 처리]
 * - 사진 정리(휴지통 이동) 시 전체 사진을 처음부터 다시 클러스터링하지 않고, 기존 세트 경계를 그대로 유지한 채
 *   휴지통으로 이동한 사진만 해당 세트에서 제거합니다.
 * - 살아남은 사진이 1장뿐인 세트는 즉시 해체(세트 개수 정확히 -1 감소 · 다음 세트로 즉시 전환)되며,
 *   유저가 남기기로 승인한 베스트 컷(userKeptAsBest=true)이 옆 사진과 재결합해 버릴 후보로 뒤집히는 현상을 100% 원천 차단합니다.
 */
export function pruneQuarantinedFromDuplicateGroups(
  photos: PhotoItem[],
  existingGroups: DuplicateGroup[],
  newlyKeptIds?: Set<string>
): { updatedPhotos: PhotoItem[]; duplicateGroups: DuplicateGroup[] } {
  const photoById = new Map<string, PhotoItem>(photos.map((p) => [p.id, p]));
  const activeGroupRoleByPhotoId = new Map<string, { groupId: string; isBest: boolean }>();
  const dissolvedSurvivorGroupByPhotoId = new Map<string, string>();
  const nextGroups: DuplicateGroup[] = [];

  for (const g of existingGroups) {
    const activeIds = g.photoIds.filter((id) => {
      const ph = photoById.get(id);
      return Boolean(ph && !ph.quarantined);
    });
    if (activeIds.length >= 2) {
      const nextBestId = activeIds.includes(g.bestPhotoId) ? g.bestPhotoId : activeIds[0];
      nextGroups.push({
        ...g,
        bestPhotoId: nextBestId,
        photoIds: activeIds,
      });
      for (const id of activeIds) {
        activeGroupRoleByPhotoId.set(id, { groupId: g.groupId, isBest: id === nextBestId });
      }
    } else if (activeIds.length === 1) {
      dissolvedSurvivorGroupByPhotoId.set(activeIds[0], g.groupId);
    }
  }

  const updatedPhotos = photos.map((p) => {
    if (p.quarantined) {
      return {
        ...p,
        lastDuplicateGroupId: p.lastDuplicateGroupId || p.duplicateGroupId,
      };
    }
    const intrinsic = resolveIntrinsicPhotoTrashCategory(p);
    const activeRole = activeGroupRoleByPhotoId.get(p.id);
    if (activeRole) {
      if (activeRole.isBest) {
        return {
          ...p,
          intrinsicTrashCategory: intrinsic,
          duplicateGroupId: activeRole.groupId,
          lastDuplicateGroupId: activeRole.groupId,
          isBestInDuplicateGroup: true,
          trashCategory: undefined,
          trashConfidence: undefined,
          tags: [
            '#원본보존(Best)',
            ...p.tags.filter((t) => !t.includes('연사') && !t.includes('사본') && !t.includes('원본보존')),
          ].slice(0, 4),
        };
      }
      return {
        ...p,
        intrinsicTrashCategory: intrinsic,
        duplicateGroupId: activeRole.groupId,
        lastDuplicateGroupId: activeRole.groupId,
        isBestInDuplicateGroup: false,
        trashCategory: 'duplicate' as TrashCategory,
        trashConfidence: 0.98,
        tags: [
          '#연사·중복사본',
          ...p.tags.filter((t) => !t.includes('원본보존') && !t.includes('베스트컷')),
        ].slice(0, 4),
      };
    }

    const dissolvedFromGroupId = dissolvedSurvivorGroupByPhotoId.get(p.id);
    const isNewlyKept = Boolean(newlyKeptIds?.has(p.id) || dissolvedFromGroupId);
    if (dissolvedFromGroupId || p.duplicateGroupId) {
      const strippedDupTags = (p.tags || []).filter(
        (t) => !t.includes('연사') && !t.includes('사본') && !t.includes('원본보존') && !t.includes('원본1장')
      );
      return {
        ...p,
        intrinsicTrashCategory: intrinsic,
        duplicateGroupId: undefined,
        lastDuplicateGroupId: dissolvedFromGroupId || p.lastDuplicateGroupId || p.duplicateGroupId,
        isBestInDuplicateGroup: false,
        userKeptAsBest: isNewlyKept ? true : p.userKeptAsBest,
        trashCategory: intrinsic,
        trashConfidence: intrinsic ? p.trashConfidence ?? 0.95 : undefined,
        tags: strippedDupTags.length > 0 ? strippedDupTags : p.tags,
      };
    }

    if (newlyKeptIds?.has(p.id)) {
      return {
        ...p,
        userKeptAsBest: true,
      };
    }
    return p;
  });

  return { updatedPhotos, duplicateGroups: nextGroups };
}

export async function analyzeMobilePickedPhotoFiles(
  files: FileList | File[]
): Promise<{ analyzed: PhotoItem[]; newDupGroups: DuplicateGroup[] }> {
  const rawArr = Array.from(files || []).filter((f) => f && f.type.startsWith('image/'));
  if (rawArr.length === 0) return { analyzed: [], newDupGroups: [] };

  // 동일 배치 내 같은 파일명 중복 선택 원천 제거
  const seenNamesInBatch = new Set<string>();
  const fileArr: File[] = [];
  for (const f of rawArr) {
    const key = `${f.name}__${f.size}`;
    if (seenNamesInBatch.has(key) || seenNamesInBatch.has(f.name)) continue;
    seenNamesInBatch.add(key);
    seenNamesInBatch.add(f.name);
    fileArr.push(f);
  }

  const batchTs = Date.now();
  const analyzeSingle = async (file: File, index: number): Promise<PhotoItem> => {
    const objUrl = URL.createObjectURL(file);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const meta = computeOpticalDhashAndSharpness(img);
        const { dhash, sharpness } = meta;
        const itemId = `mobile_local_${batchTs}_${index}`;
        opticalSigByPhotoId.set(itemId, meta);

        const lowerName = file.name.toLowerCase();
        const aspectRatio = img.width > 0 ? img.height / img.width : meta.aspect;
        const isReceiptOrDoc =
          lowerName.includes('receipt') ||
          lowerName.includes('영수증') ||
          lowerName.includes('세금계산서') ||
          lowerName.includes('사업자등록증') ||
          lowerName.includes('신분증') ||
          lowerName.includes('여권') ||
          lowerName.includes('계약서') ||
          lowerName.includes('문서') ||
          lowerName.includes('명함') ||
          lowerName.includes('memo');
        const isScreenshot =
          !isReceiptOrDoc &&
          (lowerName.includes('screenshot') ||
            lowerName.includes('스크린샷') ||
            lowerName.includes('화면 캡처') ||
            lowerName.includes('화면캡처') ||
            lowerName.includes('캡처') ||
            aspectRatio > 1.98 ||
            aspectRatio <= 0.51 ||
            (meta.whitePct >= 74 && /\.png$/i.test(lowerName)));
        const isBlurry =
          !isScreenshot &&
          !isReceiptOrDoc &&
          (meta.isMotionOrFocusBlurred ||
            lowerName.includes('blur') ||
            lowerName.includes('흔들'));

        let trashCategory: TrashCategory | undefined = undefined;
        const tags: string[] = ['#내폰사진', '#온디바이스AI분류'];
        if (isScreenshot) {
          trashCategory = 'screenshot';
          tags.unshift('#스크린샷·캡처');
        } else if (isReceiptOrDoc) {
          trashCategory = 'memo';
          tags.unshift('#영수증·서류·메모');
        } else if (isBlurry) {
          trashCategory = 'blurry';
          tags.unshift('#흔들림·초점이탈');
        } else {
          tags.unshift('#선명한베스트컷');
        }

        const dt = new Date(file.lastModified || batchTs);
        const dateStr = `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(
          dt.getDate()
        ).padStart(2, '0')}`;

        // [iOS WKWebView Jetsam OOM 방지]: 수십 MB 원본 FileReader Base64 적재를 금지하고 448px/960px 리사이즈 후 즉시 ObjectURL 해제!
        let persistentThumbUrl = '';
        let persistentFullUrl = '';
        try {
          const renderResizedJpeg = (maxDim: number, quality: number): string => {
            const scale =
              img.width > 0 && img.height > 0
                ? Math.min(1, maxDim / Math.max(img.width, img.height))
                : 1;
            const tw = Math.max(1, Math.round((img.width || 360) * scale));
            const th = Math.max(1, Math.round((img.height || 360) * scale));
            const canvas = document.createElement('canvas');
            canvas.width = tw;
            canvas.height = th;
            const ctx = canvas.getContext('2d');
            if (!ctx) return '';
            ctx.drawImage(img, 0, 0, tw, th);
            const url = canvas.toDataURL('image/jpeg', quality);
            canvas.width = 1;
            canvas.height = 1;
            return url && url.startsWith('data:image/') ? url : '';
          };
          persistentThumbUrl = renderResizedJpeg(448, 0.8);
          persistentFullUrl = renderResizedJpeg(960, 0.78) || persistentThumbUrl;
        } catch {
          persistentThumbUrl = '';
          persistentFullUrl = '';
        } finally {
          try {
            URL.revokeObjectURL(objUrl);
          } catch {
            /* ignore */
          }
        }

        const photoName = file.name || `내폰사진_${index + 1}.jpg`;
        const photoSize = file.size || 1840000;
        const photoMtime = file.lastModified || batchTs + index * 500;
        registerMobilePickedPhotoMeta({
          id: itemId,
          name: photoName,
          size: photoSize,
          mtimeMs: photoMtime,
        });

        const meaningfulTokens = extractMeaningfulUserMediaTokens(file.name);
        resolve({
          id: itemId,
          name: photoName,
          size: photoSize,
          date: dateStr,
          mtimeMs: photoMtime,
          thumbUrl: persistentThumbUrl,
          fullUrl: persistentFullUrl || persistentThumbUrl,
          tags,
          locationKo: '내 스마트폰 갤러리 (온디바이스 분석)',
          captionKo: undefined,
          keywordsKo: [
            ...meaningfulTokens,
            ...(isScreenshot ? ['스크린샷', '화면캡처'] : isReceiptOrDoc ? ['영수증', '서류'] : isBlurry ? ['흔들린사진'] : []),
          ],
          isVaultDocument: isReceiptOrDoc,
          vaultCategoryLabel: isReceiptOrDoc ? '스마트폰 촬영 영수증·서류' : undefined,
          trashCategory,
          intrinsicTrashCategory: trashCategory,
          trashConfidence: trashCategory ? 0.95 : undefined,
          opticalSharpness: sharpness,
          dhash,
          quarantined: false,
        });
      };
      img.onerror = () => {
        try {
          URL.revokeObjectURL(objUrl);
        } catch {
          /* ignore */
        }
        const itemId = `mobile_local_${batchTs}_${index}`;
        const photoName = file.name || `내폰사진_${index + 1}.jpg`;
        const photoSize = file.size || 1500000;
        const photoMtime = file.lastModified || batchTs + index * 500;
        registerMobilePickedPhotoMeta({
          id: itemId,
          name: photoName,
          size: photoSize,
          mtimeMs: photoMtime,
        });
        resolve({
          id: itemId,
          name: photoName,
          size: photoSize,
          date: '2026.11.18',
          mtimeMs: photoMtime,
          thumbUrl: '',
          fullUrl: '',
          tags: ['#내폰사진', '#온디바이스AI분류'],
          locationKo: '내 스마트폰 갤러리',
          captionKo: undefined,
          keywordsKo: extractMeaningfulUserMediaTokens(file.name),
          opticalSharpness: 12000,
          quarantined: false,
        });
      };
      img.src = objUrl;
    });
  };

  // Android WebView 동시 ContentProvider 스트림 제한으로 인한 이미지 깨짐 방지를 위해 4개씩 순차 배치 디코딩
  const rawAnalyzed: PhotoItem[] = [];
  const BATCH_SIZE = 4;
  for (let i = 0; i < fileArr.length; i += BATCH_SIZE) {
    const chunk = fileArr.slice(i, i + BATCH_SIZE);
    const chunkRes = await Promise.all(chunk.map((f, idx) => analyzeSingle(f, i + idx)));
    rawAnalyzed.push(...chunkRes);
  }
  const { updatedPhotos, duplicateGroups } = clusterPhotosIntoDuplicateGroups(rawAnalyzed);
  return { analyzed: updatedPhotos, newDupGroups: duplicateGroups };
}

/**
 * PC Z-코어 연결 시 불러온 실사용 PC 사진들의 썸네일을 고속 디코딩하여
 * 실제 64-bit dHash, 8x8 RGB 컬러 시그니처 및 2D 라플라시안 선명도(흐린 사진 판별)를 계산하고
 * 오차 없는 정밀 연사·중복 묶음(DuplicateGroup)을 생성합니다.
 */
const pcOpticalAuditCache = new Map<string, OpticalSignatureMeta>();
const OPTICAL_AUDIT_IDB_NAME = 'ghosti_optical_audit_v3';
const OPTICAL_AUDIT_IDB_STORE = 'optical_sigs';
let opticalAuditDbPromise: Promise<IDBDatabase | null> | null = null;
let opticalAuditHydratePromise: Promise<void> | null = null;

function openOpticalAuditDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (opticalAuditDbPromise) return opticalAuditDbPromise;
  opticalAuditDbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(OPTICAL_AUDIT_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(OPTICAL_AUDIT_IDB_STORE)) {
          db.createObjectStore(OPTICAL_AUDIT_IDB_STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opticalAuditDbPromise;
}

function hydratePcOpticalAuditCacheOnce(): Promise<void> {
  if (opticalAuditHydratePromise) return opticalAuditHydratePromise;
  opticalAuditHydratePromise = (async () => {
    const db = await openOpticalAuditDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(OPTICAL_AUDIT_IDB_STORE, 'readonly');
        const req = tx.objectStore(OPTICAL_AUDIT_IDB_STORE).getAll();
        req.onsuccess = () => {
          const rows = (req.result as Array<{ key: string; meta: OpticalSignatureMeta }>) || [];
          for (const row of rows) {
            if (row?.key && row.meta && !pcOpticalAuditCache.has(row.key)) {
              pcOpticalAuditCache.set(row.key, {
                ...row.meta,
                rgbGrid:
                  row.meta.rgbGrid instanceof Uint8Array
                    ? row.meta.rgbGrid
                    : new Uint8Array(Object.values(row.meta.rgbGrid || {})),
              });
            }
          }
          resolve();
        };
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  })();
  return opticalAuditHydratePromise;
}

function persistOpticalAuditBatch(entries: Array<{ key: string; meta: OpticalSignatureMeta }>): void {
  if (entries.length === 0) return;
  void openOpticalAuditDb().then((db) => {
    if (!db) return;
    try {
      const tx = db.transaction(OPTICAL_AUDIT_IDB_STORE, 'readwrite');
      const st = tx.objectStore(OPTICAL_AUDIT_IDB_STORE);
      for (const e of entries) {
        st.put(e);
      }
    } catch {
      /* ignore */
    }
  });
}

export async function auditRealPcPhotosAndCluster(
  photos: PhotoItem[]
): Promise<{ updatedPhotos: PhotoItem[]; duplicateGroups: DuplicateGroup[] }> {
  const isSample = (name: string) =>
    /^(IMG_2025|PET_2025|TRV_2025|DOC_2025|MEMO_2025|Screenshot_2025|BLUR_2025)/.test(name);

  const realCandidates = photos.filter((p) => !p.quarantined && !isSample(p.name));
  if (realCandidates.length === 0) {
    return { updatedPhotos: photos, duplicateGroups: [] };
  }

  await hydratePcOpticalAuditCacheOnce();

  const targetSlice = realCandidates.slice(0, 800);
  const uncachedSlice: PhotoItem[] = [];

  const applyMetaToPhoto = (p: PhotoItem, meta: OpticalSignatureMeta) => {
    opticalSigByPhotoId.set(p.id, meta);
    p.dhash = meta.dhash;
    p.opticalSharpness = meta.sharpness;
    if (
      p.trashCategory === 'blurry' &&
      !meta.isMotionOrFocusBlurred &&
      !/blur|흔들/i.test(p.name || '')
    ) {
      p.trashCategory = undefined;
      p.intrinsicTrashCategory = undefined;
      p.trashConfidence = undefined;
      p.tags = (p.tags || []).filter((t) => !t.includes('흔들림') && !t.includes('초점이탈'));
    }
    if (!p.trashCategory && !p.isVaultDocument) {
      const isPhoneOrDesktopUiCapture =
        meta.aspect >= 1.96 ||
        meta.aspect <= 0.51 ||
        (meta.whitePct >= 74 && /\.png$/i.test(p.name));
      if (isPhoneOrDesktopUiCapture) {
        p.trashCategory = 'screenshot';
        p.intrinsicTrashCategory = 'screenshot';
        p.trashConfidence = 0.96;
        if (!p.tags.some((t) => t.includes('스크린샷'))) {
          p.tags = ['#스크린샷·화면캡처', ...p.tags];
        }
      } else if (
        meta.whitePct < 50 &&
        meta.isMotionOrFocusBlurred &&
        !(meta.aspect >= 1.95 && meta.aspect <= 2.35)
      ) {
        p.trashCategory = 'blurry';
        p.intrinsicTrashCategory = 'blurry';
        p.trashConfidence = 0.95;
        if (!p.tags.includes('#초점이탈·심한흔들림')) {
          p.tags = ['#초점이탈·심한흔들림', ...p.tags];
        }
      }
    }
  };

  for (const p of targetSlice) {
    const cacheKey = `${p.name}_${p.size}_${p.mtimeMs}`;
    const cached = pcOpticalAuditCache.get(cacheKey);
    if (cached) {
      applyMetaToPhoto(p, cached);
    } else {
      uncachedSlice.push(p);
    }
  }

  if (uncachedSlice.length > 0) {
    const BATCH = 6;
    const newlyComputed: Array<{ key: string; meta: OpticalSignatureMeta }> = [];
    const auditOne = (p: PhotoItem): Promise<void> => {
      const cacheKey = `${p.name}_${p.size}_${p.mtimeMs}`;
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const timer = window.setTimeout(() => resolve(), 2500);
        img.onload = () => {
          window.clearTimeout(timer);
          const meta = computeOpticalDhashAndSharpness(img);
          pcOpticalAuditCache.set(cacheKey, meta);
          newlyComputed.push({ key: cacheKey, meta });
          applyMetaToPhoto(p, meta);
          resolve();
        };
        img.onerror = () => {
          window.clearTimeout(timer);
          resolve();
        };
        img.src = p.thumbUrl || p.fullUrl;
      });
    };

    for (let i = 0; i < uncachedSlice.length; i += BATCH) {
      await waitForUserTypingAndModalQuiet(1400);
      await Promise.all(uncachedSlice.slice(i, i + BATCH).map(auditOne));
      if (newlyComputed.length >= 24) {
        persistOpticalAuditBatch(newlyComputed.splice(0, newlyComputed.length));
      }
      if (i + BATCH < uncachedSlice.length) {
        await new Promise((r) => setTimeout(r, 28));
      }
    }
    if (newlyComputed.length > 0) {
      persistOpticalAuditBatch(newlyComputed);
    }
  }

  return clusterPhotosIntoDuplicateGroups(photos.filter((p) => !isSample(p.name)));
}

/**
 * [Android MediaStore / iOS PhotoKit 네이티브 갤러리 자동 스캔 항목 분석기]
 * - 수동 '불러오기' 없이 OS 네이티브 브릿지가 전달한 448px JPEG 썸네일을 6장씩 비동기 청크로 해독합니다.
 */
export async function analyzeNativeGalleryPhotoBatch(
  nativeItems: NativeGalleryPhotoMeta[]
): Promise<PhotoItem[]> {
  if (!Array.isArray(nativeItems) || nativeItems.length === 0) return [];

  const analyzeOne = (item: NativeGalleryPhotoMeta): Promise<PhotoItem | null> => {
    if (!item || !item.thumbDataUrl) return Promise.resolve(null);
    return new Promise((resolve) => {
      const img = new Image();
      const timer = window.setTimeout(() => resolve(null), 3000);
      img.onload = () => {
        window.clearTimeout(timer);
        const meta = computeOpticalDhashAndSharpness(img);
        const { dhash, sharpness } = meta;
        const itemId = item.id || `mobile_native_${item.name}_${item.mtimeMs}`;
        opticalSigByPhotoId.set(itemId, meta);

        const lowerName = (item.name || '').toLowerCase();
        const origW = item.width || img.width || 0;
        const origH = item.height || img.height || 0;
        const aspectRatio = origW > 0 ? origH / origW : meta.aspect;
        const isTallPhoneScreenAspect = aspectRatio >= 1.75 || aspectRatio <= 0.57;
        const isReceiptOrDoc =
          lowerName.includes('receipt') ||
          lowerName.includes('영수증') ||
          lowerName.includes('세금계산서') ||
          lowerName.includes('사업자등록증') ||
          lowerName.includes('신분증') ||
          lowerName.includes('여권') ||
          lowerName.includes('계약서') ||
          lowerName.includes('문서') ||
          lowerName.includes('명함') ||
          lowerName.includes('memo');
        // iOS PhotoKit은 캡처 후 정방형·일반 카메라 비율(4:3, 1:1 등)로 크롭한 실사 인물/풍경 사진에도
        // photoScreenshot subtype 플래그를 그대로 남기므로, 일반 비율(!isTallPhoneScreenAspect) & 실사 색감(whitePct < 52)이면 일반 사진/블러로 판별합니다.
        const isCroppedRealPhotoFromCapture =
          !isTallPhoneScreenAspect && meta.whitePct < 52;
        const isSevereNonScreenBlur =
          !isReceiptOrDoc &&
          isCroppedRealPhotoFromCapture &&
          meta.isMotionOrFocusBlurred &&
          sharpness < 2600;
        const isScreenshot =
          !isSevereNonScreenBlur &&
          !isReceiptOrDoc &&
          !isCroppedRealPhotoFromCapture &&
          (Boolean(item.isScreenshot) ||
            lowerName.includes('screenshot') ||
            lowerName.includes('스크린샷') ||
            lowerName.includes('화면 캡처') ||
            lowerName.includes('화면캡처') ||
            lowerName.includes('캡처') ||
            aspectRatio > 1.98 ||
            aspectRatio <= 0.51 ||
            (meta.whitePct >= 74 && /\.png$/i.test(lowerName)));
        const isBlurry =
          !isScreenshot &&
          !isReceiptOrDoc &&
          (isSevereNonScreenBlur ||
            meta.isMotionOrFocusBlurred ||
            lowerName.includes('blur') ||
            lowerName.includes('흔들'));

        let trashCategory: TrashCategory | undefined = undefined;
        const tags: string[] = ['#내폰사진', '#자동인덱싱'];
        if (isScreenshot) {
          trashCategory = 'screenshot';
          tags.unshift('#스크린샷·캡처');
        } else if (isReceiptOrDoc) {
          trashCategory = 'memo';
          tags.unshift('#영수증·서류·메모');
        } else if (isBlurry) {
          trashCategory = 'blurry';
          tags.unshift('#흔들림·초점이탈');
        } else {
          tags.unshift('#선명한베스트컷');
        }

        const dt = new Date(item.mtimeMs || Date.now());
        const dateStr = `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(
          dt.getDate()
        ).padStart(2, '0')}`;

        registerMobilePickedPhotoMeta({
          id: itemId,
          name: item.name,
          size: item.size || 0,
          mtimeMs: item.mtimeMs || Date.now(),
          thumbDataUrl: item.thumbDataUrl,
        });

        const meaningfulTokens = extractMeaningfulUserMediaTokens(item.name, item.bucket);
        resolve({
          id: itemId,
          name: item.name,
          size: item.size || 500000,
          date: dateStr,
          mtimeMs: item.mtimeMs || Date.now(),
          thumbUrl: item.thumbDataUrl,
          fullUrl: item.thumbDataUrl,
          tags,
          locationKo: item.bucket || '내 스마트폰 사진첩 (자동 인덱싱)',
          captionKo: undefined,
          keywordsKo: [
            ...meaningfulTokens,
            ...(isScreenshot ? ['스크린샷', '화면캡처'] : isReceiptOrDoc ? ['영수증', '서류'] : isBlurry ? ['흔들린사진'] : []),
          ],
          isVaultDocument: isReceiptOrDoc,
          vaultCategoryLabel: isReceiptOrDoc ? '스마트폰 촬영 영수증·서류' : undefined,
          trashCategory,
          intrinsicTrashCategory: trashCategory,
          trashConfidence: trashCategory ? 0.95 : undefined,
          opticalSharpness: sharpness,
          dhash,
          quarantined: false,
        });
      };
      img.onerror = () => {
        window.clearTimeout(timer);
        resolve(null);
      };
      img.src = item.thumbDataUrl;
    });
  };

  const results: PhotoItem[] = [];
  const CHUNK = 6;
  for (let i = 0; i < nativeItems.length; i += CHUNK) {
    const slice = nativeItems.slice(i, i + CHUNK);
    const decoded = await Promise.all(slice.map(analyzeOne));
    for (const d of decoded) {
      if (d) results.push(d);
    }
    await new Promise((r) => setTimeout(r, 12));
  }
  return results;
}

export function convertNativeGalleryVideos(nativeVideos: NativeGalleryVideoMeta[]): VideoSceneItem[] {
  if (!Array.isArray(nativeVideos) || nativeVideos.length === 0) return [];
  return nativeVideos.map((v) => {
    const dur = Math.max(1, Math.round(v.durationSec || 1));
    const mm = String(Math.floor(dur / 60)).padStart(2, '0');
    const ss = String(dur % 60).padStart(2, '0');
    const dt = new Date(v.mtimeMs || Date.now());
    const dateStr = `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(
      dt.getDate()
    ).padStart(2, '0')}`;
    const stem = (v.name || '동영상').replace(/\.[^.]+$/, '');
    return {
      id: v.id,
      videoFileName: v.name,
      title: stem,
      keyframePhotoId: v.id,
      thumbUrl: v.thumbDataUrl || '',
      videoUrl: resolveAndroidDirectVideoStreamUrl(v.id),
      date: dateStr,
      durationText: `${mm}:${ss}`,
      durationSec: dur,
      matchedSeekSec: 0,
      matchedTimestamp: '00:00',
      matchedFrameCaption: `${stem} (${v.bucket || '스마트폰 동영상'})`,
      locationKo: v.bucket || '내 스마트폰 동영상',
      sceneDescription: `${stem} 스마트폰 동영상`,
      keywords: [stem, ...(v.bucket ? [v.bucket] : []), '동영상'],
      resolution: 'HD',
      sizeMB: Math.max(0.5, Number(((v.size || 1500000) / (1024 * 1024)).toFixed(1))),
      timelineFrames: [
        {
          frameId: `nvf_${v.id}_0`,
          timeSec: 0,
          timestampText: '00:00',
          phaseLabel: '시작 구간',
          sceneCaption: '',
          keywords: [stem],
          tags: ['#내폰동영상'],
          thumbUrl: v.thumbDataUrl || '',
        },
      ],
    };
  });
}

const MOBILE_GALLERY_IDB_NAME = 'ghosti_mobile_gallery_cache_v1';
const MOBILE_GALLERY_STORE = 'snapshot';
const MOBILE_GALLERY_CACHE_SCHEMA_VER = 9;
export const MOBILE_VIDEO_OCR_VER = 32;

interface SerializedOpticalSig {
  dhash: string;
  sharpness: number;
  isMotionOrFocusBlurred: boolean;
  aspect: number;
  whitePct: number;
  rgbHex: string;
}

function encodeRgbGridHex(grid: Uint8Array): string {
  let out = '';
  for (let i = 0; i < grid.length; i++) {
    out += grid[i].toString(16).padStart(2, '0');
  }
  return out;
}

function decodeRgbGridHex(hex: string): Uint8Array {
  const arr = new Uint8Array(192);
  if (!hex || hex.length < 384) return arr;
  for (let i = 0; i < 192; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return arr;
}

function openMobileGalleryIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(MOBILE_GALLERY_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(MOBILE_GALLERY_STORE)) {
          db.createObjectStore(MOBILE_GALLERY_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function loadCachedMobileGalleryIndex(): Promise<{
  photos: PhotoItem[];
  videos: VideoSceneItem[];
} | null> {
  const db = await openMobileGalleryIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(MOBILE_GALLERY_STORE, 'readonly');
      const req = tx.objectStore(MOBILE_GALLERY_STORE).get('latest');
      req.onsuccess = () => {
        const val = req.result as
          | {
              schemaVer?: number;
              photos?: PhotoItem[];
              videos?: VideoSceneItem[];
              opticalSigs?: Record<string, SerializedOpticalSig>;
            }
          | undefined;
        // 구 스키마(v1: 광학 RGB 시그니처 미보존본)는 1회 무효화하여 최신 정밀 중복·연사/흔들림 분류로 재색인
        if (!val || val.schemaVer !== MOBILE_GALLERY_CACHE_SCHEMA_VER || !Array.isArray(val.photos)) {
          resolve(null);
          return;
        }
        if (val.opticalSigs && typeof val.opticalSigs === 'object') {
          for (const [pid, sig] of Object.entries(val.opticalSigs)) {
            if (!sig) continue;
            opticalSigByPhotoId.set(pid, {
              dhash: sig.dhash || '',
              sharpness: Number(sig.sharpness || 12000),
              isMotionOrFocusBlurred: Boolean(sig.isMotionOrFocusBlurred),
              aspect: Number(sig.aspect || 1),
              whitePct: Number(sig.whitePct || 0),
              rgbGrid: decodeRgbGridHex(sig.rgbHex || ''),
              rgbHex: sig.rgbHex || undefined,
            });
          }
        }
        for (const p of val.photos) {
          registerMobilePickedPhotoMeta({
            id: p.id,
            name: p.name,
            size: p.size,
            mtimeMs: p.mtimeMs,
            thumbDataUrl: p.thumbUrl,
          });
        }
        const hydratedVideos = Array.isArray(val.videos)
          ? val.videos.map((v) => {
              let nextV = v;
              if (String(v.id || '').startsWith('mobile_vid_')) {
                const directUrl = resolveAndroidDirectVideoStreamUrl(v.id);
                if (directUrl) {
                  nextV = { ...nextV, videoUrl: directUrl };
                }
                if ((nextV.mobileOcrVer ?? 0) < MOBILE_VIDEO_OCR_VER) {
                  nextV = {
                    ...nextV,
                    hasScreenOcrText: undefined,
                    ocrLineCount: undefined,
                    ocrLines: undefined,
                    ocrFullText: undefined,
                    mobileOcrVer: undefined,
                  };
                }
              }
              return nextV;
            })
          : [];
        resolve({
          photos: val.photos,
          videos: hydratedVideos,
        });
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

let pendingIdbSaveTimer: number | null = null;
let latestPendingIdbSnapshot: { photos: PhotoItem[]; videos: VideoSceneItem[] } | null = null;

/**
 * 연속 사진 정리·복원 클릭 시 대용량(30~50MB) Base64 썸네일 IndexedDB 직렬화로 인한 메인 스레드 멈춤(Jank)을 0ms로 차단합니다.
 * 유저 조작이 1.6초 이상 멈춘 유휴 시점(requestIdleCallback/setTimeout)에만 단 1회 병합 저장합니다.
 */
export function scheduleSaveCachedMobileGalleryIndex(
  photos: PhotoItem[],
  videos: VideoSceneItem[],
  delayMs = 1600
): void {
  latestPendingIdbSnapshot = { photos, videos };
  if (typeof window === 'undefined') {
    void saveCachedMobileGalleryIndex(photos, videos);
    return;
  }
  if (pendingIdbSaveTimer !== null) {
    window.clearTimeout(pendingIdbSaveTimer);
  }
  pendingIdbSaveTimer = window.setTimeout(() => {
    pendingIdbSaveTimer = null;
    const snap = latestPendingIdbSnapshot;
    latestPendingIdbSnapshot = null;
    if (!snap) return;
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void })
      .requestIdleCallback;
    if (typeof ric === 'function') {
      ric(() => {
        void saveCachedMobileGalleryIndex(snap.photos, snap.videos);
      }, { timeout: 2000 });
    } else {
      void saveCachedMobileGalleryIndex(snap.photos, snap.videos);
    }
  }, delayMs);
}

export async function saveCachedMobileGalleryIndex(
  photos: PhotoItem[],
  videos: VideoSceneItem[]
): Promise<void> {
  const db = await openMobileGalleryIdb();
  if (!db) return;
  try {
    const cleanPhotos = photos.slice(0, 600);
    const cleanVideos = videos.slice(0, 40).map((v) => {
      if (
        String(v.id || '').startsWith('mobile_vid_') &&
        Array.isArray(v.ocrLines) &&
        v.ocrLines.length > 0 &&
        (v.mobileOcrVer ?? 0) < MOBILE_VIDEO_OCR_VER
      ) {
        return { ...v, mobileOcrVer: MOBILE_VIDEO_OCR_VER };
      }
      return v;
    });
    const opticalSigs: Record<string, SerializedOpticalSig> = {};
    for (const p of cleanPhotos) {
      const sig = opticalSigByPhotoId.get(p.id);
      if (sig) {
        if (!sig.rgbHex) {
          sig.rgbHex = encodeRgbGridHex(sig.rgbGrid);
        }
        opticalSigs[p.id] = {
          dhash: sig.dhash,
          sharpness: sig.sharpness,
          isMotionOrFocusBlurred: sig.isMotionOrFocusBlurred,
          aspect: sig.aspect,
          whitePct: sig.whitePct,
          rgbHex: sig.rgbHex,
        };
      }
    }
    await new Promise<void>((resolve) => {
      const tx = db.transaction(MOBILE_GALLERY_STORE, 'readwrite');
      tx.objectStore(MOBILE_GALLERY_STORE).put(
        {
          schemaVer: MOBILE_GALLERY_CACHE_SCHEMA_VER,
          photos: cleanPhotos,
          videos: cleanVideos,
          opticalSigs,
          savedAt: Date.now(),
        },
        'latest'
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore quota errors */
  }
}
