
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
