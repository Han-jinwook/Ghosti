import React, { useState, useEffect } from 'react';
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
  HubErrorBoundary,
  HubBugReporter,
  HubSupportLink,
  HubNotifier,
} from '../services/merlin-hub-sdk/react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { syncHubUserToLocalSupabase } from '../services/supabaseClient';

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
 * [1. 우측 상단 헤더 허브 앵커 (곰발바닥 프로필 + 코인 지갑)]
 * - 제트아이 고유 기능(`👑 여권 문패`, `🛠️ 설정몬스터`, `공유`, `🌙 테마 토글`)은 건드리지 않고,
 *   우상단 프로필과 코인 위치를 허브 표준으로 연결합니다.
 */
export const ZEyeTopRightHubAnchor: React.FC<{ themeMode: 'light' | 'dark' }> = ({
  themeMode,
}) => {
  const { isLoggedIn, balance } = useHub();
  const hideCoin = useIsCoinHiddenInStore();

  const displayBalance = isLoggedIn ? (balance ?? 0) : 0;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
      {/* 🪙 코인 잔액 & 3몬스터 충전소 트리거 (스토어 앱 심사 모드에서는 DOM 원천 비노출) */}
      {!hideCoin && (
        <button
          type="button"
          onClick={() => {
            if (!isLoggedIn) {
              window.dispatchEvent(new CustomEvent('openLoginModal'));
            } else {
              window.dispatchEvent(new CustomEvent('openPurchaseModal'));
            }
          }}
          title={
            isLoggedIn
              ? '3몬스터 패밀리 코인 충전소 & 선물함 열기'
              : '로그인 후 코인 지갑 및 선물함 이용'
          }
          className={`px-2.5 py-1 rounded-full font-label-mono text-[11px] font-extrabold border flex items-center gap-1 transition-all cursor-pointer ${
            themeMode === 'light'
              ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
              : 'bg-zinc-900 border-amber-400/35 text-amber-300 hover:bg-zinc-800'
          }`}
        >
          <span>🪙 {displayBalance.toLocaleString()} C</span>
        </button>
      )}

      {/* 🐾 허브 표준 3D 곰발바닥 프로필 위젯 (게스트: 로그인 모달 / 회원: 통합 프로필·선물함·문의방 모달) */}
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
 * [2. 좌측 하단 노션형 사이드바 패밀리 앱 런처 (SSO 핸드오프 연동)]
 * - 제트아이의 노션 스타일 세로 사이드바 하단 `[F] 멀린 패밀리 앱` 디자인을 100% 보존하면서,
 *   클릭 시 `?sso_token=` 무로그인 자동 점핑이 작동하도록 연결합니다.
 */
export const ZEyeSidebarBottomFamilyLauncher: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
}> = ({ isOpen, onToggle }) => {
  const { user, isLoggedIn } = useHub();
  const joinedApps = (user?.registered_apps || []).map((a) => a.toLowerCase());

  const openFamilyAppWithSso = (baseUrl: string) => {
    try {
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('merlin_session_token') : null;
      const targetUrl = new URL(baseUrl);
      if (isLoggedIn && token) {
        targetUrl.searchParams.set('sso_token', token);
      }
      window.open(targetUrl.toString(), '_blank', 'noopener,noreferrer');
    } catch {
      window.open(baseUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const familyItems = [
    {
      id: 'zeye',
      label: '⚡ 제트아이 (Z-Eye)',
      url: 'https://z-eye.sundreamer.app',
      isCurrent: true,
    },
    {
      id: 'sundreamer',
      label: '☀️ 썬드리머 (SunDreamer)',
      url: 'https://sundreamer.app',
      isCurrent: false,
    },
    {
      id: 'sensetalk',
      label: '💬 센스톡 (SenseTalk)',
      url: 'https://sensetalk.netlify.app',
      isCurrent: false,
    },
    {
      id: 'aggrofilter',
      label: '🛡️ 어그로필터 (AggroFilter)',
      url: 'https://aggrofilter.com',
      isCurrent: false,
    },
    {
      id: 'whateat',
      label: '🍽️ 오늘뭐먹지 (WhatEat)',
      url: 'https://whateat.sundreamer.app',
      isCurrent: false,
    },
  ];

  return (
    <div className="pt-3 border-t border-white/10 flex flex-col gap-1">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-2.5 py-2 rounded-xl hover:bg-white/5 flex items-center justify-between text-[12px] font-extrabold text-zinc-400 hover:text-white cursor-pointer"
      >
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-primary-container/20 text-primary-container flex items-center justify-center text-[11px] font-black">
            F
          </span>
          <span>멀린 패밀리 앱</span>
        </span>
        <span className="text-[10px]">{isOpen ? '▾' : '▸'}</span>
      </button>

      {isOpen && (
        <div className="px-2 py-1.5 rounded-xl bg-zinc-950/70 border border-white/5 flex flex-col gap-1 text-[11.5px] text-zinc-400">
          {familyItems.map((item) => {
            if (item.isCurrent) {
              return (
                <div
                  key={item.id}
                  className="px-2 py-1 rounded bg-white/5 text-primary-container font-bold flex items-center justify-between"
                >
                  <span>{item.label}</span>
                  <span className="text-[9.5px]">현재 앱</span>
                </div>
              );
            }
            const isJoined = joinedApps.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openFamilyAppWithSso(item.url)}
                className="w-full text-left px-2 py-1 rounded hover:bg-white/10 hover:text-white flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="truncate">{item.label}</span>
                <span
                  className={`text-[9.5px] shrink-0 ${
                    isJoined ? 'text-emerald-400 font-bold' : 'text-zinc-500'
                  }`}
                >
                  {isJoined ? '가입됨 · SSO' : 'SSO 연동'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * [3. 허브 전역 모달 & 제트아이 스토어/수파베이스 자동 동기화 엔진]
 */
const ZEyeHubGlobalModals: React.FC = () => {
  const { user, isLoggedIn, balance, refreshSession, refreshBalance } = useHub();
  const hideCoin = useIsCoinHiddenInStore();

  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [isGiftBoxOpen, setIsGiftBoxOpen] = useState(false);

  // 허브 인증/잔액 변화 시 Z-Eye 내부 스토어(merlinAuth) 및 단독 Supabase(`public.users.id = family_users.id`) 자동 동기화
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
        appName="제트아이"
        appLogoUrl="/icon.svg"
        onSuccess={(email, userId) => {
          setIsLoginOpen(false);
          void refreshSession();
          void refreshBalance();
          if (userId && email) {
            void syncHubUserToLocalSupabase({ userId, email });
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
              <button
                type="button"
                onClick={() => setIsProfileOpen(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <HubProfileCard
              hideCoinSection={hideCoin}
              onOpenPurchase={() => {
                setIsProfileOpen(false);
                if (!hideCoin) setIsPurchaseOpen(true);
              }}
            />

            <HubNotificationCard />

            <HubSupportLink appId="ZEye" />

            <HubLogoutCard
              onLogout={() => {
                setIsProfileOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* 3. 3몬스터 패밀리 코인 충전소 모달 (스토어 심사 모드에서는 아예 렌더링하지 않음) */}
      {!hideCoin && (
        <HubPurchaseWidget
          isModal
          isOpen={isPurchaseOpen}
          onClose={() => setIsPurchaseOpen(false)}
          appName="제트아이"
        />
      )}

      {/* 4. 패밀리 선물함 단독 모달 (스토어 심사 모드에서는 아예 렌더링하지 않음) */}
      {!hideCoin && (
        <HubGiftBoxModal
          isOpen={isGiftBoxOpen}
          onClose={() => setIsGiftBoxOpen(false)}
        />
      )}

      {/* 5. 1초 미니 오류·불편 즉시 신고 모달 & 전역 토스트 */}
      <HubBugReporter appId="ZEye" appVersion="v1.0.0" />
      <HubNotifier />
    </>
  );
};

/**
 * [4. 최상위 HubProvider + HubErrorBoundary 래퍼]
 */
export const ZEyeHubRootProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <HubErrorBoundary appId="ZEye">
      <HubProvider appId="ZEye">
        {children}
        <ZEyeHubGlobalModals />
      </HubProvider>
    </HubErrorBoundary>
  );
};
