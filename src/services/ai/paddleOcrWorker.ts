/**
 * ❖ PaddleOCR PP-OCRv5 전용 Web Worker (`paddleOcrWorker.ts`)
 * - ONNX Runtime Web(detSession + recSession) 로딩·컴파일 및 OCR 텐서 추론을
 *   UI 메인 스레드에서 완전히 분리해 크롬 메인 스레드 블로킹(0ms)을 보장합니다.
 */
import {
  releasePaddleOcrRuntimeDirect,
  runPaddleOcrOnRgbaDirect,
  type PaddleOcrOptions,
} from './aiPaddleOcrEngine';

let workerChain: Promise<unknown> = Promise.resolve();

self.onmessage = (ev: MessageEvent) => {
  const msg = ev.data || {};
  const { id, type } = msg;

  const exec = async () => {
    try {
      if (type === 'ocr') {
        const rgba = new Uint8ClampedArray(msg.rgbaBuffer as ArrayBuffer);
        const res = await runPaddleOcrOnRgbaDirect(
          rgba,
          Number(msg.width),
          Number(msg.height),
          msg.options as PaddleOcrOptions | undefined
        );
        (self as any).postMessage({ id, ok: true, result: res });
        return;
      }
      if (type === 'release') {
        await releasePaddleOcrRuntimeDirect();
        (self as any).postMessage({ id, ok: true, result: true });
        return;
      }
      (self as any).postMessage({ id, ok: false, error: `UNKNOWN_OCR_RPC_${String(type)}` });
    } catch (err: any) {
      (self as any).postMessage({
        id,
        ok: false,
        error: String(err?.message || err || 'OCR_WORKER_ERROR'),
      });
    }
  };

  workerChain = workerChain.then(exec, exec);
};
