import React, { useEffect, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { zCoreBridge } from '../services/zCoreBridge';
import { isMobileVoiceEnvironment } from '../services/setupMonsterTts';
import { GHOST_SECRETARY_AVATAR_SRC } from '../services/ghostSecretaryEngine';
import { playBabyGhostChime } from './OnboardingModal';

export type SecretaryGuardContext = 'default' | 'secretary_left';

export interface SecretaryFirstModalPayload {
  context?: SecretaryGuardContext;
  reason?: string;
}

/**
 * 어디서든 『1. 👻 귀신비서』 화면으로 즉시 이동 + 우측 채팅 입력창 포커스
 */
export function jumpToGhostSecretary(): void {
  if (typeof window === 'undefined') return;
  useSaySeeStore.setState({
    activeLoungeType: 'personal',
    desktopTab: 'trash',
    mobileTab: 'trash',
    showFaceRegistryModal: false,
  });
  window.dispatchEvent(new CustomEvent('ghosti_jump_to_secretary'));
  window.setTimeout(() => {
    const inputEl = document.getElementById('ghosti-secretary-chat-input') as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    if (inputEl) {
      inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      inputEl.focus();
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  }, 120);
}

/**
 * 귀여운 '귀신비서 먼저 대화' 안내 모달 전역 호출 헬퍼
 */
export function openGhostSecretaryFirstModal(payload: SecretaryFirstModalPayload = {}): void {
  if (typeof window === 'undefined') return;
  try {
    playBabyGhostChime('summon');
  } catch {
    /* ignore audio errors */
  }
  window.dispatchEvent(
    new CustomEvent<SecretaryFirstModalPayload>('openGhostSecretaryFirstModal', {
      detail: payload,
    })
  );
}

/**
 * 현재 환경이 PC 미연결 '눈으로 구경 모드(클릭·활동 가드 활성)' 대상인지 판별
 * - 모바일 / 네이티브 스토어 앱 / 카톡 무가입 1초 프리뷰(?preview=guest, isGuestPreviewMode) / 독립 귀신검색창(?ghostSearchWindow)은 제외
 */
export function useIsSecretaryFirstBrowseGuardActive(): boolean {
  const layout = useSaySeeStore((s) => s.layout);
  const isStoreAppMode = useSaySeeStore((s) => s.isStoreAppMode);
  const isGuestPreviewMode = useSaySeeStore((s) => s.isGuestPreviewMode);
  const [connected, setConnected] = useState<boolean>(zCoreBridge.isConnected);

  useEffect(() => {
    setConnected(zCoreBridge.isConnected);
    return zCoreBridge.subscribe((c) => setConnected(c));
  }, []);

  if (connected) return false;
  if (layout === 'mobile' || isStoreAppMode || isMobileVoiceEnvironment()) return false;
  if (isGuestPreviewMode) return false;

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('preview') === 'guest' || params.get('ghostSearchWindow')) {
      return false;
    }
  }

  return true;
}

const INTERACTIVE_TARGET_SELECTOR = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  'label',
  'article',
  '[role="button"]',
  '[role="tab"]',
  '[tabindex]',
  '[data-guard-interactive="true"]',
  '.cursor-pointer',
  '.cursor-context-menu',
].join(', ');

interface GhostSecretaryFirstGuardProps {
  children: React.ReactNode;
  context?: SecretaryGuardContext;
  disabled?: boolean;
  className?: string;
}

/**
 * 👀 메뉴 구경 허용 + 클릭/활동 차단 & 귀여운 『👻 귀신비서』 대화 유도 래퍼
 * - 스크롤(wheel, touchmove, 스크롤바)은 100% 자유롭게 허용하여 모든 메뉴를 눈으로 구경 가능
 * - 내부 버튼·입력창·카드·우클릭 소환·단축키 활동을 시도하면 귀여운 애기귀신 말풍선 모달로 『1. 👻 귀신비서』 대화를 먼저 안내
 */
export const GhostSecretaryFirstGuard: React.FC<GhostSecretaryFirstGuardProps> = ({
  children,
  context = 'default',
  disabled = false,
  className = '',
}) => {
  const guardActive = useIsSecretaryFirstBrowseGuardActive();

  if (disabled || !guardActive) {
    return <>{children}</>;
  }

  const isAllowedElement = (target: EventTarget | null): boolean => {
    const el = target instanceof Element ? target : null;
    if (!el) return false;
    return Boolean(el.closest('[data-allow-secretary-jump="true"]'));
  };

  const isInteractiveTarget = (target: EventTarget | null): boolean => {
    const el = target instanceof Element ? target : null;
    if (!el) return false;
    return Boolean(el.closest(INTERACTIVE_TARGET_SELECTOR));
  };

  const interceptActivity = (e: React.SyntheticEvent) => {
    if (isAllowedElement(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.target instanceof HTMLElement) {
      try {
        e.target.blur();
      } catch {
        /* ignore */
      }
    }
    openGhostSecretaryFirstModal({ context });
  };

  return (
    <div
      className={className || 'contents'}
      data-secretary-browse-guard="active"
      onClickCapture={(e) => {
        if (isAllowedElement(e.target)) return;
        if (isInteractiveTarget(e.target)) {
          interceptActivity(e);
        }
      }}
      onContextMenuCapture={(e) => {
        if (isAllowedElement(e.target)) return;
        interceptActivity(e);
      }}
      onMouseDownCapture={(e) => {
        if (isAllowedElement(e.target)) return;
        // 우클릭(0.35초 홀드 소환 시도) 또는 입력창 포커스 시도는 마우스 다운 즉시 귀엽게 안내
        if (e.button === 2) {
          interceptActivity(e);
          return;
        }
        const el = e.target instanceof Element ? e.target : null;
        if (el?.closest('input, textarea, select, [data-guard-interactive="true"]')) {
          interceptActivity(e);
        }
      }}
      onFocusCapture={(e) => {
        if (isAllowedElement(e.target)) return;
        const el = e.target instanceof Element ? e.target : null;
        if (el?.closest('input, textarea, select')) {
          interceptActivity(e);
        }
      }}
      onKeyDownCapture={(e) => {
        if (isAllowedElement(e.target)) return;
        if (e.key === 'Enter' || e.key === ' ' || (e.ctrlKey && e.key === '0')) {
          interceptActivity(e);
        }
      }}
      onSubmitCapture={interceptActivity}
      onChangeCapture={interceptActivity}
    >
      {children}
    </div>
  );
};

/**
 * 👻 귀여운 애기귀신 『귀신비서와 먼저 대화하고 오세요!』 전역 안내 모달
 */
export const GhostSecretaryFirstModal: React.FC<{ themeMode?: 'light' | 'dark' }> = ({
  themeMode = 'dark',
}) => {
  const guardActive = useIsSecretaryFirstBrowseGuardActive();
  const [openPayload, setOpenPayload] = useState<SecretaryFirstModalPayload | null>(null);

  useEffect(() => {
    const onOpen = (ev: Event) => {
      const custom = ev as CustomEvent<SecretaryFirstModalPayload>;
      setOpenPayload(custom.detail || { context: 'default' });
    };
    window.addEventListener('openGhostSecretaryFirstModal', onOpen);
    return () => window.removeEventListener('openGhostSecretaryFirstModal', onOpen);
  }, []);

  // 엔진이 연결되면 열려 있던 안내창도 자동으로 닫힘
  useEffect(() => {
    if (!guardActive && openPayload) {
      setOpenPayload(null);
    }
  }, [guardActive, openPayload]);

  if (!openPayload) return null;

  const isLight = themeMode === 'light';
  const isSecretaryLeft = openPayload.context === 'secretary_left';

  const handleGoToSecretary = () => {
    setOpenPayload(null);
    jumpToGhostSecretary();
  };

  return (
    <div
      className="fixed inset-0 z-[135] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={() => setOpenPayload(null)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border-2 transition-all flex flex-col items-center text-center gap-4 ${
          isLight
            ? 'bg-white border-teal-400 text-slate-900 shadow-teal-500/20'
            : 'bg-zinc-950 border-[#2DD4BF]/70 text-zinc-100 shadow-[0_0_45px_rgba(45,212,191,0.22)]'
        }`}
      >
        {/* 애기귀신 둥실둥실 아이콘 + 귀여운 말풍선 배지 */}
        <div className="relative flex flex-col items-center gap-2 pt-1">
          <span className="px-3 py-1 rounded-full text-[11.5px] font-black bg-teal-500/15 text-teal-600 dark:text-[#5EEAD4] border border-teal-400/40">
            👀 지금은 눈으로 편하게 구경 중이에요!
          </span>
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-b from-teal-500/20 to-emerald-500/10 border-2 border-[#2DD4BF]/50 flex items-center justify-center shadow-lg animate-bounce mt-1 overflow-hidden">
            <img
              src={GHOST_SECRETARY_AVATAR_SRC}
              alt="애기귀신 귀신비서"
              className="w-16 h-16 object-contain drop-shadow"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-[18px] sm:text-[19px] font-black tracking-tight leading-snug">
            {isSecretaryLeft
              ? "헤헤, 오른쪽 채팅창에서 저('귀신비서')랑 먼저 대화해요! 👻"
              : "잠깐만요! 먼저 '귀신비서'와 대화를 나누고 오실래요? 헤헤 👻"}
          </h3>
          <p
            className={`text-[13px] leading-relaxed font-medium ${
              isLight ? 'text-slate-600' : 'text-zinc-300'
            }`}
          >
            {isSecretaryLeft ? (
              <>
                왼쪽 정리 화면은 어떤 기능인지 보여드리는 <strong>구경용 미리보기</strong>예요!
                <br />
                오른쪽 <strong>『👻 귀신비서』</strong> 채팅창에서 별명을 알려주시고 손보기 엔진을 깨워주시면, 내 진짜 사진·문서를 조용히 읽어서 바로 정리해 드릴게요!
              </>
            ) : (
              <>
                메뉴들을 눌러보고 위아래로 스크롤하며 <strong>구경하시는 건 언제든 환영</strong>이에요!
                <br />
                다만 버튼을 클릭해 직접 활동하거나 내 진짜 사진·문서로 테스트해 보시려면, 먼저 첫 번째 메뉴인{' '}
                <strong className="text-teal-600 dark:text-[#5EEAD4]">『👻 귀신비서』</strong>와 대화를 나누고 오셔야 열려요!
              </>
            )}
          </p>
        </div>

        <div className="w-full flex flex-col gap-2 pt-1">
          <button
            type="button"
            data-allow-secretary-jump="true"
            onClick={handleGoToSecretary}
            className="w-full py-3.5 px-5 rounded-2xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 font-black text-[14px] shadow-lg shadow-teal-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>
              {isSecretaryLeft
                ? "💬 오른쪽 '귀신비서' 채팅창으로 바로 가기 ➔"
                : "👻 '귀신비서'와 먼저 대화하러 가기 ➔"}
            </span>
          </button>
          <button
            type="button"
            data-allow-secretary-jump="true"
            onClick={() => setOpenPayload(null)}
            className={`w-full py-2.5 px-4 rounded-2xl font-bold text-[12.5px] border transition-all cursor-pointer ${
              isLight
                ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                : 'bg-zinc-900 border-white/10 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            👀 알겠어요, 계속 눈으로 구경할게요
          </button>
        </div>
      </div>
    </div>
  );
};
