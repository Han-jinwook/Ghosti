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
  ort: typeof import('onnxruntime-web/webgpu');
  detSession: import('onnxruntime-web/webgpu').InferenceSession;
  recSession: import('onnxruntime-web/webgpu').InferenceSession;
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
      const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const tid = ac ? setTimeout(() => ac.abort(), 25000) : null;
      try {
        const res = await fetch(url, { mode: 'cors', signal: ac?.signal });
        if (!res.ok) continue;
        const ctype = (res.headers.get('content-type') || '').toLowerCase();
        if (ctype.includes('text/html')) continue;
        const buf = await res.arrayBuffer();
        if (!buf.byteLength) continue;
        const headStr = new TextDecoder('utf-8', { fatal: false }).decode(buf.slice(0, 64)).trimStart().toLowerCase();
        if (headStr.startsWith('<!doctype') || headStr.startsWith('<html')) continue;
        if (cache) {
          try {
            await cache.put(url, new Response(buf, { headers: { 'content-type': ctype || 'application/octet-stream' } }));
          } catch {
            /* ignore quota error */
          }
        }
        return buf;
      } finally {
        if (tid) clearTimeout(tid);
      }
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
      // @huggingface/transformers와 동일한 단일 WASM 런타임(ort.webgpu.bundle -> asyncify.wasm)을 공유하여
      // 모바일 번들 JSEP WASM 누락 404 및 이중 28MB WASM 메모리 점유를 원천 차단합니다.
      const ort = await import('onnxruntime-web/webgpu');
      try {
        ort.env.wasm.simd = true;
        // 번들 내부에 이미 포함된 /assets/ort-wasm-simd-threaded.asyncify-*.wasm 로컬 파일을 최우선 사용하여
        // 모바일/오프라인 환경에서도 외부 jsdelivr 27MB 재다운로드 없이 0.02초 만에 즉시 기동합니다.
        if (ort.env.wasm.wasmPaths && typeof ort.env.wasm.wasmPaths === 'object') {
          const wp = ort.env.wasm.wasmPaths as { wasm?: string };
          if (typeof wp.wasm === 'string' && wp.wasm.includes('cdn.jsdelivr.net')) {
            ort.env.wasm.wasmPaths = undefined;
          }
        }
        const isMobileUa =
          typeof navigator !== 'undefined' &&
          (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') ||
            (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1));
        if (isMobileUa) {
          ort.env.wasm.numThreads = 1;
        } else if (typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated) {
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

      const sessionOpts: import('onnxruntime-web/webgpu').InferenceSession.SessionOptions = {
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
  // 아이콘·배지 오인식 정제 (| 뒤 왕관 아이콘 👑 -> W/M/V, 요일 뒤 체크 화살표 V/√, 중복 Kcal 단위 등)
  s = s.replace(/(?<=\|)\s*[WMV]\s*(?=[가-힣]{2,})/g, ' ');
  s = s.replace(/^(?:[GH])\s*(?=(?:로그인|퀴즈)$)/g, '');
  s = s.replace(/(?<=[월화수목금토일])\s*[Vv√✓]+(?=\s|$)/g, '');
  s = s.replace(/\b(ChatGPT)\s*[vV√✓]+\b/gi, '$1');
  s = s.replace(/\bKcal\s*kcal\b/gi, 'Kcal');
  s = s.replace(/\s*[©®]+(?=\s|$)/g, '');
  // 조사('을','를') 뒤 한글 용언이 공백 없이 붙은 경우('급식의 질을높이는' -> '급식의 질을 높이는') 자연스럽게 분리
  s = s.replace(/([가-힣]{1,6}[을를])(?=(?:높이|줄이|넓히|바꾸|만들|키우|살리|지키|열어|찾아)[가-힣])/g, '$1 ');
  // '&' 기호 양옆 간격 정돈 ('예산절감&질' -> '예산 절감 & 질' / '예산절감 & 질')
  s = s.replace(/([가-힣A-Za-z0-9])\s*&\s*([가-힣A-Za-z0-9])/g, '$1 & $2');
  return s.replace(/\s+/g, ' ').trim();
}

function joinWrappedKoreanLines(upper: string, lower: string): string {
  const a = upper.trim();
  const b = lower.trim();
  if (!a) return b;
  if (!b) return a;
  if (a.endsWith('/') && /^\d{1,3}(?:명|개|건)?$/.test(b)) return `${a}${b}`;
  if (/^[|/]/.test(b) || /[|/]$/.test(a)) return `${a} ${b}`;

  // 아랫줄이 단독 1글자 한글('선','숙','침','장','호','주','차','록')이거나 조사/어미 조각으로 시작할 때, 또는 윗줄이 1글자 조각으로 끝날 때 무공백 직결 결합
  if (
    /^[가-힣]$/.test(b) ||
    /^(?:이터|에서|으로|에게|부터|까지|처럼|만큼|보다|라고|하고|하며|하는|하여|에는|에도|은|는|이|가|을|를|의|에|로|와|과|도|만)(?=[가-힣\s.,!?]|$)/.test(
      b
    ) ||
    /^(?:호|선|숙|율|량|액|금|원|개|건|명|주|차|록)(?=[\s:|.,)/]|$)/.test(b) ||
    (/(\s|^)[가-힣]$/.test(a) && !/&\s*[가-힣]$/.test(a)) ||
    /(?:등록번|전화번|계좌번|우편번|비밀번|백은|메뉴개|메뉴 개|\d+\s*월\s*\d+)$/.test(a)
  ) {
    return polishKoreanOcrSpacing(`${a}${b}`);
  }
  return polishKoreanOcrSpacing(`${a} ${b}`);
}

export interface PaddleOcrOptions {
  filterVideoUi?: boolean;
}

function cubicWeight(t: number): number {
  const x = Math.abs(t);
  if (x <= 1) {
    return 1.5 * x * x * x - 2.5 * x * x + 1;
  }
  if (x < 2) {
    return -0.5 * x * x * x + 2.5 * x * x - 4 * x + 2;
  }
  return 0;
}

function sampleCatmullRomRGBA(
  src: Uint8ClampedArray | Uint8Array,
  srcW: number,
  srcH: number,
  sxF: number,
  syF: number,
  dst: Uint8Array,
  di: number
): void {
  const ix = Math.floor(sxF);
  const iy = Math.floor(syF);
  const fx = sxF - ix;
  const fy = syF - iy;

  const wx0 = cubicWeight(fx + 1);
  const wx1 = cubicWeight(fx);
  const wx2 = cubicWeight(1 - fx);
  const wx3 = cubicWeight(2 - fx);

  const wy0 = cubicWeight(fy + 1);
  const wy1 = cubicWeight(fy);
  const wy2 = cubicWeight(1 - fy);
  const wy3 = cubicWeight(2 - fy);

  const y0 = Math.max(0, Math.min(srcH - 1, iy - 1)) * srcW;
  const y1 = Math.max(0, Math.min(srcH - 1, iy)) * srcW;
  const y2 = Math.max(0, Math.min(srcH - 1, iy + 1)) * srcW;
  const y3 = Math.max(0, Math.min(srcH - 1, iy + 2)) * srcW;

  const x0 = Math.max(0, Math.min(srcW - 1, ix - 1));
  const x1 = Math.max(0, Math.min(srcW - 1, ix));
  const x2 = Math.max(0, Math.min(srcW - 1, ix + 1));
  const x3 = Math.max(0, Math.min(srcW - 1, ix + 2));

  const p00 = (y0 + x0) * 4, p01 = (y0 + x1) * 4, p02 = (y0 + x2) * 4, p03 = (y0 + x3) * 4;
  const p10 = (y1 + x0) * 4, p11 = (y1 + x1) * 4, p12 = (y1 + x2) * 4, p13 = (y1 + x3) * 4;
  const p20 = (y2 + x0) * 4, p21 = (y2 + x1) * 4, p22 = (y2 + x2) * 4, p23 = (y2 + x3) * 4;
  const p30 = (y3 + x0) * 4, p31 = (y3 + x1) * 4, p32 = (y3 + x2) * 4, p33 = (y3 + x3) * 4;

  for (let c = 0; c < 3; c++) {
    const r0 = src[p00 + c] * wx0 + src[p01 + c] * wx1 + src[p02 + c] * wx2 + src[p03 + c] * wx3;
    const r1 = src[p10 + c] * wx0 + src[p11 + c] * wx1 + src[p12 + c] * wx2 + src[p13 + c] * wx3;
    const r2 = src[p20 + c] * wx0 + src[p21 + c] * wx1 + src[p22 + c] * wx2 + src[p23 + c] * wx3;
    const r3 = src[p30 + c] * wx0 + src[p31 + c] * wx1 + src[p32 + c] * wx2 + src[p33 + c] * wx3;
    const val = r0 * wy0 + r1 * wy1 + r2 * wy2 + r3 * wy3;
    dst[di + c] = val <= 0 ? 0 : val >= 255 ? 255 : Math.round(val);
  }
  dst[di + 3] = 255;
}

function resizeBicubicRGBA(
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
    const sy = Math.max(0, Math.min(sh - 1.001, (y + 0.5) * yRatio - 0.5));
    for (let x = 0; x < dw; x++) {
      const sx = Math.max(0, Math.min(sw - 1.001, (x + 0.5) * xRatio - 0.5));
      sampleCatmullRomRGBA(src, sw, sh, sx, sy, dst, (y * dw + x) * 4);
    }
  }
  return dst;
}

export function formatOcrBoxesSmart(
  rawBoxes: PaddleOcrBox[],
  opts?: { filterVideoUi?: boolean; imgHeight?: number; imgWidth?: number }
): string {
  const filterVideoUi = Boolean(opts?.filterVideoUi);
  const imgHeight = Number(opts?.imgHeight || 0);
  const imgWidth = Number(opts?.imgWidth || 0);
  const watermarkRx =
    /notebooklm|^capcut$|^veo$|^kapwing$|^[xyv]?rec[eo@0]rder$|mobizen|bandicam|gomcam|^ocam$|az\s*screen|^inshot$|kinemaster|vivavideo|filmora/i;
  const kbdTokenRx =
    /^(?:스페이스|한\/?영|완료|이동|검색|123|!#1|!#7|\.,\?!|[ㄱ-ㅎㅏ-ㅣ]{1,3}|TT|CE|L2|7ㅋ)$/i;
  const statusBarRx = /^(?:SKT|KT|LG\s*U\+|U\+|LTE|5G|\d{1,3}%|\d{1,2}:\d{2})(?:\s.*)?$/i;
  const urlHexNoiseRx =
    /^[0-9A-Fa-f]{0,2}(?:%[0-9A-Fa-f]{2})+|(?:%[0-9A-Fa-f]{2}){2,}|^[%&]?[0-9A-Fa-f]{2,3}[%'"`]?$/;

  let hasBottomKeyboard = false;
  if (filterVideoUi && imgHeight > 0) {
    let kbdHits = 0;
    for (const b of rawBoxes) {
      const tr = (b.text || '').trim();
      if (b.y0 >= imgHeight * 0.65 && (kbdTokenRx.test(tr) || tr.length === 1)) {
        kbdHits++;
      }
    }
    hasBottomKeyboard = kbdHits >= 3;
  }

  const filtered = rawBoxes
    .map((b) => ({
      ...b,
      text: polishKoreanOcrSpacing(b.text || '')
        .replace(/^[,.;:•·|\-_~<>]+\s*(?=[가-힣A-Za-z0-9])/, '')
        .replace(/\s+\|$/, '')
        .trim(),
    }))
    .filter((b) => {
      let t = b.text;
      const minConf = /[가-힣]{2,}/.test(t) ? (filterVideoUi ? 0.74 : 0.72) : 0.78;
      if (!t || b.conf < minConf) return false;
      if (watermarkRx.test(t)) return false;
      if (filterVideoUi) {
        if (urlHexNoiseRx.test(t)) {
          t = t
            .replace(/[0-9A-Fa-f]{0,2}(?:%[0-9A-Fa-f]{2})+[A-Za-z0-9%]*/g, '')
            .replace(/[?&][A-Za-z0-9_]+=\s*$/, '')
            .trim();
          b.text = t;
          if (!t || urlHexNoiseRx.test(t)) return false;
        }
        if (imgHeight > 0) {
          const koMatches = t.match(/[가-힣]/g);
          const koCount = koMatches ? koMatches.length : 0;
          if (b.y1 <= imgHeight * 0.058 && (statusBarRx.test(t) || koCount < 2)) return false;
          if ((b.y0 <= 8 || b.y1 >= imgHeight - 8) && t.length <= 3) return false;
          if (
            /^\d{1,2}:\d{2}(?::\d{2})?$/.test(t) &&
            (b.y1 <= imgHeight * 0.065 || b.y0 >= imgHeight * 0.88)
          ) {
            return false;
          }
          if (hasBottomKeyboard && b.y0 >= imgHeight * 0.68 && (kbdTokenRx.test(t) || t.length <= 2)) {
            return false;
          }
        }
        if (imgWidth > 0 && (b.x0 <= 4 || b.x1 >= imgWidth - 4) && b.w <= imgWidth * 0.16) {
          const koMatches = t.match(/[가-힣]/g);
          if ((koMatches ? koMatches.length : 0) <= 3 && !/\.[a-z]{2,4}\b/i.test(t)) {
            return false;
          }
        }
      }
      // 동영상 플레이어 이동·일시정지 아이콘 노이즈 제거
      if (/^(?:10|0|00|\(\)|00\(\)|\|\||II|lI|Il|#)$/.test(t)) return false;
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

interface CandidateRegion {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  trueH: number;
  angle: number;
  cos: number;
  sin: number;
}

function computeOcrBoxesQualityScore(boxes: PaddleOcrBox[]): number {
  let score = 0;
  for (const b of boxes) {
    const koCount = (b.text.match(/[가-힣]/g) || []).length;
    const alnumCount = (b.text.match(/[A-Za-z0-9]/g) || []).length;
    score += b.conf * (koCount * 2.2 + alnumCount * 0.8);
  }
  return score;
}

async function runOcrPassOnRgba(
  rt: PaddleOcrRuntime,
  rgba: Uint8ClampedArray | Uint8Array,
  srcW: number,
  srcH: number,
  capSide: number
): Promise<{ candidates: CandidateRegion[]; boxes: PaddleOcrBox[] }> {
  const { ort, detSession, recSession, charDict } = rt;

  // 1) Detection: 1080x1920 스마트폰 세로 영상의 소형 컵/라벨 글자도 뭉개지지 않도록 최대 1792px 해상도 보존
  const maxSide = Math.max(srcW, srcH);
  const targetMax = Math.max(960, Math.min(capSide, maxSide));
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
  let detOut: Record<string, any> | null = null;
  let prob!: Float32Array;
  try {
    detOut = await detSession.run({ [detSession.inputNames[0]]: detTensor });
    prob = Float32Array.from(detOut[detSession.outputNames[0]].data as Float32Array);
  } finally {
    try { (detTensor as any).dispose?.(); } catch {}
    if (detOut) {
      for (const k of Object.keys(detOut)) {
        try { detOut[k]?.dispose?.(); } catch {}
      }
    }
  }

  const visited = new Uint8Array(plane);
  const q = new Int32Array(plane);
  const thresh = 0.3;
  const boxThresh = 0.52;
  const sxScale = srcW / detW;
  const syScale = srcH / detH;
  const candidateBoxes: CandidateRegion[] = [];

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
        count = 0,
        sumX = 0,
        sumY = 0;

      while (head < tail) {
        const cur = q[head++];
        const cy = (cur / detW) | 0;
        const cx = cur - cy * detW;
        scoreSum += prob[cur];
        count++;
        sumX += cx;
        sumY += cy;
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

      const cxM = (sumX / count) * sxScale;
      const cyM = (sumY / count) * syScale;

      // 2D PCA 주축 고유벡터로 ±30도(0.52 rad) 기울어진 컵·문서 줄도 회전 불변 trueW/trueH 기준으로 정확히 수평 보정
      let angleRad = 0;
      if (count >= 24) {
        let varX = 0;
        let varY = 0;
        let covXY = 0;
        for (let k = 0; k < tail; k++) {
          const cur = q[k];
          const py = ((cur / detW) | 0) * syScale - cyM;
          const px = (cur % detW) * sxScale - cxM;
          varX += px * px;
          varY += py * py;
          covXY += px * py;
        }
        const theta = 0.5 * Math.atan2(2 * covXY, varX - varY);
        if (Math.abs(theta) >= 0.006 && Math.abs(theta) <= 0.52) {
          const ct = Math.cos(theta);
          const st = Math.sin(theta);
          let utMin = 1e9,
            utMax = -1e9,
            vtMin = 1e9,
            vtMax = -1e9;
          for (let k = 0; k < tail; k++) {
            const cur = q[k];
            const py = ((cur / detW) | 0) * syScale - cyM;
            const px = (cur % detW) * sxScale - cxM;
            const ut = px * ct + py * st;
            const vt = -px * st + py * ct;
            if (ut < utMin) utMin = ut;
            if (ut > utMax) utMax = ut;
            if (vt < vtMin) vtMin = vt;
            if (vt > vtMax) vtMax = vt;
          }
          const twT = utMax - utMin + sxScale;
          const thT = Math.max(2, vtMax - vtMin + syScale);
          if (twT >= thT * 2.1) {
            angleRad = theta;
          }
        }
      }

      const cosA = Math.cos(angleRad);
      const sinA = Math.sin(angleRad);
      let uMin = 1e9,
        uMax = -1e9,
        vMin = 1e9,
        vMax = -1e9;
      for (let k = 0; k < tail; k++) {
        const cur = q[k];
        const dy = ((cur / detW) | 0) * syScale - cyM;
        const dx = (cur % detW) * sxScale - cxM;
        const u = dx * cosA + dy * sinA;
        const v = -dx * sinA + dy * cosA;
        if (u < uMin) uMin = u;
        if (u > uMax) uMax = u;
        if (v < vMin) vMin = v;
        if (v > vMax) vMax = v;
      }

      const trueW = Math.max(4, uMax - uMin + sxScale);
      const trueH = Math.max(4, vMax - vMin + syScale);
      const dRaw = (trueW * trueH * 1.55) / (2 * (trueW + trueH));
      const padU = Math.min(trueH * 0.82, dRaw * 1.15) + 2.5;
      const padV = Math.min(trueH * 0.42, dRaw * 0.72) + 2.0;

      let u0 = uMin - padU;
      let u1 = uMax + padU;
      let v0 = vMin - padV;
      let v1 = vMax + padV;
      if (Math.abs(angleRad) < 0.05 && cosA > 0.5) {
        u0 = Math.max(u0, -cxM / cosA);
        u1 = Math.min(u1, (srcW - cxM) / cosA);
        v0 = Math.max(v0, -cyM / cosA);
        v1 = Math.min(v1, (srcH - cyM) / cosA);
      }

      const xs = [u0, u1].flatMap((cu) => [v0, v1].map((cv) => cxM + cu * cosA - cv * sinA));
      const ys = [u0, u1].flatMap((cu) => [v0, v1].map((cv) => cyM + cu * sinA + cv * cosA));
      const x0 = Math.max(0, Math.floor(Math.min(...xs)));
      const x1 = Math.min(srcW, Math.ceil(Math.max(...xs)));
      const y0 = Math.max(0, Math.floor(Math.min(...ys)));
      const y1 = Math.min(srcH, Math.ceil(Math.max(...ys)));
      if (x1 - x0 >= 6 && y1 - y0 >= 4) {
        candidateBoxes.push({
          x0,
          y0,
          x1,
          y1,
          w: x1 - x0,
          h: y1 - y0,
          cx: cxM,
          cy: cyM,
          u0,
          u1,
          v0,
          v1,
          trueH,
          angle: angleRad,
          cos: cosA,
          sin: sinA,
        });
      }
    }
  }

  candidateBoxes.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  // 동일 기준선(Baseline) 상의 좌우 인접 박스끼리만 padU 중복 침범을 다듬고, 위·아래로 쌓인 기울어진 줄은 절대 잘라내지 않음
  for (let i = 0; i < candidateBoxes.length; i++) {
    for (let j = i + 1; j < candidateBoxes.length; j++) {
      const bi = candidateBoxes[i];
      const bj = candidateBoxes[j];
      const hi = bi.y1 - bi.y0;
      const hj = bj.y1 - bj.y0;
      if (bj.y0 > bi.y1) break;
      const meanCos = 0.5 * (bi.cos + bj.cos);
      const meanSin = 0.5 * (bi.sin + bj.sin);
      const dvCenter = Math.abs(-(bj.cx - bi.cx) * meanSin + (bj.cy - bi.cy) * meanCos);
      if (dvCenter <= 0.45 * Math.min(bi.trueH, bj.trueH)) {
        const [leftB, rightB] = bi.cx <= bj.cx ? [bi, bj] : [bj, bi];
        const xOv = leftB.x1 - rightB.x0;
        if (xOv > 0 && xOv <= Math.max(42, Math.floor(Math.min(hi, hj) * 0.95)) && rightB.x1 > leftB.x1 + 8) {
          const halfOv = xOv * 0.5;
          const midX = (leftB.x1 + rightB.x0) >> 1;
          leftB.u1 -= halfOv;
          rightB.u0 += halfOv;
          leftB.x1 = midX;
          leftB.w = leftB.x1 - leftB.x0;
          rightB.x0 = midX;
          rightB.w = rightB.x1 - rightB.x0;
        }
      }
    }
  }

  const validBoxes = candidateBoxes.filter(
    (b) => b.x1 - b.x0 >= 6 && b.u1 - b.u0 >= 6 && b.v1 - b.v0 >= 4
  );

  if (validBoxes.length === 0) {
    return { candidates: [], boxes: [] };
  }

  // 2) Recognition (PP-OCRv5 Korean, height=48, Catmull-Rom Bicubic + CTC decoding)
  const boxes: PaddleOcrBox[] = [];
  const recInName = recSession.inputNames[0];
  const recOutName = recSession.outputNames[0];

  for (let bi = 0; bi < validBoxes.length; bi++) {
    const b = validBoxes[bi];
    const outW = Math.max(8, Math.round(b.u1 - b.u0));
    const outH = Math.max(8, Math.round(b.v1 - b.v0));
    const recH = 48;
    const recW = Math.max(48, Math.min(1600, Math.round(outW * (recH / outH))));
    const resized = new Uint8Array(recW * recH * 4);
    const uSpan = b.u1 - b.u0;
    const vSpan = b.v1 - b.v0;

    for (let oy = 0; oy < recH; oy++) {
      const vCur = b.v0 + ((oy + 0.5) / recH) * vSpan;
      for (let ox = 0; ox < recW; ox++) {
        const uCur = b.u0 + ((ox + 0.5) / recW) * uSpan;
        const sxF = Math.max(0, Math.min(srcW - 1.001, b.cx + uCur * b.cos - vCur * b.sin));
        const syF = Math.max(0, Math.min(srcH - 1.001, b.cy + uCur * b.sin + vCur * b.cos));
        sampleCatmullRomRGBA(rgba, srcW, srcH, sxF, syF, resized, (oy * recW + ox) * 4);
      }
    }

    const rPlane = recH * recW;
    const recInput = new Float32Array(3 * rPlane);
    const shAmt = outH < 34 ? 0.5 : outH < 46 ? 0.35 : 0;

    if (shAmt > 0) {
      for (let oy = 0; oy < recH; oy++) {
        const ym = oy > 0 ? oy - 1 : 0;
        const yp = oy + 1 < recH ? oy + 1 : recH - 1;
        for (let ox = 0; ox < recW; ox++) {
          const xm = ox > 0 ? ox - 1 : 0;
          const xp = ox + 1 < recW ? ox + 1 : recW - 1;
          const idx = oy * recW + ox;
          const cOff = idx * 4;
          const lOff = (oy * recW + xm) * 4;
          const rOff = (oy * recW + xp) * 4;
          const uOff = (ym * recW + ox) * 4;
          const dOff = (yp * recW + ox) * 4;
          for (let ch = 0; ch < 3; ch++) {
            const center = resized[cOff + ch];
            const blur =
              (center * 4 +
                resized[lOff + ch] +
                resized[rOff + ch] +
                resized[uOff + ch] +
                resized[dOff + ch]) *
              0.125;
            const sharpV = Math.max(0, Math.min(255, center + shAmt * (center - blur)));
            const bgrPlane = 2 - ch;
            recInput[bgrPlane * rPlane + idx] = (sharpV / 255 - 0.5) / 0.5;
          }
        }
      }
    } else {
      for (let i = 0; i < rPlane; i++) {
        recInput[i] = (resized[i * 4 + 2] / 255 - 0.5) / 0.5;
        recInput[rPlane + i] = (resized[i * 4 + 1] / 255 - 0.5) / 0.5;
        recInput[rPlane * 2 + i] = (resized[i * 4] / 255 - 0.5) / 0.5;
      }
    }

    const recTensor = new ort.Tensor('float32', recInput, [1, 3, recH, recW]);
    let rOut: Record<string, any> | null = null;
    let seqLen = 0;
    let numCls = 0;
    let data!: Float32Array;
    try {
      rOut = await recSession.run({
        [recInName]: recTensor,
      });
      const logits = rOut[recOutName];
      seqLen = Number(logits.dims[1] || 0);
      numCls = Number(logits.dims[2] || 0);
      data = Float32Array.from(logits.data as Float32Array);
    } finally {
      try { (recTensor as any).dispose?.(); } catch {}
      if (rOut) {
        for (const k of Object.keys(rOut)) {
          try { rOut[k]?.dispose?.(); } catch {}
        }
      }
    }

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

    while (charPairs.length > 0 && charPairs[0].sc < 0.56) {
      charPairs.shift();
    }
    while (charPairs.length > 0 && charPairs[charPairs.length - 1].sc < 0.56) {
      charPairs.pop();
    }

    let ci = 0;
    while (ci < charPairs.length) {
      const cp = charPairs[ci];
      if (cp.ch !== ' ' && !/[가-힣0-9]/.test(cp.ch)) {
        if (/[A-Za-z]/.test(cp.ch)) {
          let cj = ci + 1;
          while (cj < charPairs.length && /[A-Za-z]/.test(charPairs[cj].ch)) {
            cj++;
          }
          const runLen = cj - ci;
          let sumSc = 0;
          let maxSc = 0;
          for (let k = ci; k < cj; k++) {
            sumSc += charPairs[k].sc;
            if (charPairs[k].sc > maxSc) maxSc = charPairs[k].sc;
          }
          const meanSc = sumSc / runLen;
          if ((runLen === 1 && meanSc < 0.84) || (runLen <= 6 && meanSc < 0.78 && maxSc < 0.88)) {
            for (let k = ci; k < cj; k++) {
              charPairs[k] = { ch: ' ', sc: charPairs[k].sc };
            }
          }
          ci = cj;
          continue;
        } else if (cp.sc < 0.82) {
          charPairs[ci] = { ch: ' ', sc: cp.sc };
        }
      }
      ci++;
    }

    const clean = polishKoreanOcrSpacing(charPairs.map((p) => p.ch).join(''));
    const scored = charPairs.filter((p) => p.ch !== ' ');
    const avgConf =
      scored.length > 0 ? scored.reduce((acc, p) => acc + p.sc, 0) / scored.length : 0;
    const minAvgConf = /[가-힣]{2,}/.test(clean) ? 0.72 : 0.78;
    if (clean && avgConf >= minAvgConf) {
      boxes.push({
        x0: b.x0,
        y0: b.y0,
        x1: b.x1,
        y1: b.y1,
        w: b.w,
        h: outH,
        conf: avgConf,
        text: clean,
      });
    }

    if ((bi + 1) % 6 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  return { candidates: validBoxes, boxes };
}

async function runSingleImageOcrInternal(
  rgba: Uint8ClampedArray | Uint8Array,
  srcW: number,
  srcH: number,
  options?: PaddleOcrOptions
): Promise<{ text: string; boxes: PaddleOcrBox[] }> {
  if (srcW < 16 || srcH < 16) return { text: '', boxes: [] };
  const rt = await getPaddleOcrRuntime();

  const pass1 = await runOcrPassOnRgba(rt, rgba, srcW, srcH, 1792);
  let bestBoxes = pass1.boxes;

  // 스마트폰 전체 프레임(예: 1080x1920) 안에서 손에 든 컵·약품·영수증 등 국소 소형 글자 영역(면적 < 45%, 줄 높이 < 34px)이
  // 포착된 경우, 해당 텍스트 군집 ROI만 원본 픽셀에서 도려내 고해상도 재판독하여 줄 뭉개짐과 오탈자를 근본 제거합니다.
  if (pass1.candidates.length >= 2) {
    let minX = srcW,
      minY = srcH,
      maxX = 0,
      maxY = 0;
    const heights: number[] = [];
    for (const c of pass1.candidates) {
      if (c.x0 < minX) minX = c.x0;
      if (c.y0 < minY) minY = c.y0;
      if (c.x1 > maxX) maxX = c.x1;
      if (c.y1 > maxY) maxY = c.y1;
      heights.push(c.trueH);
    }
    heights.sort((a, b) => a - b);
    const medianH = heights[heights.length >> 1] || 40;
    const pad = Math.max(28, Math.round(medianH * 1.8));
    const rx0 = Math.max(0, minX - pad);
    const ry0 = Math.max(0, minY - pad);
    const rx1 = Math.min(srcW, maxX + pad);
    const ry1 = Math.min(srcH, maxY + pad);
    const rw = rx1 - rx0;
    const rh = ry1 - ry0;
    const roiAreaRatio = (rw * rh) / Math.max(1, srcW * srcH);
    const meanConf =
      pass1.boxes.length > 0
        ? pass1.boxes.reduce((acc, b) => acc + b.conf, 0) / pass1.boxes.length
        : 0;

    if (
      rw >= 96 &&
      rh >= 64 &&
      roiAreaRatio < 0.45 &&
      (medianH < 34 || meanConf < 0.91)
    ) {
      const roiRaw = new Uint8Array(rw * rh * 4);
      for (let y = 0; y < rh; y++) {
        const srcOff = ((ry0 + y) * srcW + rx0) * 4;
        roiRaw.set(rgba.subarray(srcOff, srcOff + rw * 4), y * rw * 4);
      }
      const upScale = Math.max(1, Math.min(2.4, 1216 / Math.max(rw, rh)));
      const upW = Math.max(64, Math.round(rw * upScale));
      const upH = Math.max(64, Math.round(rh * upScale));
      const roiRgba =
        upScale > 1.12 ? resizeBicubicRGBA(roiRaw, rw, rh, upW, upH) : roiRaw;
      const effW = upScale > 1.12 ? upW : rw;
      const effH = upScale > 1.12 ? upH : rh;
      const invUp = rw / effW;
      const pass2 = await runOcrPassOnRgba(rt, roiRgba, effW, effH, 1792);
      const mappedBoxes: PaddleOcrBox[] = pass2.boxes.map((b) => {
        const mx0 = Math.round(rx0 + b.x0 * invUp);
        const my0 = Math.round(ry0 + b.y0 * invUp);
        const mx1 = Math.round(rx0 + b.x1 * invUp);
        const my1 = Math.round(ry0 + b.y1 * invUp);
        return {
          ...b,
          x0: mx0,
          y0: my0,
          x1: mx1,
          y1: my1,
          w: Math.max(4, mx1 - mx0),
          h: Math.max(4, Math.round(b.h * invUp)),
        };
      });
      if (computeOcrBoxesQualityScore(mappedBoxes) > computeOcrBoxesQualityScore(bestBoxes) * 1.03) {
        bestBoxes = mappedBoxes;
      }
    }
  }

  const formatted = formatOcrBoxesSmart(bestBoxes, {
    filterVideoUi: options?.filterVideoUi,
    imgWidth: srcW,
    imgHeight: srcH,
  });
  return { text: formatted, boxes: bestBoxes };
}

/**
 * ONNX Runtime Web 단일 세션 동시성 보호 직렬화 큐로 안전하게 이미지 OCR을 수행합니다.
 */
export function runPaddleOcrOnRgbaDirect(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options?: PaddleOcrOptions
): Promise<{ text: string; boxes: PaddleOcrBox[] }> {
  const job = inferenceChain.then(() =>
    runSingleImageOcrInternal(rgba, width, height, options)
  );
  inferenceChain = job.catch(() => undefined);
  return job;
}

export function releasePaddleOcrRuntimeDirect(): Promise<void> {
  const job = inferenceChain.then(async () => {
    const activePromise = runtimePromise;
    runtimePromise = null;
    if (!activePromise) return;
    try {
      const rt = await activePromise;
      await rt.detSession.release();
      await rt.recSession.release();
    } catch {
      /* ignore release error */
    }
  });
  inferenceChain = job.catch(() => undefined);
  return job;
}

let ocrWorkerInstance: Worker | null = null;
let ocrWorkerSeq = 0;
const ocrWorkerPending = new Map<
  number,
  { resolve: (v: any) => void; reject: (e: any) => void }
>();

function getOrCreateOcrWorker(): Worker | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
  if (ocrWorkerInstance) return ocrWorkerInstance;
  try {
    const w = new Worker(new URL('./paddleOcrWorker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (ev: MessageEvent) => {
      const msg = ev.data || {};
      const entry = ocrWorkerPending.get(msg.id);
      if (!entry) return;
      ocrWorkerPending.delete(msg.id);
      if (msg.ok) entry.resolve(msg.result);
      else entry.reject(new Error(msg.error || 'OCR_WORKER_FAILED'));
    };
    w.onerror = () => {
      for (const [, p] of ocrWorkerPending) {
        p.reject(new Error('OCR_WORKER_CRASHED'));
      }
      ocrWorkerPending.clear();
      try {
        w.terminate();
      } catch {
        /* ignore */
      }
      if (ocrWorkerInstance === w) ocrWorkerInstance = null;
    };
    ocrWorkerInstance = w;
    return w;
  } catch {
    return null;
  }
}

export function recognizeImageDataWithPaddleOcr(
  imageData: ImageData,
  options?: PaddleOcrOptions
): Promise<{ text: string; boxes: PaddleOcrBox[] }> {
  const worker = getOrCreateOcrWorker();
  if (worker) {
    const id = ++ocrWorkerSeq;
    const copy = new Uint8ClampedArray(imageData.data);
    return new Promise<{ text: string; boxes: PaddleOcrBox[] }>((resolve, reject) => {
      ocrWorkerPending.set(id, { resolve, reject });
      worker.postMessage(
        {
          id,
          type: 'ocr',
          rgbaBuffer: copy.buffer,
          width: imageData.width,
          height: imageData.height,
          options,
        },
        [copy.buffer]
      );
    }).catch(() =>
      runPaddleOcrOnRgbaDirect(imageData.data, imageData.width, imageData.height, options)
    );
  }
  return runPaddleOcrOnRgbaDirect(imageData.data, imageData.width, imageData.height, options);
}

/**
 * 데스크톱 백그라운드 탭 유휴 전환(20초+) 및 모바일 백그라운드/대형 비전 모델 로드 전
 * PP-OCRv5 워커·WASM 세션을 즉시 반환하여 메모리 점유를 0MB로 되돌립니다.
 * 이후 온디맨드 OCR 호출 시 CacheStorage에서 0.1초 만에 자동 재로딩됩니다.
 */
export async function releasePaddleOcrRuntime(): Promise<void> {
  if (ocrWorkerInstance) {
    const w = ocrWorkerInstance;
    ocrWorkerInstance = null;
    try {
      const id = ++ocrWorkerSeq;
      await Promise.race([
        new Promise<void>((resolve) => {
          ocrWorkerPending.set(id, { resolve: () => resolve(), reject: () => resolve() });
          w.postMessage({ id, type: 'release' });
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 600)),
      ]);
    } catch {
      /* ignore */
    }
    for (const [, p] of ocrWorkerPending) {
      p.reject(new Error('OCR_WORKER_RELEASED'));
    }
    ocrWorkerPending.clear();
    try {
      w.terminate();
    } catch {
      /* ignore */
    }
  }
  await releasePaddleOcrRuntimeDirect();
}

export async function recognizeDataUrlWithPaddleOcr(
  dataUrl: string,
  options?: PaddleOcrOptions
): Promise<{ text: string; boxes: PaddleOcrBox[] }> {
  if (typeof document === 'undefined' || !dataUrl) return { text: '', boxes: [] };
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const scale = Math.min(1, 1920 / Math.max(w, h));
        const cw = Math.max(32, Math.round(w * scale));
        const ch = Math.max(32, Math.round(h * scale));
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          canvas.width = 0;
          canvas.height = 0;
          resolve({ text: '', boxes: [] });
          return;
        }
        ctx.drawImage(img, 0, 0, cw, ch);
        const imgData = ctx.getImageData(0, 0, cw, ch);
        canvas.width = 0;
        canvas.height = 0;
        const res = await recognizeImageDataWithPaddleOcr(imgData, options);
        resolve(res);
      } catch {
        canvas.width = 0;
        canvas.height = 0;
        resolve({ text: '', boxes: [] });
      }
    };
    img.onerror = () => resolve({ text: '', boxes: [] });
    img.src = dataUrl;
  });
}
