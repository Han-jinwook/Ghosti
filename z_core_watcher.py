#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
귀신같이 (Ghosti) 무토큰 3중 통합 점검 및 세션 창 제목 자동 각인 스크립트 (z_core_watcher.py)
- 평상시 AI 토큰 소모: 0 (파이썬 로컬 프로세스만 동작)
- 점검/감시 대상 3가지:
  1. [전사 중앙 우체국 감지] D:\\Secretary\\post_office\\ 내 Ghosti / ALL 수신 문서(.md) 도착 여부 (단일 우체국 통합)
  2. [전사 강령 이식 감지] D:\\Ghosti\\docs\\멀린코딩강령_v20261020.md 변경 여부
  3. [노션 QA 버그 감지] 노션 칸반 보드에 알바생(테스터)이 등록한 신규 '발견된 버그'([귀신같이]) 티켓 여부
- 작동 방식:
  체크인 시 기본 실행(`python z_core_watcher.py`)은 세션 창 제목을 자동 각인하고 3대 항목을 즉시 점검한 뒤,
  Antigravity 채팅창의 'Queued Messages(대기열)' 걸림 현상을 100% 원천 방지하기 위해 즉시 종료(Exit 0)합니다.
  상시 루프 감시가 명시적으로 필요한 경우에만 `--watch` 옵션을 사용합니다.
"""

import hashlib
import re
import sqlite3
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, Set

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parent
POST_OFFICE_DIR = Path(r"D:\Secretary\post_office")
DOCTRINE_FILE = ROOT_DIR / "docs" / "멀린코딩강령_v20261020.md"
HANDOVER_FILE = ROOT_DIR / "docs" / "SESSION_HANDOVER.md"
ROLE_HANDOVER_FILES = {
    str(i): ROOT_DIR / "docs" / f"SESSION_HANDOVER_{i}.md" for i in (1, 2, 3, 4)
}


def merge_role_handovers() -> bool:
    """
    [4개 창 동시 체크아웃 충돌 0% — 결정론적 파이썬 자동 합본기]
    - 체크아웃 시 각 귀신 창(1~4)은 오직 자기 파일(docs/SESSION_HANDOVER_1~4.md)만 수정합니다.
    - 체크인(또는 --merge-handover) 시 본 함수가 1~4번 파일 원문을 1줄 누락 없이 기계적으로 이어붙여
      docs/SESSION_HANDOVER.md 통합본을 0.01초 만에 자동 생성합니다 (내용 동일 시 미기록).
    """
    parts: list[str] = []
    found_any = False
    for role_no in ("1", "2", "3", "4"):
        rf = ROLE_HANDOVER_FILES[role_no]
        if rf.exists():
            found_any = True
            body = rf.read_text(encoding="utf-8", errors="ignore").replace("\r\n", "\n").strip()
            if body:
                parts.append(body)
    if not found_any or not parts:
        return False

    header = (
        "# 📋 귀신같이 (Ghosti) 1~4귀신 통합 세션 인계장 (`SESSION_HANDOVER.md` — 자동 합본)\n\n"
        "> ⚠️ **[자동 합본 안내 — 직접 수정 금지]**: 본 파일은 `z_core_watcher.py`가 "
        "`SESSION_HANDOVER_1.md` ~ `SESSION_HANDOVER_4.md` 4개 파일을 기계적으로 이어붙여 생성합니다. "
        "체크아웃 시 각 창은 **오직 자기 번호 파일(`docs/SESSION_HANDOVER_N.md`)만 수정**하세요.\n\n"
        "---\n\n"
    )
    merged = header + "\n\n---\n\n".join(parts) + "\n"
    try:
        old = HANDOVER_FILE.read_text(encoding="utf-8", errors="ignore").replace("\r\n", "\n") if HANDOVER_FILE.exists() else ""
        if old != merged:
            HANDOVER_FILE.write_text(merged, encoding="utf-8")
            return True
    except Exception:
        pass
    return False
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
    role_for_title = _resolve_active_role()
    target_handover = ROLE_HANDOVER_FILES.get(role_for_title) if role_for_title in ROLE_HANDOVER_FILES else HANDOVER_FILE
    if not target_handover or not target_handover.exists():
        target_handover = HANDOVER_FILE
    if target_handover.exists():
        try:
            text = target_handover.read_text(encoding="utf-8", errors="ignore")
            m_explicit = re.search(r"세션(?:\s*창)?\s*제목[^:\n]*:\s*([^\r\n]+)", text)
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
            if f'/{folder_name}"' not in uris_lower and f"/{folder_name}]" not in uris_lower:
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


def scan_post_office_files(role: str = "all") -> Dict[str, str]:
    """전사 중앙 우체국(D:\\Secretary\\post_office\\) 내 Ghosti / ALL 수신 문서의 경로와 해시를 반환합니다.
    2호(role=2)·3호(role=3) 보조 창은 중복 기상 방지를 위해 일반 Ghosti/ALL 공문을 감시하지 않고 1호(role=1/all)가 전담합니다."""
    try:
        if not POST_OFFICE_DIR.exists():
            return {}
        is_primary = role == "all" or "1" in (role or "")
        receipts_dir = POST_OFFICE_DIR / "receipts"
        result: Dict[str, str] = {}
        for p in sorted(POST_OFFICE_DIR.glob("*.md")):
            if p.name.lower() in ("readme.md", ".gitkeep") or p.name.startswith("(읽음)"):
                continue
            prefix = p.name.split("_", 1)[0].strip("[]").lower()
            parts = p.name.split("_")
            sender = parts[1].strip("[]").lower() if len(parts) > 1 else ""
            if sender == "ghosti" or prefix not in ("ghosti", "all"):
                continue
            head_text = ""
            if prefix == "ghosti":
                try:
                    head_text = p.read_text(encoding="utf-8", errors="ignore")[:500]
                except Exception:
                    head_text = ""
            recipient_line = ""
            for line in head_text.splitlines()[:10]:
                if "받는이" in line or "수신" in line:
                    recipient_line += " " + line
            # 파일명 앞쪽 태그(_1귀신_, _2귀신_, _3귀신_, _4귀신_) 또는 본문 상단 [N귀신 수신] / 받는이 라인을 최우선 판별
            # (제목 뒷부분에 '1귀신전달' 같은 단어가 섞여 있어도 실제 수신 담당 귀신을 오판하지 않도록 정밀 분기)
            explicit_r1_target = bool(
                re.search(r"(?:_1귀신_|\[1귀신\s*수신\]|(?:받는이|수신)[^\n]*1귀신|(?:받는이|수신)[^\n]*1호담당)", p.name + "\n" + recipient_line)
            )
            explicit_r2 = (
                bool(re.search(r"(?:_2귀신_|_2호담당_|\[2귀신\s*수신\]|(?:받는이|수신)[^\n]*2귀신|(?:받는이|수신)[^\n]*2호담당)", p.name + "\n" + recipient_line))
                and not explicit_r1_target
            )
            explicit_r3 = (
                bool(re.search(r"(?:_3귀신_|_3호담당_|\[3귀신\s*수신\]|(?:받는이|수신)[^\n]*3귀신|(?:받는이|수신)[^\n]*3호담당)", p.name + "\n" + recipient_line))
                and not explicit_r1_target
            )
            explicit_r4 = (
                bool(re.search(r"(?:_4귀신_|_4호담당_|\[4귀신\s*수신\]|(?:받는이|수신)[^\n]*4귀신|(?:받는이|수신)[^\n]*4호담당)", p.name + "\n" + recipient_line))
                and not explicit_r1_target
            )
            if explicit_r2 and role != "all" and "2" not in (role or ""):
                continue
            if explicit_r3 and role != "all" and "3" not in (role or ""):
                continue
            if explicit_r4 and role != "all" and "4" not in (role or ""):
                continue
            if not is_primary and not explicit_r2 and not explicit_r3 and not explicit_r4:
                continue
            if prefix == "all":
                if (receipts_dir / f"{p.stem}.Ghosti.read").exists() or (receipts_dir / f"{p.name}.Ghosti.read").exists():
                    continue
            result[p.name] = file_md5(p)
        return result
    except Exception:
        return {}


def claim_post_office_mail_immediately(fname: str) -> Path:
    """1귀신(본진 대장 창)이 메일 감지 즉시 0.001초 만에 선점 읽음 처리하여 2호·3호 중복 기상을 원천 차단합니다.
    - Ghosti 단독 수신: 파일명 앞에 '(읽음)' 즉시 부착
    - ALL 전체 공문: 타 앱 열람을 보존하기 위해 파일명은 유지하고 receipts/<stem>.Ghosti.read 영수증 즉시 생성"""
    fpath = POST_OFFICE_DIR / fname
    if not fpath.exists():
        alt = POST_OFFICE_DIR / f"(읽음){fname}"
        return alt if alt.exists() else fpath
    prefix = fname.split("_", 1)[0].strip("[]").lower()
    if prefix == "all":
        try:
            receipts_dir = POST_OFFICE_DIR / "receipts"
            receipts_dir.mkdir(parents=True, exist_ok=True)
            now_str = time.strftime("%Y-%m-%d %H:%M:%S")
            (receipts_dir / f"{fpath.stem}.Ghosti.read").write_text(now_str, encoding="utf-8")
            (receipts_dir / f"{fpath.name}.Ghosti.read").write_text(now_str, encoding="utf-8")
        except Exception:
            pass
        return fpath
    if not fname.startswith("(읽음)"):
        target = POST_OFFICE_DIR / f"(읽음){fname}"
        try:
            fpath.rename(target)
            return target
        except Exception:
            return fpath
    return fpath


def _normalize_role_arg(raw_val: str) -> str:
    val = (raw_val or "").strip().lower()
    if val == "all":
        return "all"
    normalized = ",".join(r for r in ("1", "2", "3", "4") if r in val)
    return normalized


def _resolve_active_role() -> str:
    """
    --role 1|2|3|4|1,2|3,4|all 인자(하위호환 --track 포함)로부터
    현재 창의 담당 역할(1귀신 / 2귀신 / 3귀신 / 4귀신 / 복합 / all)을 판별합니다.
    - 창 1개만 열었을 때(D:\\Ghosti 무옵션): 기본값 'all' (1~4귀신·귀신창 전체 감지)
    - 명시적 --role 1 | 2 | 3 | 4 | 1,2 | 3,4 | 2,3 | all 지정 시 해당 값 최우선 적용
    """
    for i, arg in enumerate(sys.argv[1:], start=1):
        if arg == "--role" and i + 1 < len(sys.argv):
            norm = _normalize_role_arg(sys.argv[i + 1])
            if norm:
                return norm
        elif arg.startswith("--role="):
            norm = _normalize_role_arg(arg.split("=", 1)[1])
            if norm:
                return norm
        elif arg == "--track" and i + 1 < len(sys.argv):
            val = sys.argv[i + 1].strip().lower()
            return {"free": "1", "sync": "2", "share": "3", "work": "4"}.get(val, "all")
        elif arg.startswith("--track="):
            val = arg.split("=", 1)[1].strip().lower()
            return {"free": "1", "sync": "2", "share": "3", "work": "4"}.get(val, "all")
    return "all"


def check_notion_new_bugs(seen_bug_ids: Set[str], role: str = "all") -> list:
    """notion_qa 모듈을 통해 현재 role의 신규 '발견된 버그'가 있는지 조용히 확인합니다 (동일 role 내 STATUS_FIXING만 체크하여 타 창 블로킹 원천 방지)."""
    try:
        import notion_qa

        if not notion_qa.NOTION_TOKEN or notion_qa.NOTION_TOKEN.startswith("[여기에"):
            return []
        bugs = (
            []
            if notion_qa.query_bugs_raw(notion_qa.STATUS_FIXING, role=role)
            else notion_qa.query_bugs_raw(notion_qa.STATUS_DISCOVERED, role=role)
        )
        return [b for b in bugs if b.get("page_id", b.get("id")) not in seen_bug_ids]
    except Exception:
        return []


def auto_heal_agents_and_handover_files() -> None:
    """
    [영구 재발 방지 가드 — AGENTS.md & SESSION_HANDOVER.md 빈 줄 폭탄(\r\r\n) 0.01초 자동 자가치유 및 800줄 잘림(<truncated>) 사전 경보]
    - courier_agent 등의 CRLF 이중 치환으로 인해 <!-- [PROJECT_LOCAL_RULES_BELOW] --> 하단이나 인계장에
      \r\r\n 또는 2줄 이상 연속 빈 줄이 발생하면 텍스트 손실 0%로 즉시 1줄 간격으로 자동 압축·복구합니다.
    - AGENTS.md 전체 줄 수가 650줄(시스템 프롬프트 800줄 제한의 80%)을 초과하면 경보를 출력합니다.
    """
    candidate_roots = [ROOT_DIR]
    for extra in (Path(r"D:\Ghosti"),):
        if extra.exists() and extra not in candidate_roots:
            candidate_roots.append(extra)

    marker = "<!-- [PROJECT_LOCAL_RULES_BELOW] -->"
    for rdir in candidate_roots:
        for rel in (
            "AGENTS.md",
            "docs/SESSION_HANDOVER.md",
            "docs/SESSION_HANDOVER_1.md",
            "docs/SESSION_HANDOVER_2.md",
            "docs/SESSION_HANDOVER_3.md",
            "docs/SESSION_HANDOVER_4.md",
        ):
            fpath = rdir / rel
            if not fpath.exists() or not fpath.is_file():
                continue
            try:
                raw_bytes = fpath.read_bytes()
                has_crcrlf = b"\r\r\n" in raw_bytes
                text = raw_bytes.decode("utf-8", errors="ignore")
                norm_text = text.replace("\r\n", "\n").replace("\r", "\n")

                if rel == "AGENTS.md" and marker in norm_text:
                    head_part, local_part = norm_text.split(marker, 1)
                    collapsed_local = re.sub(r"\n{3,}", "\n\n", local_part.strip())
                    healed_text = head_part + marker + "\n\n" + collapsed_local + "\n"
                else:
                    healed_text = re.sub(r"\n{3,}", "\n\n", norm_text.strip()) + "\n"

                old_lines = len(text.splitlines())
                new_lines = len(healed_text.splitlines())
                if has_crcrlf or old_lines - new_lines >= 5:
                    fpath.write_bytes(healed_text.encode("utf-8"))
                    print(
                        f"🧹 [자동 자가치유] {fpath} 빈 줄 쓰레기 정화 완료 ({old_lines:,}줄 ➔ {new_lines:,}줄)"
                    )
                if rel == "AGENTS.md" and new_lines > 650:
                    print(
                        f"🚨 [AGENTS.md 줄수 경보] {fpath} 현재 {new_lines}줄 (800줄 초과 시 하단 규칙 <truncated> 잘림 위험!)"
                    )
            except Exception:
                pass


def main() -> None:
    auto_heal_agents_and_handover_files()
    merged_now = merge_role_handovers()
    if "--merge-handover" in sys.argv:
        print(f"📋 [1~4귀신 인계장 자동 합본 완료] docs/SESSION_HANDOVER.md ({'갱신됨' if merged_now else '최신 상태'})")
        return
    if len(sys.argv) >= 3 and sys.argv[1] == "--set-title":
        custom_title = " ".join(sys.argv[2:])
        applied = sync_antigravity_session_title(custom_title)
        print(f"🏷️ [세션 제목 변경 완료] {applied or custom_title}")
        return

    applied_title = sync_antigravity_session_title()
    if applied_title:
        print(f"🏷️ [{ROOT_DIR.name} 세션 창 제목 자동 각인] ➔ '{applied_title}'")
    else:
        print(f"🏷️ [{ROOT_DIR.name} 세션 창 제목 확인 완료] ➔ '{derive_session_title()}'")

    active_role = _resolve_active_role()
    is_primary_watcher = active_role == "all" or "1" in active_role
    if is_primary_watcher and POST_OFFICE_DIR.parent.exists():
        try:
            subprocess.run(
                ["git", "pull", "--rebase", "--autostash", "origin", "main"],
                cwd=str(POST_OFFICE_DIR.parent),
                timeout=8,
                capture_output=True,
                creationflags=0x08000000 if os.name == "nt" else 0,
            )
        except Exception:
            pass
    initial_inbox = scan_post_office_files(role=active_role)
    if initial_inbox:
        print("\n" + "📮" * 24)
        print(
            f"🔔 [전사 중앙 우체국 자동 감지] D:\\Secretary\\post_office\\ 에 Ghosti 수신 문서 {len(initial_inbox)}건이 도착해 있습니다!"
        )
        for fname in list(initial_inbox.keys()):
            fpath = claim_post_office_mail_immediately(fname)
            content_preview = fpath.read_text(encoding="utf-8", errors="replace")[:1500]
            print(f"\n📄 파일명: {fpath.name} (1귀신 즉시 선점 읽음 처리 완료)")
            print("-" * 60)
            print(content_preview)
            print("-" * 60)
        print(
            "\n👉 [AI 에이전트 지시] 위 중앙 우체국 문서가 [즉시실행]이면 지체 없이 접목·완결하고, [일반 공문]이면 멀린님께 먼저 보고하세요!"
        )
        print("📮" * 24)
        if "--watch" in sys.argv:
            return
    else:
        print("📮 [전사 중앙 우체국 확인 완료] 새로 도착한 미열람 메시지가 없습니다.")

    baseline_inbox = scan_post_office_files(role=active_role)
    baseline_doctrine_hash = file_md5(DOCTRINE_FILE)
    role_label_map = {
        "1": "role=1 (1귀신 본진: 온보딩·1.귀신비서·Z코어)",
        "2": "role=2 (2귀신: 2.귀신검색·귀신창)",
        "3": "role=3 (3귀신: 3.사진공유·4.내기통합 Pro)",
        "4": "role=4 (4귀신: 5.업무공유 S:)",
        "1,2": "role=1,2 (1·2귀신 복합: 해나라 라인)",
        "3,4": "role=3,4 (3·4귀신 복합: 달나라 라인)",
        "2,3": "role=2,3 (2·3귀신 복합)",
        "1,3": "role=1,3 (1·3귀신 복합)",
        "1,2,3,4": "role=1,2,3,4 (4귀신 전체 복합 감지)",
        "all": "role=all (전체 감지)",
    }
    role_badge = role_label_map.get(active_role, f"role={active_role}")

    seen_bug_ids: Set[str] = set()
    initial_bugs = []
    try:
        import notion_qa

        if (
            not notion_qa.NOTION_TOKEN
            or notion_qa.NOTION_TOKEN.startswith("[여기에")
            or notion_qa.NOTION_TOKEN == "YOUR_NOTION_TOKEN"
        ):
            pass
        else:
            fixing_now = notion_qa.query_bugs_raw(notion_qa.STATUS_FIXING, role=active_role)
            initial_bugs = (
                []
                if ("--watch" in sys.argv and fixing_now)
                else notion_qa.query_bugs_raw(notion_qa.STATUS_DISCOVERED, role=active_role)
            )
    except Exception:
        pass

    if "--watch" not in sys.argv:
        print(
            f"✅ [{ROOT_DIR.name} 체크인 3중 점검 및 제목 각인 완료 ({role_badge})] (중앙 우체국 미처리 {len(initial_inbox)}건, 노션 발견된 버그 {len(initial_bugs)}건 | 엔터 즉시 전송을 위해 백그라운드 점유 없이 종료)"
        )
        return

    # [문패 미해제 퇴근 0% 강제 관문]:
    # 엔진/공용 브릿지 작업 후 문패를 내리지 않고 감시병을 켜려 하면,
    # 1) 미커밋 엔진 파일 잔존 시 즉시 Exit 1 차단!
    # 2) 커밋·푸시 완료 상태면 0.01초 만에 문패 자동 철거!
    try:
        import zcore_board

        allowed_watch, board_msg = zcore_board.enforce_doorplate_before_watch(active_role)
        if board_msg:
            print(board_msg, flush=True)
        if not allowed_watch:
            sys.exit(1)
    except SystemExit:
        raise
    except Exception:
        pass

    interval_sec = 25
    skip_next = False
    for i, arg in enumerate(sys.argv[1:], start=1):
        if skip_next:
            skip_next = False
            continue
        if arg in ("--role", "--track"):
            skip_next = True
            continue
        if arg.isdigit():
            interval_sec = int(arg)
            break

    print(
        f"👀 [{ROOT_DIR.name} 무토큰 감시병 가동 ({role_badge})] ({interval_sec}초 주기 | AI 토큰 소모 0)\n"
        f"   1) 전사 중앙 우체국: {POST_OFFICE_DIR}\n"
        f"   2) 비서 전사 코딩강령 무소음 해시 갱신(Silent Sync): {DOCTRINE_FILE.name}\n"
        f"   3) 노션 QA 칸반 보드: '발견된 버그' ({role_badge}) 컬럼",
        flush=True,
    )

    # [핵심] WaitMsBeforeAsync=500 백그라운드 전환이 먼저 완료되어 에이전트가 직전 카드 완료 보고를 채팅창에 즉시 출력하고 턴을 끝낼 수 있도록 3초 대기 후 다음 카드를 감지·기상시킵니다!
    time.sleep(3)

    if initial_bugs:
        import notion_qa
        first_bug = initial_bugs[0]
        notion_qa.query_bugs_raw(notion_qa.STATUS_FIXING, role=active_role) or notion_qa.mark_fixing(first_bug["page_id"])
        print("\n" + "🚨" * 24)
        print(
            f"🔔 [노션 QA 대기 버그 감지 — 1건 단위(Single-Piece Flow) 원칙에 따라 1번 카드만 '버그 수정중' 선(先) 이동!] (총 대기 {len(initial_bugs)}건 중 1번째 착수)"
        )
        print(f"\n[1] 📌 제목: {first_bug['title']}")
        print(f"    🆔 카드 ID: {first_bug['page_id']} (➔ '버그 수정중' 이동 완료)")
        print(f"    📝 내용: {first_bug['body']}")
        if len(initial_bugs) > 1:
            print(f"\n⏳ (나머지 대기 버그 {len(initial_bugs) - 1}건은 이번 1번 카드를 완료 보고하고 턴을 종료한 뒤 다음 턴에서 순차 착수합니다)")
        print(
            "\n🚨 [멀린님 절대 철칙 — 한꺼번에 처리 금지!] 오직 위 1개 카드만 수정·빌드·푸시·'재테스트 대기' 전환(complete_bug)한 뒤, "
            "절대 같은 턴에서 다음 카드를 이어서 고치지 말고 즉시 감시병(--watch) 재기동 후 멀린님께 간단 완료 보고를 올리고 턴을 종료하세요!"
        )
        print("🚨" * 24, flush=True)
        return

    tick = 0
    while True:
        # 1귀신(본진)은 로컬 우체국을 1초 주기로 초고속 스캔하여 도착 즉시 선점 읽음 처리(2호·3호 중복 감지 원천 차단)하고,
        # 노션 API는 기존처럼 interval_sec(기본 25초) 주기로만 호출합니다.
        sub_steps = max(1, interval_sec) if is_primary_watcher else 1
        step_sleep = (interval_sec / sub_steps) if is_primary_watcher else interval_sec
        for _ in range(sub_steps):
            time.sleep(step_sleep)
            try:
                import zcore_board

                my_turn_entry = zcore_board.check_queue_turn_ready(active_role)
                if my_turn_entry:
                    print("\n" + "🪧" * 24)
                    print(
                        f"🔔 [엔진 작업 문패 공석 감지 — 대기 1순위 [{active_role}귀신] 차례 도착!]\n"
                        f"   • 대기해 둔 작업: {my_turn_entry.get('task')}\n"
                        f"👉 앞사람 작업과 커밋이 완료되어 문패가 비었습니다! 지금 즉시 `git pull --rebase` 후 `python zcore_board.py claim --role {active_role} ...`로 문패를 걸고 작업을 진행하세요!"
                    )
                    print("🪧" * 24, flush=True)
                    return
            except Exception:
                pass
            current_inbox = scan_post_office_files(role=active_role)
            new_or_changed_inbox = [
                fname
                for fname, fhash in current_inbox.items()
                if fname not in baseline_inbox or baseline_inbox[fname] != fhash
            ]
            if new_or_changed_inbox:
                print("\n" + "📮" * 24)
                print(
                    f"🔔 [전사 중앙 우체국 신규 도착 — 1귀신 선점 접수!] D:\\Secretary\\post_office\\ 에 {len(new_or_changed_inbox)}건의 Ghosti 수신 문서가 도착했습니다!"
                )
                for fname in new_or_changed_inbox:
                    fpath = claim_post_office_mail_immediately(fname)
                    if not fpath.exists():
                        continue
                    try:
                        content_preview = fpath.read_text(encoding="utf-8", errors="replace")[:2000]
                    except FileNotFoundError:
                        continue
                    print(f"\n📄 파일명: {fpath.name} (선점 읽음 처리 완료)")
                    print("-" * 60)
                    print(content_preview)
                    print("-" * 60)
                print(
                    "\n👉 [AI 에이전트 지시] 수신 공문이 [즉시실행]이면 지체 없이 Ghosti에 접목·완결 후 답변 메일을 발송하세요!"
                )
                print("📮" * 24, flush=True)
                concurrent_bugs = check_notion_new_bugs(set(), role=active_role)
                if concurrent_bugs:
                    import notion_qa
                    if not notion_qa.query_bugs_raw(notion_qa.STATUS_FIXING, role=active_role):
                        notion_qa.mark_fixing(concurrent_bugs[0]["page_id"])
                        print(f"\n🚨 [동시 감지 버그 선(先) 이동 완료] {concurrent_bugs[0]['title']} ({concurrent_bugs[0]['page_id']}) ➔ '버그 수정중'", flush=True)
                return

        tick += 1
        if tick <= 6:
            sync_antigravity_session_title()

        if is_primary_watcher:
            if POST_OFFICE_DIR.parent.exists():
                try:
                    subprocess.run(
                        ["git", "pull", "--rebase", "--autostash", "origin", "main"],
                        cwd=str(POST_OFFICE_DIR.parent),
                        timeout=8,
                        capture_output=True,
                        creationflags=0x08000000 if os.name == "nt" else 0,
                    )
                except Exception:
                    pass
            current_doctrine_hash = file_md5(DOCTRINE_FILE)
            if current_doctrine_hash and current_doctrine_hash != baseline_doctrine_hash:
                # [Silent Sync] 전사 코딩강령 해시 변경 시 강제 기상 폐지 -> 무소음 해시 갱신만 수행
                baseline_doctrine_hash = current_doctrine_hash

        new_bugs = check_notion_new_bugs(seen_bug_ids, role=active_role)
        if new_bugs:
            import notion_qa
            first_bug = new_bugs[0]
            notion_qa.query_bugs_raw(notion_qa.STATUS_FIXING, role=active_role) or notion_qa.mark_fixing(first_bug["page_id"])
            print("\n" + "🚨" * 24)
            print(
                f"🔔 [노션 QA 신규 버그 자동 감지 — 1건 단위(Single-Piece Flow) 원칙에 따라 1번 카드만 '버그 수정중' 즉시 이동!] (총 {len(new_bugs)}건 중 1번째 착수)"
            )
            print(f"\n[1] 📌 제목: {first_bug['title']}")
            print(f"    🆔 카드 ID: {first_bug['page_id']} (➔ '버그 수정중' 이동 완료)")
            print(f"    📝 내용: {first_bug['body']}")
            if len(new_bugs) > 1:
                print(f"\n⏳ (나머지 대기 버그 {len(new_bugs) - 1}건은 이번 1번 카드를 완료 보고하고 턴을 종료한 뒤 다음 턴에서 순차 착수합니다)")
            print(
                "\n🚨 [멀린님 절대 철칙 — 한꺼번에 처리 금지!] 오직 위 1개 카드만 수정·빌드·푸시·'재테스트 대기' 전환(complete_bug)한 뒤, "
                "절대 같은 턴에서 다음 카드를 이어서 고치지 말고 즉시 감시병(--watch) 재기동 후 멀린님께 간단 완료 보고를 올리고 턴을 종료하세요!"
            )
            print("🚨" * 24, flush=True)
            return


if __name__ == "__main__":
    main()
