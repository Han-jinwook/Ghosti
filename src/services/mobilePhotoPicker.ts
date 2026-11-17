import type { DuplicateGroup, PhotoItem, TrashCategory } from '../types/saysee';

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
 * HTMLImageElement로부터:
 * 1) 9x8 그레이스케일 기반 64-bit dHash (16자리 hex)
 * 2) 128x128 그레이스케일 2D 라플라시안(Laplacian) 선명도 점수 (흐린 사진 < 3200, 선명한 사진 >= 3200)
 * 를 동시에 계산합니다.
 */
export function computeOpticalDhashAndSharpness(img: HTMLImageElement): {
  dhash: string;
  sharpness: number;
} {
  let dhash = '';
  let sharpness = 12000;
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

    // 2) 128x128 2D 라플라시안(Laplacian) 고주파 엣지 분산 기반 실제 선명도 측정 (흔들린 사진 정밀 판별)
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
        // 선명한 일반 사진: 4500~28000+, 흔들리거나 초점 나간 사진: 300~3100
        sharpness = Math.round(variance * 18 + mean * 95);
      }
    }
  } catch {
    dhash = '';
  }
  return { dhash, sharpness };
}

/**
 * 사진 배열(PC 실사진 또는 모바일 사진)에서 64-bit dHash 해밍 거리와 촬영 시각을 기반으로
 * 2장~20장 단위의 다중 연사·중복 묶음(DuplicateGroup)을 클러스터링하고,
 * 각 묶음 내에서 가장 선명하고 해상도/용량이 높은 1장을 `bestPhotoId`(👑 추천 베스트 1장)로 선정합니다.
 */
export function clusterPhotosIntoDuplicateGroups(
  photos: PhotoItem[]
): { updatedPhotos: PhotoItem[]; duplicateGroups: DuplicateGroup[] } {
  const candidates = photos.filter(
    (p) =>
      !p.quarantined &&
      p.dhash &&
      p.dhash.length === 16 &&
      p.trashCategory !== 'screenshot' &&
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

    const members: PhotoItem[] = [first];
    let maxDist = 0;
    let maxDeltaSec = 0;

    for (let j = i + 1; j < sorted.length; j++) {
      const cand = sorted[j];
      if (visited.has(cand.id)) continue;

      const last = members[members.length - 1];
      const distToLast = computeDhashHammingDistance(last.dhash, cand.dhash);
      const distToFirst = computeDhashHammingDistance(first.dhash, cand.dhash);
      const deltaSec = Math.abs((cand.mtimeMs || 0) - (last.mtimeMs || 0)) / 1000;

      // 1) 완전 동일/거의 동일한 중복 사진 (시간 무관, 해밍거리 <= 10)
      // 2) 연속 촬영된 연사 묶음 (해밍거리 <= 16 & 직전 컷과 해밍거리 <= 14, 또는 30초 이내 촬영 & 해밍거리 <= 18)
      const isSameBurstOrDup =
        distToLast <= 10 ||
        (distToLast <= 14 && distToFirst <= 18) ||
        (deltaSec <= 30 && distToLast <= 18 && distToFirst <= 22);

      if (isSameBurstOrDup) {
        members.push(cand);
        visited.add(cand.id);
        if (distToLast > maxDist) maxDist = distToLast;
        if (deltaSec > maxDeltaSec) maxDeltaSec = deltaSec;
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
      // 이전에 duplicate였으나 그룹이 아닌 경우 원복
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
        const { dhash, sharpness } = computeOpticalDhashAndSharpness(img);

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

        resolve({
          id: `mobile_local_${batchTs}_${index}`,
          name: file.name || `내폰사진_${index + 1}.jpg`,
          size: file.size || 1840000,
          date: dateStr,
          mtimeMs: file.lastModified || batchTs + index * 500,
          thumbUrl: objUrl,
          fullUrl: objUrl,
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
 * 실제 64-bit dHash 및 2D 라플라시안 선명도(흐린 사진 판별)를 계산하고 다중 연사 묶음(DuplicateGroup)을 생성합니다.
 */
const pcOpticalAuditCache = new Map<string, { dhash: string; sharpness: number; aspect: number }>();

export async function auditRealPcPhotosAndCluster(
  photos: PhotoItem[]
): Promise<{ updatedPhotos: PhotoItem[]; duplicateGroups: DuplicateGroup[] }> {
  const isSample = (name: string) =>
    /^(IMG_2025|PET_2025|TRV_2025|DOC_2025|MEMO_2025|Screenshot_2025|BLUR_2025)/.test(name);

  const realCandidates = photos.filter((p) => !p.quarantined && !isSample(p.name));
  if (realCandidates.length === 0) {
    return { updatedPhotos: photos, duplicateGroups: [] };
  }

  // 최근 사진 우선 최대 200장 고속 광학 스캔 (8장 병렬 배치)
  const targetSlice = realCandidates.slice(0, 200);
  const BATCH = 8;

  const auditOne = (p: PhotoItem): Promise<void> => {
    const cacheKey = `${p.name}_${p.size}_${p.mtimeMs}`;
    const cached = pcOpticalAuditCache.get(cacheKey);
    if (cached) {
      p.dhash = cached.dhash;
      p.opticalSharpness = cached.sharpness;
      if (
        !p.trashCategory &&
        cached.sharpness < 3200 &&
        !(cached.aspect >= 1.95 && cached.aspect <= 2.35)
      ) {
        p.trashCategory = 'blurry';
        p.trashConfidence = 0.95;
        if (!p.tags.includes('#초점이탈·심한흔들림')) {
          p.tags = ['#초점이탈·심한흔들림', ...p.tags];
        }
      }
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timer = window.setTimeout(() => resolve(), 2500);
      img.onload = () => {
        window.clearTimeout(timer);
        const { dhash, sharpness } = computeOpticalDhashAndSharpness(img);
        const aspect = img.width > 0 ? img.height / img.width : 1;
        pcOpticalAuditCache.set(cacheKey, { dhash, sharpness, aspect });
        p.dhash = dhash;
        p.opticalSharpness = sharpness;
        if (
          !p.trashCategory &&
          sharpness < 3200 &&
          !(aspect >= 1.95 && aspect <= 2.35)
        ) {
          p.trashCategory = 'blurry';
          p.trashConfidence = 0.95;
          if (!p.tags.includes('#초점이탈·심한흔들림')) {
            p.tags = ['#초점이탈·심한흔들림', ...p.tags];
          }
        }
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
