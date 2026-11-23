#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
귀신Key (GhostKey) 무토큰 3중 통합 점검 및 세션 창 제목 자동 각인 스크립트 (z_core_watcher.py)
- 평상시 AI 토큰 소모: 0 (파이썬 로컬 프로세스만 동작)
- 점검/감시 대상 3가지:
  1. [전사 중앙 우체국 감지] D:\\Secretary\\post_office\\ 내 GhostKey / ALL 수신 문서(.md) 도착 여부
  2. [전사 강령 무소음 동기화] D:\\GhostKey\\docs\\멀린코딩강령_v20261020.md 해시 추적 (Silent Sync)
  3. [노션 QA 버그 감지] 노션 칸반 보드(400f9ffd2c1d807fa3e7c705d2b0ceab) 내 '[귀신키]'/'[귀신Key]'/'[GhostKey]' '발견된 버그' 티켓 여부
"""

import hashlib
import os
import re
import sqlite3
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parent
POST_OFFICE_DIR = Path(r"D:\Secretary\post_office")
DOCTRINE_FILE = ROOT_DIR / "docs" / "멀린코딩강령_v20261020.md"
HANDOVER_FILE = ROOT_DIR / "docs" / "SESSION_HANDOVER.md"
AGY_DIR = Path.home() / ".gemini" / "antigravity"
AGY_DB = AGY_DIR / "conversation_summaries.db"
AGY_ANNOTATIONS = AGY_DIR / "annotations"

NOTION_API_BASE = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"
DEFAULT_DB_ID = "400f9ffd2c1d807fa3e7c705d2b0ceab"


def _load_notion_credentials() -> tuple[str, str]:
    token = os.environ.get("NOTION_TOKEN", "").strip()
    db_id = os.environ.get("NOTION_DATABASE_ID", DEFAULT_DB_ID).strip()
    for env_cand in (ROOT_DIR / ".env.local", Path(r"D:\Ghosti\.env.local")):
        if token and not token.startswith("[여기에"):
            break
        if env_cand.exists():
            try:
                for raw in env_cand.read_text(encoding="utf-8", errors="ignore").splitlines():
                    ln = raw.strip()
                    if not ln or ln.startswith("#") or "=" not in ln:
                        continue
                    k, v = ln.split("=", 1)
                    k, v = k.strip(), v.strip().strip('"').strip("'")
                    if k == "NOTION_TOKEN" and v:
                        token = v
                    elif k == "NOTION_DATABASE_ID" and v:
                        db_id = v
            except Exception:
                pass
    return token, db_id or DEFAULT_DB_ID


def derive_session_title(explicit_title: str | None = None) -> str:
    if explicit_title and explicit_title.strip():
        return explicit_title.strip()[:15]
    if HANDOVER_FILE.exists():
        try:
            text = HANDOVER_FILE.read_text(encoding="utf-8", errors="ignore")
            m = re.search(r"세션(?:\s*창)?\s*제목[^:\n]*:\s*([^\r\n]+)", text)
            if m:
                val = m.group(1).strip().strip("`*")
                if val and not val.startswith("("):
                    return val[:15]
        except Exception:
            pass
    try:
        res = subprocess.run(
            ["git", "log", "-n", "10", "--pretty=format:%s"],
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
                if not msg or "멀린코딩강령" in msg:
                    continue
                msg = re.sub(r"^(?:feat|fix|chore|docs|refactor)(?:\([^)]+\))?:\s*", "", msg, flags=re.I)
                return msg[:15]
    except Exception:
        pass
    return "귀신Key 점검"


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


def scan_post_office_files() -> Dict[str, str]:
    try:
        if not POST_OFFICE_DIR.exists():
            return {}
        receipts_dir = POST_OFFICE_DIR / "receipts"
        result: Dict[str, str] = {}
        for p in sorted(POST_OFFICE_DIR.glob("*.md")):
            if p.name.lower() in ("readme.md", ".gitkeep") or p.name.startswith("(읽음)"):
                continue
            parts = p.name.split("_")
            prefix = parts[0].strip("[]").lower()
            sender = parts[1].strip("[]").lower() if len(parts) > 1 else ""
            if sender == "ghostkey" or prefix not in ("ghostkey", "all"):
                continue
            if prefix == "all":
                if (receipts_dir / f"{p.stem}.GhostKey.read").exists() or (
                    receipts_dir / f"{p.name}.GhostKey.read"
                ).exists():
                    continue
            result[p.name] = file_md5(p)
        return result
    except Exception:
        return {}


def claim_post_office_mail_immediately(fname: str) -> Path:
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
            (receipts_dir / f"{fpath.stem}.GhostKey.read").write_text(now_str, encoding="utf-8")
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


def query_ghostkey_notion_bugs(target_status: str = "발견된 버그") -> List[Dict[str, Any]]:
    token, db_id = _load_notion_credentials()
    if not token or token.startswith("[여기에"):
        return []
    try:
        import requests

        headers = {
            "Authorization": f"Bearer {token}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        }
        db_res = requests.get(f"{NOTION_API_BASE}/databases/{db_id}", headers=headers, timeout=12)
        if db_res.status_code != 200:
            return []
        props = db_res.json().get("properties", {})
        title_prop = "이름"
        status_prop = "상태"
        status_type = "status"
        for pname, pmeta in props.items():
            if pmeta.get("type") == "title":
                title_prop = pname
            if pname in ("상태", "Status", "진행 상태") and pmeta.get("type") in ("status", "select"):
                status_prop = pname
                status_type = pmeta["type"]

        raw_opts = props.get(status_prop, {}).get(status_type, {}).get("options", [])
        opt_names = {o.get("name", "") for o in raw_opts if o.get("name")}
        resolved_status = target_status
        if target_status == "발견된 버그":
            for cand in ("발견 버그", "발견된 버그", "버그/요청"):
                if cand in opt_names:
                    resolved_status = cand
                    break
        elif target_status == "버그 수정중":
            for cand in ("버그 수정중", "수정 중", "수정중"):
                if cand in opt_names:
                    resolved_status = cand
                    break

        flt = {
            "property": status_prop,
            status_type: {"equals": resolved_status},
        }
        q_res = requests.post(
            f"{NOTION_API_BASE}/databases/{db_id}/query",
            headers=headers,
            json={"filter": flt, "sorts": [{"timestamp": "created_time", "direction": "ascending"}]},
            timeout=15,
        )
        if q_res.status_code != 200:
            return []
        matched: List[Dict[str, Any]] = []
        for page in q_res.json().get("results", []):
            p_props = page.get("properties", {})
            t_list = p_props.get(title_prop, {}).get("title", [])
            title_txt = "".join(it.get("plain_text", "") for it in (t_list or []))
            app_sel = ((p_props.get("앱") or {}).get("select") or {}).get("name", "")
            low = f"{title_txt} {app_sel}".lower()
            if not any(k in low for k in ("귀신키", "귀신key", "ghostkey")):
                continue
            page_id = page.get("id", "")
            b_res = requests.get(
                f"{NOTION_API_BASE}/blocks/{page_id}/children?page_size=100",
                headers=headers,
                timeout=12,
            )
            body_lines = []
            if b_res.status_code == 200:
                for blk in b_res.json().get("results", []):
                    btype = blk.get("type", "")
                    bdata = blk.get(btype, {})
                    rtxt = "".join(it.get("plain_text", "") for it in (bdata.get("rich_text") or []))
                    if rtxt.strip():
                        body_lines.append(rtxt.strip())
            matched.append(
                {
                    "page_id": page_id,
                    "title": title_txt,
                    "body": "\n".join(body_lines) or "(본문 내용 없음)",
                    "status_prop": status_prop,
                    "status_type": status_type,
                }
            )
        return matched
    except Exception:
        return []


def mark_notion_card_fixing(bug: Dict[str, Any]) -> None:
    token, _ = _load_notion_credentials()
    if not token:
        return
    try:
        import requests

        headers = {
            "Authorization": f"Bearer {token}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        }
        status_prop = bug.get("status_prop", "상태")
        status_type = bug.get("status_type", "status")
        payload = {"properties": {status_prop: {status_type: {"name": "버그 수정중"}}}}
        requests.patch(
            f"{NOTION_API_BASE}/pages/{bug['page_id']}",
            headers=headers,
            json=payload,
            timeout=12,
        )
    except Exception:
        pass


def main() -> None:
    if len(sys.argv) >= 3 and sys.argv[1] == "--set-title":
        custom_title = " ".join(sys.argv[2:])
        applied = sync_antigravity_session_title(custom_title)
        print(f"🏷️ [세션 제목 변경 완료] {applied or custom_title}")
        return

    applied_title = sync_antigravity_session_title()
    if applied_title:
        print(f"🏷️ [GhostKey 세션 창 제목 자동 각인] ➔ '{applied_title}'")
    else:
        print(f"🏷️ [GhostKey 세션 창 제목 확인 완료] ➔ '{derive_session_title()}'")

    initial_inbox = scan_post_office_files()
    if initial_inbox:
        print("\n" + "📮" * 20)
        print(
            f"🔔 [전사 중앙 우체국 감지] GhostKey 수신 문서 {len(initial_inbox)}건 도착!"
        )
        for fname in list(initial_inbox.keys()):
            fpath = claim_post_office_mail_immediately(fname)
            preview = fpath.read_text(encoding="utf-8", errors="replace")[:1500]
            print(f"\n📄 파일명: {fpath.name} (읽음 처리 완료)\n" + "-" * 50)
            print(preview)
            print("-" * 50)
        print("📮" * 20)
        if "--watch" in sys.argv:
            return
    else:
        print("📮 [전사 중앙 우체국 확인 완료] 새로 도착한 미열람 메시지가 없습니다.")

    fixing_now = query_ghostkey_notion_bugs("버그 수정중")
    initial_bugs = [] if ("--watch" in sys.argv and fixing_now) else query_ghostkey_notion_bugs("발견된 버그")

    if "--watch" not in sys.argv:
        print(
            f"✅ [GhostKey 체크인 3중 점검 완료] (우체국 미처리 {len(initial_inbox)}건, 노션 [귀신키] 발견된 버그 {len(initial_bugs)}건)"
        )
        return

    interval_sec = 25
    print(
        f"👀 [GhostKey 무토큰 감시병 가동] ({interval_sec}초 주기 | AI 토큰 소모 0)\n"
        f"   1) 전사 중앙 우체국: {POST_OFFICE_DIR} (GhostKey_ / ALL_)\n"
        f"   2) 코딩강령 무소음 동기화: {DOCTRINE_FILE.name}\n"
        f"   3) 노션 QA 보드: '[귀신키]/[귀신Key]' 발견된 버그 컬럼",
        flush=True,
    )

    time.sleep(3)
    if initial_bugs:
        first_bug = initial_bugs[0]
        if not query_ghostkey_notion_bugs("버그 수정중"):
            mark_notion_card_fixing(first_bug)
        print("\n" + "🚨" * 20)
        print(f"🔔 [노션 QA 대기 버그 감지 — 1건 단위 착수!] (총 {len(initial_bugs)}건 중 1번째)")
        print(f"[1] 📌 제목: {first_bug['title']}\n    🆔 ID: {first_bug['page_id']}\n    📝 내용:\n{first_bug['body']}")
        print("🚨" * 20, flush=True)
        return

    baseline_inbox = scan_post_office_files()
    baseline_doctrine_hash = file_md5(DOCTRINE_FILE)

    while True:
        for _ in range(interval_sec):
            time.sleep(1)
            cur_inbox = scan_post_office_files()
            new_inbox = [
                fn for fn, fh in cur_inbox.items() if fn not in baseline_inbox or baseline_inbox[fn] != fh
            ]
            if new_inbox:
                print("\n" + "📮" * 20)
                print(f"🔔 [전사 중앙 우체국 신규 도착!] GhostKey 수신 문서 {len(new_inbox)}건 도착!")
                for fn in new_inbox:
                    fpath = claim_post_office_mail_immediately(fn)
                    print(f"\n📄 파일명: {fpath.name} (읽음 처리 완료)\n" + "-" * 50)
                    print(fpath.read_text(encoding="utf-8", errors="replace")[:2000])
                    print("-" * 50)
                print("📮" * 20, flush=True)
                return

        cur_doc_hash = file_md5(DOCTRINE_FILE)
        if cur_doc_hash and cur_doc_hash != baseline_doctrine_hash:
            baseline_doctrine_hash = cur_doc_hash

        if not query_ghostkey_notion_bugs("버그 수정중"):
            new_bugs = query_ghostkey_notion_bugs("발견된 버그")
            if new_bugs:
                first_bug = new_bugs[0]
                mark_notion_card_fixing(first_bug)
                print("\n" + "🚨" * 20)
                print(f"🔔 [노션 QA 신규 버그 자동 감지 — 1건 단위 착수!] (총 {len(new_bugs)}건 중 1번째)")
                print(
                    f"[1] 📌 제목: {first_bug['title']}\n    🆔 ID: {first_bug['page_id']} (➔ '버그 수정중' 이동 완료)\n    📝 내용:\n{first_bug['body']}"
                )
                print("🚨" * 20, flush=True)
                return


if __name__ == "__main__":
    main()
