import sys, json, time, subprocess
from pathlib import Path
sys.path.insert(0, "universal_z_core/os_agent")
import merlin_z_core_os as zos

# Let's write a PowerShell script that runs in interactive session via schtasks,
# invokes explorer.exe /select, and dumps Shell.Application.Windows() state!
ps_script = Path("D:/Ghosti/scratch/check_shell_wins.ps1")
ps_script.write_text(r'''
$ErrorActionPreference = "Continue"
$shell = New-Object -ComObject Shell.Application

$f1 = "$env:USERPROFILE\Downloads\Merlin_Z_Core (4)\안내_README.txt"
$f2 = "$env:USERPROFILE\Downloads\파일접수 상세내역_30216052_20261030122102_sundream78.xlsx"

Start-Process explorer.exe -ArgumentList "/select,`"$f1`""
Start-Sleep -Milliseconds 1500

$report = @()
foreach ($w in $shell.Windows()) {
    try {
        $sel = @()
        foreach ($item in $w.Document.SelectedItems()) {
            $sel += $item.Path
        }
        $focused = ""
        try { $focused = $w.Document.FocusedItem.Path } catch {}
        $report += @{
            LocationName = $w.LocationName
            LocationURL = $w.LocationURL
            HWND = $w.HWND
            SelectedItems = $sel
            FocusedItem = $focused
        }
    } catch {}
}
$report | ConvertTo-Json -Depth 4 | Set-Content -Path "D:\Ghosti\scratch\explorer_report.json" -Encoding UTF8
''', encoding="utf-8")

ok = zos.run_interactive_gui_via_schtasks(
    "MerlinTestShell",
    f'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "{ps_script}"'
)
print("schtasks launched:", ok)
time.sleep(3.0)
rep_file = Path("D:/Ghosti/scratch/explorer_report.json")
if rep_file.exists():
    print(rep_file.read_text(encoding="utf-8-sig"))
else:
    print("Report file not created yet")
