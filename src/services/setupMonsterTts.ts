import { getZCoreUrl } from './zCoreBridge';
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
let isCurrentlySpeaking = false;
let lastSpokenText = '';
let lastSpokenRate: string = SETUP_MONSTER_TTS_RATE_DEFAULT;
const memoryAudioUrlCache = new Map<string, string>();
let prewarmTriggered = false;

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
    // 구형 기계음(Heami 등)은 절대 선택 금지
    const nonRoboticVoices = voices.filter((v) => !/heami/i.test(v.name));

    const isFemalePref = getPreferredVoiceGender() === 'female';
    const nativeGenderVoice = nonRoboticVoices.find((v) =>
      isFemalePref ? /SunHi|Female|여성/i.test(v.name) : /InJoon|Hyunsu|Male|남성/i.test(v.name)
    );
    const preferredVoice =
      nativeGenderVoice ||
      nonRoboticVoices.find((v) =>
        /Microsoft\s+(InJoon|Hyunsu|SunHi)\s+Online\s*\(Natural\)/i.test(v.name)
      ) ||
      nonRoboticVoices.find((v) => /InJoon|Hyunsu|SunHi/i.test(v.name)) ||
      nonRoboticVoices.find((v) => /Google\s*한국의/i.test(v.name)) ||
      nonRoboticVoices.find((v) => /Google/i.test(v.name) && /ko/i.test(v.lang));

    if (!preferredVoice) {
      // Heami밖에 없는 환경에서는 기계음 공해를 막기 위해 발화하지 않고 조용히 종료
      return false;
    }

    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = preferredVoice;
    utter.lang = 'ko-KR';
    // 크롬 등 기본 단일 성우(Google 한국의 등) 환경에서도 남(중저음 바리톤 0.65) vs 여(밝은 톤 1.15) 확실히 구분
    if (isFemalePref) {
      utter.pitch = nativeGenderVoice ? 1.05 : 1.18;
      utter.rate = 1.15;
    } else {
      const isAlreadyMaleVoice = /InJoon|Hyunsu|Male|남성/i.test(preferredVoice.name);
      utter.pitch = isAlreadyMaleVoice ? 0.95 : 0.62;
      utter.rate = isAlreadyMaleVoice ? 1.15 : 1.05;
    }
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
  }
): Promise<{
  ok: boolean;
  cacheStatus: 'MEMORY_HIT' | 'HIT' | 'MISS' | 'FALLBACK_NATURAL' | 'SKIPPED';
  voice: string;
  voiceActor?: string;
  audioUrl?: string;
  elapsedMs: number;
}> {
  const cleanText = adaptScriptToActiveVoiceGender(rawText);
  if (cleanText) {
    lastSpokenText = cleanText;
    lastSpokenRate = options?.rate ?? SETUP_MONSTER_TTS_RATE_DEFAULT;
  }
  if (!cleanText || !getPreferredVoiceEnabled()) {
    return {
      ok: false,
      cacheStatus: 'SKIPPED',
      voice: resolveActiveTtsVoiceId(),
      elapsedMs: 0,
    };
  }

  stopSetupMonsterTts();

  // 유저가 직접 선택한 남(현수)/여(선희) 성우 설정을 최우선으로 일원화 적용
  const voice = resolveActiveTtsVoiceId();
  const rate = options?.rate ?? SETUP_MONSTER_TTS_RATE_DEFAULT;
  const cacheKey = `${voice}|${rate}|${cleanText}`;
  const t0 = performance.now();

  // 0단계: 브라우저 메모리 캐시 히트 시 0.001초 즉시 재생
  const cachedUrl = memoryAudioUrlCache.get(cacheKey);
  if (cachedUrl && typeof Audio !== 'undefined') {
    try {
      const audio = new Audio(cachedUrl);
      audio.volume = 0.4;
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
      return {
        ok: true,
        cacheStatus: 'MEMORY_HIT',
        voice,
        voiceActor: voice.includes('SunHi') ? '선희 (MS Neural 무료 무제한)' : '현수 (MS Neural 무료 무제한)',
        audioUrl: cachedUrl,
        elapsedMs: Math.round((performance.now() - t0) * 100) / 100,
      };
    } catch {
      isCurrentlySpeaking = false;
      notifyVoicePrefListeners();
      /* continue to local server cache */
    }
  }

  // 1·2단계: 로컬 Z-코어 tts_cache 조회(Cache Hit 시 0.001초) 또는 MS 신경망 실시간 합성 + Write-Through 캐싱(Cache Miss)
  try {
    const res = await fetch(getZCoreUrl('/__setup-monster/tts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText, voice, rate }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.ok && data.audioUrl && typeof Audio !== 'undefined') {
        const playableUrl = getZCoreUrl(String(data.audioUrl));
        memoryAudioUrlCache.set(cacheKey, playableUrl);
        const audio = new Audio(playableUrl);
        audio.volume = 0.4;
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
        await audio.play().catch(() => {
          isCurrentlySpeaking = false;
          notifyVoicePrefListeners();
        });
        return {
          ok: true,
          cacheStatus: data.cacheStatus === 'HIT' ? 'HIT' : 'MISS',
          voice: data.voice || voice,
          voiceActor: data.voiceActor || '현수 (MS Neural 무료 무제한)',
          audioUrl: playableUrl,
          elapsedMs:
            typeof data.elapsedMs === 'number'
              ? data.elapsedMs
              : Math.round((performance.now() - t0) * 100) / 100,
        };
      }
    }
  } catch {
    /* network offline -> fallback below */
  }

  // 2.5단계: 웹/Netlify 배포 환경 클라우드 MS 신경망 성우 서버리스 브릿지 (/api/edge-tts)
  try {
    const cloudRes = await fetch('/api/edge-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText, voice, rate }),
    });
    if (cloudRes.ok) {
      const cloudData = await cloudRes.json();
      if (cloudData?.ok && cloudData.audioDataUrl && typeof Audio !== 'undefined') {
        const playableUrl = String(cloudData.audioDataUrl);
        memoryAudioUrlCache.set(cacheKey, playableUrl);
        const audio = new Audio(playableUrl);
        audio.volume = 0.45;
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
        await audio.play().catch(() => {
          isCurrentlySpeaking = false;
          notifyVoicePrefListeners();
        });
        return {
          ok: true,
          cacheStatus: 'MISS',
          voice: cloudData.voice || voice,
          voiceActor:
            cloudData.voiceActor ||
            (voice.includes('SunHi') ? '선희 (MS Neural 여성 성우)' : '현수 (MS Neural 남성 성우)'),
          audioUrl: playableUrl,
          elapsedMs:
            typeof cloudData.elapsedMs === 'number'
              ? cloudData.elapsedMs
              : Math.round((performance.now() - t0) * 100) / 100,
        };
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
