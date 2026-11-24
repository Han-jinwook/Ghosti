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
import {
  isOnDeviceFaceScanRunning,
  runOnDeviceFacePassportScan,
  saveCachedOnDeviceFaceClusters,
} from './ai/onDeviceFacePassportEngine';
import { buildAutoMultiConditionSeedClusters } from '../store/slices/storeSharedRefs';

export type PassportRegMode = 'self' | 'family';

export const PASSPORT_REG_STATE_KEY = 'ghosti_passport_registration_v1';
export const PASSPORT_REG_PENDING_OPEN_KEY = 'ghosti_passport_reg_pending_open';
export const PASSPORT_REG_OPEN_EVENT = 'ghosti_passport_reg_open';
export const PASSPORT_REG_DONE_EVENT = 'ghosti_passport_reg_completed';
export const PASSPORT_REG_STATE_EVENT = 'ghosti_passport_reg_state_updated';
export const PASSPORT_SCAN_FINISHED_EVENT = 'ghosti_passport_scan_finished';

interface QueuedUserPassportWait {
  mode: PassportRegMode;
  nickname: string;
  requestedAt: number;
}

let queuedUserPassportWait: QueuedUserPassportWait | null = null;

export function queueUserPassportWait(mode: PassportRegMode, nickname: string): void {
  queuedUserPassportWait = { mode, nickname, requestedAt: Date.now() };
}

export function peekQueuedUserPassportWait(): QueuedUserPassportWait | null {
  if (!queuedUserPassportWait) return null;
  if (Date.now() - queuedUserPassportWait.requestedAt > 5 * 60 * 1000) {
    queuedUserPassportWait = null;
    return null;
  }
  return queuedUserPassportWait;
}

export function consumeQueuedUserPassportWait(): QueuedUserPassportWait | null {
  const cur = peekQueuedUserPassportWait();
  queuedUserPassportWait = null;
  return cur;
}

export function notifyPassportFaceScanFinished(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new Event(PASSPORT_REG_STATE_EVENT));
    window.dispatchEvent(new Event(PASSPORT_SCAN_FINISHED_EVENT));
  } catch {
    /* ignore */
  }
}

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
  /** 본인 여권에 확정 저장된 시기별 사진 영구 스냅샷 (클러스터 재스캔·ID 변경 시에도 내 프로필 여권이 절대 비지 않도록 보존) */
  confirmedSelfCuts?: YearlyFaceBestCut[];
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
  confirmedSelfCuts: [],
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
      confirmedSelfCuts: Array.isArray(parsed.confirmedSelfCuts) ? parsed.confirmedSelfCuts : [],
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

/** 얼굴 묶음의 시기별 사진 (없으면 대표 사진 1장, 동명 파일 복사본 중복 제거) */
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
      const rawKey = cut.representativePhoto || `y${cut.year}`;
      const baseKey = rawKey.replace(/__[0-9A-Za-z가-힣_-]{1,18}_[0-9a-f]{6}(?=\.[^.]+$)/i, '').toLowerCase();
      if (seen.has(baseKey)) return false;
      seen.add(baseKey);
      return true;
    })
    .sort((a, b) => b.year - a.year)
    .slice(0, MAX_CUTS_PER_PERSON);
}

/** 아직 묻지 않은(등록·거절 안 된) 시기별 사진 */
export function pendingCutsFor(c: FaceMemberCluster, st: PassportRegState): YearlyFaceBestCut[] {
  const confirmed = new Set(st.confirmedKeys);
  const rejected = new Set(st.rejectedKeys);
  const selfSavedPhotos =
    c.clusterId === st.selfClusterId
      ? new Set((st.confirmedSelfCuts || []).map((yc) => yc.representativePhoto).filter(Boolean))
      : new Set<string>();
  return clusterCuts(c).filter((cut) => {
    const k = cutKey(c.clusterId, cut);
    if (cut.representativePhoto && selfSavedPhotos.has(cut.representativePhoto)) return false;
    return !confirmed.has(k) && !rejected.has(k);
  });
}

/** 여권에 등록된 시기별 사진 (프로필 표시용 — 클러스터 컷 + 영구 보존된 확정 스냅샷 통합) */
export function confirmedCutsFor(c: FaceMemberCluster, st: PassportRegState): YearlyFaceBestCut[] {
  const confirmed = new Set(st.confirmedKeys);
  const rejected = new Set(st.rejectedKeys);
  const rejectedPhotosForCluster = new Set(
    st.rejectedKeys
      .filter((k) => k.startsWith(`${c.clusterId}::`))
      .map((k) => k.split('::')[1])
      .filter(Boolean)
  );
  const fromCluster = clusterCuts(c).filter((cut) => {
    const k = cutKey(c.clusterId, cut);
    return confirmed.has(k) && !rejected.has(k);
  });
  if (c.clusterId !== st.selfClusterId || !Array.isArray(st.confirmedSelfCuts) || st.confirmedSelfCuts.length === 0) {
    return fromCluster;
  }
  const seen = new Set(fromCluster.map((cut) => cut.representativePhoto).filter(Boolean));
  const merged = [...fromCluster];
  for (const snap of st.confirmedSelfCuts) {
    const pName = snap.representativePhoto || '';
    if (!pName || seen.has(pName) || rejectedPhotosForCluster.has(pName)) continue;
    seen.add(pName);
    merged.push(snap);
  }
  return merged.sort((a, b) => b.year - a.year).slice(0, MAX_CUTS_PER_PERSON);
}

export function findSelfCluster(st = loadPassportRegState()): FaceMemberCluster | null {
  if (!st.selfClusterId) return null;
  const clusters = liveClusters();
  let found = clusters.find((c) => c.clusterId === st.selfClusterId) || null;
  if (!found && (st.confirmedKeys.length > 0 || (st.confirmedSelfCuts?.length || 0) > 0)) {
    // 새로고침·재스캔 후 클러스터 ID가 갱신된 경우 확정 등록했던 사진 목록과의 일치 점수로 정확히 복원하고,
    // 같은 함수 내에서도 즉시 갱신된 st(nextSt)로 검사해 구 ID 참조로 빈 배열이 되는 버그를 원천 차단
    const confirmedPhotos = new Set<string>([
      ...st.confirmedKeys
        .filter((k) => k.startsWith(`${st.selfClusterId}::`))
        .map((k) => k.split('::')[1])
        .filter(Boolean),
      ...(st.confirmedSelfCuts || []).map((yc) => yc.representativePhoto).filter(Boolean),
    ]);
    if (confirmedPhotos.size > 0) {
      let bestCluster: FaceMemberCluster | null = null;
      let bestScore = 0;
      for (const c of clusters) {
        let score = 0;
        if (confirmedPhotos.has(c.representativePhoto)) score += 4;
        for (const yc of c.yearlyBestCuts || []) {
          if (confirmedPhotos.has(yc.representativePhoto)) score += 3;
        }
        for (const f of c.matchedPhotoFiles || []) {
          if (confirmedPhotos.has(f)) score += 1;
        }
        if (score > bestScore) {
          bestScore = score;
          bestCluster = c;
        }
      }
      found = bestScore > 0 ? bestCluster : null;
      if (found) {
        const oldId = st.selfClusterId;
        const migratedConfirmed = st.confirmedKeys.map((k) =>
          k.startsWith(`${oldId}::`) ? `${found!.clusterId}::${k.split('::')[1]}` : k
        );
        const migratedRejected = st.rejectedKeys.map((k) =>
          k.startsWith(`${oldId}::`) ? `${found!.clusterId}::${k.split('::')[1]}` : k
        );
        const nextSt: PassportRegState = {
          ...st,
          selfClusterId: found.clusterId,
          confirmedKeys: Array.from(new Set(migratedConfirmed)),
          rejectedKeys: Array.from(new Set(migratedRejected)),
        };
        savePassportRegState(nextSt);
        st = nextSt;
      }
    }
  }
  if (!found) return null;
  const hasConfirmed = confirmedCutsFor(found, st).length > 0;
  const hasPending = pendingCutsFor(found, st).length > 0;
  // 유저가 직접 본인 얼굴로 고른 묶음은 확정 컷 또는 대기 컷이 1장이라도 있으면 그대로 본인 여권으로 유지
  if (hasConfirmed || hasPending) return found;
  return null;
}

/**
 * [내 프로필 ➔ 여권] 및 채팅 완료 판정이 100% 동일한 단일 진실 공급원(SSOT)을 바라보도록 통합 조회
 * - 클러스터 ID 마이그레이션 전후 불일치나 백그라운드 재스캔 중에도 이미 등록한 내 여권 사진은 절대 비지 않고 그대로 표시됩니다.
 */
export function getConfirmedSelfPassportView(): {
  selfCluster: FaceMemberCluster | null;
  cuts: YearlyFaceBestCut[];
  regState: PassportRegState;
} {
  const initialSt = loadPassportRegState();
  const selfCluster = findSelfCluster(initialSt);
  const freshSt = loadPassportRegState();
  let cuts = selfCluster ? confirmedCutsFor(selfCluster, freshSt) : [];

  if (cuts.length === 0 && Array.isArray(freshSt.confirmedSelfCuts) && freshSt.confirmedSelfCuts.length > 0) {
    cuts = [...freshSt.confirmedSelfCuts].sort((a, b) => b.year - a.year);
  }

  // 구버전(confirmedSelfCuts 도입 직전)에 등록해 confirmedKeys만 남아 있는 경우 자동 복구 및 영구 백필
  if (cuts.length === 0 && freshSt.selfClusterId && freshSt.confirmedKeys.length > 0) {
    const targetPhotos = new Set(
      freshSt.confirmedKeys
        .filter((k) => k.startsWith(`${freshSt.selfClusterId}::`))
        .map((k) => k.split('::')[1])
        .filter(Boolean)
    );
    if (targetPhotos.size > 0) {
      const recovered: YearlyFaceBestCut[] = [];
      const seen = new Set<string>();
      for (const c of liveClusters()) {
        for (const yc of clusterCuts(c)) {
          if (yc.representativePhoto && targetPhotos.has(yc.representativePhoto) && !seen.has(yc.representativePhoto)) {
            seen.add(yc.representativePhoto);
            recovered.push(yc);
          }
        }
      }
      if (recovered.length > 0) {
        cuts = recovered.sort((a, b) => b.year - a.year);
        savePassportRegState({ ...freshSt, confirmedSelfCuts: cuts });
      }
    }
  }

  return { selfCluster, cuts, regState: freshSt };
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
  const store = useSaySeeStore.getState();
  const clusters = liveClusters();
  const qualifiedSelfCandidates = rankFaceClusters(clusters, MAX_FACES, PASSPORT_MIN_FACE_PHOTOS_FOR_ASK);

  if (clusters.length === 0 || qualifiedSelfCandidates.length === 0) {
    const justLoadedBootWindow = typeof performance !== 'undefined' && performance.now() < 10000;
    if (!engineConnected && (store.photos || []).length === 0 && !justLoadedBootWindow) {
      return `${nick}내 컴퓨터를 먼저 연결해 주시면 사진 속 얼굴을 찾아서 바로 보여드릴게요!`;
    }
    if ((store.photos || []).length > 0 && !isOnDeviceFaceScanRunning()) {
      void (async () => {
        try {
          const cur = useSaySeeStore.getState();
          const applyInterim = (nextClusters: FaceMemberCluster[], latestYear: number) => {
            if (nextClusters.length === 0) return;
            useSaySeeStore.setState({
              faceClusters: buildAutoMultiConditionSeedClusters(nextClusters),
              latestCorpusYear: latestYear,
            });
            window.dispatchEvent(new Event(PASSPORT_REG_STATE_EVENT));
          };
          const scanned = await runOnDeviceFacePassportScan(
            cur.photos,
            cur.faceClusters,
            true,
            applyInterim
          );
          applyInterim(scanned.clusters, scanned.latestCorpusYear);
        } catch {
          /* ignore */
        } finally {
          notifyPassportFaceScanFinished();
        }
      })();
    }
    if (isOnDeviceFaceScanRunning() || clusters.length === 0 || justLoadedBootWindow) {
      queueUserPassportWait(mode, nickname);
      return `${nick}아직 사진 속 얼굴을 찾는 중이에요. 다 찾으면 바로 알려드릴게요!`;
    }
    return `${nick}같은 분이 3장 이상 나온 인물 사진을 아직 찾지 못했어요. 새 사진이 들어오면 자동으로 찾아둘게요!`;
  }
  if (mode === 'family') {
    const st = loadPassportRegState();
    if (!findSelfCluster(st)) return null; // 본인부터 고르는 화면으로 자연스럽게 연결
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
  const latestStore = useSaySeeStore.getState();
  saveCachedOnDeviceFaceClusters(latestStore.faceClusters, latestStore.latestCorpusYear);
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
  let dismissedCount = 0;
  const registeredNames: string[] = [];

  for (const p of people) {
    const confirmedKeys = new Set(st.confirmedKeys);
    const rejectedKeys = new Set(st.rejectedKeys);
    p.rejectedCuts.forEach((cut) => {
      rejectedKeys.add(cutKey(p.clusterId, cut));
      confirmedKeys.delete(cutKey(p.clusterId, cut));
    });
    if (p.dismissPerson) {
      dismissedCount += 1;
      st = {
        ...st,
        rejectedKeys: Array.from(rejectedKeys),
        dismissedClusterIds: Array.from(new Set([...st.dismissedClusterIds, p.clusterId])),
      };
      continue;
    }

    const realName = p.realName.trim();
    const safeRealName = realName && !isRelationTagOnly(realName) ? realName : '';
    const existingConfirmedForCluster = Array.from(confirmedKeys).filter((k) => k.startsWith(`${p.clusterId}::`));

    // 사진을 모두 체크 해제해 선택된 사진이 0장이고 기존 확정 컷도 0장인 경우: 빈 여권으로 잘못 등록하지 않고 선택 해제만 반영
    if (p.acceptedCuts.length === 0 && existingConfirmedForCluster.length === 0) {
      st = {
        ...st,
        selfClusterId: mode === 'self' && st.selfClusterId === p.clusterId ? undefined : st.selfClusterId,
        confirmedKeys: Array.from(confirmedKeys),
        rejectedKeys: Array.from(rejectedKeys),
      };
      removeCutsFromCluster(
        p.clusterId,
        p.rejectedCuts.map((c) => c.representativePhoto).filter(Boolean)
      );
      continue;
    }

    p.acceptedCuts.forEach((cut) => confirmedKeys.add(cutKey(p.clusterId, cut)));
    st = { ...st, confirmedKeys: Array.from(confirmedKeys), rejectedKeys: Array.from(rejectedKeys) };

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
      const rejPhotoSet = new Set(p.rejectedCuts.map((c) => c.representativePhoto).filter(Boolean));
      const prevSelfCuts =
        st.selfClusterId === p.clusterId && Array.isArray(st.confirmedSelfCuts)
          ? st.confirmedSelfCuts.filter((c) => !rejPhotoSet.has(c.representativePhoto))
          : [];
      const seenSelfPhotos = new Set(prevSelfCuts.map((c) => c.representativePhoto).filter(Boolean));
      const mergedSelfCuts = [...prevSelfCuts];
      for (const ac of p.acceptedCuts) {
        if (!ac.representativePhoto || seenSelfPhotos.has(ac.representativePhoto)) continue;
        seenSelfPhotos.add(ac.representativePhoto);
        mergedSelfCuts.push(ac);
      }
      st = {
        ...st,
        selfClusterId: p.clusterId,
        confirmedSelfCuts: mergedSelfCuts.sort((a, b) => b.year - a.year).slice(0, MAX_CUTS_PER_PERSON),
      };
      registered += p.acceptedCuts.length || (safeRealName ? 1 : 0);
    } else if (p.acceptedCuts.length > 0) {
      if (safeRealName) {
        await store.registerFaceMember(p.clusterId, safeRealName, '', { silent: true });
        book = upsertPassportMember(book, safeRealName);
        if (!registeredNames.includes(safeRealName)) {
          registeredNames.push(safeRealName);
        }
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
  savePassportRegState({ ...st, firstOfferShown: registered > 0 || dismissedCount > 0 ? true : st.firstOfferShown });
  if (registered > 0 || dismissedCount > 0) {
    try {
      window.dispatchEvent(
        new CustomEvent(PASSPORT_REG_DONE_EVENT, { detail: { mode, registered, dismissedCount, names: registeredNames } })
      );
    } catch {
      /* ignore */
    }
  }
  return { registered };
}

/** 본인 얼굴 고르기 (등록 화면 1단계) — 가장 많은 얼굴 외 다른 인물을 골라도 이전 제외/거절 이력에 막히지 않고 즉시 사진 선택 화면으로 진입 */
export function pickSelfCluster(clusterId: string): void {
  const st = loadPassportRegState();
  const nextDismissed = st.dismissedClusterIds.filter((id) => id !== clusterId);
  const target = liveClusters().find((c) => c.clusterId === clusterId);
  let nextRejected = st.rejectedKeys;
  let nextConfirmed = st.confirmedKeys;
  // 이전에 가족 후보에서 [제외]하거나 컷을 모두 빼서 대기 컷이 0장이 된 인물이라도,
  // 유저가 직접 '내 얼굴'로 선택했다면 해당 인물의 거절/이전 가족 등록 키를 풀어 즉시 선택 화면에 띄운다.
  if (target) {
    const tempSt: PassportRegState = { ...st, selfClusterId: clusterId, dismissedClusterIds: nextDismissed };
    if (pendingCutsFor(target, tempSt).length === 0) {
      const prefix = `${clusterId}::`;
      nextRejected = st.rejectedKeys.filter((k) => !k.startsWith(prefix));
      nextConfirmed = st.confirmedKeys.filter((k) => !k.startsWith(prefix));
    }
  }
  savePassportRegState({
    ...st,
    selfClusterId: clusterId,
    dismissedClusterIds: nextDismissed,
    rejectedKeys: nextRejected,
    confirmedKeys: nextConfirmed,
  });
}

/** 본인 얼굴 등록 확정 전 다른 얼굴 후보로 되돌리기 */
export function clearSelfClusterPick(): void {
  const st = loadPassportRegState();
  savePassportRegState({ ...st, selfClusterId: undefined });
}

/** 프로필 ➔ 여권: 사진 1장 지우기 (지운 사진은 다시 추천하지 않음, 만약 내 여권의 모든 사진을 지웠다면 다시 얼굴을 고를 수 있도록 본인 선택 상태를 초기화) */
export function deletePassportCut(clusterId: string, cut: YearlyFaceBestCut): void {
  const st = loadPassportRegState();
  const k = cutKey(clusterId, cut);
  const photoName = cut.representativePhoto || '';
  const nextConfirmed = st.confirmedKeys.filter(
    (x) => x !== k && !(photoName && st.selfClusterId && x === `${st.selfClusterId}::${photoName}`)
  );
  const nextSelfCuts = (st.confirmedSelfCuts || []).filter(
    (yc) => yc.representativePhoto !== photoName || (!photoName && yc.year !== cut.year)
  );
  const nextRejected = Array.from(
    new Set([
      ...st.rejectedKeys,
      k,
      ...(photoName && st.selfClusterId ? [`${st.selfClusterId}::${photoName}`] : []),
    ])
  );
  const isDeletingSelf = clusterId === st.selfClusterId || clusterId === 'self';
  const remainingSelfConfirmed =
    nextConfirmed.filter((x) => st.selfClusterId && x.startsWith(`${st.selfClusterId}::`)).length +
    nextSelfCuts.length;
  const shouldResetSelfPick = isDeletingSelf && remainingSelfConfirmed === 0;
  if (shouldResetSelfPick) {
    try {
      sessionStorage.removeItem('ghosti_passport_offered_this_session');
    } catch {
      /* ignore */
    }
  }
  savePassportRegState({
    ...st,
    selfClusterId: shouldResetSelfPick ? undefined : st.selfClusterId,
    firstOfferShown: shouldResetSelfPick ? false : st.firstOfferShown,
    confirmedKeys: nextConfirmed,
    confirmedSelfCuts: shouldResetSelfPick ? [] : nextSelfCuts,
    rejectedKeys: nextRejected,
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
