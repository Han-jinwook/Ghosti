import {
  decryptClipboardE2ee,
  encryptClipboardE2ee,
  getThisDeviceIdentity,
} from '@shared/services/deviceIntegrationService';
import {
  callGhostiServerBridge,
  hasAuthenticatedHubAccountSession,
} from '@shared/services/supabaseClient';
import { getZCoreUrl, zCoreBridge } from '@shared/services/zCoreBridge';

function loadCanonicalE2eeUid(email: string): string {
  try {
    return (localStorage.getItem(`ghosti_e2ee_canonical_uid_${email.trim().toLowerCase()}`) || '').trim();
  } catch {
    return '';
  }
}

export async function syncEncryptedSnippetsWithCloud(opts: {
  email: string;
  userId: string;
  direction?: 'auto' | 'push' | 'pull';
  localSnippetsOverride?: Record<string, string>;
}): Promise<{
  ok: boolean;
  snippets: Record<string, string>;
  updatedAt?: string | null;
  reason?: string;
}> {
  if (!hasAuthenticatedHubAccountSession()) {
    return { ok: false, snippets: {}, reason: 'AUTH_REQUIRED' };
  }
  const normEmail = opts.email.trim().toLowerCase();
  const ident = getThisDeviceIdentity();
  const cachedUid = loadCanonicalE2eeUid(normEmail);
  const activeUid = cachedUid || opts.userId;

  let localSnippets: Record<string, string> = opts.localSnippetsOverride || {};
  if (Object.keys(localSnippets).length === 0 && zCoreBridge.isConnected) {
    try {
      const r = await fetch(getZCoreUrl('/api/superpower/snippets'), { method: 'GET' });
      const j = (await r.json().catch(() => ({}))) as { snippets?: Record<string, string> };
      if (j && j.snippets && typeof j.snippets === 'object') {
        localSnippets = j.snippets;
      }
    } catch {
      /* ignore */
    }
  }

  const pullRes = await callGhostiServerBridge<{
    cipherB64?: string;
    ivB64?: string;
    updatedAt?: string | null;
    reason?: string;
  }>('device_sync_snippets', { mode: 'pull' });

  if (!pullRes.ok) {
    return { ok: false, snippets: localSnippets, reason: pullRes.reason };
  }

  let remoteSnippets: Record<string, string> = {};
  if (pullRes.cipherB64 && pullRes.ivB64) {
    const plain = await decryptClipboardE2ee(
      pullRes.cipherB64,
      pullRes.ivB64,
      normEmail,
      activeUid,
      cachedUid && cachedUid !== opts.userId ? [opts.userId] : undefined
    );
    if (plain) {
      try {
        const parsed = JSON.parse(plain);
        if (parsed && typeof parsed === 'object') {
          remoteSnippets = parsed as Record<string, string>;
        }
      } catch {
        /* ignore */
      }
    }
  }

  const mergedSnippets: Record<string, string> = {
    ...remoteSnippets,
    ...(opts.direction === 'pull' ? {} : localSnippets),
  };

  if (
    (opts.direction === 'push' ||
      (opts.direction !== 'pull' && Object.keys(localSnippets).length > 0)) &&
    Object.keys(mergedSnippets).length > 0
  ) {
    const enc = await encryptClipboardE2ee(JSON.stringify(mergedSnippets), normEmail, activeUid);
    const pushRes = await callGhostiServerBridge<{ updatedAt?: string; reason?: string }>(
      'device_sync_snippets',
      {
        mode: 'push',
        cipherB64: enc.cipherB64,
        ivB64: enc.ivB64,
        deviceId: ident.deviceId,
        deviceName: ident.displayName,
      }
    );
    if (!pushRes.ok) {
      return { ok: false, snippets: mergedSnippets, reason: pushRes.reason };
    }
    try {
      localStorage.setItem(`ghosti_synced_snippets_${normEmail}`, JSON.stringify(mergedSnippets));
    } catch {
      /* ignore */
    }
    return { ok: true, snippets: mergedSnippets, updatedAt: pushRes.updatedAt || new Date().toISOString() };
  }

  if (Object.keys(mergedSnippets).length > 0) {
    try {
      localStorage.setItem(`ghosti_synced_snippets_${normEmail}`, JSON.stringify(mergedSnippets));
    } catch {
      /* ignore */
    }
    if (zCoreBridge.isConnected && Object.keys(remoteSnippets).length > 0) {
      try {
        await fetch(getZCoreUrl('/api/superpower/snippets'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snippets: mergedSnippets }),
        });
      } catch {
        /* ignore */
      }
    }
  }
  return { ok: true, snippets: mergedSnippets, updatedAt: pullRes.updatedAt || null };
}
