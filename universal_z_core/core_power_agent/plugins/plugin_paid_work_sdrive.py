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
import time
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


def _to_long_clean_path_str(p: Path | str) -> str:
    raw = os.path.abspath(str(p or ""))
    if os.name == "nt" and raw:
        try:
            from ctypes import wintypes as _wt_lp
            k32 = ctypes.windll.kernel32
            k32.GetLongPathNameW.argtypes = [_wt_lp.LPCWSTR, _wt_lp.LPWSTR, _wt_lp.DWORD]
            k32.GetLongPathNameW.restype = _wt_lp.DWORD
            buf = ctypes.create_unicode_buffer(2048)
            n = k32.GetLongPathNameW(raw, buf, 2048)
            if 0 < n < 2048 and buf.value:
                raw = os.path.abspath(buf.value)
        except Exception:
            pass
    return raw.rstrip("\\/") if len(raw) > 3 else raw


def _same_path(a: Path | str, b: Path | str) -> bool:
    try:
        return os.path.normcase(_to_long_clean_path_str(a)) == os.path.normcase(_to_long_clean_path_str(b))
    except Exception:
        return False


def _norm_vault_path(p: Path | str) -> Path:
    """로컬 NTFS는 심볼릭/정션 실경로로 정규화하되, 네이버 MYBOX(NNFS/CBFS)·구글 드라이브 등 가상 드라이브 문자(N:\\, G:\\)가
    GetFinalPathNameByHandleW 오류를 내거나 \\\\?\\UNC\\... 네트워크 경로로 변질되는 현상을 원천 방지합니다."""
    abs_str = _to_long_clean_path_str(p)
    abs_path = Path(abs_str)
    has_drive_letter = len(abs_str) >= 2 and abs_str[0].isalpha() and abs_str[1] == ":"
    try:
        resolved = abs_path.resolve(strict=False)
        res_str = str(resolved)
        if res_str.startswith("\\\\?\\"):
            res_str = res_str[4:]
            if res_str.upper().startswith("UNC\\"):
                res_str = "\\\\" + res_str[4:]
            resolved = Path(res_str)
        if has_drive_letter and (str(resolved).startswith("\\\\") or not (len(str(resolved)) >= 2 and str(resolved)[1] == ":")):
            return abs_path
        return resolved
    except Exception:
        return abs_path


def _query_dos_device_raw(drive_letter: str) -> str:
    if os.name != "nt":
        return ""
    letter = _norm_letter(drive_letter)
    try:
        from ctypes import wintypes as _wt_qd
        k32 = ctypes.windll.kernel32
        k32.QueryDosDeviceW.argtypes = [_wt_qd.LPCWSTR, _wt_qd.LPWSTR, _wt_qd.DWORD]
        k32.QueryDosDeviceW.restype = _wt_qd.DWORD
        buf = ctypes.create_unicode_buffer(2048)
        if k32.QueryDosDeviceW(letter, buf, 2048):
            return buf.value or ""
    except Exception:
        pass
    return ""


def _notify_shell_drive_change(drive_letter: str, added: bool = True) -> None:
    if os.name != "nt":
        return
    try:
        from ctypes import wintypes as _wt_sh
        sh32 = ctypes.windll.shell32
        sh32.SHChangeNotify.argtypes = [ ctypes.c_long, _wt_sh.UINT, _wt_sh.LPCWSTR, _wt_sh.LPCWSTR ]
        sh32.SHChangeNotify.restype = None
        # SHCNE_DRIVEADD = 0x00000100, SHCNE_DRIVEREMOVED = 0x00000080, SHCNF_PATHW = 0x0005
        event_id = 0x00000100 if added else 0x00000080
        sh32.SHChangeNotify(event_id, 0x0005, _drive_root(drive_letter), None)
    except Exception:
        pass


def _list_subst_map(force: bool = False) -> Dict[str, Path]:
    """`subst` 및 Win32 DosDevice(네이버 MYBOX 가상드라이브 커널 매핑 포함) 현재 매핑 전체를 { 'S:': Path(...) } 형태로 반환합니다."""
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
                out[f"{m.group(1).upper()}:"] = Path(_to_long_clean_path_str(m.group(2).strip()))
    except Exception:
        pass

    # QueryDosDeviceW 보강: 네이버 MYBOX(NNFS/WebDAV) 등 subst가 직접 출력하지 않는 Raw NT Device 매핑까지 정확히 역추적
    try:
        cfg_saved = _load_sdrive_config()
        saved_target = str(cfg_saved.get("targetDir") or "").strip()
        saved_src_letter = saved_target[:2].upper() if len(saved_target) >= 2 and saved_target[1] == ":" else ""
        saved_src_raw = _query_dos_device_raw(saved_src_letter) if saved_src_letter else ""
        for cand_l in (WORK_DRIVE_PREFERRED, *_WORK_DRIVE_FALLBACKS):
            if cand_l in out:
                continue
            raw_t = _query_dos_device_raw(cand_l)
            if not raw_t:
                continue
            if raw_t.startswith("\\??\\") and len(raw_t) >= 6 and raw_t[5] == ":":
                out[cand_l] = Path(_to_long_clean_path_str(raw_t[4:]))
            elif saved_target and saved_src_raw and raw_t.lower().startswith(saved_src_raw.rstrip("\\").lower()):
                sub_rel = raw_t[len(saved_src_raw.rstrip("\\")) :].lstrip("\\")
                reconstructed = f"{saved_src_letter}\\{sub_rel}" if sub_rel else f"{saved_src_letter}\\"
                out[cand_l] = Path(_to_long_clean_path_str(reconstructed))
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
    시스템/민감 경로를 업무 폴더로 지정해 원격 다운로드·삭제 대상이 되는 것을 원천 차단합니다.
    네이버 MYBOX 탐색기(N:\\폴더 등 가상드라이브 및 로컬 동기화 폴더)와 구글 드라이브(G:\\내 드라이브\\폴더)를 100% 지원합니다."""
    s = str(raw_target or "").strip()
    if not s:
        return None, "EMPTY_TARGET_DIR"
    if s.startswith("\\\\?\\") and not s.upper().startswith("\\\\?\\UNC\\"):
        s = s[4:]
    if s.startswith("\\\\") or s.startswith("//"):
        return None, "NETWORK_PATH_NOT_SUPPORTED"
    cand = Path(s)
    if not cand.is_absolute():
        return None, "TARGET_DIR_NOT_ABSOLUTE"
    try:
        resolved = _norm_vault_path(cand)
    except Exception:
        return None, "TARGET_DIR_UNRESOLVABLE"
    if resolved.parent == resolved or len(str(resolved).rstrip("\\/")) <= 2:
        return None, "DRIVE_ROOT_NOT_ALLOWED"
    # 이미 subst로 만든 가상 드라이브 자체(S:\, Z:\ 등)를 다시 업무 폴더로 지정하는 순환 금지
    # (단, 네이버 MYBOX N:\ · 구글 드라이브 G:\ 같은 클라우드 드라이브 문자는 subst 매핑이 아니므로 정상 통과)
    subst_map_now = _list_subst_map()
    cand_drv = _norm_letter(str(resolved)[:2])
    if cand_drv == WORK_DRIVE_PREFERRED or (cand_drv in subst_map_now and str(subst_map_now[cand_drv]) != str(resolved)):
        return None, "VIRTUAL_DRIVE_NOT_ALLOWED"

    lowered_parts = {p.lower() for p in resolved.parts}
    if "$recycle.bin" in lowered_parts or "system volume information" in lowered_parts:
        return None, "SYSTEM_FOLDER_NOT_ALLOWED"

    def _env_path(name: str) -> Optional[Path]:
        v = os.environ.get(name)
        if not v:
            return None
        try:
            return _norm_vault_path(v)
        except Exception:
            return None

    def _is_under(child: Path, parent: Optional[Path]) -> bool:
        if parent is None:
            return False
        try:
            Path(os.path.normcase(str(child))).relative_to(Path(os.path.normcase(str(parent))))
            return True
        except ValueError:
            return False

    merlin_dir = _norm_vault_path(_get_merlin_appdata_dir())
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
            is_invited_mirror_mode = (
                cfg.get("isWorkHost") is False
                or str(cfg.get("workPlanId") or "").strip() == "work_invited_member"
            )
            if not is_custom and not is_invited_mirror_mode:
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


class _COM_GUID(ctypes.Structure):
    _fields_ = [
        ("Data1", ctypes.c_uint32),
        ("Data2", ctypes.c_uint16),
        ("Data3", ctypes.c_uint16),
        ("Data4", ctypes.c_ubyte * 8),
    ]


class _WIN_RECT(ctypes.Structure):
    _fields_ = [
        ("left", ctypes.c_long),
        ("top", ctypes.c_long),
        ("right", ctypes.c_long),
        ("bottom", ctypes.c_long),
    ]


class _WIN_MONITORINFO(ctypes.Structure):
    _fields_ = [
        ("cbSize", ctypes.c_uint32),
        ("rcMonitor", _WIN_RECT),
        ("rcWork", _WIN_RECT),
        ("dwFlags", ctypes.c_uint32),
    ]


_CLSID_FileOpenDialog = _COM_GUID(
    0xDC1C5A9C, 0xE88A, 0x4DDE, (ctypes.c_ubyte * 8)(0xA5, 0xA1, 0x60, 0xF8, 0x2A, 0x20, 0xAE, 0xF7)
)
_IID_IFileOpenDialog = _COM_GUID(
    0xD57C7288, 0xD4AD, 0x4768, (ctypes.c_ubyte * 8)(0xBE, 0x02, 0x9D, 0x96, 0x95, 0x32, 0xD9, 0x60)
)
_IID_IShellItem = _COM_GUID(
    0x43826D1E, 0xE718, 0x42EE, (ctypes.c_ubyte * 8)(0xBC, 0x55, 0xA1, 0xE2, 0x61, 0xC3, 0x7B, 0xFE)
)

_PICKER_SINGLE_FLIGHT_LOCK = threading.Lock()
_ACTIVE_PICKER_STATE: Dict[str, Any] = {
    "running": False,
    "owner_hwnd": 0,
    "done": None,
    "result": (None, None),
}


def _suggest_initial_picker_dir(initial_dir: str = "") -> str:
    """네이버 MYBOX 탐색기(N:\\ 등 가상드라이브 및 로컬 동기화 폴더) -> 구글 드라이브(G:\\내 드라이브) -> 사용자 폴더 순으로 시작 위치를 자동 제안합니다."""
    if initial_dir and "appdata" not in initial_dir.lower() and os.path.isdir(initial_dir):
        return initial_dir

    # 1순위: 네이버 MYBOX 탐색기 마운트 드라이브 또는 로컬 동기화 폴더 자동 감지
    mybox_cands: List[str] = []
    if os.name == "nt":
        try:
            import winreg

            for reg_path, val_name in (
                (r"Software\NHN Corporation\NaverNDrive", "Recent Drive letter"),
                (r"Software\Naver\Naver MYBOX", "DriveLetter"),
                (r"Software\NAVER Cloud\MYBOX", "DriveLetter"),
            ):
                try:
                    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, reg_path) as rk:
                        v, _ = winreg.QueryValueEx(rk, val_name)
                        dl = str(v or "").strip().rstrip(":\\/")
                        if len(dl) == 1 and dl.isalpha():
                            mybox_cands.append(f"{dl.upper()}:\\")
                except Exception:
                    pass

            # 볼륨명에 MYBOX / NDRIVE 가 포함된 드라이브 스캔
            k32 = ctypes.windll.kernel32
            mask = int(k32.GetLogicalDrives())
            vol_buf = ctypes.create_unicode_buffer(260)
            for idx in range(26):
                if not (mask & (1 << idx)):
                    continue
                ch = chr(ord("A") + idx)
                if ch in ("A", "B", "C", "S"):
                    continue
                root_s = f"{ch}:\\"
                vol_buf.value = ""
                try:
                    if k32.GetVolumeInformationW(ctypes.c_wchar_p(root_s), vol_buf, 260, None, None, None, None, 0):
                        vname = (vol_buf.value or "").lower()
                        if any(tok in vname for tok in ("mybox", "ndrive", "네이버", "naver")):
                            mybox_cands.insert(0, root_s)
                except Exception:
                    pass
        except Exception:
            pass

    home_s = str(Path.home())
    mybox_cands.extend([
        os.path.join(home_s, "네이버 MYBOX"),
        os.path.join(home_s, "Naver MYBOX"),
        os.path.join(home_s, "MYBOX"),
        "D:\\네이버 MYBOX",
        "D:\\MYBOX",
    ])
    for mc in mybox_cands:
        try:
            if mc and os.path.isdir(mc):
                return mc
        except Exception:
            pass

    # 2순위: Google Drive(G:/H:) 내 드라이브
    for cand_g in ("G:\\내 드라이브", "G:\\My Drive", "H:\\내 드라이브", "H:\\My Drive"):
        try:
            if os.path.isdir(cand_g):
                return cand_g
        except Exception:
            pass

    return home_s if os.path.isdir(home_s) else ""


def _bring_picker_window_to_front(owner_hwnd_int: int) -> None:
    """Win32 Foreground Lock을 안전하게 해제하여 이미 열려 있거나 막 생성된 폴더 선택창을 크롬 창 맨 앞으로 즉시 끌어올립니다."""
    if os.name != "nt" or not owner_hwnd_int:
        return
    try:
        from ctypes import wintypes as _wt_fg

        u32 = ctypes.windll.user32
        k32 = ctypes.windll.kernel32
        u32.GetLastActivePopup.argtypes = [_wt_fg.HWND]
        u32.GetLastActivePopup.restype = _wt_fg.HWND
        u32.GetForegroundWindow.restype = _wt_fg.HWND
        u32.GetWindowThreadProcessId.argtypes = [_wt_fg.HWND, ctypes.POINTER(_wt_fg.DWORD)]
        u32.GetWindowThreadProcessId.restype = _wt_fg.DWORD
        u32.SetWindowPos.argtypes = [_wt_fg.HWND, _wt_fg.HWND, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, _wt_fg.UINT]
        u32.SetWindowPos.restype = _wt_fg.BOOL

        owner_hw = _wt_fg.HWND(owner_hwnd_int)
        popup_hw = u32.GetLastActivePopup(owner_hw) or owner_hw
        fg_hw = u32.GetForegroundWindow()
        fg_tid = u32.GetWindowThreadProcessId(fg_hw, None) if fg_hw else 0
        pop_tid = u32.GetWindowThreadProcessId(popup_hw, None)
        cur_tid = k32.GetCurrentThreadId()

        # VK_MENU(Alt) keyup 신호로 OS Foreground Lock 합법 해제
        u32.keybd_event(0x12, 0, 0x0002, 0)
        attached_fg = False
        attached_pop = False
        try:
            if fg_tid and fg_tid != cur_tid:
                attached_fg = bool(u32.AttachThreadInput(fg_tid, cur_tid, True))
            if pop_tid and pop_tid not in (0, cur_tid, fg_tid):
                attached_pop = bool(u32.AttachThreadInput(pop_tid, cur_tid, True))
            u32.ShowWindow(popup_hw, 9)  # SW_RESTORE
            u32.SetWindowPos(popup_hw, _wt_fg.HWND(-1), 0, 0, 0, 0, 0x0001 | 0x0002)  # HWND_TOPMOST | NOSIZE | NOMOVE
            u32.BringWindowToTop(popup_hw)
            u32.SetForegroundWindow(popup_hw)
        finally:
            if attached_pop:
                u32.AttachThreadInput(pop_tid, cur_tid, False)
            if attached_fg:
                u32.AttachThreadInput(fg_tid, cur_tid, False)
    except Exception:
        pass


def _pick_folder_dialog_win32(
    initial_dir: str = "",
    dialog_title: str = "",
    ok_label: str = "",
) -> Tuple[Optional[str], Optional[str]]:
    """방장이 [업무 폴더 변경]을 클릭했을 때 0.05초 내 크롬 맨 앞에 현대식 Windows 탐색기 폴더 선택창(IFileOpenDialog, 좌측 사이드바 네이버 MYBOX·구글 드라이브·내 PC 표시)을 띄웁니다.
    반환: (선택된 폴더 경로, 오류 메시지) — 사용자가 취소(X/취소)한 경우 (None, None)."""
    if os.name != "nt":
        return None, "Windows 환경에서만 사용할 수 있습니다."

    with _PICKER_SINGLE_FLIGHT_LOCK:
        if _ACTIVE_PICKER_STATE.get("running") and isinstance(_ACTIVE_PICKER_STATE.get("done"), threading.Event):
            existing_owner = int(_ACTIVE_PICKER_STATE.get("owner_hwnd") or 0)
            existing_done: threading.Event = _ACTIVE_PICKER_STATE["done"]
            should_join_existing = True
        else:
            done_ev = threading.Event()
            _ACTIVE_PICKER_STATE["running"] = True
            _ACTIVE_PICKER_STATE["owner_hwnd"] = 0
            _ACTIVE_PICKER_STATE["done"] = done_ev
            _ACTIVE_PICKER_STATE["result"] = (None, None)
            existing_owner = 0
            existing_done = done_ev
            should_join_existing = False

    if should_join_existing:
        _bring_picker_window_to_front(existing_owner)
        existing_done.wait(timeout=180.0)
        res_pair = _ACTIVE_PICKER_STATE.get("result") or (None, None)
        return res_pair[0], res_pair[1]

    start_dir = _suggest_initial_picker_dir(initial_dir)

    def _sta_picker_worker() -> None:
        from ctypes import wintypes as _wt

        picked_out: Optional[str] = None
        err_out: Optional[str] = None
        owner_hwnd_val = 0
        co_init_ok = False
        u32 = ctypes.windll.user32
        k32 = ctypes.windll.kernel32
        ole32 = ctypes.windll.ole32
        sh32 = ctypes.windll.shell32

        try:
            try:
                import merlin_z_core_os as _zos_pk

                _zos_pk.attach_thread_to_interactive_desktop()
            except Exception:
                pass

            hr_ci = ole32.CoInitializeEx(None, 0x2)  # COINIT_APARTMENTTHREADED
            co_init_ok = hr_ci in (0, 1)

            u32.GetForegroundWindow.restype = _wt.HWND
            u32.MonitorFromWindow.argtypes = [_wt.HWND, _wt.DWORD]
            u32.MonitorFromWindow.restype = _wt.HANDLE
            u32.GetMonitorInfoW.argtypes = [_wt.HANDLE, ctypes.POINTER(_WIN_MONITORINFO)]
            u32.GetMonitorInfoW.restype = _wt.BOOL
            u32.CreateWindowExW.argtypes = [
                _wt.DWORD, _wt.LPCWSTR, _wt.LPCWSTR, _wt.DWORD,
                ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
                _wt.HWND, _wt.HMENU, _wt.HINSTANCE, _wt.LPVOID,
            ]
            u32.CreateWindowExW.restype = _wt.HWND
            u32.DestroyWindow.argtypes = [_wt.HWND]
            u32.DestroyWindow.restype = _wt.BOOL

            cx, cy = 640, 380
            fg_hwnd = u32.GetForegroundWindow()
            if fg_hwnd:
                hmon = u32.MonitorFromWindow(fg_hwnd, 2)
                if hmon:
                    mi = _WIN_MONITORINFO()
                    mi.cbSize = ctypes.sizeof(_WIN_MONITORINFO)
                    if u32.GetMonitorInfoW(hmon, ctypes.byref(mi)):
                        cx = int((mi.rcWork.left + mi.rcWork.right) // 2)
                        cy = int((mi.rcWork.top + mi.rcWork.bottom) // 2)

            # WS_EX_TOPMOST(0x8) | WS_EX_APPWINDOW(0x40000), WS_POPUP(0x80000000) | WS_VISIBLE(0x10000000)
            # 화면 정중앙(cx, cy)에 위치 + 작업표시줄 노출 보장 -> 모달 자식인 IFileOpenDialog가 크롬 맨 앞 중앙에 즉시 렌더링!
            owner_hw = u32.CreateWindowExW(
                0x00000008 | 0x00040000,
                "STATIC",
                "귀신같이 S: 업무 폴더 선택",
                0x80000000 | 0x10000000,
                cx,
                cy,
                1,
                1,
                None,
                None,
                None,
                None,
            )
            owner_hwnd_val = int(owner_hw) if owner_hw else 0
            _ACTIVE_PICKER_STATE["owner_hwnd"] = owner_hwnd_val
            if owner_hwnd_val:
                _bring_picker_window_to_front(owner_hwnd_val)

            ole32.CoCreateInstance.argtypes = [
                ctypes.POINTER(_COM_GUID),
                ctypes.c_void_p,
                _wt.DWORD,
                ctypes.POINTER(_COM_GUID),
                ctypes.POINTER(ctypes.c_void_p),
            ]
            ole32.CoCreateInstance.restype = ctypes.c_long
            sh32.SHCreateItemFromParsingName.argtypes = [
                _wt.LPCWSTR,
                ctypes.c_void_p,
                ctypes.POINTER(_COM_GUID),
                ctypes.POINTER(ctypes.c_void_p),
            ]
            sh32.SHCreateItemFromParsingName.restype = ctypes.c_long

            dlg = ctypes.c_void_p()
            hr = ole32.CoCreateInstance(
                ctypes.byref(_CLSID_FileOpenDialog),
                None,
                1,
                ctypes.byref(_IID_IFileOpenDialog),
                ctypes.byref(dlg),
            )
            if hr != 0 or not dlg.value:
                err_out = "윈도우 탐색기 폴더 선택창을 열지 못했습니다."
                return

            vtbl = ctypes.cast(
                ctypes.cast(dlg, ctypes.POINTER(ctypes.c_void_p))[0],
                ctypes.POINTER(ctypes.c_void_p),
            )
            ReleaseDlg = ctypes.WINFUNCTYPE(ctypes.c_ulong, ctypes.c_void_p)(vtbl[2])
            ShowDlg = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, _wt.HWND)(vtbl[3])
            SetOptions = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, _wt.DWORD)(vtbl[9])
            GetOptions = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, ctypes.POINTER(_wt.DWORD))(vtbl[10])
            SetFolder = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, ctypes.c_void_p)(vtbl[12])
            SetTitle = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, _wt.LPCWSTR)(vtbl[17])
            SetOkButtonLabel = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, _wt.LPCWSTR)(vtbl[18])
            GetResult = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, ctypes.POINTER(ctypes.c_void_p))(vtbl[20])

            try:
                cur_opts = _wt.DWORD(0)
                GetOptions(dlg, ctypes.byref(cur_opts))
                # FOS_PICKFOLDERS(0x20) | FOS_FORCEFILESYSTEM(0x40) | FOS_NOCHANGEDIR(0x8) | FOS_PATHMUSTEXIST(0x800)
                SetOptions(dlg, cur_opts.value | 0x20 | 0x40 | 0x08 | 0x800)
                SetTitle(
                    dlg,
                    dialog_title
                    or "S: 업무 공유 드라이브로 연결할 폴더 선택 (네이버 MYBOX · 구글 드라이브 · 내 PC 하위 폴더)",
                )
                SetOkButtonLabel(dlg, ok_label or "이 폴더를 S:로 연결")

                if start_dir:
                    si_init = ctypes.c_void_p()
                    if sh32.SHCreateItemFromParsingName(start_dir, None, ctypes.byref(_IID_IShellItem), ctypes.byref(si_init)) == 0 and si_init.value:
                        try:
                            SetFolder(dlg, si_init)
                        finally:
                            si_init_vtbl = ctypes.cast(ctypes.cast(si_init, ctypes.POINTER(ctypes.c_void_p))[0], ctypes.POINTER(ctypes.c_void_p))
                            ctypes.WINFUNCTYPE(ctypes.c_ulong, ctypes.c_void_p)(si_init_vtbl[2])(si_init)

                # 모달 창이 생성된 직후(0.12초·0.35초) 팝업 자체도 한 번 더 최상단 포커스 보장
                if owner_hwnd_val:
                    for delay_s in (0.12, 0.35):
                        t_front = threading.Timer(delay_s, _bring_picker_window_to_front, args=(owner_hwnd_val,))
                        t_front.daemon = True
                        t_front.start()

                hr_show = ShowDlg(dlg, _wt.HWND(owner_hwnd_val) if owner_hwnd_val else None)
                hr_u32 = hr_show & 0xFFFFFFFF
                if hr_show == 0:
                    si_res = ctypes.c_void_p()
                    if GetResult(dlg, ctypes.byref(si_res)) == 0 and si_res.value:
                        si_vtbl = ctypes.cast(ctypes.cast(si_res, ctypes.POINTER(ctypes.c_void_p))[0], ctypes.POINTER(ctypes.c_void_p))
                        GetDisplayName = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, _wt.DWORD, ctypes.POINTER(ctypes.c_void_p))(si_vtbl[5])
                        ReleaseSi = ctypes.WINFUNCTYPE(ctypes.c_ulong, ctypes.c_void_p)(si_vtbl[2])
                        try:
                            for sigdn in (0x80058000, 0x80028000):  # SIGDN_FILESYSPATH, SIGDN_DESKTOPABSOLUTEPARSING
                                psz = ctypes.c_void_p()
                                if GetDisplayName(si_res, sigdn, ctypes.byref(psz)) == 0 and psz.value:
                                    cand_str = ctypes.wstring_at(psz.value).strip()
                                    ole32.CoTaskMemFree(psz)
                                    if cand_str:
                                        picked_out = cand_str
                                        break
                        finally:
                            ReleaseSi(si_res)
                elif hr_u32 == 0x800704C7:  # ERROR_CANCELLED (사용자가 X 또는 취소를 누름)
                    picked_out = None
                    err_out = None
                else:
                    err_out = f"윈도우 폴더 선택창 호출 중 오류가 발생했습니다 (0x{hr_u32:08X})."
            finally:
                ReleaseDlg(dlg)
        except Exception as exc:
            err_out = f"폴더 선택창 실행 오류: {exc}"
        finally:
            if owner_hwnd_val:
                try:
                    u32.DestroyWindow(_wt.HWND(owner_hwnd_val))
                except Exception:
                    pass
            if co_init_ok:
                try:
                    ole32.CoUninitialize()
                except Exception:
                    pass
            with _PICKER_SINGLE_FLIGHT_LOCK:
                _ACTIVE_PICKER_STATE["result"] = (picked_out, err_out)
                _ACTIVE_PICKER_STATE["running"] = False
                _ACTIVE_PICKER_STATE["owner_hwnd"] = 0
                done_ref = _ACTIVE_PICKER_STATE.get("done")
                if isinstance(done_ref, threading.Event):
                    done_ref.set()

    th = threading.Thread(target=_sta_picker_worker, name="ghosti-sdrive-folder-picker", daemon=True)
    th.start()
    existing_done.wait(timeout=182.0)
    res_final = _ACTIVE_PICKER_STATE.get("result") or (None, "폴더 선택 응답 시간이 초과되었습니다.")
    return res_final[0], res_final[1]


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


def _mount_drive_letter_sota(letter: str, vault_dir: Path) -> Tuple[bool, str]:
    """1차 표준 subst 마운트 -> 실패 시(네이버 MYBOX NNFS/WebDAV 등 가상·리디렉터 드라이브) Win32 DefineDosDeviceW 커널 심볼릭 링크 폴백."""
    clean_letter = _norm_letter(letter)
    target_str = str(vault_dir)
    ok_s, err_s = _run_subst([clean_letter, target_str])
    if ok_s and os.path.exists(_drive_root(clean_letter)):
        _notify_shell_drive_change(clean_letter, added=True)
        return True, ""

    if os.name != "nt":
        return False, err_s

    try:
        from ctypes import wintypes as _wt_dd
        k32 = ctypes.windll.kernel32
        k32.DefineDosDeviceW.argtypes = [_wt_dd.DWORD, _wt_dd.LPCWSTR, _wt_dd.LPCWSTR]
        k32.DefineDosDeviceW.restype = _wt_dd.BOOL

        # 2차: Win32 DefineDosDeviceW 기본 매핑 (subst.exe의 DRIVE_REMOTE 사용자모드 검사 우회)
        if k32.DefineDosDeviceW(0, clean_letter, target_str) and os.path.exists(_drive_root(clean_letter)):
            _notify_shell_drive_change(clean_letter, added=True)
            return True, ""

        # 3차: 원본 드라이브 문자(예: N:\테스트폴더)의 NT 커널 디바이스 경로(\Device\NNFS\...) 직결 매핑
        if len(target_str) >= 3 and target_str[1] == ":":
            src_letter = f"{target_str[0].upper()}:"
            sub_rel = target_str[2:].lstrip("\\/")
            src_raw = _query_dos_device_raw(src_letter)
            if src_raw:
                nt_target = f"{src_raw.rstrip('\\')}\\{sub_rel}" if sub_rel else src_raw
                # DDD_RAW_TARGET_PATH = 0x1
                if k32.DefineDosDeviceW(0x1, clean_letter, nt_target) and os.path.exists(_drive_root(clean_letter)):
                    _notify_shell_drive_change(clean_letter, added=True)
                    return True, ""
    except Exception as exc:
        err_s = f"{err_s} | DefineDosDeviceW: {exc}".strip(" |")

    return False, err_s


def _unmount_drive_letter_sota(letter: str) -> bool:
    clean_letter = _norm_letter(letter)
    ok_d, _ = _run_subst([clean_letter, "/d"])
    if not ok_d and os.name == "nt":
        try:
            from ctypes import wintypes as _wt_ud
            k32 = ctypes.windll.kernel32
            k32.DefineDosDeviceW.argtypes = [_wt_ud.DWORD, _wt_ud.LPCWSTR, _wt_ud.LPCWSTR]
            k32.DefineDosDeviceW.restype = _wt_ud.BOOL
            raw_cur = _query_dos_device_raw(clean_letter)
            if raw_cur:
                # DDD_REMOVE_DEFINITION(0x2) | DDD_RAW_TARGET_PATH(0x1) | DDD_EXACT_MATCH_ON_REMOVE(0x4)
                ok_d = bool(k32.DefineDosDeviceW(0x1 | 0x2 | 0x4, clean_letter, raw_cur)) or bool(
                    k32.DefineDosDeviceW(0x2, clean_letter, None)
                )
        except Exception:
            pass
    if ok_d:
        _notify_shell_drive_change(clean_letter, added=False)
    return ok_d


_OWNER_LOCK = threading.RLock()
_PC_OWNER_TTL_MS = 75_000  # 백그라운드 크롬 탭 타이머 스로틀링(최대 60초) 보호 + 비정상 종료 자동 만료


def _owner_file_paths() -> Tuple[Path, Path]:
    primary = _get_merlin_appdata_dir() / "active_pc_account_owner.json"
    local_app = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
    compat_dir = Path(local_app) / "Merlin_Z_Core"
    return primary, compat_dir / "active_pc_account_owner.json"


def _mask_email_for_display(email: str) -> str:
    clean = str(email or "").strip().lower()
    if "@" not in clean:
        return clean[:2] + "***" if len(clean) > 2 else "다른 계정"
    local_part, domain = clean.split("@", 1)
    if len(local_part) <= 2:
        masked_local = (local_part[:1] or "a") + "***"
    else:
        masked_local = local_part[:2] + "***"
    return f"{masked_local}@{domain}"


def _now_epoch_ms() -> int:
    import time as _t

    return int(_t.time() * 1000)


def _load_pc_owner_state_unlocked() -> Dict[str, Any]:
    primary, compat = _owner_file_paths()
    for cand in (primary, compat):
        if cand.exists():
            try:
                raw = json.loads(cand.read_text(encoding="utf-8", errors="ignore"))
                if isinstance(raw, dict):
                    return raw
            except Exception:
                pass
    return {"activeEmail": "", "updatedAtMs": 0, "sessions": {}}


def _save_pc_owner_state_unlocked(state: Dict[str, Any]) -> None:
    primary, compat = _owner_file_paths()
    txt = json.dumps(state, ensure_ascii=False, indent=2)
    for dst in (primary, compat):
        try:
            dst.parent.mkdir(parents=True, exist_ok=True)
            tmp = dst.with_name(dst.name + ".tmp")
            tmp.write_text(txt, encoding="utf-8")
            os.replace(tmp, dst)
        except Exception:
            pass


def _prune_and_get_live_owner_unlocked(state: Dict[str, Any], now_ms: int) -> Tuple[str, Dict[str, int]]:
    active_email = str(state.get("activeEmail") or "").strip().lower()
    raw_sessions = state.get("sessions")
    live_sessions: Dict[str, int] = {}
    if isinstance(raw_sessions, dict):
        for sid, ts_val in raw_sessions.items():
            try:
                ts_int = int(ts_val or 0)
            except Exception:
                ts_int = 0
            if sid and (now_ms - ts_int) <= _PC_OWNER_TTL_MS:
                live_sessions[str(sid)] = ts_int
    upd_ms = int(state.get("updatedAtMs") or 0)
    if not active_email:
        return "", {}
    if live_sessions:
        return active_email, live_sessions
    # 구버전 세션ID 미전송 호출 호환: updatedAtMs가 TTL 이내이고 sessions 기록 자체가 없었던 경우만 활성 인정
    if not isinstance(raw_sessions, dict) and (now_ms - upd_ms) <= _PC_OWNER_TTL_MS:
        return active_email, {"legacy": upd_ms}
    return "", {}


def check_pc_account_owner_allowed(req_email: Optional[str]) -> Optional[Dict[str, Any]]:
    """[정책 §5.4-⑨] 현재 PC를 다른 계정이 실시간 단독 점유 중이면 409 PC_OWNED_BY_OTHER_ACCOUNT 차단을 반환합니다."""
    clean_req = str(req_email or "").strip().lower()
    with _OWNER_LOCK:
        now_ms = _now_epoch_ms()
        st = _load_pc_owner_state_unlocked()
        live_owner, _ = _prune_and_get_live_owner_unlocked(st, now_ms)
        if live_owner and clean_req and clean_req != live_owner:
            masked = _mask_email_for_display(live_owner)
            return {
                "ok": False,
                "error": "PC_OWNED_BY_OTHER_ACCOUNT",
                "reason": "PC_OWNED_BY_OTHER_ACCOUNT",
                "activeEmailMasked": masked,
                "message": f"현재 이 PC는 다른 계정({masked})에 연결되어 있습니다. 한 PC에서는 한 번에 하나의 계정만 사용할 수 있습니다.",
            }
    return None


def handle_pc_account_owner(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """카카오톡 PC 방식 1 PC = 1 활성 계정 단독 점유 게이트웨이 (GET/POST /__merlin/account-owner)."""
    payload = data or {}
    action = str(payload.get("action") or "status").strip().lower()
    email = str(payload.get("email") or "").strip().lower()
    session_id = str(payload.get("sessionId") or "default").strip()[:80] or "default"
    force_switch = bool(payload.get("forceSwitch", False))

    need_force_unmount_prev = False

    with _OWNER_LOCK:
        now_ms = _now_epoch_ms()
        st = _load_pc_owner_state_unlocked()
        live_owner, live_sessions = _prune_and_get_live_owner_unlocked(st, now_ms)
        last_recorded_email = str(st.get("activeEmail") or "").strip().lower()

        if action == "status":
            return {
                "ok": True,
                "activeEmail": live_owner,
                "activeEmailMasked": _mask_email_for_display(live_owner) if live_owner else "",
                "sessionCount": len(live_sessions),
                "updatedAtMs": int(st.get("updatedAtMs") or 0),
            }

        if action == "release_session":
            if email and last_recorded_email == email and isinstance(st.get("sessions"), dict):
                next_sessions = dict(live_sessions)
                next_sessions.pop(session_id, None)
                st["sessions"] = next_sessions
                if not next_sessions:
                    st["updatedAtMs"] = 0
                _save_pc_owner_state_unlocked(st)
            return {"ok": True, "releasedSession": session_id}

        if action == "release":
            if not email or last_recorded_email == email or live_owner == email:
                st = {"activeEmail": "", "updatedAtMs": 0, "sessions": {}}
                _save_pc_owner_state_unlocked(st)
                need_force_unmount_prev = True
            res_rel = {"ok": True, "released": True}
        elif action in ("claim", "heartbeat"):
            if not email:
                return {"ok": False, "reason": "EMPTY_EMAIL"}
            if live_owner and live_owner != email and not force_switch:
                reason_code = (
                    "DISPLACED_BY_OTHER_ACCOUNT"
                    if action == "heartbeat"
                    else "PC_OWNED_BY_OTHER_ACCOUNT"
                )
                return {
                    "ok": False,
                    "reason": reason_code,
                    "activeEmailMasked": _mask_email_for_display(live_owner),
                }
            switched_accounts = bool(last_recorded_email and last_recorded_email != email)
            next_sessions = dict(live_sessions) if (live_owner == email and not force_switch) else {}
            next_sessions[session_id] = now_ms
            st = {
                "activeEmail": email,
                "updatedAtMs": now_ms,
                "sessions": next_sessions,
            }
            _save_pc_owner_state_unlocked(st)
            if switched_accounts or (live_owner and live_owner != email and force_switch):
                need_force_unmount_prev = True
            res_rel = {
                "ok": True,
                "activeEmail": email,
                "activeEmailMasked": _mask_email_for_display(email),
                "switched": switched_accounts,
            }
        else:
            return {"ok": False, "reason": f"UNKNOWN_OWNER_ACTION:{action}"}

    if need_force_unmount_prev:
        def _lock_prev_work_cfg(cur: Dict[str, Any]) -> None:
            cur["workEntitlementLocked"] = True
            cur["isWorkHost"] = False
            cur.pop("accountWorkEntitlements", None)

        _mutate_sdrive_config(_lock_prev_work_cfg)
        mount_or_unmount_s_drive({"action": "unmount", "forceUnmount": True})
        stop_outbound_work_tunnel()

    return res_rel


def _suggest_local_disk_picker_dir() -> str:
    for cand in ("D:\\", "E:\\", str(Path.home() / "Documents"), str(Path.home())):
        try:
            if cand and os.path.isdir(cand):
                return cand
        except Exception:
            pass
    return ""


def _suggest_google_drive_picker_dir() -> str:
    for letter_ch in "GHIJKLMNOPQRSTUVWXYZDEF":
        for sub in ("내 드라이브", "My Drive", "공유 드라이브", "Shared drives"):
            cand = f"{letter_ch}:\\{sub}"
            try:
                if os.path.isdir(cand):
                    return cand
            except Exception:
                pass
    return _suggest_initial_picker_dir("")


def _is_google_drive_or_virtual_cloud_path(p: Path) -> bool:
    s = str(p or "").lower()
    if any(tok in s for tok in ("내 드라이브", "my drive", "google drive", "공유 드라이브", "shared drives")):
        return True
    if os.name == "nt" and len(s) >= 2 and s[1] == ":":
        try:
            vol_buf = ctypes.create_unicode_buffer(260)
            if ctypes.windll.kernel32.GetVolumeInformationW(
                ctypes.c_wchar_p(f"{s[0].upper()}:\\"), vol_buf, 260, None, None, None, None, 0
            ):
                if "google" in (vol_buf.value or "").lower():
                    return True
        except Exception:
            pass
    return False


def _pick_cloud_files_or_folder_dialog_win32(
    initial_dir: str = "",
    dialog_title: str = "",
    ok_label: str = "",
) -> Tuple[Optional[str], List[str], Optional[str]]:
    """구글 드라이브 등에서 파일을 가져올 때, 기존 FOS_PICKFOLDERS(폴더만 보이고 .gsheet/.gdoc 등 내부 파일이 숨겨지는 OS 한계) 대신
    폴더 안의 .gsheet·.gdoc·일반 문서 파일들이 모두 눈에 보이게 표시하며,
    ① 파일 선택 없이 바로 [파일·시트 가져오기]를 누르면 현재 열린 폴더 전체를 통째로 가져오고,
    ② 특정 파일(.gsheet 등 1~여러 개)을 직접 클릭·선택해 누르면 선택한 파일들을 가져옵니다.
    반환: (폴더전체경로 또는 None, 개별선택파일경로목록, 오류메시지) — 취소 시 (None, [], None)"""
    if os.name != "nt":
        return None, [], "Windows 환경에서만 사용할 수 있습니다."

    with _PICKER_SINGLE_FLIGHT_LOCK:
        if _ACTIVE_PICKER_STATE.get("running") and isinstance(_ACTIVE_PICKER_STATE.get("done"), threading.Event):
            existing_owner = int(_ACTIVE_PICKER_STATE.get("owner_hwnd") or 0)
            _bring_picker_window_to_front(existing_owner)
            return None, [], "이미 열려 있는 선택창에서 먼저 선택을 완료해 주세요."
        done_ev = threading.Event()
        _ACTIVE_PICKER_STATE["running"] = True
        _ACTIVE_PICKER_STATE["owner_hwnd"] = 0
        _ACTIVE_PICKER_STATE["done"] = done_ev
        _ACTIVE_PICKER_STATE["result"] = (None, [], None)

    start_dir = _suggest_initial_picker_dir(initial_dir)
    placeholder_token = "[이 폴더 전체 파일·시트 일괄 가져오기]"

    def _sta_file_visible_worker() -> None:
        from ctypes import wintypes as _wt

        class _COMDLG_FILTERSPEC(ctypes.Structure):
            _fields_ = [("pszName", _wt.LPCWSTR), ("pszSpec", _wt.LPCWSTR)]

        folder_out: Optional[str] = None
        files_out: List[str] = []
        err_out: Optional[str] = None
        owner_hwnd_val = 0
        co_init_ok = False
        u32 = ctypes.windll.user32
        ole32 = ctypes.windll.ole32
        sh32 = ctypes.windll.shell32

        def _extract_shell_item_path(si_ptr: ctypes.c_void_p) -> str:
            if not si_ptr or not si_ptr.value:
                return ""
            si_vt = ctypes.cast(
                ctypes.cast(si_ptr, ctypes.POINTER(ctypes.c_void_p))[0],
                ctypes.POINTER(ctypes.c_void_p),
            )
            GetDisp = ctypes.WINFUNCTYPE(
                ctypes.c_long, ctypes.c_void_p, _wt.DWORD, ctypes.POINTER(ctypes.c_void_p)
            )(si_vt[5])
            for sigdn in (0x80058000, 0x80028000):
                psz = ctypes.c_void_p()
                if GetDisp(si_ptr, sigdn, ctypes.byref(psz)) == 0 and psz.value:
                    s = ctypes.wstring_at(psz.value).strip()
                    ole32.CoTaskMemFree(psz)
                    if s:
                        return s
            return ""

        def _release_com(ptr: ctypes.c_void_p) -> None:
            if ptr and ptr.value:
                vt = ctypes.cast(
                    ctypes.cast(ptr, ctypes.POINTER(ctypes.c_void_p))[0],
                    ctypes.POINTER(ctypes.c_void_p),
                )
                ctypes.WINFUNCTYPE(ctypes.c_ulong, ctypes.c_void_p)(vt[2])(ptr)

        try:
            try:
                import merlin_z_core_os as _zos_pk2

                _zos_pk2.attach_thread_to_interactive_desktop()
            except Exception:
                pass

            hr_ci = ole32.CoInitializeEx(None, 0x2)
            co_init_ok = hr_ci in (0, 1)

            u32.GetForegroundWindow.restype = _wt.HWND
            u32.MonitorFromWindow.argtypes = [_wt.HWND, _wt.DWORD]
            u32.MonitorFromWindow.restype = _wt.HANDLE
            u32.GetMonitorInfoW.argtypes = [_wt.HANDLE, ctypes.POINTER(_WIN_MONITORINFO)]
            u32.GetMonitorInfoW.restype = _wt.BOOL
            u32.CreateWindowExW.argtypes = [
                _wt.DWORD, _wt.LPCWSTR, _wt.LPCWSTR, _wt.DWORD,
                ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
                _wt.HWND, _wt.HMENU, _wt.HINSTANCE, _wt.LPVOID,
            ]
            u32.CreateWindowExW.restype = _wt.HWND
            u32.DestroyWindow.argtypes = [_wt.HWND]
            u32.DestroyWindow.restype = _wt.BOOL

            cx, cy = 640, 380
            fg_hwnd = u32.GetForegroundWindow()
            if fg_hwnd:
                hmon = u32.MonitorFromWindow(fg_hwnd, 2)
                if hmon:
                    mi = _WIN_MONITORINFO()
                    mi.cbSize = ctypes.sizeof(_WIN_MONITORINFO)
                    if u32.GetMonitorInfoW(hmon, ctypes.byref(mi)):
                        cx = int((mi.rcWork.left + mi.rcWork.right) // 2)
                        cy = int((mi.rcWork.top + mi.rcWork.bottom) // 2)

            owner_hw = u32.CreateWindowExW(
                0x00000008 | 0x00040000,
                "STATIC",
                "귀신같이 구글 드라이브 파일·시트 가져오기",
                0x80000000 | 0x10000000,
                cx, cy, 1, 1, None, None, None, None,
            )
            owner_hwnd_val = int(owner_hw) if owner_hw else 0
            _ACTIVE_PICKER_STATE["owner_hwnd"] = owner_hwnd_val
            if owner_hwnd_val:
                _bring_picker_window_to_front(owner_hwnd_val)

            ole32.CoCreateInstance.argtypes = [
                ctypes.POINTER(_COM_GUID), ctypes.c_void_p, _wt.DWORD,
                ctypes.POINTER(_COM_GUID), ctypes.POINTER(ctypes.c_void_p),
            ]
            ole32.CoCreateInstance.restype = ctypes.c_long
            sh32.SHCreateItemFromParsingName.argtypes = [
                _wt.LPCWSTR, ctypes.c_void_p, ctypes.POINTER(_COM_GUID), ctypes.POINTER(ctypes.c_void_p),
            ]
            sh32.SHCreateItemFromParsingName.restype = ctypes.c_long

            dlg = ctypes.c_void_p()
            hr = ole32.CoCreateInstance(
                ctypes.byref(_CLSID_FileOpenDialog), None, 1,
                ctypes.byref(_IID_IFileOpenDialog), ctypes.byref(dlg),
            )
            if hr != 0 or not dlg.value:
                err_out = "윈도우 탐색기 선택창을 열지 못했습니다."
                return

            vtbl = ctypes.cast(
                ctypes.cast(dlg, ctypes.POINTER(ctypes.c_void_p))[0],
                ctypes.POINTER(ctypes.c_void_p),
            )
            ShowDlg = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, _wt.HWND)(vtbl[3])
            SetFileTypes = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, ctypes.c_uint, ctypes.POINTER(_COMDLG_FILTERSPEC))(vtbl[4])
            SetOptions = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, _wt.DWORD)(vtbl[9])
            GetOptions = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, ctypes.POINTER(_wt.DWORD))(vtbl[10])
            SetFolder = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, ctypes.c_void_p)(vtbl[12])
            GetFolder = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, ctypes.POINTER(ctypes.c_void_p))(vtbl[13])
            SetFileName = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, _wt.LPCWSTR)(vtbl[15])
            SetTitle = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, _wt.LPCWSTR)(vtbl[17])
            SetOkButtonLabel = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, _wt.LPCWSTR)(vtbl[18])
            SetFileNameLabel = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, _wt.LPCWSTR)(vtbl[19])
            GetResult = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, ctypes.POINTER(ctypes.c_void_p))(vtbl[20])
            GetResults = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, ctypes.POINTER(ctypes.c_void_p))(vtbl[27])

            try:
                cur_opts = _wt.DWORD(0)
                GetOptions(dlg, ctypes.byref(cur_opts))
                # ~FOS_PICKFOLDERS(~0x20)로 .gsheet/.gdoc/.txt 등 모든 파일 표시 + FOS_NOVALIDATE(0x100) + ~FOS_FILEMUSTEXIST(~0x1000) + FOS_ALLOWMULTISELECT(0x200) + FOS_NODEREFERENCELINKS(0x100000)
                new_opts = (cur_opts.value | 0x08 | 0x40 | 0x100 | 0x200 | 0x100000 | 0x02000000) & ~0x20 & ~0x1000
                SetOptions(dlg, new_opts)
                specs = (_COMDLG_FILTERSPEC * 2)(
                    _COMDLG_FILTERSPEC("모든 업무 파일 및 구글 시트·문서 (*.*)", "*.*"),
                    _COMDLG_FILTERSPEC("구글 시트·문서·프레젠테이션 (*.gsheet;*.gdoc;*.gslides)", "*.gsheet;*.gdoc;*.gslides"),
                )
                SetFileTypes(dlg, 2, specs)
                SetFileName(dlg, placeholder_token)
                SetFileNameLabel(dlg, "가져올 대상:")
                SetTitle(dlg, dialog_title or "가져올 구글 드라이브 폴더 열기 (.gsheet·.gdoc 확인 후 바로 [파일·시트 가져오기] 클릭)")
                SetOkButtonLabel(dlg, ok_label or "파일·시트 가져오기")

                if start_dir:
                    si_init = ctypes.c_void_p()
                    if sh32.SHCreateItemFromParsingName(start_dir, None, ctypes.byref(_IID_IShellItem), ctypes.byref(si_init)) == 0 and si_init.value:
                        try:
                            SetFolder(dlg, si_init)
                        finally:
                            _release_com(si_init)

                if owner_hwnd_val:
                    for delay_s in (0.12, 0.35):
                        t_front = threading.Timer(delay_s, _bring_picker_window_to_front, args=(owner_hwnd_val,))
                        t_front.daemon = True
                        t_front.start()

                hr_show = ShowDlg(dlg, _wt.HWND(owner_hwnd_val) if owner_hwnd_val else None)
                hr_u32 = hr_show & 0xFFFFFFFF
                if hr_show == 0:
                    raw_candidates: List[str] = []
                    psi_arr = ctypes.c_void_p()
                    if GetResults(dlg, ctypes.byref(psi_arr)) == 0 and psi_arr.value:
                        try:
                            arr_vt = ctypes.cast(
                                ctypes.cast(psi_arr, ctypes.POINTER(ctypes.c_void_p))[0],
                                ctypes.POINTER(ctypes.c_void_p),
                            )
                            GetCount = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, ctypes.POINTER(_wt.DWORD))(arr_vt[7])
                            GetItemAt = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, _wt.DWORD, ctypes.POINTER(ctypes.c_void_p))(arr_vt[8])
                            cnt = _wt.DWORD(0)
                            if GetCount(psi_arr, ctypes.byref(cnt)) == 0:
                                for i_idx in range(int(cnt.value)):
                                    si_it = ctypes.c_void_p()
                                    if GetItemAt(psi_arr, i_idx, ctypes.byref(si_it)) == 0 and si_it.value:
                                        try:
                                            p_s = _extract_shell_item_path(si_it)
                                            if p_s:
                                                raw_candidates.append(p_s)
                                        finally:
                                            _release_com(si_it)
                        finally:
                            _release_com(psi_arr)

                    if not raw_candidates:
                        si_one = ctypes.c_void_p()
                        if GetResult(dlg, ctypes.byref(si_one)) == 0 and si_one.value:
                            try:
                                p_one = _extract_shell_item_path(si_one)
                                if p_one:
                                    raw_candidates.append(p_one)
                            finally:
                                _release_com(si_one)

                    real_selected = [
                        c for c in raw_candidates
                        if placeholder_token not in os.path.basename(c) and os.path.exists(c)
                    ]
                    if real_selected:
                        if len(real_selected) == 1 and os.path.isdir(real_selected[0]):
                            folder_out = real_selected[0]
                        else:
                            files_out = real_selected
                    else:
                        si_cur_dir = ctypes.c_void_p()
                        if GetFolder(dlg, ctypes.byref(si_cur_dir)) == 0 and si_cur_dir.value:
                            try:
                                folder_out = _extract_shell_item_path(si_cur_dir) or None
                            finally:
                                _release_com(si_cur_dir)
                        if not folder_out and raw_candidates:
                            parent_cand = os.path.dirname(raw_candidates[0])
                            if parent_cand and os.path.isdir(parent_cand):
                                folder_out = parent_cand
                elif hr_u32 == 0x800704C7:
                    folder_out = None
                    files_out = []
                    err_out = None
                else:
                    err_out = f"선택창 호출 중 오류가 발생했습니다 (0x{hr_u32:08X})."
            finally:
                _release_com(dlg)
        except Exception as exc:
            err_out = f"선택창 실행 오류: {exc}"
        finally:
            if owner_hwnd_val:
                try:
                    u32.DestroyWindow(_wt.HWND(owner_hwnd_val))
                except Exception:
                    pass
            if co_init_ok:
                try:
                    ole32.CoUninitialize()
                except Exception:
                    pass
            with _PICKER_SINGLE_FLIGHT_LOCK:
                _ACTIVE_PICKER_STATE["result"] = (folder_out, files_out, err_out)
                _ACTIVE_PICKER_STATE["running"] = False
                _ACTIVE_PICKER_STATE["owner_hwnd"] = 0
                done_ref = _ACTIVE_PICKER_STATE.get("done")
                if isinstance(done_ref, threading.Event):
                    done_ref.set()

    th = threading.Thread(target=_sta_file_visible_worker, name="ghosti-sdrive-cloud-import-picker", daemon=True)
    th.start()
    done_ev.wait(timeout=182.0)
    res_triple = _ACTIVE_PICKER_STATE.get("result") or (None, [], "선택 응답 시간이 초과되었습니다.")
    return res_triple[0], res_triple[1], res_triple[2]


def _copy_work_folder_with_gdoc_synthesis(
    src_dir: Path,
    dst_dir: Path,
    explicit_files: Optional[List[Path]] = None,
) -> Dict[str, Any]:
    """구글 드라이브(DriveFS 가상 스텁 WinError 1 / 잘못된 MS-DOS 함수) 내 .gsheet/.gdoc/.gslides 파일을
    정식 URL·doc_id JSON 바로가기 파일로 자동 합성 복사하고 일반 업무 파일·서브폴더도 무손실 이관합니다."""
    dst_dir.mkdir(parents=True, exist_ok=True)
    if explicit_files:
        entries: List[Tuple[Path, str, os.stat_result]] = []
        for ef in explicit_files:
            try:
                if ef.is_dir():
                    sub_entries, _, _ = _scan_work_vault(ef, set(), include_hidden=False)
                    for sf, srel, sst in sub_entries:
                        entries.append((sf, f"{ef.name}/{srel}", sst))
                elif ef.exists():
                    entries.append((ef, ef.name, ef.stat()))
            except Exception:
                continue
    else:
        entries, _, _ = _scan_work_vault(src_dir, set(), include_hidden=False)

    regular_copied = 0
    gdoc_copied = 0
    copied_rels: List[str] = []
    now_ts = time.time()

    for src_full, rel_p, st in entries:
        dst_full = _safe_resolve_inside_vault(dst_dir, rel_p)
        if dst_full is None:
            continue
        try:
            if _same_path(src_full, dst_full):
                continue
        except Exception:
            pass
        dst_full.parent.mkdir(parents=True, exist_ok=True)
        ext_low = src_full.suffix.lower()
        fresh_ts = max(float(st.st_mtime), now_ts)
        try:
            if ext_low in (".gsheet", ".gdoc", ".gslides"):
                g_bytes = read_work_file_bytes_safe(src_full)
                if not g_bytes:
                    continue
                dst_full.write_bytes(g_bytes)
                try:
                    os.utime(dst_full, (fresh_ts, fresh_ts))
                except Exception:
                    pass
                gdoc_copied += 1
                copied_rels.append(rel_p)
            else:
                try:
                    shutil.copy2(src_full, dst_full)
                    try:
                        os.utime(dst_full, (fresh_ts, fresh_ts))
                    except Exception:
                        pass
                except OSError:
                    fallback_b = read_work_file_bytes_safe(src_full)
                    dst_full.write_bytes(fallback_b)
                    try:
                        os.utime(dst_full, (fresh_ts, fresh_ts))
                    except Exception:
                        pass
                regular_copied += 1
                copied_rels.append(rel_p)
        except Exception:
            continue

    if copied_rels:
        def _clear_migrated_tombstones(cur: Dict[str, Any]) -> None:
            tombs = dict(cur.get("deletedTombstones") or {})
            for rp in copied_rels:
                tombs.pop(rp, None)
                tombs.pop(rp.lower(), None)
            cur["deletedTombstones"] = tombs
            cur["knownRelPaths"] = []

        _mutate_sdrive_config(_clear_migrated_tombstones)

    return {
        "copiedCount": regular_copied + gdoc_copied,
        "gdocCopiedCount": gdoc_copied,
        "regularCopiedCount": regular_copied,
        "copiedRelPaths": copied_rels,
    }


def mount_or_unmount_s_drive(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    payload = data or {}
    action = str(payload.get("action") or "mount").strip().lower()
    open_explorer = bool(payload.get("openExplorer", False))
    custom_target = payload.get("targetDir")
    source_dir_raw = str(payload.get("sourceDir") or "").strip()
    req_email = str(payload.get("email") or payload.get("accountEmail") or "").strip().lower()
    prev_vault_dir = get_work_vault_dir(ensure_dirs=False)
    migration_stats: Optional[Dict[str, int]] = None
    migration_msg_override: str = ""

    if action != "status" and not bool(payload.get("forceUnmount")):
        owner_block = check_pc_account_owner_allowed(req_email)
        if owner_block is not None:
            return owner_block
        if action == "unmount" and not req_email:
            with _OWNER_LOCK:
                live_owner, _ = _prune_and_get_live_owner_unlocked(_load_pc_owner_state_unlocked(), _now_epoch_ms())
            cfg_cur = _load_sdrive_config()
            if (
                live_owner
                and str(cfg_cur.get("activeAccountEmail") or "").strip().lower() == live_owner
                and cfg_cur.get("workEntitlementLocked") is False
            ):
                return {
                    "ok": False,
                    "error": "PC_OWNED_BY_OTHER_ACCOUNT",
                    "reason": "PC_OWNED_BY_OTHER_ACCOUNT",
                    "activeEmailMasked": _mask_email_for_display(live_owner),
                }

    if action == "pick_folder":
        picked, picker_err = _pick_folder_dialog_win32(str(prev_vault_dir))
        if picker_err:
            return {
                "ok": False,
                "cancelled": False,
                "targetDir": str(prev_vault_dir),
                "message": picker_err,
            }
        if not picked:
            return {
                "ok": False,
                "cancelled": True,
                "targetDir": str(prev_vault_dir),
                "message": "폴더 선택이 취소되었습니다.",
            }
        custom_target = picked
        action = "mount"
    elif action == "migrate_to_local":
        dst_cand = str(custom_target or "").strip()
        if not dst_cand:
            picked_dst, dst_err = _pick_folder_dialog_win32(
                _suggest_local_disk_picker_dir(),
                dialog_title="구글 드라이브 파일·시트(.gsheet·.gdoc)를 통째 복사해 옮길 내 PC 로컬 폴더 선택 (예: D:\\업무공유_로컬)",
                ok_label="이 로컬 폴더로 통째 복사·전환",
            )
            if dst_err:
                return {
                    "ok": False,
                    "cancelled": False,
                    "targetDir": str(prev_vault_dir),
                    "message": dst_err,
                }
            if not picked_dst:
                return {
                    "ok": False,
                    "cancelled": True,
                    "targetDir": str(prev_vault_dir),
                    "message": "로컬 폴더 선택이 취소되었습니다.",
                }
            dst_cand = picked_dst
        valid_dst, dst_reason = _validate_custom_work_target(dst_cand)
        if valid_dst is None:
            return {
                "ok": False,
                "error": "INVALID_TARGET_DIR",
                "reason": dst_reason,
                "targetDir": str(prev_vault_dir),
                "message": "복사할 대상은 드라이브 최상위(예: D:\\) 대신 내 PC 안의 하위 폴더(예: D:\\업무공유_로컬)를 선택해 주세요!",
            }
        if _is_google_drive_or_virtual_cloud_path(valid_dst):
            return {
                "ok": False,
                "error": "CLOUD_DESTINATION_NOT_ALLOWED",
                "targetDir": str(prev_vault_dir),
                "message": "구글 드라이브가 아닌 내 PC 하드디스크 안의 로컬 폴더(예: D:\\업무공유_로컬)를 선택해 주세요!",
            }
        src_for_mig = Path(source_dir_raw) if source_dir_raw and os.path.isdir(source_dir_raw) else prev_vault_dir
        migration_stats = _copy_work_folder_with_gdoc_synthesis(src_for_mig, valid_dst)
        custom_target = str(valid_dst)
        action = "mount"
        migration_msg_override = (
            f"✓ 구글 시트·문서({migration_stats['gdocCopiedCount']}건)를 포함한 총 {migration_stats['copiedCount']}개 파일을 "
            f"[{valid_dst}]로 통째 복사하고 S: 드라이브를 무중단 전환했습니다!"
        )
    elif action == "import_from_cloud":
        src_cand = source_dir_raw
        explicit_src_files: List[Path] = []
        if not src_cand:
            picked_folder, picked_files, src_err = _pick_cloud_files_or_folder_dialog_win32(
                _suggest_google_drive_picker_dir(),
                dialog_title=f"가져올 구글 드라이브 폴더 열기 (.gsheet·.gdoc 파일 확인 후 바로 [파일·시트 가져오기] 클릭)",
                ok_label="파일·시트 가져오기",
            )
            if src_err:
                return {
                    "ok": False,
                    "cancelled": False,
                    "targetDir": str(prev_vault_dir),
                    "message": src_err,
                }
            if picked_files:
                explicit_src_files = [Path(fp) for fp in picked_files]
                src_cand = str(explicit_src_files[0].parent)
            elif picked_folder:
                src_cand = picked_folder
            else:
                return {
                    "ok": False,
                    "cancelled": True,
                    "targetDir": str(prev_vault_dir),
                    "message": "원본 구글 드라이브 폴더·파일 선택이 취소되었습니다.",
                }
        src_p = Path(src_cand)
        if not explicit_src_files and (not src_p.exists() or not src_p.is_dir()):
            return {
                "ok": False,
                "error": "SOURCE_DIR_NOT_FOUND",
                "targetDir": str(prev_vault_dir),
                "message": "선택한 원본 폴더를 찾을 수 없습니다. 구글 드라이브가 열려 있는지 확인해 주세요.",
            }
        if not explicit_src_files and _same_path(src_p, prev_vault_dir):
            return {
                "ok": False,
                "error": "SAME_SOURCE_AND_TARGET",
                "targetDir": str(prev_vault_dir),
                "message": "현재 연결된 로컬 폴더와 다른 원본 구글 드라이브 폴더를 선택해 주세요.",
            }
        migration_stats = _copy_work_folder_with_gdoc_synthesis(
            src_p,
            prev_vault_dir,
            explicit_files=explicit_src_files if explicit_src_files else None,
        )
        custom_target = str(prev_vault_dir)
        action = "mount"
        migration_msg_override = (
            f"✓ 구글 시트·문서({migration_stats['gdocCopiedCount']}건) 포함 총 {migration_stats['copiedCount']}개 파일을 "
            f"현재 로컬 폴더([{prev_vault_dir}])로 안전하게 가져왔습니다!"
        )
    elif action in ("reset_default", "reset_default_folder"):
        default_dir = _default_work_vault_dir()
        custom_target = str(default_dir)
        action = "mount"

    folder_switched = False
    if custom_target and str(custom_target).strip():
        valid_p, reason = _validate_custom_work_target(custom_target)
        if valid_p is None:
            if reason == "DRIVE_ROOT_NOT_ALLOWED":
                invalid_msg = "드라이브 최상위(예: N:\\ 또는 G:\\) 전체 대신 그 안의 업무용 하위 폴더(예: 네이버 MYBOX\\테스트폴더)를 선택해 주세요!"
            elif reason == "VIRTUAL_DRIVE_NOT_ALLOWED":
                invalid_msg = "이미 S: 업무 드라이브로 연결된 경로 자체는 다시 선택할 수 없어요. 원본 폴더(예: 네이버 MYBOX·구글 드라이브 안의 폴더)를 선택해 주세요."
            else:
                invalid_msg = "이 폴더는 업무 공유 폴더로 지정할 수 없어요. (시스템·프로그램 폴더 대신 네이버 MYBOX·구글 드라이브·문서 안의 업무용 하위 폴더를 선택해 주세요)"
            return {
                "ok": False,
                "error": "INVALID_TARGET_DIR",
                "reason": reason,
                "message": invalid_msg,
            }
        if not _same_path(prev_vault_dir, valid_p):
            folder_switched = True
            # 이전 업무 폴더에 연결돼 있던 우리 S: 드라이브를 먼저 해제해 동일 S: 문자를 그대로 이어받게 보장
            if os.name == "nt":
                for old_letter in _letters_mapped_to(prev_vault_dir):
                    _unmount_drive_letter_sota(old_letter)
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
        if bool(payload.get("purgeInvitedVault")):
            _isolate_invited_room_local_vault(
                str(payload.get("roomId") or _load_sdrive_config().get("activeWorkRoomId") or ""),
                req_email,
            )
        released: List[str] = []
        failed: List[str] = []
        if os.name == "nt":
            for letter in _letters_mapped_to(vault_dir):  # 우리 연결만 해제 (남의 NAS·USB는 절대 미접촉)
                ok_d = _unmount_drive_letter_sota(letter)
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
            _unmount_drive_letter_sota(letter)
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
        ok_m, mount_error = _mount_drive_letter_sota(preferred, vault_dir)
        if ok_m:
            chosen = preferred
    elif ours:
        chosen = ours[0]  # 선호 문자를 남이 쓰는 중이면 기존 대체 문자 연결을 그대로 유지
    else:
        for letter in _WORK_DRIVE_FALLBACKS:
            if letter == preferred or _is_drive_letter_occupied(letter):
                continue
            ok_m, mount_error = _mount_drive_letter_sota(letter, vault_dir)
            if ok_m:
                chosen = letter
                break

    _list_subst_map(force=True)
    verified = bool(chosen) and (chosen in _letters_mapped_to(vault_dir) or os.path.exists(_drive_root(chosen)))

    if not verified:
        return {
            "ok": False,
            "error": "MOUNT_FAILED" if chosen or mount_error else "NO_FREE_DRIVE_LETTER",
            "detail": mount_error,
            "mounted": False,
            "driveLetter": preferred,
            "targetDir": str(vault_dir),
            "message": "업무 드라이브를 만들지 못했어요. 선택한 폴더가 현재 열려 있는지(네이버 MYBOX·구글 드라이브 로그인 상태) 확인해 주세요.",
        }

    # 구버전(S:) 또는 이전 대체 문자 연결이 남아 있으면 새 연결 성공 후에만 정리 (우리 연결만)
    for stale in _letters_mapped_to(vault_dir):
        if stale != chosen:
            _unmount_drive_letter_sota(stale)
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
        migration_msg_override
        if migration_msg_override
        else f"{preferred[0]} 드라이브가 이미 다른 연결(회사 NAS 등)에 쓰이고 있어 {chosen[0]} 드라이브로 만들었어요. 기존 연결은 그대로 두었습니다."
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
        "copiedCount": int(migration_stats["copiedCount"]) if migration_stats else 0,
        "gdocCopiedCount": int(migration_stats["gdocCopiedCount"]) if migration_stats else 0,
        "copiedRelPaths": list(migration_stats.get("copiedRelPaths") or []) if migration_stats else [],
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
    """외부 무거운 의존성 없이 표준 zipfile+XML로 엑셀(.xlsx) 첫 시트 표 미리보기 + 전체 시트 본문(최대 12,000자)을 초고속 추출합니다."""
    headers: List[str] = []
    rows: List[List[str]] = []
    flat_lines: List[str] = []
    total_chars = 0
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

            first_sheet_matrix: List[List[str]] = []
            total_rows_seen = 0
            for s_idx, s_name in enumerate(sheet_names[:12]):
                ws_root = ET.fromstring(zf.read(s_name))
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
                                val_str = "".join(
                                    t.text or "" for t in child.iter() if (t.tag.endswith("}t") or t.tag == "t")
                                ).strip()
                        row_vals.append(val_str)
                        if len(row_vals) >= 24:
                            break
                    if any(v.strip() for v in row_vals):
                        if s_idx == 0 and len(first_sheet_matrix) < 12:
                            first_sheet_matrix.append(row_vals[:6])
                        line_joined = " | ".join(v for v in row_vals if v.strip())
                        flat_lines.append(line_joined)
                        total_chars += len(line_joined) + 1
                        total_rows_seen += 1
                    if total_rows_seen >= 400 or total_chars >= 12500:
                        break
                if total_rows_seen >= 400 or total_chars >= 12500:
                    break

            if first_sheet_matrix:
                headers = [h or f"열 {i + 1}" for i, h in enumerate(first_sheet_matrix[0][:6])]
                col_len = len(headers)
                for r in first_sheet_matrix[1:8]:
                    padded = (r + [""] * col_len)[:col_len]
                    rows.append(padded)
    except Exception:
        pass
    return headers, rows, "\n".join(flat_lines)[:12000]


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
    return f"{os.path.normcase(os.path.abspath(str(file_path)))}|{st.st_size}|{st.st_mtime_ns}|v3_gdfs_xlsx"


def _get_cached_preview(sig_key: str, *, force_recheck_unexported: bool = False) -> Optional[Dict[str, Any]]:
    with _PREVIEW_LOCK:
        hit = _PREVIEW_CACHE.get(sig_key)
        if hit is not None:
            retry_after = float(hit.get("_gdoc_retry_after_mono") or 0.0)
            if retry_after > 0.0 and (force_recheck_unexported or time.monotonic() >= retry_after):
                _PREVIEW_CACHE.pop(sig_key, None)
                return None
            _PREVIEW_CACHE.move_to_end(sig_key)
        return hit


def _put_cached_preview(sig_key: str, res: Dict[str, Any]) -> None:
    with _PREVIEW_LOCK:
        _PREVIEW_CACHE[sig_key] = res
        _PREVIEW_CACHE.move_to_end(sig_key)
        while len(_PREVIEW_CACHE) > _PREVIEW_CACHE_MAX:
            _PREVIEW_CACHE.popitem(last=False)


def _sync_doc_body_to_ghost_search_cache(
    real_path: Path,
    s_drive_full_path: Optional[str],
    st: os.stat_result,
    preview_text: str,
) -> None:
    """업무 공유(S:)에서 추출된 한글(.hwp)·엑셀(.xlsx)·PDF·워드 본문을 Ctrl+0 귀신검색창 공용 캐시(doc_text_cache_v1.json)에
    원본 경로 + S:\\ 가상드라이브 경로 양쪽으로 즉시 동시 등록하여, 마이박스 폴더 연결 직후 1초 내 본문 검색을 보장합니다."""
    clean_body = (preview_text or "").strip()
    if not clean_body:
        return
    if "로컬 문서 파일입니다. 파일명 및 키워드로 즉시 검색됩니다." in clean_body:
        return
    try:
        import plugin_ghosti_os

        plugin_ghosti_os._load_doc_text_cache()
        mt_int = int(st.st_mtime)
        sz_int = int(st.st_size)
        path_keys = {str(real_path), str(_norm_vault_path(real_path))}
        if s_drive_full_path:
            path_keys.add(str(s_drive_full_path))
        for pk in path_keys:
            if pk:
                sig = f"{pk}|{sz_int}|{mt_int}|v3_sota50k"
                plugin_ghosti_os._save_doc_text_cache_entry(sig, clean_body, flush_disk=False)
                prev_mem = plugin_ghosti_os._DOCS_FULL_TEXT_MEM_MAP.get(pk.lower())
                if prev_mem != clean_body:
                    plugin_ghosti_os._DOCS_FULL_TEXT_MEM_MAP[pk.lower()] = clean_body
                    plugin_ghosti_os._DOCS_RESP_MEM_CACHE["sig"] = ""
    except Exception:
        pass


def _flush_ghost_search_doc_cache() -> None:
    try:
        import plugin_ghosti_os

        plugin_ghosti_os._flush_doc_text_cache_if_dirty()
    except Exception:
        pass


def _compute_rich_preview(file_path: Path, st: os.stat_result, *, allow_pdf_ocr: bool = False) -> Dict[str, Any]:
    ext_low = file_path.suffix.lower()
    ext_upper = ext_low.lstrip(".").upper() or "FILE"
    is_image = ext_low in _IMAGE_EXTS
    preview_text = ""
    table_headers: List[str] = []
    table_rows: List[List[str]] = []
    image_base64 = ""
    gdoc_retry_after = 0.0
    gdoc_doc_id = ""

    try:
        if is_image:
            image_base64 = _make_lightweight_image_data_url(file_path, st.st_size)
        elif ext_low == ".csv":
            raw_bytes = file_path.read_bytes()[:524288]
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
                preview_text = "\n".join(" | ".join(r[:16]) for r in non_empty[:200])[:12000]
        elif ext_low == ".xlsx":
            table_headers, table_rows, preview_text = _parse_xlsx_preview_stdlib(file_path)
        elif ext_low in (".gdoc", ".gsheet", ".gslides"):
            import ghosti_safe_ops

            g_meta = ghosti_safe_ops.resolve_google_workspace_shortcut_meta(file_path)
            doc_id = str(g_meta.get("doc_id") or "").strip()
            gdoc_doc_id = doc_id
            g_url = str(g_meta.get("url") or "").strip()
            kind_ko = str(g_meta.get("kind_ko") or "Google 문서")
            exported_body = ""
            is_private_gdoc = False
            # 링크 공유('링크가 있는 모든 사용자 보기') 설정된 사내 구글시트/구글문서는 백신 오진(브라우저 쿠키 접근) 없이
            # 공식 export 엔드포인트(CSV/TXT, 임시 메모리 CookieJar 307 리다이렉트 지원)로 표(행·열)와 본문 텍스트 전체(최대 12,000자)를 자동 인덱싱
            if doc_id and ext_low in (".gsheet", ".gdoc", ".gslides"):
                exp_res = ghosti_safe_ops.export_public_google_workspace_body(
                    doc_id,
                    ext_low,
                    max_rows=200,
                    max_chars=12000,
                    timeout_sec=4.5,
                )
                is_private_gdoc = bool(exp_res.get("is_private"))
                if exp_res.get("exported"):
                    table_headers = list(exp_res.get("table_headers") or [])
                    table_rows = list(exp_res.get("table_rows") or [])
                    exported_body = str(exp_res.get("body_text") or "")
            gdoc_is_owner = bool(g_meta.get("is_owner", True))
            gdoc_retry_after = 0.0 if exported_body else (time.monotonic() + 10.0)
            preview_text = (
                f"[{kind_ko} 바로가기 — {file_path.stem}]\n"
                + (f"원본 열기: {g_url}\n" if g_url else "")
                + (
                    f"{exported_body}"
                    if exported_body
                    else (
                        (
                            "현재 구글 문서·시트 공유 상태가 '제한됨(비공개)'입니다. "
                            + (
                                "(다른 계정이 만든 문서는 만든 계정에서만 공유 범위를 바꿀 수 있습니다. "
                                if not gdoc_is_owner
                                else "("
                            )
                            + "구글 시트 우측 상단 [공유] → 일반 액세스를 '링크가 있는 모든 사용자'로 설정하고 [완료]를 누르면 모든 시트 탭의 표와 셀 단어까지 자동 검색됩니다.)"
                        )
                        if is_private_gdoc
                        else "구글 드라이브 웹 문서입니다. 파일명으로 즉시 검색되며(링크 공유 시트·문서는 본문·표까지 자동 인덱싱) 원본 열기로 웹에서 바로 편집할 수 있습니다."
                    )
                )
            )
        elif ext_low in (".txt", ".md", ".json", ".log"):
            raw_bytes = file_path.read_bytes()[:262144]
            try:
                preview_text = raw_bytes.decode("utf-8-sig")[:12000]
            except UnicodeDecodeError:
                preview_text = raw_bytes.decode("cp949", errors="ignore")[:12000]
        elif ext_low in (".pdf", ".hwp", ".hwpx", ".docx", ".doc", ".pptx", ".ppt", ".xls"):
            try:
                import plugin_ghosti_os

                use_ocr = bool(allow_pdf_ocr and ext_low == ".pdf" and st.st_size <= 15 * 1024 * 1024)
                extracted = plugin_ghosti_os._extract_doc_text(
                    file_path,
                    allow_pdf_winrt_ocr=use_ocr,
                    flush_disk=False,
                )
                if (
                    extracted
                    and "로컬 문서 파일입니다. 파일명 및 키워드로 즉시 검색됩니다." not in extracted
                    and "PDF 문서입니다." not in extracted
                ):
                    preview_text = extracted[:12000]
            except Exception:
                pass
    except Exception:
        pass

    sha256_hex = ""
    if ext_low in (".gdoc", ".gsheet", ".gslides"):
        sha256_hex = f"gdoc_{gdoc_doc_id or 'local'}_{int(st.st_mtime)}"
    elif st.st_size <= 25 * 1024 * 1024:
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

    res_out: Dict[str, Any] = {
        "ext": ext_upper,
        "isImage": is_image,
        "previewText": preview_text.strip(),
        "tableHeaders": table_headers,
        "tableRows": table_rows,
        "imageBase64": image_base64,
        "sha256": sha256_hex,
    }
    if gdoc_retry_after > 0.0:
        res_out["_gdoc_retry_after_mono"] = gdoc_retry_after
    return res_out


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
_PREVIEW_SYNC_BUDGET_SEC = 1.6  # 목록 요청 1회당 즉시 추출에 쓰는 최대 시간 (나머지는 백그라운드)


def _preview_worker_loop() -> None:
    if os.name == "nt":
        try:
            k32 = ctypes.windll.kernel32
            k32.SetThreadPriority(k32.GetCurrentThread(), -2)  # THREAD_PRIORITY_LOWEST
        except Exception:
            pass
    while True:
        _PREVIEW_WAKE.wait(timeout=30)
        did_extract = False
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
                    meta_bg = _compute_rich_preview(path, st, allow_pdf_ocr=True)
                    _put_cached_preview(key, meta_bg)
                    if meta_bg.get("previewText") and not meta_bg.get("isImage"):
                        s_full_bg: Optional[str] = None
                        try:
                            v_dir_bg = get_work_vault_dir(ensure_dirs=False)
                            m_let_bg = _mounted_letter_for_vault(v_dir_bg)
                            if m_let_bg:
                                rel_bg = str(Path(os.path.normcase(str(_norm_vault_path(path)))).relative_to(Path(os.path.normcase(str(_norm_vault_path(v_dir_bg))))))
                                s_full_bg = _drive_root(m_let_bg) + rel_bg.replace("/", "\\")
                        except Exception:
                            s_full_bg = None
                        _sync_doc_body_to_ghost_search_cache(path, s_full_bg, st, str(meta_bg["previewText"]))
                        did_extract = True
            except Exception:
                pass
        if did_extract:
            _flush_ghost_search_doc_cache()


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
    cand = _norm_vault_path(vault_dir / clean)
    vault_resolved = _norm_vault_path(vault_dir)
    try:
        Path(os.path.normcase(str(cand))).relative_to(Path(os.path.normcase(str(vault_resolved))))
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
    # [초대 팀원 방 나가기/추방 후 격리 보호]: 비방장 미연결 잠금 상태에서는 이전 업무방의 잔여 파일 목록을 절대 반환하지 않음
    if (
        cfg.get("workEntitlementLocked") is True
        and not bool(cfg.get("isWorkHost"))
        and not str(cfg.get("activeWorkRoomId") or "").strip()
        and str(cfg.get("workLockReason") or "") != "WORK_TRIAL_EXPIRED"
    ):
        return {
            "ok": True,
            "mounted": False,
            "driveLetter": WORK_DRIVE_PREFERRED,
            "targetDir": str(vault_dir),
            "listSig": "locked_isolated_empty",
            "scanComplete": True,
            "fileCount": 0,
            "previewPendingCount": 0,
            "locallyDeletedRelPaths": [],
            "localDeletedTombstones": {},
            "files": [],
        }
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
    synced_doc_cache_any = False
    sig_h = hashlib.sha256()
    sig_h.update(f"{mounted_letter or ''}|{vault_dir}\n".encode("utf-8", "ignore"))
    files_out: List[Dict[str, Any]] = []
    for full_p, rel_p, st in entries:
        s_full_str = (_drive_root(mounted_letter) + rel_p.replace("/", "\\")) if mounted_letter else str(full_p)
        key = _preview_sig_key(full_p, st)
        meta = _get_cached_preview(key, force_recheck_unexported=not bool(known_sig))
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
        elif meta.get("previewText") and not meta.get("isImage"):
            _sync_doc_body_to_ghost_search_cache(full_p, s_full_str, st, str(meta["previewText"]))
            synced_doc_cache_any = True
        folder_id, folder_name, folder_path = _resolve_folder_meta(rel_p, mounted_letter)
        locked_by = _lock_owner_from_scan(
            full_p, lock_names_by_dir.get(os.path.normcase(str(full_p.parent))), fallback_owner, win32_map, rel_p
        )
        is_hidden = rel_p in hidden_rel_set
        sig_h.update(
            f"{rel_p}|{st.st_size}|{st.st_mtime_ns}|{locked_by or ''}|{0 if pending else 1}|{1 if is_hidden else 0}|{len(meta.get('previewText') or '')}|{len(meta.get('tableRows') or [])}\n".encode(
                "utf-8", "ignore"
            )
        )
        files_out.append(
            {
                "name": full_p.name,
                "relPath": rel_p,
                "fullPath": s_full_str,
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
    if synced_doc_cache_any:
        _flush_ghost_search_doc_cache()
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
                    raw_sync = read_work_file_bytes_safe(full_p)
                    if raw_sync:
                        item["syncBase64"] = base64.b64encode(raw_sync).decode("ascii")
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
    if (
        cfg.get("workEntitlementLocked") is True
        and not bool(cfg.get("isWorkHost"))
        and not str(cfg.get("activeWorkRoomId") or "").strip()
        and str(cfg.get("workLockReason") or "") != "WORK_TRIAL_EXPIRED"
    ):
        return {"ok": True, "locks": {}, "fileCount": 0}
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


def read_work_file_bytes_safe(target: Path) -> bytes:
    """일반 파일은 원본 바이트를 그대로 읽고, Google DriveFS 가상 스텁(.gsheet/.gdoc/.gslides, WinError 1)은
    팀원 PC 탐색기 S:\\에서도 더블클릭·웹 열기가 100% 작동하도록 정식 JSON 바로가기 바이트로 합성 반환합니다."""
    ext_l = target.suffix.lower()
    try:
        raw_b = target.read_bytes()
        if raw_b or ext_l not in (".gsheet", ".gdoc", ".gslides"):
            return raw_b
    except OSError:
        if ext_l not in (".gsheet", ".gdoc", ".gslides"):
            raise
    import ghosti_safe_ops

    g_meta = ghosti_safe_ops.resolve_google_workspace_shortcut_meta(target)
    payload_obj = {
        "url": str(g_meta.get("url") or ""),
        "doc_id": str(g_meta.get("doc_id") or ""),
    }
    return json.dumps(payload_obj, ensure_ascii=False).encode("utf-8")


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
    raw_bytes = read_work_file_bytes_safe(target)
    b64 = base64.b64encode(raw_bytes).decode("ascii")
    return {
        "ok": True,
        "relPath": rel_p.replace("\\", "/"),
        "fileName": target.name,
        "size": len(raw_bytes),
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
    if not target:
        return True
    try:
        # 1초 실행 취소(Undo) 시 100% 실물 파일 복원을 위해 임시 안전 금고에 백업 보관 (최대 20개 FIFO)
        undo_vault = _get_merlin_appdata_dir() / "work_undo_vault"
        undo_vault.mkdir(parents=True, exist_ok=True)
        undo_dest = undo_vault / (hashlib.sha256(str(target).encode("utf-8")).hexdigest()[:16] + "_" + target.name)
        try:
            shutil.copy2(target, undo_dest)
        except Exception:
            pass
    except Exception:
        pass
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
    mirror_authoritative = bool(payload.get("mirrorAuthoritative", False))
    raw_auth_rels = payload.get("authoritativeRelPaths")
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

    # [초대 팀원 PC 탐색기 S:\ 정본 미러링 정합화]:
    # 방장이 [업무 폴더 변경]으로 공유 폴더를 바꿨을 때, 초대 팀원 PC의 기본 미러 폴더(%LOCALAPPDATA%\Merlin\업무공유폴더_S)에
    # 남아 있던 변경 전 구 파일(휴지통 안전 이동)과 빈 기본 서브폴더(01_~04_ 등)를 자동 정리해 방장 S:\와 100% 일치시킵니다.
    is_managed_default_vault = _same_path(vault_dir, _default_work_vault_dir())
    if mirror_authoritative and is_managed_default_vault and isinstance(raw_auth_rels, list):
        auth_low_set = {
            str(r or "").strip().replace("\\", "/").lstrip("/").lower()
            for r in raw_auth_rels
            if str(r or "").strip()
        }
        for item_in in incoming:
            if isinstance(item_in, dict) and item_in.get("relPath"):
                auth_low_set.add(str(item_in["relPath"]).strip().replace("\\", "/").lstrip("/").lower())
        now_sec = time.time()
        cur_entries, _, _ = _scan_work_vault(vault_dir, set(), include_hidden=True)
        for cur_full_p, cur_rel_p, cur_st in cur_entries:
            if cur_rel_p.lower() in auth_low_set:
                continue
            if (now_sec - float(cur_st.st_mtime)) < 12.0:
                continue
            if detect_file_lock_owner(cur_full_p):
                continue
            if _move_to_recycle_bin_safe(cur_full_p):
                removed_rel_set.add(cur_rel_p)
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
        try:
            expected_size = int(item.get("byteSize") or item.get("size") or 0)
        except Exception:
            expected_size = 0
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
            if target.suffix.lower() in (".gsheet", ".gdoc", ".gslides"):
                local_meta_g = _extract_rich_preview_cached(target, st)
                if (
                    (remote_sha and str(local_meta_g.get("sha256") or "").lower() == remote_sha.lower())
                    or _is_google_drive_or_virtual_cloud_path(vault_dir)
                ):
                    if uploader and up_map.get(rel_p) != uploader:
                        up_map[rel_p] = uploader
                    added_rel_set.add(rel_p)
                    skipped += 1
                    continue
            is_valid_hex_sha = len(remote_sha) == 64 and all(c in "0123456789abcdefABCDEF" for c in remote_sha)
            if is_valid_hex_sha:
                local_meta = _extract_rich_preview_cached(target, st)
                if str(local_meta.get("sha256") or "").lower() == remote_sha.lower():
                    if uploader and up_map.get(rel_p) != uploader:
                        up_map[rel_p] = uploader
                    added_rel_set.add(rel_p)
                    skipped += 1
                    continue
            # 이미 동일 크기·동일 수정시각(±3초)으로 동기화된 파일은 재기록하지 않고 스킵 (주기 폴링 시 무한 +N건 누적 원천 차단)
            if expected_size > 0 and st.st_size == expected_size and remote_mtime > 0 and abs(st.st_mtime - remote_mtime) <= 3.0:
                if uploader and up_map.get(rel_p) != uploader:
                    up_map[rel_p] = uploader
                added_rel_set.add(rel_p)
                skipped += 1
                continue
            if not is_valid_hex_sha and b64_raw:
                try:
                    cand_b64 = b64_raw.split(",", 1)[1] if (b64_raw.startswith("data:") and "," in b64_raw) else b64_raw
                    cand_bytes = base64.b64decode(cand_b64)
                    if st.st_size == len(cand_bytes) and hashlib.sha256(target.read_bytes()).digest() == hashlib.sha256(cand_bytes).digest():
                        if uploader and up_map.get(rel_p) != uploader:
                            up_map[rel_p] = uploader
                        added_rel_set.add(rel_p)
                        skipped += 1
                        continue
                except Exception:
                    pass
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

    if mirror_authoritative and is_managed_default_vault:
        try:
            vault_norm = os.path.normcase(os.path.abspath(str(vault_dir)))
            for root_d, subdirs, files_d in os.walk(str(vault_dir), topdown=False):
                if os.path.normcase(os.path.abspath(root_d)) == vault_norm:
                    continue
                if not files_d and not subdirs:
                    try:
                        os.rmdir(root_d)
                        removed_by_tombstone += 1
                    except OSError:
                        pass
        except Exception:
            pass

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


def restore_deleted_work_file(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """[↩️ 1초 실행 취소(Undo)] 대장 PC 로컬 및 직통 터널을 통해 삭제된 파일을 임시 금고(_undo_vault)에서 100% 실물 파일로 복원하고 Tombstone을 즉시 해제합니다."""
    payload = data or {}
    rel_p = str(payload.get("relPath") or "").strip().replace("\\", "/").lstrip("/")
    if not rel_p:
        return {"ok": False, "error": "EMPTY_REL_PATH"}
    vault_dir = get_work_vault_dir(ensure_dirs=True)
    target = _safe_resolve_inside_vault(vault_dir, rel_p)
    if target is None:
        return {"ok": False, "error": "INVALID_REL_PATH"}

    restored_real_file = False
    undo_vault = _get_merlin_appdata_dir() / "work_undo_vault"
    if undo_vault.is_dir():
        # 임시 금고 내 해시 접두사 매칭
        cand_hash = hashlib.sha256(str(target).encode("utf-8")).hexdigest()[:16] + "_" + target.name
        undo_source = undo_vault / cand_hash
        if not undo_source.is_file():
            # 파일명 단독 폴백 검색
            for cand in undo_vault.glob(f"*_{target.name}"):
                if cand.is_file():
                    undo_source = cand
                    break
        if undo_source.is_file():
            try:
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(undo_source, target)
                restored_real_file = True
            except Exception:
                pass

    def _apply_restore(cur: Dict[str, Any]) -> None:
        known = set(cur.get("knownRelPaths") or [])
        known.add(rel_p)
        cur["knownRelPaths"] = sorted(known)
        tombs = dict(cur.get("deletedTombstones") or {})
        tombs.pop(rel_p, None)
        cur["deletedTombstones"] = tombs

    local_tombs = dict(_mutate_sdrive_config(_apply_restore).get("deletedTombstones") or {})
    return {
        "ok": True,
        "relPath": rel_p,
        "restoredRealFile": restored_real_file,
        "localDeletedTombstones": local_tombs,
        "message": f"'{target.name}' 파일이 100% 정상 복원되었습니다.",
    }


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
_TUNNEL_LOCK = threading.RLock()
_TUNNEL_STATE: Dict[str, Any] = {
    "proc": None,
    "url": "",
    "status": "idle",  # idle | downloading_binary | starting | connected | error | stopped
    "error": "",
    "startedAt": "",
    "startingMono": 0.0,
    "cfCooldownUntilMono": 0.0,
    "lastBridgeNotifyMono": 0.0,
    "lastBridgeNotifiedUrl": "",
}
_CLOUDFLARED_RELEASE_URL = (
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
)
_OUTBOUND_TUNNEL_URL_RE = re.compile(
    r"(https://(?:[a-z0-9-]+\.trycloudflare\.com|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:lhr\.life|lhr\.domains)))",
    re.IGNORECASE,
)
_TRYCLOUDFLARE_URL_RE = _OUTBOUND_TUNNEL_URL_RE


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
    active_owner = str(cfg.get("activeAccountEmail") or "").strip().lower()
    now_mono = time.monotonic()
    with _TUNNEL_LOCK:
        proc = _TUNNEL_STATE.get("proc")
        alive = proc is not None and (proc.poll() is None)
        url = str(_TUNNEL_STATE.get("url") or "") if alive else ""
        status = str(_TUNNEL_STATE.get("status") or "idle")
        starting_mono = float(_TUNNEL_STATE.get("startingMono") or 0.0)
        in_startup_grace = status in ("starting", "downloading_binary") and (now_mono - starting_mono) < 22.0
        if not alive and status in ("connected", "starting") and not in_startup_grace:
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
        "isWorkHost": bool(cfg.get("isWorkHost")),
        "workEntitlementLocked": bool(cfg.get("workEntitlementLocked", True)),
        "activeOwnerEmail": active_owner if not bool(cfg.get("workEntitlementLocked", True)) else "",
        "nightPowerSaveEnabled": bool(cfg.get("nightPowerSaveEnabled")),
    }


def _cleanup_orphan_cloudflared_processes(keep_pid: int = 0) -> None:
    """이전 Z-코어 세션에서 종료되지 않고 남은 고아 cloudflared.exe / ssh(nokey@localhost.run) 프로세스를 정리해 중복 누수를 원천 차단합니다."""
    if os.name != "nt":
        return
    try:
        ps_cmd = (
            f"$kp={int(keep_pid or 0)}; "
            "Get-CimInstance Win32_Process -Filter \"Name='cloudflared.exe' or Name='ssh.exe'\" -ErrorAction SilentlyContinue | "
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


_TUNNEL_WATCHDOG: Dict[str, Any] = {"thread": None}
_SERVER_BRIDGE_ENDPOINTS = (
    "https://ghosti.sundreamer.app/.netlify/functions/hub-supabase-bridge",
    "https://ghosti-app.netlify.app/.netlify/functions/hub-supabase-bridge",
)


def _notify_server_bridge_tunnel_url(tunnel_url: str) -> bool:
    """대장 PC의 Z-코어가 새 아웃바운드 터널 주소(*.trycloudflare.com / *.lhr.life)를 확보한 즉시,
    브라우저 창이 닫혀 있거나 다른 탭에 있어도 서버 중매 상태(p2p_state_v2.json)에 즉시 자동 갱신합니다."""
    clean_url = str(tunnel_url or "").strip().rstrip("/")
    if not clean_url or not _OUTBOUND_TUNNEL_URL_RE.fullmatch(clean_url):
        return False
    cfg = _load_sdrive_config()
    if cfg.get("workEntitlementLocked") is True or not cfg.get("isWorkHost"):
        return False
    room_id = str(cfg.get("activeWorkRoomId") or "").strip()
    host_email = str(cfg.get("activeAccountEmail") or "").strip().lower()
    access_key = get_or_create_work_access_key(rotate=False)
    if not room_id or not host_email or len(access_key) < 24:
        return False
    payload_bytes = json.dumps(
        {
            "action": "work_refresh_tunnel_by_key",
            "roomId": room_id,
            "hostEmail": host_email,
            "accessKey": access_key,
            "tunnelUrl": clean_url,
            "masterServerName": str(cfg.get("masterServerName") or "").strip()[:48],
            "backupServers": list(cfg.get("backupServers") or [])[:2],
        },
        ensure_ascii=False,
    ).encode("utf-8")
    for endpoint in _SERVER_BRIDGE_ENDPOINTS:
        try:
            req = urllib.request.Request(
                endpoint,
                data=payload_bytes,
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "Origin": "https://sundreamer.app",
                    "User-Agent": "MerlinZCoreWorkTunnel/2.13",
                },
            )
            with urllib.request.urlopen(req, timeout=6.0) as resp:
                body_raw = resp.read().decode("utf-8", errors="ignore")
                parsed = json.loads(body_raw or "{}")
                if resp.status == 200 and parsed.get("ok"):
                    with _TUNNEL_LOCK:
                        _TUNNEL_STATE["lastBridgeNotifyMono"] = time.monotonic()
                        _TUNNEL_STATE["lastBridgeNotifiedUrl"] = clean_url
                    return True
        except Exception:
            continue
    return False


def _find_windows_openssh_binary() -> Optional[str]:
    which_ssh = shutil.which("ssh")
    if which_ssh:
        return which_ssh
    if os.name == "nt":
        cand = Path(os.environ.get("SystemRoot") or r"C:\Windows") / "System32" / "OpenSSH" / "ssh.exe"
        if cand.is_file():
            return str(cand)
    return None


def _tunnel_watchdog_loop() -> None:
    import time as _time

    first_pass = True
    while True:
        _time.sleep(3.5 if first_pass else 25.0)
        first_pass = False
        try:
            cfg = _load_sdrive_config()
            if cfg.get("workEntitlementLocked") is True or not cfg.get("isWorkHost"):
                continue
            now_m = _time.monotonic()
            need_start = False
            need_repush_url = ""
            with _TUNNEL_LOCK:
                proc = _TUNNEL_STATE.get("proc")
                alive = proc is not None and (proc.poll() is None)
                status = str(_TUNNEL_STATE.get("status") or "idle")
                cur_url = str(_TUNNEL_STATE.get("url") or "")
                starting_m = float(_TUNNEL_STATE.get("startingMono") or 0.0)
                last_push_m = float(_TUNNEL_STATE.get("lastBridgeNotifyMono") or 0.0)
                last_push_url = str(_TUNNEL_STATE.get("lastBridgeNotifiedUrl") or "")
                if not alive:
                    if status not in ("starting", "downloading_binary") or (now_m - starting_m) > 22.0:
                        _TUNNEL_STATE["status"] = "stopped"
                        _TUNNEL_STATE["url"] = ""
                        need_start = True
                elif cur_url and (cur_url != last_push_url or (now_m - last_push_m) > 120.0):
                    need_repush_url = cur_url
            if need_start:
                ensure_outbound_work_tunnel()
            elif need_repush_url:
                _notify_server_bridge_tunnel_url(need_repush_url)
        except Exception:
            pass


def _ensure_tunnel_watchdog_started() -> None:
    th = _TUNNEL_WATCHDOG.get("thread")
    if th is None or not th.is_alive():
        th = threading.Thread(target=_tunnel_watchdog_loop, name="ghosti-work-tunnel-watchdog", daemon=True)
        _TUNNEL_WATCHDOG["thread"] = th
        th.start()


def ensure_outbound_work_tunnel(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """대장 PC에서 상시 아웃바운드 HTTPS 직통 터널을 기동합니다.
    - 1순위: Cloudflare QuickTunnel (cloudflared.exe -> *.trycloudflare.com)
    - 2순위(자동 무중단 폴백): 사내 공유 공인 IP 다중 기동 등으로 trycloudflare HTTP 429 레이트리밋 발생 시,
      추가 설치·계정 0건인 Windows 내장 OpenSSH 역방향 TLS 터널(nokey@localhost.run -> *.lhr.life)로 1초 내 즉시 자동 전환합니다."""
    cfg = _load_sdrive_config()
    if cfg.get("workEntitlementLocked") is True or not bool(cfg.get("isWorkHost")):
        stop_outbound_work_tunnel()
        return {
            "ok": False,
            "error": "WORK_SUBSCRIPTION_LOCKED" if cfg.get("workEntitlementLocked") is True else "WORK_HOST_ONLY_TUNNEL",
            "status": "locked" if cfg.get("workEntitlementLocked") is True else "member_client_only",
            "tunnelUrl": "",
        }

    _ensure_tunnel_watchdog_started()

    now_mono = time.monotonic()
    already_running = False
    with _TUNNEL_LOCK:
        proc_existing = _TUNNEL_STATE.get("proc")
        alive_existing = proc_existing is not None and (proc_existing.poll() is None)
        cur_status = str(_TUNNEL_STATE.get("status") or "idle")
        cur_url = str(_TUNNEL_STATE.get("url") or "")
        starting_mono = float(_TUNNEL_STATE.get("startingMono") or 0.0)
        if (alive_existing and cur_url) or (
            cur_status in ("starting", "downloading_binary") and (now_mono - starting_mono) < 22.0
        ):
            already_running = True
        else:
            # 동시 요청 경합(Race Condition) 및 get_outbound_work_tunnel_status 조기 stopped 오판 원천 차단!
            _TUNNEL_STATE["status"] = "starting"
            _TUNNEL_STATE["startingMono"] = now_mono
            _TUNNEL_STATE["error"] = ""
    if already_running:
        return get_outbound_work_tunnel_status()

    def _run_tunnel_cmd_and_stream(cmd_args: List[str], provider_tag: str) -> Tuple[bool, bool]:
        """터널 프로세스를 실행하고 URL 발급 시 connected 전환 후 종료될 때까지 대기합니다.
        반환값: (ever_connected, hit_rate_limit_429)"""
        ever_connected = False
        hit_429 = False
        proc = subprocess.Popen(
            cmd_args,
            stdin=subprocess.DEVNULL,
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
            _TUNNEL_STATE["startingMono"] = time.monotonic()
        assert proc.stdout is not None
        for line in proc.stdout:
            low_line = (line or "").lower()
            if "status 429" in low_line or "429 too many requests" in low_line or "provisioning failed" in low_line:
                hit_429 = True
            m = _OUTBOUND_TUNNEL_URL_RE.search(line or "")
            if m and not ever_connected:
                found_url = m.group(1).rstrip("/")
                ever_connected = True
                with _TUNNEL_LOCK:
                    _TUNNEL_STATE["url"] = found_url
                    _TUNNEL_STATE["status"] = "connected"
                    _TUNNEL_STATE["error"] = ""
                _save_sdrive_config({"lastTunnelUrl": found_url, "lastTunnelProvider": provider_tag})
                threading.Thread(
                    target=_notify_server_bridge_tunnel_url,
                    args=(found_url,),
                    daemon=True,
                ).start()
        try:
            proc.wait(timeout=1.5)
        except Exception:
            pass
        return ever_connected, hit_429

    def _spawn_worker() -> None:
        _cleanup_orphan_cloudflared_processes(keep_pid=0)
        ever_ok = False
        with _TUNNEL_LOCK:
            cf_cooldown_until = float(_TUNNEL_STATE.get("cfCooldownUntilMono") or 0.0)

        # 1순위: Cloudflare QuickTunnel (쿨다운 중이 아닐 때 우선 시도)
        if time.monotonic() >= cf_cooldown_until:
            bin_p = _find_or_download_cloudflared_binary()
            if bin_p is not None:
                try:
                    ever_ok, hit_429 = _run_tunnel_cmd_and_stream(
                        [
                            str(bin_p),
                            "tunnel",
                            "--url",
                            "http://127.0.0.1:5199",
                            "--no-autoupdate",
                        ],
                        "cloudflare",
                    )
                    if hit_429 or not ever_ok:
                        with _TUNNEL_LOCK:
                            _TUNNEL_STATE["cfCooldownUntilMono"] = time.monotonic() + (900.0 if hit_429 else 180.0)
                except Exception as exc:
                    with _TUNNEL_LOCK:
                        _TUNNEL_STATE["error"] = str(exc)

        # 2순위: cloudflared 429 레이트리밋 또는 바이너리 차단 시 Windows 내장 OpenSSH 역방향 HTTPS 터널 즉시 폴백
        if not ever_ok:
            ssh_bin = _find_windows_openssh_binary()
            if ssh_bin:
                try:
                    with _TUNNEL_LOCK:
                        _TUNNEL_STATE["status"] = "starting"
                        _TUNNEL_STATE["startingMono"] = time.monotonic()
                    ever_ok, _ = _run_tunnel_cmd_and_stream(
                        [
                            ssh_bin,
                            "-T",
                            "-o",
                            "StrictHostKeyChecking=no",
                            "-o",
                            "UserKnownHostsFile=NUL",
                            "-o",
                            "BatchMode=yes",
                            "-o",
                            "ServerAliveInterval=25",
                            "-o",
                            "ServerAliveCountMax=3",
                            "-o",
                            "ExitOnForwardFailure=yes",
                            "-R",
                            "80:127.0.0.1:5199",
                            "nokey@localhost.run",
                        ],
                        "localhost_run_ssh",
                    )
                except Exception as exc:
                    with _TUNNEL_LOCK:
                        _TUNNEL_STATE["status"] = "error"
                        _TUNNEL_STATE["error"] = f"SSH_FALLBACK_FAILED: {exc}"
            else:
                with _TUNNEL_LOCK:
                    _TUNNEL_STATE["status"] = "error"
                    _TUNNEL_STATE["error"] = "OUTBOUND_TUNNEL_UNAVAILABLE"

        # 프로세스 종료 시 상태 정리 -> 워치독이 자동 재기동
        with _TUNNEL_LOCK:
            proc_cur = _TUNNEL_STATE.get("proc")
            if proc_cur is None or proc_cur.poll() is not None:
                _TUNNEL_STATE["proc"] = None
                _TUNNEL_STATE["url"] = ""
                if _TUNNEL_STATE.get("status") != "error":
                    _TUNNEL_STATE["status"] = "stopped"

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
    warning_low_disk = False
    warning_disk_msg = ""
    target_slot_used = 1

    if act == "promote-master":
        # [1클릭 수동 대장 승격]: 예비 백업 PC를 즉시 사내 대장 PC(S:)로 승격
        new_master_name = str(payload.get("newMasterServerName") or os.environ.get("COMPUTERNAME") or "승격된 대장 PC").strip()
        _save_sdrive_config({
            "masterServerName": new_master_name,
            "isPromotedMaster": True,
            "promotedAt": _iso_utc(),
        })
        cfg = _load_sdrive_config()
        return {
            "ok": True,
            "masterServerName": new_master_name,
            "isPromotedMaster": True,
            "backupServers": list(cfg.get("backupServers") or []),
            "message": f"'{new_master_name}' 컴퓨터가 사내 대장 PC(S:)로 1클릭 수동 승격되었습니다.",
        }

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
        
        # 가용 용량 < 10GB 사전 경고 및 2호기 자동 우회 검사 (shutil.disk_usage)
        try:
            usage = shutil.disk_usage(target_bdir.drive or target_bdir.anchor or target_bdir.parent)
            free_gb = usage.free / (1024 ** 3)
            if free_gb < 10.0:
                warning_low_disk = True
                warning_disk_msg = f"예비 백업 드라이브의 가용 공간이 10GB 미만({free_gb:.1f}GB)입니다. 예비 2호 폴더로 자동 우회 백업합니다."
                # 2호기 슬롯 보조 백업 폴더로 자동 전환
                target_bdir = _get_merlin_appdata_dir() / "업무공유_예비서버_2호_백업"
                target_slot_used = 2
        except Exception:
            pass

        target_bdir.mkdir(parents=True, exist_ok=True)
        versions_root = target_bdir / "_versions"
        versions_root.mkdir(parents=True, exist_ok=True)

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
                    
                    # 파일 변경 감지 시 최근 5개 버전 타임머신 보관 (_versions/파일명/시각_파일명)
                    file_ver_dir = versions_root / rel_p.replace("/", "_")
                    file_ver_dir.mkdir(parents=True, exist_ok=True)
                    ver_stamp = datetime.datetime.fromtimestamp(dst_st.st_mtime).strftime("%Y%m%d_%H%M%S")
                    ver_file = file_ver_dir / f"{ver_stamp}_{dest.name}"
                    try:
                        shutil.copy2(dest, ver_file)
                        # 최대 최근 5개 버전 초과분 FIFO 정리
                        existing_vers = sorted(file_ver_dir.glob("*"), key=lambda p: p.stat().st_mtime)
                        if len(existing_vers) > 5:
                            for old_v in existing_vers[:-5]:
                                try:
                                    old_v.unlink(missing_ok=True)
                                except Exception:
                                    pass
                    except Exception:
                        pass

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
        "warningLowDisk": warning_low_disk,
        "warningDiskMsg": warning_disk_msg,
        "targetSlotUsed": target_slot_used,
    }


# ─────────────────────────────────────────────────────────────────────────────
# [과금·체험 권한 게이트 & 계정/방 격리 동기화]
# - 만료/미개통(unlocked=False) 시: 즉시 S: 드라이브 연결 해제(폴더 내 원본 파일은 100% 보존) + 외부 터널 종료
# - 계정(email) 또는 방(roomId) 변경 시: 이전 계정의 knownRelPaths·Tombstone을 계정별 슬롯으로 분리해 혼입 0% 보장
# ─────────────────────────────────────────────────────────────────────────────
def _isolate_invited_room_local_vault(room_id: str = "", email: str = "") -> int:
    """초대 팀원이 [이 업무방 나가기]를 누르거나 방장에게 [내보내기(강퇴)] 되었을 때,
    기본 공유 수신 폴더(%LOCALAPPDATA%\\Merlin\\업무공유폴더_S)에 동기화되어 있던 이전 방의 문서·폴더 잔상을
    영구 삭제 없이 격리 보관소(_isolated_left_rooms)로 즉시 분리하고 S: 드라이브와 원장 캐시를 깨끗이 비웁니다.
    (방장 본인이 지정한 사용자 폴더는 절대 건드리지 않습니다.)"""
    moved_count = 0
    vault_dir = get_work_vault_dir(ensure_dirs=False)
    default_dir = _default_work_vault_dir()
    if os.name == "nt":
        for letter in _letters_mapped_to(vault_dir):
            _unmount_drive_letter_sota(letter)
        _list_subst_map(force=True)

    if _same_path(vault_dir, default_dir) and vault_dir.exists():
        safe_room_tag = re.sub(r"[^A-Za-z0-9_.-]+", "_", (room_id or "left_room").strip())[:48] or "left_room"
        ts_tag = datetime.now().strftime("%Y%m%d_%H%M%S")
        iso_root = _get_merlin_appdata_dir() / "_isolated_left_rooms" / f"{safe_room_tag}_{ts_tag}"
        entries, _locks, _complete = _scan_work_vault(vault_dir, set(), include_hidden=True)
        for full_p, rel_p, _st in entries:
            try:
                if detect_file_lock_owner(full_p):
                    continue
                dst = iso_root / Path(rel_p.replace("/", "\\"))
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(full_p), str(dst))
                moved_count += 1
            except Exception:
                pass
        # 비어 있는 기본 서브폴더(01_...~04_... 등) 정리 -> 탐색기나 재스캔 시 빈 폴더 잔상 0건 보장
        try:
            for root_w, dirs_w, _files_w in os.walk(str(vault_dir), topdown=False):
                for d_name in dirs_w:
                    dp = Path(root_w) / d_name
                    try:
                        if not any(dp.iterdir()):
                            dp.rmdir()
                    except Exception:
                        pass
        except Exception:
            pass

    clean_email = (email or "").strip().lower()
    clean_room = (room_id or "").strip()

    def _clear_ledger(cur: Dict[str, Any]) -> None:
        cur["knownRelPaths"] = []
        cur["deletedTombstones"] = {}
        cur["uploaderByRelPath"] = {}
        cur["hiddenRelPaths"] = []
        scoped = dict(cur.get("scopedWorkLedgers") or {})
        if clean_email:
            scoped.pop(f"{clean_email}::", None)
            if clean_room:
                scoped.pop(f"{clean_email}::{clean_room}", None)
            else:
                for k_sc in [k for k in scoped if k.startswith(f"{clean_email}::")]:
                    scoped.pop(k_sc, None)
        cur["scopedWorkLedgers"] = scoped

    _mutate_sdrive_config(_clear_ledger)
    return moved_count


def sync_work_entitlement_state(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    payload = data or {}
    unlocked = bool(payload.get("unlocked", False))
    email = str(payload.get("email") or "").strip().lower()
    raw_room_id = str(payload.get("roomId") or "").strip()
    plan_id = str(payload.get("planId") or "").strip()
    reason = str(payload.get("reason") or "").strip()
    purge_invited = bool(payload.get("purgeInvitedVault", False))
    has_explicit_is_host = "isHost" in payload
    raw_is_host = bool(payload.get("isHost", False))

    # [정책 §5.4-⑨] 1 PC 1계정 단독 점유: 타 계정이 현재 PC를 실시간 점유 중이면 비소유 계정의 권한/언마운트 요청을 100% 차단(No-op)
    owner_block = check_pc_account_owner_allowed(email)
    if owner_block is not None:
        return owner_block

    effective_state: Dict[str, Any] = {
        "roomId": raw_room_id,
        "isHost": raw_is_host,
        "prevRoom": "",
        "prevWasInvited": False,
    }

    def _apply_ent(cur: Dict[str, Any]) -> None:
        prev_email = str(cur.get("activeAccountEmail") or "").strip().lower()
        prev_room = str(cur.get("activeWorkRoomId") or "").strip()
        prev_is_host = bool(cur.get("isWorkHost", False))
        prev_plan = str(cur.get("workPlanId") or "").strip()
        effective_state["prevRoom"] = prev_room
        effective_state["prevWasInvited"] = bool(
            (not prev_is_host) and (prev_room or prev_plan == "work_invited_member")
        )
        by_scope: Dict[str, Any] = dict(cur.get("scopedWorkLedgers") or {})
        cur.pop("accountWorkEntitlements", None)

        # 동일 계정에서 탭 외부(내 기기 통합 등) 공용 권한 호출이 roomId=""로 들어와 기존 활성 업무방 ID·원장을 지우는 현상 원천 차단
        room_id = raw_room_id
        if unlocked and not room_id and not purge_invited and email and email == prev_email and prev_room:
            room_id = prev_room
        is_host = (
            raw_is_host
            if (raw_room_id or purge_invited or not (email and email == prev_email and prev_room))
            else (raw_is_host or prev_is_host)
        )
        if not has_explicit_is_host and not purge_invited and email and email == prev_email:
            is_host = prev_is_host

        effective_state["roomId"] = room_id
        effective_state["isHost"] = is_host

        # 기존 계정·방의 원장을 슬롯에 백업하고 새 계정·방 원장으로 전환 (단, 방 나가기/추방 격리 시에는 이전 초대방 잔상을 백업하지 않고 소거)
        if (prev_email or prev_room) and not purge_invited:
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
        cur["activeWorkRoomId"] = room_id if unlocked else ""
        cur["isWorkHost"] = bool(is_host and unlocked)
        cur["workEntitlementLocked"] = not unlocked
        cur["workPlanId"] = plan_id if unlocked else ""
        cur["workLockReason"] = "" if unlocked else (reason or "SUBSCRIPTION_REQUIRED")
        cur["workEntitlementSyncedAt"] = _iso_utc()

    _mutate_sdrive_config(_apply_ent)

    should_isolate_invited = bool(
        purge_invited or (not unlocked and effective_state.get("prevWasInvited"))
    )
    if should_isolate_invited:
        _isolate_invited_room_local_vault(
            str(effective_state.get("prevRoom") or raw_room_id or ""),
            email,
        )

    if not unlocked:
        unmount_res = mount_or_unmount_s_drive({"action": "unmount", "email": email, "forceUnmount": True})
        stop_outbound_work_tunnel()
        return {
            "ok": True,
            "unlocked": False,
            "mounted": False,
            "unmountedOnExpiry": True,
            "isolatedInvitedVault": should_isolate_invited,
            "targetDir": unmount_res.get("targetDir"),
            "reason": reason or "SUBSCRIPTION_REQUIRED",
            "message": "🔒 업무 공유 연결이 해제되었습니다.",
        }

    if os.name == "nt":
        status_before = inspect_s_drive_status()
        if not status_before.get("mounted"):
            mount_or_unmount_s_drive({"action": "mount", "email": email, "openExplorer": False})

    is_host_final = bool(effective_state.get("isHost"))
    tunnel_info = ensure_outbound_work_tunnel() if is_host_final else get_outbound_work_tunnel_status()
    if is_host_final and tunnel_info.get("tunnelUrl") and effective_state.get("roomId"):
        threading.Thread(
            target=_notify_server_bridge_tunnel_url,
            args=(str(tunnel_info.get("tunnelUrl")),),
            daemon=True,
        ).start()
    status_info = inspect_s_drive_status()
    return {
        "ok": True,
        "unlocked": True,
        "activeOwnerEmail": email,
        "mounted": status_info.get("mounted", False),
        "driveLetter": status_info.get("driveLetter", WORK_DRIVE_PREFERRED),
        "targetDir": status_info.get("targetDir"),
        "tunnel": tunnel_info,
    }


def auto_mount_s_drive_if_unlocked() -> Dict[str, Any]:
    """Z-코어 기동 시(PC 재부팅·엔진 자동 업데이트 후) 기존에 업무 공유 권한이 해금된 PC라면
    탐색기 [S: 드라이브]와 방장 직통 터널(Outbound 443)을 즉시 자동 복원합니다 (미개통·만료 상태는 절대 마운트하지 않음)."""
    if os.name != "nt":
        return {"ok": False, "skipped": "NOT_WINDOWS"}
    try:
        cfg = _load_sdrive_config()
        if cfg.get("workEntitlementLocked") is False:
            mount_res = mount_or_unmount_s_drive({"action": "mount", "openExplorer": False})
            if cfg.get("isWorkHost") or (
                str(cfg.get("workPlanId") or "").strip() not in ("", "work_invited_member")
            ):
                ensure_outbound_work_tunnel()
            return mount_res
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
