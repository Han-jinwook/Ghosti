import { create } from 'zustand';
import type {
  DuplicateGroup,
  HardwareTelemetry,
  MerlinAuthState,
  OnboardingAhaItem,
  PhotoItem,
  SearchResultItem,
  SyncMode,
  SyncState,
  TrashCategory,
  VoiceRoutingTrace,
} from '../types/saysee';
import {
  HybridVoiceSession,
  OnboardingProgressUpdate,
  PRESET_QUERIES,
  detectHardwareTelemetry,
  executeTextSearch,
  executeZeroSttVoiceSearch,
  loadInitialPhotoDataset,
  runOnboardingIndexingPipeline,
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
  // 레이아웃 & 미니멀 3대 탭 네비게이션 (🔍 AI 검색 | 🧹 스마트 정리 | ⚙️ 내 기기 & 백업)
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
  initApp: () => Promise<void>;

  // 100% 로컬 팩트 기반 문장형 추천 칩 (외부 LLM 의존도 0%)
  conceptLexiconCount: number;
  sentenceChips: LocalSentenceChip[];
  sentenceChipPage: number;
  cycleSentenceChips: () => void;
  onboardingAhaItems: OnboardingAhaItem[];
  applyAhaRecommendation: (item: OnboardingAhaItem) => Promise<void>;

  // 온보딩 13분 UX 방어 모달 상태 (지침 #1)
  showOnboarding: boolean;
  onboardingRunning: boolean;
  onboardingUseRealGpu: boolean;
  onboardingTargetCount: number;
  onboardingProgress: OnboardingProgressUpdate;
  setShowOnboarding: (show: boolean) => void;
  setOnboardingUseRealGpu: (real: boolean) => void;
  setOnboardingTargetCount: (count: number) => void;
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

  // 클리어몬스터 Lite 4대 탭 & PC 바둑판(Grid) Pick UI & [세이씨_정리대기함]
  selectedTrashIds: Set<string>;
  activeTrashCategoryFilter: TrashCategory | 'all';
  quarantineMoving: boolean;
  lastQuarantineToast: string | null;
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
  openLocalFolder: (target: 'quarantine' | 'photos') => Promise<void>;
  dismissQuarantineToast: () => void;

  // 하드웨어 텔레메트리, 멀린 토큰, 동기화
  telemetry: HardwareTelemetry | null;
  merlinAuth: MerlinAuthState;
  syncState: SyncState;
  showProModal: boolean;
  setShowProModal: (show: boolean) => void;
  switchMerlinTier: () => void;
  updateSyncSettings: (mode: SyncMode, wifiOnly: boolean) => void;
  triggerSyncNow: () => Promise<void>;
}

let cancelOnboardingFlag = false;
const voiceSession = new HybridVoiceSession();

const INITIAL_ONBOARDING_PROGRESS: OnboardingProgressUpdate = {
  phase: 'indexing',
  done: 222,
  total: 300,
  remaining: 78,
  percent: 74.0,
  elapsedSec: 590,
  etaSec: 207,
  perImageSec: 2.66,
  currentPhotoName: '20260926_155341.jpg',
  currentPhotoThumb: '/__photos/file?p=20260926_155341.jpg',
  liveVector64: Array.from({ length: 64 }, (_, i) => +(0.2 + Math.abs(Math.sin(i * 0.25)) * 0.75).toFixed(2)),
  modelStatusText: 'EmbeddingGemma 2 (Vision q4 • Budget 70) 온디바이스 768차원 벡터 추출 중',
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

    // 초기 기본 검색 결과 ("코타키나발루 나무 다리 위에서 산책하는 모습") 세팅
    const initialQuery = '코타키나발루 나무 다리 위에서 산책하는 모습';
    const initialSearch = await executeTextSearch(initialQuery, dataset.photos, 'text-direct');

    // 쓰레기 사진 기본 선택 세팅 (원본 1장으로 보호된 사진은 trashCategory가 없으므로 제외됨)
    const trashIds = new Set<string>(
      dataset.photos.filter((p) => p.trashCategory && !p.quarantined).map((p) => p.id)
    );

    set({
      photos: dataset.photos,
      duplicateGroups: dataset.duplicateGroups,
      telemetry: telemetry
        ? { ...telemetry, lastQueryMs: +(initialSearch.embedMs + initialSearch.searchMs).toFixed(1) }
        : null,
      syncState,
      sentenceChips: localChips,
      onboardingAhaItems: localAhaItems,
      activeQuery: initialQuery,
      matchedTags: ['#나무다리·공원', '#코타키나발루', '#산책'],
      searchResults: initialSearch.results,
      selectedTrashIds: trashIds,
      initialized: true,
      initializing: false,
    });
  },

  applyAhaRecommendation: async (item: OnboardingAhaItem) => {
    set({ showOnboarding: false });
    await get().runTextQuery(item.targetSearchQuery);
  },

  // ─────────────── 온보딩 13분 UX 방어 (지침 #1) ───────────────
  showOnboarding: false,
  onboardingRunning: false,
  onboardingUseRealGpu: false,
  onboardingTargetCount: 300,
  onboardingProgress: INITIAL_ONBOARDING_PROGRESS,

  setShowOnboarding: (showOnboarding) => set({ showOnboarding }),
  setOnboardingUseRealGpu: (onboardingUseRealGpu) => set({ onboardingUseRealGpu }),
  setOnboardingTargetCount: (onboardingTargetCount) => set({ onboardingTargetCount }),

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

  // ─────────────── Zero-STT 음성 검색 & 자연어 문장 검색 ───────────────
  activeQuery: '코타키나발루 나무 다리 위에서 산책하는 모습',
  matchedTags: ['#나무다리·공원', '#코타키나발루', '#산책'],
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
    const { photos, telemetry } = get();
    const { results, embedMs, searchMs } = await executeTextSearch(query, photos, 'text-direct');
    const topTags = Array.from(new Set(results.slice(0, 4).flatMap((r) => r.photo.tags))).slice(0, 3);

    set({
      activeQuery: query,
      matchedTags: topTags.length ? topTags : ['#시맨틱매칭', '#로컬벡터'],
      searchResults: results,
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

  // ─────────────── 클리어몬스터 Lite 4대 탭 & PC 바둑판(Grid) Pick UI & [세이씨_정리대기함] ───────────────
  selectedTrashIds: new Set<string>(),
  activeTrashCategoryFilter: 'duplicate',
  quarantineMoving: false,
  lastQuarantineToast: null,

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

  /**
   * [PC 바둑판(Grid) Pick UI]
   * 중복/연사 클러스터에서 유저가 가장 잘 나온 사진 1장을 클릭(Pick)하면:
   * 1) 클릭한 사진 1장을 [원본 1장 안전하게 보존됨](isBestInDuplicateGroup: true, trashCategory: undefined)으로 승격
   * 2) 나머지 쌍둥이 사본들은 duplicate(정리 대상)로 지정
   * 3) quarantineRestImmediately === true이면 나머지 사본들을 즉시 [세이씨_정리대기함]으로 이동 격리!
   */
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
        const movedSet = new Set<string>(json.moved ?? redundantIds);

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
            quarantineMoving: false,
            lastQuarantineToast: `✨ 선택한 베스트 원본 1장을 안전하게 남기고, 나머지 연사·사본 ${movedSet.size}장을 [세이씨_정리대기함]으로 즉시 격리했습니다.`,
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
      const movedSet = new Set<string>(json.moved ?? redundantIds);

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
      const movedSet = new Set<string>(json.moved ?? targetNames);

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
        lastQuarantineToast: `✅ ${movedSet.size}장의 사진이 [세이씨_정리대기함] 폴더로 안전하게 격리(이동)되었습니다.`,
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
        lastQuarantineToast: `♻️ ${restoredSet.size}장의 사진이 원본 폴더(test_photos)로 복원되었습니다.`,
      }));
    } catch {
      set({ quarantineMoving: false });
    }
  },

  openLocalFolder: async (target: 'quarantine' | 'photos') => {
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
            : '📂 윈도우 탐색기에서 원본 사진 폴더를 열었습니다.',
      });
    } catch {
      /* ignore */
    }
  },

  dismissQuarantineToast: () => set({ lastQuarantineToast: null }),

  // ─────────────── 기기 텔레메트리 & P2P 백업/동기화 ───────────────
  telemetry: null,
  merlinAuth: loadMerlinAuth(),
  syncState: loadSyncState(550, 3230438906),
  showProModal: false,
  setShowProModal: (showProModal) => set({ showProModal }),

  switchMerlinTier: () => {
    set((state) => ({ merlinAuth: toggleMerlinTier(state.merlinAuth) }));
  },

  updateSyncSettings: (mode: SyncMode, wifiOnly: boolean) => {
    saveSyncPrefs(mode, wifiOnly);
    set((state) => ({
      syncState: {
        ...state.syncState,
        mode,
        wifiOnly,
        lastSyncedAt: '방금 전',
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
        lastSyncedAt: '방금 전 (동기화 완료)',
      },
      lastQuarantineToast:
        state.syncState.mode === 'p2p-wifi'
          ? '📡 로컬 WiFi P2P (SaySee-Mesh) 무서버 암호화 백업·동기화가 완료되었습니다.'
          : '☁️ 경량 썸네일/벡터 동기화가 완료되었습니다.',
    }));
  },
}));
