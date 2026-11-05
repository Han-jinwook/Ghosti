import { getZCoreUrl, zCoreBridge } from './zCoreBridge';
/**
 * [🛠️ Ghosti 설정몬스터 Neural TTS 클라이언트 & 무지연 캐시 재생기]
 * 1. 기본 성우: typecast_piljae / ko-KR-HyunsuNeural (MS 신경망 남성 성우 '현수')
 * 2. 문서 낭독 성우: ko-KR-SunHiNeural (MS 신경망 여성 성우 '선희')
 * 3. 3단 무지연 무과금 캐시 재생 구조:
 *    - ① Cache Hit: 로컬 tts_cache/{hash}.mp3 즉시 0.001초 재생 (메모리 ObjectURL 2차 캐싱 포함, 비용 0원)
 *    - ② Cache Miss: MS 신경망 현수/선희 성우 최초 1회 실시간 합성 재생 + 백그라운드 Write-Through 캐시 영구 저장
 *    - ③ Pre-warming: 앱 시작 시 고정 안내 멘트 13종 백그라운드 일괄 사전 합성 (이후 영구 무과금 재활용)
 * 4. 오프라인/비상 폴백 방어:
 *    - 네트워크 완전 단절 시 speechSynthesis (Microsoft InJoon Natural -> Google 한국의) 폴백
 *    - 'Heami' 등 구형 데스크톱 기계음은 100% 원천 차단
 */

export const SETUP_MONSTER_TTS_VOICE_PILJAE = 'typecast_piljae' as const; // MS 신경망 성우 '현수(ko-KR-HyunsuNeural)'
export const SETUP_MONSTER_TTS_VOICE_HYUNSU = 'ko-KR-HyunsuNeural' as const;
export const SETUP_MONSTER_TTS_VOICE_SUNHI = 'ko-KR-SunHiNeural' as const;
export const SETUP_MONSTER_TTS_VOICE_YUJIN = 'typecast_yujin' as const;
export const SETUP_MONSTER_TTS_VOICE_EDGE = 'ko-KR-InJoonNeural' as const;

export const SETUP_MONSTER_TTS_VOICE_DEFAULT = SETUP_MONSTER_TTS_VOICE_HYUNSU;
export const SETUP_MONSTER_TTS_VOICE_ALT = SETUP_MONSTER_TTS_VOICE_SUNHI;

export type GhostiVoiceGender = 'male' | 'female';

const VOICE_GENDER_STORAGE_KEY = 'ghosti_preferred_voice_gender';
const VOICE_ENABLED_STORAGE_KEY = 'ghosti_preferred_voice_enabled';

type VoicePrefListener = () => void;
const voicePrefListeners = new Set<VoicePrefListener>();

function notifyVoicePrefListeners() {
  voicePrefListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeGhostiVoicePrefs(listener: VoicePrefListener): () => void {
  voicePrefListeners.add(listener);
  return () => {
    voicePrefListeners.delete(listener);
  };
}

export function getPreferredVoiceGender(): GhostiVoiceGender {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(VOICE_GENDER_STORAGE_KEY);
      if (saved === 'female' || saved === 'male') return saved;
    }
  } catch {
    /* ignore */
  }
  return 'male';
}

export function setPreferredVoiceGender(gender: GhostiVoiceGender): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(VOICE_GENDER_STORAGE_KEY, gender);
    }
  } catch {
    /* ignore */
  }
  notifyVoicePrefListeners();
}

export function getPreferredVoiceEnabled(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(VOICE_ENABLED_STORAGE_KEY);
      if (saved === 'false') return false;
    }
  } catch {
    /* ignore */
  }
  return true;
}

export function setPreferredVoiceEnabled(enabled: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(VOICE_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
    }
  } catch {
    /* ignore */
  }
  if (!enabled) {
    stopSetupMonsterTts();
  }
  notifyVoicePrefListeners();
}

/**
 * [멀린님 지침] PC(데스크톱)에서는 마이크 입력 및 음성 출력(TTS)을 모두 제거하고,
 * 오직 모바일(스마트폰/태블릿) 환경에서만 음성 인식 및 현수·선희 성우 음성 출력을 가동합니다.
 */
export function isMobileVoiceEnvironment(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile|KakaoTalk/i.test(ua)) return true;
  if (typeof window.matchMedia === 'function') {
    if (window.matchMedia('(max-width: 767px)').matches) return true;
  }
  return false;
}

export function resolveActiveTtsVoiceId(): typeof SETUP_MONSTER_TTS_VOICE_HYUNSU | typeof SETUP_MONSTER_TTS_VOICE_SUNHI {
  return getPreferredVoiceGender() === 'female'
    ? SETUP_MONSTER_TTS_VOICE_SUNHI
    : SETUP_MONSTER_TTS_VOICE_HYUNSU;
}

export type SetupMonsterTtsVoice =
  | typeof SETUP_MONSTER_TTS_VOICE_PILJAE
  | typeof SETUP_MONSTER_TTS_VOICE_HYUNSU
  | typeof SETUP_MONSTER_TTS_VOICE_SUNHI
  | typeof SETUP_MONSTER_TTS_VOICE_YUJIN
  | typeof SETUP_MONSTER_TTS_VOICE_EDGE;

export const SETUP_MONSTER_TTS_RATE_DEFAULT = '+15%' as const;

export const SETUP_MONSTER_PREWARM_PHRASES: readonly string[] = [
  '끊어졌던 업무용 S 드라이브를 다시 연결하고 폴더 창을 열어 드렸습니다.',
  '수리하기 전 원래 설정 상태로 깔끔하게 되돌렸습니다.',
  '두 번 이상 길을 헤매게 해드려 죄송합니다. 이번 수리비는 받지 않고 전액 환불해 드렸습니다.',
  '문제가 해결되지 않아 원래 설정으로 되돌리고 코인을 전액 환불해 드렸습니다.',
  '내 컴퓨터 시작프로그램 중 부팅을 느리게 하던 불필요한 항목을 정리했습니다.',
  '컴퓨터 뒤에서 계속 돌아가던 보안 프로그램들을 은행을 쓸 때만 켜지도록 정리했습니다.',
  '막혀 있던 프린터 인쇄 대기 목록을 비우고 바로 인쇄가 되도록 다시 연결했습니다.',
  '노트북 뚜껑을 덮어도 꺼지지 않고 계속 작동하도록 전원 설정을 변경했습니다.',
  '어르신께서 보시기 편하도록 글자 크기를 시원하게 키우고 눈 보호 모드를 켰습니다.',
  '오른쪽 위에 있는 톱니바퀴 모양 설정 버튼을 눌러주세요.',
  '세 번째 줄에 있는 알림 스위치를 눌러 꺼주시면 완료됩니다.',
  '화살표가 가리키는 상단 보기 메뉴를 먼저 클릭해 주세요.',
  '이제 바로 아래에 열린 첫 행 고정 버튼을 누르시면 세팅이 끝납니다.',
];

let activeAudioElement: HTMLAudioElement | null = null;
let sharedGestureAudioElement: HTMLAudioElement | null = null;
let ttsWebAudioCtx: AudioContext | null = null;
let activeWebAudioSource: AudioBufferSourceNode | null = null;
let mobileAudioUnlocked = false;
let isCurrentlySpeaking = false;
let lastSpokenText = '';
let lastSpokenRate: string = SETUP_MONSTER_TTS_RATE_DEFAULT;
let lastMicReleaseTimestampMs = 0;
const memoryAudioUrlCache = new Map<string, string>();
const memoryArrayBufferCache = new Map<string, ArrayBuffer>();
let prewarmTriggered = false;

function getOrInitTtsAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ttsWebAudioCtx) {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (Ctx) {
      try {
        ttsWebAudioCtx = new Ctx();
      } catch {
        ttsWebAudioCtx = null;
      }
    }
  }
  return ttsWebAudioCtx;
}

/**
 * 모바일에서 마이크 녹음(SpeechRecognition/MediaRecorder)이 종료된 시각을 기록합니다.
 * 모바일 OS가 통화/녹음 오디오 세션에서 미디어 스피커 세션으로 복귀할 수 있도록 약 200ms 여유를 보장합니다.
 */
export function notifyMicSessionEndedForTts(): void {
  lastMicReleaseTimestampMs = Date.now();
}

/**
 * [모바일 iOS Safari / Android Chrome 비동기 TTS 자동재생 100% 잠금 해제]
 * WebAudio AudioContext는 최초 1회 터치/클릭 제스처에서 resume()되면 이후 비동기 타이머·음성인식 종료 콜백에서도
 * NotAllowedError 없이 100% 소리 출력이 보장됩니다.
 */
export function unlockMobileAudioOnUserGesture(): void {
  if (typeof window === 'undefined') return;
  try {
    const ctx = getOrInitTtsAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      if (!mobileAudioUnlocked) {
        const silentBuf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = silentBuf;
        src.connect(ctx.destination);
        src.start(0);
      }
    }
  } catch {
    /* ignore */
  }
  try {
    if (!sharedGestureAudioElement && typeof Audio !== 'undefined') {
      sharedGestureAudioElement = new Audio();
      sharedGestureAudioElement.preload = 'auto';
    }
    if (!mobileAudioUnlocked && sharedGestureAudioElement) {
      mobileAudioUnlocked = true;
      sharedGestureAudioElement.src =
        'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      sharedGestureAudioElement.volume = 0.01;
      const playPromise = sharedGestureAudioElement.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            if (!isCurrentlySpeaking && sharedGestureAudioElement) {
              sharedGestureAudioElement.pause();
              sharedGestureAudioElement.currentTime = 0;
            }
          })
          .catch(() => {});
      }
    }
  } catch {
    /* ignore */
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const autoUnlockHandler = () => {
    unlockMobileAudioOnUserGesture();
  };
  ['touchstart', 'touchend', 'pointerdown', 'mousedown', 'click', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, autoUnlockHandler, { passive: true, capture: true });
  });
}

function createOrReuseBlessedAudio(srcUrl: string, volume = 0.95): HTMLAudioElement {
  const audio = sharedGestureAudioElement ?? new Audio();
  sharedGestureAudioElement = audio;
  try {
    audio.pause();
  } catch {
    /* ignore */
  }
  audio.src = srcUrl;
  audio.volume = volume;
  return audio;
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer | null {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return null;
    const base64 = dataUrl.slice(commaIdx + 1);
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch {
    return null;
  }
}

async function playAudioUrlOrBufferReliably(
  playableUrl: string,
  cacheKey: string
): Promise<boolean> {
  // 마이크 종료 직후라면 모바일 OS 오디오 라우팅 복귀를 위해 220ms 대기
  const sinceMicStop = Date.now() - lastMicReleaseTimestampMs;
  if (sinceMicStop >= 0 && sinceMicStop < 220) {
    await new Promise((r) => setTimeout(r, 220 - sinceMicStop));
  }

  // 1차: WebAudio AudioContext 재생 (모바일 비동기 콜백 Autoplay 차단 100% 우회)
  try {
    const ctx = getOrInitTtsAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      let rawBuf = memoryArrayBufferCache.get(cacheKey) || null;
      if (!rawBuf) {
        if (playableUrl.startsWith('data:')) {
          rawBuf = dataUrlToArrayBuffer(playableUrl);
        } else {
          const r = await fetch(playableUrl);
          if (r.ok) rawBuf = await r.arrayBuffer();
        }
        if (rawBuf && rawBuf.byteLength > 128) {
          memoryArrayBufferCache.set(cacheKey, rawBuf);
        }
      }
      if (rawBuf && rawBuf.byteLength > 128) {
        const decoded = await ctx.decodeAudioData(rawBuf.slice(0));
        if (activeWebAudioSource) {
          try {
            activeWebAudioSource.stop();
            activeWebAudioSource.disconnect();
          } catch {
            /* ignore */
          }
          activeWebAudioSource = null;
        }
        const source = ctx.createBufferSource();
        const gainNode = ctx.createGain();
        gainNode.gain.value = 1.0;
        source.buffer = decoded;
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        activeWebAudioSource = source;
        isCurrentlySpeaking = true;
        notifyVoicePrefListeners();
        source.onended = () => {
          if (activeWebAudioSource === source) {
            activeWebAudioSource = null;
            isCurrentlySpeaking = false;
            notifyVoicePrefListeners();
          }
        };
        source.start(0);
        return true;
      }
    }
  } catch {
    /* WebAudio 실패 시 즉시 HTMLAudioElement 폴백 */
  }

  // 2차: HTMLAudioElement 재생
  if (typeof Audio !== 'undefined') {
    try {
      const audio = createOrReuseBlessedAudio(playableUrl, 0.95);
      audio.onended = () => {
        if (activeAudioElement === audio) {
          activeAudioElement = null;
          isCurrentlySpeaking = false;
          notifyVoicePrefListeners();
        }
      };
      audio.onerror = () => {
        if (activeAudioElement === audio) {
          activeAudioElement = null;
          isCurrentlySpeaking = false;
          notifyVoicePrefListeners();
        }
      };
      activeAudioElement = audio;
      isCurrentlySpeaking = true;
      notifyVoicePrefListeners();
      await audio.play();
      return true;
    } catch {
      isCurrentlySpeaking = false;
      notifyVoicePrefListeners();
    }
  }
  return false;
}

export function getIsTtsSpeaking(): boolean {
  return isCurrentlySpeaking;
}

export function getLastSpokenTtsText(): string {
  return lastSpokenText;
}

export const VOICE_PREVIEW_PHRASE_MALE =
  '안녕하세요, 남성 성우 현수 목소리로 안내해 드립니다.' as const;
export const VOICE_PREVIEW_PHRASE_FEMALE =
  '안녕하세요, 여성 성우 선희 목소리로 안내해 드립니다.' as const;

export function isVoiceActorPreviewGreeting(text: string): boolean {
  const clean = normalizeTtsText(text);
  return (
    clean === VOICE_PREVIEW_PHRASE_MALE ||
    clean === VOICE_PREVIEW_PHRASE_FEMALE ||
    clean.includes('성우 현수 목소리로 안내') ||
    clean.includes('성우 선희 목소리로 안내')
  );
}

export function adaptScriptToActiveVoiceGender(text: string): string {
  const clean = normalizeTtsText(text);
  if (!clean) return clean;
  if (getPreferredVoiceGender() === 'female') {
    return clean
      .replace(/남성\s*성우\s*현수/g, '여성 성우 선희')
      .replace(/현수\s*성우/g, '선희 성우');
  }
  return clean
    .replace(/여성\s*성우\s*선희/g, '남성 성우 현수')
    .replace(/선희\s*성우/g, '현수 성우')
    .replace(/선희\s*아나운서/g, '현수 성우');
}

export function normalizeTtsText(rawText: string): string {
  return String(rawText || '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * 현재 재생 중인 모든 TTS 오디오 및 폴백 음성을 즉시 중단합니다.
 */
export function stopSetupMonsterTts(): void {
  isCurrentlySpeaking = false;
  try {
    if (activeWebAudioSource) {
      activeWebAudioSource.stop();
      activeWebAudioSource.disconnect();
      activeWebAudioSource = null;
    }
  } catch {
    /* ignore */
  }
  try {
    if (activeAudioElement) {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
      activeAudioElement = null;
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  } catch {
    /* ignore */
  }
  notifyVoicePrefListeners();
}

/**
 * 마지막으로 재생되었던 음성(또는 전달된 fallbackText)을 현재 선택된 성우(남/여) 목소리로 다시 재생합니다.
 */
export async function replayLastSetupMonsterTts(fallbackText?: string): Promise<boolean> {
  const rawCandidate = lastSpokenText || fallbackText || '';
  const target = adaptScriptToActiveVoiceGender(rawCandidate);
  if (!target) return false;
  if (!getPreferredVoiceEnabled()) {
    setPreferredVoiceEnabled(true);
  }
  const res = await speakSetupMonsterTts(target, { rate: lastSpokenRate });
  return res.ok;
}

/**
 * [오프라인 비상 폴백 — 'Heami' 기계음 원천 차단]
 * 네트워크 단절 등으로 서버 호출이 불가능할 때만 최후의 수단으로 동작하며,
 * getVoices()에서 'Heami' 같은 구형 기계음은 절대 선택하지 않고
 * 'Microsoft InJoon Online (Natural)' -> 'Google 한국의' 순서로만 매칭합니다.
 */
function speakOfflineFallbackWithoutHeami(text: string): boolean {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false;
    }
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices() || [];

    const isFemalePref = getPreferredVoiceGender() === 'female';
    // [현수/선희 외 엉뚱한 목소리 원천 차단]
    // 오직 MS 신경망 성우인 Hyunsu(현수) 또는 SunHi(선희)만 허용합니다.
    // InJoon, Google 한국의 등 다른 사람/OS 로봇 목소리는 절대 재생하지 않고 조용히 무음 종료합니다.
    const exactVoice = voices.find((v) =>
      isFemalePref
        ? /SunHi/i.test(v.name)
        : /Hyunsu/i.test(v.name)
    );

    if (!exactVoice) {
      // 현수/선희가 없는 환경에서는 다른 목소리 공해를 막기 위해 일체 발화하지 않음
      return false;
    }

    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = exactVoice;
    utter.lang = 'ko-KR';
    utter.pitch = isFemalePref ? 1.05 : 0.95;
    utter.rate = 1.15;
    utter.volume = 0.45;
    utter.onend = () => {
      isCurrentlySpeaking = false;
      notifyVoicePrefListeners();
    };
    utter.onerror = () => {
      isCurrentlySpeaking = false;
      notifyVoicePrefListeners();
    };
    isCurrentlySpeaking = true;
    notifyVoicePrefListeners();
    window.speechSynthesis.speak(utter);
    return true;
  } catch {
    isCurrentlySpeaking = false;
    notifyVoicePrefListeners();
    return false;
  }
}

/**
 * [MS 신경망 성우 '현수(ko-KR-HyunsuNeural)' / '선희(ko-KR-SunHiNeural)' 무지연 재생 & Write-Through 캐싱]
 */
export async function speakSetupMonsterTts(
  rawText: string,
  options?: {
    voice?: SetupMonsterTtsVoice | string;
    rate?: string;
    forceRoleVoice?: boolean;
  }
): Promise<{
  ok: boolean;
  cacheStatus: 'MEMORY_HIT' | 'HIT' | 'MISS' | 'FALLBACK_NATURAL' | 'SKIPPED';
  voice: string;
  voiceActor?: string;
  audioUrl?: string;
  elapsedMs: number;
}> {
  const requestedVoice =
    options?.forceRoleVoice && options?.voice
      ? String(options.voice)
      : resolveActiveTtsVoiceId();
  const isSunhiTarget = /sunhi|female|yujin/i.test(requestedVoice);
  const voice = isSunhiTarget ? SETUP_MONSTER_TTS_VOICE_SUNHI : SETUP_MONSTER_TTS_VOICE_HYUNSU;

  const cleanText = options?.forceRoleVoice
    ? normalizeTtsText(rawText)
    : adaptScriptToActiveVoiceGender(rawText);

  if (cleanText) {
    lastSpokenText = cleanText;
    lastSpokenRate = options?.rate ?? SETUP_MONSTER_TTS_RATE_DEFAULT;
  }
  // PC 환경에서는 음성 출력(TTS)을 완전히 비활성화 (모바일 전용)
  if (!isMobileVoiceEnvironment() || !cleanText || !getPreferredVoiceEnabled()) {
    return {
      ok: false,
      cacheStatus: 'SKIPPED',
      voice,
      elapsedMs: 0,
    };
  }

  stopSetupMonsterTts();

  const rate = options?.rate ?? SETUP_MONSTER_TTS_RATE_DEFAULT;
  const cacheKey = `${voice}|${rate}|${cleanText}`;
  const t0 = performance.now();

  // 0단계: 브라우저 메모리 캐시 히트 시 0.001초 즉시 재생 (WebAudio 우선)
  const cachedUrl = memoryAudioUrlCache.get(cacheKey);
  if (cachedUrl) {
    const played = await playAudioUrlOrBufferReliably(cachedUrl, cacheKey);
    if (played) {
      return {
        ok: true,
        cacheStatus: 'MEMORY_HIT',
        voice,
        voiceActor: isSunhiTarget ? '선희 (MS Neural 여성 성우)' : '현수 (MS Neural 남성 성우)',
        audioUrl: cachedUrl,
        elapsedMs: Math.round((performance.now() - t0) * 100) / 100,
      };
    }
  }

  // 1·2단계: 로컬 Z-코어가 연결된 환경에서만 tts_cache 조회 (모바일 클라우드 접속 시 타임아웃 지연 없이 즉시 /api/edge-tts 직행)
  const canTryLocalZCore =
    zCoreBridge.isConnected ||
    (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
  if (canTryLocalZCore) {
    try {
      const zcoreController = new AbortController();
      const zcoreTimer = setTimeout(() => zcoreController.abort(), 1200);
      const res = await fetch(getZCoreUrl('/__setup-monster/tts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, voice, rate }),
        signal: zcoreController.signal,
      }).finally(() => clearTimeout(zcoreTimer));
      if (res.ok) {
        const data = await res.json();
        if (data?.ok && data.audioUrl) {
          const playableUrl = getZCoreUrl(String(data.audioUrl));
          memoryAudioUrlCache.set(cacheKey, playableUrl);
          const played = await playAudioUrlOrBufferReliably(playableUrl, cacheKey);
          if (played) {
            return {
              ok: true,
              cacheStatus: data.cacheStatus === 'HIT' ? 'HIT' : 'MISS',
              voice: data.voice || voice,
              voiceActor:
                data.voiceActor ||
                (isSunhiTarget ? '선희 (MS Neural 여성 성우)' : '현수 (MS Neural 남성 성우)'),
              audioUrl: playableUrl,
              elapsedMs:
                typeof data.elapsedMs === 'number'
                  ? data.elapsedMs
                  : Math.round((performance.now() - t0) * 100) / 100,
            };
          }
        }
      }
    } catch {
      /* network offline -> fallback below */
    }
  }

  // 2.5단계: 웹/Netlify 배포 환경 클라우드 MS 신경망 성우 서버리스 브릿지 (/api/edge-tts)
  try {
    const cloudController = new AbortController();
    const cloudTimer = setTimeout(() => cloudController.abort(), 5500);
    const cloudRes = await fetch('/api/edge-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText, voice, rate }),
      signal: cloudController.signal,
    }).finally(() => clearTimeout(cloudTimer));
    if (cloudRes.ok) {
      const cloudData = await cloudRes.json();
      if (cloudData?.ok && cloudData.audioDataUrl) {
        const playableUrl = String(cloudData.audioDataUrl);
        memoryAudioUrlCache.set(cacheKey, playableUrl);
        const played = await playAudioUrlOrBufferReliably(playableUrl, cacheKey);
        if (played) {
          return {
            ok: true,
            cacheStatus: 'MISS',
            voice: cloudData.voice || voice,
            voiceActor:
              cloudData.voiceActor ||
              (isSunhiTarget ? '선희 (MS Neural 여성 성우)' : '현수 (MS Neural 남성 성우)'),
            audioUrl: playableUrl,
            elapsedMs:
              typeof cloudData.elapsedMs === 'number'
                ? cloudData.elapsedMs
                : Math.round((performance.now() - t0) * 100) / 100,
          };
        }
      }
    }
  } catch {
    /* cloud endpoint unreachable -> fallback below */
  }

  // 3단계: 오프라인 비상 폴백 (Heami 기계음 원천 차단)
  const usedNaturalFallback = speakOfflineFallbackWithoutHeami(cleanText);
  return {
    ok: usedNaturalFallback,
    cacheStatus: usedNaturalFallback ? 'FALLBACK_NATURAL' : 'SKIPPED',
    voice: usedNaturalFallback ? 'BrowserNaturalFallback' : voice,
    voiceActor: usedNaturalFallback ? '자연어 폴백' : '현수 (MS Neural 무료 무제한)',
    elapsedMs: Math.round((performance.now() - t0) * 100) / 100,
  };
}

/**
 * [고정 가이드 멘트 사전 프리워밍(Pre-warming)]
 * 앱/모달 진입 시 백그라운드 캐싱 큐가 조용히 순회하며 미리 tts_cache/*.mp3로 구워둡니다.
 */
export function triggerSetupMonsterTtsPrewarm(
  voice: SetupMonsterTtsVoice = SETUP_MONSTER_TTS_VOICE_DEFAULT,
  rate: string = SETUP_MONSTER_TTS_RATE_DEFAULT
): void {
  if (!isMobileVoiceEnvironment()) return;
  if (prewarmTriggered) return;
  prewarmTriggered = true;
  if (typeof window === 'undefined') return;

  window.setTimeout(() => {
    fetch(getZCoreUrl('/__setup-monster/tts-prewarm'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voice,
        rate,
        phrases: SETUP_MONSTER_PREWARM_PHRASES,
      }),
    }).catch(() => {});
  }, 150);
}
