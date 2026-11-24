/**
 * [전용 Web Worker] 온디바이스 YuNet(232KB) 얼굴 검출 + SFace int8(9.4MB) 128D 딥러닝 얼굴 인식 워커
 * - 메인 스레드 UI 프리징 0ms 보장
 * - /models/face/face_detection_yunet_2023mar.onnx (OpenCV Zoo Apache-2.0)
 * - /models/face/face_recognition_sface_2021dec_int8.onnx (OpenCV Zoo Apache-2.0)
 * - 스캔 종료 시 dispose로 두 ONNX 세션 RAM 즉시 반환
 */
import * as ort from 'onnxruntime-web/webgpu';

export interface WorkerDetectedFace {
  score: number;
  frontalScore: number;
  /** 0..1 normalized in original image coordinates */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** 5 facial landmarks in 0..1 normalized original image coordinates: [reX,reY, leX,leY, noseX,noseY, rmX,rmY, lmX,lmY] */
  landmarks?: [number, number, number, number, number, number, number, number, number, number];
}

interface DetectRequest {
  id: number;
  type: 'detect';
  bgrBuffer: ArrayBuffer;
  origW: number;
  origH: number;
  scale: number;
  scoreThreshold?: number;
}

interface EmbedRequest {
  id: number;
  type: 'embed';
  /** 112x112 BGR Float32Array (0..255, NCHW) */
  faceBgrBuffer: ArrayBuffer;
}

interface DisposeRequest {
  id: number;
  type: 'dispose';
}

type WorkerRequest = DetectRequest | EmbedRequest | DisposeRequest;

let yunetSession: ort.InferenceSession | null = null;
let yunetPromise: Promise<ort.InferenceSession> | null = null;
let sfaceSession: ort.InferenceSession | null = null;
let sfacePromise: Promise<ort.InferenceSession> | null = null;

function configureOrtWasmOnce(): void {
  try {
    ort.env.wasm.simd = true;
    if (ort.env.wasm.wasmPaths && typeof ort.env.wasm.wasmPaths === 'object') {
      const wp = ort.env.wasm.wasmPaths as { wasm?: string };
      if (typeof wp.wasm === 'string' && wp.wasm.includes('cdn.jsdelivr.net')) {
        ort.env.wasm.wasmPaths = undefined;
      }
    }
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
  } catch {
    /* ignore env hints */
  }
}

const FACE_MODEL_CACHE_NAME = 'ghosti-face-models-v1';
const YUNET_LOCAL_PATH = '/models/face/face_detection_yunet_2023mar.onnx';
const YUNET_CDN_FALLBACK =
  'https://raw.githubusercontent.com/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx';
const SFACE_LOCAL_PATH = '/models/face/face_recognition_sface_2021dec_int8.onnx';
const SFACE_CDN_FALLBACK =
  'https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_recognition_sface/face_recognition_sface_2021dec_int8.onnx';

async function fetchModelBytesWithFallback(localPath: string, cdnUrl: string): Promise<Uint8Array> {
  const localUrl = new URL(localPath, self.location.origin).href;
  // 1순위: 로컬/앱 내장 모델 (/models/face/*)
  try {
    const localResp = await fetch(localUrl);
    if (localResp.ok) {
      const buf = await localResp.arrayBuffer();
      if (buf.byteLength > 10_000) return new Uint8Array(buf);
    }
  } catch {
    /* fall through to cache/CDN */
  }

  // 2순위: 브라우저 Cache API 영구 캐시
  const hasCacheApi = typeof caches !== 'undefined';
  if (hasCacheApi) {
    try {
      const cache = await caches.open(FACE_MODEL_CACHE_NAME);
      const cached = await cache.match(cdnUrl);
      if (cached && cached.ok) {
        const buf = await cached.arrayBuffer();
        if (buf.byteLength > 10_000) return new Uint8Array(buf);
      }
    } catch {
      /* ignore cache read error */
    }
  }

  // 3순위: 무료 CDN 폴백 다운로드 후 영구 캐시 저장
  const cdnResp = await fetch(cdnUrl);
  if (!cdnResp.ok) {
    throw new Error(`Face model fetch failed (${localPath} & CDN HTTP ${cdnResp.status})`);
  }
  const buf = await cdnResp.arrayBuffer();
  if (buf.byteLength <= 10_000) {
    throw new Error(`Face model payload too small (${buf.byteLength} bytes)`);
  }
  if (hasCacheApi) {
    try {
      const cache = await caches.open(FACE_MODEL_CACHE_NAME);
      await cache.put(
        cdnUrl,
        new Response(buf.slice(0), { headers: { 'Content-Type': 'application/octet-stream' } })
      );
    } catch {
      /* ignore cache write error */
    }
  }
  return new Uint8Array(buf);
}

async function ensureYuNet(): Promise<ort.InferenceSession> {
  if (yunetSession) return yunetSession;
  if (yunetPromise) return yunetPromise;

  yunetPromise = (async () => {
    configureOrtWasmOnce();
    const modelBytes = await fetchModelBytesWithFallback(YUNET_LOCAL_PATH, YUNET_CDN_FALLBACK);
    const created = await ort.InferenceSession.create(modelBytes, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    yunetSession = created;
    return created;
  })().catch((err) => {
    yunetPromise = null;
    throw err;
  });

  return yunetPromise;
}

async function ensureSFace(): Promise<ort.InferenceSession> {
  if (sfaceSession) return sfaceSession;
  if (sfacePromise) return sfacePromise;

  sfacePromise = (async () => {
    configureOrtWasmOnce();
    const modelBytes = await fetchModelBytesWithFallback(SFACE_LOCAL_PATH, SFACE_CDN_FALLBACK);
    const created = await ort.InferenceSession.create(modelBytes, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    sfaceSession = created;
    return created;
  })().catch((err) => {
    sfacePromise = null;
    throw err;
  });

  return sfacePromise;
}

function decodeYuNetOutputs(
  outputs: ort.InferenceSession.OnnxValueMapType,
  origW: number,
  origH: number,
  scale: number,
  scoreThreshold: number
): WorkerDetectedFace[] {
  const strides = [8, 16, 32] as const;
  const rawFaces: WorkerDetectedFace[] = [];

  for (const stride of strides) {
    const cls = outputs[`cls_${stride}`]?.data as Float32Array | undefined;
    const obj = outputs[`obj_${stride}`]?.data as Float32Array | undefined;
    const bbox = outputs[`bbox_${stride}`]?.data as Float32Array | undefined;
    const kps = outputs[`kps_${stride}`]?.data as Float32Array | undefined;
    if (!cls || !obj || !bbox || !kps) continue;

    const cols = 640 / stride;
    const count = cls.length;
    for (let i = 0; i < count; i++) {
      const cVal = cls[i] < 0 ? 0 : cls[i] > 1 ? 1 : cls[i];
      const oVal = obj[i] < 0 ? 0 : obj[i] > 1 ? 1 : obj[i];
      const score = Math.sqrt(cVal * oVal);
      if (score < scoreThreshold) continue;

      const row = Math.floor(i / cols);
      const col = i % cols;
      const bOff = i * 4;
      const cx = (col + bbox[bOff]) * stride;
      const cy = (row + bbox[bOff + 1]) * stride;
      const w = Math.exp(bbox[bOff + 2]) * stride;
      const h = Math.exp(bbox[bOff + 3]) * stride;

      const x1Px = Math.max(0, (cx - w * 0.5) / scale);
      const y1Px = Math.max(0, (cy - h * 0.5) / scale);
      const x2Px = Math.min(origW, (cx + w * 0.5) / scale);
      const y2Px = Math.min(origH, (cy + h * 0.5) / scale);
      const bw = (x2Px - x1Px) / Math.max(1, origW);
      const bh = (y2Px - y1Px) / Math.max(1, origH);
      if (bw < 0.035 || bh < 0.035) continue;

      const kOff = i * 10;
      const reX = (col + kps[kOff]) * stride;
      const reY = (row + kps[kOff + 1]) * stride;
      const leX = (col + kps[kOff + 2]) * stride;
      const leY = (row + kps[kOff + 3]) * stride;
      const noseX = (col + kps[kOff + 4]) * stride;
      const noseY = (row + kps[kOff + 5]) * stride;
      const rmX = (col + kps[kOff + 6]) * stride;
      const rmY = (row + kps[kOff + 7]) * stride;
      const lmX = (col + kps[kOff + 8]) * stride;
      const lmY = (row + kps[kOff + 9]) * stride;

      // 랜드마크 해부학적 기하 검증 (카툰·캐릭터·사물 오탐 차단)
      const boxH = Math.max(8, h);
      const boxW = Math.max(8, w);
      const eyeMid = (reX + leX) * 0.5;
      const eyeMidY = (reY + leY) * 0.5;
      const mouthMidY = (rmY + lmY) * 0.5;
      const eyeSpan = Math.abs(leX - reX);
      const mouthSpan = Math.abs(lmX - rmX);
      // 1) 오른쪽 눈(이미지상 좌측)은 왼쪽 눈(이미지상 우측)보다 좌측에 위치하고 적절한 간격을 유지해야 함
      if (leX <= reX || eyeSpan < boxW * 0.16 || eyeSpan > boxW * 0.82) continue;
      // 2) 눈 기울기(roll)가 과도하게 뒤틀린 비정상 오탐 배제
      if (Math.abs(leY - reY) > eyeSpan * 0.65) continue;
      // 3) 눈 → 코 → 입 수직 순서 및 최소 간격 검증
      if (noseY <= eyeMidY + boxH * 0.04 || mouthMidY <= noseY + boxH * 0.04) continue;
      if (mouthSpan < boxW * 0.1 || mouthSpan > boxW * 0.85) continue;

      const yawAsym = Math.min(1, Math.abs(noseX - eyeMid) / (Math.max(4, eyeSpan) * 0.75));
      const frontalScore = Math.max(0.45, Math.min(0.99, +(score * (1 - yawAsym * 0.35)).toFixed(3)));

      const invW = 1 / Math.max(1, origW * scale);
      const invH = 1 / Math.max(1, origH * scale);
      rawFaces.push({
        score: +score.toFixed(3),
        frontalScore,
        x1: x1Px / Math.max(1, origW),
        y1: y1Px / Math.max(1, origH),
        x2: x2Px / Math.max(1, origW),
        y2: y2Px / Math.max(1, origH),
        landmarks: [
          Math.max(0, Math.min(1, reX * invW)),
          Math.max(0, Math.min(1, reY * invH)),
          Math.max(0, Math.min(1, leX * invW)),
          Math.max(0, Math.min(1, leY * invH)),
          Math.max(0, Math.min(1, noseX * invW)),
          Math.max(0, Math.min(1, noseY * invH)),
          Math.max(0, Math.min(1, rmX * invW)),
          Math.max(0, Math.min(1, rmY * invH)),
          Math.max(0, Math.min(1, lmX * invW)),
          Math.max(0, Math.min(1, lmY * invH)),
        ],
      });
    }
  }

  rawFaces.sort((a, b) => b.score - a.score);
  const kept: WorkerDetectedFace[] = [];
  for (const f of rawFaces) {
    let dup = false;
    for (const k of kept) {
      const ix1 = Math.max(f.x1, k.x1);
      const iy1 = Math.max(f.y1, k.y1);
      const ix2 = Math.min(f.x2, k.x2);
      const iy2 = Math.min(f.y2, k.y2);
      const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
      const areaA = (f.x2 - f.x1) * (f.y2 - f.y1);
      const areaB = (k.x2 - k.x1) * (k.y2 - k.y1);
      const union = areaA + areaB - inter;
      if (union > 0 && inter / union > 0.35) {
        dup = true;
        break;
      }
    }
    if (!dup) kept.push(f);
    if (kept.length >= 6) break;
  }
  return kept;
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  if (!msg) return;

  if (msg.type === 'dispose') {
    try {
      await yunetSession?.release?.();
    } catch {
      /* ignore */
    }
    try {
      await sfaceSession?.release?.();
    } catch {
      /* ignore */
    }
    yunetSession = null;
    yunetPromise = null;
    sfaceSession = null;
    sfacePromise = null;
    self.postMessage({ id: msg.id, ok: true });
    return;
  }

  if (msg.type === 'detect') {
    try {
      const s = await ensureYuNet();
      const bgr = new Float32Array(msg.bgrBuffer);
      const inputTensor = new ort.Tensor('float32', bgr, [1, 3, 640, 640]);
      const outputs = await s.run({ input: inputTensor });
      const faces = decodeYuNetOutputs(
        outputs,
        msg.origW,
        msg.origH,
        msg.scale,
        msg.scoreThreshold ?? 0.82
      );
      self.postMessage({ id: msg.id, ok: true, faces });
    } catch (err) {
      self.postMessage({
        id: msg.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        faces: [],
      });
    }
    return;
  }

  if (msg.type === 'embed') {
    try {
      const s = await ensureSFace();
      const bgr = new Float32Array(msg.faceBgrBuffer);
      const inputTensor = new ort.Tensor('float32', bgr, [1, 3, 112, 112]);
      const outputs = await s.run({ data: inputTensor });
      const raw = outputs.fc1?.data as Float32Array | undefined;
      if (!raw || raw.length === 0) {
        self.postMessage({ id: msg.id, ok: false, error: 'SFace empty output' });
        return;
      }
      const vec = new Float32Array(raw.length);
      let norm = 0;
      for (let i = 0; i < raw.length; i++) norm += raw[i] * raw[i];
      norm = Math.sqrt(norm) + 1e-6;
      for (let i = 0; i < raw.length; i++) vec[i] = raw[i] / norm;
      (self as unknown as { postMessage: (m: unknown, transfer?: Transferable[]) => void }).postMessage(
        { id: msg.id, ok: true, embeddingBuffer: vec.buffer },
        [vec.buffer]
      );
    } catch (err) {
      self.postMessage({
        id: msg.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
};
