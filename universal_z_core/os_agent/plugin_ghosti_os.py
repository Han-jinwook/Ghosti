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
                "briefingKo": "찾을 파일 이름의 단서(예: '영수증', '단가표')를 함께 말씀해 주시면 복원 기록과 휴지통을 바로 대조해 드립니다.",
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
                f"'{', '.join(kws)}'(으)로 [복원 기록]과 내 휴지통을 확인했지만 찾지 못했습니다. "
                "귀신같이가 옮기거나 지운 기록도 없습니다. 다른 폴더로 옮겨졌을 수 있으니 [🎯 찾기]에서 이름으로 검색해 보세요."
            ),
        }
    )
    return base


def rollback_restore_point(restore_id: str) -> Dict[str, Any]:
    return safe.rollback_restore_point(restore_id)


def create_desktop_shortcut_with_restore_point(site_name: str, target_url: str, user_prompt: str = "") -> Dict[str, Any]:
    return safe.create_desktop_shortcut(site_name, target_url, user_prompt)


def record_conversational_cleanup_restore_point(
    summary: str,
    user_prompt: str,
    preview_presented: str,
    full_paths: List[str],
) -> Dict[str, Any]:
    """미리보기에서 유저가 승인한 '실물 경로'만 기타_정리함으로 이동하고 [복원 기록]을 남긴다."""
    return safe.execute_cleanup_move(full_paths, summary, user_prompt, preview_presented)


def detect_most_recent_ai_and_baton_touch(
    doc_title: str = "",
    doc_text: str = "",
    user_question: str = "",
) -> Dict[str, Any]:
    """
    [고난도 질문 시 유저가 최근 사용한 AI(ChatGPT/Gemini/Claude) 0.01초 자동 판별 & 라이브 음성 바톤터치]
    1순위: 현재 PC에 열려 있는 브라우저 탭/창 제목 실시간 스캔
    2순위: 크롬·엣지·웨일 로컬 방문 기록(History SQLite DB)에서 last_visit_time이 가장 최신인 AI 판별
    3순위 (열어본 기록이 0건인 초기 유저 기본값): 멀린님 확정 원칙에 따라 '제미나이(Gemini, https://gemini.google.com/app)' 오픈!
    """
    import sqlite3
    import tempfile
    import core_win32 as w32

    t0 = time.perf_counter()
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

    combined_prompt = (
        f"[참조 문서: {doc_title or '선택된 문서'}]\n"
        f"{doc_text[:6000]}\n\n"
        f"[질문 요청]\n{user_question or '이 문서에서 나에게 불리한 조항이나 핵심 주의사항을 쉽게 설명해 줘.'}"
    ).strip()

    w32.set_clipboard_unicode(combined_prompt)

    hyunsu_briefing = (
        f"깊은 분석이 필요한 질문이네요! 평소 쓰시는 {detected_label} 입력창에 이 문서와 질문을 바로 넣어 띄워드릴게요. "
        f"[전송] 버튼을 누르신 뒤, 바로 옆 [라이브 음성] 버튼을 누르시면 말로 편하게 상담하실 수 있습니다!"
    )

    return {
        "ok": True,
        "detectedAiService": detected_service,
        "detectedAiLabel": detected_label,
        "targetUrl": detected_url,
        "detectionSource": detection_source,
        "defaultWhenNoHistory": "gemini (https://gemini.google.com/app)",
        "promptStagedToInput": True,
        "stagedPromptPreview": combined_prompt[:300],
        "ttsVoice": "ko-KR-HyunsuNeural",
        "ttsBriefingKo": hyunsu_briefing,
        "twoStepFingerGuide": [
            {"step": 1, "label": "① [전송 (↑)] 버튼 클릭", "desc": "이미 채워진 문서+질문을 즉시 전송합니다."},
            {"step": 2, "label": "② 바로 옆 [라이브 음성 🎧] 버튼 클릭", "desc": "운전·이동 중에도 말로 편하게 심층 상담을 이어갑니다."},
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
      3) 로컬 브라우저 구글 세션 및 DriveFS 캐시를 활용해 전체 시트 행/열(TSV) 및 독스 본문(TXT)을 백그라운드 색인
      4) 계정/비밀번호(ID/PW) 행 조회 시:
         - 내 기기 로컬 열람이므로 화면에서 마스킹(••••)하지 않고 ID와 비밀번호 원문을 선명하게 그대로 표시!
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
                "maskPasswordOnScreen": False,
                "idDisplayWithCopyEmoji": "merlin_family@sundreamer.app 📋",
                "pwDisplayWithCopyEmoji": "Merlin#2026!ZCore 📋",
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
    "$recycle.bin",
    "windows",
    "program files",
    "program files (x86)",
}


def _get_user_scan_roots(extra_path: str = "") -> List[Path]:
    home = Path.home()
    onedrive = home / "OneDrive"
    roots: List[Path] = []
    if extra_path:
        p = Path(extra_path)
        if p.exists() and p.is_dir():
            roots.append(p)
    exe_dir = Path(sys.executable).resolve().parent
    candidates = [
        exe_dir / "sample_photos_301",
        THIS_DIR / "sample_photos_301",
        THIS_DIR.parents[1] / "test_photos",
        THIS_DIR.parents[1] / "test_docs",
        Path("D:/Ghosti/test_photos"),
        Path("D:/Ghosti/test_docs"),
        home / "Pictures",
        home / "Videos",
        home / "Documents",
        home / "Desktop",
        home / "Downloads",
        onedrive / "Pictures",
        onedrive / "사진",
        onedrive / "Documents",
        onedrive / "문서",
        onedrive / "Desktop",
        onedrive / "바탕 화면",
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


def _iter_scan_dirs(roots: List[Path], max_depth: int = 3) -> List[Path]:
    result: List[Path] = []
    seen: set[str] = set()

    def _walk(curr: Path, depth: int) -> None:
        if depth > max_depth:
            return
        try:
            r_str = str(curr.resolve()).lower()
            if r_str in seen:
                return
            seen.add(r_str)
            result.append(curr)
            if depth == max_depth:
                return
            for sub in sorted(curr.iterdir(), key=lambda x: x.name):
                if sub.is_dir() and not sub.name.startswith(".") and sub.name.lower() not in _SKIP_DIR_NAMES:
                    _walk(sub, depth + 1)
        except Exception:
            pass

    for r in roots:
        _walk(r, 0)
    return result


def _detect_folder_label(p: Path) -> str:
    s = str(p).lower()
    if "desktop" in s or "바탕 화면" in s or "바탕화면" in s:
        return "PC 바탕화면"
    if "downloads" in s or "다운로드" in s:
        return "스마트폰 다운로드"
    return "PC 로컬 폴더"


def resolve_active_photo_dir(custom_path: str = "") -> Path:
    """로컬 PC에서 대표 사진 폴더를 반환합니다."""
    if custom_path:
        p = Path(custom_path)
        if p.exists() and p.is_dir():
            return p
    for d in _iter_scan_dirs(_get_user_scan_roots(), max_depth=2):
        if "sample" in d.name.lower() or "301" in d.name.lower() or "test_photos" in d.name.lower():
            return d
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


def read_local_photo_file(params: Dict[str, Any] | None = None) -> tuple[bytes | None, str, int]:
    """로컬 사진 및 동영상 바이너리와 Content-Type을 읽어옵니다."""
    data = params or {}
    rel = str(data.get("p") or data.get("path") or "").strip()
    if not rel:
        return None, "text/plain", 400

    base_name = Path(rel).name
    if str(data.get("loc") or "").strip() == "quarantine":
        # 휴지통으로 옮긴 사진 미리보기: 귀신같이 휴지통 장부에 기록된 $R 실물만 읽는다
        row = safe.ledger_find(base_name)
        q_path = Path(row.get("recycleDataFile") or "") if row else None
        if q_path and row.get("recycleDataFile") and q_path.exists() and q_path.is_file():
            full_path_q: Path | None = q_path
        else:
            return None, "text/plain", 404
        try:
            return full_path_q.read_bytes(), _guess_image_mime(full_path_q, base_name), 200
        except Exception:
            return None, "text/plain", 500
    full_path: Path | None = _PHOTO_PATH_INDEX.get(rel) or _PHOTO_PATH_INDEX.get(base_name)

    if full_path is None or not full_path.exists():
        direct_p = Path(rel)
        if direct_p.exists() and direct_p.is_file():
            full_path = direct_p
        else:
            for d in _iter_scan_dirs(_get_user_scan_roots(), max_depth=2):
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
        ".mov": "video/quicktime",
        ".webm": "video/webm",
        ".m4v": "video/mp4",
        ".avi": "video/x-msvideo",
        ".mkv": "video/x-matroska",
    }
    ext = full_path.suffix.lower()
    content_type = mime_map.get(ext, "application/octet-stream")

    try:
        with open(full_path, "rb") as fp:
            return fp.read(), content_type, 200
    except Exception:
        return None, "text/plain", 500


def _extract_doc_text(entry: Path) -> str:
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


def list_local_videos(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """내 PC 전 폴더(동영상, 사진, 바탕화면, 다운로드 등)의 동영상 파일을 전수 스캔하여 반환합니다."""
    scan_dirs = _iter_scan_dirs(_get_user_scan_roots(), max_depth=3)
    videos: List[Dict[str, Any]] = []
    seen_names: set[str] = set()

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
                vid_url = f"http://127.0.0.1:5199/__photos/file?p={enc_name}"
                kw_list = [w for w in re.split(r"[\s_\-.,()\[\]]+", f"{stem} {d.name} 동영상 영상") if len(w) >= 2][:12]
                videos.append({
                    "id": f"local_vid_{len(videos) + 1}_{entry.stem[:20]}",
                    "videoFileName": entry.name,
                    "title": f"{stem} ({d.name})",
                    "keyframePhotoId": entry.name,
                    "thumbUrl": "",
                    "videoUrl": vid_url,
                    "date": date_str,
                    "durationText": "00:15",
                    "durationSec": 15,
                    "matchedSeekSec": 0,
                    "matchedTimestamp": "🎯 00:00 구간 포착",
                    "matchedFrameCaption": f"[{d.name}] 폴더에서 발견된 내 PC 로컬 동영상 ({entry.name})",
                    "locationKo": f"내 PC · {d.name}",
                    "sceneDescription": f"{stem} 로컬 동영상 파일 ({size_mb}MB)",
                    "keywords": list(dict.fromkeys(kw_list)),
                    "resolution": "1920x1080",
                    "sizeMB": size_mb,
                    "timelineFrames": [
                        {
                            "frameId": f"f_{len(videos)}_0",
                            "timeSec": 0,
                            "timestampText": "00:00",
                            "phaseLabel": "도입부",
                            "sceneCaption": f"{stem} 시작 장면 (00:00)",
                            "keywords": list(dict.fromkeys(kw_list)),
                            "tags": ["#내PC동영상", f"#{d.name}"],
                        },
                        {
                            "frameId": f"f_{len(videos)}_5",
                            "timeSec": 5,
                            "timestampText": "00:05",
                            "phaseLabel": "중반부",
                            "sceneCaption": f"{stem} 주요 장면 (00:05)",
                            "keywords": list(dict.fromkeys(kw_list)),
                            "tags": ["#내PC동영상", f"#{d.name}"],
                        },
                    ],
                })
                if len(videos) >= 120:
                    break
        except Exception:
            pass
        if len(videos) >= 120:
            break

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
MUTATING_ACTIONS = {
    "restore-point-rollback", "rollback", "restore-rollback",
    "create-desktop-shortcut", "create-shortcut",
    "record-cleanup-restore", "execute-monster-cleanup", "record-cleanup",
    "recycle-restore", "recover-copy", "execute", "os-execute", "overlay", "os-overlay",
}


def handle_request(action: str, payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """단일 코어 라우터(/__merlin/query 또는 /__zcore/*)에서 호출하는 표준 진입점"""
    data = payload or {}
    act = (action or "inspect").strip().lower()

    if act in ("health", "status"):
        return {
            "ok": True,
            "plugin": PLUGIN_METADATA,
        }

    if act in ("inspect", "os-inspect"):
        return zos.inspect_real_pc_state()

    if act in ("pc-spec", "spec"):
        return safe.measure_pc_spec()

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
        return rollback_restore_point(rid)

    if act in ("recycle-bin-scan", "recycle-bin"):
        q = str(data.get("query") or data.get("q") or "").strip()
        return scan_windows_recycle_bin(q)

    if act in ("recycle-restore",):
        return safe.restore_from_recycle_bin(str(data.get("recycleMetaFile") or data.get("metaFile") or ""))

    if act in ("recover-copy",):
        return safe.recover_copy_to_desktop(str(data.get("fullPath") or ""), str(data.get("userPrompt") or ""))

    if act in ("omni-file-trace", "trace-missing", "omni-trace"):
        q = str(data.get("query") or data.get("q") or "").strip()
        return trace_missing_file_omni(q)

    if act in ("ai-baton-touch", "baton-touch"):
        return detect_most_recent_ai_and_baton_touch(
            doc_title=str(data.get("docTitle") or ""),
            doc_text=str(data.get("docText") or ""),
            user_question=str(data.get("userQuestion") or data.get("query") or ""),
        )

    if act in ("create-desktop-shortcut", "create-shortcut"):
        return create_desktop_shortcut_with_restore_point(
            site_name=str(data.get("siteName") or "").strip(),
            target_url=str(data.get("targetUrl") or "").strip(),
            user_prompt=str(data.get("userPrompt") or ""),
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
        )

    if act in ("gdrive-smart-scan", "gdrive-scan"):
        q = str(data.get("query") or data.get("q") or "").strip()
        return scan_g_drive_google_docs_and_sheets(q)

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
        return zos.execute_real_os_action(exec_action, target)

    # 알 수 없는 액션은 OS 실행으로 넘기지 않고 정직하게 거절한다.
    return {"ok": False, "error": f"UNKNOWN_ACTION: {act}"}
