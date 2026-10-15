/**
 * 음성 검색 스마트 폴백 (D-18 설계)
 *
 * 1순위  audio-direct : 음성 파형 → EmbeddingGemma 2 오디오 인코더 → 사진 벡터와 직접 매칭 (STT 없음, 완전 온디바이스)
 * 2순위  stt-fallback : OS/브라우저 내장 Web Speech API로 텍스트 변환 → 텍스트 인코더
 *
 * 판정 단계
 *  ① 사전 판정: WebGPU 유무, GPU 버퍼 한도, 기기 메모리 힌트
 *  ② 로드 판정: 오디오 인코더 로드 중 오류(OOM 등) → 폴백
 *  ③ 실행 판정: 첫 오디오 추론 오류 → 폴백 (이후 세션 동안 STT 유지)
 */

export type VoiceMode = 'audio-direct' | 'stt-fallback';

export interface VoiceDecision {
  mode: VoiceMode;
  stage: 'precheck' | 'load' | 'runtime' | 'forced';
  reason: string;
}

// PoC 임시 기준값 — 실측 후 조정
export const VOICE_THRESHOLDS = {
  minMaxBufferSize: 256 * 1024 * 1024, // GPU 단일 버퍼 최소 256MB
  minDeviceMemoryGB: 4, // navigator.deviceMemory 힌트 (Chrome 계열만 제공)
};

export function precheckVoice(env: Record<string, any>, forced: 'auto' | 'audio' | 'stt'): VoiceDecision {
  if (forced === 'audio') return { mode: 'audio-direct', stage: 'forced', reason: '설정에서 오디오 직접 강제' };
  if (forced === 'stt') return { mode: 'stt-fallback', stage: 'forced', reason: '설정에서 STT 폴백 강제' };
  if (!env.webgpu) return { mode: 'stt-fallback', stage: 'precheck', reason: 'WebGPU 미지원' };
  if (env.maxBufferSize && env.maxBufferSize < VOICE_THRESHOLDS.minMaxBufferSize) {
    return { mode: 'stt-fallback', stage: 'precheck', reason: `GPU maxBufferSize ${(env.maxBufferSize / 2 ** 20).toFixed(0)}MB < 256MB` };
  }
  if (env.deviceMemoryGB && env.deviceMemoryGB < VOICE_THRESHOLDS.minDeviceMemoryGB) {
    return { mode: 'stt-fallback', stage: 'precheck', reason: `기기 메모리 ${env.deviceMemoryGB}GB < 4GB` };
  }
  return { mode: 'audio-direct', stage: 'precheck', reason: '사전 판정 통과' };
}

export const sttAvailable = () => !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

/** 마이크 녹음 → Blob (말하고 버튼을 다시 누르면 종료, 최대 8초) */
export class MicRecorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private timer = 0;

  get recording() {
    return !!this.rec;
  }

  async start(onAutoStop: () => void) {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    this.chunks = [];
    this.rec = new MediaRecorder(this.stream);
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start();
    this.timer = window.setTimeout(onAutoStop, 8000);
  }

  async stop(): Promise<Blob> {
    clearTimeout(this.timer);
    const rec = this.rec!;
    const done = new Promise<void>((res) => (rec.onstop = () => res()));
    rec.stop();
    await done;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.rec = null;
    return new Blob(this.chunks, { type: rec.mimeType });
  }
}

/** Web Speech API 1회 인식 (STT 폴백 경로) */
export function recognizeOnce(lang = 'ko-KR', onInterim?: (t: string) => void): Promise<string> {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return new Promise((resolve, reject) => {
    if (!SR) return reject(new Error('Web Speech API 미지원'));
    const r = new SR();
    r.lang = lang;
    r.interimResults = true;
    let final = '';
    r.onresult = (ev: any) => {
      const txt = Array.from(ev.results).map((x: any) => x[0].transcript).join('');
      onInterim?.(txt);
      if (ev.results[ev.results.length - 1].isFinal) final = txt;
    };
    r.onerror = (ev: any) => reject(new Error(ev.error));
    r.onend = () => resolve(final);
    r.start();
  });
}
