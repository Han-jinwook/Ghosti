import React, { useEffect, useState } from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { isMobileOrStoreRuntime } from '../../store/slices/storeSharedRefs';
import {
  captureAndPushCurrentOsClipboard,
  getThisDeviceIdentity,
  writeTextToLocalOsClipboard,
} from '../../services/deviceIntegrationService';
import { zCoreBridge } from '../../services/zCoreBridge';
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
    refreshDeviceIntegrationState,
    pairWithSixDigitCode,
    unlinkConnectedDevice,
    reconnectThisDevice,
    sendTextToPairedClipboard,
    setDeviceIntegrationSnapshot,
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
  const [zCoreConnected, setZCoreConnected] = useState<boolean>(zCoreBridge.isConnected);

  useEffect(() => zCoreBridge.subscribe((alive) => setZCoreConnected(alive)), []);

  const isLoggedIn = Boolean(
    merlinAuth?.email && merlinAuth.userId && merlinAuth.userId !== 'guest'
  );
  const hidePricingForStore = Boolean(isStoreAppMode) || isMobileOrStoreRuntime();
  const thisDeviceIdentity = getThisDeviceIdentity();
  const isMobileDevice = thisDeviceIdentity.deviceKind === 'mobile';

  const openLoginModal = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openLoginModal'));
    }
  };

  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
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

  const handleSendCurrentOsClipboard = async () => {
    if (!isLoggedIn || !merlinAuth?.email || !merlinAuth?.userId) {
      openLoginModal();
      return;
    }
    setPullingLocalClip(true);
    try {
      const res = await captureAndPushCurrentOsClipboard({
        email: merlinAuth.email,
        userId: merlinAuth.userId,
        isUserGesture: true,
      });
      if (res.ok && res.item) {
        setDeviceIntegrationSnapshot({ incomingClip: res.item });
        useSaySeeStore.setState({
          lastQuarantineToast:
            '📋 방금 복사한 글이 연결된 내 기기로 암호화 전송되었습니다! 바로 붙여넣기 하세요.',
        });
      } else {
        useSaySeeStore.setState({
          lastQuarantineToast:
            res.reason === 'EMPTY'
              ? '📋 현재 기기에 복사된 글자가 없습니다. 먼저 원하는 문장을 복사한 뒤 다시 눌러 주세요.'
              : '📋 브라우저 클립보드 읽기 권한이 차단되어 있어요. 아래 입력칸에 붙여넣기(Ctrl+V) 후 전송 버튼을 눌러 주세요.',
        });
      }
    } finally {
      setPullingLocalClip(false);
    }
  };

  return (
    <div
      className={`rounded-2xl bg-zinc-950/90 border border-primary-container/35 flex flex-col gap-3.5 ${
        compact ? 'p-3.5' : 'p-4 md:p-5'
      }`}
    >
      {/* 1. 실시간 연결 기기 바인딩 & 30일 체험 상태 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold">
            📋 실시간 E2EE 클립보드 &amp; 24시간 지연 우체통
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 font-mono text-[10.5px] font-bold">
            🔒 AES-256-GCM 암호화 · Echo-Loop 0%
          </span>
          {isLoggedIn && (
            <span
              className={`px-2 py-0.5 rounded-full border text-[10.5px] font-bold ${
                isMobileDevice || zCoreConnected
                  ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                  : 'bg-amber-500/15 border-amber-400/40 text-amber-200'
              }`}
            >
              {isMobileDevice
                ? '🟢 폰 복사 복귀 자동 감지'
                : zCoreConnected
                ? '🟢 PC Ctrl+C 실시간 감지 중'
                : '🟡 브라우저 복사 감지 (외부 앱 자동 감지는 PC 엔진 필요)'}
            </span>
          )}
          {isLoggedIn && (
            <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 border border-white/15 text-zinc-200 text-[11px] font-bold">
              연결된 내 기기 {connectedDevices.length}대
            </span>
          )}
          {isLoggedIn && deviceEntitlement?.isPaidUnlimited && !hidePricingForStore && (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/50 text-amber-200 text-[11px] font-extrabold">
              👑 무제한 기기 통합 구독 중
              {deviceEntitlement.paidExpiresAt
                ? ` (${formatKoreaDateShort(deviceEntitlement.paidExpiresAt)}까지 · D-${deviceEntitlement.paidDaysLeft ?? 1})`
                : ''}
            </span>
          )}
          {isLoggedIn &&
            !deviceEntitlement?.isPaidUnlimited &&
            deviceEntitlement?.trialActive && (
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 text-[11px] font-extrabold">
                {hidePricingForStore
                  ? `✨ 다중 기기 통합 활성 (D-${deviceEntitlement.trialDaysLeft})`
                  : `🎁 30일 무제한 무료체험 중 (D-${deviceEntitlement.trialDaysLeft} · 자동결제 0%)`}
              </span>
            )}
          {isLoggedIn &&
            !deviceEntitlement?.isPaidUnlimited &&
            deviceEntitlement?.trialExpired && (
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/50 text-rose-200 text-[11px] font-extrabold">
                🔒 30일 무료체험 종료 (대장 PC 로컬 원본 100% 보존 중)
              </span>
            )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isLoggedIn &&
            !hidePricingForStore &&
            !deviceEntitlement?.isPaidUnlimited &&
            !deviceEntitlement?.trialActive &&
            !deviceEntitlement?.trialExpired && (
              <button
                type="button"
                onClick={() => void refreshDeviceIntegrationState(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11.5px] font-black cursor-pointer"
              >
                🎁 2대+ 연동 30일 무료체험 시작 (자동결제 0%)
              </button>
            )}
          {isLoggedIn &&
            !hidePricingForStore &&
            !deviceEntitlement?.isPaidUnlimited &&
            deviceEntitlement?.trialExpired && (
              <button
                type="button"
                onClick={() => openSubscriptionCheckout('personal_sub_3900')}
                className="px-3 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-label-sm text-[11.5px] font-black cursor-pointer"
              >
                💳 월 3,900원 구독으로 다시 연결
              </button>
            )}
          {isLoggedIn && !hidePricingForStore && deviceEntitlement?.isPaidUnlimited && (
            <button
              type="button"
              onClick={() => openSubscriptionCheckout('personal_sub_3900')}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-400/40 text-amber-200 font-label-sm text-[11.5px] font-bold cursor-pointer"
            >
              ⏳ 이용 기간 연장
            </button>
          )}
          {isLoggedIn && !hidePricingForStore && !deviceEntitlement?.isPaidUnlimited && (
            <button
              type="button"
              onClick={() => setShowProModal(true)}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[11.5px] font-bold cursor-pointer"
            >
              요금제 안내
            </button>
          )}
        </div>
      </div>

      {/* 1.2. iOS 클립보드 동기화 정책 정직 병기 (가격표 마스터 SSOT 의무 고지) */}
      <div className="text-[11px] text-zinc-400 leading-snug">
        💡 <strong>동기화 안내:</strong> 안드로이드·PC는 백그라운드 즉시 동기화되며, <strong>iOS(아이폰)</strong>는 Apple OS 정책상 앱 진입(화면 전환) 시 0.1초 만에 즉시 동기화됩니다.
      </div>

      {/* 1.5. 연결 해제된 현재 기기 재연결 안내 & 연결된 내 기기 목록(개별 연결 해제 버튼) */}
      {isLoggedIn && thisDeviceRevoked && (
        <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/45 flex flex-wrap items-center justify-between gap-2 text-[12px]">
          <span className="text-amber-200 font-bold break-keep">
            🔌 이 기기의 연결이 해제된 상태입니다. QR 스캔·6자리 번호 입력 또는 아래 버튼으로 다시 연결할 수 있습니다.
          </span>
          <button
            type="button"
            disabled={reconnectingBusy}
            onClick={async () => {
              setReconnectingBusy(true);
              await reconnectThisDevice();
              setReconnectingBusy(false);
            }}
            className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer disabled:opacity-50 shrink-0"
          >
            {reconnectingBusy ? '연결 중...' : '🔄 이 기기 다시 연결'}
          </button>
        </div>
      )}

      {isLoggedIn && connectedDevices.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-zinc-900/70 border border-white/10">
          <span className="text-[11px] font-extrabold text-zinc-400 shrink-0">
            연결된 기기 관리:
          </span>
          {connectedDevices.map((dev) => {
            const isCurrent = dev.device_id === thisDeviceIdentity.deviceId;
            const isBusy = revokingDeviceId === dev.device_id;
            return (
              <div
                key={dev.device_id}
                className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg border text-[11.5px] ${
                  isCurrent
                    ? 'bg-zinc-950 border-primary-container/40 text-zinc-100'
                    : 'bg-zinc-950/80 border-white/15 text-zinc-200'
                }`}
              >
                <span className="font-bold">
                  {dev.device_kind === 'mobile' ? '📱' : '💻'} {dev.display_name}
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
                  className="px-2 py-0.5 rounded-md bg-rose-500/15 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-[10.5px] font-extrabold cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {isBusy ? '해제 중...' : '🔌 연결 해제'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. 6자리 즉시 바인딩 번호 표시(PC) & 번호 입력(모바일·서브PC) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl bg-zinc-900/80 border border-white/10 text-[12px]">
        <div className="flex flex-wrap items-center gap-2">
          {isLoggedIn && devicePairingCode6 ? (
            <>
              <span className="text-zinc-300 font-bold">🔑 내 PC 6자리 바인딩 번호:</span>
              <span className="px-2.5 py-0.5 rounded-lg bg-black border border-primary-container/60 text-primary-container font-mono text-[13.5px] font-black tracking-widest">
                {devicePairingCode6.slice(0, 3)}-{devicePairingCode6.slice(3, 6)}
              </span>
              <button
                type="button"
                onClick={() => void refreshDeviceIntegrationState()}
                className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer"
              >
                새로고침
              </button>
            </>
          ) : (
            <span className="text-zinc-300 font-medium break-keep">
              {isLoggedIn
                ? '🔑 같은 이메일로 로그인하면 자동 연결되며, PC의 6자리 번호로도 즉시 바인딩할 수 있습니다.'
                : '🔒 로그인하면 PC에서 Ctrl+C 한 글자가 스마트폰으로 1초 만에 암호화 전달됩니다.'}
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
            placeholder="6자리 연결번호"
            className="w-28 px-2.5 py-1 rounded-lg bg-zinc-950 border border-white/15 text-white font-mono text-[12px] font-bold placeholder-zinc-500 focus:outline-none focus:border-primary-container"
          />
          <button
            type="submit"
            disabled={pairingBusy}
            className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-primary-container/40 text-primary-container font-label-sm text-[11.5px] font-extrabold cursor-pointer disabled:opacity-50"
          >
            {pairingBusy ? '확인 중...' : '번호 연결'}
          </button>
        </form>
      </div>

      {/* 3. 암호화 클립보드 즉시 발송 입력창 & 원클릭 OS 클립보드 가져오기 */}
      <form onSubmit={handleSendClip} className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={clipDraft}
          onChange={(e) => setClipDraft(e.target.value)}
          placeholder={
            isLoggedIn
              ? isMobileDevice
                ? '폰에서 복사 후 앱 복귀 시 자동 전송됩니다 (여기에 직접 적어 보낼 수도 있어요)'
                : 'PC에서 Ctrl+C 복사 시 자동 전송됩니다 (여기에 계좌·링크·메모를 적어 바로 보낼 수도 있어요)'
              : '먼저 이메일 로그인 후 기기 간 1초 클립보드를 이용해 보세요'
          }
          className="flex-1 min-w-[180px] px-3 py-2 rounded-xl bg-zinc-900 border border-white/15 text-white text-[12.5px] placeholder-zinc-500 focus:outline-none focus:border-primary-container"
        />
        {isLoggedIn && (
          <button
            type="button"
            disabled={pullingLocalClip}
            onClick={() => void handleSendCurrentOsClipboard()}
            className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-cyan-400/40 text-cyan-200 font-label-sm text-[11.5px] font-extrabold shrink-0 cursor-pointer disabled:opacity-50"
          >
            {pullingLocalClip ? '읽는 중...' : '📋 복사한 글 바로 보내기'}
          </button>
        )}
        <button
          type="submit"
          disabled={sendingClip}
          className="px-3.5 py-2 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-sm text-[12px] font-extrabold shrink-0 cursor-pointer disabled:opacity-50"
        >
          {!isLoggedIn ? '🔑 로그인' : sendingClip ? '전송 중...' : '📤 내 기기로 전송'}
        </button>
      </form>

      {/* 4. 최근 수신·발신된 E2EE 클립보드 목록 (최대 4건 컴팩트 노출) */}
      {isLoggedIn && syncedClipboardItems.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {syncedClipboardItems.slice(0, 4).map((clip) => {
            const isCopied = copiedHash === clip.clipHash;
            return (
              <div
                key={`${clip.clipHash}:${clip.createdAt}`}
                className="px-3 py-2 rounded-xl bg-zinc-900/90 border border-white/10 flex items-center justify-between gap-2.5"
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[10.5px] text-zinc-400">
                    <span className="text-cyan-300 font-bold truncate">{clip.senderName}</span>
                    <span>·</span>
                    <span>🔒 E2EE 24h 보관</span>
                  </div>
                  <p className="text-[12.5px] text-white font-semibold truncate">{clip.text}</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await writeTextToLocalOsClipboard(clip.text, clip.clipHash);
                    setCopiedHash(clip.clipHash);
                    window.setTimeout(() => setCopiedHash(null), 2000);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold shrink-0 cursor-pointer border ${
                    isCopied
                      ? 'bg-emerald-400 text-zinc-950 border-emerald-300'
                      : 'bg-zinc-950 hover:bg-zinc-800 text-primary-container border-primary-container/40'
                  }`}
                >
                  {isCopied ? '✓ 복사됨' : '📋 복사'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
