#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[창 3 전담 플러그인 슬롯] plugin_paid_work_sdrive.py
- 담당 트랙: D:\\Ghosti_Work (git branch: track/paid-work)
- 담당 도메인:
  1) 💼 업무 공유 (월 9,900~29,000원): 팀 공용 가상 S: 네트워크 드라이브 마운트·상태 점검
  2) 📋 팀 공용 상용구(F1~F6) 및 부서 공용 서류함 권한 동기화
- 헌법 가드레일: 본 플러그인 내부에 ONNX/AI 모델(InferenceSession 등) 직접 로드 영구 금지.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict

WORK_SDRIVE_ACTIONS = {
    "paid-work-status",
    "sdrive-status",
    "sdrive-check-mount",
}


def inspect_s_drive_status(drive_letter: str = "S:") -> Dict[str, Any]:
    clean_letter = (drive_letter or "S:").strip().rstrip("\\/")
    if not clean_letter.endswith(":"):
        clean_letter = f"{clean_letter[0].upper()}:"
    mount_root = Path(f"{clean_letter}\\")
    mounted = False
    try:
        mounted = os.path.exists(str(mount_root))
    except Exception:
        mounted = False
    return {
        "ok": True,
        "track": "paid-work",
        "driveLetter": clean_letter,
        "mounted": mounted,
    }


def handle_action(act: str, data: Dict[str, Any]) -> Dict[str, Any] | None:
    """plugin_ghosti_os 라우터에서 위임받아 창 3 전용 액션을 처리합니다."""
    if act not in WORK_SDRIVE_ACTIONS and not act.startswith(("paid-work-", "sdrive-")):
        return None

    letter = str(data.get("driveLetter") or "S:")
    if act in ("paid-work-status", "sdrive-status", "sdrive-check-mount"):
        return inspect_s_drive_status(letter)

    return {"ok": False, "track": "paid-work", "error": f"UNHANDLED_PAID_WORK_ACTION: {act}"}
