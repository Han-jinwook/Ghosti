#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[내장 소프트웨어 플러그인 2] plugin_senstalk.py
- 센스톡(SensTalk) 6대 메신저(카카오톡·라인·텔레그램·왓츠앱·위챗·인스타그램 DM) 릴레이 발송 플러그인
- 별도 설치파일이나 구형 포트(28888) 없이, 제트아이 단일 표준 포트(127.0.0.1:5199)의
  Merlin_Z_Core 내부에서 소프트웨어적으로 직결 작동합니다.
- 유휴 시 CPU 점유율 0.0% 유지: /api/senstalk/sync 또는 /api/senstalk/start 호출 시에만
  On-Demand로 [Enter]/[F8]/[F9] 키 리스너 스레드를 깨웁니다.
"""

from __future__ import annotations

import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import sys
import threading
import time
from typing import Any, Dict, List

THIS_DIR = Path(__file__).resolve().parent
if str(THIS_DIR) not in sys.path:
    sys.path.insert(0, str(THIS_DIR))

import core_win32 as w32  # noqa: E402

LOCAL_APPDATA = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
MERLIN_DIR = LOCAL_APPDATA / "Merlin"
STATE_FILE = MERLIN_DIR / "senstalk_plugin_state.json"

PLUGIN_METADATA = {
    "pluginId": "senstalk",
    "pluginName": "SensTalk 6-Messenger Relay Dispatch Plugin",
    "version": "2.4.0",
    "type": "BUILTIN_SOFTWARE_PLUGIN",
    "port": 5199,
    "basePath": "/api/senstalk",
    "supportedChannels": ["kakao", "line", "telegram", "whatsapp", "wechat", "insta"],
}

MESSENGER_HINTS: Dict[str, List[str]] = {
    "kakao": ["카카오톡", "kakaotalk"],
    "line": ["line", "라인"],
    "telegram": ["telegram", "텔레그램"],
    "whatsapp": ["whatsapp", "왓츠앱"],
    "wechat": ["wechat", "weixin", "위챗"],
    "insta": ["instagram", "인스타그램", "chrome", "msedge"],
}


class SensTalkPluginEngine:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.queue: List[Dict[str, Any]] = []
        self.idx: int = 0
        self.running: bool = False
        self.paused: bool = False
        self.waiting_enter: bool = False
        self.status_msg: str = "대기 중 (127.0.0.1:5199 내장 플러그인)"
        self.logs: List[str] = []
        self._listeners_started = False
        self._load_state()

    def _ensure_dir(self) -> None:
        MERLIN_DIR.mkdir(parents=True, exist_ok=True)

    def _load_state(self) -> None:
        try:
            if STATE_FILE.exists():
                raw = json.loads(STATE_FILE.read_text(encoding="utf-8"))
                self.queue = raw.get("queue", []) if isinstance(raw.get("queue"), list) else []
                self.idx = int(raw.get("idx", 0))
                self.running = bool(raw.get("running", False))
                self.paused = bool(raw.get("paused", False))
                self.waiting_enter = bool(raw.get("waiting_enter", False))
                self.status_msg = str(raw.get("status_msg", self.status_msg))
                self.logs = raw.get("logs", [])[-30:] if isinstance(raw.get("logs"), list) else []
        except Exception:
            pass

    def _save_state(self) -> None:
        try:
            self._ensure_dir()
            payload = {
                "queue": self.queue,
                "idx": self.idx,
                "running": self.running,
                "paused": self.paused,
                "waiting_enter": self.waiting_enter,
                "status_msg": self.status_msg,
                "logs": self.logs[-30:],
                "updatedAt": time.time(),
            }
            STATE_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass

    def add_log(self, msg: str) -> None:
        stamp = time.strftime("%H:%M:%S")
        line = f"[{stamp}] {msg}"
        self.logs.append(line)
        if len(self.logs) > 30:
            self.logs = self.logs[-30:]
        self.status_msg = msg
        self._save_state()

    def find_messenger_window(self, channel: str, recipient_name: str = "") -> Dict[str, Any] | None:
        """현재 데스크톱에서 대상 메신저 창 또는 수신자 대화창 HWND를 탐지합니다."""
        w32.bind_interactive_desktop()
        user32 = ctypes.windll.user32
        hints = [h.lower() for h in MESSENGER_HINTS.get(channel.lower(), ["카카오톡", "kakaotalk"])]
        rec_lower = recipient_name.strip().lower()
        candidates: List[Dict[str, Any]] = []

        WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

        def enum_proc(hwnd: int, _lparam: int) -> bool:
            hw = wintypes.HWND(hwnd)
            if not user32.IsWindowVisible(hw):
                return True
            length = user32.GetWindowTextLengthW(hw)
            if length <= 0:
                return True
            buf = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hw, buf, length + 1)
            title = buf.value.strip()
            if not title:
                return True
            t_low = title.lower()
            score = 0
            if rec_lower and rec_lower in t_low:
                score += 100
            if any(h in t_low for h in hints):
                score += 50
            if score > 0:
                rect = wintypes.RECT()
                user32.GetWindowRect(hw, ctypes.byref(rect))
                candidates.append(
                    {
                        "hwnd": int(hwnd),
                        "title": title,
                        "score": score,
                        "rect": [int(rect.left), int(rect.top), int(rect.right - rect.left), int(rect.bottom - rect.top)],
                    }
                )
            return True

        try:
            cb = WNDENUMPROC(enum_proc)
            user32.EnumWindows(cb, 0)
        except Exception:
            pass

        if not candidates:
            return None
        candidates.sort(key=lambda c: c["score"], reverse=True)
        return candidates[0]

    def stage_current_item_to_clipboard(self) -> Dict[str, Any]:
        """현재 차례(idx) 발송 대상의 텍스트 또는 카드 이미지를 클립보드에 장전합니다."""
        if not (0 <= self.idx < len(self.queue)):
            return {"ok": False, "error": "QUEUE_EXHAUSTED"}
        item = self.queue[self.idx]
        name = str(item.get("name") or item.get("recipient") or "수신자")
        channel = str(item.get("channel") or "kakao")
        msg = str(item.get("msg") or item.get("text") or item.get("message") or "")
        card_data_url = str(item.get("cardImageDataUrl") or item.get("imageDataUrl") or "")

        clip_ok = False
        if card_data_url.startswith("data:image/"):
            clip_ok = w32.set_clipboard_image_dataurl(card_data_url)
        if not clip_ok and msg:
            clip_ok = w32.set_clipboard_unicode(msg)

        win = self.find_messenger_window(channel, name)
        if win:
            w32.force_foreground_window(win["hwnd"])

        item["status"] = "waiting_enter"
        self.waiting_enter = True
        self.add_log(f"🎯 [{name}] ({channel}) 클립보드 장전 완료 — 대화창에서 붙여넣기 후 [Enter] 시 다음 타겟으로 자동 이동")
        return {
            "ok": True,
            "idx": self.idx,
            "name": name,
            "channel": channel,
            "clipboardStaged": clip_ok,
            "matchedWindow": win,
        }

    def ensure_listeners_started(self) -> None:
        """/sync 또는 /start 호출 시에만 키 감지 스레드를 On-Demand 기동 (평소 CPU 0.0%)"""
        if self._listeners_started:
            return
        self._listeners_started = True
        t = threading.Thread(target=self._hotkey_and_enter_loop, daemon=True, name="SensTalkPluginKeyLoop")
        t.start()

    def _hotkey_and_enter_loop(self) -> None:
        user32 = ctypes.windll.user32
        VK_RETURN = 0x0D
        VK_F8 = 0x77
        VK_F9 = 0x78
        was_enter = False
        was_f8 = False
        was_f9 = False

        while True:
            try:
                if not self.running and not self.waiting_enter:
                    time.sleep(0.25)
                    continue

                f8_down = bool(user32.GetAsyncKeyState(VK_F8) & 0x8000)
                if f8_down and not was_f8:
                    self.toggle_pause()
                was_f8 = f8_down

                f9_down = bool(user32.GetAsyncKeyState(VK_F9) & 0x8000)
                if f9_down and not was_f9:
                    self.skip_current()
                was_f9 = f9_down

                enter_down = bool(user32.GetAsyncKeyState(VK_RETURN) & 0x8000)
                if was_enter and not enter_down and self.running and not self.paused and self.waiting_enter:
                    with self.lock:
                        if 0 <= self.idx < len(self.queue):
                            self.queue[self.idx]["status"] = "done"
                            done_name = self.queue[self.idx].get("name", f"#{self.idx + 1}")
                            self.idx += 1
                            if self.idx < len(self.queue):
                                self.add_log(f"✅ [{done_name}] 발송 완료! 다음 타겟({self.idx + 1}/{len(self.queue)}) 자동 장전")
                                self.stage_current_item_to_clipboard()
                            else:
                                self.running = False
                                self.waiting_enter = False
                                self.add_log(f"🎉 전체 {len(self.queue)}명 발송 큐 완료!")
                was_enter = enter_down
            except Exception:
                pass
            time.sleep(0.04)

    def sync_queue(self, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        with self.lock:
            self.queue = []
            for raw in items:
                if not isinstance(raw, dict):
                    continue
                row = dict(raw)
                row.setdefault("status", "ready")
                row.setdefault("channel", "kakao")
                self.queue.append(row)
            self.idx = 0
            self.running = False
            self.paused = False
            self.waiting_enter = False
            self.add_log(f"📥 발송 대기열 {len(self.queue)}건 동기화 완료 (포트 5199 내장 플러그인)")
            return self.get_poll_state()

    def start_run(self, start_idx: int | None = None) -> Dict[str, Any]:
        with self.lock:
            self._load_state()
            if not self.queue:
                return {"ok": False, "error": "EMPTY_QUEUE", "message": "발송 대기열이 비어 있습니다."}
            if start_idx is not None and 0 <= start_idx < len(self.queue):
                self.idx = start_idx
            elif self.idx >= len(self.queue):
                self.idx = 0
            self.running = True
            self.paused = False
            self.ensure_listeners_started()
            stage_res = self.stage_current_item_to_clipboard()
            return {
                "ok": True,
                "stage": stage_res,
                "state": self.get_poll_state(),
            }

    def toggle_pause(self) -> Dict[str, Any]:
        with self.lock:
            self._load_state()
            self.paused = not self.paused
            self.add_log("⏸ 발송 일시정지 (F8)" if self.paused else "▶ 발송 재개 (F8)")
            return self.get_poll_state()

    def skip_current(self) -> Dict[str, Any]:
        with self.lock:
            self._load_state()
            if 0 <= self.idx < len(self.queue):
                skipped_name = self.queue[self.idx].get("name", f"#{self.idx + 1}")
                self.queue[self.idx]["status"] = "skip"
                self.idx += 1
                self.add_log(f"⏭ [{skipped_name}] 건너뛰기 완료 (F9)")
                if self.running and self.idx < len(self.queue):
                    self.stage_current_item_to_clipboard()
                elif self.idx >= len(self.queue):
                    self.running = False
                    self.waiting_enter = False
                    self.add_log("🎉 전체 발송 대기열 처리가 끝났습니다.")
            return self.get_poll_state()

    def dispatch_single(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """단건 즉시 클립보드 장전 및 메신저 창 포커스 호출"""
        with self.lock:
            self.queue = [
                {
                    "name": data.get("name") or data.get("recipient") or "수신자",
                    "channel": data.get("channel") or "kakao",
                    "msg": data.get("msg") or data.get("text") or "",
                    "cardImageDataUrl": data.get("cardImageDataUrl") or "",
                    "status": "ready",
                }
            ]
            self.idx = 0
            self.running = True
            self.paused = False
            self.ensure_listeners_started()
            stage_res = self.stage_current_item_to_clipboard()
            return {"ok": True, "dispatched": stage_res, "state": self.get_poll_state()}

    def get_poll_state(self) -> Dict[str, Any]:
        self._load_state()
        total = len(self.queue)
        done_cnt = sum(1 for x in self.queue if x.get("status") == "done")
        skip_cnt = sum(1 for x in self.queue if x.get("status") == "skip")
        return {
            "ok": True,
            "plugin": "senstalk",
            "port": 5199,
            "running": self.running,
            "paused": self.paused,
            "waiting_enter": self.waiting_enter,
            "idx": self.idx,
            "total": total,
            "doneCount": done_cnt,
            "skipCount": skip_cnt,
            "status_msg": self.status_msg,
            "queue": self.queue,
            "logs": self.logs[-15:],
            "autostart": w32.is_autostart_enabled(),
        }


ENGINE = SensTalkPluginEngine()


def handle_get(subpath: str) -> Dict[str, Any]:
    sub = (subpath or "health").strip("/").lower()
    if sub in ("", "health", "status"):
        return {
            "ok": True,
            "service": "Merlin_Z_Core_SensTalk_Plugin",
            "version": PLUGIN_METADATA["version"],
            "port": 5199,
            "autostart": w32.is_autostart_enabled(),
            "plugin": PLUGIN_METADATA,
            "state": ENGINE.get_poll_state(),
        }
    if sub == "autostart":
        return {"ok": True, "enabled": w32.is_autostart_enabled()}
    if sub == "poll":
        return ENGINE.get_poll_state()
    return {"ok": False, "error": f"Unknown GET endpoint: /api/senstalk/{sub}"}


def handle_post(subpath: str, data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    sub = (subpath or "").strip("/").lower()
    body = data or {}

    if sub == "autostart":
        enable = bool(body.get("enabled", True))
        ok = w32.set_autostart_enabled(enable)
        return {"ok": ok, "enabled": w32.is_autostart_enabled()}

    if sub == "sync":
        items = body.get("queue") or body.get("items") or []
        if not isinstance(items, list):
            items = []
        return ENGINE.sync_queue(items)

    if sub == "start":
        start_idx = body.get("idx")
        return ENGINE.start_run(int(start_idx) if isinstance(start_idx, int) else None)

    if sub == "pause":
        return ENGINE.toggle_pause()

    if sub == "skip":
        return ENGINE.skip_current()

    if sub == "dispatch":
        return ENGINE.dispatch_single(body)

    if sub == "self-update":
        return {
            "ok": True,
            "port": 5199,
            "version": PLUGIN_METADATA["version"],
            "message": "Merlin_Z_Core 단일 코어 내장 플러그인 최신 상태입니다 (별도 설치 불필요).",
        }

    return {"ok": False, "error": f"Unknown POST endpoint: /api/senstalk/{sub}"}


def handle_request(action: str, payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """/__merlin/query 통합 브릿지 경유 호출 시 진입점"""
    act = (action or "health").strip("/").lower()
    if act in ("health", "status", "poll"):
        return handle_get(act)
    return handle_post(act, payload or {})
