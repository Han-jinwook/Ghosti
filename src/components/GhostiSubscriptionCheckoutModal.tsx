import React, { useEffect, useMemo, useState } from 'react';
import { X, CheckCircle2, RefreshCw, Coins, Sparkles, ShieldCheck, ArrowRightLeft } from 'lucide-react';
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

  // 결제창이 열릴 때마다 최신 코인 잔액을 허브에서 자동 조회하고 이전 오류/영수증 상태 초기화
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

  // 기존 유효기간이 남아 있으면 그 날짜부터 누적 연장 계산
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
            res.message ||
              `보유 코인이 부족합니다. 충전소에서 부족한 코인을 충전한 뒤 바로 구독을 완료해 주세요.`
          );
        } else {
          setErrorMsg(res.message || '구독 결제 처리 중 일시 오류가 발생했습니다. 다시 시도해 주세요.');
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
        lastQuarantineToast: `🎉 ${spec.title} 결제가 완료되었습니다! (${formatKoreaDateShort(
          res.expiresAt || expectedExpiresMs
        )}까지 이용 가능)`,
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
            lastQuarantineToast:
              '🎁 업무 공유(S: 드라이브) 30일 무료체험이 시작되었습니다! 소호(~5인) 직통 연결을 바로 이용해 보세요.',
          });
          closeSubscriptionCheckout();
          setShowProModal(false);
          setActiveLoungeType('work');
          setDesktopTab('dashboard');
        } else {
          setErrorMsg(
            res.message || '이 계정은 이미 업무 공유 30일 무료체험을 사용했거나 일시 오류가 발생했습니다.'
          );
        }
        return;
      }
      const ok = await activate30DayDeviceTrialNow();
      if (ok) {
        closeSubscriptionCheckout();
        setShowProModal(false);
      } else {
        setErrorMsg('이 계정은 이미 30일 무료체험을 사용했거나 일시 오류가 발생했습니다.');
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
      className="fixed inset-0 z-[125] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={() => {
        if (!submitting) closeSubscriptionCheckout();
      }}
      data-testid="ghosti-subscription-checkout-modal"
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-[#111216] border border-emerald-400/40 shadow-[0_24px_80px_rgba(0,0,0,0.65)] text-zinc-100 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 헤더 */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-950/90 via-[#151821] to-[#111216] border-b border-white/10 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-extrabold">
              <Sparkles className="w-3 h-3" />
              <span>{spec.badge}</span>
            </span>
            <h2 className="mt-1 text-[18px] sm:text-[19px] font-black text-white truncate">
              {receipt ? '🎉 구독 결제가 완료되었습니다!' : '귀신같이 이용권 구독 결제'}
            </h2>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={closeSubscriptionCheckout}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-zinc-300 shrink-0 cursor-pointer disabled:opacity-40"
            aria-label="구독 결제창 닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {receipt ? (
            /* ── 결제 완료 영수증 화면 ── */
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-400/45 flex flex-col items-center text-center gap-2">
                <CheckCircle2 className="w-11 h-11 text-emerald-400" />
                <div className="text-[16px] font-black text-white">{receipt.planTitle}</div>
                <p className="text-[12.5px] text-emerald-200">
                  {spec.category === 'personal'
                    ? '지금 바로 내 모든 PC·스마트폰과 귀신창 유료 초능력이 무제한으로 열렸습니다.'
                    : '지금 바로 업무 공유 공용 폴더(S: 드라이브)와 팀원 직통 연결·예비 서버가 열렸습니다.'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950/90 border border-white/10 flex flex-col gap-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">이용 만료일</span>
                  <strong className="text-emerald-300">{receipt.expiresAtLabel}까지</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">결제한 귀신코인</span>
                  <strong className="text-white">-{receipt.paidCoins.toLocaleString()} C</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">결제 후 남는 코인</span>
                  <strong className="text-amber-300">{receipt.remainingBalance.toLocaleString()} C</strong>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
                  <span className="text-zinc-500">주문번호</span>
                  <span className="font-mono text-zinc-400 truncate max-w-[240px]">{receipt.orderId}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleFinishReceipt}
                className="w-full py-3.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-[14px] font-black cursor-pointer transition-all shadow-lg"
              >
                {spec.category === 'personal'
                  ? '🚀 5. 내 기기 통합으로 바로 이동'
                  : '💼 6. 업무 공유로 바로 이동'}
              </button>
            </div>
          ) : (
            /* ── 구독 상품 확인 · 잔액 대조 · 결제/충전 분기 화면 ── */
            <>
              {/* 1. 선택한 이용권 카드 */}
              <div className="p-4 rounded-2xl bg-zinc-950/90 border border-white/12 flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[16px] font-black text-white">{spec.title}</div>
                    <p className="text-[12px] text-zinc-400 mt-0.5">{spec.subtitle}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[20px] font-black text-emerald-300 leading-tight">
                      {spec.priceCoins.toLocaleString()} C
                    </div>
                    <div className="text-[11px] text-zinc-400">({spec.priceKrwLabel} · {spec.durationLabel})</div>
                  </div>
                </div>

                {spec.discountNote && (
                  <div className="px-2.5 py-1 rounded-lg bg-amber-400/15 border border-amber-400/35 text-amber-300 text-[11.5px] font-bold">
                    ✨ {spec.discountNote}
                  </div>
                )}

                <ul className="space-y-1 text-[11.5px] text-zinc-300 pt-1">
                  {spec.benefits.map((b, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 leading-snug">
                      <span className="text-emerald-400 font-bold shrink-0">✓</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
                  <span className="text-zinc-400">
                    {isExtension ? '기존 만료일에서 누적 연장 ➔ ' : '결제 시 이용 기간 ➔ '}
                    <strong className="text-white">{expectedExpiresLabel}까지</strong>
                  </span>
                  {spec.switchPairPlanId && spec.switchPairLabel && (
                    <button
                      type="button"
                      onClick={() => openSubscriptionCheckout(spec.switchPairPlanId!)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-amber-300 font-bold cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      <span>{spec.switchPairLabel}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 2. 로그인 분기 또는 보유 귀신코인 잔액 대조 카드 */}
              {!effectiveLoggedIn ? (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/40 flex flex-col gap-3 text-center">
                  <p className="text-[13px] text-amber-100 font-bold">
                    보유 귀신코인 잔액을 확인하고 구독을 시작하려면 먼저 이메일로 로그인해 주세요.
                  </p>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('openLoginModal'))}
                    className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[13.5px] font-black cursor-pointer"
                  >
                    🔑 1초 이메일 로그인하고 잔액 확인하기
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-[#161922] border border-white/12 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-extrabold text-zinc-200 flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-amber-400" />
                      <span>내 귀신코인 잔액 확인</span>
                    </span>
                    <button
                      type="button"
                      disabled={refreshingBal}
                      onClick={() => void handleRefreshBalance()}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-zinc-300 font-bold cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${refreshingBal ? 'animate-spin' : ''}`} />
                      <span>{refreshingBal ? '조회 중...' : '잔액 새로고침'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[12.5px]">
                    <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-white/8">
                      <div className="text-[11px] text-zinc-400">현재 보유 귀신코인</div>
                      <div className="text-[16px] font-black text-amber-300 mt-0.5">
                        {currentBalance.toLocaleString()} C
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-white/8">
                      <div className="text-[11px] text-zinc-400">
                        {hasEnoughCoins ? '결제 후 남는 코인' : '부족한 코인'}
                      </div>
                      <div
                        className={`text-[16px] font-black mt-0.5 ${
                          hasEnoughCoins ? 'text-emerald-300' : 'text-rose-400'
                        }`}
                      >
                        {hasEnoughCoins
                          ? `${balanceAfterPay.toLocaleString()} C`
                          : `-${shortfall.toLocaleString()} C 부족`}
                      </div>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-400/40 text-rose-200 text-[12px] font-bold">
                      ⚠️ {errorMsg}
                    </div>
                  )}

                  {/* 잔액 충분 vs 부족 메인 액션 버튼 */}
                  {hasEnoughCoins ? (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleConfirmPurchase()}
                      data-testid="confirm-coin-subscription-btn"
                      className="w-full py-3.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-[14px] font-black shadow-lg cursor-pointer transition-all disabled:opacity-60"
                    >
                      {submitting
                        ? '⏳ 결제 승인 및 전 기기 해금 처리 중...'
                        : `✅ ${spec.priceCoins.toLocaleString()} C로 지금 바로 구독 시작하기`}
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={handleOpenCoinChargeStation}
                        data-testid="open-charge-station-from-checkout-btn"
                        className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[14px] font-black shadow-lg cursor-pointer transition-all"
                      >
                        ⚡ 부족한 {shortfall.toLocaleString()} C 충전하러 가기 (귀신코인 충전소)
                      </button>
                      <p className="text-[11.5px] text-zinc-400 text-center">
                        충전소에서 충전 완료 후 창을 닫으면 자동으로 이 구독 결제창으로 돌아옵니다.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 3. 아직 30일 무료체험을 안 써본 유저 전용 보조 카드 */}
              {canOfferFreeTrial && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-400/35 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-extrabold text-emerald-200">
                      🎁 아직 30일 무료체험을 안 써보셨네요!
                    </div>
                    <div className="text-[11px] text-zinc-300">
                      코인·카드 없이 먼저 30일 동안 모든 기능을 무료로 써보실 수 있어요.
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={startingTrial}
                    onClick={() => void handleStartTrialInstead()}
                    className="px-3.5 py-2 rounded-xl bg-emerald-400/20 hover:bg-emerald-400/30 border border-emerald-400/50 text-emerald-200 text-[12px] font-black cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {startingTrial ? '시작 중...' : '0원으로 30일 먼저 체험'}
                  </button>
                </div>
              )}

              {/* 4. 안심 고지 1줄 */}
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>자동 정기결제 없음(기간 만료 시 추가 결제 0원) · 대장 PC 로컬 원본 100% 영구 보존</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
