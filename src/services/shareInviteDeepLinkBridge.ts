import type { FamilyRoomId, LoungeType } from '../types/saysee';
import { OFFICIAL_LAUNCH_LIVE } from '../components/GhostiShowroomLanding';
import { hasAuthenticatedHubAccountSession } from './supabaseClient';
import { isCapacitorNativeMobileRuntime } from './ghostiMobileCareBridge';
import { resolveAccountScopedNickname } from './ghostSecretaryEngine';

export interface ParsedShareInvite {
  inviteCode: string;
  inviteToken?: string;
  loungeType: LoungeType;
  familyRoom: FamilyRoomId;
  hostName: string;
  roomTitle: string;
  nicknameHint?: string;
}

export interface VerifiedInviteRoomMeta {
  inviteToken: string;
  loungeType: LoungeType;
  familyRoom: FamilyRoomId;
  hostName: string;
  roomTitle: string;
  verifiedAt: number;
}

const INVITE_SESSION_KEY = 'ghosti_active_invite_room';
const INVITE_TOKEN_KEY = 'ghosti_active_invite_token';
const LEGACY_INVITE_HOST_KEY = 'ghosti_active_invite_host';
const LEGACY_INVITE_TITLE_KEY = 'ghosti_active_invite_title';
const VERIFIED_INVITE_META_PREFIX = 'ghosti_verified_invite_v2::';
const JOINED_NATIVE_INVITE_KEY = 'ghosti_joined_invite_room_v1';

const verifiedInviteMemoryCache = new Map<string, VerifiedInviteRoomMeta>();

function extractSafeRoomInviteToken(params: URLSearchParams): string | undefined {
  const explicitTok = (params.get('inviteToken') || '').trim();
  if (explicitTok) return explicitTok;
  const legacyTok = (params.get('token') || '').trim();
  if (!legacyTok) return undefined;
  // 허브 SSO 3단 JWT(eyJ...)는 방 초대 토큰이 아니므로 엄격 배제
  if (legacyTok.startsWith('eyJ') && legacyTok.split('.').length === 3) {
    return undefined;
  }
  return legacyTok;
}

export function saveVerifiedInviteRoomMeta(
  inviteToken: string,
  meta: Omit<VerifiedInviteRoomMeta, 'inviteToken' | 'verifiedAt'>
): void {
  const cleanTok = (inviteToken || '').trim();
  if (!cleanTok) return;
  const entry: VerifiedInviteRoomMeta = {
    inviteToken: cleanTok,
    loungeType: meta.loungeType,
    familyRoom: meta.familyRoom,
    hostName: (meta.hostName || '').trim() || '방장',
    roomTitle: (meta.roomTitle || '').trim() || resolveDefaultRoomTitle(meta.loungeType, meta.familyRoom),
    verifiedAt: Date.now(),
  };
  verifiedInviteMemoryCache.set(cleanTok, entry);
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(LEGACY_INVITE_HOST_KEY);
      sessionStorage.removeItem(LEGACY_INVITE_TITLE_KEY);
      sessionStorage.setItem(`${VERIFIED_INVITE_META_PREFIX}${cleanTok}`, JSON.stringify(entry));
    } catch {
      /* ignore storage error */
    }
  }
}

export function readVerifiedInviteRoomMeta(inviteToken: string): VerifiedInviteRoomMeta | null {
  const cleanTok = (inviteToken || '').trim();
  if (!cleanTok) return null;
  const mem = verifiedInviteMemoryCache.get(cleanTok);
  if (mem) return mem;
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${VERIFIED_INVITE_META_PREFIX}${cleanTok}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VerifiedInviteRoomMeta>;
    if (parsed?.inviteToken === cleanTok && parsed.hostName) {
      const restored: VerifiedInviteRoomMeta = {
        inviteToken: cleanTok,
        loungeType: (parsed.loungeType as LoungeType) || 'family',
        familyRoom: (parsed.familyRoom as FamilyRoomId) || '우리집',
        hostName: parsed.hostName,
        roomTitle:
          parsed.roomTitle ||
          resolveDefaultRoomTitle(
            (parsed.loungeType as LoungeType) || 'family',
            (parsed.familyRoom as FamilyRoomId) || '우리집'
          ),
        verifiedAt: parsed.verifiedAt || Date.now(),
      };
      verifiedInviteMemoryCache.set(cleanTok, restored);
      return restored;
    }
  } catch {
    /* ignore */
  }
  return null;
}

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
    } else if (
      text.includes('invite=') ||
      text.includes('inviteToken=') ||
      text.includes('token=')
    ) {
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
  const inviteToken = extractSafeRoomInviteToken(params);
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
  const verified = inviteToken ? readVerifiedInviteRoomMeta(inviteToken) : null;
  // 초대 토큰이 있는 정식 초대 링크는 서버 DB 검증값(verified)만 신뢰하고 미검증 URL ?host= 파라미터(과거 타 계정 혼입값 등)는 배제
  const hostName = inviteToken
    ? verified?.hostName || '방장'
    : (params.get('host') || '').trim() || '방장';
  const roomTitle = verified?.roomTitle
    ? verified.roomTitle
    : resolveDefaultRoomTitle(loungeType, familyRoom, params.get('title') || undefined);
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
    sessionStorage.removeItem(LEGACY_INVITE_HOST_KEY);
    sessionStorage.removeItem(LEGACY_INVITE_TITLE_KEY);
    sessionStorage.setItem(INVITE_SESSION_KEY, parsed.inviteCode);
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
    sessionStorage.removeItem(LEGACY_INVITE_HOST_KEY);
    sessionStorage.removeItem(LEGACY_INVITE_TITLE_KEY);
    localStorage.removeItem(JOINED_NATIVE_INVITE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 비동기 토큰 발급 직후 브라우저 포커스·제스처 만료로 navigator.clipboard.writeText가 실패해
 * 직전에 복사했던 다른 방(예: 본가) 링크가 클립보드에 그대로 남는 사고를 원천 차단합니다.
 */
export async function copyInviteTextReliably(text: string): Promise<boolean> {
  if (typeof window === 'undefined' || !text) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback to synchronous execCommand below */
  }
  try {
    if (typeof document !== 'undefined') {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'true');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.left = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * 로그인된 회원이 초대 링크(?invite=...&inviteToken=...)를 통해 정식 멤버(ghosti_lounge_members)로 편입된 직후,
 * 브라우저 주소창에 일회용 초대 파라미터가 그대로 남아 있어 '일반 탭 주소 복사'와 '전용 초대 링크 복사'가 혼동되거나
 * 동일 브라우저에서 타 계정 전환 시 의도치 않게 자동 합류되는 현상을 원천 차단합니다.
 * (※ 비로그인 게스트 프리뷰 중에는 F5 새로고침 유지를 위해 호출하지 않습니다.)
 */
export function stripConsumedInviteParamsFromLoggedInUrl(): void {
  if (typeof window === 'undefined' || !hasAuthenticatedHubAccountSession()) return;
  try {
    sessionStorage.removeItem(INVITE_SESSION_KEY);
    sessionStorage.removeItem(INVITE_TOKEN_KEY);
    sessionStorage.removeItem(LEGACY_INVITE_HOST_KEY);
    sessionStorage.removeItem(LEGACY_INVITE_TITLE_KEY);

    const params = new URLSearchParams(window.location.search);
    const hadInviteParams =
      params.has('invite') ||
      params.has('inviteToken') ||
      params.has('token') ||
      params.has('host') ||
      params.has('nick') ||
      params.get('preview') === 'guest';
    if (!hadInviteParams) return;

    params.delete('invite');
    params.delete('inviteToken');
    const rawTok = (params.get('token') || '').trim();
    if (rawTok && !(rawTok.startsWith('eyJ') && rawTok.split('.').length === 3)) {
      params.delete('token');
    }
    params.delete('host');
    params.delete('title');
    params.delete('nick');
    if (params.get('preview') === 'guest') {
      params.delete('preview');
    }
    const qs = params.toString();
    const cleanUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash || ''}`;
    window.history.replaceState(window.history.state || {}, '', cleanUrl);
  } catch {
    /* ignore history error */
  }
}

export function readActiveInviteToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    const params = new URLSearchParams(window.location.search);
    const urlTok = extractSafeRoomInviteToken(params) || '';
    if (urlTok) {
      sessionStorage.setItem(INVITE_TOKEN_KEY, urlTok);
      return urlTok;
    }
    const isLoggedIn = hasAuthenticatedHubAccountSession();
    const isNative = isCapacitorNativeMobileRuntime();
    // 로그인된 웹 사용자가 일반 공유방 주소(?inviteToken 없음)에서 새로고침할 때는 과거 테스트용 sessionStorage 토큰이 내 방을 가리지 않도록 배제
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
  isHostVerified: boolean;
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
      isHostVerified: true,
    };
  }
  try {
    sessionStorage.removeItem(LEGACY_INVITE_HOST_KEY);
    sessionStorage.removeItem(LEGACY_INVITE_TITLE_KEY);

    const fromUrl = parseShareInviteInput(window.location.href);
    if (fromUrl) {
      persistInviteContextMeta(fromUrl, false);
      const activeTok = fromUrl.inviteToken || readActiveInviteToken();
      if (activeTok) {
        const verified = readVerifiedInviteRoomMeta(activeTok);
        return {
          inviteCode: verified
            ? buildInviteCodeForRoom(verified.loungeType, verified.familyRoom)
            : fromUrl.inviteCode,
          inviteToken: activeTok,
          hostName: verified ? verified.hostName : '',
          roomTitle: verified ? verified.roomTitle : fromUrl.roomTitle,
          hasExplicitUrlInvite: true,
          isHostVerified: Boolean(verified),
        };
      }
      return {
        inviteCode: fromUrl.inviteCode,
        inviteToken: '',
        hostName: fromUrl.hostName || '방장',
        roomTitle: fromUrl.roomTitle,
        hasExplicitUrlInvite: true,
        isHostVerified: true,
      };
    }

    const storedToken = readActiveInviteToken();
    const storedCode = (sessionStorage.getItem(INVITE_SESSION_KEY) || '').trim();
    if (storedToken) {
      const verified = readVerifiedInviteRoomMeta(storedToken);
      return {
        inviteCode: verified
          ? buildInviteCodeForRoom(verified.loungeType, verified.familyRoom)
          : storedCode || defaultCode,
        inviteToken: storedToken,
        hostName: verified ? verified.hostName : '',
        roomTitle: verified ? verified.roomTitle : defaultTitle,
        hasExplicitUrlInvite: false,
        isHostVerified: Boolean(verified),
      };
    }

    if (isCapacitorNativeMobileRuntime()) {
      const rawJoined = localStorage.getItem(JOINED_NATIVE_INVITE_KEY);
      if (rawJoined) {
        const joined = JSON.parse(rawJoined) as Partial<ParsedShareInvite>;
        if (joined?.inviteToken) {
          const verified = readVerifiedInviteRoomMeta(joined.inviteToken);
          return {
            inviteCode: joined.inviteCode || defaultCode,
            inviteToken: joined.inviteToken,
            hostName: verified ? verified.hostName : joined.hostName || '방장',
            roomTitle: verified ? verified.roomTitle : joined.roomTitle || defaultTitle,
            hasExplicitUrlInvite: false,
            isHostVerified: Boolean(verified || joined.hostName),
          };
        }
      }
    }

    // 로그인 방장이 본인 방에서 [👀 카톡 초대 링크 수신 화면 미리보기] 버튼을 눌렀을 때: 오직 본인 계정의 별명만 표시
    if (hasAuthenticatedHubAccountSession()) {
      const authedEmail = (localStorage.getItem('ghosti_hub_user_email') || '').trim();
      return {
        inviteCode: defaultCode,
        inviteToken: '',
        hostName: resolveAccountScopedNickname(authedEmail, '방장'),
        roomTitle: defaultTitle,
        hasExplicitUrlInvite: false,
        isHostVerified: true,
      };
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
    isHostVerified: true,
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
    // 허브 SSO ?token= 충돌 방지 및 방별 DB 방장 별명 단일 진실(SSOT) 보장
    params.set('inviteToken', cleanToken);
  } else {
    const cleanHost = (opts.hostName || '').trim();
    if (cleanHost && cleanHost !== '방장') {
      params.set('host', cleanHost);
    }
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
    params.set('inviteToken', opts.inviteToken.trim());
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
      schemeQuery.set('inviteToken', parsed.inviteToken);
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
    params.set('inviteToken', opts.inviteToken.trim());
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
    refParams.set('inviteToken', opts.inviteToken.trim());
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
