#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[귀신같이 Z-코어] ghosti_safe_ops.py — 치우기·고치기 실물 파일 조작 안전 모듈

설계 원칙 (AGENTS.md 수칙 3 · 정책_및_핵심원칙 'OS 기본 [휴지통] 일원화'):
  1. 유저 파일은 절대 영구 삭제하지 않는다. 지우기 = Windows OS 기본 휴지통 이동(SHFileOperationW + FOF_ALLOWUNDO)만 허용.
     휴지통이 없는 드라이브(USB·네트워크 등)는 휴지통 대신 영구삭제될 위험이 있으므로 거부한다.
  2. 모든 실행은 화면 미리보기 → 유저 [⭕ 확인 완료] 이후에만 호출되며, 미리보기에 실린 '정확한 실물 경로'만 처리한다.
  3. 처리 대상 경로는 화이트리스트(바탕화면·다운로드 바로 아래 / 사진 목록에서 발견된 파일 / 오피스 자동복구 금고)로 제한한다.
  4. 실행 결과는 [복원 기록](restore_points.json)에 실제 경로(from → to)로 남기고, 되돌리기는 기록된 경로만 사용한다.
  5. 덮어쓰기 금지: 같은 이름이 있으면 '(복원본)', '(2)' 등 접미사로 새 이름을 만든다.
  6. 실패는 실패로 반환한다(ok=False + 사유). 가짜 성공 응답을 만들지 않는다.
"""

from __future__ import annotations

import ctypes
import datetime
import hashlib
import json
import os
import re
import shutil
import struct
import subprocess
import threading
import time
import uuid
from ctypes import wintypes
from pathlib import Path
from typing import Any, Dict, List, Optional

LOCAL_APPDATA = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
APPDATA = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
MERLIN_DIR = LOCAL_APPDATA / "Merlin"
RESTORE_POINTS_FILE = MERLIN_DIR / "restore_points.json"
RECYCLE_LEDGER_FILE = MERLIN_DIR / "ghosti_recycle_ledger.json"
SHADOW_VAULT_DIR = MERLIN_DIR / "ShadowVault"
CLEANUP_FOLDER_NAME = "기타_정리함"

_LOCK = threading.RLock()

# ---------------------------------------------------------------------------
# 공통 유틸
# ---------------------------------------------------------------------------

def _now_str() -> str:
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def quick_hash(p: Path) -> str:
    try:
        h = hashlib.sha256()
        with p.open("rb") as f:
            h.update(f.read(65536))
        return h.hexdigest()[:16]
    except Exception:
        return ""


def _read_json_list(path: Path) -> List[Dict[str, Any]]:
    try:
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, list):
                return [x for x in data if isinstance(x, dict)]
    except Exception:
        pass
    return []


def _write_json_list_atomic(path: Path, rows: List[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def unique_target(path: Path, tag: str = "") -> Path:
    """같은 이름이 있으면 덮어쓰지 않고 '이름 (tag).ext' / '이름 (tag 2).ext' 형태의 새 경로를 만든다."""
    if not path.exists():
        return path
    stem, suffix = path.stem, path.suffix
    for i in range(1, 1000):
        label = tag if (tag and i == 1) else (f"{tag} {i}" if tag else f"{i + 1}")
        cand = path.with_name(f"{stem} ({label}){suffix}")
        if not cand.exists():
            return cand
    raise FileExistsError(f"사용 가능한 새 이름을 만들 수 없습니다: {path}")


def is_within(child: Path, parent: Path) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Windows 알려진 폴더(바탕화면·다운로드) — OneDrive 리디렉션까지 정확히 반환
# ---------------------------------------------------------------------------

class _GUID(ctypes.Structure):
    _fields_ = [
        ("Data1", ctypes.c_ulong),
        ("Data2", ctypes.c_ushort),
        ("Data3", ctypes.c_ushort),
        ("Data4", ctypes.c_ubyte * 8),
    ]


_KNOWN_FOLDER_IDS = {
    "desktop": "B4BFCC3A-DB2C-424C-B029-7FE99A87C641",
    "downloads": "374DE290-123F-4565-9164-39C4925E467B",
}


def known_folder(name: str) -> Path:
    key = name.lower()
    fallback = Path.home() / ("Desktop" if key == "desktop" else "Downloads")
    if os.name != "nt" or key not in _KNOWN_FOLDER_IDS:
        return fallback
    try:
        u = uuid.UUID(_KNOWN_FOLDER_IDS[key])
        g = _GUID()
        g.Data1, g.Data2, g.Data3 = u.time_low, u.time_mid, u.time_hi_version
        for i, b in enumerate(u.bytes[8:]):
            g.Data4[i] = b
        ptr = ctypes.c_wchar_p()
        hr = ctypes.windll.shell32.SHGetKnownFolderPath(ctypes.byref(g), 0, None, ctypes.byref(ptr))
        if hr == 0 and ptr.value:
            result = Path(ptr.value)
            ctypes.windll.ole32.CoTaskMemFree(ptr)
            return result
    except Exception:
        pass
    return fallback


# ---------------------------------------------------------------------------
# 현재 사용자 SID (휴지통 조회를 '내 휴지통'으로만 한정 — 타 계정 삭제 이력 열람 금지)
# ---------------------------------------------------------------------------

_SID_CACHE: Optional[str] = None


def current_user_sid() -> Optional[str]:
    global _SID_CACHE
    if _SID_CACHE:
        return _SID_CACHE
    if os.name != "nt":
        return None
    try:
        out = subprocess.run(
            ["whoami", "/user", "/fo", "csv", "/nh"],
            capture_output=True,
            timeout=5,
            creationflags=0x08000000,
        ).stdout.decode("ascii", errors="ignore")
        m = re.search(r"S-1-[0-9-]+", out)
        if m:
            _SID_CACHE = m.group(0)
    except Exception:
        _SID_CACHE = None
    return _SID_CACHE


def fixed_drives() -> List[str]:
    """휴지통이 존재하는 로컬 고정 디스크 목록 (예: ['C:\\', 'D:\\'])."""
    drives: List[str] = []
    if os.name != "nt":
        return drives
    try:
        mask = ctypes.windll.kernel32.GetLogicalDrives()
        for i in range(26):
            if mask & (1 << i):
                root = f"{chr(65 + i)}:\\"
                if ctypes.windll.kernel32.GetDriveTypeW(root) == 3:  # DRIVE_FIXED
                    drives.append(root)
    except Exception:
        drives = ["C:\\"]
    return drives


def user_recycle_dirs() -> List[Path]:
    sid = current_user_sid()
    dirs: List[Path] = []
    if not sid:
        return dirs
    for root in fixed_drives():
        d = Path(root) / "$Recycle.Bin" / sid
        if d.exists():
            dirs.append(d)
    return dirs


# ---------------------------------------------------------------------------
# $I 메타파일 해독 (Vista~8.1 v1 고정 520바이트 / Win10+ v2 길이 접두)
# ---------------------------------------------------------------------------

def parse_recycle_i_file(i_file: Path) -> Optional[Dict[str, Any]]:
    try:
        raw = i_file.read_bytes()
        if len(raw) < 28:
            return None
        version, file_size, filetime = struct.unpack("<QQQ", raw[:24])
        if filetime > 116444736000000000:
            unix_ts = (filetime - 116444736000000000) / 10_000_000.0
        else:
            unix_ts = i_file.stat().st_mtime
        deleted_at = datetime.datetime.fromtimestamp(unix_ts).strftime("%Y-%m-%d %H:%M:%S")
        if version == 2:
            n_chars = struct.unpack("<I", raw[24:28])[0]
            orig = raw[28 : 28 + n_chars * 2].decode("utf-16-le", errors="ignore").rstrip("\x00")
        elif version == 1:
            if len(raw) < 544:
                return None
            orig = raw[24:544].decode("utf-16-le", errors="ignore").split("\x00", 1)[0]
        else:
            return None
        if not orig:
            return None
        r_file = i_file.with_name("$R" + i_file.name[2:])
        return {
            "originalName": Path(orig).name,
            "originalPath": orig,
            "recycleMetaFile": str(i_file),
            "recycleDataFile": str(r_file),
            "dataFileExists": r_file.exists(),
            "sizeBytes": int(file_size),
            "deletedAt": deleted_at,
            "deletedEpoch": unix_ts,
        }
    except Exception:
        return None


def scan_user_recycle_bin(
    keywords: Optional[List[str]] = None,
    max_results: int = 2000,
    deadline_sec: float = 10.0,
) -> Dict[str, Any]:
    """현재 사용자 휴지통(모든 고정 디스크)을 해독한다. keywords 중 하나라도 이름/경로에 포함되면 매칭. 10초 정직 컷오프."""
    t0 = time.perf_counter()
    kws = [k.lower() for k in (keywords or []) if k and k.strip()]
    found: List[Dict[str, Any]] = []
    timed_out = False
    for d in user_recycle_dirs():
        try:
            for entry in d.glob("$I*"):
                if time.perf_counter() - t0 > deadline_sec:
                    timed_out = True
                    break
                meta = parse_recycle_i_file(entry)
                if not meta or not meta["dataFileExists"]:
                    continue
                if kws:
                    hay = (meta["originalName"] + " " + meta["originalPath"]).lower()
                    if not any(k in hay for k in kws):
                        continue
                found.append(meta)
                if len(found) >= max_results:
                    break
        except PermissionError:
            continue
        if timed_out or len(found) >= max_results:
            break
    found.sort(key=lambda x: x.get("deletedEpoch", 0), reverse=True)
    return {
        "ok": True,
        "items": found,
        "count": len(found),
        "timedOut": timed_out,
        "elapsedMs": round((time.perf_counter() - t0) * 1000, 1),
        "scopedToCurrentUser": True,
    }


# ---------------------------------------------------------------------------
# OS 기본 휴지통 이동 / 휴지통에서 원위치 복원
# ---------------------------------------------------------------------------

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


_FO_DELETE = 0x0003
_FOF_SILENT = 0x0004
_FOF_NOCONFIRMATION = 0x0010
_FOF_ALLOWUNDO = 0x0040
_FOF_NOERRORUI = 0x0400


def _drive_has_recycle_bin(p: Path) -> bool:
    s = str(p.resolve())
    if s.startswith("\\\\"):
        return False  # 네트워크 경로: 휴지통 없음 → 영구삭제 위험
    drive = s[:3].upper()
    return drive in [d.upper() for d in fixed_drives()]


def send_to_recycle_bin(path: Path) -> Dict[str, Any]:
    """파일 1개를 OS 기본 휴지통으로 이동하고, 휴지통 안의 $I/$R 위치까지 찾아 반환한다."""
    p = Path(path)
    if os.name != "nt":
        return {"ok": False, "error": "WINDOWS_ONLY"}
    if not p.exists() or not p.is_file():
        return {"ok": False, "error": "원본 파일이 없습니다."}
    if not _drive_has_recycle_bin(p):
        return {"ok": False, "error": "휴지통이 없는 드라이브(USB·네트워크 등)라 안전을 위해 이동하지 않았습니다."}

    original = str(p.resolve())
    started = time.time()
    buf = ctypes.create_unicode_buffer(original + "\0")
    op = _SHFILEOPSTRUCTW()
    op.hwnd = None
    op.wFunc = _FO_DELETE
    op.pFrom = ctypes.cast(buf, wintypes.LPCWSTR)
    op.pTo = None
    op.fFlags = _FOF_ALLOWUNDO | _FOF_NOCONFIRMATION | _FOF_SILENT | _FOF_NOERRORUI
    rc = ctypes.windll.shell32.SHFileOperationW(ctypes.byref(op))
    if rc != 0 or op.fAnyOperationsAborted:
        return {"ok": False, "error": f"휴지통 이동 실패 (코드 {rc})"}
    if Path(original).exists():
        return {"ok": False, "error": "휴지통 이동 후에도 원본이 남아 있습니다."}

    # 방금 들어간 휴지통 항목($I) 찾기 — 원래 경로 일치 + 이동 시각 이후
    match: Optional[Dict[str, Any]] = None
    drive_root = original[:3].upper()
    for _ in range(10):
        for d in user_recycle_dirs():
            if not str(d).upper().startswith(drive_root):
                continue
            for entry in d.glob("$I*"):
                try:
                    if entry.stat().st_mtime < started - 5:
                        continue
                except Exception:
                    continue
                meta = parse_recycle_i_file(entry)
                if meta and meta["originalPath"].lower() == original.lower():
                    if match is None or meta["deletedEpoch"] > match["deletedEpoch"]:
                        match = meta
        if match:
            break
        time.sleep(0.05)

    return {
        "ok": True,
        "originalPath": original,
        "recycleMetaFile": match["recycleMetaFile"] if match else "",
        "recycleDataFile": match["recycleDataFile"] if match else "",
        "locatedInRecycleBin": bool(match),
    }


def restore_from_recycle_bin(meta_file: str) -> Dict[str, Any]:
    """현재 사용자 휴지통의 $I 메타파일을 해독해 $R 실물을 원래 위치로 되돌린다(덮어쓰기 금지)."""
    mf = Path(meta_file or "")
    if not mf.name.startswith("$I"):
        return {"ok": False, "error": "올바른 휴지통 항목이 아닙니다."}
    if not any(is_within(mf, d) for d in user_recycle_dirs()):
        return {"ok": False, "error": "현재 사용자의 휴지통 항목만 복원할 수 있습니다."}
    meta = parse_recycle_i_file(mf)
    if not meta:
        return {"ok": False, "error": "휴지통 기록을 해독하지 못했습니다."}
    data_file = Path(meta["recycleDataFile"])
    if not data_file.exists():
        return {"ok": False, "error": "휴지통에 실물 데이터가 없습니다(휴지통 비우기 등)."}
    target = unique_target(Path(meta["originalPath"]), "복원본")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(data_file), str(target))
    try:
        mf.unlink()
    except Exception:
        pass
    return {
        "ok": True,
        "restoredPath": str(target),
        "originalPath": meta["originalPath"],
        "renamed": str(target).lower() != meta["originalPath"].lower(),
    }


# ---------------------------------------------------------------------------
# 사진 정리 휴지통 장부 (사진 이름 → 휴지통 위치)
# ---------------------------------------------------------------------------

def ledger_load() -> List[Dict[str, Any]]:
    with _LOCK:
        return _read_json_list(RECYCLE_LEDGER_FILE)


def ledger_save(rows: List[Dict[str, Any]]) -> None:
    with _LOCK:
        _write_json_list_atomic(RECYCLE_LEDGER_FILE, rows)


def ledger_find(name: str) -> Optional[Dict[str, Any]]:
    for row in reversed(ledger_load()):
        if row.get("name") == name:
            return row
    return None


def recycle_photos(names: List[str], resolve_path) -> Dict[str, Any]:
    """사진 목록에서 발견된 파일만 휴지통으로 보낸다. resolve_path(name) -> Path|None (사진 목록 인덱스)."""
    moved: List[str] = []
    errors: List[Dict[str, str]] = []
    with _LOCK:
        rows = _read_json_list(RECYCLE_LEDGER_FILE)
        for name in names:
            name = str(name or "").strip()
            src = resolve_path(name) if name else None
            if src is None:
                errors.append({"file": name, "error": "사진 목록에서 확인된 파일이 아닙니다."})
                continue
            res = send_to_recycle_bin(Path(src))
            if not res.get("ok"):
                errors.append({"file": name, "error": str(res.get("error"))})
                continue
            rows.append(
                {
                    "name": name,
                    "originalPath": res["originalPath"],
                    "recycleMetaFile": res.get("recycleMetaFile", ""),
                    "recycleDataFile": res.get("recycleDataFile", ""),
                    "movedAt": _now_str(),
                }
            )
            moved.append(name)
        _write_json_list_atomic(RECYCLE_LEDGER_FILE, rows)
    return {"ok": True, "moved": moved, "errors": errors, "destination": "WINDOWS_RECYCLE_BIN"}


def restore_photos(names: List[str]) -> Dict[str, Any]:
    restored: List[Dict[str, str]] = []
    errors: List[Dict[str, str]] = []
    with _LOCK:
        rows = _read_json_list(RECYCLE_LEDGER_FILE)
        for name in names:
            idx = next((i for i in range(len(rows) - 1, -1, -1) if rows[i].get("name") == name), None)
            if idx is None:
                errors.append({"file": name, "error": "귀신같이가 휴지통으로 옮긴 기록이 없습니다."})
                continue
            row = rows[idx]
            meta_file = row.get("recycleMetaFile") or ""
            if not meta_file:
                errors.append({"file": name, "error": "휴지통 위치를 확인하지 못해 자동 복원할 수 없습니다. 휴지통에서 직접 복원해 주세요."})
                continue
            res = restore_from_recycle_bin(meta_file)
            if not res.get("ok"):
                errors.append({"file": name, "error": str(res.get("error"))})
                continue
            restored.append({"name": name, "restoredPath": res["restoredPath"]})
            rows.pop(idx)
        _write_json_list_atomic(RECYCLE_LEDGER_FILE, rows)
    return {
        "ok": True,
        "restored": [r["name"] for r in restored],
        "restoredPaths": restored,
        "errors": errors,
    }


def recycled_photo_entries() -> List[Dict[str, Any]]:
    """휴지통에 아직 실물이 남아 있는 사진 장부 항목."""
    out: List[Dict[str, Any]] = []
    for row in ledger_load():
        df = Path(row.get("recycleDataFile") or "")
        if row.get("recycleDataFile") and df.exists():
            try:
                st = df.stat()
                out.append(
                    {
                        "path": row["name"],
                        "fullPath": str(df),
                        "size": int(st.st_size),
                        "date": datetime.datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d"),
                        "mtimeMs": int(st.st_mtime * 1000),
                    }
                )
            except Exception:
                continue
    return out


# ---------------------------------------------------------------------------
# [복원 기록] restore_points.json
# ---------------------------------------------------------------------------

def _is_legacy_demo_point(pt: Dict[str, Any]) -> bool:
    for op in pt.get("operations", []) or []:
        if "CleanMonster_Sandbox" in str(op.get("toPath", "")) or "CleanMonster_Sandbox" in str(op.get("fromPath", "")):
            return True
    return False


def load_restore_points() -> List[Dict[str, Any]]:
    """실제 실행 이력만 반환한다. 과거 버전이 자동 생성한 데모 기록(#104 샌드박스)은 제외한다."""
    with _LOCK:
        rows = _read_json_list(RESTORE_POINTS_FILE)
        clean = [r for r in rows if not _is_legacy_demo_point(r)]
        if len(clean) != len(rows):
            _write_json_list_atomic(RESTORE_POINTS_FILE, clean)
        return clean


def _next_restore_id(points: List[Dict[str, Any]]) -> str:
    nums = []
    for p in points:
        m = re.match(r"#(\d+)$", str(p.get("restoreId", "")))
        if m:
            nums.append(int(m.group(1)))
    return f"#{(max(nums) + 1) if nums else 1}"


def add_restore_point(summary: str, user_prompt: str, preview: str, operations: List[Dict[str, Any]]) -> Dict[str, Any]:
    with _LOCK:
        points = load_restore_points()
        rid = _next_restore_id(points)
        now = _now_str()
        pt = {
            "restoreId": rid,
            "createdAt": now,
            "summary": summary,
            "userPrompt": user_prompt,
            "blackbox": {
                "rawUserCommand": user_prompt,
                "previewPresented": preview,
                "userApprovedAt": now,
                "approvalMethod": "USER_EXPLICIT_1TAP_CONFIRM",
            },
            "operations": operations,
        }
        points.insert(0, pt)
        _write_json_list_atomic(RESTORE_POINTS_FILE, points)
        return pt


def precheck_restore_points() -> Dict[str, Any]:
    """3단계 사전 검진: 각 기록의 되돌릴 대상이 지금 디스크에 실제로 있는지 대조한다."""
    t0 = time.perf_counter()
    evaluated: List[Dict[str, Any]] = []
    for pt in load_restore_points():
        ops = pt.get("operations", []) or []
        total = len(ops)
        ok_count = 0
        missing: List[str] = []
        for op in ops:
            to_p = Path(str(op.get("toPath", "")))
            name = str(op.get("name") or to_p.name)
            if op.get("rolledBack"):
                missing.append(f"{name} (이미 되돌림)")
            elif to_p.exists():
                ok_count += 1
            else:
                missing.append(name)
        if total > 0 and ok_count == total:
            status, badge = "FULL_RESTORABLE", "🟢 [100% 완벽 복원 가능]"
            guide = f"되돌릴 항목 {total}건이 모두 현재 위치에 있습니다."
        elif ok_count > 0:
            status, badge = "PARTIAL_RESTORABLE", f"🟡 [부분 복원 가능 ({total}건 중 {ok_count}건)]"
            guide = f"{total}건 중 {ok_count}건을 되돌릴 수 있습니다. 없는 항목: {', '.join(missing[:3])}"
        else:
            status, badge = "UNRESTORABLE", "🔴 [복원 불가 (파일 없음)]"
            guide = "되돌릴 대상 파일이 현재 위치에 없습니다."
        row = dict(pt)
        row.update(
            {
                "integrityStatus": status,
                "statusBadge": badge,
                "totalItems": total,
                "restorableItems": ok_count,
                "missingFiles": missing,
                "precheckGuideMessage": guide,
            }
        )
        evaluated.append(row)
    return {
        "ok": True,
        "officialTerm": "[복원 기록]",
        "precheckElapsedMs": round((time.perf_counter() - t0) * 1000, 2),
        "restorePointsCount": len(evaluated),
        "restorePoints": evaluated,
    }


def rollback_restore_point(restore_id: str) -> Dict[str, Any]:
    rid = (restore_id or "").strip()
    if not rid:
        return {"ok": False, "error": "복원 기록 번호가 없습니다."}
    if not rid.startswith("#"):
        rid = f"#{rid}"
    with _LOCK:
        points = load_restore_points()
        pt = next((p for p in points if p.get("restoreId") == rid), None)
        if not pt:
            return {"ok": False, "error": f"복원 기록({rid})을 찾을 수 없습니다."}
        restored: List[str] = []
        skipped: List[str] = []
        for op in pt.get("operations", []) or []:
            if op.get("rolledBack"):
                continue
            kind = op.get("op", "MOVE")
            to_p = Path(str(op.get("toPath", "")))
            from_p = Path(str(op.get("fromPath", "")))
            name = str(op.get("name") or to_p.name)
            try:
                if kind in ("CREATE_SHORTCUT", "CREATE_COPY"):
                    # 만들어 둔 파일만 지운다: 기록된 해시와 다르면(유저가 수정) 건드리지 않음 → 휴지통으로 이동
                    if to_p.exists() and (not op.get("hash") or quick_hash(to_p) == op.get("hash")):
                        res = send_to_recycle_bin(to_p)
                        if res.get("ok"):
                            restored.append(name)
                            op["rolledBack"] = True
                        else:
                            skipped.append(f"{name} ({res.get('error')})")
                    else:
                        skipped.append(f"{name} (없거나 수정됨)")
                elif kind == "HIDE":
                    if to_p.exists() and set_hidden(to_p, False):
                        restored.append(name)
                        op["rolledBack"] = True
                    else:
                        skipped.append(name)
                else:  # MOVE
                    if to_p.exists():
                        dest = unique_target(from_p, "복원본")
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        shutil.move(str(to_p), str(dest))
                        restored.append(name)
                        op["rolledBack"] = True
                        op["restoredTo"] = str(dest)
                    else:
                        skipped.append(name)
            except Exception as e:
                skipped.append(f"{name} ({e})")
        _write_json_list_atomic(RESTORE_POINTS_FILE, points)
    msg = (
        f"[{rid} 복원 기록] {len(restored)}건을 되돌렸습니다."
        + (f" 되돌리지 못한 항목 {len(skipped)}건: {', '.join(skipped[:3])}" if skipped else "")
    )
    return {
        "ok": len(restored) > 0,
        "restoreId": rid,
        "restoredCount": len(restored),
        "restoredFiles": restored,
        "skippedFiles": skipped,
        "message": msg,
        "error": None if restored else msg,
    }


def set_hidden(p: Path, hide: bool) -> bool:
    try:
        attrs = ctypes.windll.kernel32.GetFileAttributesW(str(p))
        if attrs == -1:
            return False
        new_attrs = (attrs | 0x02) if hide else (attrs & ~0x02)
        return bool(ctypes.windll.kernel32.SetFileAttributesW(str(p), new_attrs))
    except Exception:
        return False


# ---------------------------------------------------------------------------
# 대화형 폴더 정리: 실제 스캔 미리보기 → 승인된 경로만 이동
# ---------------------------------------------------------------------------

_INSTALLER_EXTS = {".exe", ".msi", ".apk", ".msix", ".appx"}
_PARTIAL_EXTS = {".crdownload", ".part", ".tmp", ".download"}
_DESKTOP_JUNK_EXTS = {".tmp", ".bak", ".log", ".crdownload", ".part", ".zip", ".7z", ".rar", ".exe", ".msi", ".apk"}
_NEVER_TOUCH_EXTS = {".lnk", ".url", ".ini", ".sys", ".dll"}


def _cleanup_roots(kind: str) -> List[Path]:
    if kind == "DOWNLOAD_INSTALLERS":
        return [known_folder("downloads")]
    return [known_folder("desktop"), known_folder("downloads")]


def scan_cleanup_candidates(kind: str, min_age_days: float = 3.0, max_items: int = 60) -> Dict[str, Any]:
    """바탕화면·다운로드 '바로 아래' 파일만 본다(하위 폴더·바로가기·시스템 파일 제외). 파일 본문은 읽지 않는다."""
    kind = kind if kind in ("DOWNLOAD_INSTALLERS", "FOLDER_REORG") else "FOLDER_REORG"
    t0 = time.perf_counter()
    items: List[Dict[str, Any]] = []
    now = time.time()
    for root in _cleanup_roots(kind):
        if not root.exists():
            continue
        try:
            entries = list(root.iterdir())
        except Exception:
            continue
        for e in entries:
            try:
                if not e.is_file() or e.name.startswith("~$") or e.name.lower() == "desktop.ini":
                    continue
                ext = e.suffix.lower()
                if ext in _NEVER_TOUCH_EXTS:
                    continue
                st = e.stat()
                age = (now - st.st_mtime) / 86400.0
                if kind == "DOWNLOAD_INSTALLERS":
                    hit = ext in _INSTALLER_EXTS and age >= min_age_days or ext in _PARTIAL_EXTS and age >= 1
                else:
                    hit = ext in _DESKTOP_JUNK_EXTS and age >= min_age_days
                if not hit:
                    continue
                items.append(
                    {
                        "name": e.name,
                        "fullPath": str(e.resolve()),
                        "folderLabel": "바탕화면" if is_within(e, known_folder("desktop")) else "다운로드",
                        "sizeBytes": int(st.st_size),
                        "ageDays": round(age, 1),
                        "modifiedAt": datetime.datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d"),
                    }
                )
            except Exception:
                continue
    items.sort(key=lambda x: x["sizeBytes"], reverse=True)
    items = items[:max_items]
    total = sum(x["sizeBytes"] for x in items)
    return {
        "ok": True,
        "kind": kind,
        "scannedFolders": [str(p) for p in _cleanup_roots(kind)],
        "items": items,
        "count": len(items),
        "totalBytes": total,
        "minAgeDays": min_age_days,
        "elapsedMs": round((time.perf_counter() - t0) * 1000, 1),
    }


def execute_cleanup_move(full_paths: List[str], summary: str, user_prompt: str, preview: str) -> Dict[str, Any]:
    """승인된 실물 경로만 같은 폴더의 '기타_정리함'으로 옮기고 [복원 기록]을 남긴다(삭제 없음)."""
    allowed_roots = [known_folder("desktop"), known_folder("downloads")]
    ops: List[Dict[str, Any]] = []
    errors: List[Dict[str, str]] = []
    for raw in full_paths or []:
        src = Path(str(raw or ""))
        try:
            if not src.exists() or not src.is_file():
                errors.append({"file": src.name, "error": "파일이 없습니다."})
                continue
            parent = src.resolve().parent
            parent_str = str(parent).lower()
            root = next((r for r in allowed_roots if r.exists() and str(r.resolve()).lower() == parent_str), None)
            if root is None:
                errors.append({"file": src.name, "error": "바탕화면·다운로드 바로 아래 파일만 정리할 수 있습니다."})
                continue
            if src.suffix.lower() in _NEVER_TOUCH_EXTS:
                errors.append({"file": src.name, "error": "바로가기·시스템 파일은 정리하지 않습니다."})
                continue
            dest_dir = root / CLEANUP_FOLDER_NAME
            dest_dir.mkdir(exist_ok=True)
            dest = unique_target(dest_dir / src.name)
            size = src.stat().st_size
            shutil.move(str(src), str(dest))
            ops.append(
                {
                    "op": "MOVE",
                    "name": src.name,
                    "fromPath": str(src),
                    "toPath": str(dest),
                    "sizeBytes": int(size),
                    "hash": quick_hash(dest),
                }
            )
        except Exception as e:
            errors.append({"file": src.name, "error": str(e)})
    if not ops:
        return {"ok": False, "error": "정리된 파일이 없습니다.", "errors": errors, "movedCount": 0}
    pt = add_restore_point(summary or "대화형 폴더 정리", user_prompt or summary, preview, ops)
    moved_bytes = sum(o["sizeBytes"] for o in ops)
    return {
        "ok": True,
        "restoreId": pt["restoreId"],
        "movedCount": len(ops),
        "movedBytes": moved_bytes,
        "errors": errors,
        "message": f"[{pt['restoreId']} 복원 기록] {len(ops)}건을 '{CLEANUP_FOLDER_NAME}' 폴더로 옮겼습니다. 언제든 되돌릴 수 있습니다.",
    }


# ---------------------------------------------------------------------------
# 바탕화면 바로가기(.url) — 실제 바탕화면에 생성
# ---------------------------------------------------------------------------

def create_desktop_shortcut(site_name: str, target_url: str, user_prompt: str = "") -> Dict[str, Any]:
    url = (target_url or "").strip()
    if not re.match(r"^https?://[^\s\"'<>]+$", url, re.IGNORECASE):
        return {"ok": False, "error": "http(s) 주소만 바로가기로 만들 수 있습니다."}
    clean = re.sub(r'[\\/:*?"<>|\r\n]+', "_", (site_name or "바로가기").strip())[:60] or "바로가기"
    desktop = known_folder("desktop")
    if not desktop.exists():
        return {"ok": False, "error": f"바탕화면 폴더를 찾지 못했습니다: {desktop}"}
    target = unique_target(desktop / f"{clean}.url")
    target.write_text(f"[InternetShortcut]\r\nURL={url}\r\nIconIndex=0\r\n", encoding="utf-8")
    op = {
        "op": "CREATE_SHORTCUT",
        "name": target.name,
        "fromPath": "",
        "toPath": str(target),
        "sizeBytes": target.stat().st_size,
        "hash": quick_hash(target),
    }
    pt = add_restore_point(
        f"바탕화면 '{clean}' 바로가기 생성",
        user_prompt or f"{clean} 바로가기 만들어줘",
        f"바탕화면에 {target.name} 생성 ({url})",
        [op],
    )
    return {
        "ok": True,
        "restoreId": pt["restoreId"],
        "fileName": target.name,
        "shortcutPath": str(target),
        "targetUrl": url,
        "message": f"바탕화면에 [{target.name}]을 만들었습니다. [{pt['restoreId']} 복원 기록]으로 되돌릴 수 있습니다.",
    }


# ---------------------------------------------------------------------------
# 오피스 자동복구 금고 파일 → 바탕화면 '복구본' 복사 (원본은 그대로 둠)
# ---------------------------------------------------------------------------

def office_vault_dirs() -> List[Path]:
    return [
        APPDATA / "Microsoft" / "Excel",
        APPDATA / "Microsoft" / "Word",
        APPDATA / "Microsoft" / "PowerPoint",
        LOCAL_APPDATA / "Microsoft" / "Office" / "UnsavedFiles",
        APPDATA / "HNC" / "User" / "AutoSave",
        SHADOW_VAULT_DIR,
    ]


def recover_copy_to_desktop(full_path: str, user_prompt: str = "") -> Dict[str, Any]:
    src = Path(full_path or "")
    if not src.exists() or not src.is_file():
        return {"ok": False, "error": "복구할 파일이 없습니다."}
    if not any(d.exists() and is_within(src, d) for d in office_vault_dirs()):
        return {"ok": False, "error": "오피스 자동복구 금고 안의 파일만 복구 복사할 수 있습니다."}
    desktop = known_folder("desktop")
    stem = src.stem
    target = unique_target(desktop / f"{stem} (복구본){src.suffix}")
    shutil.copy2(str(src), str(target))
    op = {
        "op": "CREATE_COPY",
        "name": target.name,
        "fromPath": str(src),
        "toPath": str(target),
        "sizeBytes": target.stat().st_size,
        "hash": quick_hash(target),
    }
    pt = add_restore_point(
        f"자동복구 파일 '{src.name}' 바탕화면 복구본 생성",
        user_prompt or "저장 안 한 문서 찾아줘",
        f"{src} → {target}",
        [op],
    )
    return {
        "ok": True,
        "restoreId": pt["restoreId"],
        "recoveredPath": str(target),
        "message": f"바탕화면에 [{target.name}]으로 복구본을 만들었습니다(원본 자동복구 파일은 그대로 둠).",
    }


# ---------------------------------------------------------------------------
# 내 PC 실측 사양 (CPU·RAM·GPU·디스크·OS·주사율) — 값을 못 읽으면 None
# ---------------------------------------------------------------------------

def _reg_read(root, path: str, name: str) -> Optional[str]:
    try:
        import winreg

        with winreg.OpenKey(root, path) as k:
            val, _ = winreg.QueryValueEx(k, name)
            return str(val).strip() if val is not None else None
    except Exception:
        return None


def _gpu_names() -> List[str]:
    names: List[str] = []
    try:
        import winreg

        base = r"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}"
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, base) as k:
            for i in range(32):
                try:
                    sub = winreg.EnumKey(k, i)
                except OSError:
                    break
                if not re.match(r"^\d{4}$", sub):
                    continue
                desc = _reg_read(winreg.HKEY_LOCAL_MACHINE, f"{base}\\{sub}", "DriverDesc")
                if desc and desc not in names and "Basic Display" not in desc and "Remote" not in desc:
                    names.append(desc)
    except Exception:
        pass
    return names


class _MEMORYSTATUSEX(ctypes.Structure):
    _fields_ = [
        ("dwLength", ctypes.c_ulong),
        ("dwMemoryLoad", ctypes.c_ulong),
        ("ullTotalPhys", ctypes.c_ulonglong),
        ("ullAvailPhys", ctypes.c_ulonglong),
        ("ullTotalPageFile", ctypes.c_ulonglong),
        ("ullAvailPageFile", ctypes.c_ulonglong),
        ("ullTotalVirtual", ctypes.c_ulonglong),
        ("ullAvailVirtual", ctypes.c_ulonglong),
        ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
    ]


def _display_hz() -> Optional[int]:
    try:
        class DEVMODEW(ctypes.Structure):
            _fields_ = [
                ("dmDeviceName", ctypes.c_wchar * 32),
                ("dmSpecVersion", ctypes.c_ushort),
                ("dmDriverVersion", ctypes.c_ushort),
                ("dmSize", ctypes.c_ushort),
                ("dmDriverExtra", ctypes.c_ushort),
                ("dmFields", ctypes.c_ulong),
                ("dmPositionX", ctypes.c_long),
                ("dmPositionY", ctypes.c_long),
                ("dmDisplayOrientation", ctypes.c_ulong),
                ("dmDisplayFixedOutput", ctypes.c_ulong),
                ("dmColor", ctypes.c_short),
                ("dmDuplex", ctypes.c_short),
                ("dmYResolution", ctypes.c_short),
                ("dmTTOption", ctypes.c_short),
                ("dmCollate", ctypes.c_short),
                ("dmFormName", ctypes.c_wchar * 32),
                ("dmLogPixels", ctypes.c_ushort),
                ("dmBitsPerPel", ctypes.c_ulong),
                ("dmPelsWidth", ctypes.c_ulong),
                ("dmPelsHeight", ctypes.c_ulong),
                ("dmDisplayFlags", ctypes.c_ulong),
                ("dmDisplayFrequency", ctypes.c_ulong),
            ]

        dm = DEVMODEW()
        dm.dmSize = ctypes.sizeof(DEVMODEW)
        if ctypes.windll.user32.EnumDisplaySettingsW(None, -1, ctypes.byref(dm)):  # ENUM_CURRENT_SETTINGS
            hz = int(dm.dmDisplayFrequency)
            return hz if hz > 1 else None
    except Exception:
        pass
    return None


def measure_pc_spec() -> Dict[str, Any]:
    import platform

    spec: Dict[str, Any] = {"ok": True, "isRealMeasurement": True}
    try:
        import winreg

        spec["cpuModel"] = _reg_read(
            winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0", "ProcessorNameString"
        )
        product = _reg_read(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows NT\CurrentVersion", "ProductName")
        disp = _reg_read(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows NT\CurrentVersion", "DisplayVersion")
        build = _reg_read(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows NT\CurrentVersion", "CurrentBuild")
        if product and build and build.isdigit() and int(build) >= 22000:
            product = product.replace("Windows 10", "Windows 11")  # Win11도 ProductName이 'Windows 10'으로 기록되는 알려진 사항
        spec["osVersion"] = " ".join(x for x in [product, disp, f"(빌드 {build})" if build else ""] if x) or platform.platform()
    except Exception:
        spec["cpuModel"] = None
        spec["osVersion"] = platform.platform()
    spec["cpuLogicalCores"] = os.cpu_count()
    try:
        ms = _MEMORYSTATUSEX()
        ms.dwLength = ctypes.sizeof(_MEMORYSTATUSEX)
        ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(ms))
        spec["ramTotalGb"] = round(ms.ullTotalPhys / (1024 ** 3), 1)
        spec["ramUsedPercent"] = int(ms.dwMemoryLoad)
    except Exception:
        spec["ramTotalGb"] = None
        spec["ramUsedPercent"] = None
    try:
        sys_drive = os.environ.get("SystemDrive", "C:") + "\\"
        du = shutil.disk_usage(sys_drive)
        spec["diskFreeGb"] = round(du.free / (1024 ** 3), 1)
        spec["diskTotalGb"] = round(du.total / (1024 ** 3), 1)
        spec["systemDrive"] = sys_drive
    except Exception:
        spec["diskFreeGb"] = None
        spec["diskTotalGb"] = None
    gpus = _gpu_names()
    spec["gpuModels"] = gpus
    spec["gpuModel"] = gpus[0] if gpus else None
    spec["displayHz"] = _display_hz()
    return spec
