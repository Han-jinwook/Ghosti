# -*- coding: utf-8 -*-
sb_text = open(r'D:\SensTalk\bot\sensebot.py', 'r', encoding='utf-8').read()
marker_start = '# ==========================================\n# 1. 64비트 Windows Win32 API 선언'
marker_end = '# ==========================================\n# 7. HTTP REST API & 동기화 서버'
assert marker_start in sb_text and marker_end in sb_text
core_body = sb_text.split(marker_start, 1)[1].split(marker_end, 1)[0]
core_body = marker_start + core_body
core_body = core_body.replace(
    'http://127.0.0.1:5199/api/senstalk/pause',
    'http://127.0.0.1:28888/pause',
)

header = '''#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[내장 소프트웨어 플러그인 2] plugin_senstalk.py (v3.3 — sensebot.py v3.3 100% 무손실 동기화판)
- 센스톡(SensTalk) 6대 메신저(카카오톡·라인·텔레그램·왓츠앱·위챗) 엔터 1회 연속 발송 엔진
- 귀신같이 단일 표준 포트(127.0.0.1:5199)의 Merlin_Z_Core 내부에서 직결 작동합니다.
"""

from __future__ import annotations

import base64
import ctypes
from ctypes import wintypes
from datetime import date
import io
import json
import os
from pathlib import Path
import random
import re
import sys
import threading
import time
from typing import Any, Dict, List
import urllib.parse
import webbrowser
import winsound

THIS_DIR = Path(__file__).resolve().parent
if str(THIS_DIR) not in sys.path:
    sys.path.insert(0, str(THIS_DIR))

import core_win32 as w32  # noqa: E402

try:
    import psutil
except ImportError:
    psutil = None

try:
    from PIL import Image, ImageDraw
except ImportError:
    Image = None
    ImageDraw = None

try:
    import win32clipboard
    import win32con
except ImportError:
    win32clipboard = None
    win32con = None

SENSEBOT_VERSION = "3.3"

PLUGIN_METADATA = {
    "pluginId": "senstalk",
    "pluginName": "SensTalk 6-Messenger Full Native Dispatch Engine (sensebot v3.3)",
    "version": SENSEBOT_VERSION,
    "type": "BUILTIN_SOFTWARE_PLUGIN",
    "port": 5199,
    "basePath": "/api/senstalk",
    "supportedChannels": ["kakao", "line", "telegram", "whatsapp", "wechat"],
}

_LISTENERS_STARTED = False
_LISTENERS_LOCK = threading.Lock()

'''

footer = '''
# ==========================================
# 7. On-Demand 리스너 기동 & Z-Core 단일 포트(5199) 라우터 브릿지
# ==========================================
def ensure_listeners_started() -> None:
    """/sync, /start, /dispatch 호출 시에만 [Enter] 감지 및 [F8] 핫키 스레드를 On-Demand 기동"""
    global _LISTENERS_STARTED
    with _LISTENERS_LOCK:
        if _LISTENERS_STARTED:
            return
        _LISTENERS_STARTED = True
        os.makedirs(os.path.dirname(STATS_FILE), exist_ok=True)
        t_enter = threading.Thread(target=enter_listener_loop, daemon=True, name="SensTalkEnterListener")
        t_enter.start()
        t_hotkey = threading.Thread(target=hotkey_listener_thread, daemon=True, name="SensTalkHotkeyListener")
        t_hotkey.start()


def handle_get(subpath: str) -> Dict[str, Any]:
    global LAST_EVENT
    sub = (subpath or "health").strip("/").lower()

    if sub in ("", "health", "status"):
        recs = SYNCED_STATE.get("recipients", [])
        return {
            "ok": True,
            "status": "ok",
            "service": "SenseBot Local Daemon (Merlin_Z_Core Built-in)",
            "plugin": PLUGIN_METADATA,
            "version": SENSEBOT_VERSION,
            "port": 5199,
            "bot_running": BOT_RUNNING,
            "waiting_enter": WAITING_FOR_USER_ENTER,
            "today_sent": get_today_stats(),
            "daily_limit": DAILY_LIMIT,
            "kakao_running": find_kakaotalk_window() is not None,
            "workflow": "one_enter_continuous",
            "autostart": w32.is_autostart_enabled(),
            "total": len(recs),
        }

    if sub == "autostart":
        enabled = w32.is_autostart_enabled()
        return {
            "ok": True,
            "enabled": enabled,
            "autostart": enabled,
        }

    if sub == "poll":
        with STATE_LOCK:
            if not BOT_RUNNING and LAST_EVENT and LAST_EVENT.get("type") == "paused":
                if time.time() - LAST_EVENT.get("timestamp", 0) > 30:
                    LAST_EVENT = None
            recs = SYNCED_STATE.get("recipients", [])
            curr_idx = SYNCED_STATE.get("currentIndex", 0)
            done_cnt = sum(1 for r in recs if isinstance(r, dict) and r.get("status") == "done")
            skip_cnt = sum(1 for r in recs if isinstance(r, dict) and r.get("status") in ("skipped", "skip"))
            return {
                "ok": True,
                "plugin": "senstalk",
                "port": 5199,
                "last_event": LAST_EVENT,
                "server_time": time.time(),
                "version": SENSEBOT_VERSION,
                "bot_running": BOT_RUNNING,
                "running": BOT_RUNNING,
                "waiting_enter": WAITING_FOR_USER_ENTER,
                "currentIndex": curr_idx,
                "idx": curr_idx,
                "total": len(recs),
                "doneCount": done_cnt,
                "skipCount": skip_cnt,
                "recipients": recs,
                "queue": recs,
                "channel": SYNCED_STATE.get("channel", "kakao"),
                "is_test_mode": IS_TEST_MODE,
                "today_sent": get_today_stats(),
                "daily_limit": DAILY_LIMIT,
                "autostart": w32.is_autostart_enabled(),
                "status_msg": f"대기열 {len(recs)}건 동기화 완료 (포트 5199 내장 플러그인 v{SENSEBOT_VERSION})",
            }

    return {"ok": False, "error": f"Unknown GET endpoint: /api/senstalk/{sub}"}


def handle_post(subpath: str, data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    global BOT_RUNNING, WAITING_FOR_USER_ENTER, IS_TEST_MODE
    global CURRENT_TARGET_REC, CURRENT_REC_BLOCKS, CURRENT_BLOCK_INDEX, LAST_EVENT, _DISPATCH_SEQ_ID

    sub = (subpath or "").strip("/").lower()
    body = data or {}

    if sub == "autostart":
        enable = bool(body.get("enable", body.get("enabled", True)))
        ok = w32.set_autostart_enabled(enable)
        enabled = w32.is_autostart_enabled()
        return {
            "ok": ok,
            "enabled": enabled,
            "autostart": enabled,
            "msg": "윈도우 시작프로그램에 등록되었습니다." if enabled else "윈도우 시작프로그램 등록이 해제되었습니다.",
        }

    if sub == "sync":
        with STATE_LOCK:
            is_reset = body.get("is_reset", False)
            if not BOT_RUNNING and LAST_EVENT and LAST_EVENT.get("type") == "paused":
                LAST_EVENT = None

            incoming_recs = body.get("recipients")
            if incoming_recs is None:
                incoming_recs = body.get("queue") or body.get("items")

            if incoming_recs is not None and isinstance(incoming_recs, list):
                new_recs = []
                for r in incoming_recs:
                    if isinstance(r, dict):
                        row = dict(r)
                        if row.get("status") == "ready":
                            row["status"] = "pending"
                        row.setdefault("status", "pending")
                        if "message" not in row and "msg" in row:
                            row["message"] = row["msg"]
                        new_recs.append(row)

                old_recs = SYNCED_STATE.get("recipients", [])
                if is_reset:
                    _DISPATCH_SEQ_ID += 1
                    for nr in new_recs:
                        nr["status"] = "pending"
                    BOT_RUNNING = False
                    WAITING_FOR_USER_ENTER = False
                    CURRENT_TARGET_REC = None
                    CURRENT_REC_BLOCKS = []
                    CURRENT_BLOCK_INDEX = 0
                    SYNCED_STATE["currentIndex"] = 0
                    LAST_EVENT = {"type": "reset", "timestamp": time.time()}
                elif isinstance(old_recs, list) and len(new_recs) == len(old_recs):
                    for i, nr in enumerate(new_recs):
                        if old_recs[i].get("status") == "done" and nr.get("status") != "done":
                            nr["status"] = "done"
                SYNCED_STATE["recipients"] = new_recs

            if "blocks" in body:
                SYNCED_STATE["blocks"] = body["blocks"]
            if "currentIndex" in body:
                SYNCED_STATE["currentIndex"] = 0 if is_reset else body["currentIndex"]
            if "mode" in body:
                SYNCED_STATE["mode"] = body["mode"]
            if "channel" in body:
                SYNCED_STATE["channel"] = body["channel"]
            if "condition" in body:
                SYNCED_STATE["condition"] = body["condition"]

            cnt = len(SYNCED_STATE.get("recipients", []))
            return {
                "ok": True,
                "status": "synced",
                "port": 5199,
                "count": cnt,
                "total": cnt,
                "status_msg": f"📥 발송 대기열 {cnt}건 동기화 완료 (포트 5199 내장 플러그인 v{SENSEBOT_VERSION})",
            }

    if sub == "start":
        ensure_listeners_started()
        _pause_other_local_engine()
        with STATE_LOCK:
            _DISPATCH_SEQ_ID += 1
            seq_id = _DISPATCH_SEQ_ID
            BOT_RUNNING = True
        threading.Thread(target=load_and_dispatch_next, args=(seq_id,), daemon=True).start()
        return {"ok": True, "status": "started", "port": 5199}

    if sub == "pause":
        with STATE_LOCK:
            _DISPATCH_SEQ_ID += 1
            BOT_RUNNING = False
            WAITING_FOR_USER_ENTER = False
            IS_TEST_MODE = False
            LAST_EVENT = {"type": "paused", "timestamp": time.time()}
        return {"ok": True, "status": "paused", "port": 5199}

    if sub == "skip":
        ensure_listeners_started()
        _pause_other_local_engine()
        skipped_id = body.get("skippedId")
        skipped_name = body.get("skippedName")
        skipped_idx = body.get("skippedIndex")
        next_idx = body.get("nextIndex")

        with STATE_LOCK:
            _DISPATCH_SEQ_ID += 1
            seq_id = _DISPATCH_SEQ_ID
            recs = SYNCED_STATE.get("recipients", [])
            if isinstance(skipped_idx, int) and 0 <= skipped_idx < len(recs):
                if recs[skipped_idx].get("status") != "done":
                    recs[skipped_idx]["status"] = "skipped"
            if skipped_id or skipped_name:
                for r in recs:
                    if (skipped_id and r.get("id") == skipped_id) or (skipped_name and r.get("name") == skipped_name):
                        if r.get("status") != "done":
                            r["status"] = "skipped"
            if CURRENT_TARGET_REC:
                if CURRENT_TARGET_REC.get("status") != "done":
                    CURRENT_TARGET_REC["status"] = "skipped"
                rec_id = CURRENT_TARGET_REC.get("id")
                for r in recs:
                    if (rec_id and r.get("id") == rec_id) or (r.get("name") == CURRENT_TARGET_REC.get("name")):
                        if r.get("status") != "done":
                            r["status"] = "skipped"
            if isinstance(next_idx, int) and 0 <= next_idx < len(recs):
                SYNCED_STATE["currentIndex"] = next_idx

            WAITING_FOR_USER_ENTER = False
            BOT_RUNNING = True

        threading.Thread(target=load_and_dispatch_next, args=(seq_id,), daemon=True).start()
        return {"ok": True, "status": "skipped_and_resumed", "port": 5199}

    if sub == "dispatch":
        ensure_listeners_started()
        target_name = body.get("name") or body.get("recipient") or ""
        if isinstance(target_name, dict):
            target_rec = target_name
            target_name = str(target_rec.get("name") or target_rec.get("이름") or "")
        else:
            target_name = str(target_name)
            target_rec = body.get("recipient") if isinstance(body.get("recipient"), dict) else {"name": target_name, "이름": target_name}

        message = body.get("message") or body.get("msg") or body.get("text") or ""
        blocks = body.get("blocks", None)
        condition = body.get("condition", None)
        mode = body.get("mode", "classic")
        channel = body.get("channel", SYNCED_STATE.get("channel", "kakao"))

        if not target_name or (not message and not blocks):
            return {
                "ok": False,
                "status": "error",
                "message": "name과 message(또는 blocks)는 필수입니다.",
            }

        result = execute_dispatch(target_name, message, mode, blocks, target_rec, condition, channel)
        result["ok"] = result.get("status") == "success"
        return result

    if sub == "self-update":
        return {
            "ok": True,
            "status": "success",
            "port": 5199,
            "old_version": SENSEBOT_VERSION,
            "new_version": SENSEBOT_VERSION,
            "version": SENSEBOT_VERSION,
            "message": f"Merlin_Z_Core 내장 센스톡 엔진(v{SENSEBOT_VERSION}) 최신 상태입니다.",
        }

    return {"ok": False, "error": f"Unknown POST endpoint: /api/senstalk/{sub}"}


def handle_request(action: str, payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """/__merlin/query 통합 브릿지 경유 호출 시 진입점"""
    act = (action or "health").strip("/").lower()
    if act in ("health", "status", "poll"):
        return handle_get(act)
    return handle_post(act, payload or {})
'''

out_path = r'd:\Ghosti\universal_z_core\os_agent\plugin_senstalk.py'
full_code = header + core_body + footer
compile(full_code, out_path, 'exec')
open(out_path, 'w', encoding='utf-8', newline='\n').write(full_code)
print('Successfully synced plugin_senstalk.py to v3.3, lines:', len(full_code.splitlines()))
