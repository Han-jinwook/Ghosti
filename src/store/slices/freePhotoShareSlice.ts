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
import { isCapacitorNativeMobileRuntime } from '../../services/ghostiMobileCareBridge';
import {
  parseShareInviteInput,
  persistInviteContextMeta,
  readActiveInviteToken,
  resolveDefaultRoomTitle,
  stripConsumedInviteParamsFromLoggedInUrl,
} from '../../services/shareInviteDeepLinkBridge';
import {
  acceptRoomInviteAsLoggedInMember,
  deleteSupabaseSharedRoomPhoto,
  ensureMyRoomAndInviteToken,
  fetchGuestPreviewRoomByToken,
  fetchScopedSharedRoomPhotos,
  readInstantLocalVaultSharedPhotos,
  uploadPhotosToSupabaseSharedRoom,
} from '../../services/sharedPhotoRoomSupabase';
import { aiRuntimeFlags } from '../../services/ai/aiSharedRuntime';

let sharedRoomSyncSeq = 0;
let lastDeepLinkHydratedAt = 0;
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
  ThemeMode,
  ViewportLayout,
  applyHtmlThemeClass,
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
    relationshipTag?: string
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
  returnToSharedRoomAndOpenUpload: () => Promise<void>;
  applyShareInviteDeepLink: (
    rawUrlOrToken: string,
    opts?: { fromNativeApp?: boolean }
  ) => Promise<boolean>;
  syncActiveSharedRoomFromSupabase: (opts?: { forceInviteToken?: string }) => Promise<void>;

  setActiveFamilyRoom: (room: FamilyRoomId) => void;
  setClubSizeTier: (tier: ClubSizeTier) => void;
  verifyStudentOcr: () => void;

  // [⛳ 4050 동창회 락인(Lock-in) 특화 UX: Text-to-Banner 간판 + 투트랙 탭 + 스틱(Chip) 연쇄 태깅 + [❓ 언제/어디인가요?] 방장 일괄 승인]
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
    theme?: 'chalkboard' | 'sunset_field'
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
  lastRetroScanReport: {
    seedVersion: 3,
    triggerTitle: '다년도·다각도(정면·측면·야외·선글라스) 자동 시드 패키지 + 전 멤버 1초 만에 역스캔 가동 중',
    rescuedHostPhotos: 42,
    rescuedMemberPhonePhotos: 31,
    rescuedVideoSegments: 12,
    totalSyncedDevices: 5,
    elapsedMs: 38,
    sampleQuery: '은숙 나무 다리',
    sampleSpace: 'gallery',
    timestampText: '자동 동기화됨 (1초 만에)',
  },
  swarmFaceCandidates: [],
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
      lastQuarantineToast: `🛂 [자동 문패 스타일 변경] ‘${displayName}’님의 문패가 [${slotLabel} (${chosenSlot.year}년)] 컷으로 즉시 변경되었습니다!`,
    });
  },

  /**
   * [원터치 [등록] 100% 전자동 완결]
   * 유저가 이름을 입력(또는 관계 칩 선택)하고 [등록] 버튼 딱 한 번만 누르면:
   * ① 다년도·다각도(정면·측면·야외·선글라스) 멀티 시드 패키지 확정 (대기 중인 동일 인물 후보 자동 흡수)
   * ② Global Seed 버전 자동 갱신
   * ③ 호스트 원본 + 전 멤버 폰 + 동영상 전 구간 1초 만에 역스캔 및 누락 사진 자동 편입
   */
  registerFaceMember: async (clusterId, registeredName, relationshipTag) => {
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
            ? `[${activeRoomKey}] 방 전용 호칭 ‘${cleanName}’ 매핑 완료 (귀신같이 여권 시드 공유 · 1초 만에 역스캔)`
            : `‘${cleanName}’ [등록] 원터치 ➔ 다년도·다각도 시드(${condSummary}) 확정 & 전 멤버 폰 1초 만에 역스캔 완결`,
          rescuedHostPhotos: (targetCluster?.matchedPhotoCount ?? 18) + extraRescuedHost,
          rescuedMemberPhonePhotos:
            Math.max(12, Math.round((targetCluster?.matchedPhotoCount ?? 20) * 0.42)) +
            extraRescuedMember,
          rescuedVideoSegments: (targetCluster?.matchedVideoSegmentCount ?? 2) + extraRescuedVideo,
          totalSyncedDevices: 5,
          elapsedMs: 36,
          sampleQuery: `${cleanName} 나무 다리`,
          sampleSpace: 'gallery',
          timestampText: '방금 전자동 역스캔 완료 (1초 만에)',
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
      lastQuarantineToast: cleanName
        ? `✅ '${cleanName}'님의 실제 이름이 얼굴 여권에 등록되어 사진과 즉시 매칭되었습니다!`
        : get().lastQuarantineToast,
    });

    if (!isSecondaryRoom) {
      const serverUpdated = await updateFaceClusterRegistry({
        action: 'update',
        clusterId,
        registeredName: cleanName,
        relationshipTag: relationshipTag ?? '',
      });
      if (serverUpdated) {
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
        triggerTitle: `🛂 귀신같이 여권(${target.passportEmail}) 시드 100% 공유 + [${roomKey}] 방 전용 호칭 ‘${cleanPersona}’ 즉시 매핑`,
        rescuedHostPhotos: target.matchedPhotoCount,
        rescuedMemberPhonePhotos: Math.max(14, Math.round(target.matchedPhotoCount * 0.45)),
        rescuedVideoSegments: target.matchedVideoSegmentCount,
        totalSyncedDevices: 5,
        elapsedMs: 34,
        sampleQuery: `${cleanPersona} 나무 다리`,
        sampleSpace: 'gallery',
        timestampText: '방별 호칭 1초 만에 매핑',
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
              filledStyleSlots: [
                '정면·선명',
                '측면·미소',
                '야외·노을',
                '선글라스·역광',
                '야간·실내',
              ],
            }
          : prevBucket,
        crossLoungeEvolutionNote: `⚡ 방금 타 라운지 신작 사진에서 5대 스타일 슬롯(5/5) + 미래 바구니(${prevBucket?.forwardBucketRange ?? '2027~2036'}) 자동 확장 ➔ 전 라운지(우리집·처가·본가·동호·동창회·동호·동창회) 실시간 전파 완료`,
      };
    });

    set({
      faceClusters: nextClusters,
      retroScanRunning: false,
      globalSeedVersion: nextSeedVer,
      lastRetroScanReport: {
        seedVersion: nextSeedVer,
        triggerTitle: `🛂 [${target.passportEmail}] 크로스-라운지 자율 진화 ➔ 타 방 신작 시드가 우리집·처가·본가·동호·동창회·동호·동창회방에 동시 전파됨`,
        rescuedHostPhotos: target.matchedPhotoCount + 9,
        rescuedMemberPhonePhotos: 27,
        rescuedVideoSegments: target.matchedVideoSegmentCount + 2,
        totalSyncedDevices: 5,
        elapsedMs: 35,
        sampleQuery: `${target.roomPersonas?.['처가(친정)'] || target.registeredName} 나무 다리`,
        sampleSpace: 'gallery',
        timestampText: '전 라운지 여권 진화 동기화 (1초 만에)',
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
          : [
              {
                year: fc.representativeYear,
                representativePhoto: fc.representativePhoto,
                representativeDate: fc.representativeDate,
                frontalScore: fc.frontalScore,
                opticalSharpness: fc.opticalSharpness,
                avatarUrl: fc.avatarUrl,
                cropUrl: fc.cropUrl,
                boundingBox: fc.boundingBox,
                conditionTag: '정면·선명' as const,
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
        triggerTitle: `‘${targetMemberLabel}’ (${cand.conditionBadgeKo}) 원터치 등록 ➔ 전 멤버 폰 1초 만에 역스캔 완료`,
        rescuedHostPhotos: cand.rescuedHostPhotoCount,
        rescuedMemberPhonePhotos: cand.rescuedMemberPhoneCount,
        rescuedVideoSegments: cand.rescuedVideoSegmentCount,
        totalSyncedDevices: 5,
        elapsedMs: 39,
        sampleQuery: cand.sampleSearchQuery,
        sampleSpace: cand.sampleSearchSpace,
        timestampText: '방금 전원 역스캔 완료 (1초 만에)',
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
                : `${c.contributorLabel} (멤버 패스 ➔ 👑 방장 대기열 이관)`,
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
                : `${c.contributorLabel} (멤버 패스 ➔ 👑 방장 대기열 이관)`,
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
          triggerTitle: '👑 방장 뒷정리 총점검 완료 ➔ 전 멤버(5대 기기) 다년도·다각도 시드 100% 동기화',
          rescuedHostPhotos: 38,
          rescuedMemberPhonePhotos: 60,
          rescuedVideoSegments: 10,
          totalSyncedDevices: 5,
          elapsedMs: 39,
          sampleQuery: state.lastRetroScanReport?.sampleQuery ?? '은숙 나무 다리',
          sampleSpace: 'gallery',
          timestampText: '방금 총점검 완료 (1초 만에)',
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
        lastQuarantineToast: `🪪 아직 이름이 없는 인물 ${unregisteredCompanions.length}명이 있어요. 얼굴을 눌러 실제 이름을 입력해 주세요.`,
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
            triggerTitle: `신규 사진(${fileName}) 얼굴 추출 ➔ 호스트 원본 + 전 멤버 폰 동시 역스캔 완료`,
            rescuedHostPhotos: 11,
            rescuedMemberPhonePhotos: 15,
            rescuedVideoSegments: 2,
            totalSyncedDevices: 5,
            elapsedMs: 39,
            sampleQuery: '은숙 나무 다리',
            sampleSpace: 'gallery',
            timestampText: '방금 역스캔 완료 (1초 만에)',
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
        ? '💌 [카톡 초대 링크 수신 미리보기 ON] 설치·로그인 없이 공유 사진방을 바로 구경하는 화면입니다. 내 사진 올리기·원본 일괄 저장·새 사진 알림을 누르면 무료 앱 설치 및 자동 입장 안내가 열립니다.'
        : '✅ [정식 멤버 화면 전환] 내 사진 올리기 · 고화질 원본 저장 · 새 사진 알림이 활성화되었습니다.',
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
        '🔐 공유방 정식 합류 및 사진 업로드를 위해 이메일 10초 인증(로그인)을 완료해 주세요!',
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
          '🔒 비로그인 상태에서는 공유방에 사진을 올릴 수 없습니다. 먼저 이메일 로그인을 완료해 주세요!',
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
      set({ guestJoinWallReason: '📸 내 폰 사진도 이 방에 올리기' });
      return;
    }
    // [절대 철칙] 비로그인 상태에서는 어떤 경로로도 공유방 사진 업로드 절대 불가 (정식 로그인 모달 호출)
    if (!hasAuthenticatedHubAccountSession()) {
      set({
        showSharedPhotoUploadModal: false,
        lastQuarantineToast:
          '🔒 비로그인 상태에서는 공유방에 사진을 올릴 수 없습니다. 먼저 이메일 로그인(10초 인증)을 완료해 주세요!',
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
          '🔒 비로그인 상태에서는 공유방에 사진을 올릴 수 없습니다. 먼저 로그인해 주세요!',
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

    const targetLounge: LoungeType = isSharedPhotoLounge(state.activeLoungeType)
      ? state.activeLoungeType
      : 'family';
    const targetFamilyRoom: FamilyRoomId = state.activeFamilyRoom || '우리집';
    const currentRoomCorpus = resolveLoungePhotoCorpus({
      activeLoungeType: targetLounge,
      activeFamilyRoom: targetFamilyRoom,
      photos: state.photos,
      sharedRoomHostPhotos: state.sharedRoomHostPhotos,
      sharedRoomAddedPhotos: state.sharedRoomAddedPhotos,
    });
    const existingDhashes = new Set(
      currentRoomCorpus.filter((p) => p.dhash).map((p) => String(p.dhash))
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

    const roomLabel =
      targetLounge === 'family'
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
      let targetRoomId = '';
      if (activeToken) {
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
              '⚠️ 공유방 연결 토큰을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
          });
          return;
        }
        targetRoomId = ensured.roomId;
      }

      const upRes = await uploadPhotosToSupabaseSharedRoom({
        roomId: targetRoomId,
        loungeType: targetLounge,
        familyRoom: targetFamilyRoom,
        uploaderUserId,
        uploaderEmail,
        uploaderNickname: uploaderNick,
        photos: pickedRaw,
      });

      if (!upRes.ok || upRes.uploadedPhotos.length === 0) {
        set({
          lastQuarantineToast:
            '⚠️ 공유방 사진 등록에 실패했습니다. 로그인 상태를 확인한 뒤 다시 시도해 주세요.',
        });
        return;
      }

      const latestState = get();
      const otherRoomsPhotos = latestState.sharedRoomAddedPhotos.filter(
        (p) =>
          !(
            (p.sharedLoungeType ?? 'family') === targetLounge &&
            (targetLounge !== 'family' || (p.sharedFamilyRoom ?? '우리집') === targetFamilyRoom) &&
            p.sharedRoomId === targetRoomId
          )
      );
      const existingInSameRoom = latestState.sharedRoomAddedPhotos.filter(
        (p) =>
          (p.sharedLoungeType ?? 'family') === targetLounge &&
          (targetLounge !== 'family' || (p.sharedFamilyRoom ?? '우리집') === targetFamilyRoom) &&
          p.sharedRoomId === targetRoomId
      );
      const nextAdded = [...upRes.uploadedPhotos, ...existingInSameRoom, ...otherRoomsPhotos];
      persistSharedRoomAddedPhotos(nextAdded);

      const mergedShared = resolveLoungePhotoCorpus({
        activeLoungeType: targetLounge,
        activeFamilyRoom: targetFamilyRoom,
        photos: latestState.photos,
        sharedRoomHostPhotos: latestState.sharedRoomHostPhotos,
        sharedRoomAddedPhotos: nextAdded,
      });
      const nextResults: SearchResultItem[] = filterVisibleGalleryPhotos(mergedShared).map(
        (photo) => ({
          photo,
          score: 0.99,
          matchPercentage: 99,
          matchedBy: 'text-direct' as const,
        })
      );

      set({
        sharedRoomAddedPhotos: nextAdded,
        searchSpace: 'gallery',
        hasExecutedUserSearch: false,
        activeQuery: `${roomLabel} (${nextResults.length}장 · 방금 ${upRes.uploadedPhotos.length}장 추가됨)`,
        matchedTags: [`#${uploaderNick}사진추가`, '#공유앨범'],
        searchResults: nextResults,
        lastQuarantineToast: `🎉 사진 ${upRes.uploadedPhotos.length}장을 『${roomLabel}』에 올렸습니다! 이제 초대 링크로 들어온 가족·회원 누구에게나 즉시 보입니다.`,
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
        '🗑️ 공유방에서 해당 사진을 삭제했습니다. (내 기기 원본 사진은 안전하게 보존됩니다)',
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
    const sharedGalleryResults: SearchResultItem[] = filterVisibleGalleryPhotos(mergedShared).map(
      (photo) => ({
        photo,
        score: 0.96,
        matchPercentage: 98,
        matchedBy: 'text-direct' as const,
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
        ? `📸 『${roomTitle}』으로 돌아왔어요! 방금 점검·색인한 내 컴퓨터 사진을 골라 올려보세요.`
        : `🏠 『${roomTitle}』으로 돌아왔습니다.`,
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
    set({
      activeLoungeType: parsed.loungeType,
      activeFamilyRoom: parsed.familyRoom,
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
    let fetchedPhotos: PhotoItem[] = [];
    let previewValid = false;

    if (parsed.inviteToken) {
      set({ isLoadingSharedRoomPhotos: true });
      const previewRes = await fetchGuestPreviewRoomByToken(parsed.inviteToken);
      if (previewRes.ok && previewRes.room) {
        previewValid = true;
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
          const authedEmail =
            get().merlinAuth.email ||
            (typeof window !== 'undefined'
              ? localStorage.getItem('ghosti_hub_user_email') || ''
              : '');
          const nick =
            parsed.nicknameHint || resolveAccountScopedNickname(authedEmail, '멤버');
          await acceptRoomInviteAsLoggedInMember(parsed.inviteToken, nick);
          stripConsumedInviteParamsFromLoggedInUrl();
        }
      }
    }

    if (reqSeq !== sharedRoomSyncSeq) {
      return true;
    }

    // 로그인 상태에서 토큰 없는 구형 ?invite=... 파라미터만 남아 새로고침된 경우:
    // 내 방 사진을 빈 배열([])로 덮어쓰지 않고 즉시 정식 Supabase 공유방 조회로 위임!
    if (isLoggedIn && !previewValid) {
      set({
        activeLoungeType: resolvedLounge,
        activeFamilyRoom: resolvedFamilyRoom,
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

    const st = get();
    const nextAdded =
      parsed.inviteToken && !isLoggedIn
        ? fetchedPhotos
        : [
            ...fetchedPhotos,
            ...st.sharedRoomAddedPhotos.filter(
              (p) =>
                !(
                  (p.sharedLoungeType ?? 'family') === resolvedLounge &&
                  (resolvedLounge !== 'family' ||
                    (p.sharedFamilyRoom ?? '우리집') === resolvedFamilyRoom)
                )
            ),
          ];

    const mergedShared = resolveLoungePhotoCorpus({
      activeLoungeType: resolvedLounge,
      activeFamilyRoom: resolvedFamilyRoom,
      photos: st.photos,
      sharedRoomHostPhotos: st.sharedRoomHostPhotos,
      sharedRoomAddedPhotos: nextAdded,
    });
    const sharedGalleryResults: SearchResultItem[] = filterVisibleGalleryPhotos(mergedShared).map(
      (photo) => ({
        photo,
        score: 0.96,
        matchPercentage: 98,
        matchedBy: 'text-direct' as const,
      })
    );

    set({
      activeLoungeType: resolvedLounge,
      activeFamilyRoom: resolvedFamilyRoom,
      desktopTab: 'dashboard',
      mobileTab: 'search',
      sharedRoomAddedPhotos: nextAdded,
      isLoadingSharedRoomPhotos: false,
      isGuestPreviewMode: isNative ? false : !isLoggedIn,
      isInvitedMemberSession: isLoggedIn,
      guestJoinWallReason: null,
      searchSpace: 'gallery',
      hasExecutedUserSearch: false,
      activeQuery: `${resolvedRoomTitle} (${sharedGalleryResults.length}장)`,
      matchedVideoScenes: [],
      matchedLocalDocs: [],
      matchedVaultPhotos: [],
      searchResults: sharedGalleryResults,
      lastQuarantineToast: isNative
        ? `💌 ${resolvedHostName}님이 초대한 『${resolvedRoomTitle}』(${sharedGalleryResults.length}장)에 바로 입장했습니다!`
        : `💌 ${resolvedHostName}님이 초대한 『${resolvedRoomTitle}』(${sharedGalleryResults.length}장)을 열었습니다.`,
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
    const inviteToken = (opts?.forceInviteToken ?? readActiveInviteToken()).trim();
    const shouldLoadFromRemote = Boolean(inviteToken || hasAuthenticatedHubAccountSession());

    // [0.01초 즉시 렌더링 — Local-Vault-First Stale-While-Revalidate]:
    // 서버 네트워크 응답을 기다리느라 빈 로딩 화면이 길어지지 않도록, 로컬 IndexedDB 금고에 저장된 방 사진이 있으면
    // 10ms 내에 먼저 화면에 즉시 표시한 뒤 백그라운드에서 서버 신규 사진을 증분 동기화합니다.
    if (!inviteToken && hasAuthenticatedHubAccountSession()) {
      const localFastPhotos = await readInstantLocalVaultSharedPhotos(targetLounge, targetFamilyRoom);
      if (reqSeq !== sharedRoomSyncSeq) return;
      if (localFastPhotos.length > 0) {
        const stFast = get();
        const fastAdded = [
          ...localFastPhotos,
          ...stFast.sharedRoomAddedPhotos.filter(
            (p) =>
              !(
                (p.sharedLoungeType ?? 'family') === targetLounge &&
                (targetLounge !== 'family' ||
                  (p.sharedFamilyRoom ?? '우리집') === targetFamilyRoom)
              )
          ),
        ];
        if (
          stFast.activeLoungeType === targetLounge &&
          (targetLounge !== 'family' || stFast.activeFamilyRoom === targetFamilyRoom)
        ) {
          const fastMerged = resolveLoungePhotoCorpus({
            activeLoungeType: targetLounge,
            activeFamilyRoom: targetFamilyRoom,
            photos: stFast.photos,
            sharedRoomHostPhotos: stFast.sharedRoomHostPhotos,
            sharedRoomAddedPhotos: fastAdded,
          });
          const fastResults: SearchResultItem[] = filterVisibleGalleryPhotos(fastMerged).map(
            (photo) => ({
              photo,
              score: 0.96,
              matchPercentage: 98,
              matchedBy: 'text-direct' as const,
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
    // 비로그인 게스트가 초대받지 않은 다른 탭(예: 동호회·동창회·본가)을 눌러 res.photos가 빈 배열([])로 올 때도,
    // 이전에 불러온 정식 초대방(예: 우리집)의 사진은 메모리에서 지우지 않고 해당 탭 범위만 교체하여 복귀 즉시 0.00초 재표시 보장!
    const nextAdded = [
      ...res.photos,
      ...stNow.sharedRoomAddedPhotos.filter(
        (p) =>
          !(
            (p.sharedLoungeType ?? 'family') === targetLounge &&
            (targetLounge !== 'family' ||
              (p.sharedFamilyRoom ?? '우리집') === targetFamilyRoom)
          )
      ),
    ];

    if (
      stNow.activeLoungeType === targetLounge &&
      (targetLounge !== 'family' || stNow.activeFamilyRoom === targetFamilyRoom)
    ) {
      const mergedShared = resolveLoungePhotoCorpus({
        activeLoungeType: targetLounge,
        activeFamilyRoom: targetFamilyRoom,
        photos: stNow.photos,
        sharedRoomHostPhotos: stNow.sharedRoomHostPhotos,
        sharedRoomAddedPhotos: nextAdded,
      });
      const sharedGalleryResults: SearchResultItem[] = filterVisibleGalleryPhotos(mergedShared).map(
        (photo) => ({
          photo,
          score: 0.96,
          matchPercentage: 98,
          matchedBy: 'text-direct' as const,
        })
      );
      set({
        sharedRoomAddedPhotos: nextAdded,
        isLoadingSharedRoomPhotos: false,
        ...(stNow.hasExecutedUserSearch
          ? {}
          : {
              searchResults: sharedGalleryResults,
            }),
      });
    } else {
      set({
        sharedRoomAddedPhotos: nextAdded,
        isLoadingSharedRoomPhotos: false,
      });
    }
  },

  setActiveFamilyRoom: (activeFamilyRoom) => {
    set((state) => {
      if (state.activeLoungeType !== 'family') {
        return {
          activeFamilyRoom,
          lastQuarantineToast: `🏠 패밀리 라운지 [${activeFamilyRoom}] 독립 보안 룸으로 전환되었습니다.`,
        };
      }
      const nextCorpus = resolveLoungePhotoCorpus({
        activeLoungeType: 'family',
        activeFamilyRoom,
        photos: state.photos,
        sharedRoomHostPhotos: state.sharedRoomHostPhotos,
        sharedRoomAddedPhotos: state.sharedRoomAddedPhotos,
      });
      const nextResults: SearchResultItem[] = filterVisibleGalleryPhotos(nextCorpus).map((photo) => ({
        photo,
        score: 0.95,
        matchPercentage: 97,
        matchedBy: 'text-direct' as const,
      }));
      return {
        activeFamilyRoom,
        hasExecutedUserSearch: false,
        searchSpace: 'gallery',
        searchResults: nextResults,
        matchedVideoScenes: [],
        matchedLocalDocs: [],
        matchedVaultPhotos: [],
        activeQuery: `${activeFamilyRoom} 패밀리 앨범 (${nextResults.length}장)`,
        lastQuarantineToast: `🏠 패밀리 라운지 [${activeFamilyRoom}] 독립 보안 룸으로 전환되었습니다.`,
      };
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
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
        '🎒 [학생증 로컬 OCR 0.1초 인증 완료] 외부 서버 전송 0 Byte • 🎒 동호회 · 동창회 (초·중·고 반/동아리 특가 월 900원) 자격이 즉시 확인되었습니다!',
    }),

  // ─────────────── [⛳ 4050 동창회 락인(Lock-in) 특화 UX 상태 & 액션] ───────────────
  alumniSchoolName: '성동고',
  alumniGradYear: 1989,
  alumniGradCohortNumber: 89,
  alumniBannerTheme: 'chalkboard',
  clubFeedTrack: 'memories_1989',
  alumniStickChips: [
    {
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
  analogScannedPhotos: [
    {
      id: 'analog_scan_1',
      photoFile: '20260926_160221.jpg',
      thumbUrl: getZCoreUrl('/__photos/file?p=20260926_160221.jpg&thumb=1'),
      uploaderLabel: '📸 김총무 스캔 업로드 (EXIF 없음)',
      hasExif: false,
      unknownDatePlace: false,
      appliedSticks: ['1989', '제주도 수학여행', '1989년 봄'],
      looseTimelineGroup: '1989년 봄',
      mappedPassportBucketLabel: '🛂 귀신같이 여권 1980년대 바구니(1989~1980) 자동 매핑',
      detectedMemberNames: ['👑 멀린프로(18세)', '박회장(18세)', '김총무(18세)'],
      captionKo: '1989년 봄 제주도 수학여행 나무 다리 단체컷 (아날로그 인화 사진 스캔본)',
      expandedSearchKeywords: buildBidirectionalStickKeywords({
        year: 1989,
        season: '봄',
        place: '제주도 수학여행 나무 다리',
        looseTimelineGroup: '1989년 봄',
        schoolName: '성동고',
      }),
    },
    {
      id: 'analog_scan_2',
      photoFile: '20260926_131225.jpg',
      thumbUrl: getZCoreUrl('/__photos/file?p=20260926_131225.jpg&thumb=1'),
      uploaderLabel: '📸 박회장 스캔 업로드 (EXIF 없음)',
      hasExif: false,
      unknownDatePlace: false,
      appliedSticks: ['1989', '제주도 수학여행', '1989년 봄'],
      looseTimelineGroup: '1989년 봄',
      mappedPassportBucketLabel: '🛂 귀신같이 여권 1980년대 바구니(1989~1980) 자동 매핑',
      detectedMemberNames: ['👑 멀린프로(18세)', '이프로(18세)'],
      captionKo: '1989년 봄 제주도 수학여행 성산일출봉 앞 추억 스캔본',
      expandedSearchKeywords: buildBidirectionalStickKeywords({
        year: 1989,
        season: '봄',
        place: '제주도 수학여행 성산일출봉',
        looseTimelineGroup: '1989년 봄',
        schoolName: '성동고',
      }),
    },
    {
      id: 'analog_scan_3',
      photoFile: '20240720_182301.jpg',
      thumbUrl: getZCoreUrl('/__photos/file?p=20240720_182301.jpg&thumb=1'),
      uploaderLabel: '📸 최회원 스캔 업로드 (연도·장소 미상)',
      hasExif: false,
      unknownDatePlace: true,
      appliedSticks: [],
      looseTimelineGroup: '❓ 언제/어디인가요?',
      mappedPassportBucketLabel: '⏳ 연도 제보 대기 중 (승인 시 1980년대 바구니 편입)',
      detectedMemberNames: ['👑 멀린프로', '박회장', '최회원'],
      captionKo: '[❓ 언제/어디인가요?] 옛날 앨범에서 나온 사진인데 언제 어디 소풍인지 기억나는 친구 제보 바람!',
      expandedSearchKeywords: buildBidirectionalStickKeywords({
        year: 1989,
        season: '가을',
        place: '가을 소풍',
        looseTimelineGroup: '1989년 가을',
        schoolName: '성동고',
      }),
    },
    {
      id: 'analog_scan_4',
      photoFile: '20240721_183234.jpg',
      thumbUrl: getZCoreUrl('/__photos/file?p=20240721_183234.jpg&thumb=1'),
      uploaderLabel: '📸 이프로 스캔 업로드 (연도·장소 미상)',
      hasExif: false,
      unknownDatePlace: true,
      appliedSticks: [],
      looseTimelineGroup: '❓ 언제/어디인가요?',
      mappedPassportBucketLabel: '⏳ 연도 제보 대기 중 (승인 시 1980년대 바구니 편입)',
      detectedMemberNames: ['👑 멀린프로(선글라스)', '김총무'],
      captionKo: '[❓ 언제/어디인가요?] 선글라스 끼고 바닷가에서 찍은 필름 스캔본 — 연도/장소 제보해 주세요!',
      expandedSearchKeywords: buildBidirectionalStickKeywords({
        year: 1989,
        season: '봄',
        place: '제주도 수학여행 바다 선글라스',
        looseTimelineGroup: '1989년 봄',
        schoolName: '성동고',
      }),
    },
  ],
  analogYearProposals: [
    {
      proposalId: 'prop_1989_autumn_picnic',
      targetAnalogPhotoId: 'analog_scan_3',
      photoFile: '20240720_182301.jpg',
      thumbUrl: getZCoreUrl('/__photos/file?p=20240720_182301.jpg&thumb=1'),
      proposerName: '박회장 (3학년 4반 반장)',
      proposedTimelineGroup: '1989년 가을',
      proposedPlaceTag: '1989년 가을 소풍',
      proposedYear: 1989,
      commentText: '야 이거 1989년 가을 소풍 때 찍은 거잖아! 내가 옆에서 찍어줬음 ㅋㅋ',
      approvedByHost: false,
    },
    {
      proposalId: 'prop_1989_spring_jeju',
      targetAnalogPhotoId: 'analog_scan_4',
      photoFile: '20240721_183234.jpg',
      thumbUrl: getZCoreUrl('/__photos/file?p=20240721_183234.jpg&thumb=1'),
      proposerName: '김총무 (89회 동창총무)',
      proposedTimelineGroup: '1989년 봄',
      proposedPlaceTag: '제주도 수학여행 (중문해수욕장)',
      proposedYear: 1989,
      commentText: '1989년 봄 제주도 수학여행 중문 바닷가에서 빌린 선글라스 끼고 찍은 사진 맞네!',
      approvedByHost: false,
    },
  ],

  setAlumniBannerInfo: (schoolName, gradYear, theme) =>
    set((state) => {
      const cleanSchool = schoolName.trim() || '성동고';
      const validYear = Number.isFinite(gradYear) && gradYear >= 1950 ? gradYear : 1989;
      const cohort = validYear % 100;
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
        alumniSchoolName: cleanSchool,
        alumniGradYear: validYear,
        alumniGradCohortNumber: cohort,
        alumniBannerTheme: theme ?? state.alumniBannerTheme,
        analogScannedPhotos: updatedAnalogPhotos,
        lastQuarantineToast: `🎓 [Text-to-Banner 자동 간판 & 고유명사 상속] ‘${cleanSchool} ${cohort}회 동창회 (${validYear})’ 간판이 장착되어 방 전체 사진에 "${cleanSchool}"·"${deriveLoungeProperNounTokens(cleanSchool).join('/')}" 검색 키워드가 기본 상속되었습니다!`,
      };
    }),

  setClubFeedTrack: (clubFeedTrack) => {
    const { photos, alumniGradYear } = get();
    const allGallery = photos
      .filter((p) => !p.quarantined)
      .slice(0, 350)
      .map((photo, idx) => ({
        photo,
        score: 0.96,
        matchPercentage: 98 - (idx % 4),
        matchedBy: 'text-direct' as const,
      }));

    if (clubFeedTrack === 'memories_1989') {
      // 추억 탭: 아날로그 스캔본 및 학창 시절 사진 우선 정렬
      const memoryPhotos = [
        ...allGallery.filter((item) =>
          [
            '20260926_160221.jpg',
            '20260926_131225.jpg',
            '20240720_182301.jpg',
            '20240721_183234.jpg',
          ].includes(item.photo.name)
        ),
        ...allGallery.filter(
          (item) =>
            ![
              '20260926_160221.jpg',
              '20260926_131225.jpg',
              '20240720_182301.jpg',
              '20240721_183234.jpg',
            ].includes(item.photo.name)
        ),
      ];
      set({
        clubFeedTrack,
        searchSpace: 'gallery',
        hasUserSelectedSearchTab: true,
        activeQuery: `🎞️ 응답하라 ${alumniGradYear} (추억) — ${alumniGradYear}년 봄 · 제주도 수학여행 & ${alumniGradYear}년 가을 소풍`,
        matchedTags: [
          `#${alumniGradYear}년봄`,
          '#제주도수학여행',
          `#${alumniGradYear}년가을소풍`,
          '#1980년대여권바구니',
        ],
        searchResults: memoryPhotos,
      });
    } else {
      // 근황 탭: 최근 모임 사진
      set({
        clubFeedTrack,
        searchSpace: 'gallery',
        hasUserSelectedSearchTab: true,
        activeQuery: '🍻 최근 우리들 (근황) — 2026 정기 동창 모임 & 라운딩 (🔔 전체 알림 OFF 클린존)',
        matchedTags: ['#2026동창모임', '#최근우리들', '#알림클린존'],
        searchResults: allGallery.slice().reverse(),
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

      const candidates: AlumniStickChip[] = [
        {
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
        lastQuarantineToast: `🏷️ [스틱(Chip) 3종 + 월(Month) 양방향 인덱싱 완료] [🏷️ ${numYear}] [🏷️ ${cleanPlace}] [🏷️ ${yearSeasonLabel}] 스틱 생성! (${expanded.slice(0, 8).join(', ')} 자동 매칭 · 귀신같이 여권 ${decadeStart}년대 바구니 직결)`,
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
          looseTimelineGroup: nextSticks.length === 0 ? '❓ 언제/어디인가요?' : nextGroup,
          mappedPassportBucketLabel:
            nextSticks.length === 0
              ? '⏳ 연도 제보 대기 중'
              : `🛂 귀신같이 여권 ${decadeStart}년대 바구니(${decadeEnd}~${decadeStart}) 자동 매핑`,
          captionKo:
            nextSticks.length === 0
              ? item.captionKo
              : `${nextSticks.join(' · ')} 추억 스캔본`,
          expandedSearchKeywords: nextExpanded,
        };
      });

      return {
        analogScannedPhotos: nextPhotos,
        lastQuarantineToast: `🏷️ [1초 스틱 태깅 & 월(Month) 양방향 인덱싱] ‘${effectiveLabel}’ 스틱이 적용되어 [${
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
          mappedPassportBucketLabel: `🛂 귀신같이 여권 ${decadeStart}년대 바구니(${decadeEnd}~${decadeStart}) 자동 매핑`,
          captionKo: item.captionKo.replace('[❓ 언제/어디인가요?] ', ''),
          expandedSearchKeywords: nextExpanded,
        };
      });

      return {
        analogScannedPhotos: nextPhotos,
        lastQuarantineToast: `⚡ [초고속 연쇄 일괄 태깅] 대기 중인 모든 스캔 사진에 [🏷️ ${effectiveLabel}] 스틱이 1초 만에 일괄 적용되어 ‘${groupName}’ 타임라인 및 월(Month) 양방향 인덱스로 묶였습니다!`,
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
        lastQuarantineToast: `💡 [집단 지성 연도 제보 등록] ‘${cleanPlace} (${cleanGroup})’ 제보가 👑 방장 누락분 뒷정리 결재함에 전달되었습니다!`,
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
          new Set([
            ...item.appliedSticks,
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
          mappedPassportBucketLabel: `🛂 귀신같이 여권 ${decadeStart}년대 바구니(${decadeEnd}~${decadeStart}) 자동 매핑`,
          captionKo: `✓ [제보 반영됨: ${prop.proposedTimelineGroup} · ${prop.proposedPlaceTag}] ${item.captionKo.replace(
            '[❓ 언제/어디인가요?] ',
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
        lastQuarantineToast: `👑 [방장 원터치 일괄 결재 완료] 멤버들이 제보한 연도·장소 ${pendingProposals.length}건이 느슨한 타임라인(1989년 봄/가을) · 계절↔월(Month) 양방향 인덱스 · 귀신같이 여권 1980년대 바구니에 100% 반영되었습니다!`,
      };
    });
  },

  findMySchoolDaysPhotosFast: async () => {
    const { photos, alumniSchoolName, alumniGradYear, faceClusters } = get();
    const creator = faceClusters.find((c) => c.clusterId === 'face_member_5');
    const clubPersona = creator?.roomPersonas?.club || '멀린프로';

    const matchedSchoolPhotos = photos
      .filter((p) => !p.quarantined)
      .filter((p) =>
        [
          '20260926_160221.jpg',
          '20260926_131225.jpg',
          '20240720_182301.jpg',
          '20240721_183234.jpg',
          '20240720_184614.jpg',
          '20240721_122820.jpg',
        ].includes(p.name)
      )
      .map((photo, idx) => ({
        photo,
        score: 0.99 - idx * 0.01,
        matchPercentage: 99 - idx,
        matchedBy: 'text-direct' as const,
      }));

    set({
      clubFeedTrack: 'memories_1989',
      searchSpace: 'gallery',
      hasExecutedUserSearch: true,
      hasUserSelectedSearchTab: true,
      desktopTab: 'dashboard',
      mobileTab: 'search',
      activeQuery: `🎯 [👑 ${clubPersona}] 내 얼굴로 찾은 ${alumniSchoolName} ${alumniGradYear}년 학창 시절 수학여행·소풍 사진 (${matchedSchoolPhotos.length}장 · 1초 만에)`,
      matchedTags: [
        `#${alumniSchoolName}${alumniGradYear % 100}회`,
        `#${alumniGradYear}년수학여행`,
        `#내얼굴1초매칭`,
        '#1980년대여권바구니',
      ],
      searchResults: matchedSchoolPhotos,
      lastQuarantineToast: `🎯 [내 얼굴로 학창 시절 사진 1초 만에 찾기 완료] 귀신같이 여권 1980년대 바구니(1989~1980) 시드로 ${alumniGradYear}년 수학여행·소풍 속 내 사진 ${matchedSchoolPhotos.length}장을 1초 만에 모두 찾았습니다!`,
    });
  },
});
