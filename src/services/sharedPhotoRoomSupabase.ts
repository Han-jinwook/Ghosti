import type { FamilyRoomId, LoungeType, PhotoItem } from '../types/saysee';
import {
  callGhostiServerBridge,
  ensureGhostiAuthedSupabaseClient,
  ensureGhostiPublicSupabaseClient,
  hasAuthenticatedHubAccountSession,
  readGhostiAuthedJwtClaims,
  supabase,
} from './supabaseClient';
import {
  loadMemberLocalRoomPhotos,
  purgeMemberLocalRoomVault,
  removeMemberLocalRoomPhotoEverywhere,
  upsertMemberLocalRoomPhotos,
} from './sharedRoomLocalVault';
import {
  resolveDefaultRoomTitle,
  saveVerifiedInviteRoomMeta,
  stripConsumedInviteParamsFromLoggedInUrl,
} from './shareInviteDeepLinkBridge';
import { getZCoreUrl } from './zCoreBridge';

/**
 * [2026-11-20 멀린님 확정 — 사진 공유방 14일(2주) 초대 골든타임 마중물 버퍼(TTL)]
 * - 서버 DB(ghosti_room_shared_photos)에는 초대 후 14일(2주) 동안만 13KB WebP 마중물 썸네일을 유지하여
 *   카톡 인앱 무가입 1초 프리뷰를 24시간 무중단 지원하고, 14일 경과분은 자동 만료·소거하여 영구 서버 누적 비용을 0원으로 방어합니다.
 * - 정식 합류 멤버의 기기에는 로컬 IndexedDB(계정 이메일 + room_id 격리)에 영구 보관되어 2주 뒤에도 0.05초 만에 전체 열람·검색되며,
 *   몇 달 뒤 다시 [💌 초대 링크 복사]를 누르면 로컬 보관함에서 빠진 13KB 썸네일이 1초 만에 서버 마중물 버퍼로 자동 재장전(Re-Seed)됩니다.
 */
export const SHARED_PHOTO_SEED_BUFFER_TTL_DAYS = 14;
export const SHARED_PHOTO_SEED_BUFFER_TTL_MS =
  SHARED_PHOTO_SEED_BUFFER_TTL_DAYS * 24 * 60 * 60 * 1000;

export function isWithinSeedBufferTtl(createdAtIso?: string | null): boolean {
  if (!createdAtIso) return true;
  const parsedMs = Date.parse(createdAtIso);
  if (Number.isNaN(parsedMs)) return true;
  return Date.now() - parsedMs <= SHARED_PHOTO_SEED_BUFFER_TTL_MS;
}

function buildSeedCutoffIso(): string {
  return new Date(Date.now() - SHARED_PHOTO_SEED_BUFFER_TTL_MS).toISOString();
}

interface EnsureRoomRpcResponse {
  ok?: boolean;
  roomId?: string;
  inviteToken?: string;
}

interface GuestPreviewPhotoDto {
  id: string;
  roomId: string;
  uploaderNickname: string;
  thumbWebpUrl: string;
  captionKo?: string;
  keywordsKo?: string[];
  facePersonNames?: string[];
  shotDateDisplay?: string | null;
  shotPlaceDisplay?: string | null;
  widthPx?: number;
  heightPx?: number;
  createdAt?: string;
  heartCount?: number;
  comments?: Array<{
    id: string;
    authorNickname: string;
    body: string;
    createdAt: string;
  }>;
}

interface GuestPreviewRoomRpcResponse {
  ok?: boolean;
  reason?: string;
  room?: {
    roomId: string;
    loungeType: string;
    subType?: string | null;
    roomTitle: string;
    hostNickname?: string;
  };
  photos?: GuestPreviewPhotoDto[];
}

export interface JoinedSharedPhotoRoomInfo {
  roomId: string;
  loungeType: LoungeType;
  familyRoom: FamilyRoomId;
  roomTitle: string;
  masterEmail?: string;
  masterNickname: string;
  inviteToken?: string;
}

const MY_ROOM_TOKEN_SESSION_PREFIX = 'ghosti_my_room_token_v1::';
const JOINED_ROOMS_SESSION_PREFIX = 'ghosti_joined_rooms_v1::';
const LEFT_ROOMS_LOCAL_PREFIX = 'ghosti_left_shared_rooms_v1::';

function readLocallyLeftRoomIdSet(email: string): Set<string> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(`${LEFT_ROOMS_LOCAL_PREFIX}${cleanEmail}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map((v) => String(v))) : new Set();
  } catch {
    return new Set();
  }
}

function recordLocallyLeftRoomId(email: string, roomId: string, left: boolean): void {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanRoomId = (roomId || '').trim();
  if (!cleanEmail || !cleanRoomId || typeof window === 'undefined') return;
  try {
    const set = readLocallyLeftRoomIdSet(cleanEmail);
    if (left) {
      set.add(cleanRoomId);
    } else {
      set.delete(cleanRoomId);
    }
    localStorage.setItem(`${LEFT_ROOMS_LOCAL_PREFIX}${cleanEmail}`, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

interface CachedRoomTokenEntry {
  roomId: string;
  inviteToken: string;
  masterNickname?: string;
  cachedAt: number;
}

const roomTokenCache = new Map<string, CachedRoomTokenEntry>();
const joinedRoomsMemoryCache = new Map<
  string,
  { rooms: JoinedSharedPhotoRoomInfo[]; cachedAt: number }
>();
const inflightEnsureRoomMap = new Map<
  string,
  Promise<{
    ok: boolean;
    roomId?: string;
    inviteToken?: string;
    masterNickname?: string;
    joinedRooms?: JoinedSharedPhotoRoomInfo[];
    error?: string;
  }>
>();

function saveCachedJoinedRooms(email: string, rooms: JoinedSharedPhotoRoomInfo[]): void {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return;
  const leftSet = readLocallyLeftRoomIdSet(cleanEmail);
  const filteredRooms = rooms.filter((r) => !leftSet.has(r.roomId));
  const payload = { rooms: filteredRooms, cachedAt: Date.now() };
  joinedRoomsMemoryCache.set(cleanEmail, payload);
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(`${JOINED_ROOMS_SESSION_PREFIX}${cleanEmail}`, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }
}

export function getCachedJoinedSharedRoomsSync(): JoinedSharedPhotoRoomInfo[] {
  if (!hasAuthenticatedHubAccountSession()) return [];
  const email = resolveCurrentAuthedEmail();
  if (!email) return [];
  const leftSet = readLocallyLeftRoomIdSet(email);
  const mem = joinedRoomsMemoryCache.get(email);
  if (mem && Date.now() - mem.cachedAt < 25 * 60 * 1000) {
    return mem.rooms.filter((r) => !leftSet.has(r.roomId));
  }
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(`${JOINED_ROOMS_SESSION_PREFIX}${email}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { rooms?: JoinedSharedPhotoRoomInfo[]; cachedAt?: number };
    if (
      Array.isArray(parsed?.rooms) &&
      typeof parsed.cachedAt === 'number' &&
      Date.now() - parsed.cachedAt < 25 * 60 * 1000
    ) {
      const cleanRooms = parsed.rooms.filter((r) => !leftSet.has(r.roomId));
      joinedRoomsMemoryCache.set(email, { rooms: cleanRooms, cachedAt: parsed.cachedAt });
      return cleanRooms;
    }
  } catch {
    /* ignore */
  }
  return [];
}

function saveCachedRoomTokenEntry(cacheKey: string, entry: CachedRoomTokenEntry): void {
  roomTokenCache.set(cacheKey, entry);
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(`${MY_ROOM_TOKEN_SESSION_PREFIX}${cacheKey}`, JSON.stringify(entry));
    } catch {
      /* ignore */
    }
  }
}

function readCachedRoomTokenEntry(cacheKey: string): CachedRoomTokenEntry | null {
  const mem = roomTokenCache.get(cacheKey);
  if (mem && Date.now() - mem.cachedAt < 25 * 60 * 1000) {
    return mem;
  }
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${MY_ROOM_TOKEN_SESSION_PREFIX}${cacheKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedRoomTokenEntry>;
    if (
      parsed?.roomId &&
      parsed?.inviteToken &&
      typeof parsed.cachedAt === 'number' &&
      Date.now() - parsed.cachedAt < 25 * 60 * 1000
    ) {
      const restored: CachedRoomTokenEntry = {
        roomId: parsed.roomId,
        inviteToken: parsed.inviteToken,
        masterNickname: parsed.masterNickname,
        cachedAt: parsed.cachedAt,
      };
      roomTokenCache.set(cacheKey, restored);
      return restored;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function clearCachedSharedRoomTokens(): void {
  roomTokenCache.clear();
  joinedRoomsMemoryCache.clear();
  inflightEnsureRoomMap.clear();
  if (typeof window !== 'undefined') {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i += 1) {
        const k = sessionStorage.key(i);
        if (
          k &&
          (k.startsWith(MY_ROOM_TOKEN_SESSION_PREFIX) || k.startsWith(JOINED_ROOMS_SESSION_PREFIX))
        ) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  }
}

export function mapUiLoungeToDbRoom(
  loungeType: LoungeType,
  familyRoom: FamilyRoomId
): { dbLoungeType: 'family' | 'club'; dbSubType: string } {
  if (loungeType === 'club') {
    return { dbLoungeType: 'club', dbSubType: '동호회' };
  }
  if (loungeType === 'student') {
    return { dbLoungeType: 'club', dbSubType: '동창회' };
  }
  return { dbLoungeType: 'family', dbSubType: familyRoom || '우리집' };
}

export function mapDbRoomToUiLounge(
  dbLoungeType: string,
  dbSubType?: string | null
): { loungeType: LoungeType; familyRoom: FamilyRoomId } {
  const lt = String(dbLoungeType || '').trim().toLowerCase();
  const st = String(dbSubType || '').trim();
  const stLower = st.toLowerCase();
  if (lt === 'club' || lt === 'student') {
    if (
      lt === 'student' ||
      st.includes('동창') ||
      stLower.includes('alumni') ||
      stLower.includes('student')
    ) {
      return { loungeType: 'student', familyRoom: '우리집' };
    }
    return { loungeType: 'club', familyRoom: '우리집' };
  }
  const fam: FamilyRoomId =
    st.includes('본가') || st.includes('친가') || stLower.includes('parent')
      ? '본가(친가)'
      : st.includes('처가') || st.includes('친정') || stLower.includes('inlaw')
      ? '처가(친정)'
      : '우리집';
  return { loungeType: 'family', familyRoom: fam };
}

const localPreviewDataUrlCache = new Map<string, string>();

export function registerLocalPhotoPreviewDataUrl(photoId: string, dataUrl: string): void {
  if (!photoId || !dataUrl || !dataUrl.startsWith('data:image/')) return;
  localPreviewDataUrlCache.set(photoId, dataUrl);
}

async function resolveReadableImageSourceUrl(photo: PhotoItem): Promise<string> {
  const cached = localPreviewDataUrlCache.get(photo.id);
  if (cached && cached.startsWith('data:image/')) {
    return cached;
  }
  const rawSrc = String(photo.thumbUrl || photo.fullUrl || '').trim();
  if (!rawSrc) return '';
  if (rawSrc.startsWith('data:image/')) return rawSrc;

  if (rawSrc.startsWith('http://127.0.0.1')) {
    try {
      const batchRes = await fetch(getZCoreUrl('/__photos/thumbs-batch'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              id: photo.id,
              path: photo.name,
              fullPath: photo.fullPath || '',
            },
          ],
        }),
      });
      if (batchRes.ok) {
        const json = (await batchRes.json()) as { thumbs?: Record<string, string> };
        const dataUrl = json?.thumbs?.[photo.id];
        if (dataUrl && dataUrl.startsWith('data:image/')) {
          localPreviewDataUrlCache.set(photo.id, dataUrl);
          return dataUrl;
        }
      }
    } catch {
      /* fallback to fetch blob below */
    }
  }

  try {
    const resp = await fetch(rawSrc);
    if (resp.ok) {
      const blob = await resp.blob();
      const asDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () =>
          resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
      });
      if (asDataUrl.startsWith('data:image/')) {
        return asDataUrl;
      }
    }
  } catch {
    /* ignore */
  }
  return rawSrc;
}

/**
 * 선택한 사진(data:, blob:, http://127.0.0.1:5199 등)을 『방식 A』 표준인
 * 약 13KB 초경량 WebP 썸네일 Data URL로 압축합니다.
 * - 5~20MB 원본은 절대 업로드하지 않으며, 타 기기에서 깨지는 로컬/블롭 주소(`127.0.0.1`, `blob:`)가
 *   그대로 저장되지 않도록 반드시 `data:image/...` 포맷만 반환합니다.
 */
export async function compressPhotoTo13KbWebpDataUrl(photo: PhotoItem): Promise<{
  thumbWebpUrl: string;
  widthPx: number;
  heightPx: number;
}> {
  const srcUrl = await resolveReadableImageSourceUrl(photo);
  if (!srcUrl) {
    return { thumbWebpUrl: '', widthPx: 0, heightPx: 0 };
  }
  if (srcUrl.startsWith('data:image/') && srcUrl.length <= 24_000) {
    return { thumbWebpUrl: srcUrl, widthPx: 420, heightPx: 420 };
  }
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return srcUrl.startsWith('data:image/')
      ? { thumbWebpUrl: srcUrl, widthPx: 420, heightPx: 420 }
      : { thumbWebpUrl: '', widthPx: 0, heightPx: 0 };
  }

  return new Promise((resolve) => {
    const img = new Image();
    if (!srcUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      try {
        const natW = img.naturalWidth || img.width || 420;
        const natH = img.naturalHeight || img.height || 420;
        const maxEdge = 420;
        const scale = Math.min(1, maxEdge / Math.max(natW, natH));
        const targetW = Math.max(1, Math.round(natW * scale));
        const targetH = Math.max(1, Math.round(natH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(
            srcUrl.startsWith('data:image/')
              ? { thumbWebpUrl: srcUrl, widthPx: natW, heightPx: natH }
              : { thumbWebpUrl: '', widthPx: 0, heightPx: 0 }
          );
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);

        let encoded = canvas.toDataURL('image/webp', 0.62);
        if (!encoded.startsWith('data:image/webp')) {
          encoded = canvas.toDataURL('image/jpeg', 0.62);
        }
        if (encoded.length > 26_000) {
          const smallerScale = Math.min(1, 320 / Math.max(natW, natH));
          canvas.width = Math.max(1, Math.round(natW * smallerScale));
          canvas.height = Math.max(1, Math.round(natH * smallerScale));
          const ctx2 = canvas.getContext('2d');
          if (ctx2) {
            ctx2.drawImage(img, 0, 0, canvas.width, canvas.height);
            encoded = canvas.toDataURL('image/webp', 0.52);
            if (!encoded.startsWith('data:image/webp')) {
              encoded = canvas.toDataURL('image/jpeg', 0.52);
            }
          }
        }
        resolve({
          thumbWebpUrl: encoded.startsWith('data:image/') ? encoded : '',
          widthPx: natW,
          heightPx: natH,
        });
      } catch {
        resolve(
          srcUrl.startsWith('data:image/')
            ? { thumbWebpUrl: srcUrl, widthPx: 420, heightPx: 420 }
            : { thumbWebpUrl: '', widthPx: 0, heightPx: 0 }
        );
      }
    };
    img.onerror = () => {
      resolve(
        srcUrl.startsWith('data:image/')
          ? { thumbWebpUrl: srcUrl, widthPx: 420, heightPx: 420 }
          : { thumbWebpUrl: '', widthPx: 0, heightPx: 0 }
      );
    };
    img.src = srcUrl;
  });
}

function dtoToPhotoItem(
  dto: GuestPreviewPhotoDto,
  loungeType: LoungeType,
  familyRoom: FamilyRoomId,
  ownerEmail?: string
): PhotoItem {
  const createdIso = dto.createdAt || new Date().toISOString();
  const createdMs = Date.parse(createdIso) || Date.now();
  const dateLabel =
    (dto.shotDateDisplay || '').trim() || createdIso.slice(0, 10);
  const placeLabel = (dto.shotPlaceDisplay || '').trim() || undefined;
  const kwList = Array.isArray(dto.keywordsKo) ? dto.keywordsKo : [];
  const personNames = Array.isArray(dto.facePersonNames) ? dto.facePersonNames : [];
  const personTags = personNames.map((n) => (n.startsWith('#') ? n : `#${n}`));
  const kwTags = kwList.slice(0, 6).map((k) => (k.startsWith('#') ? k : `#${k}`));
  const mergedTags = Array.from(new Set([...personTags, ...kwTags, '#공유사진방']));

  return {
    id: `shared_sb_${dto.id}`,
    name: `shared_${dto.id.slice(0, 8)}.webp`,
    size: 13_500,
    date: dateLabel,
    mtimeMs: createdMs,
    thumbUrl: dto.thumbWebpUrl,
    fullUrl: dto.thumbWebpUrl,
    tags: mergedTags,
    locationKo: placeLabel,
    captionKo: dto.captionKo || `${dto.uploaderNickname}님이 공유한 사진`,
    keywordsKo: Array.from(new Set([...kwList, ...personNames, dto.uploaderNickname])),
    isVaultDocument: false,
    uploaderLabel: dto.uploaderNickname || '멤버',
    sharedAddedAt: createdIso,
    sharedLoungeType: loungeType,
    sharedFamilyRoom: familyRoom,
    sharedRoomId: dto.roomId,
    sharedOwnerEmail: ownerEmail,
    sharedSupabasePhotoId: dto.id,
    sharedHeartCount: dto.heartCount ?? 0,
    sharedComments: dto.comments ?? [],
  };
}

function resolveCurrentAuthedEmail(): string {
  const jwtEmail = readGhostiAuthedJwtClaims()?.email;
  if (jwtEmail) return jwtEmail;
  if (typeof window === 'undefined') return '';
  try {
    return (
      localStorage.getItem('ghosti_hub_user_email') ||
      localStorage.getItem('userEmail') ||
      ''
    )
      .trim()
      .toLowerCase();
  } catch {
    return '';
  }
}

export function getPrewarmedRoomInviteTokenSync(
  loungeType: LoungeType,
  familyRoom: FamilyRoomId
): { roomId: string; inviteToken: string; masterNickname?: string } | null {
  if (!hasAuthenticatedHubAccountSession()) return null;
  const email = resolveCurrentAuthedEmail();
  if (!email) return null;
  const { dbLoungeType, dbSubType } = mapUiLoungeToDbRoom(loungeType, familyRoom);
  const cached = readCachedRoomTokenEntry(`${email}:${dbLoungeType}:${dbSubType}`);
  if (!cached?.roomId || !cached?.inviteToken) return null;
  return {
    roomId: cached.roomId,
    inviteToken: cached.inviteToken,
    masterNickname: cached.masterNickname,
  };
}

export async function readInstantLocalVaultSharedPhotos(
  loungeType: LoungeType,
  familyRoom: FamilyRoomId,
  explicitRoomId?: string | null
): Promise<PhotoItem[]> {
  if (!hasAuthenticatedHubAccountSession()) return [];
  const email = resolveCurrentAuthedEmail();
  if (!email) return [];
  const cleanExplicitRoomId = (explicitRoomId || '').trim();
  let targetRoomId = cleanExplicitRoomId;
  if (!targetRoomId) {
    const { dbLoungeType, dbSubType } = mapUiLoungeToDbRoom(loungeType, familyRoom);
    const cached = readCachedRoomTokenEntry(`${email}:${dbLoungeType}:${dbSubType}`);
    targetRoomId = cached?.roomId || '';
  }
  if (!targetRoomId) return [];
  try {
    // [안 A 1:1 room_id 절대 격리]: 단 1개의 targetRoomId 로컬 금고만 조회 (복수 방 합치기 영구 금지)
    return await loadMemberLocalRoomPhotos(email, targetRoomId);
  } catch {
    return [];
  }
}

export async function ensureMyRoomAndInviteToken(opts: {
  loungeType: LoungeType;
  familyRoom: FamilyRoomId;
  roomTitle: string;
  masterNickname: string;
  forceRefresh?: boolean;
}): Promise<{
  ok: boolean;
  roomId?: string;
  inviteToken?: string;
  masterNickname?: string;
  joinedRooms?: JoinedSharedPhotoRoomInfo[];
  error?: string;
}> {
  if (!hasAuthenticatedHubAccountSession()) {
    return { ok: false, error: 'AUTH_REQUIRED' };
  }
  const fastEmail = resolveCurrentAuthedEmail();
  if (fastEmail && !opts.forceRefresh) {
    const { dbLoungeType, dbSubType } = mapUiLoungeToDbRoom(opts.loungeType, opts.familyRoom);
    const fastCached = readCachedRoomTokenEntry(`${fastEmail}:${dbLoungeType}:${dbSubType}`);
    const cachedJoined = joinedRoomsMemoryCache.get(fastEmail);
    if (fastCached?.roomId && fastCached?.inviteToken && cachedJoined) {
      return {
        ok: true,
        roomId: fastCached.roomId,
        inviteToken: fastCached.inviteToken,
        masterNickname: fastCached.masterNickname,
        joinedRooms: cachedJoined.rooms,
      };
    }
  }
  const authed = await ensureGhostiAuthedSupabaseClient();
  if (!authed) {
    return { ok: false, error: 'SUPABASE_AUTH_FAILED' };
  }
  const email = resolveCurrentAuthedEmail();
  const cleanMasterNick = (opts.masterNickname || '').trim() || '방장';
  const { dbLoungeType, dbSubType } = mapUiLoungeToDbRoom(opts.loungeType, opts.familyRoom);
  const cacheKey = `${email}:${dbLoungeType}:${dbSubType}`;
  if (!opts.forceRefresh) {
    const cached = readCachedRoomTokenEntry(cacheKey);
    const cachedJoined = joinedRoomsMemoryCache.get(email);
    if (cached?.roomId && cached?.inviteToken && cachedJoined) {
      return {
        ok: true,
        roomId: cached.roomId,
        inviteToken: cached.inviteToken,
        masterNickname: cached.masterNickname,
        joinedRooms: cachedJoined.rooms,
      };
    }
  }

  const inflight = inflightEnsureRoomMap.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const task = (async () => {
    try {
      // 1순위: 서버 브릿지(service_role + 허브 계정 실검증)로 내 5대 방 토큰 일괄 예열 + 초대 합류한 타인 방 목록(joinedRooms) 독립 조회
      const bridgeRes = await callGhostiServerBridge<{
        roomId?: string;
        inviteToken?: string;
        masterNickname?: string;
        roomTokensByKey?: Record<
          string,
          { roomId: string; inviteToken: string }
        >;
        joinedRooms?: Array<{
          roomId: string;
          dbLoungeType?: string;
          dbSubType?: string;
          roomTitle?: string;
          masterEmail?: string;
          masterNickname?: string;
          inviteToken?: string;
        }>;
      }>('photo_resolve_accessible_rooms', {
        dbLoungeType,
        dbSubType,
        roomTitle: opts.roomTitle,
        masterNickname: cleanMasterNick,
      });

      if (bridgeRes.ok && bridgeRes.roomId && bridgeRes.inviteToken) {
        const resolvedNick = (bridgeRes.masterNickname || cleanMasterNick).trim() || '방장';
        const nowTs = Date.now();

        if (bridgeRes.roomTokensByKey && typeof bridgeRes.roomTokensByKey === 'object') {
          for (const [k, entry] of Object.entries(bridgeRes.roomTokensByKey)) {
            if (!entry?.roomId || !entry?.inviteToken) continue;
            const sepIdx = k.indexOf(':');
            const kLt = sepIdx >= 0 ? k.slice(0, sepIdx) : 'family';
            const kSt = sepIdx >= 0 ? k.slice(sepIdx + 1) : '우리집';
            const mappedUi = mapDbRoomToUiLounge(kLt, kSt);
            saveVerifiedInviteRoomMeta(entry.inviteToken, {
              loungeType: mappedUi.loungeType,
              familyRoom: mappedUi.familyRoom,
              hostName: resolvedNick,
              roomTitle:
                k === `${dbLoungeType}:${dbSubType}` ? opts.roomTitle : '',
            });
            saveCachedRoomTokenEntry(`${email}:${k}`, {
              roomId: entry.roomId,
              inviteToken: entry.inviteToken,
              masterNickname: resolvedNick,
              cachedAt: nowTs,
            });
          }
        }

        const parsedJoinedRooms: JoinedSharedPhotoRoomInfo[] = Array.isArray(bridgeRes.joinedRooms)
          ? bridgeRes.joinedRooms
              .filter((jr) => jr?.roomId)
              .map((jr) => {
                const mappedUi = mapDbRoomToUiLounge(
                  jr.dbLoungeType || 'family',
                  jr.dbSubType || '우리집'
                );
                return {
                  roomId: String(jr.roomId),
                  loungeType: mappedUi.loungeType,
                  familyRoom: mappedUi.familyRoom,
                  roomTitle:
                    String(jr.roomTitle || '').trim() ||
                    resolveDefaultRoomTitle(mappedUi.loungeType, mappedUi.familyRoom),
                  masterEmail: String(jr.masterEmail || '').trim().toLowerCase() || undefined,
                  masterNickname: String(jr.masterNickname || '').trim() || '방장',
                  inviteToken: String(jr.inviteToken || '').trim() || undefined,
                };
              })
          : [];
        saveCachedJoinedRooms(email, parsedJoinedRooms);

        saveVerifiedInviteRoomMeta(bridgeRes.inviteToken, {
          loungeType: opts.loungeType,
          familyRoom: opts.familyRoom,
          hostName: resolvedNick,
          roomTitle: opts.roomTitle,
        });
        saveCachedRoomTokenEntry(cacheKey, {
          roomId: bridgeRes.roomId,
          inviteToken: bridgeRes.inviteToken,
          masterNickname: resolvedNick,
          cachedAt: nowTs,
        });
        return {
          ok: true,
          roomId: bridgeRes.roomId,
          inviteToken: bridgeRes.inviteToken,
          masterNickname: resolvedNick,
          joinedRooms: parsedJoinedRooms,
        };
      }

      // 2순위 폴백: 직접 Supabase SECURITY DEFINER RPC 호출
      const { data, error } = await authed.rpc('ghosti_ensure_room_and_invite', {
        p_lounge_type: dbLoungeType,
        p_sub_type: dbSubType,
        p_room_title: opts.roomTitle,
        p_master_nickname: cleanMasterNick,
      });
      if (error || !data) {
        return { ok: false, error: error?.message || 'RPC_FAILED' };
      }
      const parsed = data as EnsureRoomRpcResponse;
      if (!parsed.ok || !parsed.roomId || !parsed.inviteToken) {
        return { ok: false, error: 'INVALID_RPC_RESULT' };
      }
      saveVerifiedInviteRoomMeta(parsed.inviteToken, {
        loungeType: opts.loungeType,
        familyRoom: opts.familyRoom,
        hostName: cleanMasterNick,
        roomTitle: opts.roomTitle,
      });
      saveCachedRoomTokenEntry(cacheKey, {
        roomId: parsed.roomId,
        inviteToken: parsed.inviteToken,
        masterNickname: cleanMasterNick,
        cachedAt: Date.now(),
      });
      return {
        ok: true,
        roomId: parsed.roomId,
        inviteToken: parsed.inviteToken,
        masterNickname: cleanMasterNick,
        joinedRooms: getCachedJoinedSharedRoomsSync(),
      };
    } finally {
      inflightEnsureRoomMap.delete(cacheKey);
    }
  })();

  inflightEnsureRoomMap.set(cacheKey, task);
  return task;
}

export async function fetchGuestPreviewRoomByToken(inviteToken: string): Promise<{
  ok: boolean;
  reason?: string;
  room?: {
    roomId: string;
    loungeType: LoungeType;
    familyRoom: FamilyRoomId;
    roomTitle: string;
    hostNickname: string;
  };
  photos: PhotoItem[];
}> {
  const cleanToken = (inviteToken || '').trim();
  const pubClient = supabase || (await ensureGhostiPublicSupabaseClient());
  if (!cleanToken || !pubClient) {
    return { ok: false, reason: 'MISSING_TOKEN', photos: [] };
  }
  const { data, error } = await pubClient.rpc('ghosti_get_guest_preview_room', {
    p_invite_token: cleanToken,
  });
  if (error || !data) {
    return { ok: false, reason: error?.message || 'RPC_ERROR', photos: [] };
  }
  const res = data as GuestPreviewRoomRpcResponse;
  if (!res.ok || !res.room) {
    return { ok: false, reason: res.reason || 'INVALID_INVITE', photos: [] };
  }
  const mappedLounge = mapDbRoomToUiLounge(res.room.loungeType, res.room.subType);
  const verifiedHostNickname = (res.room.hostNickname || '').trim() || '방장';
  saveVerifiedInviteRoomMeta(cleanToken, {
    loungeType: mappedLounge.loungeType,
    familyRoom: mappedLounge.familyRoom,
    hostName: verifiedHostNickname,
    roomTitle: res.room.roomTitle,
  });
  // 14일(2주) 초대 골든타임 마중물 버퍼(TTL) 이내의 유효 행만 카톡 무가입 1초 프리뷰로 노출
  const activeSeedRows = (res.photos || []).filter((row) =>
    isWithinSeedBufferTtl(row.createdAt)
  );
  const items = activeSeedRows.map((row) =>
    dtoToPhotoItem(row, mappedLounge.loungeType, mappedLounge.familyRoom)
  );
  return {
    ok: true,
    room: {
      roomId: res.room.roomId,
      loungeType: mappedLounge.loungeType,
      familyRoom: mappedLounge.familyRoom,
      roomTitle: res.room.roomTitle,
      hostNickname: verifiedHostNickname,
    },
    photos: items,
  };
}

async function purgeExpiredSeedPhotosAfterLocalArchive(
  authed: NonNullable<Awaited<ReturnType<typeof ensureGhostiAuthedSupabaseClient>>>,
  currentEmail: string,
  roomIds: string[]
): Promise<void> {
  if (!currentEmail || roomIds.length === 0) return;
  const cutoffIso = buildSeedCutoffIso();
  try {
    // 1) DB에 정식 청소 RPC(ghosti_purge_expired_photo_seed_buffer)가 배포된 경우 우선 호출
    await authed.rpc('ghosti_purge_expired_photo_seed_buffer', {
      p_room_ids: roomIds,
    });
  } catch {
    /* RPC 미적용 환경은 아래 직접 삭제 쿼리로 즉시 대체 */
  }
  try {
    // 2) 업로더 본인 소유 만료(14일 초과) 마중물 행 즉시 정리
    await authed
      .from('ghosti_room_shared_photos')
      .delete()
      .in('room_id', roomIds)
      .eq('uploader_email', currentEmail)
      .lt('created_at', cutoffIso);
  } catch {
    /* ignore transient network error */
  }
}

export async function acceptRoomInviteAsLoggedInMember(
  inviteToken: string,
  nickname: string
): Promise<{ ok: boolean; roomId?: string }> {
  const cleanToken = (inviteToken || '').trim();
  if (!cleanToken || !hasAuthenticatedHubAccountSession()) {
    return { ok: false };
  }
  const authed = await ensureGhostiAuthedSupabaseClient();
  if (!authed) return { ok: false };
  const { data, error } = await authed.rpc('ghosti_accept_room_invite', {
    p_token: cleanToken,
    p_nickname: (nickname || '').trim() || '새 멤버',
  });
  if (error || !data) {
    return { ok: false };
  }
  const memberRow = data as { room_id?: string };
  if (memberRow?.room_id) {
    const email = resolveCurrentAuthedEmail();
    if (email) {
      recordLocallyLeftRoomId(email, memberRow.room_id, false);
    }
    clearCachedSharedRoomTokens();
  }
  return { ok: Boolean(memberRow?.room_id), roomId: memberRow?.room_id };
}

export async function fetchScopedSharedRoomPhotos(opts: {
  loungeType: LoungeType;
  familyRoom: FamilyRoomId;
  roomTitle: string;
  nickname: string;
  inviteToken?: string;
  explicitRoomId?: string | null;
}): Promise<{
  roomId: string | null;
  inviteToken: string | null;
  hostNickname?: string;
  roomTitle?: string;
  joinedRooms?: JoinedSharedPhotoRoomInfo[];
  isJoinedOtherRoom?: boolean;
  photos: PhotoItem[];
}> {
  const cleanInviteToken = (opts.inviteToken || '').trim();
  const cleanExplicitRoomId = (opts.explicitRoomId || '').trim();
  const isLoggedIn = hasAuthenticatedHubAccountSession();

  // 1. 초대 토큰(?inviteToken=...)으로 접속한 경우: 해당 토큰의 방과 현재 보고 있는 뷰가 일치할 때만 그 단일 방 사진을 노출!
  let matchedInvitedRoomPhotos: PhotoItem[] = [];
  let matchedInvitedRoomMeta: {
    roomId: string;
    hostNickname?: string;
    roomTitle?: string;
  } | null = null;

  if (cleanInviteToken) {
    const previewRes = await fetchGuestPreviewRoomByToken(cleanInviteToken);
    if (previewRes.ok && previewRes.room) {
      const matchesCurrentView =
        (!cleanExplicitRoomId || previewRes.room.roomId === cleanExplicitRoomId) &&
        previewRes.room.loungeType === opts.loungeType &&
        (opts.loungeType !== 'family' || previewRes.room.familyRoom === opts.familyRoom);

      if (isLoggedIn) {
        await acceptRoomInviteAsLoggedInMember(cleanInviteToken, opts.nickname);
      }

      if (matchesCurrentView) {
        // 비로그인 게스트: IndexedDB에 단 1 Byte도 남기지 않고 메모리에서만 열람 후 창 닫을 때 0건 소멸 보장
        if (!isLoggedIn) {
          return {
            roomId: previewRes.room.roomId,
            inviteToken: cleanInviteToken,
            hostNickname: previewRes.room.hostNickname,
            roomTitle: previewRes.room.roomTitle,
            photos: previewRes.photos,
          };
        }
        matchedInvitedRoomPhotos = previewRes.photos;
        matchedInvitedRoomMeta = {
          roomId: previewRes.room.roomId,
          hostNickname: previewRes.room.hostNickname,
          roomTitle: previewRes.room.roomTitle,
        };
      }
    }
    // 비로그인 유저가 초대받지 않은 다른 방 탭(예: 본가/동호회)을 누르면 타인 사진 유출 0건(0장 빈 방) 보장!
    if (!isLoggedIn) {
      return { roomId: null, inviteToken: null, photos: [] };
    }
  }

  // 2. 초대 토큰 없이 비로그인 상태이면 무조건 0장 (이전 로그인 계정 로컬 캐시 노출 원천 차단)
  if (!isLoggedIn) {
    return { roomId: null, inviteToken: null, photos: [] };
  }

  // 3. 로그인 상태: [안 A 절대 보안 격리] 오직 단 1개의 targetRoomId(내 방 또는 선택한 타인 초대방)만 독립 조회!
  const authed = await ensureGhostiAuthedSupabaseClient();
  const currentEmail = resolveCurrentAuthedEmail();
  if (!authed) {
    if (currentEmail && matchedInvitedRoomMeta?.roomId) {
      const cached = await upsertMemberLocalRoomPhotos(
        currentEmail,
        matchedInvitedRoomMeta.roomId,
        matchedInvitedRoomPhotos
      );
      return {
        roomId: matchedInvitedRoomMeta.roomId,
        inviteToken: cleanInviteToken || null,
        photos: cached,
      };
    }
    return {
      roomId: matchedInvitedRoomMeta?.roomId || null,
      inviteToken: cleanInviteToken || null,
      photos: matchedInvitedRoomPhotos,
    };
  }

  const ensured = await ensureMyRoomAndInviteToken({
    loungeType: opts.loungeType,
    familyRoom: opts.familyRoom,
    roomTitle: opts.roomTitle,
    masterNickname: opts.nickname || '방장',
  });

  const joinedRooms = ensured.joinedRooms ?? getCachedJoinedSharedRoomsSync();
  const joinedMatch = cleanExplicitRoomId
    ? joinedRooms.find((jr) => jr.roomId === cleanExplicitRoomId)
    : matchedInvitedRoomMeta?.roomId && matchedInvitedRoomMeta.roomId !== ensured.roomId
    ? joinedRooms.find((jr) => jr.roomId === matchedInvitedRoomMeta?.roomId)
    : undefined;

  // 타인 초대방(explicitRoomId 또는 방금 수락한 타인 초대방)을 선택한 경우: 오직 그 단일 room_id만 조회!
  // 내 기본 탭(우리집/본가/처가/동호회/동창회)을 선택한 경우: 오직 내 방(ensured.roomId) 1개만 조회!
  const targetRoomId =
    cleanExplicitRoomId ||
    matchedInvitedRoomMeta?.roomId ||
    (ensured.ok && ensured.roomId ? ensured.roomId : '');
  const isJoinedOtherRoom = Boolean(
    targetRoomId && ensured.roomId && targetRoomId !== ensured.roomId
  );

  if (isLoggedIn && cleanInviteToken) {
    stripConsumedInviteParamsFromLoggedInUrl({
      loungeType: opts.loungeType,
      familyRoom: opts.familyRoom,
      joinedRoomId: isJoinedOtherRoom ? targetRoomId : null,
    });
  }

  if (!targetRoomId) {
    return {
      roomId: null,
      inviteToken: null,
      joinedRooms,
      isJoinedOtherRoom: false,
      photos: [],
    };
  }

  const { data, error } = await authed
    .from('ghosti_room_shared_photos')
    .select(
      'id, room_id, uploader_nickname, thumb_webp_url, caption_ko, keywords_ko, face_person_names, shot_date_display, shot_place_display, width_px, height_px, created_at'
    )
    .eq('room_id', targetRoomId)
    .eq('is_hidden_by_master', false)
    .order('created_at', { ascending: false })
    .limit(200);

  // 오프라인이거나 일시적 네트워크 장애 시에도 합류 멤버는 본인 기기 로컬 금고(IndexedDB)에서 해당 단일 room_id만 100% 열람!
  if (error || !Array.isArray(data)) {
    const localVaultPhotos = currentEmail
      ? await loadMemberLocalRoomPhotos(currentEmail, targetRoomId)
      : [];
    return {
      roomId: targetRoomId,
      inviteToken: isJoinedOtherRoom
        ? joinedMatch?.inviteToken || cleanInviteToken || null
        : ensured.inviteToken || null,
      hostNickname: joinedMatch?.masterNickname || matchedInvitedRoomMeta?.hostNickname,
      roomTitle: joinedMatch?.roomTitle || matchedInvitedRoomMeta?.roomTitle,
      joinedRooms,
      isJoinedOtherRoom,
      photos: localVaultPhotos.length > 0 ? localVaultPhotos : matchedInvitedRoomPhotos,
    };
  }

  const serverItems: PhotoItem[] = [];
  let hasExpiredRowsOnServer = false;

  for (const row of data) {
    const rId = String(row.room_id || '');
    if (rId !== targetRoomId) continue;
    const createdStr = String(row.created_at || '');
    if (!isWithinSeedBufferTtl(createdStr)) {
      hasExpiredRowsOnServer = true;
    }
    serverItems.push(
      dtoToPhotoItem(
        {
          id: String(row.id),
          roomId: rId,
          uploaderNickname: String(row.uploader_nickname || '멤버'),
          thumbWebpUrl: String(row.thumb_webp_url || ''),
          captionKo: String(row.caption_ko || ''),
          keywordsKo: Array.isArray(row.keywords_ko) ? (row.keywords_ko as string[]) : [],
          facePersonNames: Array.isArray(row.face_person_names)
            ? (row.face_person_names as string[])
            : [],
          shotDateDisplay: (row.shot_date_display as string | null) || null,
          shotPlaceDisplay: (row.shot_place_display as string | null) || null,
          widthPx: Number(row.width_px || 0),
          heightPx: Number(row.height_px || 0),
          createdAt: createdStr,
        },
        opts.loungeType,
        opts.familyRoom,
        currentEmail
      )
    );
  }

  if (matchedInvitedRoomMeta?.roomId === targetRoomId && matchedInvitedRoomPhotos.length > 0) {
    const seenIds = new Set(serverItems.map((p) => p.id));
    for (const invPhoto of matchedInvitedRoomPhotos) {
      if (!seenIds.has(invPhoto.id)) {
        serverItems.push({ ...invPhoto, sharedOwnerEmail: currentEmail || undefined });
        seenIds.add(invPhoto.id);
      }
    }
  }

  if (currentEmail) {
    if (serverItems.length > 0) {
      await upsertMemberLocalRoomPhotos(currentEmail, targetRoomId, serverItems);
    }
    if (hasExpiredRowsOnServer) {
      void purgeExpiredSeedPhotosAfterLocalArchive(authed, currentEmail, [targetRoomId]);
    }
    const localPhotos = await loadMemberLocalRoomPhotos(currentEmail, targetRoomId);
    // 서버에서 삭제되었거나 빈 방인데 로컬에 잘못 남았을 때를 제외하고, 14일 TTL 경과 후에도 합류 멤버 로컬 금고 영구 보존
    const mergedById = new Map<string, PhotoItem>();
    for (const item of serverItems) {
      mergedById.set(item.id, { ...item, sharedRoomId: targetRoomId, sharedOwnerEmail: currentEmail });
    }
    for (const item of localPhotos) {
      if (!mergedById.has(item.id) && (!item.sharedRoomId || item.sharedRoomId === targetRoomId)) {
        mergedById.set(item.id, {
          ...item,
          sharedLoungeType: opts.loungeType,
          sharedFamilyRoom: opts.familyRoom,
          sharedRoomId: targetRoomId,
          sharedOwnerEmail: currentEmail,
        });
      }
    }
    const finalPhotos = Array.from(mergedById.values()).sort(
      (a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0)
    );
    return {
      roomId: targetRoomId,
      inviteToken: isJoinedOtherRoom
        ? joinedMatch?.inviteToken || cleanInviteToken || null
        : ensured.inviteToken || null,
      hostNickname: joinedMatch?.masterNickname || matchedInvitedRoomMeta?.hostNickname,
      roomTitle: joinedMatch?.roomTitle || matchedInvitedRoomMeta?.roomTitle,
      joinedRooms,
      isJoinedOtherRoom,
      photos: finalPhotos,
    };
  }

  return {
    roomId: targetRoomId,
    inviteToken: isJoinedOtherRoom
      ? joinedMatch?.inviteToken || cleanInviteToken || null
      : ensured.inviteToken || null,
    hostNickname: joinedMatch?.masterNickname || matchedInvitedRoomMeta?.hostNickname,
    roomTitle: joinedMatch?.roomTitle || matchedInvitedRoomMeta?.roomTitle,
    joinedRooms,
    isJoinedOtherRoom,
    photos: serverItems,
  };
}

export async function uploadPhotosToSupabaseSharedRoom(opts: {
  roomId: string;
  loungeType: LoungeType;
  familyRoom: FamilyRoomId;
  uploaderUserId?: string;
  uploaderEmail: string;
  uploaderNickname: string;
  photos: PhotoItem[];
  preserveOriginalUploader?: boolean;
}): Promise<{ ok: boolean; uploadedPhotos: PhotoItem[]; error?: string }> {
  if (!hasAuthenticatedHubAccountSession()) {
    return { ok: false, uploadedPhotos: [], error: 'AUTH_REQUIRED' };
  }
  const authed = await ensureGhostiAuthedSupabaseClient();
  if (!authed) {
    return { ok: false, uploadedPhotos: [], error: 'SUPABASE_AUTH_FAILED' };
  }

  const jwtClaims = readGhostiAuthedJwtClaims();
  const cleanEmail = (jwtClaims?.email || opts.uploaderEmail || resolveCurrentAuthedEmail())
    .trim()
    .toLowerCase();
  if (!cleanEmail) {
    return { ok: false, uploadedPhotos: [], error: 'MISSING_UPLOADER_EMAIL' };
  }
  const cleanNick = opts.uploaderNickname.trim() || cleanEmail.split('@')[0] || '멤버';
  const validUuid =
    jwtClaims?.sub && /^[0-9a-f-]{36}$/i.test(jwtClaims.sub) ? jwtClaims.sub : null;

  const rowsToInsert: Array<Record<string, unknown>> = [];
  for (const p of opts.photos) {
    const compressed = await compressPhotoTo13KbWebpDataUrl(p);
    if (!compressed.thumbWebpUrl) continue;
    const itemUploaderNick =
      opts.preserveOriginalUploader && (p.uploaderLabel || '').trim()
        ? String(p.uploaderLabel).trim()
        : cleanNick;
    const personNames = (p.tags || [])
      .filter((t) => t.startsWith('#') && !t.includes('·') && t.length <= 12)
      .map((t) => t.slice(1));
    const kw = Array.from(
      new Set([
        ...(p.keywordsKo || []),
        ...(p.tags || []).map((t) => t.replace(/^#/, '')),
      ])
    ).slice(0, 20);

    rowsToInsert.push({
      room_id: opts.roomId,
      uploader_user_id: validUuid,
      uploader_email: cleanEmail,
      uploader_nickname: itemUploaderNick,
      dhash_64: p.dhash || null,
      thumb_webp_url: compressed.thumbWebpUrl,
      caption_ko: p.captionKo || '',
      keywords_ko: kw,
      face_person_names: personNames,
      shot_date_display: p.date || null,
      shot_place_display: p.locationKo || null,
      width_px: compressed.widthPx,
      height_px: compressed.heightPx,
      original_byte_size: p.size || 0,
      has_original_exif: Boolean(p.date || p.locationKo),
    });
  }

  if (rowsToInsert.length === 0) {
    return { ok: false, uploadedPhotos: [], error: 'NO_VALID_PHOTOS' };
  }

  const { data, error } = await authed
    .from('ghosti_room_shared_photos')
    .insert(rowsToInsert)
    .select(
      'id, room_id, uploader_nickname, thumb_webp_url, caption_ko, keywords_ko, face_person_names, shot_date_display, shot_place_display, width_px, height_px, created_at'
    );

  if (error || !Array.isArray(data)) {
    return { ok: false, uploadedPhotos: [], error: error?.message || 'INSERT_FAILED' };
  }

  const uploadedPhotos = data.map((row) =>
    dtoToPhotoItem(
      {
        id: String(row.id),
        roomId: String(row.room_id),
        uploaderNickname: String(row.uploader_nickname || cleanNick),
        thumbWebpUrl: String(row.thumb_webp_url || ''),
        captionKo: String(row.caption_ko || ''),
        keywordsKo: Array.isArray(row.keywords_ko) ? (row.keywords_ko as string[]) : [],
        facePersonNames: Array.isArray(row.face_person_names)
          ? (row.face_person_names as string[])
          : [],
        shotDateDisplay: (row.shot_date_display as string | null) || null,
        shotPlaceDisplay: (row.shot_place_display as string | null) || null,
        widthPx: Number(row.width_px || 0),
        heightPx: Number(row.height_px || 0),
        createdAt: String(row.created_at || ''),
      },
      opts.loungeType,
      opts.familyRoom,
      cleanEmail
    )
  );

  await upsertMemberLocalRoomPhotos(cleanEmail, opts.roomId, uploadedPhotos);

  return { ok: true, uploadedPhotos };
}

/**
 * [재초대 시 1초 자동 재장전(Re-Seed)]
 * - 14일(2주) 초대 골든타임이 지나 서버 DB(ghosti_room_shared_photos)에서 마중물 썸네일이 자동 소거된 뒤라도,
 *   방장이나 기존 멤버가 다시 [💌 초대 링크 복사]를 누르면 내 기기 로컬 영구 금고(IndexedDB)에 보관된
 *   해당 방의 13KB WebP 썸네일 중 서버에 빠져 있는 항목만 골라 1초 만에 마중물 버퍼(신규 14일 TTL)로 재장전합니다.
 */
export async function reseedRoomPhotosForInvite(opts: {
  roomId: string;
  loungeType: LoungeType;
  familyRoom: FamilyRoomId;
  uploaderNickname: string;
  fallbackPhotos?: PhotoItem[];
}): Promise<{ ok: boolean; reseededCount: number }> {
  if (!hasAuthenticatedHubAccountSession() || !opts.roomId) {
    return { ok: false, reseededCount: 0 };
  }
  const authed = await ensureGhostiAuthedSupabaseClient();
  if (!authed) {
    return { ok: false, reseededCount: 0 };
  }
  const jwtClaims = readGhostiAuthedJwtClaims();
  const cleanEmail = (jwtClaims?.email || resolveCurrentAuthedEmail()).trim().toLowerCase();
  if (!cleanEmail) {
    return { ok: false, reseededCount: 0 };
  }

  // 오직 이 방(opts.roomId)의 로컬 영구 금고에 정식 보관된 사진만 재장전 대상으로 한정!
  // (타인의 초대 합류 방 사진이 섞인 화면 fallbackPhotos를 끌어다 내 방 이름으로 자동 중복 업로드하는 현상 원천 차단)
  const vaultPhotos = await loadMemberLocalRoomPhotos(cleanEmail, opts.roomId);
  const candidatePool = vaultPhotos.filter(
    (cand) => !cand.sharedRoomId || cand.sharedRoomId === opts.roomId
  );
  if (candidatePool.length === 0) {
    return { ok: true, reseededCount: 0 };
  }

  const cutoffIso = buildSeedCutoffIso();
  const { data: activeRows } = await authed
    .from('ghosti_room_shared_photos')
    .select('id, dhash_64, thumb_webp_url, created_at')
    .eq('room_id', opts.roomId)
    .eq('is_hidden_by_master', false)
    .gte('created_at', cutoffIso)
    .limit(250);

  const activeIds = new Set<string>();
  const activeDhashes = new Set<string>();
  const activeThumbHeads = new Set<string>();
  if (Array.isArray(activeRows)) {
    for (const r of activeRows) {
      if (r?.id) activeIds.add(String(r.id));
      if (r?.dhash_64) activeDhashes.add(String(r.dhash_64));
      const th = String(r?.thumb_webp_url || '');
      if (th) activeThumbHeads.add(`${th.slice(0, 140)}:${th.length}`);
    }
  }

  const missingPhotos: PhotoItem[] = [];
  const seenCandidateHeads = new Set<string>();
  for (const cand of candidatePool) {
    const sbId =
      cand.sharedSupabasePhotoId ||
      (cand.id.startsWith('shared_sb_') ? cand.id.slice('shared_sb_'.length) : '');
    if (sbId && activeIds.has(sbId)) continue;
    if (cand.dhash && activeDhashes.has(String(cand.dhash))) continue;
    const rawThumb = String(cand.thumbUrl || '');
    const thumbSig = rawThumb ? `${rawThumb.slice(0, 140)}:${rawThumb.length}` : cand.id;
    if (rawThumb && activeThumbHeads.has(thumbSig)) continue;
    if (seenCandidateHeads.has(thumbSig)) continue;
    seenCandidateHeads.add(thumbSig);
    missingPhotos.push(cand);
    if (missingPhotos.length >= 120) break;
  }

  if (missingPhotos.length === 0) {
    return { ok: true, reseededCount: 0 };
  }

  const upRes = await uploadPhotosToSupabaseSharedRoom({
    roomId: opts.roomId,
    loungeType: opts.loungeType,
    familyRoom: opts.familyRoom,
    uploaderEmail: cleanEmail,
    uploaderNickname: opts.uploaderNickname || '방장',
    photos: missingPhotos,
    preserveOriginalUploader: true,
  });

  return {
    ok: upRes.ok,
    reseededCount: upRes.uploadedPhotos.length,
  };
}

export async function deleteSupabaseSharedRoomPhoto(photoItemId: string): Promise<boolean> {
  if (!hasAuthenticatedHubAccountSession()) return false;
  const currentEmail = resolveCurrentAuthedEmail();
  if (currentEmail) {
    await removeMemberLocalRoomPhotoEverywhere(currentEmail, photoItemId);
  }
  const authed = await ensureGhostiAuthedSupabaseClient();
  if (!authed) return false;
  const rawUuid = photoItemId.startsWith('shared_sb_')
    ? photoItemId.slice('shared_sb_'.length)
    : photoItemId;
  if (!/^[0-9a-f-]{36}$/i.test(rawUuid)) return false;
  const { error } = await authed.from('ghosti_room_shared_photos').delete().eq('id', rawUuid);
  return !error;
}

/**
 * [Step 6 — 공유방 나가기(자퇴) & 해당 공유방 로컬 IndexedDB 금고 0.1초 즉시 소거]
 * - 멤버가 초대받은 공유방에서 스스로 나가면 즉시当該 방의 로컬 금고(IndexedDB) 사진을 0 Byte로 비우고
 *   서버 멤버십(ghosti_room_members)에서 탈퇴합니다 (내 개인 귀신계 여권과 내 기기 사진은 100% 보존).
 */
export async function leaveSupabaseSharedPhotoRoom(roomId: string): Promise<boolean> {
  const cleanRoomId = (roomId || '').trim();
  if (!cleanRoomId) return false;
  const currentEmail = resolveCurrentAuthedEmail();
  if (currentEmail) {
    recordLocallyLeftRoomId(currentEmail, cleanRoomId, true);
    await purgeMemberLocalRoomVault(currentEmail, cleanRoomId);
    const existingJoined = getCachedJoinedSharedRoomsSync().filter((r) => r.roomId !== cleanRoomId);
    saveCachedJoinedRooms(currentEmail, existingJoined);
  }
  if (!hasAuthenticatedHubAccountSession()) return true;
  const authed = await ensureGhostiAuthedSupabaseClient();
  if (!authed) return true;
  try {
    const jwtClaims = readGhostiAuthedJwtClaims();
    if (jwtClaims?.sub && /^[0-9a-f-]{36}$/i.test(jwtClaims.sub)) {
      await authed
        .from('ghosti_room_members')
        .delete()
        .eq('room_id', cleanRoomId)
        .eq('member_user_id', jwtClaims.sub);
    }
    if (currentEmail) {
      await authed
        .from('ghosti_room_members')
        .delete()
        .eq('room_id', cleanRoomId)
        .eq('member_email', currentEmail);
    }
  } catch {
    /* ignore transient network error */
  }
  return true;
}

/**
 * [Step 6 — 방장의 멤버 내보내기(강퇴)]
 * - 방장이 특정 멤버를 공유방에서 내보내면 서버 멤버십(ghosti_room_members) 및 해당 멤버의 업로드 마중물을 정리합니다.
 */
export async function kickMemberFromSupabaseSharedPhotoRoom(
  roomId: string,
  memberNickname: string
): Promise<boolean> {
  const cleanRoomId = (roomId || '').trim();
  const cleanNick = (memberNickname || '').trim();
  if (!cleanRoomId || !cleanNick || !hasAuthenticatedHubAccountSession()) return false;
  const authed = await ensureGhostiAuthedSupabaseClient();
  if (!authed) return false;
  try {
    await authed
      .from('ghosti_room_members')
      .delete()
      .eq('room_id', cleanRoomId)
      .eq('nickname', cleanNick);
  } catch {
    /* ignore */
  }
  return true;
}
