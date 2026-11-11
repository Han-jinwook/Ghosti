#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
❖ Merlin_Z_Core Unified PC Daemon (merlin_z_core_daemon.py)
- 멀린 패밀리 16개 웹앱(귀신같이·3몬스터·센스톡·어그로필터·썬드리머 등)을 단일 표준 포트(127.0.0.1:5199)와
  '내장 소프트웨어 플러그인(Built-in Software Plugins)' 아키텍처로 통합 구동하는 마스터 PC 상주 데몬입니다.
- 유저는 오직 [Merlin_Z_Core_Setup.exe] 단 1개만 설치하면 되며, 추가 설치파일(0개)이나 크롬 확장팩(0개)이 필요 없습니다.
- 제공 기능:
  1. 시계 옆 시스템 트레이 상주 (pystray 지원 시 자동 활성화, 미설치 시 백그라운드 데몬 동작)
  2. 윈도우 시작 시 자동 실행 (HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\Merlin_Z_Core)
  3. 단일 표준 포트 127.0.0.1:5199 HTTP/JSON 브릿지:
     - GET  /__merlin/health        : 코어 버전, 자동실행 상태, 내장 플러그인 3종(ghosti_os, senstalk, aggrofilter) 상태 반환
     - POST /__merlin/query         : 단일 표준 게이트웨이 (plugin: "ghosti" | "senstalk" | "aggrofilter")
     - GET/POST /__zcore/*          : 귀신같이 & 3몬스터 OS 제어/포렌식/오버레이 플러그인 직결
     - GET/POST /api/senstalk/*     : 센스톡 6대 메신저 릴레이 발송 플러그인 직결 (구 28888 포트 완전 폐기 ➔ 5199 단일화)
     - GET/POST /api/aggrofilter/*  : 어그로필터 로컬 IP 유튜브 자막 추출 플러그인 직결 (크롬 확장팩 불필요)
"""

from __future__ import annotations

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
from typing import Any, Dict

THIS_DIR = Path(__file__).resolve().parent
if str(THIS_DIR) not in sys.path:
    sys.path.insert(0, str(THIS_DIR))

try:
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w", encoding="utf-8")
    elif hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w", encoding="utf-8")
    elif hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

import core_win32 as w32  # noqa: E402
import plugin_ghosti_os  # noqa: E402
import plugin_senstalk  # noqa: E402
import plugin_aggrofilter  # noqa: E402
import ghosti_setup_parity  # noqa: E402
import plugin_ghosti_superpowers  # noqa: E402

CORE_VERSION = "2.3.4"
STANDARD_PORT = 5199
_BUNDLE_DIR = Path(getattr(sys, "_MEIPASS", str(THIS_DIR)))
TRAY_ICON_ICO = (_BUNDLE_DIR / "favicon.ico") if (_BUNDLE_DIR / "favicon.ico").exists() else (THIS_DIR / "favicon.ico")
TRAY_LOGO_PNG = (_BUNDLE_DIR / "logo-symbol.png") if (_BUNDLE_DIR / "logo-symbol.png").exists() else (THIS_DIR / "logo-symbol.png")


def get_unified_health() -> Dict[str, Any]:
    return {
        "ok": True,
        "coreName": "Merlin_Z_Core",
        "version": CORE_VERSION,
        "standardPort": STANDARD_PORT,
        "brandAssets": {
            "trayIconIco": str(TRAY_ICON_ICO),
            "logoSymbolPng": str(TRAY_LOGO_PNG),
            "webPublicLogo": "/logo-symbol.png",
            "webFavicon": "/favicon.ico",
        },
        "architecture": "ONE_CORE_BUILTIN_SOFTWARE_PLUGINS",
        "extraInstallRequired": False,
        "chromeExtensionRequired": False,
        "autostartEnabled": w32.is_autostart_enabled(),
        "builtinPlugins": {
            "ghosti_os": plugin_ghosti_os.PLUGIN_METADATA,
            "senstalk": plugin_senstalk.PLUGIN_METADATA,
            "aggrofilter": plugin_aggrofilter.PLUGIN_METADATA,
        },
    }


def dispatch_plugin_call(plugin_name: str, action: str, payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    p = (plugin_name or "ghosti").strip().lower()
    data = payload or {}
    if p in ("ghosti", "ghosti_os", "os", "monster"):
        return plugin_ghosti_os.handle_request(action, data)
    if p in ("senstalk", "sensebot", "messenger"):
        return plugin_senstalk.handle_request(action, data)
    if p in ("aggrofilter", "youtube", "caption"):
        return plugin_aggrofilter.handle_request(action, data)
    return {
        "ok": False,
        "error": f"UNKNOWN_BUILTIN_PLUGIN: {plugin_name}",
        "availablePlugins": ["ghosti_os", "senstalk", "aggrofilter"],
    }


_ALLOWED_ORIGIN_EXACT = {
    "https://sundreamer.app",
    "https://ghosti-app.netlify.app",
    "capacitor://localhost",
    "ionic://localhost",
}


def is_trusted_origin(origin: str | None) -> bool:
    """파일을 옮기거나 만드는 요청은 멀린 패밀리 공식 도메인·Netlify QA·로컬 개발 화면·사내망에서만 허용한다.
    (Origin 헤더가 없는 요청은 브라우저가 아닌 로컬 프로그램이므로 허용)"""
    if not origin:
        return True
    o = origin.strip().lower().rstrip("/")
    if o in _ALLOWED_ORIGIN_EXACT:
        return True
    try:
        u = urllib.parse.urlparse(o)
    except Exception:
        return False
    host = (u.hostname or "").lower()
    if not host:
        return True
    # 로컬 개발 및 사내망(Office LAN)
    if host in ("localhost", "127.0.0.1") or host.startswith("192.168.") or host.startswith("10.") or host.startswith("172.16."):
        return True
    # 멀린 패밀리 공식 도메인 (sundreamer.app, merlincode.com)
    if host.endswith(".sundreamer.app") or host == "sundreamer.app":
        return True
    if host.endswith(".merlincode.com") or host == "merlincode.com":
        return True
    # Netlify 전 도메인 허용 (ghosti-app.netlify.app, deploy-preview, branch preview 등 QA 전수 허용)
    if host.endswith(".netlify.app") or host == "netlify.app":
        return True
    # 하이브리드 앱
    if u.scheme in ("capacitor", "ionic", "tauri", "file"):
        return True
    return False


_TRAY_HWND: int = 0


def remove_win32_tray_icon() -> None:
    """우아한 종료(/__merlin/shutdown) 또는 프로세스 교체 시 유령(Ghost) 트레이 아이콘이 남지 않도록 즉시 삭제합니다."""
    global _TRAY_HWND
    if sys.platform != "win32" or not _TRAY_HWND:
        return
    try:
        import win32gui

        win32gui.Shell_NotifyIcon(win32gui.NIM_DELETE, (_TRAY_HWND, 0))
        _TRAY_HWND = 0
    except Exception:
        pass


class MerlinUnifiedHTTPHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        return

    def _reject_untrusted(self) -> bool:
        """신뢰할 수 없는 출처면 403 응답 후 True 반환"""
        origin = self.headers.get("Origin")
        if is_trusted_origin(origin):
            return False
        self._send_json({"ok": False, "error": "UNTRUSTED_ORIGIN", "origin": origin}, status=403)
        return True

    def _send_json(self, data: Dict[str, Any], status: int = 200) -> None:
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Merlin-App, Range")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()
        self.wfile.write(raw)

    def _send_bytes(self, data: bytes, content_type: str = "application/octet-stream", status: int = 200) -> None:
        total_len = len(data)
        range_header = self.headers.get("Range")
        if status == 200 and range_header and range_header.strip().lower().startswith("bytes="):
            try:
                spec = range_header.strip()[6:].split(",")[0].strip()
                start_s, end_s = spec.split("-", 1)
                start = int(start_s) if start_s else 0
                end = int(end_s) if end_s else total_len - 1
                start = max(0, min(start, total_len - 1))
                end = max(start, min(end, total_len - 1))
                chunk = data[start : end + 1]
                self.send_response(206)
                self.send_header("Content-Type", content_type)
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Range", f"bytes {start}-{end}/{total_len}")
                self.send_header("Content-Length", str(len(chunk)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Merlin-App, Range")
                self.send_header("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length")
                self.send_header("Access-Control-Allow-Private-Network", "true")
                self.end_headers()
                self.wfile.write(chunk)
                return
            except Exception:
                pass
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(total_len))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Merlin-App, Range")
        self.send_header("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()
        self.wfile.write(data)

    def _send_file_stream(self, file_path: Path, content_type: str = "application/octet-stream", cache_max_age: int = 3600) -> None:
        """대용량 동영상·이미지를 전체 RAM 로드 없이 디스크 seek + 256KB 청크(HTTP 206 Range)로 즉시 스트리밍합니다."""
        try:
            total_len = os.path.getsize(file_path)
        except Exception:
            self._send_json({"ok": False, "error": "FILE_NOT_FOUND"}, status=404)
            return

        start = 0
        end = max(0, total_len - 1)
        is_partial = False
        range_header = self.headers.get("Range")
        if total_len > 0 and range_header and range_header.strip().lower().startswith("bytes="):
            try:
                spec = range_header.strip()[6:].split(",")[0].strip()
                start_s, end_s = spec.split("-", 1)
                if start_s == "" and end_s != "":
                    suffix_len = int(end_s)
                    start = max(0, total_len - suffix_len)
                    end = total_len - 1
                else:
                    start = int(start_s) if start_s else 0
                    end = int(end_s) if end_s else total_len - 1
                if start >= total_len:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{total_len}")
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    return
                start = max(0, start)
                end = max(start, min(end, total_len - 1))
                is_partial = True
            except Exception:
                start = 0
                end = max(0, total_len - 1)
                is_partial = False

        send_len = (end - start + 1) if total_len > 0 else 0
        try:
            self.send_response(206 if is_partial else 200)
            self.send_header("Content-Type", content_type)
            self.send_header("Accept-Ranges", "bytes")
            if is_partial:
                self.send_header("Content-Range", f"bytes {start}-{end}/{total_len}")
            self.send_header("Content-Length", str(send_len))
            if cache_max_age > 0:
                self.send_header("Cache-Control", f"public, max-age={cache_max_age}")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Merlin-App, Range")
            self.send_header("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.end_headers()

            if send_len > 0:
                remaining = send_len
                with open(file_path, "rb") as fp:
                    if start > 0:
                        fp.seek(start)
                    while remaining > 0:
                        chunk = fp.read(min(262144, remaining))
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            pass

    def _send_transcoded_video_stream(self, file_path: Path, seek_sec: float = 0.0) -> None:
        """Windows 크롬에서 코덱 미지원으로 화면이 멈추는 HEVC(hvc1) 영상을 0.2초 내 초고속 H.264 MP4로 변환·캐싱하여 Range 탐색이 가능한 완전한 영상으로 스트리밍합니다."""
        ff = plugin_ghosti_os.find_ffmpeg_exe()
        if not ff:
            self._send_file_stream(file_path, content_type="video/mp4")
            return

        # 1) 이미 완성된 H.264 Faststart MP4 캐시가 있으면 대기 없이 0.01초 만에 Range 스트리밍으로 즉시 응답!
        #    (캐시가 아직 없으면 대기(0.0s)하지 않고 곧바로 아래 0.2초 파이프로 첫 프레임을 송출하면서 백그라운드로만 캐시를 생성합니다)
        cached_mp4 = plugin_ghosti_os.get_or_create_faststart_video_cache(file_path, max_sync_sec=0.0)
        if cached_mp4 is not None and cached_mp4.exists():
            self._send_file_stream(cached_mp4, content_type="video/mp4", cache_max_age=3600)
            return

        # 2) 대용량 장편 HEVC 영상(캐시 생성 중)은 0.2초 초고속 Fragmented 파이프로 즉시 첫 프레임을 송출하고 백그라운드 캐싱 병행
        creationflags = 0x08000000 if os.name == "nt" else 0
        cmd = [
            ff,
            "-hide_banner",
            "-loglevel",
            "error",
            "-probesize",
            "2M",
            "-analyzeduration",
            "1500000",
        ]
        if seek_sec > 0.2:
            cmd.extend(["-ss", f"{seek_sec:.2f}"])
        cmd.extend([
            "-i", str(file_path),
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-tune", "zerolatency",
            "-crf", "26",
            "-g", "15",
            "-pix_fmt", "yuv420p",
            "-vf", "scale='min(960,iw)':-2",
            "-c:a", "aac",
            "-b:a", "96k",
            "-frag_duration", "200000",
            "-movflags", "frag_keyframe+empty_moov+default_base_moof",
            "-f", "mp4",
            "pipe:1",
        ])
        proc = None
        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                creationflags=creationflags,
            )
            self.send_response(200)
            self.send_header("Content-Type", "video/mp4")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Merlin-App, Range")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.end_headers()
            if proc.stdout:
                while True:
                    chunk = proc.stdout.read(16384)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            pass
        finally:
            if proc is not None and proc.poll() is None:
                try:
                    proc.kill()
                except Exception:
                    pass

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
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Merlin-App, Range")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        qp = {k: v[0] for k, v in urllib.parse.parse_qs(parsed.query).items()}

        if path in ("/", "/health", "/__merlin/health"):
            self._send_json(get_unified_health())
            return

        if path in ("/__merlin/shutdown", "/__zcore/shutdown"):
            if self._reject_untrusted():
                return
            remove_win32_tray_icon()
            self._send_json({"ok": True, "message": "Merlin_Z_Core shutting down", "version": CORE_VERSION})
            threading.Thread(target=lambda: (time.sleep(0.15), os._exit(0)), daemon=True).start()
            return

        # [귀신같이 내 PC 전수 인덱싱 API: 사진 / 서류 / 동영상]
        if path in ("/__photos/list", "/api/ghosti/photos/list"):
            self._send_json(plugin_ghosti_os.list_local_photos(qp))
            return

        if path in ("/__photos/file", "/api/ghosti/photos/file"):
            f_path, mime, status = plugin_ghosti_os.resolve_local_media_file(qp)
            if f_path is not None and status == 200:
                self._send_file_stream(f_path, content_type=mime)
            else:
                self._send_json({"ok": False, "error": "FILE_NOT_FOUND"}, status=status)
            return

        if path in ("/__videos/thumb", "/api/ghosti/videos/thumb"):
            t_path, status = plugin_ghosti_os.get_or_create_video_thumb(qp)
            if t_path is not None and status == 200:
                self._send_file_stream(t_path, content_type="image/jpeg", cache_max_age=86400)
            else:
                self._send_json({"ok": False, "error": "THUMB_NOT_FOUND"}, status=status)
            return

        if path in ("/__videos/stream", "/api/ghosti/videos/stream"):
            f_path, _, status = plugin_ghosti_os.resolve_local_media_file(qp)
            if f_path is not None and status == 200:
                try:
                    seek_t = max(0.0, float(qp.get("t") or 0.0))
                except Exception:
                    seek_t = 0.0
                self._send_transcoded_video_stream(f_path, seek_sec=seek_t)
            else:
                self._send_json({"ok": False, "error": "VIDEO_NOT_FOUND"}, status=status)
            return

        if path in ("/__videos/frame", "/api/ghosti/videos/frame"):
            fn = str(qp.get("f") or qp.get("file") or "").strip()
            # public/poc/results/video_frames or poc/results/video_frames
            frame_cand = None
            if fn and not "/" in fn and not "\\" in fn and not ".." in fn:
                repo_root = Path(__file__).resolve().parents[2]
                for c in [
                    repo_root / "public" / "poc" / "results" / "video_frames" / fn,
                    repo_root / "poc" / "results" / "video_frames" / fn,
                    Path(__file__).resolve().parent / "video_frames" / fn,
                ]:
                    if c.exists() and c.is_file():
                        frame_cand = c
                        break
            if frame_cand:
                try:
                    self._send_bytes(frame_cand.read_bytes(), content_type="image/jpeg", status=200)
                    return
                except Exception:
                    pass
            self._send_json({"ok": False, "error": "FRAME_NOT_FOUND"}, status=404)
            return

        if path in ("/__docs/list", "/api/ghosti/docs/list"):
            self._send_json(plugin_ghosti_os.list_local_docs(qp))
            return

        if path in ("/__videos/list", "/__videos/index", "/api/ghosti/videos/list"):
            self._send_json(plugin_ghosti_os.list_local_videos(qp))
            return

        if path in ("/__faces/index", "/api/ghosti/faces/index"):
            self._send_json(ghosti_setup_parity.faces_index())
            return

        if path == "/api/superpower/status":
            self._send_json(plugin_ghosti_superpowers.get_superpower_status(qp))
            return

        if path in ("/__merlin/open-ghost-search", "/api/superpower/open_search_window"):
            self._send_json(plugin_ghosti_superpowers.open_ghost_search_window_api(qp))
            return

        if path == "/api/superpower/snippets":
            self._send_json({"ok": True, "snippets": plugin_ghosti_superpowers.get_snippets()})
            return

        if path == "/api/superpower/telemetry":
            self._send_json(plugin_ghosti_superpowers.get_telemetry())
            return

        if path == "/api/superpower/settings":
            self._send_json(plugin_ghosti_superpowers.get_superpower_settings_api())
            return

        if path == "/api/superpower/mailbox-sync":
            self._send_json(plugin_ghosti_superpowers.sync_e2ee_mailbox_api({}))
            return

        # [방어 21·22] 구 3대장 척결 독립 격리 플러그인 (Try-Except Firewall + Lazy-Import)
        if path.startswith("/api/care/"):
            try:
                import plugin_ghosti_care_suite  # Lazy-Import
                sub = path[len("/api/care/") :].strip("/")
                if sub in ("security-services/status", "security-status", "status"):
                    self._send_json(plugin_ghosti_care_suite.handle_care_suite_request("status", qp))
                    return
                if sub in ("defender/history", "guardian-history"):
                    self._send_json(plugin_ghosti_care_suite.handle_care_suite_request("guardian-history", qp))
                    return
                if sub in ("archive/peek", "peek-archive"):
                    self._send_json(plugin_ghosti_care_suite.handle_care_suite_request("peek-archive", qp))
                    return
                self._send_json(plugin_ghosti_care_suite.handle_care_suite_request(sub, qp))
                return
            except Exception as e:
                self._send_json({"ok": False, "isolatedFirewall": True, "error": str(e)}, status=200)
                return

        if path.startswith("/api/senstalk"):
            sub = path[len("/api/senstalk") :].strip("/") or "health"
            self._send_json(plugin_senstalk.handle_get(sub))
            return

        if path.startswith("/api/aggrofilter") or path.startswith("/aggrofilter"):
            prefix = "/api/aggrofilter" if path.startswith("/api/aggrofilter") else "/aggrofilter"
            sub = path[len(prefix) :].strip("/") or "health"
            self._send_json(plugin_aggrofilter.handle_get(sub, qp))
            return

        if path.startswith("/__zcore/") or path.startswith("/api/ghosti/"):
            act = path.split("/")[-1]
            if act.lower() in ("deep-uninstall-scan", "deep-uninstall-execute"):
                if self._reject_untrusted():
                    return
                try:
                    import plugin_ghosti_care_suite  # Lazy-Import
                    self._send_json(plugin_ghosti_care_suite.handle_care_suite_request(act.lower(), body))
                    return
                except Exception as exc:
                    self._send_json({"ok": False, "error": str(exc)}, status=200)
                    return
            mutating_set = getattr(plugin_ghosti_os, "MUTATING_ACTIONS", set())
            if act.lower() in mutating_set and self._reject_untrusted():
                return
            try:
                self._send_json(plugin_ghosti_os.handle_request(act, qp))
            except Exception as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=500)
            return

        # [고치기 보조 API — 개발서버 전용이던 기능 데몬 이관]
        if path == "/__setup-monster/tts-audio":
            audio, status = ghosti_setup_parity.tts_audio(qp.get("hash", ""))
            if audio is not None:
                self._send_bytes(audio, content_type="audio/mpeg", status=200)
            else:
                self._send_json({"ok": False, "error": "NOT_FOUND"}, status=status)
            return

        if path == "/__setup-monster/state":
            self._send_json(ghosti_setup_parity.handle_setup_monster("state", {}))
            return

        if path.startswith("/__models/"):
            rel = path[len("/__models/") :].lstrip("/")
            prefix = "onnx-community/embeddinggemma-2-ONNX/resolve/main/"
            if rel.startswith(prefix):
                rel = rel[len(prefix) :]
            for candidate_root in (
                Path("D:/Merlin_AI_Models/embeddinggemma-2"),
                Path("E:/Merlin_AI_Models/embeddinggemma-2"),
                Path("C:/Merlin_AI_Models/embeddinggemma-2"),
                Path("F:/Merlin_AI_Models/embeddinggemma-2"),
                Path("G:/Merlin_AI_Models/embeddinggemma-2"),
            ):
                if candidate_root.exists():
                    target_file = (candidate_root / rel).resolve()
                    if not target_file.is_file() and "_q8.onnx" in rel:
                        target_file = (candidate_root / rel.replace("_q8.onnx", "_quantized.onnx")).resolve()
                    if str(target_file).startswith(str(candidate_root.resolve())) and target_file.is_file():
                        mime = "application/json; charset=utf-8" if target_file.suffix.lower() == ".json" else "application/octet-stream"
                        self._send_bytes(target_file.read_bytes(), content_type=mime, status=200)
                        return
            self._send_json({"ok": False, "error": f"LOCAL_MODEL_NOT_FOUND: {rel}"}, status=404)
            return

        self._send_json({"ok": False, "error": f"Not Found: {path}"}, status=404)

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        body = self._read_body()

        # [귀신같이 윈도우 휴지통 / 격리 / 폴더열기]
        if path.startswith("/__quarantine/"):
            sub = path[len("/__quarantine/") :].strip("/")
            if sub.lower() in ("move", "restore") and self._reject_untrusted():
                return
            self._send_json(plugin_ghosti_os.handle_quarantine(sub, body))
            return

        if path in ("/__merlin/shutdown", "/__zcore/shutdown"):
            if self._reject_untrusted():
                return
            remove_win32_tray_icon()
            self._send_json({"ok": True, "message": "Merlin_Z_Core shutting down", "version": CORE_VERSION})
            threading.Thread(target=lambda: (time.sleep(0.15), os._exit(0)), daemon=True).start()
            return

        if path in ("/__merlin/ self-update", "/__merlin/self-update", "/__zcore/self-update"):
            if self._reject_untrusted():
                return
            self._send_json(trigger_silent_self_update(body))
            return

        if path == "/__merlin/query":
            plugin_name = str(body.get("plugin") or body.get("callerAppId") or "ghosti")
            action = str(body.get("action") or body.get("targetResource") or "health")
            payload = body.get("payload") if isinstance(body.get("payload"), dict) else body
            if (
                plugin_name.strip().lower() in ("ghosti", "ghosti_os", "os", "monster")
                and action.strip().lower() in plugin_ghosti_os.MUTATING_ACTIONS
                and self._reject_untrusted()
            ):
                return
            self._send_json(dispatch_plugin_call(plugin_name, action, payload))
            return

        if path == "/api/superpower/start-trial":
            self._send_json(plugin_ghosti_superpowers.start_superpower_trial(body))
            return
        if path == "/api/superpower/consume-action":
            self._send_json(plugin_ghosti_superpowers.consume_superpower_action(body))
            return

        if path == "/api/superpower/snippets":
            self._send_json(plugin_ghosti_superpowers.save_snippets(body))
            return

        if path == "/api/superpower/simulate":
            self._send_json(plugin_ghosti_superpowers.simulate_superpower(body))
            return

        if path == "/api/superpower/telemetry":
            self._send_json(plugin_ghosti_superpowers.update_telemetry(body))
            return

        if path in ("/api/superpower/settings", "/api/superpower/clear-history"):
            if path.endswith("/clear-history"):
                body = {**(body or {}), "clear_history": True}
            self._send_json(plugin_ghosti_superpowers.update_superpower_settings_api(body))
            return

        if path == "/api/superpower/mailbox-sync":
            self._send_json(plugin_ghosti_superpowers.sync_e2ee_mailbox_api(body))
            return

        # [방어 21·22] 구 3대장 척결 독립 격리 플러그인 POST (Try-Except Firewall + Lazy-Import)
        if path.startswith("/api/care/"):
            if self._reject_untrusted():
                return
            try:
                import plugin_ghosti_care_suite  # Lazy-Import
                sub = path[len("/api/care/") :].strip("/")
                if sub in ("security-services/sleep", "security-sleep", "sleep"):
                    self._send_json(plugin_ghosti_care_suite.handle_care_suite_request("sleep", body))
                    return
                if sub in ("security-services/wake", "security-wake", "wake"):
                    self._send_json(plugin_ghosti_care_suite.handle_care_suite_request("wake", body))
                    return
                if sub in ("archive/extract", "extract-archive", "smart-unzip"):
                    self._send_json(plugin_ghosti_care_suite.handle_care_suite_request("extract-archive", body))
                    return
                if sub in ("archive/peek", "peek-archive"):
                    self._send_json(plugin_ghosti_care_suite.handle_care_suite_request("peek-archive", body))
                    return
                if sub in ("defender/scan", "amsi-scan"):
                    self._send_json(plugin_ghosti_care_suite.handle_care_suite_request("amsi-scan", body))
                    return
                self._send_json(plugin_ghosti_care_suite.handle_care_suite_request(sub, body))
                return
            except Exception as e:
                self._send_json({"ok": False, "isolatedFirewall": True, "error": str(e)}, status=200)
                return

        if path in ("/__merlin/open-ghost-search", "/api/superpower/open_search_window"):
            self._send_json(plugin_ghosti_superpowers.open_ghost_search_window_api(body))
            return

        if path in ("/__merlin/play-enter-giggle", "/api/superpower/play-enter-giggle"):
            self._send_json(plugin_ghosti_superpowers.play_web_enter_giggle_api(body))
            return

        if path.startswith("/api/senstalk"):
            sub = path[len("/api/senstalk") :].strip("/") or "health"
            self._send_json(plugin_senstalk.handle_post(sub, body))
            return

        if path.startswith("/api/aggrofilter") or path.startswith("/aggrofilter"):
            prefix = "/api/aggrofilter" if path.startswith("/api/aggrofilter") else "/aggrofilter"
            sub = path[len(prefix) :].strip("/") or "extract"
            self._send_json(plugin_aggrofilter.handle_post(sub, body))
            return

        if path.startswith("/__zcore/") or path.startswith("/api/ghosti/"):
            act = path.split("/")[-1]
            if act.lower() in ("deep-uninstall-scan", "deep-uninstall-execute"):
                if self._reject_untrusted():
                    return
                try:
                    import plugin_ghosti_care_suite  # Lazy-Import
                    self._send_json(plugin_ghosti_care_suite.handle_care_suite_request(act.lower(), body))
                    return
                except Exception as exc:
                    self._send_json({"ok": False, "error": str(exc)}, status=200)
                    return
            mutating_set = getattr(plugin_ghosti_os, "MUTATING_ACTIONS", set())
            if act.lower() in mutating_set and self._reject_untrusted():
                return
            try:
                self._send_json(plugin_ghosti_os.handle_request(act, body))
            except Exception as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=500)
            return

        if path in ("/__docs/search", "/api/ghosti/docs/search"):
            self._send_json(ghosti_setup_parity.docs_search(body))
            return

        if path in ("/__videos/search", "/api/ghosti/videos/search"):
            self._send_json(ghosti_setup_parity.videos_search(body))
            return

        if path in ("/__faces/register", "/api/ghosti/faces/register"):
            if self._reject_untrusted():
                return
            self._send_json(ghosti_setup_parity.faces_register(body))
            return

        # [고치기 보조 API — 개발서버 전용이던 기능 데몬 이관]
        if path.startswith("/__setup-monster/"):
            sub = path[len("/__setup-monster/") :].strip("/").lower()
            if sub == "tts":
                self._send_json(ghosti_setup_parity.tts_speak(body))
            elif sub == "tts-prewarm":
                self._send_json(ghosti_setup_parity.tts_prewarm(body))
            else:
                self._send_json(ghosti_setup_parity.handle_setup_monster(sub, body))
            return

        self._send_json({"ok": False, "error": f"Not Found: {path}"}, status=404)


def run_selftest(live: bool = False) -> Dict[str, Any]:
    """내장 플러그인 3종(ghosti_os, senstalk, aggrofilter) 및 [복원 기록] Pre-Check 통합 자가진단"""
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
    srv3_sample = '<timedtext format="3"><body><p t="1000" d="2000"><s>안녕</s><s> 하세요</s></p><p t="3500" d="1000">둘째 줄</p></body></timedtext>'
    fmt1_sample = '<transcript><text start="0.5" dur="1.2">first &amp; line</text></transcript>'
    ag_srv3 = plugin_aggrofilter._parse_timedtext_xml(srv3_sample)
    ag_fmt1 = plugin_aggrofilter._parse_timedtext_xml(fmt1_sample)
    ag_invalid = plugin_aggrofilter.handle_post("v1/extract-subtitles", {"url": "not a youtube link"})
    ag_parser_ok = (
        len(ag_srv3) == 2 and ag_srv3[0]["text"] == "안녕 하세요" and ag_srv3[0]["startSec"] == 1.0
        and len(ag_fmt1) == 1 and ag_fmt1[0]["text"] == "first & line"
        and ag_invalid.get("ok") is False
    )
    ag_live: Dict[str, Any] = {"skipped": True, "hint": "--selftest-live 로 실제 유튜브 2종 실측"}
    if live:
        live_rows = []
        for v in ("dQw4w9WgXcQ", "jNQXAC9IVRw"):
            r = plugin_aggrofilter.fetch_youtube_captions_via_local_ip(v)
            live_rows.append({"videoId": v, "ok": r.get("ok"), "segmentCount": r.get("segmentCount"), "lang": r.get("selectedLanguage"), "reason": r.get("reason")})
        ag_live = {"skipped": False, "results": live_rows, "allOk": all(x["ok"] and (x["segmentCount"] or 0) > 0 for x in live_rows)}
    ghosti_status = plugin_ghosti_os.handle_request("health")
    restore_precheck = plugin_ghosti_os.handle_request("restore-points-list")
    # 자가진단에서는 실제 파일을 되돌리는 롤백을 실행하지 않는다 (유저 파일 보호)
    rollback_res = {"message": "자가진단에서는 실제 롤백을 실행하지 않습니다 (유저 파일 보호)"}
    tree_summary = plugin_ghosti_os.handle_request("folder-tree-summary")
    all_ok = bool(ag_vid == "dQw4w9WgXcQ" and ag_parser_ok and (ag_live.get("skipped") or ag_live.get("allOk")))
    return {
        "ok": all_ok,
        "selftest": "PASSED" if all_ok else "FAILED",
        "unifiedHealth": h,
        "ghostiPluginHealth": ghosti_status,
        "restorePointsPrecheck": {
            "officialTerm": restore_precheck.get("officialTerm"),
            "precheckElapsedMs": restore_precheck.get("precheckElapsedMs"),
            "sampleBadge": (restore_precheck.get("restorePoints") or [{}])[0].get("statusBadge"),
            "rollbackVerified": rollback_res.get("message"),
        },
        "zeroLlmTreeSummaryCheck": {
            "scannedCount": tree_summary.get("count"),
            "estimatedPromptTokens": None,
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
        "aggrofilterCaptionParserCheck": {
            "ok": ag_parser_ok,
            "srv3Segments": len(ag_srv3),
            "format1Segments": len(ag_fmt1),
            "invalidUrlHonestFailure": ag_invalid.get("ok") is False,
        },
        "aggrofilterLiveCaptionCheck": ag_live,
    }




import tempfile
import zipfile

_SELF_UPDATE_IN_PROGRESS = False


def trigger_silent_self_update(body: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """[화면 꺼짐 없는 3초 무소음 자동 업데이트 (Silent Self-Update)]
    - 웹앱(PWA)이 버전 차이를 감지해 호출하면, 유저에게 다운로드/압축해제를 시키지 않고
      백그라운드에서 최신 패키지를 받아 1줄짜리 updater.bat 스왑으로 3초 내에 자동 교체·재기동합니다."""
    global _SELF_UPDATE_IN_PROGRESS
    data = body or {}
    target_version = str(data.get("targetVersion") or "").strip()
    download_url = str(
        data.get("downloadUrl") or "https://ghosti.sundreamer.app/Merlin_Z_Core.zip"
    ).strip()

    if target_version and target_version == CORE_VERSION:
        return {
            "ok": True,
            "status": "ALREADY_UP_TO_DATE",
            "version": CORE_VERSION,
        }

    if _SELF_UPDATE_IN_PROGRESS:
        return {
            "ok": True,
            "status": "UPDATE_ALREADY_IN_PROGRESS",
            "version": CORE_VERSION,
            "targetVersion": target_version,
        }

    # PyInstaller 단일 실행파일(.exe)로 실행 중일 때만 바이너리 자가 교체 수행 (개발 중 python 스크립트 실행 시에는 소스 보호)
    is_frozen_exe = bool(getattr(sys, "frozen", False))
    if not is_frozen_exe:
        return {
            "ok": True,
            "status": "DEV_SCRIPT_MODE_SKIPPED",
            "version": CORE_VERSION,
            "message": "개발용 Python 스크립트 모드에서는 바이너리 자가 교체를 건너뜁니다.",
        }

    _SELF_UPDATE_IN_PROGRESS = True

    def _bg_swap_worker() -> None:
        global _SELF_UPDATE_IN_PROGRESS
        try:
            current_exe = Path(sys.executable).resolve()
            update_dir = Path(tempfile.gettempdir()) / "merlin_zcore_silent_update"
            update_dir.mkdir(parents=True, exist_ok=True)
            zip_path = update_dir / "Merlin_Z_Core_latest.zip"

            req = urllib.request.Request(
                download_url,
                headers={"User-Agent": f"Merlin_Z_Core_Updater/{CORE_VERSION}"},
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                zip_bytes = resp.read()
            zip_path.write_bytes(zip_bytes)

            extracted_exe: Path | None = None
            with zipfile.ZipFile(zip_path, "r") as zf:
                for member in zf.namelist():
                    if member.lower().endswith(".exe"):
                        zf.extract(member, update_dir)
                        extracted_exe = (update_dir / member).resolve()
                        break

            if not extracted_exe or not extracted_exe.exists():
                _SELF_UPDATE_IN_PROGRESS = False
                return

            # 1줄짜리 updater.bat 생성 후 무소음(CREATE_NO_WINDOW) 스왑 및 재실행
            bat_path = update_dir / "updater.bat"
            bat_content = (
                "@echo off\r\n"
                "timeout /t 1 /nobreak > NUL\r\n"
                f'move /y "{extracted_exe}" "{current_exe}" > NUL\r\n'
                f'start "" "{current_exe}" --replace\r\n'
                'del "%~f0"\r\n'
            )
            bat_path.write_text(bat_content, encoding="mbcs", errors="replace")
            subprocess.Popen(
                ["cmd.exe", "/c", str(bat_path)],
                creationflags=0x08000000 if sys.platform == "win32" else 0,
                close_fds=True,
            )
            remove_win32_tray_icon()
            time.sleep(0.2)
            os._exit(0)
        except Exception:
            _SELF_UPDATE_IN_PROGRESS = False

    threading.Thread(target=_bg_swap_worker, daemon=True).start()
    return {
        "ok": True,
        "status": "SILENT_SELF_UPDATE_STARTED",
        "currentVersion": CORE_VERSION,
        "targetVersion": target_version or "latest",
    }


def ensure_port_free(port: int, force_replace: bool = False) -> list[int]:
    """포트(기본 5199)를 점유 중인 구버전 Z-코어 프로세스를 자동 감지해 즉시 종료하고 포트를 인계받습니다."""
    killed_pids: list[int] = []
    my_pid = os.getpid()

    # Fast-path: 포트가 이미 비어 있다면 불필요한 HTTP 타임아웃이나 netstat 스캔(6초 지연) 없이 1ms 만에 즉시 반환!
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", port))
        return []
    except OSError:
        pass

    # 0) 이미 동일 버전(v2.3.3+)의 Z-코어가 정상 실행 중이고 강제 교체(--replace)가 아니라면 중복 실행 방지를 위해 즉시 종료!
    if not force_replace:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/__merlin/health", timeout=0.6) as resp:
                data = json.loads(resp.read().decode("utf-8", errors="replace"))
                if data.get("ok") and data.get("version") == CORE_VERSION and not _SELF_UPDATE_IN_PROGRESS:
                    os._exit(0)
        except Exception:
            pass

    # 1) 우아한 종료 요청 시도 (이전 프로세스가 스스로 Shell_NotifyIcon(NIM_DELETE)로 트레이 아이콘을 지우고 종료하도록 유도)
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/__merlin/shutdown", timeout=0.6) as _:
            pass
        time.sleep(0.35)
    except Exception:
        pass

    # 2) psutil 및 netstat으로 포트 점유 PID 전수 조회 후 강제 종료
    target_pids: set[int] = set()
    try:
        import psutil
        for conn in psutil.net_connections(kind="inet"):
            if conn.laddr and conn.laddr.port == port and conn.pid and conn.pid != my_pid and conn.pid > 4:
                target_pids.add(int(conn.pid))
    except Exception:
        pass

    if sys.platform == "win32":
        try:
            res = subprocess.run(
                ["netstat", "-ano"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=3,
                creationflags=0x08000000,
            )
            for line in (res.stdout or "").splitlines():
                if f":{port} " in line and "LISTENING" in line.upper():
                    parts = line.split()
                    if parts and parts[-1].isdigit():
                        pid_val = int(parts[-1])
                        if pid_val != my_pid and pid_val > 4:
                            target_pids.add(pid_val)
        except Exception:
            pass

    for pid in target_pids:
        try:
            import psutil
            psutil.Process(pid).kill()
            killed_pids.append(pid)
        except Exception:
            pass
        if sys.platform == "win32":
            try:
                subprocess.run(
                    ["taskkill", "/F", "/PID", str(pid)],
                    capture_output=True,
                    timeout=3,
                    creationflags=0x08000000,
                )
                if pid not in killed_pids:
                    killed_pids.append(pid)
            except Exception:
                pass

    # 3) 포트가 완전히 풀릴 때까지 최대 2.5초 대기
    for _ in range(16):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("127.0.0.1", port))
            break
        except OSError:
            time.sleep(0.15)

    return killed_pids


def start_win32_tray_icon(port: int, replaced_pids: list[int] | None = None) -> None:
    """윈도우 시계 옆 시스템 트레이에 귀신같이 아이콘을 표시하고 우클릭/클릭 [종료] 메뉴를 제공합니다."""
    if sys.platform != "win32":
        return

    def _tray_worker() -> None:
        try:
            w32.bind_interactive_desktop()
            import win32api
            import win32con
            import win32gui

            msg_tray = win32con.WM_USER + 20
            class_name = f"MerlinZCoreTrayWnd_{port}_{os.getpid()}"

            def _show_context_menu(hwnd: int) -> None:
                try:
                    menu = win32gui.CreatePopupMenu()
                    win32gui.AppendMenu(
                        menu,
                        win32con.MF_STRING | win32con.MF_GRAYED,
                        1001,
                        f"[실행 중] 귀신같이 멀린 Z-코어 v{CORE_VERSION} (포트 {port})",
                    )
                    win32gui.AppendMenu(menu, win32con.MF_SEPARATOR, 0, "")
                    win32gui.AppendMenu(
                        menu,
                        win32con.MF_STRING,
                        1002,
                        "[종료] 멀린 Z-코어 끝내기 (Exit)",
                    )
                    pos = win32gui.GetCursorPos()
                    win32gui.SetForegroundWindow(hwnd)
                    cmd = win32gui.TrackPopupMenu(
                        menu,
                        win32con.TPM_LEFTALIGN | win32con.TPM_BOTTOMALIGN | win32con.TPM_RETURNCMD | win32con.TPM_NONOTIFY,
                        pos[0],
                        pos[1],
                        0,
                        hwnd,
                        None,
                    )
                    win32gui.PostMessage(hwnd, win32con.WM_NULL, 0, 0)
                    if cmd == 1002:
                        try:
                            win32gui.Shell_NotifyIcon(win32gui.NIM_DELETE, (hwnd, 0))
                        except Exception:
                            pass
                        os._exit(0)
                except Exception:
                    pass

            def _wnd_proc(hwnd: int, msg: int, wparam: int, lparam: int) -> int:
                if msg == msg_tray:
                    if lparam in (win32con.WM_RBUTTONUP, win32con.WM_LBUTTONUP, win32con.WM_CONTEXTMENU):
                        _show_context_menu(hwnd)
                    return 0
                if msg == win32con.WM_DESTROY:
                    try:
                        win32gui.Shell_NotifyIcon(win32gui.NIM_DELETE, (hwnd, 0))
                    except Exception:
                        pass
                    win32gui.PostQuitMessage(0)
                    return 0
                return win32gui.DefWindowProc(hwnd, msg, wparam, lparam)

            wc = win32gui.WNDCLASS()
            wc.hInstance = win32api.GetModuleHandle(None)
            wc.lpszClassName = class_name
            wc.lpfnWndProc = _wnd_proc
            atom = win32gui.RegisterClass(wc)
            hwnd = win32gui.CreateWindow(atom, class_name, 0, 0, 0, 0, 0, 0, 0, wc.hInstance, None)
            global _TRAY_HWND
            _TRAY_HWND = hwnd

            hicon = None
            if TRAY_ICON_ICO.exists():
                try:
                    hicon = win32gui.LoadImage(
                        0,
                        str(TRAY_ICON_ICO),
                        win32con.IMAGE_ICON,
                        0,
                        0,
                        win32con.LR_LOADFROMFILE | win32con.LR_DEFAULTSIZE,
                    )
                except Exception:
                    hicon = None
            if not hicon:
                hicon = win32gui.LoadIcon(0, win32con.IDI_APPLICATION)

            tip = f"귀신같이 멀린 Z-코어 v{CORE_VERSION} (포트 {port} 실행 중 - 클릭 시 종료 메뉴)"
            if port == STANDARD_PORT:
                info_msg = (
                    f"구버전(PID {replaced_pids})을 자동 종료하고 최신 v{CORE_VERSION} 엔진으로 교체되었습니다."
                    if replaced_pids
                    else f"시계 옆 트레이 아이콘에서 언제든 종료할 수 있습니다. (포트 {port})"
                )
                nid = (
                    hwnd,
                    0,
                    win32gui.NIF_ICON | win32gui.NIF_MESSAGE | win32gui.NIF_TIP | win32gui.NIF_INFO,
                    msg_tray,
                    hicon,
                    tip,
                    info_msg,
                    4000,
                    f"귀신같이 멀린 Z-코어 v{CORE_VERSION} 실행 완료",
                    win32gui.NIIF_INFO,
                )
            else:
                nid = (
                    hwnd,
                    0,
                    win32gui.NIF_ICON | win32gui.NIF_MESSAGE | win32gui.NIF_TIP,
                    msg_tray,
                    hicon,
                    tip,
                )
            win32gui.Shell_NotifyIcon(win32gui.NIM_ADD, nid)
            win32gui.PumpMessages()
        except Exception:
            pass

    threading.Thread(target=_tray_worker, daemon=True).start()


def main() -> None:
    parser = argparse.ArgumentParser(description="Merlin_Z_Core Unified PC Daemon (Port 5199)")
    parser.add_argument("--selftest", action="store_true", help="내장 소프트웨어 플러그인 3종 통합 자가진단")
    parser.add_argument("--selftest-live", action="store_true", help="자가진단 + 실제 유튜브 4종 자막 실측(네트워크 필요)")
    parser.add_argument("--plugin", type=str, default="", help="단발 실행할 내장 플러그인명 (ghosti|senstalk|aggrofilter)")
    parser.add_argument("--action", type=str, default="health", help="플러그인 액션명")
    parser.add_argument("--payload", type=str, default="{}", help="JSON 페이로드 문자열")
    parser.add_argument("--port", type=int, default=STANDARD_PORT, help="단일 표준 포트 (기본 5199)")
    parser.add_argument("--enable-autostart", action="store_true", help="윈도우 시작 시 자동실행 등록")
    parser.add_argument("--replace", action="store_true", help="자가 업데이트 등 기존 프로세스를 강제 교체할 때 사용")
    args = parser.parse_args()

    if args.enable_autostart:
        w32.set_autostart_enabled(True)

    if args.selftest or args.selftest_live:
        result = run_selftest(live=args.selftest_live)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        sys.exit(0 if result.get("ok") else 1)

    if args.plugin:
        try:
            payload_obj = json.loads(args.payload) if args.payload else {}
        except Exception:
            payload_obj = {}
        res = dispatch_plugin_call(args.plugin, args.action, payload_obj)
        print(json.dumps(res, ensure_ascii=False))
        return

    # Windows Named Mutex 기반 단일 인스턴스 보장 (더블클릭 연타로 2~3개가 동시에 뜨더라도 단 1개만 실행되고 나머지는 트레이 아이콘 생성 전에 즉시 종료)
    _single_mutex = None
    if os.name == "nt" and not args.replace:
        try:
            import ctypes as _ct

            _k32 = _ct.windll.kernel32
            _mutex_name = f"Local\\Merlin_Z_Core_SingleInstance_Port_{args.port}"
            _single_mutex = _k32.CreateMutexW(None, True, _mutex_name)
            if _k32.GetLastError() == 183:  # ERROR_ALREADY_EXISTS
                # 이미 실행 중인 인스턴스가 최신 버전이면 트레이 아이콘을 추가로 만들지 않고 즉시 조용히 종료
                try:
                    with urllib.request.urlopen(f"http://127.0.0.1:{args.port}/__merlin/health", timeout=0.8) as resp:
                        hdata = json.loads(resp.read().decode("utf-8", errors="replace"))
                        if hdata.get("ok") and hdata.get("version") == CORE_VERSION:
                            os._exit(0)
                except Exception:
                    # 아직 부팅 중인 첫 번째 인스턴스가 뮤텍스를 쥐고 있는 경우에도 두 번째 인스턴스는 즉시 종료!
                    os._exit(0)
        except Exception:
            pass

    replaced_pids = ensure_port_free(args.port, force_replace=bool(getattr(args, "replace", False)))

    if os.name == "nt":
        try:
            import ctypes as _ct
            _k32 = _ct.windll.kernel32
            _hproc = _k32.GetCurrentProcess()
            _k32.SetPriorityClass(_hproc, 0x00008000)  # ABOVE_NORMAL_PRIORITY_CLASS (CPU 100% 과부하에서도 응답 보장)
            _all_mask = (1 << max(1, os.cpu_count() or 4)) - 1
            _k32.SetProcessAffinityMask(_hproc, _ct.c_size_t(_all_mask))
        except Exception:
            pass

    class ReusableThreadingHTTPServer(ThreadingHTTPServer):
        allow_reuse_address = True
        daemon_threads = True
        request_queue_size = 128

    # 1) 포트 5199 HTTP 서버를 가장 먼저 즉시 바인딩하여 웹앱의 '실행했어요 (즉시 확인)' 헬스체크가 0.1초 만에 성공하게 보장
    srv = ReusableThreadingHTTPServer(("127.0.0.1", args.port), MerlinUnifiedHTTPHandler)

    # 2) 트레이 아이콘 및 부가 데몬(Ctrl+0 초능력, 바탕화면 타임머신)은 백그라운드 스레드에서 비동기로 기동 (HTTP 바인딩 블로킹 원천 차단)
    start_win32_tray_icon(args.port, replaced_pids=replaced_pids)

    def _start_auxiliary_watchers() -> None:
        try:
            plugin_ghosti_superpowers.ensure_superpower_daemon_running()
        except Exception:
            pass
        try:
            import ghosti_safe_ops

            ghosti_safe_ops.start_desktop_timemachine_watcher()
        except Exception:
            pass

    threading.Thread(target=_start_auxiliary_watchers, daemon=True).start()
    print(
        json.dumps(
            {
                "ok": True,
                "version": CORE_VERSION,
                "status": "LISTENING",
                "endpoint": f"http://127.0.0.1:{args.port}",
                "replacedOldPids": replaced_pids,
                "plugins": ["ghosti_os", "senstalk", "aggrofilter"],
            },
            ensure_ascii=False,
        ),
        flush=True,
    )
    srv.serve_forever()


if __name__ == "__main__":
    main()
