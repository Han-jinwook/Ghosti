/**
 * ❖ EmbeddingGemma 2 전용 Web Worker (`embeddingAiWorker.ts`)
 * - 수백 MB ONNX 가중치 로딩, WebGPU WGSL 셰이더 컴파일/WASM 초기화 및 텍스트·비전 추론을
 *   브라우저 UI 메인 스레드에서 완전히 격리하여 메인 스레드 블로킹(0ms) 및 크롬 느려짐 경고를 원천 차단합니다.
 * - 입출력 픽셀 버퍼와 768차원 임베딩 벡터는 Transferable(ArrayBuffer)로 무복사(Zero-Copy) 교환합니다.
 */
import {
  AutoConfig,
  AutoModel,
  AutoProcessor,
  AutoTokenizer,
  RawImage,
  env,
} from '@huggingface/transformers';
import { opfsCache } from '../opfsCache';

const MODEL_ID = 'onnx-community/gemma-4-E2B-it-ONNX';
const DEFAULT_DIM = 768;
const VISION_TOKEN_BUDGET = 70;
const PRIMARY_REMOTE_HOST = 'https://huggingface.co/';
const FALLBACK_LOCAL_ZCORE_HOST = 'http://127.0.0.1:5199/__models/';

let textQueryModel: any = null;
let textQueryTokenizer: any = null;
let sharedVisionModel: any = null;
let sharedVisionProcessor: any = null;
let cachedWebGpuOk: boolean | null = null;
let fallbackOrigin = '';
let modelRemoteFallbackMutex: Promise<void> = Promise.resolve();

function enableOpfsCacheInWorker(): void {
  env.allowLocalModels = false;
  env.useBrowserCache = false;
  env.useCustomCache = true;
  env.customCache = opfsCache as any;
}

async function runWithTimeout<T>(task: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_TIMEOUT_${timeoutMs}MS`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function loadWithR2Fallback<T>(loader: () => Promise<T>): Promise<T> {
  const prev = modelRemoteFallbackMutex;
  let release!: () => void;
  modelRemoteFallbackMutex = new Promise<void>((res) => {
    release = res;
  });
  await prev;
  const mirrorHost = fallbackOrigin
    ? `${fallbackOrigin}/api/models-mirror/`
    : 'https://ghosti.sundreamer.app/api/models-mirror/';
  try {
    try {
      env.remoteHost = PRIMARY_REMOTE_HOST;
      return await runWithTimeout(loader(), 45000, 'HF_PRIMARY');
    } catch {
      try {
        env.remoteHost = mirrorHost;
        return await runWithTimeout(loader(), 45000, 'GH_MIRROR');
      } catch {
        try {
          env.remoteHost = FALLBACK_LOCAL_ZCORE_HOST;
          return await runWithTimeout(loader(), 30000, 'ZCORE_LOCAL');
        } catch (localErr) {
          env.remoteHost = PRIMARY_REMOTE_HOST;
          throw localErr;
        }
      }
    }
  } finally {
    env.remoteHost = PRIMARY_REMOTE_HOST;
    release();
  }
}

async function detectUsableWebGpu(isMobile: boolean): Promise<boolean> {
  if (isMobile) return false;
  if (cachedWebGpuOk !== null) return cachedWebGpuOk;
  try {
    const gpu = (self as any)?.navigator?.gpu;
    if (!gpu?.requestAdapter) {
      cachedWebGpuOk = false;
      return false;
    }
    const adapter = await gpu.requestAdapter();
    cachedWebGpuOk = Boolean(adapter);
    return cachedWebGpuOk;
  } catch {
    cachedWebGpuOk = false;
    return false;
  }
}

async function loadModelWithWebGpuToWasmFallback(
  config: any,
  dtypeSpec: any,
  isMobile: boolean
): Promise<any> {
  if (isMobile) {
    try {
      const wasmEnv = (env as any)?.backends?.onnx?.wasm;
      if (wasmEnv) wasmEnv.numThreads = 1;
    } catch {
      /* ignore */
    }
  }
  const canUseGpu = await detectUsableWebGpu(isMobile);
  if (canUseGpu) {
    try {
      return await loadWithR2Fallback(() =>
        AutoModel.from_pretrained(MODEL_ID, {
          config,
          device: 'webgpu',
          dtype: dtypeSpec,
        } as any)
      );
    } catch {
      cachedWebGpuOk = false;
    }
  }
  return await loadWithR2Fallback(() =>
    AutoModel.from_pretrained(MODEL_ID, {
      config,
      device: 'wasm',
      dtype: dtypeSpec,
    } as any)
  );
}

function toRows(t: any): number[][] {
  if (!t) return [];
  const list = typeof t.tolist === 'function' ? t.tolist() : t;
  return Array.isArray(list) && Array.isArray(list[0]) ? list : [list];
}

function normalizeVector(v: ArrayLike<number>, dim = DEFAULT_DIM): Float32Array {
  const out = new Float32Array(dim);
  let sum = 0;
  const n = Math.min(dim, v.length);
  for (let i = 0; i < n; i++) {
    const x = Number(v[i]) || 0;
    out[i] = x;
    sum += x * x;
  }
  const norm = Math.sqrt(sum) || 1;
  for (let i = 0; i < dim; i++) out[i] /= norm;
  return out;
}

async function disposeTextOnlyModel(): Promise<void> {
  if (textQueryModel) {
    const m = textQueryModel;
    textQueryModel = null;
    await Promise.resolve(m.dispose?.()).catch(() => {});
  }
}

async function disposeVisionModel(): Promise<void> {
  if (sharedVisionModel) {
    const m = sharedVisionModel;
    sharedVisionModel = null;
    sharedVisionProcessor = null;
    await Promise.resolve(m.dispose?.()).catch(() => {});
  }
}

async function ensureText(targetDtype: 'q8' | 'q4', isMobile: boolean): Promise<boolean> {
  if (sharedVisionModel && textQueryTokenizer) return true;
  if (textQueryModel && textQueryTokenizer) return true;
  enableOpfsCacheInWorker();
  if (!textQueryTokenizer) {
    textQueryTokenizer = await loadWithR2Fallback(() => AutoTokenizer.from_pretrained(MODEL_ID));
  }
  if (sharedVisionModel) return true;
  const config: any = await loadWithR2Fallback(() => AutoConfig.from_pretrained(MODEL_ID));
  config.vision_config = null;
  config.audio_config = null;
  textQueryModel = await loadModelWithWebGpuToWasmFallback(config, targetDtype, isMobile);
  return true;
}

async function acquireVision(targetDtype: 'q8' | 'q4', isMobile: boolean): Promise<boolean> {
  if (sharedVisionModel && sharedVisionProcessor) return true;
  enableOpfsCacheInWorker();
  // 상위 멀티모달 비전 모델 로드 전 중복 단독 텍스트 세션 즉시 해제 (데스크톱·모바일 공통 RAM 피크 절감)
  await disposeTextOnlyModel();
  if (!textQueryTokenizer) {
    textQueryTokenizer = await loadWithR2Fallback(() => AutoTokenizer.from_pretrained(MODEL_ID));
  }
  const config: any = await loadWithR2Fallback(() => AutoConfig.from_pretrained(MODEL_ID));
  config.audio_config = null;
  sharedVisionModel = await loadModelWithWebGpuToWasmFallback(
    config,
    { model: targetDtype, vision_encoder: targetDtype },
    isMobile
  );
  sharedVisionProcessor = await loadWithR2Fallback(() => AutoProcessor.from_pretrained(MODEL_ID));
  sharedVisionProcessor.image_processor.max_soft_tokens = VISION_TOKEN_BUDGET;
  return true;
}

let rpcChain: Promise<unknown> = Promise.resolve();

self.onmessage = (ev: MessageEvent) => {
  const msg = ev.data || {};
  const { id, type } = msg;
  if (typeof msg.origin === 'string' && msg.origin.startsWith('http')) {
    fallbackOrigin = msg.origin;
  }

  const exec = async () => {
    try {
      if (type === 'ensureText') {
        const ok = await ensureText(msg.targetDtype || 'q8', Boolean(msg.isMobile));
        (self as any).postMessage({ id, ok, result: ok });
        return;
      }
      if (type === 'acquireVision') {
        const ok = await acquireVision(msg.targetDtype || 'q8', Boolean(msg.isMobile));
        (self as any).postMessage({ id, ok, result: ok });
        return;
      }
      if (type === 'encodeText') {
        const prompts: string[] = Array.isArray(msg.prompts) ? msg.prompts : [];
        if (prompts.length === 0) {
          (self as any).postMessage({ id, ok: true, result: [] });
          return;
        }
        await ensureText(msg.targetDtype || 'q8', Boolean(msg.isMobile));
        const qModel = sharedVisionModel || textQueryModel;
        if (!qModel || !textQueryTokenizer) {
          (self as any).postMessage({ id, ok: true, result: [] });
          return;
        }
        const inputs = await textQueryTokenizer(prompts, { padding: true, truncation: true });
        const out = await qModel(inputs);
        const rows = toRows(out.sentence_embedding);
        const vecs = rows.map((r) => normalizeVector(r, DEFAULT_DIM));
        const transfers = vecs.map((v) => v.buffer);
        (self as any).postMessage({ id, ok: true, result: vecs }, transfers);
        return;
      }
      if (type === 'embedImage') {
        const ok = await acquireVision(msg.targetDtype || 'q8', Boolean(msg.isMobile));
        if (!ok || !sharedVisionModel || !sharedVisionProcessor) {
          (self as any).postMessage({ id, ok: true, result: null });
          return;
        }
        const ch = (Number(msg.channels) || 3) as 1 | 2 | 3 | 4;
        const rawImg = new RawImage(
          new Uint8ClampedArray(msg.rgbaBuffer as ArrayBuffer),
          Number(msg.width),
          Number(msg.height),
          ch
        );
        const inputs = await sharedVisionProcessor(null, [[rawImg]]);
        const out = await sharedVisionModel(inputs);
        const vec = normalizeVector(toRows(out.sentence_embedding)[0], DEFAULT_DIM);
        (self as any).postMessage({ id, ok: true, result: vec }, [vec.buffer]);
        return;
      }
      if (type === 'disposeVision') {
        await disposeVisionModel();
        (self as any).postMessage({ id, ok: true, result: true });
        return;
      }
      if (type === 'disposeAll') {
        await disposeVisionModel();
        await disposeTextOnlyModel();
        (self as any).postMessage({ id, ok: true, result: true });
        return;
      }
      (self as any).postMessage({ id, ok: false, error: `UNKNOWN_RPC_${String(type)}` });
    } catch (err: any) {
      (self as any).postMessage({
        id,
        ok: false,
        error: String(err?.message || err || 'WORKER_ERROR'),
      });
    }
  };

  rpcChain = rpcChain.then(exec, exec);
};
