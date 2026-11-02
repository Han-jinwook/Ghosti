import sys, time, subprocess
from pathlib import Path
sys.path.insert(0, "universal_z_core/os_agent")
import merlin_z_core_os as zos

rep = Path("D:/Ghosti/scratch/explorer_report.json")
if rep.exists():
    rep.unlink()

subprocess.run(["schtasks", "/End", "/TN", "MerlinTestWorker"], capture_output=True)
pyw = zos.get_pythonw_executable()
ok = zos.run_interactive_gui_via_schtasks(
    "MerlinTestWorker",
    f'"{pyw}" "D:\\Ghosti\\scratch\\interactive_worker.py"'
)
print("Launched:", ok)
for _ in range(30):
    time.sleep(0.3)
    if rep.exists():
        print(rep.read_text(encoding="utf-8"))
        break
else:
    print("Timed out waiting for explorer_report.json")
