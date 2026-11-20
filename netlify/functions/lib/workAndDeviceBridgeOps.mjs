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

async function ensureVaultBuckets(supabaseUrl, serviceKey) {
  if (bucketsEnsured) return;
  for (const b of [WORK_BUCKET, DEVICE_BUCKET]) {
    try {
      await fetch(`${supabaseUrl}/storage/v1/bucket`, {
        method: 'POST',
        headers: srvHeaders(serviceKey, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: b, name: b, public: false }),
      });
    } catch {
      /* already exists */
    }
  }
  bucketsEnsured = true;
}

async function readStorageJson(supabaseUrl, serviceKey, bucket, objectPath, fallback) {
  try {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`, {
      method: 'GET',
      headers: srvHeaders(serviceKey),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    return data ?? fallback;
  } catch {
    return fallback;
  }
}

async function writeStorageJson(supabaseUrl, serviceKey, bucket, objectPath, payload) {
  await ensureVaultBuckets(supabaseUrl, serviceKey);
  const res = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: srvHeaders(serviceKey, {
      'Content-Type': 'application/json; charset=utf-8',
      'x-upsert': 'true',
    }),
    body: JSON.stringify(payload),
  });
  return res.ok;
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

  const roomRes = await fetch(
    `${supabaseUrl}/rest/v1/ghosti_lounge_rooms?room_id=eq.${encodeURIComponent(inv.room_id)}&select=room_id,lounge_type,room_title,master_email&limit=1`,
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

async function isEmailAuthorizedForWorkRoom(supabaseUrl, serviceKey, roomId, email) {
  const cleanRoom = String(roomId || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanRoom || !cleanEmail) return false;

  const memRes = await fetch(
    `${supabaseUrl}/rest/v1/ghosti_lounge_members?room_id=eq.${encodeURIComponent(cleanRoom)}&select=member_email,role`,
    { headers: srvHeaders(serviceKey) }
  );
  if (memRes.ok) {
    const rows = await memRes.json().catch(() => []);
    if (Array.isArray(rows) && rows.some((r) => String(r.member_email || '').toLowerCase() === cleanEmail)) {
      return true;
    }
  }

  const roomRes = await fetch(
    `${supabaseUrl}/rest/v1/ghosti_lounge_rooms?room_id=eq.${encodeURIComponent(cleanRoom)}&select=master_email&limit=1`,
    { headers: srvHeaders(serviceKey) }
  );
  if (roomRes.ok) {
    const rRows = await roomRes.json().catch(() => []);
    if (Array.isArray(rRows) && rRows[0] && String(rRows[0].master_email || '').toLowerCase() === cleanEmail) {
      return true;
    }
  }
  return false;
}

function sanitizeWorkFileRecord(doc, actorEmail, actorNickname) {
  const relPath = String(doc.relPath || doc.fileName || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim();
  const nowIso = new Date().toISOString();
  const lockedBy = doc.lockedBy ? String(doc.lockedBy) : null;
  return {
    id: String(doc.id || `work-${relPath}`),
    relPath,
    folderId: String(doc.folderId || 'root'),
    folderPath: String(doc.folderPath || 'S:\\'),
    fileName: String(doc.fileName || relPath.split('/').pop() || 'file'),
    ext: String(doc.ext || 'FILE').toUpperCase(),
    byteSize: Number(doc.byteSize || 0),
    sizeLabel: String(doc.sizeLabel || ''),
    sha256: String(doc.sha256 || ''),
    uploaderEmail: actorEmail,
    uploaderNickname: String(doc.author || doc.uploaderNickname || actorNickname || '팀원'),
    summaryTitle: String(doc.summaryTitle || '').slice(0, 300),
    matchedSnippet: String(doc.matchedSnippet || '').slice(0, 500),
    fullTextPreview: String(doc.fullTextPreview || '').slice(0, 12000),
    tableHeaders: Array.isArray(doc.tableHeaders) ? doc.tableHeaders.slice(0, 8) : [],
    tableRows: Array.isArray(doc.tableRows) ? doc.tableRows.slice(0, 15) : [],
    isImage: Boolean(doc.isImage),
    imageBase64:
      doc.imageBase64 && String(doc.imageBase64).length <= 48000 ? String(doc.imageBase64) : undefined,
    inlineSyncBase64:
      doc.inlineSyncBase64 && String(doc.inlineSyncBase64).length <= 700000
        ? String(doc.inlineSyncBase64)
        : undefined,
    hasCloudBlob: Boolean(doc.hasCloudBlob),
    lockedBy,
    lockedAt: lockedBy ? nowIso : null,
    fileMtime: String(doc.fileMtimeIso || doc.fileMtime || nowIso),
    updatedAtServer: nowIso,
  };
}

function formatManifestForClient(manifest) {
  const nowMs = Date.now();
  const tombstones = manifest?.deletedTombstones || {};
  const filesMap = manifest?.filesByRelPath || {};
  const list = Object.values(filesMap)
    .filter((f) => f && f.relPath && !tombstones[f.relPath])
    .map((f) => {
      const lockAlive =
        f.lockedBy && f.lockedAt && nowMs - Date.parse(String(f.lockedAt)) <= 3 * 60 * 1000;
      return {
        ...f,
        lockedBy: lockAlive ? f.lockedBy : null,
      };
    })
    .sort((a, b) => (Date.parse(b.fileMtime || '') || 0) - (Date.parse(a.fileMtime || '') || 0));
  return { files: list, deletedTombstones: tombstones };
}

function computeEntitlementView(entRaw, activeDeviceCount) {
  const nowMs = Date.now();
  const ent = {
    planId: entRaw?.planId || 'free_trial',
    trialOptInStartedAt: entRaw?.trialOptInStartedAt || null,
    activatedAt: entRaw?.activatedAt || null,
  };
  let trialActive = false;
  let trialDaysLeft = 0;
  if (ent.trialOptInStartedAt) {
    const elapsedDays = Math.floor((nowMs - Date.parse(ent.trialOptInStartedAt)) / (24 * 3600 * 1000));
    trialDaysLeft = Math.max(0, 30 - elapsedDays);
    trialActive = trialDaysLeft > 0;
  }
  const isPaidUnlimited =
    ent.planId === 'personal_sub_3900' || ent.planId === 'personal_year_35000';
  return {
    ...ent,
    activeDeviceCount,
    trialActive,
    trialDaysLeft,
    isPaidUnlimited,
    unlimitedBindingUnlocked: isPaidUnlimited || trialActive,
  };
}

/**
 * 비로그인(초대 토큰 보유자) 공개 조회 핸들러 (GET/POST 공용)
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
  const manifest = await readStorageJson(
    supabaseUrl,
    serviceKey,
    WORK_BUCKET,
    `${roomId}/index_v1.json`,
    { filesByRelPath: {}, deletedTombstones: {} }
  );
  const { files, deletedTombstones } = formatManifestForClient(manifest);
  return {
    status: 200,
    body: {
      ok: true,
      room: {
        roomId,
        roomTitle: verified.room.room_title || '💼 우리팀 업무 공유방 (S:)',
        hostNickname: verified.hostNickname,
      },
      files,
      deletedTombstones,
    },
  };
}

export async function handlePublicWorkSignDownloadAction({
  supabaseUrl,
  serviceKey,
  inviteToken,
  sha256,
}) {
  const cleanSha = String(sha256 || '').replace(/[^a-fA-F0-9_.-]/g, '').slice(0, 80);
  if (!cleanSha) return { status: 400, body: { ok: false, reason: 'MISSING_SHA256' } };
  const verified = await verifyInviteTokenForWorkRoom(supabaseUrl, serviceKey, inviteToken);
  if (!verified) {
    return { status: 403, body: { ok: false, reason: 'INVALID_OR_EXPIRED_INVITE' } };
  }
  const signed = await createSignedDownloadUrl(
    supabaseUrl,
    serviceKey,
    WORK_BUCKET,
    `${verified.room.room_id}/blobs/${cleanSha}`,
    600
  );
  return { status: signed.ok ? 200 : 404, body: signed };
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
  supabaseUrl,
  serviceKey,
}) {
  const actorNick = String(body.nickname || body.actorNickname || hubNickname || email.split('@')[0]);

  // ===================================================================
  // A. 6. 💼 업무 공유 (S: 드라이브) 액션군
  // ===================================================================
  if (action === 'work_ensure_room') {
    const roomTitle = String(body.roomTitle || '💼 우리팀 업무 공유방 (S:)').trim();
    const hostNickname = String(body.hostNickname || actorNick || '방장').trim();

    const existRes = await fetch(
      `${supabaseUrl}/rest/v1/ghosti_lounge_rooms?master_email=eq.${encodeURIComponent(email)}&lounge_type=eq.work&order=created_at.asc&limit=1`,
      { headers: srvHeaders(serviceKey) }
    );
    const existRows = existRes.ok ? await existRes.json().catch(() => []) : [];
    let roomId = Array.isArray(existRows) && existRows[0]?.room_id ? String(existRows[0].room_id) : '';

    if (!roomId) {
      roomId = `room_${sha256Hex(`${email}:work`).slice(0, 16)}`;
      await fetch(`${supabaseUrl}/rest/v1/ghosti_lounge_rooms?on_conflict=room_id`, {
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
        }),
      });
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
      Number(invRows[0].used_count || 0) < Number(invRows[0].max_uses || 500)
    ) {
      inviteToken = String(invRows[0].token);
    } else {
      inviteToken = sha256Hex(`${crypto.randomUUID()}:${roomId}:${Date.now()}`).slice(0, 36);
      const exp = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
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
          max_uses: 500,
          expires_at: exp,
        }),
      });
    }

    return {
      status: 200,
      body: { ok: true, roomId, inviteToken, roomTitle, hostNickname },
    };
  }

  if (action === 'work_accept_invite') {
    const verified = await verifyInviteTokenForWorkRoom(supabaseUrl, serviceKey, body.inviteToken);
    if (!verified) {
      return { status: 200, body: { ok: false, reason: 'INVALID_OR_EXPIRED_INVITE' } };
    }
    const roomId = verified.room.room_id;
    const isMaster = String(verified.room.master_email || '').toLowerCase() === email;
    if (!isMaster) {
      await fetch(`${supabaseUrl}/rest/v1/ghosti_lounge_members?on_conflict=room_id,member_email`, {
        method: 'POST',
        headers: srvHeaders(serviceKey, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify({
          room_id: roomId,
          member_email: email,
          role: verified.invite.default_role || 'member',
          room_persona_nickname: actorNick,
        }),
      });
    }
    return {
      status: 200,
      body: {
        ok: true,
        roomId,
        roomTitle: verified.room.room_title || '💼 우리팀 업무 공유방 (S:)',
        hostNickname: verified.hostNickname,
        role: isMaster ? 'host' : 'editor',
      },
    };
  }

  if (action === 'work_get_room_state') {
    const roomId = String(body.roomId || '').trim();
    const authed = await isEmailAuthorizedForWorkRoom(supabaseUrl, serviceKey, roomId, email);
    if (!authed) {
      if (body.inviteToken) {
        return handlePublicWorkPreviewAction({
          supabaseUrl,
          serviceKey,
          inviteToken: body.inviteToken,
        });
      }
      return { status: 403, body: { ok: false, reason: 'NOT_A_WORK_ROOM_MEMBER' } };
    }
    const manifest = await readStorageJson(
      supabaseUrl,
      serviceKey,
      WORK_BUCKET,
      `${roomId}/index_v1.json`,
      { filesByRelPath: {}, deletedTombstones: {} }
    );
    const { files, deletedTombstones } = formatManifestForClient(manifest);
    return { status: 200, body: { ok: true, roomId, files, deletedTombstones } };
  }

  if (action === 'work_upsert_files') {
    const roomId = String(body.roomId || '').trim();
    if (!(await isEmailAuthorizedForWorkRoom(supabaseUrl, serviceKey, roomId, email))) {
      return { status: 403, body: { ok: false, reason: 'NOT_A_WORK_ROOM_MEMBER' } };
    }
    const incomingDocs = Array.isArray(body.docs) ? body.docs.slice(0, 150) : [];
    const manifest = await readStorageJson(
      supabaseUrl,
      serviceKey,
      WORK_BUCKET,
      `${roomId}/index_v1.json`,
      { filesByRelPath: {}, deletedTombstones: {} }
    );
    const filesMap = manifest.filesByRelPath || {};
    const tombstones = manifest.deletedTombstones || {};

    for (const rawDoc of incomingDocs) {
      const clean = sanitizeWorkFileRecord(rawDoc, email, actorNick);
      if (!clean.relPath) continue;
      const incomingMtimeMs = Date.parse(clean.fileMtime) || Date.now();

      // 삭제된 파일이 늦게 켜진 다른 PC에서 옛날 mtime으로 부활(역류)하는 현상 원천 차단
      const tomb = tombstones[clean.relPath];
      if (tomb?.deletedAt) {
        const deletedMs = Date.parse(tomb.deletedAt) || 0;
        if (incomingMtimeMs <= deletedMs + 1500) {
          continue;
        }
        delete tombstones[clean.relPath];
      }

      const prev = filesMap[clean.relPath];
      if (prev) {
        const prevMtimeMs = Date.parse(prev.fileMtime || '') || 0;
        // 옛날 파일이 최신 수정본을 덮어쓰지 못하도록 보호 (단, 동일 sha256의 잠금 상태 변경은 허용)
        if (clean.sha256 !== prev.sha256 && incomingMtimeMs + 1500 < prevMtimeMs) {
          continue;
        }
        if (prev.hasCloudBlob && prev.sha256 === clean.sha256) {
          clean.hasCloudBlob = true;
        }
        if (!clean.inlineSyncBase64 && prev.inlineSyncBase64 && prev.sha256 === clean.sha256) {
          clean.inlineSyncBase64 = prev.inlineSyncBase64;
        }
      }
      filesMap[clean.relPath] = clean;
    }

    const nextManifest = {
      updatedAt: new Date().toISOString(),
      filesByRelPath: filesMap,
      deletedTombstones: tombstones,
    };
    await writeStorageJson(supabaseUrl, serviceKey, WORK_BUCKET, `${roomId}/index_v1.json`, nextManifest);
    const { files, deletedTombstones } = formatManifestForClient(nextManifest);
    return { status: 200, body: { ok: true, files, deletedTombstones } };
  }

  if (action === 'work_delete_file') {
    const roomId = String(body.roomId || '').trim();
    const relPath = String(body.relPath || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
    if (!roomId || !relPath) {
      return { status: 400, body: { ok: false, reason: 'MISSING_ROOM_OR_RELPATH' } };
    }
    if (!(await isEmailAuthorizedForWorkRoom(supabaseUrl, serviceKey, roomId, email))) {
      return { status: 403, body: { ok: false, reason: 'NOT_A_WORK_ROOM_MEMBER' } };
    }
    const manifest = await readStorageJson(
      supabaseUrl,
      serviceKey,
      WORK_BUCKET,
      `${roomId}/index_v1.json`,
      { filesByRelPath: {}, deletedTombstones: {} }
    );
    const filesMap = manifest.filesByRelPath || {};
    const tombstones = manifest.deletedTombstones || {};
    const removedEntry = filesMap[relPath];
    delete filesMap[relPath];
    tombstones[relPath] = {
      deletedAt: new Date().toISOString(),
      deletedBy: actorNick,
    };
    const nextManifest = {
      updatedAt: new Date().toISOString(),
      filesByRelPath: filesMap,
      deletedTombstones: tombstones,
    };
    await writeStorageJson(supabaseUrl, serviceKey, WORK_BUCKET, `${roomId}/index_v1.json`, nextManifest);
    // 삭제된 대용량 파일의 고아 바이너리 블롭(ghosti-work-vault)도 즉시 제거하여 영구 스토리지 비대화 차단
    if (removedEntry?.sha256) {
      const stillReferenced = Object.values(filesMap).some(
        (f) => f && f.sha256 === removedEntry.sha256
      );
      if (!stillReferenced) {
        const cleanSha = String(removedEntry.sha256).replace(/[^a-fA-F0-9_.-]/g, '').slice(0, 80);
        if (cleanSha) {
          await fetch(`${supabaseUrl}/storage/v1/object/${WORK_BUCKET}/${roomId}/blobs/${cleanSha}`, {
            method: 'DELETE',
            headers: srvHeaders(serviceKey),
          }).catch(() => {});
        }
      }
    }
    const { files, deletedTombstones } = formatManifestForClient(nextManifest);
    return { status: 200, body: { ok: true, relPath, files, deletedTombstones } };
  }

  if (action === 'work_sign_upload') {
    const roomId = String(body.roomId || '').trim();
    const sha256 = String(body.sha256 || '').replace(/[^a-fA-F0-9_.-]/g, '').slice(0, 80);
    const relPath = String(body.relPath || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
    if (!roomId || !sha256) {
      return { status: 400, body: { ok: false, reason: 'MISSING_ROOM_OR_SHA256' } };
    }
    if (!(await isEmailAuthorizedForWorkRoom(supabaseUrl, serviceKey, roomId, email))) {
      return { status: 403, body: { ok: false, reason: 'NOT_A_WORK_ROOM_MEMBER' } };
    }
    const objectPath = `${roomId}/blobs/${sha256}`;
    // 이미 동일 해시 블롭이 올라가 있으면 재업로드 생략
    const probeDl = await createSignedDownloadUrl(supabaseUrl, serviceKey, WORK_BUCKET, objectPath, 60);
    if (probeDl.ok) {
      const headRes = await fetch(probeDl.signedDownloadUrl, { method: 'HEAD' }).catch(() => null);
      if (headRes && headRes.ok) {
        if (relPath) {
          const manifest = await readStorageJson(
            supabaseUrl,
            serviceKey,
            WORK_BUCKET,
            `${roomId}/index_v1.json`,
            { filesByRelPath: {}, deletedTombstones: {} }
          );
          if (manifest.filesByRelPath?.[relPath]) {
            manifest.filesByRelPath[relPath].hasCloudBlob = true;
            await writeStorageJson(supabaseUrl, serviceKey, WORK_BUCKET, `${roomId}/index_v1.json`, manifest);
          }
        }
        return { status: 200, body: { ok: true, alreadyUploaded: true, objectPath } };
      }
    }
    const signed = await createSignedUploadUrl(supabaseUrl, serviceKey, WORK_BUCKET, objectPath);
    return { status: signed.ok ? 200 : 500, body: signed };
  }

  if (action === 'work_mark_blob_uploaded') {
    const roomId = String(body.roomId || '').trim();
    const relPath = String(body.relPath || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
    if (!roomId || !relPath) return { status: 400, body: { ok: false } };
    if (!(await isEmailAuthorizedForWorkRoom(supabaseUrl, serviceKey, roomId, email))) {
      return { status: 403, body: { ok: false, reason: 'NOT_A_WORK_ROOM_MEMBER' } };
    }
    const manifest = await readStorageJson(
      supabaseUrl,
      serviceKey,
      WORK_BUCKET,
      `${roomId}/index_v1.json`,
      { filesByRelPath: {}, deletedTombstones: {} }
    );
    if (manifest.filesByRelPath?.[relPath]) {
      manifest.filesByRelPath[relPath].hasCloudBlob = true;
      await writeStorageJson(supabaseUrl, serviceKey, WORK_BUCKET, `${roomId}/index_v1.json`, manifest);
    }
    return { status: 200, body: { ok: true } };
  }

  if (action === 'work_sign_download') {
    const roomId = String(body.roomId || '').trim();
    const sha256 = String(body.sha256 || '').replace(/[^a-fA-F0-9_.-]/g, '').slice(0, 80);
    if (!roomId || !sha256) {
      return { status: 400, body: { ok: false, reason: 'MISSING_ROOM_OR_SHA256' } };
    }
    let authed = await isEmailAuthorizedForWorkRoom(supabaseUrl, serviceKey, roomId, email);
    if (!authed && body.inviteToken) {
      const v = await verifyInviteTokenForWorkRoom(supabaseUrl, serviceKey, body.inviteToken);
      authed = Boolean(v && v.room.room_id === roomId);
    }
    if (!authed) {
      return { status: 403, body: { ok: false, reason: 'NOT_AUTHORIZED_FOR_DOWNLOAD' } };
    }
    const signed = await createSignedDownloadUrl(
      supabaseUrl,
      serviceKey,
      WORK_BUCKET,
      `${roomId}/blobs/${sha256}`,
      600
    );
    return { status: signed.ok ? 200 : 404, body: signed };
  }

  // ===================================================================
  // B. 5. 📱 내 기기 통합 (PC + 폰 + PC+) 액션군
  // ===================================================================
  const emailHash = sha256Hex(email).slice(0, 32);

  if (action === 'device_heartbeat_and_list') {
    const rawDevId = String(body.deviceId || '').trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawDevId);
    const deviceId = isUuid ? rawDevId : crypto.randomUUID();
    const deviceKind = body.deviceKind === 'mobile' ? 'mobile' : 'pc_master';
    const platform = ['windows', 'macos', 'android', 'ios', 'web'].includes(String(body.platform))
      ? String(body.platform)
      : deviceKind === 'mobile'
      ? 'android'
      : 'windows';
    const displayName = String(
      body.displayName || (deviceKind === 'mobile' ? '내 스마트폰' : '메인 PC')
    ).slice(0, 48);

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
        app_version: String(body.appVersion || '1.0.38').slice(0, 24),
        last_seen_at: new Date().toISOString(),
        revoked_at: null,
      }),
    });

    const listRes = await fetch(
      `${supabaseUrl}/rest/v1/ghosti_devices?owner_email=eq.${encodeURIComponent(email)}&revoked_at=is.null&order=created_at.asc`,
      { headers: srvHeaders(serviceKey) }
    );
    const devices = listRes.ok ? await listRes.json().catch(() => []) : [];
    const safeDevices = Array.isArray(devices) ? devices : [];

    // 6자리 페어링 코드 발급/유지 (PC 마스터일 때)
    let pairingCode = null;
    if (deviceKind === 'pc_master') {
      const codeRes = await fetch(
        `${supabaseUrl}/rest/v1/ghosti_pairing_codes?owner_email=eq.${encodeURIComponent(email)}&consumed_at=is.null&order=expires_at.desc&limit=1`,
        { headers: srvHeaders(serviceKey) }
      );
      const codeRows = codeRes.ok ? await codeRes.json().catch(() => []) : [];
      if (
        Array.isArray(codeRows) &&
        codeRows[0]?.code &&
        Date.parse(codeRows[0].expires_at || '') > Date.now() + 60_000
      ) {
        pairingCode = String(codeRows[0].code);
      } else {
        const newCode = String(Math.floor(100000 + Math.random() * 900000));
        const expIso = new Date(Date.now() + 15 * 60 * 1000).toISOString();
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

    const entRaw = await readStorageJson(
      supabaseUrl,
      serviceKey,
      DEVICE_BUCKET,
      `${emailHash}/entitlement_v1.json`,
      { planId: 'free_trial', trialOptInStartedAt: null, activatedAt: null }
    );

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
        devices: safeDevices,
        pairingCode,
        entitlement,
      },
    };
  }

  if (action === 'device_consume_pairing_code') {
    const cleanCode = String(body.code || '').replace(/\D/g, '').slice(0, 6);
    if (cleanCode.length !== 6) {
      return { status: 200, body: { ok: false, reason: 'INVALID_CODE_FORMAT' } };
    }
    const cRes = await fetch(
      `${supabaseUrl}/rest/v1/ghosti_pairing_codes?code=eq.${cleanCode}&owner_email=eq.${encodeURIComponent(email)}&consumed_at=is.null&limit=1`,
      { headers: srvHeaders(serviceKey) }
    );
    const cRows = cRes.ok ? await cRes.json().catch(() => []) : [];
    const found = Array.isArray(cRows) ? cRows[0] : null;
    if (!found || Date.parse(found.expires_at || '') <= Date.now()) {
      return { status: 200, body: { ok: false, reason: 'EXPIRED_OR_INVALID_CODE' } };
    }

    const rawDevId = String(body.deviceId || '').trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawDevId);
    const mobileDevId = isUuid ? rawDevId : crypto.randomUUID();
    await fetch(`${supabaseUrl}/rest/v1/ghosti_devices?on_conflict=device_id`, {
      method: 'POST',
      headers: srvHeaders(serviceKey, {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify({
        device_id: mobileDevId,
        owner_email: email,
        device_kind: 'mobile',
        display_name: String(body.displayName || '내 스마트폰').slice(0, 48),
        platform: ['android', 'ios', 'web'].includes(String(body.platform))
          ? String(body.platform)
          : 'android',
        last_seen_at: new Date().toISOString(),
        revoked_at: null,
      }),
    });

    await fetch(`${supabaseUrl}/rest/v1/ghosti_pairing_codes?code=eq.${cleanCode}`, {
      method: 'PATCH',
      headers: srvHeaders(serviceKey, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        consumed_at: new Date().toISOString(),
        consumed_by_device_id: mobileDevId,
      }),
    });

    const entRaw = await readStorageJson(
      supabaseUrl,
      serviceKey,
      DEVICE_BUCKET,
      `${emailHash}/entitlement_v1.json`,
      { planId: 'free_trial', trialOptInStartedAt: null, activatedAt: null }
    );
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

    const listRes = await fetch(
      `${supabaseUrl}/rest/v1/ghosti_devices?owner_email=eq.${encodeURIComponent(email)}&revoked_at=is.null&order=created_at.asc`,
      { headers: srvHeaders(serviceKey) }
    );
    const devices = listRes.ok ? await listRes.json().catch(() => []) : [];
    const safeDevices = Array.isArray(devices) ? devices : [];
    return {
      status: 200,
      body: {
        ok: true,
        deviceId: mobileDevId,
        devices: safeDevices,
        entitlement: computeEntitlementView(entRaw, safeDevices.length),
      },
    };
  }

  if (action === 'device_activate_plan') {
    const planId = String(body.planId || 'free_trial');
    const entRaw = await readStorageJson(
      supabaseUrl,
      serviceKey,
      DEVICE_BUCKET,
      `${emailHash}/entitlement_v1.json`,
      { planId: 'free_trial', trialOptInStartedAt: null, activatedAt: null }
    );
    if (planId === 'trial_opt_in_30d') {
      if (!entRaw.trialOptInStartedAt) {
        entRaw.trialOptInStartedAt = new Date().toISOString();
      }
    } else {
      entRaw.planId = planId;
      entRaw.activatedAt = new Date().toISOString();
    }
    await writeStorageJson(
      supabaseUrl,
      serviceKey,
      DEVICE_BUCKET,
      `${emailHash}/entitlement_v1.json`,
      entRaw
    );
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

  if (action === 'device_push_e2ee_clip') {
    const cipherB64 = String(body.cipherB64 || '').trim();
    const ivB64 = String(body.ivB64 || '').trim();
    const clipHash = String(body.clipHash || '').trim().slice(0, 64);
    const senderDeviceId = String(body.senderDeviceId || '').trim();
    const senderName = String(body.senderName || actorNick || '내 기기').slice(0, 48);
    if (!cipherB64 || !ivB64 || !clipHash || cipherB64.length > 128000) {
      return { status: 400, body: { ok: false, reason: 'INVALID_E2EE_CLIP_PAYLOAD' } };
    }
    const nowMs = Date.now();
    const cutoffMs = nowMs - 24 * 3600 * 1000;
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
      createdAt: new Date(nowMs).toISOString(),
    });
    const trimmed = filtered.slice(0, 15);
    await writeStorageJson(
      supabaseUrl,
      serviceKey,
      DEVICE_BUCKET,
      `${emailHash}/clipboard_mailbox_v1.json`,
      { updatedAt: new Date(nowMs).toISOString(), items: trimmed }
    );
    return { status: 200, body: { ok: true, count: trimmed.length } };
  }

  if (action === 'device_pull_e2ee_clips') {
    const nowMs = Date.now();
    const cutoffMs = nowMs - 24 * 3600 * 1000;
    const mailbox = await readStorageJson(
      supabaseUrl,
      serviceKey,
      DEVICE_BUCKET,
      `${emailHash}/clipboard_mailbox_v1.json`,
      { items: [] }
    );
    const items = (Array.isArray(mailbox.items) ? mailbox.items : []).filter(
      (it) => it && (Date.parse(it.createdAt || '') || 0) >= cutoffMs
    );
    return { status: 200, body: { ok: true, items } };
  }

  if (action === 'device_sync_shadow_catalog') {
    const incoming = Array.isArray(body.items) ? body.items.slice(0, 150) : [];
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
        keywords: Array.isArray(raw.keywords) ? raw.keywords.slice(0, 12).map(String) : [],
        ocrSnippet: String(raw.ocrSnippet || '').slice(0, 500),
        shotDate: String(raw.shotDate || '').slice(0, 40),
        sourceDeviceId: String(raw.sourceDeviceId || ''),
        sourceDeviceName: String(raw.sourceDeviceName || '내 기기').slice(0, 48),
        byteSize: Number(raw.byteSize || 0),
        sha256: String(raw.sha256 || '').slice(0, 80),
        hasMirrorBlob: Boolean(raw.hasMirrorBlob || byId[cleanId]?.hasMirrorBlob),
        syncedAt: new Date().toISOString(),
      };
    }
    const allItems = Object.values(byId)
      .sort((a, b) => (Date.parse(b.syncedAt || '') || 0) - (Date.parse(a.syncedAt || '') || 0))
      .slice(0, 300);
    const nextById = {};
    for (const it of allItems) nextById[it.id] = it;

    await writeStorageJson(
      supabaseUrl,
      serviceKey,
      DEVICE_BUCKET,
      `${emailHash}/shadow_catalog_v1.json`,
      { updatedAt: new Date().toISOString(), byId: nextById }
    );
    return { status: 200, body: { ok: true, items: allItems } };
  }

  if (action === 'device_sign_mirror_upload') {
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

    // 타 계정 별명('ㅇㄴ' 등)이 구버전 클라이언트 캐시로 넘어온 경우 public.users 대조로 원천 배제
    if (sanitizedClientNick && sanitizedClientNick !== verifiedHubNick) {
      try {
        const otherRes = await fetch(
          `${supabaseUrl}/rest/v1/users?nickname=eq.${encodeURIComponent(
            sanitizedClientNick
          )}&email=neq.${encodeURIComponent(email)}&select=id&limit=1`,
          { headers: srvHeaders(serviceKey) }
        );
        const otherRows = otherRes.ok ? await otherRes.json().catch(() => []) : [];
        if (Array.isArray(otherRows) && otherRows.length > 0) {
          sanitizedClientNick = '';
        }
      } catch {
        /* ignore lookup failure */
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

    const existRoomsRes = await fetch(
      `${supabaseUrl}/rest/v1/ghosti_lounge_rooms?master_email=eq.${encodeURIComponent(
        email
      )}&lounge_type=in.(family,club)&order=created_at.asc&limit=30`,
      { headers: srvHeaders(serviceKey) }
    );
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

    // 방장 본인의 room_persona_nickname을 항상 최신 계정 별명으로 일괄 동기화
    await fetch(`${supabaseUrl}/rest/v1/ghosti_lounge_members?on_conflict=room_id,member_email`, {
      method: 'POST',
      headers: srvHeaders(serviceKey, {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify(masterMemberPayloads),
    });

    const inMyRoomClause = allMyRoomIds.map((id) => `"${id.replace(/"/g, '')}"`).join(',');
    const invRes = await fetch(
      `${supabaseUrl}/rest/v1/ghosti_room_invites?room_id=in.(${encodeURIComponent(
        inMyRoomClause
      )})&revoked_at=is.null&order=created_at.desc&limit=50`,
      { headers: srvHeaders(serviceKey) }
    );
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
    if (myInviteToken && !missingInvites.some((m) => m.token === myInviteToken)) {
      await fetch(
        `${supabaseUrl}/rest/v1/ghosti_room_invites?token=eq.${encodeURIComponent(myInviteToken)}`,
        {
          method: 'PATCH',
          headers: srvHeaders(serviceKey, {
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          }),
          body: JSON.stringify({ expires_at: nextExpiryIso }),
        }
      ).catch(() => {});
    }

    const roomTokensByKey = {};
    for (const [k, rId] of roomIdByKey.entries()) {
      const tok = activeTokenByRoomId.get(rId) || '';
      if (rId && tok) {
        roomTokensByKey[k] = { roomId: rId, inviteToken: tok };
      }
    }

    const accessibleByKey = new Map();
    for (const [k, rId] of roomIdByKey.entries()) {
      accessibleByKey.set(k, new Set([rId]));
    }
    const accessibleSet = accessibleByKey.get(requestedKey) || new Set([myRoomId]);
    try {
      const myOwnSet = new Set(allMyRoomIds);
      const memRowsRes = await fetch(
        `${supabaseUrl}/rest/v1/ghosti_lounge_members?member_email=eq.${encodeURIComponent(
          email
        )}&select=room_id&limit=40`,
        { headers: srvHeaders(serviceKey) }
      );
      const memRows = memRowsRes.ok ? await memRowsRes.json().catch(() => []) : [];
      const joinedRoomIds = Array.isArray(memRows)
        ? memRows.map((m) => String(m?.room_id || '')).filter((id) => id && !myOwnSet.has(id))
        : [];
      if (joinedRoomIds.length > 0) {
        const inClause = joinedRoomIds.map((id) => `"${id.replace(/"/g, '')}"`).join(',');
        const matchRoomsRes = await fetch(
          `${supabaseUrl}/rest/v1/ghosti_lounge_rooms?room_id=in.(${encodeURIComponent(
            inClause
          )})&lounge_type=in.(family,club)&select=room_id,lounge_type,sub_type`,
          { headers: srvHeaders(serviceKey) }
        );
        const matchRooms = matchRoomsRes.ok ? await matchRoomsRes.json().catch(() => []) : [];
        const matchedJoinedIds = [];
        if (Array.isArray(matchRooms)) {
          for (const mr of matchRooms) {
            if (mr?.room_id) {
              const rStr = String(mr.room_id);
              const mrKey = `${String(mr.lounge_type || '')}:${String(mr.sub_type || '')}`;
              if (!accessibleByKey.has(mrKey)) {
                accessibleByKey.set(mrKey, new Set());
              }
              accessibleByKey.get(mrKey).add(rStr);
              if (mrKey === requestedKey) {
                accessibleSet.add(rStr);
                matchedJoinedIds.push(rStr);
              }
            }
          }
        }
        // 과거 reseed 버그로 초대 합류 방(matchedJoinedIds)의 원본 사진이 내 방(myRoomId)에 내 이름으로 중복 복제된 행이 있으면 서버에서 자동 청소
        if (matchedJoinedIds.length > 0) {
          const allCheckIds = [myRoomId, ...matchedJoinedIds]
            .map((id) => `"${id.replace(/"/g, '')}"`)
            .join(',');
          const dupCheckRes = await fetch(
            `${supabaseUrl}/rest/v1/ghosti_room_shared_photos?room_id=in.(${encodeURIComponent(
              allCheckIds
            )})&select=id,room_id,thumb_webp_url,created_at&order=created_at.asc&limit=300`,
            { headers: srvHeaders(serviceKey) }
          );
          const dupRows = dupCheckRes.ok ? await dupCheckRes.json().catch(() => []) : [];
          if (Array.isArray(dupRows) && dupRows.length > 1) {
            const joinedThumbSigs = new Set();
            for (const r of dupRows) {
              if (r?.room_id && String(r.room_id) !== myRoomId && r?.thumb_webp_url) {
                const th = String(r.thumb_webp_url);
                joinedThumbSigs.add(`${th.slice(0, 180)}:${th.length}`);
              }
            }
            if (joinedThumbSigs.size > 0) {
              for (const r of dupRows) {
                if (r?.id && String(r.room_id) === myRoomId && r?.thumb_webp_url) {
                  const th = String(r.thumb_webp_url);
                  if (joinedThumbSigs.has(`${th.slice(0, 180)}:${th.length}`)) {
                    await fetch(
                      `${supabaseUrl}/rest/v1/ghosti_room_shared_photos?id=eq.${encodeURIComponent(
                        String(r.id)
                      )}`,
                      { method: 'DELETE', headers: srvHeaders(serviceKey) }
                    ).catch(() => {});
                  }
                }
              }
            }
          }
        }
      }
    } catch {
      /* ignore member room expansion error */
    }

    for (const [k, entry] of Object.entries(roomTokensByKey)) {
      const setForKey = accessibleByKey.get(k);
      entry.accessibleRoomIds = setForKey ? Array.from(setForKey) : [entry.roomId];
    }

    return {
      status: 200,
      body: {
        ok: true,
        roomId: myRoomId,
        inviteToken: myInviteToken,
        masterNickname: effectiveMasterNick,
        accessibleRoomIds: Array.from(accessibleSet),
        roomTokensByKey,
      },
    };
  }

  return null;
}
