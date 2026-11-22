import {
  AutoConfig,
  AutoModel,
  AutoProcessor,
  AutoTokenizer,
  RawImage,
  env,
} from '@huggingface/transformers';
import {
  opfsCache,
  opfsSupported,
  requestPersist,
  resetCacheStats,
  storageInfo,
} from '../opfsCache';
import { getZCoreUrl } from '../zCoreBridge';
import koreanPhotoOntologyData from '../../data/koreanPhotoOntology.json';
import type { HardwareTelemetry, TrashCategory, VideoSceneItem } from '../../types/saysee';

export interface CachedPhotoSemanticMeta {
  tags?: string[];
  keywordsKo?: string[];
  ontologyPrimaryTags?: string[];
  ocrDone?: boolean;
  ocrSnippet?: string;
}

export const aiRuntimeFlags = {
  priorityVideoSearchDepth: 0,
  priorityModalGalleryOpen: false,
  silentMediaIndexingRunning: false,
  activeVideoPlaybackCount: 0,
  lastUserInputAt: 0,
  sharedRoomSyncActive: false,
  precomputedSearches: [] as PrecomputedSearchEntry[],
  precomputedAudioRows: [] as any[],
};

export const localVideoRepThumbMap = new Map<string, string>();
export const localVideoFrameThumbMap = new Map<string, string>();
export const localVideoFrameVecMap = new Map<string, Float32Array>();
export const hydratedPhotoVecMap = new Map<string, Float32Array>();
export const hydratedPhotoMetaMap = new Map<string, CachedPhotoSemanticMeta>();
export const staticCaptionedPhotoIds = new Set<string>();

let globalInputQuietListenerBound = false;
export function ensureGlobalUserInputQuietGuardBound(): void {
  if (globalInputQuietListenerBound || typeof window === 'undefined') return;
  globalInputQuietListenerBound = true;
  const markTyping = (ev: Event) => {
    const t = ev.target as HTMLElement | null;
    const tag = t?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) {
      aiRuntimeFlags.lastUserInputAt = performance.now();
    }
  };
  window.addEventListener('keydown', markTyping, { passive: true, capture: true });
  window.addEventListener('input', markTyping, { passive: true, capture: true });
  window.addEventListener('compositionupdate', markTyping, { passive: true, capture: true });
}

export function markUserSearchInputActivity(): void {
  aiRuntimeFlags.lastUserInputAt = performance.now();
}

export async function waitForUserTypingAndModalQuiet(quietWindowMs = 1600): Promise<void> {
  ensureGlobalUserInputQuietGuardBound();
  while (
    aiRuntimeFlags.priorityVideoSearchDepth > 0 ||
    aiRuntimeFlags.activeVideoPlaybackCount > 0 ||
    aiRuntimeFlags.priorityModalGalleryOpen ||
    aiRuntimeFlags.sharedRoomSyncActive ||
    performance.now() - aiRuntimeFlags.lastUserInputAt < quietWindowMs
  ) {
    const remainingInputQuiet = Math.max(
      120,
      Math.min(450, quietWindowMs - (performance.now() - aiRuntimeFlags.lastUserInputAt))
    );
    await new Promise((r) => setTimeout(r, remainingInputQuiet));
  }
}

export function getPhotoMediaCacheKey(path: string, size: number): string {
  return `photo:${path}|${Math.max(0, Math.floor(size || 0))}`;
}

export function getVideoMediaBaseKey(vid: Pick<VideoSceneItem, 'videoFileName' | 'id' | 'sizeMB'>): string {
  return `${vid.videoFileName || vid.id}|${Number(vid.sizeMB || 0).toFixed(1)}`;
}

export function getVideoFrameCacheKey(
  vid: Pick<VideoSceneItem, 'videoFileName' | 'id' | 'sizeMB'>,
  timeSec: number
): string {
  return `vframe:${getVideoMediaBaseKey(vid)}:${Math.max(0, Math.round(timeSec))}`;
}


// 4대 인메모리 벡터·캐시 스토어 명시적 별칭 (3창 모듈 규격 호환)
export const memoryVectorStore = hydratedPhotoVecMap;
export const sharedRoomVectorCache = localVideoRepThumbMap;
export const memoryTextVectorStore = localVideoFrameVecMap;
export const memoryFaceStore = localVideoFrameThumbMap;

export function notifyVideoPlaybackStart(): void {
  setVideoPlaybackActive(true);
}

export function notifyVideoPlaybackStop(): void {
  setVideoPlaybackActive(false);
}

const KEEP_STEM_WORDS = new Set([  '아이', '어린이', '고양이', '멍멍이', '길냥이', '호랑이', '부엉이', '원숭이', '거북이', '떡볶이',
  '강아지', '송아지', '망아지', '강냉이', '달팽이', '지렁이', '올챙이', '코끼리', '너구리', '개구리',
  '오이', '종이', '놀이', '높이', '길이', '넓이', '깊이', '나이', '차이', '사이',
  '바닷가', '창가', '물가', '길가', '강가', '화가', '작가', '국가', '상가', '단가', '원가', '휴가',
  '목걸이', '귀걸이', '물놀이', '나들이', '비행기', '세탁기', '선풍기', '청소기',
  '종로', '을지로', '퇴계로', '대학로', '세종대로', '테헤란로',
  '제주도', '강원도', '경기도', '충청도', '전라도', '경상도', '울릉도', '독도', '여의도', '영종도', '송도',
  '포도', '지도', '속도', '온도', '각도', '세금계산서', '사업자등록증',
]);

// 표준 한국어 시각 개념 족보(koreanPhotoOntology.json, 710+ 어휘) 전체 명사를 자동 등록하여
// 수동 단어 땜빵 없이 모든 도메인 어휘가 조사 절단으로부터 100% 보호되도록 보장합니다.
const PROTECTED_ONTOLOGY_KO_NOUNS: Set<string> = (() => {
  const s = new Set<string>(KEEP_STEM_WORDS);
  const nodes = Array.isArray((koreanPhotoOntologyData as { nodes?: unknown[] })?.nodes)
    ? ((koreanPhotoOntologyData as { nodes: Array<{ triggers?: string[]; equivalents?: string[]; parents?: string[] }> }).nodes)
    : [];
  for (const n of nodes) {
    for (const arr of [n.triggers, n.equivalents, n.parents]) {
      if (!Array.isArray(arr)) continue;
      for (const w of arr) {
        const clean = String(w || '').toLowerCase().trim();
        if (clean.length >= 2 && /[가-힣]/.test(clean)) {
          s.add(clean);
        }
      }
    }
  }
  return s;
})();

// 고유 접미 형태로 끝나는 한국어 명사 어미 보호 패턴 (예: ~양이, ~아지, ~도, ~로, ~가, ~시/군/구)
const KO_PROTECTED_NOUN_SUFFIX_RX =
  /(?:양이|아지|멍이|랑이|엉이|숭이|북이|끼리|팽이|구리|오리|거미|개미|매미|나비|오이|종이|놀이|걸이|볶이|구이|어린이|할머니|어머니|아버지|높이|길이|넓이|깊이|닷가|창가|물가|길가|강가|화가|작가|국가|상가|단가|원가|휴가|제주도|강원도|경기도|충청도|전라도|경상도|울릉도|독도|여의도|영종도|송도|종로|을지로|퇴계로|대학로|대로|[가-힣]{1,4}(?:시|군|구))$/;

const KO_MULTI_PARTICLE_RX =
  /(?:들)?(?:에서부터|으로부터|에게서|속에서|에서|에게|으로|이랑|하고|부터|까지|처럼|보다|마다|대로|밖에|마저|조차|이나|이란|이고|이며|하는|있는|없는|되는|했던|하던|해서|하며)$/;

const KO_SINGLE_PARTICLE_RX =
  /(?:들|의|을|를|은|는|이|가|에|와|과|도|만|로|랑|나)$/;

const KO_PARTICLE_RX =
  /(?:들)?(?:에서부터|으로부터|에게서|에서|에게|으로|이랑|하고|부터|까지|처럼|보다|마다|대로|밖에|마저|조차|이나|이란|이고|이며|하는|있는|없는|되는|했던|하던|해서|하며|된|한|할|님|씨|이|가|은|는|을|를|의|에|로|와|과|랑|도|만|나|란|다)$/;
const LOAN_TAILS = /^(이크|패드|디어|라인|스크림|언맨|사이트|이드|이즈|이트|콘|폰|템)$/;
const ADMIN_PLACE_TAILS = /^(시|군|구|동|읍|면|리|역)$/;

// 부분 문자열 착시 차단 사전 (예: '튜브'≠'유튜브', '아이'≠'아이콘/아이폰', '다리'≠'사다리', '고기'≠'물고기', '고양'≠'고양시')
const KO_SUBSTRING_FALSE_FRIEND_RX: Record<string, RegExp> = {
  고양이: /고양시/,
  고양: /고양시/,
  아이: /아이콘|아이폰|아이패드|아이디|아이템|아이디어|아이스|아이언|아이라인|아이섀도/,
  튜브: /유튜브/,
  다리: /사다리|기다리|다리미/,
  고기: /물고기/,
  배: /택배|배달|배경|배터리|배구|배추|담배|선배|후배/,
  말: /말레이시아|말씀|주말|연말|결말|양말|단말/,
  개: /개인|개월|개발|개봉|개선|개설|개시|개수|개념|개요|개최|공개|번개|안개|조개|베개|날개|덮개|지우개/,
};

const MEDIA_AND_DOC_SEARCH_CATEGORY_NOUNS = new Set([  '풍경', '풍경사진', '자연', '경치', '전망', '바다', '해변', '바닷가', '산', '등산', '하늘', '구름', '노을', '일몰', '일출', '야경',
  '꽃', '나무', '숲', '공원', '호수', '강', '계곡', '폭포', '눈', '설경', '봄', '여름', '가을', '겨울',
  '강아지', '고양이', '반려견', '반려묘', '동물', '새',
  '음식', '음식사진', '맛집', '식사', '요리', '커피', '카페', '디저트', '케이크', '빵', '술', '맥주', '와인',
  '여행', '여행사진', '휴가', '캠핑', '텐트', '수영장', '호텔', '리조트', '비행기', '공항',
  '가족', '가족사진', '아이', '아기', '어린이', '친구', '모임', '단체', '단체사진', '셀카', '인물', '인물사진', '결혼식', '생일', '졸업식',
  '사진', '이미지', '동영상', '영상', '비디오', '클립', '녹화',
  '문서', '서류', '파일', '자료', '영수증', '전표', '계약서', '견적서', '명세서', '세금계산서', '계산서',
  '사업자등록증', '등록증', '신분증', '운전면허증', '면허증', '주민등록등본', '등본', '초본', '여권', '명함',
  '이력서', '기획서', '제안서', '품의서', '기안서', '단가표', '가격표', '시간표', '일정표', '식단표',
  '청첩장', '초대장', '티켓', '항공권', '처방전', '진단서', '통장', '통장사본', '증명서', '수료증', '자격증',
]);

const NON_SEARCH_SYSTEM_NOUNS = new Set([  '속도', '온도', '각도', '국가', '차이', '사이', '나이', '길이', '넓이', '높이', '깊이',
]);

/**
 * [단일 SSOT] 음성·채팅 단답 발화('풍경', '문서', '영수증', '강아지' 등)가
 * 사진·동영상·문서 검색 명사인지 한국어 시각 온톨로지(710+ 어휘) + 미디어/서류 사전으로 즉시 판별합니다.
 */
export function isOntologyMediaSearchNoun(word: string): boolean {
  const raw = String(word || '').toLowerCase().trim();
  if (raw.length < 1 || !/[가-힣]/.test(raw)) return false;
  if (NON_SEARCH_SYSTEM_NOUNS.has(raw)) return false;
  if (MEDIA_AND_DOC_SEARCH_CATEGORY_NOUNS.has(raw)) return true;
  if (raw.length >= 2 && PROTECTED_ONTOLOGY_KO_NOUNS.has(raw)) return true;
  const stripped = stripKoSearchParticle(raw, true);
  if (stripped && !NON_SEARCH_SYSTEM_NOUNS.has(stripped)) {
    if (MEDIA_AND_DOC_SEARCH_CATEGORY_NOUNS.has(stripped)) return true;
    if (stripped.length >= 2 && PROTECTED_ONTOLOGY_KO_NOUNS.has(stripped)) return true;
  }
  return false;
}

export function isProtectedKoNoun(word: string): boolean {
  const w = word.toLowerCase().trim();
  if (!w) return false;
  return PROTECTED_ONTOLOGY_KO_NOUNS.has(w) || KO_PROTECTED_NOUN_SUFFIX_RX.test(w);
}

/**
 * [전 탭(사진·동영상·문서) 단일 한국어 검색어 조사 분리기 — 파편화 영구 폐지]:
 * 1) 온톨로지 710+ 명사 및 한국어 고유 명사 어미(~양이, ~아지, ~도, ~로, ~가 등)는 절대 끝 글자를 잘라내지 않습니다.
 * 2) 1단어 단독 검색어(isSingleWordQuery=true, 예: '고양이', '포도', '종이')는 1음절 조사(이/가/도/로 등)를 절대 절단하지 않습니다.
 */
export function stripKoSearchParticle(rawWord: string, isSingleWordQuery = false): string {
  const cur0 = rawWord.toLowerCase().trim();
  if (!cur0 || isProtectedKoNoun(cur0)) return cur0;

  let cur = cur0;
  const mMulti = cur.replace(KO_MULTI_PARTICLE_RX, '');
  if (mMulti !== cur && mMulti.length >= 1) {
    cur = mMulti;
    if (isProtectedKoNoun(cur)) return cur;
  }

  // 1어절 단독 검색어에서는 1글자 어미(이/가/은/는/도/로 등)를 절대 절단하지 않음
  if (!isSingleWordQuery && cur.length >= 3 && !isProtectedKoNoun(cur)) {
    const mSingle = cur.replace(KO_SINGLE_PARTICLE_RX, '');
    if (mSingle !== cur && mSingle.length >= 2) {
      cur = mSingle;
    }
  }
  return cur;
}

export function extractKoStems(text: string): string[] {
  const intactEojeols = text
    .toLowerCase()
    .replace(/[^가-힣a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  // CamelCase·PascalCase('bankTest' ➔ 'bank Test') 및 영문↔숫자↔한글 결합('PI26048S' ➔ 'PI 26048 S', '신한bank' ➔ '신한 bank')을
  // 소문자화 전에 분리하여 원형 어절('banktest')과 구성 토큰('bank', 'test')을 모두 색인합니다.
  const splitEojeols = text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
    .replace(/([가-힣])([a-zA-Z0-9])/g, '$1 $2')
    .replace(/([a-zA-Z0-9])([가-힣])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^가-힣a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const stems = new Set<string>();
  for (const raw of [...intactEojeols, ...splitEojeols]) {
    // 원형 어절('고양이', '고양시', '달팽이', 'banktest', 'bank' 등)은 항상 보존
    stems.add(raw);
    if (isProtectedKoNoun(raw)) {
      continue;
    }
    const next = raw.replace(KO_PARTICLE_RX, '');
    if (next && next.length >= 2 && next !== raw) {
      stems.add(next);
    }
  }
  return Array.from(stems);
}

export function matchKoTokenInStems(
  token: string,
  stems: string[],
  rawText?: string,
  options?: { allowFilenameSubstring?: boolean }
): boolean {
  const tk = token.toLowerCase().trim();
  if (!tk) return false;
  // 1~2글자 초단문 영문/숫자 토큰(예: 'ai', 'id')은 영단어 내부 부분문자열(예: 'airplane', 'detail', 'main')에 절대 매칭하지 않고
  // 독립 토큰·CamelCase 분리 어절('aiPhoto' ➔ 'ai')이거나 한글 조사/명사와 결합된 형태('ai이미지', 'ai가')만 정확히 매칭!
  // 반면 4글자 이상 영문/숫자 토큰(예: 'bank', '26048')은 소문자 복합어 접두·접미('banktest', 'shinhanbank')까지 매칭하며,
  // 파일명·제목 매칭(allowFilenameSubstring) 시에는 3글자 이상 토큰의 파일명 부분 일치도 허용합니다.
  if (/^[a-z0-9]+$/.test(tk)) {
    const escaped = tk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundaryRx = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i');
    const allowFileSub = Boolean(options?.allowFilenameSubstring) && tk.length >= 3;
    const allowCompoundAffix = tk.length >= 4;
    for (const st of stems) {
      if (st === tk || boundaryRx.test(st)) return true;
      if (allowCompoundAffix && (st.startsWith(tk) || st.endsWith(tk))) return true;
      if (allowFileSub && st.includes(tk)) return true;
    }
    if (rawText) {
      if (boundaryRx.test(rawText)) return true;
      if (allowFileSub && rawText.toLowerCase().includes(tk)) return true;
    }
    return false;
  }

  const falseFriendRx = KO_SUBSTRING_FALSE_FRIEND_RX[tk];

  for (const st of stems) {
    if (st === tk) return true;
    if (tk.length === 1) continue;
    if (falseFriendRx && falseFriendRx.test(st)) continue;
    if (tk.length === 2) {
      if (st.startsWith(tk)) {
        const rem = st.slice(tk.length);
        if (ADMIN_PLACE_TAILS.test(rem)) continue;
        if (
          (rem.length >= 2 && !LOAN_TAILS.test(rem)) ||
          (rem.length === 1 && /^[가-힣]$/.test(rem) && !'은는이가을를의에로와과도만'.includes(rem))
        ) {
          return true;
        }
      }
      if (st.endsWith(tk)) {
        const rem = st.slice(0, st.length - tk.length);
        if (rem.length >= 2) return true;
      }
      continue;
    }
    if (st.includes(tk)) return true;
  }
  if (tk.length >= 3 && rawText) {
    const cleanedRaw = falseFriendRx ? rawText.toLowerCase().replace(new RegExp(falseFriendRx.source, 'g'), ' ') : rawText.toLowerCase();
    const noSpace = cleanedRaw.replace(/\s+/g, '');
    if (noSpace.includes(tk.replace(/\s+/g, ''))) return true;
  }
  return false;
}

const OCR_CONFUSABLE_CHO = new Set([  '0:15', '15:0', // ㄱ↔ㅋ
  '3:16', '16:3', // ㄷ↔ㅌ
  '7:17', '17:7', // ㅂ↔ㅍ
  '12:14', '14:12', // ㅈ↔ㅊ
  '6:11', '11:6', // ㅁ↔ㅇ
  '0:1', '1:0', // ㄱ↔ㄲ
  '9:10', '10:9', // ㅅ↔ㅆ
]);
const OCR_CONFUSABLE_JUNG = new Set([  '13:18', '18:13', // ㅜ↔ㅡ (예: 룰렛↔를렛)
  '8:18', '18:8', // ㅗ↔ㅡ (예: 카카오톡↔카카오특)
  '8:12', '12:8', // ㅗ↔ㅛ
  '13:17', '17:13', // ㅜ↔ㅠ
  '0:2', '2:0', // ㅏ↔ㅑ
  '4:6', '6:4', // ㅓ↔ㅕ
  '1:5', '5:1', // ㅐ↔ㅔ
  '3:7', '7:3', // ㅒ↔ㅖ
]);
const OCR_CONFUSABLE_JONG = new Set([  '16:21', '21:16', // ㅁ↔ㅇ (예: 추첨↔추청)
  '4:8', '8:4', // ㄴ↔ㄹ
  '1:24', '24:1', // ㄱ↔ㅋ
  '17:26', '26:17', // ㅂ↔ㅍ
  '19:20', '20:19', // ㅅ↔ㅆ
]);

function decomposeHangulSyllable(ch: string): [number, number, number] | null {
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return null;
  const jong = code % 28;
  const jung = Math.floor(code / 28) % 21;
  const cho = Math.floor(code / 588);
  return [cho, jung, jong];
}

/**
 * 동영상 화면 저해상도 자막·배너에서 발생하는 광학 문자 인식(OCR) 획 오인(예: 룰↔를, 퀴↔귀, 톡↔특, 첨↔청)을
 * 순수 한글 자모 분해 거리로 보정합니다 (오탐 방지를 위해 OCR 텍스트에서만 6자모 중 5자모 일치 + 1획 오인 이내만 허용).
 */
export function matchKoreanOcrFuzzyToken(token: string, ocrText: string): boolean {
  const tk = token.trim();
  if (!/^[가-힣]{2,}$/.test(tk) || !ocrText) return false;
  const qJamos = Array.from(tk).map(decomposeHangulSyllable);
  if (qJamos.some((j) => j === null)) return false;
  const maxAllowedCost = tk.length === 2 ? 0.5 : 1.0;

  const words = ocrText.match(/[가-힣]{2,}/g);
  if (!words) return false;

  for (const w of words) {
    if (w.length < tk.length) continue;
    for (let start = 0; start <= w.length - tk.length; start++) {
      if (tk.length === 2 && start > 0 && start + tk.length < w.length) continue;
      let cost = 0;
      let valid = true;
      for (let i = 0; i < tk.length; i++) {
        const qj = qJamos[i]!;
        const tj = decomposeHangulSyllable(w[start + i]);
        if (!tj) {
          valid = false;
          break;
        }
        let sylDiffs = 0;
        if (qj[0] !== tj[0]) {
          sylDiffs++;
          cost += OCR_CONFUSABLE_CHO.has(`${qj[0]}:${tj[0]}`) ? 0.5 : 1.0;
        }
        if (qj[1] !== tj[1]) {
          sylDiffs++;
          cost += OCR_CONFUSABLE_JUNG.has(`${qj[1]}:${tj[1]}`) ? 0.5 : 1.0;
        }
        if (qj[2] !== tj[2]) {
          sylDiffs++;
          cost += OCR_CONFUSABLE_JONG.has(`${qj[2]}:${tj[2]}`) ? 0.5 : 1.0;
        }
        if (sylDiffs >= 2 || cost > maxAllowedCost) {
          valid = false;
          break;
        }
      }
      if (valid && cost <= maxAllowedCost) {
        return true;
      }
    }
  }
  return false;
}


export const MODEL_ID = 'onnx-community/embeddinggemma-2-ONNX';
export const QUERY_PREFIX = 'task: search result | query: ';
export const DEFAULT_DIM = 768;
export const VISION_TOKEN_BUDGET = 70;
export const DECODE_SIDE = 512;
export const THUMB_SIDE = 240;

env.allowLocalModels = false;
try {
  if (
    typeof navigator !== 'undefined' &&
    (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') ||
      (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1))
  ) {
    if ((env as any).backends?.onnx?.wasm) {
      (env as any).backends.onnx.wasm.numThreads = 1;
      const wp = (env as any).backends.onnx.wasm.wasmPaths;
      if (wp && typeof wp === 'object' && typeof wp.wasm === 'string' && wp.wasm.includes('cdn.jsdelivr.net')) {
        (env as any).backends.onnx.wasm.wasmPaths = undefined;
      }
    }
  }
} catch {
  /* ignore wasm thread hint */
}

/**
 * [글로벌 서빙 & 비상 Fallback 2중 안전망]
 * - 1순위: HuggingFace 글로벌 CDN (평상시 고속·무과금 서빙)
 * - 2순위: 당사 GitHub Releases 무제한 무료 CDN 미러 (/api/models-mirror/) (허깅페이스 링크삭제·장애 대비 비상 마스터 사본)
 */
export const PRIMARY_REMOTE_HOST = 'https://huggingface.co/';
export const FALLBACK_R2_HOST =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_R2_MODEL_CDN_URL) ||
  '/api/models-mirror/';
export const FALLBACK_LOCAL_ZCORE_HOST = 'http://127.0.0.1:5199/__models/';

/**
 * [기기 사양별 정밀도(Dtype) 자동 분기 정책]
 * 1) PC 데스크톱: 무조건 전부 8비트('q8')로 100% 통일 (원본 99.2% 실력 복원, 5~8초 컷)
 * 2) 모바일(Android / iOS 전체): OS GPU/ZRAM 스왑 고갈 및 ANR 원천 차단을 위해 경량 4비트('q4') 단일 고정
 */
export function isMobileDeviceRuntime(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  if (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1) return true;
  if (typeof window !== 'undefined') {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.()) return true;
  }
  return false;
}

export function getOptimalEmbeddingDtype(): 'q8' | 'q4' {
  if (typeof window === 'undefined') return 'q8';

  if (isMobileDeviceRuntime()) {
    return 'q4';
  }

  // PC 데스크톱은 창 너비·사양 불문 무조건 8비트(q8) 100% 통일
  return 'q8';
}

let modelRemoteFallbackMutex: Promise<void> = Promise.resolve();

async function runWithTimeout<T>(task: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([      task,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_TIMEOUT_${timeoutMs}MS`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * [3중 안전망 로더 (뮤텍스 직렬화 + 타임아웃 자동 페일오버)]
 * - 1순위 HuggingFace CDN ➔ 2순위 GitHub Releases 무료 CDN 미러(/api/models-mirror/) ➔ 3순위 로컬 Z-코어(/__models/)
 */
export async function loadWithR2Fallback<T>(loader: () => Promise<T>): Promise<T> {
  const prev = modelRemoteFallbackMutex;
  let release!: () => void;
  modelRemoteFallbackMutex = new Promise<void>((res) => {
    release = res;
  });
  await prev;
  try {
    try {
      env.remoteHost = PRIMARY_REMOTE_HOST;
      return await runWithTimeout(loader(), 45000, 'HF_PRIMARY');
    } catch (err) {
      console.warn('[Ghosti AI Engine] 허깅페이스 1차 로드 실패  당사 GitHub Releases 미러(/api/models-mirror/)로 자동 전환합니다:', err);
      try {
        env.remoteHost = FALLBACK_R2_HOST;
        return await runWithTimeout(loader(), 45000, 'GH_MIRROR');
      } catch (mirrorErr) {
        console.warn('[Ghosti AI Engine] 미러 2차 로드 실패  로컬 Z-코어 오프라인 마스터 사본(127.0.0.1:5199/__models/)으로 전환합니다:', mirrorErr);
        try {
          env.remoteHost = FALLBACK_LOCAL_ZCORE_HOST;
          return await runWithTimeout(loader(), 30000, 'ZCORE_LOCAL');
        } catch (localErr) {
          env.remoteHost = PRIMARY_REMOTE_HOST;
          throw localErr;
        }
      }
    }
  } finally {
    env.remoteHost = PRIMARY_REMOTE_HOST;
    release();
  }
}

export interface PresetQueryDef {
  id: string;
  lang: 'ko' | 'en';
  q: string;
  categoryTag: string;
  trashCategory?: TrashCategory;
  wavFile: string;
}

export const PRESET_QUERIES: PresetQueryDef[] = [  { id: 'beach_ko', lang: 'ko', q: '바닷가에서 뛰노는 아이', categoryTag: '#해변·파도', wavFile: 'beach_ko.wav' },
  { id: 'beach_en', lang: 'en', q: 'a child running on the beach', categoryTag: '#해변·파도', wavFile: 'beach_en.wav' },
  { id: 'cake_ko', lang: 'ko', q: '생일 케이크와 촛불', categoryTag: '#생일·케이크', wavFile: 'cake_ko.wav' },
  { id: 'cake_en', lang: 'en', q: 'birthday cake with candles', categoryTag: '#생일·케이크', wavFile: 'cake_en.wav' },
  { id: 'dog_ko', lang: 'ko', q: '강아지', categoryTag: '#반려견·동물', wavFile: 'dog_ko.wav' },
  { id: 'dog_en', lang: 'en', q: 'a dog', categoryTag: '#반려견·동물', wavFile: 'dog_en.wav' },
  { id: 'food_ko', lang: 'ko', q: '음식 사진', categoryTag: '#음식·미식', wavFile: 'food_ko.wav' },
  { id: 'food_en', lang: 'en', q: 'food on a table', categoryTag: '#음식·미식', wavFile: 'food_en.wav' },
  { id: 'group_ko', lang: 'ko', q: '단체 사진', categoryTag: '#가족·모임', wavFile: 'group_ko.wav' },
  { id: 'group_en', lang: 'en', q: 'group photo of family', categoryTag: '#가족·모임', wavFile: 'group_en.wav' },
  { id: 'night_ko', lang: 'ko', q: '밤에 찍은 어두운 사진', categoryTag: '#야간·감성', wavFile: 'night_ko.wav' },
  { id: 'night_en', lang: 'en', q: 'dark photo taken at night', categoryTag: '#야간·감성', wavFile: 'night_en.wav' },
  { id: 'snow_ko', lang: 'ko', q: '눈 오는 날', categoryTag: '#눈·겨울풍경', wavFile: 'snow_ko.wav' },
  { id: 'snow_en', lang: 'en', q: 'snowy day', categoryTag: '#눈·겨울풍경', wavFile: 'snow_en.wav' },
  { id: 'car_ko', lang: 'ko', q: '자동차 안에서', categoryTag: '#차량·드라이브', wavFile: 'car_ko.wav' },
  { id: 'car_en', lang: 'en', q: 'inside a car', categoryTag: '#차량·드라이브', wavFile: 'car_en.wav' },
  {
    id: 'screenshot_ko',
    lang: 'ko',
    q: '휴대폰 스크린샷',
    categoryTag: '#스크린샷',
    trashCategory: 'screenshot',
    wavFile: 'screenshot_ko.wav',
  },
  {
    id: 'screenshot_en',
    lang: 'en',
    q: 'a screenshot of a phone screen',
    categoryTag: '#스크린샷',
    trashCategory: 'screenshot',
    wavFile: 'screenshot_en.wav',
  },
  {
    id: 'receipt_ko',
    lang: 'ko',
    q: '영수증',
    categoryTag: '#영수증·전표',
    trashCategory: 'receipt',
    wavFile: 'receipt_ko.wav',
  },
  {
    id: 'receipt_en',
    lang: 'en',
    q: 'a paper receipt',
    categoryTag: '#영수증·전표',
    trashCategory: 'receipt',
    wavFile: 'receipt_en.wav',
  },
  {
    id: 'blurry_ko',
    lang: 'ko',
    q: '흔들리고 초점이 나간 사진',
    categoryTag: '#초점이탈·블러',
    trashCategory: 'blurry',
    wavFile: 'blurry_ko.wav',
  },
  {
    id: 'blurry_en',
    lang: 'en',
    q: 'blurry out of focus photo',
    categoryTag: '#초점이탈·블러',
    trashCategory: 'blurry',
    wavFile: 'blurry_en.wav',
  },
  {
    id: 'document_ko',
    lang: 'ko',
    q: '글씨가 많은 문서',
    categoryTag: '#문서·서류',
    trashCategory: 'document',
    wavFile: 'document_ko.wav',
  },
  {
    id: 'document_en',
    lang: 'en',
    q: 'a document with lots of text',
    categoryTag: '#문서·서류',
    trashCategory: 'document',
    wavFile: 'document_en.wav',
  },
  { id: 'spatial_ko', lang: 'ko', q: '아이 왼쪽에 있는 강아지', categoryTag: '#공간구도·반려견', wavFile: 'spatial_ko.wav' },
  { id: 'spatial_en', lang: 'en', q: 'a dog to the left of a child', categoryTag: '#공간구도·반려견', wavFile: 'spatial_en.wav' },
  { id: 'object_ko', lang: 'ko', q: '책상 위에 놓인 물건', categoryTag: '#사물·데스크', wavFile: 'object_ko.wav' },
  { id: 'object_en', lang: 'en', q: 'objects on a desk', categoryTag: '#사물·데스크', wavFile: 'object_en.wav' },
];

// 내부 싱글톤 엔진 인스턴스
let searchModel: any = null;
let processor: any = null;
let tokenizer: any = null;
let searchModelHasAudio = false;
let searchModelLoading: Promise<boolean> | null = null;

// PoC 550장 실측 검색 캐시 (즉각 응답 및 오디오/텍스트 하이브리드 비교용)
export interface PrecomputedSearchEntry {
  kind: 'text' | 'audio' | 'audio-interleaved';
  query: string;
  presetId: string;
  lang: string;
  embedMs: number;
  searchMs: number;
  decodeMs?: number;
  audioSec?: number;
  top: { name: string; score: number }[];
}



export function enableOpfsCache() {
  if (opfsSupported()) {
    (env as any).useCustomCache = true;
    (env as any).customCache = opfsCache;
    (env as any).useBrowserCache = false;
  }
}

export async function detectHardwareTelemetry(): Promise<HardwareTelemetry> {
  const nav = navigator as any;
  const st = await storageInfo();
  const heap = (performance as any).memory?.usedJSHeapSize
    ? +((performance as any).memory.usedJSHeapSize / 1024 / 1024).toFixed(1)
    : null;

  const info: HardwareTelemetry = {
    secureContext: window.isSecureContext,
    webgpu: false,
    gpuVendor: 'WebGPU Adapter',
    gpuArchitecture: 'NPU/GPU',
    gpuDescription: '',
    shaderF16: false,
    maxBufferSizeMB: 2048,
    cpuThreads: navigator.hardwareConcurrency || 4,
    deviceMemoryGB: nav.deviceMemory ?? null,
    opfsSupported: opfsSupported(),
    opfsFiles: st.opfsFiles,
    opfsBytesMB: +(st.opfsBytes / 1024 / 1024).toFixed(1),
    persisted: st.persisted,
    jsHeapUsedMB: heap,
    avgPerImageMs: 2664, // PoC 550장 실측 평균 (2.66s)
    lastQueryMs: 51,
  };

  if (nav.gpu) {
    try {
      const adapter = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (adapter) {
        const ai = adapter.info ?? {};
        info.webgpu = true;
        info.gpuVendor = (ai.vendor || 'NVIDIA / WebGPU').toUpperCase();
        info.gpuArchitecture = ai.architecture || 'Pascal / Ampere';
        info.gpuDescription = ai.description || ai.device || '';
        info.shaderF16 = adapter.features.has('shader-f16');
        info.maxBufferSizeMB = Math.round((adapter.limits.maxBufferSize || 2147483648) / 1024 / 1024);
      }
    } catch {
      /* ignore */
    }
  }
  return info;
}


export function toRows(t: any): number[][] {
  const out = t.tolist();
  return Array.isArray(out[0]) ? out : [out];
}

export function normalizeVector(v: ArrayLike<number>, dim = DEFAULT_DIM): Float32Array {
  const o = new Float32Array(dim);
  let n = 0;
  for (let i = 0; i < dim; i++) {
    o[i] = v[i] ?? 0;
    n += o[i] * o[i];
  }
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < dim; i++) o[i] /= n;
  return o;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let s = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) s += a[i] * b[i];
  return s;
}

/**
 * 검색용 모델(텍스트 + 오디오 인코더 q4) OPFS 로드
 */
/**
 * [텍스트 질의 전용 인코더] 검색어 → 768차원 벡터 (오디오·비전 인코더 제외, q4 약 166MB · OPFS 캐시 후 재다운로드 없음)
 * - 사전 색인된 사진 벡터(`title: none | text: 캡션`)와 같은 모델·같은 차원이라 코사인 유사도로 바로 비교됩니다.
 * - 실측(2026-10-29, Node q4): '강아지' 질의 시 강아지 사진 0.77~0.79 vs 전체 중앙값 0.65 → 의미 검색 유효 확인.
 */
let textQueryModel: any = null;
let textQueryTokenizer: any = null;
let textQueryLoading: Promise<boolean> | null = null;
let cachedUsableWebGpuPromise: Promise<boolean> | null = null;

export function isIosDeviceRuntime(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1) return true;
  return false;
}

async function detectUsableWebGpu(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('gpu'in navigator)) return false;
  // [모바일(Android CrGpuMain ANR & DMA-BUF 스왑 고갈 / iOS WKWebView Jetsam OOM) 원천 차단]:
  // 스마트폰 WebView에서 수백 개 WGSL 셰이더 컴파일 및 거대 GPU DMA-BUF 할당 시 시스템 UI까지 멈추므로
  // 모바일은 Android·iOS 모두 단일 스레드 WASM q4 모드로 안전 고정하고 WebGPU는 데스크톱 전용으로 가동합니다.
  if (isMobileDeviceRuntime()) return false;
  if (!cachedUsableWebGpuPromise) {
    cachedUsableWebGpuPromise = (async () => {
      try {
        const adapter = await (navigator as any).gpu?.requestAdapter?.({
          powerPreference: 'high-performance',
        });
        return Boolean(adapter);
      } catch {
        return false;
      }
    })();
  }
  return cachedUsableWebGpuPromise;
}

export async function loadModelWithWebGpuToWasmFallback(config: any, dtypeSpec: any): Promise<any> {
  const canTryGpu = await detectUsableWebGpu();
  if (canTryGpu) {
    try {
      return await loadWithR2Fallback(() =>
        AutoModel.from_pretrained(MODEL_ID, {
          config,
          device: 'webgpu',
          dtype: dtypeSpec,
        } as any)
      );
    } catch (gpuErr) {
      console.warn('[Ghosti Engine] WebGPU 세션 생성 실패  WASM 모드로 자동 전환합니다:', gpuErr);
    }
  }
  return loadWithR2Fallback(() =>
    AutoModel.from_pretrained(MODEL_ID, {
      config,
      device: 'wasm',
      dtype: dtypeSpec,
    } as any)
  );
}

export function isTextQueryEncoderReady(): boolean {
  return Boolean(
    (searchModel && tokenizer) ||
      (textQueryModel && textQueryTokenizer) ||
      (sharedVisionModel && textQueryTokenizer)
  );
}

export async function ensureTextQueryEncoderLoaded(): Promise<boolean> {
  if (isTextQueryEncoderReady()) return true;
  if (textQueryLoading) return textQueryLoading;
  textQueryLoading = (async () => {
    try {
      enableOpfsCache();
      if (!textQueryTokenizer) {
        textQueryTokenizer = await loadWithR2Fallback(() => AutoTokenizer.from_pretrained(MODEL_ID));
      }
      if (sharedVisionModel) return true;
      if (sharedVisionLoadPromise) {
        const visionOk = await sharedVisionLoadPromise;
        if (visionOk && sharedVisionModel) return true;
      }
      const targetDtype = getOptimalEmbeddingDtype();
      const config: any = await loadWithR2Fallback(() => AutoConfig.from_pretrained(MODEL_ID));
      config.vision_config = null;
      config.audio_config = null;
      textQueryModel = await loadModelWithWebGpuToWasmFallback(config, targetDtype);
      return true;
    } catch (e) {
      console.warn('[Ghosti Engine] 텍스트 질의 인코더 로드 실패 — 키워드·태그 검색으로 동작합니다:', e);
      textQueryModel = null;
      return false;
    } finally {
      textQueryLoading = null;
    }
  })();
  return textQueryLoading;
}

export async function ensureSearchEngineLoaded(
  onProgress?: (msg: string, pct: number) => void
): Promise<boolean> {
  if (searchModel) return true;
  if (searchModelLoading) return searchModelLoading;

  searchModelLoading = (async () => {
    try {
      enableOpfsCache();
      await requestPersist();
      resetCacheStats();

      const targetDtype = getOptimalEmbeddingDtype();
      onProgress?.('검색 엔진 준비 중...', 15);
      const config: any = await loadWithR2Fallback(() => AutoConfig.from_pretrained(MODEL_ID));
      config.vision_config = null;

      const files = new Map<string, { loaded: number; total: number }>();
      const canUseGpuForSearch = await detectUsableWebGpu();
      searchModel = await loadWithR2Fallback(() =>
        AutoModel.from_pretrained(MODEL_ID, {
          config,
          device: canUseGpuForSearch ? 'webgpu' : 'wasm',
          dtype: {
            model: targetDtype,
            audio_encoder: targetDtype,
          },
        progress_callback: (p: any) => {
          if (p.status !== 'progress' || !p.file) return;
          files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
          let l = 0;
          let t = 0;
          files.forEach((f) => {
            l += f.loaded;
            t += f.total;
          });
          if (t > 0) {
            onProgress?.(
              `오디오+텍스트 인코더 준비 중 (${(l / 1024 / 1024).toFixed(0)}MB / ${(t / 1024 / 1024).toFixed(0)}MB)`,
              Math.round((l / t) * 100)
            );
          }
        },
      } as any));

      processor = await loadWithR2Fallback(() => AutoProcessor.from_pretrained(MODEL_ID));
      tokenizer = await loadWithR2Fallback(() => AutoTokenizer.from_pretrained(MODEL_ID));
      searchModelHasAudio = true;
      onProgress?.('Zero-STT 오디오 & 텍스트 엔진 준비 완료', 100);
      return true;
    } catch (e) {
      console.warn('[Ghosti Engine] WebGPU 오디오 모델 로드 실패, 하이브리드 인덱스 모드로 작동:', e);
      return false;
    } finally {
      searchModelLoading = null;
    }
  })();

  return searchModelLoading;
}


const REAL_MEDIA_VEC_DB_NAME = 'ghosti_real_media_vecs_v1';
const REAL_MEDIA_VEC_STORE = 'media_vectors';

interface StoredMediaVecRecord {
  key: string;
  vecBuffer: ArrayBuffer;
  thumbDataUrl?: string;
  semanticMeta?: CachedPhotoSemanticMeta;
  updatedAt: number;
}

let mediaVecDbPromise: Promise<IDBDatabase | null> | null = null;
let mediaCacheHydratePromise: Promise<void> | null = null;

function openRealMediaVecDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (mediaVecDbPromise) return mediaVecDbPromise;
  mediaVecDbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(REAL_MEDIA_VEC_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(REAL_MEDIA_VEC_STORE)) {
          db.createObjectStore(REAL_MEDIA_VEC_STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return mediaVecDbPromise;
}

export function hydrateRealMediaVectorCacheOnce(): Promise<void> {
  if (mediaCacheHydratePromise) return mediaCacheHydratePromise;
  mediaCacheHydratePromise = (async () => {
    const db = await openRealMediaVecDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(REAL_MEDIA_VEC_STORE, 'readonly');
        const store = tx.objectStore(REAL_MEDIA_VEC_STORE);
        const req = store.getAll();
        req.onsuccess = () => {
          const rows = (req.result as StoredMediaVecRecord[]) || [];
          for (const row of rows) {
            if (!row || !row.key) continue;
            let vec: Float32Array | null = null;
            if (row.vecBuffer && row.vecBuffer.byteLength === DEFAULT_DIM * 4) {
              vec = new Float32Array(row.vecBuffer);
            }
            if (row.key.startsWith('photo:') && vec) {
              hydratedPhotoVecMap.set(row.key, vec);
              if (row.semanticMeta) {
                hydratedPhotoMetaMap.set(row.key, row.semanticMeta);
              }
            } else if (row.key.startsWith('vframe:')) {
              if (vec) localVideoFrameVecMap.set(row.key, vec);
              if (row.thumbDataUrl) localVideoFrameThumbMap.set(row.key, row.thumbDataUrl);
            } else if (row.key.startsWith('vrep:')) {
              if (vec) localVideoFrameVecMap.set(row.key, vec);
              if (row.thumbDataUrl) localVideoRepThumbMap.set(row.key.slice(5), row.thumbDataUrl);
            }
          }
          resolve();
        };
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  })();
  return mediaCacheHydratePromise;
}

export async function persistMediaCacheEntry(
  key: string,
  vec: Float32Array | null,
  thumbDataUrl?: string,
  semanticMeta?: CachedPhotoSemanticMeta
): Promise<void> {
  const db = await openRealMediaVecDb();
  if (!db) return;
  try {
    const copyBuf = vec ? new Float32Array(vec).buffer : new ArrayBuffer(0);
    const tx = db.transaction(REAL_MEDIA_VEC_STORE, 'readwrite');
    tx.objectStore(REAL_MEDIA_VEC_STORE).put({
      key,
      vecBuffer: copyBuf,
      thumbDataUrl,
      semanticMeta,
      updatedAt: Date.now(),
    } satisfies StoredMediaVecRecord);
  } catch {
    /* ignore quota/storage error */
  }
}


/**
 * [CSLS 허브니스 보정용 다중 도메인 중립 기준 문장]
 * EmbeddingGemma 2 멀티모달 공간에서 어두운 암벽·복잡한 모바일 UI 화면 등 특정 프레임이
 * 모든 한국어 문장에 대해 공통적으로 높은 기본 코사인 유사도(Hubness)를 갖는 현상을 정밀 상쇄합니다.
 */
const HUBNESS_REFERENCE_PROMPTS: string[] = [  '실내 사무실 책상과 의자 컴퓨터 모니터',
  '푸른 숲속 나무와 초록 산책로 자연 풍경',
  '도심 거리 고층 건물과 도로 위 자동차',
  '식탁 위 접시에 담긴 따뜻한 음식과 요리',
  '흰 종이 문서 서류와 인쇄된 표 글자',
  '맑은 낮 하늘과 부드러운 흰 구름',
  '거실 소파와 조명 실내 인테리어 공간',
  '여러 사람이 실내외에 모여 대화하는 일상 모습',
  '공원 초록 잔디밭과 활짝 핀 꽃나무',
  '어두운 밤거리 가로등과 건물 네온 불빛',
  '운동장 트랙과 야외 스포츠 시설',
  '선반 위 생활용품과 작은 소품 물건들',
  '스마트폰 모바일 앱 화면 캡처 텍스트 버튼 인터페이스',
  '흰 배경 디지털 웹 대시보드 표 메뉴 아이콘 화면',
];

let cachedHubnessRefVecs: Float32Array[] | null = null;
let hubnessRefLoadingPromise: Promise<Float32Array[]> | null = null;
const frameHubnessScoreCache = new Map<string, number>();

export async function ensureHubnessReferenceVecsLoaded(): Promise<Float32Array[]> {
  if (cachedHubnessRefVecs && cachedHubnessRefVecs.length > 0) {
    return cachedHubnessRefVecs;
  }
  if (hubnessRefLoadingPromise) return hubnessRefLoadingPromise;

  hubnessRefLoadingPromise = (async () => {
    try {
      if (!isTextQueryEncoderReady()) {
        const ok = await Promise.race([          ensureTextQueryEncoderLoaded(),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3500)),
        ]);
        if (!ok && !isTextQueryEncoderReady()) return [];
      }
      const qModel =
        searchModel && tokenizer
          ? searchModel
          : textQueryModel
          ? textQueryModel
          : sharedVisionModel;
      const qTok = searchModel && tokenizer ? tokenizer : textQueryTokenizer;
      if (!qModel || !qTok) return [];

      const prefixed = HUBNESS_REFERENCE_PROMPTS.map((p) => QUERY_PREFIX + p);
      const rows = await Promise.race([        (async () => {
          const inputs = await qTok(prefixed, { padding: true, truncation: true });
          const out = await qModel(inputs);
          return toRows(out.sentence_embedding).map((r) => normalizeVector(r, DEFAULT_DIM));
        })(),
        new Promise<Float32Array[]>((resolve) => setTimeout(() => resolve([]), 3500)),
      ]);
      if (rows.length > 0) {
        cachedHubnessRefVecs = rows;
        frameHubnessScoreCache.clear();
      }
      return rows;
    } catch {
      return [];
    } finally {
      hubnessRefLoadingPromise = null;
    }
  })();

  return hubnessRefLoadingPromise;
}

export function computeFrameHubnessScore(
  frameKey: string,
  frameVec: Float32Array,
  refVecs: Float32Array[]
): number {
  if (!refVecs || refVecs.length === 0 || frameVec.length !== DEFAULT_DIM) return 0;
  const cached = frameHubnessScoreCache.get(frameKey);
  if (typeof cached === 'number') return cached;
  let sum = 0;
  for (let i = 0; i < refVecs.length; i++) {
    sum += cosineSimilarity(refVecs[i], frameVec);
  }
  const mean = sum / refVecs.length;
  frameHubnessScoreCache.set(frameKey, mean);
  return mean;
}

/**
 * 한국어 외래어·일상 시각 개념 검색어의 멀티모달(Vision↔Text) 교차 정렬 정밀도를 높이기 위한 순수 언어 확장 사전
 * (파일명·경로 의존성 0% — 오직 사용자의 검색 질의 문장만 시각 묘사로 보조 확장)
 */
const VISUAL_QUERY_CONCEPT_EXPANSIONS: Array<[RegExp, string]> = [  [/석양|노을|일몰|해질녘|황혼/, '붉은 석양 노을 일몰 주황빛 하늘 수평선 구름 해질녘 golden orange sunset twilight sky horizon clouds'],
  [/일출|해돋이|여명/, '아침 일출 해돋이 붉은 태양 수평선 sunrise morning sun over horizon sky'],
  [/비행기|항공기|기내|공항|창밖\s*하늘/, '비행기 창문 밖 하늘 구름 항공기 날개 공항 view from airplane window clouds sky wing airport'],
  [/동굴|암석|종유석|석회동굴/, '어두운 자연 동굴 암석 바위 종유석 dark natural cave rock formation cavern'],
  [/패러세일링|패러세일|낙하산\s*보트|해양\s*낙하산|낙하산/, '바다 하늘 무지개 낙하산 모터보트 패러세일링 parasailing colorful parachute flying in sky over blue ocean boat'],
  [/모터보트|보트|요트|쾌속정|배/, '푸른 바다 위 달리는 모터보트 하얀 물보라 요트 motorboat speedboat yacht white wake on blue sea'],
  [/씨워커|스노클링|스쿠버|바닷속|수중|잠수/, '바닷속 수중 잠수 스노클링 산호 물고기 underwater snorkeling scuba diving coral fish'],
  [/서핑|패들보드|카약|래프팅/, '바다 파도 서핑 보드 수상레저 surfing paddleboard kayak on water'],
  [/바다|해변|바닷가|해수욕장|백사장|모래사장|파도/, '푸른 바다 해변 파도 백사장 수평선 blue ocean sea sandy beach waves coastline'],
  [/수영장|풀장|물놀이|선베드|인피니티풀/, '야외 수영장 에메랄드빛 물 선베드 물놀이 swimming pool clear blue water sunbed resort'],
  [/야자수|리조트|휴양지|열대/, '열대 휴양지 야자수 나무 초록 잎 리조트 tropical palm trees green leaves resort'],
  [/가족|식구|대가족|부모님/, '가족 부모님 아이 식구들이 함께 모여 찍은 따뜻한 인물 사진 happy family parents and children together portrait'],
  [/단체|모임|일행|친구들|동료들|사람들/, '여러 사람 친구 동료들이 함께 모여 서거나 앉아 있는 단체 사진 group photo of many people friends smiling together'],
  [/커플|연인|부부|둘이/, '남녀 커플 부부 두 사람이 다정하게 함께 찍은 사진 couple man and woman standing together smiling'],
  [/셀카|독사진|단독|프로필/, '한 사람 단독 인물 클로즈업 셀카 포트레이트 close-up solo portrait selfie of one person'],
  [/아기|어린이|아이|유아|꼬마|자녀/, '귀여운 아기 어린이 아이 모습 cute young child kid baby playing'],
  [/선글라스|썬글라스/, '선글라스를 착용한 사람 얼굴 person wearing dark sunglasses outdoors'],
  [/웃는|웃고|미소|웃음|활짝|해맑/, '활짝 웃는 밝은 미소 행복한 표정 인물 person smiling happily bright grin'],
  [/꽃|벚꽃|장미|튤립|화단|꽃밭/, '활짝 핀 아름다운 꽃 벚꽃 꽃잎 정원 blooming colorful flowers cherry blossoms petals garden'],
  [/공원|산책|숲|나무|잔디|나무다리/, '푸른 공원 초록 나무 잔디밭 산책로 자연 풍경 green park trees lawn walking trail nature'],
  [/하늘|구름|맑은\s*날/, '푸른 하늘과 하얀 뭉게구름 맑은 날씨 clear blue sky fluffy white clouds sunny day'],
  [/야경|밤거리|밤하늘|불빛|네온/, '어두운 밤 화려한 도시 건물 불빛 야경 city night view illuminated buildings street lights'],
  [/건물|도시|거리|골목/, '도심 거리 건축물 건물 외관 풍경 urban city street buildings architecture'],
  [/자동차|차량|운전|드라이브|주차장|기둥/, '자동차 차량 도로 주차장 기둥 번호판 car vehicle road parking lot pillar'],
  [/룰렛|돌림판|원판\s*추첨/, '컬러 원형 룰렛 돌림판 추첨 이벤트 화면 colorful spinning roulette wheel game screen'],
  [/급식|식단표|메뉴\s*배틀/, '학교 급식 메뉴 배틀 식단표 스마트폰 앱 화면 school lunch menu battle mobile app screen'],
  [/리얼픽|투표|밸런스\s*게임/, '리얼픽 투표 선택 스마트폰 앱 화면 mobile poll voting app screen'],
  [/스크린샷|화면\s*캡처|화면캡처|캡처|화면\s*녹화|앱\s*화면/, '스마트폰 모바일 앱 컴퓨터 화면 캡처 스크린샷 인터페이스 screenshot mobile app UI screen capture'],
  [/영수증|전표|결제\s*내역|카드\s*전표/, '종이 영수증 카드 결제 전표 금액 인쇄 내역 paper receipt payment slip printed numbers'],
  [/세금계산서|계산서|계약서|문서|서류|증명서|등본|공문/, '흰 종이 문서 세금계산서 계약서 표 인쇄된 글자 printed white paper document tax invoice contract form table'],
  [/신분증|여권|주민등록증|운전면허증|명함/, '신분증 여권 증명사진 카드 명함 인적사항 ID card passport business card'],
  [/화이트보드|칠판|회의|판서|필기/, '화이트보드 칠판 손글씨 회의 메모 다이어그램 whiteboard chalkboard handwritten meeting notes'],
  [/호랑이|백호|맹수/, '호랑이 줄무늬 야생 동물 얼굴 클로즈업 tiger wild cat stripes animal closeup'],
  [/부엉이|올빼미|새|조류|앵무새|갈매기/, '새 조류 깃털 부엉이 날개 bird feathers wings avian wildlife'],
  [/늑대|여우/, '야생 늑대 여우 털 동물 얼굴 wolf fox furry wild animal'],
  [/강아지|반려견|멍멍이|시바견|비글|푸들|말티즈/, '귀여운 강아지 반려견 개 털 코 cute dog puppy pet'],
  [/고양이|반려묘|냥이|길냥이/, '귀여운 고양이 반려묘 털 수염 cute cat kitten pet'],
  [/토끼/, '귀여운 토끼 긴 귀 털 동물 cute rabbit bunny long ears'],
  [/햄스터|다람쥐|기니피그/, '작고 귀여운 햄스터 다람쥐 설치류 동물 cute small hamster squirrel rodent'],
  [/동물/, '귀여운 동물 강아지 고양이 야생동물 cute animal pet wildlife'],
  [/올리브|오일|유리병/, '투명 유리병 노란 올리브 오일 액체 glass bottle golden olive oil liquid'],
  [/먹방|숟가락|한입/, '사람이 숟가락으로 음식을 먹는 모습 person eating food with spoon'],
  [/생일|케이크|촛불/, '생일 파티 케이크 촛불 축하 birthday cake with lit candles celebration'],
  [/카페|커피|라떼|아메리카노|디저트|빵|음료/, '카페 테이블 커피 잔 라떼아트 디저트 베이커리 cafe coffee cup latte art dessert pastry'],
  [/맥주|와인|소주|술|건배|안주/, '테이블 위 맥주잔 와인잔 음료 건배 안주 beer glass wine drink toast on table'],
  [/캠핑|글램핑|불멍|텐트|타프/, '야외 캠핑장 텐트 타프 모닥불 outdoor camping tent tarp campfire'],
  [/등산|산행|트레킹|정상석|산\s*정상/, '산 정상 등산로 숲길 바위 풍경 mountain peak hiking trail forest rocks'],
  [/스키|스노우보드|설원|슬로프|보딩|눈\s*오는/, '겨울 눈 덮인 스키장 슬로프 스노우보드 설경 snowy ski slope snowboarding winter snow'],
  [/고기|삼겹살|스테이크|바비큐|갈비/, '구운 고기 스테이크 삼겹살 바비큐 요리 접시 grilled meat steak pork belly barbecue dish'],
  [/피자|파스타|치킨|햄버거|초밥|국밥|짬뽕|라면/, '식탁 위 피자 파스타 국물 요리 맛있는 식사 delicious pizza pasta soup dish meal on table'],
  [/음식|식사|맛집|요리|밥|상차림/, '식탁 위 접시에 차려진 맛있는 음식 요리 식사 delicious food dishes meal on dining table'],
];

let cachedEncodedQueryVecs = new Map<string, Float32Array[]>();
let pendingEncodeQueryMap = new Map<string, Promise<Float32Array[]>>();

export async function encodeMultimodalSearchQueryVecs(
  rawQuery: string,
  maxWaitMs?: number
): Promise<Float32Array[]> {
  const q = rawQuery.trim();
  if (!q) return [];
  const cached = cachedEncodedQueryVecs.get(q);
  if (cached && cached.length > 0) return cached;
  const inflight = pendingEncodeQueryMap.get(q);
  if (inflight) return inflight;

  const task = (async (): Promise<Float32Array[]> => {
    const waitMs = typeof maxWaitMs === 'number' && maxWaitMs > 0 ? Math.min(maxWaitMs, 5500) : 3800;
    if (!isTextQueryEncoderReady()) {
      const loadPromise = ensureTextQueryEncoderLoaded();
      const readyInTime = await Promise.race([        loadPromise,
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), waitMs)),
      ]);
      if (!readyInTime && !isTextQueryEncoderReady()) {
        return [];
      }
    }
    const qModel =
      searchModel && tokenizer
        ? searchModel
        : textQueryModel
        ? textQueryModel
        : sharedVisionModel;
    const qTok = searchModel && tokenizer ? tokenizer : textQueryTokenizer;
    if (!qModel || !qTok) return [];

    const coreQ = q
      .replace(
        /(동영상들?|영상들?|비디오|클립|사진만|사진들|사진|이미지|장면|모습|구간|부분|모아서|모아줘|골라줘|찾아줘|찾아|보여줘|보여|검색해줘|검색|찍어둔|찍은|나온|있는|해줘)/g,
        ' '
      )
      .replace(/\s+/g, ' ')
      .trim();

    const promptSet = new Set<string>();
    if (coreQ.length >= 1) {
      promptSet.add(QUERY_PREFIX + coreQ);
    }
    promptSet.add(QUERY_PREFIX + q);
    if (/[,/·]/.test(coreQ || q)) {
      const subTerms = (coreQ || q)
        .split(/[,/·]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2)
        .slice(0, 3);
      for (const st of subTerms) {
        promptSet.add(QUERY_PREFIX + st);
      }
    }

    const qLow = (coreQ || q).toLowerCase();
    let matchedExpansions = 0;
    for (const [rx, visualDesc] of VISUAL_QUERY_CONCEPT_EXPANSIONS) {
      if (rx.test(qLow) || rx.test(q.toLowerCase())) {
        promptSet.add(`${QUERY_PREFIX}${coreQ || q} ${visualDesc}`);
        matchedExpansions += 1;
        if (matchedExpansions >= 3) break;
      }
    }

    const prompts = Array.from(promptSet);
    try {
      const inferPromise = (async () => {
        const inputs = await qTok(prompts, { padding: true, truncation: true });
        const out = await qModel(inputs);
        const rows = toRows(out.sentence_embedding);
        return rows.map((r) => normalizeVector(r, DEFAULT_DIM));
      })();
      const encoded = await Promise.race([        inferPromise,
        new Promise<Float32Array[]>((resolve) => setTimeout(() => resolve([]), 4000)),
      ]);
      if (encoded.length > 0) {
        cachedEncodedQueryVecs.set(q, encoded);
      }
      return encoded;
    } catch {
      return [];
    } finally {
      pendingEncodeQueryMap.delete(q);
    }
  })();

  pendingEncodeQueryMap.set(q, task);
  return task;
}

const ANIMAL_QUERY_RX =
  /강아지|반려견|멍멍이|시바견|비글|푸들|말티즈|웰시코기|코기|불독|리트리버|고양이|반려묘|냥이|길냥이|호랑이|사자|코끼리|원숭이|토끼|햄스터|다람쥐|거북이|부엉이|올빼미|앵무새|갈매기|비둘기|오리|동물|\b(dog|puppy|cat|kitten|tiger|lion|rabbit|hamster|bird|animal)\b/i;
const HUMAN_EXPLICIT_QUERY_RX =
  /사람|인물|아이|아기|어린이|가족|엄마|아빠|부모님|할머니|할아버지|친구|동료|남자|여자|커플|셀카|단체|\b(person|people|family|baby|kid|child|man|woman)\b/i;

export function isNonHumanAnimalSearchQuery(query: string): boolean {
  const qLow = (query || '').toLowerCase().trim();
  if (!qLow || HUMAN_EXPLICIT_QUERY_RX.test(qLow)) return false;
  if (ANIMAL_QUERY_RX.test(qLow)) return true;
  const standaloneDog =
    /(?:^|\s)개(?:$|\s|가|를|랑|와|들|사진|영상|동영상)/.test(qLow) &&
    !/(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|몇|\d)\s*개(?:$|\s)/.test(qLow);
  return standaloneDog;
}

let cachedContrastiveNonAnimalVecs: Float32Array[] | null = null;
let pendingContrastiveNonAnimalPromise: Promise<Float32Array[]> | null = null;

/**
 * [동물 검색 대조 검증(Contrastive Margin) 앵커 벡터]:
 * '강아지'·'고양이' 등 동물 단독 검색 시 인물·휴양지·화면캡처·문서만 찍힌 영상/사진이
 * 상대 유사도 차이만으로 통과하는 현상을 수학적 대조 마진으로 원천 차단합니다.
 */
export async function getContrastiveNonAnimalAnchorVecs(
  maxWaitMs = 900
): Promise<Float32Array[]> {
  if (cachedContrastiveNonAnimalVecs && cachedContrastiveNonAnimalVecs.length > 0) {
    return cachedContrastiveNonAnimalVecs;
  }
  if (pendingContrastiveNonAnimalPromise) {
    return pendingContrastiveNonAnimalPromise;
  }
  pendingContrastiveNonAnimalPromise = (async () => {
    try {
      const [humanVecs, uiDocVecs] = await Promise.all([        encodeMultimodalSearchQueryVecs('사람 인물 얼굴 상반신 남녀 가족 휴양지 리조트 여행 셀카', maxWaitMs),
        encodeMultimodalSearchQueryVecs('스마트폰 앱 화면 캡처 문서 글자 건물 실내 풍경', maxWaitMs),
      ]);
      const combined = [...humanVecs.slice(0, 2), ...uiDocVecs.slice(0, 1)];
      if (combined.length > 0) {
        cachedContrastiveNonAnimalVecs = combined;
      }
      return combined;
    } catch {
      return [];
    } finally {
      pendingContrastiveNonAnimalPromise = null;
    }
  })();
  return pendingContrastiveNonAnimalPromise;
}

let sharedVisionModel: any = null;
let sharedVisionProcessor: any = null;
let sharedVisionLoadPromise: Promise<boolean> | null = null;
let sharedVisionIdleTimer: ReturnType<typeof setTimeout> | null = null;
let visionInferChain: Promise<unknown> = Promise.resolve();




/**
 * 동영상 모달 재생 중에는 백그라운드 AI 비전 추론(WebGPU/WASM) 및 로컬 Z-코어 썸네일/OCR 요청을 100% 일시정지하여
 * 저사양/4코어 데스크톱에서도 끊김 없는 60fps 영상 재생을 보장합니다.
 */
export function setVideoPlaybackActive(active: boolean): void {
  if (active) {
    aiRuntimeFlags.activeVideoPlaybackCount += 1;
  } else {
    aiRuntimeFlags.activeVideoPlaybackCount = Math.max(0, aiRuntimeFlags.activeVideoPlaybackCount - 1);
  }
}

export function isVideoPlaybackActive(): boolean {
  return aiRuntimeFlags.activeVideoPlaybackCount > 0;
}

export function bumpSharedVisionIdleDispose(ms = 30000): void {
  if (sharedVisionIdleTimer) {
    clearTimeout(sharedVisionIdleTimer);
  }
  sharedVisionIdleTimer = setTimeout(() => {
    sharedVisionIdleTimer = null;
    if (aiRuntimeFlags.priorityVideoSearchDepth > 0 || aiRuntimeFlags.silentMediaIndexingRunning) {
      bumpSharedVisionIdleDispose(ms);
      return;
    }
    if (sharedVisionModel) {
      const m = sharedVisionModel;
      sharedVisionModel = null;
      sharedVisionProcessor = null;
      Promise.resolve(m.dispose?.()).catch(() => {});
    }
  }, ms);
}

export async function disposeSharedVisionEncoderNow(): Promise<void> {
  if (sharedVisionIdleTimer) {
    clearTimeout(sharedVisionIdleTimer);
    sharedVisionIdleTimer = null;
  }
  if (sharedVisionModel) {
    const m = sharedVisionModel;
    sharedVisionModel = null;
    sharedVisionProcessor = null;
    await Promise.resolve(m.dispose?.()).catch(() => {});
  }
}

export async function releaseAllOnDeviceAiModelsForBackground(): Promise<void> {
  await disposeSharedVisionEncoderNow();
  if (textQueryModel) {
    const tm = textQueryModel;
    textQueryModel = null;
    await Promise.resolve(tm.dispose?.()).catch(() => {});
  }
  if (searchModel) {
    const sm = searchModel;
    searchModel = null;
    await Promise.resolve(sm.dispose?.()).catch(() => {});
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const onBgFree = () => {
    if (!isMobileDeviceRuntime()) return;
    if (document.visibilityState === 'hidden') {
      void releaseAllOnDeviceAiModelsForBackground();
    }
  };
  document.addEventListener('visibilitychange', onBgFree, { passive: true });
  window.addEventListener('pagehide', () => {
    if (isMobileDeviceRuntime()) {
      void releaseAllOnDeviceAiModelsForBackground();
    }
  }, { passive: true });
}

export async function acquireSharedVisionEncoder(): Promise<boolean> {
  if (sharedVisionModel && sharedVisionProcessor) {
    bumpSharedVisionIdleDispose();
    return true;
  }
  if (sharedVisionLoadPromise) return sharedVisionLoadPromise;

  sharedVisionLoadPromise = (async () => {
    try {
      // [모바일 OOM 방지]: 모바일 기기에서만 단독 textQueryModel을 먼저 해제하고, 데스크톱에서는 상시 0.01초 응답을 위해 유지합니다.
      if (textQueryModel && isMobileDeviceRuntime()) {
        const oldTextModel = textQueryModel;
        textQueryModel = null;
        await Promise.resolve(oldTextModel.dispose?.()).catch(() => {});
        await new Promise((r) => setTimeout(r, 80));
      }
      enableOpfsCache();
      const targetDtype = getOptimalEmbeddingDtype();
      if (!textQueryTokenizer) {
        textQueryTokenizer = await loadWithR2Fallback(() => AutoTokenizer.from_pretrained(MODEL_ID));
      }
      const config: any = await loadWithR2Fallback(() => AutoConfig.from_pretrained(MODEL_ID));
      config.audio_config = null;

      sharedVisionModel = await loadModelWithWebGpuToWasmFallback(config, {
        model: targetDtype,
        vision_encoder: targetDtype,
      });
      sharedVisionProcessor = await loadWithR2Fallback(() => AutoProcessor.from_pretrained(MODEL_ID));
      sharedVisionProcessor.image_processor.max_soft_tokens = VISION_TOKEN_BUDGET;
      bumpSharedVisionIdleDispose();
      return true;
    } catch (e) {
      console.warn('[Ghosti Engine] 멀티모달 비전 인코더 로드 실패:', e);
      sharedVisionModel = null;
      sharedVisionProcessor = null;
      return false;
    } finally {
      sharedVisionLoadPromise = null;
    }
  })();

  return sharedVisionLoadPromise;
}

export function embedRawImageWithSharedVision(rawImg: RawImage): Promise<Float32Array | null> {
  const run = async (): Promise<Float32Array | null> => {
    const ok = await acquireSharedVisionEncoder();
    if (!ok || !sharedVisionModel || !sharedVisionProcessor) return null;
    try {
      const inputs = await sharedVisionProcessor(null, [[rawImg]]);
      const out = await sharedVisionModel(inputs);
      bumpSharedVisionIdleDispose();
      return normalizeVector(toRows(out.sentence_embedding)[0], DEFAULT_DIM);
    } catch {
      return null;
    }
  };
  const next = visionInferChain.then(run, run);
  visionInferChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export interface DecodedKeyframeImage {
  timeSec: number;
  rawImg: RawImage;
  thumbDataUrl: string;
}

export function createCanvas2D(w: number, h: number): {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
} {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return { canvas: c, ctx: c.getContext('2d', { willReadFrequently: true }) };
  }
  const oc = new OffscreenCanvas(w, h);
  return { canvas: oc, ctx: oc.getContext('2d') };
}

export function canvasToJpegDataUrl(canvas: OffscreenCanvas | HTMLCanvasElement): string {
  try {
    if ('toDataURL'in canvas && typeof canvas.toDataURL === 'function') {
      return canvas.toDataURL('image/jpeg', 0.76);
    }
  } catch {
    /* ignore */
  }
  return '';
}

export async function decodeImageBlobToRawAndThumb(blob: Blob): Promise<{ rawImg: RawImage; thumbDataUrl: string } | null> {
  try {
    const bmp = await createImageBitmap(blob, {
      imageOrientation: 'from-image',
      resizeWidth: DECODE_SIDE,
      resizeQuality: 'medium',
    } as ImageBitmapOptions);
    const scale = Math.min(1, 448 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const { canvas, ctx } = createCanvas2D(w, h);
    if (!ctx) {
      bmp.close();
      return null;
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h).data;
    bmp.close();
    const rawImg = new RawImage(new Uint8ClampedArray(imgData.buffer), w, h, 4).rgb();
    const thumbDataUrl = canvasToJpegDataUrl(canvas);
    canvas.width = 0;
    canvas.height = 0;
    return { rawImg, thumbDataUrl };
  } catch {
    return null;
  }
}

let _staticCorpusCachePromise: Promise<{
  pocJson: any;
  auditJson: any;
  semJson: any;
}> | null = null;

export function getStaticCorpusCached(): Promise<{ pocJson: any; auditJson: any; semJson: any }> {
  if (typeof window !== 'undefined') {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.()) {
      return Promise.resolve({ pocJson: null, auditJson: null, semJson: null });
    }
    try {
      const parentCache =
        window.parent && window.parent !== window
          ? (window.parent as any).__GHOSTI_STATIC_CORPUS_CACHE__
          : null;
      if (parentCache) {
        (window as any).__GHOSTI_STATIC_CORPUS_CACHE__ = parentCache;
        return Promise.resolve(parentCache);
      }
      if ((window as any).__GHOSTI_STATIC_CORPUS_CACHE__) {
        return Promise.resolve((window as any).__GHOSTI_STATIC_CORPUS_CACHE__);
      }
    } catch {
      /* ignore */
    }
  }
  if (!_staticCorpusCachePromise) {
    _staticCorpusCachePromise = (async () => {
      const [pocRes, auditRes, semRes] = await Promise.all([        fetch('/poc/results/precomputed.json').catch(() => fetch(getZCoreUrl('/__poc/precomputed'))),
        fetch('/poc/results/corpus_physical_audit.json').catch(() =>
          fetch(getZCoreUrl('/__photos/physical-audit'))
        ),
        fetch('/poc/results/corpus_550_semantic_index.json').catch(() =>
          fetch(getZCoreUrl('/__photos/semantic-index'))
        ),
      ]);
      const [pocJson, auditJson, semJson] = await Promise.all([        pocRes.json().catch(() => null),
        auditRes.json().catch(() => null),
        semRes.json().catch(() => null),
      ]);
      const bundle = { pocJson, auditJson, semJson };
      if (typeof window !== 'undefined') {
        try {
          (window as any).__GHOSTI_STATIC_CORPUS_CACHE__ = bundle;
        } catch {
          /* ignore */
        }
      }
      return bundle;
    })();
  }
  return _staticCorpusCachePromise;
}

/**
 * [단일 SSOT] 기계적 출처·시스템 기본 태그 필터 정규식:
 * 귀신라벨러(YYMMDD_내용) 및 어휘 검색 시 '#내기기사진' 등 비내용성 메타 태그가 실제 피사체/문서 키워드처럼 오작동하는 현상을 원천 차단합니다.
 */
export const SHARED_PHOTO_BOILERPLATE_TAG_RX =
  /원본보존|연사|중복|내폰사진|내기기사진|내pc사진|스마트폰사진|자동인덱싱|온디바이스ai분류|선명한베스트컷|베스트컷|일상스냅|가족앨범|풍경스냅|정리파일|^(?:#?\s*(?:내폰|갤러리|다운로드|바탕화면|문서|사진|이미지|동영상|파일|스크린샷|화면캡처|캡처))$/i;

/**
 * [단일 SSOT] 동명 파일 충돌 방지용 해시 접미사(`__Downloads_b2e4f5` 등) 제거 유틸
 */
export function stripCollisionKeySuffix(nameOrStem: string): string {
  return String(nameOrStem || '').replace(/__[0-9A-Za-z가-힣_-]{1,18}_[0-9a-f]{6}(?=\.[^.]+$|$)/gi, '');
}

/**
 * [단일 SSOT] 카메라 픽셀(시각 벡터)만으로는 판별 불가능하고 반드시 텍스트(OCR·파일명·태그·여권 신원) 근거가 있어야 하는 직급·식별자 전용 질의 판별기:
 * - 예: '팀장', '과장', '대리', '사업자번호', '단가표', '비밀번호' 단독 검색 시
 *   무관한 일반 사무실 스톡 영상/사진('Office workers typing at desks')이 영어 임베딩 공간 근접성으로 오탐되는 현상을 사진·동영상 양쪽에서 100% 차단합니다.
 */
const NON_VISUAL_ROLE_OR_ID_TOKEN_RX =
  /^(?:사장|대표|회장|부회장|전무|상무|이사|본부장|실장|팀장|부장|차장|과장|대리|주임|계장|사원|인턴|소장|원장|관장|점장|지점장|교수|강사|담당자|거래처|발주처|수신자|발신자|작성자|결재자|사업자번호|등록번호|주민번호|계좌번호|비밀번호|비번|아이디|학번|사번|송장번호|승인번호|단가표|납품단가|계약금|잔금|중도금|세금계산서|견적서|이력서|사직서|품의서|기안서|시말서)(?:님|들)?$/i;

const EXPLICIT_VISUAL_SCENE_WORD_RX =
  /사무실|회의|컴퓨터|노트북|책상|모니터|바다|해변|산|등산|강아지|고양이|음식|커피|웃는|셀카|단체|야경|풍경|꽃|나무|하늘|운동|축구|수영|캠핑|차량|자동차|아이|가족/;

const LABEL_NOISE_TOKEN_RX =
  /^(?:파일|편집|보기|도움말|닫기|확인|취소|복사|저장|전체|검색|메뉴|로그인|홈|설정|선택|추가|삭제|이동|완료|이전|다음|목록|내역|번호|일자|날짜|시간|금액|합계)$/;

export function extractCrispKoreanLabelTokens(inputs: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of inputs) {
    if (!raw) continue;
    const cleaned = stripCollisionKeySuffix(String(raw))
      .replace(/📝\s*OCR\s*:/gi, ' ')
      .replace(/[#[\]()/\\:*?"<>|·•—–_.,!~`'"0-9a-zA-Z%-]+/g, ' ')
      .trim();
    if (!cleaned) continue;
    for (const part of cleaned.split(/\s+/)) {
      const tok = stripKoSearchParticle(part.trim(), true);
      if (tok.length < 2 || tok.length > 10) continue;
      if (!/[가-힣]{2,}/.test(tok)) continue;
      if (SHARED_PHOTO_BOILERPLATE_TAG_RX.test(tok) || LABEL_NOISE_TOKEN_RX.test(tok)) continue;
      if (!seen.has(tok)) {
        seen.add(tok);
        out.push(tok);
        if (out.length >= 4) return out;
      }
    }
  }
  return out;
}

export function formatQuickKoreanLabelCore(
  fileName: string,
  dateStr?: string,
  tagsOrTitle?: string | string[]
): string {
  const rawName = stripCollisionKeySuffix((fileName || '파일.jpg').trim());
  const dotIdx = rawName.lastIndexOf('.');
  const stem = dotIdx > 0 ? rawName.slice(0, dotIdx) : rawName;
  const ext = dotIdx > 0 ? rawName.slice(dotIdx) : '';

  let yymmdd = '';
  const mDate = (dateStr || '').match(/20(\d{2})[-./](\d{2})[-./](\d{2})/);
  if (mDate) {
    yymmdd = `${mDate[1]}${mDate[2]}${mDate[3]}`;
  } else if (/^1[5-9]\d{11}$/.test(stem)) {
    const dt = new Date(Number(stem));
    if (!Number.isNaN(dt.getTime())) {
      const yy = String(dt.getFullYear()).slice(-2);
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      yymmdd = `${yy}${mm}${dd}`;
    }
  } else {
    const mStemDate = stem.match(/20(\d{6})/);
    if (mStemDate) yymmdd = mStemDate[1];
  }
  if (!yymmdd) {
    const now = new Date();
    yymmdd = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  }

  const tagList = Array.isArray(tagsOrTitle)
    ? tagsOrTitle
    : typeof tagsOrTitle === 'string'
      ? [tagsOrTitle]
      : [];
  const cleanTokens = extractCrispKoreanLabelTokens(tagList);

  let slug = '';
  if (cleanTokens.length > 0) {
    slug = cleanTokens.slice(0, 2).join('_').slice(0, 20);
  } else if (/[가-힣]{2,}/.test(stem)) {
    const stemTokens = extractCrispKoreanLabelTokens([stem]);
    slug =
      stemTokens.length > 0
        ? stemTokens.slice(0, 2).join('_').slice(0, 20)
        : stem.replace(/[^0-9A-Za-z가-힣_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 18);
  } else {
    slug = '문서기록';
  }
  return `${yymmdd}_${slug}${ext}`;
}

export function isTextOrIdentityBoundQuery(query: string): boolean {
  const qClean = String(query || '').trim().toLowerCase();
  if (!qClean) return false;
  if (EXPLICIT_VISUAL_SCENE_WORD_RX.test(qClean)) return false;
  const rawWords = qClean.split(/[\s,./|]+/).filter(Boolean);
  if (rawWords.length === 0 || rawWords.length > 2) return false;
  return rawWords.every((w) => {
    const stripped = stripKoSearchParticle(w, rawWords.length === 1);
    return NON_VISUAL_ROLE_OR_ID_TOKEN_RX.test(w) || NON_VISUAL_ROLE_OR_ID_TOKEN_RX.test(stripped);
  });
}
