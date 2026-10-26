import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

/**
 * [허브 SDK ↔ 제트아이 단독 Supabase SSOT 계정 매핑 브릿지]
 * - 허브(os.sundreamer.app) 이메일 6자리 OTP 인증 완료 시 확정된 `family_users.id`(UUID)를
 *   제트아이 단독 Supabase `public.users.id`와 1:1 동일 키로 동기화합니다.
 * - 코인/결제 테이블은 제트아이 DB에 두지 않으며, 오직 허브 중앙 지갑 원장만 참조합니다.
 */
export async function syncHubUserToLocalSupabase(params: {
  userId: string;
  email: string;
  nickname?: string;
  hubToken?: string | null;
}): Promise<{ ok: boolean; syncedUserId?: string; error?: string }> {
  const cleanEmail = (params.email || '').trim().toLowerCase();
  const cleanUserId = (params.userId || '').trim();
  if (!cleanUserId || !cleanEmail) {
    return { ok: false, error: 'Missing userId or email' };
  }

  try {
    // 1. 로컬 캐시에 허브 SSOT 매핑 정보 보존
    if (typeof window !== 'undefined') {
      localStorage.setItem('zeye_hub_user_id', cleanUserId);
      localStorage.setItem('zeye_hub_user_email', cleanEmail);
      if (params.nickname) {
        localStorage.setItem('zeye_hub_user_nickname', params.nickname);
      }
    }

    // 2. Z-Eye 단독 Supabase가 연결된 경우 public.users (id = 허브 family_users.id) 동기화 시도
    if (supabase) {
      const nativePushToken =
        typeof window !== 'undefined' ? localStorage.getItem('zeye_native_push_token') : null;
      const appSettings: Record<string, unknown> = {};
      if (nativePushToken) {
        appSettings.native_push_token = nativePushToken;
        appSettings.push_channel_id = 'zeye';
      }

      const { error } = await supabase.from('users').upsert(
        {
          id: cleanUserId,
          email: cleanEmail,
          nickname: params.nickname || cleanEmail.split('@')[0],
          app_settings: appSettings,
          last_login_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (error) {
        // RLS가 서버 함수(service_role) 전용으로 잠겨 있는 경우 Netlify 브릿지 함수로 폴백
        const token =
          params.hubToken ||
          (typeof window !== 'undefined' ? localStorage.getItem('merlin_session_token') : null);
        if (token && typeof fetch !== 'undefined') {
          await fetch('/.netlify/functions/hub-supabase-bridge', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              userId: cleanUserId,
              email: cleanEmail,
              nickname: params.nickname || cleanEmail.split('@')[0],
              nativePushToken,
            }),
          }).catch(() => {});
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('zeyeSupabaseUserSynced', {
          detail: { userId: cleanUserId, email: cleanEmail, nickname: params.nickname },
        })
      );
    }

    return { ok: true, syncedUserId: cleanUserId };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Supabase sync error' };
  }
}
