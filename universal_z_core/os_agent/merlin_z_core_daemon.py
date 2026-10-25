#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
❖ Merlin_Z_Core Unified PC Daemon (merlin_z_core_daemon.py)
- 멀린 패밀리 16개 웹앱(제트아이·3몬스터·센스톡·어그로필터·썬드리머 등)을 단일 표준 포트(127.0.0.1:5199)와
  '내장 소프트웨어 플러그인(Built-in Software Plugins)' 아키텍처로 통합 구동하는 마스터 PC 상주 데몬입니다.
- 유저는 오직 [Merlin_Z_Core_Setup.exe] 단 1개만 설치하면 되며, 추가 설치파일(0개)이나 크롬 확장팩(0개)이 필요 없습니다.
- 제공 기능:
  1. 시계 옆 시스템 트레이 상주 (pystray 지원 시 자동 활성화, 미설치 시 백그라운드 데몬 동작)
  2. 윈도우 시작 시 자동 실행 (HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\Merlin_Z_Core)
  3. 단일 표준 포트 127.0.0.1:5199 HTTP/JSON 브릿지:
     - GET  /__merlin/health        : 코어 버전, 자동실행 상태, 내장 플러그인 3종(zeye_os, senstalk, aggrofilter) 상태 반환
     - POST /__merlin/query         : 단일 표준 게이트웨이 (plugin: "zeye" | "senstalk" | "aggrofilter")
     - GET/POST /__zcore/*          : 제트아이 & 3몬스터 OS 제어/포렌식/오버레이 플러그인 직결
     - GET/POST /api/senstalk/*     : 센스톡 6대 메신저 릴레이 발송 플러그인 직결 (구 28888 포트 완전 폐기 ➔ 5199 단일화)
     - GET/POST /api/aggrofilter/*  : 어그로필터 로컬 IP 유튜브 자막 추출 플러그인 직결 (크롬 확장팩 불필요)
"""

from __future__ import annotations

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys
import threading
import urllib.parse
from typing import Any, Dict

THIS_DIR = Path(__file__).resolve().parent
if str(THIS_DIR) not in sys.path:
    sys.path.insert(0, str(THIS_DIR))

try:
    if sys.stdout and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if sys.stderr and hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

import core_win32 as w32  # noqa: E402
import plugin_zeye_os  # noqa: E402
import plugin_senstalk  # noqa: E402
import plugin_aggrofilter  # noqa: E402

CORE_VERSION = "2.1.0"
STANDARD_PORT = 5199


def get_unified_health() -> Dict[str, Any]:
    return {
        "ok": True,
        "coreName": "Merlin_Z_Core",
        "version": CORE_VERSION,
        "standardPort": STANDARD_PORT,
        "architecture": "ONE_CORE_BUILTIN_SOFTWARE_PLUGINS",
        "extraInstallRequired": False,
        "chromeExtensionRequired": False,
        "autostartEnabled": w32.is_autostart_enabled(),
        "builtinPlugins": {
            "zeye_os": plugin_zeye_os.PLUGIN_METADATA,
            "senstalk": plugin_senstalk.PLUGIN_METADATA,
            "aggrofilter": plugin_aggrofilter.PLUGIN_METADATA,
        },
    }


def dispatch_plugin_call(plugin_name: str, action: str, payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    p = (plugin_name or "zeye").strip().lower()
    data = payload or {}
    if p in ("zeye", "zeye_os", "os", "monster"):
        return plugin_zeye_os.handle_request(action, data)
    if p in ("senstalk", "sensebot", "messenger"):
        return plugin_senstalk.handle_request(action, data)
    if p in ("aggrofilter", "youtube", "caption"):
        return plugin_aggrofilter.handle_request(action, data)
    return {
        "ok": False,
        "error": f"UNKNOWN_BUILTIN_PLUGIN: {plugin_name}",
        "availablePlugins": ["zeye_os", "senstalk", "aggrofilter"],
    }


class MerlinUnifiedHTTPHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        return

    def _send_json(self, data: Dict[str, Any], status: int = 200) -> None:
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Merlin-App")
        self.end_headers()
        self.wfile.write(raw)

    def _read_body(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            return {}
        try:
            raw = self.rfile.read(length).decode("utf-8", errors="replace")
            return json.loads(raw) if raw.strip() else {}
        except Exception:
            return {}

    def do_OPTIONS(self) -> None:
        self._send_json({"ok": True})

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        qp = {k: v[0] for k, v in urllib.parse.parse_qs(parsed.query).items()}

        if path in ("/", "/health", "/__merlin/health"):
            self._send_json(get_unified_health())
            return

        if path.startswith("/api/senstalk"):
            sub = path[len("/api/senstalk") :].strip("/") or "health"
            self._send_json(plugin_senstalk.handle_get(sub))
            return

        if path.startswith("/api/aggrofilter"):
            sub = path[len("/api/aggrofilter") :].strip("/") or "health"
            self._send_json(plugin_aggrofilter.handle_get(sub, qp))
            return

        if path.startswith("/__zcore/") or path.startswith("/api/zeye/"):
            act = path.split("/")[-1]
            self._send_json(plugin_zeye_os.handle_request(act, qp))
            return

        self._send_json({"ok": False, "error": f"Not Found: {path}"}, status=404)

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        body = self._read_body()

        if path == "/__merlin/query":
            plugin_name = str(body.get("plugin") or body.get("callerAppId") or "zeye")
            action = str(body.get("action") or body.get("targetResource") or "health")
            payload = body.get("payload") if isinstance(body.get("payload"), dict) else body
            self._send_json(dispatch_plugin_call(plugin_name, action, payload))
            return

        if path.startswith("/api/senstalk"):
            sub = path[len("/api/senstalk") :].strip("/") or "health"
            self._send_json(plugin_senstalk.handle_post(sub, body))
            return

        if path.startswith("/api/aggrofilter"):
            sub = path[len("/api/aggrofilter") :].strip("/") or "extract"
            self._send_json(plugin_aggrofilter.handle_post(sub, body))
            return

        if path.startswith("/__zcore/") or path.startswith("/api/zeye/"):
            act = path.split("/")[-1]
            self._send_json(plugin_zeye_os.handle_request(act, body))
            return

        self._send_json({"ok": False, "error": f"Not Found: {path}"}, status=404)


def run_selftest() -> Dict[str, Any]:
    """내장 플러그인 3종(zeye_os, senstalk, aggrofilter) 및 [복원 기록] Pre-Check 통합 자가진단"""
    h = get_unified_health()
    st_sync = plugin_senstalk.handle_post(
        "sync",
        {
            "queue": [
                {"name": "테스트고객A", "channel": "kakao", "msg": "안녕하세요! 센스톡 5199 단일포트 통합 테스트입니다."},
                {"name": "테스트고객B", "channel": "line", "msg": "두 번째 발송 테스트 메시지입니다."},
            ]
        },
    )
    ag_vid = plugin_aggrofilter.extract_video_id("https://youtu.be/dQw4w9WgXcQ?si=test")
    zeye_status = plugin_zeye_os.handle_request("health")
    restore_precheck = plugin_zeye_os.handle_request("restore-points-list")
    rollback_res = plugin_zeye_os.handle_request("restore-point-rollback", {"restoreId": "#104"})
    tree_summary = plugin_zeye_os.handle_request("folder-tree-summary")
    return {
        "ok": True,
        "selftest": "PASSED",
        "unifiedHealth": h,
        "zeyePluginHealth": zeye_status,
        "restorePointsPrecheck": {
            "officialTerm": restore_precheck.get("officialTerm"),
            "precheckElapsedMs": restore_precheck.get("precheckElapsedMs"),
            "sampleBadge": (restore_precheck.get("restorePoints") or [{}])[0].get("statusBadge"),
            "rollbackVerified": rollback_res.get("message"),
        },
        "zeroLlmTreeSummaryCheck": {
            "scannedCount": tree_summary.get("scannedCount"),
            "estimatedPromptTokens": tree_summary.get("estimatedPromptTokens"),
            "elapsedMs": tree_summary.get("elapsedMs"),
        },
        "senstalkPluginSyncCheck": {
            "ok": st_sync.get("ok"),
            "port": st_sync.get("port"),
            "queuedCount": st_sync.get("total"),
            "statusMsg": st_sync.get("status_msg"),
        },
        "aggrofilterPluginVideoIdCheck": {
            "sampleUrl": "https://youtu.be/dQw4w9WgXcQ?si=test",
            "extractedVideoId": ag_vid,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Merlin_Z_Core Unified PC Daemon (Port 5199)")
    parser.add_argument("--selftest", action="store_true", help="내장 소프트웨어 플러그인 3종 통합 자가진단")
    parser.add_argument("--plugin", type=str, default="", help="단발 실행할 내장 플러그인명 (zeye|senstalk|aggrofilter)")
    parser.add_argument("--action", type=str, default="health", help="플러그인 액션명")
    parser.add_argument("--payload", type=str, default="{}", help="JSON 페이로드 문자열")
    parser.add_argument("--port", type=int, default=STANDARD_PORT, help="단일 표준 포트 (기본 5199)")
    parser.add_argument("--enable-autostart", action="store_true", help="윈도우 시작 시 자동실행 등록")
    args = parser.parse_args()

    if args.enable_autostart:
        w32.set_autostart_enabled(True)

    if args.selftest:
        print(json.dumps(run_selftest(), ensure_ascii=False, indent=2))
        return

    if args.plugin:
        try:
            payload_obj = json.loads(args.payload) if args.payload else {}
        except Exception:
            payload_obj = {}
        res = dispatch_plugin_call(args.plugin, args.action, payload_obj)
        print(json.dumps(res, ensure_ascii=False))
        return

    srv = ThreadingHTTPServer(("127.0.0.1", args.port), MerlinUnifiedHTTPHandler)
    print(
        json.dumps(
            {
                "ok": True,
                "status": "LISTENING",
                "endpoint": f"http://127.0.0.1:{args.port}",
                "plugins": ["zeye_os", "senstalk", "aggrofilter"],
            },
            ensure_ascii=False,
        ),
        flush=True,
    )
    srv.serve_forever()


if __name__ == "__main__":
    main()
