/**
 * 👻 귀신같이(Ghosti) 아기귀신 시그니처 사운드 엔진 (SSOT 44.1kHz WAV + 70ms 무음 프리롤)
 * - 웹 페이지에 진입(최초 방문 및 새로고침 포함)할 때마다 딱 1회만 애기귀신 웃음소리 재생 (sample3_baby_ghost_giggle.wav)
 * - 진입 후 상단/사이드바 로고를 클릭하거나 화면 아무 곳이나 마우스를 클릭해도 지연 효과음이 절대 나지 않음
 */

import { hasActiveGhostiLoginSession } from './zCoreBridge';

const GIGGLE_SOUND_URL = '/sounds/baby_ghost/sample3_baby_ghost_giggle.wav';
const Z_CORE_GIGGLE_URL = 'http://127.0.0.1:5199/__merlin/play-enter-giggle';

let preloadedGiggleAudio: HTMLAudioElement | null = null;
let hasPlayedAppEnterGiggle = false;
let isAttemptingGiggle = false;
let titleSignalCleanupTimer: number | null = null;

function ensurePreloaded(): void {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
  if (!preloadedGiggleAudio) {
    preloadedGiggleAudio = new Audio(GIGGLE_SOUND_URL);
    preloadedGiggleAudio.preload = 'auto';
    preloadedGiggleAudio.volume = 0.20;
  }
}

/**
 * 크롬 게스트 모드 / 시크릿 모드 등 MEI=0 환경에서 브라우저 자동재생이 막혔을 때,
 * 로컬 네트워크 권한 팝업(127.0.0.1 LNA)이나 마우스 클릭 대기 없이도
 * OS 데몬(start_ghosti_browser_entry_sound_watcher)이 첫 진입 및 새로고침(F5)을
 * 0.15초 내에 즉시 감지해 효과음을 재생할 수 있도록 무가시 제로폭(Zero-Width) 시그널을
 * document.title 끝에 1.5초간 각인합니다.
 */
function emitOsEntrySoundTitleSignal(): void {
  if (typeof document === 'undefined') return;
  try {
    const baseTitle = document.title.replace(/\u200B\u200C[\u200B\u200C]{8}\u200C\u200B/g, '');
    let bits = '';
    for (let i = 0; i < 8; i += 1) {
      bits += Math.random() < 0.5 ? '\u200B' : '\u200C';
    }
    const marker = `\u200B\u200C${bits}\u200C\u200B`;
    document.title = `${baseTitle}${marker}`;
    if (titleSignalCleanupTimer !== null) {
      window.clearTimeout(titleSignalCleanupTimer);
    }
    titleSignalCleanupTimer = window.setTimeout(() => {
      try {
        document.title = document.title.replace(/\u200B\u200C[\u200B\u200C]{8}\u200C\u200B/g, '');
      } catch {
        // ignore title cleanup errors
      }
      titleSignalCleanupTimer = null;
    }, 1500);
  } catch {
    // ignore title signal errors
  }
}

async function tryPlayViaLocalZCore(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return false;
  // 비로그인(크롬 게스트 모드 / 시크릿 창)에서는 127.0.0.1 요청 시 Chrome LNA 권한 팝업이 뜨므로
  // 웹 fetch를 생략합니다. (설치된 PC에서는 OS 레벨 브라우저 진입 감지기가 무팝업으로 즉시 1회 재생합니다!)
  if (!hasActiveGhostiLoginSession()) return false;
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

/**
 * 👻 웹/앱 처음 들어갈 때(또는 새로고침 시) 딱 1회만 재생되는 '애기귀신 웃음소리' (sample3_baby_ghost_giggle.wav)
 * - 로그인 상태뿐 아니라 크롬 게스트 모드 / 시크릿 창 / 온보딩 쇼룸 / 본진 워크스페이스 등 모든 웹 진입에서 동일하게 작동합니다.
 * - 1순위: 브라우저 HTMLAudioElement 즉시 재생
 * - 2순위: 크롬 게스트 모드(MEI=0) 등으로 브라우저 자동재생이 차단되면, OS 타이틀 시그널 + 로컬 Z-코어(127.0.0.1:5199)로 무클릭 즉시 1회 재생
 * - ⚠️ 입장/새로고침 이후 화면 아무 곳이나 마우스 커서를 클릭할 때 뒷북으로 효과음이 나는 현상을 막기 위해
 *      클릭/포인터 지연 언락 리스너(bindFirstGestureUnlock)는 절대 등록하지 않습니다.
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

  hasPlayedAppEnterGiggle = true;
  isAttemptingGiggle = true;
  ensurePreloaded();

  try {
    const audio = preloadedGiggleAudio || new Audio(GIGGLE_SOUND_URL);
    audio.volume = 0.20;
    audio.currentTime = 0;
    const p = audio.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        isAttemptingGiggle = false;
      }).catch(() => {
        // 크롬 게스트 모드 / 시크릿 창 등 MEI=0 환경에서 브라우저가 무클릭 자동재생을 막은 경우:
        // 1) OS 브라우저 타이틀 감지기용 무가시 제로폭 시그널을 즉시 송출하여 권한 팝업/클릭 없이도 첫 진입 및 새로고침 즉시 재생!
        // 2) 로그인 세션이면 로컬 Z-코어(5199) API도 함께 호출 (데몬 1.2초 디바운스로 중복 재생 원천 차단)
        emitOsEntrySoundTitleSignal();
        void tryPlayViaLocalZCore().finally(() => {
          isAttemptingGiggle = false;
        });
      });
    } else {
      isAttemptingGiggle = false;
    }
  } catch {
    isAttemptingGiggle = false;
    emitOsEntrySoundTitleSignal();
    void tryPlayViaLocalZCore();
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
