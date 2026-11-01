/**
 * 👻 귀신같이(Ghosti) 아기귀신 시그니처 사운드 엔진 (SSOT 44.1kHz WAV + 70ms 무음 프리롤)
 * - 앱 입장 시: 애기귀신 웃음소리 (③번 sample3_baby_ghost_giggle.wav / active_typo_sound.wav)
 * - 3대 메뉴 전환 시: 애기귀신 호출소리 (①번 active_summon_sound.wav / sample2_cute_ghost_pop.wav)
 */

const GIGGLE_SOUND_URL = '/sounds/baby_ghost/sample3_baby_ghost_giggle.wav';
const SUMMON_SOUND_URL = '/sounds/baby_ghost/active_summon_sound.wav';

let preloadedGiggleAudio: HTMLAudioElement | null = null;
let preloadedSummonAudio: HTMLAudioElement | null = null;
let hasPlayedAppEnterGiggle = false;
let unlockListenerBound = false;
let lastSoundPlayedAt = 0;

function ensurePreloaded(): void {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
  if (!preloadedGiggleAudio) {
    preloadedGiggleAudio = new Audio(GIGGLE_SOUND_URL);
    preloadedGiggleAudio.preload = 'auto';
    preloadedGiggleAudio.volume = 0.85;
  }
  if (!preloadedSummonAudio) {
    preloadedSummonAudio = new Audio(SUMMON_SOUND_URL);
    preloadedSummonAudio.preload = 'auto';
    preloadedSummonAudio.volume = 0.8;
  }
}

function playFallbackWebAudio(mode: 'giggle' | 'summon'): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime + 0.04;
    const notes = mode === 'summon' ? [587.33, 880, 1174.66] : [1046.5, 1318.5, 1567.98, 2093.0];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.065);
      gain.gain.setValueAtTime(0.001, now + idx * 0.065);
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.065 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.065 + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.065);
      osc.stop(now + idx * 0.065 + 0.17);
    });
  } catch {
    // ignore audio fallback errors
  }
}

/**
 * 👻 앱 입장 시 1회 재생되는 '애기귀신 웃음소리' (sample3_baby_ghost_giggle.wav)
 * - 브라우저 자동재생 정책(Autoplay Policy)에 의해 첫 로드 시 차단되면,
 *   유저의 첫 화면 터치/클릭 순간 즉시 1회 재생합니다.
 */
export function playAppEnterGiggleSound(forceReplay = false): void {
  if (typeof window === 'undefined') return;
  if (hasPlayedAppEnterGiggle && !forceReplay) return;

  ensurePreloaded();
  try {
    const audio = new Audio(GIGGLE_SOUND_URL);
    audio.volume = 0.85;
    const p = audio.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        hasPlayedAppEnterGiggle = true;
        lastSoundPlayedAt = Date.now();
      }).catch(() => {
        // 브라우저 자동재생 차단 시 첫 클릭/터치에 1회 자동 언락 바인딩
        if (!unlockListenerBound) {
          unlockListenerBound = true;
          const onFirstInteract = () => {
            window.removeEventListener('pointerdown', onFirstInteract, true);
            window.removeEventListener('keydown', onFirstInteract, true);
            if (!hasPlayedAppEnterGiggle) {
              hasPlayedAppEnterGiggle = true;
              lastSoundPlayedAt = Date.now();
              const retryAudio = new Audio(GIGGLE_SOUND_URL);
              retryAudio.volume = 0.85;
              retryAudio.play().catch(() => playFallbackWebAudio('giggle'));
            }
          };
          window.addEventListener('pointerdown', onFirstInteract, true);
          window.addEventListener('keydown', onFirstInteract, true);
        }
      });
    } else {
      hasPlayedAppEnterGiggle = true;
      lastSoundPlayedAt = Date.now();
    }
  } catch {
    playFallbackWebAudio('giggle');
  }
}

/**
 * ✨ 3대 메뉴(내 기기 / 사진 공유 / 업무 공유 및 찾기 / 손보기 / 공유) 전환 시 재생되는 '호출소리' (active_summon_sound.wav)
 * - 동일 클릭 이벤트에서 중복 호출되지 않도록 140ms 디바운스를 적용합니다.
 */
export function playMenuSummonSound(): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastSoundPlayedAt < 140) return;
  lastSoundPlayedAt = now;

  ensurePreloaded();
  try {
    const audio = new Audio(SUMMON_SOUND_URL);
    audio.volume = 0.8;
    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => playFallbackWebAudio('summon'));
    }
  } catch {
    playFallbackWebAudio('summon');
  }
}
