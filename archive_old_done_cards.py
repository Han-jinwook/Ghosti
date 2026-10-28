# -*- coding: utf-8 -*-
import os
import json
from datetime import datetime
import requests
from notion_qa import get_headers, DATABASE_ID, NOTION_API_BASE, SCHEMA, extract_plain_text

SCHEMA.detect(DATABASE_ID)
url = f"{NOTION_API_BASE}/databases/{DATABASE_ID}/query"

filter_payload = {
    "property": SCHEMA.status_prop_name,
    "status" if SCHEMA.status_prop_type == "status" else "select": {"equals": "완료"}
}

payload = {
    "filter": filter_payload,
    "sorts": [{"timestamp": "last_edited_time", "direction": "descending"}],
    "page_size": 100
}

res = requests.post(url, headers=get_headers(), json=payload, timeout=15)
if res.status_code != 200:
    print("Failed to query done cards:", res.status_code, res.text)
    exit(1)

results = res.json().get("results", [])
print(f"Total '완료' cards found: {len(results)}")

keep_count = 7
to_keep = results[:keep_count]
to_archive = results[keep_count:]

print(f"\n[유지할 최신 완료 카드 {len(to_keep)}개]:")
for i, p in enumerate(to_keep):
    props = p.get("properties", {})
    t = extract_plain_text(props.get(SCHEMA.title_prop_name, {}).get("title", []))
    print(f"  {i+1}. {t} (ID: {p['id']})")

print(f"\n[보관함으로 숨길 완료 카드 {len(to_archive)}개]:")
backup_list = []
for i, p in enumerate(to_archive):
    props = p.get("properties", {})
    t = extract_plain_text(props.get(SCHEMA.title_prop_name, {}).get("title", []))
    app_val = props.get("앱", {}).get("select", {})
    app_name = app_val.get("name", "") if app_val else ""
    print(f"  {i+1}. [{app_name}] {t} (ID: {p['id']})")
    backup_list.append({
        "page_id": p["id"],
        "title": t,
        "app": app_name,
        "last_edited_time": p.get("last_edited_time"),
        "url": p.get("url")
    })

# 1. 백업 파일 저장
os.makedirs("poc/results", exist_ok=True)
backup_file = "poc/results/archived_done_cards_backup.json"
with open(backup_file, "w", encoding="utf-8") as f:
    json.dump({
        "archived_at": datetime.now().isoformat(),
        "total_archived": len(backup_list),
        "cards": backup_list
    }, f, ensure_ascii=False, indent=2)
print(f"\n💾 백업 완료: {backup_file}")

# 2. 아카이브 실행 (archived: True)
success_count = 0
for card in to_archive:
    pid = card["id"]
    patch_url = f"{NOTION_API_BASE}/pages/{pid}"
    patch_res = requests.patch(
        patch_url,
        headers=get_headers(),
        json={"archived": True},
        timeout=15
    )
    if patch_res.status_code == 200:
        success_count += 1
    else:
        print(f"❌ 아카이브 실패 (ID: {pid}): {patch_res.status_code} {patch_res.text}")

print(f"\n🎉 총 {success_count}/{len(to_archive)}개 카드가 노션 보관함(Archived)으로 안전하게 이동되었습니다!")
