export type TrashCategory =
  | 'duplicate'
  | 'screenshot'
  | 'document'
  | 'object'
  | 'blurry'
  | 'receipt';

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
  /** 시맨틱 태그 (예: #해변·파도, #가족모임, #스크린샷) */
  tags: string[];
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
  /** 실제 Gemini API가 사진별 고립 프롬프트로 빚어낸 맛깔스러운 추천 문장 */
  sentence: string;
  shortChip: string;
  targetSearchQuery: string;
  generatedByModel: string;
}

export interface LlmJsonDirective {
  rewrittenQueryKo: string;
  rewrittenQueryEn: string;
  datePrefix: string;
  season: string;
  boostPresetId: string;
  excludeTrash: boolean;
}

export interface TikiTakaMessage {
  role: 'assistant' | 'user';
  text: string;
  stepLabel?: string;
  timestamp: string;
}

/**
 * [지침 A2] 하이패스형 일일 합산 코인 정산 내역
 * - 대화/검색 도중에는 팝업으로 맥을 끊지 않고 조용히 누적했다가
 *   일일 마감(또는 세션 종료 정산) 시 단 1건의 합산 로그로 깔끔하게 기록합니다.
 */
export interface DailyCoinLedgerEntry {
  id: string;
  dateKey: string;
  settledAt: string;
  totalCalls: number;
  totalCoinsDeducted: number;
  summaryTitle: string;
}

export interface SearchResultItem {
  photo: PhotoItem;
  score: number;
  matchPercentage: number;
  matchedBy:
    | 'audio-direct'
    | 'stt-fallback-silent'
    | 'text-direct'
    | 'visual-similarity'
    | 'llm-json-router';
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
  wifiOnly: boolean;
  connectedPeer: string;
  lastSyncedAt: string;
  packSizeMB: number;
  originalSizeGB: number;
  syncing: boolean;
}
