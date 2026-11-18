#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[내장 소프트웨어 플러그인 2] plugin_senstalk.py (v6.1 — sensebot.py v6.1 100% 무손실 동기화판)
- 센스톡(SensTalk) 6대 메신저(카카오톡·라인·텔레그램·왓츠앱·위챗) 엔터 1회 연속 발송 엔진
- autoSkipAmbiguous(동명이인·미발견 자동 패스), IS_TEST_MODE 초기화, 다중 배치 검색·장전·연속 발송 완전 동기화
- 귀신같이 단일 표준 포트(127.0.0.1:5199)의 Merlin_Z_Core 내부에서 직결 작동합니다.
"""

from __future__ import annotations

import base64
import ctypes
from ctypes import wintypes
from datetime import date
import io
import json
import os
from pathlib import Path
import random
import re
import sys
import threading
import time
from typing import Any, Dict, List, Optional
import urllib.parse
import webbrowser
import winsound

THIS_DIR = Path(__file__).resolve().parent
if str(THIS_DIR) not in sys.path:
    sys.path.insert(0, str(THIS_DIR))

import core_win32 as w32  # noqa: E402

try:
    import psutil
except ImportError:
    psutil = None

try:
    from PIL import Image, ImageDraw
except ImportError:
    Image = None
    ImageDraw = None

try:
    import win32clipboard
    import win32con
except ImportError:
    win32clipboard = None
    win32con = None

SENSEBOT_VERSION = "6.1"
SENSEBOT_BUILD = "20261118_v61_zcore5199_sync"
GLOBAL_TRAY_ICON = None
_EARLY_USER_ENTER_DETECTED = False
_LOADED_RE_HWND = None
_LOADED_RE_HAD_TEXT = False
_LOADED_POPUP_HWND = None
_LOADED_HAD_POPUP = False
_LOADED_BLOCK_TIME = 0.0
_CACHED_AUTOSTART_VAL = None
_CACHED_AUTOSTART_TS = 0.0
_CACHED_KAKAO_HWND = None
_CACHED_KAKAO_TS = 0.0
_CACHED_TODAY_DATE = None
_CACHED_TODAY_COUNT = 0

PLUGIN_METADATA = {
    "pluginId": "senstalk",
    "pluginName": "SensTalk 6-Messenger Full Native Dispatch Engine (sensebot v6.1)",
    "version": SENSEBOT_VERSION,
    "type": "BUILTIN_SOFTWARE_PLUGIN",
    "port": 5199,
    "basePath": "/api/senstalk",
    "supportedChannels": ["kakao", "line", "telegram", "whatsapp", "wechat"],
}

_LISTENERS_STARTED = False
_LISTENERS_LOCK = threading.Lock()

# ==========================================
# 1. 64비트 Windows Win32 API 선언
# ==========================================
user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

GlobalAlloc = kernel32.GlobalAlloc
GlobalAlloc.restype = ctypes.c_void_p
GlobalAlloc.argtypes = [wintypes.UINT, ctypes.c_size_t]

GlobalLock = kernel32.GlobalLock
GlobalLock.restype = ctypes.c_void_p
GlobalLock.argtypes = [ctypes.c_void_p]

GlobalUnlock = kernel32.GlobalUnlock
GlobalUnlock.argtypes = [ctypes.c_void_p]

SetClipboardData = user32.SetClipboardData
SetClipboardData.restype = ctypes.c_void_p
SetClipboardData.argtypes = [wintypes.UINT, ctypes.c_void_p]

GetClipboardData = user32.GetClipboardData
GetClipboardData.restype = ctypes.c_void_p
GetClipboardData.argtypes = [wintypes.UINT]

def _get_clipboard_text() -> str:
    """Windows 클립보드의 현재 유니코드 텍스트를 64비트 안전 방식으로 안전 조회"""
    CF_UNICODETEXT = 13
    opened = False
    for _ in range(10):
        if user32.OpenClipboard(None):
            opened = True
            break
        time.sleep(0.02)
    if not opened:
        return ""
    try:
        h_mem = GetClipboardData(CF_UNICODETEXT)
        if not h_mem:
            return ""
        ptr = GlobalLock(h_mem)
        if not ptr:
            return ""
        try:
            return ctypes.wstring_at(ptr)
        finally:
            GlobalUnlock(h_mem)
    except Exception:
        return ""
    finally:
        user32.CloseClipboard()

GetForegroundWindow = user32.GetForegroundWindow
GetForegroundWindow.restype = wintypes.HWND

GetWindowTextW = user32.GetWindowTextW
GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]

GetClassNameW = user32.GetClassNameW
GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]

SetForegroundWindow = user32.SetForegroundWindow
SetForegroundWindow.argtypes = [wintypes.HWND]

ShowWindow = user32.ShowWindow
ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]

BringWindowToTop = user32.BringWindowToTop
BringWindowToTop.argtypes = [wintypes.HWND]

AttachThreadInput = user32.AttachThreadInput
AttachThreadInput.argtypes = [wintypes.DWORD, wintypes.DWORD, wintypes.BOOL]

GetWindowThreadProcessId = user32.GetWindowThreadProcessId
GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]

OpenInputDesktop = user32.OpenInputDesktop
OpenInputDesktop.restype = wintypes.HANDLE
OpenInputDesktop.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]

SetThreadDesktop = user32.SetThreadDesktop
SetThreadDesktop.argtypes = [wintypes.HANDLE]

EnumDesktopWindows = user32.EnumDesktopWindows
EnumDesktopWindows.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.LPARAM]

RegisterHotKey = user32.RegisterHotKey
RegisterHotKey.argtypes = [wintypes.HWND, ctypes.c_int, wintypes.UINT, wintypes.UINT]

UnregisterHotKey = user32.UnregisterHotKey
UnregisterHotKey.argtypes = [wintypes.HWND, ctypes.c_int]

GetMessageW = user32.GetMessageW
GetMessageW.argtypes = [ctypes.POINTER(wintypes.MSG), wintypes.HWND, wintypes.UINT, wintypes.UINT]

# 가상 키 코드 및 상수
VK_ESCAPE = 0x1B   # ESC (대화방 닫기)
VK_RETURN = 0x0D   # Enter (유저 발송 타건)
VK_CONTROL = 0x11  # Ctrl
VK_MENU = 0x12     # Alt
VK_F = 0x46        # F (Ctrl+F 검색)
VK_V = 0x56        # V (Ctrl+V 붙여넣기)
VK_F8 = 0x77       # F8 (전역 단축키)
VK_F9 = 0x78       # F9 (일시정지 단축키)
VK_DOWN = 0x28     # Down Arrow (방향키 아래)
KEYEVENTF_KEYUP = 0x0002
SW_RESTORE = 9
SW_MINIMIZE = 6
HOTKEY_ID_F8 = 9001
WM_HOTKEY = 0x0312

# ==========================================
# 2. 전역 상태 (PWA 실시간 연동 큐 및 엔터 루프)
# ==========================================
SYNCED_STATE = {
    "recipients": [],
    "blocks": [],
    "currentIndex": 0,
    "mode": "classic",
    "channel": "kakao"
}
BOT_RUNNING = False              # 연속 발송 모드 가동 여부
WAITING_FOR_USER_ENTER = False   # 현재 대화방에서 유저의 [Enter] 대기 상태
IS_TEST_MODE = False             # 1:1 테스트 발송 모드 여부 (발송 후 큐 미전진)
CURRENT_TARGET_REC = None        # 현재 카톡에 장전된 대상 수신자
CURRENT_TARGET_INDEX = -1        # 현재 카톡에 장전된 대상 수신자 인덱스 (0-based)
CURRENT_REC_BLOCKS = []          # 현재 대상 수신자에게 순차 발송할 블록 리스트
CURRENT_BLOCK_INDEX = 0          # 현재 발송 대기 중인 블록 인덱스 (0-based)
CURRENT_CHAT_HWND = None         # 현재 대상의 카카오톡 1:1 대화방 HWND
CURRENT_POPUP_HWND = None        # 카카오톡 [클립보드 이미지 전송] 팝업 모달 HWND
LAST_EVENT = None
RECENT_COMPLETED_LIST = []       # 최근 발송 완료 확정 이력 링 버퍼 (폴링 이벤트 누락·역행 원천 차단)
WATCHING_MANUAL_CHAT = False     # 수동 대화방 선택 실시간 감시 스레드 활성 여부
STATE_LOCK = threading.Lock()
_DISPATCH_SEQ_ID = 0             # 장전 세대(Generation) 시퀀스 번호 (중복/구세대 스레드 즉시 폐기용)
_DISPATCH_LOCK = threading.Lock() # load_and_dispatch_next 단일 스레드 직렬화 뮤텍스
_PASTE_LOCK = threading.Lock()   # 입력창 붙여넣기(WM_PASTE) 직렬화 뮤텍스
_LAST_PASTED_INFO = {"hwnd": 0, "msg": "", "time": 0.0}

def _pause_other_local_engine():
    """동일 PC에서 포트 5199(Merlin_Z_Core 내장 플러그인)가 동시 가동 중일 때 중복 엔터 감지/붙여넣기 원천 차단을 위해 즉시 일시정지 신호 전송"""
    def _task():
        try:
            import urllib.request
            req = urllib.request.Request(
                "http://127.0.0.1:28888/pause",
                data=b"{}",
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=0.25) as _:
                pass
        except Exception:
            pass
    threading.Thread(target=_task, daemon=True).start()

def _get_richedit_text(re_hwnd) -> str:
    """카카오톡 대화창 RICHEDIT50W 내부의 현재 텍스트를 64비트 안전 방식으로 조회"""
    try:
        if not re_hwnd or not user32.IsWindow(re_hwnd):
            return ""
        length = user32.SendMessageW(wintypes.HWND(re_hwnd), 0x000E, wintypes.WPARAM(0), wintypes.LPARAM(0))
        if not length or length <= 0:
            return ""
        buf = ctypes.create_unicode_buffer(int(length) + 8)
        user32.SendMessageW(wintypes.HWND(re_hwnd), 0x000D, wintypes.WPARAM(int(length) + 4), buf)
        return buf.value or ""
    except Exception:
        return ""

# ==========================================
# 3. 윈도우 OS 데스크톱 및 포커스 헬퍼
# ==========================================
def ensure_desktop_attached():
    try:
        hDesk = OpenInputDesktop(0, False, 0x01FF)
        if hDesk:
            SetThreadDesktop(hDesk)
            return hDesk
    except Exception:
        pass
    return None

def force_foreground(hwnd):
    if not hwnd or not user32.IsWindow(hwnd):
        return False

    ensure_desktop_attached()
    fg_hwnd = GetForegroundWindow()
    if fg_hwnd == hwnd and not user32.IsIconic(hwnd):
        user32.SendMessageW(hwnd, 0x001F, 0, 0)  # WM_CANCELMODE
        return True

    fg_tid = GetWindowThreadProcessId(fg_hwnd, None) if fg_hwnd else 0
    target_tid = GetWindowThreadProcessId(hwnd, None)
    cur_tid = kernel32.GetCurrentThreadId()

    attached_fg = False
    attached_target = False
    try:
        if fg_tid and fg_tid != cur_tid:
            attached_fg = bool(AttachThreadInput(cur_tid, fg_tid, True))
        if target_tid and target_tid != cur_tid:
            attached_target = bool(AttachThreadInput(cur_tid, target_tid, True))

        if user32.IsIconic(hwnd) or not user32.IsWindowVisible(hwnd):
            ShowWindow(hwnd, SW_RESTORE)
        SetForegroundWindow(hwnd)
        BringWindowToTop(hwnd)
        if GetForegroundWindow() != hwnd:
            user32.keybd_event(0x12, 0, 0, 0)
            user32.keybd_event(0x12, 0, KEYEVENTF_KEYUP, 0)
            SetForegroundWindow(hwnd)
            BringWindowToTop(hwnd)
        # 윈도우 시스템 메뉴(Alt 메뉴) 모드 잔여 상태 원천 해제
        user32.SendMessageW(hwnd, 0x001F, 0, 0) # WM_CANCELMODE
    finally:
        if attached_target:
            AttachThreadInput(cur_tid, target_tid, False)
        if attached_fg:
            AttachThreadInput(cur_tid, fg_tid, False)

    time.sleep(random.uniform(0.03, 0.05))
    return GetForegroundWindow() == hwnd

def is_kakao_locked_or_logged_out() -> bool:
    """카카오톡이 실행 중이나 로그아웃 상태(로그인 창)이거나 잠금모드(LockModeView) 상태인지 판별"""
    hDesk = ensure_desktop_attached()
    WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    has_active_main = False
    has_login_or_lock = False

    def enum_proc(hwnd, lParam):
        nonlocal has_active_main, has_login_or_lock
        cls_buff = ctypes.create_unicode_buffer(256)
        GetClassNameW(hwnd, cls_buff, 256)
        if not cls_buff.value.startswith('EVA_Window'):
            return True
        is_vis = bool(user32.IsWindowVisible(hwnd))
        buff = ctypes.create_unicode_buffer(512)
        GetWindowTextW(hwnd, buff, 512)
        title = buff.value
        if '카카오톡' in title or 'KakaoTalk' in title or 'īī' in title:
            has_main_view = False
            has_lock_vis = False
            edit_count = 0
            def check_child(ch, lp):
                nonlocal has_main_view, has_lock_vis, edit_count
                t = ctypes.create_unicode_buffer(256)
                GetWindowTextW(ch, t, 256)
                if 'OnlineMainView' in t.value or 'ContactListView' in t.value:
                    has_main_view = True
                elif 'LockModeView' in t.value and user32.IsWindowVisible(ch):
                    rc_lk = wintypes.RECT()
                    user32.GetWindowRect(ch, ctypes.byref(rc_lk))
                    if (rc_lk.right - rc_lk.left) > 50:
                        has_lock_vis = True
                c = ctypes.create_unicode_buffer(256)
                GetClassNameW(ch, c, 256)
                if c.value == 'Edit':
                    edit_count += 1
                return True
            user32.EnumChildWindows(hwnd, WNDENUMPROC(check_child), 0)
            if has_main_view:
                if has_lock_vis:
                    has_login_or_lock = True
                elif is_vis:
                    has_active_main = True
            elif is_vis and edit_count >= 1:
                has_login_or_lock = True
        return True

    cb = WNDENUMPROC(enum_proc)
    if hDesk:
        EnumDesktopWindows(hDesk, cb, 0)
    else:
        user32.EnumWindows(cb, 0)
    return bool(has_login_or_lock and not has_active_main)

def find_kakaotalk_window(use_cache: bool = True):
    global _CACHED_KAKAO_HWND, _CACHED_KAKAO_TS
    now = time.time()
    if use_cache and _CACHED_KAKAO_HWND and user32.IsWindow(_CACHED_KAKAO_HWND) and user32.IsWindowVisible(_CACHED_KAKAO_HWND):
        # 캐시된 창이 실제로 OnlineMainView/ContactListView를 가진 활성 메인창인지 검증 (로그아웃 시 로그인창 오인 방지)
        has_mv = False
        def _chk_mv(ch, lp):
            nonlocal has_mv
            t = ctypes.create_unicode_buffer(256)
            GetWindowTextW(ch, t, 256)
            if 'OnlineMainView' in t.value or 'ContactListView' in t.value:
                has_mv = True
                return False
            return True
        user32.EnumChildWindows(_CACHED_KAKAO_HWND, ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)(_chk_mv), 0)
        if has_mv:
            return _CACHED_KAKAO_HWND
        _CACHED_KAKAO_HWND = None

    hDesk = ensure_desktop_attached()
    main_window = None
    hidden_main_window = None
    login_window = None
    fallback_candidates = []
    WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def enum_proc(hwnd, lParam):
        nonlocal main_window, hidden_main_window, login_window
        cls_buff = ctypes.create_unicode_buffer(256)
        GetClassNameW(hwnd, cls_buff, 256)
        cls = cls_buff.value
        if not cls.startswith('EVA_Window'):
            return True

        is_vis = bool(user32.IsWindowVisible(hwnd))
        buff = ctypes.create_unicode_buffer(512)
        GetWindowTextW(hwnd, buff, 512)
        title = buff.value

        if '카카오톡' in title or 'KakaoTalk' in title or 'īī' in title:
            # 자식 윈도우 중 OnlineMainView 또는 ContactListView가 있는지 확인 (진짜 메인창 판별)
            has_main_view = False
            edit_count = 0
            def check_child(ch, lp):
                nonlocal has_main_view, edit_count
                t = ctypes.create_unicode_buffer(256)
                GetWindowTextW(ch, t, 256)
                if 'OnlineMainView' in t.value or 'ContactListView' in t.value:
                    has_main_view = True
                    return False
                c = ctypes.create_unicode_buffer(256)
                GetClassNameW(ch, c, 256)
                if c.value == 'Edit':
                    edit_count += 1
                return True
            user32.EnumChildWindows(hwnd, WNDENUMPROC(check_child), 0)
            if has_main_view:
                if is_vis:
                    main_window = hwnd
                    return False
                elif not hidden_main_window:
                    hidden_main_window = hwnd
            elif is_vis:
                if edit_count >= 1 and not login_window:
                    login_window = hwnd
                else:
                    fallback_candidates.append(hwnd)
        elif not title and is_vis:
            fallback_candidates.append(hwnd)
        return True

    cb = WNDENUMPROC(enum_proc)
    if hDesk:
        EnumDesktopWindows(hDesk, cb, 0)
    else:
        user32.EnumWindows(cb, 0)

    # ⚠️ 만약 로그인 창(login_window)이 화면에 떠 있고 활성 메인창(main_window)이 없다면,
    # 숨겨진 구 메인창(hidden_main_window)에 ShowWindow(SW_RESTORE)를 호출하면 빈 유령창이 뜨므로 절대 복원하지 않음!
    if login_window and not main_window:
        _CACHED_KAKAO_HWND = None
        _CACHED_KAKAO_TS = now
        return None

    found = main_window or hidden_main_window or (fallback_candidates[0] if fallback_candidates else None)
    _CACHED_KAKAO_HWND = found
    _CACHED_KAKAO_TS = now
    return found

_LAST_KAKAO_NOTFOUND_KW = ""
_U32_DPI = None
try:
    _U32_DPI = ctypes.WinDLL("user32")
    _U32_DPI.GetWindowDpiAwarenessContext.restype = ctypes.c_void_p
    _U32_DPI.GetWindowDpiAwarenessContext.argtypes = [wintypes.HWND]
    _U32_DPI.SetThreadDpiAwarenessContext.restype = ctypes.c_void_p
    _U32_DPI.SetThreadDpiAwarenessContext.argtypes = [ctypes.c_void_p]
    _U32_DPI.GetDpiForWindow.restype = wintypes.UINT
    _U32_DPI.GetDpiForWindow.argtypes = [wintypes.HWND]
except Exception:
    _U32_DPI = None


def _kakao_dpi_scale(hwnd) -> float:
    """카카오톡 창 자체의 DPI 배율 (100%=1.0, 125%=1.25, 150%=1.5)"""
    try:
        if _U32_DPI and hwnd and user32.IsWindow(hwnd):
            dpi = int(_U32_DPI.GetDpiForWindow(hwnd) or 0)
            if dpi > 0:
                return max(0.75, min(3.0, dpi / 96.0))
    except Exception:
        pass
    return 1.0


class _KakaoDpiContext:
    """
    현재 스레드의 DPI 좌표계를 카카오톡 창과 동일하게 임시 전환.
    (엔진 프로세스는 DPI-unaware라서 125%/150% 배율 PC에서는 GetWindowRect/GetClientRect가
     축소된 가상 좌표를 돌려주고, SendMessage 클릭 좌표·PrintWindow 픽셀 판별이 실제 카톡 화면과 어긋남)
    """
    def __init__(self, hwnd):
        self.hwnd = hwnd
        self.old_ctx = None

    def __enter__(self):
        try:
            if _U32_DPI and self.hwnd and user32.IsWindow(self.hwnd):
                ctx = _U32_DPI.GetWindowDpiAwarenessContext(self.hwnd)
                if ctx:
                    self.old_ctx = _U32_DPI.SetThreadDpiAwarenessContext(ctx)
        except Exception:
            self.old_ctx = None
        return self

    def __exit__(self, *exc):
        try:
            if _U32_DPI and self.old_ctx:
                _U32_DPI.SetThreadDpiAwarenessContext(self.old_ctx)
        except Exception:
            pass
        return False


def _get_kakao_friend_views(kakao_hwnd):
    """카카오톡 메인창 내 친구 탭 주요 컨트롤 핸들 및 상태 조회 (카톡 창과 동일한 DPI 좌표계로 측정)"""
    with _KakaoDpiContext(kakao_hwnd):
        return _get_kakao_friend_views_impl(kakao_hwnd)


def _get_kakao_friend_views_impl(kakao_hwnd):
    """카카오톡 메인창 내 친구 탭 주요 컨트롤(ContactListView, SearchListCtrl, ContactListCtrl, Edit) 핸들 및 상태 조회"""
    ensure_desktop_attached()
    WS_VISIBLE = 0x10000000
    GWL_STYLE = -16
    online_main_hwnd = None
    contact_view_hwnd = None
    search_list_hwnd = None
    contact_list_hwnd = None
    search_edit_hwnd = None

    if not kakao_hwnd or not user32.IsWindow(kakao_hwnd):
        return {
            "online_main": None,
            "contact_view": None,
            "search_list": None,
            "contact_list": None,
            "search_edit": None,
            "is_contact_view_vis": False,
            "is_search_list_vis": False,
            "is_contact_list_vis": False,
            "is_search_bar_open": False,
            "cl_offset": 0,
            "cv_w": 0,
            "ed_mid_y": 74,
            "edit_w": 0,
            "dpi_s": 1.0,
        }

    WNDENUM = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def enum_top_views(hwnd, lparam):
        nonlocal online_main_hwnd, contact_view_hwnd
        t = ctypes.create_unicode_buffer(256)
        user32.GetWindowTextW(hwnd, t, 256)
        if 'OnlineMainView' in t.value and not online_main_hwnd:
            online_main_hwnd = hwnd
        elif 'ContactListView' in t.value and not contact_view_hwnd:
            contact_view_hwnd = hwnd
        return True

    user32.EnumChildWindows(kakao_hwnd, WNDENUM(enum_top_views), 0)

    # ⭐️ 반드시 ContactListView(친구 탭) 직속 하위 윈도우만 열거하여 ChatRoomListView(채팅 탭) Edit/SearchListCtrl 오탐지 원천 차단!
    if contact_view_hwnd and user32.IsWindow(contact_view_hwnd):
        def enum_contact_children(hwnd, lparam):
            nonlocal search_list_hwnd, contact_list_hwnd, search_edit_hwnd
            c = ctypes.create_unicode_buffer(256)
            user32.GetClassNameW(hwnd, c, 256)
            if c.value == 'Edit':
                if not search_edit_hwnd:
                    search_edit_hwnd = hwnd
                return True
            t = ctypes.create_unicode_buffer(256)
            user32.GetWindowTextW(hwnd, t, 256)
            if 'SearchListCtrl' in t.value and not search_list_hwnd:
                search_list_hwnd = hwnd
            elif 'ContactListCtrl' in t.value and not contact_list_hwnd:
                contact_list_hwnd = hwnd
            return True

        user32.EnumChildWindows(contact_view_hwnd, WNDENUM(enum_contact_children), 0)

    is_contact_view_vis = bool(contact_view_hwnd and (user32.GetWindowLongW(contact_view_hwnd, GWL_STYLE) & WS_VISIBLE))
    is_search_list_vis = bool(search_list_hwnd and (user32.GetWindowLongW(search_list_hwnd, GWL_STYLE) & WS_VISIBLE))
    is_contact_list_vis = bool(contact_list_hwnd and (user32.GetWindowLongW(contact_list_hwnd, GWL_STYLE) & WS_VISIBLE))

    r_cv = wintypes.RECT()
    cv_w = 0
    if contact_view_hwnd and user32.IsWindow(contact_view_hwnd):
        user32.GetWindowRect(contact_view_hwnd, ctypes.byref(r_cv))
        cv_w = max(0, r_cv.right - r_cv.left)

    cl_offset = 0
    if contact_list_hwnd and user32.IsWindow(contact_list_hwnd) and cv_w > 0:
        r_cl = wintypes.RECT()
        user32.GetWindowRect(contact_list_hwnd, ctypes.byref(r_cl))
        cl_offset = r_cl.top - r_cv.top

    edit_w = 0
    dpi_s = _kakao_dpi_scale(kakao_hwnd)
    ed_mid_y = int(74 * dpi_s)
    if search_edit_hwnd and user32.IsWindow(search_edit_hwnd):
        rc = wintypes.RECT()
        user32.GetWindowRect(search_edit_hwnd, ctypes.byref(rc))
        edit_w = rc.right - rc.left
        if cv_w > 0 and rc.bottom > rc.top:
            rel_y = ((rc.top + rc.bottom) // 2) - r_cv.top
            if int(50 * dpi_s) <= rel_y <= int(110 * dpi_s):
                ed_mid_y = rel_y

    # 검색바 닫힘 45px / 열림 101px (100% 기준) -> 배율 PC에서도 동일 비율로 판별
    is_search_bar_open = bool(cl_offset > int(68 * dpi_s) or is_search_list_vis)

    return {
        "online_main": online_main_hwnd,
        "contact_view": contact_view_hwnd,
        "search_list": search_list_hwnd,
        "contact_list": contact_list_hwnd,
        "search_edit": search_edit_hwnd,
        "is_contact_view_vis": is_contact_view_vis,
        "is_search_list_vis": is_search_list_vis,
        "is_contact_list_vis": is_contact_list_vis,
        "is_search_bar_open": is_search_bar_open,
        "cl_offset": cl_offset,
        "cv_w": cv_w,
        "ed_mid_y": ed_mid_y,
        "edit_w": edit_w,
        "dpi_s": dpi_s,
    }

def _reset_kakao_friend_search_ui(kakao_hwnd, background_only: bool = False):
    """
    카카오톡 친구 탭 검색창이 열려있거나 백지(SearchListCtrl 활성) 상태인 경우
    EN_CHANGE 없이 텍스트만 소거한 뒤 우측 [X] 닫기 버튼을 클릭하여 정상 친구 목록(ContactListCtrl)으로 100% 복원
    """
    if not kakao_hwnd or not user32.IsWindow(kakao_hwnd):
        return None
    views = _get_kakao_friend_views(kakao_hwnd)
    search_edit = views["search_edit"]
    contact_view = views["contact_view"]
    if not search_edit or not user32.IsWindow(search_edit):
        return views

    # 이미 검색바가 닫혀 있고 정상 친구 목록(ContactListCtrl)이 표시 중이면 닫힌 Edit를 건드리지 않고 즉시 반환!
    if not views["is_search_bar_open"] and not views["is_search_list_vis"] and views["is_contact_list_vis"]:
        return views

    # 1. EN_CHANGE 통지 없이 기존 검색어 텍스트만 조용히 비우기 (X 닫기 버튼 작동 조건 충족)
    empty_buf = ctypes.create_unicode_buffer("")
    user32.SendMessageW(search_edit, 0x000C, 0, empty_buf)  # WM_SETTEXT ''

    # 2. ContactListView 우측 상단 검색바 닫기(X) 버튼(x = cv_w - 28, y = ed_mid_y) 동기 클릭
    if contact_view and user32.IsWindow(contact_view):
        cv_w = views["cv_w"]
        s = views.get("dpi_s", 1.0)
        x_close = (cv_w - int(28 * s)) if cv_w > int(150 * s) else int(297 * s)
        y_close = views["ed_mid_y"]
        lp_close = (y_close << 16) | (x_close & 0xFFFF)
        user32.SendMessageW(contact_view, 0x0201, 1, lp_close)  # WM_LBUTTONDOWN
        user32.SendMessageW(contact_view, 0x0202, 0, lp_close)  # WM_LBUTTONUP
        time.sleep(0.025)
        views = _get_kakao_friend_views(kakao_hwnd)

    # 3. 만약 여전히 검색바나 SearchListCtrl이 열려있다면 포커스 후 ESC 1회로 안전하게 닫기
    if not background_only and (views["is_search_bar_open"] or views["is_search_list_vis"]):
        try:
            cur_tid = kernel32.GetCurrentThreadId()
            kakao_tid = user32.GetWindowThreadProcessId(kakao_hwnd, None)
            user32.AttachThreadInput(cur_tid, kakao_tid, True)
            user32.SetFocus(search_edit)
            user32.AttachThreadInput(cur_tid, kakao_tid, False)
        except Exception:
            pass
        press_key(VK_ESCAPE)
        user32.GetAsyncKeyState(VK_ESCAPE)
        time.sleep(0.03)
        if user32.IsIconic(kakao_hwnd) or not user32.IsWindowVisible(kakao_hwnd):
            user32.ShowWindow(kakao_hwnd, SW_RESTORE)
        views = _get_kakao_friend_views(kakao_hwnd)

    # 4. 최후 방어: 친구 탭인데 ContactListCtrl이 숨겨져 있거나 SearchListCtrl이 남아있으면 강제 복원
    if views["is_contact_view_vis"] and (views["is_search_list_vis"] or not views["is_contact_list_vis"]):
        if views["search_list"] and user32.IsWindow(views["search_list"]):
            user32.ShowWindow(views["search_list"], 0)  # SW_HIDE
        if views["contact_list"] and user32.IsWindow(views["contact_list"]):
            user32.ShowWindow(views["contact_list"], 5)  # SW_SHOW
        views = _get_kakao_friend_views(kakao_hwnd)

    return views

def ensure_friends_tab(kakao_hwnd):
    """카카오톡 메인창이 확실하게 '친구' 탭을 보도록 보장 (단톡방/채팅탭 검색 및 트레이 숨김 백지 현상 원천 차단)"""
    ensure_desktop_attached()
    if not kakao_hwnd or not user32.IsWindow(kakao_hwnd):
        kakao_hwnd = find_kakaotalk_window(use_cache=False)
        if not kakao_hwnd:
            return None

    was_hidden = not bool(user32.IsWindowVisible(kakao_hwnd))
    if was_hidden:
        try:
            os.startfile("kakaotalk://")
            time.sleep(0.12)
        except Exception:
            pass
        user32.ShowWindow(kakao_hwnd, 5)  # SW_SHOW
        user32.ShowWindow(kakao_hwnd, SW_RESTORE)
        time.sleep(0.06)
        refreshed = find_kakaotalk_window(use_cache=False)
        if refreshed:
            kakao_hwnd = refreshed
    elif user32.IsIconic(kakao_hwnd):
        user32.ShowWindow(kakao_hwnd, SW_RESTORE)
        time.sleep(0.04)

    force_foreground(kakao_hwnd)

    views = _get_kakao_friend_views(kakao_hwnd)
    if views["is_contact_view_vis"]:
        views = _reset_kakao_friend_search_ui(kakao_hwnd)
        return views["search_edit"] if views else None

    # 친구 탭이 아닐 경우(채팅 탭/오픈채팅/더보기 탭에 있을 경우):
    # 1차: DPI 컨텍스트 내에서 좌측 네비게이션 레일 친구 아이콘(x=32*s, y=48*s / 58*s) 동기 클릭 메시지 전송
    with _KakaoDpiContext(kakao_hwnd):
        s_tab = views.get("dpi_s", 1.0)
        target_tab_window = views["online_main"] if views["online_main"] else kakao_hwnd
        for (rx, ry) in ((32, 48), (32, 58), (28, 44)):
            lp = (int(ry * s_tab) << 16) | (int(rx * s_tab) & 0xFFFF)
            user32.SendMessageW(target_tab_window, 0x0201, 1, lp)
            user32.SendMessageW(target_tab_window, 0x0202, 0, lp)
            time.sleep(0.04)
            views = _get_kakao_friend_views(kakao_hwnd)
            if views["is_contact_view_vis"]:
                break

        # 2차: 가상 메시지를 무시하는 카톡 빌드 대비 물리 화면 좌표 클릭 (커서 원위치 보존)
        if not views["is_contact_view_vis"]:
            rc_nav = wintypes.RECT()
            user32.GetWindowRect(target_tab_window, ctypes.byref(rc_nav))
            old_pt = wintypes.POINT()
            user32.GetCursorPos(ctypes.byref(old_pt))
            for ry in (48, 58, 92):
                click_x = rc_nav.left + int(32 * s_tab)
                click_y = rc_nav.top + int(ry * s_tab)
                user32.SetCursorPos(click_x, click_y)
                time.sleep(0.015)
                user32.mouse_event(0x0002, 0, 0, 0, 0)
                time.sleep(0.015)
                user32.mouse_event(0x0004, 0, 0, 0, 0)
                time.sleep(0.05)
                views = _get_kakao_friend_views(kakao_hwnd)
                if views["is_contact_view_vis"]:
                    break
            user32.SetCursorPos(old_pt.x, old_pt.y)

    views = _reset_kakao_friend_search_ui(kakao_hwnd)
    return views["search_edit"] if views else None

def _activate_kakao_richedit_send_state(chat_hwnd, re_hwnd, skip_click: bool = False):
    """카카오톡 RICHEDIT50W 입력창에 실제 키보드 포커스를 안착시키고 Space->Backspace 물리 편집 신호로 [전송] 버튼 노란색 활성화 100% 보장"""
    ensure_desktop_attached()
    if not chat_hwnd or not re_hwnd or not user32.IsWindow(chat_hwnd) or not user32.IsWindow(re_hwnd):
        return
    try:
        if GetForegroundWindow() != chat_hwnd:
            force_foreground(chat_hwnd)

        if not skip_click:
            with _KakaoDpiContext(chat_hwnd):
                rect_re = wintypes.RECT()
                user32.GetWindowRect(re_hwnd, ctypes.byref(rect_re))
                dpi_s = _kakao_dpi_scale(chat_hwnd)
                click_x = rect_re.left + int(40 * dpi_s)
                click_y = rect_re.top + int(18 * dpi_s)
                user32.SetCursorPos(click_x, click_y)
            time.sleep(0.01)
            user32.mouse_event(0x0002, 0, 0, 0, 0)  # LEFTDOWN
            time.sleep(0.01)
            user32.mouse_event(0x0004, 0, 0, 0, 0)  # LEFTUP
            time.sleep(0.015)

        cur_tid = kernel32.GetCurrentThreadId()
        chat_tid = user32.GetWindowThreadProcessId(chat_hwnd, None)
        user32.AttachThreadInput(cur_tid, chat_tid, True)
        user32.SetFocus(re_hwnd)
        user32.AttachThreadInput(cur_tid, chat_tid, False)
        user32.SendMessageW(wintypes.HWND(re_hwnd), 0x00B1, wintypes.WPARAM(-1), wintypes.LPARAM(-1))

        # 한글 IME 조합 해제 후 Space(0x20) -> Backspace(0x08) 물리 키 입력으로 카톡 [전송] 버튼 노란색 활성화 100% 강제
        try:
            imm32 = ctypes.windll.imm32
            hIMC = imm32.ImmGetContext(re_hwnd)
            if hIMC:
                imm32.ImmSetConversionStatus(hIMC, 0, 0)
                imm32.ImmReleaseContext(re_hwnd, hIMC)
        except Exception:
            pass

        if _get_richedit_text(re_hwnd).strip():
            user32.SendMessageW(wintypes.HWND(re_hwnd), 0x00B1, wintypes.WPARAM(-1), wintypes.LPARAM(-1))
            user32.keybd_event(0x20, 0, 0, 0)  # Space DOWN
            time.sleep(0.01)
            user32.keybd_event(0x20, 0, 2, 0)  # Space UP
            time.sleep(0.01)
            user32.keybd_event(0x08, 0, 0, 0)  # Backspace DOWN
            time.sleep(0.01)
            user32.keybd_event(0x08, 0, 2, 0)  # Backspace UP
            user32.GetAsyncKeyState(0x08)
            time.sleep(0.01)

        # EN_CHANGE(0x0300) 통지 전송
        ctrl_id = user32.GetDlgCtrlID(wintypes.HWND(re_hwnd))
        parent_h = user32.GetParent(wintypes.HWND(re_hwnd)) or chat_hwnd
        user32.PostMessageW(wintypes.HWND(parent_h), 0x0111, wintypes.WPARAM((0x0300 << 16) | (ctrl_id & 0xFFFF)), wintypes.LPARAM(re_hwnd))
        if parent_h != chat_hwnd:
            user32.PostMessageW(wintypes.HWND(chat_hwnd), 0x0111, wintypes.WPARAM((0x0300 << 16) | (ctrl_id & 0xFFFF)), wintypes.LPARAM(re_hwnd))
    except Exception as e:
        print(f"   [입력창 활성화 예외 무시] {e}")

def _click_kakao_chat_send_button(chat_hwnd):
    """카카오톡 대화창 우측 하단 노란색 [전송] 버튼을 DPI 배율 보정 좌표(클라이언트 메시지 + 물리 클릭)로 클릭"""
    if not chat_hwnd or not user32.IsWindow(chat_hwnd):
        return False
    try:
        with _KakaoDpiContext(chat_hwnd):
            dpi_s = _kakao_dpi_scale(chat_hwnd)
            rc_cli = wintypes.RECT()
            user32.GetClientRect(chat_hwnd, ctypes.byref(rc_cli))
            cw = rc_cli.right - rc_cli.left
            ch = rc_cli.bottom - rc_cli.top
            if cw > 100 and ch > 100:
                cx = cw - int(48 * dpi_s)
                cy = ch - int(22 * dpi_s)
                lp = (cy << 16) | (cx & 0xFFFF)
                user32.SendMessageW(wintypes.HWND(chat_hwnd), 0x0201, wintypes.WPARAM(1), wintypes.LPARAM(lp))
                user32.SendMessageW(wintypes.HWND(chat_hwnd), 0x0202, wintypes.WPARAM(0), wintypes.LPARAM(lp))
                time.sleep(0.03)
            rc_chat = wintypes.RECT()
            user32.GetWindowRect(chat_hwnd, ctypes.byref(rc_chat))
            send_btn_x = rc_chat.right - int(48 * dpi_s)
            send_btn_y = rc_chat.bottom - int(22 * dpi_s)
            user32.SetCursorPos(send_btn_x, send_btn_y)
        time.sleep(0.015)
        user32.mouse_event(0x0002, 0, 0, 0, 0)
        time.sleep(0.015)
        user32.mouse_event(0x0004, 0, 0, 0, 0)
        time.sleep(0.05)
        return True
    except Exception:
        return False

def _ensure_kakao_richedit_sent(chat_hwnd, re_hwnd) -> bool:
    """카카오톡 텍스트 블록에서 유저가 [Enter]를 쳤으나 미전송된 경우 100% 실제 전송 완료(입력창 공백화)까지 보장"""
    if not chat_hwnd or not re_hwnd or not user32.IsWindow(chat_hwnd) or not user32.IsWindow(re_hwnd):
        return True
    time.sleep(0.04)
    if not _get_richedit_text(re_hwnd).strip():
        return True

    # 1단계: 입력창 DPI 정밀 클릭 + Space->Backspace로 카톡 [전송] 버튼 강제 활성화 후 Enter 타건
    _activate_kakao_richedit_send_state(chat_hwnd, re_hwnd, skip_click=False)
    press_key(VK_RETURN)
    _flush_enter_key_state()
    for _ in range(4):
        time.sleep(0.025)
        if not _get_richedit_text(re_hwnd).strip():
            return True

    # 2단계: RICHEDIT50W에 직접 WM_KEYDOWN / WM_CHAR / WM_KEYUP(VK_RETURN) 전송
    user32.SendMessageW(wintypes.HWND(re_hwnd), 0x0100, wintypes.WPARAM(VK_RETURN), wintypes.LPARAM(0x001C0001))
    user32.SendMessageW(wintypes.HWND(re_hwnd), 0x0102, wintypes.WPARAM(VK_RETURN), wintypes.LPARAM(0x001C0001))
    user32.SendMessageW(wintypes.HWND(re_hwnd), 0x0101, wintypes.WPARAM(VK_RETURN), wintypes.LPARAM(0xC01C0001))
    for _ in range(3):
        time.sleep(0.025)
        if not _get_richedit_text(re_hwnd).strip():
            return True

    # 3단계: 카카오톡 전송 단축키가 [Ctrl + Enter]로 설정된 환경 대응
    _activate_kakao_richedit_send_state(chat_hwnd, re_hwnd, skip_click=True)
    press_hotkey(VK_CONTROL, VK_RETURN)
    _flush_enter_key_state()
    for _ in range(3):
        time.sleep(0.025)
        if not _get_richedit_text(re_hwnd).strip():
            return True

    # 4단계: 대화창 우측 하단 노란색 [전송] 버튼 직접 클릭 폴백 (DPI 보정 적용)
    _click_kakao_chat_send_button(chat_hwnd)
    for _ in range(4):
        time.sleep(0.025)
        if not _get_richedit_text(re_hwnd).strip():
            return True

    return not bool(_get_richedit_text(re_hwnd).strip())

def _check_and_latch_user_enter() -> bool:
    """VK_RETURN의 0x8000(눌림) 또는 0x0001(전이) 비트를 읽는 즉시 _EARLY_USER_ENTER_DETECTED에 보존하여 비트 소실 원천 차단"""
    global _EARLY_USER_ENTER_DETECTED
    if user32.GetAsyncKeyState(VK_RETURN) & 0x8001:
        _EARLY_USER_ENTER_DETECTED = True
    return _EARLY_USER_ENTER_DETECTED

def paste_message_to_chat(chat_hwnd, message: str, expected_seq_id: int = None):
    """카카오톡 대화방 입력창(RICHEDIT50W)에 메시지를 100% 확실하게 주입하고 노란색 [전송] 버튼 활성화"""
    global CURRENT_CHAT_HWND, WAITING_FOR_USER_ENTER, _EARLY_USER_ENTER_DETECTED
    global _LOADED_RE_HWND, _LOADED_RE_HAD_TEXT, _LOADED_POPUP_HWND, _LOADED_HAD_POPUP, _LOADED_BLOCK_TIME
    ensure_desktop_attached()
    if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
        return
    with _PASTE_LOCK:
        if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
            return
        if chat_hwnd and user32.IsWindow(chat_hwnd):
            CURRENT_CHAT_HWND = chat_hwnd
        _LOADED_POPUP_HWND = None
        _LOADED_HAD_POPUP = False

        # 대화창 내부의 RICHEDIT50W 컨트롤 탐색
        re_hwnds = []
        def find_re(h, lp):
            c = ctypes.create_unicode_buffer(256)
            user32.GetClassNameW(h, c, 256)
            if 'RICHEDIT' in c.value:
                re_hwnds.append(h)
                return False
            return True

        WNDENUM = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        user32.EnumChildWindows(chat_hwnd, WNDENUM(find_re), 0)

        norm_msg = (message or "").replace('\r\n', '\n').replace('\r', '\n').strip()
        now_ts = time.time()
        if re_hwnds and norm_msg:
            existing_txt = _get_richedit_text(re_hwnds[0]).replace('\r\n', '\n').replace('\r', '\n').strip()
            if existing_txt == norm_msg:
                print("   [중복 입력 방지] 대화창 입력란에 이미 동일한 메시지가 입력되어 있어 재붙여넣기를 건너뜁니다.")
                _activate_kakao_richedit_send_state(chat_hwnd, re_hwnds[0], skip_click=True)
                _check_and_latch_user_enter()
                _LOADED_RE_HWND = re_hwnds[0]
                _LOADED_RE_HAD_TEXT = bool(_get_richedit_text(re_hwnds[0]).strip())
                _LOADED_BLOCK_TIME = time.time()
                _LAST_PASTED_INFO["hwnd"] = chat_hwnd
                _LAST_PASTED_INFO["msg"] = message
                _LAST_PASTED_INFO["time"] = time.time()
                return

        if message and _LAST_PASTED_INFO["hwnd"] == chat_hwnd and _LAST_PASTED_INFO["msg"] == message and (now_ts - _LAST_PASTED_INFO["time"] < 12.0):
            if re_hwnds and _get_richedit_text(re_hwnds[0]).strip():
                print("   [중복 입력 방지] 동일 대화창에 동일한 메시지가 이미 장전되어 중복 붙여넣기를 건너뜁니다.")
                _LOADED_RE_HWND = re_hwnds[0]
                _LOADED_RE_HAD_TEXT = True
                _LOADED_BLOCK_TIME = time.time()
                return

        # 장전 시작 전 이전 대화방 오픈에 사용된 봇의 Enter 잔여 비트만 초기화
        _flush_enter_key_state()
        _EARLY_USER_ENTER_DETECTED = False

        force_foreground(chat_hwnd)
        if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
            return
        # 메시지를 클립보드에 확실하게 주입 (최대 6회 검증 및 재시도)
        for _ in range(6):
            if set_clipboard_text(message):
                if not message or _get_clipboard_text() == message:
                    break
            time.sleep(0.015)

        if re_hwnds:
            re_hwnd = re_hwnds[0]
            # 1. 입력창 내부를 DPI 배율 보정 좌표로 클릭하여 키보드 포커스를 100% 안착시키고 시스템 메뉴 모드 원천 해제
            with _KakaoDpiContext(chat_hwnd):
                rect_re = wintypes.RECT()
                user32.GetWindowRect(re_hwnd, ctypes.byref(rect_re))
                dpi_s = _kakao_dpi_scale(chat_hwnd)
                click_x = rect_re.left + int(35 * dpi_s)
                click_y = rect_re.top + int(15 * dpi_s)
                user32.SetCursorPos(click_x, click_y)
            time.sleep(0.01)
            user32.mouse_event(0x0002, 0, 0, 0, 0) # LEFTDOWN
            time.sleep(0.01)
            user32.mouse_event(0x0004, 0, 0, 0, 0) # LEFTUP
            time.sleep(0.015)

            # 2. AttachThreadInput으로 SetFocus 명시
            cur_tid = kernel32.GetCurrentThreadId()
            chat_tid = user32.GetWindowThreadProcessId(chat_hwnd, None)
            user32.AttachThreadInput(cur_tid, chat_tid, True)
            user32.SetFocus(re_hwnd)
            user32.AttachThreadInput(cur_tid, chat_tid, False)

            if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
                return

            # 3. 64비트 안전 WM_SETTEXT('') + EM_SETSEL(0, -1) + WM_CLEAR로 잔여 텍스트 100% 완전 소거
            empty_buf = ctypes.create_unicode_buffer("")
            user32.SendMessageW(wintypes.HWND(re_hwnd), 0x000C, wintypes.WPARAM(0), empty_buf)          # WM_SETTEXT ''
            user32.SendMessageW(wintypes.HWND(re_hwnd), 0x00B1, wintypes.WPARAM(0), wintypes.LPARAM(-1)) # EM_SETSEL all
            user32.SendMessageW(wintypes.HWND(re_hwnd), 0x0303, wintypes.WPARAM(0), wintypes.LPARAM(0))  # WM_CLEAR
            time.sleep(0.015)

            # 4. 한글 IME 조합 상태 해제 (영문 모드로 설정하여 자모 오타 원천 차단)
            try:
                imm32 = ctypes.windll.imm32
                hIMC = imm32.ImmGetContext(re_hwnd)
                if hIMC:
                    imm32.ImmSetConversionStatus(hIMC, 0, 0)
                    imm32.ImmReleaseContext(re_hwnd, hIMC)
            except Exception:
                pass

            if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
                return

            # 5. 정밀 지연 Ctrl + V 타건 (카카오톡 EVA_Window [전송] 버튼 노란색 활성화 트리거)
            if message:
                if _get_clipboard_text() != message:
                    set_clipboard_text(message)
                    time.sleep(0.02)

                _flush_enter_key_state()
                _EARLY_USER_ENTER_DETECTED = False
                CURRENT_CHAT_HWND = chat_hwnd

                user32.keybd_event(0x11, 0, 0, 0) # Ctrl DOWN
                time.sleep(0.015)
                user32.keybd_event(0x56, 0, 0, 0) # V DOWN
                time.sleep(0.015)
                user32.keybd_event(0x56, 0, 2, 0) # V UP
                time.sleep(0.015)
                user32.keybd_event(0x11, 0, 2, 0) # Ctrl UP
                time.sleep(random.uniform(0.035, 0.055))

                _check_and_latch_user_enter()

                after_txt = _get_richedit_text(re_hwnd).replace('\r\n', '\n').replace('\r', '\n').strip()
                had_text_after_paste = bool(after_txt)

                if not _EARLY_USER_ENTER_DETECTED:
                    # ⭐️ [별명/이름 오입력 즉각 감지 및 강제 교정 방어막]
                    target_names = []
                    if CURRENT_TARGET_REC:
                        for k in ("name", "이름", "별명", "nickname"):
                            v = str(CURRENT_TARGET_REC.get(k) or "").strip()
                            if v:
                                target_names.append(v)
                                if '/' in v:
                                    target_names.append(v.split('/')[0].strip())
                                if '-' in v:
                                    target_names.append(v.split('-')[0].strip())
                    is_nickname_leaked = after_txt in target_names or (norm_msg and len(after_txt) < len(norm_msg) // 2 and any(n in after_txt for n in target_names if len(n) >= 2))
                    if is_nickname_leaked:
                        print(f"   🚨 [별명 오입력 감지 즉시 교정] 대화방 입력창에 별명('{after_txt}') 감지! 소거 후 본문으로 긴급 교체합니다.")
                        user32.SendMessageW(wintypes.HWND(re_hwnd), 0x000C, wintypes.WPARAM(0), empty_buf) # WM_SETTEXT ''
                        user32.SendMessageW(wintypes.HWND(re_hwnd), 0x0303, wintypes.WPARAM(0), wintypes.LPARAM(0)) # WM_CLEAR
                        time.sleep(0.02)
                        set_clipboard_text(message)
                        time.sleep(0.02)
                        user32.SendMessageW(wintypes.HWND(re_hwnd), 0x0302, wintypes.WPARAM(0), wintypes.LPARAM(0)) # WM_PASTE
                        time.sleep(0.03)
                        after_txt = _get_richedit_text(re_hwnd).replace('\r\n', '\n').replace('\r', '\n').strip()
                        if after_txt:
                            had_text_after_paste = True

                    # Ctrl+V가 먹히지 않은 경우 WM_PASTE 폴백 (단, 유저가 이미 Enter를 쳐서 전송된 경우는 _check_and_latch_user_enter로 보존!)
                    if not after_txt and norm_msg and not _check_and_latch_user_enter():
                        user32.SendMessageW(wintypes.HWND(re_hwnd), 0x0302, wintypes.WPARAM(0), wintypes.LPARAM(0)) # WM_PASTE
                        time.sleep(0.03)
                        after_txt = _get_richedit_text(re_hwnd).replace('\r\n', '\n').replace('\r', '\n').strip()
                        if after_txt:
                            had_text_after_paste = True

                    # 중복 텍스트 감지 시 1회분 단일 본문으로 교정
                    if norm_msg and len(after_txt) > len(norm_msg) + 4:
                        user32.SendMessageW(wintypes.HWND(re_hwnd), 0x000C, wintypes.WPARAM(0), empty_buf)
                        user32.SendMessageW(wintypes.HWND(re_hwnd), 0x0302, wintypes.WPARAM(0), wintypes.LPARAM(0))
                        print("   [무결성 자동 교정] 입력창 중복 텍스트 감지 즉시 1회분 단일 본문으로 교정 완료!")

                    if not _check_and_latch_user_enter():
                        _activate_kakao_richedit_send_state(chat_hwnd, re_hwnd, skip_click=False)
                        _check_and_latch_user_enter()

                final_txt = _get_richedit_text(re_hwnd).replace('\r\n', '\n').replace('\r', '\n').strip()
                if had_text_after_paste and not final_txt:
                    # 장전 직후 텍스트가 분명히 있었으나 활성화 도중 유저의 Enter로 이미 카톡 전송이 완료되어 비워진 경우!
                    _EARLY_USER_ENTER_DETECTED = True
                    _LOADED_RE_HWND = re_hwnd
                    _LOADED_RE_HAD_TEXT = False
                else:
                    _LOADED_RE_HWND = re_hwnd
                    _LOADED_RE_HAD_TEXT = bool(final_txt)
                _LOADED_BLOCK_TIME = time.time()

                _LAST_PASTED_INFO["hwnd"] = chat_hwnd
                _LAST_PASTED_INFO["msg"] = message
                _LAST_PASTED_INFO["time"] = time.time()
                CURRENT_CHAT_HWND = chat_hwnd
            else:
                user32.AttachThreadInput(cur_tid, chat_tid, True)
                user32.SetFocus(re_hwnd)
                user32.AttachThreadInput(cur_tid, chat_tid, False)
                user32.SendMessageW(wintypes.HWND(re_hwnd), 0x00B1, wintypes.WPARAM(-1), wintypes.LPARAM(-1))
        elif message:
            # 보조: 키보드 Ctrl + V
            _flush_enter_key_state()
            _EARLY_USER_ENTER_DETECTED = False
            CURRENT_CHAT_HWND = chat_hwnd
            press_hotkey(VK_CONTROL, VK_V)
            time.sleep(random.uniform(0.08, 0.14))
            _check_and_latch_user_enter()
            _LOADED_RE_HWND = None
            _LOADED_RE_HAD_TEXT = False
            _LOADED_BLOCK_TIME = time.time()
            _LAST_PASTED_INFO["hwnd"] = chat_hwnd
            _LAST_PASTED_INFO["msg"] = message
            _LAST_PASTED_INFO["time"] = time.time()

def set_clipboard_text(text: str) -> bool:
    CF_UNICODETEXT = 13
    GMEM_MOVEABLE = 0x0002

    bytes_data = (text + '\0').encode('utf-16-le') if text else b'\0\0'
    for attempt in range(20):
        if user32.OpenClipboard(None):
            try:
                user32.EmptyClipboard()
                if not text:
                    return True
                h_mem = GlobalAlloc(GMEM_MOVEABLE, len(bytes_data))
                if not h_mem:
                    return False
                ptr = GlobalLock(h_mem)
                if not ptr:
                    return False
                ctypes.memmove(ptr, bytes_data, len(bytes_data))
                GlobalUnlock(h_mem)
                if SetClipboardData(CF_UNICODETEXT, h_mem):
                    return True
            finally:
                user32.CloseClipboard()
        time.sleep(0.025)
    return False

def set_clipboard_image_from_dataurl(data_url_str: str) -> bool:
    """Base64 dataUrl 또는 이미지 파일 경로를 Windows 클립보드 CF_DIB 형식으로 복사"""
    if not data_url_str:
        return False

    try:
        if os.path.exists(data_url_str):
            with open(data_url_str, "rb") as f:
                img_bytes = f.read()
        else:
            if ',' in data_url_str:
                b64_data = data_url_str.split(',', 1)[1]
            else:
                b64_data = data_url_str
            img_bytes = base64.b64decode(b64_data)

        if not Image:
            print("⚠️ PIL(Pillow) 라이브러리가 필요합니다.")
            return False

        im = Image.open(io.BytesIO(img_bytes))
        output = io.BytesIO()
        im.convert("RGB").save(output, "BMP")
        bmp_data = output.getvalue()[14:]  # 14-byte BITMAPFILEHEADER 제거 -> CF_DIB
        output.close()

        if win32clipboard and win32con:
            for _ in range(15):
                try:
                    win32clipboard.OpenClipboard()
                    win32clipboard.EmptyClipboard()
                    win32clipboard.SetClipboardData(win32con.CF_DIB, bmp_data)
                    win32clipboard.CloseClipboard()
                    return True
                except Exception:
                    time.sleep(0.04)
            return False
        else:
            CF_DIB = 8
            GMEM_MOVEABLE = 0x0002
            opened = False
            for _ in range(15):
                if user32.OpenClipboard(None):
                    opened = True
                    break
                time.sleep(0.03)
            if not opened:
                return False
            try:
                user32.EmptyClipboard()
                h_mem = GlobalAlloc(GMEM_MOVEABLE, len(bmp_data))
                if not h_mem:
                    return False
                ptr = GlobalLock(h_mem)
                if not ptr:
                    return False
                ctypes.memmove(ptr, bmp_data, len(bmp_data))
                GlobalUnlock(h_mem)
                SetClipboardData(CF_DIB, h_mem)
                return True
            finally:
                user32.CloseClipboard()
    except Exception as e:
        print(f"⚠️ 클립보드 이미지 변환/복사 실패: {e}")
        return False

def find_and_focus_image_popup():
    """카카오톡 [클립보드 이미지 전송] 팝업 모달창을 찾아 포그라운드 활성화"""
    hDesk = ensure_desktop_attached()
    popup_hwnd = None

    def enum_pop(h, _):
        nonlocal popup_hwnd
        if user32.IsWindowVisible(h):
            c = ctypes.create_unicode_buffer(256)
            user32.GetClassNameW(h, c, 256)
            if 'EVA' in c.value:
                r = wintypes.RECT()
                user32.GetWindowRect(h, ctypes.byref(r))
                w = r.right - r.left
                h_val = r.bottom - r.top
                # 클립보드 이미지 전송 팝업은 통상 300~450 x 350~500 크기
                if 250 <= w <= 500 and 250 <= h_val <= 550:
                    edit_found = False
                    def check_edit(ch, _):
                        nonlocal edit_found
                        ec = ctypes.create_unicode_buffer(256)
                        user32.GetClassNameW(ch, ec, 256)
                        if ec.value == 'Edit':
                            edit_found = True
                        return True
                    user32.EnumChildWindows(h, ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)(check_edit), 0)
                    if edit_found:
                        popup_hwnd = h
        return True

    user32.EnumDesktopWindows(hDesk, ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)(enum_pop), 0)
    if popup_hwnd:
        force_foreground(popup_hwnd)
        return popup_hwnd
    return None

def paste_image_to_chat(chat_hwnd, data_url_str: str):
    """카카오톡 대화방 입력창에 이미지를 붙여넣어 [클립보드 이미지 전송] 팝업을 띄우고 포커스를 안착"""
    global CURRENT_POPUP_HWND, WAITING_FOR_USER_ENTER, _EARLY_USER_ENTER_DETECTED
    global _LOADED_RE_HWND, _LOADED_RE_HAD_TEXT, _LOADED_POPUP_HWND, _LOADED_HAD_POPUP, _LOADED_BLOCK_TIME
    ensure_desktop_attached()

    if not set_clipboard_image_from_dataurl(data_url_str):
        print("⚠️ 이미지 클립보드 장전 실패")
        return False

    _LOADED_RE_HWND = None
    _LOADED_RE_HAD_TEXT = False
    _LOADED_POPUP_HWND = None
    _LOADED_HAD_POPUP = False

    force_foreground(chat_hwnd)
    time.sleep(0.12)

    re_hwnds = []
    def find_re(h, lp):
        c = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(h, c, 256)
        if 'RICHEDIT' in c.value:
            re_hwnds.append(h)
        return True

    WNDENUM = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    user32.EnumChildWindows(chat_hwnd, WNDENUM(find_re), 0)

    if re_hwnds:
        re_hwnd = re_hwnds[0]
        rect_re = wintypes.RECT()
        user32.GetWindowRect(re_hwnd, ctypes.byref(rect_re))
        click_x = rect_re.left + 35
        click_y = rect_re.top + 15
        user32.SetCursorPos(click_x, click_y)
        time.sleep(random.uniform(0.015, 0.035))
        user32.mouse_event(0x0002, 0, 0, 0, 0)
        time.sleep(random.uniform(0.015, 0.035))
        user32.mouse_event(0x0004, 0, 0, 0, 0)
        time.sleep(random.uniform(0.04, 0.08))

        cur_tid = kernel32.GetCurrentThreadId()
        chat_tid = user32.GetWindowThreadProcessId(chat_hwnd, None)
        user32.AttachThreadInput(cur_tid, chat_tid, True)
        user32.SetFocus(re_hwnd)
        user32.AttachThreadInput(cur_tid, chat_tid, False)

    _flush_enter_key_state()
    _EARLY_USER_ENTER_DETECTED = False
    press_hotkey(VK_CONTROL, VK_V)

    popup = None
    t_img0 = time.time()
    while time.time() - t_img0 < 0.42:
        time.sleep(0.04)
        if _check_and_latch_user_enter():
            break
        popup = find_and_focus_image_popup()
        if popup:
            break

    CURRENT_POPUP_HWND = popup
    if popup and not _EARLY_USER_ENTER_DETECTED:
        force_foreground(popup)
        time.sleep(0.04)
        _check_and_latch_user_enter()
        if not user32.IsWindow(popup) or not user32.IsWindowVisible(popup):
            _EARLY_USER_ENTER_DETECTED = True
        else:
            _LOADED_POPUP_HWND = popup
            _LOADED_HAD_POPUP = True
    _LOADED_BLOCK_TIME = time.time()
    return True

def _flush_enter_key_state():
    """봇이 자체 합성한 VK_RETURN 입력 후 잔여 키 눌림(0x8000) 및 전이 비트(0x0001)를 100% 소거"""
    t0 = time.time()
    while (user32.GetAsyncKeyState(VK_RETURN) & 0x8000) and (time.time() - t0 < 0.5):
        time.sleep(0.01)
    user32.GetAsyncKeyState(VK_RETURN)
    user32.GetAsyncKeyState(VK_RETURN)

def press_key(key_code: int):
    user32.keybd_event(key_code, 0, 0, 0)
    time.sleep(random.uniform(0.025, 0.065))
    user32.keybd_event(key_code, 0, KEYEVENTF_KEYUP, 0)

def press_hotkey(mod_code: int, key_code: int):
    user32.keybd_event(mod_code, 0, 0, 0)
    time.sleep(random.uniform(0.02, 0.05))
    user32.keybd_event(key_code, 0, 0, 0)
    time.sleep(random.uniform(0.025, 0.065))
    user32.keybd_event(key_code, 0, KEYEVENTF_KEYUP, 0)
    user32.keybd_event(mod_code, 0, KEYEVENTF_KEYUP, 0)

def get_active_window_title() -> str:
    hwnd = GetForegroundWindow()
    if not hwnd:
        return ""
    length = 512
    buff = ctypes.create_unicode_buffer(length)
    GetWindowTextW(hwnd, buff, length)
    return buff.value

def get_foreground_process_name(hwnd=None) -> str:
    try:
        if not hwnd:
            hwnd = GetForegroundWindow()
        if not hwnd or not user32.IsWindow(hwnd):
            return ""
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if pid.value and psutil:
            return psutil.Process(pid.value).name().lower()
    except Exception:
        pass
    return ""

def is_kakao_image_popup(hwnd) -> bool:
    if not hwnd or not user32.IsWindow(hwnd) or not user32.IsWindowVisible(hwnd):
        return False
    c = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(hwnd, c, 256)
    if 'EVA' in c.value:
        r = wintypes.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(r))
        w = r.right - r.left
        h_val = r.bottom - r.top
        if 250 <= w <= 500 and 250 <= h_val <= 550:
            return True
    return False

def is_valid_messenger_window(hwnd, channel: str = "kakao") -> bool:
    if not hwnd or not user32.IsWindow(hwnd):
        return False

    if channel == "kakao":
        if is_chat_window(hwnd):
            return True
        if CURRENT_POPUP_HWND and hwnd == CURRENT_POPUP_HWND:
            return True
        if is_kakao_image_popup(hwnd):
            return True
        return False

    pname = get_foreground_process_name(hwnd)
    if not pname:
        return False

    title_lower = get_active_window_title().lower()
    is_browser = pname in ("chrome.exe", "whale.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe")

    if channel == "telegram":
        if pname == "telegram.exe":
            return True
        if is_browser:
            return "telegram" in title_lower or "텔레그램" in title_lower
        return False

    if channel == "line":
        if pname == "line.exe":
            return True
        if is_browser:
            return "line" in title_lower or "라인" in title_lower
        return False

    if channel == "wechat":
        return pname in ("wechat.exe", "wechatapp.exe")

    if channel == "whatsapp":
        if pname in ("whatsapp.exe", "whatsapp.root.exe"):
            return True
        if is_browser:
            return "whatsapp" in title_lower or "왓츠앱" in title_lower
        return False

    all_known = ("kakaotalk.exe", "telegram.exe", "line.exe", "wechat.exe", "whatsapp.exe", "whatsapp.root.exe")
    return pname in all_known

def get_recipient_phone(rec: dict) -> str:
    if not rec or not isinstance(rec, dict):
        return ""
    for k in ["phone", "_phone", "전화번호", "연락처", "휴대폰", "핸드폰", "mobile", "tel"]:
        val = rec.get(k)
        if val is not None and str(val).strip():
            raw = str(val).strip()
            digits = re.sub(r'[^0-9]', '', raw)
            if digits and not re.match(r'^0+$', digits) and digits not in ("01000000000", "01012345678"):
                return raw
    return ""

def normalize_korean_phone_intl(phone_str: str) -> str:
    digits = re.sub(r'[^0-9]', '', str(phone_str))
    if digits.startswith("0"):
        return "82" + digits[1:]
    return digits

def find_wechat_window():
    hDesk = ensure_desktop_attached()
    w_hwnd = None
    def cb(h, _):
        nonlocal w_hwnd
        if user32.IsWindowVisible(h):
            pid = wintypes.DWORD()
            user32.GetWindowThreadProcessId(h, ctypes.byref(pid))
            if pid.value and psutil:
                try:
                    pname = psutil.Process(pid.value).name().lower()
                    if pname in ("wechat.exe", "wechatapp.exe"):
                        r = wintypes.RECT()
                        user32.GetWindowRect(h, ctypes.byref(r))
                        if (r.right - r.left) > 250 and (r.bottom - r.top) > 250:
                            w_hwnd = h
                            return False
                except Exception:
                    pass
        return True
    WNDENUM = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    if hDesk:
        user32.EnumDesktopWindows(hDesk, WNDENUM(cb), 0)
    else:
        user32.EnumWindows(WNDENUM(cb), 0)
    return w_hwnd

def find_telegram_window():
    hDesk = ensure_desktop_attached()
    w_hwnd = None
    def cb(h, _):
        nonlocal w_hwnd
        if user32.IsWindowVisible(h):
            pid = wintypes.DWORD()
            user32.GetWindowThreadProcessId(h, ctypes.byref(pid))
            if pid.value and psutil:
                try:
                    pname = psutil.Process(pid.value).name().lower()
                    r = wintypes.RECT()
                    user32.GetWindowRect(h, ctypes.byref(r))
                    w = r.right - r.left
                    h_val = r.bottom - r.top
                    if pname == "telegram.exe" and w > 250 and h_val > 250:
                        w_hwnd = h
                        return False
                    if pname in ("chrome.exe", "whale.exe", "msedge.exe", "firefox.exe", "brave.exe") and w > 400 and h_val > 300:
                        t = ctypes.create_unicode_buffer(512)
                        user32.GetWindowTextW(h, t, 512)
                        tl = t.value.lower()
                        if "telegram" in tl or "텔레그램" in tl:
                            w_hwnd = h
                            return False
                except Exception:
                    pass
        return True
    WNDENUM = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    if hDesk:
        user32.EnumDesktopWindows(hDesk, WNDENUM(cb), 0)
    else:
        user32.EnumWindows(WNDENUM(cb), 0)
    return w_hwnd

def find_line_window():
    """LINE(라인) 메신저 데스크톱 윈도우 또는 브라우저 창 탐색"""
    hDesk = ensure_desktop_attached()
    w_hwnd = None
    def cb(h, _):
        nonlocal w_hwnd
        if user32.IsWindowVisible(h):
            pid = wintypes.DWORD()
            user32.GetWindowThreadProcessId(h, ctypes.byref(pid))
            if pid.value and psutil:
                try:
                    pname = psutil.Process(pid.value).name().lower()
                    r = wintypes.RECT()
                    user32.GetWindowRect(h, ctypes.byref(r))
                    w = r.right - r.left
                    h_val = r.bottom - r.top
                    if pname == "line.exe" and w > 250 and h_val > 250:
                        w_hwnd = h
                        return False
                    if pname in ("chrome.exe", "whale.exe", "msedge.exe", "firefox.exe", "brave.exe") and w > 400 and h_val > 300:
                        t = ctypes.create_unicode_buffer(512)
                        user32.GetWindowTextW(h, t, 512)
                        tl = t.value.lower()
                        if "line" in tl or "라인" in tl:
                            w_hwnd = h
                            return False
                except Exception:
                    pass
        return True
    WNDENUM = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    if hDesk:
        user32.EnumDesktopWindows(hDesk, WNDENUM(cb), 0)
    else:
        user32.EnumWindows(WNDENUM(cb), 0)
    return w_hwnd

def find_whatsapp_window():
    """왓츠앱(WhatsApp) 데스크톱 윈도우 또는 브라우저 웹 왓츠앱 창 탐색"""
    hDesk = ensure_desktop_attached()
    w_hwnd = None
    def cb(h, _):
        nonlocal w_hwnd
        if user32.IsWindowVisible(h):
            pid = wintypes.DWORD()
            user32.GetWindowThreadProcessId(h, ctypes.byref(pid))
            if pid.value and psutil:
                try:
                    pname = psutil.Process(pid.value).name().lower()
                    r = wintypes.RECT()
                    user32.GetWindowRect(h, ctypes.byref(r))
                    w = r.right - r.left
                    h_val = r.bottom - r.top
                    if pname in ("whatsapp.exe", "whatsapp.root.exe") and w > 250 and h_val > 250:
                        w_hwnd = h
                        return False
                    if pname in ("chrome.exe", "whale.exe", "msedge.exe", "firefox.exe", "brave.exe") and w > 400 and h_val > 300:
                        t = ctypes.create_unicode_buffer(512)
                        user32.GetWindowTextW(h, t, 512)
                        tl = t.value.lower()
                        if "whatsapp" in tl or "왓츠앱" in tl:
                            w_hwnd = h
                            return False
                except Exception:
                    pass
        return True
    WNDENUM = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    if hDesk:
        user32.EnumDesktopWindows(hDesk, WNDENUM(cb), 0)
    else:
        user32.EnumWindows(WNDENUM(cb), 0)
    return w_hwnd

def open_channel_chat_or_link(channel: str, rec: dict, first_block: dict, expected_seq_id: int = None):
    """
    채널별 최적화된 방식으로 대화방을 열고 첫 번째 블록(텍스트/사진)을 장전
    """
    name = _get_rec_display_name(rec)
    nickname = str(rec.get("별명") or rec.get("닉네임") or rec.get("nickname") or rec.get("nick") or rec.get("고객명") or "").strip()
    phone = get_recipient_phone(rec)
    intl_phone = normalize_korean_phone_intl(phone)
    b_type = first_block.get("type", "text")

    if channel == "kakao":
        chat_hwnd, pre_opened = open_or_focus_chat_window(
            name,
            fallback_nickname=nickname,
            phone=phone,
            expected_seq_id=expected_seq_id
        )
        if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
            return None, False
        if chat_hwnd:
            dispatch_single_block(chat_hwnd, first_block, expected_seq_id=expected_seq_id)
        return chat_hwnd, pre_opened

    elif channel == "telegram":
        # 1. 대상 텔레그램 식별자 (유저네임 또는 전화번호) 추출
        tg_username = ""
        for k in ["telegram", "telegram_id", "tg", "username", "텔레그램", "아이디"]:
            val = rec.get(k)
            if val is not None and str(val).strip():
                tg_username = str(val).strip().lstrip("@")
                break

        if not tg_username:
            for k in ["name", "이름", "memo", "메모"]:
                val = str(rec.get(k) or "").strip()
                if val.startswith("@") and len(val) > 1:
                    tg_username = val.lstrip("@")
                    break

        tg_url = None
        if tg_username:
            tg_url = f"tg://resolve?domain={tg_username}"
        elif intl_phone:
            tg_url = f"tg://resolve?phone={intl_phone}"

        tg_hwnd = find_telegram_window()

        if tg_url:
            # 1) 공식 딥링크 (유저네임 또는 전화번호)로 바로 열기
            try:
                os.startfile(tg_url)
            except Exception as e:
                print(f"[텔레그램 딥링크 실패: {tg_url}] {e}")
                try:
                    fallback_url = f"https://t.me/{tg_username}" if tg_username else f"https://t.me/+{intl_phone}"
                    os.startfile(fallback_url)
                except Exception:
                    pass
            time.sleep(random.uniform(0.40, 0.65))
            tg_hwnd = find_telegram_window()
            if tg_hwnd and user32.IsWindow(tg_hwnd):
                force_foreground(tg_hwnd)
                time.sleep(random.uniform(0.12, 0.22))

        else:
            # 2) 전화번호/아이디가 없고 순수 '이름'만 있는 경우: 텔레그램 상단 검색창에 이름 검색!
            if not tg_hwnd:
                try:
                    os.startfile("tg://msg")
                    time.sleep(0.5)
                    tg_hwnd = find_telegram_window()
                except Exception:
                    pass

            if not tg_hwnd or not user32.IsWindow(tg_hwnd):
                return None, False

            force_foreground(tg_hwnd)
            time.sleep(0.2)

            t = ctypes.create_unicode_buffer(512)
            user32.GetWindowTextW(tg_hwnd, t, 512)
            curr_title = t.value.replace('\u200e', '').strip()

            norm_name = re.sub(r'[\s\-_/()]', '', name).lower() if name else ""
            norm_curr = re.sub(r'[\s\-_/()]', '', curr_title).lower() if curr_title else ""

            # 이미 해당 대상의 대화방이 활성화되어 있는지 확인
            already_opened = bool(norm_name and norm_curr and (norm_name in norm_curr or norm_curr in norm_name) and curr_title != "Telegram")

            if not already_opened:
                # 1. 이전 대화방 및 기존 검색 상태를 ESC 2회로 완전 초기화 (Telegram 기본 화면 복귀)
                press_key(VK_ESCAPE)
                time.sleep(0.08)
                press_key(VK_ESCAPE)
                time.sleep(0.12)

                # 2. 글로벌 대화 및 연락처 검색창 활성화 (Ctrl + F)
                press_hotkey(VK_CONTROL, 0x46)
                time.sleep(0.12)

                # 이전 잔여 검색어 비우기 (Ctrl+A -> Backspace)
                press_hotkey(VK_CONTROL, 0x41)
                time.sleep(0.04)
                press_key(0x08)
                time.sleep(0.04)

                # 3. 대상 이름 검색창에 입력
                set_clipboard_text(name)
                press_hotkey(VK_CONTROL, VK_V)
                time.sleep(0.45) # 텔레그램 검색 결과 렌더링 대기

                # 4. 아래 방향키(첫 번째 매칭 대화방 선택) 후 Enter로 열기 시도
                press_key(0x28) # VK_DOWN
                time.sleep(0.08)
                press_key(VK_RETURN)
                time.sleep(0.40) # 대화방 오픈 및 타이틀 갱신 대기

                # 5. 실제로 해당 대화방이 열렸는지 창 제목 정밀 검증!
                user32.GetWindowTextW(tg_hwnd, t, 512)
                new_title = t.value.replace('\u200e', '').strip()
                norm_new = re.sub(r'[\s\-_/()]', '', new_title).lower() if new_title else ""

                is_matched = bool(norm_name and norm_new and (norm_name in norm_new or norm_new in norm_name) and new_title != "Telegram")

                if not is_matched:
                    print(f"⚠️ 텔레그램 검색 결과: '{name}' 님의 대화방을 찾지 못했습니다. (현재 창 제목: '{new_title}')")
                    # 검색창 및 잘못 열린 방 즉시 닫기
                    press_key(VK_ESCAPE)
                    time.sleep(0.08)
                    press_key(VK_ESCAPE)
                    time.sleep(0.10)
                    return None, False

            # 6. 정상 매칭된 경우 대화방 하단 메시지 입력창 포커스 (창 가로 65%, 세로 하단 35px 지점 클릭)
            rect = wintypes.RECT()
            user32.GetWindowRect(tg_hwnd, ctypes.byref(rect))
            chat_input_x = rect.left + int((rect.right - rect.left) * 0.65)
            chat_input_y = rect.bottom - 35
            user32.SetCursorPos(chat_input_x, chat_input_y)
            time.sleep(0.05)
            user32.mouse_event(0x0002, 0, 0, 0, 0)
            time.sleep(0.03)
            user32.mouse_event(0x0004, 0, 0, 0, 0)
            time.sleep(0.10)

        # 3. 클립보드에 발송할 블록(텍스트 또는 사진) 복사 후 텔레그램 대화창에 Ctrl+V 자동 주입!
        if b_type == "text":
            txt = first_block.get("content", "")
            set_clipboard_text(txt)
        else:
            set_clipboard_image_from_dataurl(first_block.get("dataUrl", ""))

        time.sleep(random.uniform(0.15, 0.25))
        if tg_hwnd and user32.IsWindow(tg_hwnd):
            force_foreground(tg_hwnd)
            time.sleep(random.uniform(0.10, 0.18))

        press_hotkey(VK_CONTROL, VK_V)
        return tg_hwnd or GetForegroundWindow(), False

    elif channel == "line":
        line_id = ""
        for k in ["line_id", "line", "라인", "라인id", "아이디"]:
            v = rec.get(k)
            if v is not None and str(v).strip():
                line_id = str(v).strip()
                break

        line_hwnd = find_line_window()
        target_search = line_id or name

        # 1) LINE 데스크톱 창이 감지된 경우: 검색창(Ctrl+F)으로 대상 검색 및 오픈
        if line_hwnd and target_search:
            force_foreground(line_hwnd)
            time.sleep(random.uniform(0.12, 0.20))
            press_hotkey(VK_CONTROL, 0x46) # Ctrl + F
            time.sleep(random.uniform(0.10, 0.16))
            press_hotkey(VK_CONTROL, 0x41) # Ctrl + A
            time.sleep(0.04)
            press_key(0x08) # Backspace
            time.sleep(0.04)
            set_clipboard_text(target_search)
            press_hotkey(VK_CONTROL, VK_V)
            time.sleep(random.uniform(0.38, 0.48))
            press_key(VK_RETURN)
            time.sleep(random.uniform(0.30, 0.45))
            fg = GetForegroundWindow()
            if fg and user32.IsWindow(fg) and is_valid_messenger_window(fg, "line"):
                line_hwnd = fg

        # 2) 데스크톱 창이 없거나 검색 실패 시: 라인 공식 딥링크 호출
        if not line_hwnd:
            txt = first_block.get("content", "") if b_type == "text" else ""
            q_txt = urllib.parse.quote(txt)
            line_urls = []
            if line_id:
                line_urls.append(f"line://ti/p/~{line_id}")
            if q_txt:
                line_urls.append(f"https://line.me/R/msg/text/?{q_txt}")
            elif not line_urls:
                line_urls.append("line://nv/chat")

            for u in line_urls:
                try:
                    os.startfile(u)
                    time.sleep(random.uniform(0.55, 0.75))
                    break
                except Exception as e:
                    print(f"[라인 딥링크 예외: {u}] {e}")

            time.sleep(random.uniform(0.40, 0.60))
            line_hwnd = find_line_window()
            if line_hwnd and user32.IsWindow(line_hwnd):
                force_foreground(line_hwnd)
                time.sleep(random.uniform(0.12, 0.20))

        if not line_hwnd or not user32.IsWindow(line_hwnd):
            return None, False

        # 3) 블록 주입 (Ctrl+V)
        if b_type == "text":
            set_clipboard_text(first_block.get("content", ""))
        else:
            set_clipboard_image_from_dataurl(first_block.get("dataUrl", ""))

        time.sleep(random.uniform(0.12, 0.22))
        force_foreground(line_hwnd)
        time.sleep(random.uniform(0.08, 0.15))
        press_hotkey(VK_CONTROL, VK_V)
        return line_hwnd, False

    elif channel == "whatsapp":
        wa_hwnd = find_whatsapp_window()
        txt = first_block.get("content", "") if b_type == "text" else ""
        q_txt = urllib.parse.quote(txt)

        # 1) 국제 규격 전화번호(intl_phone) 존재 시: WhatsApp 직격 딥링크 호출
        if intl_phone:
            wa_deep = f"whatsapp://send?phone={intl_phone}&text={q_txt}" if (b_type == "text" and q_txt) else f"whatsapp://send?phone={intl_phone}"
            wa_web = f"https://web.whatsapp.com/send?phone={intl_phone}&text={q_txt}" if (b_type == "text" and q_txt) else f"https://wa.me/{intl_phone}"
            try:
                os.startfile(wa_deep)
            except Exception:
                try:
                    os.startfile(wa_web)
                except Exception as e:
                    print(f"[왓츠앱 링크 호출 오류] {e}")

            time.sleep(random.uniform(0.65, 0.95))
            wa_hwnd = find_whatsapp_window()
            if wa_hwnd and user32.IsWindow(wa_hwnd):
                force_foreground(wa_hwnd)
                time.sleep(0.15)

            if b_type == "image":
                set_clipboard_image_from_dataurl(first_block.get("dataUrl", ""))
                time.sleep(0.20)
                if wa_hwnd and user32.IsWindow(wa_hwnd):
                    force_foreground(wa_hwnd)
                time.sleep(0.10)
                press_hotkey(VK_CONTROL, VK_V)
            else:
                set_clipboard_text(first_block.get("content", ""))

            return wa_hwnd or GetForegroundWindow(), False

        # 2) 전화번호 부재 시: 왓츠앱 데스크톱 창에서 Ctrl+F 검색 후 대화방 오픈
        if not wa_hwnd:
            try:
                os.startfile("whatsapp://")
                time.sleep(0.6)
                wa_hwnd = find_whatsapp_window()
            except Exception:
                pass

        if not wa_hwnd or not user32.IsWindow(wa_hwnd):
            return None, False

        force_foreground(wa_hwnd)
        time.sleep(0.15)
        press_hotkey(VK_CONTROL, 0x46) # Ctrl + F
        time.sleep(0.12)
        press_hotkey(VK_CONTROL, 0x41)
        time.sleep(0.04)
        press_key(0x08)
        time.sleep(0.04)
        set_clipboard_text(name)
        press_hotkey(VK_CONTROL, VK_V)
        time.sleep(0.45)
        press_key(VK_RETURN)
        time.sleep(0.35)

        # 블록 주입
        if b_type == "text":
            set_clipboard_text(first_block.get("content", ""))
        else:
            set_clipboard_image_from_dataurl(first_block.get("dataUrl", ""))
        time.sleep(random.uniform(0.12, 0.20))
        force_foreground(wa_hwnd)
        time.sleep(random.uniform(0.08, 0.15))
        press_hotkey(VK_CONTROL, VK_V)
        return wa_hwnd, False

    elif channel == "wechat":
        wechat_id = ""
        for k in ["wechat_id", "wechat", "wxid", "위챗", "아이디"]:
            v = rec.get(k)
            if v is not None and str(v).strip():
                wechat_id = str(v).strip()
                break

        target_search = wechat_id or name
        wechat_hwnd = find_wechat_window()

        if not wechat_hwnd:
            try:
                os.startfile("weixin://")
                time.sleep(0.6)
                wechat_hwnd = find_wechat_window()
            except Exception:
                pass

        if not wechat_hwnd or not user32.IsWindow(wechat_hwnd):
            return None, False

        force_foreground(wechat_hwnd)
        time.sleep(0.18)

        # WeChat 데스크톱 검색창 포커스 (Ctrl + F)
        if target_search:
            press_hotkey(VK_CONTROL, 0x46)
            time.sleep(0.12)
            press_hotkey(VK_CONTROL, 0x41)
            time.sleep(0.04)
            press_key(0x08)
            time.sleep(0.04)
            set_clipboard_text(target_search)
            press_hotkey(VK_CONTROL, VK_V)
            time.sleep(0.45)
            press_key(VK_RETURN)
            time.sleep(0.35)

        # 블록 주입 (Ctrl+V)
        if b_type == "text":
            set_clipboard_text(first_block.get("content", ""))
        else:
            set_clipboard_image_from_dataurl(first_block.get("dataUrl", ""))

        time.sleep(random.uniform(0.15, 0.25))
        force_foreground(wechat_hwnd)
        time.sleep(random.uniform(0.08, 0.15))
        press_hotkey(VK_CONTROL, VK_V)
        return wechat_hwnd, False

    return None, False

# ==========================================
# 4. 일일 발송 카운트 관리
# ==========================================
STATS_FILE = os.path.join(os.environ.get("LOCALAPPDATA") or os.path.expanduser("~"), "Merlin", "senstalk_bot_stats.json")
DAILY_LIMIT = 500

def get_today_stats(force_refresh: bool = False):
    global _CACHED_TODAY_DATE, _CACHED_TODAY_COUNT
    today_str = str(date.today())
    if not force_refresh and _CACHED_TODAY_DATE == today_str:
        return _CACHED_TODAY_COUNT
    if os.path.exists(STATS_FILE):
        try:
            with open(STATS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("date") == today_str:
                    _CACHED_TODAY_DATE = today_str
                    _CACHED_TODAY_COUNT = int(data.get("count", 0))
                    return _CACHED_TODAY_COUNT
        except Exception:
            pass
    _CACHED_TODAY_DATE = today_str
    _CACHED_TODAY_COUNT = 0
    return 0

def increment_today_stats():
    global _CACHED_TODAY_DATE, _CACHED_TODAY_COUNT
    today_str = str(date.today())
    count = get_today_stats() + 1
    _CACHED_TODAY_DATE = today_str
    _CACHED_TODAY_COUNT = count
    try:
        with open(STATS_FILE, "w", encoding="utf-8") as f:
            json.dump({"date": today_str, "count": count}, f, ensure_ascii=False)
    except Exception as e:
        print(f"[경고] 통계 파일 저장 실패: {e}")
    return count

def is_chat_window(hwnd):
    if not hwnd or not user32.IsWindow(hwnd) or not user32.IsWindowVisible(hwnd):
        return False
    c = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(hwnd, c, 256)
    cls_name = c.value
    if not cls_name.startswith('EVA_Window'):
        return False
    t = ctypes.create_unicode_buffer(512)
    user32.GetWindowTextW(hwnd, t, 512)
    title = t.value
    # 메인창("카카오톡", "KakaoTalk") 제외
    if '카카오톡' in title or title.strip().lower() == 'kakaotalk' or 'īī' in title:
        return False
    # MOMENT 광고 배너창(높이 90px 내외) 및 보이지 않는 0px 창 제외
    rect = wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    height = rect.bottom - rect.top
    width = rect.right - rect.left
    if height < 180 or width < 180:
        return False
    return True

_GENERIC_CRM_PREFIX_BLACKLIST = {
    "x", "n", "화습", "고객", "회원", "무명", "임시",
    "x-네이버", "x-네이버쇼핑", "x네이버", "x네이버쇼핑", "네이버", "네이버쇼핑",
    "x-썬드림샵", "x썬드림샵", "썬드림샵", "썬드림",
    "x-개별주문", "x개별주문", "개별주문",
    "x-스마트스토어", "x스마트스토어", "스마트스토어",
    "x-쿠팡", "x쿠팡", "쿠팡", "x-옥션", "x옥션", "옥션", "x-지마켓", "x지마켓", "지마켓",
}


def _strip_crm_contact_prefix(s: str) -> str:
    """
    구글 주소록/루미노트 동기화 시 앞쪽에 붙는 시스템 접두사('N', 'X-네이버', 'X-개별주문', '화습', '[썬드림]' 등)만 정밀 제거.
    일반 성씨나 단어('새살솔솔'의 '새살', '김솔솔'의 '김')는 절대 제거하지 않아 오발송 차단을 100% 유지!
    """
    val = (s or "").strip()
    if not val:
        return ""
    val = re.sub(r'^\[(?:썬드림|임시|신규|고객|회원)\]\s*', '', val, flags=re.IGNORECASE)
    val = re.sub(r'^\((?:임시|신규)\)\s*', '', val, flags=re.IGNORECASE)
    # 구글 주소록 미정리 임시 접두사 'N' (뒤에 한글, X-, 화습, 괄호, 공백이 올 때만 제거 — 영문 닉네임 'nana' 등은 보존)
    val = re.sub(r'^[nNＮ](?=[가-힣xX\s(\[])\s*', '', val)
    # 외부몰/비회원 구분 접두사 제거 (예: 'X-네이버 (뀨용님모)2611' -> '(뀨용님모)2611', '화습(xyche)2610' -> '(xyche)2610')
    val = re.sub(
        r'^(?:[xX][-_\s]*(?:네이버쇼핑|네이버|스마트스토어|썬드림샵|개별주문|전화주문|쿠팡|옥션|지마켓|11번가|자사몰|스토어)?\s*|화습\s*(?=\())',
        '',
        val,
        flags=re.IGNORECASE,
    )
    return val.strip()


def _is_chat_title_matching_target(title: str, query_kw: str, full_target: str = "", is_phone_query: bool = False) -> bool:
    """
    열린 카카오톡 1:1 대화방의 창 제목(title)이 대상 친구와 일치하는지 검증.
    - 전화번호(10~11자리 고유 번호) 단일 검색 결과로 열린 1:1 대화방은 카톡 표시명이 실명/프로필명이어도 정상 허용.
    - 구글 주소록 접두사('N행복메신저1812', 'X-네이버(뀨용님모)2611', 'X(정승택)2611', '화습(xyche)2610') 차이는 유연하게 허용하되,
      일반 글자가 앞에 붙은 타인('새살솔솔 너부리', '김솔솔')은 원천 차단!
    """
    raw_title = (title or "").strip()
    t = raw_title.lower()
    q = (query_kw or "").strip().lower()
    f = (full_target or "").strip().lower()
    if not t or not q:
        return False

    # 단톡방(제목 끝에 인원수 및 쉼표 나열 또는 오픈채팅) 오진입 방어
    if "오픈채팅" in t:
        return False

    if is_phone_query:
        # 10~11자리 휴대폰 번호 단일 매칭으로 열린 1:1 대화방 (단톡방 다중인원 표기만 배제)
        if re.search(r',\s*\S+\s+\d+$', raw_title):
            return False
        return True

    # 1. 창 제목이 검색어(q) 또는 원본 타겟명(f)으로 시작하는 경우 허용
    if t.startswith(q) or (f and t.startswith(f)):
        return True

    # 2. 공백/슬래시/하이픈/괄호 정규화 후 검색어(norm_q)로 시작하는 경우 허용
    norm_t = re.sub(r'[\s\/\-_()\[\]]+', '', t)
    norm_q = re.sub(r'[\s\/\-_()\[\]]+', '', q)
    norm_f = re.sub(r'[\s\/\-_()\[\]]+', '', f) if f else ""
    if norm_t and norm_q and (norm_t.startswith(norm_q) or (norm_f and norm_t.startswith(norm_f))):
        return True

    # 3. CRM/주소록 접두사('N', 'X-네이버', 'X-개별주문', '화습' 등) 제거 후 핵심 식별자로 시작하는 경우 허용
    core_t = re.sub(r'[\s\/\-_()\[\]]+', '', _strip_crm_contact_prefix(raw_title).lower())
    core_q = re.sub(r'[\s\/\-_()\[\]]+', '', _strip_crm_contact_prefix(query_kw).lower())
    core_f = re.sub(r'[\s\/\-_()\[\]]+', '', _strip_crm_contact_prefix(full_target).lower()) if full_target else ""
    if core_t:
        if core_q and len(core_q) >= 2 and core_t.startswith(core_q):
            return True
        if core_f and len(core_f) >= 2 and core_t.startswith(core_f):
            return True

    # 4. 4자리 가입연월(YYMM)이 포함된 고유 식별 검색어(5자 이상, 예: '행복메신저1812', '뀨용님모2611')가 제목에 그대로 포함된 경우 허용
    if norm_q and len(norm_q) >= 5 and re.search(r'\d{4}', norm_q) and norm_q in norm_t:
        return True

    # 5. 카톡 친구 이름 20자 제한으로 창 제목 뒷부분이 잘린 경우 (검색어가 창 제목으로 시작)
    if len(t) >= 15 and (q.startswith(t) or (f and f.startswith(t))):
        return True
    if len(norm_t) >= 12 and ((norm_q and norm_q.startswith(norm_t)) or (norm_f and norm_f.startswith(norm_t))):
        return True

    return False

def find_open_chat_window(target_name: str = "", full_name_ref: str = ""):
    hDesk = ensure_desktop_attached()
    matched = []
    any_chat = []
    fg = GetForegroundWindow()
    clean_target = target_name.strip().lower()

    WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def enum_proc(hwnd, lParam):
        if is_chat_window(hwnd):
            t = ctypes.create_unicode_buffer(512)
            user32.GetWindowTextW(hwnd, t, 512)
            title = t.value.strip()
            if clean_target and _is_chat_title_matching_target(title, clean_target, full_name_ref or target_name):
                matched.append(hwnd)
            any_chat.append(hwnd)
        return True

    cb = WNDENUMPROC(enum_proc)
    if hDesk:
        EnumDesktopWindows(hDesk, cb, 0)
    else:
        user32.EnumWindows(cb, 0)

    # 1. 이름이 매칭된 대화창이 있는 경우 최우선 반환
    if matched:
        if fg in matched:
            return fg
        return matched[0]

    # [핵심] 대상 친구 이름(target_name)이 지정되어 있는데 매칭 창이 없다면,
    # 엉뚱한 단톡방이나 이전 대화창을 매칭하지 않고 반드시 None을 반환해야 함!
    if clean_target:
        return None

    # target_name이 비어있을 때만 범용 fallback
    if fg and is_chat_window(fg):
        return fg
    if len(any_chat) == 1:
        return any_chat[0]

    return None

# ==========================================
# 5. 핵심 발송 파이프라인 (Multi-Block Sequential Dispatch Engine)
# ==========================================
def _is_image_completely_uniform(img) -> bool:
    """캡처된 비트맵이 PrintWindow 실패 등으로 완전히 단색(전체 백지/흑지)인지 판별"""
    try:
        w, h = img.size
        if w <= 4 or h <= 4:
            return True
        px = img.load()
        base = px[w // 2, h // 2]
        step_x = max(1, w // 8)
        step_y = max(1, h // 10)
        for y in range(2, h - 2, step_y):
            for x in range(2, w - 2, step_x):
                p = px[x, y]
                if abs(p[0] - base[0]) > 4 or abs(p[1] - base[1]) > 4 or abs(p[2] - base[2]) > 4:
                    return False
        return True
    except Exception:
        return True


def check_kakao_search_result_count(kakao_hwnd):
    """
    카카오톡 친구 탭에서 검색 후 결과 개수를 정밀 판별 (다크모드/스킨/배율/WDDM 드라이버 전천후 호환)
    반환값:
       0: 검색 결과 0건 (결과 없음)
       1: 검색 결과 정확히 1건 (단일 대상)
       2: 검색 결과 2건 이상 (복수 대상 -> 엔터 치면 안 됨!)
      -1: 캡처 불가 또는 판별 실패 (안전 Enter + 창 제목 검증으로 폴백)
    """
    search_ctrl = None
    contact_list_view = None

    def find_views(ch, lp):
        nonlocal contact_list_view
        t = ctypes.create_unicode_buffer(256)
        user32.GetWindowTextW(ch, t, 256)
        if 'ContactListView' in t.value and not contact_list_view:
            contact_list_view = ch
        return True

    user32.EnumChildWindows(kakao_hwnd, ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)(find_views), 0)
    if not contact_list_view or not user32.IsWindow(contact_list_view):
        return -1

    def find_search_list(ch, lp):
        nonlocal search_ctrl
        t = ctypes.create_unicode_buffer(256)
        user32.GetWindowTextW(ch, t, 256)
        if 'SearchListCtrl' in t.value and user32.IsWindowVisible(ch):
            search_ctrl = ch
        return True

    user32.EnumChildWindows(contact_list_view, ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)(find_search_list), 0)

    if not search_ctrl or not user32.IsWindow(search_ctrl) or not user32.IsWindowVisible(search_ctrl):
        return -1

    try:
        from PIL import Image
        gdi32 = ctypes.windll.gdi32

        class BITMAPINFOHEADER(ctypes.Structure):
            _fields_ = [
                ('biSize', wintypes.DWORD), ('biWidth', wintypes.LONG), ('biHeight', wintypes.LONG),
                ('biPlanes', wintypes.WORD), ('biBitCount', wintypes.WORD), ('biCompression', wintypes.DWORD),
                ('biSizeImage', wintypes.DWORD), ('biXPelsPerMeter', wintypes.LONG), ('biYPelsPerMeter', wintypes.LONG),
                ('biClrUsed', wintypes.DWORD), ('biClrImportant', wintypes.DWORD)
            ]
        class BITMAPINFO(ctypes.Structure):
            _fields_ = [('bmiHeader', BITMAPINFOHEADER), ('bmiColors', wintypes.DWORD * 3)]

        with _KakaoDpiContext(kakao_hwnd):
            rect = wintypes.RECT()
            user32.GetClientRect(search_ctrl, ctypes.byref(rect))
            w = rect.right - rect.left
            h = rect.bottom - rect.top
            if w <= 0 or h <= 0:
                return -1

            bmi = BITMAPINFO()
            bmi.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
            bmi.bmiHeader.biWidth = w
            bmi.bmiHeader.biHeight = -h
            bmi.bmiHeader.biPlanes = 1
            bmi.bmiHeader.biBitCount = 32
            bmi.bmiHeader.biCompression = 0

            hdc_src = user32.GetDC(search_ctrl)
            hdc_mem = gdi32.CreateCompatibleDC(hdc_src)
            hbm = gdi32.CreateCompatibleBitmap(hdc_src, w, h)
            gdi32.SelectObject(hdc_mem, hbm)
            user32.PrintWindow(search_ctrl, hdc_mem, 2)

            buf = ctypes.create_string_buffer(w * h * 4)
            gdi32.GetDIBits(hdc_mem, hbm, 0, h, buf, ctypes.byref(bmi), 0)
            img = Image.frombuffer('RGBA', (w, h), buf, 'raw', 'BGRA', 0, 1).convert('RGB')

            gdi32.DeleteObject(hbm)
            gdi32.DeleteDC(hdc_mem)
            user32.ReleaseDC(search_ctrl, hdc_src)

            # ⭐️ 자식 윈도우 PrintWindow가 백지/흑지(단색)를 반환하는 내장그래픽 드라이버(2호컴 등) 대응:
            # 전면 활성 상태인 카톡 화면 좌표에서 직접 BitBlt 캡처하여 100% 실제 렌더링 픽셀 확보!
            if _is_image_completely_uniform(img) and GetForegroundWindow() == kakao_hwnd:
                win_rc = wintypes.RECT()
                user32.GetWindowRect(search_ctrl, ctypes.byref(win_rc))
                hdc_scr = user32.GetDC(0)
                hdc_mem2 = gdi32.CreateCompatibleDC(hdc_scr)
                hbm2 = gdi32.CreateCompatibleBitmap(hdc_scr, w, h)
                gdi32.SelectObject(hdc_mem2, hbm2)
                gdi32.BitBlt(hdc_mem2, 0, 0, w, h, hdc_scr, win_rc.left, win_rc.top, 0x00CC0020)
                buf2 = ctypes.create_string_buffer(w * h * 4)
                gdi32.GetDIBits(hdc_mem2, hbm2, 0, h, buf2, ctypes.byref(bmi), 0)
                img = Image.frombuffer('RGBA', (w, h), buf2, 'raw', 'BGRA', 0, 1).convert('RGB')
                gdi32.DeleteObject(hbm2)
                gdi32.DeleteDC(hdc_mem2)
                user32.ReleaseDC(0, hdc_scr)

        if _is_image_completely_uniform(img):
            return -1

        return _analyze_kakao_search_image(img, _kakao_dpi_scale(kakao_hwnd))
    except Exception as e:
        print(f"[카카오톡 친구 검색 분석 경고] {e}")
        return -1


def _analyze_kakao_search_image(img, fallback_scale: float = 1.0) -> int:
    """
    카톡 친구 검색 결과(SearchListCtrl) 캡처 이미지에서 결과 개수(0/1/2+) 판별
    - 배경색 동적 샘플링 + 프로필 아바타/이름 대비(Contrast) 판별로 화이트/노란스킨/다크모드 전천후 지원!
    """
    w, h = img.size
    try:
        px = img.load()

        # 1. 선택 하이라이트 띠 기반 DPI 배율 자동 보정 (라이트 회색 띠 & 다크모드 선택 띠 모두 지원)
        def _is_hl(p):
            if abs(p[0] - p[1]) > 6 or abs(p[1] - p[2]) > 6:
                return False
            return (226 <= p[0] <= 247) or (42 <= p[0] <= 68)

        x_from = int(w * 0.55)
        x_to = max(x_from + 1, w - 18)
        x_step = max(1, (x_to - x_from) // 12)
        probe_xs = list(range(x_from, x_to, x_step))

        def _row_hl(y):
            hits = sum(1 for x in probe_xs if _is_hl(px[x, y]))
            return hits >= max(1, int(len(probe_xs) * 0.6))

        top_bg = px[min(w - 1, max(0, w - 22)), min(h - 1, 6)]
        hl_top = hl_bot = -1
        y = 0
        scan_limit = min(h, 260)
        while y < scan_limit:
            if _row_hl(y):
                p_ref = px[probe_xs[0], y]
                # 상단 기본 배경과 최소 6 이상 밝기 차이가 나는 실제 선택 하이라이트 띠만 인정
                if abs(p_ref[0] - top_bg[0]) >= 6:
                    y0 = y
                    while y < h and _row_hl(y):
                        y += 1
                    if (y - y0) >= 30:
                        hl_top, hl_bot = y0, y
                        break
            y += 1

        calibrated = False
        if hl_top >= 0:
            row_h = hl_bot - hl_top
            s_cal = row_h / 56.0
            if 0.75 <= s_cal <= 3.2 and hl_top <= int(44 * s_cal):
                calibrated = True
                scale = s_cal
                r1_top, r1_bottom = hl_top, hl_bot
                r2_top = hl_bot + int(4 * scale)
                r2_bottom = min(h, hl_bot + int(54 * scale))

        if not calibrated:
            scale = fallback_scale or 1.0
            r1_top = int(28 * scale)
            r1_bottom = min(h, int(80 * scale))
            r2_top = int(88 * scale)
            r2_bottom = min(h, int(140 * scale))

        if r1_bottom <= r1_top:
            return -1

        def _sample_row_bg(y_top, y_bot):
            sx = max(0, min(w - 1, w - int(22 * scale)))
            rs, gs, bs = [], [], []
            step = max(1, (y_bot - y_top) // 7)
            for sy in range(y_top + 2, max(y_top + 3, y_bot - 2), step):
                c = px[sx, min(h - 1, sy)]
                rs.append(c[0])
                gs.append(c[1])
                bs.append(c[2])
            if not rs:
                return top_bg
            rs.sort()
            gs.sort()
            bs.sort()
            mid = len(rs) // 2
            return (rs[mid], gs[mid], bs[mid])

        def _count_contrast(x0, y0, x1, y1, bg, thresh=34):
            x0 = max(0, min(w, x0))
            x1 = max(x0, min(w, x1))
            y0 = max(0, min(h, y0))
            y1 = max(y0, min(h, y1))
            if x1 <= x0 or y1 <= y0:
                return 0
            cnt = 0
            br, bg_g, bb = bg
            for yy in range(y0, y1):
                for xx in range(x0, x1):
                    p = px[xx, yy]
                    if abs(p[0] - br) >= thresh or abs(p[1] - bg_g) >= thresh or abs(p[2] - bb) >= thresh:
                        cnt += 1
            return cnt

        area_k = scale * scale
        bg1 = _sample_row_bg(r1_top, r1_bottom)
        av1 = _count_contrast(int(14 * scale), r1_top, int(64 * scale), r1_bottom, bg1, 32)
        txt1 = _count_contrast(int(68 * scale), r1_top, min(w, int(225 * scale)), r1_bottom, bg1, 36)

        # 0건('검색 결과가 없습니다.'는 화면 중앙에 위치하므로 상단 1행 좌측 아바타 영역 av1이 0에 수렴)
        if av1 < int(14 * area_k) and txt1 < int(20 * area_k):
            return 0

        if r2_top >= h - int(10 * scale) or r2_bottom <= r2_top:
            return 1

        bg2 = _sample_row_bg(r2_top, r2_bottom)
        av2 = _count_contrast(int(14 * scale), r2_top, int(64 * scale), r2_bottom, bg2, 32)
        txt2 = _count_contrast(int(72 * scale), r2_top, min(w, int(225 * scale)), r2_bottom, bg2, 42)

        # 2행에 두 번째 프로필 아바타(av2)와 두 번째 이름 텍스트(txt2)가 모두 명확히 존재할 때만 복수(2+) 판정!
        if av2 < int(16 * area_k) or txt2 < int(15 * area_k):
            return 1
        return 2
    except Exception as e:
        print(f"[카카오톡 친구 검색 분석 경고] {e}")
        return -1

def wait_for_user_to_open_chat(kakao_hwnd, target_name: str, timeout_sec: float = 180.0, expected_seq_id: int = None):
    """
    친구 검색 결과가 복수(동명이인/유사명단)일 때 봇이 임의로 첫 번째 방을 열지 않고
    유저가 마우스로 직접 원하는 대화방을 열 때까지 멈추고 안전 대기.
    유저가 대화방을 여는 즉시 chat_hwnd를 반환하여 메시지 자동 장전으로 연결.
    """
    global LAST_EVENT, BOT_RUNNING
    try:
        winsound.MessageBeep(winsound.MB_ICONEXCLAMATION)
    except Exception:
        pass

    clean_name = target_name.strip()
    print("\n" + "!" * 64)
    print(f"⚠️  [동명이인/복수 검색 감지] '{clean_name}' 검색 결과가 2명 이상(복수)입니다!")
    print(f"👉  카카오톡 창에서 보낼 대상을 직접 마우스로 더블클릭하여 대화방을 열어주세요.")
    print(f"    (대화방이 열리면 센스봇이 자동으로 메시지를 장전하고 다음 단계로 진행합니다.)")
    print("!" * 64 + "\n")

    with STATE_LOCK:
        LAST_EVENT = {
            "type": "waiting_friend_select",
            "name": clean_name,
            "message": f"'{clean_name}' 친구가 2명 이상 검색되었습니다. 카카오톡에서 보낼 대상을 직접 클릭해 대화방을 열어주세요.",
            "timestamp": time.time()
        }

    # 카카오톡 메인창을 전면으로 부각
    force_foreground(kakao_hwnd)

    start_wait = time.time()
    last_print = 0

    while time.time() - start_wait < timeout_sec:
        # 유저가 웹 UI 등에서 일시정지(Pause), 패스(Skip) 또는 리셋(Reset)한 경우 즉시 대기 종료
        if not BOT_RUNNING or (expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID):
            print("⏹️ 발송 엔진 상태가 변경(정지/패스)되어 이전 선택 대기를 종료합니다.")
            return None

        # 유저가 카카오톡에서 대화방을 열었는지 감지 (전면 창이 1:1 대화방인지)
        fg_hwnd = GetForegroundWindow()
        if fg_hwnd and fg_hwnd != kakao_hwnd and is_chat_window(fg_hwnd):
            if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
                return None
            t = ctypes.create_unicode_buffer(512)
            user32.GetWindowTextW(fg_hwnd, t, 512)
            opened_title = t.value.strip()
            print(f"✨ [대화방 열림 감지] 유저가 선택한 대화방 감지: '{opened_title}' (HWND: {fg_hwnd})")
            try:
                winsound.MessageBeep(winsound.MB_OK)
            except Exception:
                pass
            time.sleep(0.25)
            return fg_hwnd

        # 10초마다 콘솔 리마인더 안내
        now = time.time()
        if now - last_print > 10:
            last_print = now
            remain = int(timeout_sec - (now - start_wait))
            print(f"⏳ [선택 대기 중...] 카카오톡에서 '{clean_name}' 대상을 클릭해 대화방을 열어주세요. (남은 대기시간: {remain}초)")

        time.sleep(0.15)

    print(f"⏱️ '{clean_name}' 친구 선택 대기 시간이 초과되었습니다 (180초).")
    with STATE_LOCK:
        BOT_RUNNING = False
        LAST_EVENT = {
            "type": "paused",
            "reason": "selection_timeout",
            "name": clean_name,
            "message": f"'{clean_name}' 친구 선택 대기 시간 초과로 발송이 일시정지되었습니다.",
            "timestamp": time.time()
        }
    return None

def _notify_edit_en_change(search_edit, fallback_parent=None):
    """Win32 Edit 컨트롤 텍스트 변경 시 부모(ContactListView)에 EN_CHANGE(0x0300) 통지 강제 발송"""
    try:
        ctrl_id = user32.GetDlgCtrlID(wintypes.HWND(search_edit))
        parent_h = user32.GetParent(wintypes.HWND(search_edit)) or fallback_parent
        if parent_h and user32.IsWindow(parent_h):
            user32.PostMessageW(
                wintypes.HWND(parent_h),
                0x0111,
                wintypes.WPARAM((0x0300 << 16) | (ctrl_id & 0xFFFF)),
                wintypes.LPARAM(search_edit),
            )
    except Exception:
        pass


def _retype_kakao_search_wmchar(search_edit, keyword: str, fallback_parent=None):
    """카톡 친구 검색창의 한글 IME 잔여 조합을 정리하고 실제 키보드 타이핑과 동일한 WM_CHAR + EN_CHANGE로 검색어 입력"""
    try:
        try:
            imm32 = ctypes.windll.imm32
            himc = imm32.ImmGetContext(wintypes.HWND(search_edit))
            if himc:
                imm32.ImmNotifyIME(himc, 0x0015, 4, 0)  # NI_COMPOSITIONSTR / CPS_CANCEL
                imm32.ImmReleaseContext(wintypes.HWND(search_edit), himc)
        except Exception:
            pass
        empty_buf = ctypes.create_unicode_buffer("")
        user32.SendMessageW(search_edit, 0x000C, 0, empty_buf)  # WM_SETTEXT ''
        user32.SendMessageW(search_edit, 0x00B1, 0, -1)         # EM_SETSEL 전체 선택
        user32.SendMessageW(search_edit, 0x0100, 0x08, 0)       # WM_KEYDOWN VK_BACK
        user32.SendMessageW(search_edit, 0x0102, 0x08, 0)       # WM_CHAR BACKSPACE
        user32.SendMessageW(search_edit, 0x0101, 0x08, 0)
        for ch in keyword:
            user32.SendMessageW(search_edit, 0x0102, ord(ch), 0)  # WM_CHAR

        read_kw = ctypes.create_unicode_buffer(256)
        user32.SendMessageW(search_edit, 0x000D, 250, read_kw)
        if read_kw.value.strip() != keyword:
            buf_kw = ctypes.create_unicode_buffer(keyword)
            user32.SendMessageW(search_edit, 0x000C, 0, buf_kw)
            _notify_edit_en_change(search_edit, fallback_parent)

        user32.SendMessageW(search_edit, 0x0100, 0x23, 0)   # VK_END (검색 디바운스 타이머 기동 보강)
        user32.SendMessageW(search_edit, 0x0101, 0x23, 0)
        _notify_edit_en_change(search_edit, fallback_parent)
        return True
    except Exception as e:
        print(f"[카카오톡 친구 검색] WM_CHAR 재입력 실패: {e}")
        return False


def _try_search_friend_chat(
    kakao_hwnd,
    search_keyword: str,
    full_name_ref: str = "",
    expected_seq_id: int = None,
    is_phone_query: bool = False,
):
    """
    카카오톡 친구 탭에서 특정 키워드로 검색 후 1:1 대화방 오픈 시도
    - 단일 결과(1명): 자동으로 [Enter] 타건하여 1:1 대화방 즉시 오픈
    - 복수 결과(2명 이상): ⭐️ 첫 번째 친구를 무자비하게 열지 않고 유저가 마우스로 선택할 때까지 대기
    - 0건 결과: 고유 식별자(4자리 숫자 포함 등)인 경우 픽셀 오판 방지를 위해 안전 Enter 1회 검증 후 복원!
    """
    clean_kw = search_keyword.strip()
    if not clean_kw:
        return None
    if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
        return None

    # 1. 친구 탭 보장 및 이전 검색 상태(백지 SearchListCtrl 등) 완전 초기화
    search_edit = ensure_friends_tab(kakao_hwnd)
    if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
        return None
    if GetForegroundWindow() != kakao_hwnd:
        force_foreground(kakao_hwnd)
        time.sleep(0.03)

    # 2. 검색바(Search Bar) 실제 열림 보장:
    # 공식 단축키 Ctrl+F를 최우선 사용하여 상단 아이콘 위치 변화([친구 추가] 팝업 오클릭) 원천 차단!
    views = _get_kakao_friend_views(kakao_hwnd)
    if not views["is_contact_view_vis"]:
        ensure_friends_tab(kakao_hwnd)
        views = _get_kakao_friend_views(kakao_hwnd)
    search_edit = views["search_edit"] or search_edit
    contact_view = views["contact_view"]
    if not views["is_search_bar_open"]:
        if GetForegroundWindow() != kakao_hwnd:
            force_foreground(kakao_hwnd)
            time.sleep(0.02)
        press_hotkey(VK_CONTROL, VK_F)
        for _ in range(10):
            time.sleep(0.025)
            views = _get_kakao_friend_views(kakao_hwnd)
            if views["is_search_bar_open"]:
                break
        if not views["is_search_bar_open"] and contact_view and user32.IsWindow(contact_view):
            s_open = views.get("dpi_s", 1.0)
            if views["cv_w"] > int(150 * s_open):
                for right_off in (108, 72):
                    lp_open = (int(28 * s_open) << 16) | ((views["cv_w"] - int(right_off * s_open)) & 0xFFFF)
                    user32.SendMessageW(contact_view, 0x0201, 1, lp_open)
                    user32.SendMessageW(contact_view, 0x0202, 0, lp_open)
                    time.sleep(0.03)
                    views = _get_kakao_friend_views(kakao_hwnd)
                    if views["is_search_bar_open"]:
                        break
        search_edit = views["search_edit"] or search_edit

    # 3. 친구 검색창 포커스 안착 및 WM_CHAR + EN_CHANGE 방식으로 검색어 정확 주입
    search_set = False
    if search_edit and user32.IsWindow(search_edit):
        try:
            cur_tid = kernel32.GetCurrentThreadId()
            kakao_tid = user32.GetWindowThreadProcessId(kakao_hwnd, None)
            user32.AttachThreadInput(cur_tid, kakao_tid, True)
            user32.SetFocus(search_edit)
            user32.AttachThreadInput(cur_tid, kakao_tid, False)
        except Exception:
            pass

        _retype_kakao_search_wmchar(search_edit, clean_kw, fallback_parent=contact_view)
        read_kw = ctypes.create_unicode_buffer(256)
        user32.SendMessageW(search_edit, 0x000D, 250, read_kw)
        if read_kw.value.strip() == clean_kw:
            search_set = True
        else:
            set_clipboard_text(clean_kw)
            time.sleep(0.015)
            user32.SendMessageW(search_edit, 0x00B1, 0, -1)
            user32.SendMessageW(search_edit, 0x0302, 0, 0)  # WM_PASTE
            _notify_edit_en_change(search_edit, contact_view)
            user32.SendMessageW(search_edit, 0x0100, 0x23, 0)
            user32.SendMessageW(search_edit, 0x0101, 0x23, 0)
            search_set = True

    if not search_set:
        if GetForegroundWindow() == kakao_hwnd:
            set_clipboard_text(clean_kw)
            press_hotkey(VK_CONTROL, VK_V)
        else:
            print(f"[카카오톡 친구 검색] 메인창 포커스 미확보로 안전 패스 ('{clean_kw}')")
            _reset_kakao_friend_search_ui(kakao_hwnd)
            return None

    # 4. 카카오톡 검색 디바운스 타이머 완료 및 SearchListCtrl 활성화 폴링 대기 (최대 0.55초)
    t_search_wait = time.time()
    retriggered = False
    while time.time() - t_search_wait < 0.55:
        if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
            _reset_kakao_friend_search_ui(kakao_hwnd)
            return None
        time.sleep(0.025)
        views = _get_kakao_friend_views(kakao_hwnd)
        if views["is_search_list_vis"]:
            time.sleep(0.05)  # SearchListCtrl 항목 렌더링 안정화
            break
        if not retriggered and (time.time() - t_search_wait) > 0.32 and search_edit and user32.IsWindow(search_edit):
            retriggered = True
            _notify_edit_en_change(search_edit, contact_view)
            user32.SendMessageW(search_edit, 0x0100, 0x23, 0)
            user32.SendMessageW(search_edit, 0x0101, 0x23, 0)

    if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
        _reset_kakao_friend_search_ui(kakao_hwnd)
        return None

    # ⭐️ [핵심] 검색 결과 개수 정밀 판별 (0건 vs 1건 vs 2건 이상 복수)
    result_count = check_kakao_search_result_count(kakao_hwnd)

    if result_count in (0, 2):
        prev_cnt = result_count
        for _ in range(3):
            if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
                break
            time.sleep(0.10)
            cur_cnt = check_kakao_search_result_count(kakao_hwnd)
            if cur_cnt == prev_cnt:
                break
            prev_cnt = cur_cnt
        result_count = prev_cnt

    if result_count == 2 and not is_phone_query:
        if SYNCED_STATE.get("autoSkipAmbiguous"):
            print(f"⏩ [동명이인 자동 패스 모드] '{clean_kw}' 검색 결과 복수(2명+) 감지 -> 대기 없이 다음 후보/자동 패스 진행!")
            _reset_kakao_friend_search_ui(kakao_hwnd)
            return None
        target_disp = full_name_ref or clean_kw
        chat_hwnd = wait_for_user_to_open_chat(kakao_hwnd, target_disp, expected_seq_id=expected_seq_id)
        _reset_kakao_friend_search_ui(kakao_hwnd, background_only=bool(chat_hwnd))
        return chat_hwnd

    # 고유 식별 쿼리(연월 4자리 숫자 포함 또는 휴대폰 번호)는 픽셀 캡처가 설령 0으로 오판하더라도
    # 1회 안전 Enter 프로브를 허용하여(진짜 0건이면 아무 창도 안 열리고, 1건이면 제목 매칭으로 검증!) 미발견 오판을 100% 박멸!
    is_high_specificity_kw = bool(is_phone_query or re.search(r'\d{4}', clean_kw))
    if result_count == 0 and not is_high_specificity_kw:
        print(f"[카카오톡 친구 검색] '{clean_kw}' 검색 결과 0건 (목록 없음 -> 친구목록 복원)")
        _reset_kakao_friend_search_ui(kakao_hwnd)
        return None

    if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
        _reset_kakao_friend_search_ui(kakao_hwnd)
        return None

    pre_enter_chats = set()
    def _enum_pre_chats(h, lp):
        if is_chat_window(h):
            pre_enter_chats.add(h)
        return True
    try:
        user32.EnumWindows(ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)(_enum_pre_chats), 0)
    except Exception:
        pass

    if GetForegroundWindow() != kakao_hwnd:
        force_foreground(kakao_hwnd)
        time.sleep(0.02)
    if search_edit and user32.IsWindow(search_edit):
        try:
            cur_tid = kernel32.GetCurrentThreadId()
            kakao_tid = user32.GetWindowThreadProcessId(kakao_hwnd, None)
            user32.AttachThreadInput(cur_tid, kakao_tid, True)
            user32.SetFocus(search_edit)
            user32.AttachThreadInput(cur_tid, kakao_tid, False)
        except Exception:
            pass

    press_key(VK_RETURN)
    _flush_enter_key_state()

    def _poll_opened_chat(max_wait_sec: float):
        start_w = time.time()
        while time.time() - start_w < max_wait_sec:
            if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
                return None
            fg_h = GetForegroundWindow()
            if fg_h and fg_h != kakao_hwnd and is_chat_window(fg_h):
                t_buf = ctypes.create_unicode_buffer(512)
                user32.GetWindowTextW(fg_h, t_buf, 512)
                opened_title = t_buf.value.strip()
                if fg_h not in pre_enter_chats or (CURRENT_CHAT_HWND and fg_h != CURRENT_CHAT_HWND):
                    if _is_chat_title_matching_target(opened_title, clean_kw, full_name_ref, is_phone_query=is_phone_query):
                        return fg_h
                    else:
                        print(f"🚨 [오발송 원천 차단] 검색어('{clean_kw}')로 열린 대화방('{opened_title}')이 대상('{full_name_ref or clean_kw}')과 불일치하여 즉시 닫습니다!")
                        try:
                            user32.SendMessageW(wintypes.HWND(fg_h), 0x0010, wintypes.WPARAM(0), wintypes.LPARAM(0))
                            time.sleep(0.04)
                        except Exception:
                            pass
                        return "MISMATCH_CLOSED"
                if _is_chat_title_matching_target(opened_title, clean_kw, full_name_ref, is_phone_query=is_phone_query):
                    return fg_h
            if not is_phone_query:
                found_h = find_open_chat_window(clean_kw, full_name_ref) or (find_open_chat_window(full_name_ref, full_name_ref) if full_name_ref else None)
                if found_h:
                    return found_h
            time.sleep(0.03)
        return None

    chat_hwnd = _poll_opened_chat(0.20 if result_count == 0 else 0.28)
    if chat_hwnd == "MISMATCH_CLOSED":
        _reset_kakao_friend_search_ui(kakao_hwnd)
        return None

    if not chat_hwnd and result_count != 0:
        if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
            _reset_kakao_friend_search_ui(kakao_hwnd)
            return None
        press_key(VK_DOWN)
        time.sleep(0.04)
        press_key(VK_RETURN)
        _flush_enter_key_state()
        chat_hwnd = _poll_opened_chat(0.42)
        if chat_hwnd == "MISMATCH_CLOSED":
            _reset_kakao_friend_search_ui(kakao_hwnd)
            return None

    _reset_kakao_friend_search_ui(kakao_hwnd, background_only=bool(chat_hwnd))
    return chat_hwnd


def _is_valid_fallback_keyword(cand: str, primary_query: str) -> bool:
    c = (cand or "").strip()[:20]
    if len(c) < 2 or c == primary_query:
        return False
    norm_low = re.sub(r'[\s\-_()\[\]]+', '', c).lower()
    if not norm_low or norm_low in _GENERIC_CRM_PREFIX_BLACKLIST:
        return False
    if c.lower() in _GENERIC_CRM_PREFIX_BLACKLIST:
        return False
    return True


def open_or_focus_chat_window(
    target_name: str,
    fallback_nickname: str = "",
    phone: str = "",
    expected_seq_id: int = None,
):
    """
    대상 친구와의 1:1 대화방을 찾거나 검색하여 열고 포커스 활성화
    - 1차: target_name (최초 '/' 앞 별명+연월, 최대 20자 규격) 검색
    - 2차: 공백 제거본('X-네이버(뀨용님모)2611'), 괄호안이름+연월('뀨용님모2611'), 접두사 제거본, 순수 별명('뀨용님모') 순차 검색
    - 3차: 휴대폰 번호('01095041336', '010-9504-1336') 검색 (PC 카톡에 실명/타 별명으로 저장된 동기화 친구 자동 매칭!)
    반환: (chat_hwnd, pre_opened)
    """
    time.sleep(0.02)
    if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
        return None, False

    target_name = (target_name or "").strip()
    fallback_nickname = (fallback_nickname or "").strip()
    phone = (phone or "").strip()
    global _LAST_KAKAO_NOTFOUND_KW
    _LAST_KAKAO_NOTFOUND_KW = ""

    if '/' in target_name:
        primary_query = target_name.split('/')[0].strip()[:20]
    else:
        primary_query = target_name[:20].strip()

    fallback_candidates = []
    def _add_fb(cand_str: str):
        c = (cand_str or "").strip()[:20]
        if _is_valid_fallback_keyword(c, primary_query) and c not in fallback_candidates:
            fallback_candidates.append(c)

    if primary_query:
        # 1) 공백 제거형 (예: 'X-네이버 (뀨용님모)2611' -> 'X-네이버(뀨용님모)2611', '상상초월 비D 에녹1909' -> '상상초월비D에녹1909')
        if ' ' in primary_query:
            _add_fb(re.sub(r'\s+', '', primary_query))

        # 2) 외부몰/임시 접두사 제거 + 연월 유지형 (예: 'X-네이버 (뀨용님모)2611' -> '뀨용님모2611')
        stripped_core = _strip_crm_contact_prefix(primary_query)
        if stripped_core:
            _add_fb(stripped_core)
            _add_fb(re.sub(r'[()\s]+', '', stripped_core))

        # 3) 괄호 안 이름 + 뒤쪽 연월 조합 및 괄호 안 순수 이름 (예: 'X-네이버 (뀨용님모)2611' -> '뀨용님모2611', '뀨용님모')
        if '(' in primary_query and ')' in primary_query:
            m_paren_date = re.search(r'\(([^()]+)\)\s*(\d{4,8})?', primary_query)
            if m_paren_date:
                inner_nm = m_paren_date.group(1).strip()
                tail_dt = (m_paren_date.group(2) or "").strip()
                if inner_nm and tail_dt:
                    _add_fb(f"{inner_nm}{tail_dt}")
                if inner_nm:
                    _add_fb(inner_nm)

        # 4) 숫자(4~8자리 연월/연월일) 뒤 제품명 접미사 제거 (예: '달별삐네220124미니' -> '달별삐네220124')
        m_with_date = re.match(r'^([^\d\-\_/()]+?\s*\d{4,8})\D+$', primary_query)
        if m_with_date:
            _add_fb(m_with_date.group(1))

    # 5) 명시적 별명(fallback_nickname) 및 뒤쪽 숫자 제거 순수 별명
    if fallback_nickname:
        _add_fb(fallback_nickname)
        if ' ' in fallback_nickname:
            _add_fb(re.sub(r'\s+', '', fallback_nickname))

    if primary_query:
        m_prefix = re.match(r'^([^\d\-\_/()]+?)\s*\d{4,8}', primary_query)
        if m_prefix:
            _add_fb(m_prefix.group(1))
        clean_nick = re.sub(r'\d{2,8}$', '', primary_query).strip()
        _add_fb(clean_nick)
        if ' ' in clean_nick:
            _add_fb(re.sub(r'\s+', '', clean_nick))
        if '(' in primary_query:
            cand_before_paren = re.sub(r'\d{2,8}$', '', primary_query.split('(')[0]).strip()
            _add_fb(cand_before_paren)

    # 6) 휴대폰 번호 후보군 (010xxxxxxxx / 010-xxxx-xxxx)
    phone_candidates = []
    phone_digits = re.sub(r'[^0-9]', '', phone)
    if re.match(r'^01[016789]\d{7,8}$', phone_digits) and phone_digits not in ("01000000000", "01012345678"):
        phone_candidates.append(phone_digits)
        if len(phone_digits) == 11:
            phone_candidates.append(f"{phone_digits[:3]}-{phone_digits[3:7]}-{phone_digits[7:]}")
        elif len(phone_digits) == 10:
            phone_candidates.append(f"{phone_digits[:3]}-{phone_digits[3:6]}-{phone_digits[6:]}")

    # 1. 대상 친구와의 1:1 대화창이 이미 열려있는 경우 (0초 즉시 직통)
    existing_chat = find_open_chat_window(primary_query, target_name)
    if not existing_chat:
        for fb_q in fallback_candidates:
            existing_chat = find_open_chat_window(fb_q, target_name)
            if existing_chat:
                break
    if existing_chat:
        force_foreground(existing_chat)
        return existing_chat, True

    # 2. 카카오톡 메인창 탐색 및 활성화
    kakao_hwnd = find_kakaotalk_window()
    if not kakao_hwnd:
        return None, False

    # 3. 1차 시도: 20자 규격 이름으로 검색
    if primary_query:
        chat_hwnd = _try_search_friend_chat(kakao_hwnd, primary_query, target_name, expected_seq_id=expected_seq_id)
        if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
            return None, False
        if chat_hwnd:
            force_foreground(chat_hwnd)
            return chat_hwnd, False

    if not BOT_RUNNING or (expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID):
        return None, False

    # 4. 2차 시도: 스마트 폴백 별명 후보군 순차 검색
    for fb_q in fallback_candidates:
        if not BOT_RUNNING or (expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID):
            return None, False
        print(f"[카카오톡 친구 검색] 1차 실패('{primary_query}') -> 폴백 별명 검색 시도: '{fb_q}'")
        chat_hwnd = _try_search_friend_chat(kakao_hwnd, fb_q, target_name, expected_seq_id=expected_seq_id)
        if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
            return None, False
        if chat_hwnd:
            print(f"[카카오톡 친구 검색] 폴백 별명 검색 성공: '{fb_q}' (대상: '{target_name}')")
            force_foreground(chat_hwnd)
            return chat_hwnd, False

    # 5. 3차 시도: 휴대폰 번호 검색 (스마트폰 주소록에 실명/다른 별명으로 저장된 고객 자동 탐색!)
    for ph_q in phone_candidates:
        if not BOT_RUNNING or (expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID):
            return None, False
        print(f"[카카오톡 친구 검색] 이름 미매칭('{primary_query}') -> 전화번호 검색 시도: '{ph_q}'")
        chat_hwnd = _try_search_friend_chat(
            kakao_hwnd,
            ph_q,
            target_name,
            expected_seq_id=expected_seq_id,
            is_phone_query=True,
        )
        if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
            return None, False
        if chat_hwnd:
            print(f"[카카오톡 친구 검색] 전화번호 검색 성공: '{ph_q}' (대상: '{target_name}')")
            force_foreground(chat_hwnd)
            return chat_hwnd, False

    print(f"[카카오톡 친구 검색] 최종 검색 실패: '{primary_query}'" + (f" (폴백: {fallback_candidates}, 번호: {phone_candidates})" if (fallback_candidates or phone_candidates) else ""))
    if SYNCED_STATE.get("autoSkipAmbiguous"):
        _reset_kakao_friend_search_ui(kakao_hwnd)
        set_clipboard_text("")
        return None, False
    # 카톡 검색창에 가장 직관적인 순수 별명 검색어를 남겨두어 유저가 수동 더블클릭 시 즉시 자동 장전·재개되도록 지원
    show_kw = fallback_nickname or (fallback_candidates[-1] if fallback_candidates else primary_query)
    _show_kakao_search_result_screen(kakao_hwnd, show_kw)
    return None, False


def _watch_manual_chat_open_after_not_found(kakao_hwnd, target_rec: dict, blocks_to_load: list, target_idx: int, expected_seq_id: int, timeout_sec: float = 180.0):
    """
    카톡 친구 자동 검색 미발견(not_found) 이후, 유저가 카톡 검색창에서 일부 일치하는 친구를 클릭해
    1:1 대화방을 수동으로 열었을 때 이를 실시간 감지하여 즉시 1번 블록을 자동 장전하고 엔터 연속 발송을 재개합니다.
    """
    global BOT_RUNNING, WAITING_FOR_USER_ENTER, CURRENT_CHAT_HWND, CURRENT_POPUP_HWND
    global CURRENT_TARGET_REC, CURRENT_TARGET_INDEX, CURRENT_REC_BLOCKS, CURRENT_BLOCK_INDEX, LAST_EVENT, WATCHING_MANUAL_CHAT

    prev_chat_hwnd = CURRENT_CHAT_HWND
    with STATE_LOCK:
        CURRENT_CHAT_HWND = None
        WATCHING_MANUAL_CHAT = True

    pre_chats = set()
    def _enum_pre(h, lp):
        if is_chat_window(h):
            pre_chats.add(h)
        return True
    try:
        user32.EnumWindows(ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)(_enum_pre), 0)
    except Exception:
        pass

    name = _get_rec_display_name(target_rec)
    total_b = len(blocks_to_load)
    start_t = time.time()

    try:
        while time.time() - start_t < timeout_sec:
            if expected_seq_id != _DISPATCH_SEQ_ID:
                return
            if not _is_rec_pending(target_rec):
                return

            fg_h = GetForegroundWindow()
            if fg_h and fg_h != kakao_hwnd and is_chat_window(fg_h):
                # 직전 수신자의 닫히는 창(prev_chat_hwnd)만 제외하고, 새로 열렸거나 유저가 클릭해 전면으로 올린 모든 대화방을 즉시 감지!
                if (fg_h not in pre_chats) or (fg_h != prev_chat_hwnd):
                    time.sleep(0.18)
                    if expected_seq_id != _DISPATCH_SEQ_ID or not _is_rec_pending(target_rec):
                        return
                    if not user32.IsWindow(fg_h) or not user32.IsWindowVisible(fg_h):
                        continue
                    # 유저가 카톡 검색 목록에서 Enter 키로 대화방을 연 경우 물리 Enter 키가 떼어질 때까지 안전 대기 (장전 직후 오발송 방지)
                    _flush_enter_key_state()

                    t_buf = ctypes.create_unicode_buffer(512)
                    user32.GetWindowTextW(fg_h, t_buf, 512)
                    opened_title = t_buf.value.strip()
                    print(f"\n✨ [수동 친구 선택 감지] 유저가 수동으로 연 대화방 감지: '{opened_title}' (대상: '{name}') -> 즉시 메시지 자동 장전 및 진행 재개!")

                    if kakao_hwnd and user32.IsWindow(kakao_hwnd):
                        _reset_kakao_friend_search_ui(kakao_hwnd, background_only=True)

                    first_block = blocks_to_load[0]
                    dispatch_single_block(fg_h, first_block, expected_seq_id=expected_seq_id)
                    if expected_seq_id != _DISPATCH_SEQ_ID:
                        return

                    with STATE_LOCK:
                        if expected_seq_id != _DISPATCH_SEQ_ID:
                            return
                        recs_now = SYNCED_STATE.get("recipients", [])
                        bound_rec = target_rec
                        bound_idx = target_idx
                        rec_id_chk = target_rec.get("id")
                        if isinstance(bound_idx, int) and 0 <= bound_idx < len(recs_now):
                            cand_r = recs_now[bound_idx]
                            if (rec_id_chk and cand_r.get("id") == rec_id_chk) or (_get_rec_display_name(cand_r) == name):
                                bound_rec = cand_r
                        else:
                            for i_r, cand_r in enumerate(recs_now):
                                if (rec_id_chk and cand_r.get("id") == rec_id_chk) or (_get_rec_display_name(cand_r) == name):
                                    bound_rec = cand_r
                                    bound_idx = i_r
                                    break
                        bound_rec["_pre_opened"] = False
                        SYNCED_STATE["currentIndex"] = bound_idx
                        CURRENT_TARGET_REC = bound_rec
                        CURRENT_TARGET_INDEX = bound_idx
                        CURRENT_REC_BLOCKS = blocks_to_load
                        CURRENT_BLOCK_INDEX = 0
                        CURRENT_CHAT_HWND = fg_h
                        CURRENT_POPUP_HWND = None
                        BOT_RUNNING = True
                        WAITING_FOR_USER_ENTER = True
                        LAST_EVENT = {
                            "type": "loaded_waiting_enter",
                            "id": bound_rec.get("id"),
                            "name": name,
                            "currentIndex": bound_idx,
                            "blockIndex": 0,
                            "totalBlocks": total_b,
                            "blockType": first_block["type"],
                            "channel": "kakao",
                            "timestamp": time.time()
                        }
                    try:
                        winsound.MessageBeep(winsound.MB_OK)
                    except Exception:
                        pass
                    return

            time.sleep(0.10)
    finally:
        with STATE_LOCK:
            if expected_seq_id == _DISPATCH_SEQ_ID:
                WATCHING_MANUAL_CHAT = False


def _show_kakao_search_result_screen(kakao_hwnd, keyword: str):
    """카톡 친구 탭 검색창에 검색어를 입력한 상태로 결과 화면(0건이면 '검색 결과 없음')을 유저에게 그대로 노출"""
    global _LAST_KAKAO_NOTFOUND_KW
    kw = (keyword or "").strip()
    _LAST_KAKAO_NOTFOUND_KW = kw
    if not kw or not kakao_hwnd or not user32.IsWindow(kakao_hwnd):
        return False
    try:
        search_edit = ensure_friends_tab(kakao_hwnd)
        views = _get_kakao_friend_views(kakao_hwnd)
        search_edit = views["search_edit"] or search_edit
        contact_view = views["contact_view"]
        if not views["is_search_bar_open"]:
            force_foreground(kakao_hwnd)
            time.sleep(0.02)
            press_hotkey(VK_CONTROL, VK_F)
            time.sleep(0.08)
            views = _get_kakao_friend_views(kakao_hwnd)
            if not views["is_search_bar_open"]:
                s_open = views.get("dpi_s", 1.0)
                if contact_view and user32.IsWindow(contact_view) and views["cv_w"] > int(150 * s_open):
                    for right_off in (108, 72):
                        lp_open = (int(28 * s_open) << 16) | ((views["cv_w"] - int(right_off * s_open)) & 0xFFFF)
                        user32.SendMessageW(contact_view, 0x0201, 1, lp_open)
                        user32.SendMessageW(contact_view, 0x0202, 0, lp_open)
                        time.sleep(0.03)
                        views = _get_kakao_friend_views(kakao_hwnd)
                        if views["is_search_bar_open"]:
                            break
            search_edit = views["search_edit"] or search_edit
        if not search_edit or not user32.IsWindow(search_edit):
            return False
        # 실제 타이핑과 동일한 WM_CHAR + EN_CHANGE 입력으로 카톡 검색 필터를 확실히 갱신
        _retype_kakao_search_wmchar(search_edit, kw, fallback_parent=contact_view)
        t0 = time.time()
        while time.time() - t0 < 0.6:
            time.sleep(0.03)
            if _get_kakao_friend_views(kakao_hwnd)["is_search_list_vis"]:
                break
        force_foreground(kakao_hwnd)
        print(f"[카카오톡 친구 검색] 검색 결과 화면 노출 유지: '{kw}' (유저 직접 확인용)")
        return True
    except Exception as e:
        print(f"[카카오톡 친구 검색] 결과 화면 노출 실패: {e}")
        return False

def execute_dispatch(target_name: str, message: str = "", mode: str = "classic", blocks: list = None, rec: dict = None, condition: dict = None, channel: str = "kakao"):
    """단일 수신자 1:1 테스트 발송 및 다중 블록(B1, B2...) 순차 장전 인터페이스"""
    global WAITING_FOR_USER_ENTER, BOT_RUNNING, IS_TEST_MODE, LAST_EVENT, _DISPATCH_SEQ_ID
    global CURRENT_TARGET_REC, CURRENT_REC_BLOCKS, CURRENT_BLOCK_INDEX, CURRENT_CHAT_HWND, CURRENT_POPUP_HWND
    ensure_desktop_attached()

    with STATE_LOCK:
        _DISPATCH_SEQ_ID += 1
        my_dispatch_seq_id = _DISPATCH_SEQ_ID

    today_count = get_today_stats()
    if today_count >= DAILY_LIMIT:
        return {
            "status": "limit_exceeded",
            "message": f"1일 최대 안전 발송량({DAILY_LIMIT}건) 도달로 차단되었습니다."
        }

    target_rec = rec or {"name": target_name, "이름": target_name}
    cond = condition or SYNCED_STATE.get("condition") or {}

    # 유효 블록 리스트 생성 (B1, B2, B3... 순서 유지 및 조건부 패스 반영)
    if blocks and len(blocks) > 0:
        resolved_blocks = get_blocks_for_recipient(blocks, target_rec, cond, channel=channel)
    else:
        resolved_blocks = []

    # 블록이 비어있고 message 문자열이 있는 경우 텍스트 블록 1개로 처리
    if not resolved_blocks and message:
        resolved_blocks = [{"type": "text", "content": message, "title": "메시지"}]

    if not resolved_blocks:
        return {
            "status": "error",
            "message": f"'{target_name}' 대상에게 발송할 유효 블록(메시지)이 없습니다."
        }

    first_block = resolved_blocks[0]
    total_b = len(resolved_blocks)

    # 1:1 대화방 열기 및 첫 번째 블록 장전
    chat_hwnd, pre_opened = open_channel_chat_or_link(channel, target_rec, first_block, expected_seq_id=my_dispatch_seq_id)
    ch_names = {
        "kakao": "카카오톡",
        "line": "라인(LINE)",
        "telegram": "텔레그램(Telegram)",
        "whatsapp": "왓츠앱(WhatsApp)",
        "wechat": "위챗(WeChat)"
    }
    ch_kr = ch_names.get(channel, channel.upper())

    if not chat_hwnd:
        if channel == "kakao" and is_kakao_locked_or_logged_out():
            return {
                "status": "kakao_logged_out",
                "message": "⚠️ 카카오톡이 로그아웃(또는 잠금) 상태입니다. PC 카카오톡에 먼저 로그인한 뒤 다시 발송을 시작해주세요!"
            }
        return {
            "status": "not_found",
            "message": f"{ch_kr}에서 대상 '{target_name}' 님을 찾지 못했습니다. 친구 이름, ID 또는 전화번호가 정확한지 확인하세요."
        }

    # 🌟 다중 블록 순차 엔터 발송 지원을 위한 전역 상태 세팅
    with STATE_LOCK:
        CURRENT_TARGET_REC = target_rec
        CURRENT_REC_BLOCKS = resolved_blocks
        CURRENT_BLOCK_INDEX = 0
        CURRENT_CHAT_HWND = chat_hwnd
        CURRENT_POPUP_HWND = None
        IS_TEST_MODE = True
        BOT_RUNNING = True
        WAITING_FOR_USER_ENTER = True
        LAST_EVENT = {
            "type": "loaded_waiting_enter",
            "id": target_rec.get("id", "test_rec"),
            "name": target_name,
            "currentIndex": 0,
            "blockIndex": 0,
            "totalBlocks": total_b,
            "blockType": first_block["type"],
            "channel": channel,
            "is_test": True,
            "timestamp": time.time()
        }

    b_type_kr = "사진(이미지)" if first_block["type"] == "image" else ("이모티콘" if first_block["type"] == "emoticon" else "텍스트")
    print(f"\n[🧪 1:1 테스트 발송] '{target_name}' [{ch_kr}] 대화방에 [1/{total_b} {b_type_kr}] 장전 완료!")
    if total_b > 1:
        print(f"   👉 메신저 창에서 [Enter]를 누르면 1번 블록이 발송되고, 2번 블록이 연속 자동 장전됩니다!")
    else:
        print(f"   👉 메신저 화면에서 [Enter]를 눌러 테스트 메시지를 전송하세요.")

    return {
        "status": "success",
        "message": f"'{target_name}' [{ch_kr}] 대화방에 첫 번째 블록(총 {total_b}개)이 장전되었습니다.",
        "totalBlocks": total_b,
        "channel": channel,
        "pre_opened": pre_opened
    }

# ==========================================
# 6. 블록 시퀀스 구성 및 엔터 연속 발송 루프
# ==========================================
def is_recipient_match_condition(rec, cond):
    """
    수신자가 범용 타겟팅 조건식에 일치하는지 판별 (v2.7)
    """
    if not cond or not cond.get("active"):
        return False
    field = str(cond.get("field") or "").strip()
    expected_val = str(cond.get("value") or "").strip()
    if not field or not expected_val:
        return False

    actual_val = rec.get(field)
    if actual_val is None or actual_val == "":
        # 썬드리머 / 루미노트 CRM 호환 (가입여부 / 앱가입 / is_joined / hub_uuid)
        if field in ("가입여부", "앱가입", "가입") and (rec.get("is_joined") is True or rec.get("hub_uuid")):
            actual_val = "가입"
        elif field == "is_joined":
            actual_val = "true" if rec.get("is_joined") else "false"

    actual_str = str(actual_val or "").strip()
    op = cond.get("operator", "equals")
    if op == "equals":
        return actual_str.lower() == expected_val.lower()
    elif op == "not_equals":
        return actual_str.lower() != expected_val.lower()
    return False

def get_blocks_for_recipient(blocks, rec, condition=None, channel=None):
    """
    수신자에게 순차적으로 발송할 유효 블록 리스트 생성 (B1, B2, B3... 순서 완벽 유지)
    - 범용 조건부 발송: 조건 만족 시 지정된 블록(기본 B2) 자동 제외/패스
    """
    valid_blocks = []
    name_val = str(rec.get("name") or rec.get("이름") or rec.get("별명") or rec.get("닉네임") or rec.get("고객명") or "")
    title_val = str(rec.get("title") or rec.get("직함") or rec.get("직책") or "")
    org_val = str(rec.get("org") or rec.get("소속") or rec.get("회사") or "")
    phone_val = str(rec.get("phone") or rec.get("전화번호") or rec.get("연락처") or rec.get("휴대폰") or "")
    memo_val = str(rec.get("memo") or rec.get("메모") or rec.get("비고") or "")

    # 조건 일치 여부 판별
    cond = condition or SYNCED_STATE.get("condition") or {}
    is_match = is_recipient_match_condition(rec, cond)
    skip_indices = cond.get("skipBlockIndices") or []

    # 앱 가입 여부 판별 (루미노트 / 썬드리머 연동 호환)
    is_joined = (
        str(rec.get("가입여부") or "").strip() == "가입" or
        rec.get("is_joined") is True or
        bool(rec.get("hub_uuid"))
    )

    if blocks and isinstance(blocks, list):
        for b_idx, b in enumerate(blocks):
            # 🌟 범용 타겟팅 조건 일치 또는 skipIfJoined 설정 시 해당 블록 건너뛰기
            should_skip = False
            if is_match and b_idx in skip_indices:
                should_skip = True
            elif is_joined and (b.get("skipIfJoined") is True or b.get("targetCondition") == "unjoined_only"):
                should_skip = True

            if should_skip:
                b_name = b.get("title", f"B{b_idx + 1}")
                print(f"   [B{b_idx + 1} 블록 패스] '{name_val}'님은 타겟팅 조건 일치로 B{b_idx + 1} 블록({b_name})을(를) 제외하고 진행합니다.")
                continue

            b_type = b.get("type", "text")
            if b_type == "text":
                txt = b.get("content", "")
                if not txt or not txt.strip():
                    continue
                # 개인화 동적 변수 치환
                txt = txt.replace("#{이름}", name_val)
                txt = txt.replace("#{별명}", str(rec.get("별명") or name_val))
                txt = txt.replace("#{닉네임}", str(rec.get("닉네임") or name_val))
                txt = txt.replace("#{고객명}", str(rec.get("고객명") or name_val))
                txt = txt.replace("#{직함}", title_val)
                txt = txt.replace("#{소속}", org_val)
                txt = txt.replace("#{전화번호}", phone_val)
                txt = txt.replace("#{메모}", memo_val)

                for k, v in rec.items():
                    if k not in ("message", "msg") and not str(k).startswith("_"):
                        if v is not None and v != "":
                            txt = txt.replace(f"#{{{k}}}", str(v))

                if b.get("isAd"):
                    if not b.get("optOutOnly") and not b.get("noAdBoilerplate"):
                        if not txt.startswith("(광고)"):
                            txt = f"(광고)\n{txt}"
                    if not b.get("adPrefixOnly") and not b.get("noAdBoilerplate"):
                        opt = f"\n\n무료수신거부: {b.get('optOutNum', '080-880-7766')}"
                        if "무료수신거부" not in txt:
                            txt += opt

                valid_blocks.append({
                    "type": "text",
                    "content": txt,
                    "title": b.get("title", "텍스트 블록")
                })

            elif b_type == "image":
                data_url = b.get("dataUrl", "")
                if data_url and (data_url.startswith("data:image") or len(data_url) > 100 or os.path.exists(data_url)):
                    valid_blocks.append({
                        "type": "image",
                        "dataUrl": data_url,
                        "fileName": b.get("fileName", "image.png"),
                        "title": b.get("title", "이미지 블록")
                    })

            elif b_type == "emoticon":
                # 카톡 이모티콘 플러스 추천창 전용 블록 (카카오톡 외 채널은 자동 건너뜀)
                active_ch = channel or SYNCED_STATE.get("channel", "kakao")
                if active_ch != "kakao":
                    print(f"   [B{b_idx + 1} 이모티콘 패스] 카카오톡 전용 블록이라 {active_ch} 채널에서는 건너뜁니다.")
                    continue
                kw = str(b.get("keyword") or "").strip()
                if not kw:
                    continue
                try:
                    row = max(1, min(2, int(b.get("row", 1))))
                    col = max(1, min(6, int(b.get("col", 1))))
                except (TypeError, ValueError):
                    row, col = 1, 1
                valid_blocks.append({
                    "type": "emoticon",
                    "keyword": kw,
                    "row": row,
                    "col": col,
                    "title": b.get("title", "카톡 이모티콘")
                })

    # 만약 유효 블록이 하나도 없다면, 사전 조합된 message 또는 기본 텍스트 1개로 fallback
    if not valid_blocks:
        fallback_msg = rec.get("message", "").strip()
        if fallback_msg:
            valid_blocks.append({
                "type": "text",
                "content": fallback_msg,
                "title": "텍스트 블록"
            })

    return valid_blocks

def _type_unicode_text(text: str):
    """SendInput(KEYEVENTF_UNICODE)으로 실제 타이핑처럼 한 글자씩 입력 (카톡 이모티콘 추천창 트리거용)"""
    INPUT_KEYBOARD = 1
    KEYEVENTF_UNICODE = 0x0004
    KEYEVENTF_KEYUP_ = 0x0002

    class KEYBDINPUT(ctypes.Structure):
        _fields_ = [("wVk", wintypes.WORD), ("wScan", wintypes.WORD), ("dwFlags", wintypes.DWORD),
                    ("time", wintypes.DWORD), ("dwExtraInfo", ctypes.c_size_t)]

    class MOUSEINPUT(ctypes.Structure):
        _fields_ = [("dx", wintypes.LONG), ("dy", wintypes.LONG), ("mouseData", wintypes.DWORD),
                    ("dwFlags", wintypes.DWORD), ("time", wintypes.DWORD), ("dwExtraInfo", ctypes.c_size_t)]

    class _INPUTUNION(ctypes.Union):
        _fields_ = [("ki", KEYBDINPUT), ("mi", MOUSEINPUT)]

    class INPUT(ctypes.Structure):
        _fields_ = [("type", wintypes.DWORD), ("u", _INPUTUNION)]

    for ch in text:
        for flags in (KEYEVENTF_UNICODE, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP_):
            inp = INPUT(type=INPUT_KEYBOARD, u=_INPUTUNION(ki=KEYBDINPUT(0, ord(ch), flags, 0, 0)))
            user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
        time.sleep(random.uniform(0.025, 0.045))

def _get_visible_kakao_popups(chat_hwnd) -> set:
    """카카오톡 프로세스에 속한 비대화창 가시 팝업(이모티콘 추천 팝업 및 대화방 내부 가시 자식 레이어) HWND 집합 조회"""
    res = set()
    try:
        hDesk = ensure_desktop_attached()
        if not chat_hwnd or not user32.IsWindow(chat_hwnd):
            return res
        chat_pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(chat_hwnd, ctypes.byref(chat_pid))
        if not chat_pid.value:
            return res

        def _enum_cb(h, _):
            if h != chat_hwnd and user32.IsWindowVisible(h):
                p = wintypes.DWORD()
                user32.GetWindowThreadProcessId(h, ctypes.byref(p))
                if p.value == chat_pid.value and not is_chat_window(h):
                    r = wintypes.RECT()
                    user32.GetWindowRect(h, ctypes.byref(r))
                    w = r.right - r.left
                    hv = r.bottom - r.top
                    if w >= 50 and hv >= 30:
                        res.add(h)
            return True

        WNDENUM = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        if hDesk:
            user32.EnumDesktopWindows(hDesk, WNDENUM(_enum_cb), 0)
        else:
            user32.EnumWindows(WNDENUM(_enum_cb), 0)

        def _enum_child_cb(ch, _):
            if user32.IsWindowVisible(ch):
                c = ctypes.create_unicode_buffer(256)
                user32.GetClassNameW(ch, c, 256)
                if 'RICHEDIT' not in c.value:
                    r = wintypes.RECT()
                    user32.GetWindowRect(ch, ctypes.byref(r))
                    if (r.right - r.left) >= 50 and (r.bottom - r.top) >= 30:
                        res.add((ch, r.right - r.left, r.bottom - r.top))
            return True

        user32.EnumChildWindows(chat_hwnd, WNDENUM(_enum_child_cb), 0)
    except Exception:
        pass
    return res


def _capture_chat_above_input_bgra(chat_hwnd, re_hwnd):
    """카카오톡 입력창(re_hwnd) 바로 위 이모티콘 추천 팝업/미리보기 노출 영역의 화면 픽셀(BGRA) 캡처"""
    try:
        ensure_desktop_attached()
        if not chat_hwnd or not user32.IsWindow(chat_hwnd) or not re_hwnd or not user32.IsWindow(re_hwnd):
            return None, 0, 0
        gdi32 = ctypes.windll.gdi32
        with _KakaoDpiContext(chat_hwnd):
            dpi_s = _kakao_dpi_scale(chat_hwnd)
            rc_chat = wintypes.RECT()
            rect_re = wintypes.RECT()
            user32.GetWindowRect(chat_hwnd, ctypes.byref(rc_chat))
            user32.GetWindowRect(re_hwnd, ctypes.byref(rect_re))
            x1 = max(rc_chat.left + int(8 * dpi_s), rect_re.left)
            x2 = min(rc_chat.right - int(8 * dpi_s), rect_re.left + int(400 * dpi_s))
            y1 = max(rc_chat.top + int(48 * dpi_s), rect_re.top - int(160 * dpi_s))
            y2 = rect_re.top - int(8 * dpi_s)
            w = x2 - x1
            h = y2 - y1
            if w <= 24 or h <= 24:
                return None, 0, 0

            hdc_scr = user32.GetDC(0)
            if not hdc_scr:
                return None, 0, 0
            hdc_mem = gdi32.CreateCompatibleDC(hdc_scr)
            hbm = gdi32.CreateCompatibleBitmap(hdc_scr, w, h)
            old_obj = gdi32.SelectObject(hdc_mem, hbm)
            # SRCCOPY(0x00CC0020) | CAPTUREBLT(0x40000000): 레이어드 플로팅 추천창까지 모두 캡처 (드라이버 미지원 시 SRCCOPY 폴백)
            ok = gdi32.BitBlt(hdc_mem, 0, 0, w, h, hdc_scr, x1, y1, 0x40CC0020)
            if not ok:
                ok = gdi32.BitBlt(hdc_mem, 0, 0, w, h, hdc_scr, x1, y1, 0x00CC0020)
            raw = None
            if ok:
                class _BIH(ctypes.Structure):
                    _fields_ = [
                        ('biSize', wintypes.DWORD), ('biWidth', wintypes.LONG), ('biHeight', wintypes.LONG),
                        ('biPlanes', wintypes.WORD), ('biBitCount', wintypes.WORD), ('biCompression', wintypes.DWORD),
                        ('biSizeImage', wintypes.DWORD), ('biXPelsPerMeter', wintypes.LONG), ('biYPelsPerMeter', wintypes.LONG),
                        ('biClrUsed', wintypes.DWORD), ('biClrImportant', wintypes.DWORD)
                    ]
                class _BI(ctypes.Structure):
                    _fields_ = [('bmiHeader', _BIH), ('bmiColors', wintypes.DWORD * 3)]
                bmi = _BI()
                bmi.bmiHeader.biSize = ctypes.sizeof(_BIH)
                bmi.bmiHeader.biWidth = w
                bmi.bmiHeader.biHeight = -h
                bmi.bmiHeader.biPlanes = 1
                bmi.bmiHeader.biBitCount = 32
                bmi.bmiHeader.biCompression = 0
                buf = ctypes.create_string_buffer(w * h * 4)
                if gdi32.GetDIBits(hdc_mem, hbm, 0, h, buf, ctypes.byref(bmi), 0):
                    raw = bytes(buf.raw)
            gdi32.SelectObject(hdc_mem, old_obj)
            gdi32.DeleteObject(hbm)
            gdi32.DeleteDC(hdc_mem)
            user32.ReleaseDC(0, hdc_scr)
            if raw and any(raw[::64]):
                return raw, w, h
    except Exception:
        pass
    return None, 0, 0


def _bgra_diff_metrics(raw_a, raw_b, threshold: int = 20, stride_px: int = 2):
    """두 BGRA 버퍼 간 임계치 이상 변화한 픽셀 비율(ratio)과 개수(changed) 산출"""
    if not raw_a or not raw_b or len(raw_a) != len(raw_b):
        return 0.0, 0
    step = max(1, stride_px) * 4
    changed = 0
    total = 0
    n = len(raw_a) - 3
    for idx in range(0, n, step):
        total += 1
        if (
            abs(raw_a[idx] - raw_b[idx]) >= threshold
            or abs(raw_a[idx + 1] - raw_b[idx + 1]) >= threshold
            or abs(raw_a[idx + 2] - raw_b[idx + 2]) >= threshold
        ):
            changed += 1
    if total == 0:
        return 0.0, 0
    return (changed / total), changed


def load_emoticon_to_chat(chat_hwnd, block):
    """
    카톡 이모티콘 플러스 추천창을 이용한 이모티콘 장전 (멀린님 설계)
    1) 입력창에 키워드(감사/사랑/가을 등) 타이핑 → 추천 이모티콘 작은 창이 실제로 화면에 뜰 때까지 정밀 확인 대기
    2) ↑ : 추천창 진입 (좌상단 첫 번째 선택)
    3) → (칸-1)회, ↓ (줄-1)회 : 지정한 칸으로 이동
    4) Enter : 선택 → 입력창 위 미리보기 상태 (🚨 추천창 미오픈 시 봇의 자동 Enter를 절대 치지 않아 키워드 글자 자동전송 원천 차단!)
    → 유저가 화면 확인 후 [Enter]를 치면 전송
    """
    global CURRENT_CHAT_HWND, WAITING_FOR_USER_ENTER, _EARLY_USER_ENTER_DETECTED
    global _LOADED_RE_HWND, _LOADED_RE_HAD_TEXT, _LOADED_POPUP_HWND, _LOADED_HAD_POPUP, _LOADED_BLOCK_TIME
    ensure_desktop_attached()
    keyword = str(block.get("keyword") or "").strip()
    row = int(block.get("row", 1) or 1)
    col = int(block.get("col", 1) or 1)
    if not keyword:
        return False

    if not chat_hwnd or not user32.IsWindow(chat_hwnd):
        return False

    with _PASTE_LOCK:
        CURRENT_CHAT_HWND = chat_hwnd
        _LOADED_RE_HWND = None
        _LOADED_RE_HAD_TEXT = False
        _LOADED_POPUP_HWND = None
        _LOADED_HAD_POPUP = False

        # 이전 블록 전송에 사용된 봇/유저의 잔여 Enter 비트를 장전 시작 시점에 먼저 소거
        _flush_enter_key_state()
        _EARLY_USER_ENTER_DETECTED = False

        # 이전 사진 전송 팝업이 아직 닫히는 중이라면 최대 0.25초 대기
        t_pop = time.time()
        while time.time() - t_pop < 0.25:
            if not find_and_focus_image_popup():
                break
            time.sleep(0.03)

        re_hwnds = []
        def _find_re(h, lp):
            c = ctypes.create_unicode_buffer(256)
            user32.GetClassNameW(h, c, 256)
            if 'RICHEDIT' in c.value:
                re_hwnds.append(h)
            return True
        user32.EnumChildWindows(chat_hwnd, ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)(_find_re), 0)
        re_hwnd = re_hwnds[0] if re_hwnds else None

        cur_tid = kernel32.GetCurrentThreadId()
        chat_tid = user32.GetWindowThreadProcessId(chat_hwnd, None)
        empty_buf = ctypes.create_unicode_buffer("")

        def _focus_and_clear_input():
            if GetForegroundWindow() != chat_hwnd:
                force_foreground(chat_hwnd)
                time.sleep(0.03)
            if re_hwnd and user32.IsWindow(re_hwnd):
                user32.AttachThreadInput(cur_tid, chat_tid, True)
                cur_f = user32.GetFocus()
                if cur_f != re_hwnd:
                    user32.SetFocus(re_hwnd)
                user32.AttachThreadInput(cur_tid, chat_tid, False)

                # 포커스가 입력창에 없을 때만 물리 마우스 클릭 수행 (다중 블록 연속 장전 시 이미 포커스가 있으면 불필요한 클릭 지연 생략)
                if cur_f != re_hwnd:
                    with _KakaoDpiContext(chat_hwnd):
                        rect_re = wintypes.RECT()
                        user32.GetWindowRect(re_hwnd, ctypes.byref(rect_re))
                        dpi_s = _kakao_dpi_scale(chat_hwnd)
                        user32.SetCursorPos(rect_re.left + int(38 * dpi_s), rect_re.top + int(16 * dpi_s))
                    time.sleep(0.012)
                    user32.mouse_event(0x0002, 0, 0, 0, 0)
                    time.sleep(0.012)
                    user32.mouse_event(0x0004, 0, 0, 0, 0)
                    time.sleep(0.018)
                    user32.AttachThreadInput(cur_tid, chat_tid, True)
                    user32.SetFocus(re_hwnd)
                    user32.AttachThreadInput(cur_tid, chat_tid, False)

                if _get_richedit_text(re_hwnd):
                    user32.SendMessageW(wintypes.HWND(re_hwnd), 0x000C, wintypes.WPARAM(0), empty_buf)
                    user32.SendMessageW(wintypes.HWND(re_hwnd), 0x00B1, wintypes.WPARAM(0), wintypes.LPARAM(-1))
                    user32.SendMessageW(wintypes.HWND(re_hwnd), 0x0303, wintypes.WPARAM(0), wintypes.LPARAM(0))
                    time.sleep(0.015)

                try:
                    imm32 = ctypes.windll.imm32
                    hIMC = imm32.ImmGetContext(re_hwnd)
                    if hIMC:
                        imm32.ImmSetConversionStatus(hIMC, 0, 0)
                        imm32.ImmReleaseContext(re_hwnd, hIMC)
                except Exception:
                    pass

        def _wait_for_chat_above_settle(max_wait: float = 0.14):
            """이전 말풍선 스크롤 애니메이션이 멈춘 기준 화면(snap_before) 초고속 획득"""
            prev_raw, _, _ = _capture_chat_above_input_bgra(chat_hwnd, re_hwnd)
            if not prev_raw:
                return None
            t_s0 = time.time()
            while time.time() - t_s0 < max_wait:
                time.sleep(0.025)
                cur_raw, _, _ = _capture_chat_above_input_bgra(chat_hwnd, re_hwnd)
                if not cur_raw:
                    return prev_raw
                motion_ratio, _ = _bgra_diff_metrics(prev_raw, cur_raw, threshold=18, stride_px=2)
                prev_raw = cur_raw
                if motion_ratio < 0.022:
                    break
            return prev_raw

        had_keyword_text = False
        nav_confirmed = False
        pre_popups = set()
        snap_before_typing = None

        # 최대 2회(초기 1회 + 추천창 미오픈 시 완전 비우기 후 깨끗한 재타이핑 1회) 시도
        # 🚨 주의: 타이핑 후 절대 Space -> Backspace를 치지 않음! (카톡은 공백 입력 시 추천창을 즉시 닫고 Backspace 시 재오픈하지 않음)
        for outer_try in range(2):
            for attempt in range(3):
                _focus_and_clear_input()
                snap_before_typing = _wait_for_chat_above_settle(0.12 if (outer_try == 0 and attempt == 0) else 0.08)
                pre_popups = _get_visible_kakao_popups(chat_hwnd)
                _flush_enter_key_state()
                _EARLY_USER_ENTER_DETECTED = False
                _type_unicode_text(keyword)
                time.sleep(0.03)

                if not re_hwnd:
                    had_keyword_text = True
                    break
                typed_now = _get_richedit_text(re_hwnd).strip()
                if typed_now:
                    had_keyword_text = True
                if typed_now == keyword:
                    break
                if attempt == 2:
                    user32.SendMessageW(wintypes.HWND(re_hwnd), 0x000C, wintypes.WPARAM(0), empty_buf)
                    for ch in keyword:
                        user32.SendMessageW(wintypes.HWND(re_hwnd), 0x0102, wintypes.WPARAM(ord(ch)), wintypes.LPARAM(1))
                        time.sleep(0.02)
                    ctrl_id = user32.GetDlgCtrlID(wintypes.HWND(re_hwnd))
                    parent_h = user32.GetParent(wintypes.HWND(re_hwnd)) or chat_hwnd
                    user32.PostMessageW(wintypes.HWND(parent_h), 0x0111, wintypes.WPARAM((0x0300 << 16) | (ctrl_id & 0xFFFF)), wintypes.LPARAM(re_hwnd))
                    if _get_richedit_text(re_hwnd).strip():
                        had_keyword_text = True

            # ⚡ 추천창 즉시 감지 고속 폴링: 추천창 픽셀/팝업이 뜨고 슬라이드업이 멈추는 그 즉시(보통 0.22~0.30초) 대기 없이 바로 방향키 진입!
            wait_limit = 0.95 if outer_try == 0 else 1.10
            min_ready_sec = 0.20 if outer_try == 0 else 0.30
            t_emo_wait = time.time()
            last_poll_raw = None
            while time.time() - t_emo_wait < wait_limit:
                time.sleep(0.028)
                if _check_and_latch_user_enter():
                    if had_keyword_text and re_hwnd and user32.IsWindow(re_hwnd) and not _get_richedit_text(re_hwnd).strip():
                        _EARLY_USER_ENTER_DETECTED = True
                        _LOADED_RE_HWND = re_hwnd
                        _LOADED_RE_HAD_TEXT = False
                        _LOADED_BLOCK_TIME = time.time()
                        print(f"   [⚡ 이모티콘 조기 전송 감지] '{keyword}' 입력 직후 유저 Enter로 즉시 전송 완료되었습니다.")
                        return True

                elapsed_emo = time.time() - t_emo_wait
                new_hwnd_popups = _get_visible_kakao_popups(chat_hwnd) - pre_popups
                cur_raw, _, _ = _capture_chat_above_input_bgra(chat_hwnd, re_hwnd)
                diff_ratio = 0.0
                if snap_before_typing and cur_raw:
                    diff_ratio, _ = _bgra_diff_metrics(snap_before_typing, cur_raw, threshold=20, stride_px=2)

                if new_hwnd_popups or diff_ratio >= 0.035:
                    if elapsed_emo >= min_ready_sec:
                        # 추천창 슬라이드업 애니메이션이 멈추자마자 즉시 진입 (고정 대기 제거)
                        for _ in range(3):
                            if not last_poll_raw or not cur_raw:
                                time.sleep(0.05)
                                break
                            frame_delta, _ = _bgra_diff_metrics(last_poll_raw, cur_raw, threshold=18, stride_px=2)
                            if frame_delta < 0.028:
                                break
                            time.sleep(0.035)
                            last_poll_raw = cur_raw
                            cur_raw, _, _ = _capture_chat_above_input_bgra(chat_hwnd, re_hwnd)
                        break
                last_poll_raw = cur_raw

            # 포그라운드가 타 프로세스(브라우저 등)로 빠져나간 경우에만 복구 (카톡 자체 추천 팝업 포커스는 절대 깨뜨리지 않음!)
            fg_now = GetForegroundWindow()
            fg_now_pid = wintypes.DWORD()
            chat_pid_val = wintypes.DWORD()
            if fg_now:
                user32.GetWindowThreadProcessId(fg_now, ctypes.byref(fg_now_pid))
            user32.GetWindowThreadProcessId(chat_hwnd, ctypes.byref(chat_pid_val))
            if fg_now != chat_hwnd and (not fg_now_pid.value or fg_now_pid.value != chat_pid_val.value):
                force_foreground(chat_hwnd)
                time.sleep(0.03)

            # ↑ 및 방향키(→, ↓) 이동 전후 추천 영역 픽셀 변화와 팝업 핸들을 실측 검증하여,
            # 실제로 추천창 안에서 이모티콘 칸이 선택되었을 때만 Enter(미리보기 확정)를 타건!
            snap_pre_nav, _, _ = _capture_chat_above_input_bgra(chat_hwnd, re_hwnd)
            press_key(0x26)  # ↑ 추천창 진입 (1줄 1번째)
            time.sleep(random.uniform(0.075, 0.095))
            snap_after_up, _, _ = _capture_chat_above_input_bgra(chat_hwnd, re_hwnd)

            for _ in range(max(0, col - 1)):
                press_key(0x27)  # →
                time.sleep(random.uniform(0.045, 0.065))
            for _ in range(max(0, row - 1)):
                press_key(VK_DOWN)  # ↓
                time.sleep(random.uniform(0.045, 0.065))
            snap_post_nav, _, _ = _capture_chat_above_input_bgra(chat_hwnd, re_hwnd)

            _, up_diff_px = _bgra_diff_metrics(snap_pre_nav, snap_after_up, threshold=12, stride_px=1)
            _, nav_diff_px = _bgra_diff_metrics(snap_pre_nav, snap_post_nav, threshold=12, stride_px=1)
            visible_after_nav = _get_visible_kakao_popups(chat_hwnd) - pre_popups
            capture_unavailable = (snap_before_typing is None and snap_pre_nav is None)

            if visible_after_nav or up_diff_px >= 16 or nav_diff_px >= 16 or capture_unavailable:
                nav_confirmed = True
                break

            # 1차에서 추천창 진입 반응이 없다면 입력창을 완전히 비운 뒤(Ctrl+A -> Delete) 2차 깨끗한 재타이핑 수행
            if outer_try == 0 and re_hwnd and user32.IsWindow(re_hwnd):
                press_hotkey(VK_CONTROL, 0x41)
                time.sleep(0.025)
                press_key(0x2E)
                time.sleep(0.06)

        if nav_confirmed:
            # 방향키 이동 도중 유저가 이미 Enter를 쳤는지 선제 래치 보존!
            user_pressed_before_select = _check_and_latch_user_enter()

            # 선택 → 미리보기 확정 (이모티콘 미리보기만 띄우고 전송은 유저의 Enter를 대기!)
            press_key(VK_RETURN)
            _flush_enter_key_state()
            if not user_pressed_before_select:
                _EARLY_USER_ENTER_DETECTED = False
            time.sleep(0.06)
            _check_and_latch_user_enter()
            print(f"   [😊 이모티콘 장전] '{keyword}' 추천창 {row}줄 {col}번째 → 미리보기 완료. 확인 후 [Enter]를 치세요.")
        else:
            # 추천창이 끝내 열리지 않은 경우 봇이 절대 VK_RETURN을 치지 않으며, 입력창에 남은 키워드 글자가 오발송되지 않도록 비워둠
            if re_hwnd and user32.IsWindow(re_hwnd):
                user32.SendMessageW(wintypes.HWND(re_hwnd), 0x000C, wintypes.WPARAM(0), empty_buf)
            print(f"   ⚠️ [이모티콘 자동전송 원천 차단] '{keyword}' 추천창이 열리지 않아 글자 오발송 방지를 위해 자동 Enter를 차단했습니다.")

        # 🚨 카톡은 이모티콘 미리보기 전환 시 입력창 키워드를 비우므로, 이를 전송 완료(auto_sent_detected)로 오판하지 않도록 _LOADED_RE_HAD_TEXT = False 고정!
        _LOADED_RE_HWND = re_hwnd
        _LOADED_RE_HAD_TEXT = False
        _LOADED_BLOCK_TIME = time.time()
        return True

def dispatch_single_block(chat_hwnd, block, expected_seq_id: int = None):
    """대화방에 단일 블록(텍스트 / 사진 / 카톡 이모티콘)을 장전"""
    if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
        return False
    b_type = block.get("type", "text")
    if b_type == "image":
        return paste_image_to_chat(chat_hwnd, block.get("dataUrl", ""))
    elif b_type == "emoticon":
        return load_emoticon_to_chat(chat_hwnd, block)
    else:
        paste_message_to_chat(chat_hwnd, block.get("content", ""), expected_seq_id=expected_seq_id)
        return True

def _get_rec_display_name(rec: dict) -> str:
    if not isinstance(rec, dict):
        return ""
    for k in ("name", "이름", "타겟이름", "고객명", "별명", "닉네임", "nickname", "nick"):
        v = rec.get(k)
        if v is not None and str(v).strip():
            return str(v).strip()
    return ""

def _is_rec_pending(rec: dict) -> bool:
    if not isinstance(rec, dict):
        return False
    st = str(rec.get("status") or "pending").strip().lower()
    return st in ("pending", "대기", "wait", "")

def load_and_dispatch_next(expected_seq_id: int = None):
    """다음 대기자를 카카오톡에 장전하고 유저의 엔터 대기 상태로 전환"""
    global WAITING_FOR_USER_ENTER, BOT_RUNNING, CURRENT_TARGET_REC, CURRENT_TARGET_INDEX, LAST_EVENT
    global CURRENT_REC_BLOCKS, CURRENT_BLOCK_INDEX, CURRENT_CHAT_HWND, CURRENT_POPUP_HWND
    global _DISPATCH_SEQ_ID, WATCHING_MANUAL_CHAT
    ensure_desktop_attached()

    with _DISPATCH_LOCK:
        if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
            return False

        today_count = get_today_stats()
        if today_count >= DAILY_LIMIT:
            with STATE_LOCK:
                BOT_RUNNING = False
                WAITING_FOR_USER_ENTER = False
                LAST_EVENT = {
                    "type": "paused",
                    "message": f"1일 최대 안전 발송량({DAILY_LIMIT}건) 도달로 중단되었습니다.",
                    "timestamp": time.time()
                }
            return False

        with STATE_LOCK:
            if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
                return False
            if expected_seq_id is None:
                _DISPATCH_SEQ_ID += 1
                my_seq_id = _DISPATCH_SEQ_ID
            else:
                my_seq_id = expected_seq_id

            recipients = SYNCED_STATE.get("recipients", [])
            blocks = SYNCED_STATE.get("blocks", [])
            curr_idx = SYNCED_STATE.get("currentIndex", 0)

            target_rec = None
            target_idx = -1

            # 현재 인덱스부터 대기자(pending) 탐색
            for i in range(curr_idx, len(recipients)):
                if _is_rec_pending(recipients[i]):
                    target_rec = recipients[i]
                    target_idx = i
                    break

            # 없으면 0번부터 다시 탐색
            if not target_rec:
                for i in range(0, curr_idx):
                    if _is_rec_pending(recipients[i]):
                        target_rec = recipients[i]
                        target_idx = i
                        break

            if not target_rec:
                BOT_RUNNING = False
                WAITING_FOR_USER_ENTER = False
                CURRENT_TARGET_REC = None
                CURRENT_TARGET_INDEX = -1
                CURRENT_REC_BLOCKS = []
                CURRENT_BLOCK_INDEX = 0
                CURRENT_POPUP_HWND = None
                print("\n" + "=" * 60)
                print("   🎉 [축하] 모든 수신자에게 발송이 완료되었습니다!")
                print("=" * 60)
                LAST_EVENT = {
                    "type": "all_completed",
                    "timestamp": time.time()
                }
                return False

            SYNCED_STATE["currentIndex"] = target_idx
            CURRENT_TARGET_REC = target_rec
            CURRENT_TARGET_INDEX = target_idx
            WATCHING_MANUAL_CHAT = False
            name = _get_rec_display_name(target_rec)
            CURRENT_REC_BLOCKS = get_blocks_for_recipient(blocks, target_rec)
            CURRENT_BLOCK_INDEX = 0
            CURRENT_POPUP_HWND = None

        if not CURRENT_REC_BLOCKS:
            print(f"⚠️ '{name}' 대상에게 보낼 블록(메시지)이 없습니다. 완료 처리합니다.")
            with STATE_LOCK:
                target_rec["status"] = "done"
            return load_and_dispatch_next(expected_seq_id=my_seq_id)

        channel = SYNCED_STATE.get("channel", "kakao")
        total_b = len(CURRENT_REC_BLOCKS)
        print(f"\n[🚀 장전 시작] {target_idx + 1}번째 대상: '{name}' (총 {total_b}개 블록) [{channel.upper()}] 호출 중...")

        # 1:1 대화방 열기 or 딥링크 호출 및 첫 블록 장전
        chat_hwnd, pre_opened = open_channel_chat_or_link(channel, target_rec, CURRENT_REC_BLOCKS[0], expected_seq_id=my_seq_id)
        if my_seq_id != _DISPATCH_SEQ_ID:
            return False
        if not chat_hwnd:
            ch_kr = "카카오톡" if channel == "kakao" else ("텔레그램" if channel == "telegram" else channel.upper())
            is_locked_out = (channel == "kakao" and is_kakao_locked_or_logged_out())
            if not is_locked_out and SYNCED_STATE.get("autoSkipAmbiguous"):
                print(f"⏩ [자동 패스 모드] '{name}' 님 (동명이인/미발견) 자동 패스 처리 후 다음 대기자로 즉시 이동합니다!")
                with STATE_LOCK:
                    if my_seq_id != _DISPATCH_SEQ_ID:
                        return False
                    now_skip_ms = int(time.time() * 1000)
                    if isinstance(target_rec, dict):
                        target_rec["status"] = "skipped"
                        target_rec["_statusUpdatedAt"] = now_skip_ms
                    recs_now = SYNCED_STATE.get("recipients", [])
                    next_p_idx = -1
                    for i_r in range(target_idx + 1, len(recs_now)):
                        if _is_rec_pending(recs_now[i_r]):
                            next_p_idx = i_r
                            break
                    if next_p_idx == -1:
                        for i_r in range(0, target_idx):
                            if _is_rec_pending(recs_now[i_r]):
                                next_p_idx = i_r
                                break
                    if next_p_idx != -1:
                        SYNCED_STATE["currentIndex"] = next_p_idx
                    LAST_EVENT = {
                        "type": "auto_skipped",
                        "id": target_rec.get("id") if isinstance(target_rec, dict) else None,
                        "name": name,
                        "skippedIndex": target_idx,
                        "nextIndex": SYNCED_STATE.get("currentIndex", 0),
                        "timestamp": time.time(),
                    }
                time.sleep(0.08)
                return load_and_dispatch_next(expected_seq_id=my_seq_id)
            if is_locked_out:
                nf_reason = "kakao_logged_out"
                nf_msg = "⚠️ 카카오톡이 로그아웃(또는 잠금) 상태입니다. PC 카카오톡에 먼저 로그인한 뒤 다시 발송을 시작해주세요!"
                print(f"⚠️ {nf_msg}")
            else:
                nf_reason = "not_found"
                nf_msg = f"{ch_kr}에서 '{name}' 님을 찾지 못했습니다. (대화방/연락처 없음)"
                print(f"⚠️ {nf_msg}")
            with STATE_LOCK:
                if my_seq_id != _DISPATCH_SEQ_ID:
                    return False
                # 미발견(not_found)된 대상이 잘못 완료(done) 처리되어 있지 않도록 pending 상태를 보장하고 완료 링버퍼에서도 제거
                if isinstance(target_rec, dict) and str(target_rec.get("status") or "").strip().lower() == "done":
                    target_rec["status"] = "pending"
                nf_id = target_rec.get("id") if isinstance(target_rec, dict) else None
                RECENT_COMPLETED_LIST[:] = [
                    x for x in RECENT_COMPLETED_LIST
                    if not (x.get("index") == target_idx or (nf_id and x.get("id") == nf_id) or (name and x.get("name") == name))
                ]
                BOT_RUNNING = False
                WAITING_FOR_USER_ENTER = False
                LAST_EVENT = {
                    "type": "paused",
                    "reason": nf_reason,
                    "targetId": target_rec.get("id"),
                    "targetIndex": target_idx,
                    "name": name,
                    "message": nf_msg,
                    "searchKeyword": "" if is_locked_out else (_LAST_KAKAO_NOTFOUND_KW if channel == "kakao" else ""),
                    "timestamp": time.time()
                }
            if channel == "kakao" and not is_locked_out:
                kakao_h_watch = find_kakaotalk_window()
                threading.Thread(
                    target=_watch_manual_chat_open_after_not_found,
                    args=(kakao_h_watch, target_rec, list(CURRENT_REC_BLOCKS), target_idx, my_seq_id),
                    daemon=True,
                ).start()
            return False

        with STATE_LOCK:
            if my_seq_id != _DISPATCH_SEQ_ID:
                return False
            target_rec["_pre_opened"] = pre_opened
            CURRENT_CHAT_HWND = chat_hwnd
            WAITING_FOR_USER_ENTER = True
            first_block = CURRENT_REC_BLOCKS[0]
            LAST_EVENT = {
                "type": "loaded_waiting_enter",
                "id": target_rec.get("id"),
                "name": name,
                "currentIndex": target_idx,
                "blockIndex": 0,
                "totalBlocks": total_b,
                "blockType": first_block["type"],
                "channel": channel,
                "timestamp": time.time()
            }

        b_type_kr = "사진(이미지)" if first_block["type"] == "image" else ("이모티콘" if first_block["type"] == "emoticon" else "텍스트")
        print(f"👉 [입력 대기] '{name}' 대화방에 [1/{total_b} {b_type_kr}] 장전 완료!")
        print(f"   메신저 화면을 보며 [Enter]만 치세요! (다중 블록인 경우 엔터 시 다음 블록이 연속 자동 붙여넣기됩니다)")
        return True

def enter_listener_loop():
    """
    메신저 대화방에서 유저의 [Enter] 타건을 감지하여
    동일 대화방 내 다중 블록(텍스트/사진) 순차 장전 및 다음 대상을 연속 장전하는 핵심 루프 (전 채널 지원)
    """
    global WAITING_FOR_USER_ENTER, BOT_RUNNING, CURRENT_TARGET_REC, CURRENT_TARGET_INDEX, LAST_EVENT, IS_TEST_MODE
    global CURRENT_REC_BLOCKS, CURRENT_BLOCK_INDEX, CURRENT_CHAT_HWND, CURRENT_POPUP_HWND, _DISPATCH_SEQ_ID, _EARLY_USER_ENTER_DETECTED
    global _LOADED_RE_HWND, _LOADED_RE_HAD_TEXT, _LOADED_POPUP_HWND, _LOADED_HAD_POPUP, _LOADED_BLOCK_TIME, RECENT_COMPLETED_LIST
    ensure_desktop_attached()
    print("[*] ✅ 센스봇 [Enter] 연속 발송 감지 엔진 가동 중... (전 채널 다중 블록 순차 지원)")

    while True:
        try:
            time.sleep(0.02)

            # F9 키 감지 시 일시정지
            if user32.GetAsyncKeyState(VK_F9) & 0x8000:
                while user32.GetAsyncKeyState(VK_F9) & 0x8000:
                    time.sleep(0.02)
                if BOT_RUNNING:
                    BOT_RUNNING = False
                    WAITING_FOR_USER_ENTER = False
                    IS_TEST_MODE = False
                    _EARLY_USER_ENTER_DETECTED = False
                    _LOADED_RE_HAD_TEXT = False
                    _LOADED_HAD_POPUP = False
                    print("\n[⏸️ 일시정지] 센스봇 자동 루프가 일시정지되었습니다. (PWA [발송 시작] 또는 F8로 재개)")
                    with STATE_LOCK:
                        LAST_EVENT = {"type": "paused", "timestamp": time.time()}
                    continue

            if not BOT_RUNNING or not WAITING_FOR_USER_ENTER:
                continue

            channel = SYNCED_STATE.get("channel", "kakao")
            enter_triggered = _check_and_latch_user_enter()
            auto_sent_detected = False

            # ⭐️ [자가 치유(Self-Healing) 전송 감지]
            # 카톡 대화방에서 유저가 [Enter]를 아주 빠르게 쳤거나 마우스로 [전송] 버튼을 눌러
            # 카톡에서는 이미 메시지가 전송 완료(입력창 공백화 / 사진 팝업 닫힘)되었는데
            # OS 키 이벤트 타이밍 경합으로 GetAsyncKeyState가 놓친 경우, 멈추지 않고 즉시 자동 진행!
            if not enter_triggered and channel == "kakao" and not _PASTE_LOCK.locked() and (time.time() - _LOADED_BLOCK_TIME >= 0.10):
                curr_b_idx_chk = CURRENT_BLOCK_INDEX
                total_b_chk = len(CURRENT_REC_BLOCKS)
                curr_b_type_chk = CURRENT_REC_BLOCKS[curr_b_idx_chk]["type"] if (0 <= curr_b_idx_chk < total_b_chk) else "text"

                if curr_b_type_chk == "text" and _LOADED_RE_HAD_TEXT and _LOADED_RE_HWND and user32.IsWindow(_LOADED_RE_HWND):
                    if CURRENT_CHAT_HWND and user32.IsWindow(CURRENT_CHAT_HWND) and user32.IsWindowVisible(CURRENT_CHAT_HWND):
                        if not (user32.GetAsyncKeyState(0x08) & 0x8000) and not (user32.GetAsyncKeyState(0x2E) & 0x8000) and not (user32.GetAsyncKeyState(VK_ESCAPE) & 0x8000):
                            if not _get_richedit_text(_LOADED_RE_HWND).strip():
                                time.sleep(0.03)
                                if BOT_RUNNING and WAITING_FOR_USER_ENTER and not _get_richedit_text(_LOADED_RE_HWND).strip():
                                    if not (user32.GetAsyncKeyState(VK_ESCAPE) & 0x8000):
                                        auto_sent_detected = True
                                        print("   [⚡ 자동 전송 감지] 대화방 입력창의 메시지가 이미 전송 완료된 것을 감지하여 멈춤 없이 다음 단계로 진행합니다.")
                elif curr_b_type_chk == "image" and _LOADED_HAD_POPUP and _LOADED_POPUP_HWND:
                    if CURRENT_CHAT_HWND and user32.IsWindow(CURRENT_CHAT_HWND) and user32.IsWindowVisible(CURRENT_CHAT_HWND):
                        if not user32.IsWindow(_LOADED_POPUP_HWND) or not user32.IsWindowVisible(_LOADED_POPUP_HWND):
                            if not (user32.GetAsyncKeyState(VK_ESCAPE) & 0x8001):
                                time.sleep(0.05)
                                if BOT_RUNNING and WAITING_FOR_USER_ENTER and (not user32.IsWindow(_LOADED_POPUP_HWND) or not user32.IsWindowVisible(_LOADED_POPUP_HWND)):
                                    if not (user32.GetAsyncKeyState(VK_ESCAPE) & 0x8001):
                                        auto_sent_detected = True
                                        print("   [⚡ 자동 전송 감지] 클립보드 이미지 전송 팝업이 전송 완료로 닫힌 것을 감지하여 멈춤 없이 다음 단계로 진행합니다.")

            # 유저가 Enter 키를 눌렀거나 이미 전송 완료(auto_sent_detected)가 확인된 경우
            if enter_triggered or auto_sent_detected:
                _EARLY_USER_ENTER_DETECTED = False
                _LOADED_RE_HAD_TEXT = False
                _LOADED_HAD_POPUP = False
                fg = GetForegroundWindow()
                if not auto_sent_detected:
                    is_valid_fg = is_valid_messenger_window(fg, channel)
                    # 만약 카톡 대화방(CURRENT_CHAT_HWND)이 열려 있고 엔터 대기 상태인데 다른 창(예: 센스톡 브라우저)에 포커스가 가 있는 경우,
                    # 카톡 대화방을 즉시 포그라운드로 올리고 엔터 전송이 정상 작동하도록 허용!
                    if not is_valid_fg and channel == "kakao" and CURRENT_CHAT_HWND and user32.IsWindow(CURRENT_CHAT_HWND) and user32.IsWindowVisible(CURRENT_CHAT_HWND):
                        is_valid_fg = True
                    if not is_valid_fg:
                        time.sleep(0.05)
                        continue

                    # 키를 뗄 때까지 대기 (Key-Up 시점에 발송 확정)
                    _flush_enter_key_state()

                WAITING_FOR_USER_ENTER = False
                prev_popup_hwnd = CURRENT_POPUP_HWND
                CURRENT_POPUP_HWND = None

                rec = CURRENT_TARGET_REC
                name = _get_rec_display_name(rec) if rec else ""
                total_b = len(CURRENT_REC_BLOCKS)
                curr_b_idx = CURRENT_BLOCK_INDEX

                # ⭐️ [핵심 방어] 카카오톡 블록에서 유저가 [Enter]를 쳤으나 포커스 유실 또는 [전송] 버튼 미활성화로 미전송된 경우,
                # 봇이 포커스 복구 후 Enter를 보충 타건하여 100% 실제 전송을 보장! (단, auto_sent_detected는 이미 전송 완료 상태이므로 스킵)
                if channel == "kakao" and not auto_sent_detected:
                    chat_h_chk = CURRENT_CHAT_HWND if (CURRENT_CHAT_HWND and user32.IsWindow(CURRENT_CHAT_HWND)) else (fg if is_chat_window(fg) else find_open_chat_window(name))
                    if chat_h_chk and user32.IsWindow(chat_h_chk):
                        curr_b_type = CURRENT_REC_BLOCKS[curr_b_idx]["type"] if (curr_b_idx < total_b) else "text"
                        re_chk_list = []
                        def _find_re_chk(h, lp):
                            c = ctypes.create_unicode_buffer(256)
                            user32.GetClassNameW(h, c, 256)
                            if 'RICHEDIT' in c.value:
                                re_chk_list.append(h)
                            return True
                        user32.EnumChildWindows(chat_h_chk, ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)(_find_re_chk), 0)
                        re_h = re_chk_list[0] if re_chk_list else None

                        if curr_b_type == "image":
                            time.sleep(0.06)
                            still_pop = (prev_popup_hwnd if (prev_popup_hwnd and user32.IsWindow(prev_popup_hwnd) and user32.IsWindowVisible(prev_popup_hwnd)) else find_and_focus_image_popup())
                            if still_pop:
                                force_foreground(still_pop)
                                time.sleep(0.03)
                                press_key(VK_RETURN)
                                _flush_enter_key_state()
                                time.sleep(0.06)
                        elif curr_b_type == "emoticon":
                            fg_pid = wintypes.DWORD()
                            chat_pid_chk = wintypes.DWORD()
                            if fg:
                                user32.GetWindowThreadProcessId(fg, ctypes.byref(fg_pid))
                            user32.GetWindowThreadProcessId(chat_h_chk, ctypes.byref(chat_pid_chk))
                            # 다른 앱(브라우저 등)에 포커스가 가 있는 상태에서 유저가 Enter를 친 경우에만 카톡 대화방 포커스 복구 후 Enter 1회 전달
                            if fg != chat_h_chk and (not fg_pid.value or fg_pid.value != chat_pid_chk.value):
                                force_foreground(chat_h_chk)
                                time.sleep(0.035)
                                press_key(VK_RETURN)
                                _flush_enter_key_state()
                                time.sleep(0.05)
                            # 🚨 이모티콘 블록에서는 입력창에 잔여 키워드('가을' 등)가 남아 있더라도 절대 텍스트로 강제 전송하지 않고 비워줌!
                            if re_h and user32.IsWindow(re_h):
                                time.sleep(0.04)
                                rem_emo_kw = _get_richedit_text(re_h).strip()
                                emo_kw_cfg = str(CURRENT_REC_BLOCKS[curr_b_idx].get("keyword") or "").strip() if (curr_b_idx < total_b) else ""
                                if rem_emo_kw and (not emo_kw_cfg or rem_emo_kw == emo_kw_cfg):
                                    empty_emo_buf = ctypes.create_unicode_buffer("")
                                    user32.SendMessageW(wintypes.HWND(re_h), 0x000C, wintypes.WPARAM(0), empty_emo_buf)
                        elif curr_b_type == "text":
                            if re_h:
                                sent_ok = _ensure_kakao_richedit_sent(chat_h_chk, re_h)
                                if not sent_ok and _get_richedit_text(re_h).strip():
                                    # ⚠️ 1차 블록이 아직 카톡 대화창에 남아 미전송된 상태라면 절대 2차 블록으로 덮어쓰지 않고 입력창 포커스를 재안착하여 재대기!
                                    print(f"   ⚠️ [미전송 덮어쓰기 방어] '{name}'님 [{curr_b_idx + 1}/{total_b} 텍스트]가 아직 전송되지 않아 다음 블록 덮어쓰기를 차단하고 포커스를 복구합니다.")
                                    _activate_kakao_richedit_send_state(chat_h_chk, re_h, skip_click=False)
                                    _LOADED_RE_HWND = re_h
                                    _LOADED_RE_HAD_TEXT = True
                                    _LOADED_BLOCK_TIME = time.time()
                                    WAITING_FOR_USER_ENTER = True
                                    continue

                b_type_kr = "사진" if (curr_b_idx < total_b and CURRENT_REC_BLOCKS[curr_b_idx]["type"] == "image") else ("이모티콘" if (curr_b_idx < total_b and CURRENT_REC_BLOCKS[curr_b_idx]["type"] == "emoticon") else "텍스트")
                print(f"   [타건 감지] '{name}'님 [{curr_b_idx + 1}/{total_b} {b_type_kr}] 전송 확정! ({channel})")

                # 1. 다음 블록이 더 남아있는 경우: 동일 대화방에서 다음 블록(사진/이모티콘/텍스트) 연속 장전!
                if curr_b_idx + 1 < total_b:
                    CURRENT_BLOCK_INDEX += 1
                    next_b_idx = CURRENT_BLOCK_INDEX
                    next_block = CURRENT_REC_BLOCKS[next_b_idx]
                    next_b_kr = "사진(이미지)" if next_block["type"] == "image" else ("이모티콘" if next_block["type"] == "emoticon" else "텍스트")

                    # 이전 말풍선 전송 직후 지연 (과도한 고정 대기를 줄이고 추천창 출현 시 즉시 반응하도록 0.14~0.19초로 단축)
                    if next_block["type"] == "emoticon":
                        block_delay = random.uniform(0.14, 0.19)
                    else:
                        block_delay = random.uniform(0.10, 0.16)
                    time.sleep(block_delay)

                    if channel == "kakao":
                        chat_h = CURRENT_CHAT_HWND if (CURRENT_CHAT_HWND and user32.IsWindow(CURRENT_CHAT_HWND)) else find_open_chat_window(name)
                        if chat_h:
                            CURRENT_CHAT_HWND = chat_h
                            dispatch_single_block(chat_h, next_block)
                        else:
                            print(f"⚠️ 대화방을 찾을 수 없어 '{name}' 대상의 남은 블록 장전을 건너뜁니다.")
                    else:
                        # 비카카오 채널: 활성화된 메신저 창에 다음 블록(사진/텍스트) Ctrl+V 자동 주입!
                        if next_block["type"] == "image":
                            set_clipboard_image_from_dataurl(next_block["dataUrl"])
                        else:
                            set_clipboard_text(next_block["content"])

                        if fg and user32.IsWindow(fg):
                            force_foreground(fg)
                        time.sleep(random.uniform(0.1, 0.18))
                        _flush_enter_key_state()
                        _EARLY_USER_ENTER_DETECTED = False
                        press_hotkey(VK_CONTROL, VK_V)

                    WAITING_FOR_USER_ENTER = True
                    with STATE_LOCK:
                        LAST_EVENT = {
                            "type": "loaded_waiting_enter",
                            "id": rec.get("id") if rec else "",
                            "name": name,
                            "blockIndex": next_b_idx,
                            "totalBlocks": total_b,
                            "blockType": next_block["type"],
                            "channel": channel,
                            "is_test": IS_TEST_MODE,
                            "timestamp": time.time()
                        }
                    print(f"👉 [입력 대기] '{name}' 대화방에 [{next_b_idx + 1}/{total_b} {next_b_kr}] 자동 장전 완료! (텀: {block_delay:.2f}초)")
                    print(f"   메신저 화면에서 [Enter]를 치세요.")
                    continue

                # 2. 모든 블록 발송 완료!
                if IS_TEST_MODE:
                    with STATE_LOCK:
                        BOT_RUNNING = False
                        WAITING_FOR_USER_ENTER = False
                        IS_TEST_MODE = False
                        CURRENT_TARGET_REC = None
                        CURRENT_REC_BLOCKS = []
                        CURRENT_BLOCK_INDEX = 0
                        LAST_EVENT = {
                            "type": "test_completed",
                            "name": name,
                            "totalBlocks": total_b,
                            "timestamp": time.time()
                        }
                    print(f"\n🎉 [✅ 1:1 테스트 발송 성공] '{name}' 님께 모든 블록({total_b}개) 전송이 완료되었습니다!\n")
                    continue

                # 정규 배치 발송인 경우 수신자 완료 처리 및 다음 대상 전진을 디스크 I/O보다 최우선으로 즉시 반영!
                with STATE_LOCK:
                    _DISPATCH_SEQ_ID += 1
                    enter_seq_id = _DISPATCH_SEQ_ID
                    _LAST_PASTED_INFO["hwnd"] = 0
                    _LAST_PASTED_INFO["msg"] = ""
                    _LAST_PASTED_INFO["time"] = 0.0
                    now_done_ts = time.time()
                    now_done_ms = int(now_done_ts * 1000)
                    if rec:
                        rec["status"] = "done"
                        rec["_statusUpdatedAt"] = now_done_ms
                    rec_id = rec.get("id") if rec else ""
                    # ⭐️ [완료 누락 원천 차단] 유저가 발송 대기 중 다른 행을 클릭해 currentIndex가 바뀌었거나 /sync로 배열이 교체되었더라도
                    # 실제 발송된 대상(CURRENT_TARGET_INDEX / rec_id / name)을 정확히 찾아 100% done 확정!
                    recs_list = SYNCED_STATE.get("recipients", [])
                    done_idx = -1
                    if isinstance(CURRENT_TARGET_INDEX, int) and 0 <= CURRENT_TARGET_INDEX < len(recs_list):
                        cand_r = recs_list[CURRENT_TARGET_INDEX]
                        if (rec_id and cand_r.get("id") == rec_id) or (name and _get_rec_display_name(cand_r) == name):
                            cand_r["status"] = "done"
                            cand_r["_statusUpdatedAt"] = now_done_ms
                            done_idx = CURRENT_TARGET_INDEX
                    if done_idx == -1:
                        for idx_r, r in enumerate(recs_list):
                            if (rec_id and r.get("id") == rec_id) or (name and _get_rec_display_name(r) == name):
                                r["status"] = "done"
                                r["_statusUpdatedAt"] = now_done_ms
                                done_idx = idx_r
                                break
                    if done_idx == -1:
                        fallback_idx = SYNCED_STATE.get("currentIndex", 0)
                        if isinstance(fallback_idx, int) and 0 <= fallback_idx < len(recs_list):
                            recs_list[fallback_idx]["status"] = "done"
                            recs_list[fallback_idx]["_statusUpdatedAt"] = now_done_ms
                            done_idx = fallback_idx
                        else:
                            done_idx = 0

                    RECENT_COMPLETED_LIST.append({
                        "id": rec_id,
                        "name": name,
                        "index": done_idx,
                        "timestamp": now_done_ts
                    })
                    if len(RECENT_COMPLETED_LIST) > 60:
                        RECENT_COMPLETED_LIST[:] = RECENT_COMPLETED_LIST[-40:]

                    next_pending_idx = -1
                    for idx_r in range(done_idx + 1, len(recs_list)):
                        if _is_rec_pending(recs_list[idx_r]):
                            next_pending_idx = idx_r
                            break
                    if next_pending_idx == -1:
                        for idx_r in range(0, done_idx):
                            if _is_rec_pending(recs_list[idx_r]):
                                next_pending_idx = idx_r
                                break
                    if next_pending_idx != -1:
                        SYNCED_STATE["currentIndex"] = next_pending_idx

                    LAST_EVENT = {
                        "type": "sent_and_advancing",
                        "id": rec_id,
                        "name": name,
                        "completedIndex": done_idx,
                        "nextIndex": SYNCED_STATE.get("currentIndex", 0),
                        "channel": channel,
                        "timestamp": now_done_ts
                    }

                new_count = increment_today_stats()
                print(f"[✅ 발송 완료] '{name}' 님께 모든 블록({total_b}개) 발송 완료! (금일 {new_count}/{DAILY_LIMIT}건)")

                # 메시지 전송 완료 직후 다음 대상 장전 대기 최소화 (0.12 ~ 0.20초 고속 전진)
                time.sleep(random.uniform(0.12, 0.20))

                if _DISPATCH_SEQ_ID != enter_seq_id:
                    continue

                has_more = False
                with STATE_LOCK:
                    recipients = SYNCED_STATE.get("recipients", [])
                    has_more = any(_is_rec_pending(r) for r in recipients)

                if channel == "kakao" and has_more:
                    if _DISPATCH_SEQ_ID == enter_seq_id:
                        chat_to_close = CURRENT_CHAT_HWND
                        fg_now = GetForegroundWindow()
                        # 대화방이 포그라운드에 있을 때만 물리 ESC 타건 (카톡 메인창에 ESC가 잘못 들어가 검색창이 접히는 현상 방지)
                        if chat_to_close and fg_now == chat_to_close:
                            press_key(VK_ESCAPE)
                            user32.GetAsyncKeyState(VK_ESCAPE)
                            time.sleep(0.06)
                        # 만약 이모티콘 미리보기 창이 ESC 1회를 흡수했거나 pre_opened 창이라 닫히지 않았다면 WM_CLOSE(0x0010)로 확실히 닫아 다음 대상 검색 간섭 원천 차단!
                        if chat_to_close and user32.IsWindow(chat_to_close) and user32.IsWindowVisible(chat_to_close):
                            try:
                                user32.PostMessageW(wintypes.HWND(chat_to_close), 0x0010, wintypes.WPARAM(0), wintypes.LPARAM(0))
                                time.sleep(0.06)
                            except Exception:
                                pass

                # 다음 대기자 즉시 자동 장전! (대기 중 패스/정지/재시작 등으로 세대 번호가 바뀐 경우 중복 호출 원천 차단)
                if BOT_RUNNING and _DISPATCH_SEQ_ID == enter_seq_id:
                    if has_more:
                        load_and_dispatch_next(expected_seq_id=enter_seq_id)
                    else:
                        time.sleep(0.5)
                        with STATE_LOCK:
                            BOT_RUNNING = False
                            WAITING_FOR_USER_ENTER = False
                            CURRENT_TARGET_REC = None
                            CURRENT_REC_BLOCKS = []
                            CURRENT_BLOCK_INDEX = 0
                            # 모든 수신자 발송 완료 확정: 남아있는 모든 항목 완료 상태로 보장
                            for r in SYNCED_STATE.get("recipients", []):
                                if _is_rec_pending(r):
                                    r["status"] = "done"
                            LAST_EVENT = {
                                "type": "all_completed",
                                "timestamp": time.time()
                            }
                        print("\n" + "=" * 60)
                        print("   🎉 [축하] 모든 수신자에게 발송이 완료되었습니다!")
                        print("=" * 60)
        except Exception as loop_err:
            print(f"[!] enter_listener_loop 예외 복구: {loop_err}")
            time.sleep(0.1)

def hotkey_listener_thread():
    """Windows 메시지 루프를 돌며 F8 전역 핫키 감지 (수동 시작/재개용)"""
    global BOT_RUNNING, _DISPATCH_SEQ_ID
    ensure_desktop_attached()
    if not RegisterHotKey(None, HOTKEY_ID_F8, 0, VK_F8):
        print(f"[경고] F8 전역 핫키 등록 실패. 관리자 권한이나 충돌 여부를 확인하세요.")
        return

    msg = wintypes.MSG()
    while GetMessageW(ctypes.byref(msg), None, 0, 0) != 0:
        if msg.message == WM_HOTKEY:
            if msg.wParam == HOTKEY_ID_F8:
                with STATE_LOCK:
                    _DISPATCH_SEQ_ID += 1
                    seq_id = _DISPATCH_SEQ_ID
                    if not BOT_RUNNING:
                        print("\n[⚡ F8 감지] 센스봇 엔터 발송 모드를 시작합니다!")
                        BOT_RUNNING = True
                threading.Thread(target=load_and_dispatch_next, args=(seq_id,), daemon=True).start()

    UnregisterHotKey(None, HOTKEY_ID_F8)



# ==========================================
# 7. On-Demand 리스너 기동 & Z-Core 단일 포트(5199) 라우터 브릿지 (v6.1)
# ==========================================
def ensure_listeners_started() -> None:
    """/start, /skip, /complete_current, /dispatch 호출 시에만 [Enter] 감지 및 [F8] 핫키 스레드를 On-Demand 기동"""
    global _LISTENERS_STARTED
    with _LISTENERS_LOCK:
        if _LISTENERS_STARTED:
            return
        _LISTENERS_STARTED = True
        os.makedirs(os.path.dirname(STATS_FILE), exist_ok=True)
        t_enter = threading.Thread(target=enter_listener_loop, daemon=True, name="SensTalkEnterListener")
        t_enter.start()
        t_hotkey = threading.Thread(target=hotkey_listener_thread, daemon=True, name="SensTalkHotkeyListener")
        t_hotkey.start()


def handle_get(subpath: str) -> Dict[str, Any]:
    global LAST_EVENT
    sub = (subpath or "health").strip("/").lower()

    if sub in ("", "health", "status"):
        recs = SYNCED_STATE.get("recipients", [])
        return {
            "ok": True,
            "status": "ok",
            "service": "SenseBot Local Daemon (Merlin_Z_Core Built-in)",
            "plugin": PLUGIN_METADATA,
            "version": SENSEBOT_VERSION,
            "port": 5199,
            "bot_running": bool(BOT_RUNNING),
            "waiting_enter": bool(WAITING_FOR_USER_ENTER),
            "today_sent": int(get_today_stats()),
            "daily_limit": int(DAILY_LIMIT),
            "kakao_running": find_kakaotalk_window() is not None,
            "workflow": "one_enter_continuous",
            "autostart": bool(w32.is_autostart_enabled()),
            "total": len(recs),
        }

    if sub == "autostart":
        enabled = bool(w32.is_autostart_enabled())
        return {
            "ok": True,
            "enabled": enabled,
            "autostart": enabled,
        }

    if sub == "poll":
        with STATE_LOCK:
            if not BOT_RUNNING and LAST_EVENT and LAST_EVENT.get("type") == "paused":
                if time.time() - LAST_EVENT.get("timestamp", 0) > 300:
                    LAST_EVENT = None
            raw_recs = SYNCED_STATE.get("recipients", [])
            compact_recs = [
                {
                    "id": r.get("id"),
                    "name": _get_rec_display_name(r),
                    "status": r.get("status", "pending"),
                }
                for r in raw_recs
                if isinstance(r, dict)
            ]
            curr_idx = int(SYNCED_STATE.get("currentIndex", 0))
            done_cnt = sum(1 for r in raw_recs if isinstance(r, dict) and r.get("status") == "done")
            skip_cnt = sum(1 for r in raw_recs if isinstance(r, dict) and r.get("status") in ("skipped", "skip"))
            return {
                "ok": True,
                "plugin": "senstalk",
                "port": 5199,
                "last_event": LAST_EVENT,
                "recent_completed": list(RECENT_COMPLETED_LIST[-30:]),
                "watching_manual_chat": bool(WATCHING_MANUAL_CHAT),
                "server_time": time.time(),
                "version": SENSEBOT_VERSION,
                "bot_running": bool(BOT_RUNNING),
                "running": bool(BOT_RUNNING),
                "waiting_enter": bool(WAITING_FOR_USER_ENTER),
                "currentIndex": curr_idx,
                "idx": curr_idx,
                "total": len(raw_recs),
                "doneCount": done_cnt,
                "skipCount": skip_cnt,
                "recipients": compact_recs,
                "queue": compact_recs,
                "channel": str(SYNCED_STATE.get("channel", "kakao")),
                "is_test_mode": bool(IS_TEST_MODE),
                "today_sent": int(get_today_stats()),
                "daily_limit": int(DAILY_LIMIT),
                "autostart": bool(w32.is_autostart_enabled()),
                "status_msg": f"대기열 {len(raw_recs)}건 동기화 완료 (포트 5199 내장 플러그인 v{SENSEBOT_VERSION})",
            }

    return {"ok": False, "error": f"Unknown GET endpoint: /api/senstalk/{sub}"}


def handle_post(subpath: str, data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    global BOT_RUNNING, WAITING_FOR_USER_ENTER, IS_TEST_MODE
    global CURRENT_TARGET_REC, CURRENT_TARGET_INDEX, CURRENT_REC_BLOCKS, CURRENT_BLOCK_INDEX
    global LAST_EVENT, _DISPATCH_SEQ_ID, RECENT_COMPLETED_LIST, WATCHING_MANUAL_CHAT

    sub = (subpath or "").strip("/").lower()
    body = data or {}

    if sub == "autostart":
        enable = bool(body.get("enable", body.get("enabled", True)))
        ok = w32.set_autostart_enabled(enable)
        enabled = bool(w32.is_autostart_enabled())
        return {
            "ok": ok,
            "enabled": enabled,
            "autostart": enabled,
            "msg": "윈도우 시작프로그램에 등록되었습니다." if enabled else "윈도우 시작프로그램 등록이 해제되었습니다.",
        }

    if sub == "sync":
        with STATE_LOCK:
            is_reset = bool(body.get("is_reset", False))
            if not BOT_RUNNING and LAST_EVENT and LAST_EVENT.get("type") == "paused":
                LAST_EVENT = None

            incoming_recs = body.get("recipients")
            if incoming_recs is None:
                incoming_recs = body.get("queue") or body.get("items")

            if incoming_recs is not None and isinstance(incoming_recs, list):
                new_recs: List[Dict[str, Any]] = []
                for r in incoming_recs:
                    if isinstance(r, dict):
                        row = dict(r)
                        if row.get("status") == "ready":
                            row["status"] = "pending"
                        row.setdefault("status", "pending")
                        if "message" not in row and "msg" in row:
                            row["message"] = row["msg"]
                        new_recs.append(row)

                old_recs = SYNCED_STATE.get("recipients", [])
                if is_reset:
                    _DISPATCH_SEQ_ID += 1
                    RECENT_COMPLETED_LIST.clear()
                    WATCHING_MANUAL_CHAT = False
                    for nr in new_recs:
                        nr["status"] = "pending"
                    SYNCED_STATE["recipients"] = new_recs
                    BOT_RUNNING = False
                    WAITING_FOR_USER_ENTER = False
                    IS_TEST_MODE = False
                    CURRENT_TARGET_REC = None
                    CURRENT_TARGET_INDEX = -1
                    CURRENT_REC_BLOCKS = []
                    CURRENT_BLOCK_INDEX = 0
                    SYNCED_STATE["currentIndex"] = 0
                    LAST_EVENT = {"type": "reset", "timestamp": time.time()}
                else:
                    is_start_sync = bool(body.get("is_start_sync", False))
                    if isinstance(old_recs, list) and len(old_recs) == len(new_recs):
                        for idx_sync in range(len(new_recs)):
                            old_st = str(old_recs[idx_sync].get("status") or "pending").strip().lower()
                            new_st = str(new_recs[idx_sync].get("status") or "pending").strip().lower()
                            rc_id = new_recs[idx_sync].get("id")
                            rc_nm = _get_rec_display_name(new_recs[idx_sync])
                            if (
                                new_recs[idx_sync].get("_manualPending")
                                or new_recs[idx_sync].get("_justSkipped")
                                or new_st == "skipped"
                            ):
                                RECENT_COMPLETED_LIST[:] = [
                                    x
                                    for x in RECENT_COMPLETED_LIST
                                    if not (
                                        x.get("index") == idx_sync
                                        or (rc_id and x.get("id") == rc_id)
                                        or (rc_nm and x.get("name") == rc_nm)
                                    )
                                ]
                            elif (not BOT_RUNNING or is_start_sync) and new_st in ("pending", "대기", "wait", ""):
                                new_recs[idx_sync]["status"] = "pending"
                                RECENT_COMPLETED_LIST[:] = [
                                    x
                                    for x in RECENT_COMPLETED_LIST
                                    if not (
                                        x.get("index") == idx_sync
                                        or (rc_id and x.get("id") == rc_id)
                                        or (rc_nm and x.get("name") == rc_nm)
                                    )
                                ]
                            elif BOT_RUNNING and old_st in ("done", "skipped") and new_st in ("pending", "대기", "wait", ""):
                                new_recs[idx_sync]["status"] = old_st
                    else:
                        RECENT_COMPLETED_LIST.clear()

                    SYNCED_STATE["recipients"] = new_recs
                    if CURRENT_TARGET_REC and isinstance(CURRENT_TARGET_REC, dict):
                        c_id = CURRENT_TARGET_REC.get("id")
                        c_name = _get_rec_display_name(CURRENT_TARGET_REC)
                        for idx_nr, nr in enumerate(new_recs):
                            if (c_id and nr.get("id") == c_id) or (c_name and _get_rec_display_name(nr) == c_name):
                                CURRENT_TARGET_REC = nr
                                CURRENT_TARGET_INDEX = idx_nr
                                break

            if "blocks" in body:
                SYNCED_STATE["blocks"] = body["blocks"]
            if "currentIndex" in body:
                if is_reset:
                    SYNCED_STATE["currentIndex"] = 0
                elif not BOT_RUNNING:
                    SYNCED_STATE["currentIndex"] = body["currentIndex"]
                else:
                    req_idx = body["currentIndex"]
                    cur_recs = SYNCED_STATE.get("recipients", [])
                    if isinstance(req_idx, int) and 0 <= req_idx < len(cur_recs) and _is_rec_pending(cur_recs[req_idx]):
                        SYNCED_STATE["currentIndex"] = req_idx
            if "mode" in body:
                SYNCED_STATE["mode"] = body["mode"]
            if "autoSkipAmbiguous" in body:
                SYNCED_STATE["autoSkipAmbiguous"] = bool(body["autoSkipAmbiguous"])
            if "channel" in body:
                SYNCED_STATE["channel"] = body["channel"]
            if "condition" in body:
                SYNCED_STATE["condition"] = body["condition"]

            cnt = len(SYNCED_STATE.get("recipients", []))
            return {
                "ok": True,
                "status": "synced",
                "port": 5199,
                "count": cnt,
                "total": cnt,
                "status_msg": f"📥 발송 대기열 {cnt}건 동기화 완료 (포트 5199 내장 플러그인 v{SENSEBOT_VERSION})",
            }

    if sub == "start":
        ensure_listeners_started()
        _pause_other_local_engine()
        with STATE_LOCK:
            _DISPATCH_SEQ_ID += 1
            seq_id = _DISPATCH_SEQ_ID
            IS_TEST_MODE = False
            BOT_RUNNING = True
        threading.Thread(target=load_and_dispatch_next, args=(seq_id,), daemon=True).start()
        return {"ok": True, "status": "started", "port": 5199}

    if sub == "pause":
        with STATE_LOCK:
            _DISPATCH_SEQ_ID += 1
            BOT_RUNNING = False
            WAITING_FOR_USER_ENTER = False
            IS_TEST_MODE = False
            LAST_EVENT = {"type": "paused", "timestamp": time.time()}
        return {"ok": True, "status": "paused", "port": 5199}

    if sub in ("skip", "complete_current"):
        ensure_listeners_started()
        _pause_other_local_engine()
        action_status = "done" if sub == "complete_current" else "skipped"
        target_id = body.get("completedId") or body.get("skippedId")
        target_name = body.get("completedName") or body.get("skippedName")
        target_idx = body.get("completedIndex") if "completedIndex" in body else body.get("skippedIndex")
        next_idx = body.get("nextIndex")

        with STATE_LOCK:
            _DISPATCH_SEQ_ID += 1
            seq_id = _DISPATCH_SEQ_ID

            if "blocks" in body and isinstance(body["blocks"], list):
                SYNCED_STATE["blocks"] = body["blocks"]
            if "condition" in body and isinstance(body["condition"], dict):
                SYNCED_STATE["condition"] = body["condition"]
            if "channel" in body and body["channel"]:
                SYNCED_STATE["channel"] = body["channel"]

            recs = SYNCED_STATE.get("recipients", [])
            action_ts_ms = int(time.time() * 1000)
            matched_any = False
            if isinstance(target_idx, int) and 0 <= target_idx < len(recs):
                recs[target_idx]["status"] = action_status
                recs[target_idx]["_statusUpdatedAt"] = action_ts_ms
                matched_any = True
            if target_id or target_name:
                for r in recs:
                    if (target_id and r.get("id") == target_id) or (target_name and _get_rec_display_name(r) == target_name):
                        r["status"] = action_status
                        r["_statusUpdatedAt"] = action_ts_ms
                        matched_any = True
            if not matched_any and CURRENT_TARGET_REC:
                CURRENT_TARGET_REC["status"] = action_status
                CURRENT_TARGET_REC["_statusUpdatedAt"] = action_ts_ms
                rec_id = CURRENT_TARGET_REC.get("id")
                rec_nm = _get_rec_display_name(CURRENT_TARGET_REC)
                for r in recs:
                    if (rec_id and r.get("id") == rec_id) or (rec_nm and _get_rec_display_name(r) == rec_nm):
                        r["status"] = action_status
                        r["_statusUpdatedAt"] = action_ts_ms
            if action_status == "skipped":
                RECENT_COMPLETED_LIST[:] = [
                    x
                    for x in RECENT_COMPLETED_LIST
                    if not (
                        (isinstance(target_idx, int) and x.get("index") == target_idx)
                        or (target_id and x.get("id") == target_id)
                        or (target_name and x.get("name") == target_name)
                    )
                ]
            if isinstance(next_idx, int) and 0 <= next_idx < len(recs):
                SYNCED_STATE["currentIndex"] = next_idx

            WAITING_FOR_USER_ENTER = False
            BOT_RUNNING = True

        threading.Thread(target=load_and_dispatch_next, args=(seq_id,), daemon=True).start()
        return {"ok": True, "status": f"{action_status}_and_resumed", "port": 5199}

    if sub == "dispatch":
        ensure_listeners_started()
        target_name = body.get("name") or body.get("recipient") or ""
        if isinstance(target_name, dict):
            target_rec = target_name
            target_name = str(target_rec.get("name") or target_rec.get("이름") or "")
        else:
            target_name = str(target_name)
            target_rec = (
                body.get("recipient")
                if isinstance(body.get("recipient"), dict)
                else {"name": target_name, "이름": target_name}
            )

        message = body.get("message") or body.get("msg") or body.get("text") or ""
        blocks = body.get("blocks", None)
        condition = body.get("condition", None)
        mode = body.get("mode", "classic")
        channel = body.get("channel", SYNCED_STATE.get("channel", "kakao"))

        if not target_name or (not message and not blocks):
            return {
                "ok": False,
                "status": "error",
                "message": "name과 message(또는 blocks)는 필수입니다.",
            }

        result = execute_dispatch(target_name, message, mode, blocks, target_rec, condition, channel)
        result["ok"] = result.get("status") == "success"
        return result

    if sub == "self-update":
        return {
            "ok": True,
            "status": "success",
            "port": 5199,
            "old_version": SENSEBOT_VERSION,
            "new_version": SENSEBOT_VERSION,
            "version": SENSEBOT_VERSION,
            "message": f"Merlin_Z_Core 내장 센스톡 엔진(v{SENSEBOT_VERSION}) 최신 상태입니다.",
        }

    return {"ok": False, "error": f"Unknown POST endpoint: /api/senstalk/{sub}"}


def handle_request(action: str, payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """/__merlin/query 통합 브릿지 경유 호출 시 진입점"""
    act = (action or "health").strip("/").lower()
    if act in ("health", "status", "poll"):
        return handle_get(act)
    return handle_post(act, payload or {})
