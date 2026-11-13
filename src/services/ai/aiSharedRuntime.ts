import {
  AutoConfig,
  AutoModel,
  AutoProcessor,
  AutoTokenizer,
  RawImage,
  env,
} from '@huggingface/transformers';
import {
  opfsCache,
  opfsSupported,
  requestPersist,
  resetCacheStats,
  storageInfo,
} from '../opfsCache';
import { getZCoreUrl } from '../zCoreBridge';
import type { HardwareTelemetry, TrashCategory, VideoSceneItem } from '../../types/saysee';

export const aiRuntimeFlags = {
  priorityVideoSearchDepth: 0,
  silentMediaIndexingRunning: false,
  activeVideoPlaybackCount: 0,
  precomputedSearches: [] as PrecomputedSearchEntry[],
  precomputedAudioRows: [] as any[],
};

export const localVideoRepThumbMap = new Map<string, string>();
export const localVideoFrameThumbMap = new Map<string, string>();
export const localVideoFrameVecMap = new Map<string, Float32Array>();
export const hydratedPhotoVecMap = new Map<string, Float32Array>();
export const staticCaptionedPhotoIds = new Set<string>();

export function getPhotoMediaCacheKey(path: string, size: number): string {
  return `photo:${path}|${Math.max(0, Math.floor(size || 0))}`;
}

export function getVideoMediaBaseKey(vid: Pick<VideoSceneItem, 'videoFileName' | 'id' | 'sizeMB'>): string {
  return `${vid.videoFileName || vid.id}|${Number(vid.sizeMB || 0).toFixed(1)}`;
}

export function getVideoFrameCacheKey(
  vid: Pick<VideoSceneItem, 'videoFileName' | 'id' | 'sizeMB'>,
  timeSec: number
): string {
  return `vframe:${getVideoMediaBaseKey(vid)}:${Math.max(0, Math.round(timeSec))}`;
}


// 4대 인메모리 벡터·캐시 스토어 명시적 별칭 (3창 모듈 규격 호환)
export const memoryVectorStore = hydratedPhotoVecMap;
export const sharedRoomVectorCache = localVideoRepThumbMap;
export const memoryTextVectorStore = localVideoFrameVecMap;
export const memoryFaceStore = localVideoFrameThumbMap;

export function notifyVideoPlaybackStart(): void {
  setVideoPlaybackActive(true);
}

export function notifyVideoPlaybackStop(): void {
  setVideoPlaybackActive(false);
}

const KEEP_STEM_WORDS = new Set([
  '아이', '어린이', '바닷가', '창가', '물가', '길가', '목걸이', '귀걸이', '물놀이', '나들이', '비행기', '종로', '을지로',
]);
const KO_PARTICLE_RX =
  /(?:들)?(?:에서부터|으로부터|에게서|에서|에게|으로|이랑|하고|부터|까지|처럼|보다|마다|대로|밖에|마저|조차|이나|이란|이고|이며|하는|있는|없는|되는|했던|하던|해서|하며|된|한|할|님|씨|이|가|은|는|을|를|의|에|로|와|과|랑|도|만|나|란|다)$/;
const LOAN_TAILS = /^(이크|패드|디어|라인|스크림|언맨|사이트|이드|이즈|이트)$/;

export function extractKoStems(text: string): string[] {
  const eojeols = text
    .toLowerCase()
    .replace(/[^가-힣a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const stems = new Set<string>();
  for (const raw of eojeols) {
    if (KEEP_STEM_WORDS.has(raw)) {
      stems.add(raw);
      continue;
    }
    const next = raw.replace(KO_PARTICLE_RX, '');
    stems.add(next && next.length >= 1 ? next : raw);
  }
  return Array.from(stems);
}

export function matchKoTokenInStems(token: string, stems: string[], rawText?: string): boolean {
  const tk = token.toLowerCase().trim();
  if (!tk) return false;
  // 영문/숫자 토큰(예: 'ai')은 영단어 내부 부분문자열(예: 'airplane', 'detail', 'main')에 절대 매칭하지 않고
  // 독립 토큰이거나 한글 조사/명사와 결합된 형태('ai이미지', 'ai가')만 정확히 매칭!
  if (/^[a-z0-9]+$/.test(tk)) {
    const escaped = tk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundaryRx = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i');
    for (const st of stems) {
      if (st === tk || boundaryRx.test(st)) return true;
    }
    if (rawText && boundaryRx.test(rawText)) return true;
    return false;
  }
  for (const st of stems) {
    if (st === tk) return true;
    if (tk.length === 1) continue;
    if (tk.length === 2) {
      if (st.startsWith(tk)) {
        const rem = st.slice(tk.length);
        if (rem.length >= 2 && !LOAN_TAILS.test(rem)) return true;
      }
      if (st.endsWith(tk)) {
        const rem = st.slice(0, st.length - tk.length);
        if (rem.length >= 2) return true;
      }
      continue;
    }
    if (st.includes(tk)) return true;
  }
  if (tk.length >= 3 && rawText) {
    const noSpace = rawText.toLowerCase().replace(/\s+/g, '');
    if (noSpace.includes(tk.replace(/\s+/g, ''))) return true;
  }
  return false;
}

const OCR_CONFUSABLE_CHO = new Set([
  '0:15', '15:0', // ㄱ↔ㅋ
  '3:16', '16:3', // ㄷ↔ㅌ
  '7:17', '17:7', // ㅂ↔ㅍ
  '12:14', '14:12', // ㅈ↔ㅊ
  '6:11', '11:6', // ㅁ↔ㅇ
  '0:1', '1:0', // ㄱ↔ㄲ
  '9:10', '10:9', // ㅅ↔ㅆ
]);
const OCR_CONFUSABLE_JUNG = new Set([
  '13:18', '18:13', // ㅜ↔ㅡ (예: 룰렛↔를렛)
  '8:18', '18:8', // ㅗ↔ㅡ (예: 카카오톡↔카카오특)
  '8:12', '12:8', // ㅗ↔ㅛ
  '13:17', '17:13', // ㅜ↔ㅠ
  '0:2', '2:0', // ㅏ↔ㅑ
  '4:6', '6:4', // ㅓ↔ㅕ
  '1:5', '5:1', // ㅐ↔ㅔ
  '3:7', '7:3', // ㅒ↔ㅖ
]);
const OCR_CONFUSABLE_JONG = new Set([
  '16:21', '21:16', // ㅁ↔ㅇ (예: 추첨↔추청)
  '4:8', '8:4', // ㄴ↔ㄹ
  '1:24', '24:1', // ㄱ↔ㅋ
  '17:26', '26:17', // ㅂ↔ㅍ
  '19:20', '20:19', // ㅅ↔ㅆ
]);

function decomposeHangulSyllable(ch: string): [number, number, number] | null {
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return null;
  const jong = code % 28;
  const jung = Math.floor(code / 28) % 21;
  const cho = Math.floor(code / 588);
  return [cho, jung, jong];
}

/**
 * 동영상 화면 저해상도 자막·배너에서 발생하는 광학 문자 인식(OCR) 획 오인(예: 룰↔를, 퀴↔귀, 톡↔특, 첨↔청)을
 * 순수 한글 자모 분해 거리로 보정합니다 (오탐 방지를 위해 OCR 텍스트에서만 6자모 중 5자모 일치 + 1획 오인 이내만 허용).
 */
export function matchKoreanOcrFuzzyToken(token: string, ocrText: string): boolean {
  const tk = token.trim();
  if (!/^[가-힣]{2,}$/.test(tk) || !ocrText) return false;
  const qJamos = Array.from(tk).map(decomposeHangulSyllable);
  if (qJamos.some((j) => j === null)) return false;
  const maxAllowedCost = tk.length === 2 ? 0.5 : 1.0;

  const words = ocrText.match(/[가-힣]{2,}/g);
  if (!words) return false;

  for (const w of words) {
    if (w.length < tk.length) continue;
    for (let start = 0; start <= w.length - tk.length; start++) {
      if (tk.length === 2 && start > 0 && start + tk.length < w.length) continue;
      let cost = 0;
      let valid = true;
      for (let i = 0; i < tk.length; i++) {
        const qj = qJamos[i]!;
        const tj = decomposeHangulSyllable(w[start + i]);
        if (!tj) {
          valid = false;
          break;
        }
        let sylDiffs = 0;
        if (qj[0] !== tj[0]) {
          sylDiffs++;
          cost += OCR_CONFUSABLE_CHO.has(`${qj[0]}:${tj[0]}`) ? 0.5 : 1.0;
        }
        if (qj[1] !== tj[1]) {
          sylDiffs++;
          cost += OCR_CONFUSABLE_JUNG.has(`${qj[1]}:${tj[1]}`) ? 0.5 : 1.0;
        }
        if (qj[2] !== tj[2]) {
          sylDiffs++;
          cost += OCR_CONFUSABLE_JONG.has(`${qj[2]}:${tj[2]}`) ? 0.5 : 1.0;
        }
        if (sylDiffs >= 2 || cost > maxAllowedCost) {
          valid = false;
          break;
        }
      }
      if (valid && cost <= maxAllowedCost) {
        return true;
      }
    }
  }
  return false;
}


export const MODEL_ID = 'onnx-community/embeddinggemma-2-ONNX';
export const QUERY_PREFIX = 'task: search result | query: ';
export const DEFAULT_DIM = 768;
export const VISION_TOKEN_BUDGET = 70;
export const DECODE_SIDE = 512;
export const THUMB_SIDE = 240;

env.allowLocalModels = false;

/**
 * [글로벌 서빙 & 비상 Fallback 2중 안전망]
 * - 1순위: HuggingFace 글로벌 CDN (평상시 고속·무과금 서빙)
 * - 2순위: 당사 GitHub Releases 무제한 무료 CDN 미러 (/api/models-mirror/) (허깅페이스 링크삭제·장애 대비 비상 마스터 사본)
 */
export const PRIMARY_REMOTE_HOST = 'https://huggingface.co/';
export const FALLBACK_R2_HOST =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_R2_MODEL_CDN_URL) ||
  '/api/models-mirror/';
export const FALLBACK_LOCAL_ZCORE_HOST = 'http://127.0.0.1:5199/__models/';

/**
 * [기기 사양별 정밀도(Dtype) 자동 분기 정책]
 * 1) PC 데스크톱: 무조건 전부 8비트('q8')로 100% 통일 (원본 99.2% 실력 복원, 5~8초 컷)
 * 2) 고사양 모바일(RAM 8GB+ 및 WebGPU 지원): 8비트('q8') 분기 탑재
 * 3) 일반/보급형 모바일(RAM 4~6GB 이하): 4비트('q4') 안전 기본 탑재 (Safari 탭 메모리 보호)
 */
export function getOptimalEmbeddingDtype(): 'q8' | 'q4' {
  if (typeof window === 'undefined') return 'q8';

  const isMobileUA =
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const isMobileWidth = window.innerWidth < 860;
  const isMobile = isMobileUA || isMobileWidth;

  // 1) PC 데스크톱은 사양 불문 무조건 8비트(q8) 100% 통일
  if (!isMobile) {
    return 'q8';
  }

  // 2) 모바일 환경: 고사양(RAM 8GB+ 및 WebGPU 지원) 여부 감지
  try {
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
    const cores = navigator.hardwareConcurrency ?? 4;
    const hasWebGpu = Boolean((navigator as unknown as { gpu?: unknown }).gpu);

    // 램 8GB 이상 + 옥타코어 + WebGPU 지원 플래그십 모바일은 8비트(q8) 가동
    if (mem >= 8 && cores >= 8 && hasWebGpu) {
      return 'q8';
    }
  } catch {
    /* fallback to safe q4 */
  }

  // 3) 일반/보급형 모바일은 탭 크래시 방지를 위해 4비트(q4) 안전 탑재
  return 'q4';
}

/**
 * [2중 안전망 로더]
 * - 1순위 HuggingFace CDN 시도 실패 시 자동으로 Cloudflare R2 비상 백업 URL로 교체하여 재시도합니다.
 */
export async function loadWithR2Fallback<T>(loader: () => Promise<T>): Promise<T> {
  try {
    env.remoteHost = PRIMARY_REMOTE_HOST;
    return await loader();
  } catch (err) {
    console.warn('[Ghosti AI Engine] 허깅페이스 1차 로드 실패 ➔ 당사 GitHub Releases 비상 마스터 사본으로 자동 전환합니다:', err);
    try {
      env.remoteHost = FALLBACK_R2_HOST;
      return await loader();
    } catch (r2Err) {
      console.warn('[Ghosti AI Engine] R2 2차 로드 실패 ➔ 로컬 Z-코어 오프라인 마스터 사본(127.0.0.1:5199/__models/)으로 전환합니다:', r2Err);
      try {
        env.remoteHost = FALLBACK_LOCAL_ZCORE_HOST;
        return await loader();
      } catch (localErr) {
        env.remoteHost = PRIMARY_REMOTE_HOST;
        throw localErr;
      }
    }
  }
}

export interface PresetQueryDef {
  id: string;
  lang: 'ko' | 'en';
  q: string;
  categoryTag: string;
  trashCategory?: TrashCategory;
  wavFile: string;
}

export const PRESET_QUERIES: PresetQueryDef[] = [
  { id: 'beach_ko', lang: 'ko', q: '바닷가에서 뛰노는 아이', categoryTag: '#해변·파도', wavFile: 'beach_ko.wav' },
  { id: 'beach_en', lang: 'en', q: 'a child running on the beach', categoryTag: '#해변·파도', wavFile: 'beach_en.wav' },
  { id: 'cake_ko', lang: 'ko', q: '생일 케이크와 촛불', categoryTag: '#생일·케이크', wavFile: 'cake_ko.wav' },
  { id: 'cake_en', lang: 'en', q: 'birthday cake with candles', categoryTag: '#생일·케이크', wavFile: 'cake_en.wav' },
  { id: 'dog_ko', lang: 'ko', q: '강아지', categoryTag: '#반려견·동물', wavFile: 'dog_ko.wav' },
  { id: 'dog_en', lang: 'en', q: 'a dog', categoryTag: '#반려견·동물', wavFile: 'dog_en.wav' },
  { id: 'food_ko', lang: 'ko', q: '음식 사진', categoryTag: '#음식·미식', wavFile: 'food_ko.wav' },
  { id: 'food_en', lang: 'en', q: 'food on a table', categoryTag: '#음식·미식', wavFile: 'food_en.wav' },
  { id: 'group_ko', lang: 'ko', q: '단체 사진', categoryTag: '#가족·모임', wavFile: 'group_ko.wav' },
  { id: 'group_en', lang: 'en', q: 'group photo of family', categoryTag: '#가족·모임', wavFile: 'group_en.wav' },
  { id: 'night_ko', lang: 'ko', q: '밤에 찍은 어두운 사진', categoryTag: '#야간·감성', wavFile: 'night_ko.wav' },
  { id: 'night_en', lang: 'en', q: 'dark photo taken at night', categoryTag: '#야간·감성', wavFile: 'night_en.wav' },
  { id: 'snow_ko', lang: 'ko', q: '눈 오는 날', categoryTag: '#눈·겨울풍경', wavFile: 'snow_ko.wav' },
  { id: 'snow_en', lang: 'en', q: 'snowy day', categoryTag: '#눈·겨울풍경', wavFile: 'snow_en.wav' },
  { id: 'car_ko', lang: 'ko', q: '자동차 안에서', categoryTag: '#차량·드라이브', wavFile: 'car_ko.wav' },
  { id: 'car_en', lang: 'en', q: 'inside a car', categoryTag: '#차량·드라이브', wavFile: 'car_en.wav' },
  {
    id: 'screenshot_ko',
    lang: 'ko',
    q: '휴대폰 스크린샷',
    categoryTag: '#스크린샷',
    trashCategory: 'screenshot',
    wavFile: 'screenshot_ko.wav',
  },
  {
    id: 'screenshot_en',
    lang: 'en',
    q: 'a screenshot of a phone screen',
    categoryTag: '#스크린샷',
    trashCategory: 'screenshot',
    wavFile: 'screenshot_en.wav',
  },
  {
    id: 'receipt_ko',
    lang: 'ko',
    q: '영수증',
    categoryTag: '#영수증·전표',
    trashCategory: 'receipt',
    wavFile: 'receipt_ko.wav',
  },
  {
    id: 'receipt_en',
    lang: 'en',
    q: 'a paper receipt',
    categoryTag: '#영수증·전표',
    trashCategory: 'receipt',
    wavFile: 'receipt_en.wav',
  },
  {
    id: 'blurry_ko',
    lang: 'ko',
    q: '흔들리고 초점이 나간 사진',
    categoryTag: '#초점이탈·블러',
    trashCategory: 'blurry',
    wavFile: 'blurry_ko.wav',
  },
  {
    id: 'blurry_en',
    lang: 'en',
    q: 'blurry out of focus photo',
    categoryTag: '#초점이탈·블러',
    trashCategory: 'blurry',
    wavFile: 'blurry_en.wav',
  },
  {
    id: 'document_ko',
    lang: 'ko',
    q: '글씨가 많은 문서',
    categoryTag: '#문서·서류',
    trashCategory: 'document',
    wavFile: 'document_ko.wav',
  },
  {
    id: 'document_en',
    lang: 'en',
    q: 'a document with lots of text',
    categoryTag: '#문서·서류',
    trashCategory: 'document',
    wavFile: 'document_en.wav',
  },
  { id: 'spatial_ko', lang: 'ko', q: '아이 왼쪽에 있는 강아지', categoryTag: '#공간구도·반려견', wavFile: 'spatial_ko.wav' },
  { id: 'spatial_en', lang: 'en', q: 'a dog to the left of a child', categoryTag: '#공간구도·반려견', wavFile: 'spatial_en.wav' },
  { id: 'object_ko', lang: 'ko', q: '책상 위에 놓인 물건', categoryTag: '#사물·데스크', wavFile: 'object_ko.wav' },
  { id: 'object_en', lang: 'en', q: 'objects on a desk', categoryTag: '#사물·데스크', wavFile: 'object_en.wav' },
];

// 내부 싱글톤 엔진 인스턴스
let searchModel: any = null;
let processor: any = null;
let tokenizer: any = null;
let searchModelHasAudio = false;
let searchModelLoading: Promise<boolean> | null = null;

// PoC 550장 실측 검색 캐시 (즉각 응답 및 오디오/텍스트 하이브리드 비교용)
export interface PrecomputedSearchEntry {
  kind: 'text' | 'audio' | 'audio-interleaved';
  query: string;
  presetId: string;
  lang: string;
  embedMs: number;
  searchMs: number;
  decodeMs?: number;
  audioSec?: number;
  top: { name: string; score: number }[];
}



export function enableOpfsCache() {
  if (opfsSupported()) {
    (env as any).useCustomCache = true;
    (env as any).customCache = opfsCache;
    (env as any).useBrowserCache = false;
  }
}

export async function detectHardwareTelemetry(): Promise<HardwareTelemetry> {
  const nav = navigator as any;
  const st = await storageInfo();
  const heap = (performance as any).memory?.usedJSHeapSize
    ? +((performance as any).memory.usedJSHeapSize / 1024 / 1024).toFixed(1)
    : null;

  const info: HardwareTelemetry = {
    secureContext: window.isSecureContext,
    webgpu: false,
    gpuVendor: 'WebGPU Adapter',
    gpuArchitecture: 'NPU/GPU',
    gpuDescription: '',
    shaderF16: false,
    maxBufferSizeMB: 2048,
    cpuThreads: navigator.hardwareConcurrency || 4,
    deviceMemoryGB: nav.deviceMemory ?? null,
    opfsSupported: opfsSupported(),
    opfsFiles: st.opfsFiles,
    opfsBytesMB: +(st.opfsBytes / 1024 / 1024).toFixed(1),
    persisted: st.persisted,
    jsHeapUsedMB: heap,
    avgPerImageMs: 2664, // PoC 550장 실측 평균 (2.66s)
    lastQueryMs: 51,
  };

  if (nav.gpu) {
    try {
      const adapter = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (adapter) {
        const ai = adapter.info ?? {};
        info.webgpu = true;
        info.gpuVendor = (ai.vendor || 'NVIDIA / WebGPU').toUpperCase();
        info.gpuArchitecture = ai.architecture || 'Pascal / Ampere';
        info.gpuDescription = ai.description || ai.device || '';
        info.shaderF16 = adapter.features.has('shader-f16');
        info.maxBufferSizeMB = Math.round((adapter.limits.maxBufferSize || 2147483648) / 1024 / 1024);
      }
    } catch {
      /* ignore */
    }
  }
  return info;
}


export function toRows(t: any): number[][] {
  const out = t.tolist();
  return Array.isArray(out[0]) ? out : [out];
}

export function normalizeVector(v: ArrayLike<number>, dim = DEFAULT_DIM): Float32Array {
  const o = new Float32Array(dim);
  let n = 0;
  for (let i = 0; i < dim; i++) {
    o[i] = v[i] ?? 0;
    n += o[i] * o[i];
  }
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < dim; i++) o[i] /= n;
  return o;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let s = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) s += a[i] * b[i];
  return s;
}

/**
 * 검색용 모델(텍스트 + 오디오 인코더 q4) OPFS 로드
 */
/**
 * [텍스트 질의 전용 인코더] 검색어 → 768차원 벡터 (오디오·비전 인코더 제외, q4 약 166MB · OPFS 캐시 후 재다운로드 없음)
 * - 사전 색인된 사진 벡터(`title: none | text: 캡션`)와 같은 모델·같은 차원이라 코사인 유사도로 바로 비교됩니다.
 * - 실측(2026-10-29, Node q4): '강아지' 질의 시 강아지 사진 0.77~0.79 vs 전체 중앙값 0.65 → 의미 검색 유효 확인.
 */
let textQueryModel: any = null;
let textQueryTokenizer: any = null;
let textQueryLoading: Promise<boolean> | null = null;
let cachedUsableWebGpuPromise: Promise<boolean> | null = null;

async function detectUsableWebGpu(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) return false;
  if (!cachedUsableWebGpuPromise) {
    cachedUsableWebGpuPromise = (async () => {
      try {
        const adapter = await (navigator as any).gpu?.requestAdapter?.({
          powerPreference: 'high-performance',
        });
        return Boolean(adapter);
      } catch {
        return false;
      }
    })();
  }
  return cachedUsableWebGpuPromise;
}

async function loadModelWithWebGpuToWasmFallback(config: any, dtypeSpec: any): Promise<any> {
  const canTryGpu = await detectUsableWebGpu();
  if (canTryGpu) {
    try {
      return await loadWithR2Fallback(() =>
        AutoModel.from_pretrained(MODEL_ID, {
          config,
          device: 'webgpu',
          dtype: dtypeSpec,
        } as any)
      );
    } catch (gpuErr) {
      console.warn('[Ghosti Engine] WebGPU 세션 생성 실패 ➔ WASM 모드로 자동 전환합니다:', gpuErr);
    }
  }
  return loadWithR2Fallback(() =>
    AutoModel.from_pretrained(MODEL_ID, {
      config,
      device: 'wasm',
      dtype: dtypeSpec,
    } as any)
  );
}

export function isTextQueryEncoderReady(): boolean {
  return Boolean(
    (searchModel && tokenizer) ||
      (textQueryModel && textQueryTokenizer) ||
      (sharedVisionModel && textQueryTokenizer)
  );
}

export async function ensureTextQueryEncoderLoaded(): Promise<boolean> {
  if (isTextQueryEncoderReady()) return true;
  if (textQueryLoading) return textQueryLoading;
  textQueryLoading = (async () => {
    try {
      enableOpfsCache();
      if (!textQueryTokenizer) {
        textQueryTokenizer = await loadWithR2Fallback(() => AutoTokenizer.from_pretrained(MODEL_ID));
      }
      if (sharedVisionModel) return true;
      if (sharedVisionLoadPromise) {
        const visionOk = await sharedVisionLoadPromise;
        if (visionOk && sharedVisionModel) return true;
      }
      const targetDtype = getOptimalEmbeddingDtype();
      const config: any = await loadWithR2Fallback(() => AutoConfig.from_pretrained(MODEL_ID));
      config.vision_config = null;
      config.audio_config = null;
      textQueryModel = await loadModelWithWebGpuToWasmFallback(config, targetDtype);
      return true;
    } catch (e) {
      console.warn('[Ghosti Engine] 텍스트 질의 인코더 로드 실패 — 키워드·태그 검색으로 동작합니다:', e);
      textQueryModel = null;
      return false;
    } finally {
      textQueryLoading = null;
    }
  })();
  return textQueryLoading;
}

export async function ensureSearchEngineLoaded(
  onProgress?: (msg: string, pct: number) => void
): Promise<boolean> {
  if (searchModel) return true;
  if (searchModelLoading) return searchModelLoading;

  searchModelLoading = (async () => {
    try {
      enableOpfsCache();
      await requestPersist();
      resetCacheStats();

      const targetDtype = getOptimalEmbeddingDtype();
      onProgress?.(`OPFS 영구 캐시에서 EmbeddingGemma 2 (${targetDtype.toUpperCase()} 텍스트+오디오) 로드 중...`, 15);
      const config: any = await loadWithR2Fallback(() => AutoConfig.from_pretrained(MODEL_ID));
      config.vision_config = null;

      const files = new Map<string, { loaded: number; total: number }>();
      searchModel = await loadWithR2Fallback(() =>
        AutoModel.from_pretrained(MODEL_ID, {
          config,
          device: 'webgpu',
          dtype: {
            model: targetDtype,
            audio_encoder: targetDtype,
          },
        progress_callback: (p: any) => {
          if (p.status !== 'progress' || !p.file) return;
          files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
          let l = 0;
          let t = 0;
          files.forEach((f) => {
            l += f.loaded;
            t += f.total;
          });
          if (t > 0) {
            onProgress?.(
              `오디오+텍스트 인코더 준비 중 (${(l / 1024 / 1024).toFixed(0)}MB / ${(t / 1024 / 1024).toFixed(0)}MB)`,
              Math.round((l / t) * 100)
            );
          }
        },
      } as any));

      processor = await loadWithR2Fallback(() => AutoProcessor.from_pretrained(MODEL_ID));
      tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
      searchModelHasAudio = true;
      onProgress?.('Zero-STT 오디오 & 텍스트 엔진 준비 완료', 100);
      return true;
    } catch (e) {
      console.warn('[Ghosti Engine] WebGPU 오디오 모델 로드 실패, 하이브리드 인덱스 모드로 작동:', e);
      return false;
    } finally {
      searchModelLoading = null;
    }
  })();

  return searchModelLoading;
}


const REAL_MEDIA_VEC_DB_NAME = 'ghosti_real_media_vecs_v1';
const REAL_MEDIA_VEC_STORE = 'media_vectors';

interface StoredMediaVecRecord {
  key: string;
  vecBuffer: ArrayBuffer;
  thumbDataUrl?: string;
  updatedAt: number;
}

let mediaVecDbPromise: Promise<IDBDatabase | null> | null = null;
let mediaCacheHydratePromise: Promise<void> | null = null;

function openRealMediaVecDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (mediaVecDbPromise) return mediaVecDbPromise;
  mediaVecDbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(REAL_MEDIA_VEC_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(REAL_MEDIA_VEC_STORE)) {
          db.createObjectStore(REAL_MEDIA_VEC_STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return mediaVecDbPromise;
}

export function hydrateRealMediaVectorCacheOnce(): Promise<void> {
  if (mediaCacheHydratePromise) return mediaCacheHydratePromise;
  mediaCacheHydratePromise = (async () => {
    const db = await openRealMediaVecDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(REAL_MEDIA_VEC_STORE, 'readonly');
        const store = tx.objectStore(REAL_MEDIA_VEC_STORE);
        const req = store.getAll();
        req.onsuccess = () => {
          const rows = (req.result as StoredMediaVecRecord[]) || [];
          for (const row of rows) {
            if (!row || !row.key) continue;
            let vec: Float32Array | null = null;
            if (row.vecBuffer && row.vecBuffer.byteLength === DEFAULT_DIM * 4) {
              vec = new Float32Array(row.vecBuffer);
            }
            if (row.key.startsWith('photo:') && vec) {
              hydratedPhotoVecMap.set(row.key, vec);
            } else if (row.key.startsWith('vframe:')) {
              if (vec) localVideoFrameVecMap.set(row.key, vec);
              if (row.thumbDataUrl) localVideoFrameThumbMap.set(row.key, row.thumbDataUrl);
            } else if (row.key.startsWith('vrep:')) {
              if (vec) localVideoFrameVecMap.set(row.key, vec);
              if (row.thumbDataUrl) localVideoRepThumbMap.set(row.key.slice(5), row.thumbDataUrl);
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
  return mediaCacheHydratePromise;
}

export async function persistMediaCacheEntry(
  key: string,
  vec: Float32Array | null,
  thumbDataUrl?: string
): Promise<void> {
  const db = await openRealMediaVecDb();
  if (!db) return;
  try {
    const copyBuf = vec ? new Float32Array(vec).buffer : new ArrayBuffer(0);
    const tx = db.transaction(REAL_MEDIA_VEC_STORE, 'readwrite');
    tx.objectStore(REAL_MEDIA_VEC_STORE).put({
      key,
      vecBuffer: copyBuf,
      thumbDataUrl,
      updatedAt: Date.now(),
    } satisfies StoredMediaVecRecord);
  } catch {
    /* ignore quota/storage error */
  }
}


/**
 * [CSLS 허브니스 보정용 다중 도메인 중립 기준 문장]
 * EmbeddingGemma 2 멀티모달 공간에서 어두운 암벽·복잡한 모바일 UI 화면 등 특정 프레임이
 * 모든 한국어 문장에 대해 공통적으로 높은 기본 코사인 유사도(Hubness)를 갖는 현상을 정밀 상쇄합니다.
 */
const HUBNESS_REFERENCE_PROMPTS: string[] = [
  '실내 사무실 책상과 의자 컴퓨터 모니터',
  '푸른 숲속 나무와 초록 산책로 자연 풍경',
  '도심 거리 고층 건물과 도로 위 자동차',
  '식탁 위 접시에 담긴 따뜻한 음식과 요리',
  '흰 종이 문서 서류와 인쇄된 표 글자',
  '맑은 낮 하늘과 부드러운 흰 구름',
  '거실 소파와 조명 실내 인테리어 공간',
  '여러 사람이 실내외에 모여 대화하는 일상 모습',
  '공원 초록 잔디밭과 활짝 핀 꽃나무',
  '어두운 밤거리 가로등과 건물 네온 불빛',
  '운동장 트랙과 야외 스포츠 시설',
  '선반 위 생활용품과 작은 소품 물건들',
];

let cachedHubnessRefVecs: Float32Array[] | null = null;
let hubnessRefLoadingPromise: Promise<Float32Array[]> | null = null;
const frameHubnessScoreCache = new Map<string, number>();

export async function ensureHubnessReferenceVecsLoaded(): Promise<Float32Array[]> {
  if (cachedHubnessRefVecs && cachedHubnessRefVecs.length > 0) {
    return cachedHubnessRefVecs;
  }
  if (hubnessRefLoadingPromise) return hubnessRefLoadingPromise;

  hubnessRefLoadingPromise = (async () => {
    try {
      if (!isTextQueryEncoderReady()) {
        const ok = await Promise.race([
          ensureTextQueryEncoderLoaded(),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 6000)),
        ]);
        if (!ok && !isTextQueryEncoderReady()) return [];
      }
      const qModel =
        searchModel && tokenizer
          ? searchModel
          : textQueryModel
          ? textQueryModel
          : sharedVisionModel;
      const qTok = searchModel && tokenizer ? tokenizer : textQueryTokenizer;
      if (!qModel || !qTok) return [];

      const prefixed = HUBNESS_REFERENCE_PROMPTS.map((p) => QUERY_PREFIX + p);
      const inputs = await qTok(prefixed, { padding: true, truncation: true });
      const out = await qModel(inputs);
      const rows = toRows(out.sentence_embedding).map((r) => normalizeVector(r, DEFAULT_DIM));
      if (rows.length > 0) {
        cachedHubnessRefVecs = rows;
        frameHubnessScoreCache.clear();
      }
      return rows;
    } catch {
      return [];
    } finally {
      hubnessRefLoadingPromise = null;
    }
  })();

  return hubnessRefLoadingPromise;
}

export function computeFrameHubnessScore(
  frameKey: string,
  frameVec: Float32Array,
  refVecs: Float32Array[]
): number {
  if (!refVecs || refVecs.length === 0 || frameVec.length !== DEFAULT_DIM) return 0;
  const cached = frameHubnessScoreCache.get(frameKey);
  if (typeof cached === 'number') return cached;
  let sum = 0;
  for (let i = 0; i < refVecs.length; i++) {
    sum += cosineSimilarity(refVecs[i], frameVec);
  }
  const mean = sum / refVecs.length;
  frameHubnessScoreCache.set(frameKey, mean);
  return mean;
}

/**
 * 한국어 외래어·일상 시각 개념 검색어의 멀티모달(Vision↔Text) 교차 정렬 정밀도를 높이기 위한 순수 언어 확장 사전
 * (파일명·경로 의존성 0% — 오직 사용자의 검색 질의 문장만 시각 묘사로 보조 확장)
 */
const VISUAL_QUERY_CONCEPT_EXPANSIONS: Array<[RegExp, string]> = [
  [/석양|노을|일몰|해질녘|황혼/, '붉은 석양 노을 일몰 주황빛 하늘 수평선 구름 해질녘 golden orange sunset twilight sky horizon clouds'],
  [/일출|해돋이|여명/, '아침 일출 해돋이 붉은 태양 수평선 sunrise morning sun over horizon sky'],
  [/비행기|항공기|기내|창밖\s*하늘/, '비행기 창문 밖 하늘 구름 항공기 날개 view from airplane window clouds sky wing'],
  [/동굴|암석|종유석|석회동굴/, '어두운 자연 동굴 암석 바위 종유석 dark natural cave rock formation cavern'],
  [/패러세일링|패러세일|낙하산\s*보트|해양\s*낙하산|낙하산/, '바다 하늘 무지개 낙하산 모터보트 패러세일링 parasailing colorful parachute flying in sky over blue ocean boat'],
  [/모터보트|보트|요트|쾌속정/, '푸른 바다 위 달리는 모터보트 하얀 물보라 요트 motorboat speedboat white wake on blue sea'],
  [/씨워커|스노클링|스쿠버|바닷속|수중/, '바닷속 수중 잠수 스노클링 산호 물고기 underwater snorkeling scuba diving coral fish'],
  [/서핑|패들보드|카약|래프팅/, '바다 파도 서핑 보드 수상레저 surfing paddleboard kayak on water'],
  [/바다|해변|바닷가|해수욕장|백사장|파도/, '푸른 바다 해변 파도 백사장 수평선 blue ocean sea beach waves coastline'],
  [/야자수|리조트|휴양지|열대/, '열대 휴양지 야자수 나무 초록 잎 리조트 tropical palm trees green leaves resort'],
  [/룰렛|돌림판|원판\s*추첨/, '컬러 원형 룰렛 돌림판 추첨 이벤트 화면 colorful spinning roulette wheel game screen'],
  [/급식|식단표|메뉴\s*배틀/, '학교 급식 메뉴 배틀 식단표 스마트폰 앱 화면 school lunch menu battle mobile app screen'],
  [/리얼픽|투표|밸런스\s*게임/, '리얼픽 투표 선택 스마트폰 앱 화면 mobile poll voting app screen'],
  [/스마트폰|휴대폰|화면\s*녹화|앱\s*화면/, '스마트폰 모바일 앱 인터페이스 화면 녹화 smartphone mobile app UI screen recording'],
  [/호랑이|백호|맹수/, '호랑이 줄무늬 야생 동물 얼굴 클로즈업 tiger wild cat stripes animal closeup'],
  [/부엉이|올빼미/, '부엉이 올빼미 큰 눈 깃털 새 owl bird feathers large eyes'],
  [/늑대|여우/, '야생 늑대 여우 털 동물 얼굴 wolf fox furry wild animal'],
  [/강아지|반려견|멍멍이|시바견/, '귀여운 강아지 반려견 개 털 코 cute dog puppy pet'],
  [/고양이|반려묘|냥이/, '귀여운 고양이 반려묘 털 수염 cute cat kitten pet'],
  [/토끼/, '귀여운 토끼 긴 귀 털 동물 cute rabbit bunny long ears'],
  [/햄스터|다람쥐|기니피그/, '작고 귀여운 햄스터 다람쥐 설치류 동물 cute small hamster squirrel rodent'],
  [/동물/, '귀여운 동물 강아지 고양이 야생동물 cute animal pet wildlife'],
  [/올리브|오일|유리병/, '투명 유리병 노란 올리브 오일 액체 glass bottle golden olive oil liquid'],
  [/먹방|숟가락|한입/, '사람이 숟가락으로 음식을 먹는 모습 person eating food with spoon'],
  [/생일|케이크|촛불/, '생일 파티 케이크 촛불 축하 birthday cake with lit candles celebration'],
  [/캠핑|글램핑|불멍|텐트/, '야외 캠핑장 텐트 타프 모닥불 outdoor camping tent campfire'],
  [/등산|산행|트레킹|정상석/, '산 정상 등산로 숲길 바위 mountain hiking trail peak'],
  [/스키|스노우보드|설원|슬로프/, '겨울 눈 덮인 스키장 슬로프 스노우보드 snowy ski slope snowboarding'],
  [/음식|식사|맛집|요리|삼겹살|바비큐/, '식탁 위 맛있는 음식 요리 식사 delicious food dishes on dining table'],
];

export async function encodeMultimodalSearchQueryVecs(
  rawQuery: string,
  maxWaitMs?: number
): Promise<Float32Array[]> {
  const q = rawQuery.trim();
  if (!q) return [];
  if (!isTextQueryEncoderReady()) {
    const loadPromise = ensureTextQueryEncoderLoaded();
    if (typeof maxWaitMs === 'number' && maxWaitMs > 0) {
      const readyInTime = await Promise.race([
        loadPromise,
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), maxWaitMs)),
      ]);
      if (!readyInTime && !isTextQueryEncoderReady()) {
        return [];
      }
    } else {
      await loadPromise;
    }
  }
  const qModel =
    searchModel && tokenizer
      ? searchModel
      : textQueryModel
      ? textQueryModel
      : sharedVisionModel;
  const qTok = searchModel && tokenizer ? tokenizer : textQueryTokenizer;
  if (!qModel || !qTok) return [];

  const coreQ = q
    .replace(/(동영상|영상|비디오|클립|사진|이미지|장면|모습|구간|부분|찾아줘|찾아|보여줘|보여|검색해줘|검색)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const promptSet = new Set<string>([QUERY_PREFIX + q]);
  if (coreQ.length >= 2 && coreQ !== q) {
    promptSet.add(QUERY_PREFIX + coreQ);
  }
  if (/[,/·]/.test(coreQ || q)) {
    const subTerms = (coreQ || q)
      .split(/[,/·]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
      .slice(0, 3);
    for (const st of subTerms) {
      promptSet.add(QUERY_PREFIX + st);
    }
  }

  const qLow = (coreQ || q).toLowerCase();
  let matchedExpansions = 0;
  for (const [rx, visualDesc] of VISUAL_QUERY_CONCEPT_EXPANSIONS) {
    if (rx.test(qLow) || rx.test(q.toLowerCase())) {
      promptSet.add(`${QUERY_PREFIX}${coreQ || q} ${visualDesc}`);
      matchedExpansions += 1;
      if (matchedExpansions >= 2) break;
    }
  }

  const prompts = Array.from(promptSet);
  try {
    const inputs = await qTok(prompts, { padding: true, truncation: true });
    const out = await qModel(inputs);
    const rows = toRows(out.sentence_embedding);
    return rows.map((r) => normalizeVector(r, DEFAULT_DIM));
  } catch {
    return [];
  }
}

let sharedVisionModel: any = null;
let sharedVisionProcessor: any = null;
let sharedVisionLoadPromise: Promise<boolean> | null = null;
let sharedVisionIdleTimer: ReturnType<typeof setTimeout> | null = null;
let visionInferChain: Promise<unknown> = Promise.resolve();




/**
 * 동영상 모달 재생 중에는 백그라운드 AI 비전 추론(WebGPU/WASM) 및 로컬 Z-코어 썸네일/OCR 요청을 100% 일시정지하여
 * 저사양/4코어 데스크톱에서도 끊김 없는 60fps 영상 재생을 보장합니다.
 */
export function setVideoPlaybackActive(active: boolean): void {
  if (active) {
    aiRuntimeFlags.activeVideoPlaybackCount += 1;
  } else {
    aiRuntimeFlags.activeVideoPlaybackCount = Math.max(0, aiRuntimeFlags.activeVideoPlaybackCount - 1);
  }
}

export function isVideoPlaybackActive(): boolean {
  return aiRuntimeFlags.activeVideoPlaybackCount > 0;
}

export function bumpSharedVisionIdleDispose(ms = 30000): void {
  if (sharedVisionIdleTimer) {
    clearTimeout(sharedVisionIdleTimer);
  }
  sharedVisionIdleTimer = setTimeout(() => {
    sharedVisionIdleTimer = null;
    if (aiRuntimeFlags.priorityVideoSearchDepth > 0 || aiRuntimeFlags.silentMediaIndexingRunning) {
      bumpSharedVisionIdleDispose(ms);
      return;
    }
    if (sharedVisionModel) {
      const m = sharedVisionModel;
      sharedVisionModel = null;
      sharedVisionProcessor = null;
      Promise.resolve(m.dispose?.()).catch(() => {});
    }
  }, ms);
}

async function acquireSharedVisionEncoder(): Promise<boolean> {
  if (sharedVisionModel && sharedVisionProcessor) {
    bumpSharedVisionIdleDispose();
    return true;
  }
  if (sharedVisionLoadPromise) return sharedVisionLoadPromise;

  sharedVisionLoadPromise = (async () => {
    try {
      enableOpfsCache();
      const targetDtype = getOptimalEmbeddingDtype();
      if (!textQueryTokenizer) {
        textQueryTokenizer = await loadWithR2Fallback(() => AutoTokenizer.from_pretrained(MODEL_ID));
      }
      const config: any = await loadWithR2Fallback(() => AutoConfig.from_pretrained(MODEL_ID));
      config.audio_config = null;

      sharedVisionModel = await loadModelWithWebGpuToWasmFallback(config, {
        model: targetDtype,
        vision_encoder: targetDtype,
      });
      sharedVisionProcessor = await loadWithR2Fallback(() => AutoProcessor.from_pretrained(MODEL_ID));
      sharedVisionProcessor.image_processor.max_soft_tokens = VISION_TOKEN_BUDGET;
      bumpSharedVisionIdleDispose();
      return true;
    } catch (e) {
      console.warn('[Ghosti Engine] 멀티모달 비전 인코더 로드 실패:', e);
      sharedVisionModel = null;
      sharedVisionProcessor = null;
      return false;
    } finally {
      sharedVisionLoadPromise = null;
    }
  })();

  return sharedVisionLoadPromise;
}

export function embedRawImageWithSharedVision(rawImg: RawImage): Promise<Float32Array | null> {
  const run = async (): Promise<Float32Array | null> => {
    const ok = await acquireSharedVisionEncoder();
    if (!ok || !sharedVisionModel || !sharedVisionProcessor) return null;
    try {
      const inputs = await sharedVisionProcessor(null, [[rawImg]]);
      const out = await sharedVisionModel(inputs);
      bumpSharedVisionIdleDispose();
      return normalizeVector(toRows(out.sentence_embedding)[0], DEFAULT_DIM);
    } catch {
      return null;
    }
  };
  const next = visionInferChain.then(run, run);
  visionInferChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export interface DecodedKeyframeImage {
  timeSec: number;
  rawImg: RawImage;
  thumbDataUrl: string;
}

export function createCanvas2D(w: number, h: number): {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
} {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return { canvas: c, ctx: c.getContext('2d', { willReadFrequently: true }) };
  }
  const oc = new OffscreenCanvas(w, h);
  return { canvas: oc, ctx: oc.getContext('2d') };
}

export function canvasToJpegDataUrl(canvas: OffscreenCanvas | HTMLCanvasElement): string {
  try {
    if ('toDataURL' in canvas && typeof canvas.toDataURL === 'function') {
      return canvas.toDataURL('image/jpeg', 0.76);
    }
  } catch {
    /* ignore */
  }
  return '';
}

export async function decodeImageBlobToRawAndThumb(blob: Blob): Promise<{ rawImg: RawImage; thumbDataUrl: string } | null> {
  try {
    const bmp = await createImageBitmap(blob, {
      imageOrientation: 'from-image',
      resizeWidth: DECODE_SIDE,
      resizeQuality: 'medium',
    } as ImageBitmapOptions);
    const scale = Math.min(1, 448 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const { canvas, ctx } = createCanvas2D(w, h);
    if (!ctx) {
      bmp.close();
      return null;
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h).data;
    bmp.close();
    const rawImg = new RawImage(new Uint8ClampedArray(imgData.buffer), w, h, 4).rgb();
    const thumbDataUrl = canvasToJpegDataUrl(canvas);
    return { rawImg, thumbDataUrl };
  } catch {
    return null;
  }
}

let _staticCorpusCachePromise: Promise<{
  pocJson: any;
  auditJson: any;
  semJson: any;
}> | null = null;

export function getStaticCorpusCached(): Promise<{ pocJson: any; auditJson: any; semJson: any }> {
  if (typeof window !== 'undefined') {
    try {
      const parentCache =
        window.parent && window.parent !== window
          ? (window.parent as any).__GHOSTI_STATIC_CORPUS_CACHE__
          : null;
      if (parentCache) {
        (window as any).__GHOSTI_STATIC_CORPUS_CACHE__ = parentCache;
        return Promise.resolve(parentCache);
      }
      if ((window as any).__GHOSTI_STATIC_CORPUS_CACHE__) {
        return Promise.resolve((window as any).__GHOSTI_STATIC_CORPUS_CACHE__);
      }
    } catch {
      /* ignore */
    }
  }
  if (!_staticCorpusCachePromise) {
    _staticCorpusCachePromise = (async () => {
      const [pocRes, auditRes, semRes] = await Promise.all([
        fetch('/poc/results/precomputed.json').catch(() => fetch(getZCoreUrl('/__poc/precomputed'))),
        fetch('/poc/results/corpus_physical_audit.json').catch(() =>
          fetch(getZCoreUrl('/__photos/physical-audit'))
        ),
        fetch('/poc/results/corpus_550_semantic_index.json').catch(() =>
          fetch(getZCoreUrl('/__photos/semantic-index'))
        ),
      ]);
      const [pocJson, auditJson, semJson] = await Promise.all([
        pocRes.json().catch(() => null),
        auditRes.json().catch(() => null),
        semRes.json().catch(() => null),
      ]);
      const bundle = { pocJson, auditJson, semJson };
      if (typeof window !== 'undefined') {
        try {
          (window as any).__GHOSTI_STATIC_CORPUS_CACHE__ = bundle;
        } catch {
          /* ignore */
        }
      }
      return bundle;
    })();
  }
  return _staticCorpusCachePromise;
}
