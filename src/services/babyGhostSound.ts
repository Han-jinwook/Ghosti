/**
 * 👻 귀신같이(Ghosti) 아기귀신 시그니처 사운드 엔진 (SSOT 44.1kHz WAV + 70ms 무음 프리롤)
 * - 웹 페이지에 진입(최초 방문 및 새로고침 포함)할 때마다 딱 1회만 애기귀신 웃음소리 재생 (sample3_baby_ghost_giggle.wav)
 * - 진입 후 상단/사이드바 로고를 클릭하거나 메뉴를 눌러도 중복 효과음이 절대 나지 않음
 */

const GIGGLE_SOUND_URL = '/sounds/baby_ghost/sample3_baby_ghost_giggle.wav';
const Z_CORE_GIGGLE_URL = 'http://127.0.0.1:5199/__merlin/play-enter-giggle';

let preloadedGiggleAudio: HTMLAudioElement | null = null;
let hasPlayedAppEnterGiggle = false;
let isAttemptingGiggle = false;
let unlockListenerBound = false;
let cleanupUnlockListeners: (() => void) | null = null;

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

async function tryPlayViaLocalZCore(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return false;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? window.setTimeout(() => controller.abort(), 650) : null;
  try {
    const res = await fetch(Z_CORE_GIGGLE_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume: 0.25 }),
      signal: controller?.signal,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean; played?: boolean; reason?: string };
    // 데몬에서 음소거(muted)로 설정해 둔 경우에도 입장 사운드 처리를 완료한 것으로 간주하여 중복 재생 방지
    return Boolean(data?.ok && (data.played || data.reason === 'muted'));
  } catch {
    return false;
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
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

function bindFirstGestureUnlock(): void {
  if (typeof window === 'undefined' || unlockListenerBound || hasPlayedAppEnterGiggle) return;
  unlockListenerBound = true;

  const events: Array<keyof WindowEventMap> = [
    'pointerdown',
    'mousedown',
    'touchstart',
    'keydown',
  ];

  const cleanup = () => {
    events.forEach((ev) => window.removeEventListener(ev, onFirstInteract, true));
    unlockListenerBound = false;
    cleanupUnlockListeners = null;
  };
  cleanupUnlockListeners = cleanup;

  const onFirstInteract = (evt: Event) => {
    // 로고 클릭 시에는 절대 효과음을 내보내지 않고 입장 효과음 대기 상태도 즉시 종료
    if (isLogoClickEvent(evt)) {
      hasPlayedAppEnterGiggle = true;
      cleanup();
      return;
    }
    cleanup();
    if (!hasPlayedAppEnterGiggle) {
      hasPlayedAppEnterGiggle = true;
      const retryAudio = preloadedGiggleAudio || new Audio(GIGGLE_SOUND_URL);
      retryAudio.volume = 0.20;
      retryAudio.currentTime = 0;
      retryAudio.play().catch(() => playFallbackWebAudio());
    }
  };

  events.forEach((ev) => window.addEventListener(ev, onFirstInteract, true));
}

/**
 * 👻 웹/앱 처음 들어갈 때 딱 1회만 재생되는 '애기귀신 웃음소리' (sample3_baby_ghost_giggle.wav)
 * - 로그인 상태뿐 아니라 크롬 게스트 모드 / 시크릿 창 / 온보딩 쇼룸 / 본진 워크스페이스 등 모든 웹 진입에서 동일하게 작동합니다.
 * - 1순위: 브라우저 HTMLAudioElement 즉시 재생
 * - 2순위: 크롬 게스트 모드(MEI=0) 등으로 브라우저 자동재생이 차단되면, 로컬 Z-코어(127.0.0.1:5199) 경유로 무클릭 즉시 1회 재생
 * - 3순위: Z-코어 미설치 환경(모바일/외부 PC)에서는 로고 클릭을 제외한 첫 터치/클릭/키 입력 순간에 1회 재생 후 완전 종료
 */
export function playAppEnterGiggleSound(forceOnModeTransition = false): void {
  if (typeof window === 'undefined') return;
  if (forceOnModeTransition) {
    // 쇼룸 대문에서 [본 앱 바로 시작하기] 등으로 게스트 워크스페이스에 진입할 때 아직 재생되지 않았다면 즉시 재생 보장
    if (hasPlayedAppEnterGiggle) return;
  } else if (hasPlayedAppEnterGiggle || isAttemptingGiggle) {
    return;
  }

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
        cleanupUnlockListeners?.();
      }).catch(() => {
        // 크롬 게스트 모드 / 시크릿 창 등 MEI=0 환경에서 브라우저가 무클릭 자동재생을 막은 경우:
        // 1) 로컬 Z-코어(5199)가 켜져 있으면 클릭 없이도 즉시 아기귀신 효과음 재생!
        // 2) Z-코어가 없는 기기라면 첫 사용자 제스처(로고 제외)에서 1회 재생되도록 동시에 대기 등록
        bindFirstGestureUnlock();
        void tryPlayViaLocalZCore().then((playedViaZCore) => {
          isAttemptingGiggle = false;
          if (playedViaZCore && !hasPlayedAppEnterGiggle) {
            hasPlayedAppEnterGiggle = true;
            cleanupUnlockListeners?.();
          }
        });
      });
    } else {
      hasPlayedAppEnterGiggle = true;
      isAttemptingGiggle = false;
      cleanupUnlockListeners?.();
    }
  } catch {
    isAttemptingGiggle = false;
    bindFirstGestureUnlock();
    void tryPlayViaLocalZCore().then((playedViaZCore) => {
      if (playedViaZCore && !hasPlayedAppEnterGiggle) {
        hasPlayedAppEnterGiggle = true;
        cleanupUnlockListeners?.();
      }
    });
  }
}

export function silencePendingEnterGiggleOnLogoClick(): void {
  hasPlayedAppEnterGiggle = true;
  cleanupUnlockListeners?.();
}

/**
 * ✨ 좌측 메인/서브메뉴 및 상단 탭 클릭 시 재생되던 '애기귀신 호출소리(퐁~ 띠링!✨)'
 * - 메뉴 클릭 시 반복되는 음향 피로도를 줄이기 위해 완전 무음(No-Op) 처리
 * - (입장 시 1회 시그니처 웃음소리 playAppEnterGiggleSound만 유지)
 */
export function playMenuSummonSound(): void {
  // 사용자 피로도 방지를 위해 메뉴 클릭 효과음 제거 (무음 처리)
}
