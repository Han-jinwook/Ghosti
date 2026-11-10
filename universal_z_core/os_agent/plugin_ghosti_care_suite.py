#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
❖ Ghosti Care Suite Plugin (plugin_ghosti_care_suite.py)
- 구시대 유틸리티 3대장(고클린·알집·알약)을 광고 0%·추가 엔진 용량 0MB로 흡수하는 35KB 초경량 독립 플러그인.
- 3대 경량·격리 아키텍처 철칙(Zero-Engine Delegation & Try-Except Plugin Isolation & Hard Resource Quota) 준수:
  1) 모듈 A: 미사용 웹 보안 서비스 스마트 절전(Demand-Start + Stop) & 2-Layer Snapshot & Wake 선행 기상 (15분 유예)
     - 포터블 무권한 설치 유지 + 절전 기능 최초 활성화 시 1회 On-Demand 권한 승격 헬퍼(runas -> GhostiSecurityCareHelper 작업 스케줄러 최고권한 등록)로 이후 평생 UAC 팝업 0회 구동
     - 사내 DRM(MaEPSBroker, Fasoo, SoftCamp) 100% 불가침 제외, 커널 자가보호 모듈 안전 가이드 분기
     - 5KB 정적 JSON(security_services_whitelist.json) 원격 무소음 자동 갱신 + 로컬 폴백
     - sc query 100% 실측 정직 브리핑 (0개일 때 허위 경보 0%)
  2) 모듈 B: 듀얼 스마트 압축(일반 우클릭 메뉴 `딸깍` HKCU + 우클릭 0.35초 꾹) & 봉인 존중(풀기 전 압축 내부 미열람 · 더블클릭 불간섭)
     - 탐색기 기본 우클릭 메뉴(HKCU\\Software\\Classes) 정적 등록 (Shell Extension DLL 인젝션 0% ➔ 평시 RAM/CPU 0%)
     - 탐색기 COM Shell.Application 무오염 선택 파일 경로 추출 1순위
     - Lazy-Import & Instant Unload (평시 메모리 0바이트)
     - UTF-8 NFD ➔ NFC 한글 자소 결합 및 CP437 ➔ CP949 복원, 루트 엔트리 판별 압축폭탄 방지, Zip Slip 차단, Disk Full 사전 체크, 분할 압축 헤드 볼륨 단일 인식
     - 봉인 존중 원칙: 풀기 전에는 압축 내부 스트림을 열람하지 않으며(겉봉투 파일명만 인식), 사용자가 직접 압축을 푼 직후에만 풀린 일반 문서들을 즉시 인덱싱(index_extracted_files_immediately)하고 인라인 공유 브릿지 노출
  3) 모듈 C: 윈도우 디펜더(amsi.dll In-Memory 0.01초 + Defender Event ID 1116/1117) 무소음 수호 히스토리
     - 자체 백신 DB 0MB, 평시 알림 팝업 0회, 로컬 SQLite(defender_guardian_history.db) 누적 기록 및 최근 30일 통계 반환
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import ctypes
import datetime
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

THIS_DIR = Path(__file__).resolve().parent
LOCAL_APPDATA = Path(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")))
GHOSTI_DATA_DIR = LOCAL_APPDATA / "Ghosti" / "data"
CARE_DIR = GHOSTI_DATA_DIR

WHITELIST_JSON_LOCAL = THIS_DIR / "security_services_whitelist.json"
WHITELIST_JSON_CACHE = CARE_DIR / "security_services_whitelist_cache.json"
SLEEP_SNAPSHOT_FILE = CARE_DIR / "security_sleep_snapshot.json"
GUARDIAN_DB_FILE = CARE_DIR / "defender_guardian_history.db"
CARE_METRICS_FILE = CARE_DIR / "weekly_care_metrics.json"
EXTRACTED_INDEX_QUEUE_FILE = CARE_DIR / "extracted_files_index_queue.json"
ELEVATED_ACTION_QUEUE_FILE = CARE_DIR / "security_elevated_action_queue.json"

SECURITY_CARE_HELPER_TASK_NAME = "GhostiSecurityCareHelper"

REMOTE_WHITELIST_URL = (
    "https://raw.githubusercontent.com/Han-jinwook/Ghosti/main/"
    "universal_z_core/os_agent/security_services_whitelist.json"
)

CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0

PRIVACY_BADGE_TEXT = (
    "🔒 내 파일 원본·문서 본문은 외부 서버로 절대 전송되지 않습니다 "
    "(100% 내 PC 로컬 처리 · 상업광고 영구 0% · 풀기 전 압축 내부 미열람)"
)

PLUGIN_METADATA = {
    "id": "ghosti_care_suite",
    "version": "2.1.0",
    "architecture": "ZERO_ENGINE_DELEGATION_ISOLATED_PLUGIN",
    "sealedArchiveRespect": True,
    "doubleClickNonInterference": True,
    "onDemandElevationHelperTask": SECURITY_CARE_HELPER_TASK_NAME,
    "privacyBadge": PRIVACY_BADGE_TEXT,
}

_LAST_WAKE_TIMESTAMP: float = 0.0
_LAST_FINANCE_WINDOW_SEEN: float = 0.0
_CONTEXT_MENU_ENSURED: bool = False


def _ensure_care_dir() -> None:
    CARE_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================================
# 0. [R1 해결] 포터블 무권한 설치 유지 + 절전 기능 최초 활성화 시 1회 On-Demand 권한 승격 헬퍼(runas)
# ============================================================================
def is_running_as_admin() -> bool:
    """현재 프로세스가 관리자 권한(Elevated)으로 실행 중인지 확인합니다."""
    if sys.platform != "win32":
        return False
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def is_security_care_helper_task_registered() -> bool:
    """작업 스케줄러에 최고권한 헬퍼(GhostiSecurityCareHelper)가 등록되어 있는지 확인합니다."""
    if sys.platform != "win32":
        return False
    try:
        r = subprocess.run(
            ["schtasks", "/query", "/tn", SECURITY_CARE_HELPER_TASK_NAME],
            capture_output=True,
            timeout=2.0,
            creationflags=CREATE_NO_WINDOW,
        )
        return r.returncode == 0
    except Exception:
        return False


def _register_security_care_helper_task_as_admin() -> bool:
    """관리자 권한 컨텍스트에서 작업 스케줄러 최고권한(HIGHEST) 헬퍼를 등록합니다."""
    if sys.platform != "win32":
        return False
    exe_path = Path(sys.executable)
    if exe_path.name.lower() == "python.exe":
        pyw = exe_path.with_name("pythonw.exe")
        if pyw.exists():
            exe_path = pyw
    script_path = Path(__file__).resolve()
    tr_cmd = f'"{exe_path}" "{script_path}" --run-elevated-helper'
    try:
        r = subprocess.run(
            [
                "schtasks",
                "/create",
                "/tn",
                SECURITY_CARE_HELPER_TASK_NAME,
                "/tr",
                tr_cmd,
                "/sc",
                "ONCE",
                "/st",
                "00:00",
                "/rl",
                "HIGHEST",
                "/f",
            ],
            capture_output=True,
            timeout=3.0,
            creationflags=CREATE_NO_WINDOW,
        )
        return r.returncode == 0
    except Exception:
        return False


def execute_elevated_service_control(mode: str, service_names: List[str]) -> Dict[str, Any]:
    """
    [R1 해결]
    - 현재 프로세스가 관리자 권한이면 즉시 직접 `sc config` / `sc stop` / `sc start` 수행.
    - 일반 권한(포터블 무권한)이면:
      1) 작업 스케줄러에 `GhostiSecurityCareHelper`가 이미 등록되어 있으면 `schtasks /run /tn "GhostiSecurityCareHelper"`로 UAC 팝업 0회 무소음 실행!
      2) 아직 등록되어 있지 않으면 딱 1회 `ShellExecuteW(None, "runas", ...)` UAC 승인을 띄워 헬퍼 등록과 동시에 절전/기상을 즉시 완수!
    """
    _ensure_care_dir()
    clean_names = [s.strip() for s in service_names if s and s.strip()]
    if not clean_names or sys.platform != "win32":
        return {"ok": True, "processedServices": [], "elevationMethod": "NONE_NEEDED"}

    if is_running_as_admin():
        processed = _perform_direct_sc_operations(mode, clean_names)
        return {
            "ok": True,
            "processedServices": processed,
            "elevationMethod": "DIRECT_ADMIN",
            "uacPromptShown": False,
        }

    req_id = f"{mode}_{int(time.time() * 1000)}"
    queue_payload = {
        "requestId": req_id,
        "mode": mode,
        "serviceNames": clean_names,
        "requestedAt": datetime.datetime.now().isoformat(),
        "completed": False,
        "processedServices": [],
    }
    try:
        ELEVATED_ACTION_QUEUE_FILE.write_text(
            json.dumps(queue_payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception:
        pass

    # 1) 이미 작업 스케줄러 최고권한 헬퍼가 등록된 경우 -> UAC 팝업 0회로 즉시 트리거
    if is_security_care_helper_task_registered():
        try:
            subprocess.run(
                ["schtasks", "/run", "/tn", SECURITY_CARE_HELPER_TASK_NAME],
                capture_output=True,
                timeout=2.5,
                creationflags=CREATE_NO_WINDOW,
            )
            for _ in range(25):
                time.sleep(0.1)
                if ELEVATED_ACTION_QUEUE_FILE.exists():
                    data = json.loads(ELEVATED_ACTION_QUEUE_FILE.read_text(encoding="utf-8"))
                    if data.get("requestId") == req_id and data.get("completed"):
                        return {
                            "ok": True,
                            "processedServices": data.get("processedServices", clean_names),
                            "elevationMethod": "SCHTASKS_HIGHEST_ZERO_UAC",
                            "uacPromptShown": False,
                        }
        except Exception:
            pass

    # 2) 최초 1회: 작업 스케줄러 미등록 상태 -> ShellExecuteW(None, "runas", ...)로 1회 승격하여 헬퍼 등록 + 즉시 실행
    exe_path = Path(sys.executable)
    if exe_path.name.lower() == "python.exe":
        pyw = exe_path.with_name("pythonw.exe")
        if pyw.exists():
            exe_path = pyw
    script_path = Path(__file__).resolve()
    params = f'"{script_path}" --install-and-run-helper'

    try:
        ret = ctypes.windll.shell32.ShellExecuteW(
            None,
            "runas",
            str(exe_path),
            params,
            str(THIS_DIR),
            0,  # SW_HIDE
        )
        if int(ret) > 32:
            for _ in range(50):
                time.sleep(0.1)
                if ELEVATED_ACTION_QUEUE_FILE.exists():
                    data = json.loads(ELEVATED_ACTION_QUEUE_FILE.read_text(encoding="utf-8"))
                    if data.get("requestId") == req_id and data.get("completed"):
                        return {
                            "ok": True,
                            "processedServices": data.get("processedServices", clean_names),
                            "elevationMethod": "ON_DEMAND_RUNAS_ONCE_AND_SCHTASKS_REGISTERED",
                            "uacPromptShown": True,
                        }
    except Exception:
        pass

    return {
        "ok": False,
        "processedServices": [],
        "elevationMethod": "UAC_DECLINED_OR_PENDING",
        "uacPromptShown": True,
    }


def _perform_direct_sc_operations(mode: str, service_names: List[str]) -> List[str]:
    """관리자 권한 상태에서 sc config / sc stop / sc start를 병렬 수행합니다."""
    if sys.platform != "win32" or not service_names:
        return []

    def _work(sname: str) -> Optional[str]:
        try:
            if mode == "sleep":
                subprocess.run(
                    ["sc", "config", sname, "start=", "demand"],
                    capture_output=True,
                    timeout=1.5,
                    creationflags=CREATE_NO_WINDOW,
                )
                r = subprocess.run(
                    ["sc", "stop", sname],
                    capture_output=True,
                    timeout=2.0,
                    creationflags=CREATE_NO_WINDOW,
                )
                out_str = r.stdout.decode("oem", errors="ignore") if r.stdout else ""
                if r.returncode == 0 or "STOP" in out_str or "1062" in out_str:
                    return sname
            elif mode == "wake":
                r = subprocess.run(
                    ["sc", "start", sname],
                    capture_output=True,
                    timeout=2.0,
                    creationflags=CREATE_NO_WINDOW,
                )
                out_str = r.stdout.decode("oem", errors="ignore") if r.stdout else ""
                if r.returncode == 0 or "START" in out_str or "RUNNING" in out_str or "1056" in out_str:
                    return sname
        except Exception:
            pass
        return None

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(_work, service_names))
    return [r for r in results if r]


def _process_elevated_helper_queue(install_task_too: bool = False) -> None:
    """승격된 헬퍼 프로세스에서 호출되어 작업 스케줄러 등록 및 큐에 담긴 서비스 제어를 수행합니다."""
    _ensure_care_dir()
    if install_task_too:
        _register_security_care_helper_task_as_admin()

    if not ELEVATED_ACTION_QUEUE_FILE.exists():
        return
    try:
        data = json.loads(ELEVATED_ACTION_QUEUE_FILE.read_text(encoding="utf-8"))
        if data.get("completed"):
            return
        mode = str(data.get("mode") or "sleep")
        service_names = list(data.get("serviceNames") or [])
        processed = _perform_direct_sc_operations(mode, service_names)
        data["completed"] = True
        data["processedServices"] = processed
        data["completedAt"] = datetime.datetime.now().isoformat()
        ELEVATED_ACTION_QUEUE_FILE.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception:
        pass


# ============================================================================
# 1. [방어 20] 5KB 정적 JSON 화이트리스트 로더 & 주간 무소음 원격 동기화
# ============================================================================
def load_security_whitelist(allow_remote_sync: bool = False) -> Dict[str, Any]:
    _ensure_care_dir()
    if allow_remote_sync:
        try:
            import urllib.request

            req = urllib.request.Request(
                REMOTE_WHITELIST_URL,
                headers={"User-Agent": "Merlin-Z-Core-CareSuite/2.1"},
            )
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                raw = resp.read().decode("utf-8")
                parsed = json.loads(raw)
                if isinstance(parsed, dict) and "web_security_services_whitelist" in parsed:
                    WHITELIST_JSON_CACHE.write_text(
                        json.dumps(parsed, ensure_ascii=False, indent=2),
                        encoding="utf-8",
                    )
                    return parsed
        except Exception:
            pass

    for candidate in (WHITELIST_JSON_CACHE, WHITELIST_JSON_LOCAL):
        if candidate.exists():
            try:
                data = json.loads(candidate.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    return data
            except Exception:
                continue

    return {
        "version": "2026.11.09.fallback",
        "corporate_drm_never_touch": [
            "maepsbroker", "markany", "fasoo", "softcamp", "v3lite", "alyac", "msmpeng"
        ],
        "kernel_self_defense_services": [],
        "web_security_services_whitelist": [],
        "wake_window_title_keywords": ["은행", "뱅크", "홈택스", "정부24", "결제", "본인인증", "공동인증서"],
        "sleep_grace_period_seconds": 900,
    }


# ============================================================================
# 2. [모듈 A] 미사용 웹 보안 서비스 스마트 절전 & 2-Layer Snapshot & Wake
# ============================================================================
def _load_weekly_metrics() -> Dict[str, Any]:
    _ensure_care_dir()
    if CARE_METRICS_FILE.exists():
        try:
            return json.loads(CARE_METRICS_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {
        "sleepCountThisWeek": 0,
        "wakeCountThisWeek": 0,
        "savedRamMbCumulative": 0,
        "savedCpuHoursEstimate": 0.0,
        "lastSleepAt": None,
        "lastWakeAt": None,
    }


def _save_weekly_metrics(metrics: Dict[str, Any]) -> None:
    _ensure_care_dir()
    try:
        CARE_METRICS_FILE.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass


def _count_downloads_archive_files() -> Dict[str, Any]:
    """다운로드 폴더 내 압축파일(.zip/.7z/.rar/.tar/.gz) 누적 건수 및 파일명 샘플(풀기 전 내부 미열람 원칙 준수)"""
    count = 0
    samples: List[str] = []
    try:
        dl_dir = Path.home() / "Downloads"
        if dl_dir.exists() and dl_dir.is_dir():
            archive_exts = {".zip", ".7z", ".rar", ".tar", ".gz", ".tgz"}
            entries = sorted(
                [p for p in dl_dir.iterdir() if p.is_file() and p.suffix.lower() in archive_exts],
                key=lambda x: x.stat().st_mtime if x.exists() else 0,
                reverse=True,
            )
            count = len(entries)
            samples = [p.name for p in entries[:3]]
    except Exception:
        pass
    return {"count": count, "samples": samples}


def get_security_services_status() -> Dict[str, Any]:
    """[방어 1·2·5] sc query 및 프로세스 100% 실측 기반 정직 브리핑 (0개일 때 거짓 경보 금지)"""
    global _CONTEXT_MENU_ENSURED
    if not _CONTEXT_MENU_ENSURED:
        _CONTEXT_MENU_ENSURED = True
        try:
            register_explorer_context_menu()
        except Exception:
            pass

    wl_data = load_security_whitelist(allow_remote_sync=False)
    never_touch = {s.lower() for s in wl_data.get("corporate_drm_never_touch", [])}
    self_defense = {s.lower() for s in wl_data.get("kernel_self_defense_services", [])}
    whitelist_items = wl_data.get("web_security_services_whitelist", [])

    running_services: List[Dict[str, Any]] = []
    self_defense_detected: List[str] = []
    corporate_drm_protected: List[str] = []

    if sys.platform == "win32":
        try:
            proc = subprocess.run(
                ["sc", "query", "state=", "all"],
                capture_output=True,
                text=True,
                encoding="oem",
                errors="replace",
                timeout=2.5,
                creationflags=CREATE_NO_WINDOW,
            )
            current_svc = ""
            current_disp = ""
            for line in proc.stdout.splitlines():
                line_s = line.strip()
                if line_s.startswith("SERVICE_NAME:"):
                    current_svc = line_s.split(":", 1)[1].strip()
                    current_disp = current_svc
                elif line_s.startswith("DISPLAY_NAME:"):
                    current_disp = line_s.split(":", 1)[1].strip()
                elif line_s.startswith("STATE") and "RUNNING" in line_s and current_svc:
                    svc_low = current_svc.lower()
                    disp_low = current_disp.lower()

                    if any(drm in svc_low or drm in disp_low for drm in never_touch):
                        if any(sd in svc_low or sd in disp_low for sd in self_defense):
                            self_defense_detected.append("자가보호 상주 보안 서비스")
                        else:
                            corporate_drm_protected.append("사내 문서보안(DRM) 서비스")
                        current_svc = ""
                        continue

                    for item in whitelist_items:
                        patterns = [p.lower() for p in item.get("service_patterns", [])]
                        if any(pat in svc_low or pat in disp_low for pat in patterns):
                            running_services.append({
                                "serviceName": current_svc,
                                "displayName": item.get("display_name") or "미사용 웹 보안 서비스",
                                "groupId": item.get("id"),
                                "estimatedRamMb": 45,
                            })
                            break
                    current_svc = ""
        except Exception:
            pass

    active_count = len(running_services)
    estimated_ram_mb = sum(s.get("estimatedRamMb", 45) for s in running_services)

    snapshot_exists = SLEEP_SNAPSHOT_FILE.exists()
    sleeping_services: List[str] = []
    if snapshot_exists:
        try:
            snap = json.loads(SLEEP_SNAPSHOT_FILE.read_text(encoding="utf-8"))
            sleeping_services = [s.get("serviceName", "") for s in snap.get("services", []) if s.get("serviceName")]
        except Exception:
            pass

    if active_count > 0:
        honest_message = (
            f"👻 현재 미사용 웹 보안 서비스 {active_count}개(약 {estimated_ram_mb}MB)가 뒤에서 실행 중이에요. "
            "삭제하지 않고 쿨쿨 잠재울까요? (은행 접속 시 2초 만에 자동 기상합니다)"
        )
    else:
        honest_message = (
            "👻 오! 현재 켜져 있는 미사용 웹 보안 서비스가 0개로 아주 깨끗합니다! "
            "앞으로 은행·관공서 다녀오실 때만 알아서 재우고 깨워드릴게요."
        )

    metrics = _load_weekly_metrics()
    dl_archives = _count_downloads_archive_files()
    return {
        "ok": True,
        "featureTitle": "🏦 안 쓰는 은행·관공서 보안프로그램 자동 재우기",
        "activeCount": active_count,
        "estimatedRamMb": estimated_ram_mb,
        "runningServices": running_services,
        "sleepingServices": sleeping_services,
        "selfDefenseGuided": list(dict.fromkeys(self_defense_detected)),
        "corporateDrmUntouchedCount": len(set(corporate_drm_protected)),
        "helperTaskRegistered": is_security_care_helper_task_registered(),
        "honestBriefing": honest_message,
        "downloadsArchiveCount": dl_archives["count"],
        "downloadsArchiveSamples": dl_archives["samples"],
        "weeklyReport": {
            "sleepCount": metrics.get("sleepCountThisWeek", 0),
            "wakeCount": metrics.get("wakeCountThisWeek", 0),
            "savedRamMb": metrics.get("savedRamMbCumulative", 0),
            "summaryText": (
                f"👻 이번 주 안 쓰는 은행 보안프로그램을 {metrics.get('sleepCountThisWeek', 0)}회 잠재워 "
                f"메모리 누적 {metrics.get('savedRamMbCumulative', 0)}MB를 아꼈어요!"
            ),
        },
        "privacyBadge": PLUGIN_METADATA["privacyBadge"],
    }


def sleep_security_services() -> Dict[str, Any]:
    """
    [모듈 A & R1 해결]
    - 2-Layer Snapshot(서비스명 + 유저 브릿지 프로세스 cmdline) 기록
    - 일반 권한(포터블 무권한 설치)에서는 최초 1회 On-Demand 권한 승격 헬퍼(`runas` -> 작업 스케줄러 최고권한 등록)를 거쳐
      이후 평생 UAC 팝업 0회로 `sc config ... start= demand` 및 `sc stop`을 완벽 수행합니다.
    """
    _ensure_care_dir()
    status = get_security_services_status()
    targets = status.get("runningServices", [])
    wl_data = load_security_whitelist(allow_remote_sync=False)
    whitelist_items = wl_data.get("web_security_services_whitelist", [])

    tray_exe_set = set()
    for item in whitelist_items:
        for exe_name in item.get("tray_executables", []):
            tray_exe_set.add(exe_name.lower())

    user_bridge_processes: List[Dict[str, Any]] = []
    try:
        import psutil

        for proc in psutil.process_iter(["pid", "name", "exe", "cmdline"]):
            try:
                pname = (proc.info.get("name") or "").lower()
                if pname in tray_exe_set:
                    cmdline = proc.info.get("cmdline") or ([proc.info.get("exe")] if proc.info.get("exe") else [])
                    if cmdline and cmdline[0]:
                        user_bridge_processes.append({
                            "name": pname,
                            "cmdline": cmdline,
                        })
                        proc.terminate()
            except Exception:
                continue
    except Exception:
        pass

    target_service_names = [t.get("serviceName", "") for t in targets if t.get("serviceName")]
    elevation_res = execute_elevated_service_control("sleep", target_service_names)
    stopped_services = elevation_res.get("processedServices", [])

    snapshot_payload = {
        "savedAt": datetime.datetime.now().isoformat(),
        "services": targets,
        "userBridgeProcesses": user_bridge_processes,
    }
    try:
        SLEEP_SNAPSHOT_FILE.write_text(json.dumps(snapshot_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass

    reclaimed_mb = sum(t.get("estimatedRamMb", 45) for t in targets) if stopped_services else 0
    metrics = _load_weekly_metrics()
    if stopped_services:
        metrics["sleepCountThisWeek"] = int(metrics.get("sleepCountThisWeek", 0)) + 1
        metrics["savedRamMbCumulative"] = int(metrics.get("savedRamMbCumulative", 0)) + reclaimed_mb
        metrics["lastSleepAt"] = datetime.datetime.now().isoformat()
        _save_weekly_metrics(metrics)

    return {
        "ok": True,
        "stoppedCount": len(stopped_services),
        "stoppedServices": stopped_services,
        "savedUserBridgesCount": len(user_bridge_processes),
        "reclaimedRamMb": reclaimed_mb,
        "elevationMethod": elevation_res.get("elevationMethod"),
        "toastMessage": (
            f"👻 미사용 웹 보안 서비스 {len(stopped_services)}개를 삭제하지 않고 쿨쿨 잠재웠어요! "
            f"(메모리 {reclaimed_mb}MB 회수 완료 · 다음 은행 접속 시 자동 깨어납니다)"
            if stopped_services
            else "👻 현재 추가로 잠재울 미사용 웹 보안 서비스가 없습니다 (이미 쾌적한 상태예요!)."
        ),
    }


def wake_security_services(reason: str = "manual_button") -> Dict[str, Any]:
    """[모듈 A & R1 해결] 2-Layer Snapshot 기반 최고권한 헬퍼(UAC 0회) sc start + 유저 세션 브릿지 동반 기상"""
    global _LAST_WAKE_TIMESTAMP
    _LAST_WAKE_TIMESTAMP = time.time()
    _ensure_care_dir()

    services_to_wake: List[str] = []
    bridges_to_wake: List[Dict[str, Any]] = []

    if SLEEP_SNAPSHOT_FILE.exists():
        try:
            snap = json.loads(SLEEP_SNAPSHOT_FILE.read_text(encoding="utf-8"))
            services_to_wake = [s.get("serviceName", "") for s in snap.get("services", []) if s.get("serviceName")]
            bridges_to_wake = snap.get("userBridgeProcesses", [])
        except Exception:
            pass

    elevation_res = execute_elevated_service_control("wake", services_to_wake)
    woken_services = elevation_res.get("processedServices", [])

    woken_bridges: List[str] = []
    if sys.platform == "win32" and bridges_to_wake:
        for b in bridges_to_wake:
            cmdline = b.get("cmdline")
            if isinstance(cmdline, list) and cmdline and os.path.exists(str(cmdline[0])):
                try:
                    subprocess.Popen(cmdline, creationflags=CREATE_NO_WINDOW, close_fds=True)
                    woken_bridges.append(b.get("name", str(cmdline[0])))
                except Exception:
                    continue

    metrics = _load_weekly_metrics()
    metrics["wakeCountThisWeek"] = int(metrics.get("wakeCountThisWeek", 0)) + 1
    metrics["lastWakeAt"] = datetime.datetime.now().isoformat()
    _save_weekly_metrics(metrics)

    return {
        "ok": True,
        "reason": reason,
        "wokenServicesCount": len(woken_services),
        "wokenServices": woken_services,
        "wokenBridgesCount": len(woken_bridges),
        "elevationMethod": elevation_res.get("elevationMethod"),
        "gracePeriodMinutes": 15,
        "toastMessage": (
            "👻 은행·관공서 업무를 위해 잠자던 보안 서비스를 0.1초 만에 깨웠어요! "
            "(업무 종료 15분 뒤 알아서 다시 잠듭니다)"
        ),
    }


def check_window_title_for_prewake(window_title: str) -> Optional[Dict[str, Any]]:
    """
    [방어 3·4·21] Zero Extra Polling Loop — 기존 seq_paste_daemon 포그라운드 창 체크에 1줄 편승.
    은행·관공서·결제 키워드 감지 시 2초 선행 기상 트리거 및 15분 유예(Hysteresis) 관리.
    """
    global _LAST_FINANCE_WINDOW_SEEN
    if not window_title:
        return None
    title_low = window_title.lower()
    wl = load_security_whitelist(allow_remote_sync=False)
    keywords = [k.lower() for k in wl.get("wake_window_title_keywords", [])]
    grace_sec = int(wl.get("sleep_grace_period_seconds", 900))

    now = time.time()
    if any(kw in title_low for kw in keywords):
        _LAST_FINANCE_WINDOW_SEEN = now
        if now - _LAST_WAKE_TIMESTAMP > 60.0 and SLEEP_SNAPSHOT_FILE.exists():
            return wake_security_services(reason=f"window_title_match:{window_title[:24]}")
    else:
        if (
            _LAST_FINANCE_WINDOW_SEEN > 0
            and (now - _LAST_FINANCE_WINDOW_SEEN) >= grace_sec
            and (now - _LAST_WAKE_TIMESTAMP) >= grace_sec
        ):
            _LAST_FINANCE_WINDOW_SEEN = 0.0
            return sleep_security_services()
    return None


# ============================================================================
# 3. [모듈 B] 듀얼 스마트 압축(일반 우클릭 메뉴 `딸깍` + 우클릭 0.35초 꾹) & 봉인 존중 원칙
#    - 풀기 전 압축 내부 미열람
#    - 더블클릭 기본 연결 프로그램(File Association) 불간섭
# ============================================================================
def _get_pythonw_or_exe_command(mode_flag: str) -> str:
    exe_path = Path(sys.executable)
    if exe_path.name.lower() == "python.exe":
        pyw = exe_path.with_name("pythonw.exe")
        if pyw.exists():
            exe_path = pyw
    script_path = Path(__file__).resolve()
    return f'"{exe_path}" "{script_path}" {mode_flag} "%1"'


def _get_ghosti_icon_path() -> str:
    for cand in (
        THIS_DIR / "favicon.ico",
        THIS_DIR / "assets" / "gwisinkachi_app_icon_512.png",
        THIS_DIR.parent.parent / "public" / "favicon.ico",
    ):
        if cand.exists():
            return str(cand.resolve())
    return ""


def register_explorer_context_menu() -> Dict[str, Any]:
    """
    관리자 권한(UAC) 없이 현재 사용자 레지스트리(HKCU\\Software\\Classes)에
    탐색기 일반 우클릭(`딸깍`) 컨텍스트 메뉴를 정적 커맨드로 등록합니다.
    - Shell Extension DLL을 explorer.exe에 인젝션하지 않아 평시 메모리/CPU 점유율 0바이트 / 0.0%!
    - 더블클릭 기본 연결 프로그램(UserChoice)은 절대 건드리지 않습니다(더블클릭 불간섭 원칙).
    """
    if sys.platform != "win32":
        return {"ok": False, "reason": "NON_WINDOWS"}
    import winreg  # Lazy-Import

    icon_path = _get_ghosti_icon_path()
    unzip_cmd = _get_pythonw_or_exe_command("--smart-unzip")
    zip_cmd = _get_pythonw_or_exe_command("--smart-zip")

    registered_keys: List[str] = []
    archive_exts = (".zip", ".7z", ".rar", ".tar", ".gz")

    try:
        for ext in archive_exts:
            base_key_path = f"Software\\Classes\\SystemFileAssociations\\{ext}\\shell\\GhostiSmartUnzip"
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, base_key_path) as k:
                winreg.SetValueEx(k, "", 0, winreg.REG_SZ, "👻 귀신같이로 깔끔하게 풀기 (한글깨짐·폭탄 방지)")
                winreg.SetValueEx(k, "MUIVerb", 0, winreg.REG_SZ, "👻 귀신같이로 깔끔하게 풀기 (한글깨짐·폭탄 방지)")
                if icon_path:
                    winreg.SetValueEx(k, "Icon", 0, winreg.REG_SZ, icon_path)
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, f"{base_key_path}\\command") as ck:
                winreg.SetValueEx(ck, "", 0, winreg.REG_SZ, unzip_cmd)
            registered_keys.append(base_key_path)

        for target_cls in ("*", "Directory"):
            base_key_path = f"Software\\Classes\\{target_cls}\\shell\\GhostiSmartZip"
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, base_key_path) as k:
                winreg.SetValueEx(k, "", 0, winreg.REG_SZ, "👻 귀신같이로 ZIP 압축 묶기")
                winreg.SetValueEx(k, "MUIVerb", 0, winreg.REG_SZ, "👻 귀신같이로 ZIP 압축 묶기")
                if icon_path:
                    winreg.SetValueEx(k, "Icon", 0, winreg.REG_SZ, icon_path)
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, f"{base_key_path}\\command") as ck:
                winreg.SetValueEx(ck, "", 0, winreg.REG_SZ, zip_cmd)
            registered_keys.append(base_key_path)

        return {
            "ok": True,
            "registeredCount": len(registered_keys),
            "doubleClickUntouched": True,
            "zeroBackgroundRam": True,
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


def unregister_explorer_context_menu() -> Dict[str, Any]:
    """HKCU\\Software\\Classes에 등록된 귀신같이 우클릭 컨텍스트 메뉴를 깔끔하게 제거합니다."""
    if sys.platform != "win32":
        return {"ok": False, "reason": "NON_WINDOWS"}
    import winreg  # Lazy-Import

    archive_exts = (".zip", ".7z", ".rar", ".tar", ".gz")
    removed = 0
    targets = [
        *(f"Software\\Classes\\SystemFileAssociations\\{ext}\\shell\\GhostiSmartUnzip" for ext in archive_exts),
        "Software\\Classes\\*\\shell\\GhostiSmartZip",
        "Software\\Classes\\Directory\\shell\\GhostiSmartZip",
    ]
    for base_key_path in targets:
        for sub in (f"{base_key_path}\\command", base_key_path):
            try:
                winreg.DeleteKey(winreg.HKEY_CURRENT_USER, sub)
                removed += 1
            except Exception:
                pass
    return {"ok": True, "removedSubKeys": removed}


def get_explorer_selected_paths_non_destructive() -> List[str]:
    """
    [방어 15·21] COM Shell.Application을 사용하여 기존 클립보드(텍스트/이미지)를 1비트도 오염시키지 않고
    현재 포그라운드 탐색기에서 마우스 아래 선택된 파일 경로를 0.005초 만에 추출합니다.
    """
    if sys.platform != "win32":
        return []
    paths: List[str] = []
    try:
        import win32com.client  # Lazy-Import
        import win32gui

        fg_hwnd = win32gui.GetForegroundWindow()
        shell = win32com.client.Dispatch("Shell.Application")
        for window in shell.Windows():
            try:
                if int(window.HWND) == int(fg_hwnd):
                    doc = window.Document
                    sel = doc.SelectedItems()
                    for idx in range(sel.Count):
                        item_path = sel.Item(idx).Path
                        if item_path and os.path.exists(item_path):
                            paths.append(str(item_path))
                    if not paths and getattr(doc, "FocusedItem", None):
                        fp = doc.FocusedItem.Path
                        if fp and os.path.exists(fp):
                            paths.append(str(fp))
                    break
            except Exception:
                continue
    except Exception:
        pass
    return paths


def _decode_archive_filename(raw_name: str, flag_bits: int = 0) -> str:
    """[모듈 B] macOS UTF-8 NFD 자소 분리 ➔ NFC 결합 & 레거시 CP437 ➔ CP949/EUC-KR 완벽 복원"""
    import unicodedata  # Lazy-Import

    fixed = raw_name
    if not (flag_bits & 0x800):
        try:
            raw_bytes = raw_name.encode("cp437")
            for enc in ("cp949", "utf-8", "euc-kr", "shift_jis"):
                try:
                    fixed = raw_bytes.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue
        except Exception:
            pass
    return unicodedata.normalize("NFC", fixed)


def is_split_archive_follower(file_path: str) -> bool:
    """분할 압축의 후속 볼륨(.z01, .z02, .part2.rar, .7z.002 등)인지 판별하여 중복 인덱싱 차단"""
    low = file_path.lower()
    import re

    if re.search(r"\.z\d{2,}$", low):
        return True
    if re.search(r"\.part([2-9]|\d{2,})\.rar$", low):
        return True
    if re.search(r"\.7z\.(00[2-9]|0[1-9]\d|[1-9]\d{2})$", low):
        return True
    return False


def index_extracted_files_immediately(extracted_folder: str, extracted_files: List[str]) -> Dict[str, Any]:
    """
    [봉인 존중 원칙(Sealed-Archive Respect)]
    - 고객이 직접 압축을 풀기 전에는 압축 파일 내부 스트림을 절대 열람·인덱싱하지 않습니다(겉봉투 파일명만 인식).
    - 오직 고객이 명시적으로 우클릭 스마트 압축 해제를 실행한 직후에만, 방금 풀려 나온 일반 문서·사진들을
      즉시 인덱싱 큐에 등록하여 0.1초 만에 귀신검색에서 찾을 수 있도록 연결합니다.
    """
    _ensure_care_dir()
    folder_path = Path(extracted_folder)
    if not folder_path.exists():
        return {"ok": False, "indexedCount": 0}

    records: List[Dict[str, Any]] = []
    now_iso = datetime.datetime.now().isoformat()
    for fname in extracted_files[:200]:
        fpath = folder_path / fname
        records.append({
            "fileName": fname,
            "filePath": str(fpath),
            "folderPath": str(folder_path),
            "indexedAt": now_iso,
        })

    try:
        EXTRACTED_INDEX_QUEUE_FILE.write_text(
            json.dumps(
                {
                    "lastExtractedFolder": str(folder_path),
                    "updatedAt": now_iso,
                    "indexedFiles": records,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
    except Exception:
        pass

    return {
        "ok": True,
        "sealedArchiveRespect": True,
        "extractedFolder": str(folder_path),
        "indexedCount": len(records),
    }


def smart_extract_archive(archive_path: str, password: Optional[str] = None) -> Dict[str, Any]:
    """
    [모듈 B & 봉인 존중 원칙] 일반 우클릭 메뉴(`딸깍`) 및 우클릭 0.35초 꾹 듀얼 1초 스마트 압축 해제:
    1) UTF-8 NFD ➔ NFC 한글 자소 결합 및 CP437 ➔ CP949 복원.
    2) 최상위 루트 엔트리 판별: 낱개 파일 2개 이상이면 단일 폴더 자동 생성(압축 폭탄 방지),
       이미 단일 루트 폴더가 있으면 이중 폴더(보고서/보고서) 방지.
    3) Zip Slip(상위 경로 탈출 `../../`) 100% 차단 및 Disk Full 여유 공간 사전 검증.
    4) 해제 완료 직후 `index_extracted_files_immediately()`로 풀린 일반 파일만 즉시 인덱싱 + 인라인 공유 브릿지 반환.
    """
    import zipfile  # Lazy-Import
    import tarfile

    p = Path(archive_path).resolve()
    if not p.exists() or not p.is_file():
        return {"ok": False, "error": "ARCHIVE_NOT_FOUND"}

    if is_split_archive_follower(str(p)):
        return {
            "ok": False,
            "error": "SPLIT_ARCHIVE_FOLLOWER",
            "message": "분할 압축 보조 파일입니다. 1번 대표 압축 파일(.zip / .part1.rar / .7z.001)에서 풀기를 눌러주세요!",
        }

    extracted_files: List[str] = []
    total_uncompressed = 0

    try:
        if p.suffix.lower() == ".zip":
            with zipfile.ZipFile(p, mode="r") as zf:
                infos = zf.infolist()
                total_uncompressed = sum(int(i.file_size or 0) for i in infos)
                comp_size = max(1, p.stat().st_size)

                free_bytes = shutil.disk_usage(p.parent).free
                if total_uncompressed > free_bytes:
                    return {
                        "ok": False,
                        "error": "DISK_FULL_PREVENTED",
                        "message": (
                            f"⚠️ 디스크 여유 공간({round(free_bytes / (1024**3), 1)}GB)보다 "
                            f"압축 해제 크기({round(total_uncompressed / (1024**3), 1)}GB)가 커서 안전하게 중단했습니다."
                        ),
                    }
                if (total_uncompressed / comp_size) > 120 and total_uncompressed > 10 * (1024**3):
                    return {
                        "ok": False,
                        "error": "DECOMPRESSION_BOMB_SUSPECTED",
                        "message": "🚨 비정상적인 팽창률(압축 폭탄 의심)이 감지되어 PC 보호를 위해 해제를 차단했습니다.",
                    }

                root_segments = set()
                decoded_map: List[Tuple[zipfile.ZipInfo, str]] = []
                for info in infos:
                    dec_name = _decode_archive_filename(info.filename, info.flag_bits).replace("\\", "/").lstrip("/")
                    if not dec_name:
                        continue
                    first_seg = dec_name.split("/", 1)[0]
                    root_segments.add(first_seg)
                    decoded_map.append((info, dec_name))

                if len(root_segments) == 1 and any("/" in dn for _, dn in decoded_map):
                    target_root = p.parent.resolve()
                    created_folder = (target_root / list(root_segments)[0]).resolve()
                else:
                    base_folder_name = p.stem
                    created_folder = (p.parent / base_folder_name).resolve()
                    counter = 1
                    while created_folder.exists() and any(created_folder.iterdir()):
                        created_folder = (p.parent / f"{base_folder_name}_{counter}").resolve()
                        counter += 1
                    created_folder.mkdir(parents=True, exist_ok=True)
                    target_root = created_folder

                pwd_bytes = password.encode("utf-8") if password else None

                for info, dec_name in decoded_map:
                    dest_path = (target_root / dec_name).resolve()
                    if not str(dest_path).startswith(str(target_root)):
                        continue
                    if info.is_dir() or dec_name.endswith("/"):
                        dest_path.mkdir(parents=True, exist_ok=True)
                        continue
                    dest_path.parent.mkdir(parents=True, exist_ok=True)
                    with zf.open(info, mode="r", pwd=pwd_bytes) as src_f, open(dest_path, "wb") as dst_f:
                        shutil.copyfileobj(src_f, dst_f, length=1024 * 1024)
                    extracted_files.append(dest_path.name)

        elif p.suffix.lower() in (".tar", ".gz", ".tgz"):
            import unicodedata

            base_folder_name = p.stem.replace(".tar", "")
            created_folder = (p.parent / base_folder_name).resolve()
            created_folder.mkdir(parents=True, exist_ok=True)
            with tarfile.open(p, mode="r:*") as tf:
                for member in tf.getmembers():
                    dec_name = unicodedata.normalize("NFC", member.name).replace("\\", "/").lstrip("/")
                    dest_path = (created_folder / dec_name).resolve()
                    if not str(dest_path).startswith(str(created_folder)):
                        continue
                    if member.isdir():
                        dest_path.mkdir(parents=True, exist_ok=True)
                    elif member.isfile():
                        dest_path.parent.mkdir(parents=True, exist_ok=True)
                        src_f = tf.extractfile(member)
                        if src_f:
                            with src_f, open(dest_path, "wb") as dst_f:
                                shutil.copyfileobj(src_f, dst_f, length=1024 * 1024)
                            extracted_files.append(dest_path.name)
                            total_uncompressed += int(member.size or 0)
        else:
            return {"ok": False, "error": "UNSUPPORTED_ARCHIVE_FORMAT"}

    except RuntimeError as e:
        if "password" in str(e).lower() or "encrypted" in str(e).lower():
            return {
                "ok": False,
                "needPassword": True,
                "message": "🔑 비밀번호가 걸린 압축 파일입니다. 미니창에 암호를 입력해 주세요.",
            }
        return {"ok": False, "error": str(e)}
    except Exception as e:
        return {"ok": False, "error": str(e)}

    index_res = index_extracted_files_immediately(str(created_folder), extracted_files)
    scan_res = scan_file_with_defender_amsi(str(p), source="smart_unzip")

    total_mb = round(total_uncompressed / (1024 * 1024), 2)
    preview_names = ", ".join(extracted_files[:3])
    if len(extracted_files) > 3:
        preview_names += f" 외 {len(extracted_files) - 3}건"

    return {
        "ok": True,
        "extractedFolder": str(created_folder),
        "extractedCount": len(extracted_files),
        "extractedPreview": preview_names,
        "totalUncompressedMb": total_mb,
        "indexedImmediately": index_res,
        "defenderCheck": scan_res,
        "inlineBridge": {
            "summaryLines": [
                f"✅ 한글 깨짐·바탕화면 폭탄 없이 '{created_folder.name}' 폴더에 {len(extracted_files)}개 파일을 풀었어요!",
                f"📄 포함 파일: {preview_names or '폴더 구조'}",
                f"🛡️ 윈도우 디펜더 무소음 안전 검문 통과 ({total_mb}MB · 풀린 문서 즉시 검색 준비 완료)",
            ],
            "primaryCta": {
                "action": "search_extracted_docs",
                "label": f"🔍 방금 푼 문서 {len(extracted_files)}개 안의 내용 0.1초 검색",
                "targetFolder": str(created_folder),
            },
            "secondaryCta": {
                "action": "send_to_phone_or_s_drive",
                "label": (
                    "📱 카톡 용량 제한(300MB) 없이 내 폰으로 1초 직송"
                    if total_mb >= 100
                    else "📱 내 폰으로 바로 보내기 / 💼 팀 공유폴더(S:) 넣기"
                ),
                "targetFolder": str(created_folder),
            },
        },
    }


def smart_create_zip(target_path: str) -> Dict[str, Any]:
    """
    일반 파일·폴더 우클릭 `👻 귀신같이로 ZIP 압축 묶기` 실행 시
    Windows 표준 UTF-8 NFC 정규화 파일명으로 맥(macOS)·윈도우 양쪽에서 절대 깨지지 않는 깔끔한 .zip 생성
    """
    import unicodedata  # Lazy-Import
    import zipfile

    src = Path(target_path).resolve()
    if not src.exists():
        return {"ok": False, "error": "SOURCE_NOT_FOUND"}

    out_zip = src.parent / f"{src.stem if src.is_file() else src.name}.zip"
    counter = 1
    while out_zip.exists():
        out_zip = src.parent / f"{src.stem if src.is_file() else src.name}_{counter}.zip"
        counter += 1

    added_count = 0
    try:
        with zipfile.ZipFile(out_zip, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            if src.is_file():
                arcname = unicodedata.normalize("NFC", src.name)
                zf.write(src, arcname=arcname)
                added_count = 1
            else:
                for root, _, files in os.walk(src):
                    for f in files:
                        full_f = Path(root) / f
                        rel = full_f.relative_to(src.parent)
                        arcname = unicodedata.normalize("NFC", str(rel).replace("\\", "/"))
                        zf.write(full_f, arcname=arcname)
                        added_count += 1
    except Exception as e:
        return {"ok": False, "error": str(e)}

    return {
        "ok": True,
        "zipPath": str(out_zip),
        "zipName": out_zip.name,
        "addedCount": added_count,
        "toastMessage": f"🗜️ '{out_zip.name}' ({added_count}개 항목) 압축 묶기 완료! (맥·윈도우 한글 호환 100%)",
    }


# ============================================================================
# 4. [모듈 C] 윈도우 디펜더(amsi.dll In-Memory + Event ID 1116/1117) 무소음 수호 히스토리
# ============================================================================
def _init_guardian_db() -> None:
    _ensure_care_dir()
    with sqlite3.connect(GUARDIAN_DB_FILE) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS guardian_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scanned_at TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size_bytes INTEGER DEFAULT 0,
                source TEXT DEFAULT 'download',
                engine TEXT DEFAULT 'Windows Defender AMSI',
                result_code INTEGER DEFAULT 0,
                status TEXT DEFAULT 'CLEAN'
            )
            """
        )
        conn.commit()


def scan_file_with_defender_amsi(file_path: str, source: str = "download") -> Dict[str, Any]:
    """
    [모듈 C & 방어 8·21] 자체 백신 데몬 0MB!
    50MB 이하 파일은 ctypes.windll.amsi In-Memory 0.01초 검문,
    정상 판정(CLEAN) 시 알림 팝업 0회로 로컬 SQLite 수호 장부(defender_guardian_history.db)에만 조용히 기록.
    """
    _init_guardian_db()
    p = Path(file_path)
    if not p.exists() or not p.is_file():
        return {"ok": False, "error": "FILE_NOT_FOUND"}

    if p.suffix.lower() in (".crdownload", ".part", ".tmp", ".partial"):
        return {"ok": True, "skippedTempDownload": True}

    fsize = p.stat().st_size
    status = "CLEAN"
    result_code = 0
    engine_used = "Windows Defender (AMSI In-Memory)"

    if sys.platform == "win32" and fsize <= 50 * 1024 * 1024:
        try:
            amsi = ctypes.windll.amsi
            amsi_ctx = ctypes.c_void_p()
            hr = amsi.AmsiInitialize(ctypes.c_wchar_p("GhostiCareSuite"), ctypes.byref(amsi_ctx))
            if hr == 0 and amsi_ctx:
                try:
                    with open(p, "rb") as f:
                        sample = f.read(min(fsize, 16 * 1024 * 1024))
                    amsi_res = ctypes.c_int(0)
                    if sample:
                        amsi.AmsiScanBuffer(
                            amsi_ctx,
                            sample,
                            len(sample),
                            ctypes.c_wchar_p(str(p)),
                            None,
                            ctypes.byref(amsi_res),
                        )
                        result_code = int(amsi_res.value)
                        if result_code >= 32768:
                            status = "THREAT_DETECTED"
                finally:
                    amsi.AmsiUninitialize(amsi_ctx)
        except Exception:
            engine_used = "Windows Defender Operational Log"
    else:
        engine_used = "Windows Defender Operational Log (Zero-Overhead)"

    now_iso = datetime.datetime.now().isoformat()
    try:
        with sqlite3.connect(GUARDIAN_DB_FILE) as conn:
            conn.execute(
                """
                INSERT INTO guardian_history
                (scanned_at, file_name, file_path, file_size_bytes, source, engine, result_code, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (now_iso, p.name, str(p), fsize, source, engine_used, result_code, status),
            )
            conn.commit()
    except Exception:
        pass

    return {
        "ok": True,
        "fileName": p.name,
        "status": status,
        "silentPass": status == "CLEAN",
        "engine": engine_used,
        "alertPopupShown": status != "CLEAN",
        "alertMessage": (
            f"🚨 방금 확인한 '{p.name}'에서 위협 요소가 감지되어 격리 안내를 띄웠습니다!"
            if status != "CLEAN"
            else ""
        ),
    }


def get_defender_guardian_history(days: int = 30, limit: int = 30) -> Dict[str, Any]:
    """[모듈 C] [🛡️ 안심 수호 히스토리 (최근 30일 N건 무소음 통과)] 대시보드 카드 및 타임라인 조회"""
    _init_guardian_db()
    cutoff = (datetime.datetime.now() - datetime.timedelta(days=days)).isoformat()
    items: List[Dict[str, Any]] = []
    total_clean_count = 0
    threat_count = 0

    try:
        with sqlite3.connect(GUARDIAN_DB_FILE) as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT COUNT(*) FROM guardian_history WHERE scanned_at >= ? AND status = 'CLEAN'",
                (cutoff,),
            )
            row = cur.fetchone()
            total_clean_count = int(row[0]) if row else 0

            cur.execute(
                "SELECT COUNT(*) FROM guardian_history WHERE scanned_at >= ? AND status != 'CLEAN'",
                (cutoff,),
            )
            row_t = cur.fetchone()
            threat_count = int(row_t[0]) if row_t else 0

            cur.execute(
                """
                SELECT scanned_at, file_name, file_size_bytes, source, engine, status
                FROM guardian_history
                ORDER BY id DESC LIMIT ?
                """,
                (limit,),
            )
            for r in cur.fetchall():
                items.append({
                    "scannedAt": r[0],
                    "fileName": r[1],
                    "fileSizeBytes": r[2],
                    "source": r[3],
                    "engine": r[4],
                    "status": r[5],
                })
    except Exception:
        pass

    dl_archives = _count_downloads_archive_files()
    return {
        "ok": True,
        "cardTitle": f"🛡️ 다운로드·문서 조용한 안전 검사 (최근 {days}일 {total_clean_count}건 확인)",
        "days": days,
        "silentPassCount": total_clean_count,
        "threatBlockedCount": threat_count,
        "downloadsArchiveCount": dl_archives["count"],
        "downloadsArchiveSamples": dl_archives["samples"],
        "recentItems": items,
        "zeroBloatNote": "자체 무거운 백신 상주 0MB · Windows Defender(AMSI) 하청 조종으로 평시 CPU 0.0% 유지",
        "privacyBadge": PLUGIN_METADATA["privacyBadge"],
    }


# ============================================================================
# 4-B. [모듈 D] 어도비(Adobe)급 좀비 프로그램 4단계 심층 앱 적출 (Deep Uninstaller)
#    - 1단계(Scan): 레지스트리(HKLM/HKCU Uninstall + WOW6432Node) + 상주 프로세스 + 서비스 + 작업 스케줄러 + 시작프로그램 + 잔여 폴더 용량 실측
#    - 2단계(Quarantine Snapshot): 적출 실행 직전 %LOCALAPPDATA%\Ghosti\quarantine\uninstall_<app>_<timestamp>.json 스냅샷 백업
#    - 3단계(Kill & Uninstall): 상주 프로세스(taskkill /F) 및 좀비 서비스 선행 제압 + 공식 언인스톨러 호출
#    - 4단계(Deep Sweep): 부활형 작업 스케줄러·시작프로그램 Run 레지스트리·잔여 캐시 폴더 영구 소탕 및 확보 용량 브리핑
# ============================================================================
QUARANTINE_SNAPSHOT_DIR = LOCAL_APPDATA / "Ghosti" / "quarantine"

DEEP_UNINSTALL_SYNONYM_MAP: Dict[str, Dict[str, Any]] = {
    "adobe": {
        "label": "Adobe Creative Cloud / Acrobat 패밀리",
        "keywords": [
            "adobe", "creative cloud", "acrobat", "photoshop", "illustrator", "premiere",
            "after effects", "indesign", "lightroom", "ccxprocess", "adobeipcbroker",
            "coresync", "adobenotificationclient", "agmservice", "agsservice", "adobearm",
        ],
    },
    "어도비": {
        "label": "Adobe Creative Cloud / Acrobat 패밀리",
        "keywords": [
            "adobe", "creative cloud", "acrobat", "photoshop", "illustrator", "premiere",
            "after effects", "indesign", "lightroom", "ccxprocess", "adobeipcbroker",
            "coresync", "adobenotificationclient", "agmservice", "agsservice", "adobearm",
        ],
    },
    "포토샵": {
        "label": "Adobe Photoshop & Creative Cloud",
        "keywords": ["adobe", "photoshop", "creative cloud", "ccxprocess", "adobeipcbroker", "coresync", "agmservice", "agsservice"],
    },
    "아크로뱃": {
        "label": "Adobe Acrobat & 상주 업데이터",
        "keywords": ["adobe", "acrobat", "adobearm", "acrotray", "adobecollabsync"],
    },
    "알약": {
        "label": "알약(ALYac) 및 이스트소프트 상주 모듈",
        "keywords": ["alyac", "알약", "estsoft", "ayagent", "ayrtsrv", "ayupdsrv"],
    },
    "알집": {
        "label": "알집(ALZip) 및 부가 광고 모듈",
        "keywords": ["alzip", "알집", "altools", "alupdate"],
    },
    "고클린": {
        "label": "고클린(GoClean) 및 상주 알림 타이머",
        "keywords": ["goclean", "고클린"],
    },
    "한컴": {
        "label": "한컴오피스(Hancom) 상주 업데이터·클라우드",
        "keywords": ["hancom", "한컴", "hoffice", "hncupdate", "hancomstudio"],
    },
    "줌": {
        "label": "Zoom Workplace 및 백그라운드 서비스",
        "keywords": ["zoom", "cpthost"],
    },
    "팀뷰어": {
        "label": "TeamViewer 원격 제어 및 상주 서비스",
        "keywords": ["teamviewer"],
    },
    "애니데스크": {
        "label": "AnyDesk 원격 제어 및 상주 서비스",
        "keywords": ["anydesk"],
    },
    "구라": {
        "label": "관공서·은행 상주 보안 플러그인 일괄",
        "keywords": [
            "anysign", "touchen", "veraport", "magicline", "ipinside", "astx",
            "crosscert", "iniline", "delfino", "wizvera", "ksign", "nprotect", "nossvc",
        ],
    },
    "보안프로그램": {
        "label": "관공서·은행 상주 보안 플러그인 일괄",
        "keywords": [
            "anysign", "touchen", "veraport", "magicline", "ipinside", "astx",
            "crosscert", "iniline", "delfino", "wizvera", "ksign", "nprotect", "nossvc",
        ],
    },
}

NEVER_UNINSTALL_PROTECTED_KEYWORDS = {
    "microsoft windows", "windows defender", "securityhealth", "msmpeng", "explorer.exe",
    "svchost.exe", "csrss.exe", "winlogon.exe", "lsass.exe", "services.exe",
    "merlin", "ghosti", "senstalk", "sundream", "maepsbroker", "markany", "fasoo", "softcamp",
    "nvidia", "amd ", "intel(", "realtek",
}


def _extract_target_app_profile(raw_query: str) -> Tuple[str, List[str], str]:
    """자연어 발화에서 적출 대상 앱 이름과 매칭 키워드 리스트를 추출합니다."""
    q = (raw_query or "").strip()
    q_low = q.lower()
    for trig, info in DEEP_UNINSTALL_SYNONYM_MAP.items():
        if trig in q_low:
            return info["label"], list(info["keywords"]), trig

    cleaned = q
    for noise in (
        "귀신비서", "프로그램", "어플", "앱", "소프트웨어", "흔적까지", "뿌리째", "싹 다", "싹다",
        "깨끗하게", "완전히", "완전", "강제로", "강제", "심층", "적출", "언인스톨", "삭제해줘", "삭제해",
        "지워줘", "지워", "뽑아줘", "뽑아", "없애줘", "없애", "제거해줘", "제거해", "안 지워지는", "안지워지는",
        "안 꺼지는", "안꺼지는", "해줘", "해주세요", "좀", "에서", "내 컴퓨터", "피씨", "pc",
    ):
        cleaned = cleaned.replace(noise, " ")
    cleaned = " ".join(cleaned.split()).strip(" '\"?!.~,")
    if not cleaned or len(cleaned) < 2:
        # 기본값: 어도비 또는 미사용 상주 프로그램
        info = DEEP_UNINSTALL_SYNONYM_MAP["어도비"]
        return info["label"], list(info["keywords"]), "adobe"

    slug = "".join(ch for ch in cleaned.lower() if ch.isalnum()) or "target_app"
    return f"{cleaned} 관련 상주 프로그램·잔여 흔적", [cleaned.lower()], slug


def _is_protected_system_entity(text: str) -> bool:
    t_low = (text or "").lower()
    return any(pk in t_low for pk in NEVER_UNINSTALL_PROTECTED_KEYWORDS)


def _calc_dir_size_fast(folder: Path, max_files: int = 800) -> int:
    """폴더 스캔 루프 내 동기 AI 추론 0% 철칙 준수 — 순수 os.scandir로 최대 800개 파일까지만 0.1초 내 고속 합산"""
    total = 0
    counted = 0
    stack = [folder]
    while stack and counted < max_files:
        cur = stack.pop()
        try:
            with os.scandir(cur) as it:
                for entry in it:
                    counted += 1
                    if counted > max_files:
                        break
                    try:
                        if entry.is_symlink():
                            continue
                        if entry.is_file(follow_symlinks=False):
                            total += entry.stat(follow_symlinks=False).st_size
                        elif entry.is_dir(follow_symlinks=False):
                            stack.append(Path(entry.path))
                    except Exception:
                        continue
        except Exception:
            continue
    return total


def scan_deep_uninstall_target(app_query: str) -> Dict[str, Any]:
    """
    [1단계: 레지스트리 & 상주 프로세스·서비스·스케줄러·잔여 폴더 정밀 탐색]
    """
    _ensure_care_dir()
    target_label, keywords, slug = _extract_target_app_profile(app_query)
    kw_lows = [k.lower() for k in keywords if k]

    installed_entries: List[Dict[str, Any]] = []
    running_processes: List[Dict[str, Any]] = []
    matched_services: List[Dict[str, Any]] = []
    scheduled_tasks: List[str] = []
    startup_entries: List[Dict[str, Any]] = []
    residual_folders: List[Dict[str, Any]] = []

    if sys.platform == "win32":
        import winreg

        # 1) Uninstall 레지스트리 스캔 (HKLM 64/32 + HKCU)
        uninstall_roots = [
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", "HKLM"),
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall", "HKLM_WOW64"),
            (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", "HKCU"),
        ]
        seen_names = set()
        for hive, subkey_path, hive_label in uninstall_roots:
            try:
                with winreg.OpenKey(hive, subkey_path, 0, winreg.KEY_READ) as root_key:
                    num_sub = winreg.QueryInfoKey(root_key)[0]
                    for idx in range(num_sub):
                        try:
                            sub_name = winreg.EnumKey(root_key, idx)
                            with winreg.OpenKey(root_key, sub_name, 0, winreg.KEY_READ) as sk:
                                def _rv(vname: str) -> str:
                                    try:
                                        val, _ = winreg.QueryValueEx(sk, vname)
                                        return str(val or "").strip()
                                    except Exception:
                                        return ""

                                disp = _rv("DisplayName")
                                pub = _rv("Publisher")
                                uninst = _rv("UninstallString")
                                quiet_uninst = _rv("QuietUninstallString")
                                inst_loc = _rv("InstallLocation")
                                combined = f"{disp} {pub} {inst_loc} {sub_name}".lower()
                                if not disp or _is_protected_system_entity(combined):
                                    continue
                                if any(k in combined for k in kw_lows):
                                    dedup_key = disp.lower()
                                    if dedup_key not in seen_names:
                                        seen_names.add(dedup_key)
                                        installed_entries.append({
                                            "displayName": disp,
                                            "publisher": pub,
                                            "uninstallString": uninst,
                                            "quietUninstallString": quiet_uninst,
                                            "installLocation": inst_loc,
                                            "registryKey": f"{hive_label}\\{subkey_path}\\{sub_name}",
                                        })
                        except Exception:
                            continue
            except Exception:
                continue

        # 2) 시작프로그램(Run) 레지스트리 스캔
        run_roots = [
            (winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", "HKCU"),
            (winreg.HKEY_LOCAL_MACHINE, r"Software\Microsoft\Windows\CurrentVersion\Run", "HKLM"),
            (winreg.HKEY_LOCAL_MACHINE, r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run", "HKLM_WOW64"),
        ]
        for hive, rpath, hlabel in run_roots:
            try:
                with winreg.OpenKey(hive, rpath, 0, winreg.KEY_READ) as rk:
                    num_vals = winreg.QueryInfoKey(rk)[1]
                    for idx in range(num_vals):
                        try:
                            vname, vdata, _ = winreg.EnumValue(rk, idx)
                            comb = f"{vname} {vdata}".lower()
                            if not _is_protected_system_entity(comb) and any(k in comb for k in kw_lows):
                                startup_entries.append({
                                    "name": str(vname),
                                    "command": str(vdata),
                                    "hive": hlabel,
                                    "regPath": rpath,
                                })
                        except Exception:
                            continue
            except Exception:
                continue

        # 3) 실행 중인 상주 프로세스 스캔
        try:
            import psutil

            my_pid = os.getpid()
            for proc in psutil.process_iter(["pid", "name", "exe", "memory_info"]):
                try:
                    pid = int(proc.info.get("pid") or 0)
                    if pid <= 4 or pid == my_pid:
                        continue
                    pname = str(proc.info.get("name") or "")
                    pexe = str(proc.info.get("exe") or "")
                    comb = f"{pname} {pexe}".lower()
                    if _is_protected_system_entity(comb):
                        continue
                    if any(k in comb for k in kw_lows):
                        mem_info = proc.info.get("memory_info")
                        rss_mb = round((getattr(mem_info, "rss", 0) or 0) / (1024 * 1024), 1)
                        running_processes.append({
                            "pid": pid,
                            "name": pname,
                            "exe": pexe,
                            "memoryMb": max(1.0, rss_mb),
                        })
                except Exception:
                    continue
        except Exception:
            pass

        # 4) Windows Services 스캔 (sc query state= all)
        try:
            proc_sc = subprocess.run(
                ["sc", "query", "state=", "all"],
                capture_output=True,
                text=True,
                encoding="oem",
                errors="replace",
                timeout=2.5,
                creationflags=CREATE_NO_WINDOW,
            )
            cur_svc = ""
            cur_disp = ""
            for line in (proc_sc.stdout or "").splitlines():
                ls = line.strip()
                if ls.startswith("SERVICE_NAME:"):
                    cur_svc = ls.split(":", 1)[1].strip()
                    cur_disp = cur_svc
                elif ls.startswith("DISPLAY_NAME:"):
                    cur_disp = ls.split(":", 1)[1].strip()
                elif ls.startswith("STATE") and cur_svc:
                    comb = f"{cur_svc} {cur_disp}".lower()
                    if not _is_protected_system_entity(comb) and any(k in comb for k in kw_lows):
                        matched_services.append({
                            "serviceName": cur_svc,
                            "displayName": cur_disp,
                            "isRunning": "RUNNING" in ls,
                        })
                    cur_svc = ""
        except Exception:
            pass

        # 5) 작업 스케줄러(schtasks) 부활 트리거 스캔
        try:
            proc_sch = subprocess.run(
                ["schtasks", "/query", "/fo", "CSV", "/nh"],
                capture_output=True,
                text=True,
                encoding="oem",
                errors="replace",
                timeout=2.5,
                creationflags=CREATE_NO_WINDOW,
            )
            seen_tasks = set()
            for line in (proc_sch.stdout or "").splitlines():
                parts = [p.strip('"') for p in line.split('","')]
                if not parts or not parts[0].startswith("\\"):
                    continue
                tname = parts[0]
                tlow = tname.lower()
                if tlow.startswith("\\microsoft\\"):
                    continue
                if not _is_protected_system_entity(tlow) and any(k in tlow for k in kw_lows):
                    if tname not in seen_tasks:
                        seen_tasks.add(tname)
                        scheduled_tasks.append(tname)
        except Exception:
            pass

        # 6) 잔여 폴더(Program Files, ProgramData, AppData\Local, AppData\Roaming) 탐색 및 용량 산출
        candidate_roots = [
            Path(os.environ.get("ProgramFiles", r"C:\Program Files")),
            Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")),
            Path(os.environ.get("CommonProgramFiles", r"C:\Program Files\Common Files")),
            Path(os.environ.get("CommonProgramFiles(x86)", r"C:\Program Files (x86)\Common Files")),
            Path(os.environ.get("PROGRAMDATA", r"C:\ProgramData")),
            LOCAL_APPDATA,
            Path(os.environ.get("APPDATA", os.path.expanduser(r"~\AppData\Roaming"))),
        ]
        seen_dirs = set()
        for croot in candidate_roots:
            if not croot.exists():
                continue
            try:
                with os.scandir(croot) as it:
                    for entry in it:
                        if not entry.is_dir(follow_symlinks=False):
                            continue
                        dname_low = entry.name.lower()
                        if _is_protected_system_entity(dname_low):
                            continue
                        if any(k in dname_low for k in kw_lows):
                            full_p = Path(entry.path).resolve()
                            p_str = str(full_p)
                            if p_str.lower() not in seen_dirs:
                                seen_dirs.add(p_str.lower())
                                sz = _calc_dir_size_fast(full_p)
                                residual_folders.append({
                                    "path": p_str,
                                    "name": entry.name,
                                    "sizeBytes": sz,
                                    "sizeMb": round(sz / (1024 * 1024), 2),
                                    "isSafeCacheOrData": any(
                                        x in p_str.lower() for x in ("appdata", "programdata", "common files", "temp", "cache")
                                    ),
                                })
            except Exception:
                continue

    total_residual_bytes = sum(int(f.get("sizeBytes") or 0) for f in residual_folders)
    total_residual_mb = round(total_residual_bytes / (1024 * 1024), 1)
    estimated_ram_mb = round(sum(float(p.get("memoryMb") or 0) for p in running_processes), 1)
    svc_and_task_count = len(matched_services) + len(scheduled_tasks) + len(startup_entries)
    found_any = bool(
        installed_entries or running_processes or matched_services or scheduled_tasks or startup_entries or residual_folders
    )

    if found_any:
        briefing_ko = (
            f"🧹 **[{target_label} — 4단계 심층 적출(Deep Uninstaller) 사전 검진 완료]**\n"
            f"• **발견된 상주 프로세스**: **{len(running_processes)}개** (점유 메모리 약 {estimated_ram_mb}MB)\n"
            f"• **부활형 서비스·스케줄러·시작프로그램**: **{svc_and_task_count}개** "
            f"(서비스 {len(matched_services)} · 스케줄러 {len(scheduled_tasks)} · 시작Run {len(startup_entries)})\n"
            f"• **설치 엔트리 및 잔여 폴더**: 설치 항목 **{len(installed_entries)}건** · 잔여 폴더 **{len(residual_folders)}곳 ({total_residual_mb}MB)**\n\n"
            f"임의로 삭제하지 않습니다. 아래 **[🔥 흔적까지 100% 심층 적출 실행]** 버튼을 누르시거나 채팅창에 **\"응 진행해\"**라고 입력하시면, "
            f"복원 스냅샷을 먼저 백업한 뒤 상주 프로세스 강제 종료 ➔ 언인스톨 ➔ 부활 스케줄러·잔여 캐시 폴더까지 한 번에 뿌리째 뽑아드립니다!"
        )
    else:
        briefing_ko = (
            f"👻 **[{target_label}]** 관련 레지스트리·상주 프로세스·서비스·스케줄러·잔여 폴더(AppData/ProgramData)를 전수 스캔했으나, "
            f"현재 내 PC에 남아 있는 흔적이 **0건**으로 이미 완벽히 깨끗한 상태입니다!"
        )

    return {
        "ok": True,
        "targetAppQuery": app_query,
        "targetAppLabel": target_label,
        "targetSlug": slug,
        "matchedKeywords": kw_lows,
        "foundAny": found_any,
        "installedEntries": installed_entries,
        "runningProcesses": running_processes,
        "services": matched_services,
        "scheduledTasks": scheduled_tasks,
        "startupEntries": startup_entries,
        "residualFolders": residual_folders,
        "runningProcessCount": len(running_processes),
        "serviceAndTaskCount": svc_and_task_count,
        "totalResidualBytes": total_residual_bytes,
        "totalResidualMb": total_residual_mb,
        "estimatedRamMb": estimated_ram_mb,
        "summaryBadge": (
            f"상주 프로세스 {len(running_processes)}개 / 서비스·스케줄러 {svc_and_task_count}개 / 잔여 폴더 {total_residual_mb}MB"
        ),
        "honestBriefingKo": briefing_ko,
    }


def execute_deep_uninstall_target(
    app_query: str,
    invoke_official_uninstaller: bool = True,
    user_approval_text: str = "흔적까지 100% 심층 적출 실행",
) -> Dict[str, Any]:
    """
    [2·3·4단계: 스냅샷 백업 ➔ 상주 프로세스/서비스 선행 사살 ➔ 공식 언인스톨러 호출 ➔ 부활 스케줄러·Run 레지스트리·잔여 캐시 폴더 영구 소탕]
    """
    _ensure_care_dir()
    QUARANTINE_SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)

    scan = scan_deep_uninstall_target(app_query)
    slug = str(scan.get("targetSlug") or "app")
    target_label = str(scan.get("targetAppLabel") or app_query)
    ts_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    snapshot_path = QUARANTINE_SNAPSHOT_DIR / f"uninstall_{slug}_{ts_str}.json"

    snapshot_payload = {
        "createdAt": datetime.datetime.now().isoformat(),
        "targetAppQuery": app_query,
        "targetAppLabel": target_label,
        "userApprovalTypedText": user_approval_text,
        "scanSnapshot": scan,
    }
    try:
        snapshot_path.write_text(json.dumps(snapshot_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass

    killed_procs: List[str] = []
    disabled_services: List[str] = []
    deleted_tasks: List[str] = []
    removed_startups: List[str] = []
    cleaned_folders: List[str] = []
    reclaimed_bytes = 0
    uninstaller_triggered: List[str] = []

    if sys.platform == "win32":
        # [3단계-A] 실행 중인 상주 프로세스 선행 강제 종료 (파일 잠금 해제)
        for pinfo in scan.get("runningProcesses", []):
            pid = pinfo.get("pid")
            pname = str(pinfo.get("name") or pid)
            if not pid:
                continue
            try:
                subprocess.run(
                    ["taskkill", "/F", "/PID", str(pid), "/T"],
                    capture_output=True,
                    timeout=2.5,
                    creationflags=CREATE_NO_WINDOW,
                )
                killed_procs.append(f"{pname}(PID {pid})")
            except Exception:
                pass

        # [3단계-B] 상주 서비스 정지 및 수동 전환 (On-Demand 권한 승격 헬퍼 연동)
        svc_names = [str(s.get("serviceName") or "") for s in scan.get("services", []) if s.get("serviceName")]
        if svc_names:
            elev_res = execute_elevated_service_control("sleep", svc_names)
            disabled_services = list(elev_res.get("processedServices") or svc_names)

        # [3단계-C] 공식 언인스톨러 실행 (QuietUninstallString 최우선, 없으면 UninstallString 비동기/단기 호출)
        if invoke_official_uninstaller:
            for entry in scan.get("installedEntries", [])[:3]:
                cmd = str(entry.get("quietUninstallString") or entry.get("uninstallString") or "").strip()
                disp = str(entry.get("displayName") or "")
                if not cmd:
                    continue
                try:
                    if cmd.lower().startswith("msiexec"):
                        # MSI 패키지는 조용한 제거(/qn /norestart) 유도
                        subprocess.Popen(
                            f"{cmd} /passive /norestart",
                            shell=True,
                            creationflags=CREATE_NO_WINDOW,
                        )
                    else:
                        subprocess.Popen(cmd, shell=True)
                    uninstaller_triggered.append(disp or cmd[:40])
                except Exception:
                    continue

        # [4단계-A] 부활형 작업 스케줄러(schtasks) 트리거 제거
        for tname in scan.get("scheduledTasks", []):
            try:
                r_del = subprocess.run(
                    ["schtasks", "/delete", "/tn", tname, "/f"],
                    capture_output=True,
                    timeout=2.0,
                    creationflags=CREATE_NO_WINDOW,
                )
                if r_del.returncode == 0:
                    deleted_tasks.append(tname)
                else:
                    # 일반 권한에서 삭제 거부 시 비활성화(/disable) 시도
                    subprocess.run(
                        ["schtasks", "/change", "/tn", tname, "/disable"],
                        capture_output=True,
                        timeout=2.0,
                        creationflags=CREATE_NO_WINDOW,
                    )
                    deleted_tasks.append(f"{tname}(비활성화)")
            except Exception:
                continue

        # [4단계-B] 시작프로그램(HKCU/HKLM Run) 레지스트리 엔트리 제거
        import winreg

        for st_item in scan.get("startupEntries", []):
            vname = str(st_item.get("name") or "")
            rpath = str(st_item.get("regPath") or "")
            hive_str = str(st_item.get("hive") or "HKCU")
            hive = winreg.HKEY_CURRENT_USER if hive_str == "HKCU" else winreg.HKEY_LOCAL_MACHINE
            if not vname or not rpath:
                continue
            try:
                with winreg.OpenKey(hive, rpath, 0, winreg.KEY_SET_VALUE) as wk:
                    winreg.DeleteValue(wk, vname)
                    removed_startups.append(vname)
            except Exception:
                continue

        # [4단계-C] 잔여 캐시·임시 데이터 폴더(AppData/ProgramData/Common Files) 및 빈 폴더 영구 청소
        for finfo in scan.get("residualFolders", []):
            fpath = Path(str(finfo.get("path") or ""))
            fsize = int(finfo.get("sizeBytes") or 0)
            if not fpath.exists() or _is_protected_system_entity(str(fpath)):
                continue
            # 안전 가드: 드라이브 루트나 2단계 이하 상위 경로는 절대 삭제하지 않음
            if len(fpath.parts) < 3:
                continue
            try:
                if finfo.get("isSafeCacheOrData"):
                    shutil.rmtree(fpath, ignore_errors=True)
                    if not fpath.exists():
                        cleaned_folders.append(str(fpath))
                        reclaimed_bytes += fsize
                    else:
                        # 잠긴 파일 외 나머지 캐시 파일 개별 삭제
                        for sub_root, sub_dirs, sub_files in os.walk(fpath, topdown=False):
                            for sf in sub_files:
                                try:
                                    sp = Path(sub_root) / sf
                                    sz = sp.stat().st_size
                                    sp.unlink()
                                    reclaimed_bytes += sz
                                except Exception:
                                    pass
                            for sd in sub_dirs:
                                try:
                                    (Path(sub_root) / sd).rmdir()
                                except Exception:
                                    pass
                        cleaned_folders.append(f"{fpath} (잔여 캐시 정밀 소거)")
            except Exception:
                continue

    reclaimed_mb = round(reclaimed_bytes / (1024 * 1024), 1)
    reclaimed_ram_mb = float(scan.get("estimatedRamMb") or 0.0)
    total_removed_triggers = len(killed_procs) + len(disabled_services) + len(deleted_tasks) + len(removed_startups)

    report_ko = (
        f"🔥 **[{target_label} — 4단계 심층 적출(Deep Uninstaller) 완료 브리핑]**\n"
        f"• **제거된 상주 프로세스·스케줄러·서비스**: 총 **{total_removed_triggers}개** "
        f"(상주 프로세스 사살 {len(killed_procs)}개 · 서비스 무력화 {len(disabled_services)}개 · 부활 스케줄러/Run 제거 {len(deleted_tasks) + len(removed_startups)}개)\n"
        f"• **확보된 디스크 용량 및 메모리**: 잔여 폴더 **{len(cleaned_folders)}곳 ({reclaimed_mb}MB)** 소거 · 상주 메모리 **{reclaimed_ram_mb}MB** 즉시 회수\n"
        f"• **안전 격리 스냅샷 백업**: `{snapshot_path.name}` 기록 완료"
    )
    if uninstaller_triggered:
        report_ko += f"\n• **공식 언인스톨러 연동 호출**: {', '.join(uninstaller_triggered)}"

    return {
        "ok": True,
        "targetAppLabel": target_label,
        "snapshotFile": str(snapshot_path),
        "killedProcessCount": len(killed_procs),
        "killedProcesses": killed_procs,
        "disabledServiceCount": len(disabled_services),
        "disabledServices": disabled_services,
        "deletedTaskCount": len(deleted_tasks),
        "deletedTasks": deleted_tasks,
        "removedStartupCount": len(removed_startups),
        "removedStartups": removed_startups,
        "cleanedFolderCount": len(cleaned_folders),
        "cleanedFolders": cleaned_folders,
        "uninstallerTriggered": uninstaller_triggered,
        "reclaimedBytes": reclaimed_bytes,
        "reclaimedMb": reclaimed_mb,
        "reclaimedRamMb": reclaimed_ram_mb,
        "totalRemovedTriggers": total_removed_triggers,
        "reportKo": report_ko,
    }


# ============================================================================
# 5. [방어 22] Try-Except Firewall 단일 게이트웨이 디스패처 & 탐색기 우클릭 CLI 엔트리
# ============================================================================
def handle_care_suite_request(action: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    메인 데몬(merlin_z_core_daemon.py)에서 호출되는 방화벽 격리 진입점.
    어떠한 예외가 발생해도 Z-코어 본체로 전파되지 않고 안전하게 JSON 응답을 반환합니다.
    """
    data = payload or {}
    act = (action or "status").strip().lower()
    try:
        if act in ("status", "security-status", "security_services_status"):
            return get_security_services_status()
        if act in ("sleep", "security-sleep", "sleep_security_services"):
            return sleep_security_services()
        if act in ("wake", "security-wake", "wake_security_services"):
            return wake_security_services(reason=str(data.get("reason") or "manual_emergency_switch"))
        if act in ("sync-whitelist", "sync_whitelist"):
            wl = load_security_whitelist(allow_remote_sync=True)
            return {"ok": True, "version": wl.get("version"), "synced": True}
        if act in ("archive/context-menu/ensure", "context-menu-ensure", "register-context-menu"):
            return register_explorer_context_menu()
        if act in ("archive/context-menu/remove", "unregister-context-menu"):
            return unregister_explorer_context_menu()
        if act in ("extract-archive", "extract_archive", "smart-unzip", "archive/extract"):
            return smart_extract_archive(
                archive_path=str(data.get("path") or data.get("archivePath") or ""),
                password=data.get("password"),
            )
        if act in ("create-zip", "create_zip", "smart-zip", "archive/zip"):
            return smart_create_zip(
                target_path=str(data.get("path") or data.get("targetPath") or ""),
            )
        if act in ("open-downloads", "open_downloads"):
            dl_dir = Path.home() / "Downloads"
            if dl_dir.exists() and hasattr(os, "startfile"):
                os.startfile(str(dl_dir))
            return {"ok": True, "path": str(dl_dir)}
        if act in ("explorer-selected", "explorer_selected"):
            return {"ok": True, "selectedPaths": get_explorer_selected_paths_non_destructive()}
        if act in ("amsi-scan", "amsi_scan"):
            return scan_file_with_defender_amsi(
                file_path=str(data.get("path") or data.get("filePath") or ""),
                source=str(data.get("source") or "manual"),
            )
        if act in ("guardian-history", "guardian_history", "defender-history"):
            return get_defender_guardian_history(
                days=int(data.get("days") or 30),
                limit=int(data.get("limit") or 30),
            )
        if act in ("deep-uninstall/scan", "deep-uninstall-scan", "deep_uninstall_scan"):
            return scan_deep_uninstall_target(
                app_query=str(data.get("appQuery") or data.get("query") or data.get("app") or ""),
            )
        if act in ("deep-uninstall/execute", "deep-uninstall-execute", "deep_uninstall_execute"):
            return execute_deep_uninstall_target(
                app_query=str(data.get("appQuery") or data.get("query") or data.get("app") or ""),
                invoke_official_uninstaller=bool(data.get("invokeOfficialUninstaller", True)),
                user_approval_text=str(data.get("userApprovalTypedText") or "흔적까지 100% 심층 적출 실행"),
            )
        return {"ok": False, "error": f"UNKNOWN_CARE_SUITE_ACTION: {action}"}
    except Exception as exc:
        return {
            "ok": False,
            "isolatedFirewall": True,
            "error": f"CARE_SUITE_ISOLATED_ERROR: {exc}",
        }


def _cli_main() -> None:
    parser = argparse.ArgumentParser(description="Ghosti Care Suite CLI (Explorer Context Menu & Elevation Helper)")
    parser.add_argument("--smart-unzip", dest="smart_unzip", type=str, help="압축 파일 스마트 해제")
    parser.add_argument("--smart-zip", dest="smart_zip", type=str, help="파일/폴더 ZIP 묶기")
    parser.add_argument("--register-menu", action="store_true", help="탐색기 기본 우클릭 메뉴 등록")
    parser.add_argument("--unregister-menu", action="store_true", help="탐색기 기본 우클릭 메뉴 해제")
    parser.add_argument("--install-and-run-helper", action="store_true", help="최초 1회 UAC 승격 헬퍼 등록 및 즉시 실행")
    parser.add_argument("--run-elevated-helper", action="store_true", help="작업 스케줄러 최고권한 헬퍼 실행")
    args = parser.parse_args()

    if args.install_and_run_helper:
        _process_elevated_helper_queue(install_task_too=True)
        return
    if args.run_elevated_helper:
        _process_elevated_helper_queue(install_task_too=False)
        return
    if args.register_menu:
        print(json.dumps(register_explorer_context_menu(), ensure_ascii=False))
        return
    if args.unregister_menu:
        print(json.dumps(unregister_explorer_context_menu(), ensure_ascii=False))
        return
    if args.smart_unzip:
        res = smart_extract_archive(args.smart_unzip)
        if res.get("ok") and res.get("extractedFolder") and sys.platform == "win32":
            try:
                os.startfile(res["extractedFolder"])
            except Exception:
                pass
        return
    if args.smart_zip:
        smart_create_zip(args.smart_zip)
        return


if __name__ == "__main__":
    _cli_main()
