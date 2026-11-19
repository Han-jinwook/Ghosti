#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[5. 📱 내 기기 통합 & ⚡ 귀신창 네이티브 브릿지] plugin_paid_sync_ghostwin.py
- 담당 도메인:
  1) 👑 내 기기 통합 (월 3,900원 / 연간 39,000원 · 2번째 기기 30일 무료체험 D-30):
     - PC Win32 클립보드(CF_UNICODETEXT) 실시간 읽기·주입 및 무한 반사(Echo Loop) 원천 차단 해시 가드
     - 스마트폰 ➔ 내 PC 로컬 폴더(Pictures\\Ghosti_Phone_Backup) 100% 원본 미러링 저장
  2) ⚡ 귀신창 초능력 & 귀신검색창 (로컬 127.0.0.1:51988) 생존 상태 점검
- 헌법 가드레일: 본 플러그인 내부에 ONNX/AI 모델(InferenceSession 등) 직접 로드 영구 금지.
"""

from __future__ import annotations

import base64
import ctypes
import hashlib
import json
import os
from pathlib import Path
from typing import Any, Dict
import urllib.request

GHOSTWIN_LOCAL_PORT = 51988
CF_UNICODETEXT = 13
GMEM_MOVEABLE = 0x0002

SYNC_GHOSTWIN_ACTIONS = {
    "paid-sync-status",
    "ghostwin-status",
    "ghostwin-ping",
    "paid-sync-summon-file",
    "paid-sync-get-clipboard",
    "paid-sync-set-clipboard",
    "paid-sync-mirror-pull",
}

_LAST_INJECTED_CLIP_HASH: str = ""
_BLOCKED_EXEC_EXTS = {
    ".exe", ".bat", ".cmd", ".ps1", ".vbs", ".vbe", ".js", ".jse",
    ".wsf", ".wsh", ".hta", ".scr", ".msi", ".msp", ".dll", ".com", ".pif", ".reg",
}


def _sha256_text(txt: str) -> str:
    return hashlib.sha256(txt.encode("utf-8", errors="ignore")).hexdigest()


def get_os_clipboard_text() -> Dict[str, Any]:
    """Windows OS 클립보드의 현재 유니코드 텍스트와 해시를 읽고, 자체 주입(Echo) 여부를 반환합니다."""
    if os.name != "nt":
        return {"ok": True, "text": "", "clipHash": "", "isSelfInjected": False}

    u32 = ctypes.windll.user32
    k32 = ctypes.windll.kernel32
    u32.GetClipboardData.restype = ctypes.c_void_p
    k32.GlobalLock.argtypes = [ctypes.c_void_p]
    k32.GlobalLock.restype = ctypes.c_void_p
    k32.GlobalUnlock.argtypes = [ctypes.c_void_p]

    text_val = ""
    opened = False
    try:
        for _ in range(3):
            if u32.OpenClipboard(None):
                opened = True
                break
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
    return {
        "ok": True,
        "text": clean,
        "clipHash": h,
        "isSelfInjected": bool(h and h == _LAST_INJECTED_CLIP_HASH),
    }


def set_os_clipboard_text(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """타 기기(스마트폰/서브 PC)에서 수신한 클립보드를 무한 반사 루프 없이 Windows 클립보드에 1회 주입합니다."""
    global _LAST_INJECTED_CLIP_HASH
    payload = data or {}
    text_val = str(payload.get("text") or "").strip()
    if not text_val:
        return {"ok": False, "error": "EMPTY_CLIPBOARD_TEXT"}
    if len(text_val) > 32000:
        text_val = text_val[:32000]

    new_hash = _sha256_text(text_val)
    if new_hash == _LAST_INJECTED_CLIP_HASH:
        return {"ok": True, "alreadyInjected": True, "clipHash": new_hash}

    # 먼저 자체 주입 해시를 기록하여 폴링 감시기가 다시 역전송(Echo Loop)하지 못하게 원천 차단!
    _LAST_INJECTED_CLIP_HASH = new_hash

    if os.name != "nt":
        return {"ok": True, "clipHash": new_hash}

    u32 = ctypes.windll.user32
    k32 = ctypes.windll.kernel32
    k32.GlobalAlloc.argtypes = [ctypes.c_uint, ctypes.c_size_t]
    k32.GlobalAlloc.restype = ctypes.c_void_p
    k32.GlobalLock.argtypes = [ctypes.c_void_p]
    k32.GlobalLock.restype = ctypes.c_void_p
    k32.GlobalUnlock.argtypes = [ctypes.c_void_p]
    u32.SetClipboardData.argtypes = [ctypes.c_uint, ctypes.c_void_p]
    u32.SetClipboardData.restype = ctypes.c_void_p

    raw_u16 = text_val.encode("utf-16-le") + b"\x00\x00"
    opened = False
    try:
        for _ in range(4):
            if u32.OpenClipboard(None):
                opened = True
                break
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
        return {"ok": True, "clipHash": new_hash}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    finally:
        if opened:
            try:
                u32.CloseClipboard()
            except Exception:
                pass


def save_mirrored_device_file(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """폰·서브PC에서 미러링된 원본 사진·문서를 내 PC Pictures\\Ghosti_Phone_Backup 에 안전하게 보관합니다."""
    payload = data or {}
    raw_name = os.path.basename(str(payload.get("fileName") or "").strip())
    if not raw_name:
        return {"ok": False, "error": "EMPTY_FILE_NAME"}
    if Path(raw_name).suffix.lower() in _BLOCKED_EXEC_EXTS:
        return {"ok": False, "error": "BLOCKED_EXECUTABLE_EXTENSION"}

    backup_dir = Path.home() / "Pictures" / "Ghosti_Phone_Backup"
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
        return {"ok": True, "savedPath": str(target), "size": len(file_bytes)}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def check_ghostwin_daemon_alive(timeout_sec: float = 0.8) -> Dict[str, Any]:
    """로컬 귀신창 데몬(127.0.0.1:51988) 생존 여부를 초경량 소켓/HTTP로 확인합니다."""
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
        return get_os_clipboard_text()

    if act == "paid-sync-set-clipboard":
        return set_os_clipboard_text(data)

    if act == "paid-sync-mirror-pull":
        return save_mirrored_device_file(data)

    if act == "paid-sync-summon-file":
        target_id = str(data.get("fileId") or data.get("fileName") or "").strip()
        return {"ok": True, "track": "paid-sync", "status": "queued", "target": target_id}

    return {"ok": False, "track": "paid-sync", "error": f"UNHANDLED_PAID_SYNC_ACTION: {act}"}
