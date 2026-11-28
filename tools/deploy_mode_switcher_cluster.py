#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
👻 귀신같이 3대 모드 전환기 (ghosti_mode_switcher.py) — 1~6호컴 전 클러스터 수동 일괄 설치 & 구버전 클린업 배포기
- 대상: 1호컴(사무실 멀린님), 2호컴(통합테스트), 3호컴(달나라 QA), 4호컴(해나라 QA), 5호컴(자택 멀린님), 6호컴(로컬 본진)
- 원칙: 전환기가 버전업될 때마다 1~6호컴 전체에 수동 설치하며, 기존에 떠 있던 구버전 전환기 프로세스·구형 캐시·구형 단축아이콘은 깨끗이 정리한 뒤 최신 버전으로 교체합니다.
"""

from __future__ import annotations

import base64
import os
from pathlib import Path
import shutil
import subprocess
import sys
from typing import List, Tuple

REPO_ROOT = Path(__file__).resolve().parent.parent
SWITCHER_SRC = REPO_ROOT / "tools" / "ghosti_mode_switcher.py"
ICON_SRC = REPO_ROOT / "public" / "favicon.ico"
LOCAL_ZCORE_EXE = REPO_ROOT / "universal_z_core" / "os_agent" / "dist" / "Merlin_Z_Core_Setup" / "Merlin_Z_Core_Setup.exe"

# (호기 라벨, Tailscale IP (None=로컬 6호컴), 원격 사용자명) — 1~6호컴 전체 수동 설치!
TARGET_NODES: List[Tuple[str, str | None, str]] = [
    ("1호컴 (사무실 멀린님)", "100.86.161.8", "chichi"),
    ("2호컴 (사무실 통합테스트)", "100.88.230.16", "sun-multi"),
    ("3호컴 (사무실 달나라)", "100.102.43.42", "chiuk"),
    ("4호컴 (사무실 해나라)", "100.114.100.24", "USER"),
    ("5호컴 (자택 멀린님)", "100.122.235.63", "WD"),
    ("6호컴 (로컬 본진)", None, os.environ.get("USERNAME", "merlincode")),
]


def resolve_ssh_key() -> str:
    home = os.path.expanduser("~")
    for name in ("id_ed25519", "merlin_cluster_ed25519", "id_ai_master", "id_rsa"):
        cand = os.path.join(home, ".ssh", name)
        if os.path.exists(cand):
            return cand
    for cand in (
        r"C:\Users\merlincode\.ssh\id_ed25519",
        r"C:\Users\merlincode\.ssh\merlin_cluster_ed25519",
        r"C:\Users\WD\.ssh\id_ai_master",
        r"C:\Users\chichi\.ssh\id_ai_master",
    ):
        if os.path.exists(cand):
            return cand
    raise FileNotFoundError("SSH key not found")


def run_remote_ps(ssh_target: str, key_path: str, ps_script: str, timeout_sec: int = 25) -> subprocess.CompletedProcess:
    full_ps = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n" + ps_script
    enc = base64.b64encode(full_ps.encode("utf-16-le")).decode("ascii")
    return subprocess.run(
        [
            "ssh",
            "-i",
            key_path,
            "-o",
            "StrictHostKeyChecking=no",
            "-o",
            "ConnectTimeout=6",
            ssh_target,
            f"powershell -NoProfile -NonInteractive -EncodedCommand {enc}",
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout_sec,
    )


def deploy_to_node(label: str, host: str | None, remote_user: str, key_path: str) -> bool:
    is_local = host is None
    ssh_target = "LOCAL" if is_local else f"{remote_user}@{host}"
    app_dir_scp = f"C:/Users/{remote_user}/AppData/Local/Merlin_Mode_Vault/app"

    print(f"\n=== [{label} ({ssh_target})] 3대 모드 전환기 구버전 정리 및 최신본 수동 설치 시작 ===", flush=True)

    # 1) 구버전 전환기 실행 창 종료 + 구버전 스크립트/캐시(__pycache__)/구형 단독 exe 잔재 완전 청소 + 최신 --onedir 금고 동기화
    prep_ps = r"""
# 1-1) 실행 중인 구버전 ghosti_mode_switcher 프로세스가 있으면 기록해 두었다가 종료 (설치 직후 새 버전으로 자동 재오픈)
$hadOpenWindow = $false
$oldProcs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match "ghosti_mode_switcher\.py" -and $_.CommandLine -notmatch "--selftest|--status-json" }
foreach ($op in $oldProcs) {
    $hadOpenWindow = $true
    Stop-Process -Id $op.ProcessId -Force -ErrorAction SilentlyContinue
}

$appDir = Join-Path $env:LOCALAPPDATA "Merlin_Mode_Vault\app"
$cacheDir = Join-Path $env:LOCALAPPDATA "Merlin_Mode_Vault\snapshots\cached_installer"
if (Test-Path $appDir) {
    # 구버전 스크립트 및 __pycache__ 완전 삭제
    Remove-Item -Path (Join-Path $appDir "__pycache__") -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path (Join-Path $appDir "ghosti_mode_switcher*.py*") -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Force -Path $appDir | Out-Null
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

# 1-2) 금고 내 구버전 Z-코어 캐시를 현재 설치된 최신 --onedir 번들로 깨끗이 교체
$installedDir = Join-Path $env:LOCALAPPDATA "Programs\MerlinFamily"
$installedExe = Join-Path $installedDir "Merlin_Z_Core_Setup.exe"
$installedInt = Join-Path $installedDir "_internal"
$cachedExe = Join-Path $cacheDir "Merlin_Z_Core_Setup.exe"
$cachedInt = Join-Path $cacheDir "_internal"
if ((Test-Path $installedExe) -and (Test-Path $installedInt)) {
    Copy-Item -Path $installedExe -Destination $cachedExe -Force
    if (Test-Path $cachedInt) { Remove-Item -Path $cachedInt -Recurse -Force -ErrorAction SilentlyContinue }
    Copy-Item -Path $installedInt -Destination $cachedInt -Recurse -Force
    Write-Output "SEEDED_FROM_LOCAL_INSTALL"
} else {
    if ((Test-Path $cachedExe) -and -not (Test-Path $cachedInt)) {
        Remove-Item -Path $cachedExe -Force -ErrorAction SilentlyContinue
    }
    Write-Output "NEED_SEED_UPLOAD"
}
if ($hadOpenWindow) {
    Write-Output "REOPEN_SWITCHER_WINDOW=1"
}
"""
    if is_local:
        full_ps = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n" + prep_ps
        enc = base64.b64encode(full_ps.encode("utf-16-le")).decode("ascii")
        r_prep = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-EncodedCommand", enc],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=25,
        )
    else:
        r_prep = run_remote_ps(ssh_target, key_path, prep_ps, timeout_sec=25)
    if r_prep.returncode != 0:
        print(f"  ❌ 구버전 정리/디렉토리 준비 실패: {r_prep.stderr.strip()}")
        return False
    need_reopen = "REOPEN_SWITCHER_WINDOW=1" in (r_prep.stdout or "")

    # 2) 최신 ghosti_mode_switcher.py 및 ghosti_icon.ico 설치
    if is_local:
        local_app_dir = Path(os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")) / "Merlin_Mode_Vault" / "app"
        local_app_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(SWITCHER_SRC, local_app_dir / "ghosti_mode_switcher.py")
        if ICON_SRC.exists():
            shutil.copy2(ICON_SRC, local_app_dir / "ghosti_icon.ico")
    else:
        for local_src, remote_name in (
            (SWITCHER_SRC, "ghosti_mode_switcher.py"),
            (ICON_SRC, "ghosti_icon.ico"),
        ):
            r_scp = subprocess.run(
                [
                    "scp",
                    "-i",
                    key_path,
                    "-o",
                    "StrictHostKeyChecking=no",
                    str(local_src),
                    f"{ssh_target}:{app_dir_scp}/{remote_name}",
                ],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=30,
            )
            if r_scp.returncode != 0:
                print(f"  ❌ 파일 전송 실패 ({remote_name}): {r_scp.stderr.strip()}")
                return False

    # 3) 실제 Windows 바탕화면([Environment]::GetFolderPath("Desktop"))에 단축 아이콘 갱신(구버전 아이콘 덮어쓰기) + 셀프테스트 검증
    reopen_line = 'Start-Process -FilePath $pywPath -ArgumentList "`"$scriptPath`"" -WorkingDirectory $appDir' if need_reopen else ""
    shortcut_ps = rf"""
$appDir = Join-Path $env:LOCALAPPDATA "Merlin_Mode_Vault\app"
$scriptPath = Join-Path $appDir "ghosti_mode_switcher.py"
$iconPath = Join-Path $appDir "ghosti_icon.ico"

$pyCmd = Get-Command python -ErrorAction Stop
$pyDir = Split-Path -Parent $pyCmd.Source
$pywPath = Join-Path $pyDir "pythonw.exe"
if (-not (Test-Path $pywPath)) {{
    $pywPath = $pyCmd.Source
}}

$desktopDir = [Environment]::GetFolderPath("Desktop")
# 구형 이름의 전환기 바로가기 잔재가 있으면 모두 정리하고 정식 단축 아이콘 1개로 통일
Get-ChildItem -Path $desktopDir -Filter "*모드*전환기*.lnk" -ErrorAction SilentlyContinue | Where-Object {{ $_.Name -ne "귀신같이 모드 전환기.lnk" }} | Remove-Item -Force -ErrorAction SilentlyContinue
$lnkPath = Join-Path $desktopDir "귀신같이 모드 전환기.lnk"

$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($lnkPath)
$sc.TargetPath = $pywPath
$sc.Arguments = "`"$scriptPath`""
$sc.WorkingDirectory = $appDir
if (Test-Path $iconPath) {{
    $sc.IconLocation = "$iconPath,0"
}}
$sc.Description = "귀신같이 3대 모드 원클릭 전환기 (완전백지 / 순수개인 / 사무실업무공유)"
$sc.Save()

$lnkExists = Test-Path $lnkPath
& $pyCmd.Source $scriptPath --selftest
& $pyCmd.Source $scriptPath --status-json
{reopen_line}
Write-Output ("SHORTCUT_CREATED=" + $lnkExists + " | PATH=" + $lnkPath)
"""
    if is_local:
        full_sc = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n" + shortcut_ps
        enc_sc = base64.b64encode(full_sc.encode("utf-16-le")).decode("ascii")
        r_sc = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-EncodedCommand", enc_sc],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=30,
        )
    else:
        r_sc = run_remote_ps(ssh_target, key_path, shortcut_ps, timeout_sec=30)
    if r_sc.returncode != 0 or "SELFTEST_OK" not in (r_sc.stdout or "") or "SHORTCUT_CREATED=True" not in (r_sc.stdout or ""):
        print(f"  ❌ 단축아이콘/검증 실패:\n{r_sc.stdout}\n{r_sc.stderr}")
        return False

    for ln in (r_sc.stdout or "").splitlines():
        if any(k in ln for k in ("SELFTEST_OK", "SHORTCUT_CREATED=", '"modeLabel"')):
            print(f"  ✅ {ln.strip()}")
    return True


def main() -> int:
    key_path = resolve_ssh_key()
    only_filter: List[str] = []
    for arg in sys.argv[1:]:
        if arg.startswith("--only="):
            only_filter.extend(x.strip() for x in arg.split("=", 1)[1].split(",") if x.strip())
    selected_nodes = TARGET_NODES
    if only_filter:
        selected_nodes = [
            n for n in TARGET_NODES if any(f"{tok}호컴" in n[0] or (n[1] and tok == n[1]) for tok in only_filter)
        ]
        if not selected_nodes:
            print(f"❌ 일치하는 대상 PC가 없습니다: {only_filter}")
            return 1
        print(f"🎯 핀셋 배포 대상: {[n[0] for n in selected_nodes]}", flush=True)

    ok_all = True
    for label, host, user in selected_nodes:
        if not deploy_to_node(label, host, user, key_path):
            ok_all = False
    if ok_all:
        scope = ", ".join(n[0] for n in selected_nodes) if only_filter else "1~6호컴 전체"
        print(f"\n🎉 {scope} 3대 모드 전환기 구버전 정리 및 최신본 수동 설치·검증 완료!")
        return 0
    print("\n⚠️ 일부 PC 배포 중 경고가 발생했습니다.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
