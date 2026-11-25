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

# [PyInstaller C-Bootloader 상속 오염 원천 차단]:
# 부모 .exe 종료 후 삭제된 _MEIxxxx\python312.dll 참조 팝업 크래시 및 종료 시 _MEI 삭제 실패 Warning 팝업을 막기 위해
# 기동 즉시 환경변수에서 _MEIPASS2 / _MEIPASS 소거 + PYINSTALLER_RESET_ENVIRONMENT=1 강제 설정
for _pyi_env_key in ("_MEIPASS2", "_MEIPASS"):
    os.environ.pop(_pyi_env_key, None)
os.environ["PYINSTALLER_RESET_ENVIRONMENT"] = "1"


def _is_mei_dir_in_use(mei_dir: Path) -> bool:
    """
    형제 프로세스(--seq-paste-daemon 등)가 해당 _MEI 폴더의 DLL/PYD를 메모리에 매핑해 실행 중인지 판별합니다.
    단 1개라도 잠겨 있으면 폴더 내부의 비잠금 파일(.tcl/.tk/.py/.png/.wav)을 절대 삭제하지 않도록 보호합니다!
    """
    try:
        for probe in mei_dir.iterdir():
            if probe.is_file() and probe.suffix.lower() in (".dll", ".pyd"):
                try:
                    os.rename(probe, probe)
                except PermissionError:
                    return True
                except OSError:
                    return True
    except Exception:
        return True
    return False


def cleanup_stale_mei_runtime_dirs() -> int:
    """
    기동 시점(startup)에 %LOCALAPPDATA%\\Merlin\\zcore_rt\\ 내 현재 실행 중인 프로세스들의 _MEI 폴더를 제외한
    과거 고아 _MEI* 임시 폴더들만 안전하게 청소합니다 (실행 중인 형제 프로세스 폴더는 100% 원형 보존).
    """
    cleaned = 0
    try:
        import shutil

        local_app = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
        rt_dir = Path(local_app) / "Merlin" / "zcore_rt"
        if not rt_dir.is_dir():
            return 0
        cur_mei = Path(getattr(sys, "_MEIPASS", "")).resolve() if getattr(sys, "_MEIPASS", None) else None
        now_ts = time.time()
        for item in rt_dir.iterdir():
            if not item.is_dir() or not item.name.startswith("_MEI"):
                continue
            try:
                if cur_mei and item.resolve() == cur_mei:
                    continue
                try:
                    if (now_ts - item.stat().st_mtime) < 180.0:
                        continue
                except Exception:
                    pass
                if _is_mei_dir_in_use(item):
                    continue
                shutil.rmtree(item, ignore_errors=True)
                if not item.exists():
                    cleaned += 1
            except Exception:
                pass
    except Exception:
        pass
    return cleaned

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

if "--ppocr-worker" in sys.argv:
    _w_idx = sys.argv.index("--ppocr-worker")
    import ppocr_v5_worker

    if "--daemon-stdio" in sys.argv[_w_idx + 1 :]:
        sys.exit(ppocr_v5_worker.run_worker_stdio_loop())
    if len(sys.argv) > _w_idx + 2:
        sys.exit(ppocr_v5_worker.run_worker_cli(sys.argv[_w_idx + 1], sys.argv[_w_idx + 2]))
    sys.exit(1)

# [초고속 서브데몬 직행 분기]: --seq-paste-daemon / 압축 CLI / GUI 러너 실행 시
# 무거운 서버 플러그인 8종(plugin_ghosti_os, plugin_senstalk, plugin_aggrofilter 등) import를 100% 생략하여 초기 기동 지연을 원천 차단!
_early_argv = sys.argv[1:]
if "--seq-paste-daemon" in _early_argv:
    # [영구 충돌 방지 + Hang 자폭 무중단 승계] --seq-paste-daemon 단일 인스턴스 Windows Named Mutex
    # - 기존 살아있는 정상(PONG) 데몬이 있으면 중복 실행을 즉시 차단(os._exit(0))
    # - 반대로 직전 데몬이 Hang 자폭·교체 중(PONG 불응 또는 --replace)이면 즉시 자살하지 않고
    #   최대 2.5초 WaitForSingleObject로 뮤텍스 반납을 기다려 0초 공백으로 승계합니다.
    _seq_paste_mutex = None
    if os.name == "nt":
        try:
            import ctypes as _ct_sp
            import socket as _sock_sp

            _k32_sp = _ct_sp.windll.kernel32
            _k32_sp.CreateMutexW.argtypes = [_ct_sp.c_void_p, _ct_sp.c_int, _ct_sp.c_wchar_p]
            _k32_sp.CreateMutexW.restype = _ct_sp.c_void_p
            _k32_sp.WaitForSingleObject.argtypes = [_ct_sp.c_void_p, _ct_sp.c_uint32]
            _k32_sp.WaitForSingleObject.restype = _ct_sp.c_uint32
            _k32_sp.CloseHandle.argtypes = [_ct_sp.c_void_p]
            _k32_sp.CloseHandle.restype = _ct_sp.c_int
            _seq_paste_mutex = _k32_sp.CreateMutexW(None, 0, "Local\\Merlin_SeqPaste_SingleInstance")
            if _seq_paste_mutex:
                _w_res = _k32_sp.WaitForSingleObject(_seq_paste_mutex, 0)
                if _w_res not in (0, 0x80):  # WAIT_OBJECT_0, WAIT_ABANDONED
                    _want_rep = "--replace" in _early_argv
                    _alive_pong = False
                    if not _want_rep:
                        try:
                            with _sock_sp.create_connection(("127.0.0.1", 51988), timeout=0.45) as _sc_sp:
                                _sc_sp.settimeout(0.55)
                                _sc_sp.sendall(b"__PING__")
                                if b"PONG" in _sc_sp.recv(64):
                                    _alive_pong = True
                        except Exception:
                            _alive_pong = False
                    if _alive_pong:
                        try:
                            _k32_sp.CloseHandle(_seq_paste_mutex)
                        except Exception:
                            pass
                        os._exit(0)
                    # 직전 프로세스가 자폭/종료 중이면 최대 2.5초 대기 후 뮤텍스 승계
                    _w_res2 = _k32_sp.WaitForSingleObject(_seq_paste_mutex, 2500)
                    if _w_res2 not in (0, 0x80):
                        # 2.5초 후에도 여전히 정상 PONG 중이면 중복 진입 포기
                        try:
                            with _sock_sp.create_connection(("127.0.0.1", 51988), timeout=0.45) as _sc_sp2:
                                _sc_sp2.settimeout(0.55)
                                _sc_sp2.sendall(b"__PING__")
                                if b"PONG" in _sc_sp2.recv(64):
                                    _k32_sp.CloseHandle(_seq_paste_mutex)
                                    os._exit(0)
                        except Exception:
                            pass
        except Exception:
            pass
    sys.argv = [sys.argv[0]] + [a for a in _early_argv if a != "--seq-paste-daemon"]
    import seq_paste_daemon

    if _seq_paste_mutex and hasattr(seq_paste_daemon, "set_single_instance_mutex_handle"):
        try:
            seq_paste_daemon.set_single_instance_mutex_handle(int(_seq_paste_mutex))
        except Exception:
            pass
    seq_paste_daemon.main()
    sys.exit(0)

_early_care_flags = {
    "--smart-unzip",
    "--smart-zip",
    "--register-menu",
    "--unregister-menu",
    "--install-and-run-helper",
    "--run-elevated-helper",
}
if any(a in _early_care_flags or any(a.startswith(f + "=") for f in _early_care_flags) for a in _early_argv):
    import plugin_ghosti_care_suite

    plugin_ghosti_care_suite.handle_care_cli_args(_early_argv)
    sys.exit(0)

if "--gui-task-runner" in _early_argv or "gui-task-runner" in _early_argv:
    import merlin_z_core_os

    merlin_z_core_os.run_gui_task_runner()
    sys.exit(0)

import core_win32 as w32  # noqa: E402
import plugin_ghosti_os  # noqa: E402
import plugin_senstalk  # noqa: E402
import plugin_aggrofilter  # noqa: E402
import ghosti_setup_parity  # noqa: E402
import plugin_ghosti_superpowers  # noqa: E402
from plugins import plugin_paid_work_sdrive  # noqa: E402
from plugins import plugin_paid_sync_ghostwin  # noqa: E402

CORE_VERSION = "2.8.90"
STANDARD_PORT = 5199
_BUNDLE_DIR = Path(getattr(sys, "_MEIPASS", str(THIS_DIR)))
TRAY_ICON_ICO = (_BUNDLE_DIR / "favicon.ico") if (_BUNDLE_DIR / "favicon.ico").exists() else (THIS_DIR / "favicon.ico")
TRAY_LOGO_PNG = (_BUNDLE_DIR / "logo-symbol.png") if (_BUNDLE_DIR / "logo-symbol.png").exists() else (THIS_DIR / "logo-symbol.png")


def get_unified_health() -> Dict[str, Any]:
    builtin_plugins: Dict[str, Any] = {
        "ghosti_os": plugin_ghosti_os.PLUGIN_METADATA,
        "paid_work_sdrive": plugin_paid_work_sdrive.PLUGIN_METADATA,
        "senstalk": plugin_senstalk.PLUGIN_METADATA,
        "aggrofilter": plugin_aggrofilter.PLUGIN_METADATA,
    }
    try:
        import plugin_ghosti_care_suite

        builtin_plugins["ghosti_care_suite"] = plugin_ghosti_care_suite.PLUGIN_METADATA
    except Exception:
        pass
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
        "builtinPlugins": builtin_plugins,
    }


def dispatch_plugin_call(plugin_name: str, action: str, payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    p = (plugin_name or "ghosti").strip().lower()
    data = payload or {}
    if p in ("ghosti", "ghosti_os", "os", "monster"):
        return plugin_ghosti_os.handle_request(action, data)
    if p in ("care", "care_suite", "ghosti_care_suite"):
        import plugin_ghosti_care_suite

        return plugin_ghosti_care_suite.handle_care_suite_request(action, data)
    if p in ("senstalk", "sensebot", "messenger"):
        return plugin_senstalk.handle_request(action, data)
    if p in ("aggrofilter", "youtube", "caption"):
        return plugin_aggrofilter.handle_request(action, data)
    return {
        "ok": False,
        "error": f"UNKNOWN_BUILTIN_PLUGIN: {plugin_name}",
        "availablePlugins": ["ghosti_os", "ghosti_care_suite", "senstalk", "aggrofilter"],
    }


_ALLOWED_ORIGIN_EXACT = {
    "https://sundreamer.app",
    "https://ghosti-app.netlify.app",
    "https://sensetalk.netlify.app",
    "capacitor://localhost",
    "ionic://localhost",
}

# 멀린 패밀리 공식 Netlify 사이트 이름 (정확히 일치하거나 `<branch>--<site>.netlify.app` 공식 브랜치 프리뷰만 허용)
# ⚠️ 구버전의 부분 문자열 매칭(`any(k in host ...)`)은 누구나 무료로 만들 수 있는 `evil-ghosti.netlify.app`에
# 로컬 PC 엔진(:5199) 전체 권한을 열어주므로 영구 금지합니다.
_ALLOWED_NETLIFY_SITES = {
    "ghosti",
    "ghosti-app",
    "ghostkey",
    "ghostkey-app",
    "sundreamer",
    "merlin",
    "senstalk",
    "sensetalk",
    "aggrofilter",
    "vaulter",
    "whateat",
    "luminote",
    "autonote",
}


def is_trusted_origin(origin: str | None) -> bool:
    """파일을 옮기거나 만드는 요청은 멀린 패밀리 공식 도메인·공식 Netlify 사이트·로컬 개발 화면(localhost)에서만 허용한다.
    (Origin 헤더가 없는 요청은 브라우저가 아닌 로컬 프로그램이므로 허용하되, 브라우저는 Sec-Fetch-Site로 교차 검증)"""
    if not origin:
        return True
    o = origin.strip().lower().rstrip("/")
    if o == "null":
        return False
    if o in _ALLOWED_ORIGIN_EXACT:
        return True
    try:
        u = urllib.parse.urlparse(o)
    except Exception:
        return False
    if u.scheme in ("capacitor", "ionic", "tauri", "file"):
        return True
    host = (u.hostname or "").lower()
    if not host:
        return False
    # 로컬 개발 루프백만 허용 (공용 Wi-Fi·카페 공유기에서 같은 대역 타인이 공격할 수 있는 192.168.*/10.*/172.16.* 은 허용하지 않음)
    if host in ("localhost", "127.0.0.1"):
        return True
    # 멀린 패밀리 공식 도메인 (sundreamer.app, merlincode.com) — 반드시 https
    if u.scheme == "https" and (host.endswith(".sundreamer.app") or host == "sundreamer.app"):
        return True
    if u.scheme == "https" and (host.endswith(".merlincode.com") or host == "merlincode.com"):
        return True
    # 멀린 패밀리 공식 Netlify 사이트 (exact 또는 `<deploy-id>--<site>.netlify.app`)
    if u.scheme == "https" and host.endswith(".netlify.app"):
        sub = host[: -len(".netlify.app")]
        site_name = sub.split("--")[-1] if "--" in sub else sub
        if site_name in _ALLOWED_NETLIFY_SITES:
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
    protocol_version = "HTTP/1.1"
    # [CloseWait 소켓 수백 개 누적 & 커널 좀비 원천 박멸]:
    # HTTP/1.1 Keep-Alive 무기한 블로킹을 차단해 요청 완료 즉시 소켓을 OS에 반납하고, 유휴 소켓도 15초 내 강제 회수!
    timeout = 15.0

    def setup(self) -> None:
        super().setup()
        self.close_connection = True
        try:
            self.request.settimeout(15.0)
        except Exception:
            pass

    def log_message(self, format: str, *args: Any) -> None:
        return

    def _check_origin_and_fetch_site(self) -> tuple[bool, str | None]:
        """Origin 헤더 및 Sec-Fetch-Site 헤더를 동시에 검증하여 외부 악성 웹페이지의 CSRF(<img src>, <form>, fetch)를 원천 차단합니다."""
        origin = self.headers.get("Origin")
        sec_fetch_site = (self.headers.get("Sec-Fetch-Site") or "").strip().lower()
        if origin:
            return (is_trusted_origin(origin), origin)
        referer = (self.headers.get("Referer") or "").strip()
        if referer:
            try:
                p_ref = urllib.parse.urlparse(referer)
                ref_origin = f"{p_ref.scheme}://{p_ref.netloc}" if p_ref.scheme and p_ref.netloc else ""
                if ref_origin and is_trusted_origin(ref_origin):
                    return (True, ref_origin)
            except Exception:
                pass
        # 브라우저 <img>/<video>/<audio> 태그는 HTTPS->HTTP(127.0.0.1) 전환 시 Origin/Referer 없이
        # Sec-Fetch-Site: cross-site + Sec-Fetch-Dest: image/video/audio 만 전송하므로
        # 반드시 cross-site 차단보다 먼저 읽기 전용 로컬 미디어 서빙 경로를 허용해야 미리보기가 403으로 깨지지 않습니다.
        if getattr(self, "command", "") == "GET":
            req_path = urllib.parse.urlparse(getattr(self, "path", "") or "").path.rstrip("/")
            sec_dest = (self.headers.get("Sec-Fetch-Dest") or "").strip().lower()
            if (
                req_path in (
                    "/__photos/file",
                    "/api/ghosti/photos/file",
                    "/__videos/thumb",
                    "/api/ghosti/videos/thumb",
                    "/__videos/stream",
                    "/api/ghosti/videos/stream",
                    "/__videos/frame",
                    "/api/ghosti/videos/frame",
                )
                or req_path.startswith("/__tts/audio/")
            ) and sec_dest in ("image", "video", "audio", "empty", ""):
                return (True, None)
        # Referer 도 신뢰 도메인이 아닌데 브라우저가 cross-site 요청으로 표시했다면 외부 악성 사이트 접근이므로 즉시 차단!
        if sec_fetch_site == "cross-site":
            return (False, "sec-fetch-site:cross-site")
        return (True, None)

    def _write_cors_headers(self, expose_range: bool = False) -> None:
        trusted, origin = self._check_origin_and_fetch_site()
        if not trusted:
            return
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        elif getattr(self, "command", "") in ("GET", "HEAD"):
            req_path = urllib.parse.urlparse(getattr(self, "path", "") or "").path.rstrip("/")
            if (
                req_path in (
                    "/__photos/file",
                    "/api/ghosti/photos/file",
                    "/__videos/thumb",
                    "/api/ghosti/videos/thumb",
                    "/__videos/stream",
                    "/api/ghosti/videos/stream",
                    "/__videos/frame",
                    "/api/ghosti/videos/frame",
                )
                or req_path.startswith("/__tts/audio/")
                or req_path.startswith("/__models/")
            ):
                self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, X-Merlin-App, X-Ghosti-Work-Key, Range",
        )
        if expose_range:
            self.send_header("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def _is_external_tunnel_request(self) -> bool:
        """아웃바운드 터널(*.trycloudflare.com / CF-Connecting-IP / X-Forwarded-For)을 통해 외부에서 들어온 요청인지 판별합니다."""
        host_hdr = (self.headers.get("Host") or "").strip().lower()
        if ".trycloudflare.com" in host_hdr:
            return True
        if self.headers.get("CF-Connecting-IP") or self.headers.get("X-Forwarded-For"):
            return True
        return False

    _TUNNEL_ALLOWED_WORK_PATHS = {
        "/health",
        "/__merlin/health",
        "/__work/files",
        "/api/work/files",
        "/__work/locks",
        "/api/work/locks",
        "/__work/file-sync-payload",
        "/api/work/file-sync-payload",
        "/__work/download",
        "/api/work/download",
        "/__work/upload",
        "/api/work/upload",
        "/__work/delete-file",
        "/api/work/delete-file",
    }

    def _reject_if_unauthorized_tunnel(self, path: str, params_or_body: Dict[str, Any] | None = None) -> bool:
        """외부 터널 경유 요청일 때: ① 업무 공유 파일 엔드포인트 외(종료·개인 사진·시스템 제어 등) 100% 차단,
        ② 방 전용 비밀 접근 키(X-Ghosti-Work-Key) 불일치 시 403 차단."""
        if not self._is_external_tunnel_request():
            return False
        if path not in self._TUNNEL_ALLOWED_WORK_PATHS:
            self._send_json({"ok": False, "error": "TUNNEL_PATH_FORBIDDEN", "path": path}, status=403)
            return True
        if path in ("/health", "/__merlin/health"):
            return False
        provided = (
            self.headers.get("X-Ghosti-Work-Key")
            or (params_or_body or {}).get("workKey")
            or ""
        )
        if not plugin_paid_work_sdrive.verify_tunnel_access_key(str(provided), True):
            self._send_json({"ok": False, "error": "WORK_TUNNEL_KEY_INVALID"}, status=403)
            return True
        return False

    def _reject_untrusted(self) -> bool:
        """신뢰할 수 없는 출처(Untrusted Origin 또는 Cross-Site Fetch)면 403 응답 후 True 반환"""
        trusted, origin = self._check_origin_and_fetch_site()
        if trusted:
            return False
        self._send_json({"ok": False, "error": "UNTRUSTED_ORIGIN", "origin": origin}, status=403)
        return True

    def _send_json(self, data: Dict[str, Any], status: int = 200) -> None:
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self._write_cors_headers(expose_range=False)
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
                self._write_cors_headers(expose_range=True)
                self.end_headers()
                self.wfile.write(chunk)
                return
            except Exception:
                pass
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(total_len))
        self._write_cors_headers(expose_range=True)
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
                    self.send_header("Content-Length", "0")
                    self._write_cors_headers(expose_range=True)
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
            self._write_cors_headers(expose_range=True)
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
        """Windows 크롬에서 코덱 미지원으로 화면이 멈추는 HEVC(hvc1)·WMV·AVI 영상을 0.2초 내 초고속 H.264 MP4로 변환·캐싱하여 Range 탐색이 가능한 완전한 영상으로 스트리밍합니다."""
        ff = plugin_ghosti_os.find_ffmpeg_exe()
        dur_hint = plugin_ghosti_os._get_fast_video_duration_sec(file_path)
        sync_budget = 0.25 if (ff and 0 < dur_hint <= 45.0) else (25.0 if not ff else 0.0)
        cached_mp4 = plugin_ghosti_os.get_or_create_faststart_video_cache(
            file_path,
            max_sync_sec=sync_budget,
            interactive=True,
        )
        if cached_mp4 is not None and cached_mp4.exists():
            self._send_file_stream(cached_mp4, content_type="video/mp4", cache_max_age=3600)
            return
        if not ff:
            self._send_file_stream(file_path, content_type="video/mp4")
            return

        # 2) 대용량 장편 HEVC 영상(캐시 생성 중)은 0.2초 초고속 720p Fragmented 파이프로 즉시 첫 프레임을 송출하고 백그라운드 캐싱 병행
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
            "-crf", "25",
            "-maxrate", "3200k",
            "-bufsize", "6400k",
            "-r", "30",
            "-g", "15",
            "-pix_fmt", "yuv420p",
            "-vf", "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'",
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
            self.send_header("Connection", "close")
            self.close_connection = True
            self._write_cors_headers(expose_range=False)
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

    _MAX_JSON_BODY_BYTES = 72 * 1024 * 1024  # 50MB 파일 Base64(~67MB) + 여유

    def _read_body(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0 or length > self._MAX_JSON_BODY_BYTES:
            return {}
        try:
            raw = self.rfile.read(length).decode("utf-8", errors="replace")
            return json.loads(raw) if raw.strip() else {}
        except Exception:
            return {}

    def _resolve_local_model_file(self, path: str) -> tuple[Path | None, str]:
        rel = path[len("/__models/") :].lstrip("/")
        prefix = "onnx-community/embeddinggemma-2-ONNX/resolve/main/"
        if rel.startswith(prefix):
            rel = rel[len(prefix) :]
        if not rel or ".." in Path(rel).parts or rel.startswith("/") or "\\" in rel and ":" in rel:
            return None, ""
        allowed_exts = {".json", ".onnx", ".onnx_data", ".txt", ".bin", ".model", ".vocab"}
        for candidate_root in (
            Path("D:/Merlin_AI_Models/embeddinggemma-2"),
            Path("E:/Merlin_AI_Models/embeddinggemma-2"),
            Path("C:/Merlin_AI_Models/embeddinggemma-2"),
            Path("F:/Merlin_AI_Models/embeddinggemma-2"),
            Path("G:/Merlin_AI_Models/embeddinggemma-2"),
        ):
            if not candidate_root.exists():
                continue
            try:
                root_res = candidate_root.resolve()
                target_file = (root_res / rel).resolve()
                if not target_file.is_file() and "_q8.onnx" in rel:
                    target_file = (root_res / rel.replace("_q8.onnx", "_quantized.onnx")).resolve()
                if (
                    target_file.is_relative_to(root_res)
                    and target_file.is_file()
                    and target_file.suffix.lower() in allowed_exts
                ):
                    mime = "application/json; charset=utf-8" if target_file.suffix.lower() == ".json" else "application/octet-stream"
                    return target_file, mime
            except Exception:
                continue
        return None, ""

    def _check_photo_ocr_quota_allowed(self, payload: Dict[str, Any] | None = None) -> Dict[str, Any] | None:
        if os.environ.get("GHOSTI_HEADLESS_TEST") == "1":
            return None
        try:
            res = plugin_ghosti_superpowers.consume_superpower_action({
                **(payload or {}),
                "actionType": "feat_6_screen_ocr",
            })
            if res and res.get("allowed") is False:
                return res
        except Exception:
            pass
        return None

    def do_HEAD(self) -> None:
        if self._reject_untrusted():
            return
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        if path.startswith("/__models/"):
            target_file, mime = self._resolve_local_model_file(path)
            if target_file is not None:
                try:
                    fsize = os.path.getsize(target_file)
                except Exception:
                    fsize = 0
                self.send_response(200)
                self.send_header("Content-Type", mime)
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Length", str(fsize))
                self.send_header("Cache-Control", "public, max-age=86400")
                self._write_cors_headers(expose_range=True)
                self.end_headers()
                return
            self.send_response(404)
            self.send_header("Content-Length", "0")
            self._write_cors_headers(expose_range=False)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Length", "0")
        self._write_cors_headers(expose_range=True)
        self.end_headers()

    def do_OPTIONS(self) -> None:
        trusted, _ = self._check_origin_and_fetch_site()
        if not trusted:
            self.send_response(403)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Length", "0")
        self._write_cors_headers(expose_range=True)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        qp = {k: v[0] for k, v in urllib.parse.parse_qs(parsed.query).items()}

        if self._reject_if_unauthorized_tunnel(path, qp):
            return

        if path in ("/", "/health", "/__merlin/health"):
            if self._reject_untrusted():
                return
            self._send_json(get_unified_health())
            return

        if path in ("/__merlin/shutdown", "/__zcore/shutdown"):
            if self._reject_untrusted():
                return
            remove_win32_tray_icon()
            self._send_json({"ok": True, "message": "Merlin_Z_Core shutting down", "version": CORE_VERSION})
            def _graceful_exit_get() -> None:
                time.sleep(0.12)
                try:
                    plugin_ghosti_superpowers.shutdown_superpower_daemon_for_update()
                except Exception:
                    pass
                try:
                    self.server.server_close()
                except Exception:
                    pass
                os._exit(0)
            threading.Thread(target=_graceful_exit_get, daemon=True).start()
            return

        # 외부 악성 사이트(<img src>, <video src>, <script>, cross-site fetch)가 내 PC 파일·사진·보안 API를 조회/조작하는 것을 일괄 차단
        if self._reject_untrusted():
            return

        # [귀신같이 내 PC 전수 인덱싱 API: 사진 / 서류 / 동영상]
        if path in ("/__zcore/watch-sig", "/api/ghosti/watch-sig"):
            self._send_json(plugin_ghosti_os.get_local_watch_signature(qp))
            return

        if path in ("/__zcore/external-drives", "/api/ghosti/external-drives"):
            self._send_json(plugin_ghosti_os.get_external_drives_status())
            return

        if path in ("/__photos/list", "/api/ghosti/photos/list"):
            try:
                import ppocr_v5_worker

                ppocr_v5_worker.prewarm_ppocr_worker_async()
            except Exception:
                pass
            self._send_json(plugin_ghosti_os.list_local_photos(qp))
            return

        if path in ("/__photos/file", "/api/ghosti/photos/file"):
            f_path, mime, status = plugin_ghosti_os.resolve_local_media_file(qp)
            if f_path is not None and status == 200:
                is_thumb = str(qp.get("thumb") or "").strip() in ("1", "true", "yes")
                if is_thumb and mime.startswith("image/"):
                    thumb_path = plugin_ghosti_os.get_or_create_photo_thumb(f_path)
                    if thumb_path is not None:
                        t_mime = "image/jpeg" if thumb_path.suffix.lower() in (".jpg", ".jpeg") else mime
                        self._send_file_stream(thumb_path, content_type=t_mime, cache_max_age=86400)
                        return
                    if plugin_ghosti_os._is_cloud_virtual_or_unpinned_file(f_path):
                        self._send_json({"ok": False, "error": "CLOUD_UNPINNED_SKIP"}, status=404)
                        return
                self._send_file_stream(f_path, content_type=mime)
            else:
                self._send_json({"ok": False, "error": "FILE_NOT_FOUND"}, status=status)
            return

        if path in ("/__photos/ocr", "/api/ghosti/photos/ocr"):
            gate_err = self._check_photo_ocr_quota_allowed(qp)
            if gate_err is not None:
                self._send_json(gate_err, status=402)
                return
            self._send_json(plugin_ghosti_os.extract_photo_winrt_ocr(qp))
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

        # [3귀신 업무 공유(S: 드라이브) 네이티브 마운트 · 실시간 파일/잠금(~$) 스캔 · 원본 다운로드 API]
        if path in ("/__work/s-drive", "/api/work/s-drive"):
            self._send_json(plugin_paid_work_sdrive.inspect_s_drive_status(str(qp.get("driveLetter") or "S:")))
            return

        if path in ("/__work/tunnel", "/api/work/tunnel"):
            self._send_json(plugin_paid_work_sdrive.get_outbound_work_tunnel_status())
            return

        if path in ("/__work/backup-servers", "/api/work/backup-servers"):
            self._send_json(plugin_paid_work_sdrive.manage_backup_server_nodes({"subAction": "get"}))
            return

        if path in ("/__work/files", "/api/work/files"):
            self._send_json(plugin_paid_work_sdrive.list_work_files(qp))
            return

        if path in ("/__work/locks", "/api/work/locks"):
            self._send_json(plugin_paid_work_sdrive.get_work_locks_fast(qp))
            return

        if path in ("/__work/file-sync-payload", "/api/work/file-sync-payload"):
            self._send_json(plugin_paid_work_sdrive.get_single_work_file_sync_payload(qp))
            return

        if path in ("/__work/download", "/api/work/download"):
            f_path, mime, status = plugin_paid_work_sdrive.resolve_work_download_file(qp)
            if f_path is not None and status == 200:
                data_bytes = f_path.read_bytes()
                encoded_name = urllib.parse.quote(f_path.name)
                disp = "inline" if str(qp.get("inline") or "") in ("1", "true") else "attachment"
                self.send_response(200)
                self.send_header("Content-Type", mime)
                self.send_header("Content-Length", str(len(data_bytes)))
                self.send_header("Content-Disposition", f"{disp}; filename*=UTF-8''{encoded_name}")
                self._write_cors_headers(expose_range=False)
                self.end_headers()
                self.wfile.write(data_bytes)
            else:
                self._send_json({"ok": False, "error": "WORK_FILE_NOT_FOUND"}, status=status)
            return

        if path in ("/__sync/clipboard", "/api/sync/clipboard"):
            self._send_json(plugin_paid_sync_ghostwin.get_os_clipboard_text())
            return

        if path in ("/__videos/list", "/__videos/index", "/api/ghosti/videos/list"):
            self._send_json(plugin_ghosti_os.list_local_videos(qp))
            return

        if path in ("/__videos/extract-ocr-text", "/api/ghosti/videos/extract-ocr-text"):
            self._send_json(plugin_ghosti_os.extract_full_video_ocr_text(qp))
            return

        if path in ("/__videos/ocr-cache", "/api/ghosti/videos/ocr-cache"):
            self._send_json(plugin_ghosti_os.get_video_ocr_cache_snapshot())
            return

        if path == "/api/teleport/ocr-vanguard":
            self._send_json(plugin_ghosti_os.get_teleport_ocr_vanguard(qp))
            return

        if path in ("/__faces/index", "/api/ghosti/faces/index"):
            self._send_json(ghosti_setup_parity.faces_index())
            return

        if path in ("/__merlin/open-ghost-search", "/api/superpower/open_search_window") or path.startswith("/api/superpower/"):
            if self._reject_untrusted():
                return
            try:
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
            except Exception as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=500)
                return

        # [방어 21·22] 구 3대장 척결 독립 격리 플러그인 (Try-Except Firewall + Lazy-Import + GET Read-Only 강제)
        if path.startswith("/api/care/"):
            try:
                import plugin_ghosti_care_suite  # Lazy-Import
                sub = path[len("/api/care/") :].strip("/").lower()
                if sub in ("archive/peek", "peek-archive"):
                    self._send_json(plugin_ghosti_care_suite.handle_care_suite_request("peek-archive", qp))
                    return
                if sub not in plugin_ghosti_care_suite.READONLY_CARE_ACTIONS:
                    self._send_json(
                        {"ok": False, "error": "METHOD_NOT_ALLOWED_USE_POST", "action": sub},
                        status=405,
                    )
                    return
                if sub in ("security-services/status", "security-status", "status"):
                    self._send_json(plugin_ghosti_care_suite.handle_care_suite_request("status", qp))
                    return
                if sub in ("defender/history", "guardian-history"):
                    self._send_json(plugin_ghosti_care_suite.handle_care_suite_request("guardian-history", qp))
                    return
                self._send_json(plugin_ghosti_care_suite.handle_care_suite_request(sub, qp))
                return
            except Exception as e:
                self._send_json({"ok": False, "isolatedFirewall": True, "error": str(e)}, status=500)
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
            if act.lower() == "deep-uninstall-execute":
                self._send_json(
                    {"ok": False, "error": "METHOD_NOT_ALLOWED_USE_POST", "action": act.lower()},
                    status=405,
                )
                return
            if act.lower() == "deep-uninstall-scan":
                try:
                    import plugin_ghosti_care_suite  # Lazy-Import
                    self._send_json(plugin_ghosti_care_suite.handle_care_suite_request("deep-uninstall-scan", qp))
                    return
                except Exception as exc:
                    self._send_json({"ok": False, "error": str(exc)}, status=500)
                    return
            mutating_set = getattr(plugin_ghosti_os, "MUTATING_ACTIONS", set())
            if act.lower() in mutating_set:
                self._send_json(
                    {"ok": False, "error": "METHOD_NOT_ALLOWED_USE_POST", "action": act.lower()},
                    status=405,
                )
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
            target_file, mime = self._resolve_local_model_file(path)
            if target_file is not None:
                self._send_file_stream(target_file, content_type=mime, cache_max_age=86400)
                return
            rel = path[len("/__models/") :].lstrip("/")
            self._send_json({"ok": False, "error": f"LOCAL_MODEL_NOT_FOUND: {rel}"}, status=404)
            return

        self._send_json({"ok": False, "error": f"Not Found: {path}"}, status=404)

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        body = self._read_body()

        if self._reject_untrusted():
            return
        if self._reject_if_unauthorized_tunnel(path, body):
            return

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
            def _graceful_exit_get() -> None:
                time.sleep(0.12)
                try:
                    plugin_ghosti_superpowers.shutdown_superpower_daemon_for_update()
                except Exception:
                    pass
                try:
                    self.server.server_close()
                except Exception:
                    pass
                os._exit(0)
            threading.Thread(target=_graceful_exit_get, daemon=True).start()
            return

        if path in ("/__merlin/ self-update", "/__merlin/self-update", "/__zcore/self-update"):
            if self._reject_untrusted():
                return
            self._send_json(trigger_silent_self_update(body))
            return

        if path in ("/__photos/thumbs-batch", "/api/ghosti/photos/thumbs-batch"):
            if self._reject_untrusted():
                return
            self._send_json(plugin_ghosti_os.get_photo_thumbs_batch(body))
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

        if path.startswith("/api/superpower/"):
            if self._reject_untrusted():
                return
            try:
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
            except Exception as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=500)
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
                self._send_json({"ok": False, "isolatedFirewall": True, "error": str(e)}, status=500)
                return

        if path in ("/__merlin/open-ghost-search", "/api/superpower/open_search_window"):
            if self._reject_untrusted():
                return
            try:
                self._send_json(plugin_ghosti_superpowers.open_ghost_search_window_api(body))
            except Exception as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=500)
            return

        if path in ("/__merlin/play-enter-giggle", "/api/superpower/play-enter-giggle"):
            if self._reject_untrusted():
                return
            try:
                self._send_json(plugin_ghosti_superpowers.play_web_enter_giggle_api(body))
            except Exception as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=500)
            return

        if path in ("/__merlin/clipboard", "/api/ghosti/os/clipboard"):
            if self._reject_untrusted():
                return
            try:
                import seq_paste_daemon as spd

                txt_v = str((body or {}).get("text") or "")
                fp_v = str((body or {}).get("filePath") or (body or {}).get("p") or "").strip()
                if fp_v and not txt_v:
                    resolved_m, _, st_m = plugin_ghosti_os.resolve_local_media_file({"p": fp_v})
                    real_fp = str(resolved_m.resolve()) if (resolved_m is not None and st_m == 200) else fp_v
                    ok_cp = bool(spd.set_clipboard_hdrop_file(real_fp)) if Path(real_fp).exists() else False
                    self._send_json({"ok": ok_cp, "mode": "file", "filePath": real_fp})
                    return
                if txt_v:
                    spd.set_clipboard_text(txt_v)
                    self._send_json({"ok": True, "mode": "text", "length": len(txt_v)})
                    return
                self._send_json({"ok": False, "error": "EMPTY_CLIPBOARD_PAYLOAD"}, status=400)
            except Exception as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=500)
            return

        if path in ("/__videos/ocr-frames", "/api/ghosti/videos/ocr-frames"):
            self._send_json(plugin_ghosti_os.ingest_browser_video_ocr_frames(body))
            return

        if path in ("/__photos/ocr", "/api/ghosti/photos/ocr"):
            gate_err = self._check_photo_ocr_quota_allowed(body)
            if gate_err is not None:
                self._send_json(gate_err, status=402)
                return
            try:
                self._send_json(plugin_ghosti_os.extract_photo_winrt_ocr(body))
            except Exception as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=500)
            return

        if path in ("/__videos/extract-ocr-text", "/api/ghosti/videos/extract-ocr-text"):
            self._send_json(plugin_ghosti_os.extract_full_video_ocr_text(body))
            return

        if path == "/api/teleport/ocr-vanguard":
            self._send_json(plugin_ghosti_os.store_teleport_ocr_vanguard(body))
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

        if path in ("/__zcore/external-drives/decide", "/api/ghosti/external-drives/decide"):
            self._send_json(plugin_ghosti_os.decide_external_drive_web(body))
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
                    self._send_json({"ok": False, "error": str(exc)}, status=500)
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

        # [3귀신 업무 공유(S: 드라이브) 마운트/해제 · 파일 업로드 · 방장↔팀원 실시간 동기화 · 숨기기 API]
        if path in ("/__work/s-drive", "/api/work/s-drive"):
            self._send_json(plugin_paid_work_sdrive.mount_or_unmount_s_drive(body))
            return

        if path in ("/__work/upload", "/api/work/upload"):
            self._send_json(plugin_paid_work_sdrive.write_uploaded_work_file(body))
            return

        if path in ("/__work/pull-sync", "/api/work/pull-sync"):
            self._send_json(plugin_paid_work_sdrive.pull_sync_work_files(body))
            return

        if path in ("/__work/push-blob", "/api/work/push-blob"):
            self._send_json(plugin_paid_work_sdrive.push_work_blob_to_signed_url(body))
            return

        if path in ("/__work/pull-blob", "/api/work/pull-blob"):
            self._send_json(plugin_paid_work_sdrive.pull_work_blob_from_signed_url(body))
            return

        if path in ("/__work/delete-file", "/api/work/delete-file"):
            self._send_json(plugin_paid_work_sdrive.delete_or_apply_tombstones(body))
            return

        if path in ("/__work/toggle-hide", "/api/work/toggle-hide"):
            self._send_json(plugin_paid_work_sdrive.toggle_hide_work_file(body))
            return

        if path in ("/__work/entitlement", "/api/work/entitlement"):
            self._send_json(plugin_paid_work_sdrive.sync_work_entitlement_state(body))
            return

        if path in ("/__work/tunnel", "/api/work/tunnel"):
            sub_act = str(body.get("action") or "start").strip().lower()
            if sub_act == "stop":
                self._send_json(plugin_paid_work_sdrive.stop_outbound_work_tunnel())
            elif sub_act == "status":
                self._send_json(plugin_paid_work_sdrive.get_outbound_work_tunnel_status())
            else:
                self._send_json(plugin_paid_work_sdrive.ensure_outbound_work_tunnel(body))
            return

        if path in ("/__work/night-power-save", "/api/work/night-power-save"):
            self._send_json(plugin_paid_work_sdrive.set_night_power_save_mode(body))
            return

        if path in ("/__work/backup-servers", "/api/work/backup-servers"):
            self._send_json(plugin_paid_work_sdrive.manage_backup_server_nodes(body))
            return

        # [5. 내 기기 통합 네이티브 클립보드 주입 & 원본 미러링 저장 API]
        if path in ("/__sync/clipboard", "/api/sync/clipboard"):
            self._send_json(plugin_paid_sync_ghostwin.set_os_clipboard_text(body))
            return

        if path in ("/__sync/mirror-pull", "/api/sync/mirror-pull"):
            self._send_json(plugin_paid_sync_ghostwin.save_mirrored_device_file(body))
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
    sp_telemetry = plugin_ghosti_superpowers.get_telemetry()
    ocr_guard = plugin_ghosti_os.extract_photo_winrt_ocr({})
    sp_ok = bool(sp_telemetry.get("ok") is True and ocr_guard.get("error") == "MISSING_IMAGE_TARGET")
    all_ok = bool(ag_vid == "dQw4w9WgXcQ" and ag_parser_ok and sp_ok and (ag_live.get("skipped") or ag_live.get("allOk")))
    return {
        "ok": all_ok,
        "selftest": "PASSED" if all_ok else "FAILED",
        "unifiedHealth": h,
        "ghostiPluginHealth": ghosti_status,
        "superpowerAndSearchCheck": {
            "ok": sp_ok,
            "telemetryOk": sp_telemetry.get("ok"),
            "photoOcrGuard": ocr_guard.get("error"),
        },
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


def _normalize_self_update_download_url(raw_url: str) -> str:
    url = (raw_url or "").strip()
    if not url:
        return "https://github.com/Han-jinwook/Ghosti/releases/download/z-core-latest/Merlin_Z_Core.zip"
    # window.location.origin + Z_CORE_ZIP_URL 이중 결합("https://...https://...") 자동 정화
    second_https = url.find("https://", 8)
    if second_https > 0:
        url = url[second_https:]
    return url


def trigger_silent_self_update(body: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """[화면 꺼짐 없는 3초 무소음 자동 업데이트 (Silent Self-Update)]
    - 웹앱(PWA)이 버전 차이를 감지해 호출하면, 유저에게 다운로드/압축해제를 시키지 않고
      백그라운드에서 최신 패키지를 받아 1줄짜리 updater.bat 스왑으로 3초 내에 자동 교체·재기동합니다."""
    global _SELF_UPDATE_IN_PROGRESS
    data = body or {}
    target_version = str(data.get("targetVersion") or "").strip()
    download_url = _normalize_self_update_download_url(
        str(data.get("downloadUrl") or "https://github.com/Han-jinwook/Ghosti/releases/download/z-core-latest/Merlin_Z_Core.zip")
    )

    # [핑퐁 다운그레이드 자살 루프 원천 차단]: targetVersion이 없거나 현재 실행 중인 CORE_VERSION보다 엄격히 높지 않으면 절대 종료·교체하지 않음!
    if not target_version or not _is_remote_version_newer(target_version, CORE_VERSION):
        return {
            "ok": True,
            "status": "ALREADY_UP_TO_DATE",
            "version": CORE_VERSION,
        }

    # [원격 스테이징 배포 중 상호 배제]: SSH 무중단 배포(staging.zip / staging.exe 존재 & 180초 이내) 중이면 자가업데이트 양보
    try:
        _exe_dir = Path(sys.executable).resolve().parent
        for _st_name in ("Merlin_Z_Core.staging.zip", "Merlin_Z_Core_Setup.staging.exe"):
            _staging_p = _exe_dir / _st_name
            if _staging_p.exists() and (time.time() - _staging_p.stat().st_mtime) < 180.0:
                return {
                    "ok": True,
                    "status": "SKIPPED_REMOTE_STAGING_ACTIVE",
                    "version": CORE_VERSION,
                }
    except Exception:
        pass

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

            sep = "&" if "?" in download_url else "?"
            bust_url = f"{download_url}{sep}v={target_version}&ts={int(time.time())}"
            req = urllib.request.Request(
                bust_url,
                headers={
                    "User-Agent": f"Merlin_Z_Core_Updater/{CORE_VERSION}",
                    "Cache-Control": "no-cache",
                },
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                zip_bytes = resp.read()
            zip_path.write_bytes(zip_bytes)

            import shutil as _shutil_u

            extract_root = update_dir / "extracted"
            if extract_root.exists():
                _shutil_u.rmtree(extract_root, ignore_errors=True)
            extract_root.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(extract_root)

            extracted_exe: Path | None = None
            direct_cand = extract_root / "Merlin_Z_Core_Setup.exe"
            if direct_cand.exists():
                extracted_exe = direct_cand.resolve()
            else:
                for _cand in extract_root.rglob("*.exe"):
                    if _cand.name.lower() == "merlin_z_core_setup.exe":
                        extracted_exe = _cand.resolve()
                        break

            if not extracted_exe or not extracted_exe.exists():
                _SELF_UPDATE_IN_PROGRESS = False
                return

            extracted_internal = extracted_exe.parent / "_internal"
            is_onedir_update = extracted_internal.is_dir()

            # [무한 자살 루프 방어 1]: 구형 단일 exe 모드일 때 동일 바이트면 즉시 중단
            if not is_onedir_update:
                try:
                    import hashlib

                    if (
                        current_exe.exists()
                        and hashlib.sha256(extracted_exe.read_bytes()).hexdigest()
                        == hashlib.sha256(current_exe.read_bytes()).hexdigest()
                    ):
                        _SELF_UPDATE_IN_PROGRESS = False
                        return
                except Exception:
                    pass

            # [무한 자살 & 깨진 바이너리 방어 2]: 교체 전 extracted_exe --selftest를 실행하여
            # 1) NameError 등 크래시 없이 정상 실행되는지 확인하고,
            # 2) CDN 캐시로 구버전 ZIP이 내려왔을 때 다운그레이드되지 않도록 실제 내장 버전이 현재 버전보다 높을 때만 교체 허용!
            clean_child_env = {
                k: v for k, v in os.environ.items() if k not in ("_MEIPASS2", "_MEIPASS")
            }
            try:
                st_res = subprocess.run(
                    [str(extracted_exe), "--selftest"],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=12,
                    env=clean_child_env,
                    creationflags=0x08000000 if sys.platform == "win32" else 0,
                )
                if st_res.returncode != 0:
                    _SELF_UPDATE_IN_PROGRESS = False
                    return
                st_json = json.loads(st_res.stdout or "{}")
                extracted_ver = str((st_json.get("unifiedHealth") or {}).get("version") or "").strip()
                if not extracted_ver or not _is_remote_version_newer(extracted_ver, CORE_VERSION):
                    _SELF_UPDATE_IN_PROGRESS = False
                    return
            except Exception:
                _SELF_UPDATE_IN_PROGRESS = False
                return

            # Chrome/VSCode 정공법 Rename-Aside: 실행 중/좀비 잠금 파일·_internal 폴더도 옆으로 이름 변경 후 즉시 배치 + 인터랙티브 재기동
            bat_path = update_dir / "updater.bat"
            ts_tag = int(time.time())
            zombie_name = f"{current_exe.name}.zombie_{ts_tag}.tmp"
            zombie_int_name = f"_internal.zombie_{ts_tag}"
            cur_internal = current_exe.parent / "_internal"
            internal_swap_block = ""
            if is_onedir_update:
                internal_swap_block = (
                    f'  if exist "{cur_internal}" ren "{cur_internal}" "{zombie_int_name}" > NUL 2>&1\r\n'
                    f'  if exist "{extracted_internal}" (move /y "{extracted_internal}" "{cur_internal}" > NUL 2>&1 || robocopy "{extracted_internal}" "{cur_internal}" /E /MOVE /NFL /NDL /NJH /NJS /NC /NS > NUL 2>&1)\r\n'
                )
            bat_content = (
                "@echo off\r\n"
                "setlocal\r\n"
                'set "_MEIPASS2="\r\n'
                'set "_MEIPASS="\r\n'
                "timeout /t 1 /nobreak > NUL\r\n"
                "taskkill /F /T /IM Merlin_Z_Core_Setup.exe > NUL 2>&1\r\n"
                f'del /f /q "{current_exe.parent}\\*.zombie_*.tmp" > NUL 2>&1\r\n'
                "for /L %%i in (1,1,10) do (\r\n"
                f'  if exist "{current_exe}" ren "{current_exe}" "{zombie_name}" > NUL 2>&1\r\n'
                + internal_swap_block
                + f'  move /y "{extracted_exe}" "{current_exe}" > NUL 2>&1 && goto :LAUNCH\r\n'
                "  taskkill /F /T /IM Merlin_Z_Core_Setup.exe > NUL 2>&1\r\n"
                "  timeout /t 1 /nobreak > NUL\r\n"
                ")\r\n"
                ":LAUNCH\r\n"
                f'del /f /q "{current_exe.parent}\\*.zombie_*.tmp" > NUL 2>&1\r\n'
                f'rmdir /s /q "{current_exe.parent}\\{zombie_int_name}" > NUL 2>&1\r\n'
                f'rmdir /s /q "{extract_root}" > NUL 2>&1\r\n'
                'schtasks /run /tn "StartMerlinZCore5199" > NUL 2>&1 || start "" "' + str(current_exe) + '" --replace\r\n'
                'del "%~f0"\r\n'
            )
            bat_path.write_text(bat_content, encoding="mbcs", errors="replace")
            try:
                plugin_ghosti_superpowers.shutdown_superpower_daemon_for_update()
            except Exception:
                pass
            subprocess.Popen(
                ["cmd.exe", "/c", str(bat_path)],
                env=clean_child_env,
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


def _is_remote_version_newer(remote_ver: str, local_ver: str) -> bool:
    try:
        r_parts = [int(x) if x.isdigit() else 0 for x in (remote_ver or "").strip().split(".")]
        l_parts = [int(x) if x.isdigit() else 0 for x in (local_ver or "").strip().split(".")]
        for i in range(max(len(r_parts), len(l_parts))):
            rv = r_parts[i] if i < len(r_parts) else 0
            lv = l_parts[i] if i < len(l_parts) else 0
            if rv != lv:
                return rv > lv
    except Exception:
        pass
    return False


def start_periodic_remote_version_watcher() -> None:
    """브라우저를 열지 않은 상태에서도 상주 Z-코어(.exe)가 원격 최신 버전을 주기 감지해 무소음 자동 업데이트합니다."""
    if not getattr(sys, "frozen", False):
        return

    def _poll_loop() -> None:
        time.sleep(15.0)
        while True:
            try:
                url = f"https://ghosti.sundreamer.app/z_core_version.json?ts={int(time.time())}"
                req = urllib.request.Request(
                    url,
                    headers={"User-Agent": f"Merlin_Z_Core_AutoWatcher/{CORE_VERSION}"},
                )
                with urllib.request.urlopen(req, timeout=8.0) as resp:
                    info = json.loads(resp.read().decode("utf-8", errors="replace"))
                remote_ver = str(info.get("version") or "").strip()
                zip_url = str(info.get("zipUrl") or "https://ghosti.sundreamer.app/Merlin_Z_Core.zip").strip()
                if remote_ver and _is_remote_version_newer(remote_ver, CORE_VERSION):
                    trigger_silent_self_update({"targetVersion": remote_ver, "downloadUrl": zip_url})
                    return
            except Exception:
                pass
            time.sleep(1200.0)

    threading.Thread(target=_poll_loop, daemon=True).start()


def _collect_protected_self_pids() -> set[int]:
    """자기 자신 및 PyInstaller onefile 부모 부트스트래퍼 PID 체인을 보호 목록으로 수집합니다."""
    protected: set[int] = {os.getpid()}
    try:
        ppid = os.getppid()
        if ppid and ppid > 4:
            protected.add(int(ppid))
    except Exception:
        pass
    try:
        import psutil

        cur = psutil.Process(os.getpid())
        for anc in cur.parents():
            aname = (anc.name() or "").lower()
            if "merlin_z_core" in aname or aname in ("python.exe", "pythonw.exe"):
                protected.add(int(anc.pid))
    except Exception:
        pass
    return protected


def _kill_pids_tree_and_wait(target_pids: set[int], protected_pids: set[int], timeout_sec: float = 3.0) -> list[int]:
    """대상 PID와 그 모든 자식 프로세스 트리를 종료하고 완전히 사라질 때까지 최대 timeout_sec 대기합니다.
    (절대 원칙: SenseTalk_Engine.exe 는 별도 분리 운영이므로 절대 건드리지 않습니다.)
    """
    killed_pids: list[int] = []
    safe_targets: set[int] = set()
    procs_to_wait = []

    try:
        import psutil

        for pid in list(target_pids):
            if pid <= 4 or pid in protected_pids:
                continue
            try:
                p = psutil.Process(pid)
                pname = (p.name() or "").lower()
                if "sensetalk_engine" in pname:
                    continue
                # 자식 프로세스 트리까지 모두 수집
                for child in p.children(recursive=True):
                    if child.pid > 4 and child.pid not in protected_pids:
                        cname = (child.name() or "").lower()
                        if "sensetalk_engine" not in cname:
                            safe_targets.add(int(child.pid))
                            procs_to_wait.append(child)
                safe_targets.add(int(pid))
                procs_to_wait.append(p)
            except Exception:
                safe_targets.add(int(pid))
    except Exception:
        safe_targets = {p for p in target_pids if p > 4 and p not in protected_pids}

    for pid in sorted(safe_targets):
        if sys.platform == "win32":
            try:
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(pid)],
                    capture_output=True,
                    timeout=3,
                    creationflags=0x08000000,
                )
                killed_pids.append(pid)
            except Exception:
                pass
        else:
            try:
                import psutil

                psutil.Process(pid).kill()
                killed_pids.append(pid)
            except Exception:
                pass

    if procs_to_wait:
        try:
            import psutil

            _, alive = psutil.wait_procs(procs_to_wait, timeout=timeout_sec)
            for p in alive:
                try:
                    p.kill()
                except Exception:
                    pass
        except Exception:
            time.sleep(0.35)

    return killed_pids


def _self_purge_legacy_conflicts() -> None:
    """기동 직후 백그라운드 1회 실행: 구형 독립 seq_paste_daemon.py 및 중복 작업 스케줄러 자동 숙청.
    (주의: SenseTalk_Engine.exe 는 당분간 별도 분리 운영이므로 절대 숙청 목록에 넣지 않습니다!)
    """
    if sys.platform != "win32":
        return
    protected = _collect_protected_self_pids()
    legacy_pids: set[int] = set()
    try:
        import psutil

        for proc in psutil.process_iter(["pid", "name", "cmdline"]):
            try:
                pid = int(proc.info.get("pid") or 0)
                if pid <= 4 or pid in protected:
                    continue
                pname = str(proc.info.get("name") or "").lower()
                # SenseTalk_Engine.exe 절대 보호
                if "sensetalk_engine" in pname:
                    continue
                cmdline = " ".join(proc.info.get("cmdline") or []).lower()
                if "seq_paste_daemon.py" in cmdline and "merlin_z_core_setup" not in pname:
                    legacy_pids.add(pid)
            except Exception:
                continue
    except Exception:
        pass

    if legacy_pids:
        _kill_pids_tree_and_wait(legacy_pids, protected, timeout_sec=2.5)

    # 자동실행은 HKCU\...\Run\MerlinZCoreDaemon 단 1개 SSOT로 통일하고 구형 중복 스케줄러 3종 자동 삭제
    legacy_tasks = (
        "MerlinSeqPaste",
        "MerlinZCoreRestart",
        "MerlinZCoreOverlay",
    )
    for task_name in legacy_tasks:
        try:
            subprocess.run(
                ["schtasks", "/Delete", "/TN", task_name, "/F"],
                capture_output=True,
                timeout=3,
                creationflags=0x08000000,
            )
        except Exception:
            pass


def ensure_port_free(port: int, force_replace: bool = False) -> list[int]:
    """포트(기본 5199)를 점유 중인 구버전 Z-코어 및 고아 자식 프로세스 트리를 100% 정리하고 포트를 인계받습니다."""
    killed_pids: list[int] = []
    my_pid = os.getpid()
    protected_pids = _collect_protected_self_pids()

    # Fast-path: 강제 교체(--replace)가 아니고 포트가 이미 비어 있다면 1ms 만에 즉시 반환!
    # (--replace 시에는 포트가 비어 있더라도 고아 자식(--seq-paste-daemon, --ppocr-worker) 전수 청소를 수행합니다.)
    if not force_replace:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if sys.platform == "win32" and hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                    s.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
                s.bind(("127.0.0.1", port))
            return []
        except OSError:
            pass

    # 0) 이미 동일 버전의 Z-코어가 정상 실행 중이고 강제 교체(--replace)가 아니라면 중복 실행 방지를 위해 즉시 종료!
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

    # 2) 포트 점유 PID + (--replace 시) 기존 Merlin_Z_Core_Setup.exe 및 고아 자식(--seq-paste-daemon, --ppocr-worker) 전수 수집
    target_pids: set[int] = set()
    try:
        import psutil
        for conn in psutil.net_connections(kind="inet"):
            if conn.laddr and conn.laddr.port == port and conn.pid and conn.pid not in protected_pids and conn.pid > 4:
                target_pids.add(int(conn.pid))
        if force_replace:
            for proc in psutil.process_iter(["pid", "name", "cmdline"]):
                try:
                    pid = int(proc.info.get("pid") or 0)
                    if pid <= 4 or pid in protected_pids:
                        continue
                    pname = str(proc.info.get("name") or "").lower()
                    if "sensetalk_engine" in pname:
                        continue
                    cmdline = " ".join(proc.info.get("cmdline") or []).lower()
                    is_zcore_exe = "merlin_z_core_setup" in pname
                    is_zcore_child = (
                        "--seq-paste-daemon" in cmdline
                        or "--ppocr-worker" in cmdline
                        or "merlin_z_core_daemon.py" in cmdline
                    )
                    if is_zcore_exe or is_zcore_child:
                        target_pids.add(pid)
                except Exception:
                    continue
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
                        if pid_val not in protected_pids and pid_val > 4:
                            target_pids.add(pid_val)
        except Exception:
            pass

    if target_pids:
        killed_pids = _kill_pids_tree_and_wait(target_pids, protected_pids, timeout_sec=3.0)

    # 3) 포트가 완전히 풀릴 때까지 최대 2.5초 대기
    for _ in range(16):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if sys.platform == "win32" and hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                    s.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
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
                        1003,
                        "🏦 은행·결제 보안프로그램 즉시 깨우기",
                    )
                    win32gui.AppendMenu(
                        menu,
                        win32con.MF_STRING,
                        1004,
                        "↩️ 은행·보안프로그램 전부 원래 설정으로 복구",
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
                    if cmd == 1003:
                        def _wake_from_tray() -> None:
                            try:
                                import plugin_ghosti_care_suite
                                wres = plugin_ghosti_care_suite.wake_security_services(reason="tray_manual_wake")
                                wcnt = int(
                                    wres.get("wokenCount")
                                    or (int(wres.get("wokenServicesCount") or 0) + int(wres.get("wokenBridgesCount") or 0))
                                )
                                msg_txt = (
                                    f"잠자던 보안 프로그램 {wcnt}개를 즉시 깨웠습니다! 화면에 설치 안내가 보이면 F5(새로고침)를 눌러주세요."
                                    if wcnt > 0
                                    else "현재 잠자고 있는 은행·결제 보안 서비스가 없습니다 (모두 정상 대기 중)."
                                )
                                _push_tray_balloon("👻 귀신같이 은행·결제 모드 기상 완료", msg_txt)
                            except Exception:
                                pass
                        threading.Thread(target=_wake_from_tray, daemon=True).start()
                    elif cmd == 1004:
                        def _restore_from_tray() -> None:
                            try:
                                import plugin_ghosti_care_suite
                                rres = plugin_ghosti_care_suite.restore_security_services_default(allow_uac_prompt=True)
                                msg_txt = str(
                                    rres.get("toastMessage") or rres.get("message")
                                    or "모든 은행·보안 서비스를 원래 자동실행 설정으로 복구했습니다."
                                )
                                _push_tray_balloon("↩️ 은행·보안프로그램 원상복구 완료", msg_txt)
                            except Exception:
                                pass
                        threading.Thread(target=_restore_from_tray, daemon=True).start()
                    elif cmd == 1002:
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

            def _push_tray_balloon(title_txt: str, body_txt: str) -> None:
                try:
                    nid_b = (
                        hwnd,
                        0,
                        win32gui.NIF_INFO,
                        msg_tray,
                        hicon,
                        tip,
                        str(body_txt or "")[:250],
                        4000,
                        str(title_txt or "👻 귀신같이 멀린 Z-코어")[:60],
                        win32gui.NIIF_INFO,
                    )
                    win32gui.Shell_NotifyIcon(win32gui.NIM_MODIFY, nid_b)
                except Exception:
                    pass

            try:
                import plugin_ghosti_care_suite

                plugin_ghosti_care_suite.set_tray_balloon_callback(_push_tray_balloon)
            except Exception:
                pass

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
    raw_argv = sys.argv[1:]
    # 0-A) 패키징된 단일 Z-코어(.exe)에서 초능력 귀신호출(Ctrl+0 / Ctrl+우클릭) 데몬 서브프로세스 직접 구동
    if "--seq-paste-daemon" in raw_argv:
        sys.argv = [sys.argv[0]] + [a for a in raw_argv if a != "--seq-paste-daemon"]
        import seq_paste_daemon

        seq_paste_daemon.main()
        return

    # 0-B) 더블클릭·탐색기 우클릭 압축 풀기/묶기 및 권한 헬퍼 단발성 CLI 고속 실행 (포트 바인딩·뮤텍스 간섭 0%)
    _care_cli_flags = {
        "--smart-unzip",
        "--smart-zip",
        "--register-menu",
        "--unregister-menu",
        "--install-and-run-helper",
        "--run-elevated-helper",
    }
    if any(a in _care_cli_flags or any(a.startswith(f + "=") for f in _care_cli_flags) for a in raw_argv):
        import plugin_ghosti_care_suite

        plugin_ghosti_care_suite.handle_care_cli_args(raw_argv)
        return

    # 0-C) 탐색기 폴더/파일 열기 및 👆 최상단 화살표 오버레이 전용 분리 워커 (Tcl/Tk 멀티스레드 충돌 0%, 뮤텍스 간섭 0%)
    if "--gui-task-runner" in raw_argv or "gui-task-runner" in raw_argv:
        import merlin_z_core_os

        merlin_z_core_os.run_gui_task_runner()
        return

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

    # Windows Named Mutex 기반 단일 인스턴스 보장
    # 1) 일반 기동(not --replace): 이미 실행 중인 인스턴스가 있으면 즉시 종료
    _single_mutex = None
    _mutex_name = f"Local\\Merlin_Z_Core_{args.port}_SingleInstance"
    if os.name == "nt" and not args.replace:
        try:
            import ctypes as _ct

            _k32 = _ct.windll.kernel32
            _single_mutex = _k32.CreateMutexW(None, True, _mutex_name)
            if _k32.GetLastError() == 183:  # ERROR_ALREADY_EXISTS
                try:
                    with urllib.request.urlopen(f"http://127.0.0.1:{args.port}/__merlin/health", timeout=1.5) as resp:
                        hdata = json.loads(resp.read().decode("utf-8", errors="replace"))
                        if hdata.get("ok") and hdata.get("version") == CORE_VERSION:
                            os._exit(0)
                except Exception:
                    os._exit(0)
        except Exception:
            pass

    replaced_pids = ensure_port_free(args.port, force_replace=bool(getattr(args, "replace", False)))

    # 2) --replace 기동 시에도 기존 트리 종료 직후 단일 인스턴스 Mutex를 반드시 확보하여 후속 이중 기동 원천 차단
    if os.name == "nt" and _single_mutex is None:
        try:
            import ctypes as _ct

            _k32 = _ct.windll.kernel32
            _single_mutex = _k32.CreateMutexW(None, True, _mutex_name)
        except Exception:
            pass

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
        allow_reuse_address = (sys.platform != "win32")
        daemon_threads = True
        request_queue_size = 128

        def server_bind(self) -> None:
            if sys.platform == "win32" and hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                try:
                    self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
                except Exception:
                    pass
            super().server_bind()

    # 1) 포트 5199 HTTP 서버를 가장 먼저 즉시 바인딩하여 웹앱의 '실행했어요 (즉시 확인)' 헬스체크가 0.1초 만에 성공하게 보장
    srv = ReusableThreadingHTTPServer(("127.0.0.1", args.port), MerlinUnifiedHTTPHandler)

    # 2) 트레이 아이콘 및 부가 데몬(Ctrl+0 초능력, 바탕화면 타임머신)은 백그라운드 스레드에서 비동기로 기동 (HTTP 바인딩 블로킹 원천 차단)
    start_win32_tray_icon(args.port, replaced_pids=replaced_pids)

    def _start_auxiliary_watchers() -> None:
        # [진짜 0순위 0.1초 즉시 기동]: 귀신창 데몬(51988, In-Process)을 _self_purge_legacy_conflicts(10초 WMI 스캔)보다
        # 가장 먼저 0.1초 만에 기동하여 Z-코어 실행 직후 첫 Ctrl+0 / Ctrl+우클릭 대기시간을 0초대로 단축!
        try:
            plugin_ghosti_superpowers.ensure_superpower_daemon_running()
            plugin_ghosti_superpowers.start_superpower_daemon_watchdog(lambda: _SELF_UPDATE_IN_PROGRESS)
        except Exception:
            pass
        if getattr(sys, "frozen", False):
            try:
                w32.ensure_persistent_frozen_install()
            except Exception:
                pass
        # [구형 찌꺼기 자동 숙청]: 구형 seq_paste_daemon.py 및 중복 작업 스케줄러 정리 (SenseTalk_Engine.exe 제외)
        try:
            _self_purge_legacy_conflicts()
        except Exception:
            pass
        if getattr(sys, "frozen", False):
            try:
                w32.set_autostart_enabled(True)
                start_periodic_remote_version_watcher()
            except Exception:
                pass
        try:
            cleanup_stale_mei_runtime_dirs()
        except Exception:
            pass
        try:
            plugin_ghosti_superpowers.start_ghosti_browser_entry_sound_watcher()
        except Exception:
            pass
        try:
            import ghosti_safe_ops

            ghosti_safe_ops.start_desktop_timemachine_watcher()
        except Exception:
            pass
        try:
            import plugin_ghosti_care_suite

            plugin_ghosti_care_suite.start_care_suite_background_watchers()
        except Exception:
            pass
        try:
            plugin_ghosti_os.start_local_media_list_prewarmer()
        except Exception:
            pass

    if args.port == STANDARD_PORT:
        threading.Thread(target=_start_auxiliary_watchers, daemon=True).start()
    print(
        json.dumps(
            {
                "ok": True,
                "version": CORE_VERSION,
                "status": "LISTENING",
                "endpoint": f"http://127.0.0.1:{args.port}",
                "replacedOldPids": replaced_pids,
                "plugins": ["ghosti_os", "ghosti_care_suite", "senstalk", "aggrofilter"],
            },
            ensure_ascii=False,
        ),
        flush=True,
    )
    threading.Thread(
        target=plugin_paid_work_sdrive.auto_mount_s_drive_if_unlocked,
        name="sdrive-boot-automount",
        daemon=True,
    ).start()
    srv.serve_forever()


if __name__ == "__main__":
    main()
