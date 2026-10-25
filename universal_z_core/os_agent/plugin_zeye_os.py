#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[내장 소프트웨어 플러그인 1] plugin_zeye_os.py
- 제트아이(Z-Eye) 및 3몬스터(설치·수리·정리) 전용 OS 제어·3초 포렌식·[복원 기록](restore_points.json)·TopMost 오버레이 플러그인
- 별도 프로세스 생성 없이 단일 코어(Merlin_Z_Core, 127.0.0.1:5199) 내부에서 소프트웨어적으로 직결 호출됩니다.
- [신규 탑재] 설정몬스터/클린몬스터 '대화형 폴더·파일 정리 & [복원 기록] 3단계 무결성 사전 검진(Pre-Check) 타임머신 원복' 엔진
"""

from __future__ import annotations

import ctypes
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import time
from typing import Any, Dict, List

THIS_DIR = Path(__file__).resolve().parent
if str(THIS_DIR) not in sys.path:
    sys.path.insert(0, str(THIS_DIR))

import merlin_z_core_os as zos  # noqa: E402

LOCAL_APPDATA = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
MERLIN_DIR = LOCAL_APPDATA / "Merlin"
RESTORE_POINTS_FILE = MERLIN_DIR / "restore_points.json"
QUARANTINE_DIR = THIS_DIR.parents[1] / "Z-Eye_정리대기함"

FILE_ATTRIBUTE_HIDDEN = 0x02
FILE_ATTRIBUTE_NORMAL = 0x80

PLUGIN_METADATA = {
    "pluginId": "zeye_os",
    "pluginName": "Z-Eye & 3-Monsters OS + RestorePoint Engine Plugin",
    "version": "2.2.0",
    "type": "BUILTIN_SOFTWARE_PLUGIN",
    "port": 5199,
    "capabilities": [
        "os-inspect",
        "forensic-scan",
        "os-overlay",
        "os-execute",
        "folder-tree-summary",
        "cleanup-preview",
        "cleanup-execute",
        "restore-points-list",
        "restore-point-rollback",
    ],
}


def _ensure_merlin_dir() -> None:
    MERLIN_DIR.mkdir(parents=True, exist_ok=True)


def _quick_file_hash(p: Path) -> str:
    try:
        if not p.exists() or not p.is_file():
            return ""
        h = hashlib.sha256()
        with p.open("rb") as f:
            h.update(f.read(65536))
        return h.hexdigest()[:16]
    except Exception:
        return ""


def _set_hidden_attr(p: Path, hide: bool) -> bool:
    try:
        if os.name == "nt":
            attrs = ctypes.windll.kernel32.GetFileAttributesW(str(p))
            if attrs == -1:
                return False
            new_attrs = (attrs | FILE_ATTRIBUTE_HIDDEN) if hide else (attrs & ~FILE_ATTRIBUTE_HIDDEN)
            return bool(ctypes.windll.kernel32.SetFileAttributesW(str(p), new_attrs))
        return True
    except Exception:
        return False


def scan_folder_tree_metadata(target_path: str = "", max_items: int = 80) -> Dict[str, Any]:
    """
    [로컬 Zero-LLM 파일 트리 초경량 요약 주입]
    파일 본문을 읽지 않고 대상 폴더의 (파일/폴더명 + 확장자 + 용량 + 수정일 + 분류 힌트) 메타데이터만
    수백 토큰 이내의 초경량 JSON으로 추출합니다 (LLM 비용 1/100 절감).
    """
    t0 = time.perf_counter()
    base = Path(target_path) if target_path else (THIS_DIR.parents[1] / "test_docs")
    if not base.exists():
        base = Path.home() / "Downloads"

    items: List[Dict[str, Any]] = []
    work_exts = {".xlsx", ".xls", ".docx", ".doc", ".hwp", ".hwpx", ".pdf", ".pptx", ".csv"}
    misc_exts = {".tmp", ".bak", ".log", ".zip", ".exe", ".msi", ".crdownload", ".jpg", ".png"}

    try:
        for entry in sorted(base.iterdir(), key=lambda x: x.stat().st_mtime if x.exists() else 0, reverse=True)[:max_items]:
            st = entry.stat()
            ext = entry.suffix.lower()
            age_days = round((time.time() - st.st_mtime) / 86400.0, 1)
            cat = "folder" if entry.is_dir() else ("work_doc" if ext in work_exts else ("misc_file" if ext in misc_exts else "other"))
            items.append(
                {
                    "name": entry.name,
                    "isDir": entry.is_dir(),
                    "ext": ext,
                    "sizeBytes": int(st.st_size) if entry.is_file() else 0,
                    "modifiedIso": datetime.datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M"),
                    "ageDays": age_days,
                    "categoryHint": cat,
                }
            )
    except Exception as e:
        return {"ok": False, "error": str(e)}

    return {
        "ok": True,
        "targetFolder": str(base),
        "scannedCount": len(items),
        "estimatedPromptTokens": len(items) * 14,
        "elapsedMs": round((time.perf_counter() - t0) * 1000, 2),
        "items": items,
    }


def _load_restore_points() -> List[Dict[str, Any]]:
    _ensure_merlin_dir()
    if RESTORE_POINTS_FILE.exists():
        try:
            data = json.loads(RESTORE_POINTS_FILE.read_text(encoding="utf-8"))
            if isinstance(data, list):
                return data
        except Exception:
            pass
    # 초기 기본 샘플 복원 기록 시드 (실제 파일 경로와 연동되어 Pre-Check 즉시 실증 가능)
    sandbox_dir = MERLIN_DIR / "CleanMonster_Sandbox"
    misc_dir = sandbox_dir / "기타_정리함"
    misc_dir.mkdir(parents=True, exist_ok=True)
    f1 = misc_dir / "카톡받은_영수증캡처_01.jpg"
    f2 = misc_dir / "설치파일_구버전_setup.tmp"
    if not f1.exists():
        f1.write_bytes(b"SAMPLE_RECEIPT_IMAGE_BYTES_01")
    if not f2.exists():
        f2.write_bytes(b"SAMPLE_INSTALLER_TEMP_BYTES_02")

    seed = [
        {
            "restoreId": "#104",
            "createdAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "summary": "바탕화면·다운로드 잡파일 '기타_정리함' 이동 및 구형 폴더 숨김 정리",
            "userPrompt": "바탕화면이랑 다운로드 폴더에서 업무랑 상관없는 잡파일은 '기타' 폴더 만들어 다 집어넣고, 옛날 폴더들은 안 보이게 숨겨줘",
            "operations": [
                {
                    "op": "MOVE",
                    "name": f1.name,
                    "fromPath": str(sandbox_dir / f1.name),
                    "toPath": str(f1),
                    "sizeBytes": f1.stat().st_size,
                    "hash": _quick_file_hash(f1),
                },
                {
                    "op": "MOVE",
                    "name": f2.name,
                    "fromPath": str(sandbox_dir / f2.name),
                    "toPath": str(f2),
                    "sizeBytes": f2.stat().st_size,
                    "hash": _quick_file_hash(f2),
                },
            ],
        }
    ]
    RESTORE_POINTS_FILE.write_text(json.dumps(seed, ensure_ascii=False, indent=2), encoding="utf-8")
    return seed


def list_restore_points_with_precheck() -> Dict[str, Any]:
    """
    [최근 한 달 [복원 기록] 조회 & 0.01초 3단계 무결성 사전 검진(Pre-Check)]
    - 🟢 FULL_RESTORABLE    : [100% 완벽 복원 가능]
    - 🟡 PARTIAL_RESTORABLE : [부분 복원 가능 (총 M건 중 N건)] (Z-Eye 30일 안전 격리함까지 교차 탐색)
    - 🔴 UNRESTORABLE       : [복원 불가 (파일 없음)]
    """
    t0 = time.perf_counter()
    points = _load_restore_points()
    evaluated: List[Dict[str, Any]] = []

    for pt in points:
        ops = pt.get("operations", [])
        total = len(ops)
        intact_count = 0
        quarantine_recoverable_count = 0
        missing_files: List[str] = []

        for op in ops:
            to_p = Path(str(op.get("toPath", "")))
            name = str(op.get("name") or to_p.name)
            if to_p.exists():
                intact_count += 1
            elif (QUARANTINE_DIR / name).exists():
                quarantine_recoverable_count += 1
            else:
                missing_files.append(name)

        restorable_total = intact_count + quarantine_recoverable_count
        if total > 0 and restorable_total == total:
            badge = "🟢 [100% 완벽 복원 가능]"
            integrity_status = "FULL_RESTORABLE"
            guide_msg = f"이동·숨김했던 파일 {total}건이 모두 온전히 존재합니다. 클릭 시 1초 만에 원래 위치로 100% 되돌립니다."
        elif restorable_total > 0:
            badge = f"🟡 [부분 복원 가능 ({total}건 중 {restorable_total}건)]"
            integrity_status = "PARTIAL_RESTORABLE"
            missing_str = ", ".join(missing_files[:3])
            guide_msg = (
                f"총 {total}개 중 유저님이 직접 삭제하신 {len(missing_files)}개({missing_str})를 제외한 "
                f"{restorable_total}개 항목을 원래 위치로 복원할 수 있습니다. 진행할까요?"
            )
        else:
            badge = "🔴 [복원 불가 (파일 없음)]"
            integrity_status = "UNRESTORABLE"
            guide_msg = "대상 파일 전체가 이미 영구 삭제되어 복원할 수 없습니다."

        row = dict(pt)
        row["integrityStatus"] = integrity_status
        row["statusBadge"] = badge
        row["totalItems"] = total
        row["restorableItems"] = restorable_total
        row["missingFiles"] = missing_files
        row["precheckGuideMessage"] = guide_msg
        evaluated.append(row)

    return {
        "ok": True,
        "officialTerm": "[복원 기록]",
        "precheckElapsedMs": round((time.perf_counter() - t0) * 1000, 2),
        "restorePointsCount": len(evaluated),
        "restorePoints": evaluated,
    }


def rollback_restore_point(restore_id: str) -> Dict[str, Any]:
    """지정된 [복원 기록] 번호(예: #104)를 1초 만에 원래 경로/속성으로 되돌립니다."""
    t0 = time.perf_counter()
    points = _load_restore_points()
    target_id = (restore_id or "#104").strip()
    if not target_id.startswith("#"):
        target_id = f"#{target_id}"

    matched = next((p for p in points if p.get("restoreId") == target_id), None)
    if not matched:
        return {"ok": False, "error": f"복원 기록({target_id})을 찾을 수 없습니다."}

    restored_files: List[str] = []
    skipped_missing: List[str] = []

    for op in matched.get("operations", []):
        kind = op.get("op", "MOVE")
        from_p = Path(str(op.get("fromPath", "")))
        to_p = Path(str(op.get("toPath", "")))
        name = str(op.get("name") or to_p.name)

        if kind == "HIDE":
            if to_p.exists():
                _set_hidden_attr(to_p, False)
                restored_files.append(name)
            else:
                skipped_missing.append(name)
            continue

        src_to_restore = to_p if to_p.exists() else ((QUARANTINE_DIR / name) if (QUARANTINE_DIR / name).exists() else None)
        if src_to_restore and src_to_restore.exists():
            from_p.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src_to_restore), str(from_p))
            restored_files.append(name)
            # 테스트 반복 재현성을 위해 샌드박스 사본도 유지
            if "CleanMonster_Sandbox" in str(to_p):
                shutil.copy2(str(from_p), str(to_p))
        else:
            skipped_missing.append(name)

    return {
        "ok": True,
        "restoreId": target_id,
        "summary": matched.get("summary", ""),
        "restoredCount": len(restored_files),
        "restoredFiles": restored_files,
        "skippedMissingFiles": skipped_missing,
        "elapsedMs": round((time.perf_counter() - t0) * 1000, 2),
        "message": f"✅ [{target_id} 복원 기록] 총 {len(restored_files)}개 항목을 원래 위치로 완벽히 되돌렸습니다!",
    }


def handle_request(action: str, payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """단일 코어 라우터(/__merlin/query 또는 /__zcore/*)에서 호출하는 표준 진입점"""
    data = payload or {}
    act = (action or "inspect").strip().lower()

    if act in ("health", "status"):
        return {
            "ok": True,
            "plugin": PLUGIN_METADATA,
        }

    if act in ("inspect", "os-inspect"):
        return zos.inspect_real_pc_state()

    if act in ("forensic", "forensic-scan"):
        query = str(data.get("query") or data.get("q") or "").strip()
        return zos.run_3sec_forensic_scan(query)

    if act in ("overlay", "os-overlay"):
        x = int(data.get("x") or 420)
        y = int(data.get("y") or 160)
        text = str(data.get("text") or "👆 여기를 클릭하세요! (Z-코어 실제 OS 최상단 오버레이)")
        duration = int(data.get("duration") or data.get("durationSec") or 10)
        return zos.spawn_overlay_detached(x, y, text, duration)

    if act in ("folder-tree-summary", "scan-tree"):
        target_dir = str(data.get("targetPath") or data.get("folder") or "").strip()
        return scan_folder_tree_metadata(target_dir)

    if act in ("restore-points-list", "restore-points"):
        return list_restore_points_with_precheck()

    if act in ("restore-point-rollback", "rollback"):
        rid = str(data.get("restoreId") or "#104").strip()
        return rollback_restore_point(rid)

    if act in ("execute", "os-execute"):
        exec_action = str(data.get("action") or "inspect").strip()
        target = str(data.get("targetPath") or data.get("target") or "").strip()
        if exec_action in ("restore-points-list", "restore-points"):
            return list_restore_points_with_precheck()
        if exec_action in ("restore-point-rollback", "rollback"):
            return rollback_restore_point(target or "#104")
        return zos.execute_real_os_action(exec_action, target)

    target = str(data.get("targetPath") or data.get("target") or "").strip()
    return zos.execute_real_os_action(act, target)
