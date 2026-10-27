/**
 * Merlin Hub SSO Auth & Wallet Bridge (v2.17.0)
 *
 * 결제·인증은 '멀린 패밀리 허브(Merlin Family Hub, os.sundreamer.app)'가 단일 SSOT로 담당하며,
 * 비로그인(게스트) 상태에서는 코인 오표시를 방지하기 위해 0 코인으로 초기화합니다.
 */
import type { MerlinAuthState } from '../types/saysee';

const STORAGE_KEY = 'ghosti_merlin_mock_token';

export const DEFAULT_MERLIN_AUTH: MerlinAuthState = {
  token: '',
  tier: 'FREE',
  userId: 'guest',
  email: '',
  coinBalance: 0,
  maxFreePhotos: 300,
  hubUrl: 'https://os.sundreamer.app',
  pcMasterUrl: 'https://ghosti.sundreamer.app',
  studioUrl: 'https://studio.sundreamer.app',
};

export function loadMerlinAuth(): MerlinAuthState {
  try {
    if (typeof window === 'undefined') return DEFAULT_MERLIN_AUTH;
    const hubToken = localStorage.getItem('merlin_session_token');
    const hubEmail = localStorage.getItem('userEmail') || '';
    const hubUserId = localStorage.getItem('ghosti_hub_user_id') || '';

    // 비로그인 게스트 상태에서는 과거 캐시로 인한 코인 오염을 차단하고 0 코인 고정
    if (!hubToken) {
      return DEFAULT_MERLIN_AUTH;
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      ...DEFAULT_MERLIN_AUTH,
      ...parsed,
      token: hubToken,
      userId: hubUserId || parsed.userId || 'merlin-user',
      email: hubEmail || parsed.email || '',
      coinBalance: typeof parsed.coinBalance === 'number' ? parsed.coinBalance : 0,
    };
  } catch {
    /* ignore */
  }
  return DEFAULT_MERLIN_AUTH;
}

export function toggleMerlinTier(current: MerlinAuthState): MerlinAuthState {
  const next: MerlinAuthState = {
    ...current,
    tier: current.tier === 'PRO_LIFETIME' ? 'FREE' : 'PRO_LIFETIME',
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
