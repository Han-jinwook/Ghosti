/**
 * 👻 귀신같이(Ghosti) 아기귀신 시그니처 사운드 엔진 (SSOT 44.1kHz WAV + 70ms 무음 프리롤)
 * - 앱/웹 처음 입장 시 딱 1회만 애기귀신 웃음소리 재생 (sample3_baby_ghost_giggle.wav)
 * - 좌측 메인/서브메뉴 및 탭 클릭 시 맑은 애기귀신 호출소리 재생 (sample1_magic_summon_glissando.wav)
 */

const GIGGLE_SOUND_URL = '/sounds/baby_ghost/sample3_baby_ghost_giggle.wav';
const SUMMON_SOUND_URL = '/sounds/baby_ghost/sample1_magic_summon_glissando.wav';

let preloadedGiggleAudio: HTMLAudioElement | null = null;
let activeSummonAudio: HTMLAudioElement | null = null;
let hasPlayedAppEnterGiggle = false;
let unlockListenerBound = false;

function ensurePreloaded(): void {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
  if (!preloadedGiggleAudio) {
    preloadedGiggleAudio = new Audio(GIGGLE_SOUND_URL);
    preloadedGiggleAudio.preload = 'auto';
    preloadedGiggleAudio.volume = 0.35;
  }
}

function playFallbackWebAudio(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime + 0.04;
    const notes = [1046.5, 1318.5, 1567.98, 2093.0];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.065);
      gain.gain.setValueAtTime(0.001, now + idx * 0.065);
      gain.gain.exponentialRampToValueAtTime(0.055, now + idx * 0.065 + 0.015);
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
 * 👻 웹/앱 처음 입장 시 딱 1회만 재생되는 '애기귀신 웃음소리' (sample3_baby_ghost_giggle.wav)
 * - 브라우저 자동재생 정책(Autoplay Policy)에 의해 첫 로드 시 차단되면,
 *   유저의 첫 화면 터치/클릭 순간 딱 1회만 재생하고 이후에는 절대 재생하지 않습니다.
 */
export function playAppEnterGiggleSound(_forceReplay = false): void {
  if (typeof window === 'undefined') return;
  if (hasPlayedAppEnterGiggle) return;

  ensurePreloaded();
  try {
    const audio = new Audio(GIGGLE_SOUND_URL);
    audio.volume = 0.35;
    const p = audio.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        hasPlayedAppEnterGiggle = true;
      }).catch(() => {
        // 브라우저 자동재생 차단 시 첫 클릭/터치에 딱 1회 자동 언락 바인딩
        if (!unlockListenerBound) {
          unlockListenerBound = true;
          const onFirstInteract = () => {
            window.removeEventListener('pointerdown', onFirstInteract, true);
            window.removeEventListener('keydown', onFirstInteract, true);
            if (!hasPlayedAppEnterGiggle) {
              hasPlayedAppEnterGiggle = true;
              const retryAudio = new Audio(GIGGLE_SOUND_URL);
              retryAudio.volume = 0.35;
              retryAudio.play().catch(() => playFallbackWebAudio());
            }
          };
          window.addEventListener('pointerdown', onFirstInteract, true);
          window.addEventListener('keydown', onFirstInteract, true);
        }
      });
    } else {
      hasPlayedAppEnterGiggle = true;
    }
  } catch {
    hasPlayedAppEnterGiggle = true;
    playFallbackWebAudio();
  }
}

/**
 * ✨ 좌측 메인/서브메뉴 및 상단 탭 클릭 시 재생되는 '애기귀신 호출소리(퐁~ 띠링!✨)'
 * - 기존 재생 중인 호출소리가 있으면 즉시 멈추고 처음부터 재생하여 중첩을 원천 차단합니다.
 */
export function playMenuSummonSound(): void {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
  try {
    if (activeSummonAudio) {
      activeSummonAudio.pause();
      activeSummonAudio.currentTime = 0;
    } else {
      activeSummonAudio = new Audio(SUMMON_SOUND_URL);
      activeSummonAudio.preload = 'auto';
    }
    activeSummonAudio.volume = 0.25;
    void activeSummonAudio.play().catch(() => {
      playFallbackWebAudio();
    });
  } catch {
    playFallbackWebAudio();
  }
}
