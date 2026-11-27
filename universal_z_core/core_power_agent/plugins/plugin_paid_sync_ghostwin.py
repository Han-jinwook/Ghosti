#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[5. 📱 내 기기 통합 & ⚡ 귀신창 네이티브 브릿지] plugin_paid_sync_ghostwin.py
- 담당 도메인:
  1) 👑 내 기기 통합 (월 3,900원 / 연간 39,000원 · 2번째 기기 30일 무료체험 D-30):
     - PC Win32 클립보드(CF_UNICODETEXT) 0.22초 상시 감지 · Win32 bcrypt.dll AES-256-GCM 직통 송수신(크롬 백그라운드 절전 0% 영향)
     - 무한 반사(Echo Loop) 원천 차단 해시·시퀀스 가드 및 동시 1계정 단독 점유 정책 준수
     - 스마트폰 ➔ 내 PC 로컬 폴더(Pictures\\Ghosti_Phone_Backup\\<계정폴더>) 100% 원본 미러링 저장
  2) ⚡ 귀신창 초능력 & 귀신검색창 (로컬 127.0.0.1:51988) 생존 상태 점검
- 헌법 가드레일: 본 플러그인 내부에 ONNX/AI 모델(InferenceSession 등) 직접 로드 영구 금지.
"""

from __future__ import annotations

import base64
import ctypes
from datetime import datetime, timezone
import hashlib
import json
import os
import re
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
import urllib.request

try:
    from plugins.plugin_paid_work_sdrive import (  # type: ignore
        _load_sdrive_config,
        check_pc_account_owner_allowed,
    )
except Exception:
    try:
        from .plugin_paid_work_sdrive import (  # type: ignore
            _load_sdrive_config,
            check_pc_account_owner_allowed,
        )
    except Exception:
        def check_pc_account_owner_allowed(req_email: Optional[str]) -> Optional[Dict[str, Any]]:  # type: ignore
            return None

        def _load_sdrive_config() -> Dict[str, Any]:  # type: ignore
            return {}


def sanitize_account_backup_folder(account_email: Optional[str] = None) -> str:
    """계정 이메일을 안전한 하위 폴더명(예: merlin@gmail.com ➔ merlin_gmail.com)으로 변환합니다."""
    clean = str(account_email or "").strip().lower()
    if not clean:
        try:
            local_app = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
            owner_p = Path(local_app) / "Merlin_Z_Core" / "active_pc_account_owner.json"
            if owner_p.exists():
                st = json.loads(owner_p.read_text(encoding="utf-8", errors="ignore"))
                if isinstance(st, dict):
                    clean = str(st.get("activeEmail") or "").strip().lower()
        except Exception:
            clean = ""
    if not clean:
        return ""
    safe = re.sub(r"[^a-z0-9._-]+", "_", clean.replace("@", "_")).strip("._-")
    return safe[:64]


GHOSTWIN_LOCAL_PORT = 51988
CF_UNICODETEXT = 13
GMEM_MOVEABLE = 0x0002
DEFAULT_BRIDGE_URL = "https://ghosti.sundreamer.app/.netlify/functions/hub-supabase-bridge"

SYNC_GHOSTWIN_ACTIONS = {
    "paid-sync-status",
    "ghostwin-status",
    "ghostwin-ping",
    "paid-sync-summon-file",
    "paid-sync-get-clipboard",
    "paid-sync-set-clipboard",
    "paid-sync-auth-context",
    "paid-sync-mirror-pull",
}

_LAST_INJECTED_CLIP_HASH: str = ""
_LAST_INJECTED_CLIP_SEQ: int = -1
_BLOCKED_EXEC_EXTS = {
    ".exe", ".bat", ".cmd", ".ps1", ".vbs", ".vbe", ".js", ".jse",
    ".wsf", ".wsh", ".hta", ".scr", ".msi", ".msp", ".dll", ".com", ".pif", ".reg",
}

# ─── Win32 bcrypt.dll AES-256-GCM (외부 패키지 의존성 0개 · PyInstaller Frozen 100% 호환) ───
class _BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO(ctypes.Structure):
    _fields_ = [
        ("cbSize", ctypes.c_ulong),
        ("dwInfoVersion", ctypes.c_ulong),
        ("pbNonce", ctypes.c_void_p),
        ("cbNonce", ctypes.c_ulong),
        ("pbAuthData", ctypes.c_void_p),
        ("cbAuthData", ctypes.c_ulong),
        ("pbTag", ctypes.c_void_p),
        ("cbTag", ctypes.c_ulong),
        ("pbMacContext", ctypes.c_void_p),
        ("cbMacContext", ctypes.c_ulong),
        ("cbAAD", ctypes.c_ulong),
        ("cbData", ctypes.c_uint64),
        ("dwFlags", ctypes.c_ulong),
    ]


_E2EE_KEY_LOCK = threading.Lock()
_E2EE_KEY_CACHE: Dict[str, bytes] = {}
_AUTH_CTX_LOCK = threading.Lock()
_AUTH_CTX_MEM: Optional[Dict[str, Any]] = None
_PUSH_HTTP_LOCK = threading.Lock()
_PUSH_QUEUE_LOCK = threading.Lock()
_PUSH_QUEUE_EVENT = threading.Event()
_NATIVE_PUSH_QUEUE: List[Dict[str, str]] = []
_PERSISTENT_BRIDGE_CONN: Dict[str, Any] = {"host": "", "conn": None, "last_used": 0.0}
_NATIVE_DAEMON_STARTED = False
_NATIVE_DAEMON_LOCK = threading.Lock()

_LAST_NATIVE_PUSHED_HASH: str = ""
_LAST_NATIVE_PUSHED_TS: float = 0.0
_RECENT_REMOTE_INJECTED_HASHES: Dict[str, float] = {}
_DELIVERED_NATIVE_ENV_KEYS: set[str] = set()
_RECENT_NATIVE_PUSHED_CLIPS: List[Dict[str, Any]] = []
_RECENT_NATIVE_PULLED_CLIPS: List[Dict[str, Any]] = []


def _sha256_text(txt: str) -> str:
    return hashlib.sha256(txt.encode("utf-8", errors="ignore")).hexdigest()


def _format_iso_utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _parse_iso_ms(iso_str: str) -> float:
    s = str(iso_str or "").strip()
    if not s:
        return 0.0
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s).timestamp() * 1000.0
    except Exception:
        return 0.0


def _auth_context_file_path() -> Path:
    local_app = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
    base = Path(local_app) / "Merlin_Z_Core"
    base.mkdir(parents=True, exist_ok=True)
    return base / "clipboard_e2ee_auth_v1.json"


def _derive_e2ee_key32(norm_email: str, norm_uid: str) -> bytes:
    tag = f"{norm_email}::{norm_uid}"
    with _E2EE_KEY_LOCK:
        cached = _E2EE_KEY_CACHE.get(tag)
        if cached is not None:
            return cached
    pw = f"ghosti-e2ee-clip-v1::{norm_email}::{norm_uid}".encode("utf-8")
    salt = f"ghosti-salt-v1::{norm_email}".encode("utf-8")
    derived = hashlib.pbkdf2_hmac("sha256", pw, salt, 60000, 32)
    with _E2EE_KEY_LOCK:
        if len(_E2EE_KEY_CACHE) > 12:
            _E2EE_KEY_CACHE.clear()
        _E2EE_KEY_CACHE[tag] = derived
    return derived


def win32_aes256_gcm_encrypt(key32: bytes, iv12: bytes, plaintext: bytes) -> bytes:
    if os.name != "nt":
        raise RuntimeError("WIN32_REQUIRED")
    bc = ctypes.windll.bcrypt
    h_alg = ctypes.c_void_p()
    st = bc.BCryptOpenAlgorithmProvider(ctypes.byref(h_alg), "AES", None, 0)
    if st != 0:
        raise RuntimeError(f"BCryptOpenAlgorithmProvider failed: {st:#x}")
    try:
        mode = "ChainingModeGCM\x00".encode("utf-16-le")
        st = bc.BCryptSetProperty(h_alg, "ChainingMode", mode, len(mode), 0)
        if st != 0:
            raise RuntimeError(f"BCryptSetProperty failed: {st:#x}")
        h_key = ctypes.c_void_p()
        st = bc.BCryptGenerateSymmetricKey(h_alg, ctypes.byref(h_key), None, 0, key32, len(key32), 0)
        if st != 0:
            raise RuntimeError(f"BCryptGenerateSymmetricKey failed: {st:#x}")
        try:
            nonce_buf = ctypes.create_string_buffer(iv12, len(iv12))
            tag_buf = ctypes.create_string_buffer(16)
            info = _BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO()
            info.cbSize = ctypes.sizeof(_BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO)
            info.dwInfoVersion = 1
            info.pbNonce = ctypes.cast(nonce_buf, ctypes.c_void_p)
            info.cbNonce = len(iv12)
            info.pbTag = ctypes.cast(tag_buf, ctypes.c_void_p)
            info.cbTag = 16

            in_buf = ctypes.create_string_buffer(plaintext, len(plaintext)) if plaintext else ctypes.create_string_buffer(1)
            out_buf = ctypes.create_string_buffer(max(1, len(plaintext)))
            cb_res = ctypes.c_ulong(0)
            st = bc.BCryptEncrypt(
                h_key,
                in_buf if plaintext else None,
                len(plaintext),
                ctypes.byref(info),
                None,
                0,
                out_buf,
                len(plaintext),
                ctypes.byref(cb_res),
                0,
            )
            if st != 0:
                raise RuntimeError(f"BCryptEncrypt failed: {st:#x}")
            return out_buf.raw[: cb_res.value] + tag_buf.raw[:16]
        finally:
            bc.BCryptDestroyKey(h_key)
    finally:
        bc.BCryptCloseAlgorithmProvider(h_alg, 0)


def win32_aes256_gcm_decrypt(key32: bytes, iv12: bytes, cipher_with_tag: bytes) -> bytes:
    if os.name != "nt":
        raise RuntimeError("WIN32_REQUIRED")
    if len(cipher_with_tag) < 16:
        raise ValueError("Ciphertext too short")
    ct = cipher_with_tag[:-16]
    tag = cipher_with_tag[-16:]
    bc = ctypes.windll.bcrypt
    h_alg = ctypes.c_void_p()
    st = bc.BCryptOpenAlgorithmProvider(ctypes.byref(h_alg), "AES", None, 0)
    if st != 0:
        raise RuntimeError(f"BCryptOpenAlgorithmProvider failed: {st:#x}")
    try:
        mode = "ChainingModeGCM\x00".encode("utf-16-le")
        st = bc.BCryptSetProperty(h_alg, "ChainingMode", mode, len(mode), 0)
        if st != 0:
            raise RuntimeError(f"BCryptSetProperty failed: {st:#x}")
        h_key = ctypes.c_void_p()
        st = bc.BCryptGenerateSymmetricKey(h_alg, ctypes.byref(h_key), None, 0, key32, len(key32), 0)
        if st != 0:
            raise RuntimeError(f"BCryptGenerateSymmetricKey failed: {st:#x}")
        try:
            nonce_buf = ctypes.create_string_buffer(iv12, len(iv12))
            tag_buf = ctypes.create_string_buffer(tag, 16)
            info = _BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO()
            info.cbSize = ctypes.sizeof(_BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO)
            info.dwInfoVersion = 1
            info.pbNonce = ctypes.cast(nonce_buf, ctypes.c_void_p)
            info.cbNonce = len(iv12)
            info.pbTag = ctypes.cast(tag_buf, ctypes.c_void_p)
            info.cbTag = 16

            in_buf = ctypes.create_string_buffer(ct, len(ct)) if ct else ctypes.create_string_buffer(1)
            out_buf = ctypes.create_string_buffer(max(1, len(ct)))
            cb_res = ctypes.c_ulong(0)
            st = bc.BCryptDecrypt(
                h_key,
                in_buf if ct else None,
                len(ct),
                ctypes.byref(info),
                None,
                0,
                out_buf,
                len(ct),
                ctypes.byref(cb_res),
                0,
            )
            if st != 0:
                raise RuntimeError(f"BCryptDecrypt failed: {st:#x}")
            return out_buf.raw[: cb_res.value]
        finally:
            bc.BCryptDestroyKey(h_key)
    finally:
        bc.BCryptCloseAlgorithmProvider(h_alg, 0)


def _load_auth_context() -> Dict[str, Any]:
    global _AUTH_CTX_MEM
    with _AUTH_CTX_LOCK:
        if _AUTH_CTX_MEM is not None:
            return dict(_AUTH_CTX_MEM)
        p = _auth_context_file_path()
        if p.exists():
            try:
                loaded = json.loads(p.read_text(encoding="utf-8", errors="ignore"))
                if isinstance(loaded, dict):
                    _AUTH_CTX_MEM = loaded
                    return dict(loaded)
            except Exception:
                pass
        _AUTH_CTX_MEM = {}
        return {}


def _save_auth_context(ctx_obj: Dict[str, Any]) -> None:
    global _AUTH_CTX_MEM
    with _AUTH_CTX_LOCK:
        _AUTH_CTX_MEM = dict(ctx_obj)
        p = _auth_context_file_path()
        try:
            if not ctx_obj:
                if p.exists():
                    p.unlink(missing_ok=True)
            else:
                tmp_p = p.with_name(".clipboard_e2ee_auth_v1.tmp")
                tmp_p.write_text(json.dumps(ctx_obj, ensure_ascii=False), encoding="utf-8")
                os.replace(tmp_p, p)
        except Exception:
            pass


def _is_native_e2ee_ready(expected_email: str = "") -> bool:
    if os.name != "nt":
        return False
    ctx = _load_auth_context()
    email = str(ctx.get("email") or "").strip().lower()
    uid = str(ctx.get("canonicalUserId") or "").strip()
    tok = str(ctx.get("hubToken") or "").strip()
    unlocked = ctx.get("syncUnlocked", True) is not False
    if not email or not uid or not tok or not unlocked:
        return False
    if expected_email and expected_email.strip().lower() != email:
        return False
    if check_pc_account_owner_allowed(email) is not None:
        return False
    return True


def set_clipboard_e2ee_auth_context(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """웹앱에서 로그인·토큰 갱신·로그아웃 시 Z-코어 0.2초 직통 E2EE 클립보드 인증 컨텍스트를 동기화합니다."""
    payload = data or {}
    if payload.get("clear") is True:
        _save_auth_context({})
        _RECENT_NATIVE_PUSHED_CLIPS.clear()
        _RECENT_NATIVE_PULLED_CLIPS.clear()
        _DELIVERED_NATIVE_ENV_KEYS.clear()
        return {"ok": True, "cleared": True, "nativeDirectActive": False}

    norm_email = str(payload.get("email") or payload.get("accountEmail") or "").strip().lower()
    norm_uid = str(payload.get("canonicalUserId") or payload.get("userId") or "").strip()
    hub_tok = str(payload.get("hubToken") or "").strip()
    dev_id = str(payload.get("deviceId") or "").strip()
    dev_name = str(payload.get("deviceName") or "내 Windows PC").strip()[:48]
    raw_url = str(payload.get("bridgeUrl") or "").strip()
    bridge_url = raw_url if raw_url.startswith("https://") else DEFAULT_BRIDGE_URL
    sync_unlocked = payload.get("syncUnlocked", True) is not False

    if not norm_email or not hub_tok:
        _save_auth_context({})
        return {"ok": True, "cleared": True, "nativeDirectActive": False}

    blocked = check_pc_account_owner_allowed(norm_email)
    if blocked is not None:
        return blocked

    prev = _load_auth_context()
    if str(prev.get("email") or "").strip().lower() != norm_email:
        _RECENT_NATIVE_PUSHED_CLIPS.clear()
        _RECENT_NATIVE_PULLED_CLIPS.clear()
        _DELIVERED_NATIVE_ENV_KEYS.clear()

    ctx_obj = {
        "email": norm_email,
        "canonicalUserId": norm_uid or str(prev.get("canonicalUserId") or "").strip(),
        "hubToken": hub_tok,
        "deviceId": dev_id or str(prev.get("deviceId") or "pc-zcore-direct").strip(),
        "deviceName": dev_name,
        "bridgeUrl": bridge_url,
        "syncUnlocked": bool(sync_unlocked),
        "updatedAt": _format_iso_utc_now(),
    }
    _save_auth_context(ctx_obj)

    eff_uid = str(ctx_obj.get("canonicalUserId") or "").strip()
    if eff_uid:
        threading.Thread(
            target=lambda: _derive_e2ee_key32(norm_email, eff_uid),
            daemon=True,
        ).start()
    start_native_clipboard_e2ee_daemon()
    return {
        "ok": True,
        "nativeDirectActive": _is_native_e2ee_ready(norm_email),
        "email": norm_email,
    }


def get_clipboard_e2ee_auth_status(qp: Dict[str, Any] | None = None) -> Dict[str, Any]:
    params = qp or {}
    req_email = str(params.get("email") or "").strip().lower()
    ctx = _load_auth_context()
    cur_email = str(ctx.get("email") or "").strip().lower()
    return {
        "ok": True,
        "nativeDirectActive": _is_native_e2ee_ready(req_email),
        "activeEmail": cur_email,
        "recentNativePushed": list(_RECENT_NATIVE_PUSHED_CLIPS[:12]),
        "recentNativePulled": list(_RECENT_NATIVE_PULLED_CLIPS[:12]),
    }


def _post_bridge_json(bridge_url: str, hub_token: str, body: Dict[str, Any], timeout_sec: float = 6.0) -> Optional[Dict[str, Any]]:
    raw_bytes = json.dumps(body, ensure_ascii=False).encode("utf-8")
    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": f"Bearer {hub_token}",
        "Cache-Control": "no-store",
        "Connection": "keep-alive",
    }
    # 1순위: Keep-Alive TLS 세션 재사용으로 2·3회 연속 Ctrl+C 시 SSL 핸드셰이크(~350ms) 지연을 0ms로 단축
    try:
        import http.client
        import urllib.parse

        parsed_u = urllib.parse.urlsplit(bridge_url)
        if parsed_u.scheme == "https" and parsed_u.netloc:
            path_q = parsed_u.path or "/"
            if parsed_u.query:
                path_q = f"{path_q}?{parsed_u.query}"
            with _PUSH_HTTP_LOCK:
                conn = _PERSISTENT_BRIDGE_CONN.get("conn")
                if (
                    conn is None
                    or _PERSISTENT_BRIDGE_CONN.get("host") != parsed_u.netloc
                    or (time.time() - float(_PERSISTENT_BRIDGE_CONN.get("last_used") or 0.0)) > 45.0
                ):
                    try:
                        if conn is not None:
                            conn.close()
                    except Exception:
                        pass
                    conn = http.client.HTTPSConnection(parsed_u.netloc, timeout=timeout_sec)
                    _PERSISTENT_BRIDGE_CONN["host"] = parsed_u.netloc
                    _PERSISTENT_BRIDGE_CONN["conn"] = conn
                try:
                    conn.request("POST", path_q, body=raw_bytes, headers=headers)
                    resp = conn.getresponse()
                    resp_bytes = resp.read()
                    _PERSISTENT_BRIDGE_CONN["last_used"] = time.time()
                    if 200 <= resp.status < 300:
                        resp_txt = resp_bytes.decode("utf-8", errors="ignore")
                        parsed = json.loads(resp_txt) if resp_txt.strip().startswith("{") else None
                        if isinstance(parsed, dict):
                            return parsed
                except Exception:
                    try:
                        conn.close()
                    except Exception:
                        pass
                    _PERSISTENT_BRIDGE_CONN["conn"] = None
    except Exception:
        pass

    try:
        req = urllib.request.Request(
            bridge_url,
            data=raw_bytes,
            method="POST",
            headers=headers,
        )
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            resp_txt = resp.read().decode("utf-8", errors="ignore")
            parsed = json.loads(resp_txt) if resp_txt.strip().startswith("{") else None
            return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


def _flush_native_clip_batch(batch: List[Dict[str, str]]) -> None:
    if not batch:
        return
    try:
        ctx = _load_auth_context()
        email = str(ctx.get("email") or "").strip().lower()
        uid = str(ctx.get("canonicalUserId") or "").strip()
        hub_tok = str(ctx.get("hubToken") or "").strip()
        dev_id = str(ctx.get("deviceId") or "pc-zcore-direct").strip()
        dev_name = str(ctx.get("deviceName") or "내 Windows PC").strip()
        bridge_url = str(ctx.get("bridgeUrl") or DEFAULT_BRIDGE_URL).strip()
        if not email or not uid or not hub_tok or ctx.get("syncUnlocked", True) is False:
            return
        if check_pc_account_owner_allowed(email) is not None:
            return

        key32 = _derive_e2ee_key32(email, uid)
        encrypted_items: List[Dict[str, str]] = []
        for entry in batch:
            t_val = str(entry.get("text") or "").strip()
            c_hash = str(entry.get("clipHash") or "").strip()
            c_iso = str(entry.get("createdAt") or _format_iso_utc_now()).strip()
            if not t_val or not c_hash:
                continue
            iv12 = os.urandom(12)
            cipher_bytes = win32_aes256_gcm_encrypt(key32, iv12, t_val.encode("utf-8"))
            encrypted_items.append(
                {
                    "clipHash": c_hash,
                    "cipherB64": base64.b64encode(cipher_bytes).decode("ascii"),
                    "ivB64": base64.b64encode(iv12).decode("ascii"),
                    "senderDeviceId": dev_id,
                    "senderName": dev_name,
                    "createdAt": c_iso,
                }
            )
        if not encrypted_items:
            return

        newest = encrypted_items[-1]
        req_body: Dict[str, Any] = {
            "action": "device_push_e2ee_clip",
            "clipHash": newest["clipHash"],
            "cipherB64": newest["cipherB64"],
            "ivB64": newest["ivB64"],
            "senderDeviceId": newest["senderDeviceId"],
            "senderName": newest["senderName"],
            "createdAt": newest["createdAt"],
            "items": encrypted_items,
        }
        resp = _post_bridge_json(bridge_url, hub_tok, req_body, timeout_sec=6.0)
        if isinstance(resp, dict) and resp.get("ok"):
            srv_uid = str(resp.get("canonicalUserId") or "").strip()
            if srv_uid and srv_uid != uid:
                ctx["canonicalUserId"] = srv_uid
                _save_auth_context(ctx)
    except Exception:
        pass


def _enqueue_native_clip_push(text_val: str, clip_hash: str, created_iso: str) -> None:
    with _PUSH_QUEUE_LOCK:
        _NATIVE_PUSH_QUEUE[:] = [x for x in _NATIVE_PUSH_QUEUE if x.get("clipHash") != clip_hash][-29:]
        _NATIVE_PUSH_QUEUE.append(
            {
                "text": text_val,
                "clipHash": clip_hash,
                "createdAt": created_iso,
            }
        )
    _PUSH_QUEUE_EVENT.set()


def _pull_remote_clips_to_pc_os() -> None:
    global _LAST_NATIVE_PUSHED_TS
    try:
        ctx = _load_auth_context()
        email = str(ctx.get("email") or "").strip().lower()
        uid = str(ctx.get("canonicalUserId") or "").strip()
        hub_tok = str(ctx.get("hubToken") or "").strip()
        pc_dev_id = str(ctx.get("deviceId") or "").strip()
        bridge_url = str(ctx.get("bridgeUrl") or DEFAULT_BRIDGE_URL).strip()
        if not email or not hub_tok or ctx.get("syncUnlocked", True) is False:
            return
        if check_pc_account_owner_allowed(email) is not None:
            return

        resp = _post_bridge_json(bridge_url, hub_tok, {"action": "device_pull_e2ee_clips"}, timeout_sec=6.0)
        if not isinstance(resp, dict) or not resp.get("ok"):
            return

        srv_uid = str(resp.get("canonicalUserId") or "").strip()
        if srv_uid and srv_uid != uid:
            ctx["canonicalUserId"] = srv_uid
            _save_auth_context(ctx)
        eff_uid = srv_uid or uid
        if not eff_uid:
            return

        raw_items = resp.get("items")
        if not isinstance(raw_items, list) or not raw_items:
            return

        primary_key = _derive_e2ee_key32(email, eff_uid)
        fallback_key = _derive_e2ee_key32(email, uid) if (uid and uid != eff_uid) else None

        newest_ext: Optional[Dict[str, Any]] = None
        newest_env_key = ""

        for env in raw_items[:60]:
            if not isinstance(env, dict):
                continue
            sender_dev = str(env.get("senderDeviceId") or "").strip()
            if not sender_dev or (pc_dev_id and sender_dev == pc_dev_id):
                continue
            c_b64 = str(env.get("cipherB64") or "").strip()
            iv_b64 = str(env.get("ivB64") or "").strip()
            if not c_b64 or not iv_b64:
                continue
            c_hash = str(env.get("clipHash") or "").strip()
            created_at = str(env.get("createdAt") or "").strip()
            env_key = f"{sender_dev}:{c_hash}:{created_at}"
            if env_key in _DELIVERED_NATIVE_ENV_KEYS:
                continue
            if newest_ext is None:
                newest_ext = env
                newest_env_key = env_key
            else:
                _DELIVERED_NATIVE_ENV_KEYS.add(env_key)

        if len(_DELIVERED_NATIVE_ENV_KEYS) > 300:
            keep = list(_DELIVERED_NATIVE_ENV_KEYS)[-180:]
            _DELIVERED_NATIVE_ENV_KEYS.clear()
            _DELIVERED_NATIVE_ENV_KEYS.update(keep)

        if newest_ext is None or not newest_env_key:
            return

        created_ms = _parse_iso_ms(str(newest_ext.get("createdAt") or ""))
        now_ms = time.time() * 1000.0
        is_fresh = (created_ms <= 0.0) or ((now_ms - created_ms) <= 10 * 60 * 1000.0)
        is_older_than_local = (
            _LAST_NATIVE_PUSHED_TS > 0.0
            and created_ms > 0.0
            and created_ms < (_LAST_NATIVE_PUSHED_TS * 1000.0 - 1000.0)
        )
        if not is_fresh or is_older_than_local:
            _DELIVERED_NATIVE_ENV_KEYS.add(newest_env_key)
            return

        cipher_raw = base64.b64decode(str(newest_ext["cipherB64"]))
        iv_raw = base64.b64decode(str(newest_ext["ivB64"]))
        plain_txt: Optional[str] = None
        try:
            plain_txt = win32_aes256_gcm_decrypt(primary_key, iv_raw, cipher_raw).decode("utf-8")
        except Exception:
            if fallback_key is not None:
                try:
                    plain_txt = win32_aes256_gcm_decrypt(fallback_key, iv_raw, cipher_raw).decode("utf-8")
                except Exception:
                    plain_txt = None
        if not plain_txt or not plain_txt.strip():
            return

        clean_plain = plain_txt.strip()[:32000]
        resolved_hash = str(newest_ext.get("clipHash") or "").strip() or _sha256_text(clean_plain)
        _RECENT_REMOTE_INJECTED_HASHES[resolved_hash] = time.time()
        if len(_RECENT_REMOTE_INJECTED_HASHES) > 80:
            cutoff_ts = time.time() - 120.0
            for k in [k for k, ts in _RECENT_REMOTE_INJECTED_HASHES.items() if ts < cutoff_ts]:
                _RECENT_REMOTE_INJECTED_HASHES.pop(k, None)

        inj = set_os_clipboard_text({"accountEmail": email, "text": clean_plain})
        if inj.get("ok"):
            _DELIVERED_NATIVE_ENV_KEYS.add(newest_env_key)
            pulled_entry = {
                "clipHash": resolved_hash,
                "text": clean_plain,
                "senderDeviceId": str(newest_ext.get("senderDeviceId") or ""),
                "senderName": str(newest_ext.get("senderName") or "연결된 내 기기"),
                "createdAt": str(newest_ext.get("createdAt") or _format_iso_utc_now()),
            }
            _RECENT_NATIVE_PULLED_CLIPS[:] = [
                pulled_entry,
                *[x for x in _RECENT_NATIVE_PULLED_CLIPS if x.get("clipHash") != resolved_hash],
            ][:20]
    except Exception:
        pass


def start_native_clipboard_e2ee_daemon() -> None:
    """
    크롬 창이 메모장에 가려지거나 최소화·종료되어 백그라운드 탭 절전(10초 지연)이 걸리더라도,
    Win32 커널 시퀀스 번호를 0.22초 주기로 감시하여 복사 즉시 0.2초 내 스마트폰으로 E2EE 직통 발송하고,
    1.5초 주기로 스마트폰 복사본을 수신해 Windows 클립보드에 자동 주입합니다.
    """
    global _NATIVE_DAEMON_STARTED, _LAST_NATIVE_PUSHED_HASH, _LAST_NATIVE_PUSHED_TS
    if os.name != "nt":
        return
    with _NATIVE_DAEMON_LOCK:
        if _NATIVE_DAEMON_STARTED:
            return
        _NATIVE_DAEMON_STARTED = True

    def _push_worker_loop() -> None:
        while True:
            _PUSH_QUEUE_EVENT.wait()
            _PUSH_QUEUE_EVENT.clear()
            while True:
                with _PUSH_QUEUE_LOCK:
                    if not _NATIVE_PUSH_QUEUE:
                        break
                    batch = list(_NATIVE_PUSH_QUEUE)
                    _NATIVE_PUSH_QUEUE.clear()
                _flush_native_clip_batch(batch)

    def _daemon_loop() -> None:
        global _LAST_NATIVE_PUSHED_HASH, _LAST_NATIVE_PUSHED_TS
        u32, _ = _configure_win32_clip_funcs()
        try:
            last_seq = int(u32.GetClipboardSequenceNumber())
        except Exception:
            last_seq = -1
        last_pull_ts = 0.0

        while True:
            time.sleep(0.12)
            try:
                curr_seq = int(u32.GetClipboardSequenceNumber())
            except Exception:
                continue

            if last_seq < 0:
                last_seq = curr_seq
                continue

            if curr_seq != last_seq:
                last_seq = curr_seq
                if _is_native_e2ee_ready():
                    ctx = _load_auth_context()
                    email = str(ctx.get("email") or "").strip().lower()
                    dev_id = str(ctx.get("deviceId") or "pc-zcore-direct").strip()
                    dev_name = str(ctx.get("deviceName") or "내 Windows PC").strip()
                    snap = get_os_clipboard_text({"email": email})
                    txt = str(snap.get("text") or "").strip()
                    c_hash = str(snap.get("clipHash") or "").strip()
                    is_self = bool(snap.get("isSelfInjected"))
                    now_ts = time.time()
                    inj_ts = _RECENT_REMOTE_INJECTED_HASHES.get(c_hash, 0.0)
                    is_recent_remote_echo = bool(inj_ts and (now_ts - inj_ts) < 60.0)
                    is_dup_burst = bool(
                        c_hash
                        and c_hash == _LAST_NATIVE_PUSHED_HASH
                        and (now_ts - _LAST_NATIVE_PUSHED_TS) < 1.2
                    )
                    if txt and c_hash and not is_self and not is_recent_remote_echo and not is_dup_burst:
                        _LAST_NATIVE_PUSHED_HASH = c_hash
                        _LAST_NATIVE_PUSHED_TS = now_ts
                        created_iso = _format_iso_utc_now()
                        pushed_entry = {
                            "clipHash": c_hash,
                            "text": txt,
                            "senderDeviceId": dev_id,
                            "senderName": f"{dev_name} (발신)",
                            "createdAt": created_iso,
                        }
                        _RECENT_NATIVE_PUSHED_CLIPS[:] = [
                            pushed_entry,
                            *[x for x in _RECENT_NATIVE_PUSHED_CLIPS if x.get("clipHash") != c_hash],
                        ][:20]
                        _enqueue_native_clip_push(txt, c_hash, created_iso)

            now_pull = time.time()
            if (now_pull - last_pull_ts) >= 1.5:
                last_pull_ts = now_pull
                if _is_native_e2ee_ready():
                    _pull_remote_clips_to_pc_os()

    threading.Thread(target=_push_worker_loop, name="zcore-native-clip-push", daemon=True).start()
    threading.Thread(target=_daemon_loop, name="zcore-native-clip-e2ee", daemon=True).start()


def _configure_win32_clip_funcs() -> tuple[Any, Any]:
    u32 = ctypes.windll.user32
    k32 = ctypes.windll.kernel32
    u32.OpenClipboard.argtypes = [ctypes.c_void_p]
    u32.OpenClipboard.restype = ctypes.c_int
    u32.CloseClipboard.argtypes = []
    u32.CloseClipboard.restype = ctypes.c_int
    u32.EmptyClipboard.argtypes = []
    u32.EmptyClipboard.restype = ctypes.c_int
    u32.IsClipboardFormatAvailable.argtypes = [ctypes.c_uint]
    u32.IsClipboardFormatAvailable.restype = ctypes.c_int
    u32.GetClipboardData.argtypes = [ctypes.c_uint]
    u32.GetClipboardData.restype = ctypes.c_void_p
    u32.SetClipboardData.argtypes = [ctypes.c_uint, ctypes.c_void_p]
    u32.SetClipboardData.restype = ctypes.c_void_p
    u32.GetClipboardSequenceNumber.argtypes = []
    u32.GetClipboardSequenceNumber.restype = ctypes.c_uint
    k32.GlobalAlloc.argtypes = [ctypes.c_uint, ctypes.c_size_t]
    k32.GlobalAlloc.restype = ctypes.c_void_p
    k32.GlobalLock.argtypes = [ctypes.c_void_p]
    k32.GlobalLock.restype = ctypes.c_void_p
    k32.GlobalUnlock.argtypes = [ctypes.c_void_p]
    k32.GlobalUnlock.restype = ctypes.c_int
    return u32, k32


def get_os_clipboard_text(qp: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Windows OS 클립보드의 현재 유니코드 텍스트와 해시를 읽고, 자체 주입(Echo) 및 Z-코어 직결 발송 상태를 반환합니다."""
    params = qp or {}
    req_email = str(params.get("email") or params.get("accountEmail") or "").strip()
    if req_email:
        blocked = check_pc_account_owner_allowed(req_email)
        if blocked is not None:
            return blocked
    if os.name != "nt":
        return {"ok": True, "text": "", "clipHash": "", "isSelfInjected": False, "seqNum": 0}

    u32, k32 = _configure_win32_clip_funcs()
    curr_seq = int(u32.GetClipboardSequenceNumber())

    text_val = ""
    opened = False
    try:
        for attempt in range(6):
            if u32.OpenClipboard(None):
                opened = True
                break
            if attempt < 5:
                time.sleep(0.015)
        if opened and u32.IsClipboardFormatAvailable(CF_UNICODETEXT):
            handle = u32.GetClipboardData(CF_UNICODETEXT)
            if handle:
                ptr = k32.GlobalLock(handle)
                if ptr:
                    try:
                        text_val = ctypes.wstring_at(ptr)
                    finally:
                        k32.GlobalUnlock(handle)
    except Exception:
        text_val = ""
    finally:
        if opened:
            try:
                u32.CloseClipboard()
            except Exception:
                pass

    clean = (text_val or "").strip()
    if len(clean) > 32000:
        clean = clean[:32000]
    h = _sha256_text(clean) if clean else ""
    inj_ts = _RECENT_REMOTE_INJECTED_HASHES.get(h, 0.0) if h else 0.0
    is_self = bool(
        (
            h
            and h == _LAST_INJECTED_CLIP_HASH
            and _LAST_INJECTED_CLIP_SEQ >= 0
            and curr_seq == _LAST_INJECTED_CLIP_SEQ
        )
        or (inj_ts and (time.time() - inj_ts) < 60.0)
    )
    return {
        "ok": True,
        "text": clean,
        "clipHash": h,
        "isSelfInjected": is_self,
        "seqNum": curr_seq,
        "nativeDirectActive": _is_native_e2ee_ready(req_email),
        "lastNativePushedHash": _LAST_NATIVE_PUSHED_HASH,
        "recentNativePushed": list(_RECENT_NATIVE_PUSHED_CLIPS[:10]),
        "recentNativePulled": list(_RECENT_NATIVE_PULLED_CLIPS[:10]),
    }


def set_os_clipboard_text(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """타 기기(스마트폰/서브 PC)에서 수신한 클립보드를 무한 반사 루프 없이 Windows 클립보드에 1회 주입합니다."""
    global _LAST_INJECTED_CLIP_HASH, _LAST_INJECTED_CLIP_SEQ
    payload = data or {}
    req_email = str(payload.get("accountEmail") or payload.get("email") or "").strip()
    if req_email:
        blocked = check_pc_account_owner_allowed(req_email)
        if blocked is not None:
            return blocked
    text_val = str(payload.get("text") or "").strip()
    if not text_val:
        return {"ok": False, "error": "EMPTY_CLIPBOARD_TEXT"}
    if len(text_val) > 32000:
        text_val = text_val[:32000]

    new_hash = _sha256_text(text_val)
    _RECENT_REMOTE_INJECTED_HASHES[new_hash] = time.time()
    if os.name != "nt":
        _LAST_INJECTED_CLIP_HASH = new_hash
        return {"ok": True, "clipHash": new_hash}

    u32, k32 = _configure_win32_clip_funcs()
    curr_seq = int(u32.GetClipboardSequenceNumber())
    if (
        new_hash == _LAST_INJECTED_CLIP_HASH
        and _LAST_INJECTED_CLIP_SEQ >= 0
        and curr_seq == _LAST_INJECTED_CLIP_SEQ
    ):
        return {"ok": True, "alreadyInjected": True, "clipHash": new_hash, "seqNum": curr_seq}

    raw_u16 = text_val.encode("utf-16-le") + b"\x00\x00"
    opened = False
    try:
        for attempt in range(8):
            if u32.OpenClipboard(None):
                opened = True
                break
            if attempt < 7:
                time.sleep(0.015)
        if not opened:
            return {"ok": False, "error": "OPEN_CLIPBOARD_BUSY"}
        u32.EmptyClipboard()
        h_mem = k32.GlobalAlloc(GMEM_MOVEABLE, len(raw_u16))
        if not h_mem:
            return {"ok": False, "error": "GLOBAL_ALLOC_FAILED"}
        ptr = k32.GlobalLock(h_mem)
        if not ptr:
            return {"ok": False, "error": "GLOBAL_LOCK_FAILED"}
        ctypes.memmove(ptr, raw_u16, len(raw_u16))
        k32.GlobalUnlock(h_mem)
        u32.SetClipboardData(CF_UNICODETEXT, h_mem)
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    finally:
        if opened:
            try:
                u32.CloseClipboard()
            except Exception:
                pass

    # 닫힌 직후 Windows 시퀀스 번호를 각인하여 외부 새 Ctrl+C는 즉시 감지하고, 방금 주입한 항목만 Echo 차단
    after_seq = int(u32.GetClipboardSequenceNumber())
    _LAST_INJECTED_CLIP_HASH = new_hash
    _LAST_INJECTED_CLIP_SEQ = after_seq
    return {"ok": True, "clipHash": new_hash, "seqNum": after_seq}


def resolve_phone_backup_dir(account_email: Optional[str] = None) -> Path:
    """Windows 탐색기 좌측 [사진] 실제 경로 하위의 계정별 격리 백업 폴더(Ghosti_Phone_Backup/<계정폴더>)를 반환합니다."""
    base_dir = Path.home() / "Pictures" / "Ghosti_Phone_Backup"
    try:
        import ghosti_safe_ops as _safe_ops  # type: ignore

        pic_dir = _safe_ops.known_folder("pictures")
        if pic_dir:
            base_dir = Path(pic_dir) / "Ghosti_Phone_Backup"
    except Exception:
        pass
    sub = sanitize_account_backup_folder(account_email)
    return (base_dir / sub) if sub else base_dir


def save_mirrored_device_file(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """폰·서브PC에서 미러링된 원본 사진·문서를 내 PC [사진\\Ghosti_Phone_Backup\\<계정폴더>]에 안전하게 보관합니다."""
    payload = data or {}
    req_email = str(payload.get("accountEmail") or payload.get("email") or "").strip()
    if req_email:
        blocked = check_pc_account_owner_allowed(req_email)
        if blocked is not None:
            return blocked
    raw_name = os.path.basename(str(payload.get("fileName") or "").strip())
    if not raw_name:
        return {"ok": False, "error": "EMPTY_FILE_NAME"}
    if Path(raw_name).suffix.lower() in _BLOCKED_EXEC_EXTS:
        return {"ok": False, "error": "BLOCKED_EXECUTABLE_EXTENSION"}

    backup_dir = resolve_phone_backup_dir(req_email)
    backup_dir.mkdir(parents=True, exist_ok=True)
    target = backup_dir / raw_name

    signed_url = str(payload.get("signedDownloadUrl") or "").strip()
    b64_raw = str(payload.get("base64Data") or "").strip()

    try:
        if signed_url.startswith("https://"):
            req = urllib.request.Request(signed_url, method="GET")
            with urllib.request.urlopen(req, timeout=45) as resp:
                file_bytes = resp.read()
        elif b64_raw:
            if "," in b64_raw and b64_raw.startswith("data:"):
                b64_raw = b64_raw.split(",", 1)[1]
            file_bytes = base64.b64decode(b64_raw)
        else:
            return {"ok": False, "error": "NO_PAYLOAD"}

        tmp_p = target.with_name(f".{target.name}.ghosti_mirror_tmp")
        tmp_p.write_bytes(file_bytes)
        os.replace(tmp_p, target)
        return {
            "ok": True,
            "savedPath": str(target),
            "backupDir": str(backup_dir),
            "size": len(file_bytes),
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def check_ghostwin_daemon_alive(timeout_sec: float = 0.8) -> Dict[str, Any]:
    """로컬 귀신창 데몬(127.0.0.1:51988) 생존 여부를 초경량 TCP PING/PONG(및 HTTP 폴백)으로 확인합니다."""
    import socket

    try:
        with socket.create_connection(("127.0.0.1", GHOSTWIN_LOCAL_PORT), timeout=timeout_sec) as sock:
            sock.settimeout(timeout_sec)
            sock.sendall(b"__PING__")
            reply = sock.recv(64)
            if b"PONG" in reply:
                return {"ok": True, "alive": True, "port": GHOSTWIN_LOCAL_PORT, "detail": {"pong": True}}
    except Exception:
        pass
    for ep in ("/__merlin/ping", "/health"):
        url = f"http://127.0.0.1:{GHOSTWIN_LOCAL_PORT}{ep}"
        try:
            with urllib.request.urlopen(url, timeout=timeout_sec) as resp:
                raw = resp.read().decode("utf-8", errors="ignore")
                data = json.loads(raw) if raw.strip().startswith("{") else {"raw": raw[:200]}
                return {"ok": True, "alive": True, "port": GHOSTWIN_LOCAL_PORT, "detail": data}
        except Exception:
            continue
    return {"ok": True, "alive": False, "port": GHOSTWIN_LOCAL_PORT}


def handle_action(act: str, data: Dict[str, Any]) -> Dict[str, Any] | None:
    """plugin_ghosti_os 라우터에서 위임받아 내 기기 통합 및 귀신창 액션을 처리합니다."""
    if act not in SYNC_GHOSTWIN_ACTIONS and not act.startswith(("paid-sync-", "ghostwin-")):
        return None

    if act in ("ghostwin-status", "ghostwin-ping", "paid-sync-status"):
        gw = check_ghostwin_daemon_alive()
        return {"ok": True, "track": "paid-sync", "ghostWinDaemon": gw}

    if act == "paid-sync-get-clipboard":
        return get_os_clipboard_text(data)

    if act == "paid-sync-set-clipboard":
        return set_os_clipboard_text(data)

    if act == "paid-sync-auth-context":
        return set_clipboard_e2ee_auth_context(data)

    if act == "paid-sync-mirror-pull":
        return save_mirrored_device_file(data)

    if act == "paid-sync-summon-file":
        target_name = os.path.basename(str(data.get("fileName") or data.get("fileId") or "").strip())
        if not target_name:
            return {"ok": False, "track": "paid-sync", "error": "EMPTY_FILE_NAME"}
        req_email = str(data.get("accountEmail") or data.get("email") or "").strip()
        backup_dir = resolve_phone_backup_dir(req_email)
        existing = backup_dir / target_name
        if existing.exists() and existing.is_file():
            return {
                "ok": True,
                "track": "paid-sync",
                "status": "ready_local",
                "savedPath": str(existing),
                "backupDir": str(backup_dir),
                "size": existing.stat().st_size,
            }
        if data.get("signedDownloadUrl") or data.get("base64Data"):
            pulled = save_mirrored_device_file({**data, "fileName": target_name})
            return {"track": "paid-sync", **pulled}
        return {
            "ok": False,
            "track": "paid-sync",
            "status": "not_found_local",
            "error": "FILE_NOT_YET_MIRRORED_LOCALLY",
            "target": target_name,
        }

    return {"ok": False, "track": "paid-sync", "error": f"UNHANDLED_PAID_SYNC_ACTION: {act}"}
