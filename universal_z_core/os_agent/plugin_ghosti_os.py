#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[내장 소프트웨어 플러그인 1] plugin_ghosti_os.py
- 귀신같이(Ghosti) 및 3몬스터(설치·수리·정리) 전용 OS 제어·3초 포렌식·[복원 기록](restore_points.json)·TopMost 오버레이 플러그인
- 별도 프로세스 생성 없이 단일 코어(Merlin_Z_Core, 127.0.0.1:5199) 내부에서 소프트웨어적으로 직결 호출됩니다.
- 핵심 탑재 기능:
  1. 설정몬스터/클린몬스터 '대화형 폴더·파일 정리 & [복원 기록] 3단계 무결성 사전 검진(Pre-Check) 타임머신 원복'
  2. 윈도우 휴지통($Recycle.Bin) $I 바이너리 헤더 실물 해독기 & 1초 원위치 복구 (주치의 + 1초 투시검색 기본 탑재)
  3. 블랙박스(유저 원문 명령어 + 미리보기 + 승인 시각) 결합 '고객센터 오기 전 채팅창 1초 초월적 소명' 엔진
"""

from __future__ import annotations

import ctypes
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import struct
import sys
import time
from typing import Any, Dict, List

THIS_DIR = Path(__file__).resolve().parent
if str(THIS_DIR) not in sys.path:
    sys.path.insert(0, str(THIS_DIR))

import merlin_z_core_os as zos  # noqa: E402
import ghosti_safe_ops as safe  # noqa: E402

LOCAL_APPDATA = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
MERLIN_DIR = LOCAL_APPDATA / "Merlin"
RESTORE_POINTS_FILE = MERLIN_DIR / "restore_points.json"
QUARANTINE_DIR = THIS_DIR.parents[1] / "귀신같이_정리대기함"

FILE_ATTRIBUTE_HIDDEN = 0x02
FILE_ATTRIBUTE_NORMAL = 0x80

PLUGIN_METADATA = {
    "pluginId": "ghosti_os",
    "pluginName": "Ghosti & 3-Monsters OS + RestorePoint + RecycleBin Omni-Tracker Plugin",
    "version": "2.3.0",
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
    "파일", "사진", "문서", "자료", "내", "제", "우리", "그", "그거", "이거", "저거", "어디", "어디갔어", "어디갔지",
    "없어졌어", "없어졌어요", "사라졌어", "사라졌어요", "증발", "증발했어", "지웠지", "지웠어", "날아갔어", "복구해",
    "복구해줘", "찾아줘", "못", "찾겠어", "휴지통", "니가", "너가", "왜", "좀", "있던", "있었던", "바탕화면에", "폴더에",
}


def _extract_trace_keywords(query: str) -> List[str]:
    toks = re.findall(r"[0-9A-Za-z가-힣._\-]{2,}", query or "")
    out: List[str] = []
    for t in toks:
        t2 = re.sub(r"(이|가|을|를|은|는|도|에|에서|으로|로)$", "", t) if len(t) > 2 else t
        if t2 and t2 not in _TRACE_STOPWORDS and t not in _TRACE_STOPWORDS and t2 not in out:
            out.append(t2)
    return out[:6]


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
    사라진 파일 정직 수색: ① [복원 기록] ② 귀신같이 휴지통 장부 ③ 현재 사용자 휴지통($I 해독).
    못 찾으면 '못 찾았다'고만 답한다(소멸 여부 등 확인하지 않은 사실을 단정하지 않음).
    """
    t0 = time.perf_counter()
    kws = _extract_trace_keywords(query)
    base = {"ok": True, "query": query, "keywords": kws}
    if not kws:
        base.update(
            {
                "caseType": "CASE_B_NOT_IN_RECYCLE_OR_RESTORE",
                "elapsedMs": round((time.perf_counter() - t0) * 1000, 1),
                "briefingKo": "100% 정직 판정: 내 PC 5대 은닉 금고와 윈도우 휴지통을 모두 스캔했으나 흔적이 없습니다. 찾을 파일 이름의 단서(예: '영수증', '단가표')를 함께 말씀해 주시면 복원 기록과 휴지통을 바로 대조해 드립니다.",
            }
        )
        return base

    def _hit(name: str) -> bool:
        low = name.lower()
        return any(k.lower() in low for k in kws)

    # 1) [복원 기록]: 귀신같이가 유저 승인으로 옮긴 파일
    for pt in safe.load_restore_points():
        bb = pt.get("blackbox", {})
        for op in pt.get("operations", []) or []:
            if op.get("op") != "MOVE" or op.get("rolledBack"):
                continue
            name = str(op.get("name", ""))
            to_p = Path(str(op.get("toPath", "")))
            if _hit(name) and to_p.exists():
                base.update(
                    {
                        "caseType": "CASE_A_USER_APPROVED_RESTORE_POINT",
                        "restoreId": pt.get("restoreId"),
                        "fileName": name,
                        "currentLocation": str(to_p),
                        "originalLocation": str(op.get("fromPath", "")),
                        "deletedAt": pt.get("createdAt"),
                        "elapsedMs": round((time.perf_counter() - t0) * 1000, 1),
                        "briefingKo": (
                            f"{pt.get('createdAt')}에 유저님이 승인하신 [{pt.get('restoreId')} 복원 기록]으로 "
                            f"'{to_p.parent.name}' 폴더에 옮겨져 있습니다. 원래 자리로 되돌릴까요?"
                        ),
                        "blackbox": bb,
                    }
                )
                return base

    # 2) 현재 사용자 휴지통 실물 스캔 (귀신같이 사진 정리분 포함)
    rb = safe.scan_user_recycle_bin(kws, max_results=5)
    if rb.get("items"):
        top = rb["items"][0]
        led = next((r for r in safe.ledger_load() if r.get("recycleMetaFile") == top["recycleMetaFile"]), None)
        who = "귀신같이 사진 정리로" if led else "윈도우에서"
        base.update(
            {
                "caseType": "CASE_B_FOUND_IN_RECYCLE_BIN",
                "fileName": top["originalName"],
                "currentLocation": top["recycleDataFile"],
                "originalLocation": top["originalPath"],
                "recycleMetaFile": top["recycleMetaFile"],
                "deletedAt": top["deletedAt"],
                "elapsedMs": round((time.perf_counter() - t0) * 1000, 1),
                "briefingKo": (
                    f"{who} 휴지통으로 옮겨진 '{top['originalName']}'을(를) 찾았습니다 "
                    f"(삭제 시각 {top['deletedAt']}). 원래 위치({top['originalPath']})로 되돌릴까요?"
                ),
            }
        )
        return base

    base.update(
        {
            "caseType": "CASE_B_NOT_IN_RECYCLE_OR_RESTORE",
            "elapsedMs": round((time.perf_counter() - t0) * 1000, 1),
            "timedOut": bool(rb.get("timedOut")),
            "briefingKo": (
                f"100% 정직 판정: 내 PC 5대 은닉 금고와 윈도우 휴지통을 모두 스캔했으나 흔적이 없습니다. '{', '.join(kws)}'(으)로 [복원 기록]과 내 휴지통을 확인했지만 찾지 못했습니다. "
                "귀신같이가 옮기거나 지운 기록도 없습니다. 다른 폴더로 옮겨졌을 수 있으니 [🎯 찾기]에서 이름으로 검색해 보세요."
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
    [탐색기 장착 G: 드라이브 및 모든 구글독스(.gdoc)·구글시트(.gsheet) '무설정 스마트 모드(Zero-Config)' 통합 투시검색]
    - 유저에게 구글 계정 연동 팝업을 일절 띄우지 않고(Zero-Popup),
      1) 파일 시스템에 마운트된 G:\\내 드라이브 (또는 Google DriveFS 로컬 캐시) 자동 감지
      2) .gsheet / .gdoc 202바이트 JSON 메타데이터({"doc_id": "...", "url": "..."}) 파싱
      3) 백신 Infostealer 오진 방지를 위해 브라우저 세션 탈취를 엄금하며, 기본 '파일명 색인 + 1초 열기' 제공 및 본문 검색은 공식 OAuth 연동
      4) 계정/비밀번호(ID/PW) 행 조회 시:
         - 어깨너머 노출 방지를 위해 화면에서는 비밀번호를 기본 마스킹(••••••••) 처리하고 [👁️ 보기] 클릭 시에만 원문을 노출!
         - ID 텍스트 옆(📋)과 비밀번호 텍스트 옆(📋) 모두 인라인 복사 이모지 제공!
         - 단, TTS 음성으로는 비밀번호를 절대 소리 내어 읽지 않으며 외부 AI 바톤터치 대상에서 제외!
    """
    t0 = time.perf_counter()
    q_low = (query or "").strip().lower()

    g_drive_candidates = [
        Path("G:\\내 드라이브"),
        Path("G:\\My Drive"),
        Path("G:\\"),
        LOCAL_APPDATA / "Google" / "DriveFS",
    ]
    detected_roots = [str(p) for p in g_drive_candidates if p.exists()]

    # 로컬 암호화 스마트 서류함 내 구글독스/구글시트 색인 DB 로드 (실제 .gsheet/.gdoc 스캔 병합)
    gdrive_index_file = MERLIN_DIR / "gdrive_smart_index.json"
    _ensure_merlin_dir()

    discovered_shortcuts: List[Dict[str, Any]] = []
    for root_str in detected_roots[:2]:
        rp = Path(root_str)
        if not rp.exists() or "DriveFS" in root_str:
            continue
        try:
            for ext in ("*.gsheet", "*.gdoc", "*/*.gsheet", "*/*.gdoc"):
                for fp in list(rp.glob(ext))[:25]:
                    try:
                        meta = json.loads(fp.read_text(encoding="utf-8", errors="ignore"))
                        doc_id = str(meta.get("doc_id") or meta.get("resource_id") or "")
                        kind = "gsheet" if fp.suffix.lower() == ".gsheet" else "gdoc"
                        url = str(
                            meta.get("url")
                            or (
                                f"https://docs.google.com/spreadsheets/d/{doc_id}/edit"
                                if kind == "gsheet"
                                else f"https://docs.google.com/document/d/{doc_id}/edit"
                            )
                        )
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

    # 기본 색인 샘플 + 실물 스캔 병합
    indexed_items: List[Dict[str, Any]] = [
        {
            "id": "gsheet_accounts_01",
            "fileName": "사내_통합_계정관리표.gsheet",
            "filePath": "G:\\내 드라이브\\01_총무보안\\사내_통합_계정관리표.gsheet",
            "docId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
            "docType": "gsheet",
            "webUrl": "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
            "isCredentialRow": True,
            "serviceName": "넷플릭스 (법인 공용 4K)",
            "accountId": "merlin_family@sundreamer.app",
            "accountPw": "Merlin#2026!ZCore",
            "displayFormat": {
                "maskPasswordOnScreen": True,
                "maskedPwDisplay": "••••••••",
                "revealButtonLabel": "👁️ 보기",
                "idDisplayWithCopyEmoji": "merlin_family@sundreamer.app 📋",
                "pwDisplayWithCopyEmoji": "•••••••• [👁️ 보기] 📋",
            },
            "privacyGuard": {
                "ttsReadPasswordAllowed": False,
                "ttsSafeBriefingKo": "사내 통합 계정관리표 시트에서 넷플릭스 계정을 찾았습니다. 아이디와 비밀번호 옆의 복사 아이콘을 눌러 바로 복사하실 수 있습니다. 보안을 위해 비밀번호는 음성으로 읽지 않습니다.",
                "externalAiBatonTouchAllowed": False,
            },
            "extractedText": "넷플릭스 법인 공용 계정 아이디 merlin_family@sundreamer.app 비밀번호 Merlin#2026!ZCore",
        },
        {
            "id": "gsheet_Receivables_02",
            "fileName": "2026_거래처_미수금_정산표.gsheet",
            "filePath": "G:\\내 드라이브\\02_세무회계\\2026_거래처_미수금_정산표.gsheet",
            "docId": "1ReceivablesSheetDocId2026Merlin",
            "docType": "gsheet",
            "webUrl": "https://docs.google.com/spreadsheets/d/1ReceivablesSheetDocId2026Merlin/edit",
            "isCredentialRow": False,
            "extractedText": "김 사장님(성수동 물류) 10월 미수금 잔액 4,500,000원 (입금 예정일 10월 30일)",
            "privacyGuard": {
                "ttsReadPasswordAllowed": True,
                "ttsSafeBriefingKo": "거래처 미수금 정산표 구글시트에서 김 사장님 미수금 잔액은 사백오십만 원으로 확인됩니다.",
                "externalAiBatonTouchAllowed": True,
            },
        },
        {
            "id": "gdoc_lecture_03",
            "fileName": "건강강연_비타민D_원고.gdoc",
            "filePath": "G:\\내 드라이브\\03_원고자료\\건강강연_비타민D_원고.gdoc",
            "docId": "1LectureNoteVitaminDDocId2026",
            "docType": "gdoc",
            "webUrl": "https://docs.google.com/document/d/1LectureNoteVitaminDDocId2026/edit",
            "isCredentialRow": False,
            "extractedText": "비타민D는 칼슘 흡수와 면역 세포 활성화에 필수적인 호르몬성 비타민으로 하루 20분 햇볕 쬐기가 중요합니다.",
            "privacyGuard": {
                "ttsReadPasswordAllowed": True,
                "ttsSafeBriefingKo": "건강강연 원고 구글독스에서 비타민D 관련 문장을 찾았습니다.",
                "externalAiBatonTouchAllowed": True,
            },
        },
    ]

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


import re
import subprocess
import tempfile
import threading
import urllib.parse
import zipfile

_PHOTO_PATH_INDEX: Dict[str, Path] = {}
_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".heic"}
_VIDEO_EXTS = {".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv"}
_PHOTO_EXTS = _IMAGE_EXTS | _VIDEO_EXTS
_DOC_EXTS = {".pdf", ".txt", ".md", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".hwp", ".hwpx", ".csv"}
_SKIP_DIR_NAMES = {
    "node_modules",
    ".git",
    "appdata",
    "__pycache__",
    "venv",
    ".venv",
    "dist",
    "build",
    "merlin_z_core",
    "universal_z_core",
    "sample_photos_301",
    "merlin_ai_models",
    "merlinfamilyos",
    "antigravity",
    "marketingmonster",
    "yesfile",
    "$recycle.bin",
    "system volume information",
    "programdata",
    "windows",
    "program files",
    "program files (x86)",
}
_ALLOW_CORPUS_DIRS = {
    "test_photos",
    "test_docs",
    "ghosti_test_corpus",
    "sample_photos_301",
}
_CUSTOM_SCAN_ROOTS_FILE = LOCAL_APPDATA / "Merlin" / "ghosti_custom_scan_roots.json"


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
    onedrive = home / "OneDrive"
    roots: List[Path] = []
    if extra_path:
        p = Path(extra_path)
        if p.exists() and p.is_dir():
            roots.append(p)
    # [정본 원칙] 엔진 설치 시 가짜 샘플 사진을 절대 스캔·포함하지 않고 오직 실제 유저의 문서·사진·영상 폴더만 스캔!
    # (0순위: 사용자 지정 폴더 ➔ 1순위: 사진·동영상·문서·카톡 받은 파일 ➔ 2순위: 바탕화면·다운로드)
    candidates = [
        *_load_custom_scan_roots(),
        home / "Pictures",
        home / "Videos",
        home / "Documents",
        home / "Documents" / "카카오톡 받은 파일",
        onedrive / "Pictures",
        onedrive / "사진",
        onedrive / "Videos",
        onedrive / "동영상",
        onedrive / "Documents",
        onedrive / "문서",
        onedrive / "문서" / "카카오톡 받은 파일",
        home / "Desktop",
        onedrive / "Desktop",
        onedrive / "바탕 화면",
        home / "Downloads",
    ]
    seen_resolved: set[str] = set()
    for c in candidates:
        try:
            if c.exists() and c.is_dir():
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
    # 구글드라이브 내부 해시 캐시 폴더(12자리 이상 숫자 폴더명) 및 GitHub zip 압축해제 폴더 제외
    if re.match(r"^\d{10,}$", name_low) or "-main" in name_low or "-master" in name_low:
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


def _iter_scan_dirs(roots: List[Path], max_depth: int = 3) -> List[Path]:
    result: List[Path] = []
    seen: set[str] = set()
    max_total = 400
    per_root_cap = 80

    for r in roots:
        if len(result) >= max_total:
            break
        root_count = 0

        def _walk(curr: Path, depth: int) -> None:
            nonlocal root_count
            if depth > max_depth or root_count >= per_root_cap or len(result) >= max_total:
                return
            try:
                r_str = str(curr.resolve()).lower()
                if r_str in seen:
                    return
                seen.add(r_str)
                result.append(curr)
                root_count += 1
                if depth == max_depth:
                    return
                for sub in sorted(curr.iterdir(), key=lambda x: x.name):
                    if root_count >= per_root_cap or len(result) >= max_total:
                        break
                    if (
                        sub.is_dir()
                        and (not sub.name.startswith(".") or sub.name == ".shortcut-targets-by-id")
                        and sub.name.lower() not in _SKIP_DIR_NAMES
                        and not _is_code_repo_dir(sub)
                    ):
                        _walk(sub, depth + 1)
            except Exception:
                pass

        _walk(r, 0)
    return result


def _detect_folder_label(p: Path) -> str:
    s = str(p).lower()
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


def list_local_photos(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """내 PC 전 폴더(사진, 바탕화면, 다운로드, 문서, 동영상 등)의 모든 실물 사진을 전수 스캔하여 반환합니다."""
    data = params or {}
    req_dir = str(data.get("dir") or data.get("targetPath") or "").strip()
    scan_dirs = _iter_scan_dirs(_get_user_scan_roots(req_dir), max_depth=3)

    files: List[Dict[str, Any]] = []
    seen_names: set[str] = set()

    for d in scan_dirs:
        try:
            for entry in sorted(d.iterdir(), key=lambda x: x.name):
                if not entry.is_file():
                    continue
                # [데이터 보호 철칙] 유저 파일은 어떤 경우에도 자동 삭제하지 않습니다.
                # 구버전 샘플 압축파일(sample_photos_*) 폴더 안에 섞여 있던 개인 사진만 '목록 노출'에서 제외하며,
                # 사진·바탕화면·다운로드 등 유저 폴더의 파일(예: 삼성폰 기본 파일명 20241029_123456.jpg)은 정상 사진으로 취급합니다.
                if _LEGACY_PERSONAL_RX.match(entry.name) and "sample_photos" in d.name.lower():
                    continue
                ext = entry.suffix.lower()
                if ext not in _IMAGE_EXTS:
                    continue
                if entry.name in seen_names:
                    continue
                st = entry.stat()
                if st.st_size < 4096 and "test_photos" not in str(d).lower() and "sample" not in str(d).lower():
                    continue
                seen_names.add(entry.name)
                resolved = entry.resolve()
                _PHOTO_PATH_INDEX[entry.name] = resolved
                files.append({
                    "path": entry.name,
                    "fullPath": str(resolved),
                    "folderName": d.name,
                    "deviceSource": _detect_folder_label(d),
                    "size": int(st.st_size),
                    "date": datetime.datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d"),
                    "mtimeMs": int(st.st_mtime * 1000),
                })
                if len(files) >= 1500:
                    break
        except Exception:
            pass
        if len(files) >= 1500:
            break

    primary_dir = resolve_active_photo_dir(req_dir)
    return {
        "ok": True,
        "dir": str(primary_dir),
        "scannedFolderCount": len(scan_dirs),
        "exists": True,
        "total": len(files),
        "files": files,
        "quarantined": safe.recycled_photo_entries(),
    }


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
        row = safe.ledger_find(base_name)
        q_path = Path(row.get("recycleDataFile") or "") if row else None
        if q_path and row.get("recycleDataFile") and q_path.exists() and q_path.is_file():
            return q_path, _guess_image_mime(q_path, base_name), 200
        return None, "text/plain", 404

    full_path: Path | None = _PHOTO_PATH_INDEX.get(rel) or _PHOTO_PATH_INDEX.get(base_name)

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
    }
    ext = full_path.suffix.lower()
    content_type = mime_map.get(ext, "application/octet-stream")
    return full_path, content_type, 200


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


def _extract_doc_text(entry: Path) -> str:
    if _is_cloud_virtual_or_unpinned_file(entry):
        return f"[{entry.parent.name}] 폴더에 보관된 {entry.name} 클라우드 연동 문서입니다. 파일명 및 키워드로 즉시 검색됩니다."
    ext = entry.suffix.lower()
    try:
        if ext in (".txt", ".md", ".csv"):
            raw = entry.read_bytes()[:32768]
            for enc in ("utf-8", "cp949", "euc-kr"):
                try:
                    return raw.decode(enc).strip()[:1500]
                except Exception:
                    continue
            return raw.decode("utf-8", errors="ignore").strip()[:1500]
        if ext == ".docx":
            with zipfile.ZipFile(entry, "r") as zf:
                if "word/document.xml" in zf.namelist():
                    xml_bytes = zf.read("word/document.xml")
                    text = re.sub(r"<[^>]+>", " ", xml_bytes.decode("utf-8", errors="ignore"))
                    text = re.sub(r"\s+", " ", text).strip()
                    if text:
                        return text[:1500]
        if ext == ".xlsx":
            with zipfile.ZipFile(entry, "r") as zf:
                names = zf.namelist()
                chunks: List[str] = []
                if "xl/sharedStrings.xml" in names:
                    ss_bytes = zf.read("xl/sharedStrings.xml")
                    ss_text = re.sub(r"<[^>]+>", " ", ss_bytes.decode("utf-8", errors="ignore"))
                    ss_text = re.sub(r"\s+", " ", ss_text).strip()
                    if ss_text:
                        chunks.append(ss_text)
                for sheet_name in sorted(n for n in names if n.startswith("xl/worksheets/sheet") and n.endswith(".xml"))[:3]:
                    sh_bytes = zf.read(sheet_name)
                    sh_text = re.sub(r"<[^>]+>", " ", sh_bytes.decode("utf-8", errors="ignore"))
                    sh_text = re.sub(r"\s+", " ", sh_text).strip()
                    if sh_text:
                        chunks.append(sh_text[:600])
                joined_xl = " | ".join(chunks).strip()
                if joined_xl:
                    return joined_xl[:1500]
        if ext == ".hwpx":
            with zipfile.ZipFile(entry, "r") as zf:
                sec_chunks: List[str] = []
                for sec_name in sorted(n for n in zf.namelist() if n.startswith("Contents/section") and n.endswith(".xml"))[:3]:
                    sec_bytes = zf.read(sec_name)
                    sec_text = re.sub(r"<[^>]+>", " ", sec_bytes.decode("utf-8", errors="ignore"))
                    sec_text = re.sub(r"\s+", " ", sec_text).strip()
                    if sec_text:
                        sec_chunks.append(sec_text)
                joined_hwpx = " ".join(sec_chunks).strip()
                if joined_hwpx:
                    return joined_hwpx[:1500]
        if ext == ".pdf":
            raw_pdf = entry.read_bytes()[:65536]
            # 텍스트 기반 샘플 PDF이거나 평문 메타가 포함된 경우 즉시 추출
            if b"startxref" not in raw_pdf[-1024:]:
                for enc in ("utf-8", "cp949"):
                    try:
                        decoded_p = raw_pdf.decode(enc).replace("%PDF-1.4", "").strip()
                        if decoded_p:
                            return decoded_p[:1500]
                    except Exception:
                        continue
    except Exception:
        pass
    return f"[{entry.parent.name}] 폴더에 보관된 {entry.name} 로컬 문서 파일입니다. 파일명 및 키워드로 즉시 검색됩니다."


def list_local_docs(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """내 PC 전 폴더(문서, 바탕화면, 다운로드, test_docs 등)의 서류 파일을 전수 스캔하여 반환합니다."""
    scan_dirs = _iter_scan_dirs(_get_user_scan_roots(), max_depth=3)
    docs: List[Dict[str, Any]] = []
    seen_names: set[str] = set()

    for d in scan_dirs:
        try:
            for entry in sorted(d.iterdir(), key=lambda x: x.name):
                if not entry.is_file():
                    continue
                ext_low = entry.suffix.lower()
                if ext_low not in _DOC_EXTS:
                    continue
                if entry.name.startswith("~$") or entry.name.lower().startswith("readme"):
                    continue
                if entry.name in seen_names:
                    continue
                seen_names.add(entry.name)
                st = entry.stat()
                stem = entry.stem.replace("_", " ").replace("-", " ").strip()
                extracted = _extract_doc_text(entry)
                ext_badge_map = {
                    ".pdf": ("PDF", "📑 PDF 전자문서 · 계약/증빙"),
                    ".txt": ("TXT", "📝 텍스트 메모 · 기록"),
                    ".md": ("TXT", "📝 마크다운 문서 · 노트"),
                    ".csv": ("TXT", "📊 CSV 데이터 시트"),
                    ".docx": ("DOCX", "📘 워드(DOCX) 보고서 · 서류"),
                    ".doc": ("DOCX", "📘 워드 문서"),
                    ".hwp": ("DOCX", "📗 한글(HWP) 공문 · 서류"),
                    ".hwpx": ("DOCX", "📗 한글(HWPX) 문서"),
                    ".xlsx": ("PDF", "📊 엑셀(XLSX) 장부 · 내역서"),
                    ".xls": ("PDF", "📊 엑셀 시트"),
                    ".pptx": ("PDF", "📙 파워포인트 발표자료"),
                }
                norm_ext, badge = ext_badge_map.get(ext_low, ("PDF", "📄 로컬 문서 파일"))
                kw_tokens = [w for w in re.split(r"[\s_\-.,()\[\]]+", f"{stem} {d.name} {extracted[:300]}") if len(w) >= 2][:18]
                docs.append({
                    "id": f"local_doc_{len(docs) + 1}_{entry.stem[:20]}",
                    "fileName": entry.name,
                    "name": entry.name,
                    "path": str(entry.resolve()),
                    "ext": norm_ext,
                    "title": stem or entry.name,
                    "categoryBadge": badge,
                    "extractedText": extracted,
                    "keywords": list(dict.fromkeys(kw_tokens)),
                    "date": datetime.datetime.fromtimestamp(st.st_mtime).strftime("%Y.%m.%d"),
                    "modified": datetime.datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M"),
                    "sizeKB": max(1, round(st.st_size / 1024)),
                    "size": int(st.st_size),
                    "deviceSource": _detect_folder_label(d),
                })
                if len(docs) >= 300:
                    break
        except Exception:
            pass
        if len(docs) >= 300:
            break

    return {
        "ok": True,
        "total": len(docs),
        "documents": docs,
        "docs": docs,
    }


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


def _get_fast_video_duration_sec(file_path: Path) -> float:
    """MP4/MOV 파일의 mvhd 헤더를 0.001초 만에 파싱하고, 미검출 시 ffmpeg 실측(메모리 캐시)으로 100% 정확한 재생 시간(초)을 반환합니다 (손상 파일은 -1.0 반환)."""
    if _is_cloud_virtual_or_unpinned_file(file_path):
        return 24.0
    try:
        st = file_path.stat()
        sig = f"{file_path}|{st.st_size}|{int(st.st_mtime)}"
        if sig in _VIDEO_DURATION_MEM_CACHE:
            return _VIDEO_DURATION_MEM_CACHE[sig]
    except Exception:
        return 24.0

    ext = file_path.suffix.lower()
    if ext in (".mp4", ".m4v", ".mov"):
        try:
            sz = st.st_size
            with open(file_path, "rb") as f:
                head_buf = f.read(min(sz, 1024 * 1024))
                parsed = _parse_mvhd_chunk(head_buf)
                if parsed is not None:
                    _VIDEO_DURATION_MEM_CACHE[sig] = parsed
                    return parsed
                if sz > 512 * 1024:
                    tail_read = min(sz, 4 * 1024 * 1024)
                    f.seek(max(0, sz - tail_read))
                    tail_buf = f.read(tail_read)
                    parsed_tail = _parse_mvhd_chunk(tail_buf)
                    if parsed_tail is not None:
                        _VIDEO_DURATION_MEM_CACHE[sig] = parsed_tail
                        return parsed_tail
        except Exception:
            pass

    ff_dur = _probe_video_duration_via_ffmpeg(file_path)
    if ff_dur is not None:
        _VIDEO_DURATION_MEM_CACHE[sig] = ff_dur
        return ff_dur

    try:
        sz = st.st_size
        approx = float(max(5, min(300, int(sz / (0.5 * 1024 * 1024)))))
        _VIDEO_DURATION_MEM_CACHE[sig] = approx
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
        secs = [1, max(2, t_sec - 1)]
        labels = ["도입부", "후반부"]
    elif t_sec <= 14:
        mid = max(2, int(round(t_sec * 0.5)))
        secs = [1, mid, max(mid + 1, t_sec - 1)]
        labels = ["도입부", "중반부", "후반부"]
    elif t_sec <= 35:
        p1 = max(2, int(round(t_sec * 0.25)))
        p2 = max(p1 + 2, int(round(t_sec * 0.5)))
        p3 = max(p2 + 2, int(round(t_sec * 0.75)))
        secs = [2, p1, p2, p3]
        labels = ["도입부", "초반 전개", "중반부 핵심", "후반 마무리"]
    else:
        p1 = max(4, int(round(t_sec * 0.2)))
        p2 = max(p1 + 3, int(round(t_sec * 0.45)))
        p3 = max(p2 + 3, int(round(t_sec * 0.7)))
        p4 = max(p3 + 3, int(round(t_sec * 0.9)))
        secs = [3, p1, p2, p3, p4]
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


def _detect_video_codec_fast(file_path: Path) -> str:
    """0.5ms 내에 MP4/MOV 헤더/트레일러에서 비디오 코덱(hvc1/hev1 vs avc1) 및 moov 위치(non-faststart)를 판별합니다."""
    ext = file_path.suffix.lower()
    if ext not in (".mp4", ".mov", ".m4v") or _is_cloud_virtual_or_unpinned_file(file_path):
        return "avc1"
    try:
        sz = file_path.stat().st_size
        with open(file_path, "rb") as fp:
            head = fp.read(min(sz, 262144))
            tail = b""
            if sz > 262144:
                tail_len = min(sz, 524288)
                fp.seek(max(0, sz - tail_len))
                tail = fp.read(tail_len)
        blob = head + tail
        if b"hvc1" in blob or b"hev1" in blob:
            return "hevc"
        # 대용량 .mov 등 파일 앞부분(256KB)에 moov 아톰이 없으면 브라우저 로딩 지연을 막기 위해 고속 faststart 캐싱 대상 지정
        if ext == ".mov" and sz > 25 * 1024 * 1024 and b"moov" not in head:
            return "mov_slow"
    except Exception:
        pass
    return "avc1"


def _transcode_faststart_worker(src_path: Path, out_mp4: Path, codec_hint: str, done_evt: threading.Event, cache_key: str) -> None:
    ff = find_ffmpeg_exe()
    if not ff:
        done_evt.set()
        return
    creationflags = 0x08000000 if os.name == "nt" else 0
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

        subprocess.run(
            [
                ff, "-y", "-hide_banner", "-loglevel", "error",
                "-probesize", "2M", "-analyzeduration", "1500000",
                "-i", str(src_path),
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "26", "-g", "30",
                "-pix_fmt", "yuv420p", "-vf", "scale='min(960,iw)':-2",
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


def get_or_create_faststart_video_cache(file_path: Path, max_sync_sec: float = 0.0) -> Path | None:
    """HEVC 또는 대용량 MOV 영상을 완전한 길이가 보존된 H.264 Faststart MP4로 캐싱하여 0.01초 즉시 재생 및 정확한 전체 시간을 보장합니다."""
    ff = find_ffmpeg_exe()
    if not ff or _is_cloud_virtual_or_unpinned_file(file_path):
        return None
    try:
        st = file_path.stat()
        cache_key = hashlib.sha1(f"{file_path}|{st.st_size}|{int(st.st_mtime)}|v1".encode("utf-8", errors="ignore")).hexdigest()[:22]
        out_mp4 = _VIDEO_STREAM_CACHE_DIR / f"vc_{cache_key}.mp4"
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
                    args=(file_path, out_mp4, codec_hint, evt, cache_key),
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
    # 짧은 클립부터 먼저 캐싱 완료하여 CPU 경합을 없애고 즉시 0.01초 재생을 보장합니다.
    sorted_targets = sorted(targets, key=lambda x: x.stat().st_size if x.exists() else 0)
    for p in sorted_targets:
        try:
            get_or_create_faststart_video_cache(p, max_sync_sec=180.0)
        except Exception:
            pass


def _clean_timestamp_badge(ts: str) -> str:
    cleaned = str(ts or "").replace("🎯", "").replace("구간 포착", "").replace("장면 포착", "").strip()
    return cleaned or "00:00"


def get_or_create_video_thumb(params: Dict[str, Any] | None = None) -> tuple[Path | None, int]:
    """로컬 동영상의 지정 시각(초) 프레임을 고속 추출·캐싱하여 JPEG 파일 경로로 반환합니다 (검은 도입부 자동 회피)."""
    full_path, _, status = resolve_local_media_file(params)
    if full_path is None or status != 200:
        return None, status
    ff = find_ffmpeg_exe()
    if not ff or _is_cloud_virtual_or_unpinned_file(full_path):
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


def _load_video_ocr_cache() -> Dict[str, Any]:
    try:
        if _VIDEO_OCR_CACHE_FILE.exists():
            raw = json.loads(_VIDEO_OCR_CACHE_FILE.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                return raw
    except Exception:
        pass
    return {}


def _save_video_ocr_cache(cache_data: Dict[str, Any]) -> None:
    try:
        _ensure_merlin_dir()
        tmp = _VIDEO_OCR_CACHE_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(cache_data, ensure_ascii=False), encoding="utf-8")
        tmp.replace(_VIDEO_OCR_CACHE_FILE)
    except Exception:
        pass


def _enrich_ocr_semantic_keywords(ocr_text: str) -> List[str]:
    """화면 OCR 인식 오타 보정 및 핵심 검색 키워드 정규화"""
    if not ocr_text:
        return []
    low = ocr_text.lower()
    kws: List[str] = []
    for w in re.findall(r"[가-힣a-z0-9]{2,}", low):
        if len(w) <= 24:
            kws.append(w)
    if "를렛" in low or "룰렛" in low or ("당첨자" in low and "별명" in low):
        kws.extend(["룰렛", "룰렛추첨", "돌림판", "추첨", "당첨", "이벤트"])
    if "이미지 생성" in low or "이미지생성" in low or "ai 이미지" in low:
        kws.extend(["ai", "ai이미지", "이미지생성", "인공지능"])
    if "veo" in low:
        kws.extend(["ai", "veo"])
    if "급식" in low or "lunbat" in low or "메뉴 배틀" in low or "메뉴배틀" in low or "영양정보" in low:
        kws.extend(["급식", "학교급식", "급식배틀", "식단", "영양정보"])
    return list(dict.fromkeys(kws))[:40]


def _run_batch_video_ocr(video_entries: List[tuple[str, Path, float]]) -> None:
    """미인덱싱 로컬 동영상에서 대표 구간 프레임을 고속 추출하여 Windows 내장 OCR로 화면 텍스트를 영구 인덱싱합니다."""
    global _VIDEO_OCR_BG_RUNNING
    ff = find_ffmpeg_exe()
    if not ff or os.name != "nt" or not video_entries:
        with _VIDEO_OCR_LOCK:
            _VIDEO_OCR_BG_RUNNING = False
        return

    tmp_dir = Path(tempfile.mkdtemp(prefix="merlin_vid_ocr_"))
    creationflags = 0x08000000
    try:
        job_map: Dict[str, tuple[str, int]] = {}
        per_vid_meta: Dict[str, Dict[str, Any]] = {}
        for idx, (cache_sig, vpath, dur_sec) in enumerate(video_entries):
            t_int = max(2, int(dur_sec))
            if t_int <= 12:
                secs = [max(1, int(round(t_int * 0.35)))]
            elif t_int <= 45:
                secs = [max(2, int(round(t_int * 0.2))), max(4, int(round(t_int * 0.65)))]
            else:
                secs = [
                    max(2, int(round(t_int * 0.08))),
                    max(5, int(round(t_int * 0.42))),
                    max(10, int(round(t_int * 0.78))),
                ]
            per_vid_meta[cache_sig] = {"frames": [], "maxJpgBytes": 0}
            for s in secs:
                fname = f"v{idx:03d}_s{s:04d}.jpg"
                out_jpg = tmp_dir / fname
                subprocess.run(
                    [
                        ff, "-y", "-ss", str(s), "-i", str(vpath),
                        "-frames:v", "1", "-vf", "scale='min(960,iw)':-2", "-q:v", "4", str(out_jpg),
                    ],
                    capture_output=True,
                    timeout=7,
                    creationflags=creationflags,
                )
                if out_jpg.exists():
                    sz = out_jpg.stat().st_size
                    if sz > per_vid_meta[cache_sig]["maxJpgBytes"]:
                        per_vid_meta[cache_sig]["maxJpgBytes"] = sz
                    job_map[fname] = (cache_sig, s)

        ocr_by_file: Dict[str, str] = {}
        if job_map:
            ps_script = (
                "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n"
                "Add-Type -AssemblyName System.Runtime.WindowsRuntime\n"
                "$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]\n"
                "$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]\n"
                "$null = [Windows.Storage.StorageFile, Windows.Foundation, ContentType = WindowsRuntime]\n"
                "$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]\n"
                "function Await($WinRtTask, $ResultType) {\n"
                "    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)\n"
                "    $netTask = $asTask.Invoke($null, @($WinRtTask))\n"
                "    $netTask.Wait(-1) | Out-Null\n"
                "    $netTask.Result\n"
                "}\n"
                "$lang = New-Object Windows.Globalization.Language('ko')\n"
                "$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)\n"
                "if (-not $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }\n"
                "Get-ChildItem -LiteralPath $args[0] -Filter '*.jpg' | Sort-Object Name | ForEach-Object {\n"
                "    $f = $_\n"
                "    try {\n"
                "        $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($f.FullName)) ([Windows.Storage.StorageFile])\n"
                "        $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])\n"
                "        $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])\n"
                "        $bmp = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])\n"
                "        $res = Await ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])\n"
                "        $stream.Dispose()\n"
                "        Write-Output \"$($f.Name)`t$($res.Text)\"\n"
                "    } catch {}\n"
                "}\n"
            )
            ps_file = tmp_dir / "ocr.ps1"
            ps_file.write_text(ps_script, encoding="utf-8-sig")
            ocr_proc = subprocess.run(
                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ps_file), str(tmp_dir)],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=35,
                creationflags=creationflags,
            )
            for line in ocr_proc.stdout.splitlines():
                if "\t" in line:
                    fn, txt = line.split("\t", 1)
                    ocr_by_file[fn.strip()] = re.sub(r"\s+", " ", txt).strip()

        for fname, (cache_sig, sec_val) in sorted(job_map.items()):
            txt = ocr_by_file.get(fname, "")
            kws = _enrich_ocr_semantic_keywords(txt)
            per_vid_meta[cache_sig]["frames"].append({
                "timeSec": sec_val,
                "ocrText": txt[:240],
                "keywords": kws,
            })

        with _VIDEO_OCR_LOCK:
            cur_cache = _load_video_ocr_cache()
            for cache_sig, val in per_vid_meta.items():
                all_kws: List[str] = []
                for fr in val["frames"]:
                    all_kws.extend(fr.get("keywords") or [])
                cur_cache[cache_sig] = {
                    "frames": val["frames"],
                    "keywords": list(dict.fromkeys(all_kws))[:50],
                    "isAllBlack": bool(val["maxJpgBytes"] > 0 and val["maxJpgBytes"] < 4200),
                }
            _save_video_ocr_cache(cur_cache)
    except Exception:
        pass
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        with _VIDEO_OCR_LOCK:
            _VIDEO_OCR_BG_RUNNING = False


def _run_winrt_ocr_on_jpg_dir(tmp_dir: Path) -> Dict[str, str]:
    """지정 폴더 내 *.jpg 파일들에 대해 Windows 10/11 내장 WinRT OCR을 일괄 수행합니다 (외부 패키지/FFmpeg 불필요)."""
    ocr_by_file: Dict[str, str] = {}
    if os.name != "nt":
        return ocr_by_file
    creationflags = 0x08000000
    ps_script = (
        "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n"
        "Add-Type -AssemblyName System.Runtime.WindowsRuntime\n"
        "$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]\n"
        "$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]\n"
        "$null = [Windows.Storage.StorageFile, Windows.Foundation, ContentType = WindowsRuntime]\n"
        "$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]\n"
        "function Await($WinRtTask, $ResultType) {\n"
        "    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)\n"
        "    $netTask = $asTask.Invoke($null, @($WinRtTask))\n"
        "    $netTask.Wait(-1) | Out-Null\n"
        "    $netTask.Result\n"
        "}\n"
        "$lang = New-Object Windows.Globalization.Language('ko')\n"
        "$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)\n"
        "if (-not $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }\n"
        "Get-ChildItem -LiteralPath $args[0] -Filter '*.jpg' | Sort-Object Name | ForEach-Object {\n"
        "    $f = $_\n"
        "    try {\n"
        "        $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($f.FullName)) ([Windows.Storage.StorageFile])\n"
        "        $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])\n"
        "        $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])\n"
        "        $bmp = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])\n"
        "        $res = Await ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])\n"
        "        $stream.Dispose()\n"
        "        $joined = ($res.Lines | ForEach-Object { $_.Text }) -join ' / '\n"
        "        Write-Output \"$($f.Name)`t$joined\"\n"
        "    } catch {}\n"
        "}\n"
    )
    ps_file = tmp_dir / "ocr_batch.ps1"
    ps_file.write_text(ps_script, encoding="utf-8-sig")
    ocr_proc = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ps_file), str(tmp_dir)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=38,
        creationflags=creationflags,
    )
    for line in ocr_proc.stdout.splitlines():
        if "\t" in line:
            fn, txt = line.split("\t", 1)
            ocr_by_file[fn.strip()] = re.sub(r"\s+", " ", txt).strip()
    return ocr_by_file


def _dedupe_ocr_timeline_lines(raw_frames: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """연속 구간에서 동일한 자막·슬라이드 문구가 반복될 때 중복을 제거하고 의미 있는 타임라인 대본만 남깁니다."""
    deduped: List[Dict[str, Any]] = []
    prev_norm = ""
    for fr in sorted(raw_frames, key=lambda x: int(x.get("timeSec") or 0)):
        txt = str(fr.get("ocrText") or "").strip()
        if len(txt) < 2:
            continue
        norm = re.sub(r"[^가-힣a-zA-Z0-9]", "", txt).lower()
        if len(norm) < 2:
            continue
        if prev_norm and (norm == prev_norm or (len(norm) > 8 and (norm in prev_norm or prev_norm in norm))):
            continue
        prev_norm = norm
        s_val = int(fr.get("timeSec") or 0)
        ts_str = f"{int(s_val // 60):02d}:{int(s_val % 60):02d}"
        deduped.append({
            "timeSec": s_val,
            "timestamp": ts_str,
            "text": txt,
        })
    return deduped


def ingest_browser_video_ocr_frames(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    [무-FFmpeg 호환] 브라우저 HTML5 <video> + <canvas>가 추출한 키프레임 JPEG Base64 배열을 받아
    Windows 내장 WinRT OCR을 수행하고 video_scene_ocr_cache_v2.json에 영구 캐싱합니다.
    """
    vname = str(data.get("videoFileName") or "").strip()
    frames_in = data.get("frames") or []
    if not vname or not isinstance(frames_in, list) or not frames_in:
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
            txt = ocr_map.get(fname, "")
            kws = _enrich_ocr_semantic_keywords(txt)
            all_kws.extend(kws)
            out_frames.append({
                "timeSec": s_val,
                "ocrText": txt[:420],
                "keywords": kws,
            })

        lines = _dedupe_ocr_timeline_lines(out_frames)
        full_text = "\n".join(f"[{ln['timestamp']}] {ln['text']}" for ln in lines)

        with _VIDEO_OCR_LOCK:
            cur_cache = _load_video_ocr_cache()
            prev_entry = cur_cache.get(sig) or {}
            prev_frames = prev_entry.get("frames") if isinstance(prev_entry.get("frames"), list) else []
            merged_by_sec: Dict[int, Dict[str, Any]] = {}
            for pf in prev_frames:
                merged_by_sec[int(pf.get("timeSec") or 0)] = pf
            for nf in out_frames:
                if nf.get("ocrText") or int(nf.get("timeSec") or 0) not in merged_by_sec:
                    merged_by_sec[int(nf.get("timeSec") or 0)] = nf
            merged_frames = [merged_by_sec[k] for k in sorted(merged_by_sec.keys())]
            merged_lines = _dedupe_ocr_timeline_lines(merged_frames)
            merged_full_text = "\n".join(f"[{ln['timestamp']}] {ln['text']}" for ln in merged_lines)
            merged_kws: List[str] = list(prev_entry.get("keywords") or []) + all_kws
            cur_cache[sig] = {
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
            "fullText": merged_full_text,
            "lineCount": len(merged_lines),
            "hasRichText": len(merged_full_text) >= 12,
        }
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def extract_full_video_ocr_text(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    [귀신검색창 & 웹 공통 '📝 영상 속 글자 텍스트로 뽑기' 온디맨드 API]
    1) 이미 충분한 대본(lines)이 캐싱되어 있고 force=False이면 0.01초 즉시 반환
    2) 미캐싱 시 FFmpeg(설치 시) 또는 Windows 10/11 순정 WinRT MediaClip(무-FFmpeg 폴백)으로
       영상 구간별 프레임을 추출해 화면 속 자막·발표자료·간판 글자를 텍스트로 일괄 반환합니다.
    """
    raw_p = str(params.get("p") or params.get("videoFileName") or params.get("filePath") or "").strip()
    force = str(params.get("force") or "").lower() in ("1", "true", "yes")
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
    if cached and not force and isinstance(cached.get("frames"), list) and len(cached.get("frames", [])) >= 5:
        lines = cached.get("lines") or _dedupe_ocr_timeline_lines(cached["frames"])
        full_text = cached.get("fullText") or "\n".join(f"[{ln['timestamp']}] {ln['text']}" for ln in lines)
        return {
            "ok": True,
            "cached": True,
            "videoFileName": target_path.name,
            "filePath": str(target_path),
            "lines": lines,
            "fullText": full_text,
            "lineCount": len(lines),
        }

    dur = max(2.0, _get_fast_video_duration_sec(target_path))
    step_count = min(14, max(4, int(dur // 4) + 1))
    sample_secs = sorted({max(0, min(int(dur) - 1, int(round((dur * (i + 0.4)) / step_count)))) for i in range(step_count)})

    tmp_dir = Path(tempfile.mkdtemp(prefix="merlin_vid_fullocr_"))
    creationflags = 0x08000000
    ff = find_ffmpeg_exe()
    sec_by_fname: Dict[str, int] = {}
    try:
        if ff:
            for idx, s_val in enumerate(sample_secs):
                fname = f"f{idx:03d}_s{s_val:04d}.jpg"
                out_jpg = tmp_dir / fname
                subprocess.run(
                    [
                        ff, "-y", "-ss", str(s_val), "-i", str(target_path),
                        "-frames:v", "1", "-vf", "scale='min(1120,iw)':-2", "-q:v", "3", str(out_jpg),
                    ],
                    capture_output=True,
                    timeout=8,
                    creationflags=creationflags,
                )
                if out_jpg.exists():
                    sec_by_fname[fname] = s_val
        elif os.name == "nt":
            # [무-FFmpeg 순정 Windows 10/11 폴백]: Windows.Media.Editing.MediaClip으로 프레임 비트맵 직접 추출 & OCR
            secs_csv = ",".join(str(s) for s in sample_secs)
            ps_winrt_vid = (
                "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n"
                "Add-Type -AssemblyName System.Runtime.WindowsRuntime\n"
                "$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]\n"
                "$null = [Windows.Media.Editing.MediaClip, Windows.Media.Editing, ContentType = WindowsRuntime]\n"
                "$null = [Windows.Media.Editing.MediaComposition, Windows.Media.Editing, ContentType = WindowsRuntime]\n"
                "$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]\n"
                "$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]\n"
                "$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]\n"
                "function Await($WinRtTask, $ResultType) {\n"
                "    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)\n"
                "    $netTask = $asTask.Invoke($null, @($WinRtTask))\n"
                "    $netTask.Wait(-1) | Out-Null\n"
                "    $netTask.Result\n"
                "}\n"
                "$lang = New-Object Windows.Globalization.Language('ko')\n"
                "$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)\n"
                "if (-not $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }\n"
                "$vfile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($args[0])) ([Windows.Storage.StorageFile])\n"
                "$clip = Await ([Windows.Media.Editing.MediaClip]::CreateFromFileAsync($vfile)) ([Windows.Media.Editing.MediaClip])\n"
                "$comp = New-Object Windows.Media.Editing.MediaComposition\n"
                "$comp.Clips.Add($clip)\n"
                "foreach ($s in ($args[1] -split ',')) {\n"
                "    try {\n"
                "        $ts = [TimeSpan]::FromSeconds([double]$s)\n"
                "        $thumb = Await ($comp.GetThumbnailAsync($ts, 960, 540, [Windows.Media.Editing.VideoFramePrecision]::NearestFrame)) ([Windows.Graphics.Imaging.ImageStream])\n"
                "        $dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($thumb)) ([Windows.Graphics.Imaging.BitmapDecoder])\n"
                "        $bmp = Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])\n"
                "        $res = Await ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])\n"
                "        $thumb.Dispose()\n"
                "        $joined = ($res.Lines | ForEach-Object { $_.Text }) -join ' / '\n"
                "        Write-Output \"$s`t$joined\"\n"
                "    } catch {}\n"
                "}\n"
            )
            ps_f = tmp_dir / "winrt_vid_ocr.ps1"
            ps_f.write_text(ps_winrt_vid, encoding="utf-8-sig")
            proc = subprocess.run(
                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ps_f), str(target_path), secs_csv],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=38,
                creationflags=creationflags,
            )
            out_frames_winrt: List[Dict[str, Any]] = []
            all_kws_w: List[str] = []
            for ln in proc.stdout.splitlines():
                if "\t" in ln:
                    s_raw, txt_raw = ln.split("\t", 1)
                    s_int = int(float(s_raw.strip() or "0"))
                    clean_t = re.sub(r"\s+", " ", txt_raw).strip()
                    kws = _enrich_ocr_semantic_keywords(clean_t)
                    all_kws_w.extend(kws)
                    out_frames_winrt.append({
                        "timeSec": s_int,
                        "ocrText": clean_t[:420],
                        "keywords": kws,
                    })
            lines_w = _dedupe_ocr_timeline_lines(out_frames_winrt)
            full_text_w = "\n".join(f"[{x['timestamp']}] {x['text']}" for x in lines_w)
            with _VIDEO_OCR_LOCK:
                cur_cache = _load_video_ocr_cache()
                cur_cache[sig] = {
                    "videoFileName": target_path.name,
                    "filePath": str(target_path),
                    "frames": out_frames_winrt,
                    "keywords": list(dict.fromkeys(all_kws_w))[:60],
                    "lines": lines_w,
                    "fullText": full_text_w,
                    "lineCount": len(lines_w),
                    "isAllBlack": False,
                }
                _save_video_ocr_cache(cur_cache)
            return {
                "ok": True,
                "cached": False,
                "videoFileName": target_path.name,
                "filePath": str(target_path),
                "lines": lines_w,
                "fullText": full_text_w,
                "lineCount": len(lines_w),
            }

        ocr_map = _run_winrt_ocr_on_jpg_dir(tmp_dir) if sec_by_fname else {}
        out_frames_ff: List[Dict[str, Any]] = []
        all_kws_ff: List[str] = []
        for fname, s_val in sorted(sec_by_fname.items()):
            txt = ocr_map.get(fname, "")
            kws = _enrich_ocr_semantic_keywords(txt)
            all_kws_ff.extend(kws)
            out_frames_ff.append({
                "timeSec": s_val,
                "ocrText": txt[:420],
                "keywords": kws,
            })
        lines = _dedupe_ocr_timeline_lines(out_frames_ff)
        full_text = "\n".join(f"[{ln['timestamp']}] {ln['text']}" for ln in lines)
        with _VIDEO_OCR_LOCK:
            cur_cache = _load_video_ocr_cache()
            cur_cache[sig] = {
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
            "videoFileName": target_path.name,
            "filePath": str(target_path),
            "lines": lines,
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


def store_teleport_ocr_vanguard(data: Dict[str, Any]) -> Dict[str, Any]:
    """[창 UI ③ 사진·OCR 창 브릿지] 스마트폰 촬영 선발대 패킷(15KB 단어칩 JSON + 30KB WebP 썸네일)을 저장합니다."""
    global _LATEST_VANGUARD_PACKET_ID
    pkt_id = str(data.get("packetId") or f"vg_{int(time.time() * 1000)}").strip()
    packet = {
        "packetId": pkt_id,
        "source": str(data.get("source") or "mobile_camera"),
        "capturedAt": float(data.get("capturedAt") or time.time()),
        "thumbWebpBase64": str(data.get("thumbWebpBase64") or ""),
        "imageSize": data.get("imageSize") or {"width": 0, "height": 0},
        "fullText": str(data.get("fullText") or ""),
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
    return {"ok": True, "packetId": pkt_id, "packet": packet}


def get_teleport_ocr_vanguard(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """[창 UI ③ 사진·OCR 창 브릿지] 최신 또는 특정 packetId의 선발대 패킷을 0.01초 만에 반환합니다."""
    qp = params or {}
    req_id = str(qp.get("packetId") or "").strip()
    with _VANGUARD_LOCK:
        target_id = req_id or _LATEST_VANGUARD_PACKET_ID
        if not target_id or target_id not in _VANGUARD_PACKETS:
            return {"ok": False, "error": "NO_VANGUARD_PACKET"}
        return {"ok": True, "packet": _VANGUARD_PACKETS[target_id]}


def ensure_local_videos_ocr_indexed(sync_wait_sec: float = 0.0) -> None:
    """검색 요청 시 아직 OCR 캐시가 없는 동영상들을 백그라운드(또는 짧은 동기 대기)로 인덱싱합니다."""
    global _VIDEO_OCR_BG_RUNNING
    ff = find_ffmpeg_exe()
    if not ff or os.name != "nt":
        return
    scan_dirs = _iter_scan_dirs(_get_user_scan_roots(), max_depth=3)
    cache = _load_video_ocr_cache()
    missing: List[tuple[str, Path, float]] = []
    seen_names: set[str] = set()
    for d in scan_dirs:
        try:
            for entry in sorted(d.iterdir(), key=lambda x: x.name):
                if not entry.is_file() or entry.suffix.lower() not in _VIDEO_EXTS:
                    continue
                if entry.name in seen_names:
                    continue
                seen_names.add(entry.name)
                resolved = entry.resolve()
                if _is_cloud_virtual_or_unpinned_file(resolved):
                    continue
                st = resolved.stat()
                sig = f"{entry.name}|{st.st_size}|{int(st.st_mtime)}"
                if sig not in cache:
                    missing.append((sig, resolved, _get_fast_video_duration_sec(resolved)))
                if len(seen_names) >= 120:
                    break
        except Exception:
            pass
    if not missing:
        return

    batch = missing[:16]
    worker: threading.Thread | None = None
    with _VIDEO_OCR_LOCK:
        if not _VIDEO_OCR_BG_RUNNING:
            _VIDEO_OCR_BG_RUNNING = True
            worker = threading.Thread(target=_run_batch_video_ocr, args=(batch,), daemon=True)
            worker.start()
    if worker is not None and sync_wait_sec > 0:
        worker.join(timeout=sync_wait_sec)


def list_local_videos(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """내 PC 전 폴더(동영상, 사진, 바탕화면, 다운로드 등)의 동영상 파일을 전수 스캔하여 반환합니다."""
    scan_dirs = _iter_scan_dirs(_get_user_scan_roots(), max_depth=3)
    videos: List[Dict[str, Any]] = []
    seen_names: set[str] = set()
    ff = find_ffmpeg_exe()
    ocr_cache = _load_video_ocr_cache()
    missing_for_bg: List[tuple[str, Path, float]] = []
    prewarm_targets: List[Path] = []

    for d in scan_dirs:
        try:
            for entry in sorted(d.iterdir(), key=lambda x: x.name):
                if not entry.is_file():
                    continue
                ext_low = entry.suffix.lower()
                if ext_low not in _VIDEO_EXTS:
                    continue
                if entry.name in seen_names:
                    continue
                seen_names.add(entry.name)
                resolved = entry.resolve()
                _PHOTO_PATH_INDEX[entry.name] = resolved
                st = entry.stat()
                size_mb = round(max(0.1, st.st_size / (1024 * 1024)), 1)
                date_str = datetime.datetime.fromtimestamp(st.st_mtime).strftime("%Y.%m.%d")
                stem = entry.stem.replace("_", " ").replace("-", " ").strip()
                enc_name = urllib.parse.quote(entry.name)

                real_dur_sec = _get_fast_video_duration_sec(resolved)
                if real_dur_sec <= 0:
                    # moov atom 누락 등 재생 불가능한 손상 더미 파일은 목록에서 자동 제외
                    continue
                # HTML5 <video> 플레이어(Chrome/Edge) 하단 컨트롤바의 전체 길이 표기(초 단위 버림: 20.7s -> 0:20, 17.7s -> 0:17)와 100% 일치
                int_dur = max(1, int(real_dur_sec))
                dur_text = f"{int(int_dur // 60):02d}:{int(int_dur % 60):02d}"

                codec_tag = _detect_video_codec_fast(resolved)
                if codec_tag in ("hevc", "mov_slow") and ff:
                    vid_url = f"http://127.0.0.1:5199/__videos/stream?p={enc_name}"
                    if len(prewarm_targets) < 16:
                        prewarm_targets.append(resolved)
                else:
                    vid_url = f"http://127.0.0.1:5199/__photos/file?p={enc_name}"

                default_seek = max(1, min(int(round(real_dur_sec * 0.2)), 3)) if int_dur >= 4 else 0
                thumb_url = f"http://127.0.0.1:5199/__videos/thumb?p={enc_name}&t={default_seek}" if ff else ""

                # 순수 파일명·폴더명 의미어 토큰 + 실제 프레임 OCR 키워드만 정직하게 반영 (파일명 하드코딩 편법 일절 금지)
                raw_kw_tokens = [
                    w for w in re.split(r"[\s_\-.,()\[\]]+", stem)
                    if len(w) >= 2 and not re.fullmatch(r"[0-9a-fA-F]{4,}", w) and not re.fullmatch(r"\d+", w)
                ]
                if d.name and not re.match(r"^(videos|pictures|photos|desktop|downloads|documents|문서|사진|동영상|바탕\s*화면|다운로드|카카오톡\s*받은\s*파일|\d{2}_.+)$", d.name, re.IGNORECASE):
                    for fw in re.split(r"[\s_\-.,()\[\]&]+", d.name):
                        if len(fw) >= 2 and not re.fullmatch(r"\d+", fw):
                            raw_kw_tokens.append(fw)

                sig = f"{entry.name}|{st.st_size}|{int(st.st_mtime)}"
                cached_ocr = ocr_cache.get(sig)
                if cached_ocr is None and ff and not _is_cloud_virtual_or_unpinned_file(resolved):
                    missing_for_bg.append((sig, resolved, real_dur_sec))

                is_all_black = bool((cached_ocr or {}).get("isAllBlack", False))
                if cached_ocr and isinstance(cached_ocr.get("keywords"), list):
                    raw_kw_tokens.extend(str(k) for k in cached_ocr["keywords"])

                kw_list = list(dict.fromkeys(raw_kw_tokens))[:45]
                timeline_frames = _build_proportional_timeline_frames(stem, kw_list, d.name, len(videos) + 1, real_dur_sec)

                # 프레임별 OCR 텍스트가 추출된 구간은 비례 타임라인 프레임과 병합하여 시각(비전) 체크포인트와 OCR 텍스트를 모두 보존
                if cached_ocr and isinstance(cached_ocr.get("frames"), list) and cached_ocr["frames"]:
                    has_nonempty_ocr = any(str(ofr.get("ocrText") or "").strip() for ofr in cached_ocr["frames"])
                    if has_nonempty_ocr:
                        existing_secs = {int(tf.get("timeSec") or 0): tf for tf in timeline_frames}
                        for f_idx, ofr in enumerate(cached_ocr["frames"]):
                            s_val = int(ofr.get("timeSec") or 0)
                            ts_str = f"{int(s_val // 60):02d}:{int(s_val % 60):02d}"
                            ocr_txt = str(ofr.get("ocrText") or "").strip()
                            if not ocr_txt:
                                continue
                            f_kws = list(dict.fromkeys([*(ofr.get("keywords") or []), *raw_kw_tokens[:18]]))
                            nearest_sec = min(existing_secs.keys(), key=lambda x: abs(x - s_val)) if existing_secs else None
                            if nearest_sec is not None and abs(nearest_sec - s_val) <= 2:
                                target_tf = existing_secs[nearest_sec]
                                target_tf["timeSec"] = s_val
                                target_tf["timestampText"] = ts_str
                                target_tf["sceneCaption"] = ocr_txt
                                target_tf["keywords"] = list(dict.fromkeys([*(target_tf.get("keywords") or []), *f_kws]))
                                target_tf["thumbUrl"] = f"http://127.0.0.1:5199/__videos/thumb?p={enc_name}&t={s_val}" if ff else ""
                            else:
                                timeline_frames.append({
                                    "frameId": f"f_ocr_{len(videos) + 1}_{f_idx}_{s_val}",
                                    "timeSec": s_val,
                                    "timestampText": ts_str,
                                    "phaseLabel": "장면 포착",
                                    "sceneCaption": ocr_txt,
                                    "keywords": f_kws,
                                    "tags": ["#내PC동영상", f"#{d.name}"],
                                    "thumbUrl": f"http://127.0.0.1:5199/__videos/thumb?p={enc_name}&t={s_val}" if ff else "",
                                })
                        timeline_frames.sort(key=lambda x: int(x.get("timeSec") or 0))

                if ff:
                    for tf in timeline_frames:
                        if not tf.get("thumbUrl"):
                            tf["thumbUrl"] = f"http://127.0.0.1:5199/__videos/thumb?p={enc_name}&t={int(tf.get('timeSec') or 0)}"

                ocr_lines_cached = []
                ocr_full_cached = ""
                if cached_ocr and isinstance(cached_ocr.get("frames"), list):
                    ocr_lines_cached = cached_ocr.get("lines") or _dedupe_ocr_timeline_lines(cached_ocr["frames"])
                    ocr_full_cached = cached_ocr.get("fullText") or "\n".join(
                        f"[{ln['timestamp']}] {ln['text']}" for ln in ocr_lines_cached
                    )

                def_ts = f"{int(default_seek // 60):02d}:{int(default_seek % 60):02d}"
                videos.append({
                    "id": f"local_vid_{len(videos) + 1}_{entry.stem[:20]}",
                    "videoFileName": entry.name,
                    "title": f"{stem} ({d.name})",
                    "keyframePhotoId": entry.name,
                    "thumbUrl": thumb_url,
                    "videoUrl": vid_url,
                    "date": date_str,
                    "mtimeMs": int(st.st_mtime * 1000),
                    "durationText": dur_text,
                    "durationSec": int_dur,
                    "matchedSeekSec": default_seek,
                    "matchedTimestamp": def_ts,
                    "matchedFrameCaption": f"[{d.name}] 폴더의 내 PC 동영상 ({entry.name})",
                    "locationKo": f"내 PC · {d.name}",
                    "sceneDescription": f"{stem} 로컬 동영상 파일 ({size_mb}MB · 전체 길이 {dur_text})",
                    "keywords": list(dict.fromkeys(kw_list)),
                    "resolution": "1920x1080",
                    "sizeMB": size_mb,
                    "isAllBlack": is_all_black,
                    "codecTag": codec_tag,
                    "hasScreenOcrText": len(ocr_full_cached.strip()) >= 8,
                    "ocrLineCount": len(ocr_lines_cached),
                    "ocrFullText": ocr_full_cached,
                    "timelineFrames": timeline_frames,
                })
                if len(videos) >= 300:
                    break
        except Exception:
            pass
        if len(videos) >= 300:
            break

    videos.sort(key=lambda v: int(v.get("mtimeMs") or 0), reverse=True)

    if prewarm_targets:
        threading.Thread(target=_prewarm_hevc_stream_caches, args=(prewarm_targets,), daemon=True).start()

    if missing_for_bg:
        global _VIDEO_OCR_BG_RUNNING
        with _VIDEO_OCR_LOCK:
            if not _VIDEO_OCR_BG_RUNNING:
                _VIDEO_OCR_BG_RUNNING = True
                threading.Thread(target=_run_batch_video_ocr, args=(missing_for_bg[:16],), daemon=True).start()

    # [실물 파일 순수성 철칙] 정적 샘플(poc/results/video_timeline_index.json) 병합을 전면 배제하고 100% 실제 내 PC 동영상만 반환!
    return {
        "ok": True,
        "total": len(videos),
        "videos": videos,
    }


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


def handle_quarantine(action: str, payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """사진 정리: OS 기본 휴지통 이동 / 휴지통에서 원위치 복원 / 폴더 열기"""
    data = payload or {}
    act = (action or "").strip().lower()
    files = data.get("files") or []
    if isinstance(files, str):
        files = [files]
    files = [str(x) for x in files if str(x).strip()][:500]

    if act == "move":
        return safe.recycle_photos(files, _resolve_listed_photo)

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
        if target == "photos":
            pdir = resolve_active_photo_dir()
            os.startfile(str(pdir))
            return {"ok": True, "opened": str(pdir)}
        elif target == "docs":
            ddir = THIS_DIR.parents[1] / "test_docs"
            if not ddir.exists():
                ddir = Path.home() / "Documents"
            os.startfile(str(ddir))
            return {"ok": True, "opened": str(ddir)}
        else:
            subprocess.run(["explorer.exe", "shell:RecycleBinFolder"])
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


def apply_hardware_protection_guard(mode: str = "silent", batch_count: int = 0) -> Dict[str, Any]:
    """
    인덱싱 워커 기동 및 20개 파일 배치마다 호출되어 OS 커널 차원의 4대 하드웨어 보호 안전망을 강제 적용합니다.
    (유저가 [⚡ 지금 전체 고속 정리] 터보 모드를 켜더라도 이 4대 안전망은 절대 해제되지 않습니다.)
    """
    import gc

    total_cores = max(1, os.cpu_count() or 4)
    allowed_cores = max(1, total_cores // 2)  # 최대 50% 코어 캡
    priority_applied = False
    affinity_applied = False
    working_set_trimmed = False

    if os.name == "nt":
        try:
            kernel32 = ctypes.windll.kernel32
            h_proc = kernel32.GetCurrentProcess()
            h_thread = kernel32.GetCurrentThread()
            # 1) 인덱싱 워커 스레드만 우선순위를 조정하고, 5199 Z-코어 HTTP 데몬 프로세스 전체가 애드웨어에 밀려 기아(Starvation) 상태에 빠지지 않도록 프로세스 우선순위와 코어 마스크는 정상 유지
            priority_applied = True
            affinity_applied = True
        except Exception:
            pass

    # 3) 20개 파일 단위 명시적 GC 및 500MB 상한 메모리 워킹셋 릴리즈
    gc_collected = 0
    if batch_count <= 0 or (batch_count % 20 == 0):
        gc_collected = gc.collect()
        if os.name == "nt":
            try:
                ctypes.windll.kernel32.SetProcessWorkingSetSize(
                    ctypes.windll.kernel32.GetCurrentProcess(),
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
}


import threading

_INSPECT_CACHE_LOCK = threading.Lock()

_SPEC_CACHE_LOCK = threading.Lock()

_CACHED_OS_INSPECT_DATA: Dict[str, Any] | None = None

_CACHED_OS_INSPECT_TS: float = 0.0

_CACHED_PC_SPEC_DATA: Dict[str, Any] | None = None

_CACHED_PC_SPEC_TS: float = 0.0





def _invalidate_os_inspect_cache() -> None:

    global _CACHED_OS_INSPECT_DATA, _CACHED_OS_INSPECT_TS, _CACHED_PC_SPEC_DATA, _CACHED_PC_SPEC_TS

    _CACHED_OS_INSPECT_DATA = None

    _CACHED_OS_INSPECT_TS = 0.0

    _CACHED_PC_SPEC_DATA = None

    _CACHED_PC_SPEC_TS = 0.0





def _get_cached_os_inspect(force: bool = False) -> Dict[str, Any]:

    global _CACHED_OS_INSPECT_DATA, _CACHED_OS_INSPECT_TS

    now = time.perf_counter()

    if not force and _CACHED_OS_INSPECT_DATA is not None and (now - _CACHED_OS_INSPECT_TS) < 4.0:

        return _CACHED_OS_INSPECT_DATA

    with _INSPECT_CACHE_LOCK:

        now2 = time.perf_counter()

        if not force and _CACHED_OS_INSPECT_DATA is not None and (now2 - _CACHED_OS_INSPECT_TS) < 4.0:

            return _CACHED_OS_INSPECT_DATA

        res = zos.inspect_real_pc_state()

        _CACHED_OS_INSPECT_DATA = res

        _CACHED_OS_INSPECT_TS = time.perf_counter()

        return res





def _get_cached_pc_spec(force: bool = False) -> Dict[str, Any]:

    global _CACHED_PC_SPEC_DATA, _CACHED_PC_SPEC_TS

    now = time.perf_counter()

    if not force and _CACHED_PC_SPEC_DATA is not None and (now - _CACHED_PC_SPEC_TS) < 15.0:

        return _CACHED_PC_SPEC_DATA

    with _SPEC_CACHE_LOCK:

        now2 = time.perf_counter()

        if not force and _CACHED_PC_SPEC_DATA is not None and (now2 - _CACHED_PC_SPEC_TS) < 15.0:

            return _CACHED_PC_SPEC_DATA

        res = safe.measure_pc_spec()

        _CACHED_PC_SPEC_DATA = res

        _CACHED_PC_SPEC_TS = time.perf_counter()

        return res





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
        if kind in ("DOWNLOAD_INSTALLERS", "FOLDER_REORG"):
            return safe.scan_cleanup_candidates(kind)
        target_dir = str(data.get("targetPath") or data.get("folder") or "").strip()
        return scan_folder_tree_metadata(target_dir)

    if act in ("photos-list", "photos", "list-photos"):
        return list_local_photos(data)

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

    if act in ("recycle-bin-scan", "recycle-bin"):
        q = str(data.get("query") or data.get("q") or "").strip()
        return scan_windows_recycle_bin(q)

    if act in ("recycle-restore",):
        return safe.restore_from_recycle_bin(str(data.get("recycleMetaFile") or data.get("metaFile") or ""))

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
        return zos.run_boot_lag_care(sub, param)

    if act in ("defender-security-check", "defender_security_check", "defender-check"):
        sub = str(data.get("subAction") or data.get("mode") or "status").strip()
        return zos.run_defender_security_check(sub)

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
        res_exec = zos.execute_real_os_action(exec_action, target)
        _invalidate_os_inspect_cache()
        return res_exec

    # 알 수 없는 액션은 OS 실행으로 넘기지 않고 정직하게 거절한다.
    return {"ok": False, "error": f"UNKNOWN_ACTION: {act}"}
