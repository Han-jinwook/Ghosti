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
  connectWorkRoomRealtimeChannel,
  deleteWorkFileShared,
  downloadWorkFileOriginal,
  ensureLocalHostOutboundTunnelAndRegister,
  ensureMyWorkRoomAndInvite,
  fetchLocalWorkFilesNative,
  fetchLocalWorkLocksFast,
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
  readCachedMyWorkRoomMeta,
  removeWorkRoomMemberOnServer,
  sanitizeWorkLockOwner,
  saveCachedWorkTombstones,
  setWorkNightPowerSaveNative,
  updateWorkRoomMemberRoleOnServer,
  uploadWorkFileToNativeSDrive,
  upsertWorkFilesToSupabase,
  type WorkBackupServerNodeDto,
  type WorkDeletedTombstoneMap,
  type WorkLoungeDocDto,
  type WorkRoomPresenceMember,
  type WorkRoomServerMemberDto,
} from '../../services/workRoomSyncService';
import { PLAN_BADGE_LABELS } from '../shared/loungeHelpers';
import { purgeLocalWorkRoomDocs } from '../../services/sharedRoomLocalVault';

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
    return readCachedMyWorkRoomMeta(merlinAuth?.email || undefined)?.roomId || '';
  });
  const [deletedTombstones, setDeletedTombstones] = useState<WorkDeletedTombstoneMap>(() => {
    const inv = readActiveWorkRoomInviteMeta();
    const initRoom =
      (inv.hasWorkInvite && inv.roomId
        ? inv.roomId
        : readCachedMyWorkRoomMeta(merlinAuth?.email || undefined)?.roomId) || '';
    return initRoom ? loadCachedWorkTombstones(initRoom, merlinAuth?.email || undefined) : {};
  });
  const [hasAuthoritativeRemoteState, setHasAuthoritativeRemoteState] = useState<boolean>(false);
  const [docActionNotice, setDocActionNotice] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState<boolean>(false);
  const [uploadingFiles, setUploadingFiles] = useState<boolean>(false);
  const [lastSyncedToLocalCount, setLastSyncedToLocalCount] = useState<number>(0);
  const [presencePeers, setPresencePeers] = useState<WorkRoomPresenceMember[]>([]);
  const [serverMembers, setServerMembers] = useState<WorkRoomServerMemberDto[]>([]);
  const [myRoomRole, setMyRoomRole] = useState<'host' | 'editor' | 'viewer'>('host');
  const [roomSeatLimit, setRoomSeatLimit] = useState<number>(5);
  const [remoteRoomLockReason, setRemoteRoomLockReason] = useState<string | null>(null);
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

  const inviteMeta = useMemo(() => readActiveWorkRoomInviteMeta(), [activeWorkRoomId]);

  // ── 과금·30일 무료체험·만료 잠금 판정 (Fail-Closed 3중 게이트) ──
  const isWorkPaidActive = Boolean(deviceEntitlement?.workPaidActive);
  const isWorkTrialActive = Boolean(deviceEntitlement?.workTrialActive);
  const isWorkTrialExpired = Boolean(deviceEntitlement?.workTrialExpired);
  const hasUsedWorkTrial = Boolean(deviceEntitlement?.workTrialOptInStartedAt);
  const isOwnWorkUnlocked = Boolean(
    isWorkPaidActive || isWorkTrialActive || deviceEntitlement?.workSubscriptionUnlocked
  );
  const isWorkUnlocked = inviteMeta.hasWorkInvite
    ? !remoteRoomLockReason
    : isOwnWorkUnlocked;

  // 계정 전환 시 이전 계정 업무방 ID·문서 잔상 즉시 초기화 (C9 계정 격리)
  useEffect(() => {
    const inv = readActiveWorkRoomInviteMeta();
    if (inv.hasWorkInvite && inv.roomId) {
      setActiveWorkRoomId(inv.roomId);
      return;
    }
    const cachedMeta = readCachedMyWorkRoomMeta(merlinAuth?.email || undefined);
    const nextRoomId = cachedMeta?.roomId || '';
    setActiveWorkRoomId(nextRoomId);
    setLocalDocs([]);
    setRemoteDocs([]);
    setDeletedTombstones(
      nextRoomId ? loadCachedWorkTombstones(nextRoomId, merlinAuth?.email || undefined) : {}
    );
  }, [merlinAuth?.email]);

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

  // PC 엔진 연결 시 예비 서버 설정 로드 및 권한 상태 동기화 (만료 시 S: 자동 해제 · 원본 파일 100% 보존)
  useEffect(() => {
    if (!isZCoreConnected || isMobileOrStore) return;
    void syncEntitlementToLocalPcEngine(deviceEntitlement || null, merlinAuth?.email || undefined);
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
  }, [isZCoreConnected, isMobileOrStore, deviceEntitlement, merlinAuth?.email]);

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
      showToast('🔒 30일 무료체험을 시작하려면 먼저 이메일 로그인을 완료해 주세요!');
      openLoginModal();
      return;
    }
    if (startingWorkTrial) return;
    setStartingWorkTrial(true);
    try {
      const res = await activateDevicePlanPersistent('work_trial_opt_in_30d');
      if (res.ok && res.entitlement) {
        setDeviceIntegrationSnapshot({ entitlement: res.entitlement });
        showToast('🎁 업무 공유(S: 드라이브) 30일 무료체험이 시작되었습니다! 소호(~5인) 직통 연결이 열렸습니다.');
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
      showToast('⚡ PC 엔진을 연결하면 퇴근 시 모니터만 끄고 S: 드라이브 직통 연결을 24시간 유지합니다.');
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
            ? '🌙 야간·퇴근 초절전 모드가 켜졌습니다. (모니터 절전 · 24시간 직결 유지)'
            : '☀️ 야간·퇴근 초절전 모드를 해제했습니다.')
      );
    }
  };

  const syncRealWorkFiles = useCallback(async () => {
    const res = await fetchLocalWorkFilesNative({
      includeSyncBase64: Boolean(activeWorkRoomId && isWorkUnlocked),
      author: actorNickname,
    });
    if (!res.ok) return;
    setSDriveMounted(res.mounted);
    if (res.targetDir) {
      setDriveTargetPath(res.targetDir);
    }

    if (res.localDeletedTombstones && Object.keys(res.localDeletedTombstones).length > 0) {
      mergeAndPersistTombstones(res.localDeletedTombstones);
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

  // PC 엔진 연결 시: 구독/체험 활성 상태일 때만 S: 마운트 + 상시 아웃바운드 HTTPS 직통 터널 기동 (만료 시 S: 자동 해제 · 원본 파일 보존)
  useEffect(() => {
    if (isMobileOrStore) return undefined;

    if (
      isZCoreConnected ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    ) {
      if (isWorkUnlocked) {
        void mountWorkSDriveNative({ action: 'mount', openExplorer: false }).then((mRes) => {
          if (mRes.ok) {
            setSDriveMounted(Boolean(mRes.mounted));
            if (mRes.targetDir) setDriveTargetPath(mRes.targetDir);
          }
          void syncRealWorkFiles();
        });
      } else {
        // 만료/미개통 상태: S: 드라이브 연결 해제하되 폴더 내 로컬 원본 목록은 그대로 열람·보존
        void mountWorkSDriveNative({ action: 'unmount', openExplorer: false }).then((mRes) => {
          setSDriveMounted(false);
          if (mRes.targetDir) setDriveTargetPath(mRes.targetDir);
          void syncRealWorkFiles();
        });
      }

      const fastLockInterval = window.setInterval(() => {
        void pollLocalLocksFast();
      }, 1000);
      const fullSyncInterval = window.setInterval(() => {
        void syncRealWorkFiles();
      }, 4000);
      const onFocusOrVisible = () => {
        if (document.visibilityState === 'visible') {
          void pollLocalLocksFast();
        }
      };
      window.addEventListener('focus', onFocusOrVisible);
      document.addEventListener('visibilitychange', onFocusOrVisible);
      return () => {
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
    isWorkUnlocked,
    activeWorkRoomId,
    syncRealWorkFiles,
    pollLocalLocksFast,
  ]);

  // 대장 PC에서 업무 공유가 해금되어 있으면 상시 아웃바운드 HTTPS 직통 터널을 자동 가동·등록 (전국 어디서나 0초 직결)
  useEffect(() => {
    if (
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
      void ensureTunnel();
    }, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
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
      roomTitle: '💼 우리팀 업무 공유방 (S:)',
      hostNickname: actorNickname,
      accountEmail: merlinAuth?.email || undefined,
    }).then((ensured) => {
      if (ensured.ok && ensured.roomId) {
        setActiveWorkRoomId(ensured.roomId);
        if (ensured.seatLimit) setRoomSeatLimit(ensured.seatLimit);
      }
    });
  }, [inviteMeta.hasWorkInvite, activeWorkRoomId, isOwnWorkUnlocked, actorNickname, merlinAuth?.email]);

  // 초대 링크(?workRoom=...&inviteToken=...)로 들어온 팀원이 로그인 완료 시 DB 정식 멤버로 자동 편입 (정원 5/20/50인 검사)
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
    void acceptWorkRoomInvite({
      inviteToken: inviteMeta.inviteToken,
      nickname: actorNickname,
    }).then((accepted) => {
      if (!accepted.ok) {
        if (accepted.reason === 'WORK_SEAT_LIMIT_EXCEEDED') {
          showToast(
            accepted.message ||
              '⚠️ 이 업무 공유방의 이용권 정원이 모두 찼습니다. 방장님께 이용권 업그레이드를 요청해 주세요.'
          );
        } else if (
          accepted.reason === 'WORK_TRIAL_EXPIRED' ||
          accepted.reason === 'WORK_SUBSCRIPTION_REQUIRED'
        ) {
          setRemoteRoomLockReason(accepted.reason);
        }
        return;
      }
      if (accepted.roomId && accepted.roomId !== activeWorkRoomId) {
        setActiveWorkRoomId(accepted.roomId);
      }
      if (accepted.role) setMyRoomRole(accepted.role);
      if (accepted.seatLimit) setRoomSeatLimit(accepted.seatLimit);
    });
  }, [
    inviteMeta.hasWorkInvite,
    inviteMeta.inviteToken,
    actorNickname,
    activeWorkRoomId,
    merlinAuth?.userId,
    showToast,
  ]);

  // 계정별 로컬 캐시 복원 + 대장 PC 직통 HTTPS 터널 상태 동기화
  useEffect(() => {
    if (activeWorkRoomId) {
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
      if (activeWorkRoomId && hasAuthenticatedHubAccountSession()) {
        const authed = await fetchWorkRoomAuthedState(activeWorkRoomId, inviteMeta.inviteToken);
        if (cancelled) return;
        if (!authed.ok) {
          if (
            authed.reason === 'WORK_TRIAL_EXPIRED' ||
            authed.reason === 'WORK_SUBSCRIPTION_REQUIRED'
          ) {
            setRemoteRoomLockReason(authed.reason);
          }
          return;
        }
        setRemoteRoomLockReason(null);
        if (authed.role) setMyRoomRole(authed.role);
        if (authed.seatLimit) setRoomSeatLimit(authed.seatLimit);
        if (Array.isArray(authed.members)) setServerMembers(authed.members);
        if (authed.hostTunnel?.masterServerName) {
          setMasterWorkPcName(authed.hostTunnel.masterServerName);
        }
        if (Array.isArray(authed.hostTunnel?.backupServers)) {
          setBackupServers(authed.hostTunnel.backupServers);
        }
        mergeAndPersistTombstones(authed.deletedTombstones);
        if (authed.docs.length > 0 || !isZCoreConnected) {
          setRemoteDocs(authed.docs);
          void cacheWorkRoomPreviewLocally(
            activeWorkRoomId,
            authed.docs,
            merlinAuth?.email || undefined
          );
        }
        setHasAuthoritativeRemoteState(true);
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
      void loadRemoteState();
    }, 12000);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [
    activeWorkRoomId,
    inviteMeta.hasWorkInvite,
    inviteMeta.inviteToken,
    isZCoreConnected,
    merlinAuth?.userId,
    merlinAuth?.email,
    mergeAndPersistTombstones,
  ]);

  // 방장 ↔ 팀원 실시간 신호·잠금·삭제 Tombstone·터널 주소 중매 채널 연결 (서버 파일 저장 0 Byte)
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
        if (!isZCoreConnected || inviteMeta.hasWorkInvite) {
          void fetchWorkFilesFromHostTunnel(ep.tunnelUrl, ep.accessKey).then((fromTunnel) => {
            if (fromTunnel.ok) {
              setRemoteDocs(fromTunnel.docs);
              mergeAndPersistTombstones(fromTunnel.deletedTombstones);
            }
          });
        }
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
    actorNickname,
    myRoomRole,
    isZCoreConnected,
    inviteMeta.hasWorkInvite,
    merlinAuth?.email,
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
            `⚡ 공유 업무 문서 ${pulled.syncedCount}건이 내 컴퓨터 [S:\\ 드라이브]로 자동 동기화되었습니다!`
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

  const teamMembers = useMemo(() => {
    if (serverMembers.length > 0) {
      return serverMembers.map((m) => {
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
            ? 'S:\\ 읽기·다운로드 전용 (초대 팀원 평생 0원)'
            : 'S:\\ 편집·업로드 허용 (초대 팀원 평생 0원)',
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
    const extraPeers = presencePeers
      .filter((p) => p.peerId !== peerIdRef.current || inviteMeta.hasWorkInvite)
      .map((p) => ({
        id: p.peerId,
        email: '',
        name: p.peerId === peerIdRef.current ? `${p.nickname} (나)` : p.nickname,
        dept: p.sDriveConnected ? '탐색기 S:\\ 실시간 연결' : '웹 미리보기 접속 중',
        role: p.role === 'host' ? ('editor' as const) : p.role,
        sDriveConnected: p.sDriveConnected,
        statusText: p.sDriveConnected
          ? 'S:\\ 실시간 동기화됨 (초대 팀원 평생 0원)'
          : '웹 미리보기 열람 중 (PC 엔진 연결 시 S:\\ 즉시 동기화)',
      }));
    return [baseHost, ...extraPeers];
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
      showToast('🔒 팀원 초대 링크를 발급하려면 먼저 이메일 로그인을 완료해 주세요!');
      openLoginModal();
      return;
    }
    if (!isWorkUnlocked) {
      showToast('🔒 30일 무료체험 시작 또는 이용권 구독 후 팀원 초대 링크를 발급할 수 있습니다.');
      activatePricingPlan('work_soho_9900');
      return;
    }
    const ensured = await ensureMyWorkRoomAndInvite({
      roomTitle: '💼 우리팀 업무 공유방 (S:)',
      hostNickname: actorNickname,
      accountEmail: merlinAuth?.email || undefined,
    });
    if (!ensured.ok || !ensured.inviteUrl || !ensured.roomId) {
      showToast(ensured.message || '⚠️ 업무방 초대 링크 발급 중 오류가 발생했습니다.');
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
      `💌 업무 공유방(S:) 초대 링크가 복사되었습니다! (정원 ${ensured.seatLimit || roomSeatLimit}인 · 팀원은 평생 0원으로 대장 PC S:\\에 직결됩니다)`
    );
  };

  const handleOpenGhostSearchWindow = async () => {
    if (!isZCoreConnected) {
      showToast('⚡ PC 엔진을 연결하면 S: 드라이브 계약서·업무 문서 본문을 열지 않고 0.1초 만에 귀신검색창으로 소환합니다!');
      openZCoreConnectModal();
      return;
    }
    const opened = await openGhostSearchForWorkSDrive(searchQuery);
    if (opened) {
      showToast('👻 S: 드라이브 문서·사진 본문이 직결된 [귀신검색창]을 화면 맨 앞에 띄웠습니다!');
    }
  };

  const handleOpenSDriveExplorer = async () => {
    if (!isWorkUnlocked) {
      showToast('🔒 업무 공유 이용 기간이 종료되어 S: 드라이브가 해제되었습니다. 구독 후 다시 연결할 수 있습니다.');
      activatePricingPlan('work_soho_9900');
      return;
    }
    if (!isZCoreConnected) {
      openZCoreConnectModal();
      return;
    }
    const res = await mountWorkSDriveNative({ action: 'mount', openExplorer: true });
    if (res.ok) {
      setSDriveMounted(Boolean(res.mounted));
      showToast('📂 윈도우 탐색기 [업무 드라이브 (S:\\)] 폴더를 열었습니다!');
    } else if (res.message) {
      showToast(res.message);
    }
  };

  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (!isWorkUnlocked) {
      showToast('🔒 30일 무료체험 시작 또는 이용권 구독 후 업무 파일을 추가할 수 있습니다.');
      activatePricingPlan('work_soho_9900');
      return;
    }
    if (myRoomRole === 'viewer') {
      showToast('👁️ 읽기 전용 팀원은 파일을 추가할 수 없습니다. 방장님께 편집 권한을 요청해 주세요.');
      return;
    }
    const hasTunnel = Boolean(getActiveHostTunnelSession()?.tunnelUrl);
    if (
      !isZCoreConnected &&
      !hasTunnel &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      showToast('⚡ 업무 파일을 S:\\ 드라이브에 넣으려면 내 컴퓨터 연결(PC 엔진) 또는 대장 PC 직통 연결이 필요합니다!');
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
      showToast(`✅ 업무 파일 ${okCount}건이 S:\\ 드라이브 및 팀원 공유 목록에 즉시 반영되었습니다!`);
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
      showToast('⚡ 예비 서버 백업은 PC 엔진이 연결된 컴퓨터에서 실행할 수 있습니다.');
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
          `🛡️ 예비 서버 폴더로 업무 파일 ${res.lastBackupSyncedCount ?? docs.length}건 이중화 백업이 완료되었습니다!`
        );
      } else {
        showToast('⚠️ 예비 서버 백업 폴더 경로를 확인해 주세요. (시스템 폴더나 S: 원본 폴더와 같은 경로는 제외)');
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

      {/* 🔒 과금·30일 무료체험 Opt-in·만료 잠금 배너 (3중 권한 게이트 — 만료 시 S: 자동 해제 & 원본 100% 보존) */}
      {!isStoreAppMode && !isWorkUnlocked && (
        <div
          data-testid="work-share-subscription-lock-banner"
          className={`p-4 sm:p-5 rounded-2xl border flex flex-col gap-3 shadow-lg ${
            isWorkTrialExpired || remoteRoomLockReason === 'WORK_TRIAL_EXPIRED'
              ? 'bg-gradient-to-r from-rose-950/90 via-zinc-950 to-amber-950/80 border-rose-400/50'
              : 'bg-gradient-to-r from-cyan-950/90 via-zinc-950 to-emerald-950/80 border-cyan-400/50'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/45 text-amber-200 text-[11px] font-extrabold w-fit">
                {isWorkTrialExpired || remoteRoomLockReason === 'WORK_TRIAL_EXPIRED'
                  ? '🔒 30일 무료체험 종료 — 대장 PC 업무 폴더 원본 100% 보존됨'
                  : '🎁 대표 1인만 구독하면 팀원은 평생 0원 · 30일 무료체험 제공'}
              </span>
              <h3 className="font-headline-sm text-[17px] sm:text-[18px] text-white font-black">
                {isWorkTrialExpired || remoteRoomLockReason === 'WORK_TRIAL_EXPIRED'
                  ? '업무 공유(S: 드라이브) 무료체험이 종료되어 탐색기 S: 연결이 해제되었습니다'
                  : '업무 공유 공용 폴더(S: 드라이브) — 30일 무료체험 또는 이용권 구독으로 시작하세요'}
              </h3>
              <p className="text-[12.5px] text-zinc-200 break-keep">
                {isWorkTrialExpired || remoteRoomLockReason === 'WORK_TRIAL_EXPIRED'
                  ? '내 PC 업무 폴더 안의 계약서·견적서·도면 원본 파일은 단 1개도 삭제되지 않고 그대로 보존되어 있습니다. 아래 이용권을 구독하시면 즉시 탐색기 S: 드라이브와 팀원 24시간 직통 연결이 다시 열립니다.'
                  : '24시간 켜두는 사내 대장 PC의 S: 드라이브에 전국 어디서나(집·현장·LTE) 방화벽 막힘 없이 0초 직결되며, 우리 서버에는 회사 파일이 1 Byte도 저장되지 않습니다(Zero-Cloud).'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {!hasUsedWorkTrial && !inviteMeta.hasWorkInvite && (
              <button
                type="button"
                disabled={startingWorkTrial}
                onClick={() => void handleStart30DayWorkTrial()}
                data-testid="start-work-30d-trial-btn"
                className="px-4 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-label-sm text-[12.5px] font-black cursor-pointer shadow-md disabled:opacity-50"
              >
                {startingWorkTrial
                  ? '⏳ 30일 무료체험 개통 중...'
                  : '🎁 0원으로 30일 먼저 무료체험 시작 (소호 ~5인)'}
              </button>
            )}
            <button
              type="button"
              onClick={() => activatePricingPlan('work_soho_9900')}
              data-testid="open-work-soho-checkout-btn"
              className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-label-sm text-[12.5px] font-black cursor-pointer shadow-md"
            >
              💳 소호(~5인) 월 9,900원 구독으로 연결
            </button>
            <button
              type="button"
              onClick={() => activatePricingPlan('work_biz_19000')}
              className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-cyan-400/45 text-cyan-200 font-label-sm text-[12px] font-extrabold cursor-pointer"
            >
              🏢 소기업(~20인) 월 19,000원
            </button>
            <button
              type="button"
              onClick={() => activatePricingPlan('work_pro_29000')}
              className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-400/45 text-amber-200 font-label-sm text-[12px] font-extrabold cursor-pointer"
            >
              🏛️ 중소기업(~50인) 월 29,000원
            </button>
          </div>
        </div>
      )}

      {/* ↩️ 삭제 직후 1초 실행 취소(Undo) 토스트 배너 (명세 8.3-2-③) */}
      {lastDeletedUndoItem && (
        <div className="p-3.5 rounded-2xl bg-amber-950/90 border border-amber-400/60 flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <span className="text-[12.5px] text-amber-100 font-bold">
            🗑️ &lsquo;{lastDeletedUndoItem.doc.fileName}&rsquo; 파일을 윈도우 [휴지통]으로 옮겼습니다.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleUndoLastDeletedFile()}
              className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[12px] font-black cursor-pointer"
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
              <span className="px-2.5 py-0.5 rounded-lg bg-cyan-400 text-zinc-950 font-label-sm text-[11px] font-extrabold">
                💼 {inviteMeta.hostNickname}님이 초대한 [{inviteMeta.roomTitle}]
              </span>
              <span className="text-[11.5px] text-emerald-300 font-bold">
                {isZCoreConnected
                  ? `✓ 내 컴퓨터 연결됨 · 윈도우 탐색기 S:\\ 실시간 동기화 가동 중${lastSyncedToLocalCount > 0 ? ` (+${lastSyncedToLocalCount}건 동기화됨)` : ''}`
                  : '👀 대장 PC 직통 연결 — 웹 미리보기 & 실시간 열람 잠금(🔒) 확인 가능'}
              </span>
            </div>
            <p className="text-[12px] text-zinc-300 break-keep">
              {isZCoreConnected
                ? '방장과 팀원이 올린 업무 파일이 내 컴퓨터 [탐색기 S:\\] 폴더로 자동 동기화되며, 바탕화면·탐색기 빈 공간에서 Ctrl+0 한 번이면 귀신검색창으로 0.1초 본문 검색이 가능합니다.'
                : '지금 바로 브라우저에서 공유 문서·표 미리보기와 누가 수정 중(🔒)인지 확인할 수 있으며, 우측 버튼으로 PC 엔진을 켜는 즉시 내 윈도우 [탐색기 S:\\]로 실제 파일이 동기화됩니다.'}
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
                className="px-3.5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-label-sm text-[12px] font-black cursor-pointer shrink-0 shadow-sm"
              >
                {isZCoreConnected
                  ? '📂 동기화된 내 탐색기 S:\\ 바로 열기'
                  : '⚡ PC 엔진 켜고 내 탐색기 S:\\로 동기화'}
              </button>
            )}
            {activeWorkRoomId && hasAuthenticatedHubAccountSession() && (
              <button
                type="button"
                onClick={async () => {
                  await removeWorkRoomMemberOnServer({ roomId: activeWorkRoomId });
                  await purgeLocalWorkRoomDocs(activeWorkRoomId, merlinAuth?.email || undefined);
                  sessionStorage.removeItem('ghosti_active_work_room_invite_v1');
                  setRemoteDocs([]);
                  setActiveWorkRoomId('');
                  showToast('🚪 초대받은 업무 공유방에서 나왔으며 내 기기의 해당 방 임시 캐시를 정리했습니다.');
                }}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-rose-400/40 text-rose-200 font-label-sm text-[11.5px] font-bold cursor-pointer shrink-0"
              >
                🚪 이 업무방 나가기
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
              💼 사무실 업무 문서·현장사진함 (S:\)
            </h2>
            {workPlan && PLAN_BADGE_LABELS[workPlan] && (
              <span className="text-[12px] text-emerald-400 font-bold">
                · ✓ {PLAN_BADGE_LABELS[workPlan]}
              </span>
            )}
            {isWorkTrialActive && !isWorkPaidActive && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-[11px] text-emerald-300 font-extrabold">
                🎁 30일 무료체험 중 (D-{deviceEntitlement?.workTrialDaysLeft ?? 30} · 정원 {roomSeatLimit}인)
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11.5px] font-bold ${
                isZCoreConnected && sDriveMounted
                  ? 'bg-emerald-500/10 border-emerald-400/25 text-emerald-300'
                  : inviteMeta.hasWorkInvite && docs.length > 0
                  ? 'bg-cyan-500/15 border-cyan-400/35 text-cyan-200'
                  : 'bg-zinc-900 border-white/15 text-zinc-300'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isZCoreConnected && sDriveMounted
                    ? 'bg-emerald-400'
                    : inviteMeta.hasWorkInvite && docs.length > 0
                    ? 'bg-cyan-400'
                    : 'bg-zinc-500'
                }`}
              />
              {isZCoreConnected
                ? `${sDriveMounted ? 'S:\\ 마운트 완료' : 'S:\\ 미연결(원본 보존)'} · 팀원 ${teamMembers.length}/${roomSeatLimit}명 · ${docs.length}건`
                : inviteMeta.hasWorkInvite
                ? `대장 PC 직통 연결됨 · ${docs.length}건`
                : '연결된 사무실 PC 없음 · 0건'}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/25 text-[11px] text-cyan-300 font-bold">
              📸 현장·증빙 사진 AI 분석 · 🛂 인물 여권 미발동(검색 제외)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isMobileOrStore && (
              <>
                <button
                  type="button"
                  onClick={() => void handleOpenGhostSearchWindow()}
                  className="px-3.5 py-1.5 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 font-label-sm text-[12px] font-black cursor-pointer flex items-center gap-1.5 shadow-sm transition-all"
                  title="독립 귀신검색창을 띄워 S: 드라이브 계약서·견적서·한글(HWP) 본문을 열지 않고 0.1초 만에 소환합니다 (바탕화면·탐색기 빈 공간 Ctrl+0 1회와 동일)"
                >
                  <span>👻 귀신검색창으로 S: 문서 1초 검색</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleOpenSDriveExplorer()}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-cyan-400/45 text-cyan-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1"
                >
                  <span>📂 탐색기 S:\ 열기</span>
                </button>
              </>
            )}

            {/* 모바일(현장 직원 폰 -> S: 1초 축지법) 및 데스크톱 모두 업무 파일 추가 허용 */}
            <button
              type="button"
              disabled={uploadingFiles}
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-100 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1 disabled:opacity-50"
            >
              <span>{uploadingFiles ? '⏳ 업로드 중...' : '📤 업무 파일 추가'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleCopyWorkInviteLink()}
              className={`px-3 py-1.5 rounded-xl border font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1 transition-all ${
                inviteCopied
                  ? 'bg-emerald-400 text-zinc-950 border-emerald-300'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-amber-400/50 text-amber-300'
              }`}
            >
              <span>{inviteCopied ? '✓ 업무방 초대 링크 복사됨!' : '💌 팀원 초대 링크 복사'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowMemberPermissions((v) => !v)}
              className="px-3 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <span>👥 팀원 권한 &amp; S: 드라이브 연결 ({teamMembers.length}/{roomSeatLimit}명)</span>
              <span>{showMemberPermissions ? '▴' : '▾'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowBackupManager((v) => !v)}
              className="px-3 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1"
            >
              <span>🛡️ 백업 PC(예비 서버 {backupServers.length}/2대)</span>
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
                    ? '🌙 야간·퇴근 초절전 가동 중 (해제)'
                    : '🌙 야간·퇴근 초절전 모드'}
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
              <span className="font-headline-sm text-[15px] text-indigo-200 font-black">
                🌙 야간·퇴근 초절전 모드가 켜졌습니다 — 편히 퇴근하세요!
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

        {/* 🛡️ 방장(대표) 전용: 대장 PC(S: 1대) & 백업 PC(예비 서버 1·2호) 이중화 관리 패널 */}
        {showBackupManager && (
          <div className="p-4 rounded-2xl bg-[#18181B] border border-emerald-400/40 flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-headline-sm text-[14.5px] text-white font-extrabold">
                  🛡️ 사내 대장 PC(S: 드라이브 1대) + 백업 PC(예비 서버 1·2호) 자동 이중화
                </span>
                <span className="text-[12px] text-zinc-300">
                  24시간 켜두는 대장 PC가 고장·점검 중일 때 즉시 이어받을 수 있도록 예비 서버(최대 2대)와 예비 백업 폴더에 S: 드라이브 원본을 안전하게 이중화합니다. (기존 구글 드라이브·네이버 MYBOX 폴더와 중첩 지정해도 충돌 없이 함께 쓸 수 있습니다)
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-400 text-zinc-950 font-label-sm text-[11px] font-extrabold">
                ✓ 삭제 시 OS 기본 [휴지통] 이동 + ↩️ 1초 실행 취소
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* 1) 사내 대장 PC (S: 드라이브 1대) */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-cyan-400/45 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-cyan-400 text-zinc-950 font-label-sm text-[10.5px] font-extrabold">
                    👑 사내 대장 PC (메인 서버 1대)
                  </span>
                  <span className="text-[11px] text-cyan-300 font-mono font-bold">
                    {hostTunnelStatus === 'connected' ? '24시간 직통 가동 중' : 'S:\\ 마운트 서버'}
                  </span>
                </div>
                <div className="font-headline-sm text-[14px] text-white font-bold">
                  {masterWorkPcName}
                </div>
                <p className="text-[11px] text-zinc-400">
                  업무 폴더: <code className="text-zinc-200">{driveTargetPath}</code>
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const nextName = masterWorkPcName.includes('사내 대장')
                        ? '사무실 메인 업무 서버 (S:)'
                        : '사내 대장 PC (S: 드라이브)';
                      void handleSaveBackupServerConfig(nextName, backupServers);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-cyan-300 text-[11px] font-bold cursor-pointer"
                  >
                    🔄 대장 PC 표시 이름 변경
                  </button>
                </div>
              </div>

              {/* 2) 백업 PC (예비 서버 1·2호) */}
              <div className="lg:col-span-2 p-3.5 rounded-xl bg-zinc-950 border border-white/10 flex flex-col justify-between gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-label-sm text-[12px] text-emerald-300 font-extrabold">
                    🛡️ 백업 PC (예비 서버 {backupServers.length}/2대 지정됨)
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {lastBackupSyncedAt
                      ? `최근 예비 서버 백업: ${lastBackupSyncedCount}건 완료`
                      : '대장 PC 고장·도난 대비 S: 드라이브 전체를 예비 서버에 똑같이 유지합니다'}
                  </span>
                </div>

                {backupServers.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {backupServers.map((node, idx) => (
                      <div
                        key={node.id}
                        className="p-2.5 rounded-lg bg-zinc-900 border border-emerald-400/30 flex items-center justify-between gap-2"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-[12px] text-white font-bold truncate">
                            🖥️ 예비 서버 {idx + 1}호 · {node.label}
                          </span>
                          <span className="text-[10.5px] text-emerald-300 font-bold">
                            {node.status}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = backupServers.filter((item) => item.id !== node.id);
                            void handleSaveBackupServerConfig(masterWorkPcName, next);
                          }}
                          className="px-2 py-1 rounded bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[10.5px] font-bold shrink-0 cursor-pointer"
                        >
                          해제
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
                  <input
                    type="text"
                    value={newBackupServerName}
                    onChange={(e) => setNewBackupServerName(e.target.value)}
                    placeholder="예비 서버 PC 이름 (예: 김이사 서브PC)"
                    className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-white text-[11.5px]"
                  />
                  <input
                    type="text"
                    value={localBackupDir}
                    onChange={(e) => setLocalBackupDir(e.target.value)}
                    placeholder="예비 서버 백업 폴더 경로 (비워두면 기본 안전 폴더)"
                    className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-white text-[11.5px] font-mono"
                  />
                  <button
                    type="button"
                    disabled={backupServers.length >= 2}
                    onClick={() => {
                      if (backupServers.length >= 2) return;
                      const label =
                        newBackupServerName.trim() || `예비 서버 ${backupServers.length + 1}호 PC`;
                      const next: WorkBackupServerNodeDto[] = [
                        ...backupServers,
                        {
                          id: `backup-${Date.now()}`,
                          slot: backupServers.length + 1,
                          label,
                          role: `예비 서버 ${backupServers.length + 1}호`,
                          status: '✓ 대기·자동 이중화 가동 중',
                        },
                      ];
                      setNewBackupServerName('');
                      void handleSaveBackupServerConfig(masterWorkPcName, next, localBackupDir);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer shrink-0 disabled:opacity-40"
                  >
                    + 예비 서버 등록
                  </button>
                  {!isMobileOrStore && (
                    <button
                      type="button"
                      disabled={syncingBackupNow}
                      onClick={() => void handleRunBackupSyncNow()}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-emerald-400/45 text-emerald-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {syncingBackupNow ? '⏳ 이중화 백업 중...' : '⚡ 지금 예비 서버로 백업 실행'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 👥 팀원 권한 & S: 드라이브 연결 설정 화면 (DB 실저장 연동) */}
        {showMemberPermissions && (
          <div className="p-4 rounded-2xl bg-[#18181B] border border-cyan-400/45 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-headline-sm text-[14.5px] text-white font-extrabold">
                  👥 [팀원 권한 &amp; S: 드라이브 연결] 멤버별 권한 관리 ({teamMembers.length}/{roomSeatLimit}명)
                </span>
                <span className="text-[12px] text-zinc-300">
                  📢 <strong className="text-emerald-300">방장 1명만 구독하면 초대받은 팀원은 평생 0원(무료)</strong>으로 대장 PC S: 드라이브에 직결되며, 엑셀·한글·도면 열람 시 누가 사용 중인지 전 직원 화면에 1초 만에 표시됩니다.
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-cyan-400 text-zinc-950 font-label-sm text-[11px] font-extrabold">
                정원 {teamMembers.length} / {roomSeatLimit}인
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="p-3 rounded-xl bg-zinc-950 border border-white/10 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] text-white font-extrabold truncate">
                        {member.role === 'host' ? '👑 ' : '👤 '}
                        {member.name}
                      </span>
                      <span className="text-[11px] text-zinc-400 truncate">{member.dept}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 text-[10.5px] font-extrabold shrink-0">
                      {member.role === 'host'
                        ? isStoreAppMode
                          ? '방장 (마스터 호스트)'
                          : '방장 (구독 호스트)'
                        : isStoreAppMode
                        ? '연결된 팀원'
                        : '팀원 0원 (평생 무료)'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-white/10">
                    <span className="text-[10.5px] text-cyan-300 font-bold truncate min-w-0">
                      🔗 {member.statusText}
                    </span>
                    {member.role === 'host' ? (
                      <span className="px-2 py-1 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-200 text-[10.5px] font-extrabold shrink-0">
                        👑 전체 관리
                      </span>
                    ) : myRoomRole === 'host' && member.email ? (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={member.role}
                          onChange={async (e) => {
                            const nextRole = e.target.value as 'editor' | 'viewer';
                            setServerMembers((prev) =>
                              prev.map((sm) =>
                                sm.email === member.email ? { ...sm, role: nextRole } : sm
                              )
                            );
                            const ok = await updateWorkRoomMemberRoleOnServer({
                              roomId: activeWorkRoomId,
                              memberEmail: member.email,
                              role: nextRole,
                            });
                            showToast(
                              ok
                                ? `✓ ${member.name}님의 권한을 [${
                                    nextRole === 'viewer' ? '읽기·다운로드 전용' : '편집·업로드 허용'
                                  }]으로 저장했습니다.`
                                : '⚠️ 권한 변경 저장에 실패했습니다.'
                            );
                          }}
                          className="px-2 py-1 rounded-lg bg-zinc-900 border border-cyan-400/40 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                        >
                          <option value="editor">✏️ 편집·업로드 허용</option>
                          <option value="viewer">👁️ 읽기·다운로드 전용</option>
                        </select>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await removeWorkRoomMemberOnServer({
                              roomId: activeWorkRoomId,
                              memberEmail: member.email,
                            });
                            if (ok) {
                              setServerMembers((prev) =>
                                prev.filter((sm) => sm.email !== member.email)
                              );
                              showToast(`🚪 ${member.name}님을 업무 공유방에서 내보냈습니다.`);
                            }
                          }}
                          className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/40 text-rose-200 text-[10.5px] font-bold cursor-pointer"
                        >
                          강퇴
                        </button>
                      </div>
                    ) : (
                      <span className="px-2 py-1 rounded-lg bg-zinc-900 border border-white/10 text-zinc-300 text-[10.5px] font-bold shrink-0">
                        {member.role === 'viewer' ? '👁️ 읽기 전용' : '✏️ 편집·업로드'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
                    ? 'bg-[#2DD4BF] text-zinc-950 shadow-xs'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                🔍 본문·표 내용 검색 ({docs.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('explorer')}
                className={`px-3 py-1.5 rounded-lg font-label-sm text-[12px] font-extrabold cursor-pointer transition-all ${
                  viewMode === 'explorer'
                    ? 'bg-[#2DD4BF] text-zinc-950 shadow-xs'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                🗂️ 폴더별 보기 (S:\)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#18181B] border border-white/15 focus-within:border-primary-container rounded-2xl px-4 py-2.5 shadow-sm transition-colors">
            <span className="text-zinc-400 text-sm">🔍</span>
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
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {WORK_LOUNGE_FOLDERS.map((folder) => {
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
                        ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                        : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-white/10 font-bold'
                    }`}
                  >
                    <span>
                      {folder.id === 'all'
                        ? '💽 S:\\ 전체'
                        : folder.id === 'root'
                        ? '📄 S:\\ 루트'
                        : `📁 ${folder.name}`}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        highlight ? 'bg-black/15 text-zinc-950 font-black' : 'text-zinc-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

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

      {/* 2. 문서 리스트 + 우측 Side Peek 프리뷰 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <div className={`${isSidePeekOpen ? 'xl:col-span-7' : 'xl:col-span-12'} flex flex-col transition-all`}>
          <div className="rounded-2xl bg-white dark:bg-[#18181B] border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-zinc-950/70 border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-1.5 text-[11.5px] text-slate-600 dark:text-zinc-400 font-bold">
              <span className="break-keep">
                {viewMode === 'explorer' ? '🗂️ 폴더별 보기' : '🔍 본문·표 내용 검색'} ({filteredDocs.length}건) · 항목을 클릭하면{' '}
                <span className="xl:hidden">아래에 상세 표·미리보기가 열립니다</span>
                <span className="hidden xl:inline">우측에 상세 표·미리보기가 열립니다</span>
              </span>
              {isSidePeekOpen && (
                <button
                  type="button"
                  onClick={() => setIsSidePeekOpen(false)}
                  className="text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white text-[11px] font-bold shrink-0 cursor-pointer"
                >
                  <span className="xl:hidden">미리보기 닫기 ✕</span>
                  <span className="hidden xl:inline">우측 미리보기 닫기 ✕</span>
                </button>
              )}
            </div>

            {filteredDocs.length === 0 ? (
              <div className="px-4 py-10 text-center flex flex-col items-center gap-2.5">
                <span className="text-[28px]">📂</span>
                <p className="font-headline-sm text-[14px] text-slate-700 dark:text-zinc-200 font-bold break-keep">
                  아직 연결된 공용 업무 문서가 없습니다 (0건)
                </p>
                <p className="font-body-sm text-[12px] text-slate-500 dark:text-zinc-400 break-keep max-w-lg">
                  사내 대장 PC의 공용 폴더(S: 드라이브)에 실제 업무 문서·현장 사진을 넣거나 위 [📤 업무 파일 추가]로 올리면 실시간 표시되며, [👻 귀신검색창]에서 열지 않고 0.1초 만에 본문을 소환할 수 있습니다.
                </p>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                  {isZCoreConnected ? (
                    <>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3.5 py-2 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 font-label-sm text-[12px] font-black cursor-pointer"
                      >
                        📤 S:\ 드라이브에 첫 업무 파일 올리기
                      </button>
                      {!isMobileOrStore && (
                        <button
                          type="button"
                          onClick={() => void handleOpenSDriveExplorer()}
                          className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[12px] font-bold cursor-pointer"
                        >
                          📂 윈도우 탐색기 S:\ 폴더 열기
                        </button>
                      )}
                    </>
                  ) : !isMobileOrStore ? (
                    <button
                      type="button"
                      onClick={openZCoreConnectModal}
                      className="px-4 py-2 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 font-label-sm text-[12px] font-black cursor-pointer"
                    >
                      ⚡ PC 엔진 연결하고 S:\ 드라이브 바로 만들기
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 font-label-sm text-[12px] font-black cursor-pointer"
                    >
                      📤 현장 사진·업무 파일 올리기
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-white/8">
                {filteredDocs.map((doc) => {
                  const isSelected = isSidePeekOpen && selectedDoc && doc.id === selectedDoc.id;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => {
                        if (isSelected) {
                          setIsSidePeekOpen(false);
                        } else {
                          setSelectedDocId(doc.id);
                          setIsSidePeekOpen(true);
                        }
                      }}
                      className={`px-4 py-3 flex flex-col gap-1.5 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-teal-50/80 dark:bg-cyan-950/35'
                          : 'hover:bg-slate-50 dark:hover:bg-zinc-900/70'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span
                            className={`px-2 py-0.5 rounded font-label-sm text-[10px] font-extrabold shrink-0 ${
                              doc.ext === 'XLSX' || doc.ext === 'XLS' || doc.ext === 'CSV'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                : doc.ext === 'DOCX' ||
                                  doc.ext === 'DOC' ||
                                  doc.ext === 'HWP' ||
                                  doc.ext === 'HWPX' ||
                                  doc.ext === 'TXT'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-400/40'
                                : doc.ext === 'PDF'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                            }`}
                          >
                            {doc.ext}
                          </span>
                          <span className="font-label-md text-[13.5px] text-slate-900 dark:text-white font-bold truncate">
                            {doc.fileName}
                          </span>
                          <span className="hidden md:inline text-[11.5px] text-slate-500 dark:text-zinc-400 truncate">
                            · {doc.summaryTitle.replace(/\[.*?\]\s*/g, '')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="hidden sm:inline text-[11px] text-slate-500 dark:text-zinc-400">
                            {doc.folderPath} · {doc.sizeLabel} · {doc.updatedAt}
                          </span>
                          {doc.lockedBy ? (
                            <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/60 text-amber-200 font-label-sm text-[10.5px] font-extrabold">
                              🔒 현재 {doc.lockedBy}님이 사용 중
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 font-label-sm text-[10.5px] font-bold">
                              🔓 수정 가능
                            </span>
                          )}
                        </div>
                      </div>

                      {searchQuery.trim() && (
                        <div className="pl-11 text-[12px] text-cyan-200 truncate">
                          📌 {doc.matchedSnippet}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 우측 Side Peek 패널 */}
        {isSidePeekOpen && selectedDoc && (
          <div className="xl:col-span-5 p-4 md:p-5 rounded-2xl bg-[#18181B] border border-cyan-400/40 shadow-xl flex flex-col gap-3.5 xl:sticky xl:top-16">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/10">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-400 text-zinc-950 font-label-sm text-[11px] font-extrabold shrink-0">
                  📄 문서 내용 미리보기
                </span>
                <span className="text-[11px] text-zinc-400 font-bold">
                  {selectedDoc.author} · {selectedDoc.updatedAt}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSidePeekOpen(false)}
                className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[11.5px] font-bold shrink-0 cursor-pointer"
              >
                ✕ 닫기
              </button>
            </div>

            <div className="flex flex-col gap-1 min-w-0">
              <span className="font-label-sm text-[11px] text-cyan-300 font-bold break-all">
                {selectedDoc.folderPath}\{selectedDoc.fileName}
              </span>
              <h3 className="font-headline-sm text-[16px] text-white font-extrabold leading-snug">
                {selectedDoc.summaryTitle.replace(/\[.*?\]\s*/g, '')}
              </h3>
            </div>

            {selectedDoc.lockedBy ? (
              <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-400/50 flex flex-col gap-2.5">
                <div className="flex flex-col gap-0.5">
                  <span className="font-label-sm text-[12.5px] text-amber-200 font-extrabold">
                    🔒 현재 [{selectedDoc.lockedBy}]님이 사용 중입니다. 읽기 모드로 열립니다.
                  </span>
                  <span className="font-body-sm text-[11px] text-zinc-300">
                    다른 팀원이 편집 중일 때는 덮어쓰기 충돌 방지를 위해 읽기 모드로 안전하게 열립니다.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void downloadWorkFileOriginal(selectedDoc, {
                      roomId: activeWorkRoomId,
                      inviteToken: inviteMeta.inviteToken,
                    })
                  }
                  className="w-full py-1.5 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer text-center"
                >
                  👁️ 읽기 모드로 열기
                </button>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-between gap-2">
                <span className="font-label-sm text-[11.5px] text-emerald-300 font-bold">
                  🔓 현재 사용 중인 팀원이 없습니다 — 바로 편집 가능
                </span>
              </div>
            )}

            {selectedDoc.isImage && selectedDoc.imageBase64 && (
              <div className="p-3 rounded-xl bg-zinc-950 border border-cyan-400/30 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-[11.5px] text-cyan-300 font-extrabold">
                    🖼️ 이미지 원본 실시간 미리보기
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {selectedDoc.ext} · {selectedDoc.sizeLabel}
                  </span>
                </div>
                <div className="w-full flex items-center justify-center p-2 rounded-lg bg-black/40 border border-white/5 overflow-hidden">
                  <img
                    src={selectedDoc.imageBase64}
                    alt={selectedDoc.fileName}
                    className="max-h-64 object-contain rounded"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="font-label-sm text-[11.5px] text-zinc-300 font-extrabold">
                📊 표 핵심 내용
              </span>
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-zinc-950">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-900 border-b border-white/10">
                      {selectedDoc.tableHeaders.map((h, hIdx) => (
                        <th
                          key={`${h}-${hIdx}`}
                          className="px-2.5 py-2 font-label-sm text-[11px] text-cyan-300 font-extrabold whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {selectedDoc.tableRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/50">
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="px-2.5 py-1.5 font-body-sm text-[11.5px] text-zinc-200"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950 border border-white/10 flex flex-col gap-1 max-h-56 overflow-y-auto">
              <span className="font-label-sm text-[11px] text-emerald-300 font-extrabold">
                📄 본문 주요 내용
              </span>
              <p className="font-body-sm text-[12px] text-zinc-200 whitespace-pre-line leading-relaxed">
                {selectedDoc.fullTextPreview}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={async () => {
                  const ok = await downloadWorkFileOriginal(selectedDoc, {
                    roomId: activeWorkRoomId,
                    inviteToken: inviteMeta.inviteToken,
                  });
                  setDocActionNotice(
                    ok
                      ? `⬇️ '${selectedDoc.fileName}' 원본 파일(${selectedDoc.sizeLabel}) 다운로드가 시작되었습니다!`
                      : `⚠️ 원본 파일을 받으려면 대장 PC 연결 상태이거나 내 컴퓨터 연결(PC 엔진)이 필요합니다.`
                  );
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1"
              >
                <span>⬇️ 원본 파일 다운로드</span>
              </button>

              {myRoomRole !== 'viewer' && (
                <button
                  type="button"
                  onClick={async () => {
                    const targetDoc = selectedDoc;
                    const targetRel = targetDoc.relPath;
                    const targetName = targetDoc.fileName;
                    const nowIso = new Date().toISOString();
                    inFlightDeletesRef.current.add(targetRel);
                    try {
                      mergeAndPersistTombstones({
                        [targetRel.toLowerCase()]: {
                          relPath: targetRel,
                          deletedAt: nowIso,
                          deletedBy: actorNickname,
                        },
                      });
                      const nextRemote = remoteDocsRef.current.filter((d) => d.relPath !== targetRel);
                      const nextLocal = localDocsRef.current.filter((d) => d.relPath !== targetRel);
                      localDocsRef.current = nextLocal;
                      setRemoteDocs(nextRemote);
                      setLocalDocs(nextLocal);
                      setLastDeletedUndoItem({ doc: targetDoc, deletedAt: nowIso });
                      if (activeWorkRoomId) {
                        void cacheWorkRoomPreviewLocally(
                          activeWorkRoomId,
                          nextRemote,
                          merlinAuth?.email || undefined
                        );
                      }
                      realtimeRef.current?.broadcastFileDeleted(targetRel, nowIso);
                      const delRes = await deleteWorkFileShared({
                        roomId:
                          activeWorkRoomId ||
                          readCachedMyWorkRoomMeta(merlinAuth?.email || undefined)?.roomId ||
                          '',
                        relPath: targetRel,
                        actorNickname,
                        deletedAt: nowIso,
                      });
                      if (delRes.deletedTombstones) {
                        mergeAndPersistTombstones(delRes.deletedTombstones);
                      }
                      if (!delRes.ok) {
                        showToast(
                          delRes.message ||
                            `⚠️ '${targetName}' 파일을 휴지통으로 옮기지 못해 그대로 보존했습니다.`
                        );
                      } else {
                        showToast(
                          `🗑️ '${targetName}' 파일이 윈도우 [휴지통]으로 안전하게 이동되었습니다. (상단 [↩️ 1초 실행 취소]로 즉시 복원 가능)`
                        );
                      }
                    } finally {
                      inFlightDeletesRef.current.delete(targetRel);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/50 text-rose-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1"
                >
                  <span>🗑️ 휴지통으로 이동</span>
                </button>
              )}
            </div>

            {docActionNotice && (
              <div className="p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-400/50 text-emerald-200 font-body-sm text-[11.5px] font-bold flex items-center justify-between gap-2">
                <span>{docActionNotice}</span>
                <button
                  type="button"
                  onClick={() => setDocActionNotice(null)}
                  className="text-[11px] text-emerald-300 hover:text-white font-extrabold px-2 py-0.5 rounded bg-emerald-900/60 shrink-0"
                >
                  닫기
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="font-body-sm text-[11px] text-zinc-400">
                파일 크기: {selectedDoc.sizeLabel} · 위치: {selectedDoc.folderPath} · 올린 사람: {selectedDoc.author}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {!isStoreAppMode && !isWorkPaidActive && (
                  <>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('work_soho_9900')}
                      className="px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
                    >
                      💼 소호(~5인) 월 9,900원 구독
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[11.5px] font-bold cursor-pointer"
                    >
                      요금제 안내 보기
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
