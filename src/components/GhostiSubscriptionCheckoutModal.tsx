import React, { useEffect, useMemo, useState } from 'react';
import { X, CheckCircle2, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { useHub } from '../services/merlin-hub-sdk/react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { useIsCoinHiddenInStore } from './GhostiHubInfraBridge';
import {
  formatKoreaDateShort,
  getSubscriptionPlanSpec,
  PENDING_SUB_CHECKOUT_STORAGE_KEY,
} from '../services/subscriptionPlanCatalog';
import {
  activateDevicePlanPersistent,
  purchaseDeviceSubscriptionPlan,
  syncEntitlementToLocalPcEngine,
} from '../services/deviceIntegrationService';
import type { PricingPlanId } from '../types/saysee';

interface PurchaseReceiptView {
  orderId: string;
  planTitle: string;
  paidCoins: number;
  remainingBalance: number;
  expiresAtLabel: string;
}

export const GhostiSubscriptionCheckoutModal: React.FC = () => {
  const hideCoin = useIsCoinHiddenInStore();
  const { isLoggedIn, balance: hubBalance, refreshBalance } = useHub();
  const {
    subscriptionCheckoutPlanId,
    closeSubscriptionCheckout,
    openSubscriptionCheckout,
    deviceEntitlement,
    merlinAuth,
    activate30DayDeviceTrialNow,
    setDeviceIntegrationSnapshot,
    setShowProModal,
    setActiveLoungeType,
    setDesktopTab,
  } = useSaySeeStore();

  const [refreshingBal, setRefreshingBal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [startingTrial, setStartingTrial] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PurchaseReceiptView | null>(null);

  const spec = useMemo(
    () => getSubscriptionPlanSpec(subscriptionCheckoutPlanId),
    [subscriptionCheckoutPlanId]
  );

  useEffect(() => {
    if (!subscriptionCheckoutPlanId) {
      setErrorMsg(null);
      setReceipt(null);
      return;
    }
    setErrorMsg(null);
    setReceipt(null);
    if (isLoggedIn) {
      setRefreshingBal(true);
      void refreshBalance().finally(() => setRefreshingBal(false));
    }
  }, [subscriptionCheckoutPlanId, isLoggedIn, refreshBalance]);

  if (hideCoin || !subscriptionCheckoutPlanId || !spec) {
    return null;
  }

  const effectiveLoggedIn = Boolean(
    isLoggedIn || (merlinAuth?.email && merlinAuth?.userId && merlinAuth.userId !== 'guest')
  );
  const currentBalance =
    typeof hubBalance === 'number'
      ? hubBalance
      : typeof merlinAuth?.coinBalance === 'number'
      ? merlinAuth.coinBalance
      : 0;
  const shortfall = Math.max(0, spec.priceCoins - currentBalance);
  const hasEnoughCoins = effectiveLoggedIn && currentBalance >= spec.priceCoins;
  const balanceAfterPay = Math.max(0, currentBalance - spec.priceCoins);

  const nowMs = Date.now();
  const existingExpIso =
    spec.category === 'personal'
      ? deviceEntitlement?.paidExpiresAt
      : deviceEntitlement?.workPaidExpiresAt;
  const existingExpMs = existingExpIso ? Date.parse(existingExpIso) : 0;
  const isExtension = Number.isFinite(existingExpMs) && existingExpMs > nowMs;
  const expectedExpiresMs =
    (isExtension ? existingExpMs : nowMs) + spec.durationDays * 24 * 3600 * 1000;
  const expectedExpiresLabel = formatKoreaDateShort(expectedExpiresMs);
  const canOfferFreeTrial =
    effectiveLoggedIn &&
    (spec.category === 'personal'
      ? !deviceEntitlement?.trialOptInStartedAt && !deviceEntitlement?.isPaidUnlimited
      : !deviceEntitlement?.workTrialOptInStartedAt && !deviceEntitlement?.workPaidActive);

  const handleRefreshBalance = async () => {
    setRefreshingBal(true);
    setErrorMsg(null);
    try {
      await refreshBalance();
    } finally {
      setRefreshingBal(false);
    }
  };

  const handleOpenCoinChargeStation = () => {
    const recommendedMin = Math.max(1000, Math.ceil(shortfall / 1000) * 1000);
    try {
      localStorage.setItem(
        PENDING_SUB_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          planId: spec.canonicalId,
          shortfall,
          createdAt: Date.now(),
        })
      );
    } catch {
      /* ignore */
    }
    const currentSearch = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    currentSearch.set('ghosti_checkout_plan', spec.canonicalId);
    const redirectUrl = `${typeof window !== 'undefined' ? window.location.pathname : '/'}?${currentSearch.toString()}`;
    window.dispatchEvent(
      new CustomEvent('openPurchaseModal', {
        detail: {
          minCustomCoin: recommendedMin,
          redirectUrl,
          returnToCheckoutPlan: spec.canonicalId,
        },
      })
    );
  };

  const handleConfirmPurchase = async () => {
    if (submitting || !hasEnoughCoins) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await purchaseDeviceSubscriptionPlan(spec.canonicalId);
      if (!res.ok) {
        if (res.reason === 'INSUFFICIENT_COINS') {
          await refreshBalance();
          setErrorMsg(
            res.message || '보유 코인이 부족합니다. 코인을 충전한 뒤 다시 시도해 주세요.'
          );
        } else {
          setErrorMsg(res.message || '결제 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
        }
        return;
      }

      try {
        localStorage.removeItem(PENDING_SUB_CHECKOUT_STORAGE_KEY);
      } catch {
        /* ignore */
      }

      if (res.entitlement) {
        setDeviceIntegrationSnapshot({ entitlement: res.entitlement });
        void syncEntitlementToLocalPcEngine(res.entitlement, merlinAuth?.email || undefined);
      }

      const nextSubscribed = { ...useSaySeeStore.getState().subscribedLounges };
      if (spec.category === 'personal') {
        nextSubscribed.personal = spec.canonicalId as PricingPlanId;
      } else {
        nextSubscribed.work = spec.canonicalId as PricingPlanId;
      }
      useSaySeeStore.setState({
        subscribedLounges: nextSubscribed,
        activePricingPlan: spec.canonicalId as PricingPlanId,
        lastQuarantineToast: `${spec.title} 결제가 완료되었습니다 (${formatKoreaDateShort(
          res.expiresAt || expectedExpiresMs
        )}까지).`,
      });

      await refreshBalance();

      setReceipt({
        orderId: res.orderId || '-',
        planTitle: spec.title,
        paidCoins: res.paidCoins ?? spec.priceCoins,
        remainingBalance:
          typeof res.remainingBalance === 'number' ? res.remainingBalance : balanceAfterPay,
        expiresAtLabel: formatKoreaDateShort(res.expiresAt || expectedExpiresMs),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartTrialInstead = async () => {
    if (startingTrial) return;
    setStartingTrial(true);
    setErrorMsg(null);
    try {
      if (spec.category === 'work') {
        const res = await activateDevicePlanPersistent('work_trial_opt_in_30d');
        if (res.ok && res.entitlement) {
          setDeviceIntegrationSnapshot({ entitlement: res.entitlement });
          useSaySeeStore.setState({
            lastQuarantineToast: '업무 공유(S:) 30일 무료체험이 시작되었습니다.',
          });
          closeSubscriptionCheckout();
          setShowProModal(false);
          setActiveLoungeType('work');
          setDesktopTab('dashboard');
        } else {
          setErrorMsg(
            res.message || '이미 무료체험을 사용했거나 일시 오류가 발생했습니다.'
          );
        }
        return;
      }
      const ok = await activate30DayDeviceTrialNow();
      if (ok) {
        closeSubscriptionCheckout();
        setShowProModal(false);
      } else {
        setErrorMsg('이미 30일 무료체험을 사용했거나 일시 오류가 발생했습니다.');
      }
    } finally {
      setStartingTrial(false);
    }
  };

  const handleFinishReceipt = () => {
    closeSubscriptionCheckout();
    setShowProModal(false);
    if (spec.category === 'personal') {
      setActiveLoungeType('personal');
      setDesktopTab('sync');
    } else {
      setActiveLoungeType('work');
      setDesktopTab('dashboard');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[125] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={() => {
        if (!submitting) closeSubscriptionCheckout();
      }}
      data-testid="ghosti-subscription-checkout-modal"
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl text-slate-900 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11.5px] font-medium text-slate-500">{spec.badge}</span>
            <h2 className="mt-0.5 text-[18px] font-bold text-slate-900 truncate">
              {receipt ? '결제 완료' : '이용권 결제'}
            </h2>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={closeSubscriptionCheckout}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer disabled:opacity-40"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {receipt ? (
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center text-center gap-2">
                <CheckCircle2 className="w-9 h-9 text-teal-600" />
                <div className="text-[16px] font-bold text-slate-900">{receipt.planTitle}</div>
                <p className="text-[12.5px] text-slate-600">
                  {spec.category === 'personal'
                    ? '다중 기기 통합 연결과 사진·표 OCR · 귀신 라벨러가 활성화되었습니다.'
                    : '업무 공유 공용 드라이브(S:)와 예비 서버 연결이 활성화되었습니다.'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col gap-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">이용 기간</span>
                  <strong className="text-slate-900">{receipt.expiresAtLabel}까지</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">결제 코인</span>
                  <strong className="text-slate-900">-{receipt.paidCoins.toLocaleString()} C</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">남은 코인</span>
                  <strong className="text-slate-900">{receipt.remainingBalance.toLocaleString()} C</strong>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11.5px]">
                  <span className="text-slate-400">주문번호</span>
                  <span className="font-mono text-slate-500 truncate max-w-[240px]">{receipt.orderId}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleFinishReceipt}
                className="w-full py-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[13.5px] font-semibold cursor-pointer transition-colors"
              >
                {spec.category === 'personal' ? '내 기기 통합으로 이동' : '업무 공유로 이동'}
              </button>
            </div>
          ) : (
            <>
              {/* 선택한 이용권 */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[15.5px] font-bold text-slate-900">{spec.title}</div>
                    <p className="text-[12px] text-slate-500 mt-0.5">{spec.subtitle}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[19px] font-bold text-slate-900 leading-tight">
                      {spec.priceCoins.toLocaleString()} C
                    </div>
                    <div className="text-[11.5px] text-slate-500">
                      {spec.priceKrwLabel} · {spec.durationLabel}
                    </div>
                  </div>
                </div>

                {spec.discountNote && (
                  <div className="text-[12px] text-teal-700 font-medium">{spec.discountNote}</div>
                )}

                <ul className="space-y-1 text-[12px] text-slate-600 pt-1">
                  {spec.benefits.map((b, idx) => (
                    <li key={idx} className="leading-snug">
                      • {b}
                    </li>
                  ))}
                </ul>

                <div className="pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[12px]">
                  <span className="text-slate-500">
                    {isExtension ? '연장 후 만료일: ' : '이용 만료일: '}
                    <strong className="text-slate-900">{expectedExpiresLabel}</strong>
                  </span>
                  {spec.switchPairPlanId && spec.switchPairLabel && (
                    <button
                      type="button"
                      onClick={() => openSubscriptionCheckout(spec.switchPairPlanId!)}
                      className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-950 font-medium underline cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      <span>{spec.switchPairLabel}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 코인 잔액 확인 */}
              {!effectiveLoggedIn ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-3 text-center">
                  <p className="text-[13px] text-slate-600">
                    코인 잔액을 확인하고 결제를 진행하려면 로그인해 주세요.
                  </p>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('openLoginModal'))}
                    className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[13px] font-semibold cursor-pointer"
                  >
                    이메일 로그인
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-slate-900">보유 코인</span>
                    <button
                      type="button"
                      disabled={refreshingBal}
                      onClick={() => void handleRefreshBalance()}
                      className="inline-flex items-center gap-1 text-[11.5px] text-slate-500 hover:text-slate-800 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${refreshingBal ? 'animate-spin' : ''}`} />
                      <span>{refreshingBal ? '확인 중...' : '새로고침'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-[12.5px]">
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-[11px] text-slate-500">현재 잔액</div>
                      <div className="text-[15.5px] font-bold text-slate-900 mt-0.5">
                        {currentBalance.toLocaleString()} C
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-[11px] text-slate-500">
                        {hasEnoughCoins ? '결제 후 잔액' : '부족 코인'}
                      </div>
                      <div
                        className={`text-[15.5px] font-bold mt-0.5 ${
                          hasEnoughCoins ? 'text-slate-900' : 'text-rose-600'
                        }`}
                      >
                        {hasEnoughCoins
                          ? `${balanceAfterPay.toLocaleString()} C`
                          : `-${shortfall.toLocaleString()} C`}
                      </div>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[12px]">
                      {errorMsg}
                    </div>
                  )}

                  {hasEnoughCoins ? (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleConfirmPurchase()}
                      data-testid="confirm-coin-subscription-btn"
                      className="w-full py-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[13.5px] font-semibold cursor-pointer transition-colors disabled:opacity-60"
                    >
                      {submitting
                        ? '결제 처리 중...'
                        : `${spec.priceCoins.toLocaleString()} C 결제하기`}
                    </button>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={handleOpenCoinChargeStation}
                        data-testid="open-charge-station-from-checkout-btn"
                        className="w-full py-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[13.5px] font-semibold cursor-pointer transition-colors"
                      >
                        {shortfall.toLocaleString()} C 충전하기
                      </button>
                      <p className="text-[11.5px] text-slate-500 text-center">
                        충전 후 창을 닫으면 이 결제 화면으로 돌아옵니다.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {canOfferFreeTrial && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold text-slate-900">
                      30일 무료체험 가능
                    </div>
                    <div className="text-[11.5px] text-slate-500">
                      결제 전 30일 동안 먼저 무료로 사용해 볼 수 있습니다.
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={startingTrial}
                    onClick={() => void handleStartTrialInstead()}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-[12px] font-semibold cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {startingTrial ? '시작 중...' : '무료체험 시작'}
                  </button>
                </div>
              )}

              <p className="text-[11.5px] text-slate-400 text-center">
                기간 만료 시 자동 결제되지 않으며 PC 원본 파일은 그대로 유지됩니다.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
