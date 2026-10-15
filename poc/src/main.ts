/**
 * SaySee PoC — EmbeddingGemma 2 온디바이스 실측 (D-15, D-17, D-18)
 *
 * 흐름
 *  1) 텍스트+비전 모델 로드 (OPFS 영구 캐시)
 *  2) 사진 N장 디코딩 → 비전 인코더 임베딩 (배치)
 *  3) 비전 모델 해제 (D-08)
 *  4) 음성 모드 판정 (스마트 폴백) → 검색 모델 로드
 *       audio-direct : 텍스트+오디오
 *       stt-fallback : 텍스트 전용
 *  5) 텍스트 질의 / 음성 직접 질의 검색 지연·정확도 측정
 *  6) 리포트 저장 (PC: poc/results/)
 *
 * 사진·음성은 브라우저 메모리에서만 처리되며 외부로 전송되지 않음.
 * 네트워크 사용: Hugging Face 모델 파일 최초 다운로드뿐 (이후 OPFS).
 */
import './style.css';
import { AutoConfig, AutoModel, AutoProcessor, AutoTokenizer, RawImage, env, load_audio } from '@huggingface/transformers';
import { cacheStats, clearOpfsCache, opfsCache, opfsSupported, requestPersist, resetCacheStats, storageInfo } from './opfsCache';
import { MicRecorder, VoiceDecision, precheckVoice, recognizeOnce, sttAvailable } from './voice';
import PRESETS from './presets.json';

const MODEL_ID = 'onnx-community/embeddinggemma-2-ONNX';
const WEBGPU_TOKEN_LIMIT = 2700;
const DECODE_MAX_SIDE = 1024;
const THUMB_SIDE = 192;
const QUERY_PREFIX = 'task: search result | query: ';
const TOPK = 12;

env.allowLocalModels = false;

// ───────────────────────── 타입 ─────────────────────────
type Dtype = 'q4' | 'q4f16' | 'q8' | 'fp16' | 'fp32';
interface Settings {
  scenario: string;
  device: 'webgpu' | 'wasm';
  textDtype: Dtype;
  visionDtype: Dtype;
  audioDtype: Dtype;
  budget: number;
  batch: number;
  maxPhotos: number;
  dim: number;
  cacheBackend: 'opfs' | 'browser';
  voiceMode: 'auto' | 'audio' | 'stt';
}
interface Preset { id: string; lang: string; q: string }
interface PhotoSrc { name: string; size: number; load: () => Promise<Blob> }
interface Indexed { name: string; thumb: string; vec: Float32Array }
interface SearchLog {
  kind: 'text' | 'audio' | 'audio-interleaved' | 'stt';
  query: string;
  presetId?: string;
  lang?: string;
  embedMs: number;
  searchMs: number;
  decodeMs?: number;
  audioSec?: number;
  top: { name: string; score: number }[];
}

// ───────────────────────── DOM ─────────────────────────
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const logEl = $('log');
const stageEl = $('stage');
const barEl = $('bar');

function log(msg: string) {
  const t = new Date().toLocaleTimeString('ko-KR', { hour12: false });
  logEl.textContent += `[${t}] ${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
  console.log('[SaySee PoC]', msg);
}
function setStage(msg: string, pct?: number) {
  stageEl.textContent = msg;
  if (pct !== undefined) barEl.style.width = `${Math.max(0, Math.min(100, pct)).toFixed(1)}%`;
}
function renderKV(el: HTMLElement, rows: [string, string, string?][]) {
  el.innerHTML = rows.map(([k, v, c]) => `<span class="k">${k}</span><span class="${c ?? ''}">${escapeHtml(v)}</span>`).join('');
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
const fmtMs = (ms: number) => (ms >= 10000 ? `${(ms / 1000).toFixed(1)}초` : `${ms.toFixed(0)}ms`);
const fmtMB = (b: number) => `${(b / 1024 / 1024).toFixed(1)}MB`;

// ───────────────────────── 상태 ─────────────────────────
let sources: PhotoSrc[] = [];
let sourceKind = '';
let index: Indexed[] = [];
let processor: any = null;
let searchModel: any = null;
let searchHasAudio = false;
let tokenizer: any = null;
let envInfo: Record<string, any> = {};
let settings: Settings | null = null;
let report: Record<string, any> | null = null;
let voiceDecision: VoiceDecision | null = null;
const searchLogs: SearchLog[] = [];
const textVecs = new Map<string, Float32Array>(); // presetId → 텍스트 질의 벡터

// ───────────────────────── ① 환경 ─────────────────────────
const jsHeap = (): number | null => (performance as any).memory?.usedJSHeapSize ?? null;

async function detectEnv() {
  const nav = navigator as any;
  const info: Record<string, any> = {
    userAgent: navigator.userAgent,
    platform: nav.userAgentData?.platform ?? navigator.platform,
    mobile: nav.userAgentData?.mobile ?? /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent),
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemoryGB: nav.deviceMemory ?? null,
    secureContext: window.isSecureContext,
    screen: `${screen.width}x${screen.height}@${devicePixelRatio}x`,
    webgpu: false,
    opfs: opfsSupported(),
    webSpeech: sttAvailable(),
    mediaRecorder: typeof MediaRecorder !== 'undefined',
  };
  if (nav.gpu) {
    try {
      const adapter = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (adapter) {
        const ai = adapter.info ?? {};
        Object.assign(info, {
          webgpu: true,
          gpuVendor: ai.vendor || '',
          gpuArchitecture: ai.architecture || '',
          gpuDevice: ai.device || '',
          gpuDescription: ai.description || '',
          shaderF16: adapter.features.has('shader-f16'),
          maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
          maxBufferSize: adapter.limits.maxBufferSize,
        });
      }
    } catch (e) {
      info.webgpuError = String(e);
    }
  }
  envInfo = info;
  const pre = precheckVoice(info, 'auto');
  const st = await storageInfo();

  const rows: [string, string, string?][] = [
    ['보안 컨텍스트', info.secureContext ? 'HTTPS OK' : 'HTTP — WebGPU 불가', info.secureContext ? 'good' : 'bad'],
    ['WebGPU', info.webgpu ? '사용 가능' : '사용 불가', info.webgpu ? 'good' : 'warn'],
  ];
  if (info.webgpu) {
    rows.push(['GPU', [info.gpuVendor, info.gpuArchitecture, info.gpuDevice, info.gpuDescription].filter(Boolean).join(' / ') || '(비공개)']);
    rows.push(['shader-f16', info.shaderF16 ? '지원' : '미지원']);
    rows.push(['maxStorageBufferBindingSize', fmtMB(info.maxStorageBufferBindingSize)]);
    rows.push(['maxBufferSize', fmtMB(info.maxBufferSize)]);
  }
  rows.push(['CPU 스레드', String(info.hardwareConcurrency)]);
  rows.push(['기기 메모리(힌트)', info.deviceMemoryGB ? `${info.deviceMemoryGB}GB 이상` : '비공개']);
  rows.push(['OPFS', info.opfs ? `지원 · 캐시 ${st.opfsFiles}개 ${fmtMB(st.opfsBytes)} · 영구 ${st.persisted ? 'O' : 'X'}` : '미지원', info.opfs ? 'good' : 'warn']);
  rows.push(['Web Speech (STT)', info.webSpeech ? '지원' : '미지원']);
  rows.push(['음성 모드 사전 판정', `${pre.mode === 'audio-direct' ? '🎙️ 오디오 직접' : '⌨️ STT 폴백'} — ${pre.reason}`, pre.mode === 'audio-direct' ? 'good' : 'warn']);
  rows.push(['UA', String(info.userAgent)]);
  renderKV($('envBox'), rows);
  $('cacheInfo').textContent = `OPFS 캐시 ${st.opfsFiles}개 · ${fmtMB(st.opfsBytes)}`;

  $('ctxBadge').textContent = info.mobile ? 'MOBILE' : 'DESKTOP';
  if (info.mobile) ($('scenario') as HTMLSelectElement).value = 'mobile-onboarding';
  if (!info.webgpu) ($('device') as HTMLSelectElement).value = 'wasm';
  if (!info.opfs) ($('cacheBackend') as HTMLSelectElement).value = 'browser';
}

// ───────────────────────── ② 설정 ─────────────────────────
function readSettings(): Settings {
  const v = (id: string) => ($(id) as HTMLInputElement | HTMLSelectElement).value;
  const s: Settings = {
    scenario: v('scenario'),
    device: v('device') as Settings['device'],
    textDtype: v('textDtype') as Dtype,
    visionDtype: v('visionDtype') as Dtype,
    audioDtype: v('audioDtype') as Dtype,
    budget: Number(v('budget')),
    batch: Math.max(1, Number(v('batch')) || 1),
    maxPhotos: Math.max(1, Number(v('maxPhotos')) || 300),
    dim: Number(v('dim')),
    cacheBackend: v('cacheBackend') as Settings['cacheBackend'],
    voiceMode: v('voiceMode') as Settings['voiceMode'],
  };
  if (s.device === 'webgpu') {
    const maxBatch = Math.max(1, Math.floor(WEBGPU_TOKEN_LIMIT / s.budget));
    if (s.batch > maxBatch) {
      log(`배치 ${s.batch} → ${maxBatch}로 축소 (WebGPU 토큰 상한)`);
      s.batch = maxBatch;
      ($('batch') as HTMLInputElement).value = String(maxBatch);
    }
  }
  return s;
}

function applyCache(s: Settings) {
  if (s.cacheBackend === 'opfs' && opfsSupported()) {
    (env as any).useCustomCache = true;
    (env as any).customCache = opfsCache;
    (env as any).useBrowserCache = false;
  } else {
    (env as any).useCustomCache = false;
    (env as any).customCache = null;
    (env as any).useBrowserCache = true;
  }
}

// ───────────────────────── ③ 사진 소스 ─────────────────────────
const isImageName = (n: string) => /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(n);

function setSources(list: PhotoSrc[], kind: string) {
  sources = list;
  sourceKind = kind;
  const total = list.reduce((a, s) => a + s.size, 0);
  const heic = list.filter((s) => /\.hei[cf]$/i.test(s.name)).length;
  $('srcInfo').textContent = `${kind}: ${list.length}장, ${fmtMB(total)}` + (heic ? ` · HEIC ${heic}장 (디코딩 불가 시 건너뜀)` : '');
  ($('runBtn') as HTMLButtonElement).disabled = list.length === 0;
}

function filesToSources(files: FileList | null): PhotoSrc[] {
  if (!files) return [];
  return Array.from(files)
    .filter((f) => f.type.startsWith('image/') || isImageName(f.name))
    .sort((a, b) => ((a as any).webkitRelativePath || a.name).localeCompare((b as any).webkitRelativePath || b.name))
    .map((f) => ({ name: (f as any).webkitRelativePath || f.name, size: f.size, load: async () => f }));
}

async function useServerPhotos(): Promise<boolean> {
  try {
    const j = await (await fetch('/__photos/list')).json();
    if (!j.exists || j.files.length === 0) {
      $('srcInfo').textContent = `PC의 test_photos 폴더가 비어 있음: ${j.dir}`;
      return false;
    }
    setSources(
      j.files.map((f: { path: string; size: number }) => ({
        name: f.path,
        size: f.size,
        load: async () => (await fetch(`/__photos/file?p=${encodeURIComponent(f.path)}`)).blob(),
      })),
      'PC test_photos (LAN)',
    );
    return true;
  } catch (e) {
    $('srcInfo').textContent = `불러오기 실패: ${e}`;
    return false;
  }
}

$('pickFolder').addEventListener('change', (e) => setSources(filesToSources((e.target as HTMLInputElement).files), '폴더'));
$('pickFiles').addEventListener('change', (e) => setSources(filesToSources((e.target as HTMLInputElement).files), '갤러리 선택'));
$('useServer').addEventListener('click', () => void useServerPhotos());

// ───────────────────────── 이미지 디코딩 ─────────────────────────
function makeCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
async function canvasToBlob(c: OffscreenCanvas | HTMLCanvasElement): Promise<Blob> {
  if ('convertToBlob' in c) return c.convertToBlob({ type: 'image/jpeg', quality: 0.75 });
  return new Promise((res) => (c as HTMLCanvasElement).toBlob((b) => res(b!), 'image/jpeg', 0.75));
}
// 토큰 예산별 디코딩 크기 (프로세서가 어차피 축소하므로 원본 전체 디코딩은 낭비)
const decodeSideFor = (budget: number) => (budget <= 70 ? 512 : budget <= 140 ? 640 : budget <= 280 ? 896 : DECODE_MAX_SIDE);

async function decodePhoto(blob: Blob, maxSide = DECODE_MAX_SIDE) {
  // 1차: 디코딩과 동시에 축소 (Chrome/Edge/Safari 지원). 짧은 변 기준 미지정 → 가로를 maxSide로 맞춤
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(blob, { imageOrientation: 'from-image', resizeWidth: maxSide, resizeQuality: 'medium' } as ImageBitmapOptions);
    if (bmp.height > maxSide * 1.5) {
      // 세로로 매우 긴 이미지(스크린샷 등)는 높이 기준으로 다시 맞춤
      bmp.close();
      bmp = await createImageBitmap(blob, { imageOrientation: 'from-image', resizeHeight: maxSide, resizeQuality: 'medium' } as ImageBitmapOptions);
    }
  } catch {
    bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  }
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.drawImage(bmp, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const image = new RawImage(new Uint8ClampedArray(data.buffer), w, h, 4).rgb();
  const ts = Math.min(1, THUMB_SIDE / Math.max(w, h));
  const tc = makeCanvas(Math.round(w * ts), Math.round(h * ts));
  (tc.getContext('2d') as CanvasRenderingContext2D).drawImage(bmp, 0, 0, tc.width, tc.height);
  const thumb = URL.createObjectURL(await canvasToBlob(tc));
  bmp.close();
  return { image, thumb };
}

// ───────────────────────── 벡터 유틸 ─────────────────────────
function toRows(t: any): number[][] {
  const out = t.tolist();
  return Array.isArray(out[0]) ? out : [out];
}
function normalizeTrunc(v: ArrayLike<number>, dim: number): Float32Array {
  const o = new Float32Array(dim);
  let n = 0;
  for (let i = 0; i < dim; i++) {
    o[i] = v[i];
    n += v[i] * v[i];
  }
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < dim; i++) o[i] /= n;
  return o;
}
const dot = (a: Float32Array, b: Float32Array) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};
const hasNaN = (v: ArrayLike<number>) => {
  for (let i = 0; i < v.length; i++) if (!Number.isFinite(v[i])) return true;
  return false;
};
function stats(arr: number[]) {
  if (!arr.length) return { n: 0, mean: 0, p50: 0, p95: 0, min: 0, max: 0 };
  const s = [...arr].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, mean: s.reduce((a, b) => a + b, 0) / s.length, p50: q(0.5), p95: q(0.95), min: s[0], max: s[s.length - 1] };
}

// ───────────────────────── 모델 로드 ─────────────────────────
async function loadModel(s: Settings, mods: { vision: boolean; audio: boolean }) {
  const label = ['텍스트', mods.vision && '비전', mods.audio && '오디오'].filter(Boolean).join('+');
  resetCacheStats();
  const files = new Map<string, { loaded: number; total: number }>();
  let last = 0;
  const t0 = performance.now();
  const config: any = await AutoConfig.from_pretrained(MODEL_ID);
  if (!mods.audio) config.audio_config = null;
  if (!mods.vision) config.vision_config = null;
  const dtype: Record<string, Dtype> = { model: s.textDtype };
  if (mods.vision) dtype.vision_encoder = s.visionDtype;
  if (mods.audio) dtype.audio_encoder = s.audioDtype;
  const model = await AutoModel.from_pretrained(MODEL_ID, {
    config,
    device: s.device,
    dtype,
    progress_callback: (p: any) => {
      if (p.status !== 'progress' || !p.file) return;
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
      const now = performance.now();
      if (now - last < 200) return;
      last = now;
      let l = 0;
      let t = 0;
      files.forEach((f) => ((l += f.loaded), (t += f.total)));
      setStage(`${label} 모델 로드: ${fmtMB(l)} / ${fmtMB(t)}`, t ? (l / t) * 100 : 0);
    },
  } as any);
  const ms = performance.now() - t0;
  const r = {
    label,
    ms,
    downloadedBytes: cacheStats.putBytes,
    cacheHitBytes: cacheStats.hitBytes,
    cacheBackend: s.cacheBackend === 'opfs' ? cacheStats.backend : 'cache-api(transformers)',
    cacheWriteMs: cacheStats.writeMs,
    fromCache: cacheStats.putBytes === 0 && cacheStats.hitBytes > 0,
  };
  log(`${label} 로드 ${fmtMs(ms)} · 다운로드 ${fmtMB(r.downloadedBytes)} · 캐시 적중 ${fmtMB(r.cacheHitBytes)} (${r.cacheBackend})`);
  return { model, info: r };
}

// ───────────────────────── 임베딩 ─────────────────────────
async function embedText(q: string): Promise<Float32Array> {
  const inputs = await tokenizer([QUERY_PREFIX + q], { padding: true, truncation: true });
  const out = await searchModel(inputs);
  return normalizeTrunc(toRows(out.sentence_embedding)[0], settings!.dim);
}

/** 음성 파형 → 벡터. raw: 접두사 없이 오디오만 (공식 권장) / interleaved: 검색 접두사 + <|audio|> */
async function embedAudio(audio: Float32Array, variant: 'raw' | 'interleaved' = 'raw'): Promise<Float32Array> {
  const inputs =
    variant === 'raw'
      ? await processor(null, null, audio)
      : await processor([`${QUERY_PREFIX}<|audio|>`], null, [audio]);
  const out = await searchModel(inputs);
  return normalizeTrunc(toRows(out.sentence_embedding)[0], settings!.dim);
}

function topK(q: Float32Array, k = TOPK) {
  const scored = index.map((it) => ({ it, score: dot(q, it.vec) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

// ───────────────────────── ④ 측정 실행 ─────────────────────────
async function loadSearchModel(s: Settings) {
  voiceDecision = precheckVoice(envInfo, s.voiceMode);
  log(`음성 모드 사전 판정: ${voiceDecision.mode} (${voiceDecision.reason})`);
  if (voiceDecision.mode === 'audio-direct') {
    try {
      const { model, info } = await loadModel(s, { vision: false, audio: true });
      searchModel = model;
      searchHasAudio = true;
      // 실행 판정: 1초 무음으로 오디오 경로 1회 검증 (셰이더 워밍업 겸용)
      const w0 = performance.now();
      await embedAudio(new Float32Array(16000));
      const audioWarmupMs = performance.now() - w0;
      log(`오디오 워밍업 ${fmtMs(audioWarmupMs)}`);
      return { load: info, audioWarmupMs };
    } catch (e: any) {
      log(`⚠️ 오디오 인코더 실패 → STT 폴백: ${e?.message ?? e}`);
      voiceDecision = { mode: 'stt-fallback', stage: searchModel ? 'runtime' : 'load', reason: String(e?.message ?? e).slice(0, 200) };
      try {
        await searchModel?.dispose();
      } catch {
        /* 무시 */
      }
      searchModel = null;
      searchHasAudio = false;
    }
  }
  const { model, info } = await loadModel(s, { vision: false, audio: false });
  searchModel = model;
  searchHasAudio = false;
  return { load: info, audioWarmupMs: null };
}

async function run() {
  const s = readSettings();
  settings = s;
  applyCache(s);
  const runBtn = $('runBtn') as HTMLButtonElement;
  runBtn.disabled = true;
  ($('saveBtn') as HTMLButtonElement).disabled = true;
  ($('dlBtn') as HTMLButtonElement).disabled = true;
  setSearchEnabled(false);
  index.forEach((i) => URL.revokeObjectURL(i.thumb));
  index = [];
  searchLogs.length = 0;
  textVecs.clear();
  logEl.textContent = '';

  let wakeLock: any = null;
  try {
    wakeLock = await (navigator as any).wakeLock?.request('screen');
  } catch {
    /* 무시 */
  }

  const persisted = s.cacheBackend === 'opfs' ? await requestPersist() : null;
  const heap: Record<string, number | null> = { start: jsHeap() };
  const targets = sources.slice(0, s.maxPhotos);
  log(`설정: ${JSON.stringify(s)}`);
  log(`대상 ${targets.length}장 (${sourceKind}) · OPFS 영구 저장 승인: ${persisted}`);

  const r: Record<string, any> = {
    label: `${envInfo.mobile ? 'mobile' : 'pc'}_${s.device}_t${s.textDtype}-v${s.visionDtype}-a${s.audioDtype}_b${s.budget}_n${targets.length}`,
    createdAt: new Date().toISOString(),
    model: MODEL_ID,
    env: envInfo,
    settings: s,
    source: { kind: sourceKind, count: targets.length, bytes: targets.reduce((a, t) => a + t.size, 0) },
    storage: { persistRequested: persisted, before: await storageInfo() },
  };

  try {
    const totalT0 = performance.now();
    const { model, info: visionLoad } = await loadModel(s, { vision: true, audio: false });
    heap.afterVisionLoad = jsHeap();
    processor = await AutoProcessor.from_pretrained(MODEL_ID);
    processor.image_processor.max_soft_tokens = s.budget;
    tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);

    setStage('워밍업 추론 중…');
    const warmImg = new RawImage(new Uint8ClampedArray(64 * 64 * 3).fill(128), 64, 64, 3);
    const w0 = performance.now();
    await model(await processor(null, [[warmImg]]));
    const warmupMs = performance.now() - w0;
    log(`비전 워밍업 ${fmtMs(warmupMs)}`);

    const decodeTimes: number[] = [];
    const perImageInfer: number[] = [];
    const failed: { name: string; error: string }[] = [];
    let nanCount = 0;
    const indexT0 = performance.now();

    for (let i = 0; i < targets.length; i += s.batch) {
      const chunk = targets.slice(i, i + s.batch);
      const decoded: { name: string; image: any; thumb: string }[] = [];
      for (const src of chunk) {
        const d0 = performance.now();
        try {
          const d = await decodePhoto(await src.load(), decodeSideFor(s.budget));
          decoded.push({ name: src.name, ...d });
          decodeTimes.push(performance.now() - d0);
        } catch (e) {
          failed.push({ name: src.name, error: String(e) });
          log(`  디코딩 실패(건너뜀): ${src.name} — ${e}`);
        }
      }
      if (!decoded.length) continue;
      const b0 = performance.now();
      const out = await model(await processor(null, decoded.map((d) => [d.image])));
      const rows = toRows(out.sentence_embedding);
      const bms = performance.now() - b0;
      for (let k = 0; k < decoded.length; k++) perImageInfer.push(bms / decoded.length);
      rows.forEach((row, k) => {
        if (hasNaN(row)) nanCount++;
        index.push({ name: decoded[k].name, thumb: decoded[k].thumb, vec: normalizeTrunc(row, s.dim) });
      });
      const done = Math.min(i + s.batch, targets.length);
      const elapsed = performance.now() - indexT0;
      setStage(`색인 ${done}/${targets.length} · 경과 ${fmtMs(elapsed)} · 남은 시간 약 ${fmtMs((elapsed / done) * (targets.length - done))}`, (done / targets.length) * 100);
    }
    const indexMs = performance.now() - indexT0;
    heap.afterIndexing = jsHeap();
    log(`색인 완료: ${index.length}장 / ${fmtMs(indexMs)} (실패 ${failed.length}, NaN ${nanCount})`);

    setStage('비전 모델 해제 중…');
    const u0 = performance.now();
    await model.dispose();
    const disposeMs = performance.now() - u0;
    heap.afterDispose = jsHeap();

    const search = await loadSearchModel(s);
    heap.afterSearchLoad = jsHeap();
    const tw0 = performance.now();
    await embedText('워밍업');
    const textWarmupMs = performance.now() - tw0;

    const ds = stats(decodeTimes);
    const is = stats(perImageInfer);
    r.timings = {
      visionLoad,
      warmupMs,
      indexTotalMs: indexMs,
      perImageTotalMs: indexMs / Math.max(1, index.length),
      decodePerImage: ds,
      inferPerImage: is,
      disposeMs,
      searchLoad: search.load,
      audioWarmupMs: search.audioWarmupMs,
      textWarmupMs,
      endToEndMs: performance.now() - totalT0,
    };
    r.voiceDecision = voiceDecision;
    r.result = { indexed: index.length, failed, nanCount, vectorBytes: index.length * s.dim * 4 };
    r.jsHeap = heap;
    r.storage.after = await storageInfo();
    report = r;

    renderStats(r);
    setStage(`✅ 완료 — ${index.length}장 색인 ${fmtMs(indexMs)} (장당 ${fmtMs(indexMs / Math.max(1, index.length))})`, 100);
    setSearchEnabled(true);
    await saveReport(true);
  } catch (e: any) {
    log(`❌ 오류: ${e?.stack ?? e}`);
    setStage(`❌ 오류: ${e?.message ?? e}`);
    r.error = String(e?.stack ?? e);
    r.jsHeap = heap;
    report = r;
    await saveReport(true);
  } finally {
    runBtn.disabled = false;
    ($('saveBtn') as HTMLButtonElement).disabled = !report;
    ($('dlBtn') as HTMLButtonElement).disabled = !report;
    try {
      await wakeLock?.release();
    } catch {
      /* 무시 */
    }
  }
}

function renderStats(r: Record<string, any>) {
  const t = r.timings;
  const res = r.result;
  const vd = r.voiceDecision as VoiceDecision;
  const loadStr = (l: any) => `${fmtMs(l.ms)} · ${l.fromCache ? `캐시(${l.cacheBackend}) ${fmtMB(l.cacheHitBytes)}` : `다운로드 ${fmtMB(l.downloadedBytes)}`}`;
  const rows: [string, string, string?][] = [
    ['색인 장수', `${res.indexed}장 (실패 ${res.failed.length})`],
    ['300장 기준 환산', fmtMs(t.perImageTotalMs * 300), t.perImageTotalMs * 300 > 120000 ? 'warn' : 'good'],
    ['색인 총 시간', fmtMs(t.indexTotalMs)],
    ['장당 전체 (디코딩+추론)', fmtMs(t.perImageTotalMs)],
    ['장당 디코딩 p50 / p95', `${fmtMs(t.decodePerImage.p50)} / ${fmtMs(t.decodePerImage.p95)}`],
    ['장당 추론 p50 / p95', `${fmtMs(t.inferPerImage.p50)} / ${fmtMs(t.inferPerImage.p95)}`],
    ['비전 모델 로드', loadStr(t.visionLoad)],
    ['비전 워밍업', fmtMs(t.warmupMs)],
    ['비전 해제', fmtMs(t.disposeMs)],
    ['음성 모드', `${vd.mode === 'audio-direct' ? '🎙️ 오디오 직접' : '⌨️ STT 폴백'} (${vd.stage}: ${vd.reason})`, vd.mode === 'audio-direct' ? 'good' : 'warn'],
    [`검색 모델 로드 (${t.searchLoad.label})`, loadStr(t.searchLoad)],
    ['오디오 워밍업', t.audioWarmupMs == null ? '-' : fmtMs(t.audioWarmupMs)],
    ['NaN 벡터', String(res.nanCount), res.nanCount ? 'bad' : 'good'],
    ['벡터 메모리', `${fmtMB(res.vectorBytes)} (${r.settings.dim}차원)`],
  ];
  const h = r.jsHeap;
  if (h.start != null) {
    rows.push(['JS 힙 (시작→비전→색인→해제→검색모델)', [h.start, h.afterVisionLoad, h.afterIndexing, h.afterDispose, h.afterSearchLoad].map((x) => (x == null ? '-' : fmtMB(x))).join(' → ')]);
  }
  renderKV($('statsBox'), rows);
  $('voiceModeInfo').textContent = vd.mode === 'audio-direct' ? '오디오 인코더로 음성 직접 검색 (STT 없음)' : 'STT(Web Speech) 폴백 모드';
}

// ───────────────────────── ⑤ 검색 ─────────────────────────
function renderResults(info: string, top: { it: Indexed; score: number }[]) {
  $('searchInfo').textContent = info;
  $('results').innerHTML = top
    .map((t) => `<div class="res"><img src="${t.it.thumb}"/><span><b>${t.score.toFixed(3)}</b> ${escapeHtml(t.it.name)}</span></div>`)
    .join('');
}

async function searchText(q: string, render = true, presetId?: string): Promise<SearchLog | null> {
  q = q.trim();
  if (!q || !searchModel) return null;
  const e0 = performance.now();
  const qv = await embedText(q);
  const embedMs = performance.now() - e0;
  if (presetId) textVecs.set(presetId, qv);
  const s0 = performance.now();
  const top = topK(qv);
  const searchMs = performance.now() - s0;
  const entry: SearchLog = { kind: 'text', query: q, presetId, embedMs, searchMs, top: top.map((t) => ({ name: t.it.name, score: +t.score.toFixed(4) })) };
  searchLogs.push(entry);
  if (render) renderResults(`⌨️ "${q}" · 질의 임베딩 ${embedMs.toFixed(1)}ms · 검색(${index.length}장) ${searchMs.toFixed(2)}ms`, top);
  return entry;
}

async function searchAudio(audio: Float32Array, label: string, render = true, variant: 'raw' | 'interleaved' = 'raw') {
  const e0 = performance.now();
  const qv = await embedAudio(audio, variant);
  const embedMs = performance.now() - e0;
  const s0 = performance.now();
  const top = topK(qv);
  const searchMs = performance.now() - s0;
  if (render) renderResults(`🎙️ ${label} · 음성 ${(audio.length / 16000).toFixed(1)}초 · 오디오 임베딩 ${embedMs.toFixed(1)}ms · 검색 ${searchMs.toFixed(2)}ms`, top);
  return { qv, top, embedMs, searchMs };
}

function renderPresets() {
  $('presets').innerHTML = (PRESETS as Preset[])
    .map((p, i) => `<span class="chip ${p.lang === 'en' ? 'en' : ''}" data-i="${i}">${escapeHtml(p.q)}</span>`)
    .join('');
  $('presets').addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest('.chip') as HTMLElement | null;
    if (!el || ($('query') as HTMLInputElement).disabled) return;
    const p = (PRESETS as Preset[])[Number(el.dataset.i)];
    ($('query') as HTMLInputElement).value = p.q;
    void searchText(p.q, true, p.id);
  });
}

async function benchText() {
  const btn = $('benchBtn') as HTMLButtonElement;
  btn.disabled = true;
  const logs: SearchLog[] = [];
  const list = PRESETS as Preset[];
  for (let i = 0; i < list.length; i++) {
    setStage(`텍스트 질의 측정 ${i + 1}/${list.length}`, ((i + 1) / list.length) * 100);
    const e = await searchText(list[i].q, false, list[i].id);
    if (e) logs.push({ ...e, lang: list[i].lang });
  }
  const em = stats(logs.map((l) => l.embedMs));
  const sm = stats(logs.map((l) => l.searchMs));
  if (report) report.textBench = { embedMs: em, searchMs: sm, count: logs.length };
  $('searchInfo').textContent = `텍스트 ${logs.length}건 · 임베딩 p50 ${em.p50.toFixed(1)}ms / p95 ${em.p95.toFixed(1)}ms · 검색 p50 ${sm.p50.toFixed(2)}ms`;
  setStage('✅ 텍스트 질의 측정 완료', 100);
  btn.disabled = false;
  await saveReport(true);
}

/**
 * 음성 직접 검색 정확도 (정답 라벨 없이 측정 가능한 지표)
 *  - concept@1   : 음성 벡터와 가장 가까운 텍스트 질의 벡터(28개 중)가 같은 개념(같은 문장 또는 한/영 짝)인가
 *  - exact@1     : 가장 가까운 텍스트 질의가 정확히 같은 문장인가
 *  - cosToText   : 같은 문장의 음성 벡터와 텍스트 벡터의 코사인 유사도
 *  - overlap@12  : 음성 검색 상위 12장과 텍스트 검색 상위 12장의 겹치는 비율
 */
async function benchAudio() {
  if (!searchHasAudio) {
    $('searchInfo').textContent = 'STT 폴백 모드라 오디오 직접 검색을 측정할 수 없음 (음성 모드 강제 설정 확인)';
    return;
  }
  const btn = $('audioBenchBtn') as HTMLButtonElement;
  btn.disabled = true;
  const list = PRESETS as Preset[];
  // 텍스트 기준 벡터 확보
  for (const p of list) if (!textVecs.has(p.id)) await searchText(p.q, false, p.id);
  const textTop = new Map<string, Set<string>>();
  for (const p of list) textTop.set(p.id, new Set(topK(textVecs.get(p.id)!).map((t) => t.it.name)));
  const concept = (id: string) => id.replace(/_(ko|en)$/, '');

  const audioList: string[] = (await (await fetch('/__poc/audio/list')).json()).files;
  const variants: ('raw' | 'interleaved')[] = ['raw', 'interleaved'];
  const rows: any[] = [];
  const variantErrors: Record<string, string> = {};

  for (const variant of variants) {
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!audioList.includes(`${p.id}.wav`)) continue;
      setStage(`음성 직접 검색(${variant}) ${i + 1}/${list.length}`, ((i + 1) / list.length) * 100);
      try {
        const d0 = performance.now();
        const audio: Float32Array = await load_audio(`/__poc/audio/file?f=${encodeURIComponent(p.id)}.wav`, 16000);
        const decodeMs = performance.now() - d0;
        const { qv, top, embedMs, searchMs } = await searchAudio(audio, p.q, false, variant);
        const sims = list.map((t) => ({ id: t.id, s: dot(qv, textVecs.get(t.id)!) })).sort((a, b) => b.s - a.s);
        const tt = textTop.get(p.id)!;
        const row = {
          variant,
          id: p.id,
          lang: p.lang,
          query: p.q,
          audioSec: +(audio.length / 16000).toFixed(2),
          decodeMs,
          embedMs,
          searchMs,
          cosToText: +dot(qv, textVecs.get(p.id)!).toFixed(4),
          nearestText: sims[0].id,
          exact1: sims[0].id === p.id,
          concept1: concept(sims[0].id) === concept(p.id),
          overlap12: top.filter((t) => tt.has(t.it.name)).length / TOPK,
          top3: top.slice(0, 3).map((t) => ({ name: t.it.name, score: +t.score.toFixed(4) })),
        };
        rows.push(row);
        searchLogs.push({ kind: variant === 'raw' ? 'audio' : 'audio-interleaved', query: p.q, presetId: p.id, lang: p.lang, embedMs, searchMs, decodeMs, audioSec: row.audioSec, top: top.map((t) => ({ name: t.it.name, score: +t.score.toFixed(4) })) });
        log(`  🎙️[${variant}] ${p.id} ${embedMs.toFixed(0)}ms cos=${row.cosToText} 최근접=${row.nearestText} 겹침=${(row.overlap12 * 100).toFixed(0)}%`);
      } catch (e: any) {
        variantErrors[variant] = String(e?.message ?? e).slice(0, 300);
        log(`  ⚠️ 음성(${variant}) 실패: ${variantErrors[variant]}`);
        break; // 이 변형은 지원되지 않음
      }
    }
  }

  const summarize = (sel: any[]) => ({
    n: sel.length,
    exact1: sel.filter((r) => r.exact1).length / Math.max(1, sel.length),
    concept1: sel.filter((r) => r.concept1).length / Math.max(1, sel.length),
    cosToTextMean: sel.reduce((a, r) => a + r.cosToText, 0) / Math.max(1, sel.length),
    overlap12Mean: sel.reduce((a, r) => a + r.overlap12, 0) / Math.max(1, sel.length),
    embedMs: stats(sel.map((r) => r.embedMs)),
    decodeMs: stats(sel.map((r) => r.decodeMs)),
  });
  const summary: Record<string, any> = {};
  for (const v of variants) {
    const sel = rows.filter((r) => r.variant === v);
    summary[v] = { all: summarize(sel), ko: summarize(sel.filter((r) => r.lang === 'ko')), en: summarize(sel.filter((r) => r.lang === 'en')) };
  }
  if (report) report.audioBench = { note: 'TTS 합성 음성(Windows Heami/Zira) 기준', summary, variantErrors, rows };
  const a = summary.raw?.all;
  $('searchInfo').textContent = a?.n
    ? `음성 직접 ${a.n}건 · 오디오 임베딩 p50 ${a.embedMs.p50.toFixed(0)}ms · 같은 개념 적중 ${(a.concept1 * 100).toFixed(0)}% · 텍스트 결과와 겹침 ${(a.overlap12Mean * 100).toFixed(0)}%`
    : `음성 직접 측정 실패: ${JSON.stringify(variantErrors)}`;
  setStage('✅ 음성 직접 검색 측정 완료', 100);
  btn.disabled = false;
  await saveReport(true);
}

// ───────────────────────── 🎙️ 말하고 찾기 (스마트 폴백) ─────────────────────────
const mic = new MicRecorder();
async function onVoice() {
  const btn = $('voiceBtn') as HTMLButtonElement;
  if (voiceDecision?.mode === 'audio-direct' && searchHasAudio) {
    if (!mic.recording) {
      try {
        await mic.start(() => void onVoice());
        btn.classList.add('rec');
        btn.textContent = '⏹ 말하기 끝';
      } catch (e) {
        log(`마이크 사용 불가: ${e}`);
      }
      return;
    }
    btn.classList.remove('rec');
    btn.textContent = '🎙️ 말하고 찾기';
    const blob = await mic.stop();
    const url = URL.createObjectURL(blob);
    try {
      const d0 = performance.now();
      const audio: Float32Array = await load_audio(url, 16000);
      const decodeMs = performance.now() - d0;
      const r = await searchAudio(audio, '녹음 음성');
      searchLogs.push({ kind: 'audio', query: '(마이크 녹음)', embedMs: r.embedMs, searchMs: r.searchMs, decodeMs, audioSec: audio.length / 16000, top: r.top.map((t) => ({ name: t.it.name, score: +t.score.toFixed(4) })) });
    } catch (e: any) {
      // 실행 판정: 오디오 추론 실패 → 이번 세션은 STT로 폴백
      log(`⚠️ 오디오 추론 실패 → STT 폴백 전환: ${e?.message ?? e}`);
      voiceDecision = { mode: 'stt-fallback', stage: 'runtime', reason: String(e?.message ?? e).slice(0, 200) };
      $('voiceModeInfo').textContent = 'STT(Web Speech) 폴백 모드 (오디오 실행 오류)';
    } finally {
      URL.revokeObjectURL(url);
    }
    return;
  }
  // STT 폴백
  try {
    btn.classList.add('rec');
    const t0 = performance.now();
    const txt = await recognizeOnce('ko-KR', (t) => (($('query') as HTMLInputElement).value = t));
    log(`STT 인식 ${fmtMs(performance.now() - t0)}: "${txt}"`);
    if (txt) {
      const e = await searchText(txt);
      if (e) e.kind = 'stt';
    }
  } catch (e) {
    log(`STT 오류: ${e}`);
  } finally {
    btn.classList.remove('rec');
  }
}

function setSearchEnabled(on: boolean) {
  for (const id of ['query', 'searchBtn', 'benchBtn', 'voiceBtn']) ($(id) as HTMLButtonElement).disabled = !on;
  ($('audioBenchBtn') as HTMLButtonElement).disabled = !on || !searchHasAudio;
}

// ───────────────────────── 리포트 ─────────────────────────
const fullReport = () => ({ ...report, voiceDecisionFinal: voiceDecision, searches: searchLogs });
async function saveReport(silent = false) {
  if (!report) return;
  try {
    const j = await (
      await fetch('/__poc/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fullReport()) })
    ).json();
    report.savedAs = j.file;
    log(`리포트 저장됨 (PC): poc/${j.file}`);
  } catch (e) {
    if (!silent) alert(`PC 저장 실패: ${e}`);
    log(`리포트 PC 저장 실패: ${e}`);
  }
}
function downloadReport() {
  if (!report) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(fullReport(), null, 2)], { type: 'application/json' }));
  a.download = `saysee-poc_${report.label}.json`;
  a.click();
}

// ───────────────────────── 바인딩 ─────────────────────────
$('runBtn').addEventListener('click', () => void run());
$('searchBtn').addEventListener('click', () => void searchText(($('query') as HTMLInputElement).value));
$('query').addEventListener('keydown', (e) => {
  if ((e as KeyboardEvent).key === 'Enter') void searchText(($('query') as HTMLInputElement).value);
});
$('benchBtn').addEventListener('click', () => void benchText());
$('audioBenchBtn').addEventListener('click', () => void benchAudio());
$('voiceBtn').addEventListener('click', () => void onVoice());
$('saveBtn').addEventListener('click', () => void saveReport());
$('dlBtn').addEventListener('click', downloadReport);
$('clearCacheBtn').addEventListener('click', async () => {
  await clearOpfsCache();
  const st = await storageInfo();
  $('cacheInfo').textContent = `비움 · OPFS 캐시 ${st.opfsFiles}개 · ${fmtMB(st.opfsBytes)}`;
});

renderPresets();

// ───────────────────────── 자동 실행 (헤드리스 벤치마크용) ─────────────────────────
// 예: /?auto=1&max=300&budget=280&cold=1
declare global {
  interface Window {
    __saysee: { done: boolean; error?: string; report?: any };
    __showText: (id: string) => Promise<void>;
    __showAudio: (id: string) => Promise<void>;
  }
}
window.__saysee = { done: false };
window.__showText = async (id) => {
  const p = (PRESETS as Preset[]).find((x) => x.id === id)!;
  await searchText(p.q, true, p.id);
};
window.__showAudio = async (id) => {
  const p = (PRESETS as Preset[]).find((x) => x.id === id)!;
  const audio: Float32Array = await load_audio(`/__poc/audio/file?f=${encodeURIComponent(id)}.wav`, 16000);
  await searchAudio(audio, p.q);
};

async function autoRun() {
  const qs = new URLSearchParams(location.search);
  if (qs.get('auto') !== '1') return;
  const set = (id: string, key: string) => {
    const v = qs.get(key);
    if (v != null) ($(id) as HTMLInputElement).value = v;
  };
  set('maxPhotos', 'max');
  set('budget', 'budget');
  set('batch', 'batch');
  set('textDtype', 'text');
  set('visionDtype', 'vision');
  set('audioDtype', 'audio');
  set('device', 'device');
  set('dim', 'dim');
  set('cacheBackend', 'cache');
  set('voiceMode', 'voice');
  try {
    if (qs.get('cold') === '1') {
      await clearOpfsCache();
      log('콜드 측정: 모델 캐시 비움');
    }
    if (!(await useServerPhotos())) throw new Error('test_photos 없음');
    await run();
    if (!report || report.error) throw new Error(report?.error ?? '측정 실패');
    if (qs.get('indexonly') !== '1') {
      await benchText();
      await benchAudio();
    }
    window.__saysee = { done: true, report: fullReport() };
  } catch (e: any) {
    window.__saysee = { done: true, error: String(e?.stack ?? e), report: report ? fullReport() : undefined };
  }
}

void detectEnv().then(autoRun);
