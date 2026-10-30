import sys
import os
import zipfile
from pathlib import Path

# 1. merlin_z_core_daemon.py 버전 2.3.3 업데이트
p = Path('universal_z_core/os_agent/merlin_z_core_daemon.py')
text = p.read_text(encoding='utf-8')
if 'CORE_VERSION = "2.3.2"' in text:
    p.write_text(text.replace('CORE_VERSION = "2.3.2"', 'CORE_VERSION = "2.3.3"'), encoding='utf-8')
    print("merlin_z_core_daemon.py updated to 2.3.3")

# 2. zCoreBridge.ts 버전 2.3.3 업데이트
p2 = Path('src/services/zCoreBridge.ts')
text2 = p2.read_text(encoding='utf-8')
if "LATEST_Z_CORE_VERSION = '2.3.2'" in text2:
    p2.write_text(text2.replace("LATEST_Z_CORE_VERSION = '2.3.2'", "LATEST_Z_CORE_VERSION = '2.3.3'"), encoding='utf-8')
    print("zCoreBridge.ts updated to 2.3.3")

# 3. PyInstaller 빌드 (무콘솔, 로컬 창 0개)
sys.path.insert(0, 'universal_z_core/os_agent')
import build_signed_merlin_z_core as b
print("Starting PyInstaller build for v2.3.3...")
res = b.build_with_pyinstaller()
print(f"Build result: {res}")

if res.get("built"):
    exe_path = Path(res["exe"])
    zip_path = Path('public/Merlin_Z_Core.zip')
    tmp_zip = Path('public/Merlin_Z_Core_tmp.zip')
    with zipfile.ZipFile(zip_path, 'r') as zin, zipfile.ZipFile(tmp_zip, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
        zout.write(exe_path, 'Merlin_Z_Core_Setup.exe')
        for item in zin.infolist():
            if item.filename != 'Merlin_Z_Core_Setup.exe':
                zout.writestr(item, zin.read(item.filename))
    tmp_zip.replace(zip_path)
    print(f"Updated {zip_path} with new Merlin_Z_Core_Setup.exe (v2.3.3)")
