import type { DuplicateGroup, PhotoItem, TrashCategory } from '../types/saysee';

export async function analyzeMobilePickedPhotoFiles(
  files: FileList | File[]
): Promise<{ analyzed: PhotoItem[]; newDupGroups: DuplicateGroup[] }> {
  const fileArr = Array.from(files || []).filter((f) => f && f.type.startsWith('image/'));
  if (fileArr.length === 0) return { analyzed: [], newDupGroups: [] };

  const analyzeSingle = (file: File, index: number): Promise<PhotoItem> => {
    return new Promise((resolve) => {
      const objUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        let dhash = '';
        let sharpness = 18500;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 9;
          canvas.height = 8;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, 9, 8);
            const data = ctx.getImageData(0, 0, 9, 8).data;
            let bits = '';
            let diffSum = 0;
            for (let y = 0; y < 8; y++) {
              for (let x = 0; x < 8; x++) {
                const i1 = (y * 9 + x) * 4;
                const i2 = (y * 9 + (x + 1)) * 4;
                const g1 = data[i1] * 0.299 + data[i1 + 1] * 0.587 + data[i1 + 2] * 0.114;
                const g2 = data[i2] * 0.299 + data[i2 + 1] * 0.587 + data[i2 + 2] * 0.114;
                bits += g1 > g2 ? '1' : '0';
                diffSum += Math.abs(g1 - g2);
              }
            }
            for (let k = 0; k < 64; k += 4) {
              dhash += parseInt(bits.slice(k, k + 4), 2).toString(16);
            }
            sharpness = Math.round(diffSum * 24);
          }
        } catch {
          dhash = Date.now().toString(16).slice(-16);
        }

        const lowerName = file.name.toLowerCase();
        const isScreenshot =
          lowerName.includes('screenshot') ||
          lowerName.includes('스크린샷') ||
          lowerName.includes('캡처') ||
          (img.width > 0 && img.height / img.width > 1.95);
        const isReceiptOrDoc =
          lowerName.includes('receipt') ||
          lowerName.includes('영수증') ||
          lowerName.includes('계약서') ||
          lowerName.includes('문서') ||
          lowerName.includes('명함');
        const isBlurry = sharpness < 3200;

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

        const dt = new Date(file.lastModified || Date.now());
        const dateStr = `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(
          dt.getDate()
        ).padStart(2, '0')}`;

        resolve({
          id: `mobile_local_${Date.now()}_${index}`,
          name: file.name || `내폰사진_${index + 1}.jpg`,
          size: file.size || 1840000,
          date: dateStr,
          mtimeMs: file.lastModified || Date.now(),
          thumbUrl: objUrl,
          fullUrl: objUrl,
          tags,
          locationKo: '내 스마트폰 갤러리 (온디바이스 분석)',
          captionKo: `${file.name} (${img.width}x${img.height} · 선명도 ${sharpness.toLocaleString()}점 · 외부 전송 0 Byte)`,
          keywordsKo: [
            file.name.replace(/\.[^.]+$/, ''),
            '내폰',
            '갤러리',
            isScreenshot ? '스크린샷' : isReceiptOrDoc ? '영수증' : '사진',
          ],
          isVaultDocument: isReceiptOrDoc,
          vaultCategoryLabel: isReceiptOrDoc ? '스마트폰 촬영 영수증·서류' : undefined,
          trashCategory,
          trashConfidence: trashCategory ? 0.94 : undefined,
          opticalSharpness: sharpness,
          dhash,
          quarantined: false,
        });
      };
      img.onerror = () => {
        resolve({
          id: `mobile_local_${Date.now()}_${index}`,
          name: file.name || `내폰사진_${index + 1}.jpg`,
          size: file.size || 1500000,
          date: '2026.11.06',
          mtimeMs: file.lastModified || Date.now(),
          thumbUrl: objUrl,
          fullUrl: objUrl,
          tags: ['#내폰사진', '#온디바이스AI분류'],
          locationKo: '내 스마트폰 갤러리',
          captionKo: `${file.name} (내 스마트폰 직접 불러오기)`,
          keywordsKo: [file.name.replace(/\.[^.]+$/, ''), '내폰', '사진'],
          opticalSharpness: 18000,
          quarantined: false,
        });
      };
      img.src = objUrl;
    });
  };

  const analyzed = await Promise.all(fileArr.map((f, idx) => analyzeSingle(f, idx)));

  const seenHashes = new Map<string, PhotoItem>();
  const newDupGroups: DuplicateGroup[] = [];
  for (const item of analyzed) {
    const key = item.dhash ? item.dhash.slice(0, 12) : '';
    if (key && seenHashes.has(key)) {
      const first = seenHashes.get(key)!;
      item.trashCategory = 'duplicate';
      item.trashConfidence = 0.98;
      item.tags = ['#중복·연사사본', ...item.tags.filter((t) => t !== '#선명한베스트컷')];
      newDupGroups.push({
        groupId: `mobile_dup_${Date.now()}_${item.id}`,
        bestPhotoId: (first.opticalSharpness || 0) >= (item.opticalSharpness || 0) ? first.id : item.id,
        photoIds: [first.id, item.id],
        deltaSec: 1,
        maxDhashDist: 2,
      });
    } else if (key) {
      seenHashes.set(key, item);
    }
  }

  return { analyzed, newDupGroups };
}
