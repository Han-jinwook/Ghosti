import sys, subprocess, time
from pathlib import Path
sys.path.insert(0, "universal_z_core/os_agent")
import merlin_z_core_os as zos

test_dir = Path.home() / "Downloads" / "Merlin_Z_Core (4)"
test_dir.mkdir(parents=True, exist_ok=True)
f1 = test_dir / "안내_README.txt"
f1.write_text("테스트 안내 파일", encoding="utf-8")

f2 = Path.home() / "Downloads" / "파일접수 상세내역_30216052_20261030122102_sundream78.xlsx"
f2.write_text("테스트 엑셀 파일", encoding="utf-8")

print("--- Testing f1 ---")
res1 = zos.execute_real_os_action("open_file_search", str(f1))
print("res1:", res1)
time.sleep(1.0)
wins = zos.find_explorer_windows_on_default_desktop([])
print("Open windows after f1:", wins)

print("--- Testing f2 ---")
res2 = zos.execute_real_os_action("open_file_search", str(f2))
print("res2:", res2)
time.sleep(1.0)
wins2 = zos.find_explorer_windows_on_default_desktop([])
print("Open windows after f2:", wins2)
