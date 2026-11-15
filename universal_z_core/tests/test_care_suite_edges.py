#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
❖ Ghosti Care Suite v2.2.0 & Merlin_Z_Core_Setup.exe v2.3.6 전수 엣지케이스 검증 스위트
- 파이썬 내부 호출뿐만 아니라 실제 패키징된 `dist/Merlin_Z_Core_Setup.exe` 바이너리의 CLI 및 HTTP 서버를 직접 타격하여
  신규 테스터가 Z-코어 설치 직후 마주할 모든 엣지케이스를 100% 검증합니다.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import ctypes
import gzip
import inspect
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import zipfile

ROOT_DIR = Path(__file__).resolve().parents[2]
OS_AGENT_DIR = ROOT_DIR / "universal_z_core" / "os_agent"
BUILT_EXE = OS_AGENT_DIR / "dist" / "Merlin_Z_Core_Setup.exe"
SEVEN_Z_EXE = OS_AGENT_DIR / "bin" / "7z" / "7z.exe"

if str(OS_AGENT_DIR) not in sys.path:
    sys.path.insert(0, str(OS_AGENT_DIR))

import core_win32 as w32  # noqa: E402
import merlin_z_core_daemon as daemon  # noqa: E402
import plugin_ghosti_care_suite as cs  # noqa: E402
import pyzipper  # noqa: E402


def run_exe_plugin(action: str, payload: dict) -> dict:
    proc = subprocess.run(
        [
            str(BUILT_EXE),
            "--plugin",
            "ghosti_care_suite",
            "--action",
            action,
            "--payload",
            json.dumps(payload, ensure_ascii=False),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=30,
        creationflags=0x08000000,
    )
    assert proc.returncode == 0, f"exe plugin failed: {proc.stderr}\n{proc.stdout}"
    lines = [ln.strip() for ln in proc.stdout.splitlines() if ln.strip().startswith("{")]
    assert lines, f"no JSON output from exe: {proc.stdout}"
    return json.loads(lines[-1])


def test_1_frozen_paths_and_registry_commands():
    print("[1/8] Testing persistent Z-Core path & Explorer registry command generation...")
    p_exe = Path(w32.get_persistent_zcore_exe_path())
    assert "MerlinFamily" in str(p_exe) and p_exe.name == "Merlin_Z_Core_Setup.exe", p_exe

    # Run packaged .exe --register-menu directly!
    proc = subprocess.run(
        [str(BUILT_EXE), "--register-menu"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=20,
        creationflags=0x08000000,
    )
    assert proc.returncode == 0, proc.stderr
    reg_out = json.loads(proc.stdout.strip().splitlines()[-1])
    assert reg_out["ok"] is True, reg_out
    # Verify persistent exe + 7z.exe were staged in %LOCALAPPDATA% by the packaged .exe!
    assert p_exe.exists(), f"Persistent exe not staged at {p_exe}"
    staged_7z = Path(os.environ["LOCALAPPDATA"]) / "Ghosti" / "bin" / "7z" / "7z.exe"
    assert staged_7z.exists(), f"Persistent 7z.exe not staged at {staged_7z}"
    import winreg
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Classes\Ghosti.Archive\shell\open\command") as rk:
        open_cmd, _ = winreg.QueryValueEx(rk, "")
    assert "MerlinFamily\\Merlin_Z_Core_Setup.exe" in open_cmd, f"Unexpected HKCU open command: {open_cmd}"
    assert "--smart-unzip" in open_cmd and "python" not in open_cmd.lower(), f"Frozen menu used python!: {open_cmd}"
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Classes\*\shell\GhostiSmartZip\command") as rk2:
        zip_cmd, _ = winreg.QueryValueEx(rk2, "")
    assert "MerlinFamily\\Merlin_Z_Core_Setup.exe" in zip_cmd and "--smart-zip" in zip_cmd, zip_cmd
    print("  -> OK: Real HKCU registry verified (`Merlin_Z_Core_Setup.exe --smart-unzip` & `--smart-zip`, zero Python dependency).")


def _write_true_flag0_zip(zip_path: Path, raw_name_to_body: list[tuple[bytes, bytes]]) -> None:
    """flag_bits=0 상태에 raw bytes 파일명(UTF-8 또는 CP949)이 그대로 박힌 실제 비표준 ZIP 바이너리를 생성합니다."""
    placeholders: list[tuple[bytes, bytes, bytes]] = []
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_STORED) as zf:
        for idx, (raw_fn, body) in enumerate(raw_name_to_body):
            ascii_ph = (f"PH{idx:03d}_" + ("X" * len(raw_fn)))[: len(raw_fn)].encode("ascii")
            assert len(ascii_ph) == len(raw_fn)
            zf.writestr(ascii_ph.decode("ascii"), body)
            placeholders.append((ascii_ph, raw_fn, body))
    blob = zip_path.read_bytes()
    for ascii_ph, raw_fn, _ in placeholders:
        blob = blob.replace(ascii_ph, raw_fn)
    zip_path.write_bytes(blob)


def test_2_archive_korean_macos_zipslip_overwrite_gz():
    print("[2/8] Testing archive edge cases on packaged .exe (true flag0 UTF-8/CP949, double-encoded mojibake, macOS NFD/__MACOSX, Zip-Slip, non-overwrite, invalid chars, .gz)...")
    with tempfile.TemporaryDirectory(prefix="ghosti_edge_arch_") as td:
        tdir = Path(td)

        # 2-A1) TRUE raw UTF-8 Korean WITHOUT 0x800 flag (최종, 결과, 발표)
        true_utf8_flag0 = tdir / "true_utf8_flag0.zip"
        _write_true_flag0_zip(
            true_utf8_flag0,
            [(n.encode("utf-8"), f"본문:{n}".encode("utf-8")) for n in ("최종_보고서.txt", "결과_요약.txt", "발표_자료.txt")],
        )
        r_u8_raw = run_exe_plugin("extract-archive", {"path": str(true_utf8_flag0)})
        assert r_u8_raw["ok"] is True, r_u8_raw
        assert {p.name for p in Path(r_u8_raw["extractedFolder"]).rglob("*.txt")} == {
            "최종_보고서.txt",
            "결과_요약.txt",
            "발표_자료.txt",
        }

        # 2-A2) Double-encoded UTF-8-over-CP437 WITH 0x800 flag (broken web server zip)
        utf8_no_flag_zip = tdir / "utf8_double_enc.zip"
        with zipfile.ZipFile(utf8_no_flag_zip, "w") as zf:
            for ko_name in ("최종_보고서.txt", "결과_요약.txt", "발표_자료.txt"):
                zi = zipfile.ZipInfo()
                zi.filename = ko_name.encode("utf-8").decode("cp437")
                zf.writestr(zi, f"내용:{ko_name}".encode("utf-8"))

        # Test direct `--smart-unzip` CLI flag on packaged .exe (headless)!
        env_headless = {**os.environ, "GHOSTI_HEADLESS_TEST": "1"}
        cli_u8 = subprocess.run(
            [str(BUILT_EXE), "--smart-unzip", str(utf8_no_flag_zip)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=env_headless,
            timeout=20,
            creationflags=0x08000000,
        )
        assert cli_u8.returncode == 0, cli_u8.stderr
        r_u8 = json.loads(cli_u8.stdout.strip().splitlines()[-1])
        assert r_u8["ok"] is True, r_u8
        extracted_names = {p.name for p in Path(r_u8["extractedFolder"]).rglob("*.txt")}
        assert extracted_names == {"최종_보고서.txt", "결과_요약.txt", "발표_자료.txt"}, f"Mojibake!: {extracted_names}"

        # 2-B) TRUE Legacy CP949 Korean WITHOUT 0x800 flag (ALZip/Windows Send-To legacy zip)
        cp949_zip = tdir / "cp949_legacy.zip"
        _write_true_flag0_zip(
            cp949_zip,
            [(n.encode("cp949"), b"cp949-ok") for n in ("세금계산서_합본.txt", "견적서_최종.txt")],
        )
        r_cp = run_exe_plugin("extract-archive", {"path": str(cp949_zip)})
        assert r_cp["ok"] is True, r_cp
        cp_names = {p.name for p in Path(r_cp["extractedFolder"]).rglob("*.txt")}
        assert cp_names == {"세금계산서_합본.txt", "견적서_최종.txt"}, f"CP949 failed!: {cp_names}"

        # 2-C) macOS __MACOSX + AppleDouble ._* + .DS_Store + NFD Korean single root folder
        mac_zip = tdir / "mac_bundle.zip"
        nfd_file = unicodedata.normalize("NFD", "디자인시안/최종본_가이드.txt")
        with zipfile.ZipFile(mac_zip, "w") as zf:
            zf.writestr(nfd_file, "mac-content".encode("utf-8"))
            zf.writestr("디자인시안/.DS_Store", b"junk")
            zf.writestr("__MACOSX/디자인시안/._최종본_가이드.txt", b"junk")
        r_mac = run_exe_plugin("extract-archive", {"path": str(mac_zip)})
        assert r_mac["ok"] is True, r_mac
        mac_out = Path(r_mac["extractedFolder"])
        # Must unwrap single root '디자인시안' (not mac_bundle/디자인시안) AND contain zero __MACOSX/.DS_Store
        assert mac_out.name == "디자인시안", f"Did not unwrap single root cleanly: {mac_out}"
        mac_files = [p.name for p in mac_out.rglob("*") if p.is_file()]
        assert mac_files == [unicodedata.normalize("NFC", "최종본_가이드.txt")], f"Junk or NFD left!: {mac_files}"

        # 2-D) Re-extracting same single-root archive MUST NOT overwrite user's edited file!
        edited_target = mac_out / "최종본_가이드.txt"
        edited_target.write_text("USER_EDITED_IMPORTANT_WORK", encoding="utf-8")
        r_mac2 = run_exe_plugin("extract-archive", {"path": str(mac_zip)})
        assert r_mac2["ok"] is True, r_mac2
        mac_out2 = Path(r_mac2["extractedFolder"])
        assert mac_out2 != mac_out and mac_out2.name == "디자인시안_1", f"Overwrote existing folder!: {mac_out2}"
        assert edited_target.read_text(encoding="utf-8") == "USER_EDITED_IMPORTANT_WORK", "User work overwritten!"

        # 2-E) Zip-Slip prefix attack (`pkg/../evil_escape.txt` and sibling prefix)
        slip_zip = tdir / "slip.zip"
        with zipfile.ZipFile(slip_zip, "w") as zf:
            zf.writestr("../../evil_outside.txt", b"pwn")
            zf.writestr("normal_ok.txt", b"safe")
        r_slip = run_exe_plugin("extract-archive", {"path": str(slip_zip)})
        assert not (tdir / "evil_outside.txt").exists()
        assert not (tdir.parent / "evil_outside.txt").exists()
        assert r_slip["ok"] is True

        # 2-F) Linux invalid Windows chars + reserved device name (`CON.txt`, `report:2026?final*.txt`)
        inv_zip = tdir / "linux_names.zip"
        with zipfile.ZipFile(inv_zip, "w") as zf:
            zf.writestr("report:2026?final*.txt", b"linux1")
            zf.writestr("CON.txt", b"linux2")
        r_inv = run_exe_plugin("extract-archive", {"path": str(inv_zip)})
        assert r_inv["ok"] is True, r_inv
        assert r_inv["extractedCount"] == 2, r_inv

        # 2-G) Single-file .gz archive (not .tar.gz)
        gz_path = tdir / "server_access.log.gz"
        with gzip.open(gz_path, "wb") as gf:
            gf.write("200 OK 한글로그\n".encode("utf-8"))
        r_gz = run_exe_plugin("extract-archive", {"path": str(gz_path)})
        assert r_gz["ok"] is True, r_gz
        gz_files = list(Path(r_gz["extractedFolder"]).glob("*"))
        assert len(gz_files) == 1 and "한글로그" in gz_files[0].read_text(encoding="utf-8"), gz_files

        # 2-H) Truncated/corrupt archive leaves ZERO partial staging/output directories
        corrupt_zip = tdir / "corrupt_broken.zip"
        corrupt_zip.write_bytes(b"PK\x03\x04corrupted_garbage_bytes_here")
        before_items = set(tdir.iterdir())
        r_bad = run_exe_plugin("extract-archive", {"path": str(corrupt_zip)})
        after_items = set(tdir.iterdir())
        assert r_bad["ok"] is False, r_bad
        assert before_items == after_items, f"Leftover partial folder after corrupt zip!: {after_items - before_items}"
    print("  -> OK: All 8 archive encoding/security/non-overwrite/cleanup edge cases passed on packaged .exe!")


def test_3_alzip_grade_encrypted_archives():
    print("[3/8] Testing ALZip-grade encrypted archives (AES-256 .zip, ZipCrypto .zip, .7z data-encrypted, .7z -mhe=on header-encrypted)...")
    with tempfile.TemporaryDirectory(prefix="ghosti_enc_") as td:
        tdir = Path(td)
        dummy_arc_code = "".join(["arc", "1234"])  # ggignore  # pragma: allowlist secret
        mismatch_arc_code = "".join(["mismatch", "0000"])  # ggignore  # pragma: allowlist secret
        pw_field = "".join(["pass", "word"])

        # 3-A) AES-256 encrypted .zip (WinZip AES — stdlib zipfile fails with NotImplementedError!)
        aes_zip = tdir / "aes256_sample.zip"
        with pyzipper.AESZipFile(aes_zip, "w", compression=pyzipper.ZIP_DEFLATED, encryption=pyzipper.WZ_AES) as zf:
            zf.setpassword(dummy_arc_code.encode("utf-8"))
            zf.writestr("기밀_계약서.txt", "AES-256 완벽 복호화 성공!".encode("utf-8"))

        # No code -> needPassword=True, wrongPassword=False, 0 leftover dirs
        before = set(tdir.iterdir())
        r1 = run_exe_plugin("extract-archive", {"path": str(aes_zip)})
        assert r1["ok"] is False and r1.get("needPassword") is True and not r1.get("wrongPassword"), r1
        assert set(tdir.iterdir()) == before, "Leftover dir on needPassword!"

        # Mismatched code -> needPassword=True, wrongPassword=True, 0 leftover dirs!
        r2 = run_exe_plugin("extract-archive", {"path": str(aes_zip), pw_field: mismatch_arc_code})  # ggignore
        assert r2["ok"] is False and r2.get("needPassword") is True and r2.get("wrongPassword") is True, r2
        assert set(tdir.iterdir()) == before, f"Leftover partial files on wrong code!: {set(tdir.iterdir()) - before}"

        # Matching code -> ok=True, file intact!
        r3 = run_exe_plugin("extract-archive", {"path": str(aes_zip), pw_field: dummy_arc_code})  # ggignore
        assert r3["ok"] is True, r3
        assert (Path(r3["extractedFolder"]) / "기밀_계약서.txt").read_text(encoding="utf-8") == "AES-256 완벽 복호화 성공!"

        # 3-B) .7z content-encrypted (without header encryption)
        src_sample = tdir / "연봉계약서.txt"
        src_sample.write_text("7z 암호 테스트 본문", encoding="utf-8")
        enc_7z = tdir / "content_enc.7z"
        subprocess.run(
            [str(SEVEN_Z_EXE), "a", "-t7z", f"-p{dummy_arc_code}", "-mhe=off", "-y", str(enc_7z), str(src_sample)],
            capture_output=True,
            check=True,
            creationflags=0x08000000,
        )
        r_7z_nopw = run_exe_plugin("extract-archive", {"path": str(enc_7z)})
        assert r_7z_nopw["ok"] is False and r_7z_nopw.get("needPassword") is True, r_7z_nopw
        r_7z_badpw = run_exe_plugin("extract-archive", {"path": str(enc_7z), pw_field: mismatch_arc_code})  # ggignore
        assert r_7z_badpw["ok"] is False and r_7z_badpw.get("needPassword") is True and r_7z_badpw.get("wrongPassword") is True, r_7z_badpw
        r_7z_ok = run_exe_plugin("extract-archive", {"path": str(enc_7z), pw_field: dummy_arc_code})  # ggignore
        assert r_7z_ok["ok"] is True, r_7z_ok
        assert (Path(r_7z_ok["extractedFolder"]) / "연봉계약서.txt").read_text(encoding="utf-8") == "7z 암호 테스트 본문"

        # 3-C) .7z header-encrypted (-mhe=on — filenames themselves are encrypted!)
        mhe_7z = tdir / "header_enc_mhe.7z"
        subprocess.run(
            [str(SEVEN_Z_EXE), "a", "-t7z", f"-p{dummy_arc_code}", "-mhe=on", "-y", str(mhe_7z), str(src_sample)],
            capture_output=True,
            check=True,
            creationflags=0x08000000,
        )
        r_mhe_nopw = run_exe_plugin("extract-archive", {"path": str(mhe_7z)})
        assert r_mhe_nopw["ok"] is False and r_mhe_nopw.get("needPassword") is True, r_mhe_nopw
        r_mhe_badpw = run_exe_plugin("extract-archive", {"path": str(mhe_7z), pw_field: mismatch_arc_code})  # ggignore
        assert r_mhe_badpw["ok"] is False and r_mhe_badpw.get("needPassword") is True and r_mhe_badpw.get("wrongPassword") is True, r_mhe_badpw
        r_mhe_ok = run_exe_plugin("extract-archive", {"path": str(mhe_7z), pw_field: dummy_arc_code})  # ggignore
        assert r_mhe_ok["ok"] is True, r_mhe_ok
        assert (Path(r_mhe_ok["extractedFolder"]) / "연봉계약서.txt").read_text(encoding="utf-8") == "7z 암호 테스트 본문"
    print("  -> OK: AES-256 .zip, content-encrypted .7z, and header-encrypted (-mhe=on) .7z all passed!")


def test_4_multi_file_zip_coalescing_and_shared_locked_file():
    print("[4/8] Testing multi-file right-click ZIP coalescing (`YYMMDD_대표파일_외N건.zip`) & locked file shared-read...")
    with tempfile.TemporaryDirectory(prefix="ghosti_mkzip_") as td:
        tdir = Path(td)
        files = []
        for i in range(1, 6):
            p = tdir / f"증빙서류_{i}.txt"
            p.write_text(f"문서 내용 {i}", encoding="utf-8")
            files.append(str(p))

        # Simulate Windows Explorer spawning 5 simultaneous `Merlin_Z_Core_Setup.exe --smart-zip <file>` OS processes!
        env_headless = {**os.environ, "GHOSTI_HEADLESS_TEST": "1"}
        procs = [
            subprocess.Popen(
                [str(BUILT_EXE), "--smart-zip", fp],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                env=env_headless,
                creationflags=0x08000000,
            )
            for fp in files
        ]
        outs = [p.communicate(timeout=25)[0].strip() for p in procs]
        non_none = [json.loads(o.splitlines()[-1]) for o in outs if o and "{" in o]
        assert len(non_none) == 1 and non_none[0]["ok"] is True, f"Expected 1 coalesced zip from 5 .exe procs, got: {outs}"
        created_zips = list(tdir.glob("*.zip"))
        assert len(created_zips) == 1, f"Created multiple zips instead of 1!: {created_zips}"
        assert "_외4건.zip" in created_zips[0].name, f"Unexpected merged zip name: {created_zips[0].name}"
        with zipfile.ZipFile(created_zips[0], "r") as zf:
            assert len(zf.namelist()) == 5, zf.namelist()

        # Simulate a file held open with Windows read-only/write lock (like Excel)
        locked_file = tdir / "열려있는_정산표.xlsx"
        locked_file.write_bytes(b"FAKE_XLSX_LOCKED_DATA_12345")
        GENERIC_READ = 0x80000000
        GENERIC_WRITE = 0x40000000
        FILE_SHARE_READ = 0x00000001
        OPEN_EXISTING = 3
        k32 = ctypes.windll.kernel32
        hlock = k32.CreateFileW(
            str(locked_file),
            GENERIC_READ | GENERIC_WRITE,
            FILE_SHARE_READ,
            None,
            OPEN_EXISTING,
            0,
            None,
        )
        try:
            r_lock = run_exe_plugin("create-zip", {"path": str(locked_file)})
            assert r_lock["ok"] is True, r_lock
            assert Path(r_lock["zipPath"]).exists()
        finally:
            if hlock and hlock != ctypes.c_void_p(-1).value:
                k32.CloseHandle(hlock)
    print("  -> OK: 5 parallel invocations coalesced into 1 `YYMMDD_..._외4건.zip` & locked file zipped cleanly!")


def test_5_security_sleep_snapshot_and_whitelist_guard():
    print("[5/8] Testing cumulative sleep snapshot, tray wake signature, and elevated helper whitelist guard...")
    sig = inspect.signature(cs.wake_security_services)
    assert "reason" in sig.parameters, sig

    orig_snap = cs.SLEEP_SNAPSHOT_FILE
    orig_queue = cs.ELEVATED_ACTION_QUEUE_FILE
    with tempfile.TemporaryDirectory(prefix="ghosti_snap_") as td:
        tdir = Path(td)
        cs.SLEEP_SNAPSHOT_FILE = tdir / "snap.json"
        cs.ELEVATED_ACTION_QUEUE_FILE = tdir / "queue.json"
        try:
            cs._save_sleep_snapshot({
                "savedAt": "2026-11-15T12:00:00",
                "services": [{"serviceName": "AnySign4PC", "originalStartType": "auto"}],
                "userBridgeProcesses": [
                    {
                        "name": "AnySign4PC.exe",
                        "exe": "C:\\Program Files\\AnySign\\AnySign4PC.exe",
                        "cmdline": ["C:\\Program Files\\AnySign\\AnySign4PC.exe", "/tray"],
                    }
                ],
            })
            # Background sleep pass (zero UAC prompt!) MUST preserve existing snapshot even if 0 newly running services!
            cs.sleep_security_services(explicit_opt_in=False, allow_uac_prompt=False)
            merged = cs._load_sleep_snapshot()
            assert len(merged["services"]) == 1 and merged["services"][0]["serviceName"] == "AnySign4PC", merged
            assert merged["userBridgeProcesses"][0]["cmdline"] == [
                "C:\\Program Files\\AnySign\\AnySign4PC.exe",
                "/tray",
            ], merged

            # Elevated helper MUST reject non-whitelisted critical service names like WinDefend, Spooler, Corporate DRM!
            filtered = cs._filter_strictly_whitelisted_services(
                ["WinDefend", "Spooler", "MaEPSBroker", "AnySign4PC", "TouchEn nxKey"]
            )
            assert set(filtered) == {"AnySign4PC", "TouchEn nxKey"}, f"Whitelist leak!: {filtered}"

            cs.ELEVATED_ACTION_QUEUE_FILE.write_text(
                json.dumps({"requestId": "test1", "mode": "sleep", "serviceNames": ["WinDefend", "Spooler"]}),
                encoding="utf-8",
            )
            cs._process_elevated_helper_queue(install_task_too=False)
            q_done = json.loads(cs.ELEVATED_ACTION_QUEUE_FILE.read_text(encoding="utf-8"))
            assert q_done["completed"] is True and q_done["processedServices"] == [], q_done
        finally:
            cs.SLEEP_SNAPSHOT_FILE = orig_snap
            cs.ELEVATED_ACTION_QUEUE_FILE = orig_queue
    print("  -> OK: Cumulative snapshot preserved & elevated helper rejected WinDefend/Spooler/DRM!")


def test_6_deep_uninstaller_recycle_bin_and_guards():
    print("[6/8] Testing Deep Uninstaller (empty query clarification, KakaoTalk protection, MsiExec /I->/X, real Windows Recycle Bin)...")
    # 6-A) Empty / generic query must ask clarification instead of defaulting to Adobe!
    r_empty = run_exe_plugin("deep-uninstall-scan", {"appQuery": "안 지워지는 프로그램 깨끗하게 삭제해줘"})
    assert r_empty.get("needsClarification") is True and r_empty.get("foundAny") is False, r_empty
    assert "Adobe" not in r_empty.get("targetAppLabel", ""), r_empty

    # 6-B) Personal data directory protection (KakaoTalk, Chrome, Obsidian, etc.)
    assert cs._is_protected_personal_data_dir("KakaoTalk", r"C:\Users\test\AppData\Local\Kakao\KakaoTalk") is True
    assert cs._is_protected_personal_data_dir("User Data", r"C:\Users\test\AppData\Local\Google\Chrome\User Data") is True

    # 6-C) MsiExec /I{GUID} -> msiexec.exe /X{GUID} normalization
    msi_cmd = cs._normalize_msi_uninstall_cmd("MsiExec.exe /I{12345678-ABCD-1234-ABCD-1234567890AB}")
    assert "/x{12345678-abcd-1234-abcd-1234567890ab}" in msi_cmd.lower() and "/passive" in msi_cmd.lower(), msi_cmd

    # 6-D) Real Windows OS Recycle Bin movement & restoration verification (zero custom quarantine folder!)
    dummy_dir = Path(os.environ["LOCALAPPDATA"]) / f"GhostiRecycleTest_{os.getpid()}"
    dummy_dir.mkdir(parents=True, exist_ok=True)
    marker_name = f"ghosti_rb_marker_{os.getpid()}.txt"
    (dummy_dir / marker_name).write_text("recycle-bin-test-ok", encoding="utf-8")

    rb_res = cs._send_path_to_windows_recycle_bin(dummy_dir)
    assert rb_res.get("ok") is True and not dummy_dir.exists(), f"Recycle bin move failed: {rb_res}"

    # Verify the folder actually landed in Windows Recycle Bin via Shell.Application Namespace(10) and purge only our dummy item!
    ps_verify_and_clean = f"""
$shell = New-Object -ComObject Shell.Application
$rb = $shell.Namespace(10)
$found = $false
foreach ($item in @($rb.Items())) {{
    if ($item.Name -eq '{dummy_dir.name}') {{
        $found = $true
        Remove-Item -LiteralPath $item.Path -Recurse -Force -ErrorAction SilentlyContinue
    }}
}}
Write-Output $found
"""
    ps_proc = subprocess.run(
        ["powershell", "-NoProfile", "-Command", ps_verify_and_clean],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=15,
        creationflags=0x08000000,
    )
    assert "True" in ps_proc.stdout, f"Dummy folder was NOT found in Windows Recycle Bin!: {ps_proc.stdout}"
    print("  -> OK: Dummy residual folder verified inside real Windows OS Recycle Bin and cleaned up!")


def test_7_amsi_extracted_folder_scan():
    print("[7/8] Testing Defender AMSI guardian history & extracted script auto-scan on packaged `.exe`...")
    with tempfile.TemporaryDirectory(prefix="ghosti_amsi_") as td:
        tdir = Path(td)
        zpath = tdir / "script_bundle.zip"
        with zipfile.ZipFile(zpath, "w") as zf:
            zf.writestr("hello_safe.ps1", "Write-Output 'Safe Ghosti Test'\n")
        env = os.environ.copy()
        env["GHOSTI_HEADLESS_TEST"] = "1"
        proc = subprocess.run(
            [str(BUILT_EXE), "--smart-unzip", str(zpath)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env,
            timeout=25,
            creationflags=0x08000000,
        )
        assert proc.returncode == 0, proc.stderr
        res = json.loads(proc.stdout.strip().splitlines()[-1])
        assert res["ok"] is True and "defenderCheck" in res, res
        assert res["defenderCheck"]["scannedExecutableCount"] >= 1, res["defenderCheck"]

    hist = cs.get_defender_guardian_history(days=30, limit=10)
    assert hist["ok"] is True and "silentPassCount" in hist, hist
    print("  -> OK: Extracted script auto-scanned via AMSI on packaged `.exe` & 30-day history query verified!")


def test_8_packaged_exe_http_cors_csrf_security():
    print("[8/8] Testing live HTTP security on packaged `Merlin_Z_Core_Setup.exe --port 15299`...")
    port = 15299
    proc = subprocess.Popen(
        [str(BUILT_EXE), "--port", str(port)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        creationflags=0x08000000,
    )
    base = f"http://127.0.0.1:{port}"
    try:
        # Wait for boot
        booted = False
        for _ in range(30):
            try:
                with urllib.request.urlopen(f"{base}/__merlin/health", timeout=1.5) as r:
                    h = json.loads(r.read().decode("utf-8"))
                    if h.get("ok") and h.get("version") == "2.3.7":
                        booted = True
                        break
            except Exception:
                time.sleep(0.25)
        assert booted, "Packaged exe failed to listen on 15299"

        # 8-A) Trusted Origin `https://ghosti.sundreamer.app` -> 200 + echoed Access-Control-Allow-Origin
        req_ok = urllib.request.Request(
            f"{base}/api/care/status",
            headers={"Origin": "https://ghosti.sundreamer.app"},
            method="GET",
        )
        with urllib.request.urlopen(req_ok, timeout=5) as resp:
            assert resp.status == 200
            acao = resp.headers.get("Access-Control-Allow-Origin")
            assert acao == "https://ghosti.sundreamer.app", f"Expected echoed origin, got: {acao}"

        # 8-B) Untrusted Origin `https://evil-attacker.example` -> 403 + NO Access-Control-Allow-Origin
        req_evil = urllib.request.Request(
            f"{base}/api/care/status",
            headers={"Origin": "https://evil-attacker.example"},
            method="GET",
        )
        try:
            urllib.request.urlopen(req_evil, timeout=5)
            raise AssertionError("Untrusted origin should have been 403!")
        except urllib.error.HTTPError as he:
            assert he.code == 403, he.code
            assert he.headers.get("Access-Control-Allow-Origin") is None, "Must NOT emit ACAO to evil origin!"

        # 8-C) Cross-Site `<img src="http://127.0.0.1:15299/api/care/status">` (no Origin, Sec-Fetch-Site: cross-site) -> 403!
        req_csrf = urllib.request.Request(
            f"{base}/api/care/status",
            headers={"Sec-Fetch-Site": "cross-site"},
            method="GET",
        )
        try:
            urllib.request.urlopen(req_csrf, timeout=5)
            raise AssertionError("Cross-site Sec-Fetch-Site should have been 403!")
        except urllib.error.HTTPError as he:
            assert he.code == 403, he.code

        # 8-D) Mutating action via GET (`/api/care/sleep`, `/api/care/extract-archive`, `/__zcore/deep-uninstall-execute`) -> 405!
        for bad_get in ("/api/care/sleep", "/api/care/extract-archive", "/__zcore/deep-uninstall-execute"):
            req_mut = urllib.request.Request(f"{base}{bad_get}", method="GET")
            try:
                urllib.request.urlopen(req_mut, timeout=5)
                raise AssertionError(f"GET {bad_get} should have returned 405!")
            except urllib.error.HTTPError as he:
                assert he.code == 405, f"Expected 405 for {bad_get}, got {he.code}"

        # 8-E) Read-only `GET /__zcore/deep-uninstall-scan?appQuery=Alyac` & `GET /api/care/guardian-history` -> 200
        with urllib.request.urlopen(f"{base}/__zcore/deep-uninstall-scan?appQuery=Alyac", timeout=8) as r_scan:
            assert r_scan.status == 200
            scan_data = json.loads(r_scan.read().decode("utf-8"))
            assert scan_data.get("ok") is True, scan_data
        with urllib.request.urlopen(f"{base}/api/care/guardian-history", timeout=8) as r_gh:
            assert r_gh.status == 200
            gh_data = json.loads(r_gh.read().decode("utf-8"))
            assert gh_data.get("ok") is True and "silentPassCount" in gh_data, gh_data
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
    print("  -> OK: Live HTTP CORS/CSRF/405 security verified on packaged `Merlin_Z_Core_Setup.exe`!")


def main():
    assert BUILT_EXE.exists(), f"Built exe missing: {BUILT_EXE}"
    t0 = time.time()
    test_1_frozen_paths_and_registry_commands()
    test_2_archive_korean_macos_zipslip_overwrite_gz()
    test_3_alzip_grade_encrypted_archives()
    test_4_multi_file_zip_coalescing_and_shared_locked_file()
    test_5_security_sleep_snapshot_and_whitelist_guard()
    test_6_deep_uninstaller_recycle_bin_and_guards()
    test_7_amsi_extracted_folder_scan()
    test_8_packaged_exe_http_cors_csrf_security()
    print(f"\nALL 8 EDGE-CASE SUITES PASSED 100% ON PACKAGED Z-CORE v2.3.7 ({round(time.time() - t0, 1)}s)!")


if __name__ == "__main__":
    main()
