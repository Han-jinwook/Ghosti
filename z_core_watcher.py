#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
제트아이 (Z-Eye) 무토큰 3중 통합 감시 데몬 (z_core_watcher.py)
- 평상시 AI 토큰 소모: 0 (파이썬 로컬 프로세스만 동작)
- 감시 대상 3가지:
  1. [직통 우체통 감지] D:\\Z-Eye\\universal_z_core\\inbox\\ 내 신규 피드백/요청 문서(.md) 투함 여부
  2. [전사 강령 이식 감지] D:\\Z-Eye\\docs\\멀린코딩강령_v20261020.md (및 docs/ 내 비서 전령 이식 파일) 변경 여부
  3. [노션 QA 버그 감지] 노션 칸반 보드에 알바생(테스터)이 등록한 신규 '발견된 버그' 티켓 여부
- 작동 방식:
  평소에는 조용히 대기하다가 위 3가지 중 하나라도 변화가 감지되면,
  즉시 상세 내용을 출력하고 프로세스를 종료(Exit 0)하여 Antigravity AI 에이전트를 자동으로 깨웁니다.
"""

import hashlib
import os
import re
import sqlite3
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Set

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parent
INBOX_DIR = ROOT_DIR / "universal_z_core" / "inbox"
DOCTRINE_FILE = ROOT_DIR / "docs" / "멀린코딩강령_v20261020.md"
HANDOVER_FILE = ROOT_DIR / "docs" / "SESSION_HANDOVER.md"
STATE_FILE = ROOT_DIR / ".watcher_state.json"
AGY_DIR = Path.home() / ".gemini" / "antigravity"
AGY_DB = AGY_DIR / "conversation_summaries.db"
AGY_ANNOTATIONS = AGY_DIR / "annotations"


def _clean_summary_line(line: str) -> str:
    s = line.strip()
    s = re.sub(r"^[-*•\d.)\s]+", "", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"\1", s)
    s = re.sub(r"`([^`]+)`", r"\1", s)
    if ":" in s:
        head, tail = s.split(":", 1)
        if len(head.strip()) <= 38:
            s = head.strip()
        else:
            s = f"{head.strip()}: {tail.strip()}"
    s = re.sub(r"\s+", " ", s).strip(" -–—:·")
    return s[:42]


def derive_session_title(explicit_title: str | None = None) -> str:
    if explicit_title and explicit_title.strip():
        return re.sub(r"^\d{1,2}-\d{1,2},?\s*(?:\d{1,2}:\d{2})?\s*-\s*", "", explicit_title.strip())
    if HANDOVER_FILE.exists():
        try:
            text = HANDOVER_FILE.read_text(encoding="utf-8", errors="ignore")
            m_explicit = re.search(r"세션\s*제목[^:\n]*:\s*([^\r\n]+)", text)
            if m_explicit:
                val = m_explicit.group(1).strip().strip("`*")
                val = re.sub(r"^\d{1,2}-\d{1,2},?\s*(?:\d{1,2}:\d{2})?\s*-\s*", "", val)
                if val and not val.startswith("(") and "MM-DD" not in val and "일시 제외" not in val:
                    return val[:45]
            sections = re.split(r"\n---\s*\n", text)
            top_section = ""
            for sec in sections:
                if any(k in sec for k in ("완료", "체크아웃", "작업", "내역", "요약")):
                    top_section = sec
                    break
            if not top_section:
                top_section = text[:2000]
            work_block = top_section
            m_work = re.search(
                r"(?:완료한\s*핵심\s*작업|완료\s*내역[^\n]*)(.*?)(?:\n[-*#\d]*\s*(?:직전\s*대화|다음\s*체크인)|\Z)",
                top_section,
                re.S,
            )
            if m_work:
                work_block = m_work.group(1)
            numbered = re.findall(r"(?m)^\s*\d+[.)]\s+\*\*([^\n*]+)\*\*", work_block)
            if not numbered:
                numbered = re.findall(r"(?m)^\s*\d+[.)]\s+([^\r\n]+)", work_block)
            if not numbered:
                numbered = re.findall(r"(?m)^\s*[-*•]\s+\*\*([^\n*]+)\*\*", work_block)
            if not numbered:
                numbered = re.findall(r"(?m)^\s*[-*•]\s+([^\r\n]+)", work_block)
            if numbered:
                last_item = _clean_summary_line(numbered[-1])
                if last_item:
                    return last_item[:45]
        except Exception:
            pass
    try:
        res = subprocess.run(
            ["git", "log", "-n", "15", "--pretty=format:%s"],
            cwd=str(ROOT_DIR),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=5,
        )
        if res.returncode == 0 and res.stdout:
            for line in res.stdout.splitlines():
                msg = line.strip()
                if not msg or any(
                    skip in msg
                    for skip in ("멀린코딩강령", "doctrine_watcher", "전사 동기화", "루트 방황 문서")
                ):
                    continue
                msg = re.sub(r"^(?:feat|fix|chore|docs|refactor)(?:\([^)]+\))?:\s*", "", msg, flags=re.I)
                return msg[:45]
    except Exception:
        pass
    return f"{ROOT_DIR.name} 체크인"


def _patch_protobuf_title(raw_bytes: bytes, old_title: str, new_title: str) -> bytes:
    if not raw_bytes or not old_title:
        return raw_bytes
    old_b = old_title.encode("utf-8")
    new_b = new_title.encode("utf-8")
    if len(old_b) >= 128 or len(new_b) >= 128:
        return raw_bytes
    old_chunk = bytes([0x0A, len(old_b)]) + old_b
    new_chunk = bytes([0x0A, len(new_b)]) + new_b
    if raw_bytes.startswith(old_chunk):
        return new_chunk + raw_bytes[len(old_chunk) :]
    return raw_bytes


def sync_antigravity_session_title(explicit_title: str | None = None) -> str | None:
    if not AGY_DB.exists():
        return None
    target_title = derive_session_title(explicit_title)
    folder_name = ROOT_DIR.name.lower()
    updated_cid = None
    try:
        conn = sqlite3.connect(str(AGY_DB), timeout=5)
        cur = conn.cursor()
        rows = cur.execute(
            "SELECT conversation_id, title, workspace_uris, raw_summary FROM conversation_summaries ORDER BY last_modified_time DESC LIMIT 20"
        ).fetchall()
        for cid, cur_title, uris, raw_sum in rows:
            uris_lower = (uris or "").lower()
            if f"/{folder_name}\"" not in uris_lower and f"/{folder_name}]" not in uris_lower:
                continue
            should_replace = (
                explicit_title is not None
                or not cur_title
                or "check-in" in cur_title.lower()
                or cur_title.strip() in ("체크인", "출근", "이어서 하자")
                or bool(re.match(r"^\d{1,2}-\d{1,2},?\s*(?:\d{1,2}:\d{2})?\s*-\s*", cur_title))
            )
            if should_replace and cur_title != target_title:
                new_raw = _patch_protobuf_title(raw_sum, cur_title, target_title)
                cur.execute(
                    "UPDATE conversation_summaries SET title = ?, preview = ?, raw_summary = ? WHERE conversation_id = ?",
                    (target_title, target_title, new_raw, cid),
                )
                pbtxt_path = AGY_ANNOTATIONS / f"{cid}.pbtxt"
                if pbtxt_path.exists():
                    pb_text = pbtxt_path.read_text(encoding="utf-8", errors="ignore")
                    escaped = target_title.replace('"', '\\"')
                    if 'title:"' in pb_text:
                        pb_text = re.sub(r'title:"[^"]*"', f'title:"{escaped}"', pb_text, count=1)
                    else:
                        pb_text = f'title:"{escaped}" ' + pb_text
                    pbtxt_path.write_text(pb_text, encoding="utf-8")
                updated_cid = cid
            break
        if updated_cid:
            conn.commit()
        conn.close()
    except Exception:
        pass
    return target_title if updated_cid else None


def file_md5(path: Path) -> str:
    if not path.exists():
        return ""
    try:
        return hashlib.md5(path.read_bytes()).hexdigest()
    except Exception:
        return ""


def scan_inbox_files() -> Dict[str, str]:
    """우체통(inbox/) 내 README.md를 제외한 모든 파일의 경로와 해시를 반환합니다."""
    if not INBOX_DIR.exists():
        return {}
    result: Dict[str, str] = {}
    for p in INBOX_DIR.iterdir():
        if p.is_file() and p.name.lower() not in ("readme.md", ".gitkeep"):
            result[p.name] = file_md5(p)
    return result


def check_notion_new_bugs(seen_bug_ids: Set[str]) -> list:
    """notion_qa 모듈을 통해 신규 '발견된 버그'가 있는지 조용히 확인합니다."""
    try:
        import notion_qa

        if (
            not notion_qa.NOTION_TOKEN
            or notion_qa.NOTION_TOKEN.startswith("[여기에")
        ):
            return []
        bugs = notion_qa.query_bugs_raw(notion_qa.STATUS_DISCOVERED)
        return [b for b in bugs if b["page_id"] not in seen_bug_ids]
    except Exception:
        return []


def main() -> None:
    if len(sys.argv) >= 3 and sys.argv[1] == "--set-title":
        custom_title = " ".join(sys.argv[2:])
        applied = sync_antigravity_session_title(custom_title)
        print(f"🏷️ [세션 제목 변경 완료] {applied or custom_title}")
        return

    interval_sec = int(sys.argv[1]) if len(sys.argv) >= 2 and sys.argv[1].isdigit() else 10
    applied_title = sync_antigravity_session_title()
    if applied_title:
        print(f"🏷️ [{ROOT_DIR.name} 세션 창 제목 자동 각인] ➔ '{applied_title}'")

    # 초기 스냅샷 기록 (시작 시점의 상태는 이미 확인된 것으로 간주하되, 우체통에 미처리 파일이 있으면 즉시 알림)
    initial_inbox = scan_inbox_files()
    if initial_inbox:
        print("\n" + "📬" * 24)
        print(
            f"🔔 [Z-코어 우체통 자동 감지] 우체통(universal_z_core/inbox/)에 {len(initial_inbox)}건의 의견서가 도착해 있습니다!"
        )
        for fname in initial_inbox:
            fpath = INBOX_DIR / fname
            content_preview = fpath.read_text(encoding="utf-8", errors="replace")[:800]
            print(f"\n📄 파일명: {fname}")
            print("-" * 60)
            print(content_preview)
            print("-" * 60)
        print(
            "\n👉 [AI 에이전트 지시] 위 우체통 건의사항을 읽고 1) 원 코어(core_store_clean) vs 파워 코어(core_power_agent) 분류, 2) 스토어 심사 패스 안전성 여부를 판단하여 멀린님께 즉시 보고하세요!"
        )
        print("📬" * 24)
        return

    baseline_inbox = initial_inbox
    baseline_doctrine_hash = file_md5(DOCTRINE_FILE)

    # 초기 노션 버그 ID 스냅샷
    seen_bug_ids: Set[str] = set()
    try:
        import notion_qa

        for b in notion_qa.query_bugs_raw(notion_qa.STATUS_DISCOVERED):
            seen_bug_ids.add(b["page_id"])
    except Exception:
        pass

    print(
        f"👀 [Z-Eye 무토큰 3중 감시병 가동] ({interval_sec}초 주기 | AI 토큰 소모 0)\n"
        f"   1) Z-코어 직통 우체통: {INBOX_DIR}\n"
        f"   2) 비서 전사 코딩강령 이식: {DOCTRINE_FILE.name}\n"
        f"   3) 노션 QA 칸반 보드: '발견된 버그' 컬럼"
    )

    tick = 0
    while True:
        time.sleep(interval_sec)
        tick += 1
        if tick <= 6:
            sync_antigravity_session_title()

        # 1) 우체통(inbox/) 신규 파일 또는 수정 감지 (매 주기마다 즉시 체크)
        current_inbox = scan_inbox_files()
        new_or_changed_inbox = [
            fname
            for fname, fhash in current_inbox.items()
            if fname not in baseline_inbox or baseline_inbox[fname] != fhash
        ]
        if new_or_changed_inbox:
            print("\n" + "📬" * 24)
            print(
                f"🔔 [Z-코어 우체통 신규 도착!] 타 프로젝트 에이전트가 우체통에 {len(new_or_changed_inbox)}건의 의견을 투함했습니다!"
            )
            for fname in new_or_changed_inbox:
                fpath = INBOX_DIR / fname
                content_preview = fpath.read_text(encoding="utf-8", errors="replace")[:1000]
                print(f"\n📄 파일명: {fname}")
                print("-" * 60)
                print(content_preview)
                print("-" * 60)
            print(
                "\n👉 [AI 에이전트 지시] 우체통 의견을 1) 원 코어 vs 파워 코어 분류, 2) 스토어 심사 리스크 검열 기준으로 분석하여 멀린님께 즉시 보고하세요!"
            )
            print("📬" * 24)
            return

        # 2) 비서(Secretary)의 전사 코딩강령 외부 이식/업데이트 감지 (매 주기마다 체크)
        current_doctrine_hash = file_md5(DOCTRINE_FILE)
        if current_doctrine_hash and current_doctrine_hash != baseline_doctrine_hash:
            print("\n" + "📜" * 24)
            print(
                "🔔 [전사 코딩강령 외부 이식 자동 감지!] 비서(Secretary)로부터 'docs/멀린코딩강령_v20261020.md' 업데이트가 이식되었습니다!"
            )
            tail_lines = DOCTRINE_FILE.read_text(encoding="utf-8", errors="replace").splitlines()[-35:]
            print("\n📌 [최신 강령 하단 변경 내역 미리보기]")
            print("\n".join(tail_lines))
            print(
                "\n👉 [AI 에이전트 지시] 업데이트된 강령을 즉시 숙지하고 멀린님께 변경 요약을 보고하세요!"
            )
            print("📜" * 24)
            return

        # 3) 노션 칸반 보드 신규 '발견된 버그' 감지 (2틱 = 약 20초마다 체크)
        if tick % 2 == 0:
            new_bugs = check_notion_new_bugs(seen_bug_ids)
            if new_bugs:
                print("\n" + "🚨" * 24)
                print(
                    f"🔔 [노션 QA 신규 버그 자동 감지!] 테스터가 '발견된 버그' {len(new_bugs)}건을 새로 등록했습니다!"
                )
                for idx, b in enumerate(new_bugs, start=1):
                    print(f"\n[{idx}] 📌 제목: {b['title']}")
                    print(f"    🆔 카드 ID: {b['page_id']}")
                    print(f"    📝 내용: {b['body']}")
                print("\n💬 멀린님, 방금 감지된 노션 버그를 바로 수정할까요?")
                print("🚨" * 24)
                return


if __name__ == "__main__":
    main()
