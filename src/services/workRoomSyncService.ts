import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  ensureGhostiAuthedSupabaseClient,
  ensureGhostiPublicSupabaseClient,
  hasAuthenticatedHubAccountSession,
  readGhostiAuthedJwtClaims,
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

const WORK_INVITE_SESSION_KEY = 'ghosti_active_work_room_invite_v1';
const MY_WORK_ROOM_CACHE_KEY = 'ghosti_my_work_room_meta_v1';

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
    const urlToken = (params.get('token') || '').trim();
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
  const authedOk = await ensureGhostiAuthedSupabaseClient();
  if (!authedOk || !supabase) {
    return { ok: false, reason: 'SUPABASE_AUTH_BRIDGE_FAILED' };
  }

  const roomTitle = (opts.roomTitle || '💼 우리팀 업무 공유방 (S:)').trim();
  const hostNickname = (opts.hostNickname || '방장').trim();

  const { data, error } = await supabase.rpc('ghosti_ensure_room_and_invite', {
    p_lounge_type: 'work',
    p_sub_type: null,
    p_room_title: roomTitle,
    p_master_nickname: hostNickname,
  });

  if (error || !data) {
    return { ok: false, reason: error?.message || 'RPC_FAILED' };
  }

  const rpcRes = data as { ok?: boolean; roomId?: string; inviteToken?: string };
  if (!rpcRes.ok || !rpcRes.roomId || !rpcRes.inviteToken) {
    return { ok: false, reason: 'INVALID_RPC_PAYLOAD' };
  }

  try {
    localStorage.setItem(
      MY_WORK_ROOM_CACHE_KEY,
      JSON.stringify({
        roomId: rpcRes.roomId,
        inviteToken: rpcRes.inviteToken,
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
    workRoom: rpcRes.roomId,
    token: rpcRes.inviteToken,
    host: hostNickname,
    title: roomTitle,
  });

  return {
    ok: true,
    roomId: rpcRes.roomId,
    inviteToken: rpcRes.inviteToken,
    inviteUrl: `${origin}/?${qs.toString()}`,
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
  const relPath = String(rf.relPath || name).replace(/\\/g, '/');
  const ext = String(rf.ext || name.split('.').pop() || 'FILE').toUpperCase();
  const byteSize = Number(rf.size ?? rf.byteSize ?? 0);
  const sizeLabel = String(rf.sizeFormatted || formatBytesLabel(byteSize));
  const mtimeIso = String(rf.mtime || rf.fileMtime || new Date().toISOString());
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
}> {
  const base = resolveWorkApiUrl('/__work/files');
  if (!base) {
    return { ok: false, mounted: false, docs: [] };
  }
  try {
    const qs = new URLSearchParams();
    if (opts?.includeSyncBase64) qs.set('includeSyncBase64', '1');
    if (opts?.author) qs.set('author', opts.author);
    const fullUrl = qs.toString() ? `${base}?${qs.toString()}` : base;
    const res = await fetch(fullUrl);
    if (!res.ok) return { ok: false, mounted: false, docs: [] };
    const data = (await res.json()) as {
      ok?: boolean;
      mounted?: boolean;
      targetDir?: string;
      files?: Array<Record<string, unknown>>;
    };
    if (!data?.ok || !Array.isArray(data.files)) {
      return { ok: false, mounted: false, docs: [] };
    }
    return {
      ok: true,
      mounted: Boolean(data.mounted),
      targetDir: data.targetDir,
      docs: data.files.map((rf, i) => mapRawWorkFileToDto(rf, i)),
    };
  } catch {
    return { ok: false, mounted: false, docs: [] };
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

export async function pullSyncRemoteWorkFilesToLocalSDrive(
  remoteDocs: WorkLoungeDocDto[]
): Promise<{ ok: boolean; syncedCount: number }> {
  if (!zCoreBridge.isConnected || remoteDocs.length === 0) {
    return { ok: false, syncedCount: 0 };
  }
  const syncable = remoteDocs
    .filter((d) => Boolean(d.inlineSyncBase64))
    .map((d) => ({
      relPath: d.relPath,
      sha256: d.sha256,
      uploaderNickname: d.author,
      base64Data: d.inlineSyncBase64,
    }));
  if (syncable.length === 0) {
    return { ok: true, syncedCount: 0 };
  }
  try {
    const res = await fetch(getZCoreUrl('/__work/pull-sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: syncable }),
    });
    if (!res.ok) return { ok: false, syncedCount: 0 };
    const json = (await res.json()) as { ok?: boolean; syncedCount?: number };
    return { ok: Boolean(json?.ok), syncedCount: Number(json?.syncedCount || 0) };
  } catch {
    return { ok: false, syncedCount: 0 };
  }
}

export async function downloadWorkFileOriginal(doc: WorkLoungeDocDto): Promise<boolean> {
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

export async function fetchWorkRoomCloudPreview(inviteToken: string): Promise<{
  ok: boolean;
  roomTitle?: string;
  hostNickname?: string;
  docs: WorkLoungeDocDto[];
}> {
  const cleanToken = (inviteToken || '').trim();
  if (!cleanToken) return { ok: false, docs: [] };
  const pubOk = await ensureGhostiPublicSupabaseClient();
  if (!pubOk || !supabase) return { ok: false, docs: [] };
  try {
    const { data, error } = await supabase.rpc('ghosti_get_work_room_preview', {
      p_invite_token: cleanToken,
    });
    if (error || !data) return { ok: false, docs: [] };
    const payload = data as {
      ok?: boolean;
      room?: { roomTitle?: string; hostNickname?: string };
      files?: Array<Record<string, unknown>>;
    };
    if (!payload.ok || !Array.isArray(payload.files)) {
      return { ok: false, docs: [] };
    }
    return {
      ok: true,
      roomTitle: payload.room?.roomTitle,
      hostNickname: payload.room?.hostNickname,
      docs: payload.files.map((f, idx) => mapRawWorkFileToDto(f, idx)),
    };
  } catch {
    return { ok: false, docs: [] };
  }
}

let workTableMissingFlag = false;

export async function upsertWorkFilesToSupabase(opts: {
  roomId: string;
  docs: WorkLoungeDocDto[];
  actorNickname: string;
}): Promise<void> {
  if (workTableMissingFlag || !opts.roomId || opts.docs.length === 0) return;
  if (!hasAuthenticatedHubAccountSession()) return;
  const authedOk = await ensureGhostiAuthedSupabaseClient();
  if (!authedOk || !supabase) return;
  const claims = readGhostiAuthedJwtClaims();
  const actorEmail = (claims?.email || '').trim().toLowerCase();
  if (!actorEmail) return;

  const rows = opts.docs.slice(0, 120).map((d) => ({
    room_id: opts.roomId,
    rel_path: d.relPath,
    folder_id: d.folderId,
    folder_path: d.folderPath,
    file_name: d.fileName,
    file_ext: d.ext,
    byte_size: d.byteSize,
    sha256_hex: d.sha256,
    uploader_email: actorEmail,
    uploader_nickname: d.author || opts.actorNickname,
    summary_title: d.summaryTitle,
    matched_snippet: d.matchedSnippet.slice(0, 400),
    full_text_preview: d.fullTextPreview.slice(0, 12000),
    table_headers: d.tableHeaders,
    table_rows_json: d.tableRows,
    is_image: Boolean(d.isImage),
    thumb_webp_url: d.imageBase64 && d.imageBase64.length <= 36000 ? d.imageBase64 : null,
    inline_sync_base64:
      d.inlineSyncBase64 && d.inlineSyncBase64.length <= 720000 ? d.inlineSyncBase64 : null,
    locked_by_email: d.lockedBy ? actorEmail : null,
    locked_by_nickname: d.lockedBy,
    locked_at: d.lockedBy ? new Date().toISOString() : null,
    file_mtime: d.fileMtimeIso,
  }));

  try {
    const { error } = await supabase
      .from('ghosti_room_work_files')
      .upsert(rows, { onConflict: 'room_id,rel_path' });
    if (error && (error.code === 'PGRST205' || error.code === '42P01')) {
      workTableMissingFlag = true;
    }
  } catch {
    /* ignore transient network error */
  }
}

export function connectWorkRoomRealtimeChannel(opts: {
  roomId: string;
  peerId: string;
  nickname: string;
  role: 'host' | 'editor' | 'viewer';
  getLocalDocs: () => WorkLoungeDocDto[];
  onRemoteSnapshot: (docs: WorkLoungeDocDto[]) => void;
  onRemoteLockMap: (locksByRelPath: Record<string, string | null>) => void;
  onPresenceMembers: (members: WorkRoomPresenceMember[]) => void;
}): {
  broadcastSnapshot: (docs: WorkLoungeDocDto[]) => void;
  broadcastLocks: (locksByRelPath: Record<string, string | null>) => void;
  requestBinaryFile: (relPath: string) => void;
  dispose: () => void;
} {
  let channel: RealtimeChannel | null = null;
  let disposed = false;

  const start = async () => {
    const ok = hasAuthenticatedHubAccountSession()
      ? await ensureGhostiAuthedSupabaseClient()
      : await ensureGhostiPublicSupabaseClient();
    if (!ok || disposed || !supabase) return;
    const sbClient = supabase;

    channel = sbClient.channel(`ghosti:work:${opts.roomId}`, {
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
            payload: { sender: opts.peerId, docs: curDocs.slice(0, 80) },
          });
        }
      })
      .on('broadcast', { event: 'WORK_SNAPSHOT' }, ({ payload }) => {
        if (disposed || !payload?.docs || !Array.isArray(payload.docs)) return;
        opts.onRemoteSnapshot(payload.docs as WorkLoungeDocDto[]);
      })
      .on('broadcast', { event: 'WORK_LOCK_UPDATE' }, ({ payload }) => {
        if (disposed || !payload?.locks) return;
        opts.onRemoteLockMap(payload.locks as Record<string, string | null>);
      })
      .on('broadcast', { event: 'REQUEST_FILE_BINARY' }, async ({ payload }) => {
        if (!channel || disposed || !zCoreBridge.isConnected) return;
        const relPath = String(payload?.relPath || '').trim();
        if (!relPath) return;
        try {
          const r = await fetch(
            getZCoreUrl(`/__work/file-sync-payload?relPath=${encodeURIComponent(relPath)}`)
          );
          if (!r.ok) return;
          const filePayload = (await r.json()) as {
            ok?: boolean;
            relPath?: string;
            base64Data?: string;
          };
          if (filePayload?.ok && filePayload.base64Data && channel) {
            void channel.send({
              type: 'broadcast',
              event: 'RESPONSE_FILE_BINARY',
              payload: {
                relPath: filePayload.relPath || relPath,
                base64Data: filePayload.base64Data,
                author: opts.nickname,
              },
            });
          }
        } catch {
          /* ignore */
        }
      })
      .on('broadcast', { event: 'RESPONSE_FILE_BINARY' }, async ({ payload }) => {
        if (disposed || !zCoreBridge.isConnected) return;
        const relPath = String(payload?.relPath || '').trim();
        const base64Data = String(payload?.base64Data || '').trim();
        if (!relPath || !base64Data) return;
        await pullSyncRemoteWorkFilesToLocalSDrive([
          {
            id: `sync-${relPath}`,
            relPath,
            folderId: 'root',
            folderPath: 'S:\\',
            fileName: relPath.split('/').pop() || relPath,
            ext: 'FILE',
            byteSize: 0,
            sizeLabel: '',
            updatedAt: '',
            fileMtimeIso: new Date().toISOString(),
            author: String(payload?.author || '방장'),
            lockedBy: null,
            sha256: '',
            cacheSizeLabel: '',
            summaryTitle: '',
            matchedSnippet: '',
            tableHeaders: [],
            tableRows: [],
            fullTextPreview: '',
            inlineSyncBase64: base64Data,
          },
        ]);
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
            payload: { sender: opts.peerId, docs: curDocs.slice(0, 80) },
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
        payload: { sender: opts.peerId, docs: docs.slice(0, 80) },
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
    requestBinaryFile: (relPath: string) => {
      if (!channel || disposed) return;
      void channel.send({
        type: 'broadcast',
        event: 'REQUEST_FILE_BINARY',
        payload: { requester: opts.peerId, relPath },
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
