#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
멀린 Z 코어 (Universal Merlin Z-Core) 전사 파이썬 공용 SDK (z_core_sdk.py)
- 고정 위치: D:\\Ghosti\\universal_z_core\\bridge\\z_core_sdk.py
- 사용법 (타 프로젝트에서 파일 복사 없이 바로 참조):
    import sys
    sys.path.append(r"D:\\Ghosti\\universal_z_core\\bridge")
    from z_core_sdk import ZCore

    ZCore.trusted_click(selector="button.se-publish-btn")
    ZCore.trusted_paste(html="<h2>제목</h2><p>본문</p>", selector=".se-content")
"""

from typing import Any, Dict, Optional
import requests

BRIDGE_URL = "http://127.0.0.1:5198/__zcore/command"


class ZCore:
    @staticmethod
    def call(
        command: str,
        params: Optional[Dict[str, Any]] = None,
        timeout_sec: float = 15.0,
    ) -> Dict[str, Any]:
        res = requests.post(
            BRIDGE_URL,
            json={
                "command": command,
                "params": params or {},
                "timeoutSec": timeout_sec,
            },
            timeout=timeout_sec + 3.0,
        )
        return res.json()

    @staticmethod
    def trusted_click(
        selector: Optional[str] = None,
        x: Optional[int] = None,
        y: Optional[int] = None,
        index: int = 0,
        tab_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """CDP Input.dispatchMouseEvent 기반 물리 클릭 (isTrusted: true)"""
        return ZCore.call(
            "trustedClick",
            {"selector": selector, "x": x, "y": y, "index": index, "tabId": tab_id},
        )

    @staticmethod
    def trusted_type(
        text: str,
        selector: Optional[str] = None,
        delay_ms: int = 15,
        press_enter: bool = False,
        tab_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """CDP Input.insertText 기반 물리 키보드 타이핑 (한글/특수문자 완벽 지원)"""
        return ZCore.call(
            "trustedType",
            {
                "text": text,
                "selector": selector,
                "delayMs": delay_ms,
                "pressEnter": press_enter,
                "tabId": tab_id,
            },
        )

    @staticmethod
    def trusted_key(
        key: str = "Enter",
        modifiers: int = 0,
        tab_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """CDP Input.dispatchKeyEvent 기반 물리 단축키/특수키 입력"""
        return ZCore.call(
            "trustedKey",
            {"key": key, "modifiers": modifiers, "tabId": tab_id},
        )

    @staticmethod
    def trusted_paste(
        text: str = "",
        html: str = "",
        selector: Optional[str] = None,
        tab_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """클립보드에 리치 HTML/텍스트 주입 후 CDP 물리 Ctrl+V 발사"""
        return ZCore.call(
            "trustedPaste",
            {"text": text, "html": html, "selector": selector, "tabId": tab_id},
        )

    @staticmethod
    def pierce_shadow_dom(
        selector: str,
        index: int = 0,
        tab_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """중첩 Shadow DOM 및 iframe 내부 요소 좌표·텍스트 정밀 탐색"""
        return ZCore.call(
            "pierceShadowDOM",
            {"selector": selector, "index": index, "tabId": tab_id},
        )

    @staticmethod
    def navigate(url: str, tab_id: Optional[int] = None) -> Dict[str, Any]:
        """지정된 URL로 탭 이동"""
        return ZCore.call("navigate", {"url": url, "tabId": tab_id})

    @staticmethod
    def eval_js(expression: str, tab_id: Optional[int] = None) -> Dict[str, Any]:
        """CDP Runtime.evaluate로 페이지 내 JS 표현식 실행 후 값 반환"""
        return ZCore.call("evalJs", {"expression": expression, "tabId": tab_id})

    @staticmethod
    def list_tabs() -> Dict[str, Any]:
        """현재 열려 있는 모든 브라우저 탭 목록 반환"""
        return ZCore.call("listTabs", {})
