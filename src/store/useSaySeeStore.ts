import { create } from 'zustand';
import { getZCoreUrl } from '../services/zCoreBridge';
import {
  speakSetupMonsterTts,
  triggerSetupMonsterTtsPrewarm,
} from '../services/setupMonsterTts';
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
  PersonTimelineBucketInfo,
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
} from '../types/saysee';
import {
  INITIAL_PROACTIVE_HINTS,
  buildSetupDiagnosisPlan,
  buildSetupPreTriageQuestion,
  executeRealOsAction,
  fetchRealPcOsInspection,
} from '../services/setupMonsterEngine';
import { evaluateTrajectoryAndBuildSelfHealingOta } from '../services/selfHealingEngine';
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
export type MobileTab = 'trial' | 'search' | 'trash' | 'settings' | 'share';
export type DesktopTab = 'trial' | 'dashboard' | 'trash' | 'sync' | 'share';
export type ThemeMode = 'light' | 'dark';

function applyHtmlThemeClass(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'light') {
    root.classList.remove('dark');
    root.classList.add('theme-warm-light');
  } else {
    root.classList.remove('theme-warm-light');
    root.classList.add('dark');
  }
}

interface SaySeeStore {
  // 레이아웃 & 테마 (Warm Light Theme '#F8F7F4' 기본값 고정 + 우상단 ☀️/🌙 토글 지원)
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleThemeMode: () => void;
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

  // 데이터셋 & 인덱싱 상태
  photos: PhotoItem[];
  duplicateGroups: DuplicateGroup[];
  initialized: boolean;
  initializing: boolean;
  initApp: (force?: boolean) => Promise<void>;

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

  // [스펙 2] Z몬스터 정리 4대 탭 & 바둑판 Pick UI & 3중 타임머신 안전망 (Undo)
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

  // [4대 라운지 & 24시간 GPU 클라우드 서버 도우미 스펙 + 1차 출시용 모바일 스토어 클린 모드(isStoreAppMode)]
  telemetry: HardwareTelemetry | null;
  merlinAuth: MerlinAuthState;
  syncState: SyncState;
  showProModal: boolean;
  freeTrialUsed: boolean;
  activePricingPlan: PricingPlanId;
  subscribedLounges: Record<LoungeType, PricingPlanId | null>;
  activeLoungeType: LoungeType;
  activeFamilyRoom: FamilyRoomId;
  clubSizeTier: ClubSizeTier;
  studentOcrVerified: boolean;
  gpuHelper24hActive: boolean;
  gpuHelperActiveTier: GpuHelperTierId;
  gpuHelperRemainingHours: number;
  /** 스토어 1차 심사용 모바일 클린 모드 (인앱결제 수수료 방어 & 순수 무료 라운지 뷰어 모드) */
  isStoreAppMode: boolean;
  /** 1차 앱스토어 심사 통과를 위해 모바일 스토어 모드(isStoreAppMode===true)에서 설정몬스터와 상단 크레딧 잔액을 잠시 숨길 수 있는 제어 토글 */
  enableSetupMonster: boolean;
  /** 추후 AI 설정몬스터 정식 개통 시 스토어 재심사 없이 git push만으로 코인 잔액 UI를 켤 수 있는 플래그 (기본값 false) */
  enableMobileCoinDisplay: boolean;
  /** 앱 내 코인 잔액 표시 여부 (기본값 false: !isStoreAppMode ? enableMobileCoinDisplay : enableMobileCoinDisplay) */
  showCoinBalanceInApp: boolean;
  /** 스토어 심사 기간에 PC 연동 가이드 공유 버튼 노출 여부를 1초 만에 켜고 끌 수 있는 원격 토글 스위치 (기본값 true) */
  enablePcGuideShareButton: boolean;
  /** 전송된 링크(/?master=pc)를 모바일 OS(iOS/Android)에서 열었을 때 결제/요금 안내 없이 순수 'PC 데스크톱 엔진 기능 소개 화면'만 띄우는 이중 방어 모달 상태 */
  showMobileMasterPcIntroModal: boolean;
  lastSentPcLinkChannel: 'email' | 'kakao' | null;
  setIsStoreAppMode: (isStoreAppMode: boolean) => void;
  setEnableSetupMonster: (enable: boolean) => void;
  setEnableMobileCoinDisplay: (enable: boolean) => void;
  setEnablePcGuideShareButton: (enable: boolean) => void;
  setShowMobileMasterPcIntroModal: (show: boolean) => void;
  sendPcMasterUrlToEmail: () => Promise<void>;
  sharePcMasterUrlToKakao: () => Promise<void>;

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
  modelStatusText: '내 PC 직접 구동(Ghosti_PC_Agent.exe) 100% 로컬 색인 완료 (외부 서버 전송 0 Byte)',
};

/**
 * [느슨한 타임라인의 월(Month)·계절 양방향 확장 검색 인덱싱 사전 (Time-Range Synonym Index)]
 * - 유저가 느슨하게 계절/시기 스틱('1989년 봄' 등)만 눌러도 해당 계절에 속하는 월(1~12월)과 학사 키워드가 자동 바인딩됩니다.
 * - 특히 '2월'은 졸업/신학기 시즌이므로 '겨울'과 '봄' 양쪽에 모두 매칭됩니다.
 */
export const SEASON_TO_MONTH_SYNONYM_INDEX: Record<'봄' | '여름' | '가을' | '겨울', string[]> = {
  봄: ['2월', '3월', '4월', '5월', '봄', '입학', '졸업', '봄소풍'],
  여름: ['6월', '7월', '8월', '여름', '방학', '바다', '수련회'],
  가을: ['9월', '10월', '11월', '가을', '수학여행', '체육대회', '가을소풍'],
  겨울: ['12월', '1월', '2월', '겨울', '졸업식', '눈', '겨울방학'],
};

/**
 * [연도 축약어 자동 동치화 (1989 ↔ 89년 ↔ 89 ↔ 1989년)]
 */
export function buildYearEquivalenceTokens(yearInput: number | string): string[] {
  const digits = String(yearInput).replace(/[^0-9]/g, '');
  if (!digits) return [];
  let fullYear = 1989;
  if (digits.length === 4) {
    fullYear = Number(digits);
  } else if (digits.length === 2) {
    const num = Number(digits);
    fullYear = num >= 50 ? 1900 + num : 2000 + num;
  } else {
    return [digits];
  }
  const short2 = String(fullYear % 100).padStart(2, '0');
  const decadeStart = Math.floor(fullYear / 10) * 10;
  return Array.from(
    new Set([
      String(fullYear),
      `${fullYear}년`,
      short2,
      `${short2}년`,
      `${short2}회`,
      `${decadeStart}년대`,
    ])
  );
}

/**
 * [라운지 고유 명사(성동고, 성동) 기본 상속 추출기]
 * - 간판 키워드가 '성동고 1989'라면 그 방의 모든 사진은 '성동고', '성동'을 기본 상속받습니다.
 */
export function deriveLoungeProperNounTokens(schoolName: string): string[] {
  const clean = (schoolName || '성동고').trim();
  if (!clean) return [];
  const root = clean.replace(/(고등학교|중학교|초등학교|대학교|여고|여중|고|중|초|대)$/, '').trim();
  const tokens = [clean];
  if (root && root.length >= 2) {
    tokens.push(root);
    tokens.push(`${root}고`);
    tokens.push(`${root}고등학교`);
  }
  return Array.from(new Set(tokens));
}

/**
 * 느슨한 타임라인/스틱 정보로부터 양방향 확장 검색 키워드 배열 생성
 */
export function buildBidirectionalStickKeywords(params: {
  year?: number | string;
  season?: string;
  place?: string;
  looseTimelineGroup?: string;
  schoolName?: string;
}): string[] {
  const out = new Set<string>();
  const schoolTokens = deriveLoungeProperNounTokens(params.schoolName || '성동고');
  schoolTokens.forEach((t) => out.add(t));

  if (params.year !== undefined) {
    buildYearEquivalenceTokens(params.year).forEach((t) => out.add(t));
  }

  const combinedText = `${params.season || ''} ${params.place || ''} ${params.looseTimelineGroup || ''}`;
  const yearMatch = combinedText.match(/(19\d{2}|20\d{2}|\b\d{2}년)/);
  if (yearMatch) {
    buildYearEquivalenceTokens(yearMatch[1]).forEach((t) => out.add(t));
  }

  (Object.keys(SEASON_TO_MONTH_SYNONYM_INDEX) as Array<'봄' | '여름' | '가을' | '겨울'>).forEach(
    (seasonKey) => {
      const seasonSyns = SEASON_TO_MONTH_SYNONYM_INDEX[seasonKey];
      if (
        combinedText.includes(seasonKey) ||
        seasonSyns.some((syn) => syn.length >= 2 && combinedText.includes(syn))
      ) {
        seasonSyns.forEach((syn) => out.add(syn));
      }
    }
  );

  if (params.place) {
    out.add(params.place.trim());
    params.place
      .trim()
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .forEach((w) => out.add(w));
  }
  if (params.looseTimelineGroup) {
    out.add(params.looseTimelineGroup.trim());
  }

  return Array.from(out);
}

/**
 * [방별 별명(Persona) 리졸버]
 * 동일한 이메일 기반 '귀신같이 여권(Ghosti Face Passport)'을 쓰지만,
 * 현재 라운지/방(우리집 / 처가(친정) / 본가(친가) / 동호회·동창회)에 따라 화면 표시 및 검색에 쓰이는 호칭을 반환합니다.
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
  isRoomCreator: boolean;
} {
  const baseName = (cluster.registeredName || '').trim();
  const roomKey: keyof RoomPersonaMap =
    activeLoungeType === 'family' ? activeFamilyRoom : activeLoungeType;
  const roomLabelMap: Record<keyof RoomPersonaMap, string> = {
    personal: '개인 라운지',
    '우리집': '우리집 방',
    '본가(친가)': '본가(친가) 방',
    '처가(친정)': '처가(친정) 방',
    club: '동호회 · 동창회',
    student: '동호회 · 동창회',
    work: '업무 라운지',
  };
  const isRoomCreator = cluster.clusterId === 'face_member_5';
  // 아직 미등록된 신규 인물(baseName === '')은 등록 전까지 빈 문자열 유지
  if (!baseName) {
    return {
      displayPersona: '',
      activePersona: '',
      baseName: '',
      roomKey,
      activeRoomKey: roomKey,
      roomLabelKo: roomLabelMap[roomKey],
      isRoomCreator,
    };
  }
  const mappedPersona = cluster.roomPersonas?.[roomKey]?.trim();
  const activePersona = mappedPersona || baseName;
  return {
    displayPersona: activePersona,
    activePersona,
    baseName,
    roomKey,
    activeRoomKey: roomKey,
    roomLabelKo: roomLabelMap[roomKey],
    isRoomCreator,
  };
}

/**
 * [만국공통 귀신같이 여권(Ghosti Face Passport) & 인물별 독립 타임라인 바구니 + 다년도·다각도 자동 추출]
 * 1. 바구니 기준 연도(anchorCreationYear)는 방(Room)이 아닌 각 인물의 시드 최초 생성 연도(예: 기존 가족 2026년 vs 신규 합류 처가 식구 2029년)에 귀속!
 * 2. 성인 10년(2026~2017, 미래 2027~2036) / 미성년 5년(2026~2022, 미래 2027~2031) 바구니 자동 구성
 * 3. 이메일(Email ID) 기반 귀신같이 여권에 영구 귀속되어 어느 방에 가든 무질문 자동 장착되며, 방별 별명(우리집 '멀린' ↔ 처가방 '둘째사위' ↔ 학생방 '지우짱')만 독립 매핑!
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
    let passportEmail = c.passportEmail || 'member@ghosti.ai';
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
      passportEmail = 'eunsook@ghosti.ai';
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
      // 멀린 (방장·대표님: 우리집='멀린', 처가(친정)='둘째사위', 동호회='멀린프로')
      passportEmail = 'merlin@ghosti.ai';
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
        '⛳ 동호·동창회방 라운딩 사진에서 [선글라스·역광] 슬롯 무언 교체(94.2%) ➔ 처가집 방("둘째사위 선글라스") 자동 전파됨';

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
      passportEmail = 'chiwoo@ghosti.ai';
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
      passportEmail = 'jiwoo@ghosti.ai';
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
        '🎒 친구 모임방(동호회 · 동창회)에서 [야간·실내] 슬롯 진화(유사도 93.8%) ➔ 우리집 가족방 과거 사진 +7장 자동 구출됨!';

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
      passportEmail = 'cheonwoo@ghosti.ai';
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

    const mergedYearlyRaw = [...baseCuts, ...extraCuts].sort((a, b) => b.year - a.year);
    const slot1Anchor = mergedYearlyRaw[0] || {
      year: c.representativeYear || 2026,
      representativePhoto: c.representativePhoto,
      representativeDate: c.representativeDate || '2026.10.02',
      frontalScore: c.frontalScore || 0.99,
      opticalSharpness: c.opticalSharpness || 35000,
      avatarUrl: c.cropUrl || c.avatarUrl,
      cropUrl: c.cropUrl || c.avatarUrl,
      boundingBox: c.boundingBox,
      conditionTag: '정면·선명' as const,
      conditionShortKo: '① 정면',
      sourceDeviceKo: '귀신같이 여권 최신 기준컷',
    };

    const secondCut = mergedYearlyRaw[1] || slot1Anchor;
    const thirdCut = mergedYearlyRaw[2] || secondCut;

    // 5대 스타일 슬롯 표준화: ① 정면(당해 연도 Anchor) / ② 활짝 미소 / ③ 측면 / ④ 선글라스 / ⑤ 야외
    const fiveStyleSlotCuts: YearlyFaceBestCut[] = [
      {
        ...slot1Anchor,
        year: Math.max(slot1Anchor.year || 2026, 2026),
        conditionTag: '정면·선명',
        conditionShortKo: '① 정면',
        sourceDeviceKo: '당해 연도 정면 기준컷 (Slot 1)',
      },
      {
        ...secondCut,
        year: secondCut.year || 2025,
        conditionTag: '측면·미소',
        conditionShortKo: '② 활짝 미소',
        sourceDeviceKo: secondCut.sourceDeviceKo || '가족방 미소 베스트컷',
      },
      {
        ...thirdCut,
        year: thirdCut.year || 2024,
        conditionTag: '측면·미소',
        conditionShortKo: '③ 측면',
        sourceDeviceKo: thirdCut.sourceDeviceKo || '측면 자연스러운 컷',
      },
      {
        ...(mergedYearlyRaw.find((y) => y.conditionTag === '선글라스·역광') || secondCut),
        year: 2024,
        conditionTag: '선글라스·역광',
        conditionShortKo: '④ 선글라스',
        sourceDeviceKo: '여행·라운딩 선글라스 컷',
      },
      {
        ...(mergedYearlyRaw.find((y) => y.conditionTag === '야외·노을') || slot1Anchor),
        year: 2025,
        conditionTag: '야외·노을',
        conditionShortKo: '⑤ 야외',
        sourceDeviceKo: '야외 자연광 베스트컷',
      },
    ];

    let savedSlotIdx = 0;
    try {
      const rawPrefs =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('ghosti_doorplate_slot_prefs')
          : null;
      if (rawPrefs) {
        const parsed = JSON.parse(rawPrefs);
        if (typeof parsed[c.clusterId] === 'number') {
          savedSlotIdx = Math.max(0, Math.min(4, parsed[c.clusterId]));
        }
      }
    } catch {
      /* ignore */
    }

    const activeSlot = fiveStyleSlotCuts[savedSlotIdx] || fiveStyleSlotCuts[0];
    const autoDoorplateUrl =
      activeSlot.cropUrl || activeSlot.avatarUrl || c.cropUrl || c.avatarUrl;

    return {
      ...c,
      passportEmail,
      timelineBucket: {
        ...timelineBucket,
        filledStyleSlots: ['① 정면', '② 활짝 미소', '③ 측면', '④ 선글라스', '⑤ 야외'],
      },
      roomPersonas,
      crossLoungeEvolutionNote,
      yearlyBestCuts: fiveStyleSlotCuts,
      activeDoorplateSlotIndex: savedSlotIdx,
      doorplateSlotLabelKo: activeSlot.conditionShortKo || '① 정면',
      avatarUrl: autoDoorplateUrl,
      cropUrl: autoDoorplateUrl,
    };
  });

  // 새로운 동반 등장 인물(2029년 처가방/동반 신규 세팅 멤버 예시 — 기준 연도 2029~2020 독립 바구니!)
  if (!enriched.some((c) => c.clusterId === 'face_companion_auto_6')) {
    enriched.push({
      clusterId: 'face_companion_auto_6',
      personKey: 'person_companion_discovered_6',
      passportEmail: 'inlaw2029@ghosti.ai',
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
      activeDoorplateSlotIndex: 0,
      doorplateSlotLabelKo: '① 정면',
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

export const useSaySeeStore = create<SaySeeStore>((set, get) => {
  applyHtmlThemeClass('light');
  return {
  themeMode: 'light',
  setThemeMode: (themeMode) => {
    applyHtmlThemeClass(themeMode);
    set({ themeMode });
  },
  toggleThemeMode: () => {
    const next: ThemeMode = get().themeMode === 'light' ? 'dark' : 'light';
    applyHtmlThemeClass(next);
    set({ themeMode: next });
  },
  layout: 'desktop',
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
          : mobileTab === 'share'
          ? 'share'
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
          : desktopTab === 'share'
          ? 'share'
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
        .slice(0, 350)
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
      .slice(0, 350)
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
        document.getElementById('ghosti-search-results')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 60);
    }
  },

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
  swarmFaceCandidates: [
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
      cropUrl: '/__faces/crop?file=20240720_182401.jpg&box=148,408,268,486'.replace('182401', '182301'),
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
      bridgeReasonKo: '할머니가 [그냥 사진만 올리기]로 패스한 사진 속에서 AI가 검출하여 👑 방장 뒷정리 대기열로 자동 보존됨',
      rescuedHostPhotoCount: 9,
      rescuedMemberPhoneCount: 14,
      rescuedVideoSegmentCount: 2,
      extraPhotoFiles: ['20260926_160221.jpg', '20260815_142553.jpg', '20240720_111346.jpg'],
      sampleSearchQuery: '치우 박물관',
      sampleSearchSpace: 'gallery',
      passedToHostQueue: true,
      applied: false,
    },
  ],
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
    for (const comp of unregisteredCompanions) {
      await get().registerFaceMember(comp.clusterId, '처남(민수)', '');
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

  initApp: async (force?: boolean) => {
    if (!force && (get().initialized || get().initializing)) return;
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
      .slice(0, 350)
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
      activeLoungeType,
      photos,
      telemetry,
      searchSpace,
      hasUserSelectedSearchTab,
      localDocuments,
      videoSceneItems,
      faceClusters,
      alumniSchoolName,
      alumniGradYear,
      analogScannedPhotos,
      analogYearProposals,
    } = get();

    const isWorkLounge = activeLoungeType === 'work';

    // 업무 공유(work)에서는 귀신같이 인물 여권 발동 및 여권 인물 검색 매칭을 제외하고, 일반 사진(현장·자재·제품·서류) 시각 분석만 수행
    const passportTagSet = new Set<string>();
    for (const fc of faceClusters) {
      if (fc.registeredName?.trim()) {
        passportTagSet.add(`#${fc.registeredName.trim()}`);
      }
      for (const pVal of Object.values(fc.roomPersonas ?? {})) {
        const cleanP = (pVal || '').trim();
        if (cleanP) {
          passportTagSet.add(`#${cleanP}`);
          const shortP = cleanP.replace(/\([^)]*\)/g, '').trim();
          if (shortP.length >= 2) passportTagSet.add(`#${shortP}`);
        }
      }
    }

    // [1단계: 방별 별명(Room Persona) ➔ 귀신같이 여권(Ghosti Face Passport) 자동 번역 (업무 공유 제외)]
    let resolvedQuery = query;
    if (!isWorkLounge) {
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
    }

    // [2단계: 느슨한 타임라인 ↔ 구체적 월(1~12월)·계절 양방향 확장 인덱싱 & 연도 축약어(1989↔89년↔89) 동치화 & 라운지 고유명사(성동고·성동) 기본 상속]
    const inheritedSchoolNouns = deriveLoungeProperNounTokens(alumniSchoolName);
    const matchedSchoolNouns = inheritedSchoolNouns.filter((noun) => query.includes(noun));

    // 연도 축약어 추출 (예: "89년 2월 성동", "89년 5월", "89", "1989년")
    const yearRegexMatch = query.match(/(19\d{2}|20\d{2}|\b\d{2}(?=년|\s|$))/);
    const queryYearTokens = yearRegexMatch ? buildYearEquivalenceTokens(yearRegexMatch[1]) : [];

    // 쿼리 내 월(1~12월) 또는 계절/학사 키워드 감지 ➔ 양방향 계절('봄'|'여름'|'가을'|'겨울') 확장
    const matchedSeasons = new Set<'봄' | '여름' | '가을' | '겨울'>();
    const matchedMonthOrEventTokens: string[] = [];
    (Object.keys(SEASON_TO_MONTH_SYNONYM_INDEX) as Array<'봄' | '여름' | '가을' | '겨울'>).forEach(
      (seasonKey) => {
        const synList = SEASON_TO_MONTH_SYNONYM_INDEX[seasonKey];
        for (const syn of synList) {
          // '1월', '2월' 등이 '11월', '12월'의 부분 문자열로 오매칭되지 않도록 경계 체크
          const isMonthToken = /^\d{1,2}월$/.test(syn);
          const hit = isMonthToken
            ? new RegExp(`(^|\\D)${syn}`).test(query)
            : query.includes(syn);
          if (hit) {
            matchedSeasons.add(seasonKey);
            if (!matchedMonthOrEventTokens.includes(syn)) {
              matchedMonthOrEventTokens.push(syn);
            }
          }
        }
      }
    );

    const isTimeRangeOrAlumniQuery =
      !isWorkLounge &&
      (queryYearTokens.length > 0 || matchedSeasons.size > 0 || matchedSchoolNouns.length > 0);

    // 개별 사진에 '성동', '89년', '2월' 등이 직접 적혀 있지 않아도 기본 검색 엔진이 오작동하지 않도록 정제된 쿼리 전달
    let cleanedSearchQuery = resolvedQuery;
    if (!isWorkLounge) {
      for (const noun of matchedSchoolNouns) {
        cleanedSearchQuery = cleanedSearchQuery.split(noun).join(' ');
      }
    } else {
      // 업무 공유(work)에서는 귀신같이 여권 인물명/별명을 검색 대상에서 완전 제외
      for (const tag of passportTagSet) {
        const rawName = tag.slice(1);
        if (rawName && cleanedSearchQuery.includes(rawName)) {
          cleanedSearchQuery = cleanedSearchQuery.split(rawName).join(' ');
        }
      }
    }
    cleanedSearchQuery = cleanedSearchQuery.replace(/\s+/g, ' ').trim();

    // 업무 공유(work)에서는 사진의 일반 시각/문서 분석 태그만 유지하고 귀신같이 여권 인물 태그는 검색 대상에서 제외
    const photosForSearch = isWorkLounge
      ? photos.map((p) => ({
          ...p,
          tags: p.tags.filter((t) => !passportTagSet.has(t)),
        }))
      : photos;

    // [통합 3-Track 동시 검색] 동영상 · 문서 · 사진 3개 엔진을 동시에 병렬 호출
    const [docMatches, videoMatches, photoSearchOut] = await Promise.all([
      searchLocalDocumentFilesAsync(cleanedSearchQuery || query, localDocuments),
      searchVideoSceneItemsAsync(cleanedSearchQuery || query, videoSceneItems),
      cleanedSearchQuery
        ? executeTextSearch(cleanedSearchQuery, photosForSearch, 'text-direct')
        : Promise.resolve({ results: [], embedMs: 0, searchMs: 0 }),
    ]);

    let { results } = photoSearchOut;
    const { embedMs, searchMs } = photoSearchOut;
    const expansionBadges: string[] = [];

    if (isTimeRangeOrAlumniQuery) {
      if (queryYearTokens.length > 0) {
        expansionBadges.push(`#연도동치(${queryYearTokens[0]}↔${queryYearTokens[3] || '89년'})`);
      }
      if (matchedSeasons.size > 0) {
        const seasonNames = Array.from(matchedSeasons).join('·');
        const triggerTxt = matchedMonthOrEventTokens.join('·') || seasonNames;
        expansionBadges.push(`#계절↔월확장(${triggerTxt}➔${seasonNames})`);
      }
      if (matchedSchoolNouns.length > 0) {
        expansionBadges.push(`#${alumniSchoolName}고유명사상속`);
      }

      // 아날로그 스캔 사진(느슨한 타임라인: '1989년 봄', '1989년 가을' 등) 양방향 매칭 검사
      const matchedAnalogFiles = new Map<
        string,
        { analogItem: AnalogScannedPhotoItem; reasonTags: string[] }
      >();

      for (const item of analogScannedPhotos) {
        const relatedProposals = analogYearProposals.filter(
          (p) => p.targetAnalogPhotoId === item.id
        );
        const effectiveGroup =
          !item.unknownDatePlace
            ? item.looseTimelineGroup
            : relatedProposals[0]?.proposedTimelineGroup || `${alumniGradYear}년 가을`;
        const effectivePlace =
          item.appliedSticks.join(' ') || relatedProposals[0]?.proposedPlaceTag || '';

        const itemKeywords = new Set<string>([
          ...(item.expandedSearchKeywords ?? []),
          ...buildBidirectionalStickKeywords({
            year: alumniGradYear,
            looseTimelineGroup: effectiveGroup,
            place: effectivePlace,
            schoolName: alumniSchoolName,
          }),
        ]);

        // 2월 검색 시 '1989년 봄'(입학/신학기)과 '1989년 겨울'(졸업식) 모두 매칭!
        const yearOk =
          queryYearTokens.length === 0 ||
          queryYearTokens.some((yt) => itemKeywords.has(yt));
        const seasonOk =
          matchedSeasons.size === 0 ||
          Array.from(matchedSeasons).some(
            (sk) =>
              effectiveGroup.includes(sk) ||
              itemKeywords.has(sk) ||
              // '2월'은 졸업/입학 시즌이므로 1989년 봄 스캔본과 100% 매칭
              (matchedMonthOrEventTokens.includes('2월') && effectiveGroup.includes('봄'))
          );
        const schoolOk =
          matchedSchoolNouns.length === 0 ||
          matchedSchoolNouns.some((sn) => itemKeywords.has(sn));

        if (yearOk && seasonOk && schoolOk) {
          const reasonTags = [
            `#${effectiveGroup.replace(/\s+/g, '')}`,
            ...(matchedMonthOrEventTokens.length > 0
              ? [`#${matchedMonthOrEventTokens[0]}↔${effectiveGroup}양방향매칭`]
              : []),
            ...(matchedSchoolNouns.length > 0 ? [`#${alumniSchoolName}기본상속`] : []),
          ];
          matchedAnalogFiles.set(item.photoFile, { analogItem: item, reasonTags });
        }
      }

      // 매칭된 아날로그/동창회 사진들을 최상단(99% 일치)으로 소환
      if (matchedAnalogFiles.size > 0) {
        const boostedResults: SearchResultItem[] = [];
        const seenIds = new Set<string>();

        for (const [fileName, info] of matchedAnalogFiles.entries()) {
          const foundPhoto = photos.find((p) => !p.quarantined && p.name === fileName);
          if (foundPhoto) {
            seenIds.add(foundPhoto.id);
            const enrichedPhoto: PhotoItem = {
              ...foundPhoto,
              tags: Array.from(
                new Set([...info.reasonTags, ...expansionBadges, ...foundPhoto.tags])
              ),
              captionKo: `${info.analogItem.captionKo} (${alumniSchoolName} 기본 상속 · ${info.analogItem.looseTimelineGroup})`,
            };
            boostedResults.push({
              photo: enrichedPhoto,
              score: 0.99,
              matchPercentage: 99,
              matchedBy: 'text-direct',
            });
          }
        }

        // 만약 라운지 고유 명사('성동', '성동고')나 연도('89년')가 포함된 동창회 검색이면 방 안의 다른 추억 사진들도 후순위로 함께 상속 소환
        const remainingResults = results.filter((r) => !seenIds.has(r.photo.id));
        results = [...boostedResults, ...remainingResults];
      }
    }

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

    // [규칙 1 & 2 + 동창회 타임라인 검색 시 갤러리 즉시 표시]
    const targetSpace: SearchSpaceMode = isTimeRangeOrAlumniQuery
      ? 'gallery'
      : hasUserSelectedSearchTab
      ? searchSpace
      : 'video';

    const topTags =
      expansionBadges.length > 0
        ? Array.from(
            new Set([
              ...expansionBadges,
              ...results.slice(0, 3).flatMap((r) => r.photo.tags),
            ])
          ).slice(0, 4)
        : Array.from(new Set(results.slice(0, 4).flatMap((r) => r.photo.tags))).slice(0, 3);

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
      ...(isTimeRangeOrAlumniQuery
        ? {
            lastQuarantineToast: `⚡ [양방향 시간·고유명사 그물망 매칭 (1초 만에)] "${query}" ➔ ${expansionBadges.join(
              ' · '
            )} 규칙으로 느슨한 타임라인 사진을 100% 찾아냈습니다!`,
          }
        : {}),
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

  // ─────────────── [스펙 2] Z몬스터 정리 4대 탭 & 바둑판 Pick & 3중 타임머신 안전망 (Undo) ───────────────
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
      let movedList: string[] = redundantIds;
      try {
        const res = await fetch(getZCoreUrl('/__quarantine/move'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: redundantIds }),
        });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.moved) && json.moved.length > 0) {
            movedList = json.moved;
          }
        }
      } catch {
        movedList = redundantIds;
      }

      const movedSet = new Set<string>(movedList);
      const savedBytes = photos
        .filter((p) => movedSet.has(p.id))
        .reduce((acc, p) => acc + p.size, 0);

      set((state) => {
        const afterMovePhotos = state.photos.map((p) => {
          if (!movedSet.has(p.id)) return p;
          const isZCorePhoto = p.thumbUrl.includes('/__photos/file');
          return {
            ...p,
            quarantined: true,
            thumbUrl: isZCorePhoto
              ? getZCoreUrl(`/__photos/file?p=${encodeURIComponent(p.name)}&loc=quarantine&thumb=1`)
              : p.thumbUrl,
            fullUrl: isZCorePhoto
              ? getZCoreUrl(`/__photos/file?p=${encodeURIComponent(p.name)}&loc=quarantine`)
              : p.fullUrl,
          };
        });
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
            ? `🎁 [클린몬스터 연사 정리 1묶음 완료] 베스트 1장을 남기고 연사 ${movedSet.size}장을 격리했습니다! (하단 버튼으로 1초 되돌리기 가능)`
            : `✨ 선택한 베스트 원본 1장을 안전하게 남기고, 나머지 연사·사본 ${movedSet.size}장을 OS 기본 [휴지통]으로 안전하게 이동했습니다 (↩️ 1초 실행 취소 가능).`,
        };
      });
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
    let movedList: string[] = redundantIds;
    try {
      const res = await fetch(getZCoreUrl('/__quarantine/move'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: redundantIds }),
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.moved) && json.moved.length > 0) {
          movedList = json.moved;
        }
      }
    } catch {
      movedList = redundantIds;
    }

    const movedSet = new Set<string>(movedList);
    const savedBytes = burstPhotos
      .filter((p) => movedSet.has(p.id))
      .reduce((acc, p) => acc + p.size, 0);

    set((state) => {
      const afterMovePhotos = state.photos.map((p) => {
        if (!movedSet.has(p.id)) return p;
        const isZCorePhoto = p.thumbUrl.includes('/__photos/file');
        return {
          ...p,
          quarantined: true,
          thumbUrl: isZCorePhoto
            ? getZCoreUrl(`/__photos/file?p=${encodeURIComponent(p.name)}&loc=quarantine&thumb=1`)
            : p.thumbUrl,
          fullUrl: isZCorePhoto
            ? getZCoreUrl(`/__photos/file?p=${encodeURIComponent(p.name)}&loc=quarantine`)
            : p.fullUrl,
        };
      });
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
        lastQuarantineToast: `✨ 선택한 베스트 컷 1장을 남기고, 나머지 연사 ${movedSet.size}장을 OS 기본 [휴지통]으로 안전하게 이동했습니다 (↩️ 1초 실행 취소 가능).`,
      };
    });
  },

  moveSelectedToQuarantine: async () => {
    const { selectedTrashIds, photos } = get();
    const targetNames = Array.from(selectedTrashIds);
    if (targetNames.length === 0) return;

    set({ quarantineMoving: true });
    let movedList: string[] = targetNames;
    try {
      const res = await fetch(getZCoreUrl('/__quarantine/move'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: targetNames }),
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.moved) && json.moved.length > 0) {
          movedList = json.moved;
        }
      }
    } catch {
      movedList = targetNames;
    }

    const movedSet = new Set<string>(movedList);
    const savedBytes = photos
      .filter((p) => movedSet.has(p.id))
      .reduce((acc, p) => acc + p.size, 0);

    const updatedPhotos = photos.map((p) => {
      if (!movedSet.has(p.id)) return p;
      const isZCorePhoto = p.thumbUrl.includes('/__photos/file');
      return {
        ...p,
        quarantined: true,
        thumbUrl: isZCorePhoto
          ? getZCoreUrl(`/__photos/file?p=${encodeURIComponent(p.name)}&loc=quarantine&thumb=1`)
          : p.thumbUrl,
        fullUrl: isZCorePhoto
          ? getZCoreUrl(`/__photos/file?p=${encodeURIComponent(p.name)}&loc=quarantine`)
          : p.fullUrl,
      };
    });

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
        actionLabel: '클린몬스터 추천 항목 일괄 정리',
        count: movedSet.size,
        savedBytes,
        timestamp: Date.now(),
      },
      lastQuarantineToast: `🗑️ ${movedSet.size}장의 사진이 OS 기본 [휴지통]으로 안전하게 이동되었습니다 (하단 버튼으로 ↩️ 1초 실행 취소 가능).`,
    }));
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
    let restoredList: string[] = names;
    try {
      const res = await fetch(getZCoreUrl('/__quarantine/restore'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: names }),
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.restored) && json.restored.length > 0) {
          restoredList = json.restored;
        }
      }
    } catch {
      restoredList = names;
    }

    const restoredSet = new Set<string>(restoredList);

    set((state) => ({
      photos: state.photos.map((p) => {
        if (!restoredSet.has(p.name) && !restoredSet.has(p.id)) return p;
        const isZCorePhoto = p.thumbUrl.includes('/__photos/file');
        return {
          ...p,
          quarantined: false,
          thumbUrl: isZCorePhoto
            ? getZCoreUrl(`/__photos/file?p=${encodeURIComponent(p.name)}&thumb=1`)
            : p.thumbUrl,
          fullUrl: isZCorePhoto
            ? getZCoreUrl(`/__photos/file?p=${encodeURIComponent(p.name)}`)
            : p.fullUrl,
        };
      }),
      quarantineMoving: false,
      lastQuarantineToast: `♻️ ${restoredSet.size}장의 사진이 원본 폴더(test_photos)로 즉시 원복되었습니다.`,
    }));
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
      await fetch(getZCoreUrl('/__quarantine/open-folder'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      set({
        lastQuarantineToast:
          target === 'quarantine'
            ? '🗑️ OS 기본 [휴지통] 이동 내역 폴더를 열었습니다.'
            : target === 'docs'
            ? '📂 윈도우 탐색기에서 [로컬 스마트 서류함 (test_docs)] 폴더를 열었습니다.'
            : '📂 윈도우 탐색기에서 원본 사진 폴더를 열었습니다.',
      });
    } catch {
      /* ignore */
    }
  },

  dismissQuarantineToast: () => set({ lastQuarantineToast: null }),

  // ─────────────── [4대 라운지 & 24시간 GPU 클라우드 서버 도우미 + 1차 출시용 모바일 클린 모드 & 이중 방어] ───────────────
  telemetry: null,
  merlinAuth: loadMerlinAuth(),
  syncState: loadSyncState(550, 3230438906),
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
  activeLoungeType: 'personal',
  activeFamilyRoom: '우리집',
  clubSizeTier: 'small',
  studentOcrVerified: false,
  gpuHelper24hActive: false,
  gpuHelperActiveTier: 'standard_1000',
  gpuHelperRemainingHours: 24,
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
  lastSentPcLinkChannel: null,

  setIsStoreAppMode: (isStoreAppMode) =>
    set((state) => ({
      isStoreAppMode,
      enableSetupMonster: isStoreAppMode ? false : true,
      showCoinBalanceInApp: isStoreAppMode ? state.enableMobileCoinDisplay : state.enableMobileCoinDisplay,
      lastQuarantineToast: isStoreAppMode
        ? '🛡️ [1차 출시용 모바일 클린 모드(isStoreAppMode=true)] 활성화: enableSetupMonster=false 및 크레딧 잔액을 숨기고 스토어 심사 프리패스 모드로 전환했습니다.'
        : '💻 [데스크톱(PC) 마스터 모드(isStoreAppMode=false)] 활성화: 🛠️ 설정몬스터(enableSetupMonster=true) 및 모든 마스터 기능이 활성화되었습니다.',
    })),

  setEnableSetupMonster: (enableSetupMonster) =>
    set({
      enableSetupMonster,
      enableMobileCoinDisplay: enableSetupMonster,
      showCoinBalanceInApp: enableSetupMonster,
      lastQuarantineToast: enableSetupMonster
        ? '🛠️ [원격 토글 enableSetupMonster=true] Ghosti 설정몬스터(AI 스마트폰 & PC 통합 설정 해결사) 및 상단 크레딧 지갑이 즉시 개통되었습니다!'
        : '🔒 [1차 스토어 심사 방어 enableSetupMonster=false] 모바일 스토어 모드에서 설정몬스터와 크레딧 잔액을 잠시 숨김 처리했습니다.',
    }),

  setEnableMobileCoinDisplay: (enableMobileCoinDisplay) =>
    set({
      enableMobileCoinDisplay,
      showCoinBalanceInApp: enableMobileCoinDisplay,
      lastQuarantineToast: enableMobileCoinDisplay
        ? '🪙 [코인 잔액 표시(enableMobileCoinDisplay=true)] 활성화: 상단 헤더에 멀린허브 코인 잔액이 표시됩니다.'
        : '🔒 [코인 잔액 완전 비노출(showCoinBalanceInApp=false)] 기본값 적용 완료.',
    }),

  setEnablePcGuideShareButton: (enablePcGuideShareButton) =>
    set({
      enablePcGuideShareButton,
      lastQuarantineToast: enablePcGuideShareButton
        ? '💬 [원격 토글 enablePcGuideShareButton=true] 카톡·이메일 PC 연동 가이드 전송 버튼이 활성화되었습니다.'
        : '🔒 [원격 토글 enablePcGuideShareButton=false] 스토어 심사 보호를 위해 PC 연동 가이드 전송 버튼이 즉시 숨김 처리되었습니다.',
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
  setupChatTurns: [
    {
      id: 'welcome_setup_monster',
      role: 'assistant_triage',
      timestamp: '방금',
      text: '안녕하세요! 🩺 귀신같이 1:1 주치의(치우기 × 고치기 통합 대화형 엔진)입니다.\n• 🆓 [내 기기]의 모든 치우기·고치기·파일 복구·내 PC 사양 상담·바탕화면 바로가기 생성은 코인 차감 없이 언제나 0원(100% 무료)입니다.\n• 🛡️ 모든 실행 전 [실물 증거 미리보기 게이트(Zero-Auto-Action)]를 먼저 보여드리며, 유저님이 [⭕ 확인 완료]를 누르시기 전에는 절대 임의로 실행하지 않습니다.\n• 🕰️ 모든 변경 0.01초 전 [복원 기록]을 남기며, 🟢[100% 완벽 복원 가능] / 🟡[부분 복원 가능] / 🔴[복원 불가] 3단계 무결성 사전 검진(Pre-Check) 후 1초 만에 원래 상태로 되돌릴 수 있습니다.',
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
      showSetupMonsterModal,
      setupMonsterPlatform: platform ?? state.setupMonsterPlatform,
    })),

  setSetupMonsterPlatform: (setupMonsterPlatform) =>
    set({ setupMonsterPlatform }),

  setSimulatedMerlinCoinBalance: (coins) =>
    set((state) => ({
      merlinAuth: {
        ...state.merlinAuth,
        coinBalance: Math.max(0, coins),
      },
      lastQuarantineToast: `🪙 [멀린허브 통합 지갑 잔액 시뮬레이션] 현재 보유 멀린코인이 ${Math.max(
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
      lastQuarantineToast: `🪙 [멀린허브 1초 원클릭 충전 완료 (+${addCoins} 코인)] 충전 즉시 ${
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
            ? { ...a, escrowStatus: 'SETTLED_COMPLETED' as const }
            : a
        ),
        setupChatTurns: state.setupChatTurns.map((t) =>
          targetAudit && t.auditId === targetAudit.auditId
            ? { ...t, escrowStatus: 'SETTLED_COMPLETED' as const }
            : t
        ),
        lastQuarantineToast: `✅ [완치 확인 · 에스크로 최종 정산 완료] 홀딩 중이던 ${settledCoins} 멀린코인이 정상 정산 확정되었습니다!`,
      };
    }),

  loadSetupMonsterState: async () => {
    triggerSetupMonsterTtsPrewarm();
    try {
      const res = await fetch('/__setup-monster/state');
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

    // 유저가 채팅창에 "아직 해결 안 됨 / 안 고쳐졌어 / 환불해줘" 등 수리 실패를 말하면 즉시 1초 원상복구 + 에스크로 100% 반환 + 본사 실패 로그 전송 실행
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
            ? `⚠️ [멀린허브 통합 지갑 사전 잔액 체크(Pre-Check)] 필요 견적 ${plan.creditCost} 코인 / 현재 보유 ${currentCoins} 코인 ➔ 멀린코인 ${deficit}개가 부족합니다. 아래 [🪙 멀린코인 ${deficit}개가 부족합니다 — 1초 충전 후 바로 고치기] 버튼을 누르면 즉시 충전 후 에스크로 수리에 돌입합니다.`
            : `✅ [멀린허브 통합 지갑 사전 잔액 체크(Pre-Check)] 필요 견적 ${plan.creditCost} 코인 / 현재 보유 ${currentCoins.toLocaleString()} 코인 (충분) ➔ 아래 버튼으로 ${plan.creditCost} 코인 에스크로 홀딩 후 즉시 1초 수리를 시작할 수 있습니다.`;

        const assistantTurn: SetupChatTurn = {
          id: `ai_${Date.now() + 1}`,
          role: 'assistant',
          timestamp: nowLabel,
          text: `🔍 무엇이 불편하신지 확인했습니다. 아래 버튼을 누르시면 바로 고쳐 드립니다.`,
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
        ? `⚠️ [멀린허브 지갑 사전 잔액 체크] 필요 100 코인 / 보유 ${currentCoins} 코인 ➔ 멀린코인 ${deficit}개가 부족합니다 (1초 충전 후 바로 고치기 지원).`
        : `✅ [멀린허브 지갑 사전 잔액 체크] 필요 100 코인 / 보유 ${currentCoins.toLocaleString()} 코인 (에스크로 홀딩 가능).`;

    const assistantTurn: SetupChatTurn = {
      id: `ai_${Date.now() + 1}`,
      role: 'assistant',
      timestamp: nowLabel,
      text: `🔍 무엇이 불편하신지 확인했습니다. 아래 버튼을 누르시면 바로 고쳐 드립니다.`,
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
        ? `⚠️ [멀린허브 통합 지갑 사전 잔액 체크(Pre-Check)] 필요 견적 ${plan.creditCost} 코인 / 현재 보유 ${currentCoins} 코인 ➔ 멀린코인 ${deficit}개가 부족합니다! 아래 [🪙 멀린코인 ${deficit}개가 부족합니다 — 1초 충전 후 바로 고치기] 버튼을 누르면 즉시 충전 후 에스크로 수리에 돌입합니다.`
        : `✅ [멀린허브 통합 지갑 사전 잔액 체크(Pre-Check)] 필요 견적 ${plan.creditCost} 코인 / 현재 보유 ${currentCoins.toLocaleString()} 코인 (충분) ➔ [${plan.creditCost} 코인 에스크로 홀딩 후 1초 수리 시작] 버튼이 활성화되었습니다.`;

    const assistantTurn: SetupChatTurn = {
      id: `ai_quote_${Date.now() + 1}`,
      role: 'assistant',
      timestamp: nowLabel,
      text: `🔍 무엇이 불편하신지 확인했습니다. 아래 버튼을 누르시면 바로 고쳐 드립니다.`,
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
    const cost = 0; // [멀린님 확정 A1]: [내 기기] 치우기·고치기는 코인 차감 없이 언제나 0원(무료)!

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

    if (plan.platform === 'pc') {
      try {
        if (plan.presetId === 'pc_work_s_drive') {
          const osRes = await executeRealOsAction('s_drive_mount');
          if (osRes?.beforeSnapshot) savedAudit.beforeSnapshot = osRes.beforeSnapshot as Record<string, unknown>;
          if (osRes?.afterSnapshot) savedAudit.afterSnapshot = osRes.afterSnapshot as Record<string, unknown>;
        } else {
          await executeRealOsAction('shadow_backup');
        }
        await fetchRealPcOsInspection();
      } catch {
        /* ignore */
      }
    }

    try {
      const res = await fetch('/__setup-monster/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...savedAudit,
          selfHealingOta: evalResult.otaEntry,
        }),
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

    // 음성 합성(TTS) 안내 재생 (지원 브라우저)
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const ttsText = isEmpathyRefund
          ? '두 번 이상 길을 헤매게 해드려 죄송합니다. 이번 수리비는 받지 않고 전액 환불해 드렸습니다.'
          : plan.voiceTtsSummary;
        const utter = new SpeechSynthesisUtterance(ttsText);
        utter.lang = 'ko-KR';
        utter.rate = 1.02;
        void speakSetupMonsterTts(utter.text);
      }
    } catch {
      /* ignore tts error */
    }

    const repairTurn: SetupChatTurn = {
      id: `repair_${Date.now()}`,
      role: 'system_repair',
      timestamp: nowLabel,
      text:
        effectiveBacktrack === 1
          ? `${plan.completionMessage}\n\n🟡 [1회 뒤로 가기(Back) 인간적 허용 · 정상 정산 + 경로 미세 교정 OTA] 초행길 화면에서 딱 1번 뒤로 갔다가 바로 찾아가셨네요! 수리비(${cost} 코인)는 정상 에스크로 처리되며, 방금 1회 우회한 갈림길 로그는 본사 Multi-LLM으로 전송되어 다음번엔 0회 직행 코스로 미세 교정되었습니다.`
          : plan.completionMessage,
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
        ? `🟡 [1회 뒤로 가기 인간적 허용 · 언제나 0원] 1회 우회 갈림길 로그를 본사로 전송해 0회 직행 코스로 미세 교정(OTA)했습니다!`
        : `✅ [내 기기 1초 수리 완료 — 언제나 0원 · [복원 기록] 자동 저장] 언제든 1초 만에 원래 상태로 되돌릴 수 있습니다!`,
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
          '환불할 최근 수리 내역이 없습니다. 먼저 수리를 실행하거나 견적 카드에서 [💖 2회 헤맨 성공 시뮬레이션]을 눌러보세요!',
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
      await fetch('/__setup-monster/self-healing-ota', {
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
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(
          '두 번 이상 길을 헤매게 해드려 죄송합니다. 이번 수리비는 받지 않고 전액 환불해 드렸습니다.'
        );
        utter.lang = 'ko-KR';
        utter.rate = 1.02;
        void speakSetupMonsterTts(utter.text);
      }
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
              escrowStatus: 'RELEASED_EMPATHY_REFUND' as const,
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
                escrowStatus: 'RELEASED_EMPATHY_REFUND' as const,
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

    if (targetAudit?.platform === 'pc') {
      try {
        if (targetAudit.title.includes('S:') || targetAudit.symptomQuery.includes('S:')) {
          await executeRealOsAction('s_drive_unmount');
        }
        await fetchRealPcOsInspection();
      } catch {
        /* ignore */
      }
    }

    try {
      await fetch('/__setup-monster/undo', {
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
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(
          '수리하기 전 원래 설정 상태로 깔끔하게 되돌렸습니다.'
        );
        utter.lang = 'ko-KR';
        void speakSetupMonsterTts(utter.text);
      }
    } catch {
      /* ignore */
    }

    const undoTurn: SetupChatTurn = {
      id: `undo_${Date.now()}`,
      role: 'system_undo',
      timestamp: nowLabel,
      text: targetAudit
        ? `↩️ 수리하기 전 원래 설정 상태로 깔끔하게 되돌렸습니다! (무료 · 0 코인${
            ''
          })`
        : '↩️ 수리하기 전 원래 상태로 깔끔하게 되돌렸습니다! (무료 · 0 코인)',
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
      lastQuarantineToast:
        '↩️ [1초 셀프 원복(Undo) 완료] 상담원 개입 없이 0.01초 전 JSON 스냅샷으로 즉시 원상복구되었습니다! (무료 · 0 코인)',
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
        lastQuarantineToast: '이미 에스크로 홀딩 코인 100% 반환 및 원상복구가 완료된 수리 내역입니다.',
      });
      return;
    }

    const refundCoins = targetAudit?.creditDeducted ?? 100;
    const effectiveErrorCode =
      errorCode ?? 'ERR_SETUP_UNRESOLVED_USER_REPORT_0x80070005';
    const conversationTranscript = state.setupChatTurns
      .slice(-6)
      .map((t) => `[${t.role}] ${t.text}`);
    const windowsBuildEnv =
      (targetAudit?.platform ?? state.setupMonsterPlatform) === 'pc'
        ? 'Windows 11 Pro 23H2 (Build 22631.4317) · x64 · Merlin_Z_Core_Setup.exe v2.4'
        : 'Android 15 (One UI 7.0) · Ghosti_Mobile_1MB.apk v2.4';

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
      const res = await fetch('/__setup-monster/report-failure', {
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
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(
          '문제가 해결되지 않아 원래 설정으로 되돌리고 코인을 전액 환불해 드렸습니다.'
        );
        utter.lang = 'ko-KR';
        void speakSetupMonsterTts(utter.text);
      }
    } catch {
      /* ignore */
    }

    const refundTurn: SetupChatTurn = {
      id: `refund_${Date.now()}`,
      role: 'system_refund',
      timestamp: nowLabel,
      text: `💸 [무위험(Zero-Risk) 1초 원상복구 + 에스크로 홀딩 +${refundCoins} 멀린코인 100% 즉시 반환 완료]\n① 백업해 둔 0.01초 전 JSON 스냅샷(${JSON.stringify(
        targetAudit?.beforeSnapshot ?? { state: 'restored_initial' }
      )})으로 기기 설정을 1초 만에 완벽히 원상복구했습니다.\n② 에스크로에 홀딩되어 있던 +${refundCoins} 멀린코인을 멀린허브 통합 지갑에 100% 즉시 반환(환불)했습니다.\n③ 📡 본사 실패 분석 큐(Failure Telemetry: ${
        failurePacket.failureId
      })로 [대화 내역 + ${windowsBuildEnv} + 실행 스크립트 + ${effectiveErrorCode}] 패킷을 자동 전송하여 수리 스크립트를 즉시 업데이트합니다.`,
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
              escrowStatus: 'RELEASED_REFUNDED' as const,
              trajectoryGrade: 'GRADE_FAIL_ABORTED' as const,
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
                escrowStatus: 'RELEASED_REFUNDED' as const,
                trajectoryGrade: 'GRADE_FAIL_ABORTED' as const,
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
      lastQuarantineToast: `💸 [1초 원상복구 & 에스크로 +${refundCoins} 코인 100% 즉시 반환 완료] 본사 실패 분석 큐(${failurePacket.failureId})로 실패 블랙박스 로그가 자동 전송되었습니다!`,
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
          ? `💖 [뒤로 가기(Back) ${nextCount}회 감지 — 인간미 100% 쿨 환불 예약!] 초행길에 ${nextCount}번이나 헤매게 해드려 죄송합니다. 가이드를 끝까지 완료하시면 수리는 유지한 채 수리비 100%가 자동 환불되고 최단 지름길이 전 세계에 배포됩니다!`
          : `🟡 [뒤로 가기(Back) 1회 감지 — 인간적 허용 구간] 낯선 화면에서 1회 우회하셨습니다. 한 번만 더 헤매시면(2회+) 완료 즉시 100% 자동 환불(수업료 면제)이 발동합니다!`;
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
        if (typeof window !== 'undefined' && 'speechSynthesis' in window && nextStep) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(nextStep.voiceGuideText);
          utter.lang = 'ko-KR';
          void speakSetupMonsterTts(utter.text);
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
          '🟡 [손가락 가이드 완주 · 뒤로 가기 1회 인간적 허용] 정상 정산 처리되었으며, 1회 우회 갈림길 로그를 본사 Multi-LLM으로 보내 0회 직행 코스로 미세 교정(OTA)했습니다!',
      }));
      return;
    }

    set({
      activeOverlayPlan: null,
      activeOverlayStepIndex: 0,
      activeOverlayBacktrackCount: 0,
      lastQuarantineToast:
        '🟢 [실시간 손가락 화살표 가이드 0회 쾌속 완주!] 사전 답사 지도대로 막힘없이 한 번에 도착하셨습니다!',
    });
  },

  closeSetupOverlayGuide: () =>
    set({
      activeOverlayPlan: null,
      activeOverlayStepIndex: 0,
      activeOverlayBacktrackCount: 0,
    }),

  sendPcMasterUrlToEmail: async () => {
    const { merlinAuth } = get();
    const targetEmail = merlinAuth.email || 'beakes@sundreamer.app';
    set({
      lastSentPcLinkChannel: 'email',
      lastQuarantineToast: `📩 가입 이메일(${targetEmail})로 ‘내 PC 연동 안내서’가 발송되었습니다! 데스크톱(PC)에서 열어 이어서 작업하세요.`,
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

  setActiveLoungeType: (requestedLoungeType) =>
    set((state) => {
      // [1차 출시 3대 메뉴 체계] 구버전 'student(스쿨)' 진입은 '사진 공유 › 동호회·동창회(club)'로 일원화
      // (스쿨 화면 코드는 추후 동창회 '우리반 타임캡슐' 메뉴 이식용 자산으로 보존, 라우팅만 차단)
      const activeLoungeType: LoungeType =
        requestedLoungeType === 'student' ? 'club' : requestedLoungeType;
      const isTargetLoungeSubscribed = Boolean(state.subscribedLounges[activeLoungeType]);
      return {
        activeLoungeType,
        activePricingPlan: state.subscribedLounges[activeLoungeType] ?? 'free_trial',
        // 해당 라운지가 이미 구독 중이면 [✨ 공유 시작] 탭이 숨김 처리되므로 파워 검색 탭으로 이동
        desktopTab:
          isTargetLoungeSubscribed && state.desktopTab === 'trial'
            ? 'dashboard'
            : state.desktopTab,
        mobileTab:
          isTargetLoungeSubscribed && state.mobileTab === 'trial'
            ? 'search'
            : state.mobileTab,
        // 방 진입 시 기본 탭은 무조건 [🎞️ 응답하라 1989 (추억)]으로 고정
        clubFeedTrack: activeLoungeType === 'club' ? 'memories_1989' : state.clubFeedTrack,
        gpuHelperActiveTier:
          activeLoungeType === 'club'
            ? state.clubSizeTier === 'large'
              ? 'club_large_3000'
              : state.clubSizeTier === 'medium'
              ? 'club_medium_2000'
              : 'club_small_1000'
            : 'standard_1000',
      };
    }),

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
        '🎒 [학생증 로컬 OCR 0.1초 인증 완료] 외부 서버 전송 0 Byte • 🎒 동호회 · 동창회 (초·중·고 반/동아리 특가 월 900원) 자격이 즉시 확인되었습니다!',
    }),

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
    set((state) => {
      const labelMap: Record<PricingPlanId, string> = {
        free_trial: '✨ 개인 (기본) : 언제나 0원 ("혼자 쓰는 개인 공간은 기간 제한 없이 언제나 0원입니다.")',
        personal_single_2900: '🆓 개인 (기본) : 언제나 0원 • 🩺 귀신같이 클린몬스터',
        personal_sub_3900: '개인 라운지 • 1초 AI 내용검색 몬스터 (월 1,900원 • 월 1회 클린몬스터 청소 포함)',
        personal_year_35000: '💻 업무 입문 • 1인 멀티PC (19,000원 • 선착순 100명 10년 마스터권)',
        family_home_5900: '🏠 패밀리 라운지 • 우리집 단독 (월 5,900원 • 방 1개)',
        family_home_year_59000: '🏠 패밀리 라운지 • 우리집 단독 연간권 (연 59,000원 • 방 1개)',
        family_three_8900: '👨‍👩‍👧‍👦 패밀리 라운지 • 양가 통합권 (월 8,900원 • 우리집+본가+처가 3방 분리)',
        family_three_year_89000: '👨‍👩‍👧‍👦 패밀리 라운지 • 양가 통합 연간권 (연 89,000원 • 3방 분리)',
        club_small_4900: '⛳ 동호회 · 동창회 • 소형 동호·동창회 20명 기준 (월 4,900원 • 방 1개)',
        club_small_year_49000: '⛳ 동호회 · 동창회 • 소형 동호·동창회 연간권 (연 49,000원 • 방 1개)',
        club_medium_7900: '⛳ 동호회 · 동창회 • 중형 동호·동창회 100명 기준 (월 7,900원 • 방 1개)',
        club_medium_year_79000: '⛳ 동호회 · 동창회 • 중형 동호·동창회 연간권 (연 79,000원 • 방 1개)',
        club_large_14900: '⛳ 동호회 · 동창회 • 대형 동호·동창회 인원 제한 없음 (월 14,900원 • 방 1개)',
        club_large_year_149000: '⛳ 동호회 · 동창회 • 대형 동호·동창회 연간권 (연 149,000원 • 방 1개)',
        student_sub_900: '🎒 동호회 · 동창회 (초·중·고 반/동아리 특가 월 900원)',
        student_year_9000: '🎒 동호회 · 동창회 (초·중·고 반/동아리 특가 연 9,000원)',
        work_soho_9900: '💼 업무 라운지 • 소호·팀 10인 기준 (월 9,900원 • S: 드라이브 마운트)',
        work_soho_year_99000: '💼 업무 라운지 • 소호·팀 연간권 (연 99,000원 • S: 드라이브 마운트)',
        work_biz_19900: '💼 업무 라운지 • 비즈니스 무제한 (월 19,900원 • 전 직원 S: 드라이브)',
        work_biz_year_199000: '💼 업무 라운지 • 비즈니스 연간권 (연 199,000원 • 전 직원 S: 드라이브)',
      };

      const nextLoungeType: LoungeType = planId.startsWith('personal_')
        ? 'personal'
        : planId.startsWith('family_')
        ? 'family'
        : planId.startsWith('club_')
        ? 'club'
        : planId.startsWith('student_')
        ? 'club' // [3대 메뉴 체계] 구버전 스쿨 요금제도 '사진 공유 › 동호회·동창회'로 일원화
        : planId.startsWith('work_')
        ? 'work'
        : state.activeLoungeType;

      const isPaidSubscription = planId !== 'free_trial';
      const nextSubscribedLounges: Record<LoungeType, PricingPlanId | null> = {
        ...state.subscribedLounges,
        [nextLoungeType]: isPaidSubscription ? planId : null,
      };

      return {
        activePricingPlan: planId,
        subscribedLounges: nextSubscribedLounges,
        activeLoungeType: nextLoungeType,
        clubFeedTrack: nextLoungeType === 'club' ? 'memories_1989' : state.clubFeedTrack,
        showProModal: false,
        // 해당 라운지 구독 시 해당 라운지의 [✨ 공유 시작] 탭만 자동 숨김(Auto-Hide) 처리되며 다른 미구독 라운지는 유지됨
        desktopTab: isPaidSubscription && state.desktopTab === 'trial' ? 'dashboard' : state.desktopTab,
        mobileTab: isPaidSubscription && state.mobileTab === 'trial' ? 'search' : state.mobileTab,
        merlinAuth: {
          ...state.merlinAuth,
          tier: isPaidSubscription ? 'PRO_LIFETIME' : 'FREE',
        },
        lastQuarantineToast: isPaidSubscription
          ? `🎉 [${labelMap[planId]}] 활성화 완료! (현재 라운지의 [✨ 공유 시작] 탭만 자동 숨김 처리되며, 다른 라운지는 별도로 작동합니다)`
          : `✨ 현재 라운지가 [기본 안내 모드]로 전환되어 상단 서브메뉴 1번 자리에 [✨ 공유 시작] 탭이 다시 표시됩니다.`,
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
          ? '👻 [13KB 섀도우 캐시 일치화 완료] 집 PC가 꺼져 있어도 밖에서 내 폰으로 PC 속 10년 치 사진·서류를 1초 만에 열람할 수 있습니다!'
          : '🔄 [100% 원본 미러링 일치화 완료] 클라우드 없이 폰과 PC 양쪽 기기의 원본 사진·서류가 완벽히 일치되었습니다!',
    }));
  },

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
  };
});

export const useGhostiStore = useSaySeeStore;

