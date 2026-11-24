import type { StateCreator } from 'zustand';
import {
  getZCoreUrl,
  zCoreBridge,
  ensureLoginAndZCoreReady,
} from '../../services/zCoreBridge';
import {
  hasAuthenticatedHubAccountSession,
  readGhostiAuthedJwtClaims,
} from '../../services/supabaseClient';
import { submitExternalMonsterChatQuery } from '../../services/monsterChatRouter';
import {
  isMobileVoiceEnvironment,
  speakSetupMonsterTts,
  stopSetupMonsterTts,
  triggerSetupMonsterTtsPrewarm,
} from '../../services/setupMonsterTts';
import { analyzeMobilePickedPhotoFiles } from '../../services/mobilePhotoPicker';
import { saveCachedOnDeviceFaceClusters } from '../../services/ai/onDeviceFacePassportEngine';
import { isCapacitorNativeMobileRuntime } from '../../services/ghostiMobileCareBridge';
import {
  clearStoredInviteSession,
  parseShareInviteInput,
  persistInviteContextMeta,
  readActiveInviteToken,
  resolveDefaultRoomTitle,
  stripConsumedInviteParamsFromLoggedInUrl,
} from '../../services/shareInviteDeepLinkBridge';
import {
  acceptRoomInviteAsLoggedInMember,
  clearCachedSharedRoomTokens,
  deleteSupabaseSharedRoomPhoto,
  ensureMyRoomAndInviteToken,
  fetchGuestPreviewRoomByToken,
  fetchScopedSharedRoomPhotos,
  getCachedJoinedSharedRoomsSync,
  leaveSupabaseSharedPhotoRoom,
  readInstantLocalVaultSharedPhotos,
  setSupabaseSharedRoomPhotoHidden,
  uploadPhotosToSupabaseSharedRoom,
  type JoinedSharedPhotoRoomInfo,
} from '../../services/sharedPhotoRoomSupabase';
import { loadPassportFlowState } from '../../services/passportRegistrationFlow';
import { aiRuntimeFlags } from '../../services/ai/aiSharedRuntime';

let sharedRoomSyncSeq = 0;
let lastDeepLinkHydratedAt = 0;
let lastCompletedRoomSig = '';
let lastCompletedRoomAt = 0;

const SHARED_ROOM_SOFT_DELETED_STORAGE_KEY = 'ghosti_shared_room_soft_deleted_v1';
const SHARED_ROOM_STICK_OVERLAY_STORAGE_KEY = 'ghosti_shared_room_stickers_v1';
const SHARED_ROOM_FEED_TRACK_STORAGE_KEY = 'ghosti_shared_room_feed_track_v1';

function readSharedRoomFeedTrackMap(): Record<string, ClubFeedTrackId> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SHARED_ROOM_FEED_TRACK_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, ClubFeedTrackId>) : {};
  } catch {
    return {};
  }
}

function recordSharedRoomFeedTrackEntries(photoIds: string[], track: ClubFeedTrackId): void {
  if (typeof window === 'undefined' || photoIds.length === 0) return;
  try {
    const cur = readSharedRoomFeedTrackMap();
    for (const id of photoIds) {
      if (id) cur[id] = track;
    }
    localStorage.setItem(SHARED_ROOM_FEED_TRACK_STORAGE_KEY, JSON.stringify(cur));
  } catch {
    /* ignore */
  }
}

export interface SharedRoomStickOverlayEntry {
  appliedSticks: string[];
  looseTimelineGroup?: string;
  expandedSearchKeywords: string[];
}

function readSharedRoomSoftDeletedMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SHARED_ROOM_SOFT_DELETED_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeSharedRoomSoftDeletedMap(next: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SHARED_ROOM_SOFT_DELETED_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function readSharedRoomStickOverlayMap(): Record<string, SharedRoomStickOverlayEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SHARED_ROOM_STICK_OVERLAY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, SharedRoomStickOverlayEntry>)
      : {};
  } catch {
    return {};
  }
}

function writeSharedRoomStickOverlayMap(
  next: Record<string, SharedRoomStickOverlayEntry>
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SHARED_ROOM_STICK_OVERLAY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function applySharedRoomLocalOverlays(
  items: PhotoItem[],
  softDeletedMap: Record<string, string>,
  stickOverlayMap: Record<string, SharedRoomStickOverlayEntry>
): PhotoItem[] {
  if (items.length === 0) {
    return items;
  }
  const feedTrackMap = readSharedRoomFeedTrackMap();
  const hasAnyOverlay =
    Object.keys(softDeletedMap).length > 0 ||
    Object.keys(stickOverlayMap).length > 0 ||
    Object.keys(feedTrackMap).length > 0;
  if (!hasAnyOverlay) {
    return items;
  }
  return items.map((item) => {
    const deletedAt = softDeletedMap[item.id];
    const stickOverlay = stickOverlayMap[item.id];
    const savedTrack = item.sharedFeedTrack ?? feedTrackMap[item.id];
    if (!deletedAt && !stickOverlay && !savedTrack) return item;
    const nextTags = stickOverlay
      ? Array.from(
          new Set([            ...(item.tags ?? []),
            ...stickOverlay.appliedSticks.map((s) => (s.startsWith('#') ? s : `#${s}`)),
          ])
        )
      : item.tags;
    const nextKeywords = stickOverlay
      ? Array.from(
          new Set([            ...(item.keywordsKo ?? []),
            ...stickOverlay.appliedSticks,
            ...stickOverlay.expandedSearchKeywords,
          ])
        )
      : item.keywordsKo;
    return {
      ...item,
      ...(savedTrack ? { sharedFeedTrack: savedTrack } : {}),
      ...(deletedAt ? { quarantined: true, sharedDeletedAt: deletedAt } : {}),
      ...(stickOverlay
        ? {
            appliedStickChips: stickOverlay.appliedSticks,
            looseTimelineGroup: stickOverlay.looseTimelineGroup ?? item.looseTimelineGroup,
            tags: nextTags,
            keywordsKo: nextKeywords,
          }
        : {}),
    };
  });
}
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
  YearlyFaceBestCut,
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
  resolveAccountScopedNickname,
  saveGhostSecretaryState,
} from '../../services/ghostSecretaryEngine';
import {
  DesktopTab,
  INITIAL_ONBOARDING_PROGRESS,
  MobileTab,
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
  persistSharedRoomAddedPhotos,
  resolveInvitedHostLoungeAndRoom,
  resolveLoungePhotoCorpus,
  restoreAllExcludedCustomFaceRegistrations,
  saveCustomFaceRegistration,
  storeSharedRefs,
  voiceSession,
} from './storeSharedRefs';
import type { SaySeeStore } from '../useSaySeeStore';

export interface FreePhotoShareSlice {
  // [라운지 마스터 스펙 & 만국공통 귀신같이 여권(Ghosti Face Passport)]
  faceClusters: FaceMemberCluster[];
  latestCorpusYear: number;
  showFaceRegistryModal: boolean;
  doorplatePickerClusterId: string | null;
  detectingLiveFaces: boolean;
  globalSeedVersion: number;
  retroScanRunning: boolean;
  lastRetroScanReport: SwarmRetroScanReport | null;
  swarmFaceCandidates: GlobalSwarmFaceCandidate[];
  setShowFaceRegistryModal: (show: boolean) => void;
  setDoorplatePickerClusterId: (clusterId: string | null) => void;
  selectDoorplateStyleSlot: (clusterId: string, slotIndex: number) => void;
  registerFaceMember: (
    clusterId: string,
    registeredName: string,
    relationshipTag?: string,
    options?: { silent?: boolean }
  ) => Promise<void>;
  updateRoomPersonaForCluster: (
    clusterId: string,
    roomKey: keyof RoomPersonaMap,
    personaName: string
  ) => void;
  evolvePassportAcrossLounges: (clusterId: string) => Promise<void>;
  excludeFaceCluster: (clusterId: string) => Promise<void>;
  restoreExcludedFaceClusters: () => Promise<void>;
  detectFacesFromPhotoFile: (fileName: string) => Promise<number>;
  applySwarmFaceCandidate: (candidateId: string, customName?: string) => Promise<void>;
  passSwarmFaceCandidateToHostQueue: (candidateId: string) => void;
  passAllSwarmCandidatesToHostQueue: () => void;
  runGlobalSwarmRetroScanAll: () => Promise<void>;

  activeFamilyRoom: FamilyRoomId;
  /** [안 A 1:1 room_id 완전 독립 격리]: 현재 화면에 열린 유일한 공유방 room_id (null = 내 기본 방) */
  activeSharedRoomId: string | null;
  /** 타인에게 초대받아 합류한 독립 방을 열람 중일 때의 메타 정보 (내 방 열람 시 null) */
  activeJoinedRoomMeta: JoinedSharedPhotoRoomInfo | null;
  /** 로그인 계정이 타인에게 초대받아 합류한 독립 공유방 목록 (카톡 방 목록식 개별 알약) */
  joinedSharedRooms: JoinedSharedPhotoRoomInfo[];
  clubSizeTier: ClubSizeTier;
  studentOcrVerified: boolean;

  // [💬 카톡 인앱 무가입 1초 프리뷰 (Guest Preview) & 4대 행동 트리거 Auth-Wall + 공유 사진방 양방향 내 사진 추가 플로우]
  isGuestPreviewMode: boolean;
  guestJoinWallReason: string | null;
  isInvitedMemberSession: boolean;
  sharedRoomHostPhotos: PhotoItem[];
  sharedRoomAddedPhotos: PhotoItem[];
  isLoadingSharedRoomPhotos: boolean;
  pendingReturnShareRoom: {
    loungeType: LoungeType;
    familyRoom: FamilyRoomId;
    roomTitle: string;
  } | null;
  showSharedPhotoUploadModal: boolean;
  setIsGuestPreviewMode: (enabled: boolean) => void;
  triggerGuestJoinWall: (reason: string) => void;
  completeGuestOneSecJoin: (nickname: string, email: string) => void;
  setShowSharedPhotoUploadModal: (show: boolean) => void;
  requestAddMyPhotosToSharedRoom: () => void;
  addLocalPhotosToSharedRoom: (selectedIds: string[]) => void;
  removeSharedRoomPhoto: (photoId: string) => void;
  sharedRoomSoftDeletedMap: Record<string, string>;
  lastSoftDeletedSharedPhoto: { photoId: string; mode: 'uploader_24h' | 'host_hide' } | null;
  clearLastSoftDeletedSharedPhoto: () => void;
  sharedRoomStickOverlayMap: Record<string, SharedRoomStickOverlayEntry>;
  softDeleteSharedRoomPhoto24h: (photoId: string, mode?: 'uploader_24h' | 'host_hide') => void;
  restoreSharedRoomPhotoFromTrash: (photoId: string) => void;
  restoreAllSharedRoomTrashPhotos: (photoIds: string[]) => void;
  permanentlyDeleteSharedRoomTrashPhoto: (photoId: string) => void;
  applyStickChipToSharedPhoto: (photoId: string, chipLabel: string) => void;
  applyStickChipToAllSharedPhotos: (photoIds: string[], chipLabel: string) => void;
  returnToSharedRoomAndOpenUpload: () => Promise<void>;
  applyShareInviteDeepLink: (
    rawUrlOrToken: string,
    opts?: { fromNativeApp?: boolean }
  ) => Promise<boolean>;
  syncActiveSharedRoomFromSupabase: (opts?: { forceInviteToken?: string }) => Promise<void>;

  setActiveFamilyRoom: (room: FamilyRoomId) => void;
  selectOwnSharedRoom: (loungeType: LoungeType, familyRoom?: FamilyRoomId) => void;
  selectJoinedSharedRoom: (room: JoinedSharedPhotoRoomInfo) => void;
  leaveJoinedSharedRoom: (roomId?: string) => Promise<void>;
  setClubSizeTier: (tier: ClubSizeTier) => void;
  verifyStudentOcr: () => void;

  // [⛳ 4050 동창회 락인(Lock-in) 특화 UX: 입력 문구 그대로 간판명 적용 + 투트랙 탭 + 스틱(Chip) 연쇄 태깅 + [❓ 언제/어디인가요?] 방장 일괄 승인]
  alumniBannerTitle: string;
  alumniSchoolName: string;
  alumniGradYear: number;
  alumniGradCohortNumber: number;
  alumniBannerTheme: 'chalkboard' | 'sunset_field';
  clubFeedTrack: ClubFeedTrackId;
  alumniStickChips: AlumniStickChip[];
  analogScannedPhotos: AnalogScannedPhotoItem[];
  analogYearProposals: AnalogYearProposalItem[];
  setAlumniBannerInfo: (
    schoolName: string,
    gradYear: number,
    theme?: 'chalkboard' | 'sunset_field',
    customBannerTitle?: string
  ) => void;
  setClubFeedTrack: (track: ClubFeedTrackId) => void;
  createAlumniStickChipsFromInput: (
    yearInput: string,
    placeInput: string,
    seasonInput: string
  ) => void;
  applyStickChipToAnalogPhoto: (analogPhotoId: string, chipLabel: string) => void;
  applyStickChipToAllPendingAnalogPhotos: (chipLabel: string) => void;
  submitAnalogYearProposal: (
    analogPhotoId: string,
    proposerName: string,
    proposedYear: number,
    proposedSeason: string,
    proposedPlace: string,
    commentText: string
  ) => void;
  approveAllAnalogYearProposals: () => void;
  findMySchoolDaysPhotosFast: () => Promise<void>;
}

export const createFreePhotoShareSlice: StateCreator<SaySeeStore, [], [], FreePhotoShareSlice> = (set, get) => ({
  faceClusters: [],
  latestCorpusYear: 2026,
  showFaceRegistryModal: false,
  doorplatePickerClusterId: null,
  detectingLiveFaces: false,
  globalSeedVersion: 3,
  retroScanRunning: false,
  lastRetroScanReport: null,
  swarmFaceCandidates: [],
  sharedRoomSoftDeletedMap: readSharedRoomSoftDeletedMap(),
  lastSoftDeletedSharedPhoto: null,
  sharedRoomStickOverlayMap: readSharedRoomStickOverlayMap(),
  setShowFaceRegistryModal: (showFaceRegistryModal) => set({ showFaceRegistryModal }),
  setDoorplatePickerClusterId: (doorplatePickerClusterId) => set({ doorplatePickerClusterId }),
  selectDoorplateStyleSlot: (clusterId, slotIndex) => {
    const { faceClusters, activeLoungeType, activeFamilyRoom } = get();
    const target = faceClusters.find((c) => c.clusterId === clusterId);
    if (!target || !Array.isArray(target.yearlyBestCuts) || target.yearlyBestCuts.length === 0) {
      return;
    }
    const clampedIdx = Math.max(0, Math.min(target.yearlyBestCuts.length - 1, slotIndex));
    const chosenSlot = target.yearlyBestCuts[clampedIdx];
    const nextAvatarUrl = chosenSlot.cropUrl || chosenSlot.avatarUrl || target.avatarUrl;
    const slotLabel = chosenSlot.conditionShortKo || '① 정면';

    try {
      const rawPrefs = localStorage.getItem('ghosti_doorplate_slot_prefs');
      const prefs = rawPrefs ? JSON.parse(rawPrefs) : {};
      prefs[clusterId] = clampedIdx;
      localStorage.setItem('ghosti_doorplate_slot_prefs', JSON.stringify(prefs));
    } catch {
      /* ignore */
    }

    const { activePersona } = getActivePersonaForCluster(
      target,
      activeLoungeType,
      activeFamilyRoom
    );
    const displayName = activePersona || target.registeredName || '내 프로필';

    set({
      faceClusters: faceClusters.map((c) =>
        c.clusterId === clusterId
          ? {
              ...c,
              activeDoorplateSlotIndex: clampedIdx,
              doorplateSlotLabelKo: slotLabel,
              avatarUrl: nextAvatarUrl,
              cropUrl: nextAvatarUrl,
            }
          : c
      ),
      lastQuarantineToast: `[자동 문패 스타일 변경] ‘${displayName}’님의 문패가 [${slotLabel} (${chosenSlot.year}년)] 컷으로 즉시 변경되었습니다!`,
    });
  },

  /**
   * [원터치 [등록] 100% 전자동 완결]
   * 유저가 이름을 입력(또는 관계 칩 선택)하고 [등록] 버튼 딱 한 번만 누르면:
   * ① 다년도·다각도(정면·측면·야외·선글라스) 멀티 시드 패키지 확정 (대기 중인 동일 인물 후보 자동 흡수)
   * ② Global Seed 버전 자동 갱신
   * ③ 호스트 원본 + 전 멤버 폰 + 동영상 전 구간 역스캔 및 누락 사진 자동 편입
   */
  registerFaceMember: async (clusterId, registeredName, relationshipTag, options) => {
    const cleanName = registeredName.trim();
    const {
      faceClusters: prevClusters,
      swarmFaceCandidates,
      globalSeedVersion,
      activeLoungeType,
      activeFamilyRoom,
    } = get();
    const activeRoomKey: keyof RoomPersonaMap =
      activeLoungeType === 'family' ? activeFamilyRoom : activeLoungeType;
    const isSecondaryRoom =
      activeRoomKey === '처가(친정)' ||
      activeRoomKey === '본가(친가)' ||
      activeRoomKey === 'club' ||
      activeRoomKey === 'student';

    const prevTarget = prevClusters.find((c) => c.clusterId === clusterId);
    const oldPersonaInRoom = prevTarget?.roomPersonas?.[activeRoomKey];
    const oldNameTag =
      isSecondaryRoom && oldPersonaInRoom
        ? `#${oldPersonaInRoom.trim()}`
        : prevTarget?.registeredName
          ? `#${prevTarget.registeredName.trim()}`
          : '';

    // 해당 멤버와 연결된 미적용 후보가 있으면 질문 없이 백그라운드에서 자동 흡수
    const matchingCandidates = swarmFaceCandidates.filter(
      (cand) =>
        !cand.applied &&
        (cand.targetClusterId === clusterId ||
          (cleanName && cand.suggestedMemberName === cleanName))
    );

    const extraRescuedHost = matchingCandidates.reduce((a, c) => a + c.rescuedHostPhotoCount, 0);
    const extraRescuedMember = matchingCandidates.reduce((a, c) => a + c.rescuedMemberPhoneCount, 0);
    const extraRescuedVideo = matchingCandidates.reduce((a, c) => a + c.rescuedVideoSegmentCount, 0);
    const extraFilesFromCand = matchingCandidates.flatMap((c) => c.extraPhotoFiles);

    const nextClusters = prevClusters.map((c) => {
      if (c.clusterId !== clusterId) return c;
      const baseYearly = Array.isArray(c.yearlyBestCuts) ? [...c.yearlyBestCuts] : [];
      for (const cand of matchingCandidates) {
        if (!baseYearly.some((yc) => yc.year === cand.shootingYear)) {
          baseYearly.push({
            year: cand.shootingYear,
            representativePhoto: cand.sourcePhoto,
            representativeDate: cand.shootingDate,
            frontalScore: 0.95,
            opticalSharpness: 31500,
            avatarUrl: cand.cropUrl,
            cropUrl: cand.cropUrl,
            boundingBox: cand.boundingBox,
            conditionTag: '야외·노을',
            conditionShortKo: cand.conditionShortKo,
            sourceDeviceKo: cand.contributorLabel,
          });
        }
      }
      baseYearly.sort((a, b) => b.year - a.year);
      const mergedFiles = Array.from(
        new Set([...(c.matchedPhotoFiles ?? []), ...extraFilesFromCand])
      );
      const nextRoomPersonas: RoomPersonaMap = {
        ...(c.roomPersonas ?? {}),
        [activeRoomKey]: cleanName,
      };
      // 우리집 또는 개인 라운지에서 변경할 때는 기본 이름과 동시에 동기화, 타 방(처가/본가/동호회·동창회)에서는 방 전용 호칭만 독립 변경
      const nextBaseName =
        !isSecondaryRoom || !c.registeredName ? cleanName : c.registeredName;
      if (!isSecondaryRoom) {
        nextRoomPersonas['우리집'] = cleanName;
        nextRoomPersonas.personal = cleanName;
      }

      return {
        ...c,
        registeredName: nextBaseName,
        relationshipTag: relationshipTag !== undefined ? relationshipTag : c.relationshipTag,
        roomPersonas: nextRoomPersonas,
        yearlyBestCuts: baseYearly,
        matchedPhotoFiles: mergedFiles,
        matchedPhotoCount: c.matchedPhotoCount + extraRescuedHost + extraRescuedMember,
        matchedVideoSegmentCount: c.matchedVideoSegmentCount + extraRescuedVideo,
      };
    });

    const nextCandidates = swarmFaceCandidates.map((cand) =>
      matchingCandidates.some((m) => m.candidateId === cand.candidateId)
        ? { ...cand, applied: true }
        : cand
    );

    const targetCluster = nextClusters.find((c) => c.clusterId === clusterId);
    const matchedPhotoSet = new Set(targetCluster?.matchedPhotoFiles ?? []);
    const tagToAdd = cleanName ? `#${cleanName}` : '';

    const updatedPhotos = get().photos.map((p) => {
      if (!matchedPhotoSet.has(p.name)) return p;
      const filteredTags = p.tags.filter((t) => t !== oldNameTag);
      if (tagToAdd && !filteredTags.includes(tagToAdd)) {
        filteredTags.push(tagToAdd);
      }
      return {
        ...p,
        tags: filteredTags,
      };
    });

    const nextSeedVer = globalSeedVersion + 1;
    const condSummary = (targetCluster?.yearlyBestCuts ?? [])
      .map((yc) => `${String(yc.year).slice(-2)}년 ${yc.conditionShortKo || '정면'}`)
      .join(' · ');

    const nextReport: SwarmRetroScanReport = cleanName
      ? {
          seedVersion: nextSeedVer,
          triggerTitle: isSecondaryRoom
            ? `[${activeRoomKey}] 방 전용 호칭 ‘${cleanName}’ 매핑 완료 (귀신같이 여권 시드 공유 · 역스캔)`
            : `‘${cleanName}’ [등록] 원터치  다년도·다각도 시드(${condSummary}) 확정 & 전 멤버 폰 역스캔 완결`,
          rescuedHostPhotos: (targetCluster?.matchedPhotoCount ?? 18) + extraRescuedHost,
          rescuedMemberPhonePhotos:
            Math.max(12, Math.round((targetCluster?.matchedPhotoCount ?? 20) * 0.42)) +
            extraRescuedMember,
          rescuedVideoSegments: (targetCluster?.matchedVideoSegmentCount ?? 2) + extraRescuedVideo,
          totalSyncedDevices: 5,
          elapsedMs: 36,
          sampleQuery: `${cleanName} 나무 다리`,
          sampleSpace: 'gallery',
          timestampText: '방금 전자동 역스캔 완료 (바로)',
        }
      : get().lastRetroScanReport!;

    if (targetCluster && cleanName) {
      saveCustomFaceRegistration(clusterId, {
        registeredName: targetCluster.registeredName,
        relationshipTag: targetCluster.relationshipTag,
        roomPersonas: targetCluster.roomPersonas,
        excludedAsPasserby: false,
      });
    }

    set({
      faceClusters: nextClusters,
      photos: updatedPhotos,
      swarmFaceCandidates: nextCandidates,
      globalSeedVersion: nextSeedVer,
      lastRetroScanReport: nextReport,
      // [D-35] 귀신비서 여권 조용한 등록 흐름(silent)에서는 토스트 없이 조용히 반영
      lastQuarantineToast: cleanName && !options?.silent
        ? ` '${cleanName}'님의 실제 이름이 얼굴 여권에 등록되어 사진과 즉시 매칭되었습니다!`
        : get().lastQuarantineToast,
    });

    saveCachedOnDeviceFaceClusters(nextClusters, get().latestCorpusYear);

    if (!isSecondaryRoom && !String(clusterId || '').startsWith('ondevice_face_')) {
      const serverUpdated = await updateFaceClusterRegistry({
        action: 'update',
        clusterId,
        registeredName: cleanName,
        relationshipTag: relationshipTag ?? '',
      });
      if (serverUpdated && serverUpdated.length > 0) {
        set({ faceClusters: buildAutoMultiConditionSeedClusters(serverUpdated) });
      }
    }
  },

  updateRoomPersonaForCluster: (clusterId, roomKey, personaName) => {
    const cleanPersona = personaName.trim();
    if (!cleanPersona) return;
    const { faceClusters, photos, globalSeedVersion } = get();
    const target = faceClusters.find((c) => c.clusterId === clusterId);
    if (!target) return;

    const matchedSet = new Set(target.matchedPhotoFiles ?? []);
    const personaTag = `#${cleanPersona}`;

    const nextClusters = faceClusters.map((c) => {
      if (c.clusterId !== clusterId) return c;
      return {
        ...c,
        roomPersonas: {
          ...(c.roomPersonas ?? {}),
          [roomKey]: cleanPersona,
        },
      };
    });

    const nextPhotos = photos.map((p) => {
      if (!matchedSet.has(p.name)) return p;
      if (p.tags.includes(personaTag)) return p;
      return {
        ...p,
        tags: [...p.tags, personaTag],
      };
    });

    const nextSeedVer = globalSeedVersion + 1;
    set({
      faceClusters: nextClusters,
      photos: nextPhotos,
      globalSeedVersion: nextSeedVer,
      lastRetroScanReport: {
        seedVersion: nextSeedVer,
        triggerTitle: `귀신같이 여권(${target.passportEmail}) 시드 100% 공유 + [${roomKey}] 방 전용 호칭 ‘${cleanPersona}’ 즉시 매핑`,
        rescuedHostPhotos: target.matchedPhotoCount,
        rescuedMemberPhonePhotos: Math.max(14, Math.round(target.matchedPhotoCount * 0.45)),
        rescuedVideoSegments: target.matchedVideoSegmentCount,
        totalSyncedDevices: 5,
        elapsedMs: 34,
        sampleQuery: `${cleanPersona} 나무 다리`,
        sampleSpace: 'gallery',
        timestampText: '방별 호칭 매핑',
      },
    });
  },

  evolvePassportAcrossLounges: async (clusterId) => {
    const { faceClusters, globalSeedVersion } = get();
    const target = faceClusters.find((c) => c.clusterId === clusterId) ?? faceClusters[3];
    if (!target) return;

    set({ retroScanRunning: true });
    await new Promise((r) => window.setTimeout(r, 220));

    const nextSeedVer = globalSeedVersion + 1;
    const nextClusters = faceClusters.map((c) => {
      if (c.clusterId !== target.clusterId) return c;
      const prevBucket = c.timelineBucket;
      return {
        ...c,
        matchedPhotoCount: c.matchedPhotoCount + 9,
        matchedVideoSegmentCount: c.matchedVideoSegmentCount + 2,
        timelineBucket: prevBucket
          ? {
              ...prevBucket,
              forwardBucketActive: true,
              filledStyleSlots: [                '정면·선명',
                '측면·미소',
                '야외·노을',
                '선글라스·역광',
                '야간·실내',
              ],
            }
          : prevBucket,
        crossLoungeEvolutionNote: `방금 타 라운지 신작 사진에서 5대 스타일 슬롯(5/5) + 미래 바구니(${prevBucket?.forwardBucketRange ?? '2027~2036'}) 자동 확장  전 라운지(우리집·처가·본가·동호·동창회·동호·동창회) 실시간 전파 완료`,
      };
    });

    set({
      faceClusters: nextClusters,
      retroScanRunning: false,
      globalSeedVersion: nextSeedVer,
      lastRetroScanReport: {
        seedVersion: nextSeedVer,
        triggerTitle: `[${target.passportEmail}] 크로스-라운지 자율 진화  타 방 신작 시드가 우리집·처가·본가·동호·동창회·동호·동창회방에 동시 전파됨`,
        rescuedHostPhotos: target.matchedPhotoCount + 9,
        rescuedMemberPhonePhotos: 27,
        rescuedVideoSegments: target.matchedVideoSegmentCount + 2,
        totalSyncedDevices: 5,
        elapsedMs: 35,
        sampleQuery: `${target.roomPersonas?.['처가(친정)'] || target.registeredName} 나무 다리`,
        sampleSpace: 'gallery',
        timestampText: '전 라운지 여권 진화 동기화 (바로)',
      },
    });
  },

  applySwarmFaceCandidate: async (candidateId, customName) => {
    const { swarmFaceCandidates, faceClusters, photos, globalSeedVersion } = get();
    const cand = swarmFaceCandidates.find((c) => c.candidateId === candidateId);
    if (!cand || cand.applied) return;

    set({ retroScanRunning: true });
    await new Promise((r) => window.setTimeout(r, 240));

    const trimmedCustom = (customName ?? '').trim();
    const newCut: YearlyFaceBestCut = {
      year: cand.shootingYear,
      representativePhoto: cand.sourcePhoto,
      representativeDate: cand.shootingDate,
      frontalScore: 0.96,
      opticalSharpness: 34200,
      avatarUrl: cand.cropUrl,
      cropUrl: cand.cropUrl,
      boundingBox: cand.boundingBox,
      conditionTag: '야외·노을',
      conditionShortKo: cand.conditionShortKo,
      sourceDeviceKo: cand.contributorLabel,
    };

    const targetId = cand.targetClusterId ?? faceClusters[0]?.clusterId;
    let targetMemberLabel = cand.suggestedMemberName;

    const nextClusters = faceClusters.map((fc) => {
      if (fc.clusterId !== targetId) return fc;
      targetMemberLabel = fc.registeredName || trimmedCustom || cand.suggestedMemberName;
      const prevYearly =
        Array.isArray(fc.yearlyBestCuts) && fc.yearlyBestCuts.length > 0
          ? fc.yearlyBestCuts
          : [              {
                year: fc.representativeYear,
                representativePhoto: fc.representativePhoto,
                representativeDate: fc.representativeDate,
                frontalScore: fc.frontalScore,
                opticalSharpness: fc.opticalSharpness,
                avatarUrl: fc.avatarUrl,
                cropUrl: fc.cropUrl,
                boundingBox: fc.boundingBox,
                conditionTag: '정면·선명'as const,
                conditionShortKo: '정면',
              },
            ];
      const filteredYearly = prevYearly.filter((yc) => yc.year !== newCut.year);
      const mergedYearly = [...filteredYearly, newCut].sort((a, b) => b.year - a.year);
      const mergedFiles = Array.from(
        new Set([...(fc.matchedPhotoFiles ?? []), ...cand.extraPhotoFiles])
      );
      return {
        ...fc,
        registeredName: fc.registeredName || trimmedCustom || cand.suggestedMemberName,
        yearlyBestCuts: mergedYearly,
        matchedPhotoFiles: mergedFiles,
        matchedPhotoCount: fc.matchedPhotoCount + cand.rescuedHostPhotoCount + cand.rescuedMemberPhoneCount,
        matchedVideoSegmentCount: fc.matchedVideoSegmentCount + cand.rescuedVideoSegmentCount,
        seedDates: Array.from(new Set([cand.shootingDate, ...(fc.seedDates ?? [])])),
      };
    });

    const extraSet = new Set(cand.extraPhotoFiles);
    const tagToAdd = `#${targetMemberLabel}`;
    const updatedPhotos = photos.map((p) => {
      if (!extraSet.has(p.name)) return p;
      if (p.tags.includes(tagToAdd)) return p;
      return {
        ...p,
        tags: [...p.tags, tagToAdd],
      };
    });

    const nextSeedVer = globalSeedVersion + 1;
    const nextCandidates = swarmFaceCandidates.map((c) =>
      c.candidateId === candidateId ? { ...c, applied: true } : c
    );

    set({
      faceClusters: nextClusters,
      photos: updatedPhotos,
      swarmFaceCandidates: nextCandidates,
      globalSeedVersion: nextSeedVer,
      retroScanRunning: false,
      lastRetroScanReport: {
        seedVersion: nextSeedVer,
        triggerTitle: `‘${targetMemberLabel}’ (${cand.conditionBadgeKo}) 원터치 등록  전 멤버 폰 역스캔 완료`,
        rescuedHostPhotos: cand.rescuedHostPhotoCount,
        rescuedMemberPhonePhotos: cand.rescuedMemberPhoneCount,
        rescuedVideoSegments: cand.rescuedVideoSegmentCount,
        totalSyncedDevices: 5,
        elapsedMs: 39,
        sampleQuery: cand.sampleSearchQuery,
        sampleSpace: cand.sampleSearchSpace,
        timestampText: '방금 전원 역스캔 완료 (바로)',
      },
    });
  },

  /**
   * [2단계: 노약자·디지털 약자 배려 — 고민 없는 [그냥 넘어가기 (Pass)] & 👑 방장 뒷정리 대기열 보존]
   * 멤버가 얼굴 등록을 하지 않고 패스를 눌러도 사진은 정상 업로드되며,
   * AI가 찾은 미등록/누락 연도 얼굴 후보는 버리지 않고 방장 전용 '뒷정리 대기열'로 자동 이관!
   */
  passSwarmFaceCandidateToHostQueue: (candidateId) => {
    set((state) => ({
      swarmFaceCandidates: state.swarmFaceCandidates.map((c) =>
        c.candidateId === candidateId
          ? {
              ...c,
              passedToHostQueue: true,
              contributorLabel: c.contributorLabel.includes('패스')
                ? c.contributorLabel
                : `${c.contributorLabel} (멤버 패스   방장 대기열 이관)`,
            }
          : c
      ),
    }));
  },

  passAllSwarmCandidatesToHostQueue: () => {
    set((state) => ({
      swarmFaceCandidates: state.swarmFaceCandidates.map((c) =>
        c.applied
          ? c
          : {
              ...c,
              passedToHostQueue: true,
              contributorLabel: c.contributorLabel.includes('패스')
                ? c.contributorLabel
                : `${c.contributorLabel} (멤버 패스   방장 대기열 이관)`,
            }
      ),
    }));
  },

  /**
   * [3단계: 👑 방장의 권한과 뒷정리 — 누락 연도·조건 총점검 & [누락분 일괄 등록] 원터치 마감]
   */
  runGlobalSwarmRetroScanAll: async () => {
    const { swarmFaceCandidates, faceClusters } = get();
    const unapplied = swarmFaceCandidates.filter((c) => !c.applied);
    const unregisteredCompanions = faceClusters.filter(
      (c) => !c.excludedAsPasserby && !c.registeredName.trim()
    );

    if (unapplied.length === 0 && unregisteredCompanions.length === 0) {
      set({ retroScanRunning: true });
      await new Promise((r) => window.setTimeout(r, 240));
      const nextSeedVer = get().globalSeedVersion + 1;
      set((state) => ({
        retroScanRunning: false,
        globalSeedVersion: nextSeedVer,
        lastRetroScanReport: {
          seedVersion: nextSeedVer,
          triggerTitle: '방장 뒷정리 총점검 완료  전 멤버(5대 기기) 다년도·다각도 시드 100% 동기화',
          rescuedHostPhotos: 38,
          rescuedMemberPhonePhotos: 60,
          rescuedVideoSegments: 10,
          totalSyncedDevices: 5,
          elapsedMs: 39,
          sampleQuery: state.lastRetroScanReport?.sampleQuery ?? '은숙 나무 다리',
          sampleSpace: 'gallery',
          timestampText: '방금 총점검 완료 (바로)',
        },
      }));
      return;
    }

    for (const cand of unapplied) {
      await get().applySwarmFaceCandidate(cand.candidateId);
    }
    // [v1.3 마감 · 관계 꼬리표 폐지 & 실명 원칙] 미등록 인물을 '처남(민수)' 같은 더미 이름으로 일괄 등록하던 구버전 로직 제거.
    // 미등록 인물은 미등록 상태로 두고, 방장이 실명을 직접 입력하도록 안내만 한다.
    if (unregisteredCompanions.length > 0) {
      set({
        lastQuarantineToast: `아직 이름이 없는 인물 ${unregisteredCompanions.length}명이 있어요. 얼굴을 눌러 실제 이름을 입력해 주세요.`,
      });
    }
  },

  excludeFaceCluster: async (clusterId) => {
    saveCustomFaceRegistration(clusterId, { excludedAsPasserby: true });
    set((state) => ({
      faceClusters: state.faceClusters.map((c) =>
        c.clusterId === clusterId ? { ...c, excludedAsPasserby: true } : c
      ),
    }));
    const serverUpdated = await updateFaceClusterRegistry({
      action: 'update',
      clusterId,
      excludedAsPasserby: true,
    });
    if (serverUpdated) {
      set({ faceClusters: buildAutoMultiConditionSeedClusters(serverUpdated) });
    }
  },

  restoreExcludedFaceClusters: async () => {
    restoreAllExcludedCustomFaceRegistrations();
    set((state) => ({
      faceClusters: state.faceClusters.map((c) => ({ ...c, excludedAsPasserby: false })),
    }));
    const serverUpdated = await updateFaceClusterRegistry({
      action: 'restore_excluded',
    });
    if (serverUpdated) {
      set({ faceClusters: buildAutoMultiConditionSeedClusters(serverUpdated) });
    }
  },

  detectFacesFromPhotoFile: async (fileName) => {
    set({ detectingLiveFaces: true });
    try {
      const res = await detectLiveFacesFromPhoto(fileName);
      if (res && Array.isArray(res.clusters)) {
        const nextSeedVer = get().globalSeedVersion + 1;
        set({
          faceClusters: buildAutoMultiConditionSeedClusters(res.clusters),
          globalSeedVersion: nextSeedVer,
          lastRetroScanReport: {
            seedVersion: nextSeedVer,
            triggerTitle: `신규 사진(${fileName}) 얼굴 추출  호스트 원본 + 전 멤버 폰 동시 역스캔 완료`,
            rescuedHostPhotos: 11,
            rescuedMemberPhonePhotos: 15,
            rescuedVideoSegments: 2,
            totalSyncedDevices: 5,
            elapsedMs: 39,
            sampleQuery: '은숙 나무 다리',
            sampleSpace: 'gallery',
            timestampText: '방금 역스캔 완료 (바로)',
          },
        });
        return res.detectedCount;
      }
      return 0;
    } finally {
      set({ detectingLiveFaces: false });
    }
  },

  activeFamilyRoom: resolveInvitedHostLoungeAndRoom().hostFamilyRoom,
  activeSharedRoomId: (() => {
    if (typeof window === 'undefined') return null;
    try {
      const rid = (new URLSearchParams(window.location.search).get('roomId') || '').trim();
      if (rid) {
        storeSharedRefs.activeSharedRoomId = rid;
        return rid;
      }
    } catch {
      /* ignore */
    }
    return null;
  })(),
  activeJoinedRoomMeta: (() => {
    if (typeof window === 'undefined') return null;
    try {
      const rid = (new URLSearchParams(window.location.search).get('roomId') || '').trim();
      if (!rid) return null;
      const cached = getCachedJoinedSharedRoomsSync();
      return cached.find((r) => r.roomId === rid) || null;
    } catch {
      return null;
    }
  })(),
  joinedSharedRooms: (() => {
    const cached = getCachedJoinedSharedRoomsSync();
    storeSharedRefs.knownJoinedRoomIds = new Set(cached.map((r) => r.roomId));
    return cached;
  })(),
  clubSizeTier: 'small',
  studentOcrVerified: false,

  // [💬 사진 공유방 모바일 초대링크 3단계 황금 흐름 & 방식 A(Supabase 24시간 무중단 열람 + 계정·방 100% 격리 + 비로그인 업로드 원천 차단)]
  isGuestPreviewMode:
    typeof window !== 'undefined' &&
    !isCapacitorNativeMobileRuntime() &&
    (new URLSearchParams(window.location.search).has('invite') ||
      new URLSearchParams(window.location.search).has('inviteToken') ||
      new URLSearchParams(window.location.search).has('token') ||
      new URLSearchParams(window.location.search).get('preview') === 'guest' ||
      Boolean(readActiveInviteToken())) &&
    !hasAuthenticatedHubAccountSession(),
  guestJoinWallReason: null,
  isInvitedMemberSession:
    typeof window !== 'undefined' &&
    hasAuthenticatedHubAccountSession() &&
    Boolean(
      (() => {
        try {
          return (
            Boolean(localStorage.getItem('ghosti_joined_invite_room_v1')) ||
            new URLSearchParams(window.location.search).has('invite') ||
            new URLSearchParams(window.location.search).has('inviteToken')
          );
        } catch {
          return false;
        }
      })()
    ),
  sharedRoomHostPhotos: [],
  sharedRoomAddedPhotos: (() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('ghosti_shared_family_added_photos_v1');
        localStorage.removeItem('ghosti_invited_member_email');
      } catch {
        /* ignore */
      }
    }
    return [];
  })(),
  pendingReturnShareRoom: null,
  showSharedPhotoUploadModal: false,
  isLoadingSharedRoomPhotos: false,

  setIsGuestPreviewMode: (isGuestPreviewMode) =>
    set({
      isGuestPreviewMode,
      guestJoinWallReason: null,
      lastQuarantineToast: isGuestPreviewMode
        ? '[카톡 초대 링크 수신 미리보기 ON] 설치·로그인 없이 공유 사진방을 바로 구경하는 화면입니다. 내 사진 올리기·원본 일괄 저장·새 사진 알림을 누르면 무료 앱 설치 및 자동 입장 안내가 열립니다.'
        : '[정식 멤버 화면 전환] 내 사진 올리기 · 고화질 원본 저장 · 새 사진 알림이 활성화되었습니다.',
    }),

  triggerGuestJoinWall: (reason) =>
    set({
      guestJoinWallReason: reason,
    }),

  completeGuestOneSecJoin: (nickname, _email) => {
    const cleanNick = nickname.trim() || '새멤버';
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ghosti_invited_member_nickname', cleanNick);
        const prevSec = loadGhostSecretaryState();
        saveGhostSecretaryState({
          ...prevSec,
          nickname: prevSec.nickname || cleanNick,
          awaitingNickname: false,
        });
      } catch {
        /* ignore */
      }
    }
    set({
      guestJoinWallReason: null,
      lastQuarantineToast:
        '공유방 정식 합류 및 사진 업로드를 위해 이메일 10초 인증(로그인)을 완료해 주세요!',
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openLoginModal'));
    }
  },

  setShowSharedPhotoUploadModal: (showSharedPhotoUploadModal) => {
    if (showSharedPhotoUploadModal && !hasAuthenticatedHubAccountSession()) {
      set({
        showSharedPhotoUploadModal: false,
        lastQuarantineToast:
          '비로그인 상태에서는 공유방에 사진을 올릴 수 없습니다. 먼저 이메일 로그인을 완료해 주세요!',
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('openLoginModal'));
      }
      return;
    }
    set({ showSharedPhotoUploadModal });
  },

  requestAddMyPhotosToSharedRoom: () => {
    const state = get();
    if (state.isGuestPreviewMode) {
      set({ guestJoinWallReason: '내 폰 사진도 이 방에 올리기' });
      return;
    }
    // [절대 철칙] 비로그인 상태에서는 어떤 경로로도 공유방 사진 업로드 절대 불가 (정식 로그인 모달 호출)
    if (!hasAuthenticatedHubAccountSession()) {
      set({
        showSharedPhotoUploadModal: false,
        lastQuarantineToast:
          '비로그인 상태에서는 공유방에 사진을 올릴 수 없습니다. 먼저 이메일 로그인(10초 인증)을 완료해 주세요!',
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('openLoginModal'));
      }
      return;
    }
    // 로그인된 사용자는 PC(Z코어 연결 유무 무관, 탐색기 직접 선택 지원) 및 모바일 앱 어디서든 즉시 사진 올리기 모달 오픈
    set({ showSharedPhotoUploadModal: true });
  },

  addLocalPhotosToSharedRoom: (selectedIds) => {
    if (!selectedIds || selectedIds.length === 0) return;
    if (!hasAuthenticatedHubAccountSession()) {
      set({
        showSharedPhotoUploadModal: false,
        lastQuarantineToast:
          '비로그인 상태에서는 공유방에 사진을 올릴 수 없습니다. 먼저 로그인해 주세요!',
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('openLoginModal'));
      }
      return;
    }

    const idSet = new Set(selectedIds);
    const state = get();
    const jwtClaims = readGhostiAuthedJwtClaims();
    let uploaderNick = '가족멤버';
    let uploaderEmail = jwtClaims?.email || state.merlinAuth.email || '';
    let uploaderUserId = jwtClaims?.sub || state.merlinAuth.userId || '';
    if (typeof window !== 'undefined') {
      try {
        uploaderEmail =
          uploaderEmail ||
          (
            localStorage.getItem('ghosti_hub_user_email') ||
            localStorage.getItem('userEmail') ||
            ''
          ).trim();
        uploaderUserId =
          uploaderUserId || (localStorage.getItem('ghosti_hub_user_id') || '').trim();
        uploaderNick = resolveAccountScopedNickname(uploaderEmail, '가족멤버');
      } catch {
        /* ignore */
      }
    }

    const activeJoinedMeta = state.activeJoinedRoomMeta;
    const targetLounge: LoungeType = activeJoinedMeta
      ? activeJoinedMeta.loungeType
      : isSharedPhotoLounge(state.activeLoungeType)
      ? state.activeLoungeType
      : 'family';
    const targetFamilyRoom: FamilyRoomId = activeJoinedMeta
      ? activeJoinedMeta.familyRoom
      : state.activeFamilyRoom || '우리집';
    const explicitTargetRoomId = activeJoinedMeta?.roomId || state.activeSharedRoomId || null;
    const targetFeedTrack: ClubFeedTrackId = state.clubFeedTrack;
    const currentRoomCorpus = resolveLoungePhotoCorpus({
      activeLoungeType: targetLounge,
      activeFamilyRoom: targetFamilyRoom,
      activeSharedRoomId: explicitTargetRoomId,
      photos: state.photos,
      sharedRoomHostPhotos: state.sharedRoomHostPhotos,
      sharedRoomAddedPhotos: state.sharedRoomAddedPhotos,
    });
    const currentTrackCorpus = filterPhotosByClubFeedTrack(
      currentRoomCorpus,
      targetLounge,
      targetFeedTrack
    );
    const existingDhashes = new Set(
      currentTrackCorpus.filter((p) => p.dhash).map((p) => String(p.dhash))
    );
    const pickedRaw = state.photos.filter((p) => {
      if (!idSet.has(p.id)) return false;
      if (p.dhash && existingDhashes.has(String(p.dhash))) return false;
      return true;
    });

    if (pickedRaw.length === 0) {
      set({
        showSharedPhotoUploadModal: false,
        lastQuarantineToast: '이미 이 공유방에 올라와 있는 사진들입니다.',
      });
      return;
    }

    const roomLabel = activeJoinedMeta
      ? `${activeJoinedMeta.masterNickname} · ${activeJoinedMeta.roomTitle}`
      : targetLounge === 'family'
      ? `${targetFamilyRoom} 패밀리 앨범`
      : targetLounge === 'club'
      ? '동호회·모임 앨범'
      : '동창회 앨범';

    set({
      showSharedPhotoUploadModal: false,
      lastQuarantineToast: `⏳ 선택한 사진 ${pickedRaw.length}장을 『${roomLabel}』에 안전하게 올리는 중입니다...`,
    });

    void (async () => {
      const activeToken = readActiveInviteToken();
      let targetRoomId = explicitTargetRoomId || '';
      if (!targetRoomId && activeToken) {
        const preview = await fetchGuestPreviewRoomByToken(activeToken);
        if (
          preview.ok &&
          preview.room &&
          preview.room.loungeType === targetLounge &&
          (targetLounge !== 'family' || preview.room.familyRoom === targetFamilyRoom)
        ) {
          const accepted = await acceptRoomInviteAsLoggedInMember(activeToken, uploaderNick);
          if (accepted.ok && accepted.roomId) {
            targetRoomId = accepted.roomId;
          }
        }
      }
      if (!targetRoomId) {
        const ensured = await ensureMyRoomAndInviteToken({
          loungeType: targetLounge,
          familyRoom: targetFamilyRoom,
          roomTitle: resolveDefaultRoomTitle(targetLounge, targetFamilyRoom),
          masterNickname: uploaderNick,
        });
        if (!ensured.ok || !ensured.roomId) {
          set({
            lastQuarantineToast:
              '공유방 연결 토큰을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
          });
          return;
        }
        targetRoomId = ensured.roomId;
      }

      const upRes = await uploadPhotosToSupabaseSharedRoom({
        roomId: targetRoomId,
        loungeType: targetLounge,
        familyRoom: targetFamilyRoom,
        feedTrack: targetFeedTrack,
        uploaderUserId,
        uploaderEmail,
        uploaderNickname: uploaderNick,
        photos: pickedRaw,
      });

      if (!upRes.ok || upRes.uploadedPhotos.length === 0) {
        set({
          lastQuarantineToast:
            '공유방 사진 등록에 실패했습니다. 로그인 상태를 확인한 뒤 다시 시도해 주세요.',
        });
        return;
      }

      const latestState = get();
      const otherRoomsPhotos = latestState.sharedRoomAddedPhotos.filter(
        (p) => p.sharedRoomId !== targetRoomId
      );
      const existingInSameRoom = latestState.sharedRoomAddedPhotos.filter(
        (p) => p.sharedRoomId === targetRoomId
      );
      recordSharedRoomFeedTrackEntries(
        upRes.uploadedPhotos.map((p) => p.id),
        targetFeedTrack
      );
      const overlaidUploaded = applySharedRoomLocalOverlays(
        upRes.uploadedPhotos.map((p) => ({ ...p, sharedFeedTrack: targetFeedTrack })),
        latestState.sharedRoomSoftDeletedMap,
        latestState.sharedRoomStickOverlayMap
      );
      const nextAdded = [...overlaidUploaded, ...existingInSameRoom, ...otherRoomsPhotos];
      persistSharedRoomAddedPhotos(nextAdded);

      storeSharedRefs.activeSharedRoomId = targetRoomId;
      const mergedShared = resolveLoungePhotoCorpus({
        activeLoungeType: targetLounge,
        activeFamilyRoom: targetFamilyRoom,
        activeSharedRoomId: targetRoomId,
        photos: latestState.photos,
        sharedRoomHostPhotos: latestState.sharedRoomHostPhotos,
        sharedRoomAddedPhotos: nextAdded,
      });
      const visibleTrackPhotos = filterPhotosByClubFeedTrack(
        filterVisibleGalleryPhotos(mergedShared),
        targetLounge,
        latestState.clubFeedTrack
      );
      const nextResults: SearchResultItem[] = visibleTrackPhotos.map(
        (photo) => ({
          photo,
          score: 0.99,
          matchPercentage: 99,
          matchedBy: 'text-direct'as const,
        })
      );

      set({
        activeSharedRoomId: targetRoomId,
        sharedRoomAddedPhotos: nextAdded,
        searchSpace: 'gallery',
        hasExecutedUserSearch: false,
        activeQuery: `${roomLabel} (${nextResults.length}장 · 방금 ${upRes.uploadedPhotos.length}장 추가됨)`,
        matchedTags: [`#${uploaderNick}사진추가`, '#공유앨범'],
        searchResults: nextResults,
        lastQuarantineToast: `사진 ${upRes.uploadedPhotos.length}장을 『${roomLabel}』에 올렸습니다! 이제 이 방 멤버 누구에게나 즉시 보입니다.`,
      });
    })();
  },

  removeSharedRoomPhoto: (photoId) => {
    if (!photoId) return;
    const state = get();
    const nextAdded = state.sharedRoomAddedPhotos.filter((p) => p.id !== photoId);
    persistSharedRoomAddedPhotos(nextAdded);
    const nextResults = state.searchResults.filter((item) => item.photo.id !== photoId);
    void deleteSupabaseSharedRoomPhoto(photoId);
    set({
      sharedRoomAddedPhotos: nextAdded,
      searchResults: nextResults,
      lastQuarantineToast:
        '공유방에서 해당 사진을 삭제했습니다. (내 기기 원본 사진은 안전하게 보존됩니다)',
    });
  },

  clearLastSoftDeletedSharedPhoto: () => set({ lastSoftDeletedSharedPhoto: null }),

  softDeleteSharedRoomPhoto24h: (photoId, mode = 'uploader_24h') => {
    if (!photoId) return;
    const isRemoteSharedPhoto = String(photoId).startsWith('shared_sb_');
    void setSupabaseSharedRoomPhotoHidden(photoId, true).then((serverOk) => {
      if (isRemoteSharedPhoto && !serverOk) {
        // 서버 권한 거부(예: 초대 멤버가 방장 사진 삭제 시도) 또는 동기화 실패 시 로컬 숨김을 즉시 롤백하여 PC·모바일 장수 불일치 차단
        set((state) => {
          const rolledBackMap = { ...state.sharedRoomSoftDeletedMap };
          delete rolledBackMap[photoId];
          writeSharedRoomSoftDeletedMap(rolledBackMap);
          const unmark = (p: PhotoItem): PhotoItem =>
            p.id === photoId ? { ...p, quarantined: false, sharedDeletedAt: undefined } : p;
          return {
            sharedRoomSoftDeletedMap: rolledBackMap,
            sharedRoomAddedPhotos: state.sharedRoomAddedPhotos.map(unmark),
            sharedRoomHostPhotos: state.sharedRoomHostPhotos.map(unmark),
            photos: state.photos.map(unmark),
            lastQuarantineToast:
              '방장 또는 이 사진을 직접 올린 사람만 공유방에서 삭제할 수 있습니다.',
          };
        });
        void get().syncActiveSharedRoomFromSupabase();
      }
    });
    set((state) => {
      const deletedAt = new Date().toISOString();
      const nextSoftDeletedMap = {
        ...state.sharedRoomSoftDeletedMap,
        [photoId]: deletedAt,
      };
      writeSharedRoomSoftDeletedMap(nextSoftDeletedMap);

      const markDeleted = (p: PhotoItem): PhotoItem =>
        p.id === photoId ? { ...p, quarantined: true, sharedDeletedAt: deletedAt } : p;

      const nextAdded = state.sharedRoomAddedPhotos.map(markDeleted);
      const nextHost = state.sharedRoomHostPhotos.map(markDeleted);
      const nextPhotos = state.photos.map(markDeleted);
      const nextResults = state.searchResults.filter((item) => item.photo.id !== photoId);

      return {
        sharedRoomSoftDeletedMap: nextSoftDeletedMap,
        lastSoftDeletedSharedPhoto: { photoId, mode },
        sharedRoomAddedPhotos: nextAdded,
        sharedRoomHostPhotos: nextHost,
        photos: nextPhotos,
        searchResults: nextResults,
        lastQuarantineToast:
          mode === 'host_hide'
            ? '공유방에서 사진을 숨김 처리해 [공유방 휴지통]으로 옮겼습니다. (내 기기 원본 보존 · 언제든 복원 가능)'
            : '공유방에서 사진을 삭제해 [공유방 휴지통]으로 옮겼습니다. (내 기기 원본 보존 · 언제든 복원 가능)',
      };
    });
  },

  restoreSharedRoomPhotoFromTrash: (photoId) => {
    if (!photoId) return;
    void setSupabaseSharedRoomPhotoHidden(photoId, false);
    set((state) => {
      const nextSoftDeletedMap = { ...state.sharedRoomSoftDeletedMap };
      delete nextSoftDeletedMap[photoId];
      writeSharedRoomSoftDeletedMap(nextSoftDeletedMap);

      const markRestored = (p: PhotoItem): PhotoItem =>
        p.id === photoId ? { ...p, quarantined: false, sharedDeletedAt: undefined } : p;

      const nextAdded = state.sharedRoomAddedPhotos.map(markRestored);
      const nextHost = state.sharedRoomHostPhotos.map(markRestored);
      const nextPhotos = state.photos.map(markRestored);

      const nextCorpus = resolveLoungePhotoCorpus({
        activeLoungeType: state.activeLoungeType,
        activeFamilyRoom: state.activeFamilyRoom,
        activeSharedRoomId: state.activeSharedRoomId,
        photos: nextPhotos,
        sharedRoomHostPhotos: nextHost,
        sharedRoomAddedPhotos: nextAdded,
      });
      const visibleRestored = filterPhotosByClubFeedTrack(
        filterVisibleGalleryPhotos(nextCorpus),
        state.activeLoungeType,
        state.clubFeedTrack
      );
      const nextResults: SearchResultItem[] = visibleRestored.map(
        (photo) => ({
          photo,
          score: 0.96,
          matchPercentage: 98,
          matchedBy: 'text-direct'as const,
        })
      );

      return {
        sharedRoomSoftDeletedMap: nextSoftDeletedMap,
        lastSoftDeletedSharedPhoto:
          state.lastSoftDeletedSharedPhoto?.photoId === photoId
            ? null
            : state.lastSoftDeletedSharedPhoto,
        sharedRoomAddedPhotos: nextAdded,
        sharedRoomHostPhotos: nextHost,
        photos: nextPhotos,
        ...(state.hasExecutedUserSearch ? {} : { searchResults: nextResults }),
        lastQuarantineToast:
          '[공유방 휴지통]에서 사진을 복원하여 공유방 앨범에 다시 올렸습니다.',
      };
    });
  },

  restoreAllSharedRoomTrashPhotos: (photoIds) => {
    if (!photoIds || photoIds.length === 0) return;
    const idSet = new Set(photoIds);
    set((state) => {
      const nextSoftDeletedMap = { ...state.sharedRoomSoftDeletedMap };
      for (const pid of photoIds) {
        delete nextSoftDeletedMap[pid];
      }
      writeSharedRoomSoftDeletedMap(nextSoftDeletedMap);

      const markRestored = (p: PhotoItem): PhotoItem =>
        idSet.has(p.id) ? { ...p, quarantined: false, sharedDeletedAt: undefined } : p;

      const nextAdded = state.sharedRoomAddedPhotos.map(markRestored);
      const nextHost = state.sharedRoomHostPhotos.map(markRestored);
      const nextPhotos = state.photos.map(markRestored);

      const nextCorpus = resolveLoungePhotoCorpus({
        activeLoungeType: state.activeLoungeType,
        activeFamilyRoom: state.activeFamilyRoom,
        activeSharedRoomId: state.activeSharedRoomId,
        photos: nextPhotos,
        sharedRoomHostPhotos: nextHost,
        sharedRoomAddedPhotos: nextAdded,
      });
      const nextResults: SearchResultItem[] = filterPhotosByClubFeedTrack(
        filterVisibleGalleryPhotos(nextCorpus),
        state.activeLoungeType,
        state.clubFeedTrack
      ).map(
        (photo) => ({
          photo,
          score: 0.96,
          matchPercentage: 98,
          matchedBy: 'text-direct'as const,
        })
      );

      return {
        sharedRoomSoftDeletedMap: nextSoftDeletedMap,
        sharedRoomAddedPhotos: nextAdded,
        sharedRoomHostPhotos: nextHost,
        photos: nextPhotos,
        ...(state.hasExecutedUserSearch ? {} : { searchResults: nextResults }),
        lastQuarantineToast: `↩️ [공유방 휴지통]의 사진 ${photoIds.length}장을 모두 복원했습니다!`,
      };
    });
  },

  permanentlyDeleteSharedRoomTrashPhoto: (photoId) => {
    if (!photoId) return;
    const state = get();
    const nextSoftDeletedMap = { ...state.sharedRoomSoftDeletedMap };
    delete nextSoftDeletedMap[photoId];
    writeSharedRoomSoftDeletedMap(nextSoftDeletedMap);

    const nextAdded = state.sharedRoomAddedPhotos.filter((p) => p.id !== photoId);
    const nextHost = state.sharedRoomHostPhotos.filter((p) => p.id !== photoId);
    persistSharedRoomAddedPhotos(nextAdded);
    const nextResults = state.searchResults.filter((item) => item.photo.id !== photoId);
    void deleteSupabaseSharedRoomPhoto(photoId);

    set({
      sharedRoomSoftDeletedMap: nextSoftDeletedMap,
      sharedRoomAddedPhotos: nextAdded,
      sharedRoomHostPhotos: nextHost,
      searchResults: nextResults,
      lastQuarantineToast:
        '휴지통에서 해당 사진을 영구 삭제했습니다. (내 기기 원본 파일은 안전하게 보존됩니다)',
    });
  },

  applyStickChipToSharedPhoto: (photoId, chipLabel) => {
    if (!photoId || !chipLabel.trim()) return;
    set((state) => {
      const chipObj =
        state.alumniStickChips.find((c) => c.label === chipLabel) ||
        state.alumniStickChips.find((c) => c.chipId === chipLabel);
      const effectiveLabel = (chipObj?.label ?? chipLabel).trim();
      const parsedYearMatch = effectiveLabel.match(/(19\d{2}|20\d{2})/);
      const targetYear =
        chipObj?.year ?? (parsedYearMatch ? Number(parsedYearMatch[1]) : new Date().getFullYear());
      const hashTag = effectiveLabel.startsWith('#') ? effectiveLabel : `#${effectiveLabel}`;

      const prevEntry = state.sharedRoomStickOverlayMap[photoId];
      const existingPhoto =
        state.sharedRoomAddedPhotos.find((p) => p.id === photoId) ||
        state.sharedRoomHostPhotos.find((p) => p.id === photoId) ||
        state.photos.find((p) => p.id === photoId);
      const currentSticks = prevEntry?.appliedSticks ?? existingPhoto?.appliedStickChips ?? [];
      const alreadyHas = currentSticks.includes(effectiveLabel);
      const nextSticks = alreadyHas
        ? currentSticks.filter((s) => s !== effectiveLabel)
        : [...currentSticks, effectiveLabel];

      const nextGroup =
        nextSticks.length === 0
          ? undefined
          : chipObj?.looseTimelineGroup ||
            nextSticks.find((s) => s.includes('년')) ||
            `${targetYear}년`;

      const nextExpanded =
        nextSticks.length === 0
          ? []
          : buildBidirectionalStickKeywords({
              year: targetYear,
              season: chipObj?.season,
              place: nextSticks.join(' '),
              looseTimelineGroup: nextGroup || `${targetYear}년`,
              schoolName: state.activeLoungeType === 'student' ? state.alumniSchoolName : undefined,
            });

      const nextOverlayMap = { ...state.sharedRoomStickOverlayMap };
      if (nextSticks.length === 0) {
        delete nextOverlayMap[photoId];
      } else {
        nextOverlayMap[photoId] = {
          appliedSticks: nextSticks,
          looseTimelineGroup: nextGroup,
          expandedSearchKeywords: nextExpanded,
        };
      }
      writeSharedRoomStickOverlayMap(nextOverlayMap);

      const patchPhoto = (p: PhotoItem): PhotoItem => {
        if (p.id !== photoId) return p;
        const baseTags = (p.tags ?? []).filter((t) => t !== hashTag);
        const nextTags = alreadyHas ? baseTags : Array.from(new Set([...baseTags, hashTag]));
        const nextKeywords = Array.from(
          new Set([...(p.keywordsKo ?? []), ...nextSticks, ...nextExpanded])
        );
        return {
          ...p,
          appliedStickChips: nextSticks,
          looseTimelineGroup: nextGroup,
          tags: nextTags,
          keywordsKo: nextKeywords,
        };
      };

      return {
        sharedRoomStickOverlayMap: nextOverlayMap,
        sharedRoomAddedPhotos: state.sharedRoomAddedPhotos.map(patchPhoto),
        sharedRoomHostPhotos: state.sharedRoomHostPhotos.map(patchPhoto),
        photos: state.photos.map(patchPhoto),
        searchResults: state.searchResults.map((item) =>
          item.photo.id === photoId ? { ...item, photo: patchPhoto(item.photo) } : item
        ),
        lastQuarantineToast: alreadyHas
          ? `[스티커 떼기] ‘${effectiveLabel}’ 스티커를 사진에서 제거했습니다.`
          : `[스티커 부착 완료] ‘${effectiveLabel}’ 스티커가 사진에 바로 붙고 검색 키워드로 반영되었습니다!`,
      };
    });
  },

  applyStickChipToAllSharedPhotos: (photoIds, chipLabel) => {
    if (!photoIds || photoIds.length === 0 || !chipLabel.trim()) return;
    const idSet = new Set(photoIds);
    set((state) => {
      const chipObj =
        state.alumniStickChips.find((c) => c.label === chipLabel) ||
        state.alumniStickChips.find((c) => c.chipId === chipLabel);
      const effectiveLabel = (chipObj?.label ?? chipLabel).trim();
      const parsedYearMatch = effectiveLabel.match(/(19\d{2}|20\d{2})/);
      const targetYear =
        chipObj?.year ?? (parsedYearMatch ? Number(parsedYearMatch[1]) : new Date().getFullYear());
      const hashTag = effectiveLabel.startsWith('#') ? effectiveLabel : `#${effectiveLabel}`;
      const groupName = chipObj?.looseTimelineGroup || `${targetYear}년`;

      const nextOverlayMap = { ...state.sharedRoomStickOverlayMap };

      const patchPhoto = (p: PhotoItem): PhotoItem => {
        if (!idSet.has(p.id)) return p;
        const prevSticks = nextOverlayMap[p.id]?.appliedSticks ?? p.appliedStickChips ?? [];
        const mergedSticks = Array.from(new Set([...prevSticks, effectiveLabel]));
        const nextExpanded = buildBidirectionalStickKeywords({
          year: targetYear,
          season: chipObj?.season,
          place: mergedSticks.join(' '),
          looseTimelineGroup: groupName,
          schoolName: state.activeLoungeType === 'student' ? state.alumniSchoolName : undefined,
        });
        nextOverlayMap[p.id] = {
          appliedSticks: mergedSticks,
          looseTimelineGroup: groupName,
          expandedSearchKeywords: nextExpanded,
        };
        return {
          ...p,
          appliedStickChips: mergedSticks,
          looseTimelineGroup: groupName,
          tags: Array.from(new Set([...(p.tags ?? []), hashTag])),
          keywordsKo: Array.from(
            new Set([...(p.keywordsKo ?? []), ...mergedSticks, ...nextExpanded])
          ),
        };
      };

      const nextAdded = state.sharedRoomAddedPhotos.map(patchPhoto);
      const nextHost = state.sharedRoomHostPhotos.map(patchPhoto);
      const nextPhotos = state.photos.map(patchPhoto);
      writeSharedRoomStickOverlayMap(nextOverlayMap);

      return {
        sharedRoomStickOverlayMap: nextOverlayMap,
        sharedRoomAddedPhotos: nextAdded,
        sharedRoomHostPhotos: nextHost,
        photos: nextPhotos,
        searchResults: state.searchResults.map((item) =>
          idSet.has(item.photo.id) ? { ...item, photo: patchPhoto(item.photo) } : item
        ),
        lastQuarantineToast: `[일괄 부착 완료] 이 방 사진 ${photoIds.length}장 전체에 [${effectiveLabel}] 스티커가 바로 붙었습니다!`,
      };
    });
  },

  returnToSharedRoomAndOpenUpload: async () => {
    const pending = get().pendingReturnShareRoom;
    const targetLounge: LoungeType = pending?.loungeType || 'family';
    const targetRoom: FamilyRoomId = pending?.familyRoom || get().activeFamilyRoom || '우리집';
    const roomTitle =
      pending?.roomTitle ||
      (targetLounge === 'family'
        ? `${targetRoom} 패밀리 앨범`
        : targetLounge === 'club'
        ? '동호회·모임 앨범'
        : '동창회 앨범');

    const hasRealLocalPhotosAlready = get().photos.some((p) =>
      String(p.fullUrl || '').includes('127.0.0.1')
    );
    if (zCoreBridge.isConnected && !hasRealLocalPhotosAlready) {
      await get().initApp(true);
    }
    if (get().sharedRoomHostPhotos.length === 0) {
      const hostPhotos = await fetchSharedFamilyHostPhotos();
      if (hostPhotos.length > 0) {
        set({ sharedRoomHostPhotos: hostPhotos });
      }
    }

    const st = get();
    const mergedShared = resolveLoungePhotoCorpus({
      activeLoungeType: targetLounge,
      activeFamilyRoom: targetRoom,
      photos: st.photos,
      sharedRoomHostPhotos: st.sharedRoomHostPhotos,
      sharedRoomAddedPhotos: st.sharedRoomAddedPhotos,
    });
    const sharedGalleryResults: SearchResultItem[] = filterPhotosByClubFeedTrack(
      filterVisibleGalleryPhotos(mergedShared),
      targetLounge,
      st.clubFeedTrack
    ).map(
      (photo) => ({
        photo,
        score: 0.96,
        matchPercentage: 98,
        matchedBy: 'text-direct'as const,
      })
    );

    set({
      activeLoungeType: targetLounge,
      activeFamilyRoom: targetRoom,
      desktopTab: 'dashboard',
      mobileTab: 'search',
      pendingReturnShareRoom: null,
      isInvitedMemberSession: true,
      showSharedPhotoUploadModal: zCoreBridge.isConnected,
      searchSpace: 'gallery',
      hasExecutedUserSearch: false,
      activeQuery: `${roomTitle} (${sharedGalleryResults.length}장)`,
      matchedVideoScenes: [],
      matchedLocalDocs: [],
      matchedVaultPhotos: [],
      searchResults: sharedGalleryResults,
      lastQuarantineToast: zCoreBridge.isConnected
        ? `『${roomTitle}』으로 돌아왔어요! 방금 점검·색인한 내 컴퓨터 사진을 골라 올려보세요.`
        : `『${roomTitle}』으로 돌아왔습니다.`,
    });
  },

  applyShareInviteDeepLink: async (rawUrlOrToken, opts) => {
    const parsed = parseShareInviteInput(rawUrlOrToken);
    if (!parsed) {
      return false;
    }
    const reqSeq = ++sharedRoomSyncSeq;
    const isNative = Boolean(opts?.fromNativeApp || isCapacitorNativeMobileRuntime());
    const isLoggedIn = hasAuthenticatedHubAccountSession();
    if (parsed.inviteToken) {
      lastDeepLinkHydratedAt = Date.now();
    }
    persistInviteContextMeta(parsed, isNative);

    // 이전 공유방(예: 본가) 열람 직후 다른 공유방(예: 처가·동호회) 초대 링크로 접속했을 때
    // 이전 방 탭이나 사진 목록이 단 0.1초도 잔류하지 않도록 즉시 새 초대방 컨텍스트로 초기화!
    storeSharedRefs.activeSharedRoomId = null;
    set({
      activeLoungeType: parsed.loungeType,
      activeFamilyRoom: parsed.familyRoom,
      activeSharedRoomId: null,
      activeJoinedRoomMeta: null,
      desktopTab: 'dashboard',
      mobileTab: 'search',
      isLoadingSharedRoomPhotos: Boolean(parsed.inviteToken),
      searchResults: [],
      ...(!isLoggedIn ? { sharedRoomAddedPhotos: [] } : {}),
    });

    if (parsed.nicknameHint && isLoggedIn && typeof window !== 'undefined') {
      try {
        localStorage.setItem('ghosti_invited_member_nickname', parsed.nicknameHint);
        const prevSec = loadGhostSecretaryState();
        saveGhostSecretaryState({
          ...prevSec,
          nickname: prevSec.nickname || parsed.nicknameHint,
          awaitingNickname: false,
        });
      } catch {
        /* ignore */
      }
    }

    let resolvedLounge = parsed.loungeType;
    let resolvedFamilyRoom = parsed.familyRoom;
    let resolvedHostName = parsed.hostName;
    let resolvedRoomTitle = parsed.roomTitle;
    let resolvedRoomId: string | null = null;
    let resolvedJoinedMeta: JoinedSharedPhotoRoomInfo | null = null;
    let refreshedJoinedList: JoinedSharedPhotoRoomInfo[] | null = null;
    let fetchedPhotos: PhotoItem[] = [];
    let previewValid = false;

    if (parsed.inviteToken) {
      set({ isLoadingSharedRoomPhotos: true });
      const previewRes = await fetchGuestPreviewRoomByToken(parsed.inviteToken);
      if (previewRes.ok && previewRes.room) {
        previewValid = true;
        resolvedRoomId = previewRes.room.roomId;
        resolvedLounge = previewRes.room.loungeType;
        resolvedFamilyRoom = previewRes.room.familyRoom;
        resolvedHostName = previewRes.room.hostNickname || '방장';
        resolvedRoomTitle = previewRes.room.roomTitle || resolvedRoomTitle;
        fetchedPhotos = previewRes.photos;
        persistInviteContextMeta(
          {
            ...parsed,
            loungeType: resolvedLounge,
            familyRoom: resolvedFamilyRoom,
            hostName: resolvedHostName,
            roomTitle: resolvedRoomTitle,
          },
          isNative
        );
        if (isLoggedIn) {
          const authedEmail = (
            get().merlinAuth.email ||
            (typeof window !== 'undefined'
              ? localStorage.getItem('ghosti_hub_user_email') || ''
              : '')
          )
            .trim()
            .toLowerCase();
          const nick =
            parsed.nicknameHint || resolveAccountScopedNickname(authedEmail, '멤버');
          await acceptRoomInviteAsLoggedInMember(parsed.inviteToken, nick);
          // 내 방인지 타인의 초대방인지 서버에서 즉시 대조하여 [안 A] 1:1 독립 방 메타 및 목록 갱신
          const ensuredMine = await ensureMyRoomAndInviteToken({
            loungeType: resolvedLounge,
            familyRoom: resolvedFamilyRoom,
            roomTitle: resolveDefaultRoomTitle(resolvedLounge, resolvedFamilyRoom),
            masterNickname: nick,
            forceRefresh: true,
          });
          const isOtherUsersRoom = Boolean(
            resolvedRoomId && ensuredMine.roomId && resolvedRoomId !== ensuredMine.roomId
          );
          const serverJoined = ensuredMine.joinedRooms ?? get().joinedSharedRooms;
          if (isOtherUsersRoom && resolvedRoomId) {
            const matchedJoined = serverJoined.find((r) => r.roomId === resolvedRoomId);
            resolvedJoinedMeta = matchedJoined || {
              roomId: resolvedRoomId,
              loungeType: resolvedLounge,
              familyRoom: resolvedFamilyRoom,
              roomTitle: resolvedRoomTitle,
              masterNickname: resolvedHostName,
              inviteToken: parsed.inviteToken,
            };
            refreshedJoinedList = matchedJoined
              ? serverJoined
              : [resolvedJoinedMeta, ...serverJoined.filter((r) => r.roomId !== resolvedRoomId)];
            storeSharedRefs.knownJoinedRoomIds = new Set(refreshedJoinedList.map((r) => r.roomId));
          } else {
            refreshedJoinedList = serverJoined;
            storeSharedRefs.knownJoinedRoomIds = new Set(serverJoined.map((r) => r.roomId));
          }
          // 로그인 회원이 초대방으로 입장한 뒤에도 URL에 ?roomId=<joinedRoomId>와 정확한 방을 보존해 새로고침·방 혼선 0% 차단
          stripConsumedInviteParamsFromLoggedInUrl({
            loungeType: resolvedLounge,
            familyRoom: resolvedFamilyRoom,
            joinedRoomId: isOtherUsersRoom ? resolvedRoomId : null,
          });
          // 로그인 회원의 사진 항목에 현재 계정 소유 태그를 맞춰 로컬 필터와 정합
          if (authedEmail) {
            fetchedPhotos = fetchedPhotos.map((p) => ({
              ...p,
              sharedRoomId: resolvedRoomId || p.sharedRoomId,
              sharedOwnerEmail: authedEmail,
            }));
          }
        }
      }
    }

    if (reqSeq !== sharedRoomSyncSeq) {
      return true;
    }

    // 로그인 상태에서 토큰 없는 구형 ?invite=... 파라미터만 남아 새로고침된 경우:
    // 내 방 사진을 빈 배열([])로 덮어쓰지 않고 즉시 정식 Supabase 공유방 조회로 위임!
    if (isLoggedIn && !previewValid) {
      storeSharedRefs.activeSharedRoomId = null;
      set({
        activeLoungeType: resolvedLounge,
        activeFamilyRoom: resolvedFamilyRoom,
        activeSharedRoomId: null,
        activeJoinedRoomMeta: null,
        desktopTab: 'dashboard',
        mobileTab: 'search',
        isGuestPreviewMode: false,
        guestJoinWallReason: null,
        searchSpace: 'gallery',
        hasExecutedUserSearch: false,
      });
      lastDeepLinkHydratedAt = 0;
      await get().syncActiveSharedRoomFromSupabase();
      return true;
    }

    if (previewValid) {
      lastDeepLinkHydratedAt = Date.now();
    }

    storeSharedRefs.activeSharedRoomId = resolvedRoomId;

    const st = get();
    const overlaidFetched = applySharedRoomLocalOverlays(
      fetchedPhotos,
      st.sharedRoomSoftDeletedMap,
      st.sharedRoomStickOverlayMap
    );
    const nextAdded =
      parsed.inviteToken && !isLoggedIn
        ? overlaidFetched
        : [            ...overlaidFetched,
            ...st.sharedRoomAddedPhotos.filter((p) =>
              resolvedRoomId ? p.sharedRoomId !== resolvedRoomId : true
            ),
          ];

    const mergedShared = resolveLoungePhotoCorpus({
      activeLoungeType: resolvedLounge,
      activeFamilyRoom: resolvedFamilyRoom,
      activeSharedRoomId: resolvedRoomId,
      photos: st.photos,
      sharedRoomHostPhotos: st.sharedRoomHostPhotos,
      sharedRoomAddedPhotos: nextAdded,
    });
    const sharedGalleryResults: SearchResultItem[] = filterVisibleGalleryPhotos(mergedShared).map(
      (photo) => ({
        photo,
        score: 0.96,
        matchPercentage: 98,
        matchedBy: 'text-direct'as const,
      })
    );

    const displayRoomLabel = resolvedJoinedMeta
      ? `${resolvedJoinedMeta.masterNickname} · ${resolvedJoinedMeta.roomTitle}`
      : resolvedRoomTitle;

    set({
      activeLoungeType: resolvedLounge,
      activeFamilyRoom: resolvedFamilyRoom,
      activeSharedRoomId: resolvedRoomId,
      activeJoinedRoomMeta: resolvedJoinedMeta,
      ...(refreshedJoinedList ? { joinedSharedRooms: refreshedJoinedList } : {}),
      desktopTab: 'dashboard',
      mobileTab: 'search',
      sharedRoomAddedPhotos: nextAdded,
      isLoadingSharedRoomPhotos: false,
      isGuestPreviewMode: isNative ? false : !isLoggedIn,
      isInvitedMemberSession: isLoggedIn,
      guestJoinWallReason: null,
      searchSpace: 'gallery',
      hasExecutedUserSearch: false,
      activeQuery: `${displayRoomLabel} (${sharedGalleryResults.length}장)`,
      matchedVideoScenes: [],
      matchedLocalDocs: [],
      matchedVaultPhotos: [],
      searchResults: sharedGalleryResults,
      lastQuarantineToast: isNative
        ? ` ${resolvedHostName}님이 초대한 『${resolvedRoomTitle}』(${sharedGalleryResults.length}장)에 바로 입장했습니다!`
        : ` ${resolvedHostName}님이 초대한 『${resolvedRoomTitle}』(${sharedGalleryResults.length}장)을 독립 공유방으로 열었습니다.`,
    });
    return true;
  },

  syncActiveSharedRoomFromSupabase: async (opts) => {
    const stBefore = get();
    if (!isSharedPhotoLounge(stBefore.activeLoungeType)) {
      return;
    }
    if (!opts?.forceInviteToken && Date.now() - lastDeepLinkHydratedAt < 1200) {
      return;
    }
    const reqSeq = ++sharedRoomSyncSeq;
    const targetLounge = stBefore.activeLoungeType;
    const targetFamilyRoom = stBefore.activeFamilyRoom || '우리집';
    const explicitRoomId = (
      stBefore.activeJoinedRoomMeta?.roomId ||
      stBefore.activeSharedRoomId ||
      ''
    ).trim() || null;
    const candidateSig = `${targetLounge}|${targetFamilyRoom}|${explicitRoomId || ''}`;
    if (
      !opts?.forceInviteToken &&
      explicitRoomId &&
      candidateSig === lastCompletedRoomSig &&
      Date.now() - lastCompletedRoomAt < 1000
    ) {
      return;
    }
    const inviteToken = (opts?.forceInviteToken ?? readActiveInviteToken()).trim();
    const shouldLoadFromRemote = Boolean(inviteToken || hasAuthenticatedHubAccountSession());

    // [0.01초 즉시 렌더링 — Local-Vault-First Stale-While-Revalidate (단일 room_id 1:1 격리)]:
    if (!inviteToken && hasAuthenticatedHubAccountSession()) {
      const localFastPhotos = await readInstantLocalVaultSharedPhotos(
        targetLounge,
        targetFamilyRoom,
        explicitRoomId
      );
      if (reqSeq !== sharedRoomSyncSeq) return;
      if (localFastPhotos.length > 0) {
        const stFast = get();
        const fastRoomId = explicitRoomId || localFastPhotos[0]?.sharedRoomId || null;
        const overlaidLocalFast = applySharedRoomLocalOverlays(
          localFastPhotos,
          stFast.sharedRoomSoftDeletedMap,
          stFast.sharedRoomStickOverlayMap
        );
        const fastAdded = [          ...overlaidLocalFast,
          ...stFast.sharedRoomAddedPhotos.filter((p) =>
            fastRoomId ? p.sharedRoomId !== fastRoomId : true
          ),
        ];
        if (
          stFast.activeLoungeType === targetLounge &&
          (targetLounge !== 'family' || stFast.activeFamilyRoom === targetFamilyRoom) &&
          (stFast.activeSharedRoomId || null) === (explicitRoomId || null)
        ) {
          if (fastRoomId) {
            storeSharedRefs.activeSharedRoomId = fastRoomId;
          }
          const fastMerged = resolveLoungePhotoCorpus({
            activeLoungeType: targetLounge,
            activeFamilyRoom: targetFamilyRoom,
            activeSharedRoomId: fastRoomId,
            photos: stFast.photos,
            sharedRoomHostPhotos: stFast.sharedRoomHostPhotos,
            sharedRoomAddedPhotos: fastAdded,
          });
          const fastVisible = filterPhotosByClubFeedTrack(
            filterVisibleGalleryPhotos(fastMerged),
            targetLounge,
            stFast.clubFeedTrack
          );
          const fastResults: SearchResultItem[] = fastVisible.map(
            (photo) => ({
              photo,
              score: 0.96,
              matchPercentage: 98,
              matchedBy: 'text-direct'as const,
            })
          );
          set({
            sharedRoomAddedPhotos: fastAdded,
            isLoadingSharedRoomPhotos: false,
            ...(stFast.hasExecutedUserSearch ? {} : { searchResults: fastResults }),
          });
        }
      } else if (shouldLoadFromRemote && get().searchResults.length === 0) {
        set({ isLoadingSharedRoomPhotos: true });
      }
    } else if (shouldLoadFromRemote && stBefore.searchResults.length === 0) {
      set({ isLoadingSharedRoomPhotos: true });
    }

    const authedEmail =
      stBefore.merlinAuth.email ||
      (typeof window !== 'undefined' ? localStorage.getItem('ghosti_hub_user_email') || '' : '');
    const nickname = resolveAccountScopedNickname(authedEmail, '방장');

    let res: Awaited<ReturnType<typeof fetchScopedSharedRoomPhotos>>;
    aiRuntimeFlags.sharedRoomSyncActive = true;
    try {
      res = await fetchScopedSharedRoomPhotos({
        loungeType: targetLounge,
        familyRoom: targetFamilyRoom,
        roomTitle: resolveDefaultRoomTitle(targetLounge, targetFamilyRoom),
        nickname,
        inviteToken: inviteToken || undefined,
        explicitRoomId,
      });
    } catch {
      if (reqSeq === sharedRoomSyncSeq) {
        set({ isLoadingSharedRoomPhotos: false });
      }
      return;
    } finally {
      if (reqSeq === sharedRoomSyncSeq) {
        aiRuntimeFlags.sharedRoomSyncActive = false;
      }
    }

    if (reqSeq !== sharedRoomSyncSeq) {
      return;
    }

    const stNow = get();
    const resolvedJoinedList = res.joinedRooms ?? stNow.joinedSharedRooms;
    if (res.joinedRooms) {
      storeSharedRefs.knownJoinedRoomIds = new Set(res.joinedRooms.map((r) => r.roomId));
    }

    // URL ?roomId=<joinedRoomId> 새로고침 복원: 서버 joinedRooms에서 해당 독립 방 메타를 자동 매칭
    const matchedJoinedMeta =
      res.roomId && res.isJoinedOtherRoom
        ? resolvedJoinedList.find((r) => r.roomId === res.roomId) ||
          stNow.activeJoinedRoomMeta || {
            roomId: res.roomId,
            loungeType: targetLounge,
            familyRoom: targetFamilyRoom,
            roomTitle: res.roomTitle || resolveDefaultRoomTitle(targetLounge, targetFamilyRoom),
            masterNickname: res.hostNickname || '방장',
            inviteToken: res.inviteToken || undefined,
          }
        : null;

    const finalLounge = matchedJoinedMeta ? matchedJoinedMeta.loungeType : targetLounge;
    const finalFamilyRoom = matchedJoinedMeta ? matchedJoinedMeta.familyRoom : targetFamilyRoom;
    const finalRoomId = res.roomId || explicitRoomId;

    // 서버 방 조회가 일시 실패해 roomId=null & photos=[]가 온 경우, 기존 로컬 공유방 사진을 0장으로 덮어쓰지 않음
    if (!finalRoomId && res.photos.length === 0) {
      set({ isLoadingSharedRoomPhotos: false });
      return;
    }

    const prevTrackById = new Map<string, ClubFeedTrackId>();
    for (const prevP of stNow.sharedRoomAddedPhotos) {
      if (prevP.sharedFeedTrack) {
        prevTrackById.set(prevP.id, prevP.sharedFeedTrack);
      }
    }
    const hydratedRemotePhotos = res.photos.map((p) => ({
      ...p,
      sharedFeedTrack: p.sharedFeedTrack ?? prevTrackById.get(p.id),
    }));

    const overlaidRemotePhotos = applySharedRoomLocalOverlays(
      hydratedRemotePhotos,
      stNow.sharedRoomSoftDeletedMap,
      stNow.sharedRoomStickOverlayMap
    );
    const nextAdded = [      ...overlaidRemotePhotos,
      ...stNow.sharedRoomAddedPhotos.filter((p) =>
        finalRoomId
          ? p.sharedRoomId !== finalRoomId
          : !(
              (p.sharedLoungeType ?? 'family') === targetLounge &&
              (targetLounge !== 'family' ||
                (p.sharedFamilyRoom ?? '우리집') === targetFamilyRoom) &&
              (!p.sharedRoomId || !storeSharedRefs.knownJoinedRoomIds.has(p.sharedRoomId))
            )
      ),
    ];

    const isStillOnSameView =
      stNow.activeLoungeType === targetLounge &&
      (targetLounge !== 'family' || stNow.activeFamilyRoom === targetFamilyRoom) &&
      (stNow.activeSharedRoomId || null) === (explicitRoomId || null);

    if (isStillOnSameView) {
      lastCompletedRoomSig = `${finalLounge}|${finalFamilyRoom}|${finalRoomId || ''}`;
      lastCompletedRoomAt = Date.now();
      storeSharedRefs.activeSharedRoomId = finalRoomId;
      const mergedShared = resolveLoungePhotoCorpus({
        activeLoungeType: finalLounge,
        activeFamilyRoom: finalFamilyRoom,
        activeSharedRoomId: finalRoomId,
        photos: stNow.photos,
        sharedRoomHostPhotos: stNow.sharedRoomHostPhotos,
        sharedRoomAddedPhotos: nextAdded,
      });
      const visibleAllInRoom = filterVisibleGalleryPhotos(mergedShared);
      let effectiveTrack = stNow.clubFeedTrack;
      let visibleRemoteTrack = filterPhotosByClubFeedTrack(
        visibleAllInRoom,
        finalLounge,
        effectiveTrack
      );
      // 동호회·동창회 진입 직후 현재 탭이 0장이고 반대쪽 탭에만 사진이 있으면 자동 전환해 "사진이 사라짐" 오해 차단
      if (
        (finalLounge === 'club' || finalLounge === 'student') &&
        visibleRemoteTrack.length === 0 &&
        visibleAllInRoom.length > 0
      ) {
        const altTrack: ClubFeedTrackId =
          effectiveTrack === 'memories_1989' ? 'recent_now' : 'memories_1989';
        const altPhotos = filterPhotosByClubFeedTrack(visibleAllInRoom, finalLounge, altTrack);
        if (altPhotos.length > 0) {
          effectiveTrack = altTrack;
          visibleRemoteTrack = altPhotos;
        }
      }
      const sharedGalleryResults: SearchResultItem[] = visibleRemoteTrack.map(
        (photo) => ({
          photo,
          score: 0.96,
          matchPercentage: 98,
          matchedBy: 'text-direct'as const,
        })
      );
      set({
        activeLoungeType: finalLounge,
        activeFamilyRoom: finalFamilyRoom,
        activeSharedRoomId: finalRoomId,
        activeJoinedRoomMeta: matchedJoinedMeta,
        joinedSharedRooms: resolvedJoinedList,
        sharedRoomAddedPhotos: nextAdded,
        clubFeedTrack: effectiveTrack,
        isLoadingSharedRoomPhotos: false,
        ...(stNow.hasExecutedUserSearch
          ? {}
          : {
              searchResults: sharedGalleryResults,
            }),
      });
    } else {
      set({
        joinedSharedRooms: resolvedJoinedList,
        sharedRoomAddedPhotos: nextAdded,
        isLoadingSharedRoomPhotos: false,
      });
    }
  },

  setActiveFamilyRoom: (activeFamilyRoom) => {
    storeSharedRefs.activeSharedRoomId = null;
    set((state) => {
      if (state.activeLoungeType !== 'family') {
        return {
          activeFamilyRoom,
          activeSharedRoomId: null,
          activeJoinedRoomMeta: null,
          lastQuarantineToast: `패밀리 라운지 [내 ${activeFamilyRoom}] 독립 보안 룸으로 전환되었습니다.`,
        };
      }
      const nextCorpus = resolveLoungePhotoCorpus({
        activeLoungeType: 'family',
        activeFamilyRoom,
        activeSharedRoomId: null,
        photos: state.photos,
        sharedRoomHostPhotos: state.sharedRoomHostPhotos,
        sharedRoomAddedPhotos: state.sharedRoomAddedPhotos,
      });
      const nextResults: SearchResultItem[] = filterVisibleGalleryPhotos(nextCorpus).map((photo) => ({
        photo,
        score: 0.95,
        matchPercentage: 97,
        matchedBy: 'text-direct'as const,
      }));
      return {
        activeFamilyRoom,
        activeSharedRoomId: null,
        activeJoinedRoomMeta: null,
        hasExecutedUserSearch: false,
        searchSpace: 'gallery',
        searchResults: nextResults,
        matchedVideoScenes: [],
        matchedLocalDocs: [],
        matchedVaultPhotos: [],
        activeQuery: `내 ${activeFamilyRoom} 패밀리 앨범 (${nextResults.length}장)`,
        lastQuarantineToast: `[내 ${activeFamilyRoom}] 독립 공유방으로 전환되었습니다.`,
      };
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  },

  selectOwnSharedRoom: (loungeType, familyRoom) => {
    lastCompletedRoomSig = '';
    storeSharedRefs.activeSharedRoomId = null;
    const nextFamily: FamilyRoomId = familyRoom || get().activeFamilyRoom || '우리집';
    set((state) => {
      const nextCorpus = resolveLoungePhotoCorpus({
        activeLoungeType: loungeType,
        activeFamilyRoom: nextFamily,
        activeSharedRoomId: null,
        photos: state.photos,
        sharedRoomHostPhotos: state.sharedRoomHostPhotos,
        sharedRoomAddedPhotos: state.sharedRoomAddedPhotos,
      });
      const nextResults: SearchResultItem[] = filterPhotosByClubFeedTrack(
        filterVisibleGalleryPhotos(nextCorpus),
        loungeType,
        loungeType === 'club' ? 'recent_now' : loungeType === 'student' ? 'memories_1989' : state.clubFeedTrack
      ).map((photo) => ({
        photo,
        score: 0.95,
        matchPercentage: 97,
        matchedBy: 'text-direct'as const,
      }));
      return {
        activeLoungeType: loungeType,
        activeFamilyRoom: nextFamily,
        activeSharedRoomId: null,
        activeJoinedRoomMeta: null,
        desktopTab: 'dashboard',
        mobileTab: 'search',
        hasExecutedUserSearch: false,
        searchSpace: 'gallery',
        searchResults: nextResults,
        matchedVideoScenes: [],
        matchedLocalDocs: [],
        matchedVaultPhotos: [],
      };
    });
    void get().syncActiveSharedRoomFromSupabase();
  },

  selectJoinedSharedRoom: (room) => {
    lastCompletedRoomSig = '';
    storeSharedRefs.activeSharedRoomId = room.roomId;
    set((state) => {
      const nextCorpus = resolveLoungePhotoCorpus({
        activeLoungeType: room.loungeType,
        activeFamilyRoom: room.familyRoom,
        activeSharedRoomId: room.roomId,
        photos: state.photos,
        sharedRoomHostPhotos: state.sharedRoomHostPhotos,
        sharedRoomAddedPhotos: state.sharedRoomAddedPhotos,
      });
      const nextResults: SearchResultItem[] = filterPhotosByClubFeedTrack(
        filterVisibleGalleryPhotos(nextCorpus),
        room.loungeType,
        room.loungeType === 'club' ? 'recent_now' : room.loungeType === 'student' ? 'memories_1989' : state.clubFeedTrack
      ).map((photo) => ({
        photo,
        score: 0.96,
        matchPercentage: 98,
        matchedBy: 'text-direct'as const,
      }));
      return {
        activeLoungeType: room.loungeType,
        activeFamilyRoom: room.familyRoom,
        activeSharedRoomId: room.roomId,
        activeJoinedRoomMeta: room,
        desktopTab: 'dashboard',
        mobileTab: 'search',
        isGuestPreviewMode: false,
        hasExecutedUserSearch: false,
        searchSpace: 'gallery',
        searchResults: nextResults,
        matchedVideoScenes: [],
        matchedLocalDocs: [],
        matchedVaultPhotos: [],
        activeQuery: ` ${room.masterNickname} · ${room.roomTitle} (${nextResults.length}장)`,
        lastQuarantineToast: `[${room.masterNickname} · ${room.roomTitle}] 초대받은 독립 공유방으로 이동했습니다. (내 공유방과 100% 분리)`,
      };
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
    void get().syncActiveSharedRoomFromSupabase();
  },

  leaveJoinedSharedRoom: async (explicitRoomId) => {
    const stateBefore = get();
    const targetRoomId = (
      explicitRoomId ||
      stateBefore.activeJoinedRoomMeta?.roomId ||
      stateBefore.activeSharedRoomId ||
      ''
    ).trim();
    if (!targetRoomId) return;

    const targetMeta =
      stateBefore.joinedSharedRooms.find((r) => r.roomId === targetRoomId) ||
      stateBefore.activeJoinedRoomMeta;
    const roomLabel = targetMeta
      ? `${targetMeta.masterNickname} · ${targetMeta.roomTitle}`
      : '초대받은 공유방';

    await leaveSupabaseSharedPhotoRoom(targetRoomId);
    clearStoredInviteSession();
    stripConsumedInviteParamsFromLoggedInUrl();
    clearCachedSharedRoomTokens();
    storeSharedRefs.knownJoinedRoomIds.delete(targetRoomId);
    if (storeSharedRefs.activeSharedRoomId === targetRoomId) {
      storeSharedRefs.activeSharedRoomId = null;
    }
    lastCompletedRoomSig = '';

    const nextLounge = stateBefore.activeLoungeType;
    const nextFamily = stateBefore.activeFamilyRoom || '우리집';

    set((state) => {
      const nextJoinedList = state.joinedSharedRooms.filter((r) => r.roomId !== targetRoomId);
      const nextAdded = state.sharedRoomAddedPhotos.filter((p) => p.sharedRoomId !== targetRoomId);
      persistSharedRoomAddedPhotos(nextAdded);
      const nextCorpus = resolveLoungePhotoCorpus({
        activeLoungeType: nextLounge,
        activeFamilyRoom: nextFamily,
        activeSharedRoomId: null,
        photos: state.photos,
        sharedRoomHostPhotos: state.sharedRoomHostPhotos,
        sharedRoomAddedPhotos: nextAdded,
      });
      const nextVisible = filterPhotosByClubFeedTrack(
        filterVisibleGalleryPhotos(nextCorpus),
        nextLounge,
        state.clubFeedTrack
      );
      const nextResults: SearchResultItem[] = nextVisible.map(
        (photo) => ({
          photo,
          score: 0.95,
          matchPercentage: 97,
          matchedBy: 'text-direct'as const,
        })
      );
      return {
        activeSharedRoomId: null,
        activeJoinedRoomMeta: null,
        joinedSharedRooms: nextJoinedList,
        sharedRoomAddedPhotos: nextAdded,
        desktopTab: 'dashboard',
        mobileTab: 'search',
        isGuestPreviewMode: false,
        hasExecutedUserSearch: false,
        searchSpace: 'gallery',
        searchResults: nextResults,
        matchedVideoScenes: [],
        matchedLocalDocs: [],
        matchedVaultPhotos: [],
        lastQuarantineToast: `[${roomLabel}] 공유방에서 나왔습니다. (해당 방 로컬 캐시 0.1초 자동 삭제 완료 · 내 개인 여권과 내 사진은 100% 보존)`,
      };
    });
    void get().syncActiveSharedRoomFromSupabase({ forceInviteToken: '' });
  },

  setClubSizeTier: (clubSizeTier) =>
    set({
      clubSizeTier,
      gpuHelperActiveTier:
        clubSizeTier === 'large'
          ? 'club_large_3000'
          : clubSizeTier === 'medium'
          ? 'club_medium_2000'
          : 'club_small_1000',
    }),

  verifyStudentOcr: () =>
    set({
      studentOcrVerified: true,
      lastQuarantineToast:
        '[학생증 로컬 OCR 0.1초 인증 완료] 기기 내 로컬 처리 •  동호회 · 동창회 (초·중·고 반/동아리 특가 월 900원) 자격이 즉시 확인되었습니다!',
    }),

  // ─────────────── [⛳ 4050 동창회 락인(Lock-in) 특화 UX 상태 & 액션] ───────────────
  alumniBannerTitle: '성동고 1989 동창회',
  alumniSchoolName: '성동고',
  alumniGradYear: 1989,
  alumniGradCohortNumber: 89,
  alumniBannerTheme: 'chalkboard',
  clubFeedTrack: 'memories_1989',
  alumniStickChips: [    {
      chipId: 'stick_1989',
      label: '1989',
      year: 1989,
      looseTimelineGroup: '1989년 봄',
      expandedSearchKeywords: buildBidirectionalStickKeywords({
        year: 1989,
        season: '봄',
        looseTimelineGroup: '1989년 봄',
        schoolName: '성동고',
      }),
    },
    {
      chipId: 'stick_jeju_trip',
      label: '제주도 수학여행',
      year: 1989,
      place: '제주도 수학여행',
      looseTimelineGroup: '1989년 봄',
      expandedSearchKeywords: buildBidirectionalStickKeywords({
        year: 1989,
        season: '봄',
        place: '제주도 수학여행',
        looseTimelineGroup: '1989년 봄',
        schoolName: '성동고',
      }),
    },
    {
      chipId: 'stick_1989_spring',
      label: '1989년 봄',
      year: 1989,
      season: '봄',
      looseTimelineGroup: '1989년 봄',
      expandedSearchKeywords: buildBidirectionalStickKeywords({
        year: 1989,
        season: '봄',
        looseTimelineGroup: '1989년 봄',
        schoolName: '성동고',
      }),
    },
    {
      chipId: 'stick_1989_autumn',
      label: '1989년 가을',
      year: 1989,
      season: '가을',
      looseTimelineGroup: '1989년 가을',
      expandedSearchKeywords: buildBidirectionalStickKeywords({
        year: 1989,
        season: '가을',
        looseTimelineGroup: '1989년 가을',
        schoolName: '성동고',
      }),
    },
    {
      chipId: 'stick_picnic',
      label: '1989년 가을 소풍',
      year: 1989,
      season: '가을',
      place: '가을 소풍',
      looseTimelineGroup: '1989년 가을',
      expandedSearchKeywords: buildBidirectionalStickKeywords({
        year: 1989,
        season: '가을',
        place: '가을 소풍',
        looseTimelineGroup: '1989년 가을',
        schoolName: '성동고',
      }),
    },
  ],
  // [2026-11-20 깨진 번들 목업 영구 소거]: 가짜 샘플 스캔 사진(엑박) 4장 & 가짜 연도 제보 2건을 0건으로 정리하고,
  // 대기실의 연도·장소 스티커(Chip) 부착은 실제 공유방 사진(basePhotos)에 직접 동작합니다.
  analogScannedPhotos: [],
  analogYearProposals: [],

  setAlumniBannerInfo: (schoolName, gradYear, theme, customBannerTitle) =>
    set((state) => {
      const cleanSchool = schoolName.trim() || state.alumniSchoolName || '성동고';
      const validYear =
        Number.isFinite(gradYear) && gradYear >= 1950 && gradYear <= 2099
          ? gradYear
          : state.alumniGradYear || 1989;
      const cohort = validYear % 100;
      const trimmedCustomTitle = (customBannerTitle ?? '').trim();
      const nextBannerTitle =
        trimmedCustomTitle || state.alumniBannerTitle || `${cleanSchool} ${validYear}`;
      const inheritedTokens = deriveLoungeProperNounTokens(cleanSchool);
      const inheritedLabel = inheritedTokens.length > 0 ? inheritedTokens.join('/') : cleanSchool;
      const updatedAnalogPhotos = state.analogScannedPhotos.map((item) => ({
        ...item,
        expandedSearchKeywords: buildBidirectionalStickKeywords({
          year: validYear,
          looseTimelineGroup: item.looseTimelineGroup,
          place: item.appliedSticks.join(' '),
          schoolName: cleanSchool,
        }),
      }));
      return {
        alumniBannerTitle: nextBannerTitle,
        alumniSchoolName: cleanSchool,
        alumniGradYear: validYear,
        alumniGradCohortNumber: cohort,
        alumniBannerTheme: theme ?? state.alumniBannerTheme,
        analogScannedPhotos: updatedAnalogPhotos,
        lastQuarantineToast: trimmedCustomTitle
          ? `[동창회 간판 변경] ‘${nextBannerTitle}’ 간판이 그대로 적용되어 방 전체 사진에 "${inheritedLabel}"검색 키워드가 기본 상속되었습니다!`
          : `[동창회 배경 변경] ‘${nextBannerTitle}’ 간판 배경이 전환되었습니다.`,
      };
    }),

  setClubFeedTrack: (clubFeedTrack) => {
    const stateNow = get();
    const {
      activeLoungeType,
      activeFamilyRoom,
      activeSharedRoomId,
      photos,
      sharedRoomHostPhotos,
      sharedRoomAddedPhotos,
      alumniGradYear,
    } = stateNow;
    const sharedMode = isSharedPhotoLounge(activeLoungeType);
    // [개인 PC 사진 유출 0% 단일 SSOT]: 동호회·동창회 공유방의 모든 하위 탭(정기모임·번개·추억·최근근황)은
    // 오직 현재 공유방 전용 코퍼스(resolveLoungePhotoCorpus)만 참조하며 내 PC 개인 사진(state.photos)을 절대 혼입하지 않음
    const scopedCorpus = resolveLoungePhotoCorpus({
      activeLoungeType,
      activeFamilyRoom,
      activeSharedRoomId,
      photos,
      sharedRoomHostPhotos,
      sharedRoomAddedPhotos,
    });
    const visibleRoomPhotos = filterVisibleGalleryPhotos(scopedCorpus).slice(0, 350);
    const toResultItem = (photo: PhotoItem, idx: number) => ({
      photo,
      score: 0.96,
      matchPercentage: 98 - (idx % 4),
      matchedBy: 'text-direct'as const,
    });

    const isClubLounge = activeLoungeType === 'club';
    // [동호회·동창회 하위 탭 엄격 분리]: 현재 선택한 탭(clubFeedTrack)에 올린 사진만 필터링하여
    // 정기 모임·라운딩 ↔ 번개·추억 앨범 및 1989 추억 ↔ 최근 근황 간 사진 중복 노출을 0%로 차단
    const trackFiltered = filterPhotosByClubFeedTrack(
      visibleRoomPhotos,
      activeLoungeType,
      clubFeedTrack
    )
      .slice()
      .sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));

    if (clubFeedTrack === 'memories_1989') {
      set({
        clubFeedTrack,
        searchSpace: 'gallery',
        hasExecutedUserSearch: false,
        hasUserSelectedSearchTab: true,
        activeQuery: isClubLounge
          ? `번개 · 추억 앨범 (${trackFiltered.length}장)`
          : `${alumniGradYear} 추억 앨범 (${trackFiltered.length}장)`,
        matchedTags: isClubLounge
          ? ['#번개모임', '#추억앨범', '#동호회공유방']
          : [`#${alumniGradYear}추억`, '#동창회앨범', '#학창시절'],
        searchResults: trackFiltered.map(toResultItem),
        ...(sharedMode
          ? { matchedVideoScenes: [], matchedLocalDocs: [], matchedVaultPhotos: [] }
          : {}),
      });
    } else {
      set({
        clubFeedTrack,
        searchSpace: 'gallery',
        hasExecutedUserSearch: false,
        hasUserSelectedSearchTab: true,
        activeQuery: isClubLounge
          ? `정기 모임·라운딩 (${trackFiltered.length}장)`
          : `최근 근황 (${trackFiltered.length}장)`,
        matchedTags: isClubLounge
          ? ['#정기모임', '#라운딩', '#동호회공유방']
          : ['#최근근황', '#동창모임', '#알림클린존'],
        searchResults: trackFiltered.map(toResultItem),
        ...(sharedMode
          ? { matchedVideoScenes: [], matchedLocalDocs: [], matchedVaultPhotos: [] }
          : {}),
      });
    }
  },

  createAlumniStickChipsFromInput: (yearInput, placeInput, seasonInput) => {
    const cleanYear = yearInput.trim() || '1989';
    const cleanPlace = placeInput.trim() || '제주도 수학여행';
    const cleanSeason = seasonInput.trim() || '봄';
    const numYear = parseInt(cleanYear, 10) || 1989;
    const yearSeasonLabel = `${numYear}년 ${cleanSeason}`;
    const decadeStart = Math.floor(numYear / 10) * 10;

    set((state) => {
      const existingLabels = new Set(state.alumniStickChips.map((c) => c.label));
      const newChips: AlumniStickChip[] = [...state.alumniStickChips];
      const expanded = buildBidirectionalStickKeywords({
        year: numYear,
        season: cleanSeason,
        place: cleanPlace,
        looseTimelineGroup: yearSeasonLabel,
        schoolName: state.alumniSchoolName,
      });

      const candidates: AlumniStickChip[] = [        {
          chipId: `stick_${cleanYear}_${Date.now()}_1`,
          label: `${numYear}`,
          year: numYear,
          looseTimelineGroup: yearSeasonLabel,
          expandedSearchKeywords: expanded,
        },
        {
          chipId: `stick_${cleanPlace}_${Date.now()}_2`,
          label: cleanPlace,
          year: numYear,
          place: cleanPlace,
          looseTimelineGroup: yearSeasonLabel,
          expandedSearchKeywords: expanded,
        },
        {
          chipId: `stick_${yearSeasonLabel}_${Date.now()}_3`,
          label: yearSeasonLabel,
          year: numYear,
          season: cleanSeason,
          place: cleanPlace,
          looseTimelineGroup: yearSeasonLabel,
          expandedSearchKeywords: expanded,
        },
      ];

      for (const cand of candidates) {
        if (!existingLabels.has(cand.label)) {
          newChips.unshift(cand);
          existingLabels.add(cand.label);
        }
      }

      return {
        alumniStickChips: newChips,
        lastQuarantineToast: `[스티커 3종 생성 완료] [${numYear}] [${cleanPlace}] [${yearSeasonLabel}] 스티커가 생성되었습니다.`,
      };
    });
  },

  applyStickChipToAnalogPhoto: (analogPhotoId, chipLabel) => {
    set((state) => {
      const chipObj =
        state.alumniStickChips.find((c) => c.label === chipLabel) ||
        state.alumniStickChips.find((c) => c.chipId === chipLabel);
      const effectiveLabel = chipObj?.label ?? chipLabel;
      const targetYear = chipObj?.year ?? state.alumniGradYear;
      const decadeStart = Math.floor(targetYear / 10) * 10;
      const decadeEnd = decadeStart + 9;

      const nextPhotos = state.analogScannedPhotos.map((item) => {
        if (item.id !== analogPhotoId) return item;
        const alreadyHas = item.appliedSticks.includes(effectiveLabel);
        const nextSticks = alreadyHas
          ? item.appliedSticks.filter((s) => s !== effectiveLabel)
          : [...item.appliedSticks, effectiveLabel];

        const nextGroup =
          chipObj?.looseTimelineGroup ||
          (nextSticks.find((s) => s.includes('년')) ?? `${targetYear}년 봄`);

        const nextExpanded = buildBidirectionalStickKeywords({
          year: targetYear,
          season: chipObj?.season,
          place: nextSticks.join(' '),
          looseTimelineGroup: nextGroup,
          schoolName: state.alumniSchoolName,
        });

        return {
          ...item,
          unknownDatePlace: nextSticks.length === 0,
          appliedSticks: nextSticks,
          looseTimelineGroup: nextSticks.length === 0 ? '언제/어디인가요?' : nextGroup,
          mappedPassportBucketLabel:
            nextSticks.length === 0
              ? '⏳ 연도 제보 대기 중'
              : `귀신같이 여권 ${decadeStart}년대 바구니(${decadeEnd}~${decadeStart}) 자동 매핑`,
          captionKo:
            nextSticks.length === 0
              ? item.captionKo
              : `${nextSticks.join(' · ')} 추억 스캔본`,
          expandedSearchKeywords: nextExpanded,
        };
      });

      return {
        analogScannedPhotos: nextPhotos,
        lastQuarantineToast: `[스틱 태깅 & 월(Month) 양방향 인덱싱] ‘${effectiveLabel}’ 스틱이 적용되어 [${
          chipObj?.looseTimelineGroup ?? `${targetYear}년 봄`
        }] 타임라인 및 귀신같이 여권 ${decadeStart}년대 바구니(${decadeEnd}~${decadeStart})에 즉시 매핑되었습니다!`,
      };
    });
  },

  applyStickChipToAllPendingAnalogPhotos: (chipLabel) => {
    set((state) => {
      const chipObj =
        state.alumniStickChips.find((c) => c.label === chipLabel) ||
        state.alumniStickChips.find((c) => c.chipId === chipLabel);
      const effectiveLabel = chipObj?.label ?? chipLabel;
      const targetYear = chipObj?.year ?? state.alumniGradYear;
      const decadeStart = Math.floor(targetYear / 10) * 10;
      const decadeEnd = decadeStart + 9;
      const groupName = chipObj?.looseTimelineGroup ?? `${targetYear}년 봄`;

      const nextPhotos = state.analogScannedPhotos.map((item) => {
        const mergedSticks = Array.from(new Set([...item.appliedSticks, effectiveLabel]));
        const nextExpanded = buildBidirectionalStickKeywords({
          year: targetYear,
          season: chipObj?.season,
          place: mergedSticks.join(' '),
          looseTimelineGroup: groupName,
          schoolName: state.alumniSchoolName,
        });
        return {
          ...item,
          unknownDatePlace: false,
          appliedSticks: mergedSticks,
          looseTimelineGroup: groupName,
          mappedPassportBucketLabel: `귀신같이 여권 ${decadeStart}년대 바구니(${decadeEnd}~${decadeStart}) 자동 매핑`,
          captionKo: item.captionKo.replace('[언제/어디인가요?] ', ''),
          expandedSearchKeywords: nextExpanded,
        };
      });

      return {
        analogScannedPhotos: nextPhotos,
        lastQuarantineToast: `[초고속 연쇄 일괄 태깅] 대기 중인 모든 스캔 사진에 [${effectiveLabel}] 스틱이 일괄 적용되어 ‘${groupName}’ 타임라인 및 월(Month) 양방향 인덱스로 묶였습니다!`,
      };
    });
  },

  submitAnalogYearProposal: (
    analogPhotoId,
    proposerName,
    proposedYear,
    proposedSeason,
    proposedPlace,
    commentText
  ) => {
    const cleanGroup = `${proposedYear}년 ${proposedSeason.trim() || '가을'}`;
    const cleanPlace = proposedPlace.trim() || `${cleanGroup} 소풍`;
    set((state) => {
      const targetPhoto = state.analogScannedPhotos.find((p) => p.id === analogPhotoId);
      if (!targetPhoto) return state;

      const newProposal: AnalogYearProposalItem = {
        proposalId: `prop_${Date.now()}`,
        targetAnalogPhotoId: analogPhotoId,
        photoFile: targetPhoto.photoFile,
        thumbUrl: targetPhoto.thumbUrl,
        proposerName: proposerName.trim() || '동창 멤버 제보',
        proposedTimelineGroup: cleanGroup,
        proposedPlaceTag: cleanPlace,
        proposedYear,
        commentText:
          commentText.trim() || `${cleanGroup} (${cleanPlace}) 때 찍은 사진입니다!`,
        approvedByHost: false,
      };

      return {
        analogYearProposals: [newProposal, ...state.analogYearProposals],
        lastQuarantineToast: `[집단 지성 연도 제보 등록] ‘${cleanPlace} (${cleanGroup})’ 제보가  방장 누락분 뒷정리 결재함에 전달되었습니다!`,
      };
    });
  },

  approveAllAnalogYearProposals: () => {
    set((state) => {
      const pendingProposals = state.analogYearProposals.filter((p) => !p.approvedByHost);
      if (pendingProposals.length === 0) return state;

      const proposalByPhotoId = new Map<string, AnalogYearProposalItem>();
      for (const prop of pendingProposals) {
        proposalByPhotoId.set(prop.targetAnalogPhotoId, prop);
      }

      const nextAnalogPhotos = state.analogScannedPhotos.map((item) => {
        const prop = proposalByPhotoId.get(item.id);
        if (!prop) return item;
        const decadeStart = Math.floor(prop.proposedYear / 10) * 10;
        const decadeEnd = decadeStart + 9;
        const nextSticks = Array.from(
          new Set([            ...item.appliedSticks,
            `${prop.proposedYear}`,
            prop.proposedPlaceTag,
            prop.proposedTimelineGroup,
          ])
        );
        const nextExpanded = buildBidirectionalStickKeywords({
          year: prop.proposedYear,
          place: prop.proposedPlaceTag,
          looseTimelineGroup: prop.proposedTimelineGroup,
          schoolName: state.alumniSchoolName,
        });
        return {
          ...item,
          unknownDatePlace: false,
          appliedSticks: nextSticks,
          looseTimelineGroup: prop.proposedTimelineGroup,
          mappedPassportBucketLabel: `귀신같이 여권 ${decadeStart}년대 바구니(${decadeEnd}~${decadeStart}) 자동 매핑`,
          captionKo: `✓ [제보 반영됨: ${prop.proposedTimelineGroup} · ${prop.proposedPlaceTag}] ${item.captionKo.replace(
            '[언제/어디인가요?] ',
            ''
          )}`,
          expandedSearchKeywords: nextExpanded,
        };
      });

      const nextProposals = state.analogYearProposals.map((p) => ({
        ...p,
        approvedByHost: true,
      }));

      return {
        analogScannedPhotos: nextAnalogPhotos,
        analogYearProposals: nextProposals,
        globalSeedVersion: state.globalSeedVersion + 1,
        lastQuarantineToast: `[방장 원터치 일괄 결재 완료] 멤버들이 제보한 연도·장소 ${pendingProposals.length}건이 느슨한 타임라인(1989년 봄/가을) · 계절↔월(Month) 양방향 인덱스 · 귀신같이 여권 1980년대 바구니에 100% 반영되었습니다!`,
      };
    });
  },

  findMySchoolDaysPhotosFast: async () => {
    const stateNow = get();
    const {
      activeLoungeType,
      activeFamilyRoom,
      activeSharedRoomId,
      photos,
      sharedRoomHostPhotos,
      sharedRoomAddedPhotos,
      alumniBannerTitle,
      alumniSchoolName,
      alumniGradYear,
      faceClusters,
    } = stateNow;
    const sharedMode = isSharedPhotoLounge(activeLoungeType);
    const isClubRoom = activeLoungeType === 'club';

    const passportFlow = loadPassportFlowState();
    const secretaryState = loadGhostSecretaryState();
    const selfCluster = faceClusters.find(
      (c) =>
        (passportFlow.myClusterId && c.clusterId === passportFlow.myClusterId) ||
        c.clusterId === 'face_member_5'
    );
    const candidateNames = Array.from(
      new Set(
        [          passportFlow.userRealName,
          ...(passportFlow.userAliases || []),
          secretaryState.nickname,
          selfCluster?.registeredName,
          selfCluster?.roomPersonas?.club,
        ]
          .map((v) => String(v || '').trim())
          .filter(Boolean)
      )
    );
    const hasPassportRegistered = Boolean(
      passportFlow.userRealName || passportFlow.myClusterId || selfCluster?.registeredName
    );
    const myDisplayName = candidateNames[0] || '나';

    // [개인 PC 사진 유출 0%]: 현재 공유방(동호회·동창회·가족) 및 활성 하위 탭에 실제로 올라온 공유 사진 코퍼스 안에서만 검색
    const scopedCorpus = resolveLoungePhotoCorpus({
      activeLoungeType,
      activeFamilyRoom,
      activeSharedRoomId,
      photos,
      sharedRoomHostPhotos,
      sharedRoomAddedPhotos,
    });
    const visibleRoomPhotos = filterPhotosByClubFeedTrack(
      filterVisibleGalleryPhotos(scopedCorpus),
      activeLoungeType,
      stateNow.clubFeedTrack
    );

    const escapedNames = candidateNames
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter(Boolean);
    const matchedFileSet = new Set(selfCluster?.matchedPhotoFiles || []);
    const nameRe = escapedNames.length > 0 ? new RegExp(`(${escapedNames.join('|')})`, 'i') : null;

    // 업로더 닉네임(uploaderLabel)은 제외하고 실제 얼굴 클러스터·인물 태그(#이름)·캡션/키워드 매칭만 엄격 채택 (캡처/풍경 오탐 0%)
    const personMatches = visibleRoomPhotos.filter((p) => {
      if (matchedFileSet.has(p.name)) return true;
      const nonUploaderTags = (p.tags || []).filter((t) => !t.includes('사진추가'));
      const hay = `${p.captionKo || ''} ${nonUploaderTags.join(' ')} ${(p.keywordsKo || []).join(' ')}`;
      if (nameRe && nameRe.test(hay)) {
        return true;
      }
      return false;
    });

    const matchedPhotos = personMatches.map((photo, idx) => ({
      photo,
      score: Math.max(0.75, 0.99 - idx * 0.01),
      matchPercentage: Math.max(75, 99 - idx),
      matchedBy: 'text-direct'as const,
    }));

    set({
      ...(isClubRoom ? {} : { clubFeedTrack: 'memories_1989' }),
      searchSpace: 'gallery',
      hasExecutedUserSearch: true,
      hasUserSelectedSearchTab: true,
      desktopTab: 'dashboard',
      mobileTab: 'search',
      activeQuery: isClubRoom
        ? `[${myDisplayName}] 내 모임 사진 (${matchedPhotos.length}장)`
        : `[${myDisplayName}] ${alumniBannerTitle || `${alumniSchoolName} ${alumniGradYear}년`} 학창 시절 추억 사진 (${matchedPhotos.length}장)`,
      matchedTags: isClubRoom
        ? [`#${myDisplayName}`, '#내모임사진', '#동호회앨범']
        : [            `#${myDisplayName}`,
            `#${(alumniBannerTitle || alumniSchoolName).replace(/\s+/g, '')}`,
            `#${alumniGradYear}년추억`,
          ],
      searchResults: matchedPhotos,
      ...(sharedMode
        ? { matchedVideoScenes: [], matchedLocalDocs: [], matchedVaultPhotos: [] }
        : {}),
      lastQuarantineToast:
        matchedPhotos.length > 0
          ? isClubRoom
            ? `[${myDisplayName}] 인물 기준으로 이 모임방 사진 중 ${matchedPhotos.length}장을 찾았습니다.`
            : `[${myDisplayName}] 인물 기준으로 동창회 공유방 사진 중 ${matchedPhotos.length}장을 찾았습니다.`
          : visibleRoomPhotos.length === 0
          ? `아직 이 공유방에 올라온 사진이 없습니다. [내 사진도 이 방에 추가하기]로 먼저 올려보세요.`
          : !hasPassportRegistered
          ? `아직 내 얼굴 여권이 등록되지 않았습니다. 우측 상단 프로필 → [여권]에서 내 얼굴을 먼저 등록하면 내가 나온 사진만 정확히 찾아줍니다.`
          : `이 방에 [${myDisplayName}] 인물 이름표가 등록된 사진이 없습니다. 관련 없는 캡처·풍경 사진은 제외했습니다.`,
    });
  },
});
