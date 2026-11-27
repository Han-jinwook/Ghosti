import React, { useEffect, useState } from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { isMobileOrStoreRuntime } from '../../store/slices/storeSharedRefs';
import {
  getThisDeviceIdentity,
  pullRecentDirectPhotoToPc,
  readCurrentOsClipboardForDevice,
  writeTextToLocalOsClipboard,
  type GhostiDirectPhotoDropItem,
} from '../../services/deviceIntegrationService';
import { getZCoreUrl, zCoreBridge } from '../../services/zCoreBridge';
import { formatKoreaDateShort } from '../../services/subscriptionPlanCatalog';

export const CrossDeviceClipboardAndPairingBar: React.FC<{ compact?: boolean }> = ({
  compact = false,
}) => {
  const {
    merlinAuth,
    isStoreAppMode,
    connectedDevices,
    devicePairingCode6,
    deviceEntitlement,
    syncedClipboardItems,
    thisDeviceRevoked,
    lastRevokedPeerDevice,
    refreshDeviceIntegrationState,
    pairWithSixDigitCode,
    unlinkConnectedDevice,
    reconnectThisDevice,
    reconnectPeerDevice,
    sendTextToPairedClipboard,
    sendClipToPhoneNotification,
    openLocalFolder,
    setShowProModal,
    openSubscriptionCheckout,
  } = useSaySeeStore();

  const [codeInput, setCodeInput] = useState('');
  const [clipDraft, setClipDraft] = useState('');
  const [sendingClip, setSendingClip] = useState(false);
  const [pullingLocalClip, setPullingLocalClip] = useState(false);
  const [pairingBusy, setPairingBusy] = useState(false);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const [reconnectingBusy, setReconnectingBusy] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [sentPhoneHash, setSentPhoneHash] = useState<string | null>(null);
  const [zCoreConnected, setZCoreConnected] = useState<boolean>(zCoreBridge.isConnected);
  const [clipSearchQuery, setClipSearchQuery] = useState('');
  const [showAllClips, setShowAllClips] = useState(false);
  const [recentDirectPhoto, setRecentDirectPhoto] = useState<GhostiDirectPhotoDropItem | null>(
    null
  );
  const [reloadingPhotoClip, setReloadingPhotoClip] = useState(false);

  useEffect(() => zCoreBridge.subscribe((alive) => setZCoreConnected(alive)), []);

  const isLoggedIn = Boolean(
    merlinAuth?.email && merlinAuth.userId && merlinAuth.userId !== 'guest'
  );
  const hidePricingForStore = Boolean(isStoreAppMode) || isMobileOrStoreRuntime();
  const thisDeviceIdentity = getThisDeviceIdentity();
  const isMobileDevice = thisDeviceIdentity.deviceKind === 'mobile';

  useEffect(() => {
    if (!isLoggedIn || isMobileDevice || thisDeviceRevoked) {
      setRecentDirectPhoto(null);
      return;
    }
    let cancelled = false;
    void pullRecentDirectPhotoToPc().then((item) => {
      if (!cancelled && item) {
        setRecentDirectPhoto(item);
      }
    });
    const onDirectPhoto = (ev: Event) => {
      const detail = (ev as CustomEvent<GhostiDirectPhotoDropItem>).detail;
      if (!detail || !detail.dropId || !detail.signedDownloadUrl) return;
      setRecentDirectPhoto(detail);
      useSaySeeStore.setState({
        lastQuarantineToast: `🖼️ 스마트폰 사진 도착 (${detail.fileName || '사진'}) — 바로 Ctrl+V로 붙여넣으세요!`,
      });
    };
    window.addEventListener('ghosti_direct_photo_arrived', onDirectPhoto as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener('ghosti_direct_photo_arrived', onDirectPhoto as EventListener);
    };
  }, [isLoggedIn, isMobileDevice, thisDeviceRevoked, merlinAuth?.email]);

  const openLoginModal = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openLoginModal'));
    }
  };

  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      useSaySeeStore.setState({
        lastQuarantineToast: isMobileDevice
          ? '현재 게스트(비로그인) 상태입니다. PC와 같은 이메일로 먼저 로그인한 뒤 기기를 연결해 주세요.'
          : '현재 게스트(비로그인) 상태입니다. 먼저 로그인한 뒤 스마트폰과 기기를 연결해 주세요.',
      });
      openLoginModal();
      return;
    }
    const clean = codeInput.replace(/\D/g, '').slice(0, 6);
    if (clean.length !== 6) return;
    setPairingBusy(true);
    const ok = await pairWithSixDigitCode(clean);
    setPairingBusy(false);
    if (ok) setCodeInput('');
  };

  const handleSendClip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      useSaySeeStore.setState({
        lastQuarantineToast: isMobileDevice
          ? '현재 게스트(비로그인) 상태입니다. PC와 같은 이메일로 먼저 로그인해 주세요.'
          : '현재 게스트(비로그인) 상태입니다. 먼저 로그인해 주세요.',
      });
      openLoginModal();
      return;
    }
    const trimmed = clipDraft.trim();
    if (!trimmed) return;
    setSendingClip(true);
    const ok = await sendTextToPairedClipboard(trimmed);
    setSendingClip(false);
    if (ok) setClipDraft('');
  };

  const handleSendCurrentOsClipboardToPhone = async () => {
    if (!isLoggedIn || !merlinAuth?.email || !merlinAuth?.userId) {
      openLoginModal();
      return;
    }
    setPullingLocalClip(true);
    try {
      const draftClean = clipDraft.trim();
      if (draftClean) {
        const ok = await sendClipToPhoneNotification(draftClean);
        if (ok) setClipDraft('');
        return;
      }
      const read = await readCurrentOsClipboardForDevice({ isUserGesture: true });
      const text = (read.text || '').trim();
      if (text) {
        await sendClipToPhoneNotification(text);
      } else {
        useSaySeeStore.setState({
          lastQuarantineToast: '전송할 텍스트를 입력하거나 먼저 복사(Ctrl+C)해 주세요.',
        });
      }
    } finally {
      setPullingLocalClip(false);
    }
  };

  return (
    <div
      className={`rounded-xl bg-white border border-slate-200 flex flex-col gap-3 ${
        compact ? 'p-3.5' : 'p-4 md:p-5'
      }`}
    >
      {/* 1. 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[14px] font-semibold text-slate-900">7일 통합 클립보드 보관함</h3>
          {isLoggedIn && (
            <span className="text-[12px] text-slate-500">
              {thisDeviceRevoked
                ? '· 이 기기 연결 해제됨'
                : connectedDevices.length >= 2
                ? `· 기기 ${connectedDevices.length}대 연결됨`
                : '· 현재 기기만 로그인됨 (다른 기기 연결 대기)'}
              {!thisDeviceRevoked && !isMobileDevice && !zCoreConnected
                ? ' (외부 앱 자동 감지는 PC 엔진 필요)'
                : ''}
            </span>
          )}
          {isLoggedIn && deviceEntitlement?.isPaidUnlimited && !hidePricingForStore && (
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
              Pro 이용 중
              {deviceEntitlement.paidExpiresAt
                ? ` (${formatKoreaDateShort(deviceEntitlement.paidExpiresAt)}까지)`
                : ''}
            </span>
          )}
          {isLoggedIn &&
            !deviceEntitlement?.isPaidUnlimited &&
            deviceEntitlement?.trialActive && (
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                {hidePricingForStore
                  ? `연동 활성 (${deviceEntitlement.trialDaysLeft}일 남음)`
                  : `무료체험 중 (${deviceEntitlement.trialDaysLeft}일 남음)`}
              </span>
            )}
          {isLoggedIn &&
            !deviceEntitlement?.isPaidUnlimited &&
            deviceEntitlement?.trialExpired && (
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium">
                무료체험 종료
              </span>
            )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {isLoggedIn &&
            !hidePricingForStore &&
            !deviceEntitlement?.isPaidUnlimited &&
            !deviceEntitlement?.trialActive &&
            !deviceEntitlement?.trialExpired && (
              <button
                type="button"
                onClick={() => void refreshDeviceIntegrationState(true)}
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer transition-colors"
              >
                30일 무료체험 시작
              </button>
            )}
          {isLoggedIn &&
            !hidePricingForStore &&
            !deviceEntitlement?.isPaidUnlimited &&
            deviceEntitlement?.trialExpired && (
              <button
                type="button"
                onClick={() => openSubscriptionCheckout('personal_sub_3900')}
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer transition-colors"
              >
                Pro 구독 (월 3,900원)
              </button>
            )}
          {isLoggedIn && !hidePricingForStore && deviceEntitlement?.isPaidUnlimited && (
            <button
              type="button"
              onClick={() => openSubscriptionCheckout('personal_sub_3900')}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer"
            >
              기간 연장
            </button>
          )}
          {isLoggedIn && !hidePricingForStore && !deviceEntitlement?.isPaidUnlimited && (
            <button
              type="button"
              onClick={() => setShowProModal(true)}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer"
            >
              요금제 안내
            </button>
          )}
        </div>
      </div>

      {/* 1.5. 연결 해제 상태(현재 기기 또는 방금 해제한 상대 기기) 또는 연결된 기기 목록 */}
      {isLoggedIn && (thisDeviceRevoked || Boolean(lastRevokedPeerDevice)) && (
        <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[12px]">
          <span className="text-slate-700">
            {thisDeviceRevoked
              ? '이 기기의 연결이 해제되어 있습니다.'
              : `${lastRevokedPeerDevice?.displayName || '상대 기기'}의 연결이 해제되어 있습니다.`}
          </span>
          <button
            type="button"
            disabled={reconnectingBusy}
            onClick={async () => {
              setReconnectingBusy(true);
              if (thisDeviceRevoked) {
                await reconnectThisDevice();
              } else if (lastRevokedPeerDevice) {
                await reconnectPeerDevice(lastRevokedPeerDevice.deviceId);
              }
              setReconnectingBusy(false);
            }}
            className="px-2.5 py-1 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-[11.5px] font-semibold cursor-pointer disabled:opacity-50 shrink-0"
          >
            {reconnectingBusy ? '연결 중...' : '다시 연결'}
          </button>
        </div>
      )}

      {isLoggedIn && !thisDeviceRevoked && connectedDevices.length > 0 && (
        <div className="flex flex-col gap-2 py-1 text-[12px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500 font-medium">연결된 기기 ({connectedDevices.length}대)</span>
            {connectedDevices.filter((d) => d.device_id !== thisDeviceIdentity.deviceId).length >= 2 && (
              <button
                type="button"
                disabled={Boolean(revokingDeviceId)}
                onClick={async () => {
                  const others = connectedDevices.filter(
                    (d) => d.device_id !== thisDeviceIdentity.deviceId
                  );
                  for (const dev of others) {
                    setRevokingDeviceId(dev.device_id);
                    await unlinkConnectedDevice(dev.device_id);
                  }
                  setRevokingDeviceId(null);
                }}
                className="px-2 py-0.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 text-[11px] font-medium cursor-pointer disabled:opacity-50 shrink-0"
              >
                다른 기기 전체 정리
              </button>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1.5">
            {connectedDevices.map((dev) => {
              const isCurrent = dev.device_id === thisDeviceIdentity.deviceId;
              const isBusy = revokingDeviceId === dev.device_id;
              return (
                <div
                  key={dev.device_id}
                  className="flex items-center justify-between gap-3 w-full sm:w-auto px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[12px] text-slate-800"
                >
                  <span className="font-medium truncate min-w-0 flex-1">
                    {dev.display_name}
                    {isCurrent ? ' (현재 기기)' : ''}
                  </span>
                  <button
                    type="button"
                    disabled={isBusy}
                    data-testid={`unlink-device-${dev.device_id}`}
                    onClick={async () => {
                      setRevokingDeviceId(dev.device_id);
                      await unlinkConnectedDevice(dev.device_id);
                      setRevokingDeviceId(null);
                    }}
                    className="text-slate-400 hover:text-rose-600 text-[11px] font-medium cursor-pointer disabled:opacity-50 transition-colors shrink-0 whitespace-nowrap"
                  >
                    {isBusy ? '해제 중' : '연결 해제'}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            같은 이메일 계정으로 연결된 모든 기기(PC · 아이폰 · 안드로이드)가 함께 표시됩니다.
          </p>
        </div>
      )}

      {/* 2. 6자리 연결 번호 (비로그인 게스트일 때는 명확한 로그인 필요 안내 배너 노출) */}
      {!isLoggedIn ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg bg-amber-50/80 border border-amber-200 text-[12px]">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-semibold text-amber-900">
              로그인이 필요합니다 (현재 게스트 상태)
            </span>
            <span className="text-amber-800/90 text-[11.5px] leading-snug break-keep">
              {isMobileDevice
                ? 'PC와 같은 이메일로 먼저 로그인해야 기기 연결(6자리 번호 · QR)과 클립보드 공유를 사용할 수 있습니다.'
                : '먼저 로그인해야 스마트폰과 기기 연결(QR · 6자리 번호) 및 클립보드 공유를 사용할 수 있습니다. (모바일 앱에서도 같은 이메일로 로그인하면 자동 연결됩니다)'}
            </span>
          </div>
          <button
            type="button"
            onClick={openLoginModal}
            className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer shrink-0 whitespace-nowrap self-start sm:self-center"
          >
            {isMobileDevice ? 'PC와 같은 이메일로 로그인' : '로그인하기'}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[12px]">
          <div className="flex flex-wrap items-center gap-2">
            {devicePairingCode6 ? (
              <>
                <span className="text-slate-600 font-medium">기기 연결 번호</span>
                <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-900 font-mono text-[13px] font-semibold tracking-wider">
                  {devicePairingCode6.slice(0, 3)}-{devicePairingCode6.slice(3, 6)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void refreshDeviceIntegrationState({ forceRefreshPairingCode: true })
                  }
                  className="text-[11.5px] text-slate-500 hover:text-slate-800 underline cursor-pointer whitespace-nowrap"
                >
                  새 번호 발급
                </button>
              </>
            ) : (
              <span className="text-slate-500">
                같은 이메일로 로그인하거나 6자리 연결 번호로 기기를 등록할 수 있습니다.
              </span>
            )}
          </div>

          <form onSubmit={handlePairSubmit} className="flex items-center gap-1.5 shrink-0">
            <input
              type="text"
              inputMode="numeric"
              maxLength={7}
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="6자리 번호"
              className="w-24 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-900 font-mono text-[12px] placeholder-slate-400 focus:outline-none focus:border-slate-400"
            />
            <button
              type="submit"
              disabled={pairingBusy}
              className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11.5px] font-medium cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {pairingBusy ? '확인 중...' : '연결'}
            </button>
          </form>
        </div>
      )}

      {/* 3. 텍스트 전송 */}
      <form onSubmit={handleSendClip} className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={clipDraft}
          onChange={(e) => setClipDraft(e.target.value)}
          placeholder={
            isLoggedIn
              ? '전송할 내용을 입력하거나 복사(Ctrl+C)하세요'
              : '로그인 후 사용할 수 있습니다'
          }
          className="flex-1 min-w-[180px] px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 text-[13px] placeholder-slate-400 focus:outline-none focus:border-slate-400"
        />
        {isLoggedIn && !isMobileDevice && (
          <button
            type="button"
            disabled={pullingLocalClip}
            onClick={() => void handleSendCurrentOsClipboardToPhone()}
            className="px-3 py-2 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 text-[12px] font-semibold shrink-0 cursor-pointer disabled:opacity-50"
          >
            {pullingLocalClip ? '전송 중...' : '📱 폰으로 보내기'}
          </button>
        )}
        <button
          type="submit"
          disabled={sendingClip}
          className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold shrink-0 cursor-pointer disabled:opacity-50"
        >
          {!isLoggedIn ? '로그인' : sendingClip ? '전송 중...' : isMobileDevice ? 'PC로 보내기' : '보관함 저장'}
        </button>
      </form>

      <p className="text-[11.5px] text-slate-500 leading-normal break-keep">
        카톡 &lsquo;나에게 보내기&rsquo; 없이 <strong>7일간(최대 500건)</strong> 암호화 보관됩니다. <strong>PC끼리는 Ctrl+C만 누르면 바로 붙고</strong>, 스마트폰에서는 귀신같이 앱을 열 필요 없이 <strong>안드로이드 [드래그 ➔ PC로 보내기] 1탭 · 아이폰 [공유... ➔ 귀신같이] 2탭</strong>(사진·스크린샷은 <strong>[공유 ➔ 귀신같이] 2탭</strong>)으로 PC Ctrl+V와 이 화면에 즉시 도착합니다. PC에서 폰으로 보낼 때는 이 화면의 <strong>[📱 폰으로 보내기]</strong>를 눌러 폰 알림의 <strong>[📋 복사]</strong> 버튼 1탭으로 복사하세요.
      </p>

      {/* 3.5. 스마트폰 [공유 ➔ 귀신같이] 최근 직송 도착 사진 (4. 내 기기 통합 화면 즉시 표시) */}
      {isLoggedIn && !isMobileDevice && recentDirectPhoto && (
        <div className="px-3 py-2.5 rounded-lg bg-teal-50/60 border border-teal-200/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <a
              href={recentDirectPhoto.signedDownloadUrl}
              target="_blank"
              rel="noreferrer"
              className="w-12 h-12 rounded-lg overflow-hidden border border-teal-200 bg-white shrink-0 block"
              title="원본 크게 보기"
            >
              <img
                src={recentDirectPhoto.signedDownloadUrl}
                alt={recentDirectPhoto.fileName}
                className="w-full h-full object-cover"
              />
            </a>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold text-teal-800">
                🖼️ 스마트폰 사진 직송 도착 · 바로 Ctrl+V 가능
              </span>
              <span className="text-[12.5px] font-medium text-slate-900 truncate">
                {recentDirectPhoto.fileName}
              </span>
              <span className="text-[11px] text-slate-500 truncate">
                {recentDirectPhoto.senderName || '내 스마트폰'} · PC 클립보드(Ctrl+V) 및 내 기기 백업 폴더에 저장됨
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {zCoreConnected && (
              <button
                type="button"
                disabled={reloadingPhotoClip}
                onClick={async () => {
                  setReloadingPhotoClip(true);
                  try {
                    await fetch(getZCoreUrl('/__sync/direct-photo-drop'), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ...recentDirectPhoto,
                        dropId: `${recentDirectPhoto.dropId}_reload_${Date.now()}`,
                        accountEmail: merlinAuth?.email || '',
                      }),
                    });
                    useSaySeeStore.setState({
                      lastQuarantineToast: '사진을 PC 클립보드(Ctrl+V)에 다시 담았습니다.',
                    });
                  } catch {
                    /* ignore */
                  } finally {
                    setReloadingPhotoClip(false);
                  }
                }}
                className="px-2.5 py-1 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-[11.5px] font-semibold cursor-pointer disabled:opacity-50"
              >
                {reloadingPhotoClip ? '장전 중...' : 'Ctrl+V 다시 담기'}
              </button>
            )}
            <button
              type="button"
              onClick={() => void openLocalFolder('phone_backup')}
              className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11.5px] font-medium cursor-pointer"
            >
              백업 폴더 열기
            </button>
          </div>
        </div>
      )}

      {/* 4. 최근 공유 목록 (7일 보관 · 최대 500건) */}
      {isLoggedIn && syncedClipboardItems.length > 0 && (() => {
        const q = clipSearchQuery.trim().toLowerCase();
        const filteredClips = q
          ? syncedClipboardItems.filter(
              (c) =>
                c.text.toLowerCase().includes(q) || c.senderName.toLowerCase().includes(q)
            )
          : syncedClipboardItems;
        const visibleClips = showAllClips ? filteredClips : filteredClips.slice(0, 6);
        return (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11.5px] font-medium text-slate-500">
                7일 보관 기록 ({syncedClipboardItems.length}건 / 최대 500건)
              </span>
              {syncedClipboardItems.length > 6 && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={clipSearchQuery}
                    onChange={(e) => setClipSearchQuery(e.target.value)}
                    placeholder="클립보드 검색..."
                    className="w-36 px-2 py-1 rounded-md bg-white border border-slate-200 text-[11.5px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAllClips((v) => !v)}
                    className="px-2 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-medium cursor-pointer whitespace-nowrap"
                  >
                    {showAllClips ? '접기' : `전체 보기 (${filteredClips.length})`}
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-col divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white max-h-[360px] overflow-y-auto">
              {visibleClips.map((clip) => {
                const isCopied = copiedHash === clip.clipHash;
                const isSentPhone = sentPhoneHash === clip.clipHash;
                return (
                  <div
                    key={`${clip.clipHash}:${clip.createdAt}`}
                    className="px-3 py-2 flex items-center justify-between gap-2.5 hover:bg-slate-50/70"
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[11px] text-slate-400 truncate">
                        {clip.senderName.replace(/^[⚡📋📱💻\s]+/, '')}
                      </span>
                      <p className="text-[13px] text-slate-800 truncate">{clip.text}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isMobileDevice && (
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await sendClipToPhoneNotification(clip.text);
                            if (ok) {
                              setSentPhoneHash(clip.clipHash);
                              window.setTimeout(() => setSentPhoneHash(null), 2200);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-md text-[11.5px] font-semibold shrink-0 cursor-pointer border transition-colors ${
                            isSentPhone
                              ? 'bg-teal-600 text-white border-teal-600'
                              : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border-teal-200'
                          }`}
                        >
                          {isSentPhone ? '전송됨' : '📱 폰으로 보내기'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          await writeTextToLocalOsClipboard(clip.text, clip.clipHash);
                          setCopiedHash(clip.clipHash);
                          window.setTimeout(() => setCopiedHash(null), 2000);
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11.5px] font-medium shrink-0 cursor-pointer border ${
                          isCopied
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {isCopied ? '복사됨' : '복사'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
