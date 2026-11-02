$ErrorActionPreference = "Continue"
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  [1/4] Preparing C:\MerlinTools directory..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "C:\MerlinTools" | Out-Null

# 1. Schedule daily 08:30 reboot
schtasks /create /tn "MerlinDailyReboot0830" /tr "shutdown.exe /r /f /t 0" /sc DAILY /st 08:30 /f 2>$null | Out-Null

# 2. Stop existing daemon
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*seq_paste_daemon*" } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

# 3. Download latest seq_paste_daemon.py
Write-Host "  [2/4] Downloading latest Ghost Window daemon..." -ForegroundColor Cyan
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ts = [DateTimeOffset]::Now.ToUnixTimeSeconds()
& curl.exe -sL "https://raw.githubusercontent.com/Han-jinwook/Ghosti/main/universal_z_core/os_agent/seq_paste_daemon.py?t=$ts" -o "C:\MerlinTools\seq_paste_daemon.py"

# 4. Find real Python with Tkinter (excluding WindowsApps Microsoft Store stub)
Write-Host "  [3/4] Checking Python (Tkinter) environment..." -ForegroundColor Cyan
$cands = @()
$envPaths = @(
    "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python310\python.exe",
    "C:\Python313\python.exe",
    "C:\Python312\python.exe",
    "C:\Python311\python.exe",
    "C:\Python310\python.exe",
    "C:\Program Files\Python313\python.exe",
    "C:\Program Files\Python312\python.exe",
    "C:\Program Files\Python311\python.exe"
)
foreach ($ep in $envPaths) {
    if (Test-Path $ep) { $cands += $ep }
}
if (Get-Command python.exe -ErrorAction SilentlyContinue) {
    $src = (Get-Command python.exe).Source
    if ($src -and ($src -notlike "*WindowsApps*")) { $cands += $src }
}

$validPy = $null
foreach ($p in $cands) {
    if ($p -and (Test-Path $p) -and ($p -notlike "*WindowsApps*")) {
        try {
            $chk = & $p -c "import tkinter; print(123)" 2>$null
            if ($chk -match "123") {
                $validPy = $p
                Write-Host "        -> Found valid Python: $validPy" -ForegroundColor Green
                break
            }
        } catch {}
    }
}

# 5. Auto-install Python 3.11.9 if missing
if (-not $validPy) {
    Write-Host "        -> Python not found on this PC. Downloading Python 3.11 installer..." -ForegroundColor Yellow
    & curl.exe -L "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe" -o "C:\MerlinTools\py_setup.exe"
    Write-Host "        -> Installing Python 3.11 silently (takes ~25 seconds, please wait)..." -ForegroundColor Yellow
    Start-Process -Wait -FilePath "C:\MerlinTools\py_setup.exe" -ArgumentList "/quiet","InstallAllUsers=0","PrependPath=1","Include_tcltk=1","Include_test=0"
    $installedCandidate = Join-Path $env:LOCALAPPDATA "Programs\Python\Python311\python.exe"
    if (Test-Path $installedCandidate) {
        $validPy = $installedCandidate
        Write-Host "        -> Python 3.11 installed successfully: $validPy" -ForegroundColor Green
    } else {
        Write-Host "        [!] Python installer required UAC or custom path. Running interactive installer..." -ForegroundColor Red
        Start-Process -Wait -FilePath "C:\MerlinTools\py_setup.exe" -ArgumentList "/passive","InstallAllUsers=0","PrependPath=1","Include_tcltk=1","Include_test=0"
        if (Test-Path $installedCandidate) {
            $validPy = $installedCandidate
        }
    }
}

# 6. Install Pillow and register startup VBS
if ($validPy -and (Test-Path $validPy)) {
    Write-Host "  [4/4] Starting Ghost Window daemon..." -ForegroundColor Cyan
    & $validPy -m pip install pillow --quiet 2>$null
    $pyw = $validPy -replace "python\.exe$","pythonw.exe"
    if (-not (Test-Path $pyw)) { $pyw = $validPy }

    $startupDir = [Environment]::GetFolderPath("Startup")
    $vbsPath = Join-Path $startupDir "MerlinSeqPaste.vbs"
    $vbsContent = "Set WshShell = CreateObject(""WScript.Shell"")`r`nWshShell.Run """"""$pyw"""" """"C:\MerlinTools\seq_paste_daemon.py"""""", 0, False"
    Set-Content -Path $vbsPath -Value $vbsContent -Encoding ASCII

    # Launch daemon and summon Ghost Window immediately (--show-now)
    Start-Process -FilePath $pyw -ArgumentList "C:\MerlinTools\seq_paste_daemon.py","--show-now"
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  [SUCCESS] Ghost Window (Ctrl+0) is now running!" -ForegroundColor Green
    Write-Host "  Look near your mouse cursor! Press [Ctrl + 0] anytime!" -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Green
} else {
    Write-Host "==========================================================" -ForegroundColor Red
    Write-Host "  [ERROR] Could not locate Python even after installation." -ForegroundColor Red
    Write-Host "==========================================================" -ForegroundColor Red
}
