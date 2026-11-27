import crypto from 'node:crypto';
import http2 from 'node:http2';

/**
 * [Ghosti 3귀신 · 전사 공용 모바일 백그라운드 푸시 원소스 엔진]
 * - Apple APNs HTTP/2 (ES256 .p8 Token Auth) & Google FCM HTTP v1 (RS256 OAuth2 Service Account)
 * - 외부 npm 패키지 0개(Node.js 내장 crypto + http2 + fetch만 사용)
 * - PC ➔ 폰 클립보드 선택 전송 시 서버는 평문을 알지 못한 채 E2EE 암호문(cipherB64, ivB64)만 실어
 *   백그라운드·화면꺼짐·앱종료 상태의 iOS/Android 기기를 0.5초 내 즉시 깨웁니다.
 * - 차후 MerlinHub(허브 푸시 게이트웨이 · merlin-hub-sdk)로 승격·통합 가능한 독립 모듈 구조.
 */

let cachedProviderSecrets = null;
let cachedProviderSecretsExpMs = 0;

let cachedApnsJwt = null;
let cachedApnsJwtExpMs = 0;

let cachedFcmAccessToken = null;
let cachedFcmAccessTokenExpMs = 0;

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function normalizePem(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw.replace(/\\n/g, '\n').trim();
}

export async function loadPushProviderSecrets({ readPrivateJson } = {}) {
  const now = Date.now();
  if (cachedProviderSecrets && now < cachedProviderSecretsExpMs) {
    return cachedProviderSecrets;
  }

  let apns = null;
  const envApnsTeam = (process.env.APNS_TEAM_ID || '').trim();
  const envApnsKeyId = (process.env.APNS_KEY_ID || '').trim();
  const envApnsP8 = normalizePem(process.env.APNS_PRIVATE_KEY_P8 || '');
  const envApnsBundle = (process.env.APNS_BUNDLE_ID || 'app.sundreamer.ghosti').trim();
  if (envApnsTeam && envApnsKeyId && envApnsP8) {
    apns = {
      teamId: envApnsTeam,
      keyId: envApnsKeyId,
      privateKeyP8: envApnsP8,
      bundleId: envApnsBundle,
    };
  }

  let fcm = null;
  const envFcmJsonRaw = (process.env.FCM_SERVICE_ACCOUNT_JSON || '').trim();
  if (envFcmJsonRaw) {
    try {
      const parsed = JSON.parse(envFcmJsonRaw);
      if (parsed?.project_id && parsed?.client_email && parsed?.private_key) {
        fcm = {
          projectId: String(parsed.project_id).trim(),
          clientEmail: String(parsed.client_email).trim(),
          privateKey: normalizePem(parsed.private_key),
          tokenUri: String(parsed.token_uri || 'https://oauth2.googleapis.com/token').trim(),
        };
      }
    } catch {
      /* ignore malformed env json */
    }
  } else if (process.env.FCM_PROJECT_ID && process.env.FCM_CLIENT_EMAIL && process.env.FCM_PRIVATE_KEY) {
    fcm = {
      projectId: String(process.env.FCM_PROJECT_ID).trim(),
      clientEmail: String(process.env.FCM_CLIENT_EMAIL).trim(),
      privateKey: normalizePem(process.env.FCM_PRIVATE_KEY),
      tokenUri: 'https://oauth2.googleapis.com/token',
    };
  }

  if ((!apns || !fcm) && typeof readPrivateJson === 'function') {
    try {
      const stored = await readPrivateJson('__system__/push_provider_secrets_v1.json');
      if (stored && typeof stored === 'object') {
        if (!apns && stored.apns?.teamId && stored.apns?.keyId && stored.apns?.privateKeyP8) {
          apns = {
            teamId: String(stored.apns.teamId).trim(),
            keyId: String(stored.apns.keyId).trim(),
            privateKeyP8: normalizePem(stored.apns.privateKeyP8),
            bundleId: String(stored.apns.bundleId || 'app.sundreamer.ghosti').trim(),
          };
        }
        if (!fcm && stored.fcm?.projectId && stored.fcm?.clientEmail && stored.fcm?.privateKey) {
          fcm = {
            projectId: String(stored.fcm.projectId).trim(),
            clientEmail: String(stored.fcm.clientEmail).trim(),
            privateKey: normalizePem(stored.fcm.privateKey),
            tokenUri: String(stored.fcm.tokenUri || 'https://oauth2.googleapis.com/token').trim(),
          };
        }
      }
    } catch {
      /* ignore */
    }
  }

  const result = { apns, fcm };
  cachedProviderSecrets = result;
  cachedProviderSecretsExpMs = now + (apns || fcm ? 5 * 60 * 1000 : 30 * 1000);
  return result;
}

function getApnsProviderJwt(apns) {
  const nowMs = Date.now();
  if (cachedApnsJwt && nowMs < cachedApnsJwtExpMs) {
    return cachedApnsJwt;
  }
  const iat = Math.floor(nowMs / 1000);
  const headerB64 = base64UrlEncode(JSON.stringify({ alg: 'ES256', kid: apns.keyId }));
  const payloadB64 = base64UrlEncode(JSON.stringify({ iss: apns.teamId, iat }));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = crypto.sign('sha256', Buffer.from(signingInput, 'utf8'), {
    key: apns.privateKeyP8,
    dsaEncoding: 'ieee-p1363',
  });
  const jwt = `${signingInput}.${base64UrlEncode(sig)}`;
  cachedApnsJwt = jwt;
  cachedApnsJwtExpMs = nowMs + 45 * 60 * 1000;
  return jwt;
}

function sendApnsHttp2Once(host, deviceToken, apns, jwt, bodyObj) {
  return new Promise((resolve) => {
    let client = null;
    let settled = false;
    const finish = (res) => {
      if (settled) return;
      settled = true;
      try {
        if (client && !client.destroyed) client.close();
      } catch {
        /* ignore */
      }
      resolve(res);
    };

    const timer = setTimeout(() => {
      finish({ ok: false, status: 0, reason: 'APNS_TIMEOUT' });
    }, 6500);

    try {
      client = http2.connect(host);
      client.on('error', (err) => {
        clearTimeout(timer);
        finish({ ok: false, status: 0, reason: String(err?.message || 'APNS_CONNECT_ERROR') });
      });

      const bodyBuf = Buffer.from(JSON.stringify(bodyObj), 'utf8');
      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${encodeURIComponent(deviceToken)}`,
        authorization: `bearer ${jwt}`,
        'apns-topic': apns.bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 300),
        'content-type': 'application/json',
        'content-length': String(bodyBuf.length),
      });

      let status = 0;
      const chunks = [];
      req.on('response', (headers) => {
        status = Number(headers[':status'] || 0);
      });
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        clearTimeout(timer);
        const rawText = Buffer.concat(chunks).toString('utf8');
        let reason = '';
        try {
          reason = String(JSON.parse(rawText)?.reason || '');
        } catch {
          reason = rawText.slice(0, 120);
        }
        const invalidToken =
          status === 410 ||
          reason === 'Unregistered' ||
          reason === 'BadDeviceToken' ||
          reason === 'DeviceTokenNotForTopic';
        finish({ ok: status === 200, status, reason, invalidToken });
      });
      req.on('error', (err) => {
        clearTimeout(timer);
        finish({ ok: false, status: 0, reason: String(err?.message || 'APNS_REQ_ERROR') });
      });
      req.end(bodyBuf);
    } catch (err) {
      clearTimeout(timer);
      finish({ ok: false, status: 0, reason: String(err?.message || 'APNS_EXCEPTION') });
    }
  });
}

async function sendApnsNotification(deviceToken, apns, bodyObj, preferredEnv = 'production') {
  const jwt = getApnsProviderJwt(apns);
  const primaryHost =
    preferredEnv === 'sandbox'
      ? 'https://api.sandbox.push.apple.com'
      : 'https://api.push.apple.com';
  const res = await sendApnsHttp2Once(primaryHost, deviceToken, apns, jwt, bodyObj);
  if (!res.ok && res.reason === 'BadDeviceToken' && primaryHost === 'https://api.push.apple.com') {
    const retry = await sendApnsHttp2Once(
      'https://api.sandbox.push.apple.com',
      deviceToken,
      apns,
      jwt,
      bodyObj
    );
    if (retry.ok) return { ...retry, usedEnv: 'sandbox' };
  }
  return { ...res, usedEnv: preferredEnv };
}

async function getFcmAccessToken(fcm) {
  const nowMs = Date.now();
  if (cachedFcmAccessToken && nowMs < cachedFcmAccessTokenExpMs) {
    return cachedFcmAccessToken;
  }
  const nowSec = Math.floor(nowMs / 1000);
  const headerB64 = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payloadB64 = base64UrlEncode(
    JSON.stringify({
      iss: fcm.clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: fcm.tokenUri,
      iat: nowSec - 30,
      exp: nowSec + 3600,
    })
  );
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(signingInput, 'utf8'), fcm.privateKey);
  const assertion = `${signingInput}.${base64UrlEncode(sig)}`;

  const res = await fetch(fcm.tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`FCM_OAUTH_${res.status}`);
  }
  const data = await res.json();
  if (!data?.access_token) {
    throw new Error('FCM_OAUTH_NO_TOKEN');
  }
  cachedFcmAccessToken = String(data.access_token);
  cachedFcmAccessTokenExpMs = nowMs + 50 * 60 * 1000;
  return cachedFcmAccessToken;
}

async function sendFcmDataMessage(deviceToken, fcm, dataPayload) {
  try {
    const accessToken = await getFcmAccessToken(fcm);
    const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(fcm.projectId)}/messages:send`;
    const stringData = {};
    for (const [k, v] of Object.entries(dataPayload || {})) {
      if (v !== undefined && v !== null) {
        stringData[k] = String(v);
      }
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          data: stringData,
          android: {
            priority: 'HIGH',
            ttl: '300s',
          },
        },
      }),
    });
    if (res.ok) {
      return { ok: true, status: res.status };
    }
    const errText = await res.text().catch(() => '');
    const invalidToken =
      res.status === 404 ||
      errText.includes('UNREGISTERED') ||
      errText.includes('INVALID_ARGUMENT');
    return { ok: false, status: res.status, reason: errText.slice(0, 160), invalidToken };
  } catch (err) {
    return { ok: false, status: 0, reason: String(err?.message || 'FCM_ERROR') };
  }
}

/**
 * PC ➔ 폰 [📱 폰으로 보내기] E2EE 백그라운드 푸시 발송 (iOS APNs + Android FCM 동시 발사)
 */
export async function dispatchPcClipPushToTokens({
  tokens,
  pushItem,
  readPrivateJson,
}) {
  const safeTokens = Array.isArray(tokens) ? tokens.filter((t) => t && t.pushToken && t.platform) : [];
  if (safeTokens.length === 0) {
    return { attempted: 0, delivered: 0, invalidTokens: [], configured: false };
  }

  const secrets = await loadPushProviderSecrets({ readPrivateJson });
  if (!secrets.apns && !secrets.fcm) {
    return { attempted: 0, delivered: 0, invalidTokens: [], configured: false };
  }

  const cleanSender = String(pushItem.senderName || '내 PC').trim() || '내 PC';
  // APNs 4KB 페이로드 제한 보호: 암호문이 2800자 이하이면 직접 실어 0ms 오프라인 복호화, 초과 시 인박스 fetch
  const inlineCipher = String(pushItem.cipherB64 || '').length <= 2800 ? String(pushItem.cipherB64 || '') : '';
  const inlineIv = inlineCipher ? String(pushItem.ivB64 || '') : '';

  const results = await Promise.all(
    safeTokens.map(async (entry) => {
      const plat = String(entry.platform || '').toLowerCase();
      const tok = String(entry.pushToken || '').trim();
      if (!tok) return { ok: false, tok, invalidToken: false };

      if (plat === 'ios' && secrets.apns) {
        const apnsBody = {
          aps: {
            alert: {
              title: `📋 ${cleanSender}에서 보낸 클립보드`,
              subtitle: '아래로 당겨 [📋 복사] 또는 배너 한 번 터치',
              body: '새 클립보드가 도착했습니다. 눌러서 바로 복사하세요.',
            },
            sound: 'default',
            category: 'GHOSTI_PC_CLIP',
            'mutable-content': 1,
            'content-available': 1,
          },
          type: 'GHOSTI_PC_CLIP',
          pushId: String(pushItem.pushId || ''),
          cipherB64: inlineCipher,
          ivB64: inlineIv,
          senderName: cleanSender,
          createdAtMs: String(pushItem.createdAtMs || Date.now()),
        };
        const r = await sendApnsNotification(tok, secrets.apns, apnsBody, entry.apnsEnv || 'production');
        return { ...r, tok, platform: 'ios' };
      }

      if (plat === 'android' && secrets.fcm) {
        const fcmData = {
          type: 'GHOSTI_PC_CLIP',
          pushId: String(pushItem.pushId || ''),
          cipherB64: inlineCipher,
          ivB64: inlineIv,
          senderName: cleanSender,
          createdAtMs: String(pushItem.createdAtMs || Date.now()),
        };
        const r = await sendFcmDataMessage(tok, secrets.fcm, fcmData);
        return { ...r, tok, platform: 'android' };
      }

      return { ok: false, tok, invalidToken: false };
    })
  );

  const delivered = results.filter((r) => r.ok).length;
  const invalidTokens = results.filter((r) => r.invalidToken).map((r) => r.tok);
  return {
    attempted: results.length,
    delivered,
    invalidTokens,
    configured: true,
  };
}
