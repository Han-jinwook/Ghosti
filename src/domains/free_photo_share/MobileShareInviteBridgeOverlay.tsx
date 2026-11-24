import React, { useEffect, useRef, useState } from 'react';
import { isCapacitorNativeMobileRuntime } from '../../services/ghostiMobileCareBridge';
import {
  buildAndroidPlayStoreInviteUrl,
  buildDeferredInviteClipboardToken,
  buildIosStoreInviteUrl,
  buildShareRoomNativeSchemeUrl,
  parseShareInviteInput,
  type ParsedShareInvite,
} from '../../services/shareInviteDeepLinkBridge';

function isMobileWebBrowser(): boolean {
  if (typeof window === 'undefined' || isCapacitorNativeMobileRuntime()) return false;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIpadDesktopUa =
    /Macintosh/i.test(ua) &&
    typeof navigator !== 'undefined' &&
    (navigator.maxTouchPoints || 0) > 1;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || isIpadDesktopUa;
}

function resolveInitialWebInvite(): ParsedShareInvite | null {
  if (!isMobileWebBrowser()) return null;
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('invite') && !params.has('inviteToken') && !params.has('token')) {
      return null;
    }
    return parseShareInviteInput(window.location.href);
  } catch {
    return null;
  }
}

export const MobileShareInviteBridgeOverlay: React.FC = () => {
  const [invite, setInvite] = useState<ParsedShareInvite | null>(() => resolveInitialWebInvite());
  const [storeNotice, setStoreNotice] = useState<string>('');
  const autoLaunchedRef = useRef<boolean>(false);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isAndroid = /Android/i.test(ua);
  const iosStore = buildIosStoreInviteUrl();

  const deepLinkUrl = invite
    ? buildShareRoomNativeSchemeUrl({
        loungeType: invite.loungeType,
        familyRoom: invite.familyRoom,
        inviteToken: invite.inviteToken,
        hostName: invite.hostName,
        roomTitle: invite.roomTitle,
        nicknameHint: invite.nicknameHint,
      })
    : '';

  useEffect(() => {
    if (!invite || !deepLinkUrl || autoLaunchedRef.current) return;
    autoLaunchedRef.current = true;
    const timer = window.setTimeout(() => {
      window.location.href = deepLinkUrl;
    }, 350);
    return () => window.clearTimeout(timer);
  }, [invite, deepLinkUrl]);

  if (!invite || !isMobileWebBrowser()) return null;

  const handleOpenApp = () => {
    if (!deepLinkUrl) return;
    window.location.href = deepLinkUrl;
  };

  const handleGoStore = async () => {
    if (isAndroid) {
      window.location.href = buildAndroidPlayStoreInviteUrl({
        loungeType: invite.loungeType,
        familyRoom: invite.familyRoom,
        inviteToken: invite.inviteToken,
        hostName: invite.hostName,
        roomTitle: invite.roomTitle,
        nicknameHint: invite.nicknameHint,
      });
      return;
    }
    try {
      const clipToken = buildDeferredInviteClipboardToken({
        loungeType: invite.loungeType,
        familyRoom: invite.familyRoom,
        inviteToken: invite.inviteToken,
        roomTitle: invite.roomTitle,
        nicknameHint: invite.nicknameHint,
      });
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(clipToken);
        setStoreNotice('초대 정보가 자동 저장되었습니다. 앱 설치 후 열면 이 공유방으로 바로 입장합니다.');
      }
    } catch {
      /* ignore clipboard error */
    }
    window.location.href = iosStore.primaryUrl;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[295] bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-teal-700 tracking-tight">
              귀신같이 · 사진 공유방 초대
            </p>
            <h2 className="text-[16px] font-bold text-slate-900 mt-0.5 break-keep">
              {invite.roomTitle || '사진 공유방'}에 초대되었습니다
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setInvite(null)}
            className="text-[12px] text-slate-400 hover:text-slate-700 px-1.5 py-0.5 cursor-pointer shrink-0"
          >
            닫기
          </button>
        </div>

        <p className="text-[12.5px] text-slate-600 leading-relaxed break-keep">
          모바일 웹은 앱 이동 안내 화면입니다. 설치된 <b>귀신같이 앱</b>을 열면 초대받은 공유방 사진이 바로 동기화됩니다.
          앱이 없다면 스토어에서 설치 후 열면 이 방으로 이어집니다.
        </p>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleOpenApp}
            className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[13.5px] font-bold cursor-pointer"
          >
            귀신같이 앱에서 공유방 열기
          </button>
          <button
            type="button"
            onClick={() => void handleGoStore()}
            className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-[12.5px] font-semibold cursor-pointer"
          >
            {isAndroid
              ? 'Google Play에서 귀신같이 앱 설치하기'
              : `${iosStore.storeLabelKo}에서 귀신같이 앱 설치하기`}
          </button>
          {storeNotice && (
            <p className="text-[11px] text-teal-700 font-medium text-center break-keep">
              {storeNotice}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
