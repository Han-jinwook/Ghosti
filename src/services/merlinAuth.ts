/**
 * Merlin Hub Mock Auth & License Bridge (D-06, D-09)
 *
 * 결제·인증은 최종적으로 '멀린 패밀리 허브(Merlin Family Hub)'가 담당하며,
 * 제트아이(Z-Eye)는 Mock Token 인터페이스로 라이선스 등급(FREE / PRO_LIFETIME)과
 * 상위 Bes2 프로페셔널 에디션 업셀 브릿지만 제공.
 */
import type { MerlinAuthState } from '../types/saysee';

const STORAGE_KEY = 'zeye_merlin_mock_token';

export const DEFAULT_MERLIN_AUTH: MerlinAuthState = {
  token: 'DEMO_PRO_SESSION', // ggignore
  tier: 'PRO_LIFETIME',
  userId: 'merlin-user-01',
  email: 'beakes@sundreamer.app',
  coinBalance: 5200,
  maxFreePhotos: 300,
  hubUrl: 'https://os.sundreamer.app',
  pcMasterUrl: 'https://z-eye.sundreamer.app',
  studioUrl: 'https://studio.sundreamer.app',
};

export function loadMerlinAuth(): MerlinAuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_MERLIN_AUTH, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_MERLIN_AUTH;
}

export function toggleMerlinTier(current: MerlinAuthState): MerlinAuthState {
  const next: MerlinAuthState = {
    ...current,
    tier: current.tier === 'PRO_LIFETIME' ? 'FREE' : 'PRO_LIFETIME',
    token:
      current.tier === 'PRO_LIFETIME'
        ? 'DEMO_FREE_SESSION' // ggignore
        : 'DEMO_PRO_SESSION', // ggignore
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
