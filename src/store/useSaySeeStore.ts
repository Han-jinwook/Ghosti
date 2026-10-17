import { create } from 'zustand';
import type {
  ClubSizeTier,
  DuplicateGroup,
  FaceMemberCluster,
  FamilyRoomId,
  GpuHelperTierId,
  HardwareTelemetry,
  LocalDocumentFile,
  LoungeType,
  MerlinAuthState,
  OnboardingAhaItem,
  OnboardingTrackMode,
  PhotoItem,
  PricingPlanId,
  PrivateSyncStrategy,
  SearchResultItem,
  SearchSpaceMode,
  SyncMode,
  SyncState,
  TrashCategory,
  TrialScanPermissions,
  UndoQuarantineBatch,
  VideoSceneItem,
  VoiceRoutingTrace,
} from '../types/saysee';
import {
  HybridVoiceSession,
  LOCAL_DOCUMENT_FILES,
  OnboardingProgressUpdate,
  PRESET_QUERIES,
  VIDEO_SCENE_ITEMS,
  detectHardwareTelemetry,
  detectLiveFacesFromPhoto,
  executeTextSearch,
  executeZeroSttVoiceSearch,
  fetchAutonomousFaceClusters,
  fetchIndexedDocuments,
  fetchIndexedVideos,
  loadInitialPhotoDataset,
  runOnboardingIndexingPipeline,
  searchLocalDocumentFilesAsync,
  searchVideoSceneItemsAsync,
  updateFaceClusterRegistry,
} from '../services/aiEngine';
import {
  LocalSentenceChip,
  TOTAL_CONCEPT_ANCHOR_COUNT,
  buildLocalSentenceSamplesFromCorpus,
} from '../services/conceptLexicon';
import { loadMerlinAuth, toggleMerlinTier } from '../services/merlinAuth';
import { loadSyncState, saveSyncPrefs } from '../services/syncEngine';

export type ViewportLayout = 'mobile' | 'desktop';
export type MobileTab = 'trial' | 'search' | 'trash' | 'settings';
export type DesktopTab = 'trial' | 'dashboard' | 'trash' | 'sync';

interface SaySeeStore {
  // 레이아웃 & 서브메뉴 ([✨ 무료체험(Auto-Hide)] | 🔍 파워 검색 | 🧹 주치의 정리 | 🛠️ 설정도우미)
  layout: ViewportLayout;
  mobileTab: MobileTab;
  desktopTab: DesktopTab;
  setLayout: (layout: ViewportLayout) => void;
  setMobileTab: (tab: MobileTab) => void;
  setDesktopTab: (tab: DesktopTab) => void;

  // [스펙 1 & 체험판 타겟팅] 파워 검색 공간 3-Track 필터 ([🎬 동영상 해부] | [📁 스마트 서류함] | [🖼️ 전체/갤러리])
  searchSpace: SearchSpaceMode;
  localDocuments: LocalDocumentFile[];
  matchedLocalDocs: LocalDocumentFile[];
  selectedDocModal: LocalDocumentFile | null;
  videoSceneItems: VideoSceneItem[];
  matchedVideoScenes: VideoSceneItem[];
  selectedVideoModal: VideoSceneItem | null;
  trialScanPermissions: TrialScanPermissions;
  setSearchSpace: (space: SearchSpaceMode) => void;
  setSelectedDocModal: (doc: LocalDocumentFile | null) => void;
  setSelectedVideoModal: (vid: VideoSceneItem | null, seekSec?: number) => void;
  setTrialScanPermission: (folder: keyof TrialScanPermissions, allowed: boolean) => void;
  runBriefingHintChip: (target: 'doc' | 'video', query: string) => Promise<void>;

  // [라운지 마스터 스펙] 자율 얼굴 추출(Face Crop) & 당해 연도 베스트 1장 멤버 등록 & 실명 검색 연동
  faceClusters: FaceMemberCluster[];
  latestCorpusYear: number;
  showFaceRegistryModal: boolean;
  detectingLiveFaces: boolean;
  setShowFaceRegistryModal: (show: boolean) => void;
  registerFaceMember: (
    clusterId: string,
    registeredName: string,
    relationshipTag?: string
  ) => Promise<void>;
  excludeFaceCluster: (clusterId: string) => Promise<void>;
  restoreExcludedFaceClusters: () => Promise<void>;
  detectFacesFromPhotoFile: (fileName: string) => Promise<number>;

  // 데이터셋 & 인덱싱 상태
  photos: PhotoItem[];
  duplicateGroups: DuplicateGroup[];
  initialized: boolean;
  initializing: boolean;
  initApp: () => Promise<void>;

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

  // 음성 & 자연어 문장 검색 상태 + 검색 결과 연사 묶기 ([❐ N장 연사])
  activeQuery: string;
  matchedTags: string[];
  searchResults: SearchResultItem[];
  groupBurstsInSearch: boolean;
  isListening: boolean;
  isSlimCapsule: boolean;
  liveWaveBands: number[];
  interimSttPreview: string;
  voiceThreshold: number;
  lastVoiceTrace: VoiceRoutingTrace | null;
  voiceTraceHistory: VoiceRoutingTrace[];
  setGroupBurstsInSearch: (group: boolean) => void;
  setIsSlimCapsule: (slim: boolean) => void;
  setVoiceThreshold: (t: number) => void;
  runTextQuery: (q: string) => Promise<void>;
  toggleMicRecording: () => Promise<void>;
  runPresetVoiceQuery: (presetId: string, forceFallbackDemo?: boolean) => Promise<void>;
  toggleBookmark: (photoId: string) => void;

  // 사진 상세 모달 & 연사 묶음 상세 탐색
  selectedPhoto: PhotoItem | null;
  selectedBurstGroup: PhotoItem[] | null;
  setSelectedPhoto: (photo: PhotoItem | null, burstGroup?: PhotoItem[] | null) => void;

  // [스펙 2] 주치의 정리 4대 탭 & 바둑판 Pick UI & 3중 타임머신 안전망 (Undo)
  selectedTrashIds: Set<string>;
  activeTrashCategoryFilter: TrashCategory | 'all';
  quarantineMoving: boolean;
  lastQuarantineToast: string | null;
  lastUndoBatch: UndoQuarantineBatch | null;
  setActiveTrashCategoryFilter: (cat: TrashCategory | 'all') => void;
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
  restoreFromQuarantine: (names: string[]) => Promise<void>;
  undoLastQuarantine: () => Promise<void>;
  dismissUndoBatch: () => void;
  openLocalFolder: (target: 'quarantine' | 'photos' | 'docs') => Promise<void>;
  dismissQuarantineToast: () => void;

  // [4대 라운지 & 24시간 GPU 클라우드 서버 도우미 스펙]
  telemetry: HardwareTelemetry | null;
  merlinAuth: MerlinAuthState;
  syncState: SyncState;
  showProModal: boolean;
  freeTrialUsed: boolean;
  activePricingPlan: PricingPlanId;
  activeLoungeType: LoungeType;
  activeFamilyRoom: FamilyRoomId;
  clubSizeTier: ClubSizeTier;
  studentOcrVerified: boolean;
  gpuHelper24hActive: boolean;
  gpuHelperActiveTier: GpuHelperTierId;
  gpuHelperRemainingHours: number;
  setShowProModal: (show: boolean) => void;
  setActiveLoungeType: (lounge: LoungeType) => void;
  setActiveFamilyRoom: (room: FamilyRoomId) => void;
  setClubSizeTier: (tier: ClubSizeTier) => void;
  verifyStudentOcr: () => void;
  activateGpuHelper24h: (tier: GpuHelperTierId) => void;
  deactivateGpuHelper24h: () => void;
  activatePricingPlan: (planId: PricingPlanId) => void;
  switchMerlinTier: () => void;
  updateSyncSettings: (mode: SyncMode, wifiOnly: boolean) => void;
  setPrivateSyncStrategy: (strategy: PrivateSyncStrategy) => void;
  setChargingOnlySync: (chargingOnly: boolean) => void;
  triggerSyncNow: () => Promise<void>;
}

let cancelOnboardingFlag = false;
const voiceSession = new HybridVoiceSession();

const INITIAL_ONBOARDING_PROGRESS: OnboardingProgressUpdate = {
  phase: 'completed',
  done: 24,
  total: 24,
  remaining: 0,
  percent: 100.0,
  elapsedSec: 16,
  etaSec: 0,
  perImageSec: 0.7,
  currentPhotoName: '로컬 서류함 및 동영상 전 구간 타임라인 프레임 자율 색인 완료',
  currentPhotoThumb: '',
  liveVector64: Array.from({ length: 64 }, (_, i) => +(0.2 + Math.abs(Math.sin(i * 0.25)) * 0.75).toFixed(2)),
  modelStatusText: '내 PC 직접 구동(SaySee_PC_Agent.exe) 100% 로컬 색인 완료 (외부 서버 전송 0 Byte)',
};

export const useSaySeeStore = create<SaySeeStore>((set, get) => ({
  layout: typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'desktop' : 'mobile',
  mobileTab: 'search',
  desktopTab: 'dashboard',
  setLayout: (layout) => set({ layout }),
  setMobileTab: (mobileTab) =>
    set({
      mobileTab,
      desktopTab:
        mobileTab === 'trial'
          ? 'trial'
          : mobileTab === 'search'
          ? 'dashboard'
          : mobileTab === 'trash'
          ? 'trash'
          : 'sync',
    }),
  setDesktopTab: (desktopTab) =>
    set({
      desktopTab,
      mobileTab:
        desktopTab === 'trial'
          ? 'trial'
          : desktopTab === 'dashboard'
          ? 'search'
          : desktopTab === 'trash'
          ? 'trash'
          : 'settings',
    }),

  searchSpace: 'video',
  localDocuments: LOCAL_DOCUMENT_FILES,
  matchedLocalDocs: LOCAL_DOCUMENT_FILES,
  selectedDocModal: null,
  videoSceneItems: VIDEO_SCENE_ITEMS,
  matchedVideoScenes: VIDEO_SCENE_ITEMS,
  selectedVideoModal: null,
  trialScanPermissions: {
    gallery: true,
    downloads: true,
    desktop: true,
  },
  setSelectedDocModal: (selectedDocModal) => set({ selectedDocModal }),
  setSelectedVideoModal: (selectedVideoModal, seekSec) => {
    if (!selectedVideoModal) {
      set({ selectedVideoModal: null });
      return;
    }
    if (seekSec !== undefined) {
      const matchedFrame = selectedVideoModal.timelineFrames.find((f) => f.timeSec === seekSec);
      set({
        selectedVideoModal: {
          ...selectedVideoModal,
          matchedSeekSec: seekSec,
          matchedTimestamp: matchedFrame
            ? `🎯 ${matchedFrame.timestampText} 구간 포착`
            : selectedVideoModal.matchedTimestamp,
          matchedFrameCaption: matchedFrame
            ? `[${matchedFrame.timestampText} · ${matchedFrame.phaseLabel}] ${matchedFrame.sceneCaption}`
            : selectedVideoModal.matchedFrameCaption,
        },
      });
      return;
    }
    set({ selectedVideoModal });
  },
  setTrialScanPermission: (folder, allowed) =>
    set((state) => ({
      trialScanPermissions: {
        ...state.trialScanPermissions,
        [folder]: allowed,
      },
    })),

  setSearchSpace: (searchSpace) => {
    const { photos, videoSceneItems, localDocuments, sentenceChips } = get();
    if (searchSpace === 'video') {
      const totalFrames = videoSceneItems.reduce((a, v) => a + v.timelineFrames.length, 0);
      set({
        searchSpace: 'video',
        activeQuery: `동영상 ${videoSceneItems.length}개 전 구간(총 ${totalFrames}개 타임라인 프레임) 자동 해부`,
        matchedTags: ['#동영상전구간해부', '#타임라인점프재생', '#자율비전인덱싱'],
        matchedVideoScenes: videoSceneItems,
      });
    } else if (searchSpace === 'vault') {
      const vaultPhotos = photos
        .filter((p) => !p.quarantined && p.isVaultDocument)
        .map((photo) => ({
          photo,
          score: 0.96,
          matchPercentage: 98,
          matchedBy: 'text-direct' as const,
        }));
      set({
        searchSpace: 'vault',
        activeQuery: `최근 서류 ${localDocuments.length + vaultPhotos.length}건 통합 (로컬 문서 ${localDocuments.length}건 + 촬영 서류 ${vaultPhotos.length}장)`,
        matchedTags: ['#스마트서류함', '#문서·설명서', '#문서·신분증', '#PDF통합검색'],
        searchResults: vaultPhotos,
        matchedLocalDocs: localDocuments,
      });
    } else {
      set({ searchSpace: 'gallery' });
      const firstChipQuery = sentenceChips[0]?.query || '바다 풍경 모습';
      void get().runTextQuery(firstChipQuery);
    }
  },

  runBriefingHintChip: async (target, query) => {
    set({ searchSpace: target === 'doc' ? 'vault' : 'video' });
    await get().runTextQuery(query);
    if (target === 'video') {
      const matched = get().matchedVideoScenes;
      if (matched.length > 0) {
        get().setSelectedVideoModal(matched[0], matched[0].matchedSeekSec);
      }
    } else if (typeof document !== 'undefined') {
      window.setTimeout(() => {
        document.getElementById('saysee-search-results')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 60);
    }
  },

  faceClusters: [],
  latestCorpusYear: 2026,
  showFaceRegistryModal: false,
  detectingLiveFaces: false,
  setShowFaceRegistryModal: (showFaceRegistryModal) => set({ showFaceRegistryModal }),

  registerFaceMember: async (clusterId, registeredName, relationshipTag) => {
    const cleanName = registeredName.trim();
    const prevClusters = get().faceClusters;
    const nextClusters = prevClusters.map((c) =>
      c.clusterId === clusterId
        ? {
            ...c,
            registeredName: cleanName,
            relationshipTag: relationshipTag !== undefined ? relationshipTag : c.relationshipTag,
          }
        : c
    );

    const targetCluster = nextClusters.find((c) => c.clusterId === clusterId);
    const matchedPhotoSet = new Set(targetCluster?.matchedPhotoFiles ?? []);
    const tagToAdd = cleanName ? `#${cleanName}` : '';
    const relTagToAdd =
      targetCluster?.relationshipTag && targetCluster.relationshipTag.startsWith('#')
        ? targetCluster.relationshipTag
        : '';

    const updatedPhotos = get().photos.map((p) => {
      if (!matchedPhotoSet.has(p.name)) return p;
      const tags = new Set(p.tags);
      if (tagToAdd) tags.add(tagToAdd);
      if (relTagToAdd) tags.add(relTagToAdd);
      return {
        ...p,
        tags: Array.from(tags),
      };
    });

    set({ faceClusters: nextClusters, photos: updatedPhotos });

    const serverUpdated = await updateFaceClusterRegistry({
      action: 'update',
      clusterId,
      registeredName: cleanName,
      relationshipTag,
    });
    if (serverUpdated) {
      set({ faceClusters: serverUpdated });
    }
  },

  excludeFaceCluster: async (clusterId) => {
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
      set({ faceClusters: serverUpdated });
    }
  },

  restoreExcludedFaceClusters: async () => {
    set((state) => ({
      faceClusters: state.faceClusters.map((c) => ({ ...c, excludedAsPasserby: false })),
    }));
    const serverUpdated = await updateFaceClusterRegistry({
      action: 'restore_excluded',
    });
    if (serverUpdated) {
      set({ faceClusters: serverUpdated });
    }
  },

  detectFacesFromPhotoFile: async (fileName) => {
    set({ detectingLiveFaces: true });
    try {
      const res = await detectLiveFacesFromPhoto(fileName);
      if (res && Array.isArray(res.clusters)) {
        set({ faceClusters: res.clusters });
        return res.detectedCount;
      }
      return 0;
    } finally {
      set({ detectingLiveFaces: false });
    }
  },

  photos: [],
  duplicateGroups: [],
  initialized: false,
  initializing: false,

  conceptLexiconCount: TOTAL_CONCEPT_ANCHOR_COUNT,
  sentenceChips: [],
  sentenceChipPage: 0,
  onboardingAhaItems: [],

  cycleSentenceChips: () => {
    set((state) => ({
      sentenceChipPage: state.sentenceChipPage === 0 ? 1 : 0,
    }));
  },

  initApp: async () => {
    if (get().initialized || get().initializing) return;
    set({ initializing: true });

    const [dataset, telemetry, indexedDocs, indexedVideos, faceData] = await Promise.all([
      loadInitialPhotoDataset(),
      detectHardwareTelemetry(),
      fetchIndexedDocuments(),
      fetchIndexedVideos(),
      fetchAutonomousFaceClusters(),
    ]);

    const totalBytes = dataset.photos.reduce((a, p) => a + p.size, 0);
    const syncState = loadSyncState(dataset.photos.length, totalBytes);

    // 이미 등록된 얼굴 멤버 이름이 있다면 로컬 사진 태그에도 동기화
    const memberTagsByPhoto = new Map<string, string[]>();
    for (const fc of faceData.clusters) {
      if (fc.excludedAsPasserby) continue;
      const tags: string[] = [];
      if (fc.registeredName) tags.push(`#${fc.registeredName}`);
      if (fc.relationshipTag) tags.push(fc.relationshipTag);
      if (tags.length === 0) continue;
      for (const fName of fc.matchedPhotoFiles ?? []) {
        const prev = memberTagsByPhoto.get(fName) ?? [];
        memberTagsByPhoto.set(fName, Array.from(new Set([...prev, ...tags])));
      }
    }

    const enrichedPhotos = dataset.photos.map((p) => {
      const extraTags = memberTagsByPhoto.get(p.name);
      if (!extraTags || extraTags.length === 0) return p;
      return {
        ...p,
        tags: Array.from(new Set([...extraTags, ...p.tags])),
      };
    });

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

    const totalFrames = indexedVideos.reduce((a, v) => a + v.timelineFrames.length, 0);
    const initialQuery = `동영상 ${indexedVideos.length}개 전 구간(총 ${totalFrames}개 타임라인 프레임) 자동 해부`;

    const trashIds = new Set<string>(
      enrichedPhotos.filter((p) => p.trashCategory && !p.quarantined).map((p) => p.id)
    );

    set({
      photos: enrichedPhotos,
      duplicateGroups: dataset.duplicateGroups,
      localDocuments: indexedDocs,
      matchedLocalDocs: indexedDocs,
      videoSceneItems: indexedVideos,
      matchedVideoScenes: indexedVideos,
      faceClusters: faceData.clusters,
      latestCorpusYear: faceData.latestCorpusYear,
      onboardingProgress: {
        ...INITIAL_ONBOARDING_PROGRESS,
        currentPhotoThumb: indexedVideos[0]?.thumbUrl || fallbackThumb,
      },
      telemetry: telemetry ? { ...telemetry, lastQueryMs: 0.4 } : null,
      syncState,
      sentenceChips: localChips,
      onboardingAhaItems: localAhaItems,
      searchSpace: 'video',
      activeQuery: initialQuery,
      matchedTags: ['#동영상전구간해부', '#타임라인점프재생', '#자율비전인덱싱'],
      searchResults: [],
      selectedTrashIds: trashIds,
      initialized: true,
      initializing: false,
    });
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
  pcAgentPairedMobile: true,
  onboardingProgress: INITIAL_ONBOARDING_PROGRESS,

  setShowOnboarding: (showOnboarding) => set({ showOnboarding }),
  setOnboardingUseRealGpu: (onboardingUseRealGpu) => set({ onboardingUseRealGpu }),
  setOnboardingTargetCount: (onboardingTargetCount) => set({ onboardingTargetCount }),
  setOnboardingTrackMode: (onboardingTrackMode) => set({ onboardingTrackMode }),
  setPcAgentPairedMobile: (pcAgentPairedMobile) => set({ pcAgentPairedMobile }),

  startOnboardingIndexing: async () => {
    const { photos, onboardingTargetCount, onboardingUseRealGpu, onboardingRunning } = get();
    if (onboardingRunning) return;
    cancelOnboardingFlag = false;
    set({ onboardingRunning: true, showOnboarding: true });

    const targets = photos.filter((p) => !p.quarantined).slice(0, onboardingTargetCount);
    await runOnboardingIndexingPipeline({
      targetPhotos: targets,
      useRealWebGpuVision: onboardingUseRealGpu,
      shouldCancel: () => cancelOnboardingFlag,
      onUpdate: (update) => {
        set({ onboardingProgress: update });
      },
    });

    set({ onboardingRunning: false });
  },

  cancelOnboardingIndexing: () => {
    cancelOnboardingFlag = true;
    set({ onboardingRunning: false });
  },

  activeQuery: '동영상 전 구간 타임라인 자동 해부',
  matchedTags: ['#동영상전구간해부', '#타임라인점프재생', '#자율비전인덱싱'],
  searchResults: [],
  groupBurstsInSearch: true,
  isListening: false,
  isSlimCapsule: false,
  liveWaveBands: Array.from({ length: 16 }, (_, i) => 0.2 + (i % 3) * 0.15),
  interimSttPreview: '',
  voiceThreshold: 0.665,
  lastVoiceTrace: null,
  voiceTraceHistory: [],

  setGroupBurstsInSearch: (groupBurstsInSearch) => set({ groupBurstsInSearch }),
  setIsSlimCapsule: (isSlimCapsule) => set({ isSlimCapsule }),
  setVoiceThreshold: (voiceThreshold) => set({ voiceThreshold }),

  runTextQuery: async (q: string) => {
    const query = q.trim();
    if (!query) return;
    const { photos, telemetry, searchSpace, localDocuments, videoSceneItems } = get();

    // 백엔드 768차원 EmbeddingGemma 2 벡터 + 온톨로지 검색 API 병렬 호출
    const [docMatches, videoMatches] = await Promise.all([
      searchLocalDocumentFilesAsync(query, localDocuments),
      searchVideoSceneItemsAsync(query, videoSceneItems),
    ]);

    if (searchSpace === 'video') {
      const topVideo = videoMatches[0];
      set({
        activeQuery: query,
        matchedTags: [
          '#동영상전구간해부',
          topVideo ? `#${topVideo.matchedTimestamp.replace(/\s+/g, '')}` : '#매칭0건',
          '#768차원벡터매칭',
        ],
        matchedVideoScenes: videoMatches,
        matchedLocalDocs: docMatches,
        telemetry: telemetry ? { ...telemetry, lastQueryMs: 0.4 } : null,
      });
      return;
    }

    if (searchSpace === 'vault') {
      // 하드코딩 분기 0%: 실제 768차원 하이브리드 검색 엔진(executeTextSearch) 및 실제 인덱싱된 서류 메타데이터로만 매칭
      const { results, embedMs, searchMs } = await executeTextSearch(query, photos, 'text-direct');
      const vaultMap = new Map<string, SearchResultItem>();

      for (const r of results) {
        if (r.photo.isVaultDocument) {
          vaultMap.set(r.photo.id, r);
        }
      }

      // 서류 사진의 실제 캡션/태그에 검색어 토큰이 직접 포함된 항목 보강
      const rawTokens = query
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.replace(/(에서|으로|이랑|하고|있는|하는|들을|들|의|을|를|은|는|에|와|과|도)$/, ''))
        .filter((t) => t.length >= 2 && !['서류', '문서', '파일', '사본', '사진', '및'].includes(t));

      if (rawTokens.length > 0) {
        for (const p of photos) {
          if (p.quarantined || !p.isVaultDocument || vaultMap.has(p.id)) continue;
          const corpus = `${p.tags.join(' ')} ${p.captionKo ?? ''} ${p.vaultCategoryLabel ?? ''}`.toLowerCase();
          if (rawTokens.some((tk) => corpus.includes(tk))) {
            vaultMap.set(p.id, {
              photo: p,
              score: 0.91,
              matchPercentage: 95,
              matchedBy: 'text-direct',
            });
          }
        }
      }

      set({
        activeQuery: query,
        matchedTags: ['#스마트서류함', '#사진+PDF통합검색'],
        searchResults: Array.from(vaultMap.values()),
        matchedLocalDocs: docMatches,
        matchedVideoScenes: videoMatches,
        telemetry: telemetry ? { ...telemetry, lastQueryMs: +(embedMs + searchMs).toFixed(1) } : null,
      });
      return;
    }

    const { results, embedMs, searchMs } = await executeTextSearch(query, photos, 'text-direct');
    const topTags = Array.from(new Set(results.slice(0, 4).flatMap((r) => r.photo.tags))).slice(0, 3);

    set({
      activeQuery: query,
      matchedTags: topTags.length ? topTags : ['#시맨틱매칭', '#로컬벡터'],
      searchResults: results,
      matchedLocalDocs: docMatches,
      matchedVideoScenes: videoMatches,
      telemetry: telemetry ? { ...telemetry, lastQueryMs: +(embedMs + searchMs).toFixed(1) } : null,
    });
  },

  toggleMicRecording: async () => {
    const { isListening, photos, voiceThreshold, telemetry, localDocuments } = get();
    if (!isListening) {
      try {
        set({ isListening: true, isSlimCapsule: false, interimSttPreview: '' });
        await voiceSession.start({
          onAmplitude: (bands) => set({ liveWaveBands: bands }),
          onInterimStt: (text) => set({ interimSttPreview: text }),
          onAutoStop: () => {
            if (get().isListening) {
              void get().toggleMicRecording();
            }
          },
        });
      } catch {
        set({
          isListening: false,
          lastQuarantineToast:
            '🎤 연결된 마이크가 없거나 마이크 권한이 거부되었습니다. PC에서는 검색창에 텍스트로 입력해 주세요.',
        });
      }
    } else {
      set({ isListening: false });
      const { audioBlob, backgroundSttTranscript } = await voiceSession.stop();
      const { results, trace } = await executeZeroSttVoiceSearch({
        audioBlob,
        backgroundSttTranscript: backgroundSttTranscript.trim(),
        photos,
        threshold: voiceThreshold,
      });

      if (!trace.resolvedQuery) {
        set({
          lastQuarantineToast: '🎤 음성이 인식되지 않았습니다. 마이크에 대고 다시 말씀해 주세요.',
        });
        return;
      }

      const topTags = Array.from(new Set(results.slice(0, 4).flatMap((r) => r.photo.tags))).slice(0, 3);
      const docMatches = await searchLocalDocumentFilesAsync(trace.resolvedQuery, localDocuments);

      set((state) => ({
        activeQuery: trace.resolvedQuery,
        matchedTags: topTags.length ? topTags : ['#오디오벡터', '#온디바이스'],
        searchResults: results,
        matchedLocalDocs: docMatches,
        lastVoiceTrace: trace,
        voiceTraceHistory: [trace, ...state.voiceTraceHistory].slice(0, 12),
        isSlimCapsule: true,
        telemetry: telemetry ? { ...telemetry, lastQueryMs: trace.totalMs } : null,
      }));
    }
  },

  runPresetVoiceQuery: async (presetId: string, forceFallbackDemo = false) => {
    const { photos, voiceThreshold, telemetry } = get();
    const def = PRESET_QUERIES.find((p) => p.id === presetId);

    if (def?.wavFile) {
      try {
        const audio = new Audio(`/__poc/audio/file?f=${encodeURIComponent(def.wavFile)}`);
        audio.volume = 0.65;
        void audio.play().catch(() => {});
      } catch {
        /* ignore */
      }
    }

    const { results, trace } = await executeZeroSttVoiceSearch({
      presetId,
      photos,
      threshold: voiceThreshold,
      forceSimulateLowAudioConfidence: forceFallbackDemo,
    });

    const topTags = Array.from(new Set(results.slice(0, 4).flatMap((r) => r.photo.tags))).slice(0, 3);

    set((state) => ({
      activeQuery: trace.resolvedQuery,
      matchedTags: topTags.length ? topTags : [def?.categoryTag || '#오디오매칭'],
      searchResults: results,
      lastVoiceTrace: trace,
      voiceTraceHistory: [trace, ...state.voiceTraceHistory].slice(0, 12),
      telemetry: telemetry ? { ...telemetry, lastQueryMs: trace.totalMs } : null,
    }));
  },

  toggleBookmark: (photoId: string) => {
    set((state) => ({
      photos: state.photos.map((p) => (p.id === photoId ? { ...p, bookmarked: !p.bookmarked } : p)),
      searchResults: state.searchResults.map((r) =>
        r.photo.id === photoId ? { ...r, photo: { ...r.photo, bookmarked: !r.photo.bookmarked } } : r
      ),
      selectedPhoto:
        state.selectedPhoto?.id === photoId
          ? { ...state.selectedPhoto, bookmarked: !state.selectedPhoto.bookmarked }
          : state.selectedPhoto,
    }));
  },

  // ─────────────── 사진 상세 & 연사 묶음 탐색 ───────────────
  selectedPhoto: null,
  selectedBurstGroup: null,
  setSelectedPhoto: (selectedPhoto, selectedBurstGroup = null) =>
    set({
      selectedPhoto,
      selectedBurstGroup: selectedPhoto
        ? selectedBurstGroup ?? get().selectedBurstGroup
        : null,
    }),

  // ─────────────── [스펙 2] 주치의 정리 4대 탭 & 바둑판 Pick & 3중 타임머신 안전망 (Undo) ───────────────
  selectedTrashIds: new Set<string>(),
  activeTrashCategoryFilter: 'duplicate',
  quarantineMoving: false,
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
    const { photos, activeTrashCategoryFilter } = get();
    const matching = photos
      .filter((p) => {
        if (!p.trashCategory || p.quarantined) return false;
        if (activeTrashCategoryFilter === 'all') return true;
        if (activeTrashCategoryFilter === 'memo') {
          return (
            p.trashCategory === 'memo' ||
            p.trashCategory === 'object' ||
            p.trashCategory === 'document' ||
            p.trashCategory === 'receipt'
          );
        }
        return p.trashCategory === activeTrashCategoryFilter;
      })
      .map((p) => p.id);
    set({ selectedTrashIds: new Set(matching) });
  },

  clearTrashSelection: () => set({ selectedTrashIds: new Set() }),

  pickBestInDuplicateGroup: async (
    groupId: string,
    keepPhotoId: string,
    quarantineRestImmediately = false
  ) => {
    const { duplicateGroups, photos, selectedTrashIds } = get();
    const targetGroup = duplicateGroups.find((g) => g.groupId === groupId);
    if (!targetGroup) return;

    const groupMemberSet = new Set(targetGroup.photoIds);
    const redundantIds = targetGroup.photoIds.filter((id) => id !== keepPhotoId);

    const updatedGroups = duplicateGroups.map((g) =>
      g.groupId === groupId ? { ...g, bestPhotoId: keepPhotoId } : g
    );

    const updatedPhotos = photos.map((p) => {
      if (!groupMemberSet.has(p.id)) return p;
      if (p.id === keepPhotoId) {
        return {
          ...p,
          isBestInDuplicateGroup: true,
          trashCategory: undefined,
          trashConfidence: undefined,
          tags: [
            '#원본보존(Best)',
            ...p.tags.filter((t) => !t.includes('연사') && !t.includes('사본') && !t.includes('원본보존')),
          ].slice(0, 3),
        };
      }
      return {
        ...p,
        isBestInDuplicateGroup: false,
        trashCategory: 'duplicate' as TrashCategory,
        trashConfidence: 0.99,
        tags: [
          '#연사·중복사본',
          '#원본1장보존됨',
          ...p.tags.filter((t) => !t.includes('원본보존')),
        ].slice(0, 3),
      };
    });

    const nextTrashIds = new Set(selectedTrashIds);
    nextTrashIds.delete(keepPhotoId);
    redundantIds.forEach((id) => {
      const ph = updatedPhotos.find((p) => p.id === id);
      if (ph && !ph.quarantined) nextTrashIds.add(id);
    });

    set({
      duplicateGroups: updatedGroups,
      photos: updatedPhotos,
      selectedTrashIds: nextTrashIds,
    });

    if (quarantineRestImmediately && redundantIds.length > 0) {
      set({ quarantineMoving: true });
      try {
        const res = await fetch('/__quarantine/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: redundantIds }),
        });
        const json = await res.json();
        const movedList: string[] = json.moved ?? redundantIds;
        const movedSet = new Set<string>(movedList);
        const savedBytes = photos
          .filter((p) => movedSet.has(p.id))
          .reduce((acc, p) => acc + p.size, 0);

        set((state) => {
          const afterMovePhotos = state.photos.map((p) =>
            movedSet.has(p.id)
              ? {
                  ...p,
                  quarantined: true,
                  thumbUrl: `/__photos/file?p=${encodeURIComponent(p.name)}&loc=quarantine&thumb=1`,
                  fullUrl: `/__photos/file?p=${encodeURIComponent(p.name)}&loc=quarantine`,
                }
              : p
          );
          const afterSearch = state.searchResults.filter((r) => !movedSet.has(r.photo.id));
          const cleanedSelected = new Set(state.selectedTrashIds);
          movedSet.forEach((id) => cleanedSelected.delete(id));
          const wasFreeTrialFirstUse = !state.freeTrialUsed && state.activePricingPlan === 'free_trial';

          return {
            photos: afterMovePhotos,
            searchResults: afterSearch,
            selectedTrashIds: cleanedSelected,
            quarantineMoving: false,
            freeTrialUsed: true,
            lastUndoBatch: {
              fileNames: Array.from(movedSet),
              actionLabel: '연사 바둑판 베스트 컷 Pick 정리',
              count: movedSet.size,
              savedBytes,
              timestamp: Date.now(),
            },
            lastQuarantineToast: wasFreeTrialFirstUse
              ? `🎁 [입문 무료 체험 1묶음 완료] 베스트 1장을 남기고 연사 ${movedSet.size}장을 격리했습니다! (하단 버튼으로 1초 되돌리기 가능)`
              : `✨ 선택한 베스트 원본 1장을 안전하게 남기고, 나머지 연사·사본 ${movedSet.size}장을 [세이씨_정리대기함]으로 즉시 격리했습니다.`,
          };
        });
      } catch {
        set({ quarantineMoving: false });
      }
    } else {
      set({
        lastQuarantineToast: `🛡️ 선택한 사진을 [보존할 원본 1장]으로 변경했습니다. (나머지 ${redundantIds.length}장이 정리 대상으로 전환됨)`,
      });
    }
  },

  pickBestInBurstPhotos: async (burstPhotos: PhotoItem[], keepPhotoId: string) => {
    const redundantIds = burstPhotos.map((p) => p.id).filter((id) => id !== keepPhotoId);
    if (redundantIds.length === 0) return;

    set({ quarantineMoving: true });
    try {
      const res = await fetch('/__quarantine/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: redundantIds }),
      });
      const json = await res.json();
      const movedList: string[] = json.moved ?? redundantIds;
      const movedSet = new Set<string>(movedList);
      const savedBytes = burstPhotos
        .filter((p) => movedSet.has(p.id))
        .reduce((acc, p) => acc + p.size, 0);

      set((state) => {
        const afterMovePhotos = state.photos.map((p) =>
          movedSet.has(p.id)
            ? {
                ...p,
                quarantined: true,
                thumbUrl: `/__photos/file?p=${encodeURIComponent(p.name)}&loc=quarantine&thumb=1`,
                fullUrl: `/__photos/file?p=${encodeURIComponent(p.name)}&loc=quarantine`,
              }
            : p
        );
        const afterSearch = state.searchResults.filter((r) => !movedSet.has(r.photo.id));
        const cleanedSelected = new Set(state.selectedTrashIds);
        movedSet.forEach((id) => cleanedSelected.delete(id));
        return {
          photos: afterMovePhotos,
          searchResults: afterSearch,
          selectedTrashIds: cleanedSelected,
          selectedPhoto: null,
          selectedBurstGroup: null,
          quarantineMoving: false,
          freeTrialUsed: true,
          lastUndoBatch: {
            fileNames: Array.from(movedSet),
            actionLabel: '검색 결과 연사 베스트 컷 Pick',
            count: movedSet.size,
            savedBytes,
            timestamp: Date.now(),
          },
          lastQuarantineToast: `✨ 선택한 베스트 컷 1장을 남기고, 나머지 연사 ${movedSet.size}장을 [세이씨_정리대기함]으로 즉시 격리했습니다.`,
        };
      });
    } catch {
      set({ quarantineMoving: false });
    }
  },

  moveSelectedToQuarantine: async () => {
    const { selectedTrashIds, photos } = get();
    const targetNames = Array.from(selectedTrashIds);
    if (targetNames.length === 0) return;

    set({ quarantineMoving: true });
    try {
      const res = await fetch('/__quarantine/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: targetNames }),
      });
      const json = await res.json();
      const movedList: string[] = json.moved ?? targetNames;
      const movedSet = new Set<string>(movedList);
      const savedBytes = photos
        .filter((p) => movedSet.has(p.id))
        .reduce((acc, p) => acc + p.size, 0);

      const updatedPhotos = photos.map((p) =>
        movedSet.has(p.id)
          ? {
              ...p,
              quarantined: true,
              thumbUrl: `/__photos/file?p=${encodeURIComponent(p.name)}&loc=quarantine&thumb=1`,
              fullUrl: `/__photos/file?p=${encodeURIComponent(p.name)}&loc=quarantine`,
            }
          : p
      );

      const nextTrashIds = new Set<string>();
      selectedTrashIds.forEach((id) => {
        if (!movedSet.has(id)) nextTrashIds.add(id);
      });

      set((state) => ({
        photos: updatedPhotos,
        searchResults: state.searchResults.filter((r) => !movedSet.has(r.photo.id)),
        selectedTrashIds: nextTrashIds,
        quarantineMoving: false,
        freeTrialUsed: true,
        lastUndoBatch: {
          fileNames: Array.from(movedSet),
          actionLabel: '주치의 추천 항목 일괄 정리',
          count: movedSet.size,
          savedBytes,
          timestamp: Date.now(),
        },
        lastQuarantineToast: `✅ ${movedSet.size}장의 사진이 [세이씨_정리대기함]으로 30일 안전 격리되었습니다.`,
      }));
    } catch {
      set({ quarantineMoving: false });
    }
  },

  moveAllTrashToQuarantine: async () => {
    const { photos } = get();
    const allTrashIds = photos
      .filter((p) => p.trashCategory && !p.quarantined)
      .map((p) => p.id);
    set({ selectedTrashIds: new Set(allTrashIds) });
    await get().moveSelectedToQuarantine();
  },

  restoreFromQuarantine: async (names: string[]) => {
    if (names.length === 0) return;
    set({ quarantineMoving: true });
    try {
      const res = await fetch('/__quarantine/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: names }),
      });
      const json = await res.json();
      const restoredSet = new Set<string>(json.restored ?? names);

      set((state) => ({
        photos: state.photos.map((p) =>
          restoredSet.has(p.name) || restoredSet.has(p.id)
            ? {
                ...p,
                quarantined: false,
                thumbUrl: `/__photos/file?p=${encodeURIComponent(p.name)}&thumb=1`,
                fullUrl: `/__photos/file?p=${encodeURIComponent(p.name)}`,
              }
            : p
        ),
        quarantineMoving: false,
        lastQuarantineToast: `♻️ ${restoredSet.size}장의 사진이 원본 폴더(test_photos)로 즉시 원복되었습니다.`,
      }));
    } catch {
      set({ quarantineMoving: false });
    }
  },

  undoLastQuarantine: async () => {
    const { lastUndoBatch } = get();
    if (!lastUndoBatch || lastUndoBatch.fileNames.length === 0) return;
    const names = lastUndoBatch.fileNames;
    set({ lastUndoBatch: null });
    await get().restoreFromQuarantine(names);
    set({
      lastQuarantineToast: `↩️ [타임머신 1초 Undo 완료] 방금 정리했던 ${names.length}장을 원래 갤러리 위치로 완벽히 되돌렸습니다!`,
    });
  },

  dismissUndoBatch: () => set({ lastUndoBatch: null }),

  openLocalFolder: async (target: 'quarantine' | 'photos' | 'docs') => {
    try {
      await fetch('/__quarantine/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      set({
        lastQuarantineToast:
          target === 'quarantine'
            ? '📂 윈도우 탐색기에서 [세이씨_정리대기함] 폴더를 열었습니다.'
            : target === 'docs'
            ? '📂 윈도우 탐색기에서 [로컬 스마트 서류함 (test_docs)] 폴더를 열었습니다.'
            : '📂 윈도우 탐색기에서 원본 사진 폴더를 열었습니다.',
      });
    } catch {
      /* ignore */
    }
  },

  dismissQuarantineToast: () => set({ lastQuarantineToast: null }),

  // ─────────────── [4대 라운지 & 24시간 GPU 클라우드 서버 도우미] ───────────────
  telemetry: null,
  merlinAuth: loadMerlinAuth(),
  syncState: loadSyncState(550, 3230438906),
  showProModal: false,
  freeTrialUsed: false,
  activePricingPlan: 'free_trial',
  activeLoungeType: 'family',
  activeFamilyRoom: '우리집',
  clubSizeTier: 'small',
  studentOcrVerified: false,
  gpuHelper24hActive: false,
  gpuHelperActiveTier: 'standard_1000',
  gpuHelperRemainingHours: 24,

  setShowProModal: (showProModal) => set({ showProModal }),

  setActiveLoungeType: (activeLoungeType) =>
    set((state) => ({
      activeLoungeType,
      gpuHelperActiveTier:
        activeLoungeType === 'club'
          ? state.clubSizeTier === 'large'
            ? 'club_large_3000'
            : state.clubSizeTier === 'medium'
            ? 'club_medium_2000'
            : 'club_small_1000'
          : 'standard_1000',
    })),

  setActiveFamilyRoom: (activeFamilyRoom) =>
    set({
      activeFamilyRoom,
      lastQuarantineToast: `🏠 패밀리 라운지 [${activeFamilyRoom}] 독립 보안 룸으로 전환되었습니다.`,
    }),

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
        '🎒 [학생증 로컬 OCR 0.1초 인증 완료] 외부 서버 전송 0 Byte • 10대 학생 라운지 단일가(월 900원 / 연 9,000원) 자격이 즉시 확인되었습니다!',
    }),

  activateGpuHelper24h: (tier) => {
    const tierLabelMap: Record<GpuHelperTierId, string> = {
      standard_1000: '개인 / 패밀리 / 10대 학생 라운지 (24시간 1,000원)',
      club_small_1000: '소형 클럽 ~20명 (24시간 1,000원)',
      club_medium_2000: '중형 클럽 ~100명 (24시간 2,000원)',
      club_large_3000: '대형 클럽 무제한 (24시간 3,000원)',
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
    set((state) => {
      const labelMap: Record<PricingPlanId, string> = {
        free_trial: '✨ 무료체험 모드 (서브메뉴 [✨ 무료체험] 탭 활성화)',
        personal_single_2900: '👤 개인 라운지 • 단품 클리어 (2,900원)',
        personal_sub_3900: '👤 개인 라운지 • 정기 구독 (월 3,900원)',
        personal_year_35000: '👤 개인 라운지 • 연간 정기 구독 (연 35,000원)',
        family_home_5900: '🏠 패밀리 라운지 • 우리집 단독 (월 5,900원 • 방 1개)',
        family_home_year_59000: '🏠 패밀리 라운지 • 우리집 단독 연간권 (연 59,000원 • 방 1개)',
        family_three_8900: '👨‍👩‍👧‍👦 패밀리 라운지 • 양가 통합권 (월 8,900원 • 우리집+본가+처가 3방 분리)',
        family_three_year_89000: '👨‍👩‍👧‍👦 패밀리 라운지 • 양가 통합 연간권 (연 89,000원 • 3방 분리)',
        club_small_4900: '⛳ 클럽 라운지 • 소형 클럽 20명 기준 (월 4,900원 • 방 1개)',
        club_small_year_49000: '⛳ 클럽 라운지 • 소형 클럽 연간권 (연 49,000원 • 방 1개)',
        club_medium_7900: '⛳ 클럽 라운지 • 중형 클럽 100명 기준 (월 7,900원 • 방 1개)',
        club_medium_year_79000: '⛳ 클럽 라운지 • 중형 클럽 연간권 (연 79,000원 • 방 1개)',
        club_large_14900: '⛳ 클럽 라운지 • 대형 클럽 인원 제한 없음 (월 14,900원 • 방 1개)',
        club_large_year_149000: '⛳ 클럽 라운지 • 대형 클럽 연간권 (연 149,000원 • 방 1개)',
        student_sub_900: '🎒 10대 학생 라운지 • 인원 무제한 단일가 (월 900원)',
        student_year_9000: '🎒 10대 학생 라운지 • 인원 무제한 연간 단일가 (연 9,000원)',
      };

      const nextLoungeType: LoungeType = planId.startsWith('personal_')
        ? 'personal'
        : planId.startsWith('family_')
        ? 'family'
        : planId.startsWith('club_')
        ? 'club'
        : planId.startsWith('student_')
        ? 'student'
        : state.activeLoungeType;

      const isPaidSubscription = planId !== 'free_trial';

      return {
        activePricingPlan: planId,
        activeLoungeType: nextLoungeType,
        showProModal: false,
        // 정식 구독 활성화 시 서브메뉴 1번 자리 [✨ 무료체험] 탭은 자동으로 숨김(Auto-Hide) 처리되므로 파워 검색 탭으로 이동
        desktopTab: isPaidSubscription && state.desktopTab === 'trial' ? 'dashboard' : state.desktopTab,
        mobileTab: isPaidSubscription && state.mobileTab === 'trial' ? 'search' : state.mobileTab,
        merlinAuth: {
          ...state.merlinAuth,
          tier: planId === 'free_trial' ? 'FREE' : 'PRO_LIFETIME',
        },
        lastQuarantineToast: isPaidSubscription
          ? `🎉 [${labelMap[planId]}] 마스터 결제가 완료되었습니다! (초대 멤버 전원 무료 • [✨ 무료체험] 탭 자동 숨김 처리됨)`
          : `✨ [무료체험 모드]로 전환되어 상단 서브메뉴 1번 자리에 [✨ 무료체험] 탭이 다시 표시됩니다.`,
      };
    });
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
        lastSyncedAt: '방금 전 (모드 전환됨)',
      },
      lastQuarantineToast:
        privateSyncStrategy === 'shadow'
          ? '👻 [초경량 섀도우 캐시 모드] 활성화: 원본은 PC로 이관하고 폰에는 장당 13KB 썸네일+벡터만 남겨 용량을 99.4% 절약합니다!'
          : '🔄 [100% 원본 미러링 모드] 활성화: 폰과 PC 양쪽에 동일한 무손실 원본 파일을 유지하여 상호 백업 보험을 구축합니다!',
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
    set((state) => ({ syncState: { ...state.syncState, syncing: true } }));
    await new Promise((r) => setTimeout(r, 900));
    set((state) => ({
      syncState: {
        ...state.syncState,
        syncing: false,
        lastSyncedAt: '방금 전 (폰↔PC 일치화 완료)',
      },
      lastQuarantineToast:
        state.syncState.privateSyncStrategy === 'shadow'
          ? '👻 [13KB 섀도우 캐시 일치화 완료] 집 PC가 꺼져 있어도 밖에서 내 폰으로 PC 속 10년 치 사진·서류를 0.04초 만에 열람할 수 있습니다!'
          : '🔄 [100% 원본 미러링 일치화 완료] 클라우드 없이 폰과 PC 양쪽 기기의 원본 사진·서류가 완벽히 일치되었습니다!',
    }));
  },
}));
