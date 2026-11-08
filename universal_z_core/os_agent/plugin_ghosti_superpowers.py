#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[내장 소프트웨어 플러그인 4] plugin_ghosti_superpowers.py (v2.8)
- 귀신 부르는 단축키 Ctrl + 0 ([👻 귀신같이 ↗] 로고 클릭 웹 호출 + 리얼 귀신검색창 팝업 직결)
- 2어절 연속 한영·영한 오타 둔갑술 + 애기귀신 효과음(띠리링~👻) + 한영키 자동 전환
- Account ID + Machine HWID 기반 기기당 30일 무료체험 원장 및 F1~F5 내 상용구 실시간 저장 API
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
    """
    [프로세스 완전 분리 모드 (멀린님 지시 반영)]
    - 귀신창 데몬(seq_paste_daemon.py, 포트 51988)은 전속비서(Secretary)가 관리하는
      독립 프로세스(MerlinGhostWindowStart / start_seq_daemon.vbs)로만 단독 구동합니다.
    - 기본 엔진(5199)이 내장 스레드(threading.Thread)로 중복 기동하여 포트를 선점하거나
      인덱싱/재기동 시 귀신창에 간섭하는 현상을 100% 원천 차단합니다.
    """
    return True


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



def _compute_feature_trials(feature_trials_ledger: Dict[str, Any], is_subscribed: bool) -> Dict[str, Any]:
    """
    12개 개별 초능력 각각의 30일 무제한 타이머 상태 산출:
    - UNOPENED: 아직 한 번도 성공 완수하지 않은 미개봉 상태 (언제든 처음 쓰면 30일 무제한 개시!)
    - ACTIVE_30D: 첫 사용 후 30일 이내 무제한 상태 (D-30 ~ D-1 잔여일수)
    - EXPIRED: 30일 무제한 만료 상태 (이 기능들만 합산하여 일일 3회 제한 적용)
    """
    now_ts = time.time()
    trials_map: Dict[str, Any] = {}
    unopened_count = 0
    active_count = 0
    expired_count = 0

    for fid, fname in SUPERPOWER_12_FEATURES.items():
        if is_subscribed:
            trials_map[fid] = {
                "name": fname,
                "status": "SUBSCRIBED",
                "days_left": 9999,
                "first_used_at": None,
                "expires_at": None,
                "is_unopened": False,
                "is_active": True,
                "is_expired": False,
            }
            active_count += 1
            continue

        entry = feature_trials_ledger.get(fid)
        if not entry or not entry.get("firstUsedTs"):
            trials_map[fid] = {
                "name": fname,
                "status": "UNOPENED",
                "days_left": 30,
                "first_used_at": None,
                "expires_at": None,
                "is_unopened": True,
                "is_active": False,
                "is_expired": False,
            }
            unopened_count += 1
        else:
            first_ts = float(entry["firstUsedTs"])
            elapsed_days = (now_ts - first_ts) / 86400.0
            rem_days = int(max(0, round(30.0 - elapsed_days + 0.49)))
            first_iso = entry.get("firstUsedAt")
            exp_iso = entry.get("expiresAt")
            if rem_days > 0:
                trials_map[fid] = {
                    "name": fname,
                    "status": "ACTIVE_30D",
                    "days_left": rem_days,
                    "first_used_at": first_iso,
                    "expires_at": exp_iso,
                    "is_unopened": False,
                    "is_active": True,
                    "is_expired": False,
                }
                active_count += 1
            else:
                trials_map[fid] = {
                    "name": fname,
                    "status": "EXPIRED",
                    "days_left": 0,
                    "first_used_at": first_iso,
                    "expires_at": exp_iso,
                    "is_unopened": False,
                    "is_active": False,
                    "is_expired": True,
                }
                expired_count += 1

    return {
        "trials": trials_map,
        "unopened_count": unopened_count,
        "active_count": active_count,
        "expired_count": expired_count,
        "total_features": len(SUPERPOWER_12_FEATURES),
    }


def _compute_cross_device_trial(cross_ledger: Dict[str, Any], linked_device_count: int, is_subscribed: bool) -> Dict[str, Any]:
    """
    내 기기 통합 (월 3,900원) 30일 체험:
    - 2번째 기기 연결 완료 시점(linkedDeviceCount >= 2)부터 30일 카운트다운 자동 시작!
    """
    if is_subscribed:
        return {
            "status": "SUBSCRIBED",
            "days_left": 9999,
            "started_at": None,
            "expires_at": None,
            "linked_device_count": linked_device_count,
            "message": "내 기기 통합 구독 중 (평생 무제한)",
        }

    now_ts = time.time()
    started_ts = cross_ledger.get("startedAtTs")
    if linked_device_count < 2 and not started_ts:
        return {
            "status": "WAITING_SECOND_DEVICE",
            "days_left": 30,
            "started_at": None,
            "expires_at": None,
            "linked_device_count": linked_device_count,
            "message": "2번째 기기(폰/집PC/회사PC) 연결 시 30일 무료체험 자동 시작",
        }

    # 2번째 기기 연결 감지 시 체험 개시
    if not started_ts:
        now_dt = datetime.datetime.now()
        exp_dt = now_dt + datetime.timedelta(days=30)
        cross_ledger["startedAtTs"] = now_ts
        cross_ledger["startedAt"] = now_dt.strftime("%Y-%m-%d %H:%M:%S")
        cross_ledger["expiresAt"] = exp_dt.strftime("%Y-%m-%d %H:%M:%S")
        started_ts = now_ts

    elapsed_days = (now_ts - float(started_ts)) / 86400.0
    rem_days = int(max(0, round(30.0 - elapsed_days + 0.49)))
    if rem_days > 0:
        return {
            "status": "ACTIVE_30D",
            "days_left": rem_days,
            "started_at": cross_ledger.get("startedAt"),
            "expires_at": cross_ledger.get("expiresAt"),
            "linked_device_count": linked_device_count,
            "message": f"내 기기 통합 30일 무료체험 진행 중 (잔여 {rem_days}일)",
        }
    return {
        "status": "EXPIRED",
        "days_left": 0,
        "started_at": cross_ledger.get("startedAt"),
        "expires_at": cross_ledger.get("expiresAt"),
        "linked_device_count": linked_device_count,
        "message": "내 기기 통합 무료체험 만료 (월 3,900원 구독 시 원격 검색·클립보드·우체통 무제한)",
    }


def get_superpower_status(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    data = params or {}
    account_id = str(data.get("accountId") or "guest_local").strip()
    is_subscribed = str(data.get("isSubscribed") or "false").lower() in ("true", "1", "yes")
    linked_device_count = int(data.get("linkedDeviceCount") or data.get("linked_device_count") or 1)
    hwid = get_machine_hwid()
    ledger = _load_trial_ledger()

    if is_subscribed:
        ledger.setdefault("machines", {})[hwid] = {
            "accountId": account_id,
            "isSubscribed": True,
            "updatedAt": datetime.datetime.now().isoformat(),
        }
        _save_trial_ledger(ledger)

    m_entry = ledger.setdefault("machines", {}).setdefault(hwid, {
        "accountId": account_id,
        "machineHwid": hwid,
        "isSubscribed": is_subscribed,
    })

    # 1. 개별 기능별 30일 무제한 타이머 원장
    feature_trials_ledger = m_entry.setdefault("featureTrials", {})
    ft_res = _compute_feature_trials(feature_trials_ledger, is_subscribed or m_entry.get("isSubscribed", False))

    # 2. 내 기기 통합 (2번째 기기 연결 시 30일 무료체험)
    cross_ledger = m_entry.setdefault("crossDeviceTrial", {})
    cross_res = _compute_cross_device_trial(cross_ledger, linked_device_count, is_subscribed or m_entry.get("isSubscribed", False))

    # 3. 만료된 기능들만 합산하여 적용되는 기기당 일일 성공 3회 잔여량
    today_str = datetime.date.today().isoformat()
    daily_usage_entry = m_entry.setdefault("dailyUsage", {}).get(today_str, 0)
    daily_free_limit = 3
    daily_free_remaining = max(0, daily_free_limit - int(daily_usage_entry))

    # 종합 상태 결정
    if is_subscribed or m_entry.get("isSubscribed"):
        trial_status = "SUBSCRIBED"
        trial_days_left = 9999
        daily_free_remaining = 9999
    elif ft_res["unopened_count"] > 0 or ft_res["active_count"] > 0:
        trial_status = "PER_FEATURE_ACTIVE"  # 미개봉 또는 30일 무제한 기능 보유 중
        trial_days_left = max([t["days_left"] for t in ft_res["trials"].values() if t["status"] in ("ACTIVE_30D", "ACTIVE_7D")] or [30])
    else:
        trial_status = "EXPIRED_DAILY_3"  # 모든 기능이 만료되어 매일 3회 평생 무료 적용 중

    ensure_superpower_daemon_running()
    return {
        "ok": True,
        "engine_running": True,
        "version": "3.5",
        "port": 5199,
        "machine_hwid": hwid,
        "account_id": account_id,
        "trial_status": trial_status,
        "trial_days_left": trial_days_left,
        "daily_free_limit": daily_free_limit,
        "daily_free_remaining": daily_free_remaining,
        "feature_trials": ft_res["trials"],
        "unopened_features_count": ft_res["unopened_count"],
        "active_features_count": ft_res["active_count"],
        "expired_features_count": ft_res["expired_count"],
        "cross_device_trial": cross_res,
        "is_subscribed": bool(is_subscribed or trial_status == "SUBSCRIBED"),
        "web_launcher_url": spd.GHOSTI_WEB_URL,
        "snippets": get_snippets(),
        "settings": spd.get_superpower_settings(),
        "e2ee_mailbox": spd.sync_offline_e2ee_mailbox(),
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
    exp_dt = now_dt + datetime.timedelta(days=30)

    # 동일 PC(Machine HWID)에서 이미 체험을 시작한 이력이 있으면 기존 시작 시각을 유지(다계정 꼼수 차단),
    # 처음 시작하는 PC이면 오늘부터 30일 무료체험 부여!
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
    status["message"] = "🎉 30일 무료체험이 시작되었습니다! (구독 회원은 전 기기 평생 무료)"
    return status


SNIPPET_KEYS = ("F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10")

SUPERPOWER_12_FEATURES: Dict[str, str] = {
    "feat_1_seq_paste": "1번 순차 붙여넣기",
    "feat_2_typo_morph": "2번 한영·영한 오타 둔갑술",
    "feat_3_clean_format": "3번 클립보드 서식 세탁",
    "feat_4_iron_lines": "4번 줄바꿈 다림질 및 NFKC 정규화",
    "feat_5_ai_search": "5번 복사검색 AI 즉시 질의",
    "feat_6_screen_ocr": "6번 화면 캡처 OCR 텍스트·표 추출",
    "feat_7_toggle_topmost": "7번 작업창 최상위 고정 핀",
    "feat_8_format_numbers": "8번 계좌·전화번호 정형화",
    "feat_9_image_file": "9번 스샷 이미지·PDF 파일 즉시 생성",
    "feat_b1_snippets": "보너스 1번 F1~F10 내 상용구 매크로",
    "feat_b2_excel_split": "보너스 2번 엑셀 다중 셀 쪼개기",
    "feat_b3_pdf_merge": "보너스 3번 클립보드 PDF 병합/추출",
}



def get_snippets() -> Dict[str, str]:
    snippets = spd.ensure_default_snippets()
    if USER_SNIPPETS_FILE.exists():
        try:
            custom = json.loads(USER_SNIPPETS_FILE.read_text(encoding="utf-8"))
            if isinstance(custom, dict):
                snippets.update({k: str(v) for k, v in custom.items() if k in SNIPPET_KEYS})
        except Exception:
            pass
    return snippets


def save_snippets(body: Dict[str, Any] | None = None) -> Dict[str, Any]:
    data = body or {}
    raw_snippets = data.get("snippets") if isinstance(data.get("snippets"), dict) else data
    current = get_snippets()
    for key in SNIPPET_KEYS:
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
        "message": "✅ F1~F10 내 상용구가 Z-코어에 즉시 저장되었습니다! (재시작 없이 Ctrl+0 ➔ F1~F10 즉시 사용 가능)",
    }


def get_superpower_settings_api() -> Dict[str, Any]:
    return {
        "ok": True,
        "settings": spd.get_superpower_settings(),
        "snippets": get_snippets(),
        "e2ee_mailbox": spd.sync_offline_e2ee_mailbox(),
    }


def update_superpower_settings_api(body: Dict[str, Any] | None = None) -> Dict[str, Any]:
    data = body or {}
    if data.get("clear_history"):
        cleared_cnt = spd.clear_clipboard_history()
        return {
            "ok": True,
            "cleared_count": cleared_cnt,
            "settings": spd.get_superpower_settings(),
            "message": f"🧹 클립보드 복사검색 기록({cleared_cnt}건)과 오프라인 암호화 우체통 버퍼를 즉시 비웠습니다.",
        }
    updated_cfg = spd.update_superpower_settings(data)
    return {
        "ok": True,
        "settings": updated_cfg,
        "message": "✅ 귀신창 및 클립보드 보관 설정이 Z-코어에 즉시 반영되었습니다.",
    }


def sync_e2ee_mailbox_api(body: Dict[str, Any] | None = None) -> Dict[str, Any]:
    data = body or {}
    items = data.get("items") if isinstance(data.get("items"), list) else None
    res = spd.sync_offline_e2ee_mailbox(items)
    res["message"] = "📬 E2EE 암호화 우체통 양방향 클립보드 동기화가 완료되었습니다."
    return res


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


def get_telemetry() -> Dict[str, Any]:
    """[100% 합법 익명 통계(Zero-Content Telemetry)] 원문 0 Byte, 기능별 호출 횟수만 반환"""
    enabled = spd.is_telemetry_enabled()
    data: Dict[str, Any] = {"daily": {}, "total": {}, "updated_at": None}
    for cand in (spd.TELEMETRY_FILE, spd.TELEMETRY_SEC_MIRROR):
        if cand.exists():
            try:
                loaded = json.loads(cand.read_text(encoding="utf-8"))
                if isinstance(loaded, dict):
                    data = loaded
                    break
            except Exception:
                pass
    wav_files = sorted(w.name for w in spd.SOUNDS_DIR.glob("*.wav")) if spd.SOUNDS_DIR.exists() else []
    return {
        "ok": True,
        "version": "3.1",
        "zero_content_guaranteed": True,
        "collected_content_bytes": 0,
        "telemetry_enabled": enabled,
        "daily": data.get("daily", {}),
        "total": data.get("total", {}),
        "updated_at": data.get("updated_at"),
        "sound_files": wav_files,
    }


def update_telemetry(body: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """환경설정 [익명 사용 통계 보내기] ON/OFF 토글 제어 및 익명 기능 카운트 기록"""
    data = body or {}
    if "enabled" in data and data["enabled"] is not None:
        spd.set_telemetry_enabled(bool(data["enabled"]))
    feature_key = str(data.get("feature_key") or data.get("featureKey") or "").strip()
    if feature_key and spd.is_telemetry_enabled():
        spd.record_feature_telemetry(feature_key)
        time.sleep(0.03)
    res = get_telemetry()
    res["message"] = (
        "✅ 익명 기능 사용 통계 수집이 활성화되었습니다 (원문 텍스트 0 Byte 수집)."
        if res["telemetry_enabled"]
        else "🔒 익명 기능 사용 통계 수집이 중단(OFF)되었습니다."
    )
    return res


def consume_superpower_action(body: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """
    [v3.5 퍼널: 12개 초능력 각각 첫 성공 시 30일 무제한 ➔ 만료된 기능만 기기당 일일 3회 제한]
    - 단순히 창을 띄우거나 취소한 것은 절대 차감하지 않음!
    - 미개봉 기능: 처음 액션 완수 시 그 기능만 30일 무제한 타이머 개시 (consumed: False, 차감 없음)
    - 30일 이내 기능: 무제한 통과 (consumed: False, 차감 없음)
    - 30일 만료된 기능: 기기별 오늘 3회 한도 내에서 1회 차감 (consumed: True)
    - 테스트/시뮬레이션 지원:
      * simulateExpireFeature: 특정 기능의 firstUsedTs를 31일 전으로 조작해 즉시 만료 테스트
      * resetTrials: 원장을 초기화하여 전 기능 미개봉 상태로 복원
    """
    data = body or {}
    account_id = str(data.get("accountId") or "local_user").strip()
    is_subscribed = bool(data.get("isSubscribed", False))
    raw_action = str(data.get("actionType") or data.get("feature_id") or "feat_1_seq_paste").strip()
    hwid = get_machine_hwid()
    ledger = _load_trial_ledger()
    machines = ledger.setdefault("machines", {})
    m_entry = machines.setdefault(hwid, {
        "accountId": account_id,
        "machineHwid": hwid,
        "isSubscribed": is_subscribed,
    })

    # 🧪 시뮬레이션 지원: 원장 리셋
    if data.get("resetTrials"):
        m_entry["featureTrials"] = {}
        m_entry["crossDeviceTrial"] = {}
        m_entry["dailyUsage"] = {}
        _save_trial_ledger(ledger)
        return {"ok": True, "message": "🧹 모든 12대 초능력 30일 무제한 타이머 원장을 미개봉 초기 상태로 리셋했습니다."}

    # 🧪 시뮬레이션 지원: 특정 기능 강제 만료
    sim_expire = data.get("simulateExpireFeature")
    if sim_expire and sim_expire in SUPERPOWER_12_FEATURES:
        ft_ledger = m_entry.setdefault("featureTrials", {})
        thirty_one_days_ago = time.time() - (31 * 86400)
        ft_ledger[sim_expire] = {
            "firstUsedTs": thirty_one_days_ago,
            "firstUsedAt": datetime.datetime.fromtimestamp(thirty_one_days_ago).strftime("%Y-%m-%d %H:%M:%S"),
            "expiresAt": datetime.datetime.fromtimestamp(thirty_one_days_ago + 30 * 86400).strftime("%Y-%m-%d %H:%M:%S"),
        }
        _save_trial_ledger(ledger)
        return {"ok": True, "message": f"🧪 [{SUPERPOWER_12_FEATURES[sim_expire]}] 기능을 30일 만료 상태로 시뮬레이션 설정했습니다."}

    # 기능 ID 정규화 (feat_1 ~ feat_9, feat_b1 ~ feat_b3 또는 숫자 매핑)
    feature_id = raw_action
    if not feature_id.startswith("feat_"):
        num_match = re.search(r"\d+", raw_action)
        if num_match:
            n = int(num_match.group())
            if 1 <= n <= 9:
                feature_id = f"feat_{n}_" + list(SUPERPOWER_12_FEATURES.keys())[n-1].split(f"feat_{n}_")[-1]
            elif n >= 10:
                feature_id = "feat_b1_snippets"
        elif "snippet" in raw_action.lower() or "f1" in raw_action.lower():
            feature_id = "feat_b1_snippets"
        elif "excel" in raw_action.lower():
            feature_id = "feat_b2_excel_split"
        elif "pdf" in raw_action.lower():
            feature_id = "feat_b3_pdf_merge"
        else:
            feature_id = "feat_1_seq_paste"

    # 유효한 기능 키인지 확인 (없으면 feat_1 기본)
    if feature_id not in SUPERPOWER_12_FEATURES:
        feature_id = "feat_1_seq_paste"

    feature_name = SUPERPOWER_12_FEATURES[feature_id]

    # 1. 구독 회원인 경우 무제한 허용
    if is_subscribed or m_entry.get("isSubscribed"):
        return {
            "ok": True,
            "allowed": True,
            "consumed": False,
            "feature_id": feature_id,
            "feature_name": feature_name,
            "feature_status": "SUBSCRIBED",
            "daily_free_remaining": 9999,
            "message": f"[{feature_name}] 구독 회원 무제한 통과",
        }

    # 2. 해당 기능의 30일 타이머 확인
    ft_ledger = m_entry.setdefault("featureTrials", {})
    entry = ft_ledger.get(feature_id)
    now_ts = time.time()
    now_dt = datetime.datetime.now()

    # Case A: 미개봉 상태인 기능 ➔ 첫 성공 완수 시점부터 30일 무제한 개시! (차감 0)
    if not entry or not entry.get("firstUsedTs"):
        exp_dt = now_dt + datetime.timedelta(days=30)
        ft_ledger[feature_id] = {
            "firstUsedTs": now_ts,
            "firstUsedAt": now_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "expiresAt": exp_dt.strftime("%Y-%m-%d %H:%M:%S"),
        }
        m_entry["lastActionAt"] = now_dt.isoformat()
        m_entry["lastActionType"] = feature_id
        _save_trial_ledger(ledger)
        return {
            "ok": True,
            "allowed": True,
            "consumed": False,
            "feature_id": feature_id,
            "feature_name": feature_name,
            "feature_status": "ACTIVE_30D",
            "days_left": 30,
            "daily_free_remaining": 9999,
            "message": f"🎁 [{feature_name}] 첫 실행 축하드립니다! 앞으로 30일간 무제한 무료로 사용하실 수 있습니다.",
        }

    # Case B: 이미 개봉되었으나 아직 30일 이내인 기능 ➔ 무제한 통과! (차감 0)
    first_ts = float(entry["firstUsedTs"])
    elapsed_days = (now_ts - first_ts) / 86400.0
    rem_days = int(max(0, round(30.0 - elapsed_days + 0.49)))
    if rem_days > 0:
        m_entry["lastActionAt"] = now_dt.isoformat()
        m_entry["lastActionType"] = feature_id
        _save_trial_ledger(ledger)
        return {
            "ok": True,
            "allowed": True,
            "consumed": False,
            "feature_id": feature_id,
            "feature_name": feature_name,
            "feature_status": "ACTIVE_30D",
            "days_left": rem_days,
            "daily_free_remaining": 9999,
            "message": f"🔥 [{feature_name}] 30일 무제한 혜택 적용 중 (잔여 {rem_days}일)",
        }

    # Case C: 30일 무제한이 만료된 기능 ➔ 기기별 오늘 3회 평생 무료 한도에서 차감!
    today_str = datetime.date.today().isoformat()
    daily_usage = m_entry.setdefault("dailyUsage", {})
    used_today = int(daily_usage.get(today_str, 0))

    if used_today >= 3:
        return {
            "ok": False,
            "allowed": False,
            "consumed": False,
            "feature_id": feature_id,
            "feature_name": feature_name,
            "feature_status": "EXPIRED",
            "daily_free_remaining": 0,
            "daily_free_limit": 3,
            "error": "DAILY_LIMIT_EXCEEDED",
            "message": f"오늘의 [{feature_name}] 무료 변환(기기별 일일 3회)이 모두 소진되었습니다. 아직 사용하지 않은 다른 초능력(미개봉 30일 무제한)을 써보시거나, [내 기기 통합(월 3,900원)] 구독 시 평생 무제한으로 사용하실 수 있습니다!",
        }

    # 1회 정상 차감
    used_today += 1
    daily_usage[today_str] = used_today
    m_entry["lastActionAt"] = now_dt.isoformat()
    m_entry["lastActionType"] = feature_id
    _save_trial_ledger(ledger)

    rem = max(0, 3 - used_today)
    return {
        "ok": True,
        "allowed": True,
        "consumed": True,
        "feature_id": feature_id,
        "feature_name": feature_name,
        "feature_status": "EXPIRED_USED",
        "daily_free_remaining": rem,
        "daily_free_limit": 3,
        "message": f"[{feature_name}] 액션 완수 (오늘 잔여 무료: {rem}/3회)",
    }


def open_ghost_search_window_api(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """
    [👻 귀신검색창 로컬 리얼 팝업 직결 API]
    - 로컬 엔진(127.0.0.1:5199)이 연결되어 있을 때 온보딩 수련장이나 웹 화면에서
      Ctrl+0, 우클릭 꾹~, 또는 [👻 내 진짜 파일로 리얼 귀신검색창 바로 띄우기] 호출 시
      가짜 시뮬레이터가 아니라 실제 모니터 위에 프레임리스 독립 팝업(소형 520x380 / 중형 960x640 / 갤러리 1440x900)을 즉시 띄웁니다.
    """
    data = params or {}
    stage = str(data.get("stage") or "medium").strip().lower()
    if stage not in ("small", "medium", "gallery"):
        stage = "medium"
    query = str(data.get("query") or data.get("q") or "").strip()
    anchor_x = data.get("anchor_x") or data.get("x")
    anchor_y = data.get("anchor_y") or data.get("y")
    ax = int(anchor_x) if anchor_x is not None and str(anchor_x).lstrip("-").isdigit() else None
    ay = int(anchor_y) if anchor_y is not None and str(anchor_y).lstrip("-").isdigit() else None

    res = spd._open_ghost_search_window_popup(stage=stage, query=query, anchor_x=ax, anchor_y=ay)
    return {
        "ok": True,
        **res,
        "message": "👻 내 진짜 PC 사진·서류·여권이 연동된 리얼 귀신검색창을 화면에 즉시 띄웠습니다!",
    }
