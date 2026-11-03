/**
 * Version: v2.15.1
 * Last Updated: 2026-10-23
 * Merlin Hub SDK — Client Blackbox & Breadcrumb Tracker
 * - 최근 20개 고객 행동 브레드크럼(클릭, 입력 요약, 화면 전환, 에러) 자동 링버퍼 보관
 * - 비밀번호/카드번호/주민번호 등 민감정보 자동 [FILTERED] 마스킹
 * - 기기/OS/인앱 브라우저/해상도/PWA 여부 자동 수집
 * - 호스트 앱에 절대 영향을 주지 않도록 전 구간 try/catch 안전 격리
 */

export interface HubBreadcrumb {
  timestamp: string;
  category: 'ui.click' | 'ui.input' | 'navigation' | 'network.error';
  target: string;
  value?: string;
}

export interface HubDeviceContext {
  os: string;
  os_version: string;
  browser: string;
  screen_resolution: string;
  display_mode: 'standalone' | 'browser';
}

export interface HubErrorMetadata {
  error_message: string;
  file_path?: string;
  line_number?: number;
  column_number?: number;
  stack_trace: string;
}

export interface HubBugReportPayload {
  app_id: string;
  app_version: string;
  user_email?: string;
  user_hub_id?: string;
  category: 'BUG' | 'CRASH' | 'INQUIRY';
  user_comment?: string;
  error_metadata?: HubErrorMetadata;
  device_context: HubDeviceContext;
  breadcrumbs: HubBreadcrumb[];
}

export const STUDIO_SUPABASE_URL = 'https://suwinftalfgybvrnzruz.supabase.co';
export const STUDIO_SUPABASE_ANON_KEY = 'sb_publishable_jUwQ1BWvG6F2H9GyELUoFw_mUOHbgWD';
export const STUDIO_SUPPORT_BASE_URL = 'https://studio.sundreamer.app/support';


let cachedStudioToken: string | null = null;
let cachedStudioUid: string | null = null;
let cachedStudioTokenExp = 0;
let lastBoundStudioEmail: string | null = null;

async function bindStudioUserEmail(email: string | undefined | null, token: string, uid: string | null): Promise<void> {
  if (!email || !email.includes('@') || !uid || !token) return;
  const cleanEmail = email.trim().toLowerCase();
  const bindKey = `${cleanEmail}:${uid}`;
  if (lastBoundStudioEmail === bindKey) return;
  try {
    if (typeof window !== 'undefined' && sessionStorage.getItem('merlin_studio_bound') === bindKey) {
      lastBoundStudioEmail = bindKey;
      return;
    }
    const res = await fetch(`${STUDIO_SUPABASE_URL}/rest/v1/users?on_conflict=email`, {
      method: 'POST',
      headers: {
        'apikey': STUDIO_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ email: cleanEmail, uid }),
    });
    if (res.ok) {
      lastBoundStudioEmail = bindKey;
      if (typeof window !== 'undefined') {
        try { sessionStorage.setItem('merlin_studio_bound', bindKey); } catch {}
      }
    }
  } catch {
    // Ignore silently
  }
}

function extractUidFromJwt(jwtToken: string | null): string | null {
  if (!jwtToken) return null;
  try {
    const parts = jwtToken.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.sub || null;
  } catch {
    return null;
  }
}

export async function getStudioAuthToken(userEmail?: string | null): Promise<{ token: string; uid: string | null }> {
  try {
    const now = Date.now();
    if (cachedStudioToken && cachedStudioTokenExp > now + 60000) {
      const uid = cachedStudioUid || extractUidFromJwt(cachedStudioToken);
      if (userEmail) await bindStudioUserEmail(userEmail, cachedStudioToken, uid);
      return { token: cachedStudioToken, uid };
    }

    const localStoredToken = typeof window !== 'undefined' ? localStorage.getItem('merlin_studio_anon_token') : null;
    const localStoredUid = typeof window !== 'undefined' ? localStorage.getItem('merlin_studio_anon_uid') : null;
    const localStoredExp = typeof window !== 'undefined' ? Number(localStorage.getItem('merlin_studio_anon_exp') || 0) : 0;
    if (localStoredToken && localStoredExp > now + 60000) {
      const resolvedUid = localStoredUid || extractUidFromJwt(localStoredToken);
      if (resolvedUid) {
        cachedStudioToken = localStoredToken;
        cachedStudioUid = resolvedUid;
        cachedStudioTokenExp = localStoredExp;
        if (typeof window !== 'undefined' && !localStoredUid) {
          localStorage.setItem('merlin_studio_anon_uid', resolvedUid);
        }
        if (userEmail) await bindStudioUserEmail(userEmail, localStoredToken, resolvedUid);
        return { token: localStoredToken, uid: resolvedUid };
      }
    }

    const res = await fetch(`${STUDIO_SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': STUDIO_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.access_token) {
        const resolvedUid = data.user?.id || extractUidFromJwt(data.access_token);
        cachedStudioToken = data.access_token;
        cachedStudioUid = resolvedUid;
        cachedStudioTokenExp = (data.expires_at ? data.expires_at * 1000 : now + 3600000);
        if (typeof window !== 'undefined') {
          localStorage.setItem('merlin_studio_anon_token', data.access_token);
          localStorage.setItem('merlin_studio_anon_exp', String(cachedStudioTokenExp));
          if (resolvedUid) {
            localStorage.setItem('merlin_studio_anon_uid', resolvedUid);
          }
        }
        if (userEmail) await bindStudioUserEmail(userEmail, data.access_token, resolvedUid);
        return { token: data.access_token, uid: resolvedUid };
      }
    }
  } catch {
    // Fail silently
  }
  return { token: STUDIO_SUPABASE_ANON_KEY, uid: null };
}

const MAX_BREADCRUMBS = 20;
const breadcrumbsBuffer: HubBreadcrumb[] = [];
let isBlackboxInitialized = false;

function maskSensitiveValue(raw: string, inputType?: string, inputName?: string): string {
  try {
    const lowerType = (inputType || '').toLowerCase();
    const lowerName = (inputName || '').toLowerCase();
    if (
      lowerType === 'password' ||
      lowerName.includes('password') ||
      lowerName.includes('pwd') ||
      lowerName.includes('secret') ||
      lowerName.includes('token') ||
      lowerName.includes('card') ||
      lowerName.includes('cvc') ||
      lowerName.includes('ssn') ||
      lowerName.includes('otp')
    ) {
      return '[FILTERED]';
    }

    let masked = raw.trim();
    if (!masked) return '';

    // 주민등록번호, 카드번호, 계좌번호 등 연속 숫자 패턴 마스킹
    masked = masked.replace(/\b\d{6}[-\s]?[1-4]\d{6}\b/g, '[FILTERED_ID]');
    masked = masked.replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, '[FILTERED_CARD]');
    masked = masked.replace(/\b\d{10,14}\b/g, '[FILTERED_NUM]');

    if (masked.length > 60) {
      return masked.substring(0, 60) + '...';
    }
    return masked;
  } catch {
    return '[FILTERED]';
  }
}

function describeElement(el: HTMLElement | null): string {
  try {
    if (!el) return 'unknown';
    const tag = (el.tagName || 'element').toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const nameAttr = el.getAttribute('name') ? `[name="${el.getAttribute('name')}"]` : '';
    const ariaLabel = el.getAttribute('aria-label') || '';
    const text = (el.innerText || el.textContent || ariaLabel || '').trim().replace(/\s+/g, ' ').substring(0, 30);
    const labelPart = text ? ` ("${text}")` : '';
    return `${tag}${id}${nameAttr}${labelPart}`;
  } catch {
    return 'element';
  }
}

export function addBreadcrumb(crumb: Omit<HubBreadcrumb, 'timestamp'>): void {
  try {
    breadcrumbsBuffer.push({
      ...crumb,
      timestamp: new Date().toISOString(),
    });
    if (breadcrumbsBuffer.length > MAX_BREADCRUMBS) {
      breadcrumbsBuffer.shift();
    }
  } catch {
    // 절대 안전 코딩: 로깅 실패 시 조용히 무시
  }
}

export function getBreadcrumbs(): HubBreadcrumb[] {
  return [...breadcrumbsBuffer];
}

export function getDeviceContext(): HubDeviceContext {
  try {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return {
        os: 'Server',
        os_version: 'N/A',
        browser: 'SSR',
        screen_resolution: '0x0',
        display_mode: 'browser',
      };
    }

    const ua = navigator.userAgent || '';
    let os = 'Unknown OS';
    let osVersion = '';

    if (/Windows NT/i.test(ua)) {
      os = 'Windows';
      const match = ua.match(/Windows NT ([0-9._]+)/i);
      osVersion = match ? match[1] : '';
    } else if (/Android/i.test(ua)) {
      os = 'Android';
      const match = ua.match(/Android ([0-9._]+)/i);
      osVersion = match ? match[1] : '';
    } else if (/iPhone|iPad|iPod/i.test(ua)) {
      os = 'iOS';
      const match = ua.match(/OS ([0-9_]+)/i);
      osVersion = match ? match[1].replace(/_/g, '.') : '';
    } else if (/Mac OS X/i.test(ua)) {
      os = 'macOS';
      const match = ua.match(/Mac OS X ([0-9._]+)/i);
      osVersion = match ? match[1].replace(/_/g, '.') : '';
    } else if (/Linux/i.test(ua)) {
      os = 'Linux';
    }

    let browser = 'Browser';
    if (/KAKAOTALK/i.test(ua)) browser = 'KakaoTalk In-App';
    else if (/NAVER/i.test(ua)) browser = 'Naver In-App';
    else if (/Instagram/i.test(ua)) browser = 'Instagram In-App';
    else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
    else if (/Edg\//i.test(ua)) browser = 'Edge';
    else if (/Chrome\//i.test(ua)) browser = 'Chrome';
    else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox';

    const screenRes = typeof window.screen !== 'undefined'
      ? `${window.innerWidth || window.screen.width}x${window.innerHeight || window.screen.height}`
      : 'unknown';

    const isStandalone =
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      (navigator as any).standalone === true;

    return {
      os,
      os_version: osVersion || 'unknown',
      browser,
      screen_resolution: screenRes,
      display_mode: isStandalone ? 'standalone' : 'browser',
    };
  } catch {
    return {
      os: 'Unknown',
      os_version: 'unknown',
      browser: 'Unknown',
      screen_resolution: 'unknown',
      display_mode: 'browser',
    };
  }
}

export function parseErrorMetadata(error: any): HubErrorMetadata {
  try {
    if (!error) {
      return {
        error_message: 'Unknown Error',
        stack_trace: '',
      };
    }
    const message = error instanceof Error ? error.message : String(error.message || error);
    const stack = error instanceof Error ? (error.stack || '') : String(error.stack || '');

    let filePath: string | undefined;
    let lineNumber: number | undefined;
    let colNumber: number | undefined;

    const stackLines = stack.split('\n');
    for (const line of stackLines) {
      const match = line.match(/(?:https?:\/\/[^\/]+\/|webpack-internal:\/\/\/|file:\/\/\/)?([^\s():]+\.(?:tsx?|jsx?|mjs|js)):(\d+):(\d+)/i);
      if (match) {
        filePath = match[1];
        lineNumber = parseInt(match[2], 10);
        colNumber = parseInt(match[3], 10);
        break;
      }
    }

    return {
      error_message: message,
      file_path: filePath,
      line_number: lineNumber,
      column_number: colNumber,
      stack_trace: stack.substring(0, 1500),
    };
  } catch {
    return {
      error_message: 'Error parsing metadata',
      stack_trace: '',
    };
  }
}

export function initBlackbox(): void {
  if (typeof window === 'undefined' || isBlackboxInitialized) return;
  isBlackboxInitialized = true;

  try {
    // 초기 진입 페이지 기록
    addBreadcrumb({
      category: 'navigation',
      target: window.location.pathname + window.location.search,
    });

    // 1. 클릭 이벤트 캡처 (버블링에 영향 없도록 passive capture)
    window.addEventListener(
      'click',
      (e: MouseEvent) => {
        try {
          const targetEl = (e.target as HTMLElement)?.closest('button, a, [role="button"], input, select') as HTMLElement | null;
          const desc = describeElement(targetEl || (e.target as HTMLElement));
          addBreadcrumb({
            category: 'ui.click',
            target: desc,
          });
        } catch {}
      },
      { capture: true, passive: true }
    );

    // 2. 입력 변경 캡처 (민감정보 철저 마스킹)
    window.addEventListener(
      'change',
      (e: Event) => {
        try {
          const el = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
          if (!el || !el.tagName) return;
          const tag = el.tagName.toLowerCase();
          if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') return;

          const inputType = (el as HTMLInputElement).type || tag;
          const inputName = el.name || el.id || el.getAttribute('placeholder') || '';
          const maskedVal = maskSensitiveValue(el.value || '', inputType, inputName);

          addBreadcrumb({
            category: 'ui.input',
            target: describeElement(el),
            value: maskedVal,
          });
        } catch {}
      },
      { capture: true, passive: true }
    );

    // 3. 뒤로가기/앞으로가기 네비게이션 캡처
    window.addEventListener(
      'popstate',
      () => {
        try {
          addBreadcrumb({
            category: 'navigation',
            target: window.location.pathname + window.location.search,
          });
        } catch {}
      },
      { passive: true }
    );

    // 4. 전역 런타임 에러 캡처 (브레드크럼에 기록)
    window.addEventListener('error', (event: ErrorEvent) => {
      try {
        const msg = event.message || 'Window Error';
        addBreadcrumb({
          category: 'network.error',
          target: event.filename ? `${event.filename}:${event.lineno || 0}` : 'window.onerror',
          value: msg.substring(0, 100),
        });
      } catch {}
    });

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      try {
        const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || 'Unhandled Rejection');
        addBreadcrumb({
          category: 'network.error',
          target: 'unhandledrejection',
          value: reason.substring(0, 100),
        });
      } catch {}
    });
  } catch {
    // 초기화 실패 시에도 호스트 앱은 100% 정상 작동 보장
  }
}

export interface OpenBugReporterDetail {
  category?: 'BUG' | 'CRASH' | 'INQUIRY';
  error?: any;
  defaultComment?: string;
}

export function openBugReporter(detail?: OpenBugReporterDetail): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('merlin-open-bug-reporter', { detail: detail || {} }));
  } catch {}
}

/**
 * 스튜디오 중앙 CS 테이블(support_tickets)로 블랙박스 티켓 즉시 전송
 */
export async function submitStudioSupportTicket(params: {
  appId: string;
  appVersion?: string;
  userEmail?: string;
  userHubId?: string;
  category?: 'BUG' | 'CRASH' | 'INQUIRY';
  userComment?: string;
  error?: any;
}): Promise<{ ok: boolean; ticketId?: string | number; error?: string }> {
  try {
    const normalizedAppId = normalizeStudioProductId(params.appId);
    const payload: HubBugReportPayload = {
      app_id: normalizedAppId,
      app_version: params.appVersion || 'v2.15.0',
      user_email: params.userEmail || undefined,
      user_hub_id: params.userHubId || undefined,
      category: params.category || (params.error ? 'CRASH' : 'BUG'),
      user_comment: params.userComment || '',
      error_metadata: params.error ? parseErrorMetadata(params.error) : undefined,
      device_context: getDeviceContext(),
      breadcrumbs: getBreadcrumbs(),
    };

    const userSummary = (params.userComment || '').trim() ||
      (payload.error_metadata?.error_message
        ? `[자동 감지된 오류] ${payload.error_metadata.error_message}`
        : '앱 사용 중 일시적인 오류/불편 사항이 접수되었습니다.');

    const finalDescription =
      `[문의 제품: ${normalizedAppId}]\n` +
      `${userSummary}\n\n` +
      `[블랙박스 자동 진단 로그]\n` +
      `${JSON.stringify(payload, null, 2)}`;

    const emailToSave = (
      params.userEmail ||
      (typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || localStorage.getItem('user_email') || '') : '') ||
      'guest@sundreamer.app'
    ).toLowerCase();

    const { token: authToken, uid: authUid } = await getStudioAuthToken(emailToSave);

    const res = await fetch(`${STUDIO_SUPABASE_URL}/rest/v1/support_tickets`, {
      method: 'POST',
      headers: {
        'apikey': STUDIO_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify([
        {
          uid: authUid,
          email: emailToSave,
          issue_type: params.category === 'INQUIRY' ? 'other' : 'bug',
          description: finalDescription,
          status: 'open',
        },
      ]),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, error: errText || `HTTP ${res.status}` };
    }

    const data = await res.json().catch(() => []);
    const createdTicket = Array.isArray(data) && data[0] ? data[0] : null;
    return { ok: true, ticketId: createdTicket?.id };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error' };
  }
}

export function normalizeStudioProductId(appId?: string): string {
  if (!appId) return 'SunDreamer';
  const lower = appId.trim().toLowerCase();
  if (lower === 'sundreamer' || lower === '썬드리머') return 'SunDreamer';
  if (lower === 'aggrofilter' || lower === '어그로필터') return 'AggroFilter';
  if (lower === 'saysee' || lower === '세이씨') return 'SaySee';
  if (lower === 'whateat' || lower === '뭐먹지' || lower === '뭐먹지?') return 'WhatEat';
  if (lower === 'senstalk' || lower === 'sensetalk' || lower === '센스톡') return 'SenseTalk';
  if (lower === 'zeye' || lower === 'z-eye' || lower === '제트아이') return 'ZEye';
  return appId.trim();
}

export function buildStudioSupportJumpUrl(params: {
  appId: string;
  ticketId?: string | number | null;
  email?: string | null;
}): string {
  try {
    const normalizedApp = normalizeStudioProductId(params.appId);
    const url = new URL(STUDIO_SUPPORT_BASE_URL);
    url.searchParams.set('app', normalizedApp);

    if (typeof window !== 'undefined') {
      url.searchParams.set('return_url', window.location.origin);
      const token = localStorage.getItem('merlin_session_token');
      if (token) {
        url.searchParams.set('token', token);
      }
    }

    if (params.email) {
      url.searchParams.set('email', params.email);
    }
    if (params.ticketId) {
      url.searchParams.set('ticket_id', String(params.ticketId));
    }

    return url.toString();
  } catch {
    return `${STUDIO_SUPPORT_BASE_URL}?app=${encodeURIComponent(params.appId || 'SunDreamer')}`;
  }
}
