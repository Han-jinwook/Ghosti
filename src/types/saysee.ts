export type TrashCategory =
  | 'duplicate'
  | 'memo'
  | 'screenshot'
  | 'blurry'
  | 'document'
  | 'object'
  | 'receipt';

/** [스펙 1 & 체험판 타겟팅] 파워 검색 상단 공간 필터: [🎬 동영상 장면] vs [📁 스마트 서류함] vs [🖼️ 전체/갤러리] */
export type SearchSpaceMode = 'video' | 'vault' | 'gallery';

/** [온보딩 프레임 대전환] Track A: 내 PC 직접 구동(권장) + QR 모바일 연결 vs Track B: 모바일 단독 시 초고속 GPU 서버 무료 대여 */
export type OnboardingTrackMode = 'pc_local' | 'cloud_rental';

/** [체험판 보안 스펙 1] 스캔 전 유저가 직접 체크하여 허용하는 기본 3대 안전 검진 구역 */
export interface TrialScanPermissions {
  gallery: boolean;
  downloads: boolean;
  desktop: boolean;
}

/** [동영상 전 구간(Full-Timeline) 완전 해부] 00:00부터 끝까지 1~2초 간격의 시간대별 프레임 인덱스 */
export interface VideoTimelineFrame {
  frameId: string;
  timeSec: number;
  timestampText: string;
  phaseLabel: string;
  sceneCaption: string;
  keywords: string[];
  tags: string[];
}

/** [동영상 체험 혁신] 최신 동영상 3개 선정 후 00:00부터 끝까지 전 구간(Full-Timeline) 완전 해부 데이터 */
export interface VideoSceneItem {
  id: string;
  videoFileName: string;
  title: string;
  keyframePhotoId: string;
  thumbUrl: string;
  videoUrl: string;
  date: string;
  durationText: string;
  durationSec: number;
  matchedSeekSec: number;
  matchedTimestamp: string;
  matchedFrameCaption: string;
  locationKo: string;
  sceneDescription: string;
  keywords: string[];
  resolution: string;
  sizeMB: number;
  timelineFrames: VideoTimelineFrame[];
}

/** [라운지 마스터 스펙] 원터치 관계 호칭 칩 */
export type FaceRelationshipChip =
  | '#나(방장)'
  | '#아내'
  | '#남편'
  | '#자녀'
  | '#부모님'
  | '#친구';

/** [라운지 마스터 스펙] 인물 클러스터와 매칭된 동영상 타임라인 구간 */
export interface FaceVideoSegmentMatch {
  videoId: string;
  videoFileName: string;
  videoTitle: string;
  timeSec: number;
  timestampText: string;
  phaseLabel: string;
  sceneCaption: string;
  thumbUrl: string;
}

/** [라운지 마스터 스펙] 연도별(2026년 ➔ 2024년 등) 차곡차곡 누적되는 인물 베스트 컷 1장 */
export interface YearlyFaceBestCut {
  year: number;
  representativePhoto: string;
  representativeDate: string;
  frontalScore: number;
  opticalSharpness: number;
  avatarUrl: string;
  cropUrl: string;
  boundingBox: [number, number, number, number];
}

/** [라운지 마스터 스펙] 자율 얼굴 검출(Bounding Box Crop) & 당해 연도 베스트 1장 + 과거 연도 누적 클러스터 */
export interface FaceMemberCluster {
  clusterId: string;
  personKey: string;
  /** 방장이 직접 입력한 실명/별명 (예: 은숙, 멀린, 치우, 천우, 지우) */
  registeredName: string;
  /** 방장이 선택한 관계 칩 (레거시 호환) */
  relationshipTag: string;
  suggestedChip: string;
  roleHintKo: string;
  appearanceLabelKo: string;
  isPasserbyCandidate: boolean;
  /** [✕ 행인 제외] 버튼으로 제외 처리되었는지 여부 */
  excludedAsPasserby: boolean;
  representativePhoto: string;
  representativeYear: number;
  representativeDate: string;
  frontalScore: number;
  opticalSharpness: number;
  /** 실제 이미지 얼굴 영역에서 자동 크롭된 아바타 이미지 URL */
  avatarUrl: string;
  /** 실시간 좌표 크롭 URL (/__faces/crop?file=...&box=ymin,xmin,ymax,xmax) */
  cropUrl: string;
  /** 정규화된 얼굴 Bounding Box [ymin, xmin, ymax, xmax] (0..1000) */
  boundingBox: [number, number, number, number];
  /** 당해 연도(최신순)부터 과거 연도 사진 검색 시 뒤쪽에 차곡차곡 쌓이는 연도별 베스트 컷 스택 */
  yearlyBestCuts?: YearlyFaceBestCut[];
  detectedSampleCount: number;
  matchedPhotoCount: number;
  matchedPhotoFiles: string[];
  matchedVideoSegmentCount: number;
  matchedVideoSegments: FaceVideoSegmentMatch[];
  /** Step 2~3 초대받은 친구 폰 레이더 스캔 기준 촬영 날짜 목록 */
  seedDates: string[];
  /** Step 2~3 초대받은 친구 폰 레이더 스캔 기준 768차원 임베딩 시드(Seed) 요약 */
  seedVecPreview?: number[];
}

/** [스펙 1] 로컬 폴더(PC/폰) 내 PDF, TXT, DOCX 등 텍스트 추출 문서 자산 */
export interface LocalDocumentFile {
  id: string;
  fileName: string;
  ext: 'PDF' | 'TXT' | 'DOCX';
  title: string;
  categoryBadge: string;
  extractedText: string;
  keywords: string[];
  date: string;
  sizeKB: number;
  deviceSource: 'PC 바탕화면' | '스마트폰 다운로드' | 'PC 로컬 폴더';
}

/** [스펙 2] 3중 타임머신 안전망: 즉시 되돌리기(Undo) 배치 스냅샷 */
export interface UndoQuarantineBatch {
  fileNames: string[];
  actionLabel: string;
  count: number;
  savedBytes: number;
  timestamp: number;
}

/** [스펙 3] 클라우드 대체 프라이빗 싱크 2-Track 모드 */
export type PrivateSyncStrategy = 'mirror' | 'shadow';

/** [4대 라운지 스펙] 라운지 카테고리: 개인 | 패밀리 | 클럽 | 10대 학생 */
export type LoungeType = 'personal' | 'family' | 'club' | 'student';

/** [패밀리 라운지 양가 통합권] 3개 방 분리 ID */
export type FamilyRoomId = '우리집' | '본가(친가)' | '처가(친정)';

/** [클럽 라운지 규모] 소형(20명 기준) | 중형(100명 기준) | 대형(인원 제한 없음) */
export type ClubSizeTier = 'small' | 'medium' | 'large';

/** [⚡ 24시간 GPU 클라우드 서버 도우미] 대여 티어 */
export type GpuHelperTierId =
  | 'standard_1000'
  | 'club_small_1000'
  | 'club_medium_2000'
  | 'club_large_3000';

/** [4대 라운지 초심플 기본 요금제] 마스터 1인 결제 ➔ 멤버 전원 무료 (특판 문구 제외 순수 요금 구조) */
export type PricingPlanId =
  | 'free_trial'
  | 'personal_single_2900'
  | 'personal_sub_3900'
  | 'personal_year_35000'
  | 'family_home_5900'
  | 'family_home_year_59000'
  | 'family_three_8900'
  | 'family_three_year_89000'
  | 'club_small_4900'
  | 'club_small_year_49000'
  | 'club_medium_7900'
  | 'club_medium_year_79000'
  | 'club_large_14900'
  | 'club_large_year_149000'
  | 'student_sub_900'
  | 'student_year_9000';

export interface DuplicateGroup {
  groupId: string;
  /** 그룹 내에서 가장 선명하거나(maxCellLap 최고점) 유저가 직접 클릭(Pick)한 보존 원본 1장 ID */
  bestPhotoId: string;
  /** 그룹에 속한 전체 쌍둥이/연사 사진 ID 배열 (시간순) */
  photoIds: string[];
  /** 촬영 시간 간격 (초) */
  deltaSec: number;
  /** 그룹 내 최대 64-bit Perceptual dHash 해밍 거리 (비트 오차) */
  maxDhashDist: number;
}

export interface PhotoItem {
  id: string;
  name: string;
  size: number;
  date: string;
  mtimeMs: number;
  thumbUrl: string;
  fullUrl: string;
  /** 768차원 정규화 벡터 (실시간 WebGPU 색인 시 저장) */
  vec?: Float32Array;
  /** 시맨틱 태그 (예: #해변·물놀이, #나무다리·공원, #스크린샷) */
  tags: string[];
  /** 시맨틱 클러스터 ID (동일 장면 연사 판별용) */
  clusterId?: number;
  /** EXIF GPS 기반 한국어 지명 */
  locationKo?: string;
  /** 로컬 시맨틱 캡션 (로컬 문장 조합기 팩트 원천) */
  captionKo?: string;
  /** [스펙 1] 지울 쓰레기가 아니라 [📁 스마트 서류함]으로 격상된 핵심 정보 자산(설명서·신분증·계약서·영수증 등) 여부 */
  isVaultDocument?: boolean;
  /** [스펙 1] 스마트 서류함 분류 라벨 (예: '조립 설명서·매뉴얼', '신분증·여권 사본', '결제·심사 문자 캡처') */
  vaultCategoryLabel?: string;
  /** 스마트 다이어트 쓰레기 사진 분류 (해당 시) */
  trashCategory?: TrashCategory;
  /** 쓰레기 분류 신뢰도 (0.85 ~ 0.99) */
  trashConfidence?: number;
  /** 연사/중복 쌍둥이 그룹 ID (Perceptual dHash 클러스터) */
  duplicateGroupId?: string;
  /** 연사/중복 그룹에서 [원본 1장 안전하게 보존됨]으로 지정된 대표 원본인지 여부 */
  isBestInDuplicateGroup?: boolean;
  /** 8방향 3x3 그리드 라플라시안 최고 선명도 점수 */
  opticalSharpness?: number;
  /** 64-bit Perceptual dHash (16진수) */
  dhash?: string;
  /** 세이씨_정리대기함 폴더로 물리 격리되었는지 여부 */
  quarantined?: boolean;
  /** 모바일에서 정리 예약(Queue) 상태인지 여부 */
  queuedForQuarantine?: boolean;
  /** 즐겨찾기 여부 */
  bookmarked?: boolean;
  /** PoC 550장 실측 쿼리별 사전 매칭 점수 맵 (presetId -> score) */
  presetScores?: Record<string, number>;
}

export interface OnboardingAhaItem {
  photoId: string;
  thumbUrl: string;
  dateFact: string;
  domainTitle: string;
  /** 로컬 팩트 조합기가 사진별 팩트([지명/시기 + 배경/사물 + 행동/분위기])로 조합한 추천 문장 */
  sentence: string;
  shortChip: string;
  targetSearchQuery: string;
}

export interface SearchResultItem {
  photo: PhotoItem;
  score: number;
  matchPercentage: number;
  matchedBy:
    | 'audio-direct'
    | 'stt-fallback-silent'
    | 'text-direct'
    | 'visual-similarity';
}

export interface VoiceRoutingTrace {
  id: string;
  timestamp: string;
  primaryMode: 'audio-direct' | 'stt-fallback';
  /** Zero-STT 오디오 인코더 Top-1 점수 */
  audioTop1Score: number | null;
  /** 오디오 점수 마진 (Top1 - Top5) */
  audioMargin: number | null;
  /** 설정된 임계치 (기본 0.665) */
  threshold: number;
  /** 임계치 미달 또는 한국어 오디오 불확실성으로 백그라운드 STT 폴백이 작동했는지 여부 */
  silentFallbackTriggered: boolean;
  fallbackReason?: string;
  /** 인식/매칭된 쿼리 텍스트 */
  resolvedQuery: string;
  /** 오디오 디코딩 지연 (ms) */
  decodeMs: number;
  /** 추론 지연 (ms) */
  embedMs: number;
  /** 벡터 탐색 지연 (ms) */
  searchMs: number;
  /** 총 지연 시간 (ms) */
  totalMs: number;
}

export interface HardwareTelemetry {
  secureContext: boolean;
  webgpu: boolean;
  gpuVendor: string;
  gpuArchitecture: string;
  gpuDescription: string;
  shaderF16: boolean;
  maxBufferSizeMB: number;
  cpuThreads: number;
  deviceMemoryGB: number | null;
  opfsSupported: boolean;
  opfsFiles: number;
  opfsBytesMB: number;
  persisted: boolean;
  jsHeapUsedMB: number | null;
  avgPerImageMs: number;
  lastQueryMs: number;
}

export interface MerlinAuthState {
  token: string;
  tier: 'FREE' | 'PRO_LIFETIME';
  userId: string;
  email: string;
  maxFreePhotos: number;
  hubUrl: string;
}

export type SyncMode = 'supabase' | 'p2p-wifi';

export interface SyncState {
  mode: SyncMode;
  /** [스펙 3] 프라이빗 싱크 2-Track 전략: 'mirror'(100% 원본 미러링) vs 'shadow'(13KB 초경량 섀도우 캐시) */
  privateSyncStrategy: PrivateSyncStrategy;
  wifiOnly: boolean;
  chargingOnly: boolean;
  connectedPeer: string;
  lastSyncedAt: string;
  packSizeMB: number;
  originalSizeGB: number;
  syncing: boolean;
}
