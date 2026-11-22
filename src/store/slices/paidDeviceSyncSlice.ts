import type { StateCreator } from 'zustand';
import { getZCoreUrl, zCoreBridge, ensureLoginAndZCoreReady } from '../../services/zCoreBridge';
import { submitExternalMonsterChatQuery } from '../../services/monsterChatRouter';
import {
  isMobileVoiceEnvironment,
  speakSetupMonsterTts,
  stopSetupMonsterTts,
  triggerSetupMonsterTtsPrewarm,
} from '../../services/setupMonsterTts';
import { analyzeMobilePickedPhotoFiles } from '../../services/mobilePhotoPicker';
import {
  dispatchFileToKakaoRealChatroom,
  extractKeywordSentencesZeroLlm,
  isMonsterCareIntentFromSearch,
  parseZeroLlmVoiceDocCommand,
  resolveTargetDocAndBuildFactAnswer,
  speakWithHyunsuOrSunhi,
  triggerUserFavoriteAiLiveVoiceBatonTouch,
} from '../../services/voiceSearchAndAiBatonEngine';
import type {
  AlumniStickChip,
  AnalogScannedPhotoItem,
  AnalogYearProposalItem,
  ClubFeedTrackId,
  ClubSizeTier,
  DuplicateGroup,
  FaceMemberCluster,
  FamilyRoomId,
  GlobalSwarmFaceCandidate,
  GpuHelperTierId,
  HardwareTelemetry,
  LocalDocumentFile,
  LoungeType,
  MerlinAuthState,
  MerlinCoinTopupBridgeState,
  OnboardingAhaItem,
  OnboardingTrackMode,
  PhotoItem,
  PricingPlanId,
  PrivateSyncStrategy,
  RoomPersonaMap,
  SearchResultItem,
  SearchSpaceMode,
  SetupAuditLogEntry,
  SetupChatTurn,
  SetupDiagnosisPlan,
  SetupFailureTelemetryEntry,
  SetupMonsterPlatform,
  SetupPreTriageQuestion,
  SetupProactiveHint,
  SetupSelfHealingOtaEntry,
  SwarmRetroScanReport,
  SyncMode,
  SyncState,
  TrashCategory,
  TrialScanPermissions,
  UndoQuarantineBatch,
  VideoSceneItem,
  VoiceRoutingTrace,
} from '../../types/saysee';
import {
  INITIAL_PROACTIVE_HINTS,
  buildSetupDiagnosisPlan,
  buildSetupPreTriageQuestion,
  executeRealOsAction,
  fetchRealPcOsInspection,
} from '../../services/setupMonsterEngine';
import { evaluateTrajectoryAndBuildSelfHealingOta } from '../../services/selfHealingEngine';
import {
  LOCAL_DOCUMENT_FILES,
  OnboardingProgressUpdate,
  PRESET_QUERIES,
  VIDEO_SCENE_ITEMS,
  detectHardwareTelemetry,
  detectLiveFacesFromPhoto,
  ensureTextQueryEncoderLoaded,
  ensureVideoKeyframesEmbeddedForSearch,
  executeTextSearch,
  executeZeroSttVoiceSearch,
  fetchAutonomousFaceClusters,
  fetchIndexedDocuments,
  fetchIndexedVideos,
  fetchSharedFamilyHostPhotos,
  hasUnindexedLocalVideos,
  isLocalVideosOcrIndexingPending,
  isTextQueryEncoderReady,
  normalizeLocalVideoSceneItem,
  loadInitialPhotoDataset,
  runOnboardingIndexingPipeline,
  searchLocalDocumentFilesAsync,
  searchVideoSceneItemsAsync,
  startSilentRealMediaVisionIndexing,
  updateFaceClusterRegistry,
} from '../../services/aiEngine';
import {
  LocalSentenceChip,
  TOTAL_CONCEPT_ANCHOR_COUNT,
  buildLocalSentenceSamplesFromCorpus,
} from '../../services/conceptLexicon';
import { loadMerlinAuth, toggleMerlinTier } from '../../services/merlinAuth';
import { loadSyncState, saveSyncPrefs } from '../../services/syncEngine';
import {
  executeMobileSteppingStoneScan,
  loadGhostSecretaryState,
  saveGhostSecretaryState,
} from '../../services/ghostSecretaryEngine';
import {
  DesktopTab,
  INITIAL_ONBOARDING_PROGRESS,
  MobileTab,
  ThemeMode,
  ViewportLayout,
  applyHtmlThemeClass,
  buildAutoMultiConditionSeedClusters,
  buildBidirectionalStickKeywords,
  buildYearEquivalenceTokens,
  deriveLoungeProperNounTokens,
  filterVisibleGalleryPhotos,
  getActivePersonaForCluster,
  isMobileOrStoreRuntime,
  isSharedPhotoLounge,
  quarantineFailureToast,
  quarantineResultNote,
  requestQuarantineOp,
  resolveInvitedHostLoungeAndRoom,
  resolveLoungePhotoCorpus,
  restoreAllExcludedCustomFaceRegistrations,
  saveCustomFaceRegistration,
  storeSharedRefs,
  voiceSession,
} from './storeSharedRefs';
import {
  activateDevicePlanPersistent,
  broadcastDeviceIntegrationStateUpdate,
  buildOptimisticTrialEntitlement,
  consumeDevicePairingCode6,
  executeRealDeviceSyncNow,
  isCurrentAccountSyncUnlocked,
  loadCachedDeviceIntegrationSnapshot,
  loadCachedSyncedClips,
  loadRemoteShadowCache,
  pushCrossDeviceClipboardText,
  revokeConnectedDevice,
  saveCachedDeviceIntegrationSnapshot,
  saveRemoteShadowCache,
  syncDeviceHeartbeatAndList,
  syncEncryptedSnippetsWithCloud,
  syncEntitlementToLocalPcEngine,
  type GhostiConnectedDeviceDto,
  type GhostiDeviceEntitlementView,
  type GhostiSyncedClipItem,
} from '../../services/deviceIntegrationService';
import { isPaidSubscriptionPlanId } from '../../services/subscriptionPlanCatalog';
import type { SaySeeStore } from '../useSaySeeStore';

let remoteShadowHydratedEmail = '';

export interface PaidDeviceSyncSlice {
  // [4대 라운지 & 24시간 GPU 클라우드 서버 도우미 스펙 + 1차 출시용 모바일 스토어 클린 모드(isStoreAppMode)]
  telemetry: HardwareTelemetry | null;
  merlinAuth: MerlinAuthState;
  syncState: SyncState;
  showProModal: boolean;
  freeTrialUsed: boolean;
  activePricingPlan: PricingPlanId;
  subscribedLounges: Record<LoungeType, PricingPlanId | null>;
  activeLoungeType: LoungeType;
  gpuHelper24hActive: boolean;
  gpuHelperActiveTier: GpuHelperTierId;
  gpuHelperRemainingHours: number;
  lastSentPcLinkChannel: 'email' | 'kakao' | null;
  sendPcMasterUrlToEmail: () => Promise<void>;
  sharePcMasterUrlToKakao: () => Promise<void>;

  connectedDevices: GhostiConnectedDeviceDto[];
  devicePairingCode6: string | null;
  deviceEntitlement: GhostiDeviceEntitlementView | null;
  syncedClipboardItems: GhostiSyncedClipItem[];
  thisDeviceRevoked: boolean;
  lastPhoneBackupFolderPath: string | null;
  subscriptionCheckoutPlanId: PricingPlanId | null;
  deviceSyncProgress: { phase: string; current: number; total: number } | null;
  syncedSnippetsMap: Record<string, string>;
  lastSnippetsSyncedAt: string | null;
  openSubscriptionCheckout: (planId: PricingPlanId) => void;
  closeSubscriptionCheckout: () => void;
  activate30DayDeviceTrialNow: () => Promise<boolean>;
  syncSnippetsNow: (direction?: 'auto' | 'push' | 'pull') => Promise<boolean>;
  refreshDeviceIntegrationState: (explicitTrialOptIn?: boolean) => Promise<void>;
  pairWithSixDigitCode: (code: string) => Promise<boolean>;
  unlinkConnectedDevice: (targetDeviceId: string) => Promise<boolean>;
  reconnectThisDevice: () => Promise<boolean>;
  sendTextToPairedClipboard: (text: string) => Promise<boolean>;
  setDeviceIntegrationSnapshot: (payload: {
    devices?: GhostiConnectedDeviceDto[];
    pairingCode?: string | null;
    entitlement?: GhostiDeviceEntitlementView | null;
    incomingClip?: GhostiSyncedClipItem;
    syncedClips?: GhostiSyncedClipItem[];
    revokedSelf?: boolean;
  }) => void;

  setShowProModal: (show: boolean) => void;
  setActiveLoungeType: (lounge: LoungeType) => void;
  activateGpuHelper24h: (tier: GpuHelperTierId) => void;
  deactivateGpuHelper24h: () => void;
  activatePricingPlan: (planId: PricingPlanId) => void;
  switchMerlinTier: () => void;
  updateSyncSettings: (mode: SyncMode, wifiOnly: boolean) => void;
  setPrivateSyncStrategy: (strategy: PrivateSyncStrategy) => void;
  setChargingOnlySync: (chargingOnly: boolean) => void;
  triggerSyncNow: () => Promise<void>;

  // [창 2 전담: 귀신창(seq_paste_daemon / ghost_search_window_ui2) 로컬 데몬 연결 상태 슬롯]
  ghostWinDaemonConnected: boolean;
  setGhostWinDaemonConnected: (connected: boolean) => void;
}

export const createPaidDeviceSyncSlice: StateCreator<SaySeeStore, [], [], PaidDeviceSyncSlice> = (set, get) => ({
  // ─────────────── [4대 라운지 & 24시간 GPU 클라우드 서버 도우미 + 1차 출시용 모바일 클린 모드 & 이중 방어] ───────────────
  telemetry: null,
  merlinAuth: loadMerlinAuth(),
  syncState: loadSyncState(0, 0),
  connectedDevices: loadCachedDeviceIntegrationSnapshot()?.devices || [],
  devicePairingCode6: loadCachedDeviceIntegrationSnapshot()?.pairingCode || null,
  deviceEntitlement: loadCachedDeviceIntegrationSnapshot()?.entitlement || null,
  syncedClipboardItems: loadCachedSyncedClips(),
  thisDeviceRevoked: false,
  lastPhoneBackupFolderPath: null,
  subscriptionCheckoutPlanId: null,
  deviceSyncProgress: null,
  syncedSnippetsMap: {},
  lastSnippetsSyncedAt: null,
  openSubscriptionCheckout: (planId: PricingPlanId) => {
    set({ subscriptionCheckoutPlanId: planId });
  },
  closeSubscriptionCheckout: () => {
    set({ subscriptionCheckoutPlanId: null });
  },
  activate30DayDeviceTrialNow: async () => {
    const { merlinAuth } = get();
    if (!merlinAuth?.email || !merlinAuth.userId || merlinAuth.userId === 'guest') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('openLoginModal'));
      }
      set({
        lastQuarantineToast: '🔑 먼저 이메일로 1초 로그인하면 30일 무료체험을 바로 시작할 수 있어요!',
      });
      return false;
    }
    const res = await activateDevicePlanPersistent('trial_opt_in_30d');
    if (res.ok && res.entitlement) {
      get().setDeviceIntegrationSnapshot({ entitlement: res.entitlement });
      set({
        lastQuarantineToast: `🎁 [30일 무제한 무료체험 시작 (D-${res.entitlement.trialDaysLeft})] 카드 등록·자동 결제 0%로 내 모든 기기 통합과 사진·표 OCR · 귀신 라벨러가 열렸습니다!`,
      });
      return true;
    }
    if (res.entitlement) {
      get().setDeviceIntegrationSnapshot({ entitlement: res.entitlement });
    }
    set({
      lastQuarantineToast:
        res.message ||
        '⚠️ 이 계정은 이미 30일 무료체험을 사용 완료했습니다. 월 3,900원 이용권으로 계속 이용하실 수 있습니다.',
    });
    return false;
  },
  syncSnippetsNow: async (direction: 'auto' | 'push' | 'pull' = 'auto') => {
    const { merlinAuth, deviceEntitlement } = get();
    if (!merlinAuth?.email || !merlinAuth.userId || merlinAuth.userId === 'guest') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('openLoginModal'));
      }
      return false;
    }
    if (deviceEntitlement && !deviceEntitlement.unlimitedBindingUnlocked) {
      set({
        lastQuarantineToast:
          '🔒 F1~F6 상용구 전 기기 동기화는 내 기기 통합 30일 무료체험 또는 구독 중일 때 사용할 수 있습니다.',
      });
      get().openSubscriptionCheckout('personal_sub_3900');
      return false;
    }
    const res = await syncEncryptedSnippetsWithCloud({
      email: merlinAuth.email,
      userId: merlinAuth.userId,
      direction,
    });
    if (!res.ok) {
      if (res.reason === 'TRIAL_EXPIRED' || res.reason === 'TRIAL_OPT_IN_REQUIRED') {
        set({
          lastQuarantineToast:
            '🔒 30일 무료체험이 종료되어 상용구 클라우드 동기화가 잠겼습니다. 구독 결제창에서 바로 재개하실 수 있어요.',
        });
        get().openSubscriptionCheckout('personal_sub_3900');
      }
      return false;
    }
    const count = Object.keys(res.snippets || {}).length;
    set({
      syncedSnippetsMap: res.snippets || {},
      lastSnippetsSyncedAt: res.updatedAt || new Date().toISOString(),
      lastQuarantineToast: `⌨️ [F1~F6 상용구 E2EE 동기화 완료] 총 ${count}개의 개인 상용구가 내 모든 PC·스마트폰에 안전하게 동기화되었습니다!`,
    });
    return true;
  },
  showProModal:
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('master') === 'pc' &&
    !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) &&
    window.innerWidth >= 860,
  freeTrialUsed: false,
  activePricingPlan: 'free_trial',
  subscribedLounges: {
    personal: null,
    family: null,
    club: null,
    student: null,
    work: null,
  },
  activeLoungeType: (() => {
    const inv = resolveInvitedHostLoungeAndRoom();
    return inv.hasActiveInvite && inv.hostLounge ? inv.hostLounge : 'personal';
  })(),
  gpuHelper24hActive: false,
  gpuHelperActiveTier: 'standard_1000',
  gpuHelperRemainingHours: 24,
  lastSentPcLinkChannel: null,

  sendPcMasterUrlToEmail: async () => {
    const { merlinAuth } = get();
    const baseMasterDomain = merlinAuth.pcMasterUrl || 'https://ghosti.sundreamer.app';
    const masterPcLink = `${baseMasterDomain.replace(/\/$/, '')}/?master=pc`;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(masterPcLink);
      }
    } catch {
      /* ignore */
    }
    set({
      lastSentPcLinkChannel: 'email',
      lastQuarantineToast: `📋 내 PC 연결 주소(${masterPcLink})를 클립보드에 복사했습니다! PC 브라우저 주소창에 붙여넣고 같은 이메일로 로그인하세요.`,
    });
  },

  sharePcMasterUrlToKakao: async () => {
    const { merlinAuth } = get();
    const baseMasterDomain = merlinAuth.pcMasterUrl || 'https://ghosti.sundreamer.app';
    const masterPcLink = `${baseMasterDomain.replace(/\/$/, '')}/?master=pc`;
    const shareTitle = '💻 귀신같이(Ghosti) PC 마스터 시작하기 — 클릭 시 바로 이동';
    const shareText = `[💻 귀신같이(Ghosti) 내 PC 연동 시작 가이드]\n수만 장의 원본 사진·영상 고속 인덱싱과 라운지 마스터 관리는 데스크톱(PC) 환경에서 작동합니다.\nPC 카카오톡에서 아래 가이드를 클릭해 대화면 작업을 바로 이어가세요!\n👉 ${masterPcLink}`;

    try {
      // 방법 2 대응: 카카오 공식 무료 SDK(Kakao.Share.sendDefault)가 로드된 환경이면 우선 호출
      const winKakao = (
        window as unknown as {
          Kakao?: {
            isInitialized?: () => boolean;
            Share?: { sendDefault?: (opts: Record<string, unknown>) => void };
          };
        }
      ).Kakao;

      if (winKakao?.isInitialized?.() && typeof winKakao.Share?.sendDefault === 'function') {
        winKakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title: shareTitle,
            description:
              '수만 장의 원본 사진·영상 고속 인덱싱과 라운지 마스터 관리는 데스크톱(PC) 환경에서 작동합니다.',
            imageUrl: `${baseMasterDomain.replace(/\/$/, '')}/favicon.ico`,
            link: {
              mobileWebUrl: masterPcLink,
              webUrl: masterPcLink,
            },
          },
          buttons: [
            {
              title: '💻 PC에서 마스터 세팅 열기',
              link: {
                mobileWebUrl: masterPcLink,
                webUrl: masterPcLink,
              },
            },
          ],
        });
      } else {
        // 방법 1 (기본 추천 · 가입/심사 0초 · 평생 0원): 스마트폰 기본 공유 시트(navigator.share) 즉시 호출 + 클립보드 백업
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareText);
        }
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
          await navigator
            .share({
              title: shareTitle,
              text: '수만 장의 원본 사진·영상 고속 인덱싱과 라운지 마스터 관리는 데스크톱(PC) 환경에서 작동합니다. 나와의 채팅방에 보내두고 PC에서 바로 이어가세요.',
              url: masterPcLink,
            })
            .catch(() => {});
        }
      }
    } catch {
      /* ignore */
    }

    set({
      lastSentPcLinkChannel: 'kakao',
      lastQuarantineToast:
        '💬 카톡(나에게)으로 보낼 ‘내 PC 연동 시작 가이드’가 준비되었습니다! PC 카카오톡에서 클릭해 바로 작업을 이어가세요.',
    });
  },

  setShowProModal: (showProModal) => set({ showProModal }),

  setActiveLoungeType: (requestedLoungeType) => {
    storeSharedRefs.activeSharedRoomId = null;
    set((state) => {
      const activeLoungeType: LoungeType = requestedLoungeType;
      const isTargetLoungeSubscribed = Boolean(state.subscribedLounges[activeLoungeType]);
      const isSwitchingLounge = state.activeLoungeType !== activeLoungeType || Boolean(state.activeJoinedRoomMeta);
      const sharedMode = isSharedPhotoLounge(activeLoungeType);
      const invInfo = resolveInvitedHostLoungeAndRoom();
      const nextFamilyRoom: FamilyRoomId =
        isSwitchingLounge && activeLoungeType === 'family'
          ? invInfo.hasActiveInvite && invInfo.hostLounge === 'family'
            ? invInfo.hostFamilyRoom
            : state.activeFamilyRoom || '우리집'
          : state.activeFamilyRoom || '우리집';
      const nextCorpus = resolveLoungePhotoCorpus({
        activeLoungeType,
        activeFamilyRoom: nextFamilyRoom,
        activeSharedRoomId: null,
        photos: state.photos,
        sharedRoomHostPhotos: state.sharedRoomHostPhotos,
        sharedRoomAddedPhotos: state.sharedRoomAddedPhotos,
      });
      const refreshedGalleryResults: SearchResultItem[] = filterVisibleGalleryPhotos(nextCorpus).map(
        (photo) => ({
          photo,
          score: 0.95,
          matchPercentage: 97,
          matchedBy: 'text-direct' as const,
        })
      );
      const vaultPhotos: SearchResultItem[] = sharedMode
        ? []
        : state.photos
            .filter((p) => !p.quarantined && p.isVaultDocument)
            .map((photo) => ({
              photo,
              score: 0.96,
              matchPercentage: 98,
              matchedBy: 'text-direct' as const,
            }));
      return {
        activeLoungeType,
        activeFamilyRoom: nextFamilyRoom,
        activeSharedRoomId: null,
        activeJoinedRoomMeta: null,
        activePricingPlan: state.subscribedLounges[activeLoungeType] ?? 'free_trial',
        ...(isSwitchingLounge
          ? {
              hasExecutedUserSearch: false,
              searchSpace: 'gallery' as const,
              searchResults: refreshedGalleryResults,
              matchedVideoScenes: sharedMode ? [] : state.videoSceneItems,
              matchedLocalDocs: sharedMode ? [] : state.localDocuments,
              matchedVaultPhotos: vaultPhotos,
              activeQuery:
                activeLoungeType === 'family'
                  ? `${nextFamilyRoom} 패밀리 앨범 (${refreshedGalleryResults.length}장)`
                  : activeLoungeType === 'club'
                  ? `동호회·모임 앨범 (${refreshedGalleryResults.length}장)`
                  : activeLoungeType === 'student'
                  ? `동창회 앨범 (${refreshedGalleryResults.length}장)`
                  : `전체 갤러리 사진 (${refreshedGalleryResults.length}장)`,
            }
          : {}),
        // 내 기기(personal) 진입 시 1관문인 '귀신비서(trash)'가 기본 노출되며, 가족/모임/동창회방 전환 시 갤러리('dashboard')가 기본 노출
        desktopTab:
          isSwitchingLounge && activeLoungeType === 'personal'
            ? 'trash'
            : isSwitchingLounge && sharedMode
            ? 'dashboard'
            : isTargetLoungeSubscribed && state.desktopTab === 'trial'
            ? 'dashboard'
            : state.desktopTab,
        mobileTab:
          isSwitchingLounge && activeLoungeType === 'personal'
            ? 'trash'
            : isSwitchingLounge && sharedMode
            ? 'search'
            : isTargetLoungeSubscribed && state.mobileTab === 'trial'
            ? 'search'
            : state.mobileTab,
        // 동창회(student) 진입 시 기본 탭은 [🎞️ 1989 추억], 동호회·모임(club) 진입 시 [🍻 최근 모임]으로 설정
        clubFeedTrack:
          activeLoungeType === 'student'
            ? 'memories_1989'
            : activeLoungeType === 'club'
            ? 'recent_now'
            : state.clubFeedTrack,
        gpuHelperActiveTier:
          activeLoungeType === 'club' || activeLoungeType === 'student'
            ? state.clubSizeTier === 'large'
              ? 'club_large_3000'
              : state.clubSizeTier === 'medium'
              ? 'club_medium_2000'
              : 'club_small_1000'
            : 'standard_1000',
      };
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  },

  activateGpuHelper24h: (tier) => {
    const tierLabelMap: Record<GpuHelperTierId, string> = {
      standard_1000: '개인 / 패밀리 / 동호회 · 동창회 (24시간 1,000원)',
      club_small_1000: '소형 동호·동창회 ~20명 (24시간 1,000원)',
      club_medium_2000: '중형 동호·동창회 ~100명 (24시간 2,000원)',
      club_large_3000: '대형 동호·동창회 무제한 (24시간 3,000원)',
    };
    set({
      gpuHelper24hActive: true,
      gpuHelperActiveTier: tier,
      gpuHelperRemainingHours: 24,
      onboardingTrackMode: 'cloud_rental',
      lastQuarantineToast: `⚡ [24시간 GPU 클라우드 서버 도우미 가동 시작] ${tierLabelMap[tier]} • 멤버 사진·영상 Gemma 2 인덱싱 및 캐시 배포를 실시간 대행하며, 추후 내 PC가 켜지면 원본 이관 후 클라우드에서 100% 자동 소각됩니다.`,
    });
  },

  deactivateGpuHelper24h: () =>
    set({
      gpuHelper24hActive: false,
      onboardingTrackMode: 'pc_local',
      lastQuarantineToast:
        '🟢 [내 PC 직접 구동 모드로 복귀] 클라우드 임시 캐시를 100% 자동 소각하고 내 PC 엔진으로 전환했습니다.',
    }),

  activatePricingPlan: (planId: PricingPlanId) => {
    // [치명 과금 누수 영구 봉쇄] 모든 유료 이용권(5번 내 기기 통합 · 6번 업무 공유)은
    // 임의 무료 개통을 금지하고 반드시 [귀신같이 구독 결제창]을 열어 잔액 대조 · 충전소 연동 · 실결제를 거칩니다.
    if (isPaidSubscriptionPlanId(planId)) {
      set({
        subscriptionCheckoutPlanId: planId,
      });
      return;
    }

    set((state) => {
      const labelMap: Partial<Record<PricingPlanId, string>> = {
        free_trial: '✨ 내 기기 1대 (기본) : 언제나 0원 (내 PC·모바일 1초 초능력 기본 기능 평생 무료)',
        personal_single_2900: '🆓 내 기기 1대 (기본) : 언제나 0원 • ✋ 귀신같이 손보기',
        family_home_5900: '🏠 패밀리 사진 공유 • 우리집 단독 (인원·장수 무제한 평생 0원 무료)',
        family_home_year_59000: '🏠 패밀리 사진 공유 • 우리집 단독 (인원·장수 무제한 평생 0원 무료)',
        family_three_8900: '👨‍👩‍👧‍👦 패밀리 사진 공유 • 양가 통합 (인원·장수 무제한 평생 0원 무료)',
        family_three_year_89000: '👨‍👩‍👧‍👦 패밀리 사진 공유 • 양가 통합 (인원·장수 무제한 평생 0원 무료)',
        club_mini_free_300: '🥂 일상 소모임 사진 공유 • 인원·장수 제한 없이 100% 평생 0원 무료',
        club_mini_2900: '🥂 일상 소모임 사진 공유 • 인원·장수 제한 없이 100% 평생 0원 무료',
        club_small_4900: '⛳·🎓 동호회 · 동창회 사진 공유 • 인원·장수 제한 없이 100% 평생 0원 무료',
        club_small_year_49000: '⛳·🎓 동호회 · 동창회 사진 공유 • 인원·장수 제한 없이 100% 평생 0원 무료',
        club_medium_7900: '⛳·🎓 동호회 · 동창회 사진 공유 • 인원·장수 제한 없이 100% 평생 0원 무료',
        club_medium_year_79000: '⛳·🎓 동호회 · 동창회 사진 공유 • 인원·장수 제한 없이 100% 평생 0원 무료',
        club_large_14900: '⛳·🎓 동호회 · 동창회 사진 공유 • 인원·장수 제한 없이 100% 평생 0원 무료',
        club_large_year_149000: '⛳·🎓 동호회 · 동창회 사진 공유 • 인원·장수 제한 없이 100% 평생 0원 무료',
        student_sub_900: '📸 사진 공유 (가족·동호회·동창회 • 인원·장수 무제한 평생 0원 무료)',
        student_year_9000: '📸 사진 공유 (가족·동호회·동창회 • 인원·장수 무제한 평생 0원 무료)',
      };

      const nextLoungeType: LoungeType = planId.startsWith('family_')
        ? 'family'
        : planId.startsWith('club_') || planId.startsWith('student_')
        ? 'club'
        : 'personal';

      return {
        activePricingPlan: planId,
        activeLoungeType: nextLoungeType,
        clubFeedTrack: nextLoungeType === 'club' ? 'memories_1989' : state.clubFeedTrack,
        showProModal: false,
        desktopTab: nextLoungeType !== 'personal' && state.desktopTab === 'trial' ? 'dashboard' : state.desktopTab,
        mobileTab: nextLoungeType !== 'personal' && state.mobileTab === 'trial' ? 'search' : state.mobileTab,
        lastQuarantineToast: `✨ [${labelMap[planId] || '평생 0원 무료 모드'}] 바로 시작합니다!`,
      };
    });
  },

  refreshDeviceIntegrationState: async (explicitTrialOptIn?: boolean) => {
    const prevEntitlement = get().deviceEntitlement;
    if (explicitTrialOptIn) {
      if (prevEntitlement?.trialExpired && !prevEntitlement?.isPaidUnlimited) {
        set({
          lastQuarantineToast:
            '🔒 이 계정은 30일 무료체험을 이미 사용 완료했습니다. 구독 결제창에서 월 3,900원으로 바로 재개하실 수 있어요.',
        });
        get().openSubscriptionCheckout('personal_sub_3900');
        return;
      }
      // 체험 동의 클릭 즉시 0.00ms 낙관적 상태 전환 + 같은 계정 다른 탭·기기로 즉시 전파
      const optimisticEnt = buildOptimisticTrialEntitlement(
        prevEntitlement,
        Math.max(2, get().connectedDevices.length)
      );
      saveCachedDeviceIntegrationSnapshot({ entitlement: optimisticEnt });
      broadcastDeviceIntegrationStateUpdate({
        devices: get().connectedDevices,
        entitlement: optimisticEnt,
      });
      set({
        deviceEntitlement: optimisticEnt,
        lastQuarantineToast: `🎁 [30일 무제한 무료체험 시작 (D-${optimisticEnt.trialDaysLeft})] 카드 등록·자동 결제 0%로 내 모든 PC·스마트폰이 직결되었습니다!`,
      });
    }
    const hb = await syncDeviceHeartbeatAndList({ explicitTrialOptIn });
    if (!hb.ok) {
      if (explicitTrialOptIn) {
        saveCachedDeviceIntegrationSnapshot({ entitlement: prevEntitlement });
        set({
          deviceEntitlement: prevEntitlement,
          lastQuarantineToast:
            '⚠️ 일시적인 네트워크 지연으로 체험 시작을 저장하지 못했습니다. 다시 한 번 눌러 주세요.',
        });
      }
      return;
    }
    get().setDeviceIntegrationSnapshot({
      devices: hb.devices,
      pairingCode: hb.pairingCode ?? get().devicePairingCode6,
      entitlement: hb.entitlement ?? get().deviceEntitlement,
      revokedSelf: hb.revokedSelf,
    });
  },

  pairWithSixDigitCode: async (code: string) => {
    const prevEntitlement = get().deviceEntitlement;
    const optimisticEnt = buildOptimisticTrialEntitlement(
      prevEntitlement,
      Math.max(2, get().connectedDevices.length)
    );
    set({
      deviceEntitlement: optimisticEnt,
    });
    const res = await consumeDevicePairingCode6(code);
    if (!res.ok) {
      set({
        deviceEntitlement: prevEntitlement,
        lastQuarantineToast:
          res.reason === 'AUTH_REQUIRED'
            ? '🔑 먼저 PC와 동일한 이메일로 1초 로그인해 주세요!'
            : '⚠️ 6자리 연결 번호가 만료되었거나 일치하지 않습니다. PC 화면의 최신 번호를 확인해 주세요.',
      });
      return false;
    }
    const hasMobile = res.devices.some((d) => d.device_kind === 'mobile');
    set({
      connectedDevices: res.devices,
      deviceEntitlement: res.entitlement,
      thisDeviceRevoked: false,
      pcAgentPairedMobile: hasMobile || res.devices.length >= 2,
      lastQuarantineToast: res.alreadyPaired
        ? `✅ 이미 연결된 기기입니다! 최신 연결 상태를 확인했습니다 (연결된 내 기기 ${res.devices.length}대)`
        : `🎉 내 PC ↔ 스마트폰 보안 연결 완료! (${res.devices.length}대 연결됨 · 30일 무제한 무료체험 가동)`,
    });
    return true;
  },

  unlinkConnectedDevice: async (targetDeviceId: string) => {
    const target = get().connectedDevices.find((d) => d.device_id === targetDeviceId);
    const targetName = target?.display_name || '선택한 기기';
    const res = await revokeConnectedDevice(targetDeviceId);
    if (!res.ok) {
      set({
        lastQuarantineToast:
          '⚠️ 기기 연결을 해제하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 눌러 주세요.',
      });
      return false;
    }
    const hasMobile = res.devices.some((d) => d.device_kind === 'mobile');
    set((state) => ({
      connectedDevices: res.devices,
      deviceEntitlement: res.entitlement ?? state.deviceEntitlement,
      thisDeviceRevoked: res.revokedSelf ? true : state.thisDeviceRevoked,
      pcAgentPairedMobile: hasMobile || res.devices.length >= 2,
      lastQuarantineToast: res.revokedSelf
        ? '🔌 이 기기의 연결이 해제되었습니다. 다시 연결하려면 PC QR 스캔 또는 6자리 연결번호를 입력해 주세요.'
        : `🔌 [${targetName}] 연결이 해제되었습니다. (현재 연결된 내 기기 ${res.devices.length}대)`,
    }));
    return true;
  },

  reconnectThisDevice: async () => {
    const hb = await syncDeviceHeartbeatAndList({ explicitReconnect: true });
    if (!hb.ok) {
      set({
        lastQuarantineToast: '⚠️ 기기 재연결에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      });
      return false;
    }
    const hasMobile = hb.devices.some((d) => d.device_kind === 'mobile');
    set((state) => ({
      connectedDevices: hb.devices,
      devicePairingCode6: hb.pairingCode ?? state.devicePairingCode6,
      deviceEntitlement: hb.entitlement ?? state.deviceEntitlement,
      thisDeviceRevoked: false,
      pcAgentPairedMobile: hasMobile || hb.devices.length >= 2,
      lastQuarantineToast: `✅ 이 기기가 다시 연결되었습니다! (연결된 내 기기 ${hb.devices.length}대)`,
    }));
    return true;
  },

  sendTextToPairedClipboard: async (text: string) => {
    const { merlinAuth, deviceEntitlement } = get();
    if (!merlinAuth?.email || !merlinAuth.userId || merlinAuth.userId === 'guest') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('openLoginModal'));
      }
      return false;
    }
    if (
      (deviceEntitlement && !deviceEntitlement.unlimitedBindingUnlocked) ||
      !isCurrentAccountSyncUnlocked(merlinAuth.email)
    ) {
      set({
        lastQuarantineToast: deviceEntitlement?.trialExpired
          ? '🔒 30일 무료체험이 종료되어 암호화 클립보드 전송이 잠겼습니다. 구독 결제창에서 바로 재개하실 수 있어요.'
          : '🎁 내 기기 통합 30일 무료체험 시작 또는 구독 후 암호화 클립보드를 이용할 수 있습니다.',
      });
      get().openSubscriptionCheckout('personal_sub_3900');
      return false;
    }
    const pushed = await pushCrossDeviceClipboardText({
      text,
      email: merlinAuth.email,
      userId: merlinAuth.userId,
      allowBypassEchoGuard: true,
    });
    if (!pushed.ok) {
      set({
        lastQuarantineToast:
          '⚠️ 암호화 클립보드 전송에 실패했습니다. 무료체험 기간 또는 구독 상태를 확인해 주세요.',
      });
      return false;
    }
    if (pushed.item) {
      set((state) => ({
        syncedClipboardItems: [
          pushed.item!,
          ...state.syncedClipboardItems.filter((c) => c.clipHash !== pushed.item!.clipHash),
        ].slice(0, 15),
        lastQuarantineToast:
          '📋 종단간 암호화(AES-256-GCM) 클립보드 전송 완료! 연결된 내 기기에서 바로 붙여넣기 하세요.',
      }));
    }
    return true;
  },

  setDeviceIntegrationSnapshot: (payload) => {
    const emailNow = (get().merlinAuth?.email || '').trim().toLowerCase();
    const nextEnt =
      payload.entitlement !== undefined ? payload.entitlement : get().deviceEntitlement;

    if (payload.entitlement !== undefined) {
      void syncEntitlementToLocalPcEngine(payload.entitlement, emailNow || undefined);
    }

    set((state) => {
      const nextDevices = payload.devices ?? state.connectedDevices;
      const hasMobile = nextDevices.some((d) => d.device_kind === 'mobile');
      const nextClips = payload.incomingClip
        ? [
            payload.incomingClip,
            ...state.syncedClipboardItems.filter(
              (c) => c.clipHash !== payload.incomingClip!.clipHash
            ),
          ].slice(0, 15)
        : payload.syncedClips
        ? payload.syncedClips.slice(0, 15)
        : state.syncedClipboardItems;

      // [기획서 확정 30일 만료 깔끔 분리 원칙]:
      // 만료 상태(!unlimitedBindingUnlocked)가 확정되면 귀신검색창 내 타 기기 원격 노출(shadow-remote-*)만 즉시 OFF!
      // 이미 대장 PC 로컬 폴더(Pictures\Ghosti_Phone_Backup)에 복사된 원본 파일들은 100% 그대로 보존됩니다.
      let nextPhotos = state.photos;
      let nextDocs = state.localDocuments;
      let nextSearchResults = state.searchResults;
      if (nextEnt && !nextEnt.unlimitedBindingUnlocked) {
        const hadRemotePhotos = state.photos.some((p) => p.id.startsWith('shadow-remote-'));
        const hadRemoteDocs = state.localDocuments.some((d) => d.id.startsWith('shadow-remote-doc-'));
        if (hadRemotePhotos) {
          nextPhotos = state.photos.filter((p) => !p.id.startsWith('shadow-remote-'));
          nextSearchResults = state.searchResults.filter(
            (r) => !r.photo.id.startsWith('shadow-remote-')
          );
        }
        if (hadRemoteDocs) {
          nextDocs = state.localDocuments.filter((d) => !d.id.startsWith('shadow-remote-doc-'));
        }
      }

      const nextSubscribed = { ...state.subscribedLounges };
      if (nextEnt?.isPaidUnlimited) {
        nextSubscribed.personal = (nextEnt.planId || 'personal_sub_3900') as PricingPlanId;
      } else if (nextEnt && !nextEnt.isPaidUnlimited && nextSubscribed.personal) {
        nextSubscribed.personal = null;
      }
      if (nextEnt?.workPaidActive && nextEnt.workPlanId) {
        nextSubscribed.work = nextEnt.workPlanId as PricingPlanId;
      }

      return {
        photos: nextPhotos,
        localDocuments: nextDocs,
        searchResults: nextSearchResults,
        subscribedLounges: nextSubscribed,
        connectedDevices: nextDevices,
        devicePairingCode6:
          payload.pairingCode !== undefined ? payload.pairingCode : state.devicePairingCode6,
        deviceEntitlement: nextEnt,
        thisDeviceRevoked:
          payload.revokedSelf !== undefined ? payload.revokedSelf : state.thisDeviceRevoked,
        pcAgentPairedMobile:
          payload.devices !== undefined
            ? hasMobile || nextDevices.length >= 2
            : state.pcAgentPairedMobile,
        syncedClipboardItems: nextClips,
      };
    });

    // 유효 구독/체험 상태이고 아직 이 세션에서 IndexedDB 타 기기 섀도우를 복원하지 않았으면 자동 복원 (F5 증발 방지)
    if (emailNow && nextEnt?.unlimitedBindingUnlocked && remoteShadowHydratedEmail !== emailNow) {
      remoteShadowHydratedEmail = emailNow;
      void loadRemoteShadowCache(emailNow).then(({ photos: cachedRemotePhotos, docs: cachedRemoteDocs }) => {
        if (cachedRemotePhotos.length === 0 && cachedRemoteDocs.length === 0) return;
        const cur = get();
        if (cur.deviceEntitlement && !cur.deviceEntitlement.unlimitedBindingUnlocked) return;
        const existPhotoIds = new Set(cur.photos.map((p) => p.id));
        const existDocIds = new Set(cur.localDocuments.map((d) => d.id));
        const addPhotos = cachedRemotePhotos.filter((p) => !existPhotoIds.has(p.id));
        const addDocs = cachedRemoteDocs.filter((d) => !existDocIds.has(d.id));
        if (addPhotos.length === 0 && addDocs.length === 0) return;
        set((s) => {
          const mergedPhotos = addPhotos.length > 0 ? [...addPhotos, ...s.photos] : s.photos;
          const mergedDocs = addDocs.length > 0 ? [...addDocs, ...s.localDocuments] : s.localDocuments;
          const localBytes = mergedPhotos
            .filter((p) => !p.quarantined && !p.id.startsWith('shadow-remote-'))
            .reduce((acc, p) => acc + (p.size || 0), 0);
          const realGB = Number((localBytes / (1024 * 1024 * 1024)).toFixed(2));
          const packMB = Number(
            Math.max(0.1, ((addPhotos.length + addDocs.length) * 13) / 1024).toFixed(2)
          );
          return {
            photos: mergedPhotos,
            localDocuments: mergedDocs,
            syncState: {
              ...s.syncState,
              packSizeMB: Math.max(s.syncState.packSizeMB || 0, packMB),
              originalSizeGB: Math.max(s.syncState.originalSizeGB || 0, realGB),
            },
          };
        });
      });
    }
  },

  switchMerlinTier: () => {
    set((state) => ({ merlinAuth: toggleMerlinTier(state.merlinAuth) }));
  },

  updateSyncSettings: (mode: SyncMode, wifiOnly: boolean) => {
    const { syncState } = get();
    saveSyncPrefs(mode, wifiOnly, syncState.privateSyncStrategy, syncState.chargingOnly);
    set((state) => ({
      syncState: {
        ...state.syncState,
        mode,
        wifiOnly,
        lastSyncedAt: '방금 전',
      },
    }));
  },

  setPrivateSyncStrategy: (privateSyncStrategy: PrivateSyncStrategy) => {
    const { syncState } = get();
    saveSyncPrefs(syncState.mode, syncState.wifiOnly, privateSyncStrategy, syncState.chargingOnly);
    set((state) => ({
      syncState: {
        ...state.syncState,
        privateSyncStrategy,
      },
      lastQuarantineToast:
        privateSyncStrategy === 'shadow'
          ? '⚡ [폰 용량 절약 모드] 선택됨: 무거운 원본 사진·문서는 내 PC에 보관하고, 폰에는 장당 13KB 초경량 미리보기만 남겨 폰 용량을 99.4% 절약합니다!'
          : '💾 [폰·PC 양쪽 원본 보관 모드] 선택됨: 폰과 내 PC 양쪽에 동일한 100% 원본 파일을 그대로 유지해 이중으로 안전하게 백업합니다!',
    }));
  },

  setChargingOnlySync: (chargingOnly: boolean) => {
    const { syncState } = get();
    saveSyncPrefs(syncState.mode, syncState.wifiOnly, syncState.privateSyncStrategy, chargingOnly);
    set((state) => ({
      syncState: {
        ...state.syncState,
        chargingOnly,
      },
    }));
  },

  triggerSyncNow: async () => {
    const { merlinAuth } = get();
    const isLoggedInUser = Boolean(
      merlinAuth?.email && merlinAuth.userId && merlinAuth.userId !== 'guest'
    );
    if (!isLoggedInUser) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('openLoginModal'));
      }
      set({
        lastQuarantineToast:
          '🔑 아직 로그인된 계정이 없어 연결할 내 PC를 알 수 없어요! 먼저 이메일로 1초 로그인해 주세요.',
      });
      return;
    }

    set((state) => ({
      syncState: { ...state.syncState, syncing: true },
      deviceSyncProgress: { phase: '연결 기기 및 이용권 확인 중', current: 0, total: 1 },
    }));

    // 1) 실제 등록 기기 목록(ghosti_devices) 및 서버 원장(entitlement) 정직 확인 (동의 없는 임의 체험 개시 금지)
    const hb = await syncDeviceHeartbeatAndList();
    const liveEnt = hb.entitlement ?? get().deviceEntitlement;
    if (hb.ok) {
      get().setDeviceIntegrationSnapshot({
        devices: hb.devices,
        pairingCode: hb.pairingCode ?? get().devicePairingCode6,
        entitlement: liveEnt,
        revokedSelf: hb.revokedSelf,
      });
    }

    if (liveEnt && !liveEnt.unlimitedBindingUnlocked) {
      set((state) => ({
        syncState: { ...state.syncState, syncing: false },
        deviceSyncProgress: null,
        lastQuarantineToast: liveEnt.trialExpired
          ? '🔒 30일 무료체험이 종료되어 기기 간 원격 동기화가 잠겼습니다. 구독 결제창에서 월 3,900원으로 바로 재개하실 수 있어요.'
          : '🎁 내 기기 통합은 30일 무료체험 시작 또는 이용권 구독 후 실행됩니다. 결제창에서 0원 30일 체험 또는 구독을 선택해 주세요.',
      }));
      get().openSubscriptionCheckout('personal_sub_3900');
      return;
    }

    const liveDeviceCount = hb.ok ? hb.devices.length : get().connectedDevices.length;
    const isZCoreConnected = zCoreBridge.isConnected;
    if (!isZCoreConnected && liveDeviceCount < 2 && !get().pcAgentPairedMobile) {
      set((state) => ({
        syncState: {
          ...state.syncState,
          syncing: false,
          connectedPeer: '연결된 기기 없음',
          lastSyncedAt: '연결된 내 PC 없음 (대기 중)',
        },
        deviceSyncProgress: null,
        lastQuarantineToast:
          '💻 아직 같은 이메일로 연결된 다른 내 기기가 없습니다! 내 PC 또는 스마트폰에서도 동일한 이메일로 로그인하면 즉시 직결됩니다.',
      }));
      return;
    }

    // 2) 실제 13KB 섀도우 카탈로그(사진 + PC 문서 양방향) + 원본 배치 미러링 실행
    const curState = get();
    const syncRes = await executeRealDeviceSyncNow({
      strategy: curState.syncState.privateSyncStrategy,
      photos: curState.photos,
      localDocuments: curState.localDocuments,
      email: merlinAuth.email,
      onProgress: (progress) => {
        set({ deviceSyncProgress: progress });
      },
    });

    if (!syncRes.ok) {
      set((state) => ({
        syncState: { ...state.syncState, syncing: false },
        deviceSyncProgress: null,
        lastQuarantineToast:
          syncRes.message ||
          '🔒 이용권 상태를 확인해 주세요. 구독 결제창에서 30일 무료체험 또는 월 3,900원 이용권을 시작할 수 있습니다.',
      }));
      if (syncRes.reason === 'TRIAL_EXPIRED' || syncRes.reason === 'TRIAL_OPT_IN_REQUIRED') {
        get().openSubscriptionCheckout('personal_sub_3900');
      }
      return;
    }

    // 3) 백그라운드로 F1~F6 상용구 E2EE 동기화도 함께 수행
    void syncEncryptedSnippetsWithCloud({
      email: merlinAuth.email,
      userId: merlinAuth.userId,
      direction: 'auto',
    }).then((snipRes) => {
      if (snipRes.ok) {
        set({
          syncedSnippetsMap: snipRes.snippets,
          lastSnippetsSyncedAt: snipRes.updatedAt || new Date().toISOString(),
        });
      }
    });

    let nextPhotosForCache: PhotoItem[] = [];
    let nextDocsForCache: LocalDocumentFile[] = [];

    set((state) => {
      const mergedPhotos =
        syncRes.remotePhotosToMerge.length > 0
          ? [...syncRes.remotePhotosToMerge, ...state.photos]
          : state.photos;
      const mergedDocs =
        syncRes.remoteDocsToMerge.length > 0
          ? [...syncRes.remoteDocsToMerge, ...state.localDocuments]
          : state.localDocuments;
      nextPhotosForCache = mergedPhotos;
      nextDocsForCache = mergedDocs;

      const peerNames = (hb.ok ? hb.devices : state.connectedDevices)
        .map((d) => d.display_name)
        .join(' · ');

      // [사진 탭 0장 공백 근본 해결]: 동기화된 다른 기기 사진이 있으면 즉시 searchResults에 합류
      let nextSearchResults = state.searchResults;
      if (state.activeLoungeType === 'personal') {
        if (syncRes.remotePhotosToMerge.length > 0) {
          const existingSrIds = new Set(state.searchResults.map((r) => r.photo.id));
          const appendedResults = syncRes.remotePhotosToMerge
            .filter((p) => !existingSrIds.has(p.id))
            .map((photo) => ({
              photo,
              score: 0.97,
              matchPercentage: 98,
              matchedBy: 'text-direct' as const,
            }));
          if (!state.hasExecutedUserSearch) {
            nextSearchResults = filterVisibleGalleryPhotos(mergedPhotos).map((photo) => ({
              photo,
              score: 0.96,
              matchPercentage: 97,
              matchedBy: 'text-direct' as const,
            }));
          } else if (appendedResults.length > 0) {
            nextSearchResults = [...appendedResults, ...state.searchResults];
          }
        } else if (!state.hasExecutedUserSearch && state.searchResults.length === 0 && mergedPhotos.length > 0) {
          nextSearchResults = filterVisibleGalleryPhotos(mergedPhotos).map((photo) => ({
            photo,
            score: 0.96,
            matchPercentage: 97,
            matchedBy: 'text-direct' as const,
          }));
        }
      }

      const remotePhotoCountNow = mergedPhotos.filter(
        (p) => !p.quarantined && p.id.startsWith('shadow-remote-')
      ).length;
      const remoteDocCountNow = mergedDocs.filter((d) =>
        d.id.startsWith('shadow-remote-doc-')
      ).length;
      const localBytes = mergedPhotos
        .filter((p) => !p.quarantined && !p.id.startsWith('shadow-remote-'))
        .reduce((acc, p) => acc + (p.size || 0), 0);
      const realOriginalSizeGB = Number(
        Math.max(0.01, localBytes / (1024 * 1024 * 1024)).toFixed(2)
      );

      return {
        photos: mergedPhotos,
        localDocuments: mergedDocs,
        searchResults: nextSearchResults,
        deviceSyncProgress: null,
        lastPhoneBackupFolderPath: syncRes.backupDirPath || state.lastPhoneBackupFolderPath,
        connectedDevices: hb.ok ? hb.devices : state.connectedDevices,
        devicePairingCode6: hb.pairingCode ?? state.devicePairingCode6,
        deviceEntitlement: liveEnt ?? state.deviceEntitlement,
        pcAgentPairedMobile:
          liveDeviceCount >= 2 ||
          (hb.ok && hb.devices.some((d) => d.device_kind === 'mobile')) ||
          state.pcAgentPairedMobile,
        syncState: {
          ...state.syncState,
          syncing: false,
          packSizeMB: syncRes.packSizeMB || state.syncState.packSizeMB,
          originalSizeGB: realOriginalSizeGB,
          connectedPeer: peerNames || state.syncState.connectedPeer,
          lastSyncedAt: `방금 전 (전체 ${syncRes.mergedCatalog.length}건 · 타 기기 사진 ${remotePhotoCountNow}장 · 문서 ${remoteDocCountNow}건)`,
        },
        lastQuarantineToast:
          state.syncState.privateSyncStrategy === 'shadow'
            ? `⚡ [스마트 절약 일치화 완료] 총 ${syncRes.mergedCatalog.length}건 동기화(타 기기 사진 ${remotePhotoCountNow}장 · 문서 ${remoteDocCountNow}건 · 폰 점유 ${syncRes.packSizeMB}MB)! 새로고침해도 그대로 유지됩니다.`
            : `💾 [원본 배치 백업 완료] 총 ${syncRes.mergedCatalog.length}건(원본 업로드 ${syncRes.mirroredUploadCount}장 · PC 백업 저장 ${syncRes.mirroredPullCount}장 · 문서 ${remoteDocCountNow}건) — 위치: 내 PC ➔ 사진 ➔ Ghosti_Phone_Backup`,
      };
    });

    // 4) 새로고침(F5) 증발 방지를 위해 타 기기 사진·문서를 IndexedDB에 영속 캐시
    if (merlinAuth.email) {
      void saveRemoteShadowCache(merlinAuth.email, nextPhotosForCache, nextDocsForCache);
    }
  },

  ghostWinDaemonConnected: false,
  setGhostWinDaemonConnected: (ghostWinDaemonConnected) => set({ ghostWinDaemonConnected }),
});
