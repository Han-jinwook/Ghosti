# -*- coding: utf-8 -*-
import json
import requests
from notion_qa import get_headers, NOTION_API_BASE

backup_file = "poc/results/archived_done_cards_backup.json"
with open(backup_file, "r", encoding="utf-8") as f:
    data = json.load(f)

cards = data.get("cards", [])
print(f"복원할 카드 수: {len(cards)}")

success_count = 0
for card in cards:
    pid = card["page_id"]
    patch_url = f"{NOTION_API_BASE}/pages/{pid}"
    patch_res = requests.patch(
        patch_url,
        headers=get_headers(),
        json={"archived": False},
        timeout=15
    )
    if patch_res.status_code == 200:
        success_count += 1
        print(f"✅ 복원 성공: {card['title']}")
    else:
        print(f"❌ 복원 실패: {card['title']} ({patch_res.status_code})")

print(f"총 {success_count}/{len(cards)}개 복원 완료")
