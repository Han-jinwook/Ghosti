#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[3귀신 전담 플러그인] plugin_paid_work_sdrive.py
- 담당 도메인:
  1) 💼 업무 공유 (S: 드라이브 · 월 9,900~29,000원 · 30일 무료체험):
     - 정식 배포 웹(ghosti.sundreamer.app) + PC 엔진(Z코어 :5199) 직결 윈도우 S: 드라이브 자동 마운트·해제
     - 실제 파일 읽기/쓰기/업로드/다운로드 및 방장↔팀원(?workRoom=...) 실시간 파일 동기화
     - 엑셀·한셀·워드·파워포인트(~$ 소유자 잠금 파일) + 아래아한글(.lck) + Win32 공유 잠금(ERROR_SHARING_VIOLATION) 실시간 감지
     - PDF·HWP·HWPX·DOCX·XLSX·PPTX·CSV·현장사진 본문/표 미리보기 추출 (인메모리 시그니처 캐싱으로 폴링 CPU 0.0%)
     - 영구 삭제 Tombstone 원장(work_sdrive_config.json) 및 UTC ISO 타임스탬프 일원화로 새로고침/동기화 재부활 0% 차단
- 헌법 가드레일: 본 플러그인 내부에 ONNX/AI 모델(InferenceSession 등) 직접 로드 영구 금지.
"""

from __future__ import annotations

import atexit
import base64
import csv
import ctypes
from datetime import datetime, timezone
import hashlib
import hmac
import io
import json
import mimetypes
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import threading
from collections import OrderedDict
from typing import Any, Callable, Dict, List, Optional, Tuple
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

PLUGIN_METADATA = {
    "id": "paid_work_sdrive",
    "name": "Ghosti Work S-Drive Native Bridge",
    "status": "ACTIVE",
    "driveLetter": "S:",
}

WORK_SDRIVE_ACTIONS = {
    "paid-work-status",
    "sdrive-status",
    "sdrive-check-mount",
    "sdrive-mount",
    "sdrive-unmount",
    "sdrive-list-files",
    "sdrive-upload-file",
    "sdrive-pull-sync",
    "sdrive-push-blob",
    "sdrive-pull-blob",
    "sdrive-delete-file",
    "sdrive-toggle-hide",
    "sdrive-sync-entitlement",
    "sdrive-tunnel-status",
    "sdrive-tunnel-start",
    "sdrive-tunnel-stop",
    "sdrive-night-power-save",
    "sdrive-backup-servers",
}

SUBFOLDER_SPECS: Tuple[Tuple[str, str], ...] = (
    ("contracts", "01_계약서_법무문서"),
    ("quotes", "02_견적서_엑셀문서"),
    ("tax", "03_세금계산서_회계증빙"),
    ("site", "04_현장시공_도면_미디어"),
)

_LEGACY_VITE_MOCK_REL_PATHS = {
    "01_계약서_법무문서/2026_성수동_사옥인테리어_표준도급계약서_최종.txt",
    "02_견적서_단가표_엑셀/2026_2분기_성수현장_자재비_비교견적_단가표.csv",
    "03_세금계산서_회계증빙/2026_03월_거래처별_세금계산서_미수금_원장.csv",
    "04_현장시공_도면_미디어/성수사옥_3층_바리스타존_전기배선_감리일지.txt",
}

_BLOCKED_EXEC_EXTS = {
    ".exe", ".bat", ".cmd", ".ps1", ".vbs", ".vbe", ".js", ".jse",
    ".wsf", ".wsh", ".hta", ".scr", ".msi", ".msp", ".dll", ".com", ".pif", ".reg",
}

_LOCK_PROBE_EXTS = {
    ".xlsx", ".xls", ".xlsm", ".docx", ".doc", ".pptx", ".ppt",
    ".hwp", ".hwpx", ".dwg", ".dxf", ".pdf", ".csv",
}

_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}

# [미리보기 캐시] LRU + 잠금 (구: 600건 초과 시 전체 clear → 수백 개 파일 재추출 폭주)
_PREVIEW_CACHE_MAX = 6000
_PREVIEW_CACHE: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()
_PREVIEW_LOCK = threading.Lock()
_CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0

# [설정 원장 동시성 보호] ThreadingHTTPServer 다중 스레드(/files·/locks·/pull-sync)가
# work_sdrive_config.json을 동시에 read-modify-write 하면서 Tombstone이 유실되던 경합을 직렬화합니다.
_CONFIG_LOCK = threading.RLock()

# Windows 예약 장치 파일명 (CON, NUL 등) — 업로드·동기화 경로로 사용 금지
_WIN_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}

# 업로드·동기화 1건 최대 크기 (명세 5.8: 최대 50MB)
WORK_MAX_FILE_BYTES = 50 * 1024 * 1024


def _get_merlin_appdata_dir() -> Path:
    local_app = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
    d = Path(local_app) / "Merlin"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _config_file_path() -> Path:
    return _get_merlin_appdata_dir() / "work_sdrive_config.json"


def _load_sdrive_config() -> Dict[str, Any]:
    with _CONFIG_LOCK:
        cfg_p = _config_file_path()
        if cfg_p.exists():
            try:
                data = json.loads(cfg_p.read_text(encoding="utf-8", errors="ignore"))
                if isinstance(data, dict):
                    return data
            except Exception:
                pass
        return {}


def _write_sdrive_config_atomic(cur: Dict[str, Any]) -> None:
    cfg_p = _config_file_path()
    tmp_p = cfg_p.with_name(cfg_p.name + ".tmp")
    try:
        tmp_p.write_text(json.dumps(cur, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp_p, cfg_p)
    except Exception:
        try:
            tmp_p.unlink(missing_ok=True)
        except Exception:
            pass


def _save_sdrive_config(patch: Dict[str, Any]) -> Dict[str, Any]:
    with _CONFIG_LOCK:
        cur = _load_sdrive_config()
        cur.update(patch)
        _write_sdrive_config_atomic(cur)
        return cur


def _mutate_sdrive_config(mutator: Callable[[Dict[str, Any]], None]) -> Dict[str, Any]:
    """설정 원장을 잠금 안에서 최신 상태로 다시 읽어 수정·저장합니다 (Tombstone·knownRelPaths 경합 유실 방지)."""
    with _CONFIG_LOCK:
        cur = _load_sdrive_config()
        mutator(cur)
        _write_sdrive_config_atomic(cur)
        return cur


# [업무 드라이브 문자] 멀린님 확정(2026-11-21): S: 유지.
# 선호 문자(S:)가 이미 다른 연결(회사 NAS·USB 등)에 쓰이고 있으면 기존 연결은 절대 해제하지 않고(/d 금지)
# 비어 있는 다음 문자로 만들고 안내합니다.
WORK_DRIVE_PREFERRED = "S:"
_WORK_DRIVE_FALLBACKS: Tuple[str, ...] = ("Y:", "X:", "W:", "V:", "U:", "T:", "R:", "Q:", "P:")

_SUBST_CACHE: Dict[str, Any] = {"at": 0.0, "map": {}}
_SUBST_CACHE_TTL_SEC = 2.0


def _norm_letter(drive_letter: Optional[str]) -> str:
    s = str(drive_letter or "").strip().rstrip("\\/").upper()
    if not s or not s[0].isalpha():
        return WORK_DRIVE_PREFERRED
    return f"{s[0]}:"


def _drive_root(drive_letter: str) -> str:
    return f"{_norm_letter(drive_letter)}\\"


def _same_path(a: Path | str, b: Path | str) -> bool:
    try:
        return os.path.normcase(os.path.abspath(str(a))) == os.path.normcase(os.path.abspath(str(b)))
    except Exception:
        return False


def _list_subst_map(force: bool = False) -> Dict[str, Path]:
    """`subst` 현재 매핑 전체를 { 'S:': Path(...) } 형태로 반환합니다 (2초 캐시 — 3초 폴링마다 프로세스 폭주 방지)."""
    if os.name != "nt":
        return {}
    import time as _time

    now = _time.time()
    if not force and now - float(_SUBST_CACHE.get("at") or 0.0) < _SUBST_CACHE_TTL_SEC:
        return dict(_SUBST_CACHE.get("map") or {})
    out: Dict[str, Path] = {}
    try:
        res = subprocess.run(
            ["subst"],
            capture_output=True,
            text=True,
            encoding="cp949",
            errors="ignore",
            timeout=4,
            creationflags=_CREATE_NO_WINDOW,
        )
        for line in (res.stdout or "").splitlines():
            s = line.strip()
            m = re.match(r"^([A-Za-z]):\\:\s*=>\s*(.+)$", s)
            if m:
                out[f"{m.group(1).upper()}:"] = Path(m.group(2).strip())
    except Exception:
        pass
    _SUBST_CACHE["at"] = now
    _SUBST_CACHE["map"] = out
    return dict(out)


def _query_subst_target(drive_letter: str = WORK_DRIVE_PREFERRED) -> Optional[Path]:
    return _list_subst_map().get(_norm_letter(drive_letter))


def _letters_mapped_to(vault_dir: Path) -> List[str]:
    """이 업무 폴더를 가리키는 '우리(귀신같이)' subst 문자 목록 — 남의 연결은 절대 포함하지 않습니다."""
    return sorted(letter for letter, target in _list_subst_map().items() if _same_path(target, vault_dir))


def _is_drive_letter_occupied(drive_letter: str) -> bool:
    """로컬 디스크·USB·네트워크 드라이브(연결 끊김 상태의 영구 매핑 포함)·subst 중 하나라도 쓰고 있으면 True."""
    letter = _norm_letter(drive_letter)
    if letter in _list_subst_map():
        return True
    if os.name != "nt":
        return os.path.exists(_drive_root(letter))
    try:
        mask = int(ctypes.windll.kernel32.GetLogicalDrives())
        if mask & (1 << (ord(letter[0]) - ord("A"))):
            return True
    except Exception:
        if os.path.exists(_drive_root(letter)):
            return True
    try:
        import winreg

        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, f"Network\\{letter[0]}"):
            return True  # 재부팅 후 복원 대기 중인 영구 네트워크 드라이브(net use /persistent:yes)
    except Exception:
        pass
    return False


def _mounted_letter_for_vault(vault_dir: Path) -> Optional[str]:
    ours = _letters_mapped_to(vault_dir)
    if not ours:
        return None
    if WORK_DRIVE_PREFERRED in ours:
        return WORK_DRIVE_PREFERRED
    saved = _norm_letter(_load_sdrive_config().get("driveLetter") or "")
    return saved if saved in ours else ours[0]


def _validate_custom_work_target(raw_target: Any) -> Tuple[Optional[Path], str]:
    """업무 폴더 지정(targetDir) 안전 검증 — 드라이브 루트·Windows·Program Files·AppData·사용자 폴더 최상위 등
    시스템/민감 경로를 업무 폴더로 지정해 원격 다운로드·삭제 대상이 되는 것을 원천 차단합니다."""
    s = str(raw_target or "").strip()
    if not s:
        return None, "EMPTY_TARGET_DIR"
    if s.startswith("\\\\") or s.startswith("//"):
        return None, "NETWORK_PATH_NOT_SUPPORTED"
    cand = Path(s)
    if not cand.is_absolute():
        return None, "TARGET_DIR_NOT_ABSOLUTE"
    try:
        resolved = cand.resolve(strict=False)
    except Exception:
        return None, "TARGET_DIR_UNRESOLVABLE"
    if resolved.parent == resolved:
        return None, "DRIVE_ROOT_NOT_ALLOWED"
    # 이미 subst로 만든 가상 드라이브 자체(S:\, Z:\ 등)를 다시 업무 폴더로 지정하는 순환 금지
    if _norm_letter(str(resolved)[:2]) in _list_subst_map():
        return None, "VIRTUAL_DRIVE_NOT_ALLOWED"

    lowered_parts = {p.lower() for p in resolved.parts}
    if "$recycle.bin" in lowered_parts or "system volume information" in lowered_parts:
        return None, "SYSTEM_FOLDER_NOT_ALLOWED"

    def _env_path(name: str) -> Optional[Path]:
        v = os.environ.get(name)
        if not v:
            return None
        try:
            return Path(v).resolve(strict=False)
        except Exception:
            return None

    def _is_under(child: Path, parent: Optional[Path]) -> bool:
        if parent is None:
            return False
        try:
            child.relative_to(parent)
            return True
        except ValueError:
            return False

    merlin_dir = _get_merlin_appdata_dir().resolve(strict=False)
    if _is_under(resolved, merlin_dir):
        return resolved, ""  # 기본 업무 폴더(%LOCALAPPDATA%\Merlin\...)는 허용

    for env_name in ("SystemRoot", "windir", "ProgramFiles", "ProgramFiles(x86)", "ProgramW6432", "ProgramData", "APPDATA", "LOCALAPPDATA"):
        if _is_under(resolved, _env_path(env_name)):
            return None, f"SYSTEM_FOLDER_NOT_ALLOWED:{env_name}"

    user_profile = _env_path("USERPROFILE")
    if user_profile is not None:
        if _same_path(resolved, user_profile) or _same_path(resolved, user_profile.parent):
            return None, "USER_PROFILE_ROOT_NOT_ALLOWED"
        if _is_under(resolved, user_profile / "AppData"):
            return None, "SYSTEM_FOLDER_NOT_ALLOWED:AppData"

    if resolved.exists() and not resolved.is_dir():
        return None, "TARGET_IS_NOT_A_FOLDER"
    return resolved, ""


def _purge_legacy_vite_mock_files_once(vault_dir: Path) -> None:
    """과거 vite.config.ts 미들웨어가 자동 생성했던 4종의 가짜 샘플 텍스트·CSV만 정밀 소거합니다 (실제 유저 파일은 100% 보존).
    ※ 영구 삭제가 아닌 OS 휴지통 이동만 사용합니다."""
    for rel in _LEGACY_VITE_MOCK_REL_PATHS:
        cand = vault_dir / Path(rel)
        try:
            if cand.is_file() and cand.stat().st_size <= 640:
                txt = cand.read_text(encoding="utf-8", errors="ignore")
                if any(
                    marker in txt
                    for marker in (
                        "제14조 (지체상금 및 하자보수 보증)",
                        "성수목공(A안),대림디자인(B안)",
                        "(주)한빛테크,\"35,000,000원\"",
                        "바리스타존 커피머신 가동 시 차단기 트립 방지",
                    )
                ):
                    _move_to_recycle_bin_safe(cand)
        except Exception:
            pass


def _default_work_vault_dir() -> Path:
    if not getattr(sys, "frozen", False) and os.environ.get("GHOSTI_WORK_DEV_REPO_VAULT") == "1":
        repo_cand = Path(__file__).resolve().parents[3] / "업무공유폴더_S"
        if repo_cand.exists():
            return repo_cand
    return _get_merlin_appdata_dir() / "업무공유폴더_S"


def get_work_vault_dir(custom_target: Optional[str] = None, ensure_dirs: bool = True) -> Path:
    """업무 폴더 실제 경로. custom_target은 반드시 _validate_custom_work_target 통과 시에만 저장됩니다.
    사용자 지정 폴더(예: G:\\내 드라이브\\테스트폴더)일 때는 원래 폴더 구조를 100% 보존하기 위해 기본 4개 서브폴더를 강제 생성하지 않습니다."""
    if custom_target and str(custom_target).strip():
        valid_p, _reason = _validate_custom_work_target(custom_target)
        if valid_p is not None:
            _save_sdrive_config({"targetDir": str(valid_p)})

    cfg = _load_sdrive_config()
    saved_dir = str(cfg.get("targetDir") or "").strip()
    default_dir = _default_work_vault_dir()
    vault_dir: Optional[Path] = None
    is_custom = False

    if saved_dir:
        valid_saved, _r = _validate_custom_work_target(saved_dir)
        if valid_saved is not None:
            vault_dir = valid_saved
            is_custom = not _same_path(valid_saved, default_dir)

    if vault_dir is None:
        vault_dir = default_dir

    if ensure_dirs:
        try:
            vault_dir.mkdir(parents=True, exist_ok=True)
            if not is_custom:
                for _, folder_name in SUBFOLDER_SPECS:
                    (vault_dir / folder_name).mkdir(parents=True, exist_ok=True)
                _purge_legacy_vite_mock_files_once(vault_dir)
        except Exception:
            pass

    return vault_dir


def inspect_s_drive_status(drive_letter: str = WORK_DRIVE_PREFERRED) -> Dict[str, Any]:
    vault_dir = get_work_vault_dir(ensure_dirs=False)
    default_dir = _default_work_vault_dir()
    mounted_letter = _mounted_letter_for_vault(vault_dir)
    return {
        "ok": True,
        "track": "paid-work",
        "driveLetter": mounted_letter or WORK_DRIVE_PREFERRED,
        "preferredLetter": WORK_DRIVE_PREFERRED,
        "mounted": bool(mounted_letter),
        "targetDir": str(vault_dir),
        "defaultTargetDir": str(default_dir),
        "isCustomTarget": not _same_path(vault_dir, default_dir),
    }


def _pick_folder_dialog_win32(initial_dir: str = "") -> Optional[str]:
    """방장이 직접 클릭했을 때 Windows 탐색기 폴더 선택창(TopMost)을 띄워 구글 드라이브(G:) 하위 폴더 등을 선택합니다."""
    if os.name != "nt":
        return None
    # Google Drive(G:/H:)가 마운트되어 있고 현재 기본 폴더 상태라면 내 드라이브를 기본 시작 경로로 제안
    start_dir = initial_dir
    if not start_dir or "AppData" in start_dir:
        for cand_g in ("G:\\내 드라이브", "G:\\My Drive", "H:\\내 드라이브", "H:\\My Drive"):
            if os.path.isdir(cand_g):
                start_dir = cand_g
                break
    ps_init = (start_dir or "").replace("'", "''")
    ps_script = (
        "Add-Type -AssemblyName System.Windows.Forms; "
        "$f = New-Object System.Windows.Forms.Form; $f.TopMost = $true; $f.ShowInTaskbar = $false; "
        "$f.Width = 1; $f.Height = 1; $f.StartPosition = 'Manual'; $f.Location = New-Object System.Drawing.Point(-2000,-2000); "
        "$f.Show(); $f.Activate(); "
        "$d = New-Object System.Windows.Forms.FolderBrowserDialog; "
        "$d.Description = 'S: 업무 공유 드라이브로 연결할 폴더(예: 구글 드라이브 내 테스트 폴더)를 선택해 주세요.'; "
        "$d.ShowNewFolderButton = $true; "
        f"if ('{ps_init}' -ne '' -and (Test-Path -LiteralPath '{ps_init}')) {{ $d.SelectedPath = '{ps_init}' }}; "
        "if ($d.ShowDialog($f) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.SelectedPath) }; "
        "$f.Close()"
    )
    try:
        res = subprocess.run(
            ["powershell", "-NoProfile", "-STA", "-Command", ps_script],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=180,
            creationflags=_CREATE_NO_WINDOW,
        )
        picked = (res.stdout or "").strip()
        if picked:
            return picked
    except Exception:
        pass
    return None


def _run_subst(args: List[str]) -> Tuple[bool, str]:
    try:
        res = subprocess.run(
            ["subst", *args],
            capture_output=True,
            text=True,
            encoding="cp949",
            errors="ignore",
            timeout=6,
            creationflags=_CREATE_NO_WINDOW,
        )
        return res.returncode == 0, (res.stderr or res.stdout or "").strip()
    except Exception as exc:
        return False, str(exc)


def mount_or_unmount_s_drive(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    payload = data or {}
    action = str(payload.get("action") or "mount").strip().lower()
    open_explorer = bool(payload.get("openExplorer", False))
    custom_target = payload.get("targetDir")
    prev_vault_dir = get_work_vault_dir(ensure_dirs=False)

    if action == "pick_folder":
        picked = _pick_folder_dialog_win32(str(prev_vault_dir))
        if not picked:
            return {
                "ok": False,
                "cancelled": True,
                "targetDir": str(prev_vault_dir),
                "message": "폴더 선택이 취소되었습니다.",
            }
        custom_target = picked
        action = "mount"
    elif action in ("reset_default", "reset_default_folder"):
        default_dir = _default_work_vault_dir()
        custom_target = str(default_dir)
        action = "mount"

    folder_switched = False
    if custom_target and str(custom_target).strip():
        valid_p, reason = _validate_custom_work_target(custom_target)
        if valid_p is None:
            return {
                "ok": False,
                "error": "INVALID_TARGET_DIR",
                "reason": reason,
                "message": "이 폴더는 업무 공유 폴더로 지정할 수 없어요. (드라이브 최상위 G:\\ 자체 대신 G:\\내 드라이브\\폴더명 같은 하위 폴더를 선택해 주세요 · 시스템 폴더 제외)",
            }
        if not _same_path(prev_vault_dir, valid_p):
            folder_switched = True
            # 이전 업무 폴더에 연결돼 있던 우리 S: 드라이브를 먼저 해제해 동일 S: 문자를 그대로 이어받게 보장
            if os.name == "nt":
                for old_letter in _letters_mapped_to(prev_vault_dir):
                    _run_subst([old_letter, "/d"])
                _list_subst_map(force=True)
            def _reset_known_on_switch(cur: Dict[str, Any]) -> None:
                cur["targetDir"] = str(valid_p)
                cur["knownRelPaths"] = []
            _mutate_sdrive_config(_reset_known_on_switch)
        else:
            _save_sdrive_config({"targetDir": str(valid_p)})

    vault_dir = get_work_vault_dir(ensure_dirs=True)
    default_dir = _default_work_vault_dir()
    is_custom_now = not _same_path(vault_dir, default_dir)

    if action == "status":
        return inspect_s_drive_status()

    if action == "unmount":
        released: List[str] = []
        failed: List[str] = []
        if os.name == "nt":
            for letter in _letters_mapped_to(vault_dir):  # 우리 연결만 해제 (남의 NAS·USB는 절대 미접촉)
                ok_d, _msg = _run_subst([letter, "/d"])
                (released if ok_d else failed).append(letter)
            _list_subst_map(force=True)
        still = _mounted_letter_for_vault(vault_dir)
        return {
            "ok": not failed,
            "mounted": bool(still),
            "driveLetter": still or WORK_DRIVE_PREFERRED,
            "releasedLetters": released,
            "targetDir": str(vault_dir),
            "message": "윈도우 탐색기에서 업무 드라이브 연결을 해제했습니다. 파일은 원래 폴더에 그대로 있습니다.",
        }

    # action == "mount"
    if os.name != "nt":
        return {"ok": False, "error": "WINDOWS_ONLY", "mounted": False, "targetDir": str(vault_dir)}

    cfg_now = _load_sdrive_config()
    if cfg_now.get("workEntitlementLocked") is True and not bool(payload.get("forceMount")):
        for letter in _letters_mapped_to(vault_dir):
            _run_subst([letter, "/d"])
        _list_subst_map(force=True)
        return {
            "ok": False,
            "error": "WORK_SUBSCRIPTION_LOCKED",
            "mounted": False,
            "driveLetter": WORK_DRIVE_PREFERRED,
            "targetDir": str(vault_dir),
            "message": "🔒 업무 공유 무료체험(또는 구독)이 종료되어 S: 드라이브 연결이 해제되었습니다. 폴더 안의 원본 파일은 100% 그대로 보존됩니다.",
        }

    ours = _letters_mapped_to(vault_dir)
    preferred = WORK_DRIVE_PREFERRED
    chosen: Optional[str] = None
    mount_error = ""

    if preferred in ours:
        chosen = preferred  # 이미 동일 경로로 연결됨 → 열린 엑셀 핸들 보호를 위해 재연결 생략
    elif not _is_drive_letter_occupied(preferred):
        ok_m, mount_error = _run_subst([preferred, str(vault_dir)])
        if ok_m:
            chosen = preferred
    elif ours:
        chosen = ours[0]  # 선호 문자를 남이 쓰는 중이면 기존 대체 문자 연결을 그대로 유지
    else:
        for letter in _WORK_DRIVE_FALLBACKS:
            if letter == preferred or _is_drive_letter_occupied(letter):
                continue
            ok_m, mount_error = _run_subst([letter, str(vault_dir)])
            if ok_m:
                chosen = letter
                break

    _list_subst_map(force=True)
    verified = bool(chosen) and chosen in _letters_mapped_to(vault_dir) and os.path.exists(_drive_root(chosen))

    if not verified:
        return {
            "ok": False,
            "error": "MOUNT_FAILED" if chosen or mount_error else "NO_FREE_DRIVE_LETTER",
            "detail": mount_error,
            "mounted": False,
            "driveLetter": preferred,
            "targetDir": str(vault_dir),
            "message": "업무 드라이브를 만들지 못했어요. 업무 폴더는 그대로 사용할 수 있습니다.",
        }

    # 구버전(S:) 또는 이전 대체 문자 연결이 남아 있으면 새 연결 성공 후에만 정리 (우리 연결만)
    for stale in _letters_mapped_to(vault_dir):
        if stale != chosen:
            _run_subst([stale, "/d"])
    _list_subst_map(force=True)
    _save_sdrive_config({"driveLetter": chosen})

    root = _drive_root(chosen)
    if open_explorer:
        try:
            subprocess.Popen(["explorer.exe", root])
        except Exception:
            pass

    used_fallback = chosen != preferred
    msg = (
        f"{preferred[0]} 드라이브가 이미 다른 연결(회사 NAS 등)에 쓰이고 있어 {chosen[0]} 드라이브로 만들었어요. 기존 연결은 그대로 두었습니다."
        if used_fallback
        else f"✓ 윈도우 탐색기에 업무 드라이브({chosen[0]}:)가 연결되었습니다."
    )
    return {
        "ok": True,
        "mounted": True,
        "driveLetter": chosen,
        "preferredLetter": preferred,
        "usedFallback": used_fallback,
        "targetDir": str(vault_dir),
        "defaultTargetDir": str(default_dir),
        "isCustomTarget": is_custom_now,
        "folderSwitched": folder_switched,
        "openedExplorer": open_explorer,
        "message": msg,
    }


def is_temp_or_lock_artifact(file_name: str) -> bool:
    n = (file_name or "").strip()
    if not n:
        return True
    low = n.lower()
    if n.startswith(("~$", ".~lock.", "._")) or low in ("desktop.ini", "thumbs.db", ".ds_store", "icon\r"):
        return True
    if low.endswith((
        ".lck",
        ".tmp",
        ".crdownload",
        ".part",
        ".ghosti_sync_tmp",
        ".dwl",
        ".dwl2",
        ".tmp.drivedownload",
        ".tmp.driveupload",
    )):
        return True
    if n.startswith("~") and low.endswith(".hwp"):
        return True
    return False


_INVALID_LOCK_OWNER_RE = re.compile(
    r"(hcell|hwpshare|hshowshare|sharefileinfo|hancom|libreoffice|soffice|microsoft|msoffice|lockfile|winword|powerpnt|excel\.exe)",
    re.IGNORECASE,
)


def _iso_utc(ts: Optional[float] = None) -> str:
    dt = (
        datetime.fromtimestamp(ts, tz=timezone.utc)
        if ts is not None
        else datetime.now(tz=timezone.utc)
    )
    return dt.isoformat().replace("+00:00", "Z")


def _is_valid_human_lock_owner(cand: str) -> bool:
    s = (cand or "").strip()
    if len(s) < 2 or len(s) > 32:
        return False
    if _INVALID_LOCK_OWNER_RE.search(s):
        return False
    if re.fullmatch(r"[0-9A-Fa-f_.-]+", s):
        return False
    return bool(re.search(r"[가-힣A-Za-z]", s))


def _extract_owner_from_office_lock_file(lock_file: Path) -> Optional[str]:
    """MS Office ~$ 소유자 파일 내부에 기록된 사용자 이름(ASCII + UTF-16LE)을 비파괴 파싱합니다.
    한셀(HCellShareFileInfo)·한글 등 내부 매직 헤더 문자열은 절대 사용자명으로 반환하지 않습니다.
    """
    try:
        raw = lock_file.read_bytes()[:512]
        if not raw:
            return None
        # 한컴오피스(한셀/한글/한쇼) 전용 공유 잠금 헤더(HCellShareFileInfo 등)가 감지되면
        # 바이너리 내부 식별자가 노출되지 않도록 즉시 None 반환 -> 실제 사용자 별명 폴백
        txt_u16_full = raw.decode("utf-16-le", errors="ignore")
        txt_ascii_full = raw.decode("ascii", errors="ignore")
        if _INVALID_LOCK_OWNER_RE.search(txt_u16_full) or _INVALID_LOCK_OWNER_RE.search(txt_ascii_full):
            return None

        # Word/Excel/PPT owner files typically store 1-byte length at offset 0 followed by ANSI name, then UTF-16LE name
        first_len = raw[0]
        if 1 <= first_len <= 64 and len(raw) >= 1 + first_len:
            rem = raw[1 + first_len :]
            if len(rem) >= 4:
                u16_len_chars = rem[0] if rem[1] == 0 else 0
                if 1 <= u16_len_chars <= 48 and len(rem) >= 2 + u16_len_chars * 2:
                    cand_u16 = rem[2 : 2 + u16_len_chars * 2].decode("utf-16-le", errors="ignore").strip("\x00 ").strip()
                    if _is_valid_human_lock_owner(cand_u16):
                        return cand_u16[:32]
            cand_ansi = raw[1 : 1 + first_len].decode("cp949", errors="ignore").strip("\x00 ").strip()
            if _is_valid_human_lock_owner(cand_ansi):
                return cand_ansi[:32]
        # Fallback: scan UTF-16LE printable characters
        m = re.search(r"([가-힣A-Za-z0-9_. -]{2,24})", txt_u16_full)
        if m:
            cand = m.group(1).strip()
            if _is_valid_human_lock_owner(cand):
                return cand[:32]
    except Exception:
        pass
    return None


def _is_win32_exclusively_locked(file_path: Path) -> bool:
    """파일 내용이나 수정시각(mtime)을 일절 건드리지 않고 다른 프로세스(엑셀·한글·CAD)가 쓰기 점유 중인지 확인합니다."""
    if os.name != "nt":
        return False
    GENERIC_READ = 0x80000000
    OPEN_EXISTING = 3
    FILE_ATTRIBUTE_NORMAL = 0x80
    INVALID_HANDLE_VALUE = ctypes.c_void_p(-1).value
    ERROR_SHARING_VIOLATION = 32
    ERROR_LOCK_VIOLATION = 33
    try:
        k32 = ctypes.windll.kernel32
        handle = k32.CreateFileW(
            ctypes.c_wchar_p(str(file_path)),
            GENERIC_READ,
            # FILE_SHARE_READ: 다른 앱이 '쓰기'로 열고 있을 때만 ERROR_SHARING_VIOLATION.
            # (구: dwShareMode=0 → 검사 순간 사용자가 엑셀로 열면 '다른 사용자가 사용 중' 오류를 유발할 수 있었음)
            0x00000001,
            None,
            OPEN_EXISTING,
            FILE_ATTRIBUTE_NORMAL,
            None,
        )
        if handle == INVALID_HANDLE_VALUE or handle is None:
            err = k32.GetLastError()
            return err in (ERROR_SHARING_VIOLATION, ERROR_LOCK_VIOLATION)
        k32.CloseHandle(handle)
        return False
    except Exception:
        return False


def _lock_artifact_candidates(file_path: Path) -> List[Path]:
    """오피스(~$)·LibreOffice(.~lock)·아래아한글(.lck)·AutoCAD(.dwl) 잠금 파일 후보 경로."""
    parent = file_path.parent
    name = file_path.name
    stem = file_path.stem
    ext = file_path.suffix
    cands: List[Path] = [
        parent / f"~${name}",
        parent / f".~lock.{name}#",
        parent / f"{name}.lck",
        parent / f"~{name}.lck",
        parent / f"~${stem}.lck",
        parent / f"{stem}.lck",
        parent / f"{stem}.dwl",
        parent / f"{stem}.dwl2",
    ]
    if len(stem) >= 8:
        cands.append(parent / f"~${stem[2:]}{ext}")
    elif len(stem) == 7:
        cands.append(parent / f"~${stem[1:]}{ext}")
    return cands


def _fallback_lock_owner(fallback_owner: str = "") -> str:
    clean_fallback = (fallback_owner or "").strip()
    if not _is_valid_human_lock_owner(clean_fallback):
        clean_fallback = (os.environ.get("USERNAME") or "").strip() or "현재 PC 사용자"
    return clean_fallback


def detect_file_lock_owner(file_path: Path, fallback_owner: str = "") -> Optional[str]:
    """~$ 오피스·한셀 잠금 파일, .lck 한글 잠금 파일, .dwl CAD 잠금 및 OS 파일 핸들 점유를 실시간 감지하여 친숙한 사용자 이름을 반환합니다."""
    try:
        clean_fallback = _fallback_lock_owner(fallback_owner)
        for lc in _lock_artifact_candidates(file_path):
            if lc.exists() and lc.is_file():
                owner = _extract_owner_from_office_lock_file(lc)
                return owner or clean_fallback

        if file_path.suffix.lower() in _LOCK_PROBE_EXTS and _is_win32_exclusively_locked(file_path):
            return clean_fallback
    except Exception:
        pass
    return None


def _parse_xlsx_preview_stdlib(file_path: Path) -> Tuple[List[str], List[List[str]], str]:
    """외부 무거운 의존성 없이 표준 zipfile+XML로 엑셀(.xlsx) 첫 시트의 표 헤더·상위 행·본문 요약을 초고속 추출합니다."""
    headers: List[str] = []
    rows: List[List[str]] = []
    flat_lines: List[str] = []
    try:
        with zipfile.ZipFile(file_path, "r") as zf:
            shared_strings: List[str] = []
            if "xl/sharedStrings.xml" in zf.namelist():
                ss_root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
                for si in ss_root.iter():
                    if si.tag.endswith("}si") or si.tag == "si":
                        chunks = [t.text or "" for t in si.iter() if (t.tag.endswith("}t") or t.tag == "t")]
                        shared_strings.append("".join(chunks).strip())

            sheet_names = sorted(
                n for n in zf.namelist() if n.startswith("xl/worksheets/sheet") and n.endswith(".xml")
            )
            if not sheet_names:
                return headers, rows, ""

            ws_root = ET.fromstring(zf.read(sheet_names[0]))
            parsed_matrix: List[List[str]] = []
            for row_el in ws_root.iter():
                if not (row_el.tag.endswith("}row") or row_el.tag == "row"):
                    continue
                row_vals: List[str] = []
                for c_el in row_el:
                    if not (c_el.tag.endswith("}c") or c_el.tag == "c"):
                        continue
                    c_type = c_el.attrib.get("t", "")
                    val_str = ""
                    for child in c_el:
                        if child.tag.endswith("}v") or child.tag == "v":
                            raw_v = (child.text or "").strip()
                            if c_type == "s" and raw_v.isdigit():
                                idx = int(raw_v)
                                val_str = shared_strings[idx] if 0 <= idx < len(shared_strings) else raw_v
                            else:
                                val_str = raw_v
                        elif child.tag.endswith("}is") or child.tag == "is":
                            val_str = "".join(t.text or "" for t in child.iter() if t.tag.endswith("}t") or t.tag == "t").strip()
                    row_vals.append(val_str)
                    if len(row_vals) >= 6:
                        break
                if any(v.strip() for v in row_vals):
                    parsed_matrix.append(row_vals)
                    flat_lines.append(" | ".join(v for v in row_vals if v.strip()))
                if len(parsed_matrix) >= 12:
                    break

            if parsed_matrix:
                headers = [h or f"열 {i + 1}" for i, h in enumerate(parsed_matrix[0][:6])]
                col_len = len(headers)
                for r in parsed_matrix[1:8]:
                    padded = (r + [""] * col_len)[:col_len]
                    rows.append(padded)
    except Exception:
        pass
    return headers, rows, "\n".join(flat_lines)[:2800]


def _make_lightweight_image_data_url(file_path: Path, size_bytes: int) -> str:
    ext_low = file_path.suffix.lower()
    if size_bytes <= 0 or size_bytes > 20 * 1024 * 1024:
        return ""
    if ext_low == ".gif" and size_bytes <= 350 * 1024:
        try:
            return f"data:image/gif;base64,{base64.b64encode(file_path.read_bytes()).decode('ascii')}"
        except Exception:
            return ""
    try:
        from PIL import Image

        with Image.open(file_path) as im:
            rgb = im.convert("RGB")
            resamp = getattr(getattr(Image, "Resampling", Image), "BILINEAR", Image.NEAREST)
            rgb.thumbnail((480, 360), resamp)
            bio = io.BytesIO()
            try:
                rgb.save(bio, format="WEBP", quality=68)
                mime = "image/webp"
            except Exception:
                bio = io.BytesIO()
                rgb.save(bio, format="JPEG", quality=68)
                mime = "image/jpeg"
            return f"data:{mime};base64,{base64.b64encode(bio.getvalue()).decode('ascii')}"
    except Exception:
        if size_bytes <= 250 * 1024:
            mime = mimetypes.guess_type(file_path.name)[0] or "image/jpeg"
            try:
                return f"data:{mime};base64,{base64.b64encode(file_path.read_bytes()).decode('ascii')}"
            except Exception:
                return ""
    return ""


def _preview_sig_key(file_path: Path, st: os.stat_result) -> str:
    return f"{os.path.normcase(os.path.abspath(str(file_path)))}|{st.st_size}|{st.st_mtime_ns}"


def _get_cached_preview(sig_key: str) -> Optional[Dict[str, Any]]:
    with _PREVIEW_LOCK:
        hit = _PREVIEW_CACHE.get(sig_key)
        if hit is not None:
            _PREVIEW_CACHE.move_to_end(sig_key)
        return hit


def _put_cached_preview(sig_key: str, res: Dict[str, Any]) -> None:
    with _PREVIEW_LOCK:
        _PREVIEW_CACHE[sig_key] = res
        _PREVIEW_CACHE.move_to_end(sig_key)
        while len(_PREVIEW_CACHE) > _PREVIEW_CACHE_MAX:
            _PREVIEW_CACHE.popitem(last=False)


def _compute_rich_preview(file_path: Path, st: os.stat_result) -> Dict[str, Any]:
    ext_low = file_path.suffix.lower()
    ext_upper = ext_low.lstrip(".").upper() or "FILE"
    is_image = ext_low in _IMAGE_EXTS
    preview_text = ""
    table_headers: List[str] = []
    table_rows: List[List[str]] = []
    image_base64 = ""

    try:
        if is_image:
            image_base64 = _make_lightweight_image_data_url(file_path, st.st_size)
        elif ext_low == ".csv":
            raw_bytes = file_path.read_bytes()[:262144]
            try:
                raw_txt = raw_bytes.decode("utf-8-sig")
            except UnicodeDecodeError:
                raw_txt = raw_bytes.decode("cp949", errors="ignore")
            reader = list(csv.reader(io.StringIO(raw_txt)))
            non_empty = [r for r in reader if any(c.strip() for c in r)]
            if non_empty:
                table_headers = [c.strip() or f"열 {i + 1}" for i, c in enumerate(non_empty[0][:6])]
                col_n = len(table_headers)
                for r in non_empty[1:8]:
                    table_rows.append([(c.strip() if i < len(r) else "") for i, c in enumerate((r + [""] * col_n)[:col_n])])
                preview_text = "\n".join(" | ".join(r[:6]) for r in non_empty[:15])[:2800]
        elif ext_low == ".xlsx":
            table_headers, table_rows, preview_text = _parse_xlsx_preview_stdlib(file_path)
        elif ext_low in (".gdoc", ".gsheet", ".gslides"):
            raw_bytes = file_path.read_bytes()[:32768]
            meta = json.loads(raw_bytes.decode("utf-8-sig", errors="ignore") or "{}")
            doc_id = str(meta.get("doc_id") or meta.get("resource_id") or "").strip()
            g_url = str(meta.get("url") or "").strip()
            if not g_url and doc_id:
                if ext_low == ".gsheet":
                    g_url = f"https://docs.google.com/spreadsheets/d/{doc_id}/edit"
                elif ext_low == ".gslides":
                    g_url = f"https://docs.google.com/presentation/d/{doc_id}/edit"
                else:
                    g_url = f"https://docs.google.com/document/d/{doc_id}/edit"
            kind_ko = (
                "Google 스프레드시트"
                if ext_low == ".gsheet"
                else "Google 프레젠테이션"
                if ext_low == ".gslides"
                else "Google 문서"
            )
            exported_body = ""
            # 링크 공유('링크가 있는 모든 사용자 보기') 설정된 사내 구글시트/구글문서는 백신 오진(브라우저 쿠키 접근) 없이
            # 공식 export 엔드포인트(CSV/TXT)로 표(행·열)와 본문 텍스트를 엑셀·워드와 동일하게 자동 인덱싱
            if doc_id and ext_low in (".gsheet", ".gdoc"):
                try:
                    import urllib.request
                    exp_fmt = "csv" if ext_low == ".gsheet" else "txt"
                    exp_kind = "spreadsheets" if ext_low == ".gsheet" else "document"
                    exp_url = f"https://docs.google.com/{exp_kind}/d/{doc_id}/export?format={exp_fmt}"
                    req = urllib.request.Request(exp_url, headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(req, timeout=2.5) as resp:
                        ctype = (resp.headers.get("Content-Type") or "").lower()
                        if "text/csv" in ctype or "text/plain" in ctype:
                            data_txt = resp.read(262144).decode("utf-8-sig", errors="ignore").strip()
                            if data_txt and not data_txt.lstrip().lower().startswith(("<!doctype", "<html")):
                                if ext_low == ".gsheet":
                                    reader = list(csv.reader(io.StringIO(data_txt)))
                                    non_empty = [r for r in reader if any(c.strip() for c in r)]
                                    if non_empty:
                                        table_headers = [c.strip() or f"열 {i + 1}" for i, c in enumerate(non_empty[0][:6])]
                                        col_n = len(table_headers)
                                        for r in non_empty[1:8]:
                                            table_rows.append([(c.strip() if i < len(r) else "") for i, c in enumerate((r + [""] * col_n)[:col_n])])
                                        exported_body = "\n".join(" | ".join(r[:6]) for r in non_empty[:20])[:2400]
                                else:
                                    exported_body = data_txt[:2400]
                except Exception:
                    pass
            preview_text = (
                f"[{kind_ko} 바로가기 — {file_path.stem}]\n"
                + (f"원본 열기: {g_url}\n" if g_url else "")
                + (
                    f"{exported_body}"
                    if exported_body
                    else "구글 드라이브 웹 문서입니다. 파일명으로 즉시 검색되며(링크 공유 시트·문서는 본문·표까지 자동 인덱싱) 원본 열기로 웹에서 바로 편집할 수 있습니다."
                )
            )
        elif ext_low in (".txt", ".md", ".json", ".log"):
            raw_bytes = file_path.read_bytes()[:131072]
            try:
                preview_text = raw_bytes.decode("utf-8-sig")[:2800]
            except UnicodeDecodeError:
                preview_text = raw_bytes.decode("cp949", errors="ignore")[:2800]
        elif ext_low in (".pdf", ".hwp", ".hwpx", ".docx", ".doc", ".pptx", ".ppt", ".xls"):
            try:
                import plugin_ghosti_os

                extracted = plugin_ghosti_os._extract_doc_text(file_path, allow_pdf_winrt_ocr=False)
                if extracted and "로컬 문서 파일입니다. 파일명 및 키워드로 즉시 검색됩니다." not in extracted:
                    preview_text = extracted[:3000]
            except Exception:
                pass
    except Exception:
        pass

    sha256_hex = ""
    if st.st_size <= 25 * 1024 * 1024:
        try:
            h = hashlib.sha256()
            with open(file_path, "rb") as fp:
                while True:
                    chunk = fp.read(262144)
                    if not chunk:
                        break
                    h.update(chunk)
            sha256_hex = h.hexdigest()
        except Exception:
            sha256_hex = f"stat_{st.st_size}_{int(st.st_mtime)}"
    else:
        sha256_hex = f"stat_{st.st_size}_{int(st.st_mtime)}"

    return {
        "ext": ext_upper,
        "isImage": is_image,
        "previewText": preview_text.strip(),
        "tableHeaders": table_headers,
        "tableRows": table_rows,
        "imageBase64": image_base64,
        "sha256": sha256_hex,
    }


def _extract_rich_preview_cached(file_path: Path, st: os.stat_result) -> Dict[str, Any]:
    key = _preview_sig_key(file_path, st)
    hit = _get_cached_preview(key)
    if hit is not None:
        return hit
    res = _compute_rich_preview(file_path, st)
    _put_cached_preview(key, res)
    return res


# ─────────────────────────────────────────────────────────────────────────────
# [백그라운드 미리보기 추출] 파일 수 제한(구 500개) 없이 수천~수만 개 회사 폴더를 지원하기 위해,
# 목록 응답은 즉시 반환하고 본문·표·썸네일 추출은 낮은 우선순위 스레드 1개가 순차 처리합니다.
# ─────────────────────────────────────────────────────────────────────────────
_PREVIEW_PENDING: "OrderedDict[str, Path]" = OrderedDict()
_PREVIEW_PENDING_LOCK = threading.Lock()
_PREVIEW_WAKE = threading.Event()
_PREVIEW_WORKER: Dict[str, Any] = {"thread": None}
_PREVIEW_SYNC_BUDGET_SEC = 1.2  # 목록 요청 1회당 즉시 추출에 쓰는 최대 시간 (나머지는 백그라운드)


def _preview_worker_loop() -> None:
    if os.name == "nt":
        try:
            k32 = ctypes.windll.kernel32
            k32.SetThreadPriority(k32.GetCurrentThread(), -2)  # THREAD_PRIORITY_LOWEST
        except Exception:
            pass
    while True:
        _PREVIEW_WAKE.wait(timeout=30)
        while True:
            with _PREVIEW_PENDING_LOCK:
                if not _PREVIEW_PENDING:
                    _PREVIEW_WAKE.clear()
                    break
                key, path = _PREVIEW_PENDING.popitem(last=False)
            try:
                st = path.stat()
                if _preview_sig_key(path, st) != key:
                    continue  # 대기 중 파일이 바뀜 → 다음 스캔에서 새 시그니처로 재등록
                if _get_cached_preview(key) is None:
                    _put_cached_preview(key, _compute_rich_preview(path, st))
            except Exception:
                pass


def _enqueue_preview(sig_key: str, path: Path) -> None:
    with _PREVIEW_PENDING_LOCK:
        if sig_key not in _PREVIEW_PENDING:
            _PREVIEW_PENDING[sig_key] = path
        th = _PREVIEW_WORKER.get("thread")
        if th is None or not th.is_alive():
            th = threading.Thread(target=_preview_worker_loop, name="ghosti-work-preview", daemon=True)
            _PREVIEW_WORKER["thread"] = th
            th.start()
    _PREVIEW_WAKE.set()


def _resolve_folder_meta(rel_path: str, drive_letter: Optional[str] = None) -> Tuple[str, str, str]:
    root = _drive_root(drive_letter or WORK_DRIVE_PREFERRED)
    norm_rel = rel_path.replace("\\", "/")
    dir_part = os.path.dirname(norm_rel)
    folder_path = root if not dir_part or dir_part == "." else root + dir_part.replace("/", "\\")
    for folder_id, folder_name in SUBFOLDER_SPECS:
        prefix = folder_name.split("_", 2)[0] + "_" + folder_name.split("_", 2)[1][:3]
        if norm_rel.startswith(folder_name) or norm_rel.startswith(prefix):
            return folder_id, folder_name, folder_path
    return "root", f"{root} 루트 (최상단)", folder_path


def _format_size(num_bytes: int) -> str:
    if num_bytes >= 1024 * 1024:
        return f"{num_bytes / (1024 * 1024):.1f} MB"
    return f"{max(0.1, num_bytes / 1024):.1f} KB"


def _format_mtime_ko(ts: float) -> str:
    dt = datetime.fromtimestamp(ts)
    return f"{dt.month}월 {dt.day}일 {dt.hour:02d}:{dt.minute:02d}"


_INVALID_PATH_CHARS = set('<>"|?*')


def _safe_resolve_inside_vault(vault_dir: Path, rel_path: str) -> Optional[Path]:
    clean = (rel_path or "").strip().replace("/", "\\").lstrip("\\")
    if not clean:
        return None
    parts = Path(clean).parts
    if ".." in parts or ":" in clean:
        return None
    for part in parts:
        if not part or part != part.rstrip(" ."):
            return None
        if any(ord(ch) < 32 or ch in _INVALID_PATH_CHARS for ch in part):
            return None
        if part.split(".")[0].strip().upper() in _WIN_RESERVED_NAMES:
            return None
    cand = (vault_dir / clean).resolve()
    vault_resolved = vault_dir.resolve()
    try:
        cand.relative_to(vault_resolved)
    except ValueError:
        return None
    return cand


_FILE_ATTRIBUTE_REPARSE_POINT = 0x400
_SCAN_MAX_DEPTH = 64  # 정션 순환 무한루프 방지용 안전장치 (파일 개수 제한 아님)


def _scan_work_vault(
    vault_dir: Path, hidden_rel_set: set, include_hidden: bool
) -> Tuple[List[Tuple[Path, str, os.stat_result]], Dict[str, set], bool]:
    """업무 폴더 전체를 개수 제한 없이 1패스 스캔합니다.
    반환: (파일 목록, 폴더별 잠금파일 이름 집합, 스캔 완전성)
    스캔 도중 접근 오류가 하나라도 나면 complete=False → 호출부는 '삭제됨' 판정을 절대 하지 않습니다."""
    entries: List[Tuple[Path, str, os.stat_result]] = []
    lock_names_by_dir: Dict[str, set] = {}
    state = {"complete": True}

    def _walk(cur_dir: Path, depth: int) -> None:
        if depth > _SCAN_MAX_DEPTH:
            state["complete"] = False
            return
        try:
            it = os.scandir(cur_dir)
        except OSError:
            state["complete"] = False
            return
        dir_key = os.path.normcase(str(cur_dir))
        with it:
            for entry in it:
                try:
                    name = entry.name
                    if entry.is_symlink():
                        continue
                    if entry.is_dir(follow_symlinks=False):
                        if name.startswith("."):
                            continue
                        try:
                            attrs = getattr(entry.stat(follow_symlinks=False), "st_file_attributes", 0) or 0
                        except OSError:
                            attrs = 0
                        if attrs & _FILE_ATTRIBUTE_REPARSE_POINT:
                            continue  # 정션·마운트 포인트는 따라가지 않음 (업무 폴더 밖 탈출·순환 방지)
                        _walk(Path(entry.path), depth + 1)
                        continue
                    if not entry.is_file(follow_symlinks=False):
                        continue
                    if is_temp_or_lock_artifact(name):
                        lock_names_by_dir.setdefault(dir_key, set()).add(name.lower())
                        continue
                    if name.startswith("."):
                        continue
                    full_p = Path(entry.path)
                    rel_p = str(full_p.relative_to(vault_dir)).replace("\\", "/")
                    if not include_hidden and rel_p in hidden_rel_set:
                        continue
                    entries.append((full_p, rel_p, entry.stat(follow_symlinks=False)))
                except (OSError, ValueError):
                    state["complete"] = False

    _walk(vault_dir, 0)
    return entries, lock_names_by_dir, state["complete"]


# Win32 핸들 점유 검사(잠금파일을 만들지 않는 프로그램 대비): 최근 48시간 내 수정 파일은 매번,
# 나머지는 회전식으로 1회 최대 250개씩 검사해 수만 개 폴더에서도 1초 폴링 부하를 일정하게 유지합니다.
_LOCK_PROBE_RECENT_SEC = 48 * 3600
_LOCK_PROBE_BUDGET = 250
_LOCK_PROBE_STATE: Dict[str, Any] = {"cursor": 0, "memo": {}}
_LOCK_PROBE_LOCK = threading.Lock()


def _win32_lock_owner_map(entries: List[Tuple[Path, str, os.stat_result]], fallback: str) -> Dict[str, Optional[str]]:
    import time as _time

    now = _time.time()
    recent: List[Tuple[Path, str]] = []
    others: List[Tuple[Path, str]] = []
    for full_p, rel_p, st in entries:
        if full_p.suffix.lower() not in _LOCK_PROBE_EXTS:
            continue
        # Google Drive 스트리밍 미다운로드(OFFLINE / RECALL_ON_DATA_ACCESS) 파일은 CreateFileW 열기 시 강제 다운로드가 유발되므로 생략
        f_attrs = getattr(st, "st_file_attributes", 0) or 0
        if f_attrs & (0x1000 | 0x400000):
            continue
        (recent if now - st.st_mtime <= _LOCK_PROBE_RECENT_SEC else others).append((full_p, rel_p))

    with _LOCK_PROBE_LOCK:
        memo: Dict[str, bool] = _LOCK_PROBE_STATE["memo"]
        to_probe = list(recent)
        if others:
            others.sort(key=lambda x: x[1])
            n = len(others)
            start = int(_LOCK_PROBE_STATE["cursor"]) % n
            take = min(_LOCK_PROBE_BUDGET, n)
            to_probe.extend(others[(start + i) % n] for i in range(take))
            _LOCK_PROBE_STATE["cursor"] = (start + take) % n
        for full_p, rel_p in to_probe:
            memo[rel_p] = _is_win32_exclusively_locked(full_p)
        live = {rel for _, rel in recent} | {rel for _, rel in others}
        for stale in [k for k in memo if k not in live]:
            memo.pop(stale, None)
        return {rel: (fallback if locked else None) for rel, locked in memo.items()}


def _lock_owner_from_scan(
    full_p: Path, dir_lock_names: Optional[set], fallback: str, win32_map: Dict[str, Optional[str]], rel_p: str
) -> Optional[str]:
    if dir_lock_names:
        for lc in _lock_artifact_candidates(full_p):
            if lc.name.lower() in dir_lock_names:
                owner = None
                try:
                    owner = _extract_owner_from_office_lock_file(lc)
                except Exception:
                    owner = None
                return owner or fallback
    return win32_map.get(rel_p)


def list_work_files(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    import time as _time

    qp = params or {}
    include_hidden = str(qp.get("includeHidden") or "").lower() in ("1", "true", "yes")
    include_sync_b64 = str(qp.get("includeSyncBase64") or "").lower() in ("1", "true", "yes")
    known_sig = str(qp.get("knownSig") or "").strip()
    vault_dir = get_work_vault_dir(ensure_dirs=True)
    cfg = _load_sdrive_config()
    hidden_rel_set = set(cfg.get("hiddenRelPaths") or [])
    uploader_map: Dict[str, str] = cfg.get("uploaderByRelPath") or {}
    default_author = str(qp.get("author") or cfg.get("hostNickname") or os.environ.get("USERNAME") or "내 PC (로컬)")
    fallback_owner = _fallback_lock_owner(default_author)
    mounted_letter = _mounted_letter_for_vault(vault_dir)

    entries, lock_names_by_dir, scan_complete = _scan_work_vault(vault_dir, hidden_rel_set, include_hidden)
    entries.sort(key=lambda x: x[2].st_mtime, reverse=True)
    win32_map = _win32_lock_owner_map(entries, fallback_owner)

    deadline = _time.monotonic() + _PREVIEW_SYNC_BUDGET_SEC
    pending_count = 0
    sig_h = hashlib.sha256()
    sig_h.update(f"{mounted_letter or ''}|{vault_dir}\n".encode("utf-8", "ignore"))
    files_out: List[Dict[str, Any]] = []
    for full_p, rel_p, st in entries:
        key = _preview_sig_key(full_p, st)
        meta = _get_cached_preview(key)
        if meta is None and _time.monotonic() < deadline:
            meta = _compute_rich_preview(full_p, st)
            _put_cached_preview(key, meta)
        pending = meta is None
        if pending:
            _enqueue_preview(key, full_p)
            pending_count += 1
            ext_low = full_p.suffix.lower()
            meta = {
                "ext": ext_low.lstrip(".").upper() or "FILE",
                "isImage": ext_low in _IMAGE_EXTS,
                "previewText": "",
                "tableHeaders": [],
                "tableRows": [],
                "imageBase64": "",
                "sha256": "",
            }
        folder_id, folder_name, folder_path = _resolve_folder_meta(rel_p, mounted_letter)
        locked_by = _lock_owner_from_scan(
            full_p, lock_names_by_dir.get(os.path.normcase(str(full_p.parent))), fallback_owner, win32_map, rel_p
        )
        is_hidden = rel_p in hidden_rel_set
        sig_h.update(
            f"{rel_p}|{st.st_size}|{st.st_mtime_ns}|{locked_by or ''}|{0 if pending else 1}|{1 if is_hidden else 0}\n".encode(
                "utf-8", "ignore"
            )
        )
        files_out.append(
            {
                "name": full_p.name,
                "relPath": rel_p,
                "fullPath": (_drive_root(mounted_letter) + rel_p.replace("/", "\\")) if mounted_letter else str(full_p),
                "realDiskPath": str(full_p),
                "folderId": folder_id,
                "folderName": folder_name,
                "folderPath": folder_path,
                "ext": meta["ext"],
                "size": st.st_size,
                "sizeFormatted": _format_size(st.st_size),
                "mtime": _iso_utc(st.st_mtime),
                "mtimeFormatted": _format_mtime_ko(st.st_mtime),
                "author": uploader_map.get(rel_p) or default_author,
                "lockedBy": locked_by,
                "isHidden": is_hidden,
                "sha256": meta["sha256"],
                "previewText": meta["previewText"],
                "tableHeaders": meta["tableHeaders"],
                "tableRows": meta["tableRows"],
                "isImage": meta["isImage"],
                "imageBase64": meta["imageBase64"],
                "previewPending": pending,
            }
        )
    list_sig = sig_h.hexdigest()[:40]

    # ── 탐색기에서 직접 지운 파일 감지 (스캔이 100% 완료된 경우에만 · 실제 부재 재확인 후에만) ──
    cur_rel_set = {rel for _, rel, _ in entries}
    vault_key = os.path.normcase(str(vault_dir))
    known_vault = os.path.normcase(str(cfg.get("knownRelPathsVault") or ""))
    prev_known_set = set(cfg.get("knownRelPaths") or []) if known_vault in ("", vault_key) else set()
    locally_deleted: List[str] = []
    if scan_complete:
        for rel in sorted(prev_known_set - cur_rel_set - hidden_rel_set):
            cand = _safe_resolve_inside_vault(vault_dir, rel)
            if cand is not None and cand.exists():
                continue  # 스캔에서 빠졌을 뿐 실제로는 존재 → 절대 삭제로 판정하지 않음
            locally_deleted.append(rel)

    local_tombs: Dict[str, Any] = dict(cfg.get("deletedTombstones") or {})
    resurrected = [
        rel_p
        for _, rel_p, st in entries
        if isinstance(local_tombs.get(rel_p), dict)
        and _parse_iso_mtime_sec(local_tombs[rel_p].get("deletedAt")) > 0
        and st.st_mtime > _parse_iso_mtime_sec(local_tombs[rel_p].get("deletedAt")) + 5.0
    ]
    next_known = sorted(cur_rel_set | (prev_known_set & hidden_rel_set)) if scan_complete else None
    known_changed = next_known is not None and (next_known != sorted(prev_known_set) or known_vault != vault_key)

    if locally_deleted or resurrected or known_changed:
        now_iso = _iso_utc()

        def _apply(cur: Dict[str, Any]) -> None:
            tombs = dict(cur.get("deletedTombstones") or {})
            for del_rel in locally_deleted:
                tombs[del_rel] = {"deletedAt": now_iso, "deletedBy": default_author}
            for rel_p in resurrected:  # 실제 사용자가 새로 저장한 파일(mtime > deletedAt + 5초)은 tombstone 자동 해제
                tombs.pop(rel_p, None)
            cur["deletedTombstones"] = tombs
            if next_known is not None:
                cur["knownRelPaths"] = next_known
                cur["knownRelPathsVault"] = str(vault_dir)

        local_tombs = dict(_mutate_sdrive_config(_apply).get("deletedTombstones") or {})

    resp: Dict[str, Any] = {
        "ok": True,
        "mounted": bool(mounted_letter),
        "driveLetter": mounted_letter or WORK_DRIVE_PREFERRED,
        "targetDir": str(vault_dir),
        "listSig": list_sig,
        "scanComplete": scan_complete,
        "fileCount": len(entries),
        "previewPendingCount": pending_count,
        "locallyDeletedRelPaths": locally_deleted,
        "localDeletedTombstones": local_tombs,
    }
    if known_sig and known_sig == list_sig and not locally_deleted:
        resp["unchanged"] = True  # 변경 없음 → Base64 인코딩 및 수천 개 파일 목록 재전송 완전 생략
        return resp

    if include_sync_b64:
        for item, (full_p, _rel, st) in zip(files_out, entries):
            if st.st_size <= 512 * 1024 and full_p.suffix.lower() not in _BLOCKED_EXEC_EXTS:
                try:
                    item["syncBase64"] = base64.b64encode(full_p.read_bytes()).decode("ascii")
                except Exception:
                    pass
    resp["files"] = files_out
    return resp


def get_work_locks_fast(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """[초경량 실시간 잠금 감지 전용]: 본문 파싱 없이 1패스 스캔으로 잠금파일(~$·.lck·.dwl)을 모아 열람자를 즉시 판정합니다."""
    qp = params or {}
    vault_dir = get_work_vault_dir(ensure_dirs=False)
    if not vault_dir.exists():
        return {"ok": True, "locks": {}, "fileCount": 0}
    cfg = _load_sdrive_config()
    hidden_rel_set = set(cfg.get("hiddenRelPaths") or [])
    default_author = str(qp.get("author") or cfg.get("hostNickname") or os.environ.get("USERNAME") or "현재 PC 사용자")
    fallback_owner = _fallback_lock_owner(default_author)

    entries, lock_names_by_dir, _complete = _scan_work_vault(vault_dir, hidden_rel_set, include_hidden=False)
    win32_map = _win32_lock_owner_map(entries, fallback_owner)
    locks_out: Dict[str, Optional[str]] = {}
    for full_p, rel_p, _st in entries:
        owner = _lock_owner_from_scan(
            full_p, lock_names_by_dir.get(os.path.normcase(str(full_p.parent))), fallback_owner, win32_map, rel_p
        )
        if owner:
            locks_out[rel_p] = owner
    return {
        "ok": True,
        "locks": locks_out,
        "fileCount": len(entries),
    }


def get_single_work_file_sync_payload(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    qp = params or {}
    rel_p = str(qp.get("relPath") or "").strip()
    vault_dir = get_work_vault_dir(ensure_dirs=False)
    target = _safe_resolve_inside_vault(vault_dir, rel_p)
    if target is None or not target.is_file():
        return {"ok": False, "error": "FILE_NOT_FOUND"}
    if target.suffix.lower() in _BLOCKED_EXEC_EXTS:
        return {"ok": False, "error": "BLOCKED_EXECUTABLE_EXTENSION"}
    st = target.stat()
    if st.st_size > 15 * 1024 * 1024:
        return {"ok": False, "error": "FILE_TOO_LARGE_FOR_INLINE_RELAY", "size": st.st_size}
    b64 = base64.b64encode(target.read_bytes()).decode("ascii")
    return {
        "ok": True,
        "relPath": rel_p.replace("\\", "/"),
        "fileName": target.name,
        "size": st.st_size,
        "mtime": _iso_utc(st.st_mtime),
        "base64Data": b64,
    }


def write_uploaded_work_file(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    payload = data or {}
    vault_dir = get_work_vault_dir(ensure_dirs=True)
    raw_name = os.path.basename(str(payload.get("fileName") or "").strip())
    rel_path = str(payload.get("relPath") or "").strip().replace("\\", "/").lstrip("/")
    folder_id = str(payload.get("folderId") or "").strip()
    b64_raw = str(payload.get("base64Data") or "").strip()
    uploader = str(payload.get("author") or payload.get("uploaderNickname") or "").strip()

    if not rel_path:
        if not raw_name:
            return {"ok": False, "error": "EMPTY_FILE_NAME"}
        sub_map = dict(SUBFOLDER_SPECS)
        if folder_id in sub_map:
            rel_path = f"{sub_map[folder_id]}/{raw_name}"
        else:
            ext_l = Path(raw_name).suffix.lower()
            if ext_l in (".xlsx", ".xls", ".csv"):
                rel_path = f"02_견적서_엑셀문서/{raw_name}"
            elif ext_l in (".hwp", ".hwpx", ".docx", ".doc"):
                rel_path = f"01_계약서_법무문서/{raw_name}"
            elif ext_l in _IMAGE_EXTS or ext_l in (".dwg", ".dxf", ".mp4", ".mov"):
                rel_path = f"04_현장시공_도면_미디어/{raw_name}"
            else:
                rel_path = raw_name

    target = _safe_resolve_inside_vault(vault_dir, rel_path)
    if target is None:
        return {"ok": False, "error": "INVALID_RELATIVE_PATH"}
    if target.suffix.lower() in _BLOCKED_EXEC_EXTS:
        return {"ok": False, "error": "BLOCKED_EXECUTABLE_EXTENSION"}
    if not b64_raw:
        return {"ok": False, "error": "EMPTY_FILE_CONTENT"}

    if b64_raw.startswith("data:") and "," in b64_raw:
        b64_raw = b64_raw.split(",", 1)[1]

    if len(b64_raw) > (WORK_MAX_FILE_BYTES * 4) // 3 + 8:
        return {"ok": False, "error": "EXCEEDS_50MB_LIMIT"}
    try:
        file_bytes = base64.b64decode(b64_raw)
    except Exception as exc:
        return {"ok": False, "error": f"INVALID_BASE64: {exc}"}
    if len(file_bytes) > WORK_MAX_FILE_BYTES:
        return {"ok": False, "error": "EXCEEDS_50MB_LIMIT", "size": len(file_bytes)}

    if detect_file_lock_owner(target):
        return {"ok": False, "error": "FILE_CURRENTLY_LOCKED_OPEN"}

    target.parent.mkdir(parents=True, exist_ok=True)
    tmp_p = target.with_name(f".{target.name}.ghosti_sync_tmp")
    tmp_p.write_bytes(file_bytes)
    os.replace(tmp_p, target)

    def _apply_upload(cur: Dict[str, Any]) -> None:
        if uploader:
            up_map = dict(cur.get("uploaderByRelPath") or {})
            up_map[rel_path] = uploader
            cur["uploaderByRelPath"] = up_map
        tombs_up = dict(cur.get("deletedTombstones") or {})
        if rel_path in tombs_up:
            tombs_up.pop(rel_path, None)
            cur["deletedTombstones"] = tombs_up

    _mutate_sdrive_config(_apply_upload)

    # Ensure the work drive is mounted when writing on Windows
    mount_res = mount_or_unmount_s_drive({"action": "mount", "openExplorer": False})
    letter = mount_res.get("driveLetter") if mount_res.get("mounted") else None
    return {
        "ok": True,
        "relPath": rel_path,
        "savedPath": str(target),
        "sDrivePath": (_drive_root(letter) + rel_path.replace("/", "\\")) if letter else str(target),
        "driveLetter": letter or WORK_DRIVE_PREFERRED,
        "size": len(file_bytes),
    }


def _parse_iso_mtime_sec(raw_iso: Any) -> float:
    s = str(raw_iso or "").strip()
    if not s:
        return 0.0
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s).timestamp()
    except Exception:
        return 0.0


def _move_to_recycle_bin_safe(target: Path) -> bool:
    """OS [휴지통]으로만 이동합니다. 휴지통 이동이 실패하면 절대 영구 삭제하지 않고 False를 반환합니다.
    (명세 8.3-③: 귀신같이 앱은 어떤 경우에도 스스로 파일을 영구 삭제하지 않음)"""
    if not target.exists():
        return True
    if os.name != "nt":
        return False
    try:
        class SHFILEOPSTRUCTW(ctypes.Structure):
            _fields_ = [
                ("hwnd", ctypes.c_void_p),
                ("wFunc", ctypes.c_uint),
                ("pFrom", ctypes.c_wchar_p),
                ("pTo", ctypes.c_wchar_p),
                ("fFlags", ctypes.c_ushort),
                ("fAnyOperationsAborted", ctypes.c_int),
                ("hNameMappings", ctypes.c_void_p),
                ("lpszProgressTitle", ctypes.c_wchar_p),
            ]

        op = SHFILEOPSTRUCTW()
        op.hwnd = None
        op.wFunc = 0x0003  # FO_DELETE
        op.pFrom = str(target) + "\x00\x00"
        op.pTo = None
        # ALLOWUNDO | NOCONFIRMATION | SILENT | NOERRORUI | WANTNUKEWARNING
        # WANTNUKEWARNING(0x4000): 휴지통에 못 넣는 경우(용량 초과 등) 조용히 영구삭제하지 않고 실패 처리
        op.fFlags = 0x0040 | 0x0010 | 0x0004 | 0x0400 | 0x4000
        rc = ctypes.windll.shell32.SHFileOperationW(ctypes.byref(op))
        return rc == 0 and not op.fAnyOperationsAborted and not target.exists()
    except Exception:
        return False


def pull_sync_work_files(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """초대받은 팀원(또는 방장) PC에 Z-코어가 연결되면 원격 공유 업무파일 목록을 S:\\ 로컬 폴더로 무결성 동기화합니다."""
    payload = data or {}
    incoming = payload.get("files")
    tombstones = payload.get("deletedTombstones") or {}
    if not isinstance(incoming, list):
        incoming = []

    vault_dir = get_work_vault_dir(ensure_dirs=True)
    mount_or_unmount_s_drive({"action": "mount", "openExplorer": False})
    cfg = _load_sdrive_config()
    up_map = dict(cfg.get("uploaderByRelPath") or {})
    merged_tombstones: Dict[str, Any] = dict(cfg.get("deletedTombstones") or {})
    if isinstance(tombstones, dict):
        for tk, tv in tombstones.items():
            clean_tk = str(tk or "").strip().replace("\\", "/").lstrip("/")
            if clean_tk:
                merged_tombstones[clean_tk] = tv

    removed_by_tombstone = 0
    removed_rel_set: set = set()
    added_rel_set: set = set()
    revived_rel_set: set = set()
    for t_rel, t_info in merged_tombstones.items():
        clean_t = str(t_rel or "").strip().replace("\\", "/").lstrip("/")
        target_t = _safe_resolve_inside_vault(vault_dir, clean_t)
        if target_t and target_t.is_file() and not detect_file_lock_owner(target_t):
            del_ts = _parse_iso_mtime_sec(t_info.get("deletedAt") if isinstance(t_info, dict) else "")
            if del_ts <= 0 or target_t.stat().st_mtime <= del_ts + 5.0:
                if _move_to_recycle_bin_safe(target_t):
                    removed_rel_set.add(clean_t)
                    removed_by_tombstone += 1

    synced = 0
    skipped = 0
    for item in incoming:
        if not isinstance(item, dict):
            continue
        rel_p = str(item.get("relPath") or "").strip().replace("\\", "/").lstrip("/")
        b64_raw = str(item.get("base64Data") or item.get("inlineSyncBase64") or "").strip()
        remote_sha = str(item.get("sha256") or "").strip()
        remote_mtime = _parse_iso_mtime_sec(item.get("fileMtimeIso") or item.get("fileMtime"))
        uploader = str(item.get("uploaderNickname") or item.get("author") or "").strip()
        if not rel_p or not b64_raw:
            skipped += 1
            continue
        tomb_entry = merged_tombstones.get(rel_p)
        if tomb_entry is not None:
            del_ts = _parse_iso_mtime_sec(tomb_entry.get("deletedAt") if isinstance(tomb_entry, dict) else "")
            if del_ts <= 0 or remote_mtime <= 0 or remote_mtime <= del_ts + 5.0:
                skipped += 1
                continue
            merged_tombstones.pop(rel_p, None)
            revived_rel_set.add(rel_p)

        target = _safe_resolve_inside_vault(vault_dir, rel_p)
        if target is None or target.suffix.lower() in _BLOCKED_EXEC_EXTS:
            skipped += 1
            continue

        if target.exists() and target.is_file():
            if detect_file_lock_owner(target):
                skipped += 1
                continue
            st = target.stat()
            if remote_sha:
                local_meta = _extract_rich_preview_cached(target, st)
                if local_meta.get("sha256") == remote_sha:
                    if uploader and up_map.get(rel_p) != uploader:
                        up_map[rel_p] = uploader
                    added_rel_set.add(rel_p)
                    skipped += 1
                    continue
            # [최신본 보호 가드]: 원격 수정시각을 알 수 없거나(0) 내 로컬 파일이 2초 이상 더 최신이면 덮어쓰지 않음!
            if remote_mtime <= 0 or st.st_mtime > remote_mtime + 2.0:
                skipped += 1
                continue

        if b64_raw.startswith("data:") and "," in b64_raw:
            b64_raw = b64_raw.split(",", 1)[1]
        if len(b64_raw) > (WORK_MAX_FILE_BYTES * 4) // 3 + 8:
            skipped += 1
            continue
        try:
            raw_bytes = base64.b64decode(b64_raw)
            target.parent.mkdir(parents=True, exist_ok=True)
            tmp_p = target.with_name(f".{target.name}.ghosti_sync_tmp")
            tmp_p.write_bytes(raw_bytes)
            os.replace(tmp_p, target)
            if remote_mtime > 0:
                try:
                    os.utime(target, (remote_mtime, remote_mtime))
                except Exception:
                    pass
            if uploader:
                up_map[rel_p] = uploader
            added_rel_set.add(rel_p)
            synced += 1
        except Exception:
            skipped += 1

    def _apply_pull(cur: Dict[str, Any]) -> None:
        cur["knownRelPaths"] = sorted((set(cur.get("knownRelPaths") or []) - removed_rel_set) | added_rel_set)
        cur["knownRelPathsVault"] = str(vault_dir)
        tombs_now = dict(cur.get("deletedTombstones") or {})
        tombs_now.update(merged_tombstones)
        for rel_ok in revived_rel_set:
            tombs_now.pop(rel_ok, None)
        cur["deletedTombstones"] = tombs_now
        if up_map != (cfg.get("uploaderByRelPath") or {}):
            cur_up = dict(cur.get("uploaderByRelPath") or {})
            cur_up.update(up_map)
            cur["uploaderByRelPath"] = cur_up

    _mutate_sdrive_config(_apply_pull)
    mounted_letter = _mounted_letter_for_vault(vault_dir)

    return {
        "ok": True,
        "mounted": bool(mounted_letter),
        "driveLetter": mounted_letter or WORK_DRIVE_PREFERRED,
        "targetDir": str(vault_dir),
        "syncedCount": synced,
        "removedByTombstoneCount": removed_by_tombstone,
        "skippedCount": skipped,
    }


def _is_allowed_signed_storage_url(url: str) -> bool:
    """서명 URL은 Supabase Storage(https://<project>.supabase.co/storage/...)만 허용 — 임의 내부망·외부 주소 호출(SSRF) 차단."""
    try:
        import urllib.parse as _up

        u = _up.urlparse(str(url or "").strip())
        host = (u.hostname or "").lower()
        return u.scheme == "https" and host.endswith(".supabase.co") and u.path.startswith("/storage/")
    except Exception:
        return False


def push_work_blob_to_signed_url(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """512KB 초과 ~ 50MB 대용량 업무 파일(XLSX/PDF/HWP/현장사진)을 브라우저 메모리 거치지 않고 서명 URL로 직접 전송합니다."""
    payload = data or {}
    rel_p = str(payload.get("relPath") or "").strip().replace("\\", "/").lstrip("/")
    signed_url = str(payload.get("signedUploadUrl") or "").strip()
    if not rel_p or not _is_allowed_signed_storage_url(signed_url):
        return {"ok": False, "error": "INVALID_PUSH_BLOB_ARGS"}
    vault_dir = get_work_vault_dir(ensure_dirs=False)
    target = _safe_resolve_inside_vault(vault_dir, rel_p)
    if target is None or not target.is_file():
        return {"ok": False, "error": "FILE_NOT_FOUND"}
    if target.suffix.lower() in _BLOCKED_EXEC_EXTS:
        return {"ok": False, "error": "BLOCKED_EXECUTABLE_EXTENSION"}
    st = target.stat()
    if st.st_size > 50 * 1024 * 1024:
        return {"ok": False, "error": "EXCEEDS_50MB_LIMIT", "size": st.st_size}
    try:
        raw_bytes = target.read_bytes()
        req = urllib.request.Request(
            signed_url,
            data=raw_bytes,
            headers={"Content-Type": "application/octet-stream"},
            method="PUT",
        )
        with urllib.request.urlopen(req, timeout=45) as resp:
            ok_up = 200 <= resp.status < 300
        return {"ok": ok_up, "relPath": rel_p, "size": st.st_size}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def pull_work_blob_from_signed_url(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """원격 팀원/방장이 공유한 512KB 초과 대용량 업무 파일을 서명 URL에서 내 S:\\ 폴더로 직접 수신합니다."""
    payload = data or {}
    rel_p = str(payload.get("relPath") or "").strip().replace("\\", "/").lstrip("/")
    signed_url = str(payload.get("signedDownloadUrl") or "").strip()
    remote_sha = str(payload.get("sha256") or "").strip()
    remote_mtime = _parse_iso_mtime_sec(payload.get("fileMtimeIso") or payload.get("fileMtime"))
    uploader = str(payload.get("uploaderNickname") or payload.get("author") or "").strip()

    if not rel_p or not _is_allowed_signed_storage_url(signed_url):
        return {"ok": False, "error": "INVALID_PULL_BLOB_ARGS"}
    vault_dir = get_work_vault_dir(ensure_dirs=True)
    mount_or_unmount_s_drive({"action": "mount", "openExplorer": False})
    target = _safe_resolve_inside_vault(vault_dir, rel_p)
    if target is None or target.suffix.lower() in _BLOCKED_EXEC_EXTS:
        return {"ok": False, "error": "BLOCKED_OR_INVALID_PATH"}

    cfg_pre = _load_sdrive_config()
    local_tombs_pre = dict(cfg_pre.get("deletedTombstones") or {})
    tomb_entry = local_tombs_pre.get(rel_p)
    if isinstance(tomb_entry, dict):
        del_ts = _parse_iso_mtime_sec(tomb_entry.get("deletedAt"))
        if del_ts <= 0 or remote_mtime <= 0 or remote_mtime <= del_ts + 5.0:
            return {"ok": True, "skippedByTombstone": True, "relPath": rel_p}

    if target.exists() and target.is_file():
        if detect_file_lock_owner(target):
            return {"ok": False, "error": "FILE_CURRENTLY_LOCKED_OPEN"}
        st = target.stat()
        if remote_sha:
            local_meta = _extract_rich_preview_cached(target, st)
            if local_meta.get("sha256") == remote_sha:
                return {"ok": True, "alreadySynced": True, "relPath": rel_p}
        if remote_mtime <= 0 or st.st_mtime > remote_mtime + 2.0:
            return {"ok": True, "skippedNewerLocal": True, "relPath": rel_p}

    try:
        req = urllib.request.Request(signed_url, method="GET")
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw_bytes = resp.read(WORK_MAX_FILE_BYTES + 1)
        if len(raw_bytes) > WORK_MAX_FILE_BYTES:
            return {"ok": False, "error": "EXCEEDS_50MB_LIMIT"}
        target.parent.mkdir(parents=True, exist_ok=True)
        tmp_p = target.with_name(f".{target.name}.ghosti_sync_tmp")
        tmp_p.write_bytes(raw_bytes)
        os.replace(tmp_p, target)
        if remote_mtime > 0:
            try:
                os.utime(target, (remote_mtime, remote_mtime))
            except Exception:
                pass
        def _apply_blob(cur: Dict[str, Any]) -> None:
            cur["knownRelPaths"] = sorted(set(cur.get("knownRelPaths") or []) | {rel_p})
            if uploader:
                up_map = dict(cur.get("uploaderByRelPath") or {})
                up_map[rel_p] = uploader
                cur["uploaderByRelPath"] = up_map

        _mutate_sdrive_config(_apply_blob)
        return {"ok": True, "relPath": rel_p, "size": len(raw_bytes)}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def delete_or_apply_tombstones(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """로컬 S:\\ 업무 파일을 OS 휴지통으로 안전 이동시키고 knownRelPaths 제거 + 영구 Tombstone 원장을 기록해 새로고침/동기화 역류(부활)를 100% 차단합니다."""
    payload = data or {}
    rel_p = str(payload.get("relPath") or "").strip().replace("\\", "/").lstrip("/")
    actor = str(payload.get("actorNickname") or os.environ.get("USERNAME") or "팀원").strip()
    deleted_at = str(payload.get("deletedAt") or "").strip() or _iso_utc()
    if not rel_p:
        return {"ok": False, "error": "EMPTY_REL_PATH"}
    vault_dir = get_work_vault_dir(ensure_dirs=False)
    target = _safe_resolve_inside_vault(vault_dir, rel_p)
    if target is None:
        return {"ok": False, "error": "INVALID_REL_PATH"}
    if target.exists() and detect_file_lock_owner(target):
        return {"ok": False, "error": "FILE_CURRENTLY_LOCKED_OPEN"}

    ok_del = _move_to_recycle_bin_safe(target) if target.exists() else True
    if not ok_del:
        # 휴지통 이동 실패 → 파일은 그대로 두고(영구삭제 금지) Tombstone도 남기지 않음
        return {
            "ok": False,
            "error": "RECYCLE_BIN_MOVE_FAILED",
            "relPath": rel_p,
            "message": "휴지통으로 옮기지 못해 파일을 그대로 두었어요.",
        }

    def _apply_delete(cur: Dict[str, Any]) -> None:
        known = set(cur.get("knownRelPaths") or [])
        known.discard(rel_p)
        cur["knownRelPaths"] = sorted(known)
        tombs = dict(cur.get("deletedTombstones") or {})
        tombs[rel_p] = {"deletedAt": deleted_at, "deletedBy": actor}
        cur["deletedTombstones"] = tombs

    local_tombs = dict(_mutate_sdrive_config(_apply_delete).get("deletedTombstones") or {})
    return {"ok": True, "relPath": rel_p, "deletedAt": deleted_at, "localDeletedTombstones": local_tombs}


def toggle_hide_work_file(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    payload = data or {}
    rel_p = str(payload.get("relPath") or "").strip().replace("\\", "/").lstrip("/")
    if not rel_p:
        return {"ok": False, "error": "EMPTY_REL_PATH"}
    state = {"hidden": False}

    def _apply_hide(cur: Dict[str, Any]) -> None:
        cur_list = list(cur.get("hiddenRelPaths") or [])
        if rel_p in cur_list:
            cur["hiddenRelPaths"] = [x for x in cur_list if x != rel_p]
            state["hidden"] = False
        else:
            cur_list.append(rel_p)
            cur["hiddenRelPaths"] = cur_list
            state["hidden"] = True

    _mutate_sdrive_config(_apply_hide)
    return {"ok": True, "relPath": rel_p, "hidden": state["hidden"]}


def resolve_work_download_file(params: Dict[str, Any] | None = None) -> Tuple[Optional[Path], str, int]:
    qp = params or {}
    rel_p = str(qp.get("relPath") or qp.get("p") or "").strip()
    vault_dir = get_work_vault_dir(ensure_dirs=False)
    target = _safe_resolve_inside_vault(vault_dir, rel_p)
    if target is None or not target.is_file():
        return None, "application/octet-stream", 404
    mime = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    return target, mime, 200


# ─────────────────────────────────────────────────────────────────────────────
# [상시 아웃바운드 HTTPS 직통 터널 (특허 제2호 Stage 2 — 방화벽·LTE 0초 통과 & 서버 파일 저장 0 Byte)]
# 24시간 켜두는 회사 대장 PC의 PC 엔진이 안에서 밖으로(Outbound 443) 암호화 터널을 미리 열어두어
# 외부 팀원이 대기시간 0초로 S:\에 직결되며, 모든 외부 요청은 방 전용 256-bit 접근 키(X-Ghosti-Work-Key)로 검증합니다.
# ─────────────────────────────────────────────────────────────────────────────
_TUNNEL_LOCK = threading.Lock()
_TUNNEL_STATE: Dict[str, Any] = {
    "proc": None,
    "url": "",
    "status": "idle",  # idle | downloading_binary | starting | connected | error | stopped
    "error": "",
    "startedAt": "",
}
_CLOUDFLARED_RELEASE_URL = (
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
)
_TRYCLOUDFLARE_URL_RE = re.compile(r"(https://[a-z0-9-]+\.trycloudflare\.com)", re.IGNORECASE)


def get_or_create_work_access_key(rotate: bool = False) -> str:
    cfg = _load_sdrive_config()
    cur_key = str(cfg.get("workRoomAccessKey") or "").strip()
    if cur_key and len(cur_key) >= 24 and not rotate:
        return cur_key
    new_key = secrets.token_urlsafe(24)
    _save_sdrive_config({"workRoomAccessKey": new_key})
    return new_key


def verify_tunnel_access_key(provided_key: Optional[str], is_external_tunnel_req: bool) -> bool:
    """외부 터널(*.trycloudflare.com / CF-Connecting-IP) 경유 요청은 반드시 방 전용 비밀 키가 일치해야만 통과합니다."""
    if not is_external_tunnel_req:
        return True
    expected = get_or_create_work_access_key(rotate=False)
    cand = str(provided_key or "").strip()
    if not cand or not expected:
        return False
    try:
        return hmac.compare_digest(cand.encode("utf-8"), expected.encode("utf-8"))
    except Exception:
        return False


def _find_or_download_cloudflared_binary() -> Optional[Path]:
    bin_dir = _get_merlin_appdata_dir() / "bin"
    bin_dir.mkdir(parents=True, exist_ok=True)
    local_bin = bin_dir / "cloudflared.exe"
    if local_bin.is_file() and local_bin.stat().st_size > 5 * 1024 * 1024:
        return local_bin
    which_p = shutil.which("cloudflared")
    if which_p:
        return Path(which_p)
    if os.name != "nt" or os.environ.get("GHOSTI_DISABLE_TUNNEL_DOWNLOAD") == "1":
        return None
    with _TUNNEL_LOCK:
        _TUNNEL_STATE["status"] = "downloading_binary"
    tmp_bin = bin_dir / f"cloudflared_{os.getpid()}.tmp"
    try:
        req = urllib.request.Request(
            _CLOUDFLARED_RELEASE_URL,
            headers={"User-Agent": "MerlinZCore/2.7.1"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
        if len(data) > 5 * 1024 * 1024:
            tmp_bin.write_bytes(data)
            os.replace(tmp_bin, local_bin)
            return local_bin
    except Exception as exc:
        with _TUNNEL_LOCK:
            _TUNNEL_STATE["status"] = "error"
            _TUNNEL_STATE["error"] = f"TUNNEL_BINARY_DOWNLOAD_FAILED: {exc}"
    finally:
        try:
            tmp_bin.unlink(missing_ok=True)
        except Exception:
            pass
    return None


def stop_outbound_work_tunnel() -> Dict[str, Any]:
    with _TUNNEL_LOCK:
        proc = _TUNNEL_STATE.get("proc")
        _TUNNEL_STATE["proc"] = None
        _TUNNEL_STATE["url"] = ""
        _TUNNEL_STATE["status"] = "stopped"
    if proc is not None:
        try:
            proc.terminate()
            proc.wait(timeout=3)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
    _save_sdrive_config({"lastTunnelUrl": ""})
    return {"ok": True, "status": "stopped", "tunnelUrl": ""}


atexit.register(lambda: stop_outbound_work_tunnel())


def get_outbound_work_tunnel_status() -> Dict[str, Any]:
    cfg = _load_sdrive_config()
    access_key = get_or_create_work_access_key(rotate=False)
    with _TUNNEL_LOCK:
        proc = _TUNNEL_STATE.get("proc")
        alive = proc is not None and (proc.poll() is None)
        url = str(_TUNNEL_STATE.get("url") or "") if alive else ""
        status = str(_TUNNEL_STATE.get("status") or "idle")
        if not alive and status in ("connected", "starting"):
            status = "stopped"
            _TUNNEL_STATE["status"] = status
            _TUNNEL_STATE["url"] = ""
        err = str(_TUNNEL_STATE.get("error") or "")
    return {
        "ok": True,
        "status": status,
        "alive": alive,
        "tunnelUrl": url,
        "accessKey": access_key,
        "error": err,
        "nightPowerSaveEnabled": bool(cfg.get("nightPowerSaveEnabled")),
    }


def _cleanup_orphan_cloudflared_processes(keep_pid: int = 0) -> None:
    """이전 Z-코어 세션에서 종료되지 않고 남은 고아 cloudflared.exe(--url http://127.0.0.1:5199) 프로세스를 정리해 26개 중복 누수를 원천 차단합니다."""
    if os.name != "nt":
        return
    try:
        ps_cmd = (
            f"$kp={int(keep_pid or 0)}; "
            "Get-CimInstance Win32_Process -Filter \"Name='cloudflared.exe'\" -ErrorAction SilentlyContinue | "
            "Where-Object { $_.ProcessId -ne $kp -and $_.CommandLine -like '*127.0.0.1:5199*' } | "
            "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
        )
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_cmd],
            capture_output=True,
            timeout=3.0,
            creationflags=_CREATE_NO_WINDOW,
        )
    except Exception:
        pass


def ensure_outbound_work_tunnel(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """대장 PC에서 상시 아웃바운드 HTTPS 직통 터널을 기동합니다 (방화벽 인바운드 포트 개방 불필요 · 단일 인스턴스 락으로 중복 스폰 0%)."""
    cfg = _load_sdrive_config()
    if cfg.get("workEntitlementLocked") is True:
        stop_outbound_work_tunnel()
        return {
            "ok": False,
            "error": "WORK_SUBSCRIPTION_LOCKED",
            "status": "locked",
            "tunnelUrl": "",
        }

    with _TUNNEL_LOCK:
        proc_existing = _TUNNEL_STATE.get("proc")
        alive_existing = proc_existing is not None and (proc_existing.poll() is None)
        cur_status = str(_TUNNEL_STATE.get("status") or "idle")
        cur_url = str(_TUNNEL_STATE.get("url") or "")
        if alive_existing and cur_url:
            return get_outbound_work_tunnel_status()
        if cur_status in ("starting", "downloading_binary"):
            return get_outbound_work_tunnel_status()
        # 동시 요청 경합(Race Condition)으로 2개 이상 스폰되지 않도록 락 안에서 즉시 starting 선점!
        _TUNNEL_STATE["status"] = "starting"
        _TUNNEL_STATE["error"] = ""

    def _spawn_worker() -> None:
        _cleanup_orphan_cloudflared_processes(keep_pid=0)
        bin_p = _find_or_download_cloudflared_binary()
        if bin_p is None:
            with _TUNNEL_LOCK:
                if _TUNNEL_STATE["status"] != "error":
                    _TUNNEL_STATE["status"] = "error"
                    _TUNNEL_STATE["error"] = "CLOUDFLARED_BINARY_UNAVAILABLE"
            return
        with _TUNNEL_LOCK:
            _TUNNEL_STATE["status"] = "starting"
            _TUNNEL_STATE["error"] = ""
        try:
            proc = subprocess.Popen(
                [
                    str(bin_p),
                    "tunnel",
                    "--url",
                    "http://127.0.0.1:5199",
                    "--no-autoupdate",
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="ignore",
                creationflags=_CREATE_NO_WINDOW,
            )
            with _TUNNEL_LOCK:
                _TUNNEL_STATE["proc"] = proc
                _TUNNEL_STATE["startedAt"] = _iso_utc()
            assert proc.stdout is not None
            for line in proc.stdout:
                m = _TRYCLOUDFLARE_URL_RE.search(line or "")
                if m:
                    found_url = m.group(1).rstrip("/")
                    with _TUNNEL_LOCK:
                        _TUNNEL_STATE["url"] = found_url
                        _TUNNEL_STATE["status"] = "connected"
                    _save_sdrive_config({"lastTunnelUrl": found_url})
        except Exception as exc:
            with _TUNNEL_LOCK:
                _TUNNEL_STATE["status"] = "error"
                _TUNNEL_STATE["error"] = str(exc)

    threading.Thread(target=_spawn_worker, name="ghosti-work-outbound-tunnel", daemon=True).start()
    return get_outbound_work_tunnel_status()


# ─────────────────────────────────────────────────────────────────────────────
# [🌙 야간·퇴근 초절전 모드] (모니터 즉시 절전 OFF + 본체 수면 방지로 밤새 팀원 24시간 직결 유지)
# ─────────────────────────────────────────────────────────────────────────────
def set_night_power_save_mode(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    payload = data or {}
    enable = bool(payload.get("enabled", True))
    turn_off_monitor = bool(payload.get("turnOffMonitor", enable))
    ES_CONTINUOUS = 0x80000000
    ES_SYSTEM_REQUIRED = 0x00000001
    ES_AWAYMODE_REQUIRED = 0x00000040

    applied_exec_state = False
    monitor_turned_off = False
    if os.name == "nt":
        try:
            k32 = ctypes.windll.kernel32
            flags = (ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_AWAYMODE_REQUIRED) if enable else ES_CONTINUOUS
            res = k32.SetThreadExecutionState(ctypes.c_uint(flags))
            applied_exec_state = bool(res)
        except Exception:
            applied_exec_state = False

        if enable and turn_off_monitor and os.environ.get("GHOSTI_HEADLESS_TEST") != "1":
            try:
                # HWND_BROADCAST(0xFFFF), WM_SYSCOMMAND(0x0112), SC_MONITORPOWER(0xF170), 2(모니터 전원 OFF)
                ctypes.windll.user32.PostMessageW(0xFFFF, 0x0112, 0xF170, 2)
                monitor_turned_off = True
            except Exception:
                monitor_turned_off = False

    _save_sdrive_config({
        "nightPowerSaveEnabled": enable,
        "nightPowerSaveUpdatedAt": _iso_utc(),
    })
    return {
        "ok": True,
        "enabled": enable,
        "appliedExecutionState": applied_exec_state,
        "monitorTurnedOff": monitor_turned_off,
        "message": (
            "🌙 야간·퇴근 초절전 모드가 켜졌습니다. 모니터는 절전으로 꺼지고 PC 엔진과 S: 드라이브 직통 연결은 24시간 깨어 있습니다."
            if enable
            else "☀️ 야간·퇴근 초절전 모드를 해제하고 일반 전원 모드로 돌아왔습니다."
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# [🛡️ 백업 PC (예비 서버 1·2호)] — 대장 PC 고장·도난 대비 업무 폴더(S:) 이중화 설정 및 실제 증분 예비 백업
# ─────────────────────────────────────────────────────────────────────────────
def manage_backup_server_nodes(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    payload = data or {}
    act = str(payload.get("subAction") or payload.get("action") or "get").strip().lower()
    cfg = _load_sdrive_config()
    default_master = str(cfg.get("masterServerName") or os.environ.get("COMPUTERNAME") or "사내 대장 PC (S:)")
    cur_nodes: List[Dict[str, Any]] = list(cfg.get("backupServers") or [])
    local_backup_dir_str = str(cfg.get("localBackupServerDir") or "").strip()

    if act == "save":
        new_master = str(payload.get("masterServerName") or default_master).strip()[:48] or default_master
        raw_nodes = payload.get("backupServers")
        clean_nodes: List[Dict[str, Any]] = []
        if isinstance(raw_nodes, list):
            for idx, item in enumerate(raw_nodes[:2]):  # 예비 서버 최대 2대 (1호·2호)
                if not isinstance(item, dict):
                    continue
                label = str(item.get("label") or "").strip()[:48]
                if not label:
                    continue
                clean_nodes.append({
                    "id": str(item.get("id") or f"backup-{idx + 1}"),
                    "slot": idx + 1,
                    "label": label,
                    "role": f"예비 서버 {idx + 1}호",
                    "status": str(item.get("status") or "대기·자동 이중화"),
                    "updatedAt": _iso_utc(),
                })
        patch: Dict[str, Any] = {
            "masterServerName": new_master,
            "backupServers": clean_nodes,
        }
        if "localBackupServerDir" in payload:
            raw_bdir = str(payload.get("localBackupServerDir") or "").strip()
            if raw_bdir:
                valid_b, reason = _validate_custom_work_target(raw_bdir)
                if valid_b is None:
                    return {"ok": False, "error": "INVALID_BACKUP_DIR", "reason": reason}
                patch["localBackupServerDir"] = str(valid_b)
                local_backup_dir_str = str(valid_b)
            else:
                patch["localBackupServerDir"] = ""
                local_backup_dir_str = ""
        _save_sdrive_config(patch)
        cur_nodes = clean_nodes
        default_master = new_master

    synced_files = 0
    if act == "sync-now":
        vault_dir = get_work_vault_dir(ensure_dirs=True)
        target_bdir_str = str(payload.get("localBackupServerDir") or local_backup_dir_str).strip()
        if not target_bdir_str:
            target_bdir = _get_merlin_appdata_dir() / "업무공유_예비서버_백업"
        else:
            valid_b, reason = _validate_custom_work_target(target_bdir_str)
            if valid_b is None:
                return {"ok": False, "error": "INVALID_BACKUP_DIR", "reason": reason}
            target_bdir = valid_b
        if _same_path(target_bdir, vault_dir):
            return {"ok": False, "error": "BACKUP_DIR_SAME_AS_VAULT"}
        target_bdir.mkdir(parents=True, exist_ok=True)
        entries, _locks, _complete = _scan_work_vault(vault_dir, set(), include_hidden=True)
        for full_p, rel_p, st in entries:
            dest = _safe_resolve_inside_vault(target_bdir, rel_p)
            if dest is None:
                continue
            try:
                if dest.is_file():
                    dst_st = dest.stat()
                    if dst_st.st_size == st.st_size and abs(dst_st.st_mtime - st.st_mtime) < 1.0:
                        continue
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(full_p, dest)
                synced_files += 1
            except Exception:
                pass
        now_iso = _iso_utc()
        local_backup_dir_str = str(target_bdir)
        _save_sdrive_config({
            "localBackupServerDir": local_backup_dir_str,
            "lastBackupSyncedAt": now_iso,
            "lastBackupSyncedCount": len(entries),
        })
        cfg = _load_sdrive_config()

    return {
        "ok": True,
        "masterServerName": default_master,
        "backupServers": cur_nodes,
        "localBackupServerDir": local_backup_dir_str,
        "lastBackupSyncedAt": str(cfg.get("lastBackupSyncedAt") or ""),
        "lastBackupSyncedCount": int(cfg.get("lastBackupSyncedCount") or 0),
        "newlyCopiedCount": synced_files,
    }


# ─────────────────────────────────────────────────────────────────────────────
# [과금·체험 권한 게이트 & 계정/방 격리 동기화]
# - 만료/미개통(unlocked=False) 시: 즉시 S: 드라이브 연결 해제(폴더 내 원본 파일은 100% 보존) + 외부 터널 종료
# - 계정(email) 또는 방(roomId) 변경 시: 이전 계정의 knownRelPaths·Tombstone을 계정별 슬롯으로 분리해 혼입 0% 보장
# ─────────────────────────────────────────────────────────────────────────────
def sync_work_entitlement_state(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    payload = data or {}
    unlocked = bool(payload.get("unlocked", False))
    email = str(payload.get("email") or "").strip().lower()
    room_id = str(payload.get("roomId") or "").strip()
    plan_id = str(payload.get("planId") or "").strip()
    reason = str(payload.get("reason") or "").strip()
    is_host = bool(payload.get("isHost", False))

    def _apply_ent(cur: Dict[str, Any]) -> None:
        prev_email = str(cur.get("activeAccountEmail") or "").strip().lower()
        prev_room = str(cur.get("activeWorkRoomId") or "").strip()
        by_scope: Dict[str, Any] = dict(cur.get("scopedWorkLedgers") or {})

        # 기존 계정·방의 원장을 슬롯에 백업하고 새 계정·방 원장으로 전환 (계정 A → B 전환 시 혼입 차단)
        if prev_email or prev_room:
            prev_key = f"{prev_email}::{prev_room}"
            by_scope[prev_key] = {
                "knownRelPaths": list(cur.get("knownRelPaths") or []),
                "deletedTombstones": dict(cur.get("deletedTombstones") or {}),
                "uploaderByRelPath": dict(cur.get("uploaderByRelPath") or {}),
                "hiddenRelPaths": list(cur.get("hiddenRelPaths") or []),
            }
        new_key = f"{email}::{room_id}"
        if (email != prev_email or room_id != prev_room) and (email or room_id):
            restored = by_scope.get(new_key) if isinstance(by_scope.get(new_key), dict) else {}
            cur["knownRelPaths"] = list(restored.get("knownRelPaths") or [])
            cur["deletedTombstones"] = dict(restored.get("deletedTombstones") or {})
            cur["uploaderByRelPath"] = dict(restored.get("uploaderByRelPath") or {})
            cur["hiddenRelPaths"] = list(restored.get("hiddenRelPaths") or [])

        cur["scopedWorkLedgers"] = by_scope
        cur["activeAccountEmail"] = email
        cur["activeWorkRoomId"] = room_id
        cur["workEntitlementLocked"] = not unlocked
        cur["workPlanId"] = plan_id
        cur["workLockReason"] = "" if unlocked else (reason or "SUBSCRIPTION_REQUIRED")
        cur["workEntitlementSyncedAt"] = _iso_utc()

    _mutate_sdrive_config(_apply_ent)

    if not unlocked:
        # 멀린님 확정 (가): 체험/구독 종료 시 탐색기에서 S: 드라이브 이름을 해제하고 원본 파일은 원래 폴더에 그대로 보존
        unmount_res = mount_or_unmount_s_drive({"action": "unmount"})
        stop_outbound_work_tunnel()
        return {
            "ok": True,
            "unlocked": False,
            "mounted": False,
            "unmountedOnExpiry": True,
            "targetDir": unmount_res.get("targetDir"),
            "reason": reason or "SUBSCRIPTION_REQUIRED",
            "message": "🔒 업무 공유 이용 기간이 종료되어 S: 드라이브 연결을 해제했습니다. 업무 폴더 안의 원본 파일은 100% 그대로 보존됩니다.",
        }

    # 활성 상태: 윈도우에서 S: 드라이브가 아직 미연결이면 즉시 자동 마운트(권한 동기화↔마운트 경합 0%)
    if os.name == "nt":
        status_before = inspect_s_drive_status()
        if not status_before.get("mounted"):
            mount_or_unmount_s_drive({"action": "mount", "openExplorer": False})

    # 활성 상태 + 방장 PC이면 아웃바운드 직통 터널도 자동 준비
    tunnel_info = ensure_outbound_work_tunnel() if is_host else get_outbound_work_tunnel_status()
    status_info = inspect_s_drive_status()
    return {
        "ok": True,
        "unlocked": True,
        "mounted": status_info.get("mounted", False),
        "driveLetter": status_info.get("driveLetter", WORK_DRIVE_PREFERRED),
        "targetDir": status_info.get("targetDir"),
        "tunnel": tunnel_info,
    }


def auto_mount_s_drive_if_unlocked() -> Dict[str, Any]:
    """Z-코어 기동 시(PC 재부팅·엔진 자동 업데이트 후) 기존에 업무 공유 권한이 해금된 PC라면
    탐색기 [S: 드라이브]를 즉시 자동 복원합니다 (미개통·만료 상태는 절대 마운트하지 않음)."""
    if os.name != "nt":
        return {"ok": False, "skipped": "NOT_WINDOWS"}
    try:
        cfg = _load_sdrive_config()
        if cfg.get("workEntitlementLocked") is False:
            return mount_or_unmount_s_drive({"action": "mount", "openExplorer": False})
        return {"ok": True, "skipped": "LOCKED_OR_UNINITIALIZED", "mounted": False}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def handle_action(act: str, data: Dict[str, Any]) -> Dict[str, Any] | None:
    """plugin_ghosti_os 및 merlin_z_core_daemon 라우터에서 위임받아 업무 공유(S:) 액션을 처리합니다."""
    if act not in WORK_SDRIVE_ACTIONS and not act.startswith(("paid-work-", "sdrive-")):
        return None

    letter = str(data.get("driveLetter") or WORK_DRIVE_PREFERRED)
    if act in ("paid-work-status", "sdrive-status", "sdrive-check-mount"):
        return inspect_s_drive_status(letter)
    if act == "sdrive-mount":
        return mount_or_unmount_s_drive({**data, "action": "mount"})
    if act == "sdrive-unmount":
        return mount_or_unmount_s_drive({**data, "action": "unmount"})
    if act == "sdrive-list-files":
        return list_work_files(data)
    if act == "sdrive-upload-file":
        return write_uploaded_work_file(data)
    if act == "sdrive-pull-sync":
        return pull_sync_work_files(data)
    if act == "sdrive-push-blob":
        return push_work_blob_to_signed_url(data)
    if act == "sdrive-pull-blob":
        return pull_work_blob_from_signed_url(data)
    if act == "sdrive-delete-file":
        return delete_or_apply_tombstones(data)
    if act == "sdrive-toggle-hide":
        return toggle_hide_work_file(data)
    if act == "sdrive-sync-entitlement":
        return sync_work_entitlement_state(data)
    if act == "sdrive-tunnel-status":
        return get_outbound_work_tunnel_status()
    if act == "sdrive-tunnel-start":
        return ensure_outbound_work_tunnel(data)
    if act == "sdrive-tunnel-stop":
        return stop_outbound_work_tunnel()
    if act == "sdrive-night-power-save":
        return set_night_power_save_mode(data)
    if act == "sdrive-backup-servers":
        return manage_backup_server_nodes(data)

    return {"ok": False, "track": "paid-work", "error": f"UNHANDLED_PAID_WORK_ACTION: {act}"}
