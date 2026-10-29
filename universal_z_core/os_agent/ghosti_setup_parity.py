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


# ---------------------------------------------------------------------------
# 로컬 서류·영상 검색 & 자율 얼굴 여권 인덱스 (단일 데몬 5199 직접 응답)
# ---------------------------------------------------------------------------

FACE_REGISTRY_FILE = LOCAL_APPDATA / "Merlin" / "ghosti_face_clusters.json"
_STOP_WORDS_KO = {
    "찾아줘", "보여줘", "사진", "문서", "파일", "서류", "서류함", "영상", "동영상", "장면", "모습", "및", "사본",
}
_PARTICLE_TAIL_RE = re.compile(
    r"(에서부터|으로부터|에게서|에서|에게|으로|이랑|하고|부터|까지|있는|하는|찍는|들을|들|의|을|를|은|는|에|와|과|도|이|가|로|만)$"
)


def _tokenize_ko_query(q: str) -> list[str]:
    cleaned = re.sub(r"[.,!?'\"“”‘’()\[\]{}]", " ", (q or "").lower())
    out: list[str] = []
    for raw in cleaned.split():
        if raw in _STOP_WORDS_KO:
            continue
        stem = _PARTICLE_TAIL_RE.sub("", raw)
        tok = stem if len(stem) >= 1 else raw
        if tok and tok not in _STOP_WORDS_KO:
            out.append(tok)
    return out


def docs_search(body: Dict[str, Any] | None) -> Dict[str, Any]:
    import plugin_ghosti_os

    q = str((body or {}).get("query") or "").strip()
    listed = plugin_ghosti_os.list_local_docs({})
    docs = list(listed.get("documents") or [])
    if not q or "최근 서류" in q:
        return {"ok": True, "documents": docs}

    tokens = _tokenize_ko_query(q)
    if not tokens:
        return {"ok": True, "documents": docs}

    req_hits = len(tokens) if len(tokens) <= 2 else max(2, int((len(tokens) * 0.6) + 0.999))
    scored: list[tuple[int, Dict[str, Any]]] = []
    for d in docs:
        kws = " ".join(str(x) for x in (d.get("keywords") or []))
        corpus = f"{d.get('fileName', '')} {d.get('title', '')} {d.get('categoryBadge', '')} {d.get('extractedText', '')} {kws}".lower()
        corpus_nospace = re.sub(r"\s+", "", corpus)
        hits = 0
        for tk in tokens:
            if tk in corpus or (len(tk) >= 2 and tk in corpus_nospace):
                hits += 1
        if hits >= req_hits:
            scored.append((hits, d))

    scored.sort(key=lambda x: x[0], reverse=True)
    return {"ok": True, "documents": [d for _, d in scored]}


def videos_search(body: Dict[str, Any] | None) -> Dict[str, Any]:
    import plugin_ghosti_os

    q = str((body or {}).get("query") or "").strip()
    listed = plugin_ghosti_os.list_local_videos({})
    videos = list(listed.get("videos") or [])
    if not q or "전 구간" in q:
        return {"ok": True, "videos": videos}

    tokens = _tokenize_ko_query(q)
    if not tokens:
        return {"ok": True, "videos": videos}

    req_hits = len(tokens) if len(tokens) <= 2 else max(2, int((len(tokens) * 0.6) + 0.999))
    scored: list[tuple[int, Dict[str, Any]]] = []
    for v in videos:
        vkws = " ".join(str(x) for x in (v.get("keywords") or []))
        vbase = f"{v.get('title', '')} {v.get('summaryCaption', '')} {v.get('locationTag', '')} {vkws}".lower()
        frames = list(v.get("timelineFrames") or [])
        best_frame = frames[0] if frames else None
        best_frame_hits = 0
        for fr in frames:
            fkws = " ".join(str(x) for x in (fr.get("keywords") or []))
            fcorpus = f"{fr.get('sceneCaption', '')} {fkws}".lower()
            fhits = sum(1 for tk in tokens if tk in fcorpus)
            if fhits > best_frame_hits:
                best_frame_hits = fhits
                best_frame = fr
        full_corpus = vbase + " " + " ".join(
            f"{fr.get('sceneCaption', '')} {' '.join(str(x) for x in (fr.get('keywords') or []))}".lower()
            for fr in frames
        )
        matched_tokens = sum(1 for tk in tokens if tk in full_corpus)
        if matched_tokens >= req_hits:
            vid_out = dict(v)
            if best_frame and best_frame_hits > 0:
                vid_out["matchedSeekSec"] = best_frame.get("timeSec", 0)
                vid_out["matchedTimestamp"] = f"🎯 {best_frame.get('timestampText', '00:00')} 구간 포착"
                vid_out["matchedFrameCaption"] = best_frame.get("sceneCaption", "")
            scored.append((matched_tokens * 5 + best_frame_hits * 3, vid_out))

    scored.sort(key=lambda x: x[0], reverse=True)
    return {"ok": True, "videos": [v for _, v in scored]}


def _load_face_clusters() -> Dict[str, Any]:
    candidates = [FACE_REGISTRY_FILE]
    if not getattr(os.sys, "frozen", False):
        repo_root = Path(__file__).resolve().parents[2]
        candidates.append(repo_root / "poc" / "results" / "face_clusters_index.json")
        candidates.append(repo_root / "public" / "poc" / "results" / "face_clusters_index.json")
    for p in candidates:
        try:
            if p.exists():
                raw = json.loads(p.read_text(encoding="utf-8"))
                if isinstance(raw, dict) and isinstance(raw.get("clusters"), list):
                    return {
                        "latestCorpusYear": int(raw.get("latestCorpusYear") or 2026),
                        "clusters": list(raw.get("clusters") or []),
                    }
        except Exception:
            pass
    return {"latestCorpusYear": 2026, "clusters": []}


def _strip_face_vecs(clusters: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
    out: list[Dict[str, Any]] = []
    for c in clusters:
        item = dict(c)
        seed_vec = item.pop("seedVec", None)
        item["seedVecPreview"] = seed_vec[:8] if isinstance(seed_vec, list) else []
        out.append(item)
    return out


def faces_index() -> Dict[str, Any]:
    with _LOCK:
        data = _load_face_clusters()
        clusters = _strip_face_vecs(data["clusters"])
        return {
            "ok": True,
            "latestCorpusYear": data["latestCorpusYear"],
            "clusterCount": len(clusters),
            "clusters": clusters,
        }


def faces_register(body: Dict[str, Any] | None) -> Dict[str, Any]:
    payload = body or {}
    with _LOCK:
        data = _load_face_clusters()
        clusters = data["clusters"]
        action = str(payload.get("action") or "update").strip()
        if action == "restore_excluded":
            for c in clusters:
                c["excludedAsPasserby"] = False
        else:
            cid = str(payload.get("clusterId") or "").strip()
            for c in clusters:
                if c.get("clusterId") == cid:
                    if isinstance(payload.get("registeredName"), str):
                        c["registeredName"] = payload["registeredName"].strip()
                    if isinstance(payload.get("relationshipTag"), str):
                        c["relationshipTag"] = payload["relationshipTag"].strip()
                    if isinstance(payload.get("excludedAsPasserby"), bool):
                        c["excludedAsPasserby"] = payload["excludedAsPasserby"]
                    break
        FACE_REGISTRY_FILE.parent.mkdir(parents=True, exist_ok=True)
        FACE_REGISTRY_FILE.write_text(
            json.dumps(
                {
                    "createdAt": _now_iso(),
                    "latestCorpusYear": data["latestCorpusYear"],
                    "clusterCount": len(clusters),
                    "clusters": clusters,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        return {
            "ok": True,
            "latestCorpusYear": data["latestCorpusYear"],
            "clusters": _strip_face_vecs(clusters),
        }
