import sys, json, time, subprocess
from pathlib import Path
sys.path.insert(0, r"D:\Ghosti\universal_z_core\os_agent")
import merlin_z_core_os as zos

out_path = Path(r"D:\Ghosti\scratch\explorer_report_2.json")
try:
    f2a = Path.home() / "Downloads" / "파일접수 상세내역_30216052_20261030122102_sundream78.xlsx"
    f2b = Path.home() / "Downloads" / "파일접수 상세내역_30216052_20261030112419_sundream78.xlsx"
    f2a.write_text("테스트 엑셀 A", encoding="utf-8")
    f2b.write_text("테스트 엑셀 B", encoding="utf-8")

    # Click file 2a first
    ra = zos.execute_real_os_action("open_file_search", str(f2a))
    time.sleep(1.0)
    # Now while 다운로드 is ALREADY open on screen, click file 2b!
    rb = zos.execute_real_os_action("open_file_search", str(f2b))
    time.sleep(1.0)

    # Query Shell.Application via powershell to see what windows are open and what is selected!
    ps_cmd = (
        "$s = New-Object -ComObject Shell.Application; "
        "$out = @(); "
        "foreach ($w in $s.Windows()) { "
        "  try { "
        "    $sel = @($w.Document.SelectedItems() | ForEach-Object { $_.Path }); "
        "    $foc = $w.Document.FocusedItem.Path; "
        "    $out += @{ Name=$w.LocationName; URL=$w.LocationURL; HWND=$w.HWND; Selected=$sel; Focused=$foc } "
        "  } catch {} "
        "}; "
        "$out | ConvertTo-Json -Depth 4"
    )
    proc = subprocess.run(
        ["powershell", "-NoProfile", "-Command", ps_cmd],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    out_path.write_text(json.dumps({
        "ra": ra,
        "rb": rb,
        "shell_windows": proc.stdout,
        "shell_err": proc.stderr,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
except Exception as e:
    import traceback
    out_path.write_text(json.dumps({"error": traceback.format_exc()}, ensure_ascii=False), encoding="utf-8")
