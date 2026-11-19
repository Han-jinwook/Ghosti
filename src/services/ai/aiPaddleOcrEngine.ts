/**
 * ❖ 귀신같이 고정밀 온디바이스 한국어·영문 OCR 엔진 (PP-OCRv4 Det + PP-OCRv5 Korean Rec, ONNX Runtime Web)
 * - 구형 Windows.Media.Ocr(WinRT)의 저해상도·저대비·다단 슬라이드 외계어 오독 한계를 근본 해결합니다.
 * - 평시 상주 메모리 0MB (유저가 [📝 글자 뽑기] 등을 실행할 때만 지연 로드 + CacheStorage 영구 캐싱).
 * - 외부 클라우드 서버 전송 0% · 과금 0원 · PC 및 모바일(Android/iOS) 100% 동일 구동.
 */

export interface PaddleOcrBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  h: number;
  conf: number;
  text: string;
}

const OCR_CACHE_NAME = 'ghosti-ppocr-v5-v1';

const DET_MODEL_URLS = [
  '/models/ocr/ppocr_v4_det.onnx',
  'https://huggingface.co/SWHL/RapidOCR/resolve/main/PP-OCRv4/ch_PP-OCRv4_det_infer.onnx',
];
const REC_MODEL_URLS = [
  '/models/ocr/ppocr_v5_ko_rec.onnx',
  'https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/korean/rec.onnx',
];
const DICT_URLS = [
  '/models/ocr/ppocr_v5_ko_dict.txt',
  'https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/korean/dict.txt',
];

interface PaddleOcrRuntime {
  ort: typeof import('onnxruntime-web');
  detSession: import('onnxruntime-web').InferenceSession;
  recSession: import('onnxruntime-web').InferenceSession;
  charDict: string[];
}

let runtimePromise: Promise<PaddleOcrRuntime> | null = null;
let inferenceChain: Promise<unknown> = Promise.resolve();

async function fetchBinaryWithCache(urls: string[]): Promise<ArrayBuffer> {
  let cache: Cache | null = null;
  if (typeof caches !== 'undefined') {
    try {
      cache = await caches.open(OCR_CACHE_NAME);
    } catch {
      cache = null;
    }
  }

  for (const url of urls) {
    try {
      if (cache) {
        const cached = await cache.match(url);
        if (cached && cached.ok) {
          return await cached.arrayBuffer();
        }
      }
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) continue;
      if (cache) {
        try {
          await cache.put(url, res.clone());
        } catch {
          /* ignore quota error */
        }
      }
      return await res.arrayBuffer();
    } catch {
      /* try fallback url */
    }
  }
  throw new Error(`OCR 모델 로드 실패: ${urls[0]}`);
}

async function fetchTextWithCache(urls: string[]): Promise<string> {
  const buf = await fetchBinaryWithCache(urls);
  return new TextDecoder('utf-8').decode(buf);
}

async function getPaddleOcrRuntime(): Promise<PaddleOcrRuntime> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const ort = await import('onnxruntime-web');
      try {
        ort.env.wasm.simd = true;
        if (typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated) {
          ort.env.wasm.numThreads = Math.min(4, Math.max(2, navigator.hardwareConcurrency || 2));
        }
      } catch {
        /* ignore env hints */
      }
      const [detBuf, recBuf, dictText] = await Promise.all([
        fetchBinaryWithCache(DET_MODEL_URLS),
        fetchBinaryWithCache(REC_MODEL_URLS),
        fetchTextWithCache(DICT_URLS),
      ]);

      const rawLines = dictText.split(/\r?\n/);
      while (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
        rawLines.pop();
      }
      // CTC index 0: blank, 1..N: dictionary chars, N+1: space (' ')
      const charDict = ['', ...rawLines, ' '];

      const sessionOpts: import('onnxruntime-web').InferenceSession.SessionOptions = {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      };

      const detSession = await ort.InferenceSession.create(detBuf, sessionOpts);
      const recSession = await ort.InferenceSession.create(recBuf, sessionOpts);

      return { ort, detSession, recSession, charDict };
    })().catch((err) => {
      runtimePromise = null;
      throw err;
    });
  }
  return runtimePromise;
}

function resizeBilinearRGBA(
  src: Uint8ClampedArray | Uint8Array,
  sw: number,
  sh: number,
  dw: number,
  dh: number
): Uint8Array {
  const dst = new Uint8Array(dw * dh * 4);
  const xRatio = sw / dw;
  const yRatio = sh / dh;
  for (let y = 0; y < dh; y++) {
    const sy = (y + 0.5) * yRatio - 0.5;
    const y0 = Math.max(0, Math.floor(sy));
    const y1 = Math.min(sh - 1, y0 + 1);
    const wy = sy - y0;
    for (let x = 0; x < dw; x++) {
      const sx = (x + 0.5) * xRatio - 0.5;
      const x0 = Math.max(0, Math.floor(sx));
      const x1 = Math.min(sw - 1, x0 + 1);
      const wx = sx - x0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      const di = (y * dw + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = src[i00 + c] * (1 - wx) + src[i10 + c] * wx;
        const bot = src[i01 + c] * (1 - wx) + src[i11 + c] * wx;
        dst[di + c] = Math.round(top * (1 - wy) + bot * wy);
      }
      dst[di + 3] = 255;
    }
  }
  return dst;
}

function polishKoreanOcrSpacing(text: string): string {
  let s = text.normalize('NFC').replace(/\s+/g, ' ').trim();
  // 조사('을','를') 뒤 한글 용언이 공백 없이 붙은 경우('급식의 질을높이는' -> '급식의 질을 높이는') 자연스럽게 분리
  s = s.replace(/([가-힣]{1,6}[을를])(?=(?:높이|줄이|넓히|바꾸|만들|키우|살리|지키|열어|찾아)[가-힣])/g, '$1 ');
  // '&' 기호 양옆 간격 정돈 ('예산절감&질' -> '예산 절감 & 질' / '예산절감 & 질')
  s = s.replace(/([가-힣A-Za-z0-9])\s*&\s*([가-힣A-Za-z0-9])/g, '$1 & $2');
  return s;
}

function joinWrappedKoreanLines(upper: string, lower: string): string {
  const a = upper.trim();
  const b = lower.trim();
  if (!a) return b;
  if (!b) return a;
  if (/^[|/]/.test(b) || /[|/]$/.test(a)) return `${a} ${b}`;

  // 아랫줄이 단독 1글자 한글('선','숙','침','장','호')이거나 조사/어미 조각으로 시작할 때, 또는 윗줄이 1글자 조각으로 끝날 때 무공백 직결 결합
  if (
    /^[가-힣]$/.test(b) ||
    /^(?:이터|에서|으로|에게|부터|까지|처럼|만큼|보다|라고|하고|하며|하는|하여|에는|에도|은|는|이|가|을|를|의|에|로|와|과|도|만)(?=[가-힣\s.,!?]|$)/.test(
      b
    ) ||
    /^(?:호|선|숙|율|량|액|금|원|개|건|명)(?=[\s:|.,)/]|$)/.test(b) ||
    (/(\s|^)[가-힣]$/.test(a) && !/&\s*[가-힣]$/.test(a)) ||
    /(?:등록번|전화번|계좌번|우편번|비밀번|백은|메뉴개|메뉴 개)$/.test(a)
  ) {
    return polishKoreanOcrSpacing(`${a}${b}`);
  }
  return polishKoreanOcrSpacing(`${a} ${b}`);
}

export function formatOcrBoxesSmart(rawBoxes: PaddleOcrBox[]): string {
  const watermarkRx =
    /notebooklm|^capcut$|^veo$|^kapwing$|^[xyv]?rec[eo]rder$|mobizen|bandicam|gomcam|^ocam$|az\s*screen|^inshot$|kinemaster|vivavideo|filmora/i;
  const filtered = rawBoxes
    .map((b) => ({
      ...b,
      text: polishKoreanOcrSpacing(b.text || '').replace(
        /^[,.;:•·|\-_~]+\s*(?=[가-힣A-Za-z0-9])/,
        ''
      ),
    }))
    .filter((b) => {
      const t = b.text;
      if (!t || b.conf < 0.78) return false;
      if (watermarkRx.test(t)) return false;
      // 동영상 플레이어 이동·일시정지 아이콘 노이즈 제거
      if (/^(?:10|0|00|\(\)|00\(\)|\|\||II|lI|Il)$/.test(t)) return false;
      if (t.length === 1 && !/[가-힣]/.test(t)) return false;
      if (b.conf < 0.88 && (/[가-힣][a-z][가-힣]/.test(t) || /[\u4e00-\u9fff]/.test(t))) {
        return false;
      }
      return true;
    });

  if (filtered.length === 0) return '';

  filtered.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);

  // Step 1: 같은 왼쪽 시작선(또는 중앙 정렬 1글자) & 동일 폰트 크기 & 인접 줄 간격의 끊긴 줄바꿈 문장을 한 문장으로 결합
  const used = new Array<boolean>(filtered.length).fill(false);
  const blocks: Array<PaddleOcrBox & { lineH: number }> = [];

  for (let i = 0; i < filtered.length; i++) {
    if (used[i]) continue;
    const cur = { ...filtered[i], lineH: filtered[i].h };
    used[i] = true;

    let merged = true;
    while (merged) {
      merged = false;
      for (let j = i + 1; j < filtered.length; j++) {
        if (used[j]) continue;
        const cand = filtered[j];
        const vGap = cand.y0 - cur.y1;
        if (vGap < -cur.lineH * 0.45) continue;
        if (vGap > Math.max(12, cur.lineH * 0.8)) break;

        const sameLeftEdge = Math.abs(cand.x0 - cur.x0) <= Math.max(18, cur.lineH * 1.15);
        const centeredSingleChar =
          /^[가-힣]$/.test(cand.text) && cand.x0 >= cur.x0 - 18 && cand.x1 <= cur.x1 + 18;
        const sameFontScale =
          Math.abs(cand.h - cur.lineH) <= Math.max(3, Math.min(cand.h, cur.lineH) * 0.28);
        const notEndedSentence = !/[.!?]$/.test(cur.text);

        if ((sameLeftEdge || centeredSingleChar) && sameFontScale && notEndedSentence) {
          cur.text = joinWrappedKoreanLines(cur.text, cand.text);
          cur.x0 = Math.min(cur.x0, cand.x0);
          cur.x1 = Math.max(cur.x1, cand.x1);
          cur.y1 = Math.max(cur.y1, cand.y1);
          cur.w = cur.x1 - cur.x0;
          cur.h = cur.y1 - cur.y0;
          used[j] = true;
          merged = true;
          break;
        }
      }
    }
    blocks.push(cur);
  }

  // Step 2: 수직 여백으로 큰 대역(Band)을 나누고, 다단 카드 레이아웃은 카드별 좌➔우 · 카드 내 위➔아래로 정렬
  blocks.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const bands: Array<{ minY: number; maxY: number; items: Array<PaddleOcrBox & { lineH: number }> }> = [];
  for (const b of blocks) {
    if (bands.length === 0 || b.y0 > bands[bands.length - 1].maxY + Math.max(18, b.lineH * 1.5)) {
      bands.push({ minY: b.y0, maxY: b.y1, items: [b] });
    } else {
      const band = bands[bands.length - 1];
      band.maxY = Math.max(band.maxY, b.y1);
      band.items.push(b);
    }
  }

  const outTexts: string[] = [];
  for (const band of bands) {
    const cols: Array<{ x0: number; x1: number; items: Array<PaddleOcrBox & { lineH: number }> }> = [];
    const byX = [...band.items].sort((a, b) => a.x0 - b.x0);
    for (const it of byX) {
      let placed = false;
      for (const col of cols) {
        const overlap = Math.min(col.x1, it.x1) - Math.max(col.x0, it.x0);
        const minW = Math.min(col.x1 - col.x0, it.w);
        if (overlap >= -8 && (overlap > minW * 0.25 || Math.abs(col.x0 - it.x0) <= 22)) {
          col.x0 = Math.min(col.x0, it.x0);
          col.x1 = Math.max(col.x1, it.x1);
          col.items.push(it);
          placed = true;
          break;
        }
      }
      if (!placed) {
        cols.push({ x0: it.x0, x1: it.x1, items: [it] });
      }
    }

    const isStackedMultiCardLayout =
      cols.length >= 2 &&
      cols.length <= 5 &&
      cols.every((c) => c.items.length <= 4) &&
      cols.some((c) => c.items.length >= 2 && c.items.some((x) => x.text.length >= 8));

    if (isStackedMultiCardLayout) {
      cols.sort((a, b) => a.x0 - b.x0);
      for (const col of cols) {
        col.items.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
        for (const it of col.items) outTexts.push(it.text);
      }
    } else {
      band.items.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
      const rows: Array<{ refY: number; items: Array<PaddleOcrBox & { lineH: number }> }> = [];
      for (const it of band.items) {
        if (rows.length === 0 || Math.abs(it.y0 - rows[rows.length - 1].refY) > Math.max(10, it.lineH * 0.6)) {
          rows.push({ refY: it.y0, items: [it] });
        } else {
          rows[rows.length - 1].items.push(it);
        }
      }
      for (const r of rows) {
        r.items.sort((a, b) => a.x0 - b.x0);
        for (const it of r.items) outTexts.push(it.text);
      }
    }
  }

  return outTexts.join(' · ');
}

async function runSingleImageOcrInternal(
  rgba: Uint8ClampedArray | Uint8Array,
  srcW: number,
  srcH: number
): Promise<{ text: string; boxes: PaddleOcrBox[] }> {
  if (srcW < 16 || srcH < 16) return { text: '', boxes: [] };
  const { ort, detSession, recSession, charDict } = await getPaddleOcrRuntime();

  // 1) Detection: 저해상도 영상 프레임(예: 525x315)도 8px 소형 글자를 놓치지 않도록 최소 960px 기준으로 DBNet 입력 구성
  const maxSide = Math.max(srcW, srcH);
  const targetMax = Math.max(960, Math.min(1280, maxSide));
  const scale = targetMax / maxSide;
  const detW = Math.max(32, Math.round((srcW * scale) / 32) * 32);
  const detH = Math.max(32, Math.round((srcH * scale) / 32) * 32);
  const detRgba =
    detW === srcW && detH === srcH ? rgba : resizeBilinearRGBA(rgba, srcW, srcH, detW, detH);

  const plane = detH * detW;
  const detInput = new Float32Array(3 * plane);
  const mean0 = 0.485,
    mean1 = 0.456,
    mean2 = 0.406;
  const std0 = 0.229,
    std1 = 0.224,
    std2 = 0.225;

  for (let i = 0; i < plane; i++) {
    const r = detRgba[i * 4] / 255;
    const g = detRgba[i * 4 + 1] / 255;
    const b = detRgba[i * 4 + 2] / 255;
    detInput[i] = (b - mean0) / std0;
    detInput[plane + i] = (g - mean1) / std1;
    detInput[plane * 2 + i] = (r - mean2) / std2;
  }

  const detTensor = new ort.Tensor('float32', detInput, [1, 3, detH, detW]);
  const detOut = await detSession.run({ [detSession.inputNames[0]]: detTensor });
  const prob = detOut[detSession.outputNames[0]].data as Float32Array;

  const visited = new Uint8Array(plane);
  const q = new Int32Array(plane);
  const thresh = 0.3;
  const boxThresh = 0.52;
  const candidateBoxes: Array<{ x0: number; y0: number; x1: number; y1: number; w: number; h: number }> = [];

  for (let y = 0; y < detH; y++) {
    for (let x = 0; x < detW; x++) {
      const idx = y * detW + x;
      if (visited[idx] || prob[idx] <= thresh) continue;
      let head = 0,
        tail = 0;
      q[tail++] = idx;
      visited[idx] = 1;
      let minX = x,
        maxX = x,
        minY = y,
        maxY = y;
      let scoreSum = 0,
        count = 0;

      while (head < tail) {
        const cur = q[head++];
        const cy = (cur / detW) | 0;
        const cx = cur - cy * detW;
        scoreSum += prob[cur];
        count++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        if (cx > 0 && !visited[cur - 1] && prob[cur - 1] > thresh) {
          visited[cur - 1] = 1;
          q[tail++] = cur - 1;
        }
        if (cx + 1 < detW && !visited[cur + 1] && prob[cur + 1] > thresh) {
          visited[cur + 1] = 1;
          q[tail++] = cur + 1;
        }
        if (cy > 0 && !visited[cur - detW] && prob[cur - detW] > thresh) {
          visited[cur - detW] = 1;
          q[tail++] = cur - detW;
        }
        if (cy + 1 < detH && !visited[cur + detW] && prob[cur + detW] > thresh) {
          visited[cur + detW] = 1;
          q[tail++] = cur + detW;
        }
      }

      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      if (count < 8 || bh < 4 || bw < 5 || scoreSum / count < boxThresh) continue;

      const area = bw * bh;
      const perim = 2 * (bw + bh);
      const padX = Math.round((area * 1.65) / perim) + 2;
      const padY = Math.round((area * 1.6) / perim) + 1;

      const x0 = Math.max(0, Math.floor(((minX - padX) / detW) * srcW));
      const y0 = Math.max(0, Math.floor(((minY - padY) / detH) * srcH));
      const x1 = Math.min(srcW, Math.ceil(((maxX + padX) / detW) * srcW));
      const y1 = Math.min(srcH, Math.ceil(((maxY + padY) / detH) * srcH));
      if (x1 - x0 >= 4 && y1 - y0 >= 4) {
        candidateBoxes.push({ x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 });
      }
    }
  }

  if (candidateBoxes.length === 0) {
    return { text: '', boxes: [] };
  }

  // 2) Recognition (PP-OCRv5 Korean, height=48, CTC decoding)
  const boxes: PaddleOcrBox[] = [];
  const recInName = recSession.inputNames[0];
  const recOutName = recSession.outputNames[0];

  for (let bi = 0; bi < candidateBoxes.length; bi++) {
    const b = candidateBoxes[bi];
    const crop = new Uint8Array(b.w * b.h * 4);
    for (let cy = 0; cy < b.h; cy++) {
      const srcOff = ((b.y0 + cy) * srcW + b.x0) * 4;
      crop.set(rgba.subarray(srcOff, srcOff + b.w * 4), cy * b.w * 4);
    }

    const recH = 48;
    const recW = Math.max(48, Math.min(1600, Math.round(b.w * (recH / b.h))));
    const resized = resizeBilinearRGBA(crop, b.w, b.h, recW, recH);
    const rPlane = recH * recW;
    const recInput = new Float32Array(3 * rPlane);

    for (let i = 0; i < rPlane; i++) {
      recInput[i] = (resized[i * 4 + 2] / 255 - 0.5) / 0.5;
      recInput[rPlane + i] = (resized[i * 4 + 1] / 255 - 0.5) / 0.5;
      recInput[rPlane * 2 + i] = (resized[i * 4] / 255 - 0.5) / 0.5;
    }

    const rOut = await recSession.run({
      [recInName]: new ort.Tensor('float32', recInput, [1, 3, recH, recW]),
    });
    const logits = rOut[recOutName];
    const seqLen = Number(logits.dims[1] || 0);
    const numCls = Number(logits.dims[2] || 0);
    const data = logits.data as Float32Array;

    const charPairs: Array<{ ch: string; sc: number }> = [];
    let prevIdx = 0;

    for (let t = 0; t < seqLen; t++) {
      let maxV = -1e9;
      let maxI = 0;
      const base = t * numCls;
      for (let c = 0; c < numCls; c++) {
        const v = data[base + c];
        if (v > maxV) {
          maxV = v;
          maxI = c;
        }
      }
      if (maxI > 0 && maxI !== prevIdx) {
        const ch = charDict[maxI] || '';
        if (ch) {
          charPairs.push({ ch, sc: maxV });
        }
      }
      prevIdx = maxI;
    }

    while (
      charPairs.length > 0 &&
      charPairs[0].sc < 0.42 &&
      !/[가-힣A-Za-z0-9]/.test(charPairs[0].ch)
    ) {
      charPairs.shift();
    }
    while (
      charPairs.length > 0 &&
      charPairs[charPairs.length - 1].sc < 0.42 &&
      !/[가-힣A-Za-z0-9]/.test(charPairs[charPairs.length - 1].ch)
    ) {
      charPairs.pop();
    }

    const clean = charPairs
      .map((p) => p.ch)
      .join('')
      .normalize('NFC')
      .trim();
    const avgConf =
      charPairs.length > 0
        ? charPairs.reduce((acc, p) => acc + p.sc, 0) / charPairs.length
        : 0;
    if (clean && avgConf >= 0.78) {
      boxes.push({ ...b, conf: avgConf, text: clean });
    }

    if ((bi + 1) % 6 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const formatted = formatOcrBoxesSmart(boxes);
  return { text: formatted, boxes };
}

/**
 * ONNX Runtime Web 단일 세션 동시성 보호 직렬화 큐로 안전하게 이미지 OCR을 수행합니다.
 */
export function recognizeImageDataWithPaddleOcr(
  imageData: ImageData
): Promise<{ text: string; boxes: PaddleOcrBox[] }> {
  const job = inferenceChain.then(() =>
    runSingleImageOcrInternal(imageData.data, imageData.width, imageData.height)
  );
  inferenceChain = job.catch(() => undefined);
  return job;
}

export async function recognizeDataUrlWithPaddleOcr(
  dataUrl: string
): Promise<{ text: string; boxes: PaddleOcrBox[] }> {
  if (typeof document === 'undefined' || !dataUrl) return { text: '', boxes: [] };
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const scale = Math.min(1, 1920 / Math.max(w, h));
        const cw = Math.max(32, Math.round(w * scale));
        const ch = Math.max(32, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve({ text: '', boxes: [] });
          return;
        }
        ctx.drawImage(img, 0, 0, cw, ch);
        const imgData = ctx.getImageData(0, 0, cw, ch);
        const res = await recognizeImageDataWithPaddleOcr(imgData);
        resolve(res);
      } catch {
        resolve({ text: '', boxes: [] });
      }
    };
    img.onerror = () => resolve({ text: '', boxes: [] });
    img.src = dataUrl;
  });
}
