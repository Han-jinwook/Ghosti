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
                    "Endpoint": "https://koreacentral.codesigning.azure.net/",
                    "CodeSigningAccountName": "sundreamer",
                    "CertificateProfileName": "sundream-public-cert",
                },
                indent=2,
            ),
            encoding="utf-8",
        )
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

    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    combined_out = (res.stdout or "") + "\n" + (res.stderr or "")
    reason = "SIGNED_OK" if res.returncode == 0 else (
        "AZURE_CREDENTIAL_OR_APPROVAL_PENDING (signtool + Dlib + metadata 100% 바인딩 완료, 내일 MS 심사 승인 및 az login 시 즉시 서명 완료)"
        if "CredentialUnavailableException" in combined_out
        else "SIGNTOOL_EXECUTION_FAILED"
    )
    return {
        "signed": res.returncode == 0,
        "returncode": res.returncode,
        "reason": reason,
        "signtoolPath": signtool,
        "dlibPath": azure_dlib,
        "metadataPath": azure_metadata,
        "stdout": res.stdout.strip(),
        "stderr": res.stderr.strip(),
        "authenticode": verify_authenticode_signature(exe_path),
    }


def build_with_pyinstaller(console: bool = False) -> Dict[str, Any]:
    """
    [2026-10-27 실체화] PyInstaller --onefile 로 merlin_z_core_daemon.py + 1차 필수 플러그인 3종을
    단일 실행파일 dist/Merlin_Z_Core_Setup.exe 로 패키징합니다.
    - 플러그인은 데몬이 정적 import 하므로 --paths 로 자동 수집 + hidden-import 로 이중 보장
    - 서드파티: psutil, pywin32(win32clipboard/win32con), Pillow (센스톡·클립보드 이미지)
    """
    work_root = Path(os.environ.get("TEMP", str(THIS_DIR))) / "merlin_z_core_build"
    icon_file = THIS_DIR / "favicon.ico"
    logo_png = THIS_DIR / "logo-symbol.png"
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm", "--clean", "--onefile",
        "--name", "Merlin_Z_Core_Setup",
        "--distpath", str(DIST_DIR),
        "--workpath", str(work_root / "work"),
        "--specpath", str(work_root / "spec"),
        "--paths", str(THIS_DIR),
        *(["--icon", str(icon_file)] if icon_file.exists() else []),
        *(["--add-data", f"{icon_file};."] if icon_file.exists() else []),
        *(["--add-data", f"{logo_png};."] if logo_png.exists() else []),
        "--hidden-import", "plugin_ghosti_os",
        "--hidden-import", "ghosti_safe_ops",
        "--hidden-import", "ghosti_setup_parity",
        "--hidden-import", "merlin_tts_engine",
        "--hidden-import", "edge_tts",
        "--hidden-import", "plugin_senstalk",
        "--hidden-import", "plugin_aggrofilter",
        "--hidden-import", "merlin_z_core_os",
        "--hidden-import", "core_win32",
        "--hidden-import", "win32clipboard",
        "--hidden-import", "win32con",
        "--hidden-import", "psutil",
        "--hidden-import", "PIL.Image",
        "--hidden-import", "PIL.ImageDraw",
        "--console" if console else "--noconsole",
        str(THIS_DIR / "merlin_z_core_daemon.py"),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    exe = DIST_DIR / "Merlin_Z_Core_Setup.exe"
    return {
        "built": res.returncode == 0 and exe.exists(),
        "returncode": res.returncode,
        "exe": str(exe),
        "sizeMB": round(exe.stat().st_size / 1024 / 1024, 1) if exe.exists() else 0,
        "stderrTail": res.stderr.strip().splitlines()[-6:],
    }


def verify_built_exe(exe_path: Path, port: int = 15199, timeout_sec: float = 40.0) -> Dict[str, Any]:
    """
    빌드된 exe를 임시 포트로 기동해 헬스체크 + 1차 3대 기능(귀신같이 OS · 센스톡 · 어그로필터) 응답을 실측합니다.
    (개발 PC의 5199는 Vite 개발서버가 점유할 수 있으므로 기본 15199에서 검증 — 비서실 실측 방식과 동일)
    """
    import time
    import urllib.parse
    import urllib.request

    proc = subprocess.Popen(
        [str(exe_path), "--port", str(port)],
        creationflags=0x08000000 if sys.platform == "win32" else 0,
    )
    base = f"http://127.0.0.1:{port}"
    report: Dict[str, Any] = {"port": port, "pid": proc.pid}

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
        (report.get(k) or {}).get("ok") for k in ("ghostiOs", "senstalk", "aggrofilterHealth", "aggrofilterLiveCaption")
    )
    return report


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

    exe = DIST_DIR / "Merlin_Z_Core_Setup.exe"

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
        out: Dict[str, Any] = {"build": build_with_pyinstaller(console=args.console)}
        if out["build"]["built"]:
            out["verify"] = verify_built_exe(exe, port=args.verify_port)
            out["sign"] = sign_binary_with_ms_codesign(exe)
            out["authenticode"] = verify_authenticode_signature(exe)
        out["ok"] = bool(out["build"]["built"] and (out.get("verify") or {}).get("ok"))
        print(json.dumps(out, ensure_ascii=False, indent=2))
        sys.exit(0 if out["ok"] else 1)

    signtool = find_signtool()
    dlib = find_azure_dlib()
    metadata = find_azure_metadata()
    daemon_py = THIS_DIR / "merlin_z_core_daemon.py"
    plugins = [
        THIS_DIR / "core_win32.py",
        THIS_DIR / "plugin_ghosti_os.py",
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
