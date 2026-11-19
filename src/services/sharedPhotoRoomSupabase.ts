import type { FamilyRoomId, LoungeType, PhotoItem } from '../types/saysee';
import {
  ensureGhostiAuthedSupabaseClient,
  ensureGhostiPublicSupabaseClient,
  hasAuthenticatedHubAccountSession,
  readGhostiAuthedJwtClaims,
  supabase,
} from './supabaseClient';
import { getZCoreUrl } from './zCoreBridge';

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

const roomTokenCache = new Map<string, { roomId: string; inviteToken: string }>();

export function clearCachedSharedRoomTokens(): void {
  roomTokenCache.clear();
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
  if (dbLoungeType === 'club') {
    if (dbSubType === '동창회') {
      return { loungeType: 'student', familyRoom: '우리집' };
    }
    return { loungeType: 'club', familyRoom: '우리집' };
  }
  const fam: FamilyRoomId =
    dbSubType === '본가(친가)'
      ? '본가(친가)'
      : dbSubType === '처가(친정)'
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

export async function ensureMyRoomAndInviteToken(opts: {
  loungeType: LoungeType;
  familyRoom: FamilyRoomId;
  roomTitle: string;
  masterNickname: string;
}): Promise<{ ok: boolean; roomId?: string; inviteToken?: string; error?: string }> {
  if (!hasAuthenticatedHubAccountSession()) {
    return { ok: false, error: 'AUTH_REQUIRED' };
  }
  const authed = await ensureGhostiAuthedSupabaseClient();
  if (!authed) {
    return { ok: false, error: 'SUPABASE_AUTH_FAILED' };
  }
  const email = resolveCurrentAuthedEmail();
  const { dbLoungeType, dbSubType } = mapUiLoungeToDbRoom(opts.loungeType, opts.familyRoom);
  const cacheKey = `${email}:${dbLoungeType}:${dbSubType}`;
  const cached = roomTokenCache.get(cacheKey);
  if (cached?.roomId && cached?.inviteToken) {
    return { ok: true, roomId: cached.roomId, inviteToken: cached.inviteToken };
  }

  const { data, error } = await authed.rpc('ghosti_ensure_room_and_invite', {
    p_lounge_type: dbLoungeType,
    p_sub_type: dbSubType,
    p_room_title: opts.roomTitle,
    p_master_nickname: opts.masterNickname || '방장',
  });
  if (error || !data) {
    return { ok: false, error: error?.message || 'RPC_FAILED' };
  }
  const parsed = data as EnsureRoomRpcResponse;
  if (!parsed.ok || !parsed.roomId || !parsed.inviteToken) {
    return { ok: false, error: 'INVALID_RPC_RESULT' };
  }
  roomTokenCache.set(cacheKey, {
    roomId: parsed.roomId,
    inviteToken: parsed.inviteToken,
  });
  return {
    ok: true,
    roomId: parsed.roomId,
    inviteToken: parsed.inviteToken,
  };
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
  const items = (res.photos || []).map((row) =>
    dtoToPhotoItem(row, mappedLounge.loungeType, mappedLounge.familyRoom)
  );
  return {
    ok: true,
    room: {
      roomId: res.room.roomId,
      loungeType: mappedLounge.loungeType,
      familyRoom: mappedLounge.familyRoom,
      roomTitle: res.room.roomTitle,
      hostNickname: res.room.hostNickname || '방장',
    },
    photos: items,
  };
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
  return { ok: Boolean(memberRow?.room_id), roomId: memberRow?.room_id };
}

export async function fetchScopedSharedRoomPhotos(opts: {
  loungeType: LoungeType;
  familyRoom: FamilyRoomId;
  roomTitle: string;
  nickname: string;
  inviteToken?: string;
}): Promise<{
  roomId: string | null;
  inviteToken: string | null;
  hostNickname?: string;
  roomTitle?: string;
  photos: PhotoItem[];
}> {
  const cleanInviteToken = (opts.inviteToken || '').trim();
  const isLoggedIn = hasAuthenticatedHubAccountSession();

  // 1. 초대 토큰(?token=...)으로 접속한 경우: 해당 토큰의 방과 현재 보고 있는 탭이 일치할 때만 그 방 사진을 노출!
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
        previewRes.room.loungeType === opts.loungeType &&
        (opts.loungeType !== 'family' || previewRes.room.familyRoom === opts.familyRoom);

      if (isLoggedIn) {
        await acceptRoomInviteAsLoggedInMember(cleanInviteToken, opts.nickname);
      }

      if (matchesCurrentView) {
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

  // 3. 로그인 상태: 현재 로그인 계정의 자체 방 + 정식 멤버로 합류한 동일 탭 공유방(RLS 검증) 사진을 모두 정식 조회
  const authed = await ensureGhostiAuthedSupabaseClient();
  if (!authed) {
    return {
      roomId: matchedInvitedRoomMeta?.roomId || null,
      inviteToken: cleanInviteToken || null,
      photos: matchedInvitedRoomPhotos,
    };
  }
  const currentEmail = resolveCurrentAuthedEmail();
  const { dbLoungeType, dbSubType } = mapUiLoungeToDbRoom(opts.loungeType, opts.familyRoom);

  const ensured = await ensureMyRoomAndInviteToken({
    loungeType: opts.loungeType,
    familyRoom: opts.familyRoom,
    roomTitle: opts.roomTitle,
    masterNickname: opts.nickname || '방장',
  });

  const accessibleRoomIdSet = new Set<string>();
  if (ensured.ok && ensured.roomId) {
    accessibleRoomIdSet.add(ensured.roomId);
  }
  if (matchedInvitedRoomMeta?.roomId) {
    accessibleRoomIdSet.add(matchedInvitedRoomMeta.roomId);
  }

  const { data: memberRoomRows } = await authed
    .from('ghosti_lounge_rooms')
    .select('room_id')
    .eq('lounge_type', dbLoungeType)
    .eq('sub_type', dbSubType)
    .limit(20);
  if (Array.isArray(memberRoomRows)) {
    for (const r of memberRoomRows) {
      if (r?.room_id) accessibleRoomIdSet.add(String(r.room_id));
    }
  }

  const accessibleRoomIds = Array.from(accessibleRoomIdSet);
  if (accessibleRoomIds.length === 0) {
    return { roomId: null, inviteToken: null, photos: matchedInvitedRoomPhotos };
  }

  const { data, error } = await authed
    .from('ghosti_room_shared_photos')
    .select(
      'id, room_id, uploader_nickname, thumb_webp_url, caption_ko, keywords_ko, face_person_names, shot_date_display, shot_place_display, width_px, height_px, created_at'
    )
    .in('room_id', accessibleRoomIds)
    .eq('is_hidden_by_master', false)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !Array.isArray(data)) {
    return {
      roomId: ensured.roomId || accessibleRoomIds[0],
      inviteToken: ensured.inviteToken || null,
      photos: matchedInvitedRoomPhotos,
    };
  }

  const items: PhotoItem[] = data.map((row) =>
    dtoToPhotoItem(
      {
        id: String(row.id),
        roomId: String(row.room_id),
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
        createdAt: String(row.created_at || ''),
      },
      opts.loungeType,
      opts.familyRoom,
      currentEmail
    )
  );

  const seenIds = new Set(items.map((p) => p.id));
  for (const invPhoto of matchedInvitedRoomPhotos) {
    if (!seenIds.has(invPhoto.id)) {
      items.push({ ...invPhoto, sharedOwnerEmail: currentEmail || undefined });
      seenIds.add(invPhoto.id);
    }
  }

  return {
    roomId: matchedInvitedRoomMeta?.roomId || ensured.roomId || accessibleRoomIds[0],
    inviteToken: cleanInviteToken || ensured.inviteToken || null,
    hostNickname: matchedInvitedRoomMeta?.hostNickname,
    roomTitle: matchedInvitedRoomMeta?.roomTitle,
    photos: items,
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
      uploader_nickname: cleanNick,
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

  return { ok: true, uploadedPhotos };
}

export async function deleteSupabaseSharedRoomPhoto(photoItemId: string): Promise<boolean> {
  if (!hasAuthenticatedHubAccountSession()) return false;
  const authed = await ensureGhostiAuthedSupabaseClient();
  if (!authed) return false;
  const rawUuid = photoItemId.startsWith('shared_sb_')
    ? photoItemId.slice('shared_sb_'.length)
    : photoItemId;
  if (!/^[0-9a-f-]{36}$/i.test(rawUuid)) return false;
  const { error } = await authed.from('ghosti_room_shared_photos').delete().eq('id', rawUuid);
  return !error;
}
