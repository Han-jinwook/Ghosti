import type { DuplicateGroup, PhotoItem, TrashCategory, VideoSceneItem } from '../types/saysee';
import {
  registerMobilePickedPhotoMeta,
  resolveAndroidDirectVideoStreamUrl,
  type NativeGalleryPhotoMeta,
  type NativeGalleryVideoMeta,
} from './ghostiMobileCareBridge';
import { waitForUserTypingAndModalQuiet } from './ai/aiSharedRuntime';

// [기획 정합] 보관 서류 vs 정리 후보 파일명 패턴 (기능명세: 금고 문서는 정리 탭에 절대 노출 금지)
const PERMANENT_DOC_NAME_PATTERN = /(세금계산서|사업자등록증|신분증|여권|계약서|문서|명함|passport|contract|invoice|certificate)/i;
const RECEIPT_MEMO_PARKING_NAME_PATTERN = /(receipt|영수증|주차|parking|memo|메모|전표)/i;

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

function popcount32(x: number): number {
  let v = x - ((x >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function parseDhash64Words(hex?: string): [number, number] | null {
  if (!hex || hex.length !== 16) return null;
  const hi = parseInt(hex.slice(0, 8), 16);
  const lo = parseInt(hex.slice(8, 16), 16);
  if (Number.isNaN(hi) || Number.isNaN(lo)) return null;
  return [hi | 0, lo | 0];
}

function hammingDistanceWords(a: [number, number] | null | undefined, b: [number, number] | null | undefined): number {
  if (!a || !b) return 64;
  return popcount32(a[0] ^ b[0]) + popcount32(a[1] ^ b[1]);
}

const _reusableRgbBlockDiffs = new Float32Array(64);

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
  const blockDiffs = _reusableRgbBlockDiffs;
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
        const maxAxisHf = Math.max(hfX, hfY, hfD1, hfD2);
        const axisAnisotropy = maxAxisHf / Math.max(0.01, minAxisHf);

        let sharp4AxisPatches = 0;
        let centerSharp4Patches = 0;
        let strictSharp4Patches = 0;
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
            const pyK = (k / 8) | 0;
            const pxK = k % 8;
            if (pyK >= 1 && pyK <= 6 && pxK >= 1 && pxK <= 6) {
              centerSharp4Patches++;
            }
          }
          if (phf >= 1.24 && pMinAxis >= 0.86 && pv >= 30.0) {
            strictSharp4Patches++;
          }
          patchMetrics.push({ score: phf * Math.max(0.2, pMinAxis), phf, pMinAxis });
        }

        patchMetrics.sort((a, b) => b.score - a.score);
        const topK = patchMetrics.slice(0, 4);
        const top4PatchHf =
          topK.length > 0 ? topK.reduce((s, m) => s + m.phf, 0) / topK.length : 0;
        const top4MinAxis =
          topK.length > 0 ? topK.reduce((s, m) => s + m.pMinAxis, 0) / topK.length : 0;

        // 4) JPEG 8x8 DCT 링잉 및 썸네일(448px·280px) 리사이즈에 불변인 Crete 지각적 블러(Re-blurring) 정밀 측정
        //    - 3x3 이항 평활화(gs) 후 7-tap(r=3) 수평/수직 재블러링 변화량으로 전역·방향성 흐림(maxSmoothedCrete) 산출
        //    - 원본 휘도(gray) 기반 5-tap(r=2) 8x8 패치 상위 3개 강경계(df>10) 선명도(t3RawCrete)로 실내 손·인물 보케 보호
        let maxSmoothedCrete = 0;
        let anisoSmoothedCrete = 0;
        let t3RawCrete = 1.0;

        if (W >= 16 && H >= 16) {
          // 4-A) 원본 휘도(gray) 5-tap(r=2) 1D 수평/수직 재블러링 -> 8x8 패치 강경계 선명도(t3RawCrete)
          const bhRaw = new Float32Array(W * H);
          const bvRaw = new Float32Array(W * H);
          for (let y = 0; y < H; y++) {
            const row = y * W;
            for (let x = 0; x < W; x++) {
              const x0 = x > 1 ? x - 2 : 0;
              const x1 = x > 0 ? x - 1 : 0;
              const x3 = x + 1 < W ? x + 1 : W - 1;
              const x4 = x + 2 < W ? x + 2 : W - 1;
              bhRaw[row + x] =
                (gray[row + x0] + gray[row + x1] + gray[row + x] + gray[row + x3] + gray[row + x4]) * 0.2;
            }
          }
          for (let y = 0; y < H; y++) {
            const y0 = (y > 1 ? y - 2 : 0) * W;
            const y1 = (y > 0 ? y - 1 : 0) * W;
            const y2 = y * W;
            const y3 = (y + 1 < H ? y + 1 : H - 1) * W;
            const y4 = (y + 2 < H ? y + 2 : H - 1) * W;
            for (let x = 0; x < W; x++) {
              bvRaw[y2 + x] =
                (gray[y0 + x] + gray[y1 + x] + gray[y2 + x] + gray[y3 + x] + gray[y4 + x]) * 0.2;
            }
          }

          const pDfH = new Float64Array(64);
          const pDvH = new Float64Array(64);
          const pCntH = new Uint32Array(64);
          const pDfV = new Float64Array(64);
          const pDvV = new Float64Array(64);
          const pCntV = new Uint32Array(64);
          const hm1 = Math.max(1, H - 1);
          const wm1 = Math.max(1, W - 1);

          for (let y = 0; y < H - 1; y++) {
            const py = Math.min(7, ((y * 8) / hm1) | 0);
            const row = y * W;
            const nextRow = (y + 1) * W;
            for (let x = 0; x < W - 1; x++) {
              const pxIdx = Math.min(7, ((x * 8) / wm1) | 0);
              const pIdx = py * 8 + pxIdx;

              const dfh = Math.abs(gray[row + x + 1] - gray[row + x]);
              if (dfh > 10.0) {
                const dbh = Math.abs(bhRaw[row + x + 1] - bhRaw[row + x]);
                pDfH[pIdx] += dfh;
                pDvH[pIdx] += dfh > dbh ? dfh - dbh : 0;
                pCntH[pIdx]++;
              }

              const dfv = Math.abs(gray[nextRow + x] - gray[row + x]);
              if (dfv > 10.0) {
                const dbv = Math.abs(bvRaw[nextRow + x] - bvRaw[row + x]);
                pDfV[pIdx] += dfv;
                pDvV[pIdx] += dfv > dbv ? dfv - dbv : 0;
                pCntV[pIdx]++;
              }
            }
          }

          const patchRawBlurs: number[] = [];
          for (let k = 0; k < 64; k++) {
            if (pCntH[k] >= 12 && pCntV[k] >= 12) {
              const pbh = 1.0 - pDvH[k] / (pDfH[k] + 1e-5);
              const pbv = 1.0 - pDvV[k] / (pDfV[k] + 1e-5);
              patchRawBlurs.push(Math.max(pbh, pbv));
            }
          }
          if (patchRawBlurs.length >= 2) {
            patchRawBlurs.sort((a, b) => a - b);
            const kTop = Math.min(3, patchRawBlurs.length);
            let sTop = 0;
            for (let i = 0; i < kTop; i++) sTop += patchRawBlurs[i];
            t3RawCrete = sTop / kTop;
          }

          // 4-B) 3x3 이항 평활화(gs) -> 7-tap(r=3) 수평/수직 재블러링으로 JPEG 링잉 완전 제거 후 전역 블러 산출
          const sw = W - 2;
          const sh = H - 2;
          const gs = new Float32Array(sw * sh);
          for (let y = 0; y < sh; y++) {
            const sy = y + 1;
            const rTop = (sy - 1) * W;
            const rMid = sy * W;
            const rBot = (sy + 1) * W;
            const outRow = y * sw;
            for (let x = 0; x < sw; x++) {
              const sx = x + 1;
              gs[outRow + x] =
                (gray[rMid + sx] * 4 +
                  (gray[rTop + sx] + gray[rBot + sx] + gray[rMid + sx - 1] + gray[rMid + sx + 1]) * 2 +
                  (gray[rTop + sx - 1] + gray[rTop + sx + 1] + gray[rBot + sx - 1] + gray[rBot + sx + 1])) *
                0.0625;
            }
          }

          const sbh = new Float32Array(sw * sh);
          const sbv = new Float32Array(sw * sh);
          const inv7 = 1 / 7;
          for (let y = 0; y < sh; y++) {
            const row = y * sw;
            for (let x = 0; x < sw; x++) {
              let acc = 0;
              for (let d = -3; d <= 3; d++) {
                const xx = x + d < 0 ? 0 : x + d >= sw ? sw - 1 : x + d;
                acc += gs[row + xx];
              }
              sbh[row + x] = acc * inv7;
            }
          }
          for (let y = 0; y < sh; y++) {
            const outRow = y * sw;
            const r0 = (y - 3 < 0 ? 0 : y - 3) * sw;
            const r1 = (y - 2 < 0 ? 0 : y - 2) * sw;
            const r2 = (y - 1 < 0 ? 0 : y - 1) * sw;
            const r4 = (y + 1 >= sh ? sh - 1 : y + 1) * sw;
            const r5 = (y + 2 >= sh ? sh - 1 : y + 2) * sw;
            const r6 = (y + 3 >= sh ? sh - 1 : y + 3) * sw;
            for (let x = 0; x < sw; x++) {
              sbv[outRow + x] =
                (gs[r0 + x] + gs[r1 + x] + gs[r2 + x] + gs[outRow + x] + gs[r4 + x] + gs[r5 + x] + gs[r6 + x]) * inv7;
            }
          }

          let sDfHSum = 0,
            sDvHSum = 0,
            sDfVSum = 0,
            sDvVSum = 0;
          for (let y = 0; y < sh; y++) {
            const row = y * sw;
            for (let x = 0; x < sw - 1; x++) {
              const df = Math.abs(gs[row + x + 1] - gs[row + x]);
              const db = Math.abs(sbh[row + x + 1] - sbh[row + x]);
              sDfHSum += df;
              if (df > db) sDvHSum += df - db;
            }
          }
          for (let y = 0; y < sh - 1; y++) {
            const row = y * sw;
            const nRow = (y + 1) * sw;
            for (let x = 0; x < sw; x++) {
              const df = Math.abs(gs[nRow + x] - gs[row + x]);
              const db = Math.abs(sbv[nRow + x] - sbv[row + x]);
              sDfVSum += df;
              if (df > db) sDvVSum += df - db;
            }
          }
          const sbH = 1.0 - sDvHSum / (sDfHSum + 1e-5);
          const sbV = 1.0 - sDvVSum / (sDfVSum + 1e-5);
          maxSmoothedCrete = Math.max(sbH, sbV);
          anisoSmoothedCrete = Math.abs(sbH - sbV);
        }

        // 방향성 손떨림(한 축 붕괴) 및 전역 초점 이탈은 소수의 모서리 노이즈·JPEG 블록으로 오구제되지 않도록 차단하고,
        // 실내 손·인물 보케 등 진짜 선명한 중앙 피사체만 안정적으로 보호합니다.
        const isMotionSmear = axisAnisotropy >= 1.38 && minAxisHf < 0.78;
        const isGlobalDefocus =
          hfRatio < 1.04 &&
          minAxisHf < 0.80 &&
          !(strictSharp4Patches >= 8 && centerSharp4Patches >= 6);

        const hasSharpForegroundSubject =
          !isMotionSmear &&
          !isGlobalDefocus &&
          ((sharp4AxisPatches >= 6 && centerSharp4Patches >= 4 && minAxisHf >= 0.78) ||
            (strictSharp4Patches >= 4 &&
              top4PatchHf >= 1.35 &&
              top4MinAxis >= 0.88 &&
              minAxisHf >= 0.76) ||
            (minAxisHf >= 0.82 && hfRatio >= 1.12 && edgeCount >= 80));

        const hasSharpBokehSubject = t3RawCrete <= 0.19;
        const isCreteBlurred =
          !hasSharpBokehSubject &&
          (maxSmoothedCrete >= 0.525 ||
            (anisoSmoothedCrete >= 0.08 && maxSmoothedCrete >= 0.51));

        const isCleanWhiteDoc = whitePct >= 58 && hfRatio >= 1.10;
        isMotionOrFocusBlurred =
          !isCleanWhiteDoc &&
          (isCreteBlurred ||
            (!hasSharpForegroundSubject &&
              !hasSharpBokehSubject &&
              (isMotionSmear ||
                isGlobalDefocus ||
                minAxisHf < 0.78 ||
                hfRatio < 1.08 ||
                top4PatchHf < 1.16 ||
                edgeCount < 30)));

        const acutanceScore = Math.round(
          Math.max(
            variance * 18.0 * Math.max(0.22, minAxisHf),
            hasSharpForegroundSubject || hasSharpBokehSubject ? 6200 * Math.max(0.5, top4MinAxis) : 800 * minAxisHf
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
  // [기획 정합] 보관 서류(isVaultDocument)는 정리 후보에서 영구 제외 (스마트 금고 전용)
  if (p.isVaultDocument) {
    return undefined;
  }
  if (tags.some((t) => t.includes('영수증') || t.includes('메모') || t.includes('주차'))) {
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

  // [O(N) 64-bit dHash 사전 정수화 + RGB 지연 계산 (1,231장 기준 1,800ms ➔ 1.5ms)]:
  // 75만 쌍 루프 내부에서 매번 parseInt 64회 및 Float32Array(64).sort() 150만 회를 돌던 메인스레드 병목을 제거하고,
  // 화면비·dHash 해밍거리를 먼저 통과한 극소수 후보 쌍(<0.4%)에 대해서만 8x8 RGB 그리드 정밀 비교를 수행합니다.
  const dhashWordsById = new Map<string, [number, number] | null>();
  for (let k = 0; k < sorted.length; k++) {
    const p = sorted[k];
    dhashWordsById.set(p.id, parseDhash64Words(p.dhash));
  }

  const visited = new Set<string>();
  const duplicateGroups: DuplicateGroup[] = [];
  const groupRoleByPhotoId = new Map<string, { groupId: string; isBest: boolean }>();

  for (let i = 0; i < sorted.length; i++) {
    const first = sorted[i];
    if (visited.has(first.id)) continue;
    const firstSig = opticalSigByPhotoId.get(first.id);
    const firstWords = dhashWordsById.get(first.id);

    const members: PhotoItem[] = [first];
    let maxDist = 0;
    let maxDeltaSec = 0;

    for (let j = i + 1; j < sorted.length; j++) {
      const cand = sorted[j];
      if (visited.has(cand.id)) continue;
      const candSig = opticalSigByPhotoId.get(cand.id);
      const candWords = dhashWordsById.get(cand.id);

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
      if (!sameAspect) continue;

      const distToFirst = hammingDistanceWords(firstWords, candWords);
      if (isDocumentOrWhiteSheet && distToFirst > 2) continue;

      const last = members[members.length - 1];
      const distToLast =
        last.id === first.id
          ? distToFirst
          : hammingDistanceWords(dhashWordsById.get(last.id), candWords);

      // Track A(distToFirst <= 16 또는 distToLast <= 15) 및 Track B(distToFirst <= 17 && distToLast <= 14) 상한 밖이면 RGB 연산 즉시 스킵
      if (distToFirst > 17 && distToLast > 15) continue;

      const lastSig = last.id === first.id ? firstSig : opticalSigByPhotoId.get(last.id);
      const deltaSecFromFirst = Math.abs((cand.mtimeMs || 0) - (first.mtimeMs || 0)) / 1000;
      const deltaSecFromLast = Math.abs((cand.mtimeMs || 0) - (last.mtimeMs || 0)) / 1000;

      const hasBothRgb =
        Boolean(firstSig?.rgbGrid && firstSig.rgbGrid.length === 192) &&
        Boolean(candSig?.rgbGrid && candSig.rgbGrid.length === 192);

      let rgbToFirstCache: ReturnType<typeof computeRgbGridDifference> | null = null;
      const getRgbToFirst = () => {
        if (!rgbToFirstCache) {
          rgbToFirstCache = computeRgbGridDifference(firstSig?.rgbGrid, candSig?.rgbGrid);
        }
        return rgbToFirstCache;
      };
      let rgbToLastCache: ReturnType<typeof computeRgbGridDifference> | null = null;
      const getRgbToLast = () => {
        if (last.id === first.id) return getRgbToFirst();
        if (!rgbToLastCache) {
          rgbToLastCache = computeRgbGridDifference(lastSig?.rgbGrid, candSig?.rgbGrid);
        }
        return rgbToLastCache;
      };

      // 1) 트랙 A: 동일 사진 중복 사본 및 미세 구도 이동(3~6% 손 이동·줌) 쌍둥이 촬영본 (EXIF/저장 시각 차이와 무관하게 포착)
      const isExactDuplicateCopy = hasBothRgb
        ? (distToFirst <= 2 &&
            getRgbToFirst().meanDiff <= 5.5 &&
            getRgbToFirst().maxBlockDiff <= 24) ||
          (!isDocumentOrWhiteSheet &&
            distToFirst <= 13 &&
            getRgbToFirst().meanDiff <= 18.5 &&
            getRgbToFirst().maxBlockDiff <= 56) ||
          (!isDocumentOrWhiteSheet &&
            distToFirst <= 16 &&
            getRgbToFirst().meanDiff <= 16.5 &&
            getRgbToFirst().p90BlockDiff <= 29.0 &&
            getRgbToFirst().centerMeanDiff <= 15.0 &&
            getRgbToFirst().centerMaxBlockDiff <= 44.0) ||
          (!isDocumentOrWhiteSheet &&
            distToLast <= 11 &&
            getRgbToLast().meanDiff <= 17.0 &&
            getRgbToLast().maxBlockDiff <= 52) ||
          (!isDocumentOrWhiteSheet &&
            distToLast <= 15 &&
            getRgbToLast().meanDiff <= 15.5 &&
            getRgbToLast().p90BlockDiff <= 27.5 &&
            getRgbToLast().centerMeanDiff <= 14.0 &&
            getRgbToLast().centerMaxBlockDiff <= 42.0)
        : isDocumentOrWhiteSheet
        ? distToFirst <= 2
        : distToFirst <= 10;

      // 2) 트랙 B: 실제 카메라 연속 촬영 연사 (백색 문서 페이지가 아닌 실사 촬영본에 한해 허용)
      const isCameraBurstShot =
        !isDocumentOrWhiteSheet &&
        deltaSecFromFirst <= 120 &&
        deltaSecFromLast <= 45 &&
        (hasBothRgb
          ? (distToFirst <= 15 &&
              distToLast <= 12 &&
              getRgbToFirst().meanDiff <= 20.0 &&
              getRgbToFirst().maxBlockDiff <= 58 &&
              getRgbToLast().meanDiff <= 18.0) ||
            (distToFirst <= 17 &&
              distToLast <= 14 &&
              getRgbToFirst().meanDiff <= 18.0 &&
              getRgbToFirst().p90BlockDiff <= 30.0 &&
              getRgbToFirst().centerMaxBlockDiff <= 46.0)
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
        // [기획 정합] 신분증·여권·계약서·세금계산서 등 보관 서류는 스마트 금고 전용(정리·삭제 후보 절대 제외),
        // 영수증·메모·주차 사진만 ② 주차·영수증·메모 탭 정리 후보로 분류합니다.
        const isPermanentDoc = PERMANENT_DOC_NAME_PATTERN.test(lowerName);
        const isReceiptOrDoc = isPermanentDoc || RECEIPT_MEMO_PARKING_NAME_PATTERN.test(lowerName);
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
        } else if (isPermanentDoc) {
          tags.unshift('#보관서류');
          } else if (isReceiptOrDoc) {
          trashCategory = 'memo';
          tags.unshift('#영수증·메모');
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
          isVaultDocument: isPermanentDoc,
          vaultCategoryLabel: isPermanentDoc ? '스마트폰 촬영 보관 서류' : undefined,
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
const OPTICAL_AUDIT_IDB_NAME = 'ghosti_optical_audit_v6';
const OPTICAL_AUDIT_IDB_STORE = 'optical_sigs';
let opticalAuditDbInstance: IDBDatabase | null = null;
let opticalAuditDbPromise: Promise<IDBDatabase | null> | null = null;
let opticalAuditHydratePromise: Promise<void> | null = null;
let isOpticalPageUnloading = false;

if (typeof window !== 'undefined') {
  const onOpticalPageUnload = () => {
    isOpticalPageUnloading = true;
    if (opticalAuditDbInstance) {
      try {
        opticalAuditDbInstance.close();
      } catch {
        /* ignore */
      }
      opticalAuditDbInstance = null;
      opticalAuditDbPromise = null;
    }
  };
  window.addEventListener('pagehide', onOpticalPageUnload);
  window.addEventListener('beforeunload', onOpticalPageUnload);
}

function openOpticalAuditDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined' || isOpticalPageUnloading) return Promise.resolve(null);
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
      req.onsuccess = () => {
        if (isOpticalPageUnloading) {
          try {
            req.result.close();
          } catch {
            /* ignore */
          }
          resolve(null);
          return;
        }
        opticalAuditDbInstance = req.result;
        resolve(req.result);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opticalAuditDbPromise;
}

const OPTICAL_CLUSTER_SESSION_CACHE_KEY = 'ghosti_pc_optical_cluster_snapshot_v2';

export interface CachedPcCleanupSnapshot {
  photos: PhotoItem[];
  duplicateGroups: DuplicateGroup[];
  savedAt: number;
}

export function loadSessionCachedPcCleanupSnapshot(): CachedPcCleanupSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(OPTICAL_CLUSTER_SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPcCleanupSnapshot;
    if (
      !parsed ||
      !Array.isArray(parsed.photos) ||
      parsed.photos.length === 0 ||
      !Array.isArray(parsed.duplicateGroups)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSessionCachedPcCleanupSnapshot(
  photos: PhotoItem[],
  duplicateGroups: DuplicateGroup[]
): void {
  if (typeof window === 'undefined') return;
  try {
    if (!Array.isArray(photos) || photos.length === 0) return;
    const payload: CachedPcCleanupSnapshot = {
      photos: photos.slice(0, 1500).map((p) => ({
        id: p.id,
        name: p.name,
        fullPath: p.fullPath,
        folderName: p.folderName,
        deviceSource: p.deviceSource,
        size: p.size,
        date: p.date,
        mtimeMs: p.mtimeMs,
        thumbUrl: p.thumbUrl,
        fullUrl: p.fullUrl,
        tags: p.tags,
        locationKo: p.locationKo,
        isVaultDocument: p.isVaultDocument,
        vaultCategoryLabel: p.vaultCategoryLabel,
        trashCategory: p.trashCategory,
        intrinsicTrashCategory: p.intrinsicTrashCategory,
        trashConfidence: p.trashConfidence,
        duplicateGroupId: p.duplicateGroupId,
        lastDuplicateGroupId: p.lastDuplicateGroupId,
        isBestInDuplicateGroup: p.isBestInDuplicateGroup,
        userKeptAsBest: p.userKeptAsBest,
        opticalSharpness: p.opticalSharpness,
        dhash: p.dhash,
        quarantined: p.quarantined,
      })),
      duplicateGroups,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(OPTICAL_CLUSTER_SESSION_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota error */
  }
}

function hydratePcOpticalAuditCacheOnce(): Promise<void> {
  if (isOpticalPageUnloading) return Promise.resolve();
  if (opticalAuditHydratePromise) return opticalAuditHydratePromise;
  opticalAuditHydratePromise = (async () => {
    const db = await openOpticalAuditDb();
    if (!db || isOpticalPageUnloading) return;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(OPTICAL_AUDIT_IDB_STORE, 'readonly');
        const st = tx.objectStore(OPTICAL_AUDIT_IDB_STORE);
        if (typeof st.getAll === 'function') {
          const reqAll = st.getAll();
          reqAll.onsuccess = () => {
            if (!isOpticalPageUnloading && Array.isArray(reqAll.result)) {
              for (const row of reqAll.result as Array<{ key?: string; meta?: OpticalSignatureMeta }>) {
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
            }
            resolve();
          };
          reqAll.onerror = () => resolve();
          return;
        }
        const req = st.openCursor();
        req.onsuccess = () => {
          if (isOpticalPageUnloading) {
            resolve();
            return;
          }
          const cursor = req.result;
          if (!cursor) {
            resolve();
            return;
          }
          const row = cursor.value as { key: string; meta: OpticalSignatureMeta } | undefined;
          if (row?.key && row.meta && !pcOpticalAuditCache.has(row.key)) {
            pcOpticalAuditCache.set(row.key, {
              ...row.meta,
              rgbGrid:
                row.meta.rgbGrid instanceof Uint8Array
                  ? row.meta.rgbGrid
                  : new Uint8Array(Object.values(row.meta.rgbGrid || {})),
            });
          }
          cursor.continue();
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

export const PC_OPTICAL_AUDIT_EVENT = 'ghosti_pc_optical_audit_state';
let pcOpticalAuditInProgress = false;

export function isPcOpticalAuditInProgress(): boolean {
  return pcOpticalAuditInProgress;
}

function setPcOpticalAuditInProgress(next: boolean): void {
  if (pcOpticalAuditInProgress === next) return;
  pcOpticalAuditInProgress = next;
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new Event(PC_OPTICAL_AUDIT_EVENT));
    } catch {
      /* ignore */
    }
  }
}

function applyOpticalMetaToPhoto(p: PhotoItem, meta: OpticalSignatureMeta): void {
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
}

/**
 * [새로고침(F5) 첫 화면 0.05초 무깜빡임 복원]:
 * IndexedDB에 이미 저장된 광학 해시(pcOpticalAuditCache)를 이미지 네트워크 재로딩 없이 즉시 입혀,
 * 가짜 파일명 기준 4세트 ➔ 실제 광학 56세트로 화면이 두 번 튀는 현상을 원천 제거합니다.
 */
export async function applyCachedPcOpticalAuditInstant(photos: PhotoItem[]): Promise<{
  updatedPhotos: PhotoItem[];
  duplicateGroups: DuplicateGroup[];
  cachedHits: number;
  uncachedCount: number;
}> {
  const isSample = (name: string) =>
    /^(IMG_2025|PET_2025|TRV_2025|DOC_2025|MEMO_2025|Screenshot_2025|BLUR_2025)/.test(name);
  const isRemoteOrShared = (p: PhotoItem) => {
    const id = String(p.id || '');
    const fp = String(p.fullPath || '');
    return (
      id.startsWith('shadow-remote-') ||
      id.startsWith('shared_sb_') ||
      id.startsWith('shared_added_') ||
      /^s:[\\/]/i.test(fp)
    );
  };
  const cloned = photos.map((p) => ({ ...p, tags: [...(p.tags || [])] }));
  const realCandidates = cloned.filter((p) => !p.quarantined && !isSample(p.name) && !isRemoteOrShared(p));
  if (realCandidates.length === 0) {
    return { updatedPhotos: cloned, duplicateGroups: [], cachedHits: 0, uncachedCount: 0 };
  }

  await hydratePcOpticalAuditCacheOnce();

  let cachedHits = 0;
  let uncachedCount = 0;
  for (const p of realCandidates) {
    const cacheKey = `${p.name}_${p.size}_${p.mtimeMs}`;
    const cached = pcOpticalAuditCache.get(cacheKey);
    if (cached) {
      applyOpticalMetaToPhoto(p, cached);
      cachedHits++;
    } else {
      uncachedCount++;
    }
  }

  if (cachedHits === 0 && uncachedCount > 0) {
    // 최초 1회 미캐시 PC에서는 광학 스캔 완료 전 정적 duplicate 분류만 남아 '42장 vs 0세트' 불일치가 생기지 않도록 정리 후 스캔 완료 시 일괄 표시
    for (const p of cloned) {
      if (!p.quarantined && p.trashCategory === 'duplicate') {
        p.trashCategory = resolveIntrinsicPhotoTrashCategory({ ...p, trashCategory: undefined });
        p.duplicateGroupId = undefined;
        p.isBestInDuplicateGroup = false;
      }
    }
    setPcOpticalAuditInProgress(true);
    return { updatedPhotos: cloned, duplicateGroups: [], cachedHits: 0, uncachedCount };
  }

  const clustered = clusterPhotosIntoDuplicateGroups(
    cloned.filter((p) => !isSample(p.name) && !isRemoteOrShared(p))
  );
  // 원격/공유/업무공유 S: 사진은 개인 정리 클러스터링 대상에서 제외하되 photos 배열 내 검색용 항목은 손실 없이 유지
  const remoteOrSharedKept = cloned.filter((p) => isRemoteOrShared(p));
  const finalPhotos =
    remoteOrSharedKept.length > 0
      ? [...clustered.updatedPhotos, ...remoteOrSharedKept]
      : clustered.updatedPhotos;
  saveSessionCachedPcCleanupSnapshot(clustered.updatedPhotos, clustered.duplicateGroups);
  return {
    updatedPhotos: finalPhotos,
    duplicateGroups: clustered.duplicateGroups,
    cachedHits,
    uncachedCount,
  };
}

let inFlightPcOpticalAuditPromise: Promise<{ updatedPhotos: PhotoItem[]; duplicateGroups: DuplicateGroup[] }> | null =
  null;

export async function auditRealPcPhotosAndCluster(
  photos: PhotoItem[]
): Promise<{ updatedPhotos: PhotoItem[]; duplicateGroups: DuplicateGroup[] }> {
  if (inFlightPcOpticalAuditPromise) {
    return inFlightPcOpticalAuditPromise;
  }
  const run = async (): Promise<{ updatedPhotos: PhotoItem[]; duplicateGroups: DuplicateGroup[] }> => {
    const isSample = (name: string) =>
      /^(IMG_2025|PET_2025|TRV_2025|DOC_2025|MEMO_2025|Screenshot_2025|BLUR_2025)/.test(name);
    const isRemoteOrShared = (p: PhotoItem) => {
      const id = String(p.id || '');
      const fp = String(p.fullPath || '');
      return (
        id.startsWith('shadow-remote-') ||
        id.startsWith('shared_sb_') ||
        id.startsWith('shared_added_') ||
        /^s:[\\/]/i.test(fp)
      );
    };

    const cloned = photos.map((p) => ({ ...p, tags: [...(p.tags || [])] }));
    const realCandidates = cloned.filter((p) => !p.quarantined && !isSample(p.name) && !isRemoteOrShared(p));
    if (realCandidates.length === 0) {
      setPcOpticalAuditInProgress(false);
      return { updatedPhotos: cloned, duplicateGroups: [] };
    }

    setPcOpticalAuditInProgress(true);
    try {
      await hydratePcOpticalAuditCacheOnce();

      // /__photos/list 최대치(2000)와 일치시켜 새로고침·재연결 전후 후보 장수 일관성 100% 보장
      const targetSlice = realCandidates.slice(0, 2000);
      const uncachedSlice: PhotoItem[] = [];

      for (const p of targetSlice) {
        const cacheKey = `${p.name}_${p.size}_${p.mtimeMs}`;
        const cached = pcOpticalAuditCache.get(cacheKey);
        if (cached) {
          applyOpticalMetaToPhoto(p, cached);
        } else {
          uncachedSlice.push(p);
        }
      }

      if (uncachedSlice.length > 0) {
        const BATCH = 8;
        const newlyComputed: Array<{ key: string; meta: OpticalSignatureMeta }> = [];
        const auditOne = (p: PhotoItem): Promise<void> => {
          const cacheKey = `${p.name}_${p.size}_${p.mtimeMs}`;
          return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            let settled = false;
            const finish = () => {
              if (settled) return;
              settled = true;
              window.clearTimeout(timer);
              resolve();
            };
            const timer = window.setTimeout(finish, 6000);
            img.onload = () => {
              const meta = computeOpticalDhashAndSharpness(img);
              pcOpticalAuditCache.set(cacheKey, meta);
              newlyComputed.push({ key: cacheKey, meta });
              applyOpticalMetaToPhoto(p, meta);
              finish();
            };
            const primaryUrl = p.thumbUrl || p.fullUrl;
            const fallbackUrl = p.thumbUrl && p.fullUrl && p.fullUrl !== p.thumbUrl ? p.fullUrl : '';
            let retryStage = 0;
            img.onerror = () => {
              if (settled) return;
              if (retryStage === 0 && primaryUrl) {
                retryStage = 1;
                const sep = primaryUrl.includes('?') ? '&' : '?';
                window.setTimeout(() => {
                  if (!settled) img.src = `${primaryUrl}${sep}_r=1`;
                }, 350);
                return;
              }
              if (retryStage < 2 && fallbackUrl) {
                retryStage = 2;
                img.src = fallbackUrl;
                return;
              }
              finish();
            };
            img.src = primaryUrl;
          });
        };

        for (let i = 0; i < uncachedSlice.length; i += BATCH) {
          if (isOpticalPageUnloading) break;
          if (i > 0 && i % 24 === 0) {
            await waitForUserTypingAndModalQuiet(220);
          }
          await Promise.all(uncachedSlice.slice(i, i + BATCH).map(auditOne));
          // 매 배치(8장) 즉시 IndexedDB에 영구 반영해 새로고침을 중간에 눌러도 캐시 편차가 생기지 않도록 보장
          if (newlyComputed.length > 0) {
            persistOpticalAuditBatch(newlyComputed.splice(0, newlyComputed.length));
          }
          if (i + BATCH < uncachedSlice.length) {
            await new Promise((r) => setTimeout(r, 8));
          }
        }
      }

      const clustered = clusterPhotosIntoDuplicateGroups(
        cloned.filter((p) => !isSample(p.name) && !isRemoteOrShared(p))
      );
      const remoteOrSharedKept = cloned.filter((p) => isRemoteOrShared(p));
      saveSessionCachedPcCleanupSnapshot(clustered.updatedPhotos, clustered.duplicateGroups);
      return {
        updatedPhotos:
          remoteOrSharedKept.length > 0
            ? [...clustered.updatedPhotos, ...remoteOrSharedKept]
            : clustered.updatedPhotos,
        duplicateGroups: clustered.duplicateGroups,
      };
    } finally {
      setPcOpticalAuditInProgress(false);
    }
  };

  inFlightPcOpticalAuditPromise = run().finally(() => {
    inFlightPcOpticalAuditPromise = null;
  });
  return inFlightPcOpticalAuditPromise;
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
        // [기획 정합] 신분증·여권·계약서·세금계산서 등 보관 서류는 스마트 금고 전용(정리·삭제 후보 절대 제외),
        // 영수증·메모·주차 사진만 ② 주차·영수증·메모 탭 정리 후보로 분류합니다.
        const isPermanentDoc = PERMANENT_DOC_NAME_PATTERN.test(lowerName);
        const isReceiptOrDoc = isPermanentDoc || RECEIPT_MEMO_PARKING_NAME_PATTERN.test(lowerName);
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
        } else if (isPermanentDoc) {
          tags.unshift('#보관서류');
          } else if (isReceiptOrDoc) {
          trashCategory = 'memo';
          tags.unshift('#영수증·메모');
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
          isVaultDocument: isPermanentDoc,
          vaultCategoryLabel: isPermanentDoc ? '스마트폰 촬영 보관 서류' : undefined,
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
const MOBILE_GALLERY_CACHE_SCHEMA_VER = 11;
export const MOBILE_VIDEO_OCR_VER = 33;

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

export const SHOWROOM_SAMPLE_PHOTO_NAME_RE =
  /^(IMG_2025|PET_2025|TRV_2025|DOC_2025|MEMO_2025|Screenshot_2025|BLUR_2025)/;

export function isShowroomSamplePhotoName(name: string): boolean {
  return SHOWROOM_SAMPLE_PHOTO_NAME_RE.test(String(name || ''));
}

export function isRemoteOrSharedPhotoItem(p: PhotoItem): boolean {
  const id = String(p?.id || '');
  const fp = String(p?.fullPath || '');
  return (
    id.startsWith('shadow-remote-') ||
    id.startsWith('shared_sb_') ||
    id.startsWith('shared_added_') ||
    /^s:[\\/]/i.test(fp)
  );
}

export function matchesPhotoTrashTab(photo: PhotoItem, tabKey: string): boolean {
  if (!photo.trashCategory || photo.quarantined) return false;
  if (tabKey === 'all') return true;
  if (tabKey === 'memo') {
    return (
      photo.trashCategory === 'memo' ||
      photo.trashCategory === 'object' ||
      photo.trashCategory === 'document' ||
      photo.trashCategory === 'receipt'
    );
  }
  return photo.trashCategory === tabKey;
}

export interface LocalPhotoCleanupSummary {
  displayPhotos: PhotoItem[];
  activeLocalPhotos: PhotoItem[];
  quarantinedPhotos: PhotoItem[];
  activeTrash: PhotoItem[];
  activeDuplicateGroups: DuplicateGroup[];
  totalLocalPhotoCount: number;
  quarantinedCount: number;
  totalCandidateCount: number;
  totalCandidateBytes: number;
  dupPhotoCount: number;
  dupSetCount: number;
  memoCount: number;
  screenshotCount: number;
  memoAndScreenCount: number;
  blurryCount: number;
}

/**
 * 좌측 사진 정리 워크스페이스와 우측 귀신비서 대화창이 1장 오차 없이 동일한 수치를 안내하도록 보장하는 단일 SSOT 집계 함수.
 * - 원격 기기 동기화 썸네일(shadow-remote-*), 공유방 사진, 업무용 S: 드라이브, 쇼룸 샘플 사진을 일관되게 제외합니다.
 */
export function computeLocalPhotoCleanupSummary(
  photos: PhotoItem[],
  duplicateGroups: DuplicateGroup[],
  options?: {
    skippedGroupIds?: ReadonlySet<string>;
    isDesktopWebMode?: boolean;
    zConnected?: boolean;
    isRealDeviceModeOverride?: boolean;
  }
): LocalPhotoCleanupSummary {
  const skippedGroupIds = options?.skippedGroupIds ?? new Set<string>();
  const localOnlyPhotos = (photos || []).filter((p) => p && !isRemoteOrSharedPhotoItem(p));
  const hasAnyRealUserPhoto = localOnlyPhotos.some((p) => !isShowroomSamplePhotoName(p.name));

  let displayPhotos: PhotoItem[];
  if (options?.isDesktopWebMode) {
    displayPhotos = options.zConnected
      ? localOnlyPhotos.filter((p) => !isShowroomSamplePhotoName(p.name))
      : [];
  } else {
    const isRealDevice =
      options?.isRealDeviceModeOverride !== undefined
        ? options.isRealDeviceModeOverride
        : Boolean(options?.zConnected) || hasAnyRealUserPhoto;
    displayPhotos = isRealDevice
      ? localOnlyPhotos.filter((p) => !isShowroomSamplePhotoName(p.name))
      : localOnlyPhotos;
  }

  const skippedPhotoIds = new Set<string>();
  if (skippedGroupIds.size > 0) {
    (duplicateGroups || []).forEach((g) => {
      if (skippedGroupIds.has(g.groupId)) {
        g.photoIds.forEach((pid) => skippedPhotoIds.add(pid));
      }
    });
  }

  const activeLocalPhotos = displayPhotos.filter((p) => !p.quarantined);
  const quarantinedPhotos = displayPhotos.filter((p) => Boolean(p.quarantined));
  const activeTrash = displayPhotos.filter(
    (p) => Boolean(p.trashCategory) && !p.quarantined && !skippedPhotoIds.has(p.id)
  );
  const totalCandidateBytes = activeTrash.reduce((acc, p) => acc + (p.size || 0), 0);

  const dupPhotoCount = activeTrash.filter((p) => matchesPhotoTrashTab(p, 'duplicate')).length;
  const memoCount = activeTrash.filter((p) => matchesPhotoTrashTab(p, 'memo')).length;
  const screenshotCount = activeTrash.filter((p) => matchesPhotoTrashTab(p, 'screenshot')).length;
  const blurryCount = activeTrash.filter((p) => matchesPhotoTrashTab(p, 'blurry')).length;
  const memoAndScreenCount = memoCount + screenshotCount;

  const photoById = new Map(displayPhotos.map((p) => [p.id, p]));
  const activeDuplicateGroups = (duplicateGroups || []).filter(
    (g) =>
      !skippedGroupIds.has(g.groupId) &&
      g.photoIds.some((id) => {
        const ph = photoById.get(id);
        return Boolean(ph && !ph.quarantined && id !== g.bestPhotoId);
      })
  );

  return {
    displayPhotos,
    activeLocalPhotos,
    quarantinedPhotos,
    activeTrash,
    activeDuplicateGroups,
    totalLocalPhotoCount: activeLocalPhotos.length,
    quarantinedCount: quarantinedPhotos.length,
    totalCandidateCount: activeTrash.length,
    totalCandidateBytes,
    dupPhotoCount,
    dupSetCount: activeDuplicateGroups.length,
    memoCount,
    screenshotCount,
    memoAndScreenCount,
    blurryCount,
  };
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
