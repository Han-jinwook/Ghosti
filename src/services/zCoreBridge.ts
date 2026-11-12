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
export const Z_CORE_ZIP_URL = '/Merlin_Z_Core.zip';
/** 현재 배포 중인 최신 Z-코어 버전 (Merlin_Z_Core.zip 안의 exe 버전과 반드시 일치시킬 것) */
export const LATEST_Z_CORE_VERSION = '2.3.5';

/**
 * 현재 브라우저 세션이 로그인된 실사용자인지, 아니면 비로그인(크롬 게스트 모드 / 시크릿 창 / 첫 방문자)인지 판별합니다.
 * - 비로그인 게스트 상태에서는 백그라운드에서 `http://127.0.0.1:5199`로 요청을 보내지 않아야
 *   Chrome 142+ 로컬 네트워크 액세스(LNA: "이 기기의 다른 앱 및 서비스에 액세스") 권한 팝업이 뜨지 않습니다!
 */
export function hasActiveGhostiLoginSession(): boolean {
  if (typeof window === 'undefined') return false;
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    return true;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get('ghostSearchWindow')) {
    return true;
  }
  try {
    return Boolean(
      localStorage.getItem('merlin_session_token') ||
        localStorage.getItem('ghosti_prelaunch_verified_email') ||
        localStorage.getItem('userEmail')
    );
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

class ZCoreBridgeManager {
  private static instance: ZCoreBridgeManager;
  public isConnected: boolean = false;
  public version: string | null = null;
  public photoDir: string | null = null;
  public photoCount: number = 0;
  private listeners: Set<(connected: boolean) => void> = new Set();
  private pollTimer: any = null;
  private selfUpdateRequested: boolean = false;
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
    if (this.selfUpdateRequested || typeof window === 'undefined') return;
    this.selfUpdateRequested = true;
    try {
      const originUrl = window.location.origin.startsWith('http')
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
      this.version = data.version || this.version || LATEST_Z_CORE_VERSION;
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

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${Z_CORE_ORIGIN}/__merlin/health`, {
        method: 'GET',
        mode: 'cors',
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

    // [보조 데몬/구버전 포트 폴백]: 5199 또는 51988의 /api/superpower/status가 살아있으면 이미 Z-코어가 실행 중인 상태로 즉시 인정 (중복 다운로드 원천 방지)
    for (const fallbackUrl of [
      `${Z_CORE_ORIGIN}/api/superpower/status`,
      'http://127.0.0.1:51988/api/superpower/status',
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
            return markConnected({ version: LATEST_Z_CORE_VERSION });
          }
        }
      } catch {
        /* ignore */
      }
    }

    this.consecutiveFailures += 1;
    // CPU 과부하 시 일시적 지연으로 연결/해제가 깜빡이며 토스트가 반복되는 현상 방어: 3회 연속 실패 시에만 해제 판정
    if (this.isConnected && this.consecutiveFailures >= 3) {
      this.isConnected = false;
      this.notify();
      window.dispatchEvent(new CustomEvent('zCoreDisconnected'));
    }
    return this.isConnected;
  }

  public startHealthPolling(intervalMs: number = 3000) {
    if (this.pollTimer) clearInterval(this.pollTimer);
    void this.checkHealth();
    this.pollTimer = setInterval(() => {
      void this.checkHealth();
    }, intervalMs);
  }

  public stopHealthPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

export const zCoreBridge = ZCoreBridgeManager.getInstance();

/**
 * [귀신같이 기본 실행 게이트 (Fundamental Execution Gate)]
 * - 개인 라운지(찾기·치우기·고치기)의 모든 실제 실행 액션은
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

  const hasLoginToken = Boolean(
    localStorage.getItem('merlin_session_token') ||
      localStorage.getItem('ghosti_prelaunch_verified_email') ||
      localStorage.getItem('userEmail')
  );

  if (!hasLoginToken) {
    try {
      sessionStorage.setItem('ghosti_pending_zcore_connect', '1');
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent('openLoginModal'));
    return;
  }

  // 이미 Z-코어가 실행 중이면 다운로드 안내 대신 즉시 헬스체크 후 연결 완료 처리
  void zCoreBridge.checkHealth(true).then((alive) => {
    if (alive) {
      window.dispatchEvent(new CustomEvent('zCoreConnected', { detail: { ok: true } }));
      return;
    }
    window.dispatchEvent(new CustomEvent('openZCoreGuideModal'));
  });
}

/**
 * [귀신같이 기본 실행 게이트 (Fundamental Execution Gate)]
 * - 개인 라운지(찾기·치우기·고치기)의 모든 실제 내 기기 파일 액션은
 *   ① 이메일 로그인 완료(`merlin_session_token` 보유) +
 *   ② 로컬 Z-코어(`127.0.0.1:5199`) 또는 모바일 네이티브 환경 가동이 완료된 후에만 실행됩니다.
 * - 비로그인 게스트가 내 기기 실물 액션을 클릭한 순간: `ghosti_pending_zcore_connect = '1'` 플래그를 세팅하고
 *   `openLoginModal`을 먼저 띄워 로그인 직후 Z-코어 연결까지 자동 바톤터치합니다.
 */
export function ensureLoginAndZCoreReady(_actionName = '실행'): boolean {
  if (typeof window === 'undefined') return true;

  const hasLoginToken = Boolean(
    localStorage.getItem('merlin_session_token') ||
      localStorage.getItem('ghosti_prelaunch_verified_email') ||
      localStorage.getItem('userEmail')
  );

  if (!hasLoginToken) {
    try {
      sessionStorage.setItem('ghosti_pending_zcore_connect', '1');
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent('openLoginModal'));
    return false;
  }

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
    // 아직 헬스체크 전이거나 꺼져 있으면 0.1초 즉시 확인 후 미설치/미실행일 때만 조용히 안내
    void zCoreBridge.checkHealth(true).then((ok) => {
      if (!ok) {
        window.dispatchEvent(new CustomEvent('openZCoreGuideModal'));
      }
    });
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

  // 로컬 개발 환경에서도 사진/문서/포렌식/격리 API는 5199 단일 포트 직결
  if (
    cleanPath.startsWith('/__photos/') ||
    cleanPath.startsWith('/__docs/') ||
    cleanPath.startsWith('/__quarantine/') ||
    cleanPath.startsWith('/__zcore/') ||
    cleanPath.startsWith('/api/ghosti/')
  ) {
    return `${Z_CORE_ORIGIN}${cleanPath}`;
  }

  return cleanPath;
}
