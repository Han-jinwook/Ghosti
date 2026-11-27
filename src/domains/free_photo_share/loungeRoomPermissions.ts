import { useSaySeeStore } from '../../store/useSaySeeStore';
import type { FamilyRoomId, LoungeType } from '../../types/saysee';
import { hasAuthenticatedHubAccountSession } from '../../services/supabaseClient';
import {
  buildShareRoomInviteHttpsUrl,
  copyInviteTextReliably,
  resolveDefaultRoomTitle,
} from '../../services/shareInviteDeepLinkBridge';
import {
  ensureMyRoomAndInviteToken,
  getPrewarmedRoomInviteTokenSync,
  reseedRoomPhotosForInvite,
} from '../../services/sharedPhotoRoomSupabase';
import {
  loadGhostPassportBook,
  resolveAccountScopedNickname,
} from '../../services/ghostSecretaryEngine';
import { loadPassportFlowState } from '../../services/passportRegistrationFlow';

export const HOST_HIDE_PERMISSION_STORAGE_KEY = 'ghosti_room_host_hide_perm_v1';
export const KICKED_ROOM_MEMBERS_STORAGE_KEY = 'ghosti_kicked_room_members_v1';

export function readHostRetainsHidePermission(roomId?: string | null): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const cleanRoomId = (roomId || '').trim();
    if (cleanRoomId) {
      const scoped = localStorage.getItem(`${HOST_HIDE_PERMISSION_STORAGE_KEY}::${cleanRoomId}`);
      if (scoped === 'true') return true;
      if (scoped === 'false') return false;
    }
    return localStorage.getItem(HOST_HIDE_PERMISSION_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function writeHostRetainsHidePermission(enabled: boolean, roomId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const val = enabled ? 'true' : 'false';
    const cleanRoomId = (roomId || '').trim();
    if (cleanRoomId) {
      localStorage.setItem(`${HOST_HIDE_PERMISSION_STORAGE_KEY}::${cleanRoomId}`, val);
    }
    localStorage.setItem(HOST_HIDE_PERMISSION_STORAGE_KEY, val);
  } catch {
    /* ignore */
  }
}

export function resolveCurrentUserIdentityTokens(email?: string | null): string[] {
  const flow = loadPassportFlowState();
  const passportBook = loadGhostPassportBook();
  const cleanEmail = (email || '').trim().toLowerCase();
  const emailPrefix = cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail;
  const nick = resolveAccountScopedNickname(cleanEmail, '');
  const extraStoredNames: string[] = [];
  if (typeof window !== 'undefined') {
    try {
      const hubNick = (localStorage.getItem('ghosti_hub_user_nickname') || '').trim();
      const userNick = (localStorage.getItem('userNickname') || '').trim();
      if (hubNick) extraStoredNames.push(hubNick);
      if (userNick) extraStoredNames.push(userNick);
      const cachedRaw = localStorage.getItem('merlin_cached_user');
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw) as { nickname?: string; name?: string } | null;
        if (parsed?.nickname?.trim()) extraStoredNames.push(parsed.nickname.trim());
        if (parsed?.name?.trim()) extraStoredNames.push(parsed.name.trim());
      }
    } catch {
      /* ignore */
    }
  }
  return Array.from(
    new Set(
      [
        flow.userRealName,
        ...(flow.userAliases || []),
        passportBook.self?.realName,
        passportBook.self?.nickname,
        nick,
        ...extraStoredNames,
        cleanEmail,
        emailPrefix,
        '나',
        '방장',
      ]
        .map((s) => String(s || '').trim())
        .filter(Boolean)
    )
  );
}

export function evaluateSharedPhotoDeletePermission(opts: {
  photoId: string;
  uploaderLabel?: string;
  mtimeMs?: number;
  isJoinedOtherRoom: boolean;
  hostRetainsHidePermission?: boolean;
  currentIdentityTokens: string[];
}): { allowed: boolean; mode: 'host_hide' | 'owner_24h' | 'none' } {
  const hostPerm = opts.hostRetainsHidePermission ?? readHostRetainsHidePermission();
  const rawUploader = String(opts.uploaderLabel || '').trim();
  const cleanUploader = rawUploader.replace(/^[^\w가-힣]+/u, '').trim();
  const isLocalAdded = String(opts.photoId || '').startsWith('shared_added_');
  const isMyUpload =
    isLocalAdded ||
    !cleanUploader ||
    opts.currentIdentityTokens.some(
      (tok) =>
        tok &&
        (cleanUploader.toLowerCase() === tok.toLowerCase() ||
          cleanUploader.toLowerCase().includes(tok.toLowerCase()))
    );
  const ageMs =
    typeof opts.mtimeMs === 'number' && opts.mtimeMs > 0 ? Date.now() - opts.mtimeMs : 0;
  const within24h = ageMs <= 24 * 60 * 60 * 1000;

  if (isMyUpload && (within24h || (!opts.isJoinedOtherRoom && hostPerm))) {
    return { allowed: true, mode: 'owner_24h' };
  }
  if (!opts.isJoinedOtherRoom && hostPerm) {
    return { allowed: true, mode: 'host_hide' };
  }
  return { allowed: false, mode: 'none' };
}

export async function copyAuthenticatedRoomInviteFlow(opts: {
  loungeType: LoungeType;
  familyRoom: FamilyRoomId;
  defaultHostLabel: string;
  roomTitle?: string;
  promptLabel: string;
  formatCopyText?: (inviteUrl: string) => string;
}): Promise<boolean> {
  if (!hasAuthenticatedHubAccountSession()) {
    useSaySeeStore
      .getState()
      .showToast('공유방 초대 링크를 발급하려면 먼저 이메일로 로그인해 주세요.');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openLoginModal'));
    }
    return false;
  }
  const st = useSaySeeStore.getState();
  const authedEmail =
    st.merlinAuth.email ||
    (typeof window !== 'undefined' ? localStorage.getItem('ghosti_hub_user_email') || '' : '');
  const hostNick = resolveAccountScopedNickname(authedEmail, opts.defaultHostLabel);
  const resolvedTitle =
    opts.roomTitle || resolveDefaultRoomTitle(opts.loungeType, opts.familyRoom);

  const activeJoined = st.activeJoinedRoomMeta;
  if (
    activeJoined &&
    activeJoined.inviteToken &&
    activeJoined.loungeType === opts.loungeType &&
    (opts.loungeType !== 'family' || activeJoined.familyRoom === opts.familyRoom)
  ) {
    const joinedUrl = buildShareRoomInviteHttpsUrl({
      loungeType: activeJoined.loungeType,
      familyRoom: activeJoined.familyRoom,
      inviteToken: activeJoined.inviteToken,
      hostName: activeJoined.masterNickname || hostNick,
      roomTitle: activeJoined.roomTitle || resolvedTitle,
    });
    const textToCopy = opts.formatCopyText ? opts.formatCopyText(joinedUrl) : joinedUrl;
    const copied = await copyInviteTextReliably(textToCopy);
    if (!copied && typeof window !== 'undefined') {
      window.prompt(opts.promptLabel, joinedUrl);
    }
    if (activeJoined.roomId) {
      void reseedRoomPhotosForInvite({
        roomId: activeJoined.roomId,
        loungeType: activeJoined.loungeType,
        familyRoom: activeJoined.familyRoom,
        uploaderNickname: hostNick,
      });
    }
    return true;
  }

  const prewarmed = getPrewarmedRoomInviteTokenSync(opts.loungeType, opts.familyRoom);
  if (prewarmed?.inviteToken) {
    const verifiedHostNick = prewarmed.masterNickname || hostNick;
    const instantUrl = buildShareRoomInviteHttpsUrl({
      loungeType: opts.loungeType,
      familyRoom: opts.familyRoom,
      inviteToken: prewarmed.inviteToken,
      hostName: verifiedHostNick,
      roomTitle: resolvedTitle,
    });
    const textToCopy = opts.formatCopyText ? opts.formatCopyText(instantUrl) : instantUrl;
    const copied = await copyInviteTextReliably(textToCopy);
    if (!copied && typeof window !== 'undefined') {
      window.prompt(opts.promptLabel, instantUrl);
    }
    if (prewarmed.roomId) {
      void reseedRoomPhotosForInvite({
        roomId: prewarmed.roomId,
        loungeType: opts.loungeType,
        familyRoom: opts.familyRoom,
        uploaderNickname: verifiedHostNick,
      });
    }
    void ensureMyRoomAndInviteToken({
      loungeType: opts.loungeType,
      familyRoom: opts.familyRoom,
      roomTitle: resolvedTitle,
      masterNickname: hostNick,
    });
    return true;
  }

  void copyInviteTextReliably(' ');

  const ensured = await ensureMyRoomAndInviteToken({
    loungeType: opts.loungeType,
    familyRoom: opts.familyRoom,
    roomTitle: resolvedTitle,
    masterNickname: hostNick,
  });
  if (!ensured.ok || !ensured.inviteToken) {
    useSaySeeStore
      .getState()
      .showToast('초대 링크 발급 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    return false;
  }
  const verifiedHostNick = ensured.masterNickname || hostNick;
  if (ensured.roomId) {
    void reseedRoomPhotosForInvite({
      roomId: ensured.roomId,
      loungeType: opts.loungeType,
      familyRoom: opts.familyRoom,
      uploaderNickname: verifiedHostNick,
    });
  }
  const inviteUrl = buildShareRoomInviteHttpsUrl({
    loungeType: opts.loungeType,
    familyRoom: opts.familyRoom,
    inviteToken: ensured.inviteToken,
    hostName: verifiedHostNick,
    roomTitle: resolvedTitle,
  });
  const textToCopy = opts.formatCopyText ? opts.formatCopyText(inviteUrl) : inviteUrl;
  const copied = await copyInviteTextReliably(textToCopy);
  if (!copied && typeof window !== 'undefined') {
    window.prompt(opts.promptLabel, inviteUrl);
  }
  return true;
}
