import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// [2웨이브 예정] 삼체 P2P 원격 GPU 분산 연산 브릿지 — 2웨이브 출시 시 주석 해제
// import { verifyHybridP2PBridgeConnection } from '../../services/p2pHybridBridge';
// import { HostThreeBodyControlPanel } from '../shared/loungeHelpers';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { isMobileOrStoreRuntime } from '../../store/slices/storeSharedRefs';
import { hasAuthenticatedHubAccountSession } from '../../services/supabaseClient';
import { zCoreBridge } from '../../services/zCoreBridge';
import {
  activateDevicePlanPersistent,
  syncEntitlementToLocalPcEngine,
} from '../../services/deviceIntegrationService';
import {
  acceptWorkRoomInvite,
  cacheWorkRoomPreviewLocally,
  clearCachedJoinedWorkRoomMeta,
  connectWorkRoomRealtimeChannel,
  deleteWorkFileShared,
  downloadWorkFileOriginal,
  ensureLocalHostOutboundTunnelAndRegister,
  ensureMyWorkRoomAndInvite,
  fetchLocalWorkFilesNative,
  fetchLocalWorkLocksFast,
  fetchMyJoinedWorkRooms,
  fetchWorkFilesFromHostTunnel,
  fetchWorkLocksFromHostTunnel,
  fetchWorkRoomAuthedState,
  fetchWorkRoomCloudPreview,
  getActiveHostTunnelSession,
  loadCachedWorkRoomPreview,
  loadCachedWorkTombstones,
  lookupWorkTombstone,
  manageWorkBackupServersNative,
  mountWorkSDriveNative,
  normalizeWorkTombstoneMap,
  openGhostSearchForWorkSDrive,
  pullSyncRemoteWorkFilesToLocalSDrive,
  readActiveWorkRoomInviteMeta,
  readCachedJoinedWorkRoomMeta,
  readCachedMyWorkRoomMeta,
  removeWorkRoomMemberOnServer,
  sanitizeWorkLockOwner,
  saveCachedJoinedWorkRoomMeta,
  saveCachedWorkTombstones,
  setWorkNightPowerSaveNative,
  sortWorkRoomServerMembers,
  updateWorkRoomMemberRoleOnServer,
  uploadWorkFileToNativeSDrive,
  upsertWorkFilesToSupabase,
  type JoinedWorkRoomSummary,
  type WorkBackupServerNodeDto,
  type WorkDeletedTombstoneMap,
  type WorkLoungeDocDto,
  type WorkRoomPresenceMember,
  type WorkRoomServerMemberDto,
} from '../../services/workRoomSyncService';
import { PLAN_BADGE_LABELS } from '../shared/loungeHelpers';
import { purgeLocalWorkRoomDocs } from '../../services/sharedRoomLocalVault';
import { WorkLoungeBillingGateBanner } from './WorkLoungeBillingGateBanner';
import { WorkLoungeHostAdminPanels } from './WorkLoungeHostAdminPanels';
import { WorkLoungeDocListAndSidePeek } from './WorkLoungeDocListAndSidePeek';

const WORK_LOUNGE_FOLDERS = [
  { id: 'all', name: 'S:\\ (업무 드라이브 전체)', count: 0, path: 'S:\\' },
  { id: 'root', name: 'S:\\ 루트 (최상단 파일)', count: 0, path: 'S:\\' },
  { id: 'contracts', name: '01_계약서_법무문서', count: 0, path: 'S:\\01_계약서_법무문서' },
  { id: 'quotes', name: '02_견적서_엑셀문서', count: 0, path: 'S:\\02_견적서_엑셀문서' },
  { id: 'tax', name: '03_세금계산서_회계증빙', count: 0, path: 'S:\\03_세금계산서_회계증빙' },
  { id: 'site', name: '04_현장시공_도면_미디어', count: 0, path: 'S:\\04_현장시공_도면_미디어' },
];

export const WorkLoungeB2BHub: React.FC = () => {
  const {
    layout,
    desktopTab,
    mobileTab,
    isStoreAppMode,
    setShowProModal,
    activatePricingPlan,
    subscribedLounges,
    deviceEntitlement,
    setDeviceIntegrationSnapshot,
    faceClusters,
    merlinAuth,
    showToast,
  } = useSaySeeStore();
  const isMobileOrStore = layout === 'mobile' || Boolean(isStoreAppMode) || isMobileOrStoreRuntime();

  const [isZCoreConnected, setIsZCoreConnected] = useState<boolean>(zCoreBridge.isConnected);
  const [sDriveMounted, setSDriveMounted] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'semantic' | 'explorer'>(() =>
    desktopTab === 'trash' ? 'explorer' : 'semantic'
  );
  const [driveTargetPath, setDriveTargetPath] = useState('S:\\ (내 PC 업무공유폴더_S)');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [localDocs, setLocalDocs] = useState<WorkLoungeDocDto[]>([]);
  const [remoteDocs, setRemoteDocs] = useState<WorkLoungeDocDto[]>([]);
  const [remoteLocksByRelPath, setRemoteLocksByRelPath] = useState<Record<string, string | null>>({});
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [isSidePeekOpen, setIsSidePeekOpen] = useState<boolean>(false);
  const [showBackupManager, setShowBackupManager] = useState<boolean>(() => desktopTab === 'sync');
  const [masterWorkPcName, setMasterWorkPcName] = useState<string>('사내 대장 PC (S: 드라이브)');
  const [backupServers, setBackupServers] = useState<WorkBackupServerNodeDto[]>([]);
  const [localBackupDir, setLocalBackupDir] = useState<string>('');
  const [lastBackupSyncedAt, setLastBackupSyncedAt] = useState<string>('');
  const [lastBackupSyncedCount, setLastBackupSyncedCount] = useState<number>(0);
  const [newBackupServerName, setNewBackupServerName] = useState<string>('');
  const [syncingBackupNow, setSyncingBackupNow] = useState<boolean>(false);
  const [nightPowerSaveEnabled, setNightPowerSaveEnabled] = useState<boolean>(false);
  const [nightSleepBannerPhase, setNightSleepBannerPhase] = useState<'hidden' | 'visible' | 'fading'>('hidden');
  const [showMemberPermissions, setShowMemberPermissions] = useState<boolean>(
    () => desktopTab === 'sync' || mobileTab === 'settings' || !isMobileOrStoreRuntime()
  );
  const [activeWorkRoomId, setActiveWorkRoomId] = useState<string>(() => {
    const inv = readActiveWorkRoomInviteMeta();
    if (inv.hasWorkInvite && inv.roomId) return inv.roomId;
    return (
      readCachedMyWorkRoomMeta(merlinAuth?.email || undefined)?.roomId ||
      readCachedJoinedWorkRoomMeta(merlinAuth?.email || undefined)?.roomId ||
      ''
    );
  });
  const [deletedTombstones, setDeletedTombstones] = useState<WorkDeletedTombstoneMap>(() => {
    const inv = readActiveWorkRoomInviteMeta();
    const initRoom =
      (inv.hasWorkInvite && inv.roomId
        ? inv.roomId
        : readCachedMyWorkRoomMeta(merlinAuth?.email || undefined)?.roomId ||
          readCachedJoinedWorkRoomMeta(merlinAuth?.email || undefined)?.roomId) || '';
    return initRoom ? loadCachedWorkTombstones(initRoom, merlinAuth?.email || undefined) : {};
  });
  const [hasAuthoritativeRemoteState, setHasAuthoritativeRemoteState] = useState<boolean>(false);
  const [docActionNotice, setDocActionNotice] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState<boolean>(false);
  const [uploadingFiles, setUploadingFiles] = useState<boolean>(false);
  const [lastSyncedToLocalCount, setLastSyncedToLocalCount] = useState<number>(0);
  const [presencePeers, setPresencePeers] = useState<WorkRoomPresenceMember[]>([]);
  const readCachedServerMembers = useCallback((roomId: string, email?: string): WorkRoomServerMemberDto[] => {
    if (typeof window === 'undefined' || !roomId || !email) return [];
    try {
      const key = `ghosti_work_members_v1::${email.trim().toLowerCase()}::${roomId}`;
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? sortWorkRoomServerMembers(parsed as WorkRoomServerMemberDto[])
        : [];
    } catch {
      return [];
    }
  }, []);
  const saveCachedServerMembers = useCallback((roomId: string, members: WorkRoomServerMemberDto[], email?: string) => {
    if (typeof window === 'undefined' || !roomId || !email) return;
    try {
      const key = `ghosti_work_members_v1::${email.trim().toLowerCase()}::${roomId}`;
      localStorage.setItem(key, JSON.stringify(sortWorkRoomServerMembers(members)));
    } catch {
      /* ignore */
    }
  }, []);
  const [serverMembers, setServerMembers] = useState<WorkRoomServerMemberDto[]>(() => {
    const inv = readActiveWorkRoomInviteMeta();
    const initRoom =
      (inv.hasWorkInvite && inv.roomId) ||
      readCachedMyWorkRoomMeta(merlinAuth?.email || undefined)?.roomId ||
      readCachedJoinedWorkRoomMeta(merlinAuth?.email || undefined)?.roomId ||
      '';
    if (typeof window === 'undefined' || !initRoom || !merlinAuth?.email) return [];
    try {
      const raw = localStorage.getItem(`ghosti_work_members_v1::${merlinAuth.email.trim().toLowerCase()}::${initRoom}`);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? sortWorkRoomServerMembers(parsed as WorkRoomServerMemberDto[])
        : [];
    } catch {
      return [];
    }
  });
  const [myRoomRole, setMyRoomRole] = useState<'host' | 'editor' | 'viewer'>(() => {
    const cachedJoined = readCachedJoinedWorkRoomMeta(merlinAuth?.email || undefined);
    return cachedJoined && !cachedJoined.isHost ? cachedJoined.role : 'host';
  });
  const [roomSeatLimit, setRoomSeatLimit] = useState<number>(() => {
    const cachedJoined = readCachedJoinedWorkRoomMeta(merlinAuth?.email || undefined);
    return cachedJoined?.seatLimit || 5;
  });
  const [remoteRoomLockReason, setRemoteRoomLockReason] = useState<string | null>(() => {
    const cachedJoined = readCachedJoinedWorkRoomMeta(merlinAuth?.email || undefined);
    return cachedJoined && !cachedJoined.ownerUnlocked ? cachedJoined.lockReason : null;
  });
  const [joinedInvitedRoom, setJoinedInvitedRoom] = useState<JoinedWorkRoomSummary | null>(() => {
    const cachedJoined = readCachedJoinedWorkRoomMeta(merlinAuth?.email || undefined);
    return cachedJoined && !cachedJoined.isHost ? cachedJoined : null;
  });
  const [authSyncTick, setAuthSyncTick] = useState<number>(0);
  const [workInviteTick, setWorkInviteTick] = useState<number>(0);
  const [isCheckingJoinedRooms, setIsCheckingJoinedRooms] = useState<boolean>(false);
  const [startingWorkTrial, setStartingWorkTrial] = useState<boolean>(false);
  const [hostTunnelStatus, setHostTunnelStatus] = useState<string>('idle');
  const [lastDeletedUndoItem, setLastDeletedUndoItem] = useState<{
    doc: WorkLoungeDocDto;
    deletedAt: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const localDocsRef = useRef<WorkLoungeDocDto[]>([]);
  const remoteDocsRef = useRef<WorkLoungeDocDto[]>([]);
  remoteDocsRef.current = remoteDocs;
  const backupServersRef = useRef<WorkBackupServerNodeDto[]>(backupServers);
  backupServersRef.current = backupServers;
  const lastWorkFilesSigRef = useRef<string>('');
  const deletedTombstonesRef = useRef<WorkDeletedTombstoneMap>(deletedTombstones);
  deletedTombstonesRef.current = deletedTombstones;
  const inFlightDeletesRef = useRef<Set<string>>(new Set());
  const fastLocksUnsupportedRef = useRef<boolean>(false);
  const prevLockSignatureRef = useRef<string>('');
  const prevCloudUpsertSigRef = useRef<string>('');
  const acceptedInviteTokenRef = useRef<string>('');
  const realtimeRef = useRef<ReturnType<typeof connectWorkRoomRealtimeChannel> | null>(null);

  // 상단 서브메뉴(desktopTab / mobileTab) 전환과 뷰 모드·설정 패널 연동
  useEffect(() => {
    if (desktopTab === 'trash') {
      setViewMode('explorer');
    } else if (desktopTab === 'dashboard') {
      setViewMode('semantic');
    } else if (desktopTab === 'sync') {
      setShowMemberPermissions(true);
      setShowBackupManager(true);
    }
  }, [desktopTab]);

  useEffect(() => {
    if (mobileTab === 'settings') {
      setShowMemberPermissions(true);
      setShowBackupManager(true);
    }
  }, [mobileTab]);

  const inviteMeta = useMemo(
    () => readActiveWorkRoomInviteMeta(),
    [activeWorkRoomId, workInviteTick]
  );

  // 모바일 앱 실행 중(Warm/Cold) 업무 공유방 초대 딥링크 수신 시 즉시 초대 컨텍스트·방 ID 전환
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onWorkInviteApplied = (ev: Event) => {
      const detail = (ev as CustomEvent<{ roomId?: string }>).detail;
      acceptedInviteTokenRef.current = '';
      setWorkInviteTick((v) => v + 1);
      if (detail?.roomId) {
        setActiveWorkRoomId(detail.roomId);
      }
    };
    window.addEventListener('ghostiWorkInviteApplied', onWorkInviteApplied);
    return () => window.removeEventListener('ghostiWorkInviteApplied', onWorkInviteApplied);
  }, []);

  // ── 과금·30일 무료체험·만료 잠금 판정 (Fail-Closed 3중 게이트 · 팀원 초대도 이메일 로그인 필수) ──
  const isAuthenticated = Boolean(merlinAuth?.email && hasAuthenticatedHubAccountSession());
  const isGuestInvitePending = inviteMeta.hasWorkInvite && !isAuthenticated;
  const isWorkPaidActive = Boolean(deviceEntitlement?.workPaidActive);
  const isWorkTrialActive = Boolean(deviceEntitlement?.workTrialActive);
  const isWorkTrialExpired = Boolean(deviceEntitlement?.workTrialExpired);
  const hasUsedWorkTrial = Boolean(deviceEntitlement?.workTrialOptInStartedAt);
  const isOwnWorkUnlocked = Boolean(
    isWorkPaidActive || isWorkTrialActive || deviceEntitlement?.workSubscriptionUnlocked
  );
  const isJoinedInvitedMember = isAuthenticated && (inviteMeta.hasWorkInvite || Boolean(joinedInvitedRoom));
  const isWorkUnlocked = isAuthenticated && (
    isJoinedInvitedMember
      ? !remoteRoomLockReason
      : isOwnWorkUnlocked
  );

  // 로그인 직후 허브 토큰·Supabase 세션 동기화 완료 시 지연 없이 소속 방·팀원 목록 즉시 조회 트리거
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onAuthSynced = () => setAuthSyncTick((v) => v + 1);
    window.addEventListener('ghostiSupabaseUserSynced', onAuthSynced);
    window.addEventListener('merlinLoggedIn', onAuthSynced);
    return () => {
      window.removeEventListener('ghostiSupabaseUserSynced', onAuthSynced);
      window.removeEventListener('merlinLoggedIn', onAuthSynced);
    };
  }, []);

  // 계정 전환 시 이전 계정 업무방 ID·문서 잔상 즉시 초기화 및 새 계정 캐시 선복원 (C9 계정 격리)
  useEffect(() => {
    acceptedInviteTokenRef.current = '';
    const inv = readActiveWorkRoomInviteMeta();
    if (inv.hasWorkInvite && inv.roomId) {
      setJoinedInvitedRoom(null);
      setActiveWorkRoomId(inv.roomId);
      const cachedMems = merlinAuth?.email
        ? readCachedServerMembers(inv.roomId, merlinAuth.email)
        : [];
      setServerMembers(cachedMems);
      return;
    }
    const cachedHostMeta = readCachedMyWorkRoomMeta(merlinAuth?.email || undefined);
    const cachedJoinedMeta = readCachedJoinedWorkRoomMeta(merlinAuth?.email || undefined);
    if (cachedJoinedMeta && !cachedJoinedMeta.isHost && !cachedHostMeta) {
      setJoinedInvitedRoom(cachedJoinedMeta);
      setMyRoomRole(cachedJoinedMeta.role);
      setRoomSeatLimit(cachedJoinedMeta.seatLimit || 5);
      setRemoteRoomLockReason(
        cachedJoinedMeta.ownerUnlocked
          ? null
          : cachedJoinedMeta.lockReason || 'WORK_SUBSCRIPTION_REQUIRED'
      );
    } else {
      setJoinedInvitedRoom(null);
      setMyRoomRole('host');
      setRemoteRoomLockReason(null);
    }
    const nextRoomId = cachedHostMeta?.roomId || cachedJoinedMeta?.roomId || '';
    setActiveWorkRoomId(nextRoomId);
    setServerMembers(
      nextRoomId && merlinAuth?.email
        ? readCachedServerMembers(nextRoomId, merlinAuth.email)
        : []
    );
    lastWorkFilesSigRef.current = '';
    setLocalDocs([]);
    setRemoteDocs([]);
    setDeletedTombstones(
      nextRoomId ? loadCachedWorkTombstones(nextRoomId, merlinAuth?.email || undefined) : {}
    );
  }, [merlinAuth?.email, readCachedServerMembers]);

  const mergeAndPersistTombstones = useCallback(
    (patch: WorkDeletedTombstoneMap, clearRelPaths?: string[]) => {
      setDeletedTombstones((prev) => {
        const next: WorkDeletedTombstoneMap = normalizeWorkTombstoneMap({ ...prev, ...patch });
        if (clearRelPaths && clearRelPaths.length > 0) {
          for (const rp of clearRelPaths) {
            delete next[rp];
            delete next[rp.toLowerCase()];
          }
        }
        deletedTombstonesRef.current = next;
        if (activeWorkRoomId) {
          saveCachedWorkTombstones(activeWorkRoomId, next, merlinAuth?.email || undefined);
        }
        return next;
      });
    },
    [activeWorkRoomId, merlinAuth?.email]
  );

  // 로그인한 계정이 DB(ghosti_lounge_members)에 소속된 초대 업무방 및 전체 팀원 목록을 단일 왕복으로 즉시 복원
  // (PC 재로그인/F5·모바일 웹 초대 수락 후 모바일 앱 재접속 시 초대 링크 재클릭 및 2단 대기 불필요)
  useEffect(() => {
    if (!merlinAuth?.email || !hasAuthenticatedHubAccountSession()) return undefined;
    if (inviteMeta.hasWorkInvite) return undefined;
    let cancelled = false;
    setIsCheckingJoinedRooms(true);
    void fetchMyJoinedWorkRooms()
      .then((res) => {
        if (cancelled || !res.ok) return;
        if (res.rooms.length === 0) {
          clearCachedJoinedWorkRoomMeta(merlinAuth.email);
          if (!isOwnWorkUnlocked) {
            if (activeWorkRoomId) {
              void purgeLocalWorkRoomDocs(activeWorkRoomId, merlinAuth.email);
            }
            setJoinedInvitedRoom(null);
            setServerMembers([]);
            setRemoteDocs([]);
            setLocalDocs([]);
            setActiveWorkRoomId('');
          }
          return;
        }
        const invitedRoom = res.rooms.find((r) => !r.isHost) || null;
        const hostedRoom = res.rooms.find((r) => r.isHost) || null;
        if (!invitedRoom) {
          clearCachedJoinedWorkRoomMeta(merlinAuth.email);
        }
      // 본인 구독 업무방이 없거나(팀원 계정) 아직 활성 방이 없으면 초대받은 팀원방을 최우선 복원
      if (invitedRoom && (!isOwnWorkUnlocked || !activeWorkRoomId || activeWorkRoomId === invitedRoom.roomId)) {
        setJoinedInvitedRoom(invitedRoom);
        saveCachedJoinedWorkRoomMeta(invitedRoom, merlinAuth.email);
        if (activeWorkRoomId !== invitedRoom.roomId) {
          setActiveWorkRoomId(invitedRoom.roomId);
        }
        setMyRoomRole(invitedRoom.role);
        setRoomSeatLimit(invitedRoom.seatLimit || 5);
        setRemoteRoomLockReason(
          invitedRoom.ownerUnlocked
            ? null
            : invitedRoom.lockReason || 'WORK_SUBSCRIPTION_REQUIRED'
        );
        if (Array.isArray(invitedRoom.members) && invitedRoom.members.length > 0) {
          const sorted = sortWorkRoomServerMembers(invitedRoom.members);
          setServerMembers(sorted);
          saveCachedServerMembers(invitedRoom.roomId, sorted, merlinAuth.email);
        }
        if (invitedRoom.deletedTombstones && Object.keys(invitedRoom.deletedTombstones).length > 0) {
          mergeAndPersistTombstones(invitedRoom.deletedTombstones);
        }
        if (invitedRoom.hostTunnel?.masterServerName) {
          setMasterWorkPcName(invitedRoom.hostTunnel.masterServerName);
        }
        if (Array.isArray(invitedRoom.hostTunnel?.backupServers)) {
          setBackupServers(invitedRoom.hostTunnel.backupServers);
        }
        if (invitedRoom.hostTunnel?.tunnelUrl) {
          void fetchWorkFilesFromHostTunnel(
            invitedRoom.hostTunnel.tunnelUrl,
            invitedRoom.hostTunnel.accessKey
          ).then((fromTunnel) => {
            if (!cancelled && fromTunnel.ok) {
              setRemoteDocs(fromTunnel.docs);
              mergeAndPersistTombstones(fromTunnel.deletedTombstones);
              void cacheWorkRoomPreviewLocally(
                invitedRoom.roomId,
                fromTunnel.docs,
                merlinAuth.email
              );
            }
          });
        }
        return;
      }
      if (hostedRoom && (!activeWorkRoomId || activeWorkRoomId === hostedRoom.roomId)) {
        if (activeWorkRoomId !== hostedRoom.roomId) {
          setActiveWorkRoomId(hostedRoom.roomId);
        }
        setMyRoomRole('host');
        setRoomSeatLimit(hostedRoom.seatLimit || 5);
        setRemoteRoomLockReason(
          hostedRoom.ownerUnlocked
            ? null
            : hostedRoom.lockReason || 'WORK_SUBSCRIPTION_REQUIRED'
        );
        if (Array.isArray(hostedRoom.members) && hostedRoom.members.length > 0) {
          const sorted = sortWorkRoomServerMembers(hostedRoom.members);
          setServerMembers(sorted);
          saveCachedServerMembers(hostedRoom.roomId, sorted, merlinAuth.email);
        }
        if (hostedRoom.deletedTombstones && Object.keys(hostedRoom.deletedTombstones).length > 0) {
          mergeAndPersistTombstones(hostedRoom.deletedTombstones);
        }
        if (hostedRoom.hostTunnel?.masterServerName) {
          setMasterWorkPcName(hostedRoom.hostTunnel.masterServerName);
        }
        if (Array.isArray(hostedRoom.hostTunnel?.backupServers)) {
          setBackupServers(hostedRoom.hostTunnel.backupServers);
        }
        // 서버관리자(방장) 본인 계정으로 모바일 앱이나 외부 브라우저(!zCoreBridge.isConnected)에서 접속할 때도
        // 사내 대장 PC의 상시 아웃바운드 HTTPS 직통 터널에서 S:\ 공용 문서를 즉시 불러와 PC와 100% 일치시킴!
        if (hostedRoom.hostTunnel?.tunnelUrl && !zCoreBridge.isConnected) {
          void fetchWorkFilesFromHostTunnel(
            hostedRoom.hostTunnel.tunnelUrl,
            hostedRoom.hostTunnel.accessKey
          ).then((fromTunnel) => {
            if (!cancelled && fromTunnel.ok) {
              setRemoteDocs(fromTunnel.docs);
              mergeAndPersistTombstones(fromTunnel.deletedTombstones);
              void cacheWorkRoomPreviewLocally(
                hostedRoom.roomId,
                fromTunnel.docs,
                merlinAuth.email
              );
            }
          });
        }
      }
      })
      .finally(() => {
        if (!cancelled) setIsCheckingJoinedRooms(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    merlinAuth?.email,
    merlinAuth?.userId,
    authSyncTick,
    inviteMeta.hasWorkInvite,
    isOwnWorkUnlocked,
    activeWorkRoomId,
    saveCachedServerMembers,
    mergeAndPersistTombstones,
  ]);

  useEffect(() => {
    if (!activeWorkRoomId) return;
    setHasAuthoritativeRemoteState(false);
    const cachedTombs = loadCachedWorkTombstones(activeWorkRoomId, merlinAuth?.email || undefined);
    if (Object.keys(cachedTombs).length > 0) {
      setDeletedTombstones((prev) => {
        const merged = normalizeWorkTombstoneMap({ ...cachedTombs, ...prev });
        deletedTombstonesRef.current = merged;
        return merged;
      });
    }
  }, [activeWorkRoomId, merlinAuth?.email]);

  const actorNickname = useMemo(() => {
    if (typeof window !== 'undefined') {
      const savedNick = (localStorage.getItem('ghosti_hub_user_nickname') || '').trim();
      if (savedNick) return savedNick;
    }
    if (merlinAuth?.email) return merlinAuth.email.split('@')[0];
    return inviteMeta.hasWorkInvite ? '초대 팀원' : '방장(나)';
  }, [merlinAuth?.email, inviteMeta.hasWorkInvite]);

  const peerIdRef = useRef<string>(`peer_${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    setIsZCoreConnected(zCoreBridge.isConnected);
    const unsub = zCoreBridge.subscribe((conn) => setIsZCoreConnected(conn));
    void zCoreBridge.checkHealth();
    return () => {
      unsub();
    };
  }, []);

  // PC 엔진 연결 시 예비 서버 설정 로드 (권한·S: 마운트 순차 동기화는 아래 마운트 이펙트에서 단일 직렬 처리)
  useEffect(() => {
    if (!isZCoreConnected || isMobileOrStore) return;
    void manageWorkBackupServersNative({ subAction: 'get' }).then((res) => {
      if (res.ok) {
        if (res.masterServerName) setMasterWorkPcName(res.masterServerName);
        if (Array.isArray(res.backupServers)) setBackupServers(res.backupServers);
        if (res.localBackupServerDir) setLocalBackupDir(res.localBackupServerDir);
        if (res.lastBackupSyncedAt) setLastBackupSyncedAt(res.lastBackupSyncedAt);
        if (typeof res.lastBackupSyncedCount === 'number') {
          setLastBackupSyncedCount(res.lastBackupSyncedCount);
        }
      }
    });
  }, [isZCoreConnected, isMobileOrStore]);

  const openZCoreConnectModal = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openZCoreGuideModal'));
    }
  };

  const openLoginModal = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openLoginModal'));
    }
  };

  const handleStart30DayWorkTrial = async () => {
    if (!hasAuthenticatedHubAccountSession()) {
      showToast('30일 무료체험을 시작하려면 먼저 이메일 로그인을 완료해 주세요!');
      openLoginModal();
      return;
    }
    if (startingWorkTrial) return;
    setStartingWorkTrial(true);
    try {
      const res = await activateDevicePlanPersistent('work_trial_opt_in_30d');
      if (res.ok && res.entitlement) {
        setDeviceIntegrationSnapshot({ entitlement: res.entitlement });
        showToast('업무 공유(S: 드라이브) 30일 무료체험이 시작되었습니다! 소호(~5인) 직통 연결이 열렸습니다.');
      } else {
        showToast(res.message || '이미 30일 무료체험을 사용 완료했습니다. 이용권 구독으로 계속 이용하실 수 있습니다.');
        activatePricingPlan('work_soho_9900');
      }
    } finally {
      setStartingWorkTrial(false);
    }
  };

  const handleToggleNightPowerSave = async () => {
    if (!isZCoreConnected) {
      showToast('PC 엔진을 연결하면 퇴근 시 모니터만 끄고 S: 드라이브 직통 연결을 24시간 유지합니다.');
      openZCoreConnectModal();
      return;
    }
    const nextEnable = !nightPowerSaveEnabled;
    if (nextEnable) {
      setNightSleepBannerPhase('visible');
      window.setTimeout(() => setNightSleepBannerPhase('fading'), 1800);
      window.setTimeout(() => setNightSleepBannerPhase('hidden'), 3600);
    } else {
      setNightSleepBannerPhase('hidden');
    }
    const res = await setWorkNightPowerSaveNative(nextEnable, nextEnable);
    if (res.ok) {
      setNightPowerSaveEnabled(res.enabled);
      showToast(
        res.message ||
          (res.enabled
            ? '야간·퇴근 초절전 모드가 켜졌습니다. (모니터 절전 · 24시간 직결 유지)'
            : '야간·퇴근 초절전 모드를 해제했습니다.')
      );
    }
  };

  const syncRealWorkFiles = useCallback(async (forceRefresh = false) => {
    const res = await fetchLocalWorkFilesNative({
      includeSyncBase64: Boolean(activeWorkRoomId && isWorkUnlocked),
      author: actorNickname,
      knownSig: forceRefresh ? undefined : lastWorkFilesSigRef.current || undefined,
    });
    if (!res.ok) return;
    setSDriveMounted((prev) => (prev === res.mounted ? prev : res.mounted));
    if (res.targetDir) {
      setDriveTargetPath((prev) => (prev === res.targetDir ? prev : res.targetDir!));
    }
    if (res.localDeletedTombstones && Object.keys(res.localDeletedTombstones).length > 0) {
      mergeAndPersistTombstones(res.localDeletedTombstones);
    }
    if (res.unchanged) {
      return;
    }
    if (res.listSig) {
      lastWorkFilesSigRef.current = res.listSig;
    }

    const activeLocalDocs = res.docs.filter((d) => !inFlightDeletesRef.current.has(d.relPath));
    localDocsRef.current = activeLocalDocs;
    setLocalDocs(activeLocalDocs);

    setRemoteDocs((prev) => {
      if (prev.length === 0) return prev;
      const localLockByRel = new Map<string, string | null>();
      for (const d of activeLocalDocs) {
        localLockByRel.set(d.relPath, d.lockedBy);
      }
      let changed = false;
      const next = prev.map((rd) => {
        if (!localLockByRel.has(rd.relPath)) return rd;
        const locLock = localLockByRel.get(rd.relPath) ?? null;
        if (locLock === null && rd.lockedBy !== null) {
          changed = true;
          return { ...rd, lockedBy: null };
        }
        return rd;
      });
      return changed ? next : prev;
    });

    if (res.locallyDeletedRelPaths.length > 0 && isWorkUnlocked) {
      const nowIso = new Date().toISOString();
      const delPatch: WorkDeletedTombstoneMap = {};
      for (const rel of res.locallyDeletedRelPaths) {
        delPatch[rel.toLowerCase()] = { relPath: rel, deletedAt: nowIso, deletedBy: actorNickname };
      }
      mergeAndPersistTombstones(delPatch);
      const nextRemoteFiltered = remoteDocsRef.current.filter(
        (rd) => !res.locallyDeletedRelPaths.includes(rd.relPath)
      );
      setRemoteDocs(nextRemoteFiltered);
      if (activeWorkRoomId) {
        void cacheWorkRoomPreviewLocally(
          activeWorkRoomId,
          nextRemoteFiltered,
          merlinAuth?.email || undefined
        );
      }
      for (const rel of res.locallyDeletedRelPaths) {
        realtimeRef.current?.broadcastFileDeleted(rel, nowIso);
        if (activeWorkRoomId) {
          void deleteWorkFileShared({
            roomId: activeWorkRoomId,
            relPath: rel,
            actorNickname,
            deletedAt: nowIso,
          }).then((delRes) => {
            if (delRes.deletedTombstones) {
              mergeAndPersistTombstones(delRes.deletedTombstones);
            }
          });
        }
      }
    }

    if (!isWorkUnlocked) return;

    const lockMap: Record<string, string | null> = {};
    for (const d of activeLocalDocs) {
      if (d.lockedBy) lockMap[d.relPath] = d.lockedBy;
    }
    const lockSig = JSON.stringify(lockMap);
    if (lockSig !== prevLockSignatureRef.current) {
      prevLockSignatureRef.current = lockSig;
      realtimeRef.current?.broadcastLocks(lockMap);
    }

    const uploadableDocs = activeLocalDocs.filter((d) => {
      if (inFlightDeletesRef.current.has(d.relPath)) return false;
      const tomb = lookupWorkTombstone(deletedTombstonesRef.current, d.relPath);
      if (tomb?.deletedAt) {
        const delTs = Date.parse(tomb.deletedAt) || 0;
        const locTs = Date.parse(d.fileMtimeIso) || 0;
        if (delTs <= 0 || locTs <= delTs + 5000) return false;
      }
      return true;
    });

    if (activeWorkRoomId && uploadableDocs.length > 0) {
      const cloudSig = uploadableDocs
        .map((d) => `${d.relPath}:${d.sha256}:${d.lockedBy || ''}`)
        .join('|');
      if (cloudSig !== prevCloudUpsertSigRef.current) {
        realtimeRef.current?.broadcastSnapshot(uploadableDocs);
        void cacheWorkRoomPreviewLocally(
          activeWorkRoomId,
          uploadableDocs,
          merlinAuth?.email || undefined
        );
        void upsertWorkFilesToSupabase({
          roomId: activeWorkRoomId,
          docs: uploadableDocs,
          actorNickname,
        }).then((upRes) => {
          if (upRes.ok) {
            prevCloudUpsertSigRef.current = cloudSig;
          }
          if (upRes.deletedTombstones) {
            mergeAndPersistTombstones(upRes.deletedTombstones);
          }
        });
      }
    }
  }, [activeWorkRoomId, actorNickname, isWorkUnlocked, merlinAuth?.email, mergeAndPersistTombstones]);

  const pollLocalLocksFast = useCallback(async () => {
    if (isZCoreConnected) {
      if (fastLocksUnsupportedRef.current) {
        await syncRealWorkFiles();
        return;
      }
      const fast = await fetchLocalWorkLocksFast(actorNickname);
      if (fast.unsupported) {
        fastLocksUnsupportedRef.current = true;
        await syncRealWorkFiles();
        return;
      }
      if (!fast.ok) return;

      if (fast.fileCount !== localDocsRef.current.length) {
        await syncRealWorkFiles();
        return;
      }

      const lockSig = JSON.stringify(fast.locks);
      if (lockSig !== prevLockSignatureRef.current) {
        prevLockSignatureRef.current = lockSig;
        const updatedLocal = localDocsRef.current.map((d) => {
          const nextLock = fast.locks[d.relPath] || null;
          return d.lockedBy === nextLock ? d : { ...d, lockedBy: nextLock };
        });
        localDocsRef.current = updatedLocal;
        setLocalDocs(updatedLocal);
        setRemoteDocs((prev) =>
          prev.map((rd) => {
            const nextLock = fast.locks[rd.relPath] ?? null;
            return rd.lockedBy !== nextLock &&
              localDocsRef.current.some((l) => l.relPath === rd.relPath)
              ? { ...rd, lockedBy: nextLock }
              : rd;
          })
        );
        if (isWorkUnlocked) {
          realtimeRef.current?.broadcastLocks(fast.locks);
        }
      }
      return;
    }

    // 외부 팀원/모바일: 대장 PC 상시 아웃바운드 HTTPS 직통 터널에서 1초 잠금 상태 직접 조회
    const tunnel = getActiveHostTunnelSession();
    if (tunnel?.tunnelUrl && isWorkUnlocked) {
      const tLocks = await fetchWorkLocksFromHostTunnel(tunnel.tunnelUrl, tunnel.accessKey);
      if (tLocks.ok) {
        setRemoteLocksByRelPath(tLocks.locks);
      }
    }
  }, [isZCoreConnected, actorNickname, isWorkUnlocked, syncRealWorkFiles]);

  // PC 엔진 연결 시: 권한 동기화 ➔ S: 마운트/해제 순차 직렬 실행 (경합·초대 팀원 잠금 원천 차단)
  useEffect(() => {
    if (isMobileOrStore) return undefined;

    if (
      isZCoreConnected ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    ) {
      let cancelled = false;
      const syncAndMount = async () => {
        // 로그인된 초대 팀원이 첫 진입 시 소속 업무방 조회(fetchMyJoinedWorkRooms) 완료 전에 오잠금/해제되는 현상 방지
        if (!isWorkUnlocked && isAuthenticated && isCheckingJoinedRooms) {
          return;
        }
        if (isZCoreConnected) {
          await syncEntitlementToLocalPcEngine(
            deviceEntitlement || null,
            merlinAuth?.email || undefined,
            {
              unlocked: isWorkUnlocked,
              roomId: activeWorkRoomId || undefined,
              isHost: !isJoinedInvitedMember && myRoomRole === 'host',
              planId: isJoinedInvitedMember
                ? 'work_invited_member'
                : deviceEntitlement?.workPlanId || (isWorkTrialActive ? 'work_trial_30d' : ''),
            }
          );
        }
        if (cancelled) return;
        if (isWorkUnlocked) {
          const mRes = await mountWorkSDriveNative({ action: 'mount', openExplorer: false });
          if (cancelled) return;
          if (mRes.ok) {
            setSDriveMounted(Boolean(mRes.mounted));
            if (mRes.targetDir) setDriveTargetPath(mRes.targetDir);
          }
          void syncRealWorkFiles();
        } else {
          // 만료/미개통 상태: S: 드라이브 연결 해제하되 폴더 내 로컬 원본 목록은 그대로 열람·보존
          const mRes = await mountWorkSDriveNative({ action: 'unmount', openExplorer: false });
          if (cancelled) return;
          setSDriveMounted(false);
          if (mRes.targetDir) setDriveTargetPath(mRes.targetDir);
          void syncRealWorkFiles();
        }
      };
      void syncAndMount();

      const fastLockInterval = window.setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        void pollLocalLocksFast();
      }, 2000);
      const fullSyncInterval = window.setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        void syncRealWorkFiles();
      }, 10000);
      const onFocusOrVisible = () => {
        if (document.visibilityState === 'visible') {
          void pollLocalLocksFast();
          void syncRealWorkFiles();
        }
      };
      window.addEventListener('focus', onFocusOrVisible);
      document.addEventListener('visibilitychange', onFocusOrVisible);
      return () => {
        cancelled = true;
        window.clearInterval(fastLockInterval);
        window.clearInterval(fullSyncInterval);
        window.removeEventListener('focus', onFocusOrVisible);
        document.removeEventListener('visibilitychange', onFocusOrVisible);
      };
    }
    return undefined;
  }, [
    isZCoreConnected,
    isMobileOrStore,
    isAuthenticated,
    isCheckingJoinedRooms,
    isWorkUnlocked,
    isWorkTrialActive,
    isJoinedInvitedMember,
    myRoomRole,
    inviteMeta.hasWorkInvite,
    deviceEntitlement,
    merlinAuth?.email,
    activeWorkRoomId,
    syncRealWorkFiles,
    pollLocalLocksFast,
  ]);

  // 대장 PC(방장 전용)에서 업무 공유가 해금되어 있으면 상시 아웃바운드 HTTPS 직통 터널을 자동 가동·등록 (초대 팀원 PC는 등록 금지!)
  useEffect(() => {
    if (
      isJoinedInvitedMember ||
      myRoomRole !== 'host' ||
      inviteMeta.hasWorkInvite ||
      !isZCoreConnected ||
      !isWorkUnlocked ||
      !activeWorkRoomId ||
      !hasAuthenticatedHubAccountSession()
    ) {
      return undefined;
    }
    let cancelled = false;
    const ensureTunnel = async () => {
      const tRes = await ensureLocalHostOutboundTunnelAndRegister(activeWorkRoomId, {
        masterServerName: masterWorkPcName,
        backupServers,
      });
      if (cancelled) return;
      setHostTunnelStatus(tRes.status);
      if (tRes.tunnelUrl) {
        realtimeRef.current?.broadcastTunnelEndpoint({
          tunnelUrl: tRes.tunnelUrl,
          accessKey: tRes.accessKey,
          masterServerName: masterWorkPcName,
          backupServers,
        });
      }
    };
    void ensureTunnel();
    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void ensureTunnel();
    }, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    isJoinedInvitedMember,
    myRoomRole,
    inviteMeta.hasWorkInvite,
    isZCoreConnected,
    isWorkUnlocked,
    activeWorkRoomId,
    masterWorkPcName,
    backupServers,
  ]);

  // 로그인한 방장이 업무방(해금 상태) 진입 시 내 고유 업무방 ID 자동 확보
  useEffect(() => {
    if (
      inviteMeta.hasWorkInvite ||
      activeWorkRoomId ||
      !isOwnWorkUnlocked ||
      !hasAuthenticatedHubAccountSession()
    ) {
      return;
    }
    void ensureMyWorkRoomAndInvite({
      roomTitle: '우리팀 업무 공유방 (S:)',
      hostNickname: actorNickname,
      accountEmail: merlinAuth?.email || undefined,
    }).then((ensured) => {
      if (ensured.ok && ensured.roomId) {
        setActiveWorkRoomId(ensured.roomId);
        if (ensured.seatLimit) setRoomSeatLimit(ensured.seatLimit);
      }
    });
  }, [inviteMeta.hasWorkInvite, activeWorkRoomId, isOwnWorkUnlocked, actorNickname, merlinAuth?.email]);

  // 초대 링크(?workRoom=...&inviteToken=...)로 들어온 팀원이 로그인 완료 시 DB 정식 멤버로 자동 편입 및 본인 포함 전체 팀원 즉시 표시
  useEffect(() => {
    if (
      !inviteMeta.hasWorkInvite ||
      !inviteMeta.inviteToken ||
      !hasAuthenticatedHubAccountSession() ||
      acceptedInviteTokenRef.current === inviteMeta.inviteToken
    ) {
      return;
    }
    acceptedInviteTokenRef.current = inviteMeta.inviteToken;
    let cancelled = false;
    void acceptWorkRoomInvite({
      inviteToken: inviteMeta.inviteToken,
      nickname: actorNickname,
    }).then((accepted) => {
      if (cancelled) return;
      if (!accepted.ok) {
        acceptedInviteTokenRef.current = '';
        if (accepted.reason === 'WORK_SEAT_LIMIT_EXCEEDED') {
          showToast(
            accepted.message ||
              '이 업무 공유방의 이용권 정원이 모두 찼습니다. 방장님께 이용권 업그레이드를 요청해 주세요.'
          );
        } else if (
          accepted.reason === 'WORK_TRIAL_EXPIRED' ||
          accepted.reason === 'WORK_SUBSCRIPTION_REQUIRED'
        ) {
          setRemoteRoomLockReason(accepted.reason);
        }
        return;
      }
      const targetRoomId = accepted.roomId || activeWorkRoomId;
      if (accepted.roomId && accepted.roomId !== activeWorkRoomId) {
        setActiveWorkRoomId(accepted.roomId);
      }
      const nextRole = accepted.role || 'editor';
      setMyRoomRole(nextRole);
      if (accepted.seatLimit) setRoomSeatLimit(accepted.seatLimit);
      setRemoteRoomLockReason(null);

      if (targetRoomId && nextRole !== 'host') {
        const joinedSummary: JoinedWorkRoomSummary = {
          roomId: targetRoomId,
          roomTitle: accepted.roomTitle || inviteMeta.roomTitle,
          hostEmail: '',
          hostNickname: accepted.hostNickname || inviteMeta.hostNickname,
          isHost: false,
          role: nextRole,
          ownerUnlocked: true,
          seatLimit: accepted.seatLimit || 5,
          lockReason: null,
        };
        setJoinedInvitedRoom(joinedSummary);
        saveCachedJoinedWorkRoomMeta(joinedSummary, merlinAuth?.email || undefined);
      }

      if (Array.isArray(accepted.members) && accepted.members.length > 0 && targetRoomId) {
        const sorted = sortWorkRoomServerMembers(accepted.members);
        setServerMembers(sorted);
        saveCachedServerMembers(targetRoomId, sorted, merlinAuth?.email || undefined);
      } else if (targetRoomId) {
        void fetchWorkRoomAuthedState(targetRoomId, inviteMeta.inviteToken, {
          skipBlockingTunnelFetch: true,
        }).then((fresh) => {
          if (!cancelled && fresh.ok && Array.isArray(fresh.members)) {
            const sorted = sortWorkRoomServerMembers(fresh.members);
            setServerMembers(sorted);
            saveCachedServerMembers(targetRoomId, sorted, merlinAuth?.email || undefined);
          }
        });
      }

      if (accepted.deletedTombstones && Object.keys(accepted.deletedTombstones).length > 0) {
        mergeAndPersistTombstones(accepted.deletedTombstones);
      }
      if (accepted.hostTunnel?.masterServerName) {
        setMasterWorkPcName(accepted.hostTunnel.masterServerName);
      }
      if (Array.isArray(accepted.hostTunnel?.backupServers)) {
        setBackupServers(accepted.hostTunnel.backupServers);
      }
      if (accepted.hostTunnel?.tunnelUrl && (!isZCoreConnected || nextRole !== 'host')) {
        void fetchWorkFilesFromHostTunnel(
          accepted.hostTunnel.tunnelUrl,
          accepted.hostTunnel.accessKey
        ).then((fromTunnel) => {
          if (!cancelled && fromTunnel.ok && targetRoomId) {
            setRemoteDocs(fromTunnel.docs);
            mergeAndPersistTombstones(fromTunnel.deletedTombstones);
            void cacheWorkRoomPreviewLocally(
              targetRoomId,
              fromTunnel.docs,
              merlinAuth?.email || undefined
            );
          }
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    inviteMeta.hasWorkInvite,
    inviteMeta.inviteToken,
    inviteMeta.roomTitle,
    inviteMeta.hostNickname,
    actorNickname,
    activeWorkRoomId,
    isZCoreConnected,
    merlinAuth?.userId,
    merlinAuth?.email,
    authSyncTick,
    saveCachedServerMembers,
    mergeAndPersistTombstones,
    showToast,
  ]);

  // 계정별 로컬 캐시 복원 + 서버 DB 팀원 목록 즉시 반영(터널 대기 0ms) + 대장 PC 직통 터널 비동기 파일 동기화
  useEffect(() => {
    if (activeWorkRoomId && isAuthenticated) {
      const knownTombs = loadCachedWorkTombstones(activeWorkRoomId, merlinAuth?.email || undefined);
      void loadCachedWorkRoomPreview(activeWorkRoomId, merlinAuth?.email || undefined).then(
        (cachedDocs) => {
          const filteredCached = cachedDocs.filter((d) => !lookupWorkTombstone(knownTombs, d.relPath));
          if (filteredCached.length > 0) {
            setRemoteDocs((prev) => (prev.length > 0 ? prev : filteredCached));
          }
        }
      );
    }

    let cancelled = false;
    const loadRemoteState = async () => {
      if (!isAuthenticated) return;
      if (activeWorkRoomId && hasAuthenticatedHubAccountSession()) {
        const authed = await fetchWorkRoomAuthedState(activeWorkRoomId, inviteMeta.inviteToken, {
          skipBlockingTunnelFetch: true,
        });
        if (cancelled) return;
        if (!authed.ok) {
          if (
            authed.reason === 'WORK_TRIAL_EXPIRED' ||
            authed.reason === 'WORK_SUBSCRIPTION_REQUIRED'
          ) {
            setRemoteRoomLockReason(authed.reason);
          } else if (authed.reason === 'NOT_A_WORK_ROOM_MEMBER' && !inviteMeta.hasWorkInvite) {
            void purgeLocalWorkRoomDocs(activeWorkRoomId, merlinAuth?.email || undefined);
            clearCachedJoinedWorkRoomMeta(merlinAuth?.email || undefined);
            setJoinedInvitedRoom(null);
            setServerMembers([]);
            setRemoteDocs([]);
            setLocalDocs([]);
            setActiveWorkRoomId('');
          }
          return;
        }
        setRemoteRoomLockReason(null);
        if (authed.seatLimit) setRoomSeatLimit(authed.seatLimit);
        const cleanMyEmail = (merlinAuth?.email || '').trim().toLowerCase();
        if (Array.isArray(authed.members)) {
          const sortedMembers = sortWorkRoomServerMembers(authed.members);
          setServerMembers(sortedMembers);
          saveCachedServerMembers(activeWorkRoomId, sortedMembers, merlinAuth?.email || undefined);
          const myRow = cleanMyEmail
            ? sortedMembers.find((m) => m.email.toLowerCase() === cleanMyEmail)
            : undefined;
          const resolvedRole: 'host' | 'editor' | 'viewer' | undefined = myRow
            ? myRow.role === 'master'
              ? 'host'
              : myRow.role
            : authed.role;
          if (resolvedRole) {
            setMyRoomRole(resolvedRole);
            if (resolvedRole !== 'host') {
              setJoinedInvitedRoom((prev) => {
                const nextJoined: JoinedWorkRoomSummary = {
                  roomId: activeWorkRoomId,
                  roomTitle: prev?.roomTitle || inviteMeta.roomTitle || '우리팀 업무 공유방 (S:)',
                  hostEmail: prev?.hostEmail || '',
                  hostNickname: prev?.hostNickname || inviteMeta.hostNickname || '방장',
                  isHost: false,
                  role: resolvedRole,
                  ownerUnlocked: true,
                  seatLimit: authed.seatLimit || prev?.seatLimit || 5,
                  lockReason: null,
                };
                saveCachedJoinedWorkRoomMeta(nextJoined, merlinAuth?.email || undefined);
                return nextJoined;
              });
            }
          }
        } else if (authed.role) {
          setMyRoomRole(authed.role);
        }
        if (authed.hostTunnel?.masterServerName) {
          setMasterWorkPcName(authed.hostTunnel.masterServerName);
        }
        if (Array.isArray(authed.hostTunnel?.backupServers)) {
          const nextServers = authed.hostTunnel.backupServers;
          setBackupServers((prev) =>
            JSON.stringify(prev) === JSON.stringify(nextServers) ? prev : nextServers
          );
        }
        mergeAndPersistTombstones(authed.deletedTombstones);
        setHasAuthoritativeRemoteState(true);

        if (authed.hostTunnel?.tunnelUrl && (!isZCoreConnected || authed.role !== 'host')) {
          void fetchWorkFilesFromHostTunnel(
            authed.hostTunnel.tunnelUrl,
            authed.hostTunnel.accessKey
          ).then((fromTunnel) => {
            if (cancelled || !fromTunnel.ok) return;
            setRemoteDocs(fromTunnel.docs);
            mergeAndPersistTombstones(fromTunnel.deletedTombstones);
            void cacheWorkRoomPreviewLocally(
              activeWorkRoomId,
              fromTunnel.docs,
              merlinAuth?.email || undefined
            );
          });
        } else if (
          (!isZCoreConnected || authed.role !== 'host') &&
          remoteDocsRef.current.length === 0
        ) {
          // 대장 PC가 방금 터널 기동 중(starting, 3~5초 소요)일 때 주기까지 기다리지 않고 3.5초 뒤 즉시 1회 재확인
          window.setTimeout(() => {
            if (!cancelled && remoteDocsRef.current.length === 0) {
              void loadRemoteState();
            }
          }, 3500);
        }
        return;
      }
      if (inviteMeta.hasWorkInvite && inviteMeta.inviteToken) {
        const pub = await fetchWorkRoomCloudPreview(inviteMeta.inviteToken);
        if (!cancelled && pub.ok) {
          mergeAndPersistTombstones(pub.deletedTombstones);
          setHasAuthoritativeRemoteState(true);
        }
      }
    };

    void loadRemoteState();
    const pollId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void loadRemoteState();
    }, 6000);
    const onVisibleRemote = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void loadRemoteState();
      }
    };
    window.addEventListener('focus', onVisibleRemote);
    document.addEventListener('visibilitychange', onVisibleRemote);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      window.removeEventListener('focus', onVisibleRemote);
      document.removeEventListener('visibilitychange', onVisibleRemote);
    };
  }, [
    activeWorkRoomId,
    inviteMeta.hasWorkInvite,
    inviteMeta.inviteToken,
    inviteMeta.roomTitle,
    inviteMeta.hostNickname,
    isAuthenticated,
    isZCoreConnected,
    merlinAuth?.userId,
    merlinAuth?.email,
    authSyncTick,
    saveCachedServerMembers,
    mergeAndPersistTombstones,
  ]);

  const serverMembersRef = useRef<WorkRoomServerMemberDto[]>(serverMembers);
  serverMembersRef.current = serverMembers;

  // 방장 ↔ 팀원 실시간 신호·잠금·삭제 Tombstone·터널 주소·팀원 권한 중매 채널 연결 (서버 파일 저장 0 Byte)
  useEffect(() => {
    if (!activeWorkRoomId || !isWorkUnlocked || !hasAuthenticatedHubAccountSession()) {
      return undefined;
    }
    const handle = connectWorkRoomRealtimeChannel({
      roomId: activeWorkRoomId,
      peerId: peerIdRef.current,
      nickname: actorNickname,
      role: myRoomRole,
      getLocalDocs: () => localDocsRef.current,
      getLocalMembers: () => serverMembersRef.current,
      onRemoteSnapshot: (incomingDocs) => {
        const curTombs = deletedTombstonesRef.current;
        const cleaned = incomingDocs.filter((d) => {
          if (inFlightDeletesRef.current.has(d.relPath)) return false;
          const tomb = lookupWorkTombstone(curTombs, d.relPath);
          if (tomb?.deletedAt) {
            const delTs = Date.parse(tomb.deletedAt) || 0;
            const dTs = Date.parse(d.fileMtimeIso) || 0;
            if (delTs <= 0 || dTs <= delTs + 5000) return false;
          }
          return true;
        });
        setRemoteDocs(cleaned);
        if (activeWorkRoomId && cleaned.length > 0) {
          void cacheWorkRoomPreviewLocally(
            activeWorkRoomId,
            cleaned,
            merlinAuth?.email || undefined
          );
        }
      },
      onRemoteFileDeleted: (relPath, deletedAt) => {
        mergeAndPersistTombstones({ [relPath.toLowerCase()]: { relPath, deletedAt } });
        const nextRemote = remoteDocsRef.current.filter(
          (d) => d.relPath.toLowerCase() !== relPath.toLowerCase()
        );
        setRemoteDocs(nextRemote);
        if (activeWorkRoomId) {
          void cacheWorkRoomPreviewLocally(
            activeWorkRoomId,
            nextRemote,
            merlinAuth?.email || undefined
          );
        }
        setLocalDocs((prev) =>
          prev.filter((d) => d.relPath.toLowerCase() !== relPath.toLowerCase())
        );
        if (zCoreBridge.isConnected && activeWorkRoomId) {
          void deleteWorkFileShared({
            roomId: activeWorkRoomId,
            relPath,
            deletedAt,
          });
        }
      },
      onRemoteLockMap: (locks) => {
        const sanitized: Record<string, string | null> = {};
        for (const [k, v] of Object.entries(locks || {})) {
          sanitized[k] = sanitizeWorkLockOwner(v, '팀원');
        }
        setRemoteLocksByRelPath(sanitized);
      },
      onPresenceMembers: (members) => {
        setPresencePeers(members);
      },
      onRemoteTunnelEndpoint: (ep) => {
        if (ep.masterServerName) setMasterWorkPcName(ep.masterServerName);
        if (Array.isArray(ep.backupServers)) setBackupServers(ep.backupServers);
        if (!isZCoreConnected || myRoomRole !== 'host' || isJoinedInvitedMember) {
          void fetchWorkFilesFromHostTunnel(ep.tunnelUrl, ep.accessKey).then((fromTunnel) => {
            if (fromTunnel.ok) {
              setRemoteDocs(fromTunnel.docs);
              mergeAndPersistTombstones(fromTunnel.deletedTombstones);
              if (activeWorkRoomId) {
                void cacheWorkRoomPreviewLocally(
                  activeWorkRoomId,
                  fromTunnel.docs,
                  merlinAuth?.email || undefined
                );
              }
            }
          });
        }
      },
      onRemoteMembersUpdated: (incomingMembers) => {
        const sorted = sortWorkRoomServerMembers(incomingMembers);
        const cleanMyEmail = (merlinAuth?.email || '').trim().toLowerCase();
        if (cleanMyEmail && sorted.length > 0) {
          const myRow = sorted.find((m) => m.email.toLowerCase() === cleanMyEmail);
          if (!myRow && !isOwnWorkUnlocked) {
            // 방장이 나를 내보낸 경우 즉시 업무방 화면·로컬 캐시 정리
            void purgeLocalWorkRoomDocs(activeWorkRoomId, cleanMyEmail);
            clearCachedJoinedWorkRoomMeta(cleanMyEmail);
            setJoinedInvitedRoom(null);
            setServerMembers([]);
            setRemoteDocs([]);
            setLocalDocs([]);
            setActiveWorkRoomId('');
            return;
          }
          if (myRow) {
            const nextRole: 'host' | 'editor' | 'viewer' =
              myRow.role === 'master' ? 'host' : myRow.role;
            setMyRoomRole(nextRole);
            if (nextRole !== 'host') {
              setJoinedInvitedRoom((prev) => {
                const nextJoined: JoinedWorkRoomSummary = {
                  roomId: activeWorkRoomId,
                  roomTitle: prev?.roomTitle || inviteMeta.roomTitle || '우리팀 업무 공유방 (S:)',
                  hostEmail: prev?.hostEmail || '',
                  hostNickname: prev?.hostNickname || inviteMeta.hostNickname || '방장',
                  isHost: false,
                  role: nextRole,
                  ownerUnlocked: true,
                  seatLimit: prev?.seatLimit || roomSeatLimit || 5,
                  lockReason: null,
                };
                saveCachedJoinedWorkRoomMeta(nextJoined, cleanMyEmail);
                return nextJoined;
              });
            }
          }
        }
        setServerMembers(sorted);
        saveCachedServerMembers(activeWorkRoomId, sorted, merlinAuth?.email || undefined);
      },
    });
    realtimeRef.current = handle;
    return () => {
      handle.dispose();
      realtimeRef.current = null;
    };
  }, [
    activeWorkRoomId,
    isWorkUnlocked,
    isOwnWorkUnlocked,
    roomSeatLimit,
    actorNickname,
    myRoomRole,
    isZCoreConnected,
    isJoinedInvitedMember,
    inviteMeta.hasWorkInvite,
    inviteMeta.roomTitle,
    inviteMeta.hostNickname,
    merlinAuth?.email,
    saveCachedServerMembers,
    mergeAndPersistTombstones,
  ]);

  // 팀원 PC에서 PC 엔진이 켜져 있을 때 대장 PC 직통 터널로부터 내 S:\ 폴더로 자동 동기화
  useEffect(() => {
    if (
      !isZCoreConnected ||
      !isWorkUnlocked ||
      !hasAuthoritativeRemoteState ||
      inFlightDeletesRef.current.size > 0 ||
      (remoteDocs.length === 0 && Object.keys(deletedTombstones).length === 0)
    ) {
      return;
    }

    void pullSyncRemoteWorkFilesToLocalSDrive(remoteDocs, {
      roomId: activeWorkRoomId,
      inviteToken: inviteMeta.inviteToken,
      deletedTombstones,
    }).then((pulled) => {
      if (pulled.ok && (pulled.syncedCount > 0 || pulled.removedCount > 0)) {
        if (pulled.syncedCount > 0) {
          setLastSyncedToLocalCount((prev) => prev + pulled.syncedCount);
          showToast(
            `공유 업무 문서 ${pulled.syncedCount}건이 내 컴퓨터 [S:\\ 드라이브]로 자동 동기화되었습니다!`
          );
        }
        void syncRealWorkFiles();
      }
    });
  }, [
    isZCoreConnected,
    isWorkUnlocked,
    hasAuthoritativeRemoteState,
    remoteDocs,
    deletedTombstones,
    activeWorkRoomId,
    inviteMeta.inviteToken,
    showToast,
    syncRealWorkFiles,
  ]);

  // 로컬 S:\ 파일 + 대장 PC 터널 파일 통합 및 삭제 Tombstone · 실시간 잠금 상태 병합
  const docs = useMemo<WorkLoungeDocDto[]>(() => {
    const byRel = new Map<string, WorkLoungeDocDto>();
    for (const rd of remoteDocs) {
      if (inFlightDeletesRef.current.has(rd.relPath)) continue;
      const tomb = lookupWorkTombstone(deletedTombstones, rd.relPath);
      if (tomb?.deletedAt) {
        const delTs = Date.parse(tomb.deletedAt) || 0;
        const rTs = Date.parse(rd.fileMtimeIso) || 0;
        if (delTs <= 0 || rTs <= delTs + 5000) continue;
      }
      byRel.set(rd.relPath, {
        ...rd,
        lockedBy: sanitizeWorkLockOwner(rd.lockedBy, rd.author || '팀원'),
      });
    }
    for (const ld of localDocs) {
      if (inFlightDeletesRef.current.has(ld.relPath)) continue;
      const tomb = lookupWorkTombstone(deletedTombstones, ld.relPath);
      if (tomb?.deletedAt) {
        const delTs = Date.parse(tomb.deletedAt) || 0;
        const locTs = Date.parse(ld.fileMtimeIso) || 0;
        if (delTs > 0 && locTs <= delTs + 5000) continue;
      }
      const prev = byRel.get(ld.relPath);
      const localOwner = sanitizeWorkLockOwner(ld.lockedBy, ld.author || actorNickname);
      const peerOwner = sanitizeWorkLockOwner(remoteLocksByRelPath[ld.relPath], '팀원');
      byRel.set(ld.relPath, {
        ...ld,
        author: ld.author || prev?.author || actorNickname,
        lockedBy: localOwner || peerOwner || null,
      });
    }
    return Array.from(byRel.values()).map((d) => ({
      ...d,
      lockedBy: sanitizeWorkLockOwner(
        d.lockedBy || remoteLocksByRelPath[d.relPath],
        d.author || '팀원'
      ),
    }));
  }, [localDocs, remoteDocs, deletedTombstones, remoteLocksByRelPath, actorNickname]);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: docs.length,
      root: 0,
      contracts: 0,
      quotes: 0,
      tax: 0,
      site: 0,
    };
    for (const d of docs) {
      if (counts[d.folderId] !== undefined) {
        counts[d.folderId] += 1;
      }
    }
    return counts;
  }, [docs]);

  // 실제 문서 목록에서 빠른 검색 키워드 동적 추출 (가짜 하드코딩 키워드 0건)
  const dynamicQuickQueries = useMemo<string[]>(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const d of docs) {
      const base = d.fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      const token = base.split(/\s+/).find((w) => w.length >= 2 && !/^\d+$/.test(w));
      if (token && !seen.has(token.toLowerCase())) {
        seen.add(token.toLowerCase());
        out.push(token);
      }
      if (out.length >= 5) break;
    }
    return out;
  }, [docs]);

  // 방/계정 전환 시 해당 방의 캐시된 등록 팀원 목록 즉시 복원 (F5 직후 2~3초 빈 목록 깜빡임 제거)
  useEffect(() => {
    if (!activeWorkRoomId || !merlinAuth?.email) {
      setServerMembers([]);
      return;
    }
    const cached = readCachedServerMembers(activeWorkRoomId, merlinAuth.email);
    if (cached.length > 0) {
      setServerMembers(cached);
    }
  }, [activeWorkRoomId, merlinAuth?.email, readCachedServerMembers]);

  // 권한 변경·팀원 내보내기 직후에도 즉시 캐시 동기화 (변경 직후 F5 시에도 최신 권한 유지)
  useEffect(() => {
    if (!activeWorkRoomId || !merlinAuth?.email || serverMembers.length === 0) return;
    saveCachedServerMembers(activeWorkRoomId, serverMembers, merlinAuth.email);
  }, [activeWorkRoomId, merlinAuth?.email, serverMembers, saveCachedServerMembers]);

  const teamMembers = useMemo(() => {
    // 오직 서버 DB(ghosti_lounge_members) 정식 로그인 등록 멤버만 팀원으로 표시 (비로그인 게스트 presencePeers 팀원 혼입 0%)
    // 1순위 방장(master) ➔ 2순위 합류 시각 오름차순 ➔ 3순위 이메일 사전순 고정 정렬로 F5·권한 변경 시 카드 순서 불변 보장
    const validServerMembers = sortWorkRoomServerMembers(serverMembers);
    if (validServerMembers.length > 0) {
      return validServerMembers.map((m) => {
        const isHost = m.role === 'master';
        const isOnline = presencePeers.some(
          (p) => p.nickname.toLowerCase() === m.nickname.toLowerCase()
        );
        return {
          id: m.email,
          email: m.email,
          name:
            merlinAuth?.email && m.email === merlinAuth.email.toLowerCase()
              ? `${m.nickname} (나)`
              : m.nickname,
          dept: isHost
            ? '대장 PC (S: 서버 관리자)'
            : isOnline
            ? 'S:\\ 실시간 직결 중'
            : '등록된 팀원',
          role: isHost ? ('host' as const) : m.role,
          sDriveConnected: isHost ? isZCoreConnected : isOnline,
          statusText: isHost
            ? isZCoreConnected
              ? 'S:\\ 대장 PC 직통 터널 가동 중 (방장 1인 결제)'
              : 'PC 엔진 연결 시 S:\\ 드라이브가 자동 마운트됩니다'
            : m.role === 'viewer'
            ? 'S:\\ 읽기·다운로드 전용 (초대 팀원 추가 비용 없음)'
            : 'S:\\ 편집·업로드 허용 (초대 팀원 추가 비용 없음)',
        };
      });
    }
    const baseHost = {
      id: merlinAuth?.email || 'm-self',
      email: merlinAuth?.email || '',
      name: inviteMeta.hasWorkInvite
        ? `${inviteMeta.hostNickname} (방장)`
        : `${actorNickname} (방장)`,
      dept: '대장 PC (S: 서버 관리자)',
      role: 'host' as const,
      sDriveConnected: inviteMeta.hasWorkInvite ? true : isZCoreConnected,
      statusText:
        !inviteMeta.hasWorkInvite && !isZCoreConnected
          ? 'PC 엔진 연결 시 S:\\ 드라이브가 자동 마운트됩니다'
          : 'S:\\ 대장 PC 직통 연결됨 (방장 1인 결제 · 전체 관리)',
    };
    return [baseHost];
  }, [serverMembers, presencePeers, merlinAuth?.email, inviteMeta, actorNickname, isZCoreConnected]);

  const workPlan = (deviceEntitlement?.workPaidActive
    ? deviceEntitlement.workPlanId
    : subscribedLounges.work) as keyof typeof PLAN_BADGE_LABELS | undefined;

  // 업무 공유에서는 인물 여권(얼굴 클러스터링·인물 별명)이 발동하지 않으며 검색 대상에서도 제외됨
  const passportPersonTokens = useMemo(() => {
    const s = new Set<string>();
    for (const fc of faceClusters) {
      if (fc.registeredName?.trim()) s.add(fc.registeredName.trim().toLowerCase());
      for (const pv of Object.values(fc.roomPersonas ?? {})) {
        const clean = (pv || '').trim();
        if (clean) {
          s.add(clean.toLowerCase());
          const short = clean.replace(/\([^)]*\)/g, '').trim();
          if (short.length >= 2) s.add(short.toLowerCase());
        }
      }
    }
    return s;
  }, [faceClusters]);

  const filteredDocs = useMemo(() => {
    return docs.filter((doc) => {
      const folderMatch =
        viewMode === 'semantic' && selectedFolderId === 'all'
          ? true
          : selectedFolderId === 'all' || doc.folderId === selectedFolderId;
      if (!folderMatch) return false;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      const rawTokens = q.split(/\s+/).filter(Boolean);
      const nonPassportTokens = rawTokens.filter((tk) => !passportPersonTokens.has(tk));
      if (nonPassportTokens.length === 0) return false;
      const combinedText = [
        doc.fileName,
        doc.summaryTitle,
        doc.matchedSnippet,
        doc.fullTextPreview,
        ...doc.tableHeaders,
        ...doc.tableRows.flat(),
      ]
        .join(' ')
        .toLowerCase();
      return nonPassportTokens.every((token) => combinedText.includes(token));
    });
  }, [docs, viewMode, selectedFolderId, searchQuery, passportPersonTokens]);

  const selectedDoc =
    filteredDocs.find((d) => d.id === selectedDocId) || filteredDocs[0] || docs[0];

  const handleCopyWorkInviteLink = async () => {
    if (!hasAuthenticatedHubAccountSession()) {
      showToast('팀원 초대 링크를 발급하려면 먼저 이메일 로그인을 완료해 주세요!');
      openLoginModal();
      return;
    }
    if (!isWorkUnlocked) {
      showToast('30일 무료체험 시작 또는 이용권 구독 후 팀원 초대 링크를 발급할 수 있습니다.');
      activatePricingPlan('work_soho_9900');
      return;
    }
    const ensured = await ensureMyWorkRoomAndInvite({
      roomTitle: '우리팀 업무 공유방 (S:)',
      hostNickname: actorNickname,
      accountEmail: merlinAuth?.email || undefined,
    });
    if (!ensured.ok || !ensured.inviteUrl || !ensured.roomId) {
      showToast(ensured.message || '업무방 초대 링크 발급 중 오류가 발생했습니다.');
      return;
    }
    setActiveWorkRoomId(ensured.roomId);
    if (ensured.seatLimit) setRoomSeatLimit(ensured.seatLimit);
    if (localDocsRef.current.length > 0) {
      realtimeRef.current?.broadcastSnapshot(localDocsRef.current);
      void cacheWorkRoomPreviewLocally(
        ensured.roomId,
        localDocsRef.current,
        merlinAuth?.email || undefined
      );
      void upsertWorkFilesToSupabase({
        roomId: ensured.roomId,
        docs: localDocsRef.current,
        actorNickname,
      });
    }
    try {
      await navigator.clipboard?.writeText(ensured.inviteUrl);
    } catch {
      /* ignore */
    }
    setInviteCopied(true);
    window.setTimeout(() => setInviteCopied(false), 2800);
    showToast(
      `업무 공유방(S:) 초대 링크가 복사되었습니다! (정원 ${ensured.seatLimit || roomSeatLimit}인 · 초대 팀원은 추가 비용 없이 공용 드라이브를 함께 사용합니다)`
    );
  };

  const handleOpenGhostSearchWindow = async () => {
    if (!isZCoreConnected) {
      showToast('PC 엔진을 연결하면 S: 드라이브 문서 본문을 열지 않고 귀신검색창에서 바로 찾을 수 있습니다.');
      openZCoreConnectModal();
      return;
    }
    const opened = await openGhostSearchForWorkSDrive(searchQuery);
    if (opened) {
      showToast('S: 드라이브 문서·사진 본문이 직결된 [귀신검색창]을 화면 맨 앞에 띄웠습니다!');
    }
  };

  const handleOpenSDriveExplorer = async () => {
    if (!isWorkUnlocked) {
      showToast('업무 공유 이용 기간이 종료되어 S: 드라이브가 해제되었습니다. 구독 후 다시 연결할 수 있습니다.');
      activatePricingPlan('work_soho_9900');
      return;
    }
    if (!isZCoreConnected) {
      openZCoreConnectModal();
      return;
    }
    await syncEntitlementToLocalPcEngine(
      deviceEntitlement || null,
      merlinAuth?.email || undefined,
      {
        unlocked: true,
        roomId: activeWorkRoomId || undefined,
        isHost: !inviteMeta.hasWorkInvite,
        planId: inviteMeta.hasWorkInvite
          ? 'work_invited_member'
          : deviceEntitlement?.workPlanId || (isWorkTrialActive ? 'work_trial_30d' : ''),
        force: true,
      }
    );
    const res = await mountWorkSDriveNative({ action: 'mount', openExplorer: true });
    if (res.ok) {
      setSDriveMounted(Boolean(res.mounted));
      if (res.targetDir) setDriveTargetPath(res.targetDir);
      showToast('윈도우 탐색기 [업무 드라이브 (S:\\)] 폴더를 열었습니다!');
    } else if (res.message) {
      showToast(res.message);
    }
  };

  const applyFolderSwitchResult = async (res: {
    ok: boolean;
    cancelled?: boolean;
    mounted?: boolean;
    targetDir?: string;
    message?: string;
  }) => {
    if (res.cancelled) return;
    if (!res.ok) {
      showToast(res.message || '업무 폴더를 변경하지 못했습니다. 하위 폴더 경로인지 확인해 주세요.');
      return;
    }
    setSDriveMounted(Boolean(res.mounted));
    if (res.targetDir) setDriveTargetPath(res.targetDir);
    lastWorkFilesSigRef.current = '';
    localDocsRef.current = [];
    setLocalDocs([]);
    setRemoteDocs([]);
    await syncRealWorkFiles();
    showToast(`✓ S: 업무 폴더가 [${res.targetDir || '지정 폴더'}]로 연결되어 파일 인덱싱을 시작했습니다!`);
  };

  const handlePickCustomWorkFolder = async () => {
    if (!isZCoreConnected) {
      openZCoreConnectModal();
      return;
    }
    showToast('윈도우 폴더 선택창에서 연결할 폴더(예: G:\\내 드라이브\\테스트폴더)를 선택해 주세요...');
    const res = await mountWorkSDriveNative({ action: 'pick_folder', openExplorer: true });
    await applyFolderSwitchResult(res);
  };

  const handleApplyCustomWorkFolderPath = async (rawPath: string) => {
    const clean = rawPath.trim();
    if (!clean) return;
    if (!isZCoreConnected) {
      openZCoreConnectModal();
      return;
    }
    const res = await mountWorkSDriveNative({ action: 'mount', targetDir: clean, openExplorer: true });
    await applyFolderSwitchResult(res);
  };

  const handleResetDefaultWorkFolder = async () => {
    if (!isZCoreConnected) {
      openZCoreConnectModal();
      return;
    }
    const res = await mountWorkSDriveNative({ action: 'reset_default', openExplorer: false });
    await applyFolderSwitchResult(res);
  };

  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (!isWorkUnlocked) {
      showToast('30일 무료체험 시작 또는 이용권 구독 후 업무 파일을 추가할 수 있습니다.');
      activatePricingPlan('work_soho_9900');
      return;
    }
    if (myRoomRole === 'viewer') {
      showToast('읽기 전용 팀원은 파일을 추가할 수 없습니다. 방장님께 편집 권한을 요청해 주세요.');
      return;
    }
    const hasTunnel = Boolean(getActiveHostTunnelSession()?.tunnelUrl);
    if (
      !isZCoreConnected &&
      !hasTunnel &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      showToast('업무 파일을 S:\\ 드라이브에 넣으려면 내 컴퓨터 연결(PC 엔진) 또는 대장 PC 직통 연결이 필요합니다!');
      if (!isMobileOrStore) openZCoreConnectModal();
      return;
    }
    setUploadingFiles(true);
    let okCount = 0;
    const uploadedRelPaths: string[] = [];
    for (const file of Array.from(fileList)) {
      const uploaded = await uploadWorkFileToNativeSDrive({
        file,
        folderId: selectedFolderId,
        author: actorNickname,
        roomId: activeWorkRoomId,
      });
      if (uploaded.ok) {
        okCount += 1;
        if (uploaded.relPath) uploadedRelPaths.push(uploaded.relPath);
      }
    }
    setUploadingFiles(false);
    if (okCount > 0) {
      if (uploadedRelPaths.length > 0) {
        mergeAndPersistTombstones({}, uploadedRelPaths);
      }
      showToast(`업무 파일 ${okCount}건이 S:\\ 드라이브 및 팀원 공유 목록에 즉시 반영되었습니다!`);
      if (isZCoreConnected) {
        await syncRealWorkFiles();
      } else if (hasTunnel) {
        const fromTunnel = await fetchWorkFilesFromHostTunnel();
        if (fromTunnel.ok) setRemoteDocs(fromTunnel.docs);
      }
    }
  };

  const handleUndoLastDeletedFile = async () => {
    if (!lastDeletedUndoItem) return;
    const { doc } = lastDeletedUndoItem;
    setLastDeletedUndoItem(null);
    mergeAndPersistTombstones({}, [doc.relPath]);
    if (doc.inlineSyncBase64 && isZCoreConnected) {
      await pullSyncRemoteWorkFilesToLocalSDrive([doc], {
        roomId: activeWorkRoomId,
        deletedTombstones: {},
      });
      await syncRealWorkFiles();
    } else {
      setLocalDocs((prev) => [doc, ...prev.filter((d) => d.relPath !== doc.relPath)]);
      setRemoteDocs((prev) => [doc, ...prev.filter((d) => d.relPath !== doc.relPath)]);
    }
    showToast(`↩️ '${doc.fileName}' 파일 삭제를 취소하고 공유 목록에 복원했습니다. (윈도우 휴지통에서도 원복 가능)`);
  };

  const handleSaveBackupServerConfig = async (
    nextMasterName: string,
    nextNodes: WorkBackupServerNodeDto[],
    nextLocalDir?: string
  ) => {
    setMasterWorkPcName(nextMasterName);
    setBackupServers(nextNodes);
    if (typeof nextLocalDir === 'string') setLocalBackupDir(nextLocalDir);
    if (isZCoreConnected) {
      await manageWorkBackupServersNative({
        subAction: 'save',
        masterServerName: nextMasterName,
        backupServers: nextNodes,
        ...(typeof nextLocalDir === 'string' ? { localBackupServerDir: nextLocalDir } : {}),
      });
    }
    if (activeWorkRoomId && isWorkUnlocked) {
      await ensureLocalHostOutboundTunnelAndRegister(activeWorkRoomId, {
        masterServerName: nextMasterName,
        backupServers: nextNodes,
      });
    }
  };

  const handleRunBackupSyncNow = async () => {
    if (!isZCoreConnected) {
      showToast('예비 서버 백업은 PC 엔진이 연결된 컴퓨터에서 실행할 수 있습니다.');
      openZCoreConnectModal();
      return;
    }
    setSyncingBackupNow(true);
    try {
      const res = await manageWorkBackupServersNative({
        subAction: 'sync-now',
        localBackupServerDir: localBackupDir || undefined,
      });
      if (res.ok) {
        if (res.localBackupServerDir) setLocalBackupDir(res.localBackupServerDir);
        if (res.lastBackupSyncedAt) setLastBackupSyncedAt(res.lastBackupSyncedAt);
        if (typeof res.lastBackupSyncedCount === 'number') {
          setLastBackupSyncedCount(res.lastBackupSyncedCount);
        }
        showToast(
          `예비 서버 폴더로 업무 파일 ${res.lastBackupSyncedCount ?? docs.length}건 이중화 백업이 완료되었습니다!`
        );
      } else {
        showToast('예비 서버 백업 폴더 경로를 확인해 주세요. (시스템 폴더나 S: 원본 폴더와 같은 경로는 제외)');
      }
    } finally {
      setSyncingBackupNow(false);
    }
  };

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
          e.preventDefault();
          void handleUploadFiles(e.dataTransfer.files);
        }
      }}
      className="flex flex-col gap-5"
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          void handleUploadFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* 모바일 브라우저에서 업무 공유 초대 링크 접속 시 귀신같이 앱으로 바로 연결 + 자동 계정 연동 안내 */}
      {inviteMeta.hasWorkInvite &&
        layout === 'mobile' &&
        !isStoreAppMode &&
        typeof window !== 'undefined' &&
        !(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() && (
          <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 flex flex-wrap items-center justify-between gap-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-bold text-teal-900">
                귀신같이 모바일 앱에서 이 업무 공유방 바로 열기
              </div>
              <p className="text-[11.5px] text-teal-700 mt-0.5 leading-snug">
                웹에서 이메일 로그인을 완료하면 모바일 앱에 같은 계정으로 접속할 때도 이 업무방이 자동으로 유지됩니다.
              </p>
            </div>
            <a
              href={`ghosti://work?workRoom=${encodeURIComponent(inviteMeta.roomId)}&inviteToken=${encodeURIComponent(inviteMeta.inviteToken)}&host=${encodeURIComponent(inviteMeta.hostNickname)}`}
              className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold shrink-0"
            >
              앱에서 열기
            </a>
          </div>
        )}

      {isGuestInvitePending ? (
        <div
          data-testid="work-invite-login-gate-card"
          className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col gap-4 max-w-2xl"
        >
          <div className="flex flex-col gap-1.5">
            <span className="inline-flex items-center self-start px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-[11.5px] font-bold">
              팀원 초대 링크 · 로그인 필요 (초대 팀원 무료)
            </span>
            <h3 className="text-[18px] text-slate-900 font-extrabold tracking-tight">
              {inviteMeta.hostNickname}님이 초대한 [{inviteMeta.roomTitle}] 업무 공유방
            </h3>
            <p className="text-[13px] text-slate-600 leading-relaxed break-keep">
              회사 업무 문서 보안과 팀원별 권한(편집 / 읽기 전용) 확인을 위해 로그인한 계정으로만 입장할 수 있습니다.
              초대받은 팀원은 추가 결제 없이 무료(0원)로 이용하며, 이메일 로그인을 완료하는 즉시 이 업무 공유방에 자동 합류됩니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={openLoginModal}
              data-testid="work-invite-login-btn"
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[13px] font-bold cursor-pointer shadow-sm transition-colors"
            >
              이메일 로그인하고 업무 공유방 합류 (무료)
            </button>
          </div>
        </div>
      ) : isMobileOrStore && (!isAuthenticated || !activeWorkRoomId || !isWorkUnlocked) ? (
        <div
          data-testid="mobile-work-share-empty-guide"
          className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col gap-3"
        >
          {!isAuthenticated ? (
            <>
              <div className="flex flex-col gap-1">
                <span className="inline-flex self-start px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-[11px] font-bold">
                  업무 공유 (S:) · 로그인 필요
                </span>
                <h3 className="text-[16px] text-slate-900 font-bold mt-0.5 break-keep">
                  참여 중인 업무 공유방을 불러오려면 로그인해 주세요
                </h3>
                <p className="text-[12.5px] text-slate-600 leading-relaxed break-keep">
                  사내 PC에서 업무 공유방을 이용 중인 이메일로 로그인하거나, 방장님께 받은 업무 공유방 초대 링크를 열어 로그인하면 무료로 바로 연결됩니다.
                </p>
              </div>
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={openLoginModal}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[12.5px] font-bold cursor-pointer"
                >
                  이메일 로그인
                </button>
              </div>
            </>
          ) : isCheckingJoinedRooms && !remoteRoomLockReason ? (
            <div className="py-4 flex items-center gap-2.5 text-[13px] text-slate-600 font-medium">
              <span className="inline-block w-4 h-4 rounded-full border-2 border-teal-600 border-t-transparent animate-spin shrink-0" />
              <span>참여 중인 업무 공유방을 확인하고 있습니다...</span>
            </div>
          ) : remoteRoomLockReason === 'WORK_TRIAL_EXPIRED' ||
            remoteRoomLockReason === 'WORK_SUBSCRIPTION_REQUIRED' ? (
            <div className="flex flex-col gap-1.5">
              <span className="inline-flex self-start px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                업무 공유방 연결 일시 중지
              </span>
              <h3 className="text-[15.5px] text-slate-900 font-bold break-keep">
                현재 이 업무 공유방의 이용 기간이 종료되었습니다
              </h3>
              <p className="text-[12.5px] text-slate-600 leading-relaxed break-keep">
                사내 메인 PC 업무 폴더 안의 원본 문서는 안전하게 그대로 보존되어 있습니다. 방장 PC에서 업무 공유 연결이 다시 활성화되면 이 스마트폰에서도 자동으로 다시 열립니다.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="inline-flex self-start px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold">
                참여 중인 업무 공유방 없음
              </span>
              <h3 className="text-[16px] text-slate-900 font-bold break-keep">
                현재 연결된 업무 공유방이 없습니다
              </h3>
              <p className="text-[12.5px] text-slate-600 leading-relaxed break-keep">
                방장님께 받은 <b>업무 공유방 초대 링크</b>를 눌러 합류하거나, 사내 메인 PC의 <b>[업무 공유 (S:)]</b> 메뉴에서 업무 공유방을 시작하면 이 스마트폰에서도 실시간으로 문서와 현장 사진을 함께 볼 수 있습니다.
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
      <WorkLoungeBillingGateBanner
        isStoreAppMode={isStoreAppMode}
        isWorkUnlocked={isWorkUnlocked}
        isWorkTrialExpired={isWorkTrialExpired}
        remoteRoomLockReason={remoteRoomLockReason}
        hasUsedWorkTrial={hasUsedWorkTrial}
        hasWorkInvite={isJoinedInvitedMember}
        startingWorkTrial={startingWorkTrial}
        onStart30DayWorkTrial={handleStart30DayWorkTrial}
        onActivatePricingPlan={activatePricingPlan}
      />

      {/* ↩️ 삭제 직후 1초 실행 취소(Undo) 토스트 배너 (명세 8.3-2-③) */}
      {lastDeletedUndoItem && (
        <div className="p-3.5 rounded-2xl bg-amber-950/90 border border-amber-400/60 flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <span className="text-[12.5px] text-amber-100 font-bold">
            &lsquo;{lastDeletedUndoItem.doc.fileName}&rsquo; 파일을 윈도우 [휴지통]으로 옮겼습니다.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleUndoLastDeletedFile()}
              className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-label-sm text-[12px] font-semibold cursor-pointer"
            >
              ↩️ 1초 실행 취소(Undo)
            </button>
            <button
              type="button"
              onClick={() => setLastDeletedUndoItem(null)}
              className="px-2 py-1 rounded-lg bg-black/30 text-zinc-300 hover:text-white text-[11px] font-bold cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 초대 링크(?workRoom=...) 진입 시 안내 배너 */}
      {inviteMeta.hasWorkInvite && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/85 via-zinc-950 to-emerald-950/75 border border-cyan-400/50 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg bg-teal-600 text-white font-label-sm text-[11px] font-extrabold">
                {inviteMeta.hostNickname}님이 초대한 [{inviteMeta.roomTitle}]
              </span>
              <span className="text-[11.5px] text-emerald-300 font-bold">
                {isZCoreConnected
                  ? `✓ 내 컴퓨터 연결됨 · 윈도우 탐색기 S:\\ 실시간 동기화 가동 중${lastSyncedToLocalCount > 0 ? ` (+${lastSyncedToLocalCount}건 동기화됨)` : ''}`
                  : '대장 PC 직통 연결 — 웹 미리보기 & 실시간 열람 잠금 확인 가능'}
              </span>
            </div>
            <p className="text-[12px] text-zinc-300 break-keep">
              {isZCoreConnected
                ? '방장과 팀원이 올린 업무 파일이 내 컴퓨터 [탐색기 S:\\] 폴더로 자동 동기화되며, 바탕화면·탐색기 빈 공간에서 Ctrl+0 단축키로 귀신검색창에서 문서 본문을 바로 검색할 수 있습니다.'
                : '지금 바로 브라우저에서 공유 문서·표 미리보기와 누가 수정 중인지 확인할 수 있으며, 우측 버튼으로 PC 엔진을 켜는 즉시 내 윈도우 [탐색기 S:\\]로 실제 파일이 동기화됩니다.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isMobileOrStore && (
              <button
                type="button"
                onClick={() => {
                  if (isZCoreConnected) {
                    void handleOpenSDriveExplorer();
                  } else {
                    openZCoreConnectModal();
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-label-sm text-[12px] font-semibold cursor-pointer shrink-0 shadow-sm"
              >
                {isZCoreConnected
                  ? '동기화된 내 탐색기 S:\\ 바로 열기'
                  : 'PC 엔진 켜고 내 탐색기 S:\\로 동기화'}
              </button>
            )}
            {activeWorkRoomId && hasAuthenticatedHubAccountSession() && (
              <button
                type="button"
                onClick={async () => {
                  await removeWorkRoomMemberOnServer({ roomId: activeWorkRoomId });
                  await purgeLocalWorkRoomDocs(activeWorkRoomId, merlinAuth?.email || undefined);
                  clearCachedJoinedWorkRoomMeta(merlinAuth?.email || undefined);
                  sessionStorage.removeItem('ghosti_active_work_room_invite_v1');
                  setJoinedInvitedRoom(null);
                  setServerMembers([]);
                  setRemoteDocs([]);
                  setActiveWorkRoomId('');
                  showToast('초대받은 업무 공유방에서 나왔으며 내 기기의 해당 방 임시 캐시를 정리했습니다.');
                }}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-rose-400/40 text-rose-200 font-label-sm text-[11.5px] font-bold cursor-pointer shrink-0"
              >
                이 업무방 나가기
              </button>
            )}
          </div>
        </div>
      )}

      {/* 1. 헤더 + 액션바 + 듀얼 모드 스위처 + 검색창 + 폴더 필터 */}
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-headline-sm text-[20px] md:text-[22px] text-slate-900 dark:text-white font-extrabold tracking-tight">
              사무실 업무 문서·현장사진함 (S:\)
            </h2>
            {workPlan && PLAN_BADGE_LABELS[workPlan] && (
              <span className="text-[12px] text-emerald-400 font-bold">
                · ✓ {PLAN_BADGE_LABELS[workPlan]}
              </span>
            )}
            {isWorkTrialActive && !isWorkPaidActive && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-[11px] text-emerald-300 font-extrabold">
                30일 무료체험 중 (D-{deviceEntitlement?.workTrialDaysLeft ?? 30} · 정원 {roomSeatLimit}인)
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11.5px] font-bold ${
                isZCoreConnected && sDriveMounted
                  ? 'bg-emerald-500/10 border-emerald-400/25 text-emerald-300'
                  : docs.length > 0 || Boolean(getActiveHostTunnelSession()?.tunnelUrl)
                  ? 'bg-cyan-500/15 border-cyan-400/35 text-cyan-200'
                  : 'bg-zinc-900 border-white/15 text-zinc-300'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isZCoreConnected && sDriveMounted
                    ? 'bg-emerald-400'
                    : docs.length > 0 || Boolean(getActiveHostTunnelSession()?.tunnelUrl)
                    ? 'bg-cyan-400'
                    : 'bg-zinc-500'
                }`}
              />
              {isZCoreConnected
                ? `${sDriveMounted ? 'S:\\ 마운트 완료' : 'S:\\ 미연결(원본 보존)'} · 팀원 ${teamMembers.length}/${roomSeatLimit}명 · ${docs.length}건`
                : docs.length > 0 || Boolean(getActiveHostTunnelSession()?.tunnelUrl) || isJoinedInvitedMember
                ? `대장 PC 직통 연결됨 · 팀원 ${teamMembers.length}/${roomSeatLimit}명 · ${docs.length}건`
                : '사내 대장 PC 직통 연결 확인 중 · 0건'}
            </span>
            {myRoomRole !== 'host' && (
              <span
                data-testid="work-my-role-live-badge"
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${
                  myRoomRole === 'viewer'
                    ? 'bg-amber-500/15 border-amber-400/45 text-amber-200'
                    : 'bg-teal-500/15 border-teal-400/45 text-teal-200'
                }`}
              >
                내 권한: {myRoomRole === 'viewer' ? '읽기·다운로드 전용' : '편집·업로드 허용'}
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/25 text-[11px] text-cyan-300 font-bold">
              현장·증빙 사진 AI 분석 · 인물 여권 미발동(검색 제외)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isMobileOrStore && (
              <>
                <button
                  type="button"
                  onClick={() => void handleOpenGhostSearchWindow()}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-label-sm text-[12px] font-semibold cursor-pointer flex items-center gap-1.5 shadow-sm transition-all"
                  title="독립 귀신검색창을 띄워 S: 드라이브 계약서·견적서·한글(HWP) 본문을 열지 않고 바로 검색합니다 (바탕화면·탐색기 빈 공간 Ctrl+0 1회와 동일)"
                >
                  <span>귀신검색창으로 S: 문서 1초 검색</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleOpenSDriveExplorer()}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-cyan-400/45 text-cyan-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1"
                >
                  <span>탐색기 S:\ 열기</span>
                </button>
                {myRoomRole === 'host' && !inviteMeta.hasWorkInvite && (
                  <button
                    type="button"
                    onClick={() => void handlePickCustomWorkFolder()}
                    title="구글 드라이브(G:\내 드라이브\...) 하위 폴더나 기존 회사 폴더를 선택해 S: 드라이브로 그대로 연결합니다"
                    className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-teal-400/50 text-teal-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1"
                  >
                    <span>업무 폴더 변경 (G: 연결)</span>
                  </button>
                )}
              </>
            )}

            {/* 모바일(현장 직원 폰 -> S: 1초 축지법) 및 데스크톱 모두 업무 파일 추가 허용 */}
            <button
              type="button"
              disabled={uploadingFiles}
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-100 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1 disabled:opacity-50"
            >
              <span>{uploadingFiles ? '⏳ 업로드 중...' : '업무 파일 추가'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleCopyWorkInviteLink()}
              className={`px-3 py-1.5 rounded-xl border font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1 transition-all ${
                inviteCopied
                  ? 'bg-slate-900 text-white border-emerald-300'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-amber-400/50 text-amber-300'
              }`}
            >
              <span>{inviteCopied ? '✓ 업무방 초대 링크 복사됨!' : '팀원 초대 링크 복사'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowMemberPermissions((v) => !v)}
              className="px-3 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <span>팀원 권한 &amp; S: 드라이브 연결 ({teamMembers.length}/{roomSeatLimit}명)</span>
              <span>{showMemberPermissions ? '▴' : '▾'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowBackupManager((v) => !v)}
              className="px-3 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1"
            >
              <span>백업 PC(예비 서버 {backupServers.length}/2대)</span>
              <span>{showBackupManager ? '▴' : '▾'}</span>
            </button>
            {!isMobileOrStore && (
              <button
                type="button"
                onClick={() => void handleToggleNightPowerSave()}
                className={`px-3 py-1 rounded-xl border font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1 ${
                  nightPowerSaveEnabled
                    ? 'bg-indigo-400 text-zinc-950 border-indigo-300'
                    : 'bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-400/45 text-indigo-200'
                }`}
                title="퇴근·취침 시 모니터 전원만 끄고 대장 PC 본체와 S: 드라이브 직통 터널은 24시간 깨어 있게 유지합니다"
              >
                <span>
                  {nightPowerSaveEnabled
                    ? '야간·퇴근 초절전 가동 중 (해제)'
                    : '야간·퇴근 초절전 모드'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* [2웨이브 예정] 호스트(방장) PC 전용: 사무실 연결 PC 삼체(Three-Body) 실시간 관제 패널 — 2웨이브 출시 시 주석 해제 */}
        {/* {!isMobileOrStore && (
          <div className="hidden md:block">
            <HostThreeBodyControlPanel contextMode="work" />
          </div>
        )} */}

        {/* 🌙 퇴근·취침 시 실행되는 야간 초절전 모드 안내 메시지 */}
        {nightSleepBannerPhase !== 'hidden' && (
          <div
            className={`p-4 rounded-2xl bg-gradient-to-r from-indigo-950/95 via-zinc-950/95 to-slate-950/95 border border-indigo-400/60 shadow-2xl flex flex-wrap items-center justify-between gap-3 transition-opacity duration-[1800ms] ${
              nightSleepBannerPhase === 'fading' ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <div className="flex flex-col gap-1">
              <span className="font-headline-sm text-[15px] text-indigo-200 font-semibold">
                야간·퇴근 초절전 모드가 켜졌습니다 — 편히 퇴근하세요!
              </span>
              <span className="text-[12px] text-zinc-300">
                ✓ 본체 절전(수면) 방지 적용 완료 · ✓ S: 드라이브 24시간 직통 연결 유지(월 전기료 약 1,800원) ·{' '}
                <strong className="text-amber-300">
                  모니터 전원만 절전으로 꺼지며 마우스를 움직이면 언제든 다시 켜집니다.
                </strong>
              </span>
            </div>
          </div>
        )}

        <WorkLoungeHostAdminPanels
          showBackupManager={showBackupManager}
          hostTunnelStatus={hostTunnelStatus}
          masterWorkPcName={masterWorkPcName}
          driveTargetPath={driveTargetPath}
          onPickCustomWorkFolder={handlePickCustomWorkFolder}
          onApplyCustomWorkFolderPath={handleApplyCustomWorkFolderPath}
          onResetDefaultWorkFolder={handleResetDefaultWorkFolder}
          backupServers={backupServers}
          lastBackupSyncedAt={lastBackupSyncedAt}
          lastBackupSyncedCount={lastBackupSyncedCount}
          newBackupServerName={newBackupServerName}
          setNewBackupServerName={setNewBackupServerName}
          localBackupDir={localBackupDir}
          setLocalBackupDir={setLocalBackupDir}
          isMobileOrStore={isMobileOrStore}
          syncingBackupNow={syncingBackupNow}
          handleSaveBackupServerConfig={handleSaveBackupServerConfig}
          handleRunBackupSyncNow={handleRunBackupSyncNow}
          showMemberPermissions={showMemberPermissions}
          teamMembers={teamMembers}
          roomSeatLimit={roomSeatLimit}
          isStoreAppMode={isStoreAppMode}
          myRoomRole={myRoomRole}
          activeWorkRoomId={activeWorkRoomId}
          setServerMembers={setServerMembers}
          onPersistMembersCache={(nextMembers) => {
            if (activeWorkRoomId && merlinAuth?.email) {
              saveCachedServerMembers(activeWorkRoomId, nextMembers, merlinAuth.email);
            }
          }}
          onBroadcastMembersUpdated={(nextMembers) => {
            realtimeRef.current?.broadcastMembersUpdated(nextMembers);
          }}
          showToast={showToast}
        />

        {/* 듀얼 모드 스위처 (명세 5.8-2: 🔍 본문·표 내용 검색 vs 🗂️ 폴더별 보기 (S:\)) + 검색창 + 폴더 필터 알약 */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center p-1 rounded-xl bg-zinc-900 border border-white/10 gap-1">
              <button
                type="button"
                onClick={() => {
                  setViewMode('semantic');
                  setSelectedFolderId('all');
                }}
                className={`px-3 py-1.5 rounded-lg font-label-sm text-[12px] font-extrabold cursor-pointer transition-all ${
                  viewMode === 'semantic'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                본문·표 내용 검색 ({docs.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('explorer')}
                className={`px-3 py-1.5 rounded-lg font-label-sm text-[12px] font-extrabold cursor-pointer transition-all ${
                  viewMode === 'explorer'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                폴더별 보기 (S:\)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#18181B] border border-white/15 focus-within:border-primary-container rounded-2xl px-4 py-2.5 shadow-sm transition-colors">
            <span className="text-zinc-400 text-sm"></span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim()) setIsSidePeekOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey && !isMobileOrStore) {
                  e.preventDefault();
                  void handleOpenGhostSearchWindow();
                }
              }}
              placeholder={
                isMobileOrStore
                  ? '계약서 조항, 견적서·엑셀 문서, 시공 사진 검색'
                  : '계약서 조항, 견적서·엑셀 문서, 한글(HWP), 현장 시공 사진 검색... (인물 여권 제외 · 바탕화면/S: 탐색기 빈 곳 Ctrl+0 1회로도 즉시 검색)'
              }
              className="w-full bg-transparent text-white placeholder-zinc-500 font-body-sm text-[13.5px] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-zinc-400 hover:text-white text-[11.5px] font-bold shrink-0 cursor-pointer"
              >
                ✕ 지우기
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
            {(!isMobileOrStore || docs.length > 0) && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {WORK_LOUNGE_FOLDERS.filter((folder) => {
                  if (!isMobileOrStore) return true;
                  if (folder.id === 'all') return true;
                  return (folderCounts[folder.id] ?? 0) > 0;
                }).map((folder) => {
                  const active = selectedFolderId === folder.id && viewMode === 'explorer';
                  const isAllActive =
                    folder.id === 'all' && (selectedFolderId === 'all' || viewMode === 'semantic');
                  const highlight = active || isAllActive;
                  const count = folderCounts[folder.id] ?? folder.count;
                  return (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => {
                        setSelectedFolderId(folder.id);
                        setViewMode(folder.id === 'all' ? 'semantic' : 'explorer');
                      }}
                      className={`px-3 py-1.5 rounded-full font-label-sm text-[11.5px] flex items-center gap-1.5 transition-all shrink-0 cursor-pointer border ${
                        highlight
                          ? 'bg-teal-600 text-white border-teal-600 font-extrabold'
                          : 'bg-white dark:bg-zinc-900/80 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-white/10 font-bold'
                      }`}
                    >
                      <span>
                        {folder.id === 'all'
                          ? '전체 폴더'
                          : folder.id === 'root'
                          ? 'S:\\ 최상단'
                          : `${folder.name}`}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                          highlight
                            ? 'bg-white/20 text-white font-semibold'
                            : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-zinc-300'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {dynamicQuickQueries.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-slate-500 dark:text-zinc-400">
                <span>내 문서 키워드:</span>
                {dynamicQuickQueries.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      const nextQ = searchQuery === q ? '' : q;
                      setSearchQuery(nextQ);
                      if (nextQ) {
                        setViewMode('semantic');
                      }
                    }}
                    className={`underline cursor-pointer transition-colors ${
                      searchQuery === q
                        ? 'text-teal-600 dark:text-cyan-300 font-extrabold'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <WorkLoungeDocListAndSidePeek
        isSidePeekOpen={isSidePeekOpen}
        setIsSidePeekOpen={setIsSidePeekOpen}
        viewMode={viewMode}
        selectedFolderId={selectedFolderId}
        selectedFolderLabel={
          WORK_LOUNGE_FOLDERS.find((f) => f.id === selectedFolderId)?.path || selectedFolderId
        }
        filteredDocs={filteredDocs}
        selectedDoc={selectedDoc}
        setSelectedDocId={setSelectedDocId}
        isZCoreConnected={isZCoreConnected}
        isMobileOrStore={isMobileOrStore}
        fileInputRef={fileInputRef}
        handleOpenSDriveExplorer={handleOpenSDriveExplorer}
        openZCoreConnectModal={openZCoreConnectModal}
        searchQuery={searchQuery}
        activeWorkRoomId={activeWorkRoomId}
        inviteMeta={inviteMeta}
        myRoomRole={myRoomRole}
        actorNickname={actorNickname}
        merlinAuthEmail={merlinAuth?.email || undefined}
        inFlightDeletesRef={inFlightDeletesRef}
        mergeAndPersistTombstones={mergeAndPersistTombstones}
        remoteDocsRef={remoteDocsRef}
        localDocsRef={localDocsRef}
        setRemoteDocs={setRemoteDocs}
        setLocalDocs={setLocalDocs}
        setLastDeletedUndoItem={setLastDeletedUndoItem}
        realtimeRef={realtimeRef}
        showToast={showToast}
        docActionNotice={docActionNotice}
        setDocActionNotice={setDocActionNotice}
        isStoreAppMode={isStoreAppMode}
        isWorkPaidActive={isWorkPaidActive}
        activatePricingPlan={activatePricingPlan}
        setShowProModal={setShowProModal}
      />
        </>
      )}
    </section>
  );
};
