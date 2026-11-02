import sys, os
sys.path.insert(0, ".")
import requests, notion_qa

notion_qa.ensure_valid_token()
url = f"{notion_qa.NOTION_API_BASE}/databases/{notion_qa.DATABASE_ID}/query"
res = requests.post(url, headers=notion_qa.get_headers(), json={}, timeout=15)
results = res.json().get("results", [])
print(f"Total cards returned: {len(results)}")
for page in results:
    props = page.get("properties", {})
    title_obj = props.get("태스크명", {}) or props.get("이름", {}) or props.get("제목", {})
    tlist = title_obj.get("title", [])
    title = "".join(x.get("plain_text", "") for x in tlist)
    status_obj = props.get("상태", {})
    status = (status_obj.get("status") or status_obj.get("select") or {}).get("name", "")
    app_obj = props.get("앱", {})
    app = (app_obj.get("select") or {}).get("name", "")
    print(f"[{status}] [{app}] {title} (ID: {page.get('id')})")
