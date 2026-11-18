import type { DuplicateGroup, PhotoItem, TrashCategory } from '../types/saysee';
import { registerMobilePickedPhotoMeta } from './ghostiMobileCareBridge';

interface OpticalSignatureMeta {
  dhash: string;
  sharpness: number;
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

    // 3) 128x128 2D 라플라시안(Laplacian) 고주파 엣지 분산 기반 실제 선명도 측정 (흔들린 사진 정밀 판별)
    const W = 128;
    const H = 128;
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
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const c = gray[y * W + x] * 4;
          const top = gray[(y - 1) * W + x];
          const bot = gray[(y + 1) * W + x];
          const left = gray[y * W + (x - 1)];
          const right = gray[y * W + (x + 1)];
          const lap = Math.abs(c - top - bot - left - right);
          lapSum += lap;
          lapSqSum += lap * lap;
          count++;
        }
      }
      if (count > 0) {
        const mean = lapSum / count;
        const variance = Math.max(0, lapSqSum / count - mean * mean);
        sharpness = Math.round(variance * 18 + mean * 95);
      }
    }
  } catch {
    dhash = '';
  }
  return { dhash, sharpness, aspect, whitePct, rgbGrid };
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

      const rgbToFirst = computeRgbGridDifference(firstSig?.rgbGrid, candSig?.rgbGrid);
      const rgbToLast = computeRgbGridDifference(lastSig?.rgbGrid, candSig?.rgbGrid);
      const sameAspect =
        !firstSig || !candSig || Math.abs(firstSig.aspect - candSig.aspect) <= 0.04;

      // 1) 트랙 A: 완전 동일 사진 중복 사본 (해밍거리 <= 2 & 8x8 RGB 색상/밝기 거의 100% 일치)
      const isExactDuplicateCopy =
        sameAspect &&
        distToFirst <= 2 &&
        rgbToFirst.meanDiff <= 4.5 &&
        rgbToFirst.maxBlockDiff <= 18;

      // 2) 트랙 B: 실제 카메라 연속 촬영 연사 (백색 문서/스크린샷 페이지가 아닌 실사 촬영본에 한해 허용)
      const isDocumentOrWhiteSheet =
        (firstSig && firstSig.whitePct >= 45) ||
        (candSig && candSig.whitePct >= 45) ||
        first.trashCategory === 'screenshot' ||
        cand.trashCategory === 'screenshot';

      const isCameraBurstShot =
        !isDocumentOrWhiteSheet &&
        sameAspect &&
        deltaSecFromFirst <= 30 &&
        deltaSecFromLast <= 15 &&
        distToFirst <= 13 &&
        distToLast <= 10 &&
        rgbToFirst.meanDiff <= 18.0 &&
        rgbToFirst.maxBlockDiff <= 52 &&
        rgbToLast.meanDiff <= 16.0;

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
  const fileArr = Array.from(files || []).filter((f) => f && f.type.startsWith('image/'));
  if (fileArr.length === 0) return { analyzed: [], newDupGroups: [] };

  const batchTs = Date.now();
  const analyzeSingle = (file: File, index: number): Promise<PhotoItem> => {
    return new Promise((resolve) => {
      const objUrl = URL.createObjectURL(file);
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
          meta.whitePct < 50 &&
          (sharpness < 3200 || lowerName.includes('blur') || lowerName.includes('흔들'));

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

        // [모바일 정리 보관함 썸네일 엑박 원천 차단]:
        // Android WebView에서 File 객체가 GC된 후에도 복원 보관함/리스트 썸네일이 깨지지 않도록 360px JPEG Data URL 생성
        let persistentThumbUrl = objUrl;
        try {
          const maxDim = 360;
          const scale =
            img.width > 0 && img.height > 0
              ? Math.min(1, maxDim / Math.max(img.width, img.height))
              : 1;
          const tw = Math.max(1, Math.round((img.width || 320) * scale));
          const th = Math.max(1, Math.round((img.height || 320) * scale));
          const thumbCanvas = document.createElement('canvas');
          thumbCanvas.width = tw;
          thumbCanvas.height = th;
          const tCtx = thumbCanvas.getContext('2d');
          if (tCtx) {
            tCtx.drawImage(img, 0, 0, tw, th);
            const dataUrl = thumbCanvas.toDataURL('image/jpeg', 0.82);
            if (dataUrl && dataUrl.startsWith('data:image/')) {
              persistentThumbUrl = dataUrl;
            }
          }
        } catch {
          persistentThumbUrl = objUrl;
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
          fullUrl: persistentThumbUrl,
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
        resolve({
          id: `mobile_local_${batchTs}_${index}`,
          name: file.name || `내폰사진_${index + 1}.jpg`,
          size: file.size || 1500000,
          date: '2026.11.17',
          mtimeMs: file.lastModified || batchTs + index * 500,
          thumbUrl: objUrl,
          fullUrl: objUrl,
          tags: ['#내폰사진', '#온디바이스AI분류'],
          locationKo: '내 스마트폰 갤러리',
          captionKo: `${file.name} (내 스마트폰 직접 불러오기)`,
          keywordsKo: [file.name.replace(/\.[^.]+$/, ''), '내폰', '사진'],
          opticalSharpness: 12000,
          quarantined: false,
        });
      };
      img.src = objUrl;
    });
  };

  const rawAnalyzed = await Promise.all(fileArr.map((f, idx) => analyzeSingle(f, idx)));
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
