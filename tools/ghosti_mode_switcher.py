#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
👻 귀신같이 (Ghosti) — 사내 실무 도그푸딩 & 순수 QA 겸용 『3대 모드 원클릭 전환기』
- 버전: v1.1.0
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

SWITCHER_VERSION = "1.1.0"
WINDOW_TITLE = f"👻 귀신같이 3대 모드 전환기 v{SWITCHER_VERSION}"

GHOSTI_ORIGIN = "https://ghosti.sundreamer.app"
GHOSTI_HOST = "ghosti.sundreamer.app"
GHOSTI_LDB_PREFIX = b"_https://ghosti.sundreamer.app\x00"
LEVELDB_MAX_SEQ = (1 << 56) - 1

URL_MODE1_CLEAN_SHOWROOM = "https://ghosti.sundreamer.app/"
URL_MODE2_PERSONAL = "https://ghosti.sundreamer.app/?dev=true&lounge=personal&tab=trash"
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


def _scan_wal_batches(raw: bytes) -> Tuple[List[bytes], bool]:
    """LevelDB WAL을 CRC32C 검증과 함께 파싱하여 (유효 배치 목록, 꼬리 손상/미완결 여부)를 반환합니다."""
    block_size = 32768
    pos = 0
    n = len(raw)
    batches: List[bytes] = []
    frag = bytearray()
    in_frag = False
    tail_dirty = False

    while pos < n:
        rem = block_size - (pos % block_size)
        if rem < 7:
            pos += rem
            continue
        if pos + 7 > n:
            tail_dirty = True
            break
        crc_m, length, rtype = struct.unpack_from("<IHB", raw, pos)
        if length == 0 and rtype == 0 and crc_m == 0:
            # LevelDB zero-padded trailer to end of 32KB block
            pos += rem
            frag = bytearray()
            in_frag = False
            continue
        if rtype not in (1, 2, 3, 4) or (7 + length) > rem or (pos + 7 + length) > n:
            tail_dirty = True
            frag = bytearray()
            in_frag = False
            pos += rem
            continue
        chunk = raw[pos + 7 : pos + 7 + length]
        expected_crc = mask_crc(crc32c(bytes([rtype]) + chunk))
        if expected_crc != crc_m:
            tail_dirty = True
            frag = bytearray()
            in_frag = False
            pos += rem
            continue
        pos += 7 + length
        if rtype == 1:
            frag = bytearray()
            in_frag = False
            tail_dirty = False
            batches.append(bytes(chunk))
        elif rtype == 2:
            frag = bytearray(chunk)
            in_frag = True
            tail_dirty = True
        elif rtype == 3:
            if in_frag:
                frag.extend(chunk)
                tail_dirty = True
            else:
                tail_dirty = True
        elif rtype == 4:
            if in_frag:
                frag.extend(chunk)
                batches.append(bytes(frag))
                frag = bytearray()
                in_frag = False
                tail_dirty = False
            else:
                tail_dirty = True

    return batches, (tail_dirty or in_frag)


def _iter_wal_batches(filepath: Path):
    raw = filepath.read_bytes()
    batches, _ = _scan_wal_batches(raw)
    for b in batches:
        yield b


def _read_wal_records(filepath: Path) -> List[Tuple[int, int, bytes, bytes]]:
    records: List[Tuple[int, int, bytes, bytes]] = []
    for batch in _iter_wal_batches(filepath):
        if len(batch) < 12:
            continue
        seq, count = struct.unpack_from("<QI", batch, 0)
        if seq == 0 or seq > LEVELDB_MAX_SEQ or count == 0 or count > 500_000:
            continue
        if seq + count - 1 > LEVELDB_MAX_SEQ:
            continue
        pos = 12
        batch_recs: List[Tuple[int, int, bytes, bytes]] = []
        valid_batch = True
        try:
            for i in range(count):
                if pos >= len(batch):
                    valid_batch = False
                    break
                vtype = batch[pos]
                pos += 1
                if vtype not in (0, 1):
                    valid_batch = False
                    break
                klen, pos = read_varint(batch, pos)
                if pos + klen > len(batch):
                    valid_batch = False
                    break
                ukey = batch[pos : pos + klen]
                pos += klen
                if vtype == 1:
                    vlen, pos = read_varint(batch, pos)
                    if pos + vlen > len(batch):
                        valid_batch = False
                        break
                    val = batch[pos : pos + vlen]
                    pos += vlen
                else:
                    val = b""
                batch_recs.append((seq + i, vtype, ukey, val))
        except Exception:
            valid_batch = False
        if valid_batch and len(batch_recs) == count:
            records.extend(batch_recs)
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
                    if s > last_seq and s <= LEVELDB_MAX_SEQ:
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
        valid_logs = [n for n in log_files if n >= active_log]
        if valid_logs:
            target_log = max(active_log, max(valid_logs))
        elif active_log > 0:
            target_log = active_log
        elif log_files:
            target_log = max(log_files)
        else:
            target_log = 1
        all_recs.sort(key=lambda x: x[0])
        kv: Dict[bytes, bytes] = {}
        max_seq = last_seq
        for seq, vtype, ukey, val in all_recs:
            if seq <= LEVELDB_MAX_SEQ and seq > max_seq:
                max_seq = seq
            if vtype == 1:
                kv[ukey] = val
            elif vtype == 0:
                kv.pop(ukey, None)
        return kv, target_log, max_seq
    except Exception:
        return None


def append_wal_write_batch(wal_path: Path, start_seq: int, ops: List[Tuple[int, bytes, bytes]]) -> None:
    if not ops:
        return
    safe_seq = max(1, min(int(start_seq), LEVELDB_MAX_SEQ - len(ops) - 1))
    payload = bytearray(struct.pack("<QI", safe_seq, len(ops)))
    for vtype, ukey, val in ops:
        payload.append(vtype)
        payload.extend(encode_varint(len(ukey)))
        payload.extend(ukey)
        if vtype == 1:
            payload.extend(encode_varint(len(val)))
            payload.extend(val)

    block_size = 32768
    cur_size = 0
    tail_dirty = False
    if wal_path.exists():
        existing_raw = wal_path.read_bytes()
        cur_size = len(existing_raw)
        _, tail_dirty = _scan_wal_batches(existing_raw)

    out = bytearray()
    rem_in_block = block_size - (cur_size % block_size)
    if (tail_dirty and (cur_size % block_size != 0)) or rem_in_block < 7:
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

    last_err: Optional[Exception] = None
    for attempt in range(3):
        try:
            with open(wal_path, "ab") as f:
                f.write(out)
                f.flush()
                try:
                    os.fsync(f.fileno())
                except Exception:
                    pass
            return
        except OSError as exc:
            last_err = exc
            time.sleep(0.25 * (attempt + 1))
    if last_err is not None:
        raise last_err


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


def _list_running_chromium_browsers() -> List[str]:
    if os.name != "nt":
        return []
    targets = ("chrome.exe", "msedge.exe", "whale.exe")
    running: List[str] = []
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
            if exe.lower() in (chk.stdout or "").lower():
                running.append(exe)
        except Exception:
            pass
    return running


def close_running_chromium_browsers_gracefully() -> List[str]:
    """실행 중인 Chrome/Edge/Whale 창에 WM_CLOSE를 보내 LevelDB를 안전하게 플러시한 뒤 완전 종료를 검증합니다."""
    if os.name != "nt":
        return []
    closed_any = _list_running_chromium_browsers()
    if not closed_any:
        return []

    for exe in closed_any:
        try:
            # 1단계: 강제(/F) 없이 정상 종료 요청 -> 열린 탭 세션 보존 & LevelDB 정상 기록
            subprocess.run(
                ["taskkill", "/IM", exe],
                capture_output=True,
                timeout=4,
                creationflags=CREATE_NO_WINDOW,
            )
        except Exception:
            pass

    deadline = time.time() + 3.0
    while time.time() < deadline:
        if not _list_running_chromium_browsers():
            break
        time.sleep(0.25)

    # 백그라운드 잔여 헬퍼 프로세스가 LOCK/WAL을 쥐고 있으면 강제 정리 후 0개 확인까지 대기
    for _ in range(2):
        still = _list_running_chromium_browsers()
        if not still:
            break
        for exe in still:
            try:
                subprocess.run(
                    ["taskkill", "/F", "/T", "/IM", exe],
                    capture_output=True,
                    timeout=4,
                    creationflags=CREATE_NO_WINDOW,
                )
            except Exception:
                pass
        wait_until = time.time() + 2.0
        while time.time() < wait_until:
            if not _list_running_chromium_browsers():
                break
            time.sleep(0.2)

    time.sleep(0.35)
    return closed_any


def _lookup_windows_app_path(exe_name: str) -> Optional[str]:
    if os.name != "nt":
        return None
    try:
        import winreg

        for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
            try:
                with winreg.OpenKey(
                    hive, rf"Software\Microsoft\Windows\CurrentVersion\App Paths\{exe_name}"
                ) as k:
                    val, _ = winreg.QueryValueEx(k, "")
                    cand = str(val or "").strip().strip('"')
                    if cand and os.path.isfile(cand):
                        return cand
            except OSError:
                continue
    except Exception:
        pass
    return None


def find_browser_executable(preferred_exes: Optional[List[str]] = None) -> Optional[str]:
    """실제 설치된 Chrome/Edge/Whale 실행파일 경로를 우선순위(직전 실행 브라우저 우선)로 찾습니다."""
    la = str(get_local_appdata())
    pf = os.environ.get("ProgramFiles") or r"C:\Program Files"
    pf86 = os.environ.get("ProgramFiles(x86)") or r"C:\Program Files (x86)"

    known_paths: Dict[str, List[str]] = {
        "chrome.exe": [
            os.path.join(pf, "Google", "Chrome", "Application", "chrome.exe"),
            os.path.join(pf86, "Google", "Chrome", "Application", "chrome.exe"),
            os.path.join(la, "Google", "Chrome", "Application", "chrome.exe"),
        ],
        "msedge.exe": [
            os.path.join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"),
            os.path.join(pf, "Microsoft", "Edge", "Application", "msedge.exe"),
            os.path.join(la, "Microsoft", "Edge", "Application", "msedge.exe"),
        ],
        "whale.exe": [
            os.path.join(pf, "Naver", "Naver Whale", "Application", "whale.exe"),
            os.path.join(pf86, "Naver", "Naver Whale", "Application", "whale.exe"),
            os.path.join(la, "Naver", "Naver Whale", "Application", "whale.exe"),
        ],
    }

    order: List[str] = []
    for exe in (preferred_exes or []):
        low = exe.lower()
        if low in known_paths and low not in order:
            order.append(low)
    for default_exe in ("chrome.exe", "msedge.exe", "whale.exe"):
        if default_exe not in order:
            order.append(default_exe)

    for exe in order:
        reg_hit = _lookup_windows_app_path(exe)
        if reg_hit:
            return reg_hit
        for cand in known_paths[exe]:
            if os.path.isfile(cand):
                return cand
    return None


def launch_url_in_visible_browser(url: str, preferred_exes: Optional[List[str]] = None) -> bool:
    """pythonw.exe 백그라운드 스레드에서도 100% 확실하게 실제 브라우저 새 창으로 URL을 엽니다."""
    if os.name != "nt":
        try:
            return bool(webbrowser.open(url))
        except Exception:
            return False

    env_clean = dict(os.environ)
    env_clean.pop("_MEIPASS2", None)
    env_clean.pop("_MEIPASS", None)

    exe_path = find_browser_executable(preferred_exes)
    if exe_path:
        try:
            si = subprocess.STARTUPINFO()
            si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            si.wShowWindow = 1  # SW_SHOWNORMAL
            subprocess.Popen(
                [exe_path, "--new-window", url],
                env=env_clean,
                startupinfo=si,
                creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP,
                close_fds=True,
            )
            time.sleep(0.8)
            exe_name = os.path.basename(exe_path).lower()
            if exe_name in [b.lower() for b in _list_running_chromium_browsers()]:
                return True
        except Exception:
            pass

    # 2차 폴백: Windows ShellExecute (os.startfile)
    try:
        os.startfile(url)  # type: ignore[attr-defined]
        time.sleep(0.6)
        if _list_running_chromium_browsers():
            return True
    except Exception:
        pass

    # 3차 폴백: cmd /c start "" <url>
    try:
        subprocess.Popen(
            ["cmd", "/c", "start", "", url],
            env=env_clean,
            creationflags=CREATE_NO_WINDOW,
            close_fds=True,
        )
        return True
    except Exception:
        pass

    try:
        return bool(webbrowser.open(url))
    except Exception:
        return False


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


def backup_personal_indexeddb(
    custom_roots: Optional[List[Tuple[str, Path]]] = None,
    move_mode: bool = False,
) -> None:
    """Mode 1 백지화 직전 귀신같이 IndexedDB(768D 벡터·광학 캐시)를 백업합니다 (move_mode=True 시 즉시 이동)."""
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
                if move_mode:
                    try:
                        lock_f = src / "LOCK"
                        if lock_f.exists():
                            try:
                                lock_f.unlink()
                            except Exception:
                                pass
                        shutil.move(str(src), str(dst))
                        continue
                    except Exception:
                        pass
                try:
                    shutil.copytree(src, dst, ignore=shutil.ignore_patterns("LOCK"))
                except Exception:
                    pass


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
                try:
                    shutil.copytree(src, dst, ignore=shutil.ignore_patterns("LOCK"))
                except Exception:
                    pass


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


def _verify_profile_logged_out(ls_dir: Path) -> bool:
    st = read_leveldb_state(ls_dir)
    if not st:
        return False
    kv, _, _ = st
    lo = kv.get(make_ghosti_ls_key("merlin_logged_out"))
    tok = kv.get(make_ghosti_ls_key("merlin_session_token"))
    supa = kv.get(make_ghosti_ls_key("ghosti_supabase_access_token"))
    return decode_blink_ls_bytes(lo or b"") == "1" and not tok and not supa


def apply_browser_mode1_clean_slate(custom_roots: Optional[List[Tuple[str, Path]]] = None) -> Dict[str, int]:
    """Mode 1: 귀신같이 웹의 모든 LocalStorage·IndexedDB를 비우고 merlin_logged_out='1'만 기록·검증합니다."""
    total = 0
    verified = 0
    errors = 0
    for _, _, pdir in iter_chromium_profiles(custom_roots):
        total += 1
        try:
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
                    if _verify_profile_logged_out(ls_dir):
                        verified += 1
                    else:
                        errors += 1

            # 3) host-only 쿠키 정리 (.sundreamer.app 보존)
            _clear_host_exact_ghosti_cookies(pdir)
        except Exception:
            errors += 1
    return {"profilesTotal": total, "verifiedLoggedOut": verified, "errors": errors}


def apply_browser_mode2_pure_personal(custom_roots: Optional[List[Tuple[str, Path]]] = None) -> Dict[str, int]:
    """Mode 2: 개인 IndexedDB·상용구는 보존하고 귀신같이 로그인 세션·업무방 키만 분리(merlin_logged_out='1')합니다."""
    restore_personal_indexeddb_if_missing(custom_roots)
    total = 0
    verified = 0
    errors = 0
    for _, _, pdir in iter_chromium_profiles(custom_roots):
        ls_dir = pdir / "Local Storage" / "leveldb"
        if not ls_dir.is_dir():
            continue
        total += 1
        try:
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
            if _verify_profile_logged_out(ls_dir):
                verified += 1
            else:
                errors += 1
            _clear_host_exact_ghosti_cookies(pdir)
        except Exception:
            errors += 1
    return {"profilesTotal": total, "verifiedLoggedOut": verified, "errors": errors}


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

    profiles = iter_chromium_profiles(custom_roots)
    has_exact_match = any(f"{bid}::{pname}" in saved_profiles for bid, pname, _ in profiles)
    fallback_entries: Optional[List[Dict[str, str]]] = None
    if not has_exact_match:
        for entries in saved_profiles.values():
            if entries:
                fallback_entries = entries
                break

    restored_host_room = False
    for bid, pname, pdir in profiles:
        ls_dir = pdir / "Local Storage" / "leveldb"
        if not ls_dir.is_dir():
            continue
        try:
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
                # 스냅샷에 해당 프로필이 없던 경우: merlin_logged_out만 해제하여 즉시 로그인 가능 상태로 정리
                lo_key = make_ghosti_ls_key("merlin_logged_out")
                if lo_key in kv:
                    ops.append((0, lo_key, b""))
                ops.append((1, make_ghosti_ls_key("ghosti_onboarding_completed"), encode_blink_ls_str("true")))

            if ops:
                wal_p = ls_dir / f"{active_log:06d}.log"
                append_wal_write_batch(wal_p, max_seq + 1, ops)
        except Exception:
            pass

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


def get_user_downloads_dir() -> Path:
    """Windows 실제 사용자 다운로드 폴더 경로를 반환합니다(레지스트리 커스텀 경로 우선)."""
    if os.name == "nt":
        try:
            import winreg

            with winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders",
            ) as k:
                val, _ = winreg.QueryValueEx(k, "{374DE290-123F-4565-9164-39C4925E467B}")
                if val and os.path.isdir(str(val)):
                    return Path(str(val))
        except Exception:
            pass
    return Path.home() / "Downloads"


def clean_downloads_zcore_artifacts(downloads_dir: Optional[Path] = None) -> int:
    """Mode 1 백지화 시 다운로드 폴더에 남은 Merlin_Z_Core* 폴더·압축·설치파일을 깔끔히 정리합니다."""
    dl = downloads_dir if downloads_dir is not None else get_user_downloads_dir()
    if not dl.is_dir():
        return 0
    removed = 0
    try:
        for item in list(dl.iterdir()):
            low = item.name.lower()
            if not low.startswith("merlin_z_core"):
                continue
            try:
                if item.is_dir():
                    shutil.rmtree(item, ignore_errors=False)
                else:
                    item.unlink()
                removed += 1
            except Exception:
                try:
                    if item.is_dir():
                        shutil.rmtree(item, ignore_errors=True)
                    elif item.exists():
                        item.unlink(missing_ok=True)
                    if not item.exists():
                        removed += 1
                except Exception:
                    pass
    except Exception:
        pass
    return removed


def cache_installer_exe_if_available() -> Optional[Path]:
    cached = get_cached_installer_path()
    candidates = [
        get_installed_zcore_exe(),
        Path(r"D:\Ghosti\universal_z_core\os_agent\dist\Merlin_Z_Core_Setup.exe"),
        Path(r"C:\MerlinTools\universal_z_core\os_agent\dist\Merlin_Z_Core_Setup.exe"),
    ]
    dl = get_user_downloads_dir()
    if dl.is_dir():
        try:
            for item in dl.iterdir():
                low = item.name.lower()
                if not low.startswith("merlin_z_core"):
                    continue
                if item.is_file() and low.endswith(".exe"):
                    candidates.append(item)
                elif item.is_dir():
                    sub_exe = item / "Merlin_Z_Core_Setup.exe"
                    if sub_exe.is_file():
                        candidates.append(sub_exe)
        except Exception:
            pass

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
            headers={"User-Agent": f"GhostiModeSwitcher/{SWITCHER_VERSION}"},
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


def backup_personal_merlin_dir_if_nonempty(move_mode: bool = False) -> None:
    """개인 인덱싱 DB(%LOCALAPPDATA%\\Merlin)를 금고에 보관합니다(move_mode=True 시 동일 드라이브 즉시 이동)."""
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
    if not move_mode and dst_root.exists():
        shutil.rmtree(dst_root, ignore_errors=True)
    dst_root.mkdir(parents=True, exist_ok=True)
    for item in items:
        target = dst_root / item.name
        try:
            if target.exists():
                if target.is_dir():
                    shutil.rmtree(target, ignore_errors=True)
                else:
                    target.unlink(missing_ok=True)
            if move_mode:
                try:
                    shutil.move(str(item), str(target))
                    continue
                except Exception:
                    pass
            if item.is_dir():
                shutil.copytree(item, target)
            elif item.is_file():
                shutil.copy2(item, target)
        except Exception:
            pass


def restore_personal_merlin_dir_if_missing(move_mode: bool = False) -> None:
    src_root = get_personal_db_backup_dir() / "merlin_local_files"
    if not src_root.is_dir():
        return
    mdir = get_merlin_data_dir()
    mdir.mkdir(parents=True, exist_ok=True)
    for item in list(src_root.iterdir()):
        target = mdir / item.name
        if target.exists():
            continue
        try:
            if move_mode:
                try:
                    shutil.move(str(item), str(target))
                    continue
                except Exception:
                    pass
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


def stop_and_uninstall_zcore_completely(
    delete_merlin_dir: bool = True,
    clean_downloads: bool = True,
) -> int:
    """Z코어(5199) 종료, 시작프로그램 해제, 설치 폴더·데이터 폴더 및 다운로드 폴더 Merlin_Z_Core* 정리."""
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

    time.sleep(0.6)
    prog_dir = get_merlin_program_dir()
    if prog_dir.exists():
        shutil.rmtree(prog_dir, ignore_errors=True)
    if delete_merlin_dir:
        mdir = get_merlin_data_dir()
        if mdir.exists():
            shutil.rmtree(mdir, ignore_errors=True)
    dl_removed = clean_downloads_zcore_artifacts() if clean_downloads else 0
    return dl_removed


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
        ps_reg = f"""
$exe = '{str(installed_exe)}'
Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'MerlinZCoreDaemon' -Value "`"$exe`""
$me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
if ($me) {{
    $act = New-ScheduledTaskAction -Execute $exe -Argument '--replace'
    $trg = New-ScheduledTaskTrigger -AtLogOn -User $me
    $prn = New-ScheduledTaskPrincipal -UserId $me -LogonType Interactive -RunLevel Limited
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
        step("1/4 · 엔진 종료·금고 보관 및 다운로드 폴더 정리 중...")
        cache_installer_exe_if_available()
        backup_and_detach_work_sdrive(move_out_of_merlin=True)
        stop_and_uninstall_zcore_completely(delete_merlin_dir=False, clean_downloads=False)
        backup_personal_merlin_dir_if_nonempty(move_mode=True)
        mdir = get_merlin_data_dir()
        if mdir.exists():
            shutil.rmtree(mdir, ignore_errors=True)
        dl_removed = clean_downloads_zcore_artifacts()

        step("2/4 · 브라우저 안전 종료 및 세션 스냅샷 백업 중...")
        closed_browsers = close_running_chromium_browsers_gracefully()
        backup_mode3_browser_session_if_active()
        backup_personal_indexeddb(move_mode=True)

        step("3/4 · 전 브라우저 귀신같이 로그아웃·초기화 및 검증 중...")
        if _list_running_chromium_browsers():
            close_running_chromium_browsers_gracefully()
        b_stats = apply_browser_mode1_clean_slate()
        if _list_running_chromium_browsers():
            close_running_chromium_browsers_gracefully()
            b_stats = apply_browser_mode1_clean_slate()

        opened = False
        if open_browser:
            step("4/4 · 첫 방문자 백지 쇼룸 화면 여는 중...")
            opened = launch_url_in_visible_browser(URL_MODE1_CLEAN_SHOWROOM, closed_browsers)
        return {
            "ok": True,
            "mode": 1,
            "url": URL_MODE1_CLEAN_SHOWROOM,
            "downloadsCleaned": dl_removed,
            "browserStats": b_stats,
            "browserOpened": opened,
        }

    if mode_num == 2:
        step("1/4 · 업무 드라이브(S:) 안전 금고 백업 및 분리 중...")
        cache_installer_exe_if_available()
        backup_and_detach_work_sdrive(move_out_of_merlin=True)

        step("2/4 · 개인 인덱싱 DB 보존 확인 및 Z코어 엔진 가동 중...")
        restore_personal_merlin_dir_if_missing(move_mode=True)
        ensure_zcore_installed_and_running()

        step("3/4 · 브라우저에서 귀신같이 웹만 로그아웃(순수 개인 모드) 전환 중...")
        closed_browsers = close_running_chromium_browsers_gracefully()
        backup_mode3_browser_session_if_active()
        if _list_running_chromium_browsers():
            close_running_chromium_browsers_gracefully()
        b_stats = apply_browser_mode2_pure_personal()

        opened = False
        if open_browser:
            step("4/4 · 순수 개인 모드 워크스페이스 여는 중...")
            opened = launch_url_in_visible_browser(URL_MODE2_PERSONAL, closed_browsers)
        return {
            "ok": True,
            "mode": 2,
            "url": URL_MODE2_PERSONAL,
            "browserStats": b_stats,
            "browserOpened": opened,
        }

    if mode_num == 3:
        step("1/4 · 개인 DB 복원 · Z코어 가동 및 S:\\ 업무 드라이브 마운트 중...")
        cache_installer_exe_if_available()
        restore_personal_merlin_dir_if_missing(move_mode=True)
        ensure_zcore_installed_and_running()
        s_target = restore_and_mount_work_sdrive()

        step("2/4 · 브라우저 안전 종료 중...")
        closed_browsers = close_running_chromium_browsers_gracefully()

        step("3/4 · 금고에서 귀신같이 로그인 세션·업무방 상태 100% 복원 중...")
        if _list_running_chromium_browsers():
            close_running_chromium_browsers_gracefully()
        target_url = apply_browser_mode3_work_restore()

        opened = False
        if open_browser:
            step("4/4 · 사무실 업무공유방(S:) 화면 여는 중...")
            opened = launch_url_in_visible_browser(target_url, closed_browsers)
        return {
            "ok": True,
            "mode": 3,
            "url": target_url,
            "sDriveTarget": s_target,
            "browserOpened": opened,
        }

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

            # [검증 4] 손상된 WAL 꼬리(Profile 11 실사례) + 비정상 대용량 seq 방어 + 로그아웃 복구 검증
            with open(wal_p, "ab") as f:
                f.write(b"\xde\xad\xbe\xef\x10\x00\x01" + b"\xff" * 40)  # bad CRC & truncated/corrupt tail
            st_dirty = read_leveldb_state(ls_dir)
            assert st_dirty is not None and st_dirty[2] < 1_000_000, f"Corrupt WAL tail must not poison max_seq: {st_dirty}"
            res_m1_corrupt = apply_browser_mode1_clean_slate(roots)
            assert res_m1_corrupt["verifiedLoggedOut"] == 1 and res_m1_corrupt["errors"] == 0, f"Corrupt WAL recovery failed: {res_m1_corrupt}"
            s1_after = inspect_browser_ghosti_session(roots)
            assert s1_after["loggedIn"] is False and s1_after["loggedOutFlag"] is True, f"Mode 1 after corrupt WAL must log out: {s1_after}"

            # [검증 5] 다운로드 폴더 Merlin_Z_Core* 정리 검증 (타 파일 100% 보존)
            fake_dl = tmp / "Downloads"
            fake_dl.mkdir(parents=True, exist_ok=True)
            (fake_dl / "Merlin_Z_Core").mkdir()
            (fake_dl / "Merlin_Z_Core" / "Merlin_Z_Core_Setup.exe").write_bytes(b"FAKE")
            (fake_dl / "Merlin_Z_Core.zip").write_bytes(b"ZIP")
            (fake_dl / "important_user_doc.pdf").write_bytes(b"KEEP")
            cleaned = clean_downloads_zcore_artifacts(fake_dl)
            assert cleaned == 2, f"Expected 2 Merlin_Z_Core artifacts cleaned, got {cleaned}"
            assert not (fake_dl / "Merlin_Z_Core").exists() and not (fake_dl / "Merlin_Z_Core.zip").exists()
            assert (fake_dl / "important_user_doc.pdf").is_file(), "User non-ZCore download must remain untouched!"
        finally:
            if old_la is not None:
                os.environ["LOCALAPPDATA"] = old_la
        print("SELFTEST_OK: 3->2->1->3 roundtrip, corrupt WAL recovery, Downloads cleanup & SenseTalk/Notion isolation 100% verified")
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
                lbl_zcore.config(text=f"• PC 엔진 (Z코어) : 🟢 실행 중 ({ver_txt})", fg="#86EFAC")
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
                want_open = bool(open_browser_var.get())
                if want_open:
                    root.after(0, lambda: root.attributes("-topmost", False))
                res = switch_to_mode(
                    mode_num,
                    open_browser=want_open,
                    progress_cb=lambda m: root.after(0, lambda msg=m: status_bar.config(text=msg, fg="#FBBF24")),
                )
                b_stats = res.get("browserStats") or {}
                v_cnt = b_stats.get("verifiedLoggedOut")
                v_suffix = f" (브라우저 {v_cnt}개 프로필 검증)" if isinstance(v_cnt, int) and v_cnt > 0 else ""
                done_names = {
                    1: f"✅ [1. 완전 백지 모드] 초기화 완료!{v_suffix}",
                    2: f"✅ [2. 순수 개인 모드] 전환 완료!{v_suffix}",
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
