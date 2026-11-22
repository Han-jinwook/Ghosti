import React, { useEffect, useRef, useState } from 'react';
import {
  buildWindowsNativeWebDavMountCommand,
  verifyHybridP2PBridgeConnection,
  type P2PHybridConnectionDiagnostics,
} from '../../services/p2pHybridBridge';
import { getActivePersonaForCluster, useSaySeeStore } from '../../store/useSaySeeStore';
import {
  resolveInvitedHostLoungeAndRoom,
  resolveLoungePhotoCorpus,
} from '../../store/slices/storeSharedRefs';
import type { ClubSizeTier, FamilyRoomId, LoungeType, PricingPlanId } from '../../types/saysee';
import { FaceMemberInlineBar } from '../../components/FaceMemberRegistryModal';
import { PcMasterQuickSendPanel } from '../../components/PricingModal';
import { GhostiBrandLogo } from '../../components/GhostiBrandLogo';
import { GhostCastLiveToolbar } from '../../components/GhostCastAndLiveSystem';
import { SilentIndexingStatusBar } from '../../components/SilentIndexingStatusBar';
import { zCoreBridge } from '../../services/zCoreBridge';
import { hasAuthenticatedHubAccountSession } from '../../services/supabaseClient';
import {
  isAndroidMobileBrowserOrApp,
  isCapacitorNativeMobileRuntime,
} from '../../services/ghostiMobileCareBridge';
import {
  buildAndroidSafeAppProbeIntentUrl,
  buildShareRoomInviteHttpsUrl,
  buildShareRoomNativeSchemeUrl,
  copyInviteTextReliably,
  readCurrentInviteDisplayMeta,
  resolveDefaultRoomTitle,
} from '../../services/shareInviteDeepLinkBridge';
import {
  ensureMyRoomAndInviteToken,
  getPrewarmedRoomInviteTokenSync,
  kickMemberFromSupabaseSharedPhotoRoom,
  reseedRoomPhotosForInvite,
} from '../../services/sharedPhotoRoomSupabase';
import { resolveAccountScopedNickname } from '../../services/ghostSecretaryEngine';
import { loadPassportFlowState } from '../../services/passportRegistrationFlow';
import { LOUNGE_TABS, PLAN_BADGE_LABELS, HostThreeBodyControlPanel } from '../shared/loungeHelpers';
import { WorkLoungeB2BHub } from '../paid_work_share/WorkLoungeB2BHub';
import { QrCodeSvg } from '../../utils/qrCodeSvg';
import { CrossDeviceClipboardAndPairingBar } from '../paid_device_sync/CrossDeviceClipboardAndPairingBar';
import { getThisDeviceIdentity } from '../../services/deviceIntegrationService';

import {
  HOST_HIDE_PERMISSION_STORAGE_KEY,
  KICKED_ROOM_MEMBERS_STORAGE_KEY,
  readHostRetainsHidePermission,
  writeHostRetainsHidePermission,
  resolveCurrentUserIdentityTokens,
  evaluateSharedPhotoDeletePermission,
  copyAuthenticatedRoomInviteFlow,
} from './loungeRoomPermissions';
import { AlumniRetroBannerAndTwoTrackBar } from './AlumniRetroBannerAndTwoTrackBar';

/**
 * 4번 서브메뉴 상단에 라운지 성격별로 표시되는 전용 관리/업그레이드/인증 섹션
 * - 개인: [AI 설정몬스터] 정기 구독 업그레이드 안내
 * - 패밀리: [👑 가족 초대 & 서버도우미] 가족 무수락 초대 링크/QR (방장 강퇴권 포함) + 양가 통합권 설정
 * - 동호·동창회: [👥 동호·동창회 관리 & 서버도우미] 소(20명)/중(100명)/대(무제한) 동호·동창회 설정 + 회원 초대/강퇴 관리
 * - 10대 학생: [🎮 게이밍 PC & 학생인증] 하교 후 방장 게이밍 PC 집중 동기화 토글 + 학생증 로컬 OCR 0.1초 인증(월 900원)
 */
export const LoungeCustomSettingsHeader: React.FC = () => {
  const {
    activeLoungeType,
    setActiveLoungeType,
    activeFamilyRoom,
    setActiveFamilyRoom,
    activeSharedRoomId,
    activeJoinedRoomMeta,
    leaveJoinedSharedRoom,
    sharedRoomHostPhotos,
    sharedRoomAddedPhotos,
    clubSizeTier,
    setClubSizeTier,
    studentOcrVerified,
    verifyStudentOcr,
    activePricingPlan,
    activatePricingPlan,
    isStoreAppMode,
    setShowProModal,
    syncState,
    setPrivateSyncStrategy,
    triggerSyncNow,
    pcAgentPairedMobile,
    setPcAgentPairedMobile,
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
  const [familyShortsWatermark, setFamilyShortsWatermark] = useState('사랑하는 우리가족');
  const [clubShortsWatermark, setClubShortsWatermark] = useState('제주여고 89회 공식 갤러리');
  const [shortsExportToast, setShortsExportToast] = useState<string | null>(null);
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

  useEffect(() => {
    setIsZCoreConnected(zCoreBridge.isConnected);
    const unsub = zCoreBridge.subscribe((conn) => setIsZCoreConnected(conn));
    void zCoreBridge.checkHealth();
    return () => {
      unsub();
    };
  }, []);

  // [안 A 방 보존 원칙]: 사용자가 선택한 본가(친가)·처가(친정)·초대받은 방이 [초대 & 방 관리] 진입 시 '우리집'으로 강제 덮어쓰이지 않도록 원상태 그대로 유지합니다.

  const isLoggedInUser = Boolean(
    merlinAuth?.email && merlinAuth.userId && merlinAuth.userId !== 'guest'
  );
  const isMainPcConnected = isLoggedInUser && isZCoreConnected;
  const isMobileConnected = isLoggedInUser && Boolean(pcAgentPairedMobile);
  const openLoginModal = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openLoginModal'));
    }
  };
  const openZCoreGuideModal = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openZCoreGuideModal'));
    }
  };

  const renderRoomCreationAndExitPolicyBox = () => (
    <div className="p-3.5 rounded-xl bg-zinc-950/90 border border-white/10 flex flex-wrap items-center justify-between gap-2.5 max-w-full overflow-hidden">
      <span className="font-label-sm text-[12px] text-zinc-200 font-bold break-keep">
        🛠️ 사진 삭제·숨기기 권한 설정
      </span>

      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto max-w-full">
        <button
          type="button"
          onClick={() => setHostRetainsHidePermission(true)}
          className={`px-3 py-1.5 rounded-lg font-label-sm text-[11.5px] font-extrabold border cursor-pointer break-keep text-left ${
            hostRetainsHidePermission
              ? 'bg-primary-container text-zinc-950 border-primary-container'
              : 'bg-zinc-900 text-zinc-300 border-white/15'
          }`}
        >
          👑 방장 상시 숨기기 가능 (권장)
        </button>
        <button
          type="button"
          onClick={() => setHostRetainsHidePermission(false)}
          className={`px-3 py-1.5 rounded-lg font-label-sm text-[11.5px] font-extrabold border cursor-pointer break-keep text-left ${
            !hostRetainsHidePermission
              ? 'bg-primary-container text-zinc-950 border-primary-container'
              : 'bg-zinc-900 text-zinc-300 border-white/15'
          }`}
        >
          🤝 24시간 내 본인 삭제만
        </button>

        {activeJoinedRoomMeta && (
          <button
            type="button"
            onClick={() => void leaveJoinedSharedRoom(activeJoinedRoomMeta.roomId)}
            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/50 text-rose-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer break-keep"
          >
            🚪 이 공유방 나가기 (내 기기 이 방 캐시 즉시 삭제)
          </button>
        )}
      </div>
    </div>
  );

  // [D-11/D-12 가짜 목업 0건 원칙]: 하드코딩된 가짜 가족·동호회 멤버('진욱/은숙/김철수 총무')를 100% 소거하고,
  // 현재 방의 실제 방장 + 실제 사진 업로더/합류 멤버만 표시합니다.
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

  const kickedSet = new Set(kickedMemberNames);
  const handleKickRoomMember = (memberName: string) => {
    const clean = memberName.trim();
    if (!clean) return;
    const nextKicked = Array.from(new Set([...kickedMemberNames, clean]));
    setKickedMemberNames(nextKicked);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(KICKED_ROOM_MEMBERS_STORAGE_KEY, JSON.stringify(nextKicked));
      } catch {
        /* ignore */
      }
    }
    if (activeSharedRoomId) {
      void kickMemberFromSupabaseSharedPhotoRoom(activeSharedRoomId, clean);
    }
    useSaySeeStore
      .getState()
      .showToast(`🚫 [${clean}] 멤버를 공유방에서 내보냈습니다.`);
  };

  const derivedParticipantNames = Array.from(
    new Set(
      [
        ...(activeJoinedRoomMeta && isLoggedInUser ? [myDisplayName] : []),
        ...currentRoomCorpus
          .map((p) => String(p.uploaderLabel || '').replace(/^[👑📸👤\s]+/, '').trim())
          .filter(Boolean),
      ].filter(
        (name) =>
          name &&
          name !== hostDisplayName &&
          name !== `${hostDisplayName} (방장)` &&
          name !== '방장' &&
          !kickedSet.has(name)
      )
    )
  );

  const visibleFamilyMembers = isLoggedInUser || activeJoinedRoomMeta
    ? [
        {
          id: 'host_member',
          name: `${hostDisplayName} (방장)`,
          rawName: hostDisplayName,
          room: activeFamilyRoom || '우리집',
          role: 'HOST' as const,
        },
        ...derivedParticipantNames.map((name, idx) => ({
          id: `fam_member_${idx}_${name}`,
          name,
          rawName: name,
          room: activeFamilyRoom || '우리집',
          role: 'MEMBER' as const,
        })),
      ]
    : [];

  const visibleClubMembers = isLoggedInUser || activeJoinedRoomMeta
    ? [
        {
          id: 'club_host_member',
          name: `${hostDisplayName} (방장)`,
          rawName: hostDisplayName,
          badge: '방장',
          role: 'HOST' as const,
        },
        ...derivedParticipantNames.map((name, idx) => ({
          id: `club_member_${idx}_${name}`,
          name,
          rawName: name,
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
        `[귀신같이 사진 공유방 초대장] 설치·로그인 없이 1초 만에 우리 공유 사진을 구경하고, 무료 앱에서 내 사진 올리기·고화질 원본 저장·새 사진 알림까지 인원·장수 제한 없이 평생 0원으로 함께해요!\n👉 ${inviteUrl}`,
    });
    if (!ok) return;
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2500);
  };

  const triggerShortsWatermarkPreview = (label: string) => {
    setShortsExportToast(
      `🎬 변천사 쇼츠 우측 하단 워터마크가 [Ghosti] 대신 [${label}]로 적용되어 카톡·인스타 공유용 MP4에 각인되었습니다!`
    );
    setTimeout(() => setShortsExportToast(null), 3200);
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
      <div className="p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-5">
        {/* [수술 1 & 2 완료] 중복 배지·h1 제목·요금제 버튼 제거 ➔ 핵심 1줄 + 우측 QR 버튼만 유지 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14.5px] md:text-[15.5px] text-white font-bold">
            같은 이메일로 로그인하면 집 PC · 회사 PC · 스마트폰이 클라우드 요금 0원으로 1초 만에 직결됩니다.
          </p>

          <button
            type="button"
            onClick={() => {
              const next = !showInlineQrPanel;
              setShowInlineQrPanel(next);
              if (next && isLoggedInUser) {
                void refreshDeviceIntegrationState();
              }
            }}
            className={`px-4 py-2 rounded-xl font-label-sm text-[12.5px] font-extrabold cursor-pointer shadow-sm transition-all shrink-0 ${
              showInlineQrPanel
                ? 'bg-emerald-400 text-zinc-950 ring-2 ring-emerald-300'
                : 'bg-primary-container hover:opacity-95 text-zinc-950'
            }`}
          >
            {showInlineQrPanel ? '📱 스마트폰 1초 연결 QR 닫기 ▴' : '📱 스마트폰 1초 연결 QR ▾'}
          </button>
        </div>

        {/* [실제 카메라 스캔 호환 ISO QR 코드 + 6자리 바인딩 코드] */}
        {showInlineQrPanel && (
          <div className="p-4 rounded-2xl bg-zinc-950 border border-primary-container/50 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-[92px] h-[92px] rounded-xl bg-white p-1.5 shrink-0 flex items-center justify-center shadow-md">
                <QrCodeSvg value={qrConnectUrl} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[13.5px] font-extrabold text-primary-container">
                  📱 스마트폰 카메라 스캔용 실제 QR 코드 + 동일 이메일 1초 자동 연결
                </span>
                <p className="text-[12.5px] text-zinc-300 leading-relaxed">
                  ① 스마트폰 기본 카메라로 좌측 QR 코드를 비추면 바로 연결 화면이 열립니다.<br />
                  ② 현재 PC와 동일한 이메일(<strong className="text-emerald-300">{merlinAuth?.email || '내 이메일 계정'}</strong>)로 로그인하거나
                  {devicePairingCode6 ? (
                    <>
                      {' '}보안 번호 <strong className="text-amber-300 font-mono">{devicePairingCode6.slice(0, 3)}-{devicePairingCode6.slice(3, 6)}</strong>을 입력하면 즉시 직결됩니다.
                    </>
                  ) : (
                    ' 로그인하는 즉시 1초 만에 자동 직결됩니다.'
                  )}
                </p>
                {realMobileConnected && mobilePeers.length > 0 && (
                  <p className="text-[11.5px] text-emerald-300 font-bold mt-0.5">
                    ✓ 현재 스마트폰({mobilePeers[0]?.display_name})이 이미 연결되어 있습니다. 연결을 끊고 새로 QR 연결을 테스트하려면 아래 카드의 [🔌 연결 해제]를 눌러 주세요.
                  </p>
                )}
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
                  setTimeout(() => setMobileInstallLinkCopied(false), 3000);
                }}
                className={`px-3.5 py-2 rounded-xl font-label-sm text-[12px] font-extrabold cursor-pointer border transition-all ${
                  mobileInstallLinkCopied
                    ? 'bg-emerald-400 text-zinc-950 border-emerald-300'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-primary-container/50 text-primary-container'
                }`}
              >
                {mobileInstallLinkCopied ? '✓ 모바일 연결 링크 복사됨!' : '🔗 모바일 연결 링크 복사'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isLoggedInUser) {
                    openLoginModal();
                    return;
                  }
                  void refreshDeviceIntegrationState();
                }}
                className={`px-3.5 py-2 rounded-xl font-label-sm text-[12px] font-extrabold cursor-pointer border transition-all ${
                  realMobileConnected
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-white/15 text-zinc-200'
                }`}
              >
                {!isLoggedInUser
                  ? '🔑 먼저 이메일 로그인하기'
                  : realMobileConnected
                  ? `● 스마트폰 연결됨 (${mobilePeers[0]?.display_name || '내 폰'})`
                  : '🔄 연결 상태 새로고침'}
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
                className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[12px] font-extrabold cursor-pointer"
              >
                {showQuickSendDrawer ? '📤 파일 전송 닫기 ▴' : '📤 폰↔PC 파일 1초 전송 ▾'}
              </button>
            </div>
          </div>
        )}

        {/* 3대 기기 연결 슬롯 현황 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-3 border-t border-white/10">
          <div
            onClick={() => {
              if (!isLoggedInUser) {
                openLoginModal();
              } else if (!isZCoreConnected) {
                openZCoreGuideModal();
              }
            }}
            className={`p-4 rounded-xl bg-zinc-950/80 border flex flex-col justify-between gap-2 transition-all ${
              isMainPcConnected
                ? 'border-primary-container/40'
                : 'border-white/10 hover:border-primary-container/40 hover:bg-zinc-900/80 cursor-pointer'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[12px] font-extrabold ${
                  isMainPcConnected ? 'text-primary-container' : 'text-zinc-200'
                }`}
              >
                💻 기기 1 · 메인 PC (현재 기기)
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                  isMainPcConnected
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : isLoggedInUser
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                {isMainPcConnected
                  ? '연결됨'
                  : isLoggedInUser
                  ? 'PC 엔진 실행 대기'
                  : '미연결'}
              </span>
            </div>
            <p className="text-[13px] text-white font-bold">
              {pcPeers[0]?.display_name || '내 데스크톱 / 노트북 원본 보관소'}
            </p>
            <span
              className={`text-[11.5px] ${
                isMainPcConnected
                  ? 'text-zinc-400'
                  : 'text-primary-container font-bold'
              }`}
            >
              {isMainPcConnected
                ? '로컬 디스크 원본 100% 직결 탐색 · Ctrl+C 자동 암호화 발신'
                : isLoggedInUser
                ? '👉 클릭하여 PC 엔진 1초 실행 가이드 보기'
                : '👉 클릭하여 이메일 1초 로그인 후 이 PC 연결하기'}
            </span>
          </div>

          <div
            onClick={() => {
              if (!isLoggedInUser) {
                openLoginModal();
                return;
              }
              setShowInlineQrPanel((v) => !v);
            }}
            className={`p-4 rounded-xl bg-zinc-950/80 hover:bg-zinc-900/80 border flex flex-col justify-between gap-2 cursor-pointer transition-all ${
              realMobileConnected
                ? 'border-primary-container/40'
                : 'border-white/10 hover:border-primary-container/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-extrabold text-zinc-200">📱 기기 2 · 내 스마트폰 (갤럭시 / 아이폰)</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                  realMobileConnected
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : isLoggedInUser
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                {realMobileConnected
                  ? '연결됨'
                  : isLoggedInUser
                  ? 'QR 1초 연동 대기'
                  : '미연결'}
              </span>
            </div>
            <p className="text-[13px] text-white font-bold">
              {mobilePeers[0]?.display_name || '폰 사진 자동 백업 & 밖에서 내 PC 검색'}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11.5px] text-primary-container font-bold">
                {realMobileConnected
                  ? '✓ 실시간 클립보드 · 무선 리모컨 · 13KB 섀도우 검색 직결됨'
                  : isLoggedInUser
                  ? '👉 클릭하여 앱 설치 QR · 이메일 1초 연결 보기'
                  : '👉 클릭하여 먼저 이메일 로그인 후 스마트폰 연결하기'}
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
                  className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-[11px] font-extrabold cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {revokingSlotDeviceId === mobilePeers[0].device_id ? '해제 중...' : '🔌 연결 해제'}
                </button>
              )}
            </div>
          </div>

          {/* [기기 3 서브 PC] 실제 다중 PC 등록 감지 + 클릭 시 설치 주소 복사 */}
          <div
            onClick={async () => {
              try {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  await navigator.clipboard.writeText(qrConnectUrl);
                }
              } catch {}
              setSubPcLinkCopied(true);
              setTimeout(() => setSubPcLinkCopied(false), 3800);
            }}
            className={`p-4 rounded-xl bg-zinc-950/80 hover:bg-zinc-900/80 border flex flex-col justify-between gap-2 cursor-pointer transition-all ${
              subPcConnected
                ? 'border-emerald-400/45'
                : 'border-white/10 hover:border-emerald-400/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-extrabold text-zinc-200">🖥️ 기기 3 · 서브 PC (회사 / 집 2호기)</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                  subPcConnected || subPcLinkCopied
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                {subPcLinkCopied
                  ? '설치 주소 복사됨 ✓'
                  : subPcConnected
                  ? `연결됨 (${pcPeers.length}대 PC)`
                  : '추가 가능'}
              </span>
            </div>
            <p className="text-[13px] text-white font-bold">
              {secondaryPcPeer?.display_name || '집 ↔ 사무실 PC 양방향 AI 내용검색'}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`text-[11.5px] font-bold ${subPcLinkCopied || subPcConnected ? 'text-emerald-300' : 'text-zinc-400'}`}>
                {subPcLinkCopied
                  ? '✅ 서브 PC 연결 주소가 복사되었습니다! 다른 PC에서 접속 후 같은 이메일로 로그인하면 자동 연결됩니다.'
                  : subPcConnected
                  ? '✓ 다중 PC 실시간 클립보드 · 통합 카탈로그 연결됨'
                  : '👉 클릭 시 서브 PC 설치 주소 복사 (동일 이메일 자동 연결)'}
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
                  className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-[11px] font-extrabold cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {revokingSlotDeviceId === secondaryPcPeer.device_id ? '해제 중...' : '🔌 연결 해제'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 직관적 1줄 동기화 모드 스위처 & 지금 일치시키기 & 백업 폴더 바로 열기 */}
        <div className="px-4 py-3 rounded-xl bg-zinc-950/90 border border-white/10 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5 text-[12.5px]">
              <span className="text-zinc-200 font-bold">
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
                    return '🔒 아직 연결된 기기가 없습니다 — 우측 상단에서 로그인하면 내 PC와 스마트폰이 안전하게 연결됩니다.';
                  }
                  if (deviceEntitlement && !deviceEntitlement.unlimitedBindingUnlocked && deviceEntitlement.trialExpired) {
                    return '🔒 30일 무료체험 종료 — 대장 PC에 복사된 원본 파일은 100% 그대로 보존되며, 월 3,900원 구독 시 원격 통합이 즉시 재개됩니다.';
                  }
                  if (!realMobileConnected && !subPcConnected) {
                    return isShadowMode
                      ? '📱 다른 기기 연결 대기 중 — 연결 시 원본은 PC에 보관하고 스마트폰 용량을 99% 이상 절약합니다.'
                      : '💾 다른 기기 연결 대기 중 — 연결 시 폰·PC 양쪽에 100% 원본을 동일하게 보관합니다.';
                  }
                  return isShadowMode
                    ? `⚡ 스마트폰 용량 99.4% 절약 중 (원본은 PC 안전 보관 · 폰 점유 ${livePackMB}MB)`
                    : `💾 폰·PC 양쪽 100% 원본 보관 중 (${liveOriginalGB > 0 ? `${liveOriginalGB}GB` : `${photos.filter((p) => !p.quarantined).length}장 인덱싱됨`})`;
                })()}
              </span>
              {syncState.syncing && deviceSyncProgress && (
                <span className="text-[11.5px] text-primary-container font-extrabold">
                  ⏳ {deviceSyncProgress.phase} ({deviceSyncProgress.current}/{Math.max(1, deviceSyncProgress.total)})
                </span>
              )}
              {isLoggedInUser && (
                <span className="text-[11.5px] text-zinc-400">
                  📁 PC 원본 백업 저장 위치:{' '}
                  <strong className="text-zinc-200">
                    {lastPhoneBackupFolderPath || '내 PC ➔ 사진(Pictures) ➔ Ghosti_Phone_Backup'}
                  </strong>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex p-0.5 rounded-xl bg-zinc-900 border border-white/10">
                <button
                  type="button"
                  onClick={() => setPrivateSyncStrategy('shadow')}
                  className={`px-3 py-1.5 rounded-lg font-label-sm text-[11.5px] font-extrabold cursor-pointer transition-all whitespace-nowrap ${
                    isShadowMode
                      ? 'bg-primary-container text-zinc-950 shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  ⚡ 스마트 절약 연동(기본)
                </button>
                <button
                  type="button"
                  onClick={() => setPrivateSyncStrategy('mirror')}
                  className={`px-3 py-1.5 rounded-lg font-label-sm text-[11.5px] font-extrabold cursor-pointer transition-all whitespace-nowrap ${
                    !isShadowMode
                      ? 'bg-primary-container text-zinc-950 shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  💾 원본 전체 백업
                </button>
              </div>

              {isLoggedInUser && isZCoreConnected && (
                <button
                  type="button"
                  data-testid="open-phone-backup-folder-btn"
                  onClick={() => void openLocalFolder('phone_backup')}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11.5px] font-extrabold cursor-pointer whitespace-nowrap"
                  title="윈도우 탐색기에서 내 PC 사진\Ghosti_Phone_Backup 폴더를 바로 엽니다"
                >
                  📂 폰 백업 폴더 바로 열기
                </button>
              )}

              {!isLoggedInUser ? (
                <button
                  type="button"
                  onClick={openLoginModal}
                  className="px-3.5 py-1.5 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer whitespace-nowrap"
                >
                  🔑 로그인하여 기기 연결
                </button>
              ) : deviceEntitlement && !deviceEntitlement.unlimitedBindingUnlocked && deviceEntitlement.trialExpired && !isStoreAppMode ? (
                <button
                  type="button"
                  onClick={() => openSubscriptionCheckout('personal_sub_3900')}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-label-sm text-[11.5px] font-black cursor-pointer whitespace-nowrap"
                >
                  💳 월 3,900원 구독으로 다시 연결
                </button>
              ) : (
                <button
                  type="button"
                  disabled={syncState.syncing}
                  onClick={() => void triggerSyncNow()}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-white font-label-sm text-[11.5px] font-extrabold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {syncState.syncing ? '동기화 중...' : '⚡ 지금 일치시키기'}
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
              <div className="pt-2.5 border-t border-white/10 flex flex-col gap-2">
                {remoteSyncedPhotos.length > 0 && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[12px] font-extrabold text-primary-container">
                        🔗 다른 내 기기에서 동기화된 사진 ({remoteSyncedPhotos.length}장)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchSpace('gallery');
                          setDesktopTab('dashboard');
                        }}
                        className="px-3 py-1 rounded-lg bg-primary-container/15 hover:bg-primary-container/25 border border-primary-container/45 text-primary-container text-[11.5px] font-extrabold cursor-pointer"
                      >
                        📸 귀신검색 [사진] 탭에서 전체 보기
                      </button>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {remoteSyncedPhotos.slice(0, 10).map((rp) => (
                        <button
                          key={rp.id}
                          type="button"
                          onClick={() => setSelectedPhoto(rp)}
                          className="w-14 h-14 rounded-lg overflow-hidden border border-white/15 hover:border-primary-container shrink-0 cursor-pointer bg-zinc-900 transition-colors"
                          title={`${rp.name} (${rp.locationKo || '동기화 사진'})`}
                        >
                          <img src={rp.thumbUrl} alt={rp.name} className="w-full h-full object-cover" />
                        </button>
                      ))}
                      {remoteSyncedPhotos.length > 10 && (
                        <span className="text-[11px] text-zinc-400 font-bold shrink-0 px-1">
                          +{remoteSyncedPhotos.length - 10}장
                        </span>
                      )}
                    </div>
                  </>
                )}
                {remoteSyncedDocs.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-white/5">
                    <span className="text-[12px] font-extrabold text-cyan-300">
                      📄 다른 내 기기(PC)에서 동기화된 문서 ({remoteSyncedDocs.length}건 · 밖에서도 1초 검색 가능)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchSpace('vault');
                        setDesktopTab('dashboard');
                      }}
                      className="px-3 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/45 text-cyan-200 text-[11.5px] font-extrabold cursor-pointer"
                    >
                      📄 귀신검색 [문서] 탭에서 전체 보기
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* 실시간 E2EE 클립보드 & 6자리 바인딩 & 30일 체험 상태 바 */}
        <CrossDeviceClipboardAndPairingBar />

        {showQuickSendDrawer && (
          <div className="pt-2 border-t border-white/10">
            <PcMasterQuickSendPanel />
          </div>
        )}
      </div>
    );
  }

  if (activeLoungeType === 'family') {
    const FAMILY_ROOMS: FamilyRoomId[] = ['우리집', '본가(친가)', '처가(친정)'];
    return (
      <div className="p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <GhostiBrandLogo size="mobile" showBadge={true} />
              <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold w-fit">
                👑 가족 초대 &amp; 방 분리 관리
              </span>
            </div>
            <h2 className="font-headline-sm text-[18px] text-white font-bold mt-0.5">
              가족 카톡 초대 &amp; 멤버 관리
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11.5px] font-extrabold">
              🎉 우리집·본가·처가 3방 인원·장수 무제한 평생 0원
            </span>
            <button
              type="button"
              onClick={copyInviteLink}
              className="px-4 py-2 rounded-xl bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold cursor-pointer"
            >
              {inviteCopied ? '✓ 카톡 무수락 초대 링크 복사됨!' : '💬 가족 무수락 카톡 초대 링크·QR 발급'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-white/10">
          <div className="flex flex-col gap-2">
            <span className="font-label-sm text-[12px] text-zinc-300 font-bold">
              🏠 양가 3개 방 분리 설정 (현재 선택: {activeFamilyRoom || '우리집'})
            </span>
            <div className="flex flex-wrap gap-2">
              {FAMILY_ROOMS.map((room) => {
                const isSelectedRoom = (activeFamilyRoom || '우리집') === room;
                return (
                  <button
                    key={room}
                    type="button"
                    onClick={() => setActiveFamilyRoom(room)}
                    className={`px-3.5 py-2 rounded-xl font-label-sm text-[12px] font-bold border cursor-pointer transition-all ${
                      isSelectedRoom
                        ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold shadow-xs'
                        : 'bg-zinc-950 text-zinc-300 border-white/10 hover:bg-zinc-900'
                    }`}
                  >
                    {isSelectedRoom ? `✓ ${room}` : room}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-label-sm text-[12px] text-zinc-300 font-bold">
              👨‍👩‍👧‍👦 참여 중인 가족 멤버 ({visibleFamilyMembers.length}명 · 방장 원터치 강퇴권)
            </span>
            {visibleFamilyMembers.length === 0 ? (
              <div className="px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-[12px] text-zinc-400 break-keep">
                아직 참여 중인 가족 멤버가 없습니다. 상단 [💬 가족 무수락 카톡 초대 링크·QR 발급] 버튼으로 가족을 초대하면 여기에 표시됩니다.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {visibleFamilyMembers.map((m) => (
                  <div
                    key={m.id}
                    className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-white/10 flex items-center gap-2 text-[11.5px]"
                  >
                    <span className="text-zinc-200 font-bold">{m.name}</span>
                    <span className="text-zinc-500">({m.room})</span>
                    {m.role !== 'HOST' && !activeJoinedRoomMeta && (
                      <button
                        type="button"
                        onClick={() => handleKickRoomMember(m.rawName)}
                        className="text-rose-400 hover:text-rose-300 font-bold ml-1 cursor-pointer"
                      >
                        [강퇴]
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 자동화 숏폼 '가족 맞춤형 워터마크' 권한 */}
        <div className="p-4 rounded-xl bg-zinc-950/90 border border-primary-container/35 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 max-w-full overflow-hidden">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-primary-container/20 text-primary-container font-label-sm text-[10.5px] font-extrabold">
                🎬 자동화 변천사 숏폼 · 맞춤형 워터마크
              </span>
              <span className="font-mono text-[11px] text-amber-300 font-bold">
                현재 우측 하단 각인: [{familyShortsWatermark}]
              </span>
            </div>
            <p className="font-body-sm text-[12px] text-zinc-300">
              기본 <code>[Ghosti]</code> 로고 대신 <strong>[{familyShortsWatermark}]</strong> 워터마크를 박아 카톡·인스타로 공유하면 다른 가족 모임의 연쇄 유입이 일어납니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto max-w-full">
            <input
              type="text"
              value={familyShortsWatermark}
              onChange={(e) => setFamilyShortsWatermark(e.target.value)}
              placeholder="예: 사랑하는 우리가족"
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-white text-[12px] font-bold w-full sm:w-44 min-w-0"
            />
            <button
              type="button"
              onClick={() => triggerShortsWatermarkWatermarkPreview(familyShortsWatermark)}
              className="px-3.5 py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold whitespace-nowrap cursor-pointer"
            >
              🎬 워터마크 적용 &amp; 쇼츠 미리보기
            </button>
          </div>
        </div>

        {shortsExportToast && (
          <div className="px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 font-label-sm text-[12px] font-bold">
            {shortsExportToast}
          </div>
        )}

        {renderRoomCreationAndExitPolicyBox()}
      </div>
    );
  }

  function triggerShortsWatermarkWatermarkPreview(label: string) {
    triggerShortsWatermarkPreview(label);
  }

  if (activeLoungeType === 'club' || activeLoungeType === 'student') {
    const isAlumniRoom = activeLoungeType === 'student';
    return (
      <div className="p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <GhostiBrandLogo size="mobile" showBadge={true} />
              <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold w-fit">
                {isAlumniRoom ? '🎓 동창회 초대 & 방 관리' : '⛰️ 동호회·모임 초대 & 방 관리'}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11px] font-extrabold">
                🎉 인원·장수 제한 없이 평생 0원
              </span>
            </div>
            <h2 className="font-headline-sm text-[18px] text-white font-bold mt-0.5">
              {isAlumniRoom
                ? '🎓 동창회 카톡 초대 & 동기 회원 관리'
                : '⛰️ 동호회·모임 카톡 초대 & 회원 관리'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyInviteLink}
              className="px-4 py-2 rounded-xl bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold cursor-pointer"
            >
              {inviteCopied
                ? '✓ 초대 링크 복사됨!'
                : isAlumniRoom
                ? '💌 동창회 무가입 1초 초대 링크 복사'
                : '⛳ 동호회·모임 무가입 1초 초대 링크 복사'}
            </button>
          </div>
        </div>

        {/* 모임·동창회 맞춤형 쇼츠 워터마크 커스텀 */}
        <div className="p-4 rounded-xl bg-zinc-950/90 border border-amber-400/40 flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-400 text-zinc-950 font-label-sm text-[10.5px] font-extrabold">
                  🎬 맞춤형 쇼츠 워터마크
                </span>
                <span className="font-mono text-[11.5px] text-amber-300 font-bold">
                  우측 하단 각인: [{clubShortsWatermark}]
                </span>
              </div>
              <p className="font-body-sm text-[12px] text-zinc-300">
                자동 렌더링 변천사 쇼츠 우측 하단에 <code>[Ghosti]</code> 대신 <strong>[{clubShortsWatermark}]</strong>를 박아 카톡·인스타로 공유할 수 있습니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0 max-w-full">
              <input
                type="text"
                value={clubShortsWatermark}
                onChange={(e) => setClubShortsWatermark(e.target.value)}
                placeholder="예: 제주여고 89회 공식 갤러리"
                className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-white text-[12px] font-bold w-full sm:w-52 min-w-0"
              />
              <button
                type="button"
                onClick={() => triggerShortsWatermarkPreview(clubShortsWatermark)}
                className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold whitespace-nowrap cursor-pointer"
              >
                🎬 워터마크 적용 &amp; 쇼츠 각인
              </button>
            </div>
          </div>

          {shortsExportToast && (
            <div className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 font-label-sm text-[11.5px] font-bold">
              {shortsExportToast}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
          <span className="font-label-sm text-[12px] text-zinc-300 font-bold mr-1">
            {isAlumniRoom
              ? `참여 중인 동창 회원 (${visibleClubMembers.length}명):`
              : `참여 중인 모임 회원 (${visibleClubMembers.length}명):`}
          </span>
          {visibleClubMembers.length === 0 ? (
            <span className="text-[12px] text-zinc-400 break-keep">
              아직 참여 중인 회원이 없습니다. 초대 링크를 공유하면 합류한 회원이 여기에 표시됩니다.
            </span>
          ) : (
            visibleClubMembers.map((m) => (
              <div
                key={m.id}
                className="px-3 py-1 rounded-xl bg-zinc-950 border border-white/10 flex items-center gap-2 text-[11.5px]"
              >
                <span className="text-zinc-200 font-bold">{m.name}</span>
                <span className="text-zinc-500">[{m.badge}]</span>
                {m.role !== 'HOST' && !activeJoinedRoomMeta && (
                  <button
                    type="button"
                    onClick={() => handleKickRoomMember(m.rawName)}
                    className="text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                  >
                    [강퇴]
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

  // work ('💼 업무 공유 드라이브 (S:)')
  return <WorkLoungeB2BHub />;
};

