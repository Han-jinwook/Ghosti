$ErrorActionPreference = "SilentlyContinue"
New-Item -ItemType Directory -Force -Path "C:\MerlinTools" | Out-Null

# 1. Schedule daily 08:30 reboot
schtasks /create /tn "MerlinDailyReboot0830" /tr "shutdown.exe /r /f /t 0" /sc DAILY /st 08:30 /f 2>$null | Out-Null

# 2. Stop existing daemon
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*seq_paste_daemon*" } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

# 3. Download latest seq_paste_daemon.py
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ts = [DateTimeOffset]::Now.ToUnixTimeSeconds()
Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/Han-jinwook/Ghosti/main/universal_z_core/os_agent/seq_paste_daemon.py?t=$ts" -OutFile "C:\MerlinTools\seq_paste_daemon.py"

# 4. Find real Python with Tkinter (excluding WindowsApps Microsoft Store stub)
$cands = @()
if (Get-Command python.exe -ErrorAction SilentlyContinue) {
    $cands += (Get-Command python.exe).Source
}
$found = Get-ChildItem -Path "$env:LOCALAPPDATA\Programs\Python","$env:ProgramFiles\Python*","C:\Python*" -Filter "python.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
if ($found) { $cands += $found }

$validPy = $null
foreach ($p in $cands) {
    if ($p -and ($p -notlike "*WindowsApps*")) {
        try {
            $chk = & $p -c "import tkinter; print(123)" 2>$null
            if ($chk -match "123") {
                $validPy = $p
                break
            }
        } catch {}
    }
}

# 5. Auto-install Python 3.11.9 if missing
if (-not $validPy) {
    Write-Host "[1/2] Installing Python 3.11 (with Tkinter)... Please wait ~25 seconds..." -ForegroundColor Cyan
    Invoke-WebRequest -UseBasicParsing -Uri "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe" -OutFile "C:\MerlinTools\py_setup.exe"
    Start-Process -Wait -FilePath "C:\MerlinTools\py_setup.exe" -ArgumentList "/quiet","InstallAllUsers=0","PrependPath=1","Include_tcltk=1","Include_test=0"
    $validPy = Join-Path $env:LOCALAPPDATA "Programs\Python\Python311\python.exe"
}

# 6. Install Pillow and register startup VBS
if (Test-Path $validPy) {
    & $validPy -m pip install pillow --quiet 2>$null
}
$pyw = $validPy -replace "python\.exe$","pythonw.exe"
if (-not (Test-Path $pyw)) { $pyw = $validPy }

$startupDir = [Environment]::GetFolderPath("Startup")
$vbsPath = Join-Path $startupDir "MerlinSeqPaste.vbs"
$vbsContent = "Set WshShell = CreateObject(""WScript.Shell"")`r`nWshShell.Run """"""$pyw"""" """"C:\MerlinTools\seq_paste_daemon.py"""""", 0, False"
Set-Content -Path $vbsPath -Value $vbsContent -Encoding ASCII

# 7. Launch daemon and summon Ghost Window immediately (--show-now)
Start-Process -FilePath $pyw -ArgumentList "C:\MerlinTools\seq_paste_daemon.py","--show-now"
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  [SUCCESS] Ghost Window (Ctrl+0) is now running!" -ForegroundColor Green
Write-Host "  Press [Ctrl + 0] (or [Alt + Z]) anytime!" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green
