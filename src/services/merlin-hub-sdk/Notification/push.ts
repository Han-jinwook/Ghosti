/**
 * Version: v1.0.0
 * Last Updated: 2026-11-28
 * Merlin Hub SDK — Mobile Background Push (Apple APNs + Google FCM Central Gateway)
 * - 전사 패밀리 앱이 각자 푸시 키를 보유하지 않고 멀린허브(`os.sundreamer.app/api/push/*`) 단일 게이트웨이를 통해
 *   1) 기기별 네이티브 푸시 토큰 등록 (`registerPushToken`)
 *   2) 기기별 푸시 토큰 비활성화 (`revokePushToken`)
 *   3) 6대 패밀리 알림 채널(`ghosti`, `senstalk`, `luminote`, `sundreamer`, `studio`, `family_hub`) 및
 *      `targetUrl` 화이트리스트 기반 모바일 백그라운드 푸시 발송 (`sendPushNotification`)을 1줄로 수행합니다.
 */

import { hubFetch } from '../CoreLogic/client';

export type FamilyPushChannelId =
  | 'ghosti'
  | 'senstalk'
  | 'luminote'
  | 'sundreamer'
  | 'studio'
  | 'family_hub';

export interface RegisterPushTokenParams {
  pushToken: string;
  platform: 'ios' | 'android';
  deviceId?: string;
  apnsEnv?: 'production' | 'sandbox';
  appVersion?: string;
  email?: string;
  userId?: string;
}

export interface RegisterPushTokenResult {
  success: boolean;
  ok: boolean;
  tokenCount?: number;
  storageMode?: 'sql' | 'storage_fallback';
  message?: string;
}

export interface RevokePushTokenParams {
  deviceId?: string;
  pushToken?: string;
  email?: string;
}

export interface SendPushNotificationParams {
  toEmail?: string;
  userId?: string;
  channel?: FamilyPushChannelId | string;
  title: string;
  subtitle?: string;
  body: string;
  targetUrl?: string;
  data?: Record<string, string | number | boolean | null | undefined>;
  excludeDeviceId?: string;
}

export interface SendPushNotificationResult {
  success: boolean;
  ok: boolean;
  attempted: number;
  delivered: number;
  invalidTokens?: string[];
  channel?: FamilyPushChannelId;
  targetUrl?: string;
  message?: string;
}

/**
 * 1. 기기별 네이티브 푸시 토큰(APNs / FCM) 허브 중앙 원장 등록
 */
export async function registerPushToken(
  params: RegisterPushTokenParams
): Promise<RegisterPushTokenResult> {
  const res = await hubFetch<RegisterPushTokenResult>('/api/push/register-token', {
    method: 'POST',
    body: JSON.stringify(params),
  });

  if (res.ok && res.data) {
    return {
      success: Boolean(res.data.ok),
      ok: Boolean(res.data.ok),
      tokenCount: res.data.tokenCount,
      storageMode: res.data.storageMode,
      message: res.data.message,
    };
  }

  return {
    success: false,
    ok: false,
    message: (res.data as { message?: string } | undefined)?.message || '푸시 토큰 등록에 실패했습니다.',
  };
}

/**
 * 2. 기기 로그아웃·연동 해제 시 푸시 토큰 비활성화
 */
export async function revokePushToken(
  params: RevokePushTokenParams
): Promise<{ success: boolean; ok: boolean; message?: string }> {
  const res = await hubFetch<{ ok?: boolean; message?: string }>('/api/push/revoke-token', {
    method: 'POST',
    body: JSON.stringify(params),
  });

  return {
    success: Boolean(res.ok && res.data?.ok),
    ok: Boolean(res.ok && res.data?.ok),
    message: (res.data as { message?: string } | undefined)?.message,
  };
}

/**
 * 3. 전사 패밀리 앱 공용 모바일 백그라운드 푸시 발송 (1줄 호출)
 */
export async function sendPushNotification(
  params: SendPushNotificationParams
): Promise<SendPushNotificationResult> {
  const res = await hubFetch<SendPushNotificationResult>('/api/push/send', {
    method: 'POST',
    body: JSON.stringify(params),
  });

  if (res.ok && res.data) {
    return {
      success: Boolean(res.data.ok),
      ok: Boolean(res.data.ok),
      attempted: Number(res.data.attempted || 0),
      delivered: Number(res.data.delivered || 0),
      invalidTokens: res.data.invalidTokens || [],
      channel: res.data.channel,
      targetUrl: res.data.targetUrl,
      message: res.data.message,
    };
  }

  return {
    success: false,
    ok: false,
    attempted: 0,
    delivered: 0,
    message: (res.data as { message?: string } | undefined)?.message || '모바일 푸시 알림 발송에 실패했습니다.',
  };
}
