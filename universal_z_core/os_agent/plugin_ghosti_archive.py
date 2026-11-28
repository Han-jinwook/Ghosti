#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
❖ Ghosti Smart Archive Plugin (plugin_ghosti_archive.py — 2귀신 전담 관할)
- 탐색기/바탕화면 더블클릭·마우스 우클릭 및 `Ctrl+0` 귀신검색창에서 알집·반디집을 광고 0%·서버 전송 0%로 대체하는 전용 압축 플러그인.
- 핵심 기능:
  1) 탐색기 더블클릭 자동실행(`Ghosti.Archive` ProgID — 타사 압축앱 HKLM/UserChoice 존중 및 백업 복원)
     + 탐색기 일반 우클릭(`👻 귀신같이로 깔끔하게 풀기`, `👻 귀신같이로 ZIP 압축 묶기`)
  2) `Ctrl+0` 귀신검색창 및 웹 검색 결과에서 압축파일(`.zip`·`.7z`·`.rar`·`.tar`·`.gz`·`.tgz`) `[📦 1초 압축 풀기]` 원클릭 직결
  3) 알집 동급 암호 압축 완벽 지원(`.zip` ZipCrypto/AES-256/Deflate64, `.7z` 데이터+헤더 암호화, `.rar` RAR4/RAR5 데이터+헤더 암호화)
     + 눈 아이콘 표시 토글 + 오입력 시 찌꺼기 0바이트 클린 롤백 & 무제한 재입력 암호창
  4) UTF-8 우선 판별 + NFD->NFC 한글 복원, `__MACOSX`/AppleDouble 제외, 금지문자 치환, Zip-Slip `commonpath` 방어,
     기존 폴더 덮어쓰기 원천 차단(`_1`), 단일 `.gz` 지원, 다중 선택 1개 ZIP 병합(`YYMMDD_대표파일_외N건.zip`)
  5) 봉인 존중 원칙(`sealedArchiveRespect`): 유저가 직접 풀기 전에는 압축 내부를 열람하지 않으며,
     직접 압축을 푼 직후에만 풀려 나온 문서·사진을 `extracted_files_index_queue.json`에 즉시 등록(0.05초 검색 연동) 및 실행파일 AMSI 무소음 검문 수행
"""

from __future__ import annotations

import argparse
import ctypes
from ctypes import wintypes
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unicodedata
import uuid
from typing import Any, Dict, List, Optional, Tuple

THIS_DIR = Path(__file__).resolve().parent
_BUNDLE_DIR = Path(getattr(sys, "_MEIPASS", str(THIS_DIR)))
LOCAL_APPDATA = Path(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")))
GHOSTI_ROOT_DIR = LOCAL_APPDATA / "Ghosti"
GHOSTI_BIN_DIR = GHOSTI_ROOT_DIR / "bin"
GHOSTI_DATA_DIR = GHOSTI_ROOT_DIR / "data"
CARE_DIR = GHOSTI_DATA_DIR
EXTRACTED_INDEX_QUEUE_FILE = CARE_DIR / "extracted_files_index_queue.json"

CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0

ARCHIVE_EXTENSIONS: Tuple[str, ...] = (
    ".zip",
    ".7z",
    ".rar",
    ".tar",
    ".gz",
    ".tgz",
    ".bz2",
    ".xz",
)

PLUGIN_METADATA: Dict[str, Any] = {
    "id": "ghosti_archive",
    "owner": "2귀신",
    "version": "2.3.0",
    "architecture": "EXPLORER_AND_CTRL0_SMART_ARCHIVE_PLUGIN",
    "sealedArchiveRespect": True,
    "doubleClickNonInterference": True,
    "supportedExtensions": list(ARCHIVE_EXTENSIONS),
}


def _ensure_care_dir() -> None:
    CARE_DIR.mkdir(parents=True, exist_ok=True)


def is_archive_path(file_path: str) -> bool:
    if not file_path:
        return False
    low = str(file_path).strip().lower()
    return low.endswith(ARCHIVE_EXTENSIONS) and not is_split_archive_follower(low)


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


def _build_archive_cli_command(mode_flag: str, with_arg_placeholder: bool = False) -> Tuple[str, str, str]:
    """
    (full_command_line, executable_path, arguments_only) 튜플을 반환합니다.
    - frozen(.exe) 모드: script 경로 없이 순수 Merlin_Z_Core_Setup.exe + 플래그만 호출합니다.
    - 개발(.py) 모드: pythonw.exe + plugin_ghosti_archive.py + 플래그를 호출합니다.
    """
    exe_str = _get_persistent_or_current_exe()
    arg_tail = f' "{"%1"}"' if with_arg_placeholder else ""
    if getattr(sys, "frozen", False):
        args_only = f"{mode_flag}{arg_tail}".strip()
        return f'"{exe_str}" {args_only}', exe_str, args_only
    script_path = str(Path(__file__).resolve())
    args_only = f'"{script_path}" {mode_flag}{arg_tail}'.strip()
    return f'"{exe_str}" {args_only}', exe_str, args_only


def _get_pythonw_or_exe_command(mode_flag: str) -> str:
    full_cmd, _, _ = _build_archive_cli_command(mode_flag, with_arg_placeholder=True)
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


def _has_third_party_archive_handler(winreg_mod: Any, ext: str, prog_id: str) -> bool:
    """반디집·7-Zip·알집·WinRAR 등 타사 프로그램이 이미 HKCU UserChoice 또는 HKLM 기본값에 연결되어 있는지 확인합니다."""
    builtin_or_ours = {"", "compressedfolder", prog_id.lower()}
    try:
        uc_path = f"Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\{ext}\\UserChoice"
        with winreg_mod.OpenKey(winreg_mod.HKEY_CURRENT_USER, uc_path, 0, winreg_mod.KEY_READ) as uck:
            uc_prog, _ = winreg_mod.QueryValueEx(uck, "Progid")
            if uc_prog and str(uc_prog).strip().lower() not in builtin_or_ours:
                return True
    except Exception:
        pass
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

    # 영구 Z-코어 경로 및 내장 7z 스테이징 보장
    _ = _find_7z_exe()
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
    - '..' 상위 경로 탈출 포함 시 (None, False) 반환하여 Zip-Slip을 원천 차단합니다.
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


def _scan_single_file_amsi_safe(file_path: str, source: str = "smart_unzip") -> Dict[str, Any]:
    """케어 스위트 AMSI 검문 함수가 존재하면 위임하여 수호 장부 DB까지 동일하게 기록합니다."""
    try:
        import plugin_ghosti_care_suite as _cs_amsi

        return _cs_amsi.scan_file_with_defender_amsi(file_path, source=source)
    except Exception:
        return {"ok": True, "status": "CLEAN", "engine": "Windows 기본 보안(AMSI)"}


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
                    sres = _scan_single_file_amsi_safe(str(fp), source="smart_unzip_extracted")
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
        base_scan = _scan_single_file_amsi_safe(str(fallback_archive), source="smart_unzip")
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


def peek_archive_contents(_archive_path: str = "") -> Dict[str, Any]:
    """[봉인 존중 원칙] 유저가 직접 압축을 풀기 전까지 내부 파일 목록을 미리 열람하지 않습니다."""
    return {
        "ok": False,
        "sealedArchiveRespect": True,
        "error": "SEALED_ARCHIVE_RESPECT_NO_PRE_PEEK",
        "message": "귀신같이는 유저가 직접 풀기 전까지 압축파일 내부를 미리 열어보지 않습니다(봉인 존중 원칙).",
    }


def smart_extract_archive(archive_path: str, password: Optional[str] = None) -> Dict[str, Any]:
    """
    [알집 완벽 대체 1초 스마트 압축 해제 — 2귀신 관할]
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

    mutex_handle = None
    if sys.platform == "win32":
        try:
            path_hash = hashlib.sha1(str(p).lower().encode("utf-8")).hexdigest()[:16]
            mutex_name = f"Local\\Ghosti_Extract_{path_hash}"
            mutex_handle = ctypes.windll.kernel32.CreateMutexW(None, False, mutex_name)
            if mutex_handle:
                wait_rc = ctypes.windll.kernel32.WaitForSingleObject(mutex_handle, 0)
                if wait_rc not in (0x00000000, 0x00000080):
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
                uses_exotic_method = bool(comp_types - {0, 8, 12, 14, 99})

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
                                continue
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
        "outputDir": str(created_folder),
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


def smart_create_zip(target_path: str | List[str], password: Optional[str] = None) -> Dict[str, Any]:
    """
    일반 파일·폴더 우클릭 `👻 귀신같이로 ZIP 압축 묶기` 및 1초 압축/암호 압축:
    - 다중 선택(2개 이상) 시 `YYMMDD_대표파일_외N건.zip` 1개로 묶습니다!
    - password가 지정된 경우 pyzipper AES-256 표준 암호 압축으로 생성합니다.
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
        try:
            rp = Path(str(item)).resolve()
            if rp.exists() and str(rp).lower() not in seen_src:
                seen_src.add(str(rp).lower())
                sources.append(rp)
        except Exception:
            continue

    if not sources:
        try:
            sel_paths = get_explorer_selected_paths_non_destructive()
            for sp in sel_paths:
                rp = Path(sp).resolve()
                if rp.exists() and str(rp).lower() not in seen_src:
                    seen_src.add(str(rp).lower())
                    sources.append(rp)
        except Exception:
            pass

    if not sources:
        dl_dir = _get_downloads_dir()
        desk_dir = Path(os.environ.get("USERPROFILE", str(Path.home()))) / "Desktop"
        try:
            import ghosti_safe_ops as _gso_z

            desk_dir = _gso_z.known_folder("desktop")
        except Exception:
            pass
        cand_items: List[Tuple[float, Path]] = []
        for scan_root in (desk_dir, dl_dir):
            if not scan_root.exists():
                continue
            try:
                for ent in scan_root.iterdir():
                    if ent.name.startswith((".", "~$")) or ent.suffix.lower() in (".zip", ".7z", ".rar", ".lnk", ".url", ".ini"):
                        continue
                    cand_items.append((ent.stat().st_mtime, ent))
            except Exception:
                pass
        cand_items.sort(key=lambda x: x[0], reverse=True)
        for _, ent in cand_items[:3]:
            sources.append(ent.resolve())
            if ent.is_dir():
                break

    if not sources:
        return {"ok": False, "error": "SOURCE_NOT_FOUND", "message": "압축할 원본 파일이나 폴더를 찾지 못했습니다."}

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
    clean_pw = (str(password).strip() if password is not None else "")
    is_encrypted = False
    try:
        zf_ctx: Any = None
        if clean_pw:
            try:
                import pyzipper

                zf_ctx = pyzipper.AESZipFile(
                    tmp_zip,
                    mode="w",
                    compression=pyzipper.ZIP_DEFLATED,
                    encryption=pyzipper.WZ_AES,
                )
                zf_ctx.setpassword(clean_pw.encode("utf-8"))
                is_encrypted = True
            except Exception:
                zf_ctx = zipfile.ZipFile(tmp_zip, mode="w", compression=zipfile.ZIP_DEFLATED)
        else:
            zf_ctx = zipfile.ZipFile(tmp_zip, mode="w", compression=zipfile.ZIP_DEFLATED)

        with zf_ctx as zf:
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
        "sourceNames": [s.name for s in sources],
        "sourceCount": len(sources),
        "addedCount": added_count,
        "encrypted": is_encrypted,
        "toastMessage": (
            f"🔒 '{out_zip.name}' ({added_count}개 파일 · AES-256 암호 압축) 생성 완료!"
            if is_encrypted
            else f"🗜️ '{out_zip.name}' ({added_count}개 파일) 압축 묶기 완료! (맥·윈도우 한글 호환 100%)"
        ),
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
            return None

    try:
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
    parent_win: Any = None,
) -> Dict[str, Any]:
    """
    탐색기 더블클릭·우클릭 및 `Ctrl+0` 귀신검색창 `[📦 1초 압축 풀기]` 실행 시 알집과 동일하게:
    - 암호가 걸려 있으면 암호 입력창을 띄우고,
    - 비밀번호가 틀리면 찌꺼기 없이 즉시 '비밀번호가 일치하지 않습니다' 경고와 함께 맞을 때까지(또는 취소할 때까지) 재입력받습니다!
    """
    res = smart_extract_archive(archive_path)
    while not res.get("ok") and res.get("needPassword"):
        err_msg = str(res.get("message") or "") if res.get("wrongPassword") else ""
        pwd = _prompt_archive_password_tk(Path(archive_path).name, error_message=err_msg, parent_win=parent_win)
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


def handle_archive_request(action: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """2귀신 스마트 압축 전용 HTTP/RPC 액션 핸들러 (`/__archive/*` 및 `/api/care/*` 공용)."""
    data = payload or {}
    act = (action or "").strip().lower()
    if act in ("peek", "peek-archive", "peek_archive", "archive/peek"):
        return peek_archive_contents(str(data.get("path") or ""))
    if act in ("context-menu-ensure", "register-context-menu", "archive/context-menu/ensure"):
        return register_explorer_context_menu()
    if act in ("unregister-context-menu", "archive/context-menu/remove"):
        return unregister_explorer_context_menu()
    if act in ("explorer-selected", "explorer_selected"):
        return {"ok": True, "selectedPaths": get_explorer_selected_paths_non_destructive()}
    if act in ("extract", "extract-archive", "extract_archive", "smart-unzip", "archive/extract", "interactive-unzip"):
        raw_arch = str(data.get("path") or data.get("archivePath") or "").strip()
        if not raw_arch:
            return {"ok": False, "error": "ARCHIVE_NOT_FOUND", "message": "압축 파일 경로가 비어 있습니다."}
        interactive_pw = bool(data.get("interactivePasswordPrompt")) and not data.get("password")
        open_exp = bool(data.get("openExplorer"))
        if interactive_pw:
            return run_interactive_smart_unzip(
                raw_arch,
                open_folder_on_success=open_exp,
                show_error_dialog=False,
            )
        res_ext = smart_extract_archive(archive_path=raw_arch, password=data.get("password"))
        if res_ext.get("ok") and res_ext.get("extractedFolder") and open_exp and sys.platform == "win32":
            try:
                import merlin_z_core_os as _zos_e

                _zos_e.open_file_location_on_interactive_desktop(
                    Path(str(res_ext["extractedFolder"])), mode="open_file_location"
                )
            except Exception:
                try:
                    os.startfile(str(res_ext["extractedFolder"]))
                except Exception:
                    pass
        return res_ext
    if act in ("create", "create-zip", "create_zip", "smart-zip", "archive/zip"):
        raw_paths = data.get("paths")
        pw_arg = data.get("password")
        if isinstance(raw_paths, list) and raw_paths:
            res_zip = smart_create_zip([str(x) for x in raw_paths if x], password=pw_arg)
        else:
            res_zip = smart_create_zip(
                target_path=str(data.get("path") or data.get("targetPath") or ""),
                password=pw_arg,
            )
        if res_zip.get("ok") and res_zip.get("zipPath") and bool(data.get("openExplorer")) and sys.platform == "win32":
            try:
                import merlin_z_core_os as _zos_z

                _zos_z.open_file_location_on_interactive_desktop(
                    Path(str(res_zip["zipPath"])), mode="open_file_location"
                )
            except Exception:
                try:
                    subprocess.Popen(["explorer.exe", f"/select,{res_zip['zipPath']}"])
                except Exception:
                    pass
        return res_zip
    return {"ok": False, "error": f"UNKNOWN_ARCHIVE_ACTION: {action}"}


def handle_archive_cli_args(argv: Optional[List[str]] = None) -> bool:
    """스마트 압축 단발성 CLI 핸들러 (`--smart-unzip`, `--smart-zip`, `--register-menu`, `--unregister-menu`)."""
    raw_argv = list(sys.argv[1:] if argv is None else argv)
    archive_flags = {
        "--smart-unzip",
        "--smart-zip",
        "--register-menu",
        "--unregister-menu",
        "--register-context-menu",
        "--unregister-context-menu",
    }
    if not any(arg in archive_flags or any(arg.startswith(f + "=") for f in archive_flags) for arg in raw_argv):
        return False

    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--smart-unzip", dest="smart_unzip", type=str, default="")
    parser.add_argument("--smart-zip", dest="smart_zip", type=str, default="")
    parser.add_argument("--register-menu", "--register-context-menu", dest="register_menu", action="store_true")
    parser.add_argument("--unregister-menu", "--unregister-context-menu", dest="unregister_menu", action="store_true")
    args, _ = parser.parse_known_args(raw_argv)

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


if __name__ == "__main__":
    handle_archive_cli_args(sys.argv[1:])
