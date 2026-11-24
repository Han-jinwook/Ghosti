import { useSaySeeStore } from '../store/useSaySeeStore';
import { getZCoreUrl, zCoreBridge } from './zCoreBridge';

export type ProFeatureActionType = 'feat_6_screen_ocr' | 'feat_ghost_labeler';

export interface ProFeatureGateResult {
  allowed: boolean;
  state: 'allowed' | 'need_opt_in' | 'expired';
  message: string;
  trialBadge: string;
}

export function isWorkShareDriveExempt(filePath?: string): boolean {
  const fp = String(filePath || '').trim();
  if (!fp) return false;
  const normFp = fp.replace(/\\/g, '/').toLowerCase();
  return /^[sS]:/.test(fp) || normFp.includes('/s:/');
}

export function isNotStartedTrialResponse(gj: Record<string, unknown> | null): boolean {
  if (!gj || gj.allowed !== false) return false;
  if (Boolean(gj.trialOptInRequired)) return true;
  const codeCandidates = [
    gj.reason,
    gj.status,
    gj.feature_status,
    gj.error,
    gj.message,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);

  return codeCandidates.some(
    (c) =>
      c === 'NOT_STARTED' ||
      c === 'UNOPENED' ||
      c === 'TRIAL_NOT_STARTED' ||
      c === 'TRIAL_OPT_IN_REQUIRED' ||
      c.includes('무료체험 시작') ||
      c.includes('동의 후')
  );
}

const VERIFIED_GATE_FAST_TTL_MS = 60_000;
const VERIFIED_GATE_FALLBACK_TTL_MS = 5 * 60_000;
const verifiedGateCache = new Map<string, { at: number; trialBadge: string }>();

export async function evaluateProFeatureGate(options: {
  actionType: ProFeatureActionType;
  filePath?: string;
  forceSampleOnly?: boolean;
  allowSDriveFree?: boolean;
}): Promise<ProFeatureGateResult> {
  const {
    actionType,
    filePath = '',
    forceSampleOnly = false,
    allowSDriveFree = true,
  } = options;

  if (forceSampleOnly) {
    return { allowed: true, state: 'allowed', message: '', trialBadge: '' };
  }

  if (allowSDriveFree && isWorkShareDriveExempt(filePath)) {
    return {
      allowed: true,
      state: 'allowed',
      message: '',
      trialBadge: '업무 공유(S:) 무료 적용',
    };
  }

  const featureNameKo =
    actionType === 'feat_6_screen_ocr' ? '사진·표 OCR' : '귀신 라벨러';
  const sDriveNote =
    actionType === 'feat_ghost_labeler' ? ' (업무 공유 S: 드라이브 파일은 무료)' : '';

  const storeState = useSaySeeStore.getState();
  const ent = storeState.deviceEntitlement;
  const hubToken = storeState.merlinAuth?.token || '';
  const accountId = storeState.merlinAuth?.email || 'local_user';
  const isSubFromStore = Boolean(ent?.isPaidUnlimited);
  const cacheKey = `${accountId}:${actionType}`;
  const cachedGate = verifiedGateCache.get(cacheKey);
  const nowMs = Date.now();

  // 직전 60초 이내에 이미 권한 통과가 검증된 경우 Z-코어가 썸네일/OCR로 바쁘더라도 즉시 통과시켜 지연 오류 원천 차단
  if (cachedGate && nowMs - cachedGate.at < VERIFIED_GATE_FAST_TTL_MS) {
    return {
      allowed: true,
      state: 'allowed',
      message: '',
      trialBadge: cachedGate.trialBadge,
    };
  }

  // 이미 스토어에서 활성 구독(Pro) 또는 30일 무료체험이 확정된 경우 네트워크 왕복(최대 5초) 없이 0ms 즉시 통과시키고,
  // Z-코어 사용 기록 동기화는 백그라운드로 비동기 처리해 연속 라벨링 지연을 0ms로 제거합니다.
  if (ent?.isPaidUnlimited || ent?.trialActive) {
    const fastBadge = ent.isPaidUnlimited ? 'Pro' : `체험 ${ent.trialDaysLeft}일 남음`;
    verifiedGateCache.set(cacheKey, { at: nowMs, trialBadge: fastBadge });
    if (zCoreBridge.isConnected) {
      void fetch(getZCoreUrl('/api/superpower/consume-action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType,
          ...(filePath ? { filePath } : {}),
          isSubscribed: isSubFromStore,
          hubToken,
          accountId,
        }),
        signal: AbortSignal.timeout(2000),
      }).catch(() => {});
    }
    return {
      allowed: true,
      state: 'allowed',
      message: '',
      trialBadge: fastBadge,
    };
  }

  const resolveGracefulEntitlementFallback = (): ProFeatureGateResult | null => {
    if (ent?.isPaidUnlimited || ent?.trialActive) {
      return {
        allowed: true,
        state: 'allowed',
        message: '',
        trialBadge: ent.isPaidUnlimited ? 'Pro' : `체험 ${ent.trialDaysLeft}일 남음`,
      };
    }
    if (cachedGate && Date.now() - cachedGate.at < VERIFIED_GATE_FALLBACK_TTL_MS) {
      return {
        allowed: true,
        state: 'allowed',
        message: '',
        trialBadge: cachedGate.trialBadge,
      };
    }
    return null;
  };

  if (zCoreBridge.isConnected) {
    try {
      const requestConsume = () =>
        fetch(getZCoreUrl('/api/superpower/consume-action'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actionType,
            ...(filePath ? { filePath } : {}),
            isSubscribed: isSubFromStore,
            hubToken,
            accountId,
          }),
          signal: AbortSignal.timeout(5000),
        });

      let gateRes = await requestConsume();
      if (!gateRes.ok && actionType === 'feat_ghost_labeler') {
        const fb = resolveGracefulEntitlementFallback();
        if (fb) return fb;
        return {
          allowed: false,
          state: 'expired',
          message: '잠시 후 다시 시도해 주세요. (권한 확인 일시 지연)',
          trialBadge: '',
        };
      }

      let gateJson = gateRes.ok
        ? ((await gateRes.json().catch(() => null)) as Record<string, unknown> | null)
        : null;

      if (ent?.trialActive && isNotStartedTrialResponse(gateJson)) {
        await fetch(getZCoreUrl('/api/superpower/start-trial'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agreed: true,
            optIn: true,
            hubToken,
            accountId,
          }),
          signal: AbortSignal.timeout(4000),
        }).catch(() => null);

        gateRes = await requestConsume();
        gateJson = gateRes.ok
          ? ((await gateRes.json().catch(() => null)) as Record<string, unknown> | null)
          : null;
      }

      if (!gateJson || gateJson.allowed === false) {
        if (!gateJson) {
          const fb = resolveGracefulEntitlementFallback();
          if (fb) return fb;
        }
        const rawMsg = String(gateJson?.message || '').trim();
        const isMachineCodeMsg = !rawMsg || /^[A-Z0-9_]+$/.test(rawMsg);

        if (gateJson && isNotStartedTrialResponse(gateJson)) {
          return {
            allowed: false,
            state: 'need_opt_in',
            message: isMachineCodeMsg
              ? `${featureNameKo} 기능은 30일 무료체험을 시작하면 바로 사용할 수 있습니다${sDriveNote}.`
              : rawMsg,
            trialBadge: '',
          };
        }

        return {
          allowed: false,
          state: 'expired',
          message: isMachineCodeMsg
            ? `30일 무료체험이 종료되었습니다. 내 기기 통합 Pro(월 3,900원) 구독 시 계속 사용할 수 있습니다${sDriveNote}.`
            : rawMsg,
          trialBadge: '',
        };
      }

      const resolvedDays = gateJson.daysLeft ?? gateJson.days_left;
      const featStatus = String(gateJson.status || gateJson.feature_status || '');
      const isSub = Boolean(
        gateJson.isSubscribed || gateJson.is_subscribed || featStatus === 'SUBSCRIBED'
      );
      let trialBadge = '';
      if (isSub) {
        trialBadge = 'Pro';
      } else if (resolvedDays !== undefined && featStatus !== 'FREE_FOREVER') {
        trialBadge = `체험 ${resolvedDays}일 남음`;
      }

      verifiedGateCache.set(cacheKey, { at: Date.now(), trialBadge });
      return {
        allowed: true,
        state: 'allowed',
        message: '',
        trialBadge,
      };
    } catch {
      // Z-코어가 썸네일·OCR 작업으로 일시 지연될 때 이미 활성화된 구독/30일 체험 권한이 있으면 차단하지 않고 즉시 실행 허용
      const fb = resolveGracefulEntitlementFallback();
      if (fb) return fb;
    }
  }

  if (!ent?.isPaidUnlimited && !ent?.trialActive) {
    return {
      allowed: false,
      state: actionType === 'feat_6_screen_ocr' ? 'need_opt_in' : 'expired',
      message:
        actionType === 'feat_6_screen_ocr'
          ? '사진·표 OCR 창은 내 기기 통합 Pro(월 3,900원) 30일 무료체험 시작 후 사용할 수 있습니다.'
          : '귀신 라벨러는 내 기기 통합 Pro(월 3,900원) 전용 기능입니다 (업무 공유 S: 드라이브 파일은 무료).',
      trialBadge: '',
    };
  }

  return {
    allowed: true,
    state: 'allowed',
    message: '',
    trialBadge: ent.isPaidUnlimited ? 'Pro' : `체험 ${ent.trialDaysLeft}일 남음`,
  };
}

let _latestClipboardWriteSeq = 0;
let _activeZCoreClipboardAbort: AbortController | null = null;

export async function copyTextSafeToClipboard(text: string): Promise<boolean> {
  const payload = String(text ?? '');
  if (!payload) return false;
  const mySeq = ++_latestClipboardWriteSeq;
  try {
    _activeZCoreClipboardAbort?.abort();
  } catch {
    /* ignore */
  }
  _activeZCoreClipboardAbort = null;

  // 1) 브라우저 표준 Clipboard API 최우선 (1ms 즉시 완료 — 성공 시 Z-코어 지연 덮어쓰기 원천 차단)
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload);
      return true;
    }
  } catch {
    /* 브라우저 제스처 만료 등으로 거부 시 Z-코어 OS 네이티브 클립보드 폴백 */
  }

  // 2) PC Z-코어 OS 네이티브 클립보드 API(/__merlin/clipboard) 폴백 (최신 요청 seq만 허용)
  if (zCoreBridge.isConnected && mySeq === _latestClipboardWriteSeq) {
    try {
      const ctrl = new AbortController();
      _activeZCoreClipboardAbort = ctrl;
      const tid = setTimeout(() => ctrl.abort(), 700);
      const res = await fetch(getZCoreUrl('/__merlin/clipboard'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: payload }),
        signal: ctrl.signal,
      }).finally(() => {
        clearTimeout(tid);
        if (_activeZCoreClipboardAbort === ctrl) _activeZCoreClipboardAbort = null;
      });
      if (res.ok) return true;
    } catch {
      /* fallback below */
    }
  }

  if (mySeq !== _latestClipboardWriteSeq) return false;

  // 3) 구형/비활성화 폴백 execCommand
  if (typeof document !== 'undefined') {
    try {
      const ta = document.createElement('textarea');
      ta.value = payload;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      /* ignore */
    }
  }
  return false;
}
