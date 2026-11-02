# -*- coding: utf-8 -*-
$ErrorActionPreference = "SilentlyContinue"
New-Item -ItemType Directory -Force -Path "C:\MerlinTools" | Out-Null

# 1. 매일 08:30 자동 리부팅 스케줄 등록
schtasks /create /tn "MerlinDailyReboot0830" /tr "shutdown.exe /r /f /t 0" /sc DAILY /st 08:30 /f 2>$null | Out-Null

# 2. 기존 실행 중인 데몬 종료
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*seq_paste_daemon*" } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

# 3. 최신 귀신창 데몬 다운로드
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ts = [DateTimeOffset]::Now.ToUnixTimeSeconds()
Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/Han-jinwook/Ghosti/main/universal_z_core/os_agent/seq_paste_daemon.py?t=$ts" -OutFile "C:\MerlinTools\seq_paste_daemon.py"

# 4. 진짜 Python (Tkinter 포함, WindowsApps 가짜 스텁 제외) 탐색
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

# 5. 파이썬이 없으면 Python 3.11.9 (Tkinter 포함) 무인 자동 설치
if (-not $validPy) {
    Write-Host "4호기 PC에 파이썬(Tkinter)이 없어 자동 설치 중입니다... (약 25초 소요, 잠시만 기다려주세요)" -ForegroundColor Cyan
    Invoke-WebRequest -UseBasicParsing -Uri "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe" -OutFile "C:\MerlinTools\py_setup.exe"
    Start-Process -Wait -FilePath "C:\MerlinTools\py_setup.exe" -ArgumentList "/quiet","InstallAllUsers=0","PrependPath=1","Include_tcltk=1","Include_test=0"
    $validPy = Join-Path $env:LOCALAPPDATA "Programs\Python\Python311\python.exe"
}

# 6. Pillow(이미지 라이브러리) 및 시작프로그램 VBS 등록
if (Test-Path $validPy) {
    & $validPy -m pip install pillow --quiet 2>$null
}
$pyw = $validPy -replace "python\.exe$","pythonw.exe"
if (-not (Test-Path $pyw)) { $pyw = $validPy }

$startupDir = [Environment]::GetFolderPath("Startup")
$vbsPath = Join-Path $startupDir "MerlinSeqPaste.vbs"
$vbsContent = "Set WshShell = CreateObject(""WScript.Shell"")`r`nWshShell.Run """"""$pyw"""" """"C:\MerlinTools\seq_paste_daemon.py"""""", 0, False"
Set-Content -Path $vbsPath -Value $vbsContent -Encoding ASCII

# 7. 즉시 귀신창 소환 기동 (--show-now)
Start-Process -FilePath $pyw -ArgumentList "C:\MerlinTools\seq_paste_daemon.py","--show-now"
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  귀신창(Ctrl+0) 설치 및 기동 완료! 지금 화면에 귀신창이 떴습니다!" -ForegroundColor Green
Write-Host "  이제 언제든 [Ctrl + 0] (또는 [Alt + Z])을 누르시면 됩니다!" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green
