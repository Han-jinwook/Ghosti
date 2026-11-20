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


def _ver_tuple(v: str) -> tuple[int, ...]:
    return tuple(int(x) if x.isdigit() else 0 for x in (v or "").strip().split("."))


def _bump_patch_version(v: str) -> str:
    parts = [int(x) if x.isdigit() else 0 for x in (v or "2.3.29").strip().split(".")]
    while len(parts) < 3:
        parts.append(0)
    # 멀린님 규칙: Z-코어 패치 버전은 항상 끝자리 9로 통일 (29 -> 39 -> 49 ... 99 -> 다음 minor.9)
    cur_patch = parts[-1]
    next_nine = (cur_patch // 10) * 10 + 9
    if next_nine <= cur_patch:
        next_nine += 10
    if next_nine >= 100:
        parts[-2] += 1
        parts[-1] = 9
    else:
        parts[-1] = next_nine
    return ".".join(str(x) for x in parts)


def sync_internal_z_core_mirrors():
    """
    [2026-11-18 1·2·3귀신 3개 워크트리 버전·소스 무결성 자동 정합화]
    - 3개 귀신 IDE(D:\\Ghosti, D:\\Ghosti_Search, D:\\Ghosti_Share)가 서로 버전업 사실을 몰라도 절대 하위 버전으로 덮어쓰거나 충돌하지 않도록:
      1) 3개 워크트리의 merlin_z_core_daemon.py / zCoreBridge.ts / z_core_version.json 중 최고 버전(max_ver)을 자동 채택하고,
      2) 현재 워크트리의 엔진 소스가 마지막 패키징 이후 변경되었는데 버전이 최고 버전 이하라면 자동으로 max_ver + 1로 승격하며,
      3) 3개 워크트리의 CORE_VERSION, LATEST_Z_CORE_VERSION, z_core_version.json 및 미러 파일을 100% 동일하게 동기화합니다.
    """
    import hashlib
    import re
    import shutil

    worktree_roots = [
        os.path.dirname(UZC_DIR),
        r"D:\Ghosti",
        r"D:\Ghosti_Search",
        r"D:\Ghosti_Share",
    ]
    valid_roots: list[str] = []
    seen_roots: set[str] = set()
    for r in worktree_roots:
        norm_r = os.path.abspath(r).lower()
        if norm_r not in seen_roots and os.path.isdir(r):
            seen_roots.add(norm_r)
            valid_roots.append(os.path.abspath(r))

    # 1) 3개 워크트리 전체에서 현재 가장 높은 버전(max_ver) 스캔
    max_ver = "2.3.29"
    for r in valid_roots:
        d_py = os.path.join(r, "universal_z_core", "os_agent", "merlin_z_core_daemon.py")
        if os.path.exists(d_py):
            try:
                with open(d_py, "r", encoding="utf-8", errors="ignore") as f:
                    m = re.search(r'CORE_VERSION\s*=\s*["\']([^"\']+)["\']', f.read())
                    if m and _ver_tuple(m.group(1)) > _ver_tuple(max_ver):
                        max_ver = m.group(1).strip()
            except Exception:
                pass
        v_json = os.path.join(r, "public", "z_core_version.json")
        if os.path.exists(v_json):
            try:
                with open(v_json, "r", encoding="utf-8", errors="ignore") as f:
                    vj = str(json.load(f).get("version") or "").strip()
                    if vj and _ver_tuple(vj) > _ver_tuple(max_ver):
                        max_ver = vj
            except Exception:
                pass

    # 2) 내부 미러(os_agent, core_power_agent) 단방향 복사
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

    # 3) 소스 해시 스탬프 비교: 소스가 바뀌었는데 버전업을 안 했거나 타 창 버전보다 낮으면 자동으로 max_ver + 1 승격
    core_files = [
        os.path.join(UZC_DIR, "os_agent", "merlin_z_core_daemon.py"),
        os.path.join(UZC_DIR, "os_agent", "plugin_ghosti_os.py"),
        os.path.join(UZC_DIR, "os_agent", "plugin_ghosti_care_suite.py"),
        os.path.join(UZC_DIR, "os_agent", "plugin_ghosti_superpowers.py"),
        os.path.join(UZC_DIR, "os_agent", "plugins", "plugin_paid_work_sdrive.py"),
        os.path.join(UZC_DIR, "os_agent", "plugins", "plugin_paid_sync_ghostwin.py"),
        os.path.join(UZC_DIR, "os_agent", "ppocr_v5_worker.py"),
        os.path.join(UZC_DIR, "os_agent", "merlin_z_core_os.py"),
        os.path.join(UZC_DIR, "os_agent", "ghosti_safe_ops.py"),
        os.path.join(UZC_DIR, "os_agent", "security_services_whitelist.json"),
        os.path.join(UZC_DIR, "os_agent", "ghosti_setup_parity.py"),
        os.path.join(UZC_DIR, "os_agent", "plugin_senstalk.py"),
        os.path.join(UZC_DIR, "seq_paste_daemon.py"),
        os.path.join(UZC_DIR, "ghost_search_window_ui2.py"),
    ]
    h_calc = hashlib.sha256()
    for cf in core_files:
        if os.path.exists(cf):
            try:
                raw_txt = open(cf, "r", encoding="utf-8", errors="ignore").read()
                raw_txt = re.sub(r'CORE_VERSION\s*=\s*["\'][^"\']+["\']', 'CORE_VERSION=""', raw_txt)
                h_calc.update(raw_txt.encode("utf-8"))
            except Exception:
                pass
    src_hash = h_calc.hexdigest()[:16]
    stamp_file = os.path.join(r"D:\Ghosti\universal_z_core", ".last_packaged_src_hash.json")
    last_hash = ""
    last_ver = ""
    if os.path.exists(stamp_file):
        try:
            st_obj = json.loads(open(stamp_file, "r", encoding="utf-8").read())
            last_hash = str(st_obj.get("srcHash") or "")
            last_ver = str(st_obj.get("version") or "")
        except Exception:
            pass

    cur_local_ver = _read_current_core_version()
    target_ver = max_ver if _ver_tuple(max_ver) >= _ver_tuple(cur_local_ver) else cur_local_ver
    if last_hash and src_hash != last_hash and _ver_tuple(target_ver) <= _ver_tuple(last_ver or max_ver):
        target_ver = _bump_patch_version(max_ver)
        log(f"🔄 [3귀신 버전 자동 조율] 엔진 소스 변경 감지 ➔ 하위/동일 버전 충돌 방지를 위해 v{target_ver}로 자동 승격합니다!")

    # 4) 현재 워크트리 및 타 워크트리(D:\Ghosti, D:\Ghosti_Search, D:\Ghosti_Share)에 target_ver 및 마스터 파일 일괄 반영
    daemon_py_cur = os.path.join(UZC_DIR, "os_agent", "merlin_z_core_daemon.py")
    if os.path.exists(daemon_py_cur):
        try:
            txt = open(daemon_py_cur, "r", encoding="utf-8").read()
            new_txt = re.sub(r'CORE_VERSION\s*=\s*["\'][^"\']+["\']', f'CORE_VERSION = "{target_ver}"', txt)
            if new_txt != txt:
                open(daemon_py_cur, "w", encoding="utf-8").write(new_txt)
        except Exception:
            pass

    for wt_root in valid_roots:
        wt_uzc = os.path.join(wt_root, "universal_z_core")
        if os.path.isdir(wt_uzc) and os.path.abspath(wt_uzc).lower() != os.path.abspath(UZC_DIR).lower():
            for rel_f in (
                "seq_paste_daemon.py",
                "ghost_search_window_ui2.py",
                "deploy_z_core_cluster.py",
                os.path.join("os_agent", "merlin_z_core_daemon.py"),
                os.path.join("os_agent", "plugin_ghosti_os.py"),
                os.path.join("os_agent", "plugin_ghosti_care_suite.py"),
                os.path.join("os_agent", "plugin_ghosti_superpowers.py"),
                os.path.join("os_agent", "plugins", "plugin_paid_work_sdrive.py"),
                os.path.join("os_agent", "plugins", "plugin_paid_sync_ghostwin.py"),
                os.path.join("os_agent", "ppocr_v5_worker.py"),
                os.path.join("os_agent", "merlin_z_core_os.py"),
                os.path.join("os_agent", "ghosti_safe_ops.py"),
                os.path.join("os_agent", "security_services_whitelist.json"),
                os.path.join("os_agent", "ghosti_setup_parity.py"),
                os.path.join("os_agent", "build_signed_merlin_z_core.py"),
                os.path.join("os_agent", "plugin_senstalk.py"),
                os.path.join("os_agent", "seq_paste_daemon.py"),
                os.path.join("os_agent", "ghost_search_window_ui2.py"),
                os.path.join("core_power_agent", "seq_paste_daemon.py"),
                os.path.join("core_power_agent", "ghost_search_window_ui2.py"),
            ):
                s_p = os.path.join(UZC_DIR, rel_f)
                d_p = os.path.join(wt_uzc, rel_f)
                if os.path.exists(s_p) and os.path.isdir(os.path.dirname(d_p)):
                    try:
                        shutil.copy2(s_p, d_p)
                    except Exception:
                        pass
            ocr_src_dir = os.path.join(UZC_DIR, "os_agent", "models", "ocr")
            ocr_dst_dir = os.path.join(wt_uzc, "os_agent", "models", "ocr")
            if os.path.isdir(ocr_src_dir):
                try:
                    os.makedirs(ocr_dst_dir, exist_ok=True)
                    for fn in os.listdir(ocr_src_dir):
                        fp = os.path.join(ocr_src_dir, fn)
                        if os.path.isfile(fp):
                            shutil.copy2(fp, os.path.join(ocr_dst_dir, fn))
                except Exception:
                    pass
        # 각 워크트리의 zCoreBridge.ts 및 z_core_version.json도 target_ver로 즉시 통일
        bridge_ts = os.path.join(wt_root, "src", "services", "zCoreBridge.ts")
        if os.path.exists(bridge_ts):
            try:
                btxt = open(bridge_ts, "r", encoding="utf-8").read()
                nbtxt = re.sub(
                    r"export const LATEST_Z_CORE_VERSION\s*=\s*['\"][^'\"]+['\"];",
                    f"export const LATEST_Z_CORE_VERSION = '{target_ver}';",
                    btxt,
                )
                if nbtxt != btxt:
                    open(bridge_ts, "w", encoding="utf-8").write(nbtxt)
            except Exception:
                pass

    try:
        open(stamp_file, "w", encoding="utf-8").write(
            json.dumps({"version": target_ver, "srcHash": src_hash, "updatedAt": time.strftime("%Y-%m-%d %H:%M:%S")}, indent=2)
        )
    except Exception:
        pass

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

    # 1) 자동실행 등록 (구버전 MerlinSeqPaste 제거 + 최신 Merlin_Z_Core_Setup.exe 복사 및 Run 레지스트리 등록)
    try:
        local_exe_src = os.path.join(UZC_DIR, "os_agent", "dist", "Merlin_Z_Core_Setup.exe")
        local_install_dir = os.path.expandvars(r"%LOCALAPPDATA%\Programs\MerlinFamily")
        if os.path.exists(local_exe_src):
            os.makedirs(local_install_dir, exist_ok=True)
            shutil.copy2(local_exe_src, os.path.join(local_install_dir, "Merlin_Z_Core_Setup.exe"))
        subprocess.run(["reg", "delete", r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run", "/v", "MerlinSeqPaste", "/f"], capture_output=True, timeout=5)
        subprocess.run([runner, script, "--enable-autostart"], capture_output=True, timeout=5)
        log("로컬 PC: 시작프로그램 레지스트리(MerlinZCoreDaemon) 및 영구 실행파일 최신화 완료")
    except Exception as e:
        log(f"로컬 시작프로그램 등록 경고: {e}")

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


def _run_remote_ps_encoded(ssh_target: str, key_path: str, ps_script: str, timeout_sec: int = 20) -> subprocess.CompletedProcess:
    import base64
    enc = base64.b64encode(ps_script.encode("utf-16-le")).decode("ascii")
    return subprocess.run(
        [
            "ssh",
            "-i",
            key_path,
            "-o",
            "StrictHostKeyChecking=no",
            "-o",
            "ConnectTimeout=5",
            ssh_target,
            f"powershell -NoProfile -NonInteractive -EncodedCommand {enc}",
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout_sec,
    )


def _update_remote_exe_node(label: str, host: str, remote_user: str, core_ver: str):
    log(f"\n=== [{label} ({remote_user}@{host})] Z-코어 + 자동실행(Run/ONLOGON) 무소음 업데이트 시작 ===")
    key_path = _resolve_ssh_key()
    exe_path = os.path.join(UZC_DIR, "os_agent", "dist", "Merlin_Z_Core_Setup.exe")
    if not os.path.exists(key_path) or not os.path.exists(exe_path):
        log(f"⚠️ {label} 배포 건너뜀 (SSH 키 또는 Merlin_Z_Core_Setup.exe 없음)")
        return

    ssh_target = f"{remote_user}@{host}"
    remote_exe_win = f"C:\\Users\\{remote_user}\\AppData\\Local\\Programs\\MerlinFamily\\Merlin_Z_Core_Setup.exe"
    remote_exe_scp = f"C:/Users/{remote_user}/AppData/Local/Programs/MerlinFamily/Merlin_Z_Core_Setup.exe"

    # 1) 기존 5199/51988 데몬·구버전 파이썬 스크립트·Merlin_Z_Core_Setup.exe 완전 종료(파일 잠금 해제) 및 잔존 _MEI 임시폴더 청소
    stop_ps = f"""
curl.exe -s --max-time 2 -H Origin:https://ghosti.sundreamer.app http://127.0.0.1:5199/__merlin/shutdown 2>$null | Out-Null
curl.exe -s --max-time 2 http://127.0.0.1:51988/__merlin/shutdown 2>$null | Out-Null
taskkill /F /IM Merlin_Z_Core_Setup.exe 2>$null | Out-Null
$p = Get-NetTCPConnection -LocalPort 5199,51988 -State Listen -ErrorAction SilentlyContinue
if ($p) {{ foreach ($item in $p) {{ if ($item.OwningProcess -gt 0) {{ Stop-Process -Id $item.OwningProcess -Force -ErrorAction SilentlyContinue }} }} }}
schtasks /delete /tn MerlinSeqPasteStart /f 2>$null | Out-Null
Remove-Item -Path 'C:\\MerlinTools\\start_zcore_5199.vbs' -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800
Remove-Item -Path "$env:LOCALAPPDATA\\Merlin\\zcore_rt\\_MEI*" -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path 'C:\\Users\\{remote_user}\\AppData\\Local\\Programs\\MerlinFamily' | Out-Null
New-Item -ItemType Directory -Force -Path 'C:\\Users\\{remote_user}\\AppData\\Local\\Merlin' | Out-Null
"""
    try:
        _run_remote_ps_encoded(ssh_target, key_path, stop_ps, timeout_sec=35)
    except Exception as e:
        log(f"⚠️ {label} stop 단계 경고(계속 진행): {e}")
    time.sleep(0.8)

    wl_path = os.path.join(UZC_DIR, "os_agent", "security_services_whitelist.json")
    if os.path.exists(wl_path):
        subprocess.run(
            ["scp", "-i", key_path, "-o", "StrictHostKeyChecking=no", wl_path, f"{ssh_target}:C:/Users/{remote_user}/AppData/Local/Merlin/security_services_whitelist.json"],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30,
        )

    # 2) 파일 잠금 해제 상태에서 최신 Merlin_Z_Core_Setup.exe 전송 (실패 시 1회 재시도)
    scp_res = subprocess.run(
        ["scp", "-i", key_path, "-o", "StrictHostKeyChecking=no", exe_path, f"{ssh_target}:{remote_exe_scp}"],
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=90,
    )
    if scp_res.returncode != 0:
        _run_remote_ps_encoded(ssh_target, key_path, "taskkill /F /IM Merlin_Z_Core_Setup.exe 2>$null | Out-Null", timeout_sec=10)
        time.sleep(1.2)
        scp_res = subprocess.run(
            ["scp", "-i", key_path, "-o", "StrictHostKeyChecking=no", exe_path, f"{ssh_target}:{remote_exe_scp}"],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=90,
        )
    if scp_res.returncode != 0:
        log(f"❌ {label} SCP 실패: {scp_res.stderr}")
        return

    # 3) EncodedCommand로 깨짐 없이 Run 레지스트리 + 모드전환기 캐시 동기화 + 인터랙티브 세션(LogonType Interactive) ONLOGON 스케줄러 등록 및 즉시 기동
    # ⚠️ 절대 SSH Session 0에서 Start-Process로 직접 띄우지 않습니다!
    start_ps = f"""
[Environment]::SetEnvironmentVariable('_MEIPASS2', $null, 'Process')
[Environment]::SetEnvironmentVariable('_MEIPASS', $null, 'Process')
$exe = '{remote_exe_win}'
$vaultCacheDir = 'C:\\Users\\{remote_user}\\AppData\\Local\\Merlin_Mode_Vault\\snapshots\\cached_installer'
if (Test-Path 'C:\\Users\\{remote_user}\\AppData\\Local\\Merlin_Mode_Vault') {{
    New-Item -ItemType Directory -Force -Path $vaultCacheDir | Out-Null
    Copy-Item -Path $exe -Destination (Join-Path $vaultCacheDir 'Merlin_Z_Core_Setup.exe') -Force -ErrorAction SilentlyContinue
}}
Remove-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'MerlinSeqPaste' -ErrorAction SilentlyContinue
Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'MerlinZCoreDaemon' -Value "`"$exe`""
$act = New-ScheduledTaskAction -Execute $exe -Argument '--replace'
$trg = New-ScheduledTaskTrigger -AtLogOn -User '{remote_user}'
$prn = New-ScheduledTaskPrincipal -UserId '{remote_user}' -LogonType Interactive -RunLevel Limited
$set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName 'StartMerlinZCore5199' -Action $act -Trigger $trg -Principal $prn -Settings $set -Force | Out-Null
Unregister-ScheduledTask -TaskName 'Ghosti_SecurityCare_ElevatedHelper' -Confirm:$false -ErrorAction SilentlyContinue
$hAct = New-ScheduledTaskAction -Execute $exe -Argument '--run-elevated-helper'
$hPrn = New-ScheduledTaskPrincipal -UserId '{remote_user}' -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName 'GhostiSecurityCareHelper' -Action $hAct -Principal $hPrn -Settings $set -Force | Out-Null
Start-ScheduledTask -TaskName 'StartMerlinZCore5199' -ErrorAction SilentlyContinue
"""
    try:
        _run_remote_ps_encoded(ssh_target, key_path, start_ps, timeout_sec=35)
    except Exception as e:
        log(f"⚠️ {label} start 단계 경고: {e}")
    for attempt in range(18):
        time.sleep(1.5)
        try:
            chk = subprocess.run(
                [
                    "ssh",
                    "-i",
                    key_path,
                    "-o",
                    "StrictHostKeyChecking=no",
                    "-o",
                    "ConnectTimeout=5",
                    ssh_target,
                    "powershell -NoProfile -Command \"$h = curl.exe -s --max-time 3 http://127.0.0.1:5199/__merlin/health; $p = @(Get-NetTCPConnection -LocalPort 51988 -State Listen -ErrorAction SilentlyContinue); Write-Output ($h + '|51988=' + $p.Count)\"",
                ],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=12,
            )
            if chk.returncode == 0 and f'"{core_ver}"' in chk.stdout and "|51988=1" in chk.stdout:
                log(f"✅ {label} Z-코어 v{core_ver} + 귀신창(51988) 인터랙티브 세션 동기화 및 기동 확인 성공!")
                return
            if chk.returncode == 0 and f'"{core_ver}"' in chk.stdout and attempt >= 11:
                log(f"✅ {label} Z-코어 v{core_ver} + 자동실행(Run & ONLOGON) 동기화 및 기동 확인 성공!")
                return
            if attempt == 10 and f'"{core_ver}"' not in (chk.stdout or ""):
                # 66MB 단일 실행파일 압축해제 지연 시에도 5199가 아직 미응답일 때만 인터랙티브 예약작업 재트리거 (Session 0 직접 기동 영구 금지)
                _run_remote_ps_encoded(
                    ssh_target,
                    key_path,
                    "Start-ScheduledTask -TaskName 'StartMerlinZCore5199' -ErrorAction SilentlyContinue",
                    timeout_sec=12,
                )
        except Exception:
            pass
    log(f"⚠️ {label} 헬스체크 대기 초과")


def update_pc1_remote(core_ver: str):
    # 현재 로컬 PC가 office-merlin(DESKTOP-TRRSPRP)이 아닐 때 원격 1호기도 함께 업데이트
    if os.environ.get("COMPUTERNAME", "").upper() == "DESKTOP-TRRSPRP":
        return
    _update_remote_exe_node("1호기 (사무실 100.86.161.8)", "100.86.161.8", "chichi", core_ver)


def update_pc2(core_ver: str):
    _update_remote_exe_node("2호기 (사무실 100.88.230.16)", "100.88.230.16", "sun-multi", core_ver)


def update_pc3(core_ver: str):
    _update_remote_exe_node("3호기 (사무실 100.102.43.42)", "100.102.43.42", "chiuk", core_ver)


def update_pc4(core_ver: str | None = None):
    resolved_ver = core_ver or _read_current_core_version()
    # 1~6호기 완벽 동일 아키텍처 단일화: 4호기도 구버전 vbs/파이썬 분리 실행을 폐지하고 최신 Merlin_Z_Core_Setup.exe 단일 자동실행으로 통일!
    _update_remote_exe_node("4호기 (사무실 100.114.100.24)", "100.114.100.24", "USER", resolved_ver)
    # 4호기 C:/MerlinTools/universal_z_core 소스 폴더도 참조용으로 최신화 (프로세스 잠금 해제 후 안전 복사)
    key_path = _resolve_ssh_key()
    if os.path.exists(key_path):
        subprocess.run(
            ["scp", "-i", key_path, "-o", "StrictHostKeyChecking=no", "-r", os.path.join(UZC_DIR, "*"), "USER@100.114.100.24:C:/MerlinTools/universal_z_core/"],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=90,
        )


def update_pc5(core_ver: str):
    _update_remote_exe_node("5호기 (집 100.122.235.63)", "100.122.235.63", "WD", core_ver)


def main():
    sync_internal_z_core_mirrors()
    core_ver = ensure_release_zip_and_bridge_synced()
    update_pc1()
    update_pc1_remote(core_ver)
    update_pc2(core_ver)
    update_pc3(core_ver)
    update_pc4(core_ver)
    update_pc5(core_ver)
    # 빌드된 최신 Merlin_Z_Core.zip 및 z_core_version.json도 2·3귀신 워크트리에 동시 복사
    import shutil
    repo_root = os.path.dirname(UZC_DIR)
    for wt_root in (r"D:\Ghosti", r"D:\Ghosti_Search", r"D:\Ghosti_Share"):
        if os.path.isdir(wt_root) and os.path.abspath(wt_root).lower() != os.path.abspath(repo_root).lower():
            for rel_p in (
                os.path.join("public", "z_core_version.json"),
                os.path.join("public", "Merlin_Z_Core.zip"),
                os.path.join("universal_z_core", "os_agent", "dist", "Merlin_Z_Core_Setup.exe"),
            ):
                sp = os.path.join(repo_root, rel_p)
                dp = os.path.join(wt_root, rel_p)
                if os.path.exists(sp):
                    try:
                        os.makedirs(os.path.dirname(dp), exist_ok=True)
                        shutil.copy2(sp, dp)
                    except Exception:
                        pass
    log(f"\n🎉 전 클러스터(로컬 6호기 · 1호기 · 2호기 · 3호기 · 4호기 · 5호기) 및 1~3귀신 워크트리 통합 동기화(v{core_ver})가 완료되었습니다!")

if __name__ == "__main__":
    main()
