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
from contextlib import contextmanager

def log(msg: str):
    print(f"[*] {msg}", flush=True)


UZC_DIR = os.path.dirname(os.path.abspath(__file__))


@contextmanager
def acquire_global_zcore_deploy_lock(timeout_sec: float = 180.0):
    """
    [4개 귀신 창 동시 빌드·배포 충돌 원천 차단 전역 OS 파일 락]:
    - 1~4귀신 창 중 2개 이상이 동시에 exe 빌드·SCP 배포를 실행해 버전을 덮어쓰거나
      원격 PC 엔진을 죽이고 꼬이게 만드는 사고를 Windows OS 파일 락(msvcrt.locking)으로 100% 직렬화합니다.
    """
    if os.environ.get("MERLIN_ZCORE_LOCK_HELD") == "1":
        yield
        return
    lock_path = os.path.join(UZC_DIR, ".zcore_deploy.lock")
    f_lock = open(lock_path, "a+b")
    acquired = False
    t0 = time.time()
    try:
        while True:
            try:
                f_lock.seek(0)
                if os.name == "nt":
                    import msvcrt
                    msvcrt.locking(f_lock.fileno(), msvcrt.LK_NBLCK, 1)
                acquired = True
                break
            except OSError:
                if (time.time() - t0) >= timeout_sec:
                    raise TimeoutError(f"다른 창이 Z-코어 빌드/배포 락({lock_path})을 {timeout_sec}초 이상 점유 중입니다.")
                time.sleep(1.0)
        try:
            f_lock.seek(0)
            f_lock.truncate(0)
            f_lock.write(f"pid={os.getpid()} ts={time.strftime('%Y-%m-%d %H:%M:%S')}\n".encode("utf-8"))
            f_lock.flush()
        except Exception:
            pass
        os.environ["MERLIN_ZCORE_LOCK_HELD"] = "1"
        yield
    finally:
        os.environ.pop("MERLIN_ZCORE_LOCK_HELD", None)
        if acquired and os.name == "nt":
            try:
                import msvcrt
                f_lock.seek(0)
                msvcrt.locking(f_lock.fileno(), msvcrt.LK_UNLCK, 1)
            except Exception:
                pass
        try:
            f_lock.close()
        except Exception:
            pass


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
        os.path.join(UZC_DIR, "os_agent", "plugins", "plugin_ghosti_agent_care.py"),
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
                os.path.join("os_agent", "plugins", "plugin_ghosti_agent_care.py"),
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
                os.path.join("core_power_agent", "merlin_z_core_daemon.py"),
                os.path.join("core_power_agent", "plugin_ghosti_care_suite.py"),
                os.path.join("core_power_agent", "plugins", "plugin_ghosti_agent_care.py"),
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

    src_changed = bool(not last_hash or src_hash != last_hash)
    try:
        open(stamp_file, "w", encoding="utf-8").write(
            json.dumps({"version": target_ver, "srcHash": src_hash, "updatedAt": time.strftime("%Y-%m-%d %H:%M:%S")}, indent=2)
        )
    except Exception:
        pass
    return src_changed

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


def ensure_release_zip_and_bridge_synced(force_rebuild: bool = False) -> str:
    """CORE_VERSION이 변경되었거나 소스 해시가 바뀌었으면 자동으로 exe 재빌드 + Merlin_Z_Core.zip + LATEST_Z_CORE_VERSION을 최신화합니다."""
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

    if not force_rebuild and packaged_ver == core_ver and os.path.exists(zip_path):
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
    """SSH 원격 Windows cmd.exe 8,191자 명령줄 제한을 회피하기 위해 PowerShell stdin 파이핑으로 안전 실행합니다."""
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
            "powershell -NoProfile -NonInteractive -Command -",
        ],
        input=ps_script + "\n",
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout_sec,
    )


def _update_remote_exe_node(label: str, host: str, remote_user: str, core_ver: str):
    log(f"\n=== [{label} ({remote_user}@{host})] 무중단 원자적 스왑 Z-코어(v{core_ver}) 업데이트 시작 ===")
    key_path = _resolve_ssh_key()
    exe_path = os.path.join(UZC_DIR, "os_agent", "dist", "Merlin_Z_Core_Setup.exe")
    if not os.path.exists(key_path) or not os.path.exists(exe_path):
        log(f"⚠️ {label} 배포 건너뜀 (SSH 키 또는 Merlin_Z_Core_Setup.exe 없음)")
        return

    ssh_target = f"{remote_user}@{host}"
    remote_dir_win = f"C:\\Users\\{remote_user}\\AppData\\Local\\Programs\\MerlinFamily"
    remote_exe_win = f"{remote_dir_win}\\Merlin_Z_Core_Setup.exe"
    remote_staging_win = f"{remote_dir_win}\\Merlin_Z_Core_Setup.staging.exe"
    remote_bak_win = f"{remote_dir_win}\\Merlin_Z_Core_Setup.bak.exe"
    remote_staging_scp = f"C:/Users/{remote_user}/AppData/Local/Programs/MerlinFamily/Merlin_Z_Core_Setup.staging.exe"

    # [0단계: 원격 버전 선조회 ➔ 다운그레이드 물리 차단]
    try:
        pre_chk = _run_remote_ps_encoded(
            ssh_target,
            key_path,
            f"New-Item -ItemType Directory -Force -Path '{remote_dir_win}' | Out-Null; New-Item -ItemType Directory -Force -Path 'C:\\Users\\{remote_user}\\AppData\\Local\\Merlin' | Out-Null; $h = curl.exe -s --max-time 2 http://127.0.0.1:5199/__merlin/health; Write-Output $h",
            timeout_sec=15,
        )
        raw_h = (pre_chk.stdout or "").strip()
        if raw_h.startswith("{"):
            rem_ver = str(json.loads(raw_h).get("version") or "").strip()
            if rem_ver and _ver_tuple(rem_ver) > _ver_tuple(core_ver):
                log(f"🛡️ {label} 다운그레이드 차단! 원격이 이미 더 최신(v{rem_ver} > v{core_ver})이므로 배포를 건너뜁니다.")
                return
    except Exception:
        pass

    wl_path = os.path.join(UZC_DIR, "os_agent", "security_services_whitelist.json")
    if os.path.exists(wl_path):
        subprocess.run(
            ["scp", "-i", key_path, "-o", "StrictHostKeyChecking=no", wl_path, f"{ssh_target}:C:/Users/{remote_user}/AppData/Local/Merlin/security_services_whitelist.json"],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30,
        )

    # [1단계: 엔진 살아있는 채로 스테이징 파일 전송 (전송 15초 동안 기존 엔진 먹통 0초!!)]
    import hashlib as _hl
    local_sha256 = _hl.sha256(open(exe_path, "rb").read()).hexdigest().upper()
    scp_res = subprocess.run(
        ["scp", "-i", key_path, "-o", "StrictHostKeyChecking=no", exe_path, f"{ssh_target}:{remote_staging_scp}"],
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=90,
    )
    if scp_res.returncode != 0:
        log(f"❌ {label} 스테이징 SCP 실패 (기존 엔진 무손상 유지): {scp_res.stderr}")
        return

    # [2단계: 원격 staging.exe SHA-256 100% 비트 일치 & PE 헤더 무결성 사전 검증 (GUI 서브시스템 --selftest 호환 문제 없이 0.2초 완벽 검증)]
    verify_staging_ps = f"""
$st = '{remote_staging_win}'
if (-not (Test-Path $st)) {{ Write-Output 'STAGING_MISSING'; exit 2 }}
$h = (Get-FileHash -Path $st -Algorithm SHA256).Hash.ToUpper()
$sz = (Get-Item $st).Length
if ($h -ne '{local_sha256}' -or $sz -lt 10000000) {{
    Remove-Item -Path $st -Force -ErrorAction SilentlyContinue
    Write-Output ("HASH_MISMATCH:" + $h + ":" + $sz)
    exit 3
}}
Write-Output ("HASH_OK:" + $h)
"""
    try:
        v_res = _run_remote_ps_encoded(ssh_target, key_path, verify_staging_ps, timeout_sec=25)
        if v_res.returncode != 0 or f"HASH_OK:{local_sha256}" not in (v_res.stdout or ""):
            log(f"❌ {label} 스테이징 SHA-256 무결성 검증 실패 (기존 엔진 무손상 유지): {(v_res.stdout or v_res.stderr)[:200]}")
            return
    except Exception as e:
        log(f"❌ {label} 스테이징 무결성 검증 타임아웃 (기존 엔진 무손상 유지): {e}")
        return

    # [3단계: 0.5초 원자적 스왑 + 트리 완전 종료(/T) + 구버전 잔존 .exe 완전 소탕 + 인터랙티브 기동]
    swap_and_start_ps = f"""
[Environment]::SetEnvironmentVariable('_MEIPASS2', $null, 'Process')
[Environment]::SetEnvironmentVariable('_MEIPASS', $null, 'Process')
$exe = '{remote_exe_win}'
$st  = '{remote_staging_win}'
$bak = '{remote_bak_win}'

# 3-1) 롤백용 백업 확보
if (Test-Path $exe) {{
    Copy-Item -Path $exe -Destination $bak -Force -ErrorAction SilentlyContinue
}}

# 3-2) 우아한 종료 요청 -> 트리 강제 종료(/T: 좀비 부트로더까지 100% 박멸!) -> 포트 점유 프로세스 종료
curl.exe -s --max-time 2 -H Origin:https://ghosti.sundreamer.app http://127.0.0.1:5199/__merlin/shutdown 2>$null | Out-Null
curl.exe -s --max-time 2 http://127.0.0.1:51988/__merlin/shutdown 2>$null | Out-Null
Start-Sleep -Milliseconds 350
taskkill /F /T /IM Merlin_Z_Core_Setup.exe 2>$null | Out-Null
$p = Get-NetTCPConnection -LocalPort 5199,51988 -State Listen -ErrorAction SilentlyContinue
if ($p) {{ foreach ($item in $p) {{ if ($item.OwningProcess -gt 0) {{ taskkill /F /T /PID $item.OwningProcess 2>$null | Out-Null }} }} }}

# 프로세스 0개 완전 해제 대기 (최대 4초)
for ($w=0; $w -lt 10; $w++) {{
    $alive = @(Get-Process -Name 'Merlin_Z_Core_Setup' -ErrorAction SilentlyContinue)
    if ($alive.Count -eq 0) {{ break }}
    taskkill /F /T /IM Merlin_Z_Core_Setup.exe 2>$null | Out-Null
    Start-Sleep -Milliseconds 400
}}

# 3-3) 구버전 잔존 exe / 충돌 업데이터 / 레거시 스케줄러 / 이전 좀비 임시파일 완전 소탕
schtasks /delete /tn MerlinSeqPasteStart /f 2>$null | Out-Null
Remove-Item -Path 'C:\\MerlinTools\\start_zcore_5199.vbs' -Force -ErrorAction SilentlyContinue
Remove-Item -Path 'C:\\Users\\{remote_user}\\AppData\\Local\\Merlin\\Merlin_Z_Core_Setup.exe' -Force -ErrorAction SilentlyContinue
Remove-Item -Path '{remote_dir_win}\\Merlin_Z_Core_Setup.old.exe' -Force -ErrorAction SilentlyContinue
Remove-Item -Path '{remote_dir_win}\\Merlin_Z_Core_Setup.zombie_*.tmp' -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:TEMP\\merlin_zcore_silent_update\\updater.bat" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\\Merlin\\zcore_rt\\_MEI*" -Recurse -Force -ErrorAction SilentlyContinue

# 3-4) Chrome/VSCode 정공법 Rename-Aside 0.01초 원자적 스왑:
#      Windows NTFS는 커널 좀비 프로세스(taskkill 불가)가 실행파일을 잠그고 있어도
#      '덮어쓰기/삭제'만 막을 뿐 '같은 폴더 내 이름 변경(Rename)'은 100% 허용합니다!
$swapped = $false
for ($k=0; $k -lt 6; $k++) {{
    try {{
        if (Test-Path $exe) {{
            $zombieTmp = "$exe.zombie_" + ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) + ".tmp"
            Move-Item -Path $exe -Destination $zombieTmp -Force -ErrorAction Stop
        }}
        Move-Item -Path $st -Destination $exe -Force -ErrorAction Stop
        $swapped = $true
        break
    }} catch {{
        taskkill /F /T /IM Merlin_Z_Core_Setup.exe 2>$null | Out-Null
        Start-Sleep -Milliseconds 400
    }}
}}
# 치워둔 이전 exe는 잠금이 풀렸으면 즉시 삭제 (좀비가 물고 있으면 다음 배포/재부팅 시 자동 소거)
Remove-Item -Path '{remote_dir_win}\\Merlin_Z_Core_Setup.exe.zombie_*.tmp' -Force -ErrorAction SilentlyContinue
if (-not $swapped) {{
    if (Test-Path $bak) {{ Copy-Item -Path $bak -Destination $exe -Force -ErrorAction SilentlyContinue }}
    Start-ScheduledTask -TaskName 'StartMerlinZCore5199' -ErrorAction SilentlyContinue
    Write-Output 'SWAP_FAILED_ROLLED_BACK'
    exit 4
}}

# 3-5) 모드전환기 캐시 + Run 레지스트리 + 인터랙티브 ONLOGON 예약작업 갱신 및 즉시 기동
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
$set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances Parallel
Stop-ScheduledTask -TaskName 'StartMerlinZCore5199' -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName 'StartMerlinZCore5199' -Action $act -Trigger $trg -Principal $prn -Settings $set -Force | Out-Null
Unregister-ScheduledTask -TaskName 'Ghosti_SecurityCare_ElevatedHelper' -Confirm:$false -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path 'C:\\ProgramData\\Merlin\\care_queue' | Out-Null
icacls 'C:\\ProgramData\\Merlin\\care_queue' /grant '*S-1-5-32-545:(OI)(CI)M' 2>$null | Out-Null
$hAct = New-ScheduledTaskAction -Execute $exe -Argument '--run-elevated-helper'
$hPrn = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'GhostiSecurityCareHelper' -Action $hAct -Principal $hPrn -Settings $set -Force | Out-Null
try {{
    $svc = New-Object -ComObject 'Schedule.Service'
    $svc.Connect()
    $task = $svc.GetFolder('\\').GetTask('GhostiSecurityCareHelper')
    $sd = $task.GetSecurityDescriptor(0xF)
    if ($sd -and $sd -notmatch ';;;BU\\)') {{
        if ($sd.Contains('S:')) {{ $sd = $sd -replace 'S:', '(A;;GRGX;;;BU)S:' }}
        else {{ $sd = $sd + '(A;;GRGX;;;BU)' }}
        $task.SetSecurityDescriptor($sd, 0)
    }}
}} catch {{ }}
Start-ScheduledTask -TaskName 'StartMerlinZCore5199' -ErrorAction SilentlyContinue
Write-Output 'SWAP_OK'
"""
    try:
        sw_res = _run_remote_ps_encoded(ssh_target, key_path, swap_and_start_ps, timeout_sec=40)
        if sw_res.returncode != 0 or "SWAP_OK" not in (sw_res.stdout or ""):
            log(f"⚠️ {label} 원자적 스왑 실패 (자동 롤백 실행됨): {(sw_res.stdout or sw_res.stderr)[:240]}")
            return
    except Exception as e:
        log(f"⚠️ {label} 스왑 단계 예외: {e}")

    # [4단계: 기동 검증 (5199 버전 일치 + 51988 PONG) & 실패 시 자동 롤백으로 엔진 증발 0% 보장]
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
                log(f"✅ {label} Z-코어 v{core_ver} + 귀신창(51988) 무중단 원자적 스왑 및 기동 확인 성공!")
                return
            if chk.returncode == 0 and f'"{core_ver}"' in chk.stdout and attempt >= 11:
                log(f"✅ {label} Z-코어 v{core_ver} + 자동실행(Run & ONLOGON) 기동 확인 성공!")
                return
            if attempt == 9 and f'"{core_ver}"' not in (chk.stdout or ""):
                _run_remote_ps_encoded(
                    ssh_target,
                    key_path,
                    "Start-ScheduledTask -TaskName 'StartMerlinZCore5199' -ErrorAction SilentlyContinue",
                    timeout_sec=12,
                )
        except Exception:
            pass
    # 18회(27초) 내 기동 실패 시 즉시 백업본 롤백 기동 (엔진 증발 원천 방지!)
    log(f"🚨 {label} v{core_ver} 기동 실패 ➔ 즉시 직전 정상 버전(.bak.exe) 자동 롤백 기동!")
    rollback_ps = f"""
taskkill /F /T /IM Merlin_Z_Core_Setup.exe 2>$null | Out-Null
Start-Sleep -Milliseconds 600
if (Test-Path '{remote_bak_win}') {{
    Copy-Item -Path '{remote_bak_win}' -Destination '{remote_exe_win}' -Force -ErrorAction SilentlyContinue
}}
Start-ScheduledTask -TaskName 'StartMerlinZCore5199' -ErrorAction SilentlyContinue
"""
    try:
        _run_remote_ps_encoded(ssh_target, key_path, rollback_ps, timeout_sec=20)
    except Exception:
        pass


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


def update_pc5(core_ver: str):
    _update_remote_exe_node("5호기 (집 100.122.235.63)", "100.122.235.63", "WD", core_ver)


def main():
    with acquire_global_zcore_deploy_lock():
        src_changed = bool(sync_internal_z_core_mirrors())
        core_ver = ensure_release_zip_and_bridge_synced(force_rebuild=src_changed)
        import datetime as _dt
        _now_hr = _dt.datetime.now().hour
        _is_qa_work_hours = (9 <= _now_hr < 15)
        if _is_qa_work_hours:
            log("🕘 [알바 근무시간(09:00~15:00) 전용 배포 모드] 1·2·5·6호기는 제외하고 오직 3호기(달나라)·4호기(해나라)에만 무중단 원자적 스왑 설치합니다.")
            update_pc3(core_ver)
            update_pc4(core_ver)
            log(f"\n🎉 근무시간(09:00~15:00) 안전 배포 완료 — 3호기 · 4호기 Z-코어(v{core_ver}) 설치 완료!")
        else:
            update_pc1()
            update_pc1_remote(core_ver)
            update_pc2(core_ver)
            update_pc3(core_ver)
            update_pc4(core_ver)
            # 5호기(집 PC)는 오프라인 상태일 수 있으므로 2초 TCP 사전 체크 후 도달 가능할 때만 배포
            try:
                import socket
                with socket.create_connection(("100.122.235.63", 22), timeout=2.0):
                    update_pc5(core_ver)
            except Exception:
                log("ℹ️ 5호기 (집 100.122.235.63) 현재 오프라인 — 배포 스킵")
            log(f"\n🎉 전 클러스터(로컬 6호기 · 1호기 · 2호기 · 3호기 · 4호기 · 5호기) 통합 동기화(v{core_ver})가 완료되었습니다!")

if __name__ == "__main__":
    main()
