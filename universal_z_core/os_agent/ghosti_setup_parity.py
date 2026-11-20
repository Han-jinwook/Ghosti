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
    "돌리는", "돌아가는", "나오는", "보이는", "찍은", "찍는", "촬영", "화면", "구간", "순간", "부분", "전구간",
    "타임라인", "해부", "속에서", "속에", "있는", "하는",
}
_PROTECTED_KO_NOUNS = {
    "아이", "어린이", "고양이", "멍멍이", "길냥이", "호랑이", "부엉이", "원숭이", "거북이", "떡볶이",
    "강아지", "송아지", "망아지", "강냉이", "달팽이", "지렁이", "올챙이", "코끼리", "너구리", "개구리",
    "오이", "종이", "놀이", "높이", "길이", "넓이", "깊이", "나이", "차이", "사이",
    "바닷가", "창가", "물가", "길가", "강가", "화가", "작가", "국가", "상가", "단가", "원가", "휴가",
    "목걸이", "귀걸이", "물놀이", "나들이", "비행기", "세탁기", "선풍기", "청소기",
    "종로", "을지로", "퇴계로", "대학로", "세종대로", "테헤란로",
    "제주도", "강원도", "경기도", "충청도", "전라도", "경상도", "울릉도", "독도", "여의도", "영종도", "송도",
    "포도", "지도", "속도", "온도", "각도", "세금계산서", "사업자등록증",
}
_PROTECTED_NOUN_SUFFIX_RE = re.compile(
    r"(양이|아지|멍이|랑이|엉이|숭이|북이|끼리|팽이|구리|오리|거미|개미|매미|나비|오이|종이|놀이|걸이|볶이|구이|어린이|할머니|어머니|아버지|높이|길이|넓이|깊이|닷가|창가|물가|길가|강가|화가|작가|국가|상가|단가|원가|휴가|제주도|강원도|경기도|충청도|전라도|경상도|울릉도|독도|여의도|영종도|송도|종로|을지로|퇴계로|대학로|대로|[가-힣]{1,4}(?:시|군|구))$"
)
_MULTI_PARTICLE_TAIL_RE = re.compile(
    r"(?:들)?(에서부터|으로부터|에게서|속에서|에서|에게|으로|이랑|하고|부터|까지|처럼|보다|마다|대로|밖에|마저|조차|이나|이란|이고|이며|있는|하는|찍는)$"
)
_SINGLE_PARTICLE_TAIL_RE = re.compile(
    r"(들|의|을|를|은|는|에|와|과|도|이|가|로|만|랑|나)$"
)
_ASCII_TOKEN_RE = re.compile(r"^[a-z0-9]+$")
_FALSE_FRIEND_BLOCK_MAP = {
    "고양이": re.compile(r"고양시"),
    "고양": re.compile(r"고양시"),
    "아이": re.compile(r"아이콘|아이폰|아이패드|아이디|아이템|아이디어|아이스|아이언|아이라인|아이섀도"),
    "튜브": re.compile(r"유튜브"),
    "다리": re.compile(r"사다리|기다리|다리미"),
    "고기": re.compile(r"물고기"),
    "배": re.compile(r"택배|배달|배경|배터리|배구|배추|담배|선배|후배"),
    "말": re.compile(r"말레이시아|말씀|주말|연말|결말|양말|단말"),
    "개": re.compile(r"개인|개월|개발|개봉|개선|개설|개시|개수|개념|개요|개최|공개|번개|안개|조개|베개|날개|덮개|지우개"),
}


def _is_protected_ko_noun(w: str) -> bool:
    return bool(w) and (w in _PROTECTED_KO_NOUNS or bool(_PROTECTED_NOUN_SUFFIX_RE.search(w)))


def _expand_camel_and_alnum(raw: str) -> str:
    s = re.sub(r"([a-z])([A-Z])", r"\1 \2", raw)
    s = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1 \2", s)
    s = re.sub(r"([a-zA-Z])([0-9])", r"\1 \2", s)
    s = re.sub(r"([0-9])([a-zA-Z])", r"\1 \2", s)
    s = re.sub(r"([가-힣])([a-zA-Z0-9])", r"\1 \2", s)
    s = re.sub(r"([a-zA-Z0-9])([가-힣])", r"\1 \2", s)
    return f"{raw} {s}"


def _match_query_token(
    tk: str,
    corpus: str,
    corpus_nospace: str = "",
    *,
    allow_filename_substring: bool = False,
) -> bool:
    """영문/숫자 내부 부분문자열('ai'≠'main') 및 한국어 지명·합성어 착시('고양이'≠'고양시', '튜브'≠'유튜브', '아이'≠'아이콘')를 원천 차단합니다."""
    if not tk:
        return False
    if _ASCII_TOKEN_RE.match(tk):
        if re.search(rf"(?<![a-z0-9]){re.escape(tk)}(?![a-z0-9])", corpus):
            return True
        if allow_filename_substring and len(tk) >= 3 and tk in corpus:
            return True
        if len(tk) >= 4:
            for w in re.findall(r"[a-z0-9]+", corpus):
                if w.startswith(tk) or w.endswith(tk):
                    return True
        return False
    block_rx = _FALSE_FRIEND_BLOCK_MAP.get(tk)
    target_corpus = block_rx.sub(" ", corpus) if block_rx else corpus
    if len(tk) == 1:
        return bool(re.search(rf"(?<![가-힣]){re.escape(tk)}(?=(?:이|가|은|는|을|를|의|에|와|과|도|만|들|\s|$))", target_corpus))
    if len(tk) == 2:
        # 2음절 어간이 행정구역 접미사('고양'+'시')에 붙는 오탐 차단
        if re.search(rf"{re.escape(tk)}(?![시군구동읍면리역콘폰템드])", target_corpus):
            return True
        return False
    if tk in target_corpus:
        return True
    if corpus_nospace:
        target_ns = block_rx.sub("", corpus_nospace) if block_rx else corpus_nospace
        if tk in target_ns:
            return True
    return False


def _tokenize_ko_query(q: str) -> list[str]:
    cleaned = re.sub(r"[.,!?'\"“”‘’()\[\]{}]", " ", (q or "").lower())
    candidates = [w for w in cleaned.split() if w and w not in _STOP_WORDS_KO]
    is_single_word = len(candidates) == 1
    out: list[str] = []
    for raw in candidates:
        if _is_protected_ko_noun(raw):
            out.append(raw)
            continue
        cur = raw
        m_multi = _MULTI_PARTICLE_TAIL_RE.sub("", cur)
        if m_multi != cur and len(m_multi) >= 1:
            cur = m_multi
        if not is_single_word and len(cur) >= 3 and not _is_protected_ko_noun(cur):
            m_single = _SINGLE_PARTICLE_TAIL_RE.sub("", cur)
            if m_single != cur and len(m_single) >= 2:
                cur = m_single
        if cur and cur not in _STOP_WORDS_KO:
            out.append(cur)
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
    scored: list[tuple[int, int, Dict[str, Any]]] = []
    for d in docs:
        raw_fname = str(d.get("fileName") or "")
        fname_stem = Path(raw_fname).stem if raw_fname else ""
        fname_corpus = _expand_camel_and_alnum(f"{fname_stem} {d.get('title', '')}").lower()
        kws = " ".join(str(x) for x in (d.get("keywords") or []))
        corpus = _expand_camel_and_alnum(
            f"{raw_fname} {d.get('title', '')} {d.get('categoryBadge', '')} {d.get('extractedText', '')} {kws}"
        ).lower()
        corpus_nospace = re.sub(r"\s+", "", corpus)
        hits = 0
        fname_hits = 0
        for tk in tokens:
            if _match_query_token(tk, fname_corpus, allow_filename_substring=True):
                hits += 1
                fname_hits += 1
            elif _match_query_token(tk, corpus, corpus_nospace):
                hits += 1
        if hits >= req_hits:
            scored.append((hits, fname_hits, d))

    scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return {"ok": True, "documents": [d for _, _, d in scored]}


def _load_static_json(filename: str) -> Dict[str, Any] | None:
    candidates = []
    if not getattr(os.sys, 'frozen', False):
        repo_root = Path(__file__).resolve().parents[2]
        candidates.append(repo_root / 'poc' / 'results' / filename)
        candidates.append(repo_root / 'public' / 'poc' / 'results' / filename)
        candidates.append(Path(__file__).resolve().parent / filename)
    for cand in candidates:
        try:
            if cand.exists():
                return json.loads(cand.read_text(encoding='utf-8'))
        except Exception:
            pass
    return None

def videos_search(body: Dict[str, Any] | None) -> Dict[str, Any]:
    import plugin_ghosti_os

    q = str((body or {}).get("query") or "").strip()
    if q and "전 구간" not in q and hasattr(plugin_ghosti_os, "ensure_local_videos_ocr_indexed"):
        plugin_ghosti_os.ensure_local_videos_ocr_indexed(sync_wait_sec=0.25)

    listed = plugin_ghosti_os.list_local_videos({})
    videos = [v for v in (listed.get("videos") or []) if not v.get("isAllBlack")]
    if not q or "전 구간" in q:
        return {"ok": True, "videos": videos}

    tokens = _tokenize_ko_query(q)
    if not tokens:
        return {"ok": True, "videos": videos}

    req_hits = len(tokens) if len(tokens) <= 2 else max(2, int((len(tokens) * 0.67) + 0.999))
    scored: list[tuple[int, Dict[str, Any]]] = []
    for v in videos:
        if v.get("isAllBlack"):
            continue
        vkws = " ".join(str(x) for x in (v.get("keywords") or []))
        vbase = f"{v.get('title', '')} {v.get('sceneDescription', '')} {v.get('summaryCaption', '')} {v.get('locationKo', '')} {v.get('locationTag', '')} {vkws}".lower()
        frames = list(v.get("timelineFrames") or [])
        best_frame = frames[0] if frames else None
        best_frame_hits = 0
        opening_frame_hits = 0
        for fr in frames:
            fkws = " ".join(str(x) for x in (fr.get("keywords") or []))
            fcorpus = f"{fr.get('sceneCaption', '')} {fkws}".lower()
            fcorpus_ns = re.sub(r"\s+", "", fcorpus)
            fhits = sum(1 for tk in tokens if _match_query_token(tk, fcorpus, fcorpus_ns))
            if int(fr.get("timeSec") or 0) <= 2 and fhits > opening_frame_hits:
                opening_frame_hits = fhits
            if fhits > best_frame_hits:
                best_frame_hits = fhits
                best_frame = fr
        full_corpus = vbase + " " + " ".join(
            f"{fr.get('sceneCaption', '')} {' '.join(str(x) for x in (fr.get('keywords') or []))}".lower()
            for fr in frames
        )
        full_corpus_ns = re.sub(r"\s+", "", full_corpus)
        matched_tokens = sum(1 for tk in tokens if _match_query_token(tk, full_corpus, full_corpus_ns))
        if matched_tokens >= req_hits:
            vid_out = dict(v)
            if best_frame and best_frame_hits > 0:
                raw_seek = int(best_frame.get("timeSec") or 0)
                # 도입부(0~2초)부터 동일한 장면/글자가 등장하면 앞부분 생략 없이 00:00 처음부터 전 구간 재생
                is_whole_or_opening = raw_seek <= 2 or (opening_frame_hits >= best_frame_hits and opening_frame_hits > 0)
                seek_sec = 0 if is_whole_or_opening else raw_seek
                vid_out["matchedSeekSec"] = seek_sec
                raw_ts = "00:00" if seek_sec == 0 else (str(best_frame.get("timestampText") or "00:00"))
                vid_out["matchedTimestamp"] = raw_ts.replace("🎯", "").replace("구간 포착", "").replace("장면 포착", "").strip() or "00:00"
                vid_out["matchedFrameCaption"] = (
                    f"[00:00~{vid_out.get('durationText', '')} 전 구간] 영상 처음부터 “{q}” 장면·내용이 이어져 00:00부터 재생합니다."
                    if seek_sec == 0
                    else best_frame.get("sceneCaption", "")
                )
                if best_frame.get("thumbUrl"):
                    vid_out["thumbUrl"] = best_frame["thumbUrl"]
            else:
                vid_out["matchedSeekSec"] = 0
                vid_out["matchedTimestamp"] = "00:00"
            scored.append((matched_tokens * 5 + best_frame_hits * 3, vid_out))

    scored.sort(key=lambda x: x[0], reverse=True)
    return {"ok": True, "videos": [v for _, v in scored]}


def _load_face_clusters() -> Dict[str, Any]:
    candidates = [FACE_REGISTRY_FILE]
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
