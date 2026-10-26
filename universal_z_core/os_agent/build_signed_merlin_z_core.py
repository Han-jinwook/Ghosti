#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
❖ Merlin_Z_Core PC 버전 단일 실행파일 빌드 & MS 코드 서명(Code Signing) 자동화 파이프라인
- 대상: universal_z_core/os_agent/merlin_z_core_daemon.py (내장 소프트웨어 플러그인 3종 포함: zeye_os, senstalk, aggrofilter)
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


def find_signtool() -> str | None:
    """Windows Kits(SDK) 내 signtool.exe 경로를 자동 탐색합니다."""
    if shutil.which("signtool.exe"):
        return shutil.which("signtool.exe")
    kits_root = Path(r"C:\Program Files (x86)\Windows Kits\10\bin")
    if kits_root.exists():
        candidates = sorted(kits_root.glob("**/x64/signtool.exe"), reverse=True)
        if candidates:
            return str(candidates[0])
    return None


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
    환경변수(AZURE_CODESIGN_DLIB / MS_CODESIGN_PFX_PATH / MS_CODESIGN_THUMBPRINT)에 맞춰
    signtool.exe로 SHA-256 + RFC3161 타임스탬프 서명을 수행합니다.
    """
    signtool = find_signtool()
    azure_dlib = os.environ.get("AZURE_CODESIGN_DLIB", "")
    azure_metadata = os.environ.get("AZURE_CODESIGN_METADATA", "")
    pfx_path = os.environ.get("MS_CODESIGN_PFX_PATH", "")
    pfx_pass = os.environ.get("MS_CODESIGN_PFX_PASSWORD", "")
    cert_thumbprint = os.environ.get("MS_CODESIGN_THUMBPRINT", "")

    if not signtool:
        return {
            "signed": False,
            "reason": "SIGNTOOL_NOT_FOUND_ON_HOST",
            "readyCommand": (
                'signtool.exe sign /v /fd SHA256 /tr "http://timestamp.acs.microsoft.com" /td SHA256 '
                '/dlib "Azure.CodeSigning.Dlib.dll" /dmdf "metadata.json" "Merlin_Z_Core_Setup.exe"'
            ),
        }

    cmd = [signtool, "sign", "/fd", "SHA256"]
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
            "reason": "NO_CERT_ENV_CONFIGURED (AZURE_CODESIGN_DLIB or MS_CODESIGN_PFX_PATH required)",
            "readyCommand": (
                f'"{signtool}" sign /v /fd SHA256 /tr "http://timestamp.acs.microsoft.com" /td SHA256 '
                f'/dlib "%LOCALAPPDATA%\\Microsoft\\MicrosoftArtifactSigningClientTools\\Azure.CodeSigning.Dlib.dll" '
                f'/dmdf "artifact_signing_metadata.json" "{exe_path}"'
            ),
        }

    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return {
        "signed": res.returncode == 0,
        "returncode": res.returncode,
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
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm", "--clean", "--onefile",
        "--name", "Merlin_Z_Core_Setup",
        "--distpath", str(DIST_DIR),
        "--workpath", str(work_root / "work"),
        "--specpath", str(work_root / "spec"),
        "--paths", str(THIS_DIR),
        "--hidden-import", "plugin_zeye_os",
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
    빌드된 exe를 임시 포트로 기동해 헬스체크 + 1차 3대 기능(제트아이 OS · 센스톡 · 어그로필터) 응답을 실측합니다.
    (개발 PC의 5199는 Vite 개발서버가 점유할 수 있으므로 기본 15199에서 검증 — 비서실 실측 방식과 동일)
    """
    import time
    import urllib.request

    if not exe_path.exists():
        return {"ok": False, "error": f"exe 없음: {exe_path}"}
    proc = subprocess.Popen([str(exe_path), "--port", str(port)], creationflags=0x08000000)
    base = f"http://127.0.0.1:{port}"

    def get(path: str, data: Dict[str, Any] | None = None, t: float = 20.0) -> Dict[str, Any]:
        body = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(base + path, data=body, headers={"Content-Type": "application/json"}, method="POST" if body else "GET")
        with urllib.request.urlopen(req, timeout=t) as r:
            return json.loads(r.read().decode("utf-8", "replace"))

    report: Dict[str, Any] = {"port": port}
    try:
        t0 = time.time()
        while True:  # onefile 압축해제 기상 대기
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
            "zeyeOs": lambda: get("/api/zeye/health"),
            "senstalk": lambda: get("/api/senstalk/health"),
            "aggrofilterHealth": lambda: get("/api/aggrofilter/health"),
            "aggrofilterLiveCaption": lambda: get("/aggrofilter/v1/extract-subtitles", {"url": "https://www.youtube.com/watch?v=arj7oStGLkU"}, t=30.0),
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
        (report.get(k) or {}).get("ok") for k in ("zeyeOs", "senstalk", "aggrofilterHealth", "aggrofilterLiveCaption")
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Build & MS Code-Sign Merlin_Z_Core_Setup.exe")
    parser.add_argument("--check", action="store_true", help="MS 서명 도구(signtool) 및 플러그인 패키징 준비 상태 점검")
    parser.add_argument("--build", action="store_true", help="PyInstaller 단일 exe 빌드 → 실행 검증 → (인증서 환경 시) 서명")
    parser.add_argument("--console", action="store_true", help="디버그용 콘솔 창 표시 빌드")
    parser.add_argument("--verify-port", type=int, default=15199, help="빌드 검증용 임시 포트 (기본 15199)")
    args = parser.parse_args()

    try:
        if sys.stdout and hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    if args.build:
        out: Dict[str, Any] = {"build": build_with_pyinstaller(console=args.console)}
        exe = DIST_DIR / "Merlin_Z_Core_Setup.exe"
        if out["build"]["built"]:
            out["verify"] = verify_built_exe(exe, port=args.verify_port)
            out["sign"] = sign_binary_with_ms_codesign(exe)
            out["authenticode"] = verify_authenticode_signature(exe)
        out["ok"] = bool(out["build"]["built"] and (out.get("verify") or {}).get("ok"))
        print(json.dumps(out, ensure_ascii=False, indent=2))
        sys.exit(0 if out["ok"] else 1)

    signtool = find_signtool()
    daemon_py = THIS_DIR / "merlin_z_core_daemon.py"
    plugins = [
        THIS_DIR / "core_win32.py",
        THIS_DIR / "plugin_zeye_os.py",
        THIS_DIR / "plugin_senstalk.py",
        THIS_DIR / "plugin_aggrofilter.py",
        THIS_DIR / "merlin_z_core_os.py",
    ]
    report = {
        "ok": True,
        "targetExecutable": str(DIST_DIR / "Merlin_Z_Core_Setup.exe"),
        "daemonEntry": str(daemon_py),
        "bundledPlugins": [p.name for p in plugins if p.exists()],
        "signtoolFound": bool(signtool),
        "signtoolPath": signtool or "Windows SDK signtool.exe (CI/Release 머신에서 자동 바인딩)",
        "smartScreenDefense": "Microsoft Artifact Signing (Azure Trusted Signing) SHA-256 + RFC3161 Timestamp",
        "signingCommandTemplate": (
            'signtool.exe sign /v /fd SHA256 /tr "http://timestamp.acs.microsoft.com" /td SHA256 '
            '/dlib "Azure.CodeSigning.Dlib.dll" /dmdf "artifact_signing_metadata.json" '
            '"dist/Merlin_Z_Core_Setup.exe"'
        ),
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
