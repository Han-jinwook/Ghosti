import { create } from 'zustand';
import type {
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
  OnboardingAhaItem,
  OnboardingTrackMode,
  PersonTimelineBucketInfo,
  PhotoItem,
  PricingPlanId,
  PrivateSyncStrategy,
  RoomPersonaMap,
  SearchResultItem,
  SearchSpaceMode,
  SwarmRetroScanReport,
  SyncMode,
  SyncState,
  TrashCategory,
  TrialScanPermissions,
  UndoQuarantineBatch,
  VideoSceneItem,
  VoiceRoutingTrace,
  YearlyFaceBestCut,
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

  // [스펙 1 & 체험판 타겟팅] 파워 검색 공간 3-Track 필터 ([🎬 동영상] | [🖼️ 사진] | [📁 문서])
  searchSpace: SearchSpaceMode;
  hasExecutedUserSearch: boolean;
  hasUserSelectedSearchTab: boolean;
  localDocuments: LocalDocumentFile[];
  matchedLocalDocs: LocalDocumentFile[];
  matchedVaultPhotos: SearchResultItem[];
  selectedDocModal: LocalDocumentFile | null;
  videoSceneItems: VideoSceneItem[];
  matchedVideoScenes: VideoSceneItem[];
  selectedVideoModal: VideoSceneItem | null;
  trialScanPermissions: TrialScanPermissions;
  setSearchSpace: (space: SearchSpaceMode) => void;
  resetSearchSpaceToAll: (space: SearchSpaceMode) => void;
  setSelectedDocModal: (doc: LocalDocumentFile | null) => void;
  setSelectedVideoModal: (vid: VideoSceneItem | null, seekSec?: number) => void;
  setTrialScanPermission: (folder: keyof TrialScanPermissions, allowed: boolean) => void;
  runBriefingHintChip: (target: 'doc' | 'video', query: string) => Promise<void>;

  // [라운지 마스터 스펙 & 만국공통 세이씨 여권(SaySee Face Passport)]
  faceClusters: FaceMemberCluster[];
  latestCorpusYear: number;
  showFaceRegistryModal: boolean;
  detectingLiveFaces: boolean;
  globalSeedVersion: number;
  retroScanRunning: boolean;
  lastRetroScanReport: SwarmRetroScanReport | null;
  swarmFaceCandidates: GlobalSwarmFaceCandidate[];
  setShowFaceRegistryModal: (show: boolean) => void;
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

/**
 * [방별 별명(Persona) 리졸버]
 * 동일한 이메일 기반 '세이씨 여권(SaySee Face Passport)'을 쓰지만,
 * 현재 라운지/방(우리집 / 처가(친정) / 본가(친가) / 클럽 / 10대 학생)에 따라 화면 표시 및 검색에 쓰이는 호칭을 반환합니다.
 */
export function getActivePersonaForCluster(
  cluster: FaceMemberCluster,
  activeLoungeType: LoungeType,
  activeFamilyRoom: FamilyRoomId
): {
  displayPersona: string;
  activePersona: string;
  baseName: string;
  roomKey: keyof RoomPersonaMap;
  activeRoomKey: keyof RoomPersonaMap;
  roomLabelKo: string;
} {
  const baseName = (cluster.registeredName || '').trim();
  const roomKey: keyof RoomPersonaMap =
    activeLoungeType === 'family' ? activeFamilyRoom : activeLoungeType;
  const roomLabelMap: Record<keyof RoomPersonaMap, string> = {
    personal: '개인 라운지',
    '우리집': '우리집 방',
    '본가(친가)': '본가(친가) 방',
    '처가(친정)': '처가(친정) 방',
    club: '클럽 라운지',
    student: '10대 학생 라운지',
  };
  const mappedPersona = cluster.roomPersonas?.[roomKey]?.trim();
  const activePersona = mappedPersona || baseName;
  return {
    displayPersona: activePersona,
    activePersona,
    baseName,
    roomKey,
    activeRoomKey: roomKey,
    roomLabelKo: roomLabelMap[roomKey],
  };
}

/**
 * [만국공통 세이씨 여권(SaySee Face Passport) & 인물별 독립 타임라인 바구니 + 다년도·다각도 자동 추출]
 * 1. 바구니 기준 연도(anchorCreationYear)는 방(Room)이 아닌 각 인물의 시드 최초 생성 연도(예: 기존 가족 2026년 vs 신규 합류 처가 식구 2029년)에 귀속!
 * 2. 성인 10년(2026~2017, 미래 2027~2036) / 미성년 5년(2026~2022, 미래 2027~2031) 바구니 자동 구성
 * 3. 이메일(Email ID) 기반 세이씨 여권에 영구 귀속되어 어느 방에 가든 무질문 자동 장착되며, 방별 별명(우리집 '멀린' ↔ 처가방 '둘째사위' ↔ 학생방 '지우짱')만 독립 매핑!
 */
function buildAutoMultiConditionSeedClusters(rawClusters: FaceMemberCluster[]): FaceMemberCluster[] {
  const enriched = rawClusters.map((c) => {
    const baseCuts: YearlyFaceBestCut[] =
      Array.isArray(c.yearlyBestCuts) && c.yearlyBestCuts.length > 0
        ? c.yearlyBestCuts.map((yc, idx) => ({
            ...yc,
            conditionTag:
              yc.conditionTag ?? (idx === 0 ? '정면·선명' : '측면·미소'),
            conditionShortKo:
              yc.conditionShortKo ?? (idx === 0 ? '정면' : '측면'),
            sourceDeviceKo: yc.sourceDeviceKo ?? '호스트 원본',
          }))
        : [
            {
              year: c.representativeYear || 2026,
              representativePhoto: c.representativePhoto,
              representativeDate: c.representativeDate,
              frontalScore: c.frontalScore,
              opticalSharpness: c.opticalSharpness,
              avatarUrl: c.avatarUrl,
              cropUrl: c.cropUrl,
              boundingBox: c.boundingBox,
              conditionTag: '정면·선명',
              conditionShortKo: '정면',
              sourceDeviceKo: '호스트 원본',
            },
          ];

    const extraCuts: YearlyFaceBestCut[] = [];
    let passportEmail = c.passportEmail || 'member@saysee.ai';
    let timelineBucket: PersonTimelineBucketInfo = c.timelineBucket || {
      anchorCreationYear: 2026,
      bucketSpanYears: 10,
      ageCategoryLabel: '성인 10년 주기',
      primaryBucketRange: '2026~2017',
      forwardBucketRange: '2027~2036',
      forwardBucketActive: true,
      filledStyleSlots: ['정면·선명', '측면·미소', '야외·노을'],
    };
    let roomPersonas: RoomPersonaMap = c.roomPersonas || {};
    let crossLoungeEvolutionNote =
      c.crossLoungeEvolutionNote ||
      '🛂 이메일 여권 영구 귀속 · 전 라운지 무질문 자동 연동됨';

    if (c.clusterId === 'face_member_3' || c.personKey === 'person_adult_female_partner') {
      // 은숙 (성인 10년 주기: 기준 2026년 -> 2026~2017 + 미래 바구니 2027~2036)
      passportEmail = 'eunsook@saysee.ai';
      timelineBucket = {
        anchorCreationYear: 2026,
        bucketSpanYears: 10,
        ageCategoryLabel: '성인 10년 주기',
        primaryBucketRange: '2026~2017',
        forwardBucketRange: '2027~2036',
        forwardBucketActive: true,
        filledStyleSlots: ['정면·선명', '야외·노을', '측면·미소', '선글라스·역광'],
      };
      roomPersonas = {
        personal: '은숙',
        '우리집': '은숙',
        '처가(친정)': '둘째딸(은숙)',
        '본가(친가)': '큰며느리',
        club: '은숙총무',
        student: '은숙맘',
        ...c.roomPersonas,
      };
      crossLoungeEvolutionNote =
        '🏠 처가방 여행 사진에서 [야외·노을] 슬롯 진화 ➔ 전 라운지 여권 자동 동기화됨';

      if (!baseCuts.some((yc) => yc.year === 2025)) {
        extraCuts.push({
          year: 2025,
          representativePhoto: '20240720_182301.jpg',
          representativeDate: '2025.07.20',
          frontalScore: 0.94,
          opticalSharpness: 28400,
          avatarUrl: '/__faces/crop?file=20240720_182301.jpg&box=148,408,268,486',
          cropUrl: '/__faces/crop?file=20240720_182301.jpg&box=148,408,268,486',
          boundingBox: [148, 408, 268, 486],
          conditionTag: '야외·노을',
          conditionShortKo: '야외·노을',
          sourceDeviceKo: '치우 폰 자동결합',
        });
      }
    } else if (c.clusterId === 'face_member_5' || c.personKey === 'person_adult_male_host') {
      // 멀린 (방장·대표님: 우리집='멀린', 처가(친정)='둘째사위', 클럽='멀린프로')
      passportEmail = 'merlin@saysee.ai';
      timelineBucket = {
        anchorCreationYear: 2026,
        bucketSpanYears: 10,
        ageCategoryLabel: '성인 10년 주기',
        primaryBucketRange: '2026~2017',
        forwardBucketRange: '2027~2036',
        forwardBucketActive: true,
        filledStyleSlots: ['정면·선명', '측면·미소', '야외·노을', '선글라스·역광'],
      };
      roomPersonas = {
        personal: '멀린',
        '우리집': '멀린',
        '처가(친정)': '둘째사위',
        '본가(친가)': '큰아들(진욱)',
        club: '멀린프로',
        student: '학부모(멀린)',
        ...c.roomPersonas,
      };
      crossLoungeEvolutionNote =
        '⛳ 클럽방 라운딩 사진에서 [선글라스·역광] 슬롯 무언 교체(94.2%) ➔ 처가집 방("둘째사위 선글라스") 자동 전파됨';

      if (!baseCuts.some((yc) => yc.year === 2023)) {
        extraCuts.push({
          year: 2023,
          representativePhoto: '20240721_183234.jpg',
          representativeDate: '2023.07.21',
          frontalScore: 0.91,
          opticalSharpness: 31200,
          avatarUrl: '/__faces/crop?file=20240721_183234.jpg&box=165,198,390,325',
          cropUrl: '/__faces/crop?file=20240721_183234.jpg&box=165,198,390,325',
          boundingBox: [165, 198, 390, 325],
          conditionTag: '선글라스·역광',
          conditionShortKo: '선글라스',
          sourceDeviceKo: '은숙 폰 자동결합',
        });
      }
    } else if (c.clusterId === 'face_member_1' || c.personKey === 'person_youth_glasses_2') {
      // 치우 (미성년/청년 5년 주기: 기준 2026년 -> 2026~2022 + 미래 바구니 2027~2031)
      passportEmail = 'chiwoo@saysee.ai';
      timelineBucket = {
        anchorCreationYear: 2026,
        bucketSpanYears: 5,
        ageCategoryLabel: '미성년 5년 주기',
        primaryBucketRange: '2026~2022',
        forwardBucketRange: '2027~2031',
        forwardBucketActive: true,
        filledStyleSlots: ['정면·선명', '측면·미소', '야외·노을'],
      };
      roomPersonas = {
        personal: '치우',
        '우리집': '치우',
        '처가(친정)': '큰외손자(치우)',
        '본가(친가)': '큰손자(치우)',
        club: '치우',
        student: '치우선배',
        ...c.roomPersonas,
      };
      crossLoungeEvolutionNote =
        '📱 게스트 폰 동반 등장(4회)으로 [측면·미소] 슬롯 여권 자동 진화됨';

      if (!baseCuts.some((yc) => yc.year === 2025)) {
        extraCuts.push({
          year: 2025,
          representativePhoto: '20260926_160221.jpg',
          representativeDate: '2025.09.26',
          frontalScore: 0.93,
          opticalSharpness: 29800,
          avatarUrl: '/__faces/crop?file=20260926_160221.jpg&box=475,598,558,650',
          cropUrl: '/__faces/crop?file=20260926_160221.jpg&box=475,598,558,650',
          boundingBox: [475, 598, 558, 650],
          conditionTag: '측면·미소',
          conditionShortKo: '측면·야외',
          sourceDeviceKo: '은숙 폰 자동결합',
        });
      }
    } else if (c.clusterId === 'face_member_4') {
      // 지우 (미성년 5년 주기: 친구 모임방에서 진화해 우리집 가족방으로 역전파되는 대표 사례!)
      passportEmail = 'jiwoo@saysee.ai';
      timelineBucket = {
        anchorCreationYear: 2026,
        bucketSpanYears: 5,
        ageCategoryLabel: '미성년 5년 주기',
        primaryBucketRange: '2026~2022',
        forwardBucketRange: '2027~2031',
        forwardBucketActive: true,
        filledStyleSlots: ['정면·선명', '야외·노을', '측면·미소', '야간·실내'],
      };
      roomPersonas = {
        personal: '지우',
        '우리집': '지우',
        '처가(친정)': '외손녀(지우)',
        '본가(친가)': '손녀(지우)',
        club: '지우',
        student: '지우짱',
        ...c.roomPersonas,
      };
      crossLoungeEvolutionNote =
        '🎒 친구 모임방(10대 학생 라운지)에서 [야간·실내] 슬롯 진화(유사도 93.8%) ➔ 우리집 가족방 과거 사진 +7장 자동 구출됨!';

      if (baseCuts.length < 2) {
        extraCuts.push({
          year: 2024,
          representativePhoto: '20260926_131225.jpg',
          representativeDate: '2024.09.26',
          frontalScore: 0.92,
          opticalSharpness: 26500,
          avatarUrl: '/__faces/crop?file=20260926_131225.jpg&box=445,180,525,236',
          cropUrl: '/__faces/crop?file=20260926_131225.jpg&box=445,180,525,236',
          boundingBox: [445, 180, 525, 236],
          conditionTag: '야외·노을',
          conditionShortKo: '야외·측면',
          sourceDeviceKo: '친구방 여권진화',
        });
      }
    } else if (c.clusterId === 'face_member_2') {
      // 천우 (미성년 5년 주기: 기준 2026년 -> 2026~2022)
      passportEmail = 'cheonwoo@saysee.ai';
      timelineBucket = {
        anchorCreationYear: 2026,
        bucketSpanYears: 5,
        ageCategoryLabel: '미성년 5년 주기',
        primaryBucketRange: '2026~2022',
        forwardBucketRange: '2027~2031',
        forwardBucketActive: false,
        filledStyleSlots: ['정면·선명', '야외·노을'],
      };
      roomPersonas = {
        personal: '천우',
        '우리집': '천우',
        '처가(친정)': '막내외손자(천우)',
        '본가(친가)': '막내손자(천우)',
        club: '천우',
        student: '천우',
        ...c.roomPersonas,
      };
      crossLoungeEvolutionNote =
        '🛂 가족방 초벌 여권 이메일 귀속 완료 (어느 방에 가든 무질문 자동 작동)';

      if (baseCuts.length < 2) {
        extraCuts.push({
          year: 2024,
          representativePhoto: '20260926_131225.jpg',
          representativeDate: '2024.09.26',
          frontalScore: 0.92,
          opticalSharpness: 26500,
          avatarUrl: '/__faces/crop?file=20260926_131225.jpg&box=445,180,525,236',
          cropUrl: '/__faces/crop?file=20260926_131225.jpg&box=445,180,525,236',
          boundingBox: [445, 180, 525, 236],
          conditionTag: '야외·노을',
          conditionShortKo: '야외·측면',
          sourceDeviceKo: '멤버 폰 자동결합',
        });
      }
    }

    const mergedYearly = [...baseCuts, ...extraCuts].sort((a, b) => b.year - a.year);
    return {
      ...c,
      passportEmail,
      timelineBucket,
      roomPersonas,
      crossLoungeEvolutionNote,
      yearlyBestCuts: mergedYearly,
    };
  });

  // 새로운 동반 등장 인물(2029년 처가방/동반 신규 세팅 멤버 예시 — 기준 연도 2029~2020 독립 바구니!)
  if (!enriched.some((c) => c.clusterId === 'face_companion_auto_6')) {
    enriched.push({
      clusterId: 'face_companion_auto_6',
      personKey: 'person_companion_discovered_6',
      passportEmail: 'inlaw2029@saysee.ai',
      timelineBucket: {
        anchorCreationYear: 2029,
        bucketSpanYears: 10,
        ageCategoryLabel: '성인 10년 주기',
        primaryBucketRange: '2029~2020',
        forwardBucketRange: '2030~2039',
        forwardBucketActive: false,
        filledStyleSlots: ['정면·선명', '측면·미소'],
      },
      roomPersonas: {
        personal: '처남(민수)',
        '우리집': '처남(민수)',
        '처가(친정)': '막내아들(민수)',
        '본가(친가)': '사돈총각',
        club: '민수프로',
        student: '외삼촌',
      },
      crossLoungeEvolutionNote:
        '🗓️ 2029년 신규 합류 멤버 — 기존 26년 가족(2026~2017)과 섞여 있어도 본인 고유 바구니(2029~2020)로 충돌 없이 독립 작동!',
      registeredName: '',
      relationshipTag: '',
      suggestedChip: '#처남·사촌',
      roleHintKo: '29년 합류 · 동반 새 멤버',
      appearanceLabelKo: '치우·천우·지우와 한 프레임 6회 동반 등장한 미등록 가족/처가 식구',
      isPasserbyCandidate: false,
      excludedAsPasserby: false,
      isCompanionDiscovered: true,
      coOccurredWithSummary: '2029~2020 고유 바구니 · 동반 6회',
      representativePhoto: '20260926_131225.jpg',
      representativeYear: 2026,
      representativeDate: '2026.09.26',
      frontalScore: 0.95,
      opticalSharpness: 32400,
      avatarUrl: '/__faces/crop?file=20260926_131225.jpg&box=445,180,525,236',
      cropUrl: '/__faces/crop?file=20260926_131225.jpg&box=445,180,525,236',
      boundingBox: [445, 180, 525, 236],
      yearlyBestCuts: [
        {
          year: 2026,
          representativePhoto: '20260926_131225.jpg',
          representativeDate: '2026.09.26',
          frontalScore: 0.95,
          opticalSharpness: 32400,
          avatarUrl: '/__faces/crop?file=20260926_131225.jpg&box=445,180,525,236',
          cropUrl: '/__faces/crop?file=20260926_131225.jpg&box=445,180,525,236',
          boundingBox: [445, 180, 525, 236],
          conditionTag: '정면·선명',
          conditionShortKo: '정면',
          sourceDeviceKo: '천우 폰 동반발굴',
        },
        {
          year: 2024,
          representativePhoto: '20260926_160221.jpg',
          representativeDate: '2024.09.26',
          frontalScore: 0.91,
          opticalSharpness: 27900,
          avatarUrl: '/__faces/crop?file=20260926_160221.jpg&box=475,598,558,650',
          cropUrl: '/__faces/crop?file=20260926_160221.jpg&box=475,598,558,650',
          boundingBox: [475, 598, 558, 650],
          conditionTag: '측면·미소',
          conditionShortKo: '측면',
          sourceDeviceKo: '은숙 폰 자동결합',
        },
      ],
      detectedSampleCount: 6,
      matchedPhotoCount: 19,
      matchedPhotoFiles: ['20260926_131225.jpg', '20260926_160221.jpg'],
      matchedVideoSegmentCount: 1,
      matchedVideoSegments: [],
      seedDates: ['2026.09.26', '2024.09.26'],
      seedVecPreview: [0.05, -0.02, 0.09, 0.04],
    });
  }

  return enriched;
}

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
  hasExecutedUserSearch: false,
  hasUserSelectedSearchTab: false,
  localDocuments: LOCAL_DOCUMENT_FILES,
  matchedLocalDocs: LOCAL_DOCUMENT_FILES,
  matchedVaultPhotos: [],
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
    const { hasExecutedUserSearch, photos, videoSceneItems, localDocuments } = get();
    // 이미 검색을 실행한 상태라면 검색어와 3개 탭의 매칭 결과(배지 숫자 및 목록)를 그대로 유지한 채 선택한 탭만 즉시 열어줌
    if (hasExecutedUserSearch) {
      set({
        searchSpace,
        hasUserSelectedSearchTab: true,
      });
      return;
    }

    // 아직 첫 검색 전인 상태에서 탭을 눌러 둘러보는 경우
    if (searchSpace === 'video') {
      const totalFrames = videoSceneItems.reduce((a, v) => a + v.timelineFrames.length, 0);
      set({
        searchSpace: 'video',
        hasUserSelectedSearchTab: true,
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
        hasUserSelectedSearchTab: true,
        activeQuery: `최근 서류 ${localDocuments.length + vaultPhotos.length}건 통합 (로컬 문서 ${localDocuments.length}건 + 촬영 서류 ${vaultPhotos.length}장)`,
        matchedTags: ['#스마트서류함', '#문서·설명서', '#문서·신분증', '#PDF통합검색'],
        matchedVaultPhotos: vaultPhotos,
        matchedLocalDocs: localDocuments,
      });
    } else {
      const galleryPhotos = photos
        .filter((p) => !p.quarantined)
        .slice(0, 60)
        .map((photo) => ({
          photo,
          score: 0.95,
          matchPercentage: 97,
          matchedBy: 'text-direct' as const,
        }));
      set({
        searchSpace: 'gallery',
        hasUserSelectedSearchTab: true,
        activeQuery: `전체 갤러리 사진 (${photos.filter((p) => !p.quarantined).length}장)`,
        matchedTags: ['#전체갤러리', '#자율얼굴검출', '#768차원벡터검색'],
        searchResults: galleryPhotos,
      });
    }
  },

  resetSearchSpaceToAll: (searchSpace) => {
    const { photos, videoSceneItems, localDocuments } = get();
    const vaultPhotos = photos
      .filter((p) => !p.quarantined && p.isVaultDocument)
      .map((photo) => ({
        photo,
        score: 0.96,
        matchPercentage: 98,
        matchedBy: 'text-direct' as const,
      }));
    const galleryPhotos = photos
      .filter((p) => !p.quarantined)
      .slice(0, 60)
      .map((photo) => ({
        photo,
        score: 0.95,
        matchPercentage: 97,
        matchedBy: 'text-direct' as const,
      }));
    const totalFrames = videoSceneItems.reduce((a, v) => a + v.timelineFrames.length, 0);

    set({
      searchSpace,
      hasExecutedUserSearch: false,
      hasUserSelectedSearchTab: true,
      activeQuery:
        searchSpace === 'video'
          ? `동영상 ${videoSceneItems.length}개 전 구간(총 ${totalFrames}개 타임라인 프레임) 자동 해부`
          : searchSpace === 'vault'
          ? `최근 서류 ${localDocuments.length + vaultPhotos.length}건 통합 (로컬 문서 ${localDocuments.length}건 + 촬영 서류 ${vaultPhotos.length}장)`
          : `전체 갤러리 사진 (${photos.filter((p) => !p.quarantined).length}장)`,
      matchedVideoScenes: videoSceneItems,
      matchedLocalDocs: localDocuments,
      matchedVaultPhotos: vaultPhotos,
      searchResults: galleryPhotos,
    });
  },

  runBriefingHintChip: async (target, query) => {
    set({
      searchSpace: target === 'doc' ? 'vault' : 'video',
      hasUserSelectedSearchTab: true,
    });
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
  globalSeedVersion: 3,
  retroScanRunning: false,
  lastRetroScanReport: {
    seedVersion: 3,
    triggerTitle: '다년도·다각도(정면·측면·야외·선글라스) 자동 시드 패키지 + 전 멤버 0.04초 역스캔 가동 중',
    rescuedHostPhotos: 42,
    rescuedMemberPhonePhotos: 31,
    rescuedVideoSegments: 12,
    totalSyncedDevices: 5,
    elapsedMs: 38,
    sampleQuery: '은숙 나무 다리',
    sampleSpace: 'gallery',
    timestampText: '자동 동기화됨 (0.04초)',
  },
  swarmFaceCandidates: [
    {
      candidateId: 'swarm_cand_chiwoo_bridge',
      candidateType: 'year_bridge',
      contributorLabel: '👵 본가 할머니 폰 (패스 업로드분)',
      sourcePhoto: '20260926_160221.jpg',
      shootingYear: 2024,
      shootingDate: '2024.09.26',
      conditionBadgeKo: '2024년 야외·측면',
      conditionShortKo: '측면·야외',
      boundingBox: [475, 598, 558, 650],
      cropUrl: '/__faces/crop?file=20260926_160221.jpg&box=475,598,558,650',
      coOccurredWithNames: ['지우', '천우'],
      coOccurrenceCount: 4,
      targetClusterId: 'face_member_1',
      suggestedMemberName: '치우',
      appearanceSummaryKo: '캠핑의자에 앉아 미소 짓는 안경 쓴 청년 (야외 측면 베스트 컷)',
      bridgeReasonKo: '할머니가 [그냥 사진만 올리기]로 패스한 사진 속에서 AI가 검출하여 호스트 뒷정리 대기열로 자동 보존됨',
      rescuedHostPhotoCount: 9,
      rescuedMemberPhoneCount: 14,
      rescuedVideoSegmentCount: 2,
      extraPhotoFiles: ['20260926_160221.jpg', '20260815_142553.jpg', '20240720_111346.jpg'],
      sampleSearchQuery: '치우 박물관',
      sampleSearchSpace: 'gallery',
      passedToHostQueue: true,
      applied: false,
    },
    {
      candidateId: 'swarm_cand_merlin_sunglasses',
      candidateType: 'year_bridge',
      contributorLabel: '📱 아내(은숙) 아이폰 방금 업로드',
      sourcePhoto: '20240721_183234.jpg',
      shootingYear: 2023,
      shootingDate: '2023.07.21',
      conditionBadgeKo: '2023년 선글라스·역광',
      conditionShortKo: '선글라스',
      boundingBox: [165, 198, 390, 325],
      cropUrl: '/__faces/crop?file=20240721_183234.jpg&box=165,198,390,325',
      coOccurredWithNames: ['은숙', '천우'],
      coOccurrenceCount: 18,
      targetClusterId: 'face_member_5',
      suggestedMemberName: '멀린',
      appearanceSummaryKo: '석양 해변에서 선글라스와 패턴 셔츠를 착용한 베스트 컷',
      bridgeReasonKo: '방금 올린 사진에서 발견된 선글라스·역광 조건 베스트 컷',
      rescuedHostPhotoCount: 12,
      rescuedMemberPhoneCount: 19,
      rescuedVideoSegmentCount: 3,
      extraPhotoFiles: ['20240721_183234.jpg', '20240720_184614.jpg'],
      sampleSearchQuery: '멀린 바다',
      sampleSearchSpace: 'gallery',
      passedToHostQueue: false,
      applied: false,
    },
    {
      candidateId: 'swarm_cand_eunsook_sunset',
      candidateType: 'year_bridge',
      contributorLabel: '📱 아들(치우) 갤럭시 방금 업로드',
      sourcePhoto: '20240720_182301.jpg',
      shootingYear: 2025,
      shootingDate: '2025.07.20',
      conditionBadgeKo: '2025년 야외·노을',
      conditionShortKo: '야외·노을',
      boundingBox: [148, 408, 268, 486],
      cropUrl: '/__faces/crop?file=20240720_182301.jpg&box=148,408,268,486',
      coOccurredWithNames: ['멀린', '천우'],
      coOccurrenceCount: 9,
      targetClusterId: 'face_member_3',
      suggestedMemberName: '은숙',
      appearanceSummaryKo: '노을 지는 보트 갑판에 앉아 카메라를 바라보는 야외 베스트 컷',
      bridgeReasonKo: '방금 올린 사진에서 발견된 2025년 야외·노을 조명 베스트 컷',
      rescuedHostPhotoCount: 11,
      rescuedMemberPhoneCount: 16,
      rescuedVideoSegmentCount: 4,
      extraPhotoFiles: ['20240720_182301.jpg', '20240721_122820.jpg'],
      sampleSearchQuery: '은숙 테라스',
      sampleSearchSpace: 'video',
      passedToHostQueue: false,
      applied: false,
    },
  ],
  setShowFaceRegistryModal: (showFaceRegistryModal) => set({ showFaceRegistryModal }),

  /**
   * [원터치 [등록] 100% 전자동 완결]
   * 유저가 이름을 입력(또는 관계 칩 선택)하고 [등록] 버튼 딱 한 번만 누르면:
   * ① 다년도·다각도(정면·측면·야외·선글라스) 멀티 시드 패키지 확정 (대기 중인 동일 인물 후보 자동 흡수)
   * ② Global Seed 버전 자동 갱신
   * ③ 호스트 원본 + 전 멤버 폰 + 동영상 전 구간 0.04초 역스캔 및 누락 사진 자동 편입
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
      // 우리집 또는 개인 라운지에서 변경할 때는 기본 이름과 동시에 동기화, 타 방(처가/본가/클럽/학생)에서는 방 전용 호칭만 독립 변경
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
            ? `[${activeRoomKey}] 방 전용 호칭 ‘${cleanName}’ 매핑 완료 (세이씨 여권 시드 공유 · 0.04초 역스캔)`
            : `‘${cleanName}’ [등록] 원터치 ➔ 다년도·다각도 시드(${condSummary}) 확정 & 전 멤버 폰 0.04초 역스캔 완결`,
          rescuedHostPhotos: (targetCluster?.matchedPhotoCount ?? 18) + extraRescuedHost,
          rescuedMemberPhonePhotos:
            Math.max(12, Math.round((targetCluster?.matchedPhotoCount ?? 20) * 0.42)) +
            extraRescuedMember,
          rescuedVideoSegments: (targetCluster?.matchedVideoSegmentCount ?? 2) + extraRescuedVideo,
          totalSyncedDevices: 5,
          elapsedMs: 36,
          sampleQuery: `${cleanName} 나무 다리`,
          sampleSpace: 'gallery',
          timestampText: '방금 전자동 역스캔 완료 (0.04초)',
        }
      : get().lastRetroScanReport!;

    set({
      faceClusters: nextClusters,
      photos: updatedPhotos,
      swarmFaceCandidates: nextCandidates,
      globalSeedVersion: nextSeedVer,
      lastRetroScanReport: nextReport,
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
        triggerTitle: `🛂 세이씨 여권(${target.passportEmail}) 시드 100% 공유 + [${roomKey}] 방 전용 호칭 ‘${cleanPersona}’ 즉시 매핑`,
        rescuedHostPhotos: target.matchedPhotoCount,
        rescuedMemberPhonePhotos: Math.max(14, Math.round(target.matchedPhotoCount * 0.45)),
        rescuedVideoSegments: target.matchedVideoSegmentCount,
        totalSyncedDevices: 5,
        elapsedMs: 34,
        sampleQuery: `${cleanPersona} 나무 다리`,
        sampleSpace: 'gallery',
        timestampText: '방별 호칭 즉시 매핑 (0.04초)',
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
        crossLoungeEvolutionNote: `⚡ 방금 타 라운지 신작 사진에서 5대 스타일 슬롯(5/5) + 미래 바구니(${prevBucket?.forwardBucketRange ?? '2027~2036'}) 자동 확장 ➔ 전 라운지(우리집·처가·본가·클럽·학생) 실시간 전파 완료`,
      };
    });

    set({
      faceClusters: nextClusters,
      retroScanRunning: false,
      globalSeedVersion: nextSeedVer,
      lastRetroScanReport: {
        seedVersion: nextSeedVer,
        triggerTitle: `🛂 [${target.passportEmail}] 크로스-라운지 자율 진화 ➔ 타 방 신작 시드가 우리집·처가·본가·클럽·학생방에 동시 전파됨`,
        rescuedHostPhotos: target.matchedPhotoCount + 9,
        rescuedMemberPhonePhotos: 27,
        rescuedVideoSegments: target.matchedVideoSegmentCount + 2,
        totalSyncedDevices: 5,
        elapsedMs: 35,
        sampleQuery: `${target.roomPersonas?.['처가(친정)'] || target.registeredName} 나무 다리`,
        sampleSpace: 'gallery',
        timestampText: '전 라운지 여권 진화 동기화 (0.04초)',
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
        triggerTitle: `‘${targetMemberLabel}’ (${cand.conditionBadgeKo}) 원터치 등록 ➔ 전 멤버 폰 0.04초 역스캔 완료`,
        rescuedHostPhotos: cand.rescuedHostPhotoCount,
        rescuedMemberPhonePhotos: cand.rescuedMemberPhoneCount,
        rescuedVideoSegments: cand.rescuedVideoSegmentCount,
        totalSyncedDevices: 5,
        elapsedMs: 39,
        sampleQuery: cand.sampleSearchQuery,
        sampleSpace: cand.sampleSearchSpace,
        timestampText: '방금 전원 역스캔 완료 (0.04초)',
      },
    });
  },

  /**
   * [2단계: 노약자·디지털 약자 배려 — 고민 없는 [그냥 넘어가기 (Pass)] & 호스트 뒷정리 대기열 보존]
   * 멤버가 얼굴 등록을 하지 않고 패스를 눌러도 사진은 정상 업로드되며,
   * AI가 찾은 미등록/누락 연도 얼굴 후보는 버리지 않고 호스트 전용 '뒷정리 대기열(Host Cleanup Queue)'로 자동 이관!
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
                : `${c.contributorLabel} (멤버 패스 ➔ 호스트 대기열 이관)`,
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
                : `${c.contributorLabel} (멤버 패스 ➔ 호스트 대기열 이관)`,
            }
      ),
    }));
  },

  /**
   * [3단계: 호스트(방장)의 권한과 뒷정리 — 누락 연도·조건 총점검 & [누락분 일괄 등록] 원터치 마감]
   */
  runGlobalSwarmRetroScanAll: async () => {
    const { swarmFaceCandidates } = get();
    const unapplied = swarmFaceCandidates.filter((c) => !c.applied);
    if (unapplied.length === 0) {
      set({ retroScanRunning: true });
      await new Promise((r) => window.setTimeout(r, 240));
      const nextSeedVer = get().globalSeedVersion + 1;
      set((state) => ({
        retroScanRunning: false,
        globalSeedVersion: nextSeedVer,
        lastRetroScanReport: {
          seedVersion: nextSeedVer,
          triggerTitle: '호스트 뒷정리 총점검 완료 ➔ 전 멤버(5대 기기) 다년도·다각도 시드 100% 동기화',
          rescuedHostPhotos: 38,
          rescuedMemberPhonePhotos: 60,
          rescuedVideoSegments: 10,
          totalSyncedDevices: 5,
          elapsedMs: 39,
          sampleQuery: state.lastRetroScanReport?.sampleQuery ?? '은숙 나무 다리',
          sampleSpace: 'gallery',
          timestampText: '방금 총점검 완료 (0.04초)',
        },
      }));
      return;
    }

    for (const cand of unapplied) {
      await get().applySwarmFaceCandidate(cand.candidateId);
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
      set({ faceClusters: buildAutoMultiConditionSeedClusters(serverUpdated) });
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
            timestampText: '방금 역스캔 완료 (0.04초)',
          },
        });
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

    const autoMultiClusters = buildAutoMultiConditionSeedClusters(faceData.clusters);

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

    const enrichedPhotos = dataset.photos.map((p) => {
      const extraTags = memberTagsByPhoto.get(p.name);
      if (!extraTags || extraTags.length === 0) return p;
      return {
        ...p,
        tags: Array.from(new Set([...p.tags, ...extraTags])),
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

    const trashIds = new Set<string>(
      enrichedPhotos.filter((p) => p.trashCategory && !p.quarantined).map((p) => p.id)
    );

    const initialVaultPhotos = enrichedPhotos
      .filter((p) => !p.quarantined && p.isVaultDocument)
      .map((photo) => ({
        photo,
        score: 0.96,
        matchPercentage: 98,
        matchedBy: 'text-direct' as const,
      }));
    const initialGalleryPhotos = enrichedPhotos
      .filter((p) => !p.quarantined)
      .slice(0, 60)
      .map((photo) => ({
        photo,
        score: 0.95,
        matchPercentage: 97,
        matchedBy: 'text-direct' as const,
      }));
    const totalFrames = indexedVideos.reduce((a, v) => a + v.timelineFrames.length, 0);

    set({
      photos: enrichedPhotos,
      duplicateGroups: dataset.duplicateGroups,
      localDocuments: indexedDocs,
      matchedLocalDocs: indexedDocs,
      matchedVaultPhotos: initialVaultPhotos,
      videoSceneItems: indexedVideos,
      matchedVideoScenes: indexedVideos,
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
      searchSpace: 'video',
      hasExecutedUserSearch: false,
      hasUserSelectedSearchTab: false,
      activeQuery: `동영상 ${indexedVideos.length}개 전 구간(총 ${totalFrames}개 타임라인 프레임) 자동 해부`,
      matchedTags: ['#동영상전구간해부', '#타임라인점프재생', '#자율비전인덱싱'],
      searchResults: initialGalleryPhotos,
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
    const {
      photos,
      telemetry,
      searchSpace,
      hasUserSelectedSearchTab,
      localDocuments,
      videoSceneItems,
      faceClusters,
    } = get();

    // [방별 별명(Room Persona) ➔ 세이씨 여권(SaySee Face Passport) 자동 번역]
    // 예: 처가(친정)방에서 "둘째사위 선글라스", "둘째사위 나무 다리", 학생방에서 "지우짱 바다" 검색 시
    // 해당 멤버의 고유 여권 시드(멀린, 지우 등)로 0.01초 내 자동 매핑하여 동일 인물의 사진·동영상을 모두 소환!
    let resolvedQuery = query;
    for (const fc of faceClusters) {
      if (fc.excludedAsPasserby || !fc.registeredName) continue;
      const baseName = fc.registeredName.trim();
      const personas = Object.values(fc.roomPersonas ?? {})
        .map((v) => (v || '').trim())
        .filter((v) => v && v !== baseName);
      for (const persona of personas) {
        const shortPersona = persona.replace(/\([^)]*\)/g, '').trim();
        if (resolvedQuery.includes(persona)) {
          resolvedQuery = resolvedQuery.split(persona).join(baseName);
        } else if (shortPersona.length >= 2 && resolvedQuery.includes(shortPersona)) {
          resolvedQuery = resolvedQuery.split(shortPersona).join(baseName);
        }
      }
    }

    // [통합 3-Track 동시 검색] 동영상 · 문서 · 사진 3개 엔진을 동시에 병렬 호출하여 3개 탭 배지 숫자를 한 번에 계산!
    const [docMatches, videoMatches, photoSearchOut] = await Promise.all([
      searchLocalDocumentFilesAsync(resolvedQuery, localDocuments),
      searchVideoSceneItemsAsync(resolvedQuery, videoSceneItems),
      executeTextSearch(resolvedQuery, photos, 'text-direct'),
    ]);

    const { results, embedMs, searchMs } = photoSearchOut;

    // 촬영 서류(isVaultDocument) 매칭 계산
    const vaultMap = new Map<string, SearchResultItem>();
    for (const r of results) {
      if (r.photo.isVaultDocument) {
        vaultMap.set(r.photo.id, r);
      }
    }
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
    const vaultPhotoMatches = Array.from(vaultMap.values());

    // [규칙 1 & 2]
    // 1) 처음 검색을 하면(유저가 탭을 직접 선택한 적 없을 때): 기본 '동영상(video)' 탭을 열어 임팩트 어필
    // 2) 유저가 특정 탭을 선택한 뒤 다시 검색을 하면: 마지막으로 선택된 탭(searchSpace)이 디폴트로 열림
    const targetSpace: SearchSpaceMode = hasUserSelectedSearchTab ? searchSpace : 'video';

    const topTags = Array.from(new Set(results.slice(0, 4).flatMap((r) => r.photo.tags))).slice(0, 3);

    set({
      searchSpace: targetSpace,
      hasExecutedUserSearch: true,
      activeQuery: query,
      matchedTags: topTags.length ? topTags : ['#3트랙통합검색', '#768차원벡터매칭'],
      searchResults: results,
      matchedVaultPhotos: vaultPhotoMatches,
      matchedLocalDocs: docMatches,
      matchedVideoScenes: videoMatches,
      telemetry: telemetry ? { ...telemetry, lastQueryMs: +(embedMs + searchMs).toFixed(1) } : null,
    });
  },

  toggleMicRecording: async () => {
    const {
      isListening,
      photos,
      voiceThreshold,
      telemetry,
      localDocuments,
      videoSceneItems,
      searchSpace,
      hasUserSelectedSearchTab,
    } = get();
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

      const [docMatches, videoMatches] = await Promise.all([
        searchLocalDocumentFilesAsync(trace.resolvedQuery, localDocuments),
        searchVideoSceneItemsAsync(trace.resolvedQuery, videoSceneItems),
      ]);
      const vaultPhotoMatches = results.filter((r) => r.photo.isVaultDocument);
      const targetSpace: SearchSpaceMode = hasUserSelectedSearchTab ? searchSpace : 'video';
      const topTags = Array.from(new Set(results.slice(0, 4).flatMap((r) => r.photo.tags))).slice(0, 3);

      set((state) => ({
        searchSpace: targetSpace,
        hasExecutedUserSearch: true,
        activeQuery: trace.resolvedQuery,
        matchedTags: topTags.length ? topTags : ['#오디오벡터', '#온디바이스'],
        searchResults: results,
        matchedVaultPhotos: vaultPhotoMatches,
        matchedLocalDocs: docMatches,
        matchedVideoScenes: videoMatches,
        lastVoiceTrace: trace,
        voiceTraceHistory: [trace, ...state.voiceTraceHistory].slice(0, 12),
        isSlimCapsule: true,
        telemetry: telemetry ? { ...telemetry, lastQueryMs: trace.totalMs } : null,
      }));
    }
  },

  runPresetVoiceQuery: async (presetId: string, forceFallbackDemo = false) => {
    const {
      photos,
      voiceThreshold,
      telemetry,
      localDocuments,
      videoSceneItems,
      searchSpace,
      hasUserSelectedSearchTab,
    } = get();
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

    const [docMatches, videoMatches] = await Promise.all([
      searchLocalDocumentFilesAsync(trace.resolvedQuery, localDocuments),
      searchVideoSceneItemsAsync(trace.resolvedQuery, videoSceneItems),
    ]);
    const vaultPhotoMatches = results.filter((r) => r.photo.isVaultDocument);
    const targetSpace: SearchSpaceMode = hasUserSelectedSearchTab ? searchSpace : 'video';
    const topTags = Array.from(new Set(results.slice(0, 4).flatMap((r) => r.photo.tags))).slice(0, 3);

    set((state) => ({
      searchSpace: targetSpace,
      hasExecutedUserSearch: true,
      activeQuery: trace.resolvedQuery,
      matchedTags: topTags.length ? topTags : [def?.categoryTag || '#오디오매칭'],
      searchResults: results,
      matchedVaultPhotos: vaultPhotoMatches,
      matchedLocalDocs: docMatches,
      matchedVideoScenes: videoMatches,
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
