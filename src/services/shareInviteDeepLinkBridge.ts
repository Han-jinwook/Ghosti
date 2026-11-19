import type { FamilyRoomId, LoungeType } from '../types/saysee';
import { OFFICIAL_LAUNCH_LIVE } from '../components/GhostiShowroomLanding';
import { hasAuthenticatedHubAccountSession } from './supabaseClient';
import { isCapacitorNativeMobileRuntime } from './ghostiMobileCareBridge';

export interface ParsedShareInvite {
  inviteCode: string;
  inviteToken?: string;
  loungeType: LoungeType;
  familyRoom: FamilyRoomId;
  hostName: string;
  roomTitle: string;
  nicknameHint?: string;
}

const INVITE_SESSION_KEY = 'ghosti_active_invite_room';
const INVITE_TOKEN_KEY = 'ghosti_active_invite_token';
const INVITE_HOST_KEY = 'ghosti_active_invite_host';
const INVITE_TITLE_KEY = 'ghosti_active_invite_title';
const JOINED_NATIVE_INVITE_KEY = 'ghosti_joined_invite_room_v1';

export function buildInviteCodeForRoom(
  loungeType: LoungeType,
  familyRoom: FamilyRoomId
): string {
  if (loungeType === 'club') return 'club';
  if (loungeType === 'student') return 'student';
  if (familyRoom === '본가(친가)') return 'family_parents';
  if (familyRoom === '처가(친정)') return 'family_inlaws';
  return 'family_home';
}

export function resolveDefaultRoomTitle(
  loungeType: LoungeType,
  familyRoom: FamilyRoomId,
  customTitle?: string
): string {
  const cleanCustom = (customTitle || '').trim();
  if (cleanCustom) return cleanCustom;
  if (loungeType === 'club') return '⛰️ 동호회·모임 사진방';
  if (loungeType === 'student') return '🎓 동창회 사진방';
  if (familyRoom === '본가(친가)') return '🏡 본가(친가) 가족 사진방';
  if (familyRoom === '처가(친정)') return '🌸 처가(친정) 가족 사진방';
  return '🏠 우리집 가족 사진방';
}

export function normalizeInviteFamilyRoom(raw: string | null | undefined): FamilyRoomId {
  const v = (raw || '').trim().toLowerCase();
  if (v.includes('parent') || v.includes('본가') || v.includes('친가')) {
    return '본가(친가)';
  }
  if (v.includes('inlaw') || v.includes('처가') || v.includes('친정')) {
    return '처가(친정)';
  }
  return '우리집';
}

/**
 * 웹 초대 URL(`https://ghosti.sundreamer.app/?invite=...&token=...`), 네이티브 딥링크(`ghosti://invite?...`),
 * Google Play Install Referrer(`invite=family_home&token=...`), 또는 클립보드 초대 토큰(`GHOSTI_INVITE_V1:...`)을
 * 단일 구조체로 파싱합니다.
 */
export function parseShareInviteInput(rawInput: string | null | undefined): ParsedShareInvite | null {
  if (!rawInput) return null;
  let text = rawInput.trim();
  if (!text) return null;

  const tokenMatch = text.match(/GHOSTI_INVITE_V1:([A-Za-z0-9+/=%._?&=-]+)/i);
  if (tokenMatch) {
    try {
      text = `ghosti://invite?${decodeURIComponent(tokenMatch[1])}`;
    } catch {
      text = `ghosti://invite?${tokenMatch[1]}`;
    }
  } else {
    const urlMatch = text.match(/(https?:\/\/[^\s]+|ghosti:\/\/[^\s]+)/i);
    if (urlMatch) {
      text = urlMatch[1];
    }
  }

  let params: URLSearchParams | null = null;
  try {
    if (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('ghosti://')) {
      const normalizedForUrl = text.startsWith('ghosti://')
        ? text.replace(/^ghosti:\/\//i, 'https://ghosti.local/')
        : text;
      const parsedUrl = new URL(normalizedForUrl);
      params = parsedUrl.searchParams;
    } else if (text.includes('invite=') || text.includes('token=')) {
      params = new URLSearchParams(text.startsWith('?') ? text.slice(1) : text);
    }
  } catch {
    const qIdx = text.indexOf('?');
    if (qIdx >= 0) {
      params = new URLSearchParams(text.slice(qIdx + 1));
    }
  }

  if (!params) return null;
  const inviteRaw = (params.get('invite') || '').trim();
  const inviteToken = (params.get('token') || '').trim() || undefined;
  if (!inviteRaw && !inviteToken) return null;

  const lowerInvite = (inviteRaw || 'family_home').toLowerCase();
  const loungeType: LoungeType = lowerInvite.startsWith('club')
    ? 'club'
    : lowerInvite.startsWith('student') || lowerInvite.startsWith('alumni')
    ? 'student'
    : 'family';

  const familyRoom: FamilyRoomId =
    loungeType === 'family'
      ? normalizeInviteFamilyRoom(params.get('room') || inviteRaw)
      : '우리집';

  const inviteCode = buildInviteCodeForRoom(loungeType, familyRoom);
  const hostName = (params.get('host') || '').trim() || '방장';
  const roomTitle = resolveDefaultRoomTitle(
    loungeType,
    familyRoom,
    params.get('title') || undefined
  );
  const nicknameHint = (params.get('nick') || '').trim() || undefined;

  return {
    inviteCode,
    inviteToken,
    loungeType,
    familyRoom,
    hostName,
    roomTitle,
    nicknameHint,
  };
}

export function persistInviteContextMeta(parsed: ParsedShareInvite, isNativeJoined = false): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(INVITE_SESSION_KEY, parsed.inviteCode);
    sessionStorage.setItem(INVITE_HOST_KEY, parsed.hostName);
    sessionStorage.setItem(INVITE_TITLE_KEY, parsed.roomTitle);
    if (parsed.inviteToken) {
      sessionStorage.setItem(INVITE_TOKEN_KEY, parsed.inviteToken);
    }
    if (isNativeJoined) {
      localStorage.setItem(
        JOINED_NATIVE_INVITE_KEY,
        JSON.stringify({
          inviteCode: parsed.inviteCode,
          inviteToken: parsed.inviteToken || '',
          loungeType: parsed.loungeType,
          familyRoom: parsed.familyRoom,
          hostName: parsed.hostName,
          roomTitle: parsed.roomTitle,
          joinedAt: Date.now(),
        })
      );
    }
  } catch {
    /* ignore storage error */
  }
}

export function clearStoredInviteSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(INVITE_SESSION_KEY);
    sessionStorage.removeItem(INVITE_TOKEN_KEY);
    sessionStorage.removeItem(INVITE_HOST_KEY);
    sessionStorage.removeItem(INVITE_TITLE_KEY);
    localStorage.removeItem(JOINED_NATIVE_INVITE_KEY);
  } catch {
    /* ignore */
  }
}

export function readActiveInviteToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    const params = new URLSearchParams(window.location.search);
    const urlTok = (params.get('token') || '').trim();
    if (urlTok) {
      sessionStorage.setItem(INVITE_TOKEN_KEY, urlTok);
      return urlTok;
    }
    const isLoggedIn = hasAuthenticatedHubAccountSession();
    const isNative = isCapacitorNativeMobileRuntime();
    // 로그인된 웹 사용자가 일반 공유방 주소(?token 없음)에서 새로고침할 때는 과거 테스트용 sessionStorage 토큰이 내 방을 가리지 않도록 배제
    if (!isLoggedIn || isNative) {
      const ssTok = (sessionStorage.getItem(INVITE_TOKEN_KEY) || '').trim();
      if (ssTok) return ssTok;
    }
    if (isNative) {
      const rawJoined = localStorage.getItem(JOINED_NATIVE_INVITE_KEY);
      if (rawJoined) {
        const joined = JSON.parse(rawJoined) as { inviteToken?: string };
        if (joined?.inviteToken) return joined.inviteToken.trim();
      }
    }
  } catch {
    /* ignore */
  }
  return '';
}

export function readCurrentInviteDisplayMeta(
  fallbackLounge: LoungeType,
  fallbackFamilyRoom: FamilyRoomId
): {
  inviteCode: string;
  inviteToken: string;
  hostName: string;
  roomTitle: string;
  hasExplicitUrlInvite: boolean;
} {
  const defaultCode = buildInviteCodeForRoom(fallbackLounge, fallbackFamilyRoom);
  const defaultTitle = resolveDefaultRoomTitle(fallbackLounge, fallbackFamilyRoom);
  if (typeof window === 'undefined') {
    return {
      inviteCode: defaultCode,
      inviteToken: '',
      hostName: '방장',
      roomTitle: defaultTitle,
      hasExplicitUrlInvite: false,
    };
  }
  try {
    const fromUrl = parseShareInviteInput(window.location.href);
    if (fromUrl) {
      persistInviteContextMeta(fromUrl, false);
      return {
        inviteCode: fromUrl.inviteCode,
        inviteToken: fromUrl.inviteToken || readActiveInviteToken(),
        hostName: fromUrl.hostName,
        roomTitle: fromUrl.roomTitle,
        hasExplicitUrlInvite: true,
      };
    }
    const storedHost = (sessionStorage.getItem(INVITE_HOST_KEY) || '').trim();
    const storedTitle = (sessionStorage.getItem(INVITE_TITLE_KEY) || '').trim();
    const storedCode = (sessionStorage.getItem(INVITE_SESSION_KEY) || '').trim();
    const storedToken = readActiveInviteToken();
    if (storedCode || storedToken) {
      return {
        inviteCode: storedCode || defaultCode,
        inviteToken: storedToken,
        hostName: storedHost || '방장',
        roomTitle: storedTitle || defaultTitle,
        hasExplicitUrlInvite: false,
      };
    }
    const rawJoined = localStorage.getItem(JOINED_NATIVE_INVITE_KEY);
    if (rawJoined) {
      const joined = JSON.parse(rawJoined) as Partial<ParsedShareInvite>;
      if (joined?.inviteCode || joined?.inviteToken) {
        return {
          inviteCode: joined.inviteCode || defaultCode,
          inviteToken: joined.inviteToken || '',
          hostName: joined.hostName || '방장',
          roomTitle: joined.roomTitle || defaultTitle,
          hasExplicitUrlInvite: false,
        };
      }
    }
  } catch {
    /* ignore */
  }
  return {
    inviteCode: defaultCode,
    inviteToken: '',
    hostName: '방장',
    roomTitle: defaultTitle,
    hasExplicitUrlInvite: false,
  };
}

export function buildShareRoomInviteHttpsUrl(opts: {
  loungeType: LoungeType;
  familyRoom: FamilyRoomId;
  inviteToken?: string;
  hostName?: string;
  roomTitle?: string;
}): string {
  const inviteCode = buildInviteCodeForRoom(opts.loungeType, opts.familyRoom);
  const params = new URLSearchParams();
  params.set('invite', inviteCode);
  if (opts.loungeType === 'family') {
    params.set('room', opts.familyRoom);
  }
  const cleanToken = (opts.inviteToken || '').trim();
  if (cleanToken) {
    params.set('token', cleanToken);
  }
  const cleanHost = (opts.hostName || '').trim();
  if (cleanHost && cleanHost !== '방장') {
    params.set('host', cleanHost);
  }
  const cleanTitle = (opts.roomTitle || '').trim();
  if (cleanTitle) {
    params.set('title', cleanTitle);
  }
  params.set('preview', 'guest');
  return `https://ghosti.sundreamer.app/?${params.toString()}`;
}

export function buildShareRoomNativeSchemeUrl(opts: {
  loungeType: LoungeType;
  familyRoom: FamilyRoomId;
  inviteToken?: string;
  hostName?: string;
  roomTitle?: string;
  nicknameHint?: string;
}): string {
  const inviteCode = buildInviteCodeForRoom(opts.loungeType, opts.familyRoom);
  const params = new URLSearchParams();
  params.set('invite', inviteCode);
  if (opts.loungeType === 'family') {
    params.set('room', opts.familyRoom);
  }
  if (opts.inviteToken?.trim()) {
    params.set('token', opts.inviteToken.trim());
  }
  if (opts.hostName?.trim()) {
    params.set('host', opts.hostName.trim());
  }
  if (opts.roomTitle?.trim()) {
    params.set('title', opts.roomTitle.trim());
  }
  if (opts.nicknameHint?.trim()) {
    params.set('nick', opts.nicknameHint.trim());
  }
  return `ghosti://invite?${params.toString()}`;
}

export function buildAndroidSafeAppProbeIntentUrl(currentHref: string): string | null {
  const parsed = parseShareInviteInput(currentHref);
  if (!parsed) return null;
  try {
    const fallbackUrl = new URL(currentHref);
    fallbackUrl.searchParams.set('app_checked', '1');
    const schemeQuery = new URLSearchParams();
    schemeQuery.set('invite', parsed.inviteCode);
    if (parsed.loungeType === 'family') {
      schemeQuery.set('room', parsed.familyRoom);
    }
    if (parsed.inviteToken) {
      schemeQuery.set('token', parsed.inviteToken);
    }
    if (parsed.hostName) {
      schemeQuery.set('host', parsed.hostName);
    }
    if (parsed.roomTitle) {
      schemeQuery.set('title', parsed.roomTitle);
    }
    return `intent://invite?${schemeQuery.toString()}#Intent;scheme=ghosti;package=app.sundreamer.ghosti;S.browser_fallback_url=${encodeURIComponent(
      fallbackUrl.toString()
    )};end`;
  } catch {
    return null;
  }
}

export function buildDeferredInviteClipboardToken(opts: {
  loungeType: LoungeType;
  familyRoom: FamilyRoomId;
  inviteToken?: string;
  hostName?: string;
  roomTitle?: string;
  nicknameHint?: string;
}): string {
  const inviteCode = buildInviteCodeForRoom(opts.loungeType, opts.familyRoom);
  const params = new URLSearchParams();
  params.set('invite', inviteCode);
  if (opts.loungeType === 'family') {
    params.set('room', opts.familyRoom);
  }
  if (opts.inviteToken?.trim()) {
    params.set('token', opts.inviteToken.trim());
  }
  if (opts.hostName?.trim()) {
    params.set('host', opts.hostName.trim());
  }
  if (opts.roomTitle?.trim()) {
    params.set('title', opts.roomTitle.trim());
  }
  if (opts.nicknameHint?.trim()) {
    params.set('nick', opts.nicknameHint.trim());
  }
  return `GHOSTI_INVITE_V1:${encodeURIComponent(params.toString())}`;
}

export function buildAndroidPlayStoreInviteUrl(opts: {
  loungeType: LoungeType;
  familyRoom: FamilyRoomId;
  inviteToken?: string;
  hostName?: string;
  roomTitle?: string;
  nicknameHint?: string;
}): string {
  const inviteCode = buildInviteCodeForRoom(opts.loungeType, opts.familyRoom);
  const refParams = new URLSearchParams();
  refParams.set('invite', inviteCode);
  if (opts.loungeType === 'family') {
    refParams.set('room', opts.familyRoom);
  }
  if (opts.inviteToken?.trim()) {
    refParams.set('token', opts.inviteToken.trim());
  }
  if (opts.hostName?.trim()) {
    refParams.set('host', opts.hostName.trim());
  }
  if (opts.nicknameHint?.trim()) {
    refParams.set('nick', opts.nicknameHint.trim());
  }
  return `https://play.google.com/store/apps/details?id=app.sundreamer.ghosti&referrer=${encodeURIComponent(
    refParams.toString()
  )}`;
}

export function buildIosStoreInviteUrl(): {
  primaryUrl: string;
  fallbackWebUrl: string;
  storeLabelKo: string;
} {
  if (OFFICIAL_LAUNCH_LIVE) {
    return {
      primaryUrl: 'https://apps.apple.com/kr/app/id6836307976',
      fallbackWebUrl: 'https://apps.apple.com/kr/app/id6836307976',
      storeLabelKo: 'App Store',
    };
  }
  return {
    primaryUrl: 'itms-beta://beta.itunes.apple.com/v1/app/6836307976',
    fallbackWebUrl: 'https://testflight.apple.com',
    storeLabelKo: 'TestFlight (아이폰 앱)',
  };
}
