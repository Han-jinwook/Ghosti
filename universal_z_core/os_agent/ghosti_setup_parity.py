#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[귀신같이 Z-코어] ghosti_setup_parity.py
개발 서버(vite.config.ts)에만 있던 고치기(설정몬스터) 보조 API를 단일 데몬(127.0.0.1:5199)으로 이관합니다.
  - /__setup-monster/state | execute | self-healing-ota | undo | report-failure : 설정몬스터 작업 기록(블랙박스) JSON
  - /__setup-monster/tts | tts-audio | tts-prewarm : 무료 신경망 TTS(현수·선희) 합성·캐시 재생
주의: 이 모듈은 '기록'과 '음성'만 다룹니다. PC 설정을 바꾸는 동작은 하지 않습니다.
"""

from __future__ import annotations

import asyncio
import datetime
import hashlib
import json
import os
import re
import threading
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

LOCAL_APPDATA = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
BLACKBOX_FILE = LOCAL_APPDATA / "Merlin" / "setup_monster_blackbox.json"
_LOCK = threading.RLock()


def _now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _load_box() -> Dict[str, Any]:
    try:
        if BLACKBOX_FILE.exists():
            data = json.loads(BLACKBOX_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return {
                    "auditLogs": list(data.get("auditLogs") or []),
                    "failureTelemetryQueue": list(data.get("failureTelemetryQueue") or []),
                    "selfHealingOtaQueue": list(data.get("selfHealingOtaQueue") or []),
                }
    except Exception:
        pass
    return {"auditLogs": [], "failureTelemetryQueue": [], "selfHealingOtaQueue": []}


def _save_box(box: Dict[str, Any]) -> None:
    BLACKBOX_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = BLACKBOX_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(box, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, BLACKBOX_FILE)


def _box_payload(box: Dict[str, Any], **extra: Any) -> Dict[str, Any]:
    out = {"ok": True, **extra}
    out.update(box)
    return out


def handle_setup_monster(action: str, body: Dict[str, Any] | None) -> Dict[str, Any]:
    data = body or {}
    act = (action or "").strip().lower()
    with _LOCK:
        box = _load_box()
        now = _now_iso()

        if act == "state":
            return _box_payload(box)

        if act == "execute":
            snapshot_src = f"{now}:{data.get('symptomQuery', '')}:{json.dumps(data.get('afterSnapshot') or {}, ensure_ascii=False)}"
            entry = {
                "auditId": data.get("auditId") or f"audit_{int(datetime.datetime.now().timestamp() * 1000)}",
                "createdAt": now,
                "userApprovedAt": data.get("userApprovedAt") or now,
                "platform": data.get("platform") or "pc",
                "track": data.get("track") or "TRACK_A_DIRECT_REPAIR",
                "difficultyLevel": data.get("difficultyLevel") or "LEVEL_1_SIMPLE_100",
                "escrowStatus": data.get("escrowStatus") or "ESCROW_HOLDING",
                "backtrackCount": data.get("backtrackCount") if isinstance(data.get("backtrackCount"), int) else 0,
                "trajectoryGrade": data.get("trajectoryGrade") or "GRADE_0_EXPRESS",
                "symptomQuery": data.get("symptomQuery") or "",
                "title": data.get("title") or "Ghosti 설정 몬스터",
                "agentModuleName": data.get("agentModuleName") or "Merlin_Z_Core",
                "systemCommandOrApi": data.get("systemCommandOrApi") or "",
                "beforeSnapshot": data.get("beforeSnapshot") or {},
                "afterSnapshot": data.get("afterSnapshot") or {},
                "creditDeducted": 0,
                "domCaptureHash": data.get("domCaptureHash") or hashlib.sha256(snapshot_src.encode("utf-8")).hexdigest()[:16],
                "conversationSummary": data.get("conversationSummary") if isinstance(data.get("conversationSummary"), list) else [],
                "undone": False,
                "refunded": bool(data.get("refunded")),
                "refundedAt": data.get("refundedAt"),
            }
            box["auditLogs"].insert(0, entry)
            if data.get("selfHealingOta"):
                box["selfHealingOtaQueue"].insert(0, data["selfHealingOta"])
            box["auditLogs"] = box["auditLogs"][:300]
            _save_box(box)
            return _box_payload(box, auditEntry=entry)

        if act == "self-healing-ota":
            target = data.get("auditId")
            if data.get("otaEntry"):
                box["selfHealingOtaQueue"].insert(0, data["otaEntry"])
            for e in box["auditLogs"]:
                if target and e.get("auditId") == target:
                    if isinstance(data.get("backtrackCount"), int):
                        e["backtrackCount"] = data["backtrackCount"]
                    e["trajectoryGrade"] = data.get("trajectoryGrade") or e.get("trajectoryGrade")
                    e["escrowStatus"] = data.get("escrowStatus") or e.get("escrowStatus")
                    if isinstance(data.get("refunded"), bool):
                        e["refunded"] = data["refunded"]
                        if data["refunded"]:
                            e["refundedAt"] = now
            _save_box(box)
            return _box_payload(box, otaEntry=data.get("otaEntry"))

        if act in ("undo", "report-failure"):
            target = data.get("auditId")
            hit: Optional[Dict[str, Any]] = None
            for e in box["auditLogs"]:
                if (target and e.get("auditId") == target) or (not target and hit is None and not e.get("undone")):
                    e["undone"] = True
                    e["undoneAt"] = now
                    if act == "report-failure":
                        e["refunded"] = True
                        e["refundedAt"] = now
                        e["failureErrorCode"] = data.get("errorCode") or "ERR_USER_REPORTED_UNRESOLVED"
                    hit = e
                    if target:
                        break
            if act == "report-failure" and hit is not None:
                box["failureTelemetryQueue"].insert(
                    0,
                    {
                        "auditId": hit.get("auditId"),
                        "reportedAt": now,
                        "symptomQuery": hit.get("symptomQuery"),
                        "errorCode": hit.get("failureErrorCode"),
                    },
                )
            _save_box(box)
            key = "restoredEntry" if act == "undo" else "targetEntry"
            return _box_payload(box, **{key: hit})

    return {"ok": False, "error": f"UNKNOWN_SETUP_MONSTER_ACTION: {act}"}


# ---------------------------------------------------------------------------
# TTS (merlin_tts_engine 직접 호출 — 셸 실행 없음)
# ---------------------------------------------------------------------------

_TTS_LOCKS: Dict[str, threading.Lock] = {}
_TTS_LOCKS_GUARD = threading.Lock()


def _voice_from(raw: Any) -> str:
    v = str(raw or "ko-KR-HyunsuNeural").lower()
    return "ko-KR-SunHiNeural" if ("sunhi" in v or "female" in v or "doc" in v) else "ko-KR-HyunsuNeural"


def _rate_from(raw: Any) -> str:
    r = str(raw or "+0%").strip()
    return r if re.match(r"^[+-]\d{1,3}%$", r) else "+0%"


def tts_speak(body: Dict[str, Any] | None) -> Dict[str, Any]:
    import merlin_tts_engine as tts

    data = body or {}
    text = re.sub(r"\s+", " ", str(data.get("text") or "")).strip()[:2000]
    if not text:
        return {"ok": False, "error": "EMPTY_TEXT"}
    voice = _voice_from(data.get("voice"))
    rate = _rate_from(data.get("rate"))
    key = tts.compute_tts_hash(tts.normalize_text(text), tts.resolve_voice_id(voice), rate)
    with _TTS_LOCKS_GUARD:
        lock = _TTS_LOCKS.setdefault(key, threading.Lock())
    with lock:
        try:
            return asyncio.run(tts.synthesize_one(text, voice=voice, rate=rate))
        except Exception as e:
            return {"ok": False, "cacheStatus": "ERROR", "error": str(e)}


def tts_audio(hash_value: str) -> Tuple[Optional[bytes], int]:
    import merlin_tts_engine as tts

    h = re.sub(r"[^a-f0-9]", "", str(hash_value or "").lower())
    if not h:
        return None, 404
    p = tts.TTS_CACHE_DIR / f"{h}.mp3"
    if not p.exists():
        return None, 404
    try:
        return p.read_bytes(), 200
    except Exception:
        return None, 500


def tts_prewarm(body: Dict[str, Any] | None) -> Dict[str, Any]:
    data = body or {}
    voice = _voice_from(data.get("voice"))
    rate = _rate_from(data.get("rate"))

    def _run() -> None:
        try:
            import merlin_tts_engine as tts

            asyncio.run(tts.prewarm_all(voice=voice, rate=rate))
        except Exception:
            pass

    threading.Thread(target=_run, daemon=True).start()
    return {"ok": True, "status": "PREWARM_QUEUED", "voice": voice, "rate": rate}
