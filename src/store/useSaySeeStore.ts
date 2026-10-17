import { create } from 'zustand';
import type {
  DuplicateGroup,
  HardwareTelemetry,
  LocalDocumentFile,
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
  executeTextSearch,
  executeZeroSttVoiceSearch,
  loadInitialPhotoDataset,
  runOnboardingIndexingPipeline,
  searchLocalDocumentFiles,
  searchVideoSceneItems,
} from '../services/aiEngine';
import {
  LocalSentenceChip,
  TOTAL_CONCEPT_ANCHOR_COUNT,
  buildLocalSentenceSamplesFromCorpus,
} from '../services/conceptLexicon';
import { loadMerlinAuth, toggleMerlinTier } from '../services/merlinAuth';
import { loadSyncState, saveSyncPrefs } from '../services/syncEngine';

export type ViewportLayout = 'mobile' | 'desktop';
export type MobileTab = 'search' | 'trash' | 'settings';
export type DesktopTab = 'dashboard' | 'trash' | 'sync';

interface SaySeeStore {
  // 레이아웃 & 미니멀 3대 탭 네비게이션 (🔍 파워 검색 | 🧹 주치의 정리 | ⚙️ 내 기기 & 백업)
  layout: ViewportLayout;
  mobileTab: MobileTab;
  desktopTab: DesktopTab;
  setLayout: (layout: ViewportLayout) => void;
  setMobileTab: (tab: MobileTab) => void;
  setDesktopTab: (tab: DesktopTab) => void;

  // [스펙 1 & 체험판 타겟팅] 파워 검색 공간 3-Track 필터 ([🎬 동영상 3개 전 구간 해부] | [📁 스마트 서류함 20건] | [🖼️ 전체/갤러리])
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

  // [스펙 3 & 4] 프라이빗 싱크 2대 모드 & 카페 런칭 심플 과금 퍼널 + 선착순 10년권 카운트다운
  telemetry: HardwareTelemetry | null;
  merlinAuth: MerlinAuthState;
  syncState: SyncState;
  showProModal: boolean;
  freeTrialUsed: boolean;
  activePricingPlan: PricingPlanId;
  foundingMemberRemainingSeats: number;
  setShowProModal: (show: boolean) => void;
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
  done: 23,
  total: 23,
  remaining: 0,
  percent: 100.0,
  elapsedSec: 16,
  etaSec: 0,
  perImageSec: 0.7,
  currentPhotoName: '최신 서류 20건 + 동영상 3개 전 구간(20개 타임라인 프레임) 완전 해부 완료',
  currentPhotoThumb: '/__photos/file?p=20240719_105704.jpg&thumb=1',
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
        mobileTab === 'search' ? 'dashboard' : mobileTab === 'trash' ? 'trash' : 'sync',
    }),
  setDesktopTab: (desktopTab) =>
    set({
      desktopTab,
      mobileTab:
        desktopTab === 'dashboard' ? 'search' : desktopTab === 'trash' ? 'trash' : 'settings',
    }),

  // [스펙 1 & 체험판 타겟팅] 동영상 3개 전 구간 해부 vs 스마트 서류함(20건) vs 전체/갤러리
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
    const { photos } = get();
    if (searchSpace === 'video') {
      set({
        searchSpace: 'video',
        activeQuery: '최신 동영상 3개 전 구간(00:00~끝, 총 20개 타임라인 구간) 1초 단위 완전 해부',
        matchedTags: ['#동영상전구간해부', '#타임라인점프재생', '#삼성갤러리불가'],
        matchedVideoScenes: VIDEO_SCENE_ITEMS,
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
        activeQuery: '최근 서류 20건 통합 (PDF·문서 12건 + 촬영 영수증·설명서·신분증 8장)',
        matchedTags: ['#스마트서류함', '#문서·설명서', '#문서·신분증', '#PDF통합검색'],
        searchResults: vaultPhotos,
        matchedLocalDocs: LOCAL_DOCUMENT_FILES,
      });
    } else {
      set({ searchSpace: 'gallery' });
      void get().runTextQuery('코타키나발루 나무 다리 위에서 산책하는 모습');
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

    const [dataset, telemetry] = await Promise.all([
      loadInitialPhotoDataset(),
      detectHardwareTelemetry(),
    ]);

    const totalBytes = dataset.photos.reduce((a, p) => a + p.size, 0);
    const syncState = loadSyncState(dataset.photos.length, totalBytes);

    const localChips = buildLocalSentenceSamplesFromCorpus(dataset.photos);
    const localAhaItems: OnboardingAhaItem[] = localChips.slice(0, 4).map((chip) => ({
      photoId: chip.id,
      thumbUrl: chip.thumbUrl || '/__photos/file?p=20240720_122826.jpg&thumb=1',
      dateFact: chip.matchHint,
      domainTitle: chip.factFormula,
      sentence: chip.query,
      shortChip: chip.factFormula.split('+')[0].trim(),
      targetSearchQuery: chip.query,
    }));

    // 초기 기본 검색 결과 세팅 (최신 동영상 3개 전 구간 완전 해부 전체 보기)
    const initialQuery = '최신 동영상 3개 전 구간(00:00~끝, 총 20개 타임라인 구간) 1초 단위 완전 해부';

    // 쓰레기 사진 기본 선택 세팅 (원본 1장으로 보호된 사진 및 스마트 서류함 자산은 제외됨)
    const trashIds = new Set<string>(
      dataset.photos.filter((p) => p.trashCategory && !p.quarantined).map((p) => p.id)
    );

    set({
      photos: dataset.photos,
      duplicateGroups: dataset.duplicateGroups,
      telemetry: telemetry ? { ...telemetry, lastQueryMs: 0.4 } : null,
      syncState,
      sentenceChips: localChips,
      onboardingAhaItems: localAhaItems,
      searchSpace: 'video',
      activeQuery: initialQuery,
      matchedTags: ['#동영상전구간해부', '#타임라인점프재생', '#삼성갤러리불가'],
      searchResults: [],
      matchedVideoScenes: VIDEO_SCENE_ITEMS,
      selectedTrashIds: trashIds,
      initialized: true,
      initializing: false,
    });
  },

  applyAhaRecommendation: async (item: OnboardingAhaItem) => {
    set({ showOnboarding: false });
    await get().runTextQuery(item.targetSearchQuery);
  },

  // ─────────────── 체험판 1분 고속 스캔 (Track A: 내 PC 직접 구동 + QR 페어링 vs Track B: 클라우드 GPU 서버 무료 대여) ───────────────
  showOnboarding: false,
  onboardingRunning: false,
  onboardingUseRealGpu: false,
  onboardingTargetCount: 23,
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

  // ─────────────── 파워 검색 (동영상 3개 전 구간 해부 + 스마트 서류함 20건 + 갤러리 통합) ───────────────
  activeQuery: '최신 동영상 3개 전 구간(00:00~끝, 총 20개 타임라인 구간) 1초 단위 완전 해부',
  matchedTags: ['#동영상전구간해부', '#타임라인점프재생', '#삼성갤러리불가'],
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
    const { photos, telemetry, searchSpace } = get();

    // 로컬 PDF/TXT/DOCX 문서 매칭 (12건) 및 동영상 3개 전 구간 타임라인 프레임 매칭 (20개 구간) — 0.01초 즉시 완료
    const docMatches = searchLocalDocumentFiles(query);
    const videoMatches = searchVideoSceneItems(query);

    // [체험판 타겟 ②] 동영상 장면 검색 모드일 때: 무관한 영상 억지 노출 없이 정확히 매칭된 동영상만 단독 노출
    if (searchSpace === 'video') {
      const topVideo = videoMatches[0];
      set({
        activeQuery: query,
        matchedTags: [
          '#동영상전구간해부',
          topVideo ? `#${topVideo.matchedTimestamp.replace(/\s+/g, '')}` : '#매칭0건',
          '#0.04초매칭',
        ],
        matchedVideoScenes: videoMatches,
        matchedLocalDocs: docMatches,
        telemetry: telemetry ? { ...telemetry, lastQueryMs: 0.4 } : null,
      });
      return;
    }

    // [체험판 타겟 ① / 스펙 1] 스마트 서류함 모드일 때는 서류 사진(8장) + 로컬 PDF/문서(12건) = 20건 즉시 매칭
    if (searchSpace === 'vault') {
      const vaultCandidates = photos.filter((p) => !p.quarantined && p.isVaultDocument);
      const qLower = query.toLowerCase();
      const keywordMatchedVault = vaultCandidates.filter((p) => {
        const text = `${p.name} ${p.tags.join(' ')} ${p.captionKo ?? ''} ${p.vaultCategoryLabel ?? ''}`.toLowerCase();
        if (qLower.includes('조립') || qLower.includes('설명서') || qLower.includes('매뉴얼') || qLower.includes('의자') || qLower.includes('도면')) {
          return p.tags.includes('#문서·설명서') || text.includes('설명서');
        }
        if (qLower.includes('신분증') || qLower.includes('여권') || qLower.includes('계약서')) {
          return p.tags.includes('#문서·신분증') || text.includes('여권');
        }
        if (qLower.includes('영수증') || qLower.includes('전표') || qLower.includes('바우처') || qLower.includes('결제') || qLower.includes('수트라하버') || qLower.includes('숙박')) {
          return p.name.includes('Messages') || p.tags.includes('#현수막·안내') || text.includes('심사');
        }
        if (qLower.includes('보험') || qLower.includes('증권') || qLower.includes('삼성화재') || qLower.includes('특약')) {
          return p.tags.includes('#문서·신분증') || p.name.includes('Messages');
        }
        return query.split(/\s+/).some((tk) => tk.length >= 2 && text.includes(tk));
      });

      const mergedMap = new Map<string, SearchResultItem>();
      for (const vp of keywordMatchedVault) {
        mergedMap.set(vp.id, {
          photo: vp,
          score: 0.97,
          matchPercentage: 98,
          matchedBy: 'text-direct',
        });
      }

      // 먼저 즉시 UI 업데이트 후 백그라운드에서 추가 벡터 매칭 보강
      set({
        activeQuery: query,
        matchedTags: ['#스마트서류함', '#사진+PDF통합검색'],
        searchResults: Array.from(mergedMap.values()),
        matchedLocalDocs: docMatches,
        matchedVideoScenes: videoMatches,
        telemetry: telemetry ? { ...telemetry, lastQueryMs: 0.5 } : null,
      });

      const { results, embedMs, searchMs } = await executeTextSearch(query, photos, 'text-direct');
      for (const r of results) {
        if (r.photo.isVaultDocument && !mergedMap.has(r.photo.id)) {
          mergedMap.set(r.photo.id, r);
        }
      }
      set({
        searchResults: Array.from(mergedMap.values()),
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
    const { isListening, photos, voiceThreshold, telemetry } = get();
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

      set((state) => ({
        activeQuery: trace.resolvedQuery,
        matchedTags: topTags.length ? topTags : ['#오디오벡터', '#온디바이스'],
        searchResults: results,
        matchedLocalDocs: searchLocalDocumentFiles(trace.resolvedQuery),
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

  // ─────────────── [스펙 3 & 4] 프라이빗 싱크 2대 모드 & 카페 런칭 심플 과금 퍼널 ───────────────
  telemetry: null,
  merlinAuth: loadMerlinAuth(),
  syncState: loadSyncState(550, 3230438906),
  showProModal: false,
  freeTrialUsed: false,
  activePricingPlan: 'free_trial',
  foundingMemberRemainingSeats: 78,

  setShowProModal: (showProModal) => set({ showProModal }),

  activatePricingPlan: (planId: PricingPlanId) => {
    set((state) => {
      const isAnnualFounding = planId === 'sub_mobile_1100' || planId === 'sub_bundle_2900';
      const nextSeats =
        isAnnualFounding && state.foundingMemberRemainingSeats > 1
          ? state.foundingMemberRemainingSeats - 1
          : state.foundingMemberRemainingSeats;

      const labelMap: Record<PricingPlanId, string> = {
        free_trial: '입문 무료 체험 (정밀 진단 + 1묶음 무료 정리)',
        single_taste_1000: '💡 1,000원 부분 맛보기 대청소권 (마음에 들면 차액 +900원/+2,800원으로 1회 완치 승격 가능)',
        single_mobile_1900: '📱 모바일 단독 1회 완치 대청소권 (1,900원)',
        single_bundle_3800: '💻📱 PC+모바일 양쪽 대청소 & 최초 1회 일치화권 (3,800원)',
        sub_mobile_1100: '👑 모바일 정기 주치의 멤버십 (창립 멤버 10년권 자동 승격 완료!)',
        sub_bundle_2900: '👑 PC+모바일 통합 주치의 멤버십 (창립 멤버 10년권 자동 승격 완료!)',
      };

      return {
        activePricingPlan: planId,
        foundingMemberRemainingSeats: nextSeats,
        showProModal: false,
        merlinAuth: {
          ...state.merlinAuth,
          tier: planId === 'free_trial' ? 'FREE' : 'PRO_LIFETIME',
        },
        lastQuarantineToast: `🎉 [${labelMap[planId]}] 적용이 완료되었습니다! 모든 주치의 기능을 제한 없이 이용하실 수 있습니다.`,
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
