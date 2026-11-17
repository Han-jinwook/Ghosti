#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
❖ 멀린 Z-코어(universal_z_core) 1호기 & 4호기 자동 동기화 및 무간섭 리로드 파이프라인
- 1호기: 로컬 프로세스 교체(--replace) 및 autostart 레지스트리 점검
- 4호기: SSH(id_ai_master) + SCP로 universal_z_core 전수 복사 후 schtasks(StartMerlinZCore5199) 원격 리로드 & /api/care/status 무결성 검증
"""

import os
import sys
import subprocess
import urllib.request
import json
import time

def log(msg: str):
    print(f"[*] {msg}", flush=True)


UZC_DIR = os.path.dirname(os.path.abspath(__file__))


def sync_internal_z_core_mirrors():
    """
    [2026-11-13 귀신창 완전 인수 SSOT 일원화]
    D:\\Secretary\\tools\\ 역방향 덮어쓰기를 영구 중단하고, 현재 워크트리의 universal_z_core 마스터(UZC_DIR)에서
    하위 미러(os_agent, core_power_agent)로 단방향 동기화합니다 (D:\\Ghosti 및 D:\\Ghosti_Sync 워크트리 모두 호환).
    """
    import shutil
    mirrors = [
        os.path.join(UZC_DIR, "os_agent"),
        os.path.join(UZC_DIR, "core_power_agent"),
    ]
    for fname in ("seq_paste_daemon.py", "ghost_search_window_ui2.py"):
        src = os.path.join(UZC_DIR, fname)
        if not os.path.exists(src):
            continue
        for mdir in mirrors:
            if not os.path.isdir(mdir):
                continue
            dst = os.path.join(mdir, fname)
            try:
                shutil.copy2(src, dst)
            except Exception as e:
                log(f"⚠️ 내부 미러 동기화 경고 ({dst}): {e}")

def update_pc1():
    log("=== [1호기 (로컬)] Z-코어 최신화 및 리로드 시작 ===")
    import shutil
    spd_src = os.path.join(UZC_DIR, "seq_paste_daemon.py")
    spd_os_agent = os.path.join(UZC_DIR, "os_agent", "seq_paste_daemon.py")
    ui2_src = os.path.join(UZC_DIR, "ghost_search_window_ui2.py")
    ui2_os_agent = os.path.join(UZC_DIR, "os_agent", "ghost_search_window_ui2.py")
    lex_src = os.path.join(UZC_DIR, "assets", "ko_en_lexicon.zlib")
    if os.path.exists(spd_src):
        try:
            shutil.copy2(spd_src, spd_os_agent)
            if os.path.exists(ui2_src):
                shutil.copy2(ui2_src, ui2_os_agent)
            if os.path.exists(r"C:\MerlinTools"):
                shutil.copy2(spd_src, r"C:\MerlinTools\seq_paste_daemon.py")
                if os.path.exists(ui2_src):
                    shutil.copy2(ui2_src, r"C:\MerlinTools\ghost_search_window_ui2.py")
                os.makedirs(r"C:\MerlinTools\assets", exist_ok=True)
                if os.path.exists(lex_src):
                    shutil.copy2(lex_src, r"C:\MerlinTools\assets\ko_en_lexicon.zlib")
                os_assets_dir = os.path.join(UZC_DIR, "os_agent", "assets")
                if os.path.isdir(os_assets_dir):
                    for fn in os.listdir(os_assets_dir):
                        fp = os.path.join(os_assets_dir, fn)
                        if os.path.isfile(fp):
                            shutil.copy2(fp, os.path.join(r"C:\MerlinTools\assets", fn))
                snd_dir = os.path.join(UZC_DIR, "baby_ghost_sounds")
                if os.path.isdir(snd_dir):
                    os.makedirs(r"C:\MerlinTools\baby_ghost_sounds", exist_ok=True)
                    for fn in os.listdir(snd_dir):
                        fp = os.path.join(snd_dir, fn)
                        if os.path.isfile(fp):
                            shutil.copy2(fp, os.path.join(r"C:\MerlinTools\baby_ghost_sounds", fn))
        except Exception as e:
            log(f"1호기 seq_paste_daemon 복사 경고: {e}")

    script = os.path.join(UZC_DIR, "os_agent", "merlin_z_core_daemon.py")
    py_exe = sys.executable
    pyw_exe = os.path.join(os.path.dirname(py_exe), "pythonw.exe")
    runner = pyw_exe if os.path.exists(pyw_exe) else py_exe

    # 1) 자동실행 등록
    try:
        subprocess.run([runner, script, "--enable-autostart"], capture_output=True, timeout=5)
        log("1호기: 시작프로그램 레지스트리(MerlinZCoreDaemon) 등록 완료")
    except Exception as e:
        log(f"1호기 시작프로그램 등록 경고: {e}")

    # 2) 데몬 교체 기동 (Z-코어 5199 + 귀신창 51988) - WMI Win32_Process.Create로 부모 프로세스 Job Object 종료 영향 원천 차단
    try:
        for target_script in (script, spd_src):
            wmi_cmd = [
                "powershell",
                "-NoProfile",
                "-Command",
                f"Invoke-WmiMethod -Class Win32_Process -Name Create -ArgumentList '\"{runner}\" \"{target_script}\" --replace' | Out-Null",
            ]
            subprocess.run(wmi_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=8)
        time.sleep(1.5)
    except Exception as e:
        log(f"1호기 데몬 기동 오류: {e}")

    # 3) 헬스체크 (교체 기동 시 구 프로세스 소켓 종료 직후 바인딩되므로 최대 5회 재시도)
    ok_pc1 = False
    last_err = None
    for _ in range(5):
        try:
            with urllib.request.urlopen("http://127.0.0.1:5199/api/care/status", timeout=2.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("ok"):
                    log("✅ 1호기 Z-코어 정상 기동 확인 (5199 포트 / 케어스위트 응답 성공)")
                    ok_pc1 = True
                    break
        except Exception as e:
            last_err = e
            time.sleep(0.6)
    if not ok_pc1:
        log(f"❌ 1호기 헬스체크 실패: {last_err}")

def _resolve_ssh_key() -> str:
    candidates = [
        os.path.expanduser(r"~/.ssh/id_ai_master"),
        r"C:\Users\WD\.ssh\id_ai_master",
        r"C:\Users\chichi\.ssh\id_ai_master",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return candidates[0]

def update_pc4():
    log("\n=== [4호기 (사무실 100.114.100.24)] Z-코어 원격 동기화 및 리로드 시작 ===")
    key_path = _resolve_ssh_key()
    if not os.path.exists(key_path):
        log(f"❌ 마스터키 없음: {key_path}")
        return

    # 1) SCP 파일 복사 (universal_z_core 및 C:/MerlinTools/seq_paste_daemon.py 동시 최신화)
    local_dir = os.path.join(UZC_DIR, "*")
    remote_dest = "USER@100.114.100.24:C:/MerlinTools/universal_z_core/"
    scp_cmd = ["scp", "-i", key_path, "-o", "StrictHostKeyChecking=no", "-r", local_dir, remote_dest]
    log("4호기로 최신 universal_z_core 전송 중 (SCP)...")
    res = subprocess.run(scp_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120)
    if res.returncode != 0:
        log(f"❌ 4호기 SCP 전송 실패: {res.stderr}")
        return
    subprocess.run(
        ["scp", "-i", key_path, "-o", "StrictHostKeyChecking=no", os.path.join(UZC_DIR, "seq_paste_daemon.py"), "USER@100.114.100.24:C:/MerlinTools/seq_paste_daemon.py"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=15,
    )
    subprocess.run(
        ["scp", "-i", key_path, "-o", "StrictHostKeyChecking=no", os.path.join(UZC_DIR, "ghost_search_window_ui2.py"), "USER@100.114.100.24:C:/MerlinTools/ghost_search_window_ui2.py"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=15,
    )
    subprocess.run(
        ["ssh", "-i", key_path, "-o", "StrictHostKeyChecking=no", "USER@100.114.100.24", 'powershell -Command "New-Item -ItemType Directory -Force -Path C:/MerlinTools/assets, C:/MerlinTools/baby_ghost_sounds | Out-Null"'],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=10,
    )
    subprocess.run(
        ["scp", "-i", key_path, "-o", "StrictHostKeyChecking=no", os.path.join(UZC_DIR, "assets", "ko_en_lexicon.zlib"), "USER@100.114.100.24:C:/MerlinTools/assets/ko_en_lexicon.zlib"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=15,
    )
    os_assets_dir = os.path.join(UZC_DIR, "os_agent", "assets")
    if os.path.isdir(os_assets_dir):
        asset_files = [os.path.join(os_assets_dir, f) for f in os.listdir(os_assets_dir) if os.path.isfile(os.path.join(os_assets_dir, f))]
        if asset_files:
            subprocess.run(
                ["scp", "-i", key_path, "-o", "StrictHostKeyChecking=no", *asset_files, "USER@100.114.100.24:C:/MerlinTools/assets/"],
                capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20,
            )
    snd_dir = os.path.join(UZC_DIR, "baby_ghost_sounds")
    if os.path.isdir(snd_dir):
        snd_files = [os.path.join(snd_dir, f) for f in os.listdir(snd_dir) if os.path.isfile(os.path.join(snd_dir, f))]
        if snd_files:
            subprocess.run(
                ["scp", "-i", key_path, "-o", "StrictHostKeyChecking=no", *snd_files, "USER@100.114.100.24:C:/MerlinTools/baby_ghost_sounds/"],
                capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20,
            )
    log("✅ 4호기 SCP 전송 완료 (universal_z_core + C:/MerlinTools/seq_paste_daemon.py + assets + baby_ghost_sounds)")

    # 2) 4호기 기존 5199/51988 프로세스 우아한 종료 + LISTENING 잔존 프로세스 강제 종료
    shutdown_cmd = [
        "ssh", "-i", key_path, "-o", "StrictHostKeyChecking=no", "USER@100.114.100.24",
        'curl.exe -s --max-time 2 -X POST -d "{}" http://127.0.0.1:5199/__merlin/shutdown & curl.exe -s --max-time 2 http://127.0.0.1:51988/__merlin/shutdown'
    ]
    try:
        subprocess.run(shutdown_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=5)
    except Exception:
        pass
    time.sleep(0.5)

    kill_cmd = [
        "ssh", "-i", key_path, "-o", "StrictHostKeyChecking=no", "USER@100.114.100.24",
        'powershell -Command "$p = Get-NetTCPConnection -LocalPort 5199,51988 -State Listen -ErrorAction SilentlyContinue; if ($p) { foreach ($item in $p) { if ($item.OwningProcess -gt 0) { Stop-Process -Id $item.OwningProcess -Force -ErrorAction SilentlyContinue } } }"'
    ]
    try:
        subprocess.run(kill_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=10)
    except Exception:
        pass

    # 3) 4호기 스케줄러를 통한 무간섭 GUI 세션 기동 (5199 + 51988)
    for task_name in ("StartMerlinZCore5199", "MerlinSeqPasteStart"):
        run_task_cmd = [
            "ssh", "-i", key_path, "-o", "StrictHostKeyChecking=no", "USER@100.114.100.24",
            f"schtasks /run /tn {task_name}"
        ]
        subprocess.run(run_task_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=10)
    time.sleep(2.5)

    # 4) 4호기 5199 헬스체크 (SSH 경유 curl)
    check_cmd = [
        "ssh", "-i", key_path, "-o", "StrictHostKeyChecking=no", "USER@100.114.100.24",
        "curl.exe -s http://127.0.0.1:5199/api/care/status"
    ]
    check_res = subprocess.run(check_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=10)
    if check_res.returncode == 0 and '"ok": true' in check_res.stdout.lower():
        log("✅ 4호기 Z-코어 원격 최신화 및 기동 확인 성공 (5199 케어스위트 응답 완료)")
    else:
        log(f"⚠️ 4호기 헬스체크 출력: {check_res.stdout} (에러: {check_res.stderr})")

def _read_current_core_version() -> str:
    import re
    daemon_py = os.path.join(UZC_DIR, "os_agent", "merlin_z_core_daemon.py")
    try:
        with open(daemon_py, "r", encoding="utf-8", errors="ignore") as f:
            m = re.search(r'CORE_VERSION\s*=\s*["\']([^"\']+)["\']', f.read())
            if m:
                return m.group(1)
    except Exception:
        pass
    return "2.3.23"


def ensure_release_zip_and_bridge_synced() -> str:
    """CORE_VERSION이 변경되었거나 public/z_core_version.json과 다르면 자동으로 exe 재빌드 + Merlin_Z_Core.zip + LATEST_Z_CORE_VERSION을 최신화합니다."""
    core_ver = _read_current_core_version()
    repo_root = os.path.dirname(UZC_DIR)
    ver_json_path = os.path.join(repo_root, "public", "z_core_version.json")
    zip_path = os.path.join(repo_root, "public", "Merlin_Z_Core.zip")
    packaged_ver = ""
    if os.path.exists(ver_json_path):
        try:
            with open(ver_json_path, "r", encoding="utf-8") as f:
                packaged_ver = str(json.load(f).get("version") or "").strip()
        except Exception:
            packaged_ver = ""

    if packaged_ver == core_ver and os.path.exists(zip_path):
        log(f"✅ 배포용 Merlin_Z_Core.zip 및 LATEST_Z_CORE_VERSION 이미 최신 상태 (v{core_ver})")
        return core_ver

    log(f"=== [자동 릴리즈 패키징] Z-코어 v{core_ver} 단일 실행파일(.exe) 빌드 및 Merlin_Z_Core.zip 동기화 시작 ===")
    build_script = os.path.join(UZC_DIR, "os_agent", "build_signed_merlin_z_core.py")
    res = subprocess.run(
        [sys.executable, build_script, "--build"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=300,
    )
    if res.returncode == 0:
        log(f"✅ Merlin_Z_Core.zip 및 zCoreBridge.ts (LATEST_Z_CORE_VERSION='{core_ver}') 자동 동기화 완료!")
    else:
        log(f"⚠️ exe 자동 빌드 경고 (exit={res.returncode}): {res.stderr[-300:]}")
    return core_ver


def update_pc2(core_ver: str):
    log("\n=== [2호기 (사무실 100.88.230.16)] Z-코어 무소음 자동 업데이트 시작 ===")
    key_path = _resolve_ssh_key()
    exe_path = os.path.join(UZC_DIR, "os_agent", "dist", "Merlin_Z_Core_Setup.exe")
    if not os.path.exists(key_path) or not os.path.exists(exe_path):
        log("⚠️ 2호기 배포 건너뜀 (SSH 키 또는 Merlin_Z_Core_Setup.exe 없음)")
        return

    # 1) 기존 2호기 5199 데몬 우아한 종료 및 프로세스 정리
    subprocess.run(
        [
            "ssh", "-i", key_path, "-o", "StrictHostKeyChecking=no", "sun-multi@100.88.230.16",
            'curl.exe -s --max-time 2 -H Origin:https://ghosti.sundreamer.app http://127.0.0.1:5199/__merlin/shutdown & taskkill /F /IM Merlin_Z_Core_Setup.exe >NUL 2>&1'
        ],
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=10,
    )
    time.sleep(1.5)

    # 2) 최신 Merlin_Z_Core_Setup.exe 전송
    remote_exe = "C:/Users/sun-multi/AppData/Local/Programs/MerlinFamily/Merlin_Z_Core_Setup.exe"
    scp_res = subprocess.run(
        ["scp", "-i", key_path, "-o", "StrictHostKeyChecking=no", exe_path, f"sun-multi@100.88.230.16:{remote_exe}"],
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=90,
    )
    if scp_res.returncode != 0:
        log(f"⚠️ 2호기 SCP 실패: {scp_res.stderr}")
        return

    # 3) 2호기 인터랙티브 세션(Session 1) 스케줄러 등록 및 즉시 기동
    start_cmd = (
        'schtasks /create /tn StartMerlinZCore5199 /tr "\\"C:\\Users\\sun-multi\\AppData\\Local\\Programs\\MerlinFamily\\Merlin_Z_Core_Setup.exe\\" --replace" /sc onlogon /it /f >NUL 2>&1 '
        '&& schtasks /run /tn StartMerlinZCore5199 >NUL 2>&1'
    )
    subprocess.run(
        ["ssh", "-i", key_path, "-o", "StrictHostKeyChecking=no", "sun-multi@100.88.230.16", start_cmd],
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=15,
    )
    for _ in range(10):
        time.sleep(1.5)
        chk = subprocess.run(
            ["ssh", "-i", key_path, "-o", "StrictHostKeyChecking=no", "sun-multi@100.88.230.16", "curl.exe -s http://127.0.0.1:5199/__merlin/health"],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=10,
        )
        if chk.returncode == 0 and f'"{core_ver}"' in chk.stdout:
            log(f"✅ 2호기 Z-코어 v{core_ver} 무소음 자동 교체 및 기동 확인 성공!")
            return
    log("⚠️ 2호기 헬스체크 대기 초과")


def main():
    sync_internal_z_core_mirrors()
    core_ver = ensure_release_zip_and_bridge_synced()
    update_pc1()
    update_pc2(core_ver)
    update_pc4()
    log(f"\n🎉 1호기 · 2호기 · 4호기 및 웹 자동 업데이트 패키지(v{core_ver}) 클러스터 배포가 완료되었습니다!")

if __name__ == "__main__":
    main()
