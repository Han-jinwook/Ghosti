import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  callGhostiServerBridge,
  ensureGhostiAuthedSupabaseClient,
  ensureGhostiPublicSupabaseClient,
  hasAuthenticatedHubAccountSession,
  supabase,
} from './supabaseClient';
import { getZCoreUrl, zCoreBridge } from './zCoreBridge';

export interface WorkLoungeDocDto {
  id: string;
  relPath: string;
  folderId: string;
  folderPath: string;
  fileName: string;
  ext: string;
  byteSize: number;
  sizeLabel: string;
  updatedAt: string;
  fileMtimeIso: string;
  author: string;
  lockedBy: string | null;
  sha256: string;
  cacheSizeLabel: string;
  summaryTitle: string;
  matchedSnippet: string;
  tableHeaders: string[];
  tableRows: string[][];
  fullTextPreview: string;
  isImage?: boolean;
  imageBase64?: string;
  inlineSyncBase64?: string;
  hasCloudBlob?: boolean;
}

export interface WorkRoomInviteMeta {
  hasWorkInvite: boolean;
  roomId: string;
  inviteToken: string;
  hostNickname: string;
  roomTitle: string;
}

export interface WorkRoomPresenceMember {
  peerId: string;
  nickname: string;
  role: 'host' | 'editor' | 'viewer';
  sDriveConnected: boolean;
  onlineAt: string;
}

export type WorkDeletedTombstoneMap = Record<string, { deletedAt: string; deletedBy?: string }>;

const WORK_INVITE_SESSION_KEY = 'ghosti_active_work_room_invite_v1';
const MY_WORK_ROOM_CACHE_KEY = 'ghosti_my_work_room_meta_v1';
const uploadedCloudBlobKeys = new Set<string>();

function formatBytesLabel(bytes: number): string {
  if (!bytes || bytes <= 0) return '0.1 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(0.1, bytes / 1024).toFixed(1)} KB`;
}

function formatMtimeKo(isoOrText?: string): string {
  if (!isoOrText) return '최근';
  const parsed = Date.parse(isoOrText);
  if (Number.isNaN(parsed)) return isoOrText;
  const d = new Date(parsed);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${hh}:${mm}`;
}

function isLocalDevServerAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function resolveWorkApiUrl(path: string): string | null {
  if (zCoreBridge.isConnected) {
    return getZCoreUrl(path);
  }
  if (isLocalDevServerAvailable()) {
    return path;
  }
  return null;
}

export function readActiveWorkRoomInviteMeta(): WorkRoomInviteMeta {
  const empty: WorkRoomInviteMeta = {
    hasWorkInvite: false,
    roomId: '',
    inviteToken: '',
    hostNickname: '방장',
    roomTitle: '우리팀 업무 공유방 (S:)',
  };
  if (typeof window === 'undefined') return empty;

  try {
    const params = new URLSearchParams(window.location.search);
    const urlRoomId = (params.get('workRoom') || '').trim();
    const urlToken = (params.get('inviteToken') || params.get('token') || '').trim();
    const urlHost = (params.get('host') || '').trim();
    const urlTitle = (params.get('title') || '').trim();

    if (urlRoomId) {
      const resolved: WorkRoomInviteMeta = {
        hasWorkInvite: true,
        roomId: urlRoomId,
        inviteToken: urlToken,
        hostNickname: urlHost || '방장',
        roomTitle: urlTitle || '우리팀 업무 공유방 (S:)',
      };
      try {
        sessionStorage.setItem(WORK_INVITE_SESSION_KEY, JSON.stringify(resolved));
      } catch {
        /* ignore */
      }
      return resolved;
    }

    const rawSaved = sessionStorage.getItem(WORK_INVITE_SESSION_KEY);
    if (rawSaved) {
      const parsed = JSON.parse(rawSaved) as Partial<WorkRoomInviteMeta>;
      if (parsed?.roomId) {
        return {
          hasWorkInvite: true,
          roomId: parsed.roomId,
          inviteToken: parsed.inviteToken || '',
          hostNickname: parsed.hostNickname || '방장',
          roomTitle: parsed.roomTitle || '우리팀 업무 공유방 (S:)',
        };
      }
    }
  } catch {
    /* ignore */
  }
  return empty;
}

export async function ensureMyWorkRoomAndInvite(opts: {
  roomTitle?: string;
  hostNickname?: string;
}): Promise<{
  ok: boolean;
  roomId?: string;
  inviteToken?: string;
  inviteUrl?: string;
  reason?: string;
}> {
  if (!hasAuthenticatedHubAccountSession()) {
    return { ok: false, reason: 'AUTH_REQUIRED' };
  }
  const roomTitle = (opts.roomTitle || '💼 우리팀 업무 공유방 (S:)').trim();
  const hostNickname = (opts.hostNickname || '방장').trim();

  const bridgeRes = await callGhostiServerBridge<{
    roomId?: string;
    inviteToken?: string;
  }>('work_ensure_room', {
    roomTitle,
    hostNickname,
  });

  if (!bridgeRes.ok || !bridgeRes.roomId || !bridgeRes.inviteToken) {
    return { ok: false, reason: bridgeRes.reason || 'BRIDGE_ENSURE_ROOM_FAILED' };
  }

  try {
    localStorage.setItem(
      MY_WORK_ROOM_CACHE_KEY,
      JSON.stringify({
        roomId: bridgeRes.roomId,
        inviteToken: bridgeRes.inviteToken,
        roomTitle,
        hostNickname,
      })
    );
  } catch {
    /* ignore */
  }

  const origin =
    typeof window !== 'undefined' && window.location.origin.startsWith('http')
      ? window.location.origin
      : 'https://ghosti.sundreamer.app';
  const qs = new URLSearchParams({
    lounge: 'work',
    tab: 'dashboard',
    workRoom: bridgeRes.roomId,
    inviteToken: bridgeRes.inviteToken,
    host: hostNickname,
    title: roomTitle,
  });

  return {
    ok: true,
    roomId: bridgeRes.roomId,
    inviteToken: bridgeRes.inviteToken,
    inviteUrl: `${origin}/?${qs.toString()}`,
  };
}

/**
 * 초대받은 팀원(?workRoom=...&token=...)이 로그인 완료 시 정식 DB 멤버(ghosti_lounge_members)로 자동 편입합니다.
 */
export async function acceptWorkRoomInvite(opts: {
  inviteToken: string;
  nickname: string;
}): Promise<{
  ok: boolean;
  roomId?: string;
  roomTitle?: string;
  hostNickname?: string;
  role?: 'host' | 'editor';
}> {
  const cleanTok = (opts.inviteToken || '').trim();
  if (!cleanTok || !hasAuthenticatedHubAccountSession()) {
    return { ok: false };
  }
  const res = await callGhostiServerBridge<{
    roomId?: string;
    roomTitle?: string;
    hostNickname?: string;
    role?: 'host' | 'editor';
  }>('work_accept_invite', {
    inviteToken: cleanTok,
    nickname: (opts.nickname || '팀원').trim(),
  });
  return {
    ok: Boolean(res.ok && res.roomId),
    roomId: res.roomId,
    roomTitle: res.roomTitle,
    hostNickname: res.hostNickname,
    role: res.role,
  };
}

export function readCachedMyWorkRoomMeta(): {
  roomId: string;
  inviteToken: string;
  roomTitle: string;
  hostNickname: string;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(MY_WORK_ROOM_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      roomId?: string;
      inviteToken?: string;
      roomTitle?: string;
      hostNickname?: string;
    };
    if (parsed?.roomId && parsed?.inviteToken) {
      return {
        roomId: parsed.roomId,
        inviteToken: parsed.inviteToken,
        roomTitle: parsed.roomTitle || '💼 우리팀 업무 공유방 (S:)',
        hostNickname: parsed.hostNickname || '방장',
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function mountWorkSDriveNative(opts?: {
  action?: 'mount' | 'unmount';
  openExplorer?: boolean;
  targetDir?: string;
}): Promise<{
  ok: boolean;
  mounted?: boolean;
  targetDir?: string;
  message?: string;
}> {
  const url = resolveWorkApiUrl('/__work/s-drive');
  if (!url) return { ok: false };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: opts?.action || 'mount',
        openExplorer: Boolean(opts?.openExplorer),
        ...(opts?.targetDir ? { targetDir: opts.targetDir } : {}),
      }),
    });
    if (!res.ok) return { ok: false };
    return (await res.json()) as {
      ok: boolean;
      mounted?: boolean;
      targetDir?: string;
      message?: string;
    };
  } catch {
    return { ok: false };
  }
}

export function mapRawWorkFileToDto(rf: Record<string, unknown>, idx: number): WorkLoungeDocDto {
  const name = String(rf.name || rf.fileName || `업무파일_${idx + 1}`);
  const relPath = String(rf.relPath || name).replace(/\\/g, '/').replace(/^\/+/, '');
  const ext = String(rf.ext || name.split('.').pop() || 'FILE').toUpperCase();
  const byteSize = Number(rf.size ?? rf.byteSize ?? 0);
  const sizeLabel = String(rf.sizeFormatted || rf.sizeLabel || formatBytesLabel(byteSize));
  const mtimeIso = String(rf.mtime || rf.fileMtimeIso || rf.fileMtime || new Date().toISOString());
  const updatedAt = String(rf.mtimeFormatted || formatMtimeKo(mtimeIso));
  const folderId = String(rf.folderId || 'root');
  const folderPath = String(rf.folderPath || 'S:\\');
  const author = String(rf.author || rf.uploaderNickname || '팀원');
  const lockedBy = rf.lockedBy ? String(rf.lockedBy) : null;
  const isImage = Boolean(rf.isImage);
  const previewText = String(rf.previewText || rf.fullTextPreview || '').trim();
  const rawHeaders = Array.isArray(rf.tableHeaders) ? (rf.tableHeaders as string[]) : [];
  const rawRows = Array.isArray(rf.tableRows) ? (rf.tableRows as string[][]) : [];

  const defaultSnippet = isImage
    ? `현장·증빙 이미지: ${name} (${sizeLabel}) — 실시간 미리보기 지원`
    : previewText
    ? previewText.slice(0, 160).replace(/\s+/g, ' ')
    : `S: 드라이브 공유 문서 — ${relPath}`;

  return {
    id: `work-${relPath}`,
    relPath,
    folderId,
    folderPath,
    fileName: name,
    ext,
    byteSize,
    sizeLabel,
    updatedAt,
    fileMtimeIso: mtimeIso,
    author,
    lockedBy,
    sha256: String(rf.sha256 || `${byteSize}_${mtimeIso}`),
    cacheSizeLabel: zCoreBridge.isConnected ? 'S:\\ 실시간 직결' : '웹 미리보기 동기화됨',
    summaryTitle: String(
      rf.summaryTitle || (isImage ? `[이미지 미리보기] ${name}` : `[문서 미리보기] ${name}`)
    ),
    matchedSnippet: String(rf.matchedSnippet || defaultSnippet),
    tableHeaders: rawHeaders.length > 0 ? rawHeaders : ['속성', '상세 정보'],
    tableRows:
      rawRows.length > 0
        ? rawRows
        : [
            ['파일명', name],
            ['경로', `${folderPath}\\${name}`],
            ['용량', sizeLabel],
            ['최근 수정일', updatedAt],
          ],
    fullTextPreview:
      previewText ||
      (isImage
        ? `[현장·증빙 이미지 미리보기 지원] ${name}`
        : `S: 드라이브에 보관된 ${name} 원본 문서입니다.`),
    isImage,
    imageBase64: rf.imageBase64 ? String(rf.imageBase64) : undefined,
    inlineSyncBase64: rf.syncBase64
      ? String(rf.syncBase64)
      : rf.inlineSyncBase64
      ? String(rf.inlineSyncBase64)
      : undefined,
    hasCloudBlob: Boolean(rf.hasCloudBlob),
  };
}

export async function fetchLocalWorkFilesNative(opts?: {
  includeSyncBase64?: boolean;
  author?: string;
}): Promise<{
  ok: boolean;
  mounted: boolean;
  targetDir?: string;
  docs: WorkLoungeDocDto[];
  locallyDeletedRelPaths: string[];
}> {
  const base = resolveWorkApiUrl('/__work/files');
  if (!base) {
    return { ok: false, mounted: false, docs: [], locallyDeletedRelPaths: [] };
  }
  try {
    const qs = new URLSearchParams();
    if (opts?.includeSyncBase64) qs.set('includeSyncBase64', '1');
    if (opts?.author) qs.set('author', opts.author);
    const fullUrl = qs.toString() ? `${base}?${qs.toString()}` : base;
    const res = await fetch(fullUrl);
    if (!res.ok) return { ok: false, mounted: false, docs: [], locallyDeletedRelPaths: [] };
    const data = (await res.json()) as {
      ok?: boolean;
      mounted?: boolean;
      targetDir?: string;
      files?: Array<Record<string, unknown>>;
      locallyDeletedRelPaths?: string[];
    };
    if (!data?.ok || !Array.isArray(data.files)) {
      return { ok: false, mounted: false, docs: [], locallyDeletedRelPaths: [] };
    }
    return {
      ok: true,
      mounted: Boolean(data.mounted),
      targetDir: data.targetDir,
      docs: data.files.map((rf, i) => mapRawWorkFileToDto(rf, i)),
      locallyDeletedRelPaths: Array.isArray(data.locallyDeletedRelPaths)
        ? data.locallyDeletedRelPaths
        : [],
    };
  } catch {
    return { ok: false, mounted: false, docs: [], locallyDeletedRelPaths: [] };
  }
}

export async function uploadWorkFileToNativeSDrive(opts: {
  file: File;
  folderId?: string;
  author?: string;
}): Promise<{ ok: boolean; relPath?: string; sDrivePath?: string; error?: string }> {
  const url = resolveWorkApiUrl('/__work/upload');
  if (!url) {
    return { ok: false, error: 'ZCORE_NOT_CONNECTED' };
  }
  const base64Data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(opts.file);
  });
  if (!base64Data) {
    return { ok: false, error: 'READ_FILE_FAILED' };
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: opts.file.name,
        folderId: opts.folderId && opts.folderId !== 'all' ? opts.folderId : '',
        base64Data,
        author: opts.author || '',
      }),
    });
    return (await res.json()) as { ok: boolean; relPath?: string; sDrivePath?: string; error?: string };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * 512KB 초과 ~ 50MB 대용량 로컬 S:\ 파일들을 서명 업로드 URL을 통해 클라우드 금고에 자동 업로드합니다.
 */
async function pushLargeWorkBlobsIfNeeded(roomId: string, docs: WorkLoungeDocDto[]): Promise<boolean> {
  if (!zCoreBridge.isConnected || !roomId || !hasAuthenticatedHubAccountSession()) {
    return false;
  }
  let uploadedAny = false;
  for (const d of docs) {
    if (d.inlineSyncBase64 || d.byteSize <= 512 * 1024 || d.byteSize > 50 * 1024 * 1024 || !d.sha256) {
      continue;
    }
    const cacheKey = `${roomId}::${d.sha256}`;
    if (uploadedCloudBlobKeys.has(cacheKey)) continue;

    const signRes = await callGhostiServerBridge<{
      alreadyUploaded?: boolean;
      signedUploadUrl?: string;
    }>('work_sign_upload', {
      roomId,
      sha256: d.sha256,
      relPath: d.relPath,
    });

    if (!signRes.ok) continue;
    if (signRes.alreadyUploaded) {
      uploadedCloudBlobKeys.add(cacheKey);
      continue;
    }
    if (!signRes.signedUploadUrl) continue;

    try {
      const pushRes = await fetch(getZCoreUrl('/__work/push-blob'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relPath: d.relPath,
          signedUploadUrl: signRes.signedUploadUrl,
        }),
      });
      const pj = (await pushRes.json().catch(() => ({}))) as { ok?: boolean };
      if (pj.ok) {
        uploadedCloudBlobKeys.add(cacheKey);
        uploadedAny = true;
        await callGhostiServerBridge('work_mark_blob_uploaded', {
          roomId,
          relPath: d.relPath,
        });
      }
    } catch {
      /* retry next cycle */
    }
  }
  return uploadedAny;
}

export async function pullSyncRemoteWorkFilesToLocalSDrive(
  remoteDocs: WorkLoungeDocDto[],
  opts?: {
    roomId?: string;
    inviteToken?: string;
    deletedTombstones?: WorkDeletedTombstoneMap;
  }
): Promise<{ ok: boolean; syncedCount: number; removedCount: number }> {
  if (!zCoreBridge.isConnected) {
    return { ok: false, syncedCount: 0, removedCount: 0 };
  }
  const tombstones = opts?.deletedTombstones || {};
  const inlineItems = remoteDocs
    .filter((d) => Boolean(d.inlineSyncBase64) && !tombstones[d.relPath])
    .map((d) => ({
      relPath: d.relPath,
      sha256: d.sha256,
      fileMtimeIso: d.fileMtimeIso,
      uploaderNickname: d.author,
      base64Data: d.inlineSyncBase64,
    }));

  let syncedTotal = 0;
  let removedTotal = 0;

  if (inlineItems.length > 0 || Object.keys(tombstones).length > 0) {
    try {
      const res = await fetch(getZCoreUrl('/__work/pull-sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: inlineItems,
          deletedTombstones: tombstones,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          ok?: boolean;
          syncedCount?: number;
          removedByTombstoneCount?: number;
        };
        syncedTotal += Number(json?.syncedCount || 0);
        removedTotal += Number(json?.removedByTombstoneCount || 0);
      }
    } catch {
      /* ignore */
    }
  }

  // 512KB 초과 대용량 업무 파일(1~50MB 엑셀·계약서 PDF·현장사진) 서명 다운로드 동기화
  const roomId = opts?.roomId || '';
  if (roomId) {
    const largeDocs = remoteDocs.filter(
      (d) =>
        !d.inlineSyncBase64 &&
        !tombstones[d.relPath] &&
        Boolean(d.sha256) &&
        (d.hasCloudBlob || d.byteSize > 512 * 1024)
    );
    for (const ld of largeDocs.slice(0, 20)) {
      const dlSign = await callGhostiServerBridge<{ signedDownloadUrl?: string }>(
        'work_sign_download',
        {
          roomId,
          sha256: ld.sha256,
          inviteToken: opts?.inviteToken || '',
        },
        { allowAnonymous: Boolean(opts?.inviteToken) }
      );
      if (!dlSign.ok || !dlSign.signedDownloadUrl) continue;
      try {
        const pr = await fetch(getZCoreUrl('/__work/pull-blob'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relPath: ld.relPath,
            signedDownloadUrl: dlSign.signedDownloadUrl,
            sha256: ld.sha256,
            fileMtimeIso: ld.fileMtimeIso,
            uploaderNickname: ld.author,
          }),
        });
        const pj = (await pr.json().catch(() => ({}))) as {
          ok?: boolean;
          alreadySynced?: boolean;
          skippedNewerLocal?: boolean;
        };
        if (pj.ok && !pj.alreadySynced && !pj.skippedNewerLocal) {
          syncedTotal += 1;
        }
      } catch {
        /* ignore */
      }
    }
  }

  return { ok: true, syncedCount: syncedTotal, removedCount: removedTotal };
}

export async function downloadWorkFileOriginal(
  doc: WorkLoungeDocDto,
  opts?: { roomId?: string; inviteToken?: string }
): Promise<boolean> {
  if (zCoreBridge.isConnected) {
    try {
      const res = await fetch(
        getZCoreUrl(`/__work/download?relPath=${encodeURIComponent(doc.relPath)}`)
      );
      if (res.ok) {
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = doc.fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(objUrl), 3000);
        return true;
      }
    } catch {
      /* fallback below */
    }
  }
  if (opts?.roomId && doc.sha256) {
    const dlSign = await callGhostiServerBridge<{ signedDownloadUrl?: string }>(
      'work_sign_download',
      {
        roomId: opts.roomId,
        sha256: doc.sha256,
        inviteToken: opts.inviteToken || '',
      },
      { allowAnonymous: Boolean(opts.inviteToken) }
    );
    if (dlSign.ok && dlSign.signedDownloadUrl) {
      window.open(dlSign.signedDownloadUrl, '_blank', 'noopener,noreferrer');
      return true;
    }
  }
  if (doc.inlineSyncBase64) {
    try {
      const raw = doc.inlineSyncBase64.includes(',')
        ? doc.inlineSyncBase64.split(',', 2)[1]
        : doc.inlineSyncBase64;
      const bin = atob(raw);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) {
        bytes[i] = bin.charCodeAt(i);
      }
      const blob = new Blob([bytes]);
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(objUrl), 3000);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function deleteWorkFileShared(opts: {
  roomId?: string;
  relPath: string;
  actorNickname?: string;
}): Promise<{ ok: boolean; deletedTombstones?: WorkDeletedTombstoneMap }> {
  const cleanRel = (opts.relPath || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!cleanRel) return { ok: false };

  if (zCoreBridge.isConnected) {
    try {
      await fetch(getZCoreUrl('/__work/delete-file'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relPath: cleanRel }),
      });
    } catch {
      /* ignore */
    }
  }

  if (opts.roomId && hasAuthenticatedHubAccountSession()) {
    const srv = await callGhostiServerBridge<{ deletedTombstones?: WorkDeletedTombstoneMap }>(
      'work_delete_file',
      {
        roomId: opts.roomId,
        relPath: cleanRel,
        actorNickname: opts.actorNickname || '팀원',
      }
    );
    return { ok: Boolean(srv.ok), deletedTombstones: srv.deletedTombstones };
  }
  return { ok: true };
}

export async function toggleHideWorkFileNative(relPath: string): Promise<boolean> {
  if (!zCoreBridge.isConnected) return false;
  try {
    const res = await fetch(getZCoreUrl('/__work/toggle-hide'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relPath }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function openGhostSearchForWorkSDrive(query?: string): Promise<boolean> {
  if (!zCoreBridge.isConnected) return false;
  const cleanQ = (query || '').trim();
  try {
    const res = await fetch(getZCoreUrl('/__merlin/open-ghost-search'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: cleanQ ? 'medium' : 'small',
        query: cleanQ,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const LOCAL_WORK_PREVIEW_PREFIX = 'ghosti_work_preview_cache_v2::';

export async function cacheWorkRoomPreviewLocally(
  roomId: string,
  docs: WorkLoungeDocDto[]
): Promise<void> {
  if (typeof window === 'undefined' || !roomId) return;
  try {
    const slim = docs.slice(0, 60).map((d) => ({
      ...d,
      inlineSyncBase64: undefined,
      imageBase64: d.imageBase64 && d.imageBase64.length <= 45_000 ? d.imageBase64 : undefined,
    }));
    localStorage.setItem(`${LOCAL_WORK_PREVIEW_PREFIX}${roomId}`, JSON.stringify(slim));
  } catch {
    /* ignore quota */
  }
}

export async function loadCachedWorkRoomPreview(roomId: string): Promise<WorkLoungeDocDto[]> {
  if (typeof window === 'undefined' || !roomId) return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_WORK_PREVIEW_PREFIX}${roomId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WorkLoungeDocDto[]) : [];
  } catch {
    return [];
  }
}

export async function fetchWorkRoomCloudPreview(inviteToken: string): Promise<{
  ok: boolean;
  roomTitle?: string;
  hostNickname?: string;
  docs: WorkLoungeDocDto[];
  deletedTombstones: WorkDeletedTombstoneMap;
}> {
  const cleanToken = (inviteToken || '').trim();
  if (!cleanToken) return { ok: false, docs: [], deletedTombstones: {} };
  const res = await callGhostiServerBridge<{
    room?: { roomTitle?: string; hostNickname?: string };
    files?: Array<Record<string, unknown>>;
    deletedTombstones?: WorkDeletedTombstoneMap;
  }>('work_get_preview', { inviteToken: cleanToken }, { allowAnonymous: true });

  if (!res.ok || !Array.isArray(res.files)) {
    return { ok: false, docs: [], deletedTombstones: {} };
  }
  return {
    ok: true,
    roomTitle: res.room?.roomTitle,
    hostNickname: res.room?.hostNickname,
    docs: res.files.map((f, idx) => mapRawWorkFileToDto(f, idx)),
    deletedTombstones: res.deletedTombstones || {},
  };
}

export async function fetchWorkRoomAuthedState(
  roomId: string,
  inviteToken?: string
): Promise<{
  ok: boolean;
  docs: WorkLoungeDocDto[];
  deletedTombstones: WorkDeletedTombstoneMap;
}> {
  if (!roomId || !hasAuthenticatedHubAccountSession()) {
    return { ok: false, docs: [], deletedTombstones: {} };
  }
  const res = await callGhostiServerBridge<{
    files?: Array<Record<string, unknown>>;
    deletedTombstones?: WorkDeletedTombstoneMap;
  }>('work_get_room_state', { roomId, inviteToken: inviteToken || '' });

  if (!res.ok || !Array.isArray(res.files)) {
    return { ok: false, docs: [], deletedTombstones: {} };
  }
  return {
    ok: true,
    docs: res.files.map((f, idx) => mapRawWorkFileToDto(f, idx)),
    deletedTombstones: res.deletedTombstones || {},
  };
}

export async function upsertWorkFilesToSupabase(opts: {
  roomId: string;
  docs: WorkLoungeDocDto[];
  actorNickname: string;
}): Promise<{
  ok: boolean;
  mergedDocs?: WorkLoungeDocDto[];
  deletedTombstones?: WorkDeletedTombstoneMap;
  uploadedLargeBlob?: boolean;
}> {
  if (!opts.roomId || opts.docs.length === 0 || !hasAuthenticatedHubAccountSession()) {
    return { ok: false };
  }
  const res = await callGhostiServerBridge<{
    files?: Array<Record<string, unknown>>;
    deletedTombstones?: WorkDeletedTombstoneMap;
  }>('work_upsert_files', {
    roomId: opts.roomId,
    actorNickname: opts.actorNickname,
    docs: opts.docs.slice(0, 120),
  });

  const uploadedLargeBlob = await pushLargeWorkBlobsIfNeeded(opts.roomId, opts.docs);
  return {
    ok: Boolean(res.ok),
    mergedDocs: Array.isArray(res.files)
      ? res.files.map((f, idx) => mapRawWorkFileToDto(f, idx))
      : undefined,
    deletedTombstones: res.deletedTombstones,
    uploadedLargeBlob,
  };
}

export function connectWorkRoomRealtimeChannel(opts: {
  roomId: string;
  peerId: string;
  nickname: string;
  role: 'host' | 'editor' | 'viewer';
  getLocalDocs: () => WorkLoungeDocDto[];
  onRemoteSnapshot: (docs: WorkLoungeDocDto[]) => void;
  onRemoteFileDeleted: (relPath: string, deletedAt: string) => void;
  onRemoteLockMap: (locksByRelPath: Record<string, string | null>) => void;
  onPresenceMembers: (members: WorkRoomPresenceMember[]) => void;
}): {
  broadcastSnapshot: (docs: WorkLoungeDocDto[]) => void;
  broadcastFileDeleted: (relPath: string, deletedAt: string) => void;
  broadcastLocks: (locksByRelPath: Record<string, string | null>) => void;
  dispose: () => void;
} {
  let channel: RealtimeChannel | null = null;
  let disposed = false;

  const stripHeavyPayload = (docs: WorkLoungeDocDto[]) =>
    docs.slice(0, 80).map((d) => ({
      ...d,
      // Realtime WebSocket 프레임 한도 보호: 120KB 초과 Base64는 제외하고 서명 다운로드(hasCloudBlob)로 안전 수신
      inlineSyncBase64:
        d.inlineSyncBase64 && d.inlineSyncBase64.length <= 120_000
          ? d.inlineSyncBase64
          : undefined,
      hasCloudBlob: Boolean(d.hasCloudBlob || d.byteSize > 512 * 1024),
    }));

  const start = async () => {
    const ok = hasAuthenticatedHubAccountSession()
      ? await ensureGhostiAuthedSupabaseClient()
      : await ensureGhostiPublicSupabaseClient();
    if (!ok || disposed || !supabase) return;
    const sbClient = supabase;

    channel = sbClient.channel(`ghosti:room:${opts.roomId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: opts.peerId },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        if (!channel || disposed) return;
        const state = channel.presenceState<WorkRoomPresenceMember>();
        const list: WorkRoomPresenceMember[] = [];
        for (const entries of Object.values(state)) {
          if (Array.isArray(entries) && entries[0]) {
            list.push(entries[0]);
          }
        }
        opts.onPresenceMembers(list);
      })
      .on('broadcast', { event: 'REQUEST_WORK_SNAPSHOT' }, () => {
        if (!channel || disposed) return;
        const curDocs = opts.getLocalDocs();
        if (curDocs.length > 0) {
          void channel.send({
            type: 'broadcast',
            event: 'WORK_SNAPSHOT',
            payload: { sender: opts.peerId, docs: stripHeavyPayload(curDocs) },
          });
        }
      })
      .on('broadcast', { event: 'WORK_SNAPSHOT' }, ({ payload }) => {
        if (disposed || !payload?.docs || !Array.isArray(payload.docs)) return;
        opts.onRemoteSnapshot(payload.docs as WorkLoungeDocDto[]);
      })
      .on('broadcast', { event: 'WORK_FILE_DELETED' }, ({ payload }) => {
        if (disposed || !payload?.relPath) return;
        opts.onRemoteFileDeleted(
          String(payload.relPath),
          String(payload.deletedAt || new Date().toISOString())
        );
      })
      .on('broadcast', { event: 'WORK_LOCK_UPDATE' }, ({ payload }) => {
        if (disposed || !payload?.locks) return;
        opts.onRemoteLockMap(payload.locks as Record<string, string | null>);
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED' || !channel || disposed) return;
        await channel.track({
          peerId: opts.peerId,
          nickname: opts.nickname,
          role: opts.role,
          sDriveConnected: zCoreBridge.isConnected,
          onlineAt: new Date().toISOString(),
        });
        void channel.send({
          type: 'broadcast',
          event: 'REQUEST_WORK_SNAPSHOT',
          payload: { requester: opts.peerId },
        });
        const curDocs = opts.getLocalDocs();
        if (curDocs.length > 0) {
          void channel.send({
            type: 'broadcast',
            event: 'WORK_SNAPSHOT',
            payload: { sender: opts.peerId, docs: stripHeavyPayload(curDocs) },
          });
        }
      });
  };

  void start();

  return {
    broadcastSnapshot: (docs: WorkLoungeDocDto[]) => {
      if (!channel || disposed) return;
      void channel.send({
        type: 'broadcast',
        event: 'WORK_SNAPSHOT',
        payload: { sender: opts.peerId, docs: stripHeavyPayload(docs) },
      });
    },
    broadcastFileDeleted: (relPath: string, deletedAt: string) => {
      if (!channel || disposed) return;
      void channel.send({
        type: 'broadcast',
        event: 'WORK_FILE_DELETED',
        payload: { sender: opts.peerId, relPath, deletedAt },
      });
    },
    broadcastLocks: (locksByRelPath: Record<string, string | null>) => {
      if (!channel || disposed) return;
      void channel.send({
        type: 'broadcast',
        event: 'WORK_LOCK_UPDATE',
        payload: { sender: opts.peerId, locks: locksByRelPath },
      });
    },
    dispose: () => {
      disposed = true;
      if (channel && supabase) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    },
  };
}
