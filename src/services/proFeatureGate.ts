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
      trialBadge: '💼 업무 공유(S:) 무료 적용',
    };
  }

  const featureNameKo =
    actionType === 'feat_6_screen_ocr' ? '[사진·표 OCR 창🔒]' : '[귀신 라벨러🔒]';
  const sDriveNote =
    actionType === 'feat_ghost_labeler' ? ' (S: 업무 드라이브는 무료)' : '';

  const storeState = useSaySeeStore.getState();
  const ent = storeState.deviceEntitlement;
  const hubToken = storeState.merlinAuth?.token || '';
  const accountId = storeState.merlinAuth?.email || 'local_user';
  const isSubFromStore = Boolean(ent?.isPaidUnlimited);

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
          signal: AbortSignal.timeout(2500),
        });

      let gateRes = await requestConsume();
      if (!gateRes.ok && actionType === 'feat_ghost_labeler') {
        return {
          allowed: false,
          state: 'expired',
          message: '🔒 [귀신 라벨러] 권한 확인에 실패해 실행을 보류했습니다.',
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
          signal: AbortSignal.timeout(2000),
        }).catch(() => null);

        gateRes = await requestConsume();
        gateJson = gateRes.ok
          ? ((await gateRes.json().catch(() => null)) as Record<string, unknown> | null)
          : null;
      }

      if (!gateJson || gateJson.allowed === false) {
        const rawMsg = String(gateJson?.message || '').trim();
        const isMachineCodeMsg = !rawMsg || /^[A-Z0-9_]+$/.test(rawMsg);

        if (gateJson && isNotStartedTrialResponse(gateJson)) {
          return {
            allowed: false,
            state: 'need_opt_in',
            message: isMachineCodeMsg
              ? `🎁 ${featureNameKo}은 신용카드 등록 없이 30일 무제한 무료체험 시작 버튼만 누르면 바로 사용하실 수 있습니다${sDriveNote}.`
              : rawMsg,
            trialBadge: '',
          };
        }

        return {
          allowed: false,
          state: 'expired',
          message: isMachineCodeMsg
            ? `🔒 30일 무료체험이 만료되었습니다. [4번 내 기기 통합 Pro · 월 3,900원]에서 무제한 해금되며, 무료 기본기 검색은 평생 0원입니다${sDriveNote}.`
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
        trialBadge = '👑 내 기기 통합 무제한';
      } else if (resolvedDays !== undefined && featStatus !== 'FREE_FOREVER') {
        trialBadge = `🎁 무료체험 D-${resolvedDays}`;
      }

      return {
        allowed: true,
        state: 'allowed',
        message: '',
        trialBadge,
      };
    } catch {
      return {
        allowed: false,
        state: 'expired',
        message:
          actionType === 'feat_ghost_labeler'
            ? '🔒 [귀신 라벨러] 로컬 엔진 권한 응답이 지연되어 보류되었습니다.'
            : '🔒 권한 확인 중 응답이 지연되어 유료 기능 실행을 안전하게 보류했습니다.',
        trialBadge: '',
      };
    }
  }

  if (!ent?.isPaidUnlimited && !ent?.trialActive) {
    return {
      allowed: false,
      state: actionType === 'feat_6_screen_ocr' ? 'need_opt_in' : 'expired',
      message:
        actionType === 'feat_6_screen_ocr'
          ? '🎁 [사진·표 OCR 창🔒]은 신용카드 등록 없이 [4. 내 기기 통합 Pro · 월 3,900원]에서 30일 무제한 무료체험 시작 후 사용하실 수 있습니다.'
          : '🔒 [귀신 라벨러] Pro 전용 유료 기능입니다. [4. 내 기기 통합 Pro · 월 3,900원] 30일 무료체험 시작 또는 구독 시 무제한 사용 가능(S: 업무 드라이브는 무료)합니다.',
      trialBadge: '',
    };
  }

  return {
    allowed: true,
    state: 'allowed',
    message: '',
    trialBadge: ent.isPaidUnlimited
      ? '👑 내 기기 통합 무제한'
      : `🎁 무료체험 D-${ent.trialDaysLeft}`,
  };
}

export async function copyTextSafeToClipboard(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    /* fallback below */
  }
  if (typeof document !== 'undefined') {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch {
      /* ignore */
    }
  }
}
