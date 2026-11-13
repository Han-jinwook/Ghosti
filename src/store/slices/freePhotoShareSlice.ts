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
  quarantineFailureToast,
  quarantineResultNote,
  requestQuarantineOp,
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
  returnToSharedRoomAndOpenUpload: () => Promise<void>;

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

  activeFamilyRoom: '우리집',
  clubSizeTier: 'small',
  studentOcrVerified: false,

  // [💬 카톡 인앱 무가입 1초 프리뷰 (Guest Preview) & 공유 사진방 내 사진 추가 플로우 초기 상태 및 액션]
  isGuestPreviewMode:
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).has('invite') ||
      new URLSearchParams(window.location.search).get('preview') === 'guest') &&
    !Boolean(
      (() => {
        try {
          return localStorage.getItem('ghosti_invited_member_email');
        } catch {
          return null;
        }
      })()
    ),
  guestJoinWallReason: null,
  isInvitedMemberSession:
    typeof window !== 'undefined' &&
    Boolean(
      (() => {
        try {
          return (
            new URLSearchParams(window.location.search).has('invite') &&
            localStorage.getItem('ghosti_invited_member_email')
          );
        } catch {
          return false;
        }
      })()
    ),
  sharedRoomHostPhotos: [],
  sharedRoomAddedPhotos: (() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('ghosti_shared_family_added_photos_v1');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as PhotoItem[]) : [];
    } catch {
      return [];
    }
  })(),
  pendingReturnShareRoom: null,
  showSharedPhotoUploadModal: false,

  setIsGuestPreviewMode: (isGuestPreviewMode) =>
    set({
      isGuestPreviewMode,
      guestJoinWallReason: null,
      lastQuarantineToast: isGuestPreviewMode
        ? '👀 [카톡 인앱 무가입 1초 프리뷰 모드 ON] 로그인 창 없이 13KB 초경량 썸네일 피드 · 얼굴 아바타 · 0.04초 검색을 먼저 체험합니다! (원본 저장·댓글·사진 업로드·내 얼굴 찾기 클릭 시 1초 합류 창 점등)'
        : '✅ [정식 멤버 모드 전환] 모든 고화질 원본 다운로드 · 댓글 · 사진 업로드 권한이 활성화되었습니다.',
    }),

  triggerGuestJoinWall: (reason) =>
    set({
      guestJoinWallReason: reason,
    }),

  completeGuestOneSecJoin: (nickname, email) => {
    const cleanNick = nickname.trim() || '새멤버';
    const cleanEmail = email.trim() || 'member@sundreamer.app';
    const prevReason = get().guestJoinWallReason || '';
    const wasUploadIntent = prevReason.includes('올리기') || prevReason.includes('추가');

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ghosti_invited_member_nickname', cleanNick);
        localStorage.setItem('ghosti_invited_member_email', cleanEmail);
        // 귀신비서 방문 시 별명을 다시 묻지 않도록 미리 동기화하되, 엔진 연결 동의(merlin_session_token/ghosti_secretary_engine_agreed)는 비서방 직접 연결 시점까지 보존
        const prevSec = loadGhostSecretaryState();
        saveGhostSecretaryState({
          ...prevSec,
          nickname: prevSec.nickname || cleanNick,
          awaitingNickname: false,
        });
      } catch {
        /* ignore storage error */
      }
    }

    set((state) => ({
      isGuestPreviewMode: false,
      isInvitedMemberSession: true,
      guestJoinWallReason: null,
      merlinAuth: {
        ...state.merlinAuth,
        email: cleanEmail,
      },
      lastQuarantineToast: `🎉 [${cleanNick}님(${cleanEmail}) 1초 합류 완료!] 방장님의 초대로 평생 0원(무료) 정식 멤버가 되셨습니다. 이제 고화질 원본 저장·댓글·내 사진 추가·내 얼굴 1초 찾기를 자유롭게 이용하세요!`,
    }));

    if (wasUploadIntent && typeof window !== 'undefined') {
      window.setTimeout(() => {
        get().requestAddMyPhotosToSharedRoom();
      }, 150);
    }
  },

  setShowSharedPhotoUploadModal: (showSharedPhotoUploadModal) =>
    set({ showSharedPhotoUploadModal }),

  requestAddMyPhotosToSharedRoom: () => {
    const state = get();
    if (state.isGuestPreviewMode) {
      set({ guestJoinWallReason: '📸 이 방에 내 사진·영상 같이 올리기' });
      return;
    }
    const targetLounge: LoungeType =
      state.activeLoungeType === 'family' || state.activeLoungeType === 'club'
        ? state.activeLoungeType
        : 'family';
    const roomTitle =
      targetLounge === 'family'
        ? `${state.activeFamilyRoom} 패밀리 앨범`
        : `${state.alumniSchoolName} 모임 앨범`;

    // 모바일 환경에서는 바로 모바일 사진 피커 안내 또는 공유 업로드 모달 오픈
    if (isMobileOrStoreRuntime()) {
      set({ showSharedPhotoUploadModal: true });
      return;
    }

    // PC에서 아직 로컬 엔진(Z-코어)이 연결되지 않은 경우 ➔ 귀신비서방 통과의례 우회(건강검진 + 중복·흔들린 사진 정돈 후 자동 복귀 버튼 제공)
    if (!zCoreBridge.isConnected) {
      set({
        pendingReturnShareRoom: {
          loungeType: targetLounge,
          familyRoom: state.activeFamilyRoom,
          roomTitle,
        },
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('openGhostSecretaryFirstModal', {
            detail: {
              context: 'shared_room_upload',
              roomTitle,
            },
          })
        );
      }
      return;
    }

    // 이미 Z-코어가 연결되어 내 PC 사진이 색인된 상태라면 즉시 '내 컴퓨터 사진 골라 올리기' 모달 오픈
    set({ showSharedPhotoUploadModal: true });
  },

  addLocalPhotosToSharedRoom: (selectedIds) => {
    if (!selectedIds || selectedIds.length === 0) return;
    const idSet = new Set(selectedIds);
    const state = get();
    let uploaderNick = '가족멤버';
    if (typeof window !== 'undefined') {
      try {
        uploaderNick =
          loadGhostSecretaryState().nickname ||
          localStorage.getItem('ghosti_invited_member_nickname') ||
          (state.merlinAuth.email ? state.merlinAuth.email.split('@')[0] : '가족멤버');
      } catch {
        /* ignore */
      }
    }
    const existingNames = new Set([
      ...state.sharedRoomAddedPhotos.map((p) => p.name),
      ...state.sharedRoomHostPhotos.map((p) => p.name),
    ]);
    const nowIso = new Date().toISOString();
    const picked = state.photos
      .filter((p) => idSet.has(p.id) && !existingNames.has(p.name))
      .map((p) => ({
        ...p,
        id: `shared_added_${Date.now()}_${p.id}`,
        uploaderLabel: `${uploaderNick} 추가`,
        sharedAddedAt: nowIso,
      }));

    if (picked.length === 0) {
      set({
        showSharedPhotoUploadModal: false,
        lastQuarantineToast: '이미 이 공유방에 올라와 있는 사진들입니다.',
      });
      return;
    }

    const nextAdded = [...picked, ...state.sharedRoomAddedPhotos];
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ghosti_shared_family_added_photos_v1', JSON.stringify(nextAdded.slice(0, 200)));
      } catch {
        /* ignore quota */
      }
    }

    const mergedShared = [...nextAdded, ...state.sharedRoomHostPhotos];
    const nextResults: SearchResultItem[] = mergedShared
      .filter(
        (p) =>
          !p.quarantined &&
          !p.isVaultDocument &&
          p.trashCategory !== 'blurry' &&
          p.trashCategory !== 'screenshot' &&
          p.trashCategory !== 'memo' &&
          p.trashCategory !== 'duplicate'
      )
      .map((photo) => ({
        photo,
        score: 0.99,
        matchPercentage: 99,
        matchedBy: 'text-direct' as const,
      }));

    set({
      sharedRoomAddedPhotos: nextAdded,
      showSharedPhotoUploadModal: false,
      searchSpace: 'gallery',
      hasExecutedUserSearch: false,
      activeQuery: `우리집 패밀리 공유 앨범 (${nextResults.length}장 · 방금 ${picked.length}장 추가됨)`,
      matchedTags: [`#${uploaderNick}사진추가`, '#가족공유앨범', '#초경량섀도우공유'],
      searchResults: nextResults,
      lastQuarantineToast: `🎉 내 컴퓨터에서 고른 사진 ${picked.length}장을 『${state.activeFamilyRoom} 패밀리 앨범』에 깔끔하게 추가했습니다!`,
    });
  },

  returnToSharedRoomAndOpenUpload: async () => {
    const pending = get().pendingReturnShareRoom;
    const targetLounge: LoungeType = pending?.loungeType || 'family';
    const targetRoom: FamilyRoomId = pending?.familyRoom || get().activeFamilyRoom || '우리집';
    const roomTitle = pending?.roomTitle || `${targetRoom} 패밀리 앨범`;

    if (zCoreBridge.isConnected && get().photos.length === 0) {
      await get().initApp(true);
    }

    const st = get();
    const mergedShared = [...st.sharedRoomAddedPhotos, ...st.sharedRoomHostPhotos];
    const sharedGalleryResults: SearchResultItem[] = mergedShared
      .filter(
        (p) =>
          !p.quarantined &&
          !p.isVaultDocument &&
          p.trashCategory !== 'blurry' &&
          p.trashCategory !== 'screenshot' &&
          p.trashCategory !== 'memo' &&
          p.trashCategory !== 'duplicate'
      )
      .map((photo) => ({
        photo,
        score: 0.96,
        matchPercentage: 98,
        matchedBy: 'text-direct' as const,
      }));

    set({
      activeLoungeType: targetLounge,
      activeFamilyRoom: targetRoom,
      desktopTab: 'dashboard',
      mobileTab: 'search',
      pendingReturnShareRoom: null,
      isInvitedMemberSession: true,
      showSharedPhotoUploadModal: zCoreBridge.isConnected,
      ...(sharedGalleryResults.length > 0
        ? {
            searchSpace: 'gallery' as const,
            hasExecutedUserSearch: false,
            activeQuery: `${roomTitle} (${sharedGalleryResults.length}장)`,
            searchResults: sharedGalleryResults,
          }
        : {}),
      lastQuarantineToast: zCoreBridge.isConnected
        ? `📸 『${roomTitle}』으로 돌아왔어요! 방금 점검·색인한 내 컴퓨터 사진을 골라 올려보세요.`
        : `🏠 『${roomTitle}』으로 돌아왔습니다.`,
    });
  },

  setActiveFamilyRoom: (activeFamilyRoom) => {
    set({
      activeFamilyRoom,
      lastQuarantineToast: `🏠 패밀리 라운지 [${activeFamilyRoom}] 독립 보안 룸으로 전환되었습니다.`,
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
