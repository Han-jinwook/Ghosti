import React, { useEffect, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { zCoreBridge } from '../services/zCoreBridge';
import { isMobileVoiceEnvironment } from '../services/setupMonsterTts';
import { playBabyGhostChime } from './OnboardingModal';

export type SecretaryGuardContext = 'default' | 'secretary_left' | 'shared_room_upload';

export interface SecretaryFirstModalPayload {
  context?: SecretaryGuardContext;
  reason?: string;
  roomTitle?: string;
}

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

export function openGhostSecretaryFirstModal(payload: SecretaryFirstModalPayload = {}): void {
  if (typeof window === 'undefined') return;
  try {
    playBabyGhostChime('summon');
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent<SecretaryFirstModalPayload>('openGhostSecretaryFirstModal', {
      detail: payload,
    })
  );
}

export function useIsSecretaryFirstBrowseGuardActive(): boolean {
  const layout = useSaySeeStore((s) => s.layout);
  const isStoreAppMode = useSaySeeStore((s) => s.isStoreAppMode);
  const isGuestPreviewMode = useSaySeeStore((s) => s.isGuestPreviewMode);
  const activeLoungeType = useSaySeeStore((s) => s.activeLoungeType);
  const isInvitedMemberSession = useSaySeeStore((s) => s.isInvitedMemberSession);
  const [connected, setConnected] = useState<boolean>(zCoreBridge.isConnected);

  useEffect(() => {
    setConnected(zCoreBridge.isConnected);
    return zCoreBridge.subscribe((c) => setConnected(c));
  }, []);

  if (connected) return false;
  if (layout === 'mobile' || isStoreAppMode || isMobileVoiceEnvironment()) return false;
  if (isGuestPreviewMode) return false;
  if (
    activeLoungeType === 'family' ||
    activeLoungeType === 'club' ||
    activeLoungeType === 'student' ||
    activeLoungeType === 'work' ||
    isInvitedMemberSession
  ) {
    return false;
  }

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('preview') === 'guest' ||
      params.has('invite') ||
      params.has('workRoom') ||
      params.has('token') ||
      params.get('ghostSearchWindow')
    ) {
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

export const GhostSecretaryFirstGuard: React.FC<GhostSecretaryFirstGuardProps> = ({
  children,
  context = 'default',
  disabled = false,
  className = '',
}) => {
  const guardActive = useIsSecretaryFirstBrowseGuardActive();

  if (disabled || !guardActive) {
    return className ? <div className={className}>{children}</div> : <>{children}</>;
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

export const GhostSecretaryFirstModal: React.FC = () => {
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

  useEffect(() => {
    if (zCoreBridge.isConnected && openPayload) {
      setOpenPayload(null);
    } else if (!guardActive && openPayload && openPayload.context !== 'shared_room_upload') {
      setOpenPayload(null);
    }
  }, [guardActive, openPayload]);

  if (!openPayload) return null;
  const isSecretaryLeft = openPayload.context === 'secretary_left';
  const isSharedRoomUpload = openPayload.context === 'shared_room_upload';
  const roomTitle = openPayload.roomTitle || '공유 앨범';

  const handleGoToSecretary = () => {
    setOpenPayload(null);
    jumpToGhostSecretary();
  };

  return (
    <div
      className="fixed inset-0 z-[135] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      onClick={() => setOpenPayload(null)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl p-6 shadow-2xl border bg-white border-slate-200 text-slate-900 flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-slate-500">
            {isSharedRoomUpload ? 'PC 연결 필요' : '미리보기 안내'}
          </span>
          <h3 className="text-[17px] font-bold tracking-tight leading-snug text-slate-900">
            {isSharedRoomUpload
              ? `${roomTitle}에 사진을 추가하려면 PC 연결이 필요합니다`
              : isSecretaryLeft
              ? '오른쪽 귀신비서 대화창에서 시작해 주세요'
              : '먼저 귀신비서에서 내 컴퓨터를 연결해 주세요'}
          </h3>
          <p className="text-[13px] leading-relaxed text-slate-600">
            {isSharedRoomUpload
              ? '귀신비서 메뉴에서 PC 엔진을 연결하면 내 컴퓨터의 사진을 바로 골라 올릴 수 있습니다.'
              : isSecretaryLeft
              ? '왼쪽은 미리보기 화면입니다. 오른쪽 대화창에서 PC 엔진을 연결하면 실제 파일을 정리할 수 있습니다.'
              : '화면은 자유롭게 둘러볼 수 있으며, 실제 내 파일을 검색하거나 정리하려면 첫 번째 메뉴인 귀신비서에서 PC 연결을 먼저 진행해 주세요.'}
          </p>
        </div>

        <div className="w-full flex flex-col gap-2 pt-1">
          <button
            type="button"
            data-allow-secretary-jump="true"
            onClick={handleGoToSecretary}
            className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[13px] cursor-pointer"
          >
            귀신비서로 이동
          </button>
          <button
            type="button"
            data-allow-secretary-jump="true"
            onClick={() => setOpenPayload(null)}
            className="w-full py-2 px-4 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-medium text-[12.5px] cursor-pointer"
          >
            계속 둘러보기
          </button>
        </div>
      </div>
    </div>
  );
};
