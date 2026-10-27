/**
 * ❖ 범용 멀린 Z-코어 (Universal Merlin Z-Core - Port 5199) 웹 브릿지 & 온보딩 관리자
 * - 센스톡(SenseTalk)과 동일한 정공법 표준:
 *   1. 로컬 127.0.0.1:5199/__merlin/health 헬스체크 및 자동 감지
 *   2. 웹 환경에서 로컬 파일(사진/문서/포렌식/휴지통) 내용검색 엔드포인트 URL 라우팅
 *   3. 미연결 시 [Merlin_Z_Core.zip] 다운로드 & 실행 온보딩 가이드 제공
 */

export const Z_CORE_PORT = 5199;
export const Z_CORE_ORIGIN = `http://127.0.0.1:${Z_CORE_PORT}`;
export const Z_CORE_ZIP_URL = '/Merlin_Z_Core.zip';

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

  private constructor() {
    if (typeof window !== 'undefined') {
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

  public async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${Z_CORE_ORIGIN}/__merlin/health`, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data: ZCoreHealthResponse = await res.json();
        if (data.ok) {
          const wasConnected = this.isConnected;
          this.isConnected = true;
          this.version = data.version || '2.1.0';
          if (!wasConnected) {
            this.notify();
            window.dispatchEvent(
              new CustomEvent('zCoreConnected', { detail: data })
            );
          }
          return true;
        }
      }
    } catch {
      /* disconnected or network error */
    }

    if (this.isConnected) {
      this.isConnected = false;
      this.notify();
      window.dispatchEvent(new CustomEvent('zCoreDisconnected'));
    }
    return false;
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
 * [로컬 Z-코어 URL 라우팅 헬퍼]
 * - 브라우저 웹(`z-eye-app.netlify.app` 등)이거나 로컬 개발 시 5199 포트로 직결 연결합니다.
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
    cleanPath.startsWith('/api/zeye/')
  ) {
    return `${Z_CORE_ORIGIN}${cleanPath}`;
  }

  return cleanPath;
}
