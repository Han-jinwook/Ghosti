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
def load_env_local(env_path: str = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env.local")) -> None:
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

# 칸반 보드 상태 컬럼값 정의 (좌 -> 우 순서: 테스트 미션 -> 발견된 버그 -> 수정 중 -> 재테스트 대기 -> 완료)
STATUS_MISSION = "테스트 미션"
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
    for page in results:
        page_id: str = page.get("id", "")
        props: Dict[str, Any] = page.get("properties", {})
        title_obj = props.get(SCHEMA.title_prop_name, {})
        title_text = extract_plain_text(title_obj.get("title", [])) or "(제목 없음)"
        app_select = (props.get("앱", {}).get("select") or {}).get("name", "")
        # 센스톡·썬드리머 카드는 해당 담당 에이전트가 처리하도록 제외
        if app_select in ("센스톡", "썬드리머") or any(k in title_text for k in ("[센스톡]", "[썬드리머]", "센스톡", "썬드리머")):
            continue
        body_text = fetch_page_body_text(page_id)
        if not app_select and any(k in body_text for k in ("센스톡", "썬드리머", "sensetalk", "sundreamer")):
            continue
        bugs.append(
            {
                "index": str(len(bugs) + 1),
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


def create_mission(
    title: str,
    steps_text: str,
    initial_status: str = STATUS_MISSION,
) -> Optional[str]:
    """
    멀린님과 AI가 새 기능/UI를 만든 직후, 비개발자 알바생(테스터)이
    '오늘 뭐 테스트할까요?'라고 물어보지 않도록 노션 보드 맨 앞 '테스트 미션' 칸에
    친절한 체크리스트 미션 카드를 자동 생성합니다.
    """
    ensure_valid_token()
    SCHEMA.detect(DATABASE_ID)

    clean_title = title.strip()
    if not clean_title.startswith("🎯"):
        if "[제트아이]" in clean_title:
            clean_title = f"🎯 {clean_title}"
        else:
            clean_title = f"🎯 [제트아이] {clean_title}"

    if SCHEMA.status_prop_type == "status":
        status_prop = {"status": {"name": initial_status}}
    else:
        status_prop = {"select": {"name": initial_status}}

    # 줄바꿈 또는 번호로 구분된 체크리스트 블록 생성
    raw_lines = [
        ln.strip()
        for ln in steps_text.replace("\\n", "\n").splitlines()
        if ln.strip()
    ]

    children_blocks: List[Dict[str, Any]] = [
        {
            "object": "block",
            "type": "callout",
            "callout": {
                "icon": {"type": "emoji", "emoji": "😊"},
                "rich_text": [
                    {
                        "type": "text",
                        "text": {
                            "content": "안녕하세요! 새로 추가·개선된 화면이 잘 작동하는지 아래 순서대로 편하게 눌러보며 확인 부탁드립니다."
                        },
                        "annotations": {"bold": True},
                    }
                ],
            },
        }
    ]

    for step_line in raw_lines:
        children_blocks.append(
            {
                "object": "block",
                "type": "to_do",
                "to_do": {
                    "rich_text": [
                        {"type": "text", "text": {"content": step_line[:1900]}}
                    ],
                    "checked": False,
                },
            }
        )

    children_blocks.extend(
        [
            {"object": "block", "type": "divider", "divider": {}},
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [
                        {
                            "type": "text",
                            "text": {
                                "content": "✅ 모두 잘 작동하면: 이 카드를 [완료] 칸으로 옮겨주세요!\n🚨 안 되거나 어색한 부분이 있으면: 이 글 맨 아래에 어떤 점이 이상한지(가능하면 캡처 사진과 함께) 적어주시고, 카드를 [발견된 버그] 칸으로 옮겨주시면 AI가 자동으로 감지해 바로 고치겠습니다. 감사합니다!"
                            },
                            "annotations": {"color": "gray"},
                        }
                    ]
                },
            },
        ]
    )

    payload = {
        "parent": {"database_id": DATABASE_ID},
        "properties": {
            SCHEMA.title_prop_name: {
                "title": [{"type": "text", "text": {"content": clean_title}}]
            },
            SCHEMA.status_prop_name: status_prop,
            "앱": {"select": {"name": "제트아이"}},
        },
        "children": children_blocks,
    }

    res = requests.post(
        f"{NOTION_API_BASE}/pages",
        headers=get_headers(),
        json=payload,
        timeout=15,
    )

    if res.status_code != 200:
        print(f"❌ 테스트 미션 카드 생성 실패 (HTTP {res.status_code}): {res.text}")
        return None

    new_page_id = res.json().get("id", "")
    print("\n🎯 [알바생용 노션 테스트 미션 카드 생성 완료!]")
    print(f"   • 미션 제목: {clean_title}")
    print(f"   • 배치 컬럼: '{initial_status}'")
    print(f"   • 카드 ID  : {new_page_id}")
    return new_page_id


def update_todo_block_text(block_id: str, new_text: str, checked: bool = False) -> bool:
    """개별 to_do 블록의 텍스트를 업데이트하며, 기체크(checked=True) 여부를 보존합니다."""
    ensure_valid_token()
    url = f"{NOTION_API_BASE}/blocks/{block_id.strip()}"
    payload = {
        "to_do": {
            "rich_text": [{"type": "text", "text": {"content": new_text.strip()[:1900]}}],
            "checked": bool(checked),
        }
    }
    res = requests.patch(url, headers=get_headers(), json=payload, timeout=15)
    return res.status_code == 200


def update_page_title(page_id: str, new_title: str) -> bool:
    """노션 카드(Page)의 제목을 업데이트합니다."""
    ensure_valid_token()
    SCHEMA.detect(DATABASE_ID)
    url = f"{NOTION_API_BASE}/pages/{page_id.strip()}"
    payload = {
        "properties": {
            SCHEMA.title_prop_name: {
                "title": [{"type": "text", "text": {"content": new_title.strip()}}]
            }
        }
    }
    res = requests.patch(url, headers=get_headers(), json=payload, timeout=15)
    return res.status_code == 200


def sync_all_zeye_missions() -> bool:
    """
    기존 [제트아이] 테스트 미션 카드의 기체크(☑) 항목은 100% 보존하면서,
    미체크(☐) 항목을 최신 화면/구체적 수치/연관 UI·UX 변화 기준으로 정밀 업데이트하고
    노션 스타일 동적 토글 전 메뉴 검증 미션 카드를 출제합니다.
    """
    ensure_valid_token()
    SCHEMA.detect(DATABASE_ID)

    # 1. Card 1 업데이트 (기체크 0건, 6개 항목 모두 최신 UI/구체 수치/연관 UI 변화로 정밀 재작성)
    card1_id = "401f9ffd-2c1d-818a-a5e1-e9104eb4ac21"
    update_page_title(
        card1_id,
        "🎯 [제트아이] 왼쪽 3대 메뉴 & 백지 도화지 투시검색 · 연관 화면 반응 점검 (구체 수치 지정)",
    )
    card1_updates = [
        (
            "401f9ffd-2c1d-81dd-8d25-cae565a4d42e",
            "1. 화면 왼쪽 메뉴에서 [내 기기], [사진 공유 (가족·모임)], [업무 공유] 3대 메뉴를 차례대로 눌렀을 때: ① 선택한 메뉴 바로 아래에 전용 하위 메뉴 4개씩이 펼쳐지는지, ② 오른쪽 메인 화면 상단 제목과 내용이 즉시 해당 화면으로 바뀌는지 확인해 주세요.",
        ),
        (
            "401f9ffd-2c1d-8178-a777-f0f5f8383eae",
            "2. 왼쪽 메뉴 맨 위 '제트아이 Z-Eye' 오른쪽의 [«] 버튼을 눌렀을 때: ① 왼쪽 메뉴바가 완전히 접히면서 오른쪽 메인 화면이 가로로 넓어지는지, ② 왼쪽 위에 새로 생긴 [☰ 메뉴] 버튼을 다시 누르면 원래대로 왼쪽 메뉴바가 펼쳐지는지 확인해 주세요.",
        ),
        (
            "401f9ffd-2c1d-81f6-961f-d161caebab4c",
            "3. 왼쪽 메뉴에서 [사진 공유 (가족·모임)]을 누른 뒤: ① 위쪽 [패밀리 라운지]의 [🏠 우리집] / [🏡 본가(친가)] / [🌸 처가(친정)] 3개 방 버튼을 차례대로 눌렀을 때 오른쪽 상단 방 제목과 인물 여권 바의 호칭(예: 진욱(방장) ➔ 큰아들 ➔ 큰사위)이 동시에 바뀌는지, ② 이어서 [동호회 · 소모임], [동창회 · 반창회], [초·중·고 반 · 동아리]를 눌렀을 때도 오른쪽 화면이 각 모임 화면으로 즉시 전환되는지 확인해 주세요.",
        ),
        (
            "401f9ffd-2c1d-8131-9991-c965082b0ddf",
            "4. 왼쪽 메뉴 [내 기기 ➔ 투시검색]을 눌렀을 때: 처음에는 사진 목록이 쏟아지지 않고 깔끔한 백지 도화지 상태였다가, 검색창 바로 아래의 [🎬 동영상 42개], [🖼️ 사진 550장], [📄 문서 128건] 3개 버튼을 각각 눌렀을 때: ① 선택한 버튼 테두리가 민트색으로 켜지고, ② 아래쪽에 해당 개수(동영상 42개 / 사진 550장 / 문서 128건)의 카드 목록과 오른쪽 위 [▲ 접기] 버튼이 동시에 나타나는지 확인해 주세요.",
        ),
        (
            "401f9ffd-2c1d-818c-a2a1-cb9768fdcb78",
            "5. 목록이 펼쳐진 상태에서 오른쪽 위의 [▲ 접기] 버튼(또는 현재 켜져 있는 카테고리 버튼 한 번 더 클릭)을 눌렀을 때: ① 아래에 펼쳐졌던 카드 목록이 전부 사라지고, ② 3개 버튼(동영상 42개 / 사진 550장 / 문서 128건)의 선택 표시도 꺼지면서 처음처럼 깨끗한 백지 도화지 화면으로 돌아오는지 확인해 주세요.",
        ),
        (
            "401f9ffd-2c1d-81de-81b9-c7e402411e2f",
            "6. 왼쪽 메뉴 [업무 공유 ➔ 문서·도면 본문 검색]으로 이동한 뒤: ① 검색창 아래 빠른 검색어 중 '철거 단가 4,850,000원'을 클릭했을 때 왼쪽 파일 목록이 [7건 ➔ 1건(표준단가표_v4.xlsx)]으로 줄어들면서 동시에 화면 오른쪽에 [📄 문서 내용 미리보기] 창이 열리고 표 안에 '4,850,000원'이 보이는지, ② 미리보기 창 오른쪽 위 [✕ 닫기]와 검색창 안의 [✕ 지우기]를 누르면 미리보기 창이 닫히고 왼쪽 목록이 다시 [7건] 전체 너비로 복구되는지 확인해 주세요.",
        ),
    ]
    for bid, txt in card1_updates:
        update_todo_block_text(bid, txt, checked=False)

    # 2. Card 2 업데이트 (테스터가 체크한 ☑ 2건은 100% 보존, 미체크 ☐ 2건만 구체 수치·연관 UI로 업데이트)
    update_todo_block_text(
        "403f9ffd-2c1d-8110-9de9-faaba2514d20",
        "1. 왼쪽 메뉴 맨 위가 깔끔한 [내 기기]로 표시되고, [내 기기 ➔ 투시검색 / 클린몬스터 진단] 화면에서는 상단에 유료 결제 유도 배너가 일체 뜨지 않으며, 왼쪽 메뉴에서 [사진 공유 (가족·모임)]으로 이동했을 때만 화면 맨 위에 [개인 (기본) : 언제나 0원 · '혼자 쓸 땐 언제나 0원, 함께 쓸 땐 방장 한 분만'] 안내 바와 [🔥 선착순 100명, 10년 방장 마스터권 보기 →] 버튼이 나타나는지 확인해 주세요.",
        checked=False,
    )
    update_todo_block_text(
        "403f9ffd-2c1d-8142-8157-c1e59a879f15",
        "4. 오른쪽 위 [💎 요금제 및 멤버 초대] 버튼을 눌러 창을 열었을 때: ① 맨 아래쪽에 옛날 '10% 추천 리워드' 문구가 완전히 사라지고 [💌 초대장 보내기 & 앱 공유하기] 카드와 코인 잔액 표시(1,250 코인)만 깔끔하게 남아 있는지, ② 그 안의 [📋 카톡·문자 초대 링크 복사] 버튼을 눌렀을 때 버튼 글자가 즉시 [✓ 초대 링크 복사 완료!]로 바뀌는지 확인해 주세요.",
        checked=False,
    )

    # 3. Card 3 업데이트 (테스터가 체크한 ☑ 1·2번은 100% 보존, 미체크 ☐ 3·4번 구체화 + 테스터 메모 답변 추가)
    card3_id = "403f9ffd-2c1d-8112-b8a7-dad38dfe09df"
    update_page_title(
        card3_id,
        "🎯 [제트아이] [QA 미션] 공유방 v2.1 데이터 흐름(원본 동기화·업로더 삭제·업무방 문서 읽기전용 잠금·OS 기본 휴지통) 점검",
    )
    update_todo_block_text(
        "403f9ffd-2c1d-8158-8769-e275f5b67aed",
        "3. [사진 공유 (가족·모임) ➔ 새 사진 정리함]으로 이동한 뒤, 화면 아래쪽 [📥 최근 올라온 사진 (8장)] 목록에서: ① 각 사진 왼쪽 위에 올린 사람 이름표(예: 은숙(아내), 진욱(방장))가 표시되는지, ② 첫 번째 사진 오른쪽 아래 빨간색 [🗑️ 삭제 (올린 본인/방장)] 버튼을 눌렀을 때 사진 개수가 즉시 [8장 ➔ 7장]으로 줄어들고 바로 위에 [↩️ 1초 실행 취소 (방금 삭제한 사진 되돌리기)] 버튼이 생기는지, ③ 그 [↩️ 1초 실행 취소] 버튼을 누르면 삭제했던 사진이 다시 복구되어 [7장 ➔ 8장]으로 돌아오는지 확인해 주세요.",
        checked=False,
    )
    update_todo_block_text(
        "403f9ffd-2c1d-8195-b955-e795a1a4989c",
        "4. [업무 공유 ➔ 문서·도면 본문 검색]에서 주황색 [🔒 박과장 수정 중] 배지가 붙은 첫 번째 파일(표준단가표_v4.xlsx)을 클릭했을 때: ① 오른쪽에 미리보기 창이 열리며 '🔒 현재 [박과장]님이 사용 중입니다. 읽기 모드로 열립니다.' 안내와 노란색 [👁️ 읽기 모드로 열기] 단일 버튼이 뜨는지(※ 최신 기획 확정: 사본 저장은 엑셀 내에서 처리하므로 읽기 모드 버튼 1개만 뜨는 것이 정상입니다!), ② 바로 옆의 [잠금 시뮬레이션 해제] 버튼을 누르면 오른쪽 창이 초록색 '🔓 현재 사용 중인 팀원이 없습니다 — 바로 편집 가능'으로 바뀌고 동시에 왼쪽 파일 목록의 배지도 [🔒 박과장 수정 중 ➔ 🔓 수정 가능]으로 함께 바뀌는지 확인해 주세요.",
        checked=False,
    )
    requests.patch(
        f"{NOTION_API_BASE}/blocks/{card3_id}/children",
        headers=get_headers(),
        json={
            "children": [
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {
                                    "content": "💡 [AI 안내] 아래 적어주신 '읽기모드로 열기 버튼만 활성화됨' 메모 확인했습니다! 최신 기획에서 사본 저장은 엑셀 프로그램 안에서 직접 처리하고 화면에는 [👁️ 읽기 모드로 열기] 버튼 1개만 깔끔하게 보여주도록 확정되었습니다. 위 4번 항목처럼 옆의 [잠금 시뮬레이션 해제] 버튼을 눌렀을 때 왼쪽 목록 배지(🔒 ➔ 🔓)와 오른쪽 안내가 동시에 바뀌는지만 확인 후 체크해 주시면 됩니다. 감사합니다! 😊"
                                },
                                "annotations": {"bold": True, "color": "green"},
                            }
                        ]
                    },
                }
            ]
        },
        timeout=15,
    )

    # 4. 신규 Card 4 생성 (전 메뉴 노션 스타일 동적 토글 UI/UX & 연관 숫자 변화 점검)
    card4_title = "[신규 미션] 전 메뉴 노션 스타일 접기/펼치기(토글) 반응 & 클린몬스터·대기실·설정몬스터 연관 숫자 변화 점검"
    card4_steps = "\n".join(
        [
            "1. [내 기기 ➔ 클린몬스터 진단] 1초 진단 펼침 확인: 처음 화면에서는 상단 박스에 [🚀 1초 진단 시작하기] 버튼 1개와 아래쪽 3개 바로가기 카드(① 투시검색 / ② 클린몬스터 / ③ 설정몬스터)만 깔끔하게 보이다가, [🚀 1초 진단 시작하기]를 누르면 약 1초 뒤 ① 버튼이 [🔄 다시 진단하기]로 바뀌고, ② 카드 안쪽에 '내 기기 전체 보유 파일(사진 550장 · 영상 42개 · 문서 128건)'과 '이번 1초 진단 샘플 해부 완료(영상 3개 · 사진 100장 · 문서 15건)' 박스가 새로 펼쳐지는지 확인해 주세요.",
            "2. [내 기기 ➔ 클린몬스터 진단] 2단계 안전 검증(5장 이동 ➔ 5장 복원) 연쇄 반응 확인: 함께 펼쳐진 [🛡️ 안전 검증 체험] 박스에서 [1단계: 샘플 5장 휴지통 이동해보기] 버튼을 눌렀을 때 ① 1단계 버튼이 초록색 [✓ 1단계 완료 (5장 휴지통 이동됨)]으로 바뀌고, ② 옆의 [2단계: 방금 보낸 5장 1초 만에 되돌리기] 버튼이 하늘색으로 반짝이며 활성화되고 아래에 이동된 파일명이 뜨는지, ③ 이어서 [2단계] 버튼을 누르면 [✓ 2단계 완료 (1초 원복됨)]으로 바뀌며 초록색 '🎉 안전 검증 완료!' 안내 박스가 나타나는지 확인해 주세요.",
            "3. [내 기기 ➔ 클린몬스터] 기기 종합검진 토글 & [✓ N/3 항목 선택됨] 배지 연동 확인: 왼쪽 메뉴 [내 기기 ➔ 클린몬스터]로 이동한 뒤, 두 번째 박스 제목 줄인 [▾ 💬 기기 종합검진 & 대화형 맞춤 정리] 바를 클릭했을 때 박스가 부드럽게 접히고(검진 항목 펼치기 ▾), 다시 클릭하면 펼쳐지는지(접기 ▴) 확인해 주세요. 펼쳐진 상태에서 안쪽 3개 카드(① 모바일 바탕화면 / ② PC 바탕화면 / ③ 상주 보안모듈)의 선택 버튼을 하나씩 누를 때마다 위쪽 제목 줄에 민트색 배지가 [✓ 1/3 항목 선택됨] ➔ [✓ 2/3 항목 선택됨] ➔ [✓ 3/3 항목 선택됨]으로 실시간 올라가는지, 그리고 아래 질문창에 '바탕화면'이라고 입력 후 [💬 물어보기]를 누르면 상담사 답변이 바탕화면 아카이브 안내로 즉시 바뀌는지 확인해 주세요.",
            "4. [내 기기 ➔ 클린몬스터] 4대 카테고리 탭 전환 & 사진 정리 시 상단·하단 숫자 동시 변화 확인: 화면 중간의 4개 카테고리 탭(① 중복·연사 선택 / ② 주차·영수증·메모 / ③ 스크린샷·캡처 / ④ 흔들림·오촬영)을 차례대로 눌렀을 때 ① 중복된 두 번째 탭 바 없이 선택한 탭 테두리가 민트색으로 바뀌며 아래 사진 목록이 해당 장수만큼 바뀌는지, ② 목록에서 사진 1장을 클릭해 선택한 뒤 오른쪽 위 [🗑️ 선택 1장 휴지통 이동] 버튼을 눌렀을 때 그 사진이 목록에서 사라짐과 동시에 상단 제목의 '정리 후보 N장' 숫자가 1장 줄어들고, 상단 [↩️ 1초 즉시 되돌리기 (Undo)] 알림 바와 맨 아래 [▾ 🗑️ OS 기본 [휴지통] 이동 내역 (N건)]의 건수가 1건 올라가는지, ③ [↩️ 1초 즉시 되돌리기](또는 하단 휴지통 내역의 [↩️ 1초 복원])를 누르면 사진과 상단·하단 숫자가 모두 원래대로 돌아오는지 확인해 주세요.",
            "5. [사진 공유 (가족·모임)] 핵심 기능·요금제 토글 & [🚀 공유방 시작하기] 동적 펼침 확인: 왼쪽 메뉴 [사진 공유 (가족·모임) ➔ 가족·모임 공유 시작하기]를 눌렀을 때 ① 상단 제목 오른쪽의 [핵심 기능 접기 ▲] 버튼과 하단의 [요금제 접기 ▲] 줄을 클릭할 때마다 3칸 설명 카드와 요금제 표가 각각 깔끔하게 접혔다 펼쳐지는지, ② 중간의 [🚀 공유방 시작하기] 버튼을 누르면 약 1초 뒤 버튼이 [🔄 다시 체험하기] 1개로 바뀌면서 아래에 숨겨져 있던 '👑 Step 1. 가족 얼굴 여권 자동 장착'과 '📡 Step 2. 3초 얼굴 레이더 스캔' 영역이 새로 펼쳐지는지, ③ Step 2의 [📡 3초 레이더 수합 ➔ 대기실 전송 체험 →] 버튼을 누르면 화면이 자동으로 [새 사진 정리함]으로 이동하는지 확인해 주세요.",
            "6. [사진 공유 ➔ 새 사진 정리함] 옛날 사진 스티커 토글 & '1992년 경주 수학여행' 스티커 생성·부착 연쇄 확인: 화면 중간의 노란 테두리 박스 제목 줄([🎞️ 촬영 날짜 없는 옛날 종이 사진 · 연도·장소 스티커 붙이기])을 클릭했을 때 내용이 접혔다 펼쳐지는지 확인해 주세요. 펼쳐진 상태에서 '① 첫 사진 키워드 입력' 칸 3곳에 각각 연도 '1992', 장소 '경주 수학여행', 계절 '가을'을 입력하고 [+ 스틱(Chip) 자동 생성] 버튼을 눌렀을 때 ① 바로 아래 '② 생성된 스틱' 줄에 [🏷️ 1992년 가을], [🏷️ 1992년 경주 수학여행] 버튼이 새로 생기고 선택되는지, ② 이어서 아래 '#1. 1989년 설악산 흔들바위 앞 반 단체 사진' 카드의 [👆 1초 부착] 버튼을 눌렀을 때 사진 오른쪽 아래 깜빡이던 노란색 [❓ 언제/어디인가요?] 배지가 사라지고 [🗓️ 1992년 가을]로 바뀌며, 카드 안에 '🏷️ 1992년 가을' 스티커와 '🔍 자동매칭: 1992 · 92년 · 가을 · 9월 · 10월 · 11월' 검색어가 자동으로 추가되는지 확인해 주세요.",
            "7. [내 기기 ➔ 설정몬스터] 실물 OS 패널 및 하단 2대 관리 메뉴 토글 확인: 왼쪽 메뉴 [내 기기 ➔ 설정몬스터]로 이동한 뒤 ① 설정몬스터 화면 아래쪽 초록색 배지가 있는 [🟢 Z-코어 실물 OS 직결됨] 제목 줄을 클릭했을 때 내 PC 실측 카드 3종과 3초 문서 스캔 영역이 접혔다 펼쳐지는지, ② 더 아래에 있는 [🔄 폰↔PC 프라이빗 싱크 & 로컬 폴더]와 [🛡️ 데스크톱 연동 가이드 · 탈퇴 데이터 원칙 & 스토어 심사 모드] 2개 박스가 처음에는 깔끔하게 한 줄로 접혀 있다가 클릭하면 상세 설정 카드들이 아래로 펼쳐지고, 접혀 있는 상태에서도 오른쪽의 [⚡ 지금 일치시키기] 버튼이 바로 눌러지는지 확인해 주세요.",
        ]
    )
    create_mission(card4_title, card4_steps)
    print("\n✅ [전 미션 카드 정밀 업데이트(기체크 ☑ 보존) 및 신규 미션 출제 완료!]")
    return True


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
        elif subcmd == "mission" and len(sys.argv) >= 4:
            mission_title = sys.argv[2]
            mission_steps = " ".join(sys.argv[3:])
            created_id = create_mission(mission_title, mission_steps)
            sys.exit(0 if created_id else 1)
        elif subcmd == "sync-missions":
            ok = sync_all_zeye_missions()
            sys.exit(0 if ok else 1)

    run_cli()
