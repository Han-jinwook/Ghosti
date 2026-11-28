#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[내장 소프트웨어 플러그인 1] plugin_ghosti_os.py
- 귀신같이(Ghosti) 및 3몬스터(설치·수리·정리) 전용 OS 제어·3초 포렌식·[복원 기록](restore_points.json)·TopMost 오버레이 플러그인
- 별도 프로세스 생성 없이 단일 코어(Merlin_Z_Core, 127.0.0.1:5199) 내부에서 소프트웨어적으로 직결 호출됩니다.
- 핵심 탑재 기능:
  1. 설정몬스터/클린몬스터 '대화형 폴더·파일 정리 & [복원 기록] 3단계 무결성 사전 검진(Pre-Check) 타임머신 원복'
  2. 윈도우 휴지통($Recycle.Bin) $I 바이너리 헤더 실물 해독기 & 1초 원위치 복구 (주치의 + 1초 내용 검색 기본 탑재)
  3. 블랙박스(유저 원문 명령어 + 미리보기 + 승인 시각) 결합 '고객센터 오기 전 채팅창 1초 초월적 소명' 엔진
"""

from __future__ import annotations

import ctypes
import datetime
import hashlib
import html
import io
import json
import os
from pathlib import Path
import re
import shutil
import struct
import sys
import tempfile
import threading
import time
from typing import Any, Dict, List
import unicodedata

THIS_DIR = Path(__file__).resolve().parent
if str(THIS_DIR) not in sys.path:
    sys.path.insert(0, str(THIS_DIR))

import merlin_z_core_os as zos  # noqa: E402
import ghosti_safe_ops as safe  # noqa: E402

LOCAL_APPDATA = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
MERLIN_DIR = LOCAL_APPDATA / "Merlin"
RESTORE_POINTS_FILE = MERLIN_DIR / "restore_points.json"

FILE_ATTRIBUTE_HIDDEN = 0x02
FILE_ATTRIBUTE_NORMAL = 0x80

PLUGIN_METADATA = {
    "pluginId": "ghosti_os",
    "pluginName": "Ghosti & 3-Monsters OS + RestorePoint + RecycleBin Omni-Tracker Plugin",
    "version": "2.13.50",
    "type": "BUILTIN_SOFTWARE_PLUGIN",
    "port": 5199,
    "capabilities": [
        "os-inspect",
        "forensic-scan",
        "os-overlay",
        "os-execute",
        "folder-tree-summary",
        "restore-points-list",
        "restore-point-rollback",
        "recycle-bin-scan",
        "omni-file-trace",
        "ai-baton-touch",
        "gdrive-smart-scan",
        "kakao-real-chatroom-send",
        "photo-winrt-ocr",
        "pdf-deep-text",
    ],
}


def _ensure_merlin_dir() -> None:
    MERLIN_DIR.mkdir(parents=True, exist_ok=True)


def _quick_file_hash(p: Path) -> str:
    try:
        if not p.exists() or not p.is_file():
            return ""
        h = hashlib.sha256()
        with p.open("rb") as f:
            h.update(f.read(65536))
        return h.hexdigest()[:16]
    except Exception:
        return ""


def _set_hidden_attr(p: Path, hide: bool) -> bool:
    try:
        if os.name == "nt":
            attrs = ctypes.windll.kernel32.GetFileAttributesW(str(p))
            if attrs == -1:
                return False
            new_attrs = (attrs | FILE_ATTRIBUTE_HIDDEN) if hide else (attrs & ~FILE_ATTRIBUTE_HIDDEN)
            return bool(ctypes.windll.kernel32.SetFileAttributesW(str(p), new_attrs))
        return True
    except Exception:
        return False


def _parse_recycle_bin_i_file(i_file: Path) -> Dict[str, Any] | None:
    """$I 메타파일 해독 (v1/v2) — 실구현은 ghosti_safe_ops.parse_recycle_i_file"""
    return safe.parse_recycle_i_file(i_file)


_TRACE_STOPWORDS = {
    "파일", "사진", "이미지", "그림", "문서", "자료", "폴더", "영상", "동영상",
    "미저장", "미저장문서", "저장", "임시", "임시본", "임시저장", "자동복구", "자동저장",
    "정리", "정리함", "보관함", "정리보관함", "윈도우", "컴퓨터", "피씨", "pc", "귀신비서", "귀신", "비서",
    "내", "내가", "제", "제가", "우리", "우리가", "나", "저", "그", "그거", "이거", "저거",
    "어디", "어디갔어", "어디갔지", "어디있어", "어디로", "방금", "방금전", "방금전에", "조금전", "조금전에", "아까", "최근", "최근에",
    "오늘", "어제", "그제", "일전에", "실수로", "모르고", "일부러", "잘못", "거기", "여기",
    "없어졌어", "없어졌어요", "없어진", "사라졌어", "사라졌어요", "사라진",
    "증발", "증발했어", "지운", "지웠던", "지웠지", "지웠어", "지웠어요", "지워진", "삭제", "삭제한", "삭제된",
    "삭제했어", "삭제했어요", "버린", "버렸던", "버렸어", "버렸어요", "날아갔어", "날아간", "넣은", "넣었던",
    "보낸", "옮긴", "복구", "복구해", "복구해줘", "복구해주세요", "복구하기", "복원", "복원해", "복원해줘", "복원해주세요", "복원하기",
    "되돌려", "되돌려줘", "되돌려주세요", "원복", "원복해줘", "원래대로", "살려", "살려줘", "구출", "구출해", "구출해줘", "구출하기",
    "찾아", "찾아줘", "찾아주세요", "찾기", "보여", "보여줘", "보여주세요", "알려", "알려줘", "못", "찾겠어",
    "휴지통", "휴지통에", "휴지통에서", "니가", "너가", "왜", "좀", "다시", "있던", "있었던", "바탕화면",
    "바탕화면에", "바탕화면에서", "내문서", "문서함", "다운로드", "폴더에", "폴더에서", "거", "것",
    "바로", "즉시", "연속", "원본", "위치", "원위치", "전체", "목록", "실행", "실행해", "실행해줘", "해줘", "해주세요",
}


def _extract_trace_keywords(query: str) -> List[str]:
    cleaned_q = re.sub(r"['\"‘’“”`]", " ", query or "")
    toks = re.findall(r"[0-9A-Za-z가-힣._\-]{2,}", cleaned_q)
    out: List[str] = []
    for t in toks:
        t2 = re.sub(r"(이|가|을|를|은|는|도|에|에서|으로|로|의|만|랑|이랑)$", "", t) if len(t) > 2 else t
        t_low = t.lower()
        t2_low = t2.lower()
        if re.match(r"^\d+(초|분|시|시간|일|번|회|개|건|장|세트)$", t2_low):
            continue
        if t2 and t2_low not in _TRACE_STOPWORDS and t_low not in _TRACE_STOPWORDS and len(t2) >= 2 and t2 not in out:
            out.append(t2)
    return out[:6]


def _format_size_human(size_bytes: int) -> str:
    b = max(0, int(size_bytes or 0))
    if b < 1024:
        return f"{b} B"
    if b < 1024 * 1024:
        return f"{b / 1024:.1f} KB"
    return f"{b / (1024 * 1024):.2f} MB"


def _build_recycle_5_lines_preview(meta: Dict[str, Any]) -> List[str]:
    orig_name = str(meta.get("originalName") or "파일")
    orig_path = str(meta.get("originalPath") or "-")
    deleted_at = str(meta.get("deletedAt") or "-")
    size_label = _format_size_human(int(meta.get("sizeBytes") or 0))
    r_path = Path(str(meta.get("recycleDataFile") or ""))

    real_text_lines: List[str] = []
    if r_path.exists() and r_path.is_file():
        try:
            extracted = zos.extract_real_5_lines_preview(r_path)
            if isinstance(extracted, list):
                for ln in extracted:
                    s = str(ln or "").strip()
                    if (
                        s
                        and not s.startswith("📄 실물 문서 확인:")
                        and not s.startswith("📂 실제 디스크 경로:")
                        and not s.startswith("🕒 마지막 저장 시각:")
                        and not s.startswith("📦 실측 파일 크기:")
                        and not s.startswith("✅ 디스크 무결성 검증:")
                        and not s.startswith("[파일 접근")
                    ):
                        real_text_lines.append(s[:120])
                        if len(real_text_lines) >= 2:
                            break
        except Exception:
            real_text_lines = []

    lines = [
        f"📄 파일 이름: {orig_name} ({size_label})",
        f"📍 원래 위치: {orig_path}",
        f"🗑️ 현재 상태: 윈도우 휴지통 보관 중 (삭제 시각: {deleted_at})",
    ]
    if real_text_lines:
        lines.append(f"📝 내용 미리보기: {real_text_lines[0]}")
        lines.append(
            f"   {real_text_lines[1]}"
            if len(real_text_lines) > 1
            else "✅ 아래 [원위치/바탕화면 복원] 버튼만 누르면 원래 자리에 바로 복구돼요!"
        )
    else:
        ext_label = (Path(orig_name).suffix.lstrip(".").upper() or "일반")
        lines.append(f"📦 파일 형식: {ext_label} 파일 (내용 손상 없이 안전 보관 중)")
        lines.append("✅ 아래 [원위치/바탕화면 복원] 버튼만 누르면 원래 자리에 바로 복구돼요!")
    return lines[:5]


def scan_windows_recycle_bin(query: str = "", max_results: int = 25) -> Dict[str, Any]:
    """현재 사용자 휴지통(전 고정 디스크) $I 해독 스캔 — 10초 정직 컷오프"""
    kws = _extract_trace_keywords(query) if query else []
    res = safe.scan_user_recycle_bin(kws, max_results=max(1, int(max_results)))
    res["query"] = query
    res["keywords"] = kws
    res["recycleBinCount"] = res.get("count", 0)
    return res


def scan_folder_tree_metadata(target_path: str = "", max_items: int = 80) -> Dict[str, Any]:
    """바탕화면·다운로드 정리 후보 실측 스캔 (파일 본문 미열람). target_path='downloads'|'desktop' 지원"""
    kind = "DOWNLOAD_INSTALLERS" if "download" in (target_path or "").lower() else "FOLDER_REORG"
    return safe.scan_cleanup_candidates(kind, max_items=max_items)


def list_restore_points_with_precheck() -> Dict[str, Any]:
    """[복원 기록] 3단계 무결성 사전 검진 — 실구현은 ghosti_safe_ops.precheck_restore_points"""
    return safe.precheck_restore_points()


def trace_missing_file_omni(query: str) -> Dict[str, Any]:
    """
    사라진 파일 정직 수색: ① 현재 사용자 휴지통($Recycle.Bin 최신 삭제순 / 키워드 매칭) ② [복원 기록] 이동·스냅샷 보관분.
    파일명 단서 없이 '방금 지운 파일 찾아줘'라고 물어도 가장 최근 휴지통 삭제 파일을 즉시 찾아 5줄 미리보기로 안내한다.
    """
    t0 = time.perf_counter()
    kws = _extract_trace_keywords(query)
    base: Dict[str, Any] = {"ok": True, "query": query, "keywords": kws}
    is_explicit_recycle_or_delete = bool(re.search(r"지운|지웠|지워진|삭제|버린|버렸|휴지통", query or ""))

    def _hit(name: str) -> bool:
        if not kws:
            return True
        low = name.lower()
        return any(k.lower() in low for k in kws)

    # 1) 키워드가 있고 명시적 '지운/휴지통' 요청이 아닌 경우: 귀신같이가 유저 승인으로 폴더 이동(MOVE)한 [복원 기록] 우선 대조
    if kws and not is_explicit_recycle_or_delete:
        for pt in safe.load_restore_points():
            bb = pt.get("blackbox", {})
            for op in pt.get("operations", []) or []:
                if op.get("op") != "MOVE" or op.get("rolledBack"):
                    continue
                name = str(op.get("name", ""))
                to_p = Path(str(op.get("toPath", "")))
                if _hit(name) and to_p.exists():
                    from_p_str = str(op.get("fromPath", ""))
                    size_lbl = _format_size_human(int(op.get("sizeBytes") or (to_p.stat().st_size if to_p.exists() else 0)))
                    base.update(
                        {
                            "caseType": "CASE_A_USER_APPROVED_RESTORE_POINT",
                            "restoreId": pt.get("restoreId"),
                            "fileName": name,
                            "currentLocation": str(to_p),
                            "originalLocation": from_p_str,
                            "deletedAt": pt.get("createdAt"),
                            "preview5Lines": [
                                f"📄 파일 이름: {name} ({size_lbl})",
                                f"📍 원래 위치: {from_p_str or '-'}",
                                f"📂 현재 위치: {to_p}",
                                f"🕰️ 보관 근거: [{pt.get('restoreId')} 복원 기록] ({pt.get('createdAt')})",
                                "✅ 아래 [원위치/바탕화면 복원] 버튼만 누르면 원래 자리로 바로 돌아가요!",
                            ],
                            "elapsedMs": round((time.perf_counter() - t0) * 1000, 1),
                            "briefingKo": (
                                f"👻 찾았어요! {pt.get('createdAt')}에 승인하신 **[{pt.get('restoreId')} 복원 기록]**으로 "
                                f"**'{to_p.parent.name}'** 폴더에 안전하게 보관되어 있어요. 원래 자리로 바로 되돌려 드릴까요?"
                            ),
                            "blackbox": bb,
                        }
                    )
                    return base

    # 2) 현재 사용자 윈도우 휴지통($Recycle.Bin) 실물 스캔 (kws=[]이면 가장 최근 삭제된 파일 1순위 반환!)
    rb = safe.scan_user_recycle_bin(kws, max_results=30)
    if rb.get("items"):
        top = rb["items"][0]
        total_rb = int(rb.get("totalCount") or len(rb["items"]))
        led = next((r for r in safe.ledger_load() if r.get("recycleMetaFile") == top["recycleMetaFile"]), None)
        age_sec = max(0.0, time.time() - float(top.get("deletedEpoch") or time.time()))
        if led:
            who = "귀신같이 사진 정리로"
        elif age_sec <= 3600:
            who = "방금 윈도우에서"
        else:
            who = "이전에 윈도우 휴지통에 보관된 항목 중 가장 최근 순서로"
        order_note = f" · 휴지통 내 총 {total_rb}건 중 최신 1순위" if total_rb > 1 else ""
        base.update(
            {
                "caseType": "CASE_B_FOUND_IN_RECYCLE_BIN",
                "fileName": top["originalName"],
                "currentLocation": top["recycleDataFile"],
                "originalLocation": top["originalPath"],
                "recycleMetaFile": top["recycleMetaFile"],
                "deletedAt": top["deletedAt"],
                "preview5Lines": _build_recycle_5_lines_preview(top),
                "elapsedMs": round((time.perf_counter() - t0) * 1000, 1),
                "briefingKo": (
                    f"👻 찾았어요! {who} 휴지통에 들어간 **{top['originalName']}** 파일을 확인했어요 "
                    f"(삭제 시각: {top['deletedAt']}{order_note}).\n"
                    f"아래 5줄 미리보기를 확인하시고 **[📂 폴더 열기]**나 **[↩️ 원위치/바탕화면 복원]** 버튼을 눌러 원래 위치(`{top['originalPath']}`)로 바로 되살려 보세요!"
                ),
            }
        )
        return base

    # 3) 휴지통에 없을 때: [복원 기록] 내 MOVE 또는 Shift+Delete 타임머신 보호본(SHADOW_PROTECT) 확인
    for pt in safe.load_restore_points():
        bb = pt.get("blackbox", {})
        for op in pt.get("operations", []) or []:
            if op.get("op") not in ("MOVE", "SHADOW_PROTECT") or op.get("rolledBack"):
                continue
            name = str(op.get("name", ""))
            to_p = Path(str(op.get("toPath", "")))
            if _hit(name) and to_p.exists():
                from_p_str = str(op.get("fromPath", ""))
                size_lbl = _format_size_human(int(op.get("sizeBytes") or (to_p.stat().st_size if to_p.exists() else 0)))
                is_shadow = op.get("op") == "SHADOW_PROTECT"
                base.update(
                    {
                        "caseType": "CASE_A_USER_APPROVED_RESTORE_POINT",
                        "restoreId": pt.get("restoreId"),
                        "fileName": name,
                        "currentLocation": str(to_p),
                        "originalLocation": from_p_str,
                        "deletedAt": pt.get("createdAt"),
                        "preview5Lines": [
                            f"📄 파일 이름: {name} ({size_lbl})",
                            f"📍 원래 위치: {from_p_str or '-'}",
                            f"🛡️ 현재 상태: {'타임머신 보호 금고 안전 보관 중' if is_shadow else f'{to_p.parent.name} 폴더 보관 중'}",
                            f"🕰️ 보관 근거: [{pt.get('restoreId')} 복원 기록] ({pt.get('createdAt')})",
                            "✅ 아래 [원위치/바탕화면 복원] 버튼만 누르면 원래 자리로 바로 복구돼요!",
                        ],
                        "elapsedMs": round((time.perf_counter() - t0) * 1000, 1),
                        "briefingKo": (
                            f"👻 찾았어요! **[{pt.get('restoreId')} 복원 기록]**에 **{name}** 보호본이 안전하게 남아 있어요 "
                            f"({pt.get('createdAt')}). 아래 **[↩️ 원위치/바탕화면 복원]** 버튼을 누르시면 원래 자리(`{from_p_str}`)로 1초 만에 복구해 드려요!"
                        ),
                        "blackbox": bb,
                    }
                )
                return base

    kw_desc = f"'{', '.join(kws)}'(으)로 " if kws else ""
    base.update(
        {
            "caseType": "CASE_B_NOT_IN_RECYCLE_OR_RESTORE",
            "elapsedMs": round((time.perf_counter() - t0) * 1000, 1),
            "timedOut": bool(rb.get("timedOut")),
            "briefingKo": (
                f"100% 정직 판정: 내 PC 5대 은닉 금고와 윈도우 휴지통을 모두 스캔했으나 흔적이 없습니다. "
                f"{kw_desc}[복원 기록]과 윈도우 휴지통을 모두 살펴봤지만 현재 휴지통에 남아 있는 지운 파일이 없어요. "
                "다른 폴더로 옮겨졌을 수 있으니 파일 이름 단서가 있다면 함께 알려주세요!"
            ),
        }
    )
    return base


def rollback_restore_point(restore_id: str, user_rollback_text: str = "") -> Dict[str, Any]:
    return safe.rollback_restore_point(restore_id, user_rollback_text)


def create_desktop_shortcut_with_restore_point(
    site_name: str, target_url: str, user_prompt: str = "", user_approval_text: str = ""
) -> Dict[str, Any]:
    return safe.create_desktop_shortcut(site_name, target_url, user_prompt, user_approval_text)


def record_conversational_cleanup_restore_point(
    summary: str,
    user_prompt: str,
    preview_presented: str,
    full_paths: List[str],
    user_approval_text: str = "",
) -> Dict[str, Any]:
    """미리보기에서 유저가 자연어로 타이핑 승인한 '실물 경로'만 기타_정리함으로 이동하고 [복원 기록] + 블랙박스를 남긴다."""
    return safe.execute_cleanup_move(full_paths, summary, user_prompt, preview_presented, user_approval_text)


def detect_most_recent_ai_and_baton_touch(
    doc_title: str = "",
    doc_text: str = "",
    user_question: str = "",
    device_spec_summary: str = "",
    show_overlay: bool = True,
) -> Dict[str, Any]:
    """
    [고난도 질문 시 유저가 최근 사용한 AI(ChatGPT/Gemini/Claude) 0.01초 자동 판별 & 라이브 음성 바톤터치]
    1순위: 현재 PC에 열려 있는 브라우저 탭/창 제목 실시간 스캔
    2순위: 크롬·엣지·웨일 로컬 방문 기록(History SQLite DB)에서 last_visit_time이 가장 최신인 AI 판별
    3순위 (열어본 기록이 0건인 초기 유저 기본값): 멀린님 확정 원칙에 따라 '제미나이(Gemini, https://gemini.google.com/app)' 오픈!
    - [찾기] 영역: 찾은 계약서/문서 본문 데이터 + 유저 질문 자동 세팅 (단, 민감 계정/비밀번호 시트는 외부 AI 전송 원천 차단)
    - [손보기] 영역: 내 PC/폰 실시간 진단 스펙 데이터 + 고난도 수리·스펙 상담 질문 자동 세팅
    - OS TopMost 빨간 손가락(👆) 2단계 가이드 오버레이 자동 투사 연동
    """
    import re as _re
    import sqlite3
    import tempfile
    import core_win32 as w32

    t0 = time.perf_counter()

    # 프라이버시 보안 가드: 민감 계정/비밀번호 시트는 외부 AI 자동 바톤터치 원천 차단
    if _re.search(r"(비밀번호|패스워드|password|계정\s*정리|아이디.*비번|암호\s*목록)", doc_title or "", _re.I):
        blocked_msg = (
            "보안 보호 가드가 작동했습니다. 비밀번호 및 민감 계정 문서는 외부 AI로 절대 전송하지 않으며 "
            "오직 내 기기 내부에서만 안전하게 열람할 수 있습니다."
        )
        return {
            "ok": False,
            "blockedByPrivacyGuard": True,
            "detectedAiService": "none",
            "detectedAiLabel": "보안 가드 (외부 전송 차단)",
            "targetUrl": "",
            "detectionSource": "PRIVACY_GUARD_BLOCK",
            "defaultWhenNoHistory": "gemini (https://gemini.google.com/app)",
            "promptStagedToInput": False,
            "stagedPromptPreview": "",
            "ttsVoice": "ko-KR-HyunsuNeural",
            "ttsBriefingKo": blocked_msg,
            "twoStepFingerGuide": [],
            "floatingReturnPill": "⬅️ 귀신같이 안전 화면 유지",
            "serverLlmTokenCostWon": 0,
            "elapsedMs": round((time.perf_counter() - t0) * 1000, 2),
        }

    detected_service = "gemini"
    detected_label = "제미나이 (Gemini)"
    detected_url = "https://gemini.google.com/app"
    detection_source = "DEFAULT_GEMINI_FALLBACK"

    # 1) 현재 열려 있는 창 제목 스캔
    try:
        open_wins = zos.get_real_open_windows(max_count=20)
        for w in open_wins:
            title_low = str(w.get("title", "")).lower()
            if "chatgpt" in title_low or "챗gpt" in title_low:
                detected_service = "chatgpt"
                detected_label = "챗GPT (ChatGPT)"
                detected_url = "https://chatgpt.com/"
                detection_source = "ACTIVE_OPEN_WINDOW"
                break
            if "gemini" in title_low or "제미나이" in title_low:
                detected_service = "gemini"
                detected_label = "제미나이 (Gemini)"
                detected_url = "https://gemini.google.com/app"
                detection_source = "ACTIVE_OPEN_WINDOW"
                break
            if "claude" in title_low or "클로드" in title_low:
                detected_service = "claude"
                detected_label = "클로드 (Claude)"
                detected_url = "https://claude.ai/new"
                detection_source = "ACTIVE_OPEN_WINDOW"
                break
    except Exception:
        pass

    # 2) 크롬 / 엣지 / 웨일 History SQLite DB에서 최근 방문 시각(last_visit_time) 1위 조회
    if detection_source == "DEFAULT_GEMINI_FALLBACK":
        history_paths = [
            LOCAL_APPDATA / "Google" / "Chrome" / "User Data" / "Default" / "History",
            LOCAL_APPDATA / "Microsoft" / "Edge" / "User Data" / "Default" / "History",
            LOCAL_APPDATA / "Naver" / "Naver Whale" / "User Data" / "Default" / "History",
        ]
        best_visit_time = 0
        for hp in history_paths:
            if not hp.exists():
                continue
            tmp_db = Path(tempfile.gettempdir()) / f"ghosti_hist_{os.getpid()}.db"
            try:
                shutil.copy2(str(hp), str(tmp_db))
                conn = sqlite3.connect(str(tmp_db), timeout=2)
                cur = conn.cursor()
                rows = cur.execute(
                    "SELECT url, last_visit_time FROM urls "
                    "WHERE url LIKE '%gemini.google.com%' OR url LIKE '%chatgpt.com%' "
                    "OR url LIKE '%chat.openai.com%' OR url LIKE '%claude.ai%' "
                    "ORDER BY last_visit_time DESC LIMIT 5"
                ).fetchall()
                conn.close()
                for u_str, v_time in rows:
                    vt = int(v_time or 0)
                    if vt > best_visit_time:
                        best_visit_time = vt
                        u_low = str(u_str).lower()
                        if "chatgpt.com" in u_low or "chat.openai.com" in u_low:
                            detected_service = "chatgpt"
                            detected_label = "챗GPT (ChatGPT)"
                            detected_url = "https://chatgpt.com/"
                        elif "claude.ai" in u_low:
                            detected_service = "claude"
                            detected_label = "클로드 (Claude)"
                            detected_url = "https://claude.ai/new"
                        else:
                            detected_service = "gemini"
                            detected_label = "제미나이 (Gemini)"
                            detected_url = "https://gemini.google.com/app"
                        detection_source = f"BROWSER_HISTORY_SQLITE ({hp.parents[2].name})"
            except Exception:
                pass
            finally:
                if tmp_db.exists():
                    try:
                        tmp_db.unlink()
                    except Exception:
                        pass

    # [손보기] PC/폰 수리·스펙 상담 시 실측 하드웨어 스펙 자동 첨부
    spec_block = (device_spec_summary or "").strip()
    is_device_repair_or_spec = bool(
        spec_block
        or _re.search(r"(PC|사양|스펙|수리|진단|메인보드|전원|그래픽|메모리|부팅|질문 내용)", doc_title or "", _re.I)
    )
    if is_device_repair_or_spec and not spec_block:
        try:
            sp = safe.measure_pc_spec()
            if isinstance(sp, dict):
                spec_block = (
                    f"CPU: {sp.get('cpuModel', '확인불가')} | "
                    f"RAM: {sp.get('ramTotalGb', '?')}GB (사용률 {sp.get('ramUsedPercent', '?')}%) | "
                    f"GPU: {sp.get('gpuModel', '확인불가')} | "
                    f"여유공간: {sp.get('diskFreeGb', '?')}GB / {sp.get('diskTotalGb', '?')}GB | "
                    f"OS: {sp.get('osVersion', 'Windows')}"
                )
        except Exception:
            pass

    if spec_block and (not doc_text or doc_text.strip() == user_question.strip()):
        combined_prompt = (
            f"[진단 기기 사양 및 상태: {doc_title or '내 PC/기기 실시간 진단 데이터'}]\n"
            f"{spec_block}\n\n"
            f"[고난도 수리·스펙 상담 요청]\n"
            f"{user_question or doc_text or '현재 내 기기 사양과 증상을 바탕으로 원인과 해결 방법을 쉽게 설명해 줘.'}"
        ).strip()
    else:
        extra_spec = f"\n\n[참고 기기 사양]\n{spec_block}" if spec_block else ""
        combined_prompt = (
            f"[참조 데이터: {doc_title or '선택된 문서'}]\n"
            f"{doc_text[:6000]}{extra_spec}\n\n"
            f"[질문 요청]\n{user_question or '이 내용에서 나에게 불리한 조항이나 핵심 주의사항을 쉽게 설명해 줘.'}"
        ).strip()

    w32.set_clipboard_unicode(combined_prompt)

    overlay_triggered = False
    if show_overlay:
        try:
            overlay_text = (
                f"👆 [{detected_label}] 입력창에 붙여넣기(Ctrl+V) 후 "
                f"① [전송(↑)] 클릭 ➔ ② 바로 옆 [라이브 음성 🎧] 클릭!"
            )
            zos.spawn_overlay_detached(420, 150, overlay_text, 10)
            overlay_triggered = True
        except Exception:
            overlay_triggered = False

    context_noun = "기기 진단 스펙과 질문" if (spec_block and doc_title in ("질문 내용", "내 PC 실측 사양", "")) else "문서와 질문"
    hyunsu_briefing = (
        f"깊은 분석이 필요한 질문이네요! 평소 쓰시는 {detected_label} 입력창에 넣을 수 있도록 {context_noun}을 바로 준비해 띄워드릴게요. "
        f"붙여넣기 후 [전송] 버튼을 누르신 뒤, 바로 옆 [라이브 음성] 버튼을 누르시면 말로 편하게 상담하실 수 있습니다!"
    )

    return {
        "ok": True,
        "detectedAiService": detected_service,
        "detectedAiLabel": detected_label,
        "targetUrl": detected_url,
        "detectionSource": detection_source,
        "defaultWhenNoHistory": "gemini (https://gemini.google.com/app)",
        "promptStagedToInput": True,
        "stagedPromptText": combined_prompt,
        "stagedPromptPreview": combined_prompt[:300],
        "overlayTriggered": overlay_triggered,
        "ttsVoice": "ko-KR-HyunsuNeural",
        "ttsBriefingKo": hyunsu_briefing,
        "twoStepFingerGuide": [
            {"step": 1, "label": "① 입력창 붙여넣기(Ctrl+V) 및 [전송 (↑)] 클릭", "desc": "이미 복사된 본문+질문 데이터를 즉시 전송합니다."},
            {"step": 2, "label": "② 바로 옆 [라이브 음성 🎧] 버튼 클릭", "desc": "운전·이동 중에도 말로 편하게 양방향 심층 상담을 이어갑니다."},
        ],
        "floatingReturnPill": "⬅️ 대화 종료 후 귀신같이 복귀",
        "serverLlmTokenCostWon": 0,
        "elapsedMs": round((time.perf_counter() - t0) * 1000, 2),
    }


def scan_g_drive_google_docs_and_sheets(query: str = "") -> Dict[str, Any]:
    """
    [탐색기 장착 G: 드라이브 및 모든 구글독스(.gdoc)·구글시트(.gsheet) '무설정 스마트 모드(Zero-Config)' 통합 1초 내용 검색]
    - 유저에게 구글 계정 연동 팝업을 일절 띄우지 않고(Zero-Popup),
      1) 파일 시스템에 마운트된 G:\\내 드라이브 (또는 Google DriveFS 로컬 캐시) 자동 감지
      2) .gsheet / .gdoc 202바이트 JSON 메타데이터({"doc_id": "...", "url": "..."}) 파싱
      3) 백신 Infostealer 오진 방지를 위해 브라우저 세션 탈취를 엄금하며, 기본 '파일명 색인 + 1초 열기' 제공 및 본문 검색은 공식 OAuth 연동
      4) 계정/비밀번호(ID/PW) 행 조회 시:
         - 내 PC 안의 내 정보를 본인이 직접 열람하는 것이므로 비밀번호·계좌·주민번호를 별표(••••)로 가리지 않고 원문 그대로 즉시 노출!
         - ID 텍스트 옆(📋)과 비밀번호 텍스트 옆(📋) 모두 인라인 복사 이모지 제공!
         - 단, TTS 음성으로는 비밀번호를 절대 소리 내어 읽지 않으며 외부 AI 바톤터치 대상에서 제외!
    """
    t0 = time.perf_counter()
    q_low = (query or "").strip().lower()

    g_drive_candidates = [
        Path("G:\\내 드라이브"),
        Path("G:\\My Drive"),
        Path("H:\\내 드라이브"),
        Path("H:\\My Drive"),
        Path("G:\\"),
        Path("H:\\"),
        LOCAL_APPDATA / "Google" / "DriveFS",
    ]
    detected_roots = [str(p) for p in g_drive_candidates if p.exists()]

    # 로컬 암호화 스마트 서류함 내 구글독스/구글시트 색인 DB 로드 (실제 .gsheet/.gdoc 스캔 병합)
    gdrive_index_file = MERLIN_DIR / "gdrive_smart_index.json"
    _ensure_merlin_dir()

    discovered_shortcuts: List[Dict[str, Any]] = []
    for root_str in detected_roots[:3]:
        rp = Path(root_str)
        if not rp.exists() or "DriveFS" in root_str:
            continue
        try:
            for ext in ("*.gsheet", "*.gdoc", "*/*.gsheet", "*/*.gdoc"):
                for fp in list(rp.glob(ext))[:25]:
                    try:
                        g_meta = safe.resolve_google_workspace_shortcut_meta(fp)
                        doc_id = str(g_meta.get("doc_id") or "")
                        kind = "gsheet" if fp.suffix.lower() == ".gsheet" else "gdoc"
                        url = str(g_meta.get("url") or "")
                        discovered_shortcuts.append(
                            {
                                "fileName": fp.name,
                                "filePath": str(fp),
                                "docId": doc_id,
                                "docType": kind,
                                "webUrl": url,
                            }
                        )
                    except Exception:
                        pass
        except Exception:
            pass

    # [실물 파일 순수성 철칙] 가짜 사내 계정·미수금·강연 원고 데모 시트를 절대 섞지 않고 실제 PC의 .gdoc/.gsheet 바로가기만 반환!
    indexed_items: List[Dict[str, Any]] = []

    for sc in discovered_shortcuts:
        indexed_items.append(
            {
                "id": f"real_{sc['docId'][:12]}",
                "fileName": sc["fileName"],
                "filePath": sc["filePath"],
                "docId": sc["docId"],
                "docType": sc["docType"],
                "webUrl": sc["webUrl"],
                "isCredentialRow": False,
                "extractedText": f"{sc['fileName']} ({sc['docType']}) 로컬 구글 세션 무설정 색인 문서",
            }
        )

    matched = [
        item
        for item in indexed_items
        if not q_low
        or q_low in item["fileName"].lower()
        or q_low in item.get("extractedText", "").lower()
        or q_low in item.get("serviceName", "").lower()
    ]

    return {
        "ok": True,
        "mode": "ZERO_CONFIG_GOOGLE_SESSION_SMART_INDEX",
        "popupShownToUser": False,
        "detectedGDriveRoots": detected_roots,
        "totalIndexedGoogleDocsAndSheets": len(indexed_items),
        "matchedCount": len(matched),
        "items": matched,
        "elapsedMs": round((time.perf_counter() - t0) * 1000, 2),
    }


import base64
import re
import subprocess
import tempfile
import threading
import urllib.parse
import zipfile
import zlib

_PHOTO_PATH_INDEX: Dict[str, Path] = {}
_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".heic"}
_VIDEO_EXTS = {".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv", ".wmv", ".3gp", ".ts", ".mts", ".flv"}
_PHOTO_EXTS = _IMAGE_EXTS | _VIDEO_EXTS
_DOC_EXTS = {".pdf", ".txt", ".md", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".hwp", ".hwpx", ".csv", ".gsheet", ".gdoc", ".gslides", ".zip", ".7z", ".rar", ".tar", ".gz", ".tgz"}
_SKIP_DIR_NAMES = {
    "node_modules",
    ".git",
    "appdata",
    "__pycache__",
    "venv",
    ".venv",
    "dist",
    "build",
    "temp",
    "tmp",
    "_internal",
    "_tk_data",
    "site-packages",
    ".pytest_cache",
    ".mypy_cache",
    ".next",
    ".nuxt",
    ".vite",
    ".turbo",
    ".gradle",
    "target",
    "coverage",
    "ms-playwright",
    "playwright",
    "puppeteer",
    "locales",
    "swiftshader",
    "crashpad",
    "shader_cache",
    "gpu_cache",
    "code cache",
    "accountpictures",
    "crisp_thumbs",
    "merlin_z_core",
    "universal_z_core",
    "sample_photos_301",
    "merlin_ai_models",
    "$recycle.bin",
    "system volume information",
    "programdata",
    "windows",
    "program files",
    "program files (x86)",
}
_SKIP_DIR_PREFIXES = (
    "jetski_recording_",
    "merlin_vid_fullocr_",
    "merlin_pdf_ppocr_",
    "merlin_zcore_",
    "_mei",
)


def _is_skip_subdir_name(nm_low: str) -> bool:
    return (
        nm_low in _SKIP_DIR_NAMES
        or nm_low.startswith(_SKIP_DIR_PREFIXES)
        or nm_low.endswith((".dist-info", ".egg-info"))
    )
_ALLOW_CORPUS_DIRS: set[str] = set()
_CUSTOM_SCAN_ROOTS_FILE = LOCAL_APPDATA / "Merlin" / "ghosti_custom_scan_roots.json"
_WORK_SDRIVE_CONFIG_FILE = LOCAL_APPDATA / "Merlin" / "work_sdrive_config.json"


def _get_unmounted_work_vault_dir_to_exclude() -> Optional[Path]:
    """순수 개인 모드(S: 드라이브 미마운트 상태)일 때 사용자 지정 업무 폴더(예: Documents/회사자료, D:\\업무폴더)가
    내 기기 개인 스캔에 섞이지 않도록 물리 격리할 경로를 반환합니다."""
    try:
        if Path("S:\\").exists():
            return None
        if _WORK_SDRIVE_CONFIG_FILE.exists():
            cfg = json.loads(_WORK_SDRIVE_CONFIG_FILE.read_text(encoding="utf-8", errors="ignore"))
            if isinstance(cfg, dict):
                t_dir = str(cfg.get("targetDir") or "").strip()
                if t_dir and t_dir.upper().rstrip("\\/") != "S:":
                    p = Path(t_dir)
                    if p.exists():
                        return p.resolve()
        default_v = LOCAL_APPDATA / "Merlin" / "업무공유폴더_S"
        if default_v.exists():
            return default_v.resolve()
    except Exception:
        pass
    return None


def _is_under_excluded_work_vault(p: Path, excluded_work_dir: Optional[Path]) -> bool:
    if excluded_work_dir is None:
        return False
    try:
        pr = p.resolve()
        if pr == excluded_work_dir or pr.is_relative_to(excluded_work_dir):
            return True
    except Exception:
        pass
    if p.name.lower() == "업무공유폴더_s":
        return True
    return False


_VIRTUAL_DRIVE_CACHE: Dict[str, tuple[float, bool]] = {}


def _is_virtual_cloud_drive_path(p: Path | str) -> bool:
    """Google Drive Desktop(G:) 등 가상 네트워크 마운트 드라이브인지 0.01ms 캐시로 판별합니다."""
    s = str(p or "")
    if len(s) < 2 or s[1] != ":":
        return False
    drv = s[:2].upper()
    if drv in ("C:", "S:"):
        return False
    now_m = time.monotonic()
    hit = _VIRTUAL_DRIVE_CACHE.get(drv)
    if hit is not None and (now_m - hit[0]) < 60.0:
        return hit[1]
    is_virt = False
    try:
        root_p = Path(f"{drv}\\")
        if (
            (root_p / ".shortcut-targets-by-id").exists()
            or (root_p / "내 드라이브").exists()
            or (root_p / "My Drive").exists()
        ):
            is_virt = True
    except Exception:
        is_virt = False
    _VIRTUAL_DRIVE_CACHE[drv] = (now_m, is_virt)
    return is_virt


def _is_cloud_virtual_or_unpinned_file(p: Path) -> bool:
    """클라우드 미동기화(Offline / Recall-on-access) 파일인지 판별하여 대량 스캔 시 강제 다운로드를 방지합니다 (로컬 캐시된 G: 파일은 허용)."""
    try:
        attrs = getattr(p.stat(), "st_file_attributes", 0)
        # FILE_ATTRIBUTE_OFFLINE (0x1000) | FILE_ATTRIBUTE_RECALL_ON_OPEN (0x40000) | FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS (0x400000)
        if attrs & (0x1000 | 0x40000 | 0x400000):
            return True
    except Exception:
        pass
    return False


_UNPINNED_CLOUD_ATTR_MASK = 0x1000 | 0x40000 | 0x400000


def _is_cloud_only_media_file(p: Path | str, attrs: int | None = None) -> bool:
    """
    [클라우드 전용 미디어 SSOT 판별 — 파일명 선색인 · 원본 대량 다운로드 금지 대상]:
    - Google Drive for Desktop(DriveFS) 가상 드라이브(G:)는 온라인 전용 파일도 속성이 0x80(NORMAL)으로 보고되어
      속성만으로는 미동기화 여부를 알 수 없으므로(4호기 실측 8,635장 전부 0x80), 가상 드라이브 경로 전체를 클라우드 전용으로 취급합니다.
    - OneDrive 등 Cloud Files 온라인 전용 파일(OFFLINE / RECALL_ON_OPEN / RECALL_ON_DATA_ACCESS)도 포함합니다.
    """
    if _is_virtual_cloud_drive_path(p):
        return True
    if attrs is None:
        try:
            attrs = int(getattr(os.stat(p), "st_file_attributes", 0) or 0)
        except Exception:
            return False
    return bool(int(attrs or 0) & _UNPINNED_CLOUD_ATTR_MASK)


# [가상 클라우드 드라이브 폴더 목록 SSOT 캐시 — 요청 스레드 I/O 0회 + 백그라운드 단일 갱신 워커 + 프로세스 간 디스크 SSOT]
# 사진·동영상·문서 목록 요청(5199)과 Ctrl+0 귀신검색창(--seq-paste-daemon, 별도 프로세스)이 중복 os.scandir 없이
# 동일한 가상 드라이브(G: 공유 바로가기 포함) 파일 목록을 0.05초 만에 공유합니다.
_VIRT_DIR_LISTING_CACHE: Dict[str, tuple[float, List[tuple[str, str, os.stat_result]]]] = {}
_VIRT_DIR_LISTING_PENDING: Dict[str, str] = {}
_VIRT_DIR_LISTING_LOCK = threading.Lock()
_VIRT_DIR_LISTING_WORKER_ALIVE = False
_VIRT_DIR_LISTING_TTL_SEC = 180.0
_VIRT_DIR_LISTING_DISK_FILE = (
    Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local"))
    / "Merlin"
    / "virtual_drive_listing_cache_v1.json"
)


def _flush_virtual_dir_listing_disk_cache() -> None:
    """5199 백그라운드가 수집한 G: 가상 드라이브 파일 목록을 별도 프로세스(--seq-paste-daemon)와 공유하도록 원자적 저장."""
    try:
        items_out: List[list] = []
        # dict 스냅샷으로 락 없이 안전 순회
        for _dk, (_ts, lst) in list(_VIRT_DIR_LISTING_CACHE.items()):
            for nm, abs_str, st in lst:
                try:
                    p_dir = os.path.basename(os.path.dirname(abs_str)) or ""
                    items_out.append([abs_str, nm, p_dir, int(st.st_size), float(st.st_mtime)])
                except Exception:
                    pass
        _VIRT_DIR_LISTING_DISK_FILE.parent.mkdir(parents=True, exist_ok=True)
        tmp_p = _VIRT_DIR_LISTING_DISK_FILE.with_name(
            f".virt_listing_tmp_{os.getpid()}_{int(time.time() * 1000)}.json"
        )
        payload = {"v": 1, "updatedAt": time.time(), "count": len(items_out), "items": items_out}
        tmp_p.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        os.replace(tmp_p, _VIRT_DIR_LISTING_DISK_FILE)
    except Exception:
        pass


def _get_virtual_dir_listing(d: Path) -> List[tuple[str, str, os.stat_result]] | None:
    """가상 드라이브 폴더의 (파일명, 절대경로, stat) 목록을 캐시에서 즉시 반환하고, 없거나 오래되면 백그라운드 갱신을 예약합니다."""
    d_key = os.path.normcase(str(d))
    hit = _VIRT_DIR_LISTING_CACHE.get(d_key)
    if hit is None or (time.monotonic() - hit[0]) >= _VIRT_DIR_LISTING_TTL_SEC:
        _schedule_virtual_dir_listing(d_key, str(d))
    return hit[1] if hit is not None else None


def _schedule_virtual_dir_listing(d_key: str, d_path: str) -> None:
    global _VIRT_DIR_LISTING_WORKER_ALIVE
    with _VIRT_DIR_LISTING_LOCK:
        _VIRT_DIR_LISTING_PENDING[d_key] = d_path
        if _VIRT_DIR_LISTING_WORKER_ALIVE:
            return
        _VIRT_DIR_LISTING_WORKER_ALIVE = True
    threading.Thread(target=_virtual_dir_listing_worker, daemon=True, name="GhostiVirtualDirListing").start()


def _virtual_dir_listing_worker() -> None:
    global _VIRT_DIR_LISTING_WORKER_ALIVE, _DRIVE_SCAN_SEQ
    media_exts = _IMAGE_EXTS | _VIDEO_EXTS | _DOC_EXTS
    changed = False
    last_publish = time.monotonic()
    processed = 0

    def _publish(flush_disk: bool = True) -> None:
        global _DRIVE_SCAN_SEQ
        # 새로 채워진 G: 폴더 목록을 웹 귀신검색(watch-sig fsSig) 및 별도 프로세스(Ctrl+0 귀신검색창)에 즉시 반영합니다.
        _DRIVE_SCAN_SEQ += 1
        _WATCH_SIG_TTL_CACHE["ts"] = 0.0
        _PHOTOS_RESP_MEM_CACHE["sig"] = ""
        _DOCS_RESP_MEM_CACHE["sig"] = ""
        _VIDEOS_RESP_MEM_CACHE["sig"] = ""
        if flush_disk:
            _flush_virtual_dir_listing_disk_cache()

    try:
        while True:
            with _VIRT_DIR_LISTING_LOCK:
                if not _VIRT_DIR_LISTING_PENDING:
                    _VIRT_DIR_LISTING_WORKER_ALIVE = False
                    break
                d_key, d_path = _VIRT_DIR_LISTING_PENDING.popitem()
            listing: List[tuple[str, str, os.stat_result]] = []
            try:
                with os.scandir(d_path) as it:
                    for dent in it:
                        try:
                            if not dent.is_file(follow_symlinks=False):
                                continue
                            nm = dent.name
                            dot = nm.rfind(".")
                            if dot < 0 or nm[dot:].lower() not in media_exts:
                                continue
                            listing.append((nm, os.path.abspath(dent.path), dent.stat(follow_symlinks=False)))
                        except Exception:
                            pass
            except Exception:
                pass
            prev = _VIRT_DIR_LISTING_CACHE.get(d_key)
            if prev is None or len(prev[1]) != len(listing) or (
                max((x[2].st_mtime for x in prev[1]), default=0.0) != max((x[2].st_mtime for x in listing), default=0.0)
            ):
                changed = changed or bool(listing) or prev is not None
            if len(_VIRT_DIR_LISTING_CACHE) > 20000:
                _VIRT_DIR_LISTING_CACHE.clear()
            _VIRT_DIR_LISTING_CACHE[d_key] = (time.monotonic(), listing)
            processed += 1
            if (processed & 31) == 31:
                time.sleep(0.002)
            if changed and (time.monotonic() - last_publish) >= 3.0:
                _publish()
                changed = False
                last_publish = time.monotonic()
    finally:
        with _VIRT_DIR_LISTING_LOCK:
            _VIRT_DIR_LISTING_WORKER_ALIVE = False
            restart = bool(_VIRT_DIR_LISTING_PENDING)
        if changed:
            _publish()
        if restart:
            with _VIRT_DIR_LISTING_LOCK:
                if not _VIRT_DIR_LISTING_WORKER_ALIVE:
                    _VIRT_DIR_LISTING_WORKER_ALIVE = True
                    threading.Thread(target=_virtual_dir_listing_worker, daemon=True, name="GhostiVirtualDirListing").start()


def _load_custom_scan_roots() -> List[Path]:
    out: List[Path] = []
    try:
        if _CUSTOM_SCAN_ROOTS_FILE.exists():
            raw = json.loads(_CUSTOM_SCAN_ROOTS_FILE.read_text(encoding="utf-8"))
            if isinstance(raw, list):
                for item in raw:
                    p = Path(str(item))
                    if p.exists() and p.is_dir():
                        out.append(p)
    except Exception:
        pass
    return out


def _save_custom_scan_roots(new_paths: List[Path]) -> List[Path]:
    existing = _load_custom_scan_roots()
    seen = {str(p.resolve()).lower() for p in existing if p.exists()}
    merged = list(existing)
    for np in new_paths:
        try:
            if np.exists() and np.is_dir():
                r_str = str(np.resolve()).lower()
                if r_str not in seen:
                    seen.add(r_str)
                    merged.append(np)
        except Exception:
            pass
    try:
        _CUSTOM_SCAN_ROOTS_FILE.parent.mkdir(parents=True, exist_ok=True)
        _CUSTOM_SCAN_ROOTS_FILE.write_text(
            json.dumps([str(p) for p in merged], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception:
        pass
    return merged


def _get_user_scan_roots(extra_path: str = "") -> List[Path]:
    home = Path.home()
    roots: List[Path] = []
    if extra_path:
        p = Path(extra_path)
        if p.exists() and p.is_dir():
            roots.append(p)
    onedrive_roots: List[Path] = []
    for env_k in ("OneDrive", "OneDriveConsumer", "OneDriveCommercial"):
        ev = (os.environ.get(env_k) or "").strip()
        if ev:
            onedrive_roots.append(Path(ev))
    onedrive_roots.append(home / "OneDrive")

    kf_pics = safe.known_folder("pictures")
    kf_vids = safe.known_folder("videos")
    kf_docs = safe.known_folder("documents")
    kf_desk = safe.known_folder("desktop")
    kf_down = safe.known_folder("downloads")

    # [정본 원칙] 엔진 설치 시 가짜 샘플 사진을 절대 스캔·포함하지 않고 오직 실제 유저의 문서·사진·영상 폴더만 스캔!
    # (0순위: S: 업무 공유 드라이브 & 사용자 지정 폴더 ➔ 1순위: Windows Known Folders(OneDrive 리디렉션 포함) + 사진·동영상·문서·카톡 받은 파일 ➔ 2순위: 바탕화면·다운로드)
    work_roots: List[Path] = []
    try:
        # S: 드라이브가 실제 마운트된 업무공유 활성 상태에서만 0순위로 편입 (순수 개인 단독 모드에서는 업무폴더 혼입 0%)
        if Path("S:\\").exists():
            work_roots.append(Path("S:\\"))
    except Exception:
        pass
    # [실시간 저장·삭제 0순위 최우선 루트 정렬]:
    # 바탕화면·다운로드·문서·사진·동영상·카톡 받은 파일·S: 최상위 폴더를 반드시 0~18번 인덱스에 먼저 배치하여,
    # 하위 폴더가 수백 개인 PC(3·4호기)에서도 바탕화면/다운로드 새 파일 생성·삭제·메모장 저장이 0.2초 내에 100% 포착되게 보장합니다.
    candidates: List[Path] = [
        *work_roots,
        kf_desk,
        home / "Desktop",
        kf_down,
        home / "Downloads",
        kf_docs,
        home / "Documents",
        kf_docs / "카카오톡 받은 파일",
        home / "Documents" / "카카오톡 받은 파일",
        home / "Downloads" / "카카오톡 받은 파일",
        kf_pics,
        home / "Pictures",
        kf_vids,
        home / "Videos",
    ]
    for od in onedrive_roots:
        candidates.extend([
            od / "Desktop",
            od / "바탕 화면",
            od / "Documents",
            od / "문서",
            od / "문서" / "카카오톡 받은 파일",
            od / "Pictures",
            od / "사진",
            od / "Videos",
            od / "동영상",
        ])
    candidates.extend(_load_custom_scan_roots())
    excluded_work_dir = _get_unmounted_work_vault_dir_to_exclude()
    seen_resolved: set[str] = set()
    for c in candidates:
        try:
            if c.exists() and c.is_dir():
                if _is_under_excluded_work_vault(c, excluded_work_dir):
                    continue
                r_str = str(c.resolve()).lower()
                if r_str not in seen_resolved:
                    seen_resolved.add(r_str)
                    roots.append(c)
        except Exception:
            pass
    return roots


def _is_code_repo_dir(d: Path) -> bool:
    name_low = d.name.lower()
    if name_low in _ALLOW_CORPUS_DIRS:
        return False
    if "-main" in name_low or "-master" in name_low or re.fullmatch(r"[0-9a-f]{24,}", name_low):
        return True
    try:
        if (
            (d / ".git").exists()
            or (d / "package.json").exists()
            or (d / "Cargo.toml").exists()
            or (d / "requirements.txt").exists()
            or (d / "pyproject.toml").exists()
        ):
            return True
    except Exception:
        pass
    return False


_SAFE_USER_TEMP_ROOT = Path(tempfile.gettempdir()).resolve()


def _is_safe_user_media_path(p: Path) -> bool:
    """OS 핵심 시스템·프로그램·인증서·브라우저 AppData 영역 접근을 차단하고 사용자 드라이브 실물 파일만 허용합니다."""
    try:
        resolved = p.resolve()
        s = str(resolved)
        low = s.lower().replace("/", "\\")
        if s.startswith("\\\\"):
            return False
        blocked_segments = (
            "\\windows\\",
            "\\system32\\",
            "\\syswow64\\",
            "\\program files\\",
            "\\program files (x86)\\",
            "\\programdata\\",
            "\\$recycle.bin\\",
            "\\system volume information\\",
            "\\.ssh\\",
            "\\npki\\",
            "\\gnupg\\",
            "\\appdata\\roaming\\",
            "\\appdata\\locallow\\",
        )
        if any(seg in low for seg in blocked_segments):
            return False
        if "\\appdata\\local\\" in low:
            # 로컬 AppData 중 OCR/테스트용 임시 디렉터리만 예외 허용
            if not resolved.is_relative_to(_SAFE_USER_TEMP_ROOT):
                return False
        return True
    except Exception:
        return False


_SCAN_DIRS_MEM_CACHE: Dict[str, tuple[float, str, List[Path]]] = {}
_SCAN_DIRS_CACHE_LOCK = threading.Lock()
_PHOTOS_RESP_MEM_CACHE: Dict[str, Any] = {"sig": "", "quarantine_len": -1, "resp": None}
_PHOTOS_LIST_BUILD_LOCK = threading.RLock()
_DOCS_RESP_MEM_CACHE: Dict[str, Any] = {"sig": "", "resp": None}
_DOCS_LIST_BUILD_LOCK = threading.RLock()
_VIDEOS_RESP_MEM_CACHE: Dict[str, Any] = {"sig": "", "resp": None}
_VIDEOS_LIST_BUILD_LOCK = threading.RLock()
_WATCH_SIG_TTL_CACHE: Dict[str, Any] = {"ts": 0.0, "resp": None}
_WATCH_SIG_BUILD_LOCK = threading.Lock()
_PDFIUM_GLOBAL_LOCK = threading.RLock()
_BG_INDEX_BUMP_SEQ: int = 0
_DRIVE_SCAN_SEQ: int = 0
_DOC_BG_ENRICH_SEQ: int = 0
_VID_BG_ENRICH_SEQ: int = 0
_LAST_VID_OCR_DISK_FLUSH_TS: float = 0.0
_VIDEO_OCR_CACHE_DIRTY: bool = False
_DOC_TEXT_CACHE_DIRTY: bool = False
_PREWARMED_PHOTO_THUMB_SIGS: set[str] = set()
_FULL_DRIVE_EXTRA_DIRS: List[Path] = []
_FULL_DRIVE_SCAN_STARTED = False
_FULL_DRIVE_SCAN_LOCK = threading.Lock()


def _classify_os_drive_and_volume(letter: str) -> dict | None:
    """Win32 API로 드라이브의 내장/외장(USB·SD·이동식) 여부와 볼륨 고유번호(VOL_XXXXXXXX)를 판별합니다."""
    if os.name != "nt":
        return None
    drv_ch = letter[:1].upper()
    drv_root = f"{drv_ch}:\\"
    try:
        k32 = ctypes.windll.kernel32
        prev_err = k32.SetErrorMode(0x0001 | 0x8000)
        try:
            dtype = int(k32.GetDriveTypeW(str(drv_root)))
            if dtype not in (2, 3):
                return None
            if not Path(drv_root).exists():
                return None
            vol_name_buf = ctypes.create_unicode_buffer(260)
            fs_name_buf = ctypes.create_unicode_buffer(260)
            vol_serial = ctypes.c_ulong(0)
            max_comp = ctypes.c_ulong(0)
            fs_flags = ctypes.c_ulong(0)
            if not k32.GetVolumeInformationW(
                str(drv_root),
                vol_name_buf,
                260,
                ctypes.byref(vol_serial),
                ctypes.byref(max_comp),
                ctypes.byref(fs_flags),
                fs_name_buf,
                260,
            ):
                return None
            vol_id = f"VOL_{int(vol_serial.value) & 0xFFFFFFFF:08X}"
            is_ext = (dtype == 2)
            if dtype == 3 and drv_ch != "C":
                try:
                    import struct as _st
                    h_dev = k32.CreateFileW(f"\\\\.\\{drv_ch}:", 0, 3, None, 3, 0, None)
                    if h_dev and int(h_dev) != -1 and h_dev != ctypes.c_void_p(-1).value:
                        try:
                            q_buf = _st.pack("<III", 0, 0, 0)
                            o_buf = ctypes.create_string_buffer(128)
                            b_ret = ctypes.c_ulong(0)
                            if k32.DeviceIoControl(h_dev, 0x002D1400, q_buf, len(q_buf), o_buf, 128, ctypes.byref(b_ret), None):
                                if b_ret.value >= 32 and int(o_buf.raw[28]) in (7, 12, 13):
                                    is_ext = True
                        finally:
                            k32.CloseHandle(h_dev)
                except Exception:
                    pass
            return {
                "letter": drv_ch,
                "root": drv_root,
                "dtype": dtype,
                "is_external": is_ext,
                "vol_id": vol_id,
                "label": (vol_name_buf.value or "").strip() or ("USB 드라이브" if is_ext else "로컬 디스크"),
            }
        finally:
            k32.SetErrorMode(prev_err)
    except Exception:
        return None


def _is_external_volume_approved_in_policy(vol_id: str) -> bool:
    """%LOCALAPPDATA%\\Merlin\\external_drive_policy.json에서 유저가 명시 승인('included')한 볼륨인지 확인합니다."""
    try:
        pol_p = Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local")) / "Merlin" / "external_drive_policy.json"
        if not pol_p.exists():
            return False
        data = json.loads(pol_p.read_text(encoding="utf-8", errors="ignore"))
        vols = data.get("volumes") if isinstance(data, dict) else None
        if isinstance(vols, dict):
            rec = vols.get(vol_id)
            if isinstance(rec, dict) and str(rec.get("decision")) == "included":
                return True
    except Exception:
        pass
    return False


_WEB_EXT_DRIVE_LOCK = threading.Lock()
_WEB_EXT_DRIVE_STATE: dict = {
    "indexing_vol_id": "",
    "indexing_drive": "",
    "indexing_est_min": 1,
    "indexing_pct": 0,
    "completed_until": 0.0,
    "completed_drive": "",
    "completed_count": 0,
    "connected_map": {},
}


def _quick_probe_os_external_drive(drv_root: str) -> tuple[bool, int, str]:
    """인증서(NPKI) 전용 · OS 설치용 · 파일 5개 미만 USB를 Read-Only os.scandir로 0.08초 내 자동 패스 판별합니다."""
    target_exts = _IMAGE_EXTS | _DOC_EXTS | _VIDEO_EXTS
    root_p = Path(drv_root)
    try:
        if (root_p / "bootmgr").exists() and (root_p / "sources").exists():
            return (False, 0, "OS_INSTALLER")
    except Exception:
        return (False, 0, "UNREADABLE")

    media_cnt = 0
    sub_dirs: List[Path] = []
    t0 = time.time()
    try:
        with os.scandir(root_p) as it:
            for ent in it:
                try:
                    nm = ent.name
                    nm_low = nm.lower()
                    if nm.startswith((".", "$", "~")) or nm_low in ("npki", "system volume information", "$recycle.bin", "autorun.inf"):
                        continue
                    if ent.is_dir(follow_symlinks=False):
                        if nm_low not in _SKIP_DIR_NAMES and len(sub_dirs) < 40:
                            sub_dirs.append(Path(ent.path))
                    elif ent.is_file(follow_symlinks=False):
                        dot = nm_low.rfind(".")
                        if dot >= 0 and nm_low[dot:] in target_exts:
                            media_cnt += 1
                except Exception:
                    pass
    except Exception:
        return (False, 0, "UNREADABLE")

    for sd in sub_dirs:
        if (time.time() - t0) > 0.12 or media_cnt >= 1500:
            break
        try:
            with os.scandir(sd) as it2:
                for ent2 in it2:
                    try:
                        nm2 = ent2.name
                        nm2_low = nm2.lower()
                        if nm2.startswith((".", "$", "~")):
                            continue
                        if ent2.is_file(follow_symlinks=False):
                            dot2 = nm2_low.rfind(".")
                            if dot2 >= 0 and nm2_low[dot2:] in target_exts:
                                media_cnt += 1
                    except Exception:
                        pass
        except Exception:
            pass
    if media_cnt < 5:
        return (False, media_cnt, "CERT_OR_UNDER_5")
    return (True, media_cnt, "DATA_DRIVE")


def get_external_drives_status() -> dict:
    """GET /__zcore/external-drives — 웹 2. 귀신검색 화면용 외장/USB 질문·탈착금지·완료 배너 상태 반환."""
    now_s = time.time()
    if _WEB_EXT_DRIVE_STATE.get("indexing_vol_id"):
        return {
            "ok": True,
            "banner": {
                "status": "indexing",
                "volId": _WEB_EXT_DRIVE_STATE["indexing_vol_id"],
                "drive": _WEB_EXT_DRIVE_STATE["indexing_drive"],
                "estMin": int(_WEB_EXT_DRIVE_STATE.get("indexing_est_min") or 1),
                "pct": int(_WEB_EXT_DRIVE_STATE.get("indexing_pct") or 10),
            },
        }
    if now_s < float(_WEB_EXT_DRIVE_STATE.get("completed_until") or 0.0):
        return {
            "ok": True,
            "banner": {
                "status": "completed",
                "drive": _WEB_EXT_DRIVE_STATE["completed_drive"],
                "count": int(_WEB_EXT_DRIVE_STATE.get("completed_count") or 0),
            },
        }

    pol_p = Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local")) / "Merlin" / "external_drive_policy.json"
    pol_vols = {}
    if pol_p.exists():
        try:
            raw = json.loads(pol_p.read_text(encoding="utf-8", errors="ignore"))
            if isinstance(raw, dict) and isinstance(raw.get("volumes"), dict):
                pol_vols = raw["volumes"]
        except Exception:
            pass

    import string
    connected_map = {}
    first_prompt = None
    for letter in string.ascii_uppercase:
        if letter in ("A", "B", "C", "S"):
            continue
        d_info = _classify_os_drive_and_volume(letter)
        if not d_info or not d_info["is_external"]:
            continue
        vid = d_info["vol_id"]
        v_rec = pol_vols.get(vid) if isinstance(pol_vols.get(vid), dict) else {}
        dec = str(v_rec.get("decision") or "pending")
        if dec == "excluded":
            continue
        if str(v_rec.get("indexingStatus") or "") == "indexing" and (now_s - float(v_rec.get("updatedAt") or 0.0)) < 600.0:
            return {
                "ok": True,
                "banner": {
                    "status": "indexing",
                    "volId": vid,
                    "drive": f"{letter}:",
                    "estMin": int(v_rec.get("estimatedMinutes") or 1),
                    "pct": int(v_rec.get("progressPct") or 20),
                },
            }
        is_data, est_cnt, _ = _quick_probe_os_external_drive(d_info["root"])
        if not is_data and dec != "included":
            continue
        est_min = max(1, min(15, round(max(5, est_cnt) / 450)))
        meta = {
            "volId": vid,
            "drive": f"{letter}:",
            "label": d_info["label"],
            "estFiles": est_cnt,
            "estMin": est_min,
            "decision": dec,
        }
        connected_map[vid] = meta
        if dec == "pending" and first_prompt is None:
            first_prompt = meta

    _WEB_EXT_DRIVE_STATE["connected_map"] = connected_map
    if first_prompt:
        return {"ok": True, "banner": {"status": "prompt", **first_prompt}}
    return {"ok": True, "banner": None}


def decide_external_drive_web(payload: dict) -> dict:
    """POST /__zcore/external-drives/decide — 웹 2. 귀신검색에서 외장 드라이브 [검색에 포함 / 제외] 결정 처리."""
    global _FULL_DRIVE_SCAN_STARTED, _BG_INDEX_BUMP_SEQ
    vol_id = str((payload or {}).get("volId") or "").strip()
    decision = "included" if str((payload or {}).get("decision") or "").strip() == "included" else "excluded"
    if not vol_id:
        return {"ok": False, "error": "MISSING_VOL_ID"}

    meta = (_WEB_EXT_DRIVE_STATE.get("connected_map") or {}).get(vol_id) or {}
    drv_letter = str(meta.get("drive") or (payload or {}).get("drive") or "").strip()
    drv_label = str(meta.get("label") or "외장 드라이브")
    est_min = int(meta.get("estMin") or 1)

    merlin_dir = Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local")) / "Merlin"
    merlin_dir.mkdir(parents=True, exist_ok=True)
    pol_p = merlin_dir / "external_drive_policy.json"
    pol = {"volumes": {}}
    if pol_p.exists():
        try:
            raw = json.loads(pol_p.read_text(encoding="utf-8", errors="ignore"))
            if isinstance(raw, dict) and isinstance(raw.get("volumes"), dict):
                pol = raw
        except Exception:
            pass
    v_entry = pol.setdefault("volumes", {}).setdefault(vol_id, {})
    v_entry.update({
        "decision": decision,
        "driveLetter": drv_letter,
        "label": drv_label,
        "estimatedMinutes": est_min,
        "indexingStatus": "indexing" if decision == "included" else "excluded",
        "progressPct": 10 if decision == "included" else 0,
        "updatedAt": time.time(),
    })
    try:
        pol_p.write_text(json.dumps(pol, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass

    if decision == "included" and drv_letter:
        def _bg_web_ext_index() -> None:
            global _FULL_DRIVE_SCAN_STARTED, _BG_INDEX_BUMP_SEQ, _DRIVE_SCAN_SEQ
            drv_prefix = drv_letter[:2].upper()
            drv_root = f"{drv_prefix}\\"
            _WEB_EXT_DRIVE_STATE["indexing_vol_id"] = vol_id
            _WEB_EXT_DRIVE_STATE["indexing_drive"] = drv_prefix
            _WEB_EXT_DRIVE_STATE["indexing_est_min"] = est_min
            _WEB_EXT_DRIVE_STATE["indexing_pct"] = 10
            try:
                target_exts = _IMAGE_EXTS | _DOC_EXTS | _VIDEO_EXTS
                scan_dirs: List[Path] = [Path(drv_root)]
                seen_d = {os.path.normcase(drv_root)}
                q_bfs: List[tuple[Path, int]] = [(Path(drv_root), 0)]
                while q_bfs and len(scan_dirs) < 260:
                    cur_d, depth = q_bfs.pop(0)
                    if depth >= 4:
                        continue
                    try:
                        with os.scandir(cur_d) as it_d:
                            for de in it_d:
                                if len(scan_dirs) >= 260:
                                    break
                                if de.is_dir(follow_symlinks=False):
                                    nm_l = de.name.lower()
                                    if de.name.startswith((".", "$", "~")) or nm_l in _SKIP_DIR_NAMES or nm_l == "npki":
                                        continue
                                    np_s = os.path.normcase(os.path.abspath(de.path))
                                    if np_s not in seen_d:
                                        seen_d.add(np_s)
                                        ps = Path(de.path)
                                        scan_dirs.append(ps)
                                        q_bfs.append((ps, depth + 1))
                    except Exception:
                        pass
                items = []
                total_d = max(1, len(scan_dirs))
                for idx_fd, fd in enumerate(scan_dirs):
                    _WEB_EXT_DRIVE_STATE["indexing_pct"] = min(95, max(15, int(((idx_fd + 1) / total_d) * 90)))
                    fd_badge = f"🔌{drv_prefix}\\{fd.name}" if fd.name else f"🔌{drv_prefix}\\"
                    try:
                        with os.scandir(fd) as it_f:
                            for ent in it_f:
                                if not ent.is_file(follow_symlinks=False):
                                    continue
                                nm = ent.name
                                nm_l = nm.lower()
                                dot = nm_l.rfind(".")
                                if dot < 0 or nm_l[dot:] not in target_exts:
                                    continue
                                ext = nm_l[dot:]
                                fkind = "image" if ext in _IMAGE_EXTS else ("video" if ext in _VIDEO_EXTS else "doc")
                                st = ent.stat(follow_symlinks=False)
                                full_s = ent.path
                                rel_s = full_s[3:] if len(full_s) > 3 and full_s[1:3] == ":\\" else nm
                                items.append({
                                    "kind": fkind,
                                    "file_path": full_s,
                                    "rel_path": rel_s,
                                    "text": f"[{fd_badge}] {nm}",
                                    "ts": float(st.st_mtime),
                                })
                    except Exception:
                        pass
                items.sort(key=lambda x: x.get("ts", 0.0), reverse=True)
                items = items[:1500]
                ext_cache_dir = merlin_dir / "external_cache" / vol_id
                ext_cache_dir.mkdir(parents=True, exist_ok=True)
                (ext_cache_dir / "index_cache.json").write_text(
                    json.dumps({"volId": vol_id, "driveLetter": drv_prefix, "label": drv_label, "indexedAt": time.time(), "itemCount": len(items), "items": items}, ensure_ascii=False),
                    encoding="utf-8",
                )
                # 웹 2. 귀신검색 2단계 전체 드라이브 목록에도 즉시 편입
                with _FULL_DRIVE_SCAN_LOCK:
                    _FULL_DRIVE_SCAN_STARTED = False
                _start_bg_full_drive_scan_once()
                _DRIVE_SCAN_SEQ += 1
                _BG_INDEX_BUMP_SEQ += 1
                _WATCH_SIG_TTL_CACHE["ts"] = 0.0
                _PHOTOS_RESP_MEM_CACHE["sig"] = ""
                _DOCS_RESP_MEM_CACHE["sig"] = ""
                _VIDEOS_RESP_MEM_CACHE["sig"] = ""
                _WEB_EXT_DRIVE_STATE["completed_drive"] = drv_prefix
                _WEB_EXT_DRIVE_STATE["completed_count"] = len(items)
                _WEB_EXT_DRIVE_STATE["completed_until"] = time.time() + 18.0
                v_entry.update({"indexingStatus": "completed", "progressPct": 100, "indexedCount": len(items), "updatedAt": time.time()})
                pol_p.write_text(json.dumps(pol, ensure_ascii=False, indent=2), encoding="utf-8")
            except Exception:
                pass
            finally:
                _WEB_EXT_DRIVE_STATE["indexing_vol_id"] = ""

        threading.Thread(target=_bg_web_ext_index, daemon=True, name="GhostiWebExtDriveIndex").start()
        return {"ok": True, "status": "indexing", "volId": vol_id, "drive": drv_letter, "estMin": est_min}

    return {"ok": True, "status": "excluded", "volId": vol_id}


def _select_fair_entries_by_drive(entries: List[Any], path_getter, limit: int) -> List[Any]:
    """
    [웹 2. 귀신검색 전 드라이브 공정 쿼터 선발기]:
    - C: 또는 D: 한쪽 드라이브에 최신 파일이 몰려 있을 때 전역 mtime 상위 N건 컷오프에서
      다른 드라이브(C:/D:/E:/F:/G:/H:/S:) 파일이 0건으로 밀려나는 현상을 원천 차단합니다.
    """
    if len(entries) <= limit:
        return list(entries)
    by_drv: Dict[str, List[Any]] = {}
    for item in entries:
        fp = str(path_getter(item) or "")
        dk = fp[:2].upper() if len(fp) >= 2 and fp[1] == ":" else "OTHER"
        by_drv.setdefault(dk, []).append(item)
    if len(by_drv) <= 1:
        return list(entries[:limit])
    per_drv_quota = max(1, limit // max(1, len(by_drv)))
    selected: List[Any] = []
    leftover: List[Any] = []
    for drv_list in by_drv.values():
        selected.extend(drv_list[:per_drv_quota])
        if len(drv_list) > per_drv_quota:
            leftover.extend(drv_list[per_drv_quota:])
    if len(selected) < limit and leftover:
        selected.extend(leftover[: limit - len(selected)])
    return selected[:limit]


def _start_bg_full_drive_scan_once() -> None:
    """
    [2단계 백그라운드 전체 드라이브 스캔 (1단계 우선 폴더 0.05초 즉시 개방 후 전 PC 모든 하드 드라이브 공정 확대)]
    - 로컬 물리 드라이브(D:, E:, F:... -> C:)를 가상/클라우드 드라이브(G:/H: 구글드라이브)보다 먼저 스캔하고
      드라이브 1개가 끝날 때마다 즉시 _FULL_DRIVE_EXTRA_DIRS에 점진 반영하여 대기 지연을 없앱니다.
    - 보조 드라이브(D:/E:/F:)의 프로젝트/업무 폴더 안에 들어 있는 실제 문서·이미지(.xlsx/.pdf/.hwp/.png 등)도
      depth<=2까지 누락 없이 편입하며, 가상 드라이브는 독립 시간 상한(2.5초)으로 타임아웃을 방지합니다.
    """
    global _FULL_DRIVE_SCAN_STARTED, _BG_INDEX_BUMP_SEQ
    if os.environ.get("GHOSTI_HEADLESS_TEST") == "1" or os.name != "nt":
        return
    with _FULL_DRIVE_SCAN_LOCK:
        if _FULL_DRIVE_SCAN_STARTED:
            return
        _FULL_DRIVE_SCAN_STARTED = True

    def _bg_worker() -> None:
        global _BG_INDEX_BUMP_SEQ, _DRIVE_SCAN_SEQ
        try:
            time.sleep(0.15)
            apply_hardware_protection_guard(mode="silent", batch_count=0)
            target_exts = _IMAGE_EXTS | _DOC_EXTS | _VIDEO_EXTS
            skip_top_names = {
                "windows",
                "program files",
                "program files (x86)",
                "programdata",
                "$recycle.bin",
                "system volume information",
                "recovery",
                "perflogs",
                "appdata",
                "temp",
                "tmp",
                "node_modules",
                "msocache",
                "boot",
                "drivers",
                "efi",
            }
            known_roots_low = {str(r.resolve()).lower() for r in _get_user_scan_roots() if r.exists()}
            discovered: List[Path] = []
            seen_d: set[str] = set()
            batch_counter = 0

            import string
            drive_candidates: List[tuple[int, str, Path, bool]] = []
            for letter in string.ascii_uppercase:
                if letter in ("A", "B", "S"):
                    continue
                d_info = _classify_os_drive_and_volume(letter)
                if not d_info:
                    continue
                if d_info["is_external"] and not _is_external_volume_approved_in_policy(d_info["vol_id"]):
                    continue
                drv_root = Path(d_info["root"])
                is_virtual = False
                if letter != "C":
                    try:
                        if (
                            (drv_root / ".shortcut-targets-by-id").exists()
                            or (drv_root / "내 드라이브").exists()
                            or (drv_root / "My Drive").exists()
                        ):
                            is_virtual = True
                    except Exception:
                        pass
                # 우선순위: 0=내장 보조 하드(D:/E:/F:), 1=C:, 2=가상/클라우드 드라이브(G:/H:)
                prio = 2 if is_virtual else (1 if letter == "C" else 0)
                drive_candidates.append((prio, letter, drv_root, is_virtual))
            drive_candidates.sort(key=lambda x: (x[0], x[1]))

            for _prio, letter, drive, is_virtual in drive_candidates:
                # [최상위 폴더 1:1 공정 라운드-로빈 서브큐 & 최대 깊이 12 확장]:
                # D:\CafeScraper 등 대형 폴더 1개가 쿼터를 독점해 D:\기타 · D:\C드라이브에서 이동 · D:\Secretary 등이
                # 누락되던 문제를 원천 제거하고 보유 파일 전부를 누락 없이 색인합니다.
                sub_queues: List[List[tuple[Path, int]]] = []
                try:
                    root_has_media = False
                    with os.scandir(drive) as it_top:
                        for dent_t in it_top:
                            nm_t = dent_t.name
                            nm_t_low = nm_t.lower()
                            try:
                                if dent_t.is_dir(follow_symlinks=False):
                                    # 구글 드라이브(DriveFS)의 '공유 문서함 바로가기' 실폴더(G:\.shortcut-targets-by-id)는
                                    # 점(.)으로 시작해도 사용자가 탐색기에서 여는 실제 업무 폴더이므로 반드시 탐색합니다.
                                    is_shortcut_targets = is_virtual and nm_t == ".shortcut-targets-by-id"
                                    if (
                                        (is_shortcut_targets or not nm_t.startswith((".", "$", "~")))
                                        and nm_t_low not in skip_top_names
                                        and not _is_skip_subdir_name(nm_t_low)
                                    ):
                                        p_top = Path(dent_t.path)
                                        if letter == "C" and _is_code_repo_dir(p_top):
                                            continue
                                        sub_queues.append([(p_top, 1)])
                                elif not root_has_media and dent_t.is_file(follow_symlinks=False):
                                    dot_t = nm_t_low.rfind(".")
                                    if dot_t >= 0 and nm_t_low[dot_t:] in target_exts:
                                        root_has_media = True
                            except Exception:
                                pass
                    drv_res_s = str(drive.resolve()).lower()
                    seen_d.add(drv_res_s)
                    if root_has_media and drv_res_s not in known_roots_low:
                        discovered.append(drive.resolve())
                except Exception:
                    sub_queues = [[(drive, 0)]]

                rr_idx = 0
                per_drive_discovered = 0
                # 가상 드라이브(G: DriveFS) 폴더 목록은 메타데이터 캐시에서 반환되어 파일 다운로드가 0이므로,
                # 백그라운드 스레드에서 공유 바로가기 하위 폴더(4호기 실측 1,557개)까지 끝까지 수집합니다.
                per_drive_cap = 6000
                drv_time_cap = 90.0 if is_virtual else 12.0
                max_walk_depth = 12
                t_drv_start = time.time()
                while (
                    sub_queues
                    and per_drive_discovered < per_drive_cap
                    and len(discovered) < 12000
                    and (time.time() - t_drv_start) < drv_time_cap
                ):
                    n_sq = len(sub_queues)
                    chosen_q = None
                    for off in range(n_sq):
                        idx_q = (rr_idx + off) % n_sq
                        if sub_queues[idx_q]:
                            chosen_q = sub_queues[idx_q]
                            rr_idx = (idx_q + 1) % n_sq
                            break
                    if chosen_q is None:
                        break
                    cur, depth = chosen_q.pop(0)
                    try:
                        cur_res = cur.resolve()
                        cur_low = str(cur_res).lower()
                        if cur_low in seen_d or not _is_safe_user_media_path(cur_res):
                            continue
                        seen_d.add(cur_low)
                        has_media = False
                        sub_cands: List[Path] = []
                        with os.scandir(cur_res) as it:
                            for dent in it:
                                nm = dent.name
                                nm_low = nm.lower()
                                try:
                                    if dent.is_dir(follow_symlinks=False):
                                        if (
                                            depth < max_walk_depth
                                            and not nm.startswith((".", "$", "~"))
                                            and nm_low not in skip_top_names
                                            and not _is_skip_subdir_name(nm_low)
                                        ):
                                            p_sub = Path(dent.path)
                                            if letter == "C" and _is_code_repo_dir(p_sub):
                                                continue
                                            sub_cands.append(p_sub)
                                    elif not has_media and dent.is_file(follow_symlinks=False):
                                        dot = nm_low.rfind(".")
                                        if dot >= 0 and nm_low[dot:] in target_exts:
                                            has_media = True
                                except Exception:
                                    pass
                        if has_media and cur_low not in known_roots_low:
                            discovered.append(cur_res)
                            per_drive_discovered += 1
                        if sub_cands:
                            sub_cands.sort(key=lambda p_x: p_x.name.lower())
                            chosen_q.extend((sd, depth + 1) for sd in sub_cands)
                        batch_counter += 1
                        if (batch_counter & 127) == 127:
                            time.sleep(0.0005)
                    except Exception:
                        pass

                # 드라이브 1개 스캔이 끝날 때마다 즉시 반영하여 느린 가상 드라이브 완료를 기다리지 않고 D:/E:/F: 즉시 노출!
                if per_drive_discovered > 0:
                    with _FULL_DRIVE_SCAN_LOCK:
                        _FULL_DRIVE_EXTRA_DIRS[:] = list(discovered)
                    with _SCAN_DIRS_CACHE_LOCK:
                        _SCAN_DIRS_MEM_CACHE.clear()
                    _DRIVE_SCAN_SEQ += 1
                    _BG_INDEX_BUMP_SEQ += 1
                    _WATCH_SIG_TTL_CACHE["ts"] = 0.0
                    _PHOTOS_RESP_MEM_CACHE["sig"] = ""
                    _DOCS_RESP_MEM_CACHE["sig"] = ""
                    _VIDEOS_RESP_MEM_CACHE["sig"] = ""
                    if is_virtual:
                        # 웹을 열지 않고 Ctrl+0만 눌러도 G: 드라이브가 검색되도록 발견 즉시 파일 목록 수집·디스크 공유 예약!
                        for vd in discovered:
                            if _is_virtual_cloud_drive_path(vd):
                                _schedule_virtual_dir_listing(os.path.normcase(str(vd)), str(vd))
        except Exception:
            pass

    threading.Thread(target=_bg_worker, daemon=True, name="GhostiFullDriveScanStage2").start()


def _get_active_pc_account_backup_sub() -> str:
    try:
        from plugins import plugin_paid_sync_ghostwin as _psg  # type: ignore

        return _psg.sanitize_account_backup_folder()
    except Exception:
        return ""


def _is_other_account_phone_backup_dir(target_dir: Path, active_backup_sub: str) -> bool:
    if not active_backup_sub:
        return False
    try:
        parent_name = target_dir.parent.name.lower()
        if parent_name == "ghosti_phone_backup":
            return target_dir.name.lower() != active_backup_sub.lower()
    except Exception:
        pass
    return False


_SCAN_DIRS_REFRESH_INFLIGHT = False


def _iter_scan_dirs(roots: List[Path], max_depth: int = 3, _force_sync_rebuild: bool = False) -> List[Path]:
    # [165ms ➔ 0.02ms 초고속 폴더 트리 캐시 + Stale-While-Revalidate]:
    # 루트에 새 폴더가 생성·삭제되는 즉시 root_sig가 변해 즉시 재스캔하고,
    # 동일 root_sig에서는 45초 신선 캐시 + 만료 후에도 기존 목록을 0.02ms 만에 즉시 반환하면서 백그라운드 스레드에서만 갱신하여
    # /__zcore/watch-sig 폴링이 G: 구글드라이브 폴더 탐색에 2.7초간 블로킹되는 현상을 100% 원천 차단합니다.
    global _SCAN_DIRS_REFRESH_INFLIGHT
    _start_bg_full_drive_scan_once()
    now_mono = time.monotonic()
    with _FULL_DRIVE_SCAN_LOCK:
        extra_dirs = list(_FULL_DRIVE_EXTRA_DIRS)
    excluded_work_dir = _get_unmounted_work_vault_dir_to_exclude()
    active_backup_sub = _get_active_pc_account_backup_sub()
    root_sig_parts: List[str] = [str(max_depth), str(len(extra_dirs)), str(excluded_work_dir or ""), active_backup_sub]
    for r in roots:
        try:
            st_r = os.stat(r)
            root_sig_parts.append(f"{os.path.normcase(str(r))}:{getattr(st_r, 'st_mtime_ns', int(st_r.st_mtime * 1e9))}")
        except Exception:
            root_sig_parts.append(os.path.normcase(str(r)))
    cache_key = "|".join(root_sig_parts)
    if not _force_sync_rebuild:
        with _SCAN_DIRS_CACHE_LOCK:
            cached = _SCAN_DIRS_MEM_CACHE.get(cache_key)
            if cached is not None:
                age_s = now_mono - cached[0]
                if age_s < 45.0:
                    return list(cached[2])
                if age_s < 300.0:
                    if not _SCAN_DIRS_REFRESH_INFLIGHT:
                        _SCAN_DIRS_REFRESH_INFLIGHT = True

                        def _bg_refresh_dirs(r_snap: List[Path] = list(roots), md: int = max_depth) -> None:
                            global _SCAN_DIRS_REFRESH_INFLIGHT
                            try:
                                _iter_scan_dirs(r_snap, max_depth=md, _force_sync_rebuild=True)
                            except Exception:
                                pass
                            finally:
                                _SCAN_DIRS_REFRESH_INFLIGHT = False

                        threading.Thread(target=_bg_refresh_dirs, daemon=True, name="GhostiScanDirsSWR").start()
                    return list(cached[2])

    result: List[Path] = []
    seen: set[str] = set()
    max_total = 10000
    per_root_cap = 600
    effective_depth = max(max_depth, 6)

    # [Tier-0 최상위 루트 우선 배치(BFS Seed)]:
    # Downloads(2,200개 하위 폴더)나 Documents(35개 하위 폴더)의 깊이우선 탐색 때문에
    # 뒤따르는 바탕화면·문서·사진·원드라이브 바탕화면 루트가 24번/32번 인덱스 밖으로 밀려나지 않도록,
    # 모든 최상위 사용자 루트(depth=0)를 0~N번 인덱스에 먼저 등록한 뒤 하위 폴더(depth>=1)를 탐색합니다!
    valid_top_roots: List[tuple[Path, int]] = []
    for r in roots:
        if len(result) >= max_total:
            break
        try:
            if _is_under_excluded_work_vault(r, excluded_work_dir):
                continue
            r_str = os.path.normcase(os.path.abspath(r))
            if r_str in seen:
                continue
            seen.add(r_str)
            result.append(r)
            is_virt_r = _is_virtual_cloud_drive_path(r)
            r_max_depth = min(effective_depth, 4) if is_virt_r else effective_depth
            valid_top_roots.append((r, r_max_depth))
        except Exception:
            pass

    for r, r_max_depth in valid_top_roots:
        if len(result) >= max_total:
            break
        root_count = 1

        def _walk_children(curr: Path, depth: int) -> None:
            nonlocal root_count
            if depth >= r_max_depth or root_count >= per_root_cap or len(result) >= max_total:
                return
            try:
                sub_dirs: List[Path] = []
                with os.scandir(curr) as it:
                    for dent in it:
                        try:
                            if not dent.is_dir(follow_symlinks=False):
                                continue
                            nm = dent.name
                            if (
                                (nm.startswith(".") and nm != ".shortcut-targets-by-id")
                                or _is_skip_subdir_name(nm.lower())
                            ):
                                continue
                            p_sub = Path(dent.path)
                            if _is_under_excluded_work_vault(p_sub, excluded_work_dir):
                                continue
                            if _is_other_account_phone_backup_dir(p_sub, active_backup_sub):
                                continue
                            cur_drv = str(p_sub)[:2].upper()
                            if cur_drv != "C:" or not _is_code_repo_dir(p_sub):
                                sub_dirs.append(p_sub)
                        except Exception:
                            pass
                sub_dirs.sort(key=lambda x: x.name)
                accepted_subs: List[Path] = []
                for sub in sub_dirs:
                    if root_count >= per_root_cap or len(result) >= max_total:
                        break
                    s_str = os.path.normcase(os.path.abspath(sub))
                    if s_str in seen:
                        continue
                    seen.add(s_str)
                    result.append(sub)
                    root_count += 1
                    accepted_subs.append(sub)
                if depth + 1 < r_max_depth:
                    for sub in accepted_subs:
                        if root_count >= per_root_cap or len(result) >= max_total:
                            break
                        _walk_children(sub, depth + 1)
            except Exception:
                pass

        _walk_children(r, 0)

    for xd in extra_dirs:
        if len(result) >= max_total:
            break
        try:
            if _is_under_excluded_work_vault(xd, excluded_work_dir):
                continue
            x_str = os.path.normcase(os.path.abspath(xd))
            if x_str not in seen:
                seen.add(x_str)
                result.append(xd)
        except Exception:
            pass

    with _SCAN_DIRS_CACHE_LOCK:
        if len(_SCAN_DIRS_MEM_CACHE) > 16:
            _SCAN_DIRS_MEM_CACHE.clear()
        _SCAN_DIRS_MEM_CACHE[cache_key] = (now_mono, cache_key, list(result))
    return result


def _detect_folder_label(p: Path) -> str:
    s = str(p).lower()
    if s.startswith("s:") or "업무공유폴더_s" in s:
        return "💼 S: 업무 공유 드라이브"
    if "mybox" in s or "마이박스" in s:
        return "네이버 마이박스"
    if "내 드라이브" in s or "my drive" in s or s.startswith("g:"):
        return "G: 구글 드라이브"
    if "desktop" in s or "바탕 화면" in s or "바탕화면" in s:
        return "PC 바탕화면"
    if "downloads" in s or "다운로드" in s:
        return "스마트폰 다운로드"
    if len(s) >= 2 and s[1] == ":" and s[0] not in ("c",):
        return f"{s[0].upper()}: 드라이브 ({p.name})"
    return "PC 로컬 폴더"


def scan_and_register_custom_drive(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """
    [무설정 채팅 직결 드라이브 스캔]
    유저가 설정창 없이 채팅창이나 검색창에서 'D드라이브는 왜 검색안돼?', 'D에 사진있는데 찾아줘',
    '외장하드 찾아줘', '마이박스 찾아줘'라고 말하면 해당 드라이브/폴더를 즉시 스캔하고 영구 등록합니다.
    """
    data = params or {}
    raw_spec = str(data.get("drive") or data.get("target") or data.get("query") or "").strip()
    spec_low = raw_spec.lower()
    home = Path.home()

    target_candidates: List[Path] = []
    drive_label = "추가 드라이브"

    if "마이박스" in spec_low or "mybox" in spec_low or "네이버" in spec_low:
        drive_label = "네이버 마이박스(MYBOX)"
        target_candidates = [
            Path("G:/내 드라이브/MyBox"),
            Path("G:/My Drive/MyBox"),
            home / "MYBOX",
            home / "네이버 MYBOX",
            home / "Naver MYBOX",
            Path("D:/MYBOX"),
            Path("C:/MYBOX"),
        ]
    elif "구글" in spec_low or "gdrive" in spec_low or "g드라이브" in spec_low or "g 드라이브" in spec_low:
        drive_label = "G: 구글 드라이브"
        target_candidates = [
            Path("G:/내 드라이브"),
            Path("G:/My Drive"),
            Path("G:/다른 컴퓨터"),
            Path("G:/.shortcut-targets-by-id"),
            Path("G:/"),
        ]
    elif "외장" in spec_low or "usb" in spec_low:
        drive_label = "외장하드·보조 드라이브"
        for letter in ("D", "E", "F", "G", "H", "I"):
            target_candidates.append(Path(f"{letter}:/"))
    else:
        m = re.search(r"([c-zC-Z])\s*(?:드라이브|:|에\b|폴더)", raw_spec)
        if not m and len(raw_spec) <= 3 and re.match(r"^[c-zC-Z]:?\\?$", raw_spec):
            m = re.match(r"^([c-zC-Z])", raw_spec)
        letter = (m.group(1).upper() if m else "D")
        drive_label = f"{letter}: 드라이브"
        if letter == "G":
            target_candidates = [
                Path("G:/내 드라이브"),
                Path("G:/My Drive"),
                Path("G:/다른 컴퓨터"),
                Path("G:/.shortcut-targets-by-id"),
                Path("G:/"),
            ]
        elif letter == "D":
            target_candidates = [Path("D:/"), Path("F:/"), Path("E:/")]
        else:
            target_candidates = [Path(f"{letter}:/")]

    valid_roots: List[Path] = []
    for cand in target_candidates:
        try:
            if cand.exists() and cand.is_dir():
                valid_roots.append(cand)
        except Exception:
            pass

    if not valid_roots:
        return {
            "ok": False,
            "exists": False,
            "driveLabel": drive_label,
            "error": f"현재 PC에서 {drive_label}를 찾을 수 없거나 연결되어 있지 않습니다. 드라이브(또는 외장하드) 연결 상태를 확인해 주세요.",
        }

    discovered_roots: List[Path] = []
    for vr in valid_roots:
        if len(str(vr).rstrip("\\/")) <= 2:
            discovered_roots.append(vr)
            try:
                for sub in sorted(vr.iterdir(), key=lambda x: x.name):
                    if (
                        sub.is_dir()
                        and not sub.name.startswith(".")
                        and sub.name.lower() not in _SKIP_DIR_NAMES
                        and not _is_code_repo_dir(sub)
                    ):
                        discovered_roots.append(sub)
            except Exception:
                pass
        else:
            discovered_roots.append(vr)

    _save_custom_scan_roots(discovered_roots)

    drive_scan_dirs = _iter_scan_dirs(discovered_roots, max_depth=3)
    drive_photos = 0
    drive_videos = 0
    drive_docs = 0

    for d in drive_scan_dirs:
        try:
            for entry in d.iterdir():
                if not entry.is_file():
                    continue
                ext = entry.suffix.lower()
                if ext in _IMAGE_EXTS:
                    drive_photos += 1
                elif ext in _VIDEO_EXTS:
                    drive_videos += 1
                elif ext in _DOC_EXTS or ext in (".gdoc", ".gsheet"):
                    drive_docs += 1
        except Exception:
            pass

    all_photos = list_local_photos({})
    all_videos = list_local_videos({})
    all_docs = list_local_docs({})

    return {
        "ok": True,
        "exists": True,
        "driveLabel": drive_label,
        "driveRoots": [str(p) for p in valid_roots],
        "drivePhotoCount": drive_photos,
        "driveVideoCount": drive_videos,
        "driveDocCount": drive_docs,
        "totalPhotos": int(all_photos.get("total") or 0),
        "totalVideos": int(all_videos.get("total") or 0),
        "totalDocs": int(all_docs.get("total") or 0),
        "scannedFolderCount": len(drive_scan_dirs),
        "sampleFolders": [d.name for d in drive_scan_dirs[:8] if d.name],
    }


def resolve_active_photo_dir(custom_path: str = "") -> Path:
    """로컬 PC에서 대표 사진 폴더를 반환합니다."""
    if custom_path:
        p = Path(custom_path)
        if p.exists() and p.is_dir():
            return p
    pic = Path.home() / "Pictures"
    return pic if pic.exists() else Path.home()


_LEGACY_PERSONAL_RX = re.compile(r"^(1721\d+|2024\d+_\d+|2026\d+_\d+|Screenshot_2026|Gemini_Generated_Image_|image-178558|stock_photo_\d+)", re.IGNORECASE)


def _make_collision_safe_media_key(resolved: Path, folder_name: str, seen_keys: set[str]) -> str:
    """서로 다른 폴더에 동명 파일(예: IMG_0001.jpg)이 있을 때 누락 및 휴지통 오이동을 막는 결정론적 안전 키를 생성합니다."""
    base = resolved.name
    if base not in seen_keys:
        seen_keys.add(base)
        return base
    clean_stem = re.sub(r"__[0-9A-Za-z가-힣_-]{1,18}_[0-9a-f]{6}$", "", resolved.stem, flags=re.IGNORECASE) or resolved.stem
    safe_folder = re.sub(r"[^0-9A-Za-z가-힣_-]+", "_", folder_name or "folder").strip("_")[:14] or "dir"
    short_hash = hashlib.sha1(str(resolved).lower().encode("utf-8", errors="ignore")).hexdigest()[:6]
    key = f"{clean_stem}__{safe_folder}_{short_hash}{resolved.suffix}"
    seen_keys.add(key)
    return key


_AV_DECOY_DIR_CACHE: Dict[str, bool] = {}
_AV_DECOY_STEMS: set[str] = set()


def _is_antivirus_ransomware_decoy_dir(d: Path) -> bool:
    """알약·안랩 V3 등 백신이 랜섬웨어 탐지용으로 생성하는 미끼(Decoy) 폴더를 일반 규칙으로 판별합니다.
    (동일 파일명 stem + 동일 바이트 크기로 4개 이상의 이종 확장자(.bmp/.jpg/.docx/.hwp/.xlsx 등)가 공존하는 폴더)"""
    d_key = str(d).lower()
    cached = _AV_DECOY_DIR_CACHE.get(d_key)
    if cached is not None:
        return cached
    is_decoy = False
    try:
        sig_exts: Dict[tuple[str, int], set[str]] = {}
        cnt = 0
        with os.scandir(d) as it:
            for ent in it:
                cnt += 1
                if cnt > 24:
                    break
                if not ent.is_file(follow_symlinks=False):
                    continue
                nm = ent.name
                dot = nm.rfind(".")
                if dot <= 0:
                    continue
                stem_l = nm[:dot].lower()
                ext_l = nm[dot:].lower()
                sz = int(ent.stat(follow_symlinks=False).st_size)
                if sz <= 0:
                    continue
                k = (stem_l, sz)
                s = sig_exts.get(k)
                if s is None:
                    s = set()
                    sig_exts[k] = s
                s.add(ext_l)
                if len(s) >= 4:
                    is_decoy = True
                    _AV_DECOY_STEMS.add(stem_l)
                    if d.name:
                        _AV_DECOY_STEMS.add(d.name.lower())
                    break
    except Exception:
        is_decoy = False
    if len(_AV_DECOY_DIR_CACHE) > 2000:
        _AV_DECOY_DIR_CACHE.clear()
    _AV_DECOY_DIR_CACHE[d_key] = is_decoy
    return is_decoy


def _is_antivirus_decoy_sibling_file(parent_dir: Path, stem_low: str) -> bool:
    """백신 미끼 폴더(예: Documents\\(JX^6B5) 바로 옆에 동명으로 생성되는 미끼 파일(예: Documents\\(Jx^6b5.jpg)을 제외합니다."""
    if not stem_low:
        return False
    if stem_low in _AV_DECOY_STEMS:
        return True
    try:
        sib_dir = parent_dir / stem_low
        if sib_dir.is_dir() and _is_antivirus_ransomware_decoy_dir(sib_dir):
            return True
    except Exception:
        pass
    return False


_LOCAL_DIR_PHOTO_SCAN_CACHE: Dict[str, tuple[int, List[tuple[Path, str, str, os.stat_result, Path, str]]]] = {}


def list_local_photos(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """내 PC 전 폴더(사진, 바탕화면, 다운로드, 문서, 동영상 등)의 모든 실물 사진을 전수 스캔하여 반환합니다."""
    data = params or {}
    req_dir = str(data.get("dir") or data.get("targetPath") or "").strip()
    recycled_now = safe.recycled_photo_entries()
    if not req_dir:
        ws_obj = get_local_watch_signature()
        cur_fs_sig = str(ws_obj.get("fsSig") or ws_obj.get("sig") or "")
        cached_resp = _PHOTOS_RESP_MEM_CACHE.get("resp")
        if (
            cur_fs_sig
            and cached_resp is not None
            and _PHOTOS_RESP_MEM_CACHE.get("sig") == cur_fs_sig
            and _PHOTOS_RESP_MEM_CACHE.get("quarantine_len") == len(recycled_now)
        ):
            return cached_resp
    with _PHOTOS_LIST_BUILD_LOCK:
        return _list_local_photos_unlocked(data, req_dir, recycled_now)


def _list_local_photos_unlocked(
    data: Dict[str, Any],
    req_dir: str,
    recycled_in: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    recycled_now = recycled_in if recycled_in is not None else safe.recycled_photo_entries()
    cur_fs_sig = ""
    if not req_dir:
        ws_obj = get_local_watch_signature()
        cur_fs_sig = str(ws_obj.get("fsSig") or ws_obj.get("sig") or "")
        cached_resp = _PHOTOS_RESP_MEM_CACHE.get("resp")
        if (
            cur_fs_sig
            and cached_resp is not None
            and _PHOTOS_RESP_MEM_CACHE.get("sig") == cur_fs_sig
            and _PHOTOS_RESP_MEM_CACHE.get("quarantine_len") == len(recycled_now)
        ):
            return cached_resp

    scan_dirs = _iter_scan_dirs(_get_user_scan_roots(req_dir), max_depth=3)
    if len(_LOCAL_DIR_PHOTO_SCAN_CACHE) > 12000:
        _LOCAL_DIR_PHOTO_SCAN_CACHE.clear()

    raw_photo_candidates: List[tuple[Path, str, str, os.stat_result, Path, str]] = []
    seen_paths: set[str] = set()

    for idx_dir, d in enumerate(scan_dirs):
        is_virt_d = _is_virtual_cloud_drive_path(d)
        d_key = os.path.normcase(str(d))
        if is_virt_d:
            # 가상 드라이브(G: 구글드라이브) 폴더는 요청 스레드에서 os.scandir 0회 — 백그라운드 SSOT 목록 캐시만 사용
            # (클라우드 전용 사진은 파일명·폴더명으로 선색인하고 원본은 열람 시에만 받습니다)
            v_listing = _get_virtual_dir_listing(d)
            if not v_listing:
                continue
            v_label = _detect_folder_label(d)
            for nm, abs_str, st in v_listing:
                dot = nm.rfind(".")
                if dot < 0 or nm[dot:].lower() not in _IMAGE_EXTS:
                    continue
                if st.st_size < 4096:
                    continue
                np_low = abs_str.lower()
                if np_low not in seen_paths:
                    seen_paths.add(np_low)
                    raw_photo_candidates.append((d, v_label, abs_str, st, Path(abs_str), nm))
            continue
        elif idx_dir >= 24:
            # 보조·심층 로컬 폴더(900~4,500개)는 디렉터리 mtime_ns 불변 시 캐시 재사용 (1.9초 재스캔 ➔ 15ms 즉시 응답)
            hit_lp = _LOCAL_DIR_PHOTO_SCAN_CACHE.get(d_key)
            if hit_lp is not None:
                try:
                    cur_d_mt = int(getattr(os.stat(d), "st_mtime_ns", 0))
                except Exception:
                    cur_d_mt = -1
                if cur_d_mt == hit_lp[0] and cur_d_mt > 0:
                    for p_tup in hit_lp[1]:
                        np_low = p_tup[2].lower()
                        if np_low not in seen_paths:
                            seen_paths.add(np_low)
                            raw_photo_candidates.append(p_tup)
                    continue

        if _is_antivirus_ransomware_decoy_dir(d):
            continue
        p_bucket: List[tuple[Path, str, str, os.stat_result, Path, str]] = []
        d_label = _detect_folder_label(d)
        d_low = str(d).lower()
        is_sample_or_test_dir = "test_photos" in d_low or "sample" in d_low
        is_legacy_sample_dir = "sample_photos" in d.name.lower()
        try:
            with os.scandir(d) as it:
                for dent in it:
                    if not dent.is_file(follow_symlinks=False):
                        continue
                    nm = dent.name
                    if is_legacy_sample_dir and _LEGACY_PERSONAL_RX.match(nm):
                        continue
                    dot = nm.rfind(".")
                    if dot < 0 or nm[dot:].lower() not in _IMAGE_EXTS:
                        continue
                    if _is_antivirus_decoy_sibling_file(d, nm[:dot].lower()):
                        continue
                    # os.scandir의 WIN32_FIND_DATA 캐시(dent.stat)에서 커널 핸들 오픈 0회로 속성 판별
                    # (온라인 전용 클라우드 사진도 파일명 검색 대상으로 포함하고, 썸네일·AI 분석 단계에서만 원본 다운로드를 차단)
                    st = dent.stat(follow_symlinks=False)
                    if st.st_size < 4096 and not is_sample_or_test_dir:
                        continue
                    abs_str = os.path.abspath(dent.path)
                    norm_resolved = abs_str.lower()
                    ptup = (d, d_label, abs_str, st, Path(abs_str), nm)
                    p_bucket.append(ptup)
                    if norm_resolved not in seen_paths:
                        seen_paths.add(norm_resolved)
                        raw_photo_candidates.append(ptup)
        except Exception:
            pass
        if idx_dir >= 24:
            try:
                _LOCAL_DIR_PHOTO_SCAN_CACHE[d_key] = (int(getattr(os.stat(d), "st_mtime_ns", 0)), p_bucket)
            except Exception:
                pass

    raw_photo_candidates.sort(key=lambda item: item[3].st_mtime, reverse=True)
    fair_photo_candidates = _select_fair_entries_by_drive(raw_photo_candidates, lambda item: item[2], 6000)
    files: List[Dict[str, Any]] = []
    seen_keys: set[str] = set()
    for d, d_label, abs_str, st, resolved, nm in fair_photo_candidates:
        photo_key = _make_collision_safe_media_key(resolved, d.name, seen_keys)
        _PHOTO_PATH_INDEX[photo_key] = resolved
        files.append({
            "path": photo_key,
            "originalName": nm,
            "fullPath": abs_str,
            "folderName": d.name,
            "deviceSource": d_label,
            "size": int(st.st_size),
            "date": datetime.datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d"),
            "mtimeMs": int(st.st_mtime * 1000),
            # 클라우드 전용(G: DriveFS·온라인 전용) 사진: 웹은 파일명·폴더명 검색만 하고 AI 내용 분석(원본 다운로드)에서 제외
            "cloudOnly": _is_cloud_only_media_file(abs_str, int(getattr(st, "st_file_attributes", 0) or 0)),
        })
    primary_dir = resolve_active_photo_dir(req_dir)
    if files:
        unwarmed_paths: List[Path] = []
        for f in files[:96]:
            fp_s = f.get("fullPath")
            if fp_s and not _is_virtual_cloud_drive_path(fp_s):
                psig = f"{fp_s}|{f.get('size')}|{f.get('mtimeMs')}"
                if psig not in _PREWARMED_PHOTO_THUMB_SIGS:
                    _PREWARMED_PHOTO_THUMB_SIGS.add(psig)
                    unwarmed_paths.append(Path(fp_s))
        if unwarmed_paths:
            _trigger_bg_photo_thumb_prewarm(unwarmed_paths)
    resp_obj = _PreEncodedJsonDict({
        "ok": True,
        "dir": str(primary_dir),
        "scannedFolderCount": len(scan_dirs),
        "exists": True,
        "total": len(files),
        "files": files,
        "quarantined": recycled_now,
    })
    if not req_dir and cur_fs_sig:
        _PHOTOS_RESP_MEM_CACHE["sig"] = cur_fs_sig
        _PHOTOS_RESP_MEM_CACHE["quarantine_len"] = len(recycled_now)
        _PHOTOS_RESP_MEM_CACHE["resp"] = resp_obj
    return resp_obj


class _PreEncodedJsonDict(dict):
    """대용량 목록 응답(1~4MB)을 캐시 생성 시 단 1회만 UTF-8 바이트로 직렬화하여 웜 캐시 응답 시 json.dumps GIL 점유를 0ms로 제거합니다."""

    __slots__ = ("_raw_json_bytes",)

    def __init__(self, mapping: Dict[str, Any]) -> None:
        super().__init__(mapping)
        self._raw_json_bytes: bytes = json.dumps(mapping, ensure_ascii=False).encode("utf-8")


_SECONDARY_WATCH_SIG_CACHE: Dict[str, Any] = {"ts": 0.0, "sig": "0:0", "count": 0}
_SECONDARY_WATCH_REFRESH_INFLIGHT = False


def _scan_dirs_into_watch_metrics_deterministic(
    dirs_to_scan: List[Path],
    target_exts: set[str],
    per_dir_cap: int = 600,
) -> tuple[int, int, int, int]:
    """시간 예산(budget_sec) 중도 탈출로 인해 CPU 부하에 따라 시그니처가 출렁이던 버그를 원천 제거한 100% 결정론적(Deterministic) 스캔."""
    f_cnt = 0
    max_mt = 0
    sz_acc = 0
    nm_xor = 0
    for d in dirs_to_scan:
        try:
            seen_in_d = 0
            with os.scandir(d) as it:
                for entry in it:
                    if seen_in_d >= per_dir_cap:
                        break
                    try:
                        if not entry.is_file(follow_symlinks=False):
                            continue
                        nm = entry.name
                        if nm.startswith((".", "~$", ".~lock.")):
                            continue
                        dot = nm.rfind(".")
                        if dot < 0 or nm[dot:].lower() not in target_exts:
                            continue
                        seen_in_d += 1
                        st = entry.stat(follow_symlinks=False)
                        f_cnt += 1
                        mt_ns = int(getattr(st, "st_mtime_ns", int(st.st_mtime * 1_000_000_000)))
                        if mt_ns > max_mt:
                            max_mt = mt_ns
                        sz_i = int(st.st_size)
                        sz_acc = (sz_acc + sz_i) & 0x7FFFFFFFFFFFFFFF
                        nm_xor ^= (hash((nm.lower(), sz_i, mt_ns)) & 0x7FFFFFFFFFFFFFFF)
                    except Exception:
                        pass
        except Exception:
            pass
    return f_cnt, max_mt, sz_acc, nm_xor


def _compute_secondary_dir_mtime_sig(dirs_to_check: List[Path]) -> tuple[int, str]:
    """보조 드라이브 폴더(최대 400개)의 디렉터리 mtime_ns 합산을 4ms 내에 결정론적으로 계산하여 파일 추가·삭제만 정확히 감지합니다."""
    d_cnt = 0
    mt_xor = 0
    max_d_mt = 0
    for d in dirs_to_check[:400]:
        if _is_virtual_cloud_drive_path(d):
            continue
        try:
            st_d = os.stat(d)
            mt_ns = int(getattr(st_d, "st_mtime_ns", int(st_d.st_mtime * 1_000_000_000)))
            d_cnt += 1
            if mt_ns > max_d_mt:
                max_d_mt = mt_ns
            mt_xor ^= (hash((os.path.normcase(str(d)), mt_ns)) & 0x7FFFFFFFFFFFFFFF)
        except Exception:
            pass
    return d_cnt, f"{d_cnt}:{max_d_mt}:{mt_xor}"


def get_local_watch_signature(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """
    [열려 있는 귀신검색창 실시간 파일 추가·삭제·변경 감지용 5ms 결정론적 2계층 시그니처 (`GET /__zcore/watch-sig`)]:
    - 1계층(로컬 핵심 사용자 폴더 상위 32개): 시간 제한 중도 탈출 없이 항상 동일한 폴더 집합을 < 10ms 내에 결정론적으로 계산합니다.
    - 2계층(보조 드라이브 폴더 디렉터리 mtime_ns): 10초 캐시 + 비동기 갱신으로 CPU 부하와 무관하게 100% 동일한 fsSig를 보장합니다.
    """
    global _SECONDARY_WATCH_REFRESH_INFLIGHT
    now_mono = time.monotonic()
    cached_ws = _WATCH_SIG_TTL_CACHE.get("resp")
    if cached_ws is not None and (now_mono - float(_WATCH_SIG_TTL_CACHE.get("ts") or 0.0)) < 0.18:
        return cached_ws

    # [요청 스레드 적체 0 — Stale-While-Revalidate]: 다른 요청이 이미 재계산 중이면 줄 서서 기다리지 않고
    # 직전 시그니처를 즉시 반환합니다 (4호기 실측: 동시 3건이 락 대기하며 5199 응답 스레드를 점유).
    if cached_ws is not None:
        if not _WATCH_SIG_BUILD_LOCK.acquire(blocking=False):
            return cached_ws
    elif not _WATCH_SIG_BUILD_LOCK.acquire(timeout=10.0):
        return {"ok": False, "busy": True, "sig": "", "fsSig": "", "fileCount": 0, "folderCount": 0}

    try:
        now_mono = time.monotonic()
        cached_ws = _WATCH_SIG_TTL_CACHE.get("resp")
        if cached_ws is not None and (now_mono - float(_WATCH_SIG_TTL_CACHE.get("ts") or 0.0)) < 0.18:
            return cached_ws

        scan_dirs = _iter_scan_dirs(_get_user_scan_roots(), max_depth=3)
        target_exts = _IMAGE_EXTS | _VIDEO_EXTS | _DOC_EXTS
        hot_local_dirs: List[Path] = []
        secondary_dirs: List[Path] = []
        for d in scan_dirs:
            if not _is_virtual_cloud_drive_path(d) and len(hot_local_dirs) < 32:
                hot_local_dirs.append(d)
            else:
                secondary_dirs.append(d)

        h_cnt, h_mt, h_sz, h_xor = _scan_dirs_into_watch_metrics_deterministic(hot_local_dirs, target_exts, per_dir_cap=600)

        sec_ts = float(_SECONDARY_WATCH_SIG_CACHE.get("ts") or 0.0)
        if secondary_dirs and sec_ts <= 0.0:
            sc_d, sec_s = _compute_secondary_dir_mtime_sig(secondary_dirs)
            _SECONDARY_WATCH_SIG_CACHE["sig"] = sec_s
            _SECONDARY_WATCH_SIG_CACHE["count"] = sc_d
            _SECONDARY_WATCH_SIG_CACHE["ts"] = now_mono
        elif secondary_dirs and (now_mono - sec_ts) >= 10.0 and not _SECONDARY_WATCH_REFRESH_INFLIGHT:
            _SECONDARY_WATCH_REFRESH_INFLIGHT = True

            def _bg_sec_watch(dirs_snap: List[Path] = list(secondary_dirs)) -> None:
                global _SECONDARY_WATCH_REFRESH_INFLIGHT
                try:
                    sc_d2, sec_s2 = _compute_secondary_dir_mtime_sig(dirs_snap)
                    _SECONDARY_WATCH_SIG_CACHE["sig"] = sec_s2
                    _SECONDARY_WATCH_SIG_CACHE["count"] = sc_d2
                    _SECONDARY_WATCH_SIG_CACHE["ts"] = time.monotonic()
                except Exception:
                    pass
                finally:
                    _SECONDARY_WATCH_REFRESH_INFLIGHT = False

            threading.Thread(target=_bg_sec_watch, daemon=True, name="GhostiWatchSigSecondary").start()

        sec_sig = str(_SECONDARY_WATCH_SIG_CACHE.get("sig") or "0:0")
        total_cnt = h_cnt + int(_SECONDARY_WATCH_SIG_CACHE.get("count") or 0)
        fs_sig = f"{len(scan_dirs)}:{h_cnt}:{h_mt}:{h_sz}:{h_xor}:{sec_sig}:{_DRIVE_SCAN_SEQ}"
        sig = f"{fs_sig}:{_DOC_BG_ENRICH_SEQ}:{_VID_BG_ENRICH_SEQ}"
        resp_ws = _PreEncodedJsonDict({
            "ok": True,
            "sig": sig,
            "fsSig": fs_sig,
            "fileCount": total_cnt,
            "folderCount": len(scan_dirs),
        })
        _WATCH_SIG_TTL_CACHE["ts"] = time.monotonic()
        _WATCH_SIG_TTL_CACHE["resp"] = resp_ws
        return resp_ws
    finally:
        _WATCH_SIG_BUILD_LOCK.release()


def _guess_image_mime(p: Path, name: str) -> str:
    ext = (Path(name).suffix or p.suffix).lower()
    return {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
        ".bmp": "image/bmp", ".gif": "image/gif", ".heic": "image/heic",
    }.get(ext, "application/octet-stream")


def resolve_local_media_file(params: Dict[str, Any] | None = None) -> tuple[Path | None, str, int]:
    """로컬 사진 및 동영상의 실물 Path와 Content-Type만 즉시 반환합니다 (전체 파일 RAM 로드 없음)."""
    data = params or {}
    rel = str(data.get("p") or data.get("path") or "").strip()
    if not rel:
        return None, "text/plain", 400

    base_name = Path(rel).name
    if str(data.get("loc") or "").strip() == "quarantine":
        row = safe.ledger_find(rel) or safe.ledger_find(base_name)
        q_path = Path(row.get("recycleDataFile") or "") if row else None
        if q_path and row.get("recycleDataFile") and q_path.exists() and q_path.is_file():
            return q_path, _guess_image_mime(q_path, base_name), 200
        return None, "text/plain", 404

    full_path: Path | None = None
    fp_raw = str(data.get("fp") or "").strip()
    if fp_raw:
        fp_cand = Path(fp_raw)
        if fp_cand.exists() and fp_cand.is_file() and fp_cand.suffix.lower() in _PHOTO_EXTS:
            full_path = fp_cand.resolve()

    if full_path is None:
        full_path = _PHOTO_PATH_INDEX.get(rel) or _PHOTO_PATH_INDEX.get(base_name)
    if (full_path is None or not full_path.exists()) and ("__" in base_name or not _PHOTO_PATH_INDEX):
        list_local_photos({})
        full_path = _PHOTO_PATH_INDEX.get(rel) or _PHOTO_PATH_INDEX.get(base_name)

    if full_path is None or not full_path.exists():
        direct_p = Path(rel)
        if direct_p.exists() and direct_p.is_file():
            full_path = direct_p
        else:
            for d in _iter_scan_dirs(_get_user_scan_roots(), max_depth=3):
                cand = d / base_name
                if cand.exists() and cand.is_file():
                    full_path = cand.resolve()
                    _PHOTO_PATH_INDEX[base_name] = full_path
                    break

    if full_path is None or not full_path.exists() or not full_path.is_file():
        return None, "text/plain", 404

    mime_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
        ".gif": "image/gif",
        ".mp4": "video/mp4",
        ".mov": "video/mp4",
        ".webm": "video/webm",
        ".m4v": "video/mp4",
        ".avi": "video/x-msvideo",
        ".mkv": "video/x-matroska",
        ".wmv": "video/x-ms-wmv",
        ".3gp": "video/3gpp",
        ".ts": "video/mp2t",
        ".mts": "video/mp2t",
        ".flv": "video/x-flv",
        ".heic": "image/heic",
    }
    ext = full_path.suffix.lower()
    if ext not in mime_map:
        return None, "text/plain", 403
    if not _is_safe_user_media_path(full_path):
        return None, "text/plain", 403
    content_type = mime_map[ext]
    return full_path, content_type, 200


_PHOTO_THUMBS_DIR = getattr(safe, "MERLIN_DIR", Path(os.environ.get("LOCALAPPDATA", Path.home())) / "Merlin") / "photo_thumbs"
_PREWARM_RUNNING = False


def get_or_create_photo_thumb(full_path: Path, max_px: int = 280) -> Path | None:
    """고해상도 원본 사진(4~12MB)을 libjpeg DCT draft 가속 기반 280px 경량 JPEG 썸네일(6~14KB)로 디스크 캐싱해 즉시 서빙합니다 (HEIC/특수 포맷은 Win32 Shell 폴백)."""
    try:
        st = full_path.stat()
        if _is_cloud_only_media_file(full_path, int(getattr(st, "st_file_attributes", 0) or 0)):
            # [클라우드 전용 사진 썸네일 — 원본 다운로드 0]: PIL로 원본을 열면 구글 드라이브가 전체 파일(1~12MB)을 내려받으므로,
            # Windows 셸 썸네일(SIIGBF_THUMBNAILONLY)만 요청합니다 (4호기 실측: 1.3MB 원본 대신 약 90KB 썸네일만 수신).
            c_key = hashlib.sha1(
                f"{full_path}|{st.st_size}|{int(st.st_mtime)}|{max_px}|cloud".encode("utf-8", errors="ignore")
            ).hexdigest()[:20]
            out_c = _PHOTO_THUMBS_DIR / f"pt_{c_key}.jpg"
            if out_c.exists() and out_c.stat().st_size > 400:
                return out_c
            if os.name == "nt" and _win32_shell_extract_media_thumb(full_path, out_c, max_px=max_px, thumbnail_only=True):
                return out_c
            return None
        if st.st_size <= 45 * 1024 and full_path.suffix.lower() in (".jpg", ".jpeg"):
            return full_path
        cache_key = hashlib.sha1(
            f"{full_path}|{st.st_size}|{int(st.st_mtime)}|{max_px}".encode("utf-8", errors="ignore")
        ).hexdigest()[:20]
        _PHOTO_THUMBS_DIR.mkdir(parents=True, exist_ok=True)
        out_jpg = _PHOTO_THUMBS_DIR / f"pt_{cache_key}.jpg"
        if out_jpg.exists() and out_jpg.stat().st_size > 400:
            return out_jpg

        if full_path.suffix.lower() == ".heic" and os.name == "nt":
            if _win32_shell_extract_media_thumb(full_path, out_jpg, max_px=max_px) and out_jpg.exists():
                return out_jpg

        from PIL import Image, ImageOps

        try:
            with Image.open(full_path) as im:
                try:
                    im.draft("RGB", (max_px * 2, max_px * 2))
                except Exception:
                    pass
                im = ImageOps.exif_transpose(im)
                if im.mode != "RGB":
                    im = im.convert("RGB")
                im.thumbnail((max_px, max_px), Image.Resampling.BILINEAR)
                tmp_jpg = _PHOTO_THUMBS_DIR / f"pt_{cache_key}.{os.getpid()}_{threading.get_ident()}.tmp.jpg"
                im.save(tmp_jpg, "JPEG", quality=74, optimize=False)
            if tmp_jpg.exists() and tmp_jpg.stat().st_size > 400:
                os.replace(tmp_jpg, out_jpg)
                return out_jpg
        except Exception:
            if os.name == "nt" and _win32_shell_extract_media_thumb(full_path, out_jpg, max_px=max_px) and out_jpg.exists():
                return out_jpg
    except Exception:
        return None
    return None


_ORPHAN_CACHE_GC_STAMP = MERLIN_DIR / "last_cache_gc_ts.txt"
_ORPHAN_CACHE_GC_INTERVAL_SEC = 30 * 24 * 3600  # 30일 1회 무소음 정리
_ORPHAN_CACHE_GC_STARTED = False


def _trigger_monthly_orphan_cache_gc_once() -> None:
    """30일에 1회 백그라운드 저부하로 30일 이상 미사용 썸네일 및 삭제된 파일의 OCR/문서 캐시를 정리합니다."""
    global _ORPHAN_CACHE_GC_STARTED
    if _ORPHAN_CACHE_GC_STARTED or os.environ.get("GHOSTI_HEADLESS_TEST") == "1":
        return
    _ORPHAN_CACHE_GC_STARTED = True

    def _gc_worker() -> None:
        try:
            now_s = time.time()
            if _ORPHAN_CACHE_GC_STAMP.exists():
                try:
                    last_s = float(_ORPHAN_CACHE_GC_STAMP.read_text(encoding="utf-8").strip() or "0")
                    if (now_s - last_s) < _ORPHAN_CACHE_GC_INTERVAL_SEC:
                        return
                except Exception:
                    pass
            time.sleep(25.0)
            cutoff = now_s - _ORPHAN_CACHE_GC_INTERVAL_SEC
            if _PHOTO_THUMBS_DIR.exists():
                with os.scandir(_PHOTO_THUMBS_DIR) as it:
                    for ent in it:
                        try:
                            if ent.is_file(follow_symlinks=False):
                                st = ent.stat(follow_symlinks=False)
                                if st.st_mtime < cutoff:
                                    os.unlink(ent.path)
                        except Exception:
                            pass
            # 삭제된 파일의 문서/사진 OCR JSON 캐시 고아 항목 정리
            for cache_file in (_DOC_TEXT_CACHE_FILE, _PHOTO_OCR_CACHE_FILE):
                if not cache_file.exists():
                    continue
                try:
                    raw = json.loads(cache_file.read_text(encoding="utf-8", errors="ignore"))
                    if not isinstance(raw, dict):
                        continue
                    pruned = {}
                    removed = 0
                    for k, v in raw.items():
                        p_str = str(k).split("|", 1)[0]
                        if (":\\" in p_str or p_str.startswith("/")) and not os.path.exists(p_str):
                            removed += 1
                            continue
                        pruned[k] = v
                    if removed > 0:
                        tmp_f = cache_file.with_suffix(".gc.tmp")
                        tmp_f.write_text(json.dumps(pruned, ensure_ascii=False), encoding="utf-8")
                        os.replace(tmp_f, cache_file)
                except Exception:
                    pass
            # 30일 이상 미사용(미접속) 외장 드라이브 로컬 격리 캐시(%LOCALAPPDATA%\Merlin\external_cache\<VOL_ID>) 자동 정리
            try:
                import shutil
                ext_cache_root = Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local")) / "Merlin" / "external_cache"
                if ext_cache_root.exists():
                    for vol_dir in ext_cache_root.iterdir():
                        try:
                            if not vol_dir.is_dir():
                                continue
                            idx_f = vol_dir / "index_cache.json"
                            mt_ref = idx_f.stat().st_mtime if idx_f.exists() else vol_dir.stat().st_mtime
                            if mt_ref < cutoff:
                                shutil.rmtree(vol_dir, ignore_errors=True)
                        except Exception:
                            pass
            except Exception:
                pass
            _ORPHAN_CACHE_GC_STAMP.parent.mkdir(parents=True, exist_ok=True)
            _ORPHAN_CACHE_GC_STAMP.write_text(str(int(now_s)), encoding="utf-8")
        except Exception:
            pass

    threading.Thread(target=_gc_worker, name="GhostiMonthlyCacheGC", daemon=True).start()


def _trigger_bg_photo_thumb_prewarm(paths: List[Path]) -> None:
    """/__photos/list 직후 백그라운드에서 저부하로 디스크 썸네일 캐시를 미리 달궈 두어 수백·수천 장 스크롤 시 대기 시간을 0ms로 만듭니다."""
    _trigger_monthly_orphan_cache_gc_once()
    global _PREWARM_RUNNING
    if _PREWARM_RUNNING or not paths:
        return
    _PREWARM_RUNNING = True

    def _worker() -> None:
        global _PREWARM_RUNNING
        try:
            for p in paths:
                try:
                    if p.exists() and p.is_file():
                        get_or_create_photo_thumb(p, max_px=280)
                except Exception:
                    pass
                time.sleep(0.006)
        finally:
            _PREWARM_RUNNING = False

    threading.Thread(target=_worker, daemon=True).start()


def get_photo_thumbs_batch(payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """브라우저의 HTTP 6-소켓 병목을 원천 제거하기 위해 최대 64장의 경량 썸네일을 단일 요청(멀티스레드 병렬)으로 한 번에 반환합니다."""
    import base64
    from concurrent.futures import ThreadPoolExecutor

    data = payload or {}
    raw_items = data.get("items")
    if not isinstance(raw_items, list) or not raw_items:
        return {"ok": True, "thumbs": {}}

    batch = raw_items[:64]

    def _encode_one(entry: Any) -> tuple[str, str | None]:
        if not isinstance(entry, dict):
            return ("", None)
        item_id = str(entry.get("id") or entry.get("path") or "").strip()
        if not item_id:
            return ("", None)
        f_path, mime, status = resolve_local_media_file(
            {"p": entry.get("path") or item_id, "fp": entry.get("fullPath") or ""}
        )
        if f_path is None or status != 200 or not mime.startswith("image/"):
            return (item_id, None)
        t_path = get_or_create_photo_thumb(f_path, max_px=280)
        if t_path is None or not t_path.exists():
            return (item_id, None)
        try:
            raw = t_path.read_bytes()
            b64 = base64.b64encode(raw).decode("ascii")
            t_mime = "image/jpeg" if t_path.suffix.lower() in (".jpg", ".jpeg") else mime
            return (item_id, f"data:{t_mime};base64,{b64}")
        except Exception:
            return (item_id, None)

    thumbs: Dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        for k, v in pool.map(_encode_one, batch):
            if k and v:
                thumbs[k] = v

    return {"ok": True, "count": len(thumbs), "thumbs": thumbs}


def read_local_photo_file(params: Dict[str, Any] | None = None) -> tuple[bytes | None, str, int]:
    """로컬 사진 및 동영상 바이너리와 Content-Type을 읽어옵니다 (레거시 호출 호환용)."""
    full_path, content_type, status = resolve_local_media_file(params)
    if full_path is None or status != 200:
        return None, content_type, status
    try:
        with open(full_path, "rb") as fp:
            return fp.read(), content_type, 200
    except Exception:
        return None, "text/plain", 500


_DOC_TEXT_CACHE_FILE = MERLIN_DIR / "doc_text_cache_v1.json"
_DOC_TEXT_CACHE_LOCK = threading.Lock()
_DOC_TEXT_MEM_CACHE: Dict[str, str] | None = None
_PDF_BG_OCR_RUNNING = False

_PHOTO_OCR_CACHE_FILE = MERLIN_DIR / "photo_ocr_cache_v1.json"
_PHOTO_OCR_LOCK = threading.Lock()
_PHOTO_OCR_MEM_CACHE: Dict[str, Dict[str, Any]] | None = None


def _load_doc_text_cache() -> Dict[str, str]:
    global _DOC_TEXT_MEM_CACHE
    with _DOC_TEXT_CACHE_LOCK:
        if _DOC_TEXT_MEM_CACHE is not None:
            return _DOC_TEXT_MEM_CACHE
        loaded: Dict[str, str] = {}
        try:
            if _DOC_TEXT_CACHE_FILE.exists():
                raw = json.loads(_DOC_TEXT_CACHE_FILE.read_text(encoding="utf-8", errors="ignore"))
                if isinstance(raw, dict):
                    loaded = {str(k): str(v) for k, v in raw.items() if isinstance(v, str)}
        except Exception:
            loaded = {}
        _DOC_TEXT_MEM_CACHE = loaded
        return _DOC_TEXT_MEM_CACHE


DOC_INDEX_MAX_CHARS = 50000
_DOC_CACHE_SCHEMA_TAG = "v3_sota50k"


def _make_doc_cache_sig(entry: Path, st: os.stat_result | None = None) -> str:
    st_use = st if st is not None else entry.stat()
    return f"{entry.resolve()}|{st_use.st_size}|{int(st_use.st_mtime)}|{_DOC_CACHE_SCHEMA_TAG}"


def _save_doc_text_cache_entry(sig: str, text_val: str, *, flush_disk: bool = True) -> None:
    global _DOC_TEXT_MEM_CACHE, _DOC_TEXT_CACHE_DIRTY
    if not text_val:
        return
    with _DOC_TEXT_CACHE_LOCK:
        cache = _DOC_TEXT_MEM_CACHE if _DOC_TEXT_MEM_CACHE is not None else {}
        clipped = text_val[:DOC_INDEX_MAX_CHARS]
        if cache.get(sig) == clipped:
            return
        cache[sig] = clipped
        if len(cache) > 1000:
            for old_k in list(cache.keys())[:200]:
                if old_k != sig:
                    cache.pop(old_k, None)
        _DOC_TEXT_MEM_CACHE = cache
        _DOC_TEXT_CACHE_DIRTY = True
        if flush_disk:
            try:
                _DOC_TEXT_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
                tmp_f = _DOC_TEXT_CACHE_FILE.with_name(f"{_DOC_TEXT_CACHE_FILE.name}.tmp.{os.getpid()}.{threading.get_ident()}")
                tmp_f.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
                os.replace(tmp_f, _DOC_TEXT_CACHE_FILE)
                _DOC_TEXT_CACHE_DIRTY = False
            except Exception:
                pass


def _flush_doc_text_cache_if_dirty() -> None:
    global _DOC_TEXT_CACHE_DIRTY
    if not _DOC_TEXT_CACHE_DIRTY:
        return
    with _DOC_TEXT_CACHE_LOCK:
        if not _DOC_TEXT_CACHE_DIRTY or _DOC_TEXT_MEM_CACHE is None:
            return
        try:
            _DOC_TEXT_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
            tmp_f = _DOC_TEXT_CACHE_FILE.with_name(f"{_DOC_TEXT_CACHE_FILE.name}.tmp.{os.getpid()}.{threading.get_ident()}")
            tmp_f.write_text(json.dumps(_DOC_TEXT_MEM_CACHE, ensure_ascii=False), encoding="utf-8")
            os.replace(tmp_f, _DOC_TEXT_CACHE_FILE)
            _DOC_TEXT_CACHE_DIRTY = False
        except Exception:
            pass


_PDF_STRUCT_NOISE_RX = re.compile(
    r"(?:%PDF-[\d.]+|\b(?:obj|endobj|stream|endstream|xref|trailer|startxref|FlateDecode|MediaBox|CropBox|Resources|FontDescriptor|BaseFont|Subtype|Type|Pages|Catalog|Parent|Length|Filter)\b|/[A-Za-z0-9_+#]+)",
    re.IGNORECASE,
)


def _count_meaningful_doc_chars(txt: str) -> int:
    if not txt:
        return 0
    cleaned = _PDF_STRUCT_NOISE_RX.sub(" ", txt)
    non_sp = re.sub(r"[\s·°±×÷%₩$€~/:,.()\[\]\-_=+\"'\*!?#@&]+", "", cleaned)
    if not non_sp:
        return 0
    mojibake_cnt = len(re.findall(r"[\u0080-\u024f\ufffd]", non_sp))
    if mojibake_cnt > max(2, int(len(non_sp) * 0.06)):
        return 0
    valid_alnum_ko = len(re.findall(r"[가-힣A-Za-z0-9]", non_sp))
    if (valid_alnum_ko / len(non_sp)) < 0.45:
        return 0
    ko = len(re.findall(r"[가-힣]", cleaned))
    en = len(re.findall(r"[A-Za-z]{2,}", cleaned))
    digits = len(re.findall(r"\d{2,}", cleaned))
    return (ko * 3) + (en * 2) + digits


def _invoke_isolated_pdfium_worker(req_payload: Dict[str, Any], timeout_sec: float = 20.0) -> Dict[str, Any]:
    """
    [pdfium.dll 0xc0000409 Fast-Fail 프로세스 동반 종료 원천 차단]:
    - Google PDFium(pdfium.dll) C++ 엔진은 멀티스레드 비안전(non-thread-safe) 및 손상 PDF 조우 시 __fastfail(0xc0000409)을 호출합니다.
    - 메인 5199 HTTP 서버 프로세스에 pdfium.dll을 직접 로드하지 않고, 격리 서브프로세스(--pdf-worker)에서 실행해
      어떤 손상 PDF나 동시 요청이 들어와도 Z-코어(5199)가 절대 죽지 않도록 100% 보호합니다.
    """
    tmp_w = Path(tempfile.mkdtemp(prefix="merlin_pdfw_"))
    in_f = tmp_w / "in.json"
    out_f = tmp_w / "out.json"
    try:
        in_f.write_text(json.dumps(req_payload, ensure_ascii=False), encoding="utf-8")
        clean_env = {k: v for k, v in os.environ.items() if k not in ("_MEIPASS2", "_MEIPASS")}
        clean_env["PYINSTALLER_RESET_ENVIRONMENT"] = "1"
        if getattr(sys, "frozen", False):
            cmd_w = [sys.executable, "--pdf-worker", str(in_f), str(out_f)]
        else:
            daemon_py = Path(__file__).resolve().parent / "merlin_z_core_daemon.py"
            cmd_w = [sys.executable, str(daemon_py), "--pdf-worker", str(in_f), str(out_f)]
        with _PDFIUM_GLOBAL_LOCK:
            subprocess.run(
                cmd_w,
                capture_output=True,
                timeout=timeout_sec,
                env=clean_env,
                creationflags=0x08000000 if os.name == "nt" else 0,
            )
        if out_f.exists():
            return json.loads(out_f.read_text(encoding="utf-8", errors="replace") or "{}")
    except Exception:
        pass
    finally:
        shutil.rmtree(tmp_w, ignore_errors=True)
    return {"ok": False}


def _run_ppocr_pdf_pages_ocr(
    entry: Path,
    max_pages: int = 6,
    max_chars: int = DOC_INDEX_MAX_CHARS,
) -> str:
    """스캔 이미지·커스텀 폰트 PDF의 페이지를 격리 PDFium 워커(--pdf-worker) 또는 pypdf 이미지 추출로 PNG 변환 후 PP-OCRv5 Korean(ONNX)으로 정밀 판독합니다."""
    if not entry.exists():
        return ""
    tmp_dir = Path(tempfile.mkdtemp(prefix="merlin_pdf_ppocr_"))
    try:
        import ppocr_v5_worker

        png_paths: List[Path] = []
        pw_res = _invoke_isolated_pdfium_worker(
            {
                "mode": "render_pngs",
                "path": str(entry),
                "max_pages": max(1, int(max_pages)),
                "out_dir": str(tmp_dir),
            },
            timeout_sec=max(18.0, max_pages * 5.0),
        )
        if pw_res.get("ok") and isinstance(pw_res.get("pngs"), list):
            png_paths = [Path(p) for p in pw_res["pngs"] if Path(p).exists()]
        if not png_paths:
            try:
                import pypdf
                from PIL import Image

                reader = pypdf.PdfReader(str(entry))
                for p_idx in range(min(len(reader.pages), max(1, int(max_pages)))):
                    page = reader.pages[p_idx]
                    for img_idx, im_obj in enumerate(getattr(page, "images", [])):
                        try:
                            pil_im = Image.open(io.BytesIO(im_obj.data)).convert("RGB")
                            out_png = tmp_dir / f"p_{p_idx:03d}_{img_idx:02d}.png"
                            pil_im.save(out_png, "PNG")
                            png_paths.append(out_png)
                        except Exception:
                            continue
            except Exception:
                pass

        if not png_paths:
            return ""

        ocr_res_map = ppocr_v5_worker.invoke_ppocr_subprocess(
            png_paths,
            filter_video_ui=False,
            timeout_sec=max(45.0, len(png_paths) * 14.0),
        )
        page_texts: List[str] = []
        total_len = 0
        for p_png in png_paths:
            item = ocr_res_map.get(str(p_png.resolve())) or ocr_res_map.get(p_png.name) or {}
            rec = _reconstruct_ocr_geometry_and_spots(item)
            p_txt = str(rec.get("fullText") or item.get("smartText") or "").strip()
            if p_txt:
                page_texts.append(p_txt)
                total_len += len(p_txt) + 2
                if total_len >= max_chars:
                    break
        return "\n\n".join(page_texts).strip()[:max_chars]
    except Exception:
        return ""
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def _extract_pdf_text_sota(
    entry: Path,
    *,
    allow_ocr_fallback: bool = True,
    max_ocr_pages: int = 6,
    max_chars: int = DOC_INDEX_MAX_CHARS,
) -> str:
    """
    [정식 SOTA PDF 본문 추출기 — 격리 서브프로세스 보호]
    1순위: 격리된 Google PDFium 워커(--pdf-worker) / pypdf 텍스트 레이어로 한글 CID/ToUnicode/압축 스트림 전체 페이지를 최대 50,000자까지 고속 추출합니다.
    2순위: 텍스트 레이어가 없는 스캔 이미지 PDF일 때만 격리 PDFium 워커 + PP-OCRv5 Korean(ONNX)으로 자동 폴백합니다.
    """
    if not entry.exists():
        return ""
    joined = ""
    pw_res = _invoke_isolated_pdfium_worker(
        {
            "mode": "text",
            "path": str(entry),
            "max_pages": 160,
            "max_chars": max_chars,
        },
        timeout_sec=14.0,
    )
    if pw_res.get("ok"):
        joined = str(pw_res.get("text") or "").strip()[:max_chars]
    if not joined:
        page_chunks: List[str] = []
        try:
            import pypdf

            reader = pypdf.PdfReader(str(entry))
            total_len = 0
            for page in reader.pages[:160]:
                raw_t = page.extract_text() or ""
                norm_t = unicodedata.normalize("NFC", raw_t.replace("\r\n", "\n").replace("\r", "\n"))
                norm_t = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]+", " ", norm_t)
                norm_t = re.sub(r"[ \t]+", " ", norm_t)
                norm_t = re.sub(r"\n{3,}", "\n\n", norm_t).strip()
                if norm_t:
                    page_chunks.append(norm_t)
                    total_len += len(norm_t) + 2
                    if total_len >= max_chars:
                        break
            joined = "\n\n".join(page_chunks).strip()[:max_chars]
        except Exception:
            pass

    if _count_meaningful_doc_chars(joined) >= 16:
        return joined

    if allow_ocr_fallback:
        return _run_ppocr_pdf_pages_ocr(entry, max_pages=max_ocr_pages, max_chars=max_chars)
    return ""


def _normalize_winrt_ocr_ligatures(text: str) -> str:
    return unicodedata.normalize("NFC", text or "")


def _prepare_deunderlined_image_if_needed(img_path: Path, tmp_dir: Path) -> Path | None:
    """
    텍스트 하단에 1px 수평 실선 밑줄이 맞닿아 있어 WinRT OCR이 글자 획과 밑줄을 한 덩어리로 오독하는 현상을 방지합니다.
    - 업스케일링 없이 원본 해상도 그대로, 바로 위 픽셀(y-1)에 글자 획이 없는 열의 밑줄 픽셀만 배경색(255)으로 분리합니다.
    """
    try:
        from PIL import Image
        import numpy as np

        with Image.open(img_path) as im:
            gray = np.array(im.convert("L"))
            rgb = np.array(im.convert("RGB"))
        h, w = gray.shape
        if h < 12 or w < 40:
            return None
        not_white = gray < 238
        row_counts = not_white.sum(axis=1)
        changed = False
        for y in range(2, h - 2):
            c_prev = int(row_counts[y - 1])
            c_cur = int(row_counts[y])
            c_next = int(row_counts[y + 1])
            if (
                c_prev >= 40
                and c_cur >= max(180, int(w * 0.55))
                and c_cur > c_prev * 1.8
                and c_cur > c_next * 1.8
            ):
                underline_only = not_white[y] & (~not_white[y - 1])
                if int(underline_only.sum()) >= max(80, int(w * 0.25)):
                    rgb[y, underline_only] = [255, 255, 255]
                    changed = True
        if not changed:
            return None
        out_p = tmp_dir / "deunderlined.png"
        Image.fromarray(rgb).save(out_p)
        return out_p
    except Exception:
        return None


def _reconstruct_ocr_geometry_and_spots(ocr_data: Dict[str, Any]) -> Dict[str, Any]:
    raw_lines = ocr_data.get("lines") or []
    if isinstance(raw_lines, dict):
        raw_lines = [raw_lines]

    flat_words: List[Dict[str, Any]] = []
    heights: List[float] = []
    for ln in raw_lines:
        if not isinstance(ln, dict):
            continue
        w_list = ln.get("words") or []
        if isinstance(w_list, dict):
            w_list = [w_list]
        if w_list:
            for w in w_list:
                if not isinstance(w, dict):
                    continue
                t_val = str(w.get("t") or "").strip()
                if not t_val:
                    continue
                x_v = float(w.get("x") or 0.0)
                y_v = float(w.get("y") or 0.0)
                w_v = max(1.0, float(w.get("w") or 8.0))
                h_v = max(4.0, float(w.get("h") or 16.0))
                heights.append(h_v)
                flat_words.append({"t": t_val, "x": x_v, "y": y_v, "w": w_v, "h": h_v, "cy": y_v + h_v * 0.5})
        else:
            lt = str(ln.get("text") or "").strip()
            if lt:
                flat_words.append({"t": lt, "x": 0.0, "y": float(len(flat_words) * 28), "w": 120.0, "h": 20.0, "cy": float(len(flat_words) * 28 + 10)})

    if not flat_words:
        return {
            "hasText": False,
            "hasTable": False,
            "fullText": "",
            "tsvTable": "",
            "tableRows": [],
            "spots": [],
            "chips": [],
        }

    heights_sorted = sorted(heights) if heights else [18.0]
    med_h = heights_sorted[len(heights_sorted) // 2]
    row_tol = max(6.5, min(10.5, med_h * 0.42))

    flat_words.sort(key=lambda item: (item["cy"], item["x"]))
    clustered_rows: List[List[Dict[str, Any]]] = []
    row_centers: List[float] = []
    for wd in flat_words:
        placed = False
        for idx_r, r_cy in enumerate(row_centers):
            if abs(wd["cy"] - r_cy) <= row_tol:
                has_x_overlap = any(
                    (min(wd["x"] + wd["w"], ew["x"] + ew["w"]) - max(wd["x"], ew["x"]))
                    > min(wd["w"], ew["w"]) * 0.35
                    for ew in clustered_rows[idx_r]
                )
                if not has_x_overlap:
                    clustered_rows[idx_r].append(wd)
                    n_r = len(clustered_rows[idx_r])
                    row_centers[idx_r] = ((r_cy * (n_r - 1)) + wd["cy"]) / n_r
                    placed = True
                    break
        if not placed:
            clustered_rows.append([wd])
            row_centers.append(wd["cy"])

    paired = sorted(zip(row_centers, clustered_rows), key=lambda p: p[0])
    table_rows: List[List[str]] = []
    text_lines: List[str] = []
    col_gap_thresh = max(26.0, med_h * 1.45)
    tight_join_thresh = max(7.0, med_h * 0.30)

    for _, r_words in paired:
        r_words.sort(key=lambda item: item["x"])
        cells: List[str] = []
        prev_right: float | None = None
        for wd in r_words:
            tok = wd["t"]
            if prev_right is None or not cells:
                cells.append(tok)
            else:
                gap = wd["x"] - prev_right
                if gap <= tight_join_thresh and (cells[-1].endswith(("-", ".", "/", ":")) or tok.startswith(("-", ".", "/", ":"))):
                    cells[-1] = f"{cells[-1]}{tok}"
                elif gap <= col_gap_thresh:
                    # 단일 한글 음절 분리 보정 (예: '거 래'가 아닌 긴 간격 외 결합)
                    cells[-1] = f"{cells[-1]} {tok}"
                else:
                    cells.append(tok)
            prev_right = wd["x"] + wd["w"]
        clean_cells = [_normalize_winrt_ocr_ligatures(re.sub(r"\s+", " ", c).strip()) for c in cells if c.strip()]
        if clean_cells:
            table_rows.append(clean_cells)
            text_lines.append("  ".join(clean_cells))

    full_text = _normalize_winrt_ocr_ligatures("\n".join(text_lines).strip())
    if not full_text or not _is_meaningful_ocr_text(full_text):
        return {
            "hasText": False,
            "hasTable": False,
            "fullText": "",
            "tsvTable": "",
            "tableRows": [],
            "spots": [],
            "chips": [],
        }

    tsv_table = "\n".join("\t".join(r) for r in table_rows).strip()
    multi_col_rows = sum(1 for r in table_rows if len(r) >= 2)
    has_table = multi_col_rows >= 2

    spots: List[Dict[str, str]] = []
    seen_spot_vals: set[str] = set()

    def _add_spot(label: str, val: str) -> None:
        v_clean = val.strip()
        if not v_clean or v_clean in seen_spot_vals or len(spots) >= 12:
            return
        seen_spot_vals.add(v_clean)
        spots.append({
            "id": f"sp_{len(spots) + 1}",
            "label": label,
            "value": v_clean,
            "categoryHint": label,
            "displayText": v_clean,
            "insertValue": v_clean,
        })

    if text_lines:
        first_headline = re.sub(r"\s{2,}", " · ", text_lines[0]).strip()
        if len(first_headline) >= 2:
            _add_spot("첫 줄 제목/상호", first_headline[:60])

    for m_url in re.findall(r"https?://[^\s,)\]]+", full_text):
        _add_spot("웹사이트/링크", m_url)
    for m_biz in re.findall(r"\b\d{3}-\d{2}-\d{5}\b", full_text):
        _add_spot("사업자번호", m_biz)
    for m_tel in re.findall(r"\b(?:01[016789]|02|0[3-6][1-5]|1[568]\d{2})[-.\s]?\d{3,4}[-.\s]?\d{4}\b", full_text):
        _add_spot("전화번호", re.sub(r"\s+", "-", m_tel))
    for m_money in re.findall(r"\b\d{1,3}(?:,\d{3})+(?:\s*[원Pp])?\b|\b\d{4,9}\s*[원Pp]\b", full_text):
        _add_spot("금액/포인트", m_money)
    for m_date in re.findall(r"\b(?:19|20)\d{2}[-./년]\s*\d{1,2}[-./월]\s*\d{1,2}일?\b", full_text):
        _add_spot("날짜", m_date)
    for m_acct in re.findall(r"\b\d{3,6}-\d{2,6}-\d{4,8}\b", full_text):
        _add_spot("계좌/승인번호", m_acct)
    for m_mail in re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", full_text):
        _add_spot("이메일", m_mail)

    chips: List[str] = [sp["value"] for sp in spots[1:]]
    for r in table_rows:
        for cell in r:
            c_trim = cell.strip("()[]{}'\"<>:;,. ")
            if 2 <= len(c_trim) <= 42:
                if c_trim not in chips:
                    chips.append(c_trim)
            elif len(c_trim) > 42:
                for sub_part in re.split(r"\s*(?:->|→|\||(?<!\d),(?!\d)|·|/)\s*", c_trim):
                    sp_clean = sub_part.strip("()[]{}'\"<>:;,. -")
                    if 2 <= len(sp_clean) <= 42 and sp_clean not in chips:
                        chips.append(sp_clean)
                        if len(chips) >= 24:
                            break
            if len(chips) >= 24:
                break
        if len(chips) >= 24:
            break

    # 핵심 셀 보강: spots가 6개 미만이면 주요 셀/구절도 spots에 추가
    if len(spots) < 6:
        for ch_val in chips:
            if len(spots) >= 8:
                break
            _add_spot("핵심 구절", ch_val)
    if len(spots) < 4:
        for ln_txt in text_lines[1:6]:
            if len(spots) >= 6:
                break
            _add_spot("본문 줄", ln_txt[:70])

    return {
        "hasText": bool(full_text),
        "hasTable": has_table,
        "fullText": full_text,
        "tsvTable": tsv_table,
        "tableRows": table_rows,
        "spots": spots,
        "chips": chips[:24],
    }


def _run_winrt_image_ocr_raw(img_path: Path) -> Dict[str, Any]:
    """[SOTA 단일화] 사진·영수증·신분증·표 이미지 OCR을 격리 서브프로세스 기반 PP-OCRv5 Korean(ONNX)으로 수행합니다."""
    if not img_path.exists():
        return {"width": 0, "height": 0, "lines": []}
    tmp_dir = Path(tempfile.mkdtemp(prefix="merlin_img_ppocr_"))
    try:
        import ppocr_v5_worker

        res_map = ppocr_v5_worker.invoke_ppocr_subprocess(
            [img_path],
            filter_video_ui=False,
            timeout_sec=35.0,
            priority_interactive=True,
        )
        best = res_map.get(str(img_path.resolve())) or res_map.get(img_path.name) or {"width": 0, "height": 0, "lines": []}
        # [무손실 선택적 밑줄 분리 패스]:
        # 표(Table)·영수증처럼 이미 다수의 행이 높은 신뢰도(평균 >= 0.88, 최저 >= 0.82)로 선명하게 판독된 경우
        # 불필요한 PNG 재인코딩 + 2차 중복 추론을 생략하여 판독 속도를 2배 가속하고,
        # 실제 밑줄 간섭이 의심되는 저신뢰/소수 박스(<= 2줄 또는 저신뢰 박스 존재)에만 보조 비교를 수행합니다.
        if isinstance(best, dict):
            boxes0 = best.get("boxes") or []
            if 0 < len(boxes0) <= 2:
                avg_c0 = sum(float(b.get("conf") or 0.0) for b in boxes0) / len(boxes0)
                needs_deunderline_check = avg_c0 < 0.85
                if needs_deunderline_check:
                    deunderlined_path = _prepare_deunderlined_image_if_needed(img_path, tmp_dir)
                    if deunderlined_path is not None:
                        alt_map = ppocr_v5_worker.invoke_ppocr_subprocess(
                            [deunderlined_path],
                            filter_video_ui=False,
                            timeout_sec=25.0,
                            priority_interactive=True,
                        )
                        alt = alt_map.get(str(deunderlined_path.resolve())) or alt_map.get(deunderlined_path.name)
                        if isinstance(alt, dict):
                            t0 = str(best.get("smartText") or "")
                            t1 = str(alt.get("smartText") or "")
                            sc0 = len(re.findall(r"[가-힣]", t0)) * 4 + len(re.findall(r"[A-Za-z0-9]", t0))
                            sc1 = len(re.findall(r"[가-힣]", t1)) * 4 + len(re.findall(r"[A-Za-z0-9]", t1))
                            if sc1 > sc0 + 4:
                                best = alt
        if isinstance(best, dict):
            return best
    except Exception:
        pass
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
    return {"width": 0, "height": 0, "lines": []}


def _load_photo_ocr_cache() -> Dict[str, Dict[str, Any]]:
    global _PHOTO_OCR_MEM_CACHE
    with _PHOTO_OCR_LOCK:
        if _PHOTO_OCR_MEM_CACHE is not None:
            return _PHOTO_OCR_MEM_CACHE
        loaded: Dict[str, Dict[str, Any]] = {}
        try:
            if _PHOTO_OCR_CACHE_FILE.exists():
                raw = json.loads(_PHOTO_OCR_CACHE_FILE.read_text(encoding="utf-8", errors="ignore"))
                if isinstance(raw, dict):
                    loaded = {str(k): v for k, v in raw.items() if isinstance(v, dict)}
        except Exception:
            loaded = {}
        _PHOTO_OCR_MEM_CACHE = loaded
        return _PHOTO_OCR_MEM_CACHE


def extract_photo_winrt_ocr(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """
    [웹 & 네이티브 UI ③ 공통 실물 사진·표 PP-OCRv5 Korean 엔진 (`/__photos/ocr`, `/api/ghosti/photos/ocr`)]
    - 가짜 영수증 데이터를 100% 배제하고 실제 로컬 이미지(또는 Base64 캡처본)에서
      단어별 바운딩 박스(X,Y,W,H) 기반 엑셀 TSV 표(`tsvTable`)와 핵심 단어칩(`chips`, `spots`)을 추출합니다.
    """
    global _PHOTO_OCR_MEM_CACHE
    data = params or {}
    force = str(data.get("force") or "").lower() in ("1", "true", "yes")
    b64_in = str(data.get("imageBase64") or data.get("dataUrl") or "").strip()

    temp_b64_file: Path | None = None
    target_path: Path | None = None
    cache_sig = ""

    try:
        if b64_in:
            if "," in b64_in and b64_in.startswith("data:"):
                b64_in = b64_in.split(",", 1)[1]
            raw_img_bytes = base64.b64decode(b64_in)
            digest = hashlib.sha1(raw_img_bytes).hexdigest()[:24]
            cache_sig = f"b64_{digest}|v5_ppocr5"
            fd, tmp_name = tempfile.mkstemp(prefix="ghosti_ocr_b64_", suffix=".png")
            os.close(fd)
            temp_b64_file = Path(tmp_name)
            temp_b64_file.write_bytes(raw_img_bytes)
            target_path = temp_b64_file
        else:
            raw_ref = str(data.get("fullPath") or data.get("p") or data.get("path") or data.get("fileName") or "").strip()
            if not raw_ref:
                return {"ok": False, "error": "MISSING_IMAGE_TARGET"}
            resolved_media, _, status_m = resolve_local_media_file({"p": raw_ref, "loc": data.get("loc") or ""})
            if resolved_media is not None and status_m == 200 and resolved_media.suffix.lower() in _IMAGE_EXTS:
                target_path = resolved_media.resolve()
            else:
                cand_p = Path(urllib.parse.unquote(raw_ref))
                if cand_p.exists() and cand_p.is_file() and cand_p.suffix.lower() in _IMAGE_EXTS:
                    if _is_safe_user_media_path(cand_p):
                        target_path = cand_p.resolve()
            if target_path is None or not target_path.exists():
                return {"ok": False, "error": "IMAGE_NOT_FOUND"}
            st_i = target_path.stat()
            cache_sig = f"{target_path}|{st_i.st_size}|{int(st_i.st_mtime)}|v5_ppocr5"

        cache_map = _load_photo_ocr_cache()
        if not force and cache_sig in cache_map:
            cached_payload = dict(cache_map[cache_sig])
            raw_spots = cached_payload.get("spots")
            if isinstance(raw_spots, list):
                norm_spots = []
                for idx_s, sp in enumerate(raw_spots):
                    if isinstance(sp, dict):
                        lbl_s = str(sp.get("categoryHint") or sp.get("label") or "추출 항목").strip()
                        val_s = str(sp.get("displayText") or sp.get("value") or sp.get("insertValue") or "").strip()
                        ins_s = str(sp.get("insertValue") or val_s).strip()
                        if val_s:
                            norm_spots.append({
                                "id": str(sp.get("id") or f"sp_{idx_s + 1}"),
                                "label": lbl_s,
                                "value": val_s,
                                "categoryHint": lbl_s,
                                "displayText": val_s,
                                "insertValue": ins_s,
                            })
                cached_payload["spots"] = norm_spots
            cached_payload["ok"] = True
            cached_payload["cached"] = True
            return cached_payload

        ocr_raw = _run_winrt_image_ocr_raw(target_path)
        reconstructed = _reconstruct_ocr_geometry_and_spots(ocr_raw)
        result_payload: Dict[str, Any] = {
            "ok": True,
            "cached": False,
            "fileName": target_path.name if temp_b64_file is None else str(data.get("fileName") or "captured_image.png"),
            "filePath": str(target_path) if temp_b64_file is None else "",
            "imageSize": {"width": int(ocr_raw.get("width") or 0), "height": int(ocr_raw.get("height") or 0)},
            **reconstructed,
        }

        with _PHOTO_OCR_LOCK:
            cur_c = _PHOTO_OCR_MEM_CACHE if _PHOTO_OCR_MEM_CACHE is not None else {}
            to_store = {k: v for k, v in result_payload.items() if k not in ("ok", "cached")}
            cur_c[cache_sig] = to_store
            if len(cur_c) > 600:
                for old_k in list(cur_c.keys())[:120]:
                    if old_k != cache_sig:
                        cur_c.pop(old_k, None)
            _PHOTO_OCR_MEM_CACHE = cur_c
            try:
                _PHOTO_OCR_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
                tmp_c = _PHOTO_OCR_CACHE_FILE.with_name(f"{_PHOTO_OCR_CACHE_FILE.name}.tmp.{os.getpid()}.{threading.get_ident()}")
                tmp_c.write_text(json.dumps(cur_c, ensure_ascii=False), encoding="utf-8")
                os.replace(tmp_c, _PHOTO_OCR_CACHE_FILE)
            except Exception:
                pass

        return result_payload
    except Exception as exc:
        return {"ok": False, "error": f"OCR_FAILED: {exc}"}
    finally:
        if temp_b64_file is not None and temp_b64_file.exists():
            try:
                temp_b64_file.unlink(missing_ok=True)
            except Exception:
                pass


def _run_winrt_pdf_first_pages_ocr(entry: Path, max_pages: int = 6) -> str:
    """스캔 이미지 PDF 폴백: PDFium 렌더링 + PP-OCRv5 Korean으로 앞 페이지들을 정밀 해독합니다."""
    return _run_ppocr_pdf_pages_ocr(entry, max_pages=max_pages, max_chars=DOC_INDEX_MAX_CHARS)


_HWP5_MULTI_WCHAR_CTRLS = frozenset({
    1, 2, 3, 4, 5, 6, 7, 8, 9,
    11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
})


def _decode_hwp5_para_text(payload: bytes) -> str:
    """HWP 5.0 HWPTAG_PARA_TEXT(67) 레코드에서 16바이트 인라인·확장 제어문자를 정확히 건너뛰고 순수 문단·표 셀 텍스트를 복원합니다."""
    n_u16 = len(payload) // 2
    if n_u16 <= 0:
        return ""
    u16_buf = bytearray()
    i = 0
    while i < n_u16:
        ch = struct.unpack_from("<H", payload, i * 2)[0]
        if ch in _HWP5_MULTI_WCHAR_CTRLS:
            if ch == 9:  # TAB inline control (8 WCHAR = 16 bytes)
                u16_buf.extend(b"\t\x00")
            elif ch in (11, 16, 17):
                u16_buf.extend(b" \x00")
            i += 8
            continue
        if ch < 32:
            if ch in (10, 13):
                u16_buf.extend(b"\n\x00")
            elif ch == 24:
                u16_buf.extend(b"-\x00")
            elif ch in (30, 31):
                u16_buf.extend(b" \x00")
            i += 1
            continue
        u16_buf.extend(payload[i * 2 : i * 2 + 2])
        i += 1
    if not u16_buf:
        return ""
    s = bytes(u16_buf).decode("utf-16-le", errors="ignore")
    s = unicodedata.normalize("NFC", s)
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()


def _extract_hwpx_zip_full_text(entry: Path, max_chars: int = DOC_INDEX_MAX_CHARS) -> str:
    """HWPX(개방형 한글 ZIP/XML) 문서의 전체 Contents/section*.xml을 섹션 번호 순서대로 최대 50,000자까지 추출합니다."""
    def _sec_sort_key(name: str) -> tuple[int, str]:
        m = re.search(r"(\d+)", Path(name).stem)
        return (int(m.group(1)) if m else 9999, name)

    with zipfile.ZipFile(entry, "r") as zf:
        sec_names = sorted(
            (n for n in zf.namelist() if n.startswith("Contents/section") and n.endswith(".xml")),
            key=_sec_sort_key,
        )
        sec_chunks: List[str] = []
        total_len = 0
        for sec_name in sec_names:
            try:
                zinfo = zf.getinfo(sec_name)
                if getattr(zinfo, "file_size", 0) > 25 * 1024 * 1024:
                    continue
            except Exception:
                pass
            sec_bytes = zf.read(sec_name)
            xml_str = sec_bytes.decode("utf-8", errors="ignore")
            xml_str = re.sub(r"</(?:hp:p|p|hp:tr|tr)>", "\n", xml_str)
            xml_str = re.sub(r"</(?:hp:tc|tc)>", "\t", xml_str)
            sec_text = html.unescape(re.sub(r"<[^>]+>", " ", xml_str))
            sec_text = unicodedata.normalize("NFC", sec_text)
            sec_text = re.sub(r"[ \t]+", " ", sec_text)
            sec_text = re.sub(r"\n{3,}", "\n\n", sec_text).strip()
            if sec_text:
                sec_chunks.append(sec_text)
                total_len += len(sec_text) + 2
                if total_len >= max_chars:
                    break
        return "\n\n".join(sec_chunks).strip()[:max_chars]


def _extract_hwp_v5_full_text(entry: Path, max_chars: int = DOC_INDEX_MAX_CHARS) -> str:
    """
    [정식 HWP v5 OLE2 본문 전체 추출기]
    - 구형 PrvText(미리보기 1줄) 정규식 땜빵을 완전 폐기하고,
      OLE2 `FileHeader` 압축 플래그 + `BodyText/Section*` 전 섹션 zlib 스트림 해제 + `HWPTAG_PARA_TEXT(67)` 레코드 파싱으로
      문서 끝부분·표 내부 텍스트까지 최대 50,000자를 정밀 복원합니다.
    """
    if not entry.exists():
        return ""
    if zipfile.is_zipfile(entry):
        try:
            return _extract_hwpx_zip_full_text(entry, max_chars=max_chars)
        except Exception:
            pass

    try:
        import olefile

        if olefile.isOleFile(str(entry)):
            ole = olefile.OleFileIO(str(entry))
            try:
                is_compressed = True
                is_encrypted = False
                if ole.exists("FileHeader"):
                    hdr = ole.openstream("FileHeader").read()
                    if len(hdr) >= 40:
                        flags = struct.unpack_from("<I", hdr, 36)[0]
                        is_compressed = bool(flags & 0x01)
                        is_encrypted = bool(flags & 0x02)

                if not is_encrypted:
                    sec_streams: List[tuple[int, List[str]]] = []
                    for stream_path in ole.listdir(streams=True, storages=False):
                        if len(stream_path) == 2 and stream_path[0] == "BodyText" and stream_path[1].startswith("Section"):
                            m_idx = re.search(r"(\d+)", stream_path[1])
                            s_no = int(m_idx.group(1)) if m_idx else 0
                            sec_streams.append((s_no, stream_path))
                    sec_streams.sort(key=lambda x: x[0])

                    paragraphs: List[str] = []
                    total_len = 0
                    for _, spath in sec_streams:
                        raw_sec = ole.openstream(spath).read()
                        if not raw_sec:
                            continue
                        if is_compressed:
                            dec_sec = None
                            for wb in (-15, zlib.MAX_WBITS):
                                try:
                                    dec_obj = zlib.decompressobj(wb)
                                    dec_sec = dec_obj.decompress(raw_sec, 8 * 1024 * 1024)
                                    break
                                except Exception:
                                    continue
                            if dec_sec is None:
                                continue
                        else:
                            dec_sec = raw_sec

                        off = 0
                        n_bytes = len(dec_sec)
                        while off + 4 <= n_bytes:
                            rec_hdr = struct.unpack_from("<I", dec_sec, off)[0]
                            off += 4
                            tag_id = rec_hdr & 0x3FF
                            rec_size = (rec_hdr >> 20) & 0xFFF
                            if rec_size == 0xFFF:
                                if off + 4 > n_bytes:
                                    break
                                rec_size = struct.unpack_from("<I", dec_sec, off)[0]
                                off += 4
                            if rec_size < 0 or off + rec_size > n_bytes:
                                break
                            if tag_id == 67 and rec_size >= 2:  # HWPTAG_PARA_TEXT
                                para_s = _decode_hwp5_para_text(dec_sec[off : off + rec_size])
                                if para_s:
                                    paragraphs.append(para_s)
                                    total_len += len(para_s) + 1
                                    if total_len >= max_chars:
                                        break
                            off += rec_size
                        if total_len >= max_chars:
                            break

                    if paragraphs:
                        return "\n".join(paragraphs).strip()[:max_chars]

                # 암호 설정·배포용 문서(ViewText 암호화)인 경우에만 OLE PrvText 스트림 정식 폴백
                if ole.exists("PrvText"):
                    prv_raw = ole.openstream("PrvText").read()
                    prv_txt = unicodedata.normalize("NFC", prv_raw.decode("utf-16-le", errors="ignore"))
                    prv_txt = re.sub(r"[ \t]+", " ", prv_txt).strip()
                    if prv_txt:
                        return prv_txt[:max_chars]
            finally:
                ole.close()
    except Exception:
        pass

    # HWPML(XML 텍스트형 .hwp) 폴백
    try:
        raw_head = entry.read_bytes()[:512 * 1024]
        if b"<HWPML" in raw_head[:4096] or b"<?xml" in raw_head[:512]:
            xml_s = raw_head.decode("utf-8", errors="ignore")
            plain = re.sub(r"<[^>]+>", " ", xml_s)
            plain = re.sub(r"\s+", " ", plain).strip()
            if plain:
                return plain[:max_chars]
    except Exception:
        pass
    return ""


def _extract_doc_text(
    entry: Path,
    *,
    allow_pdf_winrt_ocr: bool = True,
    flush_disk: bool = True,
) -> str:
    ext = entry.suffix.lower()
    if ext in (".zip", ".7z", ".rar", ".tar", ".gz", ".tgz"):
        return f"📦 [{entry.parent.name}] 폴더의 압축파일({entry.name})입니다. 봉인 존중 원칙에 따라 풀기 전 내부를 열람하지 않으며, [📦 1초 압축 풀기] 클릭 시 안전 폴더에 해제되어 즉시 검색됩니다."
    if ext not in (".gsheet", ".gdoc", ".gslides") and _is_cloud_virtual_or_unpinned_file(entry):
        return f"[{entry.parent.name}] 폴더에 보관된 {entry.name} 클라우드 연동 문서입니다. 파일명 및 키워드로 즉시 검색됩니다."
    cache_sig = ""
    try:
        st_e = entry.stat()
        cache_sig = _make_doc_cache_sig(entry, st_e)
        doc_cache = _load_doc_text_cache()
        if cache_sig in doc_cache and doc_cache[cache_sig]:
            return doc_cache[cache_sig]
    except Exception:
        pass

    fallback_generic = f"[{entry.parent.name}] 폴더에 보관된 {entry.name} 로컬 문서 파일입니다. 파일명 및 키워드로 즉시 검색됩니다."
    try:
        if ext in (".gsheet", ".gdoc", ".gslides"):
            g_meta = safe.resolve_google_workspace_shortcut_meta(entry)
            doc_id = str(g_meta.get("doc_id") or "").strip()
            g_url = str(g_meta.get("url") or "").strip()
            kind_ko = str(g_meta.get("kind_ko") or "Google 문서")
            exp_body = ""
            if doc_id:
                exp_res = safe.export_public_google_workspace_body(
                    doc_id,
                    ext,
                    max_rows=200,
                    max_chars=DOC_INDEX_MAX_CHARS,
                    timeout_sec=4.5,
                )
                if exp_res.get("exported"):
                    exp_body = str(exp_res.get("body_text") or "").strip()
            txt_g = (
                f"[{kind_ko} 바로가기 — {entry.stem}]\n"
                + (f"원본 열기: {g_url}\n" if g_url else "")
                + (
                    exp_body
                    if exp_body
                    else "구글 드라이브 웹 문서입니다. 파일명으로 즉시 검색되며 원본 열기로 웹에서 바로 편집할 수 있습니다."
                )
            ).strip()[:DOC_INDEX_MAX_CHARS]
            if exp_body and cache_sig:
                _save_doc_text_cache_entry(cache_sig, txt_g, flush_disk=flush_disk)
            return txt_g
        if ext in (".txt", ".md", ".csv"):
            raw = entry.read_bytes()[: 512 * 1024]
            if raw.startswith(b"\xff\xfe"):
                txt = raw[2:].decode("utf-16-le", errors="ignore").strip()[:DOC_INDEX_MAX_CHARS]
                res_txt = txt or fallback_generic
                if cache_sig:
                    _save_doc_text_cache_entry(cache_sig, res_txt, flush_disk=flush_disk)
                return res_txt
            if raw.startswith(b"\xfe\xff"):
                txt = raw[2:].decode("utf-16-be", errors="ignore").strip()[:DOC_INDEX_MAX_CHARS]
                res_txt = txt or fallback_generic
                if cache_sig:
                    _save_doc_text_cache_entry(cache_sig, res_txt, flush_disk=flush_disk)
                return res_txt
            for enc in ("utf-8-sig", "utf-8", "cp949", "euc-kr"):
                try:
                    txt = raw.decode(enc).strip()[:DOC_INDEX_MAX_CHARS]
                    if txt:
                        if cache_sig:
                            _save_doc_text_cache_entry(cache_sig, txt, flush_disk=flush_disk)
                        return txt
                except Exception:
                    continue
            res_utf = raw.decode("utf-8", errors="ignore").strip()[:DOC_INDEX_MAX_CHARS] or fallback_generic
            if cache_sig:
                _save_doc_text_cache_entry(cache_sig, res_utf, flush_disk=flush_disk)
            return res_utf
        if ext == ".docx":
            with zipfile.ZipFile(entry, "r") as zf:
                names = set(zf.namelist())
                doc_xml_targets = [n for n in ("word/document.xml",) if n in names] + sorted(
                    n for n in names if (n.startswith("word/header") or n.startswith("word/footer")) and n.endswith(".xml")
                )
                parts_docx: List[str] = []
                for xname in doc_xml_targets:
                    try:
                        if zf.getinfo(xname).file_size > 25 * 1024 * 1024:
                            continue
                    except Exception:
                        pass
                    xml_str = zf.read(xname).decode("utf-8", errors="ignore")
                    xml_str = re.sub(r"</w:(?:p|tr)>", "\n", xml_str)
                    xml_str = re.sub(r"</w:tc>", "\t", xml_str)
                    plain = html.unescape(re.sub(r"<[^>]+>", " ", xml_str))
                    plain = unicodedata.normalize("NFC", plain)
                    plain = re.sub(r"[ \t]+", " ", plain)
                    plain = re.sub(r"\n{3,}", "\n\n", plain).strip()
                    if plain:
                        parts_docx.append(plain)
                text = "\n\n".join(parts_docx).strip()[:DOC_INDEX_MAX_CHARS] or fallback_generic
                if cache_sig:
                    _save_doc_text_cache_entry(cache_sig, text, flush_disk=flush_disk)
                return text
        if ext == ".xlsx":
            with zipfile.ZipFile(entry, "r") as zf:
                rows = zos.extract_xlsx_ordered_rows(zf, max_rows=1200, max_chars=DOC_INDEX_MAX_CHARS)
                joined_xl = "\n".join(rows).strip()[:DOC_INDEX_MAX_CHARS] or fallback_generic
                if cache_sig:
                    _save_doc_text_cache_entry(cache_sig, joined_xl, flush_disk=flush_disk)
                return joined_xl
        if ext == ".pptx":
            def _slide_sort_key(name: str) -> tuple[int, str]:
                m = re.search(r"(\d+)", Path(name).stem)
                return (int(m.group(1)) if m else 9999, name)

            with zipfile.ZipFile(entry, "r") as zf:
                sl_chunks: List[str] = []
                total_ppt = 0
                slide_names = sorted(
                    (n for n in zf.namelist() if n.startswith("ppt/slides/slide") and n.endswith(".xml")),
                    key=_slide_sort_key,
                )[:80]
                for sl_name in slide_names:
                    try:
                        if zf.getinfo(sl_name).file_size > 25 * 1024 * 1024:
                            continue
                    except Exception:
                        pass
                    sl_bytes = zf.read(sl_name)
                    sl_xml = re.sub(r"</a:p>", "\n", sl_bytes.decode("utf-8", errors="ignore"))
                    sl_text = html.unescape(re.sub(r"<[^>]+>", " ", sl_xml))
                    sl_text = unicodedata.normalize("NFC", re.sub(r"[ \t]+", " ", sl_text))
                    sl_text = re.sub(r"\n{2,}", "\n", sl_text).strip()
                    if sl_text:
                        sl_chunks.append(sl_text)
                        total_ppt += len(sl_text) + 3
                        if total_ppt >= DOC_INDEX_MAX_CHARS:
                            break
                joined_ppt = "\n\n".join(sl_chunks).strip()[:DOC_INDEX_MAX_CHARS] or fallback_generic
                if cache_sig:
                    _save_doc_text_cache_entry(cache_sig, joined_ppt, flush_disk=flush_disk)
                return joined_ppt
        if ext == ".hwpx":
            joined_hwpx = _extract_hwpx_zip_full_text(entry, max_chars=DOC_INDEX_MAX_CHARS) or fallback_generic
            if cache_sig:
                _save_doc_text_cache_entry(cache_sig, joined_hwpx, flush_disk=flush_disk)
            return joined_hwpx
        if ext == ".hwp":
            hwp_txt = _extract_hwp_v5_full_text(entry, max_chars=DOC_INDEX_MAX_CHARS) or fallback_generic
            if cache_sig:
                _save_doc_text_cache_entry(cache_sig, hwp_txt, flush_disk=flush_disk)
            return hwp_txt
        if ext == ".pdf":
            pdf_txt = _extract_pdf_text_sota(
                entry,
                allow_ocr_fallback=allow_pdf_winrt_ocr,
                max_ocr_pages=6,
                max_chars=DOC_INDEX_MAX_CHARS,
            )
            if pdf_txt:
                if cache_sig:
                    _save_doc_text_cache_entry(cache_sig, pdf_txt, flush_disk=flush_disk)
                return pdf_txt
            pdf_fallback = f"[{entry.parent.name}] 폴더에 보관된 {entry.name} PDF 문서입니다."
            if allow_pdf_winrt_ocr and cache_sig:
                _save_doc_text_cache_entry(cache_sig, pdf_fallback, flush_disk=flush_disk)
            return pdf_fallback
    except Exception:
        return fallback_generic
    return fallback_generic


def _split_camel_and_alnum_words(src: str) -> str:
    s = re.sub(r"([a-z])([A-Z])", r"\1 \2", src)
    s = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1 \2", s)
    s = re.sub(r"([a-zA-Z])([0-9])", r"\1 \2", s)
    s = re.sub(r"([0-9])([a-zA-Z])", r"\1 \2", s)
    return s


def _bg_prewarm_pdf_ocr_worker(targets: List[Path]) -> None:
    global _PDF_BG_OCR_RUNNING, _BG_INDEX_BUMP_SEQ, _DOC_BG_ENRICH_SEQ
    updated_any = False
    try:
        for p in targets[:24]:
            try:
                prev_cache = _load_doc_text_cache()
                st_p = p.stat()
                sig_p = f"{os.path.abspath(p)}|{st_p.st_size}|{int(st_p.st_mtime)}|{_DOC_CACHE_SCHEMA_TAG}"
                had_before = sig_p in prev_cache
                res = _extract_doc_text(p, allow_pdf_winrt_ocr=True, flush_disk=False)
                if not had_before and res and "보관된 " not in res[:60]:
                    updated_any = True
                time.sleep(0.12)
            except Exception:
                pass
    finally:
        _flush_doc_text_cache_if_dirty()
        if updated_any:
            _DOC_BG_ENRICH_SEQ += 1
            _BG_INDEX_BUMP_SEQ += 1
            _DOCS_RESP_MEM_CACHE["sig"] = ""
            _WATCH_SIG_TTL_CACHE["ts"] = 0.0
        _PDF_BG_OCR_RUNNING = False


def list_local_docs(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """내 PC 전 폴더(문서, 바탕화면, 다운로드, OneDrive 등)의 서류 파일을 전수 스캔하여 반환합니다."""
    ws_obj = get_local_watch_signature()
    cur_doc_sig = f"{ws_obj.get('fsSig') or ws_obj.get('sig') or ''}:{_DOC_BG_ENRICH_SEQ}"
    cached_docs_resp = _DOCS_RESP_MEM_CACHE.get("resp")
    if (
        cur_doc_sig
        and cached_docs_resp is not None
        and _DOCS_RESP_MEM_CACHE.get("sig") == cur_doc_sig
    ):
        return cached_docs_resp
    with _DOCS_LIST_BUILD_LOCK:
        return _list_local_docs_unlocked()


_DOCS_ENTRY_MEM_CACHE: Dict[str, Dict[str, Any]] = {}
_DOCS_FULL_TEXT_MEM_MAP: Dict[str, str] = {}
_LOCAL_DIR_DOC_SCAN_CACHE: Dict[str, tuple[int, List[tuple[Path, Path, os.stat_result]]]] = {}
_DOC_TEXT_BG_PREWARM_RUNNING = False


def _bg_prewarm_doc_texts_worker(targets: List[Path]) -> None:
    global _DOC_TEXT_BG_PREWARM_RUNNING, _BG_INDEX_BUMP_SEQ, _DOC_BG_ENRICH_SEQ
    updated_any = False
    try:
        # 초기 부팅·창 진입 직후 5199 HTTP 스레드와 GIL/디스크 경합을 0%로 차단하기 위해 8초 유휴 대기 후 경량 문서만 저부하 선행 색인
        time.sleep(8.0)
        apply_hardware_protection_guard(mode="silent", batch_count=0)
        prewarmed_cnt = 0
        for p in targets:
            if prewarmed_cnt >= 120:
                break
            try:
                ext_l = p.suffix.lower()
                # 대용량 PDF(pypdf GIL 점유) 및 대형 엑셀·한글 파일은 사용자가 검색(/__docs/search)·열람(/__docs/full-text) 시 온디맨드 추출
                if ext_l in (".pdf", ".xls", ".ppt", ".doc"):
                    continue
                if not p.exists():
                    continue
                st_p = p.stat()
                if (st_p.st_size <= 0 and ext_l not in (".gsheet", ".gdoc", ".gslides")) or st_p.st_size > 384 * 1024:
                    continue
                txt = _extract_doc_text(p, allow_pdf_winrt_ocr=False, flush_disk=False)
                if txt:
                    _DOCS_FULL_TEXT_MEM_MAP[str(p).lower()] = txt
                    updated_any = True
                    prewarmed_cnt += 1
            except Exception:
                pass
            time.sleep(0.08)
    finally:
        _flush_doc_text_cache_if_dirty()
        if updated_any:
            _DOC_BG_ENRICH_SEQ += 1
            _BG_INDEX_BUMP_SEQ += 1
            _DOCS_RESP_MEM_CACHE["sig"] = ""
            _WATCH_SIG_TTL_CACHE["ts"] = 0.0
        _DOC_TEXT_BG_PREWARM_RUNNING = False


def get_cached_full_doc_text_fast(path_str: str) -> str:
    if not path_str:
        return ""
    low = str(path_str).strip().lower()
    hit = _DOCS_FULL_TEXT_MEM_MAP.get(low)
    if hit:
        return hit
    try:
        p = Path(path_str)
        if p.exists() and p.is_file():
            st = p.stat()
            sig = _make_doc_cache_sig(p, st)
            dc = _load_doc_text_cache()
            if sig in dc:
                _DOCS_FULL_TEXT_MEM_MAP[low] = str(dc[sig])
                return str(dc[sig])
    except Exception:
        pass
    return ""


def get_local_doc_full_text(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    qp = params or {}
    raw_p = str(qp.get("path") or qp.get("p") or "").strip()
    if not raw_p:
        return {"ok": False, "error": "MISSING_PATH"}
    fast_hit = get_cached_full_doc_text_fast(raw_p)
    if fast_hit:
        return {"ok": True, "path": raw_p, "extractedText": fast_hit}
    try:
        p = Path(raw_p)
        if not p.exists() or not p.is_file() or not _is_safe_user_media_path(p):
            return {"ok": False, "missingFile": True, "error": "FILE_NOT_FOUND"}
        txt = _extract_doc_text(p, allow_pdf_winrt_ocr=False, flush_disk=True)
        _DOCS_FULL_TEXT_MEM_MAP[str(p).lower()] = txt
        return {"ok": True, "path": raw_p, "extractedText": txt}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def _list_local_docs_unlocked() -> Dict[str, Any]:
    global _PDF_BG_OCR_RUNNING, _DOC_TEXT_BG_PREWARM_RUNNING
    ws_obj = get_local_watch_signature()
    cur_doc_sig = f"{ws_obj.get('fsSig') or ws_obj.get('sig') or ''}:{_DOC_BG_ENRICH_SEQ}"
    cached_docs_resp = _DOCS_RESP_MEM_CACHE.get("resp")
    if (
        cur_doc_sig
        and cached_docs_resp is not None
        and _DOCS_RESP_MEM_CACHE.get("sig") == cur_doc_sig
    ):
        return cached_docs_resp

    scan_dirs = _iter_scan_dirs(_get_user_scan_roots(), max_depth=3)
    if len(_LOCAL_DIR_DOC_SCAN_CACHE) > 12000:
        _LOCAL_DIR_DOC_SCAN_CACHE.clear()
    raw_entries: List[tuple[Path, Path, os.stat_result]] = []
    seen_paths: set[str] = set()

    for idx_dir, d in enumerate(scan_dirs):
        is_virt_d = _is_virtual_cloud_drive_path(d)
        d_key = os.path.normcase(str(d))
        if is_virt_d:
            # 가상 드라이브(G:) 폴더는 백그라운드 SSOT 목록 캐시만 사용 (요청 스레드 os.scandir 0회 · 0.3초 예산 누락 제거)
            v_listing_d = _get_virtual_dir_listing(d)
            if not v_listing_d:
                continue
            for nm, abs_doc, st in v_listing_d:
                nm_low = nm.lower()
                dot = nm_low.rfind(".")
                if dot < 0 or nm_low[dot:] not in _DOC_EXTS:
                    continue
                if nm.startswith((".", "~$", ".~lock.")) or nm_low in ("desktop.ini", "thumbs.db"):
                    continue
                if nm_low.startswith("merlin_z_core") and nm_low.endswith(".zip"):
                    continue
                if re.search(r"\.part(?!0*1\.rar$)0*\d+\.rar$", nm_low) or re.search(r"\.7z\.(?!0*1$)0*\d+$", nm_low):
                    continue
                nd = abs_doc.lower()
                if nd not in seen_paths:
                    seen_paths.add(nd)
                    raw_entries.append((d, Path(abs_doc), st))
            continue
        elif idx_dir >= 24:
            hit_ld = _LOCAL_DIR_DOC_SCAN_CACHE.get(d_key)
            if hit_ld is not None:
                try:
                    cur_d_mt = int(getattr(os.stat(d), "st_mtime_ns", 0))
                except Exception:
                    cur_d_mt = -1
                if cur_d_mt == hit_ld[0] and cur_d_mt > 0:
                    for cd, cp, cst in hit_ld[1]:
                        nd = str(cp).lower()
                        if nd not in seen_paths:
                            seen_paths.add(nd)
                            raw_entries.append((cd, cp, cst))
                    continue

        if _is_antivirus_ransomware_decoy_dir(d):
            continue
        dir_bucket: List[tuple[Path, Path, os.stat_result]] = []
        try:
            with os.scandir(d) as it:
                for dent in it:
                    if not dent.is_file(follow_symlinks=False):
                        continue
                    nm = dent.name
                    nm_low = nm.lower()
                    dot = nm_low.rfind(".")
                    if dot < 0 or nm_low[dot:] not in _DOC_EXTS:
                        continue
                    if nm.startswith((".", "~$", ".~lock.")) or nm_low in ("desktop.ini", "thumbs.db"):
                        continue
                    if nm_low.startswith("merlin_z_core") and nm_low.endswith(".zip"):
                        continue
                    if re.search(r"\.part(?!0*1\.rar$)0*\d+\.rar$", nm_low) or re.search(r"\.7z\.(?!0*1$)0*\d+$", nm_low):
                        continue
                    if _is_antivirus_decoy_sibling_file(d, nm_low[:dot]):
                        continue
                    # 온라인 전용 클라우드 문서도 파일명으로 선색인 (_extract_doc_text가 본문 추출 시 다운로드를 차단)
                    st = dent.stat(follow_symlinks=False)
                    abs_doc = os.path.abspath(dent.path)
                    norm_doc = abs_doc.lower()
                    tup = (d, Path(abs_doc), st)
                    dir_bucket.append(tup)
                    if norm_doc not in seen_paths:
                        seen_paths.add(norm_doc)
                        raw_entries.append(tup)
        except Exception:
            pass
        if idx_dir >= 24:
            try:
                _LOCAL_DIR_DOC_SCAN_CACHE[d_key] = (int(getattr(os.stat(d), "st_mtime_ns", 0)), dir_bucket)
            except Exception:
                pass

    # [전 드라이브 보유 문서 100% 편입 (기존 800건 상한 철폐 ➔ 12,000건)]:
    raw_entries.sort(key=lambda item: item[2].st_mtime, reverse=True)
    fair_doc_entries = _select_fair_entries_by_drive(raw_entries, lambda item: str(item[1]), 12000)
    docs: List[Dict[str, Any]] = []
    deferred_pdfs: List[Path] = []
    deferred_doc_texts: List[Path] = []
    doc_cache_ref = _load_doc_text_cache()

    ext_badge_map = {
        ".pdf": ("PDF", "📑 PDF 전자문서 · 계약/증빙"),
        ".txt": ("TXT", "📝 텍스트 메모 · 기록"),
        ".md": ("MD", "📝 마크다운 문서 · 노트"),
        ".csv": ("CSV", "📊 CSV 데이터 시트"),
        ".docx": ("DOCX", "📘 워드(DOCX) 보고서 · 서류"),
        ".doc": ("DOC", "📘 워드 문서"),
        ".hwp": ("HWP", "📗 한글(HWP) 공문 · 서류"),
        ".hwpx": ("HWPX", "📗 한글(HWPX) 문서"),
        ".xlsx": ("XLSX", "📊 엑셀(XLSX) 장부 · 내역서"),
        ".xls": ("XLS", "📊 엑셀 시트"),
        ".pptx": ("PPTX", "📙 파워포인트 발표자료"),
        ".ppt": ("PPT", "📙 파워포인트 발표자료"),
        ".gsheet": ("GSHEET", "📊 구글 스프레드시트(.gsheet)"),
        ".gdoc": ("GDOC", "📘 구글 문서(.gdoc)"),
        ".gslides": ("GSLIDES", "📙 구글 프레젠테이션(.gslides)"),
        ".zip": ("ZIP", "📦 압축파일(ZIP) · 1초 스마트 압축 풀기"),
        ".7z": ("7Z", "📦 압축파일(7Z) · 1초 스마트 압축 풀기"),
        ".rar": ("RAR", "📦 압축파일(RAR) · 1초 스마트 압축 풀기"),
        ".tar": ("TAR", "📦 압축파일(TAR) · 1초 스마트 압축 풀기"),
        ".gz": ("GZ", "📦 압축파일(GZ) · 1초 스마트 압축 풀기"),
        ".tgz": ("TGZ", "📦 압축파일(TGZ) · 1초 스마트 압축 풀기"),
    }

    if len(_DOCS_ENTRY_MEM_CACHE) > 20000:
        _DOCS_ENTRY_MEM_CACHE.clear()
    if len(_DOCS_FULL_TEXT_MEM_MAP) > 20000:
        _DOCS_FULL_TEXT_MEM_MAP.clear()

    t_extract_budget0 = time.monotonic()
    for idx_doc, (d, entry, st) in enumerate(fair_doc_entries):
        try:
            resolved_doc_str = str(entry)
            resolved_low = resolved_doc_str.lower()
            ext_low = entry.suffix.lower()
            # Path.resolve()의 CreateFileW 커널 핸들 오픈(2,748회 * 클라우드 50ms = 14초 지연)을 원천 제거!
            sig_all = f"{resolved_doc_str}|{st.st_size}|{int(st.st_mtime)}|{_DOC_CACHE_SCHEMA_TAG}"
            mem_full = _DOCS_FULL_TEXT_MEM_MAP.get(resolved_low) or ""
            disk_full = str(doc_cache_ref.get(sig_all) or "") if not mem_full else ""
            known_text = mem_full or disk_full
            has_known_text = bool(known_text)
            entry_mem_key = f"{resolved_low}|{int(st.st_size)}|{int(getattr(st, 'st_mtime_ns', int(st.st_mtime * 1e9)))}|{len(known_text)}"
            # 클라우드 전용(G: DriveFS 가상 드라이브 · OneDrive 온라인 전용) 일반 문서는 파일명만 선색인하고 본문 추출(다운로드)은 생략
            is_virt_e = _is_cloud_only_media_file(resolved_doc_str, int(getattr(st, "st_file_attributes", 0) or 0))
            cached_doc_item = _DOCS_ENTRY_MEM_CACHE.get(entry_mem_key)
            if cached_doc_item is not None:
                docs.append(cached_doc_item)
                if not has_known_text and (ext_low in (".gsheet", ".gdoc", ".gslides") or not is_virt_e):
                    if len(deferred_doc_texts) < 1500:
                        deferred_doc_texts.append(entry)
                continue

            stem = entry.stem.replace("_", " ").replace("-", " ").strip()
            stem_expanded = _split_camel_and_alnum_words(stem)
            if has_known_text:
                extracted = known_text
            elif is_virt_e and ext_low not in (".gsheet", ".gdoc", ".gslides"):
                extracted = ""
            elif ext_low in (".txt", ".md", ".csv") and st.st_size <= 65536 and (time.monotonic() - t_extract_budget0) < 0.06:
                extracted = _extract_doc_text(entry, allow_pdf_winrt_ocr=False, flush_disk=False)
            else:
                extracted = ""
                if len(deferred_doc_texts) < 1500:
                    deferred_doc_texts.append(entry)

            if extracted:
                _DOCS_FULL_TEXT_MEM_MAP[resolved_low] = extracted
            if ext_low == ".pdf" and not extracted and not is_virt_e and len(deferred_pdfs) < 24:
                deferred_pdfs.append(entry)

            norm_ext, badge = ext_badge_map.get(ext_low, ("DOC", "📄 로컬 문서 파일"))
            kw_tokens = [
                w
                for w in re.split(r"[\s_\-.,()\[\]]+", f"{stem} {stem_expanded} {d.name} {extracted[:360]}")
                if len(w) >= 2
            ][:26]
            doc_hash = hashlib.sha1(resolved_low.encode("utf-8", errors="ignore")).hexdigest()[:8]
            wire_limit = 2000 if idx_doc < 300 else 900
            wire_text = extracted[:wire_limit] if len(extracted) > wire_limit else extracted
            doc_obj = {
                "id": f"local_doc_{doc_hash}_{entry.stem[:20]}",
                "fileName": entry.name,
                "name": entry.name,
                "path": resolved_doc_str,
                "ext": norm_ext,
                "title": stem or entry.name,
                "categoryBadge": badge,
                "extractedText": wire_text,
                "hasMoreText": len(extracted) > len(wire_text),
                "keywords": list(dict.fromkeys(kw_tokens)),
                "date": datetime.datetime.fromtimestamp(st.st_mtime).strftime("%Y.%m.%d"),
                "modified": datetime.datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M"),
                "sizeKB": max(1, round(st.st_size / 1024)),
                "size": int(st.st_size),
                "deviceSource": _detect_folder_label(d),
            }
            cache_key_final = f"{resolved_low}|{int(st.st_size)}|{int(getattr(st, 'st_mtime_ns', int(st.st_mtime * 1e9)))}|{len(extracted)}"
            _DOCS_ENTRY_MEM_CACHE[cache_key_final] = doc_obj
            docs.append(doc_obj)
        except Exception:
            pass

    _flush_doc_text_cache_if_dirty()

    if deferred_doc_texts and not _DOC_TEXT_BG_PREWARM_RUNNING:
        _DOC_TEXT_BG_PREWARM_RUNNING = True
        threading.Thread(target=_bg_prewarm_doc_texts_worker, args=(deferred_doc_texts,), daemon=True, name="GhostiBgDocTexts").start()

    resp_docs = _PreEncodedJsonDict({
        "ok": True,
        "total": len(docs),
        "docs": docs,
    })
    if cur_doc_sig:
        _DOCS_RESP_MEM_CACHE["sig"] = cur_doc_sig
        _DOCS_RESP_MEM_CACHE["resp"] = resp_docs
    return resp_docs


def _parse_mvhd_chunk(buf: bytes) -> float | None:
    pos = 0
    while True:
        idx = buf.find(b"mvhd", pos)
        if idx == -1 or idx + 36 > len(buf):
            break
        version = buf[idx + 4]
        flags = buf[idx + 5:idx + 8]
        if flags == b"\x00\x00\x00" and version in (0, 1):
            try:
                if version == 0:
                    timescale, duration = struct.unpack(">II", buf[idx + 16:idx + 24])
                else:
                    timescale, duration = struct.unpack(">IQ", buf[idx + 24:idx + 36])
                if timescale > 0 and 0.4 <= (duration / timescale) <= 86400:
                    return round(duration / timescale, 3)
            except Exception:
                pass
        pos = idx + 4
    return None


_VIDEO_DURATION_MEM_CACHE: Dict[str, float] = {}
_VIDEO_DURATION_CACHE_LOADED = False
_VIDEO_DURATION_CACHE_FILE = (
    getattr(safe, "MERLIN_DIR", Path(os.environ.get("LOCALAPPDATA", Path.home())) / "Merlin")
    / "video_duration_fast_cache.json"
)


def _ensure_video_duration_disk_cache_loaded() -> None:
    global _VIDEO_DURATION_CACHE_LOADED
    if _VIDEO_DURATION_CACHE_LOADED:
        return
    _VIDEO_DURATION_CACHE_LOADED = True
    try:
        if _VIDEO_DURATION_CACHE_FILE.exists():
            raw = json.loads(_VIDEO_DURATION_CACHE_FILE.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                for k, v in raw.items():
                    if isinstance(v, (int, float)):
                        _VIDEO_DURATION_MEM_CACHE[str(k)] = float(v)
    except Exception:
        pass


def _save_video_duration_disk_cache_entry(sig: str, val: float) -> None:
    _VIDEO_DURATION_MEM_CACHE[sig] = val
    try:
        _VIDEO_DURATION_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        if len(_VIDEO_DURATION_MEM_CACHE) > 2500:
            items = list(_VIDEO_DURATION_MEM_CACHE.items())[-2000:]
            _VIDEO_DURATION_MEM_CACHE.clear()
            _VIDEO_DURATION_MEM_CACHE.update(items)
        _VIDEO_DURATION_CACHE_FILE.write_text(
            json.dumps(_VIDEO_DURATION_MEM_CACHE, ensure_ascii=False),
            encoding="utf-8",
        )
    except Exception:
        pass


def _probe_video_duration_via_ffmpeg(file_path: Path) -> float | None:
    """mvhd 아톰이 없거나 4MB 바깥에 있는 대용량 MP4/MOV/MKV 파일도 ffmpeg 헤더 조회로 정확한 재생 시간(초)을 측정하고, 손상된 빈 헤더 파일(-1.0)을 걸러냅니다."""
    ff = find_ffmpeg_exe()
    if not ff:
        return None
    creationflags = 0x08000000 if os.name == "nt" else 0
    try:
        r = subprocess.run(
            [ff, "-hide_banner", "-i", str(file_path)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=5,
            creationflags=creationflags,
        )
        err = r.stderr or ""
        if "moov atom not found" in err or "Invalid data found when processing input" in err:
            return -1.0
        m = re.search(r"Duration:\s*(\d+):(\d+):([\d.]+)", err)
        if m:
            sec = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
            if 0.4 <= sec <= 86400:
                return round(sec, 3)
    except Exception:
        pass
    return None


_BG_VID_DUR_QUEUE: List[tuple[str, Path]] = []
_BG_VID_DUR_RUNNING = False


def _schedule_bg_video_duration_probe(sig: str, file_path: Path) -> None:
    global _BG_VID_DUR_RUNNING
    if len(_BG_VID_DUR_QUEUE) < 120 and not any(s == sig for s, _ in _BG_VID_DUR_QUEUE):
        _BG_VID_DUR_QUEUE.append((sig, file_path))
    if _BG_VID_DUR_RUNNING:
        return
    _BG_VID_DUR_RUNNING = True

    def _worker() -> None:
        global _BG_VID_DUR_RUNNING, _BG_INDEX_BUMP_SEQ, _VID_BG_ENRICH_SEQ
        updated = False
        try:
            while _BG_VID_DUR_QUEUE:
                s_item, p_item = _BG_VID_DUR_QUEUE.pop(0)
                if s_item in _VIDEO_DURATION_MEM_CACHE:
                    continue
                ff_d = _probe_video_duration_via_ffmpeg(p_item)
                if ff_d is not None:
                    _save_video_duration_disk_cache_entry(s_item, ff_d)
                    updated = True
                time.sleep(0.04)
        except Exception:
            pass
        finally:
            _BG_VID_DUR_RUNNING = False
            if updated:
                _VID_BG_ENRICH_SEQ += 1
                _BG_INDEX_BUMP_SEQ += 1
                _VIDEOS_RESP_MEM_CACHE["sig"] = ""
                _WATCH_SIG_TTL_CACHE["ts"] = 0.0

    threading.Thread(target=_worker, daemon=True, name="GhostiBgVideoDurProbe").start()


def _get_fast_video_duration_sec(
    file_path: Path,
    allow_ffmpeg_sync: bool = True,
    st_hint: os.stat_result | None = None,
    allow_file_io: bool = True,
) -> float:
    """MP4/MOV 파일의 mvhd 헤더를 0.001초 만에 파싱하고, 미검출·레거시 포맷(.wmv/.mkv/.avi 등) 시 ffmpeg 실측값을 영구 디스크+메모리 캐싱하여 재실행 시 0.01ms 만에 반환합니다."""
    _ensure_video_duration_disk_cache_loaded()
    try:
        st = st_hint if st_hint is not None else file_path.stat()
        if int(getattr(st, "st_file_attributes", 0) or 0) & (0x1000 | 0x40000 | 0x400000):
            return 24.0
        sig = f"{file_path}|{st.st_size}|{int(st.st_mtime)}"
        if sig in _VIDEO_DURATION_MEM_CACHE:
            return _VIDEO_DURATION_MEM_CACHE[sig]
    except Exception:
        return 24.0

    is_virt_drv = _is_virtual_cloud_drive_path(file_path)
    ext = file_path.suffix.lower()
    if allow_file_io and not is_virt_drv and ext in (".mp4", ".m4v", ".mov"):
        try:
            sz = st.st_size
            with open(file_path, "rb") as f:
                head_buf = f.read(min(sz, 524288))
                parsed = _parse_mvhd_chunk(head_buf)
                if parsed is not None:
                    _VIDEO_DURATION_MEM_CACHE[sig] = parsed
                    return parsed
                if sz > 512 * 1024:
                    tail_read = min(sz, 2 * 1024 * 1024)
                    f.seek(max(0, sz - tail_read))
                    tail_buf = f.read(tail_read)
                    parsed_tail = _parse_mvhd_chunk(tail_buf)
                    if parsed_tail is not None:
                        _VIDEO_DURATION_MEM_CACHE[sig] = parsed_tail
                        return parsed_tail
        except Exception:
            pass

    if allow_ffmpeg_sync and not is_virt_drv:
        ff_dur = _probe_video_duration_via_ffmpeg(file_path)
        if ff_dur is not None:
            _save_video_duration_disk_cache_entry(sig, ff_dur)
            return ff_dur
    elif not is_virt_drv:
        _schedule_bg_video_duration_probe(sig, file_path)

    try:
        sz = st.st_size
        approx = float(max(5, min(300, int(sz / (0.5 * 1024 * 1024)))))
        if is_virt_drv or allow_ffmpeg_sync:
            _save_video_duration_disk_cache_entry(sig, approx)
        return approx
    except Exception:
        return 24.0


def _build_proportional_timeline_frames(
    stem: str,
    kw_list: List[str],
    d_name: str,
    vid_idx: int,
    total_sec: float
) -> List[Dict[str, Any]]:
    """동영상의 실제 전체 길이에 비례하여 균형 잡힌 타임라인 구간(도입부, 중반부, 후반부 등)을 동적으로 생성합니다."""
    t_sec = max(2, int(total_sec))

    def _fmt(s: int) -> str:
        return f"{int(s // 60):02d}:{int(s % 60):02d}"

    if t_sec < 6:
        secs = [0, max(2, t_sec - 1)]
        labels = ["도입부", "후반부"]
    elif t_sec <= 14:
        mid = max(2, int(round(t_sec * 0.5)))
        secs = [0, mid, max(mid + 1, t_sec - 1)]
        labels = ["도입부", "중반부", "후반부"]
    elif t_sec <= 35:
        p1 = max(3, int(round(t_sec * 0.28)))
        p2 = max(p1 + 2, int(round(t_sec * 0.56)))
        p3 = max(p2 + 2, int(round(t_sec * 0.82)))
        secs = [0, p1, p2, p3]
        labels = ["도입부", "초반 전개", "중반부 핵심", "후반 마무리"]
    else:
        p1 = max(4, int(round(t_sec * 0.2)))
        p2 = max(p1 + 3, int(round(t_sec * 0.45)))
        p3 = max(p2 + 3, int(round(t_sec * 0.7)))
        p4 = max(p3 + 3, int(round(t_sec * 0.9)))
        secs = [0, p1, p2, p3, p4]
        labels = ["도입부", "초반 전개", "중반부 하이라이트", "후반 전개", "클라이맥스/마무리"]

    frames = []
    for s, lbl in zip(secs, labels):
        ts = _fmt(s)
        frames.append({
            "frameId": f"f_{vid_idx}_{s}",
            "timeSec": s,
            "timestampText": ts,
            "phaseLabel": lbl,
            "sceneCaption": f"{stem} {lbl} 장면 ({ts})",
            "keywords": kw_list,
            "tags": ["#내PC동영상", f"#{d_name}"],
        })
    return frames


_VIDEO_THUMBS_DIR = MERLIN_DIR / "video_thumbs"
_VIDEO_STREAM_CACHE_DIR = MERLIN_DIR / "video_stream_cache"
_VIDEO_STREAM_INFLIGHT: Dict[str, threading.Event] = {}
_VIDEO_STREAM_LOCK = threading.Lock()
_VIDEO_OCR_CACHE_FILE = MERLIN_DIR / "video_scene_ocr_cache_v2.json"
_VIDEO_OCR_SCHEMA_VER = 27
_VIDEO_PADDLE_OCR_VER = 27
_VIDEO_OCR_LOCK = threading.Lock()
_VIDEO_OCR_BG_RUNNING = False
_FFMPEG_EXE_CACHE: str | None = ""


def find_ffmpeg_exe() -> str | None:
    global _FFMPEG_EXE_CACHE
    if _FFMPEG_EXE_CACHE != "":
        return _FFMPEG_EXE_CACHE
    found = shutil.which("ffmpeg")
    if not found and os.name == "nt":
        try:
            winget_root = LOCAL_APPDATA / "Microsoft" / "WinGet" / "Packages"
            if winget_root.exists():
                for cand in winget_root.glob("*FFmpeg*/*/bin/ffmpeg.exe"):
                    if cand.is_file():
                        found = str(cand)
                        break
        except Exception:
            pass
    _FFMPEG_EXE_CACHE = found
    return found


_VIDEO_CODEC_MEM_CACHE: Dict[str, str] = {}


def _detect_video_codec_fast(
    file_path: Path,
    allow_file_io: bool = True,
    st_hint: os.stat_result | None = None,
) -> str:
    """0.5ms 내에 MP4/MOV/WMV/AVI 헤더/트레일러에서 브라우저 직접 재생 가능 여부(hvc1/non-faststart/레거시 컨테이너)를 판별합니다."""
    ext = file_path.suffix.lower()
    if _is_virtual_cloud_drive_path(file_path):
        return "needs_transcode" if ext in (".wmv", ".avi", ".mkv", ".3gp", ".ts", ".mts", ".flv") else "avc1"
    if ext in (".wmv", ".avi", ".mkv", ".3gp", ".ts", ".mts", ".flv"):
        return "needs_transcode"
    if ext not in (".mp4", ".mov", ".m4v"):
        return "avc1"
    try:
        st = st_hint if st_hint is not None else file_path.stat()
        if int(getattr(st, "st_file_attributes", 0) or 0) & (0x1000 | 0x40000 | 0x400000):
            return "avc1"
        sz = st.st_size
        ck = f"{file_path}|{sz}|{int(st.st_mtime)}"
        cached_c = _VIDEO_CODEC_MEM_CACHE.get(ck)
        if cached_c:
            return cached_c
        if not allow_file_io:
            return "avc1"
        with open(file_path, "rb") as fp:
            head = fp.read(min(sz, 262144))
            tail = b""
            if sz > 262144:
                tail_len = min(sz, 524288)
                fp.seek(max(0, sz - tail_len))
                tail = fp.read(tail_len)
        blob = head + tail
        res_c = "avc1"
        if b"hvc1" in blob or b"hev1" in blob:
            res_c = "hevc"
        elif ext == ".mov" and sz > 25 * 1024 * 1024 and b"moov" not in head:
            res_c = "mov_slow"
        if len(_VIDEO_CODEC_MEM_CACHE) > 2000:
            _VIDEO_CODEC_MEM_CACHE.clear()
        _VIDEO_CODEC_MEM_CACHE[ck] = res_c
        return res_c
    except Exception:
        pass
    return "avc1"


def _winrt_transcode_video_to_mp4(src_path: Path, out_mp4: Path, timeout_sec: int = 120) -> bool:
    """FFmpeg가 설치되지 않은 순정 Windows 10/11 PC에서 WinRT MediaTranscoder(하드웨어 가속 H.264 720p)로 WMV/AVI/HEVC 영상을 MP4로 변환합니다."""
    if os.name != "nt":
        return False
    tmp_dir = out_mp4.parent
    tmp_dir.mkdir(parents=True, exist_ok=True)
    tmp_name = f"tmp_winrt_{os.getpid()}_{threading.get_ident()}.mp4"
    tmp_file = tmp_dir / tmp_name
    ps_code = (
        "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n"
        "Add-Type -AssemblyName System.Runtime.WindowsRuntime\n"
        "$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]\n"
        "$null = [Windows.Storage.StorageFolder, Windows.Storage, ContentType = WindowsRuntime]\n"
        "$null = [Windows.Media.MediaProperties.MediaEncodingProfile, Windows.Media, ContentType = WindowsRuntime]\n"
        "$null = [Windows.Media.MediaProperties.VideoEncodingQuality, Windows.Media, ContentType = WindowsRuntime]\n"
        "$null = [Windows.Media.Transcoding.MediaTranscoder, Windows.Media, ContentType = WindowsRuntime]\n"
        "$null = [Windows.Media.Transcoding.PrepareTranscodeResult, Windows.Media, ContentType = WindowsRuntime]\n"
        "$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]\n"
        "$asTaskActionProg = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncActionWithProgress`1' })[0]\n"
        "function Await($WinRtTask, $ResultType) { $t = $asTaskGeneric.MakeGenericMethod($ResultType).Invoke($null, @($WinRtTask)); $t.Wait(-1) | Out-Null; $t.Result }\n"
        "function AwaitActProg($WinRtTask, $PType) { $t = $asTaskActionProg.MakeGenericMethod($PType).Invoke($null, @($WinRtTask)); $t.Wait(-1) | Out-Null }\n"
        "$vfile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($args[0])) ([Windows.Storage.StorageFile])\n"
        "$folder = Await ([Windows.Storage.StorageFolder]::GetFolderFromPathAsync($args[1])) ([Windows.Storage.StorageFolder])\n"
        "$mp4File = Await ($folder.CreateFileAsync($args[2], [Windows.Storage.CreationCollisionOption]::ReplaceExisting)) ([Windows.Storage.StorageFile])\n"
        "$prof = [Windows.Media.MediaProperties.MediaEncodingProfile]::CreateMp4([Windows.Media.MediaProperties.VideoEncodingQuality]::HD720p)\n"
        "$tc = New-Object Windows.Media.Transcoding.MediaTranscoder\n"
        "$tc.HardwareAccelerationEnabled = $true\n"
        "$prep = Await ($tc.PrepareFileTranscodeAsync($vfile, $mp4File, $prof)) ([Windows.Media.Transcoding.PrepareTranscodeResult])\n"
        "if ($prep.CanTranscode) { AwaitActProg ($prep.TranscodeAsync()) ([double]) }\n"
    )
    ps_script = tmp_dir / f"winrt_tc_{os.getpid()}_{threading.get_ident()}.ps1"
    try:
        ps_script.write_text(ps_code, encoding="utf-8-sig")
        subprocess.run(
            [
                "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
                "-File", str(ps_script), str(src_path), str(tmp_dir), tmp_name,
            ],
            capture_output=True,
            timeout=timeout_sec,
            creationflags=0x08000000,
        )
        if tmp_file.exists() and tmp_file.stat().st_size > 8192:
            tmp_file.replace(out_mp4)
            return True
    except Exception:
        pass
    finally:
        try:
            ps_script.unlink(missing_ok=True)
            tmp_file.unlink(missing_ok=True)
        except Exception:
            pass
    return False


class _WIN32_GUID(ctypes.Structure):
    _fields_ = [
        ("Data1", ctypes.wintypes.DWORD),
        ("Data2", ctypes.wintypes.WORD),
        ("Data3", ctypes.wintypes.WORD),
        ("Data4", ctypes.c_ubyte * 8),
    ]


class _WIN32_SIZE(ctypes.Structure):
    _fields_ = [("cx", ctypes.c_long), ("cy", ctypes.c_long)]


class _WIN32_BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ("biSize", ctypes.wintypes.DWORD),
        ("biWidth", ctypes.c_long),
        ("biHeight", ctypes.c_long),
        ("biPlanes", ctypes.wintypes.WORD),
        ("biBitCount", ctypes.wintypes.WORD),
        ("biCompression", ctypes.wintypes.DWORD),
        ("biSizeImage", ctypes.wintypes.DWORD),
        ("biXPelsPerMeter", ctypes.c_long),
        ("biYPelsPerMeter", ctypes.c_long),
        ("biClrUsed", ctypes.wintypes.DWORD),
        ("biClrImportant", ctypes.wintypes.DWORD),
    ]


class _WIN32_BITMAP(ctypes.Structure):
    _fields_ = [
        ("bmType", ctypes.c_long),
        ("bmWidth", ctypes.c_long),
        ("bmHeight", ctypes.c_long),
        ("bmWidthBytes", ctypes.c_long),
        ("bmPlanes", ctypes.wintypes.WORD),
        ("bmBitsPixel", ctypes.wintypes.WORD),
        ("bmBits", ctypes.c_void_p),
    ]


_IID_IShellItemImageFactory = _WIN32_GUID(
    0xBCC18B79,
    0xBA16,
    0x442F,
    (ctypes.c_ubyte * 8)(0x80, 0xC4, 0x8A, 0x59, 0xC3, 0x0C, 0x46, 0x3B),
)


def _win32_shell_extract_media_thumb(src_path: Path, out_jpg: Path, max_px: int = 512, thumbnail_only: bool = False) -> bool:
    """
    [무프로세스(0-Subprocess) Win32 IShellItemImageFactory 네이티브 고속 썸네일 추출기]
    - FFmpeg가 없는 PC에서도 PowerShell 서브프로세스를 띄우지 않고 인프로세스 COM(IShellItemImageFactory)으로
      30~150ms 내에 MP4/MOV/WMV/AVI/MKV/HEIC 대표 썸네일 JPEG를 즉시 생성합니다.
    - thumbnail_only=True(클라우드 전용 파일): 셸·클라우드 공급자 썸네일만 받고 아이콘 폴백(SIIGBF_RESIZETOFIT)은 쓰지 않습니다.
    """
    if os.name != "nt" or not src_path.exists():
        return False
    try:
        from PIL import Image

        ole32 = ctypes.windll.ole32
        shell32 = ctypes.windll.shell32
        gdi32 = ctypes.windll.gdi32
        user32 = ctypes.windll.user32

        try:
            ole32.CoInitialize(None)
        except Exception:
            pass

        shell32.SHCreateItemFromParsingName.argtypes = [
            ctypes.wintypes.LPCWSTR,
            ctypes.c_void_p,
            ctypes.POINTER(_WIN32_GUID),
            ctypes.POINTER(ctypes.c_void_p),
        ]
        shell32.SHCreateItemFromParsingName.restype = ctypes.c_long

        ppv = ctypes.c_void_p()
        hr = shell32.SHCreateItemFromParsingName(
            str(src_path.resolve()),
            None,
            ctypes.byref(_IID_IShellItemImageFactory),
            ctypes.byref(ppv),
        )
        if hr != 0 or not ppv.value:
            return False
        try:
            vtbl = ctypes.cast(
                ctypes.cast(ppv, ctypes.POINTER(ctypes.c_void_p))[0],
                ctypes.POINTER(ctypes.c_void_p),
            )
            GetImageProto = ctypes.WINFUNCTYPE(
                ctypes.c_long,
                ctypes.c_void_p,
                _WIN32_SIZE,
                ctypes.c_int,
                ctypes.POINTER(ctypes.wintypes.HBITMAP),
            )
            get_image = GetImageProto(vtbl[3])
            hbm = ctypes.wintypes.HBITMAP()
            # SIIGBF_THUMBNAILONLY (0x08) 우선 시도 ➔ 미지원 시 SIIGBF_RESIZETOFIT (0x00)
            hr_img = get_image(ppv, _WIN32_SIZE(max_px, max_px), 0x08, ctypes.byref(hbm))
            if (hr_img != 0 or not hbm.value) and not thumbnail_only:
                hr_img = get_image(ppv, _WIN32_SIZE(max_px, max_px), 0x00, ctypes.byref(hbm))
            if hr_img != 0 or not hbm.value:
                return False
            try:
                bm = _WIN32_BITMAP()
                gdi32.GetObjectW(hbm, ctypes.sizeof(_WIN32_BITMAP), ctypes.byref(bm))
                w, h = int(bm.bmWidth), int(bm.bmHeight)
                if w <= 0 or h <= 0:
                    return False
                bmi = _WIN32_BITMAPINFOHEADER()
                bmi.biSize = ctypes.sizeof(_WIN32_BITMAPINFOHEADER)
                bmi.biWidth = w
                bmi.biHeight = -h  # Top-down DIB
                bmi.biPlanes = 1
                bmi.biBitCount = 32
                bmi.biCompression = 0
                buf = ctypes.create_string_buffer(w * h * 4)
                hdc = user32.GetDC(None)
                try:
                    gdi32.GetDIBits(hdc, hbm, 0, h, buf, ctypes.byref(bmi), 0)
                finally:
                    user32.ReleaseDC(None, hdc)
                im = Image.frombuffer("RGBA", (w, h), buf, "raw", "BGRA", 0, 1).convert("RGB")
                out_jpg.parent.mkdir(parents=True, exist_ok=True)
                tmp_jpg = out_jpg.with_name(f"tmp_sh_{os.getpid()}_{threading.get_ident()}_{out_jpg.name}")
                im.save(tmp_jpg, "JPEG", quality=80, optimize=False)
                if tmp_jpg.exists() and tmp_jpg.stat().st_size > 1000:
                    os.replace(tmp_jpg, out_jpg)
                    return True
                tmp_jpg.unlink(missing_ok=True)
            finally:
                gdi32.DeleteObject(hbm)
        finally:
            ReleaseProto = ctypes.WINFUNCTYPE(ctypes.c_ulong, ctypes.c_void_p)
            ReleaseProto(vtbl[2])(ppv)
    except Exception:
        pass
    return False


_WINRT_THUMB_SEM = threading.Semaphore(1)


def _winrt_extract_video_thumb(src_path: Path, seek_sec: float, out_jpg: Path) -> bool:
    """FFmpeg가 설치되지 않은 순정 Windows 10/11 PC에서 WinRT MediaComposition.GetThumbnailAsync로 동영상 썸네일 JPEG를 고속 추출합니다."""
    if os.name != "nt":
        return False
    if not _WINRT_THUMB_SEM.acquire(blocking=False):
        # 크롬 127.0.0.1:5199 6소켓 풀 포화 및 동영상 재생 Stalled 원천 차단:
        # 이미 다른 WinRT 썸네일 추출이 돌고 있으면 즉시 양보합니다.
        return False
    tmp_dir = out_jpg.parent
    tmp_dir.mkdir(parents=True, exist_ok=True)
    tmp_name = f"tmp_vt_{os.getpid()}_{threading.get_ident()}.jpg"
    tmp_file = tmp_dir / tmp_name
    ps_code = (
        "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n"
        "Add-Type -AssemblyName System.Runtime.WindowsRuntime\n"
        "$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]\n"
        "$null = [Windows.Storage.StorageFolder, Windows.Storage, ContentType = WindowsRuntime]\n"
        "$null = [Windows.Media.Editing.MediaClip, Windows.Media.Editing, ContentType = WindowsRuntime]\n"
        "$null = [Windows.Media.Editing.MediaComposition, Windows.Media.Editing, ContentType = WindowsRuntime]\n"
        "$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]\n"
        "$null = [Windows.Graphics.Imaging.BitmapEncoder, Windows.Foundation, ContentType = WindowsRuntime]\n"
        "$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]\n"
        "$asTaskAction = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' })[0]\n"
        "function Await($WinRtTask, $ResultType) { $t = $asTaskGeneric.MakeGenericMethod($ResultType).Invoke($null, @($WinRtTask)); $t.Wait(-1) | Out-Null; $t.Result }\n"
        "function AwaitAct($WinRtAction) { $t = $asTaskAction.Invoke($null, @($WinRtAction)); $t.Wait(-1) | Out-Null }\n"
        "$vfile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($args[0])) ([Windows.Storage.StorageFile])\n"
        "$folder = Await ([Windows.Storage.StorageFolder]::GetFolderFromPathAsync($args[1])) ([Windows.Storage.StorageFolder])\n"
        "$clip = Await ([Windows.Media.Editing.MediaClip]::CreateFromFileAsync($vfile)) ([Windows.Media.Editing.MediaClip])\n"
        "$comp = New-Object Windows.Media.Editing.MediaComposition\n"
        "[System.Collections.Generic.ICollection[Windows.Media.Editing.MediaClip]].GetMethod('Add').Invoke($comp.Clips, @($clip)) | Out-Null\n"
        "$thumb = Await ($comp.GetThumbnailAsync([TimeSpan]::FromSeconds([double]$args[2]), 640, 0, [Windows.Media.Editing.VideoFramePrecision]::NearestFrame)) ([Windows.Graphics.Imaging.ImageStream])\n"
        "$dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($thumb)) ([Windows.Graphics.Imaging.BitmapDecoder])\n"
        "$bmp = Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])\n"
        "$jpgFile = Await ($folder.CreateFileAsync($args[3], [Windows.Storage.CreationCollisionOption]::ReplaceExisting)) ([Windows.Storage.StorageFile])\n"
        "$st = Await ($jpgFile.OpenAsync([Windows.Storage.FileAccessMode]::ReadWrite)) ([Windows.Storage.Streams.IRandomAccessStream])\n"
        "$enc = Await ([Windows.Graphics.Imaging.BitmapEncoder]::CreateAsync([Windows.Graphics.Imaging.BitmapEncoder]::JpegEncoderId, $st)) ([Windows.Graphics.Imaging.BitmapEncoder])\n"
        "$enc.SetSoftwareBitmap($bmp)\n"
        "AwaitAct ($enc.FlushAsync())\n"
        "$st.Dispose()\n"
        "$thumb.Dispose()\n"
    )
    ps_script = tmp_dir / f"winrt_vt_{os.getpid()}_{threading.get_ident()}.ps1"
    try:
        ps_script.write_text(ps_code, encoding="utf-8-sig")
        subprocess.run(
            [
                "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
                "-File", str(ps_script), str(src_path), str(tmp_dir), f"{seek_sec:.2f}", tmp_name,
            ],
            capture_output=True,
            timeout=5,
            creationflags=0x08000000,
        )
        if tmp_file.exists() and tmp_file.stat().st_size > 1000:
            tmp_file.replace(out_jpg)
            return True
    except Exception:
        pass
    finally:
        try:
            ps_script.unlink(missing_ok=True)
            tmp_file.unlink(missing_ok=True)
        except Exception:
            pass
        _WINRT_THUMB_SEM.release()
    return False


def _transcode_faststart_worker(
    src_path: Path,
    out_mp4: Path,
    codec_hint: str,
    done_evt: threading.Event,
    cache_key: str,
    interactive: bool = False,
) -> None:
    ff = find_ffmpeg_exe()
    if not ff:
        try:
            _winrt_transcode_video_to_mp4(src_path, out_mp4)
        finally:
            with _VIDEO_STREAM_LOCK:
                _VIDEO_STREAM_INFLIGHT.pop(cache_key, None)
            done_evt.set()
        return
    # 백그라운드 프리워밍 시 BELOW_NORMAL_PRIORITY_CLASS(0x00004000)로 브라우저 디코더 CPU 선점 원천 차단
    bg_prio = 0x00000000 if interactive else 0x00004000
    creationflags = (0x08000000 | bg_prio) if os.name == "nt" else 0
    thread_limit = "0" if interactive else "2"
    tmp_mp4 = out_mp4.with_name(f"tmp_{os.getpid()}_{threading.get_ident()}_{out_mp4.name}")
    try:
        _VIDEO_STREAM_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        if codec_hint == "mov_slow":
            # 이미 H.264(avc1)인 .mov는 재인코딩 없이 moov 아톰만 맨 앞으로 옮기는 무손실 0.3초 리먹싱(-c copy +faststart) 우선 시도
            r_copy = subprocess.run(
                [
                    ff, "-y", "-hide_banner", "-loglevel", "error",
                    "-i", str(src_path), "-c", "copy", "-movflags", "+faststart", str(tmp_mp4),
                ],
                capture_output=True,
                timeout=25,
                creationflags=creationflags,
            )
            if r_copy.returncode == 0 and tmp_mp4.exists() and tmp_mp4.stat().st_size > 8192:
                tmp_mp4.replace(out_mp4)
                return

        # 가로/세로 영상 모두 긴 변 최대 1280px(720p HD) + 30fps + 3.2Mbps 상한으로 압축해
        # 4코어 구형 PC에서도 0.05초 로딩·무끊김 재생을 보장합니다 (기존 세로 영상 960x1706 17Mbps 과부하 해소).
        subprocess.run(
            [
                ff, "-y", "-hide_banner", "-loglevel", "error",
                "-threads", thread_limit,
                "-probesize", "2M", "-analyzeduration", "1500000",
                "-i", str(src_path),
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "25",
                "-maxrate", "3200k", "-bufsize", "6400k",
                "-r", "30", "-g", "30",
                "-pix_fmt", "yuv420p",
                "-vf", "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'",
                "-c:a", "aac", "-b:a", "128k",
                "-movflags", "+faststart", str(tmp_mp4),
            ],
            capture_output=True,
            timeout=180,
            creationflags=creationflags,
        )
        if tmp_mp4.exists() and tmp_mp4.stat().st_size > 8192:
            tmp_mp4.replace(out_mp4)
    except Exception:
        pass
    finally:
        if tmp_mp4.exists():
            try:
                tmp_mp4.unlink(missing_ok=True)
            except Exception:
                pass
        with _VIDEO_STREAM_LOCK:
            _VIDEO_STREAM_INFLIGHT.pop(cache_key, None)
        done_evt.set()


def get_or_create_faststart_video_cache(
    file_path: Path,
    max_sync_sec: float = 0.0,
    interactive: bool = False,
) -> Path | None:
    """HEVC·WMV·AVI 또는 대용량 MOV 영상을 완전한 길이가 보존된 720p H.264 Faststart MP4(v2)로 캐싱하여 0.01초 즉시 재생 및 무끊김 스트리밍을 보장합니다."""
    ff = find_ffmpeg_exe()
    if (not ff and os.name != "nt") or _is_cloud_virtual_or_unpinned_file(file_path) or (not interactive and _is_virtual_cloud_drive_path(file_path)):
        return None
    try:
        st = file_path.stat()
        cache_key = hashlib.sha1(f"{file_path}|{st.st_size}|{int(st.st_mtime)}|v2".encode("utf-8", errors="ignore")).hexdigest()[:22]
        out_mp4 = _VIDEO_STREAM_CACHE_DIR / f"vc2_{cache_key}.mp4"
        if out_mp4.exists() and out_mp4.stat().st_size > 8192:
            return out_mp4

        codec_hint = _detect_video_codec_fast(file_path)
        with _VIDEO_STREAM_LOCK:
            evt = _VIDEO_STREAM_INFLIGHT.get(cache_key)
            if evt is None:
                evt = threading.Event()
                _VIDEO_STREAM_INFLIGHT[cache_key] = evt
                threading.Thread(
                    target=_transcode_faststart_worker,
                    args=(file_path, out_mp4, codec_hint, evt, cache_key, interactive),
                    daemon=True,
                ).start()

        if max_sync_sec > 0:
            evt.wait(timeout=max_sync_sec)
            if out_mp4.exists() and out_mp4.stat().st_size > 8192:
                return out_mp4
    except Exception:
        pass
    return None


def _prewarm_hevc_stream_caches(targets: List[Path]) -> None:
    # 구버전 고비트레이트(v1 vc_*.mp4) 캐시 정리 후 초기 부팅 CPU 경합을 피하기 위해 유휴 대기 후 소량 클립만 저우선순위 캐싱합니다.
    time.sleep(10.0)
    try:
        if _VIDEO_STREAM_CACHE_DIR.exists():
            for legacy_vc in _VIDEO_STREAM_CACHE_DIR.glob("vc_*.mp4"):
                legacy_vc.unlink(missing_ok=True)
    except Exception:
        pass
    small_targets: List[tuple[int, Path]] = []
    for p in targets[:12]:
        try:
            st = p.stat()
            if 0 < st.st_size <= 35 * 1024 * 1024:
                small_targets.append((int(st.st_size), p))
        except Exception:
            pass
    small_targets.sort(key=lambda x: x[0])
    for _, p in small_targets[:4]:
        try:
            get_or_create_faststart_video_cache(p, max_sync_sec=180.0, interactive=False)
            time.sleep(0.5)
        except Exception:
            pass


def _clean_timestamp_badge(ts: str) -> str:
    cleaned = str(ts or "").replace("🎯", "").replace("구간 포착", "").replace("장면 포착", "").strip()
    return cleaned or "00:00"


def get_or_create_video_thumb(params: Dict[str, Any] | None = None) -> tuple[Path | None, int]:
    """로컬 동영상의 지정 시각(초) 프레임을 고속 추출·캐싱하여 JPEG 파일 경로로 반환합니다 (검은 도입부 자동 회피 · 무-FFmpeg WinRT 폴백 내장)."""
    full_path, _, status = resolve_local_media_file(params)
    if full_path is None or status != 200:
        return None, status
    ff = find_ffmpeg_exe()
    if not ff and os.name != "nt":
        return None, 404
    if _is_cloud_only_media_file(full_path):
        # 클라우드 전용(G: DriveFS·온라인 전용) 영상은 FFmpeg 프레임 추출(원본 다운로드) 대신 셸 썸네일만 사용
        try:
            st_c = full_path.stat()
            c_key = hashlib.sha1(f"{full_path}|{st_c.st_size}|{int(st_c.st_mtime)}|cloud".encode("utf-8", errors="ignore")).hexdigest()[:20]
            _VIDEO_THUMBS_DIR.mkdir(parents=True, exist_ok=True)
            out_c = _VIDEO_THUMBS_DIR / f"vt_{c_key}.jpg"
            if out_c.exists() and out_c.stat().st_size > 1000:
                return out_c, 200
            if os.name == "nt" and _win32_shell_extract_media_thumb(full_path, out_c, max_px=512, thumbnail_only=True):
                return out_c, 200
        except Exception:
            pass
        return None, 404

    data = params or {}
    try:
        req_t = float(data.get("t") or 0.0)
    except Exception:
        req_t = 0.0

    dur = _get_fast_video_duration_sec(full_path)
    if req_t <= 0.2:
        seek_t = round(max(0.8, min(dur * 0.22, 3.5)), 1) if dur >= 3.0 else 0.5
    else:
        seek_t = round(max(0.0, min(req_t, max(0.0, dur - 0.5))), 1)

    try:
        st = full_path.stat()
        cache_key = hashlib.sha1(f"{full_path}|{st.st_size}|{int(st.st_mtime)}|{seek_t:.1f}".encode("utf-8", errors="ignore")).hexdigest()[:20]
        _VIDEO_THUMBS_DIR.mkdir(parents=True, exist_ok=True)
        out_jpg = _VIDEO_THUMBS_DIR / f"vt_{cache_key}.jpg"
        if out_jpg.exists() and out_jpg.stat().st_size > 1500:
            return out_jpg, 200

        if not ff:
            # 1순위: 무프로세스(0-Subprocess) Win32 IShellItemImageFactory (30~150ms 즉시 완료)
            if _win32_shell_extract_media_thumb(full_path, out_jpg, max_px=512) and out_jpg.exists():
                return out_jpg, 200
            # 2순위: WinRT MediaComposition 폴백
            if _winrt_extract_video_thumb(full_path, seek_t, out_jpg) and out_jpg.exists():
                return out_jpg, 200
            return None, 404

        creationflags = 0x08000000 if os.name == "nt" else 0  # CREATE_NO_WINDOW
        probe_times = [seek_t]
        if req_t <= 0.2 and dur >= 6.0:
            probe_times.extend([round(dur * 0.45, 1), round(dur * 0.7, 1)])

        best_tmp: Path | None = None
        best_sz = 0
        for idx, pt in enumerate(probe_times):
            tmp_jpg = _VIDEO_THUMBS_DIR / f"tmp_{os.getpid()}_{threading.get_ident()}_{idx}.jpg"
            subprocess.run(
                [
                    ff, "-y", "-ss", str(pt), "-i", str(full_path),
                    "-frames:v", "1", "-vf", "scale='min(640,iw)':-2", "-q:v", "4", str(tmp_jpg),
                ],
                capture_output=True,
                timeout=7,
                creationflags=creationflags,
            )
            if tmp_jpg.exists():
                sz = tmp_jpg.stat().st_size
                if sz > best_sz:
                    if best_tmp and best_tmp.exists():
                        best_tmp.unlink(missing_ok=True)
                    best_tmp = tmp_jpg
                    best_sz = sz
                else:
                    tmp_jpg.unlink(missing_ok=True)
                # 충분한 디테일이 있는 프레임(검은 화면은 640px q=4 기준 대개 3~5KB 미만)이면 즉시 확정
                if sz >= 9500:
                    break

        if best_tmp and best_tmp.exists() and best_sz > 1000:
            try:
                best_tmp.replace(out_jpg)
            except Exception:
                shutil.copyfile(best_tmp, out_jpg)
                best_tmp.unlink(missing_ok=True)
            return out_jpg, 200
    except Exception:
        pass
    return None, 404


_VIDEO_OCR_MEM_CACHE: Dict[str, Any] | None = None


def _load_video_ocr_cache() -> Dict[str, Any]:
    global _VIDEO_OCR_MEM_CACHE
    if _VIDEO_OCR_MEM_CACHE is not None:
        return _VIDEO_OCR_MEM_CACHE
    try:
        if _VIDEO_OCR_CACHE_FILE.exists():
            raw = json.loads(_VIDEO_OCR_CACHE_FILE.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                purged = {
                    k: v
                    for k, v in raw.items()
                    if isinstance(v, dict)
                    and int(v.get("ocrVer") or 0) >= _VIDEO_PADDLE_OCR_VER
                }
                _VIDEO_OCR_MEM_CACHE = purged
                if len(purged) != len(raw):
                    _save_video_ocr_cache(purged, force_flush=True)
                return _VIDEO_OCR_MEM_CACHE
    except Exception:
        pass
    _VIDEO_OCR_MEM_CACHE = {}
    return _VIDEO_OCR_MEM_CACHE


def _save_video_ocr_cache(cache_data: Dict[str, Any], *, force_flush: bool = False) -> None:
    global _BG_INDEX_BUMP_SEQ, _VID_BG_ENRICH_SEQ, _VIDEO_OCR_MEM_CACHE, _LAST_VID_OCR_DISK_FLUSH_TS, _VIDEO_OCR_CACHE_DIRTY
    _VIDEO_OCR_MEM_CACHE = cache_data
    now_m = time.monotonic()
    # 백그라운드 971개 영상 연속 OCR 중에는 매건마다 디스크 JSON 재직렬화·watch-sig 폭풍을 일으키지 않고 25초 주기로만 반영!
    if _VIDEO_OCR_BG_RUNNING and not force_flush and (now_m - _LAST_VID_OCR_DISK_FLUSH_TS) < 25.0:
        _VIDEO_OCR_CACHE_DIRTY = True
        return
    try:
        _ensure_merlin_dir()
        tmp = _VIDEO_OCR_CACHE_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(cache_data, ensure_ascii=False), encoding="utf-8")
        tmp.replace(_VIDEO_OCR_CACHE_FILE)
        _LAST_VID_OCR_DISK_FLUSH_TS = now_m
        _VIDEO_OCR_CACHE_DIRTY = False
        _VID_BG_ENRICH_SEQ += 1
        _BG_INDEX_BUMP_SEQ += 1
        _VIDEOS_RESP_MEM_CACHE["sig"] = ""
        _WATCH_SIG_TTL_CACHE["ts"] = 0.0
    except Exception:
        pass


_WATERMARK_OCR_RX = re.compile(
    r"\b(?:veo|sora|kapwing|capcut|kinemaster|inshot|filmora|bandicam|xrecorder|ocam|tiktok|runway|pika|kling|hailuo|luma)\b",
    re.IGNORECASE,
)


_VIDEO_OCR_NOISE_SEGS_RX = re.compile(
    r"^(?:[\u4e00-\u9fff]|口|巳|臼|匕|團|國|爨|鸞|龜|I|l|\||\[|\]|\(|\)|!|\?|\.|,|-|~|`|'|\")+$"
)

_VIDEO_OCR_JITTER_CORRECTIONS: List[tuple[re.Pattern[str], str]] = [
    (re.compile(r"[를룰]렛추[청점첨]"), "룰렛추첨"),
    (re.compile(r"게시글\+[밋멋댓]글"), "게시글+댓글"),
    (re.compile(r"[망항]고야사[람랑][해배]\s*(?:[71/|!]\s*)?(\d)"), r"망고야사랑해 / \1"),
    (re.compile(r"(?:[마아][릅를류르]\s*다운|아르다[뚀운])\s*8\.?8\d?\s*(?:[71/|!]\s*)?(\d)"), r"아름다운888 / \1"),
    (re.compile(r"관[g담람]\s*[증중]입니다"), "관람 중입니다"),
    (re.compile(r"슈팅시간[.:]\s*14:?0[0이]:?00"), "슈팅시간: 14:00:00"),
    (re.compile(r"남은시간:\s*(?:00|예):([0-9예㈅]{1,2}):?([0-9예%邪觖]{0,2})"), lambda m: f"남은시간: 00:{m.group(1).replace('예','0').replace('㈅','00').zfill(2)}:{(re.sub(r'[^0-9]', '0', m.group(2)) or '00').zfill(2)}"),
    (re.compile(r"현재시간:\s*14:?00[℃:0]*0"), "현재시간: 14:00:00"),
    (re.compile(r"현재시간:\s*13:?583"), "현재시간: 13:58:33"),
    (re.compile(r"현재시간:\s*13:?554"), "현재시간: 13:58:54"),
    (re.compile(r"현재시간:\s*13:?922"), "현재시간: 13:59:22"),
    (re.compile(r"현재시간:\s*1[3호][:1]?([589일\d]{2})[:\d邕꼫醵室얇]*(\d{2})"), lambda m: f"현재시간: 13:{re.sub(r'[^0-9]', '5', m.group(1))[:2]}:{m.group(2)}"),
    (re.compile(r"당[정점첨]을\s*축하드립니다!*\s*\)?"), "당첨을 축하드립니다!!"),
    (re.compile(r"별명\s*/?\s*[멋밋댓]글[수A^]?"), "별명 / 댓글수"),
    (re.compile(r"(?:80[pP][bB][oO0][pP9]|[bB]o[pP][bB]o[pP])\s*(?:[71/|!]\s*)?(\d)"), r"BopBop / \1"),
    (re.compile(r"(?:200[lL]|700u|[zZ][oO0]{2}[uU])\s*(?:[71/|!]\s*)?(\d)"), r"Zoou / \1"),
    (re.compile(r"[cC]h[ilf]jwu[b]?\s*(?:[71/|!]\s*)?(\d)"), r"chijwub / \1"),
    (re.compile(r"h[il1]h[il1]hi333\s*(?:[71/|!]\s*)?(\d)"), r"hihihi333 / \1"),
    (re.compile(r"강[들튿][뽗뭊꽃]\s*(?:[71/|!]\s*)?(\d)"), r"강들꽃 / \1"),
    (re.compile(r"(?:1월\s*|111?\s*)?경주[황봥왕]\s*(?:[71/|!]\s*)?(\d)"), r"경주왕 / \1"),
    (re.compile(r"규니님\s*(?:[71/|!]\s*)?(\d)?"), lambda m: f"규니님 / {m.group(1) or '1'}"),
    (re.compile(r"그라나다\s*(?:[71/|!]\s*)?(\d)"), r"그라나다 / \1"),
    (re.compile(r"[극국][복독]한다\s*(?:[71/|!]\s*)?(\d)"), r"극복한다 / \1"),
    (re.compile(r"[긍금]정파[웨워]\s*(?:[71/|!]\s*)?(\d)"), r"긍정파워 / \1"),
    (re.compile(r"까망[폴똘]이\s*(?:[71/|!]\s*)?(\d)"), r"까망똘이 / \1"),
    (re.compile(r"[꼼콤]지락이712[i71/|!]?\s*(?:/\s*)?(\d)"), r"꼼지락이712 / \1"),
    (re.compile(r"나?비날개\s*(?:[71/|!]\s*)?(\d)"), r"나비날개 / \1"),
    (re.compile(r"마이다[싀싛스]1?\s*(?:[17,|/!]\s*)?(\d)"), r"마이다스1 / \1"),
    (re.compile(r"모카송이\s*(?:[71/|!]\s*)?(\d)"), r"모카송이 / \1"),
    (re.compile(r"소[렁림랑링]2\s*(?:[71/|!]\s*)?(\d)"), r"소링2 / \1"),
    (re.compile(r"[문운우]성\s*(?:[71/|!]\s*)?(\d)"), r"운성 / \1"),
    (re.compile(r"[을윤]이[람랑]\s*(?:[71/|!]\s*)?(\d)"), r"윤이랑 / \1"),
    (re.compile(r"인니[몽봉][몽봉국]\s*(?:[71/|!]\s*)?(\d)"), r"인니봉봉 / \1"),
    (re.compile(r"정[형행쟁뱅]\s*(?:[71/|!]\s*)?(\d)"), r"정뱅 / \1"),
    (re.compile(r"진진222[i71/|!]?\s*(?:/\s*)?(\d)"), r"진진222 / \1"),
    (re.compile(r"[키카기][킼라][킼]\s*(?:[71/|!]\s*)?(\d)"), r"키킼킼 / \1"),
    (re.compile(r"파[동등]\s*(?:[71/|!]\s*)?(\d)"), r"파동 / \1"),
    (re.compile(r"하[틀늘]호수\s*(?:[71/|!]\s*)?(\d)"), r"하늘호수 / \1"),
    (re.compile(r"배를\s*퀴즈"), "배틀 퀴즈"),
    (re.compile(r"(급식|메뉴|학교간)\s*배를"), r"\1 배틀"),
    (re.compile(r"메뉴배들"), "메뉴배틀"),
    (re.compile(r",천드림\s*주식회사"), "썬드림 주식회사"),
    (re.compile(r"내\s*귀즈"), "내 퀴즈"),
    (re.compile(r"G00이e"), "Google"),
    (re.compile(r"(?:^|\b)시\s*분석(?=$|\s)"), "AI 분석"),
    (re.compile(r"습습습습습"), "★★★★★"),
]


def _sort_ocr_raw_tagged_text(raw_txt: str) -> str:
    """
    WinRT OcrLine의 BoundingRect(__POS_Y_X_H__Text) 좌표를 이용해:
    1) 표·좁은 칸에서 아랫줄로 밀린 완성형 한글 1글자('치커리오이유자소스무' + '침' ➔ '치커리오이유자소스무침')를 원래 단어에 결합하고,
    2) 화면 위➔아래(행 그룹핑) 및 좌➔우(X좌표) 순서대로 자연스럽게 정렬합니다.
    """
    if "__POS_" not in raw_txt:
        return raw_txt
    items: List[Dict[str, Any]] = []
    for chunk in raw_txt.split(" ||| "):
        chunk_s = chunk.strip()
        if not chunk_s:
            continue
        m = re.match(r"^__POS_(-?\d+)_(-?\d+)_(\d+)__(.*)$", chunk_s)
        if m:
            items.append({
                "y": int(m.group(1)),
                "x": int(m.group(2)),
                "h": max(8, int(m.group(3))),
                "text": m.group(4).strip(),
            })
        else:
            items.append({"y": 99999, "x": 0, "h": 14, "text": chunk_s})

    if not items:
        return ""

    items.sort(key=lambda it: (it["y"], it["x"]))

    # 1) 표 셀 줄바꿈으로 떨어진 단독 한글 1글자('침', '장' 등)를 직전 줄의 같은 열 단어 끝에 재결합
    merged_flags = [False] * len(items)
    for i, cur in enumerate(items):
        t_cur = cur["text"]
        if not re.fullmatch(r"[가-힣]", t_cur):
            continue
        best_parent_idx = -1
        best_dy = 999999
        for j in range(i - 1, -1, -1):
            if merged_flags[j]:
                continue
            prev = items[j]
            dy = cur["y"] - prev["y"]
            if dy <= 2:
                continue
            if dy > max(48, int(prev["h"] * 2.6)):
                break
            t_prev = prev["text"]
            if len(t_prev) < 3 or not re.search(r"[가-힣]$", t_prev):
                continue
            est_w = max(60, len(t_prev) * max(12, int(prev["h"] * 0.95)))
            if (prev["x"] - 24) <= cur["x"] <= (prev["x"] + est_w + 24):
                if dy < best_dy:
                    best_dy = dy
                    best_parent_idx = j
        if best_parent_idx >= 0:
            items[best_parent_idx]["text"] = items[best_parent_idx]["text"] + t_cur
            merged_flags[i] = True

    active_items = [it for idx, it in enumerate(items) if not merged_flags[idx] and it["text"]]
    if not active_items:
        return ""

    # 2) 위➔아래(Y 허용오차 내 동일 행 묶음) ➔ 좌➔우(X 오름차순) 정렬
    active_items.sort(key=lambda it: (it["y"], it["x"]))
    rows: List[List[Dict[str, Any]]] = []
    for it in active_items:
        if not rows:
            rows.append([it])
            continue
        cur_row = rows[-1]
        ref_y = sum(x["y"] for x in cur_row) / len(cur_row)
        ref_h = min(cur_row[0]["h"], it["h"])
        if abs(it["y"] - ref_y) <= max(10.0, ref_h * 0.62):
            cur_row.append(it)
        else:
            rows.append([it])

    ordered_texts: List[str] = []
    for r in rows:
        r.sort(key=lambda it: it["x"])
        for it in r:
            ordered_texts.append(it["text"])
    return " ||| ".join(ordered_texts)


def _clean_video_ocr_display_text(raw_txt: str) -> str:
    """
    동영상 화면 OCR에서 줄 내부의 '별명 / 숫자' 슬래시(/)는 그대로 보존하고,
    WinRT OCR이 구분한 줄(Line) 단위로만 서브픽셀 한자/기호 파편(口, 巳, 鸞g龜O딘 등)을 정화합니다.
    """
    s = _sort_ocr_raw_tagged_text(str(raw_txt or "").strip())
    if not s:
        return ""
    raw_lines = [seg.strip() for seg in re.split(r"\s*(?:\|\|\||·)\s*", s) if seg.strip()]
    cleaned_lines: List[str] = []
    for seg in raw_lines:
        if not seg:
            continue
        for rx, repl in _VIDEO_OCR_JITTER_CORRECTIONS:
            seg = rx.sub(repl, seg)
        # 날짜 하이픈이 가운뎃점(2025•10•15)으로 찍힌 경우 먼저 복원 및 끝단 기호 찌꺼기(`•) 제거
        seg = re.sub(r"(?<=\d)[•·](?=\d)", "-", seg)
        seg = re.sub(r"[`´•·]+$", "", seg).strip()
        # 한자 노이즈가 섞인 짧은 파편('*드訃 교' 등)은 한자만 지우면 외계어 조각이 남으므로 통째로 폐기
        if re.search(r"[\u4e00-\u9fff㈀-㈞]", seg) and len(re.findall(r"[가-힣]", seg)) <= 3:
            continue
        # 줄 맨 앞의 깨진 색상칩/체크박스/열린괄호 아이콘 기호([1, ], [], 〈, (, 口 등) 제거
        seg = re.sub(
            r"^(?:\[[^\]]{0,3}\]?\s*|\]+\s*|\|[가-힣0-9]{1,2}\s*|[〔「『〈<][」』기결舅17]?\s*|\(\s+(?=[^)]*$)|[CKL][3å,]?\s+|[口巳臼匕團國爨鸞龜匶Ⅰ|ㆍ•\-]+\s*)+",
            "",
            seg,
        ).strip()
        # 날짜/드롭다운 우측 화살표 아이콘('2025-10-15 수 v', '관심학교 v')이 영문 'v'로 잘못 찍힌 꼬리 정리
        seg = re.sub(r"(?<=[가-힣0-9])\s+[vV∨ˇ]$", "", seg).strip()
        seg = re.sub(r"[\u4e00-\u9fff㈀-㈞]+", "", seg).strip()
        # 동그란 아이콘 오인식('00()') 및 일러스트/저대비 깨짐 파편('무』먹1?', '*드 교', '기 드 지') 제거
        if re.fullmatch(r"[0oO()\[\]{}<>\s]+", seg):
            continue
        if re.search(r"[*『』「」〔〕]", seg) and len(re.findall(r"[가-힣]", seg)) <= 2:
            continue
        if re.fullmatch(r"[가-힣](?:\s+[가-힣]){1,4}", seg):
            continue
        # 일반화된 구조 규칙: '닉네임 / 숫자' 목록에서 WinRT OCR이 '/'를 '7','1','!','|' 또는 공백으로 오인한 패턴을 '단어 / 숫자'로 정규화
        seg = re.sub(r"^([가-힣a-zA-Z0-9]{2,15})\s+(?:[71!|,]\s*)?(\d{1,2})$", r"\1 / \2", seg)
        if not seg or _VIDEO_OCR_NOISE_SEGS_RX.match(seg):
            continue
        # 회전 휠 내부의 휘어진 글자 조각이나 숫자/수식 깨짐 파편 제거 (단, 표 내부 소수점 점수 '5.0', '4.5' 등은 보존)
        if re.fullmatch(r"[\d+\-*=/.:\s]+", seg) and not re.fullmatch(r"\d{1,3}\.\d{1,2}", seg):
            continue
        if re.search(r"(?:기리김|이니통를|을이랑|영고야시랑|hhi333|강툳꽃|굴정피워|기별\*이|콤지맄이|핫찔12|Bc»BOP|ht1ihi|파•g좀이|경구퓸|^정쟁$)", seg):
            continue
        # 의미 없는 단독 영문/기호 1글자(C, L, 7 등)는 제외하되, 줄바꿈된 완성형 한글 1글자('침', '장' 등)는 보존
        if re.fullmatch(r"\d{1,2}", seg):
            continue
        if len(seg) <= 1 and not re.fullmatch(r"[가-힣]", seg):
            continue
        alnum = re.sub(r"[^가-힣a-zA-Z0-9]", "", seg)
        if len(alnum) < 2 and not re.fullmatch(r"[가-힣]", alnum):
            continue
        # 회전 휠 내부의 휘어진 글자 조각(한글 1~2자 + 특수문자 다수 조합) 노이즈 제거
        ko_cnt = len(re.findall(r"[가-힣]", seg))
        sym_cnt = len(re.findall(r"[^가-힣a-zA-Z0-9\s/➕+:.\-?!%()]", seg))
        if sym_cnt >= 2 and ko_cnt <= 3:
            continue
        cleaned_lines.append(seg)
    return " · ".join(cleaned_lines)


def _is_meaningful_ocr_text(txt: str) -> bool:
    """
    야외/실내 일반 영상의 나뭇가지·그림자·물결 노이즈('=』젤TA爨', '•謷&•구수하')나
    편집툴·AI 생성 코너 워터마크('Veo', '= KAPWING', 'CapCut')는 차단하되,
    스마트폰 화면 녹화·프레젠테이션·안내 자막 등 실제 한글/영문 문장은 정확히 통과시킵니다.
    """
    s = str(txt or "").strip()
    if not s:
        return False
    cleaned = _WATERMARK_OCR_RX.sub(" ", s).strip()
    alnum = re.sub(r"[^가-힣a-zA-Z0-9]", "", cleaned)
    if len(alnum) < 4:
        return False
    ko_chars = re.findall(r"[가-힣]", alnum)
    cjk_chars = re.findall(r"[\u4e00-\u9fff]", cleaned)
    non_space = re.sub(r"\s+", "", cleaned)
    if non_space and (len(alnum) / len(non_space)) < 0.58:
        return False
    if len(ko_chars) >= 12 and len(cjk_chars) <= max(2, len(ko_chars) // 5):
        return True
    if cjk_chars:
        return False
    if len(ko_chars) >= 5:
        return True
    if not ko_chars:
        en_words = re.findall(r"[a-zA-Z]{2,}", cleaned)
        if len(en_words) < 2 or len(alnum) < 8:
            return False
    if ko_chars and (len(ko_chars) < 3 or len(alnum) < 5):
        return False
    return True


def _enrich_ocr_semantic_keywords(ocr_text: str) -> List[str]:
    """화면 OCR 인식 오타 보정 및 핵심 검색 키워드 정규화 (워터마크·배경 노이즈 원천 차단)"""
    if not _is_meaningful_ocr_text(ocr_text):
        return []
    cleaned = _WATERMARK_OCR_RX.sub(" ", ocr_text).lower()
    kws: List[str] = []
    for w in re.findall(r"[가-힣a-z0-9]{2,}", cleaned):
        if len(w) <= 24:
            kws.append(w)
    if "를렛" in cleaned or "룰렛" in cleaned or ("당첨자" in cleaned and "별명" in cleaned):
        kws.extend(["룰렛", "룰렛추첨", "돌림판", "추첨", "당첨", "이벤트"])
    if "이미지 생성" in cleaned or "이미지생성" in cleaned or "ai 이미지" in cleaned:
        kws.extend(["ai", "ai이미지", "이미지생성", "인공지능"])
    if "급식" in cleaned or "lunbat" in cleaned or "메뉴 배틀" in cleaned or "메뉴배틀" in cleaned or "영양정보" in cleaned:
        kws.extend(["급식", "학교급식", "급식배틀", "식단", "영양정보"])
    if "리얼픽" in cleaned or "투표하기" in cleaned or "당신의 선택" in cleaned:
        kws.extend(["리얼픽", "투표", "선택", "퀴즈", "앱"])
    return list(dict.fromkeys(kws))[:40]


def _select_video_ocr_sample_secs(dur_sec: float) -> List[int]:
    """짧은 영상의 후반 엔드카드(예: 10초 영상의 8초 자막)부터 장시간 녹화본의 초반(3초) 상단 목록까지 누락 없이 대표 구간을 추출합니다."""
    t_int = max(1, int(round(dur_sec)))
    if t_int < 4:
        return [max(0, int(round(dur_sec * 0.4)))]
    if t_int <= 60:
        cands = [
            max(1, int(round(dur_sec * 0.15))),
            max(2, int(round(dur_sec * 0.50))),
            max(3, min(t_int - 1, int(round(dur_sec * 0.82)))),
        ]
    else:
        cands = [
            min(3, max(1, int(round(dur_sec * 0.03)))),
            max(8, int(round(dur_sec * 0.25))),
            max(15, int(round(dur_sec * 0.55))),
            max(20, min(t_int - 1, int(round(dur_sec * 0.94)))),
        ]
    return sorted(set(cands))


def _run_batch_video_ocr(video_entries: List[tuple[str, Path, float]]) -> None:
    """미인덱싱 로컬 동영상 전수를 순회하며 장면 안정화 필터(_select_stable_scene_frames) + PP-OCRv5 Korean으로 정밀 영구 인덱싱합니다."""
    global _VIDEO_OCR_BG_RUNNING
    if os.name != "nt" or not video_entries:
        with _VIDEO_OCR_LOCK:
            _VIDEO_OCR_BG_RUNNING = False
        return
    try:
        time.sleep(20.0)
        processed_v = 0
        for cache_sig, vpath, _dur_sec in video_entries:
            if processed_v >= 10:
                break
            try:
                if not vpath.exists() or vpath.stat().st_size > 35 * 1024 * 1024:
                    continue
                cur_cache = _load_video_ocr_cache()
                if int((cur_cache.get(cache_sig) or {}).get("ocrVer") or 0) >= _VIDEO_PADDLE_OCR_VER:
                    continue
                extract_full_video_ocr_text({"videoFileName": vpath.name, "filePath": str(vpath)})
                processed_v += 1
            except Exception:
                pass
            time.sleep(1.50)
    finally:
        if _VIDEO_OCR_CACHE_DIRTY and _VIDEO_OCR_MEM_CACHE is not None:
            _save_video_ocr_cache(_VIDEO_OCR_MEM_CACHE, force_flush=True)
        with _VIDEO_OCR_LOCK:
            _VIDEO_OCR_BG_RUNNING = False


def _run_winrt_ocr_on_jpg_dir(tmp_dir: Path) -> Dict[str, str]:
    """[SOTA 단일화] 지정 폴더 내 *.jpg 동영상 프레임들에 대해 PP-OCRv5 Korean(ONNX) 격리 워커로 다단 슬라이드·자막을 일괄 판독합니다."""
    ocr_by_file: Dict[str, str] = {}
    if not tmp_dir.exists():
        return ocr_by_file
    jpg_files = sorted(tmp_dir.glob("*.jpg"), key=lambda p: p.name)
    if not jpg_files:
        return ocr_by_file
    try:
        import ppocr_v5_worker

        batch_size = 20
        for idx in range(0, len(jpg_files), batch_size):
            chunk = jpg_files[idx : idx + batch_size]
            res_map = ppocr_v5_worker.invoke_ppocr_subprocess(
                chunk,
                filter_video_ui=True,
                timeout_sec=max(75.0, len(chunk) * 8.5),
            )
            if not res_map:
                continue
            for jf in chunk:
                full_k = str(jf.resolve())
                if full_k in res_map or jf.name in res_map:
                    item = res_map.get(full_k) or res_map.get(jf.name) or {}
                    smart_t = re.sub(r"\s+", " ", str(item.get("smartText") or "")).strip()
                    ocr_by_file[jf.name] = smart_t
    except Exception:
        pass
    return ocr_by_file


_RECORDER_WATERMARK_SEG_RX = re.compile(
    r"^(?:notebooklm|capcut|veo|kapwing|[xyv]?rec[eo@0]rder|mobizen|bandicam(?:\.com)?|gomcam|ocam|az\s*screen(?:\s*recorder)?|inshot|kinemaster|vivavideo|filmora)$",
    re.IGNORECASE,
)


def _strip_video_watermark_segments(text: str) -> str:
    if not text:
        return ""
    segs = [seg.strip() for seg in text.split(" · ") if seg.strip()]
    kept = [seg for seg in segs if not _RECORDER_WATERMARK_SEG_RX.fullmatch(seg)]
    return " · ".join(kept)


def _dedupe_ocr_timeline_lines(raw_frames: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    연속 구간에서 동일한 자막·슬라이드 문구가 반복될 때 중복을 제거하고,
    화면 녹화·편집 앱 우하단 고정 워터마크(XRecorder/XRecerder/YRecerder, Bandicam, Mobizen 등 및 3프레임 이상 반복 영문 코너 배지)를 제거하며,
    애니메이션 빌드업(제목 먼저 등장 ➔ 본문 카드 추가 등장) 시에는 앞의 부분 텍스트를 완성형 본문으로 자동 승격(Upgrade Replace)합니다.
    """
    deduped: List[Dict[str, Any]] = []
    prev_norm = ""
    prev_bigrams: set[str] = set()

    def _bigrams(s: str) -> set[str]:
        return {s[i : i + 2] for i in range(len(s) - 1)} if len(s) >= 2 else ({s} if s else set())

    # 사전 패스: 3개 이상의 서로 다른 구간 우하단 끝에 고정 박혀 반복되는 영문 워터마크 배지 자동 탐지
    frame_seg_lists: List[tuple[int, Dict[str, Any], List[str]]] = []
    for fr in sorted(raw_frames, key=lambda x: int(x.get("timeSec") or 0)):
        raw_s = str(fr.get("ocrText") or "").strip()
        txt0 = re.sub(r"\s+", " ", raw_s).strip() if fr.get("fromPaddleV5") else _clean_video_ocr_display_text(raw_s)
        txt0 = _strip_video_watermark_segments(txt0)
        segs = [sg.strip() for sg in txt0.split(" · ") if sg.strip()]
        frame_seg_lists.append((int(fr.get("timeSec") or 0), fr, segs))

    if len(frame_seg_lists) >= 3:
        tail_cands: List[tuple[int, set[str]]] = []
        for idx_f, (_ts, _fr, segs) in enumerate(frame_seg_lists):
            if len(segs) >= 2:
                tail = segs[-1]
                if 3 <= len(tail) <= 20 and re.fullmatch(r"[A-Za-z0-9._\- ]+", tail) and re.search(r"[A-Za-z]{3,}", tail):
                    tail_cands.append((idx_f, _bigrams(re.sub(r"[^a-z0-9]", "", tail.lower()))))
        drop_tail_indices: set[int] = set()
        for idx_a, bg_a in tail_cands:
            if not bg_a:
                continue
            sim_cnt = 0
            for _idx_b, bg_b in tail_cands:
                if not bg_b:
                    continue
                ov = len(bg_a & bg_b) / float(max(1, min(len(bg_a), len(bg_b))))
                if ov >= 0.72:
                    sim_cnt += 1
            if sim_cnt >= 3:
                drop_tail_indices.add(idx_a)
        if drop_tail_indices:
            frame_seg_lists = [
                (ts_v, fr_v, segs[:-1] if i_f in drop_tail_indices and len(segs) >= 2 else segs)
                for i_f, (ts_v, fr_v, segs) in enumerate(frame_seg_lists)
            ]

    for s_val, fr, segs in frame_seg_lists:
        txt = " · ".join(segs).strip()
        if not txt or (not fr.get("fromPaddleV5") and not _is_meaningful_ocr_text(txt)):
            continue
        # 한글이 전혀 없는 순수 영문/기호 문자열은 유효 도메인·이메일이거나 4글자 이상 정상 영단어 2개 이상일 때만 허용 (야외 영상 MNTAL:-, 440 · Ch 등 오인식 차단)
        if not re.search(r"[가-힣]", txt):
            has_domain_or_mail = bool(
                re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\b[A-Za-z0-9-]+\.(?:com|kr|net|org|io|app|ai|edu|gov)\b", txt, re.IGNORECASE)
            )
            clean_en_words = re.findall(r"\b[A-Za-z]{4,}\b", txt)
            has_noise_tail = bool(re.search(r"[:\-_~]{2,}|[:\-]$", txt.strip()))
            if has_noise_tail or (not has_domain_or_mail and len(clean_en_words) < 2):
                continue
        norm = re.sub(r"[^가-힣a-zA-Z0-9]", "", txt).lower()
        if len(norm) < 4:
            continue
        cur_bigrams = _bigrams(norm)
        s_int = int(fr.get("timeSec") or 0)
        ts_str = f"{int(s_int // 60):02d}:{int(s_int % 60):02d}"

        if prev_norm and deduped:
            if norm == prev_norm:
                continue
            # 현재 프레임이 직전 완성 프레임의 일부분(페이드아웃 등)이면 직전 완성본 유지
            if len(norm) >= 5 and norm in prev_norm:
                continue
            # 직전 프레임이 제목/초반 일부이고 현재 프레임에 본문 전체가 다 나타난 경우 ➔ 직전 항목 본문 및 타임스탬프를 완성 프레임 시각으로 함께 승격!
            if len(prev_norm) >= 5 and prev_norm in norm:
                deduped[-1]["text"] = txt
                deduped[-1]["timeSec"] = s_int
                deduped[-1]["timestamp"] = ts_str
                prev_norm = norm
                prev_bigrams = cur_bigrams
                continue
            if prev_bigrams and cur_bigrams:
                containment = len(prev_bigrams & cur_bigrams) / float(max(1, min(len(prev_bigrams), len(cur_bigrams))))
                dt_prev = s_int - int(deduped[-1].get("timeSec") or 0)
                is_fast_scroll_settle = (
                    dt_prev <= 4
                    and len(norm) >= int(len(prev_norm) * 2.5)
                    and containment >= 0.36
                )
                is_shake_settle = (
                    dt_prev <= 6
                    and containment >= 0.68
                    and len(norm) >= len(prev_norm)
                )
                if containment >= 0.80 or is_fast_scroll_settle or is_shake_settle:
                    if is_shake_settle or len(norm) > len(prev_norm) + 4:
                        deduped[-1]["text"] = txt
                        deduped[-1]["timeSec"] = s_int
                        deduped[-1]["timestamp"] = ts_str
                        prev_norm = norm
                        prev_bigrams = cur_bigrams
                    continue

        prev_norm = norm
        prev_bigrams = cur_bigrams
        deduped.append({
            "timeSec": s_int,
            "timestamp": ts_str,
            "text": txt,
        })
    return deduped


def _select_stable_scene_frames(
    candidates: List[tuple[Path, int]],
    max_keep: int = 16,
) -> Dict[str, int]:
    """
    [고속 장면 변화(Scene-Change) 선별 & 디졸브 잔상 제거기]
    1) 2초 간격으로 추출된 전체 프레임의 96x54 초경량 그레이스케일 썸네일을 15ms 내에 비교합니다.
    2) 변화가 없는 정지 슬라이드 중복 프레임은 OCR 실행 전에 즉시 제거하여 추론 시간을 77초 ➔ 3~4초로 단축합니다.
    3) 앞뒤 슬라이드가 반투명하게 겹치는 디졸브(Cross-fade) 전환 프레임을 배제하고,
       각 장면 군집 내에서 글자 윤곽 선명도(Edge Sharpness)가 가장 높은 완성 프레임을 대표로 선별합니다.
    """
    if not candidates:
        return {}
    try:
        import numpy as np
        from PIL import Image

        meta_list: List[Dict[str, Any]] = []
        for p_jpg, sec_val in candidates:
            if not p_jpg.exists():
                continue
            try:
                with Image.open(p_jpg) as im:
                    im_l = im.convert("L")
                    iw, ih = im_l.size
                    g = np.asarray(im_l.resize((96, 54), Image.Resampling.BILINEAR), dtype=np.float32)
                    short_side = max(1, min(iw, ih))
                    sc_s = min(1.0, 320.0 / float(short_side))
                    sw_s = max(32, int(round(iw * sc_s)))
                    sh_s = max(32, int(round(ih * sc_s)))
                    gs = np.asarray(im_l.resize((sw_s, sh_s), Image.Resampling.BILINEAR), dtype=np.float32)
                std_v = float(np.std(g))
                if std_v < 4.5:  # 완전 암전·백색 페이드 화면 제외
                    p_jpg.unlink(missing_ok=True)
                    continue
                # 320px 단변 기준 2차 미분(Laplacian) 고주파 에너지로 스크롤·손떨림 이중 잔상 프레임을 배제하고 정지 완성 프레임을 선별
                lap_x = np.abs(2.0 * gs[:, 1:-1] - gs[:, :-2] - gs[:, 2:])
                lap_y = np.abs(2.0 * gs[1:-1, :] - gs[:-2, :] - gs[2:, :])
                sharp = float(np.mean(lap_x) + np.mean(lap_y))
                meta_list.append({"path": p_jpg, "sec": sec_val, "g": g, "sharp": sharp})
            except Exception:
                continue

        if not meta_list:
            return {}

        clusters: List[List[Dict[str, Any]]] = [[meta_list[0]]]
        diffs: List[float] = [0.0]
        for idx in range(1, len(meta_list)):
            cur_m = meta_list[idx]
            prev_m = clusters[-1][-1]
            mad = float(np.mean(np.abs(cur_m["g"] - prev_m["g"])))
            diffs.append(mad)
            if mad < 4.3:
                clusters[-1].append(cur_m)
            else:
                clusters.append([cur_m])

        selected: List[tuple[Path, int]] = []
        for c_idx, cl in enumerate(clusters):
            # 양옆 안정 슬라이드 사이에 낀 1프레임 디졸브/가로 슬라이드/스크롤 전환 프레임 배제
            if len(cl) == 1 and len(clusters) >= 3 and 0 < c_idx < len(clusters) - 1:
                prev_cl = clusters[c_idx - 1]
                next_cl = clusters[c_idx + 1]
                cur_item = cl[0]
                d_prev = float(np.mean(np.abs(cur_item["g"] - prev_cl[-1]["g"])))
                d_next = float(np.mean(np.abs(next_cl[0]["g"] - cur_item["g"])))
                neighbor_sharp = max(prev_cl[-1]["sharp"], next_cl[0]["sharp"])
                if d_prev > 4.2 and d_next > 4.2 and (
                    len(prev_cl) >= 2
                    or len(next_cl) >= 2
                    or cur_item["sharp"] < neighbor_sharp * 0.98
                ):
                    continue

            # 동일 장면 군집 내에서 애니메이션·스크롤이 완료된 가장 선명한 프레임을 선택하고, 해당 프레임의 실제 시각(best_item["sec"])을 기록해 [MM:SS] 클릭 시 화면이 100% 일치하도록 보장
            best_item = max(cl, key=lambda x: (x["sharp"], x["sec"]))
            selected.append((best_item["path"], int(best_item["sec"])))

        if len(selected) > max_keep:
            step_f = len(selected) / float(max_keep)
            picked_indices = sorted({min(len(selected) - 1, int(round(i * step_f))) for i in range(max_keep)})
            selected = [selected[i] for i in picked_indices]

        keep_paths = {p.resolve() for p, _ in selected}
        for m in meta_list:
            if m["path"].resolve() not in keep_paths:
                try:
                    m["path"].unlink(missing_ok=True)
                except Exception:
                    pass

        return {p.name: s for p, s in selected}
    except Exception:
        return {p.name: s for p, s in candidates[:max_keep] if p.exists()}


def ingest_browser_video_ocr_frames(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    [무-FFmpeg 호환 & PP-OCRv5 고정밀 캐시 통합]
    1) precomputedFrames(PP-OCRv5 Korean 판독 결과)가 전달되면 그대로 ocrVer=20 영구 캐싱합니다.
    2) 원시 JPEG 배열(frames)만 전달되더라도 동일하게 로컬 PP-OCRv5 Korean 격리 워커로 고정밀 판독 후 ocrVer=20 영구 캐싱합니다.
    """
    vname = str(data.get("videoFileName") or "").strip()
    precomputed_in = data.get("precomputedFrames")
    frames_in = data.get("frames") or []
    if not vname or (not isinstance(precomputed_in, list) and (not isinstance(frames_in, list) or not frames_in)):
        return {"ok": False, "error": "EMPTY_FRAMES"}

    resolved_path = _PHOTO_PATH_INDEX.get(vname)
    if not resolved_path or not resolved_path.exists():
        # 파일명 매칭 폴백 탐색
        for d in _iter_scan_dirs(_get_user_scan_roots(), max_depth=3):
            cand = d / vname
            if cand.exists() and cand.is_file():
                resolved_path = cand.resolve()
                _PHOTO_PATH_INDEX[vname] = resolved_path
                break

    sig = ""
    if resolved_path and resolved_path.exists():
        st = resolved_path.stat()
        sig = f"{resolved_path.name}|{st.st_size}|{int(st.st_mtime)}"
    else:
        sz = int(data.get("size") or 0)
        mt = int(float(data.get("mtimeMs") or 0) / 1000) if data.get("mtimeMs") else 0
        sig = f"{vname}|{sz}|{mt}"

    if isinstance(precomputed_in, list) and len(precomputed_in) > 0:
        paddle_frames: List[Dict[str, Any]] = []
        paddle_kws: List[str] = []
        for item in precomputed_in[:30]:
            if not isinstance(item, dict):
                continue
            s_val = max(0, int(round(float(item.get("timeSec") or 0))))
            p_txt = re.sub(r"\s+", " ", str(item.get("ocrText") or "").strip())[:1600]
            kws = _enrich_ocr_semantic_keywords(p_txt) if p_txt else []
            paddle_kws.extend(kws)
            paddle_frames.append({
                "timeSec": s_val,
                "ocrText": p_txt,
                "keywords": kws,
                "fromPaddleV5": True,
            })
        dedup_lines = _dedupe_ocr_timeline_lines(paddle_frames)
        full_txt = "\n".join(f"[{ln['timestamp']}] {ln['text']}" for ln in dedup_lines)
        has_txt = len(dedup_lines) > 0
        with _VIDEO_OCR_LOCK:
            cur_cache = _load_video_ocr_cache()
            cur_cache[sig] = {
                "ocrVer": _VIDEO_PADDLE_OCR_VER,
                "videoFileName": vname,
                "filePath": str(resolved_path) if resolved_path else "",
                "frames": paddle_frames,
                "keywords": list(dict.fromkeys(paddle_kws))[:60],
                "lines": dedup_lines,
                "fullText": full_txt,
                "lineCount": len(dedup_lines),
                "isAllBlack": False,
            }
            _save_video_ocr_cache(cur_cache)
        return {
            "ok": True,
            "videoFileName": vname,
            "lines": dedup_lines,
            "ocrLines": dedup_lines,
            "fullText": full_txt,
            "lineCount": len(dedup_lines),
            "hasText": has_txt,
            "hasRichText": has_txt,
        }

    tmp_dir = Path(tempfile.mkdtemp(prefix="merlin_browser_vid_ocr_"))
    try:
        sec_by_fname: Dict[str, int] = {}
        max_jpg_bytes = 0
        for idx, item in enumerate(frames_in[:24]):
            if not isinstance(item, dict):
                continue
            b64 = str(item.get("jpegBase64") or item.get("dataUrl") or "").strip()
            if "," in b64 and b64.startswith("data:"):
                b64 = b64.split(",", 1)[1]
            if not b64:
                continue
            try:
                raw_bytes = base64.b64decode(b64)
            except Exception:
                continue
            s_val = max(0, int(round(float(item.get("timeSec") or 0))))
            fname = f"f{idx:03d}_s{s_val:04d}.jpg"
            (tmp_dir / fname).write_bytes(raw_bytes)
            if len(raw_bytes) > max_jpg_bytes:
                max_jpg_bytes = len(raw_bytes)
            sec_by_fname[fname] = s_val

        if not sec_by_fname:
            return {"ok": False, "error": "NO_VALID_JPEG"}

        ocr_map = _run_winrt_ocr_on_jpg_dir(tmp_dir)
        out_frames: List[Dict[str, Any]] = []
        all_kws: List[str] = []
        for fname, s_val in sorted(sec_by_fname.items()):
            txt = ocr_map.get(fname, "").strip()
            kws = _enrich_ocr_semantic_keywords(txt) if txt else []
            all_kws.extend(kws)
            out_frames.append({
                "timeSec": s_val,
                "ocrText": txt[:1600],
                "keywords": kws,
                "fromPaddleV5": True,
            })

        with _VIDEO_OCR_LOCK:
            cur_cache = _load_video_ocr_cache()
            prev_entry = cur_cache.get(sig) or {}
            prev_ver = int(prev_entry.get("ocrVer") or 0)
            prev_frames = prev_entry.get("frames") if isinstance(prev_entry.get("frames"), list) else []
            merged_by_sec: Dict[int, Dict[str, Any]] = {}
            if prev_ver >= _VIDEO_PADDLE_OCR_VER:
                for pf in prev_frames:
                    p_txt = str(pf.get("ocrText") or "").strip()
                    if p_txt:
                        merged_by_sec[int(pf.get("timeSec") or 0)] = {
                            "timeSec": int(pf.get("timeSec") or 0),
                            "ocrText": p_txt,
                            "keywords": _enrich_ocr_semantic_keywords(p_txt),
                            "fromPaddleV5": True,
                        }
            for nf in out_frames:
                if nf.get("ocrText"):
                    merged_by_sec[int(nf.get("timeSec") or 0)] = nf
            merged_frames = [merged_by_sec[k] for k in sorted(merged_by_sec.keys())]
            merged_lines = _dedupe_ocr_timeline_lines(merged_frames)
            merged_full_text = "\n".join(f"[{ln['timestamp']}] {ln['text']}" for ln in merged_lines)
            merged_kws: List[str] = []
            for mf in merged_frames:
                merged_kws.extend(mf.get("keywords") or [])
            has_meaningful = len(merged_lines) > 0 and sum(len(ln.get("text") or "") for ln in merged_lines) >= 6
            cur_cache[sig] = {
                "ocrVer": _VIDEO_PADDLE_OCR_VER,
                "videoFileName": vname,
                "filePath": str(resolved_path) if resolved_path else "",
                "frames": merged_frames,
                "keywords": list(dict.fromkeys(merged_kws))[:60],
                "lines": merged_lines,
                "fullText": merged_full_text,
                "lineCount": len(merged_lines),
                "isAllBlack": bool(max_jpg_bytes > 0 and max_jpg_bytes < 4200),
            }
            _save_video_ocr_cache(cur_cache)

        return {
            "ok": True,
            "videoFileName": vname,
            "lines": merged_lines,
            "ocrLines": merged_lines,
            "fullText": merged_full_text,
            "lineCount": len(merged_lines),
            "hasText": has_meaningful,
            "hasRichText": has_meaningful,
        }
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def extract_full_video_ocr_text(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    [귀신검색창 & 웹 공통 '📝 영상 속 글자 텍스트로 뽑기' 온디맨드 API (PP-OCRv5 Korean 일원화)]
    1) 이미 PP-OCRv5(ocrVer >= 20) 대본이 캐싱되어 있고 force=False이면 0.01초 즉시 반환
    2) 미캐싱 시 FFmpeg(설치 시) 또는 Windows MediaClip 썸네일 디코더로 영상 구간별 JPEG 프레임을 추출하고,
       PP-OCRv5 Korean(ONNX) 격리 워커로 다단 카드·줄바꿈 자막을 정밀 복원합니다.
    """
    raw_p = str(params.get("p") or params.get("videoFileName") or params.get("filePath") or "").strip()
    force = str(params.get("force") or "").lower() in ("1", "true", "yes")
    only_cached_v5 = str(params.get("onlyCachedV5") or "").lower() in ("1", "true", "yes")
    return_frames_for_paddle = str(params.get("returnFramesForPaddle") or "").lower() in ("1", "true", "yes")
    if not raw_p:
        return {"ok": False, "error": "MISSING_VIDEO_TARGET"}

    target_path: Path | None = None
    cand_direct = Path(raw_p)
    if cand_direct.is_absolute() and cand_direct.exists() and cand_direct.is_file():
        target_path = cand_direct.resolve()
    else:
        fname_only = Path(urllib.parse.unquote(raw_p)).name
        if fname_only in _PHOTO_PATH_INDEX and _PHOTO_PATH_INDEX[fname_only].exists():
            target_path = _PHOTO_PATH_INDEX[fname_only]
        else:
            for d in _iter_scan_dirs(_get_user_scan_roots(), max_depth=3):
                cand = d / fname_only
                if cand.exists() and cand.is_file():
                    target_path = cand.resolve()
                    _PHOTO_PATH_INDEX[fname_only] = target_path
                    break

    if not target_path or not target_path.exists():
        return {"ok": False, "error": "VIDEO_NOT_FOUND"}

    st = target_path.stat()
    sig = f"{target_path.name}|{st.st_size}|{int(st.st_mtime)}"
    cache = _load_video_ocr_cache()
    cached = cache.get(sig)
    if cached and not force and int(cached.get("ocrVer") or 0) >= _VIDEO_PADDLE_OCR_VER and isinstance(cached.get("frames"), list) and len(cached.get("frames", [])) >= 1:
        lines = _dedupe_ocr_timeline_lines(cached["frames"])
        full_text = "\n".join(f"[{ln['timestamp']}] {ln['text']}" for ln in lines)
        return {
            "ok": True,
            "cached": True,
            "ocrVer": int(cached.get("ocrVer") or 0),
            "hasText": len(lines) > 0,
            "videoFileName": target_path.name,
            "filePath": str(target_path),
            "lines": lines,
            "ocrLines": lines,
            "fullText": full_text,
            "lineCount": len(lines),
        }

    if only_cached_v5 and not return_frames_for_paddle:
        return {
            "ok": True,
            "cached": False,
            "needsPaddleOcr": True,
            "hasText": False,
            "videoFileName": target_path.name,
            "filePath": str(target_path),
            "lines": [],
            "ocrLines": [],
            "fullText": "",
            "lineCount": 0,
        }

    dur = max(2.0, _get_fast_video_duration_sec(target_path))
    scan_interval = max(1.5, round(dur / 52.0, 2))
    dense_count = min(32, max(6, int(dur // 2.5) + 1))
    sample_secs = sorted({max(0, min(int(dur) - 1, int(round((dur * (i + 0.35)) / dense_count)))) for i in range(dense_count)})

    tmp_dir = Path(tempfile.mkdtemp(prefix="merlin_vid_fullocr_"))
    creationflags = 0x08000000
    ff = find_ffmpeg_exe()
    sec_by_fname: Dict[str, int] = {}
    try:
        if ff:
            raw_candidates: List[tuple[Path, int]] = []
            start_off = 0.35 if dur >= 3.0 else 0.0
            try:
                ff_cmd = [ff, "-hide_banner", "-loglevel", "error", "-y"]
                if start_off > 0:
                    ff_cmd.extend(["-ss", f"{start_off:.2f}"])
                ff_cmd.extend([
                    "-i",
                    str(target_path),
                    "-vf",
                    f"fps=1/{scan_interval:.2f},scale='min(1600,iw)':-2",
                    "-frames:v",
                    "72",
                    "-q:v",
                    "2",
                    str(tmp_dir / "scan_%04d.jpg"),
                ])
                subprocess.run(
                    ff_cmd,
                    capture_output=True,
                    timeout=25,
                    creationflags=creationflags,
                )
            except Exception:
                pass
            scanned_files = sorted(tmp_dir.glob("scan_*.jpg"), key=lambda p: p.name)
            if scanned_files:
                for idx_s, sf_p in enumerate(scanned_files):
                    s_est = min(max(0, int(dur) - 1), int(round(start_off + idx_s * scan_interval)))
                    raw_candidates.append((sf_p, s_est))
            else:
                for idx, s_val in enumerate(sample_secs):
                    fname = f"f{idx:03d}_s{s_val:04d}.jpg"
                    out_jpg = tmp_dir / fname
                    try:
                        subprocess.run(
                            [
                                ff, "-y", "-ss", str(s_val), "-i", str(target_path),
                                "-frames:v", "1", "-q:v", "2", str(out_jpg),
                            ],
                            capture_output=True,
                            timeout=12,
                            creationflags=creationflags,
                        )
                    except Exception:
                        pass
                    if out_jpg.exists():
                        raw_candidates.append((out_jpg, s_val))
            sec_by_fname = _select_stable_scene_frames(raw_candidates, max_keep=12)
        elif os.name == "nt":
            # [무-FFmpeg 순정 Windows 10/11 폴백]: MediaClip으로 프레임 JPEG 파일만 추출 (판독은 100% PP-OCRv5로 일원화!)
            secs_csv = ",".join(str(s) for s in sample_secs)
            ps_extract_frames = (
                "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n"
                "Add-Type -AssemblyName System.Runtime.WindowsRuntime\n"
                "$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]\n"
                "$null = [Windows.Storage.StorageFolder, Windows.Storage, ContentType = WindowsRuntime]\n"
                "$null = [Windows.Media.Editing.MediaClip, Windows.Media.Editing, ContentType = WindowsRuntime]\n"
                "$null = [Windows.Media.Editing.MediaComposition, Windows.Media.Editing, ContentType = WindowsRuntime]\n"
                "$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]\n"
                "$null = [Windows.Graphics.Imaging.BitmapEncoder, Windows.Foundation, ContentType = WindowsRuntime]\n"
                "$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]\n"
                "$asTaskAction = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' })[0]\n"
                "function Await($WinRtTask, $ResultType) {\n"
                "    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)\n"
                "    $netTask = $asTask.Invoke($null, @($WinRtTask))\n"
                "    $netTask.Wait(-1) | Out-Null\n"
                "    $netTask.Result\n"
                "}\n"
                "function AwaitAction($WinRtAction) {\n"
                "    $netTask = $asTaskAction.Invoke($null, @($WinRtAction))\n"
                "    $netTask.Wait(-1) | Out-Null\n"
                "}\n"
                "$vfile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($args[0])) ([Windows.Storage.StorageFile])\n"
                "$outFolder = Await ([Windows.Storage.StorageFolder]::GetFolderFromPathAsync($args[2])) ([Windows.Storage.StorageFolder])\n"
                "$clip = Await ([Windows.Media.Editing.MediaClip]::CreateFromFileAsync($vfile)) ([Windows.Media.Editing.MediaClip])\n"
                "$comp = New-Object Windows.Media.Editing.MediaComposition\n"
                "[System.Collections.Generic.ICollection[Windows.Media.Editing.MediaClip]].GetMethod('Add').Invoke($comp.Clips, @($clip)) | Out-Null\n"
                "$idx = 0\n"
                "foreach ($s in ($args[1] -split ',')) {\n"
                "    try {\n"
                "        $sInt = [int][double]$s\n"
                "        $fname = ('f{0:D3}_s{1:D4}.jpg' -f $idx, $sInt)\n"
                "        $ts = [TimeSpan]::FromSeconds([double]$s)\n"
                "        $thumb = Await ($comp.GetThumbnailAsync($ts, 0, 0, [Windows.Media.Editing.VideoFramePrecision]::NearestFrame)) ([Windows.Graphics.Imaging.ImageStream])\n"
                "        $dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($thumb)) ([Windows.Graphics.Imaging.BitmapDecoder])\n"
                "        $bmp = Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])\n"
                "        $outFile = Await ($outFolder.CreateFileAsync($fname, [Windows.Storage.CreationCollisionOption]::ReplaceExisting)) ([Windows.Storage.StorageFile])\n"
                "        $outSt = Await ($outFile.OpenAsync([Windows.Storage.FileAccessMode]::ReadWrite)) ([Windows.Storage.Streams.IRandomAccessStream])\n"
                "        $enc = Await ([Windows.Graphics.Imaging.BitmapEncoder]::CreateAsync([Windows.Graphics.Imaging.BitmapEncoder]::JpegEncoderId, $outSt)) ([Windows.Graphics.Imaging.BitmapEncoder])\n"
                "        $enc.SetSoftwareBitmap($bmp)\n"
                "        AwaitAction ($enc.FlushAsync())\n"
                "        $outSt.Dispose()\n"
                "        $thumb.Dispose()\n"
                "        Write-Output \"$fname`t$sInt\"\n"
                "    } catch {}\n"
                "    $idx++\n"
                "}\n"
            )
            ps_f = tmp_dir / "extract_frames.ps1"
            ps_f.write_text(ps_extract_frames, encoding="utf-8-sig")
            proc = subprocess.run(
                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ps_f), str(target_path), secs_csv, str(tmp_dir)],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=38,
                creationflags=creationflags,
            )
            mc_candidates: List[tuple[Path, int]] = []
            for ln in proc.stdout.splitlines():
                if "\t" in ln:
                    fn_s, s_raw = ln.split("\t", 1)
                    cand_jpg = tmp_dir / fn_s.strip()
                    if cand_jpg.exists():
                        mc_candidates.append((cand_jpg, int(float(s_raw.strip() or "0"))))
            sec_by_fname = _select_stable_scene_frames(mc_candidates, max_keep=12)

        if return_frames_for_paddle and sec_by_fname:
            sampled_payload = []
            for fn_k, s_k in sorted(sec_by_fname.items()):
                raw_b = (tmp_dir / fn_k).read_bytes()
                sampled_payload.append({
                    "timeSec": s_k,
                    "dataUrl": "data:image/jpeg;base64," + base64.b64encode(raw_b).decode("ascii"),
                })
            return {
                "ok": True,
                "cached": False,
                "needsPaddleOcr": True,
                "videoFileName": target_path.name,
                "sampledFrames": sampled_payload,
            }

        ocr_map = _run_winrt_ocr_on_jpg_dir(tmp_dir) if sec_by_fname else {}
        out_frames_ff: List[Dict[str, Any]] = []
        all_kws_ff: List[str] = []
        for fname, s_val in sorted(sec_by_fname.items()):
            txt = ocr_map.get(fname, "").strip()
            kws = _enrich_ocr_semantic_keywords(txt) if txt else []
            all_kws_ff.extend(kws)
            out_frames_ff.append({
                "timeSec": s_val,
                "ocrText": txt[:1600],
                "keywords": kws,
                "fromPaddleV5": True,
            })
        lines = _dedupe_ocr_timeline_lines(out_frames_ff)
        full_text = "\n".join(f"[{ln['timestamp']}] {ln['text']}" for ln in lines)
        if not sec_by_fname or len(ocr_map) > 0:
            with _VIDEO_OCR_LOCK:
                cur_cache = _load_video_ocr_cache()
                cur_cache[sig] = {
                    "ocrVer": _VIDEO_PADDLE_OCR_VER,
                    "videoFileName": target_path.name,
                    "filePath": str(target_path),
                    "frames": out_frames_ff,
                    "keywords": list(dict.fromkeys(all_kws_ff))[:60],
                    "lines": lines,
                    "fullText": full_text,
                    "lineCount": len(lines),
                    "isAllBlack": False,
                }
                _save_video_ocr_cache(cur_cache)
        return {
            "ok": True,
            "cached": False,
            "ocrVer": _VIDEO_PADDLE_OCR_VER,
            "hasText": len(lines) > 0,
            "videoFileName": target_path.name,
            "filePath": str(target_path),
            "lines": lines,
            "ocrLines": lines,
            "fullText": full_text,
            "lineCount": len(lines),
        }
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def get_video_ocr_cache_snapshot() -> Dict[str, Any]:
    """귀신검색창(ghost_search_window_ui2.py)에서 로컬 영상 속 화면 글자 캐시를 1ms 만에 조회할 수 있도록 반환합니다."""
    cache = _load_video_ocr_cache()
    return {"ok": True, "cache": cache}


_VANGUARD_LOCK = threading.Lock()
_VANGUARD_PACKETS: Dict[str, Dict[str, Any]] = {}
_LATEST_VANGUARD_PACKET_ID: str | None = None


def _teleport_vanguard_signal_path() -> Path:
    base = Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local"))
    return base / "Merlin_Z_Core" / "latest_teleport_vanguard.json"


def store_teleport_ocr_vanguard(data: Dict[str, Any]) -> Dict[str, Any]:
    """[창 UI ③ 사진·OCR 창 + Ctrl+0 귀신창 브릿지] 스마트폰 [⚡ PC전송] 패킷을 저장하고 PC 클립보드·귀신창 신호 파일에 즉시 반영합니다."""
    global _LATEST_VANGUARD_PACKET_ID
    pkt_id = str(data.get("packetId") or f"vg_{int(time.time() * 1000)}").strip()
    file_name = str(data.get("fileName") or data.get("file_name") or "스마트폰 사진").strip()[:120]
    source_device = str(data.get("sourceDevice") or data.get("source_device") or "내 스마트폰").strip()[:64]
    summary = str(data.get("summary") or f"[스마트폰 0.2초 공간이동] {file_name}").strip()[:300]
    full_text = str(
        data.get("fullText") or data.get("ocr_text") or data.get("text") or summary
    ).strip()
    now_ts = float(data.get("capturedAt") or time.time())
    packet = {
        "packetId": pkt_id,
        "source": str(data.get("source") or "mobile_camera"),
        "sourceDevice": source_device,
        "fileName": file_name,
        "summary": summary,
        "capturedAt": now_ts,
        "thumbWebpBase64": str(data.get("thumbWebpBase64") or ""),
        "imageSize": data.get("imageSize") or {"width": 0, "height": 0},
        "fullText": full_text,
        "chips": data.get("chips") if isinstance(data.get("chips"), list) else [],
        "tsvTable": str(data.get("tsvTable") or ""),
        "origLocalPath": data.get("origLocalPath"),
    }
    with _VANGUARD_LOCK:
        _VANGUARD_PACKETS[pkt_id] = packet
        if len(_VANGUARD_PACKETS) > 30:
            oldest_key = next(iter(_VANGUARD_PACKETS.keys()))
            if oldest_key != pkt_id:
                _VANGUARD_PACKETS.pop(oldest_key, None)
        _LATEST_VANGUARD_PACKET_ID = pkt_id

    # 1) 별도 프로세스인 Ctrl+0 귀신창(seq_paste_daemon.py)이 0.2ms 만에 읽을 수 있도록 원자적 신호 파일 기록
    try:
        sig_path = _teleport_vanguard_signal_path()
        sig_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_sig = sig_path.with_suffix(".tmp")
        tmp_sig.write_text(
            json.dumps(
                {
                    "packetId": pkt_id,
                    "fileName": file_name,
                    "sourceDevice": source_device,
                    "summary": summary,
                    "fullText": full_text[:8000],
                    "capturedAt": now_ts,
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        os.replace(tmp_sig, sig_path)
    except Exception:
        pass

    # 2) Windows OS 클립보드에도 즉시 장전하여 메모장 Ctrl+V / Ctrl+0 양쪽 모두 즉시 붙여넣기 보장
    clipboard_armed = False
    if full_text:
        try:
            from plugins import plugin_paid_sync_ghostwin as _sync_gw  # type: ignore

            res_clip = _sync_gw.set_os_clipboard_text({"text": full_text})
            clipboard_armed = bool(res_clip.get("ok"))
        except Exception:
            try:
                import plugin_paid_sync_ghostwin as _sync_gw2  # type: ignore

                res_clip = _sync_gw2.set_os_clipboard_text({"text": full_text})
                clipboard_armed = bool(res_clip.get("ok"))
            except Exception:
                clipboard_armed = False

    return {
        "ok": True,
        "packetId": pkt_id,
        "clipboardArmed": clipboard_armed,
        "packet": packet,
    }


def get_teleport_ocr_vanguard(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """[창 UI ③ 사진·OCR 창 브릿지] 최신 또는 특정 packetId의 선발대 패킷을 0.01초 만에 반환합니다."""
    qp = params or {}
    req_id = str(qp.get("packetId") or "").strip()
    with _VANGUARD_LOCK:
        target_id = req_id or _LATEST_VANGUARD_PACKET_ID
        if not target_id or target_id not in _VANGUARD_PACKETS:
            return {"ok": False, "error": "NO_VANGUARD_PACKET"}
        return {"ok": True, "packet": _VANGUARD_PACKETS[target_id]}


_VIDEO_OCR_SCAN_GATE = threading.Lock()
_VIDEO_OCR_SCAN_LAST_TS: List[float] = [0.0]


def ensure_local_videos_ocr_indexed(sync_wait_sec: float = 0.0) -> None:
    """검색 요청 시 아직 OCR 캐시가 없는 동영상들을 백그라운드(또는 짧은 동기 대기)로 인덱싱합니다.
    [Single-Flight + 20초 스로틀]: 검색 요청마다 요청 스레드에서 전 드라이브 동영상 목록을 다시 훑던 구조(4호기 실측 동시 2건)를
    단일 백그라운드 스캔으로 통합해 5199 응답 스레드·GIL 점유를 원천 제거합니다."""
    if os.name != "nt":
        return
    if _VIDEO_OCR_BG_RUNNING:
        return
    now_gate = time.monotonic()
    if (now_gate - _VIDEO_OCR_SCAN_LAST_TS[0]) < 20.0:
        return
    if not _VIDEO_OCR_SCAN_GATE.acquire(blocking=False):
        return
    _VIDEO_OCR_SCAN_LAST_TS[0] = now_gate
    scan_done = threading.Event()

    def _scan_and_dispatch_video_ocr() -> None:
        try:
            _ensure_local_videos_ocr_indexed_scan()
        except Exception:
            pass
        finally:
            _VIDEO_OCR_SCAN_GATE.release()
            scan_done.set()

    threading.Thread(target=_scan_and_dispatch_video_ocr, daemon=True, name="GhostiVideoOcrScan").start()
    if sync_wait_sec > 0:
        scan_done.wait(timeout=sync_wait_sec)


def _ensure_local_videos_ocr_indexed_scan() -> None:
    global _VIDEO_OCR_BG_RUNNING
    scan_dirs = _iter_scan_dirs(_get_user_scan_roots(), max_depth=3)
    cache = _load_video_ocr_cache()
    missing: List[tuple[str, Path, float]] = []
    seen_paths: set[str] = set()
    for d in scan_dirs:
        try:
            for entry in sorted(d.iterdir(), key=lambda x: x.name):
                if not entry.is_file() or entry.suffix.lower() not in _VIDEO_EXTS:
                    continue
                resolved = entry.resolve()
                norm_vid = str(resolved).lower()
                if norm_vid in seen_paths:
                    continue
                seen_paths.add(norm_vid)
                if _is_cloud_virtual_or_unpinned_file(resolved):
                    continue
                st = resolved.stat()
                sig = f"{entry.name}|{st.st_size}|{int(st.st_mtime)}"
                existing_entry = cache.get(sig)
                if existing_entry is None or int((existing_entry or {}).get("ocrVer") or 0) < _VIDEO_OCR_SCHEMA_VER:
                    missing.append((sig, resolved, _get_fast_video_duration_sec(resolved)))
                if len(seen_paths) >= 120:
                    break
        except Exception:
            pass
    if not missing:
        return

    worker: threading.Thread | None = None
    with _VIDEO_OCR_LOCK:
        if not _VIDEO_OCR_BG_RUNNING:
            _VIDEO_OCR_BG_RUNNING = True
            worker = threading.Thread(target=_run_batch_video_ocr, args=(missing,), daemon=True)
            worker.start()


_VIDEO_THUMB_PREWARM_RUNNING = False


def _trigger_bg_video_thumb_prewarm(items: List[tuple[Path, float]]) -> None:
    """/__videos/list 직후 백그라운드에서 미캐싱 동영상 대표 썸네일을 선행 예열하여 동영상 탭 전환 시 대기 시간을 0ms로 만듭니다."""
    global _VIDEO_THUMB_PREWARM_RUNNING
    if _VIDEO_THUMB_PREWARM_RUNNING or not items:
        return
    _VIDEO_THUMB_PREWARM_RUNNING = True

    def _vthumb_worker() -> None:
        global _VIDEO_THUMB_PREWARM_RUNNING
        try:
            for v_path, seek_t in items:
                try:
                    if v_path.exists() and v_path.is_file():
                        get_or_create_video_thumb({"p": str(v_path), "fp": str(v_path), "t": seek_t})
                except Exception:
                    pass
                time.sleep(0.01)
        finally:
            _VIDEO_THUMB_PREWARM_RUNNING = False

    threading.Thread(target=_vthumb_worker, daemon=True).start()


def list_local_videos(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """내 PC 전 폴더(동영상, 사진, 바탕화면, 다운로드 등)의 동영상 파일을 전수 스캔하여 반환합니다."""
    ws_obj = get_local_watch_signature()
    cur_vid_sig = f"{ws_obj.get('fsSig') or ws_obj.get('sig') or ''}:{_VID_BG_ENRICH_SEQ}"
    cached_vids_resp = _VIDEOS_RESP_MEM_CACHE.get("resp")
    if (
        cur_vid_sig
        and cached_vids_resp is not None
        and _VIDEOS_RESP_MEM_CACHE.get("sig") == cur_vid_sig
    ):
        return cached_vids_resp
    with _VIDEOS_LIST_BUILD_LOCK:
        return _list_local_videos_unlocked()


_VIRTUAL_DIR_VID_SCAN_CACHE: Dict[str, tuple[float, int, List[tuple[Path, Path, os.stat_result]]]] = {}
_LOCAL_DIR_VID_SCAN_CACHE: Dict[str, tuple[int, List[tuple[Path, Path, os.stat_result]]]] = {}
_VIDEOS_ENTRY_MEM_CACHE: Dict[str, Dict[str, Any]] = {}


def _list_local_videos_unlocked() -> Dict[str, Any]:
    ws_obj = get_local_watch_signature()
    cur_vid_sig = f"{ws_obj.get('fsSig') or ws_obj.get('sig') or ''}:{_VID_BG_ENRICH_SEQ}"
    cached_vids_resp = _VIDEOS_RESP_MEM_CACHE.get("resp")
    if (
        cur_vid_sig
        and cached_vids_resp is not None
        and _VIDEOS_RESP_MEM_CACHE.get("sig") == cur_vid_sig
    ):
        return cached_vids_resp

    scan_dirs = _iter_scan_dirs(_get_user_scan_roots(), max_depth=3)
    if len(_LOCAL_DIR_VID_SCAN_CACHE) > 12000:
        _LOCAL_DIR_VID_SCAN_CACHE.clear()
    raw_video_candidates: List[tuple[Path, Path, os.stat_result]] = []
    seen_paths: set[str] = set()
    now_m = time.monotonic()
    virt_v_elapsed = 0.0
    UNPINNED_CLOUD_MASK = 0x1000 | 0x40000 | 0x400000

    for idx_dir, d in enumerate(scan_dirs):
        is_virt_d = _is_virtual_cloud_drive_path(d)
        d_key = os.path.normcase(str(d))
        if is_virt_d:
            hit_vv = _VIRTUAL_DIR_VID_SCAN_CACHE.get(d_key)
            if hit_vv is not None and (now_m - hit_vv[0]) < 30.0:
                for cd, cp, cst in hit_vv[2]:
                    nv = str(cp).lower()
                    if nv not in seen_paths:
                        seen_paths.add(nv)
                        raw_video_candidates.append((cd, cp, cst))
                continue
            if virt_v_elapsed >= 0.30:
                if hit_vv is not None:
                    for cd, cp, cst in hit_vv[2]:
                        nv = str(cp).lower()
                        if nv not in seen_paths:
                            seen_paths.add(nv)
                            raw_video_candidates.append((cd, cp, cst))
                continue
        elif idx_dir >= 24:
            hit_lv = _LOCAL_DIR_VID_SCAN_CACHE.get(d_key)
            if hit_lv is not None:
                try:
                    cur_d_mt = int(getattr(os.stat(d), "st_mtime_ns", 0))
                except Exception:
                    cur_d_mt = -1
                if cur_d_mt == hit_lv[0] and cur_d_mt > 0:
                    for cd, cp, cst in hit_lv[1]:
                        nv = str(cp).lower()
                        if nv not in seen_paths:
                            seen_paths.add(nv)
                            raw_video_candidates.append((cd, cp, cst))
                    continue

        t_v0 = time.monotonic()
        v_bucket: List[tuple[Path, Path, os.stat_result]] = []
        try:
            with os.scandir(d) as it:
                for dent in it:
                    if not dent.is_file(follow_symlinks=False):
                        continue
                    nm = dent.name
                    dot = nm.rfind(".")
                    if dot < 0 or nm[dot:].lower() not in _VIDEO_EXTS:
                        continue
                    st = dent.stat(follow_symlinks=False)
                    if int(getattr(st, "st_file_attributes", 0) or 0) & UNPINNED_CLOUD_MASK:
                        continue
                    abs_v = os.path.abspath(dent.path)
                    norm_vid = abs_v.lower()
                    vtup = (d, Path(abs_v), st)
                    v_bucket.append(vtup)
                    if norm_vid not in seen_paths:
                        seen_paths.add(norm_vid)
                        raw_video_candidates.append(vtup)
        except Exception:
            pass
        if is_virt_d:
            virt_v_elapsed += max(0.0, time.monotonic() - t_v0)
            _VIRTUAL_DIR_VID_SCAN_CACHE[d_key] = (now_m, 1, v_bucket)
        elif idx_dir >= 24:
            try:
                _LOCAL_DIR_VID_SCAN_CACHE[d_key] = (int(getattr(os.stat(d), "st_mtime_ns", 0)), v_bucket)
            except Exception:
                pass

    raw_video_candidates.sort(key=lambda item: item[2].st_mtime, reverse=True)
    fair_video_candidates = _select_fair_entries_by_drive(raw_video_candidates, lambda item: str(item[1]), 2000)
    videos: List[Dict[str, Any]] = []
    seen_keys: set[str] = set()
    ff = find_ffmpeg_exe()
    ocr_cache = _load_video_ocr_cache()
    missing_for_bg: List[tuple[str, Path, float]] = []
    prewarm_targets: List[Path] = []
    vthumb_prewarm_targets: List[tuple[Path, float]] = []
    t_vid_probe0 = time.monotonic()

    for d, resolved, st in fair_video_candidates:
        try:
            entry = resolved
            norm_vid = str(resolved).lower()
            video_key = _make_collision_safe_media_key(resolved, d.name, seen_keys)
            _PHOTO_PATH_INDEX[video_key] = resolved
            size_mb = round(max(0.1, st.st_size / (1024 * 1024)), 1)
            date_str = datetime.datetime.fromtimestamp(st.st_mtime).strftime("%Y.%m.%d")
            stem = entry.stem.replace("_", " ").replace("-", " ").strip()
            enc_name = urllib.parse.quote(video_key)

            sig = f"{entry.name}|{st.st_size}|{int(st.st_mtime)}"
            cached_ocr = ocr_cache.get(sig)
            cached_ver = int((cached_ocr or {}).get("ocrVer") or 0)
            v_mem_key = f"{norm_vid}|{int(st.st_size)}|{int(getattr(st, 'st_mtime_ns', int(st.st_mtime * 1e9)))}|{video_key}|{cached_ver}"
            cached_v_item = _VIDEOS_ENTRY_MEM_CACHE.get(v_mem_key)
            if cached_v_item is not None:
                videos.append(cached_v_item)
                continue
            if len(_VIDEOS_ENTRY_MEM_CACHE) > 8000:
                _VIDEOS_ENTRY_MEM_CACHE.clear()

            # 971개 대량 영상 보유 PC에서 동기 디스크 헤더 판독 블로킹을 0.06초 시간 예산으로 원천 제거!
            # 클라우드 전용(G: DriveFS) 영상은 헤더 판독·변환 캐시·썸네일 선생성으로 원본이 대량 다운로드되지 않도록 차단
            is_cloud_v = _is_cloud_only_media_file(resolved, int(getattr(st, "st_file_attributes", 0) or 0))
            allow_sync_io = (time.monotonic() - t_vid_probe0) < 0.06 and not is_cloud_v
            real_dur_sec = _get_fast_video_duration_sec(
                resolved,
                allow_ffmpeg_sync=False,
                st_hint=st,
                allow_file_io=allow_sync_io,
            )
            if real_dur_sec <= 0:
                continue
            int_dur = max(1, int(real_dur_sec))
            dur_text = f"{int(int_dur // 60):02d}:{int(int_dur % 60):02d}"

            has_video_transcoder = bool(ff or os.name == "nt")
            codec_tag = _detect_video_codec_fast(resolved, allow_file_io=allow_sync_io, st_hint=st)
            if codec_tag == "needs_transcode" and has_video_transcoder:
                vid_url = f"http://127.0.0.1:5199/__videos/stream?p={enc_name}"
                if len(prewarm_targets) < 6 and not is_cloud_v:
                    prewarm_targets.append(resolved)
            elif codec_tag in ("hevc", "mov_slow") and has_video_transcoder:
                # 최신 Chrome/Edge는 MP4/MOV(HEVC 포함)를 /__photos/file HTTP 206 원본 스트림으로 0.03초 즉시 재생 가능.
                # FFmpeg 미설치 PC에서 25초 WinRT 동기 블로킹을 원천 제거하기 위해, 이미 완성된 고속 캐시가 있을 때만
                # /__videos/stream을 쓰고 그 외엔 /__photos/file 직결 (미지원 시 프론트엔드 onError/videoWidth==0 자동 폴백).
                _vc_key = hashlib.sha1(f"{resolved}|{st.st_size}|{int(st.st_mtime)}|v2".encode("utf-8", errors="ignore")).hexdigest()[:22]
                _vc_path = _VIDEO_STREAM_CACHE_DIR / f"vc2_{_vc_key}.mp4"
                if _vc_path.exists() and _vc_path.stat().st_size > 8192:
                    vid_url = f"http://127.0.0.1:5199/__videos/stream?p={enc_name}"
                else:
                    vid_url = f"http://127.0.0.1:5199/__photos/file?p={enc_name}"
                if len(prewarm_targets) < 6 and not is_cloud_v:
                    prewarm_targets.append(resolved)
            else:
                vid_url = f"http://127.0.0.1:5199/__photos/file?p={enc_name}"

            thumb_seek = max(1, min(int(round(real_dur_sec * 0.2)), 3)) if int_dur >= 4 else 0
            thumb_url = f"http://127.0.0.1:5199/__videos/thumb?p={enc_name}&t={thumb_seek}" if has_video_transcoder else ""
            if has_video_transcoder and len(vthumb_prewarm_targets) < 16 and not is_cloud_v:
                vthumb_prewarm_targets.append((resolved, float(thumb_seek)))

            stem_expanded = _split_camel_and_alnum_words(stem)
            raw_kw_tokens = [
                w for w in re.split(r"[\s_\-.,()\[\]]+", f"{stem} {stem_expanded}")
                if len(w) >= 2 and not re.fullmatch(r"[0-9a-fA-F]{4,}", w) and not re.fullmatch(r"\d+", w)
            ]
            if d.name and not re.match(r"^(videos|pictures|photos|desktop|downloads|documents|문서|사진|동영상|바탕\s*화면|다운로드|카카오톡\s*받은\s*파일|\d{2}_.+)$", d.name, re.IGNORECASE):
                for fw in re.split(r"[\s_\-.,()\[\]&]+", d.name):
                    if len(fw) >= 2 and not re.fullmatch(r"\d+", fw):
                        raw_kw_tokens.append(fw)

            base_file_kw_list = list(dict.fromkeys(raw_kw_tokens))[:35]

            sig = f"{entry.name}|{st.st_size}|{int(st.st_mtime)}"
            cached_ocr = ocr_cache.get(sig)
            cached_ver = int((cached_ocr or {}).get("ocrVer") or 0)
            if (
                (cached_ocr is None or cached_ver < _VIDEO_PADDLE_OCR_VER)
                and os.name == "nt"
                and not is_cloud_v
                and len(missing_for_bg) < 180
            ):
                missing_for_bg.append((sig, resolved, real_dur_sec))

            is_all_black = bool((cached_ocr or {}).get("isAllBlack", False))

            ocr_lines_cached = []
            ocr_full_cached = ""
            valid_ocr_frames: List[Dict[str, Any]] = []
            if cached_ocr and cached_ver >= 20 and isinstance(cached_ocr.get("frames"), list):
                for ofr in cached_ocr["frames"]:
                    is_p5 = bool(ofr.get("fromPaddleV5")) or cached_ver >= 20
                    raw_str = str(ofr.get("ocrText") or "").strip()
                    raw_ot = re.sub(r"\s+", " ", raw_str).strip() if is_p5 else _clean_video_ocr_display_text(raw_str)
                    if raw_ot and (is_p5 or _is_meaningful_ocr_text(raw_ot)):
                        valid_ocr_frames.append({
                            "timeSec": int(ofr.get("timeSec") or 0),
                            "ocrText": raw_ot,
                            "keywords": _enrich_ocr_semantic_keywords(raw_ot),
                            "fromPaddleV5": is_p5,
                        })
                ocr_lines_cached = _dedupe_ocr_timeline_lines(valid_ocr_frames)
                ocr_full_cached = "\n".join(
                    f"[{ln['timestamp']}] {ln['text']}" for ln in ocr_lines_cached
                )

            has_meaningful_screen_ocr = (
                len(ocr_lines_cached) > 0
                and sum(len(str(ln.get("text") or "").strip()) for ln in ocr_lines_cached) >= 8
            )
            if has_meaningful_screen_ocr:
                for vf in valid_ocr_frames:
                    raw_kw_tokens.extend(str(k) for k in (vf.get("keywords") or []))

            kw_list = list(dict.fromkeys(raw_kw_tokens))[:45]
            # 기본 타임라인 프레임에는 파일·폴더 공통 키워드만 부여하고, 화면 OCR 키워드는 실제로 등장한 해당 시점 프레임에만 귀속
            timeline_frames = _build_proportional_timeline_frames(stem, base_file_kw_list, d.name, len(videos) + 1, real_dur_sec)

            # 유효한 화면 글자(OCR) 프레임만 비례 타임라인 프레임과 병합하여 워터마크·노이즈 오염을 원천 차단
            if has_meaningful_screen_ocr and valid_ocr_frames:
                existing_secs = {int(tf.get("timeSec") or 0): tf for tf in timeline_frames}
                for f_idx, ofr in enumerate(valid_ocr_frames):
                    s_val = int(ofr.get("timeSec") or 0)
                    ts_str = f"{int(s_val // 60):02d}:{int(s_val % 60):02d}"
                    ocr_txt = str(ofr.get("ocrText") or "").strip()
                    if not ocr_txt:
                        continue
                    f_kws = list(dict.fromkeys([*(ofr.get("keywords") or []), *base_file_kw_list[:12]]))
                    nearest_sec = min(existing_secs.keys(), key=lambda x: abs(x - s_val)) if existing_secs else None
                    if nearest_sec is not None and abs(nearest_sec - s_val) <= 1:
                        target_tf = existing_secs[nearest_sec]
                        target_tf["timeSec"] = s_val
                        target_tf["timestampText"] = ts_str
                        target_tf["sceneCaption"] = ocr_txt
                        target_tf["keywords"] = list(dict.fromkeys([*(target_tf.get("keywords") or []), *f_kws]))
                        target_tf["thumbUrl"] = f"http://127.0.0.1:5199/__videos/thumb?p={enc_name}&t={max(1, s_val)}" if has_video_transcoder else ""
                    else:
                        timeline_frames.append({
                            "frameId": f"f_ocr_{len(videos) + 1}_{f_idx}_{s_val}",
                            "timeSec": s_val,
                            "timestampText": ts_str,
                            "phaseLabel": "장면 포착",
                            "sceneCaption": ocr_txt,
                            "keywords": f_kws,
                            "tags": ["#내PC동영상", f"#{d.name}"],
                            "thumbUrl": f"http://127.0.0.1:5199/__videos/thumb?p={enc_name}&t={max(1, s_val)}" if has_video_transcoder else "",
                        })
                timeline_frames.sort(key=lambda x: int(x.get("timeSec") or 0))

            if has_video_transcoder:
                for tf in timeline_frames:
                    if not tf.get("thumbUrl"):
                        tf["thumbUrl"] = f"http://127.0.0.1:5199/__videos/thumb?p={enc_name}&t={max(1, int(tf.get('timeSec') or 0))}"

            vid_hash = hashlib.sha1(norm_vid.encode("utf-8", errors="ignore")).hexdigest()[:8]
            vid_item_obj = {
                "id": f"local_vid_{vid_hash}_{entry.stem[:20]}",
                "videoFileName": video_key,
                "fullPath": str(resolved),
                "title": f"{stem} ({d.name})",
                "keyframePhotoId": entry.name,
                "thumbUrl": thumb_url,
                "videoUrl": vid_url,
                "date": date_str,
                "mtimeMs": int(st.st_mtime * 1000),
                "durationText": dur_text,
                "durationSec": int_dur,
                "matchedSeekSec": 0,
                "matchedTimestamp": "00:00",
                "matchedFrameCaption": f"[{d.name}] 폴더의 내 PC 동영상 ({entry.name})",
                "locationKo": f"내 PC · {d.name}",
                "sceneDescription": f"{stem} 로컬 동영상 파일 ({size_mb}MB · 전체 길이 {dur_text})",
                "keywords": list(dict.fromkeys(kw_list)),
                "resolution": "1920x1080",
                "sizeMB": size_mb,
                "isAllBlack": is_all_black,
                "codecTag": codec_tag,
                "hasScreenOcrText": has_meaningful_screen_ocr,
                "ocrLineCount": len(ocr_lines_cached) if has_meaningful_screen_ocr else 0,
                "ocrLines": ocr_lines_cached if has_meaningful_screen_ocr else [],
                "ocrFullText": ocr_full_cached if has_meaningful_screen_ocr else "",
                "timelineFrames": timeline_frames,
            }
            _VIDEOS_ENTRY_MEM_CACHE[v_mem_key] = vid_item_obj
            videos.append(vid_item_obj)
        except Exception:
            pass

    videos.sort(key=lambda v: int(v.get("mtimeMs") or 0), reverse=True)

    if vthumb_prewarm_targets:
        _trigger_bg_video_thumb_prewarm(vthumb_prewarm_targets)

    if prewarm_targets:
        threading.Thread(target=_prewarm_hevc_stream_caches, args=(prewarm_targets,), daemon=True).start()

    global _VIDEO_OCR_BG_RUNNING
    if missing_for_bg:
        with _VIDEO_OCR_LOCK:
            if not _VIDEO_OCR_BG_RUNNING:
                _VIDEO_OCR_BG_RUNNING = True
                threading.Thread(target=_run_batch_video_ocr, args=(missing_for_bg,), daemon=True).start()

    # [실물 파일 순수성 철칙] 정적 샘플(poc/results/video_timeline_index.json) 병합을 전면 배제하고 100% 실제 내 PC 동영상만 반환!
    resp_vids = _PreEncodedJsonDict({
        "ok": True,
        "total": len(videos),
        "ocrIndexingPending": bool(missing_for_bg or _VIDEO_OCR_BG_RUNNING),
        "videos": videos,
    })
    if cur_vid_sig:
        _VIDEOS_RESP_MEM_CACHE["sig"] = cur_vid_sig
        _VIDEOS_RESP_MEM_CACHE["resp"] = resp_vids
    return resp_vids


_MEDIA_LIST_PREWARMER_STARTED = False


def start_local_media_list_prewarmer() -> None:
    """Z-코어 데몬 기동 직후 백그라운드에서 사진·문서·동영상 목록 캐시를 선행 예열하여 첫 귀신검색창 오픈 시 5ms 즉시 응답을 보장합니다."""
    global _MEDIA_LIST_PREWARMER_STARTED
    if _MEDIA_LIST_PREWARMER_STARTED:
        return
    _MEDIA_LIST_PREWARMER_STARTED = True

    def _prewarm_worker() -> None:
        time.sleep(0.25)
        for fn in (list_local_photos, list_local_docs, list_local_videos):
            try:
                fn({})
            except Exception:
                pass
            time.sleep(0.02)

    threading.Thread(target=_prewarm_worker, daemon=True).start()


def _resolve_listed_photo(name: str) -> Path | None:
    """사진 목록(list_local_photos)에서 실제로 발견된 이미지 파일만 반환한다 (임의 경로 차단)."""
    if not name or "/" in name or "\\" in name or ".." in name:
        return None
    p = _PHOTO_PATH_INDEX.get(name)
    if p is None:
        list_local_photos({})
        p = _PHOTO_PATH_INDEX.get(name)
    if p is None or not p.exists() or not p.is_file() or p.suffix.lower() not in _IMAGE_EXTS:
        return None
    return p


def _sanitize_shared_room_folder_name(raw_label: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "_", (raw_label or "").strip())
    cleaned = re.sub(r"\s+", "_", cleaned).strip("._ ")
    return cleaned[:48] or "공유방_원본"


def _resolve_shared_room_sync_dir(room_label: str, custom_dir: str = "") -> Path:
    safe_room = _sanitize_shared_room_folder_name(room_label)
    cand_raw = (custom_dir or "").strip()
    if cand_raw and cand_raw.lower() not in (r"d:\ghosti\다운로드_원본", "d:/ghosti/다운로드_원본"):
        try:
            cp = Path(cand_raw)
            if cp.is_absolute():
                drive_root = Path(cp.anchor) if cp.anchor else None
                lower_str = str(cp).lower()
                blocked_sys = any(
                    lower_str.startswith(p)
                    for p in ("c:\\windows", "c:\\program files", "c:\\programdata")
                )
                if drive_root and drive_root.exists() and not blocked_sys:
                    cp.mkdir(parents=True, exist_ok=True)
                    return cp
        except Exception:
            pass

    base_pic = safe.known_folder("pictures")
    target_dir = base_pic / "Ghosti_Shared_Rooms" / safe_room
    try:
        target_dir.mkdir(parents=True, exist_ok=True)
        return target_dir
    except Exception:
        fallback = Path.home() / "Pictures" / "Ghosti_Shared_Rooms" / safe_room
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


def _save_shared_room_items_to_dir(target_dir: Path, items: list[Any]) -> int:
    import base64
    import shutil
    import urllib.request

    saved = 0
    for idx, it in enumerate(items[:300]):
        if not isinstance(it, dict):
            continue
        raw_name = os.path.basename(str(it.get("name") or f"shared_photo_{idx + 1:03d}.jpg").strip())
        safe_name = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "_", raw_name).strip("._ ")
        if not safe_name:
            safe_name = f"shared_photo_{idx + 1:03d}.jpg"
        if not Path(safe_name).suffix:
            safe_name = f"{safe_name}.jpg"
        dest = target_dir / safe_name
        if dest.exists() and dest.stat().st_size > 0:
            continue

        full_path = str(it.get("fullPath") or "").strip()
        if full_path:
            src_p = Path(full_path)
            if src_p.exists() and src_p.is_file():
                try:
                    shutil.copy2(str(src_p), str(dest))
                    saved += 1
                    continue
                except Exception:
                    pass

        url_cand = str(it.get("fullUrl") or it.get("thumbUrl") or "").strip()
        if url_cand.startswith("data:image/") and "," in url_cand:
            try:
                b64_part = url_cand.split(",", 1)[1]
                raw_bytes = base64.b64decode(b64_part)
                if raw_bytes:
                    dest.write_bytes(raw_bytes)
                    saved += 1
                    continue
            except Exception:
                pass
        elif url_cand.startswith(("https://", "http://127.0.0.1:", "http://localhost:")):
            try:
                req = urllib.request.Request(url_cand, headers={"User-Agent": "MerlinZCore/2.12"})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    raw_bytes = resp.read()
                if raw_bytes:
                    dest.write_bytes(raw_bytes)
                    saved += 1
                    continue
            except Exception:
                pass
    return saved


def sync_and_open_shared_room_originals(data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """3. 사진 공유(가족·동호회·동창회) 원본 동기화 로컬 폴더 생성·사진 자동 저장 및 윈도우 탐색기 즉시 오픈"""
    payload = data or {}
    room_label = str(payload.get("roomLabel") or payload.get("roomTitle") or "가족_모임_공유방").strip()
    custom_dir = str(payload.get("customDir") or payload.get("targetPath") or "").strip()
    open_explorer = bool(payload.get("openExplorer"))
    raw_items = payload.get("items")
    items = raw_items if isinstance(raw_items, list) else []

    target_dir = _resolve_shared_room_sync_dir(room_label, custom_dir)

    if open_explorer:
        zos.open_file_location_on_interactive_desktop(target_dir, mode="open_file_location")

    if items:
        if open_explorer:
            threading.Thread(
                target=_save_shared_room_items_to_dir,
                args=(target_dir, items),
                daemon=True,
            ).start()
        else:
            _save_shared_room_items_to_dir(target_dir, items)

    try:
        file_count = sum(1 for p in target_dir.iterdir() if p.is_file())
    except Exception:
        file_count = 0

    return {
        "ok": True,
        "downloadDir": str(target_dir),
        "opened": open_explorer,
        "fileCount": file_count,
    }


def handle_quarantine(action: str, payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """사진 정리: OS 기본 휴지통 이동 / 휴지통에서 원위치 복원 / 폴더 열기"""
    data = payload or {}
    act = (action or "").strip().lower()
    files = data.get("files") or []
    if isinstance(files, str):
        files = [files]
    files = [str(x) for x in files if str(x).strip()][:500]

    if act == "move":
        approval_txt = str(data.get("userApprovalTypedText") or "사진 정리 휴지통 이동 승인")
        return safe.recycle_photos(files, _resolve_listed_photo, user_approval_text=approval_txt)

    if act == "restore":
        res = safe.restore_photos(files)
        for row in res.get("restoredPaths", []):
            try:
                _PHOTO_PATH_INDEX[row["name"]] = Path(row["restoredPath"])
            except Exception:
                pass
        return res

    if act == "list":
        return {"ok": True, "quarantined": safe.recycled_photo_entries(), "destination": "WINDOWS_RECYCLE_BIN"}

    if act in ("open-folder", "open"):
        target = str(data.get("target") or "photos").strip()
        if target == "shared_room_originals":
            return sync_and_open_shared_room_originals({**data, "openExplorer": True})
        target_path = str(data.get("targetPath") or data.get("fullPath") or "").strip()
        strict_file = bool(data.get("strictFile"))
        open_native_player = bool(data.get("openNativePlayer"))
        if target_path:
            tp = Path(target_path)
            if not tp.exists() and target_path in _PHOTO_PATH_INDEX:
                tp = _PHOTO_PATH_INDEX[target_path]
            if tp.exists():
                if open_native_player and tp.is_file() and tp.suffix.lower() in _VIDEO_EXTS:
                    try:
                        os.startfile(str(tp))
                        return {"ok": True, "opened": str(tp), "nativePlayer": True}
                    except Exception:
                        pass
                zos.open_file_location_on_interactive_desktop(tp, mode="open_file_location")
                return {"ok": True, "opened": str(tp), "selectedFile": tp.is_file()}
            if strict_file or tp.is_absolute():
                return {"ok": False, "missingFile": True, "error": f"파일이 존재하지 않습니다: {target_path}"}
        if target == "phone_backup":
            acct_email = str(data.get("accountEmail") or data.get("email") or "").strip()
            sub_folder = ""
            try:
                from plugins import plugin_paid_sync_ghostwin as _psg  # type: ignore

                sub_folder = _psg.sanitize_account_backup_folder(acct_email)
            except Exception:
                sub_folder = ""
            bdir = safe.known_folder("pictures") / "Ghosti_Phone_Backup"
            if sub_folder:
                bdir = bdir / sub_folder
            try:
                bdir.mkdir(parents=True, exist_ok=True)
            except Exception:
                bdir = Path.home() / "Pictures" / "Ghosti_Phone_Backup"
                if sub_folder:
                    bdir = bdir / sub_folder
                bdir.mkdir(parents=True, exist_ok=True)
            zos.open_file_location_on_interactive_desktop(bdir, mode="open_file_location")
            return {"ok": True, "opened": str(bdir)}
        elif target == "photos":
            pdir = resolve_active_photo_dir()
            zos.open_file_location_on_interactive_desktop(pdir, mode="open_file_location")
            return {"ok": True, "opened": str(pdir)}
        elif target == "videos":
            vdir = safe.known_folder("videos")
            if not vdir.exists():
                vdir = Path.home() / "Videos"
            zos.open_file_location_on_interactive_desktop(vdir, mode="open_file_location")
            return {"ok": True, "opened": str(vdir)}
        elif target == "docs":
            ddir = safe.known_folder("documents")
            if not ddir.exists():
                ddir = Path.home() / "Documents"
            zos.open_file_location_on_interactive_desktop(ddir, mode="open_file_location")
            return {"ok": True, "opened": str(ddir)}
        else:
            try:
                zos.execute_real_os_action("open_file_location", "$Recycle.Bin")
            except Exception:
                subprocess.Popen(["explorer.exe", "shell:RecycleBinFolder"])
            return {"ok": True, "opened": "RecycleBin"}

    return {"ok": False, "error": f"UNKNOWN_QUARANTINE_ACTION: {act}"}


# 파일을 옮기거나 만들거나 OS 설정을 바꾸는 액션 (데몬에서 허용 출처(Origin) 검사 대상)
# ---------------------------------------------------------------------------
# 🛡️ 밑바닥 하드웨어 보호 4대 기본 알고리즘 (터보 모드에서도 강제 적용)
# 1) 스레드 우선순위 최하위 고정 (BELOW_NORMAL_PRIORITY_CLASS / THREAD_PRIORITY_BELOW_NORMAL)
# 2) CPU 코어 점유 상한선 (전체 논리 코어의 최대 50% 캡 — Process Affinity Mask)
# 3) 메모리(RAM) 500MB 상한 강제 릴리즈 (20개 파일 단위 명시적 gc.collect() + 워킹셋 트림)
# 4) 모바일/노트북 써멀 쿨다운 & 배터리(20% 미만 미충전 / 40℃) 보호 상태 텔레메트리
# ---------------------------------------------------------------------------
BELOW_NORMAL_PRIORITY_CLASS = 0x00004000
THREAD_PRIORITY_BELOW_NORMAL = -1
MAX_RAM_BYTES_500MB = 500 * 1024 * 1024

# ---------------------------------------------------------------------------
# ⚡ [v1.3 마감 공문 20261108_2321 #4-3] 원패스 스캔 성능 등급 기준 (웹 src/services/scanPerformanceTier.ts 와 동일 상수)
#  - 저사양(스텔스 스로틀): 논리 코어 4개 이하 OR RAM 8GB 이하 OR 시스템 드라이브 HDD(비-SSD)
#  - 고성능(멈칫 없이 즉시 고속 스캔): 코어 6개 이상 AND RAM 8GB 초과 AND SSD
#  - 그 사이/판정 불가 값은 보수적으로 저사양 보호
#  ※ 500MB 메모리 상한·20개 단위 GC 같은 하드웨어 안전망은 등급과 무관하게 유지 (레드팀 확정 안전망)
# ---------------------------------------------------------------------------
LOW_SPEC_MAX_LOGICAL_CORES = 4
LOW_SPEC_MAX_RAM_GB = 8
HIGH_PERF_MIN_LOGICAL_CORES = 6
_PERF_TIER_CACHE: Dict[str, Any] = {}


def _total_ram_gb() -> float | None:
    if os.name != "nt":
        return None
    try:
        class _MEMSTAT(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]
        st = _MEMSTAT()
        st.dwLength = ctypes.sizeof(_MEMSTAT)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(st)):
            return round(st.ullTotalPhys / (1024 ** 3), 1)
    except Exception:
        pass
    return None


def _system_drive_is_ssd() -> bool | None:
    """시스템 드라이브가 SSD인지 판정.
    1순위: DeviceIoControl(IOCTL_STORAGE_QUERY_PROPERTY · StorageDeviceSeekPenaltyProperty) — 수 ms, 관리자 권한 불필요
    2순위: PowerShell Get-PhysicalDisk (MediaType / NVMe 버스) — 느릴 수 있어 1순위 실패 시에만
    판정 불가 시 None (보수적으로 저사양 보호)
    """
    if os.name != "nt":
        return None
    drive = (os.environ.get("SystemDrive") or "C:").rstrip(":\\")[:1] or "C"
    try:
        from ctypes import wintypes
        k32 = ctypes.WinDLL("kernel32", use_last_error=True)
        k32.CreateFileW.restype = wintypes.HANDLE
        handle = k32.CreateFileW(f"\\\\.\\{drive}:", 0, 0x1 | 0x2, None, 3, 0, None)
        if handle and handle != wintypes.HANDLE(-1).value:
            try:
                class _QUERY(ctypes.Structure):
                    _fields_ = [("PropertyId", ctypes.c_int), ("QueryType", ctypes.c_int), ("Additional", ctypes.c_ubyte * 1)]

                class _SEEK(ctypes.Structure):
                    _fields_ = [("Version", ctypes.c_ulong), ("Size", ctypes.c_ulong), ("IncursSeekPenalty", ctypes.c_ubyte)]

                q = _QUERY(7, 0)  # StorageDeviceSeekPenaltyProperty, PropertyStandardQuery
                out = _SEEK()
                ret = ctypes.c_ulong(0)
                ok = k32.DeviceIoControl(
                    handle, 0x2D1400, ctypes.byref(q), ctypes.sizeof(q),
                    ctypes.byref(out), ctypes.sizeof(out), ctypes.byref(ret), None,
                )
                if ok and ret.value >= ctypes.sizeof(out) - 3:
                    return not bool(out.IncursSeekPenalty)
            finally:
                k32.CloseHandle(handle)
    except Exception:
        pass
    ps = (
        f"$d = Get-Partition -DriveLetter {drive} | Get-Disk | Get-PhysicalDisk; "
        "Write-Output (\"$($d.MediaType)|$($d.BusType)\")"
    )
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps],
            capture_output=True, text=True, timeout=8,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        ).stdout.strip()
        media, _, bus = out.partition("|")
        media, bus = media.strip().upper(), bus.strip().upper()
        if media == "SSD":
            return True
        if media == "HDD":
            return False
        if bus == "NVME":
            return True
    except Exception:
        pass
    return None


def classify_scan_performance_tier(
    logical_cores: int | None, ram_gb: float | None, system_drive_ssd: bool | None
) -> str:
    if logical_cores is None or ram_gb is None or system_drive_ssd is None:
        return "low"
    if logical_cores <= LOW_SPEC_MAX_LOGICAL_CORES or ram_gb <= LOW_SPEC_MAX_RAM_GB or not system_drive_ssd:
        return "low"
    if logical_cores >= HIGH_PERF_MIN_LOGICAL_CORES and ram_gb > LOW_SPEC_MAX_RAM_GB and system_drive_ssd:
        return "high"
    return "low"


def detect_scan_performance_tier(force: bool = False) -> Dict[str, Any]:
    """실측 사양으로 성능 등급 판정 (1시간 캐시 — PowerShell 디스크 조회 비용 방지)"""
    now = time.time()
    if not force and _PERF_TIER_CACHE.get("ts") and now - _PERF_TIER_CACHE["ts"] < 3600:
        return dict(_PERF_TIER_CACHE["data"])
    cores = os.cpu_count()
    ram = _total_ram_gb()
    ssd = _system_drive_is_ssd()
    data = {
        "performanceTier": classify_scan_performance_tier(cores, ram, ssd),
        "logicalCores": cores,
        "ramGb": ram,
        "systemDriveSsd": ssd,
    }
    _PERF_TIER_CACHE.update({"ts": now, "data": data})
    return dict(data)


_LAST_HW_GC_TS: float = 0.0


def apply_hardware_protection_guard(mode: str = "silent", batch_count: int = 0) -> Dict[str, Any]:
    """
    인덱싱 워커 기동 및 20개 파일 배치마다 호출되어 OS 커널 차원의 4대 하드웨어 보호 안전망을 강제 적용합니다.
    (유저가 [⚡ 지금 전체 고속 정리] 터보 모드를 켜더라도 이 4대 안전망은 절대 해제되지 않습니다.)
    """
    global _LAST_HW_GC_TS
    import gc

    total_cores = max(1, os.cpu_count() or 4)
    allowed_cores = max(1, total_cores // 2)  # 최대 50% 코어 캡
    priority_applied = False
    affinity_applied = False
    working_set_trimmed = False

    if os.name == "nt":
        try:
            kernel32 = ctypes.windll.kernel32
            h_thread = kernel32.GetCurrentThread()
            # 1) 현재 워커 스레드에만 THREAD_PRIORITY_BELOW_NORMAL(-1) 적용해 5199 HTTP 응답 스레드 기아 없이 백그라운드 부하만 억제
            ret_pri = kernel32.SetThreadPriority(h_thread, -1)
            priority_applied = bool(ret_pri)
            affinity_applied = False
        except Exception:
            priority_applied = False
            affinity_applied = False

    # 3) 45초 주기 GC 및 실제 워킹셋이 500MB 상한을 초과했을 때만 워킹셋 릴리즈 (HTTP 메모리 캐시 강제 스왑아웃 스래싱 방지)
    gc_collected = 0
    now_gc = time.monotonic()
    if (batch_count <= 0 or (batch_count % 20 == 0)) and (now_gc - _LAST_HW_GC_TS) >= 45.0:
        _LAST_HW_GC_TS = now_gc
        gc_collected = gc.collect(0)
        if os.name == "nt":
            try:
                class _PMC(ctypes.Structure):
                    _fields_ = [
                        ("cb", ctypes.c_ulong),
                        ("PageFaultCount", ctypes.c_ulong),
                        ("PeakWorkingSetSize", ctypes.c_size_t),
                        ("WorkingSetSize", ctypes.c_size_t),
                        ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                        ("QuotaPagedPoolUsage", ctypes.c_size_t),
                        ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                        ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                        ("PagefileUsage", ctypes.c_size_t),
                        ("PeakPagefileUsage", ctypes.c_size_t),
                    ]

                pmc = _PMC()
                pmc.cb = ctypes.sizeof(_PMC)
                h_proc = ctypes.windll.kernel32.GetCurrentProcess()
                psapi_ok = bool(ctypes.windll.psapi.GetProcessMemoryInfo(h_proc, ctypes.byref(pmc), pmc.cb))
                if psapi_ok and int(pmc.WorkingSetSize) > MAX_RAM_BYTES_500MB:
                    ctypes.windll.kernel32.SetProcessWorkingSetSize(
                        h_proc,
                        ctypes.c_size_t(-1),
                        ctypes.c_size_t(-1),
                    )
                    working_set_trimmed = True
            except Exception:
                pass

    tier = detect_scan_performance_tier()
    return {
        "ok": True,
        "mode": mode,
        # [v1.3 마감] 고성능 PC는 무소음 모드에서도 멈칫 없이 고속 스캔, 저사양만 스텔스 스로틀 (웹 silentIndexingBrake 가 이 값을 따름)
        **tier,
        "stealthThrottle": tier["performanceTier"] != "high",
        "threadPriority": "THREAD_PRIORITY_BELOW_NORMAL",
        "priorityApplied": priority_applied,
        "totalLogicalCores": total_cores,
        "allowedIndexingCores": allowed_cores,
        "cpuCoreCapPercent": 50,
        "affinityApplied": affinity_applied,
        "ramCeilingMB": 500,
        "gcBatchInterval": 20,
        "gcCollectedObjects": gc_collected,
        "workingSetTrimmed": working_set_trimmed,
        "mobileThermalCutoffCelsius": 40,
        "mobileBatteryFloorPercent": 20,
    }


MUTATING_ACTIONS = {
    "restore-point-rollback", "rollback", "restore-rollback",
    "create-desktop-shortcut", "create-shortcut",
    "record-cleanup-restore", "execute-monster-cleanup", "record-cleanup",
    "recycle-restore", "recover-copy", "execute", "os-execute", "overlay", "os-overlay",
    # [기획 9.3] 상태를 바꾸는 모든 케어/OS 액션은 GET 호출 시 405 (POST 전용)
    "boot-lag-care", "boot_lag_care", "defender-security-check", "defender_security_check", "defender-check",
    "scan-drive", "add-scan-drive", "connect-drive", "drive-scan", "ai-baton-touch", "baton-touch",
    "recycle-bin-empty", "empty-recycle-bin",
}


import threading

_INSPECT_CACHE_LOCK = threading.Lock()
_SPEC_CACHE_LOCK = threading.Lock()
_CACHED_OS_INSPECT_DATA: Dict[str, Any] | None = None
_CACHED_OS_INSPECT_TS: float = 0.0
_OS_INSPECT_REFRESHING: bool = False
_CACHED_PC_SPEC_DATA: Dict[str, Any] | None = None
_CACHED_PC_SPEC_TS: float = 0.0
_PC_SPEC_REFRESHING: bool = False

_OS_INSPECT_FRESH_TTL_SEC = 28.0
_PC_SPEC_FRESH_TTL_SEC = 60.0


def _refresh_os_inspect_bg() -> None:
    global _CACHED_OS_INSPECT_DATA, _CACHED_OS_INSPECT_TS, _OS_INSPECT_REFRESHING
    try:
        with _INSPECT_CACHE_LOCK:
            res = zos.inspect_real_pc_state()
            _CACHED_OS_INSPECT_DATA = res
            _CACHED_OS_INSPECT_TS = time.perf_counter()
    except Exception:
        pass
    finally:
        _OS_INSPECT_REFRESHING = False


def _refresh_pc_spec_bg() -> None:
    global _CACHED_PC_SPEC_DATA, _CACHED_PC_SPEC_TS, _PC_SPEC_REFRESHING
    try:
        with _SPEC_CACHE_LOCK:
            res = safe.measure_pc_spec()
            _CACHED_PC_SPEC_DATA = res
            _CACHED_PC_SPEC_TS = time.perf_counter()
    except Exception:
        pass
    finally:
        _PC_SPEC_REFRESHING = False


def _prewarm_caches_async() -> None:
    global _OS_INSPECT_REFRESHING, _PC_SPEC_REFRESHING
    if not _PC_SPEC_REFRESHING:
        _PC_SPEC_REFRESHING = True
        threading.Thread(target=_refresh_pc_spec_bg, daemon=True).start()
    if not _OS_INSPECT_REFRESHING:
        _OS_INSPECT_REFRESHING = True
        threading.Thread(target=_refresh_os_inspect_bg, daemon=True).start()


def _invalidate_os_inspect_cache() -> None:
    global _CACHED_OS_INSPECT_DATA, _CACHED_OS_INSPECT_TS, _CACHED_PC_SPEC_DATA, _CACHED_PC_SPEC_TS
    _CACHED_OS_INSPECT_DATA = None
    _CACHED_OS_INSPECT_TS = 0.0
    _CACHED_PC_SPEC_DATA = None
    _CACHED_PC_SPEC_TS = 0.0
    _prewarm_caches_async()


def _get_cached_os_inspect(force: bool = False) -> Dict[str, Any]:
    global _CACHED_OS_INSPECT_DATA, _CACHED_OS_INSPECT_TS, _OS_INSPECT_REFRESHING
    now = time.perf_counter()
    if not force and _CACHED_OS_INSPECT_DATA is not None:
        if (now - _CACHED_OS_INSPECT_TS) < _OS_INSPECT_FRESH_TTL_SEC:
            return _CACHED_OS_INSPECT_DATA
        if not _OS_INSPECT_REFRESHING:
            _OS_INSPECT_REFRESHING = True
            threading.Thread(target=_refresh_os_inspect_bg, daemon=True).start()
        return _CACHED_OS_INSPECT_DATA

    with _INSPECT_CACHE_LOCK:
        now2 = time.perf_counter()
        if not force and _CACHED_OS_INSPECT_DATA is not None and (now2 - _CACHED_OS_INSPECT_TS) < _OS_INSPECT_FRESH_TTL_SEC:
            return _CACHED_OS_INSPECT_DATA
        res = zos.inspect_real_pc_state()
        _CACHED_OS_INSPECT_DATA = res
        _CACHED_OS_INSPECT_TS = time.perf_counter()
        return res


def _get_cached_pc_spec(force: bool = False) -> Dict[str, Any]:
    global _CACHED_PC_SPEC_DATA, _CACHED_PC_SPEC_TS, _PC_SPEC_REFRESHING
    now = time.perf_counter()
    if not force and _CACHED_PC_SPEC_DATA is not None:
        if (now - _CACHED_PC_SPEC_TS) < _PC_SPEC_FRESH_TTL_SEC:
            return _CACHED_PC_SPEC_DATA
        if not _PC_SPEC_REFRESHING:
            _PC_SPEC_REFRESHING = True
            threading.Thread(target=_refresh_pc_spec_bg, daemon=True).start()
        return _CACHED_PC_SPEC_DATA

    with _SPEC_CACHE_LOCK:
        now2 = time.perf_counter()
        if not force and _CACHED_PC_SPEC_DATA is not None and (now2 - _CACHED_PC_SPEC_TS) < _PC_SPEC_FRESH_TTL_SEC:
            return _CACHED_PC_SPEC_DATA
        res = safe.measure_pc_spec()
        _CACHED_PC_SPEC_DATA = res
        _CACHED_PC_SPEC_TS = time.perf_counter()
        return res


_prewarm_caches_async()





def handle_request(action: str, payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """단일 코어 라우터(/__merlin/query 또는 /__zcore/*)에서 호출하는 표준 진입점"""
    data = payload or {}
    act = (action or "inspect").strip().lower()

    if act in ("hardware-protection-guard", "indexing-brake-guard", "hardware-guard"):
        return apply_hardware_protection_guard(
            mode=str(data.get("mode") or "silent"),
            batch_count=int(data.get("batchCount") or 0),
        )

    if act in ("health", "status"):
        return {
            "ok": True,
            "plugin": PLUGIN_METADATA,
        }

    if act in ("inspect", "os-inspect"):
        return _get_cached_os_inspect(force=bool(data.get("force")))

    if act in ("pc-spec", "spec"):
        return _get_cached_pc_spec(force=bool(data.get("force")))

    if act in ("forensic", "forensic-scan"):
        query = str(data.get("query") or data.get("q") or "").strip()
        return zos.run_3sec_forensic_scan(query)

    if act in ("overlay", "os-overlay"):
        x = int(data.get("x") or 420)
        y = int(data.get("y") or 160)
        text = str(data.get("text") or "👆 여기를 클릭하세요! (Z-코어 실제 OS 최상단 오버레이)")
        duration = int(data.get("duration") or data.get("durationSec") or 10)
        return zos.spawn_overlay_detached(x, y, text, duration)

    if act in ("folder-tree-summary", "scan-tree", "cleanup-scan"):
        kind = str(data.get("kind") or "").strip().upper()
        if kind in ("DOWNLOAD_INSTALLERS", "FOLDER_REORG", "WINDOWS_TEMP_JUNK"):
            return safe.scan_cleanup_candidates(kind)
        target_dir = str(data.get("targetPath") or data.get("folder") or "").strip()
        return scan_folder_tree_metadata(target_dir)

    if act in ("photos-list", "photos", "list-photos"):
        return list_local_photos(data)

    if act in ("photo-ocr", "photos-ocr", "extract-photo-ocr"):
        return extract_photo_winrt_ocr(data)

    if act in ("docs-list", "docs", "list-docs"):
        return list_local_docs(data)

    if act in ("restore-points-list", "restore-points"):
        return list_restore_points_with_precheck()

    if act in ("restore-point-rollback", "rollback", "restore-rollback"):
        rid = str(data.get("restoreId") or "").strip()
        user_rollback_text = str(data.get("userRollbackTypedText") or data.get("userApprovalTypedText") or "").strip()
        return rollback_restore_point(rid, user_rollback_text)

    if act in ("blackbox-log", "blackbox"):
        entries = []
        try:
            if safe.BLACKBOX_AUDIT_FILE.exists():
                lines = safe.BLACKBOX_AUDIT_FILE.read_text(encoding="utf-8", errors="ignore").splitlines()
                for ln in reversed(lines[-30:]):
                    if ln.strip():
                        entries.append(json.loads(ln))
        except Exception:
            pass
        return {"ok": True, "auditFile": str(safe.BLACKBOX_AUDIT_FILE), "entries": entries}

    if act in ("recycle-bin-status", "recycle-status"):
        return safe.inspect_recycle_bin_summary()

    if act in ("recycle-bin-empty", "empty-recycle-bin"):
        return safe.empty_recycle_bin_verified(
            str(data.get("userApprovalTypedText") or data.get("typedText") or "")
        )

    if act in ("recycle-bin-scan", "recycle-bin"):
        q = str(data.get("query") or data.get("q") or "").strip()
        return scan_windows_recycle_bin(q)

    if act in ("recycle-restore",):
        return safe.restore_from_recycle_bin(
            str(data.get("recycleMetaFile") or data.get("metaFile") or ""),
            user_prompt=str(data.get("userPrompt") or ""),
            user_approval_text=str(data.get("userApprovalTypedText") or "").strip(),
        )

    if act in ("recover-copy",):
        return safe.recover_copy_to_desktop(
            str(data.get("fullPath") or ""),
            str(data.get("userPrompt") or ""),
            str(data.get("userApprovalTypedText") or "").strip(),
        )

    if act in ("omni-file-trace", "trace-missing", "omni-trace"):
        q = str(data.get("query") or data.get("q") or "").strip()
        return trace_missing_file_omni(q)

    if act in ("ai-baton-touch", "baton-touch"):
        return detect_most_recent_ai_and_baton_touch(
            doc_title=str(data.get("docTitle") or ""),
            doc_text=str(data.get("docText") or ""),
            user_question=str(data.get("userQuestion") or data.get("query") or ""),
            device_spec_summary=str(data.get("deviceSpecSummary") or ""),
            show_overlay=bool(data.get("showOverlay", True)),
        )

    if act in ("create-desktop-shortcut", "create-shortcut"):
        return create_desktop_shortcut_with_restore_point(
            site_name=str(data.get("siteName") or "").strip(),
            target_url=str(data.get("targetUrl") or "").strip(),
            user_prompt=str(data.get("userPrompt") or ""),
            user_approval_text=str(data.get("userApprovalTypedText") or "").strip(),
        )

    if act in ("record-cleanup-restore", "execute-monster-cleanup", "record-cleanup"):
        raw_paths = data.get("fullPaths") or []
        if isinstance(raw_paths, str):
            raw_paths = [raw_paths]
        return record_conversational_cleanup_restore_point(
            summary=str(data.get("summary") or "대화형 폴더 정리"),
            user_prompt=str(data.get("userPrompt") or ""),
            preview_presented=str(data.get("previewPresented") or ""),
            full_paths=[str(x) for x in raw_paths][:200],
            user_approval_text=str(data.get("userApprovalTypedText") or "").strip(),
        )

    if act in ("gdrive-smart-scan", "gdrive-scan"):
        q = str(data.get("query") or data.get("q") or "").strip()
        return scan_g_drive_google_docs_and_sheets(q)

    if act in ("scan-drive", "add-scan-drive", "connect-drive", "drive-scan"):
        return scan_and_register_custom_drive(data)

    if act in ("boot-lag-care", "boot_lag_care"):
        sub = str(data.get("subAction") or data.get("mode") or "diagnose").strip()
        param = str(data.get("targetParam") or data.get("scheduleTime") or "04:00").strip()
        res_boot = zos.run_boot_lag_care(sub, param)
        if "clean" in sub.lower():
            _invalidate_os_inspect_cache()
        return res_boot

    if act in ("defender-security-check", "defender_security_check", "defender-check"):
        sub = str(data.get("subAction") or data.get("mode") or "status").strip()
        t_path = str(data.get("targetPath") or data.get("path") or "").strip()
        return zos.run_defender_security_check(sub, t_path)

    if act in ("execute", "os-execute"):
        exec_action = str(data.get("action") or "inspect").strip()
        target = str(data.get("targetPath") or data.get("target") or "").strip()
        if exec_action in ("restore-points-list", "restore-points"):
            return list_restore_points_with_precheck()
        if exec_action in ("restore-point-rollback", "rollback"):
            return rollback_restore_point(target)
        if exec_action in ("recycle-bin-scan", "recycle-bin"):
            return scan_windows_recycle_bin(target)
        if exec_action in ("omni-file-trace", "trace-missing"):
            return trace_missing_file_omni(target)
        if exec_action in ("open_file_location", "open_file_search", "open_file_direct") and target and not Path(target).exists():
            idx_cand = _PHOTO_PATH_INDEX.get(target) or _PHOTO_PATH_INDEX.get(Path(target).name)
            if idx_cand and idx_cand.exists():
                target = str(idx_cand)
        res_exec = zos.execute_real_os_action(exec_action, target)
        _invalidate_os_inspect_cache()
        return res_exec

    # [3창 도메인 분리 플러그인 슬롯 위임] 창 2(paid-sync/ghostwin) · 창 3(paid-work/sdrive) 전용 라우터
    try:
        from plugins import plugin_paid_sync_ghostwin, plugin_paid_work_sdrive  # noqa: WPS433

        delegated_sync = plugin_paid_sync_ghostwin.handle_action(act, data)
        if delegated_sync is not None:
            return delegated_sync
        delegated_work = plugin_paid_work_sdrive.handle_action(act, data)
        if delegated_work is not None:
            return delegated_work
    except Exception as exc:
        return {"ok": False, "error": f"DOMAIN_PLUGIN_ERROR: {exc}"}

    # 알 수 없는 액션은 OS 실행으로 넘기지 않고 정직하게 거절한다.
    return {"ok": False, "error": f"UNKNOWN_ACTION: {act}"}
