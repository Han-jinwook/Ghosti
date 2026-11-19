#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
👻 귀신같이 (Ghosti) — 사내 실무 도그푸딩 & 순수 QA 겸용 『3대 모드 원클릭 전환기』
- 버전: v1.0.0
- 핵심 설계 원칙:
  1. 프로덕션 웹 코드(src/*, https://ghosti.sundreamer.app) 무간섭 0.00% 원칙:
     테스트용 URL 파라미터(?factoryReset 등)를 실서버 웹 코드에 일절 넣지 않고,
     외부 독립 실행창과 로컬 스냅샷 금고(%LOCALAPPDATA%\\Merlin_Mode_Vault\\)만으로
     OS(S: 드라이브 · Z코어 프로세스 · 자동실행) + 로컬 인덱싱 DB + 브라우저 오리진 세션을 정밀 제어합니다.
  2. 핀셋 오리진 격리 (타 사이트 세션 100% 보존):
     Chromium(Chrome / Edge / Whale) LevelDB WAL(Write-Ahead Log) 및 IndexedDB에서
     오직 `https://ghosti.sundreamer.app` 오리진만 백업·복원·로그아웃(merlin_logged_out='1')하며,
     센스톡(senstalk.sundreamer.app)·스튜디오·노션·구글·네이버·카톡(.sundreamer.app 공용 쿠키 포함) 로그인은 절대 건드리지 않습니다.
  3. 3대 모드 무손실 왕복 (3 ➔ 2 ➔ 3 및 3 ➔ 1 ➔ 3 완전 복귀 & 2에서 신규 초대 합류 지원):
     - [1. 완전 백지 모드]: 엔진 종료·삭제 + 전체 로컬/웹 인덱싱 DB 삭제 + S: 해제 + 귀신같이 웹 로그아웃 (첫 방문자 상태)
     - [2. 순수 개인 모드]: 엔진·개인 인덱싱 DB 100% 보존 + S: 드라이브만 해제 + 귀신같이 웹 로그아웃 (순수 단독 사용자 상태)
     - [3. 사무실 업무공유 모드]: Z코어 가동 + S: 드라이브 마운트·파일 복원 + 귀신같이 웹 로그인 세션·업무방 URL 100% 완전 복귀
"""

from __future__ import annotations

import ctypes
from ctypes import wintypes
from datetime import datetime
import glob
import io
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import struct
import subprocess
import sys
import tempfile
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Tuple
import urllib.request
import webbrowser
import zipfile

SWITCHER_VERSION = "1.0.0"
WINDOW_TITLE = f"👻 귀신같이 3대 모드 전환기 v{SWITCHER_VERSION}"

GHOSTI_ORIGIN = "https://ghosti.sundreamer.app"
GHOSTI_HOST = "ghosti.sundreamer.app"
GHOSTI_LDB_PREFIX = b"_https://ghosti.sundreamer.app\x00"

URL_MODE1_CLEAN_SHOWROOM = "https://ghosti.sundreamer.app/"
URL_MODE2_PERSONAL = "https://ghosti.sundreamer.app/?dev=true&lounge=personal&tab=secretary"
URL_MODE3_WORK_DEFAULT = "https://ghosti.sundreamer.app/?dev=true&lounge=work&tab=work"

CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0
DETACHED_PROCESS = 0x00000008 if os.name == "nt" else 0
CREATE_NEW_PROCESS_GROUP = 0x00000200 if os.name == "nt" else 0

# LocalStorage keys treated as login/work-room session keys when switching to Mode 2 (Pure Personal)
AUTH_AND_WORK_KEY_EXACT = {
    "merlin_session_token",
    "merlin_cached_user",
    "merlin_cached_balance",
    "merlin_user_id",
    "merlin_family_uid",
    "userEmail",
    "user_email",
    "userNickname",
    "userProfileImage",
    "ghosti_hub_user_email",
    "ghosti_hub_user_nickname",
    "ghosti_supabase_access_token",
    "ghosti_supabase_access_token_exp",
    "ghosti_my_work_room_meta_v1",
    "ghosti_active_work_room_invite_v1",
    "ghosti_joined_invite_room_v1",
    "ghosti_invited_member_email",
    "ghosti_invited_member_nickname",
}


# =====================================================================
# 1. 경로 헬퍼 (안전 금고: %LOCALAPPDATA%\Merlin_Mode_Vault — Mode 1 삭제 대상 외부)
# =====================================================================
def get_local_appdata() -> Path:
    raw = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
    return Path(raw)


def get_vault_root() -> Path:
    p = get_local_appdata() / "Merlin_Mode_Vault"
    p.mkdir(parents=True, exist_ok=True)
    return p


def get_snapshots_dir() -> Path:
    p = get_vault_root() / "snapshots"
    p.mkdir(parents=True, exist_ok=True)
    return p


def get_cached_installer_path() -> Path:
    d = get_snapshots_dir() / "cached_installer"
    d.mkdir(parents=True, exist_ok=True)
    return d / "Merlin_Z_Core_Setup.exe"


def get_personal_db_backup_dir() -> Path:
    d = get_snapshots_dir() / "personal_merlin_db_backup"
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_mode3_vault_dir() -> Path:
    d = get_snapshots_dir() / "mode3_work_vault"
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_merlin_data_dir() -> Path:
    return get_local_appdata() / "Merlin"


def get_merlin_program_dir() -> Path:
    return get_local_appdata() / "Programs" / "MerlinFamily"


def get_installed_zcore_exe() -> Path:
    return get_merlin_program_dir() / "Merlin_Z_Core_Setup.exe"


# =====================================================================
# 2. 순수 파이썬 Chromium LevelDB 판독기 & 무결성 WAL(WriteBatch) 기록기
# =====================================================================
_CRC32C_TABLE: List[int] = []
for _idx in range(256):
    _c = _idx
    for _ in range(8):
        _c = (_c >> 1) ^ 0x82F63B78 if (_c & 1) else (_c >> 1)
    _CRC32C_TABLE.append(_c)


def crc32c(data: bytes, init: int = 0) -> int:
    crc = init ^ 0xFFFFFFFF
    for b in data:
        crc = _CRC32C_TABLE[(crc ^ b) & 0xFF] ^ (crc >> 8)
    return crc ^ 0xFFFFFFFF


def mask_crc(crc: int) -> int:
    return (((crc >> 15) | ((crc << 17) & 0xFFFFFFFF)) + 0xA282EAD8) & 0xFFFFFFFF


def read_varint(buf: bytes, pos: int) -> Tuple[int, int]:
    val = 0
    shift = 0
    n = len(buf)
    while pos < n:
        b = buf[pos]
        pos += 1
        val |= (b & 0x7F) << shift
        if not (b & 0x80):
            return val, pos
        shift += 7
    raise ValueError("Truncated varint")


def encode_varint(val: int) -> bytes:
    out = bytearray()
    while True:
        b = val & 0x7F
        val >>= 7
        if val:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)


def snappy_decompress(data: bytes) -> bytes:
    pos = 0
    n = len(data)
    _, pos = read_varint(data, pos)  # uncompressed length
    out = bytearray()
    while pos < n:
        tag = data[pos]
        pos += 1
        elem_type = tag & 0x03
        if elem_type == 0:
            len_code = tag >> 2
            if len_code < 60:
                lit_len = len_code + 1
            else:
                extra = len_code - 59
                lit_len = int.from_bytes(data[pos : pos + extra], "little") + 1
                pos += extra
            out.extend(data[pos : pos + lit_len])
            pos += lit_len
        else:
            if elem_type == 1:
                length = ((tag >> 2) & 0x07) + 4
                offset = ((tag & 0xE0) << 3) | data[pos]
                pos += 1
            elif elem_type == 2:
                length = (tag >> 2) + 1
                offset = int.from_bytes(data[pos : pos + 2], "little")
                pos += 2
            else:
                length = (tag >> 2) + 1
                offset = int.from_bytes(data[pos : pos + 4], "little")
                pos += 4
            if offset <= 0 or offset > len(out):
                raise ValueError(f"Invalid Snappy offset {offset}")
            for _ in range(length):
                out.append(out[-offset])
    return bytes(out)


def _parse_ldb_block(raw_file: bytes, offset: int, size: int) -> bytes:
    block_data = raw_file[offset : offset + size]
    comp_type = raw_file[offset + size]
    if comp_type == 0:
        return block_data
    if comp_type == 1:
        return snappy_decompress(block_data)
    raise ValueError(f"Unsupported LevelDB block compression {comp_type}")


def _iter_ldb_block_entries(block: bytes):
    if len(block) < 4:
        return
    num_restarts = struct.unpack_from("<I", block, len(block) - 4)[0]
    limit = len(block) - 4 * (1 + num_restarts)
    if limit < 0:
        return
    pos = 0
    last_key = b""
    while pos < limit:
        shared, pos = read_varint(block, pos)
        non_shared, pos = read_varint(block, pos)
        val_len, pos = read_varint(block, pos)
        key = last_key[:shared] + block[pos : pos + non_shared]
        pos += non_shared
        val = block[pos : pos + val_len]
        pos += val_len
        last_key = key
        yield key, val


def _read_sstable_records(filepath: Path) -> List[Tuple[int, int, bytes, bytes]]:
    raw = filepath.read_bytes()
    if len(raw) < 48 or raw[-8:] != bytes.fromhex("57fb808b247547db"):
        return []
    footer = raw[-48:]
    pos = 0
    _, pos = read_varint(footer, pos)
    _, pos = read_varint(footer, pos)
    idx_off, pos = read_varint(footer, pos)
    idx_sz, pos = read_varint(footer, pos)
    idx_block = _parse_ldb_block(raw, idx_off, idx_sz)
    records: List[Tuple[int, int, bytes, bytes]] = []
    for _, handle_bytes in _iter_ldb_block_entries(idx_block):
        hpos = 0
        b_off, hpos = read_varint(handle_bytes, hpos)
        b_sz, hpos = read_varint(handle_bytes, hpos)
        data_block = _parse_ldb_block(raw, b_off, b_sz)
        for ikey, val in _iter_ldb_block_entries(data_block):
            if len(ikey) < 8:
                continue
            ukey = ikey[:-8]
            tag = struct.unpack_from("<Q", ikey, len(ikey) - 8)[0]
            records.append((tag >> 8, tag & 0xFF, ukey, val))
    return records


def _iter_wal_batches(filepath: Path):
    raw = filepath.read_bytes()
    block_size = 32768
    pos = 0
    frag = bytearray()
    while pos < len(raw):
        rem = block_size - (pos % block_size)
        if rem < 7:
            pos += rem
            continue
        crc_m, length, rtype = struct.unpack_from("<IHB", raw, pos)
        if length == 0 and rtype == 0 and crc_m == 0:
            pos += rem
            continue
        if pos + 7 + length > len(raw):
            break
        pos += 7
        chunk = raw[pos : pos + length]
        pos += length
        if rtype == 1:
            yield bytes(chunk)
        elif rtype == 2:
            frag = bytearray(chunk)
        elif rtype == 3:
            frag.extend(chunk)
        elif rtype == 4:
            frag.extend(chunk)
            yield bytes(frag)
            frag = bytearray()


def _read_wal_records(filepath: Path) -> List[Tuple[int, int, bytes, bytes]]:
    records: List[Tuple[int, int, bytes, bytes]] = []
    for batch in _iter_wal_batches(filepath):
        if len(batch) < 12:
            continue
        seq, count = struct.unpack_from("<QI", batch, 0)
        pos = 12
        for i in range(count):
            if pos >= len(batch):
                break
            vtype = batch[pos]
            pos += 1
            klen, pos = read_varint(batch, pos)
            ukey = batch[pos : pos + klen]
            pos += klen
            if vtype == 1:
                vlen, pos = read_varint(batch, pos)
                val = batch[pos : pos + vlen]
                pos += vlen
            else:
                val = b""
            records.append((seq + i, vtype, ukey, val))
    return records


def _parse_manifest_state(manifest_path: Path) -> Tuple[int, int]:
    active_log = 0
    last_seq = 0
    for edit in _iter_wal_batches(manifest_path):
        pos = 0
        while pos < len(edit):
            try:
                tag, pos = read_varint(edit, pos)
                if tag == 1:
                    slen, pos = read_varint(edit, pos)
                    pos += slen
                elif tag == 2:
                    active_log, pos = read_varint(edit, pos)
                elif tag == 3:
                    _, pos = read_varint(edit, pos)
                elif tag == 4:
                    s, pos = read_varint(edit, pos)
                    if s > last_seq:
                        last_seq = s
                elif tag == 5:
                    _, pos = read_varint(edit, pos)
                    klen, pos = read_varint(edit, pos)
                    pos += klen
                elif tag == 6:
                    _, pos = read_varint(edit, pos)
                    _, pos = read_varint(edit, pos)
                elif tag == 7:
                    _, pos = read_varint(edit, pos)
                    _, pos = read_varint(edit, pos)
                    _, pos = read_varint(edit, pos)
                    k1, pos = read_varint(edit, pos)
                    pos += k1
                    k2, pos = read_varint(edit, pos)
                    pos += k2
                elif tag == 9:
                    _, pos = read_varint(edit, pos)
                else:
                    break
            except Exception:
                break
    return active_log, last_seq


def read_leveldb_state(leveldb_dir: Path) -> Optional[Tuple[Dict[bytes, bytes], int, int]]:
    cur_file = leveldb_dir / "CURRENT"
    if not cur_file.is_file():
        return None
    try:
        manifest_name = cur_file.read_bytes().decode("ascii", errors="ignore").strip()
        manifest_path = leveldb_dir / manifest_name
        if not manifest_path.is_file():
            return None
        active_log, last_seq = _parse_manifest_state(manifest_path)
        all_recs: List[Tuple[int, int, bytes, bytes]] = []
        log_files: List[int] = []
        for fn in sorted(os.listdir(leveldb_dir)):
            fp = leveldb_dir / fn
            if not fp.is_file():
                continue
            if fn.endswith((".ldb", ".sst")):
                try:
                    all_recs.extend(_read_sstable_records(fp))
                except Exception:
                    pass
            elif fn.endswith(".log") and fn[:-4].isdigit():
                num = int(fn[:-4])
                log_files.append(num)
                if num >= active_log:
                    try:
                        all_recs.extend(_read_wal_records(fp))
                    except Exception:
                        pass
        if active_log == 0 and log_files:
            active_log = max(log_files)
        all_recs.sort(key=lambda x: x[0])
        kv: Dict[bytes, bytes] = {}
        max_seq = last_seq
        for seq, vtype, ukey, val in all_recs:
            if seq > max_seq:
                max_seq = seq
            if vtype == 1:
                kv[ukey] = val
            elif vtype == 0:
                kv.pop(ukey, None)
        return kv, active_log, max_seq
    except Exception:
        return None


def append_wal_write_batch(wal_path: Path, start_seq: int, ops: List[Tuple[int, bytes, bytes]]) -> None:
    if not ops:
        return
    payload = bytearray(struct.pack("<QI", start_seq, len(ops)))
    for vtype, ukey, val in ops:
        payload.append(vtype)
        payload.extend(encode_varint(len(ukey)))
        payload.extend(ukey)
        if vtype == 1:
            payload.extend(encode_varint(len(val)))
            payload.extend(val)

    block_size = 32768
    cur_size = wal_path.stat().st_size if wal_path.exists() else 0
    out = bytearray()
    rem_in_block = block_size - (cur_size % block_size)
    if rem_in_block < 7:
        out.extend(b"\x00" * rem_in_block)
        rem_in_block = block_size

    data = memoryview(payload)
    pos = 0
    first = True
    while pos < len(data):
        avail = rem_in_block - 7
        chunk = bytes(data[pos : pos + avail])
        pos += len(chunk)
        last = pos >= len(data)
        if first and last:
            rtype = 1
        elif first:
            rtype = 2
        elif last:
            rtype = 4
        else:
            rtype = 3
        first = False
        crc = crc32c(bytes([rtype]) + chunk)
        out.extend(struct.pack("<IHB", mask_crc(crc), len(chunk), rtype))
        out.extend(chunk)
        rem_in_block -= 7 + len(chunk)
        if rem_in_block < 7 and pos < len(data):
            out.extend(b"\x00" * rem_in_block)
            rem_in_block = block_size

    with open(wal_path, "ab") as f:
        f.write(out)


def decode_blink_ls_bytes(raw: bytes) -> str:
    if not raw:
        return ""
    fmt = raw[0]
    body = raw[1:]
    if fmt == 1:
        return body.decode("latin-1", errors="ignore")
    if fmt == 0:
        return body.decode("utf-16-le", errors="ignore")
    return raw.decode("utf-8", errors="ignore")


def encode_blink_ls_str(val: str) -> bytes:
    try:
        return b"\x01" + val.encode("latin-1")
    except UnicodeEncodeError:
        return b"\x00" + val.encode("utf-16-le")


def make_ghosti_ls_key(js_key: str) -> bytes:
    return GHOSTI_LDB_PREFIX + encode_blink_ls_str(js_key)


def parse_ghosti_js_key(full_ukey: bytes) -> Optional[str]:
    if not full_ukey.startswith(GHOSTI_LDB_PREFIX):
        return None
    return decode_blink_ls_bytes(full_ukey[len(GHOSTI_LDB_PREFIX) :])


# =====================================================================
# 3. 브라우저 프로필 탐색 · 안전 종료 · 핀셋 세션 스냅샷/복원/초기화
# =====================================================================
def iter_chromium_profiles(custom_roots: Optional[List[Tuple[str, Path]]] = None) -> List[Tuple[str, str, Path]]:
    """Returns list of (browser_id, profile_name, profile_dir)."""
    if custom_roots is not None:
        roots = custom_roots
    else:
        la = get_local_appdata()
        roots = [
            ("chrome", la / "Google" / "Chrome" / "User Data"),
            ("edge", la / "Microsoft" / "Edge" / "User Data"),
            ("whale", la / "Naver" / "Naver Whale" / "User Data"),
        ]
    out: List[Tuple[str, str, Path]] = []
    for bid, udata in roots:
        if not udata.is_dir():
            continue
        candidates = ["Default"] + sorted(
            d.name for d in udata.iterdir() if d.is_dir() and d.name.startswith("Profile ")
        )
        for pname in candidates:
            pdir = udata / pname
            if pdir.is_dir() and ((pdir / "Local Storage" / "leveldb").is_dir() or (pdir / "IndexedDB").is_dir()):
                out.append((bid, pname, pdir))
    return out


def close_running_chromium_browsers_gracefully() -> List[str]:
    """실행 중인 Chrome/Edge/Whale 창에 WM_CLOSE를 보내 LevelDB를 안전하게 플러시한 뒤 종료합니다."""
    if os.name != "nt":
        return []
    targets = ("chrome.exe", "msedge.exe", "whale.exe")
    closed_any: List[str] = []
    for exe in targets:
        try:
            chk = subprocess.run(
                ["tasklist", "/FI", f"IMAGENAME eq {exe}", "/NH"],
                capture_output=True,
                text=True,
                encoding="cp949",
                errors="ignore",
                timeout=4,
                creationflags=CREATE_NO_WINDOW,
            )
            if exe.lower() not in (chk.stdout or "").lower():
                continue
            closed_any.append(exe)
            # 1단계: 강제(/F) 없이 정상 종료 요청 -> 열린 탭 세션 보존 & LevelDB 정상 기록
            subprocess.run(
                ["taskkill", "/IM", exe],
                capture_output=True,
                timeout=4,
                creationflags=CREATE_NO_WINDOW,
            )
        except Exception:
            pass

    if not closed_any:
        return []

    deadline = time.time() + 2.8
    while time.time() < deadline:
        still_alive = False
        for exe in closed_any:
            r = subprocess.run(
                ["tasklist", "/FI", f"IMAGENAME eq {exe}", "/NH"],
                capture_output=True,
                text=True,
                encoding="cp949",
                errors="ignore",
                timeout=3,
                creationflags=CREATE_NO_WINDOW,
            )
            if exe.lower() in (r.stdout or "").lower():
                still_alive = True
                break
        if not still_alive:
            break
        time.sleep(0.25)

    # 백그라운드 잔여 헬퍼 프로세스가 LOCK을 쥐고 있으면 정리
    for exe in closed_any:
        subprocess.run(
            ["taskkill", "/F", "/IM", exe],
            capture_output=True,
            timeout=4,
            creationflags=CREATE_NO_WINDOW,
        )
    time.sleep(0.35)
    return closed_any


def inspect_browser_ghosti_session(
    custom_roots: Optional[List[Tuple[str, Path]]] = None,
) -> Dict[str, Any]:
    """현재 브라우저(비실행 또는 스냅샷 사본)에 저장된 귀신같이 웹 로그인/업무방 상태를 진단합니다."""
    logged_in = False
    logged_out_flag = False
    user_email = ""
    user_nick = ""
    work_room_title = ""
    has_idb = False
    recent_work_url = ""

    for _, _, pdir in iter_chromium_profiles(custom_roots):
        idb_dir = pdir / "IndexedDB" / "https_ghosti.sundreamer.app_0.indexeddb.leveldb"
        if idb_dir.is_dir() and any(idb_dir.iterdir()):
            has_idb = True

        # History에서 최근 ?workRoom=... 초대 URL 탐색 (읽기 전용 임시 복사본 사용으로 잠금 무관)
        hist_db = pdir / "History"
        if hist_db.is_file() and not recent_work_url:
            tmp_h = None
            try:
                fd, tmp_h = tempfile.mkstemp(prefix="ghosti_hist_", suffix=".sqlite")
                os.close(fd)
                shutil.copy2(hist_db, tmp_h)
                con = sqlite3.connect(tmp_h)
                cur = con.cursor()
                cur.execute(
                    "SELECT url FROM urls WHERE url LIKE '%ghosti.sundreamer.app%workRoom=%' "
                    "ORDER BY last_visit_time DESC LIMIT 1"
                )
                row = cur.fetchone()
                if row and row[0]:
                    recent_work_url = str(row[0])
                con.close()
            except Exception:
                pass
            finally:
                if tmp_h and os.path.exists(tmp_h):
                    try:
                        os.remove(tmp_h)
                    except Exception:
                        pass

        ls_dir = pdir / "Local Storage" / "leveldb"
        if not ls_dir.is_dir():
            continue
        tmp_ls = tempfile.mkdtemp(prefix="ghosti_ls_ro_")
        try:
            dst_ls = Path(tmp_ls) / "leveldb"
            shutil.copytree(ls_dir, dst_ls, ignore=shutil.ignore_patterns("LOCK"))
            st = read_leveldb_state(dst_ls)
            if not st:
                continue
            kv, _, _ = st
            js_map: Dict[str, str] = {}
            for ukey, val in kv.items():
                jk = parse_ghosti_js_key(ukey)
                if jk is not None:
                    js_map[jk] = decode_blink_ls_bytes(val)
            if js_map.get("merlin_logged_out") == "1":
                logged_out_flag = True
            tok = js_map.get("merlin_session_token") or js_map.get("ghosti_supabase_access_token") or ""
            if tok and js_map.get("merlin_logged_out") != "1":
                logged_in = True
                user_email = (
                    js_map.get("userEmail")
                    or js_map.get("ghosti_hub_user_email")
                    or user_email
                )
                user_nick = (
                    js_map.get("userNickname")
                    or js_map.get("ghosti_hub_user_nickname")
                    or user_nick
                )
            wm = js_map.get("ghosti_my_work_room_meta_v1")
            if wm:
                try:
                    wobj = json.loads(wm)
                    work_room_title = str(wobj.get("roomTitle") or work_room_title)
                except Exception:
                    pass
        except Exception:
            pass
        finally:
            shutil.rmtree(tmp_ls, ignore_errors=True)

    return {
        "loggedIn": logged_in,
        "loggedOutFlag": logged_out_flag,
        "userEmail": user_email,
        "userNickname": user_nick,
        "workRoomTitle": work_room_title,
        "hasIndexedDb": has_idb,
        "recentWorkInviteUrl": recent_work_url,
    }


def backup_mode3_browser_session_if_active(
    custom_roots: Optional[List[Tuple[str, Path]]] = None,
) -> bool:
    """현재 브라우저에 유효한 귀신같이 로그인/업무방 상태가 있을 때만 mode3_work_vault에 무손실 저장합니다."""
    profiles_dump: Dict[str, List[Dict[str, str]]] = {}
    found_active_auth = False
    detected_work_url = ""

    for bid, pname, pdir in iter_chromium_profiles(custom_roots):
        ls_dir = pdir / "Local Storage" / "leveldb"
        if ls_dir.is_dir():
            st = read_leveldb_state(ls_dir)
            if st:
                kv, _, _ = st
                entries: List[Dict[str, str]] = []
                js_map: Dict[str, str] = {}
                for ukey, val in kv.items():
                    jk = parse_ghosti_js_key(ukey)
                    if jk is not None:
                        entries.append({"k": ukey.hex(), "v": val.hex()})
                        js_map[jk] = decode_blink_ls_bytes(val)
                if entries:
                    profiles_dump[f"{bid}::{pname}"] = entries
                has_tok = bool(
                    js_map.get("merlin_session_token")
                    or js_map.get("ghosti_supabase_access_token")
                    or js_map.get("ghosti_my_work_room_meta_v1")
                    or any(k.startswith("sb-") and k.endswith("-auth-token") for k in js_map)
                )
                if has_tok and js_map.get("merlin_logged_out") != "1":
                    found_active_auth = True

        hist_db = pdir / "History"
        if hist_db.is_file() and not detected_work_url:
            try:
                con = sqlite3.connect(str(hist_db))
                cur = con.cursor()
                cur.execute(
                    "SELECT url FROM urls WHERE url LIKE '%ghosti.sundreamer.app%workRoom=%' "
                    "ORDER BY last_visit_time DESC LIMIT 1"
                )
                row = cur.fetchone()
                if row and row[0]:
                    detected_work_url = str(row[0])
                con.close()
            except Exception:
                pass

    vault = get_mode3_vault_dir()
    if detected_work_url:
        (vault / "work_room_url.json").write_text(
            json.dumps({"url": detected_work_url, "savedAt": datetime.now().isoformat()}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    if found_active_auth and profiles_dump:
        (vault / "browser_localstorage_mode3.json").write_text(
            json.dumps(
                {"savedAt": datetime.now().isoformat(), "profiles": profiles_dump},
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        return True
    return False


def backup_personal_indexeddb(custom_roots: Optional[List[Tuple[str, Path]]] = None) -> None:
    """Mode 1 백지화 직전 귀신같이 IndexedDB(768D 벡터·광학 캐시)를 백업합니다 (비어있지 않을 때만 갱신)."""
    idb_root = get_personal_db_backup_dir() / "browser_indexeddb"
    for bid, pname, pdir in iter_chromium_profiles(custom_roots):
        idb_parent = pdir / "IndexedDB"
        if not idb_parent.is_dir():
            continue
        for sub_name in (
            "https_ghosti.sundreamer.app_0.indexeddb.leveldb",
            "https_ghosti.sundreamer.app_0.indexeddb.blob",
        ):
            src = idb_parent / sub_name
            if src.is_dir() and any(src.iterdir()):
                dst = idb_root / f"{bid}__{pname}" / sub_name
                if dst.exists():
                    shutil.rmtree(dst, ignore_errors=True)
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copytree(src, dst, ignore=shutil.ignore_patterns("LOCK"))


def restore_personal_indexeddb_if_missing(custom_roots: Optional[List[Tuple[str, Path]]] = None) -> None:
    idb_root = get_personal_db_backup_dir() / "browser_indexeddb"
    if not idb_root.is_dir():
        return
    for bid, pname, pdir in iter_chromium_profiles(custom_roots):
        src_base = idb_root / f"{bid}__{pname}"
        if not src_base.is_dir():
            continue
        idb_parent = pdir / "IndexedDB"
        idb_parent.mkdir(parents=True, exist_ok=True)
        for sub_name in (
            "https_ghosti.sundreamer.app_0.indexeddb.leveldb",
            "https_ghosti.sundreamer.app_0.indexeddb.blob",
        ):
            src = src_base / sub_name
            dst = idb_parent / sub_name
            if src.is_dir() and not dst.exists():
                shutil.copytree(src, dst, ignore=shutil.ignore_patterns("LOCK"))


def _clear_host_exact_ghosti_cookies(profile_dir: Path) -> None:
    """오직 host_key = 'ghosti.sundreamer.app' 쿠키만 삭제합니다 (.sundreamer.app 센스톡 공용 쿠키는 절대 삭제 금지)."""
    for rel in (Path("Network") / "Cookies", Path("Cookies")):
        cdb = profile_dir / rel
        if not cdb.is_file():
            continue
        try:
            con = sqlite3.connect(str(cdb), timeout=3.0)
            con.execute("DELETE FROM cookies WHERE host_key = ?", (GHOSTI_HOST,))
            con.commit()
            con.close()
        except Exception:
            pass


def apply_browser_mode1_clean_slate(custom_roots: Optional[List[Tuple[str, Path]]] = None) -> None:
    """Mode 1: 귀신같이 웹의 모든 LocalStorage·IndexedDB를 비우고 merlin_logged_out='1'만 기록합니다."""
    for _, _, pdir in iter_chromium_profiles(custom_roots):
        # 1) Ghosti 전용 IndexedDB 폴더 삭제
        idb_parent = pdir / "IndexedDB"
        if idb_parent.is_dir():
            for item in idb_parent.glob("*ghosti.sundreamer.app*"):
                shutil.rmtree(item, ignore_errors=True)

        # 2) LocalStorage에서 _https://ghosti.sundreamer.app 키만 전수 삭제 + merlin_logged_out='1' 기록
        ls_dir = pdir / "Local Storage" / "leveldb"
        if ls_dir.is_dir():
            st = read_leveldb_state(ls_dir)
            if st:
                kv, active_log, max_seq = st
                ops: List[Tuple[int, bytes, bytes]] = []
                for ukey in kv:
                    if ukey.startswith(GHOSTI_LDB_PREFIX):
                        ops.append((0, ukey, b""))
                ops.append((1, make_ghosti_ls_key("merlin_logged_out"), encode_blink_ls_str("1")))
                wal_p = ls_dir / f"{active_log:06d}.log"
                append_wal_write_batch(wal_p, max_seq + 1, ops)

        # 3) host-only 쿠키 정리 (.sundreamer.app 보존)
        _clear_host_exact_ghosti_cookies(pdir)


def apply_browser_mode2_pure_personal(custom_roots: Optional[List[Tuple[str, Path]]] = None) -> None:
    """Mode 2: 개인 IndexedDB·상용구는 보존하고 귀신같이 로그인 세션·업무방 키만 분리(merlin_logged_out='1')합니다."""
    restore_personal_indexeddb_if_missing(custom_roots)
    for _, _, pdir in iter_chromium_profiles(custom_roots):
        ls_dir = pdir / "Local Storage" / "leveldb"
        if not ls_dir.is_dir():
            continue
        st = read_leveldb_state(ls_dir)
        if not st:
            continue
        kv, active_log, max_seq = st
        ops: List[Tuple[int, bytes, bytes]] = []
        for ukey in kv:
            jk = parse_ghosti_js_key(ukey)
            if jk is None:
                continue
            jkl = jk.lower()
            is_auth_or_work = (
                jk in AUTH_AND_WORK_KEY_EXACT
                or (jkl.startswith("sb-") and jkl.endswith("-auth-token"))
                or "work_room" in jkl
                or "workroom" in jkl
                or jkl.startswith("ghosti_mobile_paired_")
            )
            if is_auth_or_work:
                ops.append((0, ukey, b""))
        ops.append((1, make_ghosti_ls_key("merlin_logged_out"), encode_blink_ls_str("1")))
        ops.append((1, make_ghosti_ls_key("ghosti_onboarding_completed"), encode_blink_ls_str("true")))
        ops.append((1, make_ghosti_ls_key("ghosti_secretary_engine_agreed"), encode_blink_ls_str("1")))
        wal_p = ls_dir / f"{active_log:06d}.log"
        append_wal_write_batch(wal_p, max_seq + 1, ops)
        _clear_host_exact_ghosti_cookies(pdir)


def apply_browser_mode3_work_restore(custom_roots: Optional[List[Tuple[str, Path]]] = None) -> str:
    """Mode 3: 금고에 백업된 귀신같이 로그인 세션·업무방 상태를 100% 바이트 단위로 원복하고 목표 URL을 반환합니다."""
    restore_personal_indexeddb_if_missing(custom_roots)
    vault = get_mode3_vault_dir()
    snap_file = vault / "browser_localstorage_mode3.json"
    saved_profiles: Dict[str, List[Dict[str, str]]] = {}
    if snap_file.is_file():
        try:
            saved_profiles = json.loads(snap_file.read_text(encoding="utf-8")).get("profiles") or {}
        except Exception:
            saved_profiles = {}

    fallback_entries: Optional[List[Dict[str, str]]] = None
    for entries in saved_profiles.values():
        if entries:
            fallback_entries = entries
            break

    restored_host_room = False
    for bid, pname, pdir in iter_chromium_profiles(custom_roots):
        ls_dir = pdir / "Local Storage" / "leveldb"
        if not ls_dir.is_dir():
            continue
        st = read_leveldb_state(ls_dir)
        if not st:
            continue
        kv, active_log, max_seq = st
        ops: List[Tuple[int, bytes, bytes]] = []
        target_entries = saved_profiles.get(f"{bid}::{pname}") or fallback_entries

        if target_entries:
            for ukey in kv:
                if ukey.startswith(GHOSTI_LDB_PREFIX):
                    ops.append((0, ukey, b""))
            for item in target_entries:
                uk = bytes.fromhex(item["k"])
                uv = bytes.fromhex(item["v"])
                jk = parse_ghosti_js_key(uk)
                if jk == "merlin_logged_out":
                    continue
                if jk == "ghosti_my_work_room_meta_v1" and decode_blink_ls_bytes(uv).strip():
                    restored_host_room = True
                ops.append((1, uk, uv))
        else:
            # 최초 진입 시: merlin_logged_out만 해제하여 SSO 쿠키 또는 즉시 로그인 활성화
            lo_key = make_ghosti_ls_key("merlin_logged_out")
            if lo_key in kv:
                ops.append((0, lo_key, b""))
            ops.append((1, make_ghosti_ls_key("ghosti_onboarding_completed"), encode_blink_ls_str("true")))

        if ops:
            wal_p = ls_dir / f"{active_log:06d}.log"
            append_wal_write_batch(wal_p, max_seq + 1, ops)

    url_file = vault / "work_room_url.json"
    if not restored_host_room and url_file.is_file():
        try:
            u = str(json.loads(url_file.read_text(encoding="utf-8")).get("url") or "").strip()
            if u.startswith("https://ghosti.sundreamer.app") and "workRoom=" in u:
                return u
        except Exception:
            pass
    return URL_MODE3_WORK_DEFAULT


# =====================================================================
# 4. OS · Z코어(:5199/:51988) · 개인 인덱싱 DB · S: 드라이브 제어
# =====================================================================
def probe_zcore_health() -> Tuple[bool, str, bool]:
    """Returns (zcore_5199_alive, version_str, paste_51988_alive)."""
    alive_5199 = False
    ver = ""
    try:
        req = urllib.request.Request(
            "http://127.0.0.1:5199/__merlin/health",
            headers={"Origin": GHOSTI_ORIGIN},
        )
        with urllib.request.urlopen(req, timeout=1.2) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="ignore"))
            if data.get("ok") or data.get("status") == "ok" or data.get("version"):
                alive_5199 = True
                ver = str(data.get("version") or data.get("coreVersion") or "")
    except Exception:
        pass

    alive_51988 = False
    try:
        req2 = urllib.request.Request("http://127.0.0.1:51988/__merlin/ping")
        with urllib.request.urlopen(req2, timeout=0.8) as resp2:
            if resp2.status == 200:
                alive_51988 = True
    except Exception:
        pass
    return alive_5199, ver, alive_51988


def query_s_drive_subst() -> Tuple[bool, str]:
    mounted = os.path.exists("S:\\")
    target = ""
    if os.name == "nt":
        try:
            r = subprocess.run(
                ["subst"],
                capture_output=True,
                text=True,
                encoding="cp949",
                errors="ignore",
                timeout=3,
                creationflags=CREATE_NO_WINDOW,
            )
            for ln in (r.stdout or "").splitlines():
                s = ln.strip()
                if s.upper().startswith("S:\\: => "):
                    target = s[8:].strip()
                    mounted = True
                    break
        except Exception:
            pass
    return mounted, target


def count_personal_merlin_cache_items() -> int:
    mdir = get_merlin_data_dir()
    if not mdir.is_dir():
        return 0
    cnt = 0
    for item in mdir.iterdir():
        if item.name in ("work_sdrive_config.json", "업무공유폴더_S", "zcore_rt"):
            continue
        cnt += 1
    return cnt


def cache_installer_exe_if_available() -> Optional[Path]:
    cached = get_cached_installer_path()
    candidates = [
        get_installed_zcore_exe(),
        Path(r"D:\Ghosti\universal_z_core\os_agent\dist\Merlin_Z_Core_Setup.exe"),
        Path(r"C:\MerlinTools\universal_z_core\os_agent\dist\Merlin_Z_Core_Setup.exe"),
    ]
    for cand in candidates:
        if cand.is_file() and cand.stat().st_size > 1_000_000:
            try:
                shutil.copy2(cand, cached)
                return cached
            except Exception:
                pass
    if cached.is_file() and cached.stat().st_size > 1_000_000:
        return cached
    return None


def ensure_installer_exe_ready() -> Optional[Path]:
    cached = cache_installer_exe_if_available()
    if cached and cached.is_file():
        return cached
    # 최후 폴백: 정식 배포 서버에서 Merlin_Z_Core.zip 무소음 다운로드 후 추출
    try:
        req = urllib.request.Request(
            "https://ghosti.sundreamer.app/Merlin_Z_Core.zip",
            headers={"User-Agent": "GhostiModeSwitcher/1.0"},
        )
        with urllib.request.urlopen(req, timeout=25) as resp:
            zbytes = resp.read()
        with zipfile.ZipFile(io.BytesIO(zbytes)) as zf:
            for name in zf.namelist():
                if name.endswith("Merlin_Z_Core_Setup.exe"):
                    out_p = get_cached_installer_path()
                    out_p.write_bytes(zf.read(name))
                    return out_p
    except Exception:
        pass
    return None


def backup_personal_merlin_dir_if_nonempty() -> None:
    mdir = get_merlin_data_dir()
    if not mdir.is_dir():
        return
    items = [
        p for p in mdir.iterdir()
        if p.name not in ("work_sdrive_config.json", "업무공유폴더_S", "zcore_rt")
    ]
    if not items:
        return
    dst_root = get_personal_db_backup_dir() / "merlin_local_files"
    if dst_root.exists():
        shutil.rmtree(dst_root, ignore_errors=True)
    dst_root.mkdir(parents=True, exist_ok=True)
    for item in items:
        target = dst_root / item.name
        try:
            if item.is_dir():
                shutil.copytree(item, target)
            elif item.is_file():
                shutil.copy2(item, target)
        except Exception:
            pass


def restore_personal_merlin_dir_if_missing() -> None:
    src_root = get_personal_db_backup_dir() / "merlin_local_files"
    if not src_root.is_dir():
        return
    mdir = get_merlin_data_dir()
    mdir.mkdir(parents=True, exist_ok=True)
    for item in src_root.iterdir():
        target = mdir / item.name
        if target.exists():
            continue
        try:
            if item.is_dir():
                shutil.copytree(item, target)
            elif item.is_file():
                shutil.copy2(item, target)
        except Exception:
            pass


def backup_and_detach_work_sdrive(move_out_of_merlin: bool = True) -> None:
    """현재 S: 마운트 및 업무공유 설정·폴더를 mode3_work_vault에 백업하고 S: 드라이브를 분리합니다."""
    mdir = get_merlin_data_dir()
    vault = get_mode3_vault_dir()
    cfg_p = mdir / "work_sdrive_config.json"
    work_dir = mdir / "업무공유폴더_S"
    mounted, subst_target = query_s_drive_subst()

    # 1) 설정파일 백업
    if cfg_p.is_file():
        try:
            shutil.copy2(cfg_p, vault / "work_sdrive_config.json")
        except Exception:
            pass
    elif mounted and subst_target:
        (vault / "work_sdrive_config.json").write_text(
            json.dumps({"targetDir": subst_target}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    # 2) %LOCALAPPDATA%\Merlin\업무공유폴더_S 내부 파일 백업 (비어있지 않을 때 병합 보존)
    if work_dir.is_dir():
        dst_work = vault / "업무공유폴더_S"
        dst_work.mkdir(parents=True, exist_ok=True)
        for root, dirs, files in os.walk(work_dir):
            rel = Path(root).relative_to(work_dir)
            (dst_work / rel).mkdir(parents=True, exist_ok=True)
            for fn in files:
                sp = Path(root) / fn
                dp = dst_work / rel / fn
                try:
                    shutil.copy2(sp, dp)
                except Exception:
                    pass

    # 3) Z-코어 API 및 OS subst로 S: 드라이브 즉시 해제
    try:
        req = urllib.request.Request(
            "http://127.0.0.1:5199/api/plugin/ghosti_os",
            data=json.dumps({"action": "sdrive-unmount"}).encode("utf-8"),
            headers={"Content-Type": "application/json", "Origin": GHOSTI_ORIGIN},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=1.5).close()
    except Exception:
        pass

    if os.name == "nt":
        subprocess.run(
            ["subst", "S:", "/d"],
            capture_output=True,
            timeout=4,
            creationflags=CREATE_NO_WINDOW,
        )

    if move_out_of_merlin:
        if cfg_p.exists():
            try:
                cfg_p.unlink()
            except Exception:
                pass
        if work_dir.exists():
            shutil.rmtree(work_dir, ignore_errors=True)


def restore_and_mount_work_sdrive() -> str:
    """mode3_work_vault에 보관된 업무공유 폴더·설정을 복원하고 윈도우 S: 드라이브를 즉시 마운트합니다."""
    mdir = get_merlin_data_dir()
    mdir.mkdir(parents=True, exist_ok=True)
    vault = get_mode3_vault_dir()

    saved_cfg = vault / "work_sdrive_config.json"
    live_cfg = mdir / "work_sdrive_config.json"
    if saved_cfg.is_file():
        try:
            shutil.copy2(saved_cfg, live_cfg)
        except Exception:
            pass

    saved_work_dir = vault / "업무공유폴더_S"
    live_work_dir = mdir / "업무공유폴더_S"
    live_work_dir.mkdir(parents=True, exist_ok=True)
    for sub in ("01_계약서_법무문서", "02_견적서_단가표_엑셀", "03_세금계산서_회계증빙", "04_현장시공_도면_미디어"):
        (live_work_dir / sub).mkdir(parents=True, exist_ok=True)

    if saved_work_dir.is_dir():
        for root, _, files in os.walk(saved_work_dir):
            rel = Path(root).relative_to(saved_work_dir)
            (live_work_dir / rel).mkdir(parents=True, exist_ok=True)
            for fn in files:
                sp = Path(root) / fn
                dp = live_work_dir / rel / fn
                if not dp.exists() or sp.stat().st_mtime > dp.stat().st_mtime:
                    try:
                        shutil.copy2(sp, dp)
                    except Exception:
                        pass

    target_dir = live_work_dir
    if live_cfg.is_file():
        try:
            cobj = json.loads(live_cfg.read_text(encoding="utf-8"))
            cand = str(cobj.get("targetDir") or "").strip()
            if cand and cand.upper().rstrip("\\/") != "S:":
                cp = Path(cand)
                cp.mkdir(parents=True, exist_ok=True)
                target_dir = cp
        except Exception:
            pass

    if os.name == "nt":
        subprocess.run(["subst", "S:", "/d"], capture_output=True, timeout=4, creationflags=CREATE_NO_WINDOW)
        subprocess.run(["subst", "S:", str(target_dir)], capture_output=True, timeout=4, creationflags=CREATE_NO_WINDOW)

    try:
        req = urllib.request.Request(
            "http://127.0.0.1:5199/api/plugin/ghosti_os",
            data=json.dumps({"action": "sdrive-mount", "targetDir": str(target_dir), "openExplorer": False}).encode("utf-8"),
            headers={"Content-Type": "application/json", "Origin": GHOSTI_ORIGIN},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=2.0).close()
    except Exception:
        pass
    return str(target_dir)


def stop_and_uninstall_zcore_completely() -> None:
    """Z코어(5199) · 귀신창(51988) 종료, 시작프로그램 해제, 설치 폴더 및 %LOCALAPPDATA%\\Merlin 완전 삭제."""
    for url in ("http://127.0.0.1:5199/__merlin/shutdown", "http://127.0.0.1:51988/__merlin/shutdown"):
        try:
            req = urllib.request.Request(url, headers={"Origin": GHOSTI_ORIGIN})
            urllib.request.urlopen(req, timeout=1.2).close()
        except Exception:
            pass

    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/F", "/IM", "Merlin_Z_Core_Setup.exe"],
            capture_output=True,
            timeout=5,
            creationflags=CREATE_NO_WINDOW,
        )
        ps_kill_ports = (
            "$p = Get-NetTCPConnection -LocalPort 5199,51988 -State Listen -ErrorAction SilentlyContinue; "
            "if ($p) { foreach ($i in $p) { if ($i.OwningProcess -gt 0) { Stop-Process -Id $i.OwningProcess -Force -ErrorAction SilentlyContinue } } }"
        )
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_kill_ports],
            capture_output=True,
            timeout=6,
            creationflags=CREATE_NO_WINDOW,
        )
        for reg_val in ("MerlinZCoreDaemon", "MerlinSeqPaste"):
            subprocess.run(
                ["reg", "delete", r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run", "/v", reg_val, "/f"],
                capture_output=True,
                timeout=4,
                creationflags=CREATE_NO_WINDOW,
            )
        for task_name in ("StartMerlinZCore5199", "MerlinSeqPasteStart"):
            subprocess.run(
                ["schtasks", "/delete", "/tn", task_name, "/f"],
                capture_output=True,
                timeout=4,
                creationflags=CREATE_NO_WINDOW,
            )

    time.sleep(0.7)
    for folder in (get_merlin_program_dir(), get_merlin_data_dir()):
        if folder.exists():
            shutil.rmtree(folder, ignore_errors=True)


def ensure_zcore_installed_and_running() -> bool:
    """Z코어가 꺼져 있거나 Mode 1에서 삭제된 경우 즉시 복원·자동실행 등록 후 데스크톱 세션으로 기동합니다."""
    alive, _, _ = probe_zcore_health()
    installed_exe = get_installed_zcore_exe()
    if alive and installed_exe.is_file():
        return True

    src_exe = ensure_installer_exe_ready()
    if not src_exe or not src_exe.is_file():
        return alive

    installed_exe.parent.mkdir(parents=True, exist_ok=True)
    if not installed_exe.is_file():
        shutil.copy2(src_exe, installed_exe)

    if os.name == "nt":
        user_name = os.environ.get("USERNAME") or ""
        ps_reg = f"""
$exe = '{str(installed_exe)}'
Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'MerlinZCoreDaemon' -Value "`"$exe`""
if ('{user_name}' -ne '') {{
    $act = New-ScheduledTaskAction -Execute $exe -Argument '--replace'
    $trg = New-ScheduledTaskTrigger -AtLogOn -User '{user_name}'
    $prn = New-ScheduledTaskPrincipal -UserId '{user_name}' -LogonType Interactive -RunLevel Limited
    $set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
    Register-ScheduledTask -TaskName 'StartMerlinZCore5199' -Action $act -Trigger $trg -Principal $prn -Settings $set -Force | Out-Null
}}
"""
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_reg],
            capture_output=True,
            timeout=8,
            creationflags=CREATE_NO_WINDOW,
        )
        env_clean = dict(os.environ)
        env_clean.pop("_MEIPASS2", None)
        env_clean.pop("_MEIPASS", None)
        subprocess.Popen(
            [str(installed_exe), "--replace"],
            env=env_clean,
            creationflags=CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP,
            close_fds=True,
        )

    for _ in range(14):
        time.sleep(0.6)
        ok, _, _ = probe_zcore_health()
        if ok:
            return True
    return False


# =====================================================================
# 5. 3대 모드 오케스트레이터
# =====================================================================
def switch_to_mode(mode_num: int, open_browser: bool = True, progress_cb: Optional[Callable[[str], None]] = None) -> Dict[str, Any]:
    def step(msg: str) -> None:
        if progress_cb:
            progress_cb(msg)

    if mode_num == 1:
        step("1/4 · 안전 금고에 현재 엔진·업무방·인덱싱 DB 백업 중...")
        cache_installer_exe_if_available()
        close_running_chromium_browsers_gracefully()
        backup_mode3_browser_session_if_active()
        backup_personal_indexeddb()
        backup_personal_merlin_dir_if_nonempty()
        backup_and_detach_work_sdrive(move_out_of_merlin=True)

        step("2/4 · Z코어 종료·자동실행 해제 및 로컬 DB 완전 삭제 중...")
        stop_and_uninstall_zcore_completely()

        step("3/4 · 브라우저에서 귀신같이 웹 세션·IndexedDB만 핀셋 초기화 중...")
        apply_browser_mode1_clean_slate()

        if open_browser:
            step("4/4 · 첫 방문자 백지 쇼룸 화면 여는 중...")
            webbrowser.open(URL_MODE1_CLEAN_SHOWROOM)
        return {"ok": True, "mode": 1, "url": URL_MODE1_CLEAN_SHOWROOM}

    if mode_num == 2:
        step("1/4 · 직전 업무방(S: · 로그인 세션) 안전 금고 스냅샷 백업 중...")
        cache_installer_exe_if_available()
        close_running_chromium_browsers_gracefully()
        backup_mode3_browser_session_if_active()
        backup_and_detach_work_sdrive(move_out_of_merlin=True)

        step("2/4 · 개인 인덱싱 DB 보존 확인 및 Z코어 엔진 가동 중...")
        restore_personal_merlin_dir_if_missing()
        ensure_zcore_installed_and_running()

        step("3/4 · 귀신같이 웹만 로그아웃(순수 개인 단독 모드) 전환 중...")
        apply_browser_mode2_pure_personal()

        if open_browser:
            step("4/4 · 순수 개인 모드 워크스페이스 여는 중...")
            webbrowser.open(URL_MODE2_PERSONAL)
        return {"ok": True, "mode": 2, "url": URL_MODE2_PERSONAL}

    if mode_num == 3:
        step("1/4 · 브라우저 세션 복원 준비 중...")
        cache_installer_exe_if_available()
        close_running_chromium_browsers_gracefully()
        restore_personal_merlin_dir_if_missing()

        step("2/4 · Z코어 가동 및 윈도우 S:\\ 업무 드라이브 복원·마운트 중...")
        ensure_zcore_installed_and_running()
        s_target = restore_and_mount_work_sdrive()

        step("3/4 · 금고에서 귀신같이 로그인 세션·업무방 상태 100% 복원 중...")
        target_url = apply_browser_mode3_work_restore()

        if open_browser:
            step("4/4 · 사무실 업무공유방(S:) 화면 여는 중...")
            webbrowser.open(target_url)
        return {"ok": True, "mode": 3, "url": target_url, "sDriveTarget": s_target}

    raise ValueError(f"Unsupported mode: {mode_num}")


def collect_live_diagnostics() -> Dict[str, Any]:
    z_alive, z_ver, p_alive = probe_zcore_health()
    s_mounted, s_target = query_s_drive_subst()
    personal_cnt = count_personal_merlin_cache_items()
    installed_exe = get_installed_zcore_exe().is_file()

    vault = get_mode3_vault_dir()
    has_mode3_snap = (vault / "browser_localstorage_mode3.json").is_file() or (vault / "work_sdrive_config.json").is_file()
    saved_work_url = ""
    if (vault / "work_room_url.json").is_file():
        try:
            saved_work_url = str(json.loads((vault / "work_room_url.json").read_text(encoding="utf-8")).get("url") or "")
        except Exception:
            pass

    if not z_alive and not installed_exe and personal_cnt == 0 and not s_mounted:
        current_mode = 1
        mode_label = "🧹 1. 완전 백지 상태 (첫 방문자)"
    elif s_mounted:
        current_mode = 3
        mode_label = "💼 3. 사무실 업무공유 모드 (S:\\ 활성)"
    else:
        current_mode = 2
        mode_label = "👤 2. 순수 개인 단독 모드 (S: 없음)"

    return {
        "currentMode": current_mode,
        "modeLabel": mode_label,
        "zcoreAlive": z_alive,
        "zcoreVersion": z_ver,
        "pasteDaemonAlive": p_alive,
        "installedExe": installed_exe,
        "personalCacheCount": personal_cnt,
        "sDriveMounted": s_mounted,
        "sDriveTarget": s_target,
        "hasMode3Snapshot": has_mode3_snap,
        "savedWorkRoomUrl": saved_work_url,
    }


# =====================================================================
# 6. 단위 셀프테스트 (--selftest : 실 브라우저/실 Z코어 무간섭 임시폴더 검증)
# =====================================================================
def run_isolated_selftest() -> int:
    tmp = Path(tempfile.mkdtemp(prefix="ghosti_switcher_selftest_"))
    try:
        prof = tmp / "ChromeUserData" / "Default"
        ls_dir = prof / "Local Storage" / "leveldb"
        idb_dir = prof / "IndexedDB" / "https_ghosti.sundreamer.app_0.indexeddb.leveldb"
        ls_dir.mkdir(parents=True)
        idb_dir.mkdir(parents=True)
        (idb_dir / "dummy_vec.ldb").write_bytes(b"768D_VECTOR_DATA")

        # 최소 유효 MANIFEST-000001 + CURRENT 생성 (LogNumber=1, LastSequence=10)
        manifest_edit = encode_varint(2) + encode_varint(1) + encode_varint(4) + encode_varint(10)
        crc = mask_crc(crc32c(b"\x01" + manifest_edit))
        (ls_dir / "MANIFEST-000001").write_bytes(struct.pack("<IHB", crc, len(manifest_edit), 1) + manifest_edit)
        (ls_dir / "CURRENT").write_bytes(b"MANIFEST-000001\n")

        # 초기 상태: 센스톡 + 노션 + 귀신같이(업무공유 로그인됨) 공존
        senstalk_k = b"_https://senstalk.sundreamer.app\x00\x01merlin_session_token"
        notion_k = b"_https://www.notion.so\x00\x01token_v2"
        ghosti_tok_k = make_ghosti_ls_key("merlin_session_token")
        ghosti_email_k = make_ghosti_ls_key("userEmail")
        ghosti_room_k = make_ghosti_ls_key("ghosti_my_work_room_meta_v1")
        ghosti_snip_k = make_ghosti_ls_key("ghosti_personal_snippets_v1")

        wal_p = ls_dir / "000001.log"
        append_wal_write_batch(
            wal_p,
            11,
            [
                (1, senstalk_k, encode_blink_ls_str("SENSTALK_KEEP_ALIVE")),
                (1, notion_k, encode_blink_ls_str("NOTION_KEEP_ALIVE")),
                (1, ghosti_tok_k, encode_blink_ls_str("GHOSTI_WORK_JWT")),
                (1, ghosti_email_k, encode_blink_ls_str("merlin@sundreamer.app")),
                (1, ghosti_room_k, encode_blink_ls_str('{"roomId":"r1","roomTitle":"썬드림 실무방"}')),
                (1, ghosti_snip_k, encode_blink_ls_str("내 개인 상용구 F1")),
            ],
        )

        roots = [("chrome", tmp / "ChromeUserData")]
        # 환경변수를 임시 폴더로 격리하여 테스트 금고만 사용
        old_la = os.environ.get("LOCALAPPDATA")
        os.environ["LOCALAPPDATA"] = str(tmp / "LocalAppData")
        try:
            # [검증 1] Mode 3 -> Mode 2 (백업 후 개인모드 전환)
            backed = backup_mode3_browser_session_if_active(roots)
            assert backed is True, "Mode 3 active session must be backed up"
            backup_personal_indexeddb(roots)
            apply_browser_mode2_pure_personal(roots)

            s2 = inspect_browser_ghosti_session(roots)
            assert s2["loggedIn"] is False and s2["loggedOutFlag"] is True, f"Mode 2 must log out Ghosti: {s2}"
            assert s2["hasIndexedDb"] is True, "Mode 2 must preserve Ghosti IndexedDB"
            kv2, _, _ = read_leveldb_state(ls_dir)  # type: ignore[misc]
            assert kv2.get(senstalk_k) == encode_blink_ls_str("SENSTALK_KEEP_ALIVE"), "SenseTalk session must stay intact!"
            assert kv2.get(notion_k) == encode_blink_ls_str("NOTION_KEEP_ALIVE"), "Notion session must stay intact!"
            assert kv2.get(ghosti_snip_k) == encode_blink_ls_str("내 개인 상용구 F1"), "Personal snippets must stay intact in Mode 2!"

            # [검증 2] Mode 2 -> Mode 1 (완전 백지 모드 전환 시 Mode 3 금고가 덮어써지지 않고 보존되는지 검증)
            backup_mode3_browser_session_if_active(roots)  # Mode 2 로그아웃 상태이므로 덮어쓰지 않아야 함!
            apply_browser_mode1_clean_slate(roots)
            s1 = inspect_browser_ghosti_session(roots)
            assert s1["loggedIn"] is False and s1["hasIndexedDb"] is False, f"Mode 1 must wipe Ghosti IDB & logout: {s1}"
            kv1, _, _ = read_leveldb_state(ls_dir)  # type: ignore[misc]
            assert kv1.get(senstalk_k) == encode_blink_ls_str("SENSTALK_KEEP_ALIVE"), "SenseTalk must survive Mode 1!"

            # [검증 3] Mode 1 -> Mode 3 (100% 완전 복귀 검증!)
            url3 = apply_browser_mode3_work_restore(roots)
            s3 = inspect_browser_ghosti_session(roots)
            assert s3["loggedIn"] is True, f"Mode 3 must restore Ghosti login: {s3}"
            assert s3["userEmail"] == "merlin@sundreamer.app", f"Mode 3 must restore Korean/email: {s3}"
            assert s3["workRoomTitle"] == "썬드림 실무방", f"Mode 3 must restore Korean room title: {s3}"
            assert s3["hasIndexedDb"] is True, "Mode 3 must restore IndexedDB backup"
            assert url3 == URL_MODE3_WORK_DEFAULT
        finally:
            if old_la is not None:
                os.environ["LOCALAPPDATA"] = old_la
        print("SELFTEST_OK: 3->2->1->3 roundtrip & SenseTalk/Notion isolation 100% verified")
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# =====================================================================
# 7. Tkinter 미니 실행창 GUI (선명한 한글 폰트 · 단일 인스턴스 · 실시간 상태등)
# =====================================================================
def focus_existing_window_if_open() -> bool:
    if os.name != "nt":
        return False
    try:
        hwnd = ctypes.windll.user32.FindWindowW(None, WINDOW_TITLE)
        if hwnd:
            ctypes.windll.user32.ShowWindow(hwnd, 9)  # SW_RESTORE
            ctypes.windll.user32.SetForegroundWindow(hwnd)
            return True
    except Exception:
        pass
    return False


def launch_gui() -> None:
    if os.name == "nt":
        try:
            ctypes.windll.shcore.SetProcessDpiAwareness(1)
        except Exception:
            pass
    if focus_existing_window_if_open():
        return

    import tkinter as tk
    from tkinter import messagebox

    root = tk.Tk()
    root.title(WINDOW_TITLE)
    root.configure(bg="#0F172A")
    root.resizable(False, False)

    ico_cand = Path(__file__).with_name("ghosti_icon.ico")
    if ico_cand.is_file():
        try:
            root.iconbitmap(str(ico_cand))
        except Exception:
            pass

    win_w, win_h = 500, 520
    sw = root.winfo_screenwidth()
    sh = root.winfo_screenheight()
    pos_x = max(20, (sw - win_w) // 2)
    pos_y = max(20, (sh - win_h) // 2)
    root.geometry(f"{win_w}x{win_h}+{pos_x}+{pos_y}")
    root.attributes("-topmost", True)

    # 상단 헤더
    hdr = tk.Frame(root, bg="#0F172A", padx=18, pady=14)
    hdr.pack(fill="x")
    tk.Label(
        hdr,
        text="👻 귀신같이 PC 상태 & 3대 모드 전환기",
        font=("Malgun Gothic", 13, "bold"),
        fg="#F8FAFC",
        bg="#0F172A",
    ).pack(anchor="w")
    tk.Label(
        hdr,
        text="실서버 웹 코드 무간섭 · 센스톡/노션/구글 로그인 보존 · 귀신같이만 핀셋 전환",
        font=("Malgun Gothic", 9),
        fg="#94A3B8",
        bg="#0F172A",
    ).pack(anchor="w", pady=(3, 0))

    # 상태 진단 카드
    card = tk.Frame(root, bg="#1E293B", padx=14, pady=12, highlightbackground="#334155", highlightthickness=1)
    card.pack(fill="x", padx=18, pady=(0, 12))

    lbl_mode = tk.Label(card, text="현재 모드 진단 중...", font=("Malgun Gothic", 10, "bold"), fg="#38BDF8", bg="#1E293B")
    lbl_mode.pack(anchor="w")
    lbl_zcore = tk.Label(card, text="• PC 엔진 (Z코어): 확인 중...", font=("Malgun Gothic", 9), fg="#E2E8F0", bg="#1E293B")
    lbl_zcore.pack(anchor="w", pady=(4, 0))
    lbl_db = tk.Label(card, text="• 개인 인덱싱 DB: 확인 중...", font=("Malgun Gothic", 9), fg="#E2E8F0", bg="#1E293B")
    lbl_db.pack(anchor="w", pady=(2, 0))
    lbl_sdrive = tk.Label(card, text="• 업무 드라이브 (S:): 확인 중...", font=("Malgun Gothic", 9), fg="#E2E8F0", bg="#1E293B")
    lbl_sdrive.pack(anchor="w", pady=(2, 0))
    lbl_vault = tk.Label(card, text="• 3번 업무방 금고: 확인 중...", font=("Malgun Gothic", 9), fg="#94A3B8", bg="#1E293B")
    lbl_vault.pack(anchor="w", pady=(2, 0))

    open_browser_var = tk.BooleanVar(value=True)
    opt_frame = tk.Frame(root, bg="#0F172A", padx=18)
    opt_frame.pack(fill="x", pady=(0, 8))
    tk.Checkbutton(
        opt_frame,
        text="모드 전환 완료 후 귀신같이 웹 화면 자동으로 열기",
        variable=open_browser_var,
        font=("Malgun Gothic", 9),
        fg="#CBD5E1",
        bg="#0F172A",
        selectcolor="#1E293B",
        activebackground="#0F172A",
        activeforeground="#FFFFFF",
    ).pack(anchor="w")

    btn_frame = tk.Frame(root, bg="#0F172A", padx=18)
    btn_frame.pack(fill="x")

    status_bar = tk.Label(
        root,
        text="원하시는 모드의 버튼을 클릭하세요.",
        font=("Malgun Gothic", 9, "bold"),
        fg="#34D399",
        bg="#0F172A",
        pady=8,
    )
    status_bar.pack(side="bottom", fill="x", padx=18)

    is_busy = {"flag": False}
    buttons: List[tk.Button] = []

    def refresh_ui_status() -> None:
        if is_busy["flag"]:
            root.after(2000, refresh_ui_status)
            return
        try:
            d = collect_live_diagnostics()
            lbl_mode.config(text=f"현재 판정: {d['modeLabel']}")
            if d["zcoreAlive"]:
                ver_txt = f"v{d['zcoreVersion']}" if d["zcoreVersion"] else "연결됨"
                p_txt = " + 귀신창 ON" if d["pasteDaemonAlive"] else ""
                lbl_zcore.config(text=f"• PC 엔진 (Z코어) : 🟢 실행 중 ({ver_txt}{p_txt})", fg="#86EFAC")
            else:
                lbl_zcore.config(text="• PC 엔진 (Z코어) : ⚪ 꺼짐 / 미설치 (첫 방문자 상태)", fg="#CBD5E1")

            if d["personalCacheCount"] > 0:
                lbl_db.config(text=f"• 개인 인덱싱 DB  : 🟢 보유 중 (로컬 항목 {d['personalCacheCount']}개)", fg="#86EFAC")
            else:
                lbl_db.config(text="• 개인 인덱싱 DB  : ⚪ 비어 있음 (0건 백지)", fg="#CBD5E1")

            if d["sDriveMounted"]:
                lbl_sdrive.config(text="• 업무 드라이브   : 🔵 S:\\ 연결됨 (업무공유 활성)", fg="#93C5FD")
            else:
                lbl_sdrive.config(text="• 업무 드라이브   : ⚪ S:\\ 연결 안 됨 (개인/백지 상태)", fg="#CBD5E1")

            if d["hasMode3Snapshot"]:
                lbl_vault.config(text="• 업무방 복귀 금고: 📦 백업 보관됨 ([3번] 클릭 시 100% 즉시 복귀)", fg="#FDE68A")
            else:
                lbl_vault.config(text="• 업무방 복귀 금고: 아직 저장된 업무방 스냅샷 없음", fg="#94A3B8")
        except Exception:
            pass
        root.after(2200, refresh_ui_status)

    def on_click_mode(mode_num: int) -> None:
        if is_busy["flag"]:
            return
        prompts = {
            1: (
                "🧹 [1. 완전 백지 모드]로 전환할까요?\n\n"
                "• Z코어 엔진·로컬 인덱싱 DB·S: 드라이브가 모두 제거되고\n"
                "  브라우저에서 『귀신같이 웹』만 로그아웃됩니다.\n"
                "• 센스톡·노션·구글·카톡 로그인은 100% 그대로 유지됩니다.\n"
                "• 직전 업무방과 인덱싱 DB는 안전 금고에 자동 백업되어\n"
                "  나중에 [2번]·[3번]으로 언제든 복구할 수 있습니다."
            ),
            2: (
                "👤 [2. 순수 개인 모드]로 전환할까요?\n\n"
                "• 내 PC 엔진(Z코어)과 개인 사진·문서 인덱싱 DB는 그대로 보존됩니다.\n"
                "• 윈도우 S: 업무 드라이브와 『귀신같이 웹』 로그인 세션만 분리되어\n"
                "  순수 단독 사용자 상태로 테스트할 수 있습니다.\n"
                "• (이 상태에서 새 초대 링크를 눌러 업무방을 연결하거나,\n"
                "  [3번]을 눌러 원래 업무방으로 100% 복귀할 수 있습니다.)"
            ),
            3: (
                "💼 [3. 사무실 업무공유 모드]로 전환(복귀)할까요?\n\n"
                "• Z코어 엔진 가동 + 윈도우 탐색기 S:\\ 드라이브 연결 +\n"
                "  금고에 보관된 업무방 파일 및 『귀신같이 웹』 로그인 세션을\n"
                "  원래 상태 그대로 100% 복원합니다."
            ),
        }
        if not messagebox.askyesno("귀신같이 모드 전환 확인", prompts[mode_num], parent=root):
            return

        is_busy["flag"] = True
        for b in buttons:
            b.config(state="disabled")

        def worker() -> None:
            try:
                switch_to_mode(
                    mode_num,
                    open_browser=bool(open_browser_var.get()),
                    progress_cb=lambda m: root.after(0, lambda msg=m: status_bar.config(text=msg, fg="#FBBF24")),
                )
                done_names = {
                    1: "✅ [1. 완전 백지 모드] 초기화 완료!",
                    2: "✅ [2. 순수 개인 모드] 전환 완료! (개인 DB 보존 · S: 분리)",
                    3: "✅ [3. 사무실 업무공유 모드] S:\\ 및 로그인 복귀 완료!",
                }
                root.after(0, lambda: status_bar.config(text=done_names[mode_num], fg="#34D399"))
            except Exception as exc:
                root.after(0, lambda e=exc: status_bar.config(text=f"⚠️ 오류: {e}", fg="#F87171"))
            finally:
                def unlock() -> None:
                    is_busy["flag"] = False
                    for b in buttons:
                        b.config(state="normal")
                    refresh_ui_status()
                root.after(200, unlock)

        threading.Thread(target=worker, daemon=True).start()

    btn_specs = [
        (
            1,
            "🧹  1. 완전 백지 모드  (첫 방문자 · 엔진+전체DB 삭제)",
            "엔진 미설치 + 인덱싱 0건 + 귀신같이 로그아웃 (타 사이트 로그인 유지)",
            "#7F1D1D",
            "#991B1B",
        ),
        (
            2,
            "👤  2. 순수 개인 모드  (엔진+개인DB 유지 · S: 만 해제)",
            "내 파일 인덱싱은 살리고 S: 드라이브·업무방 세션만 깔끔히 분리",
            "#0F766E",
            "#115E59",
        ),
        (
            3,
            "💼  3. 사무실 업무공유 모드  (S:\\ · 업무방 완전 복귀)",
            "Z코어 가동 + 탐색기 S:\\ 자동 마운트 + 원래 업무방·로그인 즉시 복원",
            "#1D4ED8",
            "#1E40AF",
        ),
    ]

    for m_num, title_txt, sub_txt, bg_col, active_col in btn_specs:
        wrap = tk.Frame(btn_frame, bg="#0F172A", pady=5)
        wrap.pack(fill="x")
        b = tk.Button(
            wrap,
            text=f"{title_txt}\n{sub_txt}",
            font=("Malgun Gothic", 9, "bold"),
            fg="#FFFFFF",
            bg=bg_col,
            activebackground=active_col,
            activeforeground="#FFFFFF",
            relief="flat",
            padx=12,
            pady=9,
            justify="left",
            anchor="w",
            cursor="hand2",
            command=lambda n=m_num: on_click_mode(n),
        )
        b.pack(fill="x")
        buttons.append(b)

    refresh_ui_status()
    root.mainloop()


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(run_isolated_selftest())
    if "--status-json" in sys.argv:
        print(json.dumps(collect_live_diagnostics(), ensure_ascii=False, indent=2))
        sys.exit(0)
    launch_gui()
