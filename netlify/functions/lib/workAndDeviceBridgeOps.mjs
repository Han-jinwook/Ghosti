/**
 * [Ghosti Server Bridge Ops]
 * - 6. 💼 업무 공유 (S: 드라이브): 방 생성·초대 수락(ghosti_lounge_members 정식 편입)·24시간 무설치 프리뷰·
 *   대용량(>512KB~50MB) 서명 URL 원본 동기화·최신 mtime 보호·파일 삭제 Tombstone 전파
 * - 5. 📱 내 기기 통합 (PC+폰+PC+): ghosti_devices 정식 SQL 등록/조회·6자리/QR 페어링(ghosti_pairing_codes)·
 *   2번째 기기 연결 30일 무료체험(D-30) 및 요금제 영속화·AES-256-GCM E2EE 클립보드 지연 우체통·13KB 섀도우/원본 미러링
 */
import crypto from 'node:crypto';

const WORK_BUCKET = 'ghosti-work-vault';
const DEVICE_BUCKET = 'ghosti-device-vault';

let bucketsEnsured = false;

function srvHeaders(serviceKey, extra = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extra,
  };
}

function sha256Hex(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

async function ensureVaultBuckets(supabaseUrl, serviceKey, force = false) {
  if (bucketsEnsured && !force) return;
  const results = await Promise.all(
    [WORK_BUCKET, DEVICE_BUCKET].map(async (b) => {
      try {
        const res = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
          method: 'POST',
          headers: srvHeaders(serviceKey, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({ id: b, name: b, public: false }),
        });
        return res.ok || res.status === 409;
      } catch {
        return false;
      }
    })
  );
  if (results.every(Boolean)) {
    bucketsEnsured = true;
  }
}

async function readStorageJson(supabaseUrl, serviceKey, bucket, objectPath, fallback) {
  try {
    const bust = `t=${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const res = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}?${bust}`, {
      method: 'GET',
      cache: 'no-store',
      headers: srvHeaders(serviceKey, {
        'Cache-Control': 'no-cache, no-store, max-age=0',
      }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    return data ?? fallback;
  } catch {
    return fallback;
  }
}

async function writeStorageJson(supabaseUrl, serviceKey, bucket, objectPath, payload) {
  await ensureVaultBuckets(supabaseUrl, serviceKey, false);
  const bodyStr = JSON.stringify(payload);
  const doUpload = async (method) =>
    fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`, {
      method,
      headers: srvHeaders(serviceKey, {
        'Content-Type': 'application/json',
        'x-upsert': 'true',
        'cache-control': '0',
      }),
      body: bodyStr,
    });

  try {
    let res = await doUpload('POST');
    if (res.ok) return true;
    // 버킷 미생성 또는 중복 충돌 시 버킷 강제 보장 후 PUT/POST 1회 재시도
    await ensureVaultBuckets(supabaseUrl, serviceKey, true);
    res = await doUpload(res.status === 409 || res.status === 400 ? 'PUT' : 'POST');
    if (res.ok) return true;
    res = await doUpload('POST');
    return res.ok;
  } catch {
    return false;
  }
}

async function createSignedUploadUrl(supabaseUrl, serviceKey, bucket, objectPath) {
  await ensureVaultBuckets(supabaseUrl, serviceKey);
  const res = await fetch(`${supabaseUrl}/storage/v1/object/upload/sign/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: srvHeaders(serviceKey, {
      'Content-Type': 'application/json',
      'x-upsert': 'true',
    }),
    body: '{}',
  });
  if (!res.ok) {
    const errTxt = await res.text().catch(() => '');
    return { ok: false, reason: `SIGN_UPLOAD_FAILED (${res.status}): ${errTxt.slice(0, 160)}` };
  }
  const data = await res.json().catch(() => ({}));
  if (!data?.url) return { ok: false, reason: 'EMPTY_SIGNED_UPLOAD_URL' };
  return {
    ok: true,
    signedUploadUrl: `${supabaseUrl}/storage/v1${data.url}`,
    objectPath,
  };
}

async function createSignedDownloadUrl(supabaseUrl, serviceKey, bucket, objectPath, expiresIn = 600) {
  const res = await fetch(`${supabaseUrl}/storage/v1/object/sign/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: srvHeaders(serviceKey, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) {
    return { ok: false, reason: `BLOB_NOT_FOUND (${res.status})` };
  }
  const data = await res.json().catch(() => ({}));
  const rel = data?.signedURL || data?.signedUrl || '';
  if (!rel) return { ok: false, reason: 'EMPTY_SIGNED_DOWNLOAD_URL' };
  return {
    ok: true,
    signedDownloadUrl: `${supabaseUrl}/storage/v1${rel}`,
  };
}

function resolveWorkPlanSeatLimit(workPlanId, workPaidActive, workTrialActive) {
  if (workPaidActive) {
    const id = String(workPlanId || '').trim();
    if (id.startsWith('work_pro_')) return 50;
    if (id.startsWith('work_biz_')) return 20;
    return 5;
  }
  if (workTrialActive) return 5;
  return 0;
}

async function verifyInviteTokenForWorkRoom(supabaseUrl, serviceKey, inviteToken) {
  const cleanTok = String(inviteToken || '').trim();
  if (!cleanTok) return null;
  const invRes = await fetch(
    `${supabaseUrl}/rest/v1/ghosti_room_invites?token=eq.${encodeURIComponent(cleanTok)}&revoked_at=is.null&select=token,room_id,expires_at,max_uses,used_count,default_role&limit=1`,
    { headers: srvHeaders(serviceKey) }
  );
  if (!invRes.ok) return null;
  const invRows = await invRes.json().catch(() => []);
  const inv = Array.isArray(invRows) ? invRows[0] : null;
  if (!inv?.room_id) return null;
  if (inv.expires_at && Date.parse(inv.expires_at) <= Date.now()) return null;
  const maxUses = Number(inv.max_uses || 5);
  const usedCount = Number(inv.used_count || 0);
  if (maxUses > 0 && usedCount >= maxUses) return null;

  const roomRes = await fetch(
    `${supabaseUrl}/rest/v1/ghosti_lounge_rooms?room_id=eq.${encodeURIComponent(inv.room_id)}&lounge_type=eq.work&select=room_id,lounge_type,room_title,master_email,pricing_plan&limit=1`,
    { headers: srvHeaders(serviceKey) }
  );
  const roomRows = roomRes.ok ? await roomRes.json().catch(() => []) : [];
  const room = Array.isArray(roomRows) ? roomRows[0] : null;
  if (!room || room.lounge_type !== 'work') return null;

  const memRes = await fetch(
    `${supabaseUrl}/rest/v1/ghosti_lounge_members?room_id=eq.${encodeURIComponent(inv.room_id)}&role=eq.master&select=room_persona_nickname&limit=1`,
    { headers: srvHeaders(serviceKey) }
  );
  const memRows = memRes.ok ? await memRes.json().catch(() => []) : [];
  const hostNickname = (Array.isArray(memRows) && memRows[0]?.room_persona_nickname) || '방장';

  return { invite: inv, room, hostNickname };
}

/**
 * 방 종류(lounge_type === 'work')와 호출자의 정식 멤버십·권한('master' | 'editor' | 'viewer')을 동시에 검증합니다.
 * 가족방/동호회방 roomId를 넣어 업무방 액션을 호출하는 교차 방 접근을 100% 차단합니다.
 */
// ghosti_lounge_members.role 정식 SQL CHECK 제약('master'|'admin'|'member') ↔ 업무 공유 권한('host'|'editor'|'viewer') 단일 매핑
function normalizeWorkRoleFromDb(rawRole, isMaster = false) {
  const r = String(rawRole || '').trim().toLowerCase();
  if (isMaster || r === 'master') return 'master';
  if (r === 'viewer' || r === 'member') return 'viewer';
  return 'editor'; // 'admin' | 'editor'
}

function mapWorkRoleToDb(uiRole) {
  const r = String(uiRole || '').trim().toLowerCase();
  if (r === 'master' || r === 'host') return 'master';
  return r === 'viewer' ? 'member' : 'admin';
}

const GENERIC_PLACEHOLDER_WORK_NICKS = new Set([
  '초대 팀원',
  '초대팀원',
  '팀원',
  '방장(나)',
  '방장',
  '게스트',
  '익명',
  'anonymous',
  'guest',
  'member',
]);

function isGenericPlaceholderWorkNick(raw) {
  const clean = String(raw || '').trim();
  if (!clean) return true;
  return (
    GENERIC_PLACEHOLDER_WORK_NICKS.has(clean) ||
    GENERIC_PLACEHOLDER_WORK_NICKS.has(clean.toLowerCase())
  );
}

function resolveCleanWorkMemberNickname(rawNick, fallbackHubNick, memberEmail) {
  const cand = String(rawNick || '').trim();
  if (cand && !isGenericPlaceholderWorkNick(cand)) {
    return cand.slice(0, 32);
  }
  const hubCand = String(fallbackHubNick || '').trim();
  if (hubCand && !isGenericPlaceholderWorkNick(hubCand)) {
    return hubCand.slice(0, 32);
  }
  const emailPrefix = String(memberEmail || '').trim().split('@')[0];
  return (emailPrefix || '팀원').slice(0, 32);
}

/**
 * 업무 공유방 팀원 목록 결정론적 고정 정렬 (PostgreSQL MVCC 업데이트 순서 흔들림 0%):
 * 1순위: 방장(role === 'master') 항상 1번 고정
 * 2순위: 합류 시각(joined_at) 오름차순 (권한 PATCH 후 F5 시에도 순서 불변)
 * 3순위: 이메일(member_email) 사전순 오름차순
 */
function sortAndMapWorkMembers(rawMembers, masterEmail, fallbackHostNickname = '') {
  const cleanMaster = String(masterEmail || '').trim().toLowerCase();
  const byEmail = new Map();
  for (const m of Array.isArray(rawMembers) ? rawMembers : []) {
    const mEmail = String(m?.member_email || m?.email || '').trim().toLowerCase();
    if (!mEmail || !mEmail.includes('@')) continue;
    const isRoomMaster = Boolean(cleanMaster && mEmail === cleanMaster);
    byEmail.set(mEmail, {
      email: mEmail,
      nickname: resolveCleanWorkMemberNickname(
        m.room_persona_nickname || m.nickname,
        isRoomMaster ? fallbackHostNickname : '',
        mEmail
      ),
      role: normalizeWorkRoleFromDb(m.role, isRoomMaster),
      joinedAt: m.joined_at || m.joinedAt || null,
    });
  }
  if (cleanMaster && cleanMaster.includes('@') && !byEmail.has(cleanMaster)) {
    byEmail.set(cleanMaster, {
      email: cleanMaster,
      nickname: resolveCleanWorkMemberNickname(fallbackHostNickname, '', cleanMaster),
      role: 'master',
      joinedAt: null,
    });
  }
  const list = Array.from(byEmail.values());
  list.sort((a, b) => {
    const aHost = a.role === 'master' ? 0 : 1;
    const bHost = b.role === 'master' ? 0 : 1;
    if (aHost !== bHost) return aHost - bHost;
    const aTs = a.joinedAt ? Date.parse(a.joinedAt) : NaN;
    const bTs = b.joinedAt ? Date.parse(b.joinedAt) : NaN;
    const aValid = Number.isFinite(aTs);
    const bValid = Number.isFinite(bTs);
    if (aValid && bValid && aTs !== bTs) return aTs - bTs;
    if (aValid !== bValid) return aValid ? -1 : 1;
    return a.email.localeCompare(b.email);
  });
  return list;
}

async function getWorkRoomMemberContext(supabaseUrl, serviceKey, roomId, email) {
  const cleanRoom = String(roomId || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanRoom || !cleanEmail) return null;

  const roomRes = await fetch(
    `${supabaseUrl}/rest/v1/ghosti_lounge_rooms?room_id=eq.${encodeURIComponent(cleanRoom)}&lounge_type=eq.work&select=room_id,lounge_type,room_title,master_email,pricing_plan&limit=1`,
    { headers: srvHeaders(serviceKey) }
  );
  const roomRows = roomRes.ok ? await roomRes.json().catch(() => []) : [];
  const room = Array.isArray(roomRows) ? roomRows[0] : null;
  if (!room || room.lounge_type !== 'work') return null;

  const isMaster = String(room.master_email || '').toLowerCase() === cleanEmail;
  const memRes = await fetch(
    `${supabaseUrl}/rest/v1/ghosti_lounge_members?room_id=eq.${encodeURIComponent(cleanRoom)}&select=member_email,role,room_persona_nickname,joined_at&order=joined_at.asc,member_email.asc`,
    { headers: srvHeaders(serviceKey) }
  );
  const memRows = memRes.ok ? await memRes.json().catch(() => []) : [];
  const members = Array.isArray(memRows) ? memRows : [];
  const myRow = members.find((r) => String(r.member_email || '').toLowerCase() === cleanEmail);

  if (!isMaster && !myRow) return null;
  const normalizedRole = normalizeWorkRoleFromDb(myRow?.role, isMaster);

  return {
    room,
    isMaster,
    role: normalizedRole,
    members,
  };
}

function mergeWorkTombstones(a, b) {
  const out = {};
  const nowMs = Date.now();
  const maxAgeMs = 60 * 24 * 3600 * 1000; // 60일 경과 Tombstone 자동 가지치기 (무한 비대화 방지)
  for (const src of [a, b]) {
    if (!src || typeof src !== 'object') continue;
    for (const [rawKey, val] of Object.entries(src)) {
      const k = String(rawKey || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
      if (!k || k.includes('..') || !val || typeof val !== 'object') continue;
      const nextTs = Date.parse(val.deletedAt || '') || 0;
      if (nextTs > 0 && nowMs - nextTs > maxAgeMs) continue;
      const canonKey = k.toLowerCase();
      const prevTs = Date.parse(out[canonKey]?.deletedAt || '') || 0;
      if (!out[canonKey] || nextTs >= prevTs) {
        out[canonKey] = {
          relPath: k,
          deletedAt: val.deletedAt || new Date(nowMs).toISOString(),
          deletedBy: String(val.deletedBy || '팀원').slice(0, 32),
          uploaderEmail: val.uploaderEmail ? String(val.uploaderEmail).toLowerCase() : undefined,
        };
      }
    }
  }
  return out;
}

/**
 * [Zero-Cloud 원칙 — 서버 파일·본문 저장 0 Byte]:
 * 서버에는 업무 문서 원본(Base64/바이너리)이나 본문 텍스트를 단 1 Byte도 저장하지 않으며,
 * 오직 ① 대장 PC(24시간 회사 업무 서버)의 상시 아웃바운드 HTTPS 터널 주소·접근 키,
 * ② 예비 서버(1·2호) 설정, ③ 경량 삭제 Tombstone(경로+시각)만 보관합니다.
 */
async function readWorkRoomP2pState(supabaseUrl, serviceKey, roomId) {
  const [p2pState, tombFile] = await Promise.all([
    readStorageJson(
      supabaseUrl,
      serviceKey,
      WORK_BUCKET,
      `${roomId}/p2p_state_v2.json`,
      {
        hostTunnelUrl: '',
        hostAccessKey: '',
        hostUpdatedAt: null,
        masterServerName: '사내 대장 PC (S:)',
        backupServers: [],
        deletedTombstones: {},
      }
    ),
    readStorageJson(
      supabaseUrl,
      serviceKey,
      WORK_BUCKET,
      `${roomId}/tombstones_v1.json`,
      { deletedTombstones: {} }
    ),
  ]);
  const mergedTombstones = mergeWorkTombstones(
    p2pState?.deletedTombstones,
    tombFile?.deletedTombstones
  );
  return {
    state: {
      hostTunnelUrl: String(p2pState?.hostTunnelUrl || '').trim(),
      hostAccessKey: String(p2pState?.hostAccessKey || '').trim(),
      hostUpdatedAt: p2pState?.hostUpdatedAt || null,
      masterServerName: String(p2pState?.masterServerName || '사내 대장 PC (S:)').slice(0, 48),
      backupServers: Array.isArray(p2pState?.backupServers) ? p2pState.backupServers.slice(0, 2) : [],
      deletedTombstones: mergedTombstones,
    },
    tombstones: mergedTombstones,
  };
}

async function writeWorkRoomP2pState(supabaseUrl, serviceKey, roomId, nextState) {
  const cleanTombs = mergeWorkTombstones(nextState?.deletedTombstones, {});
  const payload = {
    updatedAt: new Date().toISOString(),
    hostTunnelUrl: String(nextState?.hostTunnelUrl || '').trim(),
    hostAccessKey: String(nextState?.hostAccessKey || '').trim(),
    hostUpdatedAt: nextState?.hostUpdatedAt || null,
    masterServerName: String(nextState?.masterServerName || '사내 대장 PC (S:)').slice(0, 48),
    backupServers: Array.isArray(nextState?.backupServers) ? nextState.backupServers.slice(0, 2) : [],
    deletedTombstones: cleanTombs,
  };
  const [okState, okTomb] = await Promise.all([
    writeStorageJson(supabaseUrl, serviceKey, WORK_BUCKET, `${roomId}/p2p_state_v2.json`, payload),
    writeStorageJson(supabaseUrl, serviceKey, WORK_BUCKET, `${roomId}/tombstones_v1.json`, {
      updatedAt: payload.updatedAt,
      deletedTombstones: cleanTombs,
    }),
  ]);
  return Boolean(okState || okTomb);
}

const SERVER_SUBSCRIPTION_PLANS = {
  personal_sub_3900: {
    canonicalId: 'personal_sub_3900',
    category: 'personal',
    priceCoins: 3900,
    durationDays: 30,
    displayText: '귀신같이 [5. 내 기기 통합] 30일 이용권 (3,900C)',
  },
  personal_year_39000: {
    canonicalId: 'personal_year_39000',
    category: 'personal',
    priceCoins: 39000,
    durationDays: 365,
    displayText: '귀신같이 [5. 내 기기 통합] 연간 365일 이용권 (39,000C)',
  },
  personal_year_35000: {
    canonicalId: 'personal_year_39000',
    category: 'personal',
    priceCoins: 39000,
    durationDays: 365,
    displayText: '귀신같이 [5. 내 기기 통합] 연간 365일 이용권 (39,000C)',
  },
  work_soho_9900: {
    canonicalId: 'work_soho_9900',
    category: 'work',
    priceCoins: 9900,
    durationDays: 30,
    displayText: '귀신같이 [6. 업무 공유] 소호(~5인) 30일 이용권 (9,900C)',
  },
  work_soho_year_99000: {
    canonicalId: 'work_soho_year_99000',
    category: 'work',
    priceCoins: 99000,
    durationDays: 365,
    displayText: '귀신같이 [6. 업무 공유] 소호(~5인) 연간 365일 이용권 (99,000C)',
  },
  work_biz_19000: {
    canonicalId: 'work_biz_19000',
    category: 'work',
    priceCoins: 19000,
    durationDays: 30,
    displayText: '귀신같이 [6. 업무 공유] 소기업(~20인) 30일 이용권 (19,000C)',
  },
  work_biz_year_190000: {
    canonicalId: 'work_biz_year_190000',
    category: 'work',
    priceCoins: 190000,
    durationDays: 365,
    displayText: '귀신같이 [6. 업무 공유] 소기업(~20인) 연간 365일 이용권 (190,000C)',
  },
  work_biz_19900: {
    canonicalId: 'work_biz_19000',
    category: 'work',
    priceCoins: 19000,
    durationDays: 30,
    displayText: '귀신같이 [6. 업무 공유] 소기업(~20인) 30일 이용권 (19,000C)',
  },
  work_biz_year_199000: {
    canonicalId: 'work_biz_year_190000',
    category: 'work',
    priceCoins: 190000,
    durationDays: 365,
    displayText: '귀신같이 [6. 업무 공유] 소기업(~20인) 연간 365일 이용권 (190,000C)',
  },
  work_pro_29000: {
    canonicalId: 'work_pro_29000',
    category: 'work',
    priceCoins: 29000,
    durationDays: 30,
    displayText: '귀신같이 [6. 업무 공유] 중소기업(~50인) 30일 이용권 (29,000C)',
  },
  work_pro_year_290000: {
    canonicalId: 'work_pro_year_290000',
    category: 'work',
    priceCoins: 290000,
    durationDays: 365,
    displayText: '귀신같이 [6. 업무 공유] 중소기업(~50인) 연간 365일 이용권 (290,000C)',
  },
  // [Door 2: 귀신키(GhostKey) 단독 요금제 — 본체 구독창에서는 비노출, ghostkey.sundreamer.app 전용 호출]
  ghostkey_sub_1900: {
    canonicalId: 'ghostkey_sub_1900',
    category: 'ghostkey',
    priceCoins: 1900,
    durationDays: 30,
    displayText: '[귀신키] 단독 30일 이용권 (1,900C)',
  },
  ghostkey_year_19000: {
    canonicalId: 'ghostkey_year_19000',
    category: 'ghostkey',
    priceCoins: 19000,
    durationDays: 365,
    displayText: '[귀신키] 단독 연간 365일 이용권 (19,000C)',
  },
};

async function syncProductSubscriptionRow(supabaseUrl, serviceKey, {
  email,
  userId,
  productCode,
  planId,
  trialStartedAt,
  paidExpiresAt,
  lastOrderId,
  lastPaidCoins,
}) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/ghosti_product_subscriptions?on_conflict=email,product_code`, {
      method: 'POST',
      headers: srvHeaders(serviceKey, {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify({
        email,
        user_id: userId || null,
        product_code: productCode,
        plan_id: planId || 'free_trial',
        trial_started_at: trialStartedAt || null,
        paid_expires_at: paidExpiresAt || null,
        last_order_id: lastOrderId || null,
        last_paid_coins: Number(lastPaidCoins || 0),
        updated_at: new Date().toISOString(),
      }),
    });
  } catch {
    /* SQL 테이블 마이그레이션 전에도 Storage 원장은 정상 동작 */
  }
}

function computeEntitlementView(entRaw, activeDeviceCount) {
  const nowMs = Date.now();
  const ent = {
    planId: entRaw?.planId || 'free_trial',
    trialOptInStartedAt: entRaw?.trialOptInStartedAt || null,
    activatedAt: entRaw?.activatedAt || null,
    paidExpiresAt: entRaw?.paidExpiresAt || null,
    lastOrderId: entRaw?.lastOrderId || null,
    workPlanId: entRaw?.workPlanId || null,
    workTrialOptInStartedAt: entRaw?.workTrialOptInStartedAt || null,
    workPaidExpiresAt: entRaw?.workPaidExpiresAt || null,
    ghostkeyPlanId: entRaw?.ghostkeyPlanId || null,
    ghostkeyTrialOptInStartedAt: entRaw?.ghostkeyTrialOptInStartedAt || null,
    ghostkeyPaidExpiresAt: entRaw?.ghostkeyPaidExpiresAt || null,
  };
  let trialActive = false;
  let trialDaysLeft = 0;
  if (ent.trialOptInStartedAt) {
    const startMs = Date.parse(ent.trialOptInStartedAt);
    if (Number.isFinite(startMs)) {
      const remainMs = startMs + 30 * 24 * 3600 * 1000 - nowMs;
      trialDaysLeft = remainMs > 0 ? Math.ceil(remainMs / (24 * 3600 * 1000)) : 0;
      trialActive = remainMs > 0;
    }
  }
  const paidExpMs = ent.paidExpiresAt ? Date.parse(ent.paidExpiresAt) : NaN;
  const isPersonalPaidPlan =
    ent.planId === 'personal_sub_3900' ||
    ent.planId === 'personal_year_39000' ||
    ent.planId === 'personal_year_35000';
  // 실결제 만료일(paidExpiresAt)이 미래인 경우에만 유료 무제한 인정 (구버전 무결제 개통 잔여분 자동 차단)
  const isPaidUnlimited = Boolean(isPersonalPaidPlan && Number.isFinite(paidExpMs) && paidExpMs > nowMs);
  const paidDaysLeft = isPaidUnlimited
    ? Math.max(1, Math.ceil((paidExpMs - nowMs) / (24 * 3600 * 1000)))
    : 0;

  let workTrialActive = false;
  let workTrialDaysLeft = 0;
  if (ent.workTrialOptInStartedAt) {
    const wStartMs = Date.parse(ent.workTrialOptInStartedAt);
    if (Number.isFinite(wStartMs)) {
      const wRemainMs = wStartMs + 30 * 24 * 3600 * 1000 - nowMs;
      workTrialDaysLeft = wRemainMs > 0 ? Math.ceil(wRemainMs / (24 * 3600 * 1000)) : 0;
      workTrialActive = wRemainMs > 0;
    }
  }

  const workExpMs = ent.workPaidExpiresAt ? Date.parse(ent.workPaidExpiresAt) : NaN;
  const workPaidActive = Boolean(ent.workPlanId && Number.isFinite(workExpMs) && workExpMs > nowMs);
  const workPaidDaysLeft = workPaidActive
    ? Math.max(1, Math.ceil((workExpMs - nowMs) / (24 * 3600 * 1000)))
    : 0;

  let ghostkeyTrialActive = false;
  let ghostkeyTrialDaysLeft = 0;
  if (ent.ghostkeyTrialOptInStartedAt) {
    const gkStartMs = Date.parse(ent.ghostkeyTrialOptInStartedAt);
    if (Number.isFinite(gkStartMs)) {
      const gkRemainMs = gkStartMs + 30 * 24 * 3600 * 1000 - nowMs;
      ghostkeyTrialDaysLeft = gkRemainMs > 0 ? Math.ceil(gkRemainMs / (24 * 3600 * 1000)) : 0;
      ghostkeyTrialActive = gkRemainMs > 0;
    }
  }
  const gkExpMs = ent.ghostkeyPaidExpiresAt ? Date.parse(ent.ghostkeyPaidExpiresAt) : NaN;
  const ghostkeyPaidActive = Boolean(ent.ghostkeyPlanId && Number.isFinite(gkExpMs) && gkExpMs > nowMs);
  const ghostkeyPaidDaysLeft = ghostkeyPaidActive
    ? Math.max(1, Math.ceil((gkExpMs - nowMs) / (24 * 3600 * 1000)))
    : 0;

  const trialExpired = Boolean(ent.trialOptInStartedAt && !trialActive && !isPaidUnlimited);
  const workTrialExpired = Boolean(ent.workTrialOptInStartedAt && !workTrialActive && !workPaidActive);
  const ghostkeyTrialExpired = Boolean(
    ent.ghostkeyTrialOptInStartedAt && !ghostkeyTrialActive && !ghostkeyPaidActive && !isPaidUnlimited
  );
  const proUnlocked = Boolean(isPaidUnlimited || trialActive);
  const workSubscriptionUnlocked = Boolean(workPaidActive || workTrialActive);
  // [멀린님 확정 가격 동인]:
  // - Pro(월 3,900원 / 본체 30일 체험) 활성 시: 기기통합 + 사진·표 OCR + 귀신 라벨러 + 귀신키 전부 해금!
  // - 귀신키 단독(월 1,900원 / 귀신키 30일 체험) 활성 시: 오직 귀신키만 해금되며, 사진·표 OCR과 귀신 라벨러는 해금되지 않음(양방향 Pro 업그레이드 동인)!
  const ghostkeySubscriptionUnlocked = Boolean(ghostkeyPaidActive || ghostkeyTrialActive || proUnlocked);
  const ocrAndLabelerUnlocked = proUnlocked;
  const workSeatLimit = resolveWorkPlanSeatLimit(ent.workPlanId, workPaidActive, workTrialActive);

  return {
    ...ent,
    activeDeviceCount,
    trialActive,
    trialDaysLeft,
    trialExpired,
    isPaidUnlimited,
    paidDaysLeft,
    workTrialActive,
    workTrialDaysLeft,
    workTrialExpired,
    workPaidActive,
    workPaidDaysLeft,
    workSubscriptionUnlocked,
    workSeatLimit,
    ghostkeyTrialActive,
    ghostkeyTrialDaysLeft,
    ghostkeyTrialExpired,
    ghostkeyPaidActive,
    ghostkeyPaidDaysLeft,
    ghostkeySubscriptionUnlocked,
    ocrAndLabelerUnlocked,
    unlimitedBindingUnlocked: proUnlocked,
  };
}

async function assertDeviceSyncUnlocked(supabaseUrl, serviceKey, emailHash) {
  const entRaw = await readStorageJson(
    supabaseUrl,
    serviceKey,
    DEVICE_BUCKET,
    `${emailHash}/entitlement_v1.json`,
    { planId: 'free_trial', trialOptInStartedAt: null, activatedAt: null, paidExpiresAt: null }
  );
  const view = computeEntitlementView(entRaw, 1);
  if (view.unlimitedBindingUnlocked) {
    return { ok: true, entitlement: view };
  }
  return {
    ok: false,
    response: {
      status: 402,
      body: {
        ok: false,
        reason: view.trialExpired ? 'TRIAL_EXPIRED' : 'TRIAL_OPT_IN_REQUIRED',
        message: view.trialExpired
          ? '30일 무료체험이 종료되었습니다. 월 3,900원 이용권 결제 후 내 기기 통합을 계속 이용할 수 있습니다.'
          : '내 기기 통합(2대+ 연동)은 30일 무료체험 시작 또는 이용권 구독 후 이용할 수 있습니다.',
        entitlement: view,
      },
    },
  };
}

async function assertWorkOwnerUnlocked(supabaseUrl, serviceKey, masterEmail) {
  const cleanMaster = String(masterEmail || '').trim().toLowerCase();
  const masterHash = sha256Hex(cleanMaster).slice(0, 32);
  const entRaw = await readStorageJson(
    supabaseUrl,
    serviceKey,
    DEVICE_BUCKET,
    `${masterHash}/entitlement_v1.json`,
    { planId: 'free_trial', trialOptInStartedAt: null, activatedAt: null, paidExpiresAt: null }
  );
  const view = computeEntitlementView(entRaw, 1);
  if (view.workSubscriptionUnlocked) {
    return { ok: true, entitlement: view };
  }
  return {
    ok: false,
    entitlement: view,
    response: {
      status: 402,
      body: {
        ok: false,
        reason: view.workTrialExpired ? 'WORK_TRIAL_EXPIRED' : 'WORK_SUBSCRIPTION_REQUIRED',
        message: view.workTrialExpired
          ? '업무 공유(S: 드라이브) 30일 무료체험이 종료되었습니다. 소호(~5인) 월 9,900원 구독 후 S: 드라이브와 팀원 직결을 다시 연결할 수 있습니다. (업무 폴더 안의 원본 파일은 100% 보존됩니다)'
          : '업무 공유(S: 드라이브)는 30일 무료체험 시작 또는 이용권(월 9,900원~) 구독 후 이용할 수 있습니다.',
        entitlement: view,
      },
    },
  };
}

/**
 * 비로그인(초대 토큰 보유자) 공개 조회 핸들러:
 * 업무 문서 원본·본문·이메일·경로는 단 1 Byte도 노출하지 않고,
 * 방 제목과 방장 닉네임만 안내하여 로그인(초대 수락) 후 대장 PC 직통 터널로 연결하도록 유도합니다.
 */
export async function handlePublicWorkPreviewAction({
  supabaseUrl,
  serviceKey,
  inviteToken,
}) {
  const verified = await verifyInviteTokenForWorkRoom(supabaseUrl, serviceKey, inviteToken);
  if (!verified) {
    return { status: 200, body: { ok: false, reason: 'INVALID_OR_EXPIRED_INVITE' } };
  }
  const roomId = verified.room.room_id;
  return {
    status: 200,
    body: {
      ok: true,
      requiresLoginForDirectTunnel: true,
      room: {
        roomId,
        roomTitle: verified.room.room_title || '💼 우리팀 업무 공유방 (S:)',
        hostNickname: verified.hostNickname,
      },
      files: [],
      deletedTombstones: {},
    },
  };
}

/**
 * 대장 PC 데몬(Merlin_Z_Core) 상시 터널 자동 갱신 핸들러 (Zero-Cloud · 서버 파일 저장 0 Byte):
 * - PC 재부팅이나 Z-코어 자동 업데이트 시 브라우저가 닫혀 있어도 기등록된 방 전용 256-bit 비밀 키(hostAccessKey)가
 *   상수 시간 비교(timingSafeEqual)로 정확히 일치하는 방장 PC에 한해 새 trycloudflare 터널 주소만 갱신합니다.
 */
export async function handleDaemonWorkTunnelRefreshAction({
  supabaseUrl,
  serviceKey,
  body,
}) {
  const roomId = String(body?.roomId || '').trim();
  const hostEmail = String(body?.hostEmail || '').trim().toLowerCase();
  const accessKey = String(body?.accessKey || '').trim();
  const rawUrl = String(body?.tunnelUrl || '').trim().replace(/\/+$/, '');
  if (
    !roomId ||
    !hostEmail ||
    accessKey.length < 24 ||
    !/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i.test(rawUrl)
  ) {
    return { status: 400, body: { ok: false, reason: 'INVALID_DAEMON_TUNNEL_REFRESH_PARAMS' } };
  }

  const roomRes = await fetch(
    `${supabaseUrl}/rest/v1/ghosti_lounge_rooms?room_id=eq.${encodeURIComponent(roomId)}&lounge_type=eq.work&select=room_id,lounge_type,master_email&limit=1`,
    { headers: srvHeaders(serviceKey) }
  );
  const roomRows = roomRes.ok ? await roomRes.json().catch(() => []) : [];
  const room = Array.isArray(roomRows) ? roomRows[0] : null;
  if (!room || String(room.master_email || '').trim().toLowerCase() !== hostEmail) {
    return { status: 403, body: { ok: false, reason: 'WORK_ROOM_MASTER_MISMATCH' } };
  }

  const ownerGate = await assertWorkOwnerUnlocked(supabaseUrl, serviceKey, room.master_email);
  if (!ownerGate.ok) {
    return ownerGate.response;
  }

  const { state } = await readWorkRoomP2pState(supabaseUrl, serviceKey, roomId);
  const savedKey = String(state.hostAccessKey || '').trim();
  if (savedKey.length < 24) {
    return { status: 403, body: { ok: false, reason: 'HOST_ACCESS_KEY_NOT_BOUND_YET' } };
  }
  const bufProvided = Buffer.from(accessKey, 'utf8');
  const bufSaved = Buffer.from(savedKey, 'utf8');
  if (
    bufProvided.length !== bufSaved.length ||
    !crypto.timingSafeEqual(bufProvided, bufSaved)
  ) {
    return { status: 403, body: { ok: false, reason: 'HOST_ACCESS_KEY_MISMATCH' } };
  }

  state.hostTunnelUrl = rawUrl;
  state.hostUpdatedAt = new Date().toISOString();
  if (body?.masterServerName) {
    state.masterServerName = String(body.masterServerName).trim().slice(0, 48);
  }
  if (Array.isArray(body?.backupServers)) {
    state.backupServers = body.backupServers.slice(0, 2);
  }
  const okWrite = await writeWorkRoomP2pState(supabaseUrl, serviceKey, roomId, state);
  if (!okWrite) {
    return { status: 502, body: { ok: false, reason: 'WORK_TUNNEL_STATE_SAVE_FAILED' } };
  }
  return {
    status: 200,
    body: {
      ok: true,
      roomId,
      tunnelUrl: state.hostTunnelUrl,
      updatedAt: state.hostUpdatedAt,
    },
  };
}

/**
 * 허브 인증 완료 사용자 전용 업무공유(S:) & 내 기기 통합 핸들러
 */
export async function handleAuthedWorkAndDeviceAction({
  action,
  body,
  userId,
  email,
  hubNickname,
  hubToken,
  hubUrl,
  hubClientId,
  hubClientSecret,
  supabaseUrl,
  serviceKey,
}) {
  const actorNick = resolveCleanWorkMemberNickname(
    body.nickname || body.actorNickname,
    hubNickname,
    email
  );

  // ===================================================================
  // A. 6. 💼 업무 공유 (S: 드라이브 · Zero-Cloud 대장 PC 직통 터널) 액션군
  // ===================================================================
  if (action === 'work_ensure_room') {
    const gate = await assertWorkOwnerUnlocked(supabaseUrl, serviceKey, email);
    const roomTitle = String(body.roomTitle || '💼 우리팀 업무 공유방 (S:)').trim().slice(0, 80);
    const hostNickname = String(body.hostNickname || actorNick || '방장').trim().slice(0, 32);

    const existRes = await fetch(
      `${supabaseUrl}/rest/v1/ghosti_lounge_rooms?master_email=eq.${encodeURIComponent(email)}&lounge_type=eq.work&order=created_at.asc&limit=1`,
      { headers: srvHeaders(serviceKey) }
    );
    const existRows = existRes.ok ? await existRes.json().catch(() => []) : [];
    let roomId = Array.isArray(existRows) && existRows[0]?.room_id ? String(existRows[0].room_id) : '';

    if (!gate.ok) {
      return {
        status: 402,
        body: {
          ...gate.response.body,
          roomId: roomId || undefined,
          roomTitle,
          hostNickname,
        },
      };
    }

    const activePlanId = gate.entitlement.workPaidActive
      ? gate.entitlement.workPlanId
      : 'free_trial';
    const seatLimit = gate.entitlement.workSeatLimit || 5;

    if (!roomId) {
      roomId = `room_${sha256Hex(`${email}:work`).slice(0, 16)}`;
      const roomIns = await fetch(`${supabaseUrl}/rest/v1/ghosti_lounge_rooms?on_conflict=room_id`, {
        method: 'POST',
        headers: srvHeaders(serviceKey, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify({
          room_id: roomId,
          lounge_type: 'work',
          sub_type: null,
          room_title: roomTitle,
          master_user_id: userId,
          master_email: email,
          pricing_plan: activePlanId,
        }),
      });
      if (!roomIns.ok) {
        return { status: 502, body: { ok: false, reason: 'WORK_ROOM_CREATE_FAILED' } };
      }
    }

    await fetch(`${supabaseUrl}/rest/v1/ghosti_lounge_members?on_conflict=room_id,member_email`, {
      method: 'POST',
      headers: srvHeaders(serviceKey, {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify({
        room_id: roomId,
        member_email: email,
        role: 'master',
        room_persona_nickname: hostNickname,
      }),
    });

    const invRes = await fetch(
      `${supabaseUrl}/rest/v1/ghosti_room_invites?room_id=eq.${encodeURIComponent(roomId)}&revoked_at=is.null&order=created_at.desc&limit=1`,
      { headers: srvHeaders(serviceKey) }
    );
    const invRows = invRes.ok ? await invRes.json().catch(() => []) : [];
    let inviteToken = '';
    if (
      Array.isArray(invRows) &&
      invRows[0]?.token &&
      Date.parse(invRows[0].expires_at || '') > Date.now() &&
      Number(invRows[0].used_count || 0) < Number(invRows[0].max_uses || seatLimit)
    ) {
      inviteToken = String(invRows[0].token);
    } else {
      inviteToken = sha256Hex(`${crypto.randomUUID()}:${roomId}:${Date.now()}`).slice(0, 36);
      const exp = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(); // 14일 유효
      await fetch(`${supabaseUrl}/rest/v1/ghosti_room_invites`, {
        method: 'POST',
        headers: srvHeaders(serviceKey, {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        }),
        body: JSON.stringify({
          token: inviteToken,
          room_id: roomId,
          created_by_email: email,
          default_role: 'member',
          max_uses: seatLimit,
          expires_at: exp,
        }),
      });
    }

    return {
      status: 200,
      body: {
        ok: true,
        roomId,
        inviteToken,
        roomTitle,
        hostNickname,
        seatLimit,
        entitlement: gate.entitlement,
      },
    };
  }

  if (action === 'work_accept_invite') {
    const verified = await verifyInviteTokenForWorkRoom(supabaseUrl, serviceKey, body.inviteToken);
    if (!verified) {
      return { status: 200, body: { ok: false, reason: 'INVALID_OR_EXPIRED_INVITE' } };
    }
    const roomId = verified.room.room_id;
    const ownerGate = await assertWorkOwnerUnlocked(
      supabaseUrl,
      serviceKey,
      verified.room.master_email
    );
    if (!ownerGate.ok) {
      return ownerGate.response;
    }

    const isMaster = String(verified.room.master_email || '').toLowerCase() === email;
    const memRes = await fetch(
      `${supabaseUrl}/rest/v1/ghosti_lounge_members?room_id=eq.${encodeURIComponent(roomId)}&select=member_email,role,room_persona_nickname,joined_at&order=joined_at.asc,member_email.asc`,
      { headers: srvHeaders(serviceKey) }
    );
    const memRows = memRes.ok ? await memRes.json().catch(() => []) : [];
    const members = Array.isArray(memRows) ? [...memRows] : [];
    const existingMember = members.find(
      (r) => String(r.member_email || '').toLowerCase() === email
    );

    const seatLimit = ownerGate.entitlement.workSeatLimit || 5;
    if (!isMaster && !existingMember) {
      if (members.length >= seatLimit) {
        return {
          status: 403,
          body: {
            ok: false,
            reason: 'WORK_SEAT_LIMIT_EXCEEDED',
            seatLimit,
            currentMemberCount: members.length,
            message: `이 업무 공유방의 이용권 정원(${seatLimit}인)이 모두 찼습니다. 방장님이 상위 이용권으로 변경하면 추가 합류할 수 있습니다.`,
          },
        };
      }
      const targetDbRole = mapWorkRoleToDb(verified.invite.default_role === 'viewer' ? 'viewer' : 'editor');
      const insRes = await fetch(
        `${supabaseUrl}/rest/v1/ghosti_lounge_members?on_conflict=room_id,member_email`,
        {
          method: 'POST',
          headers: srvHeaders(serviceKey, {
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=representation',
          }),
          body: JSON.stringify({
            room_id: roomId,
            member_email: email,
            // 업무방 신규 초대 팀원은 기본 편집·업로드 허용(DB 'admin' = UI 'editor', CHECK 제약 100% 준수)
            role: targetDbRole,
            room_persona_nickname: actorNick,
          }),
        }
      );
      if (!insRes.ok) {
        return { status: 502, body: { ok: false, reason: 'WORK_MEMBER_JOIN_FAILED' } };
      }
      const insRows = await insRes.json().catch(() => []);
      const insertedRow = Array.isArray(insRows) && insRows[0] ? insRows[0] : null;
      members.push({
        member_email: email,
        role: insertedRow?.role || targetDbRole,
        room_persona_nickname: insertedRow?.room_persona_nickname || actorNick,
        joined_at: insertedRow?.joined_at || new Date().toISOString(),
      });
      // 초대 토큰 사용 횟수(used_count) 원자적 증가
      const nextUsed = Number(verified.invite.used_count || 0) + 1;
      await fetch(
        `${supabaseUrl}/rest/v1/ghosti_room_invites?token=eq.${encodeURIComponent(verified.invite.token)}`,
        {
          method: 'PATCH',
          headers: srvHeaders(serviceKey, {
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          }),
          body: JSON.stringify({ used_count: nextUsed }),
        }
      );
    } else if (
      existingMember &&
      isGenericPlaceholderWorkNick(existingMember.room_persona_nickname) &&
      actorNick &&
      !isGenericPlaceholderWorkNick(actorNick)
    ) {
      existingMember.room_persona_nickname = actorNick;
      await fetch(
        `${supabaseUrl}/rest/v1/ghosti_lounge_members?room_id=eq.${encodeURIComponent(roomId)}&member_email=eq.${encodeURIComponent(email)}`,
        {
          method: 'PATCH',
          headers: srvHeaders(serviceKey, {
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          }),
          body: JSON.stringify({ room_persona_nickname: actorNick }),
        }
      ).catch(() => null);
    }

    const { state, tombstones } = await readWorkRoomP2pState(supabaseUrl, serviceKey, roomId);
    const membersList = sortAndMapWorkMembers(
      members,
      verified.room.master_email,
      verified.hostNickname
    );
    const myRole = isMaster
      ? 'host'
      : existingMember
      ? normalizeWorkRoleFromDb(existingMember.role, false)
      : verified.invite.default_role === 'viewer'
      ? 'viewer'
      : 'editor';

    return {
      status: 200,
      body: {
        ok: true,
        roomId,
        roomTitle: verified.room.room_title || '💼 우리팀 업무 공유방 (S:)',
        hostNickname: verified.hostNickname,
        role: myRole,
        seatLimit,
        members: membersList,
        deletedTombstones: tombstones,
        hostTunnel: {
          tunnelUrl: state.hostTunnelUrl,
          accessKey: state.hostAccessKey,
          updatedAt: state.hostUpdatedAt,
          masterServerName: state.masterServerName,
          backupServers: state.backupServers,
        },
      },
    };
  }

  if (action === 'work_list_my_rooms') {
    const memRes = await fetch(
      `${supabaseUrl}/rest/v1/ghosti_lounge_members?member_email=eq.${encodeURIComponent(email)}&select=room_id,role,room_persona_nickname,joined_at&order=joined_at.desc&limit=30`,
      { headers: srvHeaders(serviceKey) }
    );
    const memRows = memRes.ok ? await memRes.json().catch(() => []) : [];
    const safeMems = Array.isArray(memRows) ? memRows : [];
    const roomIds = Array.from(
      new Set(safeMems.map((m) => String(m.room_id || '').trim()).filter(Boolean))
    );
    if (roomIds.length === 0) {
      return { status: 200, body: { ok: true, rooms: [] } };
    }
    const inClause = roomIds.map((id) => `"${id.replace(/"/g, '')}"`).join(',');
    const [roomRes, allRoomMemRes] = await Promise.all([
      fetch(
        `${supabaseUrl}/rest/v1/ghosti_lounge_rooms?lounge_type=eq.work&room_id=in.(${encodeURIComponent(inClause)})&select=room_id,room_title,master_email,pricing_plan,created_at`,
        { headers: srvHeaders(serviceKey) }
      ),
      fetch(
        `${supabaseUrl}/rest/v1/ghosti_lounge_members?room_id=in.(${encodeURIComponent(inClause)})&select=room_id,member_email,role,room_persona_nickname,joined_at&order=joined_at.asc,member_email.asc`,
        { headers: srvHeaders(serviceKey) }
      ),
    ]);
    const [roomRows, allRoomMemRows] = await Promise.all([
      roomRes.ok ? roomRes.json().catch(() => []) : Promise.resolve([]),
      allRoomMemRes.ok ? allRoomMemRes.json().catch(() => []) : Promise.resolve([]),
    ]);
    const roomById = new Map();
    if (Array.isArray(roomRows)) {
      for (const r of roomRows) {
        if (r?.room_id) roomById.set(String(r.room_id), r);
      }
    }
    const membersByRoomId = new Map();
    if (Array.isArray(allRoomMemRows)) {
      for (const rm of allRoomMemRows) {
        const rid = String(rm?.room_id || '').trim();
        if (!rid) continue;
        const arr = membersByRoomId.get(rid) || [];
        arr.push(rm);
        membersByRoomId.set(rid, arr);
      }
    }

    const validWorkRoomIds = Array.from(roomById.keys());
    const uniqueMasterEmails = Array.from(
      new Set(
        validWorkRoomIds
          .map((rid) => String(roomById.get(rid)?.master_email || '').trim().toLowerCase())
          .filter(Boolean)
      )
    );
    const [gateEntries, p2pEntries] = await Promise.all([
      Promise.all(
        uniqueMasterEmails.map(async (mEmail) => [
          mEmail,
          await assertWorkOwnerUnlocked(supabaseUrl, serviceKey, mEmail),
        ])
      ),
      Promise.all(
        validWorkRoomIds.map(async (rid) => [
          rid,
          await readWorkRoomP2pState(supabaseUrl, serviceKey, rid),
        ])
      ),
    ]);
    const gateByMaster = new Map(gateEntries);
    const p2pByRoomId = new Map(p2pEntries);

    const outRooms = [];
    const seenOutRooms = new Set();
    for (const m of safeMems) {
      const rId = String(m.room_id || '').trim();
      if (!rId || seenOutRooms.has(rId)) continue;
      const room = roomById.get(rId);
      if (!room) continue;
      seenOutRooms.add(rId);
      const masterEmail = String(room.master_email || '').trim().toLowerCase();
      const isHost = masterEmail === email;
      const normalized = normalizeWorkRoleFromDb(m.role, isHost);
      const role = normalized === 'master' ? 'host' : normalized;
      const ownerGate =
        gateByMaster.get(masterEmail) ||
        (await assertWorkOwnerUnlocked(supabaseUrl, serviceKey, masterEmail));
      const resolvedLockReason = ownerGate.ok
        ? null
        : ownerGate.response?.body?.reason || 'WORK_SUBSCRIPTION_REQUIRED';
      // 활성 이용권(체험·유료)이 없는 본인 방장 방(WORK_SUBSCRIPTION_REQUIRED · WORK_TRIAL_EXPIRED)은 소속 공유방 목록에서 제외해
      // 내보내진 팀원이나 공유방이 없는 유저의 모바일 앱·웹에서 '업무 공유방 연결 일시 중지'로 오표시되는 현상을 원천 차단
      if (isHost && !ownerGate.ok) {
        continue;
      }
      const sortedMembers = sortAndMapWorkMembers(membersByRoomId.get(rId) || [], masterEmail);
      const hostMember = sortedMembers.find((sm) => sm.role === 'master');
      const p2p = p2pByRoomId.get(rId);
      outRooms.push({
        roomId: rId,
        roomTitle: String(room.room_title || '우리팀 업무 공유방 (S:)'),
        hostEmail: masterEmail,
        hostNickname: hostMember?.nickname || masterEmail.split('@')[0] || '방장',
        isHost,
        role,
        ownerUnlocked: Boolean(ownerGate.ok),
        seatLimit: ownerGate.entitlement?.workSeatLimit || 5,
        lockReason: resolvedLockReason,
        members: sortedMembers,
        deletedTombstones: ownerGate.ok ? p2p?.tombstones || {} : {},
        hostTunnel:
          ownerGate.ok && p2p?.state
            ? {
                tunnelUrl: p2p.state.hostTunnelUrl,
                accessKey: p2p.state.hostAccessKey,
                updatedAt: p2p.state.hostUpdatedAt,
                masterServerName: p2p.state.masterServerName,
                backupServers: p2p.state.backupServers,
              }
            : undefined,
      });
    }
    return { status: 200, body: { ok: true, rooms: outRooms } };
  }

  if (action === 'work_register_tunnel') {
    const roomId = String(body.roomId || '').trim();
    const ctx = await getWorkRoomMemberContext(supabaseUrl, serviceKey, roomId, email);
    if (!ctx) {
      return { status: 403, body: { ok: false, reason: 'NOT_A_WORK_ROOM_MEMBER' } };
    }
    const ownerGate = await assertWorkOwnerUnlocked(supabaseUrl, serviceKey, ctx.room.master_email);
    if (!ownerGate.ok) {
      return ownerGate.response;
    }
    if (!ctx.isMaster) {
      return { status: 403, body: { ok: false, reason: 'WORK_TUNNEL_REGISTER_MASTER_ONLY' } };
    }
    const rawUrl = String(body.tunnelUrl || '').trim().replace(/\/+$/, '');
    if (rawUrl && !/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i.test(rawUrl)) {
      return { status: 400, body: { ok: false, reason: 'INVALID_TUNNEL_URL' } };
    }
    const accessKey = String(body.accessKey || '').trim().slice(0, 96);
    const { state } = await readWorkRoomP2pState(supabaseUrl, serviceKey, roomId);
    state.hostTunnelUrl = rawUrl;
    state.hostAccessKey = accessKey;
    state.hostUpdatedAt = new Date().toISOString();
    if (body.masterServerName) {
      state.masterServerName = String(body.masterServerName).trim().slice(0, 48);
    }
    if (Array.isArray(body.backupServers)) {
      state.backupServers = body.backupServers.slice(0, 2);
    }
    const okWrite = await writeWorkRoomP2pState(supabaseUrl, serviceKey, roomId, state);
    if (!okWrite) {
      return { status: 502, body: { ok: false, reason: 'WORK_TUNNEL_STATE_SAVE_FAILED' } };
    }
    return {
      status: 200,
      body: {
        ok: true,
        roomId,
        hostTunnel: {
          tunnelUrl: state.hostTunnelUrl,
          accessKey: state.hostAccessKey,
          updatedAt: state.hostUpdatedAt,
          masterServerName: state.masterServerName,
          backupServers: state.backupServers,
        },
      },
    };
  }

  if (action === 'work_get_room_state') {
    const roomId = String(body.roomId || '').trim();
    const ctx = await getWorkRoomMemberContext(supabaseUrl, serviceKey, roomId, email);
    if (!ctx) {
      // 인증된 사용자(email 확인됨)가 ghosti_lounge_members에 없다면 아직 초대 수락 전이거나 방장에게 내보내진 상태이므로
      // 절대 handlePublicWorkPreviewAction(ok: true)으로 우회하지 않고 명확히 NOT_A_WORK_ROOM_MEMBER를 반환합니다.
      return { status: 403, body: { ok: false, reason: 'NOT_A_WORK_ROOM_MEMBER' } };
    }
    const ownerGate = await assertWorkOwnerUnlocked(supabaseUrl, serviceKey, ctx.room.master_email);
    if (!ownerGate.ok) {
      return ownerGate.response;
    }
    const { state, tombstones } = await readWorkRoomP2pState(supabaseUrl, serviceKey, roomId);
    const myMemberRow = Array.isArray(ctx.members)
      ? ctx.members.find((r) => String(r.member_email || '').toLowerCase() === email)
      : null;
    if (
      myMemberRow &&
      isGenericPlaceholderWorkNick(myMemberRow.room_persona_nickname) &&
      actorNick &&
      !isGenericPlaceholderWorkNick(actorNick)
    ) {
      myMemberRow.room_persona_nickname = actorNick;
      fetch(
        `${supabaseUrl}/rest/v1/ghosti_lounge_members?room_id=eq.${encodeURIComponent(roomId)}&member_email=eq.${encodeURIComponent(email)}`,
        {
          method: 'PATCH',
          headers: srvHeaders(serviceKey, {
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          }),
          body: JSON.stringify({ room_persona_nickname: actorNick }),
        }
      ).catch(() => null);
    }
    const membersList = sortAndMapWorkMembers(ctx.members, ctx.room.master_email);
    return {
      status: 200,
      body: {
        ok: true,
        roomId,
        role: ctx.isMaster ? 'host' : ctx.role,
        seatLimit: ownerGate.entitlement.workSeatLimit || 5,
        members: membersList,
        hostTunnel: {
          tunnelUrl: state.hostTunnelUrl,
          accessKey: state.hostAccessKey,
          updatedAt: state.hostUpdatedAt,
          masterServerName: state.masterServerName,
          backupServers: state.backupServers,
        },
        files: [], // Zero-Cloud: 서버에는 파일·본문을 0 Byte 보관하며 대장 PC 터널에서 직접 조회
        deletedTombstones: tombstones,
        entitlement: ownerGate.entitlement,
      },
    };
  }

  if (action === 'work_sync_team_snippets') {
    const roomId = String(body.roomId || '').trim();
    if (!roomId) {
      return { status: 400, body: { ok: false, reason: 'MISSING_ROOM_ID' } };
    }
    const safeRoomId = roomId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeRoomId) {
      return { status: 400, body: { ok: false, reason: 'INVALID_ROOM_ID' } };
    }
    const ctx = await getWorkRoomMemberContext(supabaseUrl, serviceKey, roomId, email);
    if (!ctx) {
      return { status: 403, body: { ok: false, reason: 'NOT_A_WORK_ROOM_MEMBER' } };
    }
    const ownerGate = await assertWorkOwnerUnlocked(supabaseUrl, serviceKey, ctx.room.master_email);
    if (!ownerGate.ok) {
      return ownerGate.response;
    }

    const storagePath = `${safeRoomId}/team_snippets_v1.json`;
    const mode = body.mode === 'push' ? 'push' : 'pull';
    const current = await readStorageJson(supabaseUrl, serviceKey, WORK_BUCKET, storagePath, {
      roomId,
      snippets: {},
      cipherB64: '',
      ivB64: '',
      version: 0,
      updatedAt: null,
      updatedByEmail: '',
      updatedByNickname: '',
      updatedByDeviceId: '',
      updatedByDeviceName: '',
    });

    if (mode === 'push') {
      if (!ctx.isMaster && ctx.role === 'viewer') {
        return { status: 403, body: { ok: false, reason: 'WORK_VIEWER_READ_ONLY' } };
      }

      const cipherB64 = String(body.cipherB64 || '').trim();
      const ivB64 = String(body.ivB64 || '').trim();
      const hasE2ee = Boolean(cipherB64 && ivB64);

      const allowedKeys = ['F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
      const cleanSnippets = {};
      let hasPlainSnippets = false;
      if (body.snippets && typeof body.snippets === 'object' && !Array.isArray(body.snippets)) {
        hasPlainSnippets = true;
        for (const k of allowedKeys) {
          if (Object.prototype.hasOwnProperty.call(body.snippets, k)) {
            const val = String(body.snippets[k] ?? '').slice(0, 2000);
            if (val.trim()) {
              cleanSnippets[k] = val;
            }
          }
        }
      }

      if (hasE2ee && cipherB64.length > 64000) {
        return { status: 400, body: { ok: false, reason: 'TEAM_SNIPPETS_PAYLOAD_TOO_LARGE' } };
      }
      if (!hasE2ee && !hasPlainSnippets) {
        return { status: 400, body: { ok: false, reason: 'INVALID_TEAM_SNIPPETS_PAYLOAD' } };
      }

      const nextDoc = {
        roomId,
        snippets: hasPlainSnippets ? cleanSnippets : {},
        cipherB64: hasE2ee ? cipherB64 : '',
        ivB64: hasE2ee ? ivB64 : '',
        version: Number(current?.version || 0) + 1,
        updatedAt: new Date().toISOString(),
        updatedByEmail: email,
        updatedByNickname: actorNick || email.split('@')[0],
        updatedByDeviceId: String(body.deviceId || '').slice(0, 80),
        updatedByDeviceName: String(body.deviceName || actorNick || '팀 PC').slice(0, 48),
      };

      const saved = await writeStorageJson(
        supabaseUrl,
        serviceKey,
        WORK_BUCKET,
        storagePath,
        nextDoc
      );
      if (!saved) {
        return { status: 502, body: { ok: false, reason: 'TEAM_SNIPPETS_WRITE_FAILED' } };
      }

      return {
        status: 200,
        body: {
          ok: true,
          role: ctx.isMaster ? 'host' : ctx.role,
          realtimeChannel: `ghosti:room:${roomId}`,
          ...nextDoc,
        },
      };
    }

    return {
      status: 200,
      body: {
        ok: true,
        role: ctx.isMaster ? 'host' : ctx.role,
        realtimeChannel: `ghosti:room:${roomId}`,
        ...current,
      },
    };
  }

  if (action === 'work_upsert_files') {
    // [Zero-Cloud 원칙 강제]: 구버전 클라이언트가 work_upsert_files를 호출하더라도
    // 서버에는 파일 원본(inlineSyncBase64)이나 본문(fullTextPreview)을 절대 저장하지 않으며,
    // 권한 검증 후 현재 Tombstone과 대장 PC 터널 정보만 반환합니다.
    const roomId = String(body.roomId || '').trim();
    const ctx = await getWorkRoomMemberContext(supabaseUrl, serviceKey, roomId, email);
    if (!ctx) {
      return { status: 403, body: { ok: false, reason: 'NOT_A_WORK_ROOM_MEMBER' } };
    }
    const ownerGate = await assertWorkOwnerUnlocked(supabaseUrl, serviceKey, ctx.room.master_email);
    if (!ownerGate.ok) {
      return ownerGate.response;
    }
    if (ctx.role === 'viewer') {
      return { status: 403, body: { ok: false, reason: 'WORK_VIEWER_READ_ONLY' } };
    }
    const { state, tombstones } = await readWorkRoomP2pState(supabaseUrl, serviceKey, roomId);
    return {
      status: 200,
      body: {
        ok: true,
        zeroCloudDirectP2p: true,
        files: [],
        deletedTombstones: tombstones,
        hostTunnel: {
          tunnelUrl: state.hostTunnelUrl,
          accessKey: state.hostAccessKey,
          updatedAt: state.hostUpdatedAt,
        },
      },
    };
  }

  if (action === 'work_delete_file') {
    const roomId = String(body.roomId || '').trim();
    const relPath = String(body.relPath || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
    if (!roomId || !relPath || relPath.includes('..')) {
      return { status: 400, body: { ok: false, reason: 'MISSING_OR_INVALID_RELPATH' } };
    }
    const ctx = await getWorkRoomMemberContext(supabaseUrl, serviceKey, roomId, email);
    if (!ctx) {
      return { status: 403, body: { ok: false, reason: 'NOT_A_WORK_ROOM_MEMBER' } };
    }
    const ownerGate = await assertWorkOwnerUnlocked(supabaseUrl, serviceKey, ctx.room.master_email);
    if (!ownerGate.ok) {
      return ownerGate.response;
    }
    if (ctx.role === 'viewer') {
      return {
        status: 403,
        body: {
          ok: false,
          reason: 'WORK_VIEWER_READ_ONLY',
          message: '읽기 전용 팀원은 파일을 삭제할 수 없습니다.',
        },
      };
    }
    const { state, tombstones } = await readWorkRoomP2pState(supabaseUrl, serviceKey, roomId);
    const delNowIso = new Date().toISOString();
    const canonKey = relPath.toLowerCase();
    tombstones[canonKey] = {
      relPath,
      deletedAt: delNowIso,
      deletedBy: actorNick,
      uploaderEmail: email,
    };
    state.deletedTombstones = tombstones;
    const okSaved = await writeWorkRoomP2pState(supabaseUrl, serviceKey, roomId, state);
    if (!okSaved) {
      return { status: 502, body: { ok: false, reason: 'WORK_DELETE_STORAGE_WRITE_FAILED' } };
    }
    return {
      status: 200,
      body: { ok: true, relPath, files: [], deletedTombstones: tombstones },
    };
  }

  if (action === 'work_set_member_role') {
    const roomId = String(body.roomId || '').trim();
    const targetEmail = String(body.memberEmail || '').trim().toLowerCase();
    const nextRole = String(body.role || '').trim().toLowerCase() === 'viewer' ? 'viewer' : 'editor';
    if (!roomId || !targetEmail) {
      return { status: 400, body: { ok: false, reason: 'MISSING_ROOM_OR_MEMBER_EMAIL' } };
    }
    const ctx = await getWorkRoomMemberContext(supabaseUrl, serviceKey, roomId, email);
    if (!ctx || !ctx.isMaster) {
      return { status: 403, body: { ok: false, reason: 'ONLY_MASTER_CAN_CHANGE_ROLE' } };
    }
    if (targetEmail === String(ctx.room.master_email || '').toLowerCase()) {
      return { status: 400, body: { ok: false, reason: 'CANNOT_DEMOTE_MASTER' } };
    }
    const matchedRow = (ctx.members || []).find(
      (m) => String(m?.member_email || '').trim().toLowerCase() === targetEmail
    );
    if (!matchedRow) {
      return { status: 404, body: { ok: false, reason: 'WORK_MEMBER_NOT_FOUND' } };
    }
    const storedEmail = String(matchedRow.member_email).trim();
    const dbRole = mapWorkRoleToDb(nextRole);
    const patchRes = await fetch(
      `${supabaseUrl}/rest/v1/ghosti_lounge_members?room_id=eq.${encodeURIComponent(roomId)}&member_email=eq.${encodeURIComponent(storedEmail)}`,
      {
        method: 'PATCH',
        headers: srvHeaders(serviceKey, {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        }),
        body: JSON.stringify({ role: dbRole }),
      }
    );
    if (!patchRes.ok) {
      return { status: 502, body: { ok: false, reason: 'WORK_ROLE_UPDATE_FAILED' } };
    }
    const patchedRows = await patchRes.json().catch(() => []);
    if (!Array.isArray(patchedRows) || patchedRows.length === 0) {
      return { status: 404, body: { ok: false, reason: 'WORK_ROLE_NO_ROW_MATCHED' } };
    }
    const nextRawMembers = (ctx.members || []).map((m) =>
      String(m?.member_email || '').trim().toLowerCase() === targetEmail
        ? { ...m, role: dbRole }
        : m
    );
    const sortedMembers = sortAndMapWorkMembers(nextRawMembers, ctx.room.master_email);
    return {
      status: 200,
      body: {
        ok: true,
        roomId,
        memberEmail: targetEmail,
        role: nextRole,
        members: sortedMembers,
      },
    };
  }

  if (action === 'work_remove_member') {
    const roomId = String(body.roomId || '').trim();
    const targetEmail = String(body.memberEmail || email).trim().toLowerCase();
    const ctx = await getWorkRoomMemberContext(supabaseUrl, serviceKey, roomId, email);
    if (!ctx) {
      return { status: 403, body: { ok: false, reason: 'NOT_A_WORK_ROOM_MEMBER' } };
    }
    const isKickingOther = targetEmail !== email;
    if (isKickingOther && !ctx.isMaster) {
      return { status: 403, body: { ok: false, reason: 'ONLY_MASTER_CAN_KICK_MEMBER' } };
    }
    if (targetEmail === String(ctx.room.master_email || '').toLowerCase()) {
      return { status: 400, body: { ok: false, reason: 'MASTER_CANNOT_LEAVE_OWN_ROOM' } };
    }
    const delRes = await fetch(
      `${supabaseUrl}/rest/v1/ghosti_lounge_members?room_id=eq.${encodeURIComponent(roomId)}&member_email=ilike.${encodeURIComponent(targetEmail)}`,
      {
        method: 'DELETE',
        headers: srvHeaders(serviceKey),
      }
    );
    if (!delRes.ok) {
      return { status: 502, body: { ok: false, reason: 'WORK_MEMBER_REMOVE_FAILED' } };
    }

    // 방장이 팀원을 내보낸 경우 기존 초대 링크를 즉시 폐기·회전하여 내보내진 팀원이 옛 링크(F5 등)로 재합류하지 못하게 원천 차단
    let rotatedInviteToken = '';
    if (isKickingOther && ctx.isMaster) {
      try {
        const ownerGate = await assertWorkOwnerUnlocked(supabaseUrl, serviceKey, ctx.room.master_email);
        const seatLimit = ownerGate.entitlement?.workSeatLimit || 5;
        await fetch(
          `${supabaseUrl}/rest/v1/ghosti_room_invites?room_id=eq.${encodeURIComponent(roomId)}&revoked_at=is.null`,
          {
            method: 'PATCH',
            headers: srvHeaders(serviceKey, {
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            }),
            body: JSON.stringify({ revoked_at: new Date().toISOString() }),
          }
        );
        rotatedInviteToken = sha256Hex(`${crypto.randomUUID()}:${roomId}:${Date.now()}`).slice(0, 36);
        const exp = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
        await fetch(`${supabaseUrl}/rest/v1/ghosti_room_invites`, {
          method: 'POST',
          headers: srvHeaders(serviceKey, {
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          }),
          body: JSON.stringify({
            token: rotatedInviteToken,
            room_id: roomId,
            created_by_email: email,
            default_role: 'member',
            max_uses: seatLimit,
            expires_at: exp,
          }),
        });
      } catch {
        /* ignore invite rotation failure */
      }
    }

    const remainingRaw = (ctx.members || []).filter(
      (m) => String(m?.member_email || '').trim().toLowerCase() !== targetEmail
    );
    const sortedMembers = sortAndMapWorkMembers(remainingRaw, ctx.room.master_email);
    return {
      status: 200,
      body: {
        ok: true,
        roomId,
        removedEmail: targetEmail,
        members: sortedMembers,
        ...(rotatedInviteToken ? { inviteToken: rotatedInviteToken } : {}),
      },
    };
  }

  if (action === 'work_revoke_invite') {
    const roomId = String(body.roomId || '').trim();
    const ctx = await getWorkRoomMemberContext(supabaseUrl, serviceKey, roomId, email);
    if (!ctx || !ctx.isMaster) {
      return { status: 403, body: { ok: false, reason: 'ONLY_MASTER_CAN_REVOKE_INVITE' } };
    }
    const ownerGate = await assertWorkOwnerUnlocked(supabaseUrl, serviceKey, ctx.room.master_email);
    const seatLimit = ownerGate.entitlement?.workSeatLimit || 5;
    await fetch(
      `${supabaseUrl}/rest/v1/ghosti_room_invites?room_id=eq.${encodeURIComponent(roomId)}&revoked_at=is.null`,
      {
        method: 'PATCH',
        headers: srvHeaders(serviceKey, {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        }),
        body: JSON.stringify({ revoked_at: new Date().toISOString() }),
      }
    );
    const newInviteToken = sha256Hex(`${crypto.randomUUID()}:${roomId}:${Date.now()}`).slice(0, 36);
    const exp = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
    await fetch(`${supabaseUrl}/rest/v1/ghosti_room_invites`, {
      method: 'POST',
      headers: srvHeaders(serviceKey, {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      }),
      body: JSON.stringify({
        token: newInviteToken,
        room_id: roomId,
        created_by_email: email,
        default_role: 'member',
        max_uses: seatLimit,
        expires_at: exp,
      }),
    });
    return { status: 200, body: { ok: true, roomId, inviteToken: newInviteToken } };
  }

  // ===================================================================
  // B. 5. 📱 내 기기 통합 (PC + 폰 + PC+) 액션군
  // ===================================================================
  const emailHash = sha256Hex(email).slice(0, 32);

  // 동일 PC(같은 브라우저)에서 A계정 ➔ B계정 전환 시 구버전 클라이언트가 같은 device_id를 보내더라도
  // 타 계정의 ghosti_devices 행(owner_email)을 덮어쓰지 못하도록 계정별 결정적 UUID로 안전 격리
  const resolveOwnedDeviceId = async (rawCandidate) => {
    const clean = String(rawCandidate || '').trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
    if (!isUuid) return crypto.randomUUID();
    try {
      const ownerCheckRes = await fetch(
        `${supabaseUrl}/rest/v1/ghosti_devices?device_id=eq.${encodeURIComponent(clean)}&select=owner_email&limit=1`,
        { headers: srvHeaders(serviceKey) }
      );
      const ownerRows = ownerCheckRes.ok ? await ownerCheckRes.json().catch(() => []) : [];
      const existingOwner = String(ownerRows?.[0]?.owner_email || '').trim().toLowerCase();
      if (existingOwner && existingOwner !== email) {
        const h = sha256Hex(`ghosti-dev-scope-v1::${email}::${clean}`);
        return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
      }
    } catch {
      /* fallback to clean uuid */
    }
    return clean;
  };

  if (action === 'device_heartbeat_and_list') {
    const deviceId = await resolveOwnedDeviceId(body.deviceId);
    const deviceKind = body.deviceKind === 'mobile' ? 'mobile' : 'pc_master';
    const platform = ['windows', 'macos', 'android', 'ios', 'web'].includes(String(body.platform))
      ? String(body.platform)
      : deviceKind === 'mobile'
      ? 'android'
      : 'windows';
    const displayName = String(
      body.displayName || (deviceKind === 'mobile' ? '내 스마트폰' : '메인 PC')
    ).slice(0, 48);
    const explicitReconnect = Boolean(
      body.explicitReconnect || body.explicitTrialOptIn || body.forceRefreshPairingCode
    );
    const isMobileWebSkip =
      Boolean(body.mobileWebSkipRegister) ||
      (deviceKind === 'mobile' && /·웹\s*\(/.test(displayName));

    let revokedSelf = false;
    if (!explicitReconnect && !isMobileWebSkip) {
      const selfCheckRes = await fetch(
        `${supabaseUrl}/rest/v1/ghosti_devices?device_id=eq.${encodeURIComponent(deviceId)}&owner_email=eq.${encodeURIComponent(email)}&select=device_id,revoked_at&limit=1`,
        { headers: srvHeaders(serviceKey) }
      );
      const selfRows = selfCheckRes.ok ? await selfCheckRes.json().catch(() => []) : [];
      if (Array.isArray(selfRows) && selfRows[0]?.revoked_at) {
        revokedSelf = true;
      }
    }

    if (!revokedSelf && !isMobileWebSkip) {
      await fetch(`${supabaseUrl}/rest/v1/ghosti_devices?on_conflict=device_id`, {
        method: 'POST',
        headers: srvHeaders(serviceKey, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify({
          device_id: deviceId,
          owner_email: email,
          device_kind: deviceKind,
          display_name: displayName,
          platform,
          app_version: String(body.appVersion || '1.0.61').slice(0, 24),
          last_seen_at: new Date().toISOString(),
          revoked_at: null,
        }),
      });
    }

    const [listRes, codeRes, entRaw] = await Promise.all([
      fetch(
        `${supabaseUrl}/rest/v1/ghosti_devices?owner_email=eq.${encodeURIComponent(email)}&revoked_at=is.null&order=created_at.asc`,
        { headers: srvHeaders(serviceKey) }
      ),
      deviceKind === 'pc_master'
        ? fetch(
            `${supabaseUrl}/rest/v1/ghosti_pairing_codes?owner_email=eq.${encodeURIComponent(email)}&consumed_at=is.null&order=expires_at.desc&limit=1`,
            { headers: srvHeaders(serviceKey) }
          )
        : Promise.resolve(null),
      readStorageJson(
        supabaseUrl,
        serviceKey,
        DEVICE_BUCKET,
        `${emailHash}/entitlement_v1.json`,
        { planId: 'free_trial', trialOptInStartedAt: null, activatedAt: null }
      ),
    ]);

    const devices = listRes && listRes.ok ? await listRes.json().catch(() => []) : [];
    const rawDevices = Array.isArray(devices) ? devices : [];
    // 1) 동일 플랫폼(device_kind + platform) 내 10분 이상 비활성 중복 세션 자동 교체(시크릿/캐시삭제 재로그인 유령 기기 방지)
    // 2) 타 플랫폼 포함 7일 이상 미접속 구 세션 자동 정리
    const samePlatformIdleCutoffMs = Date.now() - 10 * 60 * 1000;
    const staleCutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const staleIds = [];
    const safeDevices = [];
    for (const dev of rawDevices) {
      const lastSeenMs = Date.parse(dev?.last_seen_at || dev?.created_at || '');
      const isOther = Boolean(dev?.device_id && dev.device_id !== deviceId);
      const isSameKindPlatform =
        dev?.device_kind === deviceKind && dev?.platform === platform;
      const isSamePlatformGhost =
        isOther && isSameKindPlatform && lastSeenMs > 0 && lastSeenMs < samePlatformIdleCutoffMs;
      const isLongStale = isOther && lastSeenMs > 0 && lastSeenMs < staleCutoffMs;
      const isLegacyMobileWebGhost =
        dev?.device_kind === 'mobile' && /·웹\s*\(/.test(String(dev?.display_name || ''));
      if (isSamePlatformGhost || isLongStale || isLegacyMobileWebGhost) {
        staleIds.push(dev.device_id);
      } else {
        safeDevices.push(dev);
      }
    }
    if (staleIds.length > 0) {
      const nowIso = new Date().toISOString();
      await Promise.all(
        staleIds.map((sid) =>
          fetch(
            `${supabaseUrl}/rest/v1/ghosti_devices?device_id=eq.${encodeURIComponent(sid)}&owner_email=eq.${encodeURIComponent(email)}`,
            {
              method: 'PATCH',
              headers: srvHeaders(serviceKey, { 'Content-Type': 'application/json' }),
              body: JSON.stringify({ revoked_at: nowIso }),
            }
          ).catch(() => null)
        )
      );
    }

    // 6자리 페어링 코드 발급/유지 (PC 마스터이면서 활성 상태일 때 · 유효시간 30분, 5분 미만 남거나 강제 새로고침 시 즉시 재발급)
    let pairingCode = null;
    if (deviceKind === 'pc_master' && !revokedSelf) {
      const codeRows = codeRes && codeRes.ok ? await codeRes.json().catch(() => []) : [];
      const forceRefreshCode = Boolean(body.forceRefreshPairingCode);
      if (
        !forceRefreshCode &&
        Array.isArray(codeRows) &&
        codeRows[0]?.code &&
        Date.parse(codeRows[0].expires_at || '') > Date.now() + 5 * 60_000
      ) {
        pairingCode = String(codeRows[0].code);
      } else {
        const newCode = String(Math.floor(100000 + Math.random() * 900000));
        const expIso = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        const ins = await fetch(`${supabaseUrl}/rest/v1/ghosti_pairing_codes?on_conflict=code`, {
          method: 'POST',
          headers: srvHeaders(serviceKey, {
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
          }),
          body: JSON.stringify({
            code: newCode,
            owner_email: email,
            pc_device_id: deviceId,
            expires_at: expIso,
          }),
        });
        if (ins.ok) pairingCode = newCode;
      }
    }

    // 명시적 동의(explicitTrialOptIn) 시 30일 무료체험(D-30) 즉시 개시
    if (body.explicitTrialOptIn && !entRaw.trialOptInStartedAt) {
      entRaw.trialOptInStartedAt = new Date().toISOString();
      await writeStorageJson(
        supabaseUrl,
        serviceKey,
        DEVICE_BUCKET,
        `${emailHash}/entitlement_v1.json`,
        entRaw
      );
    }

    const entitlement = computeEntitlementView(entRaw, safeDevices.length);
    return {
      status: 200,
      body: {
        ok: true,
        deviceId,
        revokedSelf,
        devices: safeDevices,
        pairingCode,
        entitlement,
        canonicalUserId: userId,
      },
    };
  }

  if (action === 'device_consume_pairing_code') {
    const cleanCode = String(body.code || '').replace(/\D/g, '').slice(0, 6);
    if (cleanCode.length !== 6) {
      return { status: 200, body: { ok: false, reason: 'INVALID_CODE_FORMAT' } };
    }
    const cRes = await fetch(
      `${supabaseUrl}/rest/v1/ghosti_pairing_codes?code=eq.${cleanCode}&order=expires_at.desc&limit=1`,
      { headers: srvHeaders(serviceKey) }
    );
    const cRows = cRes.ok ? await cRes.json().catch(() => []) : [];
    const found = Array.isArray(cRows) ? cRows[0] : null;
    if (!found) {
      return { status: 200, body: { ok: false, reason: 'CODE_NOT_FOUND' } };
    }
    const foundOwner = String(found.owner_email || '').trim().toLowerCase();
    if (foundOwner && foundOwner !== email) {
      const [localPart, domainPart] = foundOwner.split('@');
      const maskedLocal =
        localPart && localPart.length > 2
          ? `${localPart.slice(0, 2)}${'*'.repeat(Math.min(4, localPart.length - 2))}`
          : `${(localPart || '').slice(0, 1)}***`;
      return {
        status: 200,
        body: {
          ok: false,
          reason: 'ACCOUNT_MISMATCH',
          expectedEmailHint: domainPart ? `${maskedLocal}@${domainPart}` : maskedLocal,
        },
      };
    }
    if (Date.parse(found.expires_at || '') <= Date.now()) {
      return { status: 200, body: { ok: false, reason: 'CODE_EXPIRED' } };
    }

    const targetDevId = await resolveOwnedDeviceId(body.deviceId);
    const targetKind = body.deviceKind === 'pc_master' ? 'pc_master' : 'mobile';
    const targetPlatform = ['windows', 'macos', 'android', 'ios', 'web'].includes(String(body.platform))
      ? String(body.platform)
      : targetKind === 'pc_master'
      ? 'windows'
      : 'android';
    const alreadyPaired = Boolean(found.consumed_at && found.consumed_by_device_id === targetDevId);

    const entPre = await readStorageJson(
      supabaseUrl,
      serviceKey,
      DEVICE_BUCKET,
      `${emailHash}/entitlement_v1.json`,
      { planId: 'free_trial', trialOptInStartedAt: null, activatedAt: null, paidExpiresAt: null }
    );
    const preView = computeEntitlementView(entPre, 2);
    if (preView.trialExpired && !preView.isPaidUnlimited) {
      return {
        status: 402,
        body: {
          ok: false,
          reason: 'TRIAL_EXPIRED',
          message:
            '30일 무료체험이 만료되었습니다. 월 3,900원 이용권 결제 후 새 기기를 연결할 수 있습니다.',
          entitlement: preView,
        },
      };
    }

    const nowIso = new Date().toISOString();
    const targetDisplayName = String(
      body.displayName || (targetKind === 'pc_master' ? '서브 PC' : '내 스마트폰')
    ).slice(0, 48);
    const isMobileWebBridge =
      Boolean(body.mobileWebBridgeOnly) ||
      (targetKind === 'mobile' && /·웹\s*\(/.test(targetDisplayName));
    if (isMobileWebBridge) {
      // 모바일 웹은 온보딩·앱 이동 다리 전용(쇼룸)이므로 기기 등록·코드 소비를 수행하지 않고 계정 일치 확인만 완료 반환
      return {
        status: 200,
        body: {
          ok: true,
          mobileWebBridgeOnly: true,
          alreadyPaired: false,
          deviceId: targetDevId,
          devices: [],
          entitlement: preView,
          canonicalUserId: userId,
        },
      };
    }
    const pcDeviceIdToRestore = String(found.pc_device_id || '').trim();

    // 새 QR 코드를 스캔하더라도 이 기기(targetDevId)가 이미 활성 연결 상태였다면 alreadyPaired=true로 정확히 판정
    let deviceAlreadyActive = false;
    try {
      const exDevRes = await fetch(
        `${supabaseUrl}/rest/v1/ghosti_devices?device_id=eq.${encodeURIComponent(targetDevId)}&owner_email=eq.${encodeURIComponent(email)}&revoked_at=is.null&select=device_id&limit=1`,
        { headers: srvHeaders(serviceKey) }
      );
      const exDevRows = exDevRes.ok ? await exDevRes.json().catch(() => []) : [];
      deviceAlreadyActive = Array.isArray(exDevRows) && exDevRows.length > 0;
    } catch {
      /* ignore */
    }
    const effectiveAlreadyPaired = Boolean(alreadyPaired || deviceAlreadyActive);

    const [, , , entRaw] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/ghosti_devices?on_conflict=device_id`, {
        method: 'POST',
        headers: srvHeaders(serviceKey, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify({
          device_id: targetDevId,
          owner_email: email,
          device_kind: targetKind,
          display_name: targetDisplayName,
          platform: targetPlatform,
          last_seen_at: nowIso,
          revoked_at: null,
        }),
      }),
      pcDeviceIdToRestore && pcDeviceIdToRestore !== targetDevId
        ? fetch(
            `${supabaseUrl}/rest/v1/ghosti_devices?device_id=eq.${encodeURIComponent(pcDeviceIdToRestore)}&owner_email=eq.${encodeURIComponent(email)}`,
            {
              method: 'PATCH',
              headers: srvHeaders(serviceKey, { 'Content-Type': 'application/json' }),
              body: JSON.stringify({
                revoked_at: null,
                last_seen_at: nowIso,
              }),
            }
          ).catch(() => null)
        : Promise.resolve(null),
      found.consumed_at
        ? Promise.resolve(null)
        : fetch(`${supabaseUrl}/rest/v1/ghosti_pairing_codes?code=eq.${cleanCode}`, {
            method: 'PATCH',
            headers: srvHeaders(serviceKey, { 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              consumed_at: nowIso,
              consumed_by_device_id: targetDevId,
            }),
          }),
      Promise.resolve(entPre),
    ]);

    const [, listRes] = await Promise.all([
      !entRaw.trialOptInStartedAt
        ? (() => {
            entRaw.trialOptInStartedAt = nowIso;
            return writeStorageJson(
              supabaseUrl,
              serviceKey,
              DEVICE_BUCKET,
              `${emailHash}/entitlement_v1.json`,
              entRaw
            );
          })()
        : Promise.resolve(true),
      fetch(
        `${supabaseUrl}/rest/v1/ghosti_devices?owner_email=eq.${encodeURIComponent(email)}&revoked_at=is.null&order=created_at.asc`,
        { headers: srvHeaders(serviceKey) }
      ),
    ]);
    const devices = listRes.ok ? await listRes.json().catch(() => []) : [];
    let safeDevices = Array.isArray(devices) ? devices : [];
    // 네이티브 모바일 앱이 방금 페어링된 경우, 같은 폰의 직전(10분 이내) 모바일 웹 임시 기기가 중복 남아있으면 자동 정리
    if (targetKind === 'mobile' && targetDisplayName.includes('앱')) {
      const recentCutoffMs = Date.now() - 10 * 60 * 1000;
      const dupWebIds = safeDevices
        .filter(
          (d) =>
            d.device_id !== targetDevId &&
            d.device_kind === 'mobile' &&
            d.platform === targetPlatform &&
            String(d.display_name || '').includes('웹') &&
            Date.parse(d.last_seen_at || d.created_at || '') >= recentCutoffMs
        )
        .map((d) => d.device_id);
      if (dupWebIds.length > 0) {
        await Promise.all(
          dupWebIds.map((dupId) =>
            fetch(
              `${supabaseUrl}/rest/v1/ghosti_devices?device_id=eq.${encodeURIComponent(dupId)}&owner_email=eq.${encodeURIComponent(email)}`,
              {
                method: 'PATCH',
                headers: srvHeaders(serviceKey, { 'Content-Type': 'application/json' }),
                body: JSON.stringify({ revoked_at: nowIso }),
              }
            ).catch(() => null)
          )
        );
        safeDevices = safeDevices.filter((d) => !dupWebIds.includes(d.device_id));
      }
    }
    return {
      status: 200,
      body: {
        ok: true,
        alreadyPaired: effectiveAlreadyPaired,
        deviceId: targetDevId,
        devices: safeDevices,
        entitlement: computeEntitlementView(entRaw, safeDevices.length),
        canonicalUserId: userId,
      },
    };
  }

  if (action === 'device_revoke_device') {
    const targetDeviceId = String(body.targetDeviceId || body.deviceId || '').trim();
    if (!targetDeviceId || targetDeviceId.length > 128) {
      return { status: 400, body: { ok: false, reason: 'INVALID_DEVICE_ID' } };
    }
    const nowIso = new Date().toISOString();
    const patchRes = await fetch(
      `${supabaseUrl}/rest/v1/ghosti_devices?device_id=eq.${encodeURIComponent(targetDeviceId)}&owner_email=eq.${encodeURIComponent(email)}&revoked_at=is.null`,
      {
        method: 'PATCH',
        headers: srvHeaders(serviceKey, {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        }),
        body: JSON.stringify({ revoked_at: nowIso }),
      }
    );
    if (!patchRes.ok) {
      return { status: 502, body: { ok: false, reason: 'DEVICE_REVOKE_FAILED' } };
    }
    const [listRes, entRaw] = await Promise.all([
      fetch(
        `${supabaseUrl}/rest/v1/ghosti_devices?owner_email=eq.${encodeURIComponent(email)}&revoked_at=is.null&order=created_at.asc`,
        { headers: srvHeaders(serviceKey) }
      ),
      readStorageJson(
        supabaseUrl,
        serviceKey,
        DEVICE_BUCKET,
        `${emailHash}/entitlement_v1.json`,
        { planId: 'free_trial', trialOptInStartedAt: null, activatedAt: null }
      ),
    ]);
    const devices = listRes.ok ? await listRes.json().catch(() => []) : [];
    const safeDevices = Array.isArray(devices) ? devices : [];
    return {
      status: 200,
      body: {
        ok: true,
        revokedDeviceId: targetDeviceId,
        devices: safeDevices,
        entitlement: computeEntitlementView(entRaw, safeDevices.length),
        canonicalUserId: userId,
      },
    };
  }

  if (action === 'device_activate_plan' || action === 'work_activate_trial') {
    const planId =
      action === 'work_activate_trial'
        ? 'work_trial_opt_in_30d'
        : String(body.planId || '').trim();
    const entRaw = await readStorageJson(
      supabaseUrl,
      serviceKey,
      DEVICE_BUCKET,
      `${emailHash}/entitlement_v1.json`,
      { planId: 'free_trial', trialOptInStartedAt: null, activatedAt: null, paidExpiresAt: null }
    );
    // [치명 과금 누수 영구 봉쇄] device_activate_plan은 오직 최초 1회 30일 무료체험 Opt-in(개인 또는 업무공유)만 허용하며,
    // 모든 유료 플랜은 반드시 서버 코인 실차감(device_purchase_plan)을 통해서만 개통됩니다.
    if (
      planId !== 'trial_opt_in_30d' &&
      planId !== 'work_trial_opt_in_30d' &&
      planId !== 'ghostkey_trial_opt_in_30d'
    ) {
      await syncProductSubscriptionRow(supabaseUrl, serviceKey, {
      email,
      userId,
      productCode:
        spec.category === 'personal'
          ? 'ghosti_pro'
          : spec.category === 'ghostkey'
          ? 'ghostkey'
          : 'ghosti_work',
      planId: spec.canonicalId,
      trialStartedAt:
        spec.category === 'personal'
          ? entRaw.trialOptInStartedAt
          : spec.category === 'ghostkey'
          ? entRaw.ghostkeyTrialOptInStartedAt
          : entRaw.workTrialOptInStartedAt,
      paidExpiresAt: effectiveExpiresIso,
      lastOrderId: requestId,
      lastPaidCoins: spec.priceCoins,
    });

    const listRes = await fetch(
        `${supabaseUrl}/rest/v1/ghosti_devices?owner_email=eq.${encodeURIComponent(email)}&revoked_at=is.null&select=device_id`,
        { headers: srvHeaders(serviceKey) }
      );
      const devRows = listRes.ok ? await listRes.json().catch(() => []) : [];
      return {
        status: 402,
        body: {
          ok: false,
          reason: 'PAYMENT_REQUIRED',
          message: '유료 이용권은 귀신같이 구독 결제창에서 귀신코인 결제 후 즉시 개통됩니다.',
          entitlement: computeEntitlementView(entRaw, Array.isArray(devRows) ? devRows.length : 1),
        },
      };
    }

    const curView = computeEntitlementView(entRaw, 1);
    if (planId === 'work_trial_opt_in_30d') {
      if (entRaw.workTrialOptInStartedAt && !curView.workTrialActive && !curView.workPaidActive) {
        const listRes = await fetch(
          `${supabaseUrl}/rest/v1/ghosti_devices?owner_email=eq.${encodeURIComponent(email)}&revoked_at=is.null&select=device_id`,
          { headers: srvHeaders(serviceKey) }
        );
        const devRows = listRes.ok ? await listRes.json().catch(() => []) : [];
        return {
          status: 402,
          body: {
            ok: false,
            reason: 'WORK_TRIAL_ALREADY_USED',
            message: '이 계정은 업무 공유(S: 드라이브) 30일 무료체험을 이미 사용 완료했습니다. 소호(~5인) 월 9,900원 구독으로 계속 이용하실 수 있습니다.',
            entitlement: computeEntitlementView(entRaw, Array.isArray(devRows) ? devRows.length : 1),
          },
        };
      }
      if (!entRaw.workTrialOptInStartedAt) {
        entRaw.workTrialOptInStartedAt = new Date().toISOString();
        await writeStorageJson(
          supabaseUrl,
          serviceKey,
          DEVICE_BUCKET,
          `${emailHash}/entitlement_v1.json`,
          entRaw
        );
        await syncProductSubscriptionRow(supabaseUrl, serviceKey, {
          email,
          userId,
          productCode: 'ghosti_work',
          planId: entRaw.workPlanId || 'work_trial_opt_in_30d',
          trialStartedAt: entRaw.workTrialOptInStartedAt,
          paidExpiresAt: entRaw.workPaidExpiresAt,
        });
      }
    } else if (planId === 'ghostkey_trial_opt_in_30d') {
      if (
        entRaw.ghostkeyTrialOptInStartedAt &&
        !curView.ghostkeyTrialActive &&
        !curView.ghostkeyPaidActive &&
        !curView.isPaidUnlimited
      ) {
        const listRes = await fetch(
          `${supabaseUrl}/rest/v1/ghosti_devices?owner_email=eq.${encodeURIComponent(email)}&revoked_at=is.null&select=device_id`,
          { headers: srvHeaders(serviceKey) }
        );
        const devRows = listRes.ok ? await listRes.json().catch(() => []) : [];
        return {
          status: 402,
          body: {
            ok: false,
            reason: 'GHOSTKEY_TRIAL_ALREADY_USED',
            message: '이 계정은 귀신키 30일 무료체험을 이미 사용 완료했습니다. 월 1,900원(또는 Pro 3,900원) 구독으로 계속 이용하실 수 있습니다.',
            entitlement: computeEntitlementView(entRaw, Array.isArray(devRows) ? devRows.length : 1),
          },
        };
      }
      if (!entRaw.ghostkeyTrialOptInStartedAt) {
        entRaw.ghostkeyTrialOptInStartedAt = new Date().toISOString();
        await writeStorageJson(
          supabaseUrl,
          serviceKey,
          DEVICE_BUCKET,
          `${emailHash}/entitlement_v1.json`,
          entRaw
        );
        await syncProductSubscriptionRow(supabaseUrl, serviceKey, {
          email,
          userId,
          productCode: 'ghostkey',
          planId: entRaw.ghostkeyPlanId || 'ghostkey_trial_opt_in_30d',
          trialStartedAt: entRaw.ghostkeyTrialOptInStartedAt,
          paidExpiresAt: entRaw.ghostkeyPaidExpiresAt,
        });
      }
    } else {
      if (entRaw.trialOptInStartedAt && !curView.trialActive && !curView.isPaidUnlimited) {
        const listRes = await fetch(
          `${supabaseUrl}/rest/v1/ghosti_devices?owner_email=eq.${encodeURIComponent(email)}&revoked_at=is.null&select=device_id`,
          { headers: srvHeaders(serviceKey) }
        );
        const devRows = listRes.ok ? await listRes.json().catch(() => []) : [];
        return {
          status: 402,
          body: {
            ok: false,
            reason: 'TRIAL_ALREADY_USED',
            message: '이 계정은 30일 무료체험을 이미 사용 완료했습니다. 이용권 구독으로 계속 이용하실 수 있습니다.',
            entitlement: computeEntitlementView(entRaw, Array.isArray(devRows) ? devRows.length : 1),
          },
        };
      }
      if (!entRaw.trialOptInStartedAt) {
        entRaw.trialOptInStartedAt = new Date().toISOString();
        await writeStorageJson(
          supabaseUrl,
          serviceKey,
          DEVICE_BUCKET,
          `${emailHash}/entitlement_v1.json`,
          entRaw
        );
      }
        await syncProductSubscriptionRow(supabaseUrl, serviceKey, {
          email,
          userId,
          productCode: 'ghosti_pro',
          planId: entRaw.planId || 'trial_opt_in_30d',
          trialStartedAt: entRaw.trialOptInStartedAt,
          paidExpiresAt: entRaw.paidExpiresAt,
        });
    }
    const listRes = await fetch(
      `${supabaseUrl}/rest/v1/ghosti_devices?owner_email=eq.${encodeURIComponent(email)}&revoked_at=is.null&select=device_id`,
      { headers: srvHeaders(serviceKey) }
    );
    const devRows = listRes.ok ? await listRes.json().catch(() => []) : [];
    return {
      status: 200,
      body: {
        ok: true,
        entitlement: computeEntitlementView(entRaw, Array.isArray(devRows) ? devRows.length : 1),
      },
    };
  }

  if (action === 'device_purchase_plan') {
    const requestedPlanId = String(body.planId || '').trim();
    const spec = SERVER_SUBSCRIPTION_PLANS[requestedPlanId];
    if (!spec) {
      return {
        status: 400,
        body: { ok: false, reason: 'UNKNOWN_SUBSCRIPTION_PLAN', message: '지원하지 않는 이용권입니다.' },
      };
    }
    if (!hubToken || !hubUrl) {
      return {
        status: 401,
        body: { ok: false, reason: 'HUB_AUTH_REQUIRED', message: '허브 로그인 세션이 필요합니다.' },
      };
    }

    const requestId =
      String(body.requestId || '').trim().slice(0, 96) ||
      `ghosti_sub_${spec.canonicalId}_${userId.slice(0, 8)}_${Date.now()}`;

    const entRaw = await readStorageJson(
      supabaseUrl,
      serviceKey,
      DEVICE_BUCKET,
      `${emailHash}/entitlement_v1.json`,
      { planId: 'free_trial', trialOptInStartedAt: null, activatedAt: null, paidExpiresAt: null }
    );
    const processedIds = Array.isArray(entRaw.processedRequestIds) ? entRaw.processedRequestIds : [];
    if (processedIds.includes(requestId)) {
      const listRes = await fetch(
        `${supabaseUrl}/rest/v1/ghosti_devices?owner_email=eq.${encodeURIComponent(email)}&revoked_at=is.null&select=device_id`,
        { headers: srvHeaders(serviceKey) }
      );
      const devRows = listRes.ok ? await listRes.json().catch(() => []) : [];
      return {
        status: 200,
        body: {
          ok: true,
          idempotentReplay: true,
          orderId: requestId,
          planId: spec.canonicalId,
          paidCoins: spec.priceCoins,
          entitlement: computeEntitlementView(entRaw, Array.isArray(devRows) ? devRows.length : 1),
        },
      };
    }

    const cleanHubSecret = String(hubClientSecret || '').trim();
    if (!cleanHubSecret) {
      return {
        status: 500,
        body: {
          ok: false,
          reason: 'HUB_CLIENT_SECRET_MISSING',
          message: '서버 결제 인증 설정(MERLIN_HUB_CLIENT_SECRET)이 준비되지 않았습니다.',
        },
      };
    }

    const hubHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hubToken}`,
      'X-Client-Id': hubClientId || 'APP-01',
      'X-Client-Secret': cleanHubSecret,
    };

    // 1) 서버에서 직접 MerlinHub 최신 코인 잔액 조회 (클라이언트 잔액 신뢰 0%)
    let currentBalance = 0;
    try {
      const balRes = await fetch(
        `${hubUrl}/api/wallet/balance?userId=${encodeURIComponent(userId)}&t=${Date.now()}`,
        { method: 'GET', headers: hubHeaders }
      );
      const balData = await balRes.json().catch(() => ({}));
      if (!balRes.ok || typeof balData?.balance !== 'number') {
        return {
          status: 502,
          body: {
            ok: false,
            reason: 'HUB_BALANCE_CHECK_FAILED',
            message: balData?.message || '귀신코인 잔액을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
          },
        };
      }
      currentBalance = Number(balData.balance);
    } catch (e) {
      return {
        status: 502,
        body: { ok: false, reason: 'HUB_CONNECTION_FAILED', message: `허브 연결 오류: ${e?.message || e}` },
      };
    }

    if (currentBalance < spec.priceCoins) {
      return {
        status: 402,
        body: {
          ok: false,
          reason: 'INSUFFICIENT_COINS',
          requiredCoins: spec.priceCoins,
          currentBalance,
          shortfall: spec.priceCoins - currentBalance,
          message: `귀신코인이 ${(spec.priceCoins - currentBalance).toLocaleString()}C 부족합니다. 충전소에서 충전 후 바로 구독을 완료할 수 있습니다.`,
        },
      };
    }

    // 2) 서버에서 직접 MerlinHub 코인 실차감 트랜잭션 실행
    let remainingBalance = currentBalance - spec.priceCoins;
    try {
      const txRes = await fetch(`${hubUrl}/api/wallet/transaction`, {
        method: 'POST',
        headers: hubHeaders,
        body: JSON.stringify({
          userId,
          amount: -spec.priceCoins,
          request_id: requestId,
          transaction_type: 'SPEND',
          display_text: spec.displayText,
          app_id: spec.category === 'ghostkey' ? 'GhostKey' : 'Ghosti',
          usage_metadata: {
            planId: spec.canonicalId,
            category: spec.category,
            durationDays: spec.durationDays,
            email,
          },
        }),
      });
      const txData = await txRes.json().catch(() => ({}));
      if (!txRes.ok || txData?.success === false) {
        const msg = String(txData?.message || txData?.error || '결제 승인에 실패했습니다.');
        const isInsufficient = /부족|insufficient|balance/i.test(msg);
        return {
          status: isInsufficient ? 402 : 502,
          body: {
            ok: false,
            reason: isInsufficient ? 'INSUFFICIENT_COINS' : 'HUB_TRANSACTION_FAILED',
            requiredCoins: spec.priceCoins,
            currentBalance,
            shortfall: Math.max(0, spec.priceCoins - currentBalance),
            message: msg,
          },
        };
      }
      if (typeof txData?.balance === 'number') {
        remainingBalance = Number(txData.balance);
      }
    } catch (e) {
      return {
        status: 502,
        body: { ok: false, reason: 'HUB_TRANSACTION_ERROR', message: `결제 통신 오류: ${e?.message || e}` },
      };
    }

    // 3) 실차감 성공 시에만 서버 원장(entitlement_v1.json)에 누적 이용 기간 기록
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const addMs = spec.durationDays * 24 * 3600 * 1000;
    let effectiveExpiresIso = nowIso;
    if (spec.category === 'personal') {
      const prevExpMs = entRaw.paidExpiresAt ? Date.parse(entRaw.paidExpiresAt) : 0;
      const baseMs = Number.isFinite(prevExpMs) && prevExpMs > nowMs ? prevExpMs : nowMs;
      entRaw.planId = spec.canonicalId;
      entRaw.activatedAt = nowIso;
      entRaw.paidExpiresAt = new Date(baseMs + addMs).toISOString();
      effectiveExpiresIso = entRaw.paidExpiresAt;
    } else if (spec.category === 'ghostkey') {
      const prevGkExpMs = entRaw.ghostkeyPaidExpiresAt ? Date.parse(entRaw.ghostkeyPaidExpiresAt) : 0;
      const baseMs = Number.isFinite(prevGkExpMs) && prevGkExpMs > nowMs ? prevGkExpMs : nowMs;
      entRaw.ghostkeyPlanId = spec.canonicalId;
      entRaw.ghostkeyActivatedAt = nowIso;
      entRaw.ghostkeyPaidExpiresAt = new Date(baseMs + addMs).toISOString();
      effectiveExpiresIso = entRaw.ghostkeyPaidExpiresAt;
    } else {
      const prevWorkExpMs = entRaw.workPaidExpiresAt ? Date.parse(entRaw.workPaidExpiresAt) : 0;
      const baseMs = Number.isFinite(prevWorkExpMs) && prevWorkExpMs > nowMs ? prevWorkExpMs : nowMs;
      entRaw.workPlanId = spec.canonicalId;
      entRaw.workActivatedAt = nowIso;
      entRaw.workPaidExpiresAt = new Date(baseMs + addMs).toISOString();
      effectiveExpiresIso = entRaw.workPaidExpiresAt;
    }
    entRaw.lastOrderId = requestId;
    entRaw.lastPaidCoins = spec.priceCoins;
    entRaw.processedRequestIds = [...processedIds.slice(-39), requestId];
    const prevHistory = Array.isArray(entRaw.purchaseHistory) ? entRaw.purchaseHistory : [];
    entRaw.purchaseHistory = [
      {
        orderId: requestId,
        planId: spec.canonicalId,
        category: spec.category,
        paidCoins: spec.priceCoins,
        durationDays: spec.durationDays,
        purchasedAt: nowIso,
        expiresAt: effectiveExpiresIso,
      },
      ...prevHistory,
    ].slice(0, 20);

    const saved = await writeStorageJson(
      supabaseUrl,
      serviceKey,
      DEVICE_BUCKET,
      `${emailHash}/entitlement_v1.json`,
      entRaw
    );
    if (!saved) {
      return {
        status: 500,
        body: {
          ok: false,
          reason: 'ENTITLEMENT_PERSIST_FAILED',
          orderId: requestId,
          message: '코인은 차감되었으나 이용권 저장에 일시 오류가 발생했습니다. 고객센터에 주문번호를 알려주시면 즉시 복구해 드립니다.',
        },
      };
    }

    const listRes = await fetch(
      `${supabaseUrl}/rest/v1/ghosti_devices?owner_email=eq.${encodeURIComponent(email)}&revoked_at=is.null&select=device_id`,
      { headers: srvHeaders(serviceKey) }
    );
    const devRows = listRes.ok ? await listRes.json().catch(() => []) : [];
    const entitlement = computeEntitlementView(entRaw, Array.isArray(devRows) ? devRows.length : 1);

    // 업무 공유(S: 드라이브) 플랜 결제 시 방 테이블(pricing_plan)과 초대 토큰 정원(max_uses)도 즉시 동기화
    if (spec.category === 'work') {
      const seatLimit = entitlement.workSeatLimit || 5;
      const roomRes = await fetch(
        `${supabaseUrl}/rest/v1/ghosti_lounge_rooms?master_email=eq.${encodeURIComponent(email)}&lounge_type=eq.work&select=room_id`,
        { headers: srvHeaders(serviceKey) }
      ).catch(() => null);
      const roomRows = roomRes && roomRes.ok ? await roomRes.json().catch(() => []) : [];
      if (Array.isArray(roomRows) && roomRows[0]?.room_id) {
        const wRoomId = String(roomRows[0].room_id);
        await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/ghosti_lounge_rooms?room_id=eq.${encodeURIComponent(wRoomId)}`, {
            method: 'PATCH',
            headers: srvHeaders(serviceKey, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
            body: JSON.stringify({ pricing_plan: spec.canonicalId }),
          }).catch(() => {}),
          fetch(
            `${supabaseUrl}/rest/v1/ghosti_room_invites?room_id=eq.${encodeURIComponent(wRoomId)}&revoked_at=is.null`,
            {
              method: 'PATCH',
              headers: srvHeaders(serviceKey, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
              body: JSON.stringify({ max_uses: seatLimit }),
            }
          ).catch(() => {}),
        ]);
      }
    }

    return {
      status: 200,
      body: {
        ok: true,
        orderId: requestId,
        planId: spec.canonicalId,
        category: spec.category,
        paidCoins: spec.priceCoins,
        remainingBalance,
        expiresAt: spec.category === 'personal' ? entRaw.paidExpiresAt : entRaw.workPaidExpiresAt,
        entitlement,
      },
    };
  }

  if (action === 'device_push_e2ee_clip') {
    const gate = await assertDeviceSyncUnlocked(supabaseUrl, serviceKey, emailHash);
    if (!gate.ok) return gate.response;
    const cipherB64 = String(body.cipherB64 || '').trim();
    const ivB64 = String(body.ivB64 || '').trim();
    const clipHash = String(body.clipHash || '').trim().slice(0, 64);
    const senderDeviceId = String(body.senderDeviceId || '').trim();
    const senderName = String(body.senderName || actorNick || '내 기기').slice(0, 48);
    if (!cipherB64 || !ivB64 || !clipHash || cipherB64.length > 128000) {
      return { status: 400, body: { ok: false, reason: 'INVALID_E2EE_CLIP_PAYLOAD' } };
    }
    const nowMs = Date.now();
    const CLIPBOARD_TTL_MS = 7 * 24 * 3600 * 1000; // 7일(168시간) 보관 통일
    const CLIPBOARD_MAX_ITEMS = 500;
    const cutoffMs = nowMs - CLIPBOARD_TTL_MS;
    const rawClientCreatedAt = String(body.createdAt || '').trim();
    const parsedClientMs = rawClientCreatedAt ? Date.parse(rawClientCreatedAt) : NaN;
    const effectiveCreatedAt =
      Number.isFinite(parsedClientMs) && Math.abs(nowMs - parsedClientMs) <= 5 * 60 * 1000
        ? new Date(parsedClientMs).toISOString()
        : new Date(nowMs).toISOString();
    const mailbox = await readStorageJson(
      supabaseUrl,
      serviceKey,
      DEVICE_BUCKET,
      `${emailHash}/clipboard_mailbox_v1.json`,
      { items: [] }
    );
    const existing = Array.isArray(mailbox.items) ? mailbox.items : [];
    const filtered = existing.filter(
      (it) => it && it.clipHash !== clipHash && (Date.parse(it.createdAt || '') || 0) >= cutoffMs
    );
    filtered.unshift({
      clipHash,
      cipherB64,
      ivB64,
      senderDeviceId,
      senderName,
      createdAt: effectiveCreatedAt,
    });
    const trimmed = filtered.slice(0, CLIPBOARD_MAX_ITEMS);
    const saved = await writeStorageJson(
      supabaseUrl,
      serviceKey,
      DEVICE_BUCKET,
      `${emailHash}/clipboard_mailbox_v1.json`,
      { updatedAt: new Date(nowMs).toISOString(), items: trimmed }
    );
    if (!saved) {
      return {
        status: 502,
        body: { ok: false, reason: 'CLIPBOARD_MAILBOX_WRITE_FAILED' },
      };
    }
    return {
      status: 200,
      body: {
        ok: true,
        count: trimmed.length,
        retentionDays: 7,
        maxItems: CLIPBOARD_MAX_ITEMS,
        canonicalUserId: userId,
        canonicalEmail: email,
      },
    };
  }

  if (action === 'device_pull_e2ee_clips') {
    const gate = await assertDeviceSyncUnlocked(supabaseUrl, serviceKey, emailHash);
    if (!gate.ok) return gate.response;
    const nowMs = Date.now();
    const CLIPBOARD_TTL_MS = 7 * 24 * 3600 * 1000; // 7일(168시간) 보관 통일
    const CLIPBOARD_MAX_ITEMS = 500;
    const cutoffMs = nowMs - CLIPBOARD_TTL_MS;
    const mailbox = await readStorageJson(
      supabaseUrl,
      serviceKey,
      DEVICE_BUCKET,
      `${emailHash}/clipboard_mailbox_v1.json`,
      { items: [] }
    );
    const items = (Array.isArray(mailbox.items) ? mailbox.items : [])
      .filter((it) => it && (Date.parse(it.createdAt || '') || 0) >= cutoffMs)
      .slice(0, CLIPBOARD_MAX_ITEMS);
    return {
      status: 200,
      body: {
        ok: true,
        items,
        retentionDays: 7,
        maxItems: CLIPBOARD_MAX_ITEMS,
        canonicalUserId: userId,
        canonicalEmail: email,
      },
    };
  }

  if (action === 'device_sync_shadow_catalog') {
    const gate = await assertDeviceSyncUnlocked(supabaseUrl, serviceKey, emailHash);
    if (!gate.ok) return gate.response;
    const incoming = Array.isArray(body.items) ? body.items.slice(0, 250) : [];
    const returnItems = body.returnItems !== false;
    const stripThumbs = Boolean(body.stripThumbs);
    const callerDeviceId = String(body.callerDeviceId || '').trim();
    const callerKind = String(body.callerKind || '').trim();
    const knownRemoteSet = Array.isArray(body.knownRemoteIds)
      ? new Set(body.knownRemoteIds.slice(0, 5000).map((x) => String(x || '')))
      : null;

    const catalog = await readStorageJson(
      supabaseUrl,
      serviceKey,
      DEVICE_BUCKET,
      `${emailHash}/shadow_catalog_v1.json`,
      { byId: {} }
    );
    const byId = catalog.byId || {};
    for (const raw of incoming) {
      if (!raw || !raw.id) continue;
      const cleanId = String(raw.id).slice(0, 120);
      byId[cleanId] = {
        id: cleanId,
        kind: raw.kind === 'doc' ? 'doc' : 'photo',
        title: String(raw.title || '').slice(0, 180),
        thumbWebp:
          raw.thumbWebp && String(raw.thumbWebp).length <= 36000 ? String(raw.thumbWebp) : undefined,
        keywords: Array.isArray(raw.keywords) ? raw.keywords.slice(0, 16).map(String) : [],
        ocrSnippet: String(raw.ocrSnippet || '').slice(0, 800),
        shotDate: String(raw.shotDate || '').slice(0, 40),
        sourceDeviceId: String(raw.sourceDeviceId || ''),
        sourceDeviceName: String(raw.sourceDeviceName || '내 기기').slice(0, 48),
        byteSize: Number(raw.byteSize || 0),
        sha256: String(raw.sha256 || '').slice(0, 80),
        hasMirrorBlob: Boolean(raw.hasMirrorBlob || byId[cleanId]?.hasMirrorBlob),
        syncedAt: new Date().toISOString(),
      };
    }
    const allItems = Object.values(byId).sort(
      (a, b) => (Date.parse(b.syncedAt || '') || 0) - (Date.parse(a.syncedAt || '') || 0)
    );
    if (incoming.length > 0) {
      const nextById = {};
      for (const it of allItems) nextById[it.id] = it;

      await writeStorageJson(
        supabaseUrl,
        serviceKey,
        DEVICE_BUCKET,
        `${emailHash}/shadow_catalog_v1.json`,
        { updatedAt: new Date().toISOString(), byId: nextById }
      );
    }

    const totalCatalogCount = allItems.length;
    const hasCallerDeviceItems = callerDeviceId
      ? allItems.some((it) => it && it.sourceDeviceId === callerDeviceId)
      : false;

    if (!returnItems) {
      return {
        status: 200,
        body: {
          ok: true,
          items: [],
          totalCatalogCount,
          hasCallerDeviceItems,
          entitlement: gate.entitlement,
        },
      };
    }

    let responseItems = allItems;
    if (stripThumbs) {
      responseItems = allItems.map((it) => ({ ...it, thumbWebp: undefined, ocrSnippet: '' }));
    } else if (callerDeviceId && knownRemoteSet) {
      responseItems = [];
      for (const it of allItems) {
        if (!it || it.sourceDeviceId === callerDeviceId) continue;
        if (!knownRemoteSet.has(it.id)) {
          responseItems.push(it);
        } else if (callerKind === 'pc_master' && it.hasMirrorBlob && it.sha256) {
          responseItems.push({
            ...it,
            thumbWebp: undefined,
            ocrSnippet: '',
            keywords: [],
          });
        }
      }
    }

    return {
      status: 200,
      body: {
        ok: true,
        items: responseItems,
        totalCatalogCount,
        hasCallerDeviceItems,
        entitlement: gate.entitlement,
      },
    };
  }

  if (action === 'device_sync_snippets') {
    const gate = await assertDeviceSyncUnlocked(supabaseUrl, serviceKey, emailHash);
    if (!gate.ok) return gate.response;
    const mode = body.mode === 'push' ? 'push' : 'pull';
    const current = await readStorageJson(
      supabaseUrl,
      serviceKey,
      DEVICE_BUCKET,
      `${emailHash}/snippets_e2ee_v1.json`,
      { cipherB64: '', ivB64: '', updatedAt: null, updatedByDeviceId: '', updatedByDeviceName: '' }
    );
    if (mode === 'push') {
      const cipherB64 = String(body.cipherB64 || '').trim();
      const ivB64 = String(body.ivB64 || '').trim();
      if (!cipherB64 || !ivB64 || cipherB64.length > 64000) {
        return { status: 400, body: { ok: false, reason: 'INVALID_E2EE_SNIPPETS_PAYLOAD' } };
      }
      const nextDoc = {
        cipherB64,
        ivB64,
        updatedAt: new Date().toISOString(),
        updatedByDeviceId: String(body.deviceId || '').slice(0, 80),
        updatedByDeviceName: String(body.deviceName || actorNick || '내 기기').slice(0, 48),
      };
      const saved = await writeStorageJson(
        supabaseUrl,
        serviceKey,
        DEVICE_BUCKET,
        `${emailHash}/snippets_e2ee_v1.json`,
        nextDoc
      );
      if (!saved) {
        return { status: 502, body: { ok: false, reason: 'SNIPPETS_WRITE_FAILED' } };
      }
      return { status: 200, body: { ok: true, ...nextDoc } };
    }
    return { status: 200, body: { ok: true, ...current } };
  }

  if (action === 'device_sign_mirror_uploads_batch') {
    const gate = await assertDeviceSyncUnlocked(supabaseUrl, serviceKey, emailHash);
    if (!gate.ok) return gate.response;
    const rawList = Array.isArray(body.sha256List) ? body.sha256List : [];
    const skipExisting = Boolean(body.skipExisting);
    const cleanList = Array.from(
      new Set(
        rawList
          .map((s) => String(s || '').replace(/[^a-fA-F0-9_.-]/g, '').slice(0, 80))
          .filter(Boolean)
      )
    ).slice(0, 60);
    if (cleanList.length === 0) {
      return { status: 200, body: { ok: true, urls: {}, alreadyUploaded: [] } };
    }
    await ensureVaultBuckets(supabaseUrl, serviceKey, false);

    // 서버 mirror_blobs에 이미 보관된 파일은 서명 발급·재전송 없이 즉시 alreadyUploaded로 반환
    const existingNames = new Set();
    try {
      for (let off = 0; off < 3000; off += 1000) {
        const listRes = await fetch(`${supabaseUrl}/storage/v1/object/list/${DEVICE_BUCKET}`, {
          method: 'POST',
          headers: srvHeaders(serviceKey, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            prefix: `${emailHash}/mirror_blobs/`,
            limit: 1000,
            offset: off,
          }),
        });
        if (!listRes.ok) break;
        const rows = await listRes.json().catch(() => []);
        if (!Array.isArray(rows) || rows.length === 0) break;
        for (const r of rows) {
          if (r?.name) existingNames.add(String(r.name));
        }
        if (rows.length < 1000) break;
      }
    } catch {
      /* fallback to signing all */
    }

    const alreadyUploaded = cleanList.filter((cur) => existingNames.has(cur));
    const toSign = skipExisting
      ? cleanList.filter((cur) => !existingNames.has(cur))
      : cleanList;

    const urls = {};
    const CONCURRENCY = 12;
    let idx = 0;
    if (toSign.length > 0) {
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, toSign.length) }, async () => {
          while (idx < toSign.length) {
            const cur = toSign[idx++];
            const signed = await createSignedUploadUrl(
              supabaseUrl,
              serviceKey,
              DEVICE_BUCKET,
              `${emailHash}/mirror_blobs/${cur}`
            );
            if (signed?.ok && signed.signedUploadUrl) {
              urls[cur] = signed.signedUploadUrl;
            }
          }
        })
      );
    }
    return { status: 200, body: { ok: true, urls, alreadyUploaded } };
  }

  if (action === 'device_sign_mirror_downloads_batch') {
    const gate = await assertDeviceSyncUnlocked(supabaseUrl, serviceKey, emailHash);
    if (!gate.ok) return gate.response;
    const rawList = Array.isArray(body.sha256List) ? body.sha256List : [];
    const cleanList = Array.from(
      new Set(
        rawList
          .map((s) => String(s || '').replace(/[^a-fA-F0-9_.-]/g, '').slice(0, 80))
          .filter(Boolean)
      )
    ).slice(0, 60);
    if (cleanList.length === 0) {
      return { status: 200, body: { ok: true, urls: {} } };
    }
    const urls = {};
    const CONCURRENCY = 12;
    let idx = 0;
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, cleanList.length) }, async () => {
        while (idx < cleanList.length) {
          const cur = cleanList[idx++];
          const signed = await createSignedDownloadUrl(
            supabaseUrl,
            serviceKey,
            DEVICE_BUCKET,
            `${emailHash}/mirror_blobs/${cur}`,
            600
          );
          if (signed?.ok && signed.signedDownloadUrl) {
            urls[cur] = signed.signedDownloadUrl;
          }
        }
      })
    );
    return { status: 200, body: { ok: true, urls } };
  }

  if (action === 'device_sign_mirror_upload') {
    const gate = await assertDeviceSyncUnlocked(supabaseUrl, serviceKey, emailHash);
    if (!gate.ok) return gate.response;
    const sha256 = String(body.sha256 || '').replace(/[^a-fA-F0-9_.-]/g, '').slice(0, 80);
    if (!sha256) return { status: 400, body: { ok: false, reason: 'MISSING_SHA256' } };
    const signed = await createSignedUploadUrl(
      supabaseUrl,
      serviceKey,
      DEVICE_BUCKET,
      `${emailHash}/mirror_blobs/${sha256}`
    );
    return { status: signed.ok ? 200 : 500, body: signed };
  }

  if (action === 'device_sign_mirror_download') {
    const gate = await assertDeviceSyncUnlocked(supabaseUrl, serviceKey, emailHash);
    if (!gate.ok) return gate.response;
    const sha256 = String(body.sha256 || '').replace(/[^a-fA-F0-9_.-]/g, '').slice(0, 80);
    if (!sha256) return { status: 400, body: { ok: false, reason: 'MISSING_SHA256' } };
    const signed = await createSignedDownloadUrl(
      supabaseUrl,
      serviceKey,
      DEVICE_BUCKET,
      `${emailHash}/mirror_blobs/${sha256}`,
      600
    );
    return { status: signed.ok ? 200 : 404, body: signed };
  }

  // ===================================================================
  // C. 4. 📸 사진 공유방 — 방장 별명 정합화 & 합류 공유방 목록 조회 (service_role)
  // ===================================================================
  if (action === 'photo_resolve_accessible_rooms') {
    const dbLoungeType = body.dbLoungeType === 'club' ? 'club' : 'family';
    const dbSubType = String(body.dbSubType || '우리집').trim();
    const roomTitle = String(body.roomTitle || '🏠 우리집 가족 사진방').trim();
    const verifiedHubNick = String(hubNickname || '').trim();
    const rawMasterNick = String(body.masterNickname || '').trim();
    const genericLabels = new Set(['방장', '가족방장', '모임방장', '모임총무', '동기회장']);

    let sanitizedClientNick =
      rawMasterNick && !genericLabels.has(rawMasterNick) ? rawMasterNick : '';

    // 독립적인 초기 3개 조회(타 계정 별명 충돌 · 내 방 목록 · 내 합류 멤버십)를 병렬 실행하여 모바일 사진공유 탭 첫 로딩 지연 단축
    const [otherRes, existRoomsRes, preMemRowsRes] = await Promise.all([
      sanitizedClientNick && sanitizedClientNick !== verifiedHubNick
        ? fetch(
            `${supabaseUrl}/rest/v1/users?nickname=eq.${encodeURIComponent(
              sanitizedClientNick
            )}&email=neq.${encodeURIComponent(email)}&select=id&limit=1`,
            { headers: srvHeaders(serviceKey) }
          ).catch(() => null)
        : Promise.resolve(null),
      fetch(
        `${supabaseUrl}/rest/v1/ghosti_lounge_rooms?master_email=eq.${encodeURIComponent(
          email
        )}&lounge_type=in.(family,club)&order=created_at.asc&limit=30`,
        { headers: srvHeaders(serviceKey) }
      ),
      fetch(
        `${supabaseUrl}/rest/v1/ghosti_lounge_members?member_email=eq.${encodeURIComponent(
          email
        )}&select=room_id,role&limit=60`,
        { headers: srvHeaders(serviceKey) }
      ).catch(() => null),
    ]);

    if (otherRes && otherRes.ok) {
      const otherRows = await otherRes.json().catch(() => []);
      if (Array.isArray(otherRows) && otherRows.length > 0) {
        sanitizedClientNick = '';
      }
    }

    const effectiveMasterNick =
      sanitizedClientNick || verifiedHubNick || email.split('@')[0] || '방장';

    // 방장이 사진 공유 메뉴 진입 즉시 5대 표준 방(우리집·본가·처가·동호회·동창회)의 DB 방과 14일 초대 토큰을 한 번에 선행 보장하여,
    // 방을 빠르게 이동하며 [💌 초대 링크 복사]를 연속 클릭할 때도 비동기 지연(포커스 상실·이전 방 링크 잔류) 없이 0.00ms 동기 복사를 보장합니다.
    const standardRoomSpecs = [
      { lt: 'family', st: '우리집', defaultTitle: '🏠 우리집 가족 사진방' },
      { lt: 'family', st: '본가(친가)', defaultTitle: '🏡 본가(친가) 가족 사진방' },
      { lt: 'family', st: '처가(친정)', defaultTitle: '🌸 처가(친정) 가족 사진방' },
      { lt: 'club', st: '동호회', defaultTitle: '⛰️ 동호회·모임 사진방' },
      { lt: 'club', st: '동창회', defaultTitle: '🎓 동창회 사진방' },
    ];
    const requestedKey = `${dbLoungeType}:${dbSubType}`;
    if (!standardRoomSpecs.some((s) => `${s.lt}:${s.st}` === requestedKey)) {
      standardRoomSpecs.push({ lt: dbLoungeType, st: dbSubType, defaultTitle: roomTitle });
    }

    const existRoomRows = existRoomsRes.ok ? await existRoomsRes.json().catch(() => []) : [];
    const existingRoomByKey = new Map();
    if (Array.isArray(existRoomRows)) {
      for (const r of existRoomRows) {
        const k = `${String(r?.lounge_type || '')}:${String(r?.sub_type || '')}`;
        if (r?.room_id && !existingRoomByKey.has(k)) {
          existingRoomByKey.set(k, String(r.room_id));
        }
      }
    }

    const missingRoomPayloads = [];
    const roomIdByKey = new Map();
    for (const spec of standardRoomSpecs) {
      const k = `${spec.lt}:${spec.st}`;
      let rId = existingRoomByKey.get(k) || '';
      if (!rId) {
        const md5Hex = crypto
          .createHash('md5')
          .update(`${email}:${spec.lt}:${spec.st}`)
          .digest('hex')
          .slice(0, 16);
        rId = `room_${md5Hex}`;
        missingRoomPayloads.push({
          room_id: rId,
          lounge_type: spec.lt,
          sub_type: spec.st,
          room_title: k === requestedKey && roomTitle ? roomTitle : spec.defaultTitle,
          master_user_id: userId,
          master_email: email,
        });
      }
      roomIdByKey.set(k, rId);
    }

    if (missingRoomPayloads.length > 0) {
      // public.users FK(master_user_id) 제약이 있는 환경에서도 신규 방 생성이 100% 성공하도록 사용자 행 선행 보장
      await fetch(`${supabaseUrl}/rest/v1/users?on_conflict=id`, {
        method: 'POST',
        headers: srvHeaders(serviceKey, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify({
          id: userId,
          email,
          nickname: effectiveMasterNick,
          last_login_at: new Date().toISOString(),
        }),
      }).catch(() => {});

      const roomCreateRes = await fetch(`${supabaseUrl}/rest/v1/ghosti_lounge_rooms?on_conflict=room_id`, {
        method: 'POST',
        headers: srvHeaders(serviceKey, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify(missingRoomPayloads),
      });
      if (!roomCreateRes.ok) {
        const errDetail = await roomCreateRes.text().catch(() => '');
        return {
          status: 500,
          body: {
            ok: false,
            reason: `ROOM_CREATE_FAILED (${roomCreateRes.status}): ${errDetail.slice(0, 180)}`,
          },
        };
      }
    }

    const allMyRoomIds = Array.from(new Set(Array.from(roomIdByKey.values())));
    const masterMemberPayloads = allMyRoomIds.map((rId) => ({
      room_id: rId,
      member_email: email,
      role: 'master',
      room_persona_nickname: effectiveMasterNick,
    }));

    const inMyRoomClause = allMyRoomIds.map((id) => `"${id.replace(/"/g, '')}"`).join(',');
    // 방장 별명 동기화 Upsert와 내 방 초대 토큰 조회를 병렬 실행
    const [, invRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/ghosti_lounge_members?on_conflict=room_id,member_email`, {
        method: 'POST',
        headers: srvHeaders(serviceKey, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify(masterMemberPayloads),
      }),
      fetch(
        `${supabaseUrl}/rest/v1/ghosti_room_invites?room_id=in.(${encodeURIComponent(
          inMyRoomClause
        )})&revoked_at=is.null&order=created_at.desc&limit=50`,
        { headers: srvHeaders(serviceKey) }
      ),
    ]);
    const invRows = invRes.ok ? await invRes.json().catch(() => []) : [];
    const activeTokenByRoomId = new Map();
    const nowMs = Date.now();
    if (Array.isArray(invRows)) {
      for (const row of invRows) {
        const rId = String(row?.room_id || '');
        if (
          rId &&
          !activeTokenByRoomId.has(rId) &&
          row?.token &&
          Date.parse(row.expires_at || '') > nowMs &&
          Number(row.used_count || 0) < Number(row.max_uses || 500)
        ) {
          activeTokenByRoomId.set(rId, String(row.token));
        }
      }
    }

    const nextExpiryIso = new Date(nowMs + 14 * 24 * 60 * 60 * 1000).toISOString();
    const missingInvites = [];
    for (const rId of allMyRoomIds) {
      if (!activeTokenByRoomId.has(rId)) {
        const newTok = crypto.randomBytes(18).toString('hex');
        activeTokenByRoomId.set(rId, newTok);
        missingInvites.push({
          token: newTok,
          room_id: rId,
          created_by_email: email,
          default_role: 'member',
          max_uses: 500,
          expires_at: nextExpiryIso,
        });
      }
    }

    if (missingInvites.length > 0) {
      const invCreateRes = await fetch(`${supabaseUrl}/rest/v1/ghosti_room_invites`, {
        method: 'POST',
        headers: srvHeaders(serviceKey, {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        }),
        body: JSON.stringify(missingInvites),
      });
      if (!invCreateRes.ok) {
        const errDetail = await invCreateRes.text().catch(() => '');
        return {
          status: 500,
          body: {
            ok: false,
            reason: `INVITE_CREATE_FAILED (${invCreateRes.status}): ${errDetail.slice(0, 180)}`,
          },
        };
      }
    }

    const myRoomId = roomIdByKey.get(requestedKey) || '';
    const myInviteToken = activeTokenByRoomId.get(myRoomId) || '';
    // [확정 정책 2026-11-24]: 초대 링크는 자동 연장 없이 발급 시점부터 딱 14일 유효하며, 만료 후 재복사 시 새 링크가 발급됩니다.

    const roomTokensByKey = {};
    for (const [k, rId] of roomIdByKey.entries()) {
      const tok = activeTokenByRoomId.get(rId) || '';
      if (rId && tok) {
        // [보안 절대 철칙 — 안 A 1:1 room_id 완전 독립 격리]:
        // 내 계정 소유 5대 표준 방은 오직 본인 room_id 1개만 매핑하며, 타인 초대방 room_id를 절대 합치지 않습니다.
        roomTokensByKey[k] = { roomId: rId, inviteToken: tok, accessibleRoomIds: [rId] };
      }
    }

    // 타인에게 초대받아 정식 합류한 공유방(ghosti_lounge_members)은 내 방과 섞지 않고
    // 별도의 독립 방 목록(joinedRooms: roomId · 방장 별명 · 방 제목 · 유형 · 초대 토큰)으로 분리 반환합니다.
    const joinedRooms = [];
    try {
      const myOwnSet = new Set(allMyRoomIds);
      const memRowsRes =
        preMemRowsRes ||
        (await fetch(
          `${supabaseUrl}/rest/v1/ghosti_lounge_members?member_email=eq.${encodeURIComponent(
            email
          )}&select=room_id,role&limit=60`,
          { headers: srvHeaders(serviceKey) }
        ));
      const memRows = memRowsRes && memRowsRes.ok ? await memRowsRes.json().catch(() => []) : [];
      const joinedRoomIds = Array.from(
        new Set(
          (Array.isArray(memRows) ? memRows : [])
            .map((m) => String(m?.room_id || '').trim())
            .filter((id) => id && !myOwnSet.has(id))
        )
      );
      if (joinedRoomIds.length > 0) {
        const inClause = joinedRoomIds.map((id) => `"${id.replace(/"/g, '')}"`).join(',');
        const [matchRoomsRes, mastersRes, joinedInvRes] = await Promise.all([
          fetch(
            `${supabaseUrl}/rest/v1/ghosti_lounge_rooms?room_id=in.(${encodeURIComponent(
              inClause
            )})&lounge_type=in.(family,club)&select=room_id,lounge_type,sub_type,room_title,master_email,created_at&order=created_at.desc`,
            { headers: srvHeaders(serviceKey) }
          ),
          fetch(
            `${supabaseUrl}/rest/v1/ghosti_lounge_members?room_id=in.(${encodeURIComponent(
              inClause
            )})&role=eq.master&select=room_id,member_email,room_persona_nickname&limit=100`,
            { headers: srvHeaders(serviceKey) }
          ),
          fetch(
            `${supabaseUrl}/rest/v1/ghosti_room_invites?room_id=in.(${encodeURIComponent(
              inClause
            )})&revoked_at=is.null&order=created_at.desc&limit=100`,
            { headers: srvHeaders(serviceKey) }
          ),
        ]);

        const matchRooms = matchRoomsRes.ok ? await matchRoomsRes.json().catch(() => []) : [];
        const masterRows = mastersRes.ok ? await mastersRes.json().catch(() => []) : [];
        const joinedInvRows = joinedInvRes.ok ? await joinedInvRes.json().catch(() => []) : [];

        const masterNickByRoom = new Map();
        if (Array.isArray(masterRows)) {
          for (const mr of masterRows) {
            const rStr = String(mr?.room_id || '');
            const nick = String(mr?.room_persona_nickname || '').trim();
            if (rStr && nick && !masterNickByRoom.has(rStr)) {
              masterNickByRoom.set(rStr, nick);
            }
          }
        }
        const joinedTokByRoom = new Map();
        if (Array.isArray(joinedInvRows)) {
          for (const ir of joinedInvRows) {
            const rStr = String(ir?.room_id || '');
            if (
              rStr &&
              !joinedTokByRoom.has(rStr) &&
              ir?.token &&
              Date.parse(ir.expires_at || '') > nowMs &&
              Number(ir.used_count || 0) < Number(ir.max_uses || 500)
            ) {
              joinedTokByRoom.set(rStr, String(ir.token));
            }
          }
        }

        if (Array.isArray(matchRooms)) {
          for (const mr of matchRooms) {
            const rStr = String(mr?.room_id || '').trim();
            if (!rStr) continue;
            const mEmail = String(mr?.master_email || '').trim().toLowerCase();
            // 동일 이메일(본인 소유) 방은 내 5대 기본 방으로만 관리하고 초대받은 방 목록에서는 제외
            if (mEmail && mEmail === email) continue;
            const dbLt = String(mr?.lounge_type || 'family');
            const dbSt = String(mr?.sub_type || '우리집');
            const fallbackMasterNick = mEmail ? mEmail.split('@')[0] : '방장';
            joinedRooms.push({
              roomId: rStr,
              dbLoungeType: dbLt,
              dbSubType: dbSt,
              roomTitle: String(mr?.room_title || '').trim() || dbSt,
              masterEmail: mEmail,
              masterNickname: masterNickByRoom.get(rStr) || fallbackMasterNick,
              inviteToken: joinedTokByRoom.get(rStr) || '',
            });
          }
        }
      }
    } catch {
      /* ignore member room lookup error */
    }

    return {
      status: 200,
      body: {
        ok: true,
        roomId: myRoomId,
        inviteToken: myInviteToken,
        masterNickname: effectiveMasterNick,
        accessibleRoomIds: [myRoomId],
        roomTokensByKey,
        joinedRooms,
      },
    };
  }

  if (action === 'photo_leave_shared_room') {
    const targetRoomId = String(body.roomId || '').trim();
    if (!targetRoomId) {
      return { status: 400, body: { ok: false, reason: 'MISSING_ROOM_ID' } };
    }
    const delRes = await fetch(
      `${supabaseUrl}/rest/v1/ghosti_lounge_members?room_id=eq.${encodeURIComponent(
        targetRoomId
      )}&member_email=eq.${encodeURIComponent(email)}&role=neq.master`,
      {
        method: 'DELETE',
        headers: srvHeaders(serviceKey, { Prefer: 'return=minimal' }),
      }
    );
    return {
      status: delRes.ok ? 200 : 500,
      body: { ok: delRes.ok, roomId: targetRoomId },
    };
  }

  if (action === 'photo_set_hidden_state') {
    const rawPhotoId = String(body.photoId || '').trim().replace(/^shared_sb_/, '');
    const hidden = Boolean(body.hidden);
    if (!rawPhotoId) {
      return { status: 400, body: { ok: false, reason: 'MISSING_PHOTO_ID' } };
    }
    const photoRes = await fetch(
      `${supabaseUrl}/rest/v1/ghosti_room_shared_photos?id=eq.${encodeURIComponent(
        rawPhotoId
      )}&select=id,room_id,uploader_email&limit=1`,
      { headers: srvHeaders(serviceKey) }
    );
    const photoRows = photoRes.ok ? await photoRes.json().catch(() => []) : [];
    const targetPhoto = Array.isArray(photoRows) ? photoRows[0] : null;
    if (!targetPhoto?.id) {
      return { status: 404, body: { ok: false, reason: 'PHOTO_NOT_FOUND' } };
    }
    const uploaderEmail = String(targetPhoto.uploader_email || '').trim().toLowerCase();
    let authorized = Boolean(uploaderEmail && uploaderEmail === email);
    if (!authorized && targetPhoto.room_id) {
      const roomRes = await fetch(
        `${supabaseUrl}/rest/v1/ghosti_lounge_rooms?room_id=eq.${encodeURIComponent(
          String(targetPhoto.room_id)
        )}&select=master_email&limit=1`,
        { headers: srvHeaders(serviceKey) }
      );
      const roomRows = roomRes.ok ? await roomRes.json().catch(() => []) : [];
      const masterEmail = String(roomRows?.[0]?.master_email || '').trim().toLowerCase();
      if (masterEmail && masterEmail === email) {
        authorized = true;
      }
    }
    if (!authorized) {
      return { status: 403, body: { ok: false, reason: 'FORBIDDEN' } };
    }
    const patchRes = await fetch(
      `${supabaseUrl}/rest/v1/ghosti_room_shared_photos?id=eq.${encodeURIComponent(rawPhotoId)}`,
      {
        method: 'PATCH',
        headers: srvHeaders(serviceKey, {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        }),
        body: JSON.stringify({ is_hidden_by_master: hidden }),
      }
    );
    return {
      status: patchRes.ok ? 200 : 500,
      body: { ok: patchRes.ok, photoId: rawPhotoId, hidden },
    };
  }

  return null;
}
