/**
 * [전용 Web Worker] 온디바이스 YuNet(232KB) 얼굴 검출 워커
 * - 메인 스레드 UI 프리징 0ms 보장
 * - /models/face/face_detection_yunet_2023mar.onnx (OpenCV Zoo Apache-2.0)
 * - 입력: 640x640 letterbox BGR Float32Array (Zero-Copy Transferable)
 * - 출력: 정규화(0..1) 얼굴 박스 + 정면도(frontalScore) + 신뢰도(score)
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

interface DisposeRequest {
  id: number;
  type: 'dispose';
}

type WorkerRequest = DetectRequest | DisposeRequest;

let session: ort.InferenceSession | null = null;
let sessionPromise: Promise<ort.InferenceSession> | null = null;

async function ensureSession(): Promise<ort.InferenceSession> {
  if (session) return session;
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
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
    const modelUrl = new URL('/models/face/face_detection_yunet_2023mar.onnx', self.location.origin).href;
    const resp = await fetch(modelUrl);
    if (!resp.ok) {
      throw new Error(`YuNet model fetch failed: HTTP ${resp.status}`);
    }
    const modelBytes = new Uint8Array(await resp.arrayBuffer());
    const created = await ort.InferenceSession.create(modelBytes, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    session = created;
    return created;
  })().catch((err) => {
    sessionPromise = null;
    throw err;
  });

  return sessionPromise;
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

      // 5점 랜드마크(오른눈, 왼눈, 코, 입우, 입좌)로 정면도(frontalScore) 계산
      const kOff = i * 10;
      const reX = (col + kps[kOff]) * stride;
      const leX = (col + kps[kOff + 2]) * stride;
      const noseX = (col + kps[kOff + 4]) * stride;
      const eyeMid = (reX + leX) * 0.5;
      const eyeSpan = Math.max(4, Math.abs(leX - reX));
      const yawAsym = Math.min(1, Math.abs(noseX - eyeMid) / (eyeSpan * 0.75));
      const frontalScore = Math.max(0.45, Math.min(0.99, +(score * (1 - yawAsym * 0.35)).toFixed(3)));

      rawFaces.push({
        score: +score.toFixed(3),
        frontalScore,
        x1: x1Px / Math.max(1, origW),
        y1: y1Px / Math.max(1, origH),
        x2: x2Px / Math.max(1, origW),
        y2: y2Px / Math.max(1, origH),
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
      await session?.release?.();
    } catch {
      /* ignore */
    }
    session = null;
    sessionPromise = null;
    self.postMessage({ id: msg.id, ok: true });
    return;
  }

  if (msg.type === 'detect') {
    try {
      const s = await ensureSession();
      const bgr = new Float32Array(msg.bgrBuffer);
      const inputTensor = new ort.Tensor('float32', bgr, [1, 3, 640, 640]);
      const outputs = await s.run({ input: inputTensor });
      const faces = decodeYuNetOutputs(
        outputs,
        msg.origW,
        msg.origH,
        msg.scale,
        msg.scoreThreshold ?? 0.72
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
  }
};
