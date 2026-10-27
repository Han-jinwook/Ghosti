/**
 * 멀린 패밀리 공용 '동적 라우팅 푸시 (Dynamic Push Routing — 우체국장 아키텍처)' 브릿지
 *
 * - 귀신같이(멀린 Z 코어) 모바일 앱 1개가 전사 패밀리 앱 푸시의 우체국장 역할을 수행합니다.
 * - FCM / APNs 푸시를 눌렀을 때 고정 URL이 아니라 페이로드 `data.target_url`을 읽어 해당 화면으로 이동합니다.
 * - [보안 화이트리스트 강제] 오픈 리다이렉트(Open Redirect) 및 스토어 심사 리젝 방어를 위해
 *   오직 `https://*.sundreamer.app` (및 `https://sundreamer.app`) 과 앱 내부 경로(`/...`)만 허용하고
 *   그 외 임의 외부 도메인·`javascript:`·`data:`·프로토콜 상대경로(`//evil.com`)는 전부 차단합니다.
 * - [알림 채널 분리] Android 8.0+ 에서 패밀리 서비스별(귀신같이·센스톡·루미노트 등) 알림을 유저가
 *   개별 ON/OFF 할 수 있도록 채널을 분리 등록합니다. (iOS는 `thread-id` 그룹으로 서버에서 지정)
 * - 웹(PWA/브라우저) 환경에서는 아무 동작도 하지 않습니다 (네이티브 플러그인 동적 import → 웹 번들 영향 0).
 */
import { Capacitor } from '@capacitor/core';

/** 허용 루트 도메인 (서브도메인 와일드카드 포함) */
const ALLOWED_ROOT_DOMAINS = ['sundreamer.app'] as const;

/** 패밀리 서비스별 Android 알림 채널 (id는 서버 FCM payload의 android.notification.channel_id와 일치시켜야 함) */
export const FAMILY_PUSH_CHANNELS = [
  { id: 'ghosti', name: '귀신같이', description: '사진·영상 공유, 클린몬스터·설정몬스터 알림' },
  { id: 'senstalk', name: '센스톡', description: '메신저 발송 준비·완료 알림' },
  { id: 'luminote', name: '루미노트', description: '루미노트 고객 관리 알림' },
  { id: 'sundreamer', name: '썬드리머', description: '램프 수명·치유 기록 알림' },
  { id: 'studio', name: '썬드리머 스튜디오', description: '문의 답변·고객센터 알림' },
  { id: 'family_hub', name: '멀린 패밀리 계정', description: '로그인·지갑·계정 보안 알림' },
] as const;

export type FamilyPushChannelId = (typeof FAMILY_PUSH_CHANNELS)[number]['id'];

const PUSH_TOKEN_STORAGE_KEY = 'ghosti_native_push_token';

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_ROOT_DOMAINS.some((root) => host === root || host.endsWith(`.${root}`));
}

/**
 * 푸시 페이로드의 target_url을 검증해 안전한 이동 대상만 돌려줍니다.
 * @returns `{ kind: 'internal', path }` 앱 내부 경로 / `{ kind: 'family', url }` 화이트리스트 패밀리 도메인 / `null` 차단
 */
export function resolveSafePushTarget(
  rawTarget: unknown
): { kind: 'internal'; path: string } | { kind: 'family'; url: string } | null {
  if (typeof rawTarget !== 'string') return null;
  const target = rawTarget.trim();
  if (!target || target.length > 2048) return null;

  // 1) 앱 내부 경로: 반드시 '/'로 시작하고 '//'(프로토콜 상대경로)·'/\'는 금지
  if (target.startsWith('/')) {
    if (target.startsWith('//') || target.startsWith('/\\')) return null;
    try {
      const u = new URL(target, 'https://ghosti.sundreamer.app');
      return { kind: 'internal', path: `${u.pathname}${u.search}${u.hash}` };
    } catch {
      return null;
    }
  }

  // 2) 절대 URL: https + 화이트리스트 도메인만 허용 (계정정보 포함 URL 차단)
  try {
    const u = new URL(target);
    if (u.protocol !== 'https:') return null;
    if (u.username || u.password) return null;
    if (!isAllowedHost(u.hostname)) return null;
    return { kind: 'family', url: u.toString() };
  } catch {
    return null;
  }
}

function navigateToPushTarget(rawTarget: unknown) {
  const safe = resolveSafePushTarget(rawTarget);
  if (!safe) {
    console.warn('[Ghosti Push] 허용되지 않은 target_url 차단:', rawTarget);
    return;
  }
  if (safe.kind === 'internal') {
    window.location.assign(safe.path);
    return;
  }
  // 같은 패밀리 도메인이라도 현재 앱과 다른 서비스면 웹뷰 내에서 이동 (capacitor.config allowNavigation 화이트리스트와 일치)
  window.location.assign(safe.url);
}

let initialized = false;

/**
 * 네이티브 앱(Capacitor) 구동 시 1회 호출: 권한 요청 → 채널 등록 → 토큰 수신 → 클릭 라우팅 리스너 연결
 * - 웹 환경에서는 즉시 반환합니다.
 */
export async function initNativePushRouter(): Promise<void> {
  if (initialized) return;
  if (!Capacitor.isNativePlatform()) return;
  initialized = true;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // 클릭 라우팅 리스너는 권한 결과와 무관하게 먼저 연결 (콜드 스타트 클릭 이벤트 유실 방지)
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = (action.notification?.data ?? {}) as Record<string, unknown>;
      navigateToPushTarget(data.target_url);
    });

    await PushNotifications.addListener('registration', (token) => {
      try {
        localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token.value);
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent('ghostiNativePushToken', { detail: { token: token.value } }));
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.warn('[Ghosti Push] 토큰 등록 실패:', err);
    });

    if (Capacitor.getPlatform() === 'android') {
      for (const ch of FAMILY_PUSH_CHANNELS) {
        await PushNotifications.createChannel({
          id: ch.id,
          name: ch.name,
          description: ch.description,
          importance: 3,
          visibility: 1,
        });
      }
    }

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive === 'granted') {
      await PushNotifications.register();
    }
  } catch (err) {
    console.warn('[Ghosti Push] 네이티브 푸시 초기화 건너뜀:', err);
  }
}

export function getStoredNativePushToken(): string | null {
  try {
    return localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}
