#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[내장 소프트웨어 플러그인 4] plugin_ghosti_superpowers.py (v2.7)
- 귀신 부르는 단축키 Ctrl + 0 ([👻 귀신같이 ↗] 로고 클릭 웹 호출)
- 2어절 연속 한영·영한 오타 둔갑술 + 애기귀신 효과음(띠리링~👻) + 한영키 자동 전환
- Account ID + Machine HWID 기반 기기당 7일 무료체험 원장 및 F1~F5 내 상용구 실시간 저장 API
- 단일 표준 포트 http://127.0.0.1:5199 (/api/superpower/*) 직결
"""

from __future__ import annotations

import datetime
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import subprocess
import sys
import threading
import time
from typing import Any, Dict

THIS_DIR = Path(__file__).resolve().parent
if str(THIS_DIR) not in sys.path:
    sys.path.insert(0, str(THIS_DIR))

import seq_paste_daemon as spd  # noqa: E402

LOCAL_APPDATA = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
MERLIN_DIR = LOCAL_APPDATA / "Merlin"
TRIAL_LEDGER_FILE = MERLIN_DIR / "superpower_trial_ledger.json"
USER_SNIPPETS_FILE = MERLIN_DIR / "user_snippets.json"

_DAEMON_THREAD_STARTED = False
_DAEMON_LOCK = threading.Lock()


def ensure_superpower_daemon_running() -> bool:
    """Ctrl+0 초능력 백그라운드 데몬이 떠 있지 않으면 스레드/프로세스로 즉시 기동합니다."""
    global _DAEMON_THREAD_STARTED
    with _DAEMON_LOCK:
        if _DAEMON_THREAD_STARTED:
            return True
        try:
            import socket
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            try:
                s.bind(("127.0.0.1", spd.LOCK_PORT))
                s.close()
                t = threading.Thread(target=spd.main, daemon=True)
                t.start()
            except OSError:
                pass
            _DAEMON_THREAD_STARTED = True
            return True
        except Exception:
            return False


def get_machine_hwid() -> str:
    """메인보드 UUID / 머신 GUID 기반 기기 고유 해시(sha256_...) 반환"""
    raw_id = f"{platform.node()}::{platform.machine()}"
    if os.name == "nt":
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Cryptography") as k:
                guid, _ = winreg.QueryValueEx(k, "MachineGuid")
                if guid:
                    raw_id = f"{guid}::{platform.node()}"
        except Exception:
            pass
    digest = hashlib.sha256(raw_id.encode("utf-8")).hexdigest()[:20]
    return f"sha256_{digest}"


def _load_trial_ledger() -> Dict[str, Any]:
    MERLIN_DIR.mkdir(parents=True, exist_ok=True)
    if TRIAL_LEDGER_FILE.exists():
        try:
            data = json.loads(TRIAL_LEDGER_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
        except Exception:
            pass
    return {"machines": {}, "accounts": {}}


def _save_trial_ledger(data: Dict[str, Any]) -> None:
    MERLIN_DIR.mkdir(parents=True, exist_ok=True)
    TRIAL_LEDGER_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def get_superpower_status(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    data = params or {}
    account_id = str(data.get("accountId") or "guest_local").strip()
    is_subscribed = str(data.get("isSubscribed") or "false").lower() in ("true", "1", "yes")
    hwid = get_machine_hwid()
    ledger = _load_trial_ledger()

    if is_subscribed:
        ledger.setdefault("machines", {})[hwid] = {
            "accountId": account_id,
            "isSubscribed": True,
            "updatedAt": datetime.datetime.now().isoformat(),
        }
        _save_trial_ledger(ledger)

    m_entry = ledger.get("machines", {}).get(hwid)
    trial_status = "NOT_STARTED"
    trial_days_left = 7
    started_at_iso = None
    expires_at_iso = None

    if is_subscribed or (m_entry and m_entry.get("isSubscribed")):
        trial_status = "SUBSCRIBED"
        trial_days_left = 9999
    elif m_entry and m_entry.get("startedAtTs"):
        started_ts = float(m_entry["startedAtTs"])
        started_at_iso = m_entry.get("startedAt")
        expires_at_iso = m_entry.get("expiresAt")
        elapsed_days = (time.time() - started_ts) / 86400.0
        rem = int(max(0, round(7.0 - elapsed_days + 0.49)))
        trial_days_left = rem
        trial_status = "ACTIVE" if rem > 0 else "EXPIRED"

    ensure_superpower_daemon_running()
    return {
        "ok": True,
        "engine_running": True,
        "version": "2.7",
        "port": 5199,
        "machine_hwid": hwid,
        "account_id": account_id,
        "trial_status": trial_status,
        "trial_days_left": trial_days_left,
        "started_at": started_at_iso,
        "expires_at": expires_at_iso,
        "is_subscribed": bool(is_subscribed or trial_status == "SUBSCRIBED"),
        "web_launcher_url": spd.GHOSTI_WEB_URL,
        "snippets": get_snippets(),
    }


def start_superpower_trial(body: Dict[str, Any] | None = None) -> Dict[str, Any]:
    data = body or {}
    account_id = str(data.get("accountId") or "local_user").strip()
    is_subscribed = bool(data.get("isSubscribed", False))
    hwid = get_machine_hwid()
    ledger = _load_trial_ledger()
    machines = ledger.setdefault("machines", {})

    now_ts = time.time()
    now_dt = datetime.datetime.now()
    exp_dt = now_dt + datetime.timedelta(days=7)

    # 동일 PC(Machine HWID)에서 이미 체험을 시작한 이력이 있으면 기존 시작 시각을 유지(다계정 꼼수 차단),
    # 처음 시작하는 PC이면 오늘부터 7일 무료체험 부여!
    existing = machines.get(hwid)
    if not existing or not existing.get("startedAtTs"):
        machines[hwid] = {
            "accountId": account_id,
            "machineHwid": hwid,
            "startedAtTs": now_ts,
            "startedAt": now_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "expiresAt": exp_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "isSubscribed": is_subscribed,
        }
        _save_trial_ledger(ledger)

    ensure_superpower_daemon_running()
    status = get_superpower_status({"accountId": account_id, "isSubscribed": is_subscribed})
    status["message"] = "🎉 1주일 무료체험이 시작되었습니다! (구독 회원은 전 기기 평생 무료)"
    return status


def get_snippets() -> Dict[str, str]:
    snippets = spd.ensure_default_snippets()
    if USER_SNIPPETS_FILE.exists():
        try:
            custom = json.loads(USER_SNIPPETS_FILE.read_text(encoding="utf-8"))
            if isinstance(custom, dict):
                snippets.update({k: str(v) for k, v in custom.items() if k in ("F1", "F2", "F3", "F4", "F5")})
        except Exception:
            pass
    return snippets


def save_snippets(body: Dict[str, Any] | None = None) -> Dict[str, Any]:
    data = body or {}
    raw_snippets = data.get("snippets") if isinstance(data.get("snippets"), dict) else data
    current = get_snippets()
    for key in ("F1", "F2", "F3", "F4", "F5"):
        if key in raw_snippets and raw_snippets[key] is not None:
            current[key] = str(raw_snippets[key]).strip()[:300]

    MERLIN_DIR.mkdir(parents=True, exist_ok=True)
    USER_SNIPPETS_FILE.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        spd.SNIPPETS_FILE.parent.mkdir(parents=True, exist_ok=True)
        spd.SNIPPETS_FILE.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass
    return {
        "ok": True,
        "snippets": current,
        "message": "✅ F1~F5 내 상용구가 Z-코어에 즉시 저장되었습니다! (재시작 없이 Ctrl+0 ➔ F1~F5 즉시 사용 가능)",
    }


def _convert_korean_money_bidirectional(text: str) -> str:
    """억만금 한글 숫자('3억 5천만') <-> 아라비아 세자리 콤마('350,000,000') 양방향 변환"""
    s = text.strip()
    if not s:
        return s
    digits_only = re.sub(r"[,\s원]", "", s)
    if digits_only.isdigit():
        num = int(digits_only)
        if num == 0:
            return "0"
        units = [("조", 10**12), ("억", 10**8), ("만", 10**4), ("", 1)]
        parts = []
        rem = num
        for u_name, u_val in units:
            chunk = rem // u_val
            rem %= u_val
            if chunk > 0:
                sub_parts = []
                th = chunk // 1000
                hu = (chunk % 1000) // 100
                te = (chunk % 100) // 10
                on = chunk % 10
                if th:
                    sub_parts.append(f"{th if th > 1 else ''}천")
                if hu:
                    sub_parts.append(f"{hu if hu > 1 else ''}백")
                if te:
                    sub_parts.append(f"{te if te > 1 else ''}십")
                if on:
                    sub_parts.append(str(on))
                parts.append("".join(sub_parts) + u_name)
        return " ".join(parts).strip()

    kor_digit = {"영": 0, "공": 0, "일": 1, "이": 2, "삼": 3, "사": 4, "오": 5, "육": 6, "륙": 6, "칠": 7, "팔": 8, "구": 9}
    small_unit = {"십": 10, "백": 100, "천": 1000}
    large_unit = {"만": 10**4, "억": 10**8, "조": 10**12}

    total = 0
    large_acc = 0
    small_acc = 0
    cur_num = 0
    clean = re.sub(r"[\s,원]+", "", s)
    i = 0
    matched_any = False
    while i < len(clean):
        ch = clean[i]
        if ch.isdigit():
            j = i
            while j < len(clean) and clean[j].isdigit():
                j += 1
            cur_num = int(clean[i:j])
            matched_any = True
            i = j
            continue
        if ch in kor_digit:
            cur_num = kor_digit[ch]
            matched_any = True
        elif ch in small_unit:
            u = small_unit[ch]
            small_acc += (cur_num if cur_num > 0 else 1) * u
            cur_num = 0
            matched_any = True
        elif ch in large_unit:
            u = large_unit[ch]
            large_acc += (small_acc + cur_num if (small_acc + cur_num) > 0 else 1) * u
            small_acc = 0
            cur_num = 0
            matched_any = True
        i += 1
    total = large_acc + small_acc + cur_num
    if matched_any and total > 0:
        return f"{total:,}"
    return s


def simulate_superpower(body: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """온보딩 탭 2 [보여주기 + 바로 체험하기] 입력창용 실시간 파이썬 변환 API"""
    data = body or {}
    mode = str(data.get("mode") or "typo").strip().lower()
    text = str(data.get("text") or "").strip()

    if mode == "typo":
        tokens = re.split(r"(\s+)", text)
        out_tokens = []
        changed = False
        for tok in tokens:
            if not tok or tok.isspace():
                out_tokens.append(tok)
                continue
            if re.fullmatch(r"[A-Za-z]+", tok) and not spd.AI_ENGINE.is_valid_english_word(tok):
                cand = spd.eng_word_to_kor(tok)
                if cand and spd.is_valid_korean_word(cand):
                    out_tokens.append(cand)
                    changed = True
                    continue
            out_tokens.append(tok)
        converted = "".join(out_tokens)
        if not changed and any("가" <= c <= "힣" or "ㄱ" <= c <= "ㅎ" or "ㅏ" <= c <= "ㅣ" for c in text):
            cand_en = spd.kor_text_to_eng(text)
            if cand_en != text:
                converted = cand_en
                changed = True
        return {
            "ok": True,
            "mode": "typo",
            "original": text,
            "converted": converted,
            "changed": changed,
            "badge": "👻 [한영 둔갑술] 띠리링~♪ (한/영키 자동 전환 + 1.5초 역전 방어)",
        }

    if mode in ("extract8", "hyphen7"):
        formatted = spd._toggle_korean_number_format(text)
        return {
            "ok": True,
            "mode": mode,
            "original": text,
            "converted": formatted,
            "badge": "👻 [8번 계좌·연락처 AI 구조화 추출]" if mode == "extract8" else "👻 [7번 전화번호 하이픈 정형화]",
        }

    if mode == "number9":
        converted = _convert_korean_money_bidirectional(text)
        return {
            "ok": True,
            "mode": "number9",
            "original": text,
            "converted": converted,
            "badge": "👻 [억만금 한글 숫자 ⇄ 아라비아 숫자 양방향 변환]",
        }

    return {"ok": False, "error": f"UNKNOWN_SIMULATE_MODE: {mode}"}
