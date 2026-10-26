/**
 * Version: v2.19.1
 * Last Updated: 2026-10-27
 * Merlin Hub SDK — Configuration
 * 싱글턴 패턴: 한 번 초기화 후 전역에서 재사용 (Vite/Next.js 브라우저 환경 process 미정의 크래시 원천 방어)
 */

export interface MerlinHubConfig {
  hubUrl: string;
  clientId: string;
  clientSecret: string;
  appId?: string;
}

function safeEnv(key: string): string | undefined {
  try {
    if (typeof process !== 'undefined' && process && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (_) {}
  try {
    const metaEnv = (import.meta as any)?.env;
    if (metaEnv && metaEnv[key]) {
      return metaEnv[key];
    }
  } catch (_) {}
  return undefined;
}

const DEFAULT_CONFIG: MerlinHubConfig = {
  hubUrl: safeEnv('NEXT_PUBLIC_MERLIN_HUB_URL') || safeEnv('VITE_MERLIN_HUB_URL') || 'https://os.sundreamer.app',
  clientId: safeEnv('MERLIN_HUB_CLIENT_ID') || safeEnv('NEXT_PUBLIC_MERLIN_CLIENT_ID') || safeEnv('VITE_MERLIN_CLIENT_ID') || 'APP-01',
  clientSecret: safeEnv('MERLIN_HUB_CLIENT_SECRET') || safeEnv('NEXT_PUBLIC_MERLIN_CLIENT_SECRET') || safeEnv('VITE_MERLIN_CLIENT_SECRET') || 'merlin-family-secret-key-2026',
};

let _config: MerlinHubConfig = { ...DEFAULT_CONFIG };

export function configureMerlinHub(overrides: Partial<MerlinHubConfig>) {
  _config = { ..._config, ...overrides };
}

export function getConfig(): Readonly<MerlinHubConfig> {
  return _config;
}
