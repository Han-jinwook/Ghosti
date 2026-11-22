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
import { resolveAccountScopedNickname } from '../../services/ghostSecretaryEngine';
import { loadPassportFlowState } from '../../services/passportRegistrationFlow';

export const HOST_HIDE_PERMISSION_STORAGE_KEY = 'ghosti_room_host_hide_perm_v1';
export const KICKED_ROOM_MEMBERS_STORAGE_KEY = 'ghosti_kicked_room_members_v1';

export function readHostRetainsHidePermission(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(HOST_HIDE_PERMISSION_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function writeHostRetainsHidePermission(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HOST_HIDE_PERMISSION_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

export function resolveCurrentUserIdentityTokens(email?: string | null): string[] {
  const flow = loadPassportFlowState();
  const cleanEmail = (email || '').trim().toLowerCase();
  const emailPrefix = cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail;
  const nick = resolveAccountScopedNickname(cleanEmail, '');
  return Array.from(
    new Set(
      [flow.userRealName, ...(flow.userAliases || []), nick, emailPrefix, '나', '방장']
        .map((s) => String(s || '').trim())
        .filter(Boolean)
    )
  );
}

/**
 * [Step 4 — '👑 방장 상시 숨기기' + '24시간 내 본인 삭제' 권한 판별]
 */
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
  const cleanUploader = rawUploader.replace(/^[👑📸👤\s]+/, '').trim();
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
      .showToast('🔒 내 공유방 초대 링크를 발급하려면 먼저 이메일 로그인(10초 인증)을 완료해 주세요!');
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

  // [안 A 1:1 독립 방 초대 링크 복사]: 현재 타인의 초대받은 독립 공유방에 들어가 있는 상태에서
  // 초대 링크를 복사하면 내 방 주소가 아닌, 바로 지금 보고 있는 그 초대방 전용 링크를 정확히 복사합니다.
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

  // [0.00ms 동기 즉시 복사 경로]: 사진 공유방 진입 시 일괄 예열된 5대 공유방 토큰이 있으면
  // 클릭 제스처(0ms) 안에서 즉시 해당 방 전용 링크를 클립보드에 기록하여, 사용자가 0.1초 만에 카톡 창으로 전환(Alt+Tab)해 붙여넣어도
  // 이전 방(예: 본가) 링크가 남는 현상을 0%로 원천 차단합니다.
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
    // 백그라운드에서 만료일(14일) 연장 동기화
    void ensureMyRoomAndInviteToken({
      loungeType: opts.loungeType,
      familyRoom: opts.familyRoom,
      roomTitle: resolvedTitle,
      masterNickname: hostNick,
    });
    return true;
  }

  // [최초 로딩 0.2초 내 콜드 클릭 안전망]: 네트워크 대기 중 직전 방(예: 본가) 클립보드 주소가 실수로 붙여넣어지지 않도록
  // 먼저 클릭 제스처(0ms) 안에서 이전 클립보드를 비운 뒤 새 방 토큰을 받아 복사합니다.
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
      .showToast('⚠️ 공유방 초대 토큰 발급 중 일시적 오류가 발생했습니다. 다시 눌러주세요.');
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
