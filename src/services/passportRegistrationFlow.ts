/**
 * 🪪 여권(귀신계 여권) 조용한 등록 흐름 — 2026-11-21 멀린님 확정 (D-35)
 *
 * 철학: 유저는 여권의 용어·규칙을 몰라도 된다. 뒤에서 조용히 찾고, 필요할 때만 짧게 묻는다.
 *  1) 첫날엔 '내 사진'만 등록 (이름은 실명, 별명은 내부적으로 함께 묶어 검색)
 *  2) 내 사진 등록이 끝나면, 가족으로 보이는 얼굴이 있을 때만 "가족 사진도 등록할까요?"를 따로 묻는다
 *  3) 이후에는 날짜 고정 없이 '사진 활동(검색·추가)'이 있을 때만, 활동 1회당 1번, 내 것 → 가족 순으로 묻는다
 *  4) 등록에서 뺀 사진 / 프로필에서 지운 사진은 다시 추천하지 않는다
 *  5) 비서에게 "여권 등록", "가족 얼굴 등록하자" 등으로 말하면 즉시 왼쪽 등록 화면을 연다
 *
 * 화면 용어: 유저 화면에는 '여권' / '시기별 다양한 여권사진 등록'만 쓴다 (슬롯·바구니 등 내부 용어 0건).
 */
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { FaceMemberCluster, YearlyFaceBestCut } from '../types/saysee';
import {
  loadGhostPassportBook,
  saveGhostPassportBook,
  loadGhostSecretaryState,
  upsertPassportMember,
  isRelationTagOnly,
} from './ghostSecretaryEngine';
import {
  buildPassportExtrasFromClusters,
  pushGhostPassportsToCloud,
} from './ghostPassportSync';

export type PassportRegMode = 'self' | 'family';

export const PASSPORT_REG_STATE_KEY = 'ghosti_passport_registration_v1';
export const PASSPORT_REG_PENDING_OPEN_KEY = 'ghosti_passport_reg_pending_open';
export const PASSPORT_REG_OPEN_EVENT = 'ghosti_passport_reg_open';
export const PASSPORT_REG_DONE_EVENT = 'ghosti_passport_reg_completed';
export const PASSPORT_REG_STATE_EVENT = 'ghosti_passport_reg_state_updated';

/** 사진이 거의 없는 업무용 PC는 여권 질문 자체를 생략 (기존 기준 유지) */
/** 본인('나')·가족 공통 단일 기준: 동일 인물이 최소 3장 이상 등장할 때만 제안 (1~2장 행인·오탐 배제) */
export const PASSPORT_MIN_FACE_PHOTOS_FOR_ASK = 3;
/** '가족으로 보이는 얼굴' 최소 등장 사진 수 (본인과 동일하게 3장 이상) */
export const FAMILY_MIN_PHOTOS = 3;
/** 한 화면에 보여줄 최대 인원 / 사진 수 */
const MAX_FACES = 6;
const MAX_CUTS_PER_PERSON = 12;

export interface PassportRegState {
  /** 유저가 '이게 나'라고 고른 얼굴 묶음 */
  selfClusterId?: string;
  /** 여권에 등록된 사진 키 (`clusterId::photoFile`) */
  confirmedKeys: string[];
  /** 등록에서 뺐거나 프로필에서 지운 사진 키 → 다시 추천 금지 */
  rejectedKeys: string[];
  /** 가족 등록 화면에서 '이분은 아님'으로 뺀 얼굴 묶음 */
  dismissedClusterIds: string[];
  /** 첫 등록 제안을 한 번이라도 보여줬는지 */
  firstOfferShown?: boolean;
  /** 사진 활동 카운터 (검색·사진 추가 시 증가) */
  activitySeq: number;
  /** 마지막으로 질문(카드·칩)을 보여준 활동 번호 → 활동 1회당 1번만 */
  lastPromptedSeq?: number;
  /** 마지막 질문 시각(ms) — 같은 활동 흐름(30분) 안 중복 질문 차단 */
  lastPromptedAt?: number;
}

/** 하나의 '사진 활동' 흐름으로 묶는 시간 */
export const ACTIVITY_SESSION_MS = 30 * 60 * 1000;

const EMPTY_STATE: PassportRegState = {
  confirmedKeys: [],
  rejectedKeys: [],
  dismissedClusterIds: [],
  activitySeq: 0,
};

export function loadPassportRegState(): PassportRegState {
  try {
    const raw = localStorage.getItem(PASSPORT_REG_STATE_KEY);
    if (!raw) return { ...EMPTY_STATE };
    const parsed = JSON.parse(raw) as Partial<PassportRegState>;
    return {
      ...EMPTY_STATE,
      ...parsed,
      confirmedKeys: Array.isArray(parsed.confirmedKeys) ? parsed.confirmedKeys : [],
      rejectedKeys: Array.isArray(parsed.rejectedKeys) ? parsed.rejectedKeys : [],
      dismissedClusterIds: Array.isArray(parsed.dismissedClusterIds) ? parsed.dismissedClusterIds : [],
      activitySeq: typeof parsed.activitySeq === 'number' ? parsed.activitySeq : 0,
    };
  } catch {
    return { ...EMPTY_STATE };
  }
}

export function loadPassportFlowState(): {
  userRealName: string;
  userAliases: string[];
  myClusterId?: string;
  familyClusterIds: string[];
} {
  const reg = loadPassportRegState();
  const book = loadGhostPassportBook();
  const sec = loadGhostSecretaryState();
  const userRealName = (book.self?.realName || book.self?.nickname || sec.nickname || '').trim();
  const userAliases = Array.from(
    new Set([book.self?.nickname, sec.nickname].map((s) => String(s || '').trim()).filter(Boolean))
  );
  const confirmedClusterIds = Array.from(
    new Set(
      (reg.confirmedKeys || [])
        .map((k) => String(k || '').split('::')[0])
        .filter((cid) => cid && cid !== reg.selfClusterId)
    )
  );
  return {
    userRealName,
    userAliases,
    myClusterId: reg.selfClusterId,
    familyClusterIds: confirmedClusterIds,
  };
}

export function savePassportRegState(next: PassportRegState): void {
  try {
    localStorage.setItem(PASSPORT_REG_STATE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(PASSPORT_REG_STATE_EVENT, { detail: next }));
  } catch {
    /* ignore */
  }
}

export function cutKey(clusterId: string, cut: Pick<YearlyFaceBestCut, 'representativePhoto' | 'year'>): string {
  return `${clusterId}::${cut.representativePhoto || `y${cut.year}`}`;
}

function liveClusters(): FaceMemberCluster[] {
  return (useSaySeeStore.getState().faceClusters || []).filter((c) => !c.excludedAsPasserby);
}

/** 사진 수 기준 얼굴 묶음 순위 (동일 인물 3장 이상 등장한 묶음만 최다 등장 순으로 정렬) */
export function rankFaceClusters(
  clusters: FaceMemberCluster[],
  limit = MAX_FACES,
  minPhotos = PASSPORT_MIN_FACE_PHOTOS_FOR_ASK
): FaceMemberCluster[] {
  return clusters
    .filter((c) => !c.excludedAsPasserby && (c.matchedPhotoCount || 0) >= minPhotos)
    .slice()
    .sort((a, b) => (b.matchedPhotoCount || 0) - (a.matchedPhotoCount || 0))
    .slice(0, limit);
}

/** 인물 사진 수 (중복 파일 제거) — 업무용 PC 판별 */
export function countFacePhotos(clusters: FaceMemberCluster[]): number {
  const set = new Set<string>();
  clusters.filter((c) => !c.excludedAsPasserby).forEach((c) => (c.matchedPhotoFiles || []).forEach((f) => set.add(f)));
  const fallback = clusters.reduce((a, c) => a + (c.excludedAsPasserby ? 0 : c.matchedPhotoCount || 0), 0);
  return set.size || fallback;
}

/** 얼굴 묶음의 시기별 사진 (없으면 대표 사진 1장) */
export function clusterCuts(c: FaceMemberCluster): YearlyFaceBestCut[] {
  const cuts = Array.isArray(c.yearlyBestCuts) && c.yearlyBestCuts.length > 0
    ? c.yearlyBestCuts
    : [
        {
          year: c.representativeYear || new Date().getFullYear(),
          representativePhoto: c.representativePhoto,
          representativeDate: c.representativeDate,
          frontalScore: c.frontalScore,
          opticalSharpness: c.opticalSharpness,
          avatarUrl: c.avatarUrl,
          cropUrl: c.cropUrl,
          boundingBox: c.boundingBox,
        } as YearlyFaceBestCut,
      ];
  const seen = new Set<string>();
  return cuts
    .filter((cut) => {
      const k = cut.representativePhoto || `y${cut.year}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.year - a.year)
    .slice(0, MAX_CUTS_PER_PERSON);
}

/** 아직 묻지 않은(등록·거절 안 된) 시기별 사진 */
export function pendingCutsFor(c: FaceMemberCluster, st: PassportRegState): YearlyFaceBestCut[] {
  const confirmed = new Set(st.confirmedKeys);
  const rejected = new Set(st.rejectedKeys);
  return clusterCuts(c).filter((cut) => {
    const k = cutKey(c.clusterId, cut);
    return !confirmed.has(k) && !rejected.has(k);
  });
}

/** 여권에 등록된 시기별 사진 (프로필 표시용) */
export function confirmedCutsFor(c: FaceMemberCluster, st: PassportRegState): YearlyFaceBestCut[] {
  const confirmed = new Set(st.confirmedKeys);
  const rejected = new Set(st.rejectedKeys);
  return clusterCuts(c).filter((cut) => {
    const k = cutKey(c.clusterId, cut);
    return confirmed.has(k) && !rejected.has(k);
  });
}

export function findSelfCluster(st = loadPassportRegState()): FaceMemberCluster | null {
  if (!st.selfClusterId) return null;
  return liveClusters().find((c) => c.clusterId === st.selfClusterId) || null;
}

/** 가족으로 보이는 얼굴 묶음 (본인·뺀 얼굴 제외, 일정 사진 수 이상, 아직 물을 사진이 있는 경우) */
export function familyCandidates(st = loadPassportRegState()): FaceMemberCluster[] {
  const dismissed = new Set(st.dismissedClusterIds);
  return rankFaceClusters(liveClusters(), 30)
    .filter(
      (c) =>
        c.clusterId !== st.selfClusterId &&
        !dismissed.has(c.clusterId) &&
        (c.matchedPhotoCount || 0) >= FAMILY_MIN_PHOTOS &&
        pendingCutsFor(c, st).length > 0
    )
    .slice(0, MAX_FACES);
}

export interface PassportPendingSummary {
  /** 본인을 아직 고르지 않았고 고를 얼굴 후보가 있음 */
  needsSelfPick: boolean;
  selfPendingCount: number;
  familyPersonCount: number;
  familyPendingCount: number;
  /** 질문할 다음 단계 (내 것 우선) */
  nextMode: PassportRegMode | null;
}

export function summarizePassportPending(st = loadPassportRegState()): PassportPendingSummary {
  const clusters = liveClusters();
  // 본인·가족 공통 단일 기준: 동일 인물이 3장 이상 등장한 얼굴 묶음이 최소 1명 이상일 때
  const qualifiedClusters = rankFaceClusters(clusters, 30, PASSPORT_MIN_FACE_PHOTOS_FOR_ASK);
  const enoughFaces = qualifiedClusters.length > 0;
  const self = findSelfCluster(st);
  const needsSelfPick = !self && enoughFaces;
  const selfPendingCount = self ? pendingCutsFor(self, st).length : 0;
  const fam = self ? familyCandidates(st) : [];
  const familyPendingCount = fam.reduce((a, c) => a + pendingCutsFor(c, st).length, 0);
  const nextMode: PassportRegMode | null =
    needsSelfPick || selfPendingCount > 0 ? 'self' : fam.length > 0 ? 'family' : null;
  return {
    needsSelfPick,
    selfPendingCount,
    familyPersonCount: fam.length,
    familyPendingCount,
    nextMode,
  };
}

// ─────────────────────────────────────────────────────────────
// 사진 활동 트리거 (날짜 고정 없음)
// ─────────────────────────────────────────────────────────────
export function notePassportPhotoActivity(): void {
  const st = loadPassportRegState();
  // 첫 제안 이전(온보딩 중)에는 활동을 세지 않는다 — 첫날 흐름은 비서 대화가 직접 이끈다
  if (!st.firstOfferShown) return;
  if (st.lastPromptedSeq !== undefined && st.activitySeq > st.lastPromptedSeq) return; // 이미 대기 중인 활동이 있음
  // 같은 사진 활동 흐름(30분) 안에서는 한 번만 묻는다 — 인덱싱 중 사진 수 증가로 연달아 묻는 일 차단
  if (st.lastPromptedAt && Date.now() - st.lastPromptedAt < ACTIVITY_SESSION_MS) return;
  savePassportRegState({ ...st, activitySeq: st.activitySeq + 1 });
}

/** 이번 사진 활동에서 아직 묻지 않았고 물을 거리가 있으면 다음 단계 반환 */
export function passportPromptForActivity(): PassportRegMode | null {
  const st = loadPassportRegState();
  if (!st.firstOfferShown) return null;
  if (st.activitySeq <= (st.lastPromptedSeq ?? 0)) return null;
  return summarizePassportPending(st).nextMode;
}

let _activityWatcherStarted = false;
/**
 * 사진 활동 감지기 (앱 1회 기동)
 *  - 유저가 직접 검색을 실행했을 때(activeQuery 변경, 전체 갤러리 기본 표시 제외)
 *  - 새 사진이 들어왔을 때(photos 수 증가, 앱 기동 직후 첫 로딩 60초는 제외)
 *  - 연속 이벤트는 20초 단위로 묶어 '활동 1회'로 센다
 */
export function startPassportPhotoActivityWatcher(): void {
  if (_activityWatcherStarted || typeof window === 'undefined') return;
  _activityWatcherStarted = true;
  const bootAt = Date.now();
  let lastNoteAt = 0;
  let prevQuery = useSaySeeStore.getState().activeQuery;
  let prevPhotoCount = (useSaySeeStore.getState().photos || []).length;
  const note = () => {
    const now = Date.now();
    if (now - lastNoteAt < 20_000) return;
    lastNoteAt = now;
    notePassportPhotoActivity();
  };
  useSaySeeStore.subscribe((s) => {
    const q = s.activeQuery;
    if (q !== prevQuery) {
      prevQuery = q;
      if (typeof q === 'string' && q.trim() && !q.startsWith('전체 갤러리') && (s.searchResults || []).length > 0) {
        note();
      }
    }
    const count = (s.photos || []).length;
    if (count !== prevPhotoCount) {
      const increased = count > prevPhotoCount;
      prevPhotoCount = count;
      if (increased && Date.now() - bootAt > 60_000) note();
    }
  });
}

export function markPassportPrompted(): void {
  const st = loadPassportRegState();
  savePassportRegState({ ...st, lastPromptedSeq: st.activitySeq, lastPromptedAt: Date.now(), firstOfferShown: true });
}

export function markFirstOfferShown(): void {
  const st = loadPassportRegState();
  if (st.firstOfferShown) return;
  savePassportRegState({ ...st, firstOfferShown: true, lastPromptedSeq: st.activitySeq, lastPromptedAt: Date.now() });
}

// ─────────────────────────────────────────────────────────────
// 왼쪽 등록 화면 열기 (비서 명령 · 카드 · 검색 칩 공용)
// ─────────────────────────────────────────────────────────────
export function openPassportRegistration(mode: PassportRegMode): void {
  try {
    sessionStorage.setItem(PASSPORT_REG_PENDING_OPEN_KEY, mode);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(PASSPORT_REG_OPEN_EVENT, { detail: { mode } }));
  } catch {
    /* ignore */
  }
}

export function consumePendingPassportOpen(): PassportRegMode | null {
  try {
    const v = sessionStorage.getItem(PASSPORT_REG_PENDING_OPEN_KEY);
    sessionStorage.removeItem(PASSPORT_REG_PENDING_OPEN_KEY);
    return v === 'self' || v === 'family' ? v : null;
  } catch {
    return null;
  }
}

/** 비서 명령어 인식: "여권 등록", "내 사진 등록", "가족 얼굴 등록하자" 등 */
export function matchPassportRegCommand(text: string): PassportRegMode | null {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 40) return null;
  if (
    /가족\s*(얼굴|사진|여권)도?\s*(등록|추가|만들|하자|할래|해\s*줘)|가족\s*여권|가족도\s*등록|^(가족|인물)\s*(추가|등록)/.test(t)
  ) {
    return 'family';
  }
  if (
    /여권\s*(사진)?\s*(등록|추가|수정|다시|만들|하자|할래|해\s*줘)|내\s*(얼굴|사진)\s*(등록|추가)|^얼굴\s*(등록|다시)|여권\s*사진\s*(확인|등록)|시기별\s*다양한\s*여권/.test(t)
  ) {
    return 'self';
  }
  return null;
}

/** 등록 화면을 열 수 없는 상황(미연결·스캔 중·후보 없음)에 대한 정직한 안내 */
export function passportUnavailableReason(mode: PassportRegMode, nickname: string, engineConnected: boolean): string | null {
  const nick = nickname ? `${nickname}님, ` : '';
  const clusters = liveClusters();
  if (clusters.length === 0) {
    return engineConnected
      ? `${nick}아직 사진 속 얼굴을 찾는 중이에요. 다 찾으면 바로 알려드릴게요!`
      : `${nick}내 컴퓨터를 먼저 연결해 주시면 사진 속 얼굴을 찾아서 바로 보여드릴게요!`;
  }
  if (mode === 'family') {
    const st = loadPassportRegState();
    if (!st.selfClusterId) return null; // 본인부터 고르는 화면으로 자연스럽게 연결
    if (familyCandidates(st).length === 0) {
      return `${nick}지금은 새로 등록할 가족 얼굴이 없어요. 새 사진이 들어오면 다시 찾아볼게요!`;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// 실제 등록 (왼쪽 화면 [등록] 버튼)
// ─────────────────────────────────────────────────────────────
function stripTagFromPhotos(files: string[], tag: string): void {
  if (!tag || files.length === 0) return;
  const set = new Set(files);
  const store = useSaySeeStore.getState();
  useSaySeeStore.setState({
    photos: store.photos.map((p) => (set.has(p.name) ? { ...p, tags: (p.tags || []).filter((t) => t !== tag) } : p)),
  });
}

function addTagToPhotos(files: string[], tag: string): void {
  if (!tag || files.length === 0) return;
  const set = new Set(files);
  const store = useSaySeeStore.getState();
  useSaySeeStore.setState({
    photos: store.photos.map((p) =>
      set.has(p.name) && !(p.tags || []).includes(tag) ? { ...p, tags: [...(p.tags || []), tag] } : p
    ),
  });
}

/** 뺀 사진을 얼굴 묶음에서도 제거해 검색 오인식을 막는다 */
function removeCutsFromCluster(clusterId: string, rejectedFiles: string[]): void {
  if (rejectedFiles.length === 0) return;
  const rej = new Set(rejectedFiles);
  const store = useSaySeeStore.getState();
  const target = store.faceClusters.find((c) => c.clusterId === clusterId);
  useSaySeeStore.setState({
    faceClusters: store.faceClusters.map((c) =>
      c.clusterId !== clusterId
        ? c
        : {
            ...c,
            yearlyBestCuts: (c.yearlyBestCuts || []).filter((cut) => !rej.has(cut.representativePhoto)),
            matchedPhotoFiles: (c.matchedPhotoFiles || []).filter((f) => !rej.has(f)),
            matchedPhotoCount: Math.max(
              0,
              (c.matchedPhotoCount || 0) - (c.matchedPhotoFiles || []).filter((f) => rej.has(f)).length
            ),
          }
    ),
  });
  if (target?.registeredName) {
    stripTagFromPhotos(rejectedFiles, `#${target.registeredName.trim()}`);
  }
}

export interface PassportPersonSubmission {
  clusterId: string;
  /** 체크된(맞는) 사진 */
  acceptedCuts: YearlyFaceBestCut[];
  /** 체크 해제된(아닌) 사진 */
  rejectedCuts: YearlyFaceBestCut[];
  /** 이름 (본인은 실명 · 가족은 실명, 비워도 됨) */
  realName: string;
  /** 가족 화면에서 '이분 아님'으로 통째로 뺀 경우 */
  dismissPerson?: boolean;
}

export async function submitPassportRegistration(
  mode: PassportRegMode,
  people: PassportPersonSubmission[]
): Promise<{ registered: number }> {
  const store = useSaySeeStore.getState();
  let st = loadPassportRegState();
  let book = loadGhostPassportBook();
  const secSt = loadGhostSecretaryState();
  const nickname = (secSt.nickname || book.self?.nickname || '').trim();
  let registered = 0;
  const registeredNames: string[] = [];

  for (const p of people) {
    const confirmedKeys = new Set(st.confirmedKeys);
    const rejectedKeys = new Set(st.rejectedKeys);
    p.rejectedCuts.forEach((cut) => {
      rejectedKeys.add(cutKey(p.clusterId, cut));
      confirmedKeys.delete(cutKey(p.clusterId, cut));
    });
    if (p.dismissPerson) {
      st = {
        ...st,
        rejectedKeys: Array.from(rejectedKeys),
        dismissedClusterIds: Array.from(new Set([...st.dismissedClusterIds, p.clusterId])),
      };
      continue;
    }
    p.acceptedCuts.forEach((cut) => confirmedKeys.add(cutKey(p.clusterId, cut)));
    st = { ...st, confirmedKeys: Array.from(confirmedKeys), rejectedKeys: Array.from(rejectedKeys) };

    const realName = p.realName.trim();
    const safeRealName = realName && !isRelationTagOnly(realName) ? realName : '';

    if (mode === 'self') {
      // 공식 여권 이름 = 실명. 실명이 비어 있으면 검색용으로 별명을 임시 키로 쓰되 여권 이름은 비워 둔다.
      const searchKey = safeRealName || nickname;
      if (searchKey) {
        await store.registerFaceMember(p.clusterId, searchKey, '', { silent: true });
      }
      if (nickname && safeRealName && nickname !== safeRealName) {
        // 별명도 내부적으로 함께 묶어 별명으로 검색해도 찾아지게
        const cluster = useSaySeeStore.getState().faceClusters.find((c) => c.clusterId === p.clusterId);
        addTagToPhotos(cluster?.matchedPhotoFiles || [], `#${nickname}`);
      }
      book = {
        ...book,
        self: {
          isSelf: true,
          nickname: nickname || book.self?.nickname || safeRealName,
          realName: safeRealName || book.self?.realName,
        },
      };
      st = { ...st, selfClusterId: p.clusterId };
      registered += p.acceptedCuts.length;
    } else {
      if (safeRealName) {
        await store.registerFaceMember(p.clusterId, safeRealName, '', { silent: true });
        book = upsertPassportMember(book, safeRealName);
        registeredNames.push(safeRealName);
      }
      registered += p.acceptedCuts.length;
    }

    // 등록(서버 재동기화) 이후에 뺀 사진을 얼굴 묶음에서 제거해야 다시 섞이지 않는다
    removeCutsFromCluster(
      p.clusterId,
      p.rejectedCuts.map((c) => c.representativePhoto).filter(Boolean)
    );
  }

  saveGhostPassportBook(book);
  savePassportRegState({ ...st, firstOfferShown: true });
  try {
    window.dispatchEvent(new CustomEvent(PASSPORT_REG_DONE_EVENT, { detail: { mode, registered, names: registeredNames } }));
  } catch {
    /* ignore */
  }
  return { registered };
}

/** 본인 얼굴 고르기 (등록 화면 1단계) */
export function pickSelfCluster(clusterId: string): void {
  const st = loadPassportRegState();
  savePassportRegState({ ...st, selfClusterId: clusterId });
}

/** 프로필 ➔ 여권: 사진 1장 지우기 (지운 사진은 다시 추천하지 않음, 빈 자리는 이후 새 사진으로 조용히 채워짐) */
export function deletePassportCut(clusterId: string, cut: YearlyFaceBestCut): void {
  const st = loadPassportRegState();
  const k = cutKey(clusterId, cut);
  savePassportRegState({
    ...st,
    confirmedKeys: st.confirmedKeys.filter((x) => x !== k),
    rejectedKeys: Array.from(new Set([...st.rejectedKeys, k])),
  });
  if (cut.representativePhoto) removeCutsFromCluster(clusterId, [cut.representativePhoto]);
}

/** 프로필 ➔ 여권: 이름(실명) 수정 — 별명은 그대로 함께 묶임 */
export async function updateSelfPassportRealName(realName: string): Promise<void> {
  const clean = realName.trim();
  if (!clean || isRelationTagOnly(clean)) return;
  const book = loadGhostPassportBook();
  const nickname = (loadGhostSecretaryState().nickname || book.self?.nickname || clean).trim();
  saveGhostPassportBook({ ...book, self: { isSelf: true, nickname, realName: clean } });
  const st = loadPassportRegState();
  if (st.selfClusterId) {
    await useSaySeeStore.getState().registerFaceMember(st.selfClusterId, clean, '', { silent: true });
    if (nickname && nickname !== clean) {
      const cluster = useSaySeeStore.getState().faceClusters.find((c) => c.clusterId === st.selfClusterId);
      addTagToPhotos(cluster?.matchedPhotoFiles || [], `#${nickname}`);
    }
  }
  const ownerEmail = useSaySeeStore.getState().merlinAuth?.email || '';
  if (ownerEmail) {
    const selfCluster = st.selfClusterId
      ? useSaySeeStore.getState().faceClusters.find((c) => c.clusterId === st.selfClusterId)
      : undefined;
    void pushGhostPassportsToCloud(
      ownerEmail,
      useSaySeeStore.getState().layout === 'mobile' ? 'mobile' : 'pc',
      selfCluster
        ? buildPassportExtrasFromClusters([
            {
              name: clean,
              seedVecPreview: selfCluster.seedVecPreview,
              avatarUrl: selfCluster.avatarUrl,
              cropUrl: selfCluster.cropUrl,
            },
          ])
        : {}
    );
  }
}
