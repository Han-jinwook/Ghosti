/**
 * ❖ 범용 멀린 Z-코어 (Universal Merlin Z-Core - Port 5199) 웹 브릿지 & 실행 게이트 관리자
 * - 센스톡(SenseTalk)과 동일한 정공법 표준:
 *   1. 로컬 127.0.0.1:5199/__merlin/health 헬스체크 및 자동 감지
 *   2. 웹 환경에서 로컬 파일(사진/문서/포렌식/휴지통) 내용검색 엔드포인트 URL 라우팅
 *   3. 미로그인 또는 Z-코어 미연결 시:
 *      - Step 1: 이메일 6자리 OTP 로그인 모달 오픈 (`openLoginModal`)
 *      - Step 2: 멀린 Z-코어(PC) / 기기 연동 가이드 모달 오픈 (`openZCoreGuideModal`)
 */

export const Z_CORE_PORT = 5199;
export const Z_CORE_ORIGIN = `http://127.0.0.1:${Z_CORE_PORT}`;
export const Z_CORE_ZIP_URL = 'https://github.com/Han-jinwook/Ghosti/releases/download/z-core-latest/Merlin_Z_Core.zip';
/** 현재 배포 중인 최신 Z-코어 버전 (Merlin_Z_Core.zip 안의 Merlin_Z_Core_Setup.exe 버전과 반드시 일치시킬 것 — 불일치 시 self-update 루프 발생) */
export const LATEST_Z_CORE_VERSION = '2.13.99';

/**
 * 현재 브라우저 세션이 로그인된 실사용자인지, 아니면 비로그인(크롬 게스트 모드 / 시크릿 창 / 첫 방문자)인지 판별합니다.
 * - 비로그인 게스트 상태에서는 백그라운드에서 `http://127.0.0.1:5199`로 요청을 보내지 않아야
 *   Chrome 142+ 로컬 네트워크 액세스(LNA: "이 기기의 다른 앱 및 서비스에 액세스") 권한 팝업이 뜨지 않습니다!
 */
function isMobileBrowserRuntime(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  if (/Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1) return true;
  return false;
}

export function hasActiveGhostiLoginSession(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('ghostSearchWindow')) {
    return true;
  }
  try {
    const isLoggedOut =
      localStorage.getItem('merlin_logged_out') === '1' ||
      sessionStorage.getItem('merlin_logged_out') === '1';
    const logoutLockUntil = Number(localStorage.getItem('ghosti_pending_logout_lock_until') || 0);
    const hasActiveLogoutLock = logoutLockUntil > 0 && Date.now() <= logoutLockUntil;
    if (hasActiveLogoutLock || isLoggedOut) {
      return false;
    }
    const hubToken = (localStorage.getItem('merlin_session_token') || '').trim();
    const hubEmail = (localStorage.getItem('ghosti_hub_user_email') || '').trim();
    const hasHubLogin = Boolean((hubToken && hubToken.includes('.')) || hubEmail);
    // [비로그인 공유방 초대 링크 열람 격리]:
    // 비로그인 상태에서 가족·동호회·동창회 초대 링크(?invite= / ?inviteToken= / ?preview=guest)로 접속한 게스트는
    // 이번 세션에서 명시적으로 PC 연결에 동의(ghosti_one_stop_agreed)하기 전까지 로컬 Z-코어에 자동 연결하지 않습니다.
    const isUnauthedInvitePreview =
      !hasHubLogin &&
      (params.has('invite') ||
        params.has('inviteToken') ||
        params.get('preview') === 'guest' ||
        Boolean(sessionStorage.getItem('ghosti_active_invite_token')));
    if (isUnauthedInvitePreview) {
      return sessionStorage.getItem('ghosti_one_stop_agreed') === '1';
    }
    if (
      sessionStorage.getItem('ghosti_one_stop_agreed') === '1' ||
      localStorage.getItem('ghosti_secretary_engine_agreed') === '1'
    ) {
      return true;
    }
    if (hasHubLogin) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** 연결된 Z-코어가 최신 배포 버전보다 낮은지 판정 (버전 정보가 없으면 구버전으로 간주) */
export function isZCoreOutdated(version: string | null | undefined): boolean {
  if (!version) return true;
  const a = version.split('.').map((n) => parseInt(n, 10) || 0);
  const b = LATEST_Z_CORE_VERSION.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

export interface ZCoreHealthResponse {
  ok: boolean;
  coreName?: string;
  version?: string;
  standardPort?: number;
  autostartEnabled?: boolean;
  builtinPlugins?: Record<string, any>;
  photoDir?: string;
  photoCount?: number;
}

const ZCORE_CONNECTED_SESSION_KEY = 'ghosti_zcore_last_connected_v1';
const ZCORE_VERSION_SESSION_KEY = 'ghosti_zcore_last_version_v1';

class ZCoreBridgeManager {
  private static instance: ZCoreBridgeManager;
  public isConnected: boolean = false;
  public version: string | null = null;
  public photoDir: string | null = null;
  public photoCount: number = 0;
  private listeners: Set<(connected: boolean) => void> = new Set();
  private pollTimer: any = null;
  private selfUpdateRequested: boolean = false;
  private selfUpdateCooldownUntil: number = 0;
  private selfUpdateGraceUntil: number = 0;
  private consecutiveFailures: number = 0;

  private constructor() {
    if (typeof window !== 'undefined') {
      try {
        const parentBridge =
          window.parent && window.parent !== window
            ? (window.parent as any).__GHOSTI_ZCORE_BRIDGE__
            : null;
        if (parentBridge?.isConnected) {
          this.isConnected = true;
          this.version = parentBridge.version || LATEST_Z_CORE_VERSION;
        } else if (
          !isMobileBrowserRuntime() &&
          hasActiveGhostiLoginSession() &&
          sessionStorage.getItem(ZCORE_CONNECTED_SESSION_KEY) === '1'
        ) {
          this.isConnected = true;
          this.version = sessionStorage.getItem(ZCORE_VERSION_SESSION_KEY) || LATEST_Z_CORE_VERSION;
        }
        (window as any).__GHOSTI_ZCORE_BRIDGE__ = this;
      } catch {
        /* ignore cross-origin */
      }
      this.startHealthPolling();
    }
  }

  public static getInstance(): ZCoreBridgeManager {
    if (!ZCoreBridgeManager.instance) {
      ZCoreBridgeManager.instance = new ZCoreBridgeManager();
    }
    return ZCoreBridgeManager.instance;
  }

  public subscribe(cb: (connected: boolean) => void): () => void {
    this.listeners.add(cb);
    cb(this.isConnected);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb(this.isConnected);
      } catch (err) {
        console.error('[ZCoreBridge] listener error:', err);
      }
    });
  }

  /**
   * [3초 무소음 자동 업데이트 (Silent Self-Update)]
   * - 최초 1회 설치 이후 버전업이 감지되면 유저에게 다운로드/압축해제 창을 띄우지 않고,
   *   백그라운드에서 로컬 데몬(`/__merlin/self-update`)에 자가 교체(`updater.bat` 스왑)를 지시합니다.
   */
  public async triggerSilentSelfUpdate(): Promise<void> {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    if (this.selfUpdateRequested || now < this.selfUpdateCooldownUntil) return;
    this.selfUpdateRequested = true;
    // 개발 중 ZIP 버전 타이밍 어긋남으로 인한 무한 재시작 방지 (15분 쿨다운) + 재시작 구간(30초) 동안 미연결 팝업 차단 유예
    this.selfUpdateCooldownUntil = now + 15 * 60 * 1000;
    this.selfUpdateGraceUntil = now + 30 * 1000;
    try {
      const originUrl = Z_CORE_ZIP_URL.startsWith('http')
        ? Z_CORE_ZIP_URL
        : window.location.origin.startsWith('http')
        ? `${window.location.origin}${Z_CORE_ZIP_URL}`
        : `https://ghosti.sundreamer.app${Z_CORE_ZIP_URL}`;
      await fetch(`${Z_CORE_ORIGIN}/__merlin/self-update`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetVersion: LATEST_Z_CORE_VERSION,
          downloadUrl: originUrl,
        }),
      });
    } catch {
      /* 구버전 데몬이거나 네트워크 일시 오류 시 조용히 무시 (유저 작업 방해 금지) */
    }
  }

  public async checkHealth(forceProbe: boolean = false): Promise<boolean> {
    if (isMobileBrowserRuntime()) {
      if (this.isConnected) {
        this.isConnected = false;
        this.notify();
      }
      return false;
    }
    if (!forceProbe && !hasActiveGhostiLoginSession()) {
      if (this.isConnected) {
        this.isConnected = false;
        this.notify();
        window.dispatchEvent(new CustomEvent('zCoreDisconnected'));
      }
      return false;
    }

    const markConnected = (data: Partial<ZCoreHealthResponse>) => {
      this.consecutiveFailures = 0;
      const wasConnected = this.isConnected;
      const prevVersion = this.version;
      this.isConnected = true;
      this.version = data.version !== undefined ? (data.version || null) : (this.version ?? null);
      try {
        sessionStorage.setItem('ghosti_one_stop_agreed', '1');
        sessionStorage.setItem(ZCORE_CONNECTED_SESSION_KEY, '1');
        if (this.version) {
          sessionStorage.setItem(ZCORE_VERSION_SESSION_KEY, this.version);
        }
      } catch {
        /* ignore storage error */
      }
      if (isZCoreOutdated(this.version)) {
        void this.triggerSilentSelfUpdate();
      } else {
        this.selfUpdateRequested = false;
      }
      if (!wasConnected) {
        this.notify();
        window.dispatchEvent(
          new CustomEvent('zCoreConnected', { detail: { ok: true, ...data } })
        );
      } else if (prevVersion !== this.version) {
        this.notify();
      }
      return true;
    };

    for (const healthUrl of [
      `${Z_CORE_ORIGIN}/__merlin/health`,
      `http://localhost:${Z_CORE_PORT}/__merlin/health`,
    ]) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(healthUrl, {
          method: 'GET',
          mode: 'cors',
          cache: 'no-store',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data: ZCoreHealthResponse = await res.json();
          if (data.ok) {
            return markConnected(data);
          }
        }
      } catch {
        /* fallback below */
      }
    }

    // [보조 데몬/구버전 포트 폴백]: 5199의 /api/superpower/status가 살아있으면 이미 Z-코어가 실행 중인 상태로 즉시 인정 (중복 다운로드 원천 방지)
    for (const fallbackUrl of [
      `${Z_CORE_ORIGIN}/api/superpower/status`,
      `http://localhost:${Z_CORE_PORT}/api/superpower/status`,
    ]) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(fallbackUrl, {
          method: 'GET',
          mode: 'cors',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data && (data.ok || data.engine_running)) {
            return markConnected({
              version: typeof data.version === 'string' && data.version.trim() ? data.version.trim() : undefined,
            });
          }
        }
      } catch {
        /* ignore */
      }
    }

    // 자동 업데이트(self-update) 재시작 유예 구간(30초) 동안은 일시 끊김을 미연결로 오판해 다운로드 팝업을 띄우지 않음
    if (this.isConnected && Date.now() < this.selfUpdateGraceUntil) {
      return true;
    }

    this.consecutiveFailures += 1;
    // CPU 과부하 시 일시적 지연으로 연결/해제가 깜빡이며 토스트가 반복되는 현상 방어: 3회 연속 실패 시에만 해제 판정
    if (this.isConnected && this.consecutiveFailures >= 3) {
      this.isConnected = false;
      try {
        sessionStorage.removeItem(ZCORE_CONNECTED_SESSION_KEY);
      } catch {
        /* ignore */
      }
      this.notify();
      window.dispatchEvent(new CustomEvent('zCoreDisconnected'));
    }
    return this.isConnected;
  }

  public startHealthPolling(intervalMs: number = 3000) {
    if (this.pollTimer) clearInterval(this.pollTimer);
    void this.checkHealth();
    this.pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void this.checkHealth();
    }, intervalMs);
    if (typeof window !== 'undefined' && !(this as any)._visBound) {
      (this as any)._visBound = true;
      const onWake = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        void this.checkHealth();
      };
      document.addEventListener('visibilitychange', onWake, { passive: true });
      window.addEventListener('focus', onWake, { passive: true });
    }
  }

  public stopHealthPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  public disconnectForLogout() {
    this.consecutiveFailures = 0;
    this.selfUpdateRequested = false;
    try {
      sessionStorage.removeItem('ghosti_one_stop_agreed');
      localStorage.removeItem('ghosti_secretary_engine_agreed');
    } catch {
      /* ignore */
    }
    if (this.isConnected) {
      this.isConnected = false;
      this.notify();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('zCoreDisconnected'));
      }
    }
  }
}

export const zCoreBridge = ZCoreBridgeManager.getInstance();

/**
 * [귀신같이 기본 실행 게이트 (Fundamental Execution Gate)]
 * - 개인 라운지(귀신비서·귀신검색)의 모든 실제 실행 액션은
 *   ① 이메일 로그인 완료(`merlin_session_token` 보유) +
 *   ② 로컬 Z-코어(`127.0.0.1:5199`) 또는 모바일 네이티브 환경 가동이 완료된 후에만 실행됩니다.
 * - `/?dev=true`로 접속한 개발자 PC/폰에서도 이 순차 온보딩(로그인 ➔ 코어 실행) 원칙을 동일하게 점검·안내합니다.
 */
/**
 * [내 컴퓨터 1초 연결하기 요청 헬퍼]
 * - 비로그인(게스트) 상태라면 `ghosti_pending_zcore_connect = '1'` 세팅 후 이메일 로그인 모달(`openLoginModal`)을 먼저 오픈하고,
 *   로그인 성공 즉시 자동으로 Z-코어 연결 모달(`openZCoreGuideModal`)로 물 흐르듯 바톤터치합니다.
 * - 이미 로그인된 상태라면 즉시 Z-코어 연결 모달(`openZCoreGuideModal`)을 오픈합니다.
 */
function isCurrentlyInSecretaryTab(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const liveRoute = (window as any).__GHOSTI_ACTIVE_ROUTE__;
    if (liveRoute && liveRoute.lounge && liveRoute.desktopTab) {
      return liveRoute.lounge === 'personal' && liveRoute.desktopTab === 'trash';
    }
    const navState = window.history.state?.ghostiNav;
    if (navState && navState.lounge && navState.desktopTab) {
      return navState.lounge === 'personal' && navState.desktopTab === 'trash';
    }
  } catch {
    /* ignore */
  }
  const params = new URLSearchParams(window.location.search);
  const urlLounge = params.get('lounge') || 'personal';
  const urlTab = params.get('tab') || 'trash';
  return urlLounge === 'personal' && urlTab === 'trash';
}

export function requestConnectMyComputer(): void {
  if (typeof window === 'undefined') return;

  // 가상 모니터(iframe) 내부에서 호출된 경우 상위 창으로 이벤트를 위임하여 모달이 작은 창에 갇히거나 중복 다운로드를 유발하지 않게 함
  try {
    if (window.top && window.top !== window.self) {
      const topReq = (window.top as any).__GHOSTI_REQUEST_CONNECT_MY_COMPUTER__;
      if (typeof topReq === 'function') {
        topReq();
        return;
      }
    }
    (window as any).__GHOSTI_REQUEST_CONNECT_MY_COMPUTER__ = requestConnectMyComputer;
  } catch {
    /* ignore */
  }

  const isMobileViewportOrUA =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    window.innerWidth < 860;

  if (!isMobileViewportOrUA && !zCoreBridge.isConnected) {
    if (!isCurrentlyInSecretaryTab()) {
      window.dispatchEvent(
        new CustomEvent('openGhostSecretaryFirstModal', { detail: { context: 'default' } })
      );
      return;
    }
  }

  // 이미 Z-코어가 실행 중이면 즉시 헬스체크 후 연결 완료 처리, 미실행 시 귀신비서 인라인 안내로 이동
  void zCoreBridge.checkHealth(true).then((alive) => {
    if (alive) {
      try {
        sessionStorage.setItem('ghosti_one_stop_agreed', '1');
        localStorage.setItem('ghosti_secretary_engine_agreed', '1');
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent('zCoreConnected', { detail: { ok: true } }));
      return;
    }
    window.dispatchEvent(new CustomEvent('ghosti_jump_to_secretary'));
  });
}

/**
 * [귀신같이 기본 실행 게이트 (Fundamental Execution Gate)]
 * - PC 로컬 파일 액션은 『1. 👻 귀신비서』와의 문답을 통해 로컬 Z-코어(`127.0.0.1:5199`)가 연결된 후에만 실행됩니다.
 */
export function ensureLoginAndZCoreReady(_actionName = '실행'): boolean {
  if (typeof window === 'undefined') return true;

  const isMobileViewportOrUA =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    window.innerWidth < 860;
  const isCapacitorNative = Boolean(
    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
  );

  if (!isMobileViewportOrUA && !isCapacitorNative) {
    // 이미 Z-코어가 설치·실행되어 있으면 버전과 무관하게 0.1초 무소음 통과 (버전업은 백그라운드 Silent Self-Update로 자동 처리)
    if (zCoreBridge.isConnected) {
      if (isZCoreOutdated(zCoreBridge.version)) {
        void zCoreBridge.triggerSilentSelfUpdate();
      }
      return true;
    }
    if (!isCurrentlyInSecretaryTab()) {
      window.dispatchEvent(
        new CustomEvent('openGhostSecretaryFirstModal', { detail: { context: 'default' } })
      );
      return false;
    }
    // 귀신비서 안에서는 로그인·동의된 세션일 때만 조용히 헬스체크 재확인 수행 (비로그인·미동의 게스트 자동 연결 차단)
    if (hasActiveGhostiLoginSession()) {
      void zCoreBridge.checkHealth(false);
    }
    return false;
  }

  return true;
}

/**
 * [로컬 Z-코어 URL 라우팅 헬퍼]
 * - 브라우저 웹(`ghosti.sundreamer.app` 등)이거나 로컬 개발 시 5199 포트로 직결 연결합니다.
 */
export function getZCoreUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // 웹 배포(Netlify) 상태에서는 무조건 로컬 데몬 5199로 라우팅
  if (typeof window !== 'undefined') {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    if (!isLocalhost) {
      return `${Z_CORE_ORIGIN}${cleanPath}`;
    }
  }

  // 로컬 개발 환경(localhost)에서도 모든 Z-코어 데몬 엔드포인트는 5199 단일 포트 직결
  if (
    cleanPath.startsWith('/__merlin/') ||
    cleanPath.startsWith('/__setup-monster/') ||
    cleanPath.startsWith('/__photos/') ||
    cleanPath.startsWith('/__videos/') ||
    cleanPath.startsWith('/__docs/') ||
    cleanPath.startsWith('/__faces/') ||
    cleanPath.startsWith('/__search/') ||
    cleanPath.startsWith('/__quarantine/') ||
    cleanPath.startsWith('/__zcore/') ||
    cleanPath.startsWith('/__sync/') ||
    cleanPath.startsWith('/__work/') ||
    cleanPath.startsWith('/api/sync/') ||
    cleanPath.startsWith('/api/work/') ||
    cleanPath.startsWith('/api/ghosti/') ||
    cleanPath.startsWith('/api/care/') ||
    cleanPath.startsWith('/api/superpower/') ||
    cleanPath.startsWith('/api/teleport/') ||
    cleanPath.startsWith('/api/senstalk/') ||
    cleanPath.startsWith('/api/aggrofilter/')
  ) {
    return `${Z_CORE_ORIGIN}${cleanPath}`;
  }

  return cleanPath;
}
