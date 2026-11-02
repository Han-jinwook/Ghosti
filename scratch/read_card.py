import sys, os
sys.path.insert(0, ".")
import notion_qa

cid = "409f9ffd-2c1d-807f-8822-eb96b6289d8f"
print("=== BODY OF 409f9ffd-2c1d-807f-8822-eb96b6289d8f ===")
print(notion_qa.fetch_page_body_text(cid))
