#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
제트아이 (Z-Eye) 비동기 노션 QA 자동화 파이프라인 CLI (notion_qa.py)
- 역할:
  1. fetch_bugs(): 노션 칸반 보드에서 상태가 '발견된 버그'인 티켓의 ID, 제목, 본문 블록 내용을 조회하여 출력
  2. start_bug(page_id): 선택한 버그 티켓의 상태를 '수정 중'으로 변경 (선택 기능)
  3. complete_bug(page_id, guide_text): 티켓 상태를 '재테스트 대기'로 변경하고,
     카드 본문 맨 아래에 "[AI 수정 완료 및 재테스트 지시]\\n" + guide_text 블록을 추가
"""

import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

try:
    import requests
except ImportError:
    print("❌ 'requests' 라이브러리가 설치되어 있지 않습니다.")
    print("👉 터미널에 아래 명령어를 입력해 설치해 주세요:")
    print("   pip install requests")
    sys.exit(1)


# =====================================================================
# 1. 연동 설정 (환경변수 .env.local 우선 로드 + 직접 입력 폴백)
# =====================================================================
def load_env_local(env_path: str = ".env.local") -> None:
    """프로젝트 루트의 .env.local 파일이 존재하면 환경변수로 자동 로드합니다."""
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
                if key and key not in os.environ:
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
        print("   💡 .env.local 파일에 NOTION_TOKEN=ntn_... 형태로 저장해 두거나,")
        print("   지금 아래에 토큰(secret_... 또는 ntn_...)을 붙여넣으시면 바로 작동합니다.")
        user_token = input("🔑 Notion Token 입력: ").strip()
        if not user_token:
            print("❌ 토큰이 입력되지 않아 종료합니다.")
            sys.exit(1)
        NOTION_TOKEN = user_token


class NotionKanbanSchema:
    """
    노션 데이터베이스의 실제 속성(Property) 이름과 타입을 자동 감지합니다.
    - 상태 컬럼 이름이 '상태', 'Status', '진행상태' 중 무엇이든,
      타입이 'status'이든 'select'이든 자동으로 맞춰서 동작합니다.
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
            # 페이지 ID가 들어온 경우 부모 데이터베이스 ID를 자동 추적
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

        # 1) 제목(title) 컬럼 자동 탐색
        for prop_name, prop_meta in props.items():
            if prop_meta.get("type") == "title":
                self.title_prop_name = prop_name
                break

        # 2) 상태(status 또는 select) 컬럼 자동 탐색
        preferred_names = ["상태", "Status", "status", "진행 상태", "진행상태", "단계"]
        found_status = False

        # 우선순위 이름을 먼저 검사
        for candidate in preferred_names:
            if candidate in props and props[candidate].get("type") in ("status", "select"):
                self.status_prop_name = candidate
                self.status_prop_type = props[candidate]["type"]
                found_status = True
                break

        # 없으면 status 타입 -> select 타입 순으로 자동 선택
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
def fetch_bugs(target_status: str = STATUS_DISCOVERED) -> List[Dict[str, str]]:
    """
    상태가 '발견된 버그'(기본값)인 카드를 조회하여
    터미널에 카드 ID, 제목, 본문 내용을 출력하고 리스트로 반환합니다.
    """
    ensure_valid_token()
    SCHEMA.detect(DATABASE_ID)

    url = f"{NOTION_API_BASE}/databases/{DATABASE_ID}/query"

    # 감지된 상태 컬럼 타입(status vs select)에 맞춰 필터 구성
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
        print(f"❌ 버그 목록 조회 실패 (HTTP {res.status_code}): {res.text}")
        return []

    results = res.json().get("results", [])
    bugs: List[Dict[str, str]] = []

    print("\n" + "=" * 72)
    print(f"🐛 [Z-Eye 노션 QA 보드] '{target_status}' 티켓 목록 (총 {len(results)}건)")
    print("=" * 72)

    if not results:
        print(f"✨ 현재 '{target_status}' 상태인 카드가 없습니다!")
        print("=" * 72)
        return []

    for idx, page in enumerate(results, start=1):
        page_id: str = page.get("id", "")
        props: Dict[str, Any] = page.get("properties", {})

        # 제목 추출
        title_obj = props.get(SCHEMA.title_prop_name, {})
        title_text = extract_plain_text(title_obj.get("title", [])) or "(제목 없음)"

        # 본문 블록 추출
        body_text = fetch_page_body_text(page_id)

        bug_info = {
            "index": str(idx),
            "page_id": page_id,
            "title": title_text,
            "body": body_text,
            "url": page.get("url", ""),
        }
        bugs.append(bug_info)

        print(f"\n[{idx}] 📌 제목: {title_text}")
        print(f"    🆔 카드 ID: {page_id}")
        print("    📝 본문 내용:")
        for line in body_text.splitlines():
            print(f"       {line}")
        print("-" * 72)

    return bugs


# =====================================================================
# 4. 핵심 요청 함수 2: complete_bug(page_id, guide_text)
# =====================================================================
def complete_bug(page_id: str, guide_text: str) -> bool:
    """
    1) 해당 카드의 상태를 '재테스트 대기'로 변경하고,
    2) 카드 본문 맨 아래에 "[AI 수정 완료 및 재테스트 지시]\\n" + guide_text 내용을 블록으로 추가합니다.
    """
    ensure_valid_token()
    SCHEMA.detect(DATABASE_ID)

    clean_page_id = page_id.strip()

    # 1단계: 카드의 상태(Status/Select)를 '재테스트 대기'로 변경
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

    # 노션 rich_text 1개당 2000자 제한 안전 처리
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
    print(f"   • 추가 본문:\n     {full_instruction_text.replace(chr(10), chr(10) + '     ')}")
    return True


def update_bug_status(page_id: str, new_status: str) -> bool:
    """카드의 상태만 원하는 단계(예: '수정 중')로 빠르게 변경합니다."""
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
# 5. 터미널 인터랙션 CLI 루프
# =====================================================================
def resolve_target_bug(
    user_key: str, current_bugs: List[Dict[str, str]]
) -> Tuple[Optional[str], Optional[str]]:
    """
    목록 번호(예: '1', '2') 또는 카드 ID(전체/앞자리)를 입력받아 (page_id, title)을 반환합니다.
    """
    key = user_key.strip()
    if not key:
        return None, None

    # 1) 목록 번호('1', '2'...)로 입력한 경우
    for bug in current_bugs:
        if bug["index"] == key:
            return bug["page_id"], bug["title"]

    # 2) 카드 ID 전체 또는 앞자리 prefix로 입력한 경우
    normalized_key = key.replace("-", "").lower()
    for bug in current_bugs:
        norm_id = bug["page_id"].replace("-", "").lower()
        if norm_id == normalized_key or norm_id.startswith(normalized_key):
            return bug["page_id"], bug["title"]

    # 3) 목록 외의 직접 입력된 UUID인 경우 그대로 사용
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
        print("  • c [번호/ID]  : 수정 완료 처리 -> '재테스트 대기' 변경 + 재테스트 지시문 추가 (complete_bug)")
        print("  • p [번호/ID]  : 해당 카드를 '수정 중' 상태로 먼저 변경")
        print("  • a            : 현재 '수정 중'인 카드 목록 보기")
        print("  • q            : 종료")

        cmd_raw = input("\n👉 명령 입력: ").strip()
        if not cmd_raw or cmd_raw.lower() == "r":
            current_bugs = fetch_bugs(STATUS_DISCOVERED)
            continue

        if cmd_raw.lower() in ("q", "quit", "exit"):
            print("👋 Z-Eye 노션 QA CLI를 종료합니다.")
            break

        if cmd_raw.lower() == "a":
            current_bugs = fetch_bugs(STATUS_IN_PROGRESS)
            continue

        parts = cmd_raw.split(maxsplit=1)
        action = parts[0].lower()
        target_arg = parts[1].strip() if len(parts) > 1 else ""

        if action in ("c", "complete", "done"):
            if not target_arg:
                target_arg = input("   🔢 완료 처리할 카드의 [목록 번호] 또는 [카드 ID] 입력: ").strip()

            page_id, title = resolve_target_bug(target_arg, current_bugs)
            if not page_id:
                print("   ⚠️ 해당하는 카드를 찾지 못했습니다. 목록 번호(예: 1)나 정확한 카드 ID를 입력해 주세요.")
                continue

            print(f"\n   🎯 선택된 카드: {title} ({page_id})")
            print("   💬 테스터에게 전달할 [재테스트 지시문]을 입력하세요.")
            print("      (여러 줄 입력 가능 — 입력을 마치려면 빈 줄에서 Enter를 누르세요)")

            guide_lines: List[str] = []
            while True:
                line = input("      > ")
                if not line.strip() and guide_lines:
                    break
                if line.strip():
                    guide_lines.append(line)

            guide_text = "\n".join(guide_lines).strip()
            if not guide_text:
                print("   ⚠️ 지시문이 비어 있어 취소되었습니다.")
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
            print(f"   🛠️ '{title}' 카드를 '{STATUS_IN_PROGRESS}' 상태로 변경합니다...")
            update_bug_status(page_id, STATUS_IN_PROGRESS)

        else:
            # 숫자만 바로 입력한 경우(예: "1")에도 즉시 완료/재테스트 지시 입력으로 연결
            page_id, title = resolve_target_bug(cmd_raw, current_bugs)
            if page_id:
                print(f"\n   🎯 선택된 카드: {title} ({page_id})")
                guide_text = input("   💬 재테스트 지시문 입력 (1줄): ").strip()
                if guide_text:
                    if complete_bug(page_id, guide_text):
                        current_bugs = fetch_bugs(STATUS_DISCOVERED)
            else:
                print("   ❓ 알 수 없는 명령어입니다. ('r', 'c 1', 'p 1', 'q' 중 입력)")


if __name__ == "__main__":
    # CLI 인자로도 즉시 호출 가능하도록 지원:
    # 예: python notion_qa.py fetch
    # 예: python notion_qa.py complete <page_id> "<guide_text>"
    if len(sys.argv) >= 2:
        subcmd = sys.argv[1].lower()
        if subcmd == "fetch":
            fetch_bugs(STATUS_DISCOVERED)
            sys.exit(0)
        elif subcmd == "complete" and len(sys.argv) >= 4:
            target_id = sys.argv[2]
            guide = " ".join(sys.argv[3:])
            ok = complete_bug(target_id, guide)
            sys.exit(0 if ok else 1)

    run_cli()
