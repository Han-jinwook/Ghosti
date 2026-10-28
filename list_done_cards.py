# -*- coding: utf-8 -*-
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
if res.status_code == 200:
    results = res.json().get("results", [])
    print(f"Total '완료' cards: {len(results)}")
    for i, page in enumerate(results):
        props = page.get("properties", {})
        title_prop = props.get(SCHEMA.title_prop_name, {}).get("title", [])
        title = extract_plain_text(title_prop)
        app_prop = props.get("앱", {}).get("select", {})
        app_name = app_prop.get("name", "") if app_prop else ""
        last_edited = page.get("last_edited_time", "")
        created_time = page.get("created_time", "")
        print(f"[{i+1}] [{app_name}] {title} (ID: {page['id']}, LastEdited: {last_edited})")
else:
    print("Failed:", res.status_code, res.text)
