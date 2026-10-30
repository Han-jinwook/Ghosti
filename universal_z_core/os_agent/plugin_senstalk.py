#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[내장 소프트웨어 플러그인 2] plugin_senstalk.py (v3.3 — sensebot.py v3.3 100% 무손실 동기화판)
- 센스톡(SensTalk) 6대 메신저(카카오톡·라인·텔레그램·왓츠앱·위챗) 엔터 1회 연속 발송 엔진
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
from typing import Any, Dict, List
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

SENSEBOT_VERSION = "3.3"

PLUGIN_METADATA = {
    "pluginId": "senstalk",
    "pluginName": "SensTalk 6-Messenger Full Native Dispatch Engine (sensebot v3.3)",
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
CURRENT_REC_BLOCKS = []          # 현재 대상 수신자에게 순차 발송할 블록 리스트
CURRENT_BLOCK_INDEX = 0          # 현재 발송 대기 중인 블록 인덱스 (0-based)
CURRENT_CHAT_HWND = None         # 현재 대상의 카카오톡 1:1 대화방 HWND
CURRENT_POPUP_HWND = None        # 카카오톡 [클립보드 이미지 전송] 팝업 모달 HWND
LAST_EVENT = None
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
    fg_tid = GetWindowThreadProcessId(fg_hwnd, None)
    cur_tid = kernel32.GetCurrentThreadId()

    attached = False
    if fg_tid and fg_tid != cur_tid:
        attached = bool(AttachThreadInput(cur_tid, fg_tid, True))

    try:
        ShowWindow(hwnd, SW_RESTORE)
        SetForegroundWindow(hwnd)
        BringWindowToTop(hwnd)
        # 윈도우 시스템 메뉴(Alt 메뉴) 모드 잔여 상태 원천 해제
        user32.SendMessageW(hwnd, 0x001F, 0, 0) # WM_CANCELMODE
    finally:
        if attached:
            AttachThreadInput(cur_tid, fg_tid, False)

    time.sleep(random.uniform(0.09, 0.16))
    return GetForegroundWindow() == hwnd

def find_kakaotalk_window():
    hDesk = ensure_desktop_attached()
    kakao_candidates = []
    WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def enum_proc(hwnd, lParam):
        buff = ctypes.create_unicode_buffer(512)
        GetWindowTextW(hwnd, buff, 512)
        cls_buff = ctypes.create_unicode_buffer(512)
        GetClassNameW(hwnd, cls_buff, 512)
        title = buff.value
        cls = cls_buff.value

        if cls.startswith('EVA_Window'):
            if '카카오톡' in title or 'KakaoTalk' in title or 'īī' in title:
                kakao_candidates.insert(0, hwnd)
            elif not title:
                kakao_candidates.append(hwnd)
        return True

    cb = WNDENUMPROC(enum_proc)
    if hDesk:
        EnumDesktopWindows(hDesk, cb, 0)
    else:
        user32.EnumWindows(cb, 0)

    return kakao_candidates[0] if kakao_candidates else None

def ensure_friends_tab(kakao_hwnd):
    """카카오톡 메인창이 확실하게 '친구' 탭을 보도록 보장 (단톡방/채팅탭 검색 원천 차단)"""
    ensure_desktop_attached()
    force_foreground(kakao_hwnd)
    time.sleep(random.uniform(0.09, 0.16))

    # 1. 혹시 열려있던 검색창이나 팝업을 ESC 2회로 초기화
    press_key(VK_ESCAPE)
    time.sleep(random.uniform(0.06, 0.12))
    press_key(VK_ESCAPE)
    time.sleep(random.uniform(0.06, 0.12))

    # 2. OnlineMainView, ContactListView, 검색창 Edit HWND 찾기
    WS_VISIBLE = 0x10000000
    GWL_STYLE = -16
    online_main_hwnd = None
    contact_hwnd = None
    search_edit_hwnd = None

    def enum_child(hwnd, lparam):
        nonlocal online_main_hwnd, contact_hwnd, search_edit_hwnd
        t = ctypes.create_unicode_buffer(256)
        user32.GetWindowTextW(hwnd, t, 256)
        c = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, c, 256)
        if 'OnlineMainView' in t.value:
            online_main_hwnd = hwnd
        elif 'ContactListView' in t.value:
            contact_hwnd = hwnd
        elif c.value == 'Edit' and contact_hwnd and not search_edit_hwnd:
            search_edit_hwnd = hwnd
        return True

    WNDENUM = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    user32.EnumChildWindows(kakao_hwnd, WNDENUM(enum_child), 0)

    is_contact_visible = False
    if contact_hwnd:
        is_contact_visible = bool(user32.GetWindowLongW(contact_hwnd, GWL_STYLE) & WS_VISIBLE)

    # 친구 탭이 아닐 경우(채팅 탭 등에 있을 경우), 카톡 공식 단축키 Alt+1 우선 적용 후 레일 클릭 fallback
    if not is_contact_visible:
        press_hotkey(0x12, 0x31) # Alt + 1
        time.sleep(random.uniform(0.12, 0.20))
        if contact_hwnd:
            is_contact_visible = bool(user32.GetWindowLongW(contact_hwnd, GWL_STYLE) & WS_VISIBLE)

    if not is_contact_visible:
        target_tab_window = online_main_hwnd if online_main_hwnd else kakao_hwnd
        lparam_friends = (50 << 16) | 33
        user32.PostMessageW(target_tab_window, 0x0201, 1, lparam_friends) # WM_LBUTTONDOWN
        time.sleep(random.uniform(0.03, 0.06))
        user32.PostMessageW(target_tab_window, 0x0202, 0, lparam_friends) # WM_LBUTTONUP
        time.sleep(random.uniform(0.18, 0.32))

    # 이전 검색어가 남아있으면 완전히 비우기
    if search_edit_hwnd:
        user32.SendMessageW(search_edit_hwnd, 0x000C, 0, '') # WM_SETTEXT ''
        user32.SendMessageW(search_edit_hwnd, 0x00B1, 0, -1) # EM_SETSEL all

    return search_edit_hwnd

def paste_message_to_chat(chat_hwnd, message: str, expected_seq_id: int = None):
    """카카오톡 대화방 입력창(RICHEDIT50W)에 메시지를 100% 확실하게 복사/주입하고 입력 포커스 활성화 (동시 호출 직렬화 및 중복 붙여넣기 원천 차단)"""
    if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
        return
    with _PASTE_LOCK:
        if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
            return
        now_ts = time.time()
        if message and _LAST_PASTED_INFO["hwnd"] == chat_hwnd and _LAST_PASTED_INFO["msg"] == message and (now_ts - _LAST_PASTED_INFO["time"] < 12.0):
            print("   [중복 입력 방지] 동일 대화창에 동일한 메시지가 이미 장전되어 중복 붙여넣기를 건너뜁니다.")
            return

        # 대화창 내부의 RICHEDIT50W 컨트롤 탐색
        re_hwnds = []
        def find_re(h, lp):
            c = ctypes.create_unicode_buffer(256)
            user32.GetClassNameW(h, c, 256)
            if 'RICHEDIT' in c.value:
                re_hwnds.append(h)
            return True

        WNDENUM = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        user32.EnumChildWindows(chat_hwnd, WNDENUM(find_re), 0)

        norm_msg = (message or "").replace('\r\n', '\n').replace('\r', '\n').strip()
        if re_hwnds and norm_msg:
            existing_txt = _get_richedit_text(re_hwnds[0]).replace('\r\n', '\n').replace('\r', '\n').strip()
            if existing_txt == norm_msg:
                print("   [중복 입력 방지] 대화창 입력란에 이미 동일한 메시지가 입력되어 있어 재붙여넣기를 건너뜁니다.")
                force_foreground(chat_hwnd)
                _LAST_PASTED_INFO["hwnd"] = chat_hwnd
                _LAST_PASTED_INFO["msg"] = message
                _LAST_PASTED_INFO["time"] = time.time()
                return

        force_foreground(chat_hwnd)
        time.sleep(random.uniform(0.08, 0.14))
        if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
            return
        set_clipboard_text(message)
        time.sleep(random.uniform(0.04, 0.07))

        if re_hwnds:
            re_hwnd = re_hwnds[0]
            # 1. 입력창 내부를 클릭하여 키보드 포커스를 100% 안착시키고 시스템 메뉴 모드 원천 해제
            rect_re = wintypes.RECT()
            user32.GetWindowRect(re_hwnd, ctypes.byref(rect_re))
            click_x = rect_re.left + 35
            click_y = rect_re.top + 15
            user32.SetCursorPos(click_x, click_y)
            time.sleep(random.uniform(0.015, 0.035))
            user32.mouse_event(0x0002, 0, 0, 0, 0) # LEFTDOWN
            time.sleep(random.uniform(0.015, 0.035))
            user32.mouse_event(0x0004, 0, 0, 0, 0) # LEFTUP
            time.sleep(random.uniform(0.04, 0.07))

            # 2. AttachThreadInput으로 SetFocus 명시
            cur_tid = kernel32.GetCurrentThreadId()
            chat_tid = user32.GetWindowThreadProcessId(chat_hwnd, None)
            user32.AttachThreadInput(cur_tid, chat_tid, True)
            user32.SetFocus(re_hwnd)
            user32.AttachThreadInput(cur_tid, chat_tid, False)

            if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
                return

            # 3. 64비트 안전 WM_SETTEXT('') + EM_SETSEL(0, -1) + WM_CLEAR 및 Backspace/Delete로 잔여 텍스트 100% 완전 소거
            empty_buf = ctypes.create_unicode_buffer("")
            user32.SendMessageW(wintypes.HWND(re_hwnd), 0x000C, wintypes.WPARAM(0), empty_buf)          # WM_SETTEXT ''
            user32.SendMessageW(wintypes.HWND(re_hwnd), 0x00B1, wintypes.WPARAM(0), wintypes.LPARAM(-1)) # EM_SETSEL all (64-bit -1)
            user32.SendMessageW(wintypes.HWND(re_hwnd), 0x0303, wintypes.WPARAM(0), wintypes.LPARAM(0))  # WM_CLEAR
            press_key(0x08) # Backspace
            time.sleep(random.uniform(0.025, 0.05))
            press_key(0x2E) # Delete
            time.sleep(random.uniform(0.03, 0.06))

            if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
                return

            # 4. WM_PASTE(0x0302) 메시지로 한/영 및 Ctrl 키 상태와 무관하게 100% 무결점 단일 붙여넣기
            if message:
                user32.SendMessageW(wintypes.HWND(re_hwnd), 0x0302, wintypes.WPARAM(0), wintypes.LPARAM(0)) # WM_PASTE
                time.sleep(random.uniform(0.09, 0.15))
                # 5. 사후 무결성 검증: 혹시라도 기존 텍스트와 합쳐져 2회 중복 입력되었는지 즉시 확인 후 1회분으로 강제 교정!
                after_txt = _get_richedit_text(re_hwnd).replace('\r\n', '\n').replace('\r', '\n').strip()
                if norm_msg and len(after_txt) > len(norm_msg) + 4:
                    msg_buf = ctypes.create_unicode_buffer(message)
                    user32.SendMessageW(wintypes.HWND(re_hwnd), 0x000C, wintypes.WPARAM(0), msg_buf)
                    user32.SendMessageW(wintypes.HWND(re_hwnd), 0x00B1, wintypes.WPARAM(len(message)), wintypes.LPARAM(len(message)))
                    print("   [무결성 자동 교정] 입력창 중복 텍스트 감지 즉시 1회분 단일 본문으로 교정 완료!")
                _LAST_PASTED_INFO["hwnd"] = chat_hwnd
                _LAST_PASTED_INFO["msg"] = message
                _LAST_PASTED_INFO["time"] = time.time()

            # 6. 혹시 모를 시스템 메뉴 상태 완벽 취소
            user32.SendMessageW(wintypes.HWND(chat_hwnd), 0x001F, wintypes.WPARAM(0), wintypes.LPARAM(0)) # WM_CANCELMODE
        elif message:
            # 보조: 키보드 Ctrl + V
            press_hotkey(VK_CONTROL, VK_V)
            time.sleep(random.uniform(0.12, 0.20))
            _LAST_PASTED_INFO["hwnd"] = chat_hwnd
            _LAST_PASTED_INFO["msg"] = message
            _LAST_PASTED_INFO["time"] = time.time()

def set_clipboard_text(text: str) -> bool:
    CF_UNICODETEXT = 13
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
        if not text:
            return True
        bytes_data = (text + '\0').encode('utf-16-le')
        h_mem = GlobalAlloc(GMEM_MOVEABLE, len(bytes_data))
        if not h_mem:
            return False
        ptr = GlobalLock(h_mem)
        if not ptr:
            return False
        ctypes.memmove(ptr, bytes_data, len(bytes_data))
        GlobalUnlock(h_mem)
        SetClipboardData(CF_UNICODETEXT, h_mem)
        return True
    finally:
        user32.CloseClipboard()

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
    global CURRENT_POPUP_HWND
    ensure_desktop_attached()

    if not set_clipboard_image_from_dataurl(data_url_str):
        print("⚠️ 이미지 클립보드 장전 실패")
        return False

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

    press_hotkey(VK_CONTROL, VK_V)
    time.sleep(random.uniform(0.28, 0.45))

    popup = find_and_focus_image_popup()
    CURRENT_POPUP_HWND = popup
    if popup:
        force_foreground(popup)
        time.sleep(random.uniform(0.08, 0.15))
    return True

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
    for k in ["phone", "전화번호", "연락처", "휴대폰", "핸드폰", "mobile", "tel"]:
        val = rec.get(k)
        if val is not None and str(val).strip():
            return str(val).strip()
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
    name = str(rec.get("name") or rec.get("이름") or "").strip()
    nickname = str(rec.get("별명") or rec.get("nickname") or rec.get("nick") or "").strip()
    phone = get_recipient_phone(rec)
    intl_phone = normalize_korean_phone_intl(phone)
    b_type = first_block.get("type", "text")

    if channel == "kakao":
        chat_hwnd, pre_opened = open_or_focus_chat_window(name, fallback_nickname=nickname, expected_seq_id=expected_seq_id)
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
STATS_FILE = os.path.join(os.path.dirname(__file__), "bot_stats.json")
DAILY_LIMIT = 500

def get_today_stats():
    today_str = str(date.today())
    if os.path.exists(STATS_FILE):
        try:
            with open(STATS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("date") == today_str:
                    return data.get("count", 0)
        except Exception:
            pass
    return 0

def increment_today_stats():
    today_str = str(date.today())
    count = get_today_stats() + 1
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

def find_open_chat_window(target_name: str = ""):
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
            title = t.value.strip().lower()
            if clean_target and (clean_target in title or (title and title in clean_target)):
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
def check_kakao_search_result_count(kakao_hwnd):
    """
    카카오톡 친구 탭에서 검색 후 결과 개수를 정밀 판별
    반환값:
       0: 검색 결과 0건 (결과 없음)
       1: 검색 결과 정확히 1건 (단일 대상)
       2: 검색 결과 2건 이상 (복수 대상 -> 엔터 치면 안 됨!)
      -1: 캡처 불가 또는 판별 실패 (기존 로직 유지)
    """
    search_ctrl = None
    contact_list_view = None

    def find_views(ch, lp):
        nonlocal search_ctrl, contact_list_view
        t = ctypes.create_unicode_buffer(256)
        user32.GetWindowTextW(ch, t, 256)
        if 'ContactListView' in t.value:
            contact_list_view = ch
        return True

    user32.EnumChildWindows(kakao_hwnd, ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)(find_views), 0)

    target_parent = contact_list_view if contact_list_view else kakao_hwnd

    def find_search_list(ch, lp):
        nonlocal search_ctrl
        t = ctypes.create_unicode_buffer(256)
        user32.GetWindowTextW(ch, t, 256)
        if 'SearchListCtrl' in t.value and user32.IsWindowVisible(ch):
            search_ctrl = ch
        return True

    user32.EnumChildWindows(target_parent, ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)(find_search_list), 0)

    if not search_ctrl or not user32.IsWindow(search_ctrl) or not user32.IsWindowVisible(search_ctrl):
        return -1

    try:
        from PIL import Image
        gdi32 = ctypes.windll.gdi32
        rect = wintypes.RECT()
        user32.GetClientRect(search_ctrl, ctypes.byref(rect))
        w = rect.right - rect.left
        h = rect.bottom - rect.top
        if w <= 0 or h <= 0:
            return -1

        hdc_src = user32.GetDC(search_ctrl)
        hdc_mem = gdi32.CreateCompatibleDC(hdc_src)
        hbm = gdi32.CreateCompatibleBitmap(hdc_src, w, h)
        gdi32.SelectObject(hdc_mem, hbm)

        # PW_RENDERFULLCONTENT = 2
        user32.PrintWindow(search_ctrl, hdc_mem, 2)

        class BITMAPINFOHEADER(ctypes.Structure):
            _fields_ = [
                ('biSize', wintypes.DWORD), ('biWidth', wintypes.LONG), ('biHeight', wintypes.LONG),
                ('biPlanes', wintypes.WORD), ('biBitCount', wintypes.WORD), ('biCompression', wintypes.DWORD),
                ('biSizeImage', wintypes.DWORD), ('biXPelsPerMeter', wintypes.LONG), ('biYPelsPerMeter', wintypes.LONG),
                ('biClrUsed', wintypes.DWORD), ('biClrImportant', wintypes.DWORD)
            ]
        class BITMAPINFO(ctypes.Structure):
            _fields_ = [('bmiHeader', BITMAPINFOHEADER), ('bmiColors', wintypes.DWORD * 3)]

        bmi = BITMAPINFO()
        bmi.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
        bmi.bmiHeader.biWidth = w
        bmi.bmiHeader.biHeight = -h
        bmi.bmiHeader.biPlanes = 1
        bmi.bmiHeader.biBitCount = 32
        bmi.bmiHeader.biCompression = 0

        buf = ctypes.create_string_buffer(w * h * 4)
        gdi32.GetDIBits(hdc_mem, hbm, 0, h, buf, ctypes.byref(bmi), 0)
        img = Image.frombuffer('RGBA', (w, h), buf, 'raw', 'BGRA', 0, 1).convert('RGB')

        gdi32.DeleteObject(hbm)
        gdi32.DeleteDC(hdc_mem)
        user32.ReleaseDC(search_ctrl, hdc_src)

        # 시스템 DPI 배율 감안
        scale = 1.0
        try:
            hdc_screen = user32.GetDC(0)
            dpi = gdi32.GetDeviceCaps(hdc_screen, 88)
            user32.ReleaseDC(0, hdc_screen)
            if dpi > 0:
                scale = dpi / 96.0
        except Exception:
            scale = 1.0

        r1_top = int(28 * scale)
        r1_bottom = min(h, int(80 * scale))
        r2_top = int(88 * scale)
        r2_bottom = min(h, int(140 * scale))
        col_right = min(w, int(220 * scale))
        col_left = int(20 * scale)

        # 텍스트/프로필 진한 픽셀(< 185) 검사: 첫 번째 행의 선택 하이라이트 회색 배경(RGB 237,237,237) 오탐지 원천 차단!
        crop1 = img.crop((col_left, r1_top, col_right, r1_bottom))
        dark1 = sum(1 for pix in crop1.getdata() if pix[0] < 185 or pix[1] < 185 or pix[2] < 185)

        if dark1 < 25:
            return 0

        # 2번째 행 영역 검사 (이름 텍스트의 진한 글자 픽셀 < 130 및 프로필/상태메시지 픽셀 < 185 동시 검증)
        if r2_top >= h - 10:
            return 1
        crop2 = img.crop((col_left, r2_top, col_right, r2_bottom))
        dark2 = sum(1 for pix in crop2.getdata() if pix[0] < 185 or pix[1] < 185 or pix[2] < 185)
        text_col_left = min(w - 1, int(75 * scale))
        crop2_text = img.crop((text_col_left, r2_top, col_right, r2_bottom))
        bold_text2 = sum(1 for pix in crop2_text.getdata() if pix[0] < 125 and pix[1] < 125 and pix[2] < 125)

        if dark2 < 35 or bold_text2 < 15:
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

def _try_search_friend_chat(kakao_hwnd, search_keyword: str, full_name_ref: str = "", expected_seq_id: int = None):
    """
    카카오톡 친구 탭에서 특정 키워드로 검색 후 1:1 대화방 오픈 시도
    - 단일 결과(1명): 자동으로 [Enter] 타건하여 1:1 대화방 즉시 오픈
    - 복수 결과(2명 이상): ⭐️ 첫 번째 친구를 무자비하게 열지 않고 유저가 마우스로 선택할 때까지 대기
    - 0건 결과: None 반환 (폴백 별명 검색 또는 미발견 처리)
    """
    clean_kw = search_keyword.strip()
    if not clean_kw:
        return None
    if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
        return None

    # 친구 탭 보장 및 이전 검색어 초기화 (ESC x 2 포함)
    search_edit = ensure_friends_tab(kakao_hwnd)
    if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
        return None
    force_foreground(kakao_hwnd)
    time.sleep(random.uniform(0.06, 0.12))

    # 친구 검색창 커서 활성화 및 기존 텍스트 비우기
    if search_edit:
        user32.SendMessageW(search_edit, 0x000C, 0, '') # WM_SETTEXT ''
        time.sleep(random.uniform(0.03, 0.06))

    press_hotkey(VK_CONTROL, VK_F)
    time.sleep(random.uniform(0.08, 0.14))

    # 검색어 입력 (WM_PASTE 또는 Ctrl+V 1회)
    set_clipboard_text(clean_kw)
    time.sleep(random.uniform(0.04, 0.08))
    if search_edit and user32.IsWindow(search_edit):
        user32.SendMessageW(search_edit, 0x000C, 0, '') # WM_SETTEXT ''
        user32.SendMessageW(search_edit, 0x0302, 0, 0)  # WM_PASTE
    else:
        press_hotkey(VK_CONTROL, VK_V)
    time.sleep(random.uniform(0.40, 0.50)) # 카카오톡 검색 결과 렌더링 대기

    if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
        return None

    # ⭐️ [핵심] 검색 결과 개수 정밀 판별 (0건 vs 1건 vs 2건 이상 복수)
    result_count = check_kakao_search_result_count(kakao_hwnd)

    if result_count == 2:
        # ⚠️ 복수(2명 이상) 검색 결과 감지!
        # 첫 번째 친구를 무자비하게 열지 않고, 유저가 마우스로 직접 선택할 때까지 선택 대기!
        target_disp = full_name_ref or clean_kw
        chat_hwnd = wait_for_user_to_open_chat(kakao_hwnd, target_disp, expected_seq_id=expected_seq_id)
        return chat_hwnd
    elif result_count == 0:
        # 검색 결과 0건 -> 불필요한 엔터 타건을 방지하고 즉시 None 반환
        print(f"[카카오톡 친구 검색] '{clean_kw}' 검색 결과 0건 (목록 없음)")
        return None

    if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
        return None

    # result_count == 1 (단일 결과) 또는 -1 (판별 불가 fallback)인 경우:
    # 안전하게 [Enter] 타건하여 친구 1:1 대화방 오픈 시도
    press_key(VK_RETURN)
    time.sleep(random.uniform(0.38, 0.58))

    # 1:1 대화방 오픈 확인 및 대기 (최대 1.3초)
    chat_hwnd = None
    start_wait = time.time()
    while time.time() - start_wait < 1.3:
        if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
            return None
        chat_hwnd = find_open_chat_window(clean_kw) or (find_open_chat_window(full_name_ref) if full_name_ref else None)
        if chat_hwnd:
            break
        fg_hwnd = GetForegroundWindow()
        if fg_hwnd and fg_hwnd != kakao_hwnd and is_chat_window(fg_hwnd):
            t = ctypes.create_unicode_buffer(512)
            user32.GetWindowTextW(fg_hwnd, t, 512)
            title = t.value.strip().lower()
            ck_lower = clean_kw.lower()
            fn_lower = full_name_ref.strip().lower() if full_name_ref else ""
            if (ck_lower and (ck_lower in title or (len(title) >= 2 and title in ck_lower))) or \
               (fn_lower and (fn_lower in title or (len(title) >= 2 and title in fn_lower))):
                chat_hwnd = fg_hwnd
                break
        time.sleep(random.uniform(0.06, 0.12))

    if not chat_hwnd:
        if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
            return None
        # 보조 시도: 방향키 아래(Down) ➔ Enter (검색 결과 목록 첫 번째 친구 진입)
        press_key(VK_DOWN)
        time.sleep(random.uniform(0.06, 0.12))
        press_key(VK_RETURN)
        time.sleep(random.uniform(0.38, 0.58))
        chat_hwnd = find_open_chat_window(clean_kw) or (find_open_chat_window(full_name_ref) if full_name_ref else None)
        if not chat_hwnd:
            fg_hwnd = GetForegroundWindow()
            if fg_hwnd and fg_hwnd != kakao_hwnd and is_chat_window(fg_hwnd):
                chat_hwnd = fg_hwnd

    return chat_hwnd

def open_or_focus_chat_window(target_name: str, fallback_nickname: str = "", expected_seq_id: int = None):
    """
    대상 친구와의 1:1 대화방을 찾거나 검색하여 열고 포커스 활성화
    - 1차: target_name (최대 20자 규격)으로 친구 검색 및 대화방 오픈 시도
    - 2차 (실패 시): fallback_nickname (순수 별명 또는 접두어, 최대 20자)으로 2차 폴백 검색 시도
    반환: (chat_hwnd, pre_opened)
    """
    time.sleep(random.uniform(0.08, 0.15))
    if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
        return None, False

    target_name = (target_name or "").strip()
    fallback_nickname = (fallback_nickname or "").strip()

    # ⭐️ 멀린님 지침: 1차 검색어는 최초 '/' 앞까지만 (별명+연월, '/'는 제외) 축소하여 카톡 검색 매칭 극대화
    if '/' in target_name:
        primary_query = target_name.split('/')[0].strip()[:20]
    else:
        primary_query = target_name[:20].strip()

    # 2차 시도용 fallback 결정 (순수 별명)
    fallback_query = fallback_nickname[:20].strip()
    if not fallback_query and target_name:
        # fallback_nickname이 없으면 primary_query에서 뒤쪽 4자리 숫자(연월)를 제거한 순수 별명 자동 추출
        clean_nick = re.sub(r'\d{4}$', '', primary_query).strip()
        if clean_nick and clean_nick != primary_query:
            fallback_query = clean_nick[:20]
        elif '-' in target_name:
            fallback_query = target_name.split('-')[0].strip()[:20]

    # 1. 대상 친구와의 1:1 대화창이 이미 열려있는 경우 (0초 즉시 직통)
    existing_chat = find_open_chat_window(primary_query)
    if not existing_chat and fallback_query:
        existing_chat = find_open_chat_window(fallback_query)
    if existing_chat:
        force_foreground(existing_chat)
        return existing_chat, True

    # 2. 카카오톡 메인창 탐색 및 활성화
    kakao_hwnd = find_kakaotalk_window()
    if not kakao_hwnd:
        return None, False

    # 3. 1차 시도: 20자 규격 이름으로 검색
    chat_hwnd = _try_search_friend_chat(kakao_hwnd, primary_query, target_name, expected_seq_id=expected_seq_id)
    if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
        return None, False
    if chat_hwnd:
        force_foreground(chat_hwnd)
        return chat_hwnd, False

    # ⭐️ 유저가 복수 선택 대기 중 중지(Stop/Pause) 또는 패스(Skip)를 눌렀으면 2차 시도를 건너뜀
    if not BOT_RUNNING or (expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID):
        return None, False

    # 4. 2차 시도: 1차 실패 시 별명(또는 접두어)으로 스마트 폴백 검색
    if fallback_query and fallback_query != primary_query:
        print(f"[카카오톡 친구 검색] 1차 실패('{primary_query}') -> 2차 별명 검색 시도: '{fallback_query}'")
        chat_hwnd = _try_search_friend_chat(kakao_hwnd, fallback_query, target_name, expected_seq_id=expected_seq_id)
        if expected_seq_id is not None and expected_seq_id != _DISPATCH_SEQ_ID:
            return None, False
        if chat_hwnd:
            print(f"[카카오톡 친구 검색] 2차 별명 검색 성공: '{fallback_query}' (대상: '{target_name}')")
            force_foreground(chat_hwnd)
            return chat_hwnd, False

    print(f"[카카오톡 친구 검색] 최종 검색 실패: '{primary_query}'" + (f" (2차 별명: '{fallback_query}')" if fallback_query != primary_query else ""))
    return None, False

def execute_dispatch(target_name: str, message: str = "", mode: str = "classic", blocks: list = None, rec: dict = None, condition: dict = None, channel: str = "kakao"):
    """단일 수신자 1:1 테스트 발송 및 다중 블록(B1, B2...) 순차 장전 인터페이스"""
    global WAITING_FOR_USER_ENTER, BOT_RUNNING, IS_TEST_MODE
    global CURRENT_TARGET_REC, CURRENT_REC_BLOCKS, CURRENT_BLOCK_INDEX, CURRENT_CHAT_HWND, CURRENT_POPUP_HWND

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
    chat_hwnd, pre_opened = open_channel_chat_or_link(channel, target_rec, first_block)
    ch_names = {
        "kakao": "카카오톡",
        "line": "라인(LINE)",
        "telegram": "텔레그램(Telegram)",
        "whatsapp": "왓츠앱(WhatsApp)",
        "wechat": "위챗(WeChat)"
    }
    ch_kr = ch_names.get(channel, channel.upper())

    if not chat_hwnd:
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
        time.sleep(random.uniform(0.04, 0.08))

def load_emoticon_to_chat(chat_hwnd, block):
    """
    카톡 이모티콘 플러스 추천창을 이용한 이모티콘 장전 (멀린님 설계)
    1) 입력창에 키워드(감사/사랑 등) 타이핑 → 추천 이모티콘 작은 창이 뜸
    2) ↑ : 추천창 진입 (좌상단 첫 번째 선택)
    3) → (칸-1)회, ↓ (줄-1)회 : 지정한 칸으로 이동
    4) Enter : 선택 → 입력창 위 미리보기 상태
    → 유저가 화면 확인 후 [Enter]를 치면 전송
    """
    keyword = str(block.get("keyword") or "").strip()
    row = int(block.get("row", 1) or 1)
    col = int(block.get("col", 1) or 1)
    if not keyword:
        return False

    # 입력창 포커스 및 비우기 (텍스트 장전과 동일한 방식) 후 빈 상태에서 키워드를 직접 타이핑
    paste_message_to_chat(chat_hwnd, "")
    time.sleep(0.05)

    _type_unicode_text(keyword)
    time.sleep(random.uniform(0.65, 0.85))  # 추천창 렌더링 대기

    press_key(0x26)  # ↑ 추천창 진입 (1줄 1번째)
    time.sleep(random.uniform(0.12, 0.18))
    for _ in range(max(0, col - 1)):
        press_key(0x27)  # →
        time.sleep(random.uniform(0.07, 0.11))
    for _ in range(max(0, row - 1)):
        press_key(VK_DOWN)  # ↓
        time.sleep(random.uniform(0.07, 0.11))

    press_key(VK_RETURN)  # 선택 → 미리보기
    time.sleep(random.uniform(0.18, 0.28))
    print(f"   [😊 이모티콘 장전] '{keyword}' 추천창 {row}줄 {col}번째 → 미리보기 완료. 확인 후 [Enter]를 치세요.")
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

def load_and_dispatch_next(expected_seq_id: int = None):
    """다음 대기자를 카카오톡에 장전하고 유저의 엔터 대기 상태로 전환"""
    global WAITING_FOR_USER_ENTER, BOT_RUNNING, CURRENT_TARGET_REC, LAST_EVENT
    global CURRENT_REC_BLOCKS, CURRENT_BLOCK_INDEX, CURRENT_CHAT_HWND, CURRENT_POPUP_HWND
    global _DISPATCH_SEQ_ID

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
                if recipients[i].get("status") == "pending":
                    target_rec = recipients[i]
                    target_idx = i
                    break

            # 없으면 0번부터 다시 탐색
            if not target_rec:
                for i in range(0, curr_idx):
                    if recipients[i].get("status") == "pending":
                        target_rec = recipients[i]
                        target_idx = i
                        break

            if not target_rec:
                BOT_RUNNING = False
                WAITING_FOR_USER_ENTER = False
                CURRENT_TARGET_REC = None
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
            name = target_rec.get("name", "")
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
            print(f"⚠️ {ch_kr}에서 '{name}' 대화방을 찾지 못했습니다.")
            with STATE_LOCK:
                if my_seq_id != _DISPATCH_SEQ_ID:
                    return False
                BOT_RUNNING = False
                WAITING_FOR_USER_ENTER = False
                LAST_EVENT = {
                    "type": "paused",
                    "reason": "not_found",
                    "targetId": target_rec.get("id"),
                    "name": name,
                    "message": f"{ch_kr}에서 '{name}' 님을 찾지 못했습니다. (대화방/연락처 없음)",
                    "timestamp": time.time()
                }
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
    global WAITING_FOR_USER_ENTER, BOT_RUNNING, CURRENT_TARGET_REC, LAST_EVENT, IS_TEST_MODE
    global CURRENT_REC_BLOCKS, CURRENT_BLOCK_INDEX, CURRENT_CHAT_HWND, CURRENT_POPUP_HWND
    ensure_desktop_attached()
    print("[*] ✅ 센스봇 [Enter] 연속 발송 감지 엔진 가동 중... (전 채널 다중 블록 순차 지원)")

    while True:
        time.sleep(0.02)

        # F9 키 감지 시 일시정지
        if user32.GetAsyncKeyState(VK_F9) & 0x8000:
            while user32.GetAsyncKeyState(VK_F9) & 0x8000:
                time.sleep(0.02)
            if BOT_RUNNING:
                BOT_RUNNING = False
                WAITING_FOR_USER_ENTER = False
                IS_TEST_MODE = False
                print("\n[⏸️ 일시정지] 센스봇 자동 루프가 일시정지되었습니다. (PWA [발송 시작] 또는 F8로 재개)")
                with STATE_LOCK:
                    LAST_EVENT = {"type": "paused", "timestamp": time.time()}
                continue

        if not BOT_RUNNING or not WAITING_FOR_USER_ENTER:
            continue

        # 유저가 Enter 키를 눌렀는지 확인 (최상위 비트 0x8000)
        if user32.GetAsyncKeyState(VK_RETURN) & 0x8000:
            fg = GetForegroundWindow()
            channel = SYNCED_STATE.get("channel", "kakao")
            is_valid_fg = is_valid_messenger_window(fg, channel)
            if not is_valid_fg:
                time.sleep(0.05)
                continue

            # 키를 뗄 때까지 대기 (Key-Up 시점에 발송 확정)
            while user32.GetAsyncKeyState(VK_RETURN) & 0x8000:
                time.sleep(0.01)

            WAITING_FOR_USER_ENTER = False
            CURRENT_POPUP_HWND = None

            rec = CURRENT_TARGET_REC
            name = rec.get("name", "") if rec else ""
            total_b = len(CURRENT_REC_BLOCKS)
            curr_b_idx = CURRENT_BLOCK_INDEX

            b_type_kr = "사진" if (curr_b_idx < total_b and CURRENT_REC_BLOCKS[curr_b_idx]["type"] == "image") else ("이모티콘" if (curr_b_idx < total_b and CURRENT_REC_BLOCKS[curr_b_idx]["type"] == "emoticon") else "텍스트")
            print(f"   [타건 감지] '{name}'님 [{curr_b_idx + 1}/{total_b} {b_type_kr}] 전송 확정! ({channel})")

            # 1. 다음 블록이 더 남아있는 경우: 동일 대화방에서 다음 블록(사진 등) 연속 장전!
            if curr_b_idx + 1 < total_b:
                CURRENT_BLOCK_INDEX += 1
                next_b_idx = CURRENT_BLOCK_INDEX
                next_block = CURRENT_REC_BLOCKS[next_b_idx]
                next_b_kr = "사진(이미지)" if next_block["type"] == "image" else ("이모티콘" if next_block["type"] == "emoticon" else "텍스트")

                # 이전 말풍선 전송 안정화 및 어뷰징 패턴 탐지 방어 지터 (0.4 ~ 1.0초 무작위 지연)
                block_delay = random.uniform(0.4, 1.0)
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
                if rec:
                    rec["status"] = "done"
                rec_id = rec.get("id") if rec else ""
                # SYNCED_STATE 명단 배열 내 해당 수신자 완료 처리 및 다음 대기자 인덱스로 즉시 선제 전진
                recs_list = SYNCED_STATE.get("recipients", [])
                done_idx = SYNCED_STATE.get("currentIndex", 0)
                for idx_r, r in enumerate(recs_list):
                    if (rec_id and r.get("id") == rec_id) or (name and r.get("name") == name):
                        r["status"] = "done"
                        done_idx = idx_r

                next_pending_idx = -1
                for idx_r in range(done_idx + 1, len(recs_list)):
                    if recs_list[idx_r].get("status") == "pending":
                        next_pending_idx = idx_r
                        break
                if next_pending_idx == -1:
                    for idx_r in range(0, done_idx):
                        if recs_list[idx_r].get("status") == "pending":
                            next_pending_idx = idx_r
                            break
                if next_pending_idx != -1:
                    SYNCED_STATE["currentIndex"] = next_pending_idx

                LAST_EVENT = {
                    "type": "sent_and_advancing",
                    "id": rec_id,
                    "name": name,
                    "nextIndex": SYNCED_STATE.get("currentIndex", 0),
                    "channel": channel,
                    "timestamp": time.time()
                }

            new_count = increment_today_stats()
            print(f"[✅ 발송 완료] '{name}' 님께 모든 블록({total_b}개) 발송 완료! (금일 {new_count}/{DAILY_LIMIT}건)")

            # 메시지 전송 완료 및 어뷰징 방어 자연스러운 지터 (0.35 ~ 0.75초 무작위 지연)
            time.sleep(random.uniform(0.35, 0.75))

            if _DISPATCH_SEQ_ID != enter_seq_id:
                continue

            has_more = False
            with STATE_LOCK:
                recipients = SYNCED_STATE.get("recipients", [])
                has_more = any(r.get("status") == "pending" for r in recipients)

            pre_opened = rec.get("_pre_opened", False) if rec else False
            if channel == "kakao" and not pre_opened and has_more:
                if _DISPATCH_SEQ_ID == enter_seq_id:
                    press_key(VK_ESCAPE)
                    time.sleep(random.uniform(0.18, 0.35))

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
                            if r.get("status") == "pending":
                                r["status"] = "done"
                        LAST_EVENT = {
                            "type": "all_completed",
                            "timestamp": time.time()
                        }
                    print("\n" + "=" * 60)
                    print("   🎉 [축하] 모든 수신자에게 발송이 완료되었습니다!")
                    print("=" * 60)

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
# 7. On-Demand 리스너 기동 & Z-Core 단일 포트(5199) 라우터 브릿지
# ==========================================
def ensure_listeners_started() -> None:
    """/sync, /start, /dispatch 호출 시에만 [Enter] 감지 및 [F8] 핫키 스레드를 On-Demand 기동"""
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
            "bot_running": BOT_RUNNING,
            "waiting_enter": WAITING_FOR_USER_ENTER,
            "today_sent": get_today_stats(),
            "daily_limit": DAILY_LIMIT,
            "kakao_running": find_kakaotalk_window() is not None,
            "workflow": "one_enter_continuous",
            "autostart": w32.is_autostart_enabled(),
            "total": len(recs),
        }

    if sub == "autostart":
        enabled = w32.is_autostart_enabled()
        return {
            "ok": True,
            "enabled": enabled,
            "autostart": enabled,
        }

    if sub == "poll":
        with STATE_LOCK:
            if not BOT_RUNNING and LAST_EVENT and LAST_EVENT.get("type") == "paused":
                if time.time() - LAST_EVENT.get("timestamp", 0) > 30:
                    LAST_EVENT = None
            recs = SYNCED_STATE.get("recipients", [])
            curr_idx = SYNCED_STATE.get("currentIndex", 0)
            done_cnt = sum(1 for r in recs if isinstance(r, dict) and r.get("status") == "done")
            skip_cnt = sum(1 for r in recs if isinstance(r, dict) and r.get("status") in ("skipped", "skip"))
            return {
                "ok": True,
                "plugin": "senstalk",
                "port": 5199,
                "last_event": LAST_EVENT,
                "server_time": time.time(),
                "version": SENSEBOT_VERSION,
                "bot_running": BOT_RUNNING,
                "running": BOT_RUNNING,
                "waiting_enter": WAITING_FOR_USER_ENTER,
                "currentIndex": curr_idx,
                "idx": curr_idx,
                "total": len(recs),
                "doneCount": done_cnt,
                "skipCount": skip_cnt,
                "recipients": recs,
                "queue": recs,
                "channel": SYNCED_STATE.get("channel", "kakao"),
                "is_test_mode": IS_TEST_MODE,
                "today_sent": get_today_stats(),
                "daily_limit": DAILY_LIMIT,
                "autostart": w32.is_autostart_enabled(),
                "status_msg": f"대기열 {len(recs)}건 동기화 완료 (포트 5199 내장 플러그인 v{SENSEBOT_VERSION})",
            }

    return {"ok": False, "error": f"Unknown GET endpoint: /api/senstalk/{sub}"}


def handle_post(subpath: str, data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    global BOT_RUNNING, WAITING_FOR_USER_ENTER, IS_TEST_MODE
    global CURRENT_TARGET_REC, CURRENT_REC_BLOCKS, CURRENT_BLOCK_INDEX, LAST_EVENT, _DISPATCH_SEQ_ID

    sub = (subpath or "").strip("/").lower()
    body = data or {}

    if sub == "autostart":
        enable = bool(body.get("enable", body.get("enabled", True)))
        ok = w32.set_autostart_enabled(enable)
        enabled = w32.is_autostart_enabled()
        return {
            "ok": ok,
            "enabled": enabled,
            "autostart": enabled,
            "msg": "윈도우 시작프로그램에 등록되었습니다." if enabled else "윈도우 시작프로그램 등록이 해제되었습니다.",
        }

    if sub == "sync":
        with STATE_LOCK:
            is_reset = body.get("is_reset", False)
            if not BOT_RUNNING and LAST_EVENT and LAST_EVENT.get("type") == "paused":
                LAST_EVENT = None

            incoming_recs = body.get("recipients")
            if incoming_recs is None:
                incoming_recs = body.get("queue") or body.get("items")

            if incoming_recs is not None and isinstance(incoming_recs, list):
                new_recs = []
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
                    for nr in new_recs:
                        nr["status"] = "pending"
                    BOT_RUNNING = False
                    WAITING_FOR_USER_ENTER = False
                    CURRENT_TARGET_REC = None
                    CURRENT_REC_BLOCKS = []
                    CURRENT_BLOCK_INDEX = 0
                    SYNCED_STATE["currentIndex"] = 0
                    LAST_EVENT = {"type": "reset", "timestamp": time.time()}
                elif isinstance(old_recs, list) and len(new_recs) == len(old_recs):
                    for i, nr in enumerate(new_recs):
                        if old_recs[i].get("status") == "done" and nr.get("status") != "done":
                            nr["status"] = "done"
                SYNCED_STATE["recipients"] = new_recs

            if "blocks" in body:
                SYNCED_STATE["blocks"] = body["blocks"]
            if "currentIndex" in body:
                SYNCED_STATE["currentIndex"] = 0 if is_reset else body["currentIndex"]
            if "mode" in body:
                SYNCED_STATE["mode"] = body["mode"]
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

    if sub == "skip":
        ensure_listeners_started()
        _pause_other_local_engine()
        skipped_id = body.get("skippedId")
        skipped_name = body.get("skippedName")
        skipped_idx = body.get("skippedIndex")
        next_idx = body.get("nextIndex")

        with STATE_LOCK:
            _DISPATCH_SEQ_ID += 1
            seq_id = _DISPATCH_SEQ_ID
            recs = SYNCED_STATE.get("recipients", [])
            if isinstance(skipped_idx, int) and 0 <= skipped_idx < len(recs):
                if recs[skipped_idx].get("status") != "done":
                    recs[skipped_idx]["status"] = "skipped"
            if skipped_id or skipped_name:
                for r in recs:
                    if (skipped_id and r.get("id") == skipped_id) or (skipped_name and r.get("name") == skipped_name):
                        if r.get("status") != "done":
                            r["status"] = "skipped"
            if CURRENT_TARGET_REC:
                if CURRENT_TARGET_REC.get("status") != "done":
                    CURRENT_TARGET_REC["status"] = "skipped"
                rec_id = CURRENT_TARGET_REC.get("id")
                for r in recs:
                    if (rec_id and r.get("id") == rec_id) or (r.get("name") == CURRENT_TARGET_REC.get("name")):
                        if r.get("status") != "done":
                            r["status"] = "skipped"
            if isinstance(next_idx, int) and 0 <= next_idx < len(recs):
                SYNCED_STATE["currentIndex"] = next_idx

            WAITING_FOR_USER_ENTER = False
            BOT_RUNNING = True

        threading.Thread(target=load_and_dispatch_next, args=(seq_id,), daemon=True).start()
        return {"ok": True, "status": "skipped_and_resumed", "port": 5199}

    if sub == "dispatch":
        ensure_listeners_started()
        target_name = body.get("name") or body.get("recipient") or ""
        if isinstance(target_name, dict):
            target_rec = target_name
            target_name = str(target_rec.get("name") or target_rec.get("이름") or "")
        else:
            target_name = str(target_name)
            target_rec = body.get("recipient") if isinstance(body.get("recipient"), dict) else {"name": target_name, "이름": target_name}

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
