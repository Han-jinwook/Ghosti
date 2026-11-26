import React, { useEffect, useState } from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { resolveLoungePhotoCorpus } from '../../store/slices/storeSharedRefs';
import type { FamilyRoomId, LoungeType } from '../../types/saysee';
import { PcMasterQuickSendPanel } from '../../components/PricingModal';
import { zCoreBridge } from '../../services/zCoreBridge';
import { resolveAccountScopedNickname } from '../../services/ghostSecretaryEngine';
import { loadPassportFlowState } from '../../services/passportRegistrationFlow';
import { WorkLoungeB2BHub } from '../paid_work_share/WorkLoungeB2BHub';
import { QrCodeSvg } from '../../utils/qrCodeSvg';
import { CrossDeviceClipboardAndPairingBar } from '../paid_device_sync/CrossDeviceClipboardAndPairingBar';
import { getThisDeviceIdentity } from '../../services/deviceIntegrationService';
import {
  ensureMyRoomAndInviteToken,
  fetchSharedPhotoRoomMembers,
  getPrewarmedRoomInviteTokenSync,
  kickMemberFromSupabaseSharedPhotoRoom,
  type SharedPhotoRoomMemberInfo,
} from '../../services/sharedPhotoRoomSupabase';
import { resolveDefaultRoomTitle } from '../../services/shareInviteDeepLinkBridge';

import {
  KICKED_ROOM_MEMBERS_STORAGE_KEY,
  readHostRetainsHidePermission,
  writeHostRetainsHidePermission,
  resolveCurrentUserIdentityTokens,
  copyAuthenticatedRoomInviteFlow,
} from './loungeRoomPermissions';

export const LoungeCustomSettingsHeader: React.FC = () => {
  const {
    activeLoungeType,
    activeFamilyRoom,
    setActiveFamilyRoom,
    activeSharedRoomId,
    activeJoinedRoomMeta,
    leaveJoinedSharedRoom,
    sharedRoomHostPhotos,
    sharedRoomAddedPhotos,
    isStoreAppMode,
    syncState,
    setPrivateSyncStrategy,
    triggerSyncNow,
    pcAgentPairedMobile,
    connectedDevices,
    devicePairingCode6,
    deviceEntitlement,
    deviceSyncProgress,
    refreshDeviceIntegrationState,
    unlinkConnectedDevice,
    openSubscriptionCheckout,
    photos,
    localDocuments,
    setSelectedPhoto,
    setDesktopTab,
    setSearchSpace,
    openLocalFolder,
    lastPhoneBackupFolderPath,
    merlinAuth,
  } = useSaySeeStore();

  const [revokingSlotDeviceId, setRevokingSlotDeviceId] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [hostRetainsHidePermission, setHostRetainsHidePermissionState] = useState<boolean>(() =>
    readHostRetainsHidePermission()
  );
  const setHostRetainsHidePermission = (enabled: boolean) => {
    setHostRetainsHidePermissionState(enabled);
    writeHostRetainsHidePermission(enabled);
  };
  const [kickedMemberNames, setKickedMemberNames] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(KICKED_ROOM_MEMBERS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
    } catch {
      return [];
    }
  });
  const [showInlineQrPanel, setShowInlineQrPanel] = useState(false);
  const [showQuickSendDrawer, setShowQuickSendDrawer] = useState(false);
  const [mobileInstallLinkCopied, setMobileInstallLinkCopied] = useState(false);
  const [subPcLinkCopied, setSubPcLinkCopied] = useState(false);
  const [isZCoreConnected, setIsZCoreConnected] = useState(zCoreBridge.isConnected);
  const [resolvedSettingsRoomId, setResolvedSettingsRoomId] = useState<string | null>(null);
  const [serverRoomMembers, setServerRoomMembers] = useState<SharedPhotoRoomMemberInfo[]>([]);
  const [hasLoadedServerMembers, setHasLoadedServerMembers] = useState(false);

  useEffect(() => {
    setIsZCoreConnected(zCoreBridge.isConnected);
    const unsub = zCoreBridge.subscribe((conn) => setIsZCoreConnected(conn));
    void zCoreBridge.checkHealth();
    return () => {
      unsub();
    };
  }, []);

  const isLoggedInUser = Boolean(
    merlinAuth?.email && merlinAuth.userId && merlinAuth.userId !== 'guest'
  );

  // [정식 SQL SSOT] 공유방(가족·동호회·동창회) 방관리 진입 시 ghosti_lounge_members에서 실제 참여 회원 전체를 직접 조회
  useEffect(() => {
    const isSharedPhotoRoom =
      activeLoungeType === 'family' || activeLoungeType === 'club' || activeLoungeType === 'student';
    if (!isSharedPhotoRoom || !isLoggedInUser) {
      setResolvedSettingsRoomId(null);
      setServerRoomMembers([]);
      setHasLoadedServerMembers(false);
      return;
    }
    let cancelled = false;
    setServerRoomMembers([]);
    setHasLoadedServerMembers(false);

    const loadRealMembers = async () => {
      let targetRoomId =
        activeJoinedRoomMeta?.roomId ||
        activeSharedRoomId ||
        getPrewarmedRoomInviteTokenSync(activeLoungeType, activeFamilyRoom)?.roomId ||
        null;

      if (!targetRoomId) {
        const nick = resolveAccountScopedNickname(
          merlinAuth?.email || '',
          activeLoungeType === 'family' ? '가족방장' : '모임방장'
        );
        const ensured = await ensureMyRoomAndInviteToken({
          loungeType: activeLoungeType,
          familyRoom: activeFamilyRoom,
          roomTitle: resolveDefaultRoomTitle(activeLoungeType, activeFamilyRoom),
          masterNickname: nick,
        });
        if (ensured.ok && ensured.roomId) {
          targetRoomId = ensured.roomId;
        }
      }
      if (cancelled) return;
      setResolvedSettingsRoomId(targetRoomId);
      const members = await fetchSharedPhotoRoomMembers(targetRoomId || '', {
        loungeType: activeLoungeType,
        familyRoom: activeFamilyRoom,
      });
      if (cancelled) return;
      setServerRoomMembers(members);
      setHasLoadedServerMembers(true);
    };

    void loadRealMembers();
    return () => {
      cancelled = true;
    };
  }, [
    activeLoungeType,
    activeFamilyRoom,
    activeSharedRoomId,
    activeJoinedRoomMeta?.roomId,
    isLoggedInUser,
    merlinAuth?.email,
  ]);
  const isMainPcConnected = isLoggedInUser && isZCoreConnected;
  const isMobileConnected = isLoggedInUser && Boolean(pcAgentPairedMobile);

  const openLoginModal = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openLoginModal'));
    }
  };
  const openZCoreGuideModal = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ghosti_jump_to_secretary'));
    }
  };

  const renderRoomCreationAndExitPolicyBox = () => (
    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2.5 max-w-full">
      <span className="text-[12.5px] text-slate-700 font-semibold break-keep">
        사진 삭제 권한
      </span>

      <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto max-w-full">
        <button
          type="button"
          onClick={() => setHostRetainsHidePermission(true)}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border cursor-pointer break-keep text-left transition-colors ${
            hostRetainsHidePermission
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
          }`}
        >
          방장 상시 관리 (권장)
        </button>
        <button
          type="button"
          onClick={() => setHostRetainsHidePermission(false)}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border cursor-pointer break-keep text-left transition-colors ${
            !hostRetainsHidePermission
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
          }`}
        >
          24시간 내 본인만 삭제
        </button>

        {activeJoinedRoomMeta && (
          <button
            type="button"
            onClick={() => void leaveJoinedSharedRoom(activeJoinedRoomMeta.roomId)}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 text-[12px] font-medium cursor-pointer break-keep"
          >
            방 나가기
          </button>
        )}
      </div>
    </div>
  );

  const currentRoomCorpus = resolveLoungePhotoCorpus({
    activeLoungeType,
    activeFamilyRoom,
    activeSharedRoomId,
    photos,
    sharedRoomHostPhotos,
    sharedRoomAddedPhotos,
  });
  const passportState = loadPassportFlowState();
  const myDisplayName =
    passportState.userRealName?.trim() ||
    resolveAccountScopedNickname(merlinAuth?.email || '', '') ||
    merlinAuth?.email?.split('@')[0] ||
    '나';
  const hostDisplayName = activeJoinedRoomMeta
    ? activeJoinedRoomMeta.masterNickname || '방장'
    : myDisplayName;

  const effectiveRoomIdForManage =
    activeJoinedRoomMeta?.roomId || activeSharedRoomId || resolvedSettingsRoomId;

  const kickedSet = new Set(kickedMemberNames);
  const handleKickRoomMember = (memberName: string, memberEmail?: string) => {
    const clean = memberName.trim();
    const cleanEmail = (memberEmail || '').trim().toLowerCase();
    if (!clean && !cleanEmail) return;
    if (cleanEmail) {
      setServerRoomMembers((prev) =>
        prev.filter((m) => m.memberEmail.toLowerCase() !== cleanEmail)
      );
    } else if (clean) {
      setServerRoomMembers((prev) => prev.filter((m) => m.nickname !== clean));
    }
    if (clean && !cleanEmail) {
      const nextKicked = Array.from(new Set([...kickedMemberNames, clean]));
      setKickedMemberNames(nextKicked);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(KICKED_ROOM_MEMBERS_STORAGE_KEY, JSON.stringify(nextKicked));
        } catch {
          /* ignore */
        }
      }
    }
    if (effectiveRoomIdForManage || activeLoungeType === 'family' || activeLoungeType === 'club' || activeLoungeType === 'student') {
      void kickMemberFromSupabaseSharedPhotoRoom(
        effectiveRoomIdForManage || '',
        clean,
        cleanEmail || undefined,
        { loungeType: activeLoungeType, familyRoom: activeFamilyRoom }
      );
    }
    useSaySeeStore
      .getState()
      .showToast(`${clean || cleanEmail} 님을 공유방에서 내보냈습니다.`);
  };

  const myEmailLower = (merlinAuth?.email || '').trim().toLowerCase();
  const myIdentityLowerSet = new Set(
    [
      ...resolveCurrentUserIdentityTokens(myEmailLower),
      myDisplayName,
      `${myDisplayName} (방장)`,
    ]
      .map((t) => String(t || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const serverMasterMember = serverRoomMembers.find((m) => m.role === 'master');
  const masterEmailLower = (
    serverMasterMember?.memberEmail || (!activeJoinedRoomMeta ? myEmailLower : '')
  )
    .trim()
    .toLowerCase();
  const effectiveHostDisplayName =
    masterEmailLower && myEmailLower && masterEmailLower === myEmailLower
      ? myDisplayName
      : serverMasterMember?.nickname || hostDisplayName;

  const hostLowerSet = new Set(
    [
      effectiveHostDisplayName,
      `${effectiveHostDisplayName} (방장)`,
      hostDisplayName,
      `${hostDisplayName} (방장)`,
      serverMasterMember?.nickname,
      '방장',
      ...(!activeJoinedRoomMeta || (masterEmailLower && masterEmailLower === myEmailLower)
        ? Array.from(myIdentityLowerSet)
        : []),
    ]
      .map((t) => String(t || '').trim().toLowerCase())
      .filter(Boolean)
  );

  // [정식 SQL 멤버 SSOT + 동일 유저 중복 방지]
  // 1순위: ghosti_lounge_members 서버 정식 참여 회원 (사진을 안 올린 합류 회원도 100% 표시)
  // 2순위: 로컬/오프라인 폴백 시 currentRoomCorpus 업로더 보조 병합 (이메일·신원 토큰 기준 1인 단일 집계)
  const derivedParticipants = (() => {
    const byIdentityKey = new Map<string, { rawName: string; email?: string }>();
    const normalizeLabel = (raw?: string | null) =>
      String(raw || '')
        .replace(/^[👑📸👤\s]+/, '')
        .replace(/\s*\(방장\)\s*$/u, '')
        .trim();

    for (const sm of serverRoomMembers) {
      if (sm.role === 'master') continue;
      const email = sm.memberEmail.trim().toLowerCase();
      if (masterEmailLower && email && email === masterEmailLower) continue;
      const isMe = Boolean(email && myEmailLower && email === myEmailLower);
      const label = normalizeLabel(isMe ? myDisplayName : sm.nickname) || sm.nickname;
      if (!label) continue;
      byIdentityKey.set(email ? `email:${email}` : `name:${label.toLowerCase()}`, {
        rawName: label,
        email: email || undefined,
      });
    }

    if (activeJoinedRoomMeta && isLoggedInUser) {
      const myNorm = normalizeLabel(myDisplayName);
      const myKey = myEmailLower ? `email:${myEmailLower}` : `name:${myNorm.toLowerCase()}`;
      if (
        myNorm &&
        !byIdentityKey.has(myKey) &&
        !(masterEmailLower && myEmailLower && masterEmailLower === myEmailLower) &&
        !hostLowerSet.has(myNorm.toLowerCase())
      ) {
        byIdentityKey.set(myKey, { rawName: myNorm, email: myEmailLower || undefined });
      }
    }

    // 서버 멤버 조회가 비어 있는 오프라인/로컬 폴백 시에만 사진 업로더에서 보조 추론
    if (!hasLoadedServerMembers || serverRoomMembers.length === 0) {
      const seenFallbackNames = new Set<string>(
        Array.from(byIdentityKey.values()).map((v) => v.rawName.toLowerCase())
      );
      for (const p of currentRoomCorpus) {
        const uploaderEmail = String(p.sharedUploaderEmail || '').trim().toLowerCase();
        const label = normalizeLabel(p.uploaderLabel);
        if (!label) continue;
        const lowerLabel = label.toLowerCase();
        if (kickedSet.has(label) || hostLowerSet.has(lowerLabel)) continue;
        if (uploaderEmail && myEmailLower && uploaderEmail === myEmailLower) continue;
        if (uploaderEmail && masterEmailLower && uploaderEmail === masterEmailLower) continue;
        if (!uploaderEmail && myIdentityLowerSet.has(lowerLabel)) continue;
        if (!uploaderEmail && seenFallbackNames.has(lowerLabel)) continue;

        const key = uploaderEmail ? `email:${uploaderEmail}` : `name:${lowerLabel}`;
        if (!byIdentityKey.has(key)) {
          byIdentityKey.set(key, { rawName: label, email: uploaderEmail || undefined });
          seenFallbackNames.add(lowerLabel);
        }
      }
    }

    return Array.from(byIdentityKey.values());
  })();

  // 동일 닉네임을 사용하는 별개 계정이 2명 이상일 때 이메일 식별자를 함께 표기해 중복 오인 차단
  const participantNameCounts = new Map<string, number>();
  for (const p of derivedParticipants) {
    const k = p.rawName.trim().toLowerCase();
    if (k) participantNameCounts.set(k, (participantNameCounts.get(k) || 0) + 1);
  }
  const hasDuplicateNickname = (rawName: string) =>
    (participantNameCounts.get(rawName.trim().toLowerCase()) || 0) > 1;

  const visibleFamilyMembers = isLoggedInUser || activeJoinedRoomMeta
    ? [
        {
          id: 'host_member',
          name: `${effectiveHostDisplayName} (방장)`,
          rawName: effectiveHostDisplayName,
          email: masterEmailLower || undefined,
          room: activeFamilyRoom || '우리집',
          role: 'HOST' as const,
        },
        ...derivedParticipants.map((m, idx) => ({
          id: `fam_member_${idx}_${m.email || m.rawName}`,
          name: m.rawName,
          rawName: m.rawName,
          email: m.email,
          room: activeFamilyRoom || '우리집',
          role: 'MEMBER' as const,
        })),
      ]
    : [];

  const visibleClubMembers = isLoggedInUser || activeJoinedRoomMeta
    ? [
        {
          id: 'club_host_member',
          name: `${effectiveHostDisplayName} (방장)`,
          rawName: effectiveHostDisplayName,
          email: masterEmailLower || undefined,
          badge: '방장',
          role: 'HOST' as const,
        },
        ...derivedParticipants.map((m, idx) => ({
          id: `club_member_${idx}_${m.email || m.rawName}`,
          name: m.rawName,
          rawName: m.rawName,
          email: m.email,
          badge: '참여회원',
          role: 'MEMBER' as const,
        })),
      ]
    : [];

  const copyInviteLink = async () => {
    const targetLounge: LoungeType =
      activeLoungeType === 'club' || activeLoungeType === 'student' ? activeLoungeType : 'family';
    const ok = await copyAuthenticatedRoomInviteFlow({
      loungeType: targetLounge,
      familyRoom: activeFamilyRoom,
      defaultHostLabel: targetLounge === 'family' ? '가족방장' : '모임방장',
      promptLabel: '초대 링크를 복사해 공유하세요:',
      formatCopyText: (inviteUrl) =>
        `[귀신같이 사진 공유방 초대]\n아래 링크에서 공유 사진을 바로 확인할 수 있습니다. (발급 후 14일간 유효)\n${inviteUrl}`,
    });
    if (!ok) return;
    useSaySeeStore
      .getState()
      .showToast('초대 링크가 복사되었습니다! (발급 후 14일간 유효)');
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2500);
  };

  if (activeLoungeType === 'personal') {
    const thisDeviceId = getThisDeviceIdentity().deviceId;
    const isShadowMode = syncState.privateSyncStrategy === 'shadow';
    const mobilePeers = connectedDevices.filter((d) => d.device_kind === 'mobile');
    const pcPeers = connectedDevices.filter((d) => d.device_kind === 'pc_master');
    const secondaryPcPeer = pcPeers.find((p) => p.device_id !== thisDeviceId) || pcPeers[1];
    const subPcConnected = isLoggedInUser && pcPeers.length >= 2;
    const realMobileConnected = isMobileConnected || (isLoggedInUser && mobilePeers.length > 0);
    const qrConnectUrl = devicePairingCode6
      ? `https://ghosti.sundreamer.app/?lounge=personal&tab=sync&pairCode=${devicePairingCode6}`
      : 'https://ghosti.sundreamer.app/?lounge=personal&tab=sync';

    return (
      <div className="flex flex-col gap-4">
        {/* 상단 헤더 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
          <div>
            <h1 className="text-[18px] md:text-[20px] font-bold text-slate-900 tracking-tight">
              내 기기 통합
            </h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              같은 이메일로 로그인하면 내 PC와 스마트폰이 자동으로 연결됩니다.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              const next = !showInlineQrPanel;
              setShowInlineQrPanel(next);
              if (next && isLoggedInUser) {
                void refreshDeviceIntegrationState();
              }
            }}
            className={`px-3.5 py-2 rounded-lg text-[12.5px] font-semibold cursor-pointer border transition-colors shrink-0 ${
              showInlineQrPanel
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
            }`}
          >
            {showInlineQrPanel ? '모바일 연결 QR 닫기' : '모바일 연결 QR'}
          </button>
        </div>

        {/* QR 패널 */}
        {showInlineQrPanel && (
          <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-[88px] h-[88px] rounded-lg bg-white p-1.5 shrink-0 flex items-center justify-center border border-slate-200">
                <QrCodeSvg value={qrConnectUrl} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[13.5px] font-semibold text-slate-900">
                  스마트폰 연결 방법
                </span>
                <p className="text-[12.5px] text-slate-600 leading-relaxed">
                  1. 스마트폰 카메라로 왼쪽 QR 코드를 스캔합니다.<br />
                  2. 현재 계정(<strong>{merlinAuth?.email || '동일 이메일'}</strong>)으로 로그인하거나
                  {devicePairingCode6 ? (
                    <>
                      {' '}연결 번호 <strong className="font-mono text-slate-900">{devicePairingCode6.slice(0, 3)}-{devicePairingCode6.slice(3, 6)}</strong>을 입력합니다.
                    </>
                  ) : (
                    ' 로그인하면 자동으로 연결됩니다.'
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      await navigator.clipboard.writeText(qrConnectUrl);
                    }
                  } catch {}
                  setMobileInstallLinkCopied(true);
                  setTimeout(() => setMobileInstallLinkCopied(false), 2500);
                }}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer border transition-colors ${
                  mobileInstallLinkCopied
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                {mobileInstallLinkCopied ? '링크 복사됨' : '연결 링크 복사'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isLoggedInUser) {
                    openLoginModal();
                    return;
                  }
                  void refreshDeviceIntegrationState({ forceRefreshPairingCode: true });
                }}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer"
              >
                {!isLoggedInUser
                  ? '로그인'
                  : realMobileConnected
                  ? `연결됨 (${mobilePeers[0]?.display_name || '스마트폰'})`
                  : '새 번호 받기'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isLoggedInUser) {
                    openLoginModal();
                    return;
                  }
                  setShowQuickSendDrawer((v) => !v);
                }}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer"
              >
                {showQuickSendDrawer ? '파일 전송 닫기' : '파일 직접 전송'}
              </button>
            </div>
          </div>
        )}

        {/* 기기 3열 슬롯 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 기기 1 */}
          <div
            onClick={() => {
              if (!isLoggedInUser) {
                openLoginModal();
              } else if (!isZCoreConnected) {
                openZCoreGuideModal();
              }
            }}
            className={`p-4 rounded-xl bg-white border border-slate-200 flex flex-col justify-between gap-2.5 transition-colors ${
              isMainPcConnected ? '' : 'hover:border-slate-300 cursor-pointer'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-semibold text-slate-500">메인 PC</span>
              <span
                className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium ${
                  isMainPcConnected
                    ? 'text-teal-700'
                    : isLoggedInUser
                    ? 'text-amber-700'
                    : 'text-slate-400'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isMainPcConnected
                      ? 'bg-teal-500'
                      : isLoggedInUser
                      ? 'bg-amber-500'
                      : 'bg-slate-300'
                  }`}
                />
                {isMainPcConnected ? '연결됨' : isLoggedInUser ? '엔진 대기' : '미연결'}
              </span>
            </div>
            <p className="text-[14px] text-slate-900 font-semibold truncate">
              {pcPeers[0]?.display_name || '현재 PC'}
            </p>
            <span className="text-[12px] text-slate-500">
              {isMainPcConnected
                ? '사진·문서 검색 및 클립보드 연동됨'
                : isLoggedInUser
                ? 'PC 엔진 실행 안내 보기 →'
                : '로그인하여 연결하기 →'}
            </span>
          </div>

          {/* 기기 2 */}
          <div
            onClick={() => {
              if (!isLoggedInUser) {
                openLoginModal();
                return;
              }
              setShowInlineQrPanel((v) => !v);
            }}
            className="p-4 rounded-xl bg-white hover:border-slate-300 border border-slate-200 flex flex-col justify-between gap-2.5 cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-semibold text-slate-500">스마트폰</span>
              <span
                className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium ${
                  realMobileConnected
                    ? 'text-teal-700'
                    : isLoggedInUser
                    ? 'text-amber-700'
                    : 'text-slate-400'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    realMobileConnected
                      ? 'bg-teal-500'
                      : isLoggedInUser
                      ? 'bg-amber-500'
                      : 'bg-slate-300'
                  }`}
                />
                {realMobileConnected ? '연결됨' : isLoggedInUser ? '연동 대기' : '미연결'}
              </span>
            </div>
            <p className="text-[14px] text-slate-900 font-semibold truncate">
              {mobilePeers[0]?.display_name || '모바일 앱'}
            </p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-slate-500">
                {realMobileConnected
                  ? '사진 백업 및 원격 검색 연동됨'
                  : isLoggedInUser
                  ? '모바일 연결 방법 보기 →'
                  : '로그인 후 연결하기 →'}
              </span>
              {realMobileConnected && mobilePeers[0] && (
                <button
                  type="button"
                  disabled={revokingSlotDeviceId === mobilePeers[0].device_id}
                  onClick={async (e) => {
                    e.stopPropagation();
                    const targetId = mobilePeers[0].device_id;
                    setRevokingSlotDeviceId(targetId);
                    await unlinkConnectedDevice(targetId);
                    setRevokingSlotDeviceId(null);
                  }}
                  className="text-[11.5px] text-slate-400 hover:text-rose-600 font-medium cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
                >
                  {revokingSlotDeviceId === mobilePeers[0].device_id ? '해제 중' : '연결 해제'}
                </button>
              )}
            </div>
          </div>

          {/* 기기 3 */}
          <div
            onClick={async () => {
              try {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  await navigator.clipboard.writeText(qrConnectUrl);
                }
              } catch {}
              setSubPcLinkCopied(true);
              setTimeout(() => setSubPcLinkCopied(false), 3000);
            }}
            className="p-4 rounded-xl bg-white hover:border-slate-300 border border-slate-200 flex flex-col justify-between gap-2.5 cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-semibold text-slate-500">추가 PC</span>
              <span
                className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium ${
                  subPcConnected || subPcLinkCopied ? 'text-teal-700' : 'text-slate-400'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    subPcConnected || subPcLinkCopied ? 'bg-teal-500' : 'bg-slate-300'
                  }`}
                />
                {subPcLinkCopied
                  ? '링크 복사됨'
                  : subPcConnected
                  ? `연결됨 (${pcPeers.length}대)`
                  : '추가 가능'}
              </span>
            </div>
            <p className="text-[14px] text-slate-900 font-semibold truncate">
              {secondaryPcPeer?.display_name || '회사 · 서브 PC'}
            </p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-slate-500">
                {subPcLinkCopied
                  ? '다른 PC에서 접속 후 같은 이메일로 로그인하세요'
                  : subPcConnected
                  ? '다중 PC 검색 및 클립보드 연동됨'
                  : '연결 주소 복사 →'}
              </span>
              {subPcConnected && secondaryPcPeer && (
                <button
                  type="button"
                  disabled={revokingSlotDeviceId === secondaryPcPeer.device_id}
                  onClick={async (e) => {
                    e.stopPropagation();
                    const targetId = secondaryPcPeer.device_id;
                    setRevokingSlotDeviceId(targetId);
                    await unlinkConnectedDevice(targetId);
                    setRevokingSlotDeviceId(null);
                  }}
                  className="text-[11.5px] text-slate-400 hover:text-rose-600 font-medium cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
                >
                  {revokingSlotDeviceId === secondaryPcPeer.device_id ? '해제 중' : '연결 해제'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 백업 및 동기화 바 */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13.5px] text-slate-900 font-semibold">
                {(() => {
                  const localPhotoBytes = photos
                    .filter((p) => !p.quarantined && !p.id.startsWith('shadow-remote-'))
                    .reduce((acc, p) => acc + (p.size || 0), 0);
                  const liveOriginalGB =
                    syncState.originalSizeGB > 0
                      ? syncState.originalSizeGB
                      : Number((localPhotoBytes / (1024 * 1024 * 1024)).toFixed(2));
                  const remoteTotalCount =
                    photos.filter((p) => !p.quarantined && p.id.startsWith('shadow-remote-')).length +
                    localDocuments.filter((d) => d.id.startsWith('shadow-remote-doc-')).length;
                  const livePackMB =
                    syncState.packSizeMB > 0
                      ? syncState.packSizeMB
                      : Number(Math.max(0.1, (remoteTotalCount * 13) / 1024).toFixed(2));
                  if (!isLoggedInUser) {
                    return '사진 백업 및 동기화';
                  }
                  if (deviceEntitlement && !deviceEntitlement.unlimitedBindingUnlocked && deviceEntitlement.trialExpired) {
                    return '무료체험 종료 (PC에 저장된 원본은 그대로 유지됩니다)';
                  }
                  if (!realMobileConnected && !subPcConnected) {
                    return isShadowMode ? '스마트폰 용량 절약 모드' : '양쪽 원본 보관 모드';
                  }
                  return isShadowMode
                    ? `스마트폰 용량 절약 중 (원본 PC 보관 · 모바일 점유 ${livePackMB}MB)`
                    : `양쪽 원본 보관 중 (${liveOriginalGB > 0 ? `${liveOriginalGB}GB` : `${photos.filter((p) => !p.quarantined).length}장`})`;
                })()}
              </span>
              {syncState.syncing && deviceSyncProgress && (
                <div className="flex flex-col gap-1 max-w-sm pt-0.5">
                  <div className="flex items-center justify-between gap-2 text-[12px] text-teal-700 font-semibold">
                    <span>{deviceSyncProgress.phase}</span>
                    <span className="tabular-nums">
                      {deviceSyncProgress.current}/{Math.max(1, deviceSyncProgress.total)} (
                      {Math.min(
                        100,
                        Math.round(
                          (deviceSyncProgress.current / Math.max(1, deviceSyncProgress.total)) * 100
                        )
                      )}
                      %)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-teal-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-teal-600 transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            6,
                            Math.round(
                              (deviceSyncProgress.current / Math.max(1, deviceSyncProgress.total)) *
                                100
                            )
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              {isLoggedInUser ? (
                <span className="text-[12px] text-slate-500">
                  백업 위치:{' '}
                  {lastPhoneBackupFolderPath ||
                    `내 PC / 사진(Pictures) / Ghosti_Phone_Backup / ${(merlinAuth?.email || '')
                      .trim()
                      .toLowerCase()
                      .replace(/@/g, '_')
                      .replace(/[^a-z0-9._-]+/g, '_')
                      .replace(/^[._-]+|[._-]+$/g, '')
                      .slice(0, 64)}`}
                </span>
              ) : (
                <span className="text-[12px] text-slate-500">
                  로그인 후 기기 간 사진 백업과 동기화를 사용할 수 있습니다.
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setPrivateSyncStrategy('shadow')}
                  className={`px-3 py-1.5 rounded-md text-[12px] font-medium cursor-pointer transition-all whitespace-nowrap ${
                    isShadowMode
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  용량 절약 (기본)
                </button>
                <button
                  type="button"
                  onClick={() => setPrivateSyncStrategy('mirror')}
                  className={`px-3 py-1.5 rounded-md text-[12px] font-medium cursor-pointer transition-all whitespace-nowrap ${
                    !isShadowMode
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  원본 전체 백업
                </button>
              </div>

              {isLoggedInUser && isZCoreConnected && (
                <button
                  type="button"
                  data-testid="open-phone-backup-folder-btn"
                  onClick={() => void openLocalFolder('phone_backup')}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer whitespace-nowrap"
                >
                  백업 폴더 열기
                </button>
              )}

              {!isLoggedInUser ? (
                <button
                  type="button"
                  onClick={openLoginModal}
                  className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer whitespace-nowrap"
                >
                  로그인
                </button>
              ) : deviceEntitlement && !deviceEntitlement.unlimitedBindingUnlocked && deviceEntitlement.trialExpired && !isStoreAppMode ? (
                <button
                  type="button"
                  onClick={() => openSubscriptionCheckout('personal_sub_3900')}
                  className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer whitespace-nowrap"
                >
                  Pro 구독
                </button>
              ) : (
                <button
                  type="button"
                  disabled={syncState.syncing}
                  onClick={() => void triggerSyncNow()}
                  className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {syncState.syncing ? '동기화 중...' : '지금 일치시키기'}
                </button>
              )}
            </div>
          </div>

          {(() => {
            const remoteSyncedPhotos = photos.filter(
              (p) => !p.quarantined && p.id.startsWith('shadow-remote-')
            );
            const remoteSyncedDocs = localDocuments.filter((d) =>
              d.id.startsWith('shadow-remote-doc-')
            );
            if (!isLoggedInUser || (remoteSyncedPhotos.length === 0 && remoteSyncedDocs.length === 0)) {
              return null;
            }
            return (
              <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                {remoteSyncedPhotos.length > 0 && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-slate-700">
                        연결된 다른 기기의 사진 ({remoteSyncedPhotos.length}장)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchSpace('gallery');
                          setDesktopTab('dashboard');
                        }}
                        className="text-[12px] text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                      >
                        전체 보기 →
                      </button>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {remoteSyncedPhotos.slice(0, 10).map((rp) => (
                        <button
                          key={rp.id}
                          type="button"
                          onClick={() => setSelectedPhoto(rp)}
                          className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 hover:border-slate-400 shrink-0 cursor-pointer bg-slate-100 transition-colors"
                          title={rp.name}
                        >
                          <img src={rp.thumbUrl} alt={rp.name} className="w-full h-full object-cover" />
                        </button>
                      ))}
                      {remoteSyncedPhotos.length > 10 && (
                        <span className="text-[11.5px] text-slate-400 shrink-0 px-1">
                          +{remoteSyncedPhotos.length - 10}장
                        </span>
                      )}
                    </div>
                  </>
                )}
                {remoteSyncedDocs.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <span className="text-[12px] font-semibold text-slate-700">
                      연결된 다른 기기의 문서 ({remoteSyncedDocs.length}건)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchSpace('vault');
                        setDesktopTab('dashboard');
                      }}
                      className="text-[12px] text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                    >
                      전체 보기 →
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* 클립보드 공유 */}
        <CrossDeviceClipboardAndPairingBar />

        {showQuickSendDrawer && (
          <div className="pt-1">
            <PcMasterQuickSendPanel />
          </div>
        )}
      </div>
    );
  }

  if (activeLoungeType === 'family') {
    const FAMILY_ROOMS: FamilyRoomId[] = ['우리집', '본가(친가)', '처가(친정)'];
    return (
      <div className="p-5 rounded-xl bg-white border border-slate-200 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] text-slate-900 font-bold">가족 공유방 관리</h2>
            <p className="text-[12.5px] text-slate-500 mt-0.5">
              우리집 · 본가 · 처가 앨범을 분리하여 관리하고 초대 링크를 공유합니다.
            </p>
          </div>

          <button
            type="button"
            onClick={copyInviteLink}
            className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12.5px] font-semibold cursor-pointer"
          >
            {inviteCopied ? '초대 링크 복사됨' : '초대 링크 복사'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] text-slate-700 font-semibold">
              가족방 선택 ({activeFamilyRoom || '우리집'})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {FAMILY_ROOMS.map((room) => {
                const isSelectedRoom = (activeFamilyRoom || '우리집') === room;
                return (
                  <button
                    key={room}
                    type="button"
                    onClick={() => setActiveFamilyRoom(room)}
                    className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium border cursor-pointer transition-colors ${
                      isSelectedRoom
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {room}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] text-slate-700 font-semibold">
              참여 멤버 ({visibleFamilyMembers.length}명)
            </span>
            {visibleFamilyMembers.length === 0 ? (
              <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[12px] text-slate-500">
                아직 참여 멤버가 없습니다. 초대 링크를 공유하면 여기에 표시됩니다.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {visibleFamilyMembers.map((m) => (
                  <div
                    key={m.id}
                    title={m.email || m.rawName}
                    className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-1.5 text-[12px]"
                  >
                    <span className="text-slate-800 font-medium">{m.name}</span>
                    {m.role !== 'HOST' && m.email && hasDuplicateNickname(m.rawName) && (
                      <span className="text-[11px] text-slate-400 font-normal">
                        ({m.email})
                      </span>
                    )}
                    {m.role !== 'HOST' && !activeJoinedRoomMeta && (
                      <button
                        type="button"
                        onClick={() => handleKickRoomMember(m.rawName, m.email)}
                        className="text-slate-400 hover:text-rose-600 text-[11px] font-medium ml-1 cursor-pointer"
                      >
                        내보내기
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {renderRoomCreationAndExitPolicyBox()}
      </div>
    );
  }

  if (activeLoungeType === 'club' || activeLoungeType === 'student') {
    const isAlumniRoom = activeLoungeType === 'student';
    return (
      <div className="p-5 rounded-xl bg-white border border-slate-200 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] text-slate-900 font-bold">
              {isAlumniRoom ? '동창회 공유방 관리' : '동호회·모임 공유방 관리'}
            </h2>
            <p className="text-[12.5px] text-slate-500 mt-0.5">
              초대 링크를 공유하고 참여 회원을 관리합니다.
            </p>
          </div>

          <button
            type="button"
            onClick={copyInviteLink}
            className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12.5px] font-semibold cursor-pointer"
          >
            {inviteCopied ? '초대 링크 복사됨' : '초대 링크 복사'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
          <span className="text-[12.5px] text-slate-700 font-semibold mr-1">
            참여 회원 ({visibleClubMembers.length}명)
          </span>
          {visibleClubMembers.length === 0 ? (
            <span className="text-[12px] text-slate-500">
              아직 참여 중인 회원이 없습니다.
            </span>
          ) : (
            visibleClubMembers.map((m) => (
              <div
                key={m.id}
                title={m.email || m.rawName}
                className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-1.5 text-[12px]"
              >
                <span className="text-slate-800 font-medium">{m.name}</span>
                {m.role !== 'HOST' && m.email && hasDuplicateNickname(m.rawName) && (
                  <span className="text-[11px] text-slate-400 font-normal">
                    ({m.email})
                  </span>
                )}
                {m.role !== 'HOST' && !activeJoinedRoomMeta && (
                  <button
                    type="button"
                    onClick={() => handleKickRoomMember(m.rawName, m.email)}
                    className="text-slate-400 hover:text-rose-600 text-[11px] font-medium cursor-pointer"
                  >
                    내보내기
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {renderRoomCreationAndExitPolicyBox()}
      </div>
    );
  }

  return <WorkLoungeB2BHub />;
};
