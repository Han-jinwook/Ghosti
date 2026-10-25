# -*- coding: utf-8 -*-
"""
Merlin Z-Core (범용 만능 멀린 Z-코어) — 공통 Win32 네이티브 제어 코어 (core_win32.py)
========================================================================================
- 역할:
  제트아이(plugin_zeye_os), 센스톡(plugin_senstalk), 루미노트(plugin_lumisender) 등
  모든 내장 소프트웨어 플러그인이 공통으로 사용하는 순수 Win32 ctypes 제어 모듈입니다.
- 주요 기능:
  1. WinSta0\\Default 대화형 데스크톱 강제 바인딩 (백그라운드/트레이 스레드 키보드·창 제어 보장)
  2. AttachThreadInput 기반 무결점 창 포커스 전환 (force_foreground_window)
  3. 유니코드 텍스트 및 CF_DIB 비트맵 이미지 클립보드 주입
  4. SendInput 기반 단축키(Ctrl+V, Ctrl+F, Enter, ESC) 및 유니코드 문자열 물리 타건
  5. HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run 윈도우 시작 시 자동실행 관리
"""

import base64
import ctypes
import io
import os
import sys
import time
from ctypes import wintypes
from typing import Optional

if sys.platform == "win32":
    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
    gdi32 = ctypes.windll.gdi32
else:
    user32 = None
    kernel32 = None
    gdi32 = None

VK_RETURN = 0x0D
VK_ESCAPE = 0x1B
VK_CONTROL = 0x11
VK_MENU = 0x12
VK_F3 = 0x72
VK_F8 = 0x77
VK_F9 = 0x78
VK_V = 0x56
VK_F = 0x46
VK_A = 0x41
VK_BACK = 0x08

KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_UNICODE = 0x0004
SW_RESTORE = 9
SW_SHOW = 5
CF_UNICODETEXT = 13
CF_DIB = 8
GMEM_MOVEABLE = 0x0002

AUTOSTART_REG_PATH = r"Software\Microsoft\Windows\CurrentVersion\Run"
AUTOSTART_VALUE_NAME = "MerlinZCoreDaemon"


def bind_interactive_desktop() -> bool:
    """현재 스레드를 사용자의 활성 대화형 데스크톱(WinSta0\\Default)에 직결합니다."""
    if sys.platform != "win32" or not user32:
        return False
    try:
        hdesk = user32.OpenInputDesktop(0, False, 0x01FF)
        if not hdesk:
            hdesk = user32.OpenDesktopW("Default", 0, False, 0x01FF)
        if hdesk:
            user32.SetThreadDesktop(hdesk)
            user32.CloseDesktop(hdesk)
            return True
    except Exception:
        pass
    return False


def force_foreground_window(hwnd: int) -> bool:
    """AttachThreadInput + Alt 더미 해제로 백그라운드에서도 타겟 창을 최상단 포커스로 전환합니다."""
    if sys.platform != "win32" or not user32 or not hwnd:
        return False
    try:
        bind_interactive_desktop()
        if user32.IsIconic(hwnd):
            user32.ShowWindow(hwnd, SW_RESTORE)
        else:
            user32.ShowWindow(hwnd, SW_SHOW)

        fg_hwnd = user32.GetForegroundWindow()
        fg_tid = user32.GetWindowThreadProcessId(fg_hwnd, None) if fg_hwnd else 0
        cur_tid = kernel32.GetCurrentThreadId()
        target_tid = user32.GetWindowThreadProcessId(hwnd, None)

        attached_fg = False
        attached_target = False
        if fg_tid and fg_tid != cur_tid:
            attached_fg = bool(user32.AttachThreadInput(cur_tid, fg_tid, True))
        if target_tid and target_tid != cur_tid:
            attached_target = bool(user32.AttachThreadInput(cur_tid, target_tid, True))

        user32.keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0)
        user32.BringWindowToTop(hwnd)
        user32.SetForegroundWindow(hwnd)
        user32.SetFocus(hwnd)

        if attached_target:
            user32.AttachThreadInput(cur_tid, target_tid, False)
        if attached_fg:
            user32.AttachThreadInput(cur_tid, fg_tid, False)
        return True
    except Exception:
        return False


def set_clipboard_unicode(text: str) -> bool:
    """Windows 클립보드에 유니코드 텍스트를 설정합니다."""
    if sys.platform != "win32":
        return False
    try:
        import win32clipboard
        import win32con

        for _ in range(5):
            try:
                win32clipboard.OpenClipboard()
                win32clipboard.EmptyClipboard()
                win32clipboard.SetClipboardData(win32con.CF_UNICODETEXT, text)
                win32clipboard.CloseClipboard()
                return True
            except Exception:
                time.sleep(0.03)
    except ImportError:
        pass

    try:
        encoded = (text + "\0").encode("utf-16-le")
        for _ in range(5):
            if user32.OpenClipboard(None):
                user32.EmptyClipboard()
                h_mem = kernel32.GlobalAlloc(GMEM_MOVEABLE, len(encoded))
                if h_mem:
                    ptr = kernel32.GlobalLock(h_mem)
                    if ptr:
                        ctypes.memmove(ptr, encoded, len(encoded))
                        kernel32.GlobalUnlock(h_mem)
                        user32.SetClipboardData(CF_UNICODETEXT, h_mem)
                user32.CloseClipboard()
                return True
            time.sleep(0.03)
    except Exception:
        pass
    return False


def set_clipboard_image_dataurl(data_url: str) -> bool:
    """Base64 DataURL 이미지를 디코딩하여 Windows CF_DIB 비트맵 클립보드에 주입합니다."""
    if sys.platform != "win32" or not data_url:
        return False
    try:
        from PIL import Image
        import win32clipboard

        raw_b64 = data_url.split(",", 1)[1] if "," in data_url else data_url
        img_bytes = base64.b64decode(raw_b64)
        image = Image.open(io.BytesIO(img_bytes))
        if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
            bg = Image.new("RGB", image.size, (255, 255, 255))
            bg.paste(image, mask=image.convert("RGBA").split()[3])
            image = bg
        else:
            image = image.convert("RGB")

        output = io.BytesIO()
        image.save(output, "BMP")
        dib_data = output.getvalue()[14:]
        output.close()

        for _ in range(5):
            try:
                win32clipboard.OpenClipboard()
                win32clipboard.EmptyClipboard()
                win32clipboard.SetClipboardData(win32clipboard.CF_DIB, dib_data)
                win32clipboard.CloseClipboard()
                return True
            except Exception:
                time.sleep(0.04)
    except Exception:
        pass
    return False


def is_autostart_enabled(app_name: str = AUTOSTART_VALUE_NAME) -> bool:
    """윈도우 시작프로그램(HKCU\\...\\Run)에 통합 Z-코어 데몬이 등록되어 있는지 확인합니다."""
    if sys.platform != "win32":
        return False
    try:
        import winreg

        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, AUTOSTART_REG_PATH, 0, winreg.KEY_READ) as key:
            val, _ = winreg.QueryValueEx(key, app_name)
            return bool(val and str(val).strip())
    except Exception:
        return False


def set_autostart_enabled(enable: bool, daemon_script_path: Optional[str] = None, app_name: str = AUTOSTART_VALUE_NAME) -> bool:
    """윈도우 시작 시 통합 Z-코어 트레이 데몬이 자동 실행되도록 등록 또는 해제합니다."""
    if sys.platform != "win32":
        return False
    try:
        import winreg

        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, AUTOSTART_REG_PATH, 0, winreg.KEY_SET_VALUE) as key:
            if enable:
                target_script = daemon_script_path or os.path.abspath(
                    os.path.join(os.path.dirname(__file__), "merlin_z_core_daemon.py")
                )
                python_exe = sys.executable
                pythonw_exe = os.path.join(os.path.dirname(python_exe), "pythonw.exe")
                runner = pythonw_exe if os.path.exists(pythonw_exe) else python_exe
                cmd = f'"{runner}" "{target_script}"'
                winreg.SetValueEx(key, app_name, 0, winreg.REG_SZ, cmd)
            else:
                try:
                    winreg.DeleteValue(key, app_name)
                except FileNotFoundError:
                    pass
        return True
    except Exception:
        return False
