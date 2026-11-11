/**
 * 👻 귀신같이(Ghosti) 아기귀신 시그니처 사운드 엔진 (SSOT 44.1kHz WAV + 70ms 무음 프리롤)
 * - 웹 페이지에 진입(최초 방문 및 새로고침 포함)할 때마다 딱 1회만 애기귀신 웃음소리 재생 (sample3_baby_ghost_giggle.wav)
 * - 진입 후 상단/사이드바 로고를 클릭하거나 메뉴를 눌러도 중복 효과음이 절대 나지 않음
 */

const GIGGLE_SOUND_URL = '/sounds/baby_ghost/sample3_baby_ghost_giggle.wav';

let preloadedGiggleAudio: HTMLAudioElement | null = null;
let hasPlayedAppEnterGiggle = false;
let isAttemptingGiggle = false;
let unlockListenerBound = false;

function isLogoClickEvent(evt: Event): boolean {
  const target = evt.target as HTMLElement | null;
  if (!target || typeof target.closest !== 'function') return false;
  return Boolean(target.closest('[data-ghosti-brand-logo="true"]'));
}

function ensurePreloaded(): void {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
  if (!preloadedGiggleAudio) {
    preloadedGiggleAudio = new Audio(GIGGLE_SOUND_URL);
    preloadedGiggleAudio.preload = 'auto';
    preloadedGiggleAudio.volume = 0.20;
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
 * 👻 웹/앱 처음 들어갈 때 딱 1회만 재생되는 '애기귀신 웃음소리' (sample3_baby_ghost_giggle.wav)
 * - 페이지 로드(새로고침 포함) 시 즉시 재생하며, 이미 열린 페이지 안에서는 StrictMode 이중 마운트 및 로고 클릭 등 어떤 동작에서도 중복 재생되지 않습니다.
 * - 만약 새 탭 직접 URL 입력 등으로 브라우저 Autoplay Policy가 첫 자동재생을 보류한 경우에는
 *   로고 클릭을 제외한 첫 일반 클릭/키 입력 순간에 1회만 재생하고 즉시 해제합니다 (로고를 눌렀을 때 소리가 나는 오해 100% 방지).
 */
export function playAppEnterGiggleSound(_forceReplay = false): void {
  if (typeof window === 'undefined') return;
  if (hasPlayedAppEnterGiggle || isAttemptingGiggle) return;

  // 팝업 귀신검색창(Ctrl+0 소형창)에서는 별도 소환음이 있으므로 중복 재생 제외
  if (
    window.location.search.includes('ghostSearchWindow=') ||
    window.location.search.includes('tab=search_dojo')
  ) {
    hasPlayedAppEnterGiggle = true;
    return;
  }

  isAttemptingGiggle = true;
  ensurePreloaded();

  try {
    const audio = preloadedGiggleAudio || new Audio(GIGGLE_SOUND_URL);
    audio.volume = 0.20;
    audio.currentTime = 0;
    const p = audio.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        hasPlayedAppEnterGiggle = true;
        isAttemptingGiggle = false;
      }).catch(() => {
        isAttemptingGiggle = false;
        if (!unlockListenerBound) {
          unlockListenerBound = true;
          const cleanupUnlock = () => {
            window.removeEventListener('pointerdown', onFirstInteract, true);
            window.removeEventListener('keydown', onFirstInteract, true);
          };
          const onFirstInteract = (evt: Event) => {
            // 로고 클릭 시에는 절대 효과음을 내보내지 않고 입장 효과음 대기 상태도 즉시 종료
            if (isLogoClickEvent(evt)) {
              hasPlayedAppEnterGiggle = true;
              cleanupUnlock();
              return;
            }
            cleanupUnlock();
            if (!hasPlayedAppEnterGiggle) {
              hasPlayedAppEnterGiggle = true;
              const retryAudio = preloadedGiggleAudio || new Audio(GIGGLE_SOUND_URL);
              retryAudio.volume = 0.20;
              retryAudio.currentTime = 0;
              retryAudio.play().catch(() => playFallbackWebAudio());
            }
          };
          window.addEventListener('pointerdown', onFirstInteract, true);
          window.addEventListener('keydown', onFirstInteract, true);
        }
      });
    } else {
      hasPlayedAppEnterGiggle = true;
      isAttemptingGiggle = false;
    }
  } catch {
    hasPlayedAppEnterGiggle = true;
    isAttemptingGiggle = false;
    playFallbackWebAudio();
  }
}

export function silencePendingEnterGiggleOnLogoClick(): void {
  hasPlayedAppEnterGiggle = true;
}

/**
 * ✨ 좌측 메인/서브메뉴 및 상단 탭 클릭 시 재생되던 '애기귀신 호출소리(퐁~ 띠링!✨)'
 * - 메뉴 클릭 시 반복되는 음향 피로도를 줄이기 위해 완전 무음(No-Op) 처리
 * - (입장 시 1회 시그니처 웃음소리 playAppEnterGiggleSound만 유지)
 */
export function playMenuSummonSound(): void {
  // 사용자 피로도 방지를 위해 메뉴 클릭 효과음 제거 (무음 처리)
}
