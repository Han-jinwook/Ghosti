import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { verifyHybridP2PBridgeConnection } from '../../services/p2pHybridBridge';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { isMobileOrStoreRuntime } from '../../store/slices/storeSharedRefs';
import { hasAuthenticatedHubAccountSession } from '../../services/supabaseClient';
import { zCoreBridge } from '../../services/zCoreBridge';
import {
  acceptWorkRoomInvite,
  cacheWorkRoomPreviewLocally,
  connectWorkRoomRealtimeChannel,
  deleteWorkFileShared,
  downloadWorkFileOriginal,
  ensureMyWorkRoomAndInvite,
  fetchLocalWorkFilesNative,
  fetchLocalWorkLocksFast,
  fetchWorkRoomAuthedState,
  fetchWorkRoomCloudPreview,
  loadCachedWorkRoomPreview,
  loadCachedWorkTombstones,
  mountWorkSDriveNative,
  openGhostSearchForWorkSDrive,
  pullSyncRemoteWorkFilesToLocalSDrive,
  readActiveWorkRoomInviteMeta,
  readCachedMyWorkRoomMeta,
  sanitizeWorkLockOwner,
  saveCachedWorkTombstones,
  toggleHideWorkFileNative,
  uploadWorkFileToNativeSDrive,
  upsertWorkFilesToSupabase,
  type WorkDeletedTombstoneMap,
  type WorkLoungeDocDto,
  type WorkRoomPresenceMember,
} from '../../services/workRoomSyncService';
import { HostThreeBodyControlPanel, PLAN_BADGE_LABELS } from '../shared/loungeHelpers';

const WORK_LOUNGE_FOLDERS = [
  { id: 'all', name: 'S:\\ (업무 드라이브 전체)', count: 0, path: 'S:\\' },
  { id: 'root', name: 'S:\\ 루트 (최상단 파일)', count: 0, path: 'S:\\' },
  { id: 'contracts', name: '01_계약서_법무문서', count: 0, path: 'S:\\01_계약서_법무문서' },
  { id: 'quotes', name: '02_견적서_단가표_엑셀', count: 0, path: 'S:\\02_견적서_단가표_엑셀' },
  { id: 'tax', name: '03_세금계산서_회계증빙', count: 0, path: 'S:\\03_세금계산서_회계증빙' },
  { id: 'site', name: '04_현장시공_도면_미디어', count: 0, path: 'S:\\04_현장시공_도면_미디어' },
];

export const WorkLoungeB2BHub: React.FC = () => {
  const {
    layout,
    isStoreAppMode,
    setShowProModal,
    activatePricingPlan,
    subscribedLounges,
    faceClusters,
    merlinAuth,
    showToast,
  } = useSaySeeStore();
  const isMobileOrStore = layout === 'mobile' || Boolean(isStoreAppMode) || isMobileOrStoreRuntime();

  const [isZCoreConnected, setIsZCoreConnected] = useState<boolean>(zCoreBridge.isConnected);
  const [sDriveMounted, setSDriveMounted] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'semantic' | 'explorer'>('semantic');
  const [driveTargetPath, setDriveTargetPath] = useState('S:\\ (내 PC 업무공유폴더_S)');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [localDocs, setLocalDocs] = useState<WorkLoungeDocDto[]>([]);
  const [remoteDocs, setRemoteDocs] = useState<WorkLoungeDocDto[]>([]);
  const [remoteLocksByRelPath, setRemoteLocksByRelPath] = useState<Record<string, string | null>>({});
  const [simulatedLocksByDocId, setSimulatedLocksByDocId] = useState<Record<string, string | null>>({});
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [isSidePeekOpen, setIsSidePeekOpen] = useState<boolean>(false);
  const [showBackupManager, setShowBackupManager] = useState<boolean>(false);
  const [masterWorkPcName, setMasterWorkPcName] = useState<string>('사무실 메인 공용 PC (S: 드라이브)');
  const [backupPcNodes, setBackupPcNodes] = useState<
    Array<{ id: string; name: string; mirrorPath: string; status: string; active: boolean }>
  >([]);
  const [newBackupPcName, setNewBackupPcName] = useState<string>('');
  const [newBackupPcPath, setNewBackupPcPath] = useState<string>('D:\\Ghosti_추가백업_폴더');
  const [nightSleepBannerPhase, setNightSleepBannerPhase] = useState<'hidden' | 'visible' | 'fading'>('hidden');
  const [showMemberPermissions, setShowMemberPermissions] = useState<boolean>(() => !isMobileOrStoreRuntime());
  const [hiddenDocIds, setHiddenDocIds] = useState<string[]>([]);
  const [activeWorkRoomId, setActiveWorkRoomId] = useState<string>(() => {
    const inv = readActiveWorkRoomInviteMeta();
    if (inv.hasWorkInvite && inv.roomId) return inv.roomId;
    return readCachedMyWorkRoomMeta()?.roomId || '';
  });
  const [deletedTombstones, setDeletedTombstones] = useState<WorkDeletedTombstoneMap>(() => {
    const inv = readActiveWorkRoomInviteMeta();
    const initRoom =
      (inv.hasWorkInvite && inv.roomId ? inv.roomId : readCachedMyWorkRoomMeta()?.roomId) || '';
    return initRoom ? loadCachedWorkTombstones(initRoom) : {};
  });
  const [hasAuthoritativeRemoteState, setHasAuthoritativeRemoteState] = useState<boolean>(false);
  const [docActionNotice, setDocActionNotice] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState<boolean>(false);
  const [uploadingFiles, setUploadingFiles] = useState<boolean>(false);
  const [lastSyncedToLocalCount, setLastSyncedToLocalCount] = useState<number>(0);
  const [presencePeers, setPresencePeers] = useState<WorkRoomPresenceMember[]>([]);

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

  const mergeAndPersistTombstones = useCallback(
    (patch: WorkDeletedTombstoneMap, clearRelPaths?: string[]) => {
      setDeletedTombstones((prev) => {
        const next: WorkDeletedTombstoneMap = { ...prev, ...patch };
        if (clearRelPaths && clearRelPaths.length > 0) {
          for (const rp of clearRelPaths) {
            delete next[rp];
          }
        }
        deletedTombstonesRef.current = next;
        if (activeWorkRoomId) {
          saveCachedWorkTombstones(activeWorkRoomId, next);
        }
        return next;
      });
    },
    [activeWorkRoomId]
  );

  useEffect(() => {
    if (!activeWorkRoomId) return;
    setHasAuthoritativeRemoteState(false);
    const cachedTombs = loadCachedWorkTombstones(activeWorkRoomId);
    if (Object.keys(cachedTombs).length > 0) {
      setDeletedTombstones((prev) => {
        const merged = { ...cachedTombs, ...prev };
        deletedTombstonesRef.current = merged;
        return merged;
      });
    }
  }, [activeWorkRoomId]);

  const inviteMeta = useMemo(() => readActiveWorkRoomInviteMeta(), [activeWorkRoomId]);
  const actorNickname = useMemo(() => {
    if (typeof window !== 'undefined') {
      const savedNick = (localStorage.getItem('ghosti_hub_user_nickname') || '').trim();
      if (savedNick) return savedNick;
    }
    if (merlinAuth?.email) return merlinAuth.email.split('@')[0];
    return inviteMeta.hasWorkInvite ? '초대 팀원' : '방장(나)';
  }, [merlinAuth?.email, inviteMeta.hasWorkInvite]);

  const peerIdRef = useRef<string>(
    `peer_${Math.random().toString(36).slice(2, 10)}`
  );

  const [roleOverrides, setRoleOverrides] = useState<Record<string, 'editor' | 'viewer'>>({});

  useEffect(() => {
    setIsZCoreConnected(zCoreBridge.isConnected);
    const unsub = zCoreBridge.subscribe((conn) => setIsZCoreConnected(conn));
    void zCoreBridge.checkHealth();
    return () => {
      unsub();
    };
  }, []);

  const triggerNightSleepMode = () => {
    setNightSleepBannerPhase('visible');
    window.setTimeout(() => {
      setNightSleepBannerPhase('fading');
    }, 1800);
    window.setTimeout(() => {
      setNightSleepBannerPhase('hidden');
    }, 3800);
  };

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

  const syncRealWorkFiles = useCallback(async () => {
    const res = await fetchLocalWorkFilesNative({
      includeSyncBase64: Boolean(activeWorkRoomId),
      author: actorNickname,
    });
    if (!res.ok) return;
    setSDriveMounted(res.mounted);
    if (res.targetDir) {
      setDriveTargetPath(res.targetDir);
    }

    // 로컬 Z-코어 영구 삭제 원장(localDeletedTombstones) 즉시 병합
    if (res.localDeletedTombstones && Object.keys(res.localDeletedTombstones).length > 0) {
      mergeAndPersistTombstones(res.localDeletedTombstones);
    }

    // 현재 삭제 진행 중인 파일(inFlightDeletesRef)은 목록/업로드에서 즉시 제외
    const activeLocalDocs = res.docs.filter((d) => !inFlightDeletesRef.current.has(d.relPath));
    localDocsRef.current = activeLocalDocs;
    setLocalDocs(activeLocalDocs);

    // 로컬 PC에서 파일 잠금이 해제되었을 때 remoteDocs의 옛 잠금 잔상을 즉시 제거 (15초 지연 해소)
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

    // 윈도우 탐색기 S:\에서 직접 삭제된 파일 감지 -> 전 팀원 공유방 Tombstone 전파 (부활 원천 차단)
    if (res.locallyDeletedRelPaths.length > 0) {
      const nowIso = new Date().toISOString();
      const delPatch: WorkDeletedTombstoneMap = {};
      for (const rel of res.locallyDeletedRelPaths) {
        delPatch[rel] = { deletedAt: nowIso, deletedBy: actorNickname };
      }
      mergeAndPersistTombstones(delPatch);
      const nextRemoteFiltered = remoteDocsRef.current.filter(
        (rd) => !res.locallyDeletedRelPaths.includes(rd.relPath)
      );
      setRemoteDocs(nextRemoteFiltered);
      if (activeWorkRoomId) {
        void cacheWorkRoomPreviewLocally(activeWorkRoomId, nextRemoteFiltered);
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
      const tomb = deletedTombstonesRef.current[d.relPath];
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
        prevCloudUpsertSigRef.current = cloudSig;
        realtimeRef.current?.broadcastSnapshot(uploadableDocs);
        void cacheWorkRoomPreviewLocally(activeWorkRoomId, uploadableDocs);
        void upsertWorkFilesToSupabase({
          roomId: activeWorkRoomId,
          docs: uploadableDocs,
          actorNickname,
        }).then((upRes) => {
          if (upRes.deletedTombstones) {
            mergeAndPersistTombstones(upRes.deletedTombstones);
          }
          if (upRes.uploadedLargeBlob) {
            realtimeRef.current?.broadcastSnapshot(
              uploadableDocs.map((d) => ({
                ...d,
                hasCloudBlob: Boolean(d.hasCloudBlob || d.byteSize > 512 * 1024),
              }))
            );
          }
        });
      }
    }
  }, [activeWorkRoomId, actorNickname, mergeAndPersistTombstones]);

  // [초경량 1초 잠금 폴링]: 탐색기에서 엑셀·한셀·한글 파일을 열거나 닫을 때 1초 이내로 [🔒 사용 중] ↔ [🔓 수정 가능] 즉시 반영
  const pollLocalLocksFast = useCallback(async () => {
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

    // 탐색기에서 파일이 추가/삭제되어 총 개수가 바뀐 경우 즉시 풀 동기화 실행
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
      // 로컬 잠금 해제 시 remoteDocs 옛 잠금 잔상도 0.01초 만에 즉시 제거
      setRemoteDocs((prev) =>
        prev.map((rd) => {
          const nextLock = fast.locks[rd.relPath] ?? null;
          return rd.lockedBy !== nextLock && localDocsRef.current.some((l) => l.relPath === rd.relPath)
            ? { ...rd, lockedBy: nextLock }
            : rd;
        })
      );
      realtimeRef.current?.broadcastLocks(fast.locks);
      // 서버 매니페스트에도 잠금 상태 즉시 반영
      if (activeWorkRoomId && updatedLocal.length > 0 && inFlightDeletesRef.current.size === 0) {
        prevCloudUpsertSigRef.current = updatedLocal
          .map((d) => `${d.relPath}:${d.sha256}:${d.lockedBy || ''}`)
          .join('|');
        void upsertWorkFilesToSupabase({
          roomId: activeWorkRoomId,
          docs: updatedLocal,
          actorNickname,
        });
      }
    }
  }, [activeWorkRoomId, actorNickname, syncRealWorkFiles]);

  // Z-코어 연결 시 S: 드라이브 무인 마운트 + 1초 초경량 잠금(~$) 감시 + 4초 전체 동기화 + 창 포커스 즉시 갱신
  useEffect(() => {
    void verifyHybridP2PBridgeConnection({
      roomId: activeWorkRoomId || 'lounge-work-b2b',
      simulateSymmetricNatBlock: false,
    });

    if (isMobileOrStore) return undefined;

    if (isZCoreConnected || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      void mountWorkSDriveNative({ action: 'mount', openExplorer: false }).then((mRes) => {
        if (mRes.ok) {
          setSDriveMounted(Boolean(mRes.mounted));
          if (mRes.targetDir) setDriveTargetPath(mRes.targetDir);
        }
        void syncRealWorkFiles();
      });

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
  }, [isZCoreConnected, isMobileOrStore, activeWorkRoomId, syncRealWorkFiles, pollLocalLocksFast]);

  // 로그인한 방장이 업무방 진입 시 내 고유 업무방 ID 자동 확보
  useEffect(() => {
    if (inviteMeta.hasWorkInvite || activeWorkRoomId || !hasAuthenticatedHubAccountSession()) return;
    void ensureMyWorkRoomAndInvite({
      roomTitle: '💼 우리팀 업무 공유방 (S:)',
      hostNickname: actorNickname,
    }).then((ensured) => {
      if (ensured.ok && ensured.roomId) {
        setActiveWorkRoomId(ensured.roomId);
      }
    });
  }, [inviteMeta.hasWorkInvite, activeWorkRoomId, actorNickname]);

  // 초대 링크(?workRoom=...&token=...)로 들어온 팀원이 로그인 완료 시 DB 정식 멤버(ghosti_lounge_members)로 자동 편입
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
      if (accepted.ok && accepted.roomId && accepted.roomId !== activeWorkRoomId) {
        setActiveWorkRoomId(accepted.roomId);
      }
    });
  }, [inviteMeta.hasWorkInvite, inviteMeta.inviteToken, actorNickname, activeWorkRoomId, merlinAuth?.userId]);

  // 로컬 즉시 캐시 복원 + 방장 PC 절전/퇴근 시에도 작동하는 24시간 공유방 상태·미리보기 로드
  useEffect(() => {
    if (activeWorkRoomId) {
      const knownTombs = loadCachedWorkTombstones(activeWorkRoomId);
      void loadCachedWorkRoomPreview(activeWorkRoomId).then((cachedDocs) => {
        const filteredCached = cachedDocs.filter((d) => !knownTombs[d.relPath]);
        if (filteredCached.length > 0) {
          setRemoteDocs((prev) => (prev.length > 0 ? prev : filteredCached));
        }
      });
    }

    let cancelled = false;
    const loadRemoteState = async () => {
      if (activeWorkRoomId && hasAuthenticatedHubAccountSession()) {
        const authed = await fetchWorkRoomAuthedState(activeWorkRoomId, inviteMeta.inviteToken);
        if (!cancelled && authed.ok) {
          mergeAndPersistTombstones(authed.deletedTombstones);
          // 마지막 1개 파일 삭제 시에도 빈 목록([])을 정확히 반영하고 로컬 캐시를 갱신!
          setRemoteDocs(authed.docs);
          void cacheWorkRoomPreviewLocally(activeWorkRoomId, authed.docs);
          setHasAuthoritativeRemoteState(true);
          return;
        }
      }
      if (inviteMeta.hasWorkInvite && inviteMeta.inviteToken) {
        const pub = await fetchWorkRoomCloudPreview(inviteMeta.inviteToken);
        if (!cancelled && pub.ok) {
          mergeAndPersistTombstones(pub.deletedTombstones);
          setRemoteDocs(pub.docs);
          if (activeWorkRoomId) {
            void cacheWorkRoomPreviewLocally(activeWorkRoomId, pub.docs);
          }
          setHasAuthoritativeRemoteState(true);
        }
      }
    };

    void loadRemoteState();
    const pollId = window.setInterval(() => {
      void loadRemoteState();
    }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [activeWorkRoomId, inviteMeta.hasWorkInvite, inviteMeta.inviteToken, merlinAuth?.userId, mergeAndPersistTombstones]);

  // 방장 ↔ 팀원 실시간 파일·잠금(~$)·삭제 Tombstone 동기화 채널 연결
  useEffect(() => {
    if (!activeWorkRoomId) return undefined;
    const handle = connectWorkRoomRealtimeChannel({
      roomId: activeWorkRoomId,
      peerId: peerIdRef.current,
      nickname: actorNickname,
      role: inviteMeta.hasWorkInvite ? 'editor' : 'host',
      getLocalDocs: () => localDocsRef.current,
      onRemoteSnapshot: (incomingDocs) => {
        const curTombs = deletedTombstonesRef.current;
        const cleaned = incomingDocs.filter((d) => {
          if (inFlightDeletesRef.current.has(d.relPath)) return false;
          const tomb = curTombs[d.relPath];
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
        mergeAndPersistTombstones({ [relPath]: { deletedAt } });
        const nextRemote = remoteDocsRef.current.filter((d) => d.relPath !== relPath);
        setRemoteDocs(nextRemote);
        if (activeWorkRoomId) {
          void cacheWorkRoomPreviewLocally(activeWorkRoomId, nextRemote);
        }
        setLocalDocs((prev) => prev.filter((d) => d.relPath !== relPath));
        if (zCoreBridge.isConnected) {
          void deleteWorkFileShared({ relPath, deletedAt });
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
    });
    realtimeRef.current = handle;
    return () => {
      handle.dispose();
      realtimeRef.current = null;
    };
  }, [activeWorkRoomId, actorNickname, inviteMeta.hasWorkInvite, mergeAndPersistTombstones]);

  // 팀원 PC에서 Z-코어가 켜지는 즉시 원격 공유 업무파일(50MB 대용량 포함) 및 삭제 Tombstone을 내 S:\ 탐색기로 자동 동기화
  // [재부활 원천 차단]: 서버 정식 상태(hasAuthoritativeRemoteState) 수신 전에는 로컬 구 캐시로 S:\에 파일을 복원하지 않습니다!
  useEffect(() => {
    if (
      !isZCoreConnected ||
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
          showToast(`⚡ 공유 업무 문서 ${pulled.syncedCount}건이 내 컴퓨터 [S:\\ 드라이브]로 자동 동기화되었습니다!`);
        }
        void syncRealWorkFiles();
      }
    });
  }, [
    isZCoreConnected,
    hasAuthoritativeRemoteState,
    remoteDocs,
    deletedTombstones,
    activeWorkRoomId,
    inviteMeta.inviteToken,
    showToast,
    syncRealWorkFiles,
  ]);

  // 로컬 S:\ 파일 + 원격(?workRoom) 파일 통합 및 삭제 Tombstone · 실시간 잠금(~$) 상태 병합
  const docs = useMemo<WorkLoungeDocDto[]>(() => {
    const byRel = new Map<string, WorkLoungeDocDto>();
    for (const rd of remoteDocs) {
      if (inFlightDeletesRef.current.has(rd.relPath)) continue;
      const tomb = deletedTombstones[rd.relPath];
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
      const tomb = deletedTombstones[ld.relPath];
      if (tomb?.deletedAt) {
        const delTs = Date.parse(tomb.deletedAt) || 0;
        const locTs = Date.parse(ld.fileMtimeIso) || 0;
        if (delTs > 0 && locTs <= delTs + 5000) continue;
      }
      const prev = byRel.get(ld.relPath);
      const localOwner = sanitizeWorkLockOwner(ld.lockedBy, ld.author || actorNickname);
      const peerOwner = sanitizeWorkLockOwner(remoteLocksByRelPath[ld.relPath], '팀원');
      // [15초 잠금 잔류 근본 해결]: 내 PC에 실존하는 파일(ld)이 로컬에서 잠금 해제(null)되었다면
      // 서버 매니페스트의 낡은 이전 잠금(prev?.lockedBy)을 절대 되살리지 않고 실시간 잠금만 반영!
      byRel.set(ld.relPath, {
        ...ld,
        author: ld.author || prev?.author || actorNickname,
        hasCloudBlob: Boolean(ld.hasCloudBlob || prev?.hasCloudBlob),
        lockedBy: localOwner || peerOwner || null,
      });
    }
    return Array.from(byRel.values()).map((d) => ({
      ...d,
      lockedBy:
        simulatedLocksByDocId[d.id] !== undefined
          ? simulatedLocksByDocId[d.id]
          : sanitizeWorkLockOwner(d.lockedBy || remoteLocksByRelPath[d.relPath], d.author || '팀원'),
    }));
  }, [localDocs, remoteDocs, deletedTombstones, remoteLocksByRelPath, simulatedLocksByDocId, actorNickname]);

  const folderCounts = useMemo(() => {
    const visible = docs.filter((d) => !hiddenDocIds.includes(d.id));
    const counts: Record<string, number> = {
      all: visible.length,
      root: 0,
      contracts: 0,
      quotes: 0,
      tax: 0,
      site: 0,
    };
    for (const d of visible) {
      if (counts[d.folderId] !== undefined) {
        counts[d.folderId] += 1;
      }
    }
    return counts;
  }, [docs, hiddenDocIds]);

  const teamMembers = useMemo(() => {
    const baseHost = {
      id: 'm-self',
      name: inviteMeta.hasWorkInvite
        ? `${inviteMeta.hostNickname} (방장)`
        : `${actorNickname} (방장)`,
      dept: inviteMeta.hasWorkInvite ? '공유 업무방 마스터' : '마스터 PC 관리자',
      role: 'host' as const,
      sDriveConnected: inviteMeta.hasWorkInvite ? true : isZCoreConnected,
      statusText:
        !inviteMeta.hasWorkInvite && !isZCoreConnected
          ? 'PC 엔진(Z코어) 연결 시 S:\\ 드라이브가 자동 마운트됩니다'
          : 'S:\\ 마스터 연결됨 (방장 1인 결제 · 전체 관리)',
    };
    const extraPeers = presencePeers
      .filter((p) => p.peerId !== peerIdRef.current || inviteMeta.hasWorkInvite)
      .map((p) => {
        const assignedRole = roleOverrides[p.peerId] || (p.role === 'host' ? 'editor' : p.role);
        return {
          id: p.peerId,
          name: p.peerId === peerIdRef.current ? `${p.nickname} (나)` : p.nickname,
          dept: p.sDriveConnected ? '탐색기 S:\\ 실시간 연결' : '웹 미리보기 접속 중',
          role: assignedRole,
          sDriveConnected: p.sDriveConnected,
          statusText: p.sDriveConnected
            ? assignedRole === 'editor'
              ? 'S:\\ 실시간 동기화됨 (초대 팀원 평생 0원)'
              : 'S:\\ 읽기 전용 연결됨 (초대 팀원 평생 0원)'
            : '웹 미리보기 열람 중 (Z코어 연결 시 S:\\ 즉시 동기화)',
        };
      });
    return [baseHost, ...extraPeers];
  }, [inviteMeta, actorNickname, isZCoreConnected, presencePeers, roleOverrides]);

  const workPlan = subscribedLounges.work;

  // 업무 공유(work)에서는 귀신같이 인물 여권(얼굴 클러스터링·인물 별명)이 발동하지 않으며 검색 대상에서도 제외됨
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
      if (hiddenDocIds.includes(doc.id)) return false;
      const folderMatch =
        viewMode === 'semantic'
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
  }, [docs, hiddenDocIds, viewMode, selectedFolderId, searchQuery, passportPersonTokens]);

  const selectedDoc =
    filteredDocs.find((d) => d.id === selectedDocId) || filteredDocs[0] || docs[0];

  const handleToggleLockSimulation = (docId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSimulatedLocksByDocId((prev) => {
      const cur = prev[docId];
      return {
        ...prev,
        [docId]: cur ? null : `${actorNickname}(나)`,
      };
    });
  };

  const handleCopyWorkInviteLink = async () => {
    if (!hasAuthenticatedHubAccountSession()) {
      showToast('🔒 팀원 초대 링크를 발급하려면 먼저 이메일 로그인(10초 인증)을 완료해 주세요!');
      openLoginModal();
      return;
    }
    const ensured = await ensureMyWorkRoomAndInvite({
      roomTitle: '💼 우리팀 업무 공유방 (S:)',
      hostNickname: actorNickname,
    });
    if (!ensured.ok || !ensured.inviteUrl || !ensured.roomId) {
      showToast('⚠️ 업무방 초대 링크 발급 중 일시적 오류가 발생했습니다. 다시 눌러주세요.');
      return;
    }
    setActiveWorkRoomId(ensured.roomId);
    if (localDocsRef.current.length > 0) {
      realtimeRef.current?.broadcastSnapshot(localDocsRef.current);
      void cacheWorkRoomPreviewLocally(ensured.roomId, localDocsRef.current);
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
      '💌 업무 공유방(S:) 초대 링크가 복사되었습니다! 팀원이 클릭하면 엔진 설치 전에는 웹 미리보기가 즉시 보이고, Z코어 연결 즉시 S:\\ 탐색기로 동기화됩니다.'
    );
  };

  const handleOpenGhostSearchWindow = async () => {
    if (!isZCoreConnected) {
      showToast('⚡ PC 엔진(Z코어)을 연결하면 S: 드라이브 계약서·단가표 본문을 열지 않고 0.1초 만에 귀신검색창으로 소환합니다!');
      openZCoreConnectModal();
      return;
    }
    const opened = await openGhostSearchForWorkSDrive(searchQuery);
    if (opened) {
      showToast('👻 S: 드라이브 문서·사진 본문이 직결된 [귀신검색창]을 화면 맨 앞에 띄웠습니다!');
    }
  };

  const handleOpenSDriveExplorer = async () => {
    if (!isZCoreConnected) {
      openZCoreConnectModal();
      return;
    }
    const res = await mountWorkSDriveNative({ action: 'mount', openExplorer: true });
    if (res.ok) {
      setSDriveMounted(Boolean(res.mounted));
      showToast('📂 윈도우 탐색기 [업무 드라이브 (S:\\)] 폴더를 열었습니다!');
    }
  };

  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (!isZCoreConnected && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      showToast('⚡ 업무 원본 파일을 S:\\ 드라이브에 넣으려면 먼저 PC 엔진(Z코어)을 연결해 주세요!');
      openZCoreConnectModal();
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
      await syncRealWorkFiles();
    }
  };

  const QUICK_WORK_QUERIES = [
    '철거 단가 4,850,000원',
    '지체상금 0.15%',
    '한빛테크 미수금',
    '성수목공 비교견적',
    '에스프레소 30A 단독 회로',
    '분전반 시공완료 현장사진',
  ];

  return (
    <section
      onDragOver={(e) => {
        if (!isMobileOrStore) e.preventDefault();
      }}
      onDrop={(e) => {
        if (isMobileOrStore) return;
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

      {/* 초대 링크(?workRoom=...) 진입 시: 엔진 설치 전 웹 미리보기 & 엔진 설치 즉시 S:\ 동기화 안내 배너 */}
      {inviteMeta.hasWorkInvite && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/85 via-zinc-950 to-emerald-950/75 border border-cyan-400/50 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg bg-cyan-400 text-zinc-950 font-label-sm text-[11px] font-extrabold">
                💼 {inviteMeta.hostNickname}님이 초대한 [{inviteMeta.roomTitle}]
              </span>
              <span className="text-[11.5px] text-emerald-300 font-bold">
                {isZCoreConnected
                  ? `✓ 내 PC 엔진(Z코어) 연결됨 · 윈도우 탐색기 S:\\ 실시간 동기화 가동 중${lastSyncedToLocalCount > 0 ? ` (+${lastSyncedToLocalCount}건 동기화됨)` : ''}`
                  : '👀 PC 엔진 설치 전 — 웹 미리보기 & 실시간 열람 잠금(🔒) 확인 가능'}
              </span>
            </div>
            <p className="text-[12px] text-zinc-300 break-keep">
              {isZCoreConnected
                ? '방장과 팀원이 올린 업무 파일이 내 컴퓨터 [탐색기 S:\\] 폴더로 자동 동기화되며, 바탕화면·탐색기 빈 공간에서 Ctrl+0 한 번이면 귀신검색창으로 0.1초 본문 검색이 가능합니다.'
                : '지금 바로 브라우저에서 공유 문서·표 미리보기와 누가 수정 중(🔒)인지 확인할 수 있으며, 우측 버튼으로 PC 엔진(Z코어)을 켜는 즉시 내 윈도우 [탐색기 S:\\]로 실제 파일이 동기화됩니다.'}
            </p>
          </div>
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
                : '⚡ PC 엔진(Z코어) 켜고 내 탐색기 S:\\로 동기화'}
            </button>
          )}
        </div>
      )}

      {/* 1. 노션형 보더리스(Borderless) 업무 도화지 헤더 + 귀신검색창 직결 + 검색창 + 폴더 필터 칩 */}
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-headline-sm text-[20px] md:text-[22px] text-slate-900 dark:text-white font-extrabold tracking-tight">
              💼 사무실 업무 문서·현장사진함 (S:\)
            </h2>
            {workPlan && (
              <span className="text-[12px] text-emerald-400 font-bold">
                · ✓ {PLAN_BADGE_LABELS[workPlan]}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11.5px] font-bold ${
                isZCoreConnected
                  ? 'bg-emerald-500/10 border-emerald-400/25 text-emerald-300'
                  : inviteMeta.hasWorkInvite && docs.length > 0
                  ? 'bg-cyan-500/15 border-cyan-400/35 text-cyan-200'
                  : 'bg-zinc-900 border-white/15 text-zinc-300'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isZCoreConnected
                    ? 'bg-emerald-400'
                    : inviteMeta.hasWorkInvite && docs.length > 0
                    ? 'bg-cyan-400'
                    : 'bg-zinc-500'
                }`}
              />
              {isZCoreConnected
                ? `${sDriveMounted ? 'S:\\ 마운트 완료' : '사무실 PC 연결됨'} · 팀원 ${teamMembers.length}명 · ${docs.length}건`
                : inviteMeta.hasWorkInvite
                ? `웹 미리보기 연결됨 · ${docs.length}건`
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
                  title="탐색기로 찾지 말고 독립 귀신검색창을 띄워 S: 드라이브 계약서·단가표·한글(HWP) 본문을 열지 않고 0.1초 만에 소환합니다 (바탕화면·탐색기 빈 공간 Ctrl+0 1회와 동일)"
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
                <button
                  type="button"
                  disabled={uploadingFiles}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-100 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  <span>{uploadingFiles ? '⏳ 업로드 중...' : '📤 업무 파일 추가'}</span>
                </button>
              </>
            )}

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
              <span>👥 팀원 권한 &amp; S: 드라이브 연결 설정 ({teamMembers.length}명)</span>
              <span>{showMemberPermissions ? '▴' : '▾'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowBackupManager((v) => !v)}
              className="px-3 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1"
            >
              <span>🛡️ 공용 S: PC 1대 + 백업 PC ({backupPcNodes.filter((b) => b.active).length}대 가동 중)</span>
              <span>{showBackupManager ? '▴' : '▾'}</span>
            </button>
            {!isMobileOrStore && (
              <>
                <button
                  type="button"
                  onClick={triggerNightSleepMode}
                  className="px-3 py-1 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/45 text-indigo-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1"
                  title="바탕화면 단축아이콘과 동일: 퇴근·취침 시 모니터 즉시 OFF + 15W 초절전 대기 + 메모리 유휴 캐시 정리"
                >
                  <span>🌙 퇴근·야간 15W 초절전 모드</span>
                </button>
                <span className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-amber-400/30 text-[11px] text-amber-200 font-bold">
                  🛡️ 마스터 PC 기본 [휴지통] 직행 + 백업 PC 1·2호 랜섬웨어 서킷 브레이커
                </span>
              </>
            )}
          </div>
        </div>

        {/* ⚡ 호스트(방장) PC 전용: 사무실 연결 PC 삼체(Three-Body) 실시간 관제 목록 & 마스터/개별 ON·OFF 제어 */}
        {!isMobileOrStore && (
          <div className="hidden md:block">
            <HostThreeBodyControlPanel contextMode="work" />
          </div>
        )}

        {/* 🌙 퇴근·취침 시 실행되는 야간 초절전 모드 페이드아웃 안내 메시지 */}
        {nightSleepBannerPhase !== 'hidden' && (
          <div
            className={`p-4 rounded-2xl bg-gradient-to-r from-indigo-950/95 via-zinc-950/95 to-slate-950/95 border border-indigo-400/60 shadow-2xl flex flex-wrap items-center justify-between gap-3 transition-opacity duration-[1800ms] ${
              nightSleepBannerPhase === 'fading' ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <div className="flex flex-col gap-1">
              <span className="font-headline-sm text-[15px] text-indigo-200 font-black">
                🌙 Ghosti 초절전·무소음 야간모드가 가동되었습니다 — 편히 퇴근·취침하세요!
              </span>
              <span className="text-[12px] text-zinc-300">
                ✓ 램(RAM) 유휴 캐시 정리 완료 · ✓ CPU 15W 초저전력 대기 전환(한 달 전기요금 약 1,800원) ·{' '}
                <strong className="text-amber-300">
                  이 안내 메시지는 서서히 사라진 뒤 모니터 전원이 꺼집니다...
                </strong>
              </span>
            </div>
            <span className="px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-300/50 text-indigo-100 font-mono text-[11px] font-bold">
              화면 페이드아웃 중...
            </span>
          </div>
        )}

        {/* 🛡️ 방장(대표) 전용: 공용 업무 PC(S: 1대) 지정 & 다중 백업 PC 실시간 원본 미러링 관리 패널 */}
        {showBackupManager && (
          <div className="p-4 rounded-2xl bg-[#18181B] border border-emerald-400/40 flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-headline-sm text-[14.5px] text-white font-extrabold">
                  🛡️ 클라우드 불신 제로! 공용 업무 PC(S: 드라이브 1대) + 백업 PC 1·2호 실시간 미러링 &amp; 랜섬웨어 서킷 브레이커
                </span>
                <span className="text-[12px] text-zinc-300">
                  구글 드라이브·네이버 MYBOX 동기화 폴더 위에 그대로 중첩 지정해도 충돌 없는{' '}
                  <code className="text-emerald-300">%LOCALAPPDATA%\Merlin\</code> 외부 격리(Zero-Footprint) 구조이며, 1분 내 30개 이상 대량 삭제·미끼 파일 변조 감지 시{' '}
                  <strong>백업 PC 1·2호 미러링을 0.01초 만에 즉시 차단</strong>해 랜섬웨어를 완벽 방어합니다.
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-400 text-zinc-950 font-label-sm text-[11px] font-extrabold">
                ✓ 마스터 PC 기본 [휴지통] 직행 + ↩️ 1초 실행 취소
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* 1) 공용 업무 PC (S: 드라이브 1대) */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-cyan-400/45 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-cyan-400 text-zinc-950 font-label-sm text-[10.5px] font-extrabold">
                    👑 메인 공용 업무 PC (1대)
                  </span>
                  <span className="text-[11px] text-cyan-300 font-mono font-bold">S:\ 마운트 마스터</span>
                </div>
                <div className="font-headline-sm text-[14px] text-white font-bold">
                  {masterWorkPcName}
                </div>
                <p className="text-[11px] text-zinc-400">
                  원본 경로: <code className="text-zinc-200">{driveTargetPath}</code> (전 직원 탐색기 S: 드라이브 직결)
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setMasterWorkPcName((prev) =>
                        prev.includes('사무실')
                          ? '메인 워크스테이션 (S: 드라이브)'
                          : '사무실 메인 공용 PC (S: 드라이브)'
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-cyan-300 text-[11px] font-bold cursor-pointer"
                  >
                    🔄 공용 업무 PC 변경 지정
                  </button>
                </div>
              </div>

              {/* 2) 다중 백업 PC 목록 (여러 대 마음대로 지정) */}
              <div className="lg:col-span-2 p-3.5 rounded-xl bg-zinc-950 border border-white/10 flex flex-col justify-between gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-label-sm text-[12px] text-emerald-300 font-extrabold">
                    💾 실시간 원본 백업 PC 목록 ({backupPcNodes.length}대 지정됨 · 대수 제한 없음)
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    각 백업 PC의 별도 지정 폴더에 S: 드라이브 원본이 1:1 실시간 복제됩니다
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {backupPcNodes.map((node) => (
                    <div
                      key={node.id}
                      className="p-2.5 rounded-lg bg-zinc-900 border border-emerald-400/30 flex items-center justify-between gap-2"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-[12px] text-white font-bold truncate">
                          🖥️ {node.name}
                        </span>
                        <span className="text-[10.5px] text-zinc-400 font-mono truncate">
                          백업 경로: {node.mirrorPath}
                        </span>
                        <span className="text-[10.5px] text-emerald-300 font-bold">
                          {node.status}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setBackupPcNodes((prev) => prev.filter((item) => item.id !== node.id))
                        }
                        className="px-2 py-1 rounded bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[10.5px] font-bold shrink-0 cursor-pointer"
                      >
                        해제
                      </button>
                    </div>
                  ))}
                </div>

                {/* 새 백업 PC 추가 지정 폼 */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
                  <input
                    type="text"
                    value={newBackupPcName}
                    onChange={(e) => setNewBackupPcName(e.target.value)}
                    placeholder="추가할 백업 PC 이름 (예: 김이사 노트북)"
                    className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-white text-[11.5px]"
                  />
                  <input
                    type="text"
                    value={newBackupPcPath}
                    onChange={(e) => setNewBackupPcPath(e.target.value)}
                    placeholder="백업 저장 폴더 경로 (예: D:\Ghosti_원본백업)"
                    className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-white text-[11.5px] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const name = newBackupPcName.trim() || `추가 백업 PC ${backupPcNodes.length + 1}호`;
                      const path = newBackupPcPath.trim() || 'D:\\Ghosti_추가백업_폴더';
                      setBackupPcNodes((prev) => [
                        ...prev,
                        {
                          id: `backup-${Date.now()}`,
                          name,
                          mirrorPath: path,
                          status: '✓ 원본 100% 실시간 동기화됨',
                          active: true,
                        },
                      ]);
                      setNewBackupPcName('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer shrink-0"
                  >
                    + 백업 PC 추가 지정
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 👥 팀원 권한 & S: 드라이브 연결 설정 화면 */}
        {showMemberPermissions && (
          <div className="p-4 rounded-2xl bg-[#18181B] border border-cyan-400/45 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-headline-sm text-[14.5px] text-white font-extrabold">
                  👥 [팀원 권한 &amp; S: 드라이브 연결] 멤버별 권한 설정 화면
                </span>
                <span className="text-[12px] text-zinc-300">
                  {isStoreAppMode ? (
                    <>
                      📢 <strong className="text-emerald-300">방장이 연결한 사무실 공용 폴더(S: 드라이브)</strong>에 초대받은 팀원은 별도 설정 없이 바로 연결되며, 멤버별로 편집·읽기 전용·숨기기 권한을 즉시 변경할 수 있습니다.
                    </>
                  ) : (
                    <>
                      📢 <strong className="text-emerald-300">방장 1명만 구독하면 초대받은 팀원은 평생 0원(무료)</strong>으로 윈도우 S: 드라이브에 직결되며, 엑셀·한글 열람 시 <code className="text-amber-300">~$</code> 잠금이 전 직원 화면에 실시간 표시됩니다.
                    </>
                  )}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-cyan-400 text-zinc-950 font-label-sm text-[11px] font-extrabold">
                {isZCoreConnected
                  ? `✓ 팀원 ${teamMembers.length}명 S:\\ 연결됨`
                  : '연결된 사무실 PC 대기 중'}
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
                      🔗{' '}
                      {isStoreAppMode && member.role === 'host'
                        ? 'S:\\ 마스터 연결됨 (전체 관리 권한)'
                        : member.statusText}
                    </span>
                    {member.role === 'host' ? (
                      <span className="px-2 py-1 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-200 text-[10.5px] font-extrabold shrink-0">
                        👑 전체 관리·숨기기
                      </span>
                    ) : (
                      <select
                        value={member.role}
                        onChange={(e) => {
                          const nextRole = e.target.value as 'editor' | 'viewer';
                          setRoleOverrides((prev) => ({ ...prev, [member.id]: nextRole }));
                        }}
                        className="px-2 py-1 rounded-lg bg-zinc-900 border border-cyan-400/40 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                      >
                        <option value="editor">✏️ 편집·업로드 허용</option>
                        <option value="viewer">👁️ 읽기·다운로드 전용</option>
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 노션형 깔끔한 검색창 + 귀신검색창 연동 안내 + 폴더 필터 알약 */}
        <div className="flex flex-col gap-2">
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
                  ? '계약서 조항, 단가표 숫자, 시공 사진 검색'
                  : '계약서 조항, 엑셀 단가표 숫자, 한글(HWP), 현장 시공 사진 검색... (인물 여권 제외 · 바탕화면/S: 탐색기 빈 곳 Ctrl+0 1회로도 즉시 검색)'
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
                const isAllActive = folder.id === 'all' && (selectedFolderId === 'all' || viewMode === 'semantic');
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
                        ? '💽 전체'
                        : folder.id === 'root'
                        ? '📄 S:\\ 최상단'
                        : `📁 ${folder.name.replace(/^\d+_/, '')}`}
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

            {docs.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-slate-500 dark:text-zinc-400">
                <span>빠른 검색:</span>
                {QUICK_WORK_QUERIES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      const nextQ = searchQuery === q ? '' : q;
                      setSearchQuery(nextQ);
                      if (nextQ) {
                        setViewMode('semantic');
                        const tokens = nextQ.toLowerCase().split(/\s+/).filter(Boolean);
                        const matched = docs.find((d) => {
                          const text = [
                            d.fileName,
                            d.summaryTitle,
                            d.matchedSnippet,
                            d.fullTextPreview,
                            ...d.tableRows.flat(),
                          ]
                            .join(' ')
                            .toLowerCase();
                          return tokens.every((t) => text.includes(t));
                        });
                        if (matched) {
                          setSelectedDocId(matched.id);
                          setIsSidePeekOpen(true);
                        }
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

      {/* 2. 노션 데이터베이스형 깔끔한 리스트 + 파일 클릭 시 우측에서 열리는 Side Peek 프리뷰 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <div className={`${isSidePeekOpen ? 'xl:col-span-7' : 'xl:col-span-12'} flex flex-col transition-all`}>
          <div className="rounded-2xl bg-white dark:bg-[#18181B] border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-zinc-950/70 border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-1.5 text-[11.5px] text-slate-600 dark:text-zinc-400 font-bold">
              <span className="break-keep">
                문서 및 미디어 ({filteredDocs.length}건) · 항목을 클릭하면{' '}
                <span className="xl:hidden">아래에 상세 표·미리보기가 열립니다</span>
                <span className="hidden xl:inline">우측에 상세 표·미리보기가 열립니다</span>
              </span>
              <div className="flex items-center gap-2">
                {hiddenDocIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setHiddenDocIds([])}
                    className="text-amber-500 hover:text-amber-400 text-[11px] font-bold cursor-pointer"
                  >
                    👁️ 숨긴 파일 {hiddenDocIds.length}건 다시 표시
                  </button>
                )}
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
            </div>

            {filteredDocs.length === 0 ? (
              <div className="px-4 py-10 text-center flex flex-col items-center gap-2.5">
                <span className="text-[28px]">📂</span>
                <p className="font-headline-sm text-[14px] text-slate-700 dark:text-zinc-200 font-bold break-keep">
                  아직 연결된 공용 업무 문서가 없습니다 (0건)
                </p>
                <p className="font-body-sm text-[12px] text-slate-500 dark:text-zinc-400 break-keep max-w-lg">
                  사무실 메인 PC에서 공용 폴더(S: 드라이브)에 실제 업무 문서·현장 사진을 넣거나 위 [📤 업무 파일 추가]로 올리면 실시간 표시되며, [👻 귀신검색창]에서 열지 않고 0.1초 만에 본문을 소환할 수 있습니다.
                </p>
                {!isMobileOrStore && (
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
                        <button
                          type="button"
                          onClick={() => void handleOpenSDriveExplorer()}
                          className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[12px] font-bold cursor-pointer"
                        >
                          📂 윈도우 탐색기 S:\ 폴더 열기
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={openZCoreConnectModal}
                        className="px-4 py-2 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 font-label-sm text-[12px] font-black cursor-pointer"
                      >
                        ⚡ PC 엔진(Z코어) 연결하고 S:\ 드라이브 바로 만들기
                      </button>
                    )}
                  </div>
                )}
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
                                : doc.ext === 'DOCX' || doc.ext === 'DOC' || doc.ext === 'HWP' || doc.ext === 'HWPX' || doc.ext === 'TXT'
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
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-label-sm text-[12.5px] text-amber-200 font-extrabold">
                      🔒 현재 [{selectedDoc.lockedBy}]님이 사용 중입니다. 읽기 모드로 열립니다.
                    </span>
                    <span className="font-body-sm text-[11px] text-zinc-300">
                      (윈도우 탐색기 S: 드라이브에서 엑셀·한글 파일이 열려 있으면 ~$ 잠금을 실시간 감지하여 중복 덮어쓰기를 자동 방지합니다.)
                    </span>
                  </div>
                  {simulatedLocksByDocId[selectedDoc.id] && (
                    <button
                      type="button"
                      onClick={() => handleToggleLockSimulation(selectedDoc.id)}
                      className="px-2 py-1 rounded-lg bg-zinc-950/80 hover:bg-zinc-900 border border-white/15 text-zinc-400 hover:text-white font-label-sm text-[10.5px] font-bold shrink-0 cursor-pointer"
                    >
                      시뮬레이션 해제
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                    👁️ 읽기 전용 사본 다운로드
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-between gap-2">
                <span className="font-label-sm text-[11.5px] text-emerald-300 font-bold">
                  🔓 현재 사용 중인 팀원이 없습니다 — 바로 편집 가능
                </span>
                <button
                  type="button"
                  onClick={() => handleToggleLockSimulation(selectedDoc.id)}
                  className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-900 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11px] font-bold shrink-0 cursor-pointer"
                >
                  잠금 시뮬레이션
                </button>
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
                      : `⚠️ 원본 파일을 받으려면 방장 PC 연결 상태이거나 PC 엔진(Z코어) 동기화가 필요합니다.`
                  );
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1"
              >
                <span>⬇️ 원본 파일 다운로드</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const isCurrentlyHidden = hiddenDocIds.includes(selectedDoc.id);
                  setHiddenDocIds((prev) =>
                    isCurrentlyHidden
                      ? prev.filter((id) => id !== selectedDoc.id)
                      : [...prev, selectedDoc.id]
                  );
                  void toggleHideWorkFileNative(selectedDoc.relPath);
                  setDocActionNotice(
                    isCurrentlyHidden
                      ? `👁️ '${selectedDoc.fileName}' 파일의 숨김을 해제하여 공유 목록에 다시 표시합니다.`
                      : `🙈 [실수 삭제 방지] '${selectedDoc.fileName}' 파일을 공유방 목록에서 안전하게 숨겼습니다. (S: 드라이브 원본은 삭제되지 않고 보존됩니다)`
                  );
                }}
                className={`px-3 py-1.5 rounded-xl border font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1 ${
                  hiddenDocIds.includes(selectedDoc.id)
                    ? 'bg-amber-400 text-zinc-950 border-amber-300'
                    : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/50 text-amber-200'
                }`}
              >
                <span>
                  {hiddenDocIds.includes(selectedDoc.id)
                    ? '👁️ 숨김 해제'
                    : '🙈 숨기기 (실수 삭제 방지)'}
                </span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetRel = selectedDoc.relPath;
                  const targetName = selectedDoc.fileName;
                  const nowIso = new Date().toISOString();
                  inFlightDeletesRef.current.add(targetRel);
                  try {
                    mergeAndPersistTombstones({
                      [targetRel]: { deletedAt: nowIso, deletedBy: actorNickname },
                    });
                    const nextRemote = remoteDocsRef.current.filter((d) => d.relPath !== targetRel);
                    const nextLocal = localDocsRef.current.filter((d) => d.relPath !== targetRel);
                    localDocsRef.current = nextLocal;
                    setRemoteDocs(nextRemote);
                    setLocalDocs(nextLocal);
                    if (activeWorkRoomId) {
                      void cacheWorkRoomPreviewLocally(activeWorkRoomId, nextRemote);
                    }
                    realtimeRef.current?.broadcastFileDeleted(targetRel, nowIso);
                    const delRes = await deleteWorkFileShared({
                      roomId: activeWorkRoomId || readCachedMyWorkRoomMeta()?.roomId || '',
                      relPath: targetRel,
                      actorNickname,
                      deletedAt: nowIso,
                    });
                    if (delRes.deletedTombstones) {
                      mergeAndPersistTombstones(delRes.deletedTombstones);
                    }
                    if (!delRes.ok) {
                      showToast(
                        `⚠️ '${targetName}' 파일은 내 PC [휴지통]으로 이동했지만 서버 공유방 반영에 실패했습니다. 잠시 후 다시 확인해 주세요.`
                      );
                    } else {
                      showToast(
                        `🗑️ '${targetName}' 파일이 윈도우 [휴지통]으로 안전하게 이동되었으며 새로고침해도 다시 살아나지 않습니다.`
                      );
                    }
                  } finally {
                    inFlightDeletesRef.current.delete(targetRel);
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/50 text-rose-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1"
              >
                <span>🗑️ 공유방에서 삭제 (휴지통)</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setDocActionNotice(
                    `🗂️ [본인 업로드 파일 관리] '${selectedDoc.fileName}' (업로더: ${selectedDoc.author}) — 업로더 본인 및 방장만 버전 변경·숨기기가 가능하여 팀원의 실수 삭제를 원천 방지합니다.`
                  )
                }
                className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-400/50 text-purple-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1"
              >
                <span>🗂️ 본인 업로드 파일 관리</span>
              </button>
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
                파일 크기: {selectedDoc.sizeLabel} · 위치: {selectedDoc.folderPath}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {!isStoreAppMode && !workPlan && (
                  <>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('work_soho_9900')}
                      className="px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
                    >
                      💼 소호(~5인) 월 9,900원 개통
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
