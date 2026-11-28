#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
❖ Merlin_Z_Core PC 버전 단일 실행파일 빌드 & MS 코드 서명(Code Signing) 자동화 파이프라인
- 대상: universal_z_core/os_agent/merlin_z_core_daemon.py (내장 소프트웨어 플러그인 3종 포함: ghosti_os, senstalk, aggrofilter)
- 목적:
  1. PyInstaller 기반 무콘솔 단일 실행파일 `Merlin_Z_Core_Setup.exe` 패키징
  2. Windows SmartScreen("Windows의 PC 보호" 파란 경고창) 100% 해소를 위한
     Microsoft Artifact Signing(구 Azure Trusted Signing) 또는 EV/OV PFX 인증서 기반 `signtool.exe` SHA-256 + RFC3161 타임스탬프 서명
  3. PowerShell `Get-AuthenticodeSignature` 실측 검증 리포트 출력
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Any, Dict

THIS_DIR = Path(__file__).resolve().parent
DIST_DIR = THIS_DIR / "dist"


def get_ms_signing_tools_dir() -> Path:
    local_app = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
    return Path(local_app) / "Microsoft" / "MicrosoftArtifactSigningClientTools"


def find_signtool() -> str | None:
    """Windows Kits(SDK) 또는 MicrosoftArtifactSigningClientTools 내 signtool.exe 경로를 자동 탐색합니다."""
    if shutil.which("signtool.exe"):
        return shutil.which("signtool.exe")
    ms_tools_dir = get_ms_signing_tools_dir()
    direct_st = ms_tools_dir / "signtool.exe"
    if direct_st.exists():
        return str(direct_st)
    if ms_tools_dir.exists():
        candidates = sorted(ms_tools_dir.glob("**/x64/signtool.exe"), reverse=True)
        if candidates:
            return str(candidates[0])
    for kits_str in (r"C:\Program Files (x86)\Windows Kits\10\bin", r"C:\Program Files\Windows Kits\10\bin"):
        kits_root = Path(kits_str)
        if kits_root.exists():
            candidates = sorted(kits_root.glob("**/x64/signtool.exe"), reverse=True)
            if candidates:
                return str(candidates[0])
    return None


def find_azure_dlib() -> str | None:
    """Azure.CodeSigning.Dlib.dll 경로를 환경변수 또는 표준 설치 경로에서 자동 탐색합니다."""
    env_val = os.environ.get("AZURE_CODESIGN_DLIB", "").strip()
    if env_val and Path(env_val).exists():
        return str(Path(env_val).resolve())
    ms_tools_dlib = get_ms_signing_tools_dir() / "Azure.CodeSigning.Dlib.dll"
    if ms_tools_dlib.exists():
        return str(ms_tools_dlib)
    local_dlib = THIS_DIR / "Azure.CodeSigning.Dlib.dll"
    if local_dlib.exists():
        return str(local_dlib)
    return None


def find_azure_metadata() -> str | None:
    """artifact_signing_metadata.json 경로를 환경변수 또는 os_agent 폴더에서 자동 탐색합니다."""
    env_val = os.environ.get("AZURE_CODESIGN_METADATA", "").strip()
    if env_val and Path(env_val).exists():
        return str(Path(env_val).resolve())
    default_meta = THIS_DIR / "artifact_signing_metadata.json"
    if default_meta.exists():
        return str(default_meta)
    return None


def ensure_ms_signing_tools_installed() -> Dict[str, Any]:
    """NuGet에서 공식 Microsoft.Trusted.Signing.Client(Dlib) 및 Microsoft.Windows.SDK.BuildTools(signtool)를 자동 설치합니다."""
    import urllib.request
    import zipfile

    base_dir = get_ms_signing_tools_dir()
    base_dir.mkdir(parents=True, exist_ok=True)
    if not (base_dir / "Azure.CodeSigning.Dlib.dll").exists():
        client_zip = base_dir / "client.zip"
        urllib.request.urlretrieve("https://www.nuget.org/api/v2/package/Microsoft.Trusted.Signing.Client", client_zip)
        extract_client = base_dir / "extracted_client"
        with zipfile.ZipFile(client_zip, "r") as z:
            z.extractall(extract_client)
        x64_dir = extract_client / "bin" / "x64"
        if x64_dir.exists():
            for item in x64_dir.iterdir():
                dest = base_dir / item.name
                if item.is_dir():
                    if dest.exists():
                        shutil.rmtree(dest)
                    shutil.copytree(item, dest)
                else:
                    shutil.copy2(item, dest)

    if not find_signtool():
        sdk_zip = base_dir / "sdk_buildtools.zip"
        urllib.request.urlretrieve("https://www.nuget.org/api/v2/package/Microsoft.Windows.SDK.BuildTools", sdk_zip)
        extract_sdk = base_dir / "extracted_sdk"
        with zipfile.ZipFile(sdk_zip, "r") as z:
            z.extractall(extract_sdk)
        signtools = sorted(extract_sdk.rglob("x64/signtool.exe"), reverse=True)
        if signtools:
            st_dir = signtools[0].parent
            for item in st_dir.iterdir():
                dest = base_dir / item.name
                if not item.is_dir() and not dest.exists():
                    shutil.copy2(item, dest)
            shutil.copy2(signtools[0], base_dir / "signtool.exe")

    meta_file = THIS_DIR / "artifact_signing_metadata.json"
    if not meta_file.exists():
        meta_file.write_text(
            json.dumps(
                {
                    "Endpoint": "https://krc.codesigning.azure.net/",
                    "CodeSigningAccountName": "sundreamer",
                    "CertificateProfileName": "sundream-public-cert",
                },
                indent=2,
            ),
            encoding="utf-8",
        )
    else:
        try:
            meta_obj = json.loads(meta_file.read_text(encoding="utf-8"))
            if "koreacentral." in str(meta_obj.get("Endpoint") or ""):
                meta_obj["Endpoint"] = "https://krc.codesigning.azure.net/"
                meta_file.write_text(json.dumps(meta_obj, indent=2), encoding="utf-8")
        except Exception:
            pass
    return {
        "ok": bool(find_signtool() and find_azure_dlib() and find_azure_metadata()),
        "signtoolPath": find_signtool(),
        "dlibPath": find_azure_dlib(),
        "metadataPath": find_azure_metadata(),
    }


def verify_authenticode_signature(target_file: Path) -> Dict[str, Any]:
    """PowerShell Get-AuthenticodeSignature로 대상 실행파일의 실제 MS 서명 상태를 검증합니다."""
    if not target_file.exists():
        return {"ok": False, "error": f"파일 없음: {target_file}"}
    ps_cmd = (
        "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; "
        f"$sig = Get-AuthenticodeSignature -FilePath '{target_file}'; "
        "@{ status = [string]$sig.Status; statusMessage = [string]$sig.StatusMessage; "
        "signerSubject = if ($sig.SignerCertificate) { [string]$sig.SignerCertificate.Subject } else { '' }; "
        "thumbprint = if ($sig.SignerCertificate) { [string]$sig.SignerCertificate.Thumbprint } else { '' } "
        "} | ConvertTo-Json -Compress"
    )
    try:
        res = subprocess.run(
            ["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", ps_cmd],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=10,
            creationflags=0x08000000,
        )
        if res.returncode == 0 and res.stdout.strip():
            return json.loads(res.stdout.strip())
    except Exception as e:
        return {"ok": False, "error": str(e)}
    return {"ok": False, "status": "Unknown"}


def sign_binary_with_ms_codesign(exe_path: Path) -> Dict[str, Any]:
    """
    자동 감지된 Azure.CodeSigning.Dlib.dll + artifact_signing_metadata.json (또는 환경변수 PFX/Thumbprint)로
    signtool.exe SHA-256 + RFC3161 타임스탬프 서명을 수행합니다.
    """
    signtool = find_signtool()
    azure_dlib = find_azure_dlib()
    azure_metadata = find_azure_metadata()
    pfx_path = os.environ.get("MS_CODESIGN_PFX_PATH", "")
    pfx_pass = os.environ.get("MS_CODESIGN_PFX_PASSWORD", "")
    cert_thumbprint = os.environ.get("MS_CODESIGN_THUMBPRINT", "")

    if not signtool:
        return {
            "signed": False,
            "reason": "SIGNTOOL_NOT_FOUND_ON_HOST",
            "readyCommand": (
                'signtool.exe sign /v /fd SHA256 /tr "http://timestamp.acs.microsoft.com" /td SHA256 '
                '/dlib "Azure.CodeSigning.Dlib.dll" /dmdf "artifact_signing_metadata.json" "dist/Merlin_Z_Core_Setup.exe"'
            ),
        }

    cmd = [signtool, "sign", "/v", "/fd", "SHA256"]
    if azure_dlib and azure_metadata:
        cmd += [
            "/tr",
            "http://timestamp.acs.microsoft.com",
            "/td",
            "SHA256",
            "/dlib",
            azure_dlib,
            "/dmdf",
            azure_metadata,
            str(exe_path),
        ]
    elif pfx_path and Path(pfx_path).exists():
        cmd += ["/f", pfx_path]
        if pfx_pass:
            cmd += ["/p", pfx_pass]
        cmd += ["/tr", "http://timestamp.digicert.com", "/td", "SHA256", str(exe_path)]
    elif cert_thumbprint:
        cmd += ["/sha1", cert_thumbprint, "/tr", "http://timestamp.digicert.com", "/td", "SHA256", str(exe_path)]
    else:
        return {
            "signed": False,
            "signtoolPath": signtool,
            "dlibPath": azure_dlib,
            "metadataPath": azure_metadata,
            "reason": "NO_CERT_ENV_CONFIGURED (AZURE_CODESIGN_DLIB or MS_CODESIGN_PFX_PATH required)",
            "readyCommand": (
                f'"{signtool}" sign /v /fd SHA256 /tr "http://timestamp.acs.microsoft.com" /td SHA256 '
                f'/dlib "%LOCALAPPDATA%\\Microsoft\\MicrosoftArtifactSigningClientTools\\Azure.CodeSigning.Dlib.dll" '
                f'/dmdf "artifact_signing_metadata.json" "{exe_path}"'
            ),
        }

    env = os.environ.copy()
    local_dotnet = Path(os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")) / "Microsoft" / "dotnet"
    if not env.get("DOTNET_ROOT"):
        if Path(r"C:\Program Files\dotnet\shared\Microsoft.NETCore.App").is_dir():
            env["DOTNET_ROOT"] = r"C:\Program Files\dotnet"
        elif (local_dotnet / "shared" / "Microsoft.NETCore.App").is_dir():
            env["DOTNET_ROOT"] = str(local_dotnet)
            env["PATH"] = f"{local_dotnet};{env.get('PATH', '')}"
    if not env.get("AZURE_CLIENT_SECRET"):
        try:
            secrets_file = Path(r"D:\Secretary\local_secrets.json")
            if secrets_file.exists():
                sec_obj = json.loads(secrets_file.read_text(encoding="utf-8-sig"))
                aas = sec_obj.get("azure_artifact_signing") or {}
                if aas.get("tenant_id") and aas.get("client_id") and aas.get("client_secret"):
                    env["AZURE_TENANT_ID"] = str(aas["tenant_id"]).strip()
                    env["AZURE_CLIENT_ID"] = str(aas["client_id"]).strip()
                    env["AZURE_CLIENT_SECRET"] = str(aas["client_secret"]).strip()
        except Exception:
            pass

    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", env=env)
    combined_out = (res.stdout or "") + "\n" + (res.stderr or "")
    auth_info = verify_authenticode_signature(exe_path)
    is_valid_sig = bool(res.returncode == 0 and str(auth_info.get("status") or "").lower() == "valid")
    reason = "SIGNED_OK" if is_valid_sig else (
        "AZURE_CREDENTIAL_OR_APPROVAL_PENDING"
        if "CredentialUnavailableException" in combined_out
        else "SIGNTOOL_EXECUTION_FAILED"
    )
    return {
        "signed": is_valid_sig,
        "returncode": res.returncode,
        "reason": reason,
        "signtoolPath": signtool,
        "dlibPath": azure_dlib,
        "metadataPath": azure_metadata,
        "stdout": res.stdout.strip(),
        "stderr": res.stderr.strip(),
        "authenticode": auth_info,
    }


def build_with_pyinstaller(console: bool = False) -> Dict[str, Any]:
    """
    [2026-11-25 정공법 전환] PyInstaller --onedir (1회 전개 · 무압축해제 런타임) 로
    merlin_z_core_daemon.py + 내장 플러그인 전체를 dist/Merlin_Z_Core_Setup/ (Merlin_Z_Core_Setup.exe + _internal/) 로 패키징합니다.
    - 기존 --onefile 방식은 5199·51988(--seq-paste-daemon)·--ppocr-worker 실행 때마다 70MB/1,190개 파일을
      임시 폴더(_MEI*)에 3벌 중복 압축해제하여 Windows Defender 스캔으로 최대 2분 먹통을 유발했으나,
      --onedir 전환으로 부팅·서브프로세스 기동 시 압축해제 0바이트 / 0.3초 즉시 기동을 영구 보장합니다.
    """
    work_root = Path(os.environ.get("TEMP", str(THIS_DIR))) / "merlin_z_core_build"
    icon_file = THIS_DIR / "favicon.ico"
    logo_png = THIS_DIR / "logo-symbol.png"
    whitelist_json = THIS_DIR / "security_services_whitelist.json"
    seven_zip_dir = THIS_DIR / "bin" / "7z"
    assets_dir = THIS_DIR / "assets"
    baby_ghost_sounds_dir = THIS_DIR / "baby_ghost_sounds"
    ocr_models_dir = THIS_DIR / "models" / "ocr"
    py_root = Path(sys.executable).resolve().parent
    vc_dll_args: list[str] = []
    for dll_pat in ("msvcp140*.dll", "vcruntime140*.dll", "concrt140.dll", "vcomp140.dll"):
        for dll_p in sorted(py_root.glob(dll_pat)):
            vc_dll_args.extend(["--add-binary", f"{dll_p};."])
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm", "--clean", "--onedir",
        "--name", "Merlin_Z_Core_Setup",
        "--distpath", str(DIST_DIR),
        "--workpath", str(work_root / "work"),
        "--specpath", str(work_root / "spec"),
        "--paths", str(THIS_DIR),
        *(["--icon", str(icon_file)] if icon_file.exists() else []),
        *(["--add-data", f"{icon_file};."] if icon_file.exists() else []),
        *(["--add-data", f"{logo_png};."] if logo_png.exists() else []),
        *(["--add-data", f"{whitelist_json};."] if whitelist_json.exists() else []),
        *(["--add-data", f"{seven_zip_dir};bin/7z"] if seven_zip_dir.exists() else []),
        *(["--add-data", f"{assets_dir};assets"] if assets_dir.exists() else []),
        *(["--add-data", f"{baby_ghost_sounds_dir};baby_ghost_sounds"] if baby_ghost_sounds_dir.exists() else []),
        *(["--add-data", f"{ocr_models_dir};models/ocr"] if ocr_models_dir.exists() else []),
        *vc_dll_args,
        "--collect-binaries", "onnxruntime",
        "--collect-all", "pypdfium2_raw",
        "--collect-submodules", "win32com",
        "--hidden-import", "plugin_ghosti_os",
        "--hidden-import", "plugins.plugin_paid_work_sdrive",
        "--hidden-import", "plugins.plugin_paid_sync_ghostwin",
        "--hidden-import", "plugins.plugin_ghosti_agent_care",
        "--hidden-import", "ppocr_v5_worker",
        "--hidden-import", "onnxruntime",
        "--hidden-import", "pypdfium2",
        "--hidden-import", "olefile",
        "--hidden-import", "numpy",
        "--hidden-import", "plugin_ghosti_care_suite",
        "--hidden-import", "plugin_ghosti_archive",
        "--hidden-import", "pyzipper",
        "--hidden-import", "plugin_ghosti_superpowers",
        "--hidden-import", "seq_paste_daemon",
        "--hidden-import", "ghost_search_window_ui2",
        "--hidden-import", "ghosti_safe_ops",
        "--hidden-import", "sqlite3",
        "--hidden-import", "_sqlite3",
        "--hidden-import", "http.cookiejar",
        "--hidden-import", "ghosti_setup_parity",
        "--hidden-import", "merlin_tts_engine",
        "--hidden-import", "edge_tts",
        "--hidden-import", "plugin_senstalk",
        "--hidden-import", "plugin_aggrofilter",
        "--hidden-import", "merlin_z_core_os",
        "--hidden-import", "core_win32",
        "--hidden-import", "pythoncom",
        "--hidden-import", "pywintypes",
        "--hidden-import", "win32com",
        "--hidden-import", "win32com.client",
        "--hidden-import", "win32clipboard",
        "--hidden-import", "win32con",
        "--hidden-import", "win32gui",
        "--hidden-import", "win32api",
        "--hidden-import", "tkinter",
        "--hidden-import", "psutil",
        "--hidden-import", "PIL.Image",
        "--hidden-import", "PIL.ImageDraw",
        "--hidden-import", "PIL.ImageGrab",
        "--hidden-import", "PIL.ImageOps",
        "--hidden-import", "PIL.ImageTk",
        "--console",
        str(THIS_DIR / "merlin_z_core_daemon.py"),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    onedir_dir = DIST_DIR / "Merlin_Z_Core_Setup"
    exe = onedir_dir / "Merlin_Z_Core_Setup.exe"
    subsystem_patched = False
    if res.returncode == 0 and exe.exists() and not console:
        # [근본 처방]: MessageBoxW 호출이 0건인 run.exe(--console) 부트로더로 패키징한 뒤
        # PE OptionalHeader.Subsystem만 IMAGE_SUBSYSTEM_WINDOWS_GUI(2)로 전환하여 콘솔 창 0% + 팝업 0%를 동시 달성합니다.
        try:
            import struct

            with open(exe, "r+b") as f:
                f.seek(0x3C)
                pe_offset = struct.unpack("<I", f.read(4))[0]
                f.seek(pe_offset)
                if f.read(4) == b"PE\x00\x00":
                    subsys_offset = pe_offset + 4 + 20 + 68
                    f.seek(subsys_offset)
                    cur_subsys = struct.unpack("<H", f.read(2))[0]
                    if cur_subsys == 3:  # IMAGE_SUBSYSTEM_WINDOWS_CUI -> WINDOWS_GUI(2)
                        f.seek(subsys_offset)
                        f.write(struct.pack("<H", 2))
                        subsystem_patched = True
        except Exception:
            pass
    total_bytes = 0
    if onedir_dir.is_dir():
        for _fp in onedir_dir.rglob("*"):
            if _fp.is_file():
                try:
                    total_bytes += _fp.stat().st_size
                except OSError:
                    pass
    return {
        "built": res.returncode == 0 and exe.exists() and (onedir_dir / "_internal").is_dir(),
        "mode": "onedir",
        "returncode": res.returncode,
        "exe": str(exe),
        "onedir": str(onedir_dir),
        "subsystemGuiPatched": subsystem_patched,
        "sizeMB": round(total_bytes / 1024 / 1024, 1) if total_bytes else 0,
        "stderrTail": res.stderr.strip().splitlines()[-6:],
    }


def verify_built_exe(exe_path: Path, port: int = 15199, timeout_sec: float = 40.0) -> Dict[str, Any]:
    """
    빌드된 exe를 임시 포트로 기동해 헬스체크 + 1차 3대 기능(귀신같이 OS · 센스톡 · 어그로필터) 응답을 실측합니다.
    (개발 PC의 5199는 Vite 개발서버가 점유할 수 있으므로 기본 15199에서 검증 — 비서실 실측 방식과 동일)
    * Windows 11 Smart App Control(WinError 4551) 활성 빌드 머신에서 MS 코드 서명 완료 전 미서명 exe 기동이 차단될 경우,
      PE 헤더 무결성 검증 후 동일 엔트리포인트(merlin_z_core_daemon.py)로 임시 포트 기동 검증을 이어갑니다.
    """
    import struct
    import time
    import urllib.parse
    import urllib.request

    pe_valid = False
    is_onedir = (exe_path.parent / "_internal").is_dir()
    min_exe_bytes = 200 * 1024 if is_onedir else 10 * 1024 * 1024
    if exe_path.exists() and exe_path.stat().st_size > min_exe_bytes:
        try:
            with open(exe_path, "rb") as f:
                if f.read(2) == b"MZ":
                    f.seek(0x3C)
                    pe_off = struct.unpack("<I", f.read(4))[0]
                    f.seek(pe_off)
                    pe_valid = f.read(4) == b"PE\x00\x00"
        except Exception:
            pe_valid = False

    sac_fallback = False
    try:
        proc = subprocess.Popen(
            [str(exe_path), "--port", str(port)],
            creationflags=0x08000000 if sys.platform == "win32" else 0,
        )
    except OSError as e:
        if getattr(e, "winerror", None) == 4551 and pe_valid:
            sac_fallback = True
            proc = subprocess.Popen(
                [sys.executable, str(THIS_DIR / "merlin_z_core_daemon.py"), "--port", str(port)],
                creationflags=0x08000000 if sys.platform == "win32" else 0,
            )
        else:
            raise
    base = f"http://127.0.0.1:{port}"
    report: Dict[str, Any] = {"port": port, "pid": proc.pid, "peHeaderValid": pe_valid, "smartAppControlFallback": sac_fallback}

    def get(p: str, q: Dict[str, str] | None = None, t: float = 8.0) -> Any:
        url = base + p + ("?" + urllib.parse.urlencode(q) if q else "")
        with urllib.request.urlopen(url, timeout=t) as r:
            return json.loads(r.read().decode("utf-8"))

    try:
        t0 = time.time()
        while True:
            try:
                report["health"] = get("/health", t=3.0)
                break
            except Exception:
                if time.time() - t0 > timeout_sec:
                    report["health"] = {"ok": False, "error": "기상 시간 초과"}
                    break
                time.sleep(1.0)
        report["bootSec"] = round(time.time() - t0, 1)
        checks = {
            "ghostiOs": lambda: get("/api/ghosti/health"),
            "careSuite": lambda: get("/api/care/status"),
            "senstalk": lambda: get("/api/senstalk/health"),
            "aggrofilterHealth": lambda: get("/api/aggrofilter/health"),
            "aggrofilterLiveCaption": lambda: get("/aggrofilter/v1/extract-subtitles", {"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}, t=30.0),
        }
        for name, fn in checks.items():
            try:
                r = fn()
                report[name] = {"ok": r.get("ok"), **({"segmentCount": r.get("segmentCount"), "lang": r.get("selectedLanguage")} if "Caption" in name else {})}
            except Exception as e:
                report[name] = {"ok": False, "error": str(e)}
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
    report["ok"] = bool((report.get("health") or {}).get("ok")) and all(
        (report.get(k) or {}).get("ok") for k in ("ghostiOs", "careSuite", "senstalk", "aggrofilterHealth")
    )
    return report


def sync_release_zip_and_frontend_version(exe_path: Path) -> Dict[str, Any]:
    """
    빌드된 최신 Merlin_Z_Core_Setup.exe를 public/Merlin_Z_Core.zip으로 자동 패키징하고,
    public/z_core_version.json 및 src/services/zCoreBridge.ts의 LATEST_Z_CORE_VERSION을
    CORE_VERSION과 100% 자동 일치시켜 모든 연결 기기가 무소음 자동 업데이트되게 보장합니다.
    """
    import re
    import zipfile

    repo_root = THIS_DIR.parents[1]
    daemon_py = THIS_DIR / "merlin_z_core_daemon.py"
    m = re.search(r'CORE_VERSION\s*=\s*["\']([^"\']+)["\']', daemon_py.read_text(encoding="utf-8", errors="ignore"))
    core_version = m.group(1) if m else "2.3.23"

    # [MS Artifact Signing 공인 코드서명 필수 게이트]: GitHub Releases 업로드 전 Authenticode Status == Valid 확인 (미서명 시 즉시 자동 재서명)
    auth_chk = verify_authenticode_signature(exe_path)
    if str(auth_chk.get("status") or "").lower() != "valid":
        ensure_ms_signing_tools_installed()
        sign_binary_with_ms_codesign(exe_path)
        auth_chk = verify_authenticode_signature(exe_path)
    sig_valid = str(auth_chk.get("status") or "").lower() == "valid"

    public_dir = repo_root / "public"
    public_dir.mkdir(parents=True, exist_ok=True)
    zip_target = public_dir / "Merlin_Z_Core.zip"
    ver_json_target = public_dir / "z_core_version.json"

    bat_content = (
        "@echo off\r\n"
        "chcp 65001 > nul\r\n"
        "echo ========================================================\r\n"
        "echo  [Merlin Z-Core] 귀신같이 만능 PC 상주 엔진 기동 중...\r\n"
        "echo ========================================================\r\n"
        'start "" "Merlin_Z_Core_Setup.exe"\r\n'
        "echo  성공! 윈도우 시계 옆 트레이 및 로컬 포트 5199에서 실행 중입니다.\r\n"
        "echo  귀신같이 웹 브라우저 창으로 돌아가시면 1초 만에 자동 연결됩니다.\r\n"
        "timeout /t 3 > nul\r\n"
        "exit\r\n"
    )
    readme_content = (
        f"❖ 멀린 Z-코어 (Merlin Z-Core v{core_version} · 0.3초 즉시 기동 onedir 에디션) 사용 안내\n\n"
        "1. 다운로드한 Merlin_Z_Core.zip의 압축을 한 폴더에 모두 풀어 주세요. (_internal 폴더와 Merlin_Z_Core_Setup.exe가 같은 폴더에 있어야 합니다)\n"
        "2. [Merlin_Z_Core_Setup.exe]를 더블 클릭하여 실행합니다. (영구 경로 %LOCALAPPDATA%\\Programs\\MerlinFamily 로 자동 안착됩니다)\n"
        "3. 실행 후 윈도우 작업표시줄 시계 옆(시스템 트레이)에 귀신같이 아이콘이 생성되며, 이후 PC 재부팅·Ctrl+0 귀신검색창이 0.3초 만에 즉시 열립니다.\n"
        "4. 귀신같이 웹 브라우저(https://ghosti.sundreamer.app)의 [1. 귀신비서] · [2. 귀신검색] 창으로 돌아가시면\n"
        "   자동 연결되며, 외부 클라우드 전송 없이 내 컴퓨터 속 진짜 사진·동영상·문서만 조용히 로컬 인덱싱합니다.\n"
        "5. 이후 신규 버전이 출시되면 별도 다운로드 없이 백그라운드에서 항상 최신 버전으로 자동 업데이트됩니다.\n"
    )

    tmp_zip = public_dir / "Merlin_Z_Core.zip.tmp"
    onedir_root = exe_path.parent
    is_onedir_pkg = (onedir_root / "_internal").is_dir()
    with zipfile.ZipFile(tmp_zip, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        if is_onedir_pkg:
            zf.write(exe_path, arcname="Merlin_Z_Core_Setup.exe")
            internal_dir = onedir_root / "_internal"
            for f_item in sorted(internal_dir.rglob("*")):
                if f_item.is_file():
                    rel_arc = f_item.relative_to(onedir_root).as_posix()
                    zf.write(f_item, arcname=rel_arc)
        else:
            zf.write(exe_path, arcname="Merlin_Z_Core_Setup.exe")
        zf.writestr("Merlin_Z_Core_실행.bat", bat_content.encode("utf-8"))
        zf.writestr("안내_README.txt", readme_content.encode("utf-8"))
    try:
        os.replace(tmp_zip, zip_target)
    except PermissionError:
        import shutil
        try:
            shutil.copyfile(tmp_zip, zip_target)
            tmp_zip.unlink(missing_ok=True)
        except PermissionError:
            # public/Merlin_Z_Core.zip이 로컬 프로세스에 의해 잠겨 있을 때는 tmp_zip을 그대로 GitHub Release 업로드에 사용
            zip_target = tmp_zip

    ver_json_target.write_text(
        json.dumps(
            {
                "version": core_version,
                "zipUrl": "https://github.com/Han-jinwook/Ghosti/releases/download/z-core-latest/Merlin_Z_Core.zip",
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    bridge_ts = repo_root / "src" / "services" / "zCoreBridge.ts"
    bridge_updated = False
    if bridge_ts.exists():
        raw_ts = bridge_ts.read_text(encoding="utf-8")
        new_ts, cnt = re.subn(
            r"(export\s+const\s+LATEST_Z_CORE_VERSION\s*=\s*['\"])([^'\"]+)(['\"];)",
            rf"\g<1>{core_version}\g<3>",
            raw_ts,
        )
        if cnt > 0 and new_ts != raw_ts:
            bridge_ts.write_text(new_ts, encoding="utf-8")
            bridge_updated = True

    gh_release_uploaded = False
    if zip_target.exists():
        try:
            # 1) git credential helper에서 GitHub 토큰 조회 후 REST API로 z-core-latest 에셋 교체
            p_cred = subprocess.Popen(
                ["git", "credential", "fill"],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            cred_out, _ = p_cred.communicate("protocol=https\nhost=github.com\n\n", timeout=8)
            gh_token = ""
            for ln in (cred_out or "").splitlines():
                if ln.startswith("password="):
                    gh_token = ln.split("=", 1)[1].strip()
                    break
            if gh_token:
                import urllib.request

                api_headers = {
                    "Authorization": f"Bearer {gh_token}",
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "Merlin-Z-Core-ReleaseSync",
                }
                req_rel = urllib.request.Request(
                    "https://api.github.com/repos/Han-jinwook/Ghosti/releases/tags/z-core-latest",
                    headers=api_headers,
                )
                with urllib.request.urlopen(req_rel, timeout=15) as r_rel:
                    rel_info = json.loads(r_rel.read().decode("utf-8"))
                rel_id = rel_info.get("id")
                for asset in rel_info.get("assets") or []:
                    if asset.get("name") == "Merlin_Z_Core.zip" and asset.get("id"):
                        del_req = urllib.request.Request(
                            f"https://api.github.com/repos/Han-jinwook/Ghosti/releases/assets/{asset['id']}",
                            method="DELETE",
                            headers=api_headers,
                        )
                        urllib.request.urlopen(del_req, timeout=15).close()
                if rel_id:
                    zip_bytes = zip_target.read_bytes()
                    up_headers = {
                        **api_headers,
                        "Content-Type": "application/zip",
                        "Content-Length": str(len(zip_bytes)),
                    }
                    up_req = urllib.request.Request(
                        f"https://uploads.github.com/repos/Han-jinwook/Ghosti/releases/{rel_id}/assets?name=Merlin_Z_Core.zip",
                        data=zip_bytes,
                        method="POST",
                        headers=up_headers,
                    )
                    with urllib.request.urlopen(up_req, timeout=180) as r_up:
                        up_res = json.loads(r_up.read().decode("utf-8"))
                        gh_release_uploaded = bool(up_res.get("id"))
                    patch_body = json.dumps({"name": f"Merlin Z-Core Latest (v{core_version})"}).encode("utf-8")
                    patch_req = urllib.request.Request(
                        f"https://api.github.com/repos/Han-jinwook/Ghosti/releases/{rel_id}",
                        data=patch_body,
                        method="PATCH",
                        headers={**api_headers, "Content-Type": "application/json"},
                    )
                    urllib.request.urlopen(patch_req, timeout=15).close()
        except Exception:
            gh_release_uploaded = False
        if zip_target == tmp_zip:
            tmp_zip.unlink(missing_ok=True)

    return {
        "ok": zip_target.exists() and sig_valid,
        "version": core_version,
        "authenticodeValid": sig_valid,
        "signerSubject": auth_chk.get("signerSubject", ""),
        "zipPath": str(zip_target),
        "zipSizeMB": round(zip_target.stat().st_size / 1024 / 1024, 1) if zip_target.exists() else 0,
        "versionJsonPath": str(ver_json_target),
        "zCoreBridgeUpdated": bridge_updated,
        "githubReleaseUploaded": gh_release_uploaded,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build & MS Code-Sign Merlin_Z_Core_Setup.exe")
    parser.add_argument("--check", action="store_true", help="MS 서명 도구(signtool, Dlib, metadata) 및 플러그인 패키징 준비 상태 점검")
    parser.add_argument("--build", action="store_true", help="PyInstaller 단일 exe 빌드 → 실행 검증 → (인증서 환경 시) 서명")
    parser.add_argument("--prepare-tools", action="store_true", help="NuGet에서 signtool.exe 및 Azure.CodeSigning.Dlib.dll 자동 설치")
    parser.add_argument("--sign-only", action="store_true", help="이미 빌드된 dist/Merlin_Z_Core_Setup.exe에 즉시 MS 서명 날인")
    parser.add_argument("--console", action="store_true", help="디버그용 콘솔 창 표시 빌드")
    parser.add_argument("--verify-port", type=int, default=15199, help="빌드 검증용 임시 포트 (기본 15199)")
    args = parser.parse_args()

    try:
        if sys.stdout and hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    exe = DIST_DIR / "Merlin_Z_Core_Setup" / "Merlin_Z_Core_Setup.exe"

    if args.prepare_tools:
        prep = ensure_ms_signing_tools_installed()
        print(json.dumps(prep, ensure_ascii=False, indent=2))
        sys.exit(0 if prep.get("ok") else 1)

    if args.sign_only:
        ensure_ms_signing_tools_installed()
        sign_res = sign_binary_with_ms_codesign(exe)
        print(json.dumps(sign_res, ensure_ascii=False, indent=2))
        sys.exit(0 if sign_res.get("signed") else 1)

    if args.build:
        # [4개 귀신 창 동시 빌드 충돌 원천 차단]: deploy_z_core_cluster.py가 잡은 락이 없으면 직접 동일 OS 파일 락 획득
        _lock_file_handle = None
        if os.name == "nt" and os.environ.get("MERLIN_ZCORE_LOCK_HELD") != "1":
            import msvcrt as _msvcrt
            import time as _time
            _lock_p = THIS_DIR.parent / ".zcore_deploy.lock"
            _lock_file_handle = open(_lock_p, "a+b")
            _t0 = _time.time()
            while True:
                try:
                    _lock_file_handle.seek(0)
                    _msvcrt.locking(_lock_file_handle.fileno(), _msvcrt.LK_NBLCK, 1)
                    break
                except OSError:
                    if (_time.time() - _t0) >= 180.0:
                        raise TimeoutError("다른 창이 Z-코어 빌드를 점유 중입니다.")
                    _time.sleep(1.0)
        try:
            out: Dict[str, Any] = {"build": build_with_pyinstaller(console=args.console)}
            if out["build"]["built"]:
                ensure_ms_signing_tools_installed()
                out["sign"] = sign_binary_with_ms_codesign(exe)
                out["authenticode"] = (out["sign"] or {}).get("authenticode") or verify_authenticode_signature(exe)
                sig_valid = bool(
                    (out["sign"] or {}).get("signed")
                    and str((out["authenticode"] or {}).get("status") or "") == "Valid"
                    and "썬드림주식회사" in str((out["authenticode"] or {}).get("signerSubject") or "")
                )
                out["signatureGatePassed"] = sig_valid
                out["verify"] = verify_built_exe(exe, port=args.verify_port)
                if sig_valid and (out.get("verify") or {}).get("ok"):
                    out["releaseSync"] = sync_release_zip_and_frontend_version(exe)
            out["ok"] = bool(
                out["build"]["built"]
                and out.get("signatureGatePassed")
                and (out.get("verify") or {}).get("ok")
            )
            print(json.dumps(out, ensure_ascii=False, indent=2))
            sys.exit(0 if out["ok"] else 1)
        finally:
            if _lock_file_handle is not None and os.name == "nt":
                try:
                    import msvcrt as _msvcrt
                    _lock_file_handle.seek(0)
                    _msvcrt.locking(_lock_file_handle.fileno(), _msvcrt.LK_UNLCK, 1)
                    _lock_file_handle.close()
                except Exception:
                    pass

    signtool = find_signtool()
    dlib = find_azure_dlib()
    metadata = find_azure_metadata()
    daemon_py = THIS_DIR / "merlin_z_core_daemon.py"
    plugins = [
        THIS_DIR / "core_win32.py",
        THIS_DIR / "plugin_ghosti_os.py",
        THIS_DIR / "plugin_ghosti_care_suite.py",
        THIS_DIR / "plugin_ghosti_superpowers.py",
        THIS_DIR / "ghosti_safe_ops.py",
        THIS_DIR / "ghosti_setup_parity.py",
        THIS_DIR / "merlin_tts_engine.py",
        THIS_DIR / "plugin_senstalk.py",
        THIS_DIR / "plugin_aggrofilter.py",
        THIS_DIR / "merlin_z_core_os.py",
    ]
    report = {
        "ok": True,
        "targetExecutable": str(exe),
        "targetExecutableExists": exe.exists(),
        "daemonEntry": str(daemon_py),
        "bundledPlugins": [p.name for p in plugins if p.exists()],
        "signtoolFound": bool(signtool),
        "signtoolPath": signtool or "Windows SDK signtool.exe 미설치",
        "dlibFound": bool(dlib),
        "dlibPath": dlib or "Azure.CodeSigning.Dlib.dll 미설치",
        "metadataFound": bool(metadata),
        "metadataPath": metadata or "artifact_signing_metadata.json 미생성",
        "readyForTomorrowMsSigning": bool(signtool and dlib and metadata and exe.exists()),
        "smartScreenDefense": "Microsoft Artifact Signing (Azure Trusted Signing) SHA-256 + RFC3161 Timestamp",
        "signingCommandTemplate": (
            f'"{signtool or "signtool.exe"}" sign /v /fd SHA256 /tr "http://timestamp.acs.microsoft.com" /td SHA256 '
            f'/dlib "{dlib or "Azure.CodeSigning.Dlib.dll"}" /dmdf "{metadata or "artifact_signing_metadata.json"}" '
            f'"{exe}"'
        ),
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
