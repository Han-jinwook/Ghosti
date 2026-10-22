#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
제트아이 (Z-Eye) 비동기 노션 QA 자동화 파이프라인 CLI & 무토큰 감시 데몬 (notion_qa.py)
- 핵심 기능:
  1. fetch_bugs(): 노션 칸반 보드에서 상태가 '발견된 버그'인 티켓의 ID, 제목, 본문 내용을 조회하여 출력
  2. complete_bug(page_id, guide_text):
     - 해당 카드의 상태를 '재테스트 대기'로 변경
     - 비개발자 테스터(알바생)가 전문용어 없이 바로 따라 할 수 있는 친절한 말투로
       카드 본문 맨 아래에 "[AI 수정 완료 및 재테스트 지시]\\n" + guide_text 블록을 추가
     - 완료 직후 자동으로 남은 '발견된 버그' 목록을 조회하여 다음 버그 수정 여부를 브리핑
  3. watch_bugs(interval_sec):
     - 평상시 AI 토큰 소모 0원으로 파이썬이 백그라운드에서 노션 보드를 감시하다가,
       새로운 '발견된 버그'가 올라오는 순간 즉시 감지하여 에이전트를 깨우는 감시 모드
"""

import os
import sys
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

try:
    import requests
except ImportError:
    print("❌ 'requests' 라이브러리가 설치되어 있지 않습니다.")
    print("👉 설치 명령어: pip install requests")
    sys.exit(1)


# =====================================================================
# 1. 연동 설정 (현재 프로젝트 폴더의 .env.local 로드)
# =====================================================================
def load_env_local(env_path: str = ".env.local") -> None:
    """현재 프로젝트 폴더의 .env.local 파일에서 NOTION_TOKEN과 NOTION_DATABASE_ID를 로드합니다."""
    if not os.path.exists(env_path):
        return
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for raw_line in f:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                key = k.strip()
                val = v.strip().strip('"').strip("'")
                if key and val and not os.environ.get(key):
                    os.environ[key] = val
    except Exception:
        pass


load_env_local()

DATABASE_ID: str = os.getenv("NOTION_DATABASE_ID", "400f9ffd2c1d807fa3e7c705d2b0ceab").strip()
NOTION_TOKEN: str = os.getenv(
    "NOTION_TOKEN",
    "[여기에 아까 발급받은 secret_ 또는 ntn_ 토큰 붙여넣기]",
).strip()
NOTION_VERSION: str = "2022-06-28"
NOTION_API_BASE: str = "https://api.notion.com/v1"

# 칸반 보드 상태 컬럼값 정의
STATUS_DISCOVERED = "발견된 버그"
STATUS_IN_PROGRESS = "수정 중"
STATUS_READY_FOR_QA = "재테스트 대기"
STATUS_DONE = "완료"


# =====================================================================
# 2. 노션 API 공통 헬퍼 & 데이터베이스 스키마 자동 감지기
# =====================================================================
def get_headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }


def ensure_valid_token() -> None:
    global NOTION_TOKEN
    if (
        not NOTION_TOKEN
        or NOTION_TOKEN.startswith("[여기에")
        or NOTION_TOKEN == "YOUR_NOTION_TOKEN"
    ):
        print("\n⚠️  [알림] NOTION_TOKEN이 아직 설정되지 않았습니다.")
        print("   💡 .env.local 파일에 NOTION_TOKEN=ntn_... 형태로 넣어두시면 자동 로드됩니다.")
        user_token = input("🔑 Notion Token 입력: ").strip()
        if not user_token:
            print("❌ 토큰이 입력되지 않아 종료합니다.")
            sys.exit(1)
        NOTION_TOKEN = user_token


class NotionKanbanSchema:
    """
    노션 데이터베이스의 실제 속성(Property) 이름과 타입을 자동 감지합니다.
    카드(Page) ID가 잘못 입력된 경우에도 상위 데이터베이스 ID를 자동 추적합니다.
    """

    def __init__(self) -> None:
        self.title_prop_name: str = "이름"
        self.status_prop_name: str = "상태"
        self.status_prop_type: str = "status"  # 'status' 또는 'select'
        self._loaded: bool = False

    def detect(self, database_id: str) -> None:
        global DATABASE_ID
        if self._loaded:
            return
        url = f"{NOTION_API_BASE}/databases/{database_id}"
        res = requests.get(url, headers=get_headers(), timeout=15)
        if res.status_code == 400 and "is a page, not a database" in res.text:
            page_res = requests.get(
                f"{NOTION_API_BASE}/pages/{database_id}", headers=get_headers(), timeout=15
            )
            if page_res.status_code == 200:
                parent_db = page_res.json().get("parent", {}).get("database_id")
                if parent_db:
                    DATABASE_ID = parent_db
                    res = requests.get(
                        f"{NOTION_API_BASE}/databases/{DATABASE_ID}",
                        headers=get_headers(),
                        timeout=15,
                    )
        if res.status_code != 200:
            raise RuntimeError(
                f"데이터베이스 조회 실패 (HTTP {res.status_code}): {res.text}\n"
                "👉 1) NOTION_TOKEN이 정확한지, 2) 해당 노션 데이터베이스 우측 상단 [...] -> [연결(Connections)]에 통합 앱이 추가되었는지 확인해 주세요."
            )

        data = res.json()
        props: Dict[str, Any] = data.get("properties", {})

        for prop_name, prop_meta in props.items():
            if prop_meta.get("type") == "title":
                self.title_prop_name = prop_name
                break

        preferred_names = ["상태", "Status", "status", "진행 상태", "진행상태", "단계"]
        found_status = False

        for candidate in preferred_names:
            if candidate in props and props[candidate].get("type") in ("status", "select"):
                self.status_prop_name = candidate
                self.status_prop_type = props[candidate]["type"]
                found_status = True
                break

        if not found_status:
            for prop_name, prop_meta in props.items():
                if prop_meta.get("type") == "status":
                    self.status_prop_name = prop_name
                    self.status_prop_type = "status"
                    found_status = True
                    break

        if not found_status:
            for prop_name, prop_meta in props.items():
                if prop_meta.get("type") == "select":
                    self.status_prop_name = prop_name
                    self.status_prop_type = "select"
                    found_status = True
                    break

        self._loaded = True


SCHEMA = NotionKanbanSchema()


def extract_plain_text(rich_text_list: List[Dict[str, Any]]) -> str:
    """Notion rich_text 배열에서 순수 문자열만 추출합니다."""
    return "".join(item.get("plain_text", "") for item in (rich_text_list or []))


def fetch_page_body_text(page_id: str) -> str:
    """카드(Page) 내부의 본문 블록(children)을 조회하여 읽기 좋은 텍스트로 변환합니다."""
    url = f"{NOTION_API_BASE}/blocks/{page_id}/children?page_size=100"
    res = requests.get(url, headers=get_headers(), timeout=15)
    if res.status_code != 200:
        return "(본문 블록 조회 실패)"

    blocks = res.json().get("results", [])
    lines: List[str] = []

    for blk in blocks:
        btype = blk.get("type", "")
        bdata = blk.get(btype, {})

        if btype in (
            "paragraph",
            "heading_1",
            "heading_2",
            "heading_3",
            "quote",
            "callout",
        ):
            text = extract_plain_text(bdata.get("rich_text", []))
            if text.strip():
                lines.append(text)
        elif btype in ("bulleted_list_item", "numbered_list_item"):
            text = extract_plain_text(bdata.get("rich_text", []))
            if text.strip():
                lines.append(f"• {text}")
        elif btype == "to_do":
            text = extract_plain_text(bdata.get("rich_text", []))
            checked = "☑" if bdata.get("checked") else "☐"
            if text.strip():
                lines.append(f"{checked} {text}")
        elif btype == "code":
            text = extract_plain_text(bdata.get("rich_text", []))
            if text.strip():
                lines.append(f"[코드] {text}")
        elif btype == "image":
            img_info = bdata.get("file") or bdata.get("external") or {}
            img_url = img_info.get("url", "")
            caption = extract_plain_text(bdata.get("caption", []))
            label = f"[첨부 이미지{': ' + caption if caption else ''}]"
            lines.append(f"{label} {img_url[:70]}..." if img_url else label)
        elif btype == "divider":
            lines.append("----------------------------------------")

    return "\n".join(lines).strip() if lines else "(본문 내용 없음)"


# =====================================================================
# 3. 핵심 요청 함수 1: fetch_bugs()
# =====================================================================
def query_bugs_raw(target_status: str = STATUS_DISCOVERED) -> List[Dict[str, str]]:
    """출력 없이指定된 상태의 카드 배열만 조용히 반환합니다 (감시 데몬 겸용)."""
    ensure_valid_token()
    SCHEMA.detect(DATABASE_ID)

    url = f"{NOTION_API_BASE}/databases/{DATABASE_ID}/query"
    if SCHEMA.status_prop_type == "status":
        filter_payload = {
            "property": SCHEMA.status_prop_name,
            "status": {"equals": target_status},
        }
    else:
        filter_payload = {
            "property": SCHEMA.status_prop_name,
            "select": {"equals": target_status},
        }

    payload = {
        "filter": filter_payload,
        "sorts": [{"timestamp": "created_time", "direction": "ascending"}],
    }

    res = requests.post(url, headers=get_headers(), json=payload, timeout=15)
    if res.status_code != 200:
        return []

    results = res.json().get("results", [])
    bugs: List[Dict[str, str]] = []
    for idx, page in enumerate(results, start=1):
        page_id: str = page.get("id", "")
        props: Dict[str, Any] = page.get("properties", {})
        title_obj = props.get(SCHEMA.title_prop_name, {})
        title_text = extract_plain_text(title_obj.get("title", [])) or "(제목 없음)"
        body_text = fetch_page_body_text(page_id)
        bugs.append(
            {
                "index": str(idx),
                "page_id": page_id,
                "title": title_text,
                "body": body_text,
                "url": page.get("url", ""),
            }
        )
    return bugs


def fetch_bugs(target_status: str = STATUS_DISCOVERED) -> List[Dict[str, str]]:
    """
    상태가 '발견된 버그'(기본값)인 카드를 조회하여
    터미널에 카드 ID, 제목, 본문 내용을 출력하고 리스트로 반환합니다.
    """
    bugs = query_bugs_raw(target_status)

    print("\n" + "=" * 72)
    print(f"🐛 [Z-Eye 노션 QA 보드] '{target_status}' 티켓 목록 (총 {len(bugs)}건)")
    print("=" * 72)

    if not bugs:
        print(f"✨ 현재 '{target_status}' 상태인 카드가 없습니다!")
        print("=" * 72)
        return []

    for bug in bugs:
        print(f"\n[{bug['index']}] 📌 제목: {bug['title']}")
        print(f"    🆔 카드 ID: {bug['page_id']}")
        print("    📝 본문 내용:")
        for line in bug["body"].splitlines():
            print(f"       {line}")
        print("-" * 72)

    return bugs


# =====================================================================
# 4. 핵심 요청 함수 2: complete_bug(page_id, guide_text)
#    (비개발자 테스터 눈높이 맞춤 문구 + 다음 대기 버그 자동 제안)
# =====================================================================
def complete_bug(page_id: str, guide_text: str) -> bool:
    """
    1) 해당 카드의 상태를 '재테스트 대기'로 변경하고,
    2) 카드 본문 맨 아래에 "[AI 수정 완료 및 재테스트 지시]\\n" + guide_text 내용을 블록으로 추가하며,
    3) 남은 '발견된 버그'가 있으면 다음 번호 버그를 이어서 수정할지 자동으로 브리핑합니다.
    """
    ensure_valid_token()
    SCHEMA.detect(DATABASE_ID)

    clean_page_id = page_id.strip()

    # 1단계: 카드의 상태를 '재테스트 대기'로 변경
    page_url = f"{NOTION_API_BASE}/pages/{clean_page_id}"
    if SCHEMA.status_prop_type == "status":
        status_update = {SCHEMA.status_prop_name: {"status": {"name": STATUS_READY_FOR_QA}}}
    else:
        status_update = {SCHEMA.status_prop_name: {"select": {"name": STATUS_READY_FOR_QA}}}

    patch_res = requests.patch(
        page_url,
        headers=get_headers(),
        json={"properties": status_update},
        timeout=15,
    )

    if patch_res.status_code != 200:
        print(
            f"❌ 카드 상태 변경 실패 (HTTP {patch_res.status_code}): {patch_res.text}"
        )
        return False

    # 2단계: 카드 본문 맨 아래에 "[AI 수정 완료 및 재테스트 지시]\n" + guide_text 블록 추가
    blocks_url = f"{NOTION_API_BASE}/blocks/{clean_page_id}/children"
    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    full_instruction_text = f"[AI 수정 완료 및 재테스트 지시]\n{guide_text.strip()}"

    children_payload = [
        {"object": "block", "type": "divider", "divider": {}},
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {
                            "content": f"[AI 수정 완료 및 재테스트 지시] ({timestamp_str})\n"
                        },
                        "annotations": {"bold": True, "color": "green"},
                    },
                    {
                        "type": "text",
                        "text": {"content": guide_text.strip()[:1900]},
                    },
                ]
            },
        },
    ]

    block_res = requests.patch(
        blocks_url,
        headers=get_headers(),
        json={"children": children_payload},
        timeout=15,
    )

    if block_res.status_code != 200:
        print(
            f"⚠️ 상태는 '{STATUS_READY_FOR_QA}'로 변경되었으나 본문 블록 추가에 실패했습니다 (HTTP {block_res.status_code}): {block_res.text}"
        )
        return False

    print("\n✅ [노션 자동 반영 완료!]")
    print(f"   • 카드 ID : {clean_page_id}")
    print(f"   • 상태 변경: '{STATUS_READY_FOR_QA}' 🚀")
    print(f"   • 테스터 안내문:\n     {full_instruction_text.replace(chr(10), chr(10) + '     ')}")

    # 3단계: 남은 '발견된 버그' 자동 확인 후 다음 작업 제안 (추가 토큰 0)
    remaining_bugs = query_bugs_raw(STATUS_DISCOVERED)
    if remaining_bugs:
        next_bug = remaining_bugs[0]
        print("\n" + "🔔" * 24)
        print(
            f"👉 [자동 감지] 아직 대기 중인 다음 버그가 {len(remaining_bugs)}건 있습니다!"
        )
        print(f"   • 다음 버그 제목: {next_bug['title']}")
        print(f"   • 다음 버그 내용: {next_bug['body']}")
        print("   💬 이어서 이 버그도 바로 수정할까요?")
        print("🔔" * 24)
    else:
        print("\n🎉 현재 '발견된 버그' 컬럼의 모든 티켓 처리가 끝났습니다!")

    return True


def update_bug_status(page_id: str, new_status: str) -> bool:
    """카드의 상태만 원하는 단계(예: '수정 중', '발견된 버그')로 빠르게 변경합니다."""
    ensure_valid_token()
    SCHEMA.detect(DATABASE_ID)
    page_url = f"{NOTION_API_BASE}/pages/{page_id.strip()}"
    if SCHEMA.status_prop_type == "status":
        status_update = {SCHEMA.status_prop_name: {"status": {"name": new_status}}}
    else:
        status_update = {SCHEMA.status_prop_name: {"select": {"name": new_status}}}

    res = requests.patch(
        page_url, headers=get_headers(), json={"properties": status_update}, timeout=15
    )
    if res.status_code == 200:
        print(f"✅ 카드({page_id}) 상태가 '{new_status}'(으)로 변경되었습니다.")
        return True
    print(f"❌ 상태 변경 실패 (HTTP {res.status_code}): {res.text}")
    return False


# =====================================================================
# 5. 무토큰 백그라운드 감시 모드: watch_bugs(interval_sec)
#    (평상시 AI 토큰 소모 0원 -> 새 버그 등록 시에만 즉시 종료하며 에이전트 호출)
# =====================================================================
def watch_bugs(interval_sec: int = 15) -> None:
    """
    파이썬이 혼자 노션 API만 무료로 폴링하다가,
    '발견된 버그' 컬럼에 새로운 카드가 올라오는 순간 즉시 출력하고 종료하여
    AI 에이전트가 자동으로 깨어나 "새 버그 수정할까요?"라고 물어보게 합니다.
    """
    ensure_valid_token()
    SCHEMA.detect(DATABASE_ID)

    print(
        f"👀 [무토큰 파이썬 감시병 가동] {interval_sec}초 간격으로 노션 '발견된 버그' 컬럼을 감시합니다 (평상시 AI 토큰 소모 0)..."
    )
    seen_ids: Set[str] = set()

    while True:
        try:
            bugs = query_bugs_raw(STATUS_DISCOVERED)
            new_bugs = [b for b in bugs if b["page_id"] not in seen_ids]
            if new_bugs:
                print("\n" + "🚨" * 24)
                print(
                    f"🔔 [새 버그 자동 감지!] 노션 보드에 '발견된 버그' {len(new_bugs)}건이 확인되었습니다!"
                )
                for idx, b in enumerate(new_bugs, start=1):
                    print(f"\n[{idx}] 📌 제목: {b['title']}")
                    print(f"    🆔 카드 ID: {b['page_id']}")
                    print(f"    📝 내용: {b['body']}")
                print("\n💬 멀린님, 방금 감지된 위 버그를 바로 수정할까요?")
                print("🚨" * 24)
                return
        except KeyboardInterrupt:
            print("\n👋 감시 모드를 종료합니다.")
            return
        except Exception as e:
            print(f"⚠️ 일시적 네트워크 재시도 대기 중: {e}")

        time.sleep(interval_sec)


# =====================================================================
# 6. 터미널 인터랙션 CLI 루프
# =====================================================================
def resolve_target_bug(
    user_key: str, current_bugs: List[Dict[str, str]]
) -> Tuple[Optional[str], Optional[str]]:
    key = user_key.strip()
    if not key:
        return None, None

    for bug in current_bugs:
        if bug["index"] == key:
            return bug["page_id"], bug["title"]

    normalized_key = key.replace("-", "").lower()
    for bug in current_bugs:
        norm_id = bug["page_id"].replace("-", "").lower()
        if norm_id == normalized_key or norm_id.startswith(normalized_key):
            return bug["page_id"], bug["title"]

    if len(normalized_key) >= 32:
        return key, "(직접 입력된 카드)"

    return None, None


def run_cli() -> None:
    print("\n" + "━" * 72)
    print("🤖 Z-Eye × Notion 무인 QA 파이프라인 CLI 가동")
    print(f"   • 연동 Database ID: {DATABASE_ID}")
    print("━" * 72)

    current_bugs = fetch_bugs(STATUS_DISCOVERED)

    while True:
        print("\n[명령어 안내]")
        print("  • r 또는 Enter : '발견된 버그' 목록 새로고침 (fetch_bugs)")
        print("  • c [번호/ID]  : 수정 완료 처리 -> '재테스트 대기' 변경 + 쉬운 재테스트 안내 추가")
        print("  • w            : 무토큰 실시간 감시 모드 켜기 (새 버그 등록 시 즉시 알림)")
        print("  • p [번호/ID]  : 해당 카드를 '수정 중' 상태로 변경")
        print("  • q            : 종료")

        cmd_raw = input("\n👉 명령 입력: ").strip()
        if not cmd_raw or cmd_raw.lower() == "r":
            current_bugs = fetch_bugs(STATUS_DISCOVERED)
            continue

        if cmd_raw.lower() in ("q", "quit", "exit"):
            print("👋 Z-Eye 노션 QA CLI를 종료합니다.")
            break

        if cmd_raw.lower() in ("w", "watch"):
            watch_bugs(15)
            current_bugs = fetch_bugs(STATUS_DISCOVERED)
            continue

        parts = cmd_raw.split(maxsplit=1)
        action = parts[0].lower()
        target_arg = parts[1].strip() if len(parts) > 1 else ""

        if action in ("c", "complete", "done"):
            if not target_arg:
                target_arg = input("   🔢 완료 처리할 카드의 [목록 번호] 또는 [카드 ID] 입력: ").strip()

            page_id, title = resolve_target_bug(target_arg, current_bugs)
            if not page_id:
                print("   ⚠️ 해당하는 카드를 찾지 못했습니다.")
                continue

            print(f"\n   🎯 선택된 카드: {title} ({page_id})")
            print("   💬 테스터(알바생)에게 전달할 쉬운 [재테스트 안내문]을 입력하세요.")
            print("      (여러 줄 입력 가능 — 입력을 마치려면 빈 줄에서 Enter)")

            guide_lines: List[str] = []
            while True:
                line = input("      > ")
                if not line.strip() and guide_lines:
                    break
                if line.strip():
                    guide_lines.append(line)

            guide_text = "\n".join(guide_lines).strip()
            if not guide_text:
                print("   ⚠️ 안내문이 비어 있어 취소되었습니다.")
                continue

            if complete_bug(page_id, guide_text):
                current_bugs = fetch_bugs(STATUS_DISCOVERED)

        elif action in ("p", "progress", "start"):
            if not target_arg:
                target_arg = input("   🔢 '수정 중'으로 바꿀 카드의 [목록 번호] 또는 [카드 ID] 입력: ").strip()
            page_id, title = resolve_target_bug(target_arg, current_bugs)
            if not page_id:
                print("   ⚠️ 해당하는 카드를 찾지 못했습니다.")
                continue
            update_bug_status(page_id, STATUS_IN_PROGRESS)

        else:
            page_id, title = resolve_target_bug(cmd_raw, current_bugs)
            if page_id:
                print(f"\n   🎯 선택된 카드: {title} ({page_id})")
                guide_text = input("   💬 쉬운 재테스트 안내문 입력 (1줄): ").strip()
                if guide_text:
                    if complete_bug(page_id, guide_text):
                        current_bugs = fetch_bugs(STATUS_DISCOVERED)
            else:
                print("   ❓ 알 수 없는 명령어입니다. ('r', 'c 1', 'w', 'p 1', 'q' 중 입력)")


if __name__ == "__main__":
    if len(sys.argv) >= 2:
        subcmd = sys.argv[1].lower()
        if subcmd == "fetch":
            fetch_bugs(STATUS_DISCOVERED)
            sys.exit(0)
        elif subcmd == "watch":
            interval = int(sys.argv[2]) if len(sys.argv) >= 3 else 15
            watch_bugs(interval)
            sys.exit(0)
        elif subcmd == "status" and len(sys.argv) >= 4:
            update_bug_status(sys.argv[2], sys.argv[3])
            sys.exit(0)
        elif subcmd == "complete" and len(sys.argv) >= 4:
            target_id = sys.argv[2]
            guide = " ".join(sys.argv[3:])
            ok = complete_bug(target_id, guide)
            sys.exit(0 if ok else 1)

    run_cli()
