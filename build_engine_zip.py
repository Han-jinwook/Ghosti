import os
import sys
import zipfile
import time
from pathlib import Path

import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = Path(__file__).resolve().parent
DIST_EXE = ROOT / "universal_z_core" / "os_agent" / "dist" / "Merlin_Z_Core_Setup.exe"
PUBLIC_DIR = ROOT / "public"
PUBLIC_ZIP = PUBLIC_DIR / "Merlin_Z_Core.zip"

def add_file_to_zip(z: zipfile.ZipFile, arcname: str, data: bytes):
    zinfo = zipfile.ZipInfo(arcname, date_time=time.localtime()[:6])
    zinfo.flag_bits |= 0x800  # UTF-8 filename encoding
    zinfo.compress_type = zipfile.ZIP_DEFLATED
    zinfo.external_attr = 0o755 << 16
    z.writestr(zinfo, data)

def main():
    if not DIST_EXE.exists():
        print(f"Error: {DIST_EXE} does not exist!")
        sys.exit(1)

    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

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
    with zipfile.ZipFile(PUBLIC_ZIP, "w", compression=zipfile.ZIP_DEFLATED) as z:
        with open(DIST_EXE, "rb") as f:
            add_file_to_zip(z, "Merlin_Z_Core_Setup.exe", f.read())
        add_file_to_zip(z, "Merlin_Z_Core_실행.bat", bat_content.encode("utf-8"))
        add_file_to_zip(z, "안내_README.txt", readme_content.encode("utf-8"))
        test_photos_dir = ROOT / "test_photos"
        if test_photos_dir.exists():
            for img_p in sorted(test_photos_dir.iterdir()):
                if img_p.is_file() and img_p.suffix.lower() in (".jpg", ".jpeg", ".png"):
                    add_file_to_zip(z, f"sample_photos_301/{img_p.name}", img_p.read_bytes())

    size_mb = round(PUBLIC_ZIP.stat().st_size / 1024 / 1024, 2)
    print(f"✅ Merlin_Z_Core.zip created successfully in public/! Size: {size_mb} MB")

if __name__ == "__main__":
    main()
