import { getZCoreUrl, zCoreBridge } from './zCoreBridge';

/**
 * [정책 §5.4-⑨] 동일 PC 다중 계정 보호 표준 (카카오톡 PC 방식: 동시 1계정 단독 점유 + 순차 교대 허용)
 * - 1대의 윈도우 PC(Z-Core 127.0.0.1:5199)에는 한 순간에 오직 1개의 활성 계정만 단독 바인딩됩니다.
 * - 기존 계정이 열려 있는 상태에서 시크릿 창·타 프로필·타 브라우저로 제2계정 로그인 시
 *   `PC_OWNED_BY_OTHER_ACCOUNT`로 로컬 엔진(S: 드라이브·클립보드·백업) 접근을 원천 차단하며,
 *   사용자가 명시적으로 `[이 계정으로 전환하기]`(forceSwitch=true)를 눌렀을 때만 소유권을 이관합니다.
 */

const TAB_SESSION_STORAGE_KEY = 'ghosti_pc_tab_session_id_v1';

let localPcOwnershipBlocked = false;
let blockedByMaskedEmail = '';

export interface PcAccountOwnerResponse {
  ok: boolean;
  reason?: 'PC_OWNED_BY_OTHER_ACCOUNT' | 'DISPLACED_BY_OTHER_ACCOUNT' | string;
  activeEmail?: string;
  activeEmailMasked?: string;
  switched?: boolean;
  released?: boolean;
}

export function getPcTabSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    let sid = (sessionStorage.getItem(TAB_SESSION_STORAGE_KEY) || '').trim();
    if (!sid) {
      sid = `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(TAB_SESSION_STORAGE_KEY, sid);
    }
    return sid;
  } catch {
    return `tab_mem_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function isLocalPcBlockedByOtherAccount(): boolean {
  return localPcOwnershipBlocked;
}

export function getLocalPcBlockedMaskedEmail(): string {
  return blockedByMaskedEmail;
}

export function setLocalPcOwnershipBlockedState(blocked: boolean, maskedEmail = ''): void {
  const prev = localPcOwnershipBlocked;
  localPcOwnershipBlocked = blocked;
  blockedByMaskedEmail = blocked ? maskedEmail : '';
  if (prev !== blocked && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('ghostiPcOwnershipChanged', {
        detail: { blocked, activeEmailMasked: blockedByMaskedEmail },
      })
    );
  }
}

export async function claimOrHeartbeatLocalPcAccountOwner(opts: {
  email: string;
  action?: 'claim' | 'heartbeat';
  forceSwitch?: boolean;
}): Promise<PcAccountOwnerResponse> {
  const cleanEmail = (opts.email || '').trim().toLowerCase();
  if (typeof window === 'undefined' || !cleanEmail || !zCoreBridge.isConnected) {
    return { ok: true, activeEmail: cleanEmail };
  }
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 2500) : null;
  try {
    const res = await fetch(getZCoreUrl('/__merlin/account-owner'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: opts.action || 'claim',
        email: cleanEmail,
        sessionId: getPcTabSessionId(),
        forceSwitch: Boolean(opts.forceSwitch),
      }),
      ...(ctrl ? { signal: ctrl.signal } : {}),
    });
    if (res.status === 404) {
      // 구버전 Z-코어 역호환 (엔드포인트 미지원 시 정상 통과)
      setLocalPcOwnershipBlockedState(false);
      return { ok: true, activeEmail: cleanEmail };
    }
    const data = (await res.json().catch(() => ({}))) as PcAccountOwnerResponse;
    if (data.ok) {
      setLocalPcOwnershipBlockedState(false);
      return data;
    }
    if (data.reason === 'PC_OWNED_BY_OTHER_ACCOUNT') {
      setLocalPcOwnershipBlockedState(true, data.activeEmailMasked || '다른 계정');
    }
    return data;
  } catch {
    return { ok: true, activeEmail: cleanEmail };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function releaseLocalPcAccountOwner(email?: string): Promise<void> {
  setLocalPcOwnershipBlockedState(false);
  if (typeof window === 'undefined' || !zCoreBridge.isConnected) return;
  const cleanEmail = (email || '').trim().toLowerCase();
  try {
    await fetch(getZCoreUrl('/__merlin/account-owner'), {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'release',
        email: cleanEmail,
        sessionId: getPcTabSessionId(),
      }),
    });
  } catch {
    /* ignore */
  }
}

export function releaseLocalPcTabSessionOnUnload(email?: string): void {
  if (typeof window === 'undefined' || !zCoreBridge.isConnected) return;
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return;
  try {
    void fetch(getZCoreUrl('/__merlin/account-owner'), {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'release_session',
        email: cleanEmail,
        sessionId: getPcTabSessionId(),
      }),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
