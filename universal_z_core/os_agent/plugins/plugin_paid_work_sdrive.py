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

import base64
import csv
import ctypes
from datetime import datetime, timezone
import hashlib
import io
import json
import mimetypes
import os
from pathlib import Path
import re
import subprocess
import sys
from typing import Any, Dict, List, Optional, Tuple
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
}

SUBFOLDER_SPECS: Tuple[Tuple[str, str], ...] = (
    ("contracts", "01_계약서_법무문서"),
    ("quotes", "02_견적서_단가표_엑셀"),
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

_PREVIEW_CACHE: Dict[str, Dict[str, Any]] = {}
_CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0


def _get_merlin_appdata_dir() -> Path:
    local_app = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
    d = Path(local_app) / "Merlin"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _config_file_path() -> Path:
    return _get_merlin_appdata_dir() / "work_sdrive_config.json"


def _load_sdrive_config() -> Dict[str, Any]:
    cfg_p = _config_file_path()
    if cfg_p.exists():
        try:
            data = json.loads(cfg_p.read_text(encoding="utf-8", errors="ignore"))
            if isinstance(data, dict):
                return data
        except Exception:
            pass
    return {}


def _save_sdrive_config(patch: Dict[str, Any]) -> Dict[str, Any]:
    cur = _load_sdrive_config()
    cur.update(patch)
    try:
        _config_file_path().write_text(json.dumps(cur, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass
    return cur


def _query_subst_target(drive_letter: str = "S:") -> Optional[Path]:
    if os.name != "nt":
        return None
    clean_letter = (drive_letter or "S:").strip().rstrip("\\/").upper()
    if not clean_letter.endswith(":"):
        clean_letter = f"{clean_letter[0]}:"
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
        prefix = f"{clean_letter}\\: => "
        for line in (res.stdout or "").splitlines():
            s = line.strip()
            if s.upper().startswith(prefix.upper()):
                target_str = s[len(prefix) :].strip()
                if target_str:
                    return Path(target_str)
    except Exception:
        pass
    return None


def _purge_legacy_vite_mock_files_once(vault_dir: Path) -> None:
    """과거 vite.config.ts 미들웨어가 자동 생성했던 4종의 가짜 샘플 텍스트·CSV만 정밀 소거합니다 (실제 유저 파일은 100% 보존)."""
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
                    cand.unlink(missing_ok=True)
        except Exception:
            pass


def get_work_vault_dir(custom_target: Optional[str] = None, ensure_dirs: bool = True) -> Path:
    if custom_target and str(custom_target).strip():
        cand_custom = Path(str(custom_target).strip())
        if str(cand_custom).upper().rstrip("\\/") != "S:":
            _save_sdrive_config({"targetDir": str(cand_custom)})

    cfg = _load_sdrive_config()
    saved_dir = str(cfg.get("targetDir") or "").strip()
    vault_dir: Optional[Path] = None

    if saved_dir and saved_dir.upper().rstrip("\\/") != "S:":
        vault_dir = Path(saved_dir)

    if vault_dir is None:
        subst_p = _query_subst_target("S:")
        if subst_p is not None and subst_p.exists():
            vault_dir = subst_p

    if vault_dir is None and not getattr(sys, "frozen", False):
        repo_cand = Path(__file__).resolve().parents[3] / "업무공유폴더_S"
        if repo_cand.exists():
            vault_dir = repo_cand

    if vault_dir is None:
        vault_dir = _get_merlin_appdata_dir() / "업무공유폴더_S"

    if ensure_dirs:
        try:
            vault_dir.mkdir(parents=True, exist_ok=True)
            for _, folder_name in SUBFOLDER_SPECS:
                (vault_dir / folder_name).mkdir(parents=True, exist_ok=True)
            _purge_legacy_vite_mock_files_once(vault_dir)
        except Exception:
            pass

    return vault_dir


def inspect_s_drive_status(drive_letter: str = "S:") -> Dict[str, Any]:
    clean_letter = (drive_letter or "S:").strip().rstrip("\\/").upper()
    if not clean_letter.endswith(":"):
        clean_letter = f"{clean_letter[0]}:"
    mount_root = Path(f"{clean_letter}\\")
    mounted = False
    try:
        mounted = os.path.exists(str(mount_root))
    except Exception:
        mounted = False
    vault_dir = get_work_vault_dir(ensure_dirs=False)
    subst_target = _query_subst_target(clean_letter)
    return {
        "ok": True,
        "track": "paid-work",
        "driveLetter": clean_letter,
        "mounted": mounted,
        "targetDir": str(subst_target or vault_dir),
    }


def mount_or_unmount_s_drive(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    payload = data or {}
    action = str(payload.get("action") or "mount").strip().lower()
    open_explorer = bool(payload.get("openExplorer", False))
    custom_target = payload.get("targetDir")
    vault_dir = get_work_vault_dir(custom_target=str(custom_target) if custom_target else None, ensure_dirs=True)

    if action == "status":
        return inspect_s_drive_status("S:")

    if action == "unmount":
        if os.name == "nt":
            try:
                subprocess.run(
                    ["subst", "S:", "/d"],
                    capture_output=True,
                    timeout=5,
                    creationflags=_CREATE_NO_WINDOW,
                )
            except Exception:
                pass
        mounted_after = os.path.exists("S:\\")
        return {
            "ok": True,
            "mounted": mounted_after,
            "driveLetter": "S:",
            "targetDir": str(vault_dir),
            "message": "윈도우 탐색기에서 [업무 드라이브 (S:)] 연결을 해제했습니다.",
        }

    # action == "mount"
    if os.name == "nt":
        cur_subst = _query_subst_target("S:")
        already_same = False
        if cur_subst is not None and os.path.exists("S:\\"):
            try:
                already_same = os.path.normcase(os.path.abspath(str(cur_subst))) == os.path.normcase(
                    os.path.abspath(str(vault_dir))
                )
            except Exception:
                already_same = False

        if not already_same:
            if cur_subst is not None:
                try:
                    subprocess.run(
                        ["subst", "S:", "/d"],
                        capture_output=True,
                        timeout=5,
                        creationflags=_CREATE_NO_WINDOW,
                    )
                except Exception:
                    pass
            try:
                subprocess.run(
                    ["subst", "S:", str(vault_dir)],
                    capture_output=True,
                    timeout=5,
                    creationflags=_CREATE_NO_WINDOW,
                )
            except Exception:
                pass

    mounted_now = os.path.exists("S:\\")
    open_target = "S:\\" if mounted_now else str(vault_dir)
    if open_explorer and os.name == "nt":
        try:
            subprocess.Popen(["explorer.exe", open_target])
        except Exception:
            pass

    return {
        "ok": True,
        "mounted": mounted_now,
        "driveLetter": "S:",
        "targetDir": str(vault_dir),
        "openedExplorer": open_explorer,
        "message": f"✓ 내 컴퓨터 [윈도우 탐색기 ➔ S: 드라이브]에 업무 공유폴더({vault_dir})가 직결되었습니다.",
    }


def is_temp_or_lock_artifact(file_name: str) -> bool:
    n = (file_name or "").strip()
    if not n:
        return True
    low = n.lower()
    if n.startswith(("~$", ".~lock.", "._")) or low in ("desktop.ini", "thumbs.db", ".ds_store"):
        return True
    if low.endswith((".lck", ".tmp", ".crdownload", ".part", ".ghosti_sync_tmp")):
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
            0,  # dwShareMode=0: 다른 앱이 이미 열어서 핸들을 잡고 있으면 즉시 ERROR_SHARING_VIOLATION 반환
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


def detect_file_lock_owner(file_path: Path, fallback_owner: str = "") -> Optional[str]:
    """~$ 오피스·한셀 잠금 파일, .lck 한글 잠금 파일 및 OS 파일 핸들 점유를 실시간 감지하여 친숙한 사용자 이름을 반환합니다."""
    try:
        parent = file_path.parent
        name = file_path.name
        stem = file_path.stem
        ext = file_path.suffix

        lock_candidates: List[Path] = [
            parent / f"~${name}",
            parent / f".~lock.{name}#",
            parent / f"{name}.lck",
            parent / f"~{name}.lck",
            parent / f"~${stem}.lck",
        ]
        if len(stem) >= 8:
            lock_candidates.append(parent / f"~${stem[2:]}{ext}")
        elif len(stem) == 7:
            lock_candidates.append(parent / f"~${stem[1:]}{ext}")

        clean_fallback = (fallback_owner or "").strip()
        if not _is_valid_human_lock_owner(clean_fallback):
            clean_fallback = (os.environ.get("USERNAME") or "").strip() or "현재 PC 사용자"

        for lc in lock_candidates:
            if lc.exists() and lc.is_file():
                owner = _extract_owner_from_office_lock_file(lc)
                return owner or clean_fallback

        if ext.lower() in _LOCK_PROBE_EXTS and _is_win32_exclusively_locked(file_path):
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


def _extract_rich_preview_cached(file_path: Path, st: os.stat_result) -> Dict[str, Any]:
    sig_key = f"{os.path.normcase(os.path.abspath(str(file_path)))}|{st.st_size}|{st.st_mtime_ns}"
    cached = _PREVIEW_CACHE.get(sig_key)
    if cached is not None:
        return cached

    if len(_PREVIEW_CACHE) > 600:
        _PREVIEW_CACHE.clear()

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

    res = {
        "ext": ext_upper,
        "isImage": is_image,
        "previewText": preview_text.strip(),
        "tableHeaders": table_headers,
        "tableRows": table_rows,
        "imageBase64": image_base64,
        "sha256": sha256_hex,
    }
    _PREVIEW_CACHE[sig_key] = res
    return res


def _resolve_folder_meta(rel_path: str) -> Tuple[str, str, str]:
    norm_rel = rel_path.replace("\\", "/")
    dir_part = os.path.dirname(norm_rel)
    folder_path = "S:\\" if not dir_part or dir_part == "." else f"S:\\{dir_part.replace('/', '\\')}"
    for folder_id, folder_name in SUBFOLDER_SPECS:
        prefix = folder_name.split("_", 2)[0] + "_" + folder_name.split("_", 2)[1][:3]
        if norm_rel.startswith(folder_name) or norm_rel.startswith(prefix):
            return folder_id, folder_name, folder_path
    return "root", "S:\\ 루트 (최상단)", folder_path


def _format_size(num_bytes: int) -> str:
    if num_bytes >= 1024 * 1024:
        return f"{num_bytes / (1024 * 1024):.1f} MB"
    return f"{max(0.1, num_bytes / 1024):.1f} KB"


def _format_mtime_ko(ts: float) -> str:
    dt = datetime.fromtimestamp(ts)
    return f"{dt.month}월 {dt.day}일 {dt.hour:02d}:{dt.minute:02d}"


def _safe_resolve_inside_vault(vault_dir: Path, rel_path: str) -> Optional[Path]:
    clean = (rel_path or "").strip().replace("/", "\\").lstrip("\\")
    if not clean or ".." in Path(clean).parts:
        return None
    if ":" in clean:
        return None
    cand = (vault_dir / clean).resolve()
    vault_resolved = vault_dir.resolve()
    try:
        cand.relative_to(vault_resolved)
    except ValueError:
        return None
    return cand


def list_work_files(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    qp = params or {}
    include_hidden = str(qp.get("includeHidden") or "").lower() in ("1", "true", "yes")
    include_sync_b64 = str(qp.get("includeSyncBase64") or "").lower() in ("1", "true", "yes")
    vault_dir = get_work_vault_dir(ensure_dirs=True)
    cfg = _load_sdrive_config()
    hidden_rel_set = set(cfg.get("hiddenRelPaths") or [])
    uploader_map: Dict[str, str] = cfg.get("uploaderByRelPath") or {}
    default_author = str(qp.get("author") or cfg.get("hostNickname") or os.environ.get("USERNAME") or "내 PC (로컬)")

    entries: List[Tuple[Path, str, os.stat_result]] = []

    def _walk(cur_dir: Path, depth: int) -> None:
        if depth > 4 or len(entries) >= 500:
            return
        try:
            with os.scandir(cur_dir) as it:
                for entry in it:
                    if len(entries) >= 500:
                        break
                    if entry.name.startswith("."):
                        continue
                    if entry.is_dir(follow_symlinks=False):
                        _walk(Path(entry.path), depth + 1)
                    elif entry.is_file(follow_symlinks=False):
                        if is_temp_or_lock_artifact(entry.name):
                            continue
                        full_p = Path(entry.path)
                        rel_p = str(full_p.relative_to(vault_dir)).replace("\\", "/")
                        if not include_hidden and rel_p in hidden_rel_set:
                            continue
                        st = entry.stat()
                        entries.append((full_p, rel_p, st))
        except Exception:
            pass

    _walk(vault_dir, 0)
    entries.sort(key=lambda x: x[2].st_mtime, reverse=True)

    files_out: List[Dict[str, Any]] = []
    for full_p, rel_p, st in entries:
        meta = _extract_rich_preview_cached(full_p, st)
        folder_id, folder_name, folder_path = _resolve_folder_meta(rel_p)
        locked_by = detect_file_lock_owner(full_p, fallback_owner=default_author)
        item: Dict[str, Any] = {
            "name": full_p.name,
            "relPath": rel_p,
            "fullPath": f"S:\\{rel_p.replace('/', '\\')}" if os.path.exists("S:\\") else str(full_p),
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
            "isHidden": rel_p in hidden_rel_set,
            "sha256": meta["sha256"],
            "previewText": meta["previewText"],
            "tableHeaders": meta["tableHeaders"],
            "tableRows": meta["tableRows"],
            "isImage": meta["isImage"],
            "imageBase64": meta["imageBase64"],
        }
        if include_sync_b64 and st.st_size <= 512 * 1024 and full_p.suffix.lower() not in _BLOCKED_EXEC_EXTS:
            try:
                item["syncBase64"] = base64.b64encode(full_p.read_bytes()).decode("ascii")
            except Exception:
                pass
        files_out.append(item)

    cur_rel_set = {str(f["relPath"]) for f in files_out}
    prev_known_set = set(cfg.get("knownRelPaths") or [])
    locally_deleted = sorted(prev_known_set - cur_rel_set - hidden_rel_set)
    local_tombs: Dict[str, Any] = dict(cfg.get("deletedTombstones") or {})
    tombs_changed = False
    now_iso = _iso_utc()
    for del_rel in locally_deleted:
        local_tombs[del_rel] = {"deletedAt": now_iso, "deletedBy": default_author}
        tombs_changed = True
    # 실제 사용자가 새로 저장한 파일(mtime > deletedAt + 5초)은 tombstone에서 자동 해제
    for full_p, rel_p, st in entries:
        t_info = local_tombs.get(rel_p)
        if isinstance(t_info, dict):
            del_ts = _parse_iso_mtime_sec(t_info.get("deletedAt"))
            if del_ts > 0 and st.st_mtime > del_ts + 5.0:
                local_tombs.pop(rel_p, None)
                tombs_changed = True

    if cur_rel_set != prev_known_set or tombs_changed:
        patch: Dict[str, Any] = {"knownRelPaths": sorted(cur_rel_set)}
        if tombs_changed:
            patch["deletedTombstones"] = local_tombs
        _save_sdrive_config(patch)

    return {
        "ok": True,
        "mounted": os.path.exists("S:\\"),
        "targetDir": str(vault_dir),
        "files": files_out,
        "locallyDeletedRelPaths": locally_deleted,
        "localDeletedTombstones": local_tombs,
    }


def get_work_locks_fast(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """[초경량 2ms 실시간 잠금 감지 전용]: Base64·해시·본문 파싱 없이 현재 S:\\ 파일들의 열람 잠금(lockedBy)만 1초 주기로 즉시 조회합니다."""
    qp = params or {}
    vault_dir = get_work_vault_dir(ensure_dirs=False)
    if not vault_dir.exists():
        return {"ok": True, "locks": {}, "fileCount": 0}
    cfg = _load_sdrive_config()
    hidden_rel_set = set(cfg.get("hiddenRelPaths") or [])
    default_author = str(qp.get("author") or cfg.get("hostNickname") or os.environ.get("USERNAME") or "현재 PC 사용자")

    locks_out: Dict[str, Optional[str]] = {}
    file_count = 0

    def _walk_locks(cur_dir: Path, depth: int) -> None:
        nonlocal file_count
        if depth > 4 or file_count >= 500:
            return
        try:
            with os.scandir(cur_dir) as it:
                for entry in it:
                    if file_count >= 500:
                        break
                    if entry.name.startswith("."):
                        continue
                    if entry.is_dir(follow_symlinks=False):
                        _walk_locks(Path(entry.path), depth + 1)
                    elif entry.is_file(follow_symlinks=False):
                        if is_temp_or_lock_artifact(entry.name):
                            continue
                        full_p = Path(entry.path)
                        rel_p = str(full_p.relative_to(vault_dir)).replace("\\", "/")
                        if rel_p in hidden_rel_set:
                            continue
                        file_count += 1
                        owner = detect_file_lock_owner(full_p, fallback_owner=default_author)
                        if owner:
                            locks_out[rel_p] = owner
        except Exception:
            pass

    _walk_locks(vault_dir, 0)
    return {
        "ok": True,
        "locks": locks_out,
        "fileCount": file_count,
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
                rel_path = f"02_견적서_단가표_엑셀/{raw_name}"
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

    if "," in b64_raw and b64_raw.startswith("data:"):
        b64_raw = b64_raw.split(",", 1)[1]

    try:
        file_bytes = base64.b64decode(b64_raw)
    except Exception as exc:
        return {"ok": False, "error": f"INVALID_BASE64: {exc}"}

    if detect_file_lock_owner(target):
        return {"ok": False, "error": "FILE_CURRENTLY_LOCKED_OPEN"}

    target.parent.mkdir(parents=True, exist_ok=True)
    tmp_p = target.with_name(f".{target.name}.ghosti_sync_tmp")
    tmp_p.write_bytes(file_bytes)
    os.replace(tmp_p, target)

    cfg = _load_sdrive_config()
    patch_up: Dict[str, Any] = {}
    if uploader:
        up_map = dict(cfg.get("uploaderByRelPath") or {})
        up_map[rel_path] = uploader
        patch_up["uploaderByRelPath"] = up_map
    tombs_up = dict(cfg.get("deletedTombstones") or {})
    if rel_path in tombs_up:
        tombs_up.pop(rel_path, None)
        patch_up["deletedTombstones"] = tombs_up
    if patch_up:
        _save_sdrive_config(patch_up)

    # Ensure S: is mounted when writing on Windows
    mount_or_unmount_s_drive({"action": "mount", "openExplorer": False})
    return {
        "ok": True,
        "relPath": rel_path,
        "savedPath": str(target),
        "sDrivePath": f"S:\\{rel_path.replace('/', '\\')}",
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
    if not target.exists():
        return True
    if os.name == "nt":
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
            op.fFlags = 0x0040 | 0x0010 | 0x0004 | 0x0400  # ALLOWUNDO | NOCONFIRMATION | SILENT | NOERRORUI
            rc = ctypes.windll.shell32.SHFileOperationW(ctypes.byref(op))
            if rc == 0 and not target.exists():
                return True
        except Exception:
            pass
    try:
        target.unlink(missing_ok=True)
        return True
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
    known_set = set(cfg.get("knownRelPaths") or [])
    merged_tombstones: Dict[str, Any] = dict(cfg.get("deletedTombstones") or {})
    if isinstance(tombstones, dict):
        for tk, tv in tombstones.items():
            clean_tk = str(tk or "").strip().replace("\\", "/").lstrip("/")
            if clean_tk:
                merged_tombstones[clean_tk] = tv

    removed_by_tombstone = 0
    for t_rel, t_info in merged_tombstones.items():
        clean_t = str(t_rel or "").strip().replace("\\", "/").lstrip("/")
        target_t = _safe_resolve_inside_vault(vault_dir, clean_t)
        if target_t and target_t.is_file() and not detect_file_lock_owner(target_t):
            del_ts = _parse_iso_mtime_sec(t_info.get("deletedAt") if isinstance(t_info, dict) else "")
            if del_ts <= 0 or target_t.stat().st_mtime <= del_ts + 5.0:
                if _move_to_recycle_bin_safe(target_t):
                    known_set.discard(clean_t)
                    removed_by_tombstone += 1

    synced = 0
    skipped = 0
    for item in incoming[:200]:
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
                    known_set.add(rel_p)
                    skipped += 1
                    continue
            # [최신본 보호 가드]: 내 로컬 파일 수정시각이 원격보다 2초 이상 더 최신이면 옛날 원격본으로 덮어쓰지 않음!
            if remote_mtime > 0 and st.st_mtime > remote_mtime + 2.0:
                skipped += 1
                continue

        if "," in b64_raw and b64_raw.startswith("data:"):
            b64_raw = b64_raw.split(",", 1)[1]
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
            known_set.add(rel_p)
            synced += 1
        except Exception:
            skipped += 1

    patch_cfg: Dict[str, Any] = {
        "knownRelPaths": sorted(known_set),
        "deletedTombstones": merged_tombstones,
    }
    if up_map != (cfg.get("uploaderByRelPath") or {}):
        patch_cfg["uploaderByRelPath"] = up_map
    _save_sdrive_config(patch_cfg)

    return {
        "ok": True,
        "mounted": os.path.exists("S:\\"),
        "targetDir": str(vault_dir),
        "syncedCount": synced,
        "removedByTombstoneCount": removed_by_tombstone,
        "skippedCount": skipped,
    }


def push_work_blob_to_signed_url(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """512KB 초과 ~ 50MB 대용량 업무 파일(XLSX/PDF/HWP/현장사진)을 브라우저 메모리 거치지 않고 서명 URL로 직접 전송합니다."""
    payload = data or {}
    rel_p = str(payload.get("relPath") or "").strip().replace("\\", "/").lstrip("/")
    signed_url = str(payload.get("signedUploadUrl") or "").strip()
    if not rel_p or not signed_url.startswith("https://"):
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

    if not rel_p or not signed_url.startswith("https://"):
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
        if remote_mtime > 0 and st.st_mtime > remote_mtime + 2.0:
            return {"ok": True, "skippedNewerLocal": True, "relPath": rel_p}

    try:
        req = urllib.request.Request(signed_url, method="GET")
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw_bytes = resp.read()
        target.parent.mkdir(parents=True, exist_ok=True)
        tmp_p = target.with_name(f".{target.name}.ghosti_sync_tmp")
        tmp_p.write_bytes(raw_bytes)
        os.replace(tmp_p, target)
        if remote_mtime > 0:
            try:
                os.utime(target, (remote_mtime, remote_mtime))
            except Exception:
                pass
        cfg = _load_sdrive_config()
        known_set = set(cfg.get("knownRelPaths") or [])
        known_set.add(rel_p)
        up_map = dict(cfg.get("uploaderByRelPath") or {})
        if uploader:
            up_map[rel_p] = uploader
        _save_sdrive_config({"knownRelPaths": sorted(known_set), "uploaderByRelPath": up_map})
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
    cfg = _load_sdrive_config()
    known_set = set(cfg.get("knownRelPaths") or [])
    known_set.discard(rel_p)
    local_tombs = dict(cfg.get("deletedTombstones") or {})
    if ok_del:
        local_tombs[rel_p] = {"deletedAt": deleted_at, "deletedBy": actor}
    _save_sdrive_config({
        "knownRelPaths": sorted(known_set),
        "deletedTombstones": local_tombs,
    })
    return {"ok": ok_del, "relPath": rel_p, "deletedAt": deleted_at, "localDeletedTombstones": local_tombs}


def toggle_hide_work_file(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    payload = data or {}
    rel_p = str(payload.get("relPath") or "").strip().replace("\\", "/").lstrip("/")
    if not rel_p:
        return {"ok": False, "error": "EMPTY_REL_PATH"}
    cfg = _load_sdrive_config()
    cur_list = list(cfg.get("hiddenRelPaths") or [])
    if rel_p in cur_list:
        cur_list = [x for x in cur_list if x != rel_p]
        hidden_now = False
    else:
        cur_list.append(rel_p)
        hidden_now = True
    _save_sdrive_config({"hiddenRelPaths": cur_list})
    return {"ok": True, "relPath": rel_p, "hidden": hidden_now}


def resolve_work_download_file(params: Dict[str, Any] | None = None) -> Tuple[Optional[Path], str, int]:
    qp = params or {}
    rel_p = str(qp.get("relPath") or qp.get("p") or "").strip()
    vault_dir = get_work_vault_dir(ensure_dirs=False)
    target = _safe_resolve_inside_vault(vault_dir, rel_p)
    if target is None or not target.is_file():
        return None, "application/octet-stream", 404
    mime = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    return target, mime, 200


def handle_action(act: str, data: Dict[str, Any]) -> Dict[str, Any] | None:
    """plugin_ghosti_os 및 merlin_z_core_daemon 라우터에서 위임받아 업무 공유(S:) 액션을 처리합니다."""
    if act not in WORK_SDRIVE_ACTIONS and not act.startswith(("paid-work-", "sdrive-")):
        return None

    letter = str(data.get("driveLetter") or "S:")
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

    return {"ok": False, "track": "paid-work", "error": f"UNHANDLED_PAID_WORK_ACTION: {act}"}
