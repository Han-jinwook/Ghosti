import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import {
  HubProvider,
  useHub,
  HubProfileWidget,
  HubProfileCard,
  HubNotificationCard,
  HubLogoutCard,
  HubAuthModal,
  HubPurchaseWidget,
  HubGiftBoxModal,
  HubAppSwitcher,
  HubErrorBoundary,
  HubBugReporter,
  HubSupportLink,
  HubNotifier,
} from '../services/merlin-hub-sdk/react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { zCoreBridge } from '../services/zCoreBridge';
import { syncHubUserToLocalSupabase, clearGhostiSupabaseSession } from '../services/supabaseClient';
import type { GiftProductItem } from '../services/merlin-hub-sdk/react';

/**
 * [귀신같이 선물함 상품]
 * - SDK 기본값(미전달 시)은 어그로필터 '영상 분석 N회' 묶음이 노출되므로 귀신같이 화면에 부적합.
 * - 귀신같이 전용 앱 아이템(예: 방장 구독권) 선물 상품은 가격표 확정 전까지 만들지 않고,
 *   전 패밀리 공통 '자유 코인 선물' 1종만 노출합니다.
 */
const GHOSTI_GIFT_PRODUCTS: GiftProductItem[] = [
  {
    id: 'custom_coin',
    title: '🎀 자유 코인 선물',
    subtitle: '1,000C 이상 직접 입력',
    fullTitle: '🎀 패밀리 코인 자유 선물',
    amount: 1000,
    category: 'COIN',
    emoji: '🎀',
    defaultMessage: '마음을 담아 준비한 패밀리 코인 선물입니다! 반갑게 열어보세요 🎁',
    isCustom: true,
  },
];

/**
 * [스토어 심사 방어 감지 헬퍼]
 * - 네이티브(Capacitor iOS/Android) 환경이거나 `isStoreAppMode && !enableMobileCoinDisplay`일 때
 *   앱 내부에서 코인/충전소/결제 유도 DOM을 100% 원천 숨김 처리합니다 (Apple 3.1.3(b) 준수).
 */
export function useIsCoinHiddenInStore(): boolean {
  const { isStoreAppMode, enableMobileCoinDisplay } = useSaySeeStore();
  const isCapacitorNative =
    typeof window !== 'undefined' &&
    Boolean((window as any).Capacitor?.isNativePlatform?.());
  if (isCapacitorNative && !enableMobileCoinDisplay) {
    return true;
  }
  return Boolean(isStoreAppMode && !enableMobileCoinDisplay);
}

/**
 * [1. 우측 상단 헤더 허브 앵커 (프로필 위젯 단독)]
 * - 코인 표시 알약은 프로필 모달 내부에 이미 포함되어 있으므로 헤더에서 제외하고,
 *   허브 표준 프로필 위젯만 심플하게 렌더링합니다.
 */
export const GhostiTopRightHubAnchor: React.FC<{ themeMode: 'light' | 'dark' }> = ({
  themeMode,
}) => {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {/* 🐾 허브 표준 프로필 위젯 (클릭 시 통합 프로필·귀신여권·코인/선물함·문의방 모달 오픈) */}
      <div
        className={`rounded-full px-1 py-0.5 border transition-colors ${
          themeMode === 'light'
            ? 'bg-slate-50/90 border-slate-200/80'
            : 'bg-zinc-900/90 border-white/10'
        }`}
      >
        <HubProfileWidget
          layout="row"
          onLoginClick={() => window.dispatchEvent(new CustomEvent('openLoginModal'))}
          onProfileClick={() => window.dispatchEvent(new CustomEvent('openProfileModal'))}
        />
      </div>
    </div>
  );
};

/**
 * [2. 좌측 하단 노션형 사이드바 패밀리 앱 런처 (허브 공식 SDK `HubAppSwitcher` v2.8.0 정품 연동)]
 * - 임의의 수동 아코디언 코드를 전량 폐기하고, 허브 공식 SDK `<HubAppSwitcher variant="sidebar" placement="bottom-up" />`를 그대로 렌더링합니다.
 * - 클릭 시 가입된 앱(3열 공식 로고 그리드)과 미가입 앱(`썬드리머 패밀리 앱 New` 상세 리스트)이 담긴 정품 화이트 카드 팝업이 사이드바 위로 펼쳐집니다.
 */
export const GhostiSidebarBottomFamilyLauncher: React.FC<{
  isOpen?: boolean;
  onToggle?: () => void;
}> = () => {
  return (
    <div className="pt-3 border-t border-black/10 dark:border-white/10">
      <HubAppSwitcher currentAppId="ghosti" variant="sidebar" placement="bottom-up" />
    </div>
  );
};

/**
 * [3. 허브 전역 모달 & 귀신같이 스토어/수파베이스 자동 동기화 엔진]
 */
const GhostiHubGlobalModals: React.FC = () => {
  const { user, isLoggedIn, balance, refreshSession, refreshBalance } = useHub();
  const hideCoin = useIsCoinHiddenInStore();

  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [isGiftBoxOpen, setIsGiftBoxOpen] = useState(false);
  const wasLoggedInRef = useRef(false);

  // 허브 인증/잔액 변화 시 Ghosti 내부 스토어(merlinAuth) 및 단독 Supabase(`public.users.id = family_users.id`) 자동 동기화
  useEffect(() => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('merlin_session_token') || '' : '';

    if (isLoggedIn && user?.id && user?.email) {
      useSaySeeStore.setState((state) => ({
        merlinAuth: {
          ...state.merlinAuth,
          token,
          userId: user.id,
          email: user.email,
          coinBalance: typeof balance === 'number' ? balance : 0,
        },
      }));

      void syncHubUserToLocalSupabase({
        userId: user.id,
        email: user.email,
        nickname: user.nickname,
        hubToken: token,
      });
    } else if (!isLoggedIn) {
      // 로그아웃(로그인 → 게스트 전환) 시에만 귀신같이 Supabase 단기 토큰 폐기 (최초 세션 복원 대기 중 오삭제 방지)
      if (wasLoggedInRef.current) clearGhostiSupabaseSession();
      // 비로그인 게스트 상태에서는 코인 오표시(5,200C 등) 원천 차단 -> 0 C 고정
      useSaySeeStore.setState((state) => ({
        merlinAuth: {
          ...state.merlinAuth,
          token: '',
          userId: 'guest',
          email: '',
          coinBalance: 0,
        },
      }));
    }
    wasLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn, user?.id, user?.email, user?.nickname, balance]);

  // 전역 모달 오픈 이벤트 리스너
  useEffect(() => {
    const onOpenLogin = () => setIsLoginOpen(true);
    const onOpenProfile = () => setIsProfileOpen(true);
    const onOpenPurchase = () => {
      if (!hideCoin) setIsPurchaseOpen(true);
    };
    const onOpenGiftBox = () => {
      if (!hideCoin) setIsGiftBoxOpen(true);
    };

    window.addEventListener('openLoginModal', onOpenLogin);
    window.addEventListener('openProfileModal', onOpenProfile);
    window.addEventListener('openPurchaseModal', onOpenPurchase);
    window.addEventListener('openGiftBoxModal', onOpenGiftBox);

    return () => {
      window.removeEventListener('openLoginModal', onOpenLogin);
      window.removeEventListener('openProfileModal', onOpenProfile);
      window.removeEventListener('openPurchaseModal', onOpenPurchase);
      window.removeEventListener('openGiftBoxModal', onOpenGiftBox);
    };
  }, [hideCoin]);

  return (
    <>
      {/* 1. 표준 이메일 6자리 OTP 로그인 모달 */}
      <HubAuthModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        appName="귀신같이"
        appLogoUrl="/gwisinkachi_app_icon_512.png"
        // 귀신같이는 웰컴 코인 비지급 앱(허브 정책: 웰컴 100코인은 SenseTalk 최초 진입 시에만) →
        // 기본값 'coin'이면 첫 방문자에게 "무료 코인 받으세요!" 오안내 + 스토어 심사 리스크 → 'none' 고정
        rewardType="none"
        onSuccess={(email, userId) => {
          setIsLoginOpen(false);
          void refreshSession();
          void refreshBalance();
          if (userId && email) {
            const currentHubToken =
              typeof window !== 'undefined' ? localStorage.getItem('merlin_session_token') || '' : '';
            void syncHubUserToLocalSupabase({
              userId,
              email,
              hubToken: currentHubToken,
              signupSource: 'workspace_login_modal',
              launchNotifyOptIn: true,
              forceSync: true,
            });
            // [골든 타이밍 바톤터치]: 유저가 '[⚡ 내 컴퓨터 1초 연결하기]' 또는 내 컴퓨터 파일 액션을 눌러 로그인한 경우(ghosti_pending_zcore_connect === '1')에만
            // 로그인 직후 자동으로 Z-코어 연결 모달(또는 인덱싱)로 바톤터치하고, 단순히 우상단 [로그인] 버튼만 누른 경우에는 보던 화면을 그대로 유지합니다.
            let hasPendingZCoreConnect = false;
            try {
              if (sessionStorage.getItem('ghosti_pending_zcore_connect') === '1') {
                hasPendingZCoreConnect = true;
                sessionStorage.removeItem('ghosti_pending_zcore_connect');
              }
            } catch {
              // ignore
            }
            const isMobileEnv =
              typeof window !== 'undefined' &&
              (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
                window.innerWidth < 860);
            if (hasPendingZCoreConnect && !isMobileEnv) {
              void (async () => {
                const ok = zCoreBridge.isConnected || (await zCoreBridge.checkHealth());
                if (ok) {
                  void useSaySeeStore.getState().initApp(true);
                  window.dispatchEvent(new CustomEvent('openZCoreGuideModal'));
                  return;
                }
                window.dispatchEvent(new CustomEvent('openZCoreGuideModal'));
              })();
            }
          }
        }}
      />

      {/* 2. 통합 프로필 설정 모달 (프로필 수정 + 코인/선물함 + 알림 스위치 + 1:1 문의방 + 1초 오류신고 + 로그아웃) */}
      {isProfileOpen && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setIsProfileOpen(false)}
        >
          <div
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-50 p-4 sm:p-5 shadow-2xl border border-slate-200 space-y-3.5 text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                <span>🐾 내 프로필 · 계정 설정</span>
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    const st = useSaySeeStore.getState();
                    const cluster =
                      st.faceClusters.find((c) => c.clusterId === 'face_member_5') ||
                      st.faceClusters[0];
                    if (cluster) {
                      st.setDoorplatePickerClusterId(cluster.clusterId);
                    }
                  }}
                  className="px-3 py-1 rounded-full bg-teal-600 hover:bg-teal-500 text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>👑</span>
                  <span>귀신여권</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(false)}
                  className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <HubProfileCard
              hideCoinSection={hideCoin}
              customGiftProducts={GHOSTI_GIFT_PRODUCTS}
              onOpenPurchase={() => {
                setIsProfileOpen(false);
                if (!hideCoin) setIsPurchaseOpen(true);
              }}
            />

            <HubNotificationCard />

            <HubSupportLink appId="Ghosti" />

            <HubLogoutCard
              onLogout={() => {
                setIsProfileOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* 3. 3몬스터 패밀리 코인 충전소 모달 (스토어 심사 모드에서는 아예 렌더링하지 않음) */}
      {!hideCoin && isPurchaseOpen && (
        <HubPurchaseWidget
          isModal
          isOpen={isPurchaseOpen}
          onClose={() => setIsPurchaseOpen(false)}
          appName="귀신같이"
        />
      )}

      {/* 4. 패밀리 선물함 단독 모달 (스토어 심사 모드에서는 아예 렌더링하지 않음) */}
      {!hideCoin && (
        <HubGiftBoxModal
          isOpen={isGiftBoxOpen}
          onClose={() => setIsGiftBoxOpen(false)}
          appName="귀신같이"
          customProducts={GHOSTI_GIFT_PRODUCTS}
        />
      )}

      {/* 5. 1초 미니 오류·불편 즉시 신고 모달 & 전역 토스트 */}
      <HubBugReporter appId="Ghosti" appVersion="v1.0.0" />
      <HubNotifier />
    </>
  );
};

/**
 * [4. 최상위 HubProvider + HubErrorBoundary 래퍼]
 */
export const GhostiHubRootProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <HubErrorBoundary appId="Ghosti">
      <HubProvider appId="Ghosti">
        {children}
        <GhostiHubGlobalModals />
      </HubProvider>
    </HubErrorBoundary>
  );
};
