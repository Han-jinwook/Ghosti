#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
❖ Ghosti Care Suite Plugin (plugin_ghosti_care_suite.py)
- 구시대 유틸리티 3대장(고클린·알집·알약)을 광고 0%·서버 전송 0%로 대체하는 독립 격리 플러그인 (v2.2.0).
- 3대 경량·격리 아키텍처 철칙(Zero-Engine Delegation & Try-Except Plugin Isolation & Hard Resource Quota) 준수:
  1) 모듈 A: 미사용 웹 보안 서비스 스마트 절전(Demand-Start + Stop) & 누적 스냅샷(원래 시작유형 보존) & 선행 기상·원상복구
     - 포터블 무권한 설치 유지 + 절전 기능 명시적 동의 시 최초 1회 On-Demand 권한 승격 헬퍼(GhostiSecurityCareHelper) 등록
     - 백그라운드 UAC 팝업 영구 0회, 모든 열린 창 제목(EnumWindows) 검사 후 안전 절전, 기상 시 F5 새로고침 안내, 1초 완전 원복 지원
     - 승격 헬퍼 내 번들 화이트리스트 재검증으로 권한 상승 통로 원천 차단, 사내 DRM 불가침 제외
  2) 모듈 B: 스마트 압축 풀기·묶기 (더블클릭 자동실행 + 일반 우클릭 메뉴 `딸깍` 중심 + 보조: 귀신호출 `Ctrl+0`/`Ctrl+우클릭`) & 봉인 존중
     - 패키징된 Z-코어(.exe) 영구 경로(%LOCALAPPDATA%\Programs\MerlinFamily\Merlin_Z_Core_Setup.exe) 자동 기준 등록
     - 타사 압축앱(반디집·7-Zip·알집 HKLM/UserChoice) 존중 및 해제 시 기존 연결값 완전 복원
     - 알집 동일 수준 암호 압축 완벽 지원(.zip ZipCrypto/AES-256/Deflate64, .7z 데이터+헤더 암호화, .rar RAR4/RAR5 데이터+헤더 암호화)
     - 눈 아이콘 표시 토글 + 오입력 시 찌꺼기 0바이트 클린 롤백 & 무제한 재입력 암호창
     - UTF-8 우선 판별 + NFD->NFC 한글 복원, __MACOSX/AppleDouble 제외, 금지문자 자동 치환, Zip-Slip commonpath 방어, 기존 폴더 덮어쓰기 원천 차단(_1), 단일 .gz 지원, 다중 선택 1개 ZIP 병합(YYMMDD_대표파일_외N건.zip)
  3) 모듈 C: 윈도우 기본 보안(amsi.dll In-Memory + 공식 Downloads 폴더 워처 + Defender Event ID 1116/1117 30일 필터) 무소음 수호
     - 압축 해제 직후 풀린 실행·스크립트 파일 자동 AMSI 검문, 비차단 스레드 위협 알림
  4) 모듈 D: 심층 앱 적출 (Deep Uninstaller) — 별도 격리폴더 없이 Windows OS 기본 휴지통(SHFileOperationW FOF_ALLOWUNDO) 직행,
     사용자 데이터 폴더 보호, MsiExec /I -> /X 변환 및 언인스톨러 종료 대기, 빈 질의 되묻기, 가짜 숫자 0%
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import ctypes
from ctypes import wintypes
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import threading
import time
import unicodedata
import uuid
from typing import Any, Callable, Dict, List, Optional, Tuple

try:
    import winreg
except ImportError:
    winreg = None  # type: ignore

THIS_DIR = Path(__file__).resolve().parent
_BUNDLE_DIR = Path(getattr(sys, "_MEIPASS", str(THIS_DIR)))
LOCAL_APPDATA = Path(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")))
GHOSTI_ROOT_DIR = LOCAL_APPDATA / "Ghosti"
GHOSTI_BIN_DIR = GHOSTI_ROOT_DIR / "bin"
GHOSTI_DATA_DIR = GHOSTI_ROOT_DIR / "data"
CARE_DIR = GHOSTI_DATA_DIR

WHITELIST_JSON_BUNDLED = (
    (_BUNDLE_DIR / "security_services_whitelist.json")
    if (_BUNDLE_DIR / "security_services_whitelist.json").exists()
    else (THIS_DIR / "security_services_whitelist.json")
)
WHITELIST_JSON_LOCAL = WHITELIST_JSON_BUNDLED
WHITELIST_JSON_CACHE = CARE_DIR / "security_services_whitelist_cache.json"
SLEEP_SNAPSHOT_FILE = CARE_DIR / "security_sleep_snapshot.json"
CARE_SETTINGS_FILE = CARE_DIR / "care_suite_settings.json"
GUARDIAN_DB_FILE = CARE_DIR / "defender_guardian_history.db"
CARE_METRICS_FILE = CARE_DIR / "weekly_care_metrics.json"
EXTRACTED_INDEX_QUEUE_FILE = CARE_DIR / "extracted_files_index_queue.json"
ELEVATED_ACTION_QUEUE_FILE = CARE_DIR / "security_elevated_action_queue.json"

SECURITY_CARE_HELPER_TASK_NAME = "GhostiSecurityCareHelper"

REMOTE_WHITELIST_URL = (
    "https://raw.githubusercontent.com/Han-jinwook/Ghosti/main/"
    "universal_z_core/os_agent/security_services_whitelist.json"
)

CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0

PRIVACY_BADGE_TEXT = (
    "🔒 내 파일 원본·문서 본문은 외부 서버로 절대 전송되지 않습니다 "
    "(100% 내 PC 로컬 처리 · 상업광고 영구 0% · 풀기 전 압축 내부 미열람)"
)

PLUGIN_METADATA = {
    "id": "ghosti_care_suite",
    "version": "2.2.1",
    "architecture": "ZERO_ENGINE_DELEGATION_ISOLATED_PLUGIN",
    "sealedArchiveRespect": True,
    "doubleClickNonInterference": True,
    "onDemandElevationHelperTask": SECURITY_CARE_HELPER_TASK_NAME,
    "privacyBadge": PRIVACY_BADGE_TEXT,
}

_LAST_WAKE_TIMESTAMP: float = 0.0
_LAST_FINANCE_WINDOW_SEEN: float = 0.0
_CURRENTLY_AWAKE: bool = False
_CONTEXT_MENU_ENSURED: bool = False
_TRAY_BALLOON_CALLBACK: Optional[Callable[[str, str], None]] = None


def set_tray_balloon_callback(cb: Optional[Callable[[str, str], None]]) -> None:
    """메인 Z-코어 트레이 아이콘이 기상·F5 새로고침 안내 풍선을 띄울 수 있도록 콜백을 연결합니다."""
    global _TRAY_BALLOON_CALLBACK
    _TRAY_BALLOON_CALLBACK = cb


def _notify_tray_balloon(title: str, message: str) -> None:
    cb = _TRAY_BALLOON_CALLBACK
    if cb is not None:
        try:
            threading.Thread(target=cb, args=(title, message), daemon=True).start()
        except Exception:
            pass


def _ensure_care_dir() -> None:
    CARE_DIR.mkdir(parents=True, exist_ok=True)


_CARE_SETTINGS_MEM_CACHE: Dict[str, Any] = {
    "checked_ts": 0.0,
    "mtime": -1.0,
    "data": None,
}


def _load_care_settings() -> Dict[str, Any]:
    now_m = time.monotonic()
    cached = _CARE_SETTINGS_MEM_CACHE.get("data")
    if cached is not None and (now_m - float(_CARE_SETTINGS_MEM_CACHE.get("checked_ts") or 0.0)) < 5.0:
        return dict(cached)

    _CARE_SETTINGS_MEM_CACHE["checked_ts"] = now_m
    cur_mtime = -1.0
    try:
        cur_mtime = CARE_SETTINGS_FILE.stat().st_mtime
    except Exception:
        cur_mtime = -1.0

    if cached is not None and cur_mtime == float(_CARE_SETTINGS_MEM_CACHE.get("mtime") or -2.0):
        return dict(cached)

    data_out: Dict[str, Any] = {"bankAutoSleepEnabled": False}
    if cur_mtime >= 0.0:
        try:
            data = json.loads(CARE_SETTINGS_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                data_out = data
        except Exception:
            pass
    _CARE_SETTINGS_MEM_CACHE["mtime"] = cur_mtime
    _CARE_SETTINGS_MEM_CACHE["data"] = dict(data_out)
    return data_out


def _save_care_settings(settings: Dict[str, Any]) -> None:
    _ensure_care_dir()
    try:
        tmp = CARE_SETTINGS_FILE.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(settings, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, CARE_SETTINGS_FILE)
        _CARE_SETTINGS_MEM_CACHE["mtime"] = CARE_SETTINGS_FILE.stat().st_mtime
    except Exception:
        pass
    _CARE_SETTINGS_MEM_CACHE["checked_ts"] = time.monotonic()
    _CARE_SETTINGS_MEM_CACHE["data"] = dict(settings)


def _is_bank_auto_sleep_enabled() -> bool:
    return bool(_load_care_settings().get("bankAutoSleepEnabled", False))


# ============================================================================
# 공통 OS 경로 헬퍼 (영구 Z-코어 실행파일 · 공식 Downloads 폴더 · 7z · 휴지통)
# ============================================================================
def _get_persistent_or_current_exe() -> str:
    """frozen(.exe) 환경에서는 %LOCALAPPDATA%\\Programs\\MerlinFamily\\Merlin_Z_Core_Setup.exe 영구 경로를 보장·반환합니다."""
    if getattr(sys, "frozen", False):
        try:
            import core_win32 as _cw32

            return _cw32.ensure_persistent_frozen_install()
        except Exception:
            return os.path.abspath(sys.executable)
    exe_path = Path(sys.executable)
    if exe_path.name.lower() == "python.exe":
        pyw = exe_path.with_name("pythonw.exe")
        if pyw.exists():
            exe_path = pyw
    return str(exe_path.resolve())


def _build_care_cli_command(mode_flag: str, with_arg_placeholder: bool = False) -> Tuple[str, str, str]:
    """
    (full_command_line, executable_path, arguments_only) 튜플을 반환합니다.
    - frozen(.exe) 모드: script 경로 없이 순수 Merlin_Z_Core_Setup.exe + 플래그만 호출합니다.
    - 개발(.py) 모드: pythonw.exe + plugin_ghosti_care_suite.py + 플래그를 호출합니다.
    """
    exe_str = _get_persistent_or_current_exe()
    arg_tail = f' "{ "%1" }"' if with_arg_placeholder else ""
    if getattr(sys, "frozen", False):
        args_only = f"{mode_flag}{arg_tail}".strip()
        return f'"{exe_str}" {args_only}', exe_str, args_only
    script_path = str(Path(__file__).resolve())
    args_only = f'"{script_path}" {mode_flag}{arg_tail}'.strip()
    return f'"{exe_str}" {args_only}', exe_str, args_only


def _get_downloads_dir() -> Path:
    """Windows 공식 알려진 폴더(FOLDERID_Downloads — D: 이동 및 OneDrive 리디렉션 포함)를 반환합니다."""
    try:
        import ghosti_safe_ops

        dl = ghosti_safe_ops.known_folder("downloads")
        if dl and dl.exists():
            return dl
    except Exception:
        pass
    if sys.platform == "win32":
        try:
            class _GUID(ctypes.Structure):
                _fields_ = [
                    ("Data1", ctypes.c_ulong),
                    ("Data2", ctypes.c_ushort),
                    ("Data3", ctypes.c_ushort),
                    ("Data4", ctypes.c_ubyte * 8),
                ]

            u = uuid.UUID("374DE290-123F-4565-9164-39C4925E467B")
            g = _GUID()
            g.Data1, g.Data2, g.Data3 = u.time_low, u.time_mid, u.time_hi_version
            for idx_b, b_val in enumerate(u.bytes[8:]):
                g.Data4[idx_b] = b_val
            ptr = ctypes.c_wchar_p()
            hr = ctypes.windll.shell32.SHGetKnownFolderPath(ctypes.byref(g), 0, None, ctypes.byref(ptr))
            if hr == 0 and ptr.value:
                res_p = Path(ptr.value)
                ctypes.windll.ole32.CoTaskMemFree(ptr)
                if res_p.exists():
                    return res_p
        except Exception:
            pass
    return Path.home() / "Downloads"


def _find_7z_exe() -> Optional[Path]:
    """Z-코어 내장(LGPL 7z.exe+7z.dll) 또는 시스템 설치된 7z.exe 경로를 반환합니다."""
    persistent_7z = GHOSTI_BIN_DIR / "7z" / "7z.exe"
    persistent_dll = GHOSTI_BIN_DIR / "7z" / "7z.dll"
    if persistent_7z.exists() and persistent_dll.exists():
        return persistent_7z

    for src_dir in (_BUNDLE_DIR / "bin" / "7z", THIS_DIR / "bin" / "7z"):
        src_exe = src_dir / "7z.exe"
        src_dll = src_dir / "7z.dll"
        if src_exe.exists() and src_dll.exists():
            try:
                dst_dir = GHOSTI_BIN_DIR / "7z"
                dst_dir.mkdir(parents=True, exist_ok=True)
                for fn in ("7z.exe", "7z.dll", "7z-LICENSE.txt"):
                    s = src_dir / fn
                    d = dst_dir / fn
                    if s.exists() and (not d.exists() or d.stat().st_size != s.stat().st_size):
                        shutil.copy2(s, d)
                if persistent_7z.exists():
                    return persistent_7z
            except Exception:
                return src_exe

    for sys_cand in (
        Path(r"C:\Program Files\7-Zip\7z.exe"),
        Path(r"C:\Program Files (x86)\7-Zip\7z.exe"),
    ):
        if sys_cand.exists():
            return sys_cand
    return None


def _send_path_to_windows_recycle_bin(target_path: Path) -> Dict[str, Any]:
    """
    [멀린님 확정 철칙] 별도 격리 폴더를 만들지 않고 유저가 쓰던 Windows 기본 휴지통(SHFileOperationW FOF_ALLOWUNDO)으로 이동합니다.
    네트워크/USB 등 휴지통이 없는 드라이브는 영구 삭제 위험이 있으므로 거부합니다.
    """
    if sys.platform != "win32":
        return {"ok": False, "error": "WINDOWS_ONLY"}
    resolved = target_path.resolve()
    if not resolved.exists():
        return {"ok": False, "error": "PATH_NOT_FOUND"}
    p_str = str(resolved)
    if p_str.startswith("\\\\") or len(resolved.parts) < 3:
        return {"ok": False, "error": "UNSAFE_OR_NETWORK_PATH"}
    drive_root = p_str[:3].upper()
    try:
        if ctypes.windll.kernel32.GetDriveTypeW(drive_root) != 3:  # DRIVE_FIXED
            return {"ok": False, "error": "DRIVE_HAS_NO_RECYCLE_BIN"}
    except Exception:
        return {"ok": False, "error": "DRIVE_CHECK_FAILED"}

    class _SHFILEOPSTRUCTW(ctypes.Structure):
        _fields_ = [
            ("hwnd", wintypes.HWND),
            ("wFunc", wintypes.UINT),
            ("pFrom", wintypes.LPCWSTR),
            ("pTo", wintypes.LPCWSTR),
            ("fFlags", ctypes.c_ushort),
            ("fAnyOperationsAborted", wintypes.BOOL),
            ("hNameMappings", ctypes.c_void_p),
            ("lpszProgressTitle", wintypes.LPCWSTR),
        ]

    # FO_DELETE=0x3, FOF_SILENT=0x4 | FOF_NOCONFIRMATION=0x10 | FOF_ALLOWUNDO=0x40 | FOF_NOERRORUI=0x400
    op = _SHFILEOPSTRUCTW()
    op.hwnd = 0
    op.wFunc = 0x0003
    op.pFrom = p_str + "\x00\x00"
    op.pTo = None
    op.fFlags = 0x0004 | 0x0010 | 0x0040 | 0x0400
    op.fAnyOperationsAborted = False
    op.hNameMappings = None
    op.lpszProgressTitle = None

    rc = int(ctypes.windll.shell32.SHFileOperationW(ctypes.byref(op)))
    moved_ok = (rc == 0) and (not bool(op.fAnyOperationsAborted)) and (not resolved.exists())
    return {
        "ok": moved_ok,
        "returnCode": rc,
        "path": p_str,
        "movedToRecycleBin": moved_ok,
    }


# ============================================================================
# 0. 포터블 무권한 설치 유지 + 절전 기능 최초 활성화 시 1회 On-Demand 권한 승격 헬퍼(runas)
# ============================================================================
def is_running_as_admin() -> bool:
    """현재 프로세스가 관리자 권한(Elevated)으로 실행 중인지 확인합니다."""
    if sys.platform != "win32":
        return False
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


_HELPER_TASK_REGISTERED_CACHE: Dict[str, Any] = {
    "checked_ts": 0.0,
    "value": None,
}


def is_security_care_helper_task_registered() -> bool:
    """작업 스케줄러에 최고권한 헬퍼(GhostiSecurityCareHelper)가 등록되어 있고 실행 대상이 유효한지 확인합니다 (60초 캐시로 schtasks 프로세스 폭주 차단)."""
    if sys.platform != "win32":
        return False
    now_m = time.monotonic()
    cached_val = _HELPER_TASK_REGISTERED_CACHE.get("value")
    if cached_val is not None and (now_m - float(_HELPER_TASK_REGISTERED_CACHE.get("checked_ts") or 0.0)) < 60.0:
        return bool(cached_val)
    res_val = False
    try:
        r = subprocess.run(
            ["schtasks", "/query", "/tn", SECURITY_CARE_HELPER_TASK_NAME, "/v", "/fo", "LIST"],
            capture_output=True,
            text=True,
            encoding="oem",
            errors="replace",
            timeout=2.5,
            creationflags=CREATE_NO_WINDOW,
        )
        if r.returncode == 0:
            out = r.stdout or ""
            if "_MEIPASS" not in out and "zcore_rt" not in out and not (getattr(sys, "frozen", False) and ".py" in out):
                res_val = True
    except Exception:
        res_val = False
    _HELPER_TASK_REGISTERED_CACHE["checked_ts"] = now_m
    _HELPER_TASK_REGISTERED_CACHE["value"] = res_val
    return res_val


def _register_security_care_helper_task_as_admin() -> bool:
    """관리자 권한 컨텍스트에서 작업 스케줄러 최고권한(HIGHEST) 헬퍼를 등록합니다."""
    if sys.platform != "win32":
        return False
    tr_cmd, _, _ = _build_care_cli_command("--run-elevated-helper", with_arg_placeholder=False)
    try:
        r = subprocess.run(
            [
                "schtasks",
                "/create",
                "/tn",
                SECURITY_CARE_HELPER_TASK_NAME,
                "/tr",
                tr_cmd,
                "/sc",
                "ONCE",
                "/st",
                "00:00",
                "/rl",
                "HIGHEST",
                "/f",
            ],
            capture_output=True,
            timeout=3.5,
            creationflags=CREATE_NO_WINDOW,
        )
        ok = r.returncode == 0
        _HELPER_TASK_REGISTERED_CACHE["checked_ts"] = time.monotonic() if ok else 0.0
        _HELPER_TASK_REGISTERED_CACHE["value"] = True if ok else None
        return ok
    except Exception:
        return False


def _load_bundled_only_whitelist() -> Dict[str, Any]:
    """승격 헬퍼 전용: 사용자 쓰기 가능 캐시를 읽지 않고 오직 번들 원본 화이트리스트만 로드합니다."""
    if WHITELIST_JSON_BUNDLED.exists():
        try:
            data = json.loads(WHITELIST_JSON_BUNDLED.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
        except Exception:
            pass
    return {
        "corporate_drm_never_touch": [
            "maepsbroker", "markany", "fasoo", "softcamp", "v3lite", "alyac", "msmpeng", "windefend", "securityhealth"
        ],
        "web_security_services_whitelist": [],
    }


def _filter_strictly_whitelisted_services(service_names: List[str]) -> List[str]:
    """권한 상승 방어: 오직 번들 화이트리스트에 등재된 웹 보안 서비스만 통과시킵니다."""
    wl = _load_bundled_only_whitelist()
    never_touch = {s.lower() for s in wl.get("corporate_drm_never_touch", [])}
    never_touch.update({"windefend", "sense", "wdnissvc", "mpssvc", "wscsvc", "securityhealthservice"})
    patterns: List[str] = []
    for item in wl.get("web_security_services_whitelist", []):
        for pat in item.get("service_patterns", []):
            if pat and str(pat).strip():
                patterns.append(str(pat).strip().lower())

    allowed: List[str] = []
    for raw_name in service_names:
        sname = (raw_name or "").strip()
        if not sname or not re.match(r"^[A-Za-z0-9_.\- ]{1,80}$", sname):
            continue
        s_low = sname.lower()
        if any(drm in s_low for drm in never_touch):
            continue
        if any(pat in s_low for pat in patterns):
            allowed.append(sname)
    return allowed


def _query_service_start_type(service_name: str) -> str:
    """서비스의 현재 시작 유형(auto / delayed-auto / demand)을 조회합니다."""
    if sys.platform != "win32":
        return "demand"
    try:
        r = subprocess.run(
            ["sc", "qc", service_name],
            capture_output=True,
            text=True,
            encoding="oem",
            errors="replace",
            timeout=2.0,
            creationflags=CREATE_NO_WINDOW,
        )
        out = (r.stdout or "").upper()
        if "DELAYED" in out:
            return "delayed-auto"
        if "AUTO_START" in out:
            return "auto"
        if "DEMAND_START" in out:
            return "demand"
    except Exception:
        pass
    return "demand"


def execute_elevated_service_control(
    mode: str,
    service_names: List[str],
    start_types_map: Optional[Dict[str, str]] = None,
    allow_uac_prompt: bool = True,
    register_helper_even_if_empty: bool = False,
) -> Dict[str, Any]:
    """
    - 현재 프로세스가 관리자 권한이면 즉시 직접 `sc config` / `sc stop` / `sc start` 수행.
    - 일반 권한이면:
      1) 작업 스케줄러에 `GhostiSecurityCareHelper`가 이미 등록되어 있으면 `schtasks /run`으로 UAC 팝업 0회 무소음 실행!
      2) 미등록 상태이고 allow_uac_prompt=True(유저 명시적 클릭)일 때만 딱 1회 `runas` 승격!
         백그라운드 워처(allow_uac_prompt=False)에서는 절대 UAC 창을 띄우지 않습니다.
    """
    _ensure_care_dir()
    clean_names = _filter_strictly_whitelisted_services(service_names)
    if sys.platform != "win32":
        return {"ok": True, "processedServices": [], "elevationMethod": "NON_WINDOWS"}
    if not clean_names:
        return {"ok": True, "processedServices": [], "elevationMethod": "NONE_NEEDED", "uacPromptShown": False}

    if is_running_as_admin():
        if register_helper_even_if_empty and not is_security_care_helper_task_registered():
            _register_security_care_helper_task_as_admin()
        processed = _perform_direct_sc_operations(mode, clean_names, start_types_map=start_types_map)
        return {
            "ok": True,
            "processedServices": processed,
            "elevationMethod": "DIRECT_ADMIN",
            "uacPromptShown": False,
        }

    req_id = f"{mode}_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}"
    queue_payload = {
        "requestId": req_id,
        "mode": mode,
        "serviceNames": clean_names,
        "startTypesMap": start_types_map or {},
        "requestedAt": datetime.datetime.now().isoformat(),
        "completed": False,
        "processedServices": [],
    }
    try:
        ELEVATED_ACTION_QUEUE_FILE.write_text(
            json.dumps(queue_payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception:
        pass

    # 1) 이미 작업 스케줄러 최고권한 헬퍼가 등록된 경우 -> UAC 팝업 0회로 즉시 트리거 (PyInstaller 66MB 첫 언패킹 고려 최대 10초 폴링)
    if is_security_care_helper_task_registered():
        if not clean_names:
            return {"ok": True, "processedServices": [], "elevationMethod": "SCHTASKS_ALREADY_READY", "uacPromptShown": False}
        sch_ok = False
        try:
            r_sch = subprocess.run(
                ["schtasks", "/run", "/tn", SECURITY_CARE_HELPER_TASK_NAME],
                capture_output=True,
                timeout=3.0,
                creationflags=CREATE_NO_WINDOW,
            )
            sch_ok = (r_sch.returncode == 0)
            for _ in range(100):
                time.sleep(0.1)
                if ELEVATED_ACTION_QUEUE_FILE.exists():
                    data = json.loads(ELEVATED_ACTION_QUEUE_FILE.read_text(encoding="utf-8"))
                    if data.get("requestId") == req_id and data.get("completed"):
                        return {
                            "ok": True,
                            "processedServices": list(data.get("processedServices") or []),
                            "elevationMethod": "SCHTASKS_HIGHEST_ZERO_UAC",
                            "uacPromptShown": False,
                        }
        except Exception:
            pass
        if sch_ok or not allow_uac_prompt:
            return {
                "ok": False,
                "processedServices": [],
                "elevationMethod": "SCHTASKS_TIMEOUT_NO_UAC",
                "uacPromptShown": False,
            }

    if not allow_uac_prompt:
        return {
            "ok": False,
            "processedServices": [],
            "elevationMethod": "BACKGROUND_UAC_SUPPRESSED",
            "uacPromptShown": False,
        }

    # 2) 최초 1회: 유저 명시적 클릭 시에만 ShellExecuteW(None, "runas", ...)로 헬퍼 등록 + 즉시 실행 (비대화형 세션 블로킹 방지를 위해 데몬 스레드 실행)
    _, exe_str, params = _build_care_cli_command("--install-and-run-helper", with_arg_placeholder=False)
    try:
        ret_box: List[int] = [0]

        def _invoke_runas() -> None:
            try:
                ret_box[0] = int(
                    ctypes.windll.shell32.ShellExecuteW(
                        None,
                        "runas",
                        exe_str,
                        params,
                        str(Path(exe_str).parent),
                        0,  # SW_HIDE
                    )
                )
            except Exception:
                ret_box[0] = 0

        t_uac = threading.Thread(target=_invoke_runas, daemon=True)
        t_uac.start()
        t_uac.join(timeout=3.5)
        if not t_uac.is_alive() and ret_box[0] > 32:
            for _ in range(35):
                time.sleep(0.1)
                if ELEVATED_ACTION_QUEUE_FILE.exists():
                    data = json.loads(ELEVATED_ACTION_QUEUE_FILE.read_text(encoding="utf-8"))
                    if data.get("requestId") == req_id and data.get("completed"):
                        return {
                            "ok": True,
                            "processedServices": list(data.get("processedServices") or []),
                            "elevationMethod": "ON_DEMAND_RUNAS_ONCE_AND_SCHTASKS_REGISTERED",
                            "uacPromptShown": True,
                        }
    except Exception:
        pass

    return {
        "ok": False,
        "uacDeclined": True,
        "processedServices": [],
        "elevationMethod": "UAC_DECLINED_OR_PENDING",
        "uacPromptShown": True,
    }


def _perform_direct_sc_operations(
    mode: str,
    service_names: List[str],
    start_types_map: Optional[Dict[str, str]] = None,
) -> List[str]:
    """관리자 권한 상태에서 화이트리스트 재검증 후 sc config / sc stop / sc start를 병렬 수행합니다."""
    if sys.platform != "win32" or not service_names:
        return []
    if mode not in ("sleep", "wake", "restore"):
        return []
    safe_names = _filter_strictly_whitelisted_services(service_names)
    if not safe_names:
        return []
    st_map = start_types_map or {}

    def _work(sname: str) -> Optional[str]:
        try:
            if mode == "sleep":
                subprocess.run(
                    ["sc", "config", sname, "start=", "demand"],
                    capture_output=True,
                    timeout=2.0,
                    creationflags=CREATE_NO_WINDOW,
                )
                r = subprocess.run(
                    ["sc", "stop", sname],
                    capture_output=True,
                    timeout=2.5,
                    creationflags=CREATE_NO_WINDOW,
                )
                out_str = r.stdout.decode("oem", errors="ignore") if r.stdout else ""
                stopped_ok = (r.returncode == 0 or "STOP" in out_str or "1062" in out_str)
                # NOT_STOPPABLE(1052) 또는 STOP_PENDING 지연 보안 서비스는 sc queryex로 해당 서비스 PID만 정확히 조회해 즉시 종료
                r_qex = subprocess.run(
                    ["sc", "queryex", sname],
                    capture_output=True,
                    timeout=2.0,
                    creationflags=CREATE_NO_WINDOW,
                )
                qex_str = r_qex.stdout.decode("oem", errors="ignore") if r_qex.stdout else ""
                if "RUNNING" in qex_str or "STOP_PENDING" in qex_str or not stopped_ok:
                    m_pid = re.search(r"PID\s*:\s*(\d+)", qex_str, re.IGNORECASE)
                    svc_pid = int(m_pid.group(1)) if m_pid else 0
                    if svc_pid > 4:
                        rk = subprocess.run(
                            ["taskkill", "/F", "/PID", str(svc_pid)],
                            capture_output=True,
                            timeout=2.0,
                            creationflags=CREATE_NO_WINDOW,
                        )
                        if rk.returncode == 0:
                            stopped_ok = True
                if stopped_ok or "STOPPED" in qex_str or "1062" in out_str:
                    return sname
            elif mode == "wake":
                r = subprocess.run(
                    ["sc", "start", sname],
                    capture_output=True,
                    timeout=3.0,
                    creationflags=CREATE_NO_WINDOW,
                )
                out_str = r.stdout.decode("oem", errors="ignore") if r.stdout else ""
                if r.returncode == 0 or "START" in out_str or "RUNNING" in out_str or "1056" in out_str:
                    return sname
            elif mode == "restore":
                orig_st = str(st_map.get(sname) or "auto").strip().lower()
                if orig_st not in ("auto", "delayed-auto", "demand"):
                    orig_st = "auto"
                subprocess.run(
                    ["sc", "config", sname, "start=", orig_st],
                    capture_output=True,
                    timeout=2.0,
                    creationflags=CREATE_NO_WINDOW,
                )
                r = subprocess.run(
                    ["sc", "start", sname],
                    capture_output=True,
                    timeout=3.0,
                    creationflags=CREATE_NO_WINDOW,
                )
                out_str = r.stdout.decode("oem", errors="ignore") if r.stdout else ""
                if r.returncode == 0 or "START" in out_str or "RUNNING" in out_str or "1056" in out_str:
                    return sname
        except Exception:
            pass
        return None

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(_work, safe_names))
    return [r for r in results if r]


def execute_elevated_agent_care_queue(
    mode: str,
    extra_payload: Dict[str, Any],
    allow_uac_prompt: bool = True,
) -> Dict[str, Any]:
    """
    [Zero-Trust 최고권한 헬퍼 에이전트 큐 브릿지]
    - 허용 모드: 'batch_uninstall'({entries:[{hive,subkey}]}), 'eradicate_pups'({pupIds:[...]}), 'powercfg'({powerAction:'hiber_off'|'power_high'})
    - 웹/LLM이 보낸 임의 커맨드 문자열은 절대 받지 않고 오직 검증된 식별자만 전달합니다.
    """
    _ensure_care_dir()
    if sys.platform != "win32":
        return {"ok": False, "error": "WINDOWS_ONLY"}
    if mode not in ("batch_uninstall", "eradicate_pups", "powercfg", "hidden_rats_apply"):
        return {"ok": False, "error": "INVALID_AGENT_MODE"}

    req_id = f"agent_{mode}_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}"
    queue_payload = {
        "requestId": req_id,
        "mode": mode,
        **extra_payload,
        "requestedAt": datetime.datetime.now().isoformat(),
        "completed": False,
    }
    try:
        ELEVATED_ACTION_QUEUE_FILE.write_text(
            json.dumps(queue_payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception as exc:
        return {"ok": False, "error": str(exc)}

    max_polls = 240 if mode == "batch_uninstall" else 90
    if is_security_care_helper_task_registered():
        try:
            subprocess.run(
                ["schtasks", "/run", "/tn", SECURITY_CARE_HELPER_TASK_NAME],
                capture_output=True,
                timeout=3.0,
                creationflags=CREATE_NO_WINDOW,
            )
            for _ in range(max_polls):
                time.sleep(0.25)
                if ELEVATED_ACTION_QUEUE_FILE.exists():
                    data = json.loads(ELEVATED_ACTION_QUEUE_FILE.read_text(encoding="utf-8"))
                    if data.get("requestId") == req_id and data.get("completed"):
                        return {**data, "ok": bool(data.get("ok", True)), "elevationMethod": "SCHTASKS_HIGHEST_ZERO_UAC"}
        except Exception:
            pass
        return {"ok": False, "error": "SCHTASKS_TIMEOUT"}

    if not allow_uac_prompt:
        return {"ok": False, "error": "HELPER_NOT_REGISTERED"}

    _, exe_str, params = _build_care_cli_command("--install-and-run-helper", with_arg_placeholder=False)
    try:
        ret_box: List[int] = [0]

        def _invoke_runas() -> None:
            try:
                ret_box[0] = int(
                    ctypes.windll.shell32.ShellExecuteW(
                        None, "runas", exe_str, params, str(Path(exe_str).parent), 0
                    )
                )
            except Exception:
                ret_box[0] = 0

        t_uac = threading.Thread(target=_invoke_runas, daemon=True)
        t_uac.start()
        t_uac.join(timeout=4.0)
        if not t_uac.is_alive() and ret_box[0] > 32:
            for _ in range(max_polls):
                time.sleep(0.25)
                if ELEVATED_ACTION_QUEUE_FILE.exists():
                    data = json.loads(ELEVATED_ACTION_QUEUE_FILE.read_text(encoding="utf-8"))
                    if data.get("requestId") == req_id and data.get("completed"):
                        return {**data, "ok": bool(data.get("ok", True)), "elevationMethod": "RUNAS_ONCE_REGISTERED"}
    except Exception:
        pass
    return {"ok": False, "error": "UAC_DECLINED_OR_TIMEOUT"}


def _process_elevated_helper_queue(install_task_too: bool = False) -> None:
    """승격된 헬퍼 프로세스에서 호출되어 작업 스케줄러 등록 및 화이트리스트/Zero-Trust 검증된 작업을 수행합니다."""
    _ensure_care_dir()
    if install_task_too:
        _register_security_care_helper_task_as_admin()

    if not ELEVATED_ACTION_QUEUE_FILE.exists():
        return
    try:
        data = json.loads(ELEVATED_ACTION_QUEUE_FILE.read_text(encoding="utf-8"))
        if data.get("completed"):
            return
        mode = str(data.get("mode") or "sleep").strip().lower()
        if mode in ("sleep", "wake", "restore"):
            raw_names = [str(x) for x in (data.get("serviceNames") or []) if x]
            safe_names = _filter_strictly_whitelisted_services(raw_names)
            raw_st_map = data.get("startTypesMap")
            st_map = {str(k): str(v) for k, v in raw_st_map.items()} if isinstance(raw_st_map, dict) else {}
            processed = _perform_direct_sc_operations(mode, safe_names, start_types_map=st_map) if safe_names else []
            data["completed"] = True
            data["ok"] = True
            data["processedServices"] = processed
        elif mode == "batch_uninstall":
            from plugins import plugin_ghosti_agent_care as _ag_care
            entries = [e for e in (data.get("entries") or []) if isinstance(e, dict)]
            res_u = _ag_care.execute_elevated_registry_uninstall_verified(entries)
            data["completed"] = True
            data["ok"] = bool(res_u.get("ok"))
            data["uninstallResults"] = res_u.get("results", [])
        elif mode == "eradicate_pups":
            from plugins import plugin_ghosti_agent_care as _ag_care
            pup_ids = [str(x) for x in (data.get("pupIds") or []) if x in _ag_care.KNOWN_PUP_CATALOG]
            pup_res = [_ag_care.eradicate_known_pup_by_id(pid) for pid in pup_ids]
            data["completed"] = True
            data["ok"] = True
            data["pupResults"] = pup_res
        elif mode == "hidden_rats_apply":
            from plugins import plugin_ghosti_agent_care as _ag_care
            d_tasks = [str(x) for x in (data.get("disableTasks") or []) if x]
            m_svcs = [str(x) for x in (data.get("manualServices") or []) if x]
            res_hr = _ag_care.execute_elevated_hidden_rats_verified(d_tasks, m_svcs)
            data["completed"] = True
            data["ok"] = bool(res_hr.get("ok"))
            data["disabledTasks"] = res_hr.get("disabledTasks", [])
            data["manualServices"] = res_hr.get("manualServices", [])
        elif mode == "powercfg":
            from plugins import plugin_ghosti_agent_care as _ag_care
            pact = str(data.get("powerAction") or "")
            desk = _ag_care.is_pure_desktop_pc()
            if not desk.get("isDesktop"):
                data["completed"] = True
                data["ok"] = False
                data["rejectedReason"] = "LAPTOP_BATTERY_GUARD_BLOCKED"
            elif pact == "hiber_off":
                r = subprocess.run(["powercfg", "-h", "off"], capture_output=True, timeout=6.0, creationflags=CREATE_NO_WINDOW)
                data["completed"] = True
                data["ok"] = r.returncode == 0
            elif pact == "power_high":
                r = subprocess.run(["powercfg", "/setactive", "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c"], capture_output=True, timeout=6.0, creationflags=CREATE_NO_WINDOW)
                data["completed"] = True
                data["ok"] = r.returncode == 0
            else:
                data["completed"] = True
                data["ok"] = False
                data["rejectedReason"] = "INVALID_POWERCFG_ACTION"
        else:
            data["completed"] = True
            data["ok"] = False
            data["processedServices"] = []
            data["rejectedReason"] = "INVALID_MODE"
        data["completedAt"] = datetime.datetime.now().isoformat()
        ELEVATED_ACTION_QUEUE_FILE.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception:
        pass


# ============================================================================
# 1. 5KB 정적 JSON 화이트리스트 로더 & 주간 무소음 원격 동기화
# ============================================================================
_SECURITY_WHITELIST_MEM_CACHE: Dict[str, Any] = {
    "checked_ts": 0.0,
    "mtimes": (-1.0, -1.0),
    "data": None,
}


def load_security_whitelist(allow_remote_sync: bool = False) -> Dict[str, Any]:
    now_m = time.monotonic()
    if not allow_remote_sync:
        cached = _SECURITY_WHITELIST_MEM_CACHE.get("data")
        if cached is not None and (now_m - float(_SECURITY_WHITELIST_MEM_CACHE.get("checked_ts") or 0.0)) < 60.0:
            return cached

    _ensure_care_dir()
    if allow_remote_sync:
        try:
            import urllib.request

            req = urllib.request.Request(
                REMOTE_WHITELIST_URL,
                headers={"User-Agent": "Merlin-Z-Core-CareSuite/2.2"},
            )
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                raw = resp.read().decode("utf-8")
                parsed = json.loads(raw)
                if isinstance(parsed, dict) and "web_security_services_whitelist" in parsed:
                    WHITELIST_JSON_CACHE.write_text(
                        json.dumps(parsed, ensure_ascii=False, indent=2),
                        encoding="utf-8",
                    )
                    _SECURITY_WHITELIST_MEM_CACHE["checked_ts"] = time.monotonic()
                    _SECURITY_WHITELIST_MEM_CACHE["data"] = parsed
                    return parsed
        except Exception:
            pass

    mt_pair = (
        WHITELIST_JSON_BUNDLED.stat().st_mtime if WHITELIST_JSON_BUNDLED.exists() else -1.0,
        WHITELIST_JSON_CACHE.stat().st_mtime if WHITELIST_JSON_CACHE.exists() else -1.0,
    )
    cached = _SECURITY_WHITELIST_MEM_CACHE.get("data")
    if cached is not None and mt_pair == _SECURITY_WHITELIST_MEM_CACHE.get("mtimes"):
        _SECURITY_WHITELIST_MEM_CACHE["checked_ts"] = now_m
        return cached

    for candidate in (WHITELIST_JSON_BUNDLED, WHITELIST_JSON_CACHE):
        if candidate.exists():
            try:
                data = json.loads(candidate.read_text(encoding="utf-8"))
                if isinstance(data, dict) and data.get("web_security_services_whitelist"):
                    _SECURITY_WHITELIST_MEM_CACHE["checked_ts"] = now_m
                    _SECURITY_WHITELIST_MEM_CACHE["mtimes"] = mt_pair
                    _SECURITY_WHITELIST_MEM_CACHE["data"] = data
                    return data
            except Exception:
                continue

    fallback_wl = {
        "version": "2026.11.15.fallback",
        "corporate_drm_never_touch": [
            "maepsbroker", "markany", "fasoo", "softcamp", "v3lite", "alyac", "msmpeng"
        ],
        "kernel_self_defense_services": ["ahnlab", "astx", "npkcrypt", "nossvc", "nprotect", "nosstarter"],
        "web_security_services_whitelist": [
            {"id": "anysign", "display_name": "AnySign4PC (한컴위드 전자서명)", "service_patterns": ["anysign"], "tray_executables": ["anysign4pc.exe"]},
            {"id": "touchen_nxkey", "display_name": "TouchEn nxKey (라온시큐어 키보드보안)", "service_patterns": ["touchen", "nxkey"], "tray_executables": ["touchen_nxkey.exe"]},
            {"id": "veraport", "display_name": "VeraPort (위즈베라 통합설치)", "service_patterns": ["veraport"], "tray_executables": ["veraport.exe"]},
            {"id": "delfino", "display_name": "Delfino (위즈베라 전자서명)", "service_patterns": ["delfino"], "tray_executables": ["delfino.exe"]},
            {"id": "iniline", "display_name": "CrossEX / INISAFE (이니텍 금융보안)", "service_patterns": ["iniline", "crossex", "inisafe"], "tray_executables": ["crossexservice.exe"]},
            {"id": "ipinside", "display_name": "IPinside LWS (인터리젠 단말정보)", "service_patterns": ["ipinside", "i3gproc"], "tray_executables": ["i3gproc.exe"]},
            {"id": "magicline", "display_name": "MagicLine4NX (드림시큐리티)", "service_patterns": ["magicline"], "tray_executables": ["magicline4nx.exe"]},
        ],
        "wake_window_title_keywords": ["은행", "뱅크", "홈택스", "정부24", "결제", "본인인증", "공동인증서", "인터넷뱅킹", "카드"],
        "sleep_grace_period_seconds": 900,
    }
    _SECURITY_WHITELIST_MEM_CACHE["checked_ts"] = now_m
    _SECURITY_WHITELIST_MEM_CACHE["mtimes"] = mt_pair
    _SECURITY_WHITELIST_MEM_CACHE["data"] = fallback_wl
    return fallback_wl


# ============================================================================
# 2. [모듈 A] 미사용 웹 보안 서비스 스마트 절전 & 누적 스냅샷 & 기상 · 완전 원복
# ============================================================================
def _load_weekly_metrics() -> Dict[str, Any]:
    _ensure_care_dir()
    if CARE_METRICS_FILE.exists():
        try:
            return json.loads(CARE_METRICS_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {
        "sleepCountThisWeek": 0,
        "wakeCountThisWeek": 0,
        "savedRamMbCumulative": 0,
        "savedCpuHoursEstimate": 0.0,
        "lastSleepAt": None,
        "lastWakeAt": None,
    }


def _save_weekly_metrics(metrics: Dict[str, Any]) -> None:
    _ensure_care_dir()
    try:
        CARE_METRICS_FILE.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass


def _count_downloads_archive_files() -> Dict[str, Any]:
    """공식 다운로드 폴더 내 압축파일(.zip/.7z/.rar/.tar/.gz/.tgz) 누적 건수 및 최신 파일 경로(풀기 전 내부 미열람 원칙)"""
    count = 0
    samples: List[str] = []
    latest_path = ""
    latest_name = ""
    try:
        dl_dir = _get_downloads_dir()
        if dl_dir.exists() and dl_dir.is_dir():
            archive_exts = {".zip", ".7z", ".rar", ".tar", ".gz", ".tgz"}
            entries = sorted(
                [p for p in dl_dir.iterdir() if p.is_file() and p.suffix.lower() in archive_exts],
                key=lambda x: x.stat().st_mtime if x.exists() else 0,
                reverse=True,
            )
            count = len(entries)
            samples = [p.name for p in entries[:3]]
            if entries:
                latest_path = str(entries[0])
                latest_name = entries[0].name
    except Exception:
        pass
    return {
        "count": count,
        "thresholdMet": count >= 3,
        "samples": samples,
        "latestPath": latest_path,
        "latestFileName": latest_name,
    }


def _load_sleep_snapshot() -> Dict[str, Any]:
    if SLEEP_SNAPSHOT_FILE.exists():
        try:
            data = json.loads(SLEEP_SNAPSHOT_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                wl_data = load_security_whitelist(allow_remote_sync=False)
                excl = tuple(
                    str(s).strip().lower()
                    for s in list(wl_data.get("corporate_drm_never_touch", []))
                    + list(wl_data.get("kernel_self_defense_services", []))
                    if str(s).strip()
                )
                wl_tokens: List[str] = []
                for item in wl_data.get("web_security_services_whitelist", []):
                    for pat in list(item.get("service_patterns", [])) + list(item.get("tray_executables", [])):
                        pt = str(pat).strip().lower()
                        if pt.endswith(".exe"):
                            pt = pt[:-4]
                        if pt:
                            wl_tokens.append(pt)
                clean_svcs = [
                    s for s in (data.get("services") or [])
                    if isinstance(s, dict)
                    and s.get("serviceName")
                    and not any(ex in str(s.get("serviceName") or "").lower() for ex in excl)
                    and any(wt in str(s.get("serviceName") or "").lower() for wt in wl_tokens)
                ]
                clean_bridges = []
                for b in (data.get("userBridgeProcesses") or []):
                    if not isinstance(b, dict):
                        continue
                    comb = f"{b.get('name') or ''} {b.get('exe') or ''} {b.get('startupName') or ''}".lower()
                    if any(ex in comb for ex in excl) or any(ft in comb for ft in _SAFE_FAMILY_TOKENS):
                        continue
                    if any(wt in comb for wt in wl_tokens):
                        clean_bridges.append(b)
                data["services"] = clean_svcs
                data["userBridgeProcesses"] = clean_bridges
                return data
        except Exception:
            pass
    return {"savedAt": None, "services": [], "userBridgeProcesses": []}


def _save_sleep_snapshot(snap: Dict[str, Any]) -> None:
    _ensure_care_dir()
    try:
        tmp = SLEEP_SNAPSHOT_FILE.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(snap, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, SLEEP_SNAPSHOT_FILE)
    except Exception:
        pass


def get_security_services_status() -> Dict[str, Any]:
    """sc query 및 프로세스 100% 실측 기반 정직 브리핑 (0개일 때 거짓 경보 금지)"""
    global _CONTEXT_MENU_ENSURED
    if not _CONTEXT_MENU_ENSURED:
        _CONTEXT_MENU_ENSURED = True
        try:
            register_explorer_context_menu()
        except Exception:
            pass

    wl_data = load_security_whitelist(allow_remote_sync=False)
    never_touch = {s.lower() for s in wl_data.get("corporate_drm_never_touch", [])}
    self_defense = {s.lower() for s in wl_data.get("kernel_self_defense_services", [])}
    whitelist_items = wl_data.get("web_security_services_whitelist", [])

    running_services: List[Dict[str, Any]] = []
    self_defense_detected: List[str] = []
    self_defense_modules: List[Dict[str, Any]] = []
    seen_sd_keys: set[str] = set()
    corporate_drm_protected: List[str] = []

    def _classify_self_defense_module(raw_svc: str, raw_disp: str) -> Tuple[str, str]:
        comb = f"{raw_svc} {raw_disp}".lower()
        if any(k in comb for k in ("astx", "ahnlab", "safetransaction", "safe_transaction")):
            return "astx", "AhnLab Safe Transaction (자가보호 금융보안)"
        if any(k in comb for k in ("nossvc", "nprotect", "npkcrypt", "nosstarter")):
            return "nprotect", "nProtect Online Security (자가보호 금융보안)"
        return (raw_svc.lower() or "self_defense"), f"{raw_disp or raw_svc} (자가보호 상주 보안)"

    if sys.platform == "win32":
        try:
            proc = subprocess.run(
                ["sc", "query", "state=", "all"],
                capture_output=True,
                text=True,
                encoding="oem",
                errors="replace",
                timeout=2.5,
                creationflags=CREATE_NO_WINDOW,
            )
            current_svc = ""
            current_disp = ""
            for line in proc.stdout.splitlines():
                line_s = line.strip()
                if line_s.startswith("SERVICE_NAME:") or line_s.startswith("서비스 이름:"):
                    current_svc = line_s.split(":", 1)[1].strip()
                    current_disp = current_svc
                elif line_s.startswith("DISPLAY_NAME:") or line_s.startswith("표시 이름:"):
                    current_disp = line_s.split(":", 1)[1].strip()
                elif (line_s.startswith("STATE") or line_s.startswith("상태")) and "RUNNING" in line_s and current_svc:
                    svc_low = current_svc.lower()
                    disp_low = current_disp.lower()

                    if any(sd in svc_low or sd in disp_low for sd in self_defense):
                        sd_key, sd_label = _classify_self_defense_module(current_svc, current_disp)
                        self_defense_detected.append(sd_label)
                        if sd_key not in seen_sd_keys:
                            seen_sd_keys.add(sd_key)
                            self_defense_modules.append({
                                "id": sd_key,
                                "serviceName": current_svc,
                                "displayName": sd_label,
                                "isSelfDefense": True,
                                "recommendUninstall": True,
                                "estimatedRamMb": 55,
                            })
                        current_svc = ""
                        continue
                    if any(drm in svc_low or drm in disp_low for drm in never_touch):
                        corporate_drm_protected.append("사내 문서보안(DRM) 서비스")
                        current_svc = ""
                        continue

                    for item in whitelist_items:
                        patterns = [p.lower() for p in item.get("service_patterns", [])]
                        if any(pat in svc_low or pat in disp_low for pat in patterns):
                            running_services.append({
                                "serviceName": current_svc,
                                "displayName": item.get("display_name") or "미사용 웹 보안 서비스",
                                "groupId": item.get("id"),
                                "estimatedRamMb": 45,
                            })
                            break
                    current_svc = ""
        except Exception:
            pass

        # 유저 세션에서 실행 중인 AhnLab Safe Transaction / nProtect 프로세스도 누락 없이 집계
        try:
            for pinfo in _iter_windows_processes_stdlib():
                pname = str(pinfo.get("name") or "").strip()
                pexe = str(pinfo.get("exe") or "").strip()
                comb = f"{pname} {pexe}".lower()
                if any(sd in comb for sd in self_defense):
                    sd_key, sd_label = _classify_self_defense_module(pname, pname)
                    self_defense_detected.append(sd_label)
                    if sd_key not in seen_sd_keys:
                        seen_sd_keys.add(sd_key)
                        self_defense_modules.append({
                            "id": sd_key,
                            "serviceName": pname,
                            "displayName": sd_label,
                            "isSelfDefense": True,
                            "recommendUninstall": True,
                            "estimatedRamMb": max(35, int(round(float(pinfo.get("memoryMb") or 45.0)))),
                        })
        except Exception:
            pass

    active_svc_count = len(running_services)
    running_user_bridges = _scan_running_user_security_processes()
    active_labels_dedup: List[str] = []
    for rs in running_services:
        lbl = str(rs.get("displayName") or rs.get("serviceName") or "").strip()
        if lbl and lbl not in active_labels_dedup:
            active_labels_dedup.append(lbl)
    for rb in running_user_bridges:
        lbl = str(rb.get("label") or rb.get("name") or "").strip()
        if lbl and lbl not in active_labels_dedup:
            active_labels_dedup.append(lbl)

    active_count = len(active_labels_dedup)
    self_defense_count = len(self_defense_modules)
    total_detected_count = active_count + self_defense_count
    estimated_ram_mb = (
        sum(int(s.get("estimatedRamMb", 45)) for s in running_services)
        + sum(int(round(float(b.get("memoryMb") or 18.0))) for b in running_user_bridges)
        + sum(int(sd.get("estimatedRamMb", 55)) for sd in self_defense_modules)
    )

    snap = _load_sleep_snapshot()
    sleeping_services = [
        str(s.get("serviceName", ""))
        for s in (snap.get("services") or [])
        if isinstance(s, dict) and s.get("serviceName")
    ]
    sleeping_labels: List[str] = []
    for s in (snap.get("services") or []):
        if isinstance(s, dict):
            sl = str(s.get("displayName") or s.get("serviceName") or "").strip()
            if sl and sl not in sleeping_labels:
                sleeping_labels.append(sl)
    for b in (snap.get("userBridgeProcesses") or []):
        if isinstance(b, dict):
            bl = str(b.get("label") or b.get("name") or "").strip()
            if bl and bl not in sleeping_labels:
                sleeping_labels.append(bl)

    sd_labels = [str(m.get("displayName") or m.get("serviceName") or "") for m in self_defense_modules if m.get("displayName") or m.get("serviceName")]
    if active_count > 0 and self_defense_count > 0:
        honest_message = (
            f"👻 현재 미사용 은행·관공서 보안 모듈 총 {total_detected_count}종(절전 가능 {active_count}종 + 자가보호 {self_defense_count}종, 약 {estimated_ram_mb}MB)이 실행 중이에요. "
            f"{', '.join(sd_labels)}는 커널 자가보호가 걸려 있어 절전보다 [안 쓰는 보안앱 완전 삭제]를 권장하며, 나머지는 [안 지우고 잠재우기]로 쿨쿨 재울 수 있습니다."
        )
    elif active_count > 0:
        honest_message = (
            f"👻 현재 미사용 은행·관공서 보안 모듈 {active_count}종(약 {estimated_ram_mb}MB)이 뒤에서 실행 중이에요. "
            "안 지우고 잠재우거나(은행 접속 시 1초 자동 기상), 아예 안 쓰시면 완전 삭제도 가능합니다."
        )
    elif self_defense_count > 0:
        honest_message = (
            f"👻 현재 자가보호 상주 보안 모듈 {self_defense_count}종({', '.join(sd_labels)}, 약 {estimated_ram_mb}MB)이 뒤에서 실행 중이에요. "
            "이 모듈들은 커널 자가보호가 걸려 있어 절전보다 [안 쓰는 보안앱 완전 삭제]로 깔끔히 제거하는 것을 권장합니다."
        )
    elif sleeping_labels and not _CURRENTLY_AWAKE:
        honest_message = (
            f"👻 현재 은행·관공서 보안 모듈 {len(sleeping_labels)}종({', '.join(sleeping_labels[:4])})이 조용히 절전 수면 중이에요. "
            "은행 사이트에 들어가시거나 [🏦 보안프로그램 즉시 깨우기]를 누르시면 1초 만에 다시 깨어납니다."
        )
    else:
        honest_message = (
            "👻 오! 현재 켜져 있는 미사용 웹 보안 프로그램이 0개로 아주 깨끗합니다! "
            "앞으로 은행·관공서 다녀오실 때만 알아서 재우고 깨워드릴게요."
        )

    metrics = _load_weekly_metrics()
    dl_archives = _count_downloads_archive_files()
    return {
        "ok": True,
        "featureTitle": "🏦 안 쓰는 은행·관공서 보안프로그램 자동 재우기",
        "activeCount": active_count,
        "selfDefenseCount": self_defense_count,
        "totalDetectedCount": total_detected_count,
        "activeServiceCount": active_svc_count,
        "estimatedRamMb": estimated_ram_mb,
        "runningServices": running_services,
        "runningUserBridges": running_user_bridges,
        "activeModuleLabels": active_labels_dedup,
        "selfDefenseModules": self_defense_modules,
        "selfDefenseModuleLabels": sd_labels,
        "sleepingServices": sleeping_services,
        "sleepingModuleLabels": sleeping_labels if not _CURRENTLY_AWAKE else [],
        "autoSleepEnabled": _is_bank_auto_sleep_enabled(),
        "currentlyAwake": _CURRENTLY_AWAKE,
        "selfDefenseGuided": list(dict.fromkeys(self_defense_detected)),
        "corporateDrmUntouchedCount": len(set(corporate_drm_protected)),
        "helperTaskRegistered": is_security_care_helper_task_registered(),
        "honestBriefing": honest_message,
        "downloadsArchiveCount": dl_archives["count"],
        "downloadsArchiveThresholdMet": dl_archives["thresholdMet"],
        "downloadsArchiveSamples": dl_archives["samples"],
        "downloadsArchiveLatestFile": dl_archives["latestFileName"],
        "weeklyReport": {
            "sleepCount": metrics.get("sleepCountThisWeek", 0),
            "wakeCount": metrics.get("wakeCountThisWeek", 0),
            "savedRamMb": metrics.get("savedRamMbCumulative", 0),
            "summaryText": (
                f"👻 이번 주 안 쓰는 은행 보안프로그램을 {metrics.get('sleepCountThisWeek', 0)}회 잠재워 "
                f"메모리 누적 {metrics.get('savedRamMbCumulative', 0)}MB를 아꼈어요!"
            ),
        },
        "privacyBadge": PLUGIN_METADATA["privacyBadge"],
    }


def _split_windows_cmdline(cmd_str: str, fallback_exe: str = "") -> List[str]:
    """Win32 CommandLineToArgvW로 인자 유실 없이 프로세스 명령줄을 파싱합니다."""
    raw = (cmd_str or "").strip()
    if not raw:
        return [fallback_exe] if fallback_exe else []
    if sys.platform == "win32":
        try:
            argc = ctypes.c_int(0)
            ctypes.windll.shell32.CommandLineToArgvW.restype = ctypes.POINTER(ctypes.c_wchar_p)
            argv_ptr = ctypes.windll.shell32.CommandLineToArgvW(ctypes.c_wchar_p(raw), ctypes.byref(argc))
            if argv_ptr and argc.value > 0:
                try:
                    parts = [str(argv_ptr[i]) for i in range(argc.value) if argv_ptr[i]]
                    if parts:
                        if fallback_exe and not os.path.isabs(parts[0]) and os.path.exists(fallback_exe):
                            parts[0] = fallback_exe
                        return parts
                finally:
                    ctypes.windll.kernel32.LocalFree(argv_ptr)
        except Exception:
            pass
    try:
        parts = [p.strip('"') for p in shlex.split(raw, posix=False) if p]
        if parts:
            return parts
    except Exception:
        pass
    return [fallback_exe] if fallback_exe else [raw]


def _get_win32_session_id(pid: int) -> int:
    if sys.platform != "win32" or pid <= 4:
        return 0
    try:
        sid = wintypes.DWORD(0)
        fn = ctypes.windll.kernel32.ProcessIdToSessionId
        fn.argtypes = [wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
        fn.restype = wintypes.BOOL
        if fn(wintypes.DWORD(pid), ctypes.byref(sid)):
            return int(sid.value)
    except Exception:
        pass
    return 0


def _is_pid_running(pid: int) -> bool:
    if sys.platform != "win32" or pid <= 4:
        return False
    try:
        import psutil  # type: ignore

        return bool(psutil.pid_exists(pid))
    except Exception:
        try:
            h = ctypes.windll.kernel32.OpenProcess(0x1000, False, int(pid))
            if not h:
                return False
            try:
                code = wintypes.DWORD(0)
                if ctypes.windll.kernel32.GetExitCodeProcess(h, ctypes.byref(code)):
                    return int(code.value) == 259
            finally:
                ctypes.windll.kernel32.CloseHandle(h)
        except Exception:
            pass
    return False


def _iter_windows_processes_stdlib() -> List[Dict[str, Any]]:
    """
    psutil이 설치되어 있으면 고속 조회하고, 미설치 환경에서도 PowerShell Win32_Process CIM을 통해
    실행 인자(CommandLine) 및 세션 ID(SessionId) 유실 없이 프로세스 목록을 반환합니다.
    """
    procs: List[Dict[str, Any]] = []
    if sys.platform != "win32":
        return procs
    try:
        import psutil  # type: ignore

        for proc in psutil.process_iter(["pid", "name", "exe", "cmdline", "memory_info"]):
            try:
                pid = int(proc.info.get("pid") or 0)
                pname = str(proc.info.get("name") or "")
                pexe = str(proc.info.get("exe") or "")
                cmdline = list(proc.info.get("cmdline") or ([pexe] if pexe else []))
                mem_info = proc.info.get("memory_info")
                rss_mb = round((getattr(mem_info, "rss", 0) or 0) / (1024 * 1024), 1)
                procs.append({
                    "pid": pid,
                    "sessionId": _get_win32_session_id(pid),
                    "name": pname,
                    "exe": pexe,
                    "cmdline": cmdline,
                    "memoryMb": max(1.0, rss_mb),
                })
            except Exception:
                continue
        return procs
    except Exception:
        pass

    try:
        ps_cmd = (
            "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | "
            "Select-Object ProcessId,SessionId,Name,ExecutablePath,CommandLine,WorkingSetSize | "
            "ConvertTo-Json -Compress"
        )
        r = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_cmd],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=4.5,
            creationflags=CREATE_NO_WINDOW,
        )
        raw_out = (r.stdout or "").strip()
        if raw_out:
            parsed = json.loads(raw_out)
            items = parsed if isinstance(parsed, list) else [parsed]
            for it in items:
                if not isinstance(it, dict):
                    continue
                pid = int(it.get("ProcessId") or 0)
                sess_id = int(it.get("SessionId") if it.get("SessionId") is not None else _get_win32_session_id(pid))
                pname = str(it.get("Name") or "")
                pexe = str(it.get("ExecutablePath") or "")
                cmd_str = str(it.get("CommandLine") or "").strip()
                ws_bytes = int(it.get("WorkingSetSize") or 0)
                procs.append({
                    "pid": pid,
                    "sessionId": sess_id,
                    "name": pname,
                    "exe": pexe,
                    "cmdline": _split_windows_cmdline(cmd_str, fallback_exe=pexe),
                    "cmdlineRaw": cmd_str,
                    "memoryMb": max(1.0, round(ws_bytes / (1024 * 1024), 1)),
                })
    except Exception:
        pass
    return procs


_PROTECTED_USER_SECURITY_SCAN_EXES = {
    "chrome.exe", "msedge.exe", "whale.exe", "firefox.exe", "brave.exe",
    "explorer.exe", "python.exe", "pythonw.exe", "node.exe", "antigravity.exe",
    "code.exe", "cursor.exe", "kakaotalk.exe", "telegram.exe", "myboxlauncher_x64_mt.exe",
    "myboxexplorer_x64_mt.exe", "googledrivefs.exe", "sensetalk_engine.exe",
    "senstalk_engine.exe", "merlin_z_core.exe", "merlin_z_core_setup.exe",
    "svchost.exe", "lsass.exe", "csrss.exe", "wininit.exe", "services.exe",
    "dwm.exe", "sihost.exe", "taskhostw.exe", "ctfmon.exe", "searchindexer.exe",
    "securityhealthservice.exe", "msmpeng.exe", "conhost.exe", "cmd.exe", "powershell.exe",
}

_SAFE_FAMILY_TOKENS = (
    "merlin", "ghosti", "senstalk", "sensebot", "sundream", "nplace", "aggro", "secretary", "tailscale",
)


def _scan_running_user_security_processes() -> List[Dict[str, Any]]:
    """
    [단일 SSOT: security_services_whitelist.json 기반 유저 세션(SessionId > 0) 보안 트레이 브릿지 실측]
    - Session 0 시스템 서비스 프로세스는 sc query/stop으로 전담 처리하고,
      유저 세션(SessionId > 0)에서 실행 중인 순수 은행·관공서 보안 트레이 모듈만 정확히 수집합니다
      (애드웨어·한컴업데이터 등 비보안 프로세스 혼입 원천 차단).
    """
    if sys.platform != "win32":
        return []
    wl_data = load_security_whitelist(allow_remote_sync=False)
    never_touch_tokens = tuple(
        str(s).strip().lower()
        for s in list(wl_data.get("corporate_drm_never_touch", []))
        + list(wl_data.get("kernel_self_defense_services", []))
        if str(s).strip()
    )
    whitelist_items = wl_data.get("web_security_services_whitelist", [])
    tray_label_map: Dict[str, tuple[str, str]] = {}
    pattern_label_list: List[tuple[str, str]] = []
    for item in whitelist_items:
        disp = str(item.get("display_name") or "미사용 웹 보안 서비스")
        gid = str(item.get("id") or "")
        for exe_name in item.get("tray_executables", []):
            en = str(exe_name).strip().lower()
            if en:
                tray_label_map[en] = (gid or en, disp)
        for pat in item.get("service_patterns", []):
            pt = str(pat).strip().lower()
            if len(pt) >= 4:
                pattern_label_list.append((pt, disp))

    found: List[Dict[str, Any]] = []
    for pinfo in _iter_windows_processes_stdlib():
        try:
            pname = str(pinfo.get("name") or "").strip()
            pname_low = pname.lower()
            pid = int(pinfo.get("pid") or 0)
            sess_id = int(pinfo.get("sessionId") if pinfo.get("sessionId") is not None else 1)
            if not pname_low or pid <= 4 or sess_id <= 0 or pname_low in _PROTECTED_USER_SECURITY_SCAN_EXES:
                continue
            pexe = str(pinfo.get("exe") or "").strip()
            comb_low = f"{pname_low} {pexe.lower()}"
            if any(tok in comb_low for tok in _SAFE_FAMILY_TOKENS) or any(tok in comb_low for tok in never_touch_tokens):
                continue

            stem_low = pname_low[:-4] if pname_low.endswith(".exe") else pname_low
            matched_kw = ""
            matched_label = ""
            if pname_low in tray_label_map:
                matched_kw, matched_label = tray_label_map[pname_low]
            else:
                for pt, disp in pattern_label_list:
                    if pt in stem_low:
                        matched_kw = pt
                        matched_label = disp
                        break
            if not matched_kw:
                continue

            cmdline = list(pinfo.get("cmdline") or ([pexe] if pexe else []))
            if cmdline and pexe and not os.path.isabs(str(cmdline[0])) and os.path.exists(pexe):
                cmdline[0] = pexe
            found.append({
                "pid": pid,
                "name": pname_low,
                "exe": pexe or (str(cmdline[0]) if cmdline else ""),
                "cmdline": cmdline,
                "keyword": matched_kw,
                "label": matched_label or pname,
                "memoryMb": float(pinfo.get("memoryMb") or 18.0),
            })
        except Exception:
            continue
    return found


def _discover_security_autostart_bridges() -> List[Dict[str, Any]]:
    """HKCU/HKLM Run 레지스트리에 등록된 은행·관공서 보안 모듈(security_services_whitelist 기준) 시작 명령줄 조회."""
    if sys.platform != "win32" or winreg is None:
        return []
    wl_data = load_security_whitelist(allow_remote_sync=False)
    never_touch_tokens = tuple(
        str(s).strip().lower()
        for s in list(wl_data.get("corporate_drm_never_touch", []))
        + list(wl_data.get("kernel_self_defense_services", []))
        if str(s).strip()
    )
    whitelist_items = wl_data.get("web_security_services_whitelist", [])
    pat_list: List[tuple[str, str]] = []
    for item in whitelist_items:
        disp = str(item.get("display_name") or "미사용 웹 보안 서비스")
        for pat in list(item.get("service_patterns", [])) + list(item.get("tray_executables", [])):
            pt = str(pat).strip().lower()
            if pt.endswith(".exe"):
                pt = pt[:-4]
            if len(pt) >= 4:
                pat_list.append((pt, disp))

    out: List[Dict[str, Any]] = []
    seen_exes: set[str] = set()
    run_keys = [
        (winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run"),
        (winreg.HKEY_LOCAL_MACHINE, r"Software\Microsoft\Windows\CurrentVersion\Run"),
        (winreg.HKEY_LOCAL_MACHINE, r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run"),
    ]
    for root_hkey, subkey in run_keys:
        try:
            with winreg.OpenKey(root_hkey, subkey, 0, winreg.KEY_READ) as rk:
                idx = 0
                while True:
                    try:
                        vname, vval, _ = winreg.EnumValue(rk, idx)
                        idx += 1
                    except OSError:
                        break
                    s_name = str(vname or "").strip()
                    s_cmd = str(vval or "").strip()
                    comb_low = f"{s_name} {s_cmd}".lower()
                    if (
                        not s_name
                        or not s_cmd
                        or any(tok in comb_low for tok in _SAFE_FAMILY_TOKENS)
                        or any(drm in comb_low for drm in never_touch_tokens)
                    ):
                        continue
                    matched_kw = ""
                    matched_lbl = ""
                    for pt, disp in pat_list:
                        if pt in comb_low:
                            matched_kw = pt
                            matched_lbl = disp
                            break
                    if not matched_kw:
                        continue
                    parts = _split_windows_cmdline(s_cmd)
                    if not parts or not os.path.isfile(str(parts[0])):
                        continue
                    exe_norm = os.path.abspath(str(parts[0])).lower()
                    if exe_norm in seen_exes:
                        continue
                    seen_exes.add(exe_norm)
                    out.append({
                        "name": os.path.basename(exe_norm),
                        "exe": str(parts[0]),
                        "cmdline": parts,
                        "keyword": matched_kw,
                        "label": matched_lbl or s_name,
                        "startupName": s_name,
                    })
        except OSError:
            continue
    return out


def get_sleeping_security_state() -> Dict[str, Any]:
    """단일 SSOT: 현재 절전 수면 중인 보안 모듈 라벨·키워드 및 기상 여부를 반환합니다."""
    snap = _load_sleep_snapshot()
    labels: List[str] = []
    keywords: set[str] = set()
    startup_names: set[str] = set()
    for s in (snap.get("services") or []):
        if isinstance(s, dict):
            sn = str(s.get("serviceName") or "").strip().lower()
            dl = str(s.get("displayName") or s.get("serviceName") or "").strip()
            if sn:
                keywords.add(sn)
            if dl and dl not in labels:
                labels.append(dl)
    for b in (snap.get("userBridgeProcesses") or []):
        if isinstance(b, dict):
            kw = str(b.get("keyword") or "").strip().lower()
            bn = str(b.get("name") or "").strip().lower()
            sn = str(b.get("startupName") or "").strip().lower()
            bl = str(b.get("label") or b.get("startupName") or b.get("name") or "").strip()
            if kw:
                keywords.add(kw)
            if bn:
                keywords.add(bn[:-4] if bn.endswith(".exe") else bn)
            if sn:
                startup_names.add(sn)
                keywords.add(sn)
            if bl and bl not in labels:
                labels.append(bl)
    return {
        "currentlyAwake": bool(_CURRENTLY_AWAKE),
        "sleepingLabels": labels if not _CURRENTLY_AWAKE else [],
        "allManagedLabels": labels,
        "sleepingKeywords": keywords if not _CURRENTLY_AWAKE else set(),
        "sleepingStartupNames": startup_names if not _CURRENTLY_AWAKE else set(),
    }


def capture_and_sleep_user_security_processes(
    kill_running: bool = True,
    precomputed_procs: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    [단일 SSOT 절전 캡처기 — 단일 배치 taskkill로 0.08초 고속 종료]
    - clean_bloatware 및 sleep_security_services 양쪽 모두에서 호출됩니다.
    - 실행 중인 유저 보안 프로세스를 종료하기 전에 정확한 cmdline/exe/label을 SLEEP_SNAPSHOT_FILE에 영구 병합하고,
      HKCU/HKLM Run에 등록된 보안 모듈(예: MagicLine4NX) 명령줄도 함께 보존하여 [보안프로그램 즉시 깨우기] 시 100% 기상시킵니다.
    """
    global _CURRENTLY_AWAKE
    _ensure_care_dir()
    existing_snap = _load_sleep_snapshot()
    existing_svc_map: Dict[str, Dict[str, Any]] = {}
    for s in (existing_snap.get("services") or []):
        if isinstance(s, dict) and s.get("serviceName"):
            existing_svc_map[str(s["serviceName"]).lower()] = dict(s)

    existing_bridge_map: Dict[str, Dict[str, Any]] = {}
    for b in (existing_snap.get("userBridgeProcesses") or []):
        if isinstance(b, dict):
            b_cmd = b.get("cmdline") or []
            b_key = str(b_cmd[0] if b_cmd else b.get("name") or "").lower()
            if b_key:
                existing_bridge_map[b_key] = dict(b)

    newly_killed: List[Dict[str, Any]] = []
    reclaimed_ram_mb = 0
    running_procs = precomputed_procs if precomputed_procs is not None else _scan_running_user_security_processes()
    pids_to_kill = [int(p.get("pid") or 0) for p in running_procs if int(p.get("pid") or 0) > 4]
    if kill_running and pids_to_kill:
        try:
            kill_cmd = ["taskkill", "/F"]
            for pid_val in pids_to_kill:
                kill_cmd.extend(["/PID", str(pid_val)])
            subprocess.run(
                kill_cmd,
                capture_output=True,
                timeout=3.0,
                creationflags=CREATE_NO_WINDOW,
            )
            time.sleep(0.1)
        except Exception:
            pass

    for pinfo in running_procs:
        pid_val = int(pinfo.get("pid") or 0)
        if kill_running and pid_val > 4 and _is_pid_running(pid_val):
            continue
        cmdline = list(pinfo.get("cmdline") or [])
        reclaimed_ram_mb += max(10, int(round(float(pinfo.get("memoryMb") or 18.0))))
        entry = {
            "name": str(pinfo.get("name") or ""),
            "exe": str(pinfo.get("exe") or (cmdline[0] if cmdline else "")),
            "cmdline": cmdline,
            "keyword": str(pinfo.get("keyword") or ""),
            "label": str(pinfo.get("label") or pinfo.get("name") or ""),
        }
        newly_killed.append(entry)
        b_key = str(cmdline[0] if cmdline else entry["name"]).lower()
        if b_key:
            existing_bridge_map[b_key] = entry

    for auto_b in _discover_security_autostart_bridges():
        auto_cmd = auto_b.get("cmdline") or []
        auto_key = str(auto_cmd[0] if auto_cmd else auto_b.get("name") or "").lower()
        if auto_key and auto_key not in existing_bridge_map:
            existing_bridge_map[auto_key] = auto_b
        elif auto_key and auto_b.get("startupName") and not existing_bridge_map[auto_key].get("startupName"):
            existing_bridge_map[auto_key]["startupName"] = auto_b["startupName"]

    _CURRENTLY_AWAKE = False
    if existing_svc_map or existing_bridge_map:
        _save_sleep_snapshot({
            "savedAt": datetime.datetime.now().isoformat(),
            "services": list(existing_svc_map.values()),
            "userBridgeProcesses": list(existing_bridge_map.values()),
        })

    stopped_labels: List[str] = []
    for nk in newly_killed:
        lbl = str(nk.get("label") or nk.get("name") or "").strip()
        if lbl and lbl not in stopped_labels:
            stopped_labels.append(lbl)

    return {
        "newlyKilled": newly_killed,
        "stoppedLabels": stopped_labels,
        "reclaimedRamMb": reclaimed_ram_mb,
        "totalBridgesManaged": len(existing_bridge_map),
    }


def _refresh_os_inspect_cache_safe() -> None:
    try:
        import plugin_ghosti_os as _pgo
        _pgo._trigger_async_os_inspect_refresh()
    except Exception:
        pass


def sleep_security_services(
    explicit_opt_in: bool = True,
    allow_uac_prompt: bool = True,
) -> Dict[str, Any]:
    """
    [모듈 A — 스냅샷 누적 보존 & 서비스 + 유저 보안모듈 통합 절전]
    - 이미 잠든 상태에서 재호출되더라도 기존 스냅샷(SLEEP_SNAPSHOT_FILE)을 절대 빈 배열로 덮어쓰지 않고 병합 보존합니다!
    - 윈도우 보안 서비스뿐 아니라 유저 세션 보안 프로세스(nosstarter, MagicLine4NX, HncUpdate 등)도 함께 절전 기록합니다.
    """
    global _CURRENTLY_AWAKE
    _ensure_care_dir()
    status = get_security_services_status()
    targets: List[Dict[str, Any]] = list(status.get("runningServices", []) or [])

    existing_snap = _load_sleep_snapshot()
    existing_svc_map: Dict[str, Dict[str, Any]] = {}
    for s in (existing_snap.get("services") or []):
        if isinstance(s, dict) and s.get("serviceName"):
            existing_svc_map[str(s["serviceName"]).lower()] = dict(s)

    for t in targets:
        sname = str(t.get("serviceName") or "")
        if not sname:
            continue
        prev_entry = existing_svc_map.get(sname.lower())
        if prev_entry and prev_entry.get("originalStartType"):
            t["originalStartType"] = prev_entry["originalStartType"]
        else:
            t["originalStartType"] = _query_service_start_type(sname)

    target_service_names = [str(t.get("serviceName") or "") for t in targets if t.get("serviceName")]
    stopped_services: List[str] = []
    elevation_method = "USER_SESSION_DIRECT"

    # 실제 중지할 윈도우 서비스가 있을 때만 권한 헬퍼를 호출 (서비스가 0개일 때 불필요한 UAC 블로킹/타임아웃 원천 차단)
    if target_service_names:
        elevation_res = execute_elevated_service_control(
            "sleep",
            target_service_names,
            allow_uac_prompt=allow_uac_prompt,
            register_helper_even_if_empty=False,
        )
        elevation_method = str(elevation_res.get("elevationMethod") or "ELEVATED")
        if elevation_res.get("ok"):
            stopped_services = list(elevation_res.get("processedServices") or [])
        elif not status.get("runningUserBridges"):
            return {
                "ok": False,
                "uacDeclined": bool(elevation_res.get("uacDeclined")),
                "stoppedCount": 0,
                "stoppedServices": [],
                "reclaimedRamMb": 0,
                "elevationMethod": elevation_method,
                "error": "ELEVATION_REQUIRED_OR_DECLINED",
                "toastMessage": "⚠️ Windows 관리자 권한(최초 1회) 승인이 취소되어 보안 서비스 절전 설정을 완료하지 못했습니다.",
            }

    stopped_low = {s.lower() for s in stopped_services}
    for t in targets:
        sname = str(t.get("serviceName") or "")
        if sname and sname.lower() in stopped_low:
            existing_svc_map[sname.lower()] = t

    if existing_svc_map:
        cur_snap = _load_sleep_snapshot()
        cur_snap["savedAt"] = datetime.datetime.now().isoformat()
        cur_snap["services"] = list(existing_svc_map.values())
        _save_sleep_snapshot(cur_snap)

    bridge_sleep_res = capture_and_sleep_user_security_processes(
        kill_running=True,
        precomputed_procs=list(status.get("runningUserBridges") or []),
    )
    newly_killed_bridges = bridge_sleep_res.get("newlyKilled") or []
    if stopped_services or newly_killed_bridges:
        time.sleep(0.2)

    if explicit_opt_in:
        st_cfg = _load_care_settings()
        st_cfg["bankAutoSleepEnabled"] = True
        st_cfg["updatedAt"] = datetime.datetime.now().isoformat()
        _save_care_settings(st_cfg)

    _CURRENTLY_AWAKE = False
    _refresh_os_inspect_cache_safe()

    stopped_targets = [t for t in targets if str(t.get("serviceName") or "").lower() in stopped_low]
    stopped_labels: List[str] = []
    for st_item in stopped_targets:
        sl = str(st_item.get("displayName") or st_item.get("serviceName") or "").strip()
        if sl and sl not in stopped_labels:
            stopped_labels.append(sl)
    for bl in (bridge_sleep_res.get("stoppedLabels") or []):
        if bl and bl not in stopped_labels:
            stopped_labels.append(bl)

    total_stopped_now = len(stopped_labels) if stopped_labels else (len(stopped_services) + len(newly_killed_bridges))
    reclaimed_mb = (
        sum(int(t.get("estimatedRamMb", 45)) for t in stopped_targets)
        + int(bridge_sleep_res.get("reclaimedRamMb") or 0)
    )
    sleep_state = get_sleeping_security_state()
    sleeping_labels = sleep_state.get("sleepingLabels") or []

    metrics = _load_weekly_metrics()
    if total_stopped_now > 0:
        metrics["sleepCountThisWeek"] = int(metrics.get("sleepCountThisWeek", 0)) + 1
        metrics["savedRamMbCumulative"] = int(metrics.get("savedRamMbCumulative", 0)) + reclaimed_mb
        metrics["lastSleepAt"] = datetime.datetime.now().isoformat()
        _save_weekly_metrics(metrics)

    return {
        "ok": True,
        "stoppedCount": total_stopped_now,
        "stoppedServices": stopped_services,
        "stoppedModuleLabels": stopped_labels,
        "sleepingModuleLabels": sleeping_labels,
        "savedUserBridgesCount": len(newly_killed_bridges),
        "totalManagedSleepingCount": len(sleeping_labels),
        "reclaimedRamMb": reclaimed_mb,
        "autoSleepEnabled": _is_bank_auto_sleep_enabled(),
        "elevationMethod": elevation_method,
        "toastMessage": (
            f"👻 미사용 은행·관공서 보안 모듈 {total_stopped_now}종을 삭제하지 않고 쿨쿨 잠재웠어요! "
            f"(메모리 약 {reclaimed_mb}MB 회수 완료 · [🏦 보안프로그램 즉시 깨우기]로 1초 만에 다시 깨어납니다)"
            if total_stopped_now > 0
            else (
                f"👻 이미 은행·관공서 보안 모듈 {len(sleeping_labels)}종이 절전 수면 중입니다! (추가 실행 중인 모듈 0종)"
                if sleeping_labels
                else "👻 현재 추가로 잠재울 미사용 웹 보안 프로그램이 없습니다 (이미 쾌적한 상태예요!)."
            )
        ),
    }


def wake_security_services(reason: str = "manual_button", allow_uac_prompt: bool = True) -> Dict[str, Any]:
    """2-Layer 누적 스냅샷 기반 최고권한 헬퍼(UAC 0회) sc start + 미실행 유저 보안모듈 중복 없이 동반 기상"""
    global _LAST_WAKE_TIMESTAMP, _CURRENTLY_AWAKE
    _ensure_care_dir()

    snap = _load_sleep_snapshot()
    services_to_wake = [
        str(s.get("serviceName") or "")
        for s in (snap.get("services") or [])
        if isinstance(s, dict) and s.get("serviceName")
    ]
    bridges_to_wake = [b for b in (snap.get("userBridgeProcesses") or []) if isinstance(b, dict)]

    # 스냅샷이 비어 있더라도(예: 이전 버전에서 종료된 직후 첫 기상 호출) 자동실행 레지스트리 보안 모듈을 자동 보강
    if not bridges_to_wake:
        discovered = _discover_security_autostart_bridges()
        if discovered:
            bridges_to_wake = discovered
            snap["savedAt"] = datetime.datetime.now().isoformat()
            snap["userBridgeProcesses"] = discovered
            _save_sleep_snapshot(snap)

    if not services_to_wake and not bridges_to_wake:
        return {
            "ok": True,
            "reason": reason,
            "wokenServicesCount": 0,
            "wokenServices": [],
            "wokenBridgesCount": 0,
            "wokenModuleLabels": [],
            "wokenCount": 0,
            "elevationMethod": "NONE_SLEEPING",
            "gracePeriodMinutes": 15,
            "toastMessage": "👻 현재 잠자고 있는 은행·결제 보안 프로그램이 없습니다 (모두 정상 대기 중).",
        }

    is_auto_trigger = reason.startswith("window_title_match:")
    woken_services: List[str] = []
    elevation_method = "USER_SESSION_DIRECT"
    if services_to_wake:
        elevation_res = execute_elevated_service_control(
            "wake",
            services_to_wake,
            allow_uac_prompt=(False if is_auto_trigger else allow_uac_prompt),
        )
        elevation_method = str(elevation_res.get("elevationMethod") or "ELEVATED")
        if not elevation_res.get("ok") and not bridges_to_wake:
            return {
                "ok": False,
                "reason": reason,
                "wokenServicesCount": 0,
                "wokenServices": [],
                "wokenBridgesCount": 0,
                "wokenModuleLabels": [],
                "wokenCount": 0,
                "elevationMethod": elevation_method,
                "error": "WAKE_ELEVATION_FAILED",
                "toastMessage": "⚠️ 권한 승인이 완료되지 않아 잠자던 보안 서비스를 깨우지 못했습니다.",
            }
        woken_services = list(elevation_res.get("processedServices") or [])

    running_proc_names = {(p.get("name") or "").lower() for p in _iter_windows_processes_stdlib()}
    woken_bridges: List[str] = []
    woken_labels: List[str] = []
    svc_label_lookup = {
        str(s.get("serviceName") or "").lower(): str(s.get("displayName") or s.get("serviceName") or "")
        for s in (snap.get("services") or [])
        if isinstance(s, dict)
    }
    for ws in woken_services:
        lbl = svc_label_lookup.get(ws.lower(), ws)
        if lbl and lbl not in woken_labels:
            woken_labels.append(lbl)

    if sys.platform == "win32" and bridges_to_wake:
        for b in bridges_to_wake:
            bname = str(b.get("name") or "").lower()
            blabel = str(b.get("label") or b.get("startupName") or b.get("name") or "").strip()
            if bname and bname in running_proc_names:
                continue
            cmdline = b.get("cmdline")
            if isinstance(cmdline, list) and cmdline and os.path.exists(str(cmdline[0])):
                try:
                    subprocess.Popen(
                        cmdline,
                        cwd=os.path.dirname(str(cmdline[0])) or None,
                        creationflags=CREATE_NO_WINDOW,
                        close_fds=True,
                    )
                    woken_bridges.append(b.get("name", str(cmdline[0])))
                    if blabel and blabel not in woken_labels:
                        woken_labels.append(blabel)
                    if bname:
                        running_proc_names.add(bname)
                except Exception:
                    continue

    _LAST_WAKE_TIMESTAMP = time.time()
    _CURRENTLY_AWAKE = True
    if woken_bridges or woken_services:
        time.sleep(0.35)
    _refresh_os_inspect_cache_safe()

    total_woken = len(woken_labels) if woken_labels else (len(woken_services) + len(woken_bridges))
    if total_woken > 0:
        metrics = _load_weekly_metrics()
        metrics["wakeCountThisWeek"] = int(metrics.get("wakeCountThisWeek", 0)) + 1
        metrics["lastWakeAt"] = datetime.datetime.now().isoformat()
        _save_weekly_metrics(metrics)

        if is_auto_trigger:
            _notify_tray_balloon(
                "👻 귀신같이 은행·결제 보안 자동 기상",
                f"보안 프로그램 {total_woken}종을 1초 만에 깨웠어요! 화면에 설치 안내가 떠 있다면 F5(새로고침)를 한 번 눌러주세요.",
            )

    return {
        "ok": True,
        "reason": reason,
        "wokenServicesCount": len(woken_services),
        "wokenServices": woken_services,
        "wokenBridgesCount": len(woken_bridges),
        "wokenModuleLabels": woken_labels,
        "wokenCount": total_woken,
        "refreshHintKo": "화면에 보안프로그램 설치 안내가 이미 떠 있다면 브라우저에서 F5(새로고침)를 한 번 눌러주세요!",
        "elevationMethod": elevation_method,
        "gracePeriodMinutes": 15,
        "toastMessage": (
            f"👻 은행·관공서 업무를 위해 잠자던 보안 프로그램 {total_woken}종을 1초 만에 깨웠어요! "
            "(설치 안내가 보이면 F5 새로고침 · 창을 닫고 15분 뒤 다시 잠듭니다)"
        ),
    }


def restore_security_services_default(allow_uac_prompt: bool = True) -> Dict[str, Any]:
    """
    [1초 완전 원상복구]
    - 절전해 두었던 모든 보안 서비스의 시작 유형(auto/delayed-auto/demand)을 원래대로 되돌리고 즉시 시작합니다.
    - 자동 절전 설정(bankAutoSleepEnabled)을 끄고 스냅샷을 정리합니다.
    """
    global _CURRENTLY_AWAKE, _LAST_FINANCE_WINDOW_SEEN
    _ensure_care_dir()
    snap = _load_sleep_snapshot()
    svc_entries = [s for s in (snap.get("services") or []) if isinstance(s, dict) and s.get("serviceName")]
    bridges = [b for b in (snap.get("userBridgeProcesses") or []) if isinstance(b, dict)]

    svc_names = [str(s["serviceName"]) for s in svc_entries]
    st_map = {str(s["serviceName"]): str(s.get("originalStartType") or "auto") for s in svc_entries}

    restored_svcs: List[str] = []
    if svc_names:
        elev = execute_elevated_service_control(
            "restore",
            svc_names,
            start_types_map=st_map,
            allow_uac_prompt=allow_uac_prompt,
        )
        if not elev.get("ok"):
            return {
                "ok": False,
                "error": "RESTORE_ELEVATION_FAILED",
                "toastMessage": "⚠️ 관리자 권한 승인이 취소되어 시작 유형 원상복구를 완료하지 못했습니다.",
            }
        restored_svcs = list(elev.get("processedServices") or [])

    running_proc_names = {(p.get("name") or "").lower() for p in _iter_windows_processes_stdlib()}
    restored_bridges: List[str] = []
    if sys.platform == "win32" and bridges:
        for b in bridges:
            bname = str(b.get("name") or "").lower()
            if bname and bname in running_proc_names:
                continue
            cmdline = b.get("cmdline")
            if isinstance(cmdline, list) and cmdline and os.path.exists(str(cmdline[0])):
                try:
                    subprocess.Popen(cmdline, creationflags=CREATE_NO_WINDOW, close_fds=True)
                    restored_bridges.append(b.get("name", str(cmdline[0])))
                    if bname:
                        running_proc_names.add(bname)
                except Exception:
                    continue

    try:
        if SLEEP_SNAPSHOT_FILE.exists():
            SLEEP_SNAPSHOT_FILE.unlink()
    except Exception:
        pass

    cfg = _load_care_settings()
    cfg["bankAutoSleepEnabled"] = False
    cfg["restoredAt"] = datetime.datetime.now().isoformat()
    _save_care_settings(cfg)
    _CURRENTLY_AWAKE = False
    _LAST_FINANCE_WINDOW_SEEN = 0.0

    total_restored = len(restored_svcs) + len(restored_bridges)
    return {
        "ok": True,
        "restoredServicesCount": len(restored_svcs),
        "restoredServices": restored_svcs,
        "restoredBridgesCount": len(restored_bridges),
        "totalRestoredCount": total_restored,
        "autoSleepEnabled": False,
        "toastMessage": (
            f"↩️ 보안 프로그램 {total_restored}개를 원래 시작 설정으로 1초 만에 완벽 복구했습니다! (자동 재우기 해제됨)"
            if total_restored > 0
            else "↩️ 보안 프로그램 자동 재우기 설정을 해제하고 기본 상태로 되돌렸습니다."
        ),
    }


def _any_open_window_matches_keywords(keywords: List[str]) -> bool:
    """포그라운드 창뿐 아니라 백그라운드에 열려 있는 모든 가시 창 제목(EnumWindows)에 은행/결제 창이 남아있는지 확인합니다."""
    if sys.platform != "win32" or not keywords:
        return False
    u32 = ctypes.windll.user32
    found = [False]
    WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def _cb(hwnd: int, _lp: int) -> bool:
        hw = wintypes.HWND(hwnd)
        if not u32.IsWindowVisible(hw):
            return True
        tlen = u32.GetWindowTextLengthW(hw)
        if tlen <= 0 or tlen > 512:
            return True
        buf = ctypes.create_unicode_buffer(tlen + 2)
        u32.GetWindowTextW(hw, buf, tlen + 1)
        t_low = (buf.value or "").lower()
        if any(kw in t_low for kw in keywords):
            found[0] = True
            return False
        return True

    try:
        u32.EnumWindows(WNDENUMPROC(_cb), 0)
    except Exception:
        return False
    return found[0]


def check_window_title_for_prewake(window_title: str) -> Optional[Dict[str, Any]]:
    """
    [은행·관공서 선행 기상 & 15분 안전 재수면]
    - 오직 유저가 자동 절전에 동의했고(bankAutoSleepEnabled) 최고권한 헬퍼가 준비된 경우에만 동작합니다 (백그라운드 UAC 팝업 0회!).
    - 이미 깨어 있는 동안(_CURRENTLY_AWAKE)에는 60초마다 중복 기상하지 않습니다.
    - 15분 유예 만료 시 모든 열린 창 제목을 전수 확인하여 은행 창이 열려 있으면 절전을 미룹니다.
    """
    global _LAST_FINANCE_WINDOW_SEEN, _CURRENTLY_AWAKE
    if not window_title:
        return None
    if not _is_bank_auto_sleep_enabled():
        return None
    if not (is_security_care_helper_task_registered() or is_running_as_admin()):
        return None

    title_low = window_title.lower()
    wl = load_security_whitelist(allow_remote_sync=False)
    keywords = [k.lower() for k in wl.get("wake_window_title_keywords", []) if k]
    grace_sec = int(wl.get("sleep_grace_period_seconds", 900))

    now = time.time()
    if any(kw in title_low for kw in keywords):
        _LAST_FINANCE_WINDOW_SEEN = now
        if not _CURRENTLY_AWAKE and SLEEP_SNAPSHOT_FILE.exists():
            return wake_security_services(
                reason=f"window_title_match:{window_title[:24]}",
                allow_uac_prompt=False,
            )
    else:
        if (
            _LAST_FINANCE_WINDOW_SEEN > 0
            and (now - _LAST_FINANCE_WINDOW_SEEN) >= grace_sec
            and (now - _LAST_WAKE_TIMESTAMP) >= grace_sec
        ):
            if _any_open_window_matches_keywords(keywords):
                _LAST_FINANCE_WINDOW_SEEN = now
                return None
            _LAST_FINANCE_WINDOW_SEEN = 0.0
            _CURRENTLY_AWAKE = False
            return sleep_security_services(explicit_opt_in=False, allow_uac_prompt=False)
    return None


# ============================================================================
# 3. [모듈 B] 스마트 압축 (알집 100% 동급 암호 해제 · 한글 복원 · 안전 경로 · 다중 ZIP 병합)
# ============================================================================
def _get_pythonw_or_exe_command(mode_flag: str) -> str:
    full_cmd, _, _ = _build_care_cli_command(mode_flag, with_arg_placeholder=True)
    return full_cmd


def _get_ghosti_icon_path() -> str:
    """Win32 탐색기 메뉴용 영구 .ico 경로만 반환합니다 (.png 및 임시 _MEIPASS 경로 원천 배제)."""
    persistent_ico = GHOSTI_BIN_DIR / "favicon.ico"
    for cand in (
        _BUNDLE_DIR / "favicon.ico",
        THIS_DIR / "favicon.ico",
        THIS_DIR.parent.parent / "public" / "favicon.ico",
    ):
        if cand.exists() and cand.suffix.lower() == ".ico":
            try:
                GHOSTI_BIN_DIR.mkdir(parents=True, exist_ok=True)
                if not persistent_ico.exists() or persistent_ico.stat().st_size != cand.stat().st_size:
                    shutil.copy2(cand, persistent_ico)
                return str(persistent_ico)
            except Exception:
                if not getattr(sys, "frozen", False):
                    return str(cand.resolve())
    if persistent_ico.exists():
        return str(persistent_ico)
    if getattr(sys, "frozen", False):
        return f"{_get_persistent_or_current_exe()},0"
    return ""


def _has_third_party_archive_handler(winreg_mod: Any, ext: str, prog_id: str) -> bool:
    """반디집·7-Zip·알집·WinRAR 등 타사 프로그램이 이미 HKCU UserChoice 또는 HKLM 기본값에 연결되어 있는지 확인합니다."""
    builtin_or_ours = {"", "compressedfolder", prog_id.lower()}
    # 1) HKCU UserChoice 확인
    try:
        uc_path = f"Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\{ext}\\UserChoice"
        with winreg_mod.OpenKey(winreg_mod.HKEY_CURRENT_USER, uc_path, 0, winreg_mod.KEY_READ) as uck:
            uc_prog, _ = winreg_mod.QueryValueEx(uck, "Progid")
            if uc_prog and str(uc_prog).strip().lower() not in builtin_or_ours:
                return True
    except Exception:
        pass
    # 2) HKLM\Software\Classes\<ext> 기본값 확인
    try:
        with winreg_mod.OpenKey(winreg_mod.HKEY_LOCAL_MACHINE, f"Software\\Classes\\{ext}", 0, winreg_mod.KEY_READ) as lmk:
            lm_prog, _ = winreg_mod.QueryValueEx(lmk, "")
            if lm_prog and str(lm_prog).strip().lower() not in builtin_or_ours:
                return True
    except Exception:
        pass
    return False


def register_explorer_context_menu() -> Dict[str, Any]:
    """
    관리자 권한(UAC) 없이 HKCU\\Software\\Classes에
    1) 더블클릭 자동실행 ProgID(Ghosti.Archive) — 타사 압축앱(반디집·7-Zip·알집) 미설치 확장자에만 공손하게 기본 연결 & 이전값 백업
    2) 탐색기 일반 우클릭(`딸깍`) 컨텍스트 메뉴 정적 커맨드 등록 (다중 선택 MultiSelectModel=Player 지원)
    을 수행합니다.
    """
    if sys.platform != "win32":
        return {"ok": False, "reason": "NON_WINDOWS"}
    import winreg

    icon_path = _get_ghosti_icon_path()
    unzip_cmd = _get_pythonw_or_exe_command("--smart-unzip")
    zip_cmd = _get_pythonw_or_exe_command("--smart-zip")

    registered_keys: List[str] = []
    archive_exts = (".zip", ".7z", ".rar", ".tar", ".gz", ".tgz")
    prog_id = "Ghosti.Archive"

    try:
        prog_base = f"Software\\Classes\\{prog_id}"
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, prog_base) as pk:
            winreg.SetValueEx(pk, "", 0, winreg.REG_SZ, "귀신같이 스마트 압축파일")
            winreg.SetValueEx(pk, "FriendlyTypeName", 0, winreg.REG_SZ, "👻 귀신같이 스마트 압축해제")
        if icon_path:
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, f"{prog_base}\\DefaultIcon") as ik:
                winreg.SetValueEx(ik, "", 0, winreg.REG_SZ, icon_path)
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, f"{prog_base}\\shell\\open") as ok:
            winreg.SetValueEx(ok, "", 0, winreg.REG_SZ, "👻 귀신같이로 깔끔하게 풀기")
            if icon_path:
                winreg.SetValueEx(ok, "Icon", 0, winreg.REG_SZ, icon_path)
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, f"{prog_base}\\shell\\open\\command") as ock:
            winreg.SetValueEx(ock, "", 0, winreg.REG_SZ, unzip_cmd)
        registered_keys.append(prog_base)

        for ext in archive_exts:
            ext_cls_key = f"Software\\Classes\\{ext}"
            third_party_bound = _has_third_party_archive_handler(winreg, ext, prog_id)
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, ext_cls_key) as ek:
                try:
                    cur_default, _ = winreg.QueryValueEx(ek, "")
                except Exception:
                    cur_default = ""
                if not third_party_bound and (not cur_default or cur_default in ("CompressedFolder", prog_id)):
                    if cur_default != prog_id:
                        winreg.SetValueEx(ek, "GhostiPrevDefault", 0, winreg.REG_SZ, str(cur_default or ""))
                    winreg.SetValueEx(ek, "", 0, winreg.REG_SZ, prog_id)
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, f"{ext_cls_key}\\OpenWithProgids") as owk:
                winreg.SetValueEx(owk, prog_id, 0, winreg.REG_NONE, b"")

            for base_key_path in (
                f"Software\\Classes\\SystemFileAssociations\\{ext}\\shell\\GhostiSmartUnzip",
                f"Software\\Classes\\{ext}\\shell\\GhostiSmartUnzip",
            ):
                with winreg.CreateKey(winreg.HKEY_CURRENT_USER, base_key_path) as k:
                    winreg.SetValueEx(k, "", 0, winreg.REG_SZ, "👻 귀신같이로 깔끔하게 풀기 (한글깨짐·폭탄 방지)")
                    winreg.SetValueEx(k, "MUIVerb", 0, winreg.REG_SZ, "👻 귀신같이로 깔끔하게 풀기 (한글깨짐·폭탄 방지)")
                    if icon_path:
                        winreg.SetValueEx(k, "Icon", 0, winreg.REG_SZ, icon_path)
                with winreg.CreateKey(winreg.HKEY_CURRENT_USER, f"{base_key_path}\\command") as ck:
                    winreg.SetValueEx(ck, "", 0, winreg.REG_SZ, unzip_cmd)
                registered_keys.append(base_key_path)

        for target_cls in ("*", "Directory"):
            base_key_path = f"Software\\Classes\\{target_cls}\\shell\\GhostiSmartZip"
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, base_key_path) as k:
                winreg.SetValueEx(k, "", 0, winreg.REG_SZ, "👻 귀신같이로 ZIP 압축 묶기")
                winreg.SetValueEx(k, "MUIVerb", 0, winreg.REG_SZ, "👻 귀신같이로 ZIP 압축 묶기")
                winreg.SetValueEx(k, "MultiSelectModel", 0, winreg.REG_SZ, "Player")
                if icon_path:
                    winreg.SetValueEx(k, "Icon", 0, winreg.REG_SZ, icon_path)
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, f"{base_key_path}\\command") as ck:
                winreg.SetValueEx(ck, "", 0, winreg.REG_SZ, zip_cmd)
            registered_keys.append(base_key_path)

        try:
            ctypes.windll.shell32.SHChangeNotify(0x08000000, 0x0000, None, None)
        except Exception:
            pass

        return {
            "ok": True,
            "registeredCount": len(registered_keys),
            "doubleClickProgId": prog_id,
            "commandTemplate": unzip_cmd,
            "zeroBackgroundRam": True,
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


def unregister_explorer_context_menu() -> Dict[str, Any]:
    """HKCU\\Software\\Classes의 귀신같이 메뉴를 제거하고, 백업된 원래 확장자 기본 연결값(CompressedFolder 등)을 완벽 복원합니다."""
    if sys.platform != "win32":
        return {"ok": False, "reason": "NON_WINDOWS"}
    import winreg

    archive_exts = (".zip", ".7z", ".rar", ".tar", ".gz", ".tgz")
    prog_id = "Ghosti.Archive"
    removed = 0

    # 확장자 기본 연결값 복원 및 OpenWithProgids 정리
    for ext in archive_exts:
        ext_cls_key = f"Software\\Classes\\{ext}"
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, ext_cls_key, 0, winreg.KEY_READ | winreg.KEY_SET_VALUE) as ek:
                try:
                    cur_def, _ = winreg.QueryValueEx(ek, "")
                except Exception:
                    cur_def = ""
                try:
                    prev_def, _ = winreg.QueryValueEx(ek, "GhostiPrevDefault")
                except Exception:
                    prev_def = "CompressedFolder" if ext == ".zip" else ""
                if cur_def == prog_id:
                    if prev_def:
                        winreg.SetValueEx(ek, "", 0, winreg.REG_SZ, str(prev_def))
                    elif ext == ".zip":
                        winreg.SetValueEx(ek, "", 0, winreg.REG_SZ, "CompressedFolder")
                    else:
                        try:
                            winreg.DeleteValue(ek, "")
                        except Exception:
                            pass
                try:
                    winreg.DeleteValue(ek, "GhostiPrevDefault")
                except Exception:
                    pass
        except Exception:
            pass
        try:
            with winreg.OpenKey(
                winreg.HKEY_CURRENT_USER, f"{ext_cls_key}\\OpenWithProgids", 0, winreg.KEY_SET_VALUE
            ) as owk:
                winreg.DeleteValue(owk, prog_id)
        except Exception:
            pass

    targets = [
        *(f"Software\\Classes\\SystemFileAssociations\\{ext}\\shell\\GhostiSmartUnzip" for ext in archive_exts),
        *(f"Software\\Classes\\{ext}\\shell\\GhostiSmartUnzip" for ext in archive_exts),
        "Software\\Classes\\*\\shell\\GhostiSmartZip",
        "Software\\Classes\\Directory\\shell\\GhostiSmartZip",
        "Software\\Classes\\Ghosti.Archive\\shell\\open",
    ]
    for base_key_path in targets:
        for sub in (f"{base_key_path}\\command", base_key_path):
            try:
                winreg.DeleteKey(winreg.HKEY_CURRENT_USER, sub)
                removed += 1
            except Exception:
                pass
    for extra_sub in (
        "Software\\Classes\\Ghosti.Archive\\shell",
        "Software\\Classes\\Ghosti.Archive\\DefaultIcon",
        "Software\\Classes\\Ghosti.Archive",
    ):
        try:
            winreg.DeleteKey(winreg.HKEY_CURRENT_USER, extra_sub)
            removed += 1
        except Exception:
            pass

    try:
        ctypes.windll.shell32.SHChangeNotify(0x08000000, 0x0000, None, None)
    except Exception:
        pass
    return {"ok": True, "removedSubKeys": removed}


def get_explorer_selected_paths_non_destructive(target_hwnd: Optional[int] = None) -> List[str]:
    """COM Shell.Application으로 클립보드를 오염시키지 않고 현재 탐색기/바탕화면 선택 파일 경로를 추출합니다."""
    if sys.platform != "win32":
        return []
    paths: List[str] = []
    fg_hwnd = int(target_hwnd) if target_hwnd else int(ctypes.windll.user32.GetForegroundWindow() or 0)
    try:
        import win32com.client  # type: ignore

        shell = win32com.client.Dispatch("Shell.Application")
        for window in shell.Windows():
            try:
                if int(window.HWND) == fg_hwnd:
                    doc = window.Document
                    sel = doc.SelectedItems()
                    for idx in range(sel.Count):
                        item_path = sel.Item(idx).Path
                        if item_path and os.path.exists(item_path):
                            paths.append(str(item_path))
                    return paths
            except Exception:
                continue
    except Exception:
        pass

    try:
        ps_script = (
            f"$fg={fg_hwnd}; $sh=New-Object -ComObject Shell.Application; $out=@(); "
            "foreach($w in $sh.Windows()){ try { if([int64]$w.HWND -eq $fg){ "
            "foreach($it in $w.Document.SelectedItems()){ if($it.Path){ $out += [string]$it.Path } }; break "
            "} } catch {} }; "
            "if($out.Count -eq 0){ try { $dw=$sh.Windows().FindWindowSW(0,0,8,0,1); "
            "if($dw){ foreach($it in $dw.Document.SelectedItems()){ if($it.Path){ $out += [string]$it.Path } } } } catch {} }; "
            "$out | ConvertTo-Json -Compress"
        )
        r = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_script],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=2.0,
            creationflags=CREATE_NO_WINDOW,
        )
        raw = (r.stdout or "").strip()
        if raw:
            parsed = json.loads(raw)
            cand_list = parsed if isinstance(parsed, list) else [parsed]
            for cp in cand_list:
                if cp and os.path.exists(str(cp)):
                    paths.append(str(cp))
    except Exception:
        pass
    return paths


_WIN_FORBIDDEN_CHARS_RE = re.compile(r'[<>:"|?*\x00-\x1f]')
_WIN_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}


def _has_hangul(s: str) -> bool:
    return any(
        ("\uAC00" <= ch <= "\uD7A3") or ("\u3131" <= ch <= "\u318E") or ("\u1100" <= ch <= "\u11FF")
        for ch in s
    )


def _decode_archive_filename(raw_name: str, flag_bits: int = 0) -> str:
    """
    [한글 복원 핵심]
    - flag 0x800 미설정 시 UTF-8 strict를 CP949보다 먼저 시도하여 '최종'->'理쒖쥌' 오판을 100% 차단합니다.
    - 구형 웹서버/압축기가 CP437·Latin1로 잘못 읽은 문자열을 0x800 플래그와 함께 이중 인코딩한 경우까지 자동 복원합니다.
    - macOS NFD 자소분리 문자열을 Windows 표준 NFC 완성형으로 결합합니다.
    """
    fixed = raw_name
    if not (flag_bits & 0x800):
        try:
            raw_bytes = raw_name.encode("cp437")
            for enc in ("utf-8", "cp949", "euc-kr", "shift_jis"):
                try:
                    fixed = raw_bytes.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue
        except Exception:
            pass
    elif not _has_hangul(fixed) and any(ord(ch) > 127 for ch in fixed):
        for bridge_enc in ("cp437", "latin1"):
            try:
                raw_bytes = fixed.encode(bridge_enc)
            except UnicodeEncodeError:
                continue
            recovered = None
            for target_enc in ("utf-8", "cp949"):
                try:
                    cand = raw_bytes.decode(target_enc)
                    if _has_hangul(cand):
                        recovered = cand
                        break
                except UnicodeDecodeError:
                    continue
            if recovered:
                fixed = recovered
                break
    return unicodedata.normalize("NFC", fixed)


def _is_macos_or_os_junk(rel_path: str) -> bool:
    """맥(macOS) 압축 쓰레기(__MACOSX, ._ 리소스 포크, .DS_Store)를 판별합니다."""
    norm = rel_path.replace("\\", "/").strip("/")
    if not norm:
        return True
    parts = [seg for seg in norm.split("/") if seg]
    if not parts:
        return True
    if parts[0] == "__MACOSX" or "__MACOSX" in parts:
        return True
    leaf = parts[-1]
    if leaf == ".DS_Store" or leaf.startswith("._"):
        return True
    return False


def _sanitize_single_segment(seg: str) -> str:
    cleaned = _WIN_FORBIDDEN_CHARS_RE.sub("_", unicodedata.normalize("NFC", seg))
    cleaned = cleaned.rstrip(" .")
    if not cleaned:
        return "_"
    stem_part = cleaned.split(".", 1)[0].upper()
    if stem_part in _WIN_RESERVED_NAMES:
        cleaned = f"_{cleaned}"
    return cleaned


def _sanitize_archive_relpath(rel_name: str) -> Tuple[Optional[str], bool]:
    """
    압축 내부 상대경로를 안전하게 정화합니다.
    - '..' 상위 경로 탈출 포함 시 (None, True) 반환하여 Zip-Slip을 원천 차단합니다.
    - Windows 금지문자(?*:<>|")가 있으면 '_'로 치환하고 (정화경로, was_sanitized)를 반환합니다.
    """
    is_dir_hint = rel_name.endswith("/") or rel_name.endswith("\\")
    norm = rel_name.replace("\\", "/").lstrip("/")
    raw_parts = [p for p in norm.split("/") if p and p != "."]
    if not raw_parts:
        return None, False
    if any(p == ".." for p in raw_parts):
        return None, False
    sanitized_parts: List[str] = []
    changed = False
    for p in raw_parts:
        sp = _sanitize_single_segment(p)
        if sp != unicodedata.normalize("NFC", p):
            changed = True
        sanitized_parts.append(sp)
    joined = "/".join(sanitized_parts) + ("/" if is_dir_hint else "")
    return joined, changed


def _is_safe_within_dir(dest_path: Path, root_dir: Path) -> bool:
    """os.path.commonpath 기반 엄격한 하위 경로 검증 (sibling prefix 우회 100% 차단)."""
    try:
        root_abs = os.path.abspath(str(root_dir))
        dest_abs = os.path.abspath(str(dest_path))
        return os.path.commonpath([root_abs, dest_abs]) == root_abs
    except Exception:
        return False


def _pick_unique_output_folder(parent_dir: Path, desired_name: str) -> Path:
    """기존 폴더 안에 유저 파일이 있으면 절대 덮어쓰지 않고 _1, _2 새 폴더를 선택합니다."""
    safe_base = _sanitize_single_segment(desired_name) or "압축해제_폴더"
    cand = (parent_dir / safe_base).resolve()
    counter = 1
    while cand.exists():
        try:
            if cand.is_dir() and not any(cand.iterdir()):
                return cand
        except Exception:
            pass
        cand = (parent_dir / f"{safe_base}_{counter}").resolve()
        counter += 1
    return cand


def is_split_archive_follower(file_path: str) -> bool:
    """분할 압축의 후속 볼륨(.z01, .z02, .part2.rar, .7z.002 등)인지 판별하여 중복 처리 차단"""
    low = file_path.lower()
    if re.search(r"\.z\d{2,}$", low):
        return True
    if re.search(r"\.part(0*[2-9]|[1-9]\d+)\.rar$", low):
        return True
    if re.search(r"\.7z\.(00[2-9]|0[1-9]\d|[1-9]\d{2})$", low):
        return True
    return False


def index_extracted_files_immediately(extracted_folder: str, extracted_files: List[str]) -> Dict[str, Any]:
    """[봉인 존중 원칙] 사용자가 직접 압축을 푼 직후에만 풀려 나온 일반 문서·사진을 즉시 인덱싱 큐에 등록합니다."""
    _ensure_care_dir()
    folder_path = Path(extracted_folder)
    if not folder_path.exists():
        return {"ok": False, "indexedCount": 0}

    records: List[Dict[str, Any]] = []
    now_iso = datetime.datetime.now().isoformat()
    now_ts = time.time()
    text_exts = {".txt", ".md", ".csv", ".json", ".log", ".html", ".htm", ".xml", ".py", ".ts", ".tsx"}

    discovered_paths: List[Path] = []
    try:
        for root_d, _, files_d in os.walk(folder_path):
            for fn in files_d:
                discovered_paths.append(Path(root_d) / fn)
                if len(discovered_paths) >= 200:
                    break
            if len(discovered_paths) >= 200:
                break
    except Exception:
        discovered_paths = [folder_path / fn for fn in extracted_files[:200]]

    for fpath in discovered_paths:
        snippet = ""
        if fpath.suffix.lower() in text_exts and fpath.is_file():
            try:
                raw_b = fpath.read_bytes()[:4096]
                for enc in ("utf-8", "cp949"):
                    try:
                        snippet = " ".join(raw_b.decode(enc).split())[:350]
                        break
                    except UnicodeDecodeError:
                        continue
            except Exception:
                snippet = ""
        records.append({
            "fileName": fpath.name,
            "filePath": str(fpath),
            "folderPath": str(folder_path),
            "textSnippet": snippet,
            "indexedAt": now_iso,
            "indexedTs": now_ts,
        })

    existing_records: List[Dict[str, Any]] = []
    if EXTRACTED_INDEX_QUEUE_FILE.exists():
        try:
            old_q = json.loads(EXTRACTED_INDEX_QUEUE_FILE.read_text(encoding="utf-8"))
            old_items = old_q.get("indexedFiles") if isinstance(old_q, dict) else []
            if isinstance(old_items, list):
                new_paths = {r["filePath"] for r in records}
                existing_records = [r for r in old_items if isinstance(r, dict) and r.get("filePath") not in new_paths][:200]
        except Exception:
            existing_records = []

    merged = (records + existing_records)[:300]
    try:
        EXTRACTED_INDEX_QUEUE_FILE.write_text(
            json.dumps(
                {
                    "lastExtractedFolder": str(folder_path),
                    "updatedAt": now_iso,
                    "indexedFiles": merged,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
    except Exception:
        pass

    return {
        "ok": True,
        "sealedArchiveRespect": True,
        "extractedFolder": str(folder_path),
        "indexedCount": len(records),
    }


def _finalize_staged_tree_to_folder(
    tmp_stage: Path,
    parent_dir: Path,
    fallback_stem: str,
) -> Tuple[Path, List[str], int]:
    """
    임시 스테이징 폴더(tmp_stage)에 풀린 파일들에서 맥 쓰레기(__MACOSX/._/.DS_Store)를 제거하고,
    NFC 한글 정규화·금지문자 치환을 마친 뒤 단일 루트 폴더 자동 판별 + 기존 폴더 덮어쓰기 방지(_1)로 최종 폴더에 안착시킵니다.
    """
    # 1) 맥 쓰레기 삭제 및 하위 폴더/파일명 NFC 정규화 (bottom-up)
    for root_w, dirs_w, files_w in os.walk(tmp_stage, topdown=False):
        root_p = Path(root_w)
        if root_p.name == "__MACOSX":
            shutil.rmtree(root_p, ignore_errors=True)
            continue
        for fw in files_w:
            fp = root_p / fw
            if fw == ".DS_Store" or fw.startswith("._"):
                try:
                    fp.unlink()
                except Exception:
                    pass
                continue
            safe_fw = _sanitize_single_segment(fw)
            if safe_fw != fw:
                target_fp = root_p / safe_fw
                if not target_fp.exists():
                    try:
                        fp.rename(target_fp)
                    except Exception:
                        pass
        for dw in dirs_w:
            dp = root_p / dw
            if dw == "__MACOSX":
                shutil.rmtree(dp, ignore_errors=True)
                continue
            safe_dw = _sanitize_single_segment(dw)
            if safe_dw != dw and dp.exists():
                target_dp = root_p / safe_dw
                if not target_dp.exists():
                    try:
                        dp.rename(target_dp)
                    except Exception:
                        pass

    top_items = [x for x in tmp_stage.iterdir() if x.name != "__MACOSX"]
    if len(top_items) == 1 and top_items[0].is_dir():
        single_dir = top_items[0]
        created_folder = _pick_unique_output_folder(parent_dir, single_dir.name)
        if created_folder.exists():
            try:
                created_folder.rmdir()
            except Exception:
                pass
        shutil.move(str(single_dir), str(created_folder))
    else:
        created_folder = _pick_unique_output_folder(parent_dir, fallback_stem)
        created_folder.mkdir(parents=True, exist_ok=True)
        for ti in top_items:
            dest_ti = created_folder / _sanitize_single_segment(ti.name)
            shutil.move(str(ti), str(dest_ti))

    extracted_files: List[str] = []
    total_bytes = 0
    for root_f, _, files_f in os.walk(created_folder):
        for fn in files_f:
            fp_f = Path(root_f) / fn
            extracted_files.append(fn)
            try:
                total_bytes += fp_f.stat().st_size
            except Exception:
                pass
    return created_folder, extracted_files, total_bytes


def _extract_via_7z(
    archive_path: Path,
    password: Optional[str] = None,
) -> Dict[str, Any]:
    """
    내장 LGPL 7z.exe를 사용하여 암호 걸린 .7z(데이터+헤더 암호화), .rar(RAR4/RAR5 데이터+헤더 암호화),
    Deflate64/AES .zip 등을 알집과 동일하게 처리합니다.
    """
    z7_exe = _find_7z_exe()
    if not z7_exe:
        return {
            "ok": False,
            "error": "SEVENZIP_HELPER_NOT_FOUND",
            "message": "이 형식의 압축 해제 모듈을 찾지 못했습니다. Z-코어를 다시 실행해 주세요.",
        }

    # 1) 사전 목록 검사(암호 유무 + Zip-Slip 경로 탈출·심볼릭링크 악성 엔트리 원천 차단!)
    pwd_list_arg = f"-p{password}" if password is not None and password != "" else "-p"
    r_list = subprocess.run(
        [str(z7_exe), "l", "-slt", "-sccUTF-8", pwd_list_arg, str(archive_path)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=25.0,
        creationflags=CREATE_NO_WINDOW,
    )
    list_stdout = r_list.stdout or ""
    combined_list = (list_stdout + "\n" + (r_list.stderr or "")).lower()
    if not password and (
        "encrypted = +" in combined_list
        or "wrong password" in combined_list
        or "cannot open encrypted archive" in combined_list
        or "can not open encrypted archive" in combined_list
    ):
        return {
            "ok": False,
            "needPassword": True,
            "wrongPassword": False,
            "message": "🔑 암호가 걸린 압축 파일입니다. 비밀번호를 입력해 주세요.",
        }
    for raw_ln in list_stdout.splitlines():
        s_ln = raw_ln.strip()
        if s_ln.startswith("Path = "):
            entry_rel = s_ln[len("Path = ") :].strip()
            if entry_rel == str(archive_path):
                continue
            norm_parts = re.split(r"[\\/]+", entry_rel)
            if ".." in norm_parts or re.match(r"^[a-zA-Z]:", entry_rel) or entry_rel.startswith(("\\", "/")):
                return {
                    "ok": False,
                    "error": "ZIP_SLIP_BLOCKED",
                    "message": "보안 경고: 상위 폴더 탈출(..) 또는 절대 경로가 포함된 위험한 압축 파일이어서 해제를 차단했습니다.",
                }
        elif s_ln.lower().startswith("symboliclink = +") or s_ln.lower().startswith("reparse = "):
            if s_ln.split("=", 1)[1].strip():
                return {
                    "ok": False,
                    "error": "SYMLINK_ARCHIVE_BLOCKED",
                    "message": "보안 경고: 외부 경로를 가리키는 심볼릭 링크가 포함된 압축 파일이어서 해제를 차단했습니다.",
                }

    # 2) 격리 스테이징 폴더에 해제 (중간 오류·암호 불일치 시 찌꺼기 0바이트 완벽 삭제!)
    tmp_stage = Path(tempfile.mkdtemp(prefix=".ghosti_7z_", dir=str(archive_path.parent)))
    try:
        pwd_arg = f"-p{password}" if password else "-p"
        r_ext = subprocess.run(
            [str(z7_exe), "x", "-y", "-sccUTF-8", pwd_arg, f"-o{tmp_stage}", str(archive_path)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=600.0,
            creationflags=CREATE_NO_WINDOW,
        )
        if r_ext.returncode != 0:
            err_txt = ((r_ext.stderr or "") + "\n" + (r_ext.stdout or "")).strip()
            err_low = err_txt.lower()
            shutil.rmtree(tmp_stage, ignore_errors=True)
            if (
                "wrong password" in err_low
                or "cannot open encrypted archive" in err_low
                or "can not open encrypted archive" in err_low
                or "data error in encrypted" in err_low
                or ("headers error" in err_low and password)
                or "encrypted" in err_low
            ):
                return {
                    "ok": False,
                    "needPassword": True,
                    "wrongPassword": bool(password),
                    "message": (
                        "비밀번호가 일치하지 않습니다. 다시 입력해 주세요."
                        if password
                        else "🔑 암호가 걸린 압축 파일입니다. 비밀번호를 입력해 주세요."
                    ),
                }
            return {
                "ok": False,
                "error": "ARCHIVE_CORRUPTED_OR_FAILED",
                "message": "압축 파일이 손상되었거나 지원하지 않는 구조여서 풀지 못했습니다.",
                "detail": err_txt[:240],
            }

        stage_real = os.path.realpath(str(tmp_stage))
        for r_dir, d_names, f_names in os.walk(tmp_stage, followlinks=False):
            for sub_n in list(d_names) + list(f_names):
                cand_p = Path(r_dir) / sub_n
                if cand_p.is_symlink():
                    shutil.rmtree(tmp_stage, ignore_errors=True)
                    return {
                        "ok": False,
                        "error": "SYMLINK_ARCHIVE_BLOCKED",
                        "message": "보안 경고: 심볼릭 링크가 감지되어 압축 해제를 안전 차단했습니다.",
                    }
                cand_real = os.path.realpath(str(cand_p))
                if os.path.commonpath([stage_real, cand_real]) != stage_real:
                    shutil.rmtree(tmp_stage, ignore_errors=True)
                    return {
                        "ok": False,
                        "error": "ZIP_SLIP_BLOCKED",
                        "message": "보안 경고: 지정 폴더 밖으로 벗어나는 경로가 감지되어 해제를 차단했습니다.",
                    }
        created_folder, extracted_files, total_bytes = _finalize_staged_tree_to_folder(
            tmp_stage, archive_path.parent, archive_path.stem
        )
        return {
            "ok": True,
            "createdFolder": created_folder,
            "extractedFiles": extracted_files,
            "totalBytes": total_bytes,
        }
    finally:
        shutil.rmtree(tmp_stage, ignore_errors=True)


def _scan_extracted_folder_executables(folder: Path, fallback_archive: Path) -> Dict[str, Any]:
    """압축 해제 후 풀려 나온 실행·스크립트·매크로 파일들을 실제로 AMSI 검문합니다."""
    risky_exts = {
        ".exe", ".msi", ".bat", ".cmd", ".ps1", ".vbs", ".vbe", ".js", ".jse",
        ".wsf", ".scr", ".hta", ".pif", ".com", ".dll", ".lnk", ".docm", ".xlsm", ".pptm",
    }
    scanned_count = 0
    threats: List[str] = []
    engine_used = "Windows 기본 보안(AMSI)"
    try:
        for root_d, _, files_d in os.walk(folder):
            for fn in files_d:
                if Path(fn).suffix.lower() in risky_exts:
                    fp = Path(root_d) / fn
                    sres = scan_file_with_defender_amsi(str(fp), source="smart_unzip_extracted")
                    scanned_count += 1
                    engine_used = str(sres.get("engine") or engine_used)
                    if sres.get("status") == "THREAT_DETECTED":
                        threats.append(fn)
                    if scanned_count >= 25:
                        break
            if scanned_count >= 25:
                break
    except Exception:
        pass

    if scanned_count == 0:
        base_scan = scan_file_with_defender_amsi(str(fallback_archive), source="smart_unzip")
        engine_used = str(base_scan.get("engine") or engine_used)
        if base_scan.get("status") == "THREAT_DETECTED":
            threats.append(fallback_archive.name)

    return {
        "ok": True,
        "status": "THREAT_DETECTED" if threats else "CLEAN",
        "scannedExecutableCount": scanned_count,
        "threatFiles": threats,
        "engine": engine_used,
    }


def smart_extract_archive(archive_path: str, password: Optional[str] = None) -> Dict[str, Any]:
    """
    [모듈 B — 알집 완벽 대체 1초 스마트 압축 해제]
    - 지원 포맷: .zip (ZipCrypto / AES-128·192·256 / Deflate64), .7z (데이터·헤더 암호화),
      .rar (RAR4/RAR5 데이터·헤더 암호화), .tar, .tgz, .tar.gz, .tar.bz2, .tar.xz, 단일 .gz/.bz2/.xz
    - 모든 해제는 임시 스테이징 폴더에서 먼저 수행 후 원자적으로 이동하므로 실패/암호오류 시 부분 폴더가 절대 남지 않습니다.
    """
    import tarfile
    import zipfile
    import zlib

    if not archive_path or not str(archive_path).strip():
        return {"ok": False, "error": "ARCHIVE_NOT_FOUND", "message": "압축 파일 경로가 비어 있습니다."}

    p = Path(archive_path).resolve()
    if not p.exists() or not p.is_file():
        return {"ok": False, "error": "ARCHIVE_NOT_FOUND", "message": f"압축 파일을 찾을 수 없습니다: {p.name}"}

    if is_split_archive_follower(str(p)):
        return {
            "ok": False,
            "error": "SPLIT_ARCHIVE_FOLLOWER",
            "message": "분할 압축 보조 파일입니다. 1번 대표 압축 파일(.zip / .part1.rar / .7z.001)에서 풀기를 눌러주세요!",
        }

    low_name = p.name.lower()
    suffix_low = p.suffix.lower()
    if suffix_low in (".alz", ".egg"):
        return {
            "ok": False,
            "error": "PROPRIETARY_FORMAT_NOT_SUPPORTED",
            "message": f"'{suffix_low}' 형식은 특정 제조사 독점 규격입니다. 표준 압축(.zip · .7z · .rar · .tar · .gz)은 모두 1초 해제를 지원합니다.",
        }

    # 동일 압축파일 중복 더블클릭 동시 해제 방어 (Windows Named Mutex)
    mutex_handle = None
    if sys.platform == "win32":
        try:
            path_hash = hashlib.sha1(str(p).lower().encode("utf-8")).hexdigest()[:16]
            mutex_name = f"Local\\Ghosti_Extract_{path_hash}"
            mutex_handle = ctypes.windll.kernel32.CreateMutexW(None, False, mutex_name)
            if mutex_handle:
                wait_rc = ctypes.windll.kernel32.WaitForSingleObject(mutex_handle, 0)
                if wait_rc not in (0x00000000, 0x00000080):  # WAIT_OBJECT_0 or WAIT_ABANDONED
                    ctypes.windll.kernel32.CloseHandle(mutex_handle)
                    return {
                        "ok": False,
                        "alreadyRunning": True,
                        "error": "ALREADY_EXTRACTING",
                        "message": f"'{p.name}' 압축을 이미 푸는 중입니다. 잠시만 기다려 주세요!",
                    }
        except Exception:
            mutex_handle = None

    created_folder: Optional[Path] = None
    extracted_files: List[str] = []
    total_uncompressed = 0

    try:
        # ── A) .zip (표준 + ZipCrypto + WinZip AES-256 + Deflate64) ──
        if suffix_low == ".zip":
            try:
                zf_probe = zipfile.ZipFile(p, mode="r")
            except zipfile.BadZipFile:
                return {
                    "ok": False,
                    "error": "CORRUPTED_ZIP",
                    "message": f"'{p.name}' 파일이 손상되었거나 올바른 ZIP 파일이 아닙니다.",
                }

            with zf_probe:
                infos = zf_probe.infolist()
                total_uncompressed = sum(int(i.file_size or 0) for i in infos)
                comp_size = max(1, p.stat().st_size)

                free_bytes = shutil.disk_usage(p.parent).free
                if total_uncompressed > free_bytes:
                    return {
                        "ok": False,
                        "error": "DISK_FULL_PREVENTED",
                        "message": (
                            f"⚠️ 디스크 여유 공간({round(free_bytes / (1024**3), 1)}GB)보다 "
                            f"압축 해제 크기({round(total_uncompressed / (1024**3), 1)}GB)가 커서 안전하게 중단했습니다."
                        ),
                    }
                if (total_uncompressed / comp_size) > 120 and total_uncompressed > 10 * (1024**3):
                    return {
                        "ok": False,
                        "error": "DECOMPRESSION_BOMB_SUSPECTED",
                        "message": "🚨 비정상적인 팽창률(압축 폭탄 의심)이 감지되어 PC 보호를 위해 해제를 차단했습니다.",
                    }

                is_encrypted = any(
                    ((i.flag_bits & 0x1) != 0 or int(i.compress_type) == 99)
                    for i in infos
                    if not i.is_dir()
                )
                if is_encrypted and not password:
                    return {
                        "ok": False,
                        "needPassword": True,
                        "wrongPassword": False,
                        "message": "🔑 암호가 걸린 압축 파일입니다. 비밀번호를 입력해 주세요.",
                    }

                comp_types = {int(i.compress_type) for i in infos if not i.is_dir()}
                uses_aes = 99 in comp_types
                uses_exotic_method = bool(comp_types - {0, 8, 12, 14, 99})  # 예: 9(Deflate64), 93(Zstd)

            if uses_exotic_method:
                ext7 = _extract_via_7z(p, password=password)
                if not ext7.get("ok"):
                    return ext7
                created_folder = ext7["createdFolder"]
                extracted_files = ext7["extractedFiles"]
                total_uncompressed = ext7["totalBytes"]
            else:
                zip_opener: Any = zipfile.ZipFile
                if uses_aes:
                    try:
                        import pyzipper  # type: ignore

                        zip_opener = pyzipper.AESZipFile
                    except Exception:
                        ext7 = _extract_via_7z(p, password=password)
                        if not ext7.get("ok"):
                            return ext7
                        created_folder = ext7["createdFolder"]
                        extracted_files = ext7["extractedFiles"]
                        total_uncompressed = ext7["totalBytes"]
                        zip_opener = None

                if zip_opener is not None:
                    tmp_stage = Path(tempfile.mkdtemp(prefix=".ghosti_zip_", dir=str(p.parent)))
                    try:
                        with zip_opener(p, mode="r") as zf:
                            pwd_candidates: List[Optional[bytes]] = [None]
                            if password:
                                pwd_candidates = [password.encode("utf-8")]
                                try:
                                    cp_b = password.encode("cp949")
                                    if cp_b != pwd_candidates[0]:
                                        pwd_candidates.append(cp_b)
                                except Exception:
                                    pass

                            for info in zf.infolist():
                                dec_raw = _decode_archive_filename(info.filename, info.flag_bits)
                                if _is_macos_or_os_junk(dec_raw):
                                    continue
                                clean_rel, _ = _sanitize_archive_relpath(dec_raw)
                                if not clean_rel:
                                    continue
                                dest_path = (tmp_stage / clean_rel.rstrip("/")).resolve()
                                if not _is_safe_within_dir(dest_path, tmp_stage):
                                    continue
                                if info.is_dir() or clean_rel.endswith("/"):
                                    dest_path.mkdir(parents=True, exist_ok=True)
                                    continue
                                dest_path.parent.mkdir(parents=True, exist_ok=True)

                                last_pwd_err: Optional[Exception] = None
                                extracted_ok = False
                                for pb in pwd_candidates:
                                    try:
                                        with zf.open(info, mode="r", pwd=pb) as src_f, open(dest_path, "wb") as dst_f:
                                            shutil.copyfileobj(src_f, dst_f, length=1024 * 1024)
                                        extracted_ok = True
                                        break
                                    except (RuntimeError, zlib.error, zipfile.BadZipFile) as pe:
                                        last_pwd_err = pe
                                        try:
                                            if dest_path.exists():
                                                dest_path.unlink()
                                        except Exception:
                                            pass
                                if not extracted_ok and last_pwd_err is not None:
                                    raise last_pwd_err

                        created_folder, extracted_files, total_uncompressed = _finalize_staged_tree_to_folder(
                            tmp_stage, p.parent, p.stem
                        )
                    except (RuntimeError, zlib.error, zipfile.BadZipFile) as e_pwd:
                        err_s = str(e_pwd).lower()
                        if is_encrypted or "password" in err_s or "encrypted" in err_s:
                            return {
                                "ok": False,
                                "needPassword": True,
                                "wrongPassword": bool(password),
                                "message": (
                                    "비밀번호가 일치하지 않습니다. 다시 입력해 주세요."
                                    if password
                                    else "🔑 암호가 걸린 압축 파일입니다. 비밀번호를 입력해 주세요."
                                ),
                            }
                        return {
                            "ok": False,
                            "error": "CORRUPTED_ZIP_STREAM",
                            "message": f"압축 해제 중 손상된 데이터가 감지되었습니다 ({e_pwd}).",
                        }
                    finally:
                        shutil.rmtree(tmp_stage, ignore_errors=True)

        # ── B) .tar / .tgz / .tar.gz / .tar.bz2 / .tar.xz 및 단일 파일 .gz / .bz2 / .xz ──
        elif suffix_low in (".tar", ".gz", ".tgz", ".bz2", ".xz"):
            is_tar = False
            try:
                is_tar = tarfile.is_tarfile(p)
            except Exception:
                is_tar = False

            tmp_stage = Path(tempfile.mkdtemp(prefix=".ghosti_tar_", dir=str(p.parent)))
            try:
                if is_tar:
                    base_stem = re.sub(r"\.tar$", "", p.stem, flags=re.IGNORECASE)
                    with tarfile.open(p, mode="r:*") as tf:
                        for member in tf.getmembers():
                            if member.issym() or member.islnk():
                                continue  # 심볼릭/하드링크 우회 차단
                            dec_raw = unicodedata.normalize("NFC", member.name)
                            if _is_macos_or_os_junk(dec_raw):
                                continue
                            clean_rel, _ = _sanitize_archive_relpath(dec_raw)
                            if not clean_rel:
                                continue
                            dest_path = (tmp_stage / clean_rel.rstrip("/")).resolve()
                            if not _is_safe_within_dir(dest_path, tmp_stage):
                                continue
                            if member.isdir():
                                dest_path.mkdir(parents=True, exist_ok=True)
                            elif member.isfile():
                                dest_path.parent.mkdir(parents=True, exist_ok=True)
                                src_f = tf.extractfile(member)
                                if src_f:
                                    with src_f, open(dest_path, "wb") as dst_f:
                                        shutil.copyfileobj(src_f, dst_f, length=1024 * 1024)
                    created_folder, extracted_files, total_uncompressed = _finalize_staged_tree_to_folder(
                        tmp_stage, p.parent, base_stem
                    )
                elif suffix_low in (".gz", ".bz2", ".xz") and not low_name.endswith(".tgz"):
                    # 단일 파일 압축 (예: server.log.gz -> server.log 폴더 내 server.log 생성, 실패 시 빈 폴더 0개!)
                    import bz2
                    import gzip
                    import lzma

                    inner_name = _sanitize_single_segment(p.stem) or "decompressed_file"
                    folder_stem = Path(inner_name).stem or inner_name
                    opener_map = {".gz": gzip.open, ".bz2": bz2.open, ".xz": lzma.open}
                    out_file = tmp_stage / inner_name
                    with opener_map[suffix_low](p, "rb") as sf, open(out_file, "wb") as df:
                        shutil.copyfileobj(sf, df, length=1024 * 1024)
                    created_folder, extracted_files, total_uncompressed = _finalize_staged_tree_to_folder(
                        tmp_stage, p.parent, folder_stem
                    )
                else:
                    return {
                        "ok": False,
                        "error": "CORRUPTED_TAR",
                        "message": f"'{p.name}' 파일이 손상되었거나 올바른 압축 형식이 아닙니다.",
                    }
            except Exception as e_tar:
                return {
                    "ok": False,
                    "error": "TAR_GZIP_EXTRACT_FAILED",
                    "message": f"'{p.name}' 압축을 푸는 중 오류가 발생했습니다 ({e_tar}).",
                }
            finally:
                shutil.rmtree(tmp_stage, ignore_errors=True)

        # ── C) .7z / .rar (암호 압축 + 헤더 암호화 + RAR5 완벽 지원) ──
        elif suffix_low in (".7z", ".rar"):
            ext7 = _extract_via_7z(p, password=password)
            if not ext7.get("ok"):
                return ext7
            created_folder = ext7["createdFolder"]
            extracted_files = ext7["extractedFiles"]
            total_uncompressed = ext7["totalBytes"]

        else:
            return {
                "ok": False,
                "error": "UNSUPPORTED_ARCHIVE_FORMAT",
                "message": f"지원하지 않는 압축 형식입니다 ({p.suffix}).",
            }

    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
            "message": f"압축 해제 중 오류가 발생했습니다: {e}",
        }
    finally:
        if mutex_handle and sys.platform == "win32":
            try:
                ctypes.windll.kernel32.ReleaseMutex(mutex_handle)
                ctypes.windll.kernel32.CloseHandle(mutex_handle)
            except Exception:
                pass

    assert created_folder is not None
    index_res = index_extracted_files_immediately(str(created_folder), extracted_files)
    scan_res = _scan_extracted_folder_executables(created_folder, fallback_archive=p)

    total_mb = round(total_uncompressed / (1024 * 1024), 2)
    preview_names = ", ".join(extracted_files[:3])
    if len(extracted_files) > 3:
        preview_names += f" 외 {len(extracted_files) - 3}건"

    is_clean = scan_res.get("status") != "THREAT_DETECTED"
    guard_line = (
        f"🛡️ Windows 기본 보안 무소음 검문 완료 ({total_mb}MB · 풀린 문서 즉시 검색 준비 완료)"
        if is_clean
        else f"🚨 주의: 풀린 파일({', '.join(scan_res.get('threatFiles') or [])})에서 위험 요소가 감지되었습니다! 실행하지 마세요."
    )

    return {
        "ok": True,
        "extractedFolder": str(created_folder),
        "extractedCount": len(extracted_files),
        "extractedPreview": preview_names,
        "totalUncompressedMb": total_mb,
        "indexedImmediately": index_res,
        "defenderCheck": scan_res,
        "inlineBridge": {
            "summaryLines": [
                f"✅ 한글 깨짐·바탕화면 폭탄 없이 '{created_folder.name}' 폴더에 {len(extracted_files)}개 파일을 1초 만에 풀었어요!",
                f"📄 포함 파일: {preview_names or '폴더 구조'}",
                guard_line,
            ],
            "primaryCta": {
                "action": "search_extracted_docs",
                "label": f"🔍 방금 푼 문서 {len(extracted_files)}개 안의 내용 1초 검색",
                "targetFolder": str(created_folder),
            },
            "secondaryCta": {
                "action": "send_to_phone_or_s_drive",
                "label": (
                    "📱 카톡 용량 제한(300MB) 없이 내 폰으로 1초 직송"
                    if total_mb >= 100
                    else "📱 내 폰으로 바로 보내기 / 💼 팀 공유폴더(S:) 넣기"
                ),
                "targetFolder": str(created_folder),
            },
        },
    }


def _read_file_bytes_shared_win32(file_path: Path) -> Optional[Path]:
    """엑셀 등에서 열려 잠긴 파일도 FILE_SHARE_READ|WRITE|DELETE로 임시 사본을 떠서 압축 실패를 막습니다."""
    if sys.platform != "win32":
        return None
    GENERIC_READ = 0x80000000
    FILE_SHARE_ALL = 0x00000001 | 0x00000002 | 0x00000004
    OPEN_EXISTING = 3
    INVALID_HANDLE_VALUE = ctypes.c_void_p(-1).value
    k32 = ctypes.windll.kernel32
    handle = k32.CreateFileW(str(file_path), GENERIC_READ, FILE_SHARE_ALL, None, OPEN_EXISTING, 0, None)
    if not handle or handle == INVALID_HANDLE_VALUE:
        return None
    tmp_fd, tmp_name = tempfile.mkstemp(prefix=".ghosti_shared_")
    os.close(tmp_fd)
    tmp_p = Path(tmp_name)
    try:
        buf = ctypes.create_string_buffer(262144)
        bytes_read = wintypes.DWORD(0)
        with open(tmp_p, "wb") as out_f:
            while k32.ReadFile(handle, buf, 262144, ctypes.byref(bytes_read), None) and bytes_read.value > 0:
                out_f.write(buf.raw[: bytes_read.value])
        return tmp_p
    except Exception:
        tmp_p.unlink(missing_ok=True)
        return None
    finally:
        k32.CloseHandle(handle)


def _write_path_into_zip(zf: Any, full_f: Path, arcname: str) -> None:
    try:
        zf.write(full_f, arcname=arcname)
    except PermissionError:
        shared_copy = _read_file_bytes_shared_win32(full_f)
        if shared_copy is not None:
            try:
                zf.write(shared_copy, arcname=arcname)
                return
            finally:
                shared_copy.unlink(missing_ok=True)
        raise


def smart_create_zip(target_path: str | List[str]) -> Dict[str, Any]:
    """
    일반 파일·폴더 우클릭 `👻 귀신같이로 ZIP 압축 묶기`:
    - 다중 선택(2개 이상) 시 온보딩 시연과 100% 동일한 `YYMMDD_대표파일_외N건.zip` 1개로 묶습니다!
    - 임시 파일(.tmp)에 먼저 완성한 뒤 원자적으로 이름을 바꾸어 실패 시 깨진 zip이 절대 남지 않습니다.
    - 엑셀 등에 열려 있는 파일도 공유 읽기(FILE_SHARE_READ|WRITE)로 안전하게 담아냅니다.
    """
    import zipfile

    raw_list = [target_path] if isinstance(target_path, str) else list(target_path or [])
    sources: List[Path] = []
    seen_src = set()
    for item in raw_list:
        if not item or not str(item).strip():
            continue
        rp = Path(str(item)).resolve()
        if rp.exists() and str(rp).lower() not in seen_src:
            seen_src.add(str(rp).lower())
            sources.append(rp)

    if not sources:
        return {"ok": False, "error": "SOURCE_NOT_FOUND", "message": "압축할 원본 파일을 찾지 못했습니다."}

    parent_dir = sources[0].parent
    first_src = sources[0]
    first_label = _sanitize_single_segment(first_src.stem if first_src.is_file() else first_src.name)

    if len(sources) >= 2:
        yymmdd = datetime.datetime.now().strftime("%y%m%d")
        base_zip_stem = f"{yymmdd}_{first_label}_외{len(sources) - 1}건"
    else:
        base_zip_stem = first_label

    out_zip = parent_dir / f"{base_zip_stem}.zip"
    counter = 1
    while out_zip.exists():
        out_zip = parent_dir / f"{base_zip_stem}_{counter}.zip"
        counter += 1

    tmp_zip = parent_dir / f".ghosti_mkzip_{uuid.uuid4().hex[:8]}.zip.tmp"
    added_count = 0
    try:
        with zipfile.ZipFile(tmp_zip, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            used_arcnames: set[str] = set()
            for src in sources:
                if src.is_file():
                    arcname = unicodedata.normalize("NFC", src.name)
                    if arcname.lower() in used_arcnames:
                        arcname = f"{src.stem}_{added_count + 1}{src.suffix}"
                    used_arcnames.add(arcname.lower())
                    _write_path_into_zip(zf, src, arcname=arcname)
                    added_count += 1
                else:
                    wrote_any_in_dir = False
                    for root, dirs, files in os.walk(src):
                        for f in files:
                            full_f = Path(root) / f
                            if full_f.resolve() == tmp_zip.resolve():
                                continue
                            rel = full_f.relative_to(src.parent)
                            arcname = unicodedata.normalize("NFC", str(rel).replace("\\", "/"))
                            _write_path_into_zip(zf, full_f, arcname=arcname)
                            added_count += 1
                            wrote_any_in_dir = True
                        if not files and not dirs and not wrote_any_in_dir:
                            rel_dir = Path(root).relative_to(src.parent)
                            zinfo_dir = zipfile.ZipInfo(unicodedata.normalize("NFC", str(rel_dir).replace("\\", "/")) + "/")
                            zf.writestr(zinfo_dir, b"")
                            wrote_any_in_dir = True
        os.replace(tmp_zip, out_zip)
    except Exception as e:
        tmp_zip.unlink(missing_ok=True)
        return {
            "ok": False,
            "error": str(e),
            "message": f"ZIP 압축 생성 중 오류가 발생했습니다: {e}",
        }

    return {
        "ok": True,
        "zipPath": str(out_zip),
        "zipName": out_zip.name,
        "sourceCount": len(sources),
        "addedCount": added_count,
        "toastMessage": f"🗜️ '{out_zip.name}' ({added_count}개 파일) 압축 묶기 완료! (맥·윈도우 한글 호환 100%)",
    }


def _cli_smart_zip_coalesced(arg_path: str) -> Optional[Dict[str, Any]]:
    """
    탐색기에서 여러 파일을 드래그 선택해 우클릭 'ZIP 압축 묶기'를 누르면 Windows가 파일마다 프로세스를 띄웁니다.
    짧은 Named Mutex + 배치 큐로 동시 호출들을 1개의 리더 프로세스로 모아 단 1개의 통합 ZIP(`YYMMDD_대표_외N건.zip`)으로 생성합니다!
    """
    if sys.platform != "win32":
        return smart_create_zip(arg_path)

    src = Path(arg_path).resolve()
    if not src.exists():
        return {"ok": False, "error": "SOURCE_NOT_FOUND"}

    _ensure_care_dir()
    dir_hash = hashlib.sha1(str(src.parent).lower().encode("utf-8")).hexdigest()[:14]
    batch_file = CARE_DIR / f"smart_zip_batch_{dir_hash}.jsonl"
    k32 = ctypes.windll.kernel32

    stage_mutex = k32.CreateMutexW(None, False, f"Local\\Ghosti_ZipStage_{dir_hash}")
    try:
        if stage_mutex:
            k32.WaitForSingleObject(stage_mutex, 2000)
        with open(batch_file, "a", encoding="utf-8") as bf:
            bf.write(json.dumps({"path": str(src), "ts": time.time()}, ensure_ascii=False) + "\n")
    finally:
        if stage_mutex:
            k32.ReleaseMutex(stage_mutex)
            k32.CloseHandle(stage_mutex)

    leader_mutex = k32.CreateMutexW(None, False, f"Local\\Ghosti_ZipLeader_{dir_hash}")
    if leader_mutex:
        rc = k32.WaitForSingleObject(leader_mutex, 0)
        if rc not in (0x00000000, 0x00000080):
            k32.CloseHandle(leader_mutex)
            return None  # 팔로워 프로세스는 경로만 등록하고 조용히 종료

    try:
        # 동시 실행된 팔로워 프로세스들이 모두 기록할 때까지 짧게 대기 (최대 1.0초, 220ms 안정화 시 즉시 진행)
        last_size = -1
        stable_ticks = 0
        for _ in range(15):
            time.sleep(0.075)
            cur_size = batch_file.stat().st_size if batch_file.exists() else 0
            if cur_size == last_size:
                stable_ticks += 1
                if stable_ticks >= 3:
                    break
            else:
                last_size = cur_size
                stable_ticks = 0

        collected: List[str] = []
        if stage_mutex := k32.CreateMutexW(None, False, f"Local\\Ghosti_ZipStage_{dir_hash}"):
            k32.WaitForSingleObject(stage_mutex, 2000)
            try:
                if batch_file.exists():
                    now_t = time.time()
                    for line in batch_file.read_text(encoding="utf-8", errors="ignore").splitlines():
                        try:
                            row = json.loads(line)
                            if (now_t - float(row.get("ts") or 0)) <= 10.0 and row.get("path"):
                                collected.append(str(row["path"]))
                        except Exception:
                            continue
                    batch_file.unlink(missing_ok=True)
            finally:
                k32.ReleaseMutex(stage_mutex)
                k32.CloseHandle(stage_mutex)

        # 만약 Windows가 대표 1개만 전달했는데 탐색기에 같은 폴더 다중 선택이 잡혀 있으면 함께 병합
        if len(collected) == 1:
            try:
                sel = get_explorer_selected_paths_non_destructive()
                same_dir_sel = [
                    sp for sp in sel
                    if Path(sp).resolve().parent == src.parent
                ]
                if len(same_dir_sel) > 1 and any(Path(sp).resolve() == src for sp in same_dir_sel):
                    collected = [str(src)] + [sp for sp in same_dir_sel if Path(sp).resolve() != src]
            except Exception:
                pass

        return smart_create_zip(collected or [str(src)])
    finally:
        if leader_mutex:
            k32.ReleaseMutex(leader_mutex)
            k32.CloseHandle(leader_mutex)


# ============================================================================
# 4. [모듈 C] Windows 기본 보안(amsi.dll In-Memory + Event ID 1116/1117 30일 필터) 무소음 수호
# ============================================================================
def _init_guardian_db() -> None:
    _ensure_care_dir()
    with sqlite3.connect(GUARDIAN_DB_FILE) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS guardian_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scanned_at TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size_bytes INTEGER DEFAULT 0,
                source TEXT DEFAULT 'download',
                engine TEXT DEFAULT 'Windows 기본 보안 (AMSI)',
                result_code INTEGER DEFAULT 0,
                status TEXT DEFAULT 'CLEAN'
            )
            """
        )
        conn.commit()


def scan_file_with_defender_amsi(file_path: str, source: str = "download") -> Dict[str, Any]:
    """
    자체 무거운 백신 데몬 0MB! Windows 기본 보안 인터페이스(amsi.dll)를 통해 현재 활성화된 백신(Defender 등)으로
    0.01초 검문하고, 정상 판정(CLEAN) 시 알림 팝업 0회로 로컬 수호 장부에만 조용히 기록합니다.
    """
    _init_guardian_db()
    p = Path(file_path)
    if not p.exists() or not p.is_file():
        return {"ok": False, "error": "FILE_NOT_FOUND"}

    if p.suffix.lower() in (".crdownload", ".part", ".tmp", ".partial"):
        return {"ok": True, "skippedTempDownload": True}

    fsize = p.stat().st_size
    status = "CLEAN"
    result_code = 0
    engine_used = "Windows 기본 보안 (AMSI 실시간 검문)"

    if sys.platform == "win32" and fsize <= 50 * 1024 * 1024:
        try:
            amsi = ctypes.windll.amsi
            amsi_ctx = ctypes.c_void_p()
            hr = amsi.AmsiInitialize(ctypes.c_wchar_p("GhostiCareSuite"), ctypes.byref(amsi_ctx))
            if hr == 0 and amsi_ctx:
                try:
                    with open(p, "rb") as f:
                        sample = f.read(min(fsize, 16 * 1024 * 1024))
                    amsi_res = ctypes.c_int(0)
                    if sample:
                        amsi.AmsiScanBuffer(
                            amsi_ctx,
                            sample,
                            len(sample),
                            ctypes.c_wchar_p(str(p)),
                            None,
                            ctypes.byref(amsi_res),
                        )
                        result_code = int(amsi_res.value)
                        if result_code >= 32768:
                            status = "THREAT_DETECTED"
                finally:
                    amsi.AmsiUninitialize(amsi_ctx)
        except Exception:
            engine_used = "Windows 보안 이벤트 확인"
    else:
        engine_used = "Windows 보안 대용량 위임 (무부하)"

    now_iso = datetime.datetime.now().isoformat()
    try:
        with sqlite3.connect(GUARDIAN_DB_FILE) as conn:
            conn.execute(
                """
                INSERT INTO guardian_history
                (scanned_at, file_name, file_path, file_size_bytes, source, engine, result_code, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (now_iso, p.name, str(p), fsize, source, engine_used, result_code, status),
            )
            conn.commit()
    except Exception:
        pass

    return {
        "ok": True,
        "fileName": p.name,
        "status": status,
        "silentPass": status == "CLEAN",
        "engine": engine_used,
        "alertPopupShown": status != "CLEAN",
        "alertMessage": (
            f"🚨 방금 확인한 '{p.name}'에서 위험 요소가 감지되었습니다! 파일을 열지 마시고 바로 휴지통으로 지워주세요."
            if status != "CLEAN"
            else ""
        ),
    }


def get_defender_guardian_history(days: int = 30, limit: int = 30) -> Dict[str, Any]:
    """[모듈 C] 최근 N일 안심 수호 히스토리 조회 (Defender Event ID 1116/1117 동일 기간 필터 적용)"""
    _init_guardian_db()
    safe_days = max(1, min(int(days or 30), 365))
    cutoff = (datetime.datetime.now() - datetime.timedelta(days=safe_days)).isoformat()
    items: List[Dict[str, Any]] = []
    total_clean_count = 0
    threat_count = 0

    try:
        with sqlite3.connect(GUARDIAN_DB_FILE) as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT COUNT(*) FROM guardian_history WHERE scanned_at >= ? AND status = 'CLEAN'",
                (cutoff,),
            )
            row = cur.fetchone()
            total_clean_count = int(row[0]) if row else 0

            cur.execute(
                "SELECT COUNT(*) FROM guardian_history WHERE scanned_at >= ? AND status != 'CLEAN'",
                (cutoff,),
            )
            row_t = cur.fetchone()
            threat_count = int(row_t[0]) if row_t else 0

            cur.execute(
                """
                SELECT scanned_at, file_name, file_size_bytes, source, engine, status
                FROM guardian_history
                WHERE scanned_at >= ?
                ORDER BY id DESC LIMIT ?
                """,
                (cutoff, limit),
            )
            for r in cur.fetchall():
                items.append({
                    "scannedAt": r[0],
                    "fileName": r[1],
                    "fileSizeBytes": r[2],
                    "source": r[3],
                    "engine": r[4],
                    "status": r[5],
                })
    except Exception:
        pass

    # Windows Defender Operational Event Log — 반드시 최근 safe_days 기간(StartTime)으로 한정!
    defender_event_threats = 0
    if sys.platform == "win32":
        try:
            ps_evt = (
                "try { "
                f"$st = (Get-Date).AddDays(-{safe_days}); "
                "$evts = Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Windows Defender/Operational'; Id=1116,1117; StartTime=$st} "
                "-MaxEvents 20 -ErrorAction Stop; "
                "@($evts).Count "
                "} catch { 0 }"
            )
            r_ev = subprocess.run(
                ["powershell", "-NoProfile", "-Command", ps_evt],
                capture_output=True,
                text=True,
                timeout=2.5,
                creationflags=CREATE_NO_WINDOW,
            )
            defender_event_threats = int((r_ev.stdout or "0").strip() or "0")
        except Exception:
            defender_event_threats = 0

    dl_archives = _count_downloads_archive_files()
    return {
        "ok": True,
        "cardTitle": f"🛡️ 다운로드·문서 조용한 안전 검사 (최근 {safe_days}일 {total_clean_count}건 확인)",
        "days": safe_days,
        "silentPassCount": total_clean_count,
        "threatBlockedCount": max(threat_count, defender_event_threats),
        "defenderOperationalThreats": defender_event_threats,
        "downloadsArchiveCount": dl_archives["count"],
        "downloadsArchiveThresholdMet": dl_archives["thresholdMet"],
        "downloadsArchiveSamples": dl_archives["samples"],
        "downloadsArchiveLatestFile": dl_archives["latestFileName"],
        "recentItems": items,
        "zeroBloatNote": "자체 무거운 백신 상주 0MB · Windows 기본 보안 엔진 직결 무소음 보호로 평시 CPU 0.0% 유지",
        "privacyBadge": PLUGIN_METADATA["privacyBadge"],
    }


# ============================================================================
# 4-B. [모듈 D] 심층 앱 적출 (Deep Uninstaller) — 휴지통 직행 · 사용자 데이터 보호 · 정직 보고
# ============================================================================
AUDIT_LOG_DIR = CARE_DIR / "uninstall_logs"

DEEP_UNINSTALL_SYNONYM_MAP: Dict[str, Dict[str, Any]] = {
    "adobe": {
        "label": "Adobe Creative Cloud / Acrobat 패밀리",
        "keywords": [
            "adobe", "creative cloud", "acrobat", "photoshop", "illustrator", "premiere",
            "after effects", "indesign", "lightroom", "ccxprocess", "adobeipcbroker",
            "coresync", "adobenotificationclient", "agmservice", "agsservice", "adobearm",
        ],
    },
    "어도비": {
        "label": "Adobe Creative Cloud / Acrobat 패밀리",
        "keywords": [
            "adobe", "creative cloud", "acrobat", "photoshop", "illustrator", "premiere",
            "after effects", "indesign", "lightroom", "ccxprocess", "adobeipcbroker",
            "coresync", "adobenotificationclient", "agmservice", "agsservice", "adobearm",
        ],
    },
    "포토샵": {
        "label": "Adobe Photoshop & Creative Cloud",
        "keywords": ["adobe", "photoshop", "creative cloud", "ccxprocess", "adobeipcbroker", "coresync", "agmservice", "agsservice"],
    },
    "아크로뱃": {
        "label": "Adobe Acrobat & 상주 업데이터",
        "keywords": ["adobe", "acrobat", "adobearm", "acrotray", "adobecollabsync"],
    },
    "알약": {
        "label": "알약(ALYac) 및 이스트소프트 상주 모듈",
        "keywords": ["alyac", "알약", "estsoft", "ayagent", "ayrtsrv", "ayupdsrv"],
    },
    "알집": {
        "label": "알집(ALZip) 및 부가 광고 모듈",
        "keywords": ["alzip", "알집", "altools", "alupdate"],
    },
    "고클린": {
        "label": "고클린(GoClean) 및 상주 알림 타이머",
        "keywords": ["goclean", "고클린"],
    },
    "한컴": {
        "label": "한컴오피스(Hancom) 상주 업데이터·클라우드",
        "keywords": ["hancom", "한컴", "hoffice", "hncupdate", "hancomstudio"],
    },
    "줌": {
        "label": "Zoom Workplace 및 백그라운드 서비스",
        "keywords": ["zoom", "cpthost"],
    },
    "팀뷰어": {
        "label": "TeamViewer 원격 제어 및 상주 서비스",
        "keywords": ["teamviewer"],
    },
    "애니데스크": {
        "label": "AnyDesk 원격 제어 및 상주 서비스",
        "keywords": ["anydesk"],
    },
    "구라": {
        "label": "관공서·은행 상주 보안 플러그인 일괄",
        "keywords": [
            "anysign", "touchen", "veraport", "magicline", "ipinside", "astx",
            "crosscert", "iniline", "delfino", "wizvera", "ksign", "nprotect", "nossvc",
        ],
    },
    "보안프로그램": {
        "label": "관공서·은행 상주 보안 플러그인 일괄",
        "keywords": [
            "anysign", "touchen", "veraport", "magicline", "ipinside", "astx",
            "crosscert", "iniline", "delfino", "wizvera", "ksign", "nprotect", "nossvc",
        ],
    },
}

NEVER_UNINSTALL_PROTECTED_KEYWORDS = {
    "microsoft windows", "windows defender", "securityhealth", "msmpeng", "explorer.exe",
    "svchost.exe", "csrss.exe", "winlogon.exe", "lsass.exe", "services.exe",
    "merlin", "ghosti", "senstalk", "sundream", "maepsbroker", "markany", "fasoo", "softcamp",
    "nvidia", "amd ", "intel(", "realtek",
}

# 메신저 대화 기록·브라우저 북마크·노트 등 소중한 개인 데이터가 담긴 폴더는 잔여 폴더 정리 대상에서 영구 보호!
USER_PERSONAL_DATA_FOLDER_PROTECTED = {
    "kakao", "kakaotalk", "line", "telegram desktop", "wechat", "discord", "slack",
    "google", "chrome", "microsoft", "edge", "naver", "whale", "mozilla", "firefox", "bravesoftware",
    "obsidian", "notion", "evernote", "1password", "bitwarden",
}


def _extract_target_app_profile(raw_query: str) -> Tuple[str, List[str], str]:
    """자연어 발화에서 적출 대상 앱 이름을 추출합니다. 대상이 불분명하면 절대 임의 앱(어도비 등)으로 추정하지 않고 빈 목록을 반환합니다."""
    q = (raw_query or "").strip()
    q_low = q.lower()
    for trig, info in DEEP_UNINSTALL_SYNONYM_MAP.items():
        if trig in q_low:
            return info["label"], list(info["keywords"]), trig

    cleaned = q
    noise_phrases = sorted(
        (
            "안 지워지는", "안지워지는", "안 꺼지는", "안꺼지는", "안 쓰는", "안쓰는", "불필요한", "이상한", "좀비",
            "귀신비서", "내 컴퓨터에서", "내 컴퓨터", "컴퓨터에서", "컴퓨터", "노트북", "피씨", "pc",
            "프로그램", "어플리케이션", "어플", "소프트웨어", "앱",
            "흔적까지", "뿌리째", "싹 다", "싹다", "깨끗하게", "깨끗이", "완전히", "완전", "강제로", "강제", "심층", "적출",
            "언인스톨해줘", "언인스톨", "uninstall", "삭제해줘", "삭제해", "삭제", "제거해줘", "제거해", "제거",
            "지워줘", "지워", "뽑아줘", "뽑아", "없애줘", "없애", "치워줘", "치워",
            "해줘", "해주세요", "좀", "에서", "다", "그냥",
        ),
        key=len,
        reverse=True,
    )
    for noise in noise_phrases:
        cleaned = re.sub(re.escape(noise), " ", cleaned, flags=re.IGNORECASE)
    cleaned = " ".join(cleaned.split()).strip(" '\"?!.~,")
    if not cleaned or len(cleaned) < 2:
        return "", [], ""

    slug = "".join(ch for ch in cleaned.lower() if ch.isalnum()) or "target_app"
    return f"{cleaned} 관련 상주 프로그램·잔여 흔적", [cleaned.lower()], slug


def _is_protected_system_entity(text: str) -> bool:
    t_low = (text or "").lower()
    return any(pk in t_low for pk in NEVER_UNINSTALL_PROTECTED_KEYWORDS)


def _is_protected_personal_data_dir(folder_name: str, full_path_str: str) -> bool:
    fn_low = (folder_name or "").strip().lower()
    p_low = (full_path_str or "").lower()
    if any(u == fn_low or f"\\{u}\\" in (p_low + "\\") for u in USER_PERSONAL_DATA_FOLDER_PROTECTED):
        return True
    return False


def _calc_dir_size_fast(folder: Path, max_files: int = 800) -> int:
    total = 0
    counted = 0
    stack = [folder]
    while stack and counted < max_files:
        cur = stack.pop()
        try:
            with os.scandir(cur) as it:
                for entry in it:
                    counted += 1
                    if counted > max_files:
                        break
                    try:
                        if entry.is_symlink():
                            continue
                        if entry.is_file(follow_symlinks=False):
                            total += entry.stat(follow_symlinks=False).st_size
                        elif entry.is_dir(follow_symlinks=False):
                            stack.append(Path(entry.path))
                    except Exception:
                        continue
        except Exception:
            continue
    return total


def scan_deep_uninstall_target(app_query: str) -> Dict[str, Any]:
    """[1단계: 레지스트리 & 상주 프로세스·서비스·스케줄러·잔여 폴더 정밀 탐색]"""
    _ensure_care_dir()
    target_label, keywords, slug = _extract_target_app_profile(app_query)
    if not keywords:
        clarify_ko = (
            "👻 어떤 프로그램을 정리해 드릴까요?\n"
            "**\"어도비 지워줘\"**, **\"알약 삭제해줘\"**, **\"줌 깨끗하게 제거해줘\"**처럼 정리할 프로그램 이름을 함께 말씀해 주세요!"
        )
        return {
            "ok": True,
            "needsClarification": True,
            "targetAppQuery": app_query,
            "targetAppLabel": "정리할 프로그램 이름 확인 필요",
            "targetSlug": "",
            "matchedKeywords": [],
            "foundAny": False,
            "installedEntries": [],
            "runningProcesses": [],
            "services": [],
            "scheduledTasks": [],
            "startupEntries": [],
            "residualFolders": [],
            "runningProcessCount": 0,
            "serviceAndTaskCount": 0,
            "totalResidualBytes": 0,
            "totalResidualMb": 0.0,
            "estimatedRamMb": 0.0,
            "summaryBadge": "삭제 대상 프로그램 이름을 알려주세요",
            "honestBriefingKo": clarify_ko,
        }

    kw_lows = [k.lower() for k in keywords if k]
    installed_entries: List[Dict[str, Any]] = []
    running_processes: List[Dict[str, Any]] = []
    matched_services: List[Dict[str, Any]] = []
    scheduled_tasks: List[str] = []
    startup_entries: List[Dict[str, Any]] = []
    residual_folders: List[Dict[str, Any]] = []

    if sys.platform == "win32":
        import winreg

        uninstall_roots = [
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", "HKLM"),
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall", "HKLM_WOW64"),
            (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", "HKCU"),
        ]
        seen_names = set()
        for hive, subkey_path, hive_label in uninstall_roots:
            try:
                with winreg.OpenKey(hive, subkey_path, 0, winreg.KEY_READ) as root_key:
                    num_sub = winreg.QueryInfoKey(root_key)[0]
                    for idx in range(num_sub):
                        try:
                            sub_name = winreg.EnumKey(root_key, idx)
                            with winreg.OpenKey(root_key, sub_name, 0, winreg.KEY_READ) as sk:
                                def _rv(vname: str) -> str:
                                    try:
                                        val, _ = winreg.QueryValueEx(sk, vname)
                                        return str(val or "").strip()
                                    except Exception:
                                        return ""

                                disp = _rv("DisplayName")
                                pub = _rv("Publisher")
                                uninst = _rv("UninstallString")
                                quiet_uninst = _rv("QuietUninstallString")
                                inst_loc = _rv("InstallLocation")
                                combined = f"{disp} {pub} {inst_loc} {sub_name}".lower()
                                if not disp or _is_protected_system_entity(combined):
                                    continue
                                if any(k in combined for k in kw_lows):
                                    dedup_key = disp.lower()
                                    if dedup_key not in seen_names:
                                        seen_names.add(dedup_key)
                                        installed_entries.append({
                                            "displayName": disp,
                                            "publisher": pub,
                                            "uninstallString": uninst,
                                            "quietUninstallString": quiet_uninst,
                                            "installLocation": inst_loc,
                                            "registryKey": f"{hive_label}\\{subkey_path}\\{sub_name}",
                                        })
                        except Exception:
                            continue
            except Exception:
                continue

        run_roots = [
            (winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", "HKCU"),
            (winreg.HKEY_LOCAL_MACHINE, r"Software\Microsoft\Windows\CurrentVersion\Run", "HKLM"),
            (winreg.HKEY_LOCAL_MACHINE, r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run", "HKLM_WOW64"),
        ]
        for hive, rpath, hlabel in run_roots:
            try:
                with winreg.OpenKey(hive, rpath, 0, winreg.KEY_READ) as rk:
                    num_vals = winreg.QueryInfoKey(rk)[1]
                    for idx in range(num_vals):
                        try:
                            vname, vdata, _ = winreg.EnumValue(rk, idx)
                            comb = f"{vname} {vdata}".lower()
                            if not _is_protected_system_entity(comb) and any(k in comb for k in kw_lows):
                                startup_entries.append({
                                    "name": str(vname),
                                    "command": str(vdata),
                                    "hive": hlabel,
                                    "regPath": rpath,
                                })
                        except Exception:
                            continue
            except Exception:
                continue

        my_pid = os.getpid()
        for pinfo in _iter_windows_processes_stdlib():
            try:
                pid = int(pinfo.get("pid") or 0)
                if pid <= 4 or pid == my_pid:
                    continue
                pname = str(pinfo.get("name") or "")
                pexe = str(pinfo.get("exe") or "")
                comb = f"{pname} {pexe}".lower()
                if _is_protected_system_entity(comb):
                    continue
                if any(k in comb for k in kw_lows):
                    running_processes.append({
                        "pid": pid,
                        "name": pname,
                        "exe": pexe,
                        "memoryMb": max(1.0, float(pinfo.get("memoryMb") or 1.0)),
                    })
            except Exception:
                continue

        try:
            proc_sc = subprocess.run(
                ["sc", "query", "state=", "all"],
                capture_output=True,
                text=True,
                encoding="oem",
                errors="replace",
                timeout=2.5,
                creationflags=CREATE_NO_WINDOW,
            )
            cur_svc = ""
            cur_disp = ""
            for line in (proc_sc.stdout or "").splitlines():
                ls = line.strip()
                if ls.startswith("SERVICE_NAME:"):
                    cur_svc = ls.split(":", 1)[1].strip()
                    cur_disp = cur_svc
                elif ls.startswith("DISPLAY_NAME:"):
                    cur_disp = ls.split(":", 1)[1].strip()
                elif ls.startswith("STATE") and cur_svc:
                    comb = f"{cur_svc} {cur_disp}".lower()
                    if not _is_protected_system_entity(comb) and any(k in comb for k in kw_lows):
                        matched_services.append({
                            "serviceName": cur_svc,
                            "displayName": cur_disp,
                            "isRunning": "RUNNING" in ls,
                        })
                    cur_svc = ""
        except Exception:
            pass

        try:
            proc_sch = subprocess.run(
                ["schtasks", "/query", "/fo", "CSV", "/nh"],
                capture_output=True,
                text=True,
                encoding="oem",
                errors="replace",
                timeout=2.5,
                creationflags=CREATE_NO_WINDOW,
            )
            seen_tasks = set()
            for line in (proc_sch.stdout or "").splitlines():
                parts = [p.strip('"') for p in line.split('","')]
                if not parts or not parts[0].startswith("\\"):
                    continue
                tname = parts[0]
                tlow = tname.lower()
                if tlow.startswith("\\microsoft\\"):
                    continue
                if not _is_protected_system_entity(tlow) and any(k in tlow for k in kw_lows):
                    if tname not in seen_tasks:
                        seen_tasks.add(tname)
                        scheduled_tasks.append(tname)
        except Exception:
            pass

        # 공식 언인스톨러가 지우지 못하고 남기는 캐시·데이터 루트만 체크박스로 제시 (Program Files 허위 체크박스 방지)
        candidate_roots = [
            Path(os.environ.get("CommonProgramFiles", r"C:\Program Files\Common Files")),
            Path(os.environ.get("CommonProgramFiles(x86)", r"C:\Program Files (x86)\Common Files")),
            Path(os.environ.get("PROGRAMDATA", r"C:\ProgramData")),
            LOCAL_APPDATA,
            Path(os.environ.get("APPDATA", os.path.expanduser(r"~\AppData\Roaming"))),
        ]
        vendor_umbrella_names = {"estsoft", "ahnlab", "adobe", "autodesk", "hancom", "raonsecure", "inca", "zoom"}
        seen_dirs = set()
        for croot in candidate_roots:
            if not croot.exists():
                continue
            try:
                with os.scandir(croot) as it:
                    for entry in it:
                        if not entry.is_dir(follow_symlinks=False):
                            continue
                        dname_low = entry.name.lower()
                        if _is_protected_system_entity(dname_low):
                            continue
                        full_p = Path(entry.path).resolve()
                        p_str = str(full_p)
                        if _is_protected_personal_data_dir(entry.name, p_str):
                            continue
                        if any(k in dname_low for k in kw_lows):
                            if p_str.lower() not in seen_dirs:
                                seen_dirs.add(p_str.lower())
                                sz = _calc_dir_size_fast(full_p)
                                residual_folders.append({
                                    "path": p_str,
                                    "name": entry.name,
                                    "sizeBytes": sz,
                                    "sizeMb": round(sz / (1024 * 1024), 2),
                                    "isSafeCacheOrData": True,
                                })
                        elif dname_low in vendor_umbrella_names:
                            # ESTsoft\ALZip 처럼 제조사 상위 폴더 아래 2단계 앱 폴더까지 정밀 탐색
                            try:
                                with os.scandir(full_p) as sub_it:
                                    for sub_e in sub_it:
                                        if not sub_e.is_dir(follow_symlinks=False):
                                            continue
                                        sub_low = sub_e.name.lower()
                                        sub_full = Path(sub_e.path).resolve()
                                        sub_str = str(sub_full)
                                        if _is_protected_system_entity(sub_low) or _is_protected_personal_data_dir(sub_e.name, sub_str):
                                            continue
                                        if any(k in sub_low for k in kw_lows) and sub_str.lower() not in seen_dirs:
                                            seen_dirs.add(sub_str.lower())
                                            sz2 = _calc_dir_size_fast(sub_full)
                                            residual_folders.append({
                                                "path": sub_str,
                                                "name": f"{entry.name}\\{sub_e.name}",
                                                "sizeBytes": sz2,
                                                "sizeMb": round(sz2 / (1024 * 1024), 2),
                                                "isSafeCacheOrData": True,
                                            })
                            except Exception:
                                pass
            except Exception:
                continue

    total_residual_bytes = sum(int(f.get("sizeBytes") or 0) for f in residual_folders)
    total_residual_mb = round(total_residual_bytes / (1024 * 1024), 1)
    estimated_ram_mb = round(sum(float(p.get("memoryMb") or 0) for p in running_processes), 1)
    svc_and_task_count = len(matched_services) + len(scheduled_tasks) + len(startup_entries)
    found_any = bool(
        installed_entries or running_processes or matched_services or scheduled_tasks or startup_entries or residual_folders
    )

    if found_any:
        briefing_ko = (
            f"🧹 **[{target_label} — 심층 제거 사전 검진 완료]**\n"
            f"• **발견된 상주 프로세스**: **{len(running_processes)}개** (점유 메모리 약 {estimated_ram_mb}MB)\n"
            f"• **부활형 서비스·스케줄러·시작프로그램**: **{svc_and_task_count}개** "
            f"(서비스 {len(matched_services)} · 스케줄러 {len(scheduled_tasks)} · 시작Run {len(startup_entries)})\n"
            f"• **설치 엔트리 및 잔여 캐시 폴더**: 설치 항목 **{len(installed_entries)}건** · 잔여 폴더 **{len(residual_folders)}곳 ({total_residual_mb}MB)**\n\n"
            f"마음대로 영구 삭제하지 않습니다! 아래 버튼을 누르시거나 채팅창에 **\"응 진행해\"**라고 입력하시면, "
            f"공식 언인스톨러 실행 후 남은 잔여 캐시 폴더는 **평소 쓰시는 Windows [휴지통]으로 안전하게 이동**시켜 언제든 휴지통에서 되살리실 수 있습니다."
        )
    else:
        briefing_ko = (
            f"👻 **[{target_label}]** 관련 레지스트리·상주 프로세스·서비스·스케줄러·잔여 폴더를 전수 스캔했으나, "
            f"현재 내 PC에 남아 있는 흔적이 **0건**으로 이미 완벽히 깨끗한 상태입니다!"
        )

    return {
        "ok": True,
        "targetAppQuery": app_query,
        "targetAppLabel": target_label,
        "targetSlug": slug,
        "matchedKeywords": kw_lows,
        "foundAny": found_any,
        "installedEntries": installed_entries,
        "runningProcesses": running_processes,
        "services": matched_services,
        "scheduledTasks": scheduled_tasks,
        "startupEntries": startup_entries,
        "residualFolders": residual_folders,
        "runningProcessCount": len(running_processes),
        "serviceAndTaskCount": svc_and_task_count,
        "totalResidualBytes": total_residual_bytes,
        "totalResidualMb": total_residual_mb,
        "estimatedRamMb": estimated_ram_mb,
        "summaryBadge": (
            f"상주 프로세스 {len(running_processes)}개 / 서비스·스케줄러 {svc_and_task_count}개 / 잔여 폴더 {total_residual_mb}MB"
        ),
        "honestBriefingKo": briefing_ko,
    }


def _normalize_msi_uninstall_cmd(raw_cmd: str) -> str:
    """MsiExec.exe /I{GUID} 형태는 복구 설치가 아닌 실제 제거(/X{GUID})로 정확히 변환합니다."""
    cmd = (raw_cmd or "").strip()
    if not cmd:
        return ""
    if re.match(r'^"?msiexec(\.exe)?"?\b', cmd, flags=re.IGNORECASE):
        cmd = re.sub(r'(?i)(/\s*i)(\s*\{[0-9a-fA-F\-]+\})', r'/X\2', cmd)
        if "/passive" not in cmd.lower() and "/qn" not in cmd.lower() and "/qb" not in cmd.lower():
            cmd = f"{cmd} /passive"
        if "/norestart" not in cmd.lower():
            cmd = f"{cmd} /norestart"
    return cmd


def execute_deep_uninstall_target(
    app_query: str,
    invoke_official_uninstaller: bool = True,
    user_approval_text: str = "흔적까지 100% 심층 적출 실행",
    selected_folder_paths: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    [심층 제거 실행 — 영구 삭제(rmtree) 전면 금지 · Windows 기본 휴지통 직행]
    1) 상주 프로세스 종료 -> 2) 공식 언인스톨러 실행 및 종료 대기(파일 락 해제) ->
    3) 부활 스케줄러·시작 Run 정리 -> 4) 남은 잔여 캐시 폴더를 Windows OS [휴지통]으로 안전 이동!
    """
    _ensure_care_dir()
    AUDIT_LOG_DIR.mkdir(parents=True, exist_ok=True)

    scan = scan_deep_uninstall_target(app_query)
    if scan.get("needsClarification"):
        return {
            "ok": False,
            "needsClarification": True,
            "error": "TARGET_APP_QUERY_EMPTY",
            "reportKo": str(scan.get("honestBriefingKo") or ""),
        }

    slug = str(scan.get("targetSlug") or "app")
    target_label = str(scan.get("targetAppLabel") or app_query)
    ts_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    audit_log_path = AUDIT_LOG_DIR / f"uninstall_{slug}_{ts_str}.json"

    killed_procs: List[str] = []
    disabled_services: List[str] = []
    deleted_tasks: List[str] = []
    removed_startups: List[str] = []
    recycled_folders: List[str] = []
    reclaimed_bytes = 0
    uninstaller_triggered: List[str] = []

    allowed_folder_set = (
        {str(Path(p).resolve()).lower() for p in selected_folder_paths if p}
        if selected_folder_paths is not None
        else None
    )

    if sys.platform == "win32":
        # 1) 실행 중인 상주 프로세스 종료
        for pinfo in scan.get("runningProcesses", []):
            pid = pinfo.get("pid")
            pname = str(pinfo.get("name") or pid)
            if not pid:
                continue
            try:
                r_k = subprocess.run(
                    ["taskkill", "/F", "/PID", str(pid), "/T"],
                    capture_output=True,
                    timeout=2.5,
                    creationflags=CREATE_NO_WINDOW,
                )
                if r_k.returncode == 0:
                    killed_procs.append(f"{pname}(PID {pid})")
            except Exception:
                pass

        # 2) 대상 앱 서비스 안전 정지 (웹보안 화이트리스트는 승격 헬퍼로, 일반 앱 서비스는 보호목록 검증 후 정지)
        svc_names = [str(s.get("serviceName") or "") for s in scan.get("services", []) if s.get("serviceName")]
        if svc_names:
            elev_res = execute_elevated_service_control("sleep", svc_names, allow_uac_prompt=True)
            disabled_services = list(elev_res.get("processedServices") or [])
            already_done = {x.lower() for x in disabled_services}
            for s_nm in svc_names:
                if s_nm.lower() in already_done or _is_protected_system_entity(s_nm.lower()):
                    continue
                try:
                    r_st = subprocess.run(["sc", "stop", s_nm], capture_output=True, timeout=3.0, creationflags=CREATE_NO_WINDOW)
                    subprocess.run(["sc", "config", s_nm, "start=", "demand"], capture_output=True, timeout=3.0, creationflags=CREATE_NO_WINDOW)
                    if r_st.returncode == 0:
                        disabled_services.append(s_nm)
                except Exception:
                    pass

        # 3) 공식 언인스톨러 실행 (관리자 권한 runas 승격 직결 — Access is denied 방지 · MsiExec /I -> /X 변환 및 종료 대기)
        if invoke_official_uninstaller:
            for entry in scan.get("installedEntries", [])[:5]:
                raw_cmd = str(entry.get("quietUninstallString") or entry.get("uninstallString") or "").strip()
                disp = str(entry.get("displayName") or "")
                cmd = _normalize_msi_uninstall_cmd(raw_cmd)
                if not cmd:
                    continue
                try:
                    is_msi = cmd.lower().startswith("msiexec") or '"msiexec' in cmd.lower()
                    if is_running_as_admin():
                        proc_u = subprocess.Popen(
                            cmd,
                            shell=True,
                            creationflags=(CREATE_NO_WINDOW if is_msi else 0),
                        )
                        uninstaller_triggered.append(disp or cmd[:40])
                        try:
                            proc_u.wait(timeout=25.0)
                        except subprocess.TimeoutExpired:
                            pass
                    else:
                        # 일반 권한 데몬에서는 ShellExecuteW("runas")로 관리자 권한 UAC 승격 실행하여 HKLM/서비스 삭제 권한 확보
                        parts = _split_windows_cmdline(cmd)
                        exe_part = parts[0] if parts else "cmd.exe"
                        if parts and len(parts) > 1:
                            arg_part = subprocess.list2cmdline(parts[1:])
                        elif not parts:
                            arg_part = f"/c {cmd}"
                        else:
                            arg_part = ""
                        ret_uac = int(
                            ctypes.windll.shell32.ShellExecuteW(
                                None,
                                "runas",
                                exe_part,
                                arg_part,
                                None,
                                0 if is_msi else 1,
                            )
                        )
                        if ret_uac > 32:
                            uninstaller_triggered.append(f"{disp or exe_part} (관리자 권한 실행)")
                            time.sleep(2.5)
                        else:
                            # UAC 취소 또는 실행 불가 시 일반 권한 폴백
                            proc_u = subprocess.Popen(
                                cmd,
                                shell=True,
                                creationflags=(CREATE_NO_WINDOW if is_msi else 0),
                            )
                            uninstaller_triggered.append(disp or cmd[:40])
                            try:
                                proc_u.wait(timeout=15.0)
                            except subprocess.TimeoutExpired:
                                pass
                except Exception:
                    continue

        # 4) 부활형 작업 스케줄러 안전 비활성화 (/delete 영구삭제 대신 /disable로 언제든 복원 가능 보장)
        du_restore_ops: List[Dict[str, Any]] = []
        for tname in scan.get("scheduledTasks", []):
            try:
                r_dis = subprocess.run(
                    ["schtasks", "/change", "/tn", tname, "/disable"],
                    capture_output=True,
                    timeout=2.5,
                    creationflags=CREATE_NO_WINDOW,
                )
                if r_dis.returncode == 0:
                    deleted_tasks.append(f"{tname}(비활성화)")
                    du_restore_ops.append({
                        "op": "ADWARE_TASK_DISABLE",
                        "name": f"스케줄러:{tname.lstrip(chr(92))}",
                        "targetKind": "task",
                        "target": tname.lstrip("\\"),
                        "fromPath": "작업 스케줄러",
                        "toPath": "비활성화(Disabled)",
                        "rolledBack": False,
                    })
            except Exception:
                continue

        # 5) 시작프로그램(HKCU/HKLM Run) 백업 후 제거 ([복원 기록] 원복 보장)
        import winreg

        for st_item in scan.get("startupEntries", []):
            vname = str(st_item.get("name") or "")
            rpath = str(st_item.get("regPath") or "")
            cmd_val = str(st_item.get("command") or "")
            hive_str = str(st_item.get("hive") or "HKCU")
            hive = winreg.HKEY_CURRENT_USER if hive_str == "HKCU" else winreg.HKEY_LOCAL_MACHINE
            if not vname or not rpath:
                continue
            try:
                if not cmd_val:
                    with winreg.OpenKey(hive, rpath, 0, winreg.KEY_READ) as rk_r:
                        cmd_val, _ = winreg.QueryValueEx(rk_r, vname)
                with winreg.CreateKey(winreg.HKEY_CURRENT_USER, r"Software\Merlin\DisabledStartupBackup") as bk_k:
                    winreg.SetValueEx(bk_k, f"{hive_str}__{vname}", 0, winreg.REG_SZ, str(cmd_val or ""))
                with winreg.OpenKey(hive, rpath, 0, winreg.KEY_SET_VALUE) as wk:
                    winreg.DeleteValue(wk, vname)
                    removed_startups.append(vname)
                    du_restore_ops.append({
                        "op": "REGISTRY_RUN_RESTORE",
                        "name": vname,
                        "tag": hive_str,
                        "runSubkey": rpath,
                        "command": str(cmd_val or ""),
                        "rolledBack": False,
                    })
            except Exception:
                continue

        # 6) 남은 잔여 캐시 폴더를 영구 삭제(rmtree) 대신 Windows OS [휴지통]으로 안전 이동!
        for finfo in scan.get("residualFolders", []):
            fpath = Path(str(finfo.get("path") or ""))
            fsize = int(finfo.get("sizeBytes") or 0)
            if not fpath.exists():
                continue
            resolved_str = str(fpath.resolve())
            if allowed_folder_set is not None and resolved_str.lower() not in allowed_folder_set:
                continue
            if _is_protected_system_entity(resolved_str) or _is_protected_personal_data_dir(fpath.name, resolved_str):
                continue
            if len(fpath.parts) < 3 or not finfo.get("isSafeCacheOrData"):
                continue
            rb_res = _send_path_to_windows_recycle_bin(fpath)
            if rb_res.get("ok"):
                recycled_folders.append(resolved_str)
                reclaimed_bytes += fsize

        if du_restore_ops:
            try:
                import ghosti_safe_ops as _safe_du
                _safe_du.add_restore_point(
                    summary=f"{target_label} 심층 제거 사전 스냅샷",
                    user_prompt=app_query,
                    preview=f"{target_label} 스케줄러·시작프로그램 정리 기록",
                    operations=du_restore_ops,
                    user_approval_text=user_approval_text,
                )
            except Exception:
                pass

    audit_payload = {
        "createdAt": datetime.datetime.now().isoformat(),
        "targetAppQuery": app_query,
        "targetAppLabel": target_label,
        "userApprovalTypedText": user_approval_text,
        "recycledFolders": recycled_folders,
        "killedProcesses": killed_procs,
        "disabledServices": disabled_services,
        "deletedTasks": deleted_tasks,
        "removedStartups": removed_startups,
        "uninstallerTriggered": uninstaller_triggered,
    }
    try:
        audit_log_path.write_text(json.dumps(audit_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass

    reclaimed_mb = round(reclaimed_bytes / (1024 * 1024), 1)
    reclaimed_ram_mb = round(float(scan.get("estimatedRamMb") or 0.0), 1) if killed_procs else 0.0
    total_removed_triggers = len(killed_procs) + len(disabled_services) + len(deleted_tasks) + len(removed_startups)

    report_ko = (
        f"🔥 **[{target_label} — 심층 제거 완료 보고]**\n"
        f"• **정리된 상주 프로세스·스케줄러·서비스**: 총 **{total_removed_triggers}개** "
        f"(프로세스 종료 {len(killed_procs)}개 · 서비스 절전 {len(disabled_services)}개 · 스케줄러/시작Run 제거 {len(deleted_tasks) + len(removed_startups)}개)\n"
        f"• **Windows [휴지통]으로 안전 이동한 잔여 캐시 폴더**: **{len(recycled_folders)}곳 ({reclaimed_mb}MB)** · 상주 메모리 **{reclaimed_ram_mb}MB** 회수\n"
        f"• **안심 복구 안내**: 지운 잔여 폴더는 별도 격리함 없이 평소 쓰시는 바탕화면 **[휴지통]**에 그대로 들어 있어 언제든 우클릭 `[복원]`으로 되살릴 수 있습니다!"
    )
    if uninstaller_triggered:
        report_ko += f"\n• **공식 언인스톨러 실행 완료**: {', '.join(uninstaller_triggered)}"

    return {
        "ok": True,
        "targetAppLabel": target_label,
        "snapshotFile": str(audit_log_path),
        "killedProcessCount": len(killed_procs),
        "killedProcesses": killed_procs,
        "disabledServiceCount": len(disabled_services),
        "disabledServices": disabled_services,
        "deletedTaskCount": len(deleted_tasks),
        "deletedTasks": deleted_tasks,
        "removedStartupCount": len(removed_startups),
        "removedStartups": removed_startups,
        "cleanedFolderCount": len(recycled_folders),
        "cleanedFolders": recycled_folders,
        "movedToWindowsRecycleBin": True,
        "uninstallerTriggered": uninstaller_triggered,
        "reclaimedBytes": reclaimed_bytes,
        "reclaimedMb": reclaimed_mb,
        "reclaimedRamMb": reclaimed_ram_mb,
        "totalRemovedTriggers": total_removed_triggers,
        "reportKo": report_ko,
    }



# ============================================================================
# 4-B. [고클린 완전 대체] 시작프로그램 개별 ON/OFF 매니저 & 설치 프로그램 전체 목록 브라우저
# ============================================================================
STARTUP_BACKUP_SUBKEY = r"Software\Merlin\DisabledStartupBackup"


def list_startup_programs() -> Dict[str, Any]:
    """현재 활성화된 시작프로그램(Run 레지스트리 + 시작프로그램 폴더)과 귀신비서가 꺼둔(백업된) 항목을 한눈에 반환합니다."""
    if sys.platform != "win32" or winreg is None:
        return {"ok": False, "error": "WINDOWS_ONLY", "items": []}
    wl_data = load_security_whitelist(allow_remote_sync=False)
    drm_tokens = tuple(
        str(x).strip().lower()
        for x in list(wl_data.get("corporate_drm_never_touch", []))
        + ["merlin", "ghosti", "senstalk", "sundream", "securityhealth", "windefend", "msmpeng"]
        if str(x).strip()
    )
    items: List[Dict[str, Any]] = []
    seen_ids = set()

    run_sources = [
        (winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", "HKCU", "내 계정 시작프로그램"),
        (winreg.HKEY_LOCAL_MACHINE, r"Software\Microsoft\Windows\CurrentVersion\Run", "HKLM", "공용(PC 전체) 시작프로그램"),
        (winreg.HKEY_LOCAL_MACHINE, r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run", "HKLM_WOW64", "공용(32비트) 시작프로그램"),
    ]
    for root_h, sub_k, tag, loc_lbl in run_sources:
        try:
            with winreg.OpenKey(root_h, sub_k, 0, winreg.KEY_READ) as rk:
                idx = 0
                while True:
                    try:
                        vname, vval, _ = winreg.EnumValue(rk, idx)
                        idx += 1
                    except OSError:
                        break
                    nm = str(vname or "").strip()
                    cmd = str(vval or "").strip()
                    if not nm:
                        continue
                    item_id = f"{tag}::{nm}"
                    if item_id.lower() in seen_ids:
                        continue
                    seen_ids.add(item_id.lower())
                    comb = f"{nm} {cmd}".lower()
                    protected = any(t in comb for t in drm_tokens)
                    items.append({
                        "id": item_id,
                        "name": nm,
                        "command": cmd,
                        "tag": tag,
                        "runSubkey": sub_k,
                        "locationLabel": loc_lbl,
                        "enabled": True,
                        "isProtected": protected,
                        "requiresAdmin": tag != "HKCU",
                    })
        except OSError:
            continue

    # 귀신비서가 안전하게 꺼둔 백업 항목(다시 켜기 지원)
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, STARTUP_BACKUP_SUBKEY, 0, winreg.KEY_READ) as bk:
            idx = 0
            while True:
                try:
                    bname, bval, _ = winreg.EnumValue(bk, idx)
                    idx += 1
                except OSError:
                    break
                raw_b = str(bname or "")
                cmd_b = str(bval or "")
                tag_b, sep, orig_nm = raw_b.partition("__")
                if not sep or not orig_nm:
                    continue
                item_id = f"{tag_b}::{orig_nm}"
                if item_id.lower() in seen_ids:
                    continue
                seen_ids.add(item_id.lower())
                sub_k = (
                    r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run"
                    if tag_b == "HKLM_WOW64"
                    else r"Software\Microsoft\Windows\CurrentVersion\Run"
                )
                items.append({
                    "id": item_id,
                    "name": orig_nm,
                    "command": cmd_b,
                    "tag": tag_b,
                    "runSubkey": sub_k,
                    "locationLabel": "귀신비서가 잠시 꺼둠 (언제든 다시 켜기 가능)",
                    "enabled": False,
                    "isProtected": False,
                    "requiresAdmin": tag_b != "HKCU",
                })
    except OSError:
        pass

    items.sort(key=lambda x: (not x["enabled"], x["isProtected"], x["name"].lower()))
    return {
        "ok": True,
        "count": len(items),
        "enabledCount": sum(1 for x in items if x["enabled"]),
        "disabledCount": sum(1 for x in items if not x["enabled"]),
        "items": items,
    }


def toggle_startup_program(item_id: str, enable: bool, user_approval_text: str = "") -> Dict[str, Any]:
    """특정 시작프로그램 1개를 안전하게 켜거나(ON) 끕니다(OFF, 백업 보관 + 복원기록 등록)."""
    if sys.platform != "win32" or winreg is None:
        return {"ok": False, "error": "WINDOWS_ONLY"}
    tag, sep, vname = (item_id or "").strip().partition("::")
    if not sep or not vname or tag not in ("HKCU", "HKLM", "HKLM_WOW64"):
        return {"ok": False, "error": "INVALID_STARTUP_ID", "message": "올바른 시작프로그램 항목이 아닙니다."}
    sub_k = (
        r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run"
        if tag == "HKLM_WOW64"
        else r"Software\Microsoft\Windows\CurrentVersion\Run"
    )
    root_h = winreg.HKEY_CURRENT_USER if tag == "HKCU" else winreg.HKEY_LOCAL_MACHINE
    backup_val_name = f"{tag}__{vname}"

    if not enable:
        # OFF: 원본 명령 백업 후 Run에서 제거 (보호 대상 차단)
        wl_data = load_security_whitelist(allow_remote_sync=False)
        drm_tokens = tuple(
            str(x).strip().lower()
            for x in list(wl_data.get("corporate_drm_never_touch", []))
            + ["merlin", "ghosti", "senstalk", "sundream", "securityhealth", "windefend", "msmpeng"]
            if str(x).strip()
        )
        try:
            with winreg.OpenKey(root_h, sub_k, 0, winreg.KEY_READ) as rk_r:
                cmd_val, _ = winreg.QueryValueEx(rk_r, vname)
        except OSError:
            return {"ok": False, "error": "ENTRY_NOT_FOUND", "message": f"'{vname}' 항목이 이미 꺼져 있거나 존재하지 않습니다."}
        if any(t in f"{vname} {cmd_val}".lower() for t in drm_tokens):
            return {"ok": False, "error": "PROTECTED_STARTUP", "message": f"'{vname}' 항목은 시스템·보안 필수 모듈이어서 안전을 위해 끄지 않습니다."}
        try:
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, STARTUP_BACKUP_SUBKEY) as bk:
                winreg.SetValueEx(bk, backup_val_name, 0, winreg.REG_SZ, str(cmd_val))
            with winreg.OpenKey(root_h, sub_k, 0, winreg.KEY_SET_VALUE) as rk_w:
                winreg.DeleteValue(rk_w, vname)
        except PermissionError:
            return {
                "ok": False,
                "error": "ADMIN_REQUIRED",
                "message": f"'{vname}' 항목은 PC 전체(관리자) 시작프로그램이어서 표준 권한에서는 변경하지 않았습니다.",
            }
        except OSError as exc:
            return {"ok": False, "error": str(exc), "message": f"시작프로그램 변경 실패: {exc}"}
        try:
            import ghosti_safe_ops as _safe_st
            _safe_st.add_restore_point(
                summary=f"시작프로그램 '{vname}' 자동실행 끄기",
                user_prompt=f"시작프로그램 {vname} 꺼줘",
                preview=f"{vname} 자동실행 OFF (백업 보관)",
                operations=[{
                    "op": "REGISTRY_RUN_RESTORE",
                    "name": vname,
                    "tag": tag,
                    "runSubkey": sub_k,
                    "command": str(cmd_val),
                    "rolledBack": False,
                }],
                user_approval_text=user_approval_text or f"시작프로그램 {vname} 끄기",
            )
        except Exception:
            pass
        return {
            "ok": True,
            "id": item_id,
            "name": vname,
            "enabled": False,
            "message": f"✅ 부팅 시 자동 실행되던 '{vname}' 항목을 껐습니다! (언제든 같은 스위치로 다시 켤 수 있어요)",
        }
    else:
        # ON: 백업에서 읽어 다시 Run에 복원
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, STARTUP_BACKUP_SUBKEY, 0, winreg.KEY_READ) as bk_r:
                cmd_val, _ = winreg.QueryValueEx(bk_r, backup_val_name)
        except OSError:
            return {"ok": False, "error": "BACKUP_NOT_FOUND", "message": f"'{vname}' 항목의 백업 명령을 찾지 못했습니다."}
        try:
            with winreg.OpenKey(root_h, sub_k, 0, winreg.KEY_SET_VALUE) as rk_w:
                winreg.SetValueEx(rk_w, vname, 0, winreg.REG_SZ, str(cmd_val))
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, STARTUP_BACKUP_SUBKEY, 0, winreg.KEY_SET_VALUE) as bk_w:
                try:
                    winreg.DeleteValue(bk_w, backup_val_name)
                except OSError:
                    pass
        except PermissionError:
            return {
                "ok": False,
                "error": "ADMIN_REQUIRED",
                "message": f"'{vname}' 항목은 관리자 권한 영역이어서 복원하지 못했습니다.",
            }
        except OSError as exc:
            return {"ok": False, "error": str(exc), "message": f"시작프로그램 복원 실패: {exc}"}
        return {
            "ok": True,
            "id": item_id,
            "name": vname,
            "enabled": True,
            "message": f"🔄 '{vname}' 항목이 부팅 시 다시 켜지도록 원래대로 복원했습니다!",
        }


def list_installed_programs(filter_query: str = "", limit: int = 80) -> Dict[str, Any]:
    """내 PC에 설치된 전체 프로그램 목록(용량·설치일·제조사 포함)을 조회하여 이름을 몰라도 골라서 정리할 수 있게 합니다."""
    if sys.platform != "win32" or winreg is None:
        return {"ok": False, "error": "WINDOWS_ONLY", "items": []}
    q_low = (filter_query or "").strip().lower()
    uninstall_roots = [
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    ]
    seen_names = set()
    apps: List[Dict[str, Any]] = []
    for hive, subkey in uninstall_roots:
        try:
            with winreg.OpenKey(hive, subkey, 0, winreg.KEY_READ) as uk:
                sub_cnt = winreg.QueryInfoKey(uk)[0]
                for i in range(sub_cnt):
                    try:
                        sk_name = winreg.EnumKey(uk, i)
                        with winreg.OpenKey(uk, sk_name, 0, winreg.KEY_READ) as ak:
                            def _qv(v_nm: str) -> Any:
                                try:
                                    return winreg.QueryValueEx(ak, v_nm)[0]
                                except OSError:
                                    return None
                            if _qv("SystemComponent") == 1 or _qv("ParentKeyName"):
                                continue
                            disp = str(_qv("DisplayName") or "").strip()
                            uninst = str(_qv("UninstallString") or _qv("QuietUninstallString") or "").strip()
                            if not disp or not uninst:
                                continue
                            disp_low = disp.lower()
                            if disp_low in seen_names:
                                continue
                            if disp_low.startswith(("kb", "security update for", "update for microsoft")):
                                continue
                            pub = str(_qv("Publisher") or "").strip()
                            ver = str(_qv("DisplayVersion") or "").strip()
                            inst_dt = str(_qv("InstallDate") or "").strip()
                            est_kb = _qv("EstimatedSize")
                            size_mb = round(int(est_kb) / 1024.0, 1) if isinstance(est_kb, int) and est_kb > 0 else 0.0
                            if q_low and q_low not in disp_low and q_low not in pub.lower():
                                continue
                            seen_names.add(disp_low)
                            is_prot = _is_protected_system_entity(disp_low) or any(
                                x in disp_low for x in ("merlin", "ghosti", "senstalk", "sundream")
                            )
                            apps.append({
                                "name": disp,
                                "publisher": pub,
                                "version": ver,
                                "installDate": (
                                    f"{inst_dt[:4]}-{inst_dt[4:6]}-{inst_dt[6:8]}"
                                    if len(inst_dt) == 8 and inst_dt.isdigit()
                                    else inst_dt
                                ),
                                "sizeMb": size_mb,
                                "isProtected": is_prot,
                            })
                    except OSError:
                        continue
        except OSError:
            continue

    apps.sort(key=lambda x: (-x["sizeMb"], x["name"].lower()))
    total_cnt = len(apps)
    return {
        "ok": True,
        "totalCount": total_cnt,
        "items": apps[: max(10, min(200, int(limit or 80)))],
    }


# ============================================================================
# 5. Try-Except Firewall 단일 게이트웨이 디스패처 & 알집 동급 암호 입력창 / CLI 엔트리
# ============================================================================
READONLY_CARE_ACTIONS = {
    "status",
    "startup-list",
    "startup_list",
    "installed-apps-list",
    "installed_apps_list",
    "security-status",
    "security_services_status",
    "security-services/status",
    "guardian-history",
    "guardian_history",
    "defender-history",
    "defender/history",
    "explorer-selected",
    "explorer_selected",
    "disk-hog-scan",
    "disk_hog_scan",
    "security-2tier-scan",
    "security_2tier_scan",
    "desktop-detail-scan",
    "desktop_detail_scan",
    "desktop-system-icons",
    "desktop_system_icons",
    "hidden-rats-scan",
    "hidden_rats_scan",
}


def handle_care_suite_request(action: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """메인 데몬(merlin_z_core_daemon.py)에서 호출되는 방화벽 격리 진입점."""
    data = payload or {}
    act = (action or "status").strip().lower()
    try:
        if act in ("status", "security-status", "security_services_status", "security-services/status"):
            return get_security_services_status()
        if act in ("sleep", "security-sleep", "sleep_security_services", "security-services/sleep"):
            return sleep_security_services(explicit_opt_in=True, allow_uac_prompt=True)
        if act in ("wake", "security-wake", "wake_security_services", "security-services/wake"):
            return wake_security_services(reason=str(data.get("reason") or "manual_emergency_switch"))
        if act in (
            "restore-default",
            "security-restore",
            "restore_security_services_default",
            "security-services/restore-default",
            "security-services/restore",
        ):
            return restore_security_services_default(allow_uac_prompt=True)
        if act in ("sync-whitelist", "sync_whitelist"):
            wl = load_security_whitelist(allow_remote_sync=True)
            return {"ok": True, "version": wl.get("version"), "synced": True}
        if act in ("archive/context-menu/ensure", "context-menu-ensure", "register-context-menu"):
            return register_explorer_context_menu()
        if act in ("archive/context-menu/remove", "unregister-context-menu"):
            return unregister_explorer_context_menu()
        if act in ("peek-archive", "peek_archive", "archive/peek"):
            return {
                "ok": False,
                "sealedArchiveRespect": True,
                "error": "SEALED_ARCHIVE_RESPECT_NO_PRE_PEEK",
                "message": "귀신같이는 유저가 직접 풀기 전까지 압축파일 내부를 미리 열어보지 않습니다(봉인 존중 원칙).",
            }
        if act in ("extract-archive", "extract_archive", "smart-unzip", "archive/extract"):
            return smart_extract_archive(
                archive_path=str(data.get("path") or data.get("archivePath") or ""),
                password=data.get("password"),
            )
        if act in ("create-zip", "create_zip", "smart-zip", "archive/zip"):
            raw_paths = data.get("paths")
            if isinstance(raw_paths, list) and raw_paths:
                return smart_create_zip([str(x) for x in raw_paths if x])
            return smart_create_zip(
                target_path=str(data.get("path") or data.get("targetPath") or ""),
            )
        if act in ("open-downloads", "open_downloads"):
            dl_dir = _get_downloads_dir()
            dl_archives = _count_downloads_archive_files()
            latest_path = dl_archives.get("latestPath") or ""
            latest_name = dl_archives.get("latestFileName") or ""
            if sys.platform == "win32":
                try:
                    import merlin_z_core_os as _zos

                    target_p = Path(latest_path) if (latest_path and Path(latest_path).exists()) else dl_dir
                    if target_p.exists():
                        _zos.open_file_location_on_interactive_desktop(target_p, mode="open_file_location")
                except Exception:
                    if latest_path and Path(latest_path).exists():
                        subprocess.Popen(["explorer.exe", f"/select,{latest_path}"])
                    elif dl_dir.exists() and hasattr(os, "startfile"):
                        os.startfile(str(dl_dir))
            return {
                "ok": True,
                "path": str(dl_dir),
                "selectedFile": latest_name,
                "selectedPath": latest_path,
                "downloadsArchiveCount": dl_archives["count"],
                "downloadsArchiveThresholdMet": dl_archives["thresholdMet"],
            }
        if act in ("open-default-apps", "open_default_apps"):
            if sys.platform == "win32" and hasattr(os, "startfile"):
                try:
                    os.startfile("ms-settings:defaultapps")
                except Exception:
                    pass
            return {"ok": True, "opened": "ms-settings:defaultapps"}
        if act in ("explorer-selected", "explorer_selected"):
            return {"ok": True, "selectedPaths": get_explorer_selected_paths_non_destructive()}
        if act in ("amsi-scan", "amsi_scan", "defender/scan"):
            return scan_file_with_defender_amsi(
                file_path=str(data.get("path") or data.get("filePath") or ""),
                source=str(data.get("source") or "manual"),
            )
        if act in ("guardian-history", "guardian_history", "defender-history", "defender/history"):
            return get_defender_guardian_history(
                days=int(data.get("days") or 30),
                limit=int(data.get("limit") or 30),
            )
        if act in ("deep-uninstall/scan", "deep-uninstall-scan", "deep_uninstall_scan"):
            return scan_deep_uninstall_target(
                app_query=str(data.get("appQuery") or data.get("query") or data.get("app") or ""),
            )
        if act in ("deep-uninstall/execute", "deep-uninstall-execute", "deep_uninstall_execute"):
            sel_folders = data.get("selectedFolders")
            return execute_deep_uninstall_target(
                app_query=str(data.get("appQuery") or data.get("query") or data.get("app") or ""),
                invoke_official_uninstaller=bool(data.get("invokeOfficialUninstaller", True)),
                user_approval_text=str(data.get("userApprovalTypedText") or "흔적까지 100% 심층 적출 실행"),
                selected_folder_paths=([str(x) for x in sel_folders] if isinstance(sel_folders, list) else None),
            )
        if act in ("startup-list", "startup_list", "startup/list"):
            return list_startup_programs()
        if act in ("startup-toggle", "startup_toggle", "startup/toggle"):
            return toggle_startup_program(
                item_id=str(data.get("id") or data.get("itemId") or ""),
                enable=bool(data.get("enable", False)),
                user_approval_text=str(data.get("userApprovalTypedText") or ""),
            )
        if act in ("installed-apps-list", "installed_apps_list", "apps/list"):
            return list_installed_programs(
                filter_query=str(data.get("query") or data.get("filter") or ""),
                limit=int(data.get("limit") or 80),
            )
        try:
            from plugins import plugin_ghosti_agent_care as _ag_care
            delegated_agent = _ag_care.handle_agent_care_action(act, data)
            if delegated_agent is not None:
                return delegated_agent
        except Exception as exc_ag:
            return {"ok": False, "error": f"AGENT_CARE_ERROR: {exc_ag}"}
        return {"ok": False, "error": f"UNKNOWN_CARE_SUITE_ACTION: {action}"}
    except Exception as exc:
        return {
            "ok": False,
            "isolatedFirewall": True,
            "error": f"CARE_SUITE_ISOLATED_ERROR: {exc}",
        }


_CARE_WATCHER_STARTED: bool = False


def start_care_suite_background_watchers() -> None:
    """
    [merlin_z_core_daemon.py 내장 무소음 워처 — 평시 CPU 0.0%]
    1) 데몬 기동 즉시 더블클릭 ProgID(Ghosti.Archive) + 탐색기 일반 우클릭 메뉴 보장 등록
    2) 1.5초 주기 포그라운드 창 제목 체크 ➔ 동의된 유저에 한해 은행·홈택스 창 진입 즉시 선행 기상 & 모든 창 확인 후 15분 뒤 절전
    3) 6.0초 주기 공식 Downloads 폴더 mtime 체크 ➔ 신규 다운로드 완료 파일 무소음 AMSI 검문 (위협 알림은 별도 데몬 스레드로 비차단 표시!)
    """
    global _CARE_WATCHER_STARTED
    if _CARE_WATCHER_STARTED or sys.platform != "win32":
        return
    _CARE_WATCHER_STARTED = True

    def _watcher_loop() -> None:
        try:
            register_explorer_context_menu()
        except Exception:
            pass
        try:
            from plugins import plugin_ghosti_agent_care as _ag_care
            _ag_care.sweep_disabled_pup_remnants_to_recycle()
            _ag_care.cleanup_legacy_duplicate_merlin_daemons()
        except Exception:
            pass

        u32 = ctypes.windll.user32
        title_buf = ctypes.create_unicode_buffer(512)
        dl_dir = _get_downloads_dir()
        last_dl_mtime = 0.0
        seen_dl_files: Dict[str, float] = {}
        try:
            if dl_dir.exists():
                last_dl_mtime = dl_dir.stat().st_mtime
                for entry in os.scandir(dl_dir):
                    if entry.is_file(follow_symlinks=False):
                        seen_dl_files[entry.path] = entry.stat(follow_symlinks=False).st_mtime
        except Exception:
            pass

        tick = 0
        while True:
            time.sleep(1.5)
            tick += 1
            try:
                fg_h = u32.GetForegroundWindow()
                if fg_h:
                    ln = u32.GetWindowTextW(fg_h, title_buf, 510)
                    if ln > 0:
                        check_window_title_for_prewake(title_buf.value)
            except Exception:
                pass

            if tick % 4 == 0:
                try:
                    dl_dir = _get_downloads_dir()
                    if dl_dir.exists():
                        cur_mtime = dl_dir.stat().st_mtime
                        if cur_mtime != last_dl_mtime:
                            last_dl_mtime = cur_mtime
                            now_s = time.time()
                            for entry in os.scandir(dl_dir):
                                if not entry.is_file(follow_symlinks=False):
                                    continue
                                ext_l = Path(entry.name).suffix.lower()
                                if ext_l in (".crdownload", ".part", ".tmp", ".partial"):
                                    continue
                                f_mt = entry.stat(follow_symlinks=False).st_mtime
                                if entry.path not in seen_dl_files and (now_s - f_mt) <= 300.0:
                                    seen_dl_files[entry.path] = f_mt
                                    res_scan = scan_file_with_defender_amsi(entry.path, source="download_auto")
                                    if res_scan.get("ok") and res_scan.get("status") != "CLEAN":
                                        alert_txt = (
                                            res_scan.get("alertMessage")
                                            or f"위험 요소가 감지되었습니다: {entry.name}"
                                        )
                                        threading.Thread(
                                            target=lambda msg=alert_txt: ctypes.windll.user32.MessageBoxW(
                                                0,
                                                msg,
                                                "👻 귀신같이 보안 경호 알림",
                                                0x00000030 | 0x00040000,
                                            ),
                                            daemon=True,
                                        ).start()
                                else:
                                    seen_dl_files[entry.path] = f_mt
                except Exception:
                    pass

    threading.Thread(target=_watcher_loop, name="GhostiCareSuiteWatcher", daemon=True).start()


def _prompt_archive_password_tk(
    archive_name: str,
    error_message: str = "",
    parent_win: Any = None,
) -> Optional[str]:
    """
    [알집 동일 UX] 암호 걸린 압축파일(.zip/.7z/.rar, 헤더 암호화 포함) 열람 시:
    - 오입력 시 창을 닫아버리지 않고 상단에 빨간 안내 문구를 띄워 재입력을 유도합니다.
    - [☑ 입력한 암호 글자 보기] 토글을 기본 제공합니다.
    """
    try:
        import tkinter as tk

        result_holder: List[Optional[str]] = [None]
        use_toplevel = parent_win is not None
        dlg = tk.Toplevel(parent_win) if use_toplevel else tk.Tk()
        dlg.title("👻 귀신같이 스마트 압축해제 — 비밀번호 입력")
        dlg.configure(bg="#0B1120")
        dlg.resizable(False, False)
        dlg.attributes("-topmost", True)
        if use_toplevel:
            try:
                dlg.transient(parent_win)
                dlg.grab_set()
            except Exception:
                pass

        w = 400
        h = 215 if error_message else 185
        sx = max(40, (dlg.winfo_screenwidth() - w) // 2)
        sy = max(40, (dlg.winfo_screenheight() - h) // 2)
        dlg.geometry(f"{w}x{h}+{sx}+{sy}")

        frm = tk.Frame(dlg, bg="#0B1120", padx=18, pady=14)
        frm.pack(fill="both", expand=True)

        short_name = archive_name if len(archive_name) <= 32 else (archive_name[:29] + "...")
        tk.Label(
            frm,
            text=f"🔒 암호가 걸린 압축파일입니다 ({short_name})",
            fg="#5EEAD4",
            bg="#0B1120",
            font=("Malgun Gothic", 9, "bold"),
            anchor="w",
        ).pack(fill="x", pady=(0, 6))

        err_lbl = tk.Label(
            frm,
            text=f"⚠️ {error_message}" if error_message else "",
            fg="#FCA5A5",
            bg="#0B1120",
            font=("Malgun Gothic", 8, "bold"),
            anchor="w",
        )
        if error_message:
            err_lbl.pack(fill="x", pady=(0, 6))

        ent = tk.Entry(
            frm,
            show="●",
            font=("Malgun Gothic", 10),
            bg="#1E293B",
            fg="#F8FAFC",
            insertbackground="#5EEAD4",
            relief="flat",
        )
        ent.pack(fill="x", ipady=6, pady=(0, 8))
        ent.focus_set()

        show_var = tk.BooleanVar(value=False)

        def _toggle_show() -> None:
            ent.config(show="" if show_var.get() else "●")

        chk = tk.Checkbutton(
            frm,
            text="입력한 암호 글자 보기",
            variable=show_var,
            command=_toggle_show,
            fg="#CBD5E1",
            bg="#0B1120",
            selectcolor="#1E293B",
            activebackground="#0B1120",
            activeforeground="#5EEAD4",
            font=("Malgun Gothic", 8),
            anchor="w",
            cursor="hand2",
        )
        chk.pack(fill="x", pady=(0, 10))

        def _submit(_e: Any = None) -> None:
            val = ent.get()
            if not val:
                err_lbl.config(text="⚠️ 비밀번호를 입력해 주세요.")
                if not err_lbl.winfo_ismapped():
                    err_lbl.pack(fill="x", pady=(0, 4), before=ent)
                ent.focus_set()
                return
            result_holder[0] = val
            dlg.destroy()

        def _cancel(_e: Any = None) -> None:
            result_holder[0] = None
            dlg.destroy()

        ent.bind("<Return>", _submit)
        ent.bind("<Escape>", _cancel)
        dlg.protocol("WM_DELETE_WINDOW", _cancel)

        btn_f = tk.Frame(frm, bg="#0B1120")
        btn_f.pack(fill="x")
        tk.Button(
            btn_f,
            text="확인 (압축 풀기)",
            command=_submit,
            bg="#2DD4BF",
            fg="#0B1120",
            font=("Malgun Gothic", 9, "bold"),
            relief="flat",
            padx=14,
            pady=4,
            cursor="hand2",
        ).pack(side="right")
        tk.Button(
            btn_f,
            text="취소",
            command=_cancel,
            bg="#1E293B",
            fg="#CBD5E1",
            font=("Malgun Gothic", 9),
            relief="flat",
            padx=12,
            pady=4,
            cursor="hand2",
        ).pack(side="right", padx=(0, 6))

        if use_toplevel:
            parent_win.wait_window(dlg)
        else:
            dlg.mainloop()
        return result_holder[0]
    except Exception:
        return None


def run_interactive_smart_unzip(
    archive_path: str,
    open_folder_on_success: bool = True,
    show_error_dialog: bool = True,
) -> Dict[str, Any]:
    """
    더블클릭·우클릭 실행 시 알집과 동일하게:
    - 암호가 걸려 있으면 암호 입력창을 띄우고,
    - 비밀번호가 틀리면 찌꺼기 없이 즉시 '비밀번호가 일치하지 않습니다' 경고와 함께 맞을 때까지(또는 취소할 때까지) 재입력받습니다!
    """
    res = smart_extract_archive(archive_path)
    while not res.get("ok") and res.get("needPassword"):
        err_msg = str(res.get("message") or "") if res.get("wrongPassword") else ""
        pwd = _prompt_archive_password_tk(Path(archive_path).name, error_message=err_msg)
        if pwd is None:
            return {"ok": False, "cancelled": True, "message": "암호 입력이 취소되었습니다."}
        res = smart_extract_archive(archive_path, password=pwd)

    if res.get("ok") and res.get("extractedFolder") and open_folder_on_success and sys.platform == "win32":
        try:
            os.startfile(res["extractedFolder"])
        except Exception:
            pass
    elif not res.get("ok") and not res.get("cancelled") and show_error_dialog and sys.platform == "win32":
        msg = str(res.get("message") or res.get("error") or "압축 해제 중 오류가 발생했습니다.")
        ctypes.windll.user32.MessageBoxW(0, msg, "👻 귀신같이 스마트 압축해제", 0x00000030)
    return res


def handle_care_cli_args(argv: Optional[List[str]] = None) -> bool:
    """
    merlin_z_core_daemon.py(단일 .exe 진입점) 및 단독 .py 실행 양쪽에서 공통으로 호출되는 고속 CLI 핸들러.
    케어 스위트 단발성 플래그가 감지되면 즉시 처리 후 True를 반환하여 데몬 기동 없이 0.1초 만에 종료하게 합니다.
    """
    raw_argv = list(sys.argv[1:] if argv is None else argv)
    care_flags = {
        "--smart-unzip",
        "--smart-zip",
        "--register-menu",
        "--unregister-menu",
        "--install-and-run-helper",
        "--run-elevated-helper",
    }
    if not any(arg in care_flags or any(arg.startswith(f + "=") for f in care_flags) for arg in raw_argv):
        return False

    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--smart-unzip", dest="smart_unzip", type=str, default="")
    parser.add_argument("--smart-zip", dest="smart_zip", type=str, default="")
    parser.add_argument("--register-menu", action="store_true")
    parser.add_argument("--unregister-menu", action="store_true")
    parser.add_argument("--install-and-run-helper", action="store_true")
    parser.add_argument("--run-elevated-helper", action="store_true")
    args, _ = parser.parse_known_args(raw_argv)

    if args.install_and_run_helper:
        _process_elevated_helper_queue(install_task_too=True)
        return True
    if args.run_elevated_helper:
        _process_elevated_helper_queue(install_task_too=False)
        return True
    if args.register_menu:
        print(json.dumps(register_explorer_context_menu(), ensure_ascii=False))
        return True
    if args.unregister_menu:
        print(json.dumps(unregister_explorer_context_menu(), ensure_ascii=False))
        return True
    headless_test = os.environ.get("GHOSTI_HEADLESS_TEST") == "1"
    if args.smart_unzip:
        ures = run_interactive_smart_unzip(
            args.smart_unzip,
            open_folder_on_success=not headless_test,
            show_error_dialog=not headless_test,
        )
        if headless_test:
            print(json.dumps(ures, ensure_ascii=False))
        return True
    if args.smart_zip:
        zres = _cli_smart_zip_coalesced(args.smart_zip)
        if zres is not None:
            if headless_test:
                print(json.dumps(zres, ensure_ascii=False))
            elif zres.get("ok") and zres.get("zipPath") and sys.platform == "win32":
                try:
                    subprocess.Popen(["explorer.exe", f"/select,{zres['zipPath']}"])
                except Exception:
                    pass
            elif not zres.get("ok") and sys.platform == "win32":
                msg = str(zres.get("message") or zres.get("error") or "ZIP 압축 생성 중 오류가 발생했습니다.")
                ctypes.windll.user32.MessageBoxW(0, msg, "👻 귀신같이 ZIP 압축 묶기", 0x00000030)
        return True
    return False


def _cli_main() -> None:
    handle_care_cli_args(sys.argv[1:])


if __name__ == "__main__":
    _cli_main()
