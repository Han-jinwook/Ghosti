#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
👻 귀신같이 3대 모드 전환기 (ghosti_mode_switcher.py) — 1~5호컴 바탕화면 일괄 배포기
- 대상: 1호컴(사무실 멀린님), 2호컴, 3호컴, 4호컴, 5호컴(자택 멀린님)
- 제외: 6호컴(개발 서버 본진 PC는 바탕화면 설치 제외)
"""

from __future__ import annotations

import base64
import os
from pathlib import Path
import subprocess
import sys
from typing import List, Tuple

REPO_ROOT = Path(__file__).resolve().parent.parent
SWITCHER_SRC = REPO_ROOT / "tools" / "ghosti_mode_switcher.py"
ICON_SRC = REPO_ROOT / "public" / "favicon.ico"
LOCAL_ZCORE_EXE = REPO_ROOT / "universal_z_core" / "os_agent" / "dist" / "Merlin_Z_Core_Setup.exe"

# (호기 라벨, Tailscale IP, 원격 사용자명) — 6호컴 엄격 제외!
TARGET_NODES: List[Tuple[str, str, str]] = [
    ("1호컴 (사무실 멀린님)", "100.86.161.8", "chichi"),
    ("2호컴 (사무실 단독테스트)", "100.88.230.16", "sun-multi"),
    ("3호컴 (사무실 직원석)", "100.102.43.42", "chiuk"),
    ("4호컴 (사무실 직원석)", "100.114.100.24", "USER"),
    ("5호컴 (자택 멀린님)", "100.122.235.63", "WD"),
]


def resolve_ssh_key() -> str:
    for cand in (
        os.path.expanduser(r"~/.ssh/id_ai_master"),
        r"C:\Users\merlincode\.ssh\id_ai_master",
        r"C:\Users\WD\.ssh\id_ai_master",
        r"C:\Users\chichi\.ssh\id_ai_master",
    ):
        if os.path.exists(cand):
            return cand
    raise FileNotFoundError("SSH key id_ai_master not found")


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


def deploy_to_node(label: str, host: str, remote_user: str, key_path: str) -> bool:
    ssh_target = f"{remote_user}@{host}"
    app_dir_scp = f"C:/Users/{remote_user}/AppData/Local/Merlin_Mode_Vault/app"
    cache_exe_scp = f"C:/Users/{remote_user}/AppData/Local/Merlin_Mode_Vault/snapshots/cached_installer/Merlin_Z_Core_Setup.exe"

    print(f"\n=== [{label} ({ssh_target})] 3대 모드 전환기 배포 시작 ===", flush=True)

    # 1) 원격 금고 디렉토리 준비
    prep_ps = r"""
$appDir = Join-Path $env:LOCALAPPDATA "Merlin_Mode_Vault\app"
$cacheDir = Join-Path $env:LOCALAPPDATA "Merlin_Mode_Vault\snapshots\cached_installer"
New-Item -ItemType Directory -Force -Path $appDir | Out-Null
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
$installedExe = Join-Path $env:LOCALAPPDATA "Programs\MerlinFamily\Merlin_Z_Core_Setup.exe"
$cachedExe = Join-Path $cacheDir "Merlin_Z_Core_Setup.exe"
if (Test-Path $installedExe) {
    Copy-Item -Path $installedExe -Destination $cachedExe -Force
    Write-Output "SEEDED_FROM_LOCAL_INSTALL"
} else {
    Write-Output "NEED_SEED_UPLOAD"
}
"""
    r_prep = run_remote_ps(ssh_target, key_path, prep_ps, timeout_sec=20)
    if r_prep.returncode != 0:
        print(f"  ❌ 디렉토리 준비 실패: {r_prep.stderr.strip()}")
        return False

    # 2) ghosti_mode_switcher.py 및 ghosti_icon.ico 전송
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

    # 필요 시 Z코어 설치파일도 금고에 사전 적재
    if "NEED_SEED_UPLOAD" in (r_prep.stdout or "") and LOCAL_ZCORE_EXE.is_file():
        subprocess.run(
            [
                "scp",
                "-i",
                key_path,
                "-o",
                "StrictHostKeyChecking=no",
                str(LOCAL_ZCORE_EXE),
                f"{ssh_target}:{cache_exe_scp}",
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=90,
        )

    # 3) 실제 Windows 바탕화면([Environment]::GetFolderPath("Desktop"))에 단축 아이콘 생성 + 셀프테스트 검증
    shortcut_ps = r"""
$appDir = Join-Path $env:LOCALAPPDATA "Merlin_Mode_Vault\app"
$scriptPath = Join-Path $appDir "ghosti_mode_switcher.py"
$iconPath = Join-Path $appDir "ghosti_icon.ico"

$pyCmd = Get-Command python -ErrorAction Stop
$pyDir = Split-Path -Parent $pyCmd.Source
$pywPath = Join-Path $pyDir "pythonw.exe"
if (-not (Test-Path $pywPath)) {
    $pywPath = $pyCmd.Source
}

$desktopDir = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktopDir "귀신같이 모드 전환기.lnk"

$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($lnkPath)
$sc.TargetPath = $pywPath
$sc.Arguments = "`"$scriptPath`""
$sc.WorkingDirectory = $appDir
if (Test-Path $iconPath) {
    $sc.IconLocation = "$iconPath,0"
}
$sc.Description = "귀신같이 3대 모드 원클릭 전환기 (완전백지 / 순수개인 / 사무실업무공유)"
$sc.Save()

$lnkExists = Test-Path $lnkPath
& $pyCmd.Source $scriptPath --selftest
& $pyCmd.Source $scriptPath --status-json
Write-Output ("SHORTCUT_CREATED=" + $lnkExists + " | PATH=" + $lnkPath)
"""
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
            n for n in TARGET_NODES if any(f"{tok}호컴" in n[0] or tok == n[1] for tok in only_filter)
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
        scope = ", ".join(n[0] for n in selected_nodes) if only_filter else "1~5호컴 전체"
        print(f"\n🎉 {scope} 바탕화면 배포 및 무결성 검증 완료! (6호컴 제외 준수)")
        return 0
    print("\n⚠️ 일부 PC 배포 중 경고가 발생했습니다.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
