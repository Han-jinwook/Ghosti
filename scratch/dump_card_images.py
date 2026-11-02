import sys, os
sys.path.insert(0, ".")
import requests, notion_qa

cid = "409f9ffd-2c1d-807f-8822-eb96b6289d8f"
notion_qa.ensure_valid_token()
blocks = notion_qa._fetch_page_top_blocks(cid)
img_idx = 0
for b in blocks:
    btype = b.get("type")
    print(f"Block {b.get('id')} ({btype}):")
    if btype == "image":
        url = (b.get("image", {}).get("file") or b.get("image", {}).get("external") or {}).get("url", "")
        print(f"  IMAGE URL: {url}")
        if url:
            img_idx += 1
            r = requests.get(url, timeout=15)
            out_path = f"scratch/card_img_{img_idx}.png"
            with open(out_path, "wb") as f:
                f.write(r.content)
            print(f"  Saved to {out_path}")
    else:
        bdata = b.get(btype, {})
        txt = notion_qa.extract_plain_text(bdata.get("rich_text", []))
        print(f"  TEXT: {txt}")
