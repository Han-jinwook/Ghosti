#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
❖ Ghosti Agent Safe Care Toolset (plugin_ghosti_agent_care.py)
- 귀신비서(1귀신) '제미니 에이전트 자유 문답 + 다중 취사선택 PC 정리' 전용 Python 서버측 안전 도구 상자 (v1.0.0)
- 최종 합의된 5대 기둥 (2026-11-24 Ghosti × MerlinHub 합의 확정):
  1) 영구 삭제(rmtree/unlink) 0% 절대 철칙 — 유저 파일·폴더·캐시·PUP 적출 모두 Windows 기본 휴지통(send_to_recycle_bin) 직행 + [복원 기록] 등록
  2) Zero-Trust 최고권한 헬퍼(GhostiSecurityCareHelper) — 웹/LLM 임의 커맨드 실행 영구 금지, 오직 레지스트리 재검증 식별자({hive, subkey}) 및 서명된 PUP ID만 처리
  3) 2-Pass 배치 언인스톨 (1차: 무소음 고속 + PUP 적출 ➔ 2차: GUI 확인 필수 앱 1개씩 TopMost 순차, 45초 스킵) + 잠긴 악성 DLL(.disabled_by_ghosti) rename ➔ 재부팅 후 자동 휴지통 이동
  4) 데스크톱 전용 배터리 가드(GetSystemPowerStatus().BatteryFlag == 128) — 순수 데스크톱에서만 hiberfil.sys 해제 및 고성능 전원 전환 기본 권장
  5) 불가침 보호선 하드코딩 — 브라우저 쿠키·로그인·IndexedDB 절대 보호(4대 순수 캐시만), 카톡 대화DB·받은파일 보호, CapCut 캐시 vs 프로젝트 분리, 하드웨어 드라이버(NVIDIA/AMD/Intel/Realtek/Chipset/Wi-Fi) 영구 보호
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
import ctypes
from ctypes import wintypes
import datetime
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

try:
    import winreg
except ImportError:
    winreg = None  # type: ignore

THIS_DIR = Path(__file__).resolve().parent
OS_AGENT_DIR = THIS_DIR.parent
if str(OS_AGENT_DIR) not in sys.path:
    sys.path.insert(0, str(OS_AGENT_DIR))

CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0

LOCAL_APPDATA = Path(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")))
APPDATA = Path(os.environ.get("APPDATA", os.path.expanduser("~")))
USERPROFILE = Path(os.environ.get("USERPROFILE", os.path.expanduser("~")))
PROGRAMDATA = Path(os.environ.get("PROGRAMDATA", r"C:\ProgramData"))
SYSTEMROOT = Path(os.environ.get("SystemRoot", r"C:\Windows"))

# ---------------------------------------------------------------------------
# [불가침 보호선] 하드웨어 드라이버 · OS 핵심 · 멀린 패밀리 · 개인 데이터 보호 토큰
# ---------------------------------------------------------------------------
HARDWARE_DRIVER_PROTECTED_TOKENS = (
    "nvidia", "geforce", "amd ", "amd radeon", "amd software", "ati catalyst", "catalyst control",
    "intel(r) graphics", "intel graphics", "intel(r) wireless", "intel(r) wi-fi", "intel(r) chipset",
    "realtek", "audio driver", "bluetooth driver", "lan driver", "ethernet", "killer wireless",
    "qualcomm", "broadcom", "synaptics", "elan ", "logitech", "razer", "seagull drivers",
    "microsoft visual c++", "windows desktop runtime", ".net runtime", ".net sdk",
)

CORE_APP_PROTECTED_TOKENS = (
    "merlin", "ghosti", "senstalk", "sensebot", "sundream", "tailscale",
    "windows defender", "securityhealth", "microsoft edge", "google chrome",
    "kakaotalk", "카카오톡", "telegram", "google drive", "onedrive", "mybox",
    "microsoft office", "microsoft 365", "office 16", "한컴", "hancom", "한글과컴퓨터",
    "python", "node.js", "git", "antigravity",
)

# 브라우저 프로필 내 오직 허용되는 4대 순수 캐시 하위 경로 (Cookies / Login Data / Local Storage / IndexedDB 절대 불가침)
BROWSER_SAFE_CACHE_RELPATHS = (
    Path("Cache") / "Cache_Data",
    Path("Cache"),
    Path("Code Cache"),
    Path("GPUCache"),
    Path("Service Worker") / "CacheStorage",
)

BROWSER_PROFILE_ROOTS: List[Tuple[str, str, Path]] = [
    ("chrome_cache", "Google Chrome 브라우저 캐시 (로그인·쿠키 100% 보호)", LOCAL_APPDATA / "Google" / "Chrome" / "User Data"),
    ("edge_cache", "Microsoft Edge 브라우저 캐시 (로그인·쿠키 100% 보호)", LOCAL_APPDATA / "Microsoft" / "Edge" / "User Data"),
    ("whale_cache", "네이버 웨일 브라우저 캐시 (로그인·쿠키 100% 보호)", LOCAL_APPDATA / "Naver" / "Naver Whale" / "User Data"),
]

# 알려진 악성 PUP / 그리드 / 광고 스케줄러 서명 카탈로그 (Zero-Trust 헬퍼가 ID로만 받아 자체 검증 실행)
KNOWN_PUP_CATALOG: Dict[str, Dict[str, Any]] = {
    "pup_cachecloud": {
        "displayName": "CacheCloud / CacheConsole (백그라운드 그리드·애드웨어)",
        "category": "PUP_ADWARE",
        "exes": ["CacheCloud.exe", "CacheConsole.exe", "CacheService.exe", "FrontServiceUpdater.exe"],
        "tasks": ["CacheCloud", "CacheConsole", "CacheService", "FrontServiceUpdater"],
        "services": ["CacheService", "CacheCloud"],
        "paths": [str(APPDATA / "CacheCloud")],
    },
    "pup_cloudtask": {
        "displayName": "CloudTaskModule (자동부활 백그라운드 애드웨어)",
        "category": "PUP_ADWARE",
        "exes": ["CloudTaskModule.exe", "CloudTaskUpdater.exe"],
        "tasks": ["CloudTaskModule", "CloudTaskUpdater"],
        "services": ["CloudTaskModule"],
        "paths": [str(PROGRAMDATA / "CloudTaskModule")],
    },
    "pup_storagesvc": {
        "displayName": "StorageServiceManager (위장 스토리지 애드웨어)",
        "category": "PUP_ADWARE",
        "exes": ["StorageServiceManager.exe"],
        "tasks": ["StorageServiceManager"],
        "services": ["StorageServiceManager"],
        "paths": [str(PROGRAMDATA / "StorageServiceManager")],
    },
    "pup_pcappstore": {
        "displayName": "PC App Store (번들 숙주 애드웨어)",
        "category": "PUP_ADWARE",
        "exes": ["PcAppStore.exe", "PCAppStore.exe"],
        "tasks": ["PCAppStore"],
        "services": ["PcAppStoreSRV", "PCAppStore"],
        "paths": [r"C:\Program Files (x86)\PCAppStore", r"C:\Program Files\PCAppStore"],
    },
    "pup_febjb": {
        "displayName": "febjb.exe (Windows 폴더 숨김 애드웨어)",
        "category": "PUP_ADWARE",
        "exes": ["febjb.exe"],
        "tasks": ["febjb"],
        "services": [],
        "paths": [str(SYSTEMROOT / "febjb.exe")],
    },
    "pup_datasharing_cookie": {
        "displayName": "Task_DataSharingServices (크롬 쿠키 잠금 해제 위험 스케줄러)",
        "category": "PUP_ADWARE",
        "exes": [],
        "tasks": ["Task_DataSharingServices"],
        "services": [],
        "paths": [],
    },
    "pup_hancapture_toast": {
        "displayName": "HanCapturePlus Toast (팝업 배너 광고 모듈)",
        "category": "PUP_ADWARE",
        "exes": ["Toast.exe"],
        "tasks": ["{E0477272-850C-4E8D-9C5C-A638D4800D1D}"],
        "services": [],
        "paths": [r"C:\Program Files (x86)\Hantools\HanCapturePlus"],
    },
    "pup_legacy_sched_junk": {
        "displayName": "MSLoad / NGPlus / RayItemGate / ALTools Zum 전송 찌꺼기",
        "category": "PUP_ADWARE",
        "exes": ["msload.exe", "sngp.exe", "RayItemGate.exe", "zsi.exe"],
        "tasks": ["MSLoad", "NGPlus", "RayItemGate", "Task_ShellExecuteAs", "ClipdownBootStrapper"],
        "services": ["TUCTLSystem", "Yondisk_macadress", "NATService", "NATSvc"],
        "paths": [str(APPDATA / "newgoplus"), str(SYSTEMROOT / "System32" / "RayItemGate.exe")],
    },
    "pup_ocam_task": {
        "displayName": "oCamTask (오캠 백그라운드 상주 스케줄러)",
        "category": "BLOAT_BACKGROUND",
        "exes": ["oCamTask.exe"],
        "tasks": ["oCamTask"],
        "services": [],
        "paths": [],
    },
    "pup_copilot_bg": {
        "displayName": "Microsoft Copilot 백그라운드 상주 (RAM ~600MB 점유)",
        "category": "BLOAT_BACKGROUND",
        "exes": ["copilotapp.exe"],
        "tasks": [],
        "services": [],
        "paths": [],
    },
    "pup_hp_telemetry": {
        "displayName": "HP Print Scan Doctor / 제품 개선 연구 (백그라운드 진단·전송)",
        "category": "BLOAT_BACKGROUND",
        "exes": ["HPPrinterHealthMonitor.exe", "HPCustPartic.exe"],
        "tasks": [
            "HPCustParticipation HP OfficeJet Pro 8210",
            r"HP\HP Print Scan Doctor\Printer Health Monitor",
            r"HP\HP Print Scan Doctor\Printer Health Monitor Logon",
        ],
        "services": ["HPPrintScanDoctorService"],
        "paths": [],
    },
}

# 보안모듈 및 그리드 분류 키워드
GRID_AND_ADWARE_APP_TOKENS = (
    "pc app store", "pcappstore", "yoondisk", "yondisk", "고클린", "goclean",
    "scapture", "clipdown", "natservice", "cachecloud", "cloudtask",
    "hp dropbox plugin", "hp google drive plugin", "제품 개선 연구",
    "tabbie", "utilzone", "windowexe",
)

WEB_SECURITY_APP_TOKENS = (
    "nprotect", "anysign", "touchen", "delfino", "veraport", "wizvera",
    "iniline", "crossex", "inisafe", "crosscert", "ipinside", "keysharp",
    "magicline", "markany", "e-pagesafer", "miplatform", "ozweblauncher",
    "ozx webagent", "iformscan", "inziiform", "non-activex kipo", "redbc",
    "secure keystroke", "aps engine", "yettiesoft", "secukit", "eisp",
)


# ---------------------------------------------------------------------------
# 0. 공통 하드웨어 판별(데스크톱 배터리 가드) & 고속 폴더 크기 측정
# ---------------------------------------------------------------------------
class _SYSTEM_POWER_STATUS(ctypes.Structure):
    _fields_ = [
        ("ACLineStatus", ctypes.c_byte),
        ("BatteryFlag", ctypes.c_byte),
        ("BatteryLifePercent", ctypes.c_byte),
        ("SystemStatusFlag", ctypes.c_byte),
        ("BatteryLifeTime", wintypes.DWORD),
        ("BatteryFullLifeTime", wintypes.DWORD),
    ]


def is_pure_desktop_pc() -> Dict[str, Any]:
    """
    [토론 2 확정: 데스크톱 전용 배터리 가드]
    kernel32.GetSystemPowerStatus().BatteryFlag == 128 (0x80 = No System Battery)일 때만
    배터리 없는 순수 데스크톱 PC로 판정합니다. 노트북에서는 절대 hiberfil.sys 해제·고성능 강제를 기본 권장하지 않습니다.
    """
    if sys.platform != "win32":
        return {"isDesktop": False, "hasBattery": True, "batteryFlag": 0, "reason": "NON_WINDOWS"}
    try:
        st = _SYSTEM_POWER_STATUS()
        if ctypes.windll.kernel32.GetSystemPowerStatus(ctypes.byref(st)):
            bflag = int(st.BatteryFlag) & 0xFF
            no_battery = bool(bflag == 128 or (bflag & 128))
            return {
                "isDesktop": no_battery,
                "hasBattery": not no_battery,
                "batteryFlag": bflag,
                "acLineStatus": int(st.ACLineStatus) & 0xFF,
            }
    except Exception as exc:
        return {"isDesktop": False, "hasBattery": True, "batteryFlag": 255, "error": str(exc)}
    return {"isDesktop": False, "hasBattery": True, "batteryFlag": 255}


def _get_active_power_plan_info() -> Dict[str, Any]:
    if sys.platform != "win32":
        return {"guid": "", "name": "", "isHighPerformance": False}
    try:
        r = subprocess.run(
            ["powercfg", "/getactivescheme"],
            capture_output=True,
            text=True,
            encoding="cp949",
            errors="ignore",
            timeout=2.5,
            creationflags=CREATE_NO_WINDOW,
        )
        out = (r.stdout or "").strip()
        m = re.search(r"([0-9a-fA-F\-]{36})\s*\((.+?)\)", out)
        guid = m.group(1).lower() if m else ""
        name = m.group(2).strip() if m else out
        is_high = guid == "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c" or "고성능" in name or "high performance" in name.lower()
        return {"guid": guid, "name": name, "isHighPerformance": is_high}
    except Exception:
        return {"guid": "", "name": "", "isHighPerformance": False}


def _fast_dir_size_bytes(path: Path, max_files: int = 8000, deadline: Optional[float] = None) -> Tuple[int, int, bool]:
    """
    고속 폴더 크기 측정:
    - 파일이 적은 일반 폴더는 os.scandir 재귀로 0.05초 이내 측정
    - 대용량 폴더는 robocopy /L /S /BYTES /MT:8 (파일 복사 없이 메타 바이트만 멀티스레드 합산) 또는 시간 컷오프로 3초 내 완료 보장
    Returns: (bytes, file_count, truncated)
    """
    if not path.exists():
        return 0, 0, False
    if path.is_file():
        try:
            return int(path.stat().st_size), 1, False
        except Exception:
            return 0, 0, False

    total_b = 0
    cnt = 0
    truncated = False
    stack = [path]
    try:
        while stack:
            if deadline is not None and time.monotonic() > deadline:
                truncated = True
                break
            cur = stack.pop()
            try:
                with os.scandir(cur) as it:
                    for entry in it:
                        try:
                            if entry.is_symlink():
                                continue
                            if entry.is_file(follow_symlinks=False):
                                total_b += int(entry.stat(follow_symlinks=False).st_size)
                                cnt += 1
                                if cnt >= max_files:
                                    truncated = True
                                    break
                            elif entry.is_dir(follow_symlinks=False):
                                stack.append(Path(entry.path))
                        except OSError:
                            continue
            except OSError:
                continue
            if truncated:
                break
    except Exception:
        pass

    # 파일 수가 많아 조기 컷오프된 경우 Windows robocopy /L /MT:8 로 정밀 바이트 합계 고속 측정 (최대 1.8초)
    if truncated and sys.platform == "win32":
        try:
            rem_t = 1.8 if deadline is None else max(0.5, min(1.8, deadline - time.monotonic()))
            r = subprocess.run(
                ["robocopy", str(path), r"C:\__ghosti_size_probe_dummy__", "/L", "/S", "/NFL", "/NDL", "/NJH", "/BYTES", "/NC", "/NS", "/MT:8"],
                capture_output=True,
                text=True,
                encoding="cp949",
                errors="ignore",
                timeout=rem_t,
                creationflags=CREATE_NO_WINDOW,
            )
            m_b = re.search(r"Bytes\s*:\s*(\d+)", r.stdout or "")
            m_f = re.search(r"Files\s*:\s*(\d+)", r.stdout or "")
            if m_b:
                total_b = int(m_b.group(1))
                if m_f:
                    cnt = int(m_f.group(1))
                truncated = False
        except Exception:
            pass

    return total_b, cnt, truncated


def _is_hardware_driver_or_core(name: str, publisher: str = "") -> bool:
    comb = f"{name} {publisher}".lower()
    return any(t in comb for t in HARDWARE_DRIVER_PROTECTED_TOKENS) or any(t in comb for t in CORE_APP_PROTECTED_TOKENS)


def _send_path_safe_recycle(target: Path) -> Dict[str, Any]:
    """모든 파일/폴더 정리는 오직 Windows 기본 휴지통(send_to_recycle_bin) 직행 — 영구 삭제 0%."""
    import ghosti_safe_ops as safe_ops

    return safe_ops.send_to_recycle_bin(target)


def _recycle_dir_contents_skip_locked(dir_path: Path) -> Dict[str, Any]:
    """
    크롬/웨일 등이 실행 중일 때 폴더 전체 이동이 WinError 32에 막히지 않도록,
    잠겨 있지 않은 하위 항목만 선별하여 Windows 기본 휴지통으로 안전 이동합니다.
    """
    if not dir_path.exists():
        return {"ok": True, "movedCount": 0, "reclaimedBytes": 0, "skippedLocked": 0}
    moved = 0
    reclaimed = 0
    skipped = 0
    try:
        entries = list(dir_path.iterdir())
    except Exception:
        return {"ok": False, "movedCount": 0, "reclaimedBytes": 0, "skippedLocked": 1}

    for entry in entries:
        try:
            sz, _, _ = _fast_dir_size_bytes(entry, max_files=1500)
            res = _send_path_safe_recycle(entry)
            if res.get("ok"):
                moved += 1
                reclaimed += sz
            else:
                skipped += 1
        except Exception:
            skipped += 1
    return {"ok": moved > 0 or skipped == 0, "movedCount": moved, "reclaimedBytes": reclaimed, "skippedLocked": skipped}


def _disable_locked_pup_path_safe(target: Path) -> Dict[str, Any]:
    """
    [토론 1 확정: 잠긴 악성 PUP 파일 3단계 안전 적출 — 영구 삭제 0% + 부활 0%]
    1) 먼저 Windows 기본 휴지통으로 이동 시도
    2) WinError 32 등으로 잠겨 있으면 os.rename(file, file + '.disabled_by_ghosti')로 이름 변경해 재부팅 부활 100% 차단
    3) 다음 Z-코어 기동 시 sweep_disabled_pup_remnants_to_recycle()이 자동으로 휴지통으로 이동
    """
    if not target.exists():
        return {"ok": True, "method": "ALREADY_GONE"}
    res = _send_path_safe_recycle(target)
    if res.get("ok"):
        return {"ok": True, "method": "RECYCLE_BIN", "path": str(target)}

    renamed_list: List[str] = []
    if target.is_file():
        if not target.name.endswith(".disabled_by_ghosti"):
            new_p = target.with_name(f"{target.name}.disabled_by_ghosti")
            try:
                os.rename(target, new_p)
                renamed_list.append(str(new_p))
            except Exception:
                pass
    elif target.is_dir():
        for child in list(target.iterdir()):
            r_c = _send_path_safe_recycle(child)
            if not r_c.get("ok") and child.is_file() and not child.name.endswith(".disabled_by_ghosti"):
                new_p = child.with_name(f"{child.name}.disabled_by_ghosti")
                try:
                    os.rename(child, new_p)
                    renamed_list.append(str(new_p))
                except Exception:
                    pass
    if renamed_list:
        _record_pending_disabled_pup_files(renamed_list)
        return {"ok": True, "method": "RENAMED_DISABLED_PENDING_RECYCLE", "renamed": renamed_list}
    return {"ok": False, "method": "LOCKED", "error": str(res.get("error") or "FILE_IN_USE")}


_PENDING_PUP_SWEEP_FILE = LOCAL_APPDATA / "Ghosti" / "data" / "pending_disabled_pup_recycle.json"


def _record_pending_disabled_pup_files(paths: List[str]) -> None:
    try:
        _PENDING_PUP_SWEEP_FILE.parent.mkdir(parents=True, exist_ok=True)
        existing: List[str] = []
        if _PENDING_PUP_SWEEP_FILE.exists():
            existing = json.loads(_PENDING_PUP_SWEEP_FILE.read_text(encoding="utf-8"))
        merged = sorted(set(existing + [str(p) for p in paths if p]))
        _PENDING_PUP_SWEEP_FILE.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass


def sweep_disabled_pup_remnants_to_recycle() -> Dict[str, Any]:
    """Z-코어 기동 시 재부팅으로 잠금이 풀린 .disabled_by_ghosti 악성 파일들을 자동으로 Windows 휴지통에 안전 이동합니다."""
    if not _PENDING_PUP_SWEEP_FILE.exists():
        return {"ok": True, "sweptCount": 0}
    try:
        pending = json.loads(_PENDING_PUP_SWEEP_FILE.read_text(encoding="utf-8"))
        if not isinstance(pending, list) or not pending:
            return {"ok": True, "sweptCount": 0}
        still_pending: List[str] = []
        swept = 0
        for p_str in pending:
            p = Path(str(p_str))
            if not p.exists():
                continue
            r = _send_path_safe_recycle(p)
            if r.get("ok"):
                swept += 1
            else:
                still_pending.append(str(p))
        _PENDING_PUP_SWEEP_FILE.write_text(json.dumps(still_pending, ensure_ascii=False, indent=2), encoding="utf-8")
        return {"ok": True, "sweptCount": swept, "remainingCount": len(still_pending)}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# 1. [과제 3 + 보완 2·3] C드라이브 대용량 공간 도둑 3초 고속 정밀 스캐너 (disk-hog-scan)
# ---------------------------------------------------------------------------
def scan_disk_hogs(drive: str = "C:") -> Dict[str, Any]:
    t0 = time.perf_counter()
    deadline = time.monotonic() + 3.2
    drv_letter = (drive or "C:").strip().rstrip("\\/").upper()
    if len(drv_letter) == 1:
        drv_letter += ":"

    # 1) 모든 고정 로컬 드라이브 실측 (D: 등 100GB+ 여유 드라이브 이사 추천용)
    drives_info: List[Dict[str, Any]] = []
    available_move_drives: List[Dict[str, Any]] = []
    if sys.platform == "win32":
        bitmask = ctypes.windll.kernel32.GetLogicalDrives()
        for i in range(26):
            if not (bitmask & (1 << i)):
                continue
            dl = f"{chr(65 + i)}:"
            root_s = f"{dl}\\"
            try:
                dtype = ctypes.windll.kernel32.GetDriveTypeW(ctypes.c_wchar_p(root_s))
                if dtype != 3:  # DRIVE_FIXED만
                    continue
                du = shutil.disk_usage(root_s)
                tot_gb = round(du.total / (1024 ** 3), 1)
                free_gb = round(du.free / (1024 ** 3), 1)
                used_pct = round(((du.total - du.free) / max(1, du.total)) * 100, 1)
                info = {"drive": dl, "totalGb": tot_gb, "freeGb": free_gb, "usedPercent": used_pct}
                drives_info.append(info)
                if dl != drv_letter and free_gb >= 50.0:
                    available_move_drives.append(info)
            except Exception:
                continue

    c_drive_info = next((d for d in drives_info if d["drive"] == drv_letter), drives_info[0] if drives_info else {"drive": "C:", "totalGb": 0, "freeGb": 0, "usedPercent": 0})
    desktop_info = is_pure_desktop_pc()
    power_plan = _get_active_power_plan_info()

    # 2) 병렬 측정할 후보 구성
    # (A) 안전 캐시 그룹 (로그인/쿠키/카톡대화/받은파일 100% 보호)
    cache_targets: List[Dict[str, Any]] = [
        {"id": "cache_user_temp", "name": "사용자 임시 파일 (%TEMP%)", "cat": "SAFE_CACHE", "paths": [Path(os.environ.get("TEMP", str(LOCAL_APPDATA / "Temp")))], "safeToClean": True},
        {"id": "cache_npm", "name": "Node.js npm 캐시 (npm-cache)", "cat": "SAFE_CACHE", "paths": [LOCAL_APPDATA / "npm-cache", APPDATA / "npm-cache"], "safeToClean": True},
        {"id": "cache_pnpm_yarn", "name": "pnpm / yarn / uv / pip 개발 캐시", "cat": "SAFE_CACHE", "paths": [LOCAL_APPDATA / "pnpm-cache", LOCAL_APPDATA / "pip" / "cache", LOCAL_APPDATA / "uv" / "cache", LOCAL_APPDATA / "Yarn" / "Cache"], "safeToClean": True},
        {"id": "cache_gradle", "name": "Gradle 빌드 캐시", "cat": "SAFE_CACHE", "paths": [USERPROFILE / ".gradle" / "caches"], "safeToClean": True},
        {"id": "cache_crashdumps", "name": "Windows 오류 덤프 (CrashDumps)", "cat": "SAFE_CACHE", "paths": [LOCAL_APPDATA / "CrashDumps"], "safeToClean": True},
        {"id": "cache_merlin_video", "name": "귀신같이 동영상 스트리밍 임시 캐시", "cat": "SAFE_CACHE", "paths": [LOCAL_APPDATA / "Merlin" / "video_stream_cache"], "safeToClean": True},
        {"id": "cache_kakao_ad", "name": "카카오톡 광고·임시 캐시 (대화·받은파일 100% 보호)", "cat": "SAFE_CACHE", "paths": [LOCAL_APPDATA / "Kakao" / "KakaoTalk" / "Cache", LOCAL_APPDATA / "Kakao" / "KakaoTalk" / "AdFit"], "safeToClean": True},
        {"id": "cache_capcut_render", "name": "CapCut 렌더링·임시 캐시 (편집 프로젝트 원본 100% 보호)", "cat": "SAFE_CACHE", "paths": [LOCAL_APPDATA / "CapCut" / "User Data" / "Cache"], "safeToClean": True},
    ]

    # 크롬 / 엣지 / 웨일 모든 프로필(Default, Profile 1~N)의 4대 순수 캐시만 정밀 수집
    for bid, blabel, broot in BROWSER_PROFILE_ROOTS:
        if broot.is_dir():
            cpaths: List[Path] = []
            try:
                for pdir in broot.iterdir():
                    if not pdir.is_dir():
                        continue
                    if pdir.name == "Default" or pdir.name.startswith("Profile "):
                        for rel_c in BROWSER_SAFE_CACHE_RELPATHS:
                            cand = pdir / rel_c
                            if cand.is_dir():
                                cpaths.append(cand)
            except Exception:
                pass
            if cpaths:
                cache_targets.append({
                    "id": bid,
                    "name": blabel,
                    "cat": "SAFE_CACHE",
                    "paths": cpaths,
                    "safeToClean": True,
                })

    # (B) 대용량 폴더/시스템 파일 후보 (CapCut 본체/프로젝트, Downloads, Desktop, Documents, AppData\Local 대용량, hiberfil.sys)
    import ghosti_safe_ops as safe_ops

    dl_dir = safe_ops.known_folder("downloads")
    desk_dir = safe_ops.known_folder("desktop")
    docs_dir = safe_ops.known_folder("documents")

    folder_candidates: List[Dict[str, Any]] = [
        {"id": "folder_downloads", "name": f"다운로드 폴더 ({dl_dir.name})", "cat": "USER_FOLDER", "path": dl_dir, "movableToOtherDrive": True},
        {"id": "folder_desktop", "name": f"바탕화면 폴더 ({desk_dir.name})", "cat": "USER_FOLDER", "path": desk_dir, "movableToOtherDrive": True},
        {"id": "folder_capcut_all", "name": "CapCut 앱 본체 + 편집 프로젝트 전체 (AppData\\Local\\CapCut)", "cat": "APP_DATA_HOG", "path": LOCAL_APPDATA / "CapCut", "movableToOtherDrive": False},
        {"id": "folder_telegram_dl", "name": "텔레그램 캐시·다운로드 (Telegram Desktop)", "cat": "APP_DATA_HOG", "path": APPDATA / "Telegram Desktop", "movableToOtherDrive": False},
    ]

    # AppData\Local 주요 앱 폴더 중 덩치 큰 후보 추가 (Merlin/Microsoft/Google 시스템 코어는 분리 안내)
    skip_local_names = {"temp", "microsoft", "packages", "programs", "merlin", "ghosti", "npm-cache", "pip", "capcut", "crashdumps", "google", "naver"}
    try:
        for entry in LOCAL_APPDATA.iterdir():
            if entry.is_dir() and entry.name.lower() not in skip_local_names:
                folder_candidates.append({
                    "id": f"localapp_{re.sub(r'[^a-z0-9_]', '_', entry.name.lower())[:24]}",
                    "name": f"앱 데이터 폴더 (AppData\\Local\\{entry.name})",
                    "cat": "APP_DATA_HOG",
                    "path": entry,
                    "movableToOtherDrive": False,
                })
    except Exception:
        pass

    # Downloads / Desktop 내부의 300MB 이상 개별 대용량 하위 폴더도 자동 색출
    for base_lbl, base_p in (("다운로드", dl_dir), ("바탕화면", desk_dir)):
        if base_p.is_dir():
            try:
                for sub in base_p.iterdir():
                    if sub.name.lower() == "desktop.ini":
                        continue
                    folder_candidates.append({
                        "id": f"sub_{re.sub(r'[^a-z0-9가-힣_]', '_', sub.name.lower())[:24]}",
                        "name": f"[{base_lbl}] {sub.name}",
                        "cat": "USER_LARGE_ITEM",
                        "path": sub,
                        "movableToOtherDrive": True,
                    })
            except Exception:
                pass

    safe_caches_out: List[Dict[str, Any]] = []
    heavy_folders_out: List[Dict[str, Any]] = []

    def _measure_cache_group(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        tot = 0
        f_cnt = 0
        valid_paths: List[str] = []
        for p in item["paths"]:
            if p.exists():
                b, c, _ = _fast_dir_size_bytes(p, max_files=3500, deadline=deadline)
                if b > 0:
                    tot += b
                    f_cnt += c
                    valid_paths.append(str(p))
        if tot < 5 * 1024 * 1024:  # 5MB 미만은 목록 노이즈 제거
            return None
        return {
            "id": item["id"],
            "name": item["name"],
            "cat": item["cat"],
            "sizeBytes": tot,
            "sizeMb": round(tot / (1024 * 1024), 1),
            "fileCount": f_cnt,
            "paths": valid_paths,
            "recommendedAction": "RECYCLE_CACHE",
            "safeToClean": True,
        }

    def _measure_folder(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        p: Path = item["path"]
        if not p.exists():
            return None
        b, c, _ = _fast_dir_size_bytes(p, max_files=3500, deadline=deadline)
        threshold = 200 * 1024 * 1024 if item["cat"] != "USER_FOLDER" else 300 * 1024 * 1024
        if b < threshold:
            return None
        return {
            "id": item["id"],
            "name": item["name"],
            "cat": item["cat"],
            "path": str(p),
            "sizeBytes": b,
            "sizeMb": round(b / (1024 * 1024), 1),
            "fileCount": c,
            "movableToOtherDrive": bool(item.get("movableToOtherDrive")),
            "recommendedAction": "MOVE_TO_OTHER_DRIVE" if (item.get("movableToOtherDrive") and available_move_drives) else "REVIEW_OR_RECYCLE",
        }

    with ThreadPoolExecutor(max_workers=8) as pool:
        futs_c = [pool.submit(_measure_cache_group, it) for it in cache_targets]
        futs_f = [pool.submit(_measure_folder, it) for it in folder_candidates[:35]]
        for fut in as_completed(futs_c):
            res = fut.result()
            if res:
                safe_caches_out.append(res)
        for fut in as_completed(futs_f):
            res = fut.result()
            if res:
                heavy_folders_out.append(res)

    # 3) 데스크톱 최대절전 파일(C:\hiberfil.sys) 실측 + 배터리 가드 판정
    hiber_info: Dict[str, Any] = {"exists": False, "sizeMb": 0.0, "isDesktop": desktop_info["isDesktop"], "recommended": False}
    hiber_p = Path(f"{drv_letter}\\hiberfil.sys")
    try:
        if hiber_p.exists():
            h_bytes = int(hiber_p.stat().st_size)
            h_mb = round(h_bytes / (1024 * 1024), 1)
            hiber_info = {
                "exists": True,
                "path": str(hiber_p),
                "sizeBytes": h_bytes,
                "sizeMb": h_mb,
                "isDesktop": desktop_info["isDesktop"],
                "recommended": bool(desktop_info["isDesktop"] and h_mb >= 2048.0),
                "noteKo": (
                    f"데스크톱 PC에서 안 쓰는 최대절전 파일(hiberfil.sys)이 {round(h_mb/1024, 1)}GB를 고정 점유 중입니다. 끄시면 즉시 C: 공간이 늘어납니다!"
                    if desktop_info["isDesktop"]
                    else "노트북(배터리 기기)이므로 배터리 보호 및 빠른 시작 유지를 위해 자동 해제를 권장하지 않습니다."
                ),
            }
            if hiber_info["recommended"]:
                safe_caches_out.append({
                    "id": "sys_hiberfil_off",
                    "name": f"데스크톱 미사용 최대절전 파일 (C:\\hiberfil.sys — 즉시 실물 회수)",
                    "cat": "DESKTOP_HIBERFIL",
                    "sizeBytes": h_bytes,
                    "sizeMb": h_mb,
                    "fileCount": 1,
                    "paths": [str(hiber_p)],
                    "recommendedAction": "DISABLE_HIBERNATION",
                    "safeToClean": True,
                })
    except Exception:
        pass

    safe_caches_out.sort(key=lambda x: -float(x.get("sizeMb") or 0))
    heavy_folders_out.sort(key=lambda x: -float(x.get("sizeMb") or 0))
    heavy_folders_out = heavy_folders_out[:12]

    # 통합 번호(#1 ~ #N) 부여 (제미니 멀티턴 1:1 바인딩용)
    unified_items: List[Dict[str, Any]] = []
    idx_no = 1
    for sc in safe_caches_out:
        sc["no"] = idx_no
        unified_items.append(sc)
        idx_no += 1
    for hf in heavy_folders_out:
        hf["no"] = idx_no
        unified_items.append(hf)
        idx_no += 1

    total_safe_cache_mb = round(sum(float(x.get("sizeMb") or 0) for x in safe_caches_out), 1)
    total_heavy_mb = round(sum(float(x.get("sizeMb") or 0) for x in heavy_folders_out), 1)
    c_free_gb = float(c_drive_info.get("freeGb") or 0)
    projected_free_gb = round(c_free_gb + (total_safe_cache_mb / 1024.0), 1)

    return {
        "ok": True,
        "targetDrive": drv_letter,
        "drives": drives_info,
        "cDrive": c_drive_info,
        "availableMoveDrives": available_move_drives,
        "isDesktop": desktop_info["isDesktop"],
        "powerPlan": power_plan,
        "hiberfil": hiber_info,
        "safeCaches": safe_caches_out,
        "heavyFolders": heavy_folders_out,
        "items": unified_items,
        "totalSafeCacheMb": total_safe_cache_mb,
        "totalHeavyMb": total_heavy_mb,
        "currentFreeGb": c_free_gb,
        "projectedFreeAfterEmptyGb": projected_free_gb,
        "elapsedMs": round((time.perf_counter() - t0) * 1000, 1),
    }


def _run_elevated_powercfg_action(sub_cmd: str) -> Dict[str, Any]:
    """데스크톱 전용 배터리 가드 재검증 후 GhostiSecurityCareHelper 또는 직접 권한으로 powercfg 실행."""
    if sys.platform != "win32":
        return {"ok": False, "error": "WINDOWS_ONLY"}
    import plugin_ghosti_care_suite as care_suite

    if sub_cmd not in ("hiber_off", "power_high"):
        return {"ok": False, "error": "INVALID_POWERCFG_ACTION"}
    desk = is_pure_desktop_pc()
    if not desk["isDesktop"]:
        return {"ok": False, "error": "LAPTOP_BATTERY_GUARD_BLOCKED", "message": "노트북(배터리 장착 기기) 보호를 위해 자동 실행을 차단했습니다."}

    if care_suite.is_running_as_admin():
        args = ["powercfg", "-h", "off"] if sub_cmd == "hiber_off" else ["powercfg", "/setactive", "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c"]
        r = subprocess.run(args, capture_output=True, timeout=5.0, creationflags=CREATE_NO_WINDOW)
        return {"ok": r.returncode == 0, "method": "DIRECT_ADMIN"}

    return care_suite.execute_elevated_agent_care_queue("powercfg", {"powerAction": sub_cmd})


def execute_disk_hog_cleanup(
    include_ids: Optional[List[str]] = None,
    exclude_ids: Optional[List[str]] = None,
    move_destination_drive: str = "",
    user_approval_text: str = "대용량 공간 정리 승인",
) -> Dict[str, Any]:
    """
    [과제 3 실행기 — 영구 삭제 0% + 휴지통 비우기 전/후 용량 병기 UX]
    - 일반 캐시/폴더: Windows 기본 휴지통(send_to_recycle_bin) 안전 이동
    - sys_hiberfil_off (순수 데스크톱 한정): powercfg -h off로 즉시 실물 용량 확보
    - move_destination_drive (예: 'D:'): D:\귀신비서_보관함 으로 1초 안전 이사 + [복원 기록] 등록
    """
    import ghosti_safe_ops as safe_ops

    scan = scan_disk_hogs("C:")
    before_free_gb = float(scan.get("currentFreeGb") or 0.0)
    inc_set = {str(x).strip().lower() for x in (include_ids or []) if x}
    exc_set = {str(x).strip().lower() for x in (exclude_ids or []) if x}

    all_items: List[Dict[str, Any]] = list(scan.get("items") or [])
    selected: List[Dict[str, Any]] = []
    skipped_excluded: List[str] = []

    for it in all_items:
        iid = str(it.get("id") or "").lower()
        ino = f"#{it.get('no')}"
        iname = str(it.get("name") or "").lower()
        if any(e in (iid, ino, str(it.get("no"))) or (len(e) >= 2 and e in iname) for e in exc_set):
            skipped_excluded.append(str(it.get("name") or iid))
            continue
        if inc_set:
            if any(inc in (iid, ino, str(it.get("no"))) or (len(inc) >= 2 and inc in iname) for inc in inc_set):
                selected.append(it)
        else:
            # include가 비어 있으면 안전 캐시(SAFE_CACHE, DESKTOP_HIBERFIL)만 기본 선택 (사용자 폴더 임의 삭제 방지)
            if it.get("safeToClean"):
                selected.append(it)

    moved_to_recycle_bytes = 0
    immediate_reclaimed_bytes = 0
    processed_labels: List[str] = []
    restore_ops: List[Dict[str, Any]] = []
    errors: List[str] = []

    dest_drv = (move_destination_drive or "").strip().rstrip("\\/").upper()
    if dest_drv and len(dest_drv) == 1:
        dest_drv += ":"

    for it in selected:
        cat = str(it.get("cat") or "")
        name = str(it.get("name") or it.get("id") or "")
        if cat == "DESKTOP_HIBERFIL":
            r_h = _run_elevated_powercfg_action("hiber_off")
            if r_h.get("ok"):
                immediate_reclaimed_bytes += int(it.get("sizeBytes") or 0)
                processed_labels.append(f"{name} (즉시 해제 완료)")
            else:
                errors.append(f"{name}: {r_h.get('message') or r_h.get('error') or '권한 확인 필요'}")
            continue

        # 다른 여유 드라이브(D:\귀신비서_보관함)로 1초 안전 이사
        if dest_drv and it.get("movableToOtherDrive") and it.get("path"):
            src_p = Path(str(it["path"]))
            if src_p.exists() and Path(f"{dest_drv}\\").exists():
                vault_root = Path(f"{dest_drv}\\귀신비서_보관함")
                vault_root.mkdir(parents=True, exist_ok=True)
                dest_p = safe_ops.unique_target(vault_root / src_p.name)
                try:
                    sz = int(it.get("sizeBytes") or 0)
                    shutil.move(str(src_p), str(dest_p))
                    immediate_reclaimed_bytes += sz
                    processed_labels.append(f"{name} ➔ {dest_p} 안전 이사")
                    restore_ops.append({
                        "op": "MOVE",
                        "name": src_p.name,
                        "fromPath": str(src_p),
                        "toPath": str(dest_p),
                        "sizeBytes": sz,
                        "rolledBack": False,
                    })
                    continue
                except Exception as exc:
                    errors.append(f"{name} 이사 실패: {exc}")
                    continue

        # 일반 캐시 및 선택 폴더 ➔ Windows 기본 [휴지통] 안전 이동
        target_paths = [Path(p) for p in (it.get("paths") or ([it["path"]] if it.get("path") else [])) if p]
        item_reclaimed = 0
        for tp in target_paths:
            if not tp.exists():
                continue
            # 절대 금지 시스템 루트 가드 (Python 서버측 2중 하드코딩 방어)
            tp_low = str(tp.resolve()).lower().rstrip("\\")
            if tp_low in (
                "c:", "d:", str(SYSTEMROOT).lower(), r"c:\program files", r"c:\program files (x86)",
                str(USERPROFILE).lower(), str(safe_ops.known_folder("desktop")).lower(),
                str(safe_ops.known_folder("documents")).lower(), str(safe_ops.known_folder("downloads")).lower(),
            ):
                # 사용자 최상위 폴더 자체는 절대 삭제 금지 — Downloads 등 폴더 자체가 선택된 경우 내부 파일이 아닌 안전 거절
                if cat != "SAFE_CACHE":
                    errors.append(f"시스템/기본 폴더 자체({tp.name})는 안전을 위해 삭제하지 않습니다. 개별 하위 폴더를 선택하거나 D: 이사를 이용해 주세요.")
                    continue
            if cat == "SAFE_CACHE" and tp.is_dir():
                r_c = _recycle_dir_contents_skip_locked(tp)
                item_reclaimed += int(r_c.get("reclaimedBytes") or 0)
            else:
                sz = int(it.get("sizeBytes") or 0)
                r_rb = _send_path_safe_recycle(tp)
                if r_rb.get("ok"):
                    item_reclaimed += sz
                    restore_ops.append({
                        "op": "PHOTO_RECYCLE",
                        "name": tp.name,
                        "fromPath": str(tp),
                        "toPath": r_rb.get("recycleDataFile") or "WINDOWS_RECYCLE_BIN",
                        "recycleMetaFile": r_rb.get("recycleMetaFile", ""),
                        "sizeBytes": sz,
                        "rolledBack": False,
                    })
                else:
                    errors.append(f"{tp.name}: {r_rb.get('error') or '사용 중'}")
        if item_reclaimed > 0:
            moved_to_recycle_bytes += item_reclaimed
            processed_labels.append(f"{name} ({round(item_reclaimed / (1024 * 1024), 1)}MB 휴지통 이동)")

    restore_id = ""
    if restore_ops:
        try:
            pt = safe_ops.add_restore_point(
                summary=f"대용량 공간 정리 ({len(processed_labels)}건)",
                user_prompt="C드라이브 공간 정리",
                preview=", ".join(processed_labels[:4]),
                operations=restore_ops,
                user_approval_text=user_approval_text,
            )
            restore_id = str(pt.get("restoreId") or "")
        except Exception:
            pass

    after_du = shutil.disk_usage("C:\\") if sys.platform == "win32" else None
    after_free_gb = round(after_du.free / (1024 ** 3), 1) if after_du else before_free_gb
    recycle_mb = round(moved_to_recycle_bytes / (1024 * 1024), 1)
    immediate_mb = round(immediate_reclaimed_bytes / (1024 * 1024), 1)
    projected_after_empty_gb = round(after_free_gb + (moved_to_recycle_bytes / (1024 ** 3)), 1)

    report_lines = [
        f"✅ **대용량 공간 정리 완료 ({len(processed_labels)}개 항목 처리)**",
    ]
    if immediate_mb > 0:
        report_lines.append(f"• **즉시 확보된 C: 실물 공간**: **+{round(immediate_mb/1024, 2)} GB** (현재 C: 여유 `{before_free_gb} GB` ➔ **`{after_free_gb} GB`**)")
    if recycle_mb > 0:
        report_lines.append(
            f"• **Windows [휴지통] 안전 이동**: **{round(recycle_mb/1024, 2)} GB ({recycle_mb} MB)**\n"
            f"  📊 **현재 C: 실물 여유 `{after_free_gb} GB` ➔ 휴지통 비우기 후 최종 확보 여유 `{projected_after_empty_gb} GB`**\n"
            f"  *(안전을 위해 먼저 휴지통에 보관했습니다. 이상 없으면 채팅창에 **\"휴지통 비워줘\"**를 입력해 용량을 확정해 주세요!)*"
        )
    if skipped_excluded:
        report_lines.append(f"• **유저 지시로 보존(제외)됨**: {', '.join(skipped_excluded[:8])}")
    if errors:
        report_lines.append(f"• **일부 건너뜀(사용 중/보호됨)**: {'; '.join(errors[:4])}")

    return {
        "ok": True,
        "processedCount": len(processed_labels),
        "processedLabels": processed_labels,
        "excludedLabels": skipped_excluded,
        "movedToRecycleMb": recycle_mb,
        "immediateReclaimedMb": immediate_mb,
        "beforeFreeGb": before_free_gb,
        "currentFreeGb": after_free_gb,
        "projectedFreeAfterEmptyGb": projected_after_empty_gb,
        "restoreId": restore_id,
        "errors": errors,
        "reportKo": "\n".join(report_lines),
    }


# ---------------------------------------------------------------------------
# 2. [과제 4] 보안모듈 · 애드웨어 사용 이력 기반 스마트 2분류 (security-2tier-scan)
# ---------------------------------------------------------------------------
def scan_security_and_pup_2tier() -> Dict[str, Any]:
    """
    - 그룹 1 (🟢 수면·자동기상 권장): 최근 사용 이력이 있거나 실사용 은행·관공서 필수 보안모듈
    - 그룹 2 (🔴 완전 삭제·적출 권장): 악성 애드웨어(PUP 11종), 웹하드 그리드, 1년+ 장기 미사용 구형 모듈, HP 텔레메트리, Copilot/oCamTask
    """
    import plugin_ghosti_care_suite as care_suite

    sleep_recommend: List[Dict[str, Any]] = []
    delete_recommend: List[Dict[str, Any]] = []
    running_procs = {str(p.get("name") or "").lower(): p for p in care_suite._iter_windows_processes_stdlib()}

    # 1) 알려진 악성 PUP / 백그라운드 도둑 실측 스캔 (표준 권한에서도 WinError 5 없이 100% 조회되도록 schtasks /query 사용)
    active_task_names_low: set[str] = set()
    if sys.platform == "win32":
        try:
            r_st = subprocess.run(
                ["schtasks", "/query", "/fo", "CSV", "/nh"],
                capture_output=True,
                text=True,
                encoding="oem",
                errors="ignore",
                timeout=3.0,
                creationflags=CREATE_NO_WINDOW,
            )
            for ln in (r_st.stdout or "").splitlines():
                parts = [p.strip('"') for p in ln.split('","')]
                if len(parts) >= 3 and parts[0].startswith("\\"):
                    t_status = parts[2].lower()
                    if "disabled" not in t_status and "사용 안 함" not in t_status:
                        active_task_names_low.add(parts[0].lstrip("\\").lower())
        except Exception:
            pass

    tasks_root = SYSTEMROOT / "System32" / "Tasks"
    for pup_id, meta in KNOWN_PUP_CATALOG.items():
        found_reasons: List[str] = []
        est_ram = 0.0
        for ex in meta.get("exes", []):
            if ex.lower() in running_procs:
                found_reasons.append(f"실행중({ex})")
                est_ram += float(running_procs[ex.lower()].get("memoryMb") or 15.0)
        for tn in meta.get("tasks", []):
            tn_clean = tn.lstrip("\\").lower()
            if tn_clean in active_task_names_low:
                found_reasons.append(f"스케줄러({tn})")
            else:
                try:
                    t_p = tasks_root / tn
                    if t_p.exists():
                        txt = t_p.read_text(encoding="utf-16", errors="ignore")
                        if "<Enabled>false</Enabled>" not in txt and "<Enabled>False</Enabled>" not in txt:
                            found_reasons.append(f"스케줄러({tn})")
                except OSError:
                    pass
        for pp in meta.get("paths", []):
            try:
                if Path(pp).exists():
                    found_reasons.append("실물파일존재")
                    break
            except OSError:
                continue
        if found_reasons:
            delete_recommend.append({
                "id": pup_id,
                "name": meta["displayName"],
                "cat": meta["category"],
                "reason": " · ".join(found_reasons[:3]),
                "estimatedRamMb": round(est_ram, 1),
                "actionType": "PUP_ERADICATE",
            })

    # 2) 설치된 프로그램 중 보안모듈 & 그리드/애드웨어 2분류 (설치일·최근 수정일 기반 1년 미사용 판별)
    apps_res = care_suite.list_installed_programs(limit=150)
    now_dt = datetime.datetime.now()
    for ap in (apps_res.get("items") or []):
        nm = str(ap.get("name") or "")
        pub = str(ap.get("publisher") or "")
        nm_low = nm.lower()
        comb_low = f"{nm_low} {pub.lower()}"
        if _is_hardware_driver_or_core(nm, pub):
            continue

        inst_dt_str = str(ap.get("installDate") or "")
        age_days = 0
        if re.match(r"^\d{4}-\d{2}-\d{2}$", inst_dt_str):
            try:
                dt = datetime.datetime.strptime(inst_dt_str, "%Y-%m-%d")
                age_days = max(0, (now_dt - dt).days)
            except Exception:
                age_days = 0

        if any(tok in comb_low for tok in GRID_AND_ADWARE_APP_TOKENS):
            delete_recommend.append({
                "id": f"app_{re.sub(r'[^a-z0-9가-힣]', '_', nm_low)[:28]}",
                "name": nm,
                "cat": "GRID_OR_ADWARE_APP",
                "publisher": pub,
                "sizeMb": float(ap.get("sizeMb") or 0),
                "installDate": inst_dt_str,
                "reason": "애드웨어·그리드·불필요 번들 유틸 (완전 삭제 권장)",
                "actionType": "APP_UNINSTALL",
            })
        elif any(tok in comb_low for tok in WEB_SECURITY_APP_TOKENS):
            is_self_def = any(k in comb_low for k in ("nprotect", "ahnlab safe", "astx", "nossvc"))
            is_stale_old = age_days >= 365 or any(k in comb_low for k in ("miplatform", "iformscan", "inziiform", "ozweblauncher", "ozx", "aps engine", "yettiesoft"))
            if is_self_def or is_stale_old:
                delete_recommend.append({
                    "id": f"sec_{re.sub(r'[^a-z0-9가-힣]', '_', nm_low)[:28]}",
                    "name": nm,
                    "cat": "STALE_OR_SELFDEF_SECURITY",
                    "publisher": pub,
                    "sizeMb": float(ap.get("sizeMb") or 0),
                    "installDate": inst_dt_str,
                    "reason": "자가보호 상주(CPU 과점유) 또는 장기 미사용 구형 모듈 (완전 삭제 권장)" if is_self_def else "장기 미사용·구형 관공서/리포트 모듈 (삭제 권장)",
                    "actionType": "APP_UNINSTALL",
                })
            else:
                sleep_recommend.append({
                    "id": f"sleep_{re.sub(r'[^a-z0-9가-힣]', '_', nm_low)[:28]}",
                    "name": nm,
                    "cat": "ACTIVE_BANK_SECURITY",
                    "publisher": pub,
                    "installDate": inst_dt_str,
                    "reason": "은행·관공서 실사용 모듈 (삭제하지 않고 무삭제 수면 + 접속 시 자동 기상 권장)",
                    "actionType": "SECURITY_SLEEP",
                })

    # 번호 부여
    idx = 1
    unified: List[Dict[str, Any]] = []
    for item in delete_recommend:
        item["no"] = idx
        unified.append(item)
        idx += 1
    for item in sleep_recommend:
        item["no"] = idx
        unified.append(item)
        idx += 1

    return {
        "ok": True,
        "deleteRecommendCount": len(delete_recommend),
        "sleepRecommendCount": len(sleep_recommend),
        "deleteRecommend": delete_recommend,
        "sleepRecommend": sleep_recommend,
        "items": unified,
        "summaryKo": (
            f"🔍 보안모듈·애드웨어 정밀 2분류 완료: "
            f"**🔴 완전 삭제·적출 권장 {len(delete_recommend)}건** · **🟢 무삭제 수면(자동기상) 권장 {len(sleep_recommend)}건**"
        ),
    }


# ---------------------------------------------------------------------------
# 3. [과제 2 + 보완 1] Zero-Trust 헬퍼 기반 2-Pass 배치 언인스톨 & PUP 적출
# ---------------------------------------------------------------------------
def _detect_silent_uninstall_cmd(raw_cmd: str, quiet_cmd: str = "") -> Tuple[str, bool]:
    """(정규화 커맨드, 무소음(Silent) 확정 여부) 반환"""
    import plugin_ghosti_care_suite as care_suite

    if quiet_cmd and quiet_cmd.strip():
        return care_suite._normalize_msi_uninstall_cmd(quiet_cmd.strip()), True
    cmd = (raw_cmd or "").strip()
    if not cmd:
        return "", False
    low = cmd.lower()
    if re.match(r'^"?msiexec(\.exe)?"?\b', cmd, flags=re.IGNORECASE):
        c2 = re.sub(r"(?i)(/\s*i)(\s*\{[0-9a-fA-F\-]+\})", r"/X\2", cmd)
        if "/qn" not in c2.lower() and "/passive" not in c2.lower():
            c2 = f"{c2} /qn /norestart"
        elif "/norestart" not in c2.lower():
            c2 = f"{c2} /norestart"
        return c2, True
    if "unins000.exe" in low or "unins001.exe" in low:
        return f"{cmd} /VERYSILENT /SUPPRESSMSGBOXES /NORESTART", True
    if any(k in low for k in ("/s", "/silent", "/verysilent", "/quiet", "--uninstall -s")):
        return cmd, True
    if re.search(r"\\uninst(all)?\.exe\"?$", low):
        return f"{cmd} /S", True
    return cmd, False


def _find_uninstall_registry_entry(app_query: str) -> Optional[Dict[str, str]]:
    """앱 이름으로 레지스트리 Uninstall 식별자({hive, subkey, displayName, publisher})만 추출 (Zero-Trust)."""
    if sys.platform != "win32" or winreg is None:
        return None
    q_low = (app_query or "").strip().lower()
    if not q_low:
        return None
    roots = [
        ("HKLM", winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        ("HKLM_WOW64", winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        ("HKCU", winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    ]
    for htag, hive, base_k in roots:
        try:
            with winreg.OpenKey(hive, base_k, 0, winreg.KEY_READ) as rk:
                cnt = winreg.QueryInfoKey(rk)[0]
                for i in range(cnt):
                    try:
                        sk_name = winreg.EnumKey(rk, i)
                        with winreg.OpenKey(rk, sk_name, 0, winreg.KEY_READ) as ak:
                            def _qv(n: str) -> str:
                                try:
                                    return str(winreg.QueryValueEx(ak, n)[0] or "").strip()
                                except OSError:
                                    return ""
                            disp = _qv("DisplayName")
                            pub = _qv("Publisher")
                            if not disp or _is_hardware_driver_or_core(disp, pub):
                                continue
                            if q_low == disp.lower() or q_low in disp.lower():
                                return {
                                    "hive": htag,
                                    "subkey": sk_name,
                                    "displayName": disp,
                                    "publisher": pub,
                                    "uninstallString": _qv("UninstallString"),
                                    "quietUninstallString": _qv("QuietUninstallString"),
                                }
                    except OSError:
                        continue
        except OSError:
            continue
    return None


def eradicate_known_pup_by_id(pup_id: str) -> Dict[str, Any]:
    """서명된 KNOWN_PUP_CATALOG ID만으로 프로세스 사살 + 스케줄러/서비스 비활성화 + 실물 파일 안전 적출(휴지통/.disabled_by_ghosti)."""
    meta = KNOWN_PUP_CATALOG.get(pup_id)
    if not meta:
        return {"ok": False, "error": f"UNKNOWN_PUP_ID: {pup_id}"}
    killed: List[str] = []
    disabled_tasks: List[str] = []
    disabled_svcs: List[str] = []
    recycled_paths: List[str] = []

    if sys.platform == "win32":
        for tn in meta.get("tasks", []):
            subprocess.run(["schtasks", "/End", "/TN", f"\\{tn.lstrip(chr(92))}"], capture_output=True, timeout=2.0, creationflags=CREATE_NO_WINDOW)
            r = subprocess.run(["schtasks", "/Change", "/TN", f"\\{tn.lstrip(chr(92))}", "/DISABLE"], capture_output=True, timeout=2.0, creationflags=CREATE_NO_WINDOW)
            if r.returncode == 0:
                disabled_tasks.append(tn)
        for sn in meta.get("services", []):
            subprocess.run(["sc", "config", sn, "start=", "disabled"], capture_output=True, timeout=2.0, creationflags=CREATE_NO_WINDOW)
            r = subprocess.run(["sc", "stop", sn], capture_output=True, timeout=2.5, creationflags=CREATE_NO_WINDOW)
            if r.returncode == 0:
                disabled_svcs.append(sn)
        for ex in meta.get("exes", []):
            rk = subprocess.run(["taskkill", "/F", "/IM", ex, "/T"], capture_output=True, timeout=2.5, creationflags=CREATE_NO_WINDOW)
            if rk.returncode == 0:
                killed.append(ex)
        if killed:
            time.sleep(0.4)
        for pp in meta.get("paths", []):
            p = Path(pp)
            if p.exists():
                rr = _disable_locked_pup_path_safe(p)
                if rr.get("ok"):
                    recycled_paths.append(f"{pp} ({rr.get('method')})")
    return {
        "ok": True,
        "pupId": pup_id,
        "displayName": meta["displayName"],
        "killed": killed,
        "disabledTasks": disabled_tasks,
        "disabledServices": disabled_svcs,
        "recycledPaths": recycled_paths,
    }


def execute_elevated_registry_uninstall_verified(entries: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    [Zero-Trust 최고권한 헬퍼 내부 실행 함수]
    큐에서 받은 {hive, subkey} 식별자로 Windows 레지스트리에서 직접 UninstallString을 재조회·검증한 뒤,
    2-Pass(1차 Silent 고속 배치 ➔ 2차 GUI 확인 필수 앱 1개씩 TopMost 순차, 45초 스킵)로 실행합니다.
    """
    if sys.platform != "win32" or winreg is None:
        return {"ok": False, "results": []}
    hive_map = {
        "HKLM": (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        "HKLM_WOW64": (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        "HKCU": (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    }
    pass1_silent: List[Tuple[str, str]] = []
    pass2_gui: List[Tuple[str, str]] = []

    for ent in entries:
        htag = str(ent.get("hive") or "")
        subk = str(ent.get("subkey") or "")
        if htag not in hive_map or not subk or "\\" in subk or ".." in subk:
            continue
        hive, base_k = hive_map[htag]
        try:
            with winreg.OpenKey(hive, f"{base_k}\\{subk}", 0, winreg.KEY_READ) as ak:
                def _qv(n: str) -> str:
                    try:
                        return str(winreg.QueryValueEx(ak, n)[0] or "").strip()
                    except OSError:
                        return ""
                disp = _qv("DisplayName")
                pub = _qv("Publisher")
                if not disp or _is_hardware_driver_or_core(disp, pub):
                    continue
                cmd, is_silent = _detect_silent_uninstall_cmd(_qv("UninstallString"), _qv("QuietUninstallString"))
                if not cmd:
                    continue
                if is_silent:
                    pass1_silent.append((disp, cmd))
                else:
                    pass2_gui.append((disp, cmd))
        except OSError:
            continue

    results: List[Dict[str, Any]] = []
    # Pass 1: 무소음 고속 순차 실행 (MsiExec 1618 충돌 방지 위해 순차 1개씩, 최대 18초 대기)
    for disp, cmd in pass1_silent:
        try:
            p = subprocess.Popen(cmd, shell=True, creationflags=CREATE_NO_WINDOW)
            try:
                rc = p.wait(timeout=18.0)
                results.append({"name": disp, "pass": 1, "status": "DONE" if rc == 0 else f"EXIT_{rc}"})
            except subprocess.TimeoutExpired:
                results.append({"name": disp, "pass": 1, "status": "TIMEOUT_SKIPPED"})
        except Exception as exc:
            results.append({"name": disp, "pass": 1, "status": f"ERROR:{exc}"})

    # SYSTEM(Session 0) 헬퍼에서 실행 중일 때는 GUI 확인창이 안 보이므로 Pass 2는 인터랙티브 세션으로 위임
    is_session0_system = os.environ.get("USERNAME", "").upper() == "SYSTEM" or os.environ.get("SESSIONNAME", "").lower() == "services"
    # Pass 2: GUI 확인이 필요한 구형 앱 — 화면 전면 표시, 최대 45초 대기 후 다음으로 스킵
    for disp, cmd in pass2_gui:
        if is_session0_system:
            results.append({"name": disp, "pass": 2, "status": "DEFERRED_TO_INTERACTIVE"})
            continue
        try:
            p = subprocess.Popen(cmd, shell=True)
            try:
                rc = p.wait(timeout=45.0)
                results.append({"name": disp, "pass": 2, "status": "DONE" if rc == 0 else f"EXIT_{rc}"})
            except subprocess.TimeoutExpired:
                results.append({"name": disp, "pass": 2, "status": "MANUAL_CONFIRM_TIMEOUT_SKIPPED"})
        except Exception as exc:
            results.append({"name": disp, "pass": 2, "status": f"ERROR:{exc}"})

    return {"ok": True, "results": results}


def execute_batch_deep_uninstall(
    app_names: List[str],
    exclude_names: Optional[List[str]] = None,
    pup_ids: Optional[List[str]] = None,
    user_approval_text: str = "다중 취사선택 일괄 제거 승인",
) -> Dict[str, Any]:
    """
    [과제 2 + 보완 1 완결]
    유저가 선택한 N개 앱/PUP에서 exclude_names를 제외하고:
    1) 서명된 악성 PUP는 즉시 사살·스케줄러 비활성·휴지통/.disabled_by_ghosti 적출
    2) 일반 설치 앱은 Zero-Trust 레지스트리 식별자만 모아 GhostiSecurityCareHelper(UAC 0회) 2-Pass 배치 실행
    3) 각 앱의 잔여 AppData 캐시 폴더를 Windows 기본 [휴지통]으로 안전 이동
    """
    import plugin_ghosti_care_suite as care_suite
    import ghosti_safe_ops as safe_ops

    exc_lows = [str(x).strip().lower() for x in (exclude_names or []) if str(x).strip()]
    excluded_labels: List[str] = []
    target_apps: List[str] = []
    target_pups: List[str] = list(pup_ids or [])

    for raw_name in (app_names or []):
        nm = str(raw_name or "").strip()
        if not nm:
            continue
        nm_low = nm.lower()
        if any(ex in nm_low or nm_low in ex for ex in exc_lows):
            excluded_labels.append(nm)
            continue
        if nm in KNOWN_PUP_CATALOG:
            if nm not in target_pups:
                target_pups.append(nm)
            continue
        if _is_hardware_driver_or_core(nm):
            excluded_labels.append(f"{nm} (필수 드라이버·시스템 자동 보호)")
            continue
        target_apps.append(nm)

    # 1) PUP 적출 (관리자 헬퍼 필요 시 헬퍼 큐로 함께 전달)
    pup_results: List[Dict[str, Any]] = []
    valid_pups = [pid for pid in target_pups if pid in KNOWN_PUP_CATALOG and not any(ex in pid.lower() or ex in KNOWN_PUP_CATALOG[pid]["displayName"].lower() for ex in exc_lows)]
    if valid_pups:
        if care_suite.is_running_as_admin():
            for pid in valid_pups:
                pup_results.append(eradicate_known_pup_by_id(pid))
        else:
            q_res = care_suite.execute_elevated_agent_care_queue("eradicate_pups", {"pupIds": valid_pups})
            if q_res.get("ok") and q_res.get("pupResults"):
                pup_results = list(q_res.get("pupResults") or [])
            else:
                for pid in valid_pups:
                    pup_results.append(eradicate_known_pup_by_id(pid))

    # 2) 설치 앱 Zero-Trust 레지스트리 식별자 수집 + 2-Pass 배치 언인스톨 (HKCU는 현재 유저 세션에서 직접 실행)
    reg_entries: List[Dict[str, str]] = []
    hkcu_entries: List[Dict[str, str]] = []
    for app_q in target_apps:
        ent = _find_uninstall_registry_entry(app_q)
        if ent:
            item_e = {"hive": ent["hive"], "subkey": ent["subkey"], "displayName": ent["displayName"]}
            if ent["hive"] == "HKCU":
                hkcu_entries.append(item_e)
            else:
                reg_entries.append(item_e)

    uninstall_results: List[Dict[str, Any]] = []
    if hkcu_entries:
        u_hkcu = execute_elevated_registry_uninstall_verified(hkcu_entries)
        uninstall_results.extend(list(u_hkcu.get("results") or []))

    if reg_entries:
        if care_suite.is_running_as_admin():
            u_res = execute_elevated_registry_uninstall_verified(reg_entries)
            uninstall_results.extend(list(u_res.get("results") or []))
        else:
            q_u = care_suite.execute_elevated_agent_care_queue("batch_uninstall", {"entries": reg_entries})
            if q_u.get("ok") and isinstance(q_u.get("uninstallResults"), list):
                for ur in list(q_u.get("uninstallResults") or []):
                    if ur.get("status") == "DEFERRED_TO_INTERACTIVE":
                        nm_d = str(ur.get("name") or "")
                        r_fb = care_suite.execute_deep_uninstall_target(nm_d, invoke_official_uninstaller=True, user_approval_text=user_approval_text)
                        uninstall_results.append({"name": nm_d, "pass": 2, "status": "DONE" if r_fb.get("ok") else "SKIPPED"})
                    else:
                        uninstall_results.append(ur)
            else:
                # 헬퍼 미등록 시 기존 안전 폴백 (1개씩)
                for app_q in target_apps[:8]:
                    r_fb = care_suite.execute_deep_uninstall_target(app_q, invoke_official_uninstaller=True, user_approval_text=user_approval_text)
                    uninstall_results.append({"name": app_q, "pass": 2, "status": "DONE" if r_fb.get("ok") else "SKIPPED"})

    # 3) 제거한 앱들의 잔여 캐시 폴더를 Windows 휴지통으로 안전 이동
    reclaimed_bytes = 0
    recycled_folders: List[str] = []
    for app_q in target_apps:
        try:
            sc = care_suite.scan_deep_uninstall_target(app_q)
            for finfo in (sc.get("residualFolders") or []):
                fp = Path(str(finfo.get("path") or ""))
                if fp.exists() and finfo.get("isSafeCacheOrData"):
                    rr = _send_path_safe_recycle(fp)
                    if rr.get("ok"):
                        recycled_folders.append(str(fp))
                        reclaimed_bytes += int(finfo.get("sizeBytes") or 0)
        except Exception:
            continue

    reclaimed_mb = round(reclaimed_bytes / (1024 * 1024), 1)
    try:
        safe_ops.add_restore_point(
            summary=f"다중 프로그램·애드웨어 일괄 정리 ({len(uninstall_results) + len(pup_results)}건)",
            user_prompt=f"배치 제거 ({len(target_apps)}앱 + {len(valid_pups)}애드웨어)",
            preview=", ".join([r.get("name", "") for r in uninstall_results[:5]] + [p.get("displayName", "") for p in pup_results[:3]]),
            operations=[{"op": "ADWARE_CLEAN_CHECK", "name": "다중 취사선택 일괄 정리 완료", "rolledBack": False}],
            user_approval_text=user_approval_text,
        )
    except Exception:
        pass

    lines = [
        f"🔥 **[다중 취사선택 일괄 제거 완료 보고]**",
        f"• **제거 실행된 프로그램**: **{len(uninstall_results)}건** ({', '.join(r.get('name', '') for r in uninstall_results[:6]) or '없음'})",
    ]
    if pup_results:
        lines.append(f"• **적출된 악성 애드웨어·스케줄러**: **{len(pup_results)}건** ({', '.join(p.get('displayName', '') for p in pup_results[:5])})")
    if recycled_folders:
        lines.append(f"• **Windows [휴지통] 이동 잔여 캐시 폴더**: **{len(recycled_folders)}곳 ({reclaimed_mb} MB)**")
    if excluded_labels:
        lines.append(f"• **🟢 보존 확정(제외됨)**: {', '.join(excluded_labels[:8])}")
    lines.append("• 지워진 잔여 폴더는 모두 바탕화면 **[휴지통]**에 보관되어 있으며, 이상 없으면 **\"휴지통 비워줘\"**로 최종 용량을 확보하실 수 있어요!")

    return {
        "ok": True,
        "uninstalledCount": len(uninstall_results),
        "uninstallResults": uninstall_results,
        "pupEradicatedCount": len(pup_results),
        "pupResults": pup_results,
        "recycledFolderCount": len(recycled_folders),
        "reclaimedMb": reclaimed_mb,
        "excludedLabels": excluded_labels,
        "reportKo": "\n".join(lines),
    }


# ---------------------------------------------------------------------------
# 4. [과제 5] 바탕화면 상세 구성 분석 & Windows 시스템 아이콘(WD 등) 안전 진단·숨김
# ---------------------------------------------------------------------------
_SYSTEM_DESKTOP_ICON_GUIDS: Dict[str, Tuple[str, str]] = {
    "user_files": ("{59031a47-3f72-44a7-89c5-5595fe6b30ee}", f"내 사용자 계정 폴더 ({USERPROFILE.name})"),
    "this_pc": ("{20D04FE0-3AEA-1069-A2D8-08002B30309D}", "내 PC"),
    "network": ("{F02C1A0D-BE21-4350-88B0-7367FC96EF3C}", "네트워크"),
    "control_panel": ("{5399E694-6CE5-4D6C-8FCE-1D8870FDCBA0}", "제어판"),
}

_PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".bmp", ".jfif"}
_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".wmv", ".webm", ".m4v"}
_DOC_EXTS = {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".hwp", ".hwpx", ".txt", ".csv"}


def _summarize_folder_composition(folder: Path, max_files: int = 3000) -> Dict[str, Any]:
    photos = videos = docs = others = 0
    total_b = 0
    cnt = 0
    stack = [folder]
    while stack and cnt < max_files:
        cur = stack.pop()
        try:
            with os.scandir(cur) as it:
                for e in it:
                    if cnt >= max_files:
                        break
                    try:
                        if e.is_symlink():
                            continue
                        if e.is_file(follow_symlinks=False):
                            ext = Path(e.name).suffix.lower()
                            total_b += int(e.stat(follow_symlinks=False).st_size)
                            cnt += 1
                            if ext in _PHOTO_EXTS:
                                photos += 1
                            elif ext in _VIDEO_EXTS:
                                videos += 1
                            elif ext in _DOC_EXTS:
                                docs += 1
                            else:
                                others += 1
                        elif e.is_dir(follow_symlinks=False):
                            stack.append(Path(e.path))
                    except OSError:
                        continue
        except OSError:
            continue
    parts: List[str] = []
    if photos:
        parts.append(f"사진 {photos}장")
    if videos:
        parts.append(f"영상 {videos}개")
    if docs:
        parts.append(f"문서 {docs}건")
    if others:
        parts.append(f"기타 {others}건")
    return {
        "totalBytes": total_b,
        "sizeMb": round(total_b / (1024 * 1024), 2),
        "fileCount": cnt,
        "compositionKo": " + ".join(parts) if parts else "빈 폴더",
    }


def diagnose_system_desktop_icons() -> List[Dict[str, Any]]:
    """바탕화면에 표시 중인 특수 시스템 아이콘(사용자 폴더 WD/chiuk/USER, 네트워크, 제어판 등) 상태 실측."""
    out: List[Dict[str, Any]] = []
    if sys.platform != "win32" or winreg is None:
        return out
    reg_path = r"Software\Microsoft\Windows\CurrentVersion\Explorer\HideDesktopIcons\NewStartPanel"
    for icon_id, (guid, label) in _SYSTEM_DESKTOP_ICON_GUIDS.items():
        hidden_val = 1  # 기본은 숨김(1), 0이면 바탕화면에 표시 중
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, reg_path, 0, winreg.KEY_READ) as k:
                v, _ = winreg.QueryValueEx(k, guid)
                hidden_val = int(v)
        except OSError:
            hidden_val = 1 if icon_id != "this_pc" else 1
        out.append({
            "iconId": icon_id,
            "guid": guid,
            "label": label,
            "isVisibleOnDesktop": hidden_val == 0,
            "safeExplanationKo": (
                f"지우면 큰일 나는 내 Windows 계정 본체 폴더({USERPROFILE.name})입니다! 파일을 삭제하지 않고 바탕화면에서만 깔끔하게 숨길 수 있어요."
                if icon_id == "user_files"
                else f"Windows 기본 시스템 아이콘({label})입니다. 파일 손실 없이 아이콘만 보이게/숨기게 전환할 수 있어요."
            ),
        })
    return out


def toggle_system_desktop_icon(icon_id: str = "user_files", hide: bool = True) -> Dict[str, Any]:
    """WD/사용자 폴더·네트워크·제어판 등 바탕화면 시스템 아이콘만 HideDesktopIcons 레지스트리로 안전 숨김/표시."""
    if sys.platform != "win32" or winreg is None:
        return {"ok": False, "error": "WINDOWS_ONLY"}
    entry = _SYSTEM_DESKTOP_ICON_GUIDS.get(icon_id)
    if not entry:
        return {"ok": False, "error": f"UNKNOWN_ICON_ID: {icon_id}"}
    guid, label = entry
    reg_path = r"Software\Microsoft\Windows\CurrentVersion\Explorer\HideDesktopIcons\NewStartPanel"
    try:
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, reg_path) as k:
            winreg.SetValueEx(k, guid, 0, winreg.REG_DWORD, 1 if hide else 0)
        try:
            ctypes.windll.shell32.SHChangeNotify(0x08000000, 0x0000, None, None)
        except Exception:
            pass
        msg = (
            f"✨ 바탕화면에 떠 있던 **[{label}]** 시스템 아이콘을 파일 손실 0%로 깔끔하게 숨겼습니다! (언제든 다시 보이게 복원할 수 있어요)"
            if hide
            else f"🔄 바탕화면에 **[{label}]** 시스템 아이콘을 다시 보이도록 복원했습니다!"
        )
        return {"ok": True, "iconId": icon_id, "label": label, "hidden": hide, "message": msg}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def inspect_desktop_and_folder_detail(target_path: str = "Desktop") -> Dict[str, Any]:
    """
    [과제 5] 내 바탕화면 + 공용 바탕화면(또는 지정 폴더) 전수 분석:
    폴더 내부 사진·영상·문서 구성 요약, 파일/바로가기 크기·수정일, 시스템 특수 아이콘 진단까지 1회 반환.
    """
    import ghosti_safe_ops as safe_ops

    roots: List[Tuple[str, Path]] = []
    tp = (target_path or "Desktop").strip()
    if tp.lower() in ("desktop", "바탕화면"):
        roots.append(("내 바탕화면", safe_ops.known_folder("desktop")))
        pub_desk = Path(r"C:\Users\Public\Desktop")
        if pub_desk.is_dir():
            roots.append(("공용 바탕화면", pub_desk))
    elif tp.lower() in ("downloads", "다운로드"):
        roots.append(("다운로드", safe_ops.known_folder("downloads")))
    else:
        p_custom = Path(tp)
        if p_custom.is_dir():
            roots.append((p_custom.name, p_custom))

    items: List[Dict[str, Any]] = []
    idx = 1
    for scope_lbl, rdir in roots:
        if not rdir.is_dir():
            continue
        try:
            for e in sorted(rdir.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
                if e.name.lower() == "desktop.ini" or e.name.startswith("~$"):
                    continue
                try:
                    st = e.stat()
                    mod_dt = datetime.datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d")
                    if e.is_dir():
                        comp = _summarize_folder_composition(e, max_files=2000)
                        items.append({
                            "no": idx,
                            "id": f"desk_{idx}_{re.sub(r'[^a-z0-9가-힣]', '_', e.name.lower())[:20]}",
                            "name": e.name,
                            "fullPath": str(e),
                            "scope": scope_lbl,
                            "kind": "FOLDER",
                            "sizeBytes": comp["totalBytes"],
                            "sizeMb": comp["sizeMb"],
                            "compositionKo": comp["compositionKo"],
                            "modifiedAt": mod_dt,
                        })
                    else:
                        ext = e.suffix.lower()
                        kind = "SHORTCUT" if ext in (".lnk", ".url") else "FILE"
                        items.append({
                            "no": idx,
                            "id": f"desk_{idx}_{re.sub(r'[^a-z0-9가-힣]', '_', e.name.lower())[:20]}",
                            "name": e.name,
                            "fullPath": str(e),
                            "scope": scope_lbl,
                            "kind": kind,
                            "sizeBytes": int(st.st_size),
                            "sizeMb": round(st.st_size / (1024 * 1024), 2),
                            "compositionKo": "바로가기 아이콘" if kind == "SHORTCUT" else f"{ext.lstrip('.').upper() or '파일'}",
                            "modifiedAt": mod_dt,
                        })
                    idx += 1
                except OSError:
                    continue
        except OSError:
            continue

    items.sort(key=lambda x: (-float(x.get("sizeMb") or 0), x.get("kind") != "FOLDER"))
    for i, it in enumerate(items, 1):
        it["no"] = i

    sys_icons = diagnose_system_desktop_icons() if tp.lower() in ("desktop", "바탕화면") else []
    visible_sys_icons = [ic for ic in sys_icons if ic["isVisibleOnDesktop"]]
    total_mb = round(sum(float(x.get("sizeMb") or 0) for x in items), 1)

    return {
        "ok": True,
        "targetLabel": "바탕화면" if tp.lower() in ("desktop", "바탕화면") else tp,
        "count": len(items),
        "totalMb": total_mb,
        "items": items[:60],
        "systemIcons": sys_icons,
        "visibleSystemIcons": visible_sys_icons,
    }


def execute_desktop_batch_action(
    recycle_paths: Optional[List[str]] = None,
    move_paths: Optional[List[str]] = None,
    move_destination_drive: str = "D:",
    hide_system_icons: Optional[List[str]] = None,
    user_approval_text: str = "바탕화면 선택 항목 정리 승인",
) -> Dict[str, Any]:
    """바탕화면/폴더 선택 항목에 대해 [휴지통 이동] + [D: 안전 이사] + [시스템 아이콘 안전 숨김]을 한 번에 처리."""
    import ghosti_safe_ops as safe_ops

    recycled: List[str] = []
    moved: List[str] = []
    hidden_icons: List[str] = []
    restore_ops: List[Dict[str, Any]] = []
    reclaimed_bytes = 0

    for raw_p in (recycle_paths or []):
        p = Path(str(raw_p or ""))
        if not p.exists():
            continue
        p_low = str(p.resolve()).lower().rstrip("\\")
        if p_low in (str(USERPROFILE).lower(), str(safe_ops.known_folder("desktop")).lower(), str(safe_ops.known_folder("documents")).lower(), str(SYSTEMROOT).lower()):
            continue
        sz, _, _ = _fast_dir_size_bytes(p, max_files=1500)
        r = _send_path_safe_recycle(p)
        if r.get("ok"):
            recycled.append(p.name)
            reclaimed_bytes += sz
            restore_ops.append({
                "op": "PHOTO_RECYCLE",
                "name": p.name,
                "fromPath": str(p),
                "toPath": r.get("recycleDataFile") or "WINDOWS_RECYCLE_BIN",
                "recycleMetaFile": r.get("recycleMetaFile", ""),
                "sizeBytes": sz,
                "rolledBack": False,
            })

    dest_drv = (move_destination_drive or "D:").strip().rstrip("\\/").upper()
    if len(dest_drv) == 1:
        dest_drv += ":"
    if move_paths and Path(f"{dest_drv}\\").exists():
        vault = Path(f"{dest_drv}\\귀신비서_보관함")
        vault.mkdir(parents=True, exist_ok=True)
        for raw_p in move_paths:
            p = Path(str(raw_p or ""))
            if not p.exists():
                continue
            sz, _, _ = _fast_dir_size_bytes(p, max_files=1500)
            dest = safe_ops.unique_target(vault / p.name)
            try:
                shutil.move(str(p), str(dest))
                moved.append(f"{p.name} ➔ {dest}")
                restore_ops.append({
                    "op": "MOVE",
                    "name": p.name,
                    "fromPath": str(p),
                    "toPath": str(dest),
                    "sizeBytes": sz,
                    "rolledBack": False,
                })
            except Exception:
                continue

    for icon_id in (hide_system_icons or []):
        r_ic = toggle_system_desktop_icon(str(icon_id), hide=True)
        if r_ic.get("ok"):
            hidden_icons.append(str(r_ic.get("label") or icon_id))

    restore_id = ""
    if restore_ops:
        try:
            pt = safe_ops.add_restore_point(
                summary=f"바탕화면 취사선택 정리 ({len(recycled)}건 휴지통 · {len(moved)}건 안전이사)",
                user_prompt="바탕화면 선택 정리",
                preview=", ".join(recycled[:4] + moved[:2]),
                operations=restore_ops,
                user_approval_text=user_approval_text,
            )
            restore_id = str(pt.get("restoreId") or "")
        except Exception:
            pass

    lines = ["✅ **바탕화면 선택 항목 정리가 완료되었습니다!**"]
    if recycled:
        lines.append(f"• **Windows [휴지통] 이동 ({len(recycled)}건, {round(reclaimed_bytes / (1024*1024), 1)}MB)**: {', '.join(recycled[:8])}")
    if moved:
        lines.append(f"• **{dest_drv} 안전 이사 ({len(moved)}건)**: {', '.join(moved[:5])}")
    if hidden_icons:
        lines.append(f"• **시스템 아이콘 안전 숨김**: {', '.join(hidden_icons)}")
    if restore_id:
        lines.append(f"• **[복원 기록 {restore_id}]**에 안전하게 기록되어 언제든 1초 만에 원래대로 되돌릴 수 있어요!")

    return {
        "ok": True,
        "recycled": recycled,
        "moved": moved,
        "hiddenIcons": hidden_icons,
        "reclaimedMb": round(reclaimed_bytes / (1024 * 1024), 1),
        "restoreId": restore_id,
        "reportKo": "\n".join(lines),
    }


# ---------------------------------------------------------------------------
# 5. [보완 6] 데스크톱 고성능 전원 부스터 & 구버전 데몬 잔재 자동 정화
# ---------------------------------------------------------------------------
def boost_desktop_power_plan() -> Dict[str, Any]:
    desk = is_pure_desktop_pc()
    if not desk["isDesktop"]:
        return {
            "ok": False,
            "isDesktop": False,
            "message": "노트북(배터리 장착 기기)이므로 배터리 보호를 위해 고성능 강제 전환을 건너뛰었습니다.",
        }
    r = _run_elevated_powercfg_action("power_high")
    return {
        "ok": bool(r.get("ok")),
        "isDesktop": True,
        "message": (
            "⚡ 데스크톱 PC 전원 옵션을 **'고성능'**으로 즉시 전환해 CPU 속도 저하를 해제했습니다!"
            if r.get("ok")
            else "⚠️ 전원 옵션 변경에 관리자 권한 확인이 필요합니다."
        ),
    }


def cleanup_legacy_duplicate_merlin_daemons() -> Dict[str, Any]:
    """
    [기둥 5: Z-코어 자체 정화 — 현역 SenseTalk_Engine(28888) 절대 보호]
    1) 구버전 Startup\\MerlinSeqPaste.vbs 및 HKCU\\Run\\MerlinSeqPaste 제거
    2) SenseTalk_Engine.exe는 정식 현역 엔진(포트 28888 단독 구동)이므로 자동실행 레지스트리를 절대 건드리지 않으며,
       실행 중인 프로세스가 2개 이상 중복 떠 있을 때만 가장 최신 PID 1개는 보존하고 초과 중복 PID만 정리합니다.
    """
    cleaned: List[str] = []
    if sys.platform != "win32":
        return {"ok": True, "cleaned": cleaned}
    try:
        old_vbs = APPDATA / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup" / "MerlinSeqPaste.vbs"
        if old_vbs.exists():
            r = _send_path_safe_recycle(old_vbs)
            if r.get("ok"):
                cleaned.append("Startup\\MerlinSeqPaste.vbs (휴지통 이동)")
    except Exception:
        pass
    if winreg is not None:
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_READ | winreg.KEY_SET_VALUE) as rk:
                try:
                    val_data, _ = winreg.QueryValueEx(rk, "MerlinSeqPaste")
                    if val_data:
                        winreg.DeleteValue(rk, "MerlinSeqPaste")
                        cleaned.append("HKCU\\Run\\MerlinSeqPaste 구버전 자동실행 제거")
                except OSError:
                    pass
        except Exception:
            pass
    try:
        ps_dup = (
            "$procs = @(Get-Process -Name 'SenseTalk_Engine' -ErrorAction SilentlyContinue | Sort-Object StartTime -Descending); "
            "if ($procs.Count -gt 1) { $old = $procs | Select-Object -Skip 1; foreach ($p in $old) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue; Write-Output $p.Id } }"
        )
        r_dup = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_dup],
            capture_output=True,
            text=True,
            timeout=4.0,
            creationflags=CREATE_NO_WINDOW,
        )
        killed_pids = [ln.strip() for ln in (r_dup.stdout or "").splitlines() if ln.strip().isdigit()]
        if killed_pids:
            cleaned.append(f"중복 실행된 초과 SenseTalk_Engine.exe 정리 ({len(killed_pids)}개 종료 · 최신 현역 1개 유지)")
    except Exception:
        pass
    return {"ok": True, "cleaned": cleaned}


# ---------------------------------------------------------------------------
# 5-B. [2차 고도화] 미등록 신종 쥐새끼 전수 수색 (hidden-rats-scan) & 안전 수동전환/차단 (hidden-rats-apply)
# ---------------------------------------------------------------------------
_PROTECTED_SERVICE_OR_TASK_TOKENS = (
    "merlin", "ghosti", "senstalk", "sensebot", "sundream", "tailscale", "openssh", "sshd",
    "windefend", "msmpeng", "securityhealth", "mpssvc", "wscsvc", "spooler", "audiosrv",
    "nvidia", "nvdisplay", "amd", "radeon", "ati", "intel", "realtek", "igfx", "seagull",
    "googledrive", "onedrive", "kakaotalk", "telegram", "antigravity", "nplace", "waybill",
    "studio_", "chrome", "chromoting", "msedgeupdate", "googleupdater", "googleuserpeh",
    "mountpostoffice", "mousewithoutborders",
    "windows defender", "microsoft defender", "v3lite", "ahnlab", "fasoo", "softcamp", "markany",
)


def _is_protected_rat_target(*fields: str) -> bool:
    comb = " ".join(str(x or "") for x in fields).lower()
    return any(tok in comb for tok in _PROTECTED_SERVICE_OR_TASK_TOKENS) or _is_hardware_driver_or_core(comb)


def scan_hidden_background_rats() -> Dict[str, Any]:
    r"""
    [2차 고도화 도구 1: 카탈로그에 없는 미등록 신종 쥐새끼 전수 수색 — 3초 고속 단일 파이프라인]
    1) 비-Microsoft 작업 스케줄러 전체 (\Microsoft\* 제외) + 실행 파일 서명 상태
    2) 실행 중인 비-Windows 서비스 전체 (C:\Windows\System32 순정 OS 제외)
    3) 시작프로그램 (HKCU/HKLM Run + Startup 폴더)
    4) 고메모리 점유 비-Windows 프로세스 TOP 15
    """
    t0 = time.perf_counter()
    if sys.platform != "win32":
        return {"ok": False, "error": "WINDOWS_ONLY", "items": []}

    ps_script = r"""
$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$sigCache = @{}
function Get-QuickSig($rawPath) {
    if (-not $rawPath) { return @{ status='None'; pub='' } }
    $p = $rawPath.Trim().Trim('"')
    if ($p -match '^([A-Za-z]:\\[^"]*?\.(?:exe|dll|vbs|bat|cmd))') { $p = $matches[1] }
    $p = [Environment]::ExpandEnvironmentVariables($p)
    if (-not $p -or -not (Test-Path -LiteralPath $p -PathType Leaf)) { return @{ status='Missing'; pub='' } }
    $key = $p.ToLower()
    if ($sigCache.ContainsKey($key)) { return $sigCache[$key] }
    $s = Get-AuthenticodeSignature -LiteralPath $p
    $pub = ''
    if ($s.SignerCertificate -and $s.SignerCertificate.Subject) {
        if ($s.SignerCertificate.Subject -match 'CN=([^,]+)') { $pub = $matches[1].Trim('"') }
        else { $pub = $s.SignerCertificate.Subject.Substring(0, [math]::Min(48, $s.SignerCertificate.Subject.Length)) }
    }
    $res = @{ status = [string]$s.Status; pub = $pub }
    $sigCache[$key] = $res
    return $res
}

$tasks = @()
Get-ScheduledTask | Where-Object { $_.TaskPath -notlike '\Microsoft*' -and $_.State -ne 'Disabled' } | Select-Object -First 40 | ForEach-Object {
    $act = $_.Actions | Select-Object -First 1
    $exe = [string]$act.Execute
    $arg = [string]$act.Arguments
    $sig = Get-QuickSig $exe
    $tasks += [PSCustomObject]@{
        taskPath = "$($_.TaskPath)$($_.TaskName)"
        taskName = $_.TaskName
        state = $_.State.ToString()
        executePath = $exe
        arguments = $arg
        sigStatus = $sig.status
        publisher = $sig.pub
    }
}

$services = @()
Get-CimInstance Win32_Service | Where-Object {
    $_.State -eq 'Running' -and $_.PathName -and $_.PathName -notmatch 'Windows\\System32|Windows\\servicing|Microsoft\.NET|Windows Defender'
} | Select-Object -First 30 | ForEach-Object {
    $sig = Get-QuickSig $_.PathName
    $services += [PSCustomObject]@{
        serviceName = $_.Name
        displayName = $_.DisplayName
        startMode = $_.StartMode
        binaryPath = $_.PathName
        sigStatus = $sig.status
        publisher = $sig.pub
    }
}

$procs = Get-Process | Group-Object ProcessName | ForEach-Object {
    $memMB = [math]::Round(($_.Group | Measure-Object WorkingSet64 -Sum).Sum / 1MB, 1)
    $pPath = ($_.Group | Where-Object { $_.Path } | Select-Object -First 1).Path
    [PSCustomObject]@{
        name = $_.Name
        count = $_.Count
        memMb = $memMB
        path = [string]$pPath
    }
} | Where-Object { $_.memMb -ge 35 -and $_.path -and $_.path -notmatch 'Windows\\System32|Windows\\Explorer\.EXE' } | Sort-Object memMb -Descending | Select-Object -First 15

[PSCustomObject]@{
    tasks = $tasks
    services = $services
    highMemProcs = $procs
} | ConvertTo-Json -Depth 4 -Compress
"""
    raw_tasks: List[Dict[str, Any]] = []
    raw_services: List[Dict[str, Any]] = []
    raw_procs: List[Dict[str, Any]] = []
    try:
        import base64
        enc_cmd = base64.b64encode(ps_script.encode("utf-16-le")).decode("ascii")
        r = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-EncodedCommand", enc_cmd],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=14.0,
            creationflags=CREATE_NO_WINDOW,
        )
        out_s = (r.stdout or "").strip()
        idx_j = out_s.find("{")
        if idx_j >= 0:
            parsed = json.loads(out_s[idx_j:])
            t_v = parsed.get("tasks") or []
            s_v = parsed.get("services") or []
            p_v = parsed.get("highMemProcs") or []
            raw_tasks = [t_v] if isinstance(t_v, dict) else list(t_v)
            raw_services = [s_v] if isinstance(s_v, dict) else list(s_v)
            raw_procs = [p_v] if isinstance(p_v, dict) else list(p_v)
    except Exception:
        pass

    # 시작프로그램 (HKCU/HKLM Run + Startup 폴더 통합)
    import plugin_ghosti_care_suite as care_suite

    startup_items: List[Dict[str, Any]] = []
    try:
        st_res = care_suite.list_startup_programs()
        for it in (st_res.get("items") or []):
            if it.get("enabled"):
                startup_items.append({
                    "startupId": str(it.get("id") or ""),
                    "name": str(it.get("name") or ""),
                    "command": str(it.get("command") or ""),
                    "location": str(it.get("locationLabel") or ""),
                    "isProtected": bool(it.get("isProtected")) or _is_protected_rat_target(str(it.get("name") or ""), str(it.get("command") or "")),
                    "source": "REGISTRY_RUN",
                })
    except Exception:
        pass

    for folder_lbl, sdir in (
        ("내 계정 시작폴더", APPDATA / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"),
        ("공용 시작폴더", PROGRAMDATA / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"),
    ):
        if sdir.is_dir():
            try:
                for e in sdir.iterdir():
                    if e.name.lower() == "desktop.ini":
                        continue
                    startup_items.append({
                        "startupId": f"STARTUP_FILE::{str(e)}",
                        "name": e.name,
                        "command": str(e),
                        "location": folder_lbl,
                        "isProtected": _is_protected_rat_target(e.name, str(e)),
                        "source": "STARTUP_FOLDER",
                    })
            except Exception:
                pass

    # 50건 이내 통합 항목 리스트 구성 (제미니 정체 해석 & 3단 분류 + 체크박스 바인딩용)
    unified: List[Dict[str, Any]] = []
    idx_no = 1

    for t in raw_tasks:
        tpath = str(t.get("taskPath") or "").strip()
        tname = str(t.get("taskName") or tpath.split("\\")[-1]).strip()
        exe_p = str(t.get("executePath") or "").strip()
        args = str(t.get("arguments") or "").strip()
        sig = str(t.get("sigStatus") or "")
        pub = str(t.get("publisher") or "")
        prot = _is_protected_rat_target(tname, tpath, exe_p, pub)
        if prot:
            continue
        is_suspicious_sig = sig in ("NotSigned", "HashMismatch", "UnknownError") or "lockprofilecookie" in args.lower() or "zum.com" in args.lower()
        unified.append({
            "no": idx_no,
            "id": f"rat_task::{tpath}",
            "ratKind": "SCHEDULED_TASK",
            "targetKey": tpath,
            "name": f"[스케줄러] {tname}",
            "cat": "RAT_TASK_SUSPICIOUS" if is_suspicious_sig else "RAT_TASK",
            "sizeMb": 0,
            "executePath": exe_p,
            "arguments": args[:140],
            "publisher": pub or (f"서명상태:{sig}" if sig else "미확인"),
            "sigStatus": sig,
            "state": str(t.get("state") or ""),
            "recommendedAction": "DISABLE_TASK",
            "defaultSelected": bool(is_suspicious_sig or any(k in f"{tname} {exe_p}".lower() for k in ("cache", "cloudtask", "storage", "febjb", "ocam", "clipdown", "toast", "zsi", "msload", "ngplus", "rayitem", "hp", "whaleupdate", "datasharing"))),
            "isProtected": False,
        })
        idx_no += 1

    for s in raw_services:
        sname = str(s.get("serviceName") or "").strip()
        disp = str(s.get("displayName") or sname).strip()
        bpath = str(s.get("binaryPath") or "").strip()
        smode = str(s.get("startMode") or "")
        sig = str(s.get("sigStatus") or "")
        pub = str(s.get("publisher") or "")
        prot = _is_protected_rat_target(sname, disp, bpath, pub)
        if prot:
            continue
        unified.append({
            "no": idx_no,
            "id": f"rat_svc::{sname}",
            "ratKind": "WINDOWS_SERVICE",
            "targetKey": sname,
            "name": f"[상주 서비스] {disp} ({sname})",
            "cat": "RAT_SERVICE_AUTO" if smode.lower() == "auto" else "RAT_SERVICE",
            "sizeMb": 0,
            "executePath": bpath,
            "arguments": f"시작유형: {smode}",
            "publisher": pub or (f"서명상태:{sig}" if sig else "미확인"),
            "sigStatus": sig,
            "startMode": smode,
            "recommendedAction": "SET_SERVICE_MANUAL",
            "defaultSelected": smode.lower() == "auto",
            "isProtected": False,
        })
        idx_no += 1

    for st in startup_items:
        if st.get("isProtected"):
            continue
        sid = str(st.get("startupId") or "")
        sname = str(st.get("name") or "")
        scmd = str(st.get("command") or "")
        unified.append({
            "no": idx_no,
            "id": f"rat_startup::{sid}",
            "ratKind": "STARTUP_ITEM",
            "targetKey": sid,
            "name": f"[부팅 자동실행] {sname}",
            "cat": "RAT_STARTUP",
            "sizeMb": 0,
            "executePath": scmd[:160],
            "arguments": str(st.get("location") or ""),
            "publisher": str(st.get("source") or ""),
            "recommendedAction": "DISABLE_STARTUP",
            "defaultSelected": any(k in f"{sname} {scmd}".lower() for k in ("edgeautolaunch", "mspcmanager", "magicline", "figma", "ocam", "clipdown", "mybox", "naver")),
            "isProtected": False,
        })
        idx_no += 1

    # 고메모리 비-Windows 프로세스 중 참고용 항목 추가 (크롬/엣지/카톡 등 정상 앱도 메모리 점유 안내)
    high_mem_summary: List[Dict[str, Any]] = []
    for pr in raw_procs:
        pname = str(pr.get("name") or "")
        mem_mb = float(pr.get("memMb") or 0)
        pcnt = int(pr.get("count") or 1)
        ppath = str(pr.get("path") or "")
        high_mem_summary.append({"name": pname, "count": pcnt, "memMb": mem_mb, "path": ppath})
        if any(k in pname.lower() for k in ("copilot", "mspcmanager", "msedgewebview2", "ocam", "cacheconsole", "cloudtask")):
            if not any(pname.lower() in str(u.get("name") or "").lower() for u in unified):
                unified.append({
                    "no": idx_no,
                    "id": f"rat_proc::{pname}",
                    "ratKind": "HIGH_MEM_PROCESS",
                    "targetKey": pname,
                    "name": f"[메모리 과점유] {pname} (x{pcnt})",
                    "cat": "RAT_HIGH_MEM",
                    "sizeMb": mem_mb,
                    "executePath": ppath,
                    "arguments": f"RAM {mem_mb}MB 점유 ({pcnt}개 실행 중)",
                    "publisher": "백그라운드 상주",
                    "recommendedAction": "STOP_PROCESS",
                    "defaultSelected": "copilot" in pname.lower() or "mspcmanager" in pname.lower() or "cache" in pname.lower() or "cloudtask" in pname.lower(),
                    "isProtected": False,
                })
                idx_no += 1

    return {
        "ok": True,
        "count": len(unified),
        "taskCount": sum(1 for x in unified if x["ratKind"] == "SCHEDULED_TASK"),
        "serviceCount": sum(1 for x in unified if x["ratKind"] == "WINDOWS_SERVICE"),
        "startupCount": sum(1 for x in unified if x["ratKind"] == "STARTUP_ITEM"),
        "items": unified[:50],
        "highMemProcs": high_mem_summary[:15],
        "elapsedMs": round((time.perf_counter() - t0) * 1000, 1),
    }


def execute_elevated_hidden_rats_verified(
    disable_tasks: List[str],
    manual_services: List[str],
    disable_hklm_runs: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    [Zero-Trust 최고권한 헬퍼 내부 실행 함수 — 2차 고도화]
    - OS 핵심·하드웨어 드라이버·보호 서비스/스케줄러를 2중 재검증 후 차단/수동전환/HKLM 자동실행 해제 수행
    - 원래 서비스 시작 유형(origStart) 및 원본 명령을 반환하여 [복원 기록] 단일 원자 1초 원복 보장
    """
    if sys.platform != "win32":
        return {"ok": False, "disabledTasks": [], "manualServices": [], "disabledHklmRuns": []}

    import plugin_ghosti_care_suite as care_suite

    done_tasks: List[str] = []
    done_services: List[Dict[str, str]] = []
    done_hklm_runs: List[Dict[str, str]] = []

    for raw_t in (disable_tasks or []):
        tn = str(raw_t or "").strip()
        if not tn or tn.lower().startswith("\\microsoft\\") or _is_protected_rat_target(tn):
            continue
        if not tn.startswith("\\"):
            tn = "\\" + tn
        subprocess.run(["schtasks", "/End", "/TN", tn], capture_output=True, timeout=2.0, creationflags=CREATE_NO_WINDOW)
        r = subprocess.run(["schtasks", "/Change", "/TN", tn, "/DISABLE"], capture_output=True, timeout=2.5, creationflags=CREATE_NO_WINDOW)
        if r.returncode == 0:
            done_tasks.append(tn)

    for raw_s in (manual_services or []):
        sn = str(raw_s or "").strip()
        if not sn or not re.match(r"^[A-Za-z0-9_.\- ]{1,80}$", sn) or _is_protected_rat_target(sn):
            continue
        orig_st = care_suite._query_service_start_type(sn)
        r_cfg = subprocess.run(["sc", "config", sn, "start=", "demand"], capture_output=True, timeout=2.5, creationflags=CREATE_NO_WINDOW)
        subprocess.run(["sc", "stop", sn], capture_output=True, timeout=3.0, creationflags=CREATE_NO_WINDOW)
        if r_cfg.returncode == 0:
            done_services.append({"serviceName": sn, "origStart": orig_st})

    if winreg is not None:
        for st_id in (disable_hklm_runs or []):
            tag, sep, vname = str(st_id or "").strip().partition("::")
            if not sep or not vname or tag not in ("HKLM", "HKLM_WOW64") or _is_protected_rat_target(vname):
                continue
            sub_k = (
                r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run"
                if tag == "HKLM_WOW64"
                else r"Software\Microsoft\Windows\CurrentVersion\Run"
            )
            try:
                with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, sub_k, 0, winreg.KEY_READ | winreg.KEY_SET_VALUE) as rk:
                    cmd_val, _ = winreg.QueryValueEx(rk, vname)
                    if _is_protected_rat_target(vname, str(cmd_val)):
                        continue
                    winreg.DeleteValue(rk, vname)
                    done_hklm_runs.append({"tag": tag, "name": vname, "runSubkey": sub_k, "command": str(cmd_val)})
            except OSError:
                continue

    return {"ok": True, "disabledTasks": done_tasks, "manualServices": done_services, "disabledHklmRuns": done_hklm_runs}


def execute_elevated_hidden_rats_rollback_verified(ops: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    [Zero-Trust 헬퍼 전용 원복기 — 표준 유저 계정(4호기 등)에서도 1초 완벽 원복 보장]
    restore_points.json의 ADWARE_TASK_DISABLE / REGISTRY_RUN_RESTORE(HKLM) 항목을 최고권한으로 복구합니다.
    """
    restored_keys: List[str] = []
    if sys.platform != "win32":
        return {"ok": False, "restoredKeys": restored_keys}
    for op in (ops or []):
        if not isinstance(op, dict):
            continue
        kind = str(op.get("op") or "")
        if kind == "ADWARE_TASK_DISABLE":
            t_kind = str(op.get("targetKind") or "")
            target = str(op.get("target") or "").strip()
            if not target:
                continue
            if t_kind == "service" and re.match(r"^[A-Za-z0-9_.\- ]{1,80}$", target):
                orig = str(op.get("origStart") or "auto").strip().lower()
                if orig not in ("auto", "delayed-auto", "demand"):
                    orig = "auto"
                r1 = subprocess.run(["sc", "config", target, "start=", orig], capture_output=True, timeout=3.0, creationflags=CREATE_NO_WINDOW)
                if r1.returncode == 0:
                    if orig in ("auto", "delayed-auto"):
                        subprocess.run(["sc", "start", target], capture_output=True, timeout=4.0, creationflags=CREATE_NO_WINDOW)
                    restored_keys.append(f"service::{target}")
            elif t_kind == "task":
                tn = target if target.startswith("\\") else "\\" + target
                r2 = subprocess.run(["schtasks", "/Change", "/TN", tn, "/ENABLE"], capture_output=True, timeout=3.0, creationflags=CREATE_NO_WINDOW)
                if r2.returncode == 0:
                    restored_keys.append(f"task::{target.lstrip(chr(92))}")
        elif kind == "REGISTRY_RUN_RESTORE" and winreg is not None:
            tag = str(op.get("tag") or "")
            vname = str(op.get("name") or "").strip()
            sub_k = str(op.get("runSubkey") or r"Software\Microsoft\Windows\CurrentVersion\Run")
            cmd_v = str(op.get("command") or "")
            if tag in ("HKLM", "HKLM_WOW64") and vname and cmd_v and sub_k in (
                r"Software\Microsoft\Windows\CurrentVersion\Run",
                r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run",
            ):
                try:
                    with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, sub_k, 0, winreg.KEY_SET_VALUE) as rk:
                        winreg.SetValueEx(rk, vname, 0, winreg.REG_SZ, cmd_v)
                    restored_keys.append(f"reg::{tag}::{vname}")
                except OSError:
                    continue
    return {"ok": True, "restoredKeys": restored_keys}


def apply_hidden_rats_cleanup(
    disable_tasks: Optional[List[str]] = None,
    manual_services: Optional[List[str]] = None,
    disable_startups: Optional[List[str]] = None,
    stop_processes: Optional[List[str]] = None,
    user_approval_text: str = "숨은 백그라운드 항목 안전 정리 승인",
) -> Dict[str, Any]:
    """
    [2차 고도화 도구 3: 숨은 쥐새끼 안전 차단 · 서비스 수동(Manual) 전환 · 시작프로그램 해제 + [복원 기록] 1초 원복]
    - 앱을 삭제하지 않고 '수동(Manual)' 전환 또는 스케줄러 비활성화 + 모든 변경사항을 restore_points.json에 기록합니다.
    """
    import plugin_ghosti_care_suite as care_suite
    import ghosti_safe_ops as safe_ops

    safe_tasks = [str(x).strip() for x in (disable_tasks or []) if str(x).strip() and not _is_protected_rat_target(str(x))]
    safe_svcs = [str(x).strip() for x in (manual_services or []) if str(x).strip() and not _is_protected_rat_target(str(x))]
    safe_startups = [str(x).strip() for x in (disable_startups or []) if str(x).strip() and not _is_protected_rat_target(str(x))]
    safe_procs = [str(x).strip() for x in (stop_processes or []) if str(x).strip() and not _is_protected_rat_target(str(x))]

    done_tasks: List[str] = []
    done_svcs: List[Dict[str, str]] = []
    done_startups: List[str] = []
    done_procs: List[str] = []
    restore_ops: List[Dict[str, Any]] = []

    hklm_startup_ids = [s for s in safe_startups if s.startswith("HKLM::") or s.startswith("HKLM_WOW64::")]
    other_startup_ids = [s for s in safe_startups if s not in hklm_startup_ids]

    # 1) 스케줄러 비활성화 & 서비스 수동 전환 & HKLM 시작프로그램 해제 (Zero-Trust 최고권한 헬퍼 경유 — 단일 원자 복원 지점 통합)
    if safe_tasks or safe_svcs or hklm_startup_ids:
        if care_suite.is_running_as_admin():
            res_el = execute_elevated_hidden_rats_verified(safe_tasks, safe_svcs, hklm_startup_ids)
        else:
            res_el = care_suite.execute_elevated_agent_care_queue(
                "hidden_rats_apply",
                {"disableTasks": safe_tasks, "manualServices": safe_svcs, "disableHklmRuns": hklm_startup_ids},
            )
            if not res_el.get("ok"):
                # 일반 권한에서도 사용자 본인 소유 스케줄러는 직접 비활성화 시도
                res_el = execute_elevated_hidden_rats_verified(safe_tasks, [], [])
        done_tasks = list(res_el.get("disabledTasks") or [])
        done_svcs = list(res_el.get("manualServices") or [])
        for hr in list(res_el.get("disabledHklmRuns") or []):
            vnm = str(hr.get("name") or "")
            if vnm:
                done_startups.append(vnm)
                restore_ops.append({
                    "op": "REGISTRY_RUN_RESTORE",
                    "name": vnm,
                    "tag": str(hr.get("tag") or "HKLM"),
                    "runSubkey": str(hr.get("runSubkey") or r"Software\Microsoft\Windows\CurrentVersion\Run"),
                    "command": str(hr.get("command") or ""),
                    "fromPath": f"{hr.get('tag')} 자동실행 켜짐",
                    "toPath": "자동실행 꺼짐",
                    "rolledBack": False,
                })

        for tn in done_tasks:
            restore_ops.append({
                "op": "ADWARE_TASK_DISABLE",
                "name": f"스케줄러:{tn.lstrip(chr(92))}",
                "targetKind": "task",
                "target": tn.lstrip("\\"),
                "fromPath": "작업 스케줄러 활성",
                "toPath": "비활성화(Disabled)",
                "rolledBack": False,
            })
        for sv in done_svcs:
            sn = str(sv.get("serviceName") or "")
            ost = str(sv.get("origStart") or "auto")
            restore_ops.append({
                "op": "ADWARE_TASK_DISABLE",
                "name": f"서비스 수동전환:{sn}",
                "targetKind": "service",
                "target": sn,
                "origStart": ost,
                "fromPath": f"자동실행({ost})",
                "toPath": "수동전환(Manual · 앱 켤 때만 작동)",
                "rolledBack": False,
            })

    # 2) 내 계정(HKCU Run + Startup 폴더) 시작프로그램 해제 (별도 복원지점 쪼개짐 없이 단일 restore_ops로 통합!)
    for st_id in other_startup_ids:
        if st_id.startswith("STARTUP_FILE::"):
            fpath = Path(st_id[len("STARTUP_FILE::"):])
            if fpath.exists():
                r_rb = _send_path_safe_recycle(fpath)
                if r_rb.get("ok"):
                    done_startups.append(f"{fpath.name} (시작폴더 ➔ 휴지통)")
                    restore_ops.append({
                        "op": "PHOTO_RECYCLE",
                        "name": fpath.name,
                        "fromPath": str(fpath),
                        "toPath": r_rb.get("recycleDataFile") or "WINDOWS_RECYCLE_BIN",
                        "recycleMetaFile": r_rb.get("recycleMetaFile", ""),
                        "sizeBytes": 0,
                        "rolledBack": False,
                    })
        elif st_id.startswith("HKCU::") and winreg is not None:
            vname = st_id.partition("::")[2].strip()
            sub_k = r"Software\Microsoft\Windows\CurrentVersion\Run"
            if vname and not _is_protected_rat_target(vname):
                try:
                    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, sub_k, 0, winreg.KEY_READ | winreg.KEY_SET_VALUE) as rk:
                        cmd_val, _ = winreg.QueryValueEx(rk, vname)
                        if not _is_protected_rat_target(vname, str(cmd_val)):
                            winreg.DeleteValue(rk, vname)
                            done_startups.append(vname)
                            restore_ops.append({
                                "op": "REGISTRY_RUN_RESTORE",
                                "name": vname,
                                "tag": "HKCU",
                                "runSubkey": sub_k,
                                "command": str(cmd_val),
                                "fromPath": "HKCU 자동실행 켜짐",
                                "toPath": "자동실행 꺼짐",
                                "rolledBack": False,
                            })
                except OSError:
                    pass

    # 3) 과점유 백그라운드 프로세스 안전 종료 (예: copilotapp.exe, MSPCManager 등)
    for pname in safe_procs:
        exe_nm = pname if pname.lower().endswith(".exe") else f"{pname}.exe"
        if _is_protected_rat_target(exe_nm):
            continue
        rk = subprocess.run(["taskkill", "/F", "/IM", exe_nm, "/T"], capture_output=True, timeout=2.5, creationflags=CREATE_NO_WINDOW)
        if rk.returncode == 0:
            done_procs.append(exe_nm)

    restore_id = ""
    if restore_ops:
        try:
            pt = safe_ops.add_restore_point(
                summary=f"숨은 백그라운드 항목 안전 정리 (스케줄러 {len(done_tasks)} · 수동전환 {len(done_svcs)} · 시작 {len(done_startups)})",
                user_prompt="숨은 백그라운드 프로그램 정리",
                preview=", ".join([t.lstrip("\\") for t in done_tasks[:3]] + [s["serviceName"] for s in done_svcs[:3]] + done_startups[:2]),
                operations=restore_ops,
                user_approval_text=user_approval_text,
            )
            restore_id = str(pt.get("restoreId") or "")
        except Exception:
            pass

    lines = ["✅ **[숨은 백그라운드 항목 안전 정리 완료]**"]
    if done_tasks:
        lines.append(f"• **작업 스케줄러 비활성화 ({len(done_tasks)}건)**: {', '.join(t.lstrip(chr(92)) for t in done_tasks[:8])}")
    if done_svcs:
        lines.append(f"• **상주 서비스 '수동(Manual)' 무삭제 절전 ({len(done_svcs)}건 — 앱 켤 때만 작동)**: {', '.join(s['serviceName'] for s in done_svcs[:8])}")
    if done_startups:
        lines.append(f"• **부팅 자동실행 해제 ({len(done_startups)}건)**: {', '.join(done_startups[:8])}")
    if done_procs:
        lines.append(f"• **과점유 백그라운드 프로세스 종료 ({len(done_procs)}건)**: {', '.join(done_procs[:6])}")
    if restore_id:
        lines.append(f"• **↩️ 1초 원복 보장**: **[복원 기록 {restore_id}]**에 원래 설정이 모두 백업되어, 채팅창에 **\"아까 끈 거 다시 켜줘\"**라고 말씀하시면 1초 만에 원래대로 되돌려 드려요!")

    total_done = len(done_tasks) + len(done_svcs) + len(done_startups) + len(done_procs)
    if total_done == 0:
        lines.append("• 변경된 항목이 없거나 관리자 권한 확인이 필요했습니다.")

    return {
        "ok": total_done > 0,
        "disabledTasks": done_tasks,
        "manualServices": done_svcs,
        "disabledStartups": done_startups,
        "stoppedProcesses": done_procs,
        "restoreId": restore_id,
        "reportKo": "\n".join(lines),
    }


# ---------------------------------------------------------------------------
# 6. 통합 액션 디스패처 (plugin_ghosti_care_suite.py 에서 호출)
# ---------------------------------------------------------------------------
AGENT_CARE_READONLY_ACTIONS = {
    "disk-hog-scan",
    "disk_hog_scan",
    "security-2tier-scan",
    "security_2tier_scan",
    "desktop-detail-scan",
    "desktop_detail_scan",
    "desktop-system-icons",
    "desktop_system_icons",
    "hidden-rats-scan",
    "hidden_rats_scan",
}

AGENT_CARE_ALL_ACTIONS = AGENT_CARE_READONLY_ACTIONS | {
    "disk-hog-clean",
    "disk_hog_clean",
    "batch-deep-uninstall",
    "batch_deep_uninstall",
    "desktop-batch-action",
    "desktop_batch_action",
    "desktop-icon-toggle",
    "desktop_icon_toggle",
    "desktop-power-boost",
    "desktop_power_boost",
    "eradicate-pup",
    "eradicate_pup",
    "hidden-rats-apply",
    "hidden_rats_apply",
}


def handle_agent_care_action(action: str, payload: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    act = (action or "").strip().lower()
    if act not in AGENT_CARE_ALL_ACTIONS:
        return None
    data = payload or {}
    if act in ("disk-hog-scan", "disk_hog_scan"):
        return scan_disk_hogs(str(data.get("drive") or "C:"))
    if act in ("disk-hog-clean", "disk_hog_clean"):
        return execute_disk_hog_cleanup(
            include_ids=data.get("includeIds"),
            exclude_ids=data.get("excludeIds"),
            move_destination_drive=str(data.get("moveDestinationDrive") or ""),
            user_approval_text=str(data.get("userApprovalTypedText") or "대용량 공간 정리 승인"),
        )
    if act in ("security-2tier-scan", "security_2tier_scan"):
        return scan_security_and_pup_2tier()
    if act in ("batch-deep-uninstall", "batch_deep_uninstall"):
        return execute_batch_deep_uninstall(
            app_names=list(data.get("appNames") or []),
            exclude_names=list(data.get("excludeNames") or []),
            pup_ids=list(data.get("pupIds") or []),
            user_approval_text=str(data.get("userApprovalTypedText") or "다중 취사선택 일괄 제거 승인"),
        )
    if act in ("desktop-detail-scan", "desktop_detail_scan"):
        return inspect_desktop_and_folder_detail(str(data.get("targetPath") or "Desktop"))
    if act in ("desktop-system-icons", "desktop_system_icons"):
        return {"ok": True, "icons": diagnose_system_desktop_icons()}
    if act in ("desktop-icon-toggle", "desktop_icon_toggle"):
        return toggle_system_desktop_icon(
            icon_id=str(data.get("iconId") or "user_files"),
            hide=bool(data.get("hide", True)),
        )
    if act in ("desktop-batch-action", "desktop_batch_action"):
        return execute_desktop_batch_action(
            recycle_paths=data.get("recyclePaths"),
            move_paths=data.get("movePaths"),
            move_destination_drive=str(data.get("moveDestinationDrive") or "D:"),
            hide_system_icons=data.get("hideSystemIcons"),
            user_approval_text=str(data.get("userApprovalTypedText") or "바탕화면 선택 정리 승인"),
        )
    if act in ("desktop-power-boost", "desktop_power_boost"):
        return boost_desktop_power_plan()
    if act in ("eradicate-pup", "eradicate_pup"):
        return eradicate_known_pup_by_id(str(data.get("pupId") or ""))
    if act in ("hidden-rats-scan", "hidden_rats_scan"):
        return scan_hidden_background_rats()
    if act in ("hidden-rats-apply", "hidden_rats_apply"):
        return apply_hidden_rats_cleanup(
            disable_tasks=data.get("disableTasks"),
            manual_services=data.get("manualServices"),
            disable_startups=data.get("disableStartups"),
            stop_processes=data.get("stopProcesses"),
            user_approval_text=str(data.get("userApprovalTypedText") or "숨은 백그라운드 항목 안전 정리 승인"),
        )
    return None
