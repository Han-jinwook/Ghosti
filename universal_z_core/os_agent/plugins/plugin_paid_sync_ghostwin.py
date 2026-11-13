#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[창 2 전담 플러그인 슬롯] plugin_paid_sync_ghostwin.py
- 담당 트랙: D:\\Ghosti_Sync (git branch: track/paid-sync)
- 담당 도메인:
  1) 👑 내 기기 통합 (월 3,900원): 폰↔PC 무클라우드 다이렉트 페어링 · 13KB 섀도우 캐시 · 원격 원본 소환
  2) ⚡ 귀신창 초능력 & 귀신검색창 (seq_paste_daemon.py / ghost_search_window_ui2.py, 로컬 127.0.0.1:51988) 상태 브리지
- 헌법 가드레일: 본 플러그인 내부에 ONNX/AI 모델(InferenceSession 등) 직접 로드 영구 금지.
"""

from __future__ import annotations

import json
from typing import Any, Dict
import urllib.request

GHOSTWIN_LOCAL_PORT = 51988

SYNC_GHOSTWIN_ACTIONS = {
    "paid-sync-status",
    "ghostwin-status",
    "ghostwin-ping",
    "paid-sync-summon-file",
}


def check_ghostwin_daemon_alive(timeout_sec: float = 0.8) -> Dict[str, Any]:
    """로컬 귀신창 데몬(127.0.0.1:51988) 생존 여부를 초경량 소켓/HTTP로 확인합니다."""
    url = f"http://127.0.0.1:{GHOSTWIN_LOCAL_PORT}/health"
    try:
        with urllib.request.urlopen(url, timeout=timeout_sec) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
            data = json.loads(raw) if raw.strip().startswith("{") else {"raw": raw[:200]}
            return {"ok": True, "alive": True, "port": GHOSTWIN_LOCAL_PORT, "detail": data}
    except Exception as exc:
        return {"ok": True, "alive": False, "port": GHOSTWIN_LOCAL_PORT, "reason": str(exc)}


def handle_action(act: str, data: Dict[str, Any]) -> Dict[str, Any] | None:
    """plugin_ghosti_os 라우터에서 위임받아 창 2 전용 액션을 처리합니다."""
    if act not in SYNC_GHOSTWIN_ACTIONS and not act.startswith(("paid-sync-", "ghostwin-")):
        return None

    if act in ("ghostwin-status", "ghostwin-ping", "paid-sync-status"):
        gw = check_ghostwin_daemon_alive()
        return {
            "ok": True,
            "track": "paid-sync",
            "ghostWinDaemon": gw,
        }

    if act == "paid-sync-summon-file":
        target_id = str(data.get("fileId") or data.get("fileName") or "").strip()
        return {
            "ok": True,
            "track": "paid-sync",
            "status": "queued",
            "target": target_id,
        }

    return {"ok": False, "track": "paid-sync", "error": f"UNHANDLED_PAID_SYNC_ACTION: {act}"}
