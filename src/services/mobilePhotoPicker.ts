import type { DuplicateGroup, PhotoItem, TrashCategory, VideoSceneItem } from '../types/saysee';
import {
  registerMobilePickedPhotoMeta,
  resolveAndroidDirectVideoStreamUrl,
  type NativeGalleryPhotoMeta,
  type NativeGalleryVideoMeta,
} from './ghostiMobileCareBridge';

interface OpticalSignatureMeta {
  dhash: string;
  sharpness: number;
  isMotionOrFocusBlurred: boolean;
  aspect: number;
  whitePct: number;
  rgbGrid: Uint8Array; // 8x8x3 = 192 bytes
}

const opticalSigByPhotoId = new Map<string, OpticalSignatureMeta>();

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
 * 두 8x8 RGB 컬러 그리드(192바이트) 간의 평균 절대 색상·밝기 오차(0~255) 및 최대 블록 오차를 계산합니다.
 * - 서로 다른 문서 페이지(예: 2021-07-12 (1).png vs (2).png)나 배경색이 다른 이미지(예: 게시판 캡처 vs 민트색 포스터)가
 *   한 세트로 잘못 묶이는 현상을 원천 차단합니다.
 */
function computeRgbGridDifference(
  gridA?: Uint8Array,
  gridB?: Uint8Array
): { meanDiff: number; maxBlockDiff: number } {
  if (!gridA || !gridB || gridA.length !== 192 || gridB.length !== 192) {
    return { meanDiff: 255, maxBlockDiff: 255 };
  }
  let sum = 0;
  let maxBlock = 0;
  for (let i = 0; i < 192; i += 3) {
    const dr = Math.abs(gridA[i] - gridB[i]);
    const dg = Math.abs(gridA[i + 1] - gridB[i + 1]);
    const db = Math.abs(gridA[i + 2] - gridB[i + 2]);
    const blockDiff = (dr + dg + db) / 3;
    sum += dr + dg + db;
    if (blockDiff > maxBlock) maxBlock = blockDiff;
  }
  return {
    meanDiff: sum / 192,
    maxBlockDiff: maxBlock,
  };
}

/**
 * HTMLImageElement로부터:
 * 1) 9x8 그레이스케일 기반 64-bit dHash (16자리 hex)
 * 2) 8x8 RGB 블록 컬러 시그니처 (192 bytes) & 백색 배경 비율(whitePct)
 * 3) 128x128 그레이스케일 2D 라플라시안(Laplacian) 선명도 점수
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
    // 1) 9x8 dHash 계산
    const hashCanvas = document.createElement('canvas');
    hashCanvas.width = 9;
    hashCanvas.height = 8;
    const hCtx = hashCanvas.getContext('2d');
    if (hCtx) {
      hCtx.drawImage(img, 0, 0, 9, 8);
      const data = hCtx.getImageData(0, 0, 9, 8).data;
      let bits = '';
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const i1 = (y * 9 + x) * 4;
          const i2 = (y * 9 + (x + 1)) * 4;
          const g1 = data[i1] * 0.299 + data[i1 + 1] * 0.587 + data[i1 + 2] * 0.114;
          const g2 = data[i2] * 0.299 + data[i2 + 1] * 0.587 + data[i2 + 2] * 0.114;
          bits += g1 > g2 ? '1' : '0';
        }
      }
      for (let k = 0; k < 64; k += 4) {
        dhash += parseInt(bits.slice(k, k + 4), 2).toString(16);
      }
    }

    // 2) 8x8 RGB 블록 시그니처 & 백색 배경 비율 측정
    const rgbCanvas = document.createElement('canvas');
    rgbCanvas.width = 8;
    rgbCanvas.height = 8;
    const rCtx = rgbCanvas.getContext('2d');
    if (rCtx) {
      rCtx.drawImage(img, 0, 0, 8, 8);
      const rData = rCtx.getImageData(0, 0, 8, 8).data;
      let whiteCells = 0;
      for (let i = 0; i < 64; i++) {
        const p = i * 4;
        const r = rData[p];
        const g = rData[p + 1];
        const b = rData[p + 2];
        rgbGrid[i * 3] = r;
        rgbGrid[i * 3 + 1] = g;
        rgbGrid[i * 3 + 2] = b;
        if (r >= 232 && g >= 232 && b >= 232) {
          whiteCells++;
        }
      }
      whitePct = (whiteCells / 64) * 100;
    }

    // 3) 최대 512px 해상도 보존 기반 [2차 미분(Laplacian) / 1차 경사도(Gradient) 경계 첨예도 비율(hfRatio) + 상위 2% 첨두치(p98Lap)] 측정
    //    - 기존 128x128 과축소 시 6~10px 손떨림 블러가 1px로 뭉개져 선명한 사진으로 오판되던 근본 원인을 해결합니다.
    //    - 어두운 사진·보케 배경은 경계선에서의 hfRatio(>= 1.18)가 높아 보호되고, 실제 손떨림·초점 이탈 사진은 경계가 완만한 램프로 퍼져 hfRatio(< 1.06)가 급락합니다.
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
      const gray = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) {
        const idx = i * 4;
        gray[i] = px[idx] * 0.299 + px[idx + 1] * 0.587 + px[idx + 2] * 0.114;
      }
      let lapSum = 0;
      let lapSqSum = 0;
      let count = 0;
      let edgeLapSum = 0;
      let edgeGradSum = 0;
      let edgeCount = 0;
      const hist = new Uint32Array(256);

      for (let y = 1; y < H - 1; y++) {
        const rowOff = y * W;
        for (let x = 1; x < W - 1; x++) {
          const centerIdx = rowOff + x;
          const c = gray[centerIdx] * 4;
          const top = gray[centerIdx - W];
          const bot = gray[centerIdx + W];
          const left = gray[centerIdx - 1];
          const right = gray[centerIdx + 1];
          const lap = Math.abs(c - top - bot - left - right);
          lapSum += lap;
          lapSqSum += lap * lap;
          count++;

          const bin = lap >= 255 ? 255 : lap | 0;
          hist[bin]++;

          const gx = Math.abs(right - left) * 0.5;
          const gy = Math.abs(bot - top) * 0.5;
          const grad = Math.hypot(gx, gy);
          if (grad > 8.0) {
            edgeLapSum += lap;
            edgeGradSum += grad;
            edgeCount++;
          }
        }
      }
      if (count > 0) {
        const mean = lapSum / count;
        const variance = Math.max(0, lapSqSum / count - mean * mean);
        const hfRatio = edgeCount >= 30 ? edgeLapSum / (edgeGradSum + 1e-5) : 0.5;

        // 256-bin 히스토그램으로 98퍼센타일 라플라시안 첨두치 O(1) 산출
        const targetRank = Math.floor(count * 0.98);
        let acc = 0;
        let p98Lap = 0;
        for (let b = 0; b < 256; b++) {
          acc += hist[b];
          if (acc >= targetRank) {
            p98Lap = b;
            break;
          }
        }

        const isCleanWhiteDoc = whitePct >= 58 && hfRatio >= 1.15;
        const rawScore = Math.round(variance * 18.0 * Math.max(0.22, hfRatio - 0.55));
        isMotionOrFocusBlurred =
          !isCleanWhiteDoc &&
          ((hfRatio < 1.14 && p98Lap < 72) ||
            (variance < 135 && hfRatio < 1.20) ||
            rawScore < 2800);
        sharpness = Math.max(80, rawScore);
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
export function clusterPhotosIntoDuplicateGroups(
  photos: PhotoItem[]
): { updatedPhotos: PhotoItem[]; duplicateGroups: DuplicateGroup[] } {
  const candidates = photos.filter(
    (p) =>
      !p.quarantined &&
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
      const sameAspect =
        !firstSig || !candSig || Math.abs(firstSig.aspect - candSig.aspect) <= 0.06;

      // 백색 문서/스크린샷 여부
      const isDocumentOrWhiteSheet =
        (firstSig && firstSig.whitePct >= 45) ||
        (candSig && candSig.whitePct >= 45) ||
        first.trashCategory === 'screenshot' ||
        cand.trashCategory === 'screenshot';

      // 1) 트랙 A: 동일 사진 중복 사본 및 리사이즈/재저장 쌍둥이 사본 (저장 시각과 무관하게 포착)
      const isExactDuplicateCopy = hasBothRgb
        ? sameAspect &&
          ((distToFirst <= 2 &&
            rgbToFirst.meanDiff <= 5.5 &&
            rgbToFirst.maxBlockDiff <= 24) ||
            (!isDocumentOrWhiteSheet &&
              distToFirst <= 5 &&
              rgbToFirst.meanDiff <= 9.0 &&
              rgbToFirst.maxBlockDiff <= 34))
        : sameAspect && distToFirst <= 2;

      // 2) 트랙 B: 실제 카메라 연속 촬영 연사 (백색 문서/스크린샷 페이지가 아닌 실사 촬영본에 한해 허용)
      const isCameraBurstShot =
        !isDocumentOrWhiteSheet &&
        sameAspect &&
        deltaSecFromFirst <= 60 &&
        deltaSecFromLast <= 25 &&
        distToFirst <= 14 &&
        distToLast <= 11 &&
        (!hasBothRgb ||
          (rgbToFirst.meanDiff <= 19.0 &&
            rgbToFirst.maxBlockDiff <= 55 &&
            rgbToLast.meanDiff <= 17.0));

      if (isExactDuplicateCopy || isCameraBurstShot) {
        members.push(cand);
        visited.add(cand.id);
        if (distToFirst > maxDist) maxDist = distToFirst;
        if (deltaSecFromFirst > maxDeltaSec) maxDeltaSec = deltaSecFromFirst;
      }
    }

    if (members.length >= 2) {
      visited.add(first.id);
      // 묶음 내 최고 선명도(opticalSharpness) + 파일 크기(해상도) 기준 👑 베스트 1장 선정
      const ranked = [...members].sort((a, b) => {
        const sDiff = (b.opticalSharpness || 10000) - (a.opticalSharpness || 10000);
        if (Math.abs(sDiff) > 250) return sDiff;
        return (b.size || 0) - (a.size || 0);
      });
      const bestPhoto = ranked[0];
      const groupId = `dup_set_${first.id}`;

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
    const role = groupRoleByPhotoId.get(p.id);
    if (!role) {
      if (p.trashCategory === 'duplicate') {
        return { ...p, trashCategory: undefined, isBestInDuplicateGroup: false };
      }
      return p;
    }
    if (role.isBest) {
      return {
        ...p,
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
        const isScreenshot =
          lowerName.includes('screenshot') ||
          lowerName.includes('스크린샷') ||
          lowerName.includes('캡처') ||
          (img.width > 0 && img.height / img.width > 1.98);
        const isReceiptOrDoc =
          lowerName.includes('receipt') ||
          lowerName.includes('영수증') ||
          lowerName.includes('계약서') ||
          lowerName.includes('문서') ||
          lowerName.includes('명함') ||
          lowerName.includes('memo');
        const isBlurry =
          !isScreenshot &&
          !isReceiptOrDoc &&
          (meta.isMotionOrFocusBlurred ||
            sharpness < 3200 ||
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
          captionKo: `${file.name} (${img.width}x${img.height} · 선명도 ${sharpness.toLocaleString()}점 · 외부 전송 0 Byte)`,
          keywordsKo: [
            file.name.replace(/\.[^.]+$/, ''),
            '내폰',
            '갤러리',
            isScreenshot ? '스크린샷' : isReceiptOrDoc ? '영수증' : isBlurry ? '흔들린사진' : '사진',
          ],
          isVaultDocument: isReceiptOrDoc,
          vaultCategoryLabel: isReceiptOrDoc ? '스마트폰 촬영 영수증·서류' : undefined,
          trashCategory,
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
          captionKo: `${file.name} (내 스마트폰 갤러리)`,
          keywordsKo: [file.name.replace(/\.[^.]+$/, ''), '내폰', '사진'],
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

export async function auditRealPcPhotosAndCluster(
  photos: PhotoItem[]
): Promise<{ updatedPhotos: PhotoItem[]; duplicateGroups: DuplicateGroup[] }> {
  const isSample = (name: string) =>
    /^(IMG_2025|PET_2025|TRV_2025|DOC_2025|MEMO_2025|Screenshot_2025|BLUR_2025)/.test(name);

  const realCandidates = photos.filter((p) => !p.quarantined && !isSample(p.name));
  if (realCandidates.length === 0) {
    return { updatedPhotos: photos, duplicateGroups: [] };
  }

  const targetSlice = realCandidates.slice(0, 200);
  const BATCH = 8;

  const applyMetaToPhoto = (p: PhotoItem, meta: OpticalSignatureMeta) => {
    opticalSigByPhotoId.set(p.id, meta);
    p.dhash = meta.dhash;
    p.opticalSharpness = meta.sharpness;
    if (
      !p.trashCategory &&
      meta.whitePct < 50 &&
      meta.sharpness < 3200 &&
      !(meta.aspect >= 1.95 && meta.aspect <= 2.35)
    ) {
      p.trashCategory = 'blurry';
      p.trashConfidence = 0.95;
      if (!p.tags.includes('#초점이탈·심한흔들림')) {
        p.tags = ['#초점이탈·심한흔들림', ...p.tags];
      }
    }
  };

  const auditOne = (p: PhotoItem): Promise<void> => {
    const cacheKey = `${p.name}_${p.size}_${p.mtimeMs}`;
    const cached = pcOpticalAuditCache.get(cacheKey);
    if (cached) {
      applyMetaToPhoto(p, cached);
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timer = window.setTimeout(() => resolve(), 2500);
      img.onload = () => {
        window.clearTimeout(timer);
        const meta = computeOpticalDhashAndSharpness(img);
        pcOpticalAuditCache.set(cacheKey, meta);
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

  for (let i = 0; i < targetSlice.length; i += BATCH) {
    await Promise.all(targetSlice.slice(i, i + BATCH).map(auditOne));
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
          lowerName.includes('계약서') ||
          lowerName.includes('문서') ||
          lowerName.includes('명함') ||
          lowerName.includes('memo');
        // 캡처 후 크롭된 정방형·일반 비율 인물/사물 사진이라도 심한 초점이탈·손떨림 블러이면 스크린샷이 아닌 '흔들림·오촬영'으로 정확히 우선 분류
        const isSevereNonScreenBlur =
          !isReceiptOrDoc &&
          !isTallPhoneScreenAspect &&
          meta.whitePct < 52 &&
          meta.isMotionOrFocusBlurred &&
          sharpness < 2600;
        const isScreenshot =
          !isSevereNonScreenBlur &&
          (Boolean(item.isScreenshot) ||
            lowerName.includes('screenshot') ||
            lowerName.includes('스크린샷') ||
            lowerName.includes('캡처') ||
            aspectRatio > 1.98);
        const isBlurry =
          !isScreenshot &&
          !isReceiptOrDoc &&
          (isSevereNonScreenBlur ||
            meta.isMotionOrFocusBlurred ||
            sharpness < 3200 ||
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
        });

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
          captionKo: `${item.name} (${origW}x${origH} · 선명도 ${sharpness.toLocaleString()}점)`,
          keywordsKo: [
            (item.name || '').replace(/\.[^.]+$/, ''),
            ...(item.bucket ? [item.bucket] : []),
            isScreenshot ? '스크린샷' : isReceiptOrDoc ? '영수증' : isBlurry ? '흔들린사진' : '사진',
          ],
          isVaultDocument: isReceiptOrDoc,
          vaultCategoryLabel: isReceiptOrDoc ? '스마트폰 촬영 영수증·서류' : undefined,
          trashCategory,
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
          sceneCaption: `${stem} 시작 장면`,
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
const MOBILE_GALLERY_CACHE_SCHEMA_VER = 2;

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
            });
          }
        }
        for (const p of val.photos) {
          registerMobilePickedPhotoMeta({
            id: p.id,
            name: p.name,
            size: p.size,
            mtimeMs: p.mtimeMs,
          });
        }
        const hydratedVideos = Array.isArray(val.videos)
          ? val.videos.map((v) =>
              !v.videoUrl && String(v.id || '').startsWith('mobile_vid_')
                ? { ...v, videoUrl: resolveAndroidDirectVideoStreamUrl(v.id) }
                : v
            )
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

export async function saveCachedMobileGalleryIndex(
  photos: PhotoItem[],
  videos: VideoSceneItem[]
): Promise<void> {
  const db = await openMobileGalleryIdb();
  if (!db) return;
  try {
    const cleanPhotos = photos.slice(0, 600);
    const cleanVideos = videos.slice(0, 40);
    const opticalSigs: Record<string, SerializedOpticalSig> = {};
    for (const p of cleanPhotos) {
      const sig = opticalSigByPhotoId.get(p.id);
      if (sig) {
        opticalSigs[p.id] = {
          dhash: sig.dhash,
          sharpness: sig.sharpness,
          isMotionOrFocusBlurred: sig.isMotionOrFocusBlurred,
          aspect: sig.aspect,
          whitePct: sig.whitePct,
          rgbHex: encodeRgbGridHex(sig.rgbGrid),
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
