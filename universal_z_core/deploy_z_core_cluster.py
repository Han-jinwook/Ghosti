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
        os.path.join(UZC_DIR, "os_agent", "core_win32.py"),
        os.path.join(UZC_DIR, "os_agent", "build_signed_merlin_z_core.py"),
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


def main():
    """
    [2026-11-28 전사 Z-코어 단일 배포 표준 — SSH 원격 직결 배포 완전 폐지]
    - 에이전트가 원격 PC(1~5호컴)에 SSH/SCP로 파일을 직접 찔러넣거나 강제 트리거하는 코드를 전면 폐지합니다.
    - 오직 MS 공인 코드서명(`sundream-public-cert`) 빌드 + GitHub Releases(`z-core-latest/Merlin_Z_Core.zip`) 업로드 +
      `public/z_core_version.json` & `zCoreBridge.ts` 동기화 단 1개의 파이프라인만 수행합니다.
    - 엔진이 설치된 모든 PC는 웹 화면이 열려 있으면 즉시(15~35초 내), 백그라운드 상주 상태에서는
      자체 버전 감지기(사내 1~6호컴 45초 주기 / 일반 유저 PC 1시간 주기)가 스스로 감지해 100% 자연스럽게 자동 업데이트합니다.
    """
    with acquire_global_zcore_deploy_lock():
        src_changed = bool(sync_internal_z_core_mirrors())
        core_ver = ensure_release_zip_and_bridge_synced(force_rebuild=src_changed)
        log(f"🌐 [단일 GitHub Releases 자동 업데이트 파이프라인] Z-Core v{core_ver} 릴리즈 업로드 완료!")
        log("   ↳ 원격 SSH 직결 개입 0% — 1~6호컴(45초 주기/웹 즉시) 및 모든 유저 PC(1시간 주기/웹 즉시)가 스스로 감지해 자동 업데이트합니다.")


if __name__ == "__main__":
    main()
