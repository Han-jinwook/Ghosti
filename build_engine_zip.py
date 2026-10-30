import io
import os
import re
import sys
import time
import zipfile
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parent
DIST_EXE = ROOT / "universal_z_core" / "os_agent" / "dist" / "Merlin_Z_Core_Setup.exe"
PUBLIC_DIR = ROOT / "public"
PUBLIC_ZIP = PUBLIC_DIR / "Merlin_Z_Core.zip"

# 공식 배포용 301장 샘플 사진만 허용 (test_photos 내 개인 촬영본 550장·3GB 유출 원천 차단)
SAMPLE_301_PATTERN = re.compile(
    r"^(BLUR_|DOC_|MEMO_|IMG_2025|PET_|Screenshot_2025|TRV_2025)", re.IGNORECASE
)


import json

def _load_audit_ts_map() -> dict[str, int]:
    audit_path = ROOT / "public" / "poc" / "results" / "corpus_physical_audit.json"
    if not audit_path.exists():
        return {}
    try:
        items = json.loads(audit_path.read_text(encoding="utf-8")).get("items", [])
        return {str(x["f"]): int(x.get("ts") or 0) for x in items if x.get("f")}
    except Exception:
        return {}

AUDIT_TS_MAP = _load_audit_ts_map()

def add_file_to_zip(z: zipfile.ZipFile, arcname: str, data: bytes):
    base_name = arcname.split("/")[-1]
    ts_ms = AUDIT_TS_MAP.get(base_name, 0)
    dt_tuple = time.localtime(ts_ms / 1000.0)[:6] if ts_ms and ts_ms > 946684800000 else time.localtime()[:6]
    zinfo = zipfile.ZipInfo(arcname, date_time=dt_tuple)
    zinfo.flag_bits |= 0x800  # UTF-8 filename encoding
    zinfo.compress_type = zipfile.ZIP_DEFLATED
    zinfo.external_attr = 0o755 << 16
    z.writestr(zinfo, data)


def load_existing_sample_301(zip_path: Path) -> list[tuple[str, bytes]]:
    if not zip_path.exists():
        return []
    preserved: list[tuple[str, bytes]] = []
    try:
        with zipfile.ZipFile(zip_path, "r") as old_z:
            for info in old_z.infolist():
                if info.filename.startswith("sample_photos_301/") and not info.is_dir():
                    base_name = info.filename.split("/", 1)[1]
                    if SAMPLE_301_PATTERN.search(base_name):
                        preserved.append((info.filename, old_z.read(info.filename)))
    except Exception:
        return []
    return preserved


def main():
    if not DIST_EXE.exists():
        print(f"Error: {DIST_EXE} does not exist!")
        sys.exit(1)

    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    preserved_samples = load_existing_sample_301(PUBLIC_ZIP)

    bat_content = """@echo off
chcp 65001 > nul
echo ========================================================
echo  [Merlin Z-Core] 귀신같이 만능 PC 상주 엔진 기동 중...
echo ========================================================
start "" "Merlin_Z_Core_Setup.exe"
echo  성공! 윈도우 시계 옆 트레이 및 로컬 포트 5199에서 실행 중입니다.
echo  귀신같이 웹 브라우저 창으로 돌아가시면 1초 만에 자동 연결됩니다.
timeout /t 3 > nul
exit
"""

    readme_content = """❖ 멀린 Z-코어 (Merlin Z-Core) 사용 안내

1. [Merlin_Z_Core_Setup.exe]를 더블 클릭하여 실행합니다.
2. 실행 후 윈도우 작업표시줄 시계 옆(시스템 트레이)에 Ghosti 아이콘이 생성됩니다.
3. 귀신같이 웹 브라우저(https://ghosti-app.netlify.app) 화면에서 
   우측 상단 배지가 [🟢 Z-코어 5199]로 바뀌며,
   내 컴퓨터 속 사진(301장 등) 및 문서가 0.1초 만에 안전하게 투시 검색됩니다!
"""

    print(f"Creating zip at: {PUBLIC_ZIP}")
    tmp_zip = PUBLIC_ZIP.with_suffix(".tmp.zip")
    sample_count = 0
    with zipfile.ZipFile(tmp_zip, "w", compression=zipfile.ZIP_DEFLATED) as z:
        with open(DIST_EXE, "rb") as f:
            add_file_to_zip(z, "Merlin_Z_Core_Setup.exe", f.read())
        add_file_to_zip(z, "Merlin_Z_Core_실행.bat", bat_content.encode("utf-8"))
        add_file_to_zip(z, "안내_README.txt", readme_content.encode("utf-8"))

        test_photos_dir = ROOT / "test_photos"
        disk_samples = (
            [
                img_p
                for img_p in sorted(test_photos_dir.iterdir())
                if img_p.is_file()
                and img_p.suffix.lower() in (".jpg", ".jpeg", ".png")
                and SAMPLE_301_PATTERN.search(img_p.name)
            ]
            if test_photos_dir.exists()
            else []
        )
        if disk_samples:
            for img_p in disk_samples:
                add_file_to_zip(z, f"sample_photos_301/{img_p.name}", img_p.read_bytes())
                sample_count += 1
        else:
            for arcname, raw_bytes in preserved_samples:
                add_file_to_zip(z, arcname, raw_bytes)
                sample_count += 1

    os.replace(tmp_zip, PUBLIC_ZIP)
    size_mb = round(PUBLIC_ZIP.stat().st_size / 1024 / 1024, 2)
    print(f"✅ Merlin_Z_Core.zip created successfully in public/! Size: {size_mb} MB (sample_photos_301: {sample_count})")


if __name__ == "__main__":
    main()
