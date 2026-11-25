import type { StateCreator } from 'zustand';
import { getZCoreUrl, zCoreBridge, ensureLoginAndZCoreReady } from '../../services/zCoreBridge';
import { submitExternalMonsterChatQuery } from '../../services/monsterChatRouter';
import {
  isMobileVoiceEnvironment,
  speakSetupMonsterTts,
  stopSetupMonsterTts,
  triggerSetupMonsterTtsPrewarm,
} from '../../services/setupMonsterTts';
import {
  analyzeMobilePickedPhotoFiles,
  analyzeNativeGalleryPhotoBatch,
  applyCachedPcOpticalAuditInstant,
  auditRealPcPhotosAndCluster,
  clusterPhotosIntoDuplicateGroups,
  convertNativeGalleryVideos,
  loadCachedMobileGalleryIndex,
  migrateOpticalSigPhotoId,
  pruneQuarantinedFromDuplicateGroups,
  saveCachedMobileGalleryIndex,
  scheduleSaveCachedMobileGalleryIndex,
} from '../../services/mobilePhotoPicker';
import {
  isCapacitorIosRuntime,
  isCapacitorNativeMobileRuntime,
  isSystemTrashDialogActiveOrCoolingDown,
  registerMobilePickedPhotoMeta,
  scanNativeDeviceGalleryMedia,
} from '../../services/ghostiMobileCareBridge';
import { extractVideoScreenTextOnDemand } from '../../services/ai/aiVideoEngine';
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
  loadCachedOnDeviceFaceClusters,
  runOnDeviceFacePassportScan,
  saveCachedOnDeviceFaceClusters,
} from '../../services/ai/onDeviceFacePassportEngine';
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
  hydrateCachedPhotoVectorsLightweight,
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
  loadGhostPassportBook,
  loadGhostSecretaryState,
  saveGhostSecretaryState,
} from '../../services/ghostSecretaryEngine';
import { reconcileCloudPassportsWithFaceClusters } from '../../services/ghostPassportSync';
import {
  PASSPORT_REG_STATE_EVENT,
  loadPassportRegState,
  notifyPassportFaceScanFinished,
  savePassportRegState,
} from '../../services/passportRegistrationFlow';
import {
  DesktopTab,
  INITIAL_ONBOARDING_PROGRESS,
  MobileTab,
  SEASON_TO_MONTH_SYNONYM_INDEX,
  ViewportLayout,
  buildAutoMultiConditionSeedClusters,
  buildBidirectionalStickKeywords,
  buildYearEquivalenceTokens,
  deriveLoungeProperNounTokens,
  getActivePersonaForCluster,
  isMobileOrStoreRuntime,
  isSharedPhotoLounge,
  quarantineFailureToast,
  quarantineResultNote,
  requestQuarantineOp,
  filterPhotosByClubFeedTrack,
  filterVisibleGalleryPhotos,
  resolveLoungePhotoCorpus,
  resolveViewportLayout,
  restoreAllExcludedCustomFaceRegistrations,
  saveCustomFaceRegistration,
  storeSharedRefs,
  voiceSession,
} from './storeSharedRefs';
import type { SaySeeStore } from '../useSaySeeStore';


/**
 * [1번 창: 🎯 [1귀신] 전담 스토어 Slice]
 * - 귀신비서(정리·손보기·브리핑) + 웹/모바일 온보딩 + 레이아웃/스토어 클린 모드 상태
 */
export interface AssistantOnboardingSlice {
  // 레이아웃 & 테마 (Warm Light Theme '#F8F7F4' 기본값 고정 + 우상단 ☀️/🌙 토글 지원)
  layout: ViewportLayout;
  mobileTab: MobileTab;
  desktopTab: DesktopTab;
  setLayout: (layout: ViewportLayout) => void;
  setMobileTab: (tab: MobileTab) => void;
  setDesktopTab: (tab: DesktopTab) => void;


  // 데이터셋 & 인덱싱 상태
  photos: PhotoItem[];
  duplicateGroups: DuplicateGroup[];
  initialized: boolean;
  initializing: boolean;
  mobileGalleryScanning: boolean;
  mobileGalleryPermissionDenied: boolean;
  mobileGalleryLimitedAccess: boolean;
  initApp: (force?: boolean) => Promise<void>;
  syncMobileNativeGalleryAuto: (options?: {
    promptPermission?: boolean;
    maxTargetCount?: number;
    forceExpandSelected?: boolean;
  }) => Promise<void>;
  importMobileLocalPhotos: (
    files: FileList | File[],
    options?: { skipSearchResultsUpdate?: boolean }
  ) => Promise<void>;

  // 100% 로컬 팩트 기반 문장형 추천 칩 (외부 LLM 의존도 0%)
  conceptLexiconCount: number;
  sentenceChips: LocalSentenceChip[];
  sentenceChipPage: number;
  cycleSentenceChips: () => void;
  onboardingAhaItems: OnboardingAhaItem[];
  applyAhaRecommendation: (item: OnboardingAhaItem) => Promise<void>;

  // 체험판 1분 고속 스캔 (Track A: 내 PC 직접 구동 + QR 페어링 vs Track B: 클라우드 GPU 서버 무료 대여)
  showOnboarding: boolean;
  onboardingRunning: boolean;
  onboardingUseRealGpu: boolean;
  onboardingTargetCount: number;
  onboardingTrackMode: OnboardingTrackMode;
  pcAgentPairedMobile: boolean;
  onboardingProgress: OnboardingProgressUpdate;
  setShowOnboarding: (show: boolean) => void;
  setOnboardingUseRealGpu: (real: boolean) => void;
  setOnboardingTargetCount: (count: number) => void;
  setOnboardingTrackMode: (mode: OnboardingTrackMode) => void;
  setPcAgentPairedMobile: (paired: boolean) => void;
  startOnboardingIndexing: () => Promise<void>;
  cancelOnboardingIndexing: () => void;


  // [스펙 2] Z몬스터 정리 4대 탭 & 바둑판 Pick UI & 3중 타임머신 안전망 (Undo)
  selectedTrashIds: Set<string>;
  activeTrashCategoryFilter: TrashCategory | 'all' | 'none';
  quarantineMoving: boolean;
  quarantineOpKind: 'idle' | 'move' | 'restore';
  quarantineRestoreScope: 'idle' | 'single' | 'all' | 'undo';
  quarantineRestoringIds: string[];
  lastQuarantineToast: string | null;
  lastUndoBatch: UndoQuarantineBatch | null;
  setActiveTrashCategoryFilter: (cat: TrashCategory | 'all' | 'none') => void;
  toggleTrashSelection: (id: string) => void;
  selectAllTrashInFilter: () => void;
  clearTrashSelection: () => void;
  pickBestInDuplicateGroup: (
    groupId: string,
    keepPhotoId: string,
    quarantineRestImmediately?: boolean
  ) => Promise<void>;
  pickBestInBurstPhotos: (
    burstPhotos: PhotoItem[],
    keepPhotoId: string
  ) => Promise<void>;
  moveSelectedToQuarantine: () => Promise<void>;
  moveAllTrashToQuarantine: () => Promise<void>;
  restoreFromQuarantine: (names: string[], scope?: 'single' | 'all' | 'undo') => Promise<void>;
  syncPhotosAfterExternalRestore: (
    names: string[],
    replacedIds?: Record<string, string>,
    customToast?: string
  ) => void;
  undoLastQuarantine: () => Promise<void>;
  dismissUndoBatch: () => void;
  openLocalFolder: (
    target: 'quarantine' | 'photos' | 'docs' | 'videos' | 'phone_backup',
    targetPath?: string
  ) => Promise<void>;
  dismissQuarantineToast: () => void;
  showToast: (msg: string) => void;

  /** 스토어 1차 심사용 모바일 클린 모드 (인앱결제 수수료 방어 & 순수 무료 라운지 뷰어 모드) */
  isStoreAppMode: boolean;
  /** 1차 앱스토어 심사 통과를 위해 모바일 스토어 모드(isStoreAppMode===true)에서 설정몬스터와 상단 크레딧 잔액을 잠시 숨길 수 있는 제어 토글 */
  enableSetupMonster: boolean;
  /** 추후 AI 설정몬스터 정식 개통 시 스토어 재심사 없이 git push만으로 코인 잔액 UI를 켤 수 있는 플래그 (기본값 false) */
  enableMobileCoinDisplay: boolean;
  /** 앱 내 코인 잔액 표시 여부 (기본값 false: !isStoreAppMode ? enableMobileCoinDisplay : enableMobileCoinDisplay) */
  showCoinBalanceInApp: boolean;
  /** 스토어 심사 기간에 PC 연동 가이드 공유 버튼 노출 여부를 켜고 끌 수 있는 원격 토글 스위치 (기본값 true) */
  enablePcGuideShareButton: boolean;
  /** 전송된 링크(/?master=pc)를 모바일 OS(iOS/Android)에서 열었을 때 결제/요금 안내 없이 순수 'PC 데스크톱 엔진 기능 소개 화면'만 띄우는 이중 방어 모달 상태 */
  showMobileMasterPcIntroModal: boolean;
  setIsStoreAppMode: (isStoreAppMode: boolean) => void;
  setEnableSetupMonster: (enable: boolean) => void;
  setEnableMobileCoinDisplay: (enable: boolean) => void;
  setEnablePcGuideShareButton: (enable: boolean) => void;
  setShowMobileMasterPcIntroModal: (show: boolean) => void;

  // [🛠️ 설정몬스터 (AI 스마트폰 & PC 통합 설정 해결사)]
  showSetupMonsterModal: boolean;
  setupMonsterPlatform: SetupMonsterPlatform;
  setupProactiveHints: SetupProactiveHint[];
  setupChatTurns: SetupChatTurn[];
  setupAuditLogs: SetupAuditLogEntry[];
  setupFailureTelemetryQueue: SetupFailureTelemetryEntry[];
  setupSelfHealingOtaQueue: SetupSelfHealingOtaEntry[];
  pendingTriageQuestion: SetupPreTriageQuestion | null;
  setupEscrowHoldingCoins: number;
  merlinCoinTopupBridge: MerlinCoinTopupBridgeState;
  activeOverlayPlan: SetupDiagnosisPlan | null;
  activeOverlayStepIndex: number;
  activeOverlayBacktrackCount: number;
  uiFontScalePercent: number;
  uiNightEyeProtection: boolean;
  setShowSetupMonsterModal: (show: boolean, platform?: SetupMonsterPlatform) => void;
  setSetupMonsterPlatform: (platform: SetupMonsterPlatform) => void;
  setSimulatedMerlinCoinBalance: (coins: number) => void;
  openMerlinCoinTopupBridge: (plan: SetupDiagnosisPlan) => void;
  closeMerlinCoinTopupBridge: () => void;
  topupMerlinCoinAndStartEscrowRepair: (topupAmount?: number) => Promise<void>;
  confirmSetupEscrowSettlement: (auditId?: string) => void;
  loadSetupMonsterState: () => Promise<void>;
  submitSetupMonsterQuery: (
    query: string,
    presetIdHint?: string,
    platformOverride?: SetupMonsterPlatform
  ) => Promise<void>;
  answerSetupPreTriage: (
    questionId: string,
    detailAnswer: string,
    presetId: string,
    skipDirectQuote?: boolean
  ) => Promise<void>;
  approveAndExecuteSetupPlan: (
    plan: SetupDiagnosisPlan,
    simulatedBacktrackCount?: number
  ) => Promise<void>;
  triggerEmpathyRefundForCompletedRepair: (
    auditId?: string,
    backtrackCount?: number
  ) => Promise<void>;
  undoSetupMonsterRepair: (auditId?: string) => Promise<void>;
  reportUnresolvedAndRefundSetup: (
    auditId?: string,
    errorCode?: string
  ) => Promise<void>;
  openSetupOverlayGuide: (plan: SetupDiagnosisPlan) => void;
  recordOverlayBacktrack: () => void;
  advanceSetupOverlayStep: () => void;
  closeSetupOverlayGuide: () => void;
}

let pendingMobileGalleryResync = false;
let quarantineMutationEpoch = 0;
const recentlyQuarantinedAtById = new Map<string, number>();
let zCoreQuarantineChain: Promise<unknown> = Promise.resolve();

function enqueueZCoreQuarantineOp<T>(fn: () => Promise<T>): Promise<T> {
  const next = zCoreQuarantineChain.then(fn, fn);
  zCoreQuarantineChain = next.catch(() => undefined);
  return next;
}

function buildQuarantineMoveStatePatch(opts: {
  state: SaySeeStore;
  movedSet: Set<string>;
  newlyKeptIds?: Set<string>;
  savedBytes: number;
  demo: boolean;
  actionLabel: string;
  nonIosToast: string;
  clearSelectedBurstModal?: boolean;
}): Partial<SaySeeStore> {
  const {
    state,
    movedSet,
    newlyKeptIds,
    savedBytes,
    demo,
    actionLabel,
    nonIosToast,
    clearSelectedBurstModal,
  } = opts;
  quarantineMutationEpoch += 1;
  pendingMobileGalleryResync = false;
  const moveNow = Date.now();
  movedSet.forEach((id) => recentlyQuarantinedAtById.set(id, moveNow));
  const isIosNativeApp = !zCoreBridge.isConnected && isCapacitorIosRuntime();
  const prevTrashById = new Map(state.photos.map((p) => [p.id, p.trashCategory]));
  const afterMovePhotos = state.photos.map((p) => {
    if (!movedSet.has(p.id)) {
      if (newlyKeptIds?.has(p.id)) {
        return {
          ...p,
          isBestInDuplicateGroup: true,
          userKeptAsBest: true,
          trashCategory: undefined,
          trashConfidence: undefined,
        };
      }
      return p;
    }
    const isZCorePhoto = p.thumbUrl.includes('/__photos/file');
    return {
      ...p,
      quarantined: true,
      lastDuplicateGroupId: p.lastDuplicateGroupId || p.duplicateGroupId,
      thumbUrl: isZCorePhoto
        ? getZCoreUrl(`/__photos/file?p=${encodeURIComponent(p.name)}&loc=quarantine&thumb=1`)
        : p.thumbUrl,
      fullUrl: isZCorePhoto
        ? getZCoreUrl(`/__photos/file?p=${encodeURIComponent(p.name)}&loc=quarantine`)
        : p.fullUrl,
    };
  });
  // [세트 경계 불변 정공법]: 정리 시 전체 사진을 처음부터 다시 클러스터링하지 않고 해당 세트에서만 버린 사진을 O(N) 제거!
  const { updatedPhotos, duplicateGroups: nextDupGroups } =
    pruneQuarantinedFromDuplicateGroups(afterMovePhotos, state.duplicateGroups, newlyKeptIds);
  const cleanedSelected = new Set<string>(state.selectedTrashIds);
  movedSet.forEach((id) => cleanedSelected.delete(id));
  updatedPhotos.forEach((p) => {
    if (!p.quarantined && p.trashCategory && !prevTrashById.get(p.id)) {
      cleanedSelected.add(p.id);
    }
  });
  const nextFilter =
    state.activeTrashCategoryFilter === 'duplicate' && nextDupGroups.length === 0
      ? updatedPhotos.some((p) => !p.quarantined && p.trashCategory === 'blurry')
        ? 'blurry'
        : updatedPhotos.some((p) => !p.quarantined && p.trashCategory === 'screenshot')
        ? 'screenshot'
        : updatedPhotos.some((p) => !p.quarantined && p.trashCategory === 'memo')
        ? 'memo'
        : state.activeTrashCategoryFilter
      : state.activeTrashCategoryFilter;

  return {
    photos: updatedPhotos,
    duplicateGroups: nextDupGroups,
    activeTrashCategoryFilter: nextFilter,
    searchResults: state.searchResults.filter((r) => !movedSet.has(r.photo.id)),
    selectedTrashIds: cleanedSelected,
    ...(clearSelectedBurstModal ? { selectedPhoto: null, selectedBurstGroup: null } : {}),
    quarantineMoving: false,
    quarantineOpKind: 'idle',
    freeTrialUsed: true,
    lastUndoBatch: isIosNativeApp
      ? null
      : {
          fileNames: Array.from(movedSet),
          actionLabel,
          count: movedSet.size,
          savedBytes,
          timestamp: Date.now(),
          demo,
        },
    lastQuarantineToast: isIosNativeApp
      ? `사진 ${movedSet.size}장을 ‘최근 삭제된 항목’으로 옮겼습니다. (30일 보관)\n복원은 아이폰 사진 앱 › 최근 삭제된 항목에서 가능합니다.`
      : nonIosToast,
  };
}

export const createAssistantOnboardingSlice: StateCreator<
  SaySeeStore,
  [],
  [],
  AssistantOnboardingSlice
> = (set, get) => ({
  layout: resolveViewportLayout(),
  mobileTab: 'trash',
  desktopTab: 'trash',
  setLayout: (layout) => set({ layout }),
  setMobileTab: (mobileTab) => {
    set({
      mobileTab,
      desktopTab:
        mobileTab === 'trial'
          ? 'trial'
          : mobileTab === 'search'
          ? 'dashboard'
          : mobileTab === 'trash'
          ? 'trash'
          : mobileTab === 'share'
          ? 'share'
          : 'sync',
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  },
  setDesktopTab: (desktopTab) => {
    set({
      desktopTab,
      mobileTab:
        desktopTab === 'trial'
          ? 'trial'
          : desktopTab === 'dashboard'
          ? 'search'
          : desktopTab === 'trash'
          ? 'trash'
          : desktopTab === 'share'
          ? 'share'
          : 'settings',
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  },


  photos: [],
  duplicateGroups: [],
  initialized: false,
  initializing: false,
  mobileGalleryScanning: false,
  mobileGalleryPermissionDenied: false,
  mobileGalleryLimitedAccess: false,

  conceptLexiconCount: TOTAL_CONCEPT_ANCHOR_COUNT,
  sentenceChips: [],
  sentenceChipPage: 0,
  onboardingAhaItems: [],

  cycleSentenceChips: () => {
    set((state) => ({
      sentenceChipPage: state.sentenceChipPage === 0 ? 1 : 0,
    }));
  },

  initApp: async (force?: boolean) => {
    if (!force && (get().initialized || get().initializing)) return;
    set({ initializing: true });

    const isStandaloneSearchWin =
      typeof window !== 'undefined' &&
      Boolean(new URLSearchParams(window.location.search).get('ghostSearchWindow')) &&
      (() => {
        try {
          return window.self === window.top;
        } catch {
          return false;
        }
      })();

    // 데스크톱(본 웹 화면 + 독립 귀신검색창 공통) 첫 기동·새로고침 시 헬스체크 응답 전에 빈 상태(0장)로 1차 initApp() 후
    // 재연결 2차 initApp(true)가 이중 실행되어 화면이 멈추거나 깜빡이는 현상을 원천 차단합니다.
    if (!isCapacitorNativeMobileRuntime() && !zCoreBridge.isConnected) {
      await Promise.race([
        zCoreBridge.checkHealth(true),
        new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 950)),
      ]);
    }

    const urlQueryEarly =
      typeof window !== 'undefined'
        ? (new URLSearchParams(window.location.search).get('q') || '').trim()
        : '';
    const photoDatasetPromise = loadInitialPhotoDataset();
    if (isStandaloneSearchWin && !urlQueryEarly && !get().hasExecutedUserSearch) {
      void photoDatasetPromise
        .then((earlyDataset) => {
          const curSt = get();
          if (curSt.initialized || earlyDataset.photos.length === 0) return;
          const earlyGalleryResults = filterVisibleGalleryPhotos(earlyDataset.photos).map(
            (photo) => ({
              photo,
              score: 0.95,
              matchPercentage: 97,
              matchedBy: 'text-direct'as const,
            })
          );
          set({
            photos: earlyDataset.photos,
            duplicateGroups: earlyDataset.duplicateGroups,
            searchResults: earlyGalleryResults,
            activeQuery: `전체 갤러리 사진 (${earlyGalleryResults.length}장)`,
            initialized: true,
          });
        })
        .catch(() => {});
    }

    const rawTelemetryPromise = isStandaloneSearchWin ? Promise.resolve(null) : detectHardwareTelemetry();
    const rawHostSharedPromise = isStandaloneSearchWin ? Promise.resolve([] as PhotoItem[]) : fetchSharedFamilyHostPhotos();

    const [dataset, telemetry, indexedDocs, indexedVideos, faceData, hostSharedPhotos] = await Promise.all([
      photoDatasetPromise,
      Promise.race([
        rawTelemetryPromise,
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 700)),
      ]),
      fetchIndexedDocuments(),
      fetchIndexedVideos(),
      fetchAutonomousFaceClusters(),
      Promise.race([
        rawHostSharedPromise,
        new Promise<PhotoItem[]>((resolve) => window.setTimeout(() => resolve([]), 700)),
      ]),
    ]);

    // 원격 공유방 사진이나 하드웨어 텔레메트리가 700ms보다 늦게 도착하더라도 로컬 사진 첫 화면을 막지 않고 뒤에서 조용히 보강
    void rawTelemetryPromise
      .then((lateTel) => {
        if (lateTel && !get().telemetry) {
          set({ telemetry: { ...lateTel, lastQueryMs: 0.4 } });
        }
      })
      .catch(() => {});
    void rawHostSharedPromise
      .then((lateShared) => {
        if (Array.isArray(lateShared) && lateShared.length > 0 && get().sharedRoomHostPhotos.length === 0) {
          set({ sharedRoomHostPhotos: lateShared });
        }
      })
      .catch(() => {});

    const cachedOnDeviceFaces = loadCachedOnDeviceFaceClusters();
    const hasOnDeviceCache = cachedOnDeviceFaces.clusters.length > 0;
    const rawFaceClusters = hasOnDeviceCache
      ? cachedOnDeviceFaces.clusters
      : faceData.clusters;
    const effectiveLatestYear = hasOnDeviceCache
      ? cachedOnDeviceFaces.latestCorpusYear
      : faceData.latestCorpusYear;
    const cloudReconciled = reconcileCloudPassportsWithFaceClusters(rawFaceClusters);
    const passportBookInit = loadGhostPassportBook();
    const regStateInit = loadPassportRegState();
    const selfAliasInit = (passportBookInit.self?.nickname || loadGhostSecretaryState().nickname || '').trim();
    const selfRealInit = (passportBookInit.self?.realName || '').trim();
    const effectiveSelfIdInit = cloudReconciled.matchedSelfClusterId || regStateInit.selfClusterId;
    if (cloudReconciled.matchedSelfClusterId && !regStateInit.selfClusterId) {
      savePassportRegState({ ...regStateInit, selfClusterId: cloudReconciled.matchedSelfClusterId });
    }
    const autoMultiClusters = buildAutoMultiConditionSeedClusters(cloudReconciled.clusters).map((fc) => {
      if (effectiveSelfIdInit && fc.clusterId === effectiveSelfIdInit && selfAliasInit) {
        return {
          ...fc,
          registeredName: fc.registeredName || selfRealInit || selfAliasInit,
          roomPersonas: {
            ...(fc.roomPersonas || {}),
            ...(selfRealInit ? { 우리집: selfRealInit } : {}),
            personal: selfAliasInit,
          },
        };
      }
      return fc;
    });

    const totalBytes = dataset.photos.reduce((a, p) => a + p.size, 0);
    const syncState = loadSyncState(dataset.photos.length, totalBytes);

    // 이미 등록된 얼굴 멤버 실명 및 방별 별명(Room Persona)이 있다면 로컬 사진 태그 뒤쪽에 동기화 (장면 대표 태그 p.tags[0] 보존)
    const memberTagsByPhoto = new Map<string, string[]>();
    for (const fc of autoMultiClusters) {
      if (fc.excludedAsPasserby) continue;
      const cleanName = (fc.registeredName || '').trim();
      const personaValues = Object.values(fc.roomPersonas ?? {})
        .map((v) => (v || '').trim())
        .filter(Boolean);
      const allMemberNames = Array.from(new Set([cleanName, ...personaValues].filter(Boolean)));
      if (allMemberNames.length === 0) continue;
      const tagsForCluster = allMemberNames.map((n) => `#${n}`);
      for (const fName of fc.matchedPhotoFiles ?? []) {
        const prev = memberTagsByPhoto.get(fName) ?? [];
        memberTagsByPhoto.set(fName, Array.from(new Set([...prev, ...tagsForCluster])));
      }
    }

    const existingMobilePicked = !zCoreBridge.isConnected ? get().photos : [];
    const existingMobileVideos = !zCoreBridge.isConnected ? get().videoSceneItems : [];
    const baseDatasetPhotos =
      dataset.photos.length > 0 ? dataset.photos : existingMobilePicked;
    const baseDatasetVideos =
      indexedVideos.length > 0 ? indexedVideos : existingMobileVideos;

    let enrichedPhotos = baseDatasetPhotos.map((p) => {
      const extraTags = memberTagsByPhoto.get(p.name);
      if (!extraTags || extraTags.length === 0) return p;
      return {
        ...p,
        tags: Array.from(new Set([...p.tags, ...extraTags])),
      };
    });

    // [새로고침(F5) 가짜 4세트 ➔ 진짜 56세트 두 번 깜빡임 원천 제거]:
    // IndexedDB에 캐시된 광학 해시(dHash·선명도)를 첫 화면 렌더링 직전에 0.01초 만에 입혀,
    // 파일명 기준 임시 사진이 잠깐 떴다 사라지는 현상 없이 처음부터 최종 정리 후보 세트를 바로 표시합니다.
    let initialDuplicateGroups = dataset.duplicateGroups;
    let uncachedOpticalCount = enrichedPhotos.length;
    if (
      !isCapacitorNativeMobileRuntime() &&
      zCoreBridge.isConnected &&
      !isStandaloneSearchWin &&
      enrichedPhotos.length > 0
    ) {
      try {
        const instantAudit = await applyCachedPcOpticalAuditInstant(enrichedPhotos);
        enrichedPhotos = instantAudit.updatedPhotos;
        initialDuplicateGroups = instantAudit.duplicateGroups;
        uncachedOpticalCount = instantAudit.uncachedCount;
      } catch {
        /* fallback to background audit */
      }
    }

    const localChips = buildLocalSentenceSamplesFromCorpus(enrichedPhotos);
    const fallbackThumb = enrichedPhotos[0]?.thumbUrl || '';
    const localAhaItems: OnboardingAhaItem[] = localChips.slice(0, 4).map((chip) => ({
      photoId: chip.id,
      thumbUrl: chip.thumbUrl || fallbackThumb,
      dateFact: chip.matchHint,
      domainTitle: chip.factFormula,
      sentence: chip.query,
      shortChip: chip.factFormula.split('+')[0].trim(),
      targetSearchQuery: chip.query,
    }));

    const trashIds = new Set<string>(
      enrichedPhotos.filter((p) => p.trashCategory && !p.quarantined).map((p) => p.id)
    );

    const activeLoungeNow = get().activeLoungeType;
    const activeFamilyRoomNow = get().activeFamilyRoom;
    const sharedModeNow = isSharedPhotoLounge(activeLoungeNow);
    const addedSharedNow = get().sharedRoomAddedPhotos;
    const gallerySourceCorpus = resolveLoungePhotoCorpus({
      activeLoungeType: activeLoungeNow,
      activeFamilyRoom: activeFamilyRoomNow,
      photos: enrichedPhotos,
      sharedRoomHostPhotos: hostSharedPhotos,
      sharedRoomAddedPhotos: addedSharedNow,
    });
    const initialVaultPhotos = sharedModeNow
      ? []
      : enrichedPhotos
          .filter((p) => !p.quarantined && p.isVaultDocument)
          .map((photo) => ({
            photo,
            score: 0.96,
            matchPercentage: 98,
            matchedBy: 'text-direct'as const,
          }));
    const initialGalleryPhotos = filterPhotosByClubFeedTrack(
      filterVisibleGalleryPhotos(gallerySourceCorpus),
      activeLoungeNow,
      get().clubFeedTrack
    ).map((photo) => ({
      photo,
      score: 0.95,
      matchPercentage: 97,
      matchedBy: 'text-direct'as const,
    }));
    const effectiveInitialDocs = sharedModeNow ? [] : indexedDocs;
    const effectiveInitialVideos = sharedModeNow ? [] : baseDatasetVideos;
    const totalFrames = effectiveInitialVideos.reduce((a, v) => a + v.timelineFrames.length, 0);

    const currentSearchSpace = get().searchSpace;
    const currentHasUserSelectedSearchTab = get().hasUserSelectedSearchTab;
    const currentHasExecutedUserSearch = get().hasExecutedUserSearch;
    const preservedQuery = currentHasExecutedUserSearch ? (get().activeQuery || '').trim() : '';
    const urlQuery =
      typeof window !== 'undefined'
        ? (new URLSearchParams(window.location.search).get('q') || '').trim()
        : '';
    const queryToReRun = preservedQuery || urlQuery;
    const shouldPreRunQuery = Boolean(
      queryToReRun &&
        !queryToReRun.startsWith('전체 갤러리 사진') &&
        !queryToReRun.startsWith('동영상 ') &&
        !queryToReRun.startsWith('최근 서류 ')
    );

    if (shouldPreRunQuery) {
      // [검색 결과 깜빡임(350 ➔ 36) 원천 차단]: URL(?q=...) 또는 기존 검색어가 활성 상태일 때
      // 전체 갤러리(350장)나 전체 문서(224건) 카운트를 중간에 노출하지 않고,
      // 원본 코퍼스만 먼저 적재한 뒤 곧바로 runTextQuery를 완료하고 initialized: true로 전환!
      set({
        photos: enrichedPhotos,
        sharedRoomHostPhotos: hostSharedPhotos,
        duplicateGroups: initialDuplicateGroups,
        localDocuments: indexedDocs,
        videoSceneItems: baseDatasetVideos,
        faceClusters: autoMultiClusters,
        latestCorpusYear: effectiveLatestYear,
        onboardingProgress: {
          ...INITIAL_ONBOARDING_PROGRESS,
          currentPhotoThumb: fallbackThumb,
        },
        telemetry: telemetry ? { ...telemetry, lastQueryMs: 0.4 } : null,
        syncState,
        sentenceChips: localChips,
        onboardingAhaItems: localAhaItems,
        selectedTrashIds: trashIds,
      });
      await get().runTextQuery(queryToReRun);
      set({
        initialized: true,
        initializing: false,
      });
    } else {
      set((latestState) => {
        const latestLounge = latestState.activeLoungeType;
        const latestFamilyRoom = latestState.activeFamilyRoom;
        const latestSharedMode = isSharedPhotoLounge(latestLounge);
        const latestCorpus = resolveLoungePhotoCorpus({
          activeLoungeType: latestLounge,
          activeFamilyRoom: latestFamilyRoom,
          photos: enrichedPhotos,
          sharedRoomHostPhotos: hostSharedPhotos,
          sharedRoomAddedPhotos: latestState.sharedRoomAddedPhotos,
        });
        const latestGalleryResults = filterPhotosByClubFeedTrack(
          filterVisibleGalleryPhotos(latestCorpus),
          latestLounge,
          latestState.clubFeedTrack
        ).map((photo) => ({
          photo,
          score: 0.95,
          matchPercentage: 97,
          matchedBy: 'text-direct'as const,
        }));
        const preserveExistingSharedResults =
          latestSharedMode &&
          latestGalleryResults.length === 0 &&
          latestState.searchResults.length > 0 &&
          latestState.searchResults.every((sr) => String(sr.photo.id || '').startsWith('shared_'));

        return {
          photos: enrichedPhotos,
          sharedRoomHostPhotos: hostSharedPhotos,
          duplicateGroups: initialDuplicateGroups,
          activeTrashCategoryFilter:
            initialDuplicateGroups.length > 0
              ? 'duplicate'
              : enrichedPhotos.some((p) => p.trashCategory === 'blurry' && !p.quarantined)
              ? 'blurry'
              : latestState.activeTrashCategoryFilter,
          localDocuments: indexedDocs,
          matchedLocalDocs: latestSharedMode ? [] : effectiveInitialDocs,
          matchedVaultPhotos: latestSharedMode ? [] : initialVaultPhotos,
          videoSceneItems: baseDatasetVideos,
          matchedVideoScenes: latestSharedMode ? [] : effectiveInitialVideos,
          faceClusters: autoMultiClusters,
          latestCorpusYear: faceData.latestCorpusYear,
          onboardingProgress: {
            ...INITIAL_ONBOARDING_PROGRESS,
            currentPhotoThumb: fallbackThumb,
          },
          telemetry: telemetry ? { ...telemetry, lastQueryMs: 0.4 } : null,
          syncState,
          sentenceChips: localChips,
          onboardingAhaItems: localAhaItems,
          // 유저가 이미 동영상이나 문서 탭을 클릭해 탐색 중이거나 검색한 경우, 백그라운드 재인덱싱/Z코어 재연결 시 사진(gallery) 탭으로 강제 롤백되는 현상을 원천 방지
          searchSpace: currentHasUserSelectedSearchTab ? currentSearchSpace : 'gallery',
          hasExecutedUserSearch: currentHasExecutedUserSearch,
          hasUserSelectedSearchTab: currentHasUserSelectedSearchTab,
          activeQuery: currentHasExecutedUserSearch
            ? latestState.activeQuery
            : latestSharedMode
            ? latestState.activeQuery || `공유 앨범 (${latestGalleryResults.length}장)`
            : currentSearchSpace === 'video' && currentHasUserSelectedSearchTab
            ? `동영상 ${indexedVideos.length}개 전 구간(총 ${totalFrames}개 타임라인 프레임) 자동 해부`
            : currentSearchSpace === 'vault' && currentHasUserSelectedSearchTab
            ? `최근 서류 ${indexedDocs.length + initialVaultPhotos.length}건 통합 (로컬 문서 ${indexedDocs.length}건 + 촬영 서류 ${initialVaultPhotos.length}장)`
            : `전체 갤러리 사진 (${latestGalleryResults.length}장)`,
          matchedTags: currentHasExecutedUserSearch
            ? latestState.matchedTags
            : currentSearchSpace === 'video' && currentHasUserSelectedSearchTab
            ? ['#동영상전구간해부', '#타임라인점프재생', '#자율비전인덱싱']
            : currentSearchSpace === 'vault' && currentHasUserSelectedSearchTab
            ? ['#스마트서류함', '#문서·설명서', '#문서·신분증', '#PDF통합검색']
            : ['#전체갤러리', '#자율얼굴검출', '#의미검색'],
          searchResults: preserveExistingSharedResults
            ? latestState.searchResults
            : latestGalleryResults,
          selectedTrashIds: trashIds,
          initialized: true,
          initializing: false,
        };
      });
    }

    // [3대 AI/이미지 백그라운드 파이프라인 완전 직렬화 (Chrome 1.9GB RAM·CPU 동시 폭주 원천 차단)]:
    // Stage 1: 광학 감사(dHash/흔들림) ➔ Stage 2: 온디바이스 얼굴 여권(YuNet+SFace, 완료 즉시 워커 terminate)
    // ➔ Stage 3: 백그라운드 비전/OCR 768D 인덱싱(120장 배치, 완료 후 워커 terminate) 순으로 1개씩만 순차 실행합니다.
    const runFacePassportStage = async (): Promise<void> => {
      if (isStandaloneSearchWin || typeof window === 'undefined' || enrichedPhotos.length === 0) return;
      try {
        const stNow = get();
        const livePhotos = stNow.photos.length > 0 ? stNow.photos : enrichedPhotos;
        if (livePhotos.length === 0) return;
        const applyScannedClusters = (clusters: FaceMemberCluster[], latestYear: number) => {
          if (clusters.length === 0) return;
          const reconciled = reconcileCloudPassportsWithFaceClusters(clusters);
          const bookNow = loadGhostPassportBook();
          const regNow = loadPassportRegState();
          const selfAlias = (bookNow.self?.nickname || loadGhostSecretaryState().nickname || '').trim();
          const selfReal = (bookNow.self?.realName || '').trim();
          const selfIdNow = reconciled.matchedSelfClusterId || regNow.selfClusterId;
          if (reconciled.matchedSelfClusterId && !regNow.selfClusterId) {
            savePassportRegState({ ...regNow, selfClusterId: reconciled.matchedSelfClusterId });
          }
          const enrichedClusters = buildAutoMultiConditionSeedClusters(reconciled.clusters).map((fc) => {
            if (selfIdNow && fc.clusterId === selfIdNow && selfAlias) {
              return {
                ...fc,
                registeredName: fc.registeredName || selfReal || selfAlias,
                roomPersonas: {
                  ...(fc.roomPersonas || {}),
                  ...(selfReal ? { 우리집: selfReal } : {}),
                  personal: selfAlias,
                },
              };
            }
            return fc;
          });
          if (reconciled.newlyMatchedNames.length > 0) {
            saveCachedOnDeviceFaceClusters(enrichedClusters, latestYear);
          }

          // 스캔 완료 또는 클라우드 여권 매칭으로 새로 편입된 사진에도 즉시 #실명·#별명 태그 동기화
          const tagMap = new Map<string, string[]>();
          for (const fc of enrichedClusters) {
            if (fc.excludedAsPasserby) continue;
            const namesForFc = Array.from(
              new Set([fc.registeredName, ...Object.values(fc.roomPersonas || {})].map((s) => (s || '').trim()).filter(Boolean))
            );
            if (namesForFc.length === 0) continue;
            const tagsForFc = namesForFc.map((n) => `#${n}`);
            for (const fName of fc.matchedPhotoFiles || []) {
              const prev = tagMap.get(fName) || [];
              tagMap.set(fName, Array.from(new Set([...prev, ...tagsForFc])));
            }
          }
          const curPhotosNow = get().photos;
          const nextPhotosNow =
            tagMap.size > 0
              ? curPhotosNow.map((p) => {
                  const extra = tagMap.get(p.name);
                  return extra && extra.length > 0 ? { ...p, tags: Array.from(new Set([...p.tags, ...extra])) } : p;
                })
              : curPhotosNow;

          set({
            faceClusters: enrichedClusters,
            photos: nextPhotosNow,
            latestCorpusYear: latestYear,
          });
          try {
            window.dispatchEvent(new Event(PASSPORT_REG_STATE_EVENT));
          } catch {
            /* ignore */
          }
        };
        const scanned = await runOnDeviceFacePassportScan(
          livePhotos,
          stNow.faceClusters,
          false,
          // 초기 부분 스캔(20~40장) 결과로 여권 패널이 먼저 열려 가족 일부만 노출되는 레이스를 막기 위해 완주 후 일괄 반영
          undefined
        );
        applyScannedClusters(scanned.clusters, scanned.latestCorpusYear);
      } catch {
        /* ignore face scan errors */
      } finally {
        notifyPassportFaceScanFinished();
      }
    };

    // [의미 검색 엔진 준비 & 실사용 PC 미디어 무소음 비전 인덱싱]
    // 데스크톱에서 Z-코어가 연결되면 내 PC 실제 동영상 키프레임 및 실사진의 768차원 비전 벡터를 조용히 인덱싱·캐싱합니다.
    try {
      const hasVectors = enrichedPhotos.some((p) => p.vec && p.vec.length > 0);
      const isMobileUA =
        typeof navigator !== 'undefined' &&
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      const saveData = typeof navigator !== 'undefined' && (navigator as any).connection?.saveData === true;
      if (!isMobileUA && !saveData && typeof window !== 'undefined') {
        if (zCoreBridge.isConnected) {
          if (isStandaloneSearchWin) {
            // [독립 귀신검색창(?ghostSearchWindow) 초반 무렉 경량 부팅]:
            // 본 창이 색인해 둔 IndexedDB 768D 벡터 캐시 및 광학 연사 클러스터(duplicateGroups)를 즉시 복원하여
            // 검색창 썸네일에서도 [❐ N장 연사] 배지와 상세 모달 연사 비교가 0.1초 만에 표시되게 합니다.
            window.setTimeout(async () => {
              try {
                const currentPhotos = get().photos;
                const [vecMap, auditRes] = await Promise.all([
                  hydrateCachedPhotoVectorsLightweight(currentPhotos),
                  auditRealPcPhotosAndCluster(currentPhotos),
                ]);
                const updatedById = new Map<string, PhotoItem>(
                  auditRes.updatedPhotos.map((p) => [p.id, p])
                );
                set((state) => {
                  const nextPhotos = state.photos.map((p) => {
                    const audited = updatedById.get(p.id) || p;
                    const v = vecMap.get(p.id);
                    return v ? { ...audited, vec: v } : audited;
                  });
                  const nextById = new Map<string, PhotoItem>(nextPhotos.map((p) => [p.id, p]));
                  const nextSearchResults =
                    !state.hasExecutedUserSearch && state.activeLoungeType === 'personal'
                      ? filterVisibleGalleryPhotos(nextPhotos).map((photo) => ({
                          photo,
                          score: 0.99,
                          matchPercentage: 99,
                          matchedBy: 'text-direct' as const,
                        }))
                      : state.searchResults.map((sr) => {
                          const refreshed = nextById.get(sr.photo.id);
                          return refreshed ? { ...sr, photo: refreshed } : sr;
                        });
                  return {
                    photos: nextPhotos,
                    duplicateGroups: auditRes.duplicateGroups,
                    searchResults: nextSearchResults,
                  };
                });
              } catch {
                /* ignore */
              }
            }, 220);
          } else {
            // Stage 1 ➔ Stage 2 ➔ Stage 3 순차 직렬 실행 (동시 워커 폭발 0%)
            window.setTimeout(async () => {
              // Stage 1: 미캐시 신규 사진이 남아 있을 때만 광학 dHash·선명도 추가 스캔 수행 (캐시 100% 적중 시 재렌더 0회)
              if (uncachedOpticalCount > 0) {
                try {
                  const currentPhotos = get().photos;
                  const { updatedPhotos, duplicateGroups: realDupGroups } =
                    await auditRealPcPhotosAndCluster(currentPhotos);
                  const nextTrashIds = new Set<string>();
                  updatedPhotos.forEach((p) => {
                    if (p.trashCategory && !p.quarantined) nextTrashIds.add(p.id);
                  });
                  const updatedById = new Map<string, PhotoItem>(
                    updatedPhotos.map((p) => [p.id, p])
                  );
                  set((state) => {
                    const nextSearchResults =
                      !state.hasExecutedUserSearch && state.activeLoungeType === 'personal'
                        ? filterVisibleGalleryPhotos(updatedPhotos).map((photo) => ({
                            photo,
                            score: 0.99,
                            matchPercentage: 99,
                            matchedBy: 'text-direct' as const,
                          }))
                        : state.searchResults.map((sr) => {
                            const refreshed = updatedById.get(sr.photo.id);
                            return refreshed ? { ...sr, photo: refreshed } : sr;
                          });
                    return {
                      photos: updatedPhotos,
                      duplicateGroups: realDupGroups,
                      searchResults: nextSearchResults,
                      selectedTrashIds: nextTrashIds,
                      activeTrashCategoryFilter:
                        realDupGroups.length > 0
                          ? 'duplicate'
                          : updatedPhotos.some((p) => p.trashCategory === 'blurry' && !p.quarantined)
                          ? 'blurry'
                          : state.activeTrashCategoryFilter,
                    };
                  });
                } catch {
                  /* ignore */
                }
              }

              // Stage 2: 온디바이스 얼굴 여권 추출 (YuNet + SFace int8) — 완료 후 워커 terminate로 WASM RAM 즉시 반환
              await new Promise<void>((r) => window.setTimeout(r, 250));
              await runFacePassportStage();

              // Stage 3: 동영상 키프레임 및 실사진 비전 벡터 768D 저부하 인덱싱 (앞 2단계 종료 후 단독 실행)
              await new Promise<void>((r) => window.setTimeout(r, 600));
              const pendingPhotoPatches = new Map<string, Partial<PhotoItem>>();
              let flushTimer = 0;
              const flushPhotoPatches = () => {
                flushTimer = 0;
                if (pendingPhotoPatches.size === 0) return;
                const snap = new Map(pendingPhotoPatches);
                pendingPhotoPatches.clear();
                set((state) => {
                  const nextSel = new Set(state.selectedTrashIds);
                  const nextPhotos = state.photos.map((p) => {
                    const pt = snap.get(p.id);
                    if (!pt) return p;
                    const merged = { ...p, ...pt };
                    if (merged.isVaultDocument) {
                      merged.trashCategory = undefined;
                      merged.intrinsicTrashCategory = undefined;
                      nextSel.delete(p.id);
                    } else if (!p.trashCategory && merged.trashCategory && !merged.quarantined) {
                      nextSel.add(p.id);
                    }
                    return merged;
                  });
                  return {
                    photos: nextPhotos,
                    selectedTrashIds: nextSel,
                    searchResults: state.searchResults.map((sr) => {
                      const pt = snap.get(sr.photo.id);
                      return pt ? { ...sr, photo: { ...sr.photo, ...pt } } : sr;
                    }),
                  };
                });
              };
              try {
                await startSilentRealMediaVisionIndexing({
                  photos: get().photos,
                  videos: get().videoSceneItems,
                  onVideoThumbHydrated: (videoFileName, thumbUrl) => {
                    set((state) => ({
                      videoSceneItems: state.videoSceneItems.map((v) =>
                        v.videoFileName === videoFileName ? { ...v, thumbUrl: v.thumbUrl || thumbUrl } : v
                      ),
                      matchedVideoScenes: state.matchedVideoScenes.map((v) =>
                        v.videoFileName === videoFileName ? { ...v, thumbUrl: v.thumbUrl || thumbUrl } : v
                      ),
                    }));
                  },
                  onVideoOcrHydrated: (videoFileName, ocrMeta) => {
                    set((state) => ({
                      videoSceneItems: state.videoSceneItems.map((v) =>
                        v.videoFileName === videoFileName ? { ...v, ...ocrMeta } : v
                      ),
                      matchedVideoScenes: state.matchedVideoScenes.map((v) =>
                        v.videoFileName === videoFileName ? { ...v, ...ocrMeta } : v
                      ),
                    }));
                  },
                  onPhotoVisionHydrated: (photoId, patch) => {
                    const prev = pendingPhotoPatches.get(photoId);
                    pendingPhotoPatches.set(photoId, prev ? { ...prev, ...patch } : patch);
                    if (!flushTimer) {
                      flushTimer = window.setTimeout(flushPhotoPatches, 380);
                    }
                  },
                });
              } finally {
                if (flushTimer) {
                  window.clearTimeout(flushTimer);
                }
                flushPhotoPatches();
              }
            }, 200);
          }

          // 첫 기동 시 백그라운드 배치 OCR(10개 단위)이 진행 중이면 완료 시점에 최신 배지·텍스트 메타데이터를 자동 동기화
          if (isLocalVideosOcrIndexingPending()) {
            const syncPendingOcrVideos = async (attempt: number) => {
              const refreshed = await fetchIndexedVideos();
              if (refreshed.length > 0) {
                const byFile = new Map(refreshed.map((rv) => [rv.videoFileName, rv]));
                set((state) => ({
                  videoSceneItems: state.videoSceneItems.map((v) => {
                    const fresh = byFile.get(v.videoFileName);
                    return fresh
                      ? {
                          ...v,
                          hasScreenOcrText: fresh.hasScreenOcrText,
                          ocrLineCount: fresh.ocrLineCount,
                          ocrFullText: fresh.ocrFullText,
                          keywords: fresh.keywords,
                          timelineFrames: fresh.timelineFrames,
                        }
                      : v;
                  }),
                  matchedVideoScenes: state.matchedVideoScenes.map((v) => {
                    const fresh = byFile.get(v.videoFileName);
                    return fresh
                      ? {
                          ...v,
                          hasScreenOcrText: fresh.hasScreenOcrText,
                          ocrLineCount: fresh.ocrLineCount,
                          ocrFullText: fresh.ocrFullText,
                          keywords: fresh.keywords,
                          timelineFrames: fresh.timelineFrames,
                        }
                      : v;
                  }),
                }));
              }
              if (attempt < 3 && isLocalVideosOcrIndexingPending()) {
                window.setTimeout(() => {
                  void syncPendingOcrVideos(attempt + 1);
                }, 6000);
              }
            };
            window.setTimeout(() => {
              void syncPendingOcrVideos(1);
            }, 5200);
          }
        } else if (hasVectors) {
          window.setTimeout(() => {
            void ensureTextQueryEncoderLoaded();
          }, 4000);
        }
      }
      if (isCapacitorNativeMobileRuntime() && !zCoreBridge.isConnected && typeof window !== 'undefined') {
        // [모바일 앱 수동 불러오기 전면 폐지 ➔ 자동 갤러리 인덱싱 개통]:
        // 앱 기동 즉시 IndexedDB 영구 색인본을 0.05초 만에 복원하고, Android MediaStore / iOS PhotoKit 네이티브 갤러리 자동 스캔을 수행합니다.
        window.setTimeout(() => {
          void get().syncMobileNativeGalleryAuto({ promptPermission: true });
        }, 120);
      }
    } catch {
      /* 키워드 검색으로 계속 동작 */
    }
  },

  syncMobileNativeGalleryAuto: async (options) => {
    if (zCoreBridge.isConnected) return;
    const promptPermission = options?.promptPermission ?? true;
    const maxTargetCount = options?.maxTargetCount ?? 480;
    const forceExpandSelected = Boolean(options?.forceExpandSelected);

    // 1) 재실행/새로고침 시 0장 깜빡임 방지: IndexedDB 영구 캐시 즉시 복원
    if (get().photos.length === 0 || get().videoSceneItems.length === 0) {
      const cached = await loadCachedMobileGalleryIndex();
      if (cached && (cached.photos.length > 0 || cached.videos.length > 0)) {
        const { updatedPhotos, duplicateGroups: cachedDupGroups } =
          clusterPhotosIntoDuplicateGroups(
            get().photos.length > 0 ? get().photos : cached.photos
          );
        const cachedTrashIds = new Set<string>();
        updatedPhotos.forEach((p) => {
          if (p.trashCategory && !p.quarantined) cachedTrashIds.add(p.id);
        });
        const cachedSearchResults: SearchResultItem[] = updatedPhotos
          .filter((p) => !p.quarantined && !p.isVaultDocument)
          .map((photo) => ({
            photo,
            score: 0.99,
            matchPercentage: 99,
            matchedBy: 'text-direct',
          }));
        set((state) => {
          const inSharedLounge = isSharedPhotoLounge(state.activeLoungeType);
          return {
            photos: updatedPhotos,
            duplicateGroups: cachedDupGroups,
            selectedTrashIds: cachedTrashIds,
            searchResults:
              inSharedLounge || state.hasExecutedUserSearch
                ? state.searchResults
                : cachedSearchResults,
            videoSceneItems:
              state.videoSceneItems.length > 0
                ? state.videoSceneItems
                : cached.videos.length > 0
                ? cached.videos
                : state.videoSceneItems,
            matchedVideoScenes:
              !inSharedLounge &&
              state.videoSceneItems.length === 0 &&
              cached.videos.length > 0 &&
              !state.hasExecutedUserSearch
                ? cached.videos
                : state.matchedVideoScenes,
          };
        });
      }
    }

    if (!isCapacitorNativeMobileRuntime()) {
      return;
    }
    // [모바일 휴지통 OS 확인창 복귀 레이스 원천 차단]:
    // Android MediaStore.createTrashRequest 확인창이 닫힐 때 발생하는 window focus 이벤트가
    // 직전 휴지통 이동 상태를 덮어써서 세트가 되살아나는 경쟁 상태(Race Condition)를 원천 차단합니다.
    if (
      !promptPermission &&
      !forceExpandSelected &&
      (get().quarantineMoving || isSystemTrashDialogActiveOrCoolingDown())
    ) {
      return;
    }
    if (get().mobileGalleryScanning) {
      pendingMobileGalleryResync = true;
      return;
    }

    set({ mobileGalleryScanning: true });
    let newlyAddedTotal = 0;
    let totalGalleryPhotos = get().photos.length;
    const allLiveNativePhotoIds = new Set<string>();
    let scannedFullGallery = false;
    const scanStartEpoch = quarantineMutationEpoch;

    try {
      const pageSize = 60;
      for (let offset = 0; offset < maxTargetCount; offset += pageSize) {
        while (get().quarantineMoving || isSystemTrashDialogActiveOrCoolingDown(1800)) {
          await new Promise((r) => setTimeout(r, 250));
        }
        const batchStartEpoch = quarantineMutationEpoch;
        const res = await scanNativeDeviceGalleryMedia({
          offset,
          limit: pageSize,
          thumbMaxDim: 512,
          includeVideos: offset === 0,
          promptPermission: offset === 0 ? promptPermission : false,
          forceExpandSelected: offset === 0 ? forceExpandSelected : false,
        });

        if (!res.permissionGranted) {
          set({
            mobileGalleryScanning: false,
            mobileGalleryPermissionDenied: true,
            mobileGalleryLimitedAccess: false,
          });
          return;
        }

        set({
          mobileGalleryPermissionDenied: false,
          mobileGalleryLimitedAccess: Boolean(res.limitedAccess),
        });
        if (res.totalPhotoCount >= 0) {
          totalGalleryPhotos = res.totalPhotoCount;
        }

        const liveBatchIds = new Set<string>();
        for (const np of res.photos || []) {
          if (np?.id) {
            liveBatchIds.add(np.id);
            allLiveNativePhotoIds.add(np.id);
          }
        }

        const curPhotos = get().photos;
        const seenIds = new Set(curPhotos.map((p) => p.id));

        // [아이폰 『사진 ➔ 최근 삭제된 항목』 / 갤러리 외부 복구 자동 동기화 (인플라이트 휴지통 이동 보호 포함)]:
        // 스캔 도중 앱 내에서 휴지통 이동/복원이 발생했거나(batchStartEpoch 불일치), 방금 휴지통으로 옮긴 직후(MediaStore 전파 지연 구간)에는
        // 과거 스냅샷(liveBatchIds)이 quarantined=true를 다시 false로 되살리지 않도록 보호합니다.
        const reviveGuardMs = isCapacitorIosRuntime() ? 2500 : 12000;
        const canCheckExternalRevive =
          !get().quarantineMoving &&
          quarantineMutationEpoch === batchStartEpoch &&
          !isSystemTrashDialogActiveOrCoolingDown();
        const isEligibleExternalRevive = (p: PhotoItem): boolean =>
          canCheckExternalRevive &&
          Boolean(p.quarantined) &&
          liveBatchIds.has(p.id) &&
          Date.now() - (recentlyQuarantinedAtById.get(p.id) || 0) >= reviveGuardMs;

        const hasRevivedFromOsTrash = curPhotos.some(isEligibleExternalRevive);

        // [iOS PhotoKit 중복 에셋 누락 원천 차단]:
        // iOS 사진첩에 저장된 동일 사진 2장은 asset.localIdentifier(np.id)만 다르고 originalFilename과 해상도 기반 estSize가 동일할 수 있으므로,
        // 네이티브 갤러리 스캔 항목은 반드시 OS 고유 에셋 ID(np.id) 기준으로만 중복 스킵 여부를 판별합니다.
        const unseenRaw = (res.photos || []).filter((np) => !seenIds.has(np.id));

        const analyzedBatch =
          unseenRaw.length > 0 ? await analyzeNativeGalleryPhotoBatch(unseenRaw) : [];
        const convertedVideos =
          offset === 0 && Array.isArray(res.videos) && res.videos.length > 0
            ? convertNativeGalleryVideos(res.videos)
            : [];

        let newlyDiscoveredVids: VideoSceneItem[] = [];
        if (hasRevivedFromOsTrash || analyzedBatch.length > 0 || convertedVideos.length > 0) {
          newlyAddedTotal += analyzedBatch.length;
          set((state) => {
            const allowReviveNow =
              hasRevivedFromOsTrash &&
              !state.quarantineMoving &&
              quarantineMutationEpoch === batchStartEpoch &&
              !isSystemTrashDialogActiveOrCoolingDown();
            const revivedBasePhotos = allowReviveNow
              ? state.photos.map((p) => {
                  if (
                    p.quarantined &&
                    liveBatchIds.has(p.id) &&
                    Date.now() - (recentlyQuarantinedAtById.get(p.id) || 0) >= reviveGuardMs
                  ) {
                    recentlyQuarantinedAtById.delete(p.id);
                    return { ...p, quarantined: false };
                  }
                  return p;
                })
              : state.photos;
            const mergedPhotos = [...revivedBasePhotos, ...analyzedBatch];
            const { updatedPhotos, duplicateGroups: nextDupGroups } =
              clusterPhotosIntoDuplicateGroups(mergedPhotos);
            const nextTrashIds = new Set<string>();
            updatedPhotos.forEach((p) => {
              if (p.trashCategory && !p.quarantined) nextTrashIds.add(p.id);
            });
            const nextSearchResults: SearchResultItem[] = updatedPhotos
              .filter((p) => !p.quarantined && !p.isVaultDocument)
              .map((photo) => ({
                photo,
                score: 0.99,
                matchPercentage: 99,
                matchedBy: 'text-direct',
              }));

            const freshVidById = new Map(convertedVideos.map((v) => [v.id, v]));
            const upgradedExistingVids = state.videoSceneItems.map((v) => {
              const fresh = freshVidById.get(v.id);
              if (fresh && !v.videoUrl && fresh.videoUrl) {
                return { ...v, videoUrl: fresh.videoUrl, thumbUrl: v.thumbUrl || fresh.thumbUrl };
              }
              return v;
            });
            const existingVidIds = new Set(upgradedExistingVids.map((v) => v.id));
            newlyDiscoveredVids = convertedVideos.filter((v) => !existingVidIds.has(v.id));
            // 새로 촬영하거나 텔레그램 등에서 저장한 최신 영상이 항상 맨 앞(0번 카드)에 나타나도록 선두 배치!
            const nextVids = [...newlyDiscoveredVids, ...upgradedExistingVids];

            const targetTab =
              nextDupGroups.length > 0
                ? 'duplicate'
                : updatedPhotos.some((p) => p.trashCategory === 'blurry' && !p.quarantined)
                ? 'blurry'
                : updatedPhotos.some(
                    (p) =>
                      (p.trashCategory === 'memo' || p.trashCategory === 'screenshot') &&
                      !p.quarantined
                  )
                ? 'memo'
                : state.activeTrashCategoryFilter;

            const inSharedLounge = isSharedPhotoLounge(state.activeLoungeType);
            return {
              photos: updatedPhotos,
              duplicateGroups: nextDupGroups,
              selectedTrashIds: nextTrashIds,
              activeTrashCategoryFilter: targetTab,
              searchResults:
                inSharedLounge || state.hasExecutedUserSearch
                  ? state.searchResults
                  : nextSearchResults,
              videoSceneItems: nextVids,
              matchedVideoScenes:
                inSharedLounge || state.hasExecutedUserSearch
                  ? state.matchedVideoScenes
                  : nextVids,
            };
          });

          const vidsMissingOcr = [            ...newlyDiscoveredVids,
            ...get().videoSceneItems.filter(
              (v) =>
                !newlyDiscoveredVids.some((nv) => nv.id === v.id) &&
                String(v.id || '').startsWith('mobile_vid_') &&
                v.hasScreenOcrText === undefined &&
                !v.ocrFullText &&
                (!Array.isArray(v.ocrLines) || v.ocrLines.length === 0)
            ),
          ];
          if (vidsMissingOcr.length > 0) {
            const vidsToQuickOcr = vidsMissingOcr.slice(0, 16);
            void (async () => {
              for (const nVid of vidsToQuickOcr) {
                try {
                  await new Promise((r) => setTimeout(r, 20));
                  const ocrOut = await extractVideoScreenTextOnDemand(nVid);
                  if (ocrOut.ocrLines && ocrOut.ocrLines.length > 0) {
                    const summaryLine = ocrOut.ocrLines
                      .map((l) => l.text.trim())
                      .filter(Boolean)
                      .slice(0, 2)
                      .join(' · ');
                    const extraTokens = String(ocrOut.fullText || '')
                      .replace(/\[\d{2}:\d{2}\]/g, ' ')
                      .split(/\s+/)
                      .map((t) => t.trim())
                      .filter((t) => t.length >= 2)
                      .slice(0, 40);
                    set((state) => ({
                      videoSceneItems: state.videoSceneItems.map((v) =>
                        v.id === nVid.id
                          ? {
                              ...v,
                              hasScreenOcrText: true,
                              ocrLineCount: ocrOut.ocrLines.length,
                              ocrLines: ocrOut.ocrLines,
                              ocrFullText: ocrOut.fullText || '',
                              matchedFrameCaption: summaryLine ? ` ${summaryLine}` : v.matchedFrameCaption,
                              keywords: Array.from(new Set([...(v.keywords || []), ...extraTokens])),
                            }
                          : v
                      ),
                      matchedVideoScenes: state.matchedVideoScenes.map((v) =>
                        v.id === nVid.id
                          ? {
                              ...v,
                              hasScreenOcrText: true,
                              ocrLineCount: ocrOut.ocrLines.length,
                              ocrLines: ocrOut.ocrLines,
                              ocrFullText: ocrOut.fullText || '',
                              matchedFrameCaption: summaryLine ? ` ${summaryLine}` : v.matchedFrameCaption,
                              keywords: Array.from(new Set([...(v.keywords || []), ...extraTokens])),
                            }
                          : v
                      ),
                    }));
                    void saveCachedMobileGalleryIndex(get().photos, get().videoSceneItems);
                  } else if (ocrOut.ok) {
                    set((state) => ({
                      videoSceneItems: state.videoSceneItems.map((v) =>
                        v.id === nVid.id ? { ...v, hasScreenOcrText: false } : v
                      ),
                      matchedVideoScenes: state.matchedVideoScenes.map((v) =>
                        v.id === nVid.id ? { ...v, hasScreenOcrText: false } : v
                      ),
                    }));
                  }
                } catch {
                  /* ignore background quick OCR error */
                }
              }
            })();
          }
        }

        if (
          !res.photos ||
          res.photos.length < pageSize ||
          offset + pageSize >= (res.totalPhotoCount || 0)
        ) {
          scannedFullGallery = (res.totalPhotoCount || 0) <= maxTargetCount;
          break;
        }
        await new Promise((r) => setTimeout(r, 80));
      }

      // 전체 갤러리 스캔 완료 시 OS 사진 앱에서 직접 삭제된(quarantined 아닌데 실제 갤러리에 없는) 항목도 정리하여 정합성 100% 유지
      if (
        scannedFullGallery &&
        quarantineMutationEpoch === scanStartEpoch &&
        !get().quarantineMoving &&
        get().photos.some((p) => !p.quarantined && !allLiveNativePhotoIds.has(p.id))
      ) {
        set((state) => {
          const pruned = state.photos.filter((p) => p.quarantined || allLiveNativePhotoIds.has(p.id));
          const { updatedPhotos, duplicateGroups: nextDupGroups } =
            clusterPhotosIntoDuplicateGroups(pruned);
          const nextTrashIds = new Set<string>();
          updatedPhotos.forEach((p) => {
            if (p.trashCategory && !p.quarantined) nextTrashIds.add(p.id);
          });
          const nextSearchResults: SearchResultItem[] = updatedPhotos
            .filter((p) => !p.quarantined && !p.isVaultDocument)
            .map((photo) => ({
              photo,
              score: 0.99,
              matchPercentage: 99,
              matchedBy: 'text-direct',
            }));
          const inSharedLounge = isSharedPhotoLounge(state.activeLoungeType);
          return {
            photos: updatedPhotos,
            duplicateGroups: nextDupGroups,
            selectedTrashIds: nextTrashIds,
            searchResults:
              inSharedLounge || state.hasExecutedUserSearch ? state.searchResults : nextSearchResults,
          };
        });
      }

      const finalPhotos = get().photos;
      const finalVideos = get().videoSceneItems;
      void saveCachedMobileGalleryIndex(finalPhotos, finalVideos);

      if (newlyAddedTotal > 0 && typeof window !== 'undefined') {
        const dupSetsCount = get().duplicateGroups.length;
        const blurryCount = finalPhotos.filter(
          (p) => p.trashCategory === 'blurry' && !p.quarantined
        ).length;
        const memoScreenCount = finalPhotos.filter(
          (p) =>
            (p.trashCategory === 'memo' || p.trashCategory === 'screenshot') && !p.quarantined
        ).length;
        const remainingOld = Math.max(0, totalGalleryPhotos - finalPhotos.length);
        const secSt = loadGhostSecretaryState();
        saveGhostSecretaryState({
          ...secSt,
          mobileSteppingStoneScanned: finalPhotos.length,
          mobileRemainingOldPhotos: remainingOld,
        });
        window.dispatchEvent(
          new CustomEvent('ghosti_photo_audit_summary', {
            detail: {
              total: finalPhotos.length,
              dupSets: dupSetsCount,
              blurry: blurryCount,
              memoScreen: memoScreenCount,
              remainingOldPhotos: remainingOld,
            },
          })
        );
      }

      if (finalPhotos.length > 0 || finalVideos.length > 0) {
        void startSilentRealMediaVisionIndexing({
          photos: get().photos,
          videos: get().videoSceneItems,
          onVideoThumbHydrated: (videoFileName, thumbUrl) => {
            set((state) => ({
              videoSceneItems: state.videoSceneItems.map((v) =>
                v.videoFileName === videoFileName ? { ...v, thumbUrl: v.thumbUrl || thumbUrl } : v
              ),
              matchedVideoScenes: state.matchedVideoScenes.map((v) =>
                v.videoFileName === videoFileName ? { ...v, thumbUrl: v.thumbUrl || thumbUrl } : v
              ),
            }));
          },
          onVideoOcrHydrated: (videoFileName, ocrMeta) => {
            const extraTokens = String(ocrMeta.ocrFullText || '')
              .replace(/\[\d{2}:\d{2}\]/g, ' ')
              .split(/\s+/)
              .map((t) => t.trim())
              .filter((t) => t.length >= 2)
              .slice(0, 40);
            set((state) => ({
              videoSceneItems: state.videoSceneItems.map((v) =>
                v.videoFileName === videoFileName
                  ? {
                      ...v,
                      ...ocrMeta,
                      keywords: Array.from(new Set([...(v.keywords || []), ...extraTokens])),
                    }
                  : v
              ),
              matchedVideoScenes: state.matchedVideoScenes.map((v) =>
                v.videoFileName === videoFileName
                  ? {
                      ...v,
                      ...ocrMeta,
                      keywords: Array.from(new Set([...(v.keywords || []), ...extraTokens])),
                    }
                  : v
              ),
            }));
            void saveCachedMobileGalleryIndex(get().photos, get().videoSceneItems);
          },
          onPhotoVisionHydrated: (photoId, patch) => {
            set((state) => ({
              photos: state.photos.map((p) => (p.id === photoId ? { ...p, ...patch } : p)),
              searchResults: state.searchResults.map((sr) =>
                sr.photo.id === photoId ? { ...sr, photo: { ...sr.photo, ...patch } } : sr
              ),
            }));
          },
        }).then(() => {
          void saveCachedMobileGalleryIndex(get().photos, get().videoSceneItems);
        });
      }
    } finally {
      set({ mobileGalleryScanning: false });
      if (pendingMobileGalleryResync) {
        pendingMobileGalleryResync = false;
        window.setTimeout(() => {
          void get().syncMobileNativeGalleryAuto({ promptPermission: false });
        }, 180);
      }
    }
  },

  importMobileLocalPhotos: async (files, options) => {
    const skipSearchResultsUpdate = Boolean(options?.skipSearchResultsUpdate);
    const { analyzed } = await analyzeMobilePickedPhotoFiles(files);
    if (analyzed.length === 0) return;
    const isSample = (name: string) =>
      /^(IMG_2025|PET_2025|TRV_2025|DOC_2025|MEMO_2025|Screenshot_2025|BLUR_2025)/.test(name);
    let summaryDetail = {
      total: analyzed.length,
      dupSets: 0,
      blurry: 0,
      memoScreen: 0,
      remainingOldPhotos: 0,
    };
    let skippedAllAsExisting = false;
    set((state) => {
      const prevReal = state.photos.filter(
        (p) => !isSample(p.name) && !String(p.thumbUrl || '').startsWith('blob:')
      );
      const prevNames = new Set(prevReal.map((p) => p.name));
      const prevSigs = new Set(prevReal.map((p) => `${p.name}__${p.size}`));
      const prevDhashSize = new Set(
        prevReal.filter((p) => p.dhash).map((p) => `${p.dhash}__${p.size}`)
      );

      const newAnalyzed = analyzed.filter(
        (a) =>
          !prevNames.has(a.name) &&
          !prevSigs.has(`${a.name}__${a.size}`) &&
          !(a.dhash && prevDhashSize.has(`${a.dhash}__${a.size}`))
      );
      const alreadyLoadedCount = analyzed.length - newAnalyzed.length;

      if (newAnalyzed.length === 0 && prevReal.length > 0) {
        skippedAllAsExisting = true;
        const existingDupCount = state.duplicateGroups.length;
        const existingBlurryCount = prevReal.filter(
          (p) => p.trashCategory === 'blurry' && !p.quarantined
        ).length;
        const existingMemoScreenCount = prevReal.filter(
          (p) =>
            (p.trashCategory === 'memo' || p.trashCategory === 'screenshot') && !p.quarantined
        ).length;
        summaryDetail = {
          total: analyzed.length,
          dupSets: existingDupCount,
          blurry: existingBlurryCount,
          memoScreen: existingMemoScreenCount,
          remainingOldPhotos: 0,
        };
        return {
          lastQuarantineToast: `ℹ️ 이미 업로드되어 있는 사진 ${analyzed.length}장이에요! (중복 추가 없이 기존 목록을 그대로 유지했어요)`,
        };
      }

      const mergedReal = [...newAnalyzed, ...prevReal];
      const { updatedPhotos, duplicateGroups: nextDupGroups } =
        clusterPhotosIntoDuplicateGroups(mergedReal);
      const nextTrashIds = new Set<string>();
      updatedPhotos.forEach((p) => {
        if (p.trashCategory && !p.quarantined) nextTrashIds.add(p.id);
      });
      const dupSetsCount = nextDupGroups.length;
      const blurryCount = updatedPhotos.filter(
        (p) => p.trashCategory === 'blurry' && !p.quarantined
      ).length;
      const memoScreenCount = updatedPhotos.filter(
        (p) =>
          (p.trashCategory === 'memo' || p.trashCategory === 'screenshot') && !p.quarantined
      ).length;
      const stepping = executeMobileSteppingStoneScan({
        totalPhotoCount: updatedPhotos.length,
        countFacesInWindow: (windowLimit) =>
          updatedPhotos
            .slice(0, windowLimit)
            .filter((p) => (p.tags || []).some((t) => /인물|가족|얼굴|셀카/.test(t))).length,
        minFacesToStop: 1,
      });
      const secSt = loadGhostSecretaryState();
      saveGhostSecretaryState({
        ...secSt,
        mobileSteppingStoneScanned: stepping.scannedPhotos,
        mobileRemainingOldPhotos: stepping.remainingOldPhotos,
      });
      summaryDetail = {
        total: newAnalyzed.length,
        dupSets: dupSetsCount,
        blurry: blurryCount,
        memoScreen: memoScreenCount,
        remainingOldPhotos: stepping.remainingOldPhotos,
      };
      const addedSearchResults: SearchResultItem[] = updatedPhotos.map((photo) => ({
        photo,
        score: 0.99,
        matchPercentage: 99,
        matchedBy: 'text-direct',
      }));
      const targetTab: TrashCategory =
        dupSetsCount > 0
          ? 'duplicate'
          : blurryCount > 0
          ? 'blurry'
          : memoScreenCount > 0
          ? 'memo'
          : 'duplicate';
      const skipSuffix =
        alreadyLoadedCount > 0 ? `(이미 업로드된 ${alreadyLoadedCount}장은 중복 제외)` : '';
      const countLabel =
        alreadyLoadedCount > 0 ? `새 사진 ${newAnalyzed.length}장 추가` : `사진 ${newAnalyzed.length}장`;
      const toastMsg =
        dupSetsCount === 0 && blurryCount === 0 && memoScreenCount === 0
          ? ` ${countLabel} 분석 완료!${skipSuffix} 버릴 중복·연사(0세트)나 흐린 사진(0장) 없이 모두 깨끗한 사진이에요.`
          : ` ${countLabel} 분석 완료!${skipSuffix} 중복·연사 ${dupSetsCount}세트 · 흐린 사진 ${blurryCount}장 발견 — 아래에서 실사진을 보고 [OK]로 직접 결정해 주세요!`;
      const baseUpdate = {
        photos: updatedPhotos,
        duplicateGroups: nextDupGroups,
        selectedTrashIds: nextTrashIds,
        activeTrashCategoryFilter: targetTab,
      };
      if (skipSearchResultsUpdate || isSharedPhotoLounge(state.activeLoungeType)) {
        return {
          ...baseUpdate,
          lastQuarantineToast: toastMsg,
        };
      }
      const isMobilePersonalSecretary =
        state.layout === 'mobile' && state.activeLoungeType === 'personal';
      return {
        ...baseUpdate,
        searchResults: addedSearchResults,
        hasExecutedUserSearch: isMobilePersonalSecretary ? state.hasExecutedUserSearch : true,
        activeQuery: isMobilePersonalSecretary
          ? state.activeQuery
          : `방금 불러온 내 폰 사진 (${updatedPhotos.length}장 · 온디바이스 AI 분석 완료)`,
        matchedTags: ['#내폰사진즉시분석', '#중복분석', '#로컬처리'],
        lastQuarantineToast: toastMsg,
      };
    });
    if (typeof window !== 'undefined' && !skipSearchResultsUpdate) {
      window.dispatchEvent(
        new CustomEvent('ghosti_photo_audit_summary', { detail: summaryDetail })
      );
    }
    // [Gemma 2 주력 비전 인덱싱 + 광학/OCR 보조 통합]: 모바일·PC에서 불러온 실사진에 대해 즉시 768D EmbeddingGemma 2 비전 벡터 및 한국어 의미 태그·OCR 결합 가동
    if (!skippedAllAsExisting) {
      void saveCachedMobileGalleryIndex(get().photos, get().videoSceneItems);
      void startSilentRealMediaVisionIndexing({
        photos: get().photos,
        videos: get().videoSceneItems,
        onPhotoVisionHydrated: (photoId, patch) => {
          set((state) => ({
            photos: state.photos.map((p) => (p.id === photoId ? { ...p, ...patch } : p)),
            searchResults: state.searchResults.map((sr) =>
              sr.photo.id === photoId ? { ...sr, photo: { ...sr.photo, ...patch } } : sr
            ),
          }));
        },
      }).then(() => {
        void saveCachedMobileGalleryIndex(get().photos, get().videoSceneItems);
      });
    }
  },

  applyAhaRecommendation: async (item: OnboardingAhaItem) => {
    set({ showOnboarding: false });
    await get().runTextQuery(item.targetSearchQuery);
  },

  showOnboarding: false,
  onboardingRunning: false,
  onboardingUseRealGpu: false,
  onboardingTargetCount: 24,
  onboardingTrackMode: typeof window !== 'undefined' && window.innerWidth < 1024 ? 'cloud_rental' : 'pc_local',
  pcAgentPairedMobile: false,
  onboardingProgress: INITIAL_ONBOARDING_PROGRESS,

  setShowOnboarding: (showOnboarding) => set({ showOnboarding }),
  setOnboardingUseRealGpu: (onboardingUseRealGpu) => set({ onboardingUseRealGpu }),
  setOnboardingTargetCount: (onboardingTargetCount) => set({ onboardingTargetCount }),
  setOnboardingTrackMode: (onboardingTrackMode) => set({ onboardingTrackMode }),
  setPcAgentPairedMobile: (pcAgentPairedMobile) => {
    const { merlinAuth } = get();
    const isAuthed = Boolean(merlinAuth?.email && merlinAuth.userId && merlinAuth.userId !== 'guest');
    const nextPaired = isAuthed ? pcAgentPairedMobile : false;
    if (isAuthed && typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          `ghosti_mobile_paired_${merlinAuth.email.trim().toLowerCase()}`,
          nextPaired ? '1' : '0'
        );
      } catch {
        /* ignore storage error */
      }
    }
    set({ pcAgentPairedMobile: nextPaired });
  },

  startOnboardingIndexing: async () => {
    const {
      photos,
      faceClusters,
      onboardingTargetCount,
      onboardingUseRealGpu,
      onboardingRunning,
      isStoreAppMode,
      layout,
    } = get();
    if (onboardingRunning) return;
    storeSharedRefs.cancelOnboardingFlag = false;
    set({ onboardingRunning: true, showOnboarding: true });

    const nonQuarantined = photos.filter((p) => !p.quarantined);
    const isMobileEnv =
      isStoreAppMode ||
      layout === 'mobile' ||
      (typeof window !== 'undefined' &&
        (Boolean(
          (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
        ) ||
          /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
          window.innerWidth < 860));

    let effectiveCap = onboardingTargetCount;
    if (isMobileEnv) {
      const faceFileSet = new Set<string>();
      (faceClusters || [])
        .filter((c) => !c.excludedAsPasserby)
        .forEach((c) => (c.matchedPhotoFiles || []).forEach((f) => faceFileSet.add(f)));

      const stepping = executeMobileSteppingStoneScan({
        totalPhotoCount: nonQuarantined.length,
        countFacesInWindow: (windowLimit) => {
          const slice = nonQuarantined.slice(0, windowLimit);
          return slice.filter(
            (p) => faceFileSet.has(p.name) || (p.tags || []).some((t) => /인물|가족|얼굴|셀카/.test(t))
          ).length;
        },
        minFacesToStop: 1,
      });
      effectiveCap = Math.min(onboardingTargetCount, stepping.stoppedAtWindow);
      const secSt = loadGhostSecretaryState();
      saveGhostSecretaryState({
        ...secSt,
        mobileSteppingStoneScanned: stepping.scannedPhotos,
        mobileRemainingOldPhotos: stepping.remainingOldPhotos,
      });
    }

    const targets = nonQuarantined.slice(0, effectiveCap);
    await runOnboardingIndexingPipeline({
      targetPhotos: targets,
      useRealWebGpuVision: onboardingUseRealGpu,
      shouldCancel: () => storeSharedRefs.cancelOnboardingFlag,
      onUpdate: (update) => {
        set({ onboardingProgress: update });
      },
    });

    set({ onboardingRunning: false });
  },

  cancelOnboardingIndexing: () => {
    storeSharedRefs.cancelOnboardingFlag = true;
    set({ onboardingRunning: false });
  },


  selectedTrashIds: new Set<string>(),
  activeTrashCategoryFilter: 'duplicate',
  quarantineMoving: false,
  quarantineOpKind: 'idle',
  quarantineRestoreScope: 'idle',
  quarantineRestoringIds: [],
  lastQuarantineToast: null,
  lastUndoBatch: null,

  setActiveTrashCategoryFilter: (activeTrashCategoryFilter) => set({ activeTrashCategoryFilter }),

  toggleTrashSelection: (id: string) => {
    set((state) => {
      const next = new Set(state.selectedTrashIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedTrashIds: next };
    });
  },

  selectAllTrashInFilter: () => {
    const { photos, activeTrashCategoryFilter, selectedTrashIds } = get();
    const zConn = zCoreBridge.isConnected;
    const isSample = (name: string) =>
      /^(IMG_2025|PET_2025|TRV_2025|DOC_2025|MEMO_2025|Screenshot_2025|BLUR_2025)/.test(name);
    const next = new Set(selectedTrashIds);
    for (const p of photos) {
      if (!p.trashCategory || p.quarantined || activeTrashCategoryFilter === 'none') continue;
      if (zConn && isSample(p.name)) continue;
      const matches =
        activeTrashCategoryFilter === 'all'
          ? true
          : activeTrashCategoryFilter === 'memo' ||
            activeTrashCategoryFilter === 'object' ||
            activeTrashCategoryFilter === 'document' ||
            activeTrashCategoryFilter === 'receipt'
          ? p.trashCategory === 'memo' ||
            p.trashCategory === 'object' ||
            p.trashCategory === 'document' ||
            p.trashCategory === 'receipt'
          : p.trashCategory === activeTrashCategoryFilter;
      if (matches) next.add(p.id);
    }
    set({ selectedTrashIds: next });
  },

  clearTrashSelection: () => {
    const { photos, activeTrashCategoryFilter, selectedTrashIds } = get();
    if (activeTrashCategoryFilter === 'all' || activeTrashCategoryFilter === 'none') {
      set({ selectedTrashIds: new Set() });
      return;
    }
    const next = new Set(selectedTrashIds);
    for (const p of photos) {
      const matches =
        activeTrashCategoryFilter === 'memo' ||
        activeTrashCategoryFilter === 'object' ||
        activeTrashCategoryFilter === 'document' ||
        activeTrashCategoryFilter === 'receipt'
          ? p.trashCategory === 'memo' ||
            p.trashCategory === 'object' ||
            p.trashCategory === 'document' ||
            p.trashCategory === 'receipt'
          : p.trashCategory === activeTrashCategoryFilter;
      if (matches) next.delete(p.id);
    }
    set({ selectedTrashIds: next });
  },

  pickBestInDuplicateGroup: async (
    groupId: string,
    keepPhotoId: string,
    quarantineRestImmediately = false
  ) => {
    if (get().quarantineMoving) return;
    const { duplicateGroups, photos, selectedTrashIds } = get();
    const targetGroup = duplicateGroups.find((g) => g.groupId === groupId);
    if (!targetGroup) return;

    const photoMap = new Map(photos.map((p) => [p.id, p]));
    const activeMembers = targetGroup.photoIds
      .map((id) => photoMap.get(id))
      .filter((p): p is PhotoItem => Boolean(p && !p.quarantined));

    // [절대 불변식]: 세트 내 살아있는 사진이 2장 미만이면 절대 휴지통 이동을 실행하지 않아
    // 세트 내 2장이 모두 휴지통으로 들어가는 사고를 수학적으로 100% 원천 차단합니다!
    if (activeMembers.length < 2) return;

    const effectiveKeepId = activeMembers.some((p) => p.id === keepPhotoId)
      ? keepPhotoId
      : activeMembers[0].id;
    const activeMemberSet = new Set(activeMembers.map((p) => p.id));
    const redundantIds = activeMembers
      .filter((p) => p.id !== effectiveKeepId)
      .map((p) => p.id);

    if (quarantineRestImmediately && redundantIds.length > 0) {
      if (!ensureLoginAndZCoreReady('연사 베스트 컷 정리')) return;
      // [PC 로컬 Z-코어 0.01초 즉시 세트 전환]: SHFileOperationW 휴지통 I/O 동안 화면이 멈추지 않도록
      // PC 연결 시에는 즉시 다음 세트로 넘기고 백그라운드 직렬 큐로 이동하며(실패 시 자동 원복), 모바일은 OS 확인창 이후 전환합니다.
      if (zCoreBridge.isConnected && !isCapacitorNativeMobileRuntime()) {
        const optimisticMovedSet = new Set<string>(redundantIds);
        const newlyKeptIds = new Set<string>([effectiveKeepId]);
        const savedBytes = photos
          .filter((p) => optimisticMovedSet.has(p.id))
          .reduce((acc, p) => acc + p.size, 0);
        set((state) => {
          const wasFreeTrialFirstUse = !state.freeTrialUsed && state.activePricingPlan === 'free_trial';
          return buildQuarantineMoveStatePatch({
            state,
            movedSet: optimisticMovedSet,
            newlyKeptIds,
            savedBytes,
            demo: false,
            actionLabel: '연사 바둑판 베스트 컷 Pick 정리',
            nonIosToast: `${wasFreeTrialFirstUse ? '첫 정리 완료! ' : ' '}베스트 원본 1장을 남기고 나머지 ${optimisticMovedSet.size}장을 시스템 [휴지통]으로 안전하게 이동했습니다.`,
          });
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ghosti_photo_moved_to_quarantine'));
        }
        void enqueueZCoreQuarantineOp(() =>
          requestQuarantineOp('move', redundantIds, [effectiveKeepId])
        ).then((moveRes) => {
          const movedList = moveRes.done.filter((id) => id !== effectiveKeepId);
          if (movedList.length === 0) {
            get().syncPhotosAfterExternalRestore(
              redundantIds,
              undefined,
              quarantineFailureToast('move', moveRes)
            );
          }
        });
        return;
      }

      set({ quarantineMoving: true, quarantineOpKind: 'move' });
      const moveRes = await requestQuarantineOp('move', redundantIds, [effectiveKeepId]);
      if (moveRes.done.length === 0) {
        set({ quarantineMoving: false, quarantineOpKind: 'idle', lastQuarantineToast: quarantineFailureToast('move', moveRes) });
        return;
      }
      const movedList: string[] = moveRes.done.filter((id) => id !== effectiveKeepId);
      if (movedList.length === 0) {
        set({ quarantineMoving: false, quarantineOpKind: 'idle' });
        return;
      }
      const moveNote = quarantineResultNote('move', moveRes);

      const movedSet = new Set<string>(movedList);
      const newlyKeptIds = new Set<string>([effectiveKeepId]);
      const savedBytes = photos
        .filter((p) => movedSet.has(p.id))
        .reduce((acc, p) => acc + p.size, 0);

      set((state) => {
        const wasFreeTrialFirstUse = !state.freeTrialUsed && state.activePricingPlan === 'free_trial';
        return buildQuarantineMoveStatePatch({
          state,
          movedSet,
          newlyKeptIds,
          savedBytes,
          demo: moveRes.demo,
          actionLabel: '연사 바둑판 베스트 컷 Pick 정리',
          nonIosToast: `${wasFreeTrialFirstUse ? '첫 정리 완료! ' : ' '}베스트 원본 1장을 남기고 나머지 ${movedSet.size}장을 ${moveNote}`,
        });
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ghosti_photo_moved_to_quarantine'));
      }
      if (!zCoreBridge.isConnected) {
        scheduleSaveCachedMobileGalleryIndex(get().photos, get().videoSceneItems);
      }
      return;
    }

    const updatedGroups = duplicateGroups.map((g) =>
      g.groupId === groupId ? { ...g, bestPhotoId: effectiveKeepId } : g
    );

    const updatedPhotos = photos.map((p) => {
      if (!activeMemberSet.has(p.id)) return p;
      if (p.id === effectiveKeepId) {
        return {
          ...p,
          isBestInDuplicateGroup: true,
          trashCategory: undefined,
          trashConfidence: undefined,
          tags: [            '#원본보존(Best)',
            ...p.tags.filter((t) => !t.includes('연사') && !t.includes('사본') && !t.includes('원본보존')),
          ].slice(0, 3),
        };
      }
      return {
        ...p,
        isBestInDuplicateGroup: false,
        trashCategory: 'duplicate'as TrashCategory,
        trashConfidence: 0.99,
        tags: [          '#연사·중복사본',
          '#원본1장보존됨',
          ...p.tags.filter((t) => !t.includes('원본보존')),
        ].slice(0, 3),
      };
    });

    const nextTrashIds = new Set(selectedTrashIds);
    nextTrashIds.delete(effectiveKeepId);
    redundantIds.forEach((id) => {
      const ph = photoMap.get(id);
      if (ph && !ph.quarantined) nextTrashIds.add(id);
    });

    set({
      duplicateGroups: updatedGroups,
      photos: updatedPhotos,
      selectedTrashIds: nextTrashIds,
      lastQuarantineToast: `선택한 사진을 [보존할 원본 1장]으로 변경했습니다. (나머지 ${redundantIds.length}장이 정리 대상으로 전환됨)`,
    });
  },

  pickBestInBurstPhotos: async (burstPhotos: PhotoItem[], keepPhotoId: string) => {
    const redundantIds = burstPhotos.map((p) => p.id).filter((id) => id !== keepPhotoId);
    if (redundantIds.length === 0) return;
    if (!ensureLoginAndZCoreReady('연사 베스트 컷 정리')) return;

    set({ quarantineMoving: true, quarantineOpKind: 'move' });
    const moveRes = await requestQuarantineOp('move', redundantIds, [keepPhotoId]);
    if (moveRes.done.length === 0) {
      set({ quarantineMoving: false, quarantineOpKind: 'idle', lastQuarantineToast: quarantineFailureToast('move', moveRes) });
      return;
    }
    const movedList: string[] = moveRes.done.filter((id) => id !== keepPhotoId);
    if (movedList.length === 0) {
      set({ quarantineMoving: false, quarantineOpKind: 'idle' });
      return;
    }
    const moveNote = quarantineResultNote('move', moveRes);

    const movedSet = new Set<string>(movedList);
    const newlyKeptIds = new Set<string>([keepPhotoId]);
    const savedBytes = burstPhotos
      .filter((p) => movedSet.has(p.id))
      .reduce((acc, p) => acc + p.size, 0);

    set((state) =>
      buildQuarantineMoveStatePatch({
        state,
        movedSet,
        newlyKeptIds,
        savedBytes,
        demo: moveRes.demo,
        actionLabel: '검색 결과 연사 베스트 컷 Pick',
        nonIosToast: `베스트 컷 1장을 남기고 나머지 연사 ${movedSet.size}장을 ${moveNote}`,
        clearSelectedBurstModal: true,
      })
    );
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ghosti_photo_moved_to_quarantine'));
    }
    if (!zCoreBridge.isConnected) {
      scheduleSaveCachedMobileGalleryIndex(get().photos, get().videoSceneItems);
    }
  },

  moveSelectedToQuarantine: async () => {
    if (!ensureLoginAndZCoreReady('손보기 사진 정리')) return;
    const { selectedTrashIds, photos, activeTrashCategoryFilter } = get();
    const zConn = zCoreBridge.isConnected;
    const isSample = (name: string) =>
      /^(IMG_2025|PET_2025|TRV_2025|DOC_2025|MEMO_2025|Screenshot_2025|BLUR_2025)/.test(name);
    const scopedPhotos = photos.filter((p) => {
      if (!selectedTrashIds.has(p.id) || !p.trashCategory || p.quarantined) return false;
      if (zConn && isSample(p.name)) return false;
      if (activeTrashCategoryFilter === 'all' || activeTrashCategoryFilter === 'none') return true;
      if (
        activeTrashCategoryFilter === 'memo' ||
        activeTrashCategoryFilter === 'object' ||
        activeTrashCategoryFilter === 'document' ||
        activeTrashCategoryFilter === 'receipt'
      ) {
        return (
          p.trashCategory === 'memo' ||
          p.trashCategory === 'object' ||
          p.trashCategory === 'document' ||
          p.trashCategory === 'receipt'
        );
      }
      return p.trashCategory === activeTrashCategoryFilter;
    });
    const targetNames = scopedPhotos.map((p) => p.id);
    if (targetNames.length === 0) return;

    set({ quarantineMoving: true, quarantineOpKind: 'move' });
    let cancelRequested = false;
    const onCancel = () => {
      cancelRequested = true;
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('ghosti_cancel_inflight_quarantine', onCancel);
    }

    const CHUNK_SIZE = 10;
    const movedList: string[] = [];
    let lastMoveRes: Awaited<ReturnType<typeof requestQuarantineOp>> | null = null;
    try {
      for (let offset = 0; offset < targetNames.length; offset += CHUNK_SIZE) {
        if (cancelRequested && offset > 0) break;
        const chunk = targetNames.slice(offset, offset + CHUNK_SIZE);
        const chunkRes = await requestQuarantineOp('move', chunk);
        lastMoveRes = chunkRes;
        if (chunkRes.done.length > 0) {
          movedList.push(...chunkRes.done);
        } else if (offset === 0) {
          set({ quarantineMoving: false, quarantineOpKind: 'idle', lastQuarantineToast: quarantineFailureToast('move', chunkRes) });
          return;
        }
      }
    } finally {
      if (typeof window !== 'undefined') {
        window.removeEventListener('ghosti_cancel_inflight_quarantine', onCancel);
      }
    }

    if (movedList.length === 0 || !lastMoveRes) {
      set({ quarantineMoving: false, quarantineOpKind: 'idle' });
      return;
    }
    const moveRes = lastMoveRes;
    const moveNote = quarantineResultNote('move', moveRes);

    const movedSet = new Set<string>(movedList);
    const savedBytes = photos
      .filter((p) => movedSet.has(p.id))
      .reduce((acc, p) => acc + p.size, 0);

    set((state) =>
      buildQuarantineMoveStatePatch({
        state,
        movedSet,
        savedBytes,
        demo: moveRes.demo,
        actionLabel: '귀신비서 추천 항목 일괄 정리',
        nonIosToast: `사진 ${movedSet.size}장을 ${moveNote}`,
      })
    );
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ghosti_photo_moved_to_quarantine'));
    }
    if (!zCoreBridge.isConnected) {
      scheduleSaveCachedMobileGalleryIndex(get().photos, get().videoSceneItems);
    }
  },

  moveAllTrashToQuarantine: async () => {
    if (!ensureLoginAndZCoreReady('귀신비서 사진 일괄 정리')) return;
    const { photos } = get();
    const allTrashIds = photos
      .filter((p) => p.trashCategory && !p.quarantined)
      .map((p) => p.id);
    set({ selectedTrashIds: new Set(allTrashIds), activeTrashCategoryFilter: 'all' });
    await get().moveSelectedToQuarantine();
  },

  syncPhotosAfterExternalRestore: (
    names: string[],
    replacedIds?: Record<string, string>,
    customToast?: string
  ) => {
    const cleanNames = names.map((n) => String(n || '').trim()).filter(Boolean);
    if (cleanNames.length === 0) return;
    quarantineMutationEpoch += 1;
    pendingMobileGalleryResync = false;
    const restoredSet = new Set<string>(cleanNames);
    const restoredLowerSet = new Set<string>(cleanNames.map((n) => n.toLowerCase()));
    const replacedMap = replacedIds || {};
    cleanNames.forEach((n) => recentlyQuarantinedAtById.delete(n));
    Object.entries(replacedMap).forEach(([oldId, newId]) => {
      recentlyQuarantinedAtById.delete(oldId);
      if (newId) recentlyQuarantinedAtById.delete(newId);
    });
    const revTs = Date.now();

    set((state) => {
      const restoredIdsAfterReplace = new Set<string>();
      const restoredOriginGroupIds = new Set<string>();
      const stripDupSuffix = (s: string) =>
        String(s || '')
          .replace(/__[0-9A-Za-z가-힣_-]{1,18}_[0-9a-f]{6}(?=\.[^.]+$)/i, '')
          .toLowerCase();
      const restoredStrippedSet = new Set<string>(
        cleanNames.map((n) => stripDupSuffix(String(n).split(/[\\/]/).pop() || n))
      );
      const cleanHasExactPathOrUniqueKey = cleanNames.every(
        (n) => /[\\/]/.test(n) || /__[0-9A-Za-z가-힣_-]{1,18}_[0-9a-f]{6}\.[^.]+$/i.test(n)
      );
      let anyMatched = false;
      const firstPassPhotos = state.photos.map((p) => {
        const isNativeAsset =
          !zCoreBridge.isConnected &&
          (String(p.id || '').startsWith('ms_img_') || String(p.id || '').includes('/'));
        const pBaseStripped = stripDupSuffix(p.name || '');
        const pFullLower = String(p.fullPath || '').toLowerCase();
        const hit = isNativeAsset
          ? restoredSet.has(p.id)
          : restoredSet.has(p.id) ||
            restoredSet.has(p.name) ||
            restoredLowerSet.has((p.name || '').toLowerCase()) ||
            (pFullLower.length > 0 && restoredLowerSet.has(pFullLower)) ||
            (!cleanHasExactPathOrUniqueKey &&
              pBaseStripped.length > 0 &&
              restoredStrippedSet.has(pBaseStripped));
        if (!hit || !p.quarantined) return p;
        anyMatched = true;
        const originGroupId = p.lastDuplicateGroupId || p.duplicateGroupId;
        if (originGroupId) {
          restoredOriginGroupIds.add(originGroupId);
        }
        const candidateNewId = replacedMap[p.id];
        const newId =
          candidateNewId && !state.photos.some((other) => other.id === candidateNewId && other.id !== p.id)
            ? candidateNewId
            : p.id;
        if (newId !== p.id) {
          migrateOpticalSigPhotoId(p.id, newId);
        }
        registerMobilePickedPhotoMeta({
          id: newId,
          name: p.name,
          size: p.size,
          mtimeMs: p.mtimeMs,
          thumbDataUrl: p.thumbUrl,
        });
        restoredIdsAfterReplace.add(newId);
        const isZCorePhoto = p.thumbUrl.includes('/__photos/file');
        return {
          ...p,
          id: newId,
          quarantined: false,
          userKeptAsBest: false,
          thumbUrl: isZCorePhoto
            ? getZCoreUrl(`/__photos/file?p=${encodeURIComponent(p.name)}&thumb=1&rev=${revTs}`)
            : p.thumbUrl,
          fullUrl: isZCorePhoto
            ? getZCoreUrl(`/__photos/file?p=${encodeURIComponent(p.name)}&rev=${revTs}`)
            : p.fullUrl,
        };
      });

      if (!anyMatched) {
        if (zCoreBridge.isConnected) {
          // 새로고침 이전이나 윈도우 탐색기에서 지웠던 사진을 1회차에 복원한 경우에도 왼쪽 사진 목록에 즉시 나타나도록 라이브 재동기화
          window.setTimeout(() => {
            void get().initApp(true);
          }, 60);
        }
        return customToast
          ? { quarantineMoving: false, quarantineOpKind: 'idle', lastQuarantineToast: customToast }
          : { quarantineMoving: false, quarantineOpKind: 'idle' };
      }

      // [원래 세트 정밀 재결합]: 방금 복원된 사진과 같은 세트였던 보존 사진(originGroupId 일치)만 userKeptAsBest 잠금을 해제해
      // 원래 베스트 컷(isBestInDuplicateGroup=true) 그대로 재결합시키고, 이미 정리가 끝난 다른 세트의 보존 사진은 userKeptAsBest=true를 그대로 유지합니다!
      const unquarantinedPhotos = firstPassPhotos.map((p) => {
        if (p.quarantined || restoredIdsAfterReplace.has(p.id)) return p;
        const gId = p.lastDuplicateGroupId || p.duplicateGroupId;
        if (gId && restoredOriginGroupIds.has(gId)) {
          return {
            ...p,
            userKeptAsBest: false,
            isBestInDuplicateGroup: true,
          };
        }
        return p;
      });

      // [1장 및 전체 복원 초고속화 — O(N) 0.2ms 단일 패스 증분 재결합]:
      // 1장 복원·전체 복원 모두 전체 사진(수천 장)을 O(N^2)으로 처음부터 재클러스터링하지 않고,
      // 단일 O(N) 패스로 복원된 사진의 원래 세트(restoredOriginGroupIds)만 즉시 재결합하여 1ms 미만으로 끝낸다!
      const restoredPhotoIdList = Array.from(restoredIdsAfterReplace);
      const needsFullFallbackClustering =
        restoredOriginGroupIds.size === 0 &&
        restoredPhotoIdList.some((id) => {
          const ph = unquarantinedPhotos.find((p) => p.id === id);
          return Boolean(ph && !ph.trashCategory && !ph.lastDuplicateGroupId && ph.dhash && ph.dhash.length === 16);
        });

      let updatedPhotos: PhotoItem[];
      let nextDupGroups: DuplicateGroup[];
      if (!needsFullFallbackClustering) {
        const existingGroupById = new Map(state.duplicateGroups.map((g) => [g.groupId, g]));
        const nextGroupsMap = new Map(state.duplicateGroups.map((g) => [g.groupId, { ...g, photoIds: [...g.photoIds] }]));
        const restoredGroupRoles = new Map<string, { groupId: string; isBest: boolean }>();

        if (restoredOriginGroupIds.size > 0) {
          const membersByOriginGroup = new Map<string, PhotoItem[]>();
          for (const p of unquarantinedPhotos) {
            if (p.quarantined) continue;
            const gid = p.lastDuplicateGroupId || p.duplicateGroupId;
            if (!gid || !restoredOriginGroupIds.has(gid)) continue;
            const arr = membersByOriginGroup.get(gid) || [];
            arr.push(p);
            membersByOriginGroup.set(gid, arr);
          }
          for (const gid of restoredOriginGroupIds) {
            const activeMembersInOrigin = membersByOriginGroup.get(gid) || [];
            if (activeMembersInOrigin.length >= 2) {
              const prevG = existingGroupById.get(gid);
              const bestCandidate =
                activeMembersInOrigin.find((p) => p.id === prevG?.bestPhotoId) ||
                activeMembersInOrigin.find((p) => p.isBestInDuplicateGroup) ||
                activeMembersInOrigin[0];
              const mergedGroup: DuplicateGroup = {
                groupId: gid,
                bestPhotoId: bestCandidate.id,
                photoIds: activeMembersInOrigin.map((p) => p.id),
                deltaSec: prevG?.deltaSec ?? 0,
                maxDhashDist: prevG?.maxDhashDist ?? 0,
              };
              nextGroupsMap.set(gid, mergedGroup);
              for (const m of activeMembersInOrigin) {
                restoredGroupRoles.set(m.id, { groupId: gid, isBest: m.id === bestCandidate.id });
              }
            }
          }
        }
        nextDupGroups = Array.from(nextGroupsMap.values());
        updatedPhotos = unquarantinedPhotos.map((p) => {
          const role = restoredGroupRoles.get(p.id);
          if (!role) return p;
          if (role.isBest) {
            return {
              ...p,
              duplicateGroupId: role.groupId,
              lastDuplicateGroupId: role.groupId,
              isBestInDuplicateGroup: true,
              userKeptAsBest: false,
              trashCategory: undefined,
              trashConfidence: undefined,
            };
          }
          return {
            ...p,
            duplicateGroupId: role.groupId,
            lastDuplicateGroupId: role.groupId,
            isBestInDuplicateGroup: false,
            userKeptAsBest: false,
            trashCategory: 'duplicate' as TrashCategory,
            trashConfidence: 0.98,
          };
        });
      } else {
        const clustered = clusterPhotosIntoDuplicateGroups(unquarantinedPhotos);
        updatedPhotos = clustered.updatedPhotos;
        nextDupGroups = clustered.duplicateGroups;
      }

      const nextSelectedTrashIds = new Set<string>(state.selectedTrashIds);
      let restoredFocusCategory: TrashCategory | null = null;
      updatedPhotos.forEach((p) => {
        if (p.trashCategory && !p.quarantined) {
          nextSelectedTrashIds.add(p.id);
          if (restoredIdsAfterReplace.has(p.id) && !restoredFocusCategory) {
            restoredFocusCategory = p.trashCategory;
          }
        }
      });
      if (!restoredFocusCategory && nextDupGroups.some((g) => g.photoIds.some((id) => restoredIdsAfterReplace.has(id)))) {
        restoredFocusCategory = 'duplicate';
      }

      const inSharedLounge = isSharedPhotoLounge(state.activeLoungeType);
      const existingSearchIds = new Set(state.searchResults.map((r) => r.photo.id));
      const newlyRestoredSearchItems: SearchResultItem[] = updatedPhotos
        .filter(
          (p) =>
            !p.quarantined &&
            !p.isVaultDocument &&
            restoredIdsAfterReplace.has(p.id) &&
            !existingSearchIds.has(p.id)
        )
        .map((photo) => ({
          photo,
          score: 0.99,
          matchPercentage: 99,
          matchedBy: 'text-direct'as const,
        }));
      const refreshedSearchResults: SearchResultItem[] = inSharedLounge
        ? state.searchResults
        : state.hasExecutedUserSearch
        ? [...newlyRestoredSearchItems, ...state.searchResults]
        : updatedPhotos
            .filter((p) => !p.quarantined && !p.isVaultDocument)
            .map((photo) => ({
              photo,
              score: 0.99,
              matchPercentage: 99,
              matchedBy: 'text-direct'as const,
            }));

      let nextLastUndoBatch = state.lastUndoBatch;
      if (nextLastUndoBatch && nextLastUndoBatch.fileNames.length > 0) {
        const remainingUndoPhotos = updatedPhotos.filter(
          (p) =>
            p.quarantined &&
            (nextLastUndoBatch!.fileNames.includes(p.id) ||
              nextLastUndoBatch!.fileNames.includes(p.name))
        );
        nextLastUndoBatch =
          remainingUndoPhotos.length === 0
            ? null
            : {
                ...nextLastUndoBatch,
                fileNames: remainingUndoPhotos.map((p) => p.id),
                count: remainingUndoPhotos.length,
                savedBytes: remainingUndoPhotos.reduce((acc, p) => acc + p.size, 0),
              };
      }

      // 1장 이상 복원을 직접 수행해 완료 알림(customToast)을 띄울 때는 직전 '휴지통으로 이동되었습니다' 배너를 닫아
      // 하단 알림창이 즉시 '사진 N장을 복원했습니다'로 깔끔하게 전환되도록 보장
      if (customToast) {
        nextLastUndoBatch = null;
      }

      return {
        photos: updatedPhotos,
        duplicateGroups: nextDupGroups,
        selectedTrashIds: nextSelectedTrashIds,
        activeTrashCategoryFilter: restoredFocusCategory || state.activeTrashCategoryFilter,
        searchResults: refreshedSearchResults,
        lastUndoBatch: nextLastUndoBatch,
        quarantineMoving: false,
        quarantineOpKind: 'idle',
        quarantineRestoreScope: 'idle',
        quarantineRestoringIds: [],
        ...(customToast ? { lastQuarantineToast: customToast } : {}),
      };
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ghosti_photo_restored_from_quarantine'));
    }
    if (!zCoreBridge.isConnected) {
      scheduleSaveCachedMobileGalleryIndex(get().photos, get().videoSceneItems);
    }
  },

  restoreFromQuarantine: async (names: string[], scope?: 'single' | 'all' | 'undo') => {
    if (names.length === 0 || get().quarantineMoving) return;
    const curPhotos = get().photos;
    // 동일 파일명이 activePhotos(quarantined: false)에도 존재할 때 curPhotos.find()가
    // 비격리 항목을 먼저 잡아 validTargets가 빈 배열([])이 되어 복원이 무반응으로 종료되던 버그 원천 차단
    const validTargets = names.filter((target) => {
      const matchedQuarantined = curPhotos.find(
        (p) => p.quarantined && (p.id === target || p.name === target)
      );
      if (matchedQuarantined) return true;
      const anyMatch = curPhotos.find((p) => p.id === target || p.name === target);
      return !anyMatch;
    });
    if (validTargets.length === 0) {
      set({ lastUndoBatch: null });
      return;
    }
    const wireTargets = zCoreBridge.isConnected
      ? validTargets.map((target) => {
          const matched = curPhotos.find(
            (p) => p.quarantined && (p.id === target || p.name === target)
          );
          return matched?.name || target;
        })
      : validTargets;

    // [PC 로컬 Z-코어 0.01초 즉시 복원]: 휴지통 I/O 및 직렬 청크 대기 없이 화면에서 즉시 복원하고,
    // 백그라운드 직렬 큐(enqueueZCoreQuarantineOp)에서 단 1회 배치 HTTP 호출로 실물 파일을 되돌린다(실패 시 자동 원복).
    if (zCoreBridge.isConnected && !isCapacitorNativeMobileRuntime()) {
      const prevPhotosSnap = curPhotos;
      const prevDupGroupsSnap = get().duplicateGroups;
      const prevSelectedTrashSnap = new Set<string>(get().selectedTrashIds);
      const prevSearchResultsSnap = get().searchResults;

      get().syncPhotosAfterExternalRestore(
        validTargets,
        undefined,
        `사진 ${validTargets.length}장을 원래 위치로 되돌렸습니다`
      );

      void enqueueZCoreQuarantineOp(() => requestQuarantineOp('restore', wireTargets)).then((restoreRes) => {
        if (restoreRes.done.length > 0) return;
        const isStaleMissingRecycle =
          !restoreRes.offline &&
          restoreRes.errors.length > 0 &&
          restoreRes.errors.every((e) =>
            /기록이 없습니다|실물 데이터가 없습니다|올바른 휴지통 항목이 아닙니다/.test(String(e?.error || ''))
          );
        if (isStaleMissingRecycle) {
          const staleSet = new Set<string>([...validTargets, ...wireTargets]);
          set((state) => ({
            photos: state.photos.filter((p) => !(staleSet.has(p.id) || staleSet.has(p.name))),
            lastUndoBatch: null,
            lastQuarantineToast:
              '이미 휴지통에서 비워졌거나 외부에서 복원된 이전 기록을 목록에서 정리했습니다.',
          }));
          return;
        }
        // 실제 복원 실패(엔진 끊김 등) 시 안전하게 직전 상태로 원복 후 알림
        set({
          photos: prevPhotosSnap,
          duplicateGroups: prevDupGroupsSnap,
          selectedTrashIds: prevSelectedTrashSnap,
          searchResults: prevSearchResultsSnap,
          quarantineMoving: false,
          quarantineOpKind: 'idle',
          quarantineRestoreScope: 'idle',
          quarantineRestoringIds: [],
          lastQuarantineToast: quarantineFailureToast('restore', restoreRes),
        });
      });
      return;
    }

    const effectiveScope: 'single' | 'all' | 'undo' = scope ?? (validTargets.length === 1 ? 'single' : 'all');
    set({
      quarantineMoving: true,
      quarantineOpKind: 'restore',
      quarantineRestoreScope: effectiveScope,
      quarantineRestoringIds: validTargets,
    });
    try {
      type QOpRes = Awaited<ReturnType<typeof requestQuarantineOp>>;
      const CHUNK_SIZE = 15;
      const doneAll: string[] = [];
      const replacedAll: Record<string, string> = {};
      const errorsAll: QOpRes['errors'] = [];
      let lastRestoreRes: QOpRes | null = null;
      for (let offset = 0; offset < wireTargets.length; offset += CHUNK_SIZE) {
        const chunk = wireTargets.slice(offset, offset + CHUNK_SIZE);
        const chunkRes = await requestQuarantineOp('restore', chunk);
        lastRestoreRes = chunkRes;
        if (chunkRes.done.length > 0) doneAll.push(...chunkRes.done);
        if (chunkRes.replacedIds) Object.assign(replacedAll, chunkRes.replacedIds);
        if (chunkRes.errors?.length) errorsAll.push(...chunkRes.errors);
        if (chunkRes.offline && doneAll.length === 0) break;
      }
      const restoreRes: QOpRes = lastRestoreRes
        ? { ...lastRestoreRes, done: doneAll, replacedIds: replacedAll, errors: errorsAll }
        : { done: [], errors: [], demo: false, offline: false, replacedIds: {} };
      if (restoreRes.done.length === 0) {
        const isStaleMissingRecycle =
          !restoreRes.offline &&
          restoreRes.errors.length > 0 &&
          restoreRes.errors.every((e) =>
            /기록이 없습니다|실물 데이터가 없습니다|올바른 휴지통 항목이 아닙니다/.test(String(e?.error || ''))
          );
        if (isStaleMissingRecycle) {
          const staleSet = new Set<string>([...validTargets, ...wireTargets]);
          set((state) => ({
            quarantineMoving: false,
            quarantineOpKind: 'idle',
            quarantineRestoreScope: 'idle',
            quarantineRestoringIds: [],
            photos: state.photos.filter((p) => !(p.quarantined && (staleSet.has(p.id) || staleSet.has(p.name)))),
            lastUndoBatch: null,
            lastQuarantineToast:
              '이미 휴지통에서 비워졌거나 외부에서 복원된 이전 기록을 목록에서 정리했습니다.',
          }));
          return;
        }
        set({
          quarantineMoving: false,
          quarantineOpKind: 'idle',
          quarantineRestoreScope: 'idle',
          quarantineRestoringIds: [],
          lastQuarantineToast: quarantineFailureToast('restore', restoreRes),
        });
        return;
      }
      get().syncPhotosAfterExternalRestore(
        restoreRes.done,
        restoreRes.replacedIds,
        `사진 ${restoreRes.done.length}장을 ${quarantineResultNote('restore', restoreRes)}`
      );
    } finally {
      if (get().quarantineMoving) {
        set({
          quarantineMoving: false,
          quarantineOpKind: 'idle',
          quarantineRestoreScope: 'idle',
          quarantineRestoringIds: [],
        });
      }
    }
  },

  undoLastQuarantine: async () => {
    if (get().quarantineMoving) return;
    const { lastUndoBatch } = get();
    if (!lastUndoBatch || lastUndoBatch.fileNames.length === 0) return;
    const stillQuarantined = get().photos.filter(
      (p) =>
        p.quarantined &&
        (lastUndoBatch.fileNames.includes(p.id) || lastUndoBatch.fileNames.includes(p.name))
    );
    if (stillQuarantined.length === 0) {
      set({ lastUndoBatch: null });
      return;
    }
    const targetIds = stillQuarantined.map((p) => p.id);
    await get().restoreFromQuarantine(targetIds, 'undo');
    // 실제로 되돌아온 사진만 Undo 목록에서 지우고, 실패한 사진은 다시 시도할 수 있게 남긴다
    const remaining = get().photos.filter((p) => targetIds.includes(p.id) && p.quarantined);
    set({
      lastUndoBatch:
        remaining.length === 0
          ? null
          : {
              ...lastUndoBatch,
              fileNames: remaining.map((p) => p.id),
              count: remaining.length,
              savedBytes: remaining.reduce((acc, p) => acc + p.size, 0),
            },
    });
  },

  dismissUndoBatch: () => set({ lastUndoBatch: null }),

  openLocalFolder: async (
    target: 'quarantine' | 'photos' | 'docs' | 'videos' | 'phone_backup',
    targetPath?: string
  ) => {
    try {
      let cleanTargetPath = (targetPath || '').trim();
      if (!cleanTargetPath && target === 'phone_backup') {
        cleanTargetPath = (get().lastPhoneBackupFolderPath || '').trim();
      }
      if (!cleanTargetPath && target === 'photos') {
        const firstRealPhoto = get().photos.find((p) => !p.quarantined && p.fullPath);
        if (firstRealPhoto?.fullPath) {
          cleanTargetPath = firstRealPhoto.fullPath;
        }
      }
      if (!cleanTargetPath && target === 'videos') {
        const firstRealVideo = get().videoSceneItems.find((v) => v.fullPath);
        if (firstRealVideo?.fullPath) {
          cleanTargetPath = firstRealVideo.fullPath;
        }
      }
      if (!cleanTargetPath && target === 'docs') {
        const firstRealDoc = get().localDocuments.find(
          (d) => (d as { fullPath?: string; path?: string }).fullPath || (d as { fullPath?: string; path?: string }).path
        );
        const docPath =
          (firstRealDoc as { fullPath?: string; path?: string } | undefined)?.fullPath ||
          (firstRealDoc as { fullPath?: string; path?: string } | undefined)?.path;
        if (docPath) {
          cleanTargetPath = String(docPath);
        }
      }
      let openedOk = false;
      if (cleanTargetPath) {
        const osRes = await executeRealOsAction('open_file_location', cleanTargetPath);
        if (osRes?.ok) {
          openedOk = true;
        } else {
          const r = await fetch(getZCoreUrl('/__quarantine/open-folder'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target, targetPath: cleanTargetPath }),
          });
          const j = r.ok ? await r.json().catch(() => null) : null;
          openedOk = Boolean(j?.ok);
        }
      } else {
        const r = await fetch(getZCoreUrl('/__quarantine/open-folder'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target }),
        });
        const j = r.ok ? await r.json().catch(() => null) : null;
        openedOk = Boolean(j?.ok);
        // [탐색기 0.1초 즉시 오픈 정공법]: 백업 폴더 열기 전에 전체 원본 다운로드를 블로킹 대기하지 않고
        // Windows 탐색기를 먼저 즉시 띄운 뒤, 미수신 스마트폰 원본은 백그라운드로 실시간 채워 넣음
        if (target === 'phone_backup' && openedOk) {
          void import('../../services/deviceIntegrationService')
            .then(({ pullPendingMirrorOriginalsToPcBackupFolder }) =>
              pullPendingMirrorOriginalsToPcBackupFolder()
            )
            .then((pullRes) => {
              if (pullRes && pullRes.pulledCount > 0) {
                set({
                  lastQuarantineToast: `스마트폰 원본 사진 ${pullRes.pulledCount}장을 [Ghosti_Phone_Backup] 폴더에 추가 저장했습니다.`,
                });
              }
            })
            .catch(() => {
              /* ignore background pull error */
            });
        }
      }
      if (!openedOk) {
        set({ lastQuarantineToast: '내 컴퓨터 연결(PC 엔진) 상태를 확인한 뒤 다시 폴더 열기를 눌러 주세요.' });
        return;
      }
      const fileLabel = cleanTargetPath ? cleanTargetPath.split(/[\\/]/).pop() || cleanTargetPath : '';
      set({
        lastQuarantineToast:
          cleanTargetPath
            ? `윈도우 탐색기에서 [${fileLabel}] 실제 원본 위치를 열었습니다.`
            : target === 'phone_backup'
            ? '윈도우 탐색기에서 [내 PC  사진  Ghosti_Phone_Backup] 폰 백업 폴더를 열었습니다.'
            : target === 'quarantine'
            ? 'OS 기본 [휴지통] 이동 내역 폴더를 열었습니다.'
            : target === 'docs'
            ? '윈도우 탐색기에서 내 PC 문서 폴더를 열었습니다.'
            : target === 'videos'
            ? '윈도우 탐색기에서 내 PC 동영상 폴더를 열었습니다.'
            : '윈도우 탐색기에서 원본 사진 폴더를 열었습니다.',
      });
    } catch {
      /* ignore */
    }
  },

  dismissQuarantineToast: () => set({ lastQuarantineToast: null }),
  showToast: (msg: string) => set({ lastQuarantineToast: msg }),

  isStoreAppMode:
    typeof window !== 'undefined' &&
    (Boolean(
      (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
    ) ||
      new URLSearchParams(window.location.search).get('storeApp') === '1' ||
      (new URLSearchParams(window.location.search).get('master') === 'pc' &&
        (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 860))),
  enableSetupMonster:
    typeof window !== 'undefined'
      ? !(
          Boolean(
            (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
          ) || new URLSearchParams(window.location.search).get('storeApp') === '1'
        )
      : true,
  enableMobileCoinDisplay: false,
  showCoinBalanceInApp: false,
  enablePcGuideShareButton: true,
  showMobileMasterPcIntroModal:
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('master') === 'pc' &&
    (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 860),

  setIsStoreAppMode: (isStoreAppMode) =>
    set((state) => ({
      isStoreAppMode,
      enableSetupMonster: isStoreAppMode ? false : true,
      showCoinBalanceInApp: isStoreAppMode ? state.enableMobileCoinDisplay : state.enableMobileCoinDisplay,
      lastQuarantineToast: isStoreAppMode
        ? '[1차 출시용 모바일 클린 모드(isStoreAppMode=true)] 활성화: enableSetupMonster=false 및 크레딧 잔액을 숨기고 스토어 심사 프리패스 모드로 전환했습니다.'
        : '[데스크톱(PC) 마스터 모드(isStoreAppMode=false)] 활성화:  귀신같이 손보기(enableSetupMonster=true) 및 모든 마스터 기능이 활성화되었습니다.',
    })),

  setEnableSetupMonster: (enableSetupMonster) =>
    set({
      enableSetupMonster,
      enableMobileCoinDisplay: enableSetupMonster,
      showCoinBalanceInApp: enableSetupMonster,
      lastQuarantineToast: enableSetupMonster
        ? '[원격 토글 enableSetupMonster=true] 귀신같이 손보기(AI 스마트폰 & PC 통합 설정 해결사) 및 상단 크레딧 지갑이 즉시 개통되었습니다!'
        : '[1차 스토어 심사 방어 enableSetupMonster=false] 모바일 스토어 모드에서 귀신같이 손보기와 크레딧 잔액을 잠시 숨김 처리했습니다.',
    }),

  setEnableMobileCoinDisplay: (enableMobileCoinDisplay) =>
    set({
      enableMobileCoinDisplay,
      showCoinBalanceInApp: enableMobileCoinDisplay,
      lastQuarantineToast: enableMobileCoinDisplay
        ? '[코인 잔액 표시(enableMobileCoinDisplay=true)] 활성화: 상단 헤더에 멀린허브 코인 잔액이 표시됩니다.'
        : '[코인 잔액 완전 비노출(showCoinBalanceInApp=false)] 기본값 적용 완료.',
    }),

  setEnablePcGuideShareButton: (enablePcGuideShareButton) =>
    set({
      enablePcGuideShareButton,
      lastQuarantineToast: enablePcGuideShareButton
        ? '[원격 토글 enablePcGuideShareButton=true] 카톡·이메일 PC 연동 가이드 전송 버튼이 활성화되었습니다.'
        : '[원격 토글 enablePcGuideShareButton=false] 스토어 심사 보호를 위해 PC 연동 가이드 전송 버튼이 즉시 숨김 처리되었습니다.',
    }),

  setShowMobileMasterPcIntroModal: (showMobileMasterPcIntroModal) =>
    set({ showMobileMasterPcIntroModal }),

  // ─────────────── [🛠️ 설정몬스터 (AI 스마트폰 & PC 통합 설정 해결사) 스토어 상태 및 액션] ───────────────
  showSetupMonsterModal: false,
  setupMonsterPlatform:
    typeof window !== 'undefined' &&
    (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 860)
      ? 'mobile'
      : 'pc',
  setupProactiveHints: INITIAL_PROACTIVE_HINTS,
  setupChatTurns: [    {
      id: 'welcome_setup_monster',
      role: 'assistant_triage',
      timestamp: '방금',
      text: '안녕하세요! ✋ 귀신같이 손보기 대화창입니다.\n• 🆓 [내 기기]의 모든 사진·파일 정리, PC 속도 검진, 수리, 복원, 내 PC 사양 상담, 바탕화면 바로가기 생성은 코인 차감 없이 무료입니다.\n• 🛡️ 모든 실행 전 [실물 증거 미리보기 게이트(Zero-Auto-Action)]를 먼저 보여드리며, 유저님이 [⭕ 확인 완료]를 누르시기 전에는 절대 임의로 실행하지 않습니다.\n• 🕰️ 모든 변경 0.01초 전 [복원 기록]을 남기며, 🟢[100% 완벽 복원 가능] / 🟡[부분 복원 가능] / 🔴[복원 불가] 3단계 무결성 사전 검진(Pre-Check) 후 원래 상태로 되돌릴 수 있습니다.',
      triageQuestion: buildSetupPreTriageQuestion(
        'pc',
        '부팅 시 뜨는 광고/유령앱 차단',
        'pc_boot_ads'
      ),
      triageAnswered: false,
    },
  ],
  setupAuditLogs: [],
  setupFailureTelemetryQueue: [],
  setupSelfHealingOtaQueue: [],
  pendingTriageQuestion: buildSetupPreTriageQuestion(
    'pc',
    '부팅 시 뜨는 광고/유령앱 차단',
    'pc_boot_ads'
  ),
  setupEscrowHoldingCoins: 0,
  merlinCoinTopupBridge: {
    open: false,
    targetPlan: null,
    requiredCoins: 0,
    currentCoins: 0,
    deficitCoins: 0,
  },
  activeOverlayPlan: null,
  activeOverlayStepIndex: 0,
  activeOverlayBacktrackCount: 0,
  uiFontScalePercent: 100,
  uiNightEyeProtection: false,

  setShowSetupMonsterModal: (showSetupMonsterModal, platform) =>
    set((state) => ({
      // [v2.1 감산] 레거시 SetupMonsterModal 팝업 진입점 비활성화 -> 1. 👻 귀신비서(personal/trash) 채팅 칩으로 일원화
      showSetupMonsterModal: false,
      setupMonsterPlatform: platform ?? state.setupMonsterPlatform,
      ...(showSetupMonsterModal
        ? { activeLoungeType: 'personal', desktopTab: 'trash' }
        : {}),
    })),

  setSetupMonsterPlatform: (setupMonsterPlatform) =>
    set({ setupMonsterPlatform }),

  setSimulatedMerlinCoinBalance: (coins) =>
    set((state) => ({
      merlinAuth: {
        ...state.merlinAuth,
        coinBalance: Math.max(0, coins),
      },
      lastQuarantineToast: `[멀린허브 통합 지갑 잔액 시뮬레이션] 현재 보유 멀린코인이 ${Math.max(
        0,
        coins
      ).toLocaleString()} 코인으로 설정되었습니다. (0코인 무료 문진 및 부족분 원클릭 충전 브릿지 테스트 가능)`,
    })),

  openMerlinCoinTopupBridge: (plan) =>
    set((state) => {
      const current = state.merlinAuth.coinBalance;
      const required = plan.creditCost ?? 100;
      const deficit = Math.max(0, required - current);
      return {
        merlinCoinTopupBridge: {
          open: true,
          targetPlan: plan,
          requiredCoins: required,
          currentCoins: current,
          deficitCoins: deficit,
        },
      };
    }),

  closeMerlinCoinTopupBridge: () =>
    set((state) => ({
      merlinCoinTopupBridge: {
        ...state.merlinCoinTopupBridge,
        open: false,
      },
    })),

  topupMerlinCoinAndStartEscrowRepair: async (topupAmount) => {
    const state = get();
    const bridge = state.merlinCoinTopupBridge;
    const plan = bridge.targetPlan;
    const addCoins = Math.max(
      topupAmount ?? bridge.deficitCoins,
      bridge.deficitCoins > 0 ? bridge.deficitCoins : 200
    );

    set((s) => ({
      merlinAuth: {
        ...s.merlinAuth,
        coinBalance: s.merlinAuth.coinBalance + addCoins,
      },
      merlinCoinTopupBridge: {
        ...s.merlinCoinTopupBridge,
        open: false,
      },
      lastQuarantineToast: `[멀린허브 원클릭 충전 완료 (+${addCoins} 코인)] 충전 즉시 ${
        plan?.creditCost ?? 300
      } 코인 에스크로 홀딩(Escrow Holding)을 걸고 1초 자동 수리에 돌입합니다!`,
    }));

    if (plan) {
      await get().approveAndExecuteSetupPlan(plan);
    }
  },

  confirmSetupEscrowSettlement: (auditId) =>
    set((state) => {
      const targetAudit =
        (auditId
          ? state.setupAuditLogs.find((a) => a.auditId === auditId)
          : state.setupAuditLogs.find((a) => a.escrowStatus === 'ESCROW_HOLDING')) ??
        null;
      const settledCoins = targetAudit?.creditDeducted ?? 0;
      return {
        setupEscrowHoldingCoins: Math.max(
          0,
          state.setupEscrowHoldingCoins - settledCoins
        ),
        setupAuditLogs: state.setupAuditLogs.map((a) =>
          targetAudit && a.auditId === targetAudit.auditId
            ? { ...a, escrowStatus: 'SETTLED_COMPLETED'as const }
            : a
        ),
        setupChatTurns: state.setupChatTurns.map((t) =>
          targetAudit && t.auditId === targetAudit.auditId
            ? { ...t, escrowStatus: 'SETTLED_COMPLETED'as const }
            : t
        ),
        lastQuarantineToast: `[완치 확인 · 에스크로 최종 정산 완료] 홀딩 중이던 ${settledCoins} 멀린코인이 정상 정산 확정되었습니다!`,
      };
    }),

  loadSetupMonsterState: async () => {
    triggerSetupMonsterTtsPrewarm();
    try {
      const res = await fetch(getZCoreUrl('/__setup-monster/state'));
      const data = await res.json();
      if (data?.ok) {
        set((state) => ({
          setupAuditLogs: Array.isArray(data.auditLogs)
            ? data.auditLogs
            : state.setupAuditLogs,
          setupFailureTelemetryQueue: Array.isArray(data.failureTelemetryQueue)
            ? data.failureTelemetryQueue
            : state.setupFailureTelemetryQueue,
          setupSelfHealingOtaQueue: Array.isArray(data.selfHealingOtaQueue)
            ? data.selfHealingOtaQueue
            : state.setupSelfHealingOtaQueue,
        }));
      }
    } catch {
      /* ignore */
    }
  },

  submitSetupMonsterQuery: async (query, presetIdHint, platformOverride) => {
    if (!ensureLoginAndZCoreReady('손보기 고치기')) return;
    const clean = query.trim();
    if (!clean) return;
    const state = get();
    const platform = platformOverride ?? state.setupMonsterPlatform;
    const nowLabel = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const userTurn: SetupChatTurn = {
      id: `user_${Date.now()}`,
      role: 'user',
      timestamp: nowLabel,
      text: clean,
    };

    // 유저가 채팅창에 "2번 헤맸어 / 초행길 / 두 번 뒤로 갔어" 등을 말하면 완료된 수리는 유지하면서 100% 쿨 환불(인간미 환불) 실행
    if (
      /두\s*번|2\s*번|초행길|헤매|헤맸|헛클릭/i.test(clean) &&
      !presetIdHint &&
      state.setupAuditLogs.length > 0
    ) {
      set((s) => ({
        setupChatTurns: [...s.setupChatTurns, userTurn],
      }));
      await get().triggerEmpathyRefundForCompletedRepair(undefined, 2);
      return;
    }

    // 유저가 채팅창에 "아직 해결 안 됨 / 안 고쳐졌어 / 환불해줘" 등 수리 실패를 말하면 즉시 원상복구 + 에스크로 100% 반환 + 본사 실패 로그 전송 실행
    if (
      /해결\s*안|안\s*고쳐|그대로|환불|여전히\s*먹통|실패/i.test(clean) &&
      !presetIdHint
    ) {
      set((s) => ({
        setupChatTurns: [...s.setupChatTurns, userTurn],
      }));
      await get().reportUnresolvedAndRefundSetup();
      return;
    }

    // 유저가 채팅창에 "어? 바꿨더니 불편해, 원래대로 해줘" 등 단순 원상복구 의도를 말하면 즉시 1초 Undo 실행
    if (/원래대로|되돌려|복구해|불편해|취소|undo/i.test(clean) && !presetIdHint) {
      set((s) => ({
        setupChatTurns: [...s.setupChatTurns, userTurn],
      }));
      await get().undoSetupMonsterRepair();
      return;
    }

    // [PC 환경: 선(先) 무료 문진 & Merlin_Z_Core_Setup.exe 백그라운드 사태 파악 (잔액 0코인이어도 100% 무료!) ➔ 후(後) 난이도별 차등 견적 & 멀린허브 잔액 Pre-Check]
    if (platform === 'pc') {
      if (state.pendingTriageQuestion && !presetIdHint) {
        const activeTriage = state.pendingTriageQuestion;
        const combinedQuery = `${activeTriage.symptomQuery} — ${clean}`;
        const plan = buildSetupDiagnosisPlan('pc', combinedQuery, activeTriage.presetId);
        const currentCoins = state.merlinAuth.coinBalance;
        const deficit = Math.max(0, plan.creditCost - currentCoins);
        const preCheckLine =
          deficit > 0
            ? `[멀린허브 통합 지갑 사전 잔액 체크(Pre-Check)] 필요 견적 ${plan.creditCost} 코인 / 현재 보유 ${currentCoins} 코인  멀린코인 ${deficit}개가 부족합니다. 아래 [멀린코인 ${deficit}개가 부족합니다 — 충전 후 바로 고치기] 버튼을 누르면 즉시 충전 후 에스크로 수리에 돌입합니다.`
            : `[멀린허브 통합 지갑 사전 잔액 체크(Pre-Check)] 필요 견적 ${plan.creditCost} 코인 / 현재 보유 ${currentCoins.toLocaleString()} 코인 (충분)  아래 버튼으로 ${plan.creditCost} 코인 에스크로 홀딩 후 즉시 수리를 시작할 수 있습니다.`;

        const assistantTurn: SetupChatTurn = {
          id: `ai_${Date.now() + 1}`,
          role: 'assistant',
          timestamp: nowLabel,
          text: `무엇이 불편하신지 확인했습니다. 아래 버튼을 누르시면 바로 고쳐 드립니다.`,
          diagnosisPlan: plan,
        };

        set((s) => ({
          setupMonsterPlatform: 'pc',
          pendingTriageQuestion: null,
          setupChatTurns: s.setupChatTurns
            .map((t) =>
              t.triageQuestion?.questionId === activeTriage.questionId
                ? { ...t, triageAnswered: true }
                : t
            )
            .concat([userTurn, assistantTurn]),
        }));
        return;
      }

      // 신규 PC 증상 입력 또는 증상 칩 클릭 ➔ 잔액이 0코인이어도 100% 무료로 사전 문진 & .exe 백그라운드 스캔 진행!
      const triageQ = buildSetupPreTriageQuestion('pc', clean, presetIdHint);
      const triageTurn: SetupChatTurn = {
        id: `triage_${Date.now() + 1}`,
        role: 'assistant_triage',
        timestamp: nowLabel,
        text: `${triageQ.questionText}`,
        triageQuestion: triageQ,
        triageAnswered: false,
      };

      set((s) => ({
        setupMonsterPlatform: 'pc',
        pendingTriageQuestion: triageQ,
        setupChatTurns: [...s.setupChatTurns, userTurn, triageTurn],
      }));
      return;
    }

    // [모바일 환경: 단순 설정 변경 100 코인 단일 요금 + 멀린허브 사전 잔액 체크(Pre-Check)]
    const plan = buildSetupDiagnosisPlan('mobile', clean, presetIdHint);
    const currentCoins = state.merlinAuth.coinBalance;
    const deficit = Math.max(0, plan.creditCost - currentCoins);
    const preCheckLine =
      deficit > 0
        ? `[멀린허브 지갑 사전 잔액 체크] 필요 100 코인 / 보유 ${currentCoins} 코인  멀린코인 ${deficit}개가 부족합니다 (충전 후 바로 고치기 지원).`
        : `[멀린허브 지갑 사전 잔액 체크] 필요 100 코인 / 보유 ${currentCoins.toLocaleString()} 코인 (에스크로 홀딩 가능).`;

    const assistantTurn: SetupChatTurn = {
      id: `ai_${Date.now() + 1}`,
      role: 'assistant',
      timestamp: nowLabel,
      text: `무엇이 불편하신지 확인했습니다. 아래 버튼을 누르시면 바로 고쳐 드립니다.`,
      diagnosisPlan: plan,
    };

    set((s) => ({
      setupMonsterPlatform: 'mobile',
      setupChatTurns: [...s.setupChatTurns, userTurn, assistantTurn],
    }));
  },

  answerSetupPreTriage: async (questionId, detailAnswer, presetId, skipDirectQuote) => {
    const state = get();
    const nowLabel = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const userTurn: SetupChatTurn = {
      id: `user_triage_${Date.now()}`,
      role: 'user',
      timestamp: nowLabel,
      text: skipDirectQuote
        ? `[문진 완료 · 즉시 견적 요청] ${detailAnswer}`
        : detailAnswer,
    };

    const plan = buildSetupDiagnosisPlan('pc', detailAnswer, presetId);
    const currentCoins = state.merlinAuth.coinBalance;
    const deficit = Math.max(0, plan.creditCost - currentCoins);
    const preCheckLine =
      deficit > 0
        ? `[멀린허브 통합 지갑 사전 잔액 체크(Pre-Check)] 필요 견적 ${plan.creditCost} 코인 / 현재 보유 ${currentCoins} 코인  멀린코인 ${deficit}개가 부족합니다! 아래 [멀린코인 ${deficit}개가 부족합니다 — 충전 후 바로 고치기] 버튼을 누르면 즉시 충전 후 에스크로 수리에 돌입합니다.`
        : `[멀린허브 통합 지갑 사전 잔액 체크(Pre-Check)] 필요 견적 ${plan.creditCost} 코인 / 현재 보유 ${currentCoins.toLocaleString()} 코인 (충분)  [${plan.creditCost} 코인 에스크로 홀딩 후 수리 시작] 버튼이 활성화되었습니다.`;

    const assistantTurn: SetupChatTurn = {
      id: `ai_quote_${Date.now() + 1}`,
      role: 'assistant',
      timestamp: nowLabel,
      text: `무엇이 불편하신지 확인했습니다. 아래 버튼을 누르시면 바로 고쳐 드립니다.`,
      diagnosisPlan: plan,
    };

    set((s) => ({
      pendingTriageQuestion: null,
      setupChatTurns: s.setupChatTurns
        .map((t) =>
          t.triageQuestion?.questionId === questionId
            ? { ...t, triageAnswered: true }
            : t
        )
        .concat([userTurn, assistantTurn]),
    }));
  },

  approveAndExecuteSetupPlan: async (plan, simulatedBacktrackCount) => {
    const state = get();
    const cost = 0; // [멀린님 확정 A1]: [내 기기] 치우기·고치기는 코인 차감 없이 무료!

    const effectiveBacktrack = Math.max(0, Math.floor(simulatedBacktrackCount ?? 0));
    const nowIso = new Date().toISOString();
    const nowLabel = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const auditId = `audit_${Date.now()}`;
    const conversationSummary = state.setupChatTurns
      .slice(-4)
      .map((t) => `[${t.role}] ${t.text}`);

    const evalResult = evaluateTrajectoryAndBuildSelfHealingOta({
      plan,
      auditId,
      backtrackCount: effectiveBacktrack,
    });

    const isEmpathyRefund = evalResult.shouldEmpathyRefund100Pct;

    let savedAudit: SetupAuditLogEntry = {
      auditId,
      createdAt: nowIso,
      userApprovedAt: nowIso,
      platform: plan.platform,
      track: plan.track,
      difficultyLevel: plan.difficultyLevel,
      escrowStatus: isEmpathyRefund ? 'RELEASED_EMPATHY_REFUND' : 'ESCROW_HOLDING',
      backtrackCount: effectiveBacktrack,
      trajectoryGrade: evalResult.trajectoryGrade,
      symptomQuery: plan.symptomQuery,
      title: plan.title,
      agentModuleName: plan.agentModuleName,
      systemCommandOrApi: plan.systemCommandOrApi,
      beforeSnapshot: plan.beforeSnapshot,
      afterSnapshot: plan.afterSnapshot,
      creditDeducted: cost,
      domCaptureHash: `dom_${Date.now().toString(16)}`,
      conversationSummary,
      undone: false,
      refunded: isEmpathyRefund,
      refundedAt: isEmpathyRefund ? nowIso : undefined,
    };

    // [정직 원칙] 실제로 실행되고 Z-코어가 성공을 확인한 항목만 '완료'로 표시한다.
    let realExecution: { ok: boolean; message: string } | null = null;
    if (plan.platform === 'pc' && plan.presetId === 'pc_work_s_drive') {
      try {
        const osRes = await executeRealOsAction('s_drive_mount');
        if (osRes?.ok) {
          if (osRes.beforeSnapshot) savedAudit.beforeSnapshot = osRes.beforeSnapshot as Record<string, unknown>;
          if (osRes.afterSnapshot) savedAudit.afterSnapshot = osRes.afterSnapshot as Record<string, unknown>;
          realExecution = { ok: true, message: plan.completionMessage };
        } else {
          realExecution = {
            ok: false,
            message: `S: 드라이브를 연결하지 못했습니다: ${String(osRes?.message || osRes?.error || '멀린 Z-코어 연결을 확인해 주세요')}`,
          };
        }
        await fetchRealPcOsInspection();
      } catch {
        realExecution = { ok: false, message: '멀린 Z-코어에 연결되지 않아 실행하지 못했습니다. (아무 설정도 바뀌지 않았습니다)' };
      }
    } else if (
      plan.platform === 'pc' &&
      (plan.presetId === 'pc_boot_ads' || plan.presetId === 'pc_security_plugin')
    ) {
      try {
        const osRes = await executeRealOsAction('boot_lag_clean_bloatware');
        if (osRes?.ok) {
          const msg = String(osRes.summaryKo || osRes.message || plan.completionMessage);
          realExecution = { ok: true, message: msg };
        } else {
          realExecution = {
            ok: false,
            message: `애드웨어·보안 프로세스 정리를 완료하지 못했습니다: ${String(osRes?.message || osRes?.error || '멀린 Z-코어 연결을 확인해 주세요')}`,
          };
        }
        void fetchRealPcOsInspection();
      } catch {
        realExecution = { ok: false, message: '멀린 Z-코어에 연결되지 않아 실행하지 못했습니다.' };
      }
    }
    const honestCompletionMessage = realExecution
      ? realExecution.message
      : '이 항목은 아직 귀신같이가 자동으로 실행하지 않습니다. PC 설정을 바꾸지 않았으니, 위 진단 내용과 안내 단계를 보고 직접 진행해 주세요.';

    try {
      const res = await fetch(getZCoreUrl('/__setup-monster/execute'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...savedAudit,
          selfHealingOta: evalResult.otaEntry,
        }),
        signal: AbortSignal.timeout(800),
      });
      const data = await res.json();
      if (data?.ok && data.auditEntry) {
        savedAudit = {
          ...data.auditEntry,
          escrowStatus: isEmpathyRefund ? 'RELEASED_EMPATHY_REFUND' : 'ESCROW_HOLDING',
          backtrackCount: effectiveBacktrack,
          trajectoryGrade: evalResult.trajectoryGrade,
          refunded: isEmpathyRefund,
        };
      }
    } catch {
      /* ignore offline fallback */
    }

    // 음성 합성(TTS) 안내 재생 (남성 성우 '현수' 단일 파이프라인 직결)
    try {
      const ttsText = realExecution?.ok ? plan.voiceTtsSummary : honestCompletionMessage.replace(/^⚠️\s*/, '');
      void speakWithHyunsuOrSunhi(ttsText, 'hyunsu_briefing');
    } catch {
      /* ignore tts error */
    }

    const repairTurn: SetupChatTurn = {
      id: `repair_${Date.now()}`,
      role: 'system_repair',
      timestamp: nowLabel,
      text: honestCompletionMessage,
      diagnosisPlan: plan,
      auditId: savedAudit.auditId,
      escrowStatus: isEmpathyRefund ? 'RELEASED_EMPATHY_REFUND' : 'ESCROW_HOLDING',
      backtrackCount: effectiveBacktrack,
      trajectoryGrade: evalResult.trajectoryGrade,
      selfHealingOta: evalResult.otaEntry ?? undefined,
      undone: false,
      refunded: isEmpathyRefund,
      refundedAmount: isEmpathyRefund ? cost : undefined,
    };

    const nextTurns: SetupChatTurn[] = [...state.setupChatTurns, repairTurn];

    if (isEmpathyRefund && evalResult.otaEntry) {
      const empathyTurn: SetupChatTurn = {
        id: `empathy_refund_${Date.now() + 1}`,
        role: 'system_empathy_refund',
        timestamp: nowLabel,
        text: evalResult.empathyBriefingChatKo,
        diagnosisPlan: plan,
        auditId: savedAudit.auditId,
        escrowStatus: 'RELEASED_EMPATHY_REFUND',
        backtrackCount: effectiveBacktrack,
        trajectoryGrade: evalResult.trajectoryGrade,
        selfHealingOta: evalResult.otaEntry,
        undone: false, // 수리 완료 상태는 그대로 유지!
        refunded: true,
        refundedAmount: cost,
      };
      nextTurns.push(empathyTurn);
    }

    set((s) => ({
      // 2회 이상 헤맨 성공(isEmpathyRefund)일 때는 에스크로 홀딩된 코인을 즉시 100% 환불하여 유저 지갑 잔액 차감 0원!
      merlinAuth: {
        ...s.merlinAuth,
        coinBalance: isEmpathyRefund
          ? s.merlinAuth.coinBalance
          : Math.max(0, s.merlinAuth.coinBalance - cost),
      },
      setupEscrowHoldingCoins: isEmpathyRefund
        ? s.setupEscrowHoldingCoins
        : s.setupEscrowHoldingCoins + cost,
      setupAuditLogs: [savedAudit, ...s.setupAuditLogs],
      setupSelfHealingOtaQueue: evalResult.otaEntry
        ? [evalResult.otaEntry, ...s.setupSelfHealingOtaQueue]
        : s.setupSelfHealingOtaQueue,
      setupChatTurns: nextTurns,
      setupProactiveHints: s.setupProactiveHints.map((h) =>
        h.presetId === plan.presetId ? { ...h, resolved: true } : h
      ),
      uiFontScalePercent: plan.uiFontScalePercent ?? s.uiFontScalePercent,
      uiNightEyeProtection:
        typeof plan.uiNightProtection === 'boolean'
          ? plan.uiNightProtection
          : s.uiNightEyeProtection,
      activeOverlayPlan:
        plan.track === 'TRACK_B_OVERLAY_GUIDE' &&
        plan.overlaySteps?.length &&
        simulatedBacktrackCount === undefined
          ? plan
          : s.activeOverlayPlan,
      activeOverlayStepIndex: 0,
      activeOverlayBacktrackCount: 0,
      lastQuarantineToast: isEmpathyRefund
        ? evalResult.empathyApologyToastKo
        : effectiveBacktrack === 1
        ? `[1회 뒤로 가기 인간적 허용 · 무료] 1회 우회 갈림길 로그를 본사로 전송해 0회 직행 코스로 미세 교정(OTA)했습니다!`
        : `[내 기기 수리 완료 — [복원 기록] 자동 저장] 언제든 원래 상태로 되돌릴 수 있습니다!`,
    }));
  },

  triggerEmpathyRefundForCompletedRepair: async (auditId, backtrackCount = 2) => {
    const state = get();
    const targetAudit =
      (auditId
        ? state.setupAuditLogs.find((a) => a.auditId === auditId)
        : state.setupAuditLogs.find((a) => !a.refunded)) ?? null;

    if (!targetAudit) {
      set({
        lastQuarantineToast:
          '환불할 최근 수리 내역이 없습니다. 먼저 수리를 실행하거나 견적 카드에서 [2회 헤맨 성공 시뮬레이션]을 눌러보세요!',
      });
      return;
    }

    if (targetAudit.refunded) {
      set({
        lastQuarantineToast: '이미 100% 자동 환불 완료된 수리 내역입니다.',
      });
      return;
    }

    const effectiveBacktrack = Math.max(2, Math.floor(backtrackCount));
    const matchingTurn = state.setupChatTurns.find(
      (t) => t.auditId === targetAudit.auditId && t.diagnosisPlan
    );
    const plan =
      matchingTurn?.diagnosisPlan ??
      buildSetupDiagnosisPlan(targetAudit.platform, targetAudit.symptomQuery);
    const refundCoins = targetAudit.creditDeducted ?? plan.creditCost ?? 100;

    const evalResult = evaluateTrajectoryAndBuildSelfHealingOta({
      plan,
      auditId: targetAudit.auditId,
      backtrackCount: effectiveBacktrack,
    });

    const nowIso = new Date().toISOString();
    const nowLabel = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    try {
      await fetch(getZCoreUrl('/__setup-monster/self-healing-ota'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId: targetAudit.auditId,
          backtrackCount: effectiveBacktrack,
          trajectoryGrade: evalResult.trajectoryGrade,
          escrowStatus: 'RELEASED_EMPATHY_REFUND',
          refunded: true,
          otaEntry: evalResult.otaEntry,
        }),
      });
    } catch {
      /* ignore */
    }

    try {
      void speakWithHyunsuOrSunhi(
        '두 번 이상 길을 헤매게 해드려 죄송합니다. 이번 수리비는 받지 않고 전액 환불해 드렸습니다.',
        'hyunsu_briefing'
      );
    } catch {
      /* ignore */
    }

    const empathyTurn: SetupChatTurn = {
      id: `empathy_refund_${Date.now()}`,
      role: 'system_empathy_refund',
      timestamp: nowLabel,
      text: evalResult.empathyBriefingChatKo,
      diagnosisPlan: plan,
      auditId: targetAudit.auditId,
      escrowStatus: 'RELEASED_EMPATHY_REFUND',
      backtrackCount: effectiveBacktrack,
      trajectoryGrade: evalResult.trajectoryGrade,
      selfHealingOta: evalResult.otaEntry ?? undefined,
      undone: false, // 과업 자체는 최종 성공했으므로 수리 완료 상태 그대로 유지!
      refunded: true,
      refundedAmount: refundCoins,
    };

    set((s) => ({
      merlinAuth: {
        ...s.merlinAuth,
        coinBalance: s.merlinAuth.coinBalance + refundCoins,
      },
      setupEscrowHoldingCoins:
        targetAudit.escrowStatus === 'ESCROW_HOLDING'
          ? Math.max(0, s.setupEscrowHoldingCoins - refundCoins)
          : s.setupEscrowHoldingCoins,
      setupAuditLogs: s.setupAuditLogs.map((a) =>
        a.auditId === targetAudit.auditId
          ? {
              ...a,
              escrowStatus: 'RELEASED_EMPATHY_REFUND'as const,
              backtrackCount: effectiveBacktrack,
              trajectoryGrade: evalResult.trajectoryGrade,
              refunded: true,
              refundedAt: nowIso,
            }
          : a
      ),
      setupSelfHealingOtaQueue: evalResult.otaEntry
        ? [evalResult.otaEntry, ...s.setupSelfHealingOtaQueue]
        : s.setupSelfHealingOtaQueue,
      setupChatTurns: s.setupChatTurns
        .map((t) =>
          t.auditId === targetAudit.auditId
            ? {
                ...t,
                escrowStatus: 'RELEASED_EMPATHY_REFUND'as const,
                backtrackCount: effectiveBacktrack,
                trajectoryGrade: evalResult.trajectoryGrade,
                selfHealingOta: evalResult.otaEntry ?? t.selfHealingOta,
                refunded: true,
                refundedAmount: refundCoins,
              }
            : t
        )
        .concat(empathyTurn),
      activeOverlayPlan: null,
      activeOverlayStepIndex: 0,
      activeOverlayBacktrackCount: 0,
      lastQuarantineToast: evalResult.empathyApologyToastKo,
    }));
  },

  undoSetupMonsterRepair: async (auditId) => {
    const state = get();
    const targetAudit =
      (auditId
        ? state.setupAuditLogs.find((a) => a.auditId === auditId)
        : state.setupAuditLogs.find((a) => !a.undone)) ?? null;

    // [정직 원칙] 실제로 되돌린 것만 되돌렸다고 알린다. (자동 실행을 지원하는 항목은 S: 드라이브 연결뿐)
    let undoMessage = '↩️ 귀신같이가 자동으로 바꾼 PC 설정이 없어 되돌릴 것이 없습니다. (화면 기록만 정리했습니다)';
    if (targetAudit?.platform === 'pc') {
      if (targetAudit.title.includes('S:') || targetAudit.symptomQuery.includes('S:')) {
        try {
          const r = await executeRealOsAction('s_drive_unmount');
          undoMessage = r?.ok
            ? '↩️ 연결했던 S: 업무 드라이브를 해제해 원래 상태로 되돌렸습니다.'
            : `S: 드라이브를 해제하지 못했습니다: ${String(r?.message || r?.error || '멀린 Z-코어 연결을 확인해 주세요')}`;
        } catch {
          undoMessage = '멀린 Z-코어에 연결되지 않아 되돌리지 못했습니다.';
        }
      }
      try {
        await fetchRealPcOsInspection();
      } catch {
        /* ignore */
      }
    }

    try {
      await fetch(getZCoreUrl('/__setup-monster/undo'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId: targetAudit?.auditId }),
      });
    } catch {
      /* ignore */
    }

    const nowIso = new Date().toISOString();
    const nowLabel = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    try {
      void speakWithHyunsuOrSunhi(undoMessage.replace(/^[↩️⚠️\s]+/u, ''), 'hyunsu_briefing');
    } catch {
      /* ignore */
    }

    const undoTurn: SetupChatTurn = {
      id: `undo_${Date.now()}`,
      role: 'system_undo',
      timestamp: nowLabel,
      text: undoMessage,
      auditId: targetAudit?.auditId,
      undone: true,
    };

    set((s) => ({
      setupAuditLogs: s.setupAuditLogs.map((a) =>
        (targetAudit && a.auditId === targetAudit.auditId) || (!targetAudit && !a.undone)
          ? { ...a, undone: true, undoneAt: nowIso }
          : a
      ),
      setupChatTurns: s.setupChatTurns
        .map((t) =>
          targetAudit && t.auditId === targetAudit.auditId ? { ...t, undone: true } : t
        )
        .concat(undoTurn),
      uiFontScalePercent: 100,
      uiNightEyeProtection: false,
      activeOverlayPlan: null,
      activeOverlayBacktrackCount: 0,
      lastQuarantineToast: undoMessage,
    }));
  },

  reportUnresolvedAndRefundSetup: async (auditId, errorCode) => {
    const state = get();
    const targetAudit =
      (auditId
        ? state.setupAuditLogs.find((a) => a.auditId === auditId)
        : state.setupAuditLogs.find((a) => !a.refunded)) ?? null;

    if (targetAudit?.refunded) {
      set({
        lastQuarantineToast: '이미 미해결 신고가 접수된 내역입니다.',
      });
      return;
    }

    const refundCoins = targetAudit?.creditDeducted ?? 100;
    const effectiveErrorCode =
      errorCode ?? 'ERR_SETUP_UNRESOLVED_USER_REPORT_0x80070005';
    const conversationTranscript = state.setupChatTurns
      .slice(-6)
      .map((t) => `[${t.role}] ${t.text}`);
    // 실측하지 않은 OS 버전을 지어내지 않고 브라우저가 알려주는 정보만 기록
    const windowsBuildEnv =
      typeof navigator !== 'undefined' ? navigator.userAgent : (targetAudit?.platform ?? state.setupMonsterPlatform);

    const nowIso = new Date().toISOString();
    const nowLabel = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    let failurePacket: SetupFailureTelemetryEntry = {
      failureId: `fail_${Date.now()}`,
      auditId: targetAudit?.auditId ?? `audit_fallback_${Date.now()}`,
      reportedAt: nowIso,
      platform: targetAudit?.platform ?? state.setupMonsterPlatform,
      difficultyLevel: targetAudit?.difficultyLevel ?? 'LEVEL_2_INTERMEDIATE_300',
      symptomQuery: targetAudit?.symptomQuery ?? '사용자 미해결 환불 요청',
      conversationTranscript,
      windowsBuildEnv,
      attemptedScript:
        targetAudit?.systemCommandOrApi ??
        'Stop-Service Spooler -Force; Remove-Item PRINTERS\\* -Force; Start-Service Spooler',
      errorCode: effectiveErrorCode,
      refundedCoins: refundCoins,
      hqQueueStatus: 'QUEUED_FOR_SCRIPT_PATCH',
    };

    try {
      const res = await fetch(getZCoreUrl('/__setup-monster/report-failure'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId: targetAudit?.auditId,
          platform: failurePacket.platform,
          difficultyLevel: failurePacket.difficultyLevel,
          symptomQuery: failurePacket.symptomQuery,
          conversationTranscript,
          windowsBuildEnv,
          attemptedScript: failurePacket.attemptedScript,
          errorCode: effectiveErrorCode,
          refundedCoins: refundCoins,
        }),
      });
      const data = await res.json();
      if (data?.ok && data.failurePacket) {
        failurePacket = data.failurePacket;
      }
    } catch {
      /* ignore offline fallback */
    }

    try {
      void speakWithHyunsuOrSunhi(
        '해결되지 않았다는 신고를 기록했습니다. 자동으로 바꾼 설정이 있었다면 되돌리기 버튼으로 원래대로 돌릴 수 있습니다.',
        'hyunsu_briefing'
      );
    } catch {
      /* ignore */
    }

    const refundTurn: SetupChatTurn = {
      id: `refund_${Date.now()}`,
      role: 'system_refund',
      timestamp: nowLabel,
      text: `[미해결 신고 기록 완료]\n① 해결되지 않았다는 신고를 내 PC 로컬 기록(${failurePacket.failureId})에 남겼습니다. (외부 전송 없음)\n② 귀신같이가 자동으로 바꾼 설정이 있었다면 위 [↩️ 원래 설정으로 되돌리기]로 돌릴 수 있습니다.\n③ 내 기기 고치기는 항상 0원이라 환불할 비용은 없습니다.`,
      auditId: targetAudit?.auditId,
      escrowStatus: 'RELEASED_REFUNDED',
      trajectoryGrade: 'GRADE_FAIL_ABORTED',
      undone: true,
      refunded: true,
      refundedAmount: refundCoins,
      failureTelemetryId: failurePacket.failureId,
    };

    set((s) => ({
      merlinAuth: {
        ...s.merlinAuth,
        coinBalance: s.merlinAuth.coinBalance + refundCoins,
      },
      setupEscrowHoldingCoins:
        targetAudit?.escrowStatus === 'ESCROW_HOLDING'
          ? Math.max(0, s.setupEscrowHoldingCoins - refundCoins)
          : s.setupEscrowHoldingCoins,
      setupAuditLogs: s.setupAuditLogs.map((a) =>
        (targetAudit && a.auditId === targetAudit.auditId) ||
        (!targetAudit && !a.refunded)
          ? {
              ...a,
              escrowStatus: 'RELEASED_REFUNDED'as const,
              trajectoryGrade: 'GRADE_FAIL_ABORTED'as const,
              undone: true,
              undoneAt: nowIso,
              refunded: true,
              refundedAt: nowIso,
              failureErrorCode: effectiveErrorCode,
            }
          : a
      ),
      setupFailureTelemetryQueue: [failurePacket, ...s.setupFailureTelemetryQueue],
      setupChatTurns: s.setupChatTurns
        .map((t) =>
          targetAudit && t.auditId === targetAudit.auditId
            ? {
                ...t,
                escrowStatus: 'RELEASED_REFUNDED'as const,
                trajectoryGrade: 'GRADE_FAIL_ABORTED'as const,
                undone: true,
                refunded: true,
                refundedAmount: refundCoins,
              }
            : t
        )
        .concat(refundTurn),
      uiFontScalePercent: 100,
      uiNightEyeProtection: false,
      activeOverlayPlan: null,
      activeOverlayBacktrackCount: 0,
      lastQuarantineToast: `[원상복구 & 에스크로 +${refundCoins} 코인 100% 즉시 반환 완료] 본사 실패 분석 큐(${failurePacket.failureId})로 실패 블랙박스 로그가 자동 전송되었습니다!`,
    }));
  },

  openSetupOverlayGuide: (plan) =>
    set({
      activeOverlayPlan: plan,
      activeOverlayStepIndex: 0,
      activeOverlayBacktrackCount: 0,
    }),

  recordOverlayBacktrack: () =>
    set((state) => {
      const nextCount = state.activeOverlayBacktrackCount + 1;
      const prevIdx = Math.max(0, state.activeOverlayStepIndex - 1);
      const toastMsg =
        nextCount >= 2
          ? `[뒤로 가기(Back) ${nextCount}회 감지 — 인간미 100% 쿨 환불 예약!] 초행길에 ${nextCount}번이나 헤매게 해드려 죄송합니다. 가이드를 끝까지 완료하시면 수리는 유지한 채 수리비 100%가 자동 환불되고 최단 지름길이 전 세계에 배포됩니다!`
          : `[뒤로 가기(Back) 1회 감지 — 인간적 허용 구간] 낯선 화면에서 1회 우회하셨습니다. 한 번만 더 헤매시면(2회+) 완료 즉시 100% 자동 환불(수업료 면제)이 발동합니다!`;
      return {
        activeOverlayBacktrackCount: nextCount,
        activeOverlayStepIndex: prevIdx,
        lastQuarantineToast: toastMsg,
      };
    }),

  advanceSetupOverlayStep: () => {
    const state = get();
    const steps = state.activeOverlayPlan?.overlaySteps ?? [];
    if (state.activeOverlayStepIndex + 1 < steps.length) {
      const nextIdx = state.activeOverlayStepIndex + 1;
      const nextStep = steps[nextIdx];
      try {
        if (nextStep) {
          void speakWithHyunsuOrSunhi(nextStep.voiceGuideText, 'hyunsu_briefing');
        }
      } catch {
        /* ignore */
      }
      set({ activeOverlayStepIndex: nextIdx });
      return;
    }

    // 마지막 단계 완주! 뒤로 가기(Back) 횟수가 2회 이상이면 즉시 100% 인간미 쿨 환불 + 최단 직행 지름길 OTA 발동!
    const backtrackCount = state.activeOverlayBacktrackCount;
    if (backtrackCount >= 2) {
      void get().triggerEmpathyRefundForCompletedRepair(undefined, backtrackCount);
      return;
    }

    if (backtrackCount === 1 && state.activeOverlayPlan) {
      const latestAudit = state.setupAuditLogs.find((a) => !a.refunded);
      const evalResult = evaluateTrajectoryAndBuildSelfHealingOta({
        plan: state.activeOverlayPlan,
        auditId: latestAudit?.auditId ?? `audit_${Date.now()}`,
        backtrackCount: 1,
      });
      set((s) => ({
        activeOverlayPlan: null,
        activeOverlayStepIndex: 0,
        activeOverlayBacktrackCount: 0,
        setupSelfHealingOtaQueue: evalResult.otaEntry
          ? [evalResult.otaEntry, ...s.setupSelfHealingOtaQueue]
          : s.setupSelfHealingOtaQueue,
        lastQuarantineToast:
          '[손가락 가이드 완주 · 뒤로 가기 1회 인간적 허용] 정상 정산 처리되었으며, 1회 우회 갈림길 로그를 본사 Multi-LLM으로 보내 0회 직행 코스로 미세 교정(OTA)했습니다!',
      }));
      return;
    }

    set({
      activeOverlayPlan: null,
      activeOverlayStepIndex: 0,
      activeOverlayBacktrackCount: 0,
      lastQuarantineToast:
        '[실시간 손가락 화살표 가이드 0회 쾌속 완주!] 사전 답사 지도대로 막힘없이 한 번에 도착하셨습니다!',
    });
  },

  closeSetupOverlayGuide: () =>
    set({
      activeOverlayPlan: null,
      activeOverlayStepIndex: 0,
      activeOverlayBacktrackCount: 0,
    }),
});
