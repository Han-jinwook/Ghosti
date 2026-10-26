#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[내장 소프트웨어 플러그인 3] plugin_aggrofilter.py
- 어그로필터(AggroFilter) 유튜브 자막 추출 및 낚시성/어그로 판독 내장 소프트웨어 플러그인
- 크롬 확장팩(Chrome Extension) 0%! 모바일 접근성 화면 해킹(Accessibility Scraping) 0%!
- 작동 원리 (PC & 모바일 스토어 심사 100% 프리패스 정공법):
  1. PC 웹 또는 모바일 OS 표준 공유 시트([공유 📤 ➔ 어그로필터], ACTION_SEND)로 전달된 유튜브 URL에서 videoId 추출
  2. 서버 IP(AWS/GCP 등 유튜브 차단 대상)가 아닌 유저 본인의 로컬 기기 IP(가정용/LTE/5G)로
     유튜브 공개 자막 트랙(captionTracks / TimedText)을 직접 가져와 파싱합니다.
"""

from __future__ import annotations

import html
import json
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from typing import Any, Dict, List

PLUGIN_METADATA = {
    "pluginId": "aggrofilter",
    "pluginName": "AggroFilter Local-IP YouTube Caption & Clickbait Plugin",
    "version": "2.1.0",
    "type": "BUILTIN_SOFTWARE_PLUGIN",
    "port": 5199,
    "basePath": "/api/aggrofilter",
    "chromeExtensionRequired": False,
    "mobileStoreCompliant": True,
    "mobileIngestionMode": "OS_STANDARD_SHARE_SHEET_AND_LOCAL_RESIDENTIAL_IP",
}

YOUTUBE_ID_PATTERNS = [
    r"(?:v=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})",
    r"^([A-Za-z0-9_-]{11})$",
]


def extract_video_id(url_or_text: str) -> str | None:
    raw = (url_or_text or "").strip()
    if not raw:
        return None
    for pat in YOUTUBE_ID_PATTERNS:
        m = re.search(pat, raw)
        if m:
            return m.group(1)
    return None


def _http_get_text(url: str, timeout: float = 8.0) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _parse_timedtext_xml(xml_text: str) -> List[Dict[str, Any]]:
    """
    timedtext XML 파서 (2가지 포맷 모두 지원)
    - 구형 format 1: <transcript><text start="초" dur="초">...</text></transcript>
    - 신형 srv3   : <timedtext format="3"><body><p t="ms" d="ms"><s>..</s></p></body></timedtext>
    """
    segments: List[Dict[str, Any]] = []
    try:
        root = ET.fromstring(xml_text)
        for node in root.iter():
            if node.tag == "text":
                start = float(node.attrib.get("start", "0") or 0.0)
                dur = float(node.attrib.get("dur", "0") or 0.0)
            elif node.tag == "p":
                start = float(node.attrib.get("t", "0") or 0.0) / 1000.0
                dur = float(node.attrib.get("d", "0") or 0.0) / 1000.0
            else:
                continue
            txt = html.unescape("".join(node.itertext())).replace("\n", " ").strip()
            if txt:
                segments.append(
                    {
                        "startSec": round(start, 2),
                        "durationSec": round(dur, 2),
                        "text": txt,
                    }
                )
    except Exception:
        pass
    return segments


def _parse_json3_captions(raw_json: str) -> List[Dict[str, Any]]:
    segments: List[Dict[str, Any]] = []
    try:
        data = json.loads(raw_json)
        for ev in data.get("events", []):
            segs = ev.get("segs")
            if not segs:
                continue
            txt = "".join(str(s.get("utf8", "")) for s in segs).replace("\n", " ").strip()
            if not txt:
                continue
            start_ms = float(ev.get("tStartMs", 0) or 0)
            dur_ms = float(ev.get("dDurationMs", 0) or 0)
            segments.append(
                {
                    "startSec": round(start_ms / 1000.0, 2),
                    "durationSec": round(dur_ms / 1000.0, 2),
                    "text": txt,
                }
            )
    except Exception:
        pass
    return segments


INNERTUBE_ANDROID_CLIENT = {"clientName": "ANDROID", "clientVersion": "20.10.38"}


def _http_post_json(url: str, payload: Dict[str, Any], timeout: float = 8.0) -> Dict[str, Any]:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


def _pick_track(tracks: List[Dict[str, Any]], langs: List[str]) -> Dict[str, Any] | None:
    """선호 언어 순서대로, 같은 언어면 수동 자막(kind != asr)을 자동 생성 자막보다 우선."""
    for lang in langs:
        same = [t for t in tracks if str(t.get("languageCode", "")).startswith(lang)]
        if same:
            manual = [t for t in same if t.get("kind") != "asr"]
            return (manual or same)[0]
    return tracks[0] if tracks else None


def _download_track_segments(base_url: str) -> List[Dict[str, Any]]:
    """트랙 URL에서 자막 본문을 받아 파싱 (srv3/format1 XML → 실패 시 json3)."""
    clean = re.sub(r"&fmt=[^&]*", "", base_url)
    segments = _parse_timedtext_xml(_http_get_text(clean, timeout=8.0))
    if not segments:
        sep = "&" if "?" in clean else "?"
        segments = _parse_json3_captions(_http_get_text(f"{clean}{sep}fmt=json3", timeout=8.0))
    return segments


def fetch_youtube_captions_via_local_ip(url_or_shared_text: str, preferred_langs: List[str] | None = None) -> Dict[str, Any]:
    """
    유저 기기(PC/모바일)의 로컬 IP로 유튜브 영상 메타데이터와 자막 트랙(TimedText)을 직접 추출합니다.
    (크롬 확장팩 불필요, 서버 IP 차단 원천 우회)

    [2026-10-27 수정 — 비서실 실측 '침묵 성공' 버그 해결]
    - 원인: 2025년 이후 유튜브는 watch 페이지(WEB 클라이언트)에 박힌 captionTracks.baseUrl에
      PO 토큰을 요구하여, 그대로 호출하면 HTTP 200 + 본문 0바이트를 반환 → segments 0건인데 ok:true.
    - 1차 경로: InnerTube player API(ANDROID 클라이언트)로 트랙 목록을 받아 본문 다운로드
      (실측 4/4 영상 정상: dQw4w9WgXcQ 61줄 · jNQXAC9IVRw 6줄 · arj7oStGLkU 305줄 · IHNzOHi8sJs 62줄).
    - 2차 경로: 기존 watch 페이지 파싱 (향후 유튜브 정책 변화 대비 폴백).
    - 자막 0건이면 반드시 ok:false + reason 반환 (정직한 실패).
    """
    t0 = time.perf_counter()
    vid = extract_video_id(url_or_shared_text)
    if not vid:
        return {
            "ok": False,
            "error": "INVALID_YOUTUBE_URL",
            "reason": "유효한 유튜브 링크를 찾지 못했습니다.",
            "message": "유효한 유튜브 링크(watch?v=, youtu.be/, shorts/)를 찾지 못했습니다.",
        }

    langs = preferred_langs or ["ko", "en", "ja"]
    title, author = "", ""
    tracks: List[Dict[str, Any]] = []
    attempts: List[str] = []
    segments: List[Dict[str, Any]] = []
    selected_lang = ""
    selected_kind = ""
    fetched_via = ""

    # ── 1차: InnerTube ANDROID player ──
    page_html = ""
    try:
        page_html = _http_get_text(f"https://www.youtube.com/watch?v={vid}&hl=ko", timeout=8.0)
    except Exception as e:
        attempts.append(f"watch_page_fetch_failed:{e}")
    key_m = re.search(r'"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"', page_html)
    player_url = "https://www.youtube.com/youtubei/v1/player" + (f"?key={key_m.group(1)}" if key_m else "")
    try:
        pj = _http_post_json(
            player_url,
            {"context": {"client": INNERTUBE_ANDROID_CLIENT}, "videoId": vid},
        )
        details = pj.get("videoDetails") or {}
        title = str(details.get("title") or "")
        author = str(details.get("author") or "")
        status = (pj.get("playabilityStatus") or {}).get("status")
        tracks = (
            (pj.get("captions") or {})
            .get("playerCaptionsTracklistRenderer", {})
            .get("captionTracks", [])
        ) or []
        attempts.append(f"innertube_android:status={status},tracks={len(tracks)}")
        tr = _pick_track(tracks, langs)
        if tr and tr.get("baseUrl"):
            segments = _download_track_segments(str(tr["baseUrl"]))
            selected_lang = str(tr.get("languageCode", ""))
            selected_kind = "auto" if tr.get("kind") == "asr" else "manual"
            fetched_via = "INNERTUBE_ANDROID"
            attempts.append(f"innertube_android_segments={len(segments)}")
    except Exception as e:
        attempts.append(f"innertube_android_failed:{e}")

    # ── 2차 폴백: watch 페이지 captionTracks ──
    if not segments and page_html:
        if not title:
            tm = re.search(r'"title":"([^"]+)"', page_html)
            am = re.search(r'"author":"([^"]+)"', page_html)
            title = tm.group(1) if tm else ""
            author = am.group(1) if am else ""
        m_tracks = re.search(r'"captionTracks":(\[.*?\]),"audioTracks"', page_html) or re.search(
            r'"captionTracks":(\[.*?\])', page_html
        )
        web_tracks: List[Dict[str, Any]] = []
        if m_tracks:
            try:
                web_tracks = json.loads(m_tracks.group(1))
            except Exception:
                web_tracks = []
        if not tracks:
            tracks = web_tracks
        tr = _pick_track(web_tracks, langs)
        if tr and tr.get("baseUrl"):
            try:
                segments = _download_track_segments(str(tr["baseUrl"]))
                selected_lang = str(tr.get("languageCode", ""))
                selected_kind = "auto" if tr.get("kind") == "asr" else "manual"
                fetched_via = "WEB_WATCH_PAGE"
            except Exception as e:
                attempts.append(f"web_track_failed:{e}")
        attempts.append(f"web_watch_page:tracks={len(web_tracks)},segments={len(segments)}")

    elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
    available = [t.get("languageCode", "") for t in tracks]

    if not segments:
        return {
            "ok": False,
            "plugin": "aggrofilter",
            "port": 5199,
            "videoId": vid,
            "title": title,
            "channelName": author,
            "availableLanguages": available,
            "segmentCount": 0,
            "error": "NO_CAPTIONS" if not tracks else "CAPTION_DOWNLOAD_EMPTY",
            "reason": "자막 데이터 없음 또는 추출 실패",
            "attempts": attempts,
            "elapsedMs": elapsed_ms,
        }

    full_text = " ".join(s["text"] for s in segments)
    return {
        "ok": True,
        "plugin": "aggrofilter",
        "port": 5199,
        "videoId": vid,
        "title": title,
        "channelName": author,
        "selectedLanguage": selected_lang,
        "selectedKind": selected_kind,
        "availableLanguages": available,
        "segmentCount": len(segments),
        "segments": segments[:300],
        "fullTranscript": full_text[:15000],
        "elapsedMs": elapsed_ms,
        "chromeExtensionUsed": False,
        "fetchedVia": "USER_LOCAL_RESIDENTIAL_OR_MOBILE_IP",
        "captionSource": fetched_via,
        "attempts": attempts,
    }


def _normalize_sub(subpath: str, default: str) -> str:
    """'/v1/extract-subtitles' 같은 버전·별칭 경로를 표준 액션명으로 정규화 (비서실 실측 경로 호환)."""
    sub = (subpath or default).strip("/").lower()
    if sub.startswith("v1/"):
        sub = sub[3:]
    if sub in ("extract-subtitles", "subtitles"):
        sub = "extract"
    return sub or default


def handle_get(subpath: str, query_params: Dict[str, str] | None = None) -> Dict[str, Any]:
    sub = _normalize_sub(subpath, "health")
    qp = query_params or {}
    if sub in ("", "health", "status"):
        return {
            "ok": True,
            "service": "Merlin_Z_Core_AggroFilter_Plugin",
            "plugin": PLUGIN_METADATA,
        }
    if sub in ("captions", "transcript", "extract"):
        url = qp.get("url") or qp.get("v") or qp.get("text") or ""
        return fetch_youtube_captions_via_local_ip(url)
    return {"ok": False, "error": f"Unknown GET endpoint: /api/aggrofilter/{sub}"}


def handle_post(subpath: str, data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    sub = _normalize_sub(subpath, "extract")
    body = data or {}
    if sub in ("captions", "transcript", "extract", "share-target"):
        url_or_text = str(body.get("url") or body.get("sharedText") or body.get("videoId") or "")
        langs = body.get("langs") if isinstance(body.get("langs"), list) else None
        return fetch_youtube_captions_via_local_ip(url_or_text, langs)
    return {"ok": False, "error": f"Unknown POST endpoint: /api/aggrofilter/{sub}"}


def handle_request(action: str, payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    act = (action or "health").strip("/").lower()
    if act in ("health", "status"):
        return handle_get(act)
    return handle_post(act, payload or {})
